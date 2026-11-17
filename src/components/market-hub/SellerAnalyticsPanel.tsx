import React, { useMemo, useState } from 'react';
import {
  Eye,
  MousePointerClick,
  Users,
  Activity,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  AlertCircle,
  ExternalLink,
  Trophy,
} from 'lucide-react';
import {
  AnalyticsPeriod,
  Listing,
  ListingAnalyticsStats,
  SellerAnalyticsOverview,
} from '../../types';
import { cn } from '../../lib/utils';
import { MarketTheme, getCategoryLabel, getListingTitle } from './MarketConstants';
import { AchievementBadge } from './AchievementBadge';

export interface SellerAnalyticsPanelProps {
  overview: SellerAnalyticsOverview | null;
  loading: boolean;
  unavailableReason?: string;
  sellerListings: Listing[];
  language: string;
  t: any;
  currentTheme: MarketTheme;
  onToggleOptOut: (nextOptOut: boolean) => Promise<void>;
  onSelectListing: (listing: Listing) => void;
  onOpenRankings?: () => void;
}

const PERIOD_OPTIONS: Array<{ id: AnalyticsPeriod; en: string; ka: string }> = [
  { id: '24h', en: '24h', ka: '24 სთ' },
  { id: '7d', en: '7 Days', ka: '7 დღე' },
  { id: '30d', en: '30 Days', ka: '30 დღე' },
  { id: 'all', en: 'All Time', ka: 'სულ' },
];

function DeltaBadge({
  changePct,
  delta,
  language,
}: {
  changePct: number | null;
  delta: number;
  language: string;
}) {
  if (changePct === null && delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-proton-muted">
        <Minus size={11} />
        <span>0%</span>
      </span>
    );
  }
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-bold font-mono',
        isPositive ? 'text-emerald-500' : isNegative ? 'text-rose-500' : 'text-proton-muted'
      )}
      title={language === 'ka' ? 'წინა პერიოდთან შედარებით' : 'vs previous period'}
    >
      {isPositive ? (
        <ArrowUpRight size={12} />
      ) : isNegative ? (
        <ArrowDownRight size={12} />
      ) : (
        <Minus size={11} />
      )}
      <span>
        {isPositive ? '+' : ''}
        {changePct !== null ? `${changePct}%` : delta}
      </span>
    </span>
  );
}

