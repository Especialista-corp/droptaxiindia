"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { criarPedidoAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/utils";
import type { ServiceItemsRow } from "@/types/database";

const STEPS = ["Itens", "Detalhes", "Data e hora", "Endereço", "Revisão"] as const;

export function NovoPedidoWizard({
  categoryId,
  categoryNome,
  itens,
}: {
  categoryId: string;
  categoryNome: string;
  itens: ServiceItemsRow[];
}) {
  const [step, setStep] = useState(0);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [coords, setCoords] = useState<{ lat: number; lng: number }>();
  const [state, formAction, pending] = useActionState(criarPedidoAction, undefined);

  const itensSelecionados = useMemo(
    () =>
      Object.entries(quantidades)
        .filter(([, qtd]) => qtd > 0)
        .map(([serviceItemId, quantidade]) => ({ serviceItemId, quantidade })),
    [quantidades],
  );

  const valorEstimado = useMemo(
    () =>
      itensSelecionados.reduce((total, { serviceItemId, quantidade }) => {
        const item = itens.find((i) => i.id === serviceItemId);
        return total + (item?.preco_base ?? 0) * quantidade;
      }, 0),
    [itensSelecionados, itens],
  );

  const podeAvancar = step === 0 ? itensSelecionados.length > 0 : true;

  const itensPadrao = itens.filter((item) => item.tipo_item === "padrao");
  const itensAdicionais = itens.filter((item) => item.tipo_item === "adicional");

  function alterarQuantidade(itemId: string, delta: number) {
    setQuantidades((prev) => {
      const atual = prev[itemId] ?? 0;
      const novo = Math.max(0, Math.min(20, atual + delta));
      return { ...prev, [itemId]: novo };
    });
  }

  return (
    <div className="px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold">Novo pedido</h1>
      <p className="mb-6 text-[#545454]">{categoryNome}</p>

      <div className="mb-8 flex gap-2">
        {STEPS.map((label, index) => (
          <div
            key={label}
            className={`h-1 flex-1 rounded-full ${index <= step ? "bg-black" : "bg-[#E2E2E2]"}`}
          />
        ))}
      </div>

      <form action={formAction}>
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="itensJson" value={JSON.stringify(itensSelecionados)} />

        <div hidden={step !== 0} className="flex flex-col gap-6">
          <ItemGroup
            titulo="Móveis"
            itens={itensPadrao}
            quantidades={quantidades}
            onChange={alterarQuantidade}
          />
          {itensAdicionais.length > 0 && (
            <ItemGroup
              titulo="Adicionais"
              itens={itensAdicionais}
              quantidades={quantidades}
              onChange={alterarQuantidade}
            />
          )}
        </div>

        <div hidden={step !== 1} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-black">Descrição (opcional)</span>
            <textarea
              name="descricao"
              rows={4}
              className="rounded-lg border border-[#E2E2E2] bg-[#F6F6F6] p-3 text-base outline-none focus:border-black"
              placeholder="Alguma observação sobre a montagem?"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-black">Fotos (opcional)</span>
            <input type="file" name="fotos" accept="image/*" multiple />
          </label>
        </div>

        <div hidden={step !== 2} className="flex flex-col gap-4">
          <Input label="Data" name="dataAgendada" type="date" required={step === 2} />
          <div className="flex gap-3">
            <Input label="Das" name="janelaInicio" type="time" required={step === 2} />
            <Input label="Até" name="janelaFim" type="time" required={step === 2} />
          </div>
        </div>

        <div hidden={step !== 3} className="flex flex-col gap-4">
          <Input label="Endereço" name="endereco" required={step === 3} />
          <div className="flex gap-3">
            <Input label="Número" name="numero" className="flex-1" />
            <Input label="Complemento" name="complemento" className="flex-1" />
          </div>
          <Input label="Bairro" name="bairro" />
          <div className="flex gap-3">
            <Input label="Cidade" name="cidade" className="flex-1" />
            <Input label="Estado" name="estado" maxLength={2} className="w-20" />
          </div>
          <Input label="CEP" name="cep" />
          <input type="hidden" name="lat" value={coords?.lat ?? ""} />
          <input type="hidden" name="lng" value={coords?.lng ?? ""} />
          <button
            type="button"
            onClick={() => {
              navigator.geolocation?.getCurrentPosition((position) =>
                setCoords({ lat: position.coords.latitude, lng: position.coords.longitude }),
              );
            }}
            className="text-left text-sm font-medium text-black underline"
          >
            {coords ? "Localização capturada ✓" : "Usar minha localização atual"}
          </button>
          <p className="text-xs text-[#545454]">
            Isso ajuda o montador a chegar até você e habilita o mapa de acompanhamento.
          </p>
        </div>

        <div hidden={step !== 4} className="flex flex-col gap-4">
          <div className="rounded-xl border border-[#E2E2E2] p-4">
            <p className="mb-2 font-bold">Resumo</p>
            {itensSelecionados.map(({ serviceItemId, quantidade }) => {
              const item = itens.find((i) => i.id === serviceItemId);
              if (!item) return null;
              return (
                <div key={serviceItemId} className="flex justify-between text-sm">
                  <span>
                    {quantidade}x {item.nome}
                  </span>
                  <span>{formatBRL(item.preco_base * quantidade)}</span>
                </div>
              );
            })}
            <div className="mt-3 flex justify-between border-t border-[#E2E2E2] pt-3 font-bold">
              <span>Total estimado</span>
              <span>{formatBRL(valorEstimado)}</span>
            </div>
          </div>
          {state?.error && <p className="text-sm text-[#BB032A]">{state.error}</p>}
        </div>

        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((s) => s - 1)}
            >
              Voltar
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!podeAvancar} onClick={() => setStep((s) => s + 1)}>
              Continuar
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? "Publicando…" : "Publicar pedido"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function ItemGroup({
  titulo,
  itens,
  quantidades,
  onChange,
}: {
  titulo: string;
  itens: ServiceItemsRow[];
  quantidades: Record<string, number>;
  onChange: (itemId: string, delta: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-[#545454]">{titulo}</p>
      <div className="flex flex-col gap-2">
        {itens.map((item) => {
          const quantidade = quantidades[item.id] ?? 0;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-[#E2E2E2] p-3"
            >
              <div>
                <p className="font-medium">{item.nome}</p>
                <p className="text-sm text-[#545454]">{formatBRL(item.preco_base)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onChange(item.id, -1)}
                  className="h-8 w-8 rounded-full border border-[#E2E2E2] font-bold"
                >
                  −
                </button>
                <span className="w-4 text-center">{quantidade}</span>
                <button
                  type="button"
                  onClick={() => onChange(item.id, 1)}
                  className="h-8 w-8 rounded-full border border-[#E2E2E2] font-bold"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
