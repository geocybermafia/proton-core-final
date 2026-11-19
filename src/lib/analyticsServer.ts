import crypto from 'crypto';
import {
  AchievementBadgeId,
  AnalyticsPeriod,
  EarnedAchievementEntry,
  ListingAnalyticsStats,
  PeriodComparison,
  PeriodMetrics,
  RankingEntry,
  RankingPeriod,
  RankingScope,
  SellerAnalyticsOverview,
} from '../types';
import {
  BucketCounter,
  IMPRESSION_COOLDOWN_MS,
  RawListingAnalyticsDoc,
  VIEW_COOLDOWN_MS,
  aggregatePeriodFromBuckets,
  aggregateViewerBreakdownFromDoc,
  buildRankingsFromPublicDocs,
  computeListingAchievements,
  getDayBucketKey,
  getHourBucketKey,
  isBotUserAgent,
  isValidAnalyticsId,
  normalizeListingTypeFilter,
  pruneDailyBuckets,
  pruneHourlyBuckets,
  resolveReliableSellerLocation,
  sumPeriodMetricsList,
  sumViewerBreakdownList,
} from './marketAnalyticsUtils.js';
import { inferListingType } from './listingClassification.js';

export type MarketEventType = 'impression' | 'view';

export interface ListingRecordForAnalytics {
  id: string;
  sellerId: string;
  sellerName?: string;
  title: string;
  titleGe?: string;
  category: string;
  listingType?: 'product' | 'service' | 'project';
  image?: string;
  images?: string[];
  status?: string;
  country?: string;
  city?: string;
  createdAt?: any;
  isDemo?: boolean;
  isSeed?: boolean;
  isMock?: boolean;
}

export interface ViewerMarkerDoc {
  viewerHash: string;
  viewerType: 'auth' | 'guest';
  firstImpressionAt?: number;
  lastImpressionAt?: number;
  firstViewedAt?: number;
  lastViewAt?: number;
}

export interface DataCompletenessInfo {
  isComplete: boolean;
  publicDocsTruncated: boolean;
  ratingsTruncated: boolean;
  warnings: string[];
}

export interface PublicDocsScanResult {
  docs: RawListingAnalyticsDoc[];
  truncated: boolean;
  truncationReason?: string;
}

export interface SellerRatingsScanResult {
  ratings: Record<string, { avg: number; count: number }>;
  truncated: boolean;
  truncationReason?: string;
}

export interface AnalyticsRepository {
  getListing(listingId: string): Promise<ListingRecordForAnalytics | null>;
  getSellerProfileLocation(sellerId: string): Promise<{ country?: string; region?: string; optedOut?: boolean }>;
  getSellerListings(sellerId: string): Promise<ListingRecordForAnalytics[]>;
  getListingAnalyticsDoc(listingId: string): Promise<RawListingAnalyticsDoc | null>;
  getAllPublicAnalyticsDocs(): Promise<RawListingAnalyticsDoc[]>;
  getAllPublicAnalyticsDocsWithMeta?(): Promise<PublicDocsScanResult>;
  getSellerRatingsMap(): Promise<Record<string, { avg: number; count: number }>>;
  getSellerRatingsMapWithMeta?(): Promise<SellerRatingsScanResult>;
  recordEventTransaction(params: {
    listing: ListingRecordForAnalytics;
    sellerLocation: { country?: string; region?: string; optedOut?: boolean };
    viewerHash: string;
    viewerType: 'auth' | 'guest';
    eventType: MarketEventType;
    nowMs: number;
  }): Promise<{ recorded: boolean; reason?: string; uniqueIncremented: boolean }>;
  setSellerCompetitionOptOut(sellerId: string, optedOut: boolean, nowMs: number): Promise<void>;
}

function parseTimestampMs(val: any): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  if (val && typeof val.seconds === 'number') return val.seconds * 1000;
  return Date.now();
}

export const DEV_FALLBACK_ANALYTICS_SALT = 'proton-market-analytics-v1-salt';
export const MIN_ANALYTICS_SALT_LENGTH = 32;

