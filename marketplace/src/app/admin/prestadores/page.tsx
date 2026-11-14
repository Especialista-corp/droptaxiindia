import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { formatarCpf } from "@/lib/cpf";
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
      "user_id, cpf, status, raio_km, strikes, documento_url, selfie_url, comprovante_endereco_url, certidao_negativa_url, documentos_prazo_em, cep, endereco, numero, complemento, bairro, cidade, estado, users!provider_profiles_user_id_fkey(nome, email, telefone), provider_vehicles(tipo, cor, porte, placa, em_uso)",
    )
    .order("criado_em", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Prestadores</h1>
      <div className="flex flex-col gap-3">
        {(prestadores ?? []).map((prestador) => {
          const usuario = Array.isArray(prestador.users) ? prestador.users[0] : prestador.users;
          const obrigatoriosOk = Boolean(
            prestador.comprovante_endereco_url && prestador.certidao_negativa_url,
          );
          const identificacaoOk = Boolean(prestador.documento_url && prestador.selfie_url);
          return (
            <Card key={prestador.user_id} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-bold">{usuario?.nome ?? "Sem nome"}</p>
                <p className="text-sm text-muted">
                  {usuario?.email} · {usuario?.telefone}
                  {prestador.cpf && ` · CPF ${formatarCpf(prestador.cpf)}`}
                </p>
                <p className="text-sm text-muted">
                  {prestador.endereco
                    ? `${prestador.endereco}, ${prestador.numero ?? "s/n"}${prestador.complemento ? ` (${prestador.complemento})` : ""} — ${prestador.bairro ?? ""}, ${prestador.cidade ?? ""}/${prestador.estado ?? ""} · CEP ${prestador.cep ?? "—"}`
                    : "Endereço não informado"}
                </p>
                <p className="text-sm text-muted">
                  {(prestador.provider_vehicles ?? [])
                    .map(
                      (veiculo) =>
                        `${veiculo.tipo} ${veiculo.cor} (${veiculo.placa})${veiculo.em_uso ? " ✓" : ""}`,
                    )
                    .join(" · ") || "sem veículo"}{" "}
                  · raio {prestador.raio_km}km
                  {prestador.strikes > 0 && ` · ${prestador.strikes} strike(s)`}
                </p>
                <p className="text-sm text-muted">
                  Comprovante + certidão: {obrigatoriosOk ? "✓ enviados" : "pendentes"} · RG/selfie:{" "}
                  {identificacaoOk ? "✓" : "pendentes"}
                  {!obrigatoriosOk &&
                    prestador.documentos_prazo_em &&
                    ` · prazo ${new Date(prestador.documentos_prazo_em).toLocaleDateString("pt-BR")}`}
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
                      className="rounded-lg bg-success-strong px-4 py-2 text-sm font-bold text-on-brand"
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
                      className="rounded-lg bg-danger px-4 py-2 text-sm font-bold text-on-brand"
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
                      className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-bold text-on-brand"
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
          <p className="text-muted">Nenhum prestador cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
