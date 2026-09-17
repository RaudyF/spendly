import { AIInsight, CategoryType, MonthlyStats, Income, UserProfile, PayCycle } from '@/types';
import { budgetsDB, insightsDB } from '@/lib/db';
import { getPayCycleFromDate, generateId } from '@/lib/utils';
import { CATEGORIES } from '@/lib/constants';
import { generateLocalInsights, calculateFinancialHealth } from '@/lib/ai';
import { getObligationRemainingAmount } from '@/lib/obligations';
import { StoreSet, StoreGet } from '../types';

export const getObligationRemaining = getObligationRemainingAmount;

export function isSalaryIncome(i: Income): boolean {
  if (i.type === 'salary') return true;
  if (i.type === 'additional') return false;
  const src = (i.source || '').toLowerCase();
  return (
    src.includes('sueldo') ||
    src.includes('salario') ||
    src.includes('nomina') ||
    src.includes('nómina') ||
    src.includes('quincena')
  );
}

export function getSalaryQuotas(profile: UserProfile | null) {
  const freq = profile?.incomeFrequency || 'monthly';
  const monthlyIncome = profile?.monthlyIncome || 0;

  let q1Quota = 0;
  let q2Quota = 0;
  let monthQuota = 0;

  if (freq === 'monthly') {
    q1Quota = Math.round((monthlyIncome / 2) * 100) / 100;
    q2Quota = Math.round((monthlyIncome - q1Quota) * 100) / 100;
    monthQuota = monthlyIncome;
  } else if (freq === 'biweekly') {
    q1Quota = monthlyIncome;
    q2Quota = monthlyIncome;
    monthQuota = monthlyIncome * 2;
  } else {
    q1Quota = 0;
    q2Quota = 0;
    monthQuota = 0;
  }

  return { q1Quota, q2Quota, monthQuota, freq };
}

