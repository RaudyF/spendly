import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { CURRENCIES } from './constants';

import { PayCycle } from '@/types';

// Get pay cycle (Q1 or Q2) from date
export function getPayCycleFromDate(date: string | Date): PayCycle {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const day = dateObj.getDate();
  return day <= 15 ? 'Q1' : 'Q2';
}

// Get the date range for a specific pay cycle in a given month (YYYY-MM)
export function getPayCycleDates(monthStr: string, cycle: PayCycle): { start: Date; end: Date } {
  const [year, month] = monthStr.split('-').map(Number);
  const baseDate = new Date(year, month - 1, 1);
  
  if (cycle === 'Q1') {
    return {
      start: baseDate,
      end: new Date(year, month - 1, 15, 23, 59, 59, 999)
    };
  } else if (cycle === 'Q2') {
    return {
      start: new Date(year, month - 1, 16),
      end: endOfMonth(baseDate)
    };
  }
  
  // MONTHLY fallback
  return {
    start: baseDate,
    end: endOfMonth(baseDate)
  };
}

// Merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(
  amount: number,
  currencyCode: string = 'DOP',
  compact: boolean = false
): string {
  const isRD = currencyCode === 'DOP' || currencyCode === 'RD$';
  const currency = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];
  
  if (compact && Math.abs(amount) >= 1000) {
    const formatted = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
    
    if (isRD) return `RD$ ${formatted}`;
    return `${currency.symbol} ${formatted}`;
  }

  if (isRD) {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
    return `RD$ ${formatted}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format date
export function formatDate(date: string | Date, formatStr: string = 'd MMM yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr, { locale: es });
}

// Get current month string (YYYY-MM)
export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

// Check if a date is in the current month
export function isInCurrentMonth(date: string): boolean {
  const dateObj = parseISO(date);
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  return isWithinInterval(dateObj, { start, end });
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Calculate percentage
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// Get progress color based on percentage
export function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-red-500';
  if (percentage >= 80) return 'bg-orange-500';
  if (percentage >= 60) return 'bg-yellow-500';
  return 'bg-green-500';
}

// Get health status color
export function getHealthColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Smooth scroll to element
export function smoothScrollTo(elementId: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Get greeting based on time
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

// Format relative time
export function formatRelativeTime(date: string): string {
  const dateObj = parseISO(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Justo ahora';
  if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `Hace ${Math.floor(diffInSeconds / 86400)}d`;
  return formatDate(date, 'd MMM');
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Parse amount string to number
export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Get month name
export function getMonthName(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1);
  return format(date, 'MMMM yyyy', { locale: es });
}

// Calculate savings rate
export function calculateSavingsRate(income: number, expenses: number): number {
  if (income === 0) return 0;
  const savings = income - expenses;
  return Math.round((savings / income) * 100);
}

// Get spending trend
export function getSpendingTrend(
  currentMonthExpenses: number,
  lastMonthExpenses: number
): 'increasing' | 'stable' | 'decreasing' {
  if (lastMonthExpenses === 0) return 'stable';
  const change = ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
  if (change > 10) return 'increasing';
  if (change < -10) return 'decreasing';
  return 'stable';
}

// Group transactions by date
export function groupByDate<T extends { date: string }>(
  items: T[]
): Record<string, T[]> {
  return items.reduce((groups, item) => {
    const date = formatDate(item.date, 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

// Export data as CSV
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

// Next month period YYYY-MM
export function getNextMonthPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const nextDate = new Date(year, month, 1);
  return format(nextDate, 'yyyy-MM');
}

// Previous month period YYYY-MM
export function getPreviousMonthPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  return format(prevDate, 'yyyy-MM');
}
