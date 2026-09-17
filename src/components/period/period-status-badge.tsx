'use client';

import React from 'react';
import { Lock, Clock, CheckCircle2 } from 'lucide-react';
import { PeriodStatus, PeriodCycle } from '@/types';
import { cn } from '@/lib/utils';

interface PeriodStatusBadgeProps {
  status: PeriodStatus;
  cycle?: PeriodCycle;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PeriodStatusBadge: React.FC<PeriodStatusBadgeProps> = ({
  status,
  cycle,
  className,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs sm:text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  if (status === 'closed') {
    return (
      <span
        className={cn(
          'inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          sizeClasses[size],
          className
        )}
      >
        <Lock className={iconSizes[size]} />
        <span>Cerrado</span>
        {cycle && <span className="opacity-70">({cycle})</span>}
      </span>
    );
  }

  if (status === 'pending_review') {
    return (
      <span
        className={cn(
          'inline-flex items-center font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
          sizeClasses[size],
          className
        )}
      >
        <Clock className={iconSizes[size]} />
        <span>Listo para cierre</span>
        {cycle && <span className="opacity-70">({cycle})</span>}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
        sizeClasses[size],
        className
      )}
    >
      <CheckCircle2 className={iconSizes[size]} />
      <span>Abierto</span>
      {cycle && <span className="opacity-70">({cycle})</span>}
    </span>
  );
};
