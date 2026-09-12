import React from 'react';
import { cn } from '../../lib/utils';
import { MarketTheme } from './MarketConstants';

export interface ListingTypeTabsProps {
  activeType: 'all' | 'product' | 'service' | 'project';
  onSelectType: (type: 'all' | 'product' | 'service' | 'project') => void;
  language: string;
  theme: MarketTheme | any;
}

export const ListingTypeTabs = React.memo(function ListingTypeTabs({
  activeType,
  onSelectType,
  language,
  theme
}: ListingTypeTabsProps) {
  const types = [
    { id: 'all' as const, emoji: '🌍', ka: 'ყველა', en: 'All' },
    { id: 'service' as const, emoji: '⚡', ka: 'სერვისები', en: 'Services' },
    { id: 'product' as const, emoji: '📦', ka: 'პროდუქტები', en: 'Products' },
    { id: 'project' as const, emoji: '🚀', ka: 'პროექტები', en: 'Projects' }
  ];

  return (
    <div className={cn("flex p-0.5 rounded-xl border shadow-inner w-fit select-none shrink-0", theme.cardAlt)}>
      {types.map(({ id, emoji, ka, en }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelectType(id)}
          className={cn(
            "px-3.5 sm:px-4 py-2 rounded-lg transition-all text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 active:scale-95 cursor-pointer whitespace-nowrap",
            activeType === id
              ? cn(theme.badgeBg, "shadow-sm border border-white/5 text-[#dfb257]")
              : cn(theme.muted, "hover:opacity-90 hover:bg-white/5 text-zinc-400 hover:text-white")
          )}
        >
          <span>{emoji}</span>
          <span>{language === 'ka' ? ka : en}</span>
        </button>
      ))}
    </div>
  );
});

export interface MarketPulseMetricsProps {
  metrics: {
    active: number;
    avgPrice: string;
    sold: number;
    topCat: string;
  };
  language: string;
}

export const MarketPulseMetrics = React.memo(function MarketPulseMetrics({
  metrics,
  language
}: MarketPulseMetricsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-zinc-950/60 border border-zinc-900/80 backdrop-blur-md">
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
          {language === 'ka' ? 'აქტიური ლოტები' : 'Active Listings'}
        </span>
        <span className="text-base sm:text-lg font-black text-white font-mono">
          {metrics.active.toLocaleString()}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
          {language === 'ka' ? 'საშუალო ფასი' : 'Average Price'}
        </span>
        <span className="text-base sm:text-lg font-black text-[#dfb257] font-mono">
          {metrics.avgPrice}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
          {language === 'ka' ? 'ვაჭრობის მოცულობა' : 'Total Traded'}
        </span>
        <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
          {metrics.sold.toLocaleString()}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
          {language === 'ka' ? 'ტოპ კატეგორია' : 'Top Category'}
        </span>
        <span className="text-base sm:text-lg font-black text-blue-400 truncate">
          {metrics.topCat}
        </span>
      </div>
    </div>
  );
});
