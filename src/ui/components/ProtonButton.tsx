import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { protonRadius } from '../tokens/radius';
import { protonSpacing } from '../tokens/spacing';

export interface ProtonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const ProtonButton = React.forwardRef<HTMLButtonElement, ProtonButtonProps>(({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  children,
  ...props
}, ref) => {
  // Border radius constraint: Buttons MUST use rounded-xl
  const baseRadius = protonRadius.classes.button; // 'rounded-xl'

  const variantClasses = {
    primary: 'bg-proton-accent hover:bg-proton-accent/90 text-proton-bg font-bold shadow-md hover:shadow-proton-accent/20 active:scale-95',
    secondary: 'bg-proton-card hover:bg-proton-card/80 text-proton-text border border-proton-border hover:border-proton-accent/40 font-semibold active:scale-95',
    outline: 'bg-transparent border border-proton-border hover:border-proton-accent text-proton-text hover:bg-proton-accent/10 font-semibold active:scale-95',
    ghost: 'bg-transparent hover:bg-proton-card text-proton-muted hover:text-proton-text font-medium active:scale-95',
    danger: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold active:scale-95',
    subtle: 'bg-proton-accent/10 hover:bg-proton-accent/20 text-proton-accent border border-proton-accent/20 font-bold active:scale-95',
  };

  const sizeClasses = {
    sm: protonSpacing.control.sm,
    md: protonSpacing.control.md,
    lg: protonSpacing.control.lg,
  };

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        baseRadius,
        'inline-flex items-center justify-center gap-2 font-medium tracking-wide transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:transform-none select-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="animate-spin text-current shrink-0" size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : (
        leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
      )}
      {children && <span className="truncate min-w-0">{children}</span>}
      {!isLoading && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
    </button>
  );
});

ProtonButton.displayName = 'ProtonButton';
