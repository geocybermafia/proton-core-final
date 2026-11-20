import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  AnalyticsRepository,
  ListingRecordForAnalytics,
  MarketAnalyticsService,
  MarketMessageRecordForAnalytics,
  OrderRecordForAnalytics,
  SellerRecordForAnalytics,
} from '../src/lib/analyticsServer.js';
import {
  buildVerifiedFunnelMarkerId,
  createEmptySellerAnalyticsBucket,
  createEmptySellerAnalyticsDoc,
  getDayBucketKey,
  getHourBucketKey,
  pruneSellerDailyBuckets,
  pruneSellerHourlyBuckets,
} from '../src/lib/marketAnalyticsUtils.js';
import { createApiApp } from '../src/serverApp.js';
import type {
  MarketFunnelEventType,
  SellerAnalyticsBucket,
  SellerAnalyticsDoc,
  SellerViewerDoc,
  VerifiedFunnelMarkerDoc,
  VerifiedMarkerClaimResult,
  VerifiedMarkerType,
} from '../src/types.js';

const TEST_SALT = 'proton-phase2c-confirmed-funnel-test-salt-32chars';
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';

class InMemoryPhase2cAnalyticsRepo implements AnalyticsRepository {
  public sellers = new Map<string, SellerRecordForAnalytics>();
  public listings = new Map<string, ListingRecordForAnalytics>();
  public orders = new Map<string, OrderRecordForAnalytics>();
  public marketMessages = new Map<string, MarketMessageRecordForAnalytics>();
  public sellerAnalytics = new Map<string, SellerAnalyticsDoc>();
  public sellerViewers = new Map<string, SellerViewerDoc>();
  public verifiedMarkers = new Map<string, VerifiedFunnelMarkerDoc>();
  public claimMarkerCalls = 0;
  public recordFunnelCalls = 0;

  async getListing(listingId: string): Promise<ListingRecordForAnalytics | null> {
    return this.listings.get(listingId) ?? null;
  }

  async getSellerForAnalytics(sellerId: string): Promise<SellerRecordForAnalytics | null> {
    return this.sellers.get(sellerId) ?? null;
  }

