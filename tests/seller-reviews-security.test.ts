import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// DATA MODELS & INTERFACES (Mirroring Firestore Data & Auth)
// ============================================================================

interface MockAuth {
  uid: string;
}

interface MockListing {
  id: string;
  sellerId: string;
  title: string;
  price: number;
  currency: string;
  listingType?: 'physical' | 'service' | 'project' | 'digital';
  category?: string;
  status: 'active' | 'reserved' | 'sold' | 'deleted';
  activeOrderId?: string;
}

interface MockOrder {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  amount: number;
  currency: string;
  itemTitle: string;
  status: 'pending' | 'booked' | 'processing' | 'shipped' | 'in_progress' | 'completed' | 'cancelled' | 'refunded';
  createdAt: number;
}

interface MockReview {
  id?: string;
  orderId: string;
  listingId?: string;
  buyerId: string;
  sellerId: string;
  buyerName?: string;
  rating: number;
  text: string;
  createdAt: number;
}

const isValidId = (id: unknown): boolean => {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
};

const isValidOrderShape = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false;
  const keys = Object.keys(data);
  const required = ['buyerId', 'sellerId', 'listingId', 'amount', 'currency', 'itemTitle', 'status', 'createdAt'];
  if (!required.every(k => keys.includes(k))) return false;
  if (!isValidId(data.buyerId)) return false;
  if (!isValidId(data.sellerId)) return false;
  if (!isValidId(data.listingId)) return false;
  if (typeof data.amount !== 'number' || data.amount < 0 || isNaN(data.amount)) return false;
  if (typeof data.currency !== 'string' || data.currency.length < 2 || data.currency.length > 5) return false;
  if (typeof data.itemTitle !== 'string' || data.itemTitle.length < 1 || data.itemTitle.length > 200) return false;
  const validStatuses = ['pending', 'booked', 'processing', 'shipped', 'in_progress', 'completed', 'cancelled', 'refunded'];
  if (!validStatuses.includes(data.status)) return false;
  return true;
};

// ============================================================================
// FIRESTORE RULES SIMULATOR: ORDERS (Part A)
// ============================================================================

const evaluateOrderCreateRule = (
  orderId: string,
  incoming: any,
  auth: MockAuth | null,
  listingsDb: Map<string, MockListing>,
  afterListingState?: MockListing
): { allowed: boolean; reason?: string } => {
  if (!auth) return { allowed: false, reason: 'UNAUTHENTICATED' };
  if (!isValidId(orderId)) return { allowed: false, reason: 'INVALID_ORDER_ID' };
  if (!isValidOrderShape(incoming)) return { allowed: false, reason: 'INVALID_ORDER_SHAPE' };

  if (incoming.buyerId !== auth.uid) {
    return { allowed: false, reason: 'BUYER_ID_FORGERY' };
  }
  if (incoming.sellerId === auth.uid) {
    return { allowed: false, reason: 'CANNOT_BUY_FROM_SELF' };
  }

  const listing = listingsDb.get(incoming.listingId);
  if (!listing) {
    return { allowed: false, reason: 'LISTING_DOES_NOT_EXIST' };
  }

  if (listing.sellerId !== incoming.sellerId) {
    return { allowed: false, reason: 'SELLER_ID_FORGERY' };
  }

  const isServiceOrProject = ['service', 'project'].includes(listing.listingType || '') ||
                             ['service', 'project'].includes(listing.category || '');
  const isDigital = listing.listingType === 'digital' || listing.category === 'digital';
  const isPhysical = !isServiceOrProject && !isDigital;

  // Condition 1: Service / Project listings MUST start as 'booked'
  if (isServiceOrProject) {
    if (incoming.status === 'booked') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'SERVICE_OR_PROJECT_MUST_START_BOOKED' };
  }

  // Condition 2: Physical product listings MUST start as 'pending'
  if (isPhysical) {
    if (incoming.status === 'pending') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'PHYSICAL_ORDER_MUST_START_PENDING' };
  }

  // Condition 3: Digital listings can start as 'completed' ONLY IF atomic listing update occurs
  if (isDigital) {
    if (incoming.status === 'completed') {
      if (afterListingState && afterListingState.status === 'sold' && afterListingState.activeOrderId === orderId) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'DIGITAL_COMPLETED_REQUIRES_ATOMIC_LISTING_UPDATE' };
    }
    return { allowed: false, reason: 'DIGITAL_ORDER_MUST_BE_COMPLETED_WITH_ATOMIC_UPDATE' };
  }

  return { allowed: false, reason: 'UNAUTHORIZED_INITIAL_ORDER_STATUS' };
};

