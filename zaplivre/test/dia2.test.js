// Testes do Dia 2: vídeo, localização, reações, encaminhar, organização da
// lista e mensagens temporárias.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from '../server/index.js';

const silent = { log() {}, error() {}, warn() {} };
const uploadDir = '/tmp/claude-0/zl-dia2-' + process.pid;
let base, ctx;
const contas = {};

before(async () => {
  ctx = createApp({ dbFile: ':memory:', uploadDir, devShowOtp: true, logger: silent, pushSender: async () => {} });
  await new Promise((r) => ctx.server.listen(0, r));
  base = `http://127.0.0.1:${ctx.server.address().port}`;
  contas.ana = await entrar('11955550001', 'Ana', 'ana.souza');
  contas.bia = await entrar('11955550002', 'Bia', 'bia.lima');
  contas.caio = await entrar('11955550003', 'Caio', 'caio.rocha');
});
after(async () => { await ctx.close(); fs.rmSync(uploadDir, { recursive: true, force: true }); });

async function api(path, { method = 'GET', token, body, raw, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(raw ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers },
    body: raw || (body ? JSON.stringify(body) : undefined),
  });
  return { status: res.status, data: await res.json() };
}
async function entrar(phone, name, username) {
  const req = await api('/api/auth/request-code', { method: 'POST', body: { phone } });
  const ver = await api('/api/auth/verify', { method: 'POST', body: { phone, code: req.data.devCode, name, username } });
  assert.equal(ver.status, 200, JSON.stringify(ver.data));
  return ver.data;
}
async function conversa(de, handle) {
  const r = await api('/api/chats/direct', { method: 'POST', token: de.token, body: { handle } });
  assert.ok(r.data.chat?.id, JSON.stringify(r.data));
  return r.data.chat.id;
}
const enviar = (token, chatId, body) => api(`/api/chats/${chatId}/messages`, { method: 'POST', token, body });

test('vídeo: aceito no envio e listado no painel de mídias', async () => {
  const chatId = await conversa(contas.ana, '@bia.lima');

  // Um mp4 mínimo serve: o servidor guarda bytes, não decodifica vídeo.
  const bytes = Buffer.from('00000018667479706d703432', 'hex');
  const up = await fetch(base + '/api/uploads', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + contas.ana.token, 'content-type': 'video/mp4', 'x-file-name': 'ferias.mp4' },
    body: bytes,
  });
  const anexo = await up.json();
  assert.equal(up.status, 201, JSON.stringify(anexo));
  assert.equal(anexo.attachment.kind, 'video');

  const msg = await enviar(contas.ana.token, chatId, { type: 'video', attachmentId: anexo.attachment.id });
  assert.equal(msg.status, 201, JSON.stringify(msg.data));
  assert.equal(msg.data.message.type, 'video');

  const hub = await api(`/api/chats/${chatId}/media`, { token: contas.bia.token });
  assert.equal(hub.data.videos.length, 1);
  assert.equal(hub.data.videos[0].name, 'ferias.mp4');
});

test('localização: guardada como ponto e recusada quando inválida', async () => {
  const chatId = await conversa(contas.ana, '@bia.lima');

  const ok = await enviar(contas.ana.token, chatId, { type: 'location', body: JSON.stringify({ lat: -23.5505, lng: -46.6333, label: 'Praça da Sé' }) });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  const ponto = JSON.parse(ok.data.message.body);
  assert.equal(ponto.lat, -23.5505);
  assert.equal(ponto.label, 'Praça da Sé');

  for (const ruim of [{ lat: 999, lng: 0 }, { lat: 'aqui', lng: 'ali' }, {}]) {
    const r = await enviar(contas.ana.token, chatId, { type: 'location', body: JSON.stringify(ruim) });
    assert.equal(r.status, 400, 'localização inválida deve ser recusada: ' + JSON.stringify(ruim));
  }
});

