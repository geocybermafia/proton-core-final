import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GUEST_SESSION_MAX_LISTING_IDS,
  GUEST_SESSION_MAX_SELLER_IDS,
  GUEST_SESSION_TTL_DAYS,
  GUEST_SESSION_TTL_MS,
  SELLER_ANALYTICS_SCHEMA_VERSION,
  SELLER_DAILY_BUCKET_RETENTION_DAYS,
  SELLER_HOURLY_BUCKET_RETENTION_HOURS,
  buildRankingsFromPublicDocs,
  buildVerifiedFunnelMarkerId,
  computeBalancedScore,
  computeListingAchievements,
  createEmptySellerAnalyticsBucket,
  createEmptySellerAnalyticsDoc,
  evaluateGuestSessionClaim,
  getDayBucketKey,
  getHourBucketKey,
  isGuestSessionExpired,
  isValidHmacDigest,
  mergeGuestSessionActivity,
  normalizeBoundedUniqueIdList,
  normalizeListingTypeFilter,
  pruneSellerDailyBuckets,
  pruneSellerHourlyBuckets,
  sanitizeSellerViewerDoc,
} from '../src/lib/marketAnalyticsUtils.js';
import {
  AnalyticsRepository,
  CursorQueryLike,
  ListingRecordForAnalytics,
  MarketAnalyticsService,
  OPT_OUT_BATCH_CHUNK_SIZE,
  SELLER_SCOPED_CURSOR_MAX_PAGES,
  scanCollectionWithCursor,
} from '../src/lib/analyticsServer.js';
import type {
  GuestSessionClaimResult,
  GuestSessionIndexDoc,
  SellerAnalyticsDoc,
  SellerViewerDoc,
  VerifiedFunnelMarkerDoc,
  VerifiedMarkerClaimResult,
  VerifiedMarkerType,
} from '../src/types.js';

const TEST_SALT = 'proton-phase2b-test-hmac-secret-at-least-32-chars';

class FakeMemoryAnalyticsRepo implements AnalyticsRepository {
  public listings = new Map<string, ListingRecordForAnalytics>();
  public sellerLocations = new Map<string, { country?: string; region?: string; optedOut?: boolean }>();
  public listingAnalytics = new Map<string, any>();
  public sellerAnalytics = new Map<string, SellerAnalyticsDoc>();
  public sellerViewers = new Map<string, SellerViewerDoc>();
  public guestSessions = new Map<string, GuestSessionIndexDoc>();
  public verifiedMarkers = new Map<string, VerifiedFunnelMarkerDoc>();

  public singleListingAnalyticsCalls = 0;
  public sellerMapCalls = 0;
  public publicDocsCalls = 0;
  public ratingsCalls = 0;
  public rankMapsCalls = 0;

  async getListing(listingId: string): Promise<ListingRecordForAnalytics | null> {
    return this.listings.get(listingId) ?? null;
  }

  async getSellerProfileLocation(sellerId: string) {
    return this.sellerLocations.get(sellerId) ?? { optedOut: false };
  }

  async getSellerListings(sellerId: string): Promise<ListingRecordForAnalytics[]> {
    return Array.from(this.listings.values()).filter((l) => l.sellerId === sellerId);
  }

  async getSellerListingsWithMeta(sellerId: string) {
    return {
      listings: await this.getSellerListings(sellerId),
      truncated: false,
    };
  }

  async getListingAnalyticsDoc(listingId: string) {
    this.singleListingAnalyticsCalls += 1;
    return this.listingAnalytics.get(listingId) ?? null;
  }

  async getSellerListingAnalyticsMap(sellerId: string) {
    this.sellerMapCalls += 1;
    const docsByListingId = new Map<string, any>();
    for (const [lid, doc] of this.listingAnalytics.entries()) {
      if (doc.sellerId === sellerId) {
        docsByListingId.set(lid, doc);
      }
    }
    return { docsByListingId, truncated: false };
  }

  async getAllPublicAnalyticsDocs() {
    this.publicDocsCalls += 1;
    return [];
  }

  async getSellerRatingsMap() {
    this.ratingsCalls += 1;
    return {};
  }

  async getAggregatedRankMaps() {
    this.rankMapsCalls += 1;
    return {
      globalRankMap: new Map<string, number>(),
      catRankMap: new Map<string, { rank: number; total: number }>(),
      truncated: false,
      warnings: [],
    };
  }

  async recordEventTransaction() {
    return { recorded: true, uniqueIncremented: true };
  }

  async setSellerCompetitionOptOut(sellerId: string, optedOut: boolean, nowMs: number) {
    const prev = this.sellerLocations.get(sellerId) || {};
    this.sellerLocations.set(sellerId, { ...prev, optedOut });
    const existing = this.sellerAnalytics.get(sellerId);
    if (existing) {
      this.sellerAnalytics.set(sellerId, { ...existing, optedOut, updatedAt: nowMs });
    }
  }

