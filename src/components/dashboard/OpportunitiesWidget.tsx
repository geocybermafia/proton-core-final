import React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Opportunity } from '../../hooks/useOpportunities';

interface OpportunitiesWidgetProps {
  opportunities: Opportunity[];
  onAction: (opportunity: Opportunity) => void;
  language: 'en' | 'ka';
}

export const OpportunitiesWidget: React.FC<OpportunitiesWidgetProps> = React.memo(({
  opportunities,
  onAction,
  language = 'en'
}) => {
  if (!opportunities || opportunities.length === 0) {
    return null;
  }

  const isKa = language === 'ka';

  return (
    <div className="pt-4 border-t border-white/5 space-y-3 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-zinc-400">
          <Sparkles size={13} className="text-amber-400/80" />
          <span>{isKa ? 'შესაძლებლობები' : 'Open Opportunities'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {opportunities.map((opp) => (
          <div
            key={opp.id}
            className="p-4 sm:p-5 rounded-lg bg-white/[0.02] border border-white/10 hover:border-amber-400/30 transition-all duration-200 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300/80 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                  {opp.listingTitle || (isKa ? 'მარკეტის ობიექტი' : 'Store Listing')}
                </span>
                {opp.stock !== undefined && (
                  <span className="text-[10px] font-mono text-zinc-400">
                    {isKa ? `დარჩენილია: ${opp.stock}` : `Stock: ${opp.stock}`}
                  </span>
                )}
              </div>

              <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
                {opp.headline}
              </h3>

              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                {opp.reasoning}
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-end">
              <button
                type="button"
                onClick={() => onAction(opp)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-amber-400/15 border border-white/10 hover:border-amber-400/40 text-xs font-mono text-zinc-200 hover:text-amber-200 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                <span>{opp.ctaLabel}</span>
                <ArrowUpRight size={13} className="text-zinc-400 group-hover:text-amber-300 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

OpportunitiesWidget.displayName = 'OpportunitiesWidget';
