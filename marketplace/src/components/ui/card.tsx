import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-[#E2E2E2] bg-white p-4", className)}
      {...props}
    />
  );
}

export function ListRow({
  className,
  icon,
  title,
  subtitle,
  trailing,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-[#E2E2E2] py-3 last:border-b-0",
        className,
      )}
      {...props}
    >
      {icon && <div className="shrink-0 text-black">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-black">{title}</p>
        {subtitle && <p className="truncate text-sm text-[#545454]">{subtitle}</p>}
      </div>
      {trailing}
    </div>
  );
}
