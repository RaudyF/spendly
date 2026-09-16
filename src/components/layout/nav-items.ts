import {
  LayoutDashboard,
  Receipt,
  Wallet,
  CalendarCheck,
  Target,
  Sparkles,
  Settings,
} from 'lucide-react';

// Navigation items
export const navItems = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/expenses', label: 'Movimientos', icon: Receipt },
  { href: '/budget', label: 'Presupuesto', icon: Wallet },
  { href: '/obligations', label: 'Obligaciones', icon: CalendarCheck },
  { href: '/goals', label: 'Metas', icon: Target },
  { href: '/insights', label: 'Análisis', icon: Sparkles },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];
