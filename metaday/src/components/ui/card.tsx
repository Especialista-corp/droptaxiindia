import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils.ts';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-border bg-card p-4', className)} {...props} />;
}

export function SectionTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-sm font-semibold uppercase tracking-wide text-muted', className)} {...props} />;
}
