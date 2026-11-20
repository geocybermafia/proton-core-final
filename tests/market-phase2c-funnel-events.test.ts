import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  AnalyticsRepository,
  ListingRecordForAnalytics,
  MarketAnalyticsService,
  SellerRecordForAnalytics,
} from '../src/lib/analyticsServer.js';
import {
  computeSellerFunnelTransactionUpdate,
  createEmptySellerAnalyticsDoc,
  getDayBucketKey,
  getHourBucketKey,
} from '../src/lib/marketAnalyticsUtils.js';
import { createApiApp } from '../src/serverApp.js';
import type {
  MarketFunnelEventType,
  SellerAnalyticsDoc,
  SellerViewerDoc,
} from '../src/types.js';

const TEST_SALT = 'proton-phase2c-fix2a-funnel-test-salt-at-least-32-chars';
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';

/**
 * Transactional in-memory repository delegating mutations directly to
 * production `computeSellerFunnelTransactionUpdate` and serializing
 * concurrent transactions per seller to accurately test atomic persistence.
 */
class TransactionalFunnelMemoryRepo implements AnalyticsRepository {
  public sellers = new Map<string, SellerRecordForAnalytics>();
  public listings = new Map<string, ListingRecordForAnalytics>();
  public sellerAnalytics = new Map<string, SellerAnalyticsDoc>();
  public sellerViewers = new Map<string, SellerViewerDoc>();
  public recordFunnelCalls = 0;

  // Per-seller async mutex simulating Firestore transaction isolation & retry
  private txChains = new Map<string, Promise<unknown>>();

  private runSerializedTx<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.txChains.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.txChains.set(key, next.catch(() => undefined));
    return next;
  }

  async getListing(listingId: string): Promise<ListingRecordForAnalytics | null> {
    return this.listings.get(listingId) ?? null;
  }

  async getSellerForAnalytics(sellerId: string): Promise<SellerRecordForAnalytics | null> {
    return this.sellers.get(sellerId) ?? null;
  }

  async getSellerProfileLocation(sellerId: string) {
    const s = this.sellers.get(sellerId);
    return {
      country: s?.country,
      region: s?.region,
      optedOut: s?.optedOut ?? false,
    };
  }

  async getSellerListings(sellerId: string): Promise<ListingRecordForAnalytics[]> {
    return Array.from(this.listings.values()).filter((l) => l.sellerId === sellerId);
  }

  async getListingAnalyticsDoc() {
    return null;
  }

  async getAllPublicAnalyticsDocs() {
    return [];
  }

  async getSellerRatingsMap() {
    return {};
  }

  async recordEventTransaction() {
    return { recorded: true, uniqueIncremented: true };
  }

  async setSellerCompetitionOptOut() {
    return;
  }

  async recordSellerFunnelEvent(params: {
    sellerId: string;
    eventType: MarketFunnelEventType;
    viewerHash: string;
    viewerType: 'auth' | 'guest';
    nowMs?: number;
    listingId?: string;
    sourceId?: string;
    sellerMeta?: {
      optedOut?: boolean;
      sellerName?: string;
      country?: string;
      region?: string;
    };
  }): Promise<{ recorded: boolean; reason?: string }> {
    this.recordFunnelCalls += 1;
    return this.runSerializedTx(params.sellerId, async () => {
      // Introduce micro-yield so concurrent callers interleave unless serialized
      await Promise.resolve();
      const nowMs = params.nowMs ?? Date.now();
      const existingSeller = this.sellerAnalytics.get(params.sellerId) ?? null;
      const viewerKey = `${params.sellerId}:${params.viewerHash}`;
      const existingViewer = this.sellerViewers.get(viewerKey) ?? null;

      const mutation = computeSellerFunnelTransactionUpdate({
        sellerId: params.sellerId,
        eventType: params.eventType,
        viewerHash: params.viewerHash,
        viewerType: params.viewerType,
        existingSeller,
        existingViewer,
        sellerMeta: params.sellerMeta,
        nowMs,
      });

      if (!mutation.recorded || !mutation.nextSellerDoc || !mutation.nextViewerDoc) {
        return { recorded: false, reason: mutation.reason };
      }

      this.sellerViewers.set(viewerKey, mutation.nextViewerDoc);
      this.sellerAnalytics.set(params.sellerId, mutation.nextSellerDoc);
      return { recorded: true };
    });
  }
}

