// Autenticação: telefone + código (OTP) para verificar a pessoa; identidade pública é o @usuario.
// O telefone nunca é exposto a outros usuários (só serve para verificação e descoberta opcional).
import crypto from 'node:crypto';
import { now, newId, normalizePhone, normalizeUsername, sha256 } from './db.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 dias

export function createAuth(db, { devShowOtp = false, smsWebhookUrl = '', logger = console } = {}) {
  const stmts = {
    upsertOtp: db.prepare(
      `INSERT INTO otps (phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
       ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`
    ),
    getOtp: db.prepare('SELECT * FROM otps WHERE phone = ?'),
    bumpAttempts: db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?'),
    deleteOtp: db.prepare('DELETE FROM otps WHERE phone = ?'),
    getUserByPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
    getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    insertUser: db.prepare('INSERT INTO users (id, phone, username, name, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)'),
    insertSession: db.prepare('INSERT INTO sessions (token, user_id, created_at, last_used) VALUES (?, ?, ?, ?)'),
    getSession: db.prepare(
      `SELECT s.token, s.created_at AS session_created_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
    ),
    touchSession: db.prepare('UPDATE sessions SET last_used = ? WHERE token = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  };

  async function requestOtp(rawPhone) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw httpError(400, 'Número de telefone inválido.');
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    stmts.upsertOtp.run(phone, sha256(phone + ':' + code), now() + OTP_TTL_MS);

    if (smsWebhookUrl) {
      try {
        await fetch(smsWebhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ to: phone, message: `Seu código ZapLivre: ${code}. Ele expira em 5 minutos.` }),
        });
      } catch (err) {
        logger.error('Falha ao enviar SMS:', err.message);
        throw httpError(502, 'Não foi possível enviar o SMS. Tente novamente.');
      }
    } else {
      logger.log(`[OTP] ${phone} -> ${code}`);
    }
    const existing = stmts.getUserByPhone.get(phone);
    return { phone, isNew: !existing, ...(devShowOtp ? { devCode: code } : {}) };
  }

  function usernameAvailable(raw) {
    const username = normalizeUsername(raw);
    if (!username) return { ok: false, reason: 'Use 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado.' };
    if (RESERVED.has(username)) return { ok: false, reason: 'Esse nome é reservado.' };
    if (stmts.getUserByUsername.get(username)) return { ok: false, reason: 'Esse @usuário já está em uso.' };
    return { ok: true, username };
  }

  function verifyOtp(rawPhone, code, { name, username } = {}) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw httpError(400, 'Número de telefone inválido.');
    const row = stmts.getOtp.get(phone);
    if (!row || row.expires_at < now()) throw httpError(400, 'Código expirado. Solicite um novo.');
    if (row.attempts >= OTP_MAX_ATTEMPTS) throw httpError(429, 'Muitas tentativas. Solicite um novo código.');
    const ok = crypto.timingSafeEqual(
      Buffer.from(row.code_hash, 'hex'),
      Buffer.from(sha256(phone + ':' + String(code ?? '').trim()), 'hex')
    );
    if (!ok) {
      stmts.bumpAttempts.run(phone);
      throw httpError(400, 'Código incorreto.');
    }

    let user = stmts.getUserByPhone.get(phone);
    let isNew = false;
    if (!user) {
      const check = usernameAvailable(username);
      if (!check.ok) throw httpError(400, check.reason);
      const cleanName = String(name || '').trim().slice(0, 40) || check.username;
      stmts.insertUser.run(newId(), phone, check.username, cleanName, now(), now());
      user = stmts.getUserByPhone.get(phone);
      isNew = true;
    }
    stmts.deleteOtp.run(phone);
    const token = crypto.randomBytes(32).toString('base64url');
    stmts.insertSession.run(token, user.id, now(), now());
    return { token, user: privateUser(user), isNew };
  }

  function authenticate(token) {
    if (!token) return null;
    const row = stmts.getSession.get(token);
    if (!row) return null;
    if (row.session_created_at + SESSION_TTL_MS < now()) {
      stmts.deleteSession.run(token);
      return null;
    }
    stmts.touchSession.run(now(), token);
    return row;
  }

  function logout(token) {
    stmts.deleteSession.run(token);
  }

  return { requestOtp, verifyOtp, authenticate, logout, usernameAvailable };
}

const RESERVED = new Set(['admin', 'zaplivre', 'suporte', 'support', 'root', 'api', 'ajuda', 'help', 'sistema', 'system']);

// Visão pública de um usuário: SEM telefone. É o que outros usuários e empresas enxergam.
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    handle: u.username ? '@' + u.username : null,
    kind: u.kind || 'person',
    workspaceId: u.workspace_id || null,
    name: u.name,
    about: u.about,
    avatar: u.avatar,
    lastSeen: u.last_seen,
  };
}

// Visão do próprio usuário: inclui telefone e preferências.
export function privateUser(u) {
  if (!u) return null;
  return { ...publicUser(u), phone: u.phone, discoverableByPhone: Boolean(u.discoverable_by_phone) };
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
