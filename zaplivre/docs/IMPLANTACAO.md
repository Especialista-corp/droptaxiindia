# Colocar o ZapLivre no ar

Guia do zero até dez pessoas conversando, escrito para quem não é programador.
Leva cerca de uma hora, quase toda ela esperando o domínio apontar.

## 1. O que você precisa comprar

| O quê | Onde | Quanto |
| --- | --- | --- |
| Um domínio | Registro.br, Hostinger, Namecheap | R$ 40 por ano |
| Um servidor pequeno | Hetzner, DigitalOcean, Contabo, Hostinger VPS | R$ 30 a 60 por mês |

Para o piloto, o menor servidor serve: 2 GB de memória e 40 GB de disco. Peça Ubuntu
24.04. Anote o endereço de IP que o provedor mostrar.

Não é preciso contratar disparo de SMS. O piloto entra por convite.

## 2. Apontar o domínio para o servidor

No painel de quem vendeu o domínio, crie um registro:

```
Tipo: A      Nome: zap      Valor: <o IP do seu servidor>
```

Isso faz `zap.seudominio.com.br` responder pelo servidor. Pode levar de dez minutos a
algumas horas para valer no mundo todo. Confira assim, no seu computador:

```bash
ping zap.seudominio.com.br
```

Quando aparecer o IP do servidor, siga.

## 3. Preparar o servidor

Entre nele pelo terminal (o provedor mostra o comando, algo como
`ssh root@<IP>`) e rode:

```bash
apt update && apt install -y docker.io docker-compose-v2 git
git clone <endereço-do-repositório> zaplivre
cd zaplivre/zaplivre
cp .env.example .env
nano .env
```

No `.env`, preencha só estas três linhas e salve com `Ctrl+O`, `Enter`, `Ctrl+X`:

```
DOMINIO=zap.seudominio.com.br
EMAIL_HTTPS=voce@seudominio.com.br
ACCESS_MODE=invite
```

## 4. Subir

```bash
docker compose up -d
```

O certificado HTTPS é pedido e renovado sozinho. Não há nada para configurar nem para
lembrar de renovar.

## 5. Pegar o código de primeiro acesso

```bash
docker compose logs zaplivre | grep "primeiro acesso"
```

Vai aparecer algo como:

```
Servidor novo. Código do primeiro acesso: PCBWMCQ
```

Abra `https://zap.seudominio.com.br` no celular, digite esse código, escolha seu
`@usuário` e pronto: **essa primeira conta é a sua, e é a que administra o servidor.**

Guarde o código de recuperação que aparece na tela. É como você volta a entrar se sair
do aplicativo ou trocar de celular. Ele aparece uma única vez.

## 6. Convidar as dez pessoas

No aplicativo: menu (os três pontinhos) → **Convites** → escreva para quem é → **Gerar
convite** → **Copiar link**.

Mande o link por WhatsApp mesmo. Quem recebe abre, o código já vem preenchido, digita o
telefone, escolhe o `@usuário` e está dentro.

Peça para **instalarem na tela inicial**. No Android o navegador oferece sozinho; no
iPhone é o botão de compartilhar → *Adicionar à Tela de Início*. **No iPhone isso não é
opcional:** a Apple só entrega aviso de mensagem depois que o aplicativo foi instalado
assim.

Depois de instalado, peça para tocarem em menu → **Ativar notificações**. Sem esse toque,
o aviso não chega com o aplicativo fechado.

## 7. Backup

O `docker compose` já faz um backup por dia e guarda os catorze últimos. Para fazer um na
hora:

```bash
docker compose exec zaplivre node --no-warnings=ExperimentalWarning scripts/backup.js
```

Para restaurar, pare o aplicativo, restaure e suba de novo:

```bash
docker compose stop zaplivre
docker compose run --rm zaplivre node --no-warnings=ExperimentalWarning scripts/restaurar.js /app/data/backups/<pasta>
docker compose start zaplivre
```

Restaurar **não apaga** o que estava no ar: guarda numa pasta `.antes-da-restauracao`
antes de sobrescrever.

**Com `STORAGE_DRIVER=s3`, o backup acima cobre o banco e os arquivos que ainda estão em
disco, mas não o que já foi para o bucket.** Esses arquivos dependem da durabilidade do
próprio serviço. Ligue o versionamento do bucket e, se puder, uma cópia em outra região. O
banco guarda em que destino cada arquivo mora, então restaurar o banco sem o bucket deixa os
arquivos de lá sem abrir.

**Leve os backups para fora do servidor.** Um backup que mora no mesmo disco que o banco
não protege contra o disco morrer. Uma vez por semana, do seu computador:

```bash
scp -r root@<IP>:/var/lib/docker/volumes/zaplivre_dados/_data/backups ./backups-zaplivre
```

## 8. Atualizar

```bash
cd zaplivre && git pull && docker compose up -d --build
```

O banco se atualiza sozinho na subida. Faça um backup antes, por hábito.

## O que dizer para as dez pessoas

Seja honesto, porque é o que constrói confiança num aplicativo de mensagens:

- **Ainda não há criptografia de ponta a ponta.** Quem opera o servidor (você) consegue
  ler as mensagens. Isso está escrito na tela de entrada e vai sair quando a criptografia
  entrar.
- **Ainda não há chamada de voz nem de vídeo.**
- **Não é aplicativo de loja.** Instala pelo navegador. No Android fica quase igual a um
  aplicativo normal; no iPhone tem limitações da Apple.
- **O telefone delas não aparece para ninguém.** Serve só para confirmar quem é.

## Quando der problema

```bash
docker compose ps                  # o que está rodando
docker compose logs -f zaplivre    # o que o aplicativo está dizendo
docker compose logs -f porteiro    # problemas de HTTPS e domínio
docker compose restart zaplivre    # reiniciar só o aplicativo
```

**O site não abre.** Quase sempre é o domínio ainda não apontando. Confira com `ping` e
veja `docker compose logs porteiro`.

**O aviso não chega.** Três causas, nesta ordem: o aplicativo não foi instalado na tela
inicial (obrigatório no iPhone), a pessoa não tocou em *Ativar notificações*, ou está com
o aplicativo aberto na tela — nesse caso o aviso não é enviado de propósito.

**Acabou o disco.** Vídeo ocupa. `docker compose exec zaplivre du -sh /app/data/*` mostra
onde está indo, e apagar backups antigos resolve na hora.
