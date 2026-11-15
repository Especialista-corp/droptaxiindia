"use client";

import { type InputHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
}

export function PasswordInput({ label, error, className, ...props }: PasswordInputProps) {
  const [visivel, setVisivel] = useState(false);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="relative block">
        <input
          type={visivel ? "text" : "password"}
          className={cn(
            "h-14 w-full rounded-lg border border-line bg-surface-2 pl-4 pr-14 text-base text-foreground outline-none placeholder:text-muted focus:border-brand-soft",
            error && "border-danger",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-muted hover:text-foreground"
        >
          {visivel ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </span>
      {error && <span className="text-sm text-danger-soft">{error}</span>}
    </label>
  );
}
