# Pendências do MontaJá

Fonte da verdade do que falta fazer. Planilha equivalente: `docs/lista-de-tarefas.xlsx`.
Marque `[x]` ao concluir um passo e faça commit. "Dono" = depende do dono do projeto; "Claude" = o assistente faz.

## Gatilho "voltar onde paramos"

Quando o dono do projeto escrever **"voltar onde paramos"**, retome pelos passos da Etapa 1 e 2 que dependem dele:

1. Pedir a saída do diagnóstico da VPS (Hostinger, terminal do navegador):
   `docker ps -a; docker compose ls -a; docker network ls; df -h /; free -h`
2. Pedir as credenciais do projeto Supabase (Project URL, anon key, service_role key) e guiar a criação passo a passo.
3. Perguntar qual domínio usar no Cloudflare.

Nunca peça chaves no chat para serem guardadas no repositório: elas ficam só na VPS.

## Etapa 1: Banco de dados real (Supabase)
- [ ] 1. (Dono) Criar conta e projeto no Supabase (região São Paulo)
- [ ] 2. (Dono) Enviar Project URL, anon key e service_role key (por canal seguro)
- [ ] 3. (Claude) Aplicar as migrações 0001 a 0005 no projeto
- [ ] 4. (Claude) Conferir regras de acesso (RLS) e as pastas privadas de fotos
- [ ] 5. (Claude) Criar o primeiro usuário administrador

## Etapa 2: Servidor (VPS Hostinger + Cloudflare)
- [ ] 6. (Dono) Rodar o diagnóstico na VPS e colar o resultado
- [ ] 7. (Dono) Escolher o domínio e apontá-lo pelo Cloudflare
- [ ] 8. (Claude) Gerar CRON_SECRET e chaves de notificação (VAPID) e montar a configuração
- [ ] 9. (Claude) Preparar Docker Compose com Traefik e HTTPS
- [ ] 10. (Claude) Subir o app e o agendador de tarefas
- [ ] 11. (Claude) Repetir o ciclo completo no endereço real

## Etapa 3: Pagamentos (Asaas)
- [ ] 12. (Dono) Criar a conta Asaas sandbox e enviar a chave de API
- [ ] 13. (Claude) Testar cobrança Pix real no sandbox e o retorno automático (webhook)
- [ ] 14. (Claude) Implementar o repasse ao montador (subconta e divisão)
- [ ] 15. (Claude) Testar cancelamento e reembolso
- [ ] 16. (Dono) Abrir a conta Asaas de produção (documentos da empresa)

## Etapa 4: Mapa e notificações
- [ ] 17. (Dono) Criar a chave do Google Maps
- [ ] 18. (Claude) Ligar o mapa ao vivo e testar com dois celulares
- [ ] 19. (Claude) Trocar o mapa claro por mapa escuro
- [ ] 20. (Dono) Criar a conta Resend e configurar o e-mail do domínio
- [ ] 21. (Claude) Testar notificações no celular e por e-mail

## Etapa 5: Funcionalidades que faltam
- [ ] 22. (Claude) Fluxo de disputas: cliente abre, pagamento congela, admin resolve
- [ ] 23. (Claude) Corrigir a lista de itens que o montador vê no pedido
- [ ] 24. (Dono) Contratar o serviço de SMS
- [ ] 25. (Claude) Verificação do telefone do montador por SMS
- [ ] 26. (Claude) Gerar os ícones PNG para iPhone e Android

## Etapa 6: Qualidade e segurança
- [ ] 27. (Claude) Criar os testes automáticos do fluxo principal
- [ ] 28. (Claude) Revisão de segurança (acesso, ações do servidor, pagamento)
- [ ] 29. (Dono) Testar em iPhone e Android reais

## Etapa 7: Lançamento
- [ ] 30. (Dono) Decidir o nome definitivo e consultar a marca no INPI
- [ ] 31. (Dono) Termos de uso e política de privacidade (LGPD)
- [ ] 32. (Claude) Guia de operação e lista de ideias da Fase 2
- [ ] 33. (Dono) Piloto com poucos montadores e clientes
