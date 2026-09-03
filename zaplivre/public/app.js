// ZapLivre - cliente web (PWA). Sem frameworks, só JavaScript moderno.
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  token: localStorage.getItem('zl_token'),
  me: null,
  chats: new Map(), // id -> chat
  messages: new Map(), // chatId -> array
  activeChatId: null,
  online: new Set(),
  typing: new Map(), // chatId -> { userId: name }
  replyTo: null,
  socket: null,
  installPrompt: null,
  contacts: [],
};

// ---------- utilitários ----------
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(state.token ? { authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (res.status === 401 && state.token) { doLogout(false); }
  if (!res.ok) throw new Error(data.error || 'Erro de rede.');
  return data;
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
  const d = new Date(ts);
  const day = fmtDay(ts);
  return `visto por último ${day === 'Hoje' ? 'hoje' : day === 'Ontem' ? 'ontem' : 'em ' + d.toLocaleDateString('pt-BR')} às ${fmtTime(ts)}`;
}
function fmtPhone(p) {
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(p || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p || '';
}

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
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function linkify(text) {
  return escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function resizeImage(file, max = 1280, quality = 0.82) {
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
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = url;
  });
}

// ---------- autenticação ----------
function showAuth() {
  $('#auth').classList.remove('hidden');
  $('#app').classList.add('hidden');
}
function showApp() {
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
}

$('#form-phone').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  $('#auth-error').textContent = '';
  try {
    const { phone, devCode } = await api('/auth/request-code', { method: 'POST', body: { phone: $('#phone').value } });
    $('#code-phone').textContent = fmtPhone(phone);
    $('#form-phone').classList.add('hidden');
    $('#form-code').classList.remove('hidden');
    if (devCode) {
      $('#code').value = devCode;
      $('#code-hint').innerHTML = `<b>Modo de desenvolvimento:</b> seu código é <b>${devCode}</b> (já preenchido).`;
    }
    $('#name').focus();
  } catch (err) {
    $('#auth-error').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$('#form-code').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#auth-error').textContent = '';
  try {
    const { token, user } = await api('/auth/verify', {
      method: 'POST',
      body: { phone: $('#phone').value, code: $('#code').value, name: $('#name').value },
    });
    state.token = token;
    localStorage.setItem('zl_token', token);
    state.me = user;
    await boot();
  } catch (err) {
    $('#auth-error').textContent = err.message;
  }
});

$('#btn-back').addEventListener('click', () => {
  $('#form-code').classList.add('hidden');
  $('#form-phone').classList.remove('hidden');
});

async function doLogout(callServer = true) {
  try { if (callServer) await api('/auth/logout', { method: 'POST' }); } catch { /* ignora */ }
  localStorage.removeItem('zl_token');
  state.token = null;
  state.me = null;
  state.socket?.disconnect();
  location.reload();
}
$('#btn-logout').addEventListener('click', () => doLogout());
$('#menu-logout').addEventListener('click', () => doLogout());

// ---------- inicialização ----------
async function boot() {
  if (!state.token) return showAuth();
  try {
    const { user } = await api('/me');
    state.me = user;
  } catch {
    return showAuth();
  }
  showApp();
  renderMe();
  await loadChats();
  connectSocket();
  const saved = localStorage.getItem('zl_active');
  if (saved && state.chats.has(saved) && window.innerWidth > 760) openChat(saved);
  if ('contacts' in navigator && 'select' in navigator.contacts) $('#btn-pick-contacts').classList.remove('hidden');
}

function renderMe() {
  $('#me-avatar').src = avatarFor(state.me);
  $('#profile-avatar').src = avatarFor(state.me);
  $('#profile-name').value = state.me.name;
  $('#profile-about').value = state.me.about || '';
  $('#profile-phone').textContent = fmtPhone(state.me.phone);
}

async function loadChats() {
  const { chats } = await api('/chats');
  state.chats = new Map(chats.map((c) => [c.id, c]));
  renderChatList();
}

