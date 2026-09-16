'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useStore } from '@/store';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui';
import { Sidebar } from './sidebar';
import { MobileNav, MobileHeader } from './mobile-nav';

// Main Layout Component
interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backFallbackUrl?: string;
  rightAction?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  showBack,
  backFallbackUrl,
  rightAction,
}) => {
  const isOnboarded = useStore((state) => state.isOnboarded);
  const isLoading = useStore((state) => state.isLoading);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [loadingTimedOut, setLoadingTimedOut] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingTimedOut(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Show loading state (with fallback timeout so user never gets stuck on "Cargando...")
  if ((isLoading || authLoading) && !loadingTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 animate-pulse" />
          <p className="text-surface-500">Cargando...</p>
        </div>
      </div>
    );
  }

  // Require authentication - redirect to home if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
              Inicio de Sesión Requerido
            </h1>
            <p className="text-surface-600 dark:text-surface-400">
              Por favor inicia sesión para acceder a tu panel y gestionar tus finanzas.
            </p>
          </div>
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/')}
              className="w-full btn-primary btn-lg"
            >
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show onboarding required if authenticated but not onboarded
  if (!isOnboarded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
              Completa tu Configuración
            </h1>
            <p className="text-surface-600 dark:text-surface-400">
              Terminemos de configurar tu cuenta para comenzar a organizar tus finanzas.
            </p>
          </div>
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/')}
              className="w-full btn-primary btn-lg"
            >
              Continuar Configuración
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <Sidebar />
      <MobileHeader
        title={title}
        showBack={showBack}
        backFallbackUrl={backFallbackUrl}
        rightAction={rightAction}
      />
      <main className="lg:pl-72 pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
};

// Re-export components
export { Sidebar } from './sidebar';
export { MobileNav, MobileHeader } from './mobile-nav';
export { navItems, navSections } from './nav-items';
