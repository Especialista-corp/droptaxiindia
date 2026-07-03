import { redirect } from "next/navigation";
import { ClipboardList, Calendar, Wallet, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/nav/bottom-nav";

export default async function PrestadorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("provider_profiles")
    .select("status")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.status !== "aprovado") {
    redirect("/prestador/cadastro-pendente");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col pb-20">
      {children}
      <BottomNav
        items={[
          { href: "/prestador/pedidos", label: "Pedidos", icon: ClipboardList },
          { href: "/prestador/agenda", label: "Agenda", icon: Calendar },
          { href: "/prestador/carteira", label: "Carteira", icon: Wallet },
          { href: "/prestador/perfil", label: "Perfil", icon: User },
        ]}
      />
    </div>
  );
}
