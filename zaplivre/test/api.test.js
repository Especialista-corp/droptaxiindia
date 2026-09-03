import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../server/index.js';

let base, ctx, hook, hookUrl;
const received = [];
const silent = { log() {}, error() {}, warn() {} };
const uploadDir = '/tmp/claude-0/zl-test-uploads-' + process.pid;
const fakeDns = { resolveTxt: async (host) => (host === '_zaplivre.padaria.com.br' ? [[ctx.dnsToken]] : []) };
const fakeTranscriber = async () => ({ text: 'Oi, tudo bem? Queria saber se o pão francês sai às seis da manhã. Também quero encomendar dois bolos para sábado. Obrigado!' });

before(async () => {
  ctx = createApp({ dbFile: ':memory:', uploadDir, devShowOtp: true, logger: silent, dnsResolver: fakeDns, transcriber: fakeTranscriber, billingSecret: 'segredo' });
  await new Promise((r) => ctx.server.listen(0, r));
  base = `http://127.0.0.1:${ctx.server.address().port}`;
  // Servidor que simula o robô (n8n) recebendo webhooks.
  hook = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => { received.push({ headers: req.headers, body: JSON.parse(body) }); res.writeHead(200); res.end('ok'); });
  });
  await new Promise((r) => hook.listen(0, r));
  hookUrl = `http://127.0.0.1:${hook.address().port}/webhook`;
});
after(async () => { await ctx.close(); hook.close(); fs.rmSync(uploadDir, { recursive: true, force: true }); });

async function api(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
async function login(phone, name, username) {
  const req = await api('/api/auth/request-code', { method: 'POST', body: { phone } });
  assert.equal(req.status, 200);
  const ver = await api('/api/auth/verify', { method: 'POST', body: { phone, code: req.data.devCode, name, username } });
  assert.equal(ver.status, 200, JSON.stringify(ver.data));
  return ver.data;
}
const waitFor = async (fn, ms = 3000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 30)); } };

