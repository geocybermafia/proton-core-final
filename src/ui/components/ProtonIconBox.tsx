import React from 'react';
import { cn } from '../../lib/utils';
import { protonRadius } from '../tokens/radius';

export interface ProtonIconBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'accent' | 'emerald' | 'amber' | 'rose' | 'purple' | 'neutral' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const ProtonIconBox: React.FC<ProtonIconBoxProps> = ({
  variant = 'accent',
  size = 'md',
  className,
  children,
  ...props
}) => {
  // Border radius constraint: Icon containers inside cards MUST use rounded-xl
  const baseRadius = protonRadius.classes.iconBox; // 'rounded-xl'

  const variantClasses = {
    accent: 'bg-proton-accent/10 border-proton-accent/25 text-proton-accent',
    emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
    rose: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
    purple: 'bg-purple-500/10 border-purple-500/25 text-purple-400',
    neutral: 'bg-zinc-900 border-zinc-800 text-zinc-300',
    subtle: 'bg-proton-card border-proton-border text-proton-muted hover:text-proton-text',
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  return (
    <div
      className={cn(
        baseRadius,
        'flex items-center justify-center border shrink-0 transition-transform duration-200 select-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
