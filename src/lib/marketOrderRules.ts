import {
  classifyListing,
  isProjectAssetOrder,
  isServiceOrder,
  isUniqueDigitalAssetListing,
  normalizeCategoryId,
  resolvePreservedListingStatus,
  ListingClassificationInput
} from './listingClassification';

export type OrderCreationMode =
  | 'service'
  | 'unique_digital_asset'
  | 'product'
  | 'non_purchasable';

export type OrderRejectionCode =
  | 'UNAUTHENTICATED'
  | 'LISTING_NOT_FOUND'
  | 'SELF_PURCHASE'
  | 'NON_PURCHASABLE_LISTING'
  | 'ALREADY_RESERVED'
  | 'ALREADY_SOLD'
  | 'INVALID_PRICE'
  | 'MISSING_SELLER';

export type ListingLockUpdatePayload = {
  status: 'reserved' | 'sold';
  isSold?: boolean;
  activeOrderId: string;
};

export interface OrderValidationSuccess {
  ok: true;
  mode: Exclude<OrderCreationMode, 'non_purchasable'>;
  orderType: 'service' | 'product' | 'project';
  initialOrderStatus: 'booked' | 'pending';
  requiresShipping: boolean;
  requiresAtomicListingLock: boolean;
  buildListingLockUpdate: (orderId: string) => ListingLockUpdatePayload | null;
}

export interface OrderValidationFailure {
  ok: false;
  code: OrderRejectionCode;
  messageEn: string;
  messageKa: string;
}

export type OrderValidationResult = OrderValidationSuccess | OrderValidationFailure;

export interface ListingLike {
  id?: string;
  sellerId?: string;
  price?: number;
  currency?: string;
  status?: string;
  isSold?: boolean;
  activeOrderId?: string | null;
  listingType?: string | null;
  category?: string | null;
}

export function getOrderCreationMode(item?: ListingClassificationInput): OrderCreationMode {
  const classification = classifyListing(item);
  if (classification === 'job' || classification === 'collaboration') {
    return 'non_purchasable';
  }
  if (
    classification === 'project_asset' ||
    normalizeCategoryId(item?.listingType) === 'digital' ||
    normalizeCategoryId(item?.category) === 'digital'
  ) {
    return 'unique_digital_asset';
  }
  if (classification === 'service' || classification === 'project') {
    return 'service';
  }
  return 'product';
}