  async getSellerAnalyticsDoc(sellerId: string) {
    return this.sellerAnalytics.get(sellerId) ?? null;
  }

  async ensureSellerAnalyticsDoc(params: {
    sellerId: string;
    optedOut?: boolean;
    sellerName?: string;
    country?: string;
    region?: string;
    nowMs?: number;
  }): Promise<SellerAnalyticsDoc> {
    const existing = this.sellerAnalytics.get(params.sellerId);
    if (existing) return existing;
    const created = createEmptySellerAnalyticsDoc(params);
    this.sellerAnalytics.set(params.sellerId, created);
    return created;
  }

  async getSellerViewerDoc(sellerId: string, viewerHash: string) {
    return this.sellerViewers.get(`${sellerId}:${viewerHash}`) ?? null;
  }

  async upsertSellerViewerDoc(sellerId: string, viewerDoc: SellerViewerDoc) {
    const clean = sanitizeSellerViewerDoc(viewerDoc as any);
    this.sellerViewers.set(`${sellerId}:${clean.viewerHash}`, clean);
    return clean;
  }

  async getGuestSessionIndex(guestHash: string) {
    return this.guestSessions.get(guestHash) ?? null;
  }

  async recordGuestSessionActivity(params: {
    guestHash: string;
    listingId?: string;
    sellerId?: string;
    nowMs?: number;
  }) {
    const next = mergeGuestSessionActivity(this.guestSessions.get(params.guestHash), params);
    this.guestSessions.set(params.guestHash, next);
    return next;
  }

  async claimGuestSession(params: {
    guestHash: string;
    uid: string;
    nowMs?: number;
  }): Promise<GuestSessionClaimResult> {
    const existing = this.guestSessions.get(params.guestHash) ?? null;
    const evaluation = evaluateGuestSessionClaim(existing, {
      uid: params.uid,
      nowMs: params.nowMs,
    });
    if (evaluation.claimed && !evaluation.idempotent && evaluation.nextDoc) {
      this.guestSessions.set(params.guestHash, evaluation.nextDoc);
    }
    const { nextDoc: _unused, ...result } = evaluation;
    return result;
  }

  async getVerifiedFunnelMarker(markerId: string) {
    return this.verifiedMarkers.get(markerId) ?? null;
  }

  async claimVerifiedFunnelMarker(params: {
    markerType: VerifiedMarkerType;
    sourceId: string;
    sellerId: string;
    buyerHash: string;
    listingId?: string;
    nowMs?: number;
  }): Promise<VerifiedMarkerClaimResult> {
    const markerId = buildVerifiedFunnelMarkerId(params.markerType, params.sourceId);
    if (this.verifiedMarkers.has(markerId)) {
      return { created: false, duplicate: true, markerId };
    }
    this.verifiedMarkers.set(markerId, {
      markerId,
      markerType: params.markerType,
      sellerId: params.sellerId,
      buyerHash: params.buyerHash,
      sourceId: params.sourceId,
      ...(params.listingId ? { listingId: params.listingId } : {}),
      recordedAt: params.nowMs ?? Date.now(),
    });
    return { created: true, duplicate: false, markerId };
  }
}

class FakeCursorCollection implements CursorQueryLike {
  private readonly docs: Array<{ id: string; data: () => any }>;
  private readonly startAfterId: string | null;
  private readonly limitCount: number | null;
  public pageCalls = 0;

  constructor(
    items: Array<{ id: string; data: Record<string, any> }>,
    startAfterId: string | null = null,
    limitCount: number | null = null,
    onPageCall?: () => void
  ) {
    const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.docs = sorted.map((it) => ({ id: it.id, data: () => ({ ...it.data }) }));
    this.startAfterId = startAfterId;
    this.limitCount = limitCount;
    this._onPageCall = onPageCall;
  }

  private readonly _onPageCall?: () => void;

  orderBy(_fieldPath: any): CursorQueryLike {
    return this;
  }

  limit(limit: number): CursorQueryLike {
    return new FakeCursorCollection(
      this.docs.map((d) => ({ id: d.id, data: d.data() })),
      this.startAfterId,
      limit,
      this._onPageCall
    );
  }

  startAfter(snapshot: any): CursorQueryLike {
    return new FakeCursorCollection(
      this.docs.map((d) => ({ id: d.id, data: d.data() })),
      snapshot?.id ?? null,
      this.limitCount,
      this._onPageCall
    );
  }