test('cadastro com @usuário, telefone privado e busca por handle', async () => {
  const taken = await api('/api/auth/username-available?u=admin');
  assert.equal(taken.data.ok, false);
  const req = await api('/api/auth/request-code', { method: 'POST', body: { phone: '(11) 99999-0001' } });
  assert.equal(req.data.phone, '+5511999990001');
  const bad = await api('/api/auth/verify', { method: 'POST', body: { phone: '11999990001', code: req.data.devCode, name: 'Ana', username: 'a' } });
  assert.equal(bad.status, 400);
  const ok = await api('/api/auth/verify', { method: 'POST', body: { phone: '11999990001', code: req.data.devCode, name: 'Ana', username: '@Ana.Souza' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.handle, '@ana.souza');
  assert.equal(ok.data.user.phone, '+5511999990001');
  const dup = await login('11999990009', 'Outra', 'ana.souza').catch((e) => e);
  assert.ok(dup instanceof Error, 'username duplicado deve falhar');

  const bia = await login('11988880002', 'Bia', 'bia');
  const found = await api('/api/users/lookup?handle=@ana.souza', { token: bia.token });
  assert.equal(found.data.user.name, 'Ana');
  assert.equal(found.data.user.phone, undefined, 'telefone nunca aparece para terceiros');
  const byPhone = await api('/api/users/lookup?phone=11999990001', { token: bia.token });
  assert.equal(byPhone.status, 200);
  await api('/api/me', { method: 'PATCH', token: ok.data.token, body: { discoverableByPhone: false } });
  const hidden = await api('/api/users/lookup?phone=11999990001', { token: bia.token });
  assert.equal(hidden.status, 404, 'quem desativou a descoberta não é achado pelo telefone');
});

test('conversa direta, abas e recibos de leitura', async () => {
  const ana = await login('11977770001', 'Ana', 'ana2');
  const bia = await login('11977770002', 'Bia', 'bia2');
  const chat = await api('/api/chats/direct', { method: 'POST', token: ana.token, body: { handle: 'bia2' } });
  assert.equal(chat.status, 201);
  assert.equal(chat.data.chat.category, 'social');
  const chatId = chat.data.chat.id;
  const sent = await api(`/api/chats/${chatId}/messages`, { method: 'POST', token: ana.token, body: { body: 'Oi, Bia!' } });
  assert.equal(sent.data.message.status, 'sent');
  const biaChats = await api('/api/chats', { token: bia.token });
  assert.equal(biaChats.data.chats[0].unread, 1);
  await api(`/api/chats/${chatId}/read`, { method: 'POST', token: bia.token });
  const msgs = await api(`/api/chats/${chatId}/messages`, { token: ana.token });
  assert.equal(msgs.data.messages[0].status, 'read');

  // Bia move a conversa para a aba Trabalho só para ela.
  const moved = await api(`/api/chats/${chatId}/category`, { method: 'PATCH', token: bia.token, body: { category: 'work' } });
  assert.equal(moved.data.chat.category, 'work');
  const anaView = await api(`/api/chats/${chatId}`, { token: ana.token });
  assert.equal(anaView.data.chat.category, 'social');

  // Bloqueio impede envio.
  await api(`/api/users/${ana.user.id}/block`, { method: 'POST', token: bia.token });
  const blocked = await api(`/api/chats/${chatId}/messages`, { method: 'POST', token: ana.token, body: { body: 'oi?' } });
  assert.equal(blocked.status, 403);
});

test('grupos de trabalho', async () => {
  const dan = await login('21977770001', 'Dani', 'dani');
  const edu = await login('21977770002', 'Edu', 'edu');
  const g = await api('/api/chats/group', { method: 'POST', token: dan.token, body: { name: 'Projeto X', category: 'work', memberHandles: ['@edu'] } });
  assert.equal(g.status, 201);
  assert.equal(g.data.chat.category, 'work');
  assert.equal(g.data.chat.members.length, 2);
  const left = await api(`/api/chats/${g.data.chat.id}/leave`, { method: 'POST', token: dan.token });
  assert.equal(left.status, 200);
  const view = await api(`/api/chats/${g.data.chat.id}`, { token: edu.token });
  assert.ok(view.data.chat.members.some((m) => m.role === 'admin'));
});

test('empresa: domínio, verificação DNS, agentes, API, webhook, robô e humano, Kanban', async () => {
  const dono = await login('31966660001', 'Joana', 'joana');
  const agente = await login('31966660002', 'Rafa', 'rafa');
  const cliente = await login('31966660003', 'Carlos', 'carlos');

  const ws = await api('/api/workspaces', { method: 'POST', token: dono.token, body: { domain: 'Padaria.com.br', name: 'Padaria Central' } });
  assert.equal(ws.status, 201);
  assert.equal(ws.data.workspace.handle, '@padaria.com.br');
  assert.equal(ws.data.workspace.plan, 'trial');
  const wid = ws.data.workspace.id;
  ctx.dnsToken = ws.data.workspace.dnsRecord.value;
  const verified = await api(`/api/workspaces/${wid}/verify`, { method: 'POST', token: dono.token });
  assert.equal(verified.data.verified, true);

  const withAgent = await api(`/api/workspaces/${wid}/agents`, { method: 'POST', token: dono.token, body: { handle: '@rafa' } });
  assert.equal(withAgent.data.workspace.members.length, 2);
  const key = await api(`/api/workspaces/${wid}/api-key`, { method: 'POST', token: dono.token });
  assert.match(key.data.apiKey, /^zl_live_/);
  const wh = await api(`/api/workspaces/${wid}/webhook`, { method: 'PUT', token: dono.token, body: { url: hookUrl } });
  assert.ok(wh.data.webhookSecret);

  // Empresa não inicia conversa (antispam): só a pessoa abre.
  const forbidden = await api('/api/chats/direct', { method: 'POST', token: dono.token, body: { handle: '@carlos' } });
  assert.equal(forbidden.status, 201, 'dono é pessoa e pode abrir chat social');
  const desk = await api('/api/chats/direct', { method: 'POST', token: cliente.token, body: { handle: '@padaria.com.br' } });
  assert.equal(desk.status, 201);
  assert.equal(desk.data.chat.category, 'desk');
  const chatId = desk.data.chat.id;
  await waitFor(() => received.some((r) => r.body.event === 'conversation.opened'));

  await api(`/api/chats/${chatId}/messages`, { method: 'POST', token: cliente.token, body: { body: 'Vocês têm bolo de cenoura?' } });
  await waitFor(() => received.some((r) => r.body.event === 'message.received'));
  const evt = received.find((r) => r.body.event === 'message.received');
  assert.equal(evt.body.data.message.text, 'Vocês têm bolo de cenoura?');
  assert.ok(evt.headers['x-zaplivre-signature']);

  // Robô responde pela API pública.
  const apiHeaders = { 'x-api-key': key.data.apiKey };
  const convs = await api('/api/v1/conversations?status=open', { headers: apiHeaders });
  assert.equal(convs.data.conversations.length, 1);
  const reply = await api(`/api/v1/conversations/${chatId}/messages`, { method: 'POST', headers: apiHeaders, body: { text: 'Temos sim! R$ 35.' } });
  assert.equal(reply.status, 201);
  const clienteMsgs = await api(`/api/chats/${chatId}/messages`, { token: cliente.token });
  assert.equal(clienteMsgs.data.messages.at(-1).body, 'Temos sim! R$ 35.');
  assert.equal(clienteMsgs.data.messages.at(-1).agentId, null);

  // Agente humano assume: robô pausa e webhook não é mais disparado.
  const before = received.length;
  const took = await api(`/api/chats/${chatId}/takeover`, { method: 'POST', token: agente.token });
  assert.equal(took.data.chat.ticket.botPaused, true);
  assert.equal(took.data.chat.ticket.status, 'in_progress');
  await waitFor(() => received.some((r) => r.body.event === 'conversation.handoff'));
  await api(`/api/chats/${chatId}/messages`, { method: 'POST', token: cliente.token, body: { body: 'Quero dois.' } });
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(!received.slice(before).some((r) => r.body.event === 'message.received'), 'robô pausado não recebe mensagens');
  const human = await api(`/api/chats/${chatId}/messages`, { method: 'POST', token: agente.token, body: { body: 'Anotado, Carlos!' } });
  assert.equal(human.data.message.agentName, 'Rafa');

  // Kanban.
  await api(`/api/chats/${chatId}/ticket`, { method: 'PATCH', token: agente.token, body: { status: 'done', tags: ['encomenda'] } });
  const board = await api(`/api/workspaces/${wid}/board`, { token: dono.token });
  assert.equal(board.data.board.done.length, 1);
  assert.deepEqual(board.data.board.done[0].ticket.tags, ['encomenda']);
  const noAccess = await api(`/api/workspaces/${wid}/board`, { token: cliente.token });
  assert.equal(noAccess.status, 404);

  // Chave inválida.
  const bad = await api('/api/v1/me', { headers: { 'x-api-key': 'zl_live_errada' } });
  assert.equal(bad.status, 401);

  // Cobrança: webhook do provedor ativa o plano.
  const sub = await api(`/api/workspaces/${wid}/subscribe`, { method: 'POST', token: dono.token, body: { plan: 'pro' } });
  assert.equal(sub.data.reference, `${wid}:pro`);
  const paid = await api('/api/billing/webhook', { method: 'POST', headers: { 'x-billing-secret': 'segredo' }, body: { reference: sub.data.reference, months: 1, provider: 'asaas' } });
  assert.equal(paid.status, 200);
  assert.equal(paid.data.workspace.plan, 'pro');
  const unauth = await api('/api/billing/webhook', { method: 'POST', headers: { 'x-billing-secret': 'x' }, body: {} });
  assert.equal(unauth.status, 401);
});

test('arquivos, painel de mídias e transcrição de áudio', async () => {
  const gil = await login('41955550001', 'Gil', 'gil');
  const lia = await login('41955550002', 'Lia', 'lia');
  const chat = await api('/api/chats/direct', { method: 'POST', token: gil.token, body: { handle: 'lia' } });
  const chatId = chat.data.chat.id;

  const up = await fetch(base + '/api/uploads', { method: 'POST', headers: { authorization: 'Bearer ' + gil.token, 'content-type': 'audio/webm', 'x-file-name': 'audio.webm', 'x-duration': '12' }, body: Buffer.from('fake-audio') });
  assert.equal(up.status, 201);
  const { attachment } = await up.json();
  assert.equal(attachment.kind, 'audio');
  const msg = await api(`/api/chats/${chatId}/messages`, { method: 'POST', token: gil.token, body: { type: 'audio', attachmentId: attachment.id } });
  assert.equal(msg.status, 201);
  assert.equal(msg.data.message.attachment.duration, 12);

  const file = await fetch(base + attachment.url);
  assert.equal(file.status, 200);
  assert.equal(await file.text(), 'fake-audio');
  const wrongKey = await fetch(base + attachment.url.slice(0, -2) + 'xx');
  assert.equal(wrongKey.status, 404);

  const doc = await fetch(base + '/api/uploads', { method: 'POST', headers: { authorization: 'Bearer ' + lia.token, 'content-type': 'application/pdf', 'x-file-name': 'comprovante-pix.pdf' }, body: Buffer.from('%PDF') });
  const { attachment: pdf } = await doc.json();
  assert.equal(pdf.category, 'comprovante');
  await api(`/api/chats/${chatId}/messages`, { method: 'POST', token: lia.token, body: { type: 'document', attachmentId: pdf.id } });
  await api(`/api/chats/${chatId}/messages`, { method: 'POST', token: lia.token, body: { body: 'Olha o site https://exemplo.com.br/promo' } });

  const hub = await api(`/api/chats/${chatId}/media`, { token: gil.token });
  assert.equal(hub.data.audios.length, 1);
  assert.equal(hub.data.documents.length, 1);
  assert.equal(hub.data.links[0].url, 'https://exemplo.com.br/promo');
  const tagged = await api(`/api/attachments/${pdf.id}`, { method: 'PATCH', token: gil.token, body: { tags: ['Fornecedor'] } });
  assert.deepEqual(tagged.data.attachment.tags, ['fornecedor']);

  const tr = await api(`/api/attachments/${attachment.id}/transcribe`, { method: 'POST', token: lia.token });
  assert.equal(tr.status, 200);
  assert.match(tr.data.attachment.transcript, /pão francês/);
  assert.match(tr.data.attachment.summary, /^• /);

  const stranger = await login('41955550003', 'Zé', 'zeca');
  const denied = await api(`/api/chats/${chatId}/media`, { token: stranger.token });
  assert.equal(denied.status, 404);
});

test('tempo real: mensagem via socket chega ao outro participante', async () => {
  const gil = await login('51966660001', 'Gil', 'gil2');
  const hel = await login('51966660002', 'Helena', 'helena');
  const chat = await api('/api/chats/direct', { method: 'POST', token: gil.token, body: { handle: 'helena' } });
  const connect = (token) => new Promise((resolve, reject) => {
    const s = ioClient(base, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
  const sGil = await connect(gil.token);
  const sHel = await connect(hel.token);
  const got = new Promise((r) => sHel.on('message:new', (d) => r(d.message)));
  const ack = await new Promise((r) => sGil.emit('message:send', { chatId: chat.data.chat.id, body: 'via socket', clientId: 'c1' }, r));
  assert.equal(ack.ok, true);
  assert.equal((await got).body, 'via socket');
  const unauthorized = ioClient(base, { auth: { token: 'invalido' }, transports: ['websocket'] });
  const err = await new Promise((r) => unauthorized.on('connect_error', r));
  assert.equal(err.message, 'unauthorized');
  sGil.close(); sHel.close(); unauthorized.close();
});
