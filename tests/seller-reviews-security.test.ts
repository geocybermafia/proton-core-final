import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirror of firestore.rules logic for testing invariants against zero-trust specification
interface MockAuth {
  uid: string;
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

// Firestore Rules evaluation simulator for seller_reviews
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

const evaluateReviewUpdateRule = (
  reviewId: string,
  incoming: any,
  existing: MockReview,
  auth: MockAuth | null
): { allowed: boolean; reason?: string } => {
  if (!auth) return { allowed: false, reason: 'UNAUTHENTICATED' };
  if (!isValidId(reviewId)) return { allowed: false, reason: 'INVALID_REVIEW_ID' };

  if (existing.buyerId !== auth.uid) {
    return { allowed: false, reason: 'NOT_ORIGINAL_AUTHOR' };
  }

  if (incoming.buyerId !== existing.buyerId) {
    return { allowed: false, reason: 'IMMUTABLE_BUYER_ID' };
  }

  if (incoming.sellerId !== existing.sellerId) {
    return { allowed: false, reason: 'IMMUTABLE_SELLER_ID' };
  }

  if ('orderId' in existing && incoming.orderId !== existing.orderId) {
    return { allowed: false, reason: 'IMMUTABLE_ORDER_ID' };
  }

  if ('listingId' in existing && incoming.listingId !== existing.listingId) {
    return { allowed: false, reason: 'IMMUTABLE_LISTING_ID' };
  }

  if (incoming.createdAt !== existing.createdAt) {
    return { allowed: false, reason: 'IMMUTABLE_CREATED_AT' };
  }

  if (typeof incoming.rating !== 'number' || incoming.rating < 1 || incoming.rating > 5) {
    return { allowed: false, reason: 'INVALID_RATING' };
  }

  if (typeof incoming.text !== 'string' || incoming.text.length > 2000) {
    return { allowed: false, reason: 'INVALID_TEXT' };
  }

  return { allowed: true };
};

const evaluateReviewDeleteRule = (
  reviewId: string,
  existing: MockReview,
  auth: MockAuth | null
): { allowed: boolean; reason?: string } => {
  if (!auth) return { allowed: false, reason: 'UNAUTHENTICATED' };
  if (!isValidId(reviewId)) return { allowed: false, reason: 'INVALID_REVIEW_ID' };

  if (existing.buyerId !== auth.uid) {
    return { allowed: false, reason: 'NOT_ORIGINAL_AUTHOR' };
  }

  return { allowed: true };
};

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

  const sampleCancelledOrder: MockOrder = {
    id: 'ord_real_cancelled_003',
    buyerId: 'buyer_user_123',
    sellerId: 'seller_vendor_456',
    listingId: 'prod_999',
    amount: 150,
    currency: 'USD',
    itemTitle: 'Industrial Lathe Component',
    status: 'cancelled',
    createdAt: requestTime - 3600
  };

  const sampleSecondCompletedOrder: MockOrder = {
    id: 'ord_real_completed_004',
    buyerId: 'buyer_user_123',
    sellerId: 'seller_vendor_456',
    listingId: 'prod_888',
    amount: 220,
    currency: 'USD',
    itemTitle: 'Precision Bearing Set',
    status: 'completed',
    createdAt: requestTime - 1800
  };

  const ordersDb = new Map<string, MockOrder>([
    [sampleCompletedOrder.id, sampleCompletedOrder],
    [samplePendingOrder.id, samplePendingOrder],
    [sampleCancelledOrder.id, sampleCancelledOrder],
    [sampleSecondCompletedOrder.id, sampleSecondCompletedOrder],
  ]);

  const existingReviewsDb = new Map<string, MockReview>();