export class AnalyticsConfigError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 503) {
    super(message);
    this.name = 'AnalyticsConfigError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

export interface ParsedServiceAccount {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  [key: string]: any;
}

/**
 * Safely parses FIREBASE_SERVICE_ACCOUNT_JSON:
 * - Trims whitespace and strips redundant outer single/double quotes if present
 * - Protects JSON.parse with try/catch
 * - Normalizes literal `\\n` sequences inside `private_key` to real newlines
 * - Never exposes raw secret contents in thrown error messages
 */
export function parseServiceAccountJson(rawSaJson: string): ParsedServiceAccount {
  let cleaned = rawSaJson.trim();

  if (
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('"') && cleaned.endsWith('"'))
  ) {
    const inner = cleaned.slice(1, -1).trim();
    if (inner.startsWith('{')) {
      cleaned = inner;
    } else if (cleaned.startsWith('"')) {
      try {
        const unwrapped = JSON.parse(cleaned);
        if (typeof unwrapped === 'string' && unwrapped.trim().startsWith('{')) {
          cleaned = unwrapped.trim();
        }
      } catch {
        // Handled by main JSON.parse below
      }
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AnalyticsConfigError(
      'analytics/admin-credentials-invalid',
      'Server Firebase Admin service account JSON is malformed.'
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AnalyticsConfigError(
      'analytics/admin-credentials-invalid',
      'Server Firebase Admin service account JSON must be an object.'
    );
  }

  if (typeof parsed.client_email !== 'string' || !parsed.client_email.includes('@')) {
    throw new AnalyticsConfigError(
      'analytics/admin-credentials-invalid',
      'Server Firebase Admin service account JSON is missing a valid client_email.'
    );
  }

  if (typeof parsed.private_key !== 'string' || !parsed.private_key.trim()) {
    throw new AnalyticsConfigError(
      'analytics/admin-credentials-invalid',
      'Server Firebase Admin service account JSON is missing a valid private_key.'
    );
  }

  const normalizedKey = parsed.private_key.replace(/\\n/g, '\n').trim();
  if (!normalizedKey.includes('-----BEGIN ') || !normalizedKey.includes('-----END ')) {
    throw new AnalyticsConfigError(
      'analytics/admin-credentials-invalid',
      'Server Firebase Admin private_key is not valid PEM format.'
    );
  }

  return {
    ...parsed,
    private_key: `${normalizedKey}\n`,
  };
}

let cachedAdminFirestore: any = null;

export async function resetAdminFirestoreCacheForTests(): Promise<void> {
  cachedAdminFirestore = null;
  try {
    const { getApps, deleteApp } = await import('firebase-admin/app');
    const existing = getApps().find((a: any) => a.name === 'proton-analytics-admin');
    if (existing) {
      await deleteApp(existing);
    }
  } catch {
    // Ignore cleanup errors when app wasn't initialized
  }
}

export async function getAdminFirestoreInstance(): Promise<any> {
  if (cachedAdminFirestore) return cachedAdminFirestore;

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'proton-core-ai';
  const databaseId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51';
  const appName = 'proton-analytics-admin';

  let app = getApps().find((a: any) => a.name === appName);
  if (!app) {
    const rawSaJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (typeof rawSaJson === 'string' && rawSaJson.trim().length > 0) {
      const parsed = parseServiceAccountJson(rawSaJson);
      try {
        app = initializeApp(
          {
            credential: cert({
              projectId: parsed.project_id || projectId,
              clientEmail: parsed.client_email,
              privateKey: parsed.private_key,
            }),
            projectId: parsed.project_id || projectId,
          },
          appName
        );
      } catch {
        console.error('[MarketAnalytics] Failed to initialize Firebase Admin credential from FIREBASE_SERVICE_ACCOUNT_JSON.');
        throw new AnalyticsConfigError(
          'analytics/admin-credentials-invalid',
          'Server Firebase Admin service account credential or private key is invalid.'
        );
      }
    } else {
      app = initializeApp({ projectId }, appName);
    }
  }

  cachedAdminFirestore = getFirestore(app, databaseId);
  return cachedAdminFirestore;
}

export const DEFAULT_CURSOR_BATCH_SIZE = 500;
export const DEFAULT_CURSOR_MAX_PAGES = 200; // Up to 100,000 docs before safety guard triggers explicit incomplete flag
export const ANALYTICS_CACHE_TTL_MS = 30_000;

export interface CursorQueryLike {
  orderBy(fieldPath: any, directionStr?: 'asc' | 'desc'): CursorQueryLike;
  limit(limit: number): CursorQueryLike;
  startAfter(snapshot: any): CursorQueryLike;
  select?(...fields: string[]): CursorQueryLike;
  get(): Promise<{ docs: Array<{ id: string; data: () => any }> }>;
}

export async function scanCollectionWithCursor<T = Record<string, any>>(params: {
  collectionRef: CursorQueryLike;
  documentIdField: any;
  batchSize?: number;
  maxPages?: number;
  selectFields?: string[];
  label?: string;
}): Promise<{ items: Array<{ id: string; data: T }>; truncated: boolean; truncationReason?: string }> {
  const batchSize = Math.max(1, Math.min(1000, params.batchSize ?? DEFAULT_CURSOR_BATCH_SIZE));
  const maxPages = Math.max(1, params.maxPages ?? DEFAULT_CURSOR_MAX_PAGES);
  const label = params.label || 'collection';

  const items: Array<{ id: string; data: T }> = [];
  const seenIds = new Set<string>();
  let lastDoc: { id: string; data: () => any } | null = null;
  let prevCursorId: string | null = null;
  let pagesRead = 0;
  let truncated = false;
  let truncationReason: string | undefined;

  while (true) {
    if (pagesRead >= maxPages) {
      truncated = true;
      truncationReason = `cursor_max_pages_exceeded:${maxPages}`;
      console.error(
        `[MarketAnalytics] Incomplete scan for ${label}: reached safety limit of ${maxPages} pages (${items.length} docs read).`
      );
      break;
    }

    let q: CursorQueryLike = params.collectionRef.orderBy(params.documentIdField);
    if (params.selectFields && params.selectFields.length > 0 && typeof q.select === 'function') {
      q = q.select(...params.selectFields);
    }
    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }
    q = q.limit(batchSize);

    const snap = await q.get();
    pagesRead += 1;

    const batchDocs = Array.isArray(snap?.docs) ? snap.docs : [];
    if (batchDocs.length === 0) {
      break;
    }

    let addedInBatch = 0;
    for (const d of batchDocs) {
      if (!d || !d.id || seenIds.has(d.id)) {
        continue;
      }
      seenIds.add(d.id);
      items.push({ id: d.id, data: (d.data() || {}) as T });
      addedInBatch += 1;
    }

    const nextLastDoc = batchDocs[batchDocs.length - 1];
    if (!nextLastDoc || !nextLastDoc.id || nextLastDoc.id === prevCursorId || addedInBatch === 0) {
      if (batchDocs.length >= batchSize) {
        truncated = true;
        truncationReason = 'cursor_stalled_loop_guard';
        console.error(
          `[MarketAnalytics] Cursor pagination loop guard triggered for ${label} at docId=${nextLastDoc?.id || 'unknown'} (${items.length} docs read).`
        );
      }
      break;
    }

    prevCursorId = nextLastDoc.id;
    lastDoc = nextLastDoc;

    if (batchDocs.length < batchSize) {
      break;
    }
  }

  return { items, truncated, truncationReason };
}

export class FirestoreAdminAnalyticsRepository implements AnalyticsRepository {
  private publicDocsCache: { expiresAt: number; value: PublicDocsScanResult } | null = null;
  private ratingsCache: { expiresAt: number; value: SellerRatingsScanResult } | null = null;
  private readonly cacheTtlMs: number;