export function computeIncomeAndAvailability({
  incomes,
  profile,
  viewingPeriod,
  activePayCycle,
  totalExpenses,
  committed,
  initialBalance = 0,
}: {
  incomes: Income[];
  profile: UserProfile | null;
  viewingPeriod: string;
  activePayCycle: PayCycle;
  totalExpenses: number;
  committed: number;
  initialBalance?: number;
}) {
  const { q1Quota, q2Quota, monthQuota, freq } = getSalaryQuotas(profile);

  // Filtrar todos los ingresos del mes actual
  const allMonthIncomes = incomes.filter((i) => i.date.startsWith(viewingPeriod));

  // Agrupar por ciclo
  const q1Incomes = allMonthIncomes.filter(
    (i) => (i.payCycle || getPayCycleFromDate(i.date)) === 'Q1'
  );
  const q2Incomes = allMonthIncomes.filter(
    (i) => (i.payCycle || getPayCycleFromDate(i.date)) === 'Q2'
  );

  // Cálculos Q1
  const q1Salary = q1Incomes.filter(isSalaryIncome).reduce((sum, i) => sum + i.amount, 0);
  const q1Additional = q1Incomes.filter((i) => !isSalaryIncome(i)).reduce((sum, i) => sum + i.amount, 0);
  const q1Received = q1Salary + q1Additional;
  const q1Pending = freq === 'variable' ? 0 : Math.max(0, q1Quota - q1Salary);

  // Cálculos Q2
  const q2Salary = q2Incomes.filter(isSalaryIncome).reduce((sum, i) => sum + i.amount, 0);
  const q2Additional = q2Incomes.filter((i) => !isSalaryIncome(i)).reduce((sum, i) => sum + i.amount, 0);
  const q2Received = q2Salary + q2Additional;
  const q2Pending = freq === 'variable' ? 0 : Math.max(0, q2Quota - q2Salary);

  // Totales del mes completo
  const monthSalary = q1Salary + q2Salary;
  const monthAdditional = q1Additional + q2Additional;
  const monthReceived = monthSalary + monthAdditional;
  const monthPending = q1Pending + q2Pending;

  // Valores para la vista activa
  let salaryReceived = 0;
  let additionalReceived = 0;
  let receivedIncome = 0;
  let baseSalaryExpected = 0;
  let pendingSalary = 0;
  let expectedIncome = 0;

  if (activePayCycle === 'Q1') {
    salaryReceived = q1Salary;
    additionalReceived = q1Additional;
    receivedIncome = q1Received;
    baseSalaryExpected = q1Quota;
    pendingSalary = q1Pending;
    expectedIncome = freq === 'variable' ? receivedIncome : q1Quota + q1Additional;
  } else if (activePayCycle === 'Q2') {
    salaryReceived = q2Salary;
    additionalReceived = q2Additional;
    receivedIncome = q2Received;
    baseSalaryExpected = q2Quota;
    pendingSalary = q2Pending;
    expectedIncome = freq === 'variable' ? receivedIncome : q2Quota + q2Additional;
  } else {
    salaryReceived = monthSalary;
    additionalReceived = monthAdditional;
    receivedIncome = monthReceived;
    baseSalaryExpected = monthQuota;
    pendingSalary = monthPending;
    expectedIncome = freq === 'variable' ? receivedIncome : monthQuota + monthAdditional;
  }

  // Disponible libre real se calcula con dinero realmente recibido + balance inicial por arrastre
  const realFreeAvailable = receivedIncome + initialBalance - totalExpenses - committed;

  // Disponible proyectado incluye el ingreso esperado + balance inicial
  const projectedFreeAvailable = expectedIncome + initialBalance - totalExpenses - committed;

  return {
    salaryReceived,
    additionalReceived,
    receivedIncome,
    baseSalaryExpected,
    pendingSalary,
    expectedIncome,
    initialBalance,
    realFreeAvailable,
    projectedFreeAvailable,
    q1BaseStats: {
      expectedSalary: q1Quota,
      salaryReceived: q1Salary,
      additionalReceived: q1Additional,
      receivedIncome: q1Received,
      pendingSalary: q1Pending,
    },
    q2BaseStats: {
      expectedSalary: q2Quota,
      salaryReceived: q2Salary,
      additionalReceived: q2Additional,
      receivedIncome: q2Received,
      pendingSalary: q2Pending,
    },
  };
}

