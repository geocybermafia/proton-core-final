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

export interface ActiveListingsBadgeProps {
  count: number;
  language: string;
}

export const ActiveListingsBadge = React.memo(function ActiveListingsBadge({
  count,
  language
}: ActiveListingsBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[9px] font-bold text-zinc-400 tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
      <span>{language === 'ka' ? `აქტიური განცხადებები: ${count}` : `Active Listings: ${count}`}</span>
    </div>
  );
});

