import { Income } from '@/types';
import { incomesDB } from '@/lib/db';
import { generateId, getPayCycleFromDate } from '@/lib/utils';
import { StoreSet, StoreGet } from '../types';
import { isSalaryIncome } from './stats-actions';

export const createIncomeActions = (set: StoreSet, get: StoreGet) => ({
  addIncome: async (incomeData: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Si es tipo salario, evitar duplicar confirmaciones para la misma quincena y mes
    if (incomeData.type === 'salary') {
      const cycle = incomeData.payCycle || getPayCycleFromDate(incomeData.date);
      const month = incomeData.date.slice(0, 7);
      const existingSalary = get().incomes.find(
        (i) =>
          isSalaryIncome(i) &&
          i.date.startsWith(month) &&
          (i.payCycle || getPayCycleFromDate(i.date)) === cycle
      );
      if (existingSalary) {
        return existingSalary;
      }
    }

    const now = new Date().toISOString();
    const income: Income = {
      ...incomeData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      incomes: [...state.incomes, income],
    }));

    try {
      await incomesDB.add(income);
    } catch (error) {
      console.error('Failed to persist income:', error);
    }

    get().recalculateStats();
    return income;
  },

  updateIncome: async (id: string, updates: Partial<Income>) => {
    const income = get().incomes.find((i) => i.id === id);
    if (!income) return;

    const updated = {
      ...income,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      incomes: state.incomes.map((i) => (i.id === id ? updated : i)),
    }));

    try {
      await incomesDB.update(updated);
    } catch (error) {
      console.error('Failed to update income:', error);
    }

    get().recalculateStats();
  },

  deleteIncome: async (id: string) => {
    set((state) => ({
      incomes: state.incomes.filter((i) => i.id !== id),
    }));

    try {
      await incomesDB.delete(id);
    } catch (error) {
      console.error('Failed to delete income:', error);
    }

    get().recalculateStats();
  },
});
