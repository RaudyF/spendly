'use client';

import React, { useState } from 'react';
import { useStore } from '@/store';
import { Button, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';

// Budget Setup Modal
interface BudgetSetupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BudgetSetupModal: React.FC<BudgetSetupProps> = ({ isOpen, onClose }) => {
  const profile = useStore((state) => state.profile);
  const initializeDefaultBudgets = useStore((state) => state.initializeDefaultBudgets);
  const [income, setIncome] = useState(profile?.monthlyIncome?.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSetup = async () => {
    if (!income) return;
    setIsSubmitting(true);
    try {
      await initializeDefaultBudgets(parseFloat(income));
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurar Presupuesto" size="md">
      <div className="space-y-6">
        <p className="text-neutral-500">
          Configuraremos un presupuesto sugerido basado en tus ingresos usando la regla 50/30/20.
        </p>

        <Input
          type="number"
          label="Ingreso Mensual"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
          placeholder="Ingresa tu ingreso mensual"
          leftElement={<span className="text-lg">$</span>}
        />

        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
          <h4 className="font-medium text-neutral-900 dark:text-white mb-3">
            Desglose Sugerido
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Necesidades (50%)</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(income || '0') * 0.5)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Deseos (30%)</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(income || '0') * 0.3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Ahorros (20%)</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(income || '0') * 0.2)}
              </span>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleSetup}
          isLoading={isSubmitting}
          disabled={!income}
        >
          Crear Presupuesto
        </Button>
      </div>
    </Modal>
  );
};
