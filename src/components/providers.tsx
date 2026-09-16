'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider, useAuth } from '@/components/auth/auth-provider';
import { FloatingChat } from '@/components/chat/floating-chat';
import { Logo } from '@/components/ui/logo';

function AppInitializer({ children }: { children: React.ReactNode }) {
  const [initError, setInitError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const hasCheckedCloud = useRef(false);

  const initialize = useStore((state) => state.initialize);
  const syncFromCloud = useStore((state) => state.syncFromCloud);
  const isOnboarded = useStore((state) => state.isOnboarded);
  const isLoading = useStore((state) => state.isLoading);
  const currentUserId = useStore((state) => state.currentUserId);
  const expenses = useStore((state) => state.expenses);

  const pathname = usePathname();
  const { user, isLoading: authLoading } = useAuth();

  // Safeguard timeout to ensure no route is ever blocked indefinitely
  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Initialize store when user changes
  useEffect(() => {
    let active = true;
    const initApp = async () => {
      if (authLoading) return;

      const userId = user?.id;

      if (userId !== currentUserId) {
        hasCheckedCloud.current = false;
        try {
          await initialize(userId);
        } catch (error) {
          console.error('Failed to initialize app:', error);
          if (active) {
            setInitError(error instanceof Error ? error.message : 'Unknown error');
          }
        }
      }
    };

    initApp();
    return () => {
      active = false;
    };
  }, [user, authLoading, initialize, currentUserId]);

  // Task 8: Neon synchronizes strictly in the background and NEVER blocks the UI
  useEffect(() => {
    const checkAndRestoreFromCloud = async () => {
      if (hasCheckedCloud.current || !user || isLoading || authLoading) return;

      hasCheckedCloud.current = true;

      // If returning user has no local records, sync from cloud in background
      if (!isOnboarded && expenses.length === 0) {
        try {
          await syncFromCloud();
        } catch (error) {
          console.error('[Providers] Background cloud restore error:', error);
        }
      }
    };

    const timer = setTimeout(checkAndRestoreFromCloud, 200);
    return () => clearTimeout(timer);
  }, [user, isLoading, authLoading, isOnboarded, expenses.length, syncFromCloud]);

  // Task 7: Landing page must load immediately without waiting for auth, IndexedDB, or Neon
  const isLandingPage = pathname === '/';

  // Only show a blocking screen on authenticated interior routes if still initializing and not timed out
  const showLoading = !isLandingPage && !timedOut && (authLoading || (isLoading && Boolean(user)));

  const showFloatingChat = isOnboarded && pathname !== '/' && !pathname?.startsWith('/auth');

  if (isLandingPage) {
    return (
      <>
        {children}
        {showFloatingChat && <FloatingChat />}
      </>
    );
  }

  if (showLoading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Logo />
          </div>
          <div className="flex justify-center">
            <div className="w-6 h-6 border-2 border-surface-200 dark:border-surface-700 border-t-primary-500 rounded-full animate-spin" />
          </div>
          <p className="text-sm text-surface-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white">Error al iniciar</h2>
          <p className="text-sm text-surface-500">{initError}</p>
          <button
            onClick={() => {
              setInitError(null);
              window.location.reload();
            }}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {showFloatingChat && <FloatingChat />}
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppInitializer>{children}</AppInitializer>
      </ThemeProvider>
    </AuthProvider>
  );
}
