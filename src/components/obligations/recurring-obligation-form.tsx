'use client';

import React, { useState } from 'react';
import { useStore } from '@/store';
import { Input, Button } from '@/components/ui';
import { CategoryType, PayCycle, RecurrenceFrequency, RecurringObligation } from '@/types';
import { CATEGORIES } from '@/lib/constants';
import { CategoryIcon } from '@/components/category-icon';
import { getCurrentMonth } from '@/lib/utils';
import { AlertTriangle, Info } from 'lucide-react';

interface RecurringObligationFormProps {
  initialData?: RecurringObligation;
  onSuccess: () => void;
  onCancel: () => void;
}

export const RecurringObligationForm: React.FC<RecurringObligationFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
}) => {
  const addRecurringObligation = useStore((state) => state.addRecurringObligation);
  const updateRecurringObligation = useStore((state) => state.updateRecurringObligation);
  const viewingPeriod = useStore((state) => state.viewingPeriod);

  const currentSystemMonth = getCurrentMonth();
  const effectiveViewingPeriod = viewingPeriod || currentSystemMonth;
  const isViewingHistorical = effectiveViewingPeriod < currentSystemMonth;
  const isViewingFuture = effectiveViewingPeriod > currentSystemMonth;

  const [name, setName] = useState(initialData?.name || '');
  const [amount, setAmount] = useState(initialData?.amount.toString() || '');
  const [category, setCategory] = useState<CategoryType>(initialData?.category || 'utilities');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(initialData?.frequency || 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState<number>(initialData?.dayOfMonth || 1);
  const [payCycle, setPayCycle] = useState<PayCycle>(initialData?.payCycle || 'Q1');
  const [startDate, setStartDate] = useState(initialData?.startDate || effectiveViewingPeriod);
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [isActive, setIsActive] = useState(initialData?.isActive !== undefined ? initialData.isActive : true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistoricalConfirm, setShowHistoricalConfirm] = useState(false);

  // Auto-ajuste sugerido de ciclo al cambiar día de vencimiento
  const handleDayChange = (day: number) => {
    const safeDay = Math.min(31, Math.max(1, day));
    setDayOfMonth(safeDay);
    if (safeDay <= 15 && payCycle !== 'Q1') {
      setPayCycle('Q1');
    } else if (safeDay > 15 && payCycle !== 'Q2') {
      setPayCycle('Q2');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Monto inválido');
      return;
    }

    if (dayOfMonth < 1 || dayOfMonth > 31) {
      setError('El día de vencimiento debe estar entre 1 y 31');
      return;
    }

    if (!startDate) {
      setError('La fecha de inicio es requerida');
      return;
    }

    if (endDate && endDate < startDate) {
      setError('La fecha final no puede ser anterior a la fecha de inicio');
      return;
    }

    // Regla de Auditoría: si el período visualizado es histórico, solicitar confirmación antes de guardar
    if (isViewingHistorical && !showHistoricalConfirm) {
      setShowHistoricalConfirm(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        name: name.trim(),
        amount: numAmount,
        category,
        frequency,
        dayOfMonth,
        payCycle,
        startDate: startDate.slice(0, 7),
        endDate: endDate ? endDate.slice(0, 7) : undefined,
        isActive,
      };

      if (initialData) {
        await updateRecurringObligation(initialData.id, data);
      } else {
        await addRecurringObligation(data);
      }
      onSuccess();
    } catch (err: any) {
      console.error('Failed to save recurring obligation template:', err);
      setError(err?.message || 'Error al guardar la plantilla recurrente');
    } finally {
      setIsSubmitting(false);
      setShowHistoricalConfirm(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
            Nombre del Pago Fijo
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Internet Hogar, Préstamo, Alquiler"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Monto
            </label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Frecuencia
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
              className="flex h-10 w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
            >
              <option value="monthly">Mensual</option>
              <option value="biweekly">Quincenal</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Día de Vencimiento (1 - 31)
            </label>
            <Input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => handleDayChange(parseInt(e.target.value, 10) || 1)}
              placeholder="Día del mes (ej. 31)"
            />
            <p className="text-[11px] text-surface-500 mt-1">
              Si el mes tiene menos días (ej. 28 en febrero o 30 en abril), se ajustará automáticamente al último día real.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Ciclo de Pago
            </label>
            <select
              value={payCycle}
              onChange={(e) => setPayCycle(e.target.value as PayCycle)}
              className="flex h-10 w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
            >
              <option value="Q1">1ra Quincena (Q1, días 1-15)</option>
              <option value="Q2">2da Quincena (Q2, días 16-fin de mes)</option>
              <option value="MONTHLY">Mes Completo</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              A partir de qué mes
            </label>
            <Input
              type="month"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Hasta qué mes (opcional)
            </label>
            <Input
              type="month"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Indefinido"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
            Categoría
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-40 overflow-y-auto p-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                  category === cat.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                }`}
              >
                <CategoryIcon category={cat.id} size="sm" />
                <span className="text-xs truncate">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-surface-200 dark:border-surface-800">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-surface-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
            />
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Pago activo (se generará automáticamente en sus meses programados)
            </span>
          </label>
        </div>

        {/* Indicador claro para períodos futuros */}
        {isViewingFuture && (
          <div className="flex items-start gap-2.5 p-3 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 text-primary-800 dark:text-primary-300 text-xs rounded-xl">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Período que será generado:</p>
              <p className="mt-0.5">
                Estás visualizando el mes futuro <span className="font-bold underline">{effectiveViewingPeriod}</span>. Si este pago fijo inicia en o antes de {effectiveViewingPeriod}, se incluirá automáticamente en este período.
              </p>
            </div>
          </div>
        )}

        {/* Solicitud de confirmación para períodos históricos */}
        {showHistoricalConfirm && isViewingHistorical && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl space-y-2">
            <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold text-sm">¿Confirmas guardar en un período histórico?</p>
                <p className="mt-0.5 text-surface-600 dark:text-surface-300">
                  Estás editando en el mes pasado <span className="font-semibold">{effectiveViewingPeriod}</span>. Los cambios actualizarán únicamente las instancias sin pagos de este mes y aplicarán hacia períodos futuros. Los pagos ya registrados o cancelados no serán modificados.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowHistoricalConfirm(false)}
                className="text-xs h-8"
              >
                Revisar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  // Bypass check directly
                  handleSubmit(new Event('submit') as any);
                }}
                isLoading={isSubmitting}
                className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white border-0"
              >
                Sí, Confirmar y Guardar
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-danger-500">{error}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-800">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {initialData ? 'Actualizar Pago' : 'Guardar Pago'}
        </Button>
      </div>
    </form>
  );
};
