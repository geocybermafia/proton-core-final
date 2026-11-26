import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  fetchListingPreviewData,
  loadBaseHtml,
  injectListingMetaToHtml,
} from '../src/lib/marketListingMeta.js';
import app from '../src/serverApp.js';

describe('PROTON — Dynamic Market Listing Link Preview (SEO & Open Graph)', () => {
  it('1. Correctly injects all required Open Graph and Twitter tags into base HTML', () => {
    const baseHtml = loadBaseHtml();
    const fakeListing = {
      id: 'test_item_123',
      title: 'ხელნაკეთი ზურგჩანთა',
      description: 'ნატურალური ტყავის ზურგჩანთა საქართველოს სიმბოლიკით.',
      image: 'https://example.com/images/backpack.jpg',
      price: 180,
      currency: 'GEL',
      category: 'fashion',
      city: 'თბილისი',
      country: 'GEO',
      status: 'active',
    };

    const canonicalUrl = 'https://proton-core-final.vercel.app/market-hub?listingId=test_item_123';
    const html = injectListingMetaToHtml({
      baseHtml,
      listing: fakeListing,
      canonicalUrl,
    });

    // 1. Photo
    assert.match(html, /<meta\s+property=["']og:image["']\s+content=["']https:\/\/example\.com\/images\/backpack\.jpg["']/);
    assert.match(html, /<meta\s+name=["']twitter:image["']\s+content=["']https:\/\/example\.com\/images\/backpack\.jpg["']/);

    // 2. Exact Title
    assert.match(html, /<title>ხელნაკეთი ზურგჩანთა \| PROTON Market Hub<\/title>/);
    assert.match(html, /<meta\s+property=["']og:title["']\s+content=["']ხელნაკეთი ზურგჩანთა \| PROTON Market Hub["']/);
    assert.match(html, /<meta\s+name=["']twitter:title["']\s+content=["']ხელნაკეთი ზურგჩანთა \| PROTON Market Hub["']/);

    // 3. Description with price
    assert.match(html, /<meta\s+property=["']og:description["']\s+content=["']180 GEL — ნატურალური ტყავის ზურგჩანთა საქართველოს სიმბოლიკით\.["']/);
    assert.match(html, /<meta\s+name=["']twitter:description["']\s+content=["']180 GEL — ნატურალური ტყავის ზურგჩანთა საქართველოს სიმბოლიკით\.["']/);

    // 4. PROTON / Market Hub branding
    assert.match(html, /<meta\s+property=["']og:site_name["']\s+content=["']PROTON Market Hub["']/);

    // 5. Canonical URL
    assert.match(html, /<meta\s+property=["']og:url["']\s+content=["']https:\/\/proton-core-final\.vercel\.app\/market-hub\?listingId=test_item_123["']/);
    assert.match(html, /<link\s+rel=["']canonical["']\s+href=["']https:\/\/proton-core-final\.vercel\.app\/market-hub\?listingId=test_item_123["']/);

    // 6. Card Type
    assert.match(html, /<meta\s+name=["']twitter:card["']\s+content=["']summary_large_image["']/);
    assert.match(html, /<meta\s+property=["']og:type["']\s+content=["']website["']/);
  });

  it('2. Falls back to safe default preview when listing is missing or null', () => {
    const baseHtml = loadBaseHtml();
    const html = injectListingMetaToHtml({
      baseHtml,
      listing: null,
      canonicalUrl: 'https://proton-core-final.vercel.app/market-hub',
    });

    assert.match(html, /images\.unsplash\.com\/photo-1620712943543-bcc4688e7485/);
    assert.match(html, /Proton — ციფრული სახლი და AI სისტემების ჰაბი/);
  });

  it('3. Safely escapes HTML special characters to prevent attribute injection / XSS', () => {
    const baseHtml = loadBaseHtml();
    const maliciousListing = {
      id: 'xss_item',
      title: 'Dangerous Item <script>alert(1)</script> "quoted"',
      description: 'Description with "quotes" & <tags>',
      image: 'https://example.com/pic.jpg?a=1&b=2',
      price: 50,
      currency: 'USD',
      status: 'active',
    };

    const html = injectListingMetaToHtml({
      baseHtml,
      listing: maliciousListing,
      canonicalUrl: 'https://proton-core-final.vercel.app/market-hub?listingId=xss_item',
    });

    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /&quot;quoted&quot;/);
  });

  it('4. Server HTTP route /market-hub?listingId=... returns 200 with dynamic Open Graph tags', async () => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const res = await fetch(`${baseUrl}/market-hub?listingId=mxtys5MkYfjulhfIWzzp`, {
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        },
      });

      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/html/);
      const text = await res.text();

      // Confirms real listing attributes from Firestore
      assert.match(text, /ხავერდის ჩანთა/);
      assert.match(text, /supabase\.co\/storage\/v1\/object\/public\/listings/);
      assert.match(text, /<meta property="og:title"/);
      assert.match(text, /<meta property="og:image"/);
      assert.match(text, /<meta name="twitter:card" content="summary_large_image"/);
    } finally {
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });
});
