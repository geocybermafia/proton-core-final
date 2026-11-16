import {
  classifyListing,
  normalizeCategoryId,
  resolvePreservedListingStatus,
  ListingClassificationInput
} from '../components/market-hub/MarketConstants';

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

export interface OrderValidationSuccess {
  ok: true;
  mode: Exclude<OrderCreationMode, 'non_purchasable'>;
  orderType: 'service' | 'product' | 'project';
  initialOrderStatus: 'booked' | 'pending';
  requiresShipping: boolean;
  requiresAtomicListingLock: boolean;
  buildListingLockUpdate: (orderId: string) => {
    status: 'reserved' | 'sold';
    isSold: boolean;
    activeOrderId: string;
  } | null;
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
    return {
      ok: true,
      mode: 'unique_digital_asset',
      orderType: 'project',
      initialOrderStatus: 'pending',
      requiresShipping: false,
      requiresAtomicListingLock: true,
      buildListingLockUpdate: (orderId: string) => ({
        status: 'reserved',
        isSold: false,
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

/**
 * Determines whether cancelling `orderId` should unlock `listing` back to `active`.
 * Strictly requires provenance match when `activeOrderId` is present so unrelated
 * or superseded orders can NEVER unlock an active reservation or sold asset.
 */
export function shouldUnlockListingOnOrderCancel(
  listing: {
    status?: string | null;
    isSold?: boolean | null;
    sellerId?: string | null;
    activeOrderId?: string | null;
  } | null | undefined,
  orderId: string,
  expectedSellerId?: string
): boolean {
  if (!listing || !orderId) return false;
  if (expectedSellerId && listing.sellerId !== expectedSellerId) return false;

  const status = resolvePreservedListingStatus(listing);
  if (status !== 'reserved' && status !== 'sold') return false;

  if (typeof listing.activeOrderId === 'string' && listing.activeOrderId.trim().length > 0) {
    return listing.activeOrderId === orderId;
  }

  // Only allow legacy sold items (never 'reserved') to fall back if seller matches and no activeOrderId was stored.
  return status === 'sold' && Boolean(expectedSellerId && listing.sellerId === expectedSellerId);
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
