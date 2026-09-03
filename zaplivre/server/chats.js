// Regras de negócio de conversas, grupos e mensagens.
import { now, newId, normalizePhone } from './db.js';
import { httpError, publicUser } from './auth.js';

const MAX_TEXT = 4000;
const MAX_IMAGE_DATA_URL = 1_500_000; // ~1,1 MB de imagem em base64
const MAX_GROUP_MEMBERS = 256;

export function createChatService(db) {
  const s = {
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
    updateProfile: db.prepare('UPDATE users SET name = ?, about = ?, avatar = ? WHERE id = ?'),
    touchLastSeen: db.prepare('UPDATE users SET last_seen = ? WHERE id = ?'),
    directByKey: db.prepare("SELECT * FROM chats WHERE type = 'direct' AND direct_key = ?"),
    insertChat: db.prepare('INSERT INTO chats (id, type, name, avatar, direct_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    insertMember: db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'),
    removeMember: db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?'),
    member: db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?'),
    members: db.prepare(
      `SELECT u.*, m.role, m.joined_at FROM chat_members m JOIN users u ON u.id = m.user_id WHERE m.chat_id = ? ORDER BY m.joined_at`
    ),
    memberIds: db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?'),
    chatById: db.prepare('SELECT * FROM chats WHERE id = ?'),
    updateGroup: db.prepare('UPDATE chats SET name = ?, avatar = ? WHERE id = ?'),
    chatsForUser: db.prepare(
      `SELECT c.*, m.last_read_at, m.role,
        (SELECT COUNT(*) FROM messages x WHERE x.chat_id = c.id AND x.created_at > m.last_read_at AND x.sender_id != m.user_id AND x.deleted_at IS NULL) AS unread
       FROM chats c JOIN chat_members m ON m.chat_id = c.id WHERE m.user_id = ?`
    ),
    lastMessage: db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at DESC, id DESC LIMIT 1'),
    insertMessage: db.prepare('INSERT INTO messages (id, chat_id, sender_id, type, body, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    messageById: db.prepare('SELECT * FROM messages WHERE id = ?'),
    messagesBefore: db.prepare(
      'SELECT * FROM messages WHERE chat_id = ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT ?'
    ),
    softDelete: db.prepare("UPDATE messages SET deleted_at = ?, body = '' WHERE id = ? AND sender_id = ?"),
    insertReceipt: db.prepare('INSERT OR IGNORE INTO message_receipts (message_id, user_id) VALUES (?, ?)'),
    markDelivered: db.prepare(
      `UPDATE message_receipts SET delivered_at = ? WHERE user_id = ? AND delivered_at IS NULL
        AND message_id IN (SELECT id FROM messages WHERE chat_id = ?)`
    ),
    markRead: db.prepare(
      `UPDATE message_receipts SET read_at = ?, delivered_at = COALESCE(delivered_at, ?) WHERE user_id = ? AND read_at IS NULL
        AND message_id IN (SELECT id FROM messages WHERE chat_id = ? AND sender_id != ?)`
    ),
    setLastRead: db.prepare('UPDATE chat_members SET last_read_at = ? WHERE chat_id = ? AND user_id = ?'),
    receiptSummary: db.prepare(
      `SELECT message_id, COUNT(*) AS total, SUM(delivered_at IS NOT NULL) AS delivered, SUM(read_at IS NOT NULL) AS read
       FROM message_receipts WHERE message_id IN (SELECT id FROM messages WHERE chat_id = ?) GROUP BY message_id`
    ),
    receiptForMessage: db.prepare(
      'SELECT COUNT(*) AS total, SUM(delivered_at IS NOT NULL) AS delivered, SUM(read_at IS NOT NULL) AS read FROM message_receipts WHERE message_id = ?'
    ),
    pendingDelivery: db.prepare(
      `SELECT r.message_id, m.chat_id, m.sender_id FROM message_receipts r JOIN messages m ON m.id = r.message_id
       WHERE r.user_id = ? AND r.delivered_at IS NULL`
    ),
    usersByPhones: (phones) =>
      db.prepare(`SELECT * FROM users WHERE phone IN (${phones.map(() => '?').join(',')})`).all(...phones),
  };

  function requireMember(chatId, userId) {
    const m = s.member.get(chatId, userId);
    if (!m) throw httpError(404, 'Conversa não encontrada.');
    return m;
  }

  function memberIds(chatId) {
    return s.memberIds.all(chatId).map((r) => r.user_id);
  }

  function updateProfile(userId, { name, about, avatar }) {
    const u = s.userById.get(userId);
    const cleanName = String(name ?? u.name).trim().slice(0, 40) || u.name;
    const cleanAbout = String(about ?? u.about).trim().slice(0, 140);
    const cleanAvatar = validateImage(avatar === undefined ? u.avatar : avatar);
    s.updateProfile.run(cleanName, cleanAbout, cleanAvatar, userId);
    return publicUser(s.userById.get(userId));
  }

  function syncContacts(phones) {
    const normalized = [...new Set((Array.isArray(phones) ? phones : []).map(normalizePhone).filter(Boolean))].slice(0, 5000);
    if (!normalized.length) return [];
    return s.usersByPhones(normalized).map(publicUser);
  }

  function lookupUserByPhone(rawPhone) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw httpError(400, 'Número de telefone inválido.');
    const u = s.userByPhone.get(phone);
    if (!u) throw httpError(404, 'Esse número ainda não está no ZapLivre.');
    return u;
  }

  function openDirectChat(userId, rawPhone) {
    const other = lookupUserByPhone(rawPhone);
    if (other.id === userId) throw httpError(400, 'Você não pode conversar consigo mesmo.');
    const key = [userId, other.id].sort().join(':');
    let chat = s.directByKey.get(key);
    let created = false;
    if (!chat) {
      const id = newId();
      db.exec('BEGIN');
      try {
        s.insertChat.run(id, 'direct', null, null, key, userId, now());
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
    return { chat: chatView(chat, userId), created };
  }

  function createGroup(userId, { name, memberPhones = [], memberIds: ids = [] }) {
    const cleanName = String(name || '').trim().slice(0, 60);
    if (!cleanName) throw httpError(400, 'Dê um nome ao grupo.');
    const others = new Set();
    for (const p of memberPhones) {
      const u = s.userByPhone.get(normalizePhone(p) || '');
      if (u && u.id !== userId) others.add(u.id);
    }
    for (const id of ids) {
      if (id !== userId && s.userById.get(id)) others.add(id);
    }
    if (others.size + 1 > MAX_GROUP_MEMBERS) throw httpError(400, `Grupos têm no máximo ${MAX_GROUP_MEMBERS} participantes.`);
    const chatId = newId();
    db.exec('BEGIN');
    try {
      s.insertChat.run(chatId, 'group', cleanName, null, null, userId, now());
      s.insertMember.run(chatId, userId, 'admin', now());
      for (const id of others) s.insertMember.run(chatId, id, 'member', now());
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    const creator = s.userById.get(userId);
    const sys = appendMessage(chatId, null, { type: 'system', body: `${creator.name} criou o grupo "${cleanName}"` }, { skipCheck: true });
    return { chat: chatView(s.chatById.get(chatId), userId), message: sys };
  }

  function updateGroup(userId, chatId, { name, avatar }) {
    const m = requireMember(chatId, userId);
    const chat = s.chatById.get(chatId);
    if (chat.type !== 'group') throw httpError(400, 'Só grupos podem ser editados.');
    if (m.role !== 'admin') throw httpError(403, 'Só administradores podem editar o grupo.');
    const cleanName = String(name ?? chat.name).trim().slice(0, 60) || chat.name;
    s.updateGroup.run(cleanName, validateImage(avatar === undefined ? chat.avatar : avatar), chatId);
    return chatView(s.chatById.get(chatId), userId);
  }

  function addGroupMember(userId, chatId, rawPhone) {
    const m = requireMember(chatId, userId);
    const chat = s.chatById.get(chatId);
    if (chat.type !== 'group') throw httpError(400, 'Só grupos têm participantes.');
    if (m.role !== 'admin') throw httpError(403, 'Só administradores podem adicionar participantes.');
    const other = lookupUserByPhone(rawPhone);
    if (memberIds(chatId).length >= MAX_GROUP_MEMBERS) throw httpError(400, 'Grupo cheio.');
    s.insertMember.run(chatId, other.id, 'member', now());
    const actor = s.userById.get(userId);
    const message = appendMessage(chatId, null, { type: 'system', body: `${actor.name} adicionou ${other.name}` }, { skipCheck: true });
    return { chat: chatView(chat, userId), message, addedUserId: other.id };
  }

  function leaveGroup(userId, chatId) {
    requireMember(chatId, userId);
    const chat = s.chatById.get(chatId);
    if (chat.type !== 'group') throw httpError(400, 'Não é possível sair de uma conversa individual.');
    const actor = s.userById.get(userId);
    s.removeMember.run(chatId, userId);
    const remaining = memberIds(chatId);
    let message = null;
    if (remaining.length) {
      // Garante que sempre exista um administrador.
      const hasAdmin = s.members.all(chatId).some((u) => u.role === 'admin');
      if (!hasAdmin) db.prepare("UPDATE chat_members SET role = 'admin' WHERE chat_id = ? AND user_id = ?").run(chatId, remaining[0]);
      message = appendMessage(chatId, null, { type: 'system', body: `${actor.name} saiu do grupo` }, { skipCheck: true });
    }
    return { remaining, message };
  }

  function chatView(chat, viewerId) {
    const membersRaw = s.members.all(chat.id);
    const members = membersRaw.map((u) => ({ ...publicUser(u), role: u.role }));
    let name = chat.name;
    let avatar = chat.avatar;
    let peer = null;
    if (chat.type === 'direct') {
      peer = members.find((u) => u.id !== viewerId) || members[0];
      name = peer?.name || 'Contato';
      avatar = peer?.avatar || null;
    }
    const last = s.lastMessage.get(chat.id);
    const mine = membersRaw.find((u) => u.id === viewerId);
    return {
      id: chat.id,
      type: chat.type,
      name,
      avatar,
      peer,
      members,
      role: mine?.role || 'member',
      createdAt: chat.created_at,
      lastMessage: last ? messageView(last) : null,
      unread: 0,
    };
  }

  function listChats(userId) {
    return s.chatsForUser
      .all(userId)
      .map((row) => ({ ...chatView(row, userId), unread: row.unread }))
      .sort((a, b) => (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt));
  }

  function getChat(userId, chatId) {
    requireMember(chatId, userId);
    return chatView(s.chatById.get(chatId), userId);
  }

  function messageView(m, receipts) {
    const r = receipts || s.receiptForMessage.get(m.id);
    const total = Number(r?.total || 0);
    let status = 'sent';
    if (total > 0 && Number(r.read) >= total) status = 'read';
    else if (total > 0 && Number(r.delivered) >= total) status = 'delivered';
    return {
      id: m.id,
      chatId: m.chat_id,
      senderId: m.sender_id,
      type: m.type,
      body: m.deleted_at ? '' : m.body,
      replyTo: m.reply_to,
      createdAt: m.created_at,
      deleted: Boolean(m.deleted_at),
      status,
    };
  }

  function listMessages(userId, chatId, { before, limit = 50 } = {}) {
    requireMember(chatId, userId);
    const cursor = Number(before) || Number.MAX_SAFE_INTEGER;
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const rows = s.messagesBefore.all(chatId, cursor, lim);
    const receipts = new Map(s.receiptSummary.all(chatId).map((r) => [r.message_id, r]));
    return rows.reverse().map((m) => messageView(m, receipts.get(m.id) || { total: 0 }));
  }

  function appendMessage(chatId, senderId, { type = 'text', body, replyTo = null }, { skipCheck = false } = {}) {
    if (!skipCheck) requireMember(chatId, senderId);
    let cleanBody;
    if (type === 'text' || type === 'system') {
      cleanBody = String(body ?? '').trim();
      if (!cleanBody) throw httpError(400, 'Mensagem vazia.');
      if (cleanBody.length > MAX_TEXT) throw httpError(400, 'Mensagem muito longa.');
    } else if (type === 'image') {
      cleanBody = validateImage(body);
      if (!cleanBody) throw httpError(400, 'Imagem inválida.');
    } else {
      throw httpError(400, 'Tipo de mensagem inválido.');
    }
    if (replyTo) {
      const parent = s.messageById.get(replyTo);
      if (!parent || parent.chat_id !== chatId) throw httpError(400, 'Mensagem respondida não existe.');
    }
    const id = newId();
    const ts = now();
    db.exec('BEGIN');
    try {
      s.insertMessage.run(id, chatId, senderId, type, cleanBody, replyTo || null, ts);
      if (senderId) {
        for (const uid of memberIds(chatId)) {
          if (uid !== senderId) s.insertReceipt.run(id, uid);
        }
        s.setLastRead.run(ts, chatId, senderId);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return messageView(s.messageById.get(id));
  }

  function deleteMessage(userId, messageId) {
    const m = s.messageById.get(messageId);
    if (!m || m.sender_id !== userId) throw httpError(404, 'Mensagem não encontrada.');
    s.softDelete.run(now(), messageId, userId);
    return messageView(s.messageById.get(messageId));
  }

  // Marca como entregue tudo que estava pendente para o usuário (ao reconectar).
  function markAllDelivered(userId) {
    const pending = s.pendingDelivery.all(userId);
    if (!pending.length) return [];
    db.prepare('UPDATE message_receipts SET delivered_at = ? WHERE user_id = ? AND delivered_at IS NULL').run(now(), userId);
    return pending.map((p) => ({ messageId: p.message_id, chatId: p.chat_id, senderId: p.sender_id }));
  }

  function markChatRead(userId, chatId) {
    requireMember(chatId, userId);
    const ts = now();
    s.markRead.run(ts, ts, userId, chatId, userId);
    s.setLastRead.run(ts, chatId, userId);
  }

  function touchLastSeen(userId) {
    s.touchLastSeen.run(now(), userId);
  }

  return {
    updateProfile,
    syncContacts,
    openDirectChat,
    createGroup,
    updateGroup,
    addGroupMember,
    leaveGroup,
    listChats,
    getChat,
    listMessages,
    appendMessage,
    deleteMessage,
    markAllDelivered,
    markChatRead,
    memberIds,
    touchLastSeen,
    userById: (id) => publicUser(s.userById.get(id)),
  };
}

function validateImage(dataUrl) {
  if (dataUrl == null || dataUrl === '') return null;
  if (typeof dataUrl !== 'string') return null;
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return null;
  if (dataUrl.length > MAX_IMAGE_DATA_URL) return null;
  return dataUrl;
}
