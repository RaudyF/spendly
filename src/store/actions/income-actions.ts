import { Income } from '@/types';
import { incomesDB } from '@/lib/db';
import { generateId, getPayCycleFromDate } from '@/lib/utils';
import { StoreSet, StoreGet } from '../types';
import { isSalaryIncome } from './stats-actions';

export const createIncomeActions = (set: StoreSet, get: StoreGet) => ({
  addIncome: async (incomeData: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>) => {
    const period = incomeData.date.slice(0, 7);
    const cycle = incomeData.payCycle || getPayCycleFromDate(incomeData.date);

    if (get().isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden registrar ingresos en un período cerrado (${period} ${cycle || ''}). Reabre el período primero.`);
    }

    // Si es tipo salario, evitar duplicar confirmaciones para la misma quincena y mes
    if (incomeData.type === 'salary') {
      const existingSalary = get().incomes.find(
        (i) =>
          isSalaryIncome(i) &&
          i.date.startsWith(period) &&
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

    get().enqueuePendingChange({
      entityType: 'income',
      action: 'create',
      entityId: income.id,
      payload: income,
    }).catch(console.error);

    get().recalculateStats();
    return income;
  },

  updateIncome: async (id: string, updates: Partial<Income>) => {
    const income = get().incomes.find((i) => i.id === id);
    if (!income) return;

    const currentPeriod = income.date.slice(0, 7);
    const currentCycle = income.payCycle || getPayCycleFromDate(income.date);
    if (get().isPeriodClosed(currentPeriod, currentCycle)) {
      throw new Error(`No se pueden modificar ingresos de un período cerrado (${currentPeriod} ${currentCycle || ''}). Reabre el período primero.`);
    }

    if (updates.date || updates.payCycle) {
      const targetPeriod = updates.date ? updates.date.slice(0, 7) : currentPeriod;
      const targetCycle = updates.payCycle || (updates.date ? getPayCycleFromDate(updates.date) : currentCycle);
      if (get().isPeriodClosed(targetPeriod, targetCycle)) {
        throw new Error(`No se puede mover un ingreso a un período cerrado (${targetPeriod} ${targetCycle || ''}).`);
      }
    }

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

    get().enqueuePendingChange({
      entityType: 'income',
      action: 'update',
      entityId: id,
      payload: updated,
    }).catch(console.error);

    get().recalculateStats();
  },

  deleteIncome: async (id: string) => {
    const income = get().incomes.find((i) => i.id === id);
    if (!income) return;

    const period = income.date.slice(0, 7);
    const cycle = income.payCycle || getPayCycleFromDate(income.date);
    if (get().isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden eliminar ingresos de un período cerrado (${period} ${cycle || ''}). Reabre el período primero.`);
    }

    set((state) => ({
      incomes: state.incomes.filter((i) => i.id !== id),
    }));

    try {
      await incomesDB.delete(id);
    } catch (error) {
      console.error('Failed to delete income:', error);
    }

    get().enqueuePendingChange({
      entityType: 'income',
      action: 'delete',
      entityId: id,
    }).catch(console.error);

    get().recalculateStats();
  },
});