async function withFunnelServer(
  repo: TransactionalFunnelMemoryRepo,
  tokens: Record<string, string>,
  fn: (baseUrl: string, service: MarketAnalyticsService) => Promise<void>
) {
  const service = new MarketAnalyticsService(repo, TEST_SALT);
  const app = createApiApp({
    analyticsService: service,
    verifyIdToken: async (token: string) => {
      const uid = tokens[token];
      return uid ? { uid } : null;
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    await fn(baseUrl, service);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

async function postFunnelEvent(
  baseUrl: string,
  body: Record<string, unknown>,
  options?: { bearerToken?: string }
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': BROWSER_UA,
  };
  if (options?.bearerToken) {
    headers.authorization = `Bearer ${options.bearerToken}`;
  }
  const res = await fetch(`${baseUrl}/api/market/seller-funnel-event`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, any>;
  return { status: res.status, body: json };
}

function seedRealSellerAndListing(
  repo: TransactionalFunnelMemoryRepo,
  sellerId = 'seller_real_1',
  listingId = 'listing_real_1'
) {
  repo.sellers.set(sellerId, {
    id: sellerId,
    exists: true,
    sellerName: 'Proton Seller',
    country: 'Georgia',
    region: 'Tbilisi',
    optedOut: false,
  });
  repo.listings.set(listingId, {
    id: listingId,
    sellerId,
    title: 'Precision Hardware Kit',
    category: 'electronics',
    status: 'active',
  });
}

describe('Phase 2C Fix 2A: Funnel Analytics Data Integrity (4 Non-Confirmed Events)', () => {
  it('1. Non-existent or deleted/demo sellerId is rejected (404) across all 4 events', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    repo.sellers.set('seller_deleted', {
      id: 'seller_deleted',
      exists: true,
      deleted: true,
    });
    repo.sellers.set('seller_demo', {
      id: 'seller_demo',
      exists: true,
      isDemo: true,
    });

    await withFunnelServer(repo, { user_tok: 'buyer_1' }, async (baseUrl) => {
      const events: MarketFunnelEventType[] = [
        'seller_profile_view',
        'listing_to_seller',
        'contact_click',
        'order_intent',
      ];
      for (const ev of events) {
        const res = await postFunnelEvent(
          baseUrl,
          {
            sellerId: 'non_existent_seller_999',
            eventType: ev,
            listingId: 'any_listing',
          },
          { bearerToken: 'user_tok' }
        );
        assert.equal(res.status, 404, `Expected 404 for missing seller on ${ev}`);
        assert.equal(res.body.recorded, false);
        assert.equal(res.body.code, 'analytics/seller-not-found');
      }

      const deletedRes = await postFunnelEvent(baseUrl, {
        sellerId: 'seller_deleted',
        eventType: 'seller_profile_view',
        visitorToken: 'guest_visitor_12345',
      });
      assert.equal(deletedRes.status, 404);
      assert.equal(deletedRes.body.code, 'analytics/seller-not-found');

      const demoRes = await postFunnelEvent(baseUrl, {
        sellerId: 'seller_demo',
        eventType: 'seller_profile_view',
        visitorToken: 'guest_visitor_12345',
      });
      assert.equal(demoRes.status, 404);
      assert.equal(demoRes.body.code, 'analytics/seller-not-found');

      assert.equal(repo.recordFunnelCalls, 0);
      assert.equal(repo.sellerAnalytics.size, 0);
    });
  });

  it('2. Real sellerId succeeds; seller_profile_view does not artificially require listingId', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_real_1', 'listing_real_1');

    await withFunnelServer(repo, { buyer_tok: 'buyer_1' }, async (baseUrl) => {
      const res = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_real_1',
          eventType: 'seller_profile_view',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.recorded, true);

      const doc = repo.sellerAnalytics.get('seller_real_1');
      assert(doc);
      assert.equal(doc.profileViews, 1);
      assert.equal(doc.uniqueProfileViewers, 1);
      assert.equal(doc.metadata?.sellerName, 'Proton Seller');
      assert.equal(doc.country, 'Georgia');
      assert.equal(doc.region, 'Tbilisi');
    });
  });

  it('3. Missing, empty, invalid, or non-existent listingId is rejected on listing_to_seller', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_real_1', 'listing_real_1');

    await withFunnelServer(repo, { buyer_tok: 'buyer_1' }, async (baseUrl) => {
      const missingRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_real_1',
          eventType: 'listing_to_seller',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(missingRes.status, 400);
      assert.equal(missingRes.body.code, 'analytics/listing-id-required');

      const emptyRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_real_1',
          eventType: 'listing_to_seller',
          listingId: '',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(emptyRes.status, 400);
      assert.equal(emptyRes.body.code, 'analytics/listing-id-required');

      const badFormatRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_real_1',
          eventType: 'listing_to_seller',
          listingId: '../bad/listing',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(badFormatRes.status, 400);
      assert.equal(badFormatRes.body.code, 'analytics/invalid-listing-id');

      const nonExistentRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_real_1',
          eventType: 'listing_to_seller',
          listingId: 'non_existent_listing_404',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(nonExistentRes.status, 404);
      assert.equal(nonExistentRes.body.code, 'analytics/listing-not-found');

      // Provided empty/invalid listingId on contact_click is also rejected cleanly
      const emptyContactListing = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_real_1',
          eventType: 'contact_click',
          listingId: '',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(emptyContactListing.status, 400);
      assert.equal(emptyContactListing.body.code, 'analytics/invalid-listing-id');

      assert.equal(repo.recordFunnelCalls, 0);
      assert.equal(repo.sellerAnalytics.size, 0);
    });
  });

  it('4. Listing belonging to another seller is rejected (403)', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_A', 'listing_of_A');
    seedRealSellerAndListing(repo, 'seller_B', 'listing_of_B');

    await withFunnelServer(repo, { buyer_tok: 'buyer_1' }, async (baseUrl) => {
      for (const ev of ['listing_to_seller', 'contact_click', 'order_intent', 'seller_profile_view'] as const) {
        const res = await postFunnelEvent(
          baseUrl,
          {
            sellerId: 'seller_A',
            eventType: ev,
            listingId: 'listing_of_B',
          },
          { bearerToken: 'buyer_tok' }
        );
        assert.equal(res.status, 403, `Expected 403 for cross-seller listing on ${ev}`);
        assert.equal(res.body.recorded, false);
        assert.equal(res.body.code, 'analytics/listing-seller-mismatch');
      }

      assert.equal(repo.recordFunnelCalls, 0);
      assert.equal(repo.sellerAnalytics.size, 0);
    });
  });

  it('5. Inactive, sold, draft, deleted, or demo/seed/mock listing is rejected', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_1', 'listing_active');
    repo.listings.set('listing_deleted', {
      id: 'listing_deleted',
      sellerId: 'seller_1',
      title: 'Deleted',
      category: 'tech',
      status: 'deleted',
    });
    repo.listings.set('listing_sold', {
      id: 'listing_sold',
      sellerId: 'seller_1',
      title: 'Sold',
      category: 'tech',
      status: 'sold',
    });
    repo.listings.set('listing_draft', {
      id: 'listing_draft',
      sellerId: 'seller_1',
      title: 'Draft',
      category: 'tech',
      status: 'draft',
    });
    repo.listings.set('listing_demo', {
      id: 'listing_demo',
      sellerId: 'seller_1',
      title: 'Demo',
      category: 'tech',
      status: 'active',
      isDemo: true,
    });
    repo.listings.set('listing_seed', {
      id: 'listing_seed',
      sellerId: 'seller_1',
      title: 'Seed',
      category: 'tech',
      status: 'active',
      isSeed: true,
    });
    repo.listings.set('listing_mock', {
      id: 'listing_mock',
      sellerId: 'seller_1',
      title: 'Mock',
      category: 'tech',
      status: 'active',
      isMock: true,
    });

    await withFunnelServer(repo, { buyer_tok: 'buyer_1' }, async (baseUrl) => {
      for (const lid of ['listing_deleted', 'listing_demo', 'listing_seed', 'listing_mock']) {
        const res = await postFunnelEvent(
          baseUrl,
          {
            sellerId: 'seller_1',
            eventType: 'listing_to_seller',
            listingId: lid,
          },
          { bearerToken: 'buyer_tok' }
        );
        assert.equal(res.status, 404, `Expected 404 for ${lid}`);
        assert.equal(res.body.code, 'analytics/listing-not-found');
      }

      for (const lid of ['listing_sold', 'listing_draft']) {
        const res = await postFunnelEvent(
          baseUrl,
          {
            sellerId: 'seller_1',
            eventType: 'contact_click',
            listingId: lid,
          },
          { bearerToken: 'buyer_tok' }
        );
        assert.equal(res.status, 400, `Expected 400 for inactive ${lid}`);
        assert.equal(res.body.code, 'analytics/listing-not-active');
      }

      assert.equal(repo.recordFunnelCalls, 0);
      assert.equal(repo.sellerAnalytics.size, 0);
    });
  });

  it('6. Auth unique counters increment accurately (including authUniqueListingToSellerUsers)', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_1', 'listing_1');

    await withFunnelServer(
      repo,
      { auth_1: 'buyer_auth_1', auth_2: 'buyer_auth_2' },
      async (baseUrl) => {
        for (const tok of ['auth_1', 'auth_2']) {
          const r1 = await postFunnelEvent(
            baseUrl,
            { sellerId: 'seller_1', eventType: 'listing_to_seller', listingId: 'listing_1' },
            { bearerToken: tok }
          );
          assert.equal(r1.status, 200);
          assert.equal(r1.body.recorded, true);

          const r2 = await postFunnelEvent(
            baseUrl,
            { sellerId: 'seller_1', eventType: 'contact_click', listingId: 'listing_1' },
            { bearerToken: tok }
          );
          assert.equal(r2.status, 200);
        }

        const doc = repo.sellerAnalytics.get('seller_1');
        assert(doc);
        assert.equal(doc.listingToSellerClicks, 2);
        assert.equal(doc.uniqueListingToSellerUsers, 2);
        assert.equal(doc.authListingToSellerClicks, 2);
        assert.equal(doc.authUniqueListingToSellerUsers, 2);
        assert.equal(doc.guestListingToSellerClicks, 0);
        assert.equal(doc.guestUniqueListingToSellerUsers, 0);

        assert.equal(doc.contactClicks, 2);
        assert.equal(doc.uniqueContactClickers, 2);
        assert.equal(doc.authUniqueContactClickers, 2);
        assert.equal(doc.guestUniqueContactClickers, 0);
      }
    );
  });

  it('7. Guest unique counters increment accurately (including guestUniqueListingToSellerUsers)', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_1', 'listing_1');

    await withFunnelServer(repo, {}, async (baseUrl) => {
      for (const guestTok of ['guest_token_alpha_1', 'guest_token_beta_2']) {
        const res = await postFunnelEvent(baseUrl, {
          sellerId: 'seller_1',
          eventType: 'listing_to_seller',
          listingId: 'listing_1',
          visitorToken: guestTok,
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.recorded, true);
      }

      const doc = repo.sellerAnalytics.get('seller_1');
      assert(doc);
      assert.equal(doc.listingToSellerClicks, 2);
      assert.equal(doc.uniqueListingToSellerUsers, 2);
      assert.equal(doc.guestListingToSellerClicks, 2);
      assert.equal(doc.guestUniqueListingToSellerUsers, 2);
      assert.equal(doc.authListingToSellerClicks, 0);
      assert.equal(doc.authUniqueListingToSellerUsers, 0);
    });
  });

  it('8. Repeated events from the same viewer do NOT re-increment unique counters', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_1', 'listing_1');

    await withFunnelServer(repo, { buyer_tok: 'buyer_repeat' }, async (baseUrl) => {
      // Auth user repeats 3 times
      for (let i = 0; i < 3; i++) {
        const res = await postFunnelEvent(
          baseUrl,
          { sellerId: 'seller_1', eventType: 'listing_to_seller', listingId: 'listing_1' },
          { bearerToken: 'buyer_tok' }
        );
        assert.equal(res.status, 200);
      }

      // Guest user repeats 3 times
      for (let i = 0; i < 3; i++) {
        const res = await postFunnelEvent(baseUrl, {
          sellerId: 'seller_1',
          eventType: 'order_intent',
          listingId: 'listing_1',
          visitorToken: 'guest_repeat_token_1',
        });
        assert.equal(res.status, 200);
      }

      const doc = repo.sellerAnalytics.get('seller_1');
      assert(doc);
      assert.equal(doc.listingToSellerClicks, 3);
      assert.equal(doc.authListingToSellerClicks, 3);
      assert.equal(doc.uniqueListingToSellerUsers, 1);
      assert.equal(doc.authUniqueListingToSellerUsers, 1);

      assert.equal(doc.orderIntents, 3);
      assert.equal(doc.guestOrderIntents, 3);
      assert.equal(doc.uniqueOrderIntentUsers, 1);
      assert.equal(doc.guestUniqueOrderIntentUsers, 1);
    });
  });

  it('9. Total click counters increment accurately without overwriting + legacy doc compatibility', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_1', 'listing_1');

    // Simulate a legacy Phase 2B seller_analytics doc that existed BEFORE authUniqueListingToSellerUsers
    const legacyDoc = createEmptySellerAnalyticsDoc({
      sellerId: 'seller_1',
      nowMs: Date.now() - 10_000,
    });
    delete (legacyDoc as any).authUniqueListingToSellerUsers;
    delete (legacyDoc as any).guestUniqueListingToSellerUsers;
    legacyDoc.listingToSellerClicks = 4;
    legacyDoc.uniqueListingToSellerUsers = 4;
    legacyDoc.authListingToSellerClicks = 2;
    legacyDoc.guestListingToSellerClicks = 2;
    repo.sellerAnalytics.set('seller_1', legacyDoc);

    await withFunnelServer(repo, { auth_tok: 'auth_new_1' }, async (baseUrl) => {
      // Auth click twice
      for (let i = 0; i < 2; i++) {
        await postFunnelEvent(
          baseUrl,
          { sellerId: 'seller_1', eventType: 'listing_to_seller', listingId: 'listing_1' },
          { bearerToken: 'auth_tok' }
        );
      }
      // Guest click twice
      for (let i = 0; i < 2; i++) {
        await postFunnelEvent(baseUrl, {
          sellerId: 'seller_1',
          eventType: 'listing_to_seller',
          listingId: 'listing_1',
          visitorToken: 'guest_new_token_1',
        });
      }

      const doc = repo.sellerAnalytics.get('seller_1');
      assert(doc);
      assert.equal(doc.listingToSellerClicks, 8);
      assert.equal(doc.uniqueListingToSellerUsers, 6);
      assert.equal(doc.authListingToSellerClicks, 4);
      assert.equal(doc.guestListingToSellerClicks, 4);
      assert.equal(doc.authUniqueListingToSellerUsers, 1);
      assert.equal(doc.guestUniqueListingToSellerUsers, 1);
    });
  });

  it('10. Hourly buckets accurately store totals, unique, Auth/Guest segments, and enforce 52h pruning', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_1', 'listing_1');
    const fixedNow = Date.UTC(2026, 10, 20, 14, 30, 0);
    const service = new MarketAnalyticsService(repo, TEST_SALT);

    await service.recordSellerFunnelEvent({
      sellerId: 'seller_1',
      eventType: 'seller_profile_view',
      verifiedUid: 'auth_u1',
      userAgent: BROWSER_UA,
      nowMs: fixedNow,
    });
    await service.recordSellerFunnelEvent({
      sellerId: 'seller_1',
      eventType: 'seller_profile_view',
      verifiedUid: 'auth_u1',
      userAgent: BROWSER_UA,
      nowMs: fixedNow + 1000,
    });
    await service.recordSellerFunnelEvent({
      sellerId: 'seller_1',
      eventType: 'listing_to_seller',
      listingId: 'listing_1',
      verifiedUid: 'auth_u1',
      userAgent: BROWSER_UA,
      nowMs: fixedNow + 2000,
    });
    await service.recordSellerFunnelEvent({
      sellerId: 'seller_1',
      eventType: 'contact_click',
      listingId: 'listing_1',
      visitorToken: 'guest_bucket_1',
      userAgent: BROWSER_UA,
      nowMs: fixedNow + 3000,
    });
    await service.recordSellerFunnelEvent({
      sellerId: 'seller_1',
      eventType: 'contact_click',
      listingId: 'listing_1',
      visitorToken: 'guest_bucket_2',
      userAgent: BROWSER_UA,
      nowMs: fixedNow + 4000,
    });

    const doc = repo.sellerAnalytics.get('seller_1');
    assert(doc);
    const hourKey = getHourBucketKey(fixedNow);
    const hBucket = doc.hourly?.[hourKey];
    assert(hBucket, 'Hourly bucket must exist');

    assert.equal(hBucket.totalEvents, 5);
    assert.equal(hBucket.uniqueUsers, 4);
    assert.equal(hBucket.authEvents, 3);
    assert.equal(hBucket.guestEvents, 2);
    assert.equal(hBucket.authUniqueUsers, 2);
    assert.equal(hBucket.guestUniqueUsers, 2);

    assert.equal(hBucket.profileViews, 2);
    assert.equal(hBucket.uniqueProfileViewers, 1);
    assert.equal(hBucket.authProfileViews, 2);
    assert.equal(hBucket.authUniqueProfileViewers, 1);
    assert.equal(hBucket.guestProfileViews, 0);

    assert.equal(hBucket.listingToSellerClicks, 1);
    assert.equal(hBucket.uniqueListingToSellerUsers, 1);
    assert.equal(hBucket.authListingToSellerClicks, 1);
    assert.equal(hBucket.authUniqueListingToSellerUsers, 1);

    assert.equal(hBucket.contactClicks, 2);
    assert.equal(hBucket.uniqueContactClickers, 2);
    assert.equal(hBucket.guestContactClicks, 2);
    assert.equal(hBucket.guestUniqueContactClickers, 2);

    // Verify 52h hourly retention pruning
    const after55h = fixedNow + 55 * 60 * 60 * 1000;
    await service.recordSellerFunnelEvent({
      sellerId: 'seller_1',
      eventType: 'seller_profile_view',
      verifiedUid: 'auth_u1',
      userAgent: BROWSER_UA,
      nowMs: after55h,
    });
    const prunedDoc = repo.sellerAnalytics.get('seller_1');
    assert(prunedDoc);
    assert.equal(prunedDoc.hourly?.[hourKey], undefined);
    assert(prunedDoc.hourly?.[getHourBucketKey(after55h)]);
  });

  it('11. Daily buckets accurately store totals, unique, Auth/Guest segments, and enforce 62d pruning', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_1', 'listing_1');
    const fixedNow = Date.UTC(2026, 10, 20, 14, 30, 0);
    const service = new MarketAnalyticsService(repo, TEST_SALT);

    await service.recordSellerFunnelEvent({
      sellerId: 'seller_1',
      eventType: 'listing_to_seller',
      listingId: 'listing_1',
      verifiedUid: 'auth_daily_1',
      userAgent: BROWSER_UA,
      nowMs: fixedNow,
    });
    await service.recordSellerFunnelEvent({
      sellerId: 'seller_1',
      eventType: 'listing_to_seller',
      listingId: 'listing_1',
      verifiedUid: 'auth_daily_1',
      userAgent: BROWSER_UA,
      nowMs: fixedNow + 3600_000,
    });
    await service.recordSellerFunnelEvent({
      sellerId: 'seller_1',
      eventType: 'order_intent',
      listingId: 'listing_1',
      visitorToken: 'guest_daily_tok_1',
      userAgent: BROWSER_UA,
      nowMs: fixedNow + 7200_000,
    });

    const doc = repo.sellerAnalytics.get('seller_1');
    assert(doc);
    const dayKey = getDayBucketKey(fixedNow);
    const dBucket = doc.daily?.[dayKey];
    assert(dBucket, 'Daily bucket must exist');

    assert.equal(dBucket.totalEvents, 3);
    assert.equal(dBucket.uniqueUsers, 2);
    assert.equal(dBucket.authEvents, 2);
    assert.equal(dBucket.guestEvents, 1);
    assert.equal(dBucket.authUniqueUsers, 1);
    assert.equal(dBucket.guestUniqueUsers, 1);

    assert.equal(dBucket.listingToSellerClicks, 2);
    assert.equal(dBucket.uniqueListingToSellerUsers, 1);
    assert.equal(dBucket.authListingToSellerClicks, 2);
    assert.equal(dBucket.authUniqueListingToSellerUsers, 1);

    assert.equal(dBucket.orderIntents, 1);
    assert.equal(dBucket.uniqueOrderIntentUsers, 1);
    assert.equal(dBucket.guestOrderIntents, 1);
    assert.equal(dBucket.guestUniqueOrderIntentUsers, 1);

    // Verify 62d daily retention pruning
    const after65d = fixedNow + 65 * 24 * 60 * 60 * 1000;
    await service.recordSellerFunnelEvent({
      sellerId: 'seller_1',
      eventType: 'seller_profile_view',
      verifiedUid: 'auth_daily_1',
      userAgent: BROWSER_UA,
      nowMs: after65d,
    });
    const prunedDoc = repo.sellerAnalytics.get('seller_1');
    assert(prunedDoc);
    assert.equal(prunedDoc.daily?.[dayKey], undefined);
    assert(prunedDoc.daily?.[getDayBucketKey(after65d)]);
  });

  it('12. Auth and Guest data stay strictly isolated across viewer docs and root counters', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_1', 'listing_1');

    await withFunnelServer(repo, { auth_tok: 'user_xyz' }, async (baseUrl) => {
      await postFunnelEvent(
        baseUrl,
        { sellerId: 'seller_1', eventType: 'contact_click', listingId: 'listing_1' },
        { bearerToken: 'auth_tok' }
      );
      await postFunnelEvent(baseUrl, {
        sellerId: 'seller_1',
        eventType: 'contact_click',
        listingId: 'listing_1',
        visitorToken: 'guest_xyz_token_1',
      });

      const doc = repo.sellerAnalytics.get('seller_1');
      assert(doc);
      assert.equal(doc.contactClicks, 2);
      assert.equal(doc.uniqueContactClickers, 2);
      assert.equal(doc.authContactClicks, 1);
      assert.equal(doc.guestContactClicks, 1);
      assert.equal(doc.authUniqueContactClickers, 1);
      assert.equal(doc.guestUniqueContactClickers, 1);
      assert.equal(repo.sellerViewers.size, 2);

      const viewerTypes = Array.from(repo.sellerViewers.values()).map((v) => v.viewerType).sort();
      assert.deepEqual(viewerTypes, ['auth', 'guest']);
    });
  });

  it('13. Owner exclusion blocks seller own actions on all 4 events without creating analytics docs', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_owner_1', 'listing_owner_1');

    await withFunnelServer(repo, { owner_tok: 'seller_owner_1' }, async (baseUrl) => {
      const events: MarketFunnelEventType[] = [
        'seller_profile_view',
        'listing_to_seller',
        'contact_click',
        'order_intent',
      ];
      for (const ev of events) {
        const res = await postFunnelEvent(
          baseUrl,
          {
            sellerId: 'seller_owner_1',
            eventType: ev,
            listingId: 'listing_owner_1',
          },
          { bearerToken: 'owner_tok' }
        );
        assert.equal(res.status, 200);
        assert.equal(res.body.recorded, false);
        assert.equal(res.body.reason, 'owner_excluded');
      }

      assert.equal(repo.recordFunnelCalls, 0);
      assert.equal(repo.sellerAnalytics.size, 0);
      assert.equal(repo.sellerViewers.size, 0);
    });
  });

  it('14. Concurrent requests do not lose counter updates under transactional execution', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_1', 'listing_1');

    const tokens: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      tokens[`tok_${i}`] = `auth_user_${i}`;
    }

    await withFunnelServer(repo, tokens, async (baseUrl) => {
      // Fire 20 parallel requests: 10 distinct Auth + 10 Guest (5 unique guests * 2 each)
      const requests: Array<Promise<{ status: number; body: Record<string, any> }>> = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          postFunnelEvent(
            baseUrl,
            { sellerId: 'seller_1', eventType: 'listing_to_seller', listingId: 'listing_1' },
            { bearerToken: `tok_${i}` }
          )
        );
      }
      for (let i = 0; i < 10; i++) {
        const guestIdx = i % 5;
        requests.push(
          postFunnelEvent(baseUrl, {
            sellerId: 'seller_1',
            eventType: 'listing_to_seller',
            listingId: 'listing_1',
            visitorToken: `guest_concurrent_${guestIdx}`,
          })
        );
      }

      const responses = await Promise.all(requests);
      for (const r of responses) {
        assert.equal(r.status, 200);
        assert.equal(r.body.recorded, true);
      }

      const doc = repo.sellerAnalytics.get('seller_1');
      assert(doc);
      assert.equal(doc.listingToSellerClicks, 20);
      assert.equal(doc.uniqueListingToSellerUsers, 15);
      assert.equal(doc.authListingToSellerClicks, 10);
      assert.equal(doc.guestListingToSellerClicks, 10);
      assert.equal(doc.authUniqueListingToSellerUsers, 10);
      assert.equal(doc.guestUniqueListingToSellerUsers, 5);
      assert.equal(doc.totals?.totalEvents, 20);
      assert.equal(doc.totals?.totalUniqueUsers, 15);
      assert.equal(repo.sellerViewers.size, 15);
    });
  });

  it('15. Rejected requests never create seller_analytics or viewer documents', async () => {
    const repo = new TransactionalFunnelMemoryRepo();
    seedRealSellerAndListing(repo, 'seller_real_1', 'listing_real_1');
    repo.listings.set('listing_other', {
      id: 'listing_other',
      sellerId: 'seller_other',
      title: 'Other Listing',
      category: 'tech',
      status: 'active',
    });
    repo.listings.set('listing_deleted', {
      id: 'listing_deleted',
      sellerId: 'seller_real_1',
      title: 'Deleted',
      category: 'tech',
      status: 'deleted',
    });

    await withFunnelServer(
      repo,
      { buyer_tok: 'buyer_1', owner_tok: 'seller_real_1' },
      async (baseUrl) => {
        // Series of invalid / rejected / excluded attempts
        await postFunnelEvent(baseUrl, {
          sellerId: 'missing_seller',
          eventType: 'seller_profile_view',
          visitorToken: 'guest_tok_12345',
        });
        await postFunnelEvent(baseUrl, {
          sellerId: 'seller_real_1',
          eventType: 'listing_to_seller',
          visitorToken: 'guest_tok_12345',
        });
        await postFunnelEvent(baseUrl, {
          sellerId: 'seller_real_1',
          eventType: 'listing_to_seller',
          listingId: 'listing_other',
          visitorToken: 'guest_tok_12345',
        });
        await postFunnelEvent(baseUrl, {
          sellerId: 'seller_real_1',
          eventType: 'contact_click',
          listingId: 'listing_deleted',
          visitorToken: 'guest_tok_12345',
        });
        await postFunnelEvent(
          baseUrl,
          {
            sellerId: 'seller_real_1',
            eventType: 'order_intent',
            listingId: 'listing_real_1',
          },
          { bearerToken: 'owner_tok' }
        );

        assert.equal(repo.recordFunnelCalls, 0);
        assert.equal(repo.sellerAnalytics.size, 0);
        assert.equal(repo.sellerViewers.size, 0);
      }
    );
  });
});
