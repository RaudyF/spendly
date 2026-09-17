'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  ArrowRight,
  Target,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Coins,
  ShieldCheck,
  ChevronDown,
  Info,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal-base';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';
import { PeriodCycle, PeriodFinancialSummary } from '@/types';
import { formatCurrency, getMonthName } from '@/lib/utils';
import { getNextMonthPeriod } from '@/lib/utils';

interface PeriodClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: string;
  cycle: PeriodCycle;
}

export const PeriodClosingModal: React.FC<PeriodClosingModalProps> = ({
  isOpen,
  onClose,
  period,
  cycle,
}) => {
  const profile = useStore((state) => state.profile);
  const goals = useStore((state) => state.goals);
  const calculatePeriodSummary = useStore((state) => state.calculatePeriodSummary);
  const closePeriod = useStore((state) => state.closePeriod);

  const currency = profile?.currency || 'DOP';

  // Compute summary
  const summary: PeriodFinancialSummary | null = useMemo(() => {
    if (!isOpen) return null;
    return calculatePeriodSummary(period, cycle);
  }, [isOpen, period, cycle, calculatePeriodSummary]);

  // Default next destinations
  const defaultDestination = useMemo(() => {
    if (cycle === 'Q1') {
      return { period, cycle: 'Q2' as PeriodCycle };
    } else if (cycle === 'Q2') {
      return { period: getNextMonthPeriod(period), cycle: 'Q1' as PeriodCycle };
    } else {
      return { period: getNextMonthPeriod(period), cycle: 'MONTHLY' as PeriodCycle };
    }
  }, [period, cycle]);

  // Form states
  const [shouldRollover, setShouldRollover] = useState(true);
  const [carryAmount, setCarryAmount] = useState<number>(0);
  const [destinationPeriod, setDestinationPeriod] = useState(defaultDestination.period);
  const [destinationCycle, setDestinationCycle] = useState<PeriodCycle>(defaultDestination.cycle);

  // Goal allocation
  const [allocateToGoal, setAllocateToGoal] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [goalAmount, setGoalAmount] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize defaults on summary compute
  useEffect(() => {
    if (summary) {
      const eligible = summary.eligibleCarryAmount;
      setCarryAmount(Math.abs(eligible));
      setDestinationPeriod(defaultDestination.period);
      setDestinationCycle(defaultDestination.cycle);
      setShouldRollover(eligible !== 0);
      setAllocateToGoal(false);
      setSelectedGoalId(goals[0]?.id || '');
      setGoalAmount(0);
      setErrorMsg(null);
    }
  }, [summary, defaultDestination, goals]);

  if (!summary) return null;

  const isSurplus = summary.carryType === 'surplus';
  const isDeficit = summary.carryType === 'deficit';
  const isBalanced = summary.carryType === 'zero';

  // Calculations for goal + carry split
  const totalEligible = summary.eligibleCarryAmount;
  const maxAvailableForGoal = isSurplus ? Math.max(0, totalEligible - carryAmount) : 0;

  const handleGoalAmountChange = (val: number) => {
    const clamped = Math.min(Math.max(0, val), totalEligible);
    setGoalAmount(clamped);
    if (isSurplus) {
      setCarryAmount(Math.max(0, totalEligible - clamped));
    }
  };

  const handleCarryAmountChange = (val: number) => {
    const clamped = isSurplus ? Math.min(Math.max(0, val), totalEligible) : Math.max(0, val);
    setCarryAmount(clamped);
    if (isSurplus && allocateToGoal) {
      setGoalAmount(Math.max(0, totalEligible - clamped));
    }
  };

  const handleConfirmClose = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let signedCarryAmount = 0;
      if (shouldRollover && carryAmount > 0) {
        signedCarryAmount = isDeficit ? -Math.abs(carryAmount) : Math.abs(carryAmount);
      }

      await closePeriod({
        period,
        cycle,
        carryAmount: shouldRollover ? signedCarryAmount : 0,
        destinationPeriod: shouldRollover ? destinationPeriod : undefined,
        destinationCycle: shouldRollover ? destinationCycle : undefined,
        goalAllocation:
          allocateToGoal && selectedGoalId && goalAmount > 0
            ? { goalId: selectedGoalId, amount: goalAmount }
            : undefined,
      });
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e?.message || 'Error al cerrar el período.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cierre de Período — ${getMonthName(period)} ${cycle === 'MONTHLY' ? '(Mes Completo)' : `(${cycle})`}`}
      description="Revisa los balances consolidados antes de congelar el estado del período."
      size="xl"
    >
      <div className="space-y-6 pt-2">
        {/* Financial Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Ingresos */}
          <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/60">
            <div className="flex items-center justify-between text-xs text-surface-500 font-medium mb-1">
              <span>Ingresos Totales</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {summary.pendingIncome > 0 ? `Pendiente: ${formatCurrency(summary.pendingIncome, currency)}` : 'Completado'}
              </span>
            </div>
            <div className="text-lg font-bold text-surface-900 dark:text-white">
              {formatCurrency(summary.receivedIncome, currency)}
            </div>
            <div className="text-xs text-surface-500 mt-1">
              Esperado: {formatCurrency(summary.expectedIncome, currency)}
            </div>
          </div>

          {/* Gastos */}
          <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/60">
            <div className="flex items-center justify-between text-xs text-surface-500 font-medium mb-1">
              <span>Gastos del Período</span>
              <span className="text-rose-600 dark:text-rose-400">
                {summary.budgetSpent > 0 ? `${formatCurrency(summary.budgetSpent, currency)} consumido` : 'Sin gastos'}
              </span>
            </div>
            <div className="text-lg font-bold text-surface-900 dark:text-white">
              {formatCurrency(summary.totalExpenses, currency)}
            </div>
            <div className="text-xs text-surface-500 mt-1">
              Presupuesto asignado: {formatCurrency(summary.budgetLimit, currency)}
            </div>
          </div>

          {/* Obligaciones */}
          <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/60">
            <div className="flex items-center justify-between text-xs text-surface-500 font-medium mb-1">
              <span>Obligaciones Fijas</span>
              <span>
                {summary.obligations.paidCount}/{summary.obligations.totalCount} pagadas
              </span>
            </div>
            <div className="text-lg font-bold text-surface-900 dark:text-white">
              {formatCurrency(summary.obligations.totalCommitted, currency)}
            </div>
            <div className="flex items-center gap-2 text-xs text-surface-500 mt-1">
              <span className="text-emerald-600 dark:text-emerald-400">
                Pagado: {formatCurrency(summary.obligations.paidAmount, currency)}
              </span>
              {summary.obligations.pendingAmount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  • Pendiente: {formatCurrency(summary.obligations.pendingAmount, currency)}
                </span>
              )}
            </div>
          </div>

          {/* Balance Inicial previo si existió */}
          <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/60">
            <div className="flex items-center justify-between text-xs text-surface-500 font-medium mb-1">
              <span>Balance Inicial (Arrastre anterior)</span>
              <span>{summary.initialBalance !== 0 ? 'Aplicado' : 'Neutro'}</span>
            </div>
            <div
              className={`text-lg font-bold ${
                summary.initialBalance >= 0
                  ? 'text-surface-900 dark:text-white'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(summary.initialBalance, currency)}
            </div>
            <div className="text-xs text-surface-500 mt-1">
              Saldo transferido desde el ciclo anterior
            </div>
          </div>
        </div>

        {/* Highlight Result Card */}
        <div
          className={`p-4 rounded-2xl border ${
            isSurplus
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
              : isDeficit
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200'
              : 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {isSurplus ? (
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : isDeficit ? (
                <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-primary-500" />
              )}
              <span className="font-semibold text-sm">
                {isSurplus
                  ? 'Sobrante Real Elegible para Arrastre'
                  : isDeficit
                  ? 'Déficit del Período a Gestionar'
                  : 'Período Equilibrado'}
              </span>
            </div>
            <span className="text-xl font-black">
              {formatCurrency(summary.eligibleCarryAmount, currency)}
            </span>
          </div>
          <p className="text-xs opacity-80 mt-1">
            Disponible Real: {formatCurrency(summary.realFreeAvailable, currency)} | Disponible Proyectado:{' '}
            {formatCurrency(summary.projectedFreeAvailable, currency)}
          </p>
        </div>

        {/* Rollover & Goal Allocation Section */}
        {cycle === 'Q2' ? (
          <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700 space-y-4">
            <div className="flex items-start gap-2.5 text-xs text-surface-600 dark:text-surface-300">
              <Info className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-surface-900 dark:text-white">Política de Cierre Q2:</span>{' '}
                El cierre de Q2 congela las métricas de esta quincena. El saldo acumulado de todo el mes se consolidará y arrastrará formalmente al siguiente mes a través del <span className="font-semibold text-primary-600 dark:text-primary-400">Cierre Mensual</span>, evitando cualquier duplicación de arrastre.
              </div>
            </div>

            {/* Optional Goal Allocation for Surplus in Q2 */}
            {isSurplus && goals.length > 0 && (
              <div className="pt-2 border-t border-surface-200 dark:border-surface-700/60">
                <label className="flex items-center gap-2 text-xs font-medium text-surface-700 dark:text-surface-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allocateToGoal}
                    onChange={(e) => {
                      setAllocateToGoal(e.target.checked);
                      if (e.target.checked) {
                        setGoalAmount(Math.min(totalEligible, 1000));
                      } else {
                        setGoalAmount(0);
                      }
                    }}
                    className="rounded text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                  />
                  <span>Destinar parte del sobrante a una Meta de Ahorro</span>
                </label>

                {allocateToGoal && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-xs text-surface-500 mb-1">Meta</label>
                      <select
                        value={selectedGoalId}
                        onChange={(e) => setSelectedGoalId(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {goals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} (Actual: {formatCurrency(g.currentAmount, currency)} / {formatCurrency(g.targetAmount, currency)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-surface-500 mb-1">Monto a la meta</label>
                      <input
                        type="number"
                        min="0"
                        max={totalEligible}
                        step="1"
                        value={goalAmount}
                        onChange={(e) => setGoalAmount(Math.min(Math.max(0, Number(e.target.value)), totalEligible))}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : !isBalanced ? (
          <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700 space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-medium text-sm text-surface-900 dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={shouldRollover}
                  onChange={(e) => setShouldRollover(e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                <span>
                  {isSurplus
                    ? cycle === 'Q1'
                      ? 'Arrastrar sobrante hacia la segunda quincena (Q2)'
                      : 'Arrastrar sobrante mensual consolidado hacia el siguiente mes'
                    : cycle === 'Q1'
                    ? 'Arrastrar déficit como saldo inicial negativo a Q2'
                    : 'Arrastrar déficit mensual como saldo inicial negativo al siguiente mes'}
                </span>
              </label>
            </div>

            {shouldRollover && (
              <div className="space-y-4 pt-2 border-t border-surface-200 dark:border-surface-700/60">
                {/* Destination Indicator */}
                <div className="p-3 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-between text-xs">
                  <span className="text-surface-500">Destino del arrastre:</span>
                  <span className="font-semibold text-surface-900 dark:text-white">
                    {cycle === 'Q1'
                      ? `${getMonthName(period)} — Q2 (Segunda Quincena)`
                      : `${getMonthName(getNextMonthPeriod(period))} — Mes Completo`}
                  </span>
                </div>

                {/* Carry Amount Input */}
                <div>
                  <div className="flex justify-between items-center text-xs font-medium text-surface-500 mb-1">
                    <span>Monto a arrastrar ({currency})</span>
                    <span>Máximo: {formatCurrency(Math.abs(totalEligible), currency)}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={Math.abs(totalEligible)}
                    step="1"
                    value={carryAmount}
                    onChange={(e) => handleCarryAmountChange(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Optional Goal Allocation for Surplus */}
                {isSurplus && goals.length > 0 && (
                  <div className="pt-2 border-t border-surface-200 dark:border-surface-700/60">
                    <label className="flex items-center gap-2 text-xs font-medium text-surface-700 dark:text-surface-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allocateToGoal}
                        onChange={(e) => {
                          setAllocateToGoal(e.target.checked);
                          if (e.target.checked) {
                            handleGoalAmountChange(Math.max(0, totalEligible - carryAmount));
                          } else {
                            setGoalAmount(0);
                            setCarryAmount(totalEligible);
                          }
                        }}
                        className="rounded text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                      />
                      <span>Destinar parte del sobrante a una Meta de Ahorro</span>
                    </label>

                    {allocateToGoal && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="block text-xs text-surface-500 mb-1">Meta</label>
                          <select
                            value={selectedGoalId}
                            onChange={(e) => setSelectedGoalId(e.target.value)}
                            className="w-full text-xs px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            {goals.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name} (Actual: {formatCurrency(g.currentAmount, currency)} / {formatCurrency(g.targetAmount, currency)})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-surface-500 mb-1">Monto a la meta</label>
                          <input
                            type="number"
                            min="0"
                            max={totalEligible}
                            step="1"
                            value={goalAmount}
                            onChange={(e) => handleGoalAmountChange(Number(e.target.value))}
                            className="w-full text-xs px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Warning & Info */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300 text-xs">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Al cerrar el período, este resumen quedará congelado con fines históricos. El saldo trasladado se
            incorporará como balance inicial en el período de destino sin inflar los ingresos declarados.
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmClose}
            isLoading={isSubmitting}
            leftIcon={<Lock className="w-4 h-4" />}
          >
            Confirmar y Cerrar Período
          </Button>
        </div>
      </div>
    </Modal>
  );
};
