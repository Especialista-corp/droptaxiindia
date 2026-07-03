import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_TRACKING_STEPS, type OrderStatus } from "@/lib/constants";

export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  if (status === "cancelado" || status === "disputa") {
    return (
      <div
        className={cn(
          "rounded-lg px-4 py-3 text-center font-bold text-white",
          status === "disputa" ? "bg-[#BB032A]" : "bg-[#545454]",
        )}
      >
        {ORDER_STATUS_LABELS[status]}
      </div>
    );
  }

  const currentIndex = ORDER_TRACKING_STEPS.indexOf(status);

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
                    isDone || isActive ? "bg-black" : "bg-[#E2E2E2]",
                  )}
                />
              )}
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isDone
                    ? "bg-black text-white"
                    : isActive
                      ? "border-2 border-black text-black"
                      : "border border-[#E2E2E2] text-[#545454]",
                )}
              >
                {isDone ? <Check size={14} /> : index + 1}
              </div>
              {index < ORDER_TRACKING_STEPS.length - 1 && (
                <div
                  className={cn("h-0.5 flex-1", isDone ? "bg-black" : "bg-[#E2E2E2]")}
                />
              )}
            </div>
            <span
              className={cn(
                "text-center text-[11px] leading-tight",
                isActive ? "font-bold text-black" : "text-[#545454]",
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
