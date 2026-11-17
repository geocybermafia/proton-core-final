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
  ANALYTICS_MAX_LISTINGS_SCAN,
  BucketCounter,
  IMPRESSION_COOLDOWN_MS,
  RawListingAnalyticsDoc,
  VIEW_COOLDOWN_MS,
  aggregatePeriodFromBuckets,
  buildRankingsFromPublicDocs,
  computeListingAchievements,
  getDayBucketKey,
  getHourBucketKey,
  isBotUserAgent,
  isValidAnalyticsId,
  pruneDailyBuckets,
  pruneHourlyBuckets,
  resolveReliableSellerLocation,
  sumPeriodMetricsList,
} from './marketAnalyticsUtils.js';

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

export interface AnalyticsRepository {
  getListing(listingId: string): Promise<ListingRecordForAnalytics | null>;
  getSellerProfileLocation(sellerId: string): Promise<{ country?: string; region?: string; optedOut?: boolean }>;
  getSellerListings(sellerId: string): Promise<ListingRecordForAnalytics[]>;
  getListingAnalyticsDoc(listingId: string): Promise<RawListingAnalyticsDoc | null>;
  getAllPublicAnalyticsDocs(): Promise<RawListingAnalyticsDoc[]>;
  getSellerRatingsMap(): Promise<Record<string, { avg: number; count: number }>>;
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

export class FirestoreAdminAnalyticsRepository implements AnalyticsRepository {
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
      listingType: data.listingType,
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
        listingType: data.listingType,
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

  async getAllPublicAnalyticsDocs(): Promise<RawListingAnalyticsDoc[]> {
    const db = await getAdminFirestoreInstance();
    const snap = await db
      .collection('listing_analytics_public')
      .limit(ANALYTICS_MAX_LISTINGS_SCAN)
      .get();
    return snap.docs.map((d: any) => d.data() as RawListingAnalyticsDoc);
  }

  async getSellerRatingsMap(): Promise<Record<string, { avg: number; count: number }>> {
    const db = await getAdminFirestoreInstance();
    const snap = await db.collection('seller_reviews').limit(500).get();
    const agg: Record<string, { sum: number; count: number }> = {};
    snap.docs.forEach((d: any) => {
      const r = d.data() || {};
      if (r.sellerId && typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5) {
        if (!agg[r.sellerId]) agg[r.sellerId] = { sum: 0, count: 0 };
        agg[r.sellerId].sum += r.rating;
        agg[r.sellerId].count += 1;
      }
    });
    const out: Record<string, { avg: number; count: number }> = {};
    for (const [sid, v] of Object.entries(agg)) {
      out[sid] = { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count };
    }
    return out;
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
      };
      const dBucket: BucketCounter = daily[dayKey] || {
        impressions: 0,
        views: 0,
        uniqueViewers: 0,
      };

      let impressions = Number(existingDoc.impressions) || 0;
      let views = Number(existingDoc.views) || 0;
      let uniqueViewers = Number(existingDoc.uniqueViewers) || 0;
      let uniqueIncremented = false;

      if (eventType === 'impression') {
        impressions += 1;
        hBucket.impressions += 1;
        dBucket.impressions += 1;
        viewerData.firstImpressionAt = viewerData.firstImpressionAt || nowMs;
        viewerData.lastImpressionAt = nowMs;
      } else {
        views += 1;
        hBucket.views += 1;
        dBucket.views += 1;
        if (!viewerData.firstViewedAt) {
          uniqueViewers += 1;
          hBucket.uniqueViewers += 1;
          dBucket.uniqueViewers += 1;
          viewerData.firstViewedAt = nowMs;
          uniqueIncremented = true;
        }
        viewerData.lastViewAt = nowMs;
      }

      hourly[hourKey] = hBucket;
      daily[dayKey] = dBucket;

      const optedOut = Boolean(sellerLocation.optedOut ?? existingDoc.optedOut);
      const nextAnalyticsDoc: RawListingAnalyticsDoc = {
        listingId: listing.id,
        sellerId: listing.sellerId,
        title: listing.title,
        ...(listing.titleGe ? { titleGe: listing.titleGe } : {}),
        category: listing.category,
        ...(listing.listingType ? { listingType: listing.listingType } : {}),
        ...(listing.image ? { image: listing.image } : {}),
        status: listing.status || 'active',
        sellerName: listing.sellerName || 'Proton Vendor',
        ...(loc.country ? { country: loc.country } : {}),
        ...(loc.region ? { region: loc.region } : {}),
        optedOut,
        impressions,
        views,
        uniqueViewers,
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
      batch.set(d.ref, { optedOut, updatedAt: nowMs }, { merge: true });
      const pubRef = db.collection('listing_analytics_public').doc(d.id);
      if (optedOut || (data.status && data.status !== 'active')) {
        batch.delete(pubRef);
      } else {
        batch.set(pubRef, { ...data, optedOut: false, updatedAt: nowMs });
      }
    }
    await batch.commit();
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
      this.repo.getAllPublicAnalyticsDocs().catch(() => [] as RawListingAnalyticsDoc[]),
      this.repo.getSellerRatingsMap().catch(() => ({})),
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
      limitCount: 300,
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
        listingType: listing.listingType,
        image: listing.image,
        status: listing.status || 'active',
        optedOut: Boolean(sellerPref.optedOut ?? rawDoc?.optedOut),
        createdAt: parseTimestampMs(listing.createdAt),
        updatedAt: rawDoc?.updatedAt || 0,
        periods: agg.periods,
        comparisons: agg.comparisons,
        achievements,
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
      listingType: listing.listingType,
      image: listing.image,
      status: listing.status || 'active',
      optedOut: Boolean(rawDoc?.optedOut),
      createdAt: parseTimestampMs(listing.createdAt),
      updatedAt: rawDoc?.updatedAt || 0,
      periods: agg.periods,
      comparisons: agg.comparisons,
      achievements,
    };
  }

  async getRankings(params: {
    scope?: string;
    period?: string;
    category?: string;
    country?: string;
    region?: string;
    nowMs?: number;
  }): Promise<{ status: number; body: Record<string, any> }> {
    const scope: RankingScope =
      params.scope === 'country' ||
      params.scope === 'category' ||
      params.scope === 'regional'
        ? params.scope
        : 'global';

    const period: RankingPeriod = params.period === '30d' ? '30d' : '7d';
    const nowMs = params.nowMs ?? Date.now();

    const [publicDocs, sellerRatingsMap] = await Promise.all([
      this.repo.getAllPublicAnalyticsDocs(),
      this.repo.getSellerRatingsMap().catch(() => ({})),
    ]);

    const rankings = buildRankingsFromPublicDocs({
      docs: publicDocs,
      sellerRatingsMap,
      scope,
      period,
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
        rankings,
        availableCountries,
        availableRegions,
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
