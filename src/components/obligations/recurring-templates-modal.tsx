'use client';

import React, { useState } from 'react';
import { useStore } from '@/store';
import { Button, Card, EmptyState } from '@/components/ui';
import { RecurringObligation } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { CategoryIcon } from '@/components/category-icon';
import { Plus, Edit2, Trash2, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { RecurringObligationForm } from './recurring-obligation-form';
import { ConfirmDialog } from '@/components/ui/modal';

export const RecurringTemplatesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const recurringObligations = useStore((state) => state.recurringObligations);
  const deleteRecurringObligation = useStore((state) => state.deleteRecurringObligation);
  const profile = useStore((state) => state.profile);

  const [editingTemplate, setEditingTemplate] = useState<RecurringObligation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteRecurringObligation(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-5">
      {isCreating || editingTemplate ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-surface-900 dark:text-white">
              {editingTemplate ? 'Editar Plantilla Recurrente' : 'Nueva Plantilla Recurrente'}
            </h3>
          </div>
          <RecurringObligationForm
            initialData={editingTemplate || undefined}
            onSuccess={() => {
              setIsCreating(false);
              setEditingTemplate(null);
            }}
            onCancel={() => {
              setIsCreating(false);
              setEditingTemplate(null);
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-50 dark:bg-surface-900/60 p-3.5 rounded-xl border border-surface-200 dark:border-surface-800">
            <div>
              <p className="text-sm font-semibold text-surface-900 dark:text-white">
                Gastos Fijos Programados
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Guarda tus pagos repetitivos (alquiler, luz, internet o préstamos) para agregarlos automáticamente a tus meses con un solo clic.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Plantilla</span>
            </Button>
          </div>

          {recurringObligations.length === 0 ? (
            <EmptyState
              title="No hay plantillas configuradas"
              description="Crea plantillas para compromisos recurrentes como alquiler, servicios o préstamos."
              action={
                <Button size="sm" onClick={() => setIsCreating(true)} className="mt-2">
                  Crear mi primera plantilla
                </Button>
              }
            />
          ) : (
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {recurringObligations.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-800/80 hover:border-surface-300 dark:hover:border-surface-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon category={tpl.category} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-surface-900 dark:text-white truncate">
                          {tpl.name}
                        </span>
                        {tpl.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-surface-400 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> Inactiva
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-surface-500 mt-1 flex-wrap">
                        <span className="font-medium text-surface-700 dark:text-surface-300">
                          {formatCurrency(tpl.amount, profile?.currency)}
                        </span>
                        <span>•</span>
                        <span>Día {tpl.dayOfMonth} ({tpl.payCycle === 'MONTHLY' ? 'Mes' : tpl.payCycle})</span>
                        <span>•</span>
                        <span className="capitalize">{tpl.frequency === 'biweekly' ? 'Quincenal' : 'Mensual'}</span>
                        <span>•</span>
                        <span>Desde: {tpl.startDate}</span>
                        {tpl.endDate && <span>hasta: {tpl.endDate}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => setEditingTemplate(tpl)}
                      className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                      title="Editar plantilla"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(tpl.id)}
                      className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/40 transition-colors"
                      title="Eliminar plantilla"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-surface-200 dark:border-surface-800">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* Confirmación para borrar plantilla */}
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Eliminar Plantilla Recurrente"
        description="¿Estás seguro de que deseas eliminar esta plantilla recurrente? Las obligaciones ya generadas en períodos previos no se eliminarán."
        confirmText="Eliminar Plantilla"
        variant="danger"
      />
    </div>
  );
};
