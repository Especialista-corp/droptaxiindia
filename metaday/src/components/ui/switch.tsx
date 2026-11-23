import * as RadixSwitch from '@radix-ui/react-switch';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils.ts';

export function Switch({ className, ...props }: ComponentPropsWithoutRef<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border-strong bg-background transition-colors data-[state=checked]:bg-accent disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <RadixSwitch.Thumb className="block size-5 translate-x-1 rounded-full bg-muted transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-accent-foreground" />
    </RadixSwitch.Root>
  );
}
