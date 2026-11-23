import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Sheet } from '@/components/ui/sheet.tsx';
import { cn } from '@/lib/utils.ts';
import { MAIN_NAV, MORE_EXTRA_PATHS, MORE_NAV } from './nav-items.ts';

const tabClass =
  'flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition-colors';

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const moreActive = [...MORE_NAV.map((i) => i.to), ...MORE_EXTRA_PATHS].some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    <nav aria-label="Navegação principal" className="pb-safe flex-none border-t border-border bg-chrome md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {MAIN_NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => cn(tabClass, isActive ? 'text-accent' : 'text-dim hover:text-foreground')}
            >
              <Icon className="size-6" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreActive ? 'page' : undefined}
            onClick={() => setMoreOpen(true)}
            className={cn(tabClass, moreActive ? 'text-accent' : 'text-dim hover:text-foreground')}
          >
            <Ellipsis className="size-6" aria-hidden />
            Mais
          </button>
        </li>
      </ul>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="Mais">
        <ul className="flex flex-col gap-1.5">
          {MORE_NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  navigate(to);
                }}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-background px-4 text-left text-base font-semibold hover:bg-card-2',
                  pathname === to ? 'border-accent/60 text-accent' : 'text-foreground',
                )}
              >
                <Icon className="size-5 text-accent" aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </nav>
  );
}