test('reações: uma por pessoa, repetir desfaz, só emoji entra', async () => {
  const chatId = await conversa(contas.ana, '@bia.lima');
  const msg = (await enviar(contas.ana.token, chatId, { body: 'Deu certo!' })).data.message;

  const r1 = await api(`/api/messages/${msg.id}/react`, { method: 'POST', token: contas.bia.token, body: { emoji: '👍' } });
  assert.equal(r1.status, 200);
  assert.deepEqual(r1.data.message.reactions, [{ emoji: '👍', count: 1, userIds: [contas.bia.user.id] }]);

  // Trocar de emoji substitui, não soma.
  const r2 = await api(`/api/messages/${msg.id}/react`, { method: 'POST', token: contas.bia.token, body: { emoji: '❤️' } });
  assert.equal(r2.data.message.reactions.length, 1);
  assert.equal(r2.data.message.reactions[0].emoji, '❤️');

  // Repetir o mesmo emoji desfaz.
  const r3 = await api(`/api/messages/${msg.id}/react`, { method: 'POST', token: contas.bia.token, body: { emoji: '❤️' } });
  assert.deepEqual(r3.data.message.reactions, []);

  // Duas pessoas, mesmo emoji: conta 2.
  await api(`/api/messages/${msg.id}/react`, { method: 'POST', token: contas.ana.token, body: { emoji: '🔥' } });
  const r4 = await api(`/api/messages/${msg.id}/react`, { method: 'POST', token: contas.bia.token, body: { emoji: '🔥' } });
  assert.equal(r4.data.message.reactions[0].count, 2);

  // Texto não é reação.
  const texto = await api(`/api/messages/${msg.id}/react`, { method: 'POST', token: contas.bia.token, body: { emoji: 'parabens' } });
  assert.equal(texto.data.message.reactions[0].count, 1, 'texto não vira reação, e a reação anterior é desfeita');

  // Quem não participa da conversa não reage.
  // 404, não 403: o servidor não revela que a conversa existe.
  const estranho = await api(`/api/messages/${msg.id}/react`, { method: 'POST', token: contas.caio.token, body: { emoji: '👍' } });
  assert.equal(estranho.status, 404);
});

