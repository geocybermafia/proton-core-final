import {
  classifyListing,
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
    buyerInstructions: validation.requiresShipping ? '' : (buyerInstructions || '').trim(),
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
