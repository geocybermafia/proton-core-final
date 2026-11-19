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
const PENDING_AUTH_LINK_STORAGE_KEY = 'proton_market_pending_auth_link';
const VISITOR_TOKEN_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const DEFAULT_PENDING_AUTH_LINK_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export type AuthSignInMethod = 'google_popup' | 'email_password' | 'email_signup';

export interface PendingGuestLinkContext {
  visitorToken: string;
  startedAt: number;
  signInMethod: AuthSignInMethod;
  wasGuestBeforeSignIn: true;
}

export interface GuestToAuthEvaluationResult {
  shouldLink: boolean;
  reason?:
    | 'initial_session_restore'
    | 'not_from_guest'
    | 'no_authenticated_user'
    | 'missing_verified_signin_context'
    | 'signin_context_expired'
    | 'invalid_visitor_token';
  context?: PendingGuestLinkContext;
}

let memoryVisitorId: string | null = null;
const memoryImpressions = new Set<string>();
const memoryViews = new Map<string, number>();
let pendingAuthLinkContext: PendingGuestLinkContext | null = null;

function getSafeStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    const win = typeof window !== 'undefined' ? window : (globalThis as any)?.window;
    if (win && win[kind]) {
      return win[kind] as Storage;
    }
    const direct = (globalThis as any)?.[kind];
    return direct || null;
  } catch {
    return null;
  }
}