  async get() {
    this.pageCalls += 1;
    if (this._onPageCall) this._onPageCall();
    let filtered = this.docs;
    if (this.startAfterId !== null) {
      const idx = filtered.findIndex((d) => d.id === this.startAfterId);
      filtered = idx >= 0 ? filtered.slice(idx + 1) : [];
    }
    if (this.limitCount !== null) {
      filtered = filtered.slice(0, this.limitCount);
    }
    return { docs: filtered };
  }
}

function simulatePhase2bFirestoreRules(params: {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  existingDoc?: Record<string, any> | null;
}): { allowed: boolean; reason: string } {
  const isValidId = (id: string) =>
    typeof id === 'string' && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
  const isSignedIn = params.authUid !== null;
  const isOwner = (userId: string) => isSignedIn && params.authUid === userId;

  const segments = params.path.replace(/^\/+/, '').split('/');
  if (segments[0] === 'seller_analytics' && segments.length === 2) {
    const sellerId = segments[1];
    if (params.operation === 'get') {
      const ok =
        isOwner(sellerId) &&
        isValidId(sellerId) &&
        (params.existingDoc == null || params.existingDoc.sellerId === params.authUid);
      return { allowed: ok, reason: ok ? 'owner_get_allowed' : 'non_owner_or_invalid_denied' };
    }
    return { allowed: false, reason: 'seller_analytics_list_write_denied' };
  }

  if (segments[0] === 'seller_analytics' && segments.length === 4 && segments[2] === 'viewers') {
    return { allowed: false, reason: 'seller_viewers_client_denied' };
  }

  if (segments[0] === 'analytics_guest_sessions') {
    return { allowed: false, reason: 'guest_sessions_client_denied' };
  }

  if (segments[0] === 'analytics_verified_markers') {
    return { allowed: false, reason: 'verified_markers_client_denied' };
  }

  return { allowed: false, reason: 'default_deny' };
}

