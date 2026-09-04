// ZapLivre - servidor HTTP + WebSocket + API pública para robôs.
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { openDatabase } from './db.js';
import { createAuth, httpError, publicUser, privateUser } from './auth.js';
import { createChatService, TICKET_STATUSES } from './chats.js';
import { createWorkspaceService, PLANS } from './workspaces.js';
import { createFileService, buildTranscriber } from './files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({
  dbFile = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'zaplivre.db'),
  uploadDir = process.env.UPLOAD_DIR || path.join(path.dirname(dbFile === ':memory:' ? path.join(__dirname, '..', 'data', 'x') : dbFile), 'uploads'),
  devShowOtp = process.env.DEV_SHOW_OTP === '1',
  smsWebhookUrl = process.env.SMS_WEBHOOK_URL || '',
  billingSecret = process.env.BILLING_WEBHOOK_SECRET || '',
  transcriber = buildTranscriber(process.env),
  dnsResolver,
  logger = console,
} = {}) {
  const db = openDatabase(dbFile);
  const auth = createAuth(db, { devShowOtp, smsWebhookUrl, logger });
  const workspaces = createWorkspaceService(db, { dnsResolver, logger });
  const files = createFileService(db, { uploadDir, transcriber, logger });
  const chats = createChatService(db, { workspaces, files });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '2mb' }));

  const server = http.createServer(app);
  const io = new SocketServer(server, { maxHttpBufferSize: 2_000_000 });

  const buckets = new Map();
  function rateLimit(key, limit, windowMs) {
    const t = Date.now();
    const bucket = (buckets.get(key) || []).filter((x) => x > t - windowMs);
    if (bucket.length >= limit) return false;
    bucket.push(t);
    buckets.set(key, bucket);
    return true;
  }

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  function requireAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const user = auth.authenticate(token);
    if (!user) return next(httpError(401, 'Faça login novamente.'));
    req.user = user;
    req.token = token;
    next();
  }

  // ----- Autenticação -----
  app.post('/api/auth/request-code', wrap(async (req, res) => {
    if (!rateLimit('ip:' + req.ip, 20, 3600000) || !rateLimit('phone:' + req.body?.phone, 5, 900000)) throw httpError(429, 'Muitos pedidos. Aguarde alguns minutos.');
    res.json(await auth.requestOtp(req.body?.phone));
  }));
  app.get('/api/auth/username-available', (req, res) => res.json(auth.usernameAvailable(req.query.u)));
  app.post('/api/auth/verify', wrap((req, res) => {
    res.json(auth.verifyOtp(req.body?.phone, req.body?.code, { name: req.body?.name, username: req.body?.username }));
  }));
  app.post('/api/auth/logout', requireAuth, (req, res) => { auth.logout(req.token); res.json({ ok: true }); });

  // ----- Perfil, descoberta e bloqueio -----
  app.get('/api/me', requireAuth, (req, res) => res.json({ user: privateUser(req.user), blocked: chats.blockedIds(req.user.id) }));
  app.patch('/api/me', requireAuth, wrap((req, res) => {
    const u = chats.updateProfile(req.user.id, req.body || {});
    broadcastToPeers(req.user.id, 'user:updated', { user: publicUser(u) });
    res.json({ user: privateUser(u) });
  }));
  app.post('/api/contacts/sync', requireAuth, (req, res) => res.json({ users: chats.syncContacts(req.body?.phones) }));
  app.get('/api/users/lookup', requireAuth, wrap((req, res) => res.json({ user: publicUser(chats.findUser(req.query)) })));
  app.post('/api/users/:id/block', requireAuth, wrap((req, res) => { chats.block(req.user.id, req.params.id); res.json({ ok: true }); }));
  app.delete('/api/users/:id/block', requireAuth, wrap((req, res) => { chats.unblock(req.user.id, req.params.id); res.json({ ok: true }); }));

  // ----- Conversas -----
  app.get('/api/chats', requireAuth, (req, res) => res.json({ chats: chats.listChats(req.user.id) }));
  app.post('/api/chats/direct', requireAuth, wrap(async (req, res) => {
    const { chat, created, business } = chats.openDirectChat(req.user.id, req.body || {});
    if (created) {
      notifyChatCreated(chat.id, req.user.id);
      if (business) fireWebhook(business.workspace_id, 'conversation.opened', { conversation: publicConversation(chat, chat.id), customer: publicUser(req.user) });
    }
    res.status(created ? 201 : 200).json({ chat });
  }));
  app.post('/api/chats/group', requireAuth, wrap((req, res) => {
    const { chat, message } = chats.createGroup(req.user.id, req.body || {});
    notifyChatCreated(chat.id, null);
    io.to(room(chat.id)).emit('message:new', { message });
    res.status(201).json({ chat });
  }));
  app.get('/api/chats/:id', requireAuth, wrap((req, res) => res.json({ chat: chats.getChat(req.user.id, req.params.id) })));
  app.patch('/api/chats/:id', requireAuth, wrap((req, res) => {
    const chat = chats.updateGroup(req.user.id, req.params.id, req.body || {});
    io.to(room(chat.id)).emit('chat:updated', { chatId: chat.id });
    res.json({ chat });
  }));
  app.patch('/api/chats/:id/category', requireAuth, wrap((req, res) => res.json({ chat: chats.setMyCategory(req.user.id, req.params.id, req.body?.category ?? null) })));
  app.post('/api/chats/:id/members', requireAuth, wrap((req, res) => {
    const { chat, message, addedUserId } = chats.addGroupMember(req.user.id, req.params.id, req.body || {});
    joinUserToRoom(addedUserId, chat.id);
    io.to(room(chat.id)).emit('chat:updated', { chatId: chat.id });
    io.to(room(chat.id)).emit('message:new', { message });
    res.json({ chat });
  }));
  app.post('/api/chats/:id/leave', requireAuth, wrap((req, res) => {
    const { message } = chats.leaveGroup(req.user.id, req.params.id);
    leaveUserFromRoom(req.user.id, req.params.id);
    if (message) {
      io.to(room(req.params.id)).emit('chat:updated', { chatId: req.params.id });
      io.to(room(req.params.id)).emit('message:new', { message });
    }
    res.json({ ok: true });
  }));

  // ----- Mensagens -----
  app.get('/api/chats/:id/messages', requireAuth, wrap((req, res) => res.json({ messages: chats.listMessages(req.user.id, req.params.id, req.query) })));
  app.post('/api/chats/:id/messages', requireAuth, wrap(async (req, res) => {
    res.status(201).json({ message: await deliver(req.user.id, req.params.id, req.body || {}) });
  }));
  app.post('/api/chats/:id/read', requireAuth, wrap((req, res) => {
    const actorId = chats.markChatRead(req.user.id, req.params.id);
    io.to(room(req.params.id)).emit('chat:read', { chatId: req.params.id, userId: actorId });
    res.json({ ok: true });
  }));
  app.delete('/api/messages/:id', requireAuth, wrap((req, res) => {
    const message = chats.deleteMessage(req.user.id, req.params.id);
    io.to(room(message.chatId)).emit('message:deleted', { message });
    res.json({ message });
  }));

  // ----- Atendimento (Desk): tickets, Kanban, robô <-> humano -----
  app.post('/api/chats/:id/takeover', requireAuth, wrap((req, res) => {
    const { chat, message } = chats.takeover(req.user.id, req.params.id);
    io.to(room(chat.id)).emit('chat:updated', { chatId: chat.id });
    io.to(room(chat.id)).emit('message:new', { message });
    fireWebhook(chat.business?.workspaceId, 'conversation.handoff', { conversationId: chat.id, to: 'human', agent: publicUser(req.user) });
    res.json({ chat });
  }));
  app.post('/api/chats/:id/resume-bot', requireAuth, wrap((req, res) => {
    const { chat, message } = chats.resumeBot(req.user.id, req.params.id);
    io.to(room(chat.id)).emit('chat:updated', { chatId: chat.id });
    io.to(room(chat.id)).emit('message:new', { message });
    fireWebhook(chat.business?.workspaceId, 'conversation.handoff', { conversationId: chat.id, to: 'bot' });
    res.json({ chat });
  }));
  app.patch('/api/chats/:id/ticket', requireAuth, wrap((req, res) => {
    chats.updateTicket(req.user.id, req.params.id, req.body || {});
    const chat = chats.getChat(req.user.id, req.params.id);
    io.to(room(chat.id)).emit('chat:updated', { chatId: chat.id });
    res.json({ chat });
  }));

  // ----- Empresas (workspaces) -----
  app.get('/api/workspaces', requireAuth, (req, res) => res.json({ workspaces: workspaces.listForUser(req.user.id) }));
  app.post('/api/workspaces', requireAuth, wrap((req, res) => res.status(201).json({ workspace: workspaces.create(req.user.id, req.body || {}) })));
  app.get('/api/workspaces/:id', requireAuth, wrap((req, res) => res.json({ workspace: workspaces.get(req.params.id, req.user.id) })));
  app.patch('/api/workspaces/:id', requireAuth, wrap((req, res) => res.json({ workspace: workspaces.update(req.params.id, req.user.id, req.body || {}) })));
  app.post('/api/workspaces/:id/verify', requireAuth, wrap(async (req, res) => res.json(await workspaces.verifyDomain(req.params.id, req.user.id))));
  app.post('/api/workspaces/:id/agents', requireAuth, wrap((req, res) => {
    const workspace = workspaces.addAgent(req.params.id, req.user.id, req.body?.handle);
    joinAgentToWorkspaceRooms(req.body?.handle, workspace);
    res.json({ workspace });
  }));
  app.delete('/api/workspaces/:id/agents/:userId', requireAuth, wrap((req, res) => res.json({ workspace: workspaces.removeAgent(req.params.id, req.user.id, req.params.userId) })));
  app.post('/api/workspaces/:id/api-key', requireAuth, wrap((req, res) => res.json(workspaces.rotateApiKey(req.params.id, req.user.id))));
  app.put('/api/workspaces/:id/webhook', requireAuth, wrap((req, res) => res.json(workspaces.setWebhook(req.params.id, req.user.id, req.body?.url))));
  app.get('/api/workspaces/:id/webhook-logs', requireAuth, wrap((req, res) => res.json({ logs: workspaces.webhookLogs(req.params.id, req.user.id) })));
  app.get('/api/workspaces/:id/board', requireAuth, wrap((req, res) => res.json({ board: chats.board(req.params.id, req.user.id) })));
  app.get('/api/plans', (req, res) => res.json({ plans: PLANS }));
  app.post('/api/workspaces/:id/subscribe', requireAuth, wrap((req, res) => res.json(workspaces.subscribe(req.params.id, req.user.id, req.body?.plan))));

  // Webhook do provedor de pagamento: confirma o pagamento e ativa o plano.
  app.post('/api/billing/webhook', wrap((req, res) => {
    if (!billingSecret) throw httpError(503, 'Cobrança não configurada.');
    const given = req.get('x-billing-secret') || '';
    if (given.length !== billingSecret.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(billingSecret))) throw httpError(401, 'Assinatura inválida.');
    const [workspaceId, plan] = String(req.body?.reference || '').split(':');
    const workspace = workspaces.activatePlan(workspaceId, plan, Number(req.body?.months) || 1, String(req.body?.provider || 'webhook'), req.body);
    res.json({ ok: true, workspace });
  }));

  // ----- Arquivos e painel de mídias -----
  app.post('/api/uploads', requireAuth, express.raw({ type: () => true, limit: '26mb' }), wrap((req, res) => {
    const name = decodeURIComponent(req.get('x-file-name') || 'arquivo');
    const attachment = files.save(req.user.id, { buffer: req.body, mime: req.get('content-type'), name, duration: req.get('x-duration') });
    res.status(201).json({ attachment });
  }));
  app.get('/files/:id/:key', (req, res, next) => {
    try {
      const a = files.open(req.params.id, req.params.key);
      res.setHeader('content-type', a.mime);
      res.setHeader('content-length', a.size);
      res.setHeader('cache-control', 'private, max-age=31536000, immutable');
      res.setHeader('content-disposition', `${a.kind === 'document' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(a.name)}`);
      a.stream().pipe(res);
    } catch (err) { next(err); }
  });
  app.get('/api/chats/:id/media', requireAuth, wrap((req, res) => { chats.access(req.params.id, req.user.id); res.json(files.mediaHub(req.params.id)); }));
  app.patch('/api/attachments/:id', requireAuth, wrap((req, res) => {
    const a = files.get(req.params.id);
    if (!a) throw httpError(404, 'Arquivo não encontrado.');
    if (a.chat_id) chats.access(a.chat_id, req.user.id); else if (a.owner_id !== req.user.id) throw httpError(404, 'Arquivo não encontrado.');
    res.json({ attachment: files.updateTags(req.params.id, req.body || {}) });
  }));
  app.post('/api/attachments/:id/transcribe', requireAuth, wrap(async (req, res) => {
    const a = files.get(req.params.id);
    if (!a) throw httpError(404, 'Áudio não encontrado.');
    if (a.chat_id) chats.access(a.chat_id, req.user.id); else if (a.owner_id !== req.user.id) throw httpError(404, 'Áudio não encontrado.');
    const attachment = await files.transcribe(req.params.id);
    if (a.chat_id) io.to(room(a.chat_id)).emit('attachment:updated', { attachment });
    res.json({ attachment });
  }));

  // ----- API pública para robôs e integrações (n8n, Typebot, Make, LangChain) -----
  function requireApiKey(req, res, next) {
    const key = req.get('x-api-key') || (req.get('authorization') || '').replace(/^Bearer /, '');
    const w = workspaces.authenticateApiKey(key);
    if (!w) return next(httpError(401, 'Chave de API inválida ou plano expirado.'));
    req.workspace = w;
    req.botUser = chats.userById(w.business_user_id);
    next();
  }
  function publicConversation(chat) {
    return {
      id: chat.id,
      customer: chat.peer ? { id: chat.peer.id, handle: chat.peer.handle, name: chat.peer.name, avatar: chat.peer.avatar } : null,
      status: chat.ticket?.status,
      assigneeId: chat.ticket?.assigneeId || null,
      botPaused: Boolean(chat.ticket?.botPaused),
      tags: chat.ticket?.tags || [],
      unread: chat.unread || 0,
      lastMessage: chat.lastMessage ? publicMessage(chat.lastMessage) : null,
      createdAt: chat.createdAt,
    };
  }
  function publicMessage(m) {
    return { id: m.id, conversationId: m.chatId, from: m.senderId, agentId: m.agentId, type: m.type, text: m.body, attachment: m.attachment ? { url: m.attachment.url, mime: m.attachment.mime, name: m.attachment.name, transcript: m.attachment.transcript } : null, createdAt: m.createdAt };
  }
  const v1 = express.Router();
  v1.use(requireApiKey);
  // Garante que a conversa pertence à empresa da chave.
  function requireBotChat(req) {
    const chat = chats.rawChat(req.params.id);
    if (!chat || !chats.memberIds(chat.id).includes(req.botUser.id)) throw httpError(404, 'Conversa não encontrada.');
    return chat;
  }
  v1.get('/me', (req, res) => res.json({ workspace: { id: req.workspace.id, domain: req.workspace.domain, name: req.workspace.name, plan: req.workspace.plan }, botUser: publicUser(req.botUser) }));
  v1.get('/conversations', (req, res) => {
    const board = chats.board(req.workspace.id, req.workspace.owner_id);
    const wanted = req.query.status && TICKET_STATUSES.includes(req.query.status) ? [req.query.status] : TICKET_STATUSES;
    res.json({ conversations: wanted.flatMap((st) => board[st]).map(publicConversation) });
  });
  v1.get('/conversations/:id', wrap((req, res) => requireBotChat(req) && res.json({ conversation: publicConversation(chats.getChat(req.workspace.owner_id, req.params.id)) })));
  v1.get('/conversations/:id/messages', wrap((req, res) => {
    res.json({ messages: chats.listMessages(req.workspace.owner_id, req.params.id, req.query).map(publicMessage) });
  }));
  v1.post('/conversations/:id/messages', wrap(async (req, res) => {
    const chat = requireBotChat(req);
    const message = await deliver(req.workspace.owner_id, chat.id, { type: 'text', body: req.body?.text ?? req.body?.body }, { fromBot: true });
    res.status(201).json({ message: publicMessage(message) });
  }));
  v1.post('/conversations/:id/handoff', wrap((req, res) => {
    requireBotChat(req);
    const to = req.body?.to === 'bot' ? 'bot' : 'human';
    chats.updateTicket(null, req.params.id, { botPaused: to === 'human', status: to === 'human' ? 'in_progress' : undefined }, { byApi: true });
    const message = chats.systemMessage(req.params.id, to === 'human' ? 'O assistente pediu um atendente humano' : 'Atendimento devolvido ao assistente automático');
    io.to(room(req.params.id)).emit('chat:updated', { chatId: req.params.id });
    io.to(room(req.params.id)).emit('message:new', { message });
    res.json({ conversation: publicConversation(chats.getChat(req.workspace.owner_id, req.params.id)) });
  }));
  v1.patch('/conversations/:id', wrap((req, res) => {
    requireBotChat(req);
    chats.updateTicket(null, req.params.id, req.body || {}, { byApi: true });
    io.to(room(req.params.id)).emit('chat:updated', { chatId: req.params.id });
    res.json({ conversation: publicConversation(chats.getChat(req.workspace.owner_id, req.params.id)) });
  }));
  app.use('/api/v1', v1);

  app.get('/api/health', (req, res) => res.json({ ok: true, name: 'ZapLivre', time: Date.now() }));

  // ----- Arquivos estáticos (PWA) -----
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir, { extensions: ['html'] }));
  app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));
  app.get(/^\/(?!api\/|files\/|docs\/).*/, (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Arquivo muito grande.' });
    const status = err.status || 500;
    if (status >= 500) logger.error(err);
    res.status(status).json({ error: status >= 500 ? 'Erro interno.' : err.message });
  });

  // ----- Tempo real -----
  const room = (chatId) => 'chat:' + chatId;
  const userRoom = (userId) => 'user:' + userId;
  const online = new Map();

  // Envia a mensagem, avisa todos em tempo real e dispara o webhook do robô quando for o caso.
  async function deliver(userId, chatId, payload, { fromBot = false } = {}) {
    const message = chats.sendMessage(userId, chatId, payload, { asBot: fromBot });
    io.to(room(chatId)).emit('message:new', { message, clientId: payload.clientId || null });
    const chat = chats.rawChat(chatId);
    if (chat.category === 'desk' && !chat.bot_paused) {
      const sender = chats.userById(message.senderId);
      if (sender?.kind === 'person') {
        const view = chats.getChat(userId, chatId);
        fireWebhook(view.business?.workspaceId, 'message.received', { conversation: publicConversation(view), message: publicMessage(message) });
      }
    }
    return message;
  }

  function fireWebhook(workspaceId, event, data) {
    if (!workspaceId) return;
    const w = workspaces.raw(workspaceId);
    if (!w?.webhook_url) return;
    workspaces.deliverWebhook(w, event, data).catch((err) => logger.error('webhook:', err.message));
  }

  function notifyChatCreated(chatId, exceptUserId) {
    for (const uid of chats.audienceIds(chatId)) {
      joinUserToRoom(uid, chatId);
      if (uid !== exceptUserId) io.to(userRoom(uid)).emit('chat:new', { chatId });
    }
  }
  function joinUserToRoom(userId, chatId) {
    for (const sid of io.sockets.adapter.rooms.get(userRoom(userId)) || []) io.sockets.sockets.get(sid)?.join(room(chatId));
  }
  function leaveUserFromRoom(userId, chatId) {
    for (const sid of io.sockets.adapter.rooms.get(userRoom(userId)) || []) io.sockets.sockets.get(sid)?.leave(room(chatId));
  }
  function joinAgentToWorkspaceRooms(handle, workspace) {
    const agent = workspace.members.find((m) => m.username === String(handle || '').replace(/^@/, '').toLowerCase());
    if (!agent) return;
    for (const chat of chats.listChats(agent.id)) joinUserToRoom(agent.id, chat.id);
    io.to(userRoom(agent.id)).emit('workspace:updated', { workspaceId: workspace.id });
  }
  function broadcastToPeers(userId, event, data) {
    for (const chat of chats.listChats(userId)) io.to(room(chat.id)).emit(event, data);
  }

  io.use((socket, next) => {
    const user = auth.authenticate(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(userRoom(user.id));
    for (const chat of chats.listChats(user.id)) socket.join(room(chat.id));

    online.set(user.id, (online.get(user.id) || 0) + 1);
    broadcastToPeers(user.id, 'presence', { userId: user.id, online: true });

    const delivered = chats.markAllDelivered(user.id);
    const byChat = new Map();
    for (const d of delivered) byChat.set(d.chatId, [...(byChat.get(d.chatId) || []), d.messageId]);
    for (const [chatId, messageIds] of byChat) io.to(room(chatId)).emit('message:delivered', { chatId, messageIds, userId: user.id });

    socket.on('message:send', async (payload, ack) => {
      try {
        const message = await deliver(user.id, String(payload?.chatId || ''), payload || {});
        ack?.({ ok: true, message, clientId: payload?.clientId });
      } catch (err) {
        ack?.({ ok: false, error: err.message, clientId: payload?.clientId });
      }
    });
    socket.on('chat:read', (payload) => {
      try {
        const actorId = chats.markChatRead(user.id, String(payload?.chatId || ''));
        io.to(room(payload.chatId)).emit('chat:read', { chatId: payload.chatId, userId: actorId });
      } catch { /* ignora */ }
    });
    socket.on('typing', (payload) => {
      const chatId = String(payload?.chatId || '');
      if (!chatId) return;
      socket.to(room(chatId)).emit('typing', { chatId, userId: user.id, name: user.name, typing: Boolean(payload?.typing) });
    });
    socket.on('presence:who', (ack) => {
      const ids = new Set();
      for (const chat of chats.listChats(user.id)) for (const m of chat.members) if (online.has(m.id)) ids.add(m.id);
      ack?.([...ids]);
    });
    socket.on('disconnect', () => {
      const n = (online.get(user.id) || 1) - 1;
      if (n <= 0) {
        online.delete(user.id);
        chats.touchLastSeen(user.id);
        broadcastToPeers(user.id, 'presence', { userId: user.id, online: false, lastSeen: Date.now() });
      } else online.set(user.id, n);
    });
  });

  return { app, server, io, db, close: () => new Promise((r) => { io.close(); server.close(() => { db.close(); r(); }); }) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const { server } = createApp();
  server.listen(port, () => console.log(`ZapLivre rodando em http://localhost:${port}`));
}
