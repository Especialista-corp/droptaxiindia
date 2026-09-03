// ZapLivre - cliente web (PWA). Sem frameworks, só JavaScript moderno.
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  token: localStorage.getItem('zl_token'),
  me: null,
  blocked: new Set(),
  chats: new Map(),
  messages: new Map(),
  activeChatId: null,
  tab: localStorage.getItem('zl_tab') || 'social',
  online: new Set(),
  typing: new Map(),
  replyTo: null,
  socket: null,
  installPrompt: null,
  contacts: [],
  workspaces: [],
  currentWorkspace: null,
  mediaFilter: 'all',
  recorder: null,
};
const TAB_LABEL = { social: 'Social', work: 'Trabalho', desk: 'Atendimento' };
const STATUS_LABEL = { open: 'Em aberto', in_progress: 'Em atendimento', done: 'Concluído' };

// ---------- utilitários ----------
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(state.token ? { authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (res.status === 401 && state.token) doLogout(false);
  if (!res.ok) throw new Error(data.error || 'Erro de rede.');
  return data;
}
async function upload(blob, name, extra = {}) {
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + state.token, 'content-type': blob.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(name), ...extra },
    body: blob,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Falha no envio do arquivo.');
  return data.attachment;
}

let toastTimer;
function toast(text, ms = 3000) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function fmtDay(ts) {
  const d = new Date(ts), today = new Date();
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return d.toLocaleDateString('pt-BR', { weekday: 'long' });
  return d.toLocaleDateString('pt-BR');
}
function fmtListTime(ts) {
  const d = new Date(ts), today = new Date();
  return d.toDateString() === today.toDateString() ? fmtTime(ts) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function fmtLastSeen(ts) {
  if (!ts) return '';
  const d = new Date(ts), day = fmtDay(ts);
  return `visto por último ${day === 'Hoje' ? 'hoje' : day === 'Ontem' ? 'ontem' : 'em ' + d.toLocaleDateString('pt-BR')} às ${fmtTime(ts)}`;
}
function fmtPhone(p) {
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(p || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p || '';
}
const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const fmtDur = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;

function avatarFor(entity) {
  if (entity?.avatar) return entity.avatar;
  const name = entity?.name || '?';
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('');
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue} 45% 55%)"/><text x="32" y="40" font-family="Arial" font-size="26" fill="#fff" text-anchor="middle">${initials || '?'}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const linkify = (text) => escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

function resizeImage(file, max = 1280, quality = 0.82, asBlob = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      if (asBlob) canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
      else resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = url;
  });
}

// ---------- autenticação ----------
function showAuth() { $('#auth').classList.remove('hidden'); $('#app').classList.add('hidden'); }
function showApp() { $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden'); }

$('#form-phone').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  $('#auth-error').textContent = '';
  try {
    const { phone, devCode, isNew } = await api('/auth/request-code', { method: 'POST', body: { phone: $('#phone').value } });
    $('#code-phone').textContent = fmtPhone(phone);
    $('#form-phone').classList.add('hidden');
    $('#form-code').classList.remove('hidden');
    $('#new-user-fields').classList.toggle('hidden', !isNew);
    if (devCode) {
      $('#code').value = devCode;
      $('#code-hint').innerHTML = `<b>Modo de desenvolvimento:</b> seu código é <b>${devCode}</b> (já preenchido).`;
    }
    (isNew ? $('#username') : $('#code')).focus();
  } catch (err) {
    $('#auth-error').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});
let usernameTimer;
$('#username').addEventListener('input', () => {
  clearTimeout(usernameTimer);
  const u = $('#username').value.trim();
  if (!u) return;
  usernameTimer = setTimeout(async () => {
    const r = await api('/auth/username-available?u=' + encodeURIComponent(u));
    $('#username-hint').textContent = r.ok ? `@${r.username} está disponível!` : r.reason;
    $('#username-hint').style.color = r.ok ? 'var(--green)' : 'var(--danger)';
  }, 300);
});
$('#form-code').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#auth-error').textContent = '';
  try {
    const { token, user } = await api('/auth/verify', {
      method: 'POST',
      body: { phone: $('#phone').value, code: $('#code').value, name: $('#name').value, username: $('#username').value },
    });
    state.token = token;
    localStorage.setItem('zl_token', token);
    state.me = user;
    await boot();
  } catch (err) {
    $('#auth-error').textContent = err.message;
  }
});
$('#btn-back').addEventListener('click', () => { $('#form-code').classList.add('hidden'); $('#form-phone').classList.remove('hidden'); });

async function doLogout(callServer = true) {
  try { if (callServer) await api('/auth/logout', { method: 'POST' }); } catch { /* ignora */ }
  localStorage.removeItem('zl_token');
  state.token = null;
  state.socket?.disconnect();
  location.reload();
}
$('#btn-logout').addEventListener('click', () => doLogout());
$('#menu-logout').addEventListener('click', () => doLogout());

// ---------- inicialização ----------
async function boot() {
  if (!state.token) return showAuth();
  try {
    const { user, blocked } = await api('/me');
    state.me = user;
    state.blocked = new Set(blocked || []);
  } catch {
    return showAuth();
  }
  showApp();
  renderMe();
  await Promise.all([loadChats(), loadWorkspaces()]);
  connectSocket();
  setTab(state.tab, false);
  // Link de convite: /@usuario abre a conversa direto.
  const m = /^\/@([a-z0-9._-]+)$/i.exec(location.pathname);
  if (m) { history.replaceState(null, '', '/'); startDirect({ handle: m[1] }); }
  else {
    const saved = localStorage.getItem('zl_active');
    if (saved && state.chats.has(saved) && window.innerWidth > 760) openChat(saved);
  }
  if ('contacts' in navigator && 'select' in navigator.contacts) $('#btn-pick-contacts').classList.remove('hidden');
}

function renderMe() {
  $('#me-avatar').src = avatarFor(state.me);
  $('#profile-avatar').src = avatarFor(state.me);
  $('#profile-handle').textContent = state.me.handle || '';
  $('#profile-name').value = state.me.name;
  $('#profile-about').value = state.me.about || '';
  $('#profile-phone').textContent = fmtPhone(state.me.phone);
  $('#profile-discoverable').checked = Boolean(state.me.discoverableByPhone);
}
async function loadChats() {
  const { chats } = await api('/chats');
  state.chats = new Map(chats.map((c) => [c.id, c]));
  renderChatList();
}
async function loadWorkspaces() {
  try { state.workspaces = (await api('/workspaces')).workspaces; } catch { state.workspaces = []; }
}
async function refreshChat(chatId) {
  try {
    const { chat } = await api('/chats/' + chatId);
    const prev = state.chats.get(chatId);
    state.chats.set(chatId, { ...chat, unread: prev?.unread ?? chat.unread });
    renderChatList();
    if (state.activeChatId === chatId) renderChatHeader();
  } catch { /* pode ter saído */ }
}

