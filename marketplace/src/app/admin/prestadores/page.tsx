import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import {
  aprovarPrestadorAction,
  suspenderPrestadorAction,
  reativarPrestadorAction,
} from "./actions";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Aguardando aprovação",
  aprovado: "Aprovado",
  suspenso: "Suspenso",
};

export default async function AdminPrestadoresPage() {
  const admin = createAdminClient();
  const { data: prestadores } = await admin
    .from("provider_profiles")
    .select(
      "user_id, status, raio_km, veiculo_tipo, veiculo_cor, veiculo_porte, strikes, documento_url, selfie_url, comprovante_endereco_url, users(nome, email, telefone)",
    )
    .order("criado_em", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Prestadores</h1>
      <div className="flex flex-col gap-3">
        {(prestadores ?? []).map((prestador) => {
          const usuario = Array.isArray(prestador.users) ? prestador.users[0] : prestador.users;
          const documentosCompletos = Boolean(
            prestador.documento_url && prestador.selfie_url && prestador.comprovante_endereco_url,
          );
          return (
            <Card key={prestador.user_id} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-bold">{usuario?.nome ?? "Sem nome"}</p>
                <p className="text-sm text-[#545454]">
                  {usuario?.email} · {usuario?.telefone}
                </p>
                <p className="text-sm text-[#545454]">
                  {prestador.veiculo_tipo} {prestador.veiculo_cor} · raio {prestador.raio_km}km
                  {prestador.strikes > 0 && ` · ${prestador.strikes} strike(s)`}
                </p>
                <p className="text-sm text-[#545454]">
                  Documentos: {documentosCompletos ? "enviados" : "pendentes"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-sm font-medium">{STATUS_LABEL[prestador.status]}</span>
                {prestador.status === "pendente" && (
                  <form
                    action={async () => {
                      "use server";
                      await aprovarPrestadorAction(prestador.user_id);
                    }}
                  >
                    <button
                      type="submit"
                      disabled={!documentosCompletos}
                      className="rounded-lg bg-[#127A3E] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                    >
                      Aprovar
                    </button>
                  </form>
                )}
                {prestador.status === "aprovado" && (
                  <form
                    action={async () => {
                      "use server";
                      await suspenderPrestadorAction(prestador.user_id);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg bg-[#BB032A] px-4 py-2 text-sm font-bold text-white"
                    >
                      Suspender
                    </button>
                  </form>
                )}
                {prestador.status === "suspenso" && (
                  <form
                    action={async () => {
                      "use server";
                      await reativarPrestadorAction(prestador.user_id);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white"
                    >
                      Reativar
                    </button>
                  </form>
                )}
              </div>
            </Card>
          );
        })}
        {(prestadores ?? []).length === 0 && (
          <p className="text-[#545454]">Nenhum prestador cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
