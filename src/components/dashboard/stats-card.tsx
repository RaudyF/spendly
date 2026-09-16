'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { itemVariants } from './animations';

// Color configuration matching landing preview
const colorClasses = {
  primary: 'bg-primary-500 shadow-primary-500/25',
  success: 'bg-green-500 shadow-green-500/25',
  danger: 'bg-red-500 shadow-red-500/25',
  secondary: 'bg-indigo-500 shadow-indigo-500/25',
  accent: 'bg-amber-500 shadow-amber-500/25',
};

const glowClasses = {
  primary: 'bg-primary-500/10',
  success: 'bg-green-500/10',
  danger: 'bg-red-500/10',
  secondary: 'bg-indigo-500/10',
  accent: 'bg-amber-500/10',
};

export interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  badge?: string;
  trend?: 'up' | 'down';
  change?: number;
  action?: React.ReactNode;
  icon: React.ElementType;
  color: 'primary' | 'success' | 'danger' | 'secondary' | 'accent';
  delay?: number;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  badge,
  trend,
  change,
  action,
  icon: Icon,
  color,
  delay = 0.1,
}) => {
  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      className="group p-4 lg:p-5 rounded-2xl bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs lg:text-sm font-medium text-surface-500 dark:text-surface-400">
            {title}
          </p>
          <p className="text-xl lg:text-2xl font-bold text-surface-900 dark:text-white mt-1 lg:mt-2 tracking-tight truncate">
            {value}
          </p>

          {badge && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5',
                  trend === 'down'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                )}
              >
                {trend === 'down' ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <TrendingUp className="w-3 h-3" />
                )}
                {badge}
              </span>
            </div>
          )}

          {subtitle && !badge && (
            <p className="mt-1.5 text-[11px] lg:text-xs text-surface-500 dark:text-surface-400 font-medium truncate">
              {subtitle}
            </p>
          )}

          {change !== undefined && !badge && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5',
                  trend === 'down'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                )}
              >
                {trend === 'down' ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <TrendingUp className="w-3 h-3" />
                )}
                {change > 0 ? `+${change}%` : `${change}%`}
              </span>
            </div>
          )}

          {action && <div className="mt-2">{action}</div>}
        </div>

        <div
          className={cn(
            'w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0',
            colorClasses[color]
          )}
        >
          <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
        </div>
      </div>

      <div
        className={cn(
          'absolute -right-6 -bottom-6 w-20 h-20 rounded-full blur-xl pointer-events-none',
          glowClasses[color]
        )}
      />
    </motion.div>
  );
};
