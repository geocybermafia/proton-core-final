export const DEFAULT_PRODUCTION_ORIGIN = 'https://proton-core-final.vercel.app';

export interface RouteSeoMetadata {
  indexable: boolean;
  robots: 'index, follow' | 'noindex, nofollow';
  canonicalUrl: string | null;
  ogUrl: string | null;
  title: string;
  description: string;
  preserveListingMeta: boolean;
  isPublicRoute: boolean;
}

const EPHEMERAL_HOST_PATTERNS = [
  /^localhost(?::\d+)?$/i,
  /^127\.0\.0\.1(?::\d+)?$/i,
  /^0\.0\.0\.0(?::\d+)?$/i,
  /\.run\.app$/i,
  /\.local$/i,
];

function isEphemeralHost(hostnameOrHost: string): boolean {
  const cleanHost = hostnameOrHost.trim().replace(/:\d+$/, '');
  if (!cleanHost) return true;
  return EPHEMERAL_HOST_PATTERNS.some((pattern) => pattern.test(cleanHost));
}

function normalizeOriginCandidate(candidate?: string | null): string | null {
  if (!candidate || typeof candidate !== 'string') return null;
  const trimmed = candidate.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    if (isEphemeralHost(parsed.hostname)) {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Resolves the authoritative canonical production origin.
 * Never returns localhost, 127.0.0.1, or ephemeral AI Studio (*.run.app) origins.
 */
export function resolveCanonicalOrigin(options?: {
  configuredOrigin?: string | null;
  runtimeOrigin?: string | null;
}): string {
  const configured = normalizeOriginCandidate(options?.configuredOrigin);
  if (configured) return configured;

  const runtime = normalizeOriginCandidate(options?.runtimeOrigin);
  if (runtime) return runtime;

  return DEFAULT_PRODUCTION_ORIGIN;
}

export function getClientCanonicalBaseUrl(): string {
  const configuredOrigin =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PUBLIC_SITE_URL
      ? String((import.meta as any).env.VITE_PUBLIC_SITE_URL)
      : undefined;
  const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
  return resolveCanonicalOrigin({ configuredOrigin, runtimeOrigin });
}

/**
 * Normalizes a pathname by removing trailing slashes (except root '/').
 */
export function normalizeRoutePathname(pathname: string): string {
  if (!pathname || typeof pathname !== 'string') return '/';
  const collapsed = pathname.replace(/\/{2,}/g, '/');
  if (collapsed === '/') return '/';
  return collapsed.replace(/\/+$/, '') || '/';
}

/**
 * Resolves legacy public aliases (/market -> /market-hub, /reels -> /clips)
 * while strictly preserving query string and hash, and guarding against open redirects.
 */
export function resolveLegacyPublicRedirect(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  // Block protocol-relative URLs like //market or //evil.com
  if (rawUrl.startsWith('//')) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl, 'http://localhost');
  } catch {
    return null;
  }

  const pathname = parsed.pathname;
  const search = parsed.search || '';
  const hash = parsed.hash || '';

  if (pathname === '/market' || pathname === '/market/') {
    return `/market-hub${search}${hash}`;
  }
  if (pathname.startsWith('/market/')) {
    const rest = pathname.slice('/market'.length).replace(/\/+$/, '');
    return `/market-hub${rest || ''}${search}${hash}`;
  }

  if (pathname === '/reels' || pathname === '/reels/') {
    return `/clips${search}${hash}`;
  }
  if (pathname.startsWith('/reels/')) {
    const rest = pathname.slice('/reels'.length).replace(/\/+$/, '');
    return `/clips${rest || ''}${search}${hash}`;
  }

  return null;
}

const PRIVATE_OR_TOOL_PATHS = new Set<string>([
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
]);