test('encaminhar: copia para outras conversas e marca a origem', async () => {
  const comBia = await conversa(contas.ana, '@bia.lima');
  const comCaio = await conversa(contas.ana, '@caio.rocha');
  const msg = (await enviar(contas.ana.token, comBia, { body: 'O endereço é rua das Flores, 120' })).data.message;

  const r = await api(`/api/messages/${msg.id}/forward`, { method: 'POST', token: contas.ana.token, body: { chatIds: [comCaio] } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.messages.length, 1);
  assert.equal(r.data.messages[0].body, 'O endereço é rua das Flores, 120');
  assert.equal(r.data.messages[0].forwarded, true);
  assert.equal(r.data.messages[0].chatId, comCaio);

  // A original não vira encaminhada.
  const originais = await api(`/api/chats/${comBia}/messages`, { token: contas.ana.token });
  assert.equal(originais.data.messages.find((m) => m.id === msg.id).forwarded, false);

  // Não dá para encaminhar o que não se pode ver.
  const intruso = await api(`/api/messages/${msg.id}/forward`, { method: 'POST', token: contas.caio.token, body: { chatIds: [comCaio] } });
  assert.equal(intruso.status, 404);

  // Nem para uma conversa de que não se participa.
  const soBia = await conversa(contas.bia, '@caio.rocha');
  const fora = await api(`/api/messages/${msg.id}/forward`, { method: 'POST', token: contas.ana.token, body: { chatIds: [soBia] } });
  assert.equal(fora.status, 404);
});

test('fixar, silenciar e arquivar valem só para quem fez', async () => {
  const chatId = await conversa(contas.ana, '@bia.lima');

  const fixada = await api(`/api/chats/${chatId}/pin`, { method: 'POST', token: contas.ana.token, body: { pinned: true } });
  assert.equal(fixada.data.chat.pinned, true);
  const silenciada = await api(`/api/chats/${chatId}/mute`, { method: 'POST', token: contas.ana.token, body: { hours: -1 } });
  assert.equal(silenciada.data.chat.muted, true);

  // A visão da Bia continua intacta.
  const daBia = await api(`/api/chats/${chatId}`, { token: contas.bia.token });
  assert.equal(daBia.data.chat.pinned, false, 'fixar não pode mexer na lista do outro');
  assert.equal(daBia.data.chat.muted, false, 'silenciar não pode mexer na lista do outro');

  // Fixada vem primeiro na lista.
  await conversa(contas.ana, '@caio.rocha');
  await enviar(contas.ana.token, (await conversa(contas.ana, '@caio.rocha')), { body: 'mais recente' });
  const lista = await api('/api/chats', { token: contas.ana.token });
  assert.equal(lista.data.chats[0].id, chatId, 'a conversa fixada fica no topo mesmo sem ser a mais recente');

  const arquivada = await api(`/api/chats/${chatId}/archive`, { method: 'POST', token: contas.ana.token, body: { archived: true } });
  assert.equal(arquivada.data.chat.archived, true);
  assert.equal((await api(`/api/chats/${chatId}`, { token: contas.bia.token })).data.chat.archived, false);

  // Desligar o silêncio volta ao normal.
  const religada = await api(`/api/chats/${chatId}/mute`, { method: 'POST', token: contas.ana.token, body: { hours: 0 } });
  assert.equal(religada.data.chat.muted, false);
});

test('mensagens temporárias: prazo vale para as novas e some no vencimento', async () => {
  const chatId = await conversa(contas.ana, '@bia.lima');
  const antes = (await enviar(contas.ana.token, chatId, { body: 'esta fica' })).data.message;
  assert.equal(antes.expiresAt, null);

  const lig = await api(`/api/chats/${chatId}/ephemeral`, { method: 'POST', token: contas.ana.token, body: { seconds: 86400 } });
  assert.equal(lig.status, 200, JSON.stringify(lig.data));
  assert.equal(lig.data.chat.ephemeralSeconds, 86400);

  const depois = (await enviar(contas.ana.token, chatId, { body: 'esta some' })).data.message;
  assert.ok(depois.expiresAt > Date.now(), 'mensagem nova nasce com prazo');

  // Prazo fora da lista não é aceito.
  assert.equal((await api(`/api/chats/${chatId}/ephemeral`, { method: 'POST', token: contas.ana.token, body: { seconds: 61 } })).status, 400);

  // Força o vencimento e varre.
  ctx.db.prepare('UPDATE messages SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, depois.id);
  const vencidas = ctx.db.prepare("SELECT COUNT(*) AS n FROM messages WHERE expires_at IS NOT NULL AND expires_at <= ? AND deleted_at IS NULL").get(Date.now()).n;
  assert.equal(vencidas, 1);

  const msgs = await api(`/api/chats/${chatId}/messages`, { token: contas.bia.token });
  assert.equal(msgs.data.messages.find((m) => m.id === antes.id).deleted, false, 'mensagem antiga não é atingida pelo prazo');

  // Desligar volta a mensagem permanente.
  await api(`/api/chats/${chatId}/ephemeral`, { method: 'POST', token: contas.ana.token, body: { seconds: 0 } });
  const permanente = (await enviar(contas.ana.token, chatId, { body: 'de novo permanente' })).data.message;
  assert.equal(permanente.expiresAt, null);
});

test('conversa silenciada não dispara aviso no celular', async () => {
  const avisos = [];
  const local = createApp({
    dbFile: ':memory:',
    uploadDir: uploadDir + '-mudo',
    devShowOtp: true,
    logger: silent,
    pushSender: async (sub, payload) => { avisos.push(JSON.parse(payload)); },
  });
  await new Promise((r) => local.server.listen(0, r));
  const baseAntiga = base;
  base = `http://127.0.0.1:${local.server.address().port}`;
  try {
    const ana = await entrar('11966660001', 'Ana', 'ana.m');
    const bia = await entrar('11966660002', 'Bia', 'bia.m');
    await api('/api/push/subscribe', { method: 'POST', token: bia.token, body: { subscription: { endpoint: 'https://push.example/bia', keys: { p256dh: 'k', auth: 'a' } } } });
    const chatId = await conversa(ana, '@bia.m');

    await enviar(ana.token, chatId, { body: 'com aviso' });
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(avisos.length, 1);

    await api(`/api/chats/${chatId}/mute`, { method: 'POST', token: bia.token, body: { hours: -1 } });
    await enviar(ana.token, chatId, { body: 'sem aviso' });
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(avisos.length, 1, 'conversa silenciada não deve gerar aviso');
  } finally {
    base = baseAntiga;
    await local.close();
    fs.rmSync(uploadDir + '-mudo', { recursive: true, force: true });
  }
});