  constructor(options?: { cacheTtlMs?: number }) {
    this.cacheTtlMs = options?.cacheTtlMs ?? ANALYTICS_CACHE_TTL_MS;
  }

  invalidateCaches(): void {
    this.publicDocsCache = null;
    this.ratingsCache = null;
  }

  async getListing(listingId: string): Promise<ListingRecordForAnalytics | null> {
    const db = await getAdminFirestoreInstance();
    const snap = await db.collection('listings').doc(listingId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    return {
      id: snap.id,
      sellerId: data.sellerId,
      sellerName: data.sellerName || data.authorName,
      title: data.title || data.titleGe || 'Untitled',
      titleGe: data.titleGe,
      category: data.category || 'other',
      listingType: inferListingType(data.category, data.listingType),
      image: Array.isArray(data.images) && data.images[0] ? data.images[0] : data.image,
      status: data.status,
      country: data.country,
      city: data.city,
      createdAt: parseTimestampMs(data.createdAt),
      isDemo: data.isDemo,
      isSeed: data.isSeed,
      isMock: data.isMock,
    };
  }

  async getSellerProfileLocation(sellerId: string): Promise<{ country?: string; region?: string; optedOut?: boolean }> {
    const db = await getAdminFirestoreInstance();
    const [userSnap, prefSnap] = await Promise.all([
      db.collection('users').doc(sellerId).get().catch(() => null),
      db.collection('seller_competition_prefs').doc(sellerId).get().catch(() => null),
    ]);
    const uData = userSnap?.exists ? userSnap.data() || {} : {};
    const pData = prefSnap?.exists ? prefSnap.data() || {} : {};
    const loc = resolveReliableSellerLocation({
      profileCountry: uData.country,
      profileRegion: uData.region,
    });
    return {
      country: loc.country,
      region: loc.region,
      optedOut: Boolean(pData.optedOut ?? uData.competitionOptOut),
    };
  }

  async getSellerListings(sellerId: string): Promise<ListingRecordForAnalytics[]> {
    const db = await getAdminFirestoreInstance();
    const snap = await db
      .collection('listings')
      .where('sellerId', '==', sellerId)
      .limit(100)
      .get();
    return snap.docs.map((d: any) => {
      const data = d.data() || {};
      return {
        id: d.id,
        sellerId: data.sellerId,
        sellerName: data.sellerName || data.authorName,
        title: data.title || data.titleGe || 'Untitled',
        titleGe: data.titleGe,
        category: data.category || 'other',
        listingType: inferListingType(data.category, data.listingType),
        image: Array.isArray(data.images) && data.images[0] ? data.images[0] : data.image,
        status: data.status,
        country: data.country,
        city: data.city,
        createdAt: parseTimestampMs(data.createdAt),
        isDemo: data.isDemo,
        isSeed: data.isSeed,
        isMock: data.isMock,
      };
    });
  }

  async getListingAnalyticsDoc(listingId: string): Promise<RawListingAnalyticsDoc | null> {
    const db = await getAdminFirestoreInstance();
    const snap = await db.collection('listing_analytics').doc(listingId).get();
    if (!snap.exists) return null;
    return snap.data() as RawListingAnalyticsDoc;
  }

  async getAllPublicAnalyticsDocsWithMeta(): Promise<PublicDocsScanResult> {
    const now = Date.now();
    if (this.cacheTtlMs > 0 && this.publicDocsCache && this.publicDocsCache.expiresAt > now) {
      return this.publicDocsCache.value;
    }

    const db = await getAdminFirestoreInstance();
    const { FieldPath } = await import('firebase-admin/firestore');
    const scan = await scanCollectionWithCursor<RawListingAnalyticsDoc>({
      collectionRef: db.collection('listing_analytics_public'),
      documentIdField: FieldPath.documentId(),
      batchSize: DEFAULT_CURSOR_BATCH_SIZE,
      maxPages: DEFAULT_CURSOR_MAX_PAGES,
      label: 'listing_analytics_public',
    });

    const result: PublicDocsScanResult = {
      docs: scan.items.map((item) => item.data),
      truncated: scan.truncated,
      ...(scan.truncationReason ? { truncationReason: scan.truncationReason } : {}),
    };

    if (this.cacheTtlMs > 0 && !result.truncated) {
      this.publicDocsCache = { expiresAt: now + this.cacheTtlMs, value: result };
    }
    return result;
  }

  async getAllPublicAnalyticsDocs(): Promise<RawListingAnalyticsDoc[]> {
    const res = await this.getAllPublicAnalyticsDocsWithMeta();
    return res.docs;
  }

  async getSellerRatingsMapWithMeta(): Promise<SellerRatingsScanResult> {
    const now = Date.now();
    if (this.cacheTtlMs > 0 && this.ratingsCache && this.ratingsCache.expiresAt > now) {
      return this.ratingsCache.value;
    }

    const db = await getAdminFirestoreInstance();
    const { FieldPath } = await import('firebase-admin/firestore');
    const scan = await scanCollectionWithCursor<{ sellerId?: string; rating?: number }>({
      collectionRef: db.collection('seller_reviews'),
      documentIdField: FieldPath.documentId(),
      batchSize: DEFAULT_CURSOR_BATCH_SIZE,
      maxPages: DEFAULT_CURSOR_MAX_PAGES,
      selectFields: ['sellerId', 'rating'],
      label: 'seller_reviews',
    });

    const agg: Record<string, { sum: number; count: number }> = {};
    for (const item of scan.items) {
      const r = item.data || {};
      if (r.sellerId && typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5) {
        if (!agg[r.sellerId]) agg[r.sellerId] = { sum: 0, count: 0 };
        agg[r.sellerId].sum += r.rating;
        agg[r.sellerId].count += 1;
      }
    }
    const ratings: Record<string, { avg: number; count: number }> = {};
    for (const [sid, v] of Object.entries(agg)) {
      ratings[sid] = { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count };
    }

    const result: SellerRatingsScanResult = {
      ratings,
      truncated: scan.truncated,
      ...(scan.truncationReason ? { truncationReason: scan.truncationReason } : {}),
    };

    if (this.cacheTtlMs > 0 && !result.truncated) {
      this.ratingsCache = { expiresAt: now + this.cacheTtlMs, value: result };
    }
    return result;
  }

  async getSellerRatingsMap(): Promise<Record<string, { avg: number; count: number }>> {
    const res = await this.getSellerRatingsMapWithMeta();
    return res.ratings;
  }

  async recordEventTransaction(params: {
    listing: ListingRecordForAnalytics;
    sellerLocation: { country?: string; region?: string; optedOut?: boolean };
    viewerHash: string;
    viewerType: 'auth' | 'guest';
    eventType: MarketEventType;
    nowMs: number;
  }): Promise<{ recorded: boolean; reason?: string; uniqueIncremented: boolean }> {
    const db = await getAdminFirestoreInstance();
    const { listing, sellerLocation, viewerHash, viewerType, eventType, nowMs } = params;

    const analyticsRef = db.collection('listing_analytics').doc(listing.id);
    const viewerRef = analyticsRef.collection('viewers').doc(viewerHash);
    const publicRef = db.collection('listing_analytics_public').doc(listing.id);

    const loc = resolveReliableSellerLocation({
      profileCountry: sellerLocation.country,
      profileRegion: sellerLocation.region,
      listingCountry: listing.country,
      listingCity: listing.city,
    });

    return db.runTransaction(async (tx: any) => {
      const [analyticsSnap, viewerSnap] = await Promise.all([
        tx.get(analyticsRef),
        tx.get(viewerRef),
      ]);

      const viewerData: ViewerMarkerDoc = viewerSnap.exists
        ? (viewerSnap.data() as ViewerMarkerDoc)
        : { viewerHash, viewerType };

      if (eventType === 'impression') {
        if (
          viewerData.lastImpressionAt &&
          nowMs - viewerData.lastImpressionAt < IMPRESSION_COOLDOWN_MS
        ) {
          return { recorded: false, reason: 'impression_cooldown', uniqueIncremented: false };
        }
      } else {
        if (viewerData.lastViewAt && nowMs - viewerData.lastViewAt < VIEW_COOLDOWN_MS) {
          return { recorded: false, reason: 'view_cooldown', uniqueIncremented: false };
        }
      }

      const existingDoc: Partial<RawListingAnalyticsDoc> = analyticsSnap.exists
        ? analyticsSnap.data() || {}
        : {};

      const hourKey = getHourBucketKey(nowMs);
      const dayKey = getDayBucketKey(nowMs);
      const hourly = pruneHourlyBuckets(existingDoc.hourly, nowMs);
      const daily = pruneDailyBuckets(existingDoc.daily, nowMs);

      const hBucket: BucketCounter = hourly[hourKey] || {
        impressions: 0,
        views: 0,
        uniqueViewers: 0,
        authImpressions: 0,
        authViews: 0,
        authUniqueViewers: 0,
        guestImpressions: 0,
        guestViews: 0,
        guestUniqueViewers: 0,
      };
      const dBucket: BucketCounter = daily[dayKey] || {
        impressions: 0,
        views: 0,
        uniqueViewers: 0,
        authImpressions: 0,
        authViews: 0,
        authUniqueViewers: 0,
        guestImpressions: 0,
        guestViews: 0,
        guestUniqueViewers: 0,
      };

      const isAuthViewer = viewerType === 'auth';
      let impressions = Number(existingDoc.impressions) || 0;
      let views = Number(existingDoc.views) || 0;
      let uniqueViewers = Number(existingDoc.uniqueViewers) || 0;
      let authImpressions = Number(existingDoc.authImpressions) || 0;
      let authViews = Number(existingDoc.authViews) || 0;
      let authUniqueViewers = Number(existingDoc.authUniqueViewers) || 0;
      let guestImpressions = Number(existingDoc.guestImpressions) || 0;
      let guestViews = Number(existingDoc.guestViews) || 0;
      let guestUniqueViewers = Number(existingDoc.guestUniqueViewers) || 0;
      let uniqueIncremented = false;

      if (eventType === 'impression') {
        impressions += 1;
        hBucket.impressions += 1;
        dBucket.impressions += 1;
        if (isAuthViewer) {
          authImpressions += 1;
          hBucket.authImpressions = (Number(hBucket.authImpressions) || 0) + 1;
          dBucket.authImpressions = (Number(dBucket.authImpressions) || 0) + 1;
        } else {
          guestImpressions += 1;
          hBucket.guestImpressions = (Number(hBucket.guestImpressions) || 0) + 1;
          dBucket.guestImpressions = (Number(dBucket.guestImpressions) || 0) + 1;
        }
        viewerData.firstImpressionAt = viewerData.firstImpressionAt || nowMs;
        viewerData.lastImpressionAt = nowMs;
      } else {
        views += 1;
        hBucket.views += 1;
        dBucket.views += 1;
        if (isAuthViewer) {
          authViews += 1;
          hBucket.authViews = (Number(hBucket.authViews) || 0) + 1;
          dBucket.authViews = (Number(dBucket.authViews) || 0) + 1;
        } else {
          guestViews += 1;
          hBucket.guestViews = (Number(hBucket.guestViews) || 0) + 1;
          dBucket.guestViews = (Number(dBucket.guestViews) || 0) + 1;
        }
        if (!viewerData.firstViewedAt) {
          uniqueViewers += 1;
          hBucket.uniqueViewers += 1;
          dBucket.uniqueViewers += 1;
          if (isAuthViewer) {
            authUniqueViewers += 1;
            hBucket.authUniqueViewers = (Number(hBucket.authUniqueViewers) || 0) + 1;
            dBucket.authUniqueViewers = (Number(dBucket.authUniqueViewers) || 0) + 1;
          } else {
            guestUniqueViewers += 1;
            hBucket.guestUniqueViewers = (Number(hBucket.guestUniqueViewers) || 0) + 1;
            dBucket.guestUniqueViewers = (Number(dBucket.guestUniqueViewers) || 0) + 1;
          }
          viewerData.firstViewedAt = nowMs;
          uniqueIncremented = true;
        }
        viewerData.lastViewAt = nowMs;
      }

      hourly[hourKey] = hBucket;
      daily[dayKey] = dBucket;

      const breakdownSince =
        typeof existingDoc.breakdownSince === 'number' && Number.isFinite(existingDoc.breakdownSince)
          ? existingDoc.breakdownSince
          : nowMs;

      const optedOut = Boolean(sellerLocation.optedOut ?? existingDoc.optedOut);
      const normalizedListingType = inferListingType(listing.category, listing.listingType);
      const nextAnalyticsDoc: RawListingAnalyticsDoc = {
        listingId: listing.id,
        sellerId: listing.sellerId,
        title: listing.title,
        ...(listing.titleGe ? { titleGe: listing.titleGe } : {}),
        category: listing.category,
        listingType: normalizedListingType,
        ...(listing.image ? { image: listing.image } : {}),
        status: listing.status || 'active',
        sellerName: listing.sellerName || 'Proton Vendor',
        ...(loc.country ? { country: loc.country } : {}),
        ...(loc.region ? { region: loc.region } : {}),
        optedOut,
        impressions,
        views,
        uniqueViewers,
        authImpressions,
        authViews,
        authUniqueViewers,
        guestImpressions,
        guestViews,
        guestUniqueViewers,
        breakdownSince,
        hourly,
        daily,
        createdAt: Number(existingDoc.createdAt) || nowMs,
        listingCreatedAt: parseTimestampMs(listing.createdAt),
        updatedAt: nowMs,
      };

      tx.set(viewerRef, viewerData, { merge: true });
      tx.set(analyticsRef, nextAnalyticsDoc);

      if (!optedOut && (!listing.status || listing.status === 'active')) {
        tx.set(publicRef, nextAnalyticsDoc);
      } else {
        tx.delete(publicRef);
      }

      return { recorded: true, uniqueIncremented };
    }).then((res: { recorded: boolean; reason?: string; uniqueIncremented: boolean }) => {
      if (res.recorded) {
        this.publicDocsCache = null;
      }
      return res;
    });
  }

  async setSellerCompetitionOptOut(sellerId: string, optedOut: boolean, nowMs: number): Promise<void> {
    const db = await getAdminFirestoreInstance();
    await db
      .collection('seller_competition_prefs')
      .doc(sellerId)
      .set({ optedOut, updatedAt: nowMs }, { merge: true });

    // Also mirror on users/{sellerId} safely if user doc exists
    await db
      .collection('users')
      .doc(sellerId)
      .set({ competitionOptOut: optedOut }, { merge: true });

    // Sync all existing analytics docs owned by seller
    const analyticsSnap = await db
      .collection('listing_analytics')
      .where('sellerId', '==', sellerId)
      .limit(100)
      .get();

    const batch = db.batch();
    for (const d of analyticsSnap.docs) {
      const data = d.data() as RawListingAnalyticsDoc;
      const normalizedType = inferListingType(data.category, data.listingType);
      batch.set(
        d.ref,
        { optedOut, listingType: normalizedType, updatedAt: nowMs },
        { merge: true }
      );
      const pubRef = db.collection('listing_analytics_public').doc(d.id);
      if (optedOut || (data.status && data.status !== 'active')) {
        batch.delete(pubRef);
      } else {
        batch.set(pubRef, {
          ...data,
          listingType: normalizedType,
          optedOut: false,
          updatedAt: nowMs,
        });
      }
    }
    await batch.commit();
    this.publicDocsCache = null;
  }
}

export class MarketAnalyticsService {
  private readonly repo: AnalyticsRepository;
  private readonly explicitSalt?: string;
  // In-memory short burst IP+listing guard to prevent rotating-token spam WITHOUT storing raw IPs in DB
  private readonly ipListingThrottle = new Map<string, number>();

