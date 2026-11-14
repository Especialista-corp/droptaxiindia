# Pendências do MontaJá

Fonte da verdade do que falta fazer. Planilha equivalente: `docs/lista-de-tarefas.xlsx`.
Marque `[x]` ao concluir um item e faça commit.

## Gatilho "voltar onde paramos"

Quando o dono do projeto escrever **"voltar onde paramos"**, retome pelas pendências da Fase 1 que dependem dele:

1. Pedir a saída do diagnóstico da VPS (Hostinger, terminal do navegador):
   `docker ps -a; docker compose ls -a; docker network ls; df -h /; free -h`
2. Pedir as credenciais do projeto Supabase (Project URL, anon key, service_role key) e guiar a criação passo a passo.
3. Perguntar qual domínio usar no Cloudflare.

Nunca peça chaves no chat para serem guardadas no repositório: elas ficam só na VPS.

## Fase 1: colocar no ar
- [ ] 1. (Dono) Criar projeto no Supabase e passar Project URL, anon key e service_role key
- [ ] 2. (Claude) Aplicar as migrações no Supabase e conferir regras de acesso e armazenamento de fotos
- [ ] 3. (Dono) Rodar o diagnóstico da VPS e colar o resultado
- [ ] 4. (Dono) Escolher o domínio e colocá-lo no Cloudflare
- [ ] 5. (Claude) Gerar CRON_SECRET e chaves VAPID e montar a configuração de produção
- [ ] 6. (Claude) Subir app e agendador na VPS (Docker + Traefik) com HTTPS
- [ ] 7. (Claude) Repetir o ciclo completo no endereço real

## Fase 2: integrações
- [ ] 8. (Dono) Criar conta Asaas sandbox e passar a chave de API
- [ ] 9. (Claude) Testar Pix real no sandbox e o repasse ao montador
- [ ] 10. (Dono) Criar chave de API do Google Maps
- [ ] 11. (Dono) Criar conta no Resend e passar a chave de API

## Fase 3: construir
- [ ] 12. (Claude) Fluxo de disputas: cliente abre, pagamento congela, admin resolve
- [ ] 13. (Claude) Corrigir a lista de itens que o montador vê no pedido
- [ ] 14. (Claude) Mapa escuro combinando com o tema
- [ ] 15. (Claude) Ícones PNG para instalar no iPhone e no Android
- [ ] 16. (Claude) Verificação do telefone do montador por SMS
- [ ] 17. (Claude) Testes automáticos
- [ ] 18. (Claude) Revisão de segurança (regras de acesso, ações do servidor, pagamento)

## Fase 4: antes do lançamento
- [ ] 19. (Dono) Decidir o nome definitivo e consultar o INPI ("UBER" tem risco de marca)
- [ ] 20. (Dono) Termos de uso e política de privacidade (LGPD)
- [ ] 21. (Claude) Documentação final e lista de ideias da Fase 2 do produto
