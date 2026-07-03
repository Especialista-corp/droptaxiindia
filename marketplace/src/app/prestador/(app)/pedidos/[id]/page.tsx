import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusStepper } from "@/components/order/status-stepper";
import { formatBRL, formatDataAgendada } from "@/lib/utils";
import type { OrderStatus } from "@/lib/constants";
import { enviarPropostaAction } from "../actions";
import {
  confirmarPresencaAction,
  iniciarDeslocamentoAction,
  marcarChegueiAction,
} from "../../actions-execucao";
import { ConclusaoForm } from "./conclusao-form";
import { TrackingBroadcaster } from "./tracking-broadcaster";
import { PrestadorAvaliacaoGate } from "./avaliacao-gate";

export default async function PrestadorPedidoDetalhePage({
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
    .select("*, order_items(*, service_items(nome)), cliente:cliente_id(nome, telefone)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  const cliente = Array.isArray(order.cliente) ? order.cliente[0] : order.cliente;
  const isMeuPedido = order.prestador_id === user?.id;
  const podeEnviarProposta =
    !isMeuPedido && (order.status === "aberto" || order.status === "proposto");

  return (
    <div className="px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold">{formatDataAgendada(order.data_agendada)}</h1>
      <p className="mb-6 text-[#545454]">
        {order.janela_inicio.slice(0, 5)}–{order.janela_fim.slice(0, 5)}
      </p>

      {isMeuPedido && (
        <div className="mb-6">
          <OrderStatusStepper status={order.status as OrderStatus} />
        </div>
      )}

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
          <span>Tabela</span>
          <span>{formatBRL(order.valor_tabela)}</span>
        </div>
        {order.valor_acordado && (
          <div className="flex justify-between font-bold text-[#127A3E]">
            <span>Acordado</span>
            <span>{formatBRL(order.valor_acordado)}</span>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <p className="mb-1 font-bold">Endereço</p>
        <p className="text-sm text-[#545454]">
          {order.endereco}, {order.numero} — {order.bairro}, {order.cidade}/{order.estado}
        </p>
        {order.descricao && <p className="mt-2 text-sm">{order.descricao}</p>}
      </Card>

      {isMeuPedido && (
        <Card className="mb-4">
          <p className="mb-1 font-bold">Cliente</p>
          <p className="text-sm text-[#545454]">
            {cliente?.nome} · {cliente?.telefone}
          </p>
        </Card>
      )}

      {podeEnviarProposta && (
        <Card>
          <p className="mb-3 font-bold">Enviar proposta</p>
          <form action={enviarPropostaAction} className="flex flex-col gap-3">
            <input type="hidden" name="orderId" value={order.id} />
            <div className="flex gap-3">
              <input
                type="number"
                name="valor"
                step="0.01"
                defaultValue={order.valor_tabela}
                className="flex-1 rounded-lg border border-[#E2E2E2] px-3 py-2"
              />
              <Button type="submit" fullWidth={false} className="px-6">
                Enviar
              </Button>
            </div>
            <textarea
              name="mensagem"
              placeholder="Mensagem para o cliente (opcional)"
              className="rounded-lg border border-[#E2E2E2] p-2 text-sm"
              rows={2}
            />
            <p className="text-xs text-[#545454]">
              Contrapropostas podem variar até ±60% do valor tabelado ({formatBRL(order.valor_tabela)}
              ).
            </p>
          </form>
        </Card>
      )}

      {isMeuPedido && order.status === "agendado" && (
        <form
          action={async () => {
            "use server";
            await confirmarPresencaAction(order.id);
          }}
          className="mt-4"
        >
          <Button type="submit">Confirmar presença</Button>
        </form>
      )}

      {isMeuPedido && order.status === "confirmado" && (
        <form
          action={async () => {
            "use server";
            await iniciarDeslocamentoAction(order.id);
          }}
          className="mt-4"
        >
          <Button type="submit">Iniciar deslocamento</Button>
        </form>
      )}

      {isMeuPedido && order.status === "em_deslocamento" && (
        <form
          action={async () => {
            "use server";
            await marcarChegueiAction(order.id);
          }}
          className="mt-4"
        >
          <Button type="submit">Cheguei</Button>
        </form>
      )}

      {isMeuPedido && order.status === "em_deslocamento" && user && (
        <TrackingBroadcaster orderId={order.id} prestadorId={user.id} />
      )}

      {isMeuPedido && order.status === "em_execucao" && <ConclusaoForm orderId={order.id} />}

      {isMeuPedido && order.status === "concluido_prestador" && (
        <p className="mt-4 text-sm text-[#545454]">Aguardando aceite do cliente.</p>
      )}

      {isMeuPedido && order.status === "aceito_cliente" && (
        <PrestadorAvaliacaoGate orderId={order.id} clienteId={order.cliente_id} prestadorId={user!.id} />
      )}
    </div>
  );
}
