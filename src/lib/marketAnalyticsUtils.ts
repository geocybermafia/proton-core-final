import {
  AchievementBadgeId,
  AnalyticsPeriod,
  ListingType,
  ListingTypeFilter,
  ListingViewerBreakdown,
  PeriodComparison,
  PeriodMetrics,
  RankingEntry,
  RankingPeriod,
  RankingScope,
  ViewerSegmentMetrics,
} from '../types';
import { inferListingType } from './listingClassification.js';

export interface BucketCounter {
  impressions: number;
  views: number;
  uniqueViewers: number;
  authImpressions?: number;
  authViews?: number;
  authUniqueViewers?: number;
  guestImpressions?: number;
  guestViews?: number;
  guestUniqueViewers?: number;
}

export interface RawListingAnalyticsDoc {
  listingId: string;
  sellerId: string;
  title: string;
  titleGe?: string;
  category: string;
  listingType?: 'product' | 'service' | 'project';
  image?: string;
  status?: string;
  sellerName?: string;
  country?: string;
  region?: string;
  optedOut?: boolean;
  impressions: number;
  views: number;
  uniqueViewers: number;
  authImpressions?: number;
  authViews?: number;
  authUniqueViewers?: number;
  guestImpressions?: number;
  guestViews?: number;
  guestUniqueViewers?: number;
  breakdownSince?: number;
  hourly?: Record<string, BucketCounter>;
  daily?: Record<string, BucketCounter>;
  createdAt: number;
  listingCreatedAt?: number;
  updatedAt: number;
}

export const BOT_USER_AGENT_PATTERN =
  /bot|crawler|spider|slurp|mediapartners|headless|puppeteer|playwright|selenium|phantom|curl|wget|python-requests|httpclient|axios\/|node-fetch|postman|insomnia|scrapy|lighthouse|pingdom|uptimerobot/i;

export const IMPRESSION_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
export const VIEW_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
/** @deprecated Preserved for export compatibility; server queries now use cursor pagination without fixed truncation. */
export const ANALYTICS_MAX_LISTINGS_SCAN = 300;

export function isBotUserAgent(userAgent?: string | null): boolean {
  if (!userAgent || typeof userAgent !== 'string') return true;
  const trimmed = userAgent.trim();
  if (trimmed.length < 8) return true;
  return BOT_USER_AGENT_PATTERN.test(trimmed);
}

export function isValidAnalyticsId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(id)
  );
}

