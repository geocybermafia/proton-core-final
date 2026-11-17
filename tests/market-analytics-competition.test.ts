import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  AnalyticsRepository,
  ListingRecordForAnalytics,
  MarketAnalyticsService,
  MarketEventType,
  ViewerMarkerDoc,
} from '../src/lib/analyticsServer.js';
import {
  BucketCounter,
  IMPRESSION_COOLDOWN_MS,
  RawListingAnalyticsDoc,
  VIEW_COOLDOWN_MS,
  aggregatePeriodFromBuckets,
  buildRankingsFromPublicDocs,
  computeBalancedScore,
  computeListingAchievements,
  getDayBucketKey,
  getHourBucketKey,
  pruneDailyBuckets,
  pruneHourlyBuckets,
  resolveReliableSellerLocation,
} from '../src/lib/marketAnalyticsUtils.js';
import { createApiApp } from '../src/serverApp.js';

/**
 * In-memory AnalyticsRepository adhering strictly to the transactional interface
 * used by MarketAnalyticsService & Express routes.
 */
class InMemoryAnalyticsRepository implements AnalyticsRepository {
  public listings = new Map<string, ListingRecordForAnalytics>();
  public sellerProfiles = new Map<string, { country?: string; region?: string; optedOut?: boolean }>();
  public analyticsDocs = new Map<string, RawListingAnalyticsDoc>();
  public publicDocs = new Map<string, RawListingAnalyticsDoc>();
  public viewerMarkers = new Map<string, Map<string, ViewerMarkerDoc>>();
  public sellerRatings: Record<string, { avg: number; count: number }> = {};

  async getListing(listingId: string): Promise<ListingRecordForAnalytics | null> {
    return this.listings.get(listingId) || null;
  }

  async getSellerProfileLocation(sellerId: string) {
    return this.sellerProfiles.get(sellerId) || {};
  }

  async getSellerListings(sellerId: string): Promise<ListingRecordForAnalytics[]> {
    return Array.from(this.listings.values()).filter((l) => l.sellerId === sellerId);
  }

  async getListingAnalyticsDoc(listingId: string): Promise<RawListingAnalyticsDoc | null> {
    return this.analyticsDocs.get(listingId) || null;
  }

  async getAllPublicAnalyticsDocs(): Promise<RawListingAnalyticsDoc[]> {
    return Array.from(this.publicDocs.values());
  }

  async getSellerRatingsMap(): Promise<Record<string, { avg: number; count: number }>> {
    return { ...this.sellerRatings };
  }