export function resolveRouteSeoMetadata(params: {
  pathname: string;
  search?: string;
  language?: 'en' | 'ka';
  baseUrl?: string;
}): RouteSeoMetadata {
  const {
    pathname,
    search = '',
    language = 'en',
    baseUrl = DEFAULT_PRODUCTION_ORIGIN,
  } = params;

  const isKa = language === 'ka';
  const cleanOrigin = baseUrl.replace(/\/+$/, '');
  const cleanPath = normalizeRoutePathname(pathname);
  const searchParams = new URLSearchParams(search.startsWith('?') ? search : search ? `?${search}` : '');

  // 1. Root Landing Page ('/')
  if (cleanPath === '/') {
    const url = `${cleanOrigin}/`;
    return {
      indexable: true,
      robots: 'index, follow',
      canonicalUrl: url,
      ogUrl: url,
      title: 'Proton — ციფრული სახლი და AI სისტემების ჰაბი / Digital House & AI Hub',
      description:
        'Proton არის ადამიანებისა და კომპანიებისთვის შექმნილი მრავალფუნქციური ციფრული სივრცე — Digital House, სადაც გაერთიანებულია AI დამხმარეები, ორგანიზატორები და ავტომატიზაციის ინსტრუმენტები.',
      preserveListingMeta: false,
      isPublicRoute: true,
    };
  }

  // 2. Market Hub ('/market-hub' and legacy alias '/market' during client transition)
  if (cleanPath === '/market-hub' || cleanPath === '/market') {
    const rawListingId = searchParams.get('listingId')?.trim() || '';
    const hasValidListingId = Boolean(rawListingId && /^[a-zA-Z0-9_-]{1,128}$/.test(rawListingId));
    const canonicalUrl = hasValidListingId
      ? `${cleanOrigin}/market-hub?listingId=${encodeURIComponent(rawListingId)}`
      : `${cleanOrigin}/market-hub`;

    return {
      indexable: true,
      robots: 'index, follow',
      canonicalUrl,
      ogUrl: canonicalUrl,
      title: isKa
        ? 'PROTON Market Hub — პროდუქტები, სერვისები და ციფრული აქტივები'
        : 'PROTON Market Hub — Products, Services & Digital Assets',
      description: isKa
        ? 'იპოვეთ და გაყიდეთ პროდუქტები, სერვისები და ციფრული აქტივები PROTON Market Hub-ში — დადასტურებული შეფასებებით და პირდაპირი კომუნიკაციით.'
        : 'Discover, buy, and sell products, services, and digital assets on PROTON Market Hub with verified buyer reviews and direct messaging.',
      preserveListingMeta: hasValidListingId,
      isPublicRoute: true,
    };
  }

  // 3. Proton Clips ('/clips' and legacy alias '/reels' during client transition)
  if (cleanPath === '/clips' || cleanPath === '/reels') {
    const url = `${cleanOrigin}/clips`;
    return {
      indexable: true,
      robots: 'index, follow',
      canonicalUrl: url,
      ogUrl: url,
      title: isKa
        ? 'PROTON Clips — მოკლე ვიდეოები და პროდუქტის დემოები'
        : 'PROTON Clips — Short Creator Videos & Shoppable Reels',
      description: isKa
        ? 'აღმოაჩინეთ შემქმნელების მოკლე ვიდეოები, პროდუქტის დემოები და სერვისები PROTON Clips-ზე და შეუკვეთეთ პირდაპირ ეკოსისტემაში.'
        : 'Watch short vertical creator videos, product demos, and shoppable service reels on PROTON Clips.',
      preserveListingMeta: false,
      isPublicRoute: true,
    };
  }

  // 4. Creative Studio Hub ('/creative-studio')
  if (cleanPath === '/creative-studio') {
    const url = `${cleanOrigin}/creative-studio`;
    return {
      indexable: true,
      robots: 'index, follow',
      canonicalUrl: url,
      ogUrl: url,
      title: isKa
        ? 'PROTON Creative Studio — AI სურათები, კოპირაიტინგი და თარჯიმანი'
        : 'PROTON Creative Studio — AI Visuals, Copywriting & Translation',
      description: isKa
        ? 'შექმენით მაღალი ხარისხის AI ვიზუალები, სარეკლამო ტექსტები და ორენოვანი თარგმანები PROTON Creative Studio-ს ერთიან სივრცეში.'
        : 'Create high-converting copywriting, studio AI artwork, and bilingual translations in PROTON Creative Studio.',
      preserveListingMeta: false,
      isPublicRoute: true,
    };
  }

  // 5. Documentation / About Platform ('/documentation')
  if (cleanPath === '/documentation') {
    const url = `${cleanOrigin}/documentation`;
    return {
      indexable: true,
      robots: 'index, follow',
      canonicalUrl: url,
      ogUrl: url,
      title: isKa
        ? 'PROTON — პლატფორმის შესახებ, სტრუქტურა და მისია'
        : 'About PROTON — Platform Structure, Vision & Principles',
      description: isKa
        ? 'გაეცანით PROTON-ის ხედვას, მისიას, უსაფრთხოების პრინციპებსა და ციფრული ეკოსისტემის სტრუქტურას.'
        : 'Explore PROTON’s mission, platform architecture, and core principles of security, simplicity, and practical AI.',
      preserveListingMeta: false,
      isPublicRoute: true,
    };
  }

  // 6. All Private Workspace Routes, AI Tool Sub-views (/image, /copywriting, /translator),
  //    and ALL Unknown / Unmatched Fallback URLs (including /studio) -> Strictly noindex, nofollow
  const isKnownPrivate = PRIVATE_OR_TOOL_PATHS.has(cleanPath);
  return {
    indexable: false,
    robots: 'noindex, nofollow',
    canonicalUrl: null,
    ogUrl: null,
    title: isKnownPrivate ? 'Proton Workspace' : 'Proton Workspace',
    description:
      'Proton არის ადამიანებისა და კომპანიებისთვის შექმნილი მრავალფუნქციური ციფრული სივრცე.',
    preserveListingMeta: false,
    isPublicRoute: false,
  };
}

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonicalLink(href: string | null): void {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector('link[rel="canonical"]');
  if (!href) {
    if (existing) {
      existing.remove();
    }
    return;
  }
  if (existing) {
    existing.setAttribute('href', href);
  } else {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', href);
    document.head.appendChild(link);
  }
}

