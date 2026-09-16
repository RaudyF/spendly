'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, Clock } from 'lucide-react';
import { useStore } from '@/store';
import { Card, Button, EmptyState } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { Obligation } from '@/types';
import { ObligationForm } from './obligation-form';
import { CategoryIcon } from '@/components/category-icon';

export const ObligationsPage: React.FC = () => {
  const obligations = useStore((state) => state.obligations);
  const deleteObligation = useStore((state) => state.deleteObligation);
  const updateObligation = useStore((state) => state.updateObligation);
  const profile = useStore((state) => state.profile);
  const activePayCycle = useStore((state) => state.activePayCycle);
  const setActivePayCycle = useStore((state) => state.setActivePayCycle);
  const currentMonth = useStore((state) => state.currentMonth);
  
  const [showForm, setShowForm] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const activeObligations = obligations
    .filter((o) => activePayCycle === 'MONTHLY' || o.payCycle === activePayCycle)
    .sort((a, b) => {
      // Sort by status (pending first) then by amount
      if (a.isPaid === b.isPaid) {
        return b.amount - a.amount;
      }
      return a.isPaid ? 1 : -1;
    });

  const totalCommitted = activeObligations.reduce((sum, o) => sum + o.amount, 0);
  const totalPaid = activeObligations.filter(o => o.isPaid).reduce((sum, o) => sum + o.amount, 0);
  const totalPending = totalCommitted - totalPaid;

  const handleEdit = (obligation: Obligation) => {
    setEditingObligation(obligation);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteObligation(deleteId);
      setDeleteId(null);
    }
  };

  const togglePaidStatus = async (obligation: Obligation) => {
    await updateObligation(obligation.id, { isPaid: !obligation.isPaid });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            Obligaciones
          </h1>
          <p className="text-surface-500 dark:text-surface-400">
            Administra tus compromisos financieros recurrentes
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* PayCycle Selector */}
          <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-lg shrink-0 border border-surface-200 dark:border-surface-700">
            {(['Q1', 'Q2', 'MONTHLY'] as const).map((cycle) => (
              <button
                key={cycle}
                onClick={() => setActivePayCycle(cycle)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activePayCycle === cycle
                    ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                }`}
              >
                {cycle === 'MONTHLY' ? 'Mes Completo' : cycle}
              </button>
            ))}
          </div>
          
          <Button onClick={() => {
            setEditingObligation(undefined);
            setShowForm(true);
          }} className="shrink-0">
            <Plus className="w-5 h-5 mr-2" />
            Nueva Obligación
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-surface-50 dark:bg-surface-800/50">
          <p className="text-sm text-surface-500 mb-1">Total Comprometido</p>
          <p className="text-2xl font-bold text-surface-900 dark:text-white">
            {formatCurrency(totalCommitted, profile?.currency)}
          </p>
        </Card>
        <Card className="p-4 bg-success-50 dark:bg-success-900/10 border-success-200 dark:border-success-800">
          <p className="text-sm text-success-600 dark:text-success-400 mb-1">Pagado</p>
          <p className="text-2xl font-bold text-success-700 dark:text-success-300">
            {formatCurrency(totalPaid, profile?.currency)}
          </p>
        </Card>
        <Card className="p-4 bg-warning-50 dark:bg-warning-900/10 border-warning-200 dark:border-warning-800">
          <p className="text-sm text-warning-600 dark:text-warning-400 mb-1">Pendiente</p>
          <p className="text-2xl font-bold text-warning-700 dark:text-warning-300">
            {formatCurrency(totalPending, profile?.currency)}
          </p>
        </Card>
      </div>

      {/* List */}
      <Card>
        {activeObligations.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-12 h-12" />}
            title="Sin obligaciones"
            description={`No hay obligaciones configuradas para ${activePayCycle === 'MONTHLY' ? 'el mes completo' : activePayCycle}.`}
            action={
              <Button onClick={() => {
                setEditingObligation(undefined);
                setShowForm(true);
              }}>
                Añadir Obligación
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-surface-200 dark:divide-surface-800">
            {activeObligations.map((obligation, index) => (
              <motion.div
                key={obligation.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50 ${
                  obligation.isPaid ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => togglePaidStatus(obligation)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors shrink-0 ${
                      obligation.isPaid 
                        ? 'bg-success-500 border-success-500 text-white' 
                        : 'border-surface-300 dark:border-surface-600 text-transparent hover:border-success-500'
                    }`}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <CategoryIcon category={obligation.category} />
                  <div>
                    <h3 className={`font-medium ${
                      obligation.isPaid ? 'text-surface-500 line-through' : 'text-surface-900 dark:text-white'
                    }`}>
                      {obligation.name}
                    </h3>
                    <p className="text-sm text-surface-500">
                      Ciclo: {obligation.payCycle === 'MONTHLY' ? 'Mensual' : obligation.payCycle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 ml-12 sm:ml-0">
                  <div className="text-left sm:text-right">
                    <p className={`font-semibold ${
                      obligation.isPaid ? 'text-surface-500' : 'text-surface-900 dark:text-white'
                    }`}>
                      {formatCurrency(obligation.amount, profile?.currency)}
                    </p>
                    <p className="text-xs text-surface-500">
                      {obligation.isPaid ? 'Pagado' : 'Pendiente'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(obligation)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger-600 hover:text-danger-700 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                      onClick={() => setDeleteId(obligation.id)}
                    >
                      Borrar
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingObligation ? 'Editar Obligación' : 'Nueva Obligación'}
      >
        <ObligationForm
          initialData={editingObligation}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar Obligación"
        description="¿Estás seguro de que deseas eliminar esta obligación? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
};
