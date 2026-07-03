import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-black text-white hover:bg-black/85 disabled:bg-black/30",
  secondary: "bg-[#F6F6F6] text-black border border-[#E2E2E2] hover:bg-[#eeeeee]",
  danger: "bg-[#BB032A] text-white hover:bg-[#a1021f]",
  ghost: "bg-transparent text-black hover:bg-[#F6F6F6]",
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
