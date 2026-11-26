import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createApiApp } from '../src/serverApp.js';
import {
  MarketListingApiError,
  buildMarketListingApiBody,
  formatPublishListingErrorMessage,
  generateClientListingId,
  submitListingViaApi,
} from '../src/lib/marketListingApi.js';

function createInMemoryAdminFirestore() {
  const collections = new Map<string, { docs: Map<string, Record<string, any>> }>();

  const getCol = (name: string) => {
    let col = collections.get(name);
    if (!col) {
      col = { docs: new Map() };
      collections.set(name, col);
    }
    return col;
  };

  return {
    collections,
    collection(colName: string) {
      return {
        doc(docId: string) {
          return {
            __colName: colName,
            __docId: docId,
            async get() {
              const data = getCol(colName).docs.get(docId);
              return {
                exists: data !== undefined,
                id: docId,
                data: () => (data ? structuredClone(data) : undefined),
              };
            },
          };
        },
      };
    },
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const pendingWrites: Array<{ colName: string; docId: string; data: Record<string, any> }> = [];
      const tx = {
        async get(docRef: { __colName: string; __docId: string }) {
          const data = getCol(docRef.__colName).docs.get(docRef.__docId);
          return {
            exists: data !== undefined,
            id: docRef.__docId,
            data: () => (data ? structuredClone(data) : undefined),
          };
        },
        set(docRef: { __colName: string; __docId: string }, data: Record<string, any>) {
          pendingWrites.push({
            colName: docRef.__colName,
            docId: docRef.__docId,
            data: structuredClone(data),
          });
        },
      };
      const result = await fn(tx);
      for (const w of pendingWrites) {
        getCol(w.colName).docs.set(w.docId, w.data);
      }
      return result;
    },
  };
}

