'use client';

import React, { useState } from 'react';
import { useStore } from '@/store';
import { Input, Button } from '@/components/ui';
import { CategoryType, Obligation, PayCycle } from '@/types';
import { CATEGORIES } from '@/lib/constants';
import { CategoryIcon } from '@/components/category-icon';

interface ObligationFormProps {
  initialData?: Obligation;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ObligationForm: React.FC<ObligationFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
}) => {
  const addObligation = useStore((state) => state.addObligation);
  const updateObligation = useStore((state) => state.updateObligation);
  const activePayCycle = useStore((state) => state.activePayCycle);
  const viewingPeriod = useStore((state) => state.viewingPeriod);
  
  const [name, setName] = useState(initialData?.name || '');
  const [amount, setAmount] = useState(initialData?.amount.toString() || '');
  const [category, setCategory] = useState<CategoryType>(initialData?.category || 'utilities');
  const [payCycle, setPayCycle] = useState<PayCycle>(initialData?.payCycle || activePayCycle);
  const [dueDate, setDueDate] = useState<string>(
    initialData?.dueDate || `${initialData?.period || viewingPeriod}-15`
  );
  const [isPaid, setIsPaid] = useState(initialData?.isPaid || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setIsSubmitting(true);
    try {
      const data = {
        name: name.trim(),
        amount: numAmount,
        category,
        payCycle,
        dueDate: dueDate || undefined,
        isPaid,
        period: initialData?.period || (dueDate ? dueDate.slice(0, 7) : viewingPeriod),
      };

      if (initialData) {
        await updateObligation(initialData.id, data);
      } else {
        await addObligation(data);
      }
      onSuccess();
    } catch (error) {
      console.error('Failed to save obligation:', error);
      setError('Error al guardar la obligación');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
            Nombre
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Alquiler, Luz, Internet"
            autoFocus
          />
        </div>

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
            Categoría
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-48 overflow-y-auto p-1">
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
                <span className="text-sm truncate">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Fecha de Vencimiento
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => {
                const newDate = e.target.value;
                setDueDate(newDate);
                if (newDate) {
                  const day = parseInt(newDate.split('-')[2], 10);
                  if (day <= 15 && payCycle !== 'Q1') setPayCycle('Q1');
                  else if (day > 15 && payCycle !== 'Q2') setPayCycle('Q2');
                }
              }}
            />
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
              <option value="MONTHLY">Mes Completo</option>
              <option value="Q1">Primera Quincena (Q1)</option>
              <option value="Q2">Segunda Quincena (Q2)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
              className="rounded border-surface-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
            />
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Registrar como totalmente pagada
            </span>
          </label>
        </div>
        
        {error && (
          <p className="text-sm text-danger-500">{error}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-800">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {initialData ? 'Actualizar' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
};
