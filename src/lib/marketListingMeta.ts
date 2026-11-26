import fs from 'fs';
import path from 'path';

export interface ListingPreviewMeta {
  id: string;
  title: string;
  description: string;
  image: string;
  price?: number;
  currency?: string;
  category?: string;
  city?: string;
  country?: string;
  status?: string;
}

const DEFAULT_ROBOT_IMAGE =
  'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&h=630&q=80';
const DEFAULT_TITLE = 'Proton — ციფრული სახლი და AI სისტემების ჰაბი / Digital House & AI Hub';
const DEFAULT_DESC =
  'Proton არის ადამიანებისა და კომპანიებისთვის შექმნილი მრავალფუნქციური ციფრული სივრცე — Digital House, სადაც გაერთიანებულია AI დამხმარეები, ორგანიზატორები და ავტომატიზაციის ინსტრუმენტები.';

// In-memory 60-second preview cache to minimize Firestore round-trips for social crawlers
const PREVIEW_CACHE = new Map<string, { data: ListingPreviewMeta | null; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000;

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(raw?: string | null, maxLen = 180): string {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.substring(0, maxLen - 3).trim() + '...';
}

function extractRestField(val: any): any {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('arrayValue' in val) {
    const list = val.arrayValue?.values || [];
    return list.map(extractRestField);
  }
  return undefined;
}

export async function fetchListingPreviewData(listingId: string): Promise<ListingPreviewMeta | null> {
  const cleanId = typeof listingId === 'string' ? listingId.trim() : '';
  if (!cleanId || !/^[a-zA-Z0-9_-]{1,128}$/.test(cleanId)) {
    return null;
  }

  const cached = PREVIEW_CACHE.get(cleanId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  let result: ListingPreviewMeta | null = null;

  // 1. Attempt server Firebase Admin SDK (if initialized and configured)
  try {
    const { getAdminFirestoreInstance } = await import('./analyticsServer.js');
    const dbAdmin = await getAdminFirestoreInstance();
    if (dbAdmin) {
      const snap = await dbAdmin.collection('listings').doc(cleanId).get();
      if (snap.exists) {
        const raw = snap.data() || {};
        if (raw.status !== 'deleted') {
          const imageCandidate =
            raw.image ||
            (Array.isArray(raw.images) && raw.images[0]) ||
            '';
          result = {
            id: cleanId,
            title: raw.title || raw.titleGe || raw.titleEn || 'Market Item',
            description: raw.description || raw.descriptionGe || '',
            image: imageCandidate && typeof imageCandidate === 'string' && imageCandidate.startsWith('http')
              ? imageCandidate
              : DEFAULT_ROBOT_IMAGE,
            price: Number.isFinite(Number(raw.price)) ? Number(raw.price) : undefined,
            currency: raw.currency || 'USD',
            category: raw.category,
            city: raw.city,
            country: raw.country,
            status: raw.status || 'active',
          };
        }
      }
    }
  } catch {
    // Admin SDK not available or unconfigured; fall through to Firestore REST API
  }

  // 2. Fallback to public Firestore REST API (works across serverless & sandboxes without service account JSON)
  if (!result) {
    try {
      const projectId = 'proton-core-ai';
      const dbId = 'ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51';
      const apiKey = 'AIzaSyAawNki7fRFS_ZQGiAiXh4dmFNOH0OpZDM';
      const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/listings/${encodeURIComponent(cleanId)}?key=${apiKey}`;

      const res = await fetch(restUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const body: any = await res.json();
        const fields = body?.fields;
        if (fields) {
          const status = extractRestField(fields.status) || 'active';
          if (status !== 'deleted') {
            const rawTitle = extractRestField(fields.title) || extractRestField(fields.titleGe) || extractRestField(fields.titleEn) || 'Market Item';
            const rawDesc = extractRestField(fields.description) || extractRestField(fields.descriptionGe) || '';
            const rawImg = extractRestField(fields.image);
            const rawImages = extractRestField(fields.images);
            const imageCandidate = rawImg || (Array.isArray(rawImages) && rawImages[0]) || '';
            const rawPrice = extractRestField(fields.price);
            const rawCurrency = extractRestField(fields.currency) || 'USD';
            const rawCategory = extractRestField(fields.category);
            const rawCity = extractRestField(fields.city);
            const rawCountry = extractRestField(fields.country);

            result = {
              id: cleanId,
              title: String(rawTitle).trim(),
              description: String(rawDesc).trim(),
              image: typeof imageCandidate === 'string' && imageCandidate.startsWith('http')
                ? imageCandidate
                : DEFAULT_ROBOT_IMAGE,
              price: Number.isFinite(Number(rawPrice)) ? Number(rawPrice) : undefined,
              currency: String(rawCurrency).trim(),
              category: typeof rawCategory === 'string' ? rawCategory : undefined,
              city: typeof rawCity === 'string' ? rawCity : undefined,
              country: typeof rawCountry === 'string' ? rawCountry : undefined,
              status: typeof status === 'string' ? status : 'active',
            };
          }
        }
      }
    } catch (restErr) {
      console.warn('[MarketMeta] REST API lookup failed for listingId:', cleanId, restErr);
    }
  }

  PREVIEW_CACHE.set(cleanId, { data: result, expiresAt: now + CACHE_TTL_MS });
  return result;
}

let cachedBaseHtml: string | null = null;

export function loadBaseHtml(): string {
  if (cachedBaseHtml && process.env.NODE_ENV === 'production') {
    return cachedBaseHtml;
  }

  const candidatePaths = [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html'),
    path.resolve('dist/index.html'),
    path.resolve('index.html'),
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        if (content && content.includes('<html')) {
          cachedBaseHtml = content;
          return content;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Fallback template if file is not found on disk in serverless runtime
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover" />
    <title>${DEFAULT_TITLE}</title>
    <meta name="description" content="${DEFAULT_DESC}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="PROTON Market Hub" />
    <meta property="og:title" content="${DEFAULT_TITLE}" />
    <meta property="og:description" content="${DEFAULT_DESC}" />
    <meta property="og:image" content="${DEFAULT_ROBOT_IMAGE}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${DEFAULT_TITLE}" />
    <meta name="twitter:description" content="${DEFAULT_DESC}" />
    <meta name="twitter:image" content="${DEFAULT_ROBOT_IMAGE}" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

export function injectListingMetaToHtml(params: {
  baseHtml: string;
  listing: ListingPreviewMeta | null;
  canonicalUrl: string;
}): string {
  const { baseHtml, listing, canonicalUrl } = params;

  if (!listing) {
    // Return standard HTML with canonical URL updated if provided
    return baseHtml.replace(
      /<link\s+rel=["']canonical["'][^>]*\/?>/i,
      `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
    );
  }

  // 1. Prepare exact values
  const rawTitle = listing.title.trim();
  const titleDisplay = `${rawTitle} | PROTON Market Hub`;

  let descText = cleanText(listing.description, 170);
  if (listing.price !== undefined && listing.price > 0) {
    const priceStr = `${listing.price} ${listing.currency || 'USD'}`;
    descText = descText ? `${priceStr} — ${descText}` : `${priceStr} — ხელმისაწვდომია PROTON Market Hub-ში`;
  }
  if (!descText) {
    descText = `${rawTitle} — PROTON Market Hub`;
  }

  const imageUrl = listing.image && listing.image.startsWith('http') ? listing.image : DEFAULT_ROBOT_IMAGE;
  const safeTitle = escapeHtml(titleDisplay);
  const safeRawTitle = escapeHtml(rawTitle);
  const safeDesc = escapeHtml(descText);
  const safeImage = escapeHtml(imageUrl);
  const safeUrl = escapeHtml(canonicalUrl);

  let html = baseHtml;

  // Replace <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);

  // Replace standard description
  html = html.replace(
    /<meta\s+name=["']description["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta name="description" content="${safeDesc}" />`
  );

  // Replace canonical
  if (/<link\s+rel=["']canonical["']/i.test(html)) {
    html = html.replace(
      /<link\s+rel=["']canonical["'][^>]*\/?>/i,
      `<link rel="canonical" href="${safeUrl}" />`
    );
  }

  // Replace Open Graph tags
  html = html.replace(
    /<meta\s+property=["']og:title["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta property="og:title" content="${safeTitle}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:description["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta property="og:description" content="${safeDesc}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:image["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta property="og:image" content="${safeImage}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:url["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta property="og:url" content="${safeUrl}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:type["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta property="og:type" content="website" />`
  );

  // Replace Twitter tags
  html = html.replace(
    /<meta\s+name=["']twitter:title["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta name="twitter:title" content="${safeTitle}" />`
  );
  html = html.replace(
    /<meta\s+name=["']twitter:description["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta name="twitter:description" content="${safeDesc}" />`
  );
  html = html.replace(
    /<meta\s+name=["']twitter:image["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta name="twitter:image" content="${safeImage}" />`
  );
  html = html.replace(
    /<meta\s+name=["']twitter:url["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta name="twitter:url" content="${safeUrl}" />`
  );
  html = html.replace(
    /<meta\s+name=["']twitter:card["']\s+content=["'][\s\S]*?["']\s*\/?>/i,
    `<meta name="twitter:card" content="summary_large_image" />`
  );

  // Ensure og:site_name & image dimensions are present before </head>
  const extraTags: string[] = [];
  if (!html.includes('property="og:site_name"')) {
    extraTags.push('<meta property="og:site_name" content="PROTON Market Hub" />');
  }
  extraTags.push(`<meta property="og:image:alt" content="${safeRawTitle}" />`);
  extraTags.push(`<meta name="twitter:image:alt" content="${safeRawTitle}" />`);

  // Embed Schema.org Product structured data for rich search & social sharing cards
  const schemaProduct: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: rawTitle,
    description: descText,
    image: imageUrl,
    url: canonicalUrl,
  };
  if (listing.price !== undefined && listing.price > 0) {
    schemaProduct.offers = {
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: listing.currency || 'USD',
      availability: listing.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
    };
  }

  const safeJsonLd = JSON.stringify(schemaProduct)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  extraTags.push(
    `<script type="application/ld+json">${safeJsonLd}</script>`
  );

  html = html.replace('</head>', `  ${extraTags.join('\n    ')}\n  </head>`);
  return html;
}