export function validateListingForOrderCreation(
  listing: ListingLike | null | undefined,
  buyerId: string | null | undefined
): OrderValidationResult {
  if (!buyerId || typeof buyerId !== 'string' || !buyerId.trim()) {
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      messageEn: 'Please sign in to place an order.',
      messageKa: 'გთხოვთ გაიაროთ ავტორიზაცია შეკვეთის გასაფორმებლად.'
    };
  }

  if (!listing) {
    return {
      ok: false,
      code: 'LISTING_NOT_FOUND',
      messageEn: 'This listing no longer exists.',
      messageKa: 'განცხადება ბაზაში ვერ მოიძებნა.'
    };
  }

  if (!listing.sellerId) {
    return {
      ok: false,
      code: 'MISSING_SELLER',
      messageEn: 'Listing is missing seller information.',
      messageKa: 'განცხადებას აკლია გამყიდველის მონაცემები.'
    };
  }

  if (listing.sellerId === buyerId) {
    return {
      ok: false,
      code: 'SELF_PURCHASE',
      messageEn: 'You cannot purchase your own listing.',
      messageKa: 'საკუთარი განცხადების შეძენა დაუშვებელია.'
    };
  }

  const mode = getOrderCreationMode(listing);
  if (mode === 'non_purchasable') {
    return {
      ok: false,
      code: 'NON_PURCHASABLE_LISTING',
      messageEn: 'Job postings and collaboration offers cannot be purchased directly. Contact the author instead.',
      messageKa: 'ვაკანსიები და პარტნიორობის შეთავაზებები პირდაპირ არ იყიდება. დაუკავშირდით ავტორს.'
    };
  }

  const currentStatus = resolvePreservedListingStatus(listing);
  const hasLockingOrder =
    typeof listing.activeOrderId === 'string' && listing.activeOrderId.trim().length > 0;

  if (currentStatus === 'sold') {
    return {
      ok: false,
      code: 'ALREADY_SOLD',
      messageEn: 'This item has already been sold.',
      messageKa: 'ეს განცხადება უკვე გაყიდულია.'
    };
  }

  if (currentStatus === 'reserved' || (mode !== 'service' && hasLockingOrder)) {
    return {
      ok: false,
      code: 'ALREADY_RESERVED',
      messageEn: 'This listing is already reserved by another active order.',
      messageKa: 'ეს განცხადება უკვე დაჯავშნილია სხვა აქტიური შეკვეთით.'
    };
  }

  const numericPrice = typeof listing.price === 'number' ? listing.price : Number(listing.price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return {
      ok: false,
      code: 'INVALID_PRICE',
      messageEn: 'Listing does not have a valid positive price.',
      messageKa: 'განცხადებას არ აქვს მითითებული ვალიდური ფასი.'
    };
  }

  if (mode === 'service') {
    return {
      ok: true,
      mode: 'service',
      orderType: 'service',
      initialOrderStatus: 'booked',
      requiresShipping: false,
      requiresAtomicListingLock: false,
      buildListingLockUpdate: () => null
    };
  }

  if (mode === 'unique_digital_asset') {
    // Only send ['status', 'activeOrderId'] so listings lacking an `isSold` field
    // satisfy firestore.rules `affectedKeys().hasOnly(['status', 'activeOrderId'])`.
    return {
      ok: true,
      mode: 'unique_digital_asset',
      orderType: 'project',
      initialOrderStatus: 'pending',
      requiresShipping: false,
      requiresAtomicListingLock: true,
      buildListingLockUpdate: (orderId: string) => ({
        status: 'reserved',
        activeOrderId: orderId
      })
    };
  }

  return {
    ok: true,
    mode: 'product',
    orderType: 'product',
    initialOrderStatus: 'pending',
    requiresShipping: true,
    requiresAtomicListingLock: true,
    buildListingLockUpdate: (orderId: string) => ({
      status: 'sold',
      isSold: true,
      activeOrderId: orderId
    })
  };
}

export interface BuildVerifiedOrderPayloadInput {
  listingId: string;
  freshListing: ListingLike & Record<string, any>;
  buyerId: string;
  itemTitle: string;
  validation: OrderValidationSuccess;
  buyerInstructions?: string;
  shippingDetails?: {
    recipientName?: string;
    phone?: string;
    city?: string;
    address?: string;
    notes?: string;
  } | null;
  fallbackBuyerName?: string | null;
  createdAt: unknown;
}

/**
 * Canonical order creation payload builder shared by single-item and cart checkout.
 */
export function buildVerifiedOrderPayload({
  listingId,
  freshListing,
  buyerId,
  itemTitle,
  validation,
  buyerInstructions,
  shippingDetails,
  fallbackBuyerName,
  createdAt
}: BuildVerifiedOrderPayloadInput): Record<string, any> {
  const orderData: Record<string, any> = {
    listingId,
    buyerId,
    sellerId: freshListing.sellerId,
    amount: freshListing.price,
    currency: freshListing.currency || 'USD',
    itemTitle,
    status: validation.initialOrderStatus,
    orderType: validation.orderType,
    buyerInstructions: validation.requiresShipping && shippingDetails ? '' : (buyerInstructions || '').trim(),
    createdAt
  };

  if (validation.requiresShipping && shippingDetails) {
    orderData.shippingDetails = {
      recipientName: (shippingDetails.recipientName || fallbackBuyerName || 'Customer').trim(),
      phone: (shippingDetails.phone || '').trim(),
      city: (shippingDetails.city || '').trim(),
      address: (shippingDetails.address || '').trim(),
      notes: (shippingDetails.notes || '').trim()
    };
  }

  return orderData;
}

/**
 * Determines whether cancelling `orderId` should unlock `listing` back to `active`.
 * Strictly requires provenance match (`listing.activeOrderId === orderId`) so
 * unrelated, completed, or superseded orders can NEVER unlock an asset.
 */
