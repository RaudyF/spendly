'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { parseISO } from 'date-fns';
import { useStore } from '@/store';
import { formatCurrency, getPayCycleFromDate } from '@/lib/utils';
import { itemVariants } from './animations';

export const SpendingTrend: React.FC = () => {
  const expenses = useStore((state) => state.expenses);
  const profile = useStore((state) => state.profile);
  const viewingPeriod = useStore((state) => state.viewingPeriod);
  const activePayCycle = useStore((state) => state.activePayCycle);

  const data = React.useMemo(() => {
    const [yearStr, monthStr] = viewingPeriod.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    let startDay = 1;
    let endDay = daysInMonth;

    if (activePayCycle === 'Q1') {
      endDay = 15;
    } else if (activePayCycle === 'Q2') {
      startDay = 16;
    }

    const cycleExpenses = expenses.filter((e) => {
      if (!e.date.startsWith(viewingPeriod)) return false;
      if (activePayCycle === 'MONTHLY') return true;
      return (e.payCycle || getPayCycleFromDate(e.date)) === activePayCycle;
    });

    const days = [];
    for (let day = startDay; day <= endDay; day++) {
      const dayExpenses = cycleExpenses.filter((e) => {
        const expDate = parseISO(e.date);
        return expDate.getDate() === day;
      });

      const total = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
      days.push({
        day: `${day}`,
        amount: total,
      });
    }

    return days;
  }, [expenses, viewingPeriod, activePayCycle]);

  const maxSpend = Math.max(...data.map((d) => d.amount), 1);
  const totalSpend = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <motion.div
      variants={itemVariants}
      className="p-5 lg:p-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 shadow-sm h-full flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm lg:text-base font-semibold text-surface-900 dark:text-white">
            Tendencia de Gastos
          </h3>
          <p className="text-xs text-surface-400 mt-0.5">
            Distribución diaria de egresos en este período
          </p>
        </div>
        <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 bg-surface-50 dark:bg-surface-700/50 px-2.5 py-1 rounded-lg border border-surface-100 dark:border-surface-700/50">
          Total: {formatCurrency(totalSpend, profile?.currency || 'DOP')}
        </span>
      </div>

      {totalSpend === 0 ? (
        <div className="h-44 flex flex-col items-center justify-center text-surface-400 text-xs">
          <p>No hay gastos registrados en este ciclo</p>
        </div>
      ) : (
        <div className="h-44 flex items-end gap-1.5 sm:gap-2 pt-4">
          {data.map((d, i) => {
            const heightPercent = maxSpend > 0 ? (d.amount / maxSpend) * 100 : 0;
            const hasSpend = d.amount > 0;

            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative"
              >
                {/* Tooltip on hover */}
                {hasSpend && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-surface-900 dark:bg-surface-700 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                    Día {d.day}: {formatCurrency(d.amount, profile?.currency || 'DOP')}
                  </div>
                )}

                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(heightPercent, 6)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.02 }}
                  className={`w-full rounded-t-md transition-all ${
                    hasSpend
                      ? 'bg-gradient-to-t from-primary-600 to-primary-400 group-hover:from-primary-500 group-hover:to-primary-300'
                      : 'bg-surface-100 dark:bg-surface-700/40 min-h-[4px]'
                  }`}
                />

                <span className="text-[10px] sm:text-xs text-surface-400 font-medium select-none">
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
