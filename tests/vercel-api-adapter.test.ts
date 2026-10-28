import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import app from '../src/serverApp.js';
import vercelHandler from '../api/index.js';

describe('Vercel API Adapter & Shared ServerApp Suite', () => {
  function makeRequest(
    handler: (req: any, res: any) => any,
    options: {
      method: string;
      path: string;
      headers?: Record<string, string>;
      body?: any;
    }
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        handler(req, res);
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

  it('1. GET /api/health returns 200 OK with non-sensitive key diagnostic', async () => {
    const res = await makeRequest(app, { method: 'GET', path: '/api/health' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(res.body.timestamp);
    assert.ok(res.body.environment);
    // Keys status must only be 'configured' or 'missing', never leaking strings
    assert.ok(['configured', 'missing'].includes(res.body.environment.supabaseServiceRoleKey));
    assert.ok(['configured', 'missing'].includes(res.body.environment.geminiApiKey));
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

  it('6. Vercel Handler entry point (api/index.ts) processes /api/health successfully', async () => {
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
});