  constructor(repo?: AnalyticsRepository, salt?: string) {
    this.repo = repo || new FirestoreAdminAnalyticsRepository();
    if (typeof salt === 'string' && salt.length > 0) {
      this.explicitSalt = salt;
    }
  }

  private resolveEffectiveSalt(): string {
    if (this.explicitSalt) {
      return this.explicitSalt;
    }

    if (isProductionRuntime()) {
      const prodSalt = (process.env.ANALYTICS_HASH_SALT || '').trim();
      if (
        !prodSalt ||
        prodSalt.length < MIN_ANALYTICS_SALT_LENGTH ||
        prodSalt === DEV_FALLBACK_ANALYTICS_SALT
      ) {
        throw new AnalyticsConfigError(
          'analytics/salt-missing',
          'Server analytics hash salt (ANALYTICS_HASH_SALT) is missing or insufficiently strong for production.'
        );
      }
      return prodSalt;
    }

    const devSalt = (process.env.ANALYTICS_HASH_SALT || process.env.ANALYTICS_SALT || '').trim();
    return devSalt || DEV_FALLBACK_ANALYTICS_SALT;
  }

  computeViewerHash(listingId: string, identityKey: string): string {
    const activeSalt = this.resolveEffectiveSalt();
    return crypto
      .createHmac('sha256', activeSalt)
      .update(`${listingId}:${identityKey}`)
      .digest('hex');
  }

