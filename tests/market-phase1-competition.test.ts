import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  AnalyticsRepository,
  CursorQueryLike,
  ListingRecordForAnalytics,
  MarketAnalyticsService,
  MarketEventType,
  ViewerMarkerDoc,
  scanCollectionWithCursor,
} from '../src/lib/analyticsServer.js';
import {
  inferListingType,
  normalizeCategoryId,
  normalizeExplicitListingType,
} from '../src/lib/listingClassification.js';
import {
  BucketCounter,
  RawListingAnalyticsDoc,
  aggregatePeriodFromBuckets,
  aggregateViewerBreakdownFromDoc,
  buildRankingsFromPublicDocs,
  computeBalancedScore,
  getDayBucketKey,
  getHourBucketKey,
  pruneDailyBuckets,
  pruneHourlyBuckets,
  resolveReliableSellerLocation,
} from '../src/lib/marketAnalyticsUtils.js';
import { createApiApp } from '../src/serverApp.js';

class FakeFirestoreCollectionQuery implements CursorQueryLike {
  private readonly records: Array<{ id: string; data: Record<string, any> }>;
  private readonly sortedById: Array<{ id: string; data: Record<string, any> }>;
  private afterId: string | null = null;
  private limitVal: number | null = null;
  private selectedFields: string[] | null = null;
  private readonly stallAfterId?: string;
  public readonly selectHistory: string[][] = [];

  constructor(
    records: Array<{ id: string; data: Record<string, any> }>,
    options?: { stallAfterId?: string }
  ) {
    this.records = records;
    this.sortedById = [...records].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.stallAfterId = options?.stallAfterId;
  }

  private cloneWith(patch: {
    afterId?: string | null;
    limitVal?: number | null;
    selectedFields?: string[] | null;
  }): FakeFirestoreCollectionQuery {
    const q = new FakeFirestoreCollectionQuery(this.records, { stallAfterId: this.stallAfterId });
    q.afterId = patch.afterId !== undefined ? patch.afterId : this.afterId;
    q.limitVal = patch.limitVal !== undefined ? patch.limitVal : this.limitVal;
    q.selectedFields = patch.selectedFields !== undefined ? patch.selectedFields : this.selectedFields;
    q.selectHistory.push(...this.selectHistory);
    if (patch.selectedFields && patch.selectedFields.length > 0) {
      q.selectHistory.push(patch.selectedFields);
    }
    return q;
  }

  orderBy(_fieldPath: any): CursorQueryLike {
    return this.cloneWith({});
  }

  select(...fields: string[]): CursorQueryLike {
    return this.cloneWith({ selectedFields: fields });
  }

  startAfter(snapshot: { id: string }): CursorQueryLike {
    return this.cloneWith({ afterId: snapshot.id });
  }

  limit(limit: number): CursorQueryLike {
    return this.cloneWith({ limitVal: limit });
  }

  async get(): Promise<{ docs: Array<{ id: string; data: () => any }> }> {
    let slice = this.sortedById;
    if (this.afterId !== null) {
      if (this.stallAfterId && this.afterId === this.stallAfterId) {
        // Simulate a stalled cursor returning the same preceding page ending at stallAfterId
        const idx = slice.findIndex((r) => r.id === this.afterId);
        const startIdx = this.limitVal !== null ? Math.max(0, idx - this.limitVal + 1) : 0;
        slice = idx >= 0 ? slice.slice(startIdx, idx + 1) : [];
      } else {
        const idx = slice.findIndex((r) => r.id > this.afterId!);
        slice = idx >= 0 ? slice.slice(idx) : [];
      }
    }
    if (this.limitVal !== null) {
      slice = slice.slice(0, this.limitVal);
    }
    const fields = this.selectedFields;
    return {
      docs: slice.map((r) => ({
        id: r.id,
        data: () => {
          if (!fields || fields.length === 0) return { ...r.data };
          const projected: Record<string, any> = {};
          for (const f of fields) {
            if (f in r.data) projected[f] = r.data[f];
          }
          return projected;
        },
      })),
    };
  }
}

