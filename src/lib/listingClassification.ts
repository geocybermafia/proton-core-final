import { ListingClassification, ListingType } from '../types';

export type { ListingClassification, ListingType };

export const PRODUCT_CATEGORY_IDS = [
  'newyear',
  'phones',
  'technics',
  'family-technic',
  'garden',
  'furniture',
  'hunting',
  'music',
  'kids',
  'fashion',
  'building',
  'village',
  'animals',
  'sport',
  'business',
  'book',
  'art',
] as const;

export const SERVICE_CATEGORY_IDS = [
  'service',
  'rent',
  'audience-growth',
] as const;

export const PROJECT_ASSET_CATEGORY_IDS = [
  'social-accounts',
  'youtube-channels',
  'digital-projects',
] as const;

export const JOB_CATEGORY_IDS = [
  'project-jobs',
] as const;

export const COLLABORATION_CATEGORY_IDS = [
  'collaboration',
] as const;

export const PROJECT_CATEGORY_IDS = [
  'project-jobs',
  'social-accounts',
  'youtube-channels',
  'collaboration',
  'digital-projects',
] as const;

export const ALL_ACTIVE_CATEGORY_IDS = [
  ...PRODUCT_CATEGORY_IDS,
  ...SERVICE_CATEGORY_IDS,
  ...PROJECT_CATEGORY_IDS,
] as const;

export const CATEGORY_IDS_BY_TYPE: Record<ListingType, readonly string[]> = {
  product: PRODUCT_CATEGORY_IDS,
  service: SERVICE_CATEGORY_IDS,
  project: PROJECT_CATEGORY_IDS,
};

const PRODUCT_CATEGORY_SET = new Set<string>(PRODUCT_CATEGORY_IDS);
const SERVICE_CATEGORY_SET = new Set<string>(SERVICE_CATEGORY_IDS);
const PROJECT_ASSET_CATEGORY_SET = new Set<string>(PROJECT_ASSET_CATEGORY_IDS);
const JOB_CATEGORY_SET = new Set<string>(JOB_CATEGORY_IDS);
const COLLABORATION_CATEGORY_SET = new Set<string>(COLLABORATION_CATEGORY_IDS);
const PROJECT_CATEGORY_SET = new Set<string>(PROJECT_CATEGORY_IDS);

export const getDefaultCategoryForType = (type: ListingType): string => {
  if (type === 'service') return 'service';
  if (type === 'project') return 'project-jobs';
  return 'technics';
};

export type ListingClassificationInput = {
  listingType?: string | null;
  category?: string | null;
} | null | undefined;

export const normalizeCategoryId = (category?: string | null): string =>
  typeof category === 'string' ? category.trim().toLowerCase() : '';

export const normalizeExplicitListingType = (listingType?: string | null): ListingType | null => {
  if (typeof listingType !== 'string') return null;
  const normalized = listingType.trim().toLowerCase();
  if (normalized === 'product' || normalized === 'service' || normalized === 'project') {
    return normalized;
  }
  return null;
};

/**
 * Canonical single source of truth for classifying PROTON listings.
 * Pure, runtime-agnostic module (zero Firebase, React, or browser dependencies).
 * - Audience Growth is always classified as 'service' (even on legacy listingType='project' records).
 * - Rent ('rent') remains classified as 'service'.
 * - Project Assets ('youtube-channels', 'social-accounts', 'digital-projects') are classified as
 *   'project_asset' and are never classified as 'service'.
 * - Explicit listingType is respected for legacy/ambiguous categories without inventing new mappings.
 */
export const classifyListing = (item?: ListingClassificationInput): ListingClassification | null => {
  if (!item) return null;

  const cat = normalizeCategoryId(item.category);
  const explicit = normalizeExplicitListingType(item.listingType);

  if (SERVICE_CATEGORY_SET.has(cat) || cat === 'services') {
    return 'service';
  }
  if (PROJECT_ASSET_CATEGORY_SET.has(cat)) {
    return 'project_asset';
  }
  if (JOB_CATEGORY_SET.has(cat)) {
    return 'job';
  }
  if (COLLABORATION_CATEGORY_SET.has(cat)) {
    return 'collaboration';
  }

  if (explicit === 'service') return 'service';
  if (explicit === 'project') return 'project';
  if (explicit === 'product') return 'product';

  if (cat === 'project' || PROJECT_CATEGORY_SET.has(cat)) return 'project';

  return 'product';
};

export const isCategoryValidForType = (
  categoryId: string | undefined | null,
  listingType: 'all' | ListingType
): boolean => {
  if (!categoryId || categoryId === 'all') return true;
  const normalized = normalizeCategoryId(categoryId);
  if (listingType === 'all') {
    return (
      PRODUCT_CATEGORY_SET.has(normalized) ||
      SERVICE_CATEGORY_SET.has(normalized) ||
      PROJECT_CATEGORY_SET.has(normalized)
    );
  }
  return CATEGORY_IDS_BY_TYPE[listingType].includes(normalized);
};