  private checkInMemoryIpGuard(
    clientIp: string | undefined,
    listingId: string,
    eventType: MarketEventType,
    nowMs: number,
    activeSalt: string
  ): boolean {
    if (!clientIp) return true;
    const keyHash = crypto
      .createHmac('sha256', activeSalt)
      .update(`${clientIp}:${listingId}:${eventType}`)
      .digest('hex')
      .slice(0, 24);
    const prev = this.ipListingThrottle.get(keyHash);
    const minGap = eventType === 'impression' ? 15000 : 10000;
    if (prev && nowMs - prev < minGap) {
      return false;
    }
    this.ipListingThrottle.set(keyHash, nowMs);
    if (this.ipListingThrottle.size > 5000) {
      // Prune oldest entries deterministically
      const cutoff = nowMs - 60000;
      for (const [k, ts] of this.ipListingThrottle.entries()) {
        if (ts < cutoff) this.ipListingThrottle.delete(k);
      }
    }
    return true;
  }

  async recordListingEvent(params: {
    listingId: unknown;
    eventType: unknown;
    visitorToken?: unknown;
    verifiedUid?: string | null;
    userAgent?: string | null;
    clientIp?: string;
    nowMs?: number;
  }): Promise<{ status: number; body: Record<string, any> }> {
    const nowMs = params.nowMs ?? Date.now();
    if (isBotUserAgent(params.userAgent)) {
      return { status: 200, body: { recorded: false, reason: 'bot_filtered' } };
    }

    if (!isValidAnalyticsId(params.listingId)) {
      return { status: 400, body: { error: 'Invalid listingId', code: 'analytics/invalid-listing-id' } };
    }

    if (params.eventType !== 'impression' && params.eventType !== 'view') {
      return { status: 400, body: { error: 'Invalid eventType', code: 'analytics/invalid-event-type' } };
    }

    let viewerType: 'auth' | 'guest';
    let identityKey: string;

    if (params.verifiedUid && isValidAnalyticsId(params.verifiedUid)) {
      viewerType = 'auth';
      identityKey = `auth:${params.verifiedUid}`;
    } else {
      if (
        typeof params.visitorToken !== 'string' ||
        params.visitorToken.length < 8 ||
        params.visitorToken.length > 128 ||
        !/^[a-zA-Z0-9_-]+$/.test(params.visitorToken)
      ) {
        return { status: 400, body: { error: 'Valid visitorToken required for guest telemetry', code: 'analytics/invalid-visitor-token' } };
      }
      viewerType = 'guest';
      identityKey = `guest:${params.visitorToken}`;
    }

    let activeSalt: string;
    try {
      activeSalt = this.resolveEffectiveSalt();
    } catch (err: any) {
      if (err instanceof AnalyticsConfigError && err.code === 'analytics/salt-missing') {
        return {
          status: 503,
          body: {
            recorded: false,
            code: 'analytics/salt-missing',
            error: err.message,
          },
        };
      }
      throw err;
    }

    if (!this.checkInMemoryIpGuard(params.clientIp, params.listingId, params.eventType, nowMs, activeSalt)) {
      return { status: 200, body: { recorded: false, reason: 'rate_throttled' } };
    }

    const listing = await this.repo.getListing(params.listingId);
    if (!listing || listing.isDemo || listing.isSeed || listing.isMock || listing.status === 'deleted') {
      return { status: 404, body: { error: 'Listing not found', code: 'analytics/listing-not-found' } };
    }

    // Never count listing owner's own views or impressions
    if (params.verifiedUid && params.verifiedUid === listing.sellerId) {
      return { status: 200, body: { recorded: false, reason: 'owner_excluded' } };
    }

    const sellerLocation = await this.repo.getSellerProfileLocation(listing.sellerId);
    const viewerHash = this.computeViewerHash(listing.id, identityKey);

    const txResult = await this.repo.recordEventTransaction({
      listing,
      sellerLocation,
      viewerHash,
      viewerType,
      eventType: params.eventType,
      nowMs,
    });

    return {
      status: 200,
      body: {
        recorded: txResult.recorded,
        ...(txResult.reason ? { reason: txResult.reason } : {}),
        uniqueIncremented: txResult.uniqueIncremented,
      },
    };
  }