// ---------- socket ----------
function connectSocket() {
  const socket = io({ auth: { token: state.token } });
  state.socket = socket;
  socket.on('connect', () => socket.emit('presence:who', (ids) => { state.online = new Set(ids); renderChatHeader(); }));
  socket.on('connect_error', (err) => { if (err.message === 'unauthorized') doLogout(false); });

  socket.on('message:new', ({ message, clientId }) => {
    upsertMessage(clientId ? { ...message, clientId } : message);
    const chat = state.chats.get(message.chatId);
    if (!chat) { refreshChat(message.chatId); return; }
    chat.lastMessage = message;
    const mine = isMine(chat, message);
    const isActive = state.activeChatId === message.chatId && document.visibilityState === 'visible';
    if (!mine && message.type !== 'system') {
      if (isActive) socket.emit('chat:read', { chatId: message.chatId });
      else { chat.unread = (chat.unread || 0) + 1; notify(chat, message); }
    }
    renderChatList();
  });
  socket.on('message:deleted', ({ message }) => {
    upsertMessage(message);
    const chat = state.chats.get(message.chatId);
    if (chat?.lastMessage?.id === message.id) { chat.lastMessage = message; renderChatList(); }
  });
  socket.on('message:delivered', ({ chatId, messageIds }) => {
    const chat = state.chats.get(chatId);
    for (const m of state.messages.get(chatId) || []) if (messageIds.includes(m.id) && m.status === 'sent' && chat?.type === 'direct') m.status = 'delivered';
    if (chat?.lastMessage && messageIds.includes(chat.lastMessage.id) && chat.lastMessage.status === 'sent' && chat.type === 'direct') { chat.lastMessage.status = 'delivered'; renderChatList(); }
    if (state.activeChatId === chatId) renderMessages(false);
  });
  socket.on('chat:read', ({ chatId, userId }) => {
    const chat = state.chats.get(chatId);
    if (!chat || userId === selfId(chat)) return;
    if (chat.type === 'direct') {
      for (const m of state.messages.get(chatId) || []) if (isMine(chat, m)) m.status = 'read';
      if (chat.lastMessage && isMine(chat, chat.lastMessage)) { chat.lastMessage.status = 'read'; renderChatList(); }
      if (state.activeChatId === chatId) renderMessages(false);
    } else if (state.activeChatId === chatId) loadMessages(chatId, { silent: true });
  });
  socket.on('chat:new', ({ chatId }) => refreshChat(chatId));
  socket.on('chat:updated', ({ chatId }) => refreshChat(chatId));
  socket.on('workspace:updated', () => { loadWorkspaces(); loadChats(); });
  socket.on('attachment:updated', ({ attachment }) => {
    for (const m of state.messages.get(attachment.chatId) || []) if (m.attachment?.id === attachment.id) m.attachment = attachment;
    if (state.activeChatId === attachment.chatId) renderMessages(false);
  });
  socket.on('user:updated', ({ user }) => {
    for (const chat of state.chats.values()) {
      for (const m of chat.members) if (m.id === user.id) Object.assign(m, user);
      if (chat.type === 'direct' && chat.peer?.id === user.id) { Object.assign(chat.peer, user); chat.name = user.name; chat.avatar = user.avatar; }
    }
    renderChatList(); renderChatHeader();
  });
  socket.on('presence', ({ userId, online, lastSeen }) => {
    if (online) state.online.add(userId); else state.online.delete(userId);
    for (const chat of state.chats.values()) {
      for (const m of chat.members) if (m.id === userId && lastSeen) m.lastSeen = lastSeen;
      if (chat.peer?.id === userId && lastSeen) chat.peer.lastSeen = lastSeen;
    }
    renderChatHeader();
  });
  socket.on('typing', ({ chatId, userId, name, typing }) => {
    const map = state.typing.get(chatId) || new Map();
    if (typing) map.set(userId, name); else map.delete(userId);
    state.typing.set(chatId, map);
    renderChatHeader(); renderChatList();
  });
}

// Quem sou eu nesta conversa: eu mesmo, ou a empresa pela qual atendo.
const selfId = (chat) => chat?.actingAs || state.me.id;
const isMine = (chat, m) => m.senderId === selfId(chat);

// ---------- abas e lista ----------
function setTab(tab, save = true) {
  state.tab = tab;
  if (save) localStorage.setItem('zl_tab', tab);
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $('#search').placeholder = tab === 'desk' ? 'Pesquisar atendimentos' : 'Pesquisar ou começar uma nova conversa';
  renderChatList();
}
$('#tabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) setTab(t.dataset.tab); });

function sortedChats() {
  const q = $('#search').value.trim().toLowerCase();
  return [...state.chats.values()]
    .filter((c) => c.category === state.tab)
    .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.lastMessage?.body || '').toLowerCase().includes(q))
    .sort((a, b) => (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt));
}
function memberName(chat, userId) {
  if (userId === selfId(chat)) return chat?.actingAs ? chat.name === chat.peer?.name ? chat.business?.name || 'Empresa' : 'Você' : 'Você';
  return chat?.members.find((m) => m.id === userId)?.name || 'Participante';
}
function previewText(chat) {
  if (state.typing.get(chat.id)?.size) return `<span style="color:var(--green)">digitando...</span>`;
  const m = chat.lastMessage;
  if (!m) return '';
  const who = chat.type === 'group' && m.senderId && m.type !== 'system' ? escapeHtml(memberName(chat, m.senderId)) + ': ' : '';
  if (m.deleted) return who + '<i>Mensagem apagada</i>';
  const ticks = isMine(chat, m) && chat.type === 'direct' ? ticksHtml(m) + ' ' : '';
  if (m.type === 'image') return ticks + who + '📷 Foto';
  if (m.type === 'audio') return ticks + who + '🎤 Áudio';
  if (m.type === 'document') return ticks + who + '📄 ' + escapeHtml(m.attachment?.name || 'Documento');
  return ticks + who + escapeHtml(m.body);
}
function renderChatList() {
  const list = $('#chat-list');
  const chats = sortedChats();
  $('#empty-list').classList.toggle('hidden', chats.length > 0);
  $('#empty-text').textContent = state.tab === 'desk' ? 'Nenhum atendimento ainda. Procure uma empresa pelo @dominio dela.' : state.tab === 'work' ? 'Nenhuma conversa de trabalho. Crie um grupo de Trabalho ou mova uma conversa para cá.' : 'Nenhuma conversa ainda.';
  list.innerHTML = chats.map((c) => `
      <button class="chat-item ${c.id === state.activeChatId ? 'active' : ''} ${c.unread ? 'unread' : ''}" data-id="${c.id}" role="listitem">
        <img class="avatar" src="${avatarFor(c)}" alt="">
        <div class="body">
          <div class="top"><span class="name">${escapeHtml(c.name)}${c.viaWorkspace ? `<span class="kind">via ${escapeHtml(c.business?.name || '')}</span>` : ''}${c.ticket && c.viaWorkspace ? `<span class="ticket-tag">${STATUS_LABEL[c.ticket.status]}</span>` : ''}</span><span class="time">${c.lastMessage ? fmtListTime(c.lastMessage.createdAt) : ''}</span></div>
          <div class="bottom"><span class="preview">${previewText(c)}</span>${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</div>
        </div>
      </button>`).join('');
  const totals = { social: 0, work: 0, desk: 0 };
  for (const c of state.chats.values()) totals[c.category] = (totals[c.category] || 0) + (c.unread || 0);
  $$('.tab').forEach((t) => { const b = t.querySelector('.tab-badge'); const n = totals[t.dataset.tab]; b.textContent = n; b.classList.toggle('hidden', !n); });
  const total = totals.social + totals.work + totals.desk;
  document.title = total ? `(${total}) ZapLivre` : 'ZapLivre';
  if (navigator.setAppBadge) (total ? navigator.setAppBadge(total) : navigator.clearAppBadge()).catch(() => {});
}
$('#chat-list').addEventListener('click', (e) => { const item = e.target.closest('.chat-item'); if (item) openChat(item.dataset.id); });
$('#search').addEventListener('input', renderChatList);

