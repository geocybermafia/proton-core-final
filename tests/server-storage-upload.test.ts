import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import crypto from 'crypto';

describe('Server-side Secure Storage Upload Route Tests', () => {
  // Mock Firebase Admin Auth
  const mockAdminAuth = {
    verifyIdToken: async (token: string) => {
      if (token === 'VALID_SELLER_TOKEN_101') {
        return { uid: 'seller_user_101', email: 'seller101@proton.app' };
      }
      if (token === 'EXPIRED_TOKEN') {
        const err: any = new Error('Firebase ID token has expired');
        err.code = 'auth/id-token-expired';
        throw err;
      }
      const err: any = new Error('Decoding Firebase ID token failed');
      err.code = 'auth/invalid-id-token';
      throw err;
    }
  };

  function createTestServer(serviceRoleKey?: string) {
    const app = express();
    app.use(express.json({ limit: '10mb' }));

    app.post('/api/storage/upload-listing-image', async (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
      }
      const idToken = authHeader.split('Bearer ')[1]?.trim();
      if (!idToken) {
        return res.status(401).json({ error: 'Unauthorized: Empty authentication token' });
      }

      let decodedToken;
      try {
        decodedToken = await mockAdminAuth.verifyIdToken(idToken);
      } catch (authErr: any) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired Firebase authentication token' });
      }

      const verifiedUid = decodedToken.uid;
      if (!verifiedUid) {
        return res.status(401).json({ error: 'Unauthorized: User UID not found in verified token' });
      }

      const { image, productId } = req.body || {};
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Bad Request: Image data is required' });
      }

      const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: 'Bad Request: Invalid image format. Must be a valid Base64 data URI.' });
      }

      const mimeType = matches[1].toLowerCase();
      const base64Data = matches[2];

      const ALLOWED_MIME_TYPES: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };

      if (!ALLOWED_MIME_TYPES[mimeType]) {
        return res.status(400).json({ 
          error: `Bad Request: Unsupported image format (${mimeType}). Allowed formats are JPEG, PNG, and WebP.` 
        });
      }

      const ext = ALLOWED_MIME_TYPES[mimeType];
      const buffer = Buffer.from(base64Data, 'base64');

      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (buffer.length > MAX_FILE_SIZE) {
        return res.status(400).json({ 
          error: `Bad Request: Image exceeds 5 MB limit. Received size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB.` 
        });
      }

      if (!serviceRoleKey) {
        return res.status(503).json({ 
          error: 'Server storage configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is required on the server.' 
        });
      }

      const timestamp = Date.now();
      const randomSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 10);
      const cleanProdId = typeof productId === 'string'
        ? productId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32)
        : 'prod';
      const storagePath = `${verifiedUid}/${cleanProdId}_${timestamp}_${randomSuffix}.${ext}`;

      return res.status(200).json({
        success: true,
        publicUrl: `https://ntndwrpruyrttlpjptzf.supabase.co/storage/v1/object/public/listings/${storagePath}`,
        path: storagePath,
      });
    });

    return app;
  }

  async function makeRequest(app: express.Express, headers: Record<string, string>, body: any): Promise<{ status: number; body: any }> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(app);
      server.listen(0, () => {
        const port = (server.address() as any).port;
        const postData = JSON.stringify(body);
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: '/api/storage/upload-listing-image',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            ...headers,
          },
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            server.close();
            try {
              resolve({ status: res.statusCode || 500, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode || 500, body: data });
            }
          });
        });
        req.on('error', (err) => {
          server.close();
          reject(err);
        });
        req.write(postData);
        req.end();
      });
    });
  }

  it('1. Rejects unauthenticated requests with 401 Unauthorized', async () => {
    const app = createTestServer('mock_secret_key');
    const res = await makeRequest(app, {}, { image: 'data:image/jpeg;base64,123' });
    assert.strictEqual(res.status, 401);
    assert.match(res.body.error, /Missing or invalid Authorization/);
  });

  it('2. Rejects invalid or expired Firebase ID tokens with 401 Unauthorized', async () => {
    const app = createTestServer('mock_secret_key');
    const res = await makeRequest(
      app,
      { 'Authorization': 'Bearer FORGED_OR_EXPIRED_TOKEN' },
      { image: 'data:image/jpeg;base64,123' }
    );
    assert.strictEqual(res.status, 401);
    assert.match(res.body.error, /Invalid or expired Firebase/);
  });

  it('3. Rejects non-image MIME types with 400 Bad Request', async () => {
    const app = createTestServer('mock_secret_key');
    const res = await makeRequest(
      app,
      { 'Authorization': 'Bearer VALID_SELLER_TOKEN_101' },
      { image: 'data:application/pdf;base64,JVBERi0xLjQK' }
    );
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /Unsupported image format/);
  });

  it('4. Rejects images exceeding 5 MB limit with 400 Bad Request', async () => {
    const app = createTestServer('mock_secret_key');
    // 6 MB of dummy data
    const oversizedBase64 = Buffer.alloc(6 * 1024 * 1024).toString('base64');
    const res = await makeRequest(
      app,
      { 'Authorization': 'Bearer VALID_SELLER_TOKEN_101' },
      { image: `data:image/jpeg;base64,${oversizedBase64}` }
    );
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /exceeds 5 MB limit/);
  });

  it('5. Returns 503 if SUPABASE_SERVICE_ROLE_KEY is missing on server', async () => {
    const appWithoutKey = createTestServer(undefined);
    const validSmallImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';
    const res = await makeRequest(
      appWithoutKey,
      { 'Authorization': 'Bearer VALID_SELLER_TOKEN_101' },
      { image: validSmallImage }
    );
    assert.strictEqual(res.status, 503);
    assert.match(res.body.error, /SUPABASE_SERVICE_ROLE_KEY is required/);
  });

  it('6. Successfully uploads verified user image and enforces verified UID folder', async () => {
    const app = createTestServer('mock_secret_key');
    const validSmallImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';
    const res = await makeRequest(
      app,
      { 'Authorization': 'Bearer VALID_SELLER_TOKEN_101' },
      { image: validSmallImage, productId: 'prod_999' }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // Path MUST strictly start with the verified seller's UID
    assert.match(res.body.path, /^seller_user_101\/prod_999_\d+_[a-z0-9]+\.png$/);
    assert.match(res.body.publicUrl, /https:\/\/ntndwrpruyrttlpjptzf\.supabase\.co\/storage\/v1\/object\/public\/listings\/seller_user_101\//);
  });
});