  async getSellerStats(params: {
    verifiedUid: string;
    listingId?: string;
    nowMs?: number;
  }): Promise<{ status: number; body: Record<string, any> }> {
    const nowMs = params.nowMs ?? Date.now();
    const { verifiedUid, listingId } = params;

    if (listingId !== undefined) {
      if (!isValidAnalyticsId(listingId)) {
        return { status: 400, body: { error: 'Invalid listingId', code: 'analytics/invalid-listing-id' } };
      }
      const listing = await this.repo.getListing(listingId);
      if (!listing) {
        return { status: 404, body: { error: 'Listing not found', code: 'analytics/listing-not-found' } };
      }
      if (listing.sellerId !== verifiedUid) {
        return { status: 403, body: { error: 'Forbidden: Only listing owner can read private analytics', code: 'analytics/forbidden' } };
      }

      const rawDoc = await this.repo.getListingAnalyticsDoc(listingId);
      const stats = await this.buildSingleListingStats(listing, rawDoc, nowMs);
      return { status: 200, body: { listing: stats } };
    }

    const [sellerListings, sellerPref, publicDocs, ratingsMap] = await Promise.all([
      this.repo.getSellerListings(verifiedUid),
      this.repo.getSellerProfileLocation(verifiedUid),
      this.repo.getAllPublicAnalyticsDocs().catch((err) => {
        console.error('[MarketAnalytics] Failed to load public docs for seller stats:', err);
        return [] as RawListingAnalyticsDoc[];
      }),
      this.repo.getSellerRatingsMap().catch((err) => {
        console.error('[MarketAnalytics] Failed to load seller ratings for seller stats:', err);
        return {};
      }),
    ]);

    const realListings = sellerListings.filter(
      (l) => !l.isDemo && !l.isSeed && !l.isMock && l.status !== 'deleted'
    );

    const globalRankings = buildRankingsFromPublicDocs({
      docs: publicDocs,
      sellerRatingsMap: ratingsMap,
      scope: 'global',
      period: '30d',
      nowMs,
      limitCount: Math.max(300, publicDocs.length),
    });
    const globalRankMap = new Map(globalRankings.map((r) => [r.listingId, r.rank]));

    const catRankMap = new Map<string, { rank: number; total: number }>();
    const byCat = new Map<string, RankingEntry[]>();
    for (const r of globalRankings) {
      const cat = (r.category || 'other').toLowerCase();
      const arr = byCat.get(cat) || [];
      arr.push(r);
      byCat.set(cat, arr);
    }
    for (const arr of byCat.values()) {
      arr.forEach((r, idx) => catRankMap.set(r.listingId, { rank: idx + 1, total: arr.length }));
    }

    const analyticsDocs = await Promise.all(
      realListings.map((l) => this.repo.getListingAnalyticsDoc(l.id))
    );

    const listingStats: ListingAnalyticsStats[] = realListings.map((listing, idx) => {
      const rawDoc = analyticsDocs[idx];
      const agg = aggregatePeriodFromBuckets(
        rawDoc || { impressions: 0, views: 0, uniqueViewers: 0 },
        nowMs
      );
      const viewerBreakdown = aggregateViewerBreakdownFromDoc(rawDoc, nowMs);
      const catInfo = catRankMap.get(listing.id);
      const achievements = computeListingAchievements({
        curr7d: agg.periods['7d'],
        prev7d: agg.prevPeriods['7d'],
        curr30d: agg.periods['30d'],
        listingCreatedAt: parseTimestampMs(listing.createdAt),
        nowMs,
        categoryRank: catInfo?.rank,
        categoryTotal: catInfo?.total,
        globalRank: globalRankMap.get(listing.id),
      });

      return {
        listingId: listing.id,
        title: listing.title,
        titleGe: listing.titleGe,
        category: listing.category,
        listingType: inferListingType(listing.category, listing.listingType),
        image: listing.image,
        status: listing.status || 'active',
        optedOut: Boolean(sellerPref.optedOut ?? rawDoc?.optedOut),
        createdAt: parseTimestampMs(listing.createdAt),
        updatedAt: rawDoc?.updatedAt || 0,
        periods: agg.periods,
        comparisons: agg.comparisons,
        achievements,
        ...(viewerBreakdown ? { viewerBreakdown } : {}),
      };
    });

    const periodKeys: AnalyticsPeriod[] = ['24h', '7d', '30d', 'all'];
    const periodTotals = {} as Record<AnalyticsPeriod, PeriodMetrics>;
    for (const pk of periodKeys) {
      periodTotals[pk] = sumPeriodMetricsList(listingStats.map((s) => s.periods[pk]));
    }

    const compKeys: Array<'24h' | '7d' | '30d'> = ['24h', '7d', '30d'];
    const periodComparisons = {} as Record<'24h' | '7d' | '30d', PeriodComparison>;
    for (const ck of compKeys) {
      const sumDelta = (field: 'impressionsDelta' | 'viewsDelta' | 'uniqueViewersDelta') =>
        listingStats.reduce((acc, s) => acc + s.comparisons[ck][field], 0);

      const impDelta = sumDelta('impressionsDelta');
      const vDelta = sumDelta('viewsDelta');
      const uDelta = sumDelta('uniqueViewersDelta');
      const currP = periodTotals[ck];
      const prevImp = Math.max(0, currP.impressions - impDelta);
      const prevViews = Math.max(0, currP.views - vDelta);
      const prevUniq = Math.max(0, currP.uniqueViewers - uDelta);
      const prevEng = prevImp > 0 ? Math.min(100, Math.round((prevViews / prevImp) * 1000) / 10) : 0;

      const pct = (c: number, p: number) => (p <= 0 ? (c > 0 ? 100 : null) : Math.round(((c - p) / p) * 1000) / 10);

      periodComparisons[ck] = {
        impressionsDelta: impDelta,
        viewsDelta: vDelta,
        uniqueViewersDelta: uDelta,
        engagementRateDelta: Math.round((currP.engagementRate - prevEng) * 10) / 10,
        impressionsChangePct: pct(currP.impressions, prevImp),
        viewsChangePct: pct(currP.views, prevViews),
        uniqueViewersChangePct: pct(currP.uniqueViewers, prevUniq),
      };
    }

    const earnedAchievements: EarnedAchievementEntry[] = [];
    for (const s of listingStats) {
      for (const badge of s.achievements) {
        earnedAchievements.push({
          id: badge,
          listingId: s.listingId,
          listingTitle: s.title,
          listingTitleGe: s.titleGe,
          category: s.category,
        });
      }
    }

    const overviewBreakdown = sumViewerBreakdownList(listingStats.map((s) => s.viewerBreakdown));

    const overview: SellerAnalyticsOverview = {
      totalImpressions: periodTotals.all.impressions,
      totalViews: periodTotals.all.views,
      totalUniqueViewers: periodTotals.all.uniqueViewers,
      engagementRate: periodTotals.all.engagementRate,
      periodTotals,
      periodComparisons,
      listings: listingStats,
      competitionOptOut: Boolean(sellerPref.optedOut),
      earnedAchievements,
      ...(overviewBreakdown ? { viewerBreakdown: overviewBreakdown } : {}),
    };

    return { status: 200, body: { overview } };
  }

