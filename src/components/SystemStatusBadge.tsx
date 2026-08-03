import React from 'react';
import { SystemHealthStatus } from '../hooks/useSystemHealth';
import { ProtonBadge } from '../ui';
import { Activity, WifiOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SystemStatusBadgeProps {
  status: SystemHealthStatus;
  latency?: number | null;
  language?: 'en' | 'ka';
  showLatency?: boolean;
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export const SystemStatusBadge: React.FC<SystemStatusBadgeProps> = ({
  status,
  latency,
  language = 'en',
  showLatency = true,
  size = 'md',
  onClick,
  className
}) => {
  const badgeConfig = {
    optimal: {
      variant: 'emerald' as const,
      label: language === 'ka' ? 'ოპტიმალური' : 'Optimal',
      icon: CheckCircle2,
      dotColor: 'bg-emerald-400'
    },
    degraded: {
      variant: 'amber' as const,
      label: language === 'ka' ? 'შეფერხებული' : 'Degraded',
      icon: AlertTriangle,
      dotColor: 'bg-amber-400'
    },
    offline: {
      variant: 'rose' as const,
      label: language === 'ka' ? 'ოფლაინ' : 'Offline',
      icon: WifiOff,
      dotColor: 'bg-rose-500'
    }
  }[status];

  const Icon = badgeConfig.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 group transition-all duration-200",
        onClick && "cursor-pointer hover:opacity-90 active:scale-95",
        className
      )}
      title={
        status === 'optimal'
          ? (language === 'ka' ? 'სისტემა მუშაობს გამართულად' : `System Optimal ${latency ? `(${latency}ms)` : ''}`)
          : status === 'degraded'
            ? (language === 'ka' ? 'ინტერნეტთან კავშირი შენელებულია' : 'Network connection is slow')
            : (language === 'ka' ? 'ინტერნეტთან კავშირი გაწყვეტილია. გამოიყენება შენახული მონაცემები.' : 'Network offline. Using cached data.')
      }
    >
      <ProtonBadge
        variant={badgeConfig.variant}
        size={size}
        pulse={status !== 'offline'}
      >
        <span className="flex items-center gap-1.5">
          <Icon size={size === 'sm' ? 10 : 12} className="shrink-0" />
          <span>{badgeConfig.label}</span>
          {showLatency && latency !== null && latency !== undefined && status !== 'offline' && (
            <span className="font-mono text-[8px] opacity-75 border-l border-current/20 pl-1 ml-0.5">
              {latency}ms
            </span>
          )}
        </span>
      </ProtonBadge>
    </div>
  );
};
