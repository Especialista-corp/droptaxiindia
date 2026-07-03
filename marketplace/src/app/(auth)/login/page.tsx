"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-1 text-3xl font-bold text-black">Entrar</h1>
        <p className="mb-8 text-[#545454]">Acesse sua conta MontaJá</p>

        <form action={formAction} className="flex flex-col gap-4">
          <Input label="E-mail" name="email" type="email" required autoComplete="email" />
          <Input
            label="Senha"
            name="senha"
            type="password"
            required
            autoComplete="current-password"
          />
          {state?.error && <p className="text-sm text-[#BB032A]">{state.error}</p>}
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <div className="mt-8 flex flex-col gap-2 text-center text-sm text-[#545454]">
          <span>
            Não tem conta?{" "}
            <Link href="/cadastro" className="font-bold text-black">
              Cadastre-se
            </Link>
          </span>
          <span>
            É prestador de serviço?{" "}
            <Link href="/cadastro/prestador" className="font-bold text-black">
              Cadastre-se como montador
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
