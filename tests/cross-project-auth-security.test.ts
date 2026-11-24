import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createApiApp,
  getTrustedFirebaseProjectIds,
  verifyFirebaseTokenDirectly,
} from '../src/serverApp.js';
import {
  AnalyticsRepository,
  ListingRecordForAnalytics,
  MarketAnalyticsService,
  MarketEventType,
  ViewerMarkerDoc,
} from '../src/lib/analyticsServer.js';
import {
  RawListingAnalyticsDoc,
  computeSellerFunnelTransactionUpdate,
  createEmptySellerAnalyticsDoc,
  getDayBucketKey,
} from '../src/lib/marketAnalyticsUtils.js';

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createSignedJwt(params: {
  privateKeyPem: string;
  kid: string;
  alg?: string;
  aud: string;
  iss: string;
  sub: string;
  expOffsetSec?: number;
  iatOffsetSec?: number;
  email?: string;
}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = {
    alg: params.alg ?? 'RS256',
    typ: 'JWT',
    kid: params.kid,
  };
  const payload = {
    aud: params.aud,
    iss: params.iss,
    sub: params.sub,
    user_id: params.sub,
    auth_time: nowSec - 10,
    iat: nowSec + (params.iatOffsetSec ?? -5),
    exp: nowSec + (params.expOffsetSec ?? 3600),
    email: params.email ?? 'test@proton.app',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  if (header.alg === 'none') {
    return `${signingInput}.`;
  }

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(params.privateKeyPem);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

class InMemoryAnalyticsRepo implements AnalyticsRepository {
  public listings = new Map<string, ListingRecordForAnalytics>();
  public sellerPrefs = new Map<string, boolean>();
  public sellerDocs = new Map<string, any>();
  public viewerDocs = new Map<string, any>();
  public publicDocs = new Map<string, RawListingAnalyticsDoc>();
  public analyticsDocs = new Map<string, RawListingAnalyticsDoc>();
  public viewerMarkers = new Map<string, Map<string, ViewerMarkerDoc>>();

  async getListing(listingId: string) {
    return this.listings.get(listingId) || null;
  }

  async getSellerForAnalytics(sellerId: string) {
    const hasListing = Array.from(this.listings.values()).some((l) => l.sellerId === sellerId);
    if (!hasListing && !this.sellerPrefs.has(sellerId)) {
      return { id: sellerId, exists: false };
    }
    return {
      id: sellerId,
      exists: true,
      sellerName: 'Test Seller',
      country: 'GEO',
      optedOut: this.sellerPrefs.get(sellerId) ?? false,
    };
  }

  async getSellerProfileLocation(sellerId: string) {
    return { country: 'GEO', region: 'Tbilisi', optedOut: this.sellerPrefs.get(sellerId) ?? false };
  }

  async getSellerListings(sellerId: string) {
    return Array.from(this.listings.values()).filter((l) => l.sellerId === sellerId);
  }

  async getListingAnalyticsDoc(listingId: string) {
    return this.analyticsDocs.get(listingId) || null;
  }

  async getAllPublicAnalyticsDocs() {
    return Array.from(this.publicDocs.values());
  }

  async getSellerRatingsMap() {
    return {};
  }

  async recordEventTransaction(params: {
    listing: ListingRecordForAnalytics;
    sellerLocation: { country?: string; region?: string; optedOut?: boolean };
    viewerHash: string;
    viewerType: 'auth' | 'guest';
    eventType: MarketEventType;
    nowMs: number;
  }) {
    const markers = this.viewerMarkers.get(params.listing.id) || new Map<string, ViewerMarkerDoc>();
    this.viewerMarkers.set(params.listing.id, markers);
    const existing = markers.get(params.viewerHash);
    if (existing) {
      return { recorded: false, reason: 'cooldown', uniqueIncremented: false };
    }
    markers.set(params.viewerHash, { viewerHash: params.viewerHash, viewerType: params.viewerType });
    return { recorded: true, uniqueIncremented: true };
  }

  async setSellerCompetitionOptOut(sellerId: string, optedOut: boolean) {
    this.sellerPrefs.set(sellerId, optedOut);
  }

  async recordSellerFunnelEvent(params: any) {
    const existingSeller =
      this.sellerDocs.get(params.sellerId) ||
      createEmptySellerAnalyticsDoc({ sellerId: params.sellerId, nowMs: params.nowMs || Date.now() });
    const viewerKey = `${params.sellerId}:${params.viewerHash}`;
    const existingViewer = this.viewerDocs.get(viewerKey) || null;
    const update = computeSellerFunnelTransactionUpdate({
      sellerId: params.sellerId,
      eventType: params.eventType,
      viewerHash: params.viewerHash,
      viewerType: params.viewerType,
      existingSeller,
      existingViewer,
      sellerMeta: params.sellerMeta,
      nowMs: params.nowMs || Date.now(),
    });
    if (update.recorded) {
      this.sellerDocs.set(params.sellerId, update.nextSellerDoc);
      this.viewerDocs.set(viewerKey, update.nextViewerDoc);
    }
    return { recorded: update.recorded, reason: update.reason };
  }
}

function sendHttpRequest(
  handler: any,
  opts: { method: string; path: string; headers?: Record<string, string>; body?: any }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      const payload = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
      const headers: Record<string, string> = { ...(opts.headers || {}) };
      if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload).toString();
      }
      const req = http.request(
        { hostname: '127.0.0.1', port, path: opts.path, method: opts.method, headers },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => {
            server.close();
            let parsed = raw;
            try {
              parsed = JSON.parse(raw);
            } catch {}
            resolve({ status: res.statusCode || 500, body: parsed });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

describe('Cross-Project Firebase Authentication Security Verification', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const testKid = 'test-google-key-1';
  const getTestCerts = async () => ({ [testKid]: publicKey });

  const validJpegUri =
    'data:image/jpeg;base64,' +
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]).toString('base64');

  function buildTestApp() {
    const repo = new InMemoryAnalyticsRepo();
    repo.listings.set('listing_a', {
      id: 'listing_a',
      sellerId: 'user_a',
      title: 'Listing A',
      category: 'software',
      status: 'active',
      country: 'GEO',
      createdAt: Date.now(),
    });
    repo.listings.set('listing_b', {
      id: 'listing_b',
      sellerId: 'user_b',
      title: 'Listing B',
      category: 'software',
      status: 'active',
      country: 'GEO',
      createdAt: Date.now(),
    });
    const todayKey = getDayBucketKey(Date.now());
    repo.publicDocs.set('listing_a', {
      listingId: 'listing_a',
      sellerId: 'user_a',
      title: 'Listing A',
      category: 'software',
      listingType: 'project',
      status: 'active',
      country: 'GEO',
      impressions: 25,
      views: 10,
      uniqueViewers: 8,
      hourly: {},
      daily: {
        [todayKey]: { impressions: 25, views: 10, uniqueViewers: 8 },
      },
    });

    const analyticsService = new MarketAnalyticsService(repo, 'test-salt-with-sufficient-entropy-0123456789');
    const app = createApiApp({
      analyticsService,
      getPublicCerts: getTestCerts,
    });
    return { app, repo };
  }

  it('A. Rejects cryptographically valid token issued by an external Firebase project across ALL protected endpoints (HTTP 401)', async () => {
    const { app, repo } = buildTestApp();
    const foreignProjectToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'attacker-firebase-project',
      iss: 'https://securetoken.google.com/attacker-firebase-project',
      sub: 'user_b', // Attempting cross-project UID impersonation of user_b
    });

    const authHeaders = {
      Authorization: `Bearer ${foreignProjectToken}`,
      'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0',
    };

    const checks: Array<{ method: string; path: string; body?: any }> = [
      { method: 'POST', path: '/api/storage/upload-listing-image', body: { image: validJpegUri, productId: 'p1' } },
      { method: 'POST', path: '/api/storage/delete-listing-image', body: { path: 'user_b/img.jpg' } },
      { method: 'DELETE', path: '/api/storage/file/user_b/img.jpg' },
      { method: 'POST', path: '/api/storage/create-clip-upload-url', body: { fileExt: 'mp4' } },
      { method: 'POST', path: '/api/storage/delete-clip-video', body: { path: 'user_b/clip_1.mp4' } },
      { method: 'GET', path: '/api/market/listing-stats?listingId=listing_b' },
      { method: 'POST', path: '/api/market/competition-preference', body: { optedOut: true } },
      { method: 'POST', path: '/api/market/listing-event', body: { listingId: 'listing_b', eventType: 'view' } },
      { method: 'POST', path: '/api/market/seller-funnel-event', body: { sellerId: 'user_b', eventType: 'seller_profile_view' } },
      { method: 'POST', path: '/api/market/seller-funnel-event', body: { sellerId: 'user_b', eventType: 'order_confirmed', sourceId: 'ord_1' } },
    ];

    for (const check of checks) {
      const res = await sendHttpRequest(app, {
        method: check.method,
        path: check.path,
        headers: authHeaders,
        body: check.body,
      });
      assert.strictEqual(res.status, 401, `${check.method} ${check.path} must return 401 for foreign Firebase project token`);
    }

    assert.strictEqual(repo.sellerPrefs.has('user_b'), false, 'Foreign token must never mutate seller preferences');
    assert.strictEqual(repo.viewerMarkers.size, 0, 'Foreign token must never record authenticated analytics events');
  });

  it('B. Accepts valid PROTON Firebase token (aud=proton-core-ai) and executes legitimate operations', async () => {
    const { app, repo } = buildTestApp();
    const validProtonToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/proton-core-ai',
      sub: 'user_a',
    });

    const headers = {
      Authorization: `Bearer ${validProtonToken}`,
      'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0',
    };

    const statsRes = await sendHttpRequest(app, {
      method: 'GET',
      path: '/api/market/listing-stats?listingId=listing_a',
      headers,
    });
    assert.strictEqual(statsRes.status, 200);
    assert.strictEqual(statsRes.body.listing.listingId, 'listing_a');

    const prefRes = await sendHttpRequest(app, {
      method: 'POST',
      path: '/api/market/competition-preference',
      headers,
      body: { optedOut: true },
    });
    assert.strictEqual(prefRes.status, 200);
    assert.strictEqual(repo.sellerPrefs.get('user_a'), true);

    const eventRes = await sendHttpRequest(app, {
      method: 'POST',
      path: '/api/market/listing-event',
      headers,
      body: { listingId: 'listing_b', eventType: 'view' },
    });
    assert.strictEqual(eventRes.status, 200);
    assert.strictEqual(eventRes.body.recorded, true);

    // Storage routes pass authentication (may return 503 if SUPABASE_SERVICE_ROLE_KEY is unset locally, never 401)
    const uploadRes = await sendHttpRequest(app, {
      method: 'POST',
      path: '/api/storage/upload-listing-image',
      headers,
      body: { image: validJpegUri, productId: 'prod_a' },
    });
    assert.notStrictEqual(uploadRes.status, 401);

    const clipUrlRes = await sendHttpRequest(app, {
      method: 'POST',
      path: '/api/storage/create-clip-upload-url',
      headers,
      body: { fileExt: 'mp4' },
    });
    assert.notStrictEqual(clipUrlRes.status, 401);
  });

  it('C. Rejects malformed, tampered, expired, alg=none, wrong iss/aud, and Firestore Database ID as Project ID', async () => {
    const { app } = buildTestApp();
    const dbId = 'ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51';

    // Ensure trusted server allowlist never includes the Firestore database ID or foreign env project IDs
    const prevEnvProj = process.env.FIREBASE_PROJECT_ID;
    const prevViteProj = process.env.VITE_FIREBASE_PROJECT_ID;
    process.env.FIREBASE_PROJECT_ID = dbId;
    process.env.VITE_FIREBASE_PROJECT_ID = 'untrusted-vite-project';
    try {
      const trusted = getTrustedFirebaseProjectIds();
      assert.strictEqual(trusted.includes(dbId), false, 'Firestore database ID must never be trusted as a Firebase Project ID');
      assert.strictEqual(trusted.includes('untrusted-vite-project'), false, 'VITE_FIREBASE_PROJECT_ID must not be trusted on server');
      assert.deepStrictEqual(trusted, ['proton-core-ai']);

      process.env.FIREBASE_PROJECT_ID = 'foreign-firebase-project';
      assert.deepStrictEqual(
        getTrustedFirebaseProjectIds(),
        ['proton-core-ai'],
        'FIREBASE_PROJECT_ID must not expand trusted project allowlist to non-PROTON projects'
      );
    } finally {
      if (prevEnvProj === undefined) delete process.env.FIREBASE_PROJECT_ID;
      else process.env.FIREBASE_PROJECT_ID = prevEnvProj;
      if (prevViteProj === undefined) delete process.env.VITE_FIREBASE_PROJECT_ID;
      else process.env.VITE_FIREBASE_PROJECT_ID = prevViteProj;
    }

    const trustedProjects = ['proton-core-ai'];

    // 1. Wrong iss with proton-core-ai aud
    const wrongIss = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/evil-project',
      sub: 'user_a',
    });
    assert.strictEqual(await verifyFirebaseTokenDirectly(wrongIss, trustedProjects, getTestCerts), null);

    // 2. Tampered signature
    const validToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/proton-core-ai',
      sub: 'user_a',
    });
    const parts = validToken.split('.');
    const tamperedSig = parts[2].slice(0, -2) + (parts[2].endsWith('AA') ? 'BB' : 'AA');
    assert.strictEqual(
      await verifyFirebaseTokenDirectly(`${parts[0]}.${parts[1]}.${tamperedSig}`, trustedProjects, getTestCerts),
      null
    );

    // 3. Expired token (even 60 seconds ago)
    const expiredToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/proton-core-ai',
      sub: 'user_a',
      expOffsetSec: -60,
      iatOffsetSec: -3660,
    });
    assert.strictEqual(await verifyFirebaseTokenDirectly(expiredToken, trustedProjects, getTestCerts), null);

    // 4. alg: none
    const algNoneToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      alg: 'none',
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/proton-core-ai',
      sub: 'user_a',
    });
    assert.strictEqual(await verifyFirebaseTokenDirectly(algNoneToken, trustedProjects, getTestCerts), null);

    // 5. Wrong aud
    const wrongAudToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'another-project',
      iss: 'https://securetoken.google.com/another-project',
      sub: 'user_a',
    });
    assert.strictEqual(await verifyFirebaseTokenDirectly(wrongAudToken, trustedProjects, getTestCerts), null);

    // 6. Firestore Database ID used as aud/iss (cryptographically signed)
    const dbIdAsProjectToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: dbId,
      iss: `https://securetoken.google.com/${dbId}`,
      sub: 'user_a',
    });
    assert.strictEqual(await verifyFirebaseTokenDirectly(dbIdAsProjectToken, trustedProjects, getTestCerts), null);

    for (const badToken of [wrongIss, `${parts[0]}.${parts[1]}.${tamperedSig}`, expiredToken, algNoneToken, wrongAudToken, dbIdAsProjectToken]) {
      const res = await sendHttpRequest(app, {
        method: 'GET',
        path: '/api/market/listing-stats',
        headers: { Authorization: `Bearer ${badToken}` },
      });
      assert.strictEqual(res.status, 401);
    }
  });

  it('D. Enforces strict ownership isolation for authenticated PROTON users', async () => {
    const { app, repo } = buildTestApp();
    const userAToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/proton-core-ai',
      sub: 'user_a',
    });
    const headers = { Authorization: `Bearer ${userAToken}` };

    const delImgRes = await sendHttpRequest(app, {
      method: 'POST',
      path: '/api/storage/delete-listing-image',
      headers,
      body: { path: 'user_b/secret.jpg' },
    });
    assert.strictEqual(delImgRes.status, 403);
    assert.strictEqual(delImgRes.body.code, 'storage/ownership-mismatch');

    const delClipRes = await sendHttpRequest(app, {
      method: 'POST',
      path: '/api/storage/delete-clip-video',
      headers,
      body: { path: 'user_b/clip_99.mp4' },
    });
    assert.strictEqual(delClipRes.status, 403);
    assert.strictEqual(delClipRes.body.code, 'storage/ownership-mismatch');

    const otherStatsRes = await sendHttpRequest(app, {
      method: 'GET',
      path: '/api/market/listing-stats?listingId=listing_b',
      headers,
    });
    assert.strictEqual(otherStatsRes.status, 403);
    assert.strictEqual(otherStatsRes.body.code, 'analytics/forbidden');

    await sendHttpRequest(app, {
      method: 'POST',
      path: '/api/market/competition-preference',
      headers,
      body: { optedOut: true },
    });
    assert.strictEqual(repo.sellerPrefs.get('user_a'), true);
    assert.strictEqual(repo.sellerPrefs.has('user_b'), false);
  });

  it('E. Preserves unauthenticated public browsing for Market Hub rankings, guest analytics, storage media, and Firestore public rules', async () => {
    const { app } = buildTestApp();

    // 1. Public rankings without Authorization header
    const rankingsRes = await sendHttpRequest(app, {
      method: 'GET',
      path: '/api/market/rankings?scope=global&period=7d',
    });
    assert.strictEqual(rankingsRes.status, 200);
    assert.ok(Array.isArray(rankingsRes.body.rankings));
    assert.strictEqual(rankingsRes.body.rankings.length, 1);
    assert.strictEqual(rankingsRes.body.rankings[0].listingId, 'listing_a');

    // 2. Guest listing analytics with visitorToken and NO Authorization header
    const guestListingEvt = await sendHttpRequest(app, {
      method: 'POST',
      path: '/api/market/listing-event',
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0' },
      body: { listingId: 'listing_a', eventType: 'view', visitorToken: 'guest_visitor_token_123' },
    });
    assert.strictEqual(guestListingEvt.status, 200);
    assert.strictEqual(guestListingEvt.body.recorded, true);

    // 3. Guest funnel analytics without Authorization header
    const guestFunnelEvt = await sendHttpRequest(app, {
      method: 'POST',
      path: '/api/market/seller-funnel-event',
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0' },
      body: { sellerId: 'user_a', eventType: 'seller_profile_view', visitorToken: 'guest_visitor_token_123' },
    });
    assert.strictEqual(guestFunnelEvt.status, 200);
    assert.strictEqual(guestFunnelEvt.body.recorded, true);

    // 4. Public media proxy route does not return 401 when unauthenticated
    const mediaRes = await sendHttpRequest(app, {
      method: 'GET',
      path: '/api/storage/file/user_a/nonexistent_test_probe.jpg',
    });
    assert.notStrictEqual(mediaRes.status, 401);

    // 5. Verify firestore.rules still keeps Market Hub & Clips public read rules open
    const rulesContent = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
    assert.match(rulesContent, /match \/listings\/\{listingId\}\s*\{\s*allow read:\s*if true;/);
    assert.match(rulesContent, /match \/clips\/\{clipId\}\s*\{\s*allow read:\s*if true;/);
    assert.match(rulesContent, /match \/comments\/\{commentId\}\s*\{\s*allow read:\s*if true;/);
    assert.match(rulesContent, /match \/listing_analytics_public\/\{listingId\}\s*\{\s*allow read:\s*if true;/);
  });
});
