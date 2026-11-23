import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Rota de volta (mostra a seta). */
  back?: { to: string; label: string };
  action?: ReactNode;
}) {
  return (
    <header className="mb-4">
      {back && (
        <Link
          to={back.to}
          className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[11rem] flex-1">
          <h1 className="text-2xl font-bold leading-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  className,
  ...rest
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  className?: string;
  'data-testid'?: string;
}) {
  return (
    <div
      {...rest}
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-5 py-8 text-center',
        className,
      )}
    >
      {icon && <div className="text-accent">{icon}</div>}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {children && <div className="flex flex-col items-center gap-3 text-sm text-muted">{children}</div>}
    </div>
  );
}
