'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Receipt, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/store';
import { Card, Progress, Button, EmptyState } from '@/components/ui';
import { CategoryIcon } from '@/components/category-icon';
import { cn, formatCurrency, formatDate, calculatePercentage, getPayCycleFromDate } from '@/lib/utils';
import { CATEGORIES } from '@/lib/constants';
import { itemVariants } from './stats-card';

// Recent Transactions Component
export const RecentTransactions: React.FC = () => {
  const expenses = useStore((state) => state.expenses);
  const profile = useStore((state) => state.profile);
  const currentMonth = useStore((state) => state.currentMonth);
  const activePayCycle = useStore((state) => state.activePayCycle);

  const filteredExpenses = expenses.filter((e) => {
    if (!e.date.startsWith(currentMonth)) return false;
    if (activePayCycle === 'MONTHLY') return true;
    return getPayCycleFromDate(e.date) === activePayCycle;
  });

  const recentExpenses = [...filteredExpenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <motion.div variants={itemVariants}>
      <Card className="h-full">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="font-semibold text-surface-900 dark:text-white text-sm sm:text-base">
            Movimientos Recientes
          </h3>
          <Link
            href="/expenses"
            className={cn(
              'text-xs sm:text-sm font-medium',
              'text-primary-600 dark:text-primary-400',
              'hover:text-primary-700 dark:hover:text-primary-300',
              'transition-colors duration-200'
            )}
          >
            Ver todos
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-12 h-12" />}
            title="Sin movimientos"
            description="Registra tus movimientos"
            action={
              <Button onClick={() => window.location.href = '/expenses'}>
                Añadir Movimiento
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {recentExpenses.map((expense, index) => (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className={cn(
                  'flex items-center gap-3 p-3 -mx-3 rounded-xl',
                  'transition-colors duration-200',
                  'hover:bg-surface-50 dark:hover:bg-surface-800/50'
                )}
              >
                <CategoryIcon category={expense.category} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-surface-900 dark:text-white truncate text-sm">
                    {expense.description}
                  </p>
                  <p className="text-xs text-surface-500">
                    {formatDate(expense.date, 'MMM d, h:mm a')}
                  </p>
                </div>
                <p className="font-semibold text-surface-900 dark:text-white text-sm">
                  -{formatCurrency(expense.amount, profile?.currency || 'USD')}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
};

// Budget Overview Component
export const BudgetOverview: React.FC = () => {
  const budgets = useStore((state) => state.budgets);
  const currentMonth = useStore((state) => state.currentMonth);
  const profile = useStore((state) => state.profile);

  const monthBudgets = budgets
    .filter((b) => b.month === currentMonth)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 4);

  return (
    <motion.div variants={itemVariants}>
      <Card className="h-full">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="font-semibold text-surface-900 dark:text-white text-sm sm:text-base">
            Estado de Presupuesto
          </h3>
          <Link
            href="/budget"
            className={cn(
              'text-xs sm:text-sm font-medium',
              'text-primary-600 dark:text-primary-400',
              'hover:text-primary-700 dark:hover:text-primary-300',
              'transition-colors duration-200'
            )}
          >
            Administrar
          </Link>
        </div>

        {monthBudgets.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-12 h-12" />}
            title="Sin presupuestos"
            description="Crea presupuestos para monitorear gastos"
            action={
              <Button onClick={() => window.location.href = '/budget'}>
                Añadir Presupuesto
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {monthBudgets.map((budget, index) => {
              const category = CATEGORIES.find((c) => c.id === budget.category);
              const percentage = calculatePercentage(budget.spent, budget.limit);
              const isOverBudget = budget.spent > budget.limit;

              return (
                <motion.div 
                  key={budget.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CategoryIcon category={budget.category} size="sm" />
                      <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                        {category?.name}
                      </span>
                    </div>
                    <span className={cn(
                      'text-xs font-medium',
                      isOverBudget ? 'text-danger-500' : 'text-surface-500'
                    )}>
                      {formatCurrency(budget.spent, profile?.currency)} / {formatCurrency(budget.limit, profile?.currency)}
                    </span>
                  </div>
                  <Progress 
                    value={budget.spent} 
                    max={budget.limit} 
                    size="sm"
                    color={isOverBudget ? 'danger' : percentage > 80 ? 'warning' : 'primary'}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
};

export const ObligationsOverview: React.FC = () => {
  const obligations = useStore((state) => state.obligations);
  const activePayCycle = useStore((state) => state.activePayCycle);
  const profile = useStore((state) => state.profile);

  const activeObligations = obligations
    .filter((o) => activePayCycle === 'MONTHLY' || o.payCycle === activePayCycle)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 4);

  return (
    <motion.div variants={itemVariants}>
      <Card className="h-full">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="font-semibold text-surface-900 dark:text-white text-sm sm:text-base">
            Obligaciones
          </h3>
          <Link
            href="/obligations"
            className={cn(
              'text-xs sm:text-sm font-medium',
              'text-primary-600 dark:text-primary-400',
              'hover:text-primary-700 dark:hover:text-primary-300',
              'transition-colors duration-200'
            )}
          >
            Administrar
          </Link>
        </div>

        {activeObligations.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-12 h-12" />}
            title="Sin obligaciones"
            description="Agrega obligaciones para esta quincena"
            action={
              <Button onClick={() => window.location.href = '/obligations'}>
                Añadir
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {activeObligations.map((obligation, index) => {
              const category = CATEGORIES.find((c) => c.id === obligation.category);
              return (
                <motion.div 
                  key={obligation.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-100 dark:border-surface-800"
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon category={obligation.category} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-surface-900 dark:text-white">
                        {obligation.name}
                      </p>
                      <p className="text-xs text-surface-500">
                        {obligation.isPaid ? 'Pagado' : 'Pendiente'}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-sm font-semibold',
                    obligation.isPaid ? 'text-surface-500 line-through' : 'text-danger-600 dark:text-danger-400'
                  )}>
                    {formatCurrency(obligation.amount, profile?.currency)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
};
