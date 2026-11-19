import { auth } from '../firebase';
import {
  ListingAnalyticsStats,
  ListingTypeFilter,
  RankingEntry,
  RankingPeriod,
  RankingScope,
  SellerAnalyticsOverview,
} from '../types';

const VISITOR_ID_STORAGE_KEY = 'proton_market_visitor_id';
const SESSION_IMPRESSION_PREFIX = 'proton_imp_seen_';
const SESSION_VIEW_PREFIX = 'proton_view_seen_';

let memoryVisitorId: string | null = null;
const memoryImpressions = new Set<string>();
const memoryViews = new Map<string, number>();

function generateCryptoVisitorId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `vst_${crypto.randomUUID().replace(/-/g, '')}`;
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `vst_${hex}`;
    }
  } catch {
    // ignore
  }
  return `vst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Retrieves or creates an anonymous cryptographically generated browser visitor ID
 * for guest deduplication. Note: For guests this identifies a browser profile, not
 * a guaranteed physical individual.
 */
export function getOrCreateVisitorToken(): string {
  if (memoryVisitorId) return memoryVisitorId;

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,128}$/.test(existing)) {
      memoryVisitorId = existing;
      return existing;
    }
    const created = generateCryptoVisitorId();
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, created);
    memoryVisitorId = created;
    return created;
  } catch {
    try {
      const existingSess = window.sessionStorage.getItem(VISITOR_ID_STORAGE_KEY);
      if (existingSess && /^[a-zA-Z0-9_-]{8,128}$/.test(existingSess)) {
        memoryVisitorId = existingSess;
        return existingSess;
      }
      const created = generateCryptoVisitorId();
      window.sessionStorage.setItem(VISITOR_ID_STORAGE_KEY, created);
      memoryVisitorId = created;
      return created;
    } catch {
      const created = generateCryptoVisitorId();
      memoryVisitorId = created;
      return created;
    }
  }
}

export function hasSessionImpression(listingId: string): boolean {
  if (memoryImpressions.has(listingId)) return true;
  try {
    return window.sessionStorage.getItem(`${SESSION_IMPRESSION_PREFIX}${listingId}`) === '1';
  } catch {
    return false;
  }
}

export function markSessionImpression(listingId: string): void {
  memoryImpressions.add(listingId);
  try {
    window.sessionStorage.setItem(`${SESSION_IMPRESSION_PREFIX}${listingId}`, '1');
  } catch {
    // ignore restricted storage
  }
}

function shouldThrottleClientView(listingId: string): boolean {
  const now = Date.now();
  const memTs = memoryViews.get(listingId);
  if (memTs && now - memTs < 60_000) return true;
  try {
    const raw = window.sessionStorage.getItem(`${SESSION_VIEW_PREFIX}${listingId}`);
    if (raw) {
      const ts = Number(raw);
      if (Number.isFinite(ts) && now - ts < 60_000) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function markClientView(listingId: string): void {
  const now = Date.now();
  memoryViews.set(listingId, now);
  try {
    window.sessionStorage.setItem(`${SESSION_VIEW_PREFIX}${listingId}`, String(now));
  } catch {
    // ignore
  }
}

async function getOptionalAuthHeader(): Promise<Record<string, string>> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return {};
    const token = await currentUser.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Non-blocking telemetry sender for real card impressions and detail modal views.
 * Never alters UI timing or throws unhandled errors.
 */
export function sendListingAnalyticsEvent(params: {
  listingId: string;
  sellerId?: string;
  eventType: 'impression' | 'view';
  currentUserId?: string | null;
}): void {
  try {
    if (typeof window === 'undefined' || !params.listingId) return;
    // Skip owner self-views on client as well as server
    if (params.currentUserId && params.sellerId && params.currentUserId === params.sellerId) {
      return;
    }

    if (params.eventType === 'impression') {
      if (hasSessionImpression(params.listingId)) return;
      markSessionImpression(params.listingId);
    } else {
      if (shouldThrottleClientView(params.listingId)) return;
      markClientView(params.listingId);
    }

    const visitorToken = getOrCreateVisitorToken();
    const payload = JSON.stringify({
      listingId: params.listingId,
      eventType: params.eventType,
      visitorToken,
    });

    // Fire-and-forget async call with keepalive
    void (async () => {
      try {
        const authHeaders = await getOptionalAuthHeader();
        await fetch('/api/market/listing-event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: payload,
          keepalive: true,
        });
      } catch {
        // Silently ignore telemetry transport issues
      }
    })();
  } catch {
    // Never interrupt user experience
  }
}

export async function fetchSellerAnalyticsOverview(): Promise<{
  overview: SellerAnalyticsOverview | null;
  unavailableReason?: string;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { overview: null, unavailableReason: 'unauthenticated' };
  }
  const token = await currentUser.getIdToken();
  const res = await fetch('/api/market/listing-stats', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      overview: null,
      unavailableReason: data?.code || data?.error || `HTTP_${res.status}`,
    };
  }
  return { overview: data.overview || null };
}

export async function fetchSingleListingAnalytics(listingId: string): Promise<{
  listing: ListingAnalyticsStats | null;
  unavailableReason?: string;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { listing: null, unavailableReason: 'unauthenticated' };
  }
  const token = await currentUser.getIdToken();
  const res = await fetch(`/api/market/listing-stats?listingId=${encodeURIComponent(listingId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      listing: null,
      unavailableReason: data?.code || data?.error || `HTTP_${res.status}`,
    };
  }
  return { listing: data.listing || null };
}

export async function fetchPublicRankings(params: {
  scope: RankingScope;
  period: RankingPeriod;
  listingType?: ListingTypeFilter;
  category?: string;
  country?: string;
  region?: string;
}): Promise<{
  rankings: RankingEntry[];
  availableCountries: string[];
  availableRegions: string[];
  isPartialData?: boolean;
  dataCompleteness?: {
    isComplete: boolean;
    publicDocsTruncated: boolean;
    ratingsTruncated: boolean;
    warnings: string[];
  };
  unavailableReason?: string;
}> {
  const qs = new URLSearchParams();
  qs.set('scope', params.scope);
  qs.set('period', params.period);
  if (params.listingType && params.listingType !== 'all') qs.set('listingType', params.listingType);
  if (params.category && params.category !== 'all') qs.set('category', params.category);
  if (params.country) qs.set('country', params.country);
  if (params.region) qs.set('region', params.region);

  const res = await fetch(`/api/market/rankings?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      rankings: [],
      availableCountries: [],
      availableRegions: [],
      unavailableReason: data?.code || data?.error || `HTTP_${res.status}`,
    };
  }
  return {
    rankings: Array.isArray(data.rankings) ? data.rankings : [],
    availableCountries: Array.isArray(data.availableCountries) ? data.availableCountries : [],
    availableRegions: Array.isArray(data.availableRegions) ? data.availableRegions : [],
    isPartialData: Boolean(data.isPartialData),
    dataCompleteness: data.dataCompleteness,
  };
}

export async function setCompetitionOptOutPreference(optedOut: boolean): Promise<{
  success: boolean;
  optedOut: boolean;
  error?: string;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, optedOut, error: 'Authentication required' };
  }
  const token = await currentUser.getIdToken();
  const res = await fetch('/api/market/competition-preference', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ optedOut }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, optedOut, error: data?.error || `HTTP ${res.status}` };
  }
  return { success: true, optedOut: Boolean(data.optedOut) };
}