// ---------- conversa aberta ----------
async function openChat(chatId) {
  const chat = state.chats.get(chatId);
  if (!chat) return;
  if (chat.category !== state.tab) setTab(chat.category);
  state.activeChatId = chatId;
  state.replyTo = null;
  $('#reply-preview').classList.add('hidden');
  localStorage.setItem('zl_active', chatId);
  $('#app').classList.add('show-chat');
  $('#chat-placeholder').classList.add('hidden');
  $('#chat-view').classList.remove('hidden');
  $('#media-hub').classList.add('hidden');
  closePanels();
  renderChatHeader();
  renderChatList();
  await loadMessages(chatId);
  markRead(chatId);
  if (window.innerWidth > 760) $('#message-input').focus();
}
function markRead(chatId) {
  const chat = state.chats.get(chatId);
  if (!chat) return;
  if (chat.unread) { chat.unread = 0; renderChatList(); }
  state.socket?.emit('chat:read', { chatId });
}
function renderChatHeader() {
  const chat = state.chats.get(state.activeChatId);
  if (!chat) return;
  $('#chat-name').textContent = chat.name;
  $('#chat-avatar').src = avatarFor(chat);
  const typing = state.typing.get(chat.id);
  let status = '';
  if (typing?.size) status = chat.type === 'group' ? `${[...typing.values()][0]} está digitando...` : 'digitando...';
  else if (chat.type === 'direct' && chat.peer?.kind === 'business') status = `Atendimento oficial · ${chat.peer.handle}`;
  else if (chat.type === 'direct') status = state.online.has(chat.peer?.id) ? 'online' : fmtLastSeen(chat.peer?.lastSeen);
  else status = chat.members.map((m) => (m.id === state.me.id ? 'Você' : m.name)).join(', ');
  $('#chat-status').textContent = status;

  const agent = Boolean(chat.viaWorkspace && chat.ticket);
  $('#desk-controls').classList.toggle('hidden', !agent);
  if (agent) {
    $('#ticket-status').value = chat.ticket.status;
    $('#btn-takeover').classList.toggle('hidden', chat.ticket.botPaused && chat.ticket.assigneeId === state.me.id);
    $('#btn-takeover').textContent = chat.ticket.assigneeId && chat.ticket.assigneeId !== state.me.id ? 'Assumir para mim' : 'Assumir';
    $('#btn-resume-bot').classList.toggle('hidden', !chat.ticket.botPaused);
  }
  const banner = $('#bot-banner');
  if (chat.ticket) {
    const assignee = chat.ticket.assigneeId ? chat.members.find((m) => m.id === chat.ticket.assigneeId)?.name || state.workspaces.flatMap((w) => w.members).find((m) => m.id === chat.ticket.assigneeId)?.name : null;
    banner.textContent = chat.ticket.botPaused ? `Atendimento humano${assignee ? ' com ' + assignee : ''}` : agent ? 'O assistente automático está respondendo. Clique em "Assumir" para atender.' : 'Você pode ser atendido por um assistente automático. Peça um atendente a qualquer momento.';
    banner.classList.remove('hidden');
  } else banner.classList.add('hidden');
}
$('#ticket-status').addEventListener('change', async (e) => {
  try { await api(`/chats/${state.activeChatId}/ticket`, { method: 'PATCH', body: { status: e.target.value } }); } catch (err) { toast(err.message); }
});
$('#btn-takeover').addEventListener('click', async () => {
  try { await api(`/chats/${state.activeChatId}/takeover`, { method: 'POST' }); toast('Você assumiu o atendimento.'); } catch (err) { toast(err.message); }
});
$('#btn-resume-bot').addEventListener('click', async () => {
  try { await api(`/chats/${state.activeChatId}/resume-bot`, { method: 'POST' }); } catch (err) { toast(err.message); }
});

