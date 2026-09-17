import { PayCycle } from '@/types';

/**
 * FASE 1: MOTOR TEMPORAL
 * Single source of truth for financial time.
 */

const FINANCIAL_ZONE = 'America/Santo_Domingo';

// 1. Obtener fecha actual en America/Santo_Domingo, devuelta como objeto local para consistencia.
export function getFinancialToday(): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FINANCIAL_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(new Date());
  
  let year = 0, month = 0, day = 0;
  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    if (part.type === 'month') month = parseInt(part.value, 10);
    if (part.type === 'day') day = parseInt(part.value, 10);
  }
  
  // Creates a local date using the exact components from Santo Domingo
  // This isolates the day calculation from UTC offsets.
  return new Date(year, month - 1, day);
}

// 2. Obtener YYYY-MM
export function getFinancialMonth(date?: Date): string {
  const d = date || getFinancialToday();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// 3. Detectar año bisiesto
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// 4. Obtener último día real del mes
export function getLastDayOfMonth(year: number, month: number): number {
  // month is 1-indexed here. 
  // Date(year, month, 0) gives the last day of the PREVIOUS month.
  // So if month is 1 (Jan), new Date(year, 1, 0) gives Jan 31.
  return new Date(year, month, 0).getDate();
}

// 5. Determinar Q1 o Q2
export function getPayCycle(date: Date): PayCycle {
  return date.getDate() <= 15 ? 'Q1' : 'Q2';
}

// 6. Obtener inicio y fin de cada quincena
export function getPayCycleBounds(period: string, cycle: PayCycle): { start: Date; end: Date } {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed
  
  if (cycle === 'Q1') {
    return {
      start: new Date(year, month - 1, 1, 0, 0, 0, 0),
      end: new Date(year, month - 1, 15, 23, 59, 59, 999)
    };
  } else if (cycle === 'Q2') {
    const lastDay = getLastDayOfMonth(year, month);
    return {
      start: new Date(year, month - 1, 16, 0, 0, 0, 0),
      end: new Date(year, month - 1, lastDay, 23, 59, 59, 999)
    };
  } else {
    // MONTHLY
    const lastDay = getLastDayOfMonth(year, month);
    return {
      start: new Date(year, month - 1, 1, 0, 0, 0, 0),
      end: new Date(year, month - 1, lastDay, 23, 59, 59, 999)
    };
  }
}

// 7. Calcular días restantes de quincena y mes
export function getRemainingDays(date: Date = getFinancialToday()): { quincena: number; month: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();
  const lastDay = getLastDayOfMonth(year, month);
  
  const cycle = getPayCycle(date);
  
  let remainingQuincena = 0;
  if (cycle === 'Q1') {
    remainingQuincena = 15 - day;
  } else {
    remainingQuincena = lastDay - day;
  }
  
  const remainingMonth = lastDay - day;
  
  return {
    quincena: remainingQuincena,
    month: remainingMonth
  };
}

// 8. Ajustar vencimientos inexistentes al último día del mes
export function getSafeDueDate(year: number, month: number, targetDay: number): Date {
  const lastDay = getLastDayOfMonth(year, month);
  const safeDay = targetDay > lastDay ? lastDay : targetDay;
  return new Date(year, month - 1, safeDay);
}

// 9. Comparar períodos sin depender de strings ambiguos
// Returns -1 if p1 < p2, 0 if p1 === p2, 1 if p1 > p2
export function comparePeriods(p1: string, p2: string): number {
  const [y1, m1] = p1.split('-').map(Number);
  const [y2, m2] = p2.split('-').map(Number);
  
  if (y1 !== y2) return y1 < y2 ? -1 : 1;
  if (m1 !== m2) return m1 < m2 ? -1 : 1;
  return 0;
}
