'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';
import { getFinancialMonth, comparePeriods } from '@/lib/time';
import { getMonthName } from '@/lib/utils';
import { cn } from '@/lib/utils';

const TimeNavigatorInner: React.FC<{ className?: string }> = ({ className }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const viewingPeriod = useStore((state) => state.viewingPeriod);
  const setViewingPeriod = useStore((state) => state.setViewingPeriod);
  
  // Track today's financial month to disable "next" if we restrict future, 
  // or to show "Back to Today" button
  const todayPeriod = getFinancialMonth();
  
  // Init from URL
  useEffect(() => {
    const periodParam = searchParams.get('period');
    
    if (periodParam) {
      // Validate strictly YYYY-MM where MM is 01-12
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(periodParam)) {
        if (periodParam !== viewingPeriod) {
          setViewingPeriod(periodParam);
        }
      } else {
        // Fallback for invalid period (e.g. 2026-13, abc)
        const params = new URLSearchParams(searchParams.toString());
        params.set('period', todayPeriod);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        if (viewingPeriod !== todayPeriod) {
          setViewingPeriod(todayPeriod);
        }
      }
    } else {
      // No period in URL, update URL to keep in sync
      const params = new URLSearchParams(searchParams.toString());
      params.set('period', viewingPeriod);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, pathname, viewingPeriod, setViewingPeriod, router, todayPeriod]);
  
  const updatePeriod = useCallback((newPeriod: string) => {
    setViewingPeriod(newPeriod);
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', newPeriod);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [setViewingPeriod, searchParams, pathname, router]);

  const handlePrevMonth = () => {
    const [year, month] = viewingPeriod.split('-').map(Number);
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    const newPeriod = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    updatePeriod(newPeriod);
  };

  const handleNextMonth = () => {
    const [year, month] = viewingPeriod.split('-').map(Number);
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    const newPeriod = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    updatePeriod(newPeriod);
  };

  const handleToday = () => {
    updatePeriod(todayPeriod);
  };

  const isToday = viewingPeriod === todayPeriod;
  const isHistorical = comparePeriods(viewingPeriod, todayPeriod) < 0;
  const isFuture = comparePeriods(viewingPeriod, todayPeriod) > 0;

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center gap-3", className)}>
      <div className="flex items-center bg-surface-100 dark:bg-surface-800/50 rounded-xl p-1 border border-surface-200 dark:border-surface-700/50">
        <button
          onClick={handlePrevMonth}
          className="p-2 text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex-1 sm:flex-none sm:w-40 text-center flex items-center justify-center gap-2 font-medium text-surface-900 dark:text-white capitalize px-2">
          <CalendarIcon className="w-4 h-4 text-surface-400" />
          <AnimatePresence mode="wait">
            <motion.span
              key={viewingPeriod}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {getMonthName(viewingPeriod)}
            </motion.span>
          </AnimatePresence>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2 text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      
      {!isToday && (
        <button
          onClick={handleToday}
          className={cn(
            "text-sm font-medium px-4 py-2 rounded-xl transition-colors border",
            isHistorical 
              ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50" 
              : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50"
          )}
        >
          {isHistorical ? 'Volver a Hoy (Viendo histórico)' : 'Volver a Hoy (Planificando)'}
        </button>
      )}
    </div>
  );
};

export const TimeNavigator: React.FC<{ className?: string }> = (props) => (
  <Suspense fallback={<div className="h-10 w-48 bg-surface-200 dark:bg-surface-800 rounded-xl animate-pulse" />}>
    <TimeNavigatorInner {...props} />
  </Suspense>
);
