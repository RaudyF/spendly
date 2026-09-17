'use client';

import React, { useState } from 'react';
import { AlertTriangle, Unlock } from 'lucide-react';
import { Modal } from '@/components/ui/modal-base';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';
import { PeriodCycle } from '@/types';
import { getMonthName } from '@/lib/utils';

interface PeriodReopenModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: string;
  cycle: PeriodCycle;
}

export const PeriodReopenModal: React.FC<PeriodReopenModalProps> = ({
  isOpen,
  onClose,
  period,
  cycle,
}) => {
  const reopenPeriod = useStore((state) => state.reopenPeriod);

  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirmReopen = async () => {
    if (!reason.trim() || reason.trim().length < 5) {
      setErrorMsg('Por favor especifica un motivo válido de reapertura (mínimo 5 caracteres).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await reopenPeriod({ period, cycle, reason: reason.trim() });
      setReason('');
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e?.message || 'Error al reabrir el período.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reapertura de Período — ${getMonthName(period)} ${cycle === 'MONTHLY' ? '(Mes Completo)' : `(${cycle})`}`}
      description="Reabrir un período permite registrar o modificar movimientos pasados."
      size="md"
    >
      <div className="space-y-4 pt-2">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold">Consecuencias de la reapertura:</p>
            <ul className="list-disc list-inside space-y-0.5 opacity-90">
              <li>El resumen financiero congelado dejará de ser definitivo.</li>
              <li>Cualquier arrastre generado al momento del cierre anterior será cancelado.</li>
              <li>Deberás volver a cerrar el período una vez concluidos los ajustes.</li>
            </ul>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
            Motivo de reapertura <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="Ej: Registro de factura médica tardía, ajuste de quincena..."
            className="w-full text-sm p-3 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-[11px] text-surface-400 mt-1">
            Este motivo quedará registrado en el historial de auditoría del período.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleConfirmReopen}
            isLoading={isSubmitting}
            leftIcon={<Unlock className="w-4 h-4" />}
          >
            Reabrir Período
          </Button>
        </div>
      </div>
    </Modal>
  );
};
