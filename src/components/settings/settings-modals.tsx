'use client';

import React, { useState } from 'react';
import { Check, Eye, ExternalLink, FileJson, Database, Shield } from 'lucide-react';
import { useStore } from '@/store';
import { Button, Input, Divider } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { CURRENCIES } from '@/lib/constants';
import { exportToCSV, cn } from '@/lib/utils';
import { IncomeFrequency } from '@/types';

// Currency Selector Modal
interface CurrencySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentCurrency: string;
  onSelect: (currency: string) => void;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  isOpen,
  onClose,
  currentCurrency,
  onSelect,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Seleccionar Moneda" size="sm">
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {CURRENCIES.map((currency) => (
          <button
            key={currency.code}
            onClick={() => {
              onSelect(currency.code);
              onClose();
            }}
            className={cn(
              'w-full flex items-center justify-between p-4 rounded-xl transition-colors',
              currentCurrency === currency.code
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'hover:bg-surface-50 dark:hover:bg-surface-800'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl font-medium w-8">{currency.symbol}</span>
              <div className="text-left">
                <p className="font-medium text-surface-900 dark:text-white">
                  {currency.code === 'DOP' ? 'RD$' : currency.code}
                </p>
                <p className="text-sm text-surface-500">{currency.name}</p>
              </div>
            </div>
            {currentCurrency === currency.code && (
              <Check className="w-5 h-5 text-primary-500" />
            )}
          </button>
        ))}
      </div>
    </Modal>
  );
};

// Edit Profile Modal
interface EditProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileProps> = ({ isOpen, onClose }) => {
  const profile = useStore((state) => state.profile);
  const setProfile = useStore((state) => state.setProfile);

  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [monthlyIncome, setMonthlyIncome] = useState(profile?.monthlyIncome?.toString() || '');
  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequency>(
    profile?.incomeFrequency || 'monthly'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (profile && isOpen) {
      setName(profile.name || '');
      setEmail(profile.email || '');
      setMonthlyIncome(profile.monthlyIncome?.toString() || '');
      setIncomeFrequency(profile.incomeFrequency || 'monthly');
    }
  }, [profile, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await setProfile({
        name,
        email,
        monthlyIncome: parseFloat(monthlyIncome) || 0,
        incomeFrequency,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySymbol =
    profile?.currency === 'DOP' || profile?.currency === 'RD$' || !profile?.currency
      ? 'RD$'
      : (CURRENCIES.find((c) => c.code === profile?.currency)?.symbol || '$');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Perfil" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
        />
        <Input
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          hint="Usado para recuperar cuenta"
        />

        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Frecuencia de Ingreso
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'monthly' as const, label: 'Mensual' },
                { id: 'biweekly' as const, label: 'Quincenal' },
                { id: 'variable' as const, label: 'Variable' },
              ]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setIncomeFrequency(f.id)}
                className={cn(
                  'py-2 px-3 text-sm font-medium rounded-lg border transition-all duration-200 text-center',
                  incomeFrequency === f.id
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:border-surface-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-surface-400 mt-1.5">
            {incomeFrequency === 'monthly'
              ? 'Monto mensual que se divide equitativamente en quincenas (Q1 y Q2)'
              : incomeFrequency === 'biweekly'
              ? 'Monto base asignado individualmente a cada quincena'
              : 'Para ingresos variables, el monto base es una referencia o estimado'}
          </p>
        </div>

        <Input
          type="number"
          label={
            incomeFrequency === 'biweekly'
              ? 'Ingreso por Quincena'
              : incomeFrequency === 'variable'
              ? 'Ingreso Mensual Estimado'
              : 'Ingreso Mensual'
          }
          value={monthlyIncome}
          onChange={(e) => setMonthlyIncome(e.target.value)}
          placeholder="0.00"
          leftElement={<span className="text-base font-semibold">{currencySymbol}</span>}
        />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" isLoading={isSubmitting}>
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// API Keys Modal
interface APIKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const APIKeysModal: React.FC<APIKeysModalProps> = ({ isOpen, onClose }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    if (geminiKey) {
      localStorage.setItem('gemini_api_key', geminiKey);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configuración de API" size="md">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Clave API de Google AI (Gemini)
          </label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Ingresa tu clave API de Gemini"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-surface-400 hover:text-surface-600"
                >
                  <Eye className="w-4 h-4" />
                </button>
              }
            />
          </div>
          <p className="text-sm text-surface-500 mt-2">
            Obtén tu clave API gratuita en{' '}
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:underline inline-flex items-center gap-1"
            >
              Google AI Studio <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        <Divider />

        <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-accent-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-surface-900 dark:text-white">
                Tus claves se guardan localmente
              </p>
              <p className="text-sm text-surface-500 mt-1">
                Las claves API se guardan en tu navegador y nunca se envían a nuestros servidores.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Guardar Claves
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Data Export Modal
interface DataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataExportModal: React.FC<DataExportModalProps> = ({ isOpen, onClose }) => {
  const expenses = useStore((state) => state.expenses);
  const incomes = useStore((state) => state.incomes);
  const budgets = useStore((state) => state.budgets);
  const goals = useStore((state) => state.goals);
  const obligations = useStore((state) => state.obligations);
  const profile = useStore((state) => state.profile);

  const handleExportCSV = () => {
    const data = expenses.map((e) => ({
      date: e.date,
      type: 'expense',
      description: e.description,
      category: e.category,
      amount: -e.amount,
    }));
    exportToCSV(data, `movimientos-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportJSON = () => {
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      profile,
      expenses,
      incomes,
      budgets,
      goals,
      obligations,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `control-financiero-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Exportar Datos" size="sm">
      <div className="space-y-4">
        <button
          onClick={handleExportCSV}
          className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <FileJson className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="font-medium text-surface-900 dark:text-white">Exportar como CSV</p>
            <p className="text-sm text-surface-500">Formato compatible con hojas de cálculo</p>
          </div>
        </button>

        <button
          onClick={handleExportJSON}
          className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <p className="font-medium text-surface-900 dark:text-white">Copia de Seguridad (JSON)</p>
            <p className="text-sm text-surface-500">Datos completos con todas las configuraciones</p>
          </div>
        </button>

        <Divider />

        <p className="text-xs text-surface-400 text-center">
          {expenses.length} movimientos, {incomes.length} ingresos, {goals.length} metas
        </p>
      </div>
    </Modal>
  );
};