async function loadMessages(chatId, { silent = false } = {}) {
  try {
    const { messages } = await api(`/chats/${chatId}/messages?limit=100`);
    state.messages.set(chatId, messages);
    if (state.activeChatId === chatId) renderMessages(!silent);
  } catch (err) { if (!silent) toast(err.message); }
}
async function loadOlder() {
  const chatId = state.activeChatId;
  const list = state.messages.get(chatId) || [];
  if (!list.length) return;
  const el = $('#messages');
  const prevHeight = el.scrollHeight;
  const { messages } = await api(`/chats/${chatId}/messages?limit=100&before=${list[0].createdAt}`);
  if (!messages.length) { el.dataset.end = '1'; return; }
  state.messages.set(chatId, [...messages, ...list]);
  renderMessages(false);
  el.scrollTop = el.scrollHeight - prevHeight;
}
$('#messages').addEventListener('scroll', (e) => {
  if (e.target.scrollTop < 40 && !e.target.dataset.end && !e.target.dataset.loading) {
    e.target.dataset.loading = '1';
    loadOlder().finally(() => delete e.target.dataset.loading);
  }
});
function upsertMessage(message) {
  const list = state.messages.get(message.chatId);
  if (!list) return;
  const idx = list.findIndex((m) => m.id === message.id || (message.clientId && m.clientId === message.clientId));
  if (idx >= 0) list[idx] = { ...list[idx], ...message }; else list.push(message);
  if (state.activeChatId === message.chatId) renderMessages();
}
function ticksHtml(m) {
  if (m.status === 'read') return '<span class="ticks read">✓✓</span>';
  if (m.status === 'delivered') return '<span class="ticks">✓✓</span>';
  if (m.status === 'pending') return '<span class="ticks">🕓</span>';
  return '<span class="ticks">✓</span>';
}
function attachmentHtml(m) {
  const a = m.attachment;
  if (m.type === 'image') return `<img src="${a ? a.url : m.body}" alt="Foto" loading="lazy" data-full="1">`;
  if (m.type === 'audio') {
    return `<div class="audio-msg"><audio controls preload="none" src="${a.url}"></audio>
      ${a.transcript ? `<div class="transcript">${a.summary ? `<b>Resumo</b>${escapeHtml(a.summary)}\n` : ''}<b>Transcrição</b>${escapeHtml(a.transcript)}</div>` : `<button class="transcribe" data-act="transcribe" data-att="${a.id}">Transcrever e resumir</button>`}</div>`;
  }
  if (m.type === 'document') return `<a class="doc-msg" href="${a.url}" target="_blank" rel="noopener"><span class="doc-icon">📄</span><span><span class="doc-name">${escapeHtml(a.name)}</span><span class="doc-meta">${fmtSize(a.size)}${a.category ? ' · ' + a.category : ''}</span></span></a>`;
  return '';
}
function renderMessages(scrollToEnd = true) {
  const chat = state.chats.get(state.activeChatId);
  const list = state.messages.get(state.activeChatId) || [];
  const el = $('#messages');
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  const byId = new Map(list.map((m) => [m.id, m]));
  let html = '', lastDay = '', lastSender = null;
  for (const m of list) {
    const day = fmtDay(m.createdAt);
    if (day !== lastDay) { html += `<div class="day">${day}</div>`; lastDay = day; lastSender = null; }
    if (m.type === 'system') { html += `<div class="msg system"><div class="bubble">${escapeHtml(m.body)}</div></div>`; lastSender = null; continue; }
    const out = isMine(chat, m);
    const first = lastSender !== m.senderId;
    lastSender = m.senderId;
    let inner = '';
    if (chat?.type === 'group' && !out && first) inner += `<span class="sender">${escapeHtml(memberName(chat, m.senderId))}</span>`;
    if (m.agentName && chat?.category === 'desk') inner += `<span class="agent">${out ? 'Atendente' : 'Atendente'}: ${escapeHtml(m.agentName)}</span>`;
    if (m.replyTo) {
      const p = byId.get(m.replyTo);
      inner += `<div class="quote"><b>${escapeHtml(p ? memberName(chat, p.senderId) : '')}</b>${p ? (p.type === 'text' ? escapeHtml(p.body).slice(0, 120) : '📎 Anexo') : 'Mensagem indisponível'}</div>`;
    }
    if (m.deleted) inner += `<span class="deleted">🚫 Mensagem apagada</span>`;
    else if (m.type === 'text') inner += linkify(m.body);
    else { inner += attachmentHtml(m); if (m.body) inner += `<div>${linkify(m.body)}</div>`; }
    inner += `<span class="meta">${fmtTime(m.createdAt)}${out && chat?.type === 'direct' ? ticksHtml(m) : ''}</span>`;
    const actions = m.deleted ? '' : `<div class="actions"><button data-act="reply" data-id="${m.id}" title="Responder">↩</button>${out ? `<button data-act="delete" data-id="${m.id}" title="Apagar">🗑</button>` : ''}</div>`;
    html += `<div class="msg ${out ? 'out' : 'in'} ${first ? 'first' : ''}" data-id="${m.id}"><div class="bubble">${inner}</div>${actions}</div>`;
  }
  el.innerHTML = html;
  if (scrollToEnd || atBottom) el.scrollTop = el.scrollHeight;
}
$('#messages').addEventListener('click', async (e) => {
  const img = e.target.closest('img[data-full]');
  if (img) { $('#lightbox img').src = img.src; $('#lightbox').classList.remove('hidden'); return; }
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'transcribe') {
    btn.disabled = true; btn.textContent = 'Transcrevendo...';
    try { await api(`/attachments/${btn.dataset.att}/transcribe`, { method: 'POST' }); }
    catch (err) { toast(err.message); btn.disabled = false; btn.textContent = 'Transcrever e resumir'; }
    return;
  }
  const m = (state.messages.get(state.activeChatId) || []).find((x) => x.id === btn.dataset.id);
  if (!m) return;
  if (btn.dataset.act === 'reply') {
    state.replyTo = m;
    $('#reply-name').textContent = memberName(state.chats.get(state.activeChatId), m.senderId);
    $('#reply-text').textContent = m.type === 'text' ? m.body.slice(0, 120) : '📎 Anexo';
    $('#reply-preview').classList.remove('hidden');
    $('#message-input').focus();
  } else if (btn.dataset.act === 'delete') {
    if (!confirm('Apagar esta mensagem para todos?')) return;
    try { await api('/messages/' + m.id, { method: 'DELETE' }); } catch (err) { toast(err.message); }
  }
});
$('#lightbox').addEventListener('click', () => $('#lightbox').classList.add('hidden'));
$('#btn-cancel-reply').addEventListener('click', () => { state.replyTo = null; $('#reply-preview').classList.add('hidden'); });

// ---------- envio ----------
function sendMessage(payload) {
  const chatId = state.activeChatId;
  const chat = state.chats.get(chatId);
  const clientId = crypto.randomUUID();
  const optimistic = { id: 'tmp-' + clientId, clientId, chatId, senderId: selfId(chat), createdAt: Date.now(), status: 'pending', replyTo: state.replyTo?.id || null, ...payload };
  const list = state.messages.get(chatId) || [];
  list.push(optimistic);
  state.messages.set(chatId, list);
  renderMessages();
  state.socket.emit('message:send', { chatId, clientId, replyTo: state.replyTo?.id || null, ...payload }, (ack) => {
    const idx = list.findIndex((m) => m.clientId === clientId);
    if (ack?.ok) {
      if (idx >= 0) list[idx] = { ...ack.message, clientId };
      if (chat) chat.lastMessage = ack.message;
    } else {
      toast(ack?.error || 'Não foi possível enviar.');
      if (idx >= 0) list.splice(idx, 1);
    }
    renderMessages(false); renderChatList();
  });
  state.replyTo = null;
  $('#reply-preview').classList.add('hidden');
}
$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#message-input');
  const body = input.value.trim();
  if (!body || !state.activeChatId) return;
  input.value = '';
  sendTyping(false);
  sendMessage({ type: 'text', body });
});
let typingTimer, typingSent = false;
function sendTyping(typing) {
  if (typing === typingSent) return;
  typingSent = typing;
  state.socket?.emit('typing', { chatId: state.activeChatId, typing });
}
$('#message-input').addEventListener('input', () => { sendTyping(true); clearTimeout(typingTimer); typingTimer = setTimeout(() => sendTyping(false), 2500); });

$('#file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !state.activeChatId) return;
  try {
    toast('Enviando...');
    let attachment;
    if (file.type.startsWith('image/')) {
      const blob = await resizeImage(file, 1600, 0.85, true);
      attachment = await upload(blob, file.name.replace(/\.[^.]+$/, '') + '.jpg');
    } else attachment = await upload(file, file.name);
    sendMessage({ type: attachment.kind, attachmentId: attachment.id, attachment });
  } catch (err) { toast(err.message); }
});