describe('PROTON Market Hub — Phase 2B: Seller Analytics Data Foundation & Firestore Security', () => {
  it('1. seller_analytics/{sellerId} initializes with zero history, full metadata, audience/funnel/totals counters, and 62d/52h rolling pruning', () => {
    const now = Date.UTC(2026, 5, 15, 14, 0, 0);
    const doc = createEmptySellerAnalyticsDoc({
      sellerId: 'seller_abc_1',
      optedOut: false,
      sellerName: 'Proton Craft Studio',
      country: 'Georgia',
      region: 'Tbilisi',
      nowMs: now,
    });

    assert.equal(doc.sellerId, 'seller_abc_1');
    assert.equal(doc.metadata?.schemaVersion, SELLER_ANALYTICS_SCHEMA_VERSION);
    assert.equal(doc.metadata?.sellerName, 'Proton Craft Studio');
    assert.equal(doc.optedOut, false);
    assert.equal(doc.country, 'Georgia');
    assert.equal(doc.region, 'Tbilisi');
    assert.equal(doc.funnelTrackingSince, now);
    assert.equal(doc.createdAt, now);
    assert.equal(doc.updatedAt, now);

    // Zero fabricated history
    assert.equal(doc.audience?.totalImpressions, 0);
    assert.equal(doc.audience?.totalViews, 0);
    assert.equal(doc.audience?.uniqueViewers, 0);
    assert.equal(doc.audience?.authUniqueViewers, 0);
    assert.equal(doc.audience?.guestUniqueViewers, 0);
    assert.equal(doc.totals?.totalEvents, 0);
    assert.equal(doc.totals?.totalUniqueUsers, 0);
    assert.equal(doc.totals?.authEvents, 0);
    assert.equal(doc.totals?.guestEvents, 0);
    assert.equal(doc.profileViews, 0);
    assert.equal(doc.contactClicks, 0);
    assert.equal(doc.orderIntents, 0);
    assert.equal(doc.contactConfirmed, 0);
    assert.equal(doc.ordersConfirmed, 0);
    assert.equal(doc.guestToAuthLinks, 0);
    assert.deepEqual(doc.hourly, {});
    assert.deepEqual(doc.daily, {});

    // Verify 62-day daily pruning and 52-hour hourly pruning
    assert.equal(SELLER_DAILY_BUCKET_RETENTION_DAYS, 62);
    assert.equal(SELLER_HOURLY_BUCKET_RETENTION_HOURS, 52);

    const oldDayKey = getDayBucketKey(now - 63 * 24 * 60 * 60 * 1000);
    const boundaryDayKey = getDayBucketKey(now - 61 * 24 * 60 * 60 * 1000);
    const todayKey = getDayBucketKey(now);

    const prunedDaily = pruneSellerDailyBuckets(
      {
        [oldDayKey]: { ...createEmptySellerAnalyticsBucket(), profileViews: 99 },
        [boundaryDayKey]: { ...createEmptySellerAnalyticsBucket(), profileViews: 5 },
        [todayKey]: { ...createEmptySellerAnalyticsBucket(), profileViews: 12 },
      },
      now
    );
    assert.equal(oldDayKey in prunedDaily, false);
    assert.equal(prunedDaily[boundaryDayKey].profileViews, 5);
    assert.equal(prunedDaily[todayKey].profileViews, 12);

    const oldHourKey = getHourBucketKey(now - 53 * 60 * 60 * 1000);
    const recentHourKey = getHourBucketKey(now - 2 * 60 * 60 * 1000);
    const prunedHourly = pruneSellerHourlyBuckets(
      {
        [oldHourKey]: { ...createEmptySellerAnalyticsBucket(), contactClicks: 10 },
        [recentHourKey]: { ...createEmptySellerAnalyticsBucket(), contactClicks: 3 },
      },
      now
    );
    assert.equal(oldHourKey in prunedHourly, false);
    assert.equal(prunedHourly[recentHourKey].contactClicks, 3);
  });

  it('2. Server-only HMAC viewer hashing enforces production ANALYTICS_HASH_SALT and strips all raw PII fields', () => {
    const repo = new FakeMemoryAnalyticsRepo();
    const service = new MarketAnalyticsService(repo, TEST_SALT);

    const viewerHashA = service.computeSellerViewerHash('seller_1', 'guest:vst_secret_token');
    const viewerHashB = service.computeSellerViewerHash('seller_2', 'guest:vst_secret_token');
    assert.equal(isValidHmacDigest(viewerHashA), true);
    assert.equal(isValidHmacDigest(viewerHashB), true);
    assert.notEqual(viewerHashA, viewerHashB);
    assert.equal(viewerHashA.includes('vst_secret_token'), false);

    // Zero-PII sanitization strips IP, visitorToken, userAgent, uid, email
    const dirtyInput: any = {
      viewerHash: viewerHashA,
      viewerType: 'guest',
      firstSeenAt: 1000,
      lastSeenAt: 2000,
      firstProfileViewAt: 1500,
      ip: '192.168.1.44',
      clientIp: '10.0.0.1',
      visitorToken: 'vst_secret_token',
      userAgent: 'Mozilla/5.0',
      uid: 'raw_uid_leak',
      email: 'buyer@example.com',
    };
    const sanitized = sanitizeSellerViewerDoc(dirtyInput);
    assert.equal(sanitized.viewerHash, viewerHashA);
    assert.equal(sanitized.viewerType, 'guest');
    assert.equal(sanitized.firstProfileViewAt, 1500);
    assert.equal('ip' in sanitized, false);
    assert.equal('clientIp' in sanitized, false);
    assert.equal('visitorToken' in sanitized, false);
    assert.equal('userAgent' in sanitized, false);
    assert.equal('uid' in sanitized, false);
    assert.equal('email' in sanitized, false);

    // Rejects non-HMAC viewer hashes
    assert.throws(() => sanitizeSellerViewerDoc({ ...dirtyInput, viewerHash: 'plain_raw_id' }));

    // Production runtime refuses missing/short salt
    const prevEnv = process.env.NODE_ENV;
    const prevSalt = process.env.ANALYTICS_HASH_SALT;
    try {
      process.env.NODE_ENV = 'production';
      process.env.ANALYTICS_HASH_SALT = 'short';
      const prodService = new MarketAnalyticsService(repo);
      assert.throws(
        () => prodService.computeSellerViewerHash('seller_1', 'auth:uid_1'),
        /ANALYTICS_HASH_SALT/
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSalt === undefined) delete process.env.ANALYTICS_HASH_SALT;
      else process.env.ANALYTICS_HASH_SALT = prevSalt;
    }
  });

  it('3. analytics_guest_sessions enforces max 50 listingIds, max 30 sellerIds, deduplication, HMAC guestHash, and 30-day TTL', () => {
    const repo = new FakeMemoryAnalyticsRepo();
    const service = new MarketAnalyticsService(repo, TEST_SALT);
    const guestHash = service.computeGuestSessionHash('vst_guest_alpha_12345');
    assert.equal(isValidHmacDigest(guestHash), true);
    assert.equal(GUEST_SESSION_MAX_LISTING_IDS, 50);
    assert.equal(GUEST_SESSION_MAX_SELLER_IDS, 30);
    assert.equal(GUEST_SESSION_TTL_DAYS, 30);

    const now = Date.UTC(2026, 5, 1, 10, 0, 0);
    let session: GuestSessionIndexDoc | null = null;

    // Add 60 unique listings & 40 unique sellers -> strictly capped at 50 / 30
    for (let i = 1; i <= 60; i++) {
      session = mergeGuestSessionActivity(session, {
        guestHash,
        listingId: `listing_${i}`,
        sellerId: i <= 40 ? `seller_${i}` : 'seller_1',
        nowMs: now + i * 1000,
      });
    }
    assert.ok(session);
    assert.equal(session.listingIds.length, 50);
    assert.equal(session.sellerIds.length, 30);
    assert.equal(session.linkedUid, null);
    assert.equal(session.linkedAt, null);
    assert.equal(session.expiresAt, now + 60_000 + GUEST_SESSION_TTL_MS);

    // Deduplication check
    const dedup = normalizeBoundedUniqueIdList(['a', 'b', 'a'], 'b', 50);
    assert.deepEqual(dedup, ['a', 'b']);

    // Expired session treated as expired and reset cleanly on fresh activity
    const afterExpiry = session.expiresAt + 1000;
    assert.equal(isGuestSessionExpired(session, afterExpiry), true);
    const restarted = mergeGuestSessionActivity(session, {
      guestHash,
      listingId: 'fresh_listing',
      sellerId: 'fresh_seller',
      nowMs: afterExpiry,
    });
    assert.deepEqual(restarted.listingIds, ['fresh_listing']);
    assert.deepEqual(restarted.sellerIds, ['fresh_seller']);
    assert.equal(restarted.createdAt, afterExpiry);
  });

  it('4. Single-claim transactional guest session linking is atomic, idempotent for same uid, and returns 409 for different uid', async () => {
    const repo = new FakeMemoryAnalyticsRepo();
    const service = new MarketAnalyticsService(repo, TEST_SALT);
    const visitorToken = 'vst_claim_test_token_999';
    const guestHash = service.computeGuestSessionHash(visitorToken);
    const now = Date.UTC(2026, 5, 10, 12, 0, 0);

    // 1. Missing session -> no_guest_session
    const missingClaim = await service.claimGuestSessionForUser({
      visitorToken,
      uid: 'uid_alice',
      nowMs: now,
    });
    assert.equal(missingClaim.status, 200);
    assert.equal(missingClaim.claimed, false);
    assert.equal(missingClaim.reason, 'no_guest_session');

    // 2. Empty session (0 listings & 0 sellers) -> no_guest_session
    await repo.recordGuestSessionActivity({ guestHash, nowMs: now });
    const emptyClaim = await service.claimGuestSessionForUser({
      visitorToken,
      uid: 'uid_alice',
      nowMs: now + 1000,
    });
    assert.equal(emptyClaim.status, 200);
    assert.equal(emptyClaim.claimed, false);
    assert.equal(emptyClaim.reason, 'no_guest_session');

    // 3. Populate activity -> first claim succeeds
    await repo.recordGuestSessionActivity({
      guestHash,
      listingId: 'lst_1',
      sellerId: 'seller_A',
      nowMs: now + 2000,
    });
    const firstClaim = await service.claimGuestSessionForUser({
      visitorToken,
      uid: 'uid_alice',
      nowMs: now + 3000,
    });
    assert.equal(firstClaim.status, 200);
    assert.equal(firstClaim.claimed, true);
    assert.equal(firstClaim.idempotent, false);
    assert.equal(firstClaim.linkedUid, 'uid_alice');
    assert.deepEqual(firstClaim.listingIds, ['lst_1']);
    assert.deepEqual(firstClaim.sellerIds, ['seller_A']);

    const storedAfterFirst = await repo.getGuestSessionIndex(guestHash);
    assert.equal(storedAfterFirst?.linkedUid, 'uid_alice');
    assert.equal(storedAfterFirst?.linkedAt, now + 3000);

    // 4. Repeat claim by same uid -> idempotent success without mutating linkedAt
    const repeatClaim = await service.claimGuestSessionForUser({
      visitorToken,
      uid: 'uid_alice',
      nowMs: now + 9000,
    });
    assert.equal(repeatClaim.status, 200);
    assert.equal(repeatClaim.claimed, true);
    assert.equal(repeatClaim.idempotent, true);
    const storedAfterRepeat = await repo.getGuestSessionIndex(guestHash);
    assert.equal(storedAfterRepeat?.linkedAt, now + 3000);

    // 5. Claim by different uid -> 409 visitor_already_claimed and linkedUid unchanged
    const hijackClaim = await service.claimGuestSessionForUser({
      visitorToken,
      uid: 'uid_bob',
      nowMs: now + 12000,
    });
    assert.equal(hijackClaim.status, 409);
    assert.equal(hijackClaim.claimed, false);
    assert.equal(hijackClaim.reason, 'visitor_already_claimed');
    const storedAfterHijack = await repo.getGuestSessionIndex(guestHash);
    assert.equal(storedAfterHijack?.linkedUid, 'uid_alice');

    // 6. Expired session -> no_guest_session even before linking
    const expToken = 'vst_expired_token_11111';
    const expHash = service.computeGuestSessionHash(expToken);
    await repo.recordGuestSessionActivity({
      guestHash: expHash,
      listingId: 'lst_old',
      sellerId: 'seller_B',
      nowMs: now,
    });
    const expiredClaim = await service.claimGuestSessionForUser({
      visitorToken: expToken,
      uid: 'uid_charlie',
      nowMs: now + GUEST_SESSION_TTL_MS + 1000,
    });
    assert.equal(expiredClaim.status, 200);
    assert.equal(expiredClaim.claimed, false);
    assert.equal(expiredClaim.reason, 'no_guest_session');
  });

  it('5. analytics_verified_markers builds deterministic order_*/contact_* IDs and prevents double-counting idempotently', async () => {
    const repo = new FakeMemoryAnalyticsRepo();
    const service = new MarketAnalyticsService(repo, TEST_SALT);
    const now = Date.UTC(2026, 5, 12, 9, 0, 0);

    assert.equal(buildVerifiedFunnelMarkerId('order_confirmed', 'ord_991'), 'order_ord_991');
    assert.equal(buildVerifiedFunnelMarkerId('contact_confirmed', 'conv_445'), 'contact_conv_445');
    assert.throws(() => buildVerifiedFunnelMarkerId('order_confirmed', '../bad/id'));

    const firstOrderClaim = await service.claimVerifiedFunnelMarker({
      markerType: 'order_confirmed',
      sourceId: 'ord_991',
      sellerId: 'seller_Z',
      buyerUid: 'buyer_123',
      listingId: 'listing_77',
      nowMs: now,
    });
    assert.equal(firstOrderClaim.created, true);
    assert.equal(firstOrderClaim.duplicate, false);
    assert.equal(firstOrderClaim.markerId, 'order_ord_991');

    // Second claim for same orderId never creates duplicate
    const secondOrderClaim = await service.claimVerifiedFunnelMarker({
      markerType: 'order_confirmed',
      sourceId: 'ord_991',
      sellerId: 'seller_Z',
      buyerUid: 'buyer_123',
      listingId: 'listing_77',
      nowMs: now + 5000,
    });
    assert.equal(secondOrderClaim.created, false);
    assert.equal(secondOrderClaim.duplicate, true);
    assert.equal(secondOrderClaim.markerId, 'order_ord_991');

    const stored = await repo.getVerifiedFunnelMarker('order_ord_991');
    assert.ok(stored);
    assert.equal(isValidHmacDigest(stored.buyerHash), true);
    assert.equal(stored.buyerHash.includes('buyer_123'), false);
    assert.equal(repo.verifiedMarkers.size, 1);
  });

  it('6. Firestore rules & blueprint enforce private owner-only seller_analytics get and block client reads/writes on internal collections', () => {
    const rulesSrc = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    const blueprint = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
    );

    // Structural rules checks
    assert.ok(rulesSrc.includes('match /seller_analytics/{sellerId}'));
    assert.ok(rulesSrc.includes('match /viewers/{sellerViewerHash}'));
    assert.ok(rulesSrc.includes('match /analytics_guest_sessions/{guestHash}'));
    assert.ok(rulesSrc.includes('match /analytics_verified_markers/{markerId}'));
    assert.equal(rulesSrc.includes('seller_analytics_public'), false);

    // Blueprint checks
    assert.ok(blueprint.entities.SellerAnalytics);
    assert.ok(blueprint.entities.SellerViewerMarker);
    assert.ok(blueprint.entities.AnalyticsGuestSession);
    assert.ok(blueprint.entities.AnalyticsVerifiedMarker);
    assert.ok(blueprint.firestore['/seller_analytics/{sellerId}']);
    assert.ok(blueprint.firestore['/seller_analytics/{sellerId}/viewers/{sellerViewerHash}']);
    assert.ok(blueprint.firestore['/analytics_guest_sessions/{guestHash}']);
    assert.ok(blueprint.firestore['/analytics_verified_markers/{markerId}']);
    assert.equal('/seller_analytics_public/{sellerId}' in blueprint.firestore, false);

    // Stateful rule evaluations
    // Owner get (existing & non-existing doc) -> allowed
    assert.equal(
      simulatePhase2bFirestoreRules({
        path: '/seller_analytics/seller_1',
        operation: 'get',
        authUid: 'seller_1',
        existingDoc: null,
      }).allowed,
      true
    );
    assert.equal(
      simulatePhase2bFirestoreRules({
        path: '/seller_analytics/seller_1',
        operation: 'get',
        authUid: 'seller_1',
        existingDoc: { sellerId: 'seller_1' },
      }).allowed,
      true
    );
    // Non-owner or unauthenticated get -> denied
    assert.equal(
      simulatePhase2bFirestoreRules({
        path: '/seller_analytics/seller_1',
        operation: 'get',
        authUid: 'other_user',
        existingDoc: { sellerId: 'seller_1' },
      }).allowed,
      false
    );
    assert.equal(
      simulatePhase2bFirestoreRules({
        path: '/seller_analytics/seller_1',
        operation: 'get',
        authUid: null,
      }).allowed,
      false
    );
    // Invalid ID -> denied
    assert.equal(
      simulatePhase2bFirestoreRules({
        path: '/seller_analytics/bad.id!',
        operation: 'get',
        authUid: 'bad.id!',
      }).allowed,
      false
    );
    // List & client writes on seller_analytics -> denied even for owner
    for (const op of ['list', 'create', 'update', 'delete'] as const) {
      assert.equal(
        simulatePhase2bFirestoreRules({
          path: op === 'list' ? '/seller_analytics' : '/seller_analytics/seller_1',
          operation: op,
          authUid: 'seller_1',
        }).allowed,
        false
      );
    }
    // Viewers, guest_sessions, verified_markers -> ALL client reads/writes denied
    for (const targetPath of [
      '/seller_analytics/seller_1/viewers/abc123',
      '/analytics_guest_sessions/abc123',
      '/analytics_verified_markers/order_123',
    ]) {
      for (const op of ['get', 'list', 'create', 'update', 'delete'] as const) {
        assert.equal(
          simulatePhase2bFirestoreRules({
            path: targetPath,
            operation: op,
            authUid: 'seller_1',
          }).allowed,
          false
        );
      }
    }
  });

  it('7. Removes .limit(100) caps with cursor pagination (>100 listings), chunked opt-out batches, and N+1-free getSellerStats', async () => {
    // 7a. Ensure zero .limit(100) remains anywhere in src/
    const serverAnalyticsSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/analyticsServer.ts'),
      'utf8'
    );
    assert.equal(serverAnalyticsSrc.includes('.limit(100)'), false);
    assert.ok(OPT_OUT_BATCH_CHUNK_SIZE <= 200);
    assert.ok(SELLER_SCOPED_CURSOR_MAX_PAGES >= 40);

    // 7b. Cursor pagination retrieves >100 docs cleanly without truncation
    const manyDocs = Array.from({ length: 255 }, (_, i) => ({
      id: `doc_${String(i + 1).padStart(4, '0')}`,
      data: { sellerId: 'big_seller', title: `Listing ${i + 1}` },
    }));
    let pageFetches = 0;
    const fakeCollection = new FakeCursorCollection(manyDocs, null, null, () => {
      pageFetches += 1;
    });
    const scan = await scanCollectionWithCursor({
      collectionRef: fakeCollection,
      documentIdField: '__name__',
      batchSize: 100,
      maxPages: 10,
      label: 'test_seller_listings',
    });
    assert.equal(scan.truncated, false);
    assert.equal(scan.items.length, 255);
    assert.equal(pageFetches, 3); // 100 + 100 + 55

    // 7c. getSellerStats handles 250 listings without N+1 single-doc analytics reads and uses aggregated rank map
    const repo = new FakeMemoryAnalyticsRepo();
    const service = new MarketAnalyticsService(repo, TEST_SALT);
    const now = Date.UTC(2026, 5, 18, 12, 0, 0);
    for (let i = 1; i <= 250; i++) {
      const lid = `lst_${i}`;
      repo.listings.set(lid, {
        id: lid,
        sellerId: 'big_seller',
        title: `Item ${i}`,
        category: 'electronics',
        status: 'active',
        createdAt: now - 3 * 24 * 60 * 60 * 1000,
      });
      repo.listingAnalytics.set(lid, {
        listingId: lid,
        sellerId: 'big_seller',
        impressions: 10,
        views: 4,
        uniqueViewers: 3,
      });
    }

    const statsRes = await service.getSellerStats({ verifiedUid: 'big_seller', nowMs: now });
    assert.equal(statsRes.status, 200);
    assert.equal(statsRes.body.overview.listings.length, 250);
    assert.equal(repo.singleListingAnalyticsCalls, 0); // Zero N+1 per-listing reads
    assert.equal(repo.sellerMapCalls, 1);
    assert.equal(repo.rankMapsCalls, 1);
    assert.equal(repo.publicDocsCalls, 0);
    assert.equal(repo.ratingsCalls, 0);

    // 7d. Opted-out seller skips ranking/public/review reads completely and syncs seller_analytics.optedOut
    await service.ensureSellerAnalyticsDoc({ sellerId: 'big_seller', optedOut: false, nowMs: now });
    await service.updateCompetitionOptOut({ verifiedUid: 'big_seller', optedOut: true, nowMs: now + 1000 });
    const syncedDoc = await service.getSellerAnalyticsDoc('big_seller');
    assert.equal(syncedDoc?.optedOut, true);

    repo.rankMapsCalls = 0;
    const optedOutStats = await service.getSellerStats({ verifiedUid: 'big_seller', nowMs: now + 2000 });
    assert.equal(optedOutStats.status, 200);
    assert.equal(repo.rankMapsCalls, 0);
  });

  it('8. Phase 1 scoring, achievements, ListingType normalization, and rankings remain completely unchanged', () => {
    const now = Date.UTC(2026, 5, 10, 12, 0, 0);
    const score = computeBalancedScore({
      impressions: 120,
      views: 45,
      uniqueViewers: 30,
      categoryBaseline: 15,
      sellerRatingAvg: 4.8,
      sellerRatingCount: 5,
      listingCreatedAt: now - 2 * 24 * 60 * 60 * 1000,
      nowMs: now,
    });
    assert.equal(score.engagementRate, 37.5);
    assert.ok(score.balancedScore > 0);

    assert.equal(normalizeListingTypeFilter('service'), 'service');
    assert.equal(normalizeListingTypeFilter('project'), 'project');
    assert.equal(normalizeListingTypeFilter('invalid_val'), 'all');

    const badges = computeListingAchievements({
      curr7d: { impressions: 100, views: 30, uniqueViewers: 25, engagementRate: 30 },
      prev7d: { impressions: 20, views: 5, uniqueViewers: 5, engagementRate: 25 },
      curr30d: { impressions: 150, views: 45, uniqueViewers: 35, engagementRate: 30 },
      listingCreatedAt: now - 3 * 24 * 60 * 60 * 1000,
      nowMs: now,
      categoryRank: 1,
      categoryTotal: 8,
      globalRank: 2,
    });
    assert.ok(badges.includes('global_recognition'));
    assert.ok(badges.includes('top_in_category'));
    assert.ok(badges.includes('popular_listing'));
    assert.ok(badges.includes('rising_listing'));

    const rankings = buildRankingsFromPublicDocs({
      docs: [
        {
          listingId: 'pub_1',
          sellerId: 's1',
          title: 'CNC Service',
          category: 'service',
          listingType: 'service',
          impressions: 50,
          views: 20,
          uniqueViewers: 15,
          createdAt: now - 2 * 24 * 60 * 60 * 1000,
          updatedAt: now,
          daily: {
            [getDayBucketKey(now)]: {
              impressions: 50,
              views: 20,
              uniqueViewers: 15,
            },
          },
        },
      ],
      sellerRatingsMap: {},
      scope: 'listingType',
      listingType: 'service',
      period: '7d',
      nowMs: now,
    });
    assert.equal(rankings.length, 1);
    assert.equal(rankings[0].listingId, 'pub_1');
  });

  it('8b. Existing Phase 1 recordListingEvent impression/view tracking remains completely intact', async () => {
    const repo = new FakeMemoryAnalyticsRepo();
    const service = new MarketAnalyticsService(repo, TEST_SALT);
    repo.listings.set('lst_p1', {
      id: 'lst_p1',
      sellerId: 'seller_p1',
      title: 'Laser Cutter',
      category: 'tools',
      status: 'active',
    });

    const impRes = await service.recordListingEvent({
      listingId: 'lst_p1',
      eventType: 'impression',
      visitorToken: 'vst_p1_guest_token',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      nowMs: 1_700_000_000_000,
    });
    assert.equal(impRes.status, 200);
    assert.equal(impRes.body.recorded, true);

    const viewRes = await service.recordListingEvent({
      listingId: 'lst_p1',
      eventType: 'view',
      verifiedUid: 'buyer_p1',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      nowMs: 1_700_000_001_000,
    });
    assert.equal(viewRes.status, 200);
    assert.equal(viewRes.body.recorded, true);
  });

  it('9. Strict Phase 2B boundary: no link-visitor, seller-event, or verified-funnel-event HTTP routes exposed yet', () => {
    const serverAppSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/serverApp.ts'), 'utf8');
    assert.equal(serverAppSrc.includes('/api/market/link-visitor'), false);
    assert.equal(serverAppSrc.includes('/api/market/seller-event'), false);
    assert.equal(serverAppSrc.includes('/api/market/verified-funnel-event'), false);
    assert.equal(serverAppSrc.includes('seller_analytics_public'), false);
  });
});
