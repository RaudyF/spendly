import { Obligation, Expense, ObligationStatus } from '@/types';

/**
 * Motor de Trazabilidad y Cálculo de Obligaciones - SaldoClaro
 * Evalúa estado, montos pagados y saldos pendientes con zona horaria America/Santo_Domingo.
 */

export function getSantoDomingoTodayString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export function getObligationPaidAmount(obligationId: string, expenses: Expense[]): number {
  return expenses
    .filter((e) => e.obligationId === obligationId && e.status !== 'reverted')
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getObligationRemainingAmount(obligation: Obligation, expenses: Expense[]): number {
  if (obligation.status === 'cancelled') return 0;
  if (obligation.status === 'paid') return 0;
  if (obligation.isPaid && !obligation.status) return 0;
  
  const paid = getObligationPaidAmount(obligation.id, expenses);
  return Math.max(0, obligation.amount - paid);
}

export function calculateObligationEffectiveStatus(
  obligation: Obligation,
  expenses: Expense[],
  todayStr: string = getSantoDomingoTodayString()
): ObligationStatus {
  if (obligation.status === 'cancelled') return 'cancelled';

  const paid = getObligationPaidAmount(obligation.id, expenses);
  const remaining = Math.max(0, obligation.amount - paid);

  if (remaining <= 0.001 || (obligation.isPaid && !obligation.status)) {
    return 'paid';
  }

  // Evaluación de vencimiento en America/Santo_Domingo
  if (obligation.dueDate && obligation.dueDate < todayStr) {
    return 'overdue';
  }

  if (paid > 0) {
    return 'partial';
  }

  return 'pending';
}

/**
 * Calcula la fecha de vencimiento real ajustada (ej. día 31 en febrero 2026 -> 2026-02-28, febrero 2028 -> 2028-02-29, abril -> 2026-04-30, mayo -> 2026-05-31)
 */
export function calculateSafeDueDateString(period: string, dayOfMonth: number): string {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed

  // El día 0 del mes siguiente da el último día del mes actual
  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(Math.max(1, dayOfMonth), lastDay);

  return `${period}-${String(safeDay).padStart(2, '0')}`;
}

/**
 * Clave de idempotencia única: usuario + templateId + período
 */
export function buildIdempotencyKey(userId: string, templateId: string, period: string): string {
  const cleanUserId = userId || 'local_user';
  return `${cleanUserId}_${templateId}_${period}`;
}

/**
 * Comprueba si una plantilla es elegible para ser generada en un período (YYYY-MM).
 * Respeta isActive, startDate (no antes de startDate) y endDate opcional (no después de endDate).
 */
export function isTemplateApplicableToPeriod(
  template: { isActive: boolean; startDate: string; endDate?: string },
  period: string
): boolean {
  if (!template.isActive) return false;

  const startPeriod = template.startDate.slice(0, 7);
  if (period < startPeriod) return false;

  if (template.endDate) {
    const endPeriod = template.endDate.slice(0, 7);
    if (period > endPeriod) return false;
  }

  return true;
}

