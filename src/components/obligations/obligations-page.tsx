'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Check, Clock, CalendarCheck, Info } from 'lucide-react';
import { useStore } from '@/store';
import { Card, Button, EmptyState } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { Obligation, PayCycle } from '@/types';
import { ObligationForm } from './obligation-form';
import { CategoryIcon } from '@/components/category-icon';

export const ObligationsPage: React.FC = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const obligations = useStore((state) => state.obligations);
  const deleteObligation = useStore((state) => state.deleteObligation);
  const updateObligation = useStore((state) => state.updateObligation);
  const profile = useStore((state) => state.profile);
  const activePayCycle = useStore((state) => state.activePayCycle);
  const setActivePayCycle = useStore((state) => state.setActivePayCycle);

  const [showForm, setShowForm] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Sync cycle from URL query param
  useEffect(() => {
    const cycleParam = searchParams.get('cycle');
    if (
      cycleParam &&
      (cycleParam === 'Q1' || cycleParam === 'Q2' || cycleParam === 'MONTHLY') &&
      cycleParam !== activePayCycle
    ) {
      setActivePayCycle(cycleParam as PayCycle);
    }
  }, [searchParams, activePayCycle, setActivePayCycle]);

  const handleCycleChange = (cycle: PayCycle) => {
    setActivePayCycle(cycle);
    const params = new URLSearchParams(searchParams.toString());
    params.set('cycle', cycle);
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
  };

  const activeObligations = obligations
    .filter((o) => activePayCycle === 'MONTHLY' || o.payCycle === activePayCycle)
    .sort((a, b) => {
      // Pending first, then by amount
      if (a.isPaid === b.isPaid) {
        return b.amount - a.amount;
      }
      return a.isPaid ? 1 : -1;
    });

  const totalCommitted = activeObligations.reduce((sum, o) => sum + o.amount, 0);
  const totalPaid = activeObligations.filter((o) => o.isPaid).reduce((sum, o) => sum + o.amount, 0);
  const totalPending = totalCommitted - totalPaid;

  const handleEdit = (obligation: Obligation) => {
    setEditingObligation(obligation);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteExpense(deleteId);
      setDeleteId(null);
    }
  };

  const deleteExpense = deleteObligation; // alias for clarity

  const togglePaidStatus = async (obligation: Obligation) => {
    await updateObligation(obligation.id, { isPaid: !obligation.isPaid });
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-white">
              Obligaciones
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60">
              Gastos Fijos Fechados
            </span>
          </div>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
            Compromisos ineludibles con fecha límite (alquiler, préstamos, servicios fijos, seguros)
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* PayCycle Selector with URL persistence */}
          <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-xl shrink-0 border border-surface-200 dark:border-surface-700">
            {(['Q1', 'Q2', 'MONTHLY'] as const).map((cycle) => (
              <button
                key={cycle}
                onClick={() => handleCycleChange(cycle)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activePayCycle === cycle
                    ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-400 shadow-soft-xs'
                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                }`}
              >
                {cycle === 'MONTHLY' ? 'Mes Completo' : cycle}
              </button>
            ))}
          </div>

          <Button
            onClick={() => {
              setEditingObligation(undefined);
              setShowForm(true);
            }}
            className="shrink-0"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Obligación
          </Button>
        </div>
      </div>

      {/* Educational banner clarifying Fijos vs Presupuesto */}
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-800/40 text-sky-950 dark:text-sky-200 text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
        <p>
          <strong className="font-semibold">Compromisos Fijos:</strong> Estas partidas se descuentan
          directamente de tus ingresos para calcular tu <strong className="font-semibold">Disponible Libre</strong>.
          Para establecer techos y metas de ahorro en gastos cotidianos variables (comida, salidas),
          utiliza la sección <strong className="underline decoration-sky-500 font-semibold">Presupuestos</strong>.
        </p>
      </div>

      {/* Standardized Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white dark:bg-surface-800 border-surface-200/80 dark:border-surface-700">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">
            Total Comprometido
          </p>
          <p className="text-2xl font-bold text-surface-900 dark:text-white">
            {formatCurrency(totalCommitted, profile?.currency)}
          </p>
          <p className="text-xs text-surface-400 mt-1">
            {activeObligations.length} {activeObligations.length === 1 ? 'obligación' : 'obligaciones'} en {activePayCycle === 'MONTHLY' ? 'el mes' : activePayCycle}
          </p>
        </Card>

        <Card className="p-5 bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Confirmado / Pagado
            </p>
            <StatusBadge status="confirmed" context="obligation" size="xs" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(totalPaid, profile?.currency)}
          </p>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
            Obligaciones ya liquidadas
          </p>
        </Card>

        <Card className="p-5 bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Pendiente por Pagar
            </p>
            <StatusBadge status="pending" context="obligation" size="xs" />
          </div>
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">
            {formatCurrency(totalPending, profile?.currency)}
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
            Por cubrir en esta quincena/ciclo
          </p>
        </Card>
      </div>

      {/* Obligations List */}
      <Card className="overflow-hidden border-surface-200/80 dark:border-surface-700">
        {activeObligations.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-12 h-12 text-surface-400" />}
            title="Sin obligaciones registradas"
            description={`No tienes compromisos fijos configurados para ${
              activePayCycle === 'MONTHLY' ? 'el mes completo' : activePayCycle
            }.`}
            action={
              <Button
                onClick={() => {
                  setEditingObligation(undefined);
                  setShowForm(true);
                }}
              >
                Añadir Obligación Fija
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {activeObligations.map((obligation, index) => (
              <motion.div
                key={obligation.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50 ${
                  obligation.isPaid ? 'bg-surface-50/40 dark:bg-surface-900/40' : ''
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <button
                    onClick={() => togglePaidStatus(obligation)}
                    aria-label={obligation.isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                      obligation.isPaid
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-soft-xs'
                        : 'border-surface-300 dark:border-surface-600 text-transparent hover:border-emerald-500'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <CategoryIcon category={obligation.category} />
                  <div>
                    <h3
                      className={`font-semibold text-sm ${
                        obligation.isPaid
                          ? 'text-surface-400 line-through'
                          : 'text-surface-900 dark:text-white'
                      }`}
                    >
                      {obligation.name}
                    </h3>
                    <p className="text-xs text-surface-400">
                      Ciclo:{' '}
                      <span className="font-medium text-surface-600 dark:text-surface-300">
                        {obligation.payCycle === 'MONTHLY' ? 'Mensual' : obligation.payCycle}
                      </span>
                      {obligation.dueDate && (
                        <> · Vence día {new Date(obligation.dueDate).getDate()}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5 ml-11 sm:ml-0">
                  <div className="text-left sm:text-right">
                    <p
                      className={`font-bold text-sm ${
                        obligation.isPaid
                          ? 'text-surface-400'
                          : 'text-surface-900 dark:text-white'
                      }`}
                    >
                      {formatCurrency(obligation.amount, profile?.currency)}
                    </p>
                    <div className="mt-0.5">
                      <StatusBadge
                        status={obligation.isPaid ? 'confirmed' : 'pending'}
                        context="obligation"
                        size="xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(obligation)}
                      className="text-xs"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
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
        title={editingObligation ? 'Editar Obligación Fija' : 'Nueva Obligación Fija'}
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
        description="¿Estás seguro de que deseas eliminar esta obligación fija? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
};
