"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Calendar, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Server Components não podem passar funções (componentes de ícone) para um
// Client Component, então a navegação recebe o nome do ícone e resolve aqui.
const ICONS = { home: Home, pedidos: ClipboardList, agenda: Calendar, carteira: Wallet, perfil: User };

export type NavIcon = keyof typeof ICONS;

export function BottomNav({
  items,
}: {
  items: { href: string; label: string; icon: NavIcon }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E2E2E2] bg-white">
      <div className="mx-auto flex max-w-md justify-around">
        {items.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs",
                active ? "font-bold text-black" : "text-[#545454]",
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
