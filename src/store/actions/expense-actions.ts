import { Expense } from '@/types';
import { expensesDB } from '@/lib/db';
import { generateId, getPayCycleFromDate } from '@/lib/utils';
import { StoreSet, StoreGet } from '../types';

export const createExpenseActions = (set: StoreSet, get: StoreGet) => ({
  addExpense: async (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    const period = expenseData.financialPeriod || expenseData.date.slice(0, 7);
    const cycle = expenseData.payCycle || getPayCycleFromDate(expenseData.date);

    if (get().isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden registrar gastos en un período cerrado (${period} ${cycle || ''}). Reabre el período primero.`);
    }

    const now = new Date().toISOString();
    const expense: Expense = {
      ...expenseData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      expenses: [...state.expenses, expense],
    }));

    try {
      await expensesDB.add(expense);
    } catch (error) {
      console.error('Failed to persist expense:', error);
    }

    get().enqueuePendingChange({
      entityType: 'expense',
      action: 'create',
      entityId: expense.id,
      payload: expense,
    }).catch(console.error);

    get().recalculateStats();
    return expense;
  },

  updateExpense: async (id: string, updates: Partial<Expense>) => {
    const expense = get().expenses.find((e) => e.id === id);
    if (!expense) return;

    const currentPeriod = expense.financialPeriod || expense.date.slice(0, 7);
    const currentCycle = expense.payCycle || getPayCycleFromDate(expense.date);
    if (get().isPeriodClosed(currentPeriod, currentCycle)) {
      throw new Error(`No se pueden modificar gastos de un período cerrado (${currentPeriod} ${currentCycle || ''}). Reabre el período primero.`);
    }

    if (updates.date || updates.financialPeriod || updates.payCycle) {
      const targetPeriod = updates.financialPeriod || (updates.date ? updates.date.slice(0, 7) : currentPeriod);
      const targetCycle = updates.payCycle || (updates.date ? getPayCycleFromDate(updates.date) : currentCycle);
      if (get().isPeriodClosed(targetPeriod, targetCycle)) {
        throw new Error(`No se puede mover un gasto a un período cerrado (${targetPeriod} ${targetCycle || ''}).`);
      }
    }

    const updated = {
      ...expense,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === id ? updated : e)),
    }));

    try {
      await expensesDB.update(updated);
    } catch (error) {
      console.error('Failed to update expense:', error);
    }

    get().enqueuePendingChange({
      entityType: 'expense',
      action: 'update',
      entityId: id,
      payload: updated,
    }).catch(console.error);

    get().recalculateStats();
  },

  deleteExpense: async (id: string) => {
    const expense = get().expenses.find((e) => e.id === id);
    if (!expense) return;

    const period = expense.financialPeriod || expense.date.slice(0, 7);
    const cycle = expense.payCycle || getPayCycleFromDate(expense.date);
    if (get().isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden eliminar gastos de un período cerrado (${period} ${cycle || ''}). Reabre el período primero.`);
    }

    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id),
    }));

    try {
      await expensesDB.delete(id);
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }

    get().enqueuePendingChange({
      entityType: 'expense',
      action: 'delete',
      entityId: id,
    }).catch(console.error);

    get().recalculateStats();
  },
});
