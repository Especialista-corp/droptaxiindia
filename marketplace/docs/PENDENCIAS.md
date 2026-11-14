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
- [ ] 6. (Claude) Definir o backup do banco de dados real

## Etapa 2: Servidor (VPS Hostinger + Cloudflare)
- [ ] 7. (Dono) Rodar o diagnóstico na VPS e colar o resultado
- [ ] 8. (Dono) Escolher o domínio e apontá-lo pelo Cloudflare
- [ ] 9. (Claude) Gerar CRON_SECRET e chaves de notificação (VAPID) e montar a configuração
- [ ] 10. (Claude) Preparar Docker Compose com Traefik e HTTPS
- [ ] 11. (Claude) Subir o app e o agendador de tarefas
- [ ] 12. (Claude) Repetir o ciclo completo no endereço real

## Etapa 3: Mapa e notificações
- [ ] 13. (Dono) Criar a chave do Google Maps
- [ ] 14. (Claude) Ligar o mapa ao vivo e testar com dois celulares
- [ ] 15. (Claude) Trocar o mapa claro por mapa escuro
- [ ] 16. (Dono) Criar a conta Resend e configurar o e-mail do domínio
- [ ] 17. (Claude) Testar notificações no celular e por e-mail

## Etapa 4: Funcionalidades que faltam
- [ ] 18. (Claude) Fluxo de disputas: cliente abre, pagamento congela, admin resolve
- [ ] 19. (Claude) Corrigir a lista de itens que o montador vê no pedido
- [ ] 20. (Dono) Contratar o serviço de SMS
- [ ] 21. (Claude) Verificação do telefone do montador por SMS
- [ ] 22. (Claude) Gerar os ícones PNG para iPhone e Android

## Etapa 5: Qualidade e segurança
- [ ] 23. (Claude) Criar os testes automáticos do fluxo principal
- [ ] 24. (Claude) Revisão de segurança (acesso, ações do servidor, pagamento)
- [ ] 25. (Dono) Testar em iPhone e Android reais
- [ ] 26. (Claude) Limpar a cópia antiga: pasta marketplace do droptaxiindia e a PR #1

## Etapa 6: Pagamentos (Asaas)
- [ ] 27. (Dono) Criar a conta Asaas sandbox e enviar a chave de API
- [ ] 28. (Claude) Testar cobrança Pix real no sandbox e o retorno automático (webhook)
- [ ] 29. (Claude) Implementar o repasse ao montador (subconta e divisão)
- [ ] 30. (Claude) Testar cancelamento e reembolso
- [ ] 31. (Dono) Abrir a conta Asaas de produção (documentos da empresa), cerca de 1 semana antes do piloto

## Etapa 7: Lançamento
- [ ] 32. (Dono) Decidir o nome definitivo e consultar a marca no INPI
- [ ] 33. (Dono) Termos de uso e política de privacidade (LGPD)
- [ ] 34. (Claude) Guia de operação e lista de ideias da Fase 2
- [ ] 35. (Dono) Piloto com poucos montadores e clientes
- [ ] 36. (Dono) Decidir quando migrar para o plano pago do Supabase