const evaluateOrderStatusTransition = (
  order: MockOrder,
  newStatus: MockOrder['status'],
  auth: MockAuth | null
): { allowed: boolean; reason?: string } => {
  if (!auth) return { allowed: false, reason: 'UNAUTHENTICATED' };
  const isSeller = auth.uid === order.sellerId;
  const isBuyer = auth.uid === order.buyerId;

  // Normal lifecycle progression: pending -> processing -> shipped -> completed
  if (isSeller) {
    if (['processing', 'shipped', 'in_progress', 'completed'].includes(newStatus)) {
      return { allowed: true };
    }
  }

  // Buyer can confirm receipt/completion when shipped/in_progress
  if (isBuyer && ['shipped', 'in_progress'].includes(order.status) && newStatus === 'completed') {
    return { allowed: true };
  }

  // Cancellation rules
  if (newStatus === 'cancelled') {
    if (isBuyer && ['pending', 'booked'].includes(order.status)) return { allowed: true };
    if (isSeller && ['pending', 'booked', 'processing', 'in_progress'].includes(order.status)) return { allowed: true };
  }

  return { allowed: false, reason: 'UNAUTHORIZED_STATUS_TRANSITION' };
};

// ============================================================================
// FIRESTORE RULES SIMULATOR: REVIEWS (Part B)
// ============================================================================

const isValidReviewShape = (data: any, auth: MockAuth | null): boolean => {
  if (!auth) return false;
  if (!data || typeof data !== 'object') return false;

  const keys = Object.keys(data);
  const required = ['orderId', 'buyerId', 'sellerId', 'rating', 'text', 'createdAt'];
  if (!required.every(k => keys.includes(k))) return false;
  if (keys.length < 6 || keys.length > 10) return false;

  if (!isValidId(data.orderId)) return false;
  if (!isValidId(data.buyerId)) return false;
  if (!isValidId(data.sellerId)) return false;

  if (data.buyerId !== auth.uid) return false;
  if (data.sellerId === auth.uid) return false;

  if (typeof data.rating !== 'number' || data.rating < 1 || data.rating > 5) return false;
  if (typeof data.text !== 'string' || data.text.length > 2000) return false;

  if ('listingId' in data && (!data.listingId || !isValidId(data.listingId))) return false;
  if ('buyerName' in data && (typeof data.buyerName !== 'string' || data.buyerName.length > 100)) return false;

  return true;
};

const evaluateReviewCreateRule = (
  reviewId: string,
  incoming: any,
  auth: MockAuth | null,
  ordersDb: Map<string, MockOrder>,
  existingReviewsDb: Map<string, MockReview>,
  requestTime: number
): { allowed: boolean; reason?: string } => {
  if (!auth) return { allowed: false, reason: 'UNAUTHENTICATED' };
  if (!isValidId(reviewId)) return { allowed: false, reason: 'INVALID_REVIEW_ID' };

  if (existingReviewsDb.has(reviewId)) {
    return { allowed: false, reason: 'DOCUMENT_ALREADY_EXISTS_DUPLICATE_ORDER' };
  }

  if (reviewId !== `rev_${incoming.orderId}`) {
    return { allowed: false, reason: 'NON_DETERMINISTIC_REVIEW_ID' };
  }

  if (!isValidReviewShape(incoming, auth)) {
    return { allowed: false, reason: 'INVALID_REVIEW_SHAPE_OR_AUTH_MISMATCH' };
  }

  if (incoming.createdAt !== requestTime) {
    return { allowed: false, reason: 'TIMESTAMP_TAMPERING' };
  }

  const order = ordersDb.get(incoming.orderId);
  if (!order) {
    return { allowed: false, reason: 'ORDER_DOES_NOT_EXIST' };
  }

  if (order.buyerId !== auth.uid) {
    return { allowed: false, reason: 'ORDER_BUYER_MISMATCH' };
  }

  if (order.sellerId !== incoming.sellerId) {
    return { allowed: false, reason: 'ORDER_SELLER_MISMATCH' };
  }

  if (order.status !== 'completed') {
    return { allowed: false, reason: 'ORDER_NOT_COMPLETED' };
  }

  if ('listingId' in incoming && incoming.listingId !== order.listingId) {
    return { allowed: false, reason: 'ORDER_LISTING_MISMATCH' };
  }

  return { allowed: true };
};