export function shouldUnlockListingOnOrderCancel(
  listing: {
    status?: string | null;
    isSold?: boolean | null;
    sellerId?: string | null;
    activeOrderId?: string | null;
    listingType?: string | null;
    category?: string | null;
  } | null | undefined,
  orderId: string,
  expectedSellerId?: string,
  orderType?: string | null
): boolean {
  if (!listing || !orderId) return false;
  if (expectedSellerId && listing.sellerId !== expectedSellerId) return false;

  const status = resolvePreservedListingStatus(listing);
  if (status !== 'reserved' && status !== 'sold') return false;

  if (typeof listing.activeOrderId !== 'string' || listing.activeOrderId.trim() !== orderId) {
    return false;
  }

  const isDigitalAsset =
    orderType === 'project' || isUniqueDigitalAssetListing(listing as ListingClassificationInput);
  if (isDigitalAsset && status === 'sold') {
    return false;
  }

  return true;
}

/**
 * Determines whether completing `orderId` should finalize a `reserved` listing to `sold`.
 */
export function shouldFinalizeListingSoldOnOrderComplete(
  listing: {
    status?: string | null;
    sellerId?: string | null;
    activeOrderId?: string | null;
  } | null | undefined,
  orderId: string,
  expectedSellerId?: string
): boolean {
  if (!listing || !orderId) return false;
  if (expectedSellerId && listing.sellerId !== expectedSellerId) return false;
  const status = typeof listing.status === 'string' ? listing.status.trim().toLowerCase() : '';
  return status === 'reserved' && listing.activeOrderId === orderId;
}

export function buildListingSoldFinalizationUpdate(orderId: string) {
  return {
    status: 'sold' as const,
    isSold: true,
    activeOrderId: orderId
  };
}

export class MarketOrderRuleError extends Error {
  public readonly code: string;
  public readonly messageEn: string;
  public readonly messageKa: string;

  constructor(code: string, messageEn: string, messageKa: string) {
    super(messageEn);
    this.name = 'MarketOrderRuleError';
    this.code = code;
    this.messageEn = messageEn;
    this.messageKa = messageKa;
  }
}

export function isCompletableDigitalAssetOrderStatus(status?: string | null): boolean {
  return status === 'pending' || status === 'booked';
}

/**
 * Validates order status transitions strictly against business rules and Firestore rules.
 * - Digital Asset (`project`): Seller `pending | booked -> completed | cancelled | refunded`, Buyer `pending | booked -> cancelled`
 * - Service (`service`): Seller `booked -> in_progress | cancelled | refunded`, `in_progress -> completed`; Buyer `booked -> cancelled`
 * - Physical (`product`): Seller `pending -> processing | cancelled | refunded`, `processing -> shipped`; Buyer `pending -> cancelled`, `shipped -> completed`
 */
export function isValidOrderStatusTransition(
  currentStatus: string,
  newStatus: string,
  isSeller: boolean,
  isBuyer: boolean,
  orderType?: string | null
): boolean {
  if (!currentStatus || !newStatus || currentStatus === newStatus) return false;
  const normalizedType = typeof orderType === 'string' ? orderType.trim().toLowerCase() : '';

  if (normalizedType === 'project') {
    if (isSeller) {
      return (
        isCompletableDigitalAssetOrderStatus(currentStatus) &&
        (newStatus === 'completed' || newStatus === 'cancelled' || newStatus === 'refunded')
      );
    }
    if (isBuyer) {
      return isCompletableDigitalAssetOrderStatus(currentStatus) && newStatus === 'cancelled';
    }
    return false;
  }

  if (normalizedType === 'service') {
    if (isSeller) {
      if (currentStatus === 'booked' && (newStatus === 'in_progress' || newStatus === 'cancelled' || newStatus === 'refunded')) {
        return true;
      }
      if (currentStatus === 'in_progress' && newStatus === 'completed') {
        return true;
      }
    }
    if (isBuyer) {
      if (currentStatus === 'booked' && newStatus === 'cancelled') {
        return true;
      }
    }
    return false;
  }

  if (isSeller) {
    if (currentStatus === 'pending' && (newStatus === 'processing' || newStatus === 'cancelled' || newStatus === 'refunded')) {
      return true;
    }
    if (currentStatus === 'processing' && newStatus === 'shipped') {
      return true;
    }
    if (!normalizedType) {
      if (currentStatus === 'booked' && (newStatus === 'in_progress' || newStatus === 'cancelled' || newStatus === 'refunded')) {
        return true;
      }
      if (currentStatus === 'in_progress' && newStatus === 'completed') {
        return true;
      }
    }
  }

  if (isBuyer) {
    if (currentStatus === 'shipped' && newStatus === 'completed') {
      return true;
    }
    if ((currentStatus === 'pending' || (!normalizedType && currentStatus === 'booked')) && newStatus === 'cancelled') {
      return true;
    }
  }

  return false;
}

