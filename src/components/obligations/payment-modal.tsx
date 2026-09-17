'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { Obligation, PayCycle } from '@/types';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getSantoDomingoTodayString, getObligationPaidAmount, getObligationRemainingAmount } from '@/lib/obligations';
import { RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  obligation: Obligation | null;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, obligation }) => {
  const profile = useStore((state) => state.profile);
  const expenses = useStore((state) => state.expenses);
  const viewingPeriod = useStore((state) => state.viewingPeriod);
  const registerPayment = useStore((state) => state.registerPayment);
  const revertPayment = useStore((state) => state.revertPayment);

  const [amount, setAmount] = useState('');
  const [realDate, setRealDate] = useState('');
  const [financialPeriod, setFinancialPeriod] = useState('');
  const [payCycle, setPayCycle] = useState<PayCycle>('Q1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [revertId, setRevertId] = useState<string | null>(null);

  const submittingRef = useRef(false);

  // Real-time calculation based on single source of truth in expenses
  const paidAmount = obligation ? getObligationPaidAmount(obligation.id, expenses) : 0;
  const remainingAmount = obligation ? getObligationRemainingAmount(obligation, expenses) : 0;

  useEffect(() => {
    if (isOpen && obligation) {
      const today = getSantoDomingoTodayString();
      setRealDate(today);
      setFinancialPeriod(obligation.period || viewingPeriod);
      setPayCycle(obligation.payCycle === 'MONTHLY' ? 'Q1' : obligation.payCycle);
      setAmount(remainingAmount > 0 ? remainingAmount.toString() : '');
      setError(null);
      setSuccessMessage(null);
      submittingRef.current = false;
    }
  }, [isOpen, obligation, remainingAmount, viewingPeriod]);

  if (!obligation) return null;

  const numericAmount = parseFloat(amount);
  const isValidAmount = !isNaN(numericAmount) && isFinite(numericAmount) && numericAmount > 0;
  const isOverpaying = isValidAmount && numericAmount > remainingAmount + 0.001;
  const resultingRemaining = isValidAmount && !isOverpaying ? Math.max(0, remainingAmount - numericAmount) : remainingAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    setError(null);
    setSuccessMessage(null);

    if (!isValidAmount) {
      setError('Por favor ingresa un monto válido mayor a 0');
      return;
    }

    if (isOverpaying) {
      setError(`El monto no puede superar el saldo pendiente de ${formatCurrency(remainingAmount, profile?.currency)}`);
      return;
    }

    if (!realDate) {
      setError('La fecha real de pago es obligatoria');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await registerPayment(
        obligation.id,
        numericAmount,
        realDate,
        payCycle,
        financialPeriod || obligation.period || viewingPeriod
      );

      if (result) {
        setSuccessMessage(`Pago de ${formatCurrency(numericAmount, profile?.currency)} registrado con éxito`);
        setAmount('');
        if (numericAmount >= remainingAmount - 0.001) {
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else {
        setError('No se pudo registrar el pago. Verifica el monto y estado.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error inesperado al registrar el pago');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleRevert = async () => {
    if (!revertId || submittingRef.current || isSubmitting) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await revertPayment(revertId, obligation.id);
      setSuccessMessage('Pago revertido con éxito');
    } catch (err: any) {
      setError(err?.message || 'Error al revertir el pago');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
      setRevertId(null);
    }
  };

  const allPaymentsHistory = expenses
    .filter((e) => e.obligationId === obligation.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Pagos y detalles: ${obligation.name}`}>
        <div className="space-y-5">
          {/* Métricas de Saldo */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-surface-50 dark:bg-surface-800 p-3 rounded-xl border border-surface-200 dark:border-surface-700">
              <p className="text-xs text-surface-500 mb-0.5">Total</p>
              <p className="font-semibold text-surface-900 dark:text-white">
                {formatCurrency(obligation.amount, profile?.currency)}
              </p>
            </div>
            <div className="bg-sky-50 dark:bg-sky-950/40 p-3 rounded-xl border border-sky-200/60 dark:border-sky-800/50">
              <p className="text-xs text-sky-700 dark:text-sky-400 mb-0.5">Pagado</p>
              <p className="font-semibold text-sky-800 dark:text-sky-300">
                {formatCurrency(paidAmount, profile?.currency)}
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200/60 dark:border-amber-800/50">
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-0.5">Pendiente</p>
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                {formatCurrency(remainingAmount, profile?.currency)}
              </p>
            </div>
          </div>

          {/* Mensajes de Feedback */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Formulario de Pago */}
          {remainingAmount > 0.001 && obligation.status !== 'cancelled' ? (
            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              {/* Monto con inputMode decimal */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Monto a Pagar
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm font-medium">
                    {profile?.currency || 'RD$'}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    max={remainingAmount.toFixed(2)}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                    }}
                    placeholder="0.00"
                    className="w-full pl-14 pr-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-surface-900 dark:text-white"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                {/* Saldo Resultante en tiempo real */}
                {isValidAmount && (
                  <p className="text-xs text-surface-500 mt-1.5 flex justify-between">
                    <span>Saldo resultante después del pago:</span>
                    <span className="font-semibold text-surface-800 dark:text-surface-200">
                      {formatCurrency(resultingRemaining, profile?.currency)}
                    </span>
                  </p>
                )}
              </div>

              {/* Fecha Real y Período Financiero */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Fecha Real
                  </label>
                  <input
                    type="date"
                    value={realDate}
                    onChange={(e) => setRealDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Período Financiero
                  </label>
                  <input
                    type="text"
                    value={financialPeriod}
                    onChange={(e) => setFinancialPeriod(e.target.value)}
                    placeholder="YYYY-MM"
                    pattern="\d{4}-\d{2}"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Ciclo Quincenal asignado */}
              <div>
                <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Ciclo de Pago
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Q1', 'Q2', 'MONTHLY'] as PayCycle[]).map((cycle) => (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => setPayCycle(cycle)}
                      disabled={isSubmitting}
                      className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                        payCycle === cycle
                          ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-950/40 dark:border-primary-700 dark:text-primary-300 shadow-sm'
                          : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50 dark:bg-surface-900 dark:border-surface-700 dark:text-surface-400'
                      }`}
                    >
                      {cycle === 'MONTHLY' ? 'Mes Completo' : cycle === 'Q1' ? '1ra Quincena (Q1)' : '2da Quincena (Q2)'}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                isLoading={isSubmitting}
                disabled={!isValidAmount || isOverpaying || isSubmitting}
              >
                Registrar Pago
              </Button>
            </form>
          ) : (
            <div className="text-center py-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700">
              <p className="text-sm font-medium text-surface-600 dark:text-surface-300">
                {obligation.status === 'cancelled'
                  ? 'Esta obligación está cancelada. No admite nuevos pagos.'
                  : 'Esta obligación está totalmente pagada.'}
              </p>
            </div>
          )}

          {/* Historial de Pagos con Trazabilidad */}
          {allPaymentsHistory.length > 0 && (
            <div className="pt-3 border-t border-surface-200 dark:border-surface-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-surface-600 dark:text-surface-300">
                  Historial de Pagos ({allPaymentsHistory.length})
                </h4>
                <span className="text-[11px] text-surface-500 dark:text-surface-400">
                  {allPaymentsHistory.filter((p) => p.status !== 'reverted').length} activos · {allPaymentsHistory.filter((p) => p.status === 'reverted').length} revertidos
                </span>
              </div>
              <div className="space-y-2.5 max-h-60 overflow-y-auto sidebar-scrollbar pr-1">
                {allPaymentsHistory.map((payment) => {
                  const isReverted = payment.status === 'reverted';
                  return (
                    <div
                      key={payment.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                        isReverted
                          ? 'bg-surface-100/50 border-surface-200/60 dark:bg-surface-900/60 dark:border-surface-800 opacity-65'
                          : 'bg-surface-50/90 border-surface-200 dark:bg-surface-800 dark:border-surface-700 shadow-xs'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-bold text-sm sm:text-base ${
                              isReverted
                                ? 'line-through text-surface-400 dark:text-surface-500'
                                : 'text-surface-900 dark:text-white'
                            }`}
                          >
                            {formatCurrency(payment.amount, profile?.currency)}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-md border ${
                              isReverted
                                ? 'bg-surface-200/80 text-surface-700 border-surface-300 dark:bg-surface-700 dark:text-surface-300 dark:border-surface-600'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                            }`}
                          >
                            {isReverted ? 'Revertido' : 'Activo'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-surface-600 dark:text-surface-300">
                          <span>
                            <span className="text-surface-400 dark:text-surface-400">Fecha: </span>
                            <span className="font-semibold text-surface-800 dark:text-surface-200">{payment.realDate || payment.date}</span>
                          </span>
                          <span className="text-surface-300 dark:text-surface-600">•</span>
                          <span>
                            <span className="text-surface-400 dark:text-surface-400">Ciclo: </span>
                            <span className="font-semibold text-surface-800 dark:text-surface-200">{payment.payCycle === 'MONTHLY' ? 'Mes Completo' : payment.payCycle || 'Q1'}</span>
                          </span>
                          <span className="text-surface-300 dark:text-surface-600">•</span>
                          <span>
                            <span className="text-surface-400 dark:text-surface-400">Período: </span>
                            <span className="font-semibold text-surface-800 dark:text-surface-200">{payment.financialPeriod || payment.date.slice(0, 7)}</span>
                          </span>
                        </div>
                      </div>

                      {!isReverted && (
                        <button
                          type="button"
                          onClick={() => setRevertId(payment.id)}
                          disabled={isSubmitting}
                          className="self-start sm:self-auto px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 dark:border-rose-800 transition-colors flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95 disabled:opacity-50"
                          title="Revertir este pago"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span>Revertir</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!revertId}
        onClose={() => setRevertId(null)}
        onConfirm={handleRevert}
        title="Revertir Pago"
        description="¿Estás seguro de que deseas revertir este pago? El monto dejará de contar como gasto y se restituirá al saldo pendiente de la obligación."
        confirmText="Sí, Revertir"
        cancelText="Cancelar"
        variant="danger"
      />
    </>
  );
};
