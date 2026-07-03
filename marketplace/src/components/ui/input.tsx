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
        {label && <span className="text-sm font-medium text-black">{label}</span>}
        <input
          ref={ref}
          id={id}
          className={cn(
            "h-14 rounded-lg border border-[#E2E2E2] bg-[#F6F6F6] px-4 text-base text-black outline-none placeholder:text-[#545454] focus:border-black",
            error && "border-[#BB032A]",
            className,
          )}
          {...props}
        />
        {error && <span className="text-sm text-[#BB032A]">{error}</span>}
      </label>
    );
  },
);
Input.displayName = "Input";