export function applyRouteSeoMetadataToDom(params: {
  pathname: string;
  search?: string;
  language?: 'en' | 'ka';
  baseUrl?: string;
}): RouteSeoMetadata {
  const baseUrl = params.baseUrl || getClientCanonicalBaseUrl();
  const seo = resolveRouteSeoMetadata({ ...params, baseUrl });

  if (typeof document === 'undefined') {
    return seo;
  }

  upsertMetaTag('name', 'robots', seo.robots);
  setCanonicalLink(seo.canonicalUrl);

  if (seo.ogUrl) {
    upsertMetaTag('property', 'og:url', seo.ogUrl);
    upsertMetaTag('name', 'twitter:url', seo.ogUrl);
  }

  // If a listingId is open on /market-hub, preserve listing-specific title/description/OG tags
  // populated by SSR (marketListingMeta.ts) or MarketHub.tsx.
  if (!seo.preserveListingMeta) {
    document.title = seo.title;
    upsertMetaTag('name', 'description', seo.description);
    upsertMetaTag('property', 'og:title', seo.title);
    upsertMetaTag('property', 'og:description', seo.description);
    upsertMetaTag('name', 'twitter:title', seo.title);
    upsertMetaTag('name', 'twitter:description', seo.description);
  }

  return seo;
}

export function applyListingSeoMetadataToDom(params: {
  listingId: string;
  title: string;
  description: string;
  baseUrl?: string;
}): void {
  if (typeof document === 'undefined') return;
  const baseUrl = (params.baseUrl || getClientCanonicalBaseUrl()).replace(/\/+$/, '');
  const cleanId = params.listingId.trim();
  const canonicalUrl = `${baseUrl}/market-hub?listingId=${encodeURIComponent(cleanId)}`;
  const truncatedDesc = (params.description || '').trim().substring(0, 160);

  document.title = params.title;
  upsertMetaTag('name', 'robots', 'index, follow');
  setCanonicalLink(canonicalUrl);
  upsertMetaTag('name', 'description', truncatedDesc);
  upsertMetaTag('property', 'og:title', params.title);
  upsertMetaTag('property', 'og:description', truncatedDesc);
  upsertMetaTag('property', 'og:url', canonicalUrl);
  upsertMetaTag('name', 'twitter:title', params.title);
  upsertMetaTag('name', 'twitter:description', truncatedDesc);
  upsertMetaTag('name', 'twitter:url', canonicalUrl);
}
