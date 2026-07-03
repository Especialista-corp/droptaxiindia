"use client";

import { useActionState } from "react";
import Link from "next/link";
import { cadastroClienteAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CadastroClientePage() {
  const [state, formAction, pending] = useActionState(cadastroClienteAction, undefined);

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-1 text-3xl font-bold text-black">Criar conta</h1>
        <p className="mb-8 text-[#545454]">
          Em 60 segundos você agenda a montagem do seu móvel.
        </p>

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
          {state?.error && <p className="text-sm text-[#BB032A]">{state.error}</p>}
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Criando conta…" : "Criar conta"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-[#545454]">
          Já tem conta?{" "}
          <Link href="/login" className="font-bold text-black">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
