import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const MB = 1024 * 1024;

function limiteDoEnv(nome: string, padrao: number) {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

/**
 * Limites do plano do Supabase em uso. Os padrões são os do plano gratuito;
 * ao migrar para o Pro, ajuste as variáveis (ex.: 8000 / 100000 / 100000) em
 * vez de mexer no código.
 */
const LIMITES = {
  dbBytes: limiteDoEnv("SUPABASE_LIMITE_BANCO_MB", 500) * MB,
  storageBytes: limiteDoEnv("SUPABASE_LIMITE_ARQUIVOS_MB", 1024) * MB,
  usuariosAtivos: limiteDoEnv("SUPABASE_LIMITE_USUARIOS_ATIVOS", 50_000),
};

export const ALERTA_ATENCAO_PERCENT = 70;
export const ALERTA_CRITICO_PERCENT = 90;

export type NivelDeUso = "ok" | "atencao" | "critico";

export type MetricaDeUso = {
  chave: "banco" | "arquivos" | "usuarios";
  rotulo: string;
  usadoTexto: string;
  limiteTexto: string;
  percent: number;
  nivel: NivelDeUso;
};

export function nivelDeUso(percent: number): NivelDeUso {
  if (percent >= ALERTA_CRITICO_PERCENT) return "critico";
  if (percent >= ALERTA_ATENCAO_PERCENT) return "atencao";
  return "ok";
}

function formatarBytes(bytes: number) {
  return bytes >= 1024 * MB ? `${(bytes / (1024 * MB)).toFixed(1)} GB` : `${(bytes / MB).toFixed(0)} MB`;
}

function metrica(
  chave: MetricaDeUso["chave"],
  rotulo: string,
  usado: number,
  limite: number,
  formatar: (valor: number) => string,
): MetricaDeUso {
  const percent = Math.min(100, Math.round((usado / limite) * 100));
  return {
    chave,
    rotulo,
    usadoTexto: formatar(usado),
    limiteTexto: formatar(limite),
    percent,
    nivel: nivelDeUso(percent),
  };
}

/** Retorna null se a função platform_usage ainda não existe no banco (migração 0004). */
export async function obterUsoDaPlataforma(): Promise<MetricaDeUso[] | null> {
  const { data, error } = await createAdminClient().rpc("platform_usage");
  const uso = data?.[0];
  if (error || !uso) return null;

  const inteiro = (valor: number) => valor.toLocaleString("pt-BR");
  return [
    metrica("banco", "Banco de dados", uso.db_bytes, LIMITES.dbBytes, formatarBytes),
    metrica("arquivos", "Fotos e documentos", uso.storage_bytes, LIMITES.storageBytes, formatarBytes),
    metrica("usuarios", "Usuários ativos (30 dias)", uso.usuarios_ativos_30d, LIMITES.usuariosAtivos, inteiro),
  ];
}