// ============================================================================
// CLIENT-SIDE ELIGIBILITY LOGIC SIMULATOR (Decoupled from 20-review limit)
// ============================================================================

interface EligibilityResult {
  unreviewedCompletedOrders: MockOrder[];
  isChecking: boolean;
  error: string | null;
}

const computeReviewEligibility = async (
  buyerId: string,
  targetSellerId: string,
  allBuyerOrders: MockOrder[],
  lookupDoc: (docId: string) => Promise<{ exists: boolean }>
): Promise<EligibilityResult> => {
  const eligible = allBuyerOrders.filter(o => o.buyerId === buyerId && o.sellerId === targetSellerId && o.status === 'completed');
  if (eligible.length === 0) {
    return { unreviewedCompletedOrders: [], isChecking: false, error: null };
  }

  try {
    const lookups = await Promise.all(
      eligible.map(async o => {
        const snap = await lookupDoc(`rev_${o.id}`);
        return { order: o, reviewed: snap.exists };
      })
    );
    const unreviewed = lookups.filter(l => !l.reviewed).map(l => l.order);
    return { unreviewedCompletedOrders: unreviewed, isChecking: false, error: null };
  } catch (err: any) {
    // Honest failure reporting: NEVER assume an order is unreviewed on error!
    return { unreviewedCompletedOrders: [], isChecking: false, error: err?.message || 'Lookup failed' };
  }
};

// ============================================================================
// TEST SUITE: ORDER CREATION SECURITY INVARIANTS (PART A)
// ============================================================================

