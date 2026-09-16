'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { SlidersHorizontal, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useStore } from '@/store';
import { Card, Button, Progress } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { MonthlyComparisonChart } from '@/components/charts';
import { formatCurrency, calculatePercentage, getMonthName } from '@/lib/utils';
import { CATEGORIES } from '@/lib/constants';
import { CategoryType } from '@/types';
import { format, addMonths, subMonths, isValid, parse } from 'date-fns';
import { BudgetItem } from './budget-item';
import { BudgetSetupModal } from './budget-setup-modal';

// Main Budget Page with URL Query persistence & clear variable distinction
export const BudgetPage: React.FC = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const budgets = useStore((state) => state.budgets);
  const currentMonth = useStore((state) => state.currentMonth);
  const setCurrentMonth = useStore((state) => state.setCurrentMonth);
  const setBudget = useStore((state) => state.setBudget);
  const profile = useStore((state) => state.profile);

  const [showSetup, setShowSetup] = useState(false);

  // Sync month from URL searchParams if provided and valid
  useEffect(() => {
    const monthParam = searchParams.get('month');
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const parsed = parse(monthParam, 'yyyy-MM', new Date());
      if (isValid(parsed) && monthParam !== currentMonth) {
        setCurrentMonth(monthParam);
      }
    }
  }, [searchParams, currentMonth, setCurrentMonth]);

  const updateMonthParam = (newMonth: string) => {
    setCurrentMonth(newMonth);
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', newMonth);
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
  };

  const monthBudgets = budgets.filter((b) => b.month === currentMonth);
  const hasNoBudgets = monthBudgets.length === 0;

  const totalBudget = monthBudgets.reduce((sum, b) => sum + b.limit, 0);
  const totalSpent = monthBudgets.reduce((sum, b) => sum + b.spent, 0);
  const totalPercentage = calculatePercentage(totalSpent, totalBudget);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const [year, month] = currentMonth.split('-').map(Number);
    const currentDate = new Date(year, month - 1);
    const newDate = direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    const formatted = format(newDate, 'yyyy-MM');
    updateMonthParam(formatted);
  };

  const handleBudgetEdit = async (category: CategoryType, limit: number) => {
    await setBudget(category, limit);
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header with clear semantic definition */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-white">
              Presupuestos
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60">
              Límites Variables
            </span>
          </div>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
            Techos máximos de gasto para categorías variables (comida, entretenimiento, compras)
          </p>
        </div>

        {/* Month selector with history synchronization */}
        <div className="flex items-center gap-2 bg-white dark:bg-surface-800 p-1.5 rounded-2xl border border-surface-200/80 dark:border-surface-700 shadow-soft-xs">
          <button
            onClick={() => handleMonthChange('prev')}
            aria-label="Mes anterior"
            className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="min-w-[140px] text-center font-semibold text-sm capitalize text-surface-800 dark:text-surface-100">
            {getMonthName(currentMonth)}
          </span>
          <button
            onClick={() => handleMonthChange('next')}
            aria-label="Mes siguiente"
            className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Distinction notice banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <p>
          <strong className="font-semibold">Diferencia clave:</strong> Los presupuestos son techos
          flexibles que tú regulas mes a mes para gastos cotidianos. Para tus pagos fijos fechados
          (alquiler, préstamos, servicios con fecha de vencimiento), consulta la pestaña{' '}
          <strong className="underline decoration-amber-500 font-semibold">Obligaciones (Fijos)</strong>.
        </p>
      </div>

      {hasNoBudgets ? (
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-soft-md">
            <SlidersHorizontal className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">
            Sin Presupuesto para este mes
          </h2>
          <p className="text-surface-500 text-sm mb-6 max-w-sm mx-auto">
            Configura tus límites de gasto variable para mantener tu Disponibilidad Libre bajo control.
          </p>
          <Button onClick={() => setShowSetup(true)}>Crear Presupuesto</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Overview Card */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-surface-900 dark:text-white">
                  Consumo del Presupuesto Mensual
                </h3>
                <p className="text-sm text-surface-500 mt-0.5">
                  Has gastado {formatCurrency(totalSpent, profile?.currency)} de un techo total de{' '}
                  {formatCurrency(totalBudget, profile?.currency)}
                </p>
              </div>
              <StatusBadge
                status={
                  totalPercentage >= 100
                    ? 'overdue'
                    : totalPercentage >= 80
                    ? 'warning'
                    : 'confirmed'
                }
                label={`${totalPercentage}% consumido`}
                size="md"
              />
            </div>
            <Progress value={totalSpent} max={totalBudget} size="lg" />
          </Card>

          {/* Budget Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CATEGORIES.map((category) => {
              const budget = monthBudgets.find((b) => b.category === category.id);
              return (
                <BudgetItem
                  key={category.id}
                  category={category.id}
                  limit={budget?.limit || 0}
                  spent={budget?.spent || 0}
                  onEdit={(limit) => handleBudgetEdit(category.id, limit)}
                />
              );
            })}
          </div>

          {/* Monthly Comparison Chart */}
          <Card className="p-6">
            <h3 className="text-base font-bold text-surface-900 dark:text-white mb-4">
              Historial y Comparativa de Gastos Variables
            </h3>
            <MonthlyComparisonChart />
          </Card>
        </div>
      )}

      <BudgetSetupModal isOpen={showSetup} onClose={() => setShowSetup(false)} />
    </div>
  );
};
