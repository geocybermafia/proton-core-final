import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { uploadProductImage } from '../src/lib/storageUtils';
import { auth } from '../src/firebase';

describe('Market Hub Product Image Upload Token Refresh & Retry Tests', () => {
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

  it('1. Upload succeeds on initial attempt with force-refreshed token (getIdToken(true))', async () => {
    let tokenCalls: boolean[] = [];
    let fetchCalls: { url: string; authHeader: string }[] = [];

    const mockUser = {
      uid: 'user_test_101',
      getIdToken: async (forceRefresh?: boolean) => {
        tokenCalls.push(Boolean(forceRefresh));
        return 'FRESH_TOKEN_1';
      },
    };

    Object.defineProperty(auth, 'currentUser', {
      value: mockUser,
      configurable: true,
      writable: true,
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({
        url: String(input),
        authHeader: (init?.headers as any)?.['Authorization'] || '',
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          publicUrl: 'https://storage.proton.app/listings/user_test_101/prod_1.jpg',
          path: 'user_test_101/prod_1.jpg',
        }),
      } as any;
    }) as any;

    const result = await uploadProductImage(
      'user_test_101',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'prod_test_1'
    );

    assert.strictEqual(result, 'https://storage.proton.app/listings/user_test_101/prod_1.jpg');
    assert.strictEqual(tokenCalls.length, 1);
    assert.strictEqual(tokenCalls[0], true, 'Initial token fetch must pass forceRefresh=true');
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].authHeader, 'Bearer FRESH_TOKEN_1');
  });

  it('2. First attempt returns 401 -> token refreshed once -> second attempt succeeds', async () => {
    let tokenCallCount = 0;
    let fetchAttempts: string[] = [];

    const mockUser = {
      uid: 'user_test_101',
      getIdToken: async (forceRefresh?: boolean) => {
        tokenCallCount++;
        assert.strictEqual(forceRefresh, true, 'Each token call must pass forceRefresh=true');
        return `TOKEN_ATTEMPT_${tokenCallCount}`;
      },
    };

    Object.defineProperty(auth, 'currentUser', {
      value: mockUser,
      configurable: true,
      writable: true,
    });

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const authHeader = (init?.headers as any)?.['Authorization'] || '';
      fetchAttempts.push(authHeader);

      if (fetchAttempts.length === 1) {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ error: 'Unauthorized: Invalid or expired Firebase authentication token' }),
        } as any;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          publicUrl: 'https://storage.proton.app/listings/user_test_101/prod_recovered.jpg',
          path: 'user_test_101/prod_recovered.jpg',
        }),
      } as any;
    }) as any;

    const result = await uploadProductImage(
      'user_test_101',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'prod_test_recovered'
    );

    assert.strictEqual(result, 'https://storage.proton.app/listings/user_test_101/prod_recovered.jpg');
    assert.strictEqual(tokenCallCount, 2, 'getIdToken(true) should be called twice (initial + retry)');
    assert.strictEqual(fetchAttempts.length, 2, 'Total fetch calls must be exactly 2');
    assert.strictEqual(fetchAttempts[0], 'Bearer TOKEN_ATTEMPT_1');
    assert.strictEqual(fetchAttempts[1], 'Bearer TOKEN_ATTEMPT_2');
  });

  it('3. Both attempts return 401 -> fails after exactly 2 attempts without infinite loop', async () => {
    let tokenCallCount = 0;
    let fetchCount = 0;

    const mockUser = {
      uid: 'user_test_101',
      getIdToken: async () => {
        tokenCallCount++;
        return `STALE_TOKEN_${tokenCallCount}`;
      },
    };

    Object.defineProperty(auth, 'currentUser', {
      value: mockUser,
      configurable: true,
      writable: true,
    });

    globalThis.fetch = (async () => {
      fetchCount++;
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Unauthorized: Invalid or expired Firebase authentication token' }),
      } as any;
    }) as any;

    await assert.rejects(
      async () => {
        await uploadProductImage(
          'user_test_101',
          'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          'prod_test_stale'
        );
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 401);
        assert.match(err.message, /Unauthorized/i);
        return true;
      }
    );

    assert.strictEqual(fetchCount, 2, 'Must stop at exactly 2 attempts');
    assert.strictEqual(tokenCallCount, 2, 'Must refresh token only for the retry attempt');
  });

  it('4. Non-401 error (403 or 500) does NOT retry and fails immediately on attempt 1', async () => {
    let fetchCount = 0;

    const mockUser = {
      uid: 'user_test_101',
      getIdToken: async () => 'TOKEN_FOR_500',
    };

    Object.defineProperty(auth, 'currentUser', {
      value: mockUser,
      configurable: true,
      writable: true,
    });

    globalThis.fetch = (async () => {
      fetchCount++;
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Internal server error during image storage' }),
      } as any;
    }) as any;

    await assert.rejects(
      async () => {
        await uploadProductImage(
          'user_test_101',
          'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          'prod_test_500'
        );
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 500);
        return true;
      }
    );

    assert.strictEqual(fetchCount, 1, 'Should NOT retry on 500 error');
  });

  it('5. Missing user session throws clear authentication error before sending request', async () => {
    let fetchCount = 0;

    Object.defineProperty(auth, 'currentUser', {
      value: null,
      configurable: true,
      writable: true,
    });

    globalThis.fetch = (async () => {
      fetchCount++;
      return { ok: true } as any;
    }) as any;

    await assert.rejects(
      async () => {
        await uploadProductImage(
          'user_test_101',
          'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          'prod_test_no_auth'
        );
      },
      (err: any) => {
        assert.strictEqual(err.message, 'User must be authenticated with Firebase to upload listing images.');
        return true;
      }
    );

    assert.strictEqual(fetchCount, 0, 'No fetch request should be dispatched when not authenticated');
  });

  it('6. Existing HTTPS image URL returns immediately without fetching', async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return { ok: true } as any;
    }) as any;

    const existingUrl = 'https://ntndwrpruyrttlpjptzf.supabase.co/storage/v1/object/public/listings/user1/pic.jpg';
    const result = await uploadProductImage('user_test_101', existingUrl);

    assert.strictEqual(result, existingUrl);
    assert.strictEqual(fetchCount, 0, 'Should not dispatch network request for existing HTTPS URL');
  });
});
