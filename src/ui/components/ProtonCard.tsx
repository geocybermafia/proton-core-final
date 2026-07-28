import React from 'react';
import { cn } from '../../lib/utils';
import { protonRadius } from '../tokens/radius';
import { protonSpacing } from '../tokens/spacing';

export interface ProtonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'elevated' | 'glass' | 'subtle' | 'glowing';
  padding?: 'none' | 'compact' | 'default' | 'spacious';
  mode?: 'default' | 'creative' | 'clips' | 'market' | 'organizer' | 'business';
  children: React.ReactNode;
}

export const ProtonCard = React.forwardRef<HTMLDivElement, ProtonCardProps>(({
  variant = 'default',
  padding = 'default',
  mode = 'default',
  className,
  children,
  ...props
}, ref) => {
  // Border radius constraint: Cards MUST use rounded-2xl
  const baseRadius = protonRadius.classes.card; // 'rounded-2xl'

  const variantClasses = {
    default: 'bg-proton-card/90 border border-proton-border shadow-md',
    interactive: 'bg-proton-card/80 hover:bg-proton-card border border-proton-border hover:border-proton-accent/40 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group',
    elevated: 'bg-proton-card border border-proton-border shadow-xl',
    glass: 'bg-proton-card/40 backdrop-blur-md border border-proton-border/60 shadow-lg',
    subtle: 'bg-proton-bg/60 border border-proton-border/40 shadow-sm',
    glowing: 'bg-proton-card border border-proton-accent/30 shadow-[0_0_25px_rgba(6,182,212,0.15)]',
  };

  const modeBorderClasses = {
    default: 'hover:border-proton-accent/40',
    creative: 'hover:border-amber-500/40',
    clips: 'hover:border-rose-500/40',
    market: 'hover:border-blue-500/40',
    organizer: 'hover:border-purple-500/40',
    business: 'hover:border-emerald-500/40',
  };

  const paddingClasses = {
    none: 'p-0',
    compact: protonSpacing.card.compact,
    default: protonSpacing.card.default,
    spacious: protonSpacing.card.spacious,
  };

  return (
    <div
      ref={ref}
      className={cn(
        baseRadius,
        variantClasses[variant],
        variant === 'interactive' && modeBorderClasses[mode],
        paddingClasses[padding],
        'relative overflow-hidden transition-all duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

ProtonCard.displayName = 'ProtonCard';