async function withServer(app: ReturnType<typeof createApiApp>, fn: (baseUrl: string) => Promise<void>) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('PROTON Market Hub — TASK-01 Client-to-API Publish Flow Verification', () => {
  it('1, 3, 4, 5, 10. Publishes full bilingual listing via submitListingViaApi -> POST /api/market/listings with matching ID and blocks duplicate creation (409)', async () => {
    const mockDb = createInMemoryAdminFirestore();
    const app = createApiApp({
      verifyIdToken: async (token: string) => {
        if (token === 'fresh-token-seller-1') {
          return { uid: 'uid_giorgi_123', email: 'giorgi@proton.test' };
        }
        return null;
      },
      getAdminFirestore: async () => mockDb,
    });

    await withServer(app, async (baseUrl) => {
      const clientGeneratedId = generateClientListingId();
      assert.match(clientGeneratedId, /^lst-[a-zA-Z0-9_-]{8,120}$/);

      const payload = {
        id: clientGeneratedId,
        title: 'სათაური ქართულად',
        titleGe: 'სათაური ქართულად',
        titleEn: 'MacBook Pro M3 14"',
        primaryLanguage: 'ka' as const,
        description: 'სრული აღწერა ქართულად და ინგლისურად.',
        descriptionGe: 'სრული აღწერა ქართულად და ინგლისურად.',
        price: 4200,
        currency: 'GEL',
        sellerName: 'Giorgi',
        category: 'laptops',
        listingType: 'product' as const,
        condition: 'used',
        isNegotiable: true,
        isRemote: false,
        country: 'GEO',
        city: 'თბილისი',
        location: 'საბურთალო, თბილისი',
        lat: 41.725,
        lng: 44.752,
        attributes: {
          brand: 'Apple',
          ramGb: 18,
          ssdGb: 512,
        },
        serviceDuration: '',
        serviceTerms: '',
        tags: ['macbook', 'apple'],
        image: '/api/storage/file/uid_giorgi_123/macbook_1.webp',
        images: ['/api/storage/file/uid_giorgi_123/macbook_1.webp'],
      };

      // Verify payload builder never sends client sellerId
      const builtBody = buildMarketListingApiBody({ ...(payload as any), sellerId: 'forged_uid' });
      assert.equal('sellerId' in builtBody, false);

      const created = await submitListingViaApi({
        payload,
        getIdToken: async () => 'fresh-token-seller-1',
        endpoint: `${baseUrl}/api/market/listings`,
      });

      assert.equal(created.id, clientGeneratedId);
      assert.equal(created.sellerId, 'uid_giorgi_123');
      assert.equal(created.titleGe, 'სათაური ქართულად');
      assert.equal(created.titleEn, 'MacBook Pro M3 14"');
      assert.equal(created.primaryLanguage, 'ka');
      assert.equal(created.descriptionGe, 'სრული აღწერა ქართულად და ინგლისურად.');
      assert.equal(created.price, 4200);
      assert.equal(created.currency, 'GEL');
      assert.equal(created.condition, 'used');
      assert.equal(created.isNegotiable, true);
      assert.equal(created.isRemote, false);
      assert.equal(created.lat, 41.725);
      assert.equal(created.lng, 44.752);
      assert.deepEqual(created.attributes, { brand: 'Apple', ramGb: 18, ssdGb: 512 });

      // Confirm exact ID exists in mocked Firestore listings collection
      const storedDoc = mockDb.collections.get('listings')?.docs.get(clientGeneratedId);
      assert.ok(storedDoc);
      assert.equal(storedDoc.id, clientGeneratedId);
      assert.equal(storedDoc.sellerId, 'uid_giorgi_123');

      // Re-submitting exact same ID must fail with 409 Conflict (no duplicate creation)
      await assert.rejects(
        () =>
          submitListingViaApi({
            payload,
            getIdToken: async () => 'fresh-token-seller-1',
            endpoint: `${baseUrl}/api/market/listings`,
          }),
        (err: unknown) => err instanceof MarketListingApiError && err.status === 409
      );
      assert.equal(mockDb.collections.get('listings')?.docs.size, 1);
    });
  });

  it('7. Rejects unauthenticated publish & retries once when getIdToken(true) refreshes an expired token', async () => {
    const mockDb = createInMemoryAdminFirestore();
    const app = createApiApp({
      verifyIdToken: async (token: string) => {
        if (token === 'refreshed-valid-token') {
          return { uid: 'uid_refreshed', email: 'user@proton.test' };
        }
        return null;
      },
      getAdminFirestore: async () => mockDb,
    });

    await withServer(app, async (baseUrl) => {
      // Missing token -> 401 before network call
      await assert.rejects(
        () =>
          submitListingViaApi({
            payload: { title: 'Unauth Item', description: 'Desc', price: 50, category: 'technics' },
            getIdToken: async () => '',
            endpoint: `${baseUrl}/api/market/listings`,
          }),
        (err: unknown) => err instanceof MarketListingApiError && err.status === 401
      );

      // Expired initial token -> server returns 401 -> forceRefresh=true retries and succeeds
      const tokenCalls: boolean[] = [];
      const created = await submitListingViaApi({
        payload: {
          title: 'Refreshed Token Item',
          description: 'Worked after refresh',
          price: 150,
          currency: 'USD',
          category: 'technics',
          country: 'GEO',
          city: 'Tbilisi',
        },
        getIdToken: async (forceRefresh = false) => {
          tokenCalls.push(forceRefresh);
          return forceRefresh ? 'refreshed-valid-token' : 'stale-expired-token';
        },
        endpoint: `${baseUrl}/api/market/listings`,
      });
      assert.deepEqual(tokenCalls, [false, true]);
      assert.equal(created.sellerId, 'uid_refreshed');
    });
  });

  it('8. Handles 400, 401, 403, 409, 503 and network errors cleanly with localized Georgian/English messages', async () => {
    const statuses = [400, 401, 403, 409, 503] as const;
    for (const status of statuses) {
      await assert.rejects(
        () =>
          submitListingViaApi({
            payload: { title: 'Test', description: 'Desc', price: 20, category: 'technics' },
            getIdToken: async () => 'token',
            fetchImpl: async () =>
              new Response(JSON.stringify({ error: `Err ${status}`, code: `err/${status}` }), {
                status,
                headers: { 'Content-Type': 'application/json' },
              }),
          }),
        (err: unknown) => {
          assert.ok(err instanceof MarketListingApiError);
          assert.equal(err.status, status);
          const kaMsg = formatPublishListingErrorMessage(err, 'ka');
          const enMsg = formatPublishListingErrorMessage(err, 'en');
          assert.ok(kaMsg.length > 10);
          assert.ok(enMsg.length > 10);
          return true;
        }
      );
    }

    // Network failure
    await assert.rejects(
      () =>
        submitListingViaApi({
          payload: { title: 'Net', description: 'Desc', price: 20, category: 'technics' },
          getIdToken: async () => 'token',
          fetchImpl: async () => {
            throw new Error('Failed to fetch');
          },
        }),
      (err: unknown) => {
        assert.ok(err instanceof MarketListingApiError);
        assert.equal(err.status, 0);
        assert.ok(formatPublishListingErrorMessage(err, 'ka').includes('დაკავშირება'));
        return true;
      }
    );
  });

  it('2 & 5. Verifies MarketHub.tsx uses publishListing (zero addDoc on listings) and SellerContext.tsx has no Zürich/Switzerland fallback', async () => {
    const marketHubSrc = await fs.readFile(path.resolve('src/components/MarketHub.tsx'), 'utf8');
    const sellerContextSrc = await fs.readFile(path.resolve('src/contexts/SellerContext.tsx'), 'utf8');

    assert.equal(/addDoc\s*\(\s*collection\s*\(\s*db\s*,\s*['"]listings['"]\s*\)/.test(marketHubSrc), false);
    assert.equal(marketHubSrc.includes('await publishListing('), true);
    assert.equal(marketHubSrc.includes('updateDoc(doc(db, \'listings\', editingListing.id), updateData)'), true);

    assert.equal(sellerContextSrc.includes('Zürich'), false);
    assert.equal(sellerContextSrc.includes('Switzerland'), false);
    assert.equal(sellerContextSrc.includes('submitListingViaApi'), true);
  });
});