async function refreshChat(chatId) {
  try {
    const { chat } = await api('/chats/' + chatId);
    const prev = state.chats.get(chatId);
    state.chats.set(chatId, { ...chat, unread: prev?.unread ?? chat.unread });
    renderChatList();
    if (state.activeChatId === chatId) renderChatHeader();
  } catch { /* pode ter saído do grupo */ }
}

// ---------- socket ----------
function connectSocket() {
  const socket = io({ auth: { token: state.token } });
  state.socket = socket;

  socket.on('connect', () => {
    socket.emit('presence:who', (ids) => {
      state.online = new Set(ids);
      renderChatHeader();
    });
  });
  socket.on('connect_error', (err) => {
    if (err.message === 'unauthorized') doLogout(false);
  });

  socket.on('message:new', ({ message, clientId }) => {
    // clientId casa a mensagem otimista (ainda sem id do servidor) com a versão definitiva.
    upsertMessage(clientId ? { ...message, clientId } : message);
    const chat = state.chats.get(message.chatId);
    if (!chat) { refreshChat(message.chatId); return; }
    chat.lastMessage = message;
    const isActive = state.activeChatId === message.chatId && document.visibilityState === 'visible';
    if (message.senderId !== state.me.id && message.type !== 'system') {
      if (isActive) socket.emit('chat:read', { chatId: message.chatId });
      else {
        chat.unread = (chat.unread || 0) + 1;
        notify(chat, message);
      }
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
    const list = state.messages.get(chatId) || [];
    for (const m of list) if (messageIds.includes(m.id) && m.status === 'sent' && isFullyReceipted(chat)) m.status = 'delivered';
    if (chat?.lastMessage && messageIds.includes(chat.lastMessage.id) && chat.lastMessage.status === 'sent' && isFullyReceipted(chat)) { chat.lastMessage.status = 'delivered'; renderChatList(); }
    if (state.activeChatId === chatId) renderMessages();
  });

  socket.on('chat:read', ({ chatId, userId }) => {
    if (userId === state.me.id) return;
    const chat = state.chats.get(chatId);
    // Em conversas individuais, tudo que enviei fica lido. Em grupos, buscamos do servidor.
    if (chat?.type === 'direct') {
      for (const m of state.messages.get(chatId) || []) if (m.senderId === state.me.id) m.status = 'read';
      if (chat.lastMessage?.senderId === state.me.id) { chat.lastMessage.status = 'read'; renderChatList(); }
      if (state.activeChatId === chatId) renderMessages();
    } else if (state.activeChatId === chatId) {
      loadMessages(chatId, { silent: true });
    }
  });

  socket.on('chat:new', ({ chatId }) => refreshChat(chatId));
  socket.on('chat:updated', ({ chatId }) => refreshChat(chatId));

  socket.on('user:updated', ({ user }) => {
    for (const chat of state.chats.values()) {
      for (const m of chat.members) if (m.id === user.id) Object.assign(m, user);
      if (chat.type === 'direct' && chat.peer?.id === user.id) { Object.assign(chat.peer, user); chat.name = user.name; chat.avatar = user.avatar; }
    }
    renderChatList();
    renderChatHeader();
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
    renderChatHeader();
    renderChatList();
  });
}

const isFullyReceipted = (chat) => !chat || chat.type === 'direct';

// ---------- lista de conversas ----------
function sortedChats() {
  const q = $('#search').value.trim().toLowerCase();
  return [...state.chats.values()]
    .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.lastMessage?.body || '').toLowerCase().includes(q))
    .sort((a, b) => (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt));
}

function previewText(chat) {
  const t = state.typing.get(chat.id);
  if (t?.size) return `<span style="color:var(--green)">digitando...</span>`;
  const m = chat.lastMessage;
  if (!m) return '';
  const who = chat.type === 'group' && m.senderId && m.type !== 'system' ? escapeHtml(memberName(chat, m.senderId)) + ': ' : '';
  if (m.deleted) return who + '<i>Mensagem apagada</i>';
  if (m.type === 'image') return who + '📷 Foto';
  const ticks = m.senderId === state.me.id ? ticksHtml(m) + ' ' : '';
  return ticks + who + escapeHtml(m.body);
}

