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
import { buildStorage } from './storage.js';
import { createPushService } from './push.js';
import { createInviteService } from './invites.js';
import { createTabService } from './tabs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({
  dbFile = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'zaplivre.db'),
  uploadDir = process.env.UPLOAD_DIR || path.join(path.dirname(dbFile === ':memory:' ? path.join(__dirname, '..', 'data', 'x') : dbFile), 'uploads'),
  storage = buildStorage(process.env, { uploadDir }),
  devShowOtp = process.env.DEV_SHOW_OTP === '1',
  smsWebhookUrl = process.env.SMS_WEBHOOK_URL || '',
  // 'invite' = piloto sem SMS contratado. 'open' = telefone + código por SMS.
  accessMode = process.env.ACCESS_MODE === 'invite' ? 'invite' : 'open',
  adminUsernames = (process.env.ADMIN_USERNAMES || '').split(',').map((x) => x.trim()).filter(Boolean),
  pushSender,
  billingSecret = process.env.BILLING_WEBHOOK_SECRET || '',
  transcriber = buildTranscriber(process.env),
  dnsResolver,
  logger = console,
} = {}) {
  const db = openDatabase(dbFile);
  const invites = createInviteService(db, { logger });
  const auth = createAuth(db, { devShowOtp, smsWebhookUrl, accessMode, invites, adminUsernames, logger });
  const push = createPushService(db, { logger, send: pushSender });
  const bootstrapInvite = accessMode === 'invite' ? invites.bootstrap() : null;
  const workspaces = createWorkspaceService(db, { dnsResolver, logger });
  const files = createFileService(db, { storage, transcriber, logger });
  const tabs = createTabService(db, { logger });
  const chats = createChatService(db, { workspaces, files, tabs });

  const app = express();
  app.disable('x-powered-by');
  // Confiar em UM proxy, não em todos. Com `true`, qualquer cliente poderia
  // forjar o X-Forwarded-For e furar o limite de tentativas, que é contado por
  // IP. O 1 corresponde ao porteiro do docker-compose; atrás de mais camadas,
  // ajuste o número.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
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
    res.json(await auth.requestOtp(req.body?.phone, { invite: req.body?.invite }));
  }));
  app.get('/api/auth/username-available', (req, res) => res.json(auth.usernameAvailable(req.query.u)));
  app.post('/api/auth/verify', wrap((req, res) => {
    if (!rateLimit('verify:' + req.ip, 30, 900000)) throw httpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
    res.json(auth.verifyOtp(req.body?.phone, req.body?.code, { name: req.body?.name, username: req.body?.username, invite: req.body?.invite }));
  }));
  app.post('/api/auth/logout', requireAuth, (req, res) => { auth.logout(req.token); res.json({ ok: true }); });
  // Novo código de recuperação para quem perdeu o antigo. Invalida o anterior.
  app.post('/api/auth/recovery', requireAuth, wrap((req, res) => res.json({ recoveryCode: auth.rotateRecovery(req.user) })));

  // O cliente precisa saber como é a entrada neste servidor e a chave de notificação.
  app.get('/api/config', (req, res) => res.json({
    accessMode: auth.accessMode,
    inviteRequired: auth.inviteMode,
    pushPublicKey: push.publicKey,
    encryptionNotice: 'Ainda não há criptografia de ponta a ponta: quem opera o servidor consegue ler as mensagens.',
  }));

  // ----- Convites (piloto) -----
  function requireAdmin(req, res, next) {
    if (!req.user?.is_admin) return next(httpError(403, 'Só quem administra o servidor pode emitir convites.'));
    next();
  }
  app.get('/api/invites/:code', wrap((req, res) => {
    if (!rateLimit('convite:' + req.ip, 30, 600000)) throw httpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
    res.json(invites.check(req.params.code));
  }));
  app.get('/api/invites', requireAuth, requireAdmin, (req, res) => res.json({ invites: invites.list() }));
  app.post('/api/invites', requireAuth, requireAdmin, wrap((req, res) => res.status(201).json({ invite: invites.create(req.user.id, req.body || {}) })));
  app.delete('/api/invites/:code', requireAuth, requireAdmin, wrap((req, res) => res.json(invites.revoke(req.params.code))));

  // ----- Notificação com o aplicativo fechado -----
  app.post('/api/push/subscribe', requireAuth, wrap((req, res) => {
    res.json(push.subscribe(req.user.id, req.body?.subscription || req.body, req.get('user-agent') || ''));
  }));
  app.post('/api/push/unsubscribe', requireAuth, wrap((req, res) => res.json(push.unsubscribe(req.user.id, req.body?.endpoint))));

  // ----- Busca de mensagens -----
  app.get('/api/search', requireAuth, wrap((req, res) => {
    res.json({ results: chats.searchMessages(req.user.id, req.query.q, { chatId: req.query.chatId || null, limit: req.query.limit }) });
  }));

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
  // `category` e `tabKey` são o mesmo campo; o nome antigo segue aceito.
  app.patch('/api/chats/:id/category', requireAuth, wrap((req, res) => {
    const alvo = req.body?.tabKey !== undefined ? req.body.tabKey : (req.body?.category ?? null);
    res.json({ chat: chats.setMyTab(req.user.id, req.params.id, alvo) });
  }));
  app.patch('/api/chats/:id/tab', requireAuth, wrap((req, res) => {
    res.json({ chat: chats.setMyTab(req.user.id, req.params.id, req.body?.tabKey ?? null) });
  }));

  // ----- Abas (Plano Cômodos) -----
  app.get('/api/tabs', requireAuth, (req, res) => res.json(tabs.listFor(req.user.id)));
  app.post('/api/tabs/:key', requireAuth, wrap((req, res) => {
    const r = tabs.setEnabled(req.user.id, req.params.key, req.body?.enabled !== false);
    if (!r.ok) throw httpError(400, r.reason);
    res.json(r.tabs);
  }));
  app.post('/api/tabs', requireAuth, wrap((req, res) => res.json(tabs.reorder(req.user.id, req.body?.order))));
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
  // Reagir, encaminhar e organizar a lista.
  app.post('/api/messages/:id/react', requireAuth, wrap((req, res) => {
    const message = chats.react(req.user.id, req.params.id, req.body?.emoji);
    io.to(room(message.chatId)).emit('message:updated', { message });
    res.json({ message });
  }));
  app.post('/api/messages/:id/forward', requireAuth, wrap(async (req, res) => {
    const enviadas = chats.forward(req.user.id, req.params.id, req.body?.chatIds);
    for (const m of enviadas) {
      io.to(room(m.chatId)).emit('message:new', { message: m });
      notifyByPush(m, m.chatId, req.user.id).catch(() => {});
    }
    res.status(201).json({ messages: enviadas });
  }));
  app.post('/api/chats/:id/pin', requireAuth, wrap((req, res) => res.json({ chat: chats.setPinned(req.user.id, req.params.id, req.body?.pinned !== false) })));
  app.post('/api/chats/:id/mute', requireAuth, wrap((req, res) => res.json({ chat: chats.setMuted(req.user.id, req.params.id, req.body?.hours) })));
  app.post('/api/chats/:id/archive', requireAuth, wrap((req, res) => res.json({ chat: chats.setArchived(req.user.id, req.params.id, req.body?.archived !== false) })));
  app.post('/api/chats/:id/ephemeral', requireAuth, wrap((req, res) => {
    const { chat, message } = chats.setEphemeral(req.user.id, req.params.id, req.body?.seconds);
    io.to(room(chat.id)).emit('message:new', { message });
    io.to(room(chat.id)).emit('chat:updated', { chatId: chat.id });
    res.json({ chat });
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
  // 61mb cobre o limite de vídeo (60 MB) com folga. O corte de verdade, por
  // tipo de arquivo, é feito em files.save com mensagem clara; este aqui só
  // impede que o corpo da requisição cresça sem limite.
  app.post('/api/uploads', requireAuth, express.raw({ type: () => true, limit: '61mb' }), wrap(async (req, res) => {
    const name = decodeURIComponent(req.get('x-file-name') || 'arquivo');
    const attachment = await files.save(req.user.id, { buffer: req.body, mime: req.get('content-type'), name, duration: req.get('x-duration') });
    res.status(201).json({ attachment });
  }));
  app.get('/files/:id/:key', wrap(async (req, res, next) => {
    const a = files.open(req.params.id, req.params.key);
    // O fluxo é aberto antes dos cabeçalhos: se o arquivo sumiu, a resposta é um erro limpo.
    const stream = await a.stream();
    res.setHeader('content-type', a.mime);
    res.setHeader('content-length', a.size);
    res.setHeader('cache-control', 'private, max-age=31536000, immutable');
    res.setHeader('content-disposition', `${a.kind === 'document' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(a.name)}`);
    stream.once('error', (err) => {
      if (res.headersSent) return res.destroy(err);
      for (const h of ['content-type', 'content-length', 'cache-control', 'content-disposition']) res.removeHeader(h);
      next(err);
    });
    res.once('close', () => stream.destroy());
    stream.pipe(res);
  }));
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
    notifyByPush(message, chatId, userId).catch((err) => logger.error?.('push:', err.message));
    const chat = chats.rawChat(chatId);
    if (chat.tab_key === 'desk' && !chat.bot_paused) {
      const sender = chats.userById(message.senderId);
      if (sender?.kind === 'person') {
        const view = chats.getChat(userId, chatId);
        fireWebhook(view.business?.workspaceId, 'message.received', { conversation: publicConversation(view), message: publicMessage(message) });
      }
    }
    return message;
  }

  // Quem está com o aplicativo aberto e visível já vê a mensagem na tela; para os
  // demais, este é o único caminho que entrega o aviso. Sem ele a mensagem fica
  // parada até a pessoa abrir o aplicativo de novo.
  async function notifyByPush(message, chatId, senderId) {
    const audience = chats.audienceIds(chatId).filter((id) => id !== message.senderId && id !== senderId);
    if (!audience.length) return;
    const sender = chats.userById(message.senderId);
    const chat = chats.rawChat(chatId);
    const isGroup = chat.type === 'group';
    const title = isGroup ? (chat.name || 'Grupo') : (sender?.name || 'Nova mensagem');
    const prefix = isGroup && sender?.name ? `${sender.name}: ` : '';
    const body = prefix + previewOf(message);

    await Promise.all(audience.map((uid) => {
      if (isVisibleSomewhere(uid)) return null; // já está vendo o aplicativo
      if (chats.getChat(uid, chatId)?.muted) return null; // conversa silenciada
      return push.sendToUser(uid, { title, body, chatId, messageId: message.id, tag: 'chat:' + chatId });
    }));
  }

  function previewOf(message) {
    if (message.deleted) return 'Mensagem apagada';
    switch (message.type) {
      case 'image': return '📷 Foto';
      case 'video': return '🎬 Vídeo';
      case 'location': return '📍 Localização';
      case 'audio': return '🎤 Áudio';
      case 'document': return '📎 ' + (message.attachment?.name || 'Documento');
      default: return String(message.body || '').slice(0, 140) || 'Nova mensagem';
    }
  }

  // Verdadeiro se alguma aba desta pessoa está aberta e em primeiro plano.
  function isVisibleSomewhere(userId) {
    for (const sid of io.sockets.adapter.rooms.get(userRoom(userId)) || []) {
      if (io.sockets.sockets.get(sid)?.data?.visible) return true;
    }
    return false;
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
    // O cliente avisa quando está em primeiro plano, para não receber aviso de
    // notificação do sistema por cima de uma mensagem que já apareceu na tela.
    socket.data.visible = true;
    socket.on('presence:focus', (payload) => {
      socket.data.visible = Boolean(payload?.visible);
      socket.data.activeChatId = payload?.chatId ? String(payload.chatId) : null;
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

  // Relógio das mensagens temporárias: some mesmo de quem não abrir a conversa.
  const sweeper = setInterval(() => {
    try {
      for (const { id, chat_id: chatId } of chats.sweepExpired()) {
        io.to(room(chatId)).emit('message:deleted', { message: { id, chatId, deleted: true, body: '' } });
      }
    } catch (err) { logger.error?.('expira:', err.message); }
  }, 30000);
  sweeper.unref?.();

  return { app, server, io, db, bootstrapInvite, close: () => new Promise((r) => { clearInterval(sweeper); io.close(); server.close(() => { db.close(); r(); }); }) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const { server } = createApp();
  server.listen(port, () => console.log(`ZapLivre rodando em http://localhost:${port}`));
}