  async recordEventTransaction(params: {
    listing: ListingRecordForAnalytics;
    sellerLocation: { country?: string; region?: string; optedOut?: boolean };
    viewerHash: string;
    viewerType: 'auth' | 'guest';
    eventType: MarketEventType;
    nowMs: number;
  }): Promise<{ recorded: boolean; reason?: string; uniqueIncremented: boolean }> {
    const { listing, sellerLocation, viewerHash, viewerType, eventType, nowMs } = params;
    const markers = this.viewerMarkers.get(listing.id) || new Map<string, ViewerMarkerDoc>();
    this.viewerMarkers.set(listing.id, markers);

    const viewerData: ViewerMarkerDoc = markers.get(viewerHash)
      ? { ...markers.get(viewerHash)! }
      : { viewerHash, viewerType };

    if (eventType === 'impression') {
      if (viewerData.lastImpressionAt && nowMs - viewerData.lastImpressionAt < IMPRESSION_COOLDOWN_MS) {
        return { recorded: false, reason: 'impression_cooldown', uniqueIncremented: false };
      }
    } else {
      if (viewerData.lastViewAt && nowMs - viewerData.lastViewAt < VIEW_COOLDOWN_MS) {
        return { recorded: false, reason: 'view_cooldown', uniqueIncremented: false };
      }
    }

    const loc = resolveReliableSellerLocation({
      profileCountry: sellerLocation.country,
      profileRegion: sellerLocation.region,
      listingCountry: listing.country,
      listingCity: listing.city,
    });

    const existing = this.analyticsDocs.get(listing.id);
    const hourKey = getHourBucketKey(nowMs);
    const dayKey = getDayBucketKey(nowMs);
    const hourly = pruneHourlyBuckets(existing?.hourly, nowMs);
    const daily = pruneDailyBuckets(existing?.daily, nowMs);

    const hBucket: BucketCounter = hourly[hourKey]
      ? { ...hourly[hourKey] }
      : { impressions: 0, views: 0, uniqueViewers: 0 };
    const dBucket: BucketCounter = daily[dayKey]
      ? { ...daily[dayKey] }
      : { impressions: 0, views: 0, uniqueViewers: 0 };

    let impressions = existing?.impressions || 0;
    let views = existing?.views || 0;
    let uniqueViewers = existing?.uniqueViewers || 0;
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

    const optedOut = Boolean(sellerLocation.optedOut ?? existing?.optedOut);
    const nextDoc: RawListingAnalyticsDoc = {
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
      createdAt: existing?.createdAt || nowMs,
      listingCreatedAt: typeof listing.createdAt === 'number' ? listing.createdAt : nowMs,
      updatedAt: nowMs,
    };

    markers.set(viewerHash, viewerData);
    this.analyticsDocs.set(listing.id, nextDoc);

    if (!optedOut && (!listing.status || listing.status === 'active')) {
      this.publicDocs.set(listing.id, nextDoc);
    } else {
      this.publicDocs.delete(listing.id);
    }

    return { recorded: true, uniqueIncremented };
  }

  async setSellerCompetitionOptOut(sellerId: string, optedOut: boolean, nowMs: number): Promise<void> {
    const existingPref = this.sellerProfiles.get(sellerId) || {};
    this.sellerProfiles.set(sellerId, { ...existingPref, optedOut });

    for (const [lid, doc] of this.analyticsDocs.entries()) {
      if (doc.sellerId === sellerId) {
        const updated = { ...doc, optedOut, updatedAt: nowMs };
        this.analyticsDocs.set(lid, updated);
        if (optedOut || (doc.status && doc.status !== 'active')) {
          this.publicDocs.delete(lid);
        } else {
          this.publicDocs.set(lid, updated);
        }
      }
    }
  }
}

