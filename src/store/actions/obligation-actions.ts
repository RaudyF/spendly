import { Obligation } from '@/types';
import { obligationsDB } from '@/lib/db';
import { generateId, getPayCycleFromDate } from '@/lib/utils';
import {
  getObligationPaidAmount,
  calculateObligationEffectiveStatus,
  calculateSafeDueDateString,
  buildIdempotencyKey,
  isTemplateApplicableToPeriod,
} from '@/lib/obligations';
import { StoreSet, StoreGet } from '../types';

// Mutex / in-flight lock to prevent duplicate concurrent generation requests
const activeGenerationLocks = new Set<string>();

export const createObligationActions = (set: StoreSet, get: StoreGet) => ({
  addObligation: async (obligationData: Omit<Obligation, 'id' | 'createdAt' | 'updatedAt'>) => {
    const period = obligationData.period || (obligationData.dueDate || '').slice(0, 7);
    const cycle = obligationData.payCycle;

    if (get().isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden registrar obligaciones en un período cerrado (${period} ${cycle || ''}). Reabre el período primero.`);
    }

    const now = new Date().toISOString();
    const initialStatus = obligationData.status || (obligationData.isPaid ? 'paid' : 'pending');
    const obligation: Obligation = {
      ...obligationData,
      id: generateId(),
      status: initialStatus,
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
          description: `Pago: ${obligation.name}`,
          category: obligation.category,
          date: now.split('T')[0],
          realDate: now.split('T')[0],
          financialPeriod: obligation.period,
          payCycle: obligation.payCycle,
          obligationId: obligation.id,
          status: 'active',
          source: 'obligation_initial',
        });
      }
    } catch (error) {
      console.error('Failed to save obligation to DB:', error);
    }

    get().enqueuePendingChange({
      entityType: 'obligation',
      action: 'create',
      entityId: obligation.id,
      payload: obligation,
    }).catch(console.error);

    get().recalculateStats();
    return obligation;
  },

  updateObligation: async (id: string, updates: Partial<Obligation>) => {
    const existing = get().obligations.find((o) => o.id === id);
    if (!existing) return;

    const currentPeriod = existing.period || (existing.dueDate || '').slice(0, 7);
    const currentCycle = existing.payCycle;
    if (get().isPeriodClosed(currentPeriod, currentCycle)) {
      throw new Error(`No se pueden modificar obligaciones de un período cerrado (${currentPeriod} ${currentCycle || ''}). Reabre el período primero.`);
    }

    if (updates.period || updates.dueDate || updates.payCycle) {
      const targetPeriod = updates.period || (updates.dueDate ? updates.dueDate.slice(0, 7) : currentPeriod);
      const targetCycle = updates.payCycle || currentCycle;
      if (get().isPeriodClosed(targetPeriod, targetCycle)) {
        throw new Error(`No se puede mover una obligación a un período cerrado (${targetPeriod} ${targetCycle || ''}).`);
      }
    }

    const now = new Date().toISOString();
    set((state) => ({
      obligations: state.obligations.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: now } : o
      ),
    }));

    try {
      const updated = get().obligations.find((o) => o.id === id);
      if (updated) {
        await obligationsDB.update(updated);

        get().enqueuePendingChange({
          entityType: 'obligation',
          action: 'update',
          entityId: id,
          payload: updated,
        }).catch(console.error);
      }
    } catch (error) {
      console.error('Failed to update obligation in DB:', error);
    }

    get().recalculateStats();
  },

  deleteObligation: async (id: string) => {
    const existing = get().obligations.find((o) => o.id === id);
    if (!existing) return;

    const period = existing.period || (existing.dueDate || '').slice(0, 7);
    const cycle = existing.payCycle;
    if (get().isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden eliminar obligaciones de un período cerrado (${period} ${cycle || ''}). Reabre el período primero.`);
    }

    // Preserva movimientos históricos: NO elimina gastos vinculados
    set((state) => ({
      obligations: state.obligations.filter((o) => o.id !== id),
    }));

    try {
      await obligationsDB.delete(id);
    } catch (error) {
      console.error('Failed to delete obligation from DB:', error);
    }

    get().enqueuePendingChange({
      entityType: 'obligation',
      action: 'delete',
      entityId: id,
    }).catch(console.error);

    get().recalculateStats();
  },

  cancelObligation: async (obligationId: string) => {
    const obligation = get().obligations.find((o) => o.id === obligationId);
    if (!obligation) return;

    const period = obligation.period || (obligation.dueDate || '').slice(0, 7);
    const cycle = obligation.payCycle;
    if (get().isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden cancelar obligaciones de un período cerrado (${period} ${cycle || ''}). Reabre el período primero.`);
    }

    await get().updateObligation(obligationId, { status: 'cancelled' });
  },

  addRecurringObligation: async (obligationData: Omit<import('@/types').RecurringObligation, 'id' | 'createdAt' | 'updatedAt'>) => {
    const { recurringObligationsDB } = await import('@/lib/db');
    const now = new Date().toISOString();
    const obligation: import('@/types').RecurringObligation = {
      ...obligationData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      recurringObligations: [...state.recurringObligations, obligation],
    }));

    try {
      await recurringObligationsDB.add(obligation);
    } catch (error) {
      console.error('Failed to save recurring obligation to DB:', error);
    }

    get().enqueuePendingChange({
      entityType: 'recurringObligation',
      action: 'create',
      entityId: obligation.id,
      payload: obligation,
    }).catch(console.error);

    // Si la plantilla es aplicable al mes que el usuario está viendo actualmente,
    // se asegura de reflejarla automáticamente de inmediato sin requerir clic manual
    const viewingPeriod = get().viewingPeriod;
    if (viewingPeriod && isTemplateApplicableToPeriod(obligation, viewingPeriod)) {
      try {
        await get().generatePeriodObligations(viewingPeriod);
      } catch (err) {
        console.error('Auto-generation of newly created recurring obligation failed:', err);
      }
    }

    return obligation;
  },

  updateRecurringObligation: async (id: string, updates: Partial<import('@/types').RecurringObligation>) => {
    const { recurringObligationsDB } = await import('@/lib/db');
    const now = new Date().toISOString();

    set((state) => ({
      recurringObligations: state.recurringObligations.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: now } : o
      ),
    }));

    try {
      const updated = get().recurringObligations.find((o) => o.id === id);
      if (updated) {
        await recurringObligationsDB.update(updated);

        get().enqueuePendingChange({
          entityType: 'recurringObligation',
          action: 'update',
          entityId: id,
          payload: updated,
        }).catch(console.error);

        // Si la plantilla actualizada tiene una instancia ya generada o pendiente en el mes actual que el usuario está viendo,
        // sincronizamos los datos no pagados para que el cambio de nombre, monto o fecha se refleje al instante.
        const viewingPeriod = get().viewingPeriod;
        if (viewingPeriod) {
          const currentObligations = get().obligations;
          const matchingObligation = currentObligations.find(
            (o) => o.templateId === id && o.period === viewingPeriod
          );

          if (matchingObligation) {
            // Si la instancia existe y no ha sido pagada ni tiene pagos parciales,
            // actualizamos sus datos para reflejar fielmente la edición de la plantilla.
            const expenses = get().expenses;
            const paidAmount = getObligationPaidAmount(matchingObligation.id, expenses);
            if (paidAmount === 0 && matchingObligation.status !== 'cancelled') {
              const safeDueDate = calculateSafeDueDateString(viewingPeriod, updated.dayOfMonth);
              await get().updateObligation(matchingObligation.id, {
                name: updated.name,
                amount: updated.amount,
                category: updated.category,
                payCycle: updated.payCycle,
                dueDate: safeDueDate,
              });
            }
          } else if (isTemplateApplicableToPeriod(updated, viewingPeriod)) {
            // Si aún no estaba generada en el período pero ahora es aplicable y activa, generamos
            await get().generatePeriodObligations(viewingPeriod);
          }
        }
      }
    } catch (error) {
      console.error('Failed to update recurring obligation in DB:', error);
    }
  },

  deleteRecurringObligation: async (id: string) => {
    const { recurringObligationsDB } = await import('@/lib/db');
    set((state) => ({
      recurringObligations: state.recurringObligations.filter((o) => o.id !== id),
    }));

    try {
      await recurringObligationsDB.delete(id);
    } catch (error) {
      console.error('Failed to delete recurring obligation from DB:', error);
    }

    get().enqueuePendingChange({
      entityType: 'recurringObligation',
      action: 'delete',
      entityId: id,
    }).catch(console.error);
  },

  registerPayment: async (
    obligationId: string,
    amount: number,
    realDate: string,
    payCycle: import('@/types').PayCycle,
    financialPeriod?: string
  ) => {
    const obligation = get().obligations.find((o) => o.id === obligationId);
    if (!obligation || obligation.status === 'cancelled') return null;

    const period = financialPeriod || obligation.period || realDate.slice(0, 7);
    if (get().isPeriodClosed(period, payCycle)) {
      throw new Error(`No se pueden realizar pagos en un período cerrado (${period} ${payCycle}). Reabre el período primero.`);
    }

    // Validación estricta de monto
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
      return null;
    }

    const currentExpenses = get().expenses;
    const currentPaid = getObligationPaidAmount(obligationId, currentExpenses);
    const remaining = Math.max(0, obligation.amount - currentPaid);

    // Evitar sobrepagos (con tolerancia mínima flotante)
    if (amount > remaining + 0.001) {
      return null;
    }

    // Registrar el gasto vinculado con trazabilidad completa
    const newExpense = await get().addExpense({
      amount,
      description: `Pago: ${obligation.name}`,
      category: obligation.category,
      date: realDate,
      realDate,
      financialPeriod: period,
      payCycle,
      obligationId,
      status: 'active',
      source: 'partial_payment',
    });

    // Recalcular estado de la obligación con los gastos actualizados
    const updatedExpenses = get().expenses;
    const effectiveStatus = calculateObligationEffectiveStatus(obligation, updatedExpenses);
    const isFullyPaid = effectiveStatus === 'paid';

    await get().updateObligation(obligationId, {
      status: effectiveStatus,
      isPaid: isFullyPaid,
    });

    return newExpense;
  },

  revertPayment: async (expenseId: string, obligationId: string) => {
    const expense = get().expenses.find((e) => e.id === expenseId);
    if (!expense) return;

    const period = expense.financialPeriod || expense.date.slice(0, 7);
    const cycle = expense.payCycle || getPayCycleFromDate(expense.date);
    if (get().isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden revertir pagos en un período cerrado (${period} ${cycle || ''}). Reabre el período primero.`);
    }

    // Idempotencia: si ya está revertido, no descontar ni procesar de nuevo
    if (expense.status === 'reverted') return;

    await get().updateExpense(expenseId, { status: 'reverted' });

    const obligation = get().obligations.find((o) => o.id === obligationId);
    if (!obligation) return;

    const updatedExpenses = get().expenses;
    const effectiveStatus = calculateObligationEffectiveStatus(obligation, updatedExpenses);

    await get().updateObligation(obligationId, {
      status: effectiveStatus,
      isPaid: effectiveStatus === 'paid',
    });
  },

  /**
   * Genera explícitamente las obligaciones para un período específico (YYYY-MM).
   * Totalmente idempotente:
   * - Utiliza clave única (userId + templateId + period).
   * - Bloqueo contra peticiones simultáneas / doble clic.
   * - No afecta obligaciones manuales ni instancias ya generadas.
   * - Ajusta el día de vencimiento de forma segura (ej. día 31 en febrero a día 28 o 29).
   */
  generatePeriodObligations: async (period: string): Promise<{ created: number; skipped: number; alreadyExisted: number }> => {
    const lockKey = `${get().currentUserId || 'local'}_${period}`;
    if (activeGenerationLocks.has(lockKey)) {
      return { created: 0, skipped: 0, alreadyExisted: 0 };
    }

    activeGenerationLocks.add(lockKey);

    try {
      const { obligations, recurringObligations, currentUserId } = get();
      const userId = currentUserId || 'local_user';

      let created = 0;
      let skipped = 0;
      let alreadyExisted = 0;

      const newObligations: Obligation[] = [];
      const now = new Date().toISOString();

      for (const template of recurringObligations) {
        const idempotencyKey = buildIdempotencyKey(userId, template.id, period);

        // 1. Comprobar si ya existe instancia para esta plantilla y período
        const exists = obligations.some(
          (o) =>
            o.idempotencyKey === idempotencyKey ||
            (o.templateId === template.id && o.period === period)
        );

        if (exists) {
          alreadyExisted++;
          continue;
        }

        // 2. Comprobar si la plantilla es aplicable según startDate, endDate y isActive
        if (!isTemplateApplicableToPeriod(template, period)) {
          skipped++;
          continue;
        }

        // 2b. Protección de períodos cerrados: no generar obligaciones en períodos o ciclos ya cerrados
        const isMonthClosed = get().periodStates.some(
          (ps) => ps.period === period && ps.cycle === 'MONTHLY' && ps.status === 'closed'
        );
        const isCycleClosed = get().periodStates.some(
          (ps) => ps.period === period && ps.cycle === template.payCycle && ps.status === 'closed'
        );
        if (isMonthClosed || isCycleClosed) {
          skipped++;
          continue;
        }

        // 3. Calcular dueDate ajustada matemáticamente al último día real del mes si es necesario
        const safeDueDate = calculateSafeDueDateString(period, template.dayOfMonth);

        const newObligation: Obligation = {
          id: generateId(),
          name: template.name,
          amount: template.amount,
          category: template.category,
          payCycle: template.payCycle,
          dueDate: safeDueDate,
          isPaid: false,
          status: 'pending',
          period,
          templateId: template.id,
          idempotencyKey,
          createdAt: now,
          updatedAt: now,
        };

        newObligations.push(newObligation);
        created++;
      }

      if (newObligations.length > 0) {
        // Actualizar estado en memoria
        set((state) => ({
          obligations: [...state.obligations, ...newObligations],
        }));

        // Guardar en IndexedDB
        for (const obs of newObligations) {
          try {
            await obligationsDB.add(obs);
          } catch (err) {
            console.error('Failed to save generated obligation to IndexedDB:', err);
          }
        }

        get().enqueuePendingChange({
          entityType: 'obligation',
          action: 'create',
          entityId: `batch_generated_${period}`,
          payload: newObligations,
        }).catch(console.error);

        get().recalculateStats();
      }

      return { created, skipped, alreadyExisted };
    } finally {
      activeGenerationLocks.delete(lockKey);
    }
  },

  /**
   * Mantenido por compatibilidad pero desactivado de auto-ejecución en navegación.
   * Redirige al generador idempotente explícito.
   */
  ensurePeriodInitialized: async (period: string) => {
    // No-op en navegación automática: la generación requiere acción explícita del usuario
    // Si se invoca explícitamente, delega a generatePeriodObligations
    await get().generatePeriodObligations(period);
  },
});