class Phase1TestRepository implements AnalyticsRepository {
  public listings = new Map<string, ListingRecordForAnalytics>();
  public sellerProfiles = new Map<string, { country?: string; region?: string; optedOut?: boolean }>();
  public analyticsDocs = new Map<string, RawListingAnalyticsDoc>();
  public publicDocs = new Map<string, RawListingAnalyticsDoc>();
  public viewerMarkers = new Map<string, Map<string, ViewerMarkerDoc>>();
  public sellerRatings: Record<string, { avg: number; count: number }> = {};
  public publicTruncated = false;
  public ratingsTruncated = false;

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

  async getAllPublicAnalyticsDocsWithMeta() {
    return {
      docs: Array.from(this.publicDocs.values()),
      truncated: this.publicTruncated,
      ...(this.publicTruncated ? { truncationReason: 'cursor_max_pages_exceeded:200' } : {}),
    };
  }

  async getSellerRatingsMap(): Promise<Record<string, { avg: number; count: number }>> {
    return { ...this.sellerRatings };
  }

  async getSellerRatingsMapWithMeta() {
    return {
      ratings: { ...this.sellerRatings },
      truncated: this.ratingsTruncated,
      ...(this.ratingsTruncated ? { truncationReason: 'cursor_max_pages_exceeded:200' } : {}),
    };
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
      if (viewerData.lastImpressionAt && nowMs - viewerData.lastImpressionAt < 10 * 60 * 1000) {
        return { recorded: false, reason: 'impression_cooldown', uniqueIncremented: false };
      }
    } else {
      if (viewerData.lastViewAt && nowMs - viewerData.lastViewAt < 5 * 60 * 1000) {
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
      : {
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
    const dBucket: BucketCounter = daily[dayKey]
      ? { ...daily[dayKey] }
      : {
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

    const isAuth = viewerType === 'auth';
    let impressions = existing?.impressions || 0;
    let views = existing?.views || 0;
    let uniqueViewers = existing?.uniqueViewers || 0;
    let authImpressions = existing?.authImpressions || 0;
    let authViews = existing?.authViews || 0;
    let authUniqueViewers = existing?.authUniqueViewers || 0;
    let guestImpressions = existing?.guestImpressions || 0;
    let guestViews = existing?.guestViews || 0;
    let guestUniqueViewers = existing?.guestUniqueViewers || 0;
    let uniqueIncremented = false;

    if (eventType === 'impression') {
      impressions += 1;
      hBucket.impressions += 1;
      dBucket.impressions += 1;
      if (isAuth) {
        authImpressions += 1;
        hBucket.authImpressions = (hBucket.authImpressions || 0) + 1;
        dBucket.authImpressions = (dBucket.authImpressions || 0) + 1;
      } else {
        guestImpressions += 1;
        hBucket.guestImpressions = (hBucket.guestImpressions || 0) + 1;
        dBucket.guestImpressions = (dBucket.guestImpressions || 0) + 1;
      }
      viewerData.firstImpressionAt = viewerData.firstImpressionAt || nowMs;
      viewerData.lastImpressionAt = nowMs;
    } else {
      views += 1;
      hBucket.views += 1;
      dBucket.views += 1;
      if (isAuth) {
        authViews += 1;
        hBucket.authViews = (hBucket.authViews || 0) + 1;
        dBucket.authViews = (dBucket.authViews || 0) + 1;
      } else {
        guestViews += 1;
        hBucket.guestViews = (hBucket.guestViews || 0) + 1;
        dBucket.guestViews = (dBucket.guestViews || 0) + 1;
      }
      if (!viewerData.firstViewedAt) {
        uniqueViewers += 1;
        hBucket.uniqueViewers += 1;
        dBucket.uniqueViewers += 1;
        if (isAuth) {
          authUniqueViewers += 1;
          hBucket.authUniqueViewers = (hBucket.authUniqueViewers || 0) + 1;
          dBucket.authUniqueViewers = (dBucket.authUniqueViewers || 0) + 1;
        } else {
          guestUniqueViewers += 1;
          hBucket.guestUniqueViewers = (hBucket.guestUniqueViewers || 0) + 1;
          dBucket.guestUniqueViewers = (dBucket.guestUniqueViewers || 0) + 1;
        }
        viewerData.firstViewedAt = nowMs;
        uniqueIncremented = true;
      }
      viewerData.lastViewAt = nowMs;
    }

    hourly[hourKey] = hBucket;
    daily[dayKey] = dBucket;

    const optedOut = Boolean(sellerLocation.optedOut ?? existing?.optedOut);
    const normalizedType = inferListingType(listing.category, listing.listingType);
    const nextDoc: RawListingAnalyticsDoc = {
      listingId: listing.id,
      sellerId: listing.sellerId,
      title: listing.title,
      ...(listing.titleGe ? { titleGe: listing.titleGe } : {}),
      category: listing.category,
      listingType: normalizedType,
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
      breakdownSince: existing?.breakdownSince ?? nowMs,
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

async function httpGetJson(serverUrl: string, path: string): Promise<{ status: number; body: any; rawText: string }> {
  const url = new URL(path, serverUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET' }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const rawText = Buffer.concat(chunks).toString('utf8');
        let body: any = rawText;
        try {
          body = JSON.parse(rawText);
        } catch {}
        resolve({ status: res.statusCode || 0, body, rawText });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('PROTON Market Hub — Phase 1: Data Hygiene, Scalability & ListingType Competition', () => {
  it('1-4. ListingType normalization covers product/service/project, keeps rent->service, fixes audience-growth->service, and handles legacy missing listingType', () => {
    assert.equal(normalizeCategoryId('  AUDIENCE-GROWTH '), 'audience-growth');
    assert.equal(normalizeExplicitListingType('SERVICE'), 'service');
    assert.equal(normalizeExplicitListingType('invalid_value'), null);

    // 1. All existing ListingTypes
    assert.equal(inferListingType('phones', 'product'), 'product');
    assert.equal(inferListingType('service', 'service'), 'service');
    assert.equal(inferListingType('digital-projects', 'project'), 'project');
    assert.equal(inferListingType('youtube-channels', undefined), 'project');
    assert.equal(inferListingType('project-jobs', undefined), 'project');
    assert.equal(inferListingType('collaboration', undefined), 'project');

    // 2. rent strictly resolves to 'service'
    assert.equal(inferListingType('rent', undefined), 'service');
    assert.equal(inferListingType('rent', 'product'), 'service');

    // 3. audience-growth with legacy listingType: 'project' normalizes to 'service'
    assert.equal(inferListingType('audience-growth', 'project'), 'service');
    assert.equal(inferListingType('audience-growth', undefined), 'service');

    // 4. Legacy listings missing listingType or having legacy categories
    assert.equal(inferListingType('electronics', undefined), 'product');
    assert.equal(inferListingType('services', undefined), 'service');
    assert.equal(inferListingType('other', undefined), 'product');
    assert.equal(inferListingType(undefined, undefined), 'product');
  });

  it('5-10. Cursor pagination scans 300/301/750 listings and 500/501/1200 seller_reviews with zero duplicates, zero drops, boundary accuracy, and safety-cap partial flags', async () => {
    const makeRecords = (count: number, prefix: string, builder: (i: number) => Record<string, any>) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${prefix}_${String(i).padStart(5, '0')}`,
        data: builder(i),
      }));

    // Test 300, 301, 750 listings across batchSize=300 / 250 / 500
    for (const count of [300, 301, 750]) {
      const records = makeRecords(count, 'lst', (i) => ({ listingId: `lst_${i}`, views: i + 1 }));
      const q = new FakeFirestoreCollectionQuery(records);
      const res = await scanCollectionWithCursor({
        collectionRef: q,
        documentIdField: '__name__',
        batchSize: 300,
        maxPages: 50,
        label: `listings_${count}`,
      });
      assert.equal(res.truncated, false);
      assert.equal(res.items.length, count);
      const uniqueIds = new Set(res.items.map((x) => x.id));
      assert.equal(uniqueIds.size, count);
    }

    // Test 500, 501, 1200 seller_reviews with select(['sellerId', 'rating'])
    for (const count of [500, 501, 1200]) {
      const records = makeRecords(count, 'rev', (i) => ({
        sellerId: `seller_${i % 12}`,
        rating: 4 + (i % 2),
        text: 'Private review comment should not be projected',
        buyerId: 'secret_buyer_uid',
      }));
      const q = new FakeFirestoreCollectionQuery(records);
      const res = await scanCollectionWithCursor<{ sellerId: string; rating: number }>({
        collectionRef: q,
        documentIdField: '__name__',
        batchSize: 500,
        maxPages: 50,
        selectFields: ['sellerId', 'rating'],
        label: `reviews_${count}`,
      });
      assert.equal(res.truncated, false);
      assert.equal(res.items.length, count);
      assert.equal(new Set(res.items.map((x) => x.id)).size, count);
      // Verify select projection excluded non-selected fields
      assert.equal('text' in res.items[0].data, false);
      assert.equal('buyerId' in res.items[0].data, false);
      assert.equal(typeof res.items[0].data.rating, 'number');
    }

    // Safety cap test: maxPages exceeded sets truncated=true and never silently returns complete
    const origErr = console.error;
    const loggedErrors: string[] = [];
    console.error = (...args: any[]) => {
      loggedErrors.push(args.map(String).join(' '));
    };
    try {
      const large = makeRecords(50, 'cap', (i) => ({ val: i }));
      const capQ = new FakeFirestoreCollectionQuery(large);
      const capRes = await scanCollectionWithCursor({
        collectionRef: capQ,
        documentIdField: '__name__',
        batchSize: 10,
        maxPages: 3,
        label: 'cap_test',
      });
      assert.equal(capRes.truncated, true);
      assert.equal(capRes.truncationReason, 'cursor_max_pages_exceeded:3');
      assert.equal(capRes.items.length, 30);
      assert.ok(loggedErrors.some((m) => m.includes('Incomplete scan for cap_test')));

      // Stalled cursor loop guard test
      const stalled = makeRecords(20, 'stl', (i) => ({ val: i }));
      const stalledQ = new FakeFirestoreCollectionQuery(stalled, { stallAfterId: 'stl_00004' });
      const stalledRes = await scanCollectionWithCursor({
        collectionRef: stalledQ,
        documentIdField: '__name__',
        batchSize: 5,
        maxPages: 10,
        label: 'stalled_test',
      });
      assert.equal(stalledRes.truncated, true);
      assert.equal(stalledRes.truncationReason, 'cursor_stalled_loop_guard');
      assert.equal(stalledRes.items.length, 5);
    } finally {
      console.error = origErr;
    }

    // Rankings service propagates isPartialData & dataCompleteness when truncated
    const repo = new Phase1TestRepository();
    const now = Date.UTC(2026, 4, 20, 12, 0, 0);
    const todayKey = getDayBucketKey(now);
    repo.publicDocs.set('p1', {
      listingId: 'p1',
      sellerId: 's1',
      title: 'Partial Sample',
      category: 'phones',
      impressions: 20,
      views: 10,
      uniqueViewers: 8,
      daily: { [todayKey]: { impressions: 20, views: 10, uniqueViewers: 8 } },
      createdAt: now,
      updatedAt: now,
    });
    repo.ratingsTruncated = true;

    const svc = new MarketAnalyticsService(repo, 'phase1-salt-secret-value');
    console.error = (...args: any[]) => {
      loggedErrors.push(args.map(String).join(' '));
    };
    try {
      const rankRes = await svc.getRankings({ scope: 'global', period: '7d', nowMs: now });
      assert.equal(rankRes.status, 200);
      assert.equal(rankRes.body.isPartialData, true);
      assert.equal(rankRes.body.dataCompleteness.isComplete, false);
      assert.equal(rankRes.body.dataCompleteness.ratingsTruncated, true);
      assert.equal(rankRes.body.dataCompleteness.publicDocsTruncated, false);
    } finally {
      console.error = origErr;
    }
  });

  it('11-12. Tracks accurate Guest/Auth breakdown without double-counting, leaks zero PII, and never fabricates history for legacy docs', async () => {
    const repo = new Phase1TestRepository();
    const now = Date.UTC(2026, 4, 20, 10, 0, 0);

    // Listing A: new analytics with guest & auth activity
    repo.listings.set('listing_new', {
      id: 'listing_new',
      sellerId: 'seller_1',
      title: 'New Listing',
      category: 'technics',
      status: 'active',
      createdAt: now - 86_400_000,
    });

    // Listing B: legacy analytics doc WITHOUT breakdownSince or auth*/guest* fields
    repo.listings.set('listing_legacy', {
      id: 'listing_legacy',
      sellerId: 'seller_1',
      title: 'Legacy Listing',
      category: 'audience-growth',
      listingType: 'project', // legacy value
      status: 'active',
      createdAt: now - 5 * 86_400_000,
    });
    const todayKey = getDayBucketKey(now);
    repo.analyticsDocs.set('listing_legacy', {
      listingId: 'listing_legacy',
      sellerId: 'seller_1',
      title: 'Legacy Listing',
      category: 'audience-growth',
      listingType: 'project',
      status: 'active',
      impressions: 50,
      views: 15,
      uniqueViewers: 12,
      daily: { [todayKey]: { impressions: 50, views: 15, uniqueViewers: 12 } },
      createdAt: now - 5 * 86_400_000,
      updatedAt: now - 86_400_000,
    });

    // Direct legacy check: must NOT invent auth/guest numbers
    assert.equal(aggregateViewerBreakdownFromDoc(repo.analyticsDocs.get('listing_legacy'), now), undefined);

    const service = new MarketAnalyticsService(repo, 'phase1-test-salt-12345');

    // Guest 1 impression + view + spam view within cooldown + revisit after cooldown
    await service.recordListingEvent({
      listingId: 'listing_new',
      eventType: 'impression',
      visitorToken: 'vst_guest_alpha_1',
      userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
      clientIp: '198.51.100.1',
      nowMs: now,
    });
    await service.recordListingEvent({
      listingId: 'listing_new',
      eventType: 'view',
      visitorToken: 'vst_guest_alpha_1',
      userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
      clientIp: '198.51.100.1',
      nowMs: now + 1000,
    });
    // Cooldown retry -> must NOT increment views or guestUniqueViewers
    await service.recordListingEvent({
      listingId: 'listing_new',
      eventType: 'view',
      visitorToken: 'vst_guest_alpha_1',
      userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
      clientIp: '198.51.100.1',
      nowMs: now + 30_000,
    });
    // Revisit after cooldown -> guestViews becomes 2, guestUniqueViewers stays 1
    await service.recordListingEvent({
      listingId: 'listing_new',
      eventType: 'view',
      visitorToken: 'vst_guest_alpha_1',
      userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
      clientIp: '198.51.100.1',
      nowMs: now + 6 * 60_000,
    });

    // Auth buyer 1 impression + view + second auth buyer view
    await service.recordListingEvent({
      listingId: 'listing_new',
      eventType: 'impression',
      verifiedUid: 'auth_buyer_uid_1',
      userAgent: 'Mozilla/5.0 Safari/605.1.15',
      clientIp: '198.51.100.2',
      nowMs: now + 7 * 60_000,
    });
    await service.recordListingEvent({
      listingId: 'listing_new',
      eventType: 'view',
      verifiedUid: 'auth_buyer_uid_1',
      userAgent: 'Mozilla/5.0 Safari/605.1.15',
      clientIp: '198.51.100.2',
      nowMs: now + 7 * 60_000 + 500,
    });
    await service.recordListingEvent({
      listingId: 'listing_new',
      eventType: 'view',
      verifiedUid: 'auth_buyer_uid_2',
      userAgent: 'Mozilla/5.0 Firefox/126.0',
      clientIp: '198.51.100.3',
      nowMs: now + 8 * 60_000,
    });

    const sellerStats = await service.getSellerStats({
      verifiedUid: 'seller_1',
      nowMs: now + 9 * 60_000,
    });
    assert.equal(sellerStats.status, 200);

    const newStat = sellerStats.body.overview.listings.find((l: any) => l.listingId === 'listing_new');
    const legacyStat = sellerStats.body.overview.listings.find((l: any) => l.listingId === 'listing_legacy');

    assert.ok(newStat);
    assert.deepEqual(newStat.periods.all, {
      impressions: 2,
      views: 4,
      uniqueViewers: 3,
      engagementRate: 100, // Math.min(100, 4/2*100)
    });
    assert.equal(newStat.viewerBreakdown.breakdownSince, now);
    assert.deepEqual(newStat.viewerBreakdown.periods.all, {
      authImpressions: 1,
      authViews: 2,
      authUniqueViewers: 2,
      guestImpressions: 1,
      guestViews: 2,
      guestUniqueViewers: 1,
    });
    assert.deepEqual(newStat.viewerBreakdown.periods['24h'], newStat.viewerBreakdown.periods.all);
    assert.deepEqual(newStat.viewerBreakdown.periods['7d'], newStat.viewerBreakdown.periods.all);

    // Legacy listing keeps its totals & normalized listingType='service', with NO fabricated breakdown
    assert.ok(legacyStat);
    assert.equal(legacyStat.listingType, 'service');
    assert.equal(legacyStat.periods.all.views, 15);
    assert.equal(legacyStat.viewerBreakdown, undefined);

    // Overview sums legacy + new totals accurately, and sums ONLY real recorded breakdowns
    assert.equal(sellerStats.body.overview.totalViews, 19);
    assert.equal(sellerStats.body.overview.viewerBreakdown.periods.all.authUniqueViewers, 2);
    assert.equal(sellerStats.body.overview.viewerBreakdown.periods.all.guestUniqueViewers, 1);

    // Zero PII exposed in stored docs or responses
    const serialized = JSON.stringify({
      stats: sellerStats.body,
      publicDoc: repo.publicDocs.get('listing_new'),
    });
    for (const sensitive of ['vst_guest_alpha_1', 'auth_buyer_uid_1', 'auth_buyer_uid_2', '198.51.100.']) {
      assert.equal(serialized.includes(sensitive), false);
    }
  });

  it('13. Supports all ListingType ranking filters orthogonally across Global, Country, Regional, Category, and HTTP API', async () => {
    const repo = new Phase1TestRepository();
    const now = Date.now();
    const todayKey = getDayBucketKey(now);

    const seedPublic = (doc: Partial<RawListingAnalyticsDoc> & { listingId: string; category: string }) => {
      repo.publicDocs.set(doc.listingId, {
        sellerId: 's_1',
        title: doc.listingId,
        status: 'active',
        impressions: 100,
        views: 40,
        uniqueViewers: 25,
        daily: { [todayKey]: { impressions: 100, views: 40, uniqueViewers: 25 } },
        createdAt: now - 3 * 86_400_000,
        listingCreatedAt: now - 3 * 86_400_000,
        updatedAt: now,
        ...doc,
      });
    };

    // Mix of product, service (including rent + audience-growth legacy 'project'), project, and legacy undefined type
    seedPublic({ listingId: 'prod_geo', category: 'phones', listingType: 'product', country: 'GEO', region: 'Tbilisi', uniqueViewers: 40, views: 60 });
    seedPublic({ listingId: 'prod_legacy_undef', category: 'art', listingType: undefined, country: 'DEU', region: 'Berlin', uniqueViewers: 15, views: 20 });
    seedPublic({ listingId: 'svc_rent_geo', category: 'rent', listingType: undefined, country: 'GEO', region: 'Tbilisi', uniqueViewers: 35, views: 50 });
    seedPublic({ listingId: 'svc_audience_legacy', category: 'audience-growth', listingType: 'project', country: 'USA', region: 'Austin', uniqueViewers: 20, views: 25 });
    seedPublic({ listingId: 'proj_yt_geo', category: 'youtube-channels', listingType: 'project', country: 'GEO', region: 'Batumi', uniqueViewers: 50, views: 70 });

    const service = new MarketAnalyticsService(repo, 'phase1-http-salt-987654');
    const app = createApiApp({ analyticsService: service });
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // Global + services: must return svc_rent_geo (#1) and svc_audience_legacy (#2), sorted 1..2 strictly among services
      const globalServices = await httpGetJson(baseUrl, '/api/market/rankings?scope=global&period=7d&listingType=service');
      assert.equal(globalServices.status, 200);
      assert.deepEqual(
        globalServices.body.rankings.map((r: any) => ({ id: r.listingId, rank: r.rank, type: r.listingType })),
        [
          { id: 'svc_rent_geo', rank: 1, type: 'service' },
          { id: 'svc_audience_legacy', rank: 2, type: 'service' },
        ]
      );

      // Country=GEO + products: only prod_geo (#1)
      const countryProducts = await httpGetJson(baseUrl, '/api/market/rankings?scope=country&country=GEO&period=7d&listingType=product');
      assert.equal(countryProducts.status, 200);
      assert.deepEqual(countryProducts.body.rankings.map((r: any) => r.listingId), ['prod_geo']);
      assert.equal(countryProducts.body.rankings[0].rank, 1);

      // Regional=Tbilisi + services: svc_rent_geo
      const regionalServices = await httpGetJson(baseUrl, '/api/market/rankings?scope=regional&region=Tbilisi&period=7d&listingType=service');
      assert.equal(regionalServices.status, 200);
      assert.deepEqual(regionalServices.body.rankings.map((r: any) => r.listingId), ['svc_rent_geo']);

      // Projects: only proj_yt_geo (legacy audience-growth was reclassified to service, NOT project!)
      const projectsOnly = await httpGetJson(baseUrl, '/api/market/rankings?scope=listingType&period=7d&listingType=project');
      assert.equal(projectsOnly.status, 200);
      assert.deepEqual(projectsOnly.body.rankings.map((r: any) => r.listingId), ['proj_yt_geo']);

      // Category=phones + listingType=service mismatch -> empty
      const mismatch = await httpGetJson(baseUrl, '/api/market/rankings?scope=category&category=phones&period=7d&listingType=service');
      assert.equal(mismatch.status, 200);
      assert.equal(mismatch.body.rankings.length, 0);

      // listingType=all -> includes all 5 ranked 1..5
      const allTypes = await httpGetJson(baseUrl, '/api/market/rankings?scope=global&period=7d&listingType=all');
      assert.equal(allTypes.status, 200);
      assert.equal(allTypes.body.rankings.length, 5);
      assert.deepEqual(allTypes.body.rankings.map((r: any) => r.rank), [1, 2, 3, 4, 5]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('14-15. Golden Score Regression & 100% backward compatibility when listingType is omitted or "all"', () => {
    const now = Date.UTC(2026, 4, 20, 12, 0, 0);
    const todayKey = getDayBucketKey(now);

    // Exact Golden Formula regression vector
    const goldenInput = {
      impressions: 120,
      views: 45,
      uniqueViewers: 30,
      categoryBaseline: 15,
      sellerRatingAvg: 4.8,
      sellerRatingCount: 5,
      listingCreatedAt: now - 2 * 24 * 60 * 60 * 1000,
      nowMs: now,
    };
    const score = computeBalancedScore(goldenInput);
    const expectedRaw =
      Math.log1p(30) * 28 +
      Math.log1p(45) * 8 +
      (45 / 130) * 35 +
      Math.round(Math.log1p((30 + 45 * 0.35) / 15) * 18 * 100) / 100 +
      (4.8 / 5) * 5 * 1.2 +
      Math.round((1 - 2 / 14) * 12 * 100) / 100;
    assert.equal(score.balancedScore, Math.round(expectedRaw * 100) / 100);
    assert.equal(score.engagementRate, 37.5);

    const docs: RawListingAnalyticsDoc[] = [
      {
        listingId: 'gold_1',
        sellerId: 's1',
        title: 'Ceramic Vase',
        category: 'art',
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
        listingId: 'gold_2',
        sellerId: 's2',
        title: 'Dev Service',
        category: 'service',
        status: 'active',
        impressions: 90,
        views: 30,
        uniqueViewers: 22,
        daily: { [todayKey]: { impressions: 90, views: 30, uniqueViewers: 22 } },
        createdAt: now - 20 * 24 * 60 * 60 * 1000,
        listingCreatedAt: now - 20 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      },
    ];

    const omitted = buildRankingsFromPublicDocs({
      docs,
      sellerRatingsMap: { s1: { avg: 4.8, count: 5 } },
      scope: 'global',
      period: '7d',
      nowMs: now,
    });
    const explicitAll = buildRankingsFromPublicDocs({
      docs,
      sellerRatingsMap: { s1: { avg: 4.8, count: 5 } },
      scope: 'global',
      period: '7d',
      listingType: 'all',
      nowMs: now,
    });
    const filteredProduct = buildRankingsFromPublicDocs({
      docs,
      sellerRatingsMap: { s1: { avg: 4.8, count: 5 } },
      scope: 'global',
      period: '7d',
      listingType: 'product',
      nowMs: now,
    });

    assert.deepEqual(omitted, explicitAll);
    // Balanced score of gold_1 must remain identical whether viewed in 'all' or filtered to 'product'
    assert.equal(filteredProduct.length, 1);
    assert.equal(filteredProduct[0].listingId, 'gold_1');
    assert.equal(filteredProduct[0].balancedScore, omitted[0].balancedScore);
  });
});