  it('1. A user without a completed order cannot create a review', () => {
    const payload = {
      orderId: 'non_existent_order_777',
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      rating: 5,
      text: 'Great transaction, totally real!',
      createdAt: requestTime
    };

    const result = evaluateReviewCreateRule(
      `rev_${payload.orderId}`,
      payload,
      buyerAuth,
      ordersDb,
      existingReviewsDb,
      requestTime
    );

    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'ORDER_DOES_NOT_EXIST');
  });

  it('2. A buyer with a pending or cancelled order cannot create a review', () => {
    // Attempt with pending order
    const pendingPayload = {
      orderId: samplePendingOrder.id,
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      rating: 4,
      text: 'Still waiting on delivery but leaving review early',
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

    // Attempt with cancelled order
    const cancelledPayload = {
      orderId: sampleCancelledOrder.id,
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      rating: 1,
      text: 'Order was cancelled but I am reviewing anyway',
      createdAt: requestTime
    };
    const cancelledResult = evaluateReviewCreateRule(
      `rev_${cancelledPayload.orderId}`,
      cancelledPayload,
      buyerAuth,
      ordersDb,
      existingReviewsDb,
      requestTime
    );
    assert.equal(cancelledResult.allowed, false);
    assert.equal(cancelledResult.reason, 'ORDER_NOT_COMPLETED');
  });

  it('3. A buyer with a completed order can create a valid review', () => {
    const validPayload: MockReview = {
      orderId: sampleCompletedOrder.id,
      listingId: sampleCompletedOrder.listingId,
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      buyerName: 'Verified Buyer Bob',
      rating: 5,
      text: 'Superb quality, perfectly matched spec!',
      createdAt: requestTime
    };

    const result = evaluateReviewCreateRule(
      `rev_${validPayload.orderId}`,
      validPayload,
      buyerAuth,
      ordersDb,
      existingReviewsDb,
      requestTime
    );

    assert.equal(result.allowed, true);
    // Simulate successful write in DB
    existingReviewsDb.set(`rev_${validPayload.orderId}`, validPayload);
  });

  it('4. A buyer cannot review a different seller using someone else\'s order or wrong sellerId', () => {
    // Fresh unreviewed order for this test
    const unreviewedOrder = sampleSecondCompletedOrder;

    const hijackedPayload = {
      orderId: unreviewedOrder.id,
      buyerId: attackerAuth.uid, // Attacker trying to claim buyer order
      sellerId: sellerId,
      rating: 1,
      text: 'Fake negative review using stolen order ID',
      createdAt: requestTime
    };

    const result = evaluateReviewCreateRule(
      `rev_${hijackedPayload.orderId}`,
      hijackedPayload,
      attackerAuth,
      ordersDb,
      existingReviewsDb,
      requestTime
    );

    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'ORDER_BUYER_MISMATCH');

    // Also test legitimate buyer trying to target another innocent seller using this order
    const wrongSellerPayload = {
      orderId: unreviewedOrder.id,
      buyerId: buyerAuth.uid,
      sellerId: 'innocent_seller_999',
      rating: 1,
      text: 'Targeting wrong seller',
      createdAt: requestTime
    };
    const wrongSellerResult = evaluateReviewCreateRule(
      `rev_${wrongSellerPayload.orderId}`,
      wrongSellerPayload,
      buyerAuth,
      ordersDb,
      existingReviewsDb,
      requestTime
    );
    assert.equal(wrongSellerResult.allowed, false);
    assert.equal(wrongSellerResult.reason, 'ORDER_SELLER_MISMATCH');
  });

  it('5. A second review for the same order is rejected (Deterministic Document ID)', () => {
    const duplicatePayload: MockReview = {
      orderId: sampleCompletedOrder.id,
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      rating: 4,
      text: 'Trying to post a second review for the same order!',
      createdAt: requestTime
    };

    // Attempt with correct deterministic ID
    const duplicateResult = evaluateReviewCreateRule(
      `rev_${duplicatePayload.orderId}`,
      duplicatePayload,
      buyerAuth,
      ordersDb,
      existingReviewsDb,
      requestTime
    );
    assert.equal(duplicateResult.allowed, false);
    assert.equal(duplicateResult.reason, 'DOCUMENT_ALREADY_EXISTS_DUPLICATE_ORDER');

    // Attempt with arbitrary ID to bypass duplicate check
    const bypassResult = evaluateReviewCreateRule(
      `rev_arbitrary_random_id_123`,
      duplicatePayload,
      buyerAuth,
      ordersDb,
      existingReviewsDb,
      requestTime
    );
    assert.equal(bypassResult.allowed, false);
    assert.equal(bypassResult.reason, 'NON_DETERMINISTIC_REVIEW_ID');
  });

  it('6. A user cannot forge buyerId, sellerId, or review themselves', () => {
    // Seller attempting to review themselves
    const selfReviewPayload = {
      orderId: sampleSecondCompletedOrder.id,
      buyerId: sellerId,
      sellerId: sellerId,
      rating: 5,
      text: 'I am the best seller ever',
      createdAt: requestTime
    };
    const selfResult = evaluateReviewCreateRule(
      `rev_${selfReviewPayload.orderId}`,
      selfReviewPayload,
      { uid: sellerId },
      ordersDb,
      existingReviewsDb,
      requestTime
    );
    assert.equal(selfResult.allowed, false);
    assert.equal(selfResult.reason, 'INVALID_REVIEW_SHAPE_OR_AUTH_MISMATCH');
  });

  it('7. Invalid ratings and oversized review text are rejected', () => {
    // Rating 0
    const zeroRatingPayload = {
      orderId: sampleCompletedOrder.id,
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      rating: 0,
      text: 'Zero rating',
      createdAt: requestTime
    };
    assert.equal(isValidReviewShape(zeroRatingPayload, buyerAuth), false);

    // Rating 6
    const highRatingPayload = {
      orderId: sampleCompletedOrder.id,
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      rating: 6,
      text: 'Six rating',
      createdAt: requestTime
    };
    assert.equal(isValidReviewShape(highRatingPayload, buyerAuth), false);

    // Rating non-numeric
    const strRatingPayload = {
      orderId: sampleCompletedOrder.id,
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      rating: 'five' as any,
      text: 'String rating',
      createdAt: requestTime
    };
    assert.equal(isValidReviewShape(strRatingPayload, buyerAuth), false);

    // Oversized text (> 2000 chars)
    const oversizedPayload = {
      orderId: sampleCompletedOrder.id,
      buyerId: buyerAuth.uid,
      sellerId: sellerId,
      rating: 5,
      text: 'A'.repeat(2001),
      createdAt: requestTime
    };
    assert.equal(isValidReviewShape(oversizedPayload, buyerAuth), false);
  });

  it('8. Unauthorized review updates or deletions are rejected', () => {
    const existingReview = existingReviewsDb.get(`rev_${sampleCompletedOrder.id}`)!;

    // Non-author attempting to delete
    const deleteAttackerResult = evaluateReviewDeleteRule(
      `rev_${sampleCompletedOrder.id}`,
      existingReview,
      attackerAuth
    );
    assert.equal(deleteAttackerResult.allowed, false);
    assert.equal(deleteAttackerResult.reason, 'NOT_ORIGINAL_AUTHOR');

    // Author deleting own review is allowed
    const deleteAuthorResult = evaluateReviewDeleteRule(
      `rev_${sampleCompletedOrder.id}`,
      existingReview,
      buyerAuth
    );
    assert.equal(deleteAuthorResult.allowed, true);

    // Attacker trying to update review
    const attackerUpdate = {
      ...existingReview,
      rating: 1,
      text: 'Hacked comment'
    };
    const updateAttackerResult = evaluateReviewUpdateRule(
      `rev_${sampleCompletedOrder.id}`,
      attackerUpdate,
      existingReview,
      attackerAuth
    );
    assert.equal(updateAttackerResult.allowed, false);
    assert.equal(updateAttackerResult.reason, 'NOT_ORIGINAL_AUTHOR');

    // Author trying to change immutable orderId or sellerId
    const tamperedUpdate = {
      ...existingReview,
      sellerId: 'tampered_seller_id'
    };
    const tamperedResult = evaluateReviewUpdateRule(
      `rev_${sampleCompletedOrder.id}`,
      tamperedUpdate,
      existingReview,
      buyerAuth
    );
    assert.equal(tamperedResult.allowed, false);
    assert.equal(tamperedResult.reason, 'IMMUTABLE_SELLER_ID');

    // Author updating valid rating and text is allowed
    const validUpdate = {
      ...existingReview,
      rating: 4,
      text: 'Updated feedback after 2 weeks of use'
    };
    const validUpdateResult = evaluateReviewUpdateRule(
      `rev_${sampleCompletedOrder.id}`,
      validUpdate,
      existingReview,
      buyerAuth
    );
    assert.equal(validUpdateResult.allowed, true);
  });
});
