'use client';

import React, { useState } from 'react';
import { Lock, Unlock, Clock, CheckCircle, ArrowRightLeft, Sparkles, AlertCircle } from 'lucide-react';
import { useStore } from '@/store';
import { PeriodStatusBadge } from './period-status-badge';
import { PeriodClosingModal } from './period-closing-modal';
import { PeriodReopenModal } from './period-reopen-modal';
import { formatCurrency, getMonthName } from '@/lib/utils';
import { getFinancialMonth, comparePeriods } from '@/lib/time';
import { PeriodCycle, PeriodStatus } from '@/types';

export const PeriodStatusBanner: React.FC = () => {
  const viewingPeriod = useStore((state) => state.viewingPeriod);
  const activePayCycle = useStore((state) => state.activePayCycle);
  const periodStates = useStore((state) => state.periodStates);
  const periodRollovers = useStore((state) => state.periodRollovers);
  const profile = useStore((state) => state.profile);

  const currency = profile?.currency || 'DOP';
  const todayPeriod = getFinancialMonth();

  const [isClosingOpen, setIsClosingOpen] = useState(false);
  const [isReopenOpen, setIsReopenOpen] = useState(false);

  // Find exact state for current viewing period & active cycle
  const currentPeriodState = periodStates.find(
    (ps) => ps.period === viewingPeriod && ps.cycle === activePayCycle
  );

  // Determine effective status
  let status: PeriodStatus = 'open';
  if (currentPeriodState) {
    status = currentPeriodState.status;
  } else if (comparePeriods(viewingPeriod, todayPeriod) < 0) {
    status = 'pending_review';
  }

  // Find incoming rollovers for this period and cycle
  const incomingRollovers = (periodRollovers || []).filter((ro) => {
    if (ro.status !== 'applied') return false;
    if (ro.destinationPeriod !== viewingPeriod) return false;
    if (activePayCycle === 'MONTHLY') {
      return ro.sourcePeriod !== viewingPeriod;
    }
    return ro.destinationCycle === activePayCycle;
  });

  const totalIncomingBalance = incomingRollovers.reduce((sum, ro) => sum + ro.amount, 0);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-surface-100 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700/80">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">
              Estado:
            </span>
            <PeriodStatusBadge status={status} cycle={activePayCycle} />
          </div>

          {status === 'closed' && currentPeriodState?.closedAt && (
            <span className="text-xs text-surface-500">
              Cerrado el {new Date(currentPeriodState.closedAt).toLocaleDateString()}
            </span>
          )}

          {totalIncomingBalance !== 0 && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                totalIncomingBalance > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>
                {totalIncomingBalance > 0 ? 'Sobrante arrastrado: +' : 'Déficit arrastrado: '}
                {formatCurrency(totalIncomingBalance, currency)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {status === 'closed' ? (
            <button
              onClick={() => setIsReopenOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Reabrir Período</span>
            </button>
          ) : (
            <button
              onClick={() => setIsClosingOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-surface-900 text-white hover:bg-surface-800 dark:bg-white dark:text-surface-900 dark:hover:bg-surface-100 transition-colors shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Revisar y Cerrar</span>
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {isClosingOpen && (
        <PeriodClosingModal
          isOpen={isClosingOpen}
          onClose={() => setIsClosingOpen(false)}
          period={viewingPeriod}
          cycle={activePayCycle}
        />
      )}

      {isReopenOpen && (
        <PeriodReopenModal
          isOpen={isReopenOpen}
          onClose={() => setIsReopenOpen(false)}
          period={viewingPeriod}
          cycle={activePayCycle}
        />
      )}
    </>
  );
};
