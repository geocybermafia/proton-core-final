import type { Listing, ListingType } from '../types.js';

export interface CreateListingApiPayload {
  id?: string;
  title: string;
  titleGe?: string;
  titleEn?: string;
  primaryLanguage?: 'ka' | 'en';
  description: string;
  descriptionGe?: string;
  price?: number | null;
  priceUnspecified?: boolean;
  currency?: string;
  sellerName?: string;
  category?: string;
  listingType?: ListingType;
  condition?: string;
  isNegotiable?: boolean;
  isRemote?: boolean;
  location?: string;
  country?: string;
  city?: string;
  lat?: number | null;
  lng?: number | null;
  attributes?: Record<string, string | number | boolean>;
  serviceDuration?: string;
  serviceTerms?: string;
  tags?: string[];
  image?: string;
  images?: string[];
  status?: string;
}

const VALID_LISTING_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export class MarketListingApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly serverError?: string;

  constructor(status: number, message: string, code?: string, serverError?: string) {
    super(message);
    this.name = 'MarketListingApiError';
    this.status = status;
    this.code = code;
    this.serverError = serverError;
  }
}

export function generateClientListingId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `lst-${crypto.randomUUID()}`;
  }
  return `lst-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function isValidClientListingId(id: unknown): id is string {
  return typeof id === 'string' && VALID_LISTING_ID_REGEX.test(id.trim());
}

/**
 * Builds the exact JSON payload expected by POST /api/market/listings.
 * Never includes client-asserted `sellerId` — the server derives `sellerId`
 * exclusively from the verified Firebase ID token.
 */
export function buildMarketListingApiBody(payload: CreateListingApiPayload): Record<string, unknown> {
  const imagesList = Array.isArray(payload.images)
    ? payload.images.filter((img): img is string => typeof img === 'string' && Boolean(img.trim())).map((img) => img.trim())
    : [];
  const primaryImage = typeof payload.image === 'string' && payload.image.trim()
    ? payload.image.trim()
    : (imagesList[0] || '');

  const hasValidPairCoords =
    typeof payload.lat === 'number' &&
    Number.isFinite(payload.lat) &&
    typeof payload.lng === 'number' &&
    Number.isFinite(payload.lng);

  const body: Record<string, unknown> = {
    title: payload.title,
    titleGe: payload.titleGe ?? '',
    titleEn: payload.titleEn ?? '',
    primaryLanguage: payload.primaryLanguage,
    description: payload.description,
    descriptionGe: payload.descriptionGe ?? payload.description,
    price: payload.price === undefined ? null : payload.price,
    ...(typeof payload.priceUnspecified === 'boolean'
      ? { priceUnspecified: payload.priceUnspecified }
      : {}),
    currency: payload.currency || 'USD',
    sellerName: payload.sellerName,
    category: payload.category,
    listingType: payload.listingType,
    condition: payload.condition ?? '',
    isNegotiable: Boolean(payload.isNegotiable),
    isRemote: Boolean(payload.isRemote),
    location: payload.location ?? '',
    country: payload.country ?? '',
    city: payload.city ?? '',
    lat: hasValidPairCoords ? payload.lat : null,
    lng: hasValidPairCoords ? payload.lng : null,
    attributes:
      payload.attributes && typeof payload.attributes === 'object' && !Array.isArray(payload.attributes)
        ? payload.attributes
        : {},
    serviceDuration: payload.serviceDuration ?? '',
    serviceTerms: payload.serviceTerms ?? '',
    image: primaryImage,
    images: imagesList,
  };

  if (isValidClientListingId(payload.id)) {
    body.id = payload.id.trim();
  }

  if (Array.isArray(payload.tags)) {
    body.tags = payload.tags;
  }

  return body;
}

export interface SubmitListingViaApiOptions {
  payload: CreateListingApiPayload;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}

async function parseJsonSafe(res: Response): Promise<Record<string, any> | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Publishes a listing via the authenticated server endpoint (`POST /api/market/listings`).
 * Automatically refreshes the Firebase ID token once if the server returns HTTP 401.
 */
export async function submitListingViaApi({
  payload,
  getIdToken,
  fetchImpl = fetch,
  endpoint = '/api/market/listings',
}: SubmitListingViaApiOptions): Promise<Listing> {
  let token = '';
  try {
    token = await getIdToken(false);
  } catch (tokenErr: any) {
    throw new MarketListingApiError(
      401,
      tokenErr?.message || 'Authentication token could not be retrieved',
      'auth/token-retrieval-failed'
    );
  }

  if (!token || !token.trim()) {
    throw new MarketListingApiError(
      401,
      'Authentication required to publish a listing',
      'auth/missing-id-token'
    );
  }

  const requestBody = JSON.stringify(buildMarketListingApiBody(payload));

  const sendRequest = (authToken: string) =>
    fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: requestBody,
    });

  let res: Response;
  try {
    res = await sendRequest(token);
  } catch (netErr: any) {
    throw new MarketListingApiError(
      0,
      netErr?.message || 'Network error while connecting to the listing service',
      'listings/network-error'
    );
  }

  if (res.status === 401) {
    try {
      const refreshedToken = await getIdToken(true);
      if (refreshedToken && refreshedToken.trim()) {
        res = await sendRequest(refreshedToken);
      }
    } catch {
      // Keep original 401 response handling below
    }
  }

  const parsedBody = await parseJsonSafe(res);

  if (!res.ok) {
    const serverMessage =
      typeof parsedBody?.error === 'string' && parsedBody.error.trim()
        ? parsedBody.error.trim()
        : `Server returned HTTP ${res.status}`;
    const code = typeof parsedBody?.code === 'string' ? parsedBody.code : undefined;
    throw new MarketListingApiError(res.status, serverMessage, code, serverMessage);
  }

  if (!parsedBody || typeof parsedBody.id !== 'string') {
    throw new MarketListingApiError(
      502,
      'Invalid response received from listing creation API',
      'listings/invalid-response'
    );
  }

  return parsedBody as Listing;
}

/**
 * Formats API / network / Firestore errors cleanly for Georgian and English UI toasts.
 */
export function formatPublishListingErrorMessage(err: unknown, language: 'en' | 'ka'): string {
  const isKa = language === 'ka';

  if (err instanceof MarketListingApiError) {
    switch (err.status) {
      case 400: {
        const detail = err.serverError ? ` (${err.serverError})` : '';
        return isKa
          ? `განცხადების მონაცემები არასწორია ან არასრულია${detail}`
          : `Listing data is invalid or incomplete${detail}`;
      }
      case 401:
        return isKa
          ? 'ავტორიზაცია საჭიროა ან სესიას ვადა გაუვიდა. გთხოვთ შეხვიდეთ თავიდან.'
          : 'Authentication required or session expired. Please sign in again.';
      case 403:
        return isKa
          ? 'თქვენ არ გაქვთ ამ განცხადების გამოქვეყნების უფლება.'
          : 'You do not have permission to publish this listing.';
      case 409:
        return isKa
          ? 'ამ ID-ით განცხადება უკვე არსებობს.'
          : 'A listing with this ID already exists.';
      case 503:
        return isKa
          ? 'სერვერული ინფრასტრუქტურა დროებით მიუწვდომელია. სცადეთ მოგვიანებით.'
          : 'Server infrastructure is temporarily unavailable. Please try again later.';
      case 0:
        return isKa
          ? 'სერვერთან დაკავშირება ვერ მოხერხდა. შეამოწმეთ ინტერნეტი და სცადეთ თავიდან.'
          : 'Could not reach the server. Check your connection and try again.';
      default:
        return isKa
          ? `განცხადების გამოქვეყნება ვერ მოხერხდა (${err.status || 'შეცდომა'}).`
          : `Failed to publish listing (${err.status || 'error'}).`;
    }
  }

  const rawMsg = err instanceof Error ? err.message : String(err || '');
  const lower = rawMsg.toLowerCase();

  if (lower.includes('permission') || lower.includes('insufficient')) {
    return isKa
      ? 'წვდომის უფლება არასაკმარისია. გთხოვთ განაახლოთ სესია ან სცადოთ თავიდან.'
      : 'Insufficient permissions. Please refresh your session and try again.';
  }

  if (lower.includes('authentication required')) {
    return isKa
      ? 'ავტორიზაცია საჭიროა განცხადების გამოსაქვეყნებლად.'
      : 'Authentication required to publish a listing.';
  }

  return isKa
    ? `განცხადების შენახვა ვერ მოხერხდა${rawMsg ? `: ${rawMsg}` : '.'}`
    : `Could not save listing${rawMsg ? `: ${rawMsg}` : '.'}`;
}
