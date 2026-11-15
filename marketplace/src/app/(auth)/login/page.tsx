"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND } from "@/lib/constants";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <p className="mb-6 text-4xl font-bold tracking-tight">
          <span className="bg-brand-gradient bg-clip-text text-transparent">{BRAND.name}</span>
        </p>
        <h1 className="mb-1 text-3xl font-bold text-foreground">Entrar</h1>
        <p className="mb-8 text-muted">Acesse sua conta {BRAND.name}</p>

        <form action={formAction} className="flex flex-col gap-4">
          <Input label="E-mail" name="email" type="email" required autoComplete="email" />
          <Input
            label="Senha"
            name="senha"
            type="password"
            required
            autoComplete="current-password"
          />
          {state?.error && <p className="text-sm text-danger-soft">{state.error}</p>}
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <div className="mt-8 flex flex-col gap-2 text-center text-sm text-muted">
          <span>
            Não tem conta?{" "}
            <Link href="/cadastro" className="font-bold text-foreground">
              Cadastre-se
            </Link>
          </span>
          <span>
            É prestador de serviço?{" "}
            <Link href="/cadastro/prestador" className="font-bold text-foreground">
              Cadastre-se como montador
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