  private async buildSingleListingStats(
    listing: ListingRecordForAnalytics,
    rawDoc: RawListingAnalyticsDoc | null,
    nowMs: number
  ): Promise<ListingAnalyticsStats> {
    const agg = aggregatePeriodFromBuckets(
      rawDoc || { impressions: 0, views: 0, uniqueViewers: 0 },
      nowMs
    );
    const viewerBreakdown = aggregateViewerBreakdownFromDoc(rawDoc, nowMs);
    const achievements = computeListingAchievements({
      curr7d: agg.periods['7d'],
      prev7d: agg.prevPeriods['7d'],
      curr30d: agg.periods['30d'],
      listingCreatedAt: parseTimestampMs(listing.createdAt),
      nowMs,
    });

    return {
      listingId: listing.id,
      title: listing.title,
      titleGe: listing.titleGe,
      category: listing.category,
      listingType: inferListingType(listing.category, listing.listingType),
      image: listing.image,
      status: listing.status || 'active',
      optedOut: Boolean(rawDoc?.optedOut),
      createdAt: parseTimestampMs(listing.createdAt),
      updatedAt: rawDoc?.updatedAt || 0,
      periods: agg.periods,
      comparisons: agg.comparisons,
      achievements,
      ...(viewerBreakdown ? { viewerBreakdown } : {}),
    };
  }