describe('Proton Market Hub: Order Creation Security Invariants (Part A)', () => {
  const buyerAuth: MockAuth = { uid: 'buyer_real_111' };
  const attackerAuth: MockAuth = { uid: 'attacker_fake_999' };
  const sellerId = 'seller_vendor_222';

  const physicalListing: MockListing = {
    id: 'list_physical_001',
    sellerId: sellerId,
    title: 'Precision Milling Tool',
    price: 350,
    currency: 'USD',
    listingType: 'physical',
    status: 'active'
  };

  const serviceListing: MockListing = {
    id: 'list_service_002',
    sellerId: sellerId,
    title: 'CNC Repair Consultation',
    price: 120,
    currency: 'USD',
    listingType: 'service',
    status: 'active'
  };

  const digitalListing: MockListing = {
    id: 'list_digital_003',
    sellerId: sellerId,
    title: 'CAD 3D Blueprint Pack',
    price: 49,
    currency: 'USD',
    listingType: 'digital',
    status: 'active'
  };

  const listingsDb = new Map<string, MockListing>([
    [physicalListing.id, physicalListing],
    [serviceListing.id, serviceListing],
    [digitalListing.id, digitalListing]
  ]);

  it('1. Service/project listings cannot create orders with "pending" if their required initial status is "booked"', () => {
    // Service listing with 'pending'
    const pendingServiceOrder: any = {
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      listingId: serviceListing.id,
      amount: 120,
      currency: 'USD',
      itemTitle: 'CNC Repair Consultation',
      status: 'pending', // FORBIDDEN: Service listings cannot be pending
      createdAt: 1700000000
    };
    const servicePendingResult = evaluateOrderCreateRule('ord_srv_pending', pendingServiceOrder, buyerAuth, listingsDb);
    assert.equal(servicePendingResult.allowed, false);
    assert.equal(servicePendingResult.reason, 'SERVICE_OR_PROJECT_MUST_START_BOOKED');

    // Project listing (category: 'project') with 'pending'
    const projectListing: MockListing = {
      id: 'list_project_004',
      sellerId: sellerId,
      title: 'Solar Array CAD Design',
      price: 500,
      currency: 'USD',
      category: 'project',
      status: 'active'
    };
    const projectDb = new Map(listingsDb).set(projectListing.id, projectListing);
    const pendingProjectOrder: any = {
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      listingId: projectListing.id,
      amount: 500,
      currency: 'USD',
      itemTitle: 'Solar Array CAD Design',
      status: 'pending', // FORBIDDEN: Project listings cannot be pending
      createdAt: 1700000000
    };
    const projectPendingResult = evaluateOrderCreateRule('ord_prj_pending', pendingProjectOrder, buyerAuth, projectDb);
    assert.equal(projectPendingResult.allowed, false);
    assert.equal(projectPendingResult.reason, 'SERVICE_OR_PROJECT_MUST_START_BOOKED');

    // Service listing with 'completed'
    const completedServiceOrder: any = {
      ...pendingServiceOrder,
      status: 'completed'
    };
    const serviceCompletedResult = evaluateOrderCreateRule('ord_srv_comp', completedServiceOrder, buyerAuth, listingsDb);
    assert.equal(serviceCompletedResult.allowed, false);
    assert.equal(serviceCompletedResult.reason, 'SERVICE_OR_PROJECT_MUST_START_BOOKED');
  });

  it('2. Physical listings cannot create orders directly with "completed" or an invalid initial status', () => {
    // Attempt physical with 'completed' directly
    const forgedCompletedOrder: any = {
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      listingId: physicalListing.id,
      amount: 350,
      currency: 'USD',
      itemTitle: 'Precision Milling Tool',
      status: 'completed', // FORBIDDEN: Physical cannot start as 'completed'
      createdAt: 1700000000
    };
    const completedResult = evaluateOrderCreateRule('ord_phys_comp', forgedCompletedOrder, buyerAuth, listingsDb);
    assert.equal(completedResult.allowed, false);
    assert.equal(completedResult.reason, 'PHYSICAL_ORDER_MUST_START_PENDING');

    // Attempt physical with 'booked'
    const forgedBookedOrder: any = {
      ...forgedCompletedOrder,
      status: 'booked' // FORBIDDEN: Physical cannot start as 'booked'
    };
    const bookedResult = evaluateOrderCreateRule('ord_phys_booked', forgedBookedOrder, buyerAuth, listingsDb);
    assert.equal(bookedResult.allowed, false);
    assert.equal(bookedResult.reason, 'PHYSICAL_ORDER_MUST_START_PENDING');
  });

  it('3. Legitimate physical orders can start as "pending" and transition to "completed"', () => {
    const validPhysicalOrder: any = {
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      listingId: physicalListing.id,
      amount: 350,
      currency: 'USD',
      itemTitle: 'Precision Milling Tool',
      status: 'pending',
      createdAt: 1700000000
    };

    const createResult = evaluateOrderCreateRule('ord_legit_phys_001', validPhysicalOrder, buyerAuth, listingsDb);
    assert.equal(createResult.allowed, true);

    // Lifecycle transitions: pending -> processing -> shipped -> completed
    const orderDoc: MockOrder = { id: 'ord_legit_phys_001', ...validPhysicalOrder };
    const sellerAuth: MockAuth = { uid: sellerId };

    const toProcessing = evaluateOrderStatusTransition(orderDoc, 'processing', sellerAuth);
    assert.equal(toProcessing.allowed, true);

    const shippedDoc: MockOrder = { ...orderDoc, status: 'shipped' };
    const toCompletedByBuyer = evaluateOrderStatusTransition(shippedDoc, 'completed', buyerAuth);
    assert.equal(toCompletedByBuyer.allowed, true);
  });

  it('4. Legitimate service/project orders can start as "booked" and transition through their workflow', () => {
    const validServiceOrder: any = {
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      listingId: serviceListing.id,
      amount: 120,
      currency: 'USD',
      itemTitle: 'CNC Repair Consultation',
      status: 'booked',
      createdAt: 1700000000
    };

    const validResult = evaluateOrderCreateRule('ord_service_legit', validServiceOrder, buyerAuth, listingsDb);
    assert.equal(validResult.allowed, true);

    // Workflow transition: booked -> in_progress -> completed
    const serviceDoc: MockOrder = { id: 'ord_service_legit', ...validServiceOrder };
    const sellerAuth: MockAuth = { uid: sellerId };
    const toInProgress = evaluateOrderStatusTransition(serviceDoc, 'in_progress', sellerAuth);
    assert.equal(toInProgress.allowed, true);

    const inProgressDoc: MockOrder = { ...serviceDoc, status: 'in_progress' };
    const toCompleted = evaluateOrderStatusTransition(inProgressDoc, 'completed', sellerAuth);
    assert.equal(toCompleted.allowed, true);
  });

  it('5. Digital orders can start as "completed" only under the existing secure atomic listing-update conditions', () => {
    const digitalOrder: any = {
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      listingId: digitalListing.id,
      amount: 49,
      currency: 'USD',
      itemTitle: 'CAD 3D Blueprint Pack',
      status: 'completed',
      createdAt: 1700000000
    };

    // Case A: Missing atomic listing update -> REJECTED
    const rejectedResult = evaluateOrderCreateRule('ord_dig_001', digitalOrder, buyerAuth, listingsDb, undefined);
    assert.equal(rejectedResult.allowed, false);
    assert.equal(rejectedResult.reason, 'DIGITAL_COMPLETED_REQUIRES_ATOMIC_LISTING_UPDATE');

    // Case B: Digital order trying to start as 'pending' -> REJECTED
    const pendingDigitalOrder = { ...digitalOrder, status: 'pending' };
    const pendingDigitalResult = evaluateOrderCreateRule('ord_dig_pending', pendingDigitalOrder, buyerAuth, listingsDb);
    assert.equal(pendingDigitalResult.allowed, false);
    assert.equal(pendingDigitalResult.reason, 'DIGITAL_ORDER_MUST_BE_COMPLETED_WITH_ATOMIC_UPDATE');

    // Case C: Listing updated atomically to sold with activeOrderId matching -> ALLOWED
    const atomicUpdatedListing: MockListing = {
      ...digitalListing,
      status: 'sold',
      activeOrderId: 'ord_dig_001'
    };
    const allowedResult = evaluateOrderCreateRule('ord_dig_001', digitalOrder, buyerAuth, listingsDb, atomicUpdatedListing);
    assert.equal(allowedResult.allowed, true);
  });

  it('6. A user cannot forge buyerId or sellerId on order creation', () => {
    // Forged buyerId (attacker impersonating real buyer)
    const forgedBuyerOrder: any = {
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      listingId: physicalListing.id,
      amount: 350,
      currency: 'USD',
      itemTitle: 'Precision Milling Tool',
      status: 'pending',
      createdAt: 1700000000
    };
    const buyerResult = evaluateOrderCreateRule('ord_forged_buyer', forgedBuyerOrder, attackerAuth, listingsDb);
    assert.equal(buyerResult.allowed, false);
    assert.equal(buyerResult.reason, 'BUYER_ID_FORGERY');

    // Forged sellerId (buyer assigning order to an unrelated seller)
    const forgedSellerOrder: any = {
      buyerId: buyerAuth.uid,
      sellerId: 'innocent_bystander_777', // Does not match physicalListing.sellerId
      listingId: physicalListing.id,
      amount: 350,
      currency: 'USD',
      itemTitle: 'Precision Milling Tool',
      status: 'pending',
      createdAt: 1700000000
    };
    const sellerResult = evaluateOrderCreateRule('ord_forged_seller', forgedSellerOrder, buyerAuth, listingsDb);
    assert.equal(sellerResult.allowed, false);
    assert.equal(sellerResult.reason, 'SELLER_ID_FORGERY');
  });
});

