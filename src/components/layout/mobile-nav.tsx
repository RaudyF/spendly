'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/ui/logo';
import {
  Menu,
  X,
  Moon,
  Sun,
  ChevronLeft,
  LogOut,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import { useStore } from '@/store';
import { useAuth } from '@/components/auth/auth-provider';
import { Avatar } from '@/components/ui';
import { navItems } from './nav-items';

// Mobile Bottom Navigation
export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  // 4 primary accesses: Resumen, Movimientos, Obligaciones, Más
  const primaryHrefs = ['/dashboard', '/expenses', '/obligations'];
  const primaryItems = navItems.filter((item) => primaryHrefs.includes(item.href));
  
  // Check if current route is inside "Más" (Presupuestos, Metas, Análisis, Ajustes)
  const moreHrefs = ['/budget', '/goals', '/insights', '/settings'];
  const isMoreActive = moreHrefs.includes(pathname);

  return (
    <>
      <nav
        className={cn(
          'xl:hidden fixed bottom-0 left-0 right-0 z-40',
          'bg-white/90 dark:bg-surface-900/90 backdrop-blur-xl',
          'border-t border-surface-100 dark:border-surface-800',
          'safe-bottom'
        )}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {primaryItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl',
                  'transition-all duration-200',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-surface-500 dark:text-surface-400'
                )}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                  <item.icon className="w-6 h-6" />
                  {isActive && (
                    <motion.div
                      layoutId="mobileActiveNav"
                      className="absolute -inset-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl -z-10"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </motion.div>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl',
              'transition-all duration-200',
              isMoreActive
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-surface-500 dark:text-surface-400'
            )}
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <MoreHorizontal className="w-6 h-6" />
              {isMoreActive && (
                <motion.div
                  layoutId="mobileActiveNav"
                  className="absolute -inset-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </motion.div>
            <span className="text-xs font-medium">Más</span>
          </button>
        </div>
      </nav>

      {/* More Menu Sheet */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="xl:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end"
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                'w-full rounded-t-3xl p-6',
                'bg-white dark:bg-surface-900',
                'border-t border-surface-200 dark:border-surface-800',
                'space-y-4 max-h-[80vh] overflow-y-auto'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-surface-100 dark:border-surface-800">
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                  Más opciones
                </h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2">
                {navItems
                  .filter((item) => moreHrefs.includes(item.href))
                  .map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 text-center',
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400'
                            : 'bg-surface-50 dark:bg-surface-800/50 border-surface-100 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-100'
                        )}
                      >
                        <item.icon className="w-6 h-6" />
                        <span className="text-sm font-semibold">{item.label}</span>
                      </Link>
                    );
                  })}
              </div>

              <div className="pt-4 border-t border-surface-100 dark:border-surface-800 space-y-2">
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    window.dispatchEvent(new CustomEvent('open-saldo-chat'));
                  }}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3 rounded-xl',
                    'text-surface-600 dark:text-surface-400',
                    'hover:bg-surface-50 dark:hover:bg-surface-800',
                    'transition-colors duration-200 font-medium'
                  )}
                >
                  <Sparkles className="w-5 h-5 text-primary-500" />
                  <span>Asistente</span>
                </button>
                <button
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3 rounded-xl',
                    'text-surface-600 dark:text-surface-400',
                    'hover:bg-surface-50 dark:hover:bg-surface-800',
                    'transition-colors duration-200 font-medium'
                  )}
                >
                  {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  <span>{resolvedTheme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Mobile Header
interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  showBack = false,
  rightAction,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const profile = useStore((state) => state.profile);
  const resetStore = useStore((state) => state.resetStore);
  const { user, signOut: authSignOut } = useAuth();
  const router = useRouter();

  const displayName = user?.displayName || profile?.name || 'Usuario';
  const avatarUrl = user?.photoURL || undefined;

  const handleSignOut = async () => {
    try {
      await authSignOut();
      await resetStore();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <>
      <header
        className={cn(
          'lg:hidden sticky top-0 z-30',
          'bg-white/90 dark:bg-surface-900/90 backdrop-blur-xl',
          'border-b border-surface-100 dark:border-surface-800',
          'safe-top'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {showBack ? (
              <Link
                href="/dashboard"
                className="p-2 -ml-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
            ) : (
              <button
                onClick={() => setMenuOpen(true)}
                className="p-2 -ml-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            {title ? (
              <h1 className="text-xl font-bold text-surface-900 dark:text-white">{title}</h1>
            ) : (
              <Link href="/dashboard" className="flex items-center gap-2">
                <Logo className="scale-75 origin-left" iconOnly={!title} />
              </Link>
            )}
          </div>
          {rightAction || (
            <Avatar name={displayName} src={avatarUrl} size="sm" />
          )}
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                'absolute left-0 top-0 bottom-0 w-80',
                'bg-white dark:bg-surface-900',
                'flex flex-col'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-surface-100 dark:border-surface-800">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2"
                  onClick={() => setMenuOpen(false)}
                >
                  <Logo className="scale-90 origin-left" />
                </Link>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 p-4 overflow-y-auto">
                <ul className="space-y-1">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-xl',
                            'transition-all duration-200',
                            isActive
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                              : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800'
                          )}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="p-4 border-t border-surface-100 dark:border-surface-800 space-y-2">
                <button
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3 rounded-xl',
                    'text-surface-600 dark:text-surface-400',
                    'hover:bg-surface-50 dark:hover:bg-surface-800',
                    'transition-colors duration-200'
                  )}
                >
                  {resolvedTheme === 'dark' ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                  <span>{resolvedTheme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                </button>

                {user && (
                  <button
                    onClick={handleSignOut}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-3 rounded-xl',
                      'text-danger-600 dark:text-danger-400',
                      'hover:bg-danger-50 dark:hover:bg-danger-900/20',
                      'transition-colors duration-200'
                    )}
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Cerrar Sesión</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