function renderChatList() {
  const list = $('#chat-list');
  const chats = sortedChats();
  $('#empty-list').classList.toggle('hidden', state.chats.size > 0);
  list.innerHTML = chats
    .map(
      (c) => `
      <button class="chat-item ${c.id === state.activeChatId ? 'active' : ''} ${c.unread ? 'unread' : ''}" data-id="${c.id}" role="listitem">
        <img class="avatar" src="${avatarFor(c)}" alt="">
        <div class="body">
          <div class="top"><span class="name">${escapeHtml(c.name)}</span><span class="time">${c.lastMessage ? fmtListTime(c.lastMessage.createdAt) : ''}</span></div>
          <div class="bottom"><span class="preview">${previewText(c)}</span>${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</div>
        </div>
      </button>`
    )
    .join('');
  const total = [...state.chats.values()].reduce((n, c) => n + (c.unread || 0), 0);
  document.title = total ? `(${total}) ZapLivre` : 'ZapLivre';
  if (navigator.setAppBadge) (total ? navigator.setAppBadge(total) : navigator.clearAppBadge()).catch(() => {});
}
$('#chat-list').addEventListener('click', (e) => {
  const item = e.target.closest('.chat-item');
  if (item) openChat(item.dataset.id);
});
$('#search').addEventListener('input', renderChatList);

// ---------- conversa aberta ----------
function memberName(chat, userId) {
  if (userId === state.me.id) return 'Você';
  return chat?.members.find((m) => m.id === userId)?.name || 'Participante';
}

async function openChat(chatId) {
  const chat = state.chats.get(chatId);
  if (!chat) return;
  state.activeChatId = chatId;
  state.replyTo = null;
  $('#reply-preview').classList.add('hidden');
  localStorage.setItem('zl_active', chatId);
  $('#app').classList.add('show-chat');
  $('#chat-placeholder').classList.add('hidden');
  $('#chat-view').classList.remove('hidden');
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
  if (typing?.size) {
    status = chat.type === 'group' ? `${[...typing.values()][0]} está digitando...` : 'digitando...';
  } else if (chat.type === 'direct') {
    status = state.online.has(chat.peer?.id) ? 'online' : fmtLastSeen(chat.peer?.lastSeen);
  } else {
    status = chat.members.map((m) => (m.id === state.me.id ? 'Você' : m.name)).join(', ');
  }
  $('#chat-status').textContent = status;
}

async function loadMessages(chatId, { silent = false } = {}) {
  try {
    const { messages } = await api(`/chats/${chatId}/messages?limit=100`);
    state.messages.set(chatId, messages);
    if (state.activeChatId === chatId) renderMessages(!silent);
  } catch (err) {
    if (!silent) toast(err.message);
  }
}

async function loadOlder() {
  const chatId = state.activeChatId;
  const list = state.messages.get(chatId) || [];
  if (!list.length) return;
  const el = $('#messages');
  const before = list[0].createdAt;
  const prevHeight = el.scrollHeight;
  const { messages } = await api(`/chats/${chatId}/messages?limit=100&before=${before}`);
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
  if (idx >= 0) list[idx] = { ...list[idx], ...message };
  else list.push(message);
  if (state.activeChatId === message.chatId) renderMessages();
}

function ticksHtml(m) {
  if (m.status === 'read') return '<span class="ticks read">✓✓</span>';
  if (m.status === 'delivered') return '<span class="ticks">✓✓</span>';
  if (m.status === 'pending') return '<span class="ticks">🕓</span>';
  return '<span class="ticks">✓</span>';
}