// Gravação de áudio (MediaRecorder).
let recChunks = [], recTimer, recStart;
$('#btn-mic').addEventListener('click', async () => {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Seu navegador não suporta gravação de áudio.');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recChunks = [];
    rec.ondataavailable = (ev) => recChunks.push(ev.data);
    rec.start(250);
    state.recorder = rec;
    recStart = Date.now();
    $('#composer').classList.add('hidden');
    $('#recording').classList.remove('hidden');
    recTimer = setInterval(() => ($('#rec-time').textContent = fmtDur((Date.now() - recStart) / 1000)), 500);
  } catch { toast('Permita o uso do microfone para gravar.'); }
});
function stopRecording() {
  const rec = state.recorder;
  if (!rec) return Promise.resolve(null);
  clearInterval(recTimer);
  $('#composer').classList.remove('hidden');
  $('#recording').classList.add('hidden');
  return new Promise((resolve) => {
    rec.onstop = () => { rec.stream.getTracks().forEach((t) => t.stop()); state.recorder = null; resolve(new Blob(recChunks, { type: rec.mimeType || 'audio/webm' })); };
    rec.stop();
  });
}
$('#btn-rec-cancel').addEventListener('click', () => stopRecording());
$('#btn-rec-send').addEventListener('click', async () => {
  const duration = Math.round((Date.now() - recStart) / 1000);
  const blob = await stopRecording();
  if (!blob || !blob.size) return;
  try {
    const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
    const attachment = await upload(new Blob([blob], { type: blob.type.split(';')[0] }), `audio-${Date.now()}.${ext}`, { 'x-duration': String(duration) });
    sendMessage({ type: 'audio', attachmentId: attachment.id, attachment });
  } catch (err) { toast(err.message); }
});

// ---------- painéis ----------
function openPanel(id) { closePanels(); $(id).classList.remove('hidden'); }
function closePanels() { $$('.panel').forEach((p) => p.classList.add('hidden')); $('#menu').classList.add('hidden'); }
$$('.back-panel').forEach((b) => b.addEventListener('click', closePanels));
$('#btn-back-list').addEventListener('click', () => { $('#app').classList.remove('show-chat'); state.activeChatId = null; renderChatList(); });
$('#btn-new-chat').addEventListener('click', () => { openPanel('#panel-new-chat'); loadContacts(); });
$('#btn-empty-new').addEventListener('click', () => { openPanel('#panel-new-chat'); loadContacts(); });
$('#btn-new-group').addEventListener('click', () => openPanel('#panel-new-group'));
$('#btn-profile').addEventListener('click', () => openPanel('#panel-profile'));
$('#menu-profile').addEventListener('click', () => openPanel('#panel-profile'));
$('#menu-workspaces').addEventListener('click', () => openWorkspaces());
$('#btn-menu').addEventListener('click', (e) => { e.stopPropagation(); $('#menu').classList.toggle('hidden'); });
document.addEventListener('click', (e) => { if (!e.target.closest('#menu, #btn-menu')) $('#menu').classList.add('hidden'); });
$('#btn-chat-info').addEventListener('click', openInfo);

function parseTarget(raw) {
  const v = String(raw || '').trim();
  return v.startsWith('@') || /[a-z]/i.test(v) ? { handle: v } : { phone: v };
}
async function startDirect(target) {
  try {
    const { chat } = await api('/chats/direct', { method: 'POST', body: target });
    state.chats.set(chat.id, { ...chat, unread: 0 });
    openChat(chat.id);
  } catch (err) { toast(err.message); }
}
$('#form-direct').addEventListener('submit', (e) => { e.preventDefault(); startDirect(parseTarget($('#direct-handle').value)); $('#direct-handle').value = ''; });
$('#form-group').addEventListener('submit', async (e) => {
  e.preventDefault();
  const entries = $('#group-members').value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const memberHandles = entries.filter((x) => /[a-z@]/i.test(x)), memberPhones = entries.filter((x) => !/[a-z@]/i.test(x));
  try {
    const { chat } = await api('/chats/group', { method: 'POST', body: { name: $('#group-name').value, category: document.querySelector('input[name=group-category]:checked').value, memberHandles, memberPhones } });
    state.chats.set(chat.id, { ...chat, unread: 0 });
    $('#group-name').value = ''; $('#group-members').value = '';
    openChat(chat.id);
  } catch (err) { toast(err.message); }
});
$('#form-profile').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { user } = await api('/me', { method: 'PATCH', body: { name: $('#profile-name').value, about: $('#profile-about').value, discoverableByPhone: $('#profile-discoverable').checked } });
    state.me = user; renderMe(); toast('Perfil salvo!'); closePanels();
  } catch (err) { toast(err.message); }
});
$('#profile-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const avatar = await resizeImage(file, 320, 0.85);
    const { user } = await api('/me', { method: 'PATCH', body: { avatar } });
    state.me = user; renderMe();
  } catch (err) { toast(err.message); }
});

async function loadContacts() {
  const known = new Map();
  for (const chat of state.chats.values()) for (const m of chat.members) if (m.id !== state.me.id && m.kind === 'person') known.set(m.id, m);
  state.contacts = [...known.values()].sort((a, b) => a.name.localeCompare(b.name));
  renderContacts();
}
function renderContacts() {
  $('#contacts-list').innerHTML = state.contacts.map((u) => `<button class="contact" data-handle="${escapeHtml(u.handle || '')}"><img class="avatar" src="${avatarFor(u)}" alt=""><div><div>${escapeHtml(u.name)}</div><div class="sub">${escapeHtml(u.handle || '')}${u.about ? ' · ' + escapeHtml(u.about) : ''}</div></div></button>`).join('')
    || '<p class="hint">Ninguém ainda. Digite um @usuário acima para começar.</p>';
}
$('#contacts-list').addEventListener('click', (e) => { const c = e.target.closest('.contact'); if (c?.dataset.handle) startDirect({ handle: c.dataset.handle }); });
$('#btn-pick-contacts').addEventListener('click', async () => {
  try {
    const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true });
    const { users } = await api('/contacts/sync', { method: 'POST', body: { phones: picked.flatMap((c) => c.tel || []) } });
    if (!users.length) return toast('Nenhum desses contatos está no ZapLivre ainda.');
    const merged = new Map(state.contacts.map((u) => [u.id, u]));
    for (const u of users) merged.set(u.id, u);
    state.contacts = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
    renderContacts();
    toast(`${users.length} contato(s) encontrado(s).`);
  } catch (err) { if (err.name !== 'AbortError') toast(err.message || 'Não foi possível acessar os contatos.'); }
});
$('#btn-share').addEventListener('click', async () => {
  const url = `${location.origin}/${state.me.handle}`;
  const data = { title: 'ZapLivre', text: `Fala comigo no ZapLivre: ${state.me.handle}. Mensagens grátis, feitas para o Brasil!`, url };
  if (navigator.share) { try { await navigator.share(data); } catch { /* cancelado */ } }
  else { await navigator.clipboard?.writeText(`${data.text} ${url}`); toast('Convite copiado!'); }
});

