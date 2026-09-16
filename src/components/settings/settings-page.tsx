'use client';

import React, { useState } from 'react';
import {
  User,
  Shield,
  Globe,
  Key,
  Calendar,
  Zap,
  HelpCircle,
  Eye,
  Mail,
  CheckCircle,
  UserX,
  DollarSign,
} from 'lucide-react';
import { useStore } from '@/store';
import { useAuth } from '@/components/auth/auth-provider';
import { Button, Avatar, Switch, Select, Divider } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/modal';
import { CURRENCIES } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { SettingsSection, SettingsItem } from './settings-section';
import { ThemeSelector, AccentColorSelector } from './theme-selectors';
import { DataSyncSection } from './data-sync-section';
import { 
  CurrencySelector, 
  EditProfileModal, 
  APIKeysModal,
} from './settings-modals';

// Main Settings Page
export const SettingsPage: React.FC = () => {
  const profile = useStore((state) => state.profile);
  const setProfile = useStore((state) => state.setProfile);
  const { user, sendVerificationEmail, deleteAccount } = useAuth();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [showAPIKeys, setShowAPIKeys] = useState(false);

  // Preference states
  const [compactMode, setCompactMode] = useState(false);
  const [showAnimations, setShowAnimations] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      if (typeof window !== 'undefined') {
        indexedDB.deleteDatabase('smart_budget_db');
        localStorage.clear();
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleSendVerification = async () => {
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
      setTimeout(() => setVerificationSent(false), 5000);
    } catch (error) {
      console.error('Failed to send verification email:', error);
    }
  };

  const currentCurrency = CURRENCIES.find((c) => c.code === profile?.currency) || CURRENCIES[0];

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto pb-24 lg:pb-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Ajustes</h1>
        <p className="text-surface-500 mt-1">Administra tu cuenta y preferencias</p>
      </div>

      <SettingsSection title="Perfil">
        <div className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <Avatar
              src={profile?.photoURL}
              name={profile?.name || 'Usuario'}
              size="xl"
            />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
                {profile?.name || 'Usuario Invitado'}
              </h3>
              <p className="text-sm text-surface-500">
                {profile?.email || 'Sin correo electrónico'}
              </p>
              <p className="text-xs text-surface-400 mt-1">
                Frecuencia: {profile?.incomeFrequency === 'biweekly' ? 'Quincenal' : profile?.incomeFrequency === 'variable' ? 'Variable' : 'Mensual'}
                {profile?.monthlyIncome ? ` • ${formatCurrency(profile.monthlyIncome, profile?.currency)}` : ''}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditProfile(true)}
            leftIcon={<User className="w-4 h-4" />}
          >
            Editar Perfil
          </Button>
        </div>
      </SettingsSection>

      {/* Account & Security */}
      <SettingsSection title="Cuenta y Seguridad" description="Administra la seguridad de tu cuenta">
        <SettingsItem
          icon={user?.emailVerified ? <CheckCircle className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
          iconColor={user?.emailVerified 
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
            : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
          }
          title="Verificación de Email"
          description={user?.emailVerified ? "Tu correo está verificado" : "Verifica tu dirección de correo"}
          badge={user?.emailVerified ? "Verificado" : "No Verificado"}
          badgeVariant={user?.emailVerified ? "success" : "warning"}
          action={!user?.emailVerified && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendVerification}
              disabled={verificationSent}
            >
              {verificationSent ? "¡Correo Enviado!" : "Enviar Enlace"}
            </Button>
          )}
        />
        <SettingsItem
          icon={<UserX className="w-5 h-5" />}
          iconColor="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          title="Eliminar Cuenta"
          description="Elimina permanentemente tu cuenta y datos"
          onClick={() => setShowDeleteAccountConfirm(true)}
        />
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection title="Apariencia" description="Personaliza cómo se ve la app">
        <div className="p-5">
          <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Tema</p>
          <ThemeSelector />
        </div>
        <Divider className="my-0" />
        <div className="p-5">
          <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Color de Acento</p>
          <AccentColorSelector />
        </div>
        <Divider className="my-0" />
        <div className="p-5 space-y-4">
          <Switch
            checked={compactMode}
            onChange={setCompactMode}
            label="Modo Compacto"
            description="Usar espaciado y fuentes más pequeñas"
          />
          <Switch
            checked={showAnimations}
            onChange={setShowAnimations}
            label="Animaciones"
            description="Habilitar transiciones suaves"
          />
        </div>
      </SettingsSection>

      {/* Preferences */}
      <SettingsSection title="Preferencias" description="Configura el comportamiento de la app">
        <SettingsItem
          icon={<Globe className="w-5 h-5" />}
          title="Moneda"
          description={`${currentCurrency.name} (${currentCurrency.symbol})`}
          onClick={() => setShowCurrencySelector(true)}
        />
        <SettingsItem
          icon={<DollarSign className="w-5 h-5" />}
          title="Frecuencia de Ingreso"
          description={
            profile?.incomeFrequency === 'biweekly'
              ? 'Quincenal'
              : profile?.incomeFrequency === 'variable'
              ? 'Variable'
              : 'Mensual'
          }
          onClick={() => setShowEditProfile(true)}
        />
        <SettingsItem
          icon={<Calendar className="w-5 h-5" />}
          title="Inicio de Semana"
          action={
            <Select
              value="monday"
              onChange={() => {}}
              options={[
                { value: 'sunday', label: 'Domingo' },
                { value: 'monday', label: 'Lunes' },
                { value: 'saturday', label: 'Sábado' },
              ]}
              className="w-32"
            />
          }
        />
        <SettingsItem
          icon={<Eye className="w-5 h-5" />}
          title="Vista Predeterminada"
          action={
            <Select
              value="dashboard"
              onChange={() => {}}
              options={[
                { value: 'dashboard', label: 'Resumen' },
                { value: 'expenses', label: 'Movimientos' },
                { value: 'budget', label: 'Presupuesto' },
              ]}
              className="w-32"
            />
          }
        />
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="Notificaciones" description="Controla cuándo te notificamos">
        <div className="p-5 space-y-4">
          <Switch
            checked={budgetAlerts}
            onChange={setBudgetAlerts}
            label="Alertas de Presupuesto"
            description="Recibe notificaciones cuando te acerques a los límites"
          />
          <Switch
            checked={weeklyReports}
            onChange={setWeeklyReports}
            label="Reportes Semanales"
            description="Recibe resúmenes de gastos semanales"
          />
        </div>
      </SettingsSection>

      <SettingsSection title="IA e Integraciones" description="Configura funciones de IA">
        <SettingsItem
          icon={<Key className="w-5 h-5" />}
          iconColor="bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400"
          title="Claves API"
          description="Configura Google AI y otros servicios"
          onClick={() => setShowAPIKeys(true)}
        />
        <SettingsItem
          icon={<Zap className="w-5 h-5" />}
          iconColor="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
          title="Funciones de IA"
          badge="Beta"
          badgeVariant="warning"
          description="Categorización e información inteligente"
          action={<Switch checked={true} onChange={() => {}} />}
        />
      </SettingsSection>

      {/* Data & Sync */}
      <DataSyncSection />

      <SettingsSection title="Acerca de">
        <SettingsItem
          icon={<Shield className="w-5 h-5" />}
          iconColor="bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400"
          title="Privacidad"
          description="Tus datos permanecen en tu dispositivo"
        />
        <SettingsItem
          icon={<HelpCircle className="w-5 h-5" />}
          title="Ayuda y Soporte"
          description="Obtén ayuda usando SaldoClaro"
          onClick={() => window.open('https://github.com', '_blank')}
        />
        <div className="p-5 text-center">
          <p className="text-sm text-surface-500">SaldoClaro v1.0.0</p>
          <p className="text-xs text-surface-400 mt-1">Construido con cuidado para una mejor salud financiera</p>
        </div>
      </SettingsSection>

      <EditProfileModal
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

      <CurrencySelector
        isOpen={showCurrencySelector}
        onClose={() => setShowCurrencySelector(false)}
        currentCurrency={profile?.currency || 'DOP'}
        onSelect={(currency) => setProfile({ currency })}
      />

      <APIKeysModal
        isOpen={showAPIKeys}
        onClose={() => setShowAPIKeys(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteAccountConfirm}
        onClose={() => setShowDeleteAccountConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="¿Eliminar Cuenta?"
        description="Esto eliminará permanentemente tu cuenta y todos los datos asociados. Se cerrará la sesión de inmediato. Esta acción no se puede deshacer."
        confirmText="Eliminar Cuenta"
        variant="danger"
      />
    </div>
  );
};
