import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, AlertCircle, AlertTriangle, Calendar, Check, X } from 'lucide-react';

interface StatusBadgeProps {
  status: 'confirmed' | 'pagado' | 'recibido' | 'esperado' | 'planificado' | 'pendiente' | 'pending' | 'excedido' | 'vencido' | 'overdue' | 'warning' | string;
  label?: string;
  context?: 'obligation' | 'transaction' | 'budget' | string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  context,
  size = 'sm',
  className,
}) => {
  let displayLabel = label;
  let bgClass = 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300';
  let Icon = Clock;

  const normalizedStatus = status?.toLowerCase();

  switch (normalizedStatus) {
    case 'confirmed':
    case 'paid':
    case 'pagado':
    case 'recibido':
      displayLabel = displayLabel || (normalizedStatus === 'pagado' || normalizedStatus === 'paid' ? 'Pagado' : normalizedStatus === 'recibido' ? 'Recibido' : 'Confirmado');
      bgClass = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50';
      Icon = CheckCircle2;
      break;
    case 'partial':
    case 'parcial':
      displayLabel = displayLabel || 'Parcial';
      bgClass = 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/50';
      Icon = Clock;
      break;
    case 'cancelled':
    case 'cancelado':
    case 'cancelada':
      displayLabel = displayLabel || 'Cancelada';
      bgClass = 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 border border-surface-200 dark:border-surface-700';
      Icon = X;
      break;
    case 'esperado':
    case 'planificado':
      displayLabel = displayLabel || (normalizedStatus === 'planificado' ? 'Planificado' : 'Esperado');
      bgClass = 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50';
      Icon = Calendar;
      break;
    case 'pendiente':
    case 'pending':
      displayLabel = displayLabel || (context === 'obligation' ? 'Pendiente' : 'Pendiente');
      bgClass = 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50';
      Icon = Clock;
      break;
    case 'warning':
      displayLabel = displayLabel || 'Atención';
      bgClass = 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50';
      Icon = AlertTriangle;
      break;
    case 'excedido':
    case 'vencido':
    case 'overdue':
      displayLabel = displayLabel || (normalizedStatus === 'excedido' ? 'Excedido' : 'Vencido');
      bgClass = 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50';
      Icon = AlertCircle;
      break;
    default:
      displayLabel = displayLabel || status;
      break;
  }

  const sizeClasses = {
    xs: 'text-[10px] px-2 py-0.5 gap-1',
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-1.5',
    lg: 'text-base px-3.5 py-2 gap-2',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full whitespace-nowrap',
        bgClass,
        sizeClasses[size] || sizeClasses.sm,
        className
      )}
    >
      <Icon className={iconSizes[size] || iconSizes.sm} />
      <span>{displayLabel}</span>
    </span>
  );
};
