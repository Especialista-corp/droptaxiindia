import { createClient } from "@/lib/supabase/server";
import { NovoPedidoWizard } from "./wizard";

export default async function NovoPedidoPage() {
  const supabase = await createClient();
  const { data: categoria } = await supabase
    .from("service_categories")
    .select("id, nome, service_items(*)")
    .eq("slug", "montagem-moveis")
    .eq("ativo", true)
    .single();

  if (!categoria) {
    return (
      <div className="px-6 py-8">
        <p className="text-[#545454]">
          Catálogo de montagem de móveis ainda não configurado. Rode o seed do banco.
        </p>
      </div>
    );
  }

  const itens = (categoria.service_items ?? [])
    .filter((item) => item.ativo)
    .sort((a, b) => a.ordem - b.ordem);

  return <NovoPedidoWizard categoryId={categoria.id} categoryNome={categoria.nome} itens={itens} />;
}
