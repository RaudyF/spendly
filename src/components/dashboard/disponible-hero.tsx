'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  Wallet,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { itemVariants } from './animations';

interface DisponibleHeroProps {
  freeAvailable: number;
  projectedFreeAvailable?: number;
  receivedIncome: number;
  committed: number;
  totalExpenses: number;
  currency: string;
  activePayCycle: 'Q1' | 'Q2' | 'MONTHLY';
  currentMonth: string;
  pendingSalary: number;
  expectedSalary: number;
  salaryReceived: number;
  onConfirmSalary?: (cycle: 'Q1' | 'Q2') => void;
  onConfirmBoth?: () => void;
}

export const DisponibleHero: React.FC<DisponibleHeroProps> = ({
  freeAvailable,
  projectedFreeAvailable,
  receivedIncome,
  committed,
  totalExpenses,
  currency,
  activePayCycle,
  currentMonth,
  pendingSalary,
  expectedSalary,
  salaryReceived,
  onConfirmSalary,
  onConfirmBoth,
}) => {
  // Calculate remaining days in active cycle
  const now = new Date();
  const currentDay = now.getDate();
  const [yearStr, monthStr] = currentMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  let remainingDays = 0;
  let cycleLabel = 'Mes Completo';
  let dayProgressText = '';

  if (activePayCycle === 'Q1') {
    cycleLabel = 'Quincena 1 (1 - 15)';
    const clampedDay = Math.min(Math.max(currentDay, 1), 15);
    remainingDays = Math.max(0, 15 - clampedDay + 1);
    dayProgressText = `Día ${clampedDay} de 15 · ${remainingDays} días restantes`;
  } else if (activePayCycle === 'Q2') {
    cycleLabel = `Quincena 2 (16 - ${daysInMonth})`;
    const q2TotalDays = daysInMonth - 15;
    const clampedDay = Math.min(Math.max(currentDay - 15, 1), q2TotalDays);
    remainingDays = Math.max(0, q2TotalDays - clampedDay + 1);
    dayProgressText = `Día ${clampedDay} de ${q2TotalDays} · ${remainingDays} días restantes`;
  } else {
    cycleLabel = 'Mes Completo';
    const clampedDay = Math.min(Math.max(currentDay, 1), daysInMonth);
    remainingDays = Math.max(0, daysInMonth - clampedDay + 1);
    dayProgressText = `Día ${clampedDay} de ${daysInMonth} · ${remainingDays} días restantes`;
  }

  

  const isHealthy = freeAvailable >= 0;

  return (
    <motion.div
      variants={itemVariants}
      className="p-5 lg:p-7 rounded-2xl bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 shadow-sm relative overflow-hidden"
    >
      {/* Top Meta Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 lg:mb-6">
        <div className="flex items-center gap-2">
          
          <span
            className={cn(
              'text-xs px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5',
              isHealthy
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            )}
          >
            {isHealthy ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                Seguro para gastar
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                Déficit en ciclo
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-surface-500 dark:text-surface-400 bg-surface-50 dark:bg-surface-700/50 px-3 py-1.5 rounded-lg border border-surface-100 dark:border-surface-700/50 self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-primary-500" />
          <span>{dayProgressText}</span>
        </div>
      </div>

      {/* Hero Display: Amount and Daily Pace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7">
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
            Disponible Libre Real
          </p>
          <div className="flex flex-wrap items-baseline gap-3 mt-1.5">
            <h2
              className={cn(
                'text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight',
                isHealthy
                  ? 'text-surface-900 dark:text-white'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {formatCurrency(freeAvailable, currency)}
            </h2>

            {projectedFreeAvailable !== undefined && pendingSalary > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 font-medium">
                Proyectado con nómina: {formatCurrency(projectedFreeAvailable, currency)}
              </span>
            )}
          </div>

          <p className="text-xs lg:text-sm text-surface-500 dark:text-surface-400 mt-2">
            Dinero real confirmado tras reservar todas tus obligaciones fijas y descontar gastos del período.
          </p>
        </div>
      </div>

      {/* Compact Salary Notification if Pending */}
      {pendingSalary > 0 && (
        <div className="mt-4 p-3 lg:p-3.5 bg-green-50/80 dark:bg-green-950/20 border border-green-200/70 dark:border-green-800/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-green-900 dark:text-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span>
              Nómina esperada pendiente: <strong>{formatCurrency(pendingSalary, currency)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activePayCycle === 'MONTHLY' ? (
              onConfirmBoth && (
                <button
                  onClick={onConfirmBoth}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-xs transition-colors shadow-sm"
                >
                  Confirmar ambas nóminas ({formatCurrency(pendingSalary, currency)})
                </button>
              )
            ) : (
              onConfirmSalary && (
                <button
                  onClick={() => onConfirmSalary(activePayCycle as 'Q1' | 'Q2')}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-xs transition-colors shadow-sm"
                >
                  Confirmar cobro ({formatCurrency(pendingSalary, currency)})
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Decorative Glow */}
      <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-primary-500/10 dark:bg-primary-500/15 blur-2xl pointer-events-none" />
    </motion.div>
  );
};
