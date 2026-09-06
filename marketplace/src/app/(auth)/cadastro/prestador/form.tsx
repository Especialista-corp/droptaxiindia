"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { cadastroPrestadorAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VEHICLE_COLORS, VEHICLE_TYPES, TRUCK_SIZES, TRUCK_SIZE_LABELS, type VehicleType } from "@/lib/constants";

export function PrestadorSignupForm({
  categorias,
}: {
  categorias: { id: string; nome: string }[];
}) {
  const [state, formAction, pending] = useActionState(cadastroPrestadorAction, undefined);
  const [veiculo1Tipo, setVeiculo1Tipo] = useState<VehicleType>("carro");
  const [veiculo2Tipo, setVeiculo2Tipo] = useState<VehicleType>("moto");
  const [temSegundoVeiculo, setTemSegundoVeiculo] = useState(false);
  const [endereco, setEndereco] = useState({ endereco: "", bairro: "", cidade: "", estado: "" });
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepErro, setCepErro] = useState<string>();

  async function buscarCep(valor: string) {
    const cep = valor.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    setCepErro(undefined);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepErro("CEP não encontrado — preencha o endereço manualmente.");
        return;
      }
      setEndereco({
        endereco: data.logradouro ?? "",
        bairro: data.bairro ?? "",
        cidade: data.localidade ?? "",
        estado: data.uf ?? "",
      });
    } catch {
      setCepErro("Não foi possível consultar o CEP — preencha o endereço manualmente.");
    } finally {
      setBuscandoCep(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input label="Nome completo" name="nome" required />
      <Input label="E-mail" name="email" type="email" required autoComplete="email" />
      <Input
        label="Telefone (com DDD)"
        name="telefone"
        type="tel"
        placeholder="11987654321"
        required
      />
      <Input
        label="Senha"
        name="senha"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
      />

      <div className="flex flex-col gap-1.5">
        <Input
          label="CEP"
          name="cep"
          inputMode="numeric"
          placeholder="00000-000"
          required
          onBlur={(event) => buscarCep(event.target.value)}
          onChange={(event) => {
            if (event.target.value.replace(/\D/g, "").length === 8) {
              buscarCep(event.target.value);
            }
          }}
        />
        {buscandoCep && <span className="text-sm text-[#545454]">Buscando endereço…</span>}
        {cepErro && <span className="text-sm text-[#BB032A]">{cepErro}</span>}
      </div>

      <Input
        label="Endereço"
        name="endereco"
        required
        value={endereco.endereco}
        onChange={(event) => setEndereco((prev) => ({ ...prev, endereco: event.target.value }))}
      />
      <div className="flex gap-3">
        <Input label="Número" name="numero" required className="flex-1" />
        <Input
          label="Complemento (apto, bloco…)"
          name="complemento"
          className="flex-1"
          placeholder="Apto 42"
        />
      </div>
      <Input
        label="Bairro"
        name="bairro"
        value={endereco.bairro}
        onChange={(event) => setEndereco((prev) => ({ ...prev, bairro: event.target.value }))}
      />
      <div className="flex gap-3">
        <Input
          label="Cidade"
          name="cidade"
          className="flex-1"
          value={endereco.cidade}
          onChange={(event) => setEndereco((prev) => ({ ...prev, cidade: event.target.value }))}
        />
        <Input
          label="UF"
          name="estado"
          maxLength={2}
          className="w-20"
          value={endereco.estado}
          onChange={(event) => setEndereco((prev) => ({ ...prev, estado: event.target.value }))}
        />
      </div>

      <Input
        label="Raio de atuação (km)"
        name="raioKm"
        type="number"
        min={1}
        max={100}
        defaultValue={10}
        required
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-black">Categorias que você atende</span>
        <div className="flex flex-col gap-2 rounded-lg border border-[#E2E2E2] bg-[#F6F6F6] p-3">
          {categorias.map((categoria) => (
            <label key={categoria.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="categoriaIds" value={categoria.id} />
              {categoria.nome}
            </label>
          ))}
          {categorias.length === 0 && (
            <p className="text-sm text-[#545454]">
              Nenhuma categoria cadastrada ainda. Rode o seed do catálogo.
            </p>
          )}
        </div>
      </div>

      <VeiculoFields indice={1} tipo={veiculo1Tipo} onTipoChange={setVeiculo1Tipo} />

      {!temSegundoVeiculo ? (
        <button
          type="button"
          onClick={() => setTemSegundoVeiculo(true)}
          className="text-left text-sm font-bold text-black underline"
        >
          + Adicionar segundo veículo (opcional)
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-black">Segundo veículo</span>
            <button
              type="button"
              onClick={() => setTemSegundoVeiculo(false)}
              className="text-sm font-medium text-[#BB032A]"
            >
              Remover
            </button>
          </div>
          <VeiculoFields indice={2} tipo={veiculo2Tipo} onTipoChange={setVeiculo2Tipo} />
        </>
      )}
      <input type="hidden" name="temSegundoVeiculo" value={temSegundoVeiculo ? "1" : ""} />

      {state?.error && <p className="text-sm text-[#BB032A]">{state.error}</p>}

      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Criando conta…" : "Criar conta de montador"}
      </Button>

      <p className="text-center text-sm text-[#545454]">
        Já tem conta?{" "}
        <Link href="/login" className="font-bold text-black">
          Entrar
        </Link>
      </p>
    </form>
  );
}

function VeiculoFields({
  indice,
  tipo,
  onTipoChange,
}: {
  indice: 1 | 2;
  tipo: VehicleType;
  onTipoChange: (tipo: VehicleType) => void;
}) {
  const prefixo = `veiculo${indice}`;
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#E2E2E2] p-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-black">
          {indice === 1 ? "Veículo principal" : "Tipo do segundo veículo"}
        </span>
        <select
          name={`${prefixo}Tipo`}
          value={tipo}
          onChange={(event) => onTipoChange(event.target.value as VehicleType)}
          className="h-14 rounded-lg border border-[#E2E2E2] bg-[#F6F6F6] px-4 text-base"
        >
          {VEHICLE_TYPES.map((tipoOpcao) => (
            <option key={tipoOpcao} value={tipoOpcao}>
              {tipoOpcao === "moto" && "Moto"}
              {tipoOpcao === "carro" && "Carro"}
              {tipoOpcao === "pickup" && "Pickup / Fiorino"}
              {tipoOpcao === "caminhao" && "Caminhão"}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-black">Cor</span>
        <select
          name={`${prefixo}Cor`}
          className="h-14 rounded-lg border border-[#E2E2E2] bg-[#F6F6F6] px-4 text-base"
        >
          {VEHICLE_COLORS[tipo].map((cor) => (
            <option key={cor} value={cor}>
              {cor}
            </option>
          ))}
        </select>
      </div>

      {tipo === "caminhao" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-black">Porte do caminhão</span>
          <select
            name={`${prefixo}Porte`}
            className="h-14 rounded-lg border border-[#E2E2E2] bg-[#F6F6F6] px-4 text-base"
          >
            {TRUCK_SIZES.map((porte) => (
              <option key={porte} value={porte}>
                {TRUCK_SIZE_LABELS[porte]}
              </option>
            ))}
          </select>
        </div>
      )}

      <Input
        label="Placa"
        name={`${prefixo}Placa`}
        placeholder="ABC1D23"
        maxLength={8}
        required
        className="uppercase"
      />
    </div>
  );
}
