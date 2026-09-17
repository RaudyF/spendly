'use client';

import React from 'react';
import {
  CheckCircle2,
  RefreshCw,
  HardDrive,
  WifiOff,
  AlertCircle,
  Cloud,
} from 'lucide-react';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';
import { SyncStatus } from '@/store/types';

interface SyncStatusIndicatorProps {
  className?: string;
  variant?: 'compact' | 'badge' | 'full';
  showRetry?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  className,
  variant = 'badge',
  showRetry = false,
}) => {
  const sync = useStore((state) => state.sync);
  const processPendingQueue = useStore((state) => state.processPendingQueue);
  const syncToCloud = useStore((state) => state.syncToCloud);

  const status: SyncStatus = sync.status || (sync.isOnline ? 'saved_locally' : 'offline');
  const pendingCount = sync.pendingChangesCount || 0;

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sync.isSyncing) return;
    if (pendingCount > 0) {
      await processPendingQueue();
    } else {
      await syncToCloud();
    }
  };

  const config = {
    synced: {
      label: 'Sincronizado',
      description: 'Todos tus cambios están respaldados en la nube',
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800/50',
      dot: 'bg-emerald-500',
    },
    syncing: {
      label: 'Sincronizando',
      description: 'Subiendo cambios a la nube...',
      icon: RefreshCw,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200 dark:border-blue-800/50',
      dot: 'bg-blue-500 animate-pulse',
      spin: true,
    },
    saved_locally: {
      label: 'Guardado localmente',
      description: pendingCount > 0 
        ? `${pendingCount} cambio${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de sincronizar`
        : 'Datos seguros en tu dispositivo',
      icon: HardDrive,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800/50',
      dot: 'bg-amber-500',
    },
    offline: {
      label: 'Sin conexión',
      description: 'Trabajando en modo offline. Los cambios se sincronizarán al volver a conectar.',
      icon: WifiOff,
      color: 'text-neutral-500 dark:text-neutral-400',
      bg: 'bg-neutral-100 dark:bg-neutral-800/50',
      border: 'border-neutral-200 dark:border-neutral-700',
      dot: 'bg-neutral-400',
    },
    error: {
      label: 'Error de sincronización',
      description: sync.syncError || 'Ocurrió un error al contactar el servidor remoto.',
      icon: AlertCircle,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800/50',
      dot: 'bg-rose-500',
    },
  }[status] || {
    label: 'Guardado localmente',
    description: 'Datos almacenados localmente',
    icon: Cloud,
    color: 'text-neutral-600 dark:text-neutral-400',
    bg: 'bg-neutral-50 dark:bg-neutral-800/40',
    border: 'border-neutral-200 dark:border-neutral-700',
    dot: 'bg-neutral-400',
  };

  const Icon = config.icon;

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
          config.bg,
          config.color,
          config.border,
          className
        )}
        title={config.description}
      >
        <Icon className={cn('w-3.5 h-3.5', 'spin' in config && config.spin && 'animate-spin')} />
        <span>{config.label}</span>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <button
        type="button"
        onClick={handleManualSync}
        disabled={sync.isSyncing}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:opacity-90 active:scale-95 text-left',
          config.bg,
          config.color,
          config.border,
          className
        )}
        title={config.description}
      >
        <span className={cn('w-2 h-2 rounded-full shrink-0', config.dot)} />
        <span className="font-semibold">{config.label}</span>
        {pendingCount > 0 && status !== 'syncing' && (
          <span className="px-1.5 py-0.2 rounded-full bg-surface-200/70 dark:bg-surface-800/70 text-[10px]">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  // Full card variant
  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-colors flex items-center justify-between gap-4',
        config.bg,
        config.border,
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className={cn('p-2 rounded-lg bg-white dark:bg-surface-900 border shrink-0', config.border, config.color)}>
          <Icon className={cn('w-5 h-5', 'spin' in config && config.spin && 'animate-spin')} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn('text-sm font-semibold', config.color)}>{config.label}</h4>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5 truncate">
            {config.description}
          </p>
        </div>
      </div>

      {(showRetry || status === 'error' || status === 'saved_locally') && (
        <button
          type="button"
          onClick={handleManualSync}
          disabled={sync.isSyncing}
          className={cn(
            'px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-surface-900 border shadow-xs hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shrink-0 flex items-center gap-1.5',
            config.color,
            config.border
          )}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', sync.isSyncing && 'animate-spin')} />
          <span>{sync.isSyncing ? 'Sincronizando' : 'Sincronizar ahora'}</span>
        </button>
      )}
    </div>
  );
};
