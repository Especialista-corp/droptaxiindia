import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Cartão branco arredondado fixado no rodapé, no estilo Uber, usado sobre o
 * mapa em tela cheia nas telas de pedido e rastreamento.
 */
export function BottomSheet({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-[#E2E2E2] bg-white p-5 pb-8 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#E2E2E2]" />
      {children}
    </div>
  );
}
