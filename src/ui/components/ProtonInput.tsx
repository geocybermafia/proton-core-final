import React from 'react';
import { cn } from '../../lib/utils';
import { protonRadius } from '../tokens/radius';

export interface ProtonInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerClassName?: string;
}

export const ProtonInput = React.forwardRef<HTMLInputElement, ProtonInputProps>(({
  label,
  helperText,
  error,
  leftIcon,
  rightElement,
  className,
  containerClassName,
  id,
  ...props
}, ref) => {
  // Border radius constraint: Inputs MUST use rounded-xl
  const baseRadius = protonRadius.classes.input; // 'rounded-xl'
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', containerClassName)}>
      {label && (
        <label 
          htmlFor={inputId}
          className="text-xs font-semibold text-proton-text uppercase tracking-wider font-mono flex items-center justify-between"
        >
          <span>{label}</span>
        </label>
      )}

      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3.5 text-proton-muted pointer-events-none flex items-center justify-center shrink-0">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          className={cn(
            baseRadius,
            'w-full bg-proton-bg/80 border border-proton-border text-proton-text placeholder-proton-muted text-sm font-medium transition-all duration-200',
            'focus:outline-none focus:border-proton-accent focus:ring-1 focus:ring-proton-accent/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/50',
            leftIcon ? 'pl-11' : 'pl-4',
            rightElement ? 'pr-12' : 'pr-4',
            'py-3',
            className
          )}
          {...props}
        />

        {rightElement && (
          <div className="absolute right-3 flex items-center shrink-0">
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-rose-400 font-medium mt-0.5">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-proton-muted font-normal mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
});

ProtonInput.displayName = 'ProtonInput';
