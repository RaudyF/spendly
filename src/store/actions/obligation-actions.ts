import { Obligation } from '@/types';
import { obligationsDB } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { StoreSet, StoreGet } from '../types';

export const createObligationActions = (set: StoreSet, get: StoreGet) => ({
  addObligation: async (obligationData: Omit<Obligation, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const obligation: Obligation = {
      ...obligationData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      obligations: [...state.obligations, obligation],
    }));

    try {
      await obligationsDB.add(obligation);
      if (obligation.isPaid) {
         await get().addExpense({
            amount: obligation.amount,
            description: obligation.name,
            category: obligation.category,
            date: now.split('T')[0],
            payCycle: obligation.payCycle,
            obligationId: obligation.id,
         });
      }
    } catch (error) {
      console.error('Failed to save obligation to DB:', error);
    }

    get().recalculateStats();
    return obligation;
  },

  updateObligation: async (id: string, updates: Partial<Obligation>) => {
    const now = new Date().toISOString();
    
    // Check if we need to create/delete an expense for this obligation
    const existing = get().obligations.find((o) => o.id === id);
    if (!existing) return;
    
    set((state) => ({
      obligations: state.obligations.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: now } : o
      ),
    }));

    try {
      const updated = get().obligations.find((o) => o.id === id);
      if (updated) {
        await obligationsDB.update(updated);
        
        // Handle linked expense creation/deletion/update when isPaid or other fields change
        const existingExpense = get().expenses.find(e => e.obligationId === id);
        
        if (updates.isPaid !== undefined) {
           if (updates.isPaid === true && !existingExpense) {
              await get().addExpense({
                 amount: updated.amount,
                 description: updated.name,
                 category: updated.category,
                 date: now.split('T')[0],
                 payCycle: updated.payCycle,
                 obligationId: id,
              });
           } else if (updates.isPaid === false && existingExpense) {
              await get().deleteExpense(existingExpense.id);
           }
        } else if (existingExpense) {
           // If it's already paid and we are updating the obligation's details, sync the expense
           const expenseUpdates: any = {};
           if (updates.amount !== undefined) expenseUpdates.amount = updates.amount;
           if (updates.name !== undefined) expenseUpdates.description = updates.name;
           if (updates.category !== undefined) expenseUpdates.category = updates.category;
           if (updates.payCycle !== undefined) expenseUpdates.payCycle = updates.payCycle;
           
           if (Object.keys(expenseUpdates).length > 0) {
              await get().updateExpense(existingExpense.id, expenseUpdates);
           }
        }
      }
    } catch (error) {
      console.error('Failed to update obligation in DB:', error);
    }

    get().recalculateStats();
  },

  deleteObligation: async (id: string) => {
    set((state) => ({
      obligations: state.obligations.filter((o) => o.id !== id),
    }));

    try {
      await obligationsDB.delete(id);
      
      const existingExpense = get().expenses.find(e => e.obligationId === id);
      if (existingExpense) {
         await get().deleteExpense(existingExpense.id);
      }
    } catch (error) {
      console.error('Failed to delete obligation from DB:', error);
    }

    get().recalculateStats();
  },
});
