import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_TRACKING_STEPS, type OrderStatus } from "@/lib/constants";

export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  if (status === "cancelado" || status === "disputa") {
    return (
      <div
        className={cn(
          "rounded-lg px-4 py-3 text-center font-bold text-on-brand",
          status === "disputa" ? "bg-danger" : "bg-surface-2",
        )}
      >
        {ORDER_STATUS_LABELS[status]}
      </div>
    );
  }

  // "concluido_prestador" não é uma etapa própria: o serviço terminou e a
  // etapa "Concluído" fica ativa enquanto aguarda o aceite do cliente.
  const currentIndex =
    status === "concluido_prestador"
      ? ORDER_TRACKING_STEPS.length - 1
      : ORDER_TRACKING_STEPS.indexOf(status);

  return (
    <div className="flex items-center justify-between gap-1">
      {ORDER_TRACKING_STEPS.map((step, index) => {
        const isDone = index < currentIndex || status === "aceito_cliente";
        const isActive = index === currentIndex;
        return (
          <div key={step} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              {index > 0 && (
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    isDone || isActive ? "bg-brand" : "bg-line",
                  )}
                />
              )}
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isDone
                    ? "bg-brand-gradient text-on-brand"
                    : isActive
                      ? "border-2 border-brand text-foreground"
                      : "border border-line text-muted",
                )}
              >
                {isDone ? <Check size={14} /> : index + 1}
              </div>
              {index < ORDER_TRACKING_STEPS.length - 1 && (
                <div
                  className={cn("h-0.5 flex-1", isDone ? "bg-brand" : "bg-line")}
                />
              )}
            </div>
            <span
              className={cn(
                "text-center text-[11px] leading-tight",
                isActive ? "font-bold text-foreground" : "text-muted",
              )}
            >
              {ORDER_STATUS_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
