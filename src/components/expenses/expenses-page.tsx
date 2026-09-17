'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  X,
  Receipt,
  ArrowUpDown,
  Tag,
} from 'lucide-react';
import { useStore } from '@/store';
import { Card, Button, Input, EmptyState } from '@/components/ui';
import { Modal, Sheet, ConfirmDialog } from '@/components/ui/modal';
import { formatCurrency, formatDate, groupByDate } from '@/lib/utils';
import { Expense, CategoryType } from '@/types';
import { ExpenseForm, ExpenseItem } from './expense-form';
import { FilterDropdown, FilterState } from './expense-filter';
import { getCategoryById } from '@/lib/constants';
import { TimeNavigator } from '@/components/layout/time-navigator';

// Main Expenses Component with URL query persistence (useSearchParams)
export const ExpensesPage: React.FC = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const expenses = useStore((state) => state.expenses);
  const viewingPeriod = useStore((state) => state.viewingPeriod);
  const deleteExpense = useStore((state) => state.deleteExpense);
  const profile = useStore((state) => state.profile);

  // Initialize from searchParams
  const getInitialFilters = (): FilterState => {
    const cat = searchParams.get('cat') as CategoryType | 'all' | null;
    const range = searchParams.get('range') as 'week' | 'month' | 'year' | 'all' | null;
    const sort = searchParams.get('sort') as 'date' | 'amount' | null;
    const order = searchParams.get('order') as 'asc' | 'desc' | null;

    return {
      category: cat || 'all',
      dateRange: range || 'month',
      sortBy: sort || 'date',
      sortOrder: order || 'desc',
    };
  };

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState<FilterState>(getInitialFilters);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Sync state with URL search params when user navigates back/forward
  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    const catParam = (searchParams.get('cat') as CategoryType | 'all') || 'all';
    const rangeParam = (searchParams.get('range') as 'week' | 'month' | 'year' | 'all') || 'month';
    const sortParam = (searchParams.get('sort') as 'date' | 'amount') || 'date';
    const orderParam = (searchParams.get('order') as 'asc' | 'desc') || 'desc';

    setSearchQuery(qParam);
    setFilters({
      category: catParam,
      dateRange: rangeParam,
      sortBy: sortParam,
      sortOrder: orderParam,
    });
  }, [searchParams]);

  // Synchronize URL search params seamlessly
  const syncUrlParams = useCallback(
    (newQ: string, newFilters: FilterState) => {
      const params = new URLSearchParams();
      if (newQ.trim()) params.set('q', newQ.trim());
      if (newFilters.category !== 'all') params.set('cat', newFilters.category);
      if (newFilters.dateRange !== 'month') params.set('range', newFilters.dateRange);
      if (newFilters.sortBy !== 'date') params.set('sort', newFilters.sortBy);
      if (newFilters.sortOrder !== 'desc') params.set('order', newFilters.sortOrder);

      const query = params.toString();
      const targetUrl = query ? `${pathname}?${query}` : pathname;
      window.history.replaceState(null, '', targetUrl);
    },
    [pathname]
  );

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    syncUrlParams(val, filters);
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    syncUrlParams(searchQuery, newFilters);
  };

  const handleResetFilters = () => {
    const defaultFilters: FilterState = {
      category: 'all',
      dateRange: 'month',
      sortBy: 'date',
      sortOrder: 'desc',
    };
    setSearchQuery('');
    setFilters(defaultFilters);
    syncUrlParams('', defaultFilters);
  };

  // Filter and sort expenses
  const filteredExpenses = React.useMemo(() => {
    let result = [...expenses].filter(e => e.date.startsWith(viewingPeriod));

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((e) => e.description.toLowerCase().includes(q));
    }

    // Category filter
    if (filters.category !== 'all') {
      result = result.filter((e) => e.category === filters.category);
    }

    // Date range filter
    const now = new Date();
    if (filters.dateRange !== 'all') {
      const ranges = {
        week: 7,
        month: 30,
        year: 365,
      };
      const days = ranges[filters.dateRange];
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      result = result.filter((e) => new Date(e.date) >= cutoff);
    }

    // Sort order
    result.sort((a, b) => {
      if (filters.sortBy === 'date') {
        return filters.sortOrder === 'desc'
          ? new Date(b.date).getTime() - new Date(a.date).getTime()
          : new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return filters.sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
    });

    return result;
  }, [expenses, viewingPeriod, searchQuery, filters]);

  // Group by date
  const groupedExpenses = React.useMemo(() => {
    return groupByDate(filteredExpenses);
  }, [filteredExpenses]);

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteExpense(deleteId);
      setDeleteId(null);
    }
  };

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const hasActiveFilters =
    filters.category !== 'all' ||
    filters.dateRange !== 'month' ||
    filters.sortBy !== 'date' ||
    searchQuery.trim().length > 0;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-white">
            Movimientos
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            Total:{' '}
            <strong className="text-surface-800 dark:text-surface-200 font-semibold">
              {formatCurrency(totalFiltered, profile?.currency || 'DOP')}
            </strong>{' '}
            en {filteredExpenses.length}{' '}
            {filteredExpenses.length === 1 ? 'movimiento' : 'movimientos'}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="shrink-0">
          <Plus className="w-5 h-5 mr-2" />
          Añadir Movimiento
        </Button>
      </div>

      <TimeNavigator />

      {/* Search and Filters with persistent URL state */}
      <div className="space-y-3">
        <div className="flex gap-2.5">
          <div className="flex-1">
            <Input
              placeholder="Buscar por descripción o comercio..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              leftElement={<Search className="w-5 h-5 text-surface-400" />}
              rightElement={
                searchQuery ? (
                  <button
                    onClick={() => handleSearchChange('')}
                    aria-label="Limpiar búsqueda"
                    className="p-1 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-surface-400" />
                  </button>
                ) : null
              }
            />
          </div>
          <Button
            variant="secondary"
            className="relative shrink-0 px-3.5"
            onClick={() => setShowFilters(true)}
            aria-label="Filtrar movimientos"
          >
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline ml-2 text-sm">Filtros</span>
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary-500 rounded-full ring-2 ring-white dark:ring-surface-900" />
            )}
          </Button>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-surface-400 font-medium">Filtros activos:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
                <Search className="w-3 h-3 text-surface-400" />
                &ldquo;{searchQuery}&rdquo;
                <button
                  onClick={() => handleSearchChange('')}
                  className="hover:text-surface-900 dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.category !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
                <Tag className="w-3 h-3 text-surface-400" />
                {getCategoryById(filters.category).name}
                <button
                  onClick={() => handleFiltersChange({ ...filters, category: 'all' })}
                  className="hover:text-surface-900 dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.dateRange !== 'month' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
                <Calendar className="w-3 h-3 text-surface-400" />
                Rango: {filters.dateRange === 'week' ? 'Semana' : filters.dateRange === 'year' ? 'Año' : 'Todo'}
                <button
                  onClick={() => handleFiltersChange({ ...filters, dateRange: 'month' })}
                  className="hover:text-surface-900 dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.sortBy !== 'date' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
                <ArrowUpDown className="w-3 h-3 text-surface-400" />
                Por monto
                <button
                  onClick={() => handleFiltersChange({ ...filters, sortBy: 'date' })}
                  className="hover:text-surface-900 dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={handleResetFilters}
              className="text-primary-600 dark:text-primary-400 hover:underline font-medium ml-1"
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {/* Expenses List */}
      {Object.keys(groupedExpenses).length === 0 ? (
        <Card className="py-12 border-surface-200/80 dark:border-surface-700">
          <EmptyState
            icon={<Receipt className="w-12 h-12 text-surface-400" />}
            title="No se encontraron movimientos"
            description={
              hasActiveFilters
                ? 'Intenta ajustar los filtros o el término de búsqueda para ver más resultados.'
                : 'Registra tus gastos o ingresos para comenzar a visualizar tu historial.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" onClick={handleResetFilters}>
                  Restablecer filtros
                </Button>
              ) : (
                <Button onClick={() => setShowForm(true)}>Añadir Movimiento</Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedExpenses).map(([date, dayExpenses]) => (
            <motion.div key={date} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2 flex items-center gap-2 px-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(date, 'EEEE, d MMMM yyyy')}
              </h3>
              <div className="space-y-2">
                <AnimatePresence>
                  {dayExpenses.map((expense) => (
                    <ExpenseItem
                      key={expense.id}
                      expense={expense}
                      onEdit={() => handleEdit(expense)}
                      onDelete={() => setDeleteId(expense.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingExpense(undefined);
        }}
        title={editingExpense ? 'Actualizar Movimiento' : 'Añadir Movimiento'}
      >
        <ExpenseForm
          expense={editingExpense}
          onClose={() => {
            setShowForm(false);
            setEditingExpense(undefined);
          }}
        />
      </Modal>

      {/* Filter Sheet */}
      <Sheet isOpen={showFilters} onClose={() => setShowFilters(false)} title="Filtrar Movimientos">
        <FilterDropdown
          filters={filters}
          onFilterChange={handleFiltersChange}
          onClose={() => setShowFilters(false)}
        />
      </Sheet>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="¿Eliminar movimiento?"
        description="Esta acción eliminará el movimiento y recalculará tus disponibles. No se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
};
