import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Painel inferior no mobile e modal centralizado no desktop (Radix Dialog: foco preso, Esc fecha). */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="md-overlay fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          className={cn(
            'md-sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-card pb-safe shadow-2xl',
            'md:inset-y-auto md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:rounded-3xl',
            className,
          )}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold text-foreground">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-card-2 hover:text-foreground"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-5 pb-5 pt-3">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
