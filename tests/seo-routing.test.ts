import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {
  DEFAULT_PRODUCTION_ORIGIN,
  resolveCanonicalOrigin,
  resolveLegacyPublicRedirect,
  resolveRouteSeoMetadata,
  applyRouteSeoMetadataToDom,
  applyListingSeoMetadataToDom,
} from '../src/lib/seo.js';
import app from '../src/serverApp.js';

function httpRequestNoFollow(
  handler: (req: any, res: any) => any,
  requestPath: string,
  method: string = 'GET'
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: requestPath,
          method,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            server.close();
            resolve({
              status: res.statusCode || 500,
              headers: res.headers,
              body: data,
            });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

describe('PROTON P0 SEO Routing, Canonical URLs & 301 Redirects', () => {
  it('1. Public indexable routes return index, follow and unique canonical URLs', () => {
    const publicCases: Array<{ path: string; expectedCanonical: string }> = [
      { path: '/', expectedCanonical: `${DEFAULT_PRODUCTION_ORIGIN}/` },
      { path: '/market-hub', expectedCanonical: `${DEFAULT_PRODUCTION_ORIGIN}/market-hub` },
      { path: '/market-hub/', expectedCanonical: `${DEFAULT_PRODUCTION_ORIGIN}/market-hub` },
      { path: '/clips', expectedCanonical: `${DEFAULT_PRODUCTION_ORIGIN}/clips` },
      { path: '/clips/', expectedCanonical: `${DEFAULT_PRODUCTION_ORIGIN}/clips` },
      { path: '/creative-studio', expectedCanonical: `${DEFAULT_PRODUCTION_ORIGIN}/creative-studio` },
      { path: '/creative-studio/', expectedCanonical: `${DEFAULT_PRODUCTION_ORIGIN}/creative-studio` },
      { path: '/documentation', expectedCanonical: `${DEFAULT_PRODUCTION_ORIGIN}/documentation` },
      { path: '/documentation/', expectedCanonical: `${DEFAULT_PRODUCTION_ORIGIN}/documentation` },
    ];

    const seenCanonicals = new Set<string>();
    for (const tc of publicCases) {
      const meta = resolveRouteSeoMetadata({ pathname: tc.path, language: 'ka' });
      assert.equal(meta.indexable, true, `Expected ${tc.path} to be indexable`);
      assert.equal(meta.robots, 'index, follow', `Expected ${tc.path} robots=index, follow`);
      assert.equal(meta.canonicalUrl, tc.expectedCanonical);
      assert.equal(meta.ogUrl, tc.expectedCanonical);
      assert.ok(meta.title.length > 5, `Expected non-empty title for ${tc.path}`);
      assert.ok(meta.description.length > 15, `Expected non-empty description for ${tc.path}`);
      seenCanonicals.add(meta.canonicalUrl!);
    }

    assert.equal(seenCanonicals.size, 5, 'All 5 public routes must have unique canonical URLs');
  });

  it('2. Private workspace routes, AI tool sub-routes, /studio, and unknown URLs remain noindex, nofollow with null canonical', () => {
    const nonIndexablePaths = [
      '/dashboard',
      '/business-hub',
      '/business',
      '/organizer',
      '/blueprints',
      '/workflows',
      '/profile',
      '/settings',
      '/compute',
      '/commercial',
      '/personas',
      '/finance',
      '/image',
      '/copywriting',
      '/translator',
      '/studio',
      '/studio/test',
      '/unknown-nonexistent-route',
      '/clips/extra-invalid-segment',
    ];

    for (const p of nonIndexablePaths) {
      const meta = resolveRouteSeoMetadata({ pathname: p, language: 'ka' });
      assert.equal(meta.indexable, false, `Expected ${p} to be non-indexable`);
      assert.equal(meta.robots, 'noindex, nofollow', `Expected ${p} to have noindex, nofollow`);
      assert.equal(meta.canonicalUrl, null, `Expected ${p} to have no canonical URL`);
      assert.equal(meta.ogUrl, null);
    }
  });

  it('3. MarketHub search query parameters deduplicate canonical to /market-hub, while listingId preserves listing meta', () => {
    const searchMeta = resolveRouteSeoMetadata({
      pathname: '/market-hub',
      search: '?search=robot&category=tech&sort=newest',
      language: 'en',
    });
    assert.equal(searchMeta.robots, 'index, follow');
    assert.equal(searchMeta.canonicalUrl, `${DEFAULT_PRODUCTION_ORIGIN}/market-hub`);
    assert.equal(searchMeta.preserveListingMeta, false);

    const listingMeta = resolveRouteSeoMetadata({
      pathname: '/market-hub',
      search: '?listingId=mxtys5MkYfjulhfIWzzp',
      language: 'ka',
    });
    assert.equal(listingMeta.robots, 'index, follow');
    assert.equal(
      listingMeta.canonicalUrl,
      `${DEFAULT_PRODUCTION_ORIGIN}/market-hub?listingId=mxtys5MkYfjulhfIWzzp`
    );
    assert.equal(listingMeta.preserveListingMeta, true);
  });

  it('4. applyRouteSeoMetadataToDom preserves SSR/listing metadata when ?listingId= is present and updates DOM accurately otherwise', () => {
    const elementsBySelector = new Map<string, { attrs: Record<string, string>; removed: boolean }>();
    const makeEl = (selector: string) => {
      const rec = {
        attrs: {} as Record<string, string>,
        removed: false,
        setAttribute(k: string, v: string) {
          this.attrs[k] = v;
        },
        getAttribute(k: string) {
          return this.attrs[k] ?? null;
        },
        remove() {
          this.removed = true;
          elementsBySelector.delete(selector);
        },
      };
      elementsBySelector.set(selector, rec);
      return rec;
    };

    const robotsEl = makeEl('meta[name="robots"]');
    const descEl = makeEl('meta[name="description"]');
    const ogTitleEl = makeEl('meta[property="og:title"]');
    const ogDescEl = makeEl('meta[property="og:description"]');
    const ogUrlEl = makeEl('meta[property="og:url"]');
    const twTitleEl = makeEl('meta[name="twitter:title"]');
    const twDescEl = makeEl('meta[name="twitter:description"]');
    const twUrlEl = makeEl('meta[name="twitter:url"]');
    const canonicalEl = makeEl('link[rel="canonical"]');

    ogTitleEl.setAttribute('content', 'Custom Listing | PROTON Market Hub');
    descEl.setAttribute('content', '180 GEL — Custom listing description');

    const prevDocument = (globalThis as any).document;
    (globalThis as any).document = {
      title: 'Custom Listing | PROTON Market Hub',
      head: {
        appendChild() {},
      },
      querySelector(sel: string) {
        return elementsBySelector.get(sel) || null;
      },
      createElement() {
        return makeEl(`created-${Math.random()}`);
      },
    };

    try {
      // With ?listingId=, custom title & description MUST NOT be overwritten
      applyRouteSeoMetadataToDom({
        pathname: '/market-hub',
        search: '?listingId=test_listing_99',
        language: 'ka',
      });
      assert.equal((globalThis as any).document.title, 'Custom Listing | PROTON Market Hub');
      assert.equal(ogTitleEl.getAttribute('content'), 'Custom Listing | PROTON Market Hub');
      assert.equal(descEl.getAttribute('content'), '180 GEL — Custom listing description');
      assert.equal(robotsEl.getAttribute('content'), 'index, follow');
      assert.equal(
        canonicalEl.getAttribute('href'),
        `${DEFAULT_PRODUCTION_ORIGIN}/market-hub?listingId=test_listing_99`
      );

      // Explicit applyListingSeoMetadataToDom updates listing tags cleanly
      applyListingSeoMetadataToDom({
        listingId: 'test_listing_99',
        title: 'Updated Product | PROTON Market Hub',
        description: 'Fresh listing details',
      });
      assert.equal((globalThis as any).document.title, 'Updated Product | PROTON Market Hub');
      assert.equal(descEl.getAttribute('content'), 'Fresh listing details');
      assert.equal(
        twUrlEl.getAttribute('content'),
        `${DEFAULT_PRODUCTION_ORIGIN}/market-hub?listingId=test_listing_99`
      );
      assert.equal(
        ogUrlEl.getAttribute('content'),
        `${DEFAULT_PRODUCTION_ORIGIN}/market-hub?listingId=test_listing_99`
      );
      assert.equal(twTitleEl.getAttribute('content'), 'Updated Product | PROTON Market Hub');
      assert.equal(twDescEl.getAttribute('content'), 'Fresh listing details');
      assert.equal(ogDescEl.getAttribute('content'), 'Fresh listing details');

      // Switching to private /settings removes canonical and sets noindex, nofollow
      applyRouteSeoMetadataToDom({ pathname: '/settings', language: 'ka' });
      assert.equal(robotsEl.getAttribute('content'), 'noindex, nofollow');
      assert.equal(canonicalEl.removed, true);
    } finally {
      (globalThis as any).document = prevDocument;
    }
  });

  it('5. resolveCanonicalOrigin rejects localhost, 127.0.0.1, and *.run.app preview hosts', () => {
    assert.equal(
      resolveCanonicalOrigin({ runtimeOrigin: 'http://localhost:3000' }),
      DEFAULT_PRODUCTION_ORIGIN
    );
    assert.equal(
      resolveCanonicalOrigin({ runtimeOrigin: 'https://127.0.0.1:8080' }),
      DEFAULT_PRODUCTION_ORIGIN
    );
    assert.equal(
      resolveCanonicalOrigin({ runtimeOrigin: 'https://ais-dev-abc123.us-west1.run.app' }),
      DEFAULT_PRODUCTION_ORIGIN
    );
    assert.equal(
      resolveCanonicalOrigin({
        configuredOrigin: 'https://proton.ge/',
        runtimeOrigin: 'http://localhost:3000',
      }),
      'https://proton.ge'
    );
    assert.equal(
      resolveCanonicalOrigin({ runtimeOrigin: 'https://proton-core-final.vercel.app/' }),
      'https://proton-core-final.vercel.app'
    );
  });

  it('6. Server HTTP middleware emits 301 Redirects for /market* and /reels* with query preservation, and leaves /api/market/* intact', async () => {
    const r1 = await httpRequestNoFollow(app, '/market');
    assert.equal(r1.status, 301);
    assert.equal(r1.headers.location, '/market-hub');

    const r2 = await httpRequestNoFollow(app, '/market/?listingId=abc_123&ref=tg');
    assert.equal(r2.status, 301);
    assert.equal(r2.headers.location, '/market-hub?listingId=abc_123&ref=tg');

    const r3 = await httpRequestNoFollow(app, '/market/item_45?currency=GEL');
    assert.equal(r3.status, 301);
    assert.equal(r3.headers.location, '/market-hub/item_45?currency=GEL');

    const r4 = await httpRequestNoFollow(app, '/reels');
    assert.equal(r4.status, 301);
    assert.equal(r4.headers.location, '/clips');

    const r5 = await httpRequestNoFollow(app, '/reels/?clip=v99&autoplay=1');
    assert.equal(r5.status, 301);
    assert.equal(r5.headers.location, '/clips?clip=v99&autoplay=1');

    // Open redirect protection
    assert.equal(resolveLegacyPublicRedirect('//market'), null);
    assert.equal(resolveLegacyPublicRedirect('//evil.com/market'), null);

    // /api/market/* endpoints must NEVER be redirected by legacy /market redirect logic
    const apiRes = await httpRequestNoFollow(app, '/api/market/rankings?scope=global&period=7d');
    assert.notEqual(apiRes.status, 301);
    assert.notEqual(apiRes.status, 302);
    assert.notEqual(apiRes.status, 308);
    assert.ok([200, 503].includes(apiRes.status));
  });

  it('7. vercel.json and public/sitemap.xml match approved SEO routing policy', () => {
    const vercelRaw = fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8');
    const vercelConfig = JSON.parse(vercelRaw);

    assert.ok(Array.isArray(vercelConfig.redirects), 'vercel.json must define redirects');
    const redirectSources = vercelConfig.redirects.map((r: any) => `${r.source}->${r.destination}:${r.statusCode}`);
    assert.ok(redirectSources.includes('/market->/market-hub:301'));
    assert.ok(redirectSources.includes('/market/->/market-hub:301'));
    assert.ok(redirectSources.includes('/market/:path*->/market-hub/:path*:301'));
    assert.ok(redirectSources.includes('/reels->/clips:301'));
    assert.ok(redirectSources.includes('/reels/->/clips:301'));
    assert.ok(redirectSources.includes('/reels/:path*->/clips/:path*:301'));

    const rewriteSources = vercelConfig.rewrites.map((rw: any) => rw.source);
    assert.ok(rewriteSources.includes('/market-hub'));
    assert.equal(rewriteSources.includes('/market'), false);
    assert.equal(rewriteSources.includes('/market/'), false);

    const sitemapRaw = fs.readFileSync(path.resolve(process.cwd(), 'public/sitemap.xml'), 'utf8');
    const locs = Array.from(sitemapRaw.matchAll(/<loc>(.*?)<\/loc>/g)).map((m) => m[1]);
    assert.deepEqual(locs, [
      'https://proton-core-final.vercel.app/',
      'https://proton-core-final.vercel.app/market-hub',
      'https://proton-core-final.vercel.app/clips',
      'https://proton-core-final.vercel.app/creative-studio',
      'https://proton-core-final.vercel.app/documentation',
    ]);
  });
});