  async getRankings(params: {
    scope?: string;
    period?: string;
    listingType?: string;
    category?: string;
    country?: string;
    region?: string;
    nowMs?: number;
  }): Promise<{ status: number; body: Record<string, any> }> {
    const scope: RankingScope =
      params.scope === 'country' ||
      params.scope === 'category' ||
      params.scope === 'regional' ||
      params.scope === 'listingType'
        ? params.scope
        : 'global';

    const period: RankingPeriod = params.period === '30d' ? '30d' : '7d';
    const listingType = normalizeListingTypeFilter(params.listingType);
    const nowMs = params.nowMs ?? Date.now();

    const [publicScan, ratingsScan] = await Promise.all([
      this.repo.getAllPublicAnalyticsDocsWithMeta
        ? this.repo.getAllPublicAnalyticsDocsWithMeta()
        : this.repo.getAllPublicAnalyticsDocs().then((docs) => ({ docs, truncated: false as const })),
      this.repo.getSellerRatingsMapWithMeta
        ? this.repo.getSellerRatingsMapWithMeta()
        : this.repo.getSellerRatingsMap()
            .then((ratings) => ({ ratings, truncated: false as const }))
            .catch((err) => {
              console.error('[MarketAnalytics] Failed to load seller ratings map for rankings:', err);
              return { ratings: {}, truncated: true as const, truncationReason: 'ratings_read_failed' };
            }),
    ]);

    const publicDocs = publicScan.docs;
    const sellerRatingsMap = ratingsScan.ratings;
    const warnings: string[] = [];
    if (publicScan.truncated) {
      warnings.push(publicScan.truncationReason || 'public_docs_truncated');
    }
    if (ratingsScan.truncated) {
      warnings.push(ratingsScan.truncationReason || 'seller_ratings_truncated');
    }
    const isPartialData = warnings.length > 0;
    if (isPartialData) {
      console.error('[MarketAnalytics] Rankings computed on partial data:', warnings.join(', '));
    }

    const rankings = buildRankingsFromPublicDocs({
      docs: publicDocs,
      sellerRatingsMap,
      scope,
      period,
      listingType,
      category: params.category,
      country: params.country,
      region: params.region,
      nowMs,
    });

    // Collect reliable available countries/regions present in public rankings
    const availableCountries = Array.from(
      new Set(publicDocs.filter((d) => !d.optedOut && d.country).map((d) => d.country as string))
    ).sort();
    const availableRegions = Array.from(
      new Set(publicDocs.filter((d) => !d.optedOut && d.region).map((d) => d.region as string))
    ).sort();

    return {
      status: 200,
      body: {
        scope,
        period,
        listingType,
        rankings,
        availableCountries,
        availableRegions,
        isPartialData,
        dataCompleteness: {
          isComplete: !isPartialData,
          publicDocsTruncated: publicScan.truncated,
          ratingsTruncated: ratingsScan.truncated,
          warnings,
        },
      },
    };
  }

  async updateCompetitionOptOut(params: {
    verifiedUid: string;
    optedOut: boolean;
    nowMs?: number;
  }): Promise<{ status: number; body: Record<string, any> }> {
    await this.repo.setSellerCompetitionOptOut(
      params.verifiedUid,
      Boolean(params.optedOut),
      params.nowMs ?? Date.now()
    );
    return {
      status: 200,
      body: {
        success: true,
        optedOut: Boolean(params.optedOut),
      },
    };
  }
}

export function isAdminCredentialsError(err: any): boolean {
  if (err instanceof AnalyticsConfigError) return true;
  const code = String(err?.code || '');
  const msg = String(err?.message || err || '');
  return (
    err?.code === 7 ||
    err?.code === 16 ||
    code === 'analytics/admin-credentials-missing' ||
    code === 'analytics/admin-credentials-invalid' ||
    code === 'analytics/salt-missing' ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('Could not load the default credentials') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('Failed to parse private key') ||
    msg.includes('Invalid PEM')
  );
}
