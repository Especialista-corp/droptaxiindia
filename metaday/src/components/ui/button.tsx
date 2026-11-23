import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils.ts';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-foreground hover:brightness-110 active:brightness-95',
        secondary: 'bg-card-2 text-foreground hover:bg-[#2b4654] border border-border',
        outline: 'border border-border-strong text-foreground hover:bg-card-2',
        ghost: 'text-muted hover:bg-card-2 hover:text-foreground',
        danger: 'border border-danger/60 text-danger hover:bg-danger/10',
      },
      size: {
        md: 'min-h-11 px-4 text-sm',
        lg: 'min-h-14 px-6 text-base',
        sm: 'min-h-9 px-3 text-sm rounded-lg',
        icon: 'size-11 rounded-xl',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
