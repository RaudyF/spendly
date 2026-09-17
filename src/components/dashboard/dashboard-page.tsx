'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/store';
import { Card, Skeleton, Button } from '@/components/ui';
import { formatCurrency, getGreeting, getPayCycleFromDate } from '@/lib/utils';
import { StatsCard } from './stats-card';
import { containerVariants, itemVariants } from './animations';
import { HealthScore } from './health-score';
import { RecentTransactions, BudgetOverview, ObligationsOverview } from './dashboard-widgets';
import { IncomeIcon, ExpensesIcon, SavingsIcon, BudgetIcon } from '@/components/icons';
import { DisponibleHero } from './disponible-hero';
import { SpendingTrend } from './spending-trend';
import { CategoryDonut } from './category-donut';

// Main Dashboard Component
export const Dashboard: React.FC = () => {
  const profile = useStore((state) => state.profile);
  const monthlyStats = useStore((state) => state.monthlyStats);
  const isLoading = useStore((state) => state.isLoading);
  const activePayCycle = useStore((state) => state.activePayCycle);
  const setActivePayCycle = useStore((state) => state.setActivePayCycle);
  const refreshInsights = useStore((state) => state.refreshInsights);
  const addIncome = useStore((state) => state.addIncome);
  const currentMonth = useStore((state) => state.currentMonth);

  React.useEffect(() => {
    refreshInsights();
  }, [refreshInsights]);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const currency = profile?.currency || 'DOP';
  const q1Pending = monthlyStats?.q1Stats?.pendingSalary ?? 0;
  const q2Pending = monthlyStats?.q2Stats?.pendingSalary ?? 0;
  const q1Received = monthlyStats?.q1Stats?.salaryReceived ?? 0;
  const q2Received = monthlyStats?.q2Stats?.salaryReceived ?? 0;
  const q1Expected = monthlyStats?.q1Stats?.expectedSalary ?? 0;
  const q2Expected = monthlyStats?.q2Stats?.expectedSalary ?? 0;

  const handleConfirmSalary = async (cycle: 'Q1' | 'Q2') => {
    const stats = useStore.getState().monthlyStats;
    const pending = cycle === 'Q1'
      ? (stats?.q1Stats?.pendingSalary ?? 0)
      : (stats?.q2Stats?.pendingSalary ?? 0);

    if (pending <= 0) return;

    const dateStr = cycle === 'Q1'
      ? `${currentMonth}-15T12:00:00.000Z`
      : `${currentMonth}-28T12:00:00.000Z`;

    await addIncome({
      amount: pending,
      source: `Salario ${cycle}`,
      date: dateStr,
      payCycle: cycle,
      type: 'salary',
      status: 'received',
    });
  };

  const handleConfirmBoth = async () => {
    if (q1Pending > 0) {
      await handleConfirmSalary('Q1');
    }
    if (q2Pending > 0) {
      await handleConfirmSalary('Q2');
    }
  };

  const freeAvailable = monthlyStats?.freeAvailable || 0;
  const projectedFreeAvailable = monthlyStats?.projectedFreeAvailable;
  const receivedIncome = monthlyStats?.receivedIncome || 0;
  const committed = monthlyStats?.committed || 0;
  const totalExpenses = monthlyStats?.totalExpenses || 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto pb-24 sm:pb-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-surface-900 dark:text-white">
            {getGreeting()}, {profile?.name || 'usuario'}
          </h1>
          <p className="mt-1 text-sm sm:text-base text-surface-500">
            Tu resumen financiero para este período
          </p>
        </div>

        {/* PayCycle Selector */}
        <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-lg self-start sm:self-auto shrink-0 border border-surface-200 dark:border-surface-700">
          {(['Q1', 'Q2', 'MONTHLY'] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setActivePayCycle(cycle)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activePayCycle === cycle
                  ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
              }`}
            >
              {cycle === 'MONTHLY' ? 'Mes Completo' : cycle}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Disponible Hero (Landing aesthetic center) */}
      <DisponibleHero
        freeAvailable={freeAvailable}
        projectedFreeAvailable={projectedFreeAvailable}
        receivedIncome={receivedIncome}
        committed={committed}
        totalExpenses={totalExpenses}
        currency={currency}
        activePayCycle={activePayCycle}
        currentMonth={currentMonth}
        pendingSalary={q1Pending + q2Pending}
        expectedSalary={q1Expected + q2Expected}
        salaryReceived={q1Received + q2Received}
        onConfirmSalary={handleConfirmSalary}
        onConfirmBoth={handleConfirmBoth}
      />

      {/* Stats Cards Row - 1 col mobile, 2 col tablet/laptop, 4 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Ingresos"
          value={formatCurrency(receivedIncome, currency)}
          subtitle={
            profile?.incomeFrequency === 'variable'
              ? (receivedIncome ? 'Ingresos reales' : 'Sin cobros')
              : monthlyStats?.expectedIncome
              ? `Esperado: ${formatCurrency(monthlyStats.expectedIncome, currency)}`
              : undefined
          }
          icon={IncomeIcon}
          color="success"
          delay={0.1}
        />
        <StatsCard
          title="Gastos"
          value={formatCurrency(totalExpenses, currency)}
          subtitle="Egresos del ciclo"
          icon={ExpensesIcon}
          color="danger"
          delay={0.2}
        />
        <StatsCard
          title="Ahorros / Remanente"
          value={formatCurrency(freeAvailable, currency)}
          subtitle={projectedFreeAvailable !== undefined ? `Proyectado: ${formatCurrency(projectedFreeAvailable, currency)}` : undefined}
          trend={freeAvailable >= 0 ? 'up' : 'down'}
          change={48}
          icon={SavingsIcon}
          color="primary"
          delay={0.3}
        />
        <StatsCard
          title="Obligaciones Fijas"
          value={formatCurrency(committed, currency)}
          subtitle="Comprometido este mes"
          icon={BudgetIcon}
          color="secondary"
          delay={0.4}
        />
      </div>

      {/* Conditional Charts Row - Only show when there are expenses */}
      {totalExpenses > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-w-0 overflow-hidden">
          <div className="xl:col-span-7 min-w-0 overflow-hidden">
            <SpendingTrend />
          </div>
          <div className="xl:col-span-5 min-w-0 overflow-hidden">
            <CategoryDonut />
          </div>
        </div>
      ) : null}

      {/* Bottom Row - Dynamic auto-flow distribution without empty gaps */}
      {(() => {
        const obligationsList = (useStore.getState().obligations || []).filter(
          (o) => activePayCycle === 'MONTHLY' || o.payCycle === activePayCycle
        );
        const expensesList = (useStore.getState().expenses || []).filter((e) => {
          if (!e.date.startsWith(currentMonth)) return false;
          if (activePayCycle === 'MONTHLY') return true;
          return (e.payCycle || getPayCycleFromDate(e.date)) === activePayCycle;
        });

        const hasObligations = obligationsList.length > 0;
        const hasTransactions = expensesList.length > 0;

        // Collect visible secondary modules
        const modules: React.ReactNode[] = [];
        modules.push(<HealthScore key="health" />);
        if (hasObligations) {
          modules.push(<ObligationsOverview key="obligations" />);
        }
        modules.push(<BudgetOverview key="budget" />);
        if (hasTransactions) {
          modules.push(<RecentTransactions key="transactions" />);
        }

        // If both obligations and recent transactions are empty, show single centered compact "Completa tu resumen" card
        if (!hasObligations && !hasTransactions) {
          return (
            <div className="w-full min-w-0 overflow-hidden">
              <Card className="p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-white text-base mb-1">
                    Completa tu resumen
                  </h3>
                  <p className="text-xs text-surface-500 mb-4">
                    Añade tus obligaciones fijas y movimientos para obtener el control completo de tu quincena.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => window.location.href = '/obligations'} size="sm">
                    Añadir Obligación
                  </Button>
                  <Button onClick={() => window.location.href = '/expenses'} size="sm" variant="outline">
                    Añadir Movimiento
                  </Button>
                </div>
              </Card>
            </div>
          );
        }

        // Dynamic layout based on number of visible modules (1, 2, 3, or 4)
        // 1 module: centered
        // 2 modules: 2 columns equal
        // 3 modules: 2 top, 1 bottom spanning full width or centered
        // 4 modules: 2x2 grid on tablet/laptop, 4 cols on xl
        if (modules.length === 1) {
          return (
            <div className="max-w-md mx-auto w-full min-w-0 overflow-hidden">
              <div className="min-w-0 overflow-hidden">{modules[0]}</div>
            </div>
          );
        }

        if (modules.length === 2) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto w-full min-w-0 overflow-hidden">
              {modules.map((mod, idx) => (
                <div key={idx} className="min-w-0 overflow-hidden">{mod}</div>
              ))}
            </div>
          );
        }

        if (modules.length === 3) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto w-full min-w-0 overflow-hidden">
              <div className="min-w-0 overflow-hidden">{modules[0]}</div>
              <div className="min-w-0 overflow-hidden">{modules[1]}</div>
              <div className="md:col-span-2 max-w-xl mx-w-full w-full min-w-0 overflow-hidden">
                {modules[2]}
              </div>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 min-w-0 overflow-hidden">
            {modules.map((mod, idx) => (
              <div key={idx} className="min-w-0 overflow-hidden">{mod}</div>
            ))}
          </div>
        );
      })()}
      {/* Spacer visible only below xl to clear bottom nav */}
      <div className="h-28 xl:hidden" aria-hidden="true" />
    </motion.div>
  );
};

