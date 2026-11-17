import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Globe,
  MapPin,
  Tag,
  Compass,
  Award,
  Star,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Users,
  Eye,
  Activity,
} from 'lucide-react';
import {
  AchievementBadgeId,
  EarnedAchievementEntry,
  Listing,
  RankingEntry,
  RankingPeriod,
  RankingScope,
} from '../../types';
import { cn } from '../../lib/utils';
import {
  ALL_ACTIVE_CATEGORY_IDS,
  MarketTheme,
  WORLD_COUNTRIES,
  getCategoryLabel,
} from './MarketConstants';
import { fetchPublicRankings } from '../../utils/marketAnalyticsClient';
import { ACHIEVEMENT_META, AchievementBadge } from './AchievementBadge';

export interface MarketRankingsViewProps {
  language: string;
  t: any;
  currentTheme: MarketTheme;
  listings: Listing[];
  earnedAchievements?: EarnedAchievementEntry[];
  onSelectListingId: (listingId: string) => void;
}

const ALL_BADGE_IDS: AchievementBadgeId[] = [
  'rising_listing',
  'popular_listing',
  'top_in_category',
  'global_recognition',
];

export const MarketRankingsView = React.memo(function MarketRankingsView({
  language,
  t,
  currentTheme,
  listings,
  earnedAchievements = [],
  onSelectListingId,
}: MarketRankingsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'rankings' | 'achievements'>('rankings');
  const [scope, setScope] = useState<RankingScope>('global');
  const [period, setPeriod] = useState<RankingPeriod>('7d');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');

  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [unavailableReason, setUnavailableReason] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setUnavailableReason(undefined);

    fetchPublicRankings({
      scope,
      period,
      category: scope === 'category' ? categoryFilter : undefined,
      country: scope === 'country' ? countryFilter : undefined,
      region: scope === 'regional' ? regionFilter : undefined,
    })
      .then((res) => {
        if (!active) return;
        setRankings(res.rankings);
        setAvailableCountries(res.availableCountries);
        setAvailableRegions(res.availableRegions);
        setUnavailableReason(res.unavailableReason);
      })
      .catch(() => {
        if (!active) return;
        setRankings([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [scope, period, categoryFilter, countryFilter, regionFilter]);

  const scopeButtons: Array<{
    id: RankingScope;
    en: string;
    ka: string;
    Icon: React.ComponentType<{ size?: number }>;
  }> = [
    { id: 'global', en: 'Global', ka: 'გლობალური', Icon: Globe },
    { id: 'country', en: 'Country', ka: 'ქვეყნის', Icon: MapPin },
    { id: 'category', en: 'Category', ka: 'კატეგორიის', Icon: Tag },
    { id: 'regional', en: 'Regional', ka: 'რეგიონული', Icon: Compass },
  ];

  const countryOptions = WORLD_COUNTRIES.filter(
    (c) => c.code !== 'GLOBAL' && (availableCountries.length === 0 || availableCountries.includes(c.code))
  );

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* Header & Sub-tab Switcher (Rankings vs Achievements) */}
      <div
        className={cn(
          'p-4 sm:p-6 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4',
          currentTheme.card
        )}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-proton-accent shrink-0" />
            <h2 className={cn('text-base sm:text-lg font-black uppercase tracking-tight', currentTheme.text)}>
              {language === 'ka' ? 'PROTON ჯანსაღი კონკურენცია' : 'PROTON Healthy Competition'}
            </h2>
          </div>
          <p className={cn('text-xs max-w-2xl leading-relaxed', currentTheme.muted)}>
            {t?.market?.rankings?.fairness_note ||
              (language === 'ka'
                ? 'ქულა აბალანსებს უნიკალურ მნახველებს, ჩართულობას, კატეგორიის ნორმალიზაციას, შეფასებებსა და ახალი განცხადებების შანსს.'
                : 'Scores balance unique viewers, engagement rate, category normalization, verified reviews, and fresh-listing discovery.')}
          </p>
        </div>

        <div className="flex items-center bg-proton-bg border border-proton-border p-1 rounded-xl gap-1 self-start lg:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('rankings')}
            className={cn(
              'px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer',
              activeSubTab === 'rankings'
                ? 'bg-proton-accent text-proton-on-accent shadow-sm'
                : 'text-proton-muted hover:text-proton-text hover:bg-proton-card'
            )}
          >
            <Trophy size={13} />
            <span>{language === 'ka' ? 'რეიტინგები' : 'Rankings'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('achievements')}
            className={cn(
              'px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer',
              activeSubTab === 'achievements'
                ? 'bg-proton-accent text-proton-on-accent shadow-sm'
                : 'text-proton-muted hover:text-proton-text hover:bg-proton-card'
            )}
          >
            <Award size={13} />
            <span>{language === 'ka' ? 'მიღწევები' : 'Achievements'}</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'rankings' ? (
        <>
          {/* Scope & Rolling Window Filters */}
          <div className={cn('p-3.5 sm:p-4 rounded-2xl border space-y-3', currentTheme.card)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Scope Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {scopeButtons.map(({ id, en, ka, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setScope(id)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer',
                      scope === id
                        ? 'bg-proton-accent text-proton-on-accent border-proton-accent shadow-sm'
                        : 'bg-proton-bg text-proton-muted border-proton-border hover:text-proton-text'
                    )}
                  >
                    <Icon size={13} />
                    <span>{language === 'ka' ? ka : en}</span>
                  </button>
                ))}
              </div>

              {/* Rolling 7d / 30d Period */}
              <div className="flex items-center bg-proton-bg border border-proton-border p-1 rounded-xl gap-1 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPeriod('7d')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                    period === '7d'
                      ? 'bg-proton-card text-proton-text shadow-sm border border-proton-border'
                      : 'text-proton-muted hover:text-proton-text border border-transparent'
                  )}
                >
                  {language === 'ka' ? 'ბოლო 7 დღე' : '7 Days'}
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('30d')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                    period === '30d'
                      ? 'bg-proton-card text-proton-text shadow-sm border border-proton-border'
                      : 'text-proton-muted hover:text-proton-text border border-transparent'
                  )}
                >
                  {language === 'ka' ? 'ბოლო 30 დღე' : '30 Days'}
                </button>
              </div>
            </div>

            {/* Dynamic Secondary Filters (Category, Country, Regional) */}
            {(scope === 'category' || scope === 'country' || scope === 'regional') && (
              <div className="pt-2.5 border-t border-proton-border flex flex-wrap items-center justify-between gap-3">
                {scope === 'category' && (
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className={cn(
                      'px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer',
                      currentTheme.input
                    )}
                  >
                    <option value="all" className="bg-proton-card text-proton-text">
                      {language === 'ka' ? 'ყველა კატეგორია' : 'All Categories'}
                    </option>
                    {ALL_ACTIVE_CATEGORY_IDS.map((catId) => (
                      <option key={catId} value={catId} className="bg-proton-card text-proton-text">
                        {getCategoryLabel(catId, t, language)}
                      </option>
                    ))}
                  </select>
                )}

                {scope === 'country' && (
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className={cn(
                      'px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer',
                      currentTheme.input
                    )}
                  >
                    <option value="" className="bg-proton-card text-proton-text">
                      {language === 'ka' ? 'ყველა დადასტურებული ქვეყანა' : 'All Verified Countries'}
                    </option>
                    {countryOptions.map((c) => (
                      <option key={c.code} value={c.code} className="bg-proton-card text-proton-text">
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                )}

                {scope === 'regional' && (
                  <select
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    className={cn(
                      'px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer',
                      currentTheme.input
                    )}
                  >
                    <option value="" className="bg-proton-card text-proton-text">
                      {language === 'ka' ? 'ყველა პროფილის რეგიონი' : 'All Profile Regions'}
                    </option>
                    {availableRegions.map((reg) => (
                      <option key={reg} value={reg} className="bg-proton-card text-proton-text">
                        {reg}
                      </option>
                    ))}
                  </select>
                )}

                {(scope === 'country' || scope === 'regional') && (
                  <span className={cn('text-[11px] flex items-center gap-1.5', currentTheme.muted)}>
                    <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
                    <span>
                      {t?.market?.rankings?.profile_location_note ||
                        (language === 'ka'
                          ? 'ქვეყნისა და რეგიონის რეიტინგები ეყრდნობა მხოლოდ პროფილში მითითებულ სანდო მონაცემს და არა IP-ს.'
                          : 'Country & regional rankings use only verified profile location data, never IP guessing.')}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          {unavailableReason === 'analytics/admin-credentials-missing' && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p>
                {language === 'ka'
                  ? 'საჯარო რეიტინგების წაკითხვა სერვერიდან მოითხოვს Firestore Admin უფლებებს. გამოგონილი რეიტინგები არ გამოიყენება.'
                  : 'Public rankings require server Firestore Admin permissions. No fabricated rankings are displayed.'}
              </p>
            </div>
          )}

          {/* Rankings List */}
          {loading ? (
            <div className={cn('p-10 rounded-2xl border flex items-center justify-center gap-2 text-xs', currentTheme.card, currentTheme.muted)}>
              <Loader2 size={16} className="animate-spin text-proton-accent" />
              <span>{language === 'ka' ? 'რეიტინგები იტვირთება...' : 'Loading rankings...'}</span>
            </div>
          ) : rankings.length === 0 ? (
            <div className={cn('p-10 rounded-2xl border text-center space-y-2', currentTheme.card)}>
              <Trophy size={26} className="mx-auto text-proton-muted opacity-60" />
              <p className={cn('text-sm font-bold', currentTheme.text)}>
                {t?.market?.rankings?.empty ||
                  (language === 'ka'
                    ? 'ამ ფილტრში კვალიფიციური განცხადებები ჯერ არ არის.'
                    : 'No qualifying listings in this ranking scope yet.')}
              </p>
              <p className={cn('text-xs max-w-md mx-auto', currentTheme.muted)}>
                {language === 'ka'
                  ? 'რეიტინგი ივსება ავტომატურად მხოლოდ რეალური ნახვებისა და ჩართულობის დაგროვების შემდეგ.'
                  : 'Rankings populate automatically as active listings earn verified views and engagement.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {rankings.map((entry) => {
                const displayTitle =
                  language === 'ka' ? entry.titleGe || entry.title : entry.title;

                return (
                  <div
                    key={entry.listingId}
                    onClick={() => onSelectListingId(entry.listingId)}
                    className={cn(
                      'p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all cursor-pointer hover:border-proton-accent/45',
                      currentTheme.card
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={cn(
                          'w-9 h-9 rounded-xl border flex items-center justify-center font-black font-mono text-xs shrink-0',
                          entry.rank === 1
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                            : entry.rank === 2
                            ? 'bg-slate-400/15 border-slate-400/35 text-slate-300'
                            : entry.rank === 3
                            ? 'bg-orange-500/15 border-orange-500/35 text-orange-400'
                            : 'bg-proton-bg border-proton-border text-proton-muted'
                        )}
                      >
                        #{entry.rank}
                      </div>

                      {entry.image ? (
                        <img
                          src={entry.image}
                          alt={displayTitle}
                          className="w-12 h-12 rounded-xl object-cover border border-proton-border shrink-0 bg-proton-bg"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl border border-proton-border bg-proton-bg flex items-center justify-center text-sm shrink-0">
                          🏷️
                        </div>
                      )}

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-sm font-bold truncate', currentTheme.text)}>
                            {displayTitle}
                          </span>
                          {entry.freshnessBoost > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-[9px] font-bold uppercase">
                              {language === 'ka' ? 'ახალი' : 'Fresh'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-proton-muted">
                          <span className="font-semibold text-proton-text/90">{entry.sellerName}</span>
                          <span>•</span>
                          <span>{getCategoryLabel(entry.category, t, language)}</span>
                          {(entry.region || entry.country) && (
                            <>
                              <span>•</span>
                              <span>{[entry.region, entry.country].filter(Boolean).join(', ')}</span>
                            </>
                          )}
                          {entry.sellerRatingCount && entry.sellerRatingCount > 0 && entry.sellerRatingAvg ? (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-0.5 text-amber-400 font-bold">
                                <Star size={11} className="fill-amber-400" />
                                {entry.sellerRatingAvg.toFixed(1)}
                              </span>
                            </>
                          ) : null}
                        </div>
                        {entry.achievements.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {entry.achievements.map((b) => (
                              <AchievementBadge key={b} badgeId={b} language={language} compact />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Balanced Metrics Strip */}
                    <div className="grid grid-cols-4 gap-3 sm:gap-4 shrink-0 text-right border-t sm:border-t-0 pt-2.5 sm:pt-0 border-proton-border">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-proton-muted flex items-center justify-end gap-1">
                          <Users size={10} />
                          <span>{language === 'ka' ? 'უნიკ.' : 'Uniq.'}</span>
                        </div>
                        <div className="text-xs sm:text-sm font-black font-mono text-emerald-500 tabular-nums">
                          {entry.uniqueViewers}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-proton-muted flex items-center justify-end gap-1">
                          <Eye size={10} />
                          <span>{language === 'ka' ? 'ნახვა' : 'Views'}</span>
                        </div>
                        <div className={cn('text-xs sm:text-sm font-black font-mono tabular-nums', currentTheme.text)}>
                          {entry.views}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-proton-muted flex items-center justify-end gap-1">
                          <Activity size={10} />
                          <span>{language === 'ka' ? 'ჩართ.' : 'Eng.'}</span>
                        </div>
                        <div className={cn('text-xs sm:text-sm font-black font-mono tabular-nums', currentTheme.text)}>
                          {entry.engagementRate}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-proton-muted">
                          {language === 'ka' ? 'ქულა' : 'Score'}
                        </div>
                        <div className="text-xs sm:text-sm font-black font-mono text-proton-accent tabular-nums">
                          {entry.balancedScore.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Achievements Tab */
        <div className="space-y-4">
          {earnedAchievements.length > 0 && (
            <div className={cn('p-4 sm:p-5 rounded-2xl border space-y-3', currentTheme.card)}>
              <h3 className={cn('text-xs font-black uppercase tracking-wider', currentTheme.text)}>
                {language === 'ka' ? 'თქვენი მოპოვებული აღიარება' : 'Your Earned Recognition'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {earnedAchievements.map((item) => (
                  <div
                    key={`${item.listingId}-${item.id}`}
                    className="p-3 rounded-xl bg-proton-bg border border-proton-border flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className={cn('text-xs font-bold truncate', currentTheme.text)}>
                        {language === 'ka' ? item.listingTitleGe || item.listingTitle : item.listingTitle}
                      </div>
                      <div className="text-[10px] text-proton-muted">
                        {getCategoryLabel(item.category, t, language)}
                      </div>
                    </div>
                    <AchievementBadge badgeId={item.id} language={language} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_BADGE_IDS.map((badgeId) => {
              const meta = ACHIEVEMENT_META[badgeId];
              const Icon = meta.Icon;
              const earnedCount = earnedAchievements.filter((e) => e.id === badgeId).length;
              return (
                <div
                  key={badgeId}
                  className={cn('p-4 sm:p-5 rounded-2xl border space-y-2.5', currentTheme.card)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-black',
                        meta.toneClass
                      )}
                    >
                      <Icon size={14} />
                      <span>{language === 'ka' ? meta.kaTitle : meta.enTitle}</span>
                    </span>
                    {earnedCount > 0 && (
                      <span className="text-[10px] font-black font-mono text-emerald-500">
                        {language === 'ka' ? `მოპოვებული: ${earnedCount}` : `Earned: ${earnedCount}`}
                      </span>
                    )}
                  </div>
                  <p className={cn('text-xs leading-relaxed', currentTheme.muted)}>
                    {language === 'ka' ? meta.kaDesc : meta.enDesc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
