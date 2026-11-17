import React from 'react';
import { TrendingUp, Flame, Award, Globe } from 'lucide-react';
import { AchievementBadgeId } from '../../types';
import { cn } from '../../lib/utils';

export interface AchievementMeta {
  id: AchievementBadgeId;
  enTitle: string;
  kaTitle: string;
  enDesc: string;
  kaDesc: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  toneClass: string;
}

export const ACHIEVEMENT_META: Record<AchievementBadgeId, AchievementMeta> = {
  rising_listing: {
    id: 'rising_listing',
    enTitle: 'Rising Listing',
    kaTitle: 'სწრაფად მზარდი',
    enDesc: '50%+ 7-day unique viewer growth or strong launch engagement.',
    kaDesc: '7-დღიანი უნიკალური მნახველების 50%+ ზრდა ან მაღალი საწყისი ჩართულობა.',
    Icon: TrendingUp,
    toneClass: 'bg-emerald-500/12 border-emerald-500/30 text-emerald-500',
  },
  popular_listing: {
    id: 'popular_listing',
    enTitle: 'Popular Listing',
    kaTitle: 'პოპულარული',
    enDesc: 'Sustained 30-day demand: 25+ unique viewers and 35+ opens.',
    kaDesc: 'მდგრადი 30-დღიანი ინტერესი: 25+ უნიკალური მნახველი და 35+ გახსნა.',
    Icon: Flame,
    toneClass: 'bg-amber-500/12 border-amber-500/30 text-amber-500',
  },
  top_in_category: {
    id: 'top_in_category',
    enTitle: 'Top in Category',
    kaTitle: 'კატეგორიის ლიდერი',
    enDesc: 'Leading balanced performance within its category.',
    kaDesc: 'ლიდერი დაბალანსებული შედეგი საკუთარ კატეგორიაში.',
    Icon: Award,
    toneClass: 'bg-proton-accent/15 border-proton-accent/35 text-proton-accent',
  },
  global_recognition: {
    id: 'global_recognition',
    enTitle: 'Global Recognition',
    kaTitle: 'საერთაშორისო აღიარება',
    enDesc: 'Top 10 global standing with 20+ unique viewers and verified engagement.',
    kaDesc: 'საერთაშორისო ტოპ 10-ეული 20+ უნიკალური მნახველითა და ჩართულობით.',
    Icon: Globe,
    toneClass: 'bg-indigo-500/12 border-indigo-500/30 text-indigo-400',
  },
};

export interface AchievementBadgeProps {
  badgeId: AchievementBadgeId;
  language: string;
  compact?: boolean;
}

export const AchievementBadge = React.memo(function AchievementBadge({
  badgeId,
  language,
  compact = false,
}: AchievementBadgeProps) {
  const meta = ACHIEVEMENT_META[badgeId];
  if (!meta) return null;
  const Icon = meta.Icon;
  const label = language === 'ka' ? meta.kaTitle : meta.enTitle;
  const desc = language === 'ka' ? meta.kaDesc : meta.enDesc;

  return (
    <span
      title={desc}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border font-bold tracking-wide select-none',
        compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
        meta.toneClass
      )}
    >
      <Icon size={compact ? 11 : 12} className="shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
});
