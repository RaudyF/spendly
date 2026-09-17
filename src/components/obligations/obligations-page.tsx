'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  CreditCard,
  Ban,
  Trash2,
  Edit3,
  MoreVertical,
  ChevronRight,
  Archive,
  AlertCircle,
  Repeat,
  CheckCircle2,
} from 'lucide-react';
import { useStore } from '@/store';
import { Card, Button, EmptyState } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Obligation, PayCycle, ObligationStatus } from '@/types';
import { ObligationForm } from './obligation-form';
import { RecurringTemplatesModal } from './recurring-templates-modal';
import { CategoryIcon } from '@/components/category-icon';
import { TimeNavigator } from '@/components/layout/time-navigator';
import { PaymentModal } from './payment-modal';
import { PeriodStatusBadge } from '@/components/period';
import {
  getSantoDomingoTodayString,
  getObligationPaidAmount,
  getObligationRemainingAmount,
  calculateObligationEffectiveStatus,
} from '@/lib/obligations';

export const ObligationsPage: React.FC = () => {
  const viewingPeriod = useStore((state) => state.viewingPeriod);
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const obligations = useStore((state) => state.obligations);
  const expenses = useStore((state) => state.expenses);
  const deleteObligation = useStore((state) => state.deleteObligation);
  const cancelObligation = useStore((state) => state.cancelObligation);
  const profile = useStore((state) => state.profile);
  const activePayCycle = useStore((state) => state.activePayCycle);
  const setActivePayCycle = useStore((state) => state.setActivePayCycle);
  const recurringObligations = useStore((state) => state.recurringObligations);
  const periodStates = useStore((state) => state.periodStates);

  const isPeriodClosed = periodStates.some(
    (ps) =>
      ps.period === viewingPeriod &&
      (activePayCycle === 'MONTHLY' ? ps.cycle === 'MONTHLY' : ps.cycle === activePayCycle || ps.cycle === 'MONTHLY') &&
      ps.status === 'closed'
  );

  const [showForm, setShowForm] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [blockedDeleteObligation, setBlockedDeleteObligation] = useState<Obligation | null>(null);
  const [paymentObligation, setPaymentObligation] = useState<Obligation | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Cerrar menú con tecla Escape o clic fuera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openMenuId) {
        setOpenMenuId(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-obligation-menu]')) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuId]);

  // Sincronizar ciclo quincenal desde la URL
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

  const todayStr = getSantoDomingoTodayString();

  // Filtrar obligaciones por viewingPeriod y ciclo activo
  const activeObligations = obligations
    .filter((o) => {
      const obligationPeriod = o.period || (o.dueDate || o.createdAt).slice(0, 7);
      return obligationPeriod === viewingPeriod;
    })
    .filter((o) => activePayCycle === 'MONTHLY' || o.payCycle === activePayCycle)
    .sort((a, b) => {
      const statusA = calculateObligationEffectiveStatus(a, expenses, todayStr);
      const statusB = calculateObligationEffectiveStatus(b, expenses, todayStr);
      
      const priorityOrder: Record<ObligationStatus, number> = {
        overdue: 1,
        partial: 2,
        pending: 3,
        paid: 4,
        cancelled: 5,
      };

      const orderA = priorityOrder[statusA] || 99;
      const orderB = priorityOrder[statusB] || 99;

      if (orderA !== orderB) return orderA - orderB;
      return b.amount - a.amount;
    });

  // Métricas financieras del período y ciclo actual
  const totalCommitted = activeObligations.reduce((sum, o) => {
    return sum + getObligationRemainingAmount(o, expenses);
  }, 0);

  const totalPaid = activeObligations.reduce((sum, o) => {
    return sum + getObligationPaidAmount(o.id, expenses);
  }, 0);

  const totalOriginal = activeObligations.reduce((sum, o) => sum + o.amount, 0);

  const handleEdit = (obligation: Obligation) => {
    setEditingObligation(obligation);
    setShowForm(true);
    setOpenMenuId(null);
  };

  const handleDeleteRequest = (obligation: Obligation) => {
    setOpenMenuId(null);
    const paidAmount = getObligationPaidAmount(obligation.id, expenses);
    if (paidAmount > 0) {
      setBlockedDeleteObligation(obligation);
    } else {
      setDeleteId(obligation.id);
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteObligation(deleteId);
      setDeleteId(null);
    }
  };

  const handleCancelRequest = (obligationId: string) => {
    setOpenMenuId(null);
    setCancelId(obligationId);
  };

  const handleCancelConfirm = async () => {
    if (cancelId) {
      await cancelObligation(cancelId);
      setCancelId(null);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-white">
              Obligaciones
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60">
              Pagos Fijos del Mes
            </span>
          </div>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Administra tus pagos obligatorios del mes (alquiler, préstamos, servicios y cuotas) con sus fechas límite.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Botón Gestión de Plantillas Recurrentes */}
          <Button
            variant="outline"
            onClick={() => setShowRecurringModal(true)}
            className="flex items-center gap-1.5 text-xs"
          >
            <Repeat className="w-3.5 h-3.5 text-primary-500" />
            <span>Pagos Recurrentes ({recurringObligations.length})</span>
          </Button>

          {/* Botón Nueva Obligación Manual */}
          <Button
            onClick={() => {
              setEditingObligation(undefined);
              setShowForm(true);
            }}
            className="flex items-center gap-2 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Pago Fijo</span>
          </Button>
        </div>
      </div>

      {/* Navegador Temporal */}
      <TimeNavigator />

      {/* Selector de Ciclo: Q1, Q2, Mes & Period Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-xl w-fit border border-surface-200 dark:border-surface-700">
          <button
            onClick={() => handleCycleChange('Q1')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activePayCycle === 'Q1'
                ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-300 shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900'
            }`}
          >
            1ra Quincena (Q1)
          </button>
          <button
            onClick={() => handleCycleChange('Q2')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activePayCycle === 'Q2'
                ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-300 shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900'
            }`}
          >
            2da Quincena (Q2)
          </button>
          <button
            onClick={() => handleCycleChange('MONTHLY')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activePayCycle === 'MONTHLY'
                ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-300 shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900'
            }`}
          >
            Mes Completo
          </button>
        </div>

        <PeriodStatusBadge
          status={isPeriodClosed ? 'closed' : 'open'}
          cycle={activePayCycle}
        />
      </div>

      {isPeriodClosed && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
          <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            Este período está <strong>cerrado</strong>. El balance financiero fue congelado. Para realizar cambios o ajustes en este ciclo, reabre el período desde el Panel Principal.
          </span>
        </div>
      )}

      {/* Tarjetas de Resumen Financiero */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-amber-500">
          <p className="text-xs text-surface-500 font-medium">Total Comprometido (Pendiente)</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(totalCommitted, profile?.currency)}
          </p>
          <p className="text-[11px] text-surface-400 mt-1">Saldo restante por pagar este ciclo</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <p className="text-xs text-surface-500 font-medium">Total Pagado</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(totalPaid, profile?.currency)}
          </p>
          <p className="text-[11px] text-surface-400 mt-1">Pagos ejecutados y confirmados</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-surface-300 dark:border-l-surface-600">
          <p className="text-xs text-surface-500 font-medium">Monto Original Presupuestado</p>
          <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
            {formatCurrency(totalOriginal, profile?.currency)}
          </p>
          <p className="text-[11px] text-surface-400 mt-1">{activeObligations.length} obligaciones registradas</p>
        </Card>
      </div>

      {/* Listado de Obligaciones */}
      <Card className="overflow-visible">
        {activeObligations.length === 0 ? (
          <EmptyState
            title="Sin obligaciones para este ciclo"
            description="No hay obligaciones fijas registradas para el período y quincena seleccionados."
            action={
              <Button
                onClick={() => {
                  setEditingObligation(undefined);
                  setShowForm(true);
                }}
                className="mt-2"
              >
                Crear Obligación
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-surface-200 dark:divide-surface-700">
            {activeObligations.map((obligation, index) => {
              const paidAmount = getObligationPaidAmount(obligation.id, expenses);
              const remainingAmount = getObligationRemainingAmount(obligation, expenses);
              const effectiveStatus = calculateObligationEffectiveStatus(obligation, expenses, todayStr);
              const isPaid = effectiveStatus === 'paid';
              const isCancelled = effectiveStatus === 'cancelled';
              const isOverdue = effectiveStatus === 'overdue';
              const isMenuOpen = openMenuId === obligation.id;
              const isNearBottom = index >= activeObligations.length - 2 && activeObligations.length > 2;

              return (
                <motion.div
                  key={obligation.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Obligación ${obligation.name}, abrir pagos y detalles`}
                  onClick={() => setPaymentObligation(obligation)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPaymentObligation(obligation);
                    }
                  }}
                  className={`group relative p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset select-none ${
                    isMenuOpen ? 'z-40' : 'z-0'
                  } ${
                    isCancelled
                      ? 'bg-surface-50/50 dark:bg-surface-900/40 opacity-70 hover:bg-surface-100/60 dark:hover:bg-surface-800/60'
                      : isPaid
                      ? 'bg-emerald-50/10 dark:bg-emerald-950/10 hover:bg-emerald-50/25 dark:hover:bg-emerald-950/20'
                      : isOverdue
                      ? 'bg-rose-50/20 dark:bg-rose-950/10 hover:bg-rose-50/35 dark:hover:bg-rose-950/20'
                      : 'hover:bg-surface-100/70 dark:hover:bg-surface-800/60 active:bg-surface-100 dark:active:bg-surface-800/80'
                  }`}
                >
                  {/* Información Principal */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="shrink-0 mt-0.5 sm:mt-0 transition-transform group-hover:scale-105">
                      <CategoryIcon category={obligation.category} size="md" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className={`font-semibold text-base truncate transition-colors ${
                            isCancelled
                              ? 'line-through text-surface-400'
                              : isPaid
                              ? 'text-surface-700 dark:text-surface-300 group-hover:text-surface-900 dark:group-hover:text-white'
                              : 'text-surface-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400'
                          }`}
                        >
                          {obligation.name}
                        </h3>

                        <StatusBadge
                          status={effectiveStatus}
                          context="obligation"
                          size="xs"
                        />

                        {obligation.payCycle && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300">
                            {obligation.payCycle === 'MONTHLY' ? 'Mes' : obligation.payCycle}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-surface-500 mt-1 flex-wrap">
                        {obligation.dueDate && (
                          <span>Vence: {formatDate(obligation.dueDate)}</span>
                        )}
                        {paidAmount > 0 && remainingAmount > 0 && (
                          <span className="text-sky-600 dark:text-sky-400 font-medium">
                            Pagado: {formatCurrency(paidAmount, profile?.currency)}
                          </span>
                        )}
                        {remainingAmount > 0 && !isCancelled && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            Pendiente: {formatCurrency(remainingAmount, profile?.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Montos y Menú de Acciones al Extremo Derecho */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {/* Montos */}
                    <div className="text-right">
                      <p
                        className={`text-base font-bold transition-colors ${
                          isPaid
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isCancelled
                            ? 'text-surface-400 line-through'
                            : 'text-surface-900 dark:text-white'
                        }`}
                      >
                        {formatCurrency(obligation.amount, profile?.currency)}
                      </p>
                      {remainingAmount > 0 && !isCancelled && paidAmount > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          Resta: {formatCurrency(remainingAmount, profile?.currency)}
                        </p>
                      )}
                    </div>

                    {/* Menú de tres puntos (extremo derecho) */}
                    <div
                      className="relative shrink-0"
                      data-obligation-menu
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={`Acciones para ${obligation.name}`}
                        aria-haspopup="true"
                        aria-expanded={isMenuOpen}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isMenuOpen ? null : obligation.id);
                        }}
                        className={`p-2 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                          isMenuOpen
                            ? 'bg-surface-200 dark:bg-surface-700 text-surface-900 dark:text-white'
                            : 'text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800'
                        }`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown del menú */}
                      <AnimatePresence>
                        {isMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: isNearBottom ? 4 : -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: isNearBottom ? 4 : -4 }}
                            transition={{ duration: 0.12 }}
                            className={`absolute right-0 w-44 py-1 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-xl shadow-surface-950/15 dark:shadow-surface-950/60 z-50 ${
                              isNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                            }`}
                          >
                            {/* Editar */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(obligation);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-surface-400" />
                              <span>Editar</span>
                            </button>

                            {/* Cancelar */}
                            {!isCancelled && !isPaid && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelRequest(obligation.id);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-left"
                              >
                                <Ban className="w-3.5 h-3.5 text-amber-500" />
                                <span>Cancelar</span>
                              </button>
                            )}

                            {/* Separador */}
                            <div className="my-1 border-t border-surface-100 dark:border-surface-700/80" />

                            {/* Eliminar */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRequest(obligation);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Eliminar</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal de Formulario Nueva/Editar Obligación */}
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

      {/* Modal de Gestión de Pagos Parciales y Reversión */}
      <PaymentModal
        isOpen={!!paymentObligation}
        onClose={() => setPaymentObligation(null)}
        obligation={paymentObligation}
      />

      {/* Diálogo de Confirmación para Cancelar Obligación */}
      <ConfirmDialog
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={handleCancelConfirm}
        title="Cancelar Obligación"
        description="¿Estás seguro de que deseas cancelar esta obligación? El saldo pendiente se descompromete, pero todos los pagos ya registrados se conservarán intactos en tu historial."
        confirmText="Sí, Cancelar Obligación"
        cancelText="Volver"
        variant="danger"
      />

      {/* Diálogo de Confirmación para Eliminar Obligación */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar Obligación"
        description="¿Estás seguro de que deseas eliminar esta obligación de la lista? No tiene pagos registrados."
        confirmText="Sí, Eliminar"
        cancelText="Volver"
        variant="danger"
      />

      {/* Modal Informativo: Protección contra eliminación con pagos existentes */}
      <Modal
        isOpen={!!blockedDeleteObligation}
        onClose={() => setBlockedDeleteObligation(null)}
        title="No se puede eliminar de forma destructiva"
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold mb-1">Esta obligación ya cuenta con pagos registrados</p>
              <p className="text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed">
                Para garantizar la integridad de tu historial contable y no alterar los balances reales de tus quincenas, no se permite la eliminación destructiva.
              </p>
            </div>
          </div>

          <p className="text-xs text-surface-600 dark:text-surface-400">
            ¿Deseas <strong>Cancelar</strong> la obligación (para anular cualquier saldo pendiente) o <strong>Archivarla</strong> manteniendo íntegros sus registros de pago?
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-surface-100 dark:border-surface-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBlockedDeleteObligation(null)}
              className="w-full sm:w-auto text-xs"
            >
              Volver
            </Button>
            {blockedDeleteObligation && blockedDeleteObligation.status !== 'cancelled' && (
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  if (blockedDeleteObligation) {
                    await cancelObligation(blockedDeleteObligation.id);
                    setBlockedDeleteObligation(null);
                  }
                }}
                className="w-full sm:w-auto text-xs flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancelar saldo restante</span>
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                // Archivar manteniendo estado
                setBlockedDeleteObligation(null);
              }}
              className="w-full sm:w-auto text-xs flex items-center gap-1.5"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Conservar en historial</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Plantillas Recurrentes */}
      <Modal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        title="Mis Pagos Recurrentes"
      >
        <RecurringTemplatesModal onClose={() => setShowRecurringModal(false)} />
      </Modal>
    </div>
  );
};