// ============================================================================
// TEST SUITE: VERIFIED SELLER REVIEWS SECURITY INVARIANTS
// ============================================================================

describe('Proton Market Hub: Verified Seller Reviews Security Invariants', () => {
  const buyerAuth: MockAuth = { uid: 'buyer_user_123' };
  const attackerAuth: MockAuth = { uid: 'attacker_user_666' };
  const sellerId = 'seller_vendor_456';
  const requestTime = 1700000000;

  const sampleCompletedOrder: MockOrder = {
    id: 'ord_real_completed_001',
    buyerId: 'buyer_user_123',
    sellerId: 'seller_vendor_456',
    listingId: 'prod_999',
    amount: 150,
    currency: 'USD',
    itemTitle: 'Industrial Lathe Component',
    status: 'completed',
    createdAt: requestTime - 3600
  };

  const samplePendingOrder: MockOrder = {
    id: 'ord_real_pending_002',
    buyerId: 'buyer_user_123',
    sellerId: 'seller_vendor_456',
    listingId: 'prod_999',
    amount: 150,
    currency: 'USD',
    itemTitle: 'Industrial Lathe Component',
    status: 'pending',
    createdAt: requestTime - 3600
  };

  const ordersDb = new Map<string, MockOrder>([
    [sampleCompletedOrder.id, sampleCompletedOrder],
    [samplePendingOrder.id, samplePendingOrder]
  ]);

  const existingReviewsDb = new Map<string, MockReview>();

  it('6. A completed order qualifies for a review only when genuine, completed, belongs to the buyer, and targets the correct seller', () => {
    // Incomplete order cannot be reviewed
    const pendingPayload = {
      orderId: samplePendingOrder.id,
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      rating: 5,
      text: 'Trying to review before completion',
      createdAt: requestTime
    };
    const pendingResult = evaluateReviewCreateRule(
      `rev_${pendingPayload.orderId}`,
      pendingPayload,
      buyerAuth,
      ordersDb,
      existingReviewsDb,
      requestTime
    );
    assert.equal(pendingResult.allowed, false);
    assert.equal(pendingResult.reason, 'ORDER_NOT_COMPLETED');

    // Genuine completed order succeeds
    const validPayload: MockReview = {
      orderId: sampleCompletedOrder.id,
      listingId: sampleCompletedOrder.listingId,
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      buyerName: 'Verified Buyer Bob',
      rating: 5,
      text: 'Superb quality, verified order!',
      createdAt: requestTime
    };
    const validResult = evaluateReviewCreateRule(
      `rev_${validPayload.orderId}`,
      validPayload,
      buyerAuth,
      ordersDb,
      existingReviewsDb,
      requestTime
    );
    assert.equal(validResult.allowed, true);
    existingReviewsDb.set(`rev_${validPayload.orderId}`, validPayload);

    // Duplicate review for the same order is rejected
    const duplicateResult = evaluateReviewCreateRule(
      `rev_${validPayload.orderId}`,
      validPayload,
      buyerAuth,
      ordersDb,
      existingReviewsDb,
      requestTime
    );
    assert.equal(duplicateResult.allowed, false);
    assert.equal(duplicateResult.reason, 'DOCUMENT_ALREADY_EXISTS_DUPLICATE_ORDER');
  });
});