export interface DocumentSnapshotLike {
  exists: (() => boolean) | boolean;
  data: () => any;
}

const snapExists = (snap: DocumentSnapshotLike | null | undefined): boolean => {
  if (!snap) return false;
  return typeof snap.exists === 'function' ? snap.exists() : Boolean(snap.exists);
};

export interface OrderTransactionLike {
  get: (ref: any) => Promise<DocumentSnapshotLike>;
  set: (ref: any, data: Record<string, any>) => any;
  update: (ref: any, patch: Record<string, any>) => any;
}

export interface PlaceVerifiedOrderTxParams {
  tx: OrderTransactionLike;
  listingRef: any;
  newOrderRef: any;
  orderId: string;
  listingId: string;
  buyerId: string | null | undefined;
  fallbackTitle?: string;
  buyerInstructions?: string;
  shippingDetails?: BuildVerifiedOrderPayloadInput['shippingDetails'];
  fallbackBuyerName?: string | null;
  createdAt: unknown;
}

export async function placeVerifiedOrderInTransaction({
  tx,
  listingRef,
  newOrderRef,
  orderId,
  listingId,
  buyerId,
  fallbackTitle,
  buyerInstructions,
  shippingDetails,
  fallbackBuyerName,
  createdAt
}: PlaceVerifiedOrderTxParams) {
  const listingSnap = await tx.get(listingRef);
  if (!snapExists(listingSnap)) {
    throw new MarketOrderRuleError(
      'LISTING_NOT_FOUND',
      'This listing no longer exists.',
      'განცხადება ბაზაში ვერ მოიძებნა.'
    );
  }

  const freshListing: ListingLike & Record<string, any> = {
    ...(listingSnap.data() as Record<string, any>),
    id: listingId
  };

  const validation = validateListingForOrderCreation(freshListing, buyerId);
  if (!validation.ok) {
    throw new MarketOrderRuleError(validation.code, validation.messageEn, validation.messageKa);
  }

  const verifiedOrderData = buildVerifiedOrderPayload({
    listingId,
    freshListing,
    buyerId: buyerId as string,
    itemTitle: freshListing.title || fallbackTitle || 'Marketplace Item',
    validation,
    buyerInstructions,
    shippingDetails,
    fallbackBuyerName,
    createdAt
  });

  tx.set(newOrderRef, verifiedOrderData);

  const lockUpdate = validation.buildListingLockUpdate(orderId);
  if (lockUpdate) {
    tx.update(listingRef, lockUpdate);
  }

  return {
    orderId,
    orderData: verifiedOrderData,
    validation,
    lockUpdate,
    freshListing
  };
}

export interface CompleteDigitalAssetTxLike {
  get: (ref: any) => Promise<DocumentSnapshotLike>;
  update: (ref: any, patch: Record<string, any>) => any;
}

export interface CompleteDigitalAssetOrderTxParams {
  tx: CompleteDigitalAssetTxLike;
  orderRef: any;
  getListingRef: (listingId: string) => any;
  orderId: string;
  callerUid: string | null | undefined;
}

