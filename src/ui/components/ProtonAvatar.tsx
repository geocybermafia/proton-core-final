import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { protonRadius } from '../tokens/radius';

export interface ProtonAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  className?: string;
}

export const ProtonAvatar: React.FC<ProtonAvatarProps> = ({
  src,
  alt = 'Avatar',
  name,
  size = 'md',
  status,
  className,
  ...props
}) => {
  const [imageError, setImageError] = useState(false);
  // Border radius constraint: Avatars MUST use rounded-full
  const baseRadius = protonRadius.classes.avatar; // 'rounded-full'

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const statusSizeClasses = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
  };

  const statusColorClasses = {
    online: 'bg-emerald-500 ring-proton-bg',
    offline: 'bg-zinc-500 ring-proton-bg',
    busy: 'bg-rose-500 ring-proton-bg',
    away: 'bg-amber-500 ring-proton-bg',
  };

  const getInitials = (str?: string) => {
    if (!str) return '?';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  return (
    <div className="relative inline-block shrink-0" {...props}>
      <div
        className={cn(
          baseRadius,
          'relative flex items-center justify-center overflow-hidden bg-zinc-800 border border-proton-border font-bold text-proton-text select-none',
          sizeClasses[size],
          className
        )}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={alt}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-mono tracking-wider">{getInitials(name || alt)}</span>
        )}
      </div>

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2',
            statusSizeClasses[size],
            statusColorClasses[status]
          )}
        />
      )}
    </div>
  );
};