function renderMessages(scrollToEnd = true) {
  const chat = state.chats.get(state.activeChatId);
  const list = state.messages.get(state.activeChatId) || [];
  const el = $('#messages');
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  const byId = new Map(list.map((m) => [m.id, m]));
  let html = '';
  let lastDay = '';
  let lastSender = null;
  for (const m of list) {
    const day = fmtDay(m.createdAt);
    if (day !== lastDay) { html += `<div class="day">${day}</div>`; lastDay = day; lastSender = null; }
    if (m.type === 'system') {
      html += `<div class="msg system"><div class="bubble">${escapeHtml(m.body)}</div></div>`;
      lastSender = null;
      continue;
    }
    const out = m.senderId === state.me.id;
    const first = lastSender !== m.senderId;
    lastSender = m.senderId;
    let inner = '';
    if (chat?.type === 'group' && !out && first) inner += `<span class="sender">${escapeHtml(memberName(chat, m.senderId))}</span>`;
    if (m.replyTo) {
      const parent = byId.get(m.replyTo);
      inner += `<div class="quote"><b>${escapeHtml(parent ? memberName(chat, parent.senderId) : '')}</b>${parent ? (parent.type === 'image' ? '📷 Foto' : escapeHtml(parent.body).slice(0, 120)) : 'Mensagem indisponível'}</div>`;
    }
    if (m.deleted) inner += `<span class="deleted">🚫 Mensagem apagada</span>`;
    else if (m.type === 'image') inner += `<img src="${m.body}" alt="Foto" loading="lazy" data-full="1">`;
    else inner += linkify(m.body);
    inner += `<span class="meta">${fmtTime(m.createdAt)}${out ? ticksHtml(m) : ''}</span>`;
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
  const m = (state.messages.get(state.activeChatId) || []).find((x) => x.id === btn.dataset.id);
  if (!m) return;
  if (btn.dataset.act === 'reply') {
    state.replyTo = m;
    $('#reply-name').textContent = memberName(state.chats.get(state.activeChatId), m.senderId);
    $('#reply-text').textContent = m.type === 'image' ? '📷 Foto' : m.body.slice(0, 120);
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
  const clientId = crypto.randomUUID();
  const optimistic = { id: 'tmp-' + clientId, clientId, chatId, senderId: state.me.id, createdAt: Date.now(), status: 'pending', replyTo: state.replyTo?.id || null, ...payload };
  const list = state.messages.get(chatId) || [];
  list.push(optimistic);
  state.messages.set(chatId, list);
  renderMessages();
  state.socket.emit('message:send', { chatId, clientId, replyTo: state.replyTo?.id || null, ...payload }, (ack) => {
    if (ack?.ok) {
      const idx = list.findIndex((m) => m.clientId === clientId);
      if (idx >= 0) list[idx] = { ...ack.message, clientId };
      const chat = state.chats.get(chatId);
      if (chat) chat.lastMessage = ack.message;
      renderMessages(false);
      renderChatList();
    } else {
      toast(ack?.error || 'Não foi possível enviar.');
      const idx = list.findIndex((m) => m.clientId === clientId);
      if (idx >= 0) list.splice(idx, 1);
      renderMessages(false);
    }
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
$('#message-input').addEventListener('input', () => {
  sendTyping(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => sendTyping(false), 2500);
});

$('#file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !state.activeChatId) return;
  try {
    const dataUrl = await resizeImage(file);
    sendMessage({ type: 'image', body: dataUrl });
  } catch (err) {
    toast(err.message);
  }
});

// ---------- painéis ----------
function openPanel(id) {
  closePanels();
  $(id).classList.remove('hidden');
}
function closePanels() {
  $$('.panel').forEach((p) => p.classList.add('hidden'));
  $('#menu').classList.add('hidden');
}
$$('.back-panel').forEach((b) => b.addEventListener('click', closePanels));
$('#btn-back-list').addEventListener('click', () => {
  $('#app').classList.remove('show-chat');
  state.activeChatId = null;
  renderChatList();
});

$('#btn-new-chat').addEventListener('click', () => { openPanel('#panel-new-chat'); loadContacts(); });
$('#btn-empty-new').addEventListener('click', () => { openPanel('#panel-new-chat'); loadContacts(); });
$('#btn-new-group').addEventListener('click', () => openPanel('#panel-new-group'));
$('#btn-profile').addEventListener('click', () => openPanel('#panel-profile'));
$('#menu-profile').addEventListener('click', () => openPanel('#panel-profile'));
$('#btn-menu').addEventListener('click', (e) => { e.stopPropagation(); $('#menu').classList.toggle('hidden'); });
document.addEventListener('click', (e) => { if (!e.target.closest('#menu, #btn-menu')) $('#menu').classList.add('hidden'); });
$('#btn-chat-info').addEventListener('click', openInfo);

$('#form-direct').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { chat } = await api('/chats/direct', { method: 'POST', body: { phone: $('#direct-phone').value } });
    state.chats.set(chat.id, { ...chat, unread: 0 });
    $('#direct-phone').value = '';
    openChat(chat.id);
  } catch (err) {
    toast(err.message);
  }
});

$('#form-group').addEventListener('submit', async (e) => {
  e.preventDefault();
  const memberPhones = $('#group-phones').value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  try {
    const { chat } = await api('/chats/group', { method: 'POST', body: { name: $('#group-name').value, memberPhones } });
    state.chats.set(chat.id, { ...chat, unread: 0 });
    $('#group-name').value = '';
    $('#group-phones').value = '';
    openChat(chat.id);
  } catch (err) {
    toast(err.message);
  }
});

$('#form-profile').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { user } = await api('/me', { method: 'PATCH', body: { name: $('#profile-name').value, about: $('#profile-about').value } });
    state.me = user;
    renderMe();
    toast('Perfil salvo!');
    closePanels();
  } catch (err) {
    toast(err.message);
  }
});
$('#profile-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const avatar = await resizeImage(file, 320, 0.85);
    const { user } = await api('/me', { method: 'PATCH', body: { avatar } });
    state.me = user;
    renderMe();
  } catch (err) {
    toast(err.message);
  }
});

