import { redirect } from "next/navigation";
import { Home, ClipboardList, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/nav/bottom-nav";

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-1 flex-col pb-20">
      {children}
      <BottomNav
        items={[
          { href: "/cliente", label: "Início", icon: Home },
          { href: "/cliente/pedidos", label: "Pedidos", icon: ClipboardList },
          { href: "/cliente/perfil", label: "Perfil", icon: User },
        ]}
      />
    </div>
  );
}
