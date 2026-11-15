import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-1.5" htmlFor={id}>
        {label && <span className="text-sm font-medium text-foreground">{label}</span>}
        <input
          ref={ref}
          id={id}
          className={cn(
            "h-14 rounded-lg border border-line bg-surface-2 px-4 text-base text-foreground outline-none placeholder:text-muted focus:border-brand-soft",
            error && "border-danger",
            className,
          )}
          {...props}
        />
        {error && <span className="text-sm text-danger-soft">{error}</span>}
      </label>
    );
  },
);
Input.displayName = "Input";