export function getHourBucketKey(tsMs: number): string {
  const d = new Date(tsMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hour = String(d.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}`;
}

export function getDayBucketKey(tsMs: number): string {
  const d = new Date(tsMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeBucketCounter(v: BucketCounter): BucketCounter {
  const bucket: BucketCounter = {
    impressions: Number(v.impressions) || 0,
    views: Number(v.views) || 0,
    uniqueViewers: Number(v.uniqueViewers) || 0,
  };
  if (
    typeof v.authImpressions === 'number' ||
    typeof v.authViews === 'number' ||
    typeof v.authUniqueViewers === 'number' ||
    typeof v.guestImpressions === 'number' ||
    typeof v.guestViews === 'number' ||
    typeof v.guestUniqueViewers === 'number'
  ) {
    bucket.authImpressions = Number(v.authImpressions) || 0;
    bucket.authViews = Number(v.authViews) || 0;
    bucket.authUniqueViewers = Number(v.authUniqueViewers) || 0;
    bucket.guestImpressions = Number(v.guestImpressions) || 0;
    bucket.guestViews = Number(v.guestViews) || 0;
    bucket.guestUniqueViewers = Number(v.guestUniqueViewers) || 0;
  }
  return bucket;
}

export function pruneHourlyBuckets(
  hourly: Record<string, BucketCounter> | undefined,
  nowMs: number
): Record<string, BucketCounter> {
  const result: Record<string, BucketCounter> = {};
  if (!hourly || typeof hourly !== 'object') return result;
  const minTs = nowMs - 52 * 60 * 60 * 1000;
  const minKey = getHourBucketKey(minTs);
  for (const [k, v] of Object.entries(hourly)) {
    if (k >= minKey && v && typeof v === 'object') {
      result[k] = sanitizeBucketCounter(v);
    }
  }
  return result;
}

export function pruneDailyBuckets(
  daily: Record<string, BucketCounter> | undefined,
  nowMs: number
): Record<string, BucketCounter> {
  const result: Record<string, BucketCounter> = {};
  if (!daily || typeof daily !== 'object') return result;
  const minTs = nowMs - 62 * 24 * 60 * 60 * 1000;
  const minKey = getDayBucketKey(minTs);
  for (const [k, v] of Object.entries(daily)) {
    if (k >= minKey && v && typeof v === 'object') {
      result[k] = sanitizeBucketCounter(v);
    }
  }
  return result;
}

export function computeEngagementRate(views: number, impressions: number): number {
  if (!Number.isFinite(views) || !Number.isFinite(impressions) || views <= 0 || impressions <= 0) {
    return 0;
  }
  const raw = (views / impressions) * 100;
  return Math.min(100, Math.round(raw * 10) / 10);
}

function sumBucketKeys(
  buckets: Record<string, BucketCounter> | undefined,
  keys: string[]
): PeriodMetrics {
  let impressions = 0;
  let views = 0;
  let uniqueViewers = 0;
  if (buckets) {
    for (const key of keys) {
      const b = buckets[key];
      if (b) {
        impressions += Number(b.impressions) || 0;
        views += Number(b.views) || 0;
        uniqueViewers += Number(b.uniqueViewers) || 0;
      }
    }
  }
  return {
    impressions,
    views,
    uniqueViewers,
    engagementRate: computeEngagementRate(views, impressions),
  };
}

function computeComparison(curr: PeriodMetrics, prev: PeriodMetrics): PeriodComparison {
  const pct = (c: number, p: number): number | null => {
    if (p <= 0) return c > 0 ? 100 : null;
    return Math.round(((c - p) / p) * 1000) / 10;
  };
  return {
    impressionsDelta: curr.impressions - prev.impressions,
    viewsDelta: curr.views - prev.views,
    uniqueViewersDelta: curr.uniqueViewers - prev.uniqueViewers,
    engagementRateDelta: Math.round((curr.engagementRate - prev.engagementRate) * 10) / 10,
    impressionsChangePct: pct(curr.impressions, prev.impressions),
    viewsChangePct: pct(curr.views, prev.views),
    uniqueViewersChangePct: pct(curr.uniqueViewers, prev.uniqueViewers),
  };
}

export function buildHourWindowKeys(nowMs: number, offsetHoursStart: number, count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(getHourBucketKey(nowMs - (offsetHoursStart + i) * 60 * 60 * 1000));
  }
  return keys;
}

export function buildDayWindowKeys(nowMs: number, offsetDaysStart: number, count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(getDayBucketKey(nowMs - (offsetDaysStart + i) * 24 * 60 * 60 * 1000));
  }
  return keys;
}

export function aggregatePeriodFromBuckets(
  docData: Pick<RawListingAnalyticsDoc, 'impressions' | 'views' | 'uniqueViewers' | 'hourly' | 'daily'>,
  nowMs: number = Date.now()
): {
  periods: Record<AnalyticsPeriod, PeriodMetrics>;
  comparisons: Record<'24h' | '7d' | '30d', PeriodComparison>;
  prevPeriods: Record<'24h' | '7d' | '30d', PeriodMetrics>;
} {
  const h24Keys = buildHourWindowKeys(nowMs, 0, 24);
  const prevH24Keys = buildHourWindowKeys(nowMs, 24, 24);

  const d7Keys = buildDayWindowKeys(nowMs, 0, 7);
  const prevD7Keys = buildDayWindowKeys(nowMs, 7, 7);

  const d30Keys = buildDayWindowKeys(nowMs, 0, 30);
  const prevD30Keys = buildDayWindowKeys(nowMs, 30, 30);

  const m24h = sumBucketKeys(docData.hourly, h24Keys);
  const prev24h = sumBucketKeys(docData.hourly, prevH24Keys);

  const m7d = sumBucketKeys(docData.daily, d7Keys);
  const prev7d = sumBucketKeys(docData.daily, prevD7Keys);

  const m30d = sumBucketKeys(docData.daily, d30Keys);
  const prev30d = sumBucketKeys(docData.daily, prevD30Keys);

  const totalImpressions = Number(docData.impressions) || 0;
  const totalViews = Number(docData.views) || 0;
  const totalUniqueViewers = Number(docData.uniqueViewers) || 0;

  const mAll: PeriodMetrics = {
    impressions: totalImpressions,
    views: totalViews,
    uniqueViewers: totalUniqueViewers,
    engagementRate: computeEngagementRate(totalViews, totalImpressions),
  };

  return {
    periods: {
      '24h': m24h,
      '7d': m7d,
      '30d': m30d,
      'all': mAll,
    },
    comparisons: {
      '24h': computeComparison(m24h, prev24h),
      '7d': computeComparison(m7d, prev7d),
      '30d': computeComparison(m30d, prev30d),
    },
    prevPeriods: {
      '24h': prev24h,
      '7d': prev7d,
      '30d': prev30d,
    },
  };
}

export function sumPeriodMetricsList(list: PeriodMetrics[]): PeriodMetrics {
  let impressions = 0;
  let views = 0;
  let uniqueViewers = 0;
  for (const item of list) {
    impressions += item.impressions || 0;
    views += item.views || 0;
    uniqueViewers += item.uniqueViewers || 0;
  }
  return {
    impressions,
    views,
    uniqueViewers,
    engagementRate: computeEngagementRate(views, impressions),
  };
}

function createZeroViewerSegmentMetrics(): ViewerSegmentMetrics {
  return {
    authImpressions: 0,
    authViews: 0,
    authUniqueViewers: 0,
    guestImpressions: 0,
    guestViews: 0,
    guestUniqueViewers: 0,
  };
}

function sumViewerBreakdownBuckets(
  buckets: Record<string, BucketCounter> | undefined,
  keys: string[]
): ViewerSegmentMetrics {
  const totals = createZeroViewerSegmentMetrics();
  if (!buckets) return totals;
  for (const key of keys) {
    const b = buckets[key];
    if (!b) continue;
    totals.authImpressions += Number(b.authImpressions) || 0;
    totals.authViews += Number(b.authViews) || 0;
    totals.authUniqueViewers += Number(b.authUniqueViewers) || 0;
    totals.guestImpressions += Number(b.guestImpressions) || 0;
    totals.guestViews += Number(b.guestViews) || 0;
    totals.guestUniqueViewers += Number(b.guestUniqueViewers) || 0;
  }
  return totals;
}

export function hasRecordedViewerBreakdown(docData?: Partial<RawListingAnalyticsDoc> | null): boolean {
  if (!docData) return false;
  if (typeof docData.breakdownSince === 'number' && Number.isFinite(docData.breakdownSince)) {
    return true;
  }
  return (
    typeof docData.authImpressions === 'number' ||
    typeof docData.authViews === 'number' ||
    typeof docData.authUniqueViewers === 'number' ||
    typeof docData.guestImpressions === 'number' ||
    typeof docData.guestViews === 'number' ||
    typeof docData.guestUniqueViewers === 'number'
  );
}

/**
 * Aggregates guest vs authenticated viewer breakdown ONLY when breakdown counters exist on the document.
 * Never invents or backfills historical guest/auth splits for legacy analytics docs.
 */
export function aggregateViewerBreakdownFromDoc(
  docData: Partial<RawListingAnalyticsDoc> | null | undefined,
  nowMs: number = Date.now()
): ListingViewerBreakdown | undefined {
  if (!hasRecordedViewerBreakdown(docData)) {
    return undefined;
  }

  const h24Keys = buildHourWindowKeys(nowMs, 0, 24);
  const d7Keys = buildDayWindowKeys(nowMs, 0, 7);
  const d30Keys = buildDayWindowKeys(nowMs, 0, 30);

  return {
    ...(typeof docData?.breakdownSince === 'number' && Number.isFinite(docData.breakdownSince)
      ? { breakdownSince: docData.breakdownSince }
      : {}),
    periods: {
      '24h': sumViewerBreakdownBuckets(docData?.hourly, h24Keys),
      '7d': sumViewerBreakdownBuckets(docData?.daily, d7Keys),
      '30d': sumViewerBreakdownBuckets(docData?.daily, d30Keys),
      all: {
        authImpressions: Number(docData?.authImpressions) || 0,
        authViews: Number(docData?.authViews) || 0,
        authUniqueViewers: Number(docData?.authUniqueViewers) || 0,
        guestImpressions: Number(docData?.guestImpressions) || 0,
        guestViews: Number(docData?.guestViews) || 0,
        guestUniqueViewers: Number(docData?.guestUniqueViewers) || 0,
      },
    },
  };
}

export function sumViewerBreakdownList(
  breakdowns: Array<ListingViewerBreakdown | undefined>
): ListingViewerBreakdown | undefined {
  const valid = breakdowns.filter((b): b is ListingViewerBreakdown => Boolean(b));
  if (valid.length === 0) return undefined;

  const periodKeys: AnalyticsPeriod[] = ['24h', '7d', '30d', 'all'];
  const periods = {} as Record<AnalyticsPeriod, ViewerSegmentMetrics>;

  for (const pk of periodKeys) {
    const sum = createZeroViewerSegmentMetrics();
    for (const item of valid) {
      const m = item.periods[pk];
      if (!m) continue;
      sum.authImpressions += m.authImpressions || 0;
      sum.authViews += m.authViews || 0;
      sum.authUniqueViewers += m.authUniqueViewers || 0;
      sum.guestImpressions += m.guestImpressions || 0;
      sum.guestViews += m.guestViews || 0;
      sum.guestUniqueViewers += m.guestUniqueViewers || 0;
    }
    periods[pk] = sum;
  }

  const sinceCandidates = valid
    .map((b) => b.breakdownSince)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  return {
    ...(sinceCandidates.length > 0 ? { breakdownSince: Math.min(...sinceCandidates) } : {}),
    periods,
  };
}

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  GE: 'GEO',
  GEO: 'GEO',
  GEORGIA: 'GEO',
  'საქართველო': 'GEO',
  US: 'USA',
  USA: 'USA',
  'UNITED STATES': 'USA',
  DE: 'DEU',
  DEU: 'DEU',
  GERMANY: 'DEU',
  CN: 'CHN',
  CHN: 'CHN',
  CHINA: 'CHN',
  JP: 'JPN',
  JPN: 'JPN',
  JAPAN: 'JPN',
  GB: 'GBR',
  UK: 'GBR',
  GBR: 'GBR',
  'UNITED KINGDOM': 'GBR',
  FR: 'FRA',
  FRA: 'FRA',
  FRANCE: 'FRA',
  EE: 'EST',
  EST: 'EST',
  ESTONIA: 'EST',
  IL: 'ISR',
  ISR: 'ISR',
  ISRAEL: 'ISR',
  SG: 'SGP',
  SGP: 'SGP',
  SINGAPORE: 'SGP',
  AE: 'VAE',
  UAE: 'VAE',
  VAE: 'VAE',
};

export function normalizeCountryCode(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  if (upper === 'GLOBAL' || upper === 'WORLDWIDE' || upper === 'ONLINE' || upper === 'REMOTE') {
    return undefined;
  }
  if (COUNTRY_NAME_TO_CODE[upper]) {
    return COUNTRY_NAME_TO_CODE[upper];
  }
  if (/^[A-Z]{2,3}$/.test(upper)) {
    return upper;
  }
  return undefined;
}

/**
 * Resolves reliable seller/listing location STRICTLY from explicit profile & listing fields.
 * NEVER guesses or infers country/region from IP addresses.
 */
export function resolveReliableSellerLocation(params: {
  profileCountry?: string | null;
  profileRegion?: string | null;
  listingCountry?: string | null;
  listingCity?: string | null;
}): { country?: string; region?: string } {
  let country = normalizeCountryCode(params.profileCountry);
  let region: string | undefined;

  const rawProfileRegion = typeof params.profileRegion === 'string' ? params.profileRegion.trim() : '';
  if (rawProfileRegion && rawProfileRegion.toLowerCase() !== 'global' && rawProfileRegion.toLowerCase() !== 'online') {
    const parts = rawProfileRegion.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const maybeCountry = normalizeCountryCode(parts[parts.length - 1]);
      if (maybeCountry && !country) {
        country = maybeCountry;
      }
      region = parts.slice(0, -1).join(', ');
    } else {
      region = rawProfileRegion;
    }
  }

  // Listing's own explicit non-GLOBAL country is valid when profile country is absent
  if (!country) {
    country = normalizeCountryCode(params.listingCountry);
  }

  // Use listing city as regional signal only if explicit and not generic 'online'
  if (!region && typeof params.listingCity === 'string') {
    const cityTrimmed = params.listingCity.trim();
    if (
      cityTrimmed &&
      cityTrimmed.toLowerCase() !== 'online' &&
      cityTrimmed.toLowerCase() !== 'remote' &&
      cityTrimmed.toLowerCase() !== 'global'
    ) {
      region = cityTrimmed;
    }
  }

  return { country, region };
}

export interface BalancedScoreInput {
  impressions: number;
  views: number;
  uniqueViewers: number;
  categoryBaseline: number;
  sellerRatingAvg?: number;
  sellerRatingCount?: number;
  listingCreatedAt?: number;
  nowMs?: number;
}

export function computeBalancedScore(input: BalancedScoreInput): {
  engagementRate: number;
  categoryNormalizedScore: number;
  freshnessBoost: number;
  balancedScore: number;
} {
  const {
    impressions,
    views,
    uniqueViewers,
    categoryBaseline,
    sellerRatingAvg = 0,
    sellerRatingCount = 0,
    listingCreatedAt,
    nowMs = Date.now(),
  } = input;

  if (views <= 0 && impressions <= 0) {
    return {
      engagementRate: 0,
      categoryNormalizedScore: 0,
      freshnessBoost: 0,
      balancedScore: 0,
    };
  }

  const engagementRate = computeEngagementRate(views, impressions);
  // Bayesian smoothing prevents 1/1 (100%) from beating genuine sustained engagement
  const smoothedEngagement =
    views / Math.max(impressions + 10, views + 10, 1);

  const uniqueComponent = Math.log1p(Math.max(0, uniqueViewers)) * 28;
  const viewsComponent = Math.log1p(Math.max(0, views)) * 8;
  const engagementComponent = smoothedEngagement * 35;

  const safeBaseline = Math.max(1, categoryBaseline);
  const rawDemand = uniqueViewers + views * 0.35;
  const categoryRatio = rawDemand / safeBaseline;
  const categoryNormalizedScore = Math.round(Math.log1p(categoryRatio) * 18 * 100) / 100;

  const reviewComponent =
    sellerRatingCount > 0 && sellerRatingAvg > 0
      ? (Math.min(5, sellerRatingAvg) / 5) * Math.min(sellerRatingCount, 10) * 1.2
      : 0;

  let freshnessBoost = 0;
  if (listingCreatedAt && Number.isFinite(listingCreatedAt) && listingCreatedAt > 0) {
    const ageDays = Math.max(0, (nowMs - listingCreatedAt) / (24 * 60 * 60 * 1000));
    if (ageDays <= 14) {
      freshnessBoost = Math.round((1 - ageDays / 14) * 12 * 100) / 100;
    }
  }

  const balancedScore = Math.round(
    (uniqueComponent +
      viewsComponent +
      engagementComponent +
      categoryNormalizedScore +
      reviewComponent +
      freshnessBoost) *
      100
  ) / 100;

  return {
    engagementRate,
    categoryNormalizedScore,
    freshnessBoost,
    balancedScore,
  };
}

export function computeListingAchievements(params: {
  curr7d: PeriodMetrics;
  prev7d: PeriodMetrics;
  curr30d: PeriodMetrics;
  listingCreatedAt?: number;
  nowMs?: number;
  categoryRank?: number;
  categoryTotal?: number;
  globalRank?: number;
}): AchievementBadgeId[] {
  const badges: AchievementBadgeId[] = [];
  const {
    curr7d,
    prev7d,
    curr30d,
    listingCreatedAt,
    nowMs = Date.now(),
    categoryRank,
    categoryTotal = 0,
    globalRank,
  } = params;

  const ageDays =
    listingCreatedAt && Number.isFinite(listingCreatedAt) && listingCreatedAt > 0
      ? Math.max(0, (nowMs - listingCreatedAt) / (24 * 60 * 60 * 1000))
      : 999;

  // 1. Rising Listing: real 7d growth >= 50% with at least 5 unique viewers, or strong fresh listing launch
  if (
    (curr7d.uniqueViewers >= 5 &&
      prev7d.uniqueViewers > 0 &&
      (curr7d.uniqueViewers - prev7d.uniqueViewers) / prev7d.uniqueViewers >= 0.5) ||
    (ageDays <= 14 && curr7d.uniqueViewers >= 5 && curr7d.engagementRate >= 8)
  ) {
    badges.push('rising_listing');
  }

  // 2. Popular Listing: sustained 30d demand
  if (curr30d.uniqueViewers >= 25 && curr30d.views >= 35) {
    badges.push('popular_listing');
  }

  // 3. Top in Category: #1 in category (with >=5 unique viewers) or top 3 in >=10-listing category (with >=10 unique viewers)
  if (
    typeof categoryRank === 'number' &&
    ((categoryRank === 1 && curr7d.uniqueViewers >= 5) ||
      (categoryRank <= 3 && categoryTotal >= 10 && curr30d.uniqueViewers >= 10))
  ) {
    badges.push('top_in_category');
  }

  // 4. Global Recognition: Global Top 10 with genuine engagement
  if (
    typeof globalRank === 'number' &&
    globalRank <= 10 &&
    curr30d.uniqueViewers >= 20 &&
    curr30d.engagementRate >= 5
  ) {
    badges.push('global_recognition');
  }

  return badges;
}

export function normalizeListingTypeFilter(raw?: string | null): ListingTypeFilter {
  if (typeof raw !== 'string') return 'all';
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'product' || trimmed === 'service' || trimmed === 'project') {
    return trimmed as ListingType;
  }
  return 'all';
}

export function buildRankingsFromPublicDocs(params: {
  docs: RawListingAnalyticsDoc[];
  sellerRatingsMap: Record<string, { avg: number; count: number }>;
  scope: RankingScope;
  period: RankingPeriod;
  listingType?: ListingTypeFilter;
  category?: string;
  country?: string;
  region?: string;
  nowMs?: number;
  limitCount?: number;
}): RankingEntry[] {
  const {
    docs,
    sellerRatingsMap,
    scope,
    period,
    listingType,
    category,
    country,
    region,
    nowMs = Date.now(),
    limitCount = 50,
  } = params;

  // Filter active, non-opted-out docs with actual activity in selected period
  const eligible = docs
    .filter((d) => !d.optedOut && (!d.status || d.status === 'active'))
    .map((d) => {
      const agg = aggregatePeriodFromBuckets(d, nowMs);
      const periodMetrics = agg.periods[period];
      const normalizedType = inferListingType(d.category, d.listingType);
      return {
        doc: d,
        normalizedType,
        agg,
        periodMetrics,
      };
    })
    .filter((item) => item.periodMetrics.views > 0 || item.periodMetrics.impressions > 0);

  if (eligible.length === 0) return [];

  // Category baselines (median raw demand per category so niche categories compete fairly)
  const categoryDemands = new Map<string, number[]>();
  for (const item of eligible) {
    const cat = (item.doc.category || 'other').toLowerCase();
    const arr = categoryDemands.get(cat) || [];
    arr.push(item.periodMetrics.uniqueViewers + item.periodMetrics.views * 0.35);
    categoryDemands.set(cat, arr);
  }
  const categoryBaselines = new Map<string, number>();
  for (const [cat, vals] of categoryDemands.entries()) {
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    categoryBaselines.set(cat, Math.max(1, median));
  }

  // Compute balanced score for all eligible entries to establish global & category ranks
  const scoredAll = eligible.map((item) => {
    const cat = (item.doc.category || 'other').toLowerCase();
    const baseline = categoryBaselines.get(cat) || 1;
    const rating = sellerRatingsMap[item.doc.sellerId];
    const scoreData = computeBalancedScore({
      impressions: item.periodMetrics.impressions,
      views: item.periodMetrics.views,
      uniqueViewers: item.periodMetrics.uniqueViewers,
      categoryBaseline: baseline,
      sellerRatingAvg: rating?.avg || 0,
      sellerRatingCount: rating?.count || 0,
      listingCreatedAt: item.doc.listingCreatedAt || item.doc.createdAt,
      nowMs,
    });

    return {
      ...item,
      rating,
      scoreData,
    };
  });

  scoredAll.sort((a, b) => {
    if (b.scoreData.balancedScore !== a.scoreData.balancedScore) {
      return b.scoreData.balancedScore - a.scoreData.balancedScore;
    }
    return b.periodMetrics.uniqueViewers - a.periodMetrics.uniqueViewers;
  });

  // Track global ranks & category ranks
  const globalRankMap = new Map<string, number>();
  const categoryLists = new Map<string, typeof scoredAll>();
  scoredAll.forEach((entry, idx) => {
    globalRankMap.set(entry.doc.listingId, idx + 1);
    const cat = (entry.doc.category || 'other').toLowerCase();
    const list = categoryLists.get(cat) || [];
    list.push(entry);
    categoryLists.set(cat, list);
  });

  const categoryRankMap = new Map<string, { rank: number; total: number }>();
  for (const list of categoryLists.values()) {
    list.forEach((entry, idx) => {
      categoryRankMap.set(entry.doc.listingId, { rank: idx + 1, total: list.length });
    });
  }

  // Apply requested scope + listingType filters (strictly without IP guessing)
  const normCountryFilter = normalizeCountryCode(country);
  const normRegionFilter = region ? region.trim().toLowerCase() : '';
  const normCategoryFilter = category && category !== 'all' ? category.trim().toLowerCase() : '';
  const normListingTypeFilter = normalizeListingTypeFilter(listingType);

  const scoped = scoredAll.filter((entry) => {
    if (normListingTypeFilter !== 'all' && entry.normalizedType !== normListingTypeFilter) {
      return false;
    }
    if (scope === 'country') {
      if (!entry.doc.country) return false;
      if (normCountryFilter && entry.doc.country.toUpperCase() !== normCountryFilter) return false;
      return true;
    }
    if (scope === 'regional') {
      if (!entry.doc.region) return false;
      if (normRegionFilter && !entry.doc.region.toLowerCase().includes(normRegionFilter)) return false;
      return true;
    }
    if (scope === 'category') {
      if (!normCategoryFilter) return true;
      return (entry.doc.category || '').toLowerCase() === normCategoryFilter;
    }
    return true; // 'global' or 'listingType'
  });

  return scoped.slice(0, limitCount).map((entry, idx) => {
    const catInfo = categoryRankMap.get(entry.doc.listingId);
    const globalRank = globalRankMap.get(entry.doc.listingId);
    const achievements = computeListingAchievements({
      curr7d: entry.agg.periods['7d'],
      prev7d: entry.agg.prevPeriods['7d'],
      curr30d: entry.agg.periods['30d'],
      listingCreatedAt: entry.doc.listingCreatedAt || entry.doc.createdAt,
      nowMs,
      categoryRank: catInfo?.rank,
      categoryTotal: catInfo?.total,
      globalRank,
    });

    return {
      rank: idx + 1,
      listingId: entry.doc.listingId,
      title: entry.doc.title,
      titleGe: entry.doc.titleGe,
      category: entry.doc.category,
      listingType: entry.normalizedType,
      image: entry.doc.image,
      sellerName: entry.doc.sellerName || 'Proton Vendor',
      country: entry.doc.country,
      region: entry.doc.region,
      impressions: entry.periodMetrics.impressions,
      views: entry.periodMetrics.views,
      uniqueViewers: entry.periodMetrics.uniqueViewers,
      engagementRate: entry.scoreData.engagementRate,
      categoryNormalizedScore: entry.scoreData.categoryNormalizedScore,
      sellerRatingAvg: entry.rating?.avg,
      sellerRatingCount: entry.rating?.count,
      freshnessBoost: entry.scoreData.freshnessBoost,
      balancedScore: entry.scoreData.balancedScore,
      achievements,
      period,
    };
  });
}