  async getSellerProfileLocation() {
    return { optedOut: false };
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

  async getOrderForAnalytics(orderId: string): Promise<OrderRecordForAnalytics | null> {
    return this.orders.get(orderId) ?? null;
  }

  async getMarketMessageForAnalytics(messageId: string): Promise<MarketMessageRecordForAnalytics | null> {
    return this.marketMessages.get(messageId) ?? null;
  }

  async getVerifiedFunnelMarker(markerId: string): Promise<VerifiedFunnelMarkerDoc | null> {
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
    this.claimMarkerCalls += 1;
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

  async recordSellerFunnelEvent(params: {
    sellerId: string;
    eventType: MarketFunnelEventType;
    viewerHash: string;
    viewerType: 'auth' | 'guest';
    nowMs?: number;
    listingId?: string;
    sourceId?: string;
  }): Promise<{ recorded: boolean; reason?: string }> {
    this.recordFunnelCalls += 1;
    const nowMs = params.nowMs ?? Date.now();
    const hourKey = getHourBucketKey(nowMs);
    const dayKey = getDayBucketKey(nowMs);

    const existingSeller =
      this.sellerAnalytics.get(params.sellerId) ??
      createEmptySellerAnalyticsDoc({ sellerId: params.sellerId, nowMs });

    const viewerKey = `${params.sellerId}:${params.viewerHash}`;
    const viewerData: SellerViewerDoc = this.sellerViewers.get(viewerKey) ?? {
      viewerHash: params.viewerHash,
      viewerType: params.viewerType,
      firstSeenAt: nowMs,
      lastSeenAt: nowMs,
    };
    viewerData.lastSeenAt = nowMs;

    const hourly = pruneSellerHourlyBuckets(existingSeller.hourly, nowMs);
    const daily = pruneSellerDailyBuckets(existingSeller.daily, nowMs);
    const hBucket = hourly[hourKey] || createEmptySellerAnalyticsBucket();
    const dBucket = daily[dayKey] || createEmptySellerAnalyticsBucket();

    const isAuth = params.viewerType === 'auth';
    let counterField: keyof SellerAnalyticsDoc;
    let uniqueField: keyof SellerAnalyticsDoc;
    let authField: keyof SellerAnalyticsDoc | undefined;
    let guestField: keyof SellerAnalyticsDoc | undefined;
    let uniqueViewerCheckField: keyof SellerViewerDoc;
    let lastTimestampField: keyof SellerViewerDoc;

    switch (params.eventType) {
      case 'seller_profile_view':
        counterField = 'profileViews';
        uniqueField = 'uniqueProfileViewers';
        authField = 'authProfileViews';
        guestField = 'guestProfileViews';
        uniqueViewerCheckField = 'firstProfileViewAt';
        lastTimestampField = 'lastProfileViewAt';
        break;
      case 'listing_to_seller':
        counterField = 'listingToSellerClicks';
        uniqueField = 'uniqueListingToSellerUsers';
        authField = 'authListingToSellerClicks';
        guestField = 'guestListingToSellerClicks';
        uniqueViewerCheckField = 'firstListingToSellerAt';
        lastTimestampField = 'lastListingToSellerAt';
        break;
      case 'contact_click':
        counterField = 'contactClicks';
        uniqueField = 'uniqueContactClickers';
        authField = 'authContactClicks';
        guestField = 'guestContactClicks';
        uniqueViewerCheckField = 'firstContactClickAt';
        lastTimestampField = 'lastContactClickAt';
        break;
      case 'order_intent':
        counterField = 'orderIntents';
        uniqueField = 'uniqueOrderIntentUsers';
        authField = 'authOrderIntents';
        guestField = 'guestOrderIntents';
        uniqueViewerCheckField = 'firstOrderIntentAt';
        lastTimestampField = 'lastOrderIntentAt';
        break;
      case 'contact_confirmed':
        counterField = 'contactConfirmed';
        uniqueField = 'uniqueContactedBuyers';
        uniqueViewerCheckField = 'firstContactConfirmedAt';
        lastTimestampField = 'firstContactConfirmedAt';
        break;
      case 'order_confirmed':
        counterField = 'ordersConfirmed';
        uniqueField = 'uniqueOrderBuyers';
        uniqueViewerCheckField = 'firstOrderConfirmedAt';
        lastTimestampField = 'firstOrderConfirmedAt';
        break;
      default:
        return { recorded: false, reason: 'invalid_event_type' };
    }

    let uniqueIncremented = false;
    if (!viewerData[uniqueViewerCheckField]) {
      viewerData[uniqueViewerCheckField] = nowMs;
      uniqueIncremented = true;
    }
    viewerData[lastTimestampField] = nowMs;

    const nextDoc: SellerAnalyticsDoc = {
      ...existingSeller,
      [counterField]: (Number(existingSeller[counterField]) || 0) + 1,
      ...(uniqueIncremented ? { [uniqueField]: (Number(existingSeller[uniqueField]) || 0) + 1 } : {}),
      ...(authField
        ? { [authField]: isAuth ? (Number(existingSeller[authField]) || 0) + 1 : Number(existingSeller[authField]) || 0 }
        : {}),
      ...(guestField
        ? { [guestField]: !isAuth ? (Number(existingSeller[guestField]) || 0) + 1 : Number(existingSeller[guestField]) || 0 }
        : {}),
      totals: {
        totalEvents: (Number(existingSeller.totals?.totalEvents) || 0) + 1,
        totalUniqueUsers: (Number(existingSeller.totals?.totalUniqueUsers) || 0) + (uniqueIncremented ? 1 : 0),
        authEvents: (Number(existingSeller.totals?.authEvents) || 0) + (isAuth ? 1 : 0),
        guestEvents: (Number(existingSeller.totals?.guestEvents) || 0) + (!isAuth ? 1 : 0),
        authUniqueUsers: (Number(existingSeller.totals?.authUniqueUsers) || 0) + (uniqueIncremented && isAuth ? 1 : 0),
        guestUniqueUsers: (Number(existingSeller.totals?.guestUniqueUsers) || 0) + (uniqueIncremented && !isAuth ? 1 : 0),
      },
      hourly,
      daily,
      updatedAt: nowMs,
    };

    hBucket[counterField as keyof SellerAnalyticsBucket] = (Number(hBucket[counterField as keyof SellerAnalyticsBucket]) || 0) + 1;
    dBucket[counterField as keyof SellerAnalyticsBucket] = (Number(dBucket[counterField as keyof SellerAnalyticsBucket]) || 0) + 1;
    if (uniqueIncremented) {
      hBucket[uniqueField as keyof SellerAnalyticsBucket] = (Number(hBucket[uniqueField as keyof SellerAnalyticsBucket]) || 0) + 1;
      dBucket[uniqueField as keyof SellerAnalyticsBucket] = (Number(dBucket[uniqueField as keyof SellerAnalyticsBucket]) || 0) + 1;
    }
    hourly[hourKey] = hBucket;
    daily[dayKey] = dBucket;

    this.sellerViewers.set(viewerKey, viewerData);
    this.sellerAnalytics.set(params.sellerId, nextDoc);

    return { recorded: true };
  }
}

async function withTestServer(
  repo: InMemoryPhase2cAnalyticsRepo,
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
  const address = server.address();
  assert(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

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
  options?: { bearerToken?: string; userAgent?: string }
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': options?.userAgent ?? BROWSER_UA,
  };
  if (options?.bearerToken !== undefined) {
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

describe('Phase 2C First Critical Fix: Auth-Only & DB-Verified Confirmed Funnel Events', () => {
  it('1. Guest cannot send order_confirmed even with valid visitorToken (401)', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.orders.set('order_real_1', {
      id: 'order_real_1',
      listingId: 'listing_1',
      buyerId: 'buyer_1',
      sellerId: 'seller_1',
      status: 'pending',
    });

    await withTestServer(repo, {}, async (baseUrl, service) => {
      const httpRes = await postFunnelEvent(baseUrl, {
        sellerId: 'seller_1',
        eventType: 'order_confirmed',
        visitorToken: 'guest_valid_token_123456',
        sourceId: 'order_real_1',
        listingId: 'listing_1',
      });
      assert.equal(httpRes.status, 401);
      assert.equal(httpRes.body.recorded, false);
      assert.equal(httpRes.body.code, 'analytics/auth-required');

      // Also verify service-level direct enforcement
      const svcRes = await service.recordSellerFunnelEvent({
        sellerId: 'seller_1',
        eventType: 'order_confirmed',
        visitorToken: 'guest_valid_token_123456',
        verifiedUid: null,
        sourceId: 'order_real_1',
        listingId: 'listing_1',
        userAgent: BROWSER_UA,
      });
      assert.equal(svcRes.status, 401);
      assert.equal(svcRes.body.code, 'analytics/auth-required');
      assert.equal(repo.verifiedMarkers.size, 0);
      assert.equal(repo.recordFunnelCalls, 0);
    });
  });

  it('2. Guest cannot send contact_confirmed even with valid visitorToken (401)', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.marketMessages.set('msg_real_1', {
      id: 'msg_real_1',
      listingId: 'listing_1',
      senderId: 'buyer_1',
      receiverId: 'seller_1',
      buyerId: 'buyer_1',
      sellerId: 'seller_1',
      participants: ['buyer_1', 'seller_1'],
    });

    await withTestServer(repo, {}, async (baseUrl, service) => {
      const httpRes = await postFunnelEvent(baseUrl, {
        sellerId: 'seller_1',
        eventType: 'contact_confirmed',
        visitorToken: 'guest_valid_token_abcdef',
        sourceId: 'msg_real_1',
        listingId: 'listing_1',
      });
      assert.equal(httpRes.status, 401);
      assert.equal(httpRes.body.recorded, false);
      assert.equal(httpRes.body.code, 'analytics/auth-required');

      const svcRes = await service.recordSellerFunnelEvent({
        sellerId: 'seller_1',
        eventType: 'contact_confirmed',
        visitorToken: 'guest_valid_token_abcdef',
        verifiedUid: undefined,
        sourceId: 'msg_real_1',
        listingId: 'listing_1',
        userAgent: BROWSER_UA,
      });
      assert.equal(svcRes.status, 401);
      assert.equal(svcRes.body.code, 'analytics/auth-required');
      assert.equal(repo.verifiedMarkers.size, 0);
      assert.equal(repo.recordFunnelCalls, 0);
    });
  });

  it('3. Invalid Bearer token is rejected with 401 for confirmed events', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.orders.set('order_real_1', {
      id: 'order_real_1',
      listingId: 'listing_1',
      buyerId: 'buyer_1',
      sellerId: 'seller_1',
      status: 'pending',
    });

    await withTestServer(repo, { valid_token_buyer1: 'buyer_1' }, async (baseUrl) => {
      const orderRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'order_confirmed',
          sourceId: 'order_real_1',
          listingId: 'listing_1',
        },
        { bearerToken: 'forged_or_expired_token' }
      );
      assert.equal(orderRes.status, 401);

      const contactRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'contact_confirmed',
          sourceId: 'msg_real_1',
          listingId: 'listing_1',
        },
        { bearerToken: 'forged_or_expired_token' }
      );
      assert.equal(contactRes.status, 401);
      assert.equal(repo.verifiedMarkers.size, 0);
      assert.equal(repo.recordFunnelCalls, 0);
    });
  });

  it('4. Authenticated user cannot confirm another buyer order (403)', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.orders.set('order_other_buyer', {
      id: 'order_other_buyer',
      listingId: 'listing_1',
      buyerId: 'real_buyer_1',
      sellerId: 'seller_1',
      status: 'pending',
    });

    await withTestServer(repo, { attacker_tok: 'attacker_uid' }, async (baseUrl) => {
      const res = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'order_confirmed',
          sourceId: 'order_other_buyer',
          listingId: 'listing_1',
        },
        { bearerToken: 'attacker_tok' }
      );
      assert.equal(res.status, 403);
      assert.equal(res.body.recorded, false);
      assert.equal(res.body.code, 'analytics/order-buyer-mismatch');
      assert.equal(repo.verifiedMarkers.size, 0);
      assert.equal(repo.recordFunnelCalls, 0);
    });
  });

  it('5. Authenticated user cannot confirm another sender market message (403)', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.marketMessages.set('msg_other_sender', {
      id: 'msg_other_sender',
      listingId: 'listing_1',
      senderId: 'real_sender_1',
      receiverId: 'seller_1',
      buyerId: 'real_sender_1',
      sellerId: 'seller_1',
      participants: ['real_sender_1', 'seller_1'],
    });

    await withTestServer(repo, { attacker_tok: 'attacker_uid' }, async (baseUrl) => {
      const res = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'contact_confirmed',
          sourceId: 'msg_other_sender',
          listingId: 'listing_1',
        },
        { bearerToken: 'attacker_tok' }
      );
      assert.equal(res.status, 403);
      assert.equal(res.body.recorded, false);
      assert.equal(res.body.code, 'analytics/message-sender-mismatch');
      assert.equal(repo.verifiedMarkers.size, 0);
      assert.equal(repo.recordFunnelCalls, 0);
    });
  });

  it('6. Non-existent or cancelled orderId is rejected (404 / 400)', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.orders.set('order_cancelled', {
      id: 'order_cancelled',
      listingId: 'listing_1',
      buyerId: 'buyer_1',
      sellerId: 'seller_1',
      status: 'cancelled',
    });
    repo.orders.set('order_refunded', {
      id: 'order_refunded',
      listingId: 'listing_1',
      buyerId: 'buyer_1',
      sellerId: 'seller_1',
      status: 'refunded',
    });

    await withTestServer(repo, { buyer_tok: 'buyer_1' }, async (baseUrl) => {
      const missingRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'order_confirmed',
          sourceId: 'non_existent_order_999',
          listingId: 'listing_1',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(missingRes.status, 404);
      assert.equal(missingRes.body.code, 'analytics/order-not-found');

      const cancelledRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'order_confirmed',
          sourceId: 'order_cancelled',
          listingId: 'listing_1',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(cancelledRes.status, 400);
      assert.equal(cancelledRes.body.code, 'analytics/invalid-order-status');

      const refundedRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'order_confirmed',
          sourceId: 'order_refunded',
          listingId: 'listing_1',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(refundedRes.status, 400);
      assert.equal(refundedRes.body.code, 'analytics/invalid-order-status');

      const noSourceRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'order_confirmed',
          listingId: 'listing_1',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(noSourceRes.status, 400);
      assert.equal(noSourceRes.body.code, 'analytics/invalid-source-id');

      assert.equal(repo.verifiedMarkers.size, 0);
      assert.equal(repo.recordFunnelCalls, 0);
    });
  });

  it('7. Non-existent messageId is rejected (404)', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();

    await withTestServer(repo, { buyer_tok: 'buyer_1' }, async (baseUrl) => {
      const res = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'contact_confirmed',
          sourceId: 'fabricated_msg_id_123',
          listingId: 'listing_1',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(res.status, 404);
      assert.equal(res.body.recorded, false);
      assert.equal(res.body.code, 'analytics/message-not-found');
      assert.equal(repo.verifiedMarkers.size, 0);
      assert.equal(repo.recordFunnelCalls, 0);
    });
  });

  it('8. Spoofing sellerId or listingId on an authentic order is rejected', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.orders.set('order_1', {
      id: 'order_1',
      listingId: 'listing_real',
      buyerId: 'buyer_1',
      sellerId: 'seller_real',
      status: 'pending',
    });

    await withTestServer(repo, { buyer_tok: 'buyer_1' }, async (baseUrl) => {
      const spoofSellerRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_spoofed',
          eventType: 'order_confirmed',
          sourceId: 'order_1',
          listingId: 'listing_real',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(spoofSellerRes.status, 403);
      assert.equal(spoofSellerRes.body.code, 'analytics/seller-mismatch');

      const spoofListingRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_real',
          eventType: 'order_confirmed',
          sourceId: 'order_1',
          listingId: 'listing_spoofed',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(spoofListingRes.status, 400);
      assert.equal(spoofListingRes.body.code, 'analytics/listing-mismatch');

      assert.equal(repo.verifiedMarkers.size, 0);
      assert.equal(repo.recordFunnelCalls, 0);
    });
  });

  it('9. Spoofing sellerId or participants on an authentic market message is rejected', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.marketMessages.set('msg_1', {
      id: 'msg_1',
      listingId: 'listing_real',
      senderId: 'buyer_1',
      receiverId: 'seller_real',
      buyerId: 'buyer_1',
      sellerId: 'seller_real',
      participants: ['buyer_1', 'seller_real'],
    });
    repo.marketMessages.set('msg_bad_participants', {
      id: 'msg_bad_participants',
      listingId: 'listing_real',
      senderId: 'buyer_1',
      receiverId: 'seller_real',
      buyerId: 'buyer_1',
      sellerId: 'seller_real',
      participants: ['buyer_1', 'other_seller'],
    });

    await withTestServer(repo, { buyer_tok: 'buyer_1' }, async (baseUrl) => {
      const spoofSellerRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_spoofed',
          eventType: 'contact_confirmed',
          sourceId: 'msg_1',
          listingId: 'listing_real',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(spoofSellerRes.status, 403);
      assert.equal(spoofSellerRes.body.code, 'analytics/seller-mismatch');

      const badParticipantsRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_real',
          eventType: 'contact_confirmed',
          sourceId: 'msg_bad_participants',
          listingId: 'listing_real',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(badParticipantsRes.status, 403);
      assert.equal(badParticipantsRes.body.code, 'analytics/message-participants-mismatch');

      assert.equal(repo.verifiedMarkers.size, 0);
      assert.equal(repo.recordFunnelCalls, 0);
    });
  });

  it('10. Real valid order is recorded accurately and duplicate replay is blocked by Verified Marker', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.orders.set('order_valid_1', {
      id: 'order_valid_1',
      listingId: 'listing_1',
      buyerId: 'buyer_1',
      sellerId: 'seller_1',
      status: 'pending',
    });
    repo.orders.set('order_valid_2', {
      id: 'order_valid_2',
      listingId: 'listing_1',
      buyerId: 'buyer_1',
      sellerId: 'seller_1',
      status: 'booked',
    });

    await withTestServer(repo, { buyer_tok: 'buyer_1' }, async (baseUrl) => {
      const res1 = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'order_confirmed',
          sourceId: 'order_valid_1',
          listingId: 'listing_1',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(res1.status, 200);
      assert.equal(res1.body.recorded, true);

      const sellerDocAfter1 = repo.sellerAnalytics.get('seller_1');
      assert(sellerDocAfter1);
      assert.equal(sellerDocAfter1.ordersConfirmed, 1);
      assert.equal(sellerDocAfter1.uniqueOrderBuyers, 1);

      const expectedMarkerId = buildVerifiedFunnelMarkerId('order_confirmed', 'order_valid_1');
      const marker = repo.verifiedMarkers.get(expectedMarkerId);
      assert(marker);
      assert.equal(marker.markerType, 'order_confirmed');
      assert.equal(marker.sellerId, 'seller_1');
      assert.equal(marker.sourceId, 'order_valid_1');
      assert.equal(marker.listingId, 'listing_1');

      // Replay of same order_valid_1 must be blocked cleanly
      const replayRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'order_confirmed',
          sourceId: 'order_valid_1',
          listingId: 'listing_1',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.recorded, false);
      assert.equal(replayRes.body.reason, 'duplicate_verified_marker');
      assert.equal(repo.sellerAnalytics.get('seller_1')?.ordersConfirmed, 1);
      assert.equal(repo.sellerAnalytics.get('seller_1')?.uniqueOrderBuyers, 1);

      // Second distinct order by same buyer increments ordersConfirmed to 2 while uniqueOrderBuyers stays 1
      const res2 = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'order_confirmed',
          sourceId: 'order_valid_2',
          listingId: 'listing_1',
        },
        { bearerToken: 'buyer_tok' }
      );
      assert.equal(res2.status, 200);
      assert.equal(res2.body.recorded, true);
      assert.equal(repo.sellerAnalytics.get('seller_1')?.ordersConfirmed, 2);
      assert.equal(repo.sellerAnalytics.get('seller_1')?.uniqueOrderBuyers, 1);
    });
  });

  it('11. Real valid market message is recorded accurately and duplicate replay is blocked by Verified Marker', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.marketMessages.set('msg_valid_1', {
      id: 'msg_valid_1',
      listingId: 'listing_9',
      senderId: 'buyer_2',
      receiverId: 'seller_9',
      buyerId: 'buyer_2',
      sellerId: 'seller_9',
      participants: ['buyer_2', 'seller_9'],
    });

    await withTestServer(repo, { buyer2_tok: 'buyer_2' }, async (baseUrl) => {
      const res1 = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_9',
          eventType: 'contact_confirmed',
          sourceId: 'msg_valid_1',
          listingId: 'listing_9',
        },
        { bearerToken: 'buyer2_tok' }
      );
      assert.equal(res1.status, 200);
      assert.equal(res1.body.recorded, true);

      const sellerDoc = repo.sellerAnalytics.get('seller_9');
      assert(sellerDoc);
      assert.equal(sellerDoc.contactConfirmed, 1);
      assert.equal(sellerDoc.uniqueContactedBuyers, 1);

      const expectedMarkerId = buildVerifiedFunnelMarkerId('contact_confirmed', 'msg_valid_1');
      const marker = repo.verifiedMarkers.get(expectedMarkerId);
      assert(marker);
      assert.equal(marker.markerType, 'contact_confirmed');
      assert.equal(marker.sellerId, 'seller_9');
      assert.equal(marker.sourceId, 'msg_valid_1');
      assert.equal(marker.listingId, 'listing_9');

      // Duplicate replay blocked
      const replayRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_9',
          eventType: 'contact_confirmed',
          sourceId: 'msg_valid_1',
          listingId: 'listing_9',
        },
        { bearerToken: 'buyer2_tok' }
      );
      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.recorded, false);
      assert.equal(replayRes.body.reason, 'duplicate_verified_marker');
      assert.equal(repo.sellerAnalytics.get('seller_9')?.contactConfirmed, 1);
      assert.equal(repo.sellerAnalytics.get('seller_9')?.uniqueContactedBuyers, 1);
    });
  });

  it('12. Unverified/rejected attempts never create or pre-occupy Verified Markers', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.orders.set('order_protected_1', {
      id: 'order_protected_1',
      listingId: 'listing_1',
      buyerId: 'real_buyer',
      sellerId: 'seller_1',
      status: 'pending',
    });
    repo.marketMessages.set('msg_protected_1', {
      id: 'msg_protected_1',
      listingId: 'listing_1',
      senderId: 'real_buyer',
      receiverId: 'seller_1',
      buyerId: 'real_buyer',
      sellerId: 'seller_1',
      participants: ['real_buyer', 'seller_1'],
    });

    await withTestServer(
      repo,
      { attacker_tok: 'attacker_uid', real_buyer_tok: 'real_buyer' },
      async (baseUrl) => {
        // Guest + Attacker try to pre-claim the real orderId and messageId first
        const guestOrderAttempt = await postFunnelEvent(baseUrl, {
          sellerId: 'seller_1',
          eventType: 'order_confirmed',
          visitorToken: 'guest_attacker_token',
          sourceId: 'order_protected_1',
          listingId: 'listing_1',
        });
        assert.equal(guestOrderAttempt.status, 401);

        const attackerOrderAttempt = await postFunnelEvent(
          baseUrl,
          {
            sellerId: 'seller_1',
            eventType: 'order_confirmed',
            sourceId: 'order_protected_1',
            listingId: 'listing_1',
          },
          { bearerToken: 'attacker_tok' }
        );
        assert.equal(attackerOrderAttempt.status, 403);

        const attackerMsgAttempt = await postFunnelEvent(
          baseUrl,
          {
            sellerId: 'seller_1',
            eventType: 'contact_confirmed',
            sourceId: 'msg_protected_1',
            listingId: 'listing_1',
          },
          { bearerToken: 'attacker_tok' }
        );
        assert.equal(attackerMsgAttempt.status, 403);

        // Zero markers claimed by any failed attempt
        assert.equal(repo.claimMarkerCalls, 0);
        assert.equal(repo.verifiedMarkers.size, 0);

        // Real buyer can still confirm both order and message cleanly without marker poisoning
        const realOrderRes = await postFunnelEvent(
          baseUrl,
          {
            sellerId: 'seller_1',
            eventType: 'order_confirmed',
            sourceId: 'order_protected_1',
            listingId: 'listing_1',
          },
          { bearerToken: 'real_buyer_tok' }
        );
        assert.equal(realOrderRes.status, 200);
        assert.equal(realOrderRes.body.recorded, true);

        const realMsgRes = await postFunnelEvent(
          baseUrl,
          {
            sellerId: 'seller_1',
            eventType: 'contact_confirmed',
            sourceId: 'msg_protected_1',
            listingId: 'listing_1',
          },
          { bearerToken: 'real_buyer_tok' }
        );
        assert.equal(realMsgRes.status, 200);
        assert.equal(realMsgRes.body.recorded, true);
        assert.equal(repo.claimMarkerCalls, 2);
        assert.equal(repo.verifiedMarkers.size, 2);
      }
    );
  });

  it('13. Non-confirmed funnel events (seller_profile_view, listing_to_seller, contact_click, order_intent) keep Guest & Auth support unchanged', async () => {
    const repo = new InMemoryPhase2cAnalyticsRepo();
    repo.sellers.set('seller_1', { id: 'seller_1', exists: true, sellerName: 'Seller One' });
    repo.listings.set('listing_1', {
      id: 'listing_1',
      sellerId: 'seller_1',
      title: 'Listing One',
      category: 'electronics',
      status: 'active',
    });
    await withTestServer(repo, { auth_tok: 'auth_user_1' }, async (baseUrl) => {
      const guestEvents: MarketFunnelEventType[] = [
        'seller_profile_view',
        'listing_to_seller',
        'contact_click',
        'order_intent',
      ];
      for (const ev of guestEvents) {
        const res = await postFunnelEvent(baseUrl, {
          sellerId: 'seller_1',
          eventType: ev,
          visitorToken: 'guest_regular_visitor_1',
          listingId: 'listing_1',
        });
        assert.equal(res.status, 200, `Guest should still succeed for ${ev}`);
        assert.equal(res.body.recorded, true, `Guest should record ${ev}`);
      }

      const authRes = await postFunnelEvent(
        baseUrl,
        {
          sellerId: 'seller_1',
          eventType: 'contact_click',
          listingId: 'listing_1',
        },
        { bearerToken: 'auth_tok' }
      );
      assert.equal(authRes.status, 200);
      assert.equal(authRes.body.recorded, true);

      const sellerDoc = repo.sellerAnalytics.get('seller_1');
      assert(sellerDoc);
      assert.equal(sellerDoc.profileViews, 1);
      assert.equal(sellerDoc.listingToSellerClicks, 1);
      assert.equal(sellerDoc.contactClicks, 2);
      assert.equal(sellerDoc.orderIntents, 1);
    });
  });
});
