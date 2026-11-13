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
              ? "bg-proton-accent text-proton-on-accent shadow-sm"
              : cn(theme.muted, "hover:text-proton-text hover:bg-proton-card")
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
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-proton-card border border-proton-border text-[9px] font-bold text-proton-muted tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span>{language === 'ka' ? `აქტიური განცხადებები: ${count}` : `Active Listings: ${count}`}</span>
    </div>
  );
});

