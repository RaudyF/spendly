import { AIInsight, CategoryType, MonthlyStats } from '@/types';
import { budgetsDB, insightsDB } from '@/lib/db';
import { getPayCycleFromDate, generateId } from '@/lib/utils';
import { CATEGORIES } from '@/lib/constants';
import { generateLocalInsights, calculateFinancialHealth } from '@/lib/ai';
import { StoreSet, StoreGet } from '../types';

export const createStatsActions = (set: StoreSet, get: StoreGet) => ({
  refreshInsights: () => {
    const { expenses, incomes, obligations, profile, currentMonth, activePayCycle } = get();

    // Filter expenses for current month and active cycle
    const monthExpenses = expenses.filter((e) => {
      if (!e.date.startsWith(currentMonth)) return false;
      if (activePayCycle === 'MONTHLY') return true;
      return (e.payCycle || getPayCycleFromDate(e.date)) === activePayCycle;
    });

    // Calculate income
    const monthIncomes = incomes.filter((i) => {
      if (!i.date.startsWith(currentMonth)) return false;
      if (activePayCycle === 'MONTHLY') return true;
      return getPayCycleFromDate(i.date) === activePayCycle;
    });
    const totalIncome =
      monthIncomes.reduce((sum, i) => sum + i.amount, 0) ||
      profile?.monthlyIncome ||
      0;

    // Calculate category totals
    const activeObligations = obligations.filter(
      (o) => activePayCycle === 'MONTHLY' || o.payCycle === activePayCycle
    );
    const committed = activeObligations.filter((o) => !o.isPaid).reduce((sum, o) => sum + o.amount, 0);

    const byCategory: Record<CategoryType, number> = {} as Record<
      CategoryType,
      number
    >;
    CATEGORIES.forEach((cat) => {
      byCategory[cat.id] = 0;
    });

    monthExpenses.forEach((expense) => {
      byCategory[expense.category] =
        (byCategory[expense.category] || 0) + expense.amount;
    });

    const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const freeAvailable = totalIncome - committed - totalExpenses;

    const stats: MonthlyStats = {
      month: currentMonth,
      totalIncome,
      totalExpenses,
      savings: totalIncome - totalExpenses,
      committed,
      freeAvailable,
      byCategory,
    };

    // Generate insights
    const insightTexts = generateLocalInsights(
      stats,
      monthExpenses,
      profile?.currency || 'USD'
    );

    const newInsights: AIInsight[] = insightTexts.map((text, index) => ({
      id: generateId(),
      type: index === 0 ? 'tip' : 'pattern',
      title: text.split('.')[0] || 'Insight',
      description: text,
      createdAt: new Date().toISOString(),
      isRead: false,
      priority: index === 0 ? 'high' : 'medium',
    }));

    set({ insights: newInsights });
  },

  dismissInsight: async (id: string) => {
    const insight = get().insights.find((i) => i.id === id);
    if (insight) {
      const updated = { ...insight, isRead: true };
      await insightsDB.update(updated);
      set((state) => ({
        insights: state.insights.map((i) => (i.id === id ? updated : i)),
      }));
    }
  },

  recalculateStats: () => {
    const { expenses, incomes, obligations, budgets, goals, profile, currentMonth, activePayCycle } = get();

    // Filter for current month and active cycle
    const monthExpenses = expenses.filter((e) => {
      if (!e.date.startsWith(currentMonth)) return false;
      if (activePayCycle === 'MONTHLY') return true;
      return (e.payCycle || getPayCycleFromDate(e.date)) === activePayCycle;
    });
    
    const monthIncomes = incomes.filter((i) => {
      if (!i.date.startsWith(currentMonth)) return false;
      if (activePayCycle === 'MONTHLY') return true;
      return getPayCycleFromDate(i.date) === activePayCycle;
    });

    // Calculate totals
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome =
      monthIncomes.reduce((sum, i) => sum + i.amount, 0) ||
      profile?.monthlyIncome ||
      0;

    // Calculate by category
    const activeObligations = obligations.filter(
      (o) => activePayCycle === 'MONTHLY' || o.payCycle === activePayCycle
    );
    const committed = activeObligations.filter((o) => !o.isPaid).reduce((sum, o) => sum + o.amount, 0);

    const byCategory: Record<CategoryType, number> = {} as Record<
      CategoryType,
      number
    >;
    CATEGORIES.forEach((cat) => {
      byCategory[cat.id] = 0;
    });

    monthExpenses.forEach((expense) => {
      byCategory[expense.category] =
        (byCategory[expense.category] || 0) + expense.amount;
    });

    const freeAvailable = totalIncome - committed - totalExpenses;

    const monthlyStats: MonthlyStats = {
      month: currentMonth,
      payCycle: activePayCycle,
      totalIncome,
      totalExpenses,
      savings: totalIncome - totalExpenses,
      committed,
      freeAvailable,
      byCategory,
    };

    // Update budget spent amounts
    const monthBudgets = budgets.filter((b) => b.month === currentMonth);
    const updatedBudgets = monthBudgets.map((budget) => ({
      ...budget,
      spent: byCategory[budget.category] || 0,
    }));

    // Persist updated budget spent amounts to IndexedDB (non-blocking)
    updatedBudgets.forEach((budget) => {
      budgetsDB.update(budget).catch((err) => 
        console.error('Failed to sync budget spent:', err)
      );
    });

    // Calculate budget adherence
    const budgetAdherence = updatedBudgets.length
      ? updatedBudgets.reduce((sum, b) => {
          const ratio = b.limit > 0 ? Math.min(100, (b.spent / b.limit) * 100) : 100;
          return sum + (100 - Math.max(0, ratio - 100));
        }, 0) / updatedBudgets.length
      : 100;

    // Calculate goal progress
    const goalProgress = goals.length
      ? goals.reduce((sum, g) => {
          return sum + (g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0);
        }, 0) / goals.length
      : 0;

    // Calculate financial health
    const financialHealth = calculateFinancialHealth(
      totalIncome,
      totalExpenses,
      goalProgress,
      budgetAdherence
    );

    set({
      monthlyStats,
      financialHealth,
      budgets: budgets.map((b) => {
        const updated = updatedBudgets.find((ub) => ub.id === b.id);
        return updated || b;
      }),
    });
  },

  setCurrentMonth: (month: string) => {
    set({ currentMonth: month });
    get().recalculateStats();
  },
  
  setActivePayCycle: (cycle: string) => {
    set({ activePayCycle: cycle as any });
    get().recalculateStats();
  },
});
