#!/bin/sh
# Agendador das regras de negócio automáticas. Roda como container ao lado do
# app e chama as rotas /api/cron/* pela rede interna do Docker.
#
# O relógio do container é UTC: 11:00 UTC = 08:00 e 12:00 UTC = 09:00 em Brasília.
# As chamadas de hora em hora também mantêm o projeto gratuito do Supabase
# ativo (ele pausa após 7 dias sem nenhuma consulta ao banco).

APP_URL="${APP_URL:-http://app:3000}"

chamar() {
  resposta=$(wget -q -T 60 -O - --header "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}/api/cron/$1" 2>&1) \
    && echo "$(date -u +%FT%TZ) ok    $1 ${resposta}" \
    || echo "$(date -u +%FT%TZ) FALHA $1 ${resposta}"
}

echo "$(date -u +%FT%TZ) agendador iniciado (${APP_URL})"

while true; do
  # Dorme até a virada do próximo minuto, para nunca pular um horário cheio.
  sleep $((60 - $(date -u +%S | sed 's/^0//')))
  minuto=$(date -u +%M)
  hora=$(date -u +%H)

  case "$minuto" in
    00|15|30|45) chamar requeue-sinal-vencido ;;
  esac

  if [ "$minuto" = "00" ]; then
    chamar d1-realocacao
    chamar auto-release

    case "$hora" in
      03) chamar limpar-rastreamento ;;
      11) chamar documentos-vencidos ;;
      12) chamar d1-confirmacao
          chamar uso-plataforma ;;
    esac
  fi
done
