// Testes do que o piloto precisa: aviso com o aplicativo fechado, entrada por
// convite e busca de mensagens.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from '../server/index.js';

const silent = { log() {}, error() {}, warn() {} };
const uploadDir = '/tmp/claude-0/zl-piloto-' + process.pid;

// Guarda os avisos em vez de sair para a internet.
const pushes = [];
const pushSender = async (subscription, payload) => { pushes.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) }); };

let base, ctx;

before(async () => {
  ctx = createApp({ dbFile: ':memory:', uploadDir, accessMode: 'invite', logger: silent, pushSender });
  await new Promise((r) => ctx.server.listen(0, r));
  base = `http://127.0.0.1:${ctx.server.address().port}`;
});
after(async () => { await ctx.close(); fs.rmSync(uploadDir, { recursive: true, force: true }); });

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

function fakeSubscription(id) {
  return { endpoint: 'https://push.example/' + id, keys: { p256dh: 'chave-' + id, auth: 'auth-' + id } };
}

test('modo convite: sem convite ninguém entra; com convite entra e recebe código de recuperação', async (t) => {
  const cfg = await api('/api/config');
  assert.equal(cfg.data.inviteRequired, true);
  assert.ok(cfg.data.pushPublicKey.length > 20, 'servidor precisa expor a chave de notificação');

  // Sem convite: barrado.
  const semConvite = await api('/api/auth/request-code', { method: 'POST', body: { phone: '11911110000' } });
  assert.equal(semConvite.status, 403);

  // Convite inventado: barrado.
  const inventado = await api('/api/auth/request-code', { method: 'POST', body: { phone: '11911110000', invite: 'ZZZZZZZ' } });
  assert.equal(inventado.status, 403);

  // A primeira conta do servidor é a de quem administra, e ela não precisa de
  // convite para existir — senão ninguém poderia emitir o primeiro.
  t.diagnostic('primeira conta = administrador');
  const dono = await criarPrimeiraConta();
  assert.equal(dono.user.isAdmin, true);
  assert.ok(dono.recoveryCode, 'conta nova precisa receber código de recuperação');

  // O dono emite um convite.
  const criado = await api('/api/invites', { method: 'POST', token: dono.token, body: { note: 'minha mãe', maxUses: 1 } });
  assert.equal(criado.status, 201);
  const code = criado.data.invite.code;
  assert.equal(code.length, 7);

  // Quem tem o convite entra.
  const pedido = await api('/api/auth/request-code', { method: 'POST', body: { phone: '11922220000', invite: code } });
  assert.equal(pedido.status, 200, JSON.stringify(pedido.data));
  assert.equal(pedido.data.mode, 'invite');
  const mae = await api('/api/auth/verify', { method: 'POST', body: { phone: '11922220000', code, name: 'Mãe', username: 'mae.silva' } });
  assert.equal(mae.status, 200, JSON.stringify(mae.data));
  assert.equal(mae.data.user.isAdmin, false, 'convidado não pode virar administrador');
  assert.ok(mae.data.recoveryCode);
  sessoes.set('mae', mae.data);

  // O mesmo convite não serve duas vezes.
  const reuso = await api('/api/auth/request-code', { method: 'POST', body: { phone: '11933330000', invite: code } });
  assert.equal(reuso.status, 403);

  // Quem já tem conta volta com o código de recuperação, não com convite.
  const volta = await api('/api/auth/request-code', { method: 'POST', body: { phone: '11922220000' } });
  assert.equal(volta.status, 200);
  assert.equal(volta.data.needs, 'recovery');
  const errado = await api('/api/auth/verify', { method: 'POST', body: { phone: '11922220000', code: 'ABCDEFG-ABCDEFG' } });
  assert.equal(errado.status, 400);
  const certo = await api('/api/auth/verify', { method: 'POST', body: { phone: '11922220000', code: mae.data.recoveryCode } });
  assert.equal(certo.status, 200);
  assert.equal(certo.data.user.username, 'mae.silva');

  // Só quem administra emite convite.
  const tentativa = await api('/api/invites', { method: 'POST', token: mae.data.token, body: {} });
  assert.equal(tentativa.status, 403);
});