function openInfo() {
  const chat = state.chats.get(state.activeChatId);
  if (!chat) return;
  openPanel('#panel-info');
  $('#info-avatar').src = avatarFor(chat);
  $('#info-name').textContent = chat.name;
  const isGroup = chat.type === 'group', isAdmin = chat.role === 'admin' && !chat.viaWorkspace;
  const peerIsBusiness = chat.peer?.kind === 'business';
  $('#info-sub').textContent = isGroup ? `Grupo de ${TAB_LABEL[chat.category]} · ${chat.members.length} participante(s)` : peerIsBusiness ? `Empresa ${chat.peer.handle} · ${chat.peer.about || ''}` : `${chat.peer?.handle || ''} · ${chat.peer?.about || ''}`;
  $('#info-category').classList.toggle('hidden', chat.category === 'desk' || Boolean(chat.viaWorkspace));
  const radio = document.querySelector(`input[name=my-category][value=${chat.category}]`);
  if (radio) radio.checked = true;
  $('#form-group-edit').classList.toggle('hidden', !(isGroup && isAdmin));
  $('#info-group-name').value = chat.name;
  $('#form-add-member').classList.toggle('hidden', !(isGroup && isAdmin));
  $('#btn-leave').classList.toggle('hidden', !isGroup);
  $('#btn-block').classList.toggle('hidden', isGroup || Boolean(chat.viaWorkspace));
  $('#btn-block').textContent = chat.peer && state.blocked.has(chat.peer.id) ? 'Desbloquear' : peerIsBusiness ? 'Bloquear empresa' : 'Bloquear';
  $('#info-members-title').textContent = isGroup ? 'Participantes' : 'Contato';
  const people = isGroup ? chat.members : [chat.peer];
  $('#info-members').innerHTML = people.map((u) => `<div class="contact"><img class="avatar" src="${avatarFor(u)}" alt=""><div><div>${escapeHtml(u.id === state.me.id ? 'Você' : u.name)}</div><div class="sub">${escapeHtml(u.handle || '')}${u.about ? ' · ' + escapeHtml(u.about) : ''}</div></div>${u.role === 'admin' ? '<span class="tag">admin</span>' : ''}</div>`).join('');
}
$('#info-category').addEventListener('change', async (e) => {
  try {
    const { chat } = await api(`/chats/${state.activeChatId}/category`, { method: 'PATCH', body: { category: e.target.value } });
    state.chats.set(chat.id, { ...state.chats.get(chat.id), ...chat });
    setTab(chat.category);
    toast(`Conversa movida para ${TAB_LABEL[chat.category]}.`);
  } catch (err) { toast(err.message); }
});
$('#form-group-edit').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await api('/chats/' + state.activeChatId, { method: 'PATCH', body: { name: $('#info-group-name').value } }); await refreshChat(state.activeChatId); openInfo(); toast('Grupo atualizado.'); }
  catch (err) { toast(err.message); }
});
$('#form-add-member').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api(`/chats/${state.activeChatId}/members`, { method: 'POST', body: parseTarget($('#add-member-handle').value) });
    $('#add-member-handle').value = '';
    await refreshChat(state.activeChatId); openInfo();
  } catch (err) { toast(err.message); }
});
$('#btn-block').addEventListener('click', async () => {
  const chat = state.chats.get(state.activeChatId);
  if (!chat?.peer) return;
  try {
    if (state.blocked.has(chat.peer.id)) { await api(`/users/${chat.peer.id}/block`, { method: 'DELETE' }); state.blocked.delete(chat.peer.id); toast('Contato desbloqueado.'); }
    else { await api(`/users/${chat.peer.id}/block`, { method: 'POST' }); state.blocked.add(chat.peer.id); toast('Contato bloqueado. Ele não consegue mais te enviar mensagens.'); }
    openInfo();
  } catch (err) { toast(err.message); }
});
$('#btn-leave').addEventListener('click', async () => {
  if (!confirm('Sair do grupo?')) return;
  try {
    const id = state.activeChatId;
    await api(`/chats/${id}/leave`, { method: 'POST' });
    state.chats.delete(id); state.messages.delete(id); state.activeChatId = null;
    closePanels();
    $('#chat-view').classList.add('hidden'); $('#chat-placeholder').classList.remove('hidden'); $('#app').classList.remove('show-chat');
    renderChatList();
  } catch (err) { toast(err.message); }
});

