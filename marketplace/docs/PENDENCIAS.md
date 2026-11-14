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
- [ ] 20. (Dono) Criar o número oficial de WhatsApp da empresa (WhatsApp Business Platform da Meta)
- [ ] 21. (Dono) Criar uma caixa de e-mail só para arquivar cadastros (ex.: cadastros@seu-domínio)

## Etapa 4: Funcionalidades que faltam
- [ ] 22. (Claude) Fluxo de disputas: cliente abre, pagamento congela, admin resolve
- [ ] 23. (Claude) Revisão de documentos pelo admin: abrir comprovante e certidão no painel
- [ ] 24. (Dono) Decidir a verificação de identidade paga (CPF + selfie com prova de vida) com base nos preços levantados
- [ ] 25. (Dono) Pedir cotação de verificação de identidade (Serpro Datavalid, BigDataCorp, Unico, CAF, idwall)
- [ ] 26. (Claude) Mudar a aprovação: cadastro verde é aprovado sozinho; amarelo e vermelho esperam o admin; só aprovado recebe pedidos
- [ ] 27. (Claude) Exigir CNH ou RG novo (CIN): explicar os modelos aceitos e fotografar só pela câmera do app, sem envio de arquivo
- [ ] 28. (Claude) Leitura automática (OCR) do documento e comparação com o nome e o CPF digitados
- [ ] 29. (Claude) Pontuação de risco por cadastro (CPF, nome x documento, telefone, placa e rosto repetidos)
- [ ] 30. (Claude) Aviso no Telegram ao admin a cada cadastro, com dados, link seguro para as fotos e botões Aprovar e Reprovar
- [ ] 31. (Claude) Área do admin: botão para ligar o Telegram dele ao bot
- [ ] 32. (Claude) Reprovação com motivos em botões e mensagem automática ao montador explicando o que corrigir
- [ ] 33. (Claude) Lembrete de cadastro parado há mais de 24 horas e resumo diário ao admin
- [ ] 34. (Claude) Guia na câmera: moldura, aviso de reflexo, borrão e pouca luz, e selfie segurando o documento
- [ ] 35. (Claude) Avisar antes de a CNH e a certidão vencerem e reverificar uma vez por ano
- [ ] 36. (Claude) Vários admins no grupo do Telegram, com registro de quem aprovou e quando
- [ ] 37. (Claude) Botão "Confirmar pelo WhatsApp": a mensagem recebida no número oficial confirma o número de quem enviou
- [ ] 38. (Dono) Decidir se aceitamos a CNH digital, validada pelo QR code
- [ ] 39. (Claude) E-mail de arquivo ao admin: título com nome, CPF e WhatsApp, dados do cadastro e cópias dos documentos
- [ ] 40. (Claude) Corrigir a lista de itens que o montador vê no pedido
- [ ] 41. (Dono) Contratar o serviço de mensagens para o código (SMS ou WhatsApp)
- [ ] 42. (Claude) Verificação do WhatsApp do montador por código (SMS ou WhatsApp)
- [ ] 43. (Claude) Gerar os ícones PNG para iPhone e Android

## Etapa 5: Qualidade e segurança
- [ ] 44. (Claude) Criar os testes automáticos do fluxo principal
- [ ] 45. (Claude) Revisão de segurança (acesso, ações do servidor, pagamento)
- [ ] 46. (Dono) Testar em iPhone e Android reais
- [ ] 47. (Claude) Limpar a cópia antiga: pasta marketplace do droptaxiindia e a PR #1

## Etapa 6: Pagamentos (Asaas)
- [ ] 48. (Dono) Criar a conta Asaas sandbox e enviar a chave de API
- [ ] 49. (Claude) Testar cobrança Pix real no sandbox e o retorno automático (webhook)
- [ ] 50. (Claude) Implementar o repasse ao montador (subconta e divisão)
- [ ] 51. (Claude) Testar cancelamento e reembolso
- [ ] 52. (Dono) Abrir a conta Asaas de produção (documentos da empresa), cerca de 1 semana antes do piloto

## Etapa 7: Lançamento
- [ ] 53. (Dono) Decidir o nome definitivo e consultar a marca no INPI
- [ ] 54. (Dono) Termos de uso e política de privacidade (LGPD)
- [ ] 55. (Claude) Guia de operação e lista de ideias da Fase 2
- [ ] 56. (Dono) Piloto com poucos montadores e clientes
- [ ] 57. (Dono) Decidir quando migrar para o plano pago do Supabase
