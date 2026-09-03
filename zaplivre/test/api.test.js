import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../server/index.js';

let base, ctx;
const silent = { log() {}, error() {} };

before(async () => {
  ctx = createApp({ dbFile: ':memory:', devShowOtp: true, logger: silent });
  await new Promise((r) => ctx.server.listen(0, r));
  base = `http://127.0.0.1:${ctx.server.address().port}`;
});
after(() => ctx.close());

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function login(phone, name) {
  const req = await api('/api/auth/request-code', { method: 'POST', body: { phone } });
  assert.equal(req.status, 200);
  const ver = await api('/api/auth/verify', { method: 'POST', body: { phone, code: req.data.devCode, name } });
  assert.equal(ver.status, 200);
  return ver.data;
}

test('login por telefone normaliza para +55 e rejeita código errado', async () => {
  const req = await api('/api/auth/request-code', { method: 'POST', body: { phone: '(11) 99999-0001' } });
  assert.equal(req.data.phone, '+5511999990001');
  const bad = await api('/api/auth/verify', { method: 'POST', body: { phone: '11999990001', code: '000000' } });
  assert.equal(bad.status, 400);
  const ok = await api('/api/auth/verify', { method: 'POST', body: { phone: '11999990001', code: req.data.devCode, name: 'Ana' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.name, 'Ana');
  assert.equal(ok.data.isNew, true);
  const me = await api('/api/me', { token: ok.data.token });
  assert.equal(me.data.user.phone, '+5511999990001');
});

test('conversa direta, mensagens e recibos de leitura', async () => {
  const ana = await login('11988880001', 'Ana');
  const bia = await login('11988880002', 'Bia');

  const notFound = await api('/api/chats/direct', { method: 'POST', token: ana.token, body: { phone: '11900000000' } });
  assert.equal(notFound.status, 404);

  const chat = await api('/api/chats/direct', { method: 'POST', token: ana.token, body: { phone: '11988880002' } });
  assert.equal(chat.status, 201);
  assert.equal(chat.data.chat.type, 'direct');
  assert.equal(chat.data.chat.name, 'Bia');
  const chatId = chat.data.chat.id;

  const again = await api('/api/chats/direct', { method: 'POST', token: bia.token, body: { phone: '+5511988880001' } });
  assert.equal(again.status, 200);
  assert.equal(again.data.chat.id, chatId);

  const sent = await api(`/api/chats/${chatId}/messages`, { method: 'POST', token: ana.token, body: { body: 'Oi, Bia!' } });
  assert.equal(sent.status, 201);
  assert.equal(sent.data.message.status, 'sent');

  const biaChats = await api('/api/chats', { token: bia.token });
  assert.equal(biaChats.data.chats[0].unread, 1);
  assert.equal(biaChats.data.chats[0].lastMessage.body, 'Oi, Bia!');

  await api(`/api/chats/${chatId}/read`, { method: 'POST', token: bia.token });
  const msgs = await api(`/api/chats/${chatId}/messages`, { token: ana.token });
  assert.equal(msgs.data.messages.length, 1);
  assert.equal(msgs.data.messages[0].status, 'read');

  const stranger = await login('11988880003', 'Carlos');
  const denied = await api(`/api/chats/${chatId}/messages`, { token: stranger.token });
  assert.equal(denied.status, 404);
});

test('grupos: criação, participantes e saída', async () => {
  const dan = await login('21977770001', 'Dani');
  const edu = await login('21977770002', 'Edu');
  await login('21977770003', 'Flávia');

  const g = await api('/api/chats/group', { method: 'POST', token: dan.token, body: { name: 'Família', memberPhones: ['21977770002'] } });
  assert.equal(g.status, 201);
  assert.equal(g.data.chat.members.length, 2);
  assert.equal(g.data.chat.role, 'admin');

  const forbidden = await api(`/api/chats/${g.data.chat.id}/members`, { method: 'POST', token: edu.token, body: { phone: '21977770003' } });
  assert.equal(forbidden.status, 403);

  const added = await api(`/api/chats/${g.data.chat.id}/members`, { method: 'POST', token: dan.token, body: { phone: '21977770003' } });
  assert.equal(added.data.chat.members.length, 3);

  const left = await api(`/api/chats/${g.data.chat.id}/leave`, { method: 'POST', token: dan.token });
  assert.equal(left.status, 200);
  const view = await api(`/api/chats/${g.data.chat.id}`, { token: edu.token });
  assert.equal(view.data.chat.members.length, 2);
  assert.ok(view.data.chat.members.some((m) => m.role === 'admin'), 'grupo deve manter um admin');
  const sys = await api(`/api/chats/${g.data.chat.id}/messages`, { token: edu.token });
  assert.ok(sys.data.messages.some((m) => m.type === 'system' && m.body.includes('saiu do grupo')));
});

test('tempo real: mensagem via socket chega ao outro participante', async () => {
  const gil = await login('31966660001', 'Gil');
  const hel = await login('31966660002', 'Helena');
  const chat = await api('/api/chats/direct', { method: 'POST', token: gil.token, body: { phone: '31966660002' } });

  const connect = (token) =>
    new Promise((resolve, reject) => {
      const s = ioClient(base, { auth: { token }, transports: ['websocket'] });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
  const sGil = await connect(gil.token);
  const sHel = await connect(hel.token);

  const received = new Promise((r) => sHel.on('message:new', (d) => r(d.message)));
  const ack = await new Promise((r) => sGil.emit('message:send', { chatId: chat.data.chat.id, body: 'via socket', clientId: 'c1' }, r));
  assert.equal(ack.ok, true);
  assert.equal(ack.clientId, 'c1');
  const msg = await received;
  assert.equal(msg.body, 'via socket');

  const unauthorized = ioClient(base, { auth: { token: 'invalido' }, transports: ['websocket'] });
  const err = await new Promise((r) => unauthorized.on('connect_error', r));
  assert.equal(err.message, 'unauthorized');

  sGil.close();
  sHel.close();
  unauthorized.close();
});

test('perfil e sincronização de contatos', async () => {
  const ivo = await login('41955550001', 'Ivo');
  await login('41955550002', 'Joana');
  const upd = await api('/api/me', { method: 'PATCH', token: ivo.token, body: { name: 'Ivo Silva', about: 'Disponível' } });
  assert.equal(upd.data.user.name, 'Ivo Silva');
  const sync = await api('/api/contacts/sync', { method: 'POST', token: ivo.token, body: { phones: ['41 95555-0002', '41955559999'] } });
  assert.equal(sync.data.users.length, 1);
  assert.equal(sync.data.users[0].name, 'Joana');
});