test('aviso com o aplicativo fechado: quem não está com a tela aberta recebe push', async () => {
  const dono = contaExistente('dono');
  const mae = contaExistente('mae');

  // Os dois aparelhos se inscrevem.
  assert.equal((await api('/api/push/subscribe', { method: 'POST', token: mae.token, body: { subscription: fakeSubscription('mae') } })).status, 200);
  assert.equal((await api('/api/push/subscribe', { method: 'POST', token: dono.token, body: { subscription: fakeSubscription('dono') } })).status, 200);

  const chat = await api('/api/chats/direct', { method: 'POST', token: dono.token, body: { handle: '@mae.silva' } });
  assert.ok(chat.data.chat.id);

  pushes.length = 0;
  const env = await api(`/api/chats/${chat.data.chat.id}/messages`, { method: 'POST', token: dono.token, body: { body: 'O boleto da luz venceu hoje' } });
  assert.equal(env.status, 201);
  await new Promise((r) => setTimeout(r, 60));

  // A mãe recebe; quem mandou, não.
  assert.equal(pushes.length, 1, 'exatamente um aviso, para quem recebeu a mensagem');
  assert.equal(pushes[0].endpoint, 'https://push.example/mae');
  assert.equal(pushes[0].payload.body, 'O boleto da luz venceu hoje');
  assert.equal(pushes[0].payload.chatId, chat.data.chat.id);
  assert.ok(pushes[0].payload.title.includes('Dono') || pushes[0].payload.title.length > 0);
});

test('busca encontra mensagem antiga e não vaza conversa de terceiros', async () => {
  const dono = contaExistente('dono');
  const mae = contaExistente('mae');
  const chat = await api('/api/chats/direct', { method: 'POST', token: dono.token, body: { handle: '@mae.silva' } });
  const chatId = chat.data.chat.id;

  for (const texto of ['bom dia', 'mandei o comprovante do aluguel ontem', 'depois a gente combina', 'churrasco no sábado']) {
    await api(`/api/chats/${chatId}/messages`, { method: 'POST', token: dono.token, body: { body: texto } });
  }

  // Acha pelo meio da frase, sem acento e sem diferenciar maiúsculas.
  const r = await api('/api/search?q=' + encodeURIComponent('COMPROVANTE'), { token: mae.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.results.length, 1);
  assert.equal(r.data.results[0].chatId, chatId);
  assert.match(r.data.results[0].snippet, /\[?comprovante\]?/i);

  // Busca por prefixo (quem digita só o começo).
  const pref = await api('/api/search?q=' + encodeURIComponent('churr'), { token: mae.token });
  assert.equal(pref.data.results.length, 1);

  // Acento não atrapalha: "sabado" acha "sábado".
  const semAcento = await api('/api/search?q=' + encodeURIComponent('sabado'), { token: dono.token });
  assert.equal(semAcento.data.results.length, 1);

  // Quem não participa da conversa não acha nada.
  const convite = await api('/api/invites', { method: 'POST', token: dono.token, body: { maxUses: 1 } });
  const estranho = await api('/api/auth/verify', {
    method: 'POST',
    body: { phone: '11944440000', code: convite.data.invite.code, name: 'Estranho', username: 'estranho.jose' },
  });
  assert.equal(estranho.status, 200, JSON.stringify(estranho.data));
  const vazou = await api('/api/search?q=comprovante', { token: estranho.data.token });
  assert.equal(vazou.data.results.length, 0, 'busca não pode mostrar conversa de quem não participa');

  // Mensagem apagada sai da busca.
  const msgs = await api(`/api/chats/${chatId}/messages`, { token: dono.token });
  const alvo = msgs.data.messages.find((m) => m.body.includes('comprovante'));
  await api('/api/messages/' + alvo.id, { method: 'DELETE', token: dono.token });
  const depois = await api('/api/search?q=comprovante', { token: dono.token });
  assert.equal(depois.data.results.length, 0, 'mensagem apagada não pode continuar na busca');

  // Busca vazia ou curta demais não devolve o mundo inteiro.
  assert.equal((await api('/api/search?q=a', { token: dono.token })).data.results.length, 0);
  assert.equal((await api('/api/search?q=', { token: dono.token })).data.results.length, 0);
  // Sintaxe do FTS digitada por engano não derruba o servidor.
  assert.equal((await api('/api/search?q=' + encodeURIComponent('"NEAR((a b)'), { token: dono.token })).status, 200);
});

// --- apoio ---
// Contas criadas no primeiro teste e reaproveitadas nos seguintes.
const sessoes = new Map();

async function criarPrimeiraConta() {
  if (sessoes.has('dono')) return sessoes.get('dono');
  // Usa o convite de primeiro acesso que o servidor imprimiu ao subir vazio.
  const r = await api('/api/auth/verify', {
    method: 'POST',
    body: { phone: '11911110000', code: ctx.bootstrapInvite.code, name: 'Dono', username: 'dono.jack' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  sessoes.set('dono', r.data);
  return r.data;
}
const contaExistente = (quem) => sessoes.get(quem);