export async function completeDigitalAssetOrderInTransaction({
  tx,
  orderRef,
  getListingRef,
  orderId,
  callerUid
}: CompleteDigitalAssetOrderTxParams): Promise<{ listingId: string; soldUpdate: ListingLockUpdatePayload }> {
  if (!callerUid || typeof callerUid !== 'string' || !callerUid.trim()) {
    throw new MarketOrderRuleError(
      'UNAUTHENTICATED',
      'Authentication required to complete this order.',
      'შეკვეთის დასასრულებლად საჭიროა ავტორიზაცია.'
    );
  }

  const orderSnap = await tx.get(orderRef);
  if (!snapExists(orderSnap)) {
    throw new MarketOrderRuleError(
      'ORDER_NOT_FOUND',
      'Order not found.',
      'შეკვეთა ვერ მოიძებნა.'
    );
  }

  const freshOrder = orderSnap.data() as Record<string, any>;
  if (freshOrder.sellerId !== callerUid) {
    throw new MarketOrderRuleError(
      'UNAUTHORIZED_SELLER',
      'Only the seller can complete this order.',
      'შეკვეთის დასრულება შეუძლია მხოლოდ გამყიდველს.'
    );
  }

  if (freshOrder.orderType !== 'project') {
    throw new MarketOrderRuleError(
      'INVALID_ORDER_TYPE',
      'Order type mismatch for digital asset completion.',
      'შეკვეთის ტიპი არ შეესაბამება ციფრულ აქტივს.'
    );
  }

  if (freshOrder.status === 'completed') {
    throw new MarketOrderRuleError(
      'ALREADY_COMPLETED',
      'Order is already completed.',
      'შეკვეთა უკვე დასრულებულია.'
    );
  }

  if (!isCompletableDigitalAssetOrderStatus(freshOrder.status)) {
    throw new MarketOrderRuleError(
      'INVALID_STATUS_TRANSITION',
      `Cannot complete digital asset order from status '${freshOrder.status}'.`,
      `ციფრული აქტივის შეკვეთის დასრულება შეუძლებელია მიმდინარე სტატუსში (${freshOrder.status}).`
    );
  }

  const listingId = typeof freshOrder.listingId === 'string' ? freshOrder.listingId.trim() : '';
  if (!listingId) {
    throw new MarketOrderRuleError(
      'LISTING_NOT_FOUND',
      'Order is missing linked listing identifier.',
      'შეკვეთას აკლია დაკავშირებული განცხადების იდენტიფიკატორი.'
    );
  }

  const listingRef = getListingRef(listingId);
  const listingSnap = await tx.get(listingRef);
  if (!snapExists(listingSnap)) {
    throw new MarketOrderRuleError(
      'LISTING_NOT_FOUND',
      'Linked digital asset listing no longer exists.',
      'დაკავშირებული ციფრული აქტივი ბაზაში ვერ მოიძებნა.'
    );
  }

  const freshListing = listingSnap.data() as Record<string, any>;
  if (freshListing.sellerId !== callerUid) {
    throw new MarketOrderRuleError(
      'LISTING_SELLER_MISMATCH',
      'Listing seller does not match the caller.',
      'განცხადების გამყიდველი არ ემთხვევა ავტორიზებულ მომხმარებელს.'
    );
  }

  const listingStatus = typeof freshListing.status === 'string' ? freshListing.status.trim().toLowerCase() : '';
  if (listingStatus !== 'reserved') {
    throw new MarketOrderRuleError(
      'LISTING_NOT_RESERVED',
      `Listing must be reserved before completing this order (current: '${freshListing.status || 'unknown'}').`,
      `შეკვეთის დასრულებამდე აქტივი უნდა იყოს დაჯავშნილი (მიმდინარე: ${freshListing.status || 'unknown'}).`
    );
  }

  if (freshListing.activeOrderId !== orderId) {
    throw new MarketOrderRuleError(
      'ACTIVE_ORDER_MISMATCH',
      'Listing is reserved by a different active order.',
      'აქტივი დაჯავშნილია სხვა აქტიური შეკვეთით.'
    );
  }

  const soldUpdate = buildListingSoldFinalizationUpdate(orderId);
  tx.update(orderRef, { status: 'completed' });
  tx.update(listingRef, soldUpdate);

  return {
    listingId,
    soldUpdate
  };
}