// Contatos: reúne quem já conversa com você + agenda do celular (quando disponível).
async function loadContacts() {
  const known = new Map();
  for (const chat of state.chats.values()) for (const m of chat.members) if (m.id !== state.me.id) known.set(m.id, m);
  state.contacts = [...known.values()].sort((a, b) => a.name.localeCompare(b.name));
  renderContacts();
}
function renderContacts() {
  $('#contacts-list').innerHTML = state.contacts
    .map(
      (u) => `<button class="contact" data-phone="${escapeHtml(u.phone)}"><img class="avatar" src="${avatarFor(u)}" alt=""><div><div>${escapeHtml(u.name)}</div><div class="sub">${escapeHtml(u.about || fmtPhone(u.phone))}</div></div></button>`
    )
    .join('') || '<p class="hint">Ninguém ainda. Digite um número acima para começar.</p>';
}
$('#contacts-list').addEventListener('click', async (e) => {
  const c = e.target.closest('.contact');
  if (!c) return;
  try {
    const { chat } = await api('/chats/direct', { method: 'POST', body: { phone: c.dataset.phone } });
    state.chats.set(chat.id, { ...chat, unread: 0 });
    openChat(chat.id);
  } catch (err) { toast(err.message); }
});
$('#btn-pick-contacts').addEventListener('click', async () => {
  try {
    const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true });
    const phones = picked.flatMap((c) => c.tel || []);
    const { users } = await api('/contacts/sync', { method: 'POST', body: { phones } });
    if (!users.length) return toast('Nenhum desses contatos está no ZapLivre ainda.');
    const merged = new Map(state.contacts.map((u) => [u.id, u]));
    for (const u of users) merged.set(u.id, u);
    state.contacts = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
    renderContacts();
    toast(`${users.length} contato(s) encontrado(s).`);
  } catch (err) {
    if (err.name !== 'AbortError') toast(err.message || 'Não foi possível acessar os contatos.');
  }
});
$('#btn-share').addEventListener('click', async () => {
  const data = { title: 'ZapLivre', text: 'Vem pro ZapLivre: mensagens grátis, feitas para o Brasil!', url: location.origin };
  if (navigator.share) { try { await navigator.share(data); } catch { /* cancelado */ } }
  else { await navigator.clipboard?.writeText(`${data.text} ${data.url}`); toast('Convite copiado!'); }
});