export const inferListingType = (
  category?: string | null,
  explicitListingType?: string | null
): ListingType => {
  const classification = classifyListing({ category, listingType: explicitListingType });
  if (classification === 'service') return 'service';
  if (
    classification === 'project_asset' ||
    classification === 'job' ||
    classification === 'collaboration' ||
    classification === 'project'
  ) {
    return 'project';
  }
  return 'product';
};

export const isServiceListing = (item?: ListingClassificationInput): boolean =>
  classifyListing(item) === 'service';

export const isProjectAssetListing = (item?: ListingClassificationInput): boolean =>
  classifyListing(item) === 'project_asset';

export const isUniqueDigitalAssetListing = (item?: ListingClassificationInput): boolean => {
  const classification = classifyListing(item);
  return (
    classification === 'project_asset' ||
    normalizeCategoryId(item?.listingType) === 'digital' ||
    normalizeCategoryId(item?.category) === 'digital'
  );
};

export const isJobListing = (item?: ListingClassificationInput): boolean =>
  classifyListing(item) === 'job';

export const isCollaborationListing = (item?: ListingClassificationInput): boolean =>
  classifyListing(item) === 'collaboration';

export const isNonPurchasableListing = (item?: ListingClassificationInput): boolean => {
  const classification = classifyListing(item);
  return classification === 'job' || classification === 'collaboration';
};

export const isRepeatableServiceListing = (item?: ListingClassificationInput): boolean => {
  if (!item || isNonPurchasableListing(item) || isUniqueDigitalAssetListing(item)) return false;
  const classification = classifyListing(item);
  return classification === 'service' || classification === 'project';
};

export const isExclusiveAssetOrProductListing = (item?: ListingClassificationInput): boolean =>
  Boolean(item) && !isRepeatableServiceListing(item) && !isNonPurchasableListing(item);

export const isProjectListing = (item?: ListingClassificationInput): boolean => {
  const classification = classifyListing(item);
  return (
    classification === 'project_asset' ||
    classification === 'job' ||
    classification === 'collaboration' ||
    classification === 'project'
  );
};

export const isProductListing = (item?: ListingClassificationInput): boolean =>
  classifyListing(item) === 'product';

export const isPhysicalListing = (item?: ListingClassificationInput): boolean =>
  isProductListing(item);

export const resolvePreservedListingStatus = (
  existingListing?: { status?: string | null; isSold?: boolean | null } | null
): 'active' | 'reserved' | 'sold' | 'deleted' => {
  if (!existingListing) return 'active';
  const normalizedStatus = typeof existingListing.status === 'string'
    ? existingListing.status.trim().toLowerCase()
    : '';
  if (normalizedStatus === 'reserved') return 'reserved';
  if (normalizedStatus === 'sold' || existingListing.isSold === true) return 'sold';
  return 'active';
};

export const isListingReserved = (
  listing?: { status?: string | null; isSold?: boolean | null } | null
): boolean => resolvePreservedListingStatus(listing) === 'reserved';

export const isListingSold = (
  listing?: { status?: string | null; isSold?: boolean | null } | null
): boolean => resolvePreservedListingStatus(listing) === 'sold';

export const isListingUnavailableForPurchase = (
  listing?: { status?: string | null; isSold?: boolean | null; activeOrderId?: string | null; listingType?: string | null; category?: string | null } | null
): boolean => {
  if (!listing) return true;
  const status = resolvePreservedListingStatus(listing);
  if (status === 'reserved' || status === 'sold') return true;
  return (
    typeof listing.activeOrderId === 'string' &&
    listing.activeOrderId.trim().length > 0 &&
    !isRepeatableServiceListing(listing)
  );
};

export const isPhysicalOrder = (order: any): boolean => {
  if (!order) return false;
  return order.orderType === 'product' && Boolean(order.shippingDetails);
};

export const isProjectAssetOrder = (order: any): boolean => {
  if (!order) return false;
  return order.orderType === 'project';
};

export const isServiceOrder = (order: any): boolean => {
  if (!order) return false;
  return order.orderType === 'service';
};

export const isSellerActionRequired = (order: any): boolean => {
  if (!order) return false;
  if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'refunded') {
    return false;
  }
  const isPhysical = isPhysicalOrder(order);
  const isProjectAsset = isProjectAssetOrder(order);
  const isService = isServiceOrder(order);

  if (isPhysical) {
    return order.status === 'pending' || order.status === 'processing';
  }
  if (isProjectAsset) {
    return order.status === 'pending' || order.status === 'booked';
  }
  if (isService) {
    return order.status === 'booked' || order.status === 'in_progress';
  }

  return order.status === 'pending' || order.status === 'processing' || order.status === 'booked' || order.status === 'in_progress';
};

export const canCancelOrder = (order: any): boolean => {
  if (!order || !order.status) return false;
  if (['cancelled', 'completed', 'shipped', 'processing', 'in_progress', 'refunded'].includes(order.status)) {
    return false;
  }
  return order.status === 'pending' || order.status === 'booked';
};

