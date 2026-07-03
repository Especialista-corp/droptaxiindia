import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusStepper } from "@/components/order/status-stepper";
import { formatBRL, formatDataAgendada } from "@/lib/utils";
import type { OrderStatus } from "@/lib/constants";
import {
  aceitarPropostaAction,
  recusarPropostaAction,
  aceitarConclusaoAction,
  reportarNoShowAction,
} from "./actions";
import { CancelarPedidoButton } from "./cancelar-button";
import { AvaliacaoForm } from "./avaliacao-form";
import { PagamentoSection } from "./pagamento-section";
import { LiveMap } from "@/components/map/live-map";

export default async function ClientePedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, order_items(*, service_items(nome)), prestador:prestador_id(nome, telefone), payments(*)",
    )
    .eq("id", id)
    .single();

  if (!order || order.cliente_id !== user?.id) notFound();

  const prestador = Array.isArray(order.prestador) ? order.prestador[0] : order.prestador;

  const { data: propostas } =
    order.status === "aberto" || order.status === "proposto"
      ? await supabase
          .from("proposals")
          .select("*, prestador:prestador_id(nome)")
          .eq("order_id", order.id)
          .eq("status", "pendente")
          .order("criado_em", { ascending: false })
      : { data: [] };

  const { data: fotosConclusao } =
    order.status === "concluido_prestador" || order.status === "aceito_cliente"
      ? await supabase.from("completion_photos").select("url").eq("order_id", order.id)
      : { data: [] };

  const { data: veiculoEmUso } =
    order.status === "em_deslocamento" && order.prestador_id
      ? await supabase
          .from("provider_vehicles")
          .select("tipo, cor, porte, placa")
          .eq("provider_id", order.prestador_id)
          .eq("em_uso", true)
          .maybeSingle()
      : { data: null };

  const { data: minhaAvaliacao } =
    order.status === "aceito_cliente"
      ? await supabase
          .from("reviews")
          .select("id")
          .eq("order_id", order.id)
          .eq("autor_id", user.id)
          .maybeSingle()
      : { data: null };

  return (
    <div className="px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold">{formatDataAgendada(order.data_agendada)}</h1>
      <p className="mb-6 text-[#545454]">
        {order.janela_inicio.slice(0, 5)}–{order.janela_fim.slice(0, 5)}
      </p>

      <div className="mb-6">
        <OrderStatusStepper status={order.status as OrderStatus} />
      </div>

      <Card className="mb-4">
        <p className="mb-2 font-bold">Itens</p>
        {order.order_items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.quantidade}x {item.service_items?.nome}
            </span>
            <span>{formatBRL(item.valor_unitario * item.quantidade)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-[#E2E2E2] pt-2 font-bold">
          <span>{order.valor_acordado ? "Acordado" : "Tabela"}</span>
          <span>{formatBRL(order.valor_acordado ?? order.valor_tabela)}</span>
        </div>
      </Card>

      {prestador && (
        <Card className="mb-4">
          <p className="mb-1 font-bold">Montador</p>
          <p className="text-sm text-[#545454]">
            {prestador.nome} · {prestador.telefone}
          </p>
          {(order.status === "confirmado" || order.status === "em_deslocamento") && (
            <form
              action={async () => {
                "use server";
                await reportarNoShowAction(order.id);
              }}
              className="mt-3"
            >
              <button className="text-sm font-medium text-[#BB032A]" type="submit">
                O montador não apareceu
              </button>
            </form>
          )}
        </Card>
      )}

      {order.status === "em_deslocamento" && veiculoEmUso && order.lat && order.lng && (
        <Card className="mb-4 overflow-hidden p-0">
          <LiveMap
            orderId={order.id}
            destino={{ lat: order.lat, lng: order.lng }}
            veiculoTipo={veiculoEmUso.tipo}
            veiculoCor={veiculoEmUso.cor}
            veiculoPorte={veiculoEmUso.porte}
          />
          <p className="px-4 py-2 text-sm text-[#545454]">
            {veiculoEmUso.tipo} {veiculoEmUso.cor} · placa {veiculoEmUso.placa}
          </p>
        </Card>
      )}

      {(order.status === "aberto" || order.status === "proposto") && (
        <Card className="mb-4">
          <p className="mb-3 font-bold">Propostas recebidas</p>
          {(propostas ?? []).map((proposta) => {
            const prestadorProposta = Array.isArray(proposta.prestador)
              ? proposta.prestador[0]
              : proposta.prestador;
            return (
              <div
                key={proposta.id}
                className="flex items-center justify-between border-b border-[#E2E2E2] py-3 last:border-b-0"
              >
                <div>
                  <p className="font-medium">{prestadorProposta?.nome}</p>
                  <p className="text-sm text-[#545454]">{formatBRL(proposta.valor)}</p>
                  {proposta.mensagem && (
                    <p className="text-sm text-[#545454]">&ldquo;{proposta.mensagem}&rdquo;</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await aceitarPropostaAction(order.id, proposta.id);
                    }}
                  >
                    <button className="rounded-lg bg-[#127A3E] px-3 py-1.5 text-sm font-bold text-white">
                      Aceitar
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await recusarPropostaAction(order.id, proposta.id);
                    }}
                  >
                    <button className="rounded-lg border border-[#E2E2E2] px-3 py-1.5 text-sm font-medium">
                      Recusar
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {(propostas ?? []).length === 0 && (
            <p className="text-sm text-[#545454]">
              Aguardando propostas de montadores da sua região.
            </p>
          )}
        </Card>
      )}

      {order.status === "agendado" && (
        <PagamentoSection orderId={order.id} payments={order.payments} tipo="sinal_50" />
      )}

      {["em_execucao", "concluido_prestador"].includes(order.status) && (
        <PagamentoSection orderId={order.id} payments={order.payments} tipo="final_50" />
      )}

      {(order.status === "concluido_prestador" || order.status === "aceito_cliente") && (
        <Card className="mb-4">
          <p className="mb-2 font-bold">Fotos do serviço</p>
          <div className="grid grid-cols-3 gap-2">
            {(fotosConclusao ?? []).map((foto) => (
              <div key={foto.url} className="aspect-square rounded-lg bg-[#F6F6F6]" />
            ))}
          </div>
          {order.status === "concluido_prestador" && (
            <form
              action={async () => {
                "use server";
                await aceitarConclusaoAction(order.id);
              }}
              className="mt-4"
            >
              <Button type="submit">Confirmar que ficou bom e liberar pagamento</Button>
            </form>
          )}
        </Card>
      )}

      {order.status === "aceito_cliente" && !minhaAvaliacao && prestador && order.prestador_id && (
        <AvaliacaoForm orderId={order.id} alvoNome={prestador.nome} alvoId={order.prestador_id} />
      )}

      {!["aceito_cliente", "cancelado"].includes(order.status) && (
        <CancelarPedidoButton orderId={order.id} dataAgendada={order.data_agendada} />
      )}
    </div>
  );
}
