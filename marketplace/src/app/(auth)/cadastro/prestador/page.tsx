import { createClient } from "@/lib/supabase/server";
import { PrestadorSignupForm } from "./form";
import { BRAND } from "@/lib/constants";

export default async function CadastroPrestadorPage() {
  const supabase = await createClient();
  const { data: categorias } = await supabase
    .from("service_categories")
    .select("id, nome")
    .eq("ativo", true);

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-1 text-3xl font-bold text-foreground">Seja um montador {BRAND.name}</h1>
        <p className="mb-8 text-muted">
          Cadastre-se, envie seus documentos e comece a receber pedidos perto de você.
        </p>
        <PrestadorSignupForm categorias={categorias ?? []} />
      </div>
    </div>
  );
}
