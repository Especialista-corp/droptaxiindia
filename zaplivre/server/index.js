// ZapLivre - servidor HTTP + WebSocket.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { openDatabase } from './db.js';
import { createAuth, httpError, publicUser } from './auth.js';
import { createChatService } from './chats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({
  dbFile = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'zaplivre.db'),
  devShowOtp = process.env.DEV_SHOW_OTP === '1',
  smsWebhookUrl = process.env.SMS_WEBHOOK_URL || '',
  logger = console,
} = {}) {
  const db = openDatabase(dbFile);
  const auth = createAuth(db, { devShowOtp, smsWebhookUrl, logger });
  const chats = createChatService(db);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  const server = http.createServer(app);
  const io = new SocketServer(server, { maxHttpBufferSize: 2_000_000 });

  // Rate limit simples em memória para pedidos de código (por IP e por telefone).
  const otpBuckets = new Map();
  function rateLimit(key, limit, windowMs) {
    const t = Date.now();
    const bucket = otpBuckets.get(key)?.filter((x) => x > t - windowMs) || [];
    if (bucket.length >= limit) return false;
    bucket.push(t);
    otpBuckets.set(key, bucket);
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
  app.post(
    '/api/auth/request-code',
    wrap(async (req, res) => {
      const ip = req.ip || 'ip';
      if (!rateLimit('ip:' + ip, 20, 60 * 60 * 1000) || !rateLimit('phone:' + req.body?.phone, 5, 15 * 60 * 1000)) {
        throw httpError(429, 'Muitos pedidos. Aguarde alguns minutos.');
      }
      res.json(await auth.requestOtp(req.body?.phone));
    })
  );

  app.post(
    '/api/auth/verify',
    wrap((req, res) => {
      res.json(auth.verifyOtp(req.body?.phone, req.body?.code, req.body?.name));
    })
  );

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    auth.logout(req.token);
    res.json({ ok: true });
  });

  // ----- Perfil e contatos -----
  app.get('/api/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

  app.patch(
    '/api/me',
    requireAuth,
    wrap((req, res) => {
      const user = chats.updateProfile(req.user.id, req.body || {});
      broadcastToPeers(req.user.id, 'user:updated', { user });
      res.json({ user });
    })
  );

  app.post('/api/contacts/sync', requireAuth, (req, res) => {
    res.json({ users: chats.syncContacts(req.body?.phones) });
  });

  // ----- Conversas -----
  app.get('/api/chats', requireAuth, (req, res) => res.json({ chats: chats.listChats(req.user.id) }));

  app.post(
    '/api/chats/direct',
    requireAuth,
    wrap((req, res) => {
      const { chat, created } = chats.openDirectChat(req.user.id, req.body?.phone);
      if (created) notifyChatCreated(chat.id, req.user.id);
      res.status(created ? 201 : 200).json({ chat });
    })
  );

  app.post(
    '/api/chats/group',
    requireAuth,
    wrap((req, res) => {
      const { chat, message } = chats.createGroup(req.user.id, req.body || {});
      notifyChatCreated(chat.id, null);
      io.to(room(chat.id)).emit('message:new', { message });
      res.status(201).json({ chat });
    })
  );

  app.get('/api/chats/:id', requireAuth, wrap((req, res) => res.json({ chat: chats.getChat(req.user.id, req.params.id) })));

  app.patch(
    '/api/chats/:id',
    requireAuth,
    wrap((req, res) => {
      const chat = chats.updateGroup(req.user.id, req.params.id, req.body || {});
      io.to(room(chat.id)).emit('chat:updated', { chatId: chat.id });
      res.json({ chat });
    })
  );

  app.post(
    '/api/chats/:id/members',
    requireAuth,
    wrap((req, res) => {
      const { chat, message, addedUserId } = chats.addGroupMember(req.user.id, req.params.id, req.body?.phone);
      joinUserToRoom(addedUserId, chat.id);
      io.to(room(chat.id)).emit('chat:updated', { chatId: chat.id });
      io.to(room(chat.id)).emit('message:new', { message });
      res.json({ chat });
    })
  );

  app.post(
    '/api/chats/:id/leave',
    requireAuth,
    wrap((req, res) => {
      const { message } = chats.leaveGroup(req.user.id, req.params.id);
      leaveUserFromRoom(req.user.id, req.params.id);
      if (message) {
        io.to(room(req.params.id)).emit('chat:updated', { chatId: req.params.id });
        io.to(room(req.params.id)).emit('message:new', { message });
      }
      res.json({ ok: true });
    })
  );

  // ----- Mensagens -----
  app.get(
    '/api/chats/:id/messages',
    requireAuth,
    wrap((req, res) => {
      res.json({ messages: chats.listMessages(req.user.id, req.params.id, req.query) });
    })
  );

  app.post(
    '/api/chats/:id/messages',
    requireAuth,
    wrap((req, res) => {
      const message = sendMessage(req.user.id, req.params.id, req.body || {});
      res.status(201).json({ message });
    })
  );

  app.post(
    '/api/chats/:id/read',
    requireAuth,
    wrap((req, res) => {
      chats.markChatRead(req.user.id, req.params.id);
      io.to(room(req.params.id)).emit('chat:read', { chatId: req.params.id, userId: req.user.id });
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/messages/:id',
    requireAuth,
    wrap((req, res) => {
      const message = chats.deleteMessage(req.user.id, req.params.id);
      io.to(room(message.chatId)).emit('message:deleted', { message });
      res.json({ message });
    })
  );

  app.get('/api/health', (req, res) => res.json({ ok: true, name: 'ZapLivre', time: Date.now() }));

  // ----- Arquivos estáticos (PWA) -----
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir, { extensions: ['html'] }));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  // ----- Erros -----
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Arquivo muito grande.' });
    const status = err.status || 500;
    if (status >= 500) logger.error(err);
    res.status(status).json({ error: status >= 500 ? 'Erro interno.' : err.message });
  });

  // ----- Tempo real -----
  const room = (chatId) => 'chat:' + chatId;
  const userRoom = (userId) => 'user:' + userId;
  const online = new Map(); // userId -> quantidade de sockets

  function sendMessage(userId, chatId, payload) {
    const message = chats.appendMessage(chatId, userId, payload);
    io.to(room(chatId)).emit('message:new', { message, clientId: payload.clientId || null });
    return message;
  }

  function notifyChatCreated(chatId, exceptUserId) {
    for (const uid of chats.memberIds(chatId)) {
      joinUserToRoom(uid, chatId);
      if (uid !== exceptUserId) io.to(userRoom(uid)).emit('chat:new', { chatId });
    }
  }

  function joinUserToRoom(userId, chatId) {
    for (const socket of io.sockets.adapter.rooms.get(userRoom(userId)) || []) {
      io.sockets.sockets.get(socket)?.join(room(chatId));
    }
  }

  function leaveUserFromRoom(userId, chatId) {
    for (const socket of io.sockets.adapter.rooms.get(userRoom(userId)) || []) {
      io.sockets.sockets.get(socket)?.leave(room(chatId));
    }
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

    // Entrega tudo que ficou pendente enquanto o usuário estava offline.
    const delivered = chats.markAllDelivered(user.id);
    const byChat = new Map();
    for (const d of delivered) byChat.set(d.chatId, [...(byChat.get(d.chatId) || []), d.messageId]);
    for (const [chatId, messageIds] of byChat) io.to(room(chatId)).emit('message:delivered', { chatId, messageIds, userId: user.id });

    socket.on('message:send', (payload, ack) => {
      try {
        const message = sendMessage(user.id, String(payload?.chatId || ''), payload || {});
        ack?.({ ok: true, message, clientId: payload?.clientId });
      } catch (err) {
        ack?.({ ok: false, error: err.message, clientId: payload?.clientId });
      }
    });

    socket.on('chat:read', (payload) => {
      try {
        chats.markChatRead(user.id, String(payload?.chatId || ''));
        io.to(room(payload.chatId)).emit('chat:read', { chatId: payload.chatId, userId: user.id });
      } catch {
        /* ignora */
      }
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
      } else {
        online.set(user.id, n);
      }
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
