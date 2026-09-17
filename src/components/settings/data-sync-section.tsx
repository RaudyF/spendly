'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Cloud,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Database,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { useStore } from '@/store';
import { useAuth } from '@/components/auth/auth-provider';
import { Button, Divider } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/modal';
import { SyncStatusIndicator } from '@/components/ui/sync-status-indicator';
import { SettingsSection, SettingsItem } from './settings-section';
import { DataExportModal } from './settings-modals';
import { DataImportModal } from './data-import-modal';

export const DataSyncSection: React.FC = () => {
  const sync = useStore((state) => state.sync);
  const syncToCloud = useStore((state) => state.syncToCloud);
  const syncFromCloud = useStore((state) => state.syncFromCloud);
  const clearSyncError = useStore((state) => state.clearSyncError);
  const checkDatabaseStatus = useStore((state) => state.checkDatabaseStatus);
  const { user } = useAuth();

  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkDatabaseStatus();
  }, [checkDatabaseStatus]);

  const handleClearData = () => {
    if (typeof window !== 'undefined') {
      if (user?.id) {
        indexedDB.deleteDatabase(`smart_budget_db_${user.id}`);
      }
      indexedDB.deleteDatabase('smart_budget_db');
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleSyncToCloud = async () => {
    clearSyncError();
    setSyncMessage(null);
    const result = await syncToCloud();
    if (result.success) {
      setSyncMessage({ type: 'success', text: '¡Datos subidos a la nube correctamente!' });
    } else {
      setSyncMessage({ type: 'error', text: result.error || 'Error al subir a la nube' });
    }
    setTimeout(() => setSyncMessage(null), 5000);
  };

  const handleSyncFromCloud = async () => {
    clearSyncError();
    setSyncMessage(null);
    const result = await syncFromCloud();
    if (result.success) {
      setSyncMessage({ type: 'success', text: '¡Datos descargados de la nube correctamente!' });
    } else {
      setSyncMessage({ type: 'error', text: result.error || 'Error al descargar de la nube' });
    }
    setTimeout(() => setSyncMessage(null), 5000);
  };

  const formatLastSyncTime = (isoString: string | null) => {
    if (!isoString) return 'Nunca sincronizado';
    const date = new Date(isoString);
    return `Última sincronización: ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const isCloudConnected = Boolean(sync.dbStatus?.connected);

  return (
    <>
      <SettingsSection
        title="Datos y Sincronización"
        description="Administra la persistencia en la nube, respaldo, restauración y aislamiento de cuenta"
      >
        {/* Offline-First Sync Engine Status */}
        <div className="mx-5 mt-4">
          <SyncStatusIndicator variant="full" showRetry={true} />
        </div>

        {/* Database Engine Status Banner */}
        <div className="mx-5 mt-4 p-4 rounded-xl border transition-colors bg-surface-50 dark:bg-surface-800/40 border-surface-200 dark:border-surface-700/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                  isCloudConnected
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                }`}
              >
                <Server className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-surface-900 dark:text-white">
                    {isCloudConnected
                      ? 'Base de Datos en la Nube Activa'
                      : 'Modo Local (IndexedDB)'}
                  </p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      isCloudConnected
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {isCloudConnected ? 'PostgreSQL / Neon' : 'Navegador'}
                  </span>
                </div>
                <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
                  {isCloudConnected
                    ? 'Tus datos se sincronizan con persistencia durable en PostgreSQL/Neon y están protegidos contra el borrado de caché del navegador.'
                    : 'Tus datos están guardados localmente en este navegador. Para sincronizar entre varios dispositivos y respaldar en Neon/PostgreSQL, proporciona la variable DATABASE_URL.'}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-surface-500 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary-500" />
                  <span>
                    Separación por usuario:{' '}
                    <strong className="text-surface-700 dark:text-surface-300">
                      {user ? `Cuenta aislada (${user.email || user.id.slice(0, 8)})` : 'Perfil Local Invitado'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => checkDatabaseStatus()}
              title="Verificar conexión de base de datos"
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sync Status Message */}
        {syncMessage && (
          <div
            className={`mx-5 mt-4 p-3 rounded-lg flex items-center gap-2 ${
              syncMessage.type === 'success'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}
          >
            {syncMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm">{syncMessage.text}</span>
          </div>
        )}

        {/* Sync Error from Store */}
        {sync.syncError && !syncMessage && (
          <div className="mx-5 mt-4 p-3 rounded-lg flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{sync.syncError}</span>
          </div>
        )}

        {/* Cloud Sync Actions */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-100 dark:bg-accent-900/30">
                <Cloud className="w-5 h-5 text-accent-600 dark:text-accent-400" />
              </div>
              <div>
                <p className="font-medium text-surface-900 dark:text-white">
                  Sincronización en la Nube
                </p>
                <p className="text-sm text-surface-500">
                  {formatLastSyncTime(sync.lastSyncTime)}
                </p>
              </div>
            </div>
            {sync.isSyncing && (
              <div className="flex items-center gap-2 text-accent-600 dark:text-accent-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Sincronizando...</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncToCloud}
              disabled={sync.isSyncing || !user}
              leftIcon={<Upload className="w-4 h-4" />}
              className="flex-1"
            >
              Subir a la Nube
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncFromCloud}
              disabled={sync.isSyncing || !user}
              leftIcon={<Download className="w-4 h-4" />}
              className="flex-1"
            >
              Descargar de la Nube
            </Button>
          </div>

          {!user && (
            <p className="text-xs text-surface-500 text-center">
              Inicia sesión con tu cuenta para sincronizar con la nube y acceder en otros dispositivos.
            </p>
          )}
        </div>

        <Divider className="my-0" />

        <SettingsItem
          icon={<Download className="w-5 h-5" />}
          iconColor="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          title="Exportar Datos"
          description="Descarga todos tus movimientos, presupuestos y metas como archivo JSON o CSV"
          onClick={() => setShowExportModal(true)}
        />
        <SettingsItem
          icon={<Upload className="w-5 h-5" />}
          iconColor="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          title="Importar Datos / Restaurar Copia"
          description="Restaura una copia de seguridad JSON previa con opción de reemplazar o combinar"
          onClick={() => setShowImportModal(true)}
        />
        <SettingsItem
          icon={<Trash2 className="w-5 h-5" />}
          iconColor="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          title="Borrar Todos los Datos Locales"
          description="Elimina la base de datos local y reinicia la aplicación"
          onClick={() => setShowClearDataConfirm(true)}
        />
      </SettingsSection>

      <DataExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      <DataImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      <ConfirmDialog
        isOpen={showClearDataConfirm}
        onClose={() => setShowClearDataConfirm(false)}
        onConfirm={handleClearData}
        title="¿Borrar Todos los Datos Locales?"
        description="Esto eliminará permanentemente la base de datos local de tu usuario actual en este navegador. Si tus datos fueron sincronizados a la nube, podrás volver a descargarlos al iniciar sesión."
        confirmText="Borrar Todo"
        variant="danger"
      />
    </>
  );
};