// ---------- painel de mídias ----------
$('#btn-media').addEventListener('click', () => openMedia());
$('#btn-close-media').addEventListener('click', () => $('#media-hub').classList.add('hidden'));
async function openMedia() {
  if (!state.activeChatId) return;
  $('#media-hub').classList.remove('hidden');
  $('#media-body').innerHTML = '<p class="hint">Carregando...</p>';
  try {
    const hub = await api(`/chats/${state.activeChatId}/media`);
    state.mediaHub = hub;
    renderMedia();
  } catch (err) { $('#media-body').innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`; }
}
function renderMedia() {
  const hub = state.mediaHub;
  const f = state.mediaFilter;
  const tagsHtml = (a) => `<div>${a.category ? `<span class="tag cat">${escapeHtml(a.category)}</span>` : ''}${a.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}<button class="tag-btn" data-tag="${a.id}">+ etiqueta</button></div>`;
  const filters = ['all', 'image', 'document', 'audio', 'link', ...hub.categories];
  const label = { all: 'Tudo', image: 'Fotos', document: 'Documentos', audio: 'Áudios', link: 'Links' };
  const show = (kind, a) => f === 'all' || f === kind || (a && a.category === f);
  let html = `<div class="media-filter">${filters.map((x) => `<button class="${f === x ? 'active' : ''}" data-filter="${x}">${label[x] || x}</button>`).join('')}</div>`;
  const imgs = hub.images.filter((a) => show('image', a));
  if (imgs.length) html += `<h4>Fotos</h4><div class="media-grid">${imgs.map((a) => `<img src="${a.url}" alt="" loading="lazy" data-full="1">`).join('')}</div>`;
  const docs = hub.documents.filter((a) => show('document', a));
  if (docs.length) html += `<h4>Documentos</h4>` + docs.map((a) => `<div class="media-item"><span class="doc-icon">📄</span><div class="grow"><a class="doc-name" href="${a.url}" target="_blank" rel="noopener">${escapeHtml(a.name)}</a><div class="doc-meta">${fmtSize(a.size)} · ${new Date(a.createdAt).toLocaleDateString('pt-BR')}</div>${tagsHtml(a)}</div></div>`).join('');
  const auds = hub.audios.filter((a) => show('audio', a));
  if (auds.length) html += `<h4>Áudios</h4>` + auds.map((a) => `<div class="media-item"><span class="doc-icon">🎤</span><div class="grow"><audio controls preload="none" src="${a.url}" style="width:100%"></audio><div class="doc-meta">${fmtDur(a.duration)} · ${new Date(a.createdAt).toLocaleDateString('pt-BR')}</div>${a.transcript ? `<div class="transcript">${escapeHtml(a.summary || a.transcript.slice(0, 200))}</div>` : ''}${tagsHtml(a)}</div></div>`).join('');
  if (show('link') && hub.links.length) html += `<h4>Links</h4>` + hub.links.map((l) => `<div class="media-item"><span class="doc-icon">🔗</span><div class="grow"><a class="doc-name" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.url)}</a><div class="doc-meta">${new Date(l.createdAt).toLocaleDateString('pt-BR')}</div></div></div>`).join('');
  if (!imgs.length && !docs.length && !auds.length && !hub.links.length) html += '<p class="hint">Nada por aqui ainda. Fotos, áudios, documentos e links desta conversa aparecem organizados neste painel.</p>';
  $('#media-body').innerHTML = html;
}
$('#media-body').addEventListener('click', async (e) => {
  const fb = e.target.closest('button[data-filter]');
  if (fb) { state.mediaFilter = fb.dataset.filter; renderMedia(); return; }
  const img = e.target.closest('img[data-full]');
  if (img) { $('#lightbox img').src = img.src; $('#lightbox').classList.remove('hidden'); return; }
  const tb = e.target.closest('button[data-tag]');
  if (tb) {
    const tag = prompt('Etiqueta (ex.: nota fiscal, fornecedor, contrato):');
    if (!tag) return;
    const all = [...state.mediaHub.images, ...state.mediaHub.documents, ...state.mediaHub.audios];
    const a = all.find((x) => x.id === tb.dataset.tag);
    try {
      const { attachment } = await api(`/attachments/${a.id}`, { method: 'PATCH', body: { tags: [...a.tags, tag] } });
      Object.assign(a, attachment); renderMedia();
    } catch (err) { toast(err.message); }
  }
});

// ---------- empresas ----------
async function openWorkspaces() {
  openPanel('#panel-workspaces');
  await loadWorkspaces();
  $('#workspace-list').innerHTML = state.workspaces.map((w) => `<button class="contact" data-ws="${w.id}"><img class="avatar" src="${avatarFor(w.businessUser || w)}" alt=""><div><div>${escapeHtml(w.name)} ${w.verified ? '<span class="verified">✔ verificada</span>' : '<span class="badge-warn">não verificada</span>'}</div><div class="sub">${escapeHtml(w.handle)} · ${escapeHtml(w.planLabel)} · ${w.role}</div></div></button>`).join('')
    || '<p class="hint">Você ainda não participa de nenhuma empresa.</p>';
}
$('#workspace-list').addEventListener('click', (e) => { const b = e.target.closest('[data-ws]'); if (b) openWorkspace(b.dataset.ws); });
$('#form-workspace').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { workspace } = await api('/workspaces', { method: 'POST', body: { domain: $('#ws-domain').value, name: $('#ws-name').value } });
    $('#ws-domain').value = ''; $('#ws-name').value = '';
    toast('Empresa criada! Verifique o domínio para aparecer nas buscas.');
    await loadWorkspaces();
    openWorkspace(workspace.id);
  } catch (err) { toast(err.message); }
});
async function openWorkspace(id, extra = {}) {
  let w;
  try { w = (await api('/workspaces/' + id)).workspace; } catch (err) { return toast(err.message); }
  state.currentWorkspace = w;
  openPanel('#panel-workspace');
  $('#ws-title').textContent = w.name;
  const admin = ['owner', 'admin'].includes(w.role);
  const plans = await api('/plans').then((r) => r.plans).catch(() => ({}));
  $('#ws-body').innerHTML = `
    <div class="card">
      <h4>${escapeHtml(w.name)} <small class="muted">${escapeHtml(w.handle)}</small> ${w.verified ? '<span class="badge-ok">Domínio verificado</span>' : '<span class="badge-warn">Domínio não verificado</span>'}</h4>
      ${w.verified ? '<p class="kv">Clientes encontram você digitando <code>' + escapeHtml(w.handle) + '</code> em Nova conversa. Link: <code>' + location.origin + '/' + escapeHtml(w.handle) + '</code></p>'
        : `<p class="kv">Para provar que o domínio é seu, crie um registro DNS:<br>Tipo <code>TXT</code> · Nome <code>${escapeHtml(w.dnsRecord.host)}</code> · Valor <code>${escapeHtml(w.dnsRecord.value)}</code></p>${admin ? '<button class="btn-secondary" data-ws-act="verify">Verificar agora</button>' : ''}`}
      <button class="btn-primary" data-ws-act="board">Abrir painel de atendimento (Kanban)</button>
    </div>
    <div class="card"><h4>Atendentes (${w.members.length}/${w.limits.agents})</h4>
      ${w.members.map((m) => `<div class="contact"><img class="avatar" src="${avatarFor(m)}" alt=""><div><div>${escapeHtml(m.name)}</div><div class="sub">${escapeHtml(m.handle || '')} · ${m.role}</div></div>${admin && m.role !== 'owner' ? `<button class="tag-btn" data-ws-act="remove-agent" data-user="${m.id}">remover</button>` : ''}</div>`).join('')}
      ${admin ? '<form id="form-agent" class="stack"><input id="agent-handle" type="text" placeholder="@usuario do atendente" required><button class="btn-secondary" type="submit">Adicionar atendente</button></form>' : ''}
    </div>
    ${admin ? `<div class="card"><h4>Integrações (robôs e IA)</h4>
      <p class="kv">Conecte n8n, Typebot, Make ou LangChain. Sem risco de bloqueio: a API é oficial.</p>
      <p class="kv">Chave de API: ${w.hasApiKey ? '<span class="badge-ok">ativa</span>' : '<span class="badge-warn">não gerada</span>'} <button class="tag-btn" data-ws-act="api-key">${w.hasApiKey ? 'gerar nova' : 'gerar'}</button></p>
      ${extra.apiKey ? `<p class="kv">Copie agora, ela não será mostrada de novo:<br><code>${escapeHtml(extra.apiKey)}</code></p>` : ''}
      <form id="form-webhook" class="stack"><label>URL do webhook (recebe as mensagens dos clientes)</label><input id="webhook-url" type="url" placeholder="https://seu-n8n.com/webhook/zaplivre" value="${escapeHtml(w.webhookUrl || '')}"><button class="btn-secondary" type="submit">Salvar webhook</button></form>
      ${extra.webhookSecret ? `<p class="kv">Segredo para validar a assinatura (guarde agora): <code>${escapeHtml(extra.webhookSecret)}</code></p>` : ''}
      <p class="kv"><a href="/docs/API.md" target="_blank">Documentação da API</a> · <button class="tag-btn" data-ws-act="logs">ver entregas do webhook</button></p>
      <div id="webhook-logs"></div>
    </div>
    <div class="card"><h4>Plano: ${escapeHtml(w.planLabel)} ${w.planActive ? '<span class="badge-ok">ativo</span>' : '<span class="badge-warn">expirado</span>'}</h4>
      <p class="kv">Assinatura fixa mensal, mensagens ilimitadas. ${w.planExpiresAt ? 'Válido até ' + new Date(w.planExpiresAt).toLocaleDateString('pt-BR') + '.' : ''}</p>
      <div class="plans">${Object.entries(plans).filter(([k]) => k !== 'trial').map(([k, p]) => `<div class="plan ${w.plan === k ? 'current' : ''}"><small>${escapeHtml(p.label)}</small><b>R$ ${p.priceBRL}</b><small>/mês · ${p.agents} atendentes</small><br>${w.role === 'owner' ? `<button class="btn-secondary" data-ws-act="subscribe" data-plan="${k}">${w.plan === k ? 'Renovar' : 'Assinar'}</button>` : ''}</div>`).join('')}</div>
    </div>` : ''}`;
}
$('#ws-body').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-ws-act]');
  if (!b) return;
  const w = state.currentWorkspace;
  try {
    switch (b.dataset.wsAct) {
      case 'verify': await api(`/workspaces/${w.id}/verify`, { method: 'POST' }); toast('Domínio verificado!'); openWorkspace(w.id); break;
      case 'board': openBoard(w.id); break;
      case 'remove-agent': if (confirm('Remover atendente?')) { await api(`/workspaces/${w.id}/agents/${b.dataset.user}`, { method: 'DELETE' }); openWorkspace(w.id); } break;
      case 'api-key': { const { apiKey } = await api(`/workspaces/${w.id}/api-key`, { method: 'POST' }); openWorkspace(w.id, { apiKey }); break; }
      case 'logs': { const { logs } = await api(`/workspaces/${w.id}/webhook-logs`); $('#webhook-logs').innerHTML = logs.length ? logs.map((l) => `<div class="kv">${new Date(l.created_at).toLocaleString('pt-BR')} · ${escapeHtml(l.event)} · ${l.error ? '<span class="error">' + escapeHtml(l.error) + '</span>' : 'HTTP ' + l.status}</div>`).join('') : '<p class="hint">Nenhuma entrega ainda.</p>'; break; }
      case 'subscribe': { const r = await api(`/workspaces/${w.id}/subscribe`, { method: 'POST', body: { plan: b.dataset.plan } }); alert(`Plano ${r.plan}: R$ ${r.priceBRL}/mês.\n\nReferência do pedido: ${r.reference}\n\nConclua o pagamento com o provedor configurado (Pix ou cartão). O plano ativa automaticamente após a confirmação.`); break; }
    }
  } catch (err) { toast(err.message); }
});
$('#ws-body').addEventListener('submit', async (e) => {
  e.preventDefault();
  const w = state.currentWorkspace;
  try {
    if (e.target.id === 'form-agent') { await api(`/workspaces/${w.id}/agents`, { method: 'POST', body: { handle: $('#agent-handle').value } }); toast('Atendente adicionado.'); openWorkspace(w.id); loadChats(); }
    if (e.target.id === 'form-webhook') { const r = await api(`/workspaces/${w.id}/webhook`, { method: 'PUT', body: { url: $('#webhook-url').value } }); toast('Webhook salvo.'); openWorkspace(w.id, { webhookSecret: r.webhookSecret }); }
  } catch (err) { toast(err.message); }
});

// ---------- Kanban ----------
async function openBoard(workspaceId) {
  openPanel('#panel-board');
  state.boardWorkspace = workspaceId;
  const w = state.workspaces.find((x) => x.id === workspaceId);
  $('#board-title').textContent = `Atendimento · ${w?.name || ''}`;
  await renderBoard();
}
async function renderBoard() {
  let board;
  try { board = (await api(`/workspaces/${state.boardWorkspace}/board`)).board; } catch (err) { return toast(err.message); }
  const order = ['open', 'in_progress', 'done'];
  $('#board').innerHTML = order.map((st) => `<div class="column" data-status="${st}"><h4>${STATUS_LABEL[st]} <span class="muted">${board[st].length}</span></h4><div class="cards">${board[st].map((c) => `
    <div class="tcard ${st}" draggable="true" data-id="${c.id}">
      <div class="tname"><span>${escapeHtml(c.name)}</span>${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</div>
      <div class="tprev">${c.lastMessage ? escapeHtml(c.lastMessage.type === 'text' ? c.lastMessage.body : '📎 Anexo') : ''}</div>
      <div class="tmeta">${c.ticket.botPaused ? '👤 humano' : '🤖 robô'}${c.ticket.assigneeId ? ' · ' + escapeHtml(w_name(c.ticket.assigneeId)) : ''}${c.ticket.tags.map((t) => ` <span class="tag">${escapeHtml(t)}</span>`).join('')}${c.lastMessage ? ' · ' + fmtListTime(c.lastMessage.createdAt) : ''}</div>
      <div class="move">${order.filter((o) => o !== st).map((o) => `<button data-move="${o}" data-id="${c.id}">→ ${STATUS_LABEL[o]}</button>`).join('')}<button data-open="${c.id}">Abrir</button></div>
    </div>`).join('')}</div></div>`).join('');
}
function w_name(userId) {
  const w = state.workspaces.find((x) => x.id === state.boardWorkspace);
  return w?.members.find((m) => m.id === userId)?.name || 'atendente';
}
async function moveTicket(chatId, status) {
  try { await api(`/chats/${chatId}/ticket`, { method: 'PATCH', body: { status } }); await renderBoard(); refreshChat(chatId); } catch (err) { toast(err.message); }
}
$('#board').addEventListener('click', (e) => {
  const mv = e.target.closest('[data-move]');
  if (mv) return moveTicket(mv.dataset.id, mv.dataset.move);
  const op = e.target.closest('[data-open]');
  if (op) { if (!state.chats.has(op.dataset.open)) loadChats().then(() => openChat(op.dataset.open)); else openChat(op.dataset.open); }
});
$('#board').addEventListener('dragstart', (e) => { const c = e.target.closest('.tcard'); if (c) e.dataTransfer.setData('text/plain', c.dataset.id); });
$('#board').addEventListener('dragover', (e) => { const col = e.target.closest('.column'); if (col) { e.preventDefault(); col.classList.add('drop'); } });
$('#board').addEventListener('dragleave', (e) => e.target.closest('.column')?.classList.remove('drop'));
$('#board').addEventListener('drop', (e) => { const col = e.target.closest('.column'); if (!col) return; e.preventDefault(); col.classList.remove('drop'); moveTicket(e.dataTransfer.getData('text/plain'), col.dataset.status); });

// ---------- notificações e instalação ----------
function notify(chat, message) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  const body = message.type === 'text' ? message.body : message.type === 'audio' ? '🎤 Áudio' : message.type === 'image' ? '📷 Foto' : '📄 Documento';
  const title = chat.type === 'group' ? `${memberName(chat, message.senderId)} em ${chat.name}` : chat.name;
  const opts = { body, icon: '/icons/icon-192.png', tag: chat.id, badge: '/icons/icon-192.png' };
  navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, opts)).catch(() => new Notification(title, opts));
}
$('#menu-notifications').addEventListener('click', async () => {
  if (!('Notification' in window)) return toast('Seu navegador não suporta notificações.');
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? 'Notificações ativadas!' : 'Notificações não permitidas.');
});
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; $('#menu-install').classList.remove('hidden'); });
$('#menu-install').addEventListener('click', async () => { await state.installPrompt?.prompt(); state.installPrompt = null; $('#menu-install').classList.add('hidden'); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.activeChatId) markRead(state.activeChatId); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

boot();
