import { CalendarDays, ChartColumn, CircleCheckBig, House, Repeat, Settings, Target, Timer, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** Barra inferior: Início | Metas | Check-in | Hábitos | Mais. */
export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/checkin', label: 'Check-in', icon: CircleCheckBig },
  { to: '/habitos', label: 'Hábitos', icon: Repeat },
];

/** Menu "Mais": Contagem regressiva | Calendário | Relatórios | Configurações. */
export const MORE_NAV: NavItem[] = [
  { to: '/contagem', label: 'Contagem regressiva', icon: Timer },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/relatorios', label: 'Relatórios', icon: ChartColumn },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

/** Rotas "filhas" do menu Mais (mantêm a aba Mais ativa). */
export const MORE_EXTRA_PATHS = ['/estado-do-beta'];
