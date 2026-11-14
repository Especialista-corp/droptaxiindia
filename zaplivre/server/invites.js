// Modo convite: entrada no piloto sem depender de disparo de SMS contratado.
//
// Por que existe: até aqui o único jeito de entrar sem SMS era o DEV_SHOW_OTP,
// que mostra o código de qualquer telefone na resposta. Em produção isso
// deixaria qualquer pessoa entrar como qualquer outra. O convite resolve sem
// custo: quem tem o código entra, quem não tem fica de fora.
//
// Quem já tem conta volta a entrar com o código de recuperação, mostrado uma
// única vez no cadastro. O caminho de SMS real continua pronto para quando
// houver contrato (ACCESS_MODE=open + SMS_WEBHOOK_URL).
import crypto from 'node:crypto';
import { now, sha256 } from './db.js';

// Sem vogais nem caracteres que se confundem (0/O, 1/I/L), para ditar por telefone.
const ALPHABET = 'BCDFGHJKMNPQRSTVWXYZ23456789';
const CODE_LENGTH = 7;

export function generateCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  return out;
}

export function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === CODE_LENGTH ? c : null;
}

export function createInviteService(db, { logger = console } = {}) {
  function create(createdBy, { note = '', maxUses = 1, expiresInDays = 0 } = {}) {
    const uses = Math.min(Math.max(Number(maxUses) || 1, 1), 500);
    const days = Math.min(Math.max(Number(expiresInDays) || 0, 0), 365);
    let code = generateCode();
    // Colisão é improvável, mas custa pouco conferir.
    for (let i = 0; i < 5 && db.prepare('SELECT 1 FROM invites WHERE code = ?').get(code); i += 1) code = generateCode();
    db.prepare(`
      INSERT INTO invites (code, created_by, note, max_uses, uses, expires_at, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(code, createdBy || null, String(note).slice(0, 120), uses, days ? now() + days * 86400000 : null, now());
    return view(db.prepare('SELECT * FROM invites WHERE code = ?').get(code));
  }

  function list() {
    return db.prepare('SELECT * FROM invites ORDER BY created_at DESC LIMIT 200').all().map(view);
  }

  function revoke(code) {
    const c = normalizeCode(code);
    if (!c) return { ok: false };
    db.prepare('UPDATE invites SET revoked_at = ? WHERE code = ? AND revoked_at IS NULL').run(now(), c);
    return { ok: true };
  }

  // Diz se o código serve, sem gastá-lo. Usado na tela de entrada.
  function check(code) {
    const c = normalizeCode(code);
    if (!c) return { valid: false, reason: 'Código de convite inválido.' };
    const row = db.prepare('SELECT * FROM invites WHERE code = ?').get(c);
    if (!row) return { valid: false, reason: 'Convite não encontrado.' };
    if (row.revoked_at) return { valid: false, reason: 'Este convite foi cancelado.' };
    if (row.expires_at && row.expires_at < now()) return { valid: false, reason: 'Este convite venceu.' };
    if (row.uses >= row.max_uses) return { valid: false, reason: 'Este convite já foi usado.' };
    return { valid: true, note: row.note, remaining: row.max_uses - row.uses };
  }

  // Gasta o convite. Só deve ser chamado quando a conta vai mesmo ser criada.
  function consume(code, phone) {
    const c = normalizeCode(code);
    const status = check(c);
    if (!status.valid) return status;
    // Condição no UPDATE para duas inscrições simultâneas não estourarem o limite.
    const res = db.prepare(`
      UPDATE invites SET uses = uses + 1
      WHERE code = ? AND revoked_at IS NULL AND uses < max_uses
        AND (expires_at IS NULL OR expires_at > ?)
    `).run(c, now());
    if (res.changes !== 1) return { valid: false, reason: 'Este convite já foi usado.' };
    db.prepare('INSERT INTO invite_uses (code, phone, used_at) VALUES (?, ?, ?)').run(c, phone, now());
    return { valid: true, code: c };
  }

  function linkUser(code, phone, userId) {
    db.prepare('UPDATE invite_uses SET user_id = ? WHERE code = ? AND phone = ? AND user_id IS NULL').run(userId, code, phone);
  }

  function view(row) {
    if (!row) return null;
    const expired = Boolean(row.expires_at && row.expires_at < now());
    return {
      code: row.code,
      note: row.note,
      maxUses: row.max_uses,
      uses: row.uses,
      remaining: Math.max(row.max_uses - row.uses, 0),
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
      active: !row.revoked_at && !expired && row.uses < row.max_uses,
      usedBy: db.prepare(`
        SELECT iu.used_at, u.username, u.name
        FROM invite_uses iu LEFT JOIN users u ON u.id = iu.user_id
        WHERE iu.code = ? ORDER BY iu.used_at
      `).all(row.code),
    };
  }

  // Ovo e galinha: num servidor em modo convite, sem administrador não há quem
  // emita o primeiro convite, e sem convite não há administrador. Resolvido
  // assim: servidor vazio imprime um convite de primeiro acesso no terminal de
  // quem o está subindo. Quem tem acesso ao terminal é o dono do servidor.
  function bootstrap() {
    const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    if (users > 0) return null;
    const pending = db.prepare("SELECT * FROM invites WHERE note = 'primeiro acesso' AND uses = 0 AND revoked_at IS NULL").get();
    const invite = pending ? view(pending) : create(null, { note: 'primeiro acesso', maxUses: 1 });
    logger.log?.(
      `\n  Servidor novo. Código do primeiro acesso: ${invite.code}` +
      `\n  Quem usar este código vira o administrador e poderá convidar as outras pessoas.\n`
    );
    return invite;
  }

  return { create, list, revoke, check, consume, linkUser, view, bootstrap };
}

// Código de recuperação: como quem já tem conta volta a entrar sem SMS.
// Mostrado uma única vez; no banco fica só o resumo criptográfico.
export function generateRecoveryCode() {
  return `${generateCode()}-${generateCode()}`;
}
export function hashRecovery(phone, code) {
  return sha256(phone + ':recovery:' + String(code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, ''));
}
