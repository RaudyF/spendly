import {
  LayoutDashboard,
  Receipt,
  CalendarCheck,
  Wallet,
  Target,
  Sparkles,
  Settings,
  LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: 'PRINCIPAL' | 'PLANIFICACIÓN' | 'ANÁLISIS' | 'CUENTA';
}

// Navigation items grouped and ordered
export const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard, section: 'PRINCIPAL' },
  { href: '/expenses', label: 'Movimientos', icon: Receipt, section: 'PRINCIPAL' },
  { href: '/obligations', label: 'Obligaciones', icon: CalendarCheck, section: 'PLANIFICACIÓN' },
  { href: '/budget', label: 'Presupuestos', icon: Wallet, section: 'PLANIFICACIÓN' },
  { href: '/goals', label: 'Metas', icon: Target, section: 'PLANIFICACIÓN' },
  { href: '/insights', label: 'Análisis', icon: Sparkles, section: 'ANÁLISIS' },
  { href: '/settings', label: 'Ajustes', icon: Settings, section: 'CUENTA' },
];