function safeStorageGet(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(storage: Storage | null, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeStorageRemove(storage: Storage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

function safeStorageRemoveByPrefixes(storage: Storage | null, prefixes: string[]): void {
  if (!storage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      safeStorageRemove(storage, key);
    }
  } catch {
    // ignore storage iteration errors
  }
}

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
 * Peeks at an existing guest visitor token without creating a new one.
 */
export function peekExistingVisitorToken(): string | null {
  if (memoryVisitorId && VISITOR_TOKEN_PATTERN.test(memoryVisitorId)) {
    return memoryVisitorId;
  }

  const localStore = getSafeStorage('localStorage');
  const localVal = safeStorageGet(localStore, VISITOR_ID_STORAGE_KEY);
  if (localVal && VISITOR_TOKEN_PATTERN.test(localVal)) {
    memoryVisitorId = localVal;
    return localVal;
  }

  const sessStore = getSafeStorage('sessionStorage');
  const sessVal = safeStorageGet(sessStore, VISITOR_ID_STORAGE_KEY);
  if (sessVal && VISITOR_TOKEN_PATTERN.test(sessVal)) {
    memoryVisitorId = sessVal;
    return sessVal;
  }

  return null;
}

/**
 * Safely clears all client-side market analytics session state:
 * - memoryVisitorId, memoryImpressions, memoryViews, pendingAuthLinkContext
 * - proton_market_visitor_id, proton_imp_seen_*, proton_view_seen_* in localStorage & sessionStorage
 * Never removes favorites, cart, drafts, or other non-analytics keys, and never throws.
 */
export function resetMarketAnalyticsSession(): void {
  memoryVisitorId = null;
  memoryImpressions.clear();
  memoryViews.clear();
  pendingAuthLinkContext = null;

  const localStore = getSafeStorage('localStorage');
  const sessStore = getSafeStorage('sessionStorage');
  const prefixes = [SESSION_IMPRESSION_PREFIX, SESSION_VIEW_PREFIX];

  safeStorageRemove(localStore, VISITOR_ID_STORAGE_KEY);
  safeStorageRemove(sessStore, VISITOR_ID_STORAGE_KEY);
  safeStorageRemove(sessStore, PENDING_AUTH_LINK_STORAGE_KEY);
  safeStorageRemove(localStore, PENDING_AUTH_LINK_STORAGE_KEY);

  safeStorageRemoveByPrefixes(sessStore, prefixes);
  safeStorageRemoveByPrefixes(localStore, prefixes);
}

/**
 * Invalidates the active guest analytics session (visitor token + impression/view throttles)
 * and issues a fresh, independent visitor token preserving Phase 1 server validation format.
 */
export function rotateVisitorToken(): string {
  const prevToken = peekExistingVisitorToken();
  resetMarketAnalyticsSession();

  let nextToken = generateCryptoVisitorId();
  if (prevToken && nextToken === prevToken) {
    nextToken = generateCryptoVisitorId();
  }

  memoryVisitorId = nextToken;
  const localStore = getSafeStorage('localStorage');
  if (!safeStorageSet(localStore, VISITOR_ID_STORAGE_KEY, nextToken)) {
    const sessStore = getSafeStorage('sessionStorage');
    safeStorageSet(sessStore, VISITOR_ID_STORAGE_KEY, nextToken);
  }
  return nextToken;
}

/**
 * Captures explicit sign-in context before a user-initiated authentication attempt.
 * Only prepares a candidate if the user is currently unauthenticated (guest) and
 * actually holds an existing visitorToken.
 */
export function beginAuthVisitorLinkIntent(
  signInMethod: AuthSignInMethod,
  currentUserId?: string | null,
  nowMs: number = Date.now()
): PendingGuestLinkContext | null {
  if (currentUserId) {
    cancelAuthVisitorLinkIntent();
    return null;
  }

  const existingToken = peekExistingVisitorToken();
  if (!existingToken || !VISITOR_TOKEN_PATTERN.test(existingToken)) {
    cancelAuthVisitorLinkIntent();
    return null;
  }

  const ctx: PendingGuestLinkContext = {
    visitorToken: existingToken,
    startedAt: nowMs,
    signInMethod,
    wasGuestBeforeSignIn: true,
  };
  pendingAuthLinkContext = ctx;
  const sessStore = getSafeStorage('sessionStorage');
  safeStorageSet(sessStore, PENDING_AUTH_LINK_STORAGE_KEY, JSON.stringify(ctx));
  return ctx;
}

export function cancelAuthVisitorLinkIntent(): void {
  pendingAuthLinkContext = null;
  const sessStore = getSafeStorage('sessionStorage');
  safeStorageRemove(sessStore, PENDING_AUTH_LINK_STORAGE_KEY);
}

export function getPendingAuthVisitorLinkIntent(): PendingGuestLinkContext | null {
  if (pendingAuthLinkContext) {
    return pendingAuthLinkContext;
  }
  const sessStore = getSafeStorage('sessionStorage');
  const raw = safeStorageGet(sessStore, PENDING_AUTH_LINK_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.visitorToken === 'string' &&
      VISITOR_TOKEN_PATTERN.test(parsed.visitorToken) &&
      typeof parsed.startedAt === 'number' &&
      Number.isFinite(parsed.startedAt) &&
      parsed.wasGuestBeforeSignIn === true &&
      (parsed.signInMethod === 'google_popup' ||
        parsed.signInMethod === 'email_password' ||
        parsed.signInMethod === 'email_signup')
    ) {
      pendingAuthLinkContext = parsed as PendingGuestLinkContext;
      return pendingAuthLinkContext;
    }
  } catch {
    // ignore malformed pending context
  }
  safeStorageRemove(sessStore, PENDING_AUTH_LINK_STORAGE_KEY);
  return null;
}

export function consumePendingAuthVisitorLinkIntent(): PendingGuestLinkContext | null {
  const ctx = getPendingAuthVisitorLinkIntent();
  cancelAuthVisitorLinkIntent();
  return ctx;
}

/**
 * Pure verification gate for Phase 2B Guest -> Auth linking.
 * Guarantees:
 * - Page reload auto-restore is NEVER treated as a new sign-in
 * - User A -> User B switch is NEVER linked
 * - Plain null -> User transition without explicit sign-in context is NEVER linked
 */
export function evaluateGuestToAuthTransition(params: {
  isInitialSessionRestore: boolean;
  previousUid: string | null;
  nextUid: string | null;
  pendingContext: PendingGuestLinkContext | null;
  nowMs?: number;
  maxAgeMs?: number;
}): GuestToAuthEvaluationResult {
  if (params.isInitialSessionRestore) {
    return { shouldLink: false, reason: 'initial_session_restore' };
  }
  if (params.previousUid !== null) {
    return { shouldLink: false, reason: 'not_from_guest' };
  }
  if (!params.nextUid) {
    return { shouldLink: false, reason: 'no_authenticated_user' };
  }
  const ctx = params.pendingContext;
  if (!ctx || !ctx.wasGuestBeforeSignIn) {
    return { shouldLink: false, reason: 'missing_verified_signin_context' };
  }
  if (!VISITOR_TOKEN_PATTERN.test(ctx.visitorToken)) {
    return { shouldLink: false, reason: 'invalid_visitor_token' };
  }
  const nowMs = params.nowMs ?? Date.now();
  const maxAgeMs = params.maxAgeMs ?? DEFAULT_PENDING_AUTH_LINK_MAX_AGE_MS;
  if (nowMs < ctx.startedAt || nowMs - ctx.startedAt > maxAgeMs) {
    return { shouldLink: false, reason: 'signin_context_expired' };
  }
  return { shouldLink: true, context: ctx };
}

/**
 * Retrieves or creates an anonymous cryptographically generated browser visitor ID
 * for guest deduplication. Note: For guests this identifies a browser profile, not
 * a guaranteed physical individual.
 */
export function getOrCreateVisitorToken(): string {
  if (memoryVisitorId && VISITOR_TOKEN_PATTERN.test(memoryVisitorId)) {
    return memoryVisitorId;
  }

  const localStore = getSafeStorage('localStorage');
  const existingLocal = safeStorageGet(localStore, VISITOR_ID_STORAGE_KEY);
  if (existingLocal && VISITOR_TOKEN_PATTERN.test(existingLocal)) {
    memoryVisitorId = existingLocal;
    return existingLocal;
  }

  const sessStore = getSafeStorage('sessionStorage');
  const existingSess = safeStorageGet(sessStore, VISITOR_ID_STORAGE_KEY);
  if (existingSess && VISITOR_TOKEN_PATTERN.test(existingSess)) {
    memoryVisitorId = existingSess;
    return existingSess;
  }

  const created = generateCryptoVisitorId();
  memoryVisitorId = created;
  if (!safeStorageSet(localStore, VISITOR_ID_STORAGE_KEY, created)) {
    safeStorageSet(sessStore, VISITOR_ID_STORAGE_KEY, created);
  }
  return created;
}

export function hasSessionImpression(listingId: string): boolean {
  if (memoryImpressions.has(listingId)) return true;
  const sessStore = getSafeStorage('sessionStorage');
  return safeStorageGet(sessStore, `${SESSION_IMPRESSION_PREFIX}${listingId}`) === '1';
}

export function markSessionImpression(listingId: string): void {
  memoryImpressions.add(listingId);
  const sessStore = getSafeStorage('sessionStorage');
  safeStorageSet(sessStore, `${SESSION_IMPRESSION_PREFIX}${listingId}`, '1');
}

export function shouldThrottleClientView(listingId: string): boolean {
  const now = Date.now();
  const memTs = memoryViews.get(listingId);
  if (memTs && now - memTs < 60_000) return true;
  const sessStore = getSafeStorage('sessionStorage');
  const raw = safeStorageGet(sessStore, `${SESSION_VIEW_PREFIX}${listingId}`);
  if (raw) {
    const ts = Number(raw);
    if (Number.isFinite(ts) && now - ts < 60_000) return true;
  }
  return false;
}

export function markClientView(listingId: string): void {
  const now = Date.now();
  memoryViews.set(listingId, now);
  const sessStore = getSafeStorage('sessionStorage');
  safeStorageSet(sessStore, `${SESSION_VIEW_PREFIX}${listingId}`, String(now));
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
