// Plano Cômodos, Etapa 0: fundação do sistema de abas.
//
// O critério de aceite da etapa é conservador de propósito: quem já tinha conta
// abre o aplicativo e vê exatamente as três abas de hoje, com as conversas nos
// mesmos lugares. O resto aqui é a mecânica que as abas futuras vão usar.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from '../server/index.js';
import { openDatabase } from '../server/db.js';
import { createTabService, ARQUIVO, LENTE, isArquivo, isLente } from '../server/tabs.js';

const silent = { log() {}, error() {}, warn() {} };
const uploadDir = '/tmp/claude-0/zl-abas-' + process.pid;
let base, ctx, ana, bia;

before(async () => {
  ctx = createApp({ dbFile: ':memory:', uploadDir, devShowOtp: true, logger: silent, pushSender: async () => {} });
  await new Promise((r) => ctx.server.listen(0, r));
  base = `http://127.0.0.1:${ctx.server.address().port}`;
  ana = await entrar('11944440001', 'Ana', 'ana.t');
  bia = await entrar('11944440002', 'Bia', 'bia.t');
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
async function entrar(phone, name, username) {
  const req = await api('/api/auth/request-code', { method: 'POST', body: { phone } });
  const ver = await api('/api/auth/verify', { method: 'POST', body: { phone, code: req.data.devCode, name, username } });
  assert.equal(ver.status, 200, JSON.stringify(ver.data));
  return ver.data;
}

test('aceite da etapa: as três abas de sempre, na mesma ordem', async () => {
  const r = await api('/api/tabs', { token: ana.token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.tabs.map((t) => t.key), ['social', 'work', 'desk']);
  assert.deepEqual(r.data.tabs.map((t) => t.label), ['Social', 'Trabalho', 'Atendimento']);
  assert.deepEqual(r.data.visiveis, ['social', 'work', 'desk']);
  assert.deepEqual(r.data.extras, [], 'com três abas não existe botão "mais"');
  assert.equal(r.data.maxVisiveis, 4);
  // Todas são abas de arquivo; nenhuma lente foi ligada ainda.
  assert.ok(r.data.tabs.every((t) => t.type === ARQUIVO));
});

test('as conversas continuam nos mesmos lugares', async () => {
  const direta = await api('/api/chats/direct', { method: 'POST', token: ana.token, body: { handle: '@bia.t' } });
  assert.equal(direta.data.chat.tabKey, 'social');
  assert.equal(direta.data.chat.category, 'social', 'o nome antigo do campo continua respondendo');

  const grupo = await api('/api/chats/group', { method: 'POST', token: ana.token, body: { name: 'Obra', category: 'work', memberHandles: ['@bia.t'] } });
  assert.equal(grupo.data.chat.tabKey, 'work');

  // O nome novo também é aceito na criação.
  const porTabKey = await api('/api/chats/group', { method: 'POST', token: ana.token, body: { name: 'Férias', tabKey: 'work', memberHandles: ['@bia.t'] } });
  assert.equal(porTabKey.data.chat.tabKey, 'work');
});

test('cada pessoa guarda a mesma conversa na aba que quiser', async () => {
  const chatId = (await api('/api/chats/direct', { method: 'POST', token: ana.token, body: { handle: '@bia.t' } })).data.chat.id;

  const movida = await api(`/api/chats/${chatId}/tab`, { method: 'PATCH', token: ana.token, body: { tabKey: 'work' } });
  assert.equal(movida.status, 200, JSON.stringify(movida.data));
  assert.equal(movida.data.chat.tabKey, 'work');

  // A Bia não é afetada.
  const daBia = await api(`/api/chats/${chatId}`, { token: bia.token });
  assert.equal(daBia.data.chat.tabKey, 'social', 'mover de aba é escolha de quem move');

  // A rota antiga continua funcionando com o nome antigo do campo.
  const volta = await api(`/api/chats/${chatId}/category`, { method: 'PATCH', token: ana.token, body: { category: 'social' } });
  assert.equal(volta.data.chat.tabKey, 'social');
});

test('conversa só mora em aba de arquivo, e Atendimento é só de empresa', async () => {
  const chatId = (await api('/api/chats/direct', { method: 'POST', token: ana.token, body: { handle: '@bia.t' } })).data.chat.id;
  assert.equal((await api(`/api/chats/${chatId}/tab`, { method: 'PATCH', token: ana.token, body: { tabKey: 'desk' } })).status, 400);
  assert.equal((await api(`/api/chats/${chatId}/tab`, { method: 'PATCH', token: ana.token, body: { tabKey: 'nao-existe' } })).status, 400);
});

test('abas fixas não desligam', async () => {
  const r = await api('/api/tabs/social', { method: 'POST', token: ana.token, body: { enabled: false } });
  assert.equal(r.status, 400, 'sem Social as conversas ficariam sem endereço');
  const depois = await api('/api/tabs', { token: ana.token });
  assert.deepEqual(depois.data.tabs.map((t) => t.key), ['social', 'work', 'desk']);
});

test('arquivo contra lente: a distinção que organiza o resto', () => {
  assert.equal(isArquivo('social'), true);
  assert.equal(isLente('social'), false);
  assert.equal(isArquivo('nao-existe'), false);
});

test('barra adaptativa: no máximo quatro na tela, o resto atrás do "mais"', () => {
  // O catálogo de verdade ainda tem três abas. Para exercitar o limite antes de
  // existir uma quarta, o serviço aceita um catálogo injetado.
  const db = openDatabase(':memory:');
  db.prepare('INSERT INTO users (id, phone, username, name, created_at) VALUES (?, ?, ?, ?, ?)').run('u1', '+5511', 'ana', 'Ana', Date.now());
  const catalogo = [
    { key: 'social', label: 'Social', type: ARQUIVO, padrao: true, fixa: true },
    { key: 'work', label: 'Trabalho', type: ARQUIVO, padrao: true, fixa: true },
    { key: 'desk', label: 'Atendimento', type: ARQUIVO, padrao: true, fixa: true },
    { key: 'dinheiro', label: 'Dinheiro', type: LENTE, padrao: false },
    { key: 'passageiras', label: 'Passageiras', type: ARQUIVO, padrao: false },
    { key: 'cofre', label: 'Cofre', type: ARQUIVO, padrao: false },
  ];
  const tabs = createTabService(db, { logger: silent, catalog: catalogo });

  const inicial = tabs.listFor('u1');
  assert.deepEqual(inicial.tabs.map((t) => t.key), ['social', 'work', 'desk'], 'nada ligado por padrão além das três');
  assert.deepEqual(inicial.disponiveis.map((t) => t.key), ['dinheiro', 'passageiras', 'cofre']);

  tabs.setEnabled('u1', 'dinheiro', true);
  const quatro = tabs.listFor('u1');
  assert.equal(quatro.visiveis.length, 4);
  assert.deepEqual(quatro.extras, [], 'quatro ainda cabem na tela');

  tabs.setEnabled('u1', 'cofre', true);
  const cinco = tabs.listFor('u1');
  assert.equal(cinco.tabs.length, 5);
  assert.deepEqual(cinco.visiveis, ['social', 'work', 'desk', 'dinheiro']);
  assert.deepEqual(cinco.extras, ['cofre'], 'a quinta vai para o botão "mais"');

  // Reordenar muda quem aparece na tela.
  tabs.reorder('u1', ['cofre', 'social', 'work', 'desk', 'dinheiro']);
  const reordenada = tabs.listFor('u1');
  assert.deepEqual(reordenada.visiveis, ['cofre', 'social', 'work', 'desk']);
  assert.deepEqual(reordenada.extras, ['dinheiro']);

  // Desligar devolve a aba ao catálogo do que dá para ligar.
  tabs.setEnabled('u1', 'cofre', false);
  const semCofre = tabs.listFor('u1');
  assert.ok(!semCofre.tabs.some((t) => t.key === 'cofre'));
  assert.ok(semCofre.disponiveis.some((t) => t.key === 'cofre'));

  // A lente aparece na barra, mas não é endereço de conversa nenhuma.
  assert.equal(semCofre.tabs.find((t) => t.key === 'dinheiro').type, LENTE);
  db.close();
});

test('banco da versão anterior migra sem mudar nada de lugar', () => {
  // Reproduz o formato antigo: coluna `category` no chat e na participação.
  const arquivo = '/tmp/claude-0/zl-abas-antigo-' + process.pid + '.db';
  fs.rmSync(arquivo, { force: true });
  const antigo = openDatabase(arquivo);
  const t = Date.now();
  antigo.prepare('INSERT INTO users (id, phone, username, name, created_at) VALUES (?, ?, ?, ?, ?)').run('u1', '+551', 'ana', 'Ana', t);
  antigo.prepare('INSERT INTO chats (id, type, tab_key, created_at) VALUES (?, ?, ?, ?)').run('c1', 'direct', 'social', t);
  antigo.prepare('INSERT INTO chat_members (chat_id, user_id, joined_at, tab_key) VALUES (?, ?, ?, ?)').run('c1', 'u1', t, 'work');
  antigo.close();

  // Reabrir não pode mexer em nada.
  const db = openDatabase(arquivo);
  assert.equal(db.prepare('SELECT tab_key FROM chats WHERE id = ?').get('c1').tab_key, 'social');
  assert.equal(db.prepare('SELECT tab_key FROM chat_members WHERE chat_id = ?').get('c1').tab_key, 'work');
  const tabs = createTabService(db, { logger: silent });
  assert.deepEqual(tabs.listFor('u1').tabs.map((t2) => t2.key), ['social', 'work', 'desk']);
  db.close();
  fs.rmSync(arquivo, { force: true });
});