function openInfo() {
  const chat = state.chats.get(state.activeChatId);
  if (!chat) return;
  openPanel('#panel-info');
  $('#info-avatar').src = avatarFor(chat);
  $('#info-name').textContent = chat.name;
  const isGroup = chat.type === 'group';
  const isAdmin = chat.role === 'admin';
  $('#info-sub').textContent = isGroup ? `Grupo · ${chat.members.length} participante(s)` : `${fmtPhone(chat.peer?.phone)} · ${chat.peer?.about || ''}`;
  $('#form-group-edit').classList.toggle('hidden', !(isGroup && isAdmin));
  $('#info-group-name').value = chat.name;
  $('#form-add-member').classList.toggle('hidden', !(isGroup && isAdmin));
  $('#btn-leave').classList.toggle('hidden', !isGroup);
  $('#info-members-title').textContent = isGroup ? 'Participantes' : 'Contato';
  const people = isGroup ? chat.members : [chat.peer];
  $('#info-members').innerHTML = people
    .map((u) => `<div class="contact"><img class="avatar" src="${avatarFor(u)}" alt=""><div><div>${escapeHtml(u.id === state.me.id ? 'Você' : u.name)}</div><div class="sub">${escapeHtml(u.about || fmtPhone(u.phone))}</div></div>${u.role === 'admin' ? '<span class="tag">admin</span>' : ''}</div>`)
    .join('');
}
$('#form-group-edit').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/chats/' + state.activeChatId, { method: 'PATCH', body: { name: $('#info-group-name').value } });
    await refreshChat(state.activeChatId);
    openInfo();
    toast('Grupo atualizado.');
  } catch (err) { toast(err.message); }
});
$('#form-add-member').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api(`/chats/${state.activeChatId}/members`, { method: 'POST', body: { phone: $('#add-member-phone').value } });
    $('#add-member-phone').value = '';
    await refreshChat(state.activeChatId);
    openInfo();
  } catch (err) { toast(err.message); }
});
$('#btn-leave').addEventListener('click', async () => {
  if (!confirm('Sair do grupo?')) return;
  try {
    const id = state.activeChatId;
    await api(`/chats/${id}/leave`, { method: 'POST' });
    state.chats.delete(id);
    state.messages.delete(id);
    state.activeChatId = null;
    closePanels();
    $('#chat-view').classList.add('hidden');
    $('#chat-placeholder').classList.remove('hidden');
    $('#app').classList.remove('show-chat');
    renderChatList();
  } catch (err) { toast(err.message); }
});

// ---------- notificações e instalação ----------
function notify(chat, message) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  const body = message.type === 'image' ? '📷 Foto' : message.body;
  const title = chat.type === 'group' ? `${memberName(chat, message.senderId)} em ${chat.name}` : chat.name;
  const opts = { body, icon: '/icons/icon-192.png', tag: chat.id, badge: '/icons/icon-192.png' };
  navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, opts)).catch(() => new Notification(title, opts));
}
$('#menu-notifications').addEventListener('click', async () => {
  if (!('Notification' in window)) return toast('Seu navegador não suporta notificações.');
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? 'Notificações ativadas!' : 'Notificações não permitidas.');
});
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.installPrompt = e;
  $('#menu-install').classList.remove('hidden');
});
$('#menu-install').addEventListener('click', async () => {
  await state.installPrompt?.prompt();
  state.installPrompt = null;
  $('#menu-install').classList.add('hidden');
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.activeChatId) markRead(state.activeChatId);
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

boot();