export type OrganizerOrderToggleAction =
  | { kind: 'standard_task'; targetOrderStatus: null }
  | { kind: 'blocked_project_asset'; targetOrderStatus: null }
  | { kind: 'reopen_task'; targetOrderStatus: null }
  | { kind: 'no_order_transition'; targetOrderStatus: null }
  | { kind: 'advance_order'; orderCategory: 'service' | 'product'; targetOrderStatus: 'in_progress' | 'completed' | 'processing' | 'shipped' };

/**
 * Determines whether an incoming seller order should auto-generate an Organizer fulfillment task.
 * Unique digital assets (`orderType === 'project'`) are managed exclusively via Market Hub / Seller Cabinet
 * and MUST NOT auto-generate Organizer fulfillment tasks.
 */
export function shouldGenerateOrganizerFulfillmentTask(
  order?: { orderType?: string | null; status?: string | null } | null
): boolean {
  if (!order || isProjectAssetOrder(order)) return false;
  if (isServiceOrder(order)) {
    return order.status === 'booked';
  }
  return order.status === 'pending' || (!order.orderType && order.status === 'booked');
}

export function extractLinkedOrderIdFromTask(
  task?: { id?: string; orderId?: string; metadata?: { orderId?: string } } | null
): string {
  if (!task) return '';
  if (typeof task.orderId === 'string' && task.orderId.trim().length > 0) {
    return task.orderId.trim();
  }
  if (typeof task.metadata?.orderId === 'string' && task.metadata.orderId.trim().length > 0) {
    return task.metadata.orderId.trim();
  }
  if (typeof task.id === 'string' && task.id.startsWith('order-task-')) {
    return task.id.slice('order-task-'.length).trim();
  }
  return '';
}

/**
 * Identifies legacy or active Organizer tasks linked to a digital asset (`project`) order
 * so they can be hidden from Organizer views.
 */
export function isProjectAssetLinkedTask(
  task?: { id?: string; orderId?: string; metadata?: { orderId?: string } } | null,
  orders?: Array<{ id: string; orderType?: string | null }> | null
): boolean {
  if (!task || !orders || orders.length === 0) return false;
  const orderId = extractLinkedOrderIdFromTask(task);
  if (!orderId) return false;
  const linkedOrder = orders.find(o => o.id === orderId);
  return Boolean(linkedOrder && isProjectAssetOrder(linkedOrder));
}

/**
 * Resolves the safe Organizer task toggle action for an order-linked task.
 * - `project` orders are strictly blocked from Organizer status transitions.
 * - `service` orders follow `booked -> in_progress -> completed`.
 * - `product` orders follow `pending -> processing -> shipped`.
 */
export function resolveOrganizerOrderToggleAction(
  linkedOrder: { orderType?: string | null; status?: string | null } | null | undefined,
  nextCompleted: boolean
): OrganizerOrderToggleAction {
  if (!linkedOrder) {
    return { kind: 'standard_task', targetOrderStatus: null };
  }

  if (isProjectAssetOrder(linkedOrder)) {
    return { kind: 'blocked_project_asset', targetOrderStatus: null };
  }

  if (!nextCompleted) {
    return { kind: 'reopen_task', targetOrderStatus: null };
  }

  const isService =
    isServiceOrder(linkedOrder) ||
    (!linkedOrder.orderType && (linkedOrder.status === 'booked' || linkedOrder.status === 'in_progress'));

  if (isService) {
    if (linkedOrder.status === 'booked') {
      return { kind: 'advance_order', orderCategory: 'service', targetOrderStatus: 'in_progress' };
    }
    if (linkedOrder.status === 'in_progress') {
      return { kind: 'advance_order', orderCategory: 'service', targetOrderStatus: 'completed' };
    }
    return { kind: 'no_order_transition', targetOrderStatus: null };
  }

  if (linkedOrder.status === 'pending') {
    return { kind: 'advance_order', orderCategory: 'product', targetOrderStatus: 'processing' };
  }
  if (linkedOrder.status === 'processing') {
    return { kind: 'advance_order', orderCategory: 'product', targetOrderStatus: 'shipped' };
  }

  return { kind: 'no_order_transition', targetOrderStatus: null };
}


