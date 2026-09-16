// Standardized financial status tokens for SaldoClaro
// Ensures consistent visual hierarchy and color psychology across all screens.

export type FinancialStatus =
  | 'confirmed' // Recibido (ingreso), Pagado (obligación)
  | 'pending'   // Pendiente por pagar (obligación activa)
  | 'expected'  // Esperado / Proyectado (nómina quincenal o ingreso futuro)
  | 'overdue'   // Vencido (obligación pasada de fecha no pagada)
  | 'warning'   // Alerta / Cerca del límite presupuestario
  | 'neutral';  // Informativo / Sin estado especial

export interface FinancialStatusConfig {
  id: FinancialStatus;
  label: string;
  badgeClass: string;
  pillClass: string;
  dotClass: string;
  borderClass: string;
  textClass: string;
  bgSubtle: string;
}

export const FINANCIAL_STATUS_CONFIG: Record<FinancialStatus, FinancialStatusConfig> = {
  confirmed: {
    id: 'confirmed',
    label: 'Confirmado',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    pillClass: 'bg-emerald-600 text-white',
    dotClass: 'bg-emerald-500',
    borderClass: 'border-emerald-500/30',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    bgSubtle: 'bg-emerald-50/60 dark:bg-emerald-950/20',
  },
  pending: {
    id: 'pending',
    label: 'Pendiente',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    pillClass: 'bg-amber-500 text-white',
    dotClass: 'bg-amber-500',
    borderClass: 'border-amber-500/30',
    textClass: 'text-amber-800 dark:text-amber-400',
    bgSubtle: 'bg-amber-50/60 dark:bg-amber-950/20',
  },
  expected: {
    id: 'expected',
    label: 'Esperado',
    badgeClass: 'bg-sky-50 text-sky-800 border border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
    pillClass: 'bg-sky-600 text-white',
    dotClass: 'bg-sky-500',
    borderClass: 'border-sky-500/30',
    textClass: 'text-sky-800 dark:text-sky-400',
    bgSubtle: 'bg-sky-50/60 dark:bg-sky-950/20',
  },
  overdue: {
    id: 'overdue',
    label: 'Vencido',
    badgeClass: 'bg-rose-50 text-rose-800 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    pillClass: 'bg-rose-600 text-white',
    dotClass: 'bg-rose-500 animate-pulse',
    borderClass: 'border-rose-500/30',
    textClass: 'text-rose-700 dark:text-rose-400',
    bgSubtle: 'bg-rose-50/60 dark:bg-rose-950/20',
  },
  warning: {
    id: 'warning',
    label: 'Atención',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    pillClass: 'bg-amber-500 text-white',
    dotClass: 'bg-amber-500',
    borderClass: 'border-amber-500/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    bgSubtle: 'bg-amber-50/60 dark:bg-amber-950/20',
  },
  neutral: {
    id: 'neutral',
    label: 'Informativo',
    badgeClass: 'bg-surface-100 text-surface-700 border border-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:border-surface-700',
    pillClass: 'bg-surface-500 text-white',
    dotClass: 'bg-surface-400',
    borderClass: 'border-surface-300',
    textClass: 'text-surface-600 dark:text-surface-400',
    bgSubtle: 'bg-surface-50 dark:bg-surface-900',
  },
};

export function getStatusLabel(
  status: FinancialStatus,
  context?: 'income' | 'obligation' | 'expense' | 'general'
): string {
  if (context === 'income') {
    if (status === 'confirmed') return 'Recibido';
    if (status === 'expected') return 'Esperado';
    if (status === 'pending') return 'Por cobrar';
  }
  if (context === 'obligation') {
    if (status === 'confirmed') return 'Pagado';
    if (status === 'pending') return 'Pendiente';
    if (status === 'overdue') return 'Vencido';
  }
  return FINANCIAL_STATUS_CONFIG[status]?.label || 'Estado';
}
