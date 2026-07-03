import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";
import {
  criarCategoriaAction,
  alternarCategoriaAtivaAction,
  criarItemAction,
  atualizarItemAction,
  removerItemAction,
} from "./actions";

export default async function AdminCatalogoPage() {
  const admin = createAdminClient();
  const { data: categorias } = await admin
    .from("service_categories")
    .select("*, service_items(*)")
    .order("nome");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Catálogo de serviços</h1>

      <Card>
        <h2 className="mb-3 font-bold">Nova categoria</h2>
        <form action={criarCategoriaAction} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Nome
            <input name="nome" required className="rounded-lg border border-[#E2E2E2] px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Slug
            <input name="slug" required className="rounded-lg border border-[#E2E2E2] px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Precificação
            <select name="tipoPrecificacao" className="rounded-lg border border-[#E2E2E2] px-3 py-2">
              <option value="tabela">Tabela</option>
              <option value="distancia">Distância (frete)</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white">
            Criar categoria
          </button>
        </form>
      </Card>

      {(categorias ?? []).map((categoria) => (
        <Card key={categoria.id}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold">{categoria.nome}</h2>
              <p className="text-sm text-[#545454]">
                /{categoria.slug} · {categoria.tipo_precificacao} ·{" "}
                {categoria.ativo ? "ativa" : "inativa"}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await alternarCategoriaAtivaAction(categoria.id, categoria.ativo);
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-[#E2E2E2] px-3 py-1.5 text-sm font-medium"
              >
                {categoria.ativo ? "Desativar" : "Ativar"}
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-2">
            {(categoria.service_items ?? [])
              .filter((item) => item.ativo)
              .sort((a, b) => a.ordem - b.ordem)
              .map((item) => (
                <form
                  key={item.id}
                  action={async (formData: FormData) => {
                    "use server";
                    await atualizarItemAction(item.id, formData);
                  }}
                  className="flex flex-wrap items-center gap-2 border-b border-[#E2E2E2] py-2 text-sm last:border-b-0"
                >
                  <input
                    name="nome"
                    defaultValue={item.nome}
                    className="w-56 rounded-lg border border-[#E2E2E2] px-2 py-1"
                  />
                  <span className="text-[#545454]">{item.unidade}</span>
                  <input
                    name="precoBase"
                    type="number"
                    step="0.01"
                    defaultValue={item.preco_base}
                    className="w-24 rounded-lg border border-[#E2E2E2] px-2 py-1"
                  />
                  <input
                    name="faixaMin"
                    type="number"
                    step="0.01"
                    defaultValue={item.faixa_min}
                    className="w-24 rounded-lg border border-[#E2E2E2] px-2 py-1"
                  />
                  <span>–</span>
                  <input
                    name="faixaMax"
                    type="number"
                    step="0.01"
                    defaultValue={item.faixa_max}
                    className="w-24 rounded-lg border border-[#E2E2E2] px-2 py-1"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-black px-3 py-1.5 font-medium text-white"
                  >
                    Salvar
                  </button>
                  <button
                    type="submit"
                    formAction={async () => {
                      "use server";
                      await removerItemAction(item.id);
                    }}
                    className="rounded-lg border border-[#BB032A] px-3 py-1.5 font-medium text-[#BB032A]"
                  >
                    Remover
                  </button>
                  <span className="ml-auto text-[#545454]">
                    Preço tabelado: {formatBRL(item.preco_base)}
                  </span>
                </form>
              ))}
          </div>

          <form
            action={criarItemAction}
            className="mt-4 flex flex-wrap items-end gap-2 border-t border-[#E2E2E2] pt-4 text-sm"
          >
            <input type="hidden" name="categoryId" value={categoria.id} />
            <label className="flex flex-col gap-1">
              Nome do item
              <input name="nome" required className="rounded-lg border border-[#E2E2E2] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              Tipo
              <select name="tipoItem" className="rounded-lg border border-[#E2E2E2] px-2 py-1">
                <option value="padrao">Padrão</option>
                <option value="adicional">Adicional</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Unidade
              <input
                name="unidade"
                defaultValue="serviço"
                className="w-28 rounded-lg border border-[#E2E2E2] px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              Preço
              <input
                name="precoBase"
                type="number"
                step="0.01"
                required
                className="w-24 rounded-lg border border-[#E2E2E2] px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              Faixa min
              <input
                name="faixaMin"
                type="number"
                step="0.01"
                required
                className="w-24 rounded-lg border border-[#E2E2E2] px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              Faixa max
              <input
                name="faixaMax"
                type="number"
                step="0.01"
                required
                className="w-24 rounded-lg border border-[#E2E2E2] px-2 py-1"
              />
            </label>
            <button type="submit" className="rounded-lg bg-black px-4 py-2 font-bold text-white">
              Adicionar item
            </button>
          </form>
        </Card>
      ))}
    </div>
  );
}
