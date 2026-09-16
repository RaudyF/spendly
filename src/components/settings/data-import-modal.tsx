'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  FileJson,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useStore } from '@/store';
import { Button, Divider } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BackupSummary {
  version?: string;
  appName?: string;
  exportDate?: string;
  expensesCount: number;
  incomesCount: number;
  budgetsCount: number;
  goalsCount: number;
  obligationsCount: number;
  hasProfile: boolean;
  profileName?: string;
  currency?: string;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({ isOpen, onClose }) => {
  const restoreData = useStore((state) => state.restoreData);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupData, setBackupData] = useState<any | null>(null);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = () => {
    setSelectedFile(null);
    setBackupData(null);
    setSummary(null);
    setParseError(null);
    setRestoreSuccess(null);
    setIsRestoring(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = (file: File) => {
    setParseError(null);
    setRestoreSuccess(null);

    if (!file.name.endsWith('.json')) {
      setParseError('Por favor selecciona un archivo con extensión .json');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('El archivo no contiene un formato JSON válido.');
        }

        const expensesCount = Array.isArray(parsed.expenses) ? parsed.expenses.length : 0;
        const incomesCount = Array.isArray(parsed.incomes) ? parsed.incomes.length : 0;
        const budgetsCount = Array.isArray(parsed.budgets) ? parsed.budgets.length : 0;
        const goalsCount = Array.isArray(parsed.goals) ? parsed.goals.length : 0;
        const obligationsCount = Array.isArray(parsed.obligations) ? parsed.obligations.length : 0;
        const hasProfile = Boolean(parsed.profile);

        if (
          expensesCount === 0 &&
          incomesCount === 0 &&
          budgetsCount === 0 &&
          goalsCount === 0 &&
          obligationsCount === 0 &&
          !hasProfile
        ) {
          throw new Error(
            'El archivo JSON no contiene datos reconocibles de SaldoClaro (gastos, ingresos, presupuestos o metas).'
          );
        }

        setBackupData(parsed);
        setSummary({
          version: parsed.version,
          appName: parsed.appName,
          exportDate: parsed.exportDate,
          expensesCount,
          incomesCount,
          budgetsCount,
          goalsCount,
          obligationsCount,
          hasProfile,
          profileName: parsed.profile?.name,
          currency: parsed.profile?.currency,
        });
      } catch (err: any) {
        setParseError(err.message || 'Error al procesar el archivo JSON.');
        setBackupData(null);
        setSummary(null);
      }
    };

    reader.onerror = () => {
      setParseError('Error al leer el archivo desde tu dispositivo.');
    };

    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRestore = async () => {
    if (!backupData) return;

    setIsRestoring(true);
    setParseError(null);

    const result = await restoreData(backupData, mode);

    setIsRestoring(false);

    if (result.success) {
      setRestoreSuccess(result.message);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } else {
      setParseError(result.error || result.message || 'Error al restaurar los datos');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Restaurar Copia de Seguridad" size="md">
      <div className="space-y-5">
        {/* Success Banner */}
        {restoreSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-start gap-3 text-emerald-800 dark:text-emerald-200">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">¡Restauración exitosa!</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                {restoreSuccess}
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {parseError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 flex items-start gap-3 text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Error en el archivo</p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{parseError}</p>
            </div>
            <button
              onClick={() => setParseError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* File Drop Area */}
        {!backupData ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                : 'border-surface-300 dark:border-surface-700 hover:border-primary-400 dark:hover:border-primary-600 bg-surface-50 dark:bg-surface-800/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="font-semibold text-sm text-surface-900 dark:text-white">
              Haz clic para seleccionar o arrastra tu archivo JSON
            </p>
            <p className="text-xs text-surface-500 mt-1">
              Archivos generados con la opción &ldquo;Copia de Seguridad (JSON)&rdquo;
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected File Info Card */}
            <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/60 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
                  <FileJson className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-surface-900 dark:text-white truncate">
                    {selectedFile?.name}
                  </p>
                  <p className="text-xs text-surface-500">
                    {summary?.exportDate
                      ? `Exportado el ${new Date(summary.exportDate).toLocaleDateString()} a las ${new Date(summary.exportDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Fecha no especificada'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetState}
                className="text-surface-400 hover:text-surface-600"
              >
                Cambiar
              </Button>
            </div>

            {/* Summary Grid */}
            <div className="bg-surface-50/50 dark:bg-surface-800/40 rounded-xl p-4 border border-surface-200/80 dark:border-surface-700/40">
              <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-3">
                Contenido detectado en el respaldo:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-lg bg-surface-100 dark:bg-surface-800">
                  <p className="text-xs text-surface-500">Gastos / Movs.</p>
                  <p className="text-base font-bold text-surface-900 dark:text-white">
                    {summary?.expensesCount}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-100 dark:bg-surface-800">
                  <p className="text-xs text-surface-500">Ingresos</p>
                  <p className="text-base font-bold text-surface-900 dark:text-white">
                    {summary?.incomesCount}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-100 dark:bg-surface-800">
                  <p className="text-xs text-surface-500">Presupuestos</p>
                  <p className="text-base font-bold text-surface-900 dark:text-white">
                    {summary?.budgetsCount}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-100 dark:bg-surface-800">
                  <p className="text-xs text-surface-500">Metas de ahorro</p>
                  <p className="text-base font-bold text-surface-900 dark:text-white">
                    {summary?.goalsCount}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-100 dark:bg-surface-800">
                  <p className="text-xs text-surface-500">Compromisos</p>
                  <p className="text-base font-bold text-surface-900 dark:text-white">
                    {summary?.obligationsCount}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-100 dark:bg-surface-800">
                  <p className="text-xs text-surface-500">Moneda / Perfil</p>
                  <p className="text-sm font-bold text-surface-900 dark:text-white truncate">
                    {summary?.currency || 'Sin perfil'}
                  </p>
                </div>
              </div>
            </div>

            {/* Restore Mode Options */}
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">
                Modo de restauración:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('replace')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    mode === 'replace'
                      ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/20 ring-1 ring-primary-500'
                      : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800/60 hover:border-surface-300'
                  }`}
                >
                  <p className="font-semibold text-xs text-surface-900 dark:text-white">
                    Reemplazar todo (Recomendado)
                  </p>
                  <p className="text-xs text-surface-500 mt-1 leading-relaxed">
                    Sustituye los datos locales actuales por la copia de seguridad completa.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('merge')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    mode === 'merge'
                      ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/20 ring-1 ring-primary-500'
                      : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800/60 hover:border-surface-300'
                  }`}
                >
                  <p className="font-semibold text-xs text-surface-900 dark:text-white">
                    Combinar con existentes
                  </p>
                  <p className="text-xs text-surface-500 mt-1 leading-relaxed">
                    Conserva tus datos actuales y añade únicamente los elementos nuevos.
                  </p>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-surface-400 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                Los datos se guardan con separación segura en tu base de datos local y se sincronizan si estás autenticado.
              </span>
            </div>
          </div>
        )}

        <Divider className="my-0" />

        {/* Modal Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isRestoring}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleRestore}
            disabled={!backupData || isRestoring || Boolean(restoreSuccess)}
            isLoading={isRestoring}
            className="flex-1"
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Restaurar Ahora
          </Button>
        </div>
      </div>
    </Modal>
  );
};
