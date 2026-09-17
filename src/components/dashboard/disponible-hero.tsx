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
import { getFinancialToday } from '@/lib/time';
import { itemVariants } from './animations';

interface DisponibleHeroProps {
  freeAvailable: number;
  projectedFreeAvailable?: number;
  receivedIncome: number;
  committed: number;
  totalExpenses: number;
  currency: string;
  activePayCycle: 'Q1' | 'Q2' | 'MONTHLY';
  viewingPeriod: string;
  pendingSalary: number;
  expectedSalary: number;
  salaryReceived: number;
  initialBalance?: number;
  q1Pending?: number;
  q2Pending?: number;
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
  viewingPeriod,
  pendingSalary,
  expectedSalary,
  salaryReceived,
  initialBalance = 0,
  q1Pending,
  q2Pending,
  onConfirmSalary,
  onConfirmBoth,
}) => {
  // Calculate remaining full days in active cycle (explicitly days after today)
  const financialToday = getFinancialToday();
  const currentDay = financialToday.getDate();
  const currentMonthStr = `${financialToday.getFullYear()}-${String(financialToday.getMonth() + 1).padStart(2, '0')}`;
  const [yearStr, monthStr] = viewingPeriod.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  let dayProgressText = '';

  if (viewingPeriod < currentMonthStr) {
    dayProgressText = 'Período finalizado';
  } else if (viewingPeriod > currentMonthStr) {
    dayProgressText = 'Período futuro';
  } else {
    // Current period
    if (activePayCycle === 'Q1') {
      if (currentDay > 15) {
        dayProgressText = 'Quincena 1 (1 - 15) · Finalizada';
      } else {
        const remainingFullDays = 15 - currentDay;
        if (remainingFullDays === 0) {
          dayProgressText = `Día 15 de 15 · Último día del ciclo (hoy)`;
        } else if (remainingFullDays === 1) {
          dayProgressText = `Día ${currentDay} de 15 · 1 día completo restante (después de hoy)`;
        } else {
          dayProgressText = `Día ${currentDay} de 15 · ${remainingFullDays} días completos restantes (después de hoy)`;
        }
      }
    } else if (activePayCycle === 'Q2') {
      if (currentDay < 16) {
        const daysToStart = 16 - currentDay;
        dayProgressText = `Quincena 2 (16 - ${daysInMonth}) · Inicia en ${daysToStart} ${daysToStart === 1 ? 'día' : 'días'} (después de hoy)`;
      } else {
        const q2TotalDays = daysInMonth - 15;
        const q2Day = currentDay - 15;
        const remainingFullDays = Math.max(0, daysInMonth - currentDay);
        if (remainingFullDays === 0) {
          dayProgressText = `Día ${q2Day} de ${q2TotalDays} · Último día del ciclo (hoy)`;
        } else if (remainingFullDays === 1) {
          dayProgressText = `Día ${q2Day} de ${q2TotalDays} · 1 día completo restante (después de hoy)`;
        } else {
          dayProgressText = `Día ${q2Day} de ${q2TotalDays} · ${remainingFullDays} días completos restantes (después de hoy)`;
        }
      }
    } else {
      // Mes Completo
      const remainingFullDays = Math.max(0, daysInMonth - currentDay);
      if (remainingFullDays === 0) {
        dayProgressText = `Día ${currentDay} de ${daysInMonth} · Último día del mes (hoy)`;
      } else if (remainingFullDays === 1) {
        dayProgressText = `Día ${currentDay} de ${daysInMonth} · 1 día completo restante (después de hoy)`;
      } else {
        dayProgressText = `Día ${currentDay} de ${daysInMonth} · ${remainingFullDays} días completos restantes (después de hoy)`;
      }
    }
  }

  const isHealthy = freeAvailable >= 0;
  const isBothQuotasPending = (q1Pending ?? 0) > 0 && (q2Pending ?? 0) > 0;

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

            {initialBalance !== 0 && (
              <span
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                  initialBalance > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                }`}
              >
                {initialBalance > 0 ? 'Incluye +' : 'Déficit arrastrado '}
                {formatCurrency(initialBalance, currency)} de saldo inicial
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
                  {isBothQuotasPending
                    ? `Confirmar ambas nóminas (${formatCurrency(pendingSalary, currency)})`
                    : `Confirmar nómina pendiente (${formatCurrency(pendingSalary, currency)})`}
                </button>
              )
            ) : (
              onConfirmSalary && (
                <button
                  onClick={() => onConfirmSalary(activePayCycle as 'Q1' | 'Q2')}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-xs transition-colors shadow-sm"
                >
                  Confirmar nómina pendiente ({formatCurrency(pendingSalary, currency)})
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
