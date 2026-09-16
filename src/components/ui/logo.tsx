import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className, iconOnly = false }) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-sm shrink-0 overflow-hidden">
        {/* Subtle geometric pattern representing Q1/Q2 financial periods and "Disponible libre" */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-white"
        >
          {/* S-shape foundation representing SaldoClaro */}
          <path
            d="M15 9C15 7.34315 13.6569 6 12 6C10.3431 6 9 7.34315 9 9C9 10.6569 10.3431 12 12 12H13C14.6569 12 16 13.3431 16 15C16 16.6569 14.6569 18 13 18C11.3431 18 10 16.6569 10 15"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Split indicator (Q1 / Q2 & Checkmark) */}
          <path
            d="M12 4V6M12 18V20"
            stroke="#34d399" /* emerald-400 for financial positivity */
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {!iconOnly && (
        <span className="font-bold text-lg tracking-tight text-surface-900 dark:text-white">
          Saldo<span className="text-primary-600 dark:text-primary-400">Claro</span>
        </span>
      )}
    </div>
  );
};
