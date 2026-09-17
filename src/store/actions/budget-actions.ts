import { Budget, CategoryType } from '@/types';
import { budgetsDB } from '@/lib/db';
import { generateId, getCurrentMonth } from '@/lib/utils';
import { CATEGORIES, BUDGET_DEFAULTS } from '@/lib/constants';
import { StoreSet, StoreGet } from '../types';

export const createBudgetActions = (set: StoreSet, get: StoreGet) => ({
  setBudget: async (category: CategoryType, limit: number) => {
    const month = get().viewingPeriod;

    if (get().isPeriodClosed(month, 'MONTHLY')) {
      throw new Error(`No se pueden ajustar presupuestos en un período cerrado (${month}). Reabre el período primero.`);
    }

    const now = new Date().toISOString();
    const existingList = get().budgets.filter(
      (b) => b.category === category && b.month === month
    );

    if (existingList.length > 0) {
      const primary = existingList[0];
      const updated: Budget = { ...primary, limit, updatedAt: now };

      // Delete any duplicates in DB
      for (let i = 1; i < existingList.length; i++) {
        try {
          await budgetsDB.delete(existingList[i].id);
        } catch (e) {
          console.error('Failed to remove duplicate budget:', e);
        }
      }

      set((state) => ({
        budgets: [
          ...state.budgets.filter(
            (b) => !(b.category === category && b.month === month)
          ),
          updated,
        ],
      }));

      try {
        await budgetsDB.update(updated);
      } catch (error) {
        console.error('Failed to update budget:', error);
      }

      get().enqueuePendingChange({
        entityType: 'budget',
        action: 'update',
        entityId: updated.id,
        payload: updated,
      }).catch(console.error);
    } else {
      const budget: Budget = {
        id: generateId(),
        category,
        limit,
        spent: 0,
        month,
        createdAt: now,
        updatedAt: now,
      };

      set((state) => ({
        budgets: [...state.budgets, budget],
      }));

      try {
        await budgetsDB.add(budget);
      } catch (error) {
        console.error('Failed to add budget:', error);
      }

      get().enqueuePendingChange({
        entityType: 'budget',
        action: 'create',
        entityId: budget.id,
        payload: budget,
      }).catch(console.error);
    }

    get().recalculateStats();
  },

  initializeDefaultBudgets: async (monthlyIncome: number) => {
    const month = getCurrentMonth();
    const now = new Date().toISOString();

    const existingForMonth = get().budgets.filter((b) => b.month === month);

    // If budgets already exist for the month, remove them first from DB to prevent duplication
    for (const b of existingForMonth) {
      try {
        await budgetsDB.delete(b.id);
      } catch (e) {
        console.error('Failed to clean up old budget before init:', e);
      }
    }

    const newBudgets: Budget[] = CATEGORIES.map((cat) => ({
      id: generateId(),
      category: cat.id,
      limit: Math.round(monthlyIncome * (BUDGET_DEFAULTS[cat.id] / 100)),
      spent: 0,
      month,
      createdAt: now,
      updatedAt: now,
    }));

    for (const budget of newBudgets) {
      await budgetsDB.add(budget);
    }

    set((state) => ({
      budgets: [
        ...state.budgets.filter((b) => b.month !== month),
        ...newBudgets,
      ],
    }));

    get().enqueuePendingChange({
      entityType: 'budget',
      action: 'create',
      entityId: 'batch_defaults_' + month,
      payload: newBudgets,
    }).catch(console.error);

    get().recalculateStats();
  },
});
