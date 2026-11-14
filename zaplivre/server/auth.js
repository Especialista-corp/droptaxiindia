// Autenticação: telefone + código (OTP) para verificar a pessoa; identidade pública é o @usuario.
// O telefone nunca é exposto a outros usuários (só serve para verificação e descoberta opcional).
import crypto from 'node:crypto';
import { now, newId, normalizePhone, normalizeUsername, sha256 } from './db.js';
import { generateRecoveryCode, hashRecovery, normalizeCode } from './invites.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 dias

// accessMode 'open'   -> telefone + código por SMS (produção com SMS contratado).
// accessMode 'invite'  -> entra quem tem convite; quem já tem conta volta com o
//                         código de recuperação. Sem custo de SMS, para o piloto.
export function createAuth(db, { devShowOtp = false, smsWebhookUrl = '', accessMode = 'open', invites = null, adminUsernames = [], logger = console } = {}) {
  const inviteMode = accessMode === 'invite';
  const admins = new Set(adminUsernames.map((u) => String(u).replace(/^@/, '').toLowerCase()).filter(Boolean));
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
    insertUser: db.prepare('INSERT INTO users (id, phone, username, name, recovery_hash, is_admin, invite_code, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    countUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),
    setRecovery: db.prepare('UPDATE users SET recovery_hash = ? WHERE id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token, user_id, created_at, last_used) VALUES (?, ?, ?, ?)'),
    getSession: db.prepare(
      `SELECT s.token, s.created_at AS session_created_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
    ),
    touchSession: db.prepare('UPDATE sessions SET last_used = ? WHERE token = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  };

  async function requestOtp(rawPhone, { invite } = {}) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw httpError(400, 'Número de telefone inválido.');
    const existingUser = stmts.getUserByPhone.get(phone);

    if (inviteMode) {
      // Nada é enviado e nenhum código é gerado: o próprio convite (conta nova)
      // ou o código de recuperação (conta existente) faz o papel do SMS.
      if (existingUser) return { phone, isNew: false, mode: 'invite', needs: 'recovery' };
      const status = invites?.check(invite);
      if (!status?.valid) throw httpError(403, status?.reason || 'É preciso um convite para entrar.');
      return { phone, isNew: true, mode: 'invite', needs: 'invite', note: status.note || '' };
    }

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
    return { phone, isNew: !existingUser, mode: 'sms', ...(devShowOtp ? { devCode: code } : {}) };
  }

  function usernameAvailable(raw) {
    const username = normalizeUsername(raw);
    if (!username) return { ok: false, reason: 'Use 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado.' };
    if (RESERVED.has(username)) return { ok: false, reason: 'Esse nome é reservado.' };
    if (stmts.getUserByUsername.get(username)) return { ok: false, reason: 'Esse @usuário já está em uso.' };
    return { ok: true, username };
  }

  function verifyOtp(rawPhone, code, { name, username, invite } = {}) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw httpError(400, 'Número de telefone inválido.');
    if (inviteMode) return verifyByInvite(phone, code ?? invite, { name, username });
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
    let recoveryCode = null;
    if (!user) {
      const created = createUser(phone, { name, username });
      user = created.user;
      recoveryCode = created.recoveryCode;
      isNew = true;
    }
    stmts.deleteOtp.run(phone);
    return { ...startSession(user), isNew, ...(recoveryCode ? { recoveryCode } : {}) };
  }

  // Caminho do modo convite: o código apresentado é o convite (conta nova) ou o
  // código de recuperação (conta existente).
  function verifyByInvite(phone, rawCode, { name, username } = {}) {
    const user = stmts.getUserByPhone.get(phone);
    const given = String(rawCode ?? '').trim();
    if (!given) throw httpError(400, 'Informe o código.');

    if (user) {
      if (!user.recovery_hash) throw httpError(403, 'Esta conta não tem código de recuperação. Fale com quem administra o servidor.');
      const ok = safeEqualHex(user.recovery_hash, hashRecovery(phone, given));
      if (!ok) throw httpError(400, 'Código de recuperação incorreto.');
      return { ...startSession(user), isNew: false };
    }

    const code = normalizeCode(given);
    if (!code) throw httpError(400, 'Código de convite inválido.');
    // Valida o @usuário ANTES de gastar o convite, para um nome já tomado não
    // queimar o convite de quem está entrando.
    const check = usernameAvailable(username);
    if (!check.ok) throw httpError(400, check.reason);
    const spent = invites?.consume(code, phone);
    if (!spent?.valid) throw httpError(403, spent?.reason || 'Convite inválido.');
    const created = createUser(phone, { name, username, inviteCode: code });
    invites?.linkUser(code, phone, created.user.id);
    return { ...startSession(created.user), isNew: true, recoveryCode: created.recoveryCode };
  }

  function createUser(phone, { name, username, inviteCode = null } = {}) {
    const check = usernameAvailable(username);
    if (!check.ok) throw httpError(400, check.reason);
    const cleanName = String(name || '').trim().slice(0, 40) || check.username;
    const recoveryCode = generateRecoveryCode();
    // A primeira conta do servidor é a de quem administra; as demais, só por
    // ADMIN_USERNAMES. Sem isso ninguém poderia emitir o primeiro convite.
    const isAdmin = stmts.countUsers.get().n === 0 || admins.has(check.username) ? 1 : 0;
    stmts.insertUser.run(newId(), phone, check.username, cleanName, hashRecovery(phone, recoveryCode), isAdmin, inviteCode, now(), now());
    return { user: stmts.getUserByPhone.get(phone), recoveryCode };
  }

  function startSession(user) {
    const token = crypto.randomBytes(32).toString('base64url');
    stmts.insertSession.run(token, user.id, now(), now());
    return { token, user: privateUser(user) };
  }

  // Troca o código de recuperação por um novo, para quem perdeu o antigo.
  function rotateRecovery(user) {
    const recoveryCode = generateRecoveryCode();
    stmts.setRecovery.run(hashRecovery(user.phone, recoveryCode), user.id);
    return recoveryCode;
  }

  function safeEqualHex(a, b) {
    const left = Buffer.from(String(a), 'hex');
    const right = Buffer.from(String(b), 'hex');
    if (left.length !== right.length || left.length === 0) return false;
    return crypto.timingSafeEqual(left, right);
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

  return { requestOtp, verifyOtp, authenticate, logout, usernameAvailable, rotateRecovery, accessMode, inviteMode };
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
  return { ...publicUser(u), phone: u.phone, discoverableByPhone: Boolean(u.discoverable_by_phone), isAdmin: Boolean(u.is_admin) };
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