export const createStatsActions = (set: StoreSet, get: StoreGet) => ({
  refreshInsights: () => {
    const { expenses, incomes, obligations, profile, viewingPeriod, activePayCycle } = get();

    // Filtrar gastos por período financiero y ciclo activo
    const monthExpenses = expenses.filter((e) => {
      if (e.status === 'reverted') return false;
      const expensePeriod = e.financialPeriod || e.date.slice(0, 7);
      if (expensePeriod !== viewingPeriod) return false;
      if (activePayCycle === 'MONTHLY') return true;
      const cycle = e.payCycle || getPayCycleFromDate(e.date);
      return cycle === activePayCycle;
    });

    const activeObligations = obligations.filter((o) => {
      const obligationPeriod = o.period || (o.dueDate || o.createdAt).slice(0, 7);
      if (obligationPeriod !== viewingPeriod) return false;
      if (activePayCycle === 'MONTHLY') return true;
      return o.payCycle === activePayCycle;
    });
    const committed = activeObligations.reduce((sum, o) => sum + getObligationRemainingAmount(o, expenses), 0);

    const byCategory: Record<CategoryType, number> = {} as Record<CategoryType, number>;
    CATEGORIES.forEach((cat) => {
      byCategory[cat.id] = 0;
    });

    monthExpenses.forEach((expense) => {
      byCategory[expense.category] = (byCategory[expense.category] || 0) + expense.amount;
    });

    const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const q1Expenses = expenses
      .filter((e) => e.status !== 'reverted' && (e.financialPeriod || e.date.slice(0, 7)) === viewingPeriod && (e.payCycle || getPayCycleFromDate(e.date)) === 'Q1')
      .reduce((sum, e) => sum + e.amount, 0);
    const q2Expenses = expenses
      .filter((e) => e.status !== 'reverted' && (e.financialPeriod || e.date.slice(0, 7)) === viewingPeriod && (e.payCycle || getPayCycleFromDate(e.date)) === 'Q2')
      .reduce((sum, e) => sum + e.amount, 0);

    const q1Committed = obligations
      .filter((o) => (o.period || (o.dueDate || o.createdAt).slice(0, 7)) === viewingPeriod && o.payCycle === 'Q1')
      .reduce((sum, o) => sum + getObligationRemainingAmount(o, expenses), 0);
    const q2Committed = obligations
      .filter((o) => (o.period || (o.dueDate || o.createdAt).slice(0, 7)) === viewingPeriod && o.payCycle === 'Q2')
      .reduce((sum, o) => sum + getObligationRemainingAmount(o, expenses), 0);

    const { periodRollovers } = get();
    let initialBalance = 0;
    if (activePayCycle === 'MONTHLY') {
      initialBalance = periodRollovers
        .filter(
          (ro) =>
            ro.destinationPeriod === viewingPeriod &&
            ro.sourcePeriod !== viewingPeriod &&
            ro.status === 'applied'
        )
        .reduce((sum, ro) => sum + ro.amount, 0);
    } else if (activePayCycle === 'Q1') {
      initialBalance = periodRollovers
        .filter(
          (ro) =>
            ro.destinationPeriod === viewingPeriod &&
            (ro.destinationCycle === 'Q1' || (ro.destinationCycle === 'MONTHLY' && ro.sourcePeriod !== viewingPeriod)) &&
            ro.status === 'applied'
        )
        .reduce((sum, ro) => sum + ro.amount, 0);
    } else {
      initialBalance = periodRollovers
        .filter(
          (ro) =>
            ro.destinationPeriod === viewingPeriod &&
            ro.destinationCycle === 'Q2' &&
            ro.status === 'applied'
        )
        .reduce((sum, ro) => sum + ro.amount, 0);
    }

    const incomeCalc = computeIncomeAndAvailability({
      incomes,
      profile,
      viewingPeriod,
      activePayCycle,
      totalExpenses,
      committed,
      initialBalance,
    });

    const q1Stats = {
      income: incomeCalc.q1BaseStats.receivedIncome,
      expectedSalary: incomeCalc.q1BaseStats.expectedSalary,
      salaryReceived: incomeCalc.q1BaseStats.salaryReceived,
      additionalReceived: incomeCalc.q1BaseStats.additionalReceived,
      receivedIncome: incomeCalc.q1BaseStats.receivedIncome,
      pendingSalary: incomeCalc.q1BaseStats.pendingSalary,
      expenses: q1Expenses,
      committed: q1Committed,
      freeAvailable: incomeCalc.q1BaseStats.receivedIncome - q1Expenses - q1Committed,
    };

    const q2Stats = {
      income: incomeCalc.q2BaseStats.receivedIncome,
      expectedSalary: incomeCalc.q2BaseStats.expectedSalary,
      salaryReceived: incomeCalc.q2BaseStats.salaryReceived,
      additionalReceived: incomeCalc.q2BaseStats.additionalReceived,
      receivedIncome: incomeCalc.q2BaseStats.receivedIncome,
      pendingSalary: incomeCalc.q2BaseStats.pendingSalary,
      expenses: q2Expenses,
      committed: q2Committed,
      freeAvailable: incomeCalc.q2BaseStats.receivedIncome - q2Expenses - q2Committed,
    };

    const currentStats: MonthlyStats = {
      month: viewingPeriod,
      payCycle: activePayCycle,
      totalIncome: incomeCalc.receivedIncome,
      receivedIncome: incomeCalc.receivedIncome,
      expectedIncome: incomeCalc.expectedIncome,
      salaryReceived: incomeCalc.salaryReceived,
      additionalReceived: incomeCalc.additionalReceived,
      baseSalaryExpected: incomeCalc.baseSalaryExpected,
      pendingSalary: incomeCalc.pendingSalary,
      totalExpenses,
      savings: incomeCalc.receivedIncome - totalExpenses,
      committed,
      freeAvailable: incomeCalc.realFreeAvailable,
      projectedFreeAvailable: incomeCalc.projectedFreeAvailable,
      byCategory,
      q1Stats,
      q2Stats,
    };

    const insightTexts = generateLocalInsights(
      currentStats,
      monthExpenses,
      profile?.currency || 'RD$'
    );

    const newInsights: AIInsight[] = insightTexts.map((text) => ({
      id: generateId(),
      type: 'tip',
      title: 'Consejo Financiero',
      description: text,
      createdAt: new Date().toISOString(),
      isRead: false,
      priority: 'medium',
    }));

    newInsights.forEach((insight) => {
      insightsDB.add(insight).catch(console.error);
    });

    set({
      insights: newInsights,
      monthlyStats: currentStats,
    });
  },

  dismissInsight: async (id: string) => {
    set((state) => ({
      insights: state.insights.map((i) =>
        i.id === id ? { ...i, isDismissed: true } : i
      ),
    }));

    try {
      const insight = get().insights.find((i) => i.id === id);
      if (insight) {
        await insightsDB.update(insight);
      }
    } catch (error) {
      console.error('Failed to dismiss insight in DB:', error);
    }
  },

  recalculateStats: () => {
    const { expenses, incomes, obligations, budgets, goals, periodRollovers, profile, viewingPeriod, activePayCycle } = get();

    // Filtrar gastos por período financiero y ciclo activo
    const monthExpenses = expenses.filter((e) => {
      if (e.status === 'reverted') return false;
      const expensePeriod = e.financialPeriod || e.date.slice(0, 7);
      if (expensePeriod !== viewingPeriod) return false;
      if (activePayCycle === 'MONTHLY') return true;
      const cycle = e.payCycle || getPayCycleFromDate(e.date);
      return cycle === activePayCycle;
    });

    const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const activeObligations = obligations.filter((o) => {
      const obligationPeriod = o.period || (o.dueDate || o.createdAt).slice(0, 7);
      if (obligationPeriod !== viewingPeriod) return false;
      if (activePayCycle === 'MONTHLY') return true;
      return o.payCycle === activePayCycle;
    });
    const committed = activeObligations.reduce((sum, o) => sum + getObligationRemainingAmount(o, expenses), 0);

    const byCategory: Record<CategoryType, number> = {} as Record<CategoryType, number>;
    CATEGORIES.forEach((cat) => {
      byCategory[cat.id] = 0;
    });

    monthExpenses.forEach((expense) => {
      byCategory[expense.category] = (byCategory[expense.category] || 0) + expense.amount;
    });

    const q1Expenses = expenses
      .filter((e) => e.status !== 'reverted' && (e.financialPeriod || e.date.slice(0, 7)) === viewingPeriod && (e.payCycle || getPayCycleFromDate(e.date)) === 'Q1')
      .reduce((sum, e) => sum + e.amount, 0);
    const q2Expenses = expenses
      .filter((e) => e.status !== 'reverted' && (e.financialPeriod || e.date.slice(0, 7)) === viewingPeriod && (e.payCycle || getPayCycleFromDate(e.date)) === 'Q2')
      .reduce((sum, e) => sum + e.amount, 0);

    const q1Committed = obligations
      .filter((o) => (o.period || (o.dueDate || o.createdAt).slice(0, 7)) === viewingPeriod && o.payCycle === 'Q1')
      .reduce((sum, o) => sum + getObligationRemainingAmount(o, expenses), 0);
    const q2Committed = obligations
      .filter((o) => (o.period || (o.dueDate || o.createdAt).slice(0, 7)) === viewingPeriod && o.payCycle === 'Q2')
      .reduce((sum, o) => sum + getObligationRemainingAmount(o, expenses), 0);

    // Initial balances from applied rollovers
    const rolloversList = periodRollovers || [];
    const q1InitialBalance = rolloversList
      .filter((ro) => ro.destinationPeriod === viewingPeriod && ro.destinationCycle === 'Q1' && ro.status === 'applied')
      .reduce((sum, ro) => sum + ro.amount, 0);

    const q2InitialBalance = rolloversList
      .filter((ro) => ro.destinationPeriod === viewingPeriod && ro.destinationCycle === 'Q2' && ro.status === 'applied')
      .reduce((sum, ro) => sum + ro.amount, 0);

    // Anti-double-counting rule for Monthly: only rollovers coming from previous months
    const monthInitialBalance = rolloversList
      .filter((ro) => ro.destinationPeriod === viewingPeriod && ro.sourcePeriod !== viewingPeriod && ro.status === 'applied')
      .reduce((sum, ro) => sum + ro.amount, 0);

    let activeInitialBalance = 0;
    if (activePayCycle === 'Q1') activeInitialBalance = q1InitialBalance;
    else if (activePayCycle === 'Q2') activeInitialBalance = q2InitialBalance;
    else activeInitialBalance = monthInitialBalance;

    const incomeCalc = computeIncomeAndAvailability({
      incomes,
      profile,
      viewingPeriod,
      activePayCycle,
      totalExpenses,
      committed,
      initialBalance: activeInitialBalance,
    });

    const q1Stats = {
      income: incomeCalc.q1BaseStats.receivedIncome,
      expectedSalary: incomeCalc.q1BaseStats.expectedSalary,
      salaryReceived: incomeCalc.q1BaseStats.salaryReceived,
      additionalReceived: incomeCalc.q1BaseStats.additionalReceived,
      receivedIncome: incomeCalc.q1BaseStats.receivedIncome,
      pendingSalary: incomeCalc.q1BaseStats.pendingSalary,
      expenses: q1Expenses,
      committed: q1Committed,
      freeAvailable: incomeCalc.q1BaseStats.receivedIncome + q1InitialBalance - q1Expenses - q1Committed,
      initialBalance: q1InitialBalance,
    };

    const q2Stats = {
      income: incomeCalc.q2BaseStats.receivedIncome,
      expectedSalary: incomeCalc.q2BaseStats.expectedSalary,
      salaryReceived: incomeCalc.q2BaseStats.salaryReceived,
      additionalReceived: incomeCalc.q2BaseStats.additionalReceived,
      receivedIncome: incomeCalc.q2BaseStats.receivedIncome,
      pendingSalary: incomeCalc.q2BaseStats.pendingSalary,
      expenses: q2Expenses,
      committed: q2Committed,
      freeAvailable: incomeCalc.q2BaseStats.receivedIncome + q2InitialBalance - q2Expenses - q2Committed,
      initialBalance: q2InitialBalance,
    };

    const monthlyStats: MonthlyStats = {
      month: viewingPeriod,
      payCycle: activePayCycle,
      totalIncome: incomeCalc.receivedIncome,
      receivedIncome: incomeCalc.receivedIncome,
      expectedIncome: incomeCalc.expectedIncome,
      salaryReceived: incomeCalc.salaryReceived,
      additionalReceived: incomeCalc.additionalReceived,
      baseSalaryExpected: incomeCalc.baseSalaryExpected,
      pendingSalary: incomeCalc.pendingSalary,
      totalExpenses,
      savings: incomeCalc.receivedIncome - totalExpenses,
      committed,
      freeAvailable: incomeCalc.realFreeAvailable,
      projectedFreeAvailable: incomeCalc.projectedFreeAvailable,
      byCategory,
      q1Stats,
      q2Stats,
      initialBalance: activeInitialBalance,
    };

    // Update budget spent amounts
    const monthBudgets = budgets.filter((b) => b.month === viewingPeriod);
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
      monthlyStats.receivedIncome || monthlyStats.expectedIncome,
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
    set({ currentMonth: month, viewingPeriod: month });
    get().recalculateStats();
  },
  setViewingPeriod: (period: string) => {
    set({ viewingPeriod: period });
    get().recalculateStats();
  },
  
  setActivePayCycle: (cycle: string) => {
    set({ activePayCycle: cycle as any });
    get().recalculateStats();
  },
});
