import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApiApp } from '../src/serverApp.js';

interface StoredCollection {
  docs: Map<string, Record<string, any>>;
}

function createInMemoryAdminFirestore() {
  const collections = new Map<string, StoredCollection>();

  const getCol = (name: string): StoredCollection => {
    let col = collections.get(name);
    if (!col) {
      col = { docs: new Map() };
      collections.set(name, col);
    }
    return col;
  };

  const makeDocRef = (colName: string, docId: string) => ({
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
  });

  return {
    collections,
    collection(colName: string) {
      return {
        doc(docId: string) {
          return makeDocRef(colName, docId);
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

async function callListingEndpoint(
  app: ReturnType<typeof createApiApp>,
  opts: { token?: string; body?: any }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      const payload = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
      const headers: Record<string, string> = {};
      if (opts.token) {
        headers['Authorization'] = `Bearer ${opts.token}`;
      }
      if (payload !== undefined) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload).toString();
      }

      const req = http.request(
        { hostname: '127.0.0.1', port, path: '/api/market/listings', method: 'POST', headers },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            server.close();
            let parsed: any = raw;
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
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  });
}

describe('POST /api/market/listings — Full Schema, Location, Security & Freshness Verification', () => {
  const buildTestHarness = () => {
    const mockDb = createInMemoryAdminFirestore();
    const app = createApiApp({
      verifyIdToken: async (token: string) => {
        if (token === 'valid-seller-a') return { uid: 'seller_a', email: 'seller.a@proton.test' };
        if (token === 'valid-seller-b') return { uid: 'seller_b', email: 'seller.b@proton.test' };
        return null;
      },
      getAdminFirestore: async () => mockDb,
    });
    return { app, mockDb };
  };

  it('1 & 2 & 3 & 4 & 5. Accepts full listing payload and preserves multilingual titles, descriptions, attributes, coordinates, and service fields', async () => {
    const { app, mockDb } = buildTestHarness();
    const payload = {
      id: 'lst-full-schema-01',
      title: 'iPhone 15 Pro Max 256GB',
      titleGe: 'აიფონ 15 პრო მაქსი 256GB',
      titleEn: 'iPhone 15 Pro Max 256GB',
      primaryLanguage: 'ka',
      description: 'Excellent condition titanium model with original box.',
      descriptionGe: 'იდეალურ მდგომარეობაში ტიტანის კორპუსით და ორიგინალი ყუთით.',
      price: 2850,
      currency: 'GEL',
      sellerName: 'Giorgi Tech',
      category: 'phones',
      listingType: 'product',
      condition: 'used',
      isNegotiable: true,
      isRemote: false,
      country: 'GEO',
      city: 'თბილისი',
      location: 'ვაკე, თბილისი',
      lat: 41.709981,
      lng: 44.763421,
      images: [
        '/api/storage/file/seller_a/phone_front.webp',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9',
      ],
      attributes: {
        brand: 'Apple',
        model: 'iPhone 15 Pro Max',
        storageGb: 256,
        batteryHealth: 96,
        warrantyIncluded: true,
      },
      serviceDuration: 'Same-day handover',
      serviceTerms: 'Inspection before payment',
      tags: ['iphone', 'apple', 'tbilisi'],
    };

    const res = await callListingEndpoint(app, { token: 'valid-seller-a', body: payload });
    assert.equal(res.status, 201);
    assert.equal(res.body.id, 'lst-full-schema-01');
    assert.equal(res.body.sellerId, 'seller_a');
    assert.equal(res.body.title, 'iPhone 15 Pro Max 256GB');
    assert.equal(res.body.titleGe, 'აიფონ 15 პრო მაქსი 256GB');
    assert.equal(res.body.titleEn, 'iPhone 15 Pro Max 256GB');
    assert.equal(res.body.primaryLanguage, 'ka');
    assert.equal(res.body.description, 'Excellent condition titanium model with original box.');
    assert.equal(res.body.descriptionGe, 'იდეალურ მდგომარეობაში ტიტანის კორპუსით და ორიგინალი ყუთით.');
    assert.equal(res.body.price, 2850);
    assert.equal(res.body.currency, 'GEL');
    assert.equal(res.body.condition, 'used');
    assert.equal(res.body.isNegotiable, true);
    assert.equal(res.body.isRemote, false);
    assert.equal(res.body.country, 'GEO');
    assert.equal(res.body.city, 'თბილისი');
    assert.equal(res.body.location, 'ვაკე, თბილისი');
    assert.equal(res.body.lat, 41.709981);
    assert.equal(res.body.lng, 44.763421);
    assert.equal(res.body.image, '/api/storage/file/seller_a/phone_front.webp');
    assert.equal(res.body.images.length, 2);
    assert.deepEqual(res.body.attributes, payload.attributes);
    assert.equal(res.body.serviceDuration, 'Same-day handover');
    assert.equal(res.body.serviceTerms, 'Inspection before payment');
    assert.deepEqual(res.body.tags, ['iphone', 'apple', 'tbilisi']);
    assert.equal(res.body.status, 'active');
    assert.equal(res.body.isSold, false);

    const savedDoc = mockDb.collections.get('listings')?.docs.get('lst-full-schema-01');
    assert.ok(savedDoc);
    assert.deepEqual(savedDoc.attributes, payload.attributes);
    assert.equal(savedDoc.lat, 41.709981);
    assert.equal(savedDoc.lng, 44.763421);
  });

  it('3b. Preserves Georgian-only listing fields without English title and registers distinct freshness keys for Georgian titles', async () => {
    const { app, mockDb } = buildTestHarness();
    const res1 = await callListingEndpoint(app, {
      token: 'valid-seller-a',
      body: {
        titleGe: 'სასწრაფოდ იყიდება ყურსასმენი',
        primaryLanguage: 'ka',
        descriptionGe: 'ახალი ყუთით',
        price: 120,
        currency: 'GEL',
        category: 'technics',
        country: 'GEO',
        city: 'ბათუმი',
      },
    });
    assert.equal(res1.status, 201);
    assert.equal(res1.body.title, 'სასწრაფოდ იყიდება ყურსასმენი');
    assert.equal(res1.body.titleGe, 'სასწრაფოდ იყიდება ყურსასმენი');
    assert.equal(res1.body.titleEn, '');
    assert.equal(res1.body.description, 'ახალი ყუთით');
    assert.equal(res1.body.descriptionGe, 'ახალი ყუთით');
    assert.equal(res1.body.location, 'ბათუმი, GEO');

    const res2 = await callListingEndpoint(app, {
      token: 'valid-seller-a',
      body: {
        titleGe: 'სათამაშო კლავიატურა მექანიკური',
        primaryLanguage: 'ka',
        descriptionGe: 'მეორე განცხადება',
        price: 180,
        currency: 'GEL',
        category: 'technics',
        country: 'GEO',
        city: 'ბათუმი',
      },
    });
    assert.equal(res2.status, 201);
    // Must create 2 distinct freshness registry entries for 2 distinct Georgian titles
    assert.equal(mockDb.collections.get('seller_freshness_registry')?.docs.size, 2);
  });

  it('6. Does NOT write Zürich or Switzerland when location fields are omitted, and handles remote mode cleanly', async () => {
    const { app } = buildTestHarness();

    // Minimal payload with no location at all
    const noLocRes = await callListingEndpoint(app, {
      token: 'valid-seller-a',
      body: {
        title: 'Minimal Product',
        price: 55,
        category: 'Digital Assets',
      },
    });
    assert.equal(noLocRes.status, 201);
    assert.equal(noLocRes.body.country, '');
    assert.equal(noLocRes.body.city, '');
    assert.equal(noLocRes.body.location, '');
    assert.equal(noLocRes.body.lat, null);
    assert.equal(noLocRes.body.lng, null);
    assert.ok(!JSON.stringify(noLocRes.body).includes('Zürich'));
    assert.ok(!JSON.stringify(noLocRes.body).includes('Switzerland'));

    // Remote service without physical city
    const remoteRes = await callListingEndpoint(app, {
      token: 'valid-seller-a',
      body: {
        title: 'Full-Stack Consulting',
        price: 300,
        category: 'service',
        listingType: 'service',
        isRemote: true,
        serviceDuration: '3 days',
        serviceTerms: '2 revisions included',
      },
    });
    assert.equal(remoteRes.status, 201);
    assert.equal(remoteRes.body.isRemote, true);
    assert.equal(remoteRes.body.country, 'GLOBAL');
    assert.equal(remoteRes.body.city, 'Online');
    assert.equal(remoteRes.body.location, 'Online / Remote');
    assert.equal(remoteRes.body.listingType, 'service');
  });

  it('7. Rejects unauthenticated requests (401) and sellerId spoofing (403) and other user storage images (403)', async () => {
    const { app } = buildTestHarness();

    const unauth = await callListingEndpoint(app, {
      body: { title: 'Test', price: 10, category: 'technics' },
    });
    assert.equal(unauth.status, 401);

    const spoofSeller = await callListingEndpoint(app, {
      token: 'valid-seller-a',
      body: {
        title: 'Spoofed Listing',
        price: 100,
        category: 'technics',
        sellerId: 'seller_b',
      },
    });
    assert.equal(spoofSeller.status, 403);

    const stolenImg = await callListingEndpoint(app, {
      token: 'valid-seller-a',
      body: {
        title: 'Stolen Image Listing',
        price: 100,
        category: 'technics',
        images: ['/api/storage/file/seller_b/secret.jpg'],
      },
    });
    assert.equal(stolenImg.status, 403);
  });

  it('8. Rejects invalid inputs with 400 (bad coordinates, incomplete coords, bad attributes, unsafe URLs, raw data URI, invalid currency/condition)', async () => {
    const { app } = buildTestHarness();

    const invalidCases = [
      { title: 'Bad Price', price: 0, category: 'technics' },
      { title: 'Negative Price', price: -5, category: 'technics' },
      { title: 'Bad Currency', price: 50, currency: 'BTC', category: 'technics' },
      { title: 'Bad Condition', price: 50, condition: 'broken', category: 'technics' },
      { title: 'Out of Range Lat', price: 50, category: 'technics', lat: 95, lng: 44 },
      { title: 'Half Coords', price: 50, category: 'technics', lat: 41.7 },
      { title: 'Array Attributes', price: 50, category: 'technics', attributes: ['bad'] },
      { title: 'Nested Attributes', price: 50, category: 'technics', attributes: { nested: { a: 1 } } },
      { title: 'NoSQL Key Attributes', price: 50, category: 'technics', attributes: { $gt: '' } },
      { title: 'JS URI Attribute', price: 50, category: 'technics', attributes: { demoUrl: 'javascript:alert(1)' } },
      { title: 'Data URI Image', price: 50, category: 'technics', images: ['data:image/png;base64,AAA'] },
      { title: 'Encoded Traversal Image', price: 50, category: 'technics', images: ['/api/storage/file/seller_a/%2e%2e/seller_b/secret.jpg'] },
      { title: 'Bad ID', id: '../evil', price: 50, category: 'technics' },
    ];

    for (const badBody of invalidCases) {
      const res = await callListingEndpoint(app, { token: 'valid-seller-a', body: badBody });
      assert.equal(res.status, 400, `Expected 400 for case "${badBody.title}", got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  it('9. Preserves compatibility with legacy SellerContext payload, enforces Freshness Protection, & blocks duplicate ID overwrite with 409', async () => {
    const { app, mockDb } = buildTestHarness();
    const legacyPayload = {
      id: 'lst-legacy-compat-1',
      title: 'Legacy Asset',
      description: 'Simple asset description',
      price: 99,
      currency: 'USD',
      sellerName: 'Legacy User',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
      images: ['https://images.unsplash.com/photo-1518770660439-4636190af475'],
      category: 'Digital Assets',
      listingType: 'product',
    };

    const first = await callListingEndpoint(app, { token: 'valid-seller-a', body: legacyPayload });
    assert.equal(first.status, 201);
    assert.equal(first.body.id, 'lst-legacy-compat-1');
    assert.equal(first.body.country, '');
    assert.equal(first.body.city, '');
    assert.equal(first.body.location, '');

    const duplicate = await callListingEndpoint(app, { token: 'valid-seller-b', body: legacyPayload });
    assert.equal(duplicate.status, 409);

    // Simulate seller_a deleting lst-legacy-compat-1 and recreating same product with new ID -> must inherit original firstPublishedAt
    mockDb.collections.get('listings')?.docs.delete('lst-legacy-compat-1');
    const regEntries = Array.from(mockDb.collections.get('seller_freshness_registry')!.docs.values());
    assert.equal(regEntries.length, 1);
    const originalTimestamp = first.body.createdAt - 10 * 24 * 60 * 60 * 1000;
    regEntries[0].firstPublishedAt = originalTimestamp;

    const recreated = await callListingEndpoint(app, {
      token: 'valid-seller-a',
      body: {
        ...legacyPayload,
        id: 'lst-legacy-compat-2',
      },
    });
    assert.equal(recreated.status, 201);
    assert.equal(recreated.body.createdAt, originalTimestamp);
  });
});
