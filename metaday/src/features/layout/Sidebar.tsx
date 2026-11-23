import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils.ts';
import { Wordmark } from './Wordmark.tsx';
import { MAIN_NAV, MORE_NAV } from './nav-items.ts';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
    isActive ? 'bg-card-2 text-accent' : 'text-muted hover:bg-card hover:text-foreground',
  );

/** Desktop: sidebar equivalente à barra inferior + itens do menu Mais. */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-border bg-chrome p-4 md:flex">
      <Wordmark />
      <nav aria-label="Navegação principal" className="flex flex-col gap-6">
        <ul className="flex flex-col gap-1">
          {MAIN_NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={linkClass}>
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div>
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-dim">Mais</p>
          <ul className="flex flex-col gap-1">
            {MORE_NAV.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} className={linkClass}>
                  <Icon className="size-5" aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
