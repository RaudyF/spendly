'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { FinancialStatus, FINANCIAL_STATUS_CONFIG, getStatusLabel } from '@/lib/status-tokens';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: FinancialStatus;
  label?: string;
  context?: 'income' | 'obligation' | 'expense' | 'general';
  size?: 'xs' | 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  context = 'general',
  size = 'sm',
  showDot = true,
  className,
  ...props
}) => {
  const config = FINANCIAL_STATUS_CONFIG[status] || FINANCIAL_STATUS_CONFIG.neutral;
  const displayLabel = label || getStatusLabel(status, context);

  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[11px] gap-1.5',
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-sm gap-2',
  };

  const dotSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full shrink-0 tracking-wide transition-colors',
        config.badgeClass,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn('rounded-full shrink-0', config.dotClass, dotSizes[size])}
          aria-hidden="true"
        />
      )}
      <span className="whitespace-nowrap">{displayLabel}</span>
    </span>
  );
};
