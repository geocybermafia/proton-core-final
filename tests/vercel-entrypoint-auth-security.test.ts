import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import vercelHandler from '../api/index.js';

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
    email: 'security-test@proton.app',
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

function invokeVercelHandler(
  opts: { method: string; path: string; headers?: Record<string, string>; body?: any }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => vercelHandler(req, res));
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
          res.on('data', (chunk) => {
            raw += chunk;
          });
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

describe('Compiled Vercel Entry Point (api/index.js) Authentication Security', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const testKid = 'vercel-bundle-test-kid';
  const dbId = 'ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51';
  const validJpegUri =
    'data:image/jpeg;base64,' +
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]).toString('base64');

  const originalFetch = globalThis.fetch;
  const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSupabaseUrl = process.env.SUPABASE_URL;

  before(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key-for-entry-test';
    process.env.SUPABASE_URL = 'https://mock-supabase.local';

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.startsWith('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')) {
        return new Response(JSON.stringify({ [testKid]: publicKey }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'public, max-age=3600',
          },
        });
      }

      if (url.startsWith('https://mock-supabase.local/storage/v1/object/')) {
        return new Response(JSON.stringify({ Key: 'listings/user_a/mock.jpg' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      return originalFetch(input, init);
    }) as typeof fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey;
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
  });

  it('1. Rejects cryptographically valid token from an external Firebase project with HTTP 401 across api/index.js routes', async () => {
    const foreignToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'external-attacker-project',
      iss: 'https://securetoken.google.com/external-attacker-project',
      sub: 'user_b',
    });

    const authHeaders = { Authorization: `Bearer ${foreignToken}` };

    const routes: Array<{ method: string; path: string; body?: any }> = [
      { method: 'POST', path: '/api/storage/upload-listing-image', body: { image: validJpegUri, productId: 'p1' } },
      { method: 'POST', path: '/api?1=storage%2Fupload-listing-image', body: { image: validJpegUri, productId: 'p1' } },
      { method: 'POST', path: '/api/storage/delete-listing-image', body: { path: 'user_b/img.jpg' } },
      { method: 'DELETE', path: '/api/storage/file/user_b/img.jpg' },
      { method: 'POST', path: '/api/storage/create-clip-upload-url', body: { fileExt: 'mp4' } },
      { method: 'POST', path: '/api/storage/delete-clip-video', body: { path: 'user_b/clip_1.mp4' } },
      { method: 'GET', path: '/api/market/listing-stats?listingId=listing_b' },
      { method: 'GET', path: '/api?1=market%2Flisting-stats&listingId=listing_b' },
      { method: 'POST', path: '/api/market/competition-preference', body: { optedOut: true } },
    ];

    for (const r of routes) {
      const res = await invokeVercelHandler({
        method: r.method,
        path: r.path,
        headers: authHeaders,
        body: r.body,
      });
      assert.strictEqual(res.status, 401, `api/index.js ${r.method} ${r.path} must reject foreign project token with 401`);
    }
  });

  it('2. Accepts valid PROTON token (aud=proton-core-ai) through compiled api/index.js handler', async () => {
    const protonToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/proton-core-ai',
      sub: 'user_a',
    });
    const headers = { Authorization: `Bearer ${protonToken}` };

    // Upload succeeds (mocked Supabase Storage HTTP 200) under verified user_a folder
    const uploadRes = await invokeVercelHandler({
      method: 'POST',
      path: '/api?1=storage%2Fupload-listing-image',
      headers,
      body: { image: validJpegUri, productId: 'prod_1' },
    });
    assert.strictEqual(uploadRes.status, 200);
    assert.strictEqual(uploadRes.body.success, true);
    assert.match(uploadRes.body.path, /^user_a\//);

    // Ownership check runs after successful auth (user_a deleting user_b's path => 403, not 401)
    const crossUserDelRes = await invokeVercelHandler({
      method: 'POST',
      path: '/api/storage/delete-listing-image',
      headers,
      body: { path: 'user_b/other.jpg' },
    });
    assert.strictEqual(crossUserDelRes.status, 403);
    assert.strictEqual(crossUserDelRes.body.code, 'storage/ownership-mismatch');

    // Market stats passes auth (returns 503 only because local Admin Firestore ADC is unset, never 401)
    const statsRes = await invokeVercelHandler({
      method: 'GET',
      path: '/api/market/listing-stats?listingId=listing_a',
      headers,
    });
    assert.notStrictEqual(statsRes.status, 401);
  });

  it('3. Rejects tampered signature, wrong aud/iss, expired token, alg=none, and Database ID as Project ID in api/index.js', async () => {
    const validToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/proton-core-ai',
      sub: 'user_a',
    });
    const parts = validToken.split('.');
    const tamperedSig = parts[2].slice(0, -2) + (parts[2].endsWith('AA') ? 'BB' : 'AA');
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;

    const wrongAudToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'wrong-firebase-project',
      iss: 'https://securetoken.google.com/wrong-firebase-project',
      sub: 'user_a',
    });

    const wrongIssToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/other-project',
      sub: 'user_a',
    });

    const expiredToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/proton-core-ai',
      sub: 'user_a',
      expOffsetSec: -60,
      iatOffsetSec: -3660,
    });

    const algNoneToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      alg: 'none',
      aud: 'proton-core-ai',
      iss: 'https://securetoken.google.com/proton-core-ai',
      sub: 'user_a',
    });

    const dbIdToken = createSignedJwt({
      privateKeyPem: privateKey,
      kid: testKid,
      aud: dbId,
      iss: `https://securetoken.google.com/${dbId}`,
      sub: 'user_a',
    });

    for (const token of [tamperedToken, wrongAudToken, wrongIssToken, expiredToken, algNoneToken, dbIdToken]) {
      const res = await invokeVercelHandler({
        method: 'POST',
        path: '/api/storage/upload-listing-image',
        headers: { Authorization: `Bearer ${token}` },
        body: { image: validJpegUri, productId: 'p1' },
      });
      assert.strictEqual(res.status, 401, 'api/index.js must reject invalid/tampered/wrong-aud/DB-ID token with 401');
    }
  });

  it('4. Preserves public routes through api/index.js without requiring authentication', async () => {
    const healthRes = await invokeVercelHandler({ method: 'GET', path: '/api/health' });
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.status, 'ok');

    const rankingsRes = await invokeVercelHandler({
      method: 'GET',
      path: '/api?1=market%2Frankings&scope=global&period=7d',
    });
    assert.notStrictEqual(rankingsRes.status, 401);
  });
});
