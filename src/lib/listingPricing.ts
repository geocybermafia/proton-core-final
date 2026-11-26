import { normalizeCategoryId } from './listingClassification.js';

export const OPTIONAL_PRICE_CATEGORIES = new Set(['project-jobs', 'collaboration']);

export type PriceValidationFailureReason =
  | 'required'
  | 'must_be_positive'
  | 'negative'
  | 'invalid_format';

export type PriceValidationResult =
  | {
      valid: true;
      price: number;
      priceUnspecified: boolean;
    }
  | {
      valid: false;
      reason: PriceValidationFailureReason;
    };

export interface ValidateListingPriceInput {
  rawPrice: unknown;
  category?: string | null;
  isNegotiable?: boolean | null;
}

/**
 * Returns true if a listing in the given category / negotiability mode
 * is legally permitted to have an empty or zero (0) price.
 */
export function isZeroOrEmptyPriceAllowed(params: {
  category?: string | null;
  isNegotiable?: boolean | null;
}): boolean {
  const normalizedCategory = normalizeCategoryId(params.category);
  if (OPTIONAL_PRICE_CATEGORIES.has(normalizedCategory)) {
    return true;
  }
  return Boolean(params.isNegotiable);
}

const STRICT_DECIMAL_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/**
 * Unified client + server price validator and normalizer.
 *
 * Rules:
 * - Numeric `price` in Firestore is always a finite number >= 0 (never empty string / NaN / null).
 * - When price is left empty ("", null, undefined) on an eligible listing (`project-jobs`,
 *   `collaboration`, or `isNegotiable: true`), normalizes to `{ price: 0, priceUnspecified: true }`.
 * - When price is explicitly `0` on an eligible listing, normalizes to `{ price: 0, priceUnspecified: false }`.
 * - Standard fixed-price listings strictly require `price > 0`.
 * - Negative numbers and non-numeric strings (e.g. "abc", "12abc") are always rejected.
 */
export function validateAndNormalizeListingPrice(
  input: ValidateListingPriceInput
): PriceValidationResult {
  const { rawPrice, category, isNegotiable } = input;
  const allowZeroOrEmpty = isZeroOrEmptyPriceAllowed({ category, isNegotiable });

  if (typeof rawPrice === 'boolean' || (typeof rawPrice === 'object' && rawPrice !== null)) {
    return { valid: false, reason: 'invalid_format' };
  }

  const isEmpty =
    rawPrice === undefined ||
    rawPrice === null ||
    (typeof rawPrice === 'string' && rawPrice.trim() === '');

  if (isEmpty) {
    if (allowZeroOrEmpty) {
      return { valid: true, price: 0, priceUnspecified: true };
    }
    return { valid: false, reason: 'required' };
  }

  let parsed: number;
  if (typeof rawPrice === 'number') {
    parsed = rawPrice;
  } else if (typeof rawPrice === 'string') {
    const normalizedStr = rawPrice.trim().replace(',', '.');
    if (!STRICT_DECIMAL_PATTERN.test(normalizedStr)) {
      return { valid: false, reason: 'invalid_format' };
    }
    parsed = Number(normalizedStr);
  } else {
    return { valid: false, reason: 'invalid_format' };
  }

  if (!Number.isFinite(parsed)) {
    return { valid: false, reason: 'invalid_format' };
  }

  if (parsed < 0) {
    return { valid: false, reason: 'negative' };
  }

  if (parsed === 0) {
    if (allowZeroOrEmpty) {
      return { valid: true, price: 0, priceUnspecified: false };
    }
    return { valid: false, reason: 'must_be_positive' };
  }

  return { valid: true, price: parsed, priceUnspecified: false };
}

export function getListingPriceValidationMessage(
  reason: PriceValidationFailureReason,
  language: 'en' | 'ka' | string = 'en'
): string {
  const isKa = language === 'ka';
  switch (reason) {
    case 'negative':
      return isKa
        ? 'ფასი არ შეიძლება იყოს უარყოფითი.'
        : 'Price cannot be negative.';
    case 'invalid_format':
      return isKa
        ? 'გთხოვთ შეიყვანოთ სწორი რიცხვითი ფასი.'
        : 'Please enter a valid numeric price.';
    case 'must_be_positive':
      return isKa
        ? 'ჩვეულებრივი განცხადებისთვის მიუთითეთ დადებითი ფასი (> 0) ან ჩართეთ „ფასი შეთანხმებით“.'
        : 'Please enter a positive price (> 0) or enable Negotiable Price.';
    case 'required':
    default:
      return isKa
        ? 'გთხოვთ მიუთითოთ ფასი ან ჩართოთ „ფასი შეთანხმებით“.'
        : 'Please enter a price or enable Negotiable Price.';
  }
}

export type ListingPriceDisplayMode = 'amount' | 'free' | 'negotiable' | 'unspecified';

/**
 * Resolves how a listing's price should be presented in cards, details modals, and wizard previews
 * without confusing explicit `0` (Free) vs empty/unspecified price vs negotiable price.
 */
export function getListingPriceDisplayMode(listing: {
  price?: unknown;
  priceUnspecified?: boolean;
  isNegotiable?: boolean;
}): ListingPriceDisplayMode {
  const numeric = typeof listing.price === 'number' ? listing.price : Number(listing.price);
  if (Number.isFinite(numeric) && numeric > 0) {
    return 'amount';
  }
  if (listing.isNegotiable) {
    return 'negotiable';
  }
  if (listing.priceUnspecified) {
    return 'unspecified';
  }
  return 'free';
}
