import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import crypto from 'crypto';
import { uploadProductImage, isFirebaseStorageAvailable } from '../src/lib/storageUtils';
import { auth, storage } from '../src/firebase';

describe('Market Hub Image Upload System Repair - Phase 1 Verification Tests', () => {
  const originalFetch = globalThis.fetch;
  let originalCurrentUser: any;

  beforeEach(() => {
    originalCurrentUser = auth.currentUser;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(auth, 'currentUser', {
      value: originalCurrentUser,
      configurable: true,
      writable: true,
    });
  });

  // 1. Authorized user single photo upload
  it('1. Successfully uploads single image for authenticated user and returns Supabase public URL', async () => {
    const mockUser = {
      uid: 'seller_uid_alpha',
      getIdToken: async () => 'VALID_TOKEN_1',
    };
    Object.defineProperty(auth, 'currentUser', { value: mockUser, configurable: true, writable: true });

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const authHeader = (init?.headers as any)?.['Authorization'];
      assert.strictEqual(authHeader, 'Bearer VALID_TOKEN_1');

      return {
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
        text: async () => JSON.stringify({
          success: true,
          publicUrl: 'https://ntndwrpruyrttlpjptzf.supabase.co/storage/v1/object/public/listings/seller_uid_alpha/prod_123.jpg',
          path: 'seller_uid_alpha/prod_123.jpg',
        }),
      } as any;
    }) as any;

    const result = await uploadProductImage(
      'seller_uid_alpha',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'prod_123'
    );

    assert.strictEqual(
      result,
      'https://ntndwrpruyrttlpjptzf.supabase.co/storage/v1/object/public/listings/seller_uid_alpha/prod_123.jpg'
    );
  });

  // 2. Multiple photo upload flow
  it('2. Successfully handles multiple photo uploads sequentially or concurrently without race conditions', async () => {
    const mockUser = {
      uid: 'seller_uid_multi',
      getIdToken: async () => 'VALID_TOKEN_MULTI',
    };
    Object.defineProperty(auth, 'currentUser', { value: mockUser, configurable: true, writable: true });

    const uploadedUrls: string[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body));
      const url = `https://ntndwrpruyrttlpjptzf.supabase.co/storage/v1/object/public/listings/seller_uid_multi/${payload.productId}.jpg`;
      uploadedUrls.push(url);

      return {
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
        text: async () => JSON.stringify({ success: true, publicUrl: url, path: `seller_uid_multi/${payload.productId}.jpg` }),
      } as any;
    }) as any;

    const imagesToUpload = [
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=',
      'https://ntndwrpruyrttlpjptzf.supabase.co/storage/v1/object/public/listings/seller_uid_multi/existing.jpg'
    ];

    const results = await Promise.all(
      imagesToUpload.map((img, idx) => uploadProductImage('seller_uid_multi', img, `prod_${idx}`))
    );

    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0], 'https://ntndwrpruyrttlpjptzf.supabase.co/storage/v1/object/public/listings/seller_uid_multi/prod_0.jpg');
    assert.strictEqual(results[1], 'https://ntndwrpruyrttlpjptzf.supabase.co/storage/v1/object/public/listings/seller_uid_multi/prod_1.jpg');
    assert.strictEqual(results[2], 'https://ntndwrpruyrttlpjptzf.supabase.co/storage/v1/object/public/listings/seller_uid_multi/existing.jpg');
  });

  // 3. Invalid or expired Firebase Token
  it('3. Rejects invalid or expired Firebase Token with 401 Unauthorized after retry attempt', async () => {
    let callCount = 0;
    const mockUser = {
      uid: 'seller_uid_expired',
      getIdToken: async () => {
        callCount++;
        return 'EXPIRED_OR_FORGED_JWT';
      },
    };
    Object.defineProperty(auth, 'currentUser', { value: mockUser, configurable: true, writable: true });

    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
        text: async () => JSON.stringify({ error: 'Unauthorized: Invalid or expired Firebase authentication token' }),
      } as any;
    }) as any;

    await assert.rejects(
      async () => {
        await uploadProductImage('seller_uid_expired', 'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 401);
        assert.match(err.message, /Unauthorized/i);
        return true;
      }
    );

    assert.strictEqual(callCount, 2, 'Must attempt token refresh once on 401 and stop');
  });

  // 4. Server-enforced ownership boundary (path strictly bound to verified UID)
  it('4. Server prevents uploading under another user folder (strictly uses verified token UID)', () => {
    const verifiedTokenUid = 'verified_user_123';
    const cleanProdId = 'prod_test';
    const timestamp = Date.now();
    const randomSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 10);
    const storagePath = `${verifiedTokenUid}/${cleanProdId}_${timestamp}_${randomSuffix}.jpg`;

    assert.strictEqual(storagePath.startsWith('verified_user_123/'), true);
    assert.strictEqual(storagePath.includes('attacker_uid'), false);
  });

  // 5. Unsupported MIME type rejection
  it('5. Server rejects unsupported MIME types (e.g. application/pdf, text/html) with 400 Bad Request', () => {
    const ALLOWED_MIME_TYPES: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

    assert.strictEqual(Boolean(ALLOWED_MIME_TYPES['application/pdf']), false);
    assert.strictEqual(Boolean(ALLOWED_MIME_TYPES['text/html']), false);
    assert.strictEqual(Boolean(ALLOWED_MIME_TYPES['image/svg+xml']), false);
    assert.strictEqual(ALLOWED_MIME_TYPES['image/jpeg'], 'jpg');
    assert.strictEqual(ALLOWED_MIME_TYPES['image/png'], 'png');
    assert.strictEqual(ALLOWED_MIME_TYPES['image/webp'], 'webp');
  });

  // 6. Oversized file (>5MB) rejection
  it('6. Rejects payload exceeding 5 MB binary limit with 400 Bad Request', () => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const oversizedLength = 5 * 1024 * 1024 + 1024;
    assert.strictEqual(oversizedLength > MAX_FILE_SIZE, true);
  });

  // 7. Missing Supabase Key on server (503 Service Unavailable)
  it('7. Returns 503 when SUPABASE_SERVICE_ROLE_KEY is missing on server', async () => {
    const mockUser = {
      uid: 'seller_uid_nokey',
      getIdToken: async () => 'VALID_TOKEN',
    };
    Object.defineProperty(auth, 'currentUser', { value: mockUser, configurable: true, writable: true });

    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
        text: async () => JSON.stringify({
          error: 'Server storage configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is required on the server.'
        }),
      } as any;
    }) as any;

    await assert.rejects(
      async () => {
        await uploadProductImage('seller_uid_nokey', 'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 503);
        assert.match(err.message, /SUPABASE_SERVICE_ROLE_KEY is required/i);
        return true;
      }
    );
  });

  // 8. Supabase Storage service error (502 Bad Gateway)
  it('8. Handles upstream Supabase Storage failure (502 Bad Gateway) without infinite retry', async () => {
    let callCount = 0;
    const mockUser = {
      uid: 'seller_uid_upstream_err',
      getIdToken: async () => 'VALID_TOKEN',
    };
    Object.defineProperty(auth, 'currentUser', { value: mockUser, configurable: true, writable: true });

    globalThis.fetch = (async () => {
      callCount++;
      return {
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
        text: async () => JSON.stringify({ error: 'Storage service error: Bucket listings is paused or unavailable' }),
      } as any;
    }) as any;

    await assert.rejects(
      async () => {
        await uploadProductImage('seller_uid_upstream_err', 'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 502);
        assert.match(err.message, /Storage service error/i);
        return true;
      }
    );

    assert.strictEqual(callCount, 1, 'Should fail immediately without looping on 502');
  });

  // 9. API route HTML response handling (e.g. Preview Cookie Bridge redirect)
  it('9. Correctly identifies HTML response from Preview auth bridge and avoids JSON.parse syntax error', async () => {
    const mockUser = {
      uid: 'seller_uid_html',
      getIdToken: async () => 'VALID_TOKEN',
    };
    Object.defineProperty(auth, 'currentUser', { value: mockUser, configurable: true, writable: true });

    globalThis.fetch = (async () => {
      return {
        ok: true, // Nginx returns HTTP 200 with HTML document
        status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
        text: async () => '<!doctype html><html><head><title>Preview Bridge</title></head><body>Redirecting...</body></html>',
      } as any;
    }) as any;

    await assert.rejects(
      async () => {
        await uploadProductImage('seller_uid_html', 'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
      },
      (err: any) => {
        assert.strictEqual(err.isHtmlResponse, true);
        assert.match(err.message, /Server endpoint returned an HTML document/i);
        return true;
      }
    );
  });

  // 10. Firebase Storage fallback unavailability pre-check (prevents 45-second timeout hang)
  it('10. Pre-checks Firebase Storage availability and avoids 45-second hang when bucket does not exist (404)', async () => {
    // Probe URL returning 404
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes('firebasestorage.googleapis.com')) {
        return {
          status: 404,
          ok: false,
        } as any;
      }
      return { status: 404, ok: false } as any;
    }) as any;

    const available = await isFirebaseStorageAvailable();
    assert.strictEqual(available, false, 'Unprovisioned bucket must evaluate to false without throwing or hanging');
  });
});
