// Regras de negócio: conversas, grupos, mensagens, abas (social/trabalho/atendimento), tickets e antispam.
import { now, newId, normalizePhone, normalizeUsername } from './db.js';
import { httpError, publicUser } from './auth.js';

const MAX_TEXT = 4000;
const MAX_IMAGE_DATA_URL = 1_500_000;
const MAX_GROUP_MEMBERS = 256;
export const CATEGORIES = ['social', 'work', 'desk'];
export const TICKET_STATUSES = ['open', 'in_progress', 'done'];

export function createChatService(db, { workspaces, files }) {
  ensureColumn('chat_members', 'category', 'TEXT');

  function ensureColumn(table, column, def) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }

  const s = {
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByPhone: db.prepare("SELECT * FROM users WHERE phone = ? AND kind = 'person'"),
    userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    updateProfile: db.prepare('UPDATE users SET name = ?, about = ?, avatar = ?, discoverable_by_phone = ? WHERE id = ?'),
    touchLastSeen: db.prepare('UPDATE users SET last_seen = ? WHERE id = ?'),
    directByKey: db.prepare("SELECT * FROM chats WHERE type = 'direct' AND direct_key = ?"),
    insertChat: db.prepare('INSERT INTO chats (id, type, category, name, avatar, direct_key, workspace_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    insertMember: db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'),
    removeMember: db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?'),
    member: db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?'),
    members: db.prepare('SELECT u.*, m.role, m.joined_at FROM chat_members m JOIN users u ON u.id = m.user_id WHERE m.chat_id = ? ORDER BY m.joined_at'),
    memberIds: db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?'),
    chatById: db.prepare('SELECT * FROM chats WHERE id = ?'),
    updateGroup: db.prepare('UPDATE chats SET name = ?, avatar = ?, category = ? WHERE id = ?'),
    setMemberCategory: db.prepare('UPDATE chat_members SET category = ? WHERE chat_id = ? AND user_id = ?'),
    setTicket: db.prepare('UPDATE chats SET ticket_status = ?, assignee_id = ?, tags = ?, bot_paused = ? WHERE id = ?'),
    setAdmin: db.prepare("UPDATE chat_members SET role = 'admin' WHERE chat_id = ? AND user_id = ?"),
    chatsForUser: db.prepare(
      `SELECT c.*, m.last_read_at, m.role, m.category AS member_category, m.user_id AS viewer_member_id,
        m.pinned_at, m.muted_until, m.archived,
        (SELECT COUNT(*) FROM messages x WHERE x.chat_id = c.id AND x.created_at > m.last_read_at AND x.sender_id != m.user_id AND x.deleted_at IS NULL AND x.type != 'system') AS unread
       FROM chats c JOIN chat_members m ON m.chat_id = c.id WHERE m.user_id = ?`
    ),
    lastMessage: db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at DESC, id DESC LIMIT 1'),
    insertMessage: db.prepare('INSERT INTO messages (id, chat_id, sender_id, agent_id, type, body, attachment_id, reply_to, forwarded, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    reactionsFor: db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id = ?'),
    setReaction: db.prepare(`INSERT INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(message_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at`),
    clearReaction: db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ?'),
    setPinned: db.prepare('UPDATE chat_members SET pinned_at = ? WHERE chat_id = ? AND user_id = ?'),
    setMuted: db.prepare('UPDATE chat_members SET muted_until = ? WHERE chat_id = ? AND user_id = ?'),
    setArchived: db.prepare('UPDATE chat_members SET archived = ? WHERE chat_id = ? AND user_id = ?'),
    setEphemeral: db.prepare('UPDATE chats SET ephemeral_seconds = ? WHERE id = ?'),
    expiredMessages: db.prepare("SELECT id, chat_id FROM messages WHERE expires_at IS NOT NULL AND expires_at <= ? AND deleted_at IS NULL"),
    messageById: db.prepare('SELECT * FROM messages WHERE id = ?'),
    chatIdsOfMember: db.prepare('SELECT chat_id FROM chat_members WHERE user_id = ?'),
    messagesBefore: db.prepare('SELECT * FROM messages WHERE chat_id = ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT ?'),
    softDelete: db.prepare("UPDATE messages SET deleted_at = ?, body = '' WHERE id = ?"),
    insertReceipt: db.prepare('INSERT OR IGNORE INTO message_receipts (message_id, user_id) VALUES (?, ?)'),
    markRead: db.prepare(
      `UPDATE message_receipts SET read_at = ?, delivered_at = COALESCE(delivered_at, ?) WHERE user_id = ? AND read_at IS NULL
        AND message_id IN (SELECT id FROM messages WHERE chat_id = ? AND sender_id != ?)`
    ),
    setLastRead: db.prepare('UPDATE chat_members SET last_read_at = ? WHERE chat_id = ? AND user_id = ?'),
    receiptSummary: db.prepare(
      `SELECT message_id, COUNT(*) AS total, SUM(delivered_at IS NOT NULL) AS delivered, SUM(read_at IS NOT NULL) AS read
       FROM message_receipts WHERE message_id IN (SELECT id FROM messages WHERE chat_id = ?) GROUP BY message_id`
    ),
    receiptForMessage: db.prepare('SELECT COUNT(*) AS total, SUM(delivered_at IS NOT NULL) AS delivered, SUM(read_at IS NOT NULL) AS read FROM message_receipts WHERE message_id = ?'),
    pendingDelivery: db.prepare(
      `SELECT r.message_id, m.chat_id, m.sender_id FROM message_receipts r JOIN messages m ON m.id = r.message_id WHERE r.user_id = ? AND r.delivered_at IS NULL`
    ),
    markAllDelivered: db.prepare('UPDATE message_receipts SET delivered_at = ? WHERE user_id = ? AND delivered_at IS NULL'),
    sentLastHour: db.prepare('SELECT COUNT(*) AS n FROM messages WHERE sender_id = ? AND created_at > ?'),
    block: db.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)'),
    unblock: db.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?'),
    isBlocked: db.prepare('SELECT 1 FROM blocks WHERE user_id = ? AND blocked_id = ?'),
    blockedIds: db.prepare('SELECT blocked_id FROM blocks WHERE user_id = ?'),
    workspaceChats: db.prepare(
      `SELECT c.*, m.last_read_at, m.role, NULL AS member_category, m.user_id AS viewer_member_id,
        (SELECT COUNT(*) FROM messages x WHERE x.chat_id = c.id AND x.created_at > m.last_read_at AND x.sender_id != m.user_id AND x.deleted_at IS NULL AND x.type != 'system') AS unread
       FROM chats c JOIN chat_members m ON m.chat_id = c.id WHERE m.user_id = ?`
    ),
    usersByPhones: (phones) => db.prepare(`SELECT * FROM users WHERE kind = 'person' AND discoverable_by_phone = 1 AND phone IN (${phones.map(() => '?').join(',')})`).all(...phones),
  };

  // ---------- acesso ----------
  // Um agente de empresa acessa as conversas do usuário-empresa do seu workspace.
  function access(chatId, userId) {
    const chat = s.chatById.get(chatId);
    if (!chat) throw httpError(404, 'Conversa não encontrada.');
    const direct = s.member.get(chatId, userId);
    if (direct) return { chat, actorId: userId, agentId: null, viaWorkspace: null };
    for (const u of s.members.all(chatId)) {
      if (u.kind === 'business' && u.workspace_id && workspaces.isMember(u.workspace_id, userId)) {
        return { chat, actorId: u.id, agentId: userId, viaWorkspace: u.workspace_id };
      }
    }
    throw httpError(404, 'Conversa não encontrada.');
  }

  function memberIds(chatId) {
    return s.memberIds.all(chatId).map((r) => r.user_id);
  }

  // Todos que devem receber eventos da conversa: membros + agentes das empresas presentes.
  function audienceIds(chatId) {
    const ids = new Set(memberIds(chatId));
    for (const u of s.members.all(chatId)) if (u.kind === 'business' && u.workspace_id) for (const a of workspaces.memberIds(u.workspace_id)) ids.add(a);
    return [...ids];
  }

  // ---------- perfil e descoberta ----------
  function updateProfile(userId, { name, about, avatar, discoverableByPhone }) {
    const u = s.userById.get(userId);
    const cleanName = String(name ?? u.name).trim().slice(0, 40) || u.name;
    const cleanAbout = String(about ?? u.about).trim().slice(0, 140);
    const cleanAvatar = validateImage(avatar === undefined ? u.avatar : avatar);
    const disc = discoverableByPhone === undefined ? u.discoverable_by_phone : discoverableByPhone ? 1 : 0;
    s.updateProfile.run(cleanName, cleanAbout, cleanAvatar, disc, userId);
    return s.userById.get(userId);
  }

  function syncContacts(phones) {
    const normalized = [...new Set((Array.isArray(phones) ? phones : []).map(normalizePhone).filter(Boolean))].slice(0, 5000);
    if (!normalized.length) return [];
    return s.usersByPhones(normalized).map(publicUser);
  }

  // Descoberta: @usuario, @dominio da empresa, ou telefone (só de quem permitiu).
  function findUser({ handle, phone }) {
    if (handle) {
      const h = String(handle).trim().replace(/^@/, '').toLowerCase();
      const u = s.userByUsername.get(h) || s.userByUsername.get(normalizeUsername(h) || '');
      if (!u) throw httpError(404, `@${h} não foi encontrado no ZapLivre.`);
      return u;
    }
    const p = normalizePhone(phone);
    if (!p) throw httpError(400, 'Informe um @usuário ou telefone válido.');
    const u = s.userByPhone.get(p);
    if (!u || !u.discoverable_by_phone) throw httpError(404, 'Esse número não está no ZapLivre ou não permite ser encontrado.');
    return u;
  }

  function openDirectChat(userId, target) {
    const me = s.userById.get(userId);
    if (me.kind !== 'person') throw httpError(403, 'Empresas não iniciam conversas: só respondem a quem as procurou.');
    const other = findUser(target);
    if (other.id === userId) throw httpError(400, 'Você não pode conversar consigo mesmo.');
    if (s.isBlocked.get(other.id, userId)) throw httpError(403, 'Não foi possível iniciar a conversa.');
    const category = other.kind === 'business' ? 'desk' : 'social';
    const key = [userId, other.id].sort().join(':');
    let chat = s.directByKey.get(key);
    let created = false;
    if (!chat) {
      const id = newId();
      db.exec('BEGIN');
      try {
        s.insertChat.run(id, 'direct', category, null, null, key, other.workspace_id || null, userId, now());
        s.insertMember.run(id, userId, 'member', now());
        s.insertMember.run(id, other.id, 'member', now());
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      chat = s.chatById.get(id);
      created = true;
    }
    return { chat: chatView(chat, userId), created, business: other.kind === 'business' ? other : null };
  }

  function createGroup(userId, { name, category = 'social', memberPhones = [], memberHandles = [], memberIds: ids = [] }) {
    const cleanName = String(name || '').trim().slice(0, 60);
    if (!cleanName) throw httpError(400, 'Dê um nome ao grupo.');
    const cat = category === 'work' ? 'work' : 'social';
    const others = new Set();
    for (const p of memberPhones) {
      const u = s.userByPhone.get(normalizePhone(p) || '');
      if (u && u.discoverable_by_phone && u.id !== userId) others.add(u.id);
    }
    for (const h of memberHandles) {
      const u = s.userByUsername.get(String(h).trim().replace(/^@/, '').toLowerCase());
      if (u && u.kind === 'person' && u.id !== userId) others.add(u.id);
    }
    for (const id of ids) {
      const u = s.userById.get(id);
      if (u && u.kind === 'person' && id !== userId) others.add(id);
    }
    if (others.size + 1 > MAX_GROUP_MEMBERS) throw httpError(400, `Grupos têm no máximo ${MAX_GROUP_MEMBERS} participantes.`);
    const chatId = newId();
    db.exec('BEGIN');
    try {
      s.insertChat.run(chatId, 'group', cat, cleanName, null, null, null, userId, now());
      s.insertMember.run(chatId, userId, 'admin', now());
      for (const id of others) s.insertMember.run(chatId, id, 'member', now());
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    const creator = s.userById.get(userId);
    const message = systemMessage(chatId, `${creator.name} criou o grupo "${cleanName}"`);
    return { chat: chatView(s.chatById.get(chatId), userId), message };
  }

  function updateGroup(userId, chatId, { name, avatar, category }) {
    const { chat } = access(chatId, userId);
    const m = s.member.get(chatId, userId);
    if (chat.type !== 'group') throw httpError(400, 'Só grupos podem ser editados.');
    if (m?.role !== 'admin') throw httpError(403, 'Só administradores podem editar o grupo.');
    const cleanName = String(name ?? chat.name).trim().slice(0, 60) || chat.name;
    const cat = category && ['social', 'work'].includes(category) ? category : chat.category;
    s.updateGroup.run(cleanName, validateImage(avatar === undefined ? chat.avatar : avatar), cat, chatId);
    return chatView(s.chatById.get(chatId), userId);
  }

  // Aba por usuário: cada pessoa pode mover uma conversa entre Social e Trabalho só para si.
  function setMyCategory(userId, chatId, category) {
    const { chat } = access(chatId, userId);
    if (chat.category === 'desk') throw httpError(400, 'Conversas com empresas ficam sempre em Atendimento.');
    if (!s.member.get(chatId, userId)) throw httpError(403, 'Você não participa desta conversa.');
    const cat = category === null || category === chat.category ? null : category;
    if (cat && !['social', 'work'].includes(cat)) throw httpError(400, 'Aba inválida.');
    s.setMemberCategory.run(cat, chatId, userId);
    return getChat(userId, chatId);
  }

  function addGroupMember(userId, chatId, target) {
    const { chat } = access(chatId, userId);
    const m = s.member.get(chatId, userId);
    if (chat.type !== 'group') throw httpError(400, 'Só grupos têm participantes.');
    if (m?.role !== 'admin') throw httpError(403, 'Só administradores podem adicionar participantes.');
    const other = findUser(target);
    if (other.kind !== 'person') throw httpError(400, 'Empresas não entram em grupos.');
    if (memberIds(chatId).length >= MAX_GROUP_MEMBERS) throw httpError(400, 'Grupo cheio.');
    s.insertMember.run(chatId, other.id, 'member', now());
    const actor = s.userById.get(userId);
    const message = systemMessage(chatId, `${actor.name} adicionou ${other.name}`);
    return { chat: chatView(chat, userId), message, addedUserId: other.id };
  }

  function leaveGroup(userId, chatId) {
    const { chat } = access(chatId, userId);
    if (chat.type !== 'group') throw httpError(400, 'Não é possível sair de uma conversa individual.');
    const actor = s.userById.get(userId);
    s.removeMember.run(chatId, userId);
    const remaining = memberIds(chatId);
    let message = null;
    if (remaining.length) {
      if (!s.members.all(chatId).some((u) => u.role === 'admin')) s.setAdmin.run(chatId, remaining[0]);
      message = systemMessage(chatId, `${actor.name} saiu do grupo`);
    }
    return { remaining, message };
  }

  // ---------- bloqueio (antispam do lado do usuário) ----------
  function block(userId, targetId) {
    if (!s.userById.get(targetId) || targetId === userId) throw httpError(400, 'Usuário inválido.');
    s.block.run(userId, targetId, now());
  }
  function unblock(userId, targetId) {
    s.unblock.run(userId, targetId);
  }
  function blockedIds(userId) {
    return s.blockedIds.all(userId).map((r) => r.blocked_id);
  }

  // ---------- visões ----------
  function chatView(chat, viewerId, { viewerMemberId = null, memberCategory = null } = {}) {
    // A linha pode vir da consulta da lista (já traz os campos) ou de chats
    // puro; neste caso busca-se a visão de quem está olhando.
    const meu = chat.viewer_member_id === (viewerMemberId || viewerId)
      ? chat
      : s.member.get(chat.id, viewerMemberId || viewerId) || {};
    const membersRaw = s.members.all(chat.id);
    const members = membersRaw.map((u) => ({ ...publicUser(u), role: u.role }));
    let name = chat.name;
    let avatar = chat.avatar;
    let peer = null;
    if (chat.type === 'direct') {
      const selfId = viewerMemberId || viewerId;
      peer = members.find((u) => u.id !== selfId) || members[0];
      name = peer?.name || 'Contato';
      avatar = peer?.avatar || null;
    }
    const last = s.lastMessage.get(chat.id);
    const mine = membersRaw.find((u) => u.id === (viewerMemberId || viewerId));
    const business = members.find((u) => u.kind === 'business');
    return {
      id: chat.id,
      type: chat.type,
      category: memberCategory || chat.category,
      name,
      avatar,
      peer,
      members,
      role: mine?.role || 'member',
      createdAt: chat.created_at,
      lastMessage: last ? messageView(last) : null,
      unread: 0,
      business: business ? { id: business.id, workspaceId: business.workspaceId, handle: business.handle, name: business.name } : null,
      ticket: chat.category === 'desk' ? { status: chat.ticket_status, assigneeId: chat.assignee_id, botPaused: Boolean(chat.bot_paused), tags: JSON.parse(chat.tags || '[]') } : null,
      blocked: peer ? Boolean(s.isBlocked.get(viewerId, peer.id)) : false,
      pinned: Boolean(meu.pinned_at),
      muted: Boolean(meu.muted_until && meu.muted_until > now()),
      mutedUntil: meu.muted_until && meu.muted_until > now() ? meu.muted_until : null,
      archived: Boolean(meu.archived),
      ephemeralSeconds: chat.ephemeral_seconds || 0,
    };
  }

  // Lista do usuário: suas conversas + (se for agente) as conversas das empresas em que atende.
  function listChats(userId) {
    const out = s.chatsForUser.all(userId).map((row) => ({ ...chatView(row, userId, { memberCategory: row.member_category }), unread: row.unread }));
    const seen = new Set(out.map((c) => c.id));
    for (const w of workspaces.listForUser(userId)) {
      const bu = w.businessUser;
      if (!bu) continue;
      for (const row of s.workspaceChats.all(bu.id)) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push({ ...chatView(row, userId, { viewerMemberId: bu.id }), unread: row.unread, viaWorkspace: w.id, actingAs: bu.id });
      }
    }
    return out.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt);
    });
  }

  function getChat(userId, chatId) {
    const a = access(chatId, userId);
    const v = chatView(a.chat, userId, { viewerMemberId: a.actorId, memberCategory: s.member.get(chatId, userId)?.category || null });
    return a.viaWorkspace ? { ...v, viaWorkspace: a.viaWorkspace, actingAs: a.actorId } : v;
  }

  function messageView(m, receipts) {
    const r = receipts || s.receiptForMessage.get(m.id);
    const total = Number(r?.total || 0);
    let status = 'sent';
    if (total > 0 && Number(r.read) >= total) status = 'read';
    else if (total > 0 && Number(r.delivered) >= total) status = 'delivered';
    const attachment = m.attachment_id ? files.view(files.get(m.attachment_id)) : null;
    return {
      id: m.id,
      chatId: m.chat_id,
      senderId: m.sender_id,
      agentId: m.agent_id,
      agentName: m.agent_id ? s.userById.get(m.agent_id)?.name || null : null,
      type: m.type,
      body: m.deleted_at ? '' : m.body,
      attachment: m.deleted_at ? null : attachment,
      replyTo: m.reply_to,
      forwarded: Boolean(m.forwarded),
      expiresAt: m.expires_at || null,
      reactions: reactionsOf(m.id),
      createdAt: m.created_at,
      deleted: Boolean(m.deleted_at),
      status,
    };
  }

  // --- Busca de mensagens -------------------------------------------------
  // Usa o índice de texto do SQLite (ver buildSearchIndex em db.js). O filtro de
  // permissão é feito pelas conversas de que a pessoa participa, incluindo as
  // conversas das empresas em que ela atende.
  function visibleChatIds(userId) {
    const ids = new Set(s.chatIdsOfMember.all(userId).map((r) => r.chat_id));
    for (const w of workspaces.listForUser(userId)) {
      if (!w.businessUser) continue;
      for (const r of s.chatIdsOfMember.all(w.businessUser.id)) ids.add(r.chat_id);
    }
    return ids;
  }

  // Monta a expressão do FTS5 a partir do que a pessoa digitou, sem deixar
  // passar a sintaxe do próprio FTS (aspas, NEAR, parênteses).
  function buildMatch(raw) {
    const tokens = String(raw || '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 2)
      .slice(0, 8);
    if (!tokens.length) return null;
    return tokens.map((t, i) => (i === tokens.length - 1 ? `"${t}"*` : `"${t}"`)).join(' ');
  }

  function searchMessages(userId, raw, { chatId = null, limit = 40 } = {}) {
    const match = buildMatch(raw);
    if (!match) return [];
    const lim = Math.min(Math.max(Number(limit) || 40, 1), 100);

    let allowed;
    if (chatId) {
      access(chatId, userId); // lança se não puder ver
      allowed = new Set([chatId]);
    } else {
      allowed = visibleChatIds(userId);
    }
    if (!allowed.size) return [];

    const ids = [...allowed].slice(0, 900);
    const placeholders = ids.map(() => '?').join(',');
    let rows;
    try {
      rows = db.prepare(`
        SELECT message_id, chat_id, snippet(messages_fts, 2, '[', ']', '…', 14) AS snippet
        FROM messages_fts
        WHERE messages_fts MATCH ? AND chat_id IN (${placeholders})
        ORDER BY rank
        LIMIT ?
      `).all(match, ...ids, lim);
    } catch {
      return []; // expressão que o FTS recusou: trata como "nada encontrado"
    }

    return rows.map((r) => {
      const m = s.messageById.get(r.message_id);
      if (!m) return null;
      const chat = s.chatById.get(r.chat_id);
      const a = access(r.chat_id, userId);
      const view = chatView(chat, userId, { viewerMemberId: a.actorId });
      return {
        chatId: r.chat_id,
        chatName: view.name,
        chatCategory: view.category,
        chatAvatar: view.avatar,
        snippet: r.snippet,
        message: messageView(m),
      };
    }).filter(Boolean);
  }

  function listMessages(userId, chatId, { before, limit = 50 } = {}) {
    access(chatId, userId);
    const cursor = Number(before) || Number.MAX_SAFE_INTEGER;
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const rows = s.messagesBefore.all(chatId, cursor, lim);
    const receipts = new Map(s.receiptSummary.all(chatId).map((r) => [r.message_id, r]));
    return rows.reverse().map((m) => messageView(m, receipts.get(m.id) || { total: 0 }));
  }

  function systemMessage(chatId, body) {
    return insert(chatId, null, null, { type: 'system', body });
  }

  // Envio por usuário (pessoa, ou agente falando pela empresa).
  function sendMessage(userId, chatId, { type = 'text', body, attachmentId = null, replyTo = null, forwarded = false }, { asBot = false } = {}) {
    const a = access(chatId, userId);
    const { chat, actorId } = a;
    const agentId = asBot ? null : a.agentId;
    const actor = s.userById.get(actorId);
    if (actor.kind === 'business') enforceBusinessLimits(actor, chat);
    // Bloqueio: quem foi bloqueado não consegue enviar.
    for (const u of s.members.all(chatId)) if (u.id !== actorId && s.isBlocked.get(u.id, actorId)) throw httpError(403, 'Você não pode enviar mensagens para este contato.');
    return insert(chatId, actorId, agentId, { type, body, attachmentId, replyTo, forwarded });
  }

  // Empresas só respondem: precisam de conversa aberta pela pessoa e respeitam o limite por hora do plano.
  function enforceBusinessLimits(businessUser, chat) {
    if (chat.type !== 'direct') throw httpError(403, 'Empresas só conversam em atendimentos individuais.');
    const w = workspaces.raw(businessUser.workspace_id);
    const plan = workspaces.planOf(w);
    const n = s.sentLastHour.get(businessUser.id, now() - 3600000).n;
    if (n >= plan.sendsPerHour) throw httpError(429, `Limite do plano: ${plan.sendsPerHour} mensagens por hora.`);
  }

  function insert(chatId, senderId, agentId, { type = 'text', body, attachmentId = null, replyTo = null, forwarded = false }) {
    let cleanBody;
    let attId = null;
    if (type === 'text' || type === 'system') {
      cleanBody = String(body ?? '').trim();
      if (!cleanBody) throw httpError(400, 'Mensagem vazia.');
      if (cleanBody.length > MAX_TEXT) throw httpError(400, 'Mensagem muito longa.');
    } else if (type === 'location') {
      cleanBody = validateLocation(body);
      if (!cleanBody) throw httpError(400, 'Localização inválida.');
    } else if (['image', 'video', 'audio', 'document'].includes(type)) {
      if (attachmentId) {
        const a = files.get(attachmentId);
        if (!a || (a.chat_id && a.chat_id !== chatId)) throw httpError(400, 'Anexo inválido.');
        if (a.owner_id !== senderId && a.owner_id !== agentId) throw httpError(400, 'Anexo inválido.');
        if (a.kind !== type) throw httpError(400, 'Tipo do anexo não confere.');
        files.attachToChat(attachmentId, chatId);
        attId = attachmentId;
        cleanBody = String(body || '').trim().slice(0, 1000);
      } else if (type === 'image') {
        cleanBody = validateImage(body);
        if (!cleanBody) throw httpError(400, 'Imagem inválida.');
      } else {
        throw httpError(400, 'Anexo obrigatório.');
      }
    } else {
      throw httpError(400, 'Tipo de mensagem inválido.');
    }
    if (replyTo) {
      const parent = s.messageById.get(replyTo);
      if (!parent || parent.chat_id !== chatId) throw httpError(400, 'Mensagem respondida não existe.');
    }
    const id = newId();
    const ts = now();
    // Mensagens temporárias: o prazo é o da conversa no momento do envio, e
    // fica gravado na mensagem para uma mudança de prazo não apagar o passado.
    const chatRow = s.chatById.get(chatId);
    const expiresAt = chatRow?.ephemeral_seconds > 0 ? ts + chatRow.ephemeral_seconds * 1000 : null;
    db.exec('BEGIN');
    try {
      s.insertMessage.run(id, chatId, senderId, agentId, type, cleanBody, attId, replyTo || null, forwarded ? 1 : 0, expiresAt, ts);
      if (senderId) {
        for (const uid of memberIds(chatId)) if (uid !== senderId) s.insertReceipt.run(id, uid);
        s.setLastRead.run(ts, chatId, senderId);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return messageView(s.messageById.get(id));
  }

  // Agrupa as reações por emoji: [{ emoji, count, userIds }].
  function reactionsOf(messageId) {
    const rows = s.reactionsFor.all(messageId);
    if (!rows.length) return [];
    const porEmoji = new Map();
    for (const r of rows) {
      const atual = porEmoji.get(r.emoji) || { emoji: r.emoji, count: 0, userIds: [] };
      atual.count += 1;
      atual.userIds.push(r.user_id);
      porEmoji.set(r.emoji, atual);
    }
    return [...porEmoji.values()].sort((a, b) => b.count - a.count);
  }

  // Uma reação por pessoa: reagir de novo com o mesmo emoji desfaz.
  function react(userId, messageId, emoji) {
    const m = s.messageById.get(messageId);
    if (!m) throw httpError(404, 'Mensagem não encontrada.');
    const { actorId } = access(m.chat_id, userId);
    const limpo = normalizeEmoji(emoji);
    const atual = s.reactionsFor.all(messageId).find((r) => r.user_id === actorId);
    if (!limpo || atual?.emoji === limpo) s.clearReaction.run(messageId, actorId);
    else s.setReaction.run(messageId, actorId, limpo, now());
    return messageView(s.messageById.get(messageId));
  }

  // Encaminhar: copia o conteúdo para outra conversa, sem levar junto a
  // resposta nem o histórico de quem falou o quê.
  function forward(userId, messageId, chatIds) {
    const origem = s.messageById.get(messageId);
    if (!origem || origem.deleted_at) throw httpError(404, 'Mensagem não encontrada.');
    access(origem.chat_id, userId); // precisa poder ver o que está encaminhando
    if (origem.type === 'system') throw httpError(400, 'Mensagem do sistema não pode ser encaminhada.');
    const alvos = [...new Set((Array.isArray(chatIds) ? chatIds : [chatIds]).map(String))].slice(0, 20);
    if (!alvos.length) throw httpError(400, 'Escolha ao menos uma conversa.');

    const enviadas = [];
    for (const destino of alvos) {
      // O anexo original é reaproveitado: encaminhar não duplica o arquivo em
      // disco, e por isso o anexo não é amarrado à conversa de destino.
      enviadas.push(sendMessage(userId, destino, {
        type: origem.type,
        body: origem.attachment_id ? origem.body : origem.body,
        attachmentId: origem.attachment_id,
        forwarded: true,
      }));
    }
    return enviadas;
  }

  // Fixar, silenciar e arquivar valem só para quem fez: a conversa do outro
  // continua como estava.
  function setPinned(userId, chatId, pinned) {
    const { actorId } = access(chatId, userId);
    s.setPinned.run(pinned ? now() : null, chatId, actorId);
    return getChat(userId, chatId);
  }
  function setMuted(userId, chatId, horas) {
    const { actorId } = access(chatId, userId);
    const h = Number(horas);
    // 0 desliga o silêncio; -1 silencia para sempre.
    const until = h === 0 ? null : h < 0 ? Number.MAX_SAFE_INTEGER : now() + Math.min(h, 24 * 365) * 3600000;
    s.setMuted.run(until, chatId, actorId);
    return getChat(userId, chatId);
  }
  function setArchived(userId, chatId, archived) {
    const { actorId } = access(chatId, userId);
    s.setArchived.run(archived ? 1 : 0, chatId, actorId);
    return getChat(userId, chatId);
  }

  // Mensagens temporárias: prazo da conversa, valendo para os dois lados.
  const EPHEMERAL_OPTIONS = [0, 86400, 7 * 86400, 90 * 86400];
  function setEphemeral(userId, chatId, seconds) {
    access(chatId, userId);
    const sec = Number(seconds) || 0;
    if (!EPHEMERAL_OPTIONS.includes(sec)) throw httpError(400, 'Prazo inválido.');
    s.setEphemeral.run(sec, chatId);
    const texto = sec === 0 ? 'desligou as mensagens temporárias'
      : sec === 86400 ? 'ligou mensagens temporárias de 24 horas'
      : sec === 7 * 86400 ? 'ligou mensagens temporárias de 7 dias'
      : 'ligou mensagens temporárias de 90 dias';
    const quem = s.userById.get(access(chatId, userId).actorId)?.name || 'Alguém';
    const message = systemMessage(chatId, `${quem} ${texto}.`);
    return { chat: getChat(userId, chatId), message };
  }

  // Varre o que venceu. Chamado por um relógio no servidor, não na leitura, para
  // que a mensagem suma mesmo de quem nunca mais abrir a conversa.
  function sweepExpired() {
    const vencidas = s.expiredMessages.all(now());
    for (const m of vencidas) s.softDelete.run(now(), m.id);
    return vencidas;
  }

  function deleteMessage(userId, messageId) {
    const m = s.messageById.get(messageId);
    if (!m) throw httpError(404, 'Mensagem não encontrada.');
    const { actorId, agentId } = access(m.chat_id, userId);
    const owns = m.sender_id === actorId && (!agentId || !m.agent_id || m.agent_id === agentId);
    if (!owns) throw httpError(403, 'Só quem enviou pode apagar.');
    s.softDelete.run(now(), messageId);
    return messageView(s.messageById.get(messageId));
  }

  function markAllDelivered(userId) {
    const pending = s.pendingDelivery.all(userId);
    if (!pending.length) return [];
    s.markAllDelivered.run(now(), userId);
    return pending.map((p) => ({ messageId: p.message_id, chatId: p.chat_id, senderId: p.sender_id }));
  }

  function markChatRead(userId, chatId) {
    const { actorId } = access(chatId, userId);
    const ts = now();
    s.markRead.run(ts, ts, actorId, chatId, actorId);
    s.setLastRead.run(ts, chatId, actorId);
    return actorId;
  }

  // ---------- atendimento (Desk): tickets, Kanban e passagem robô <-> humano ----------
  function requireDeskAgent(chatId, userId) {
    const a = access(chatId, userId);
    if (a.chat.category !== 'desk' || !a.viaWorkspace) throw httpError(403, 'Só atendentes da empresa podem fazer isso.');
    return a;
  }

  function updateTicket(userId, chatId, { status, assigneeId, tags, botPaused }, { byApi = false } = {}) {
    const a = byApi ? { chat: s.chatById.get(chatId) } : requireDeskAgent(chatId, userId);
    const chat = a.chat;
    if (!chat) throw httpError(404, 'Conversa não encontrada.');
    const st = status && TICKET_STATUSES.includes(status) ? status : chat.ticket_status;
    const asg = assigneeId === undefined ? chat.assignee_id : assigneeId || null;
    const tg = tags === undefined ? chat.tags : JSON.stringify([...new Set((Array.isArray(tags) ? tags : []).map((t) => String(t).trim().slice(0, 30)).filter(Boolean))].slice(0, 10));
    const bp = botPaused === undefined ? chat.bot_paused : botPaused ? 1 : 0;
    s.setTicket.run(st, asg, tg, bp, chatId);
    return s.chatById.get(chatId);
  }

  function takeover(userId, chatId) {
    requireDeskAgent(chatId, userId);
    const agent = s.userById.get(userId);
    updateTicket(userId, chatId, { status: 'in_progress', assigneeId: userId, botPaused: true });
    const message = systemMessage(chatId, `${agent.name} assumiu o atendimento`);
    return { chat: getChat(userId, chatId), message };
  }

  function resumeBot(userId, chatId) {
    requireDeskAgent(chatId, userId);
    updateTicket(userId, chatId, { botPaused: false });
    const message = systemMessage(chatId, 'Atendimento devolvido ao assistente automático');
    return { chat: getChat(userId, chatId), message };
  }

  // Quadro Kanban da empresa.
  function board(workspaceId, userId) {
    if (!workspaces.isMember(workspaceId, userId)) throw httpError(404, 'Empresa não encontrada.');
    const w = workspaces.raw(workspaceId);
    const cols = Object.fromEntries(TICKET_STATUSES.map((st) => [st, []]));
    for (const row of s.workspaceChats.all(w.business_user_id)) {
      const v = { ...chatView(row, userId, { viewerMemberId: w.business_user_id }), unread: row.unread, viaWorkspace: workspaceId, actingAs: w.business_user_id };
      cols[row.ticket_status]?.push(v);
    }
    for (const st of TICKET_STATUSES) cols[st].sort((a, b) => (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt));
    return cols;
  }

  function touchLastSeen(userId) {
    s.touchLastSeen.run(now(), userId);
  }

  return {
    access,
    audienceIds,
    memberIds,
    updateProfile,
    syncContacts,
    findUser,
    openDirectChat,
    createGroup,
    updateGroup,
    setMyCategory,
    addGroupMember,
    leaveGroup,
    block,
    unblock,
    blockedIds,
    listChats,
    getChat,
    listMessages,
    searchMessages,
    sendMessage,
    react,
    forward,
    setPinned,
    setMuted,
    setArchived,
    setEphemeral,
    sweepExpired,
    EPHEMERAL_OPTIONS,
    systemMessage,
    deleteMessage,
    markAllDelivered,
    markChatRead,
    updateTicket,
    takeover,
    resumeBot,
    board,
    touchLastSeen,
    userById: (id) => s.userById.get(id),
    rawChat: (id) => s.chatById.get(id),
  };
}

// Localização: guardada como JSON no corpo da mensagem. O aplicativo não é um
// mapa, só carrega o ponto para abrir no mapa de quem recebe.
// Aceita só um emoji curto: a reação é um símbolo, não um campo de texto.
function normalizeEmoji(raw) {
  const e = String(raw ?? '').trim();
  if (!e) return null;
  if ([...e].length > 3 || e.length > 16) return null;
  if (!/\p{Extended_Pictographic}/u.test(e)) return null;
  return e;
}

function validateLocation(raw) {
  let data = raw;
  if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { return null; } }
  const lat = Number(data?.lat);
  const lng = Number(data?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const label = String(data?.label || '').trim().slice(0, 120);
  return JSON.stringify({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), ...(label ? { label } : {}) });
}

function validateImage(dataUrl) {
  if (dataUrl == null || dataUrl === '') return null;
  if (typeof dataUrl !== 'string') return null;
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return null;
  if (dataUrl.length > MAX_IMAGE_DATA_URL) return null;
  return dataUrl;
}