// ============================================================================
// TEST SUITE: REVIEW ELIGIBILITY LOOKUP & UI DECOUPLING (PART B)
// ============================================================================

describe('Proton Market Hub: Review Eligibility Lookup & UI Decoupling (Part B)', () => {
  const buyerId = 'buyer_user_123';
  const vendorId = 'seller_vendor_456';

  const order1: MockOrder = {
    id: 'ord_comp_001',
    buyerId,
    sellerId: vendorId,
    listingId: 'list_1',
    amount: 100,
    currency: 'USD',
    itemTitle: 'Item 1',
    status: 'completed',
    createdAt: 1000
  };

  const order2: MockOrder = {
    id: 'ord_comp_002',
    buyerId,
    sellerId: vendorId,
    listingId: 'list_2',
    amount: 200,
    currency: 'USD',
    itemTitle: 'Item 2',
    status: 'completed',
    createdAt: 2000
  };

  it('7. An order that has already been reviewed is NOT offered in the review form, even if the review was created outside the latest 20 global reviews', async () => {
    // Simulate Firestore where rev_ord_comp_001 exists in the database
    // (even if there were 100 newer reviews for other sellers/orders)
    const firestoreSellerReviews = new Map<string, boolean>([
      [`rev_${order1.id}`, true] // order1 is already reviewed
      // order2 is NOT reviewed
    ]);

    const mockLookup = async (docId: string) => {
      return { exists: firestoreSellerReviews.has(docId) };
    };

    const result = await computeReviewEligibility(
      buyerId,
      vendorId,
      [order1, order2],
      mockLookup
    );

    assert.equal(result.error, null);
    // Only order2 is unreviewed and eligible
    assert.equal(result.unreviewedCompletedOrders.length, 1);
    assert.equal(result.unreviewedCompletedOrders[0].id, order2.id);
  });

  it('8. If the eligibility lookup fails, the UI does NOT fall back to assuming the order is unreviewed', async () => {
    // Simulate network error during getDoc lookup
    const failingLookup = async (_docId: string): Promise<{ exists: boolean }> => {
      throw new Error('Unavailable: Firestore offline or network failure');
    };

    const result = await computeReviewEligibility(
      buyerId,
      vendorId,
      [order1, order2],
      failingLookup
    );

    // CRITICAL SECURITY & UX REQUIREMENT:
    // On failure, error MUST be surfaced, and unreviewedCompletedOrders MUST NOT contain orders!
    assert.notEqual(result.error, null);
    assert.match(result.error!, /Firestore offline/);
    assert.equal(result.unreviewedCompletedOrders.length, 0);
  });
});
