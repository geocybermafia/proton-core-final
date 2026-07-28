import React from 'react';
import { cn } from '../../lib/utils';
import { protonRadius } from '../tokens/radius';

export interface ProtonBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'accent' | 'emerald' | 'amber' | 'rose' | 'purple' | 'neutral' | 'outline';
  size?: 'sm' | 'md';
  pulse?: boolean;
  children: React.ReactNode;
}

export const ProtonBadge: React.FC<ProtonBadgeProps> = ({
  variant = 'accent',
  size = 'md',
  pulse = false,
  className,
  children,
  ...props
}) => {
  // Border radius constraint: Badges MUST use rounded-full
  const baseRadius = protonRadius.classes.badge; // 'rounded-full'

  const variantClasses = {
    accent: 'bg-proton-accent/10 border-proton-accent/25 text-proton-accent',
    emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
    rose: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
    purple: 'bg-purple-500/10 border-purple-500/25 text-purple-400',
    neutral: 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300',
    outline: 'bg-transparent border-proton-border text-proton-muted',
  };

  const dotClasses = {
    accent: 'bg-proton-accent',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
    purple: 'bg-purple-400',
    neutral: 'bg-zinc-400',
    outline: 'bg-proton-muted',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-0.5 text-[9px]',
    md: 'px-3 py-1 text-[10px]',
  };

  return (
    <span
      className={cn(
        baseRadius,
        'inline-flex items-center gap-1.5 border font-mono font-bold uppercase tracking-wider select-none shrink-0',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {pulse && (
        <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse shrink-0', dotClasses[variant])} />
      )}
      <span>{children}</span>
    </span>
  );
};