async function httpJsonRequest(
  serverUrl: string,
  method: 'GET' | 'POST',
  path: string,
  options?: { headers?: Record<string, string>; body?: any }
): Promise<{ status: number; body: any; rawText: string }> {
  const url = new URL(path, serverUrl);
  const payload = options?.body !== undefined ? JSON.stringify(options.body) : undefined;
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(options?.headers || {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const rawText = Buffer.concat(chunks).toString('utf8');
          let parsed: any = null;
          try {
            parsed = JSON.parse(rawText);
          } catch {
            parsed = rawText;
          }
          resolve({ status: res.statusCode || 0, body: parsed, rawText });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('PROTON Market Hub — Analytics & Healthy Competition System', () => {
  it('1. Tracks real Impressions, Views, and deduplicated Unique Viewers starting from 0', async () => {
    const repo = new InMemoryAnalyticsRepository();
    const now = Date.UTC(2026, 4, 15, 12, 0, 0);
    repo.listings.set('listing_backpack_1', {
      id: 'listing_backpack_1',
      sellerId: 'seller_nino',
      sellerName: 'Nino',
      title: 'Nino Tactical Backpack',
      titleGe: 'ნინოს ზურგჩანთა',
      category: 'fashion',
      listingType: 'product',
      status: 'active',
      country: 'GEO',
      city: 'Tbilisi',
      createdAt: now - 3 * 24 * 60 * 60 * 1000,
    });

    const service = new MarketAnalyticsService(repo, 'test-secret-salt');

    // Initial baseline must be strictly zero
    const initialStats = await service.getSellerStats({
      verifiedUid: 'seller_nino',
      listingId: 'listing_backpack_1',
      nowMs: now,
    });
    assert.equal(initialStats.status, 200);
    assert.deepEqual(initialStats.body.listing.periods.all, {
      impressions: 0,
      views: 0,
      uniqueViewers: 0,
      engagementRate: 0,
    });

    // Guest 1 sees card (impression) then opens details (view)
    const g1Imp = await service.recordListingEvent({
      listingId: 'listing_backpack_1',
      eventType: 'impression',
      visitorToken: 'vst_guest_browser_0001',
      userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
      clientIp: '198.51.100.10',
      nowMs: now,
    });
    assert.equal(g1Imp.body.recorded, true);
    assert.equal(g1Imp.body.uniqueIncremented, false);

    const g1View = await service.recordListingEvent({
      listingId: 'listing_backpack_1',
      eventType: 'view',
      visitorToken: 'vst_guest_browser_0001',
      userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
      clientIp: '198.51.100.10',
      nowMs: now + 1000,
    });
    assert.equal(g1View.body.recorded, true);
    assert.equal(g1View.body.uniqueIncremented, true);

    // Same guest views again within 5 min cooldown -> blocked!
    const g1SpamView = await service.recordListingEvent({
      listingId: 'listing_backpack_1',
      eventType: 'view',
      visitorToken: 'vst_guest_browser_0001',
      userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
      clientIp: '198.51.100.10',
      nowMs: now + 60_000,
    });
    assert.equal(g1SpamView.body.recorded, false);
    assert.equal(g1SpamView.body.reason, 'view_cooldown');

    // Same guest views again AFTER cooldown (6 min later) -> views increments to 2, uniqueViewers stays 1!
    const g1Revisit = await service.recordListingEvent({
      listingId: 'listing_backpack_1',
      eventType: 'view',
      visitorToken: 'vst_guest_browser_0001',
      userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
      clientIp: '198.51.100.10',
      nowMs: now + 6 * 60_000,
    });
    assert.equal(g1Revisit.body.recorded, true);
    assert.equal(g1Revisit.body.uniqueIncremented, false);

    // Signed-in Buyer 2 views from different user account -> uniqueViewers becomes 2
    const authView = await service.recordListingEvent({
      listingId: 'listing_backpack_1',
      eventType: 'view',
      verifiedUid: 'buyer_giorgi',
      userAgent: 'Mozilla/5.0 Safari/605.1.15',
      clientIp: '198.51.100.20',
      nowMs: now + 7 * 60_000,
    });
    assert.equal(authView.body.recorded, true);
    assert.equal(authView.body.uniqueIncremented, true);

    const statsAfter = await service.getSellerStats({
      verifiedUid: 'seller_nino',
      listingId: 'listing_backpack_1',
      nowMs: now + 8 * 60_000,
    });
    assert.equal(statsAfter.body.listing.periods.all.impressions, 1);
    assert.equal(statsAfter.body.listing.periods.all.views, 3);
    assert.equal(statsAfter.body.listing.periods.all.uniqueViewers, 2);
    assert.equal(statsAfter.body.listing.periods['24h'].uniqueViewers, 2);
  });

  it('2. Excludes owner self-views, bot User-Agents, invalid/demo/deleted listings, and does not expose PII', async () => {
    const repo = new InMemoryAnalyticsRepository();
    const now = Date.UTC(2026, 4, 15, 12, 0, 0);
    repo.listings.set('real_1', {
      id: 'real_1',
      sellerId: 'owner_1',
      title: 'Oscilloscope',
      category: 'electronics',
      status: 'active',
      createdAt: now,
    });
    repo.listings.set('deleted_1', {
      id: 'deleted_1',
      sellerId: 'owner_1',
      title: 'Deleted Drill',
      category: 'tools',
      status: 'deleted',
      createdAt: now,
    });
    repo.listings.set('demo_1', {
      id: 'demo_1',
      sellerId: 'owner_1',
      title: 'Demo Item',
      category: 'tools',
      status: 'active',
      isDemo: true,
      createdAt: now,
    });

    const service = new MarketAnalyticsService(repo, 'test-secret-salt');

    // Owner self-view -> excluded
    const selfRes = await service.recordListingEvent({
      listingId: 'real_1',
      eventType: 'view',
      verifiedUid: 'owner_1',
      userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
      nowMs: now,
    });
    assert.equal(selfRes.body.recorded, false);
    assert.equal(selfRes.body.reason, 'owner_excluded');

    // Bot user-agent -> filtered
    const botRes = await service.recordListingEvent({
      listingId: 'real_1',
      eventType: 'view',
      visitorToken: 'vst_bot_123456',
      userAgent: 'HeadlessChrome/125.0 Playwright/1.44',
      nowMs: now,
    });
    assert.equal(botRes.body.recorded, false);
    assert.equal(botRes.body.reason, 'bot_filtered');

    // Deleted, demo, nonexistent listings -> 404
    for (const badId of ['deleted_1', 'demo_1', 'nonexistent_listing_xyz']) {
      const badRes = await service.recordListingEvent({
        listingId: badId,
        eventType: 'view',
        visitorToken: 'vst_human_999999',
        userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
        nowMs: now,
      });
      assert.equal(badRes.status, 404);
    }

    // Valid buyer view stores ONLY salted hash, no raw UID or IP
    await service.recordListingEvent({
      listingId: 'real_1',
      eventType: 'view',
      verifiedUid: 'secret_buyer_uid_42',
      userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
      clientIp: '203.0.113.77',
      nowMs: now + 5000,
    });
    const markers = repo.viewerMarkers.get('real_1')!;
    const storedJson = JSON.stringify(Array.from(markers.values()));
    assert.equal(storedJson.includes('secret_buyer_uid_42'), false);
    assert.equal(storedJson.includes('203.0.113.77'), false);
    assert.equal(JSON.stringify(repo.publicDocs.get('real_1')).includes('secret_buyer_uid_42'), false);
  });

  it('3. Enforces Express HTTP authz: only owner reads private stats; stranger gets 403; unauth gets 401', async () => {
    const repo = new InMemoryAnalyticsRepository();
    const now = Date.now();
    repo.listings.set('list_owned', {
      id: 'list_owned',
      sellerId: 'seller_alice',
      sellerName: 'Alice',
      title: 'Server Rack',
      category: 'electronics',
      status: 'active',
      country: 'GEO',
      city: 'Tbilisi',
      createdAt: now - 86_400_000,
    });

    const analyticsService = new MarketAnalyticsService(repo, 'test-salt-http');
    const app = createApiApp({
      analyticsService,
      verifyIdToken: async (token) => {
        if (token === 'token_alice') return { uid: 'seller_alice' };
        if (token === 'token_bob') return { uid: 'stranger_bob' };
        return null;
      },
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // Unauthenticated stats -> 401
      const unauthRes = await httpJsonRequest(baseUrl, 'GET', '/api/market/listing-stats?listingId=list_owned');
      assert.equal(unauthRes.status, 401);

      // Stranger stats -> 403
      const strangerRes = await httpJsonRequest(baseUrl, 'GET', '/api/market/listing-stats?listingId=list_owned', {
        headers: { Authorization: 'Bearer token_bob' },
      });
      assert.equal(strangerRes.status, 403);

      // Record view from Bob via HTTP
      const eventRes = await httpJsonRequest(baseUrl, 'POST', '/api/market/listing-event', {
        headers: { Authorization: 'Bearer token_bob' },
        body: { listingId: 'list_owned', eventType: 'view' },
      });
      assert.equal(eventRes.status, 200);
      assert.equal(eventRes.body.recorded, true);

      // Owner Alice reads stats -> 200 with 1 view & 1 unique viewer, zero PII
      const ownerRes = await httpJsonRequest(baseUrl, 'GET', '/api/market/listing-stats?listingId=list_owned', {
        headers: { Authorization: 'Bearer token_alice' },
      });
      assert.equal(ownerRes.status, 200);
      assert.equal(ownerRes.body.listing.periods.all.views, 1);
      assert.equal(ownerRes.body.listing.periods.all.uniqueViewers, 1);
      assert.equal(ownerRes.rawText.includes('stranger_bob'), false);

      // Public rankings endpoint returns scored list without PII
      const rankRes = await httpJsonRequest(baseUrl, 'GET', '/api/market/rankings?scope=global&period=7d');
      assert.equal(rankRes.status, 200);
      assert.equal(rankRes.body.rankings.length, 1);
      assert.equal(rankRes.body.rankings[0].listingId, 'list_owned');
      assert.equal(rankRes.rawText.includes('seller_alice'), false);

      // Alice toggles opt-out -> immediately hidden from public rankings while private stats stay intact!
      const optOutRes = await httpJsonRequest(baseUrl, 'POST', '/api/market/competition-preference', {
        headers: { Authorization: 'Bearer token_alice' },
        body: { optedOut: true },
      });
      assert.equal(optOutRes.status, 200);
      assert.equal(optOutRes.body.optedOut, true);

      const rankAfterOptOut = await httpJsonRequest(baseUrl, 'GET', '/api/market/rankings?scope=global&period=7d');
      assert.equal(rankAfterOptOut.status, 200);
      assert.equal(rankAfterOptOut.body.rankings.length, 0);

      const ownerStatsAfterOptOut = await httpJsonRequest(baseUrl, 'GET', '/api/market/listing-stats', {
        headers: { Authorization: 'Bearer token_alice' },
      });
      assert.equal(ownerStatsAfterOptOut.status, 200);
      assert.equal(ownerStatsAfterOptOut.body.overview.competitionOptOut, true);
      assert.equal(ownerStatsAfterOptOut.body.overview.totalViews, 1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('4. Period bucketing (24h, 7d, 30d, all) and period-over-period comparisons compute accurately', () => {
    const now = Date.UTC(2026, 4, 20, 14, 0, 0);
    const todayKey = getDayBucketKey(now);
    const tenDaysAgoKey = getDayBucketKey(now - 10 * 24 * 60 * 60 * 1000);
    const currentHourKey = getHourBucketKey(now);
    const prev24HourKey = getHourBucketKey(now - 26 * 60 * 60 * 1000);

    const agg = aggregatePeriodFromBuckets(
      {
        impressions: 150,
        views: 30,
        uniqueViewers: 20,
        hourly: {
          [currentHourKey]: { impressions: 20, views: 5, uniqueViewers: 4 },
          [prev24HourKey]: { impressions: 10, views: 2, uniqueViewers: 2 },
        },
        daily: {
          [todayKey]: { impressions: 50, views: 15, uniqueViewers: 10 },
          [tenDaysAgoKey]: { impressions: 30, views: 6, uniqueViewers: 5 },
        },
      },
      now
    );

    assert.equal(agg.periods['24h'].views, 5);
    assert.equal(agg.comparisons['24h'].viewsDelta, 3);
    assert.equal(agg.periods['7d'].uniqueViewers, 10);
    assert.equal(agg.comparisons['7d'].uniqueViewersDelta, 5); // 10 vs 5 in prev 7d
    assert.equal(agg.periods['30d'].views, 21);
    assert.equal(agg.periods['all'].impressions, 150);
  });

  it('5. Healthy Competition scoring fairness, niche category normalization, freshness boost, and reliable location scopes', () => {
    const now = Date.UTC(2026, 4, 20, 12, 0, 0);
    const todayKey = getDayBucketKey(now);

    // Location strictness check: Online/GLOBAL or empty has NO country/region (no IP guessing)
    const remoteLoc = resolveReliableSellerLocation({
      profileRegion: 'Online',
      listingCountry: 'GLOBAL',
      listingCity: 'Online',
    });
    assert.equal(remoteLoc.country, undefined);
    assert.equal(remoteLoc.region, undefined);

    const tbilisiLoc = resolveReliableSellerLocation({
      profileRegion: 'Tbilisi, GE',
    });
    assert.deepEqual(tbilisiLoc, { country: 'GEO', region: 'Tbilisi' });

    // Bayesian smoothing check: 1 view / 1 impression (100% raw CTR) must NOT beat 40 views / 200 impressions
    const oneHitWonder = computeBalancedScore({
      impressions: 1,
      views: 1,
      uniqueViewers: 1,
      categoryBaseline: 5,
      nowMs: now,
    });
    const sustainedListing = computeBalancedScore({
      impressions: 200,
      views: 40,
      uniqueViewers: 32,
      categoryBaseline: 5,
      sellerRatingAvg: 4.9,
      sellerRatingCount: 6,
      nowMs: now,
    });
    assert.ok(sustainedListing.balancedScore > oneHitWonder.balancedScore);

    // Build scoped rankings across Global / Country / Regional / Category
    const docs: RawListingAnalyticsDoc[] = [
      {
        listingId: 'geo_1',
        sellerId: 's1',
        title: 'Georgian Ceramics',
        category: 'handcrafted',
        country: 'GEO',
        region: 'Tbilisi',
        status: 'active',
        impressions: 120,
        views: 45,
        uniqueViewers: 30,
        daily: { [todayKey]: { impressions: 120, views: 45, uniqueViewers: 30 } },
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
        listingCreatedAt: now - 2 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      },
      {
        listingId: 'global_only_remote',
        sellerId: 's2',
        title: 'Remote Cloud Audit',
        category: 'services',
        status: 'active',
        impressions: 100,
        views: 40,
        uniqueViewers: 28,
        daily: { [todayKey]: { impressions: 100, views: 40, uniqueViewers: 28 } },
        createdAt: now - 20 * 24 * 60 * 60 * 1000,
        listingCreatedAt: now - 20 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      },
    ];

    const globalRanks = buildRankingsFromPublicDocs({
      docs,
      sellerRatingsMap: { s1: { avg: 5.0, count: 4 } },
      scope: 'global',
      period: '7d',
      nowMs: now,
    });
    assert.equal(globalRanks.length, 2);
    assert.equal(globalRanks[0].listingId, 'geo_1');
    assert.ok(globalRanks[0].freshnessBoost > 0);
    assert.equal(globalRanks[1].freshnessBoost, 0);

    // Country scope excludes listing without reliable country
    const countryRanks = buildRankingsFromPublicDocs({
      docs,
      sellerRatingsMap: {},
      scope: 'country',
      country: 'GEO',
      period: '7d',
      nowMs: now,
    });
    assert.equal(countryRanks.length, 1);
    assert.equal(countryRanks[0].listingId, 'geo_1');

    // Achievements only awarded on real qualifying thresholds
    const zeroBadges = computeListingAchievements({
      curr7d: { impressions: 10, views: 2, uniqueViewers: 2, engagementRate: 20 },
      prev7d: { impressions: 0, views: 0, uniqueViewers: 0, engagementRate: 0 },
      curr30d: { impressions: 10, views: 2, uniqueViewers: 2, engagementRate: 20 },
      nowMs: now,
    });
    assert.deepEqual(zeroBadges, []);

    const realBadges = computeListingAchievements({
      curr7d: { impressions: 80, views: 20, uniqueViewers: 15, engagementRate: 25 },
      prev7d: { impressions: 40, views: 8, uniqueViewers: 6, engagementRate: 20 },
      curr30d: { impressions: 220, views: 50, uniqueViewers: 35, engagementRate: 22.7 },
      categoryRank: 1,
      categoryTotal: 5,
      globalRank: 3,
      nowMs: now,
    });
    assert.deepEqual(realBadges, [
      'rising_listing',
      'popular_listing',
      'top_in_category',
      'global_recognition',
    ]);
  });
});
