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
- [ ] 7. (Claude) Configurar o Supabase: ligar a confirmação de e-mail, definir o Site URL e colar o modelo de e-mail em português

## Etapa 2: Servidor (VPS Hostinger + Cloudflare)
- [ ] 8. (Dono) Rodar o diagnóstico na VPS e colar o resultado
- [ ] 9. (Dono) Escolher o domínio e apontá-lo pelo Cloudflare
- [ ] 10. (Claude) Gerar CRON_SECRET e chaves de notificação (VAPID) e montar a configuração
- [ ] 11. (Claude) Preparar Docker Compose com Traefik e HTTPS
- [ ] 12. (Claude) Subir o app e o agendador de tarefas
- [ ] 13. (Claude) Repetir o ciclo completo no endereço real

## Etapa 3: Mapa e notificações
- [ ] 14. (Dono) Criar a chave do Google Maps
- [ ] 15. (Claude) Ligar o mapa ao vivo e testar com dois celulares
- [ ] 16. (Claude) Trocar o mapa claro por mapa escuro
- [ ] 17. (Dono) Criar a conta Resend e configurar o e-mail do domínio
- [ ] 18. (Claude) Testar notificações no celular e por e-mail
- [ ] 19. (Dono) Criar o bot do Telegram pelo @BotFather e me enviar o token
- [ ] 20. (Dono) Criar uma caixa de e-mail só para arquivar cadastros (ex.: cadastros@seu-domínio)

## Etapa 4: Funcionalidades que faltam
- [ ] 21. (Claude) Fluxo de disputas: cliente abre, pagamento congela, admin resolve
- [ ] 22. (Claude) Revisão de documentos pelo admin: abrir comprovante e certidão no painel
- [ ] 23. (Dono) Decidir a verificação de identidade paga (CPF + selfie com prova de vida) com base nos preços levantados
- [ ] 24. (Dono) Pedir cotação de verificação de identidade (Serpro Datavalid, BigDataCorp, Unico, CAF, idwall)
- [ ] 25. (Dono) Decidir: o montador só recebe pedidos depois de verificado e aprovado (hoje a aprovação é automática)
- [ ] 26. (Claude) Exigir CNH ou RG novo (CIN): explicar os modelos aceitos e fotografar só pela câmera do app, sem envio de arquivo
- [ ] 27. (Claude) Leitura automática (OCR) do documento e comparação com o nome e o CPF digitados
- [ ] 28. (Claude) Pontuação de risco por cadastro (CPF, nome x documento, telefone, placa e rosto repetidos)
- [ ] 29. (Claude) Aviso no Telegram ao admin a cada cadastro, com dados, link seguro para as fotos e botões Aprovar e Reprovar
- [ ] 30. (Claude) Área do admin: botão para ligar o Telegram dele ao bot
- [ ] 31. (Claude) E-mail de arquivo ao admin: título com nome, CPF e WhatsApp, dados do cadastro e cópias dos documentos
- [ ] 32. (Claude) Corrigir a lista de itens que o montador vê no pedido
- [ ] 33. (Dono) Contratar o serviço de mensagens para o código (SMS ou WhatsApp)
- [ ] 34. (Claude) Verificação do WhatsApp do montador por código (SMS ou WhatsApp)
- [ ] 35. (Claude) Gerar os ícones PNG para iPhone e Android

## Etapa 5: Qualidade e segurança
- [ ] 36. (Claude) Criar os testes automáticos do fluxo principal
- [ ] 37. (Claude) Revisão de segurança (acesso, ações do servidor, pagamento)
- [ ] 38. (Dono) Testar em iPhone e Android reais
- [ ] 39. (Claude) Limpar a cópia antiga: pasta marketplace do droptaxiindia e a PR #1

## Etapa 6: Pagamentos (Asaas)
- [ ] 40. (Dono) Criar a conta Asaas sandbox e enviar a chave de API
- [ ] 41. (Claude) Testar cobrança Pix real no sandbox e o retorno automático (webhook)
- [ ] 42. (Claude) Implementar o repasse ao montador (subconta e divisão)
- [ ] 43. (Claude) Testar cancelamento e reembolso
- [ ] 44. (Dono) Abrir a conta Asaas de produção (documentos da empresa), cerca de 1 semana antes do piloto

## Etapa 7: Lançamento
- [ ] 45. (Dono) Decidir o nome definitivo e consultar a marca no INPI
- [ ] 46. (Dono) Termos de uso e política de privacidade (LGPD)
- [ ] 47. (Claude) Guia de operação e lista de ideias da Fase 2
- [ ] 48. (Dono) Piloto com poucos montadores e clientes
- [ ] 49. (Dono) Decidir quando migrar para o plano pago do Supabase
