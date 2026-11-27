import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import app, { createApiApp } from '../src/serverApp.js';
import vercelHandler from '../api/index.js';
import {
  AnalyticsConfigError,
  MarketAnalyticsService,
  getAdminFirestoreInstance,
  isAdminCredentialsError,
  parseServiceAccountJson,
  resetAdminFirestoreCacheForTests,
} from '../src/lib/analyticsServer.js';

describe('Vercel API Adapter & Shared ServerApp Suite', () => {
  function makeRequest(
    handler: (req: any, res: any) => any,
    options: {
      method: string;
      path: string;
      headers?: Record<string, string>;
      body?: any;
      inspectReq?: (req: http.IncomingMessage) => void;
    }
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const result = handler(req, res);
        if (options.inspectReq) {
          options.inspectReq(req);
        }
        return result;
      });

      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as any).port;
        const postData = options.body !== undefined ? JSON.stringify(options.body) : undefined;
        const reqHeaders: Record<string, string> = {
          ...(options.headers || {})
        };
        if (postData) {
          reqHeaders['Content-Type'] = 'application/json';
          reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
        }

        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: options.path,
          method: options.method,
          headers: reqHeaders,
        }, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            server.close();
            let parsedBody = data;
            try {
              parsedBody = JSON.parse(data);
            } catch {}
            resolve({
              status: res.statusCode || 500,
              headers: res.headers,
              body: parsedBody
            });
          });
        });

        req.on('error', (err) => {
          server.close();
          reject(err);
        });

        if (postData) {
          req.write(postData);
        }
        req.end();
      });
    });
  }

  it('1. GET /api/health returns 200 OK without exposing server secret configuration indicators', async () => {
    const res = await makeRequest(app, { method: 'GET', path: '/api/health' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(res.body.timestamp);
    assert.ok(res.body.environment);
    assert.ok(['vercel', 'server'].includes(res.body.environment.platform));
    assert.strictEqual('supabaseServiceRoleKey' in res.body.environment, false);
    assert.strictEqual('geminiApiKey' in res.body.environment, false);
    assert.strictEqual(res.body.environment.supabaseServiceRoleKey, undefined);
    assert.strictEqual(res.body.environment.geminiApiKey, undefined);
    // Verify no secret value is leaked
    const jsonStr = JSON.stringify(res.body);
    assert.strictEqual(jsonStr.includes('eyJ'), false);
    assert.strictEqual(jsonStr.includes('AIza'), false);
  });

  it('2. GET /health (un-prefixed rewrite alias) returns 200 OK', async () => {
    const res = await makeRequest(app, { method: 'GET', path: '/health' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  it('3. POST /api/storage/upload-listing-image without token rejects with 401 Unauthorized (NOT 404)', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/storage/upload-listing-image',
      body: { image: 'data:image/jpeg;base64,123' }
    });
    assert.strictEqual(res.status, 401);
    assert.match(res.body.error, /Missing or invalid Authorization/);
  });

  it('4. POST /api/storage/upload-listing-image with invalid token rejects with 401 Unauthorized', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/storage/upload-listing-image',
      headers: { 'Authorization': 'Bearer INVALID_FORGED_TOKEN' },
      body: { image: 'data:image/jpeg;base64,123' }
    });
    assert.strictEqual(res.status, 401);
    assert.match(res.body.error, /Invalid or expired Firebase/);
  });

  it('5. POST /api/gemini returns 400 Bad Request on unknown action (NOT 404)', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/gemini',
      body: { action: 'unknownTestRoute' }
    });
    assert.strictEqual(res.status, 400);
  });

  it('6. Vercel Handler entry point (api/index.js) processes /api/health successfully', async () => {
    const res = await makeRequest(vercelHandler, {
      method: 'GET',
      path: '/api/health'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  it('7. Vercel Handler entry point processes rewrites using x-matched-path header', async () => {
    // Simulating Vercel rewriting /api/storage/upload-listing-image to /api
    const res = await makeRequest(vercelHandler, {
      method: 'POST',
      path: '/api',
      headers: {
        'x-matched-path': '/api/storage/upload-listing-image'
      },
      body: { image: 'data:image/jpeg;base64,123' }
    });
    // Should be routed to /api/storage/upload-listing-image and return 401, NOT 404
    assert.strictEqual(res.status, 401);
    assert.match(res.body.error, /Missing or invalid Authorization/);
  });

  it('8. api/index.js bundle exists and is directly loadable by pure Node.js runtime', () => {
    assert.strictEqual(typeof vercelHandler, 'function', 'vercelHandler must export a function or express app');
  });

  it('9. Preserves query params and strips rewrite param `1` for /api/market/rankings?scope=country&period=30d&country=GEO', async () => {
    let restoredUrl = '';
    let capturedQuery: Record<string, any> | undefined;

    const res = await makeRequest(vercelHandler, {
      method: 'GET',
      path: '/api?1=market%2Frankings&scope=country&period=30d&country=GEO',
      inspectReq: (req) => {
        restoredUrl = (req as any).originalUrl || req.url || '';
        capturedQuery = (req as any).query;
      }
    });

    // Must reach the analytics rankings handler in api/index.js (503 when ADC missing), never 404
    assert.notStrictEqual(res.status, 404, 'api/index.js must route /api/market/rankings');
    assert.strictEqual(restoredUrl, '/api/market/rankings?scope=country&period=30d&country=GEO');
    assert.deepStrictEqual(capturedQuery, {
      scope: 'country',
      period: '30d',
      country: 'GEO',
    });
    assert.strictEqual('1' in (capturedQuery || {}), false, 'Technical rewrite param `1` must not appear in Express req.query');
  });

  it('10. Preserves query params across x-now-route-matches and x-matched-path for /api/market/listing-stats?listingId=XYZ', async () => {
    let restoredUrl1 = '';
    let capturedQuery1: Record<string, any> | undefined;
    const res1 = await makeRequest(vercelHandler, {
      method: 'GET',
      path: '/api?1=market%2Flisting-stats&listingId=XYZ',
      headers: {
        'x-now-route-matches': '1=market%2Flisting-stats'
      },
      inspectReq: (req) => {
        restoredUrl1 = (req as any).originalUrl || req.url || '';
        capturedQuery1 = (req as any).query;
      }
    });

    assert.strictEqual(res1.status, 401, 'listing-stats without Bearer token must return 401, not 404');
    assert.strictEqual(restoredUrl1, '/api/market/listing-stats?listingId=XYZ');
    assert.deepStrictEqual(capturedQuery1, { listingId: 'XYZ' });

    let restoredUrl2 = '';
    let capturedQuery2: Record<string, any> | undefined;
    const res2 = await makeRequest(vercelHandler, {
      method: 'GET',
      path: '/api?1=market%2Frankings&scope=country&period=30d&country=GEO',
      headers: {
        'x-matched-path': '/api/market/rankings'
      },
      inspectReq: (req) => {
        restoredUrl2 = (req as any).originalUrl || req.url || '';
        capturedQuery2 = (req as any).query;
      }
    });

    assert.notStrictEqual(res2.status, 404);
    assert.strictEqual(restoredUrl2, '/api/market/rankings?scope=country&period=30d&country=GEO');
    assert.deepStrictEqual(capturedQuery2, {
      scope: 'country',
      period: '30d',
      country: 'GEO',
    });
  });

  it('11. Handles malformed FIREBASE_SERVICE_ACCOUNT_JSON gracefully with 503 config error and zero secret leakage', async () => {
    const prevSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    await resetAdminFirestoreCacheForTests();

    try {
      // Direct parser checks: malformed JSON, missing fields, invalid PEM
      assert.throws(
        () => parseServiceAccountJson('{broken-secret-token-xyz'),
        (err: any) =>
          err instanceof AnalyticsConfigError &&
          err.code === 'analytics/admin-credentials-invalid' &&
          !err.message.includes('broken-secret-token-xyz')
      );

      assert.throws(
        () => parseServiceAccountJson("'{not-valid-json}'"),
        (err: any) =>
          err instanceof AnalyticsConfigError &&
          err.code === 'analytics/admin-credentials-invalid'
      );

      assert.throws(
        () => parseServiceAccountJson(JSON.stringify({ client_email: 'sa@proton-core-ai.iam.gserviceaccount.com', private_key: 'not-a-pem' })),
        (err: any) =>
          err instanceof AnalyticsConfigError &&
          err.code === 'analytics/admin-credentials-invalid'
      );

      // Runtime getAdminFirestoreInstance & HTTP route must return 503 instead of unhandled 500
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{"client_email":"sa@proton-core-ai.iam.gserviceaccount.com","private_key":"broken-secret-key-material"}';
      await assert.rejects(
        () => getAdminFirestoreInstance(),
        (err: any) => {
          assert.strictEqual(isAdminCredentialsError(err), true);
          assert.strictEqual(err.code, 'analytics/admin-credentials-invalid');
          assert.strictEqual(err.message.includes('broken-secret-key-material'), false);
          return true;
        }
      );

      const testApp = createApiApp();
      const res = await makeRequest(testApp, {
        method: 'GET',
        path: '/api/market/rankings?scope=global&period=7d',
      });
      assert.strictEqual(res.status, 503);
      assert.strictEqual(res.body.code, 'analytics/admin-credentials-invalid');
      assert.strictEqual(JSON.stringify(res.body).includes('broken-secret-key-material'), false);
    } finally {
      await resetAdminFirestoreCacheForTests();
      if (prevSa === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = prevSa;
    }
  });

  it('12. Strips outer quotes and normalizes literal `\\\\n` sequences in service account `private_key`', () => {
    const rawWithEscapedNewlines = JSON.stringify({
      type: 'service_account',
      project_id: 'proton-core-ai',
      client_email: 'analytics@proton-core-ai.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nLINE_ONE\\nLINE_TWO\\n-----END PRIVATE KEY-----\\n',
    });

    // Wrapped in outer single quotes as often happens when copying into env dashboards
    const parsed = parseServiceAccountJson(`'${rawWithEscapedNewlines}'`);
    assert.strictEqual(parsed.project_id, 'proton-core-ai');
    assert.strictEqual(parsed.client_email, 'analytics@proton-core-ai.iam.gserviceaccount.com');
    assert.strictEqual(parsed.private_key.includes('\\n'), false, 'Literal \\n must be converted to real newlines');
    assert.strictEqual(
      parsed.private_key,
      '-----BEGIN PRIVATE KEY-----\nLINE_ONE\nLINE_TWO\n-----END PRIVATE KEY-----\n'
    );
  });

  it('14. Enforces strict service account project_id === proton-core-ai validation and rejects foreign/missing project IDs', () => {
    const validSa = {
      type: 'service_account',
      project_id: 'proton-core-ai',
      client_email: 'sa@proton-core-ai.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD3\n-----END PRIVATE KEY-----\n',
    };

    // 1. Valid proton-core-ai project_id passes
    const parsed = parseServiceAccountJson(JSON.stringify(validSa));
    assert.strictEqual(parsed.project_id, 'proton-core-ai');

    // 2. Foreign project_id is strictly rejected
    const foreignSa = { ...validSa, project_id: 'attacker-firebase-project' };
    assert.throws(
      () => parseServiceAccountJson(JSON.stringify(foreignSa)),
      (err: any) => err instanceof AnalyticsConfigError && err.code === 'analytics/admin-credentials-invalid'
    );

    // 3. Missing project_id is strictly rejected
    const missingProjSa = { ...validSa };
    delete (missingProjSa as any).project_id;
    assert.throws(
      () => parseServiceAccountJson(JSON.stringify(missingProjSa)),
      (err: any) => err instanceof AnalyticsConfigError && err.code === 'analytics/admin-credentials-invalid'
    );
  });

  it('13. Enforces fail-closed 503 analytics/salt-missing in production when ANALYTICS_HASH_SALT is missing or weak, while preserving dev fallback', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevVercel = process.env.VERCEL;
    const prevSalt = process.env.ANALYTICS_HASH_SALT;
    const prevLegacySalt = process.env.ANALYTICS_SALT;

    const fakeRepo: any = {
      getListing: async (id: string) => ({
        id,
        sellerId: 'seller_1',
        title: 'Item',
        category: 'electronics',
        status: 'active',
        createdAt: Date.now(),
      }),
      getSellerProfileLocation: async () => ({ country: 'GEO', optedOut: false }),
      recordEventTransaction: async () => ({ recorded: true, uniqueIncremented: true }),
    };

    try {
      const service = new MarketAnalyticsService(fakeRepo);
      const testApp = createApiApp({ analyticsService: service });

      // 1. Production with missing salt -> fail-closed 503 analytics/salt-missing
      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL;
      delete process.env.ANALYTICS_HASH_SALT;
      delete process.env.ANALYTICS_SALT;

      const missingRes = await makeRequest(testApp, {
        method: 'POST',
        path: '/api/market/listing-event',
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36' },
        body: { listingId: 'listing_1', eventType: 'view', visitorToken: 'vst_guest_123456' },
      });
      assert.strictEqual(missingRes.status, 503);
      assert.strictEqual(missingRes.body.recorded, false);
      assert.strictEqual(missingRes.body.code, 'analytics/salt-missing');

      // 2. Production with short salt or hardcoded public default salt -> fail-closed 503
      process.env.ANALYTICS_HASH_SALT = 'too-short-salt';
      const shortRes = await makeRequest(testApp, {
        method: 'POST',
        path: '/api/market/listing-event',
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36' },
        body: { listingId: 'listing_1', eventType: 'view', visitorToken: 'vst_guest_123456' },
      });
      assert.strictEqual(shortRes.status, 503);
      assert.strictEqual(shortRes.body.code, 'analytics/salt-missing');

      process.env.ANALYTICS_HASH_SALT = 'proton-market-analytics-v1-salt';
      const defaultSaltRes = await makeRequest(testApp, {
        method: 'POST',
        path: '/api/market/listing-event',
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36' },
        body: { listingId: 'listing_1', eventType: 'view', visitorToken: 'vst_guest_123456' },
      });
      assert.strictEqual(defaultSaltRes.status, 503);
      assert.strictEqual(defaultSaltRes.body.code, 'analytics/salt-missing');

      // Direct computeViewerHash must also fail closed in production without salt
      delete process.env.ANALYTICS_HASH_SALT;
      assert.throws(
        () => service.computeViewerHash('listing_1', 'guest:vst_guest_123456'),
        (err: any) => err instanceof AnalyticsConfigError && err.code === 'analytics/salt-missing'
      );

      // 3. Production with strong 32+ char salt -> succeeds (200)
      process.env.ANALYTICS_HASH_SALT = 'a'.repeat(48);
      const validProdRes = await makeRequest(testApp, {
        method: 'POST',
        path: '/api/market/listing-event',
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36' },
        body: { listingId: 'listing_1', eventType: 'view', visitorToken: 'vst_guest_123456' },
      });
      assert.strictEqual(validProdRes.status, 200);
      assert.strictEqual(validProdRes.body.recorded, true);

      // 4. Development mode without salt -> preserves dev fallback (200)
      process.env.NODE_ENV = 'development';
      delete process.env.VERCEL;
      delete process.env.ANALYTICS_HASH_SALT;
      const devRes = await makeRequest(testApp, {
        method: 'POST',
        path: '/api/market/listing-event',
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36' },
        body: { listingId: 'listing_1', eventType: 'impression', visitorToken: 'vst_guest_123456' },
      });
      assert.strictEqual(devRes.status, 200);
      assert.strictEqual(devRes.body.recorded, true);
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
      if (prevSalt === undefined) delete process.env.ANALYTICS_HASH_SALT;
      else process.env.ANALYTICS_HASH_SALT = prevSalt;
      if (prevLegacySalt === undefined) delete process.env.ANALYTICS_SALT;
      else process.env.ANALYTICS_SALT = prevLegacySalt;
    }
  });

  it('14. Read-only production inspection: fetch public rankings, listing stats error handling, and existing listings count', async () => {
    const testApp = createApiApp();

    // 1. Fetch public rankings
    const rankingsRes = await makeRequest(testApp, {
      method: 'GET',
      path: '/api/market/rankings?scope=global&period=7d',
    });
    assert.ok([200, 503].includes(rankingsRes.status));
    assert.ok(Array.isArray(rankingsRes.body.rankings));
    console.log('[ReadOnly Audit] Public rankings status:', rankingsRes.status, 'count:', rankingsRes.body.rankings.length);

    // 2. Fetch listing stats without auth (expects 401)
    const statsUnauthRes = await makeRequest(testApp, {
      method: 'GET',
      path: '/api/market/listing-stats?listingId=dummy',
    });
    assert.strictEqual(statsUnauthRes.status, 401);
    assert.ok(statsUnauthRes.body.error);
    console.log('[ReadOnly Audit] Unauth listing-stats response:', statsUnauthRes.body);

    // 3. Inspect Firestore listings via Admin SDK (read-only)
    try {
      const db = await getAdminFirestoreInstance();
      const listingsSnap = await db.collection('listings').limit(10).get();
      console.log('[ReadOnly Audit] Existing listings count in Firestore:', listingsSnap.size);
      listingsSnap.forEach((doc: any) => {
        const d = doc.data();
        console.log(`- Listing ID: ${doc.id}, Title: ${d.title || d.titleGe}, SellerId: ${d.sellerId}`);
      });
    } catch (e: any) {
      console.log('[ReadOnly Audit] Firestore direct read note:', e.message);
    }
  });
});