export const SellerAnalyticsPanel = React.memo(function SellerAnalyticsPanel({
  overview,
  loading,
  unavailableReason,
  sellerListings,
  language,
  t,
  currentTheme,
  onToggleOptOut,
  onSelectListing,
  onOpenRankings,
}: SellerAnalyticsPanelProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>('7d');
  const [isUpdatingOptOut, setIsUpdatingOptOut] = useState(false);

  const listingMap = useMemo(() => {
    const m = new Map<string, Listing>();
    sellerListings.forEach((l) => m.set(l.id, l));
    return m;
  }, [sellerListings]);

  // If overview hasn't loaded or server storage lacks Admin creds, construct clean zero-baseline rows for owner's real listings
  const effectiveListings: ListingAnalyticsStats[] = useMemo(() => {
    if (overview?.listings && overview.listings.length > 0) {
      return overview.listings;
    }
    const zeroMetrics = { impressions: 0, views: 0, uniqueViewers: 0, engagementRate: 0 };
    const zeroComp = {
      impressionsDelta: 0,
      viewsDelta: 0,
      uniqueViewersDelta: 0,
      engagementRateDelta: 0,
      impressionsChangePct: null,
      viewsChangePct: null,
      uniqueViewersChangePct: null,
    };
    return sellerListings.map((l) => ({
      listingId: l.id,
      title: l.title,
      titleGe: l.titleGe,
      category: l.category,
      listingType: l.listingType,
      image: (Array.isArray(l.images) && l.images[0]) || l.image,
      status: l.status || 'active',
      optedOut: Boolean(overview?.competitionOptOut),
      createdAt: l.createdAt || 0,
      updatedAt: 0,
      periods: { '24h': zeroMetrics, '7d': zeroMetrics, '30d': zeroMetrics, all: zeroMetrics },
      comparisons: { '24h': zeroComp, '7d': zeroComp, '30d': zeroComp },
      achievements: [],
    }));
  }, [overview, sellerListings]);

  const activeMetrics = overview?.periodTotals?.[selectedPeriod] || {
    impressions: 0,
    views: 0,
    uniqueViewers: 0,
    engagementRate: 0,
  };
  const activeComparison =
    selectedPeriod !== 'all' ? overview?.periodComparisons?.[selectedPeriod] : undefined;

  const isOptedOut = Boolean(overview?.competitionOptOut);

  const handleOptOutToggle = async () => {
    if (isUpdatingOptOut) return;
    setIsUpdatingOptOut(true);
    try {
      await onToggleOptOut(!isOptedOut);
    } finally {
      setIsUpdatingOptOut(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Header Row: Period Switcher & Rankings Jump */}
      <div
        className={cn(
          'p-4 sm:p-5 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4',
          currentTheme.card
        )}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn('text-sm sm:text-base font-black uppercase tracking-wider', currentTheme.text)}>
              {language === 'ka' ? 'განცხადებების ანალიტიკა' : 'Listing Analytics'}
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-[9px] font-bold uppercase tracking-wider">
              <ShieldCheck size={11} />
              {language === 'ka' ? 'მხოლოდ მფლობელისთვის' : 'Owner Only'}
            </span>
          </div>
          <p className={cn('text-xs leading-relaxed', currentTheme.muted)}>
            {t?.market?.analytics?.no_data_yet ||
              (language === 'ka'
                ? 'საწყისი მაჩვენებლები 0-ია და ივსება მხოლოდ რეალური ნახვების მიხედვით.'
                : 'Real metrics start from 0 and update as buyers view your listings.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-proton-bg border border-proton-border p-1 rounded-xl gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedPeriod(opt.id)}
                className={cn(
                  'px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap',
                  selectedPeriod === opt.id
                    ? 'bg-proton-accent text-proton-on-accent shadow-sm'
                    : 'text-proton-muted hover:text-proton-text hover:bg-proton-card'
                )}
              >
                {language === 'ka' ? opt.ka : opt.en}
              </button>
            ))}
          </div>

          {onOpenRankings && (
            <button
              type="button"
              onClick={onOpenRankings}
              className="px-3 py-2 rounded-xl border border-proton-border bg-proton-bg hover:border-proton-accent/40 text-[10px] font-black uppercase tracking-wider text-proton-text hover:text-proton-accent transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trophy size={13} className="text-proton-accent" />
              <span>{language === 'ka' ? 'რეიტინგები' : 'Rankings'}</span>
            </button>
          )}
        </div>
      </div>

      {unavailableReason === 'analytics/admin-credentials-missing' && (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 text-xs text-amber-200">
          <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-amber-300">
              {language === 'ka'
                ? 'სერვერის Firestore Admin კონფიგურაცია არ არის აქტიური ამ გარემოში'
                : 'Server Firestore Admin credentials are not configured in this environment'}
            </p>
            <p className="text-[11px] opacity-90">
              {language === 'ka'
                ? 'ანალიტიკის ჩაწერა დაცულია და სრულდება მხოლოდ სერვერიდან Firebase Admin SDK-ით (`FIREBASE_SERVICE_ACCOUNT_JSON` / Cloud IAM).'
                : 'Analytics writes are server-only via Firebase Admin SDK (`FIREBASE_SERVICE_ACCOUNT_JSON` / Cloud IAM). Zero values are shown instead of fabricated stats.'}
            </p>
          </div>
        </div>
      )}

      {/* 4 Core KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* 1. Impressions */}
        <div className={cn('p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between gap-2', currentTheme.card)}>
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-[10px] font-black uppercase tracking-wider', currentTheme.muted)}>
              {language === 'ka' ? 'გამოჩენები' : 'Impressions'}
            </span>
            <Eye size={14} className="text-proton-accent shrink-0" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn('text-xl sm:text-2xl font-black font-mono tabular-nums', currentTheme.text)}>
              {loading ? '...' : activeMetrics.impressions.toLocaleString()}
            </span>
            {activeComparison && (
              <DeltaBadge
                changePct={activeComparison.impressionsChangePct}
                delta={activeComparison.impressionsDelta}
                language={language}
              />
            )}
          </div>
        </div>

        {/* 2. Views */}
        <div className={cn('p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between gap-2', currentTheme.card)}>
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-[10px] font-black uppercase tracking-wider', currentTheme.muted)}>
              {language === 'ka' ? 'ნახვები (გახსნა)' : 'Views (Opens)'}
            </span>
            <MousePointerClick size={14} className="text-proton-accent shrink-0" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn('text-xl sm:text-2xl font-black font-mono tabular-nums', currentTheme.text)}>
              {loading ? '...' : activeMetrics.views.toLocaleString()}
            </span>
            {activeComparison && (
              <DeltaBadge
                changePct={activeComparison.viewsChangePct}
                delta={activeComparison.viewsDelta}
                language={language}
              />
            )}
          </div>
        </div>

        {/* 3. Unique Viewers */}
        <div className={cn('p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between gap-2', currentTheme.card)}>
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-[10px] font-black uppercase tracking-wider', currentTheme.muted)}>
              {language === 'ka' ? 'უნიკალური მნახველები' : 'Unique Viewers'}
            </span>
            <Users size={14} className="text-emerald-500 shrink-0" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-500">
              {loading ? '...' : activeMetrics.uniqueViewers.toLocaleString()}
            </span>
            {activeComparison && (
              <DeltaBadge
                changePct={activeComparison.uniqueViewersChangePct}
                delta={activeComparison.uniqueViewersDelta}
                language={language}
              />
            )}
          </div>
        </div>

        {/* 4. Engagement Rate */}
        <div className={cn('p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between gap-2', currentTheme.card)}>
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-[10px] font-black uppercase tracking-wider', currentTheme.muted)}>
              {language === 'ka' ? 'ჩართულობა' : 'Engagement Rate'}
            </span>
            <Activity size={14} className="text-amber-500 shrink-0" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn('text-xl sm:text-2xl font-black font-mono tabular-nums', currentTheme.text)}>
              {loading ? '...' : `${activeMetrics.engagementRate}%`}
            </span>
            {activeComparison && (
              <span className="text-[10px] font-mono text-proton-muted">
                {activeComparison.engagementRateDelta > 0 ? '+' : ''}
                {activeComparison.engagementRateDelta}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Healthy Competition Opt-Out Control + Earned Real Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className={cn('p-4 rounded-2xl border flex items-center justify-between gap-4', currentTheme.card)}>
          <div className="space-y-1 min-w-0">
            <div className={cn('text-xs font-black uppercase tracking-wider', currentTheme.text)}>
              {language === 'ka' ? 'საჯარო რეიტინგებში მონაწილეობა' : 'Participate in Public Rankings'}
            </div>
            <p className={cn('text-[11px] leading-relaxed', currentTheme.muted)}>
              {language === 'ka'
                ? 'თუ გამორთავთ, თქვენი განცხადებები აღარ გამოჩნდება საჯარო რეიტინგებში, ხოლო პირადი სტატისტიკა უცვლელი დარჩება.'
                : 'Opt out anytime to exclude your listings from public rankings while keeping all private statistics.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!isOptedOut}
            disabled={isUpdatingOptOut}
            onClick={handleOptOutToggle}
            className={cn(
              'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors cursor-pointer disabled:opacity-60',
              !isOptedOut
                ? 'bg-emerald-500 border-emerald-400'
                : 'bg-proton-bg border-proton-border'
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                !isOptedOut ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        <div className={cn('p-4 rounded-2xl border space-y-2', currentTheme.card)}>
          <div className={cn('text-xs font-black uppercase tracking-wider', currentTheme.text)}>
            {language === 'ka' ? 'მიღებული რეალური მიღწევები' : 'Earned Real Achievements'}
          </div>
          {overview && overview.earnedAchievements.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {overview.earnedAchievements.map((item) => (
                <AchievementBadge
                  key={`${item.listingId}-${item.id}`}
                  badgeId={item.id}
                  language={language}
                />
              ))}
            </div>
          ) : (
            <p className={cn('text-[11px] leading-relaxed', currentTheme.muted)}>
              {language === 'ka'
                ? 'მიღწევები ენიჭება ავტომატურად მხოლოდ რეალური ნახვების, ჩართულობისა და კატეგორიის შედეგების საფუძველზე.'
                : 'Achievements are awarded automatically only when real traffic and engagement thresholds are met.'}
            </p>
          )}
        </div>
      </div>

      {/* Per-Listing Performance Breakdown */}
      <div className={cn('rounded-2xl border overflow-hidden', currentTheme.card)}>
        <div className="px-4 py-3 border-b border-proton-border flex items-center justify-between gap-2">
          <h3 className={cn('text-xs font-black uppercase tracking-wider', currentTheme.text)}>
            {language === 'ka' ? 'თითოეული განცხადების შედეგები' : 'Per-Listing Performance'} ({effectiveListings.length})
          </h3>
          {loading && <Loader2 size={14} className="animate-spin text-proton-accent" />}
        </div>

        {effectiveListings.length === 0 ? (
          <div className="p-8 text-center text-xs text-proton-muted">
            {language === 'ka'
              ? 'განცხადებები ჯერ არ გაქვთ. განცხადების დამატების შემდეგ სტატისტიკა აქ გამოჩნდება.'
              : 'No listings yet. Post a listing to track impressions, views, and unique viewers.'}
          </div>
        ) : (
          <div className="divide-y divide-proton-border">
            {effectiveListings.map((stat) => {
              const p = stat.periods[selectedPeriod];
              const c = selectedPeriod !== 'all' ? stat.comparisons[selectedPeriod] : undefined;
              const listingObj = listingMap.get(stat.listingId);
              const displayTitle = listingObj
                ? getListingTitle(listingObj, language)
                : language === 'ka'
                ? stat.titleGe || stat.title
                : stat.title;

              return (
                <div
                  key={stat.listingId}
                  className="p-3.5 sm:px-5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-proton-bg/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {stat.image ? (
                      <img
                        src={stat.image}
                        alt={displayTitle}
                        className="w-12 h-12 rounded-xl object-cover border border-proton-border shrink-0 bg-proton-bg"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl border border-proton-border bg-proton-bg flex items-center justify-center text-xs font-bold text-proton-muted shrink-0">
                        📦
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xs sm:text-sm font-bold truncate', currentTheme.text)}>
                          {displayTitle}
                        </span>
                        {listingObj && (
                          <button
                            type="button"
                            onClick={() => onSelectListing(listingObj)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-proton-accent hover:underline cursor-pointer shrink-0"
                          >
                            <span>{language === 'ka' ? 'გახსნა' : 'Open'}</span>
                            <ExternalLink size={10} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold text-proton-muted">
                          {getCategoryLabel(stat.category, t, language)}
                        </span>
                        {stat.achievements.map((badge) => (
                          <AchievementBadge key={badge} badgeId={badge} language={language} compact />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 sm:gap-5 shrink-0 text-right md:min-w-[340px]">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-proton-muted">
                        {language === 'ka' ? 'გამოჩენა' : 'Impr.'}
                      </div>
                      <div className={cn('text-xs sm:text-sm font-black font-mono tabular-nums', currentTheme.text)}>
                        {p.impressions}
                      </div>
                      {c && (
                        <DeltaBadge changePct={c.impressionsChangePct} delta={c.impressionsDelta} language={language} />
                      )}
                    </div>

                    <div>
                      <div className="text-[9px] uppercase font-bold text-proton-muted">
                        {language === 'ka' ? 'ნახვა' : 'Views'}
                      </div>
                      <div className={cn('text-xs sm:text-sm font-black font-mono tabular-nums', currentTheme.text)}>
                        {p.views}
                      </div>
                      {c && <DeltaBadge changePct={c.viewsChangePct} delta={c.viewsDelta} language={language} />}
                    </div>

                    <div>
                      <div className="text-[9px] uppercase font-bold text-proton-muted">
                        {language === 'ka' ? 'უნიკალური' : 'Unique'}
                      </div>
                      <div className="text-xs sm:text-sm font-black font-mono tabular-nums text-emerald-500">
                        {p.uniqueViewers}
                      </div>
                      {c && (
                        <DeltaBadge
                          changePct={c.uniqueViewersChangePct}
                          delta={c.uniqueViewersDelta}
                          language={language}
                        />
                      )}
                    </div>

                    <div>
                      <div className="text-[9px] uppercase font-bold text-proton-muted">
                        {language === 'ka' ? 'ჩართ.' : 'Eng.'}
                      </div>
                      <div className={cn('text-xs sm:text-sm font-black font-mono tabular-nums', currentTheme.text)}>
                        {p.engagementRate}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transparency footnote on guest vs signed-in identity */}
      <p className={cn('text-[11px] leading-relaxed px-1', currentTheme.muted)}>
        {t?.market?.analytics?.guest_id_note ||
          (language === 'ka'
            ? 'სტუმრებისთვის გამოიყენება ანონიმური ბრაუზერის იდენტიფიკატორი, ავტორიზებულებისთვის — ანგარიშის UID.'
            : 'Guest counts use an anonymous browser identifier; signed-in users use verified accounts.')}
      </p>
    </div>
  );
});
