'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/store';
import { CATEGORIES, CHART_COLORS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { itemVariants } from './animations';

export const CategoryDonut: React.FC = () => {
  const monthlyStats = useStore((state) => state.monthlyStats);
  const profile = useStore((state) => state.profile);

  const { items, totalSpending } = React.useMemo(() => {
    if (!monthlyStats?.byCategory) {
      return { items: [], totalSpending: 0 };
    }

    const validCategories = CATEGORIES.filter(
      (cat) => (monthlyStats.byCategory[cat.id] || 0) > 0
    )
      .map((cat, index) => ({
        id: cat.id,
        name: cat.name,
        amount: monthlyStats.byCategory[cat.id] || 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);

    const total = validCategories.reduce((sum, c) => sum + c.amount, 0);

    const withPercent = validCategories.map((c) => ({
      ...c,
      percent: total > 0 ? Math.round((c.amount / total) * 100) : 0,
    }));

    return { items: withPercent, totalSpending: total };
  }, [monthlyStats]);

  // Compute SVG stroke-dasharray segments for donut
  const circumference = 220; // 2 * Math.PI * 35

  let accumulatedPercent = 0;
  const segments = items.slice(0, 5).map((item) => {
    const strokeDasharray = `${(item.percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += item.percent;
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <motion.div
      variants={itemVariants}
      className="p-5 lg:p-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 shadow-sm h-full flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm lg:text-base font-semibold text-surface-900 dark:text-white">
            Gastos por Categoría
          </h3>
          <p className="text-xs text-surface-400 mt-0.5">
            Distribución por rubros en este ciclo
          </p>
        </div>
      </div>

      {totalSpending === 0 || items.length === 0 ? (
        <div className="h-44 flex flex-col items-center justify-center text-surface-400 text-xs">
          <p>Sin gastos clasificados en este período</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6 py-1">
          {/* Donut Chart (SVG) */}
          <div className="relative w-28 h-28 lg:w-32 lg:h-32 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {/* Background Track */}
              <circle
                cx="50"
                cy="50"
                r="35"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-surface-100 dark:text-surface-700/60"
              />

              {/* Segments */}
              {segments.map((seg, i) => (
                <motion.circle
                  key={seg.id}
                  cx="50"
                  cy="50"
                  r="35"
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="12"
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.05 }}
                  strokeLinecap="round"
                />
              ))}
            </svg>

            {/* Centered Total Label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="text-base lg:text-lg font-bold text-surface-900 dark:text-white block leading-tight">
                  {formatCurrency(totalSpending, profile?.currency || 'DOP', true)}
                </span>
                <span className="text-[10px] text-surface-400 font-medium">Total</span>
              </div>
            </div>
          </div>

          {/* Category Legend matching landing preview */}
          <div className="flex-1 w-full space-y-2.5">
            {items.slice(0, 4).map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="flex items-center gap-2.5"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs lg:text-sm text-surface-700 dark:text-surface-300 flex-1 truncate font-medium">
                  {item.name}
                </span>
                <span className="text-xs font-semibold text-surface-900 dark:text-white">
                  {item.percent}%
                </span>
                <span className="text-[11px] text-surface-400 font-normal">
                  ({formatCurrency(item.amount, profile?.currency || 'DOP')})
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
