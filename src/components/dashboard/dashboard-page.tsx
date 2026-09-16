'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/store';
import { Card, Skeleton } from '@/components/ui';
import { formatCurrency, getGreeting, calculatePercentage } from '@/lib/utils';
import { SpendingChart, CategoryPieChart } from '@/components/charts';
import { StatsCard, containerVariants, itemVariants } from './stats-card';
import { HealthScore } from './health-score';
import { RecentTransactions, BudgetOverview, ObligationsOverview } from './dashboard-widgets';
import { IncomeIcon, ExpensesIcon, SavingsIcon, BudgetIcon } from '@/components/icons';

// Main Dashboard Component
export const Dashboard: React.FC = () => {
  const profile = useStore((state) => state.profile);
  const monthlyStats = useStore((state) => state.monthlyStats);
  const isLoading = useStore((state) => state.isLoading);
  const activePayCycle = useStore((state) => state.activePayCycle);
  const setActivePayCycle = useStore((state) => state.setActivePayCycle);
  const refreshInsights = useStore((state) => state.refreshInsights);

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

  const currency = profile?.currency || 'USD';
  const savingsPercent = monthlyStats?.totalIncome 
    ? Math.round(((monthlyStats.savings || 0) / monthlyStats.totalIncome) * 100)
    : 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-24 sm:pb-8"
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

      {/* Stats Cards - 2x2 grid on mobile for better visibility */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          title="Ingresos"
          value={formatCurrency(monthlyStats?.totalIncome || 0, currency)}
          icon={IncomeIcon}
          color="success"
        />
        <StatsCard
          title="Gastos"
          value={formatCurrency(monthlyStats?.totalExpenses || 0, currency)}
          icon={ExpensesIcon}
          color="danger"
        />
        <StatsCard
          title="Disponible Libre"
          value={formatCurrency(Math.abs(monthlyStats?.freeAvailable || 0), currency)}
          trend={(monthlyStats?.freeAvailable || 0) >= 0 ? 'up' : 'down'}
          icon={SavingsIcon}
          color="primary"
        />
        <StatsCard
          title="Comprometido"
          value={formatCurrency(monthlyStats?.committed || 0, currency)}
          icon={BudgetIcon}
          color="secondary"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <h3 className="font-semibold text-surface-900 dark:text-white mb-4 sm:mb-6 text-sm sm:text-base">
              Tendencia de Gastos
            </h3>
            <SpendingChart />
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <h3 className="font-semibold text-surface-900 dark:text-white mb-4 sm:mb-6 text-sm sm:text-base">
              Gastos por Categoría
            </h3>
            <CategoryPieChart />
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row - Stack on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        <HealthScore />
        <ObligationsOverview />
        <BudgetOverview />
        <RecentTransactions />
      </div>
    </motion.div>
  );
};
