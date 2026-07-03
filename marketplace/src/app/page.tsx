import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (profile?.role === "prestador") redirect("/prestador/pedidos");
    if (profile?.role === "admin") redirect("/admin");
    redirect("/cliente");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-between px-6 py-12">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <h1 className="mb-3 text-4xl font-bold leading-tight text-black">
          O Uber dos Montadores
        </h1>
        <p className="mb-10 text-lg text-[#545454]">
          Comprou móvel na internet? Veja o preço, agende o horário e acompanhe o montador
          chegando em tempo real. Você só paga quando ficar pronto.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/cadastro">
            <Button>Quero montar meu móvel</Button>
          </Link>
          <Link href="/cadastro/prestador">
            <Button variant="secondary">Sou montador, quero receber pedidos</Button>
          </Link>
          <Link href="/login" className="mt-2 text-center text-sm font-medium text-[#545454]">
            Já tenho conta — Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
