import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "../../(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AtivarNotificacoesButton } from "@/components/pwa/ativar-notificacoes-button";

export default async function ClientePerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("nome, email, telefone")
    .eq("id", user.id)
    .single();

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Meu perfil</h1>
      <Card className="mb-6">
        <p className="font-bold">{profile?.nome}</p>
        <p className="text-sm text-[#545454]">{profile?.email}</p>
        <p className="text-sm text-[#545454]">{profile?.telefone}</p>
      </Card>
      <div className="mb-4">
        <AtivarNotificacoesButton />
      </div>
      <form action={logoutAction}>
        <Button variant="secondary" type="submit">
          Sair
        </Button>
      </form>
    </div>
  );
}
