import React from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  threshold?: number;
  isRefreshing: boolean;
  language?: string;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  threshold = 70,
  isRefreshing,
  language = 'en',
}) => {
  if (pullDistance <= 5 && !isRefreshing) return null;

  const isReady = pullDistance >= threshold;
  const progress = Math.min(1, pullDistance / threshold);
  const translateY = isRefreshing ? 14 : Math.min(pullDistance * 0.65, 55);
  const rotation = Math.min(180, progress * 180);

  return (
    <div className="sticky top-2 z-40 w-full flex justify-center h-0 overflow-visible pointer-events-none">
      <div 
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-2xl border backdrop-blur-xl select-none transition-all duration-150 transform",
          isReady || isRefreshing
            ? "bg-[#0c0d12]/95 border-proton-accent/60 text-proton-accent shadow-[0_0_30px_rgba(59,130,246,0.3)]"
            : "bg-[#0c0d12]/90 border-proton-border text-proton-muted"
        )}
        style={{
          transform: `translateY(${translateY}px)`,
          opacity: isRefreshing ? 1 : Math.min(1, (pullDistance - 8) / 25),
        }}
      >
        {isRefreshing ? (
          <>
            <Loader2 size={15} className="animate-spin text-proton-accent shrink-0" />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-proton-accent">
              {language === 'ka' ? 'განახლება...' : 'Refreshing...'}
            </span>
          </>
        ) : isReady ? (
          <>
            <ArrowDown 
              size={15} 
              className="text-proton-accent rotate-180 transition-transform duration-200 shrink-0" 
            />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-proton-accent">
              {language === 'ka' ? 'გაუშვით განსაახლებლად' : 'Release to reload'}
            </span>
          </>
        ) : (
          <>
            <ArrowDown 
              size={15} 
              style={{ transform: `rotate(${rotation}deg)` }}
              className="transition-transform duration-75 shrink-0 text-proton-muted" 
            />
            <span className="text-[10px] font-mono font-medium tracking-wider uppercase text-proton-muted">
              {language === 'ka' ? 'ჩამოწიეთ განსაახლებლად' : 'Pull to refresh'}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
