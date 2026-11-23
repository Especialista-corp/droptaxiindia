import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils.ts';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-card-2 text-muted',
        accent: 'border-accent/50 bg-accent/15 text-accent',
        ok: 'border-ok/50 bg-ok/10 text-ok',
        risk: 'border-risk/50 bg-risk/10 text-risk',
        danger: 'border-danger/50 bg-danger/10 text-danger',
        solid: 'border-transparent bg-accent text-accent-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
