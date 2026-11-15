import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand-gradient text-on-brand hover:brightness-110 disabled:opacity-40",
  secondary: "bg-surface text-foreground border border-line hover:bg-surface-2",
  danger: "bg-danger text-on-brand hover:bg-danger-strong",
  ghost: "bg-transparent text-foreground hover:bg-surface",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", fullWidth = true, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "h-14 rounded-lg px-6 font-bold text-base transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          fullWidth && "w-full",
          VARIANT_CLASSES[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
