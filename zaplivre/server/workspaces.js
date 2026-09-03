// Empresas (workspaces): identidade por domínio, agentes, chave de API, webhook para robôs e plano.
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { now, newId, normalizeDomain, sha256 } from './db.js';
import { httpError, publicUser } from './auth.js';

// Planos com cobrança fixa mensal: mensagens ilimitadas, limites só contra abuso.
export const PLANS = {
  trial: { label: 'Teste grátis (14 dias)', priceBRL: 0, agents: 2, sendsPerHour: 300, webhooks: true },
  starter: { label: 'Starter', priceBRL: 99, agents: 3, sendsPerHour: 2000, webhooks: true },
  pro: { label: 'Pro', priceBRL: 249, agents: 10, sendsPerHour: 10000, webhooks: true },
  business: { label: 'Business', priceBRL: 599, agents: 50, sendsPerHour: 50000, webhooks: true },
};
const TRIAL_DAYS = 14;

export function createWorkspaceService(db, { dnsResolver = dns, logger = console } = {}) {
  const s = {
    byId: db.prepare('SELECT * FROM workspaces WHERE id = ?'),
    byDomain: db.prepare('SELECT * FROM workspaces WHERE domain = ?'),
    byApiKeyHash: db.prepare('SELECT * FROM workspaces WHERE api_key_hash = ?'),
    insert: db.prepare(
      `INSERT INTO workspaces (id, domain, name, owner_id, business_user_id, verified, dns_token, plan, plan_expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, 'trial', ?, ?)`
    ),
    insertBusinessUser: db.prepare(
      `INSERT INTO users (id, phone, username, kind, workspace_id, name, about, created_at, last_seen, discoverable_by_phone)
       VALUES (?, NULL, ?, 'business', ?, ?, ?, ?, ?, 0)`
    ),
    insertMember: db.prepare('INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'),
    removeMember: db.prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?'),
    member: db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?'),
    members: db.prepare(
      'SELECT u.*, m.role FROM workspace_members m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.joined_at'
    ),
    forUser: db.prepare(
      'SELECT w.*, m.role FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id WHERE m.user_id = ? ORDER BY w.created_at'
    ),
    setVerified: db.prepare('UPDATE workspaces SET verified = 1 WHERE id = ?'),
    setApiKey: db.prepare('UPDATE workspaces SET api_key_hash = ? WHERE id = ?'),
    setWebhook: db.prepare('UPDATE workspaces SET webhook_url = ?, webhook_secret = ? WHERE id = ?'),
    setPlan: db.prepare('UPDATE workspaces SET plan = ?, plan_expires_at = ? WHERE id = ?'),
    updateName: db.prepare('UPDATE workspaces SET name = ? WHERE id = ?'),
    updateBusinessUser: db.prepare('UPDATE users SET name = ?, about = ?, avatar = ? WHERE id = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    logWebhook: db.prepare('INSERT INTO webhook_log (workspace_id, event, status, error, created_at) VALUES (?, ?, ?, ?, ?)'),
    webhookLogs: db.prepare('SELECT * FROM webhook_log WHERE workspace_id = ? ORDER BY id DESC LIMIT 50'),
    logBilling: db.prepare('INSERT INTO billing_events (workspace_id, provider, event, payload, created_at) VALUES (?, ?, ?, ?, ?)'),
  };

  function requireRole(workspaceId, userId, roles) {
    const m = s.member.get(workspaceId, userId);
    if (!m) throw httpError(404, 'Empresa não encontrada.');
    if (roles && !roles.includes(m.role)) throw httpError(403, 'Você não tem permissão para isso.');
    return m;
  }

  function create(ownerId, { domain, name, about }) {
    const owner = s.userById.get(ownerId);
    if (!owner || owner.kind !== 'person') throw httpError(400, 'Só pessoas podem criar empresas.');
    const cleanDomain = normalizeDomain(domain);
    if (!cleanDomain) throw httpError(400, 'Domínio inválido. Exemplo: suaempresa.com.br');
    if (s.byDomain.get(cleanDomain) || s.userByUsername.get(cleanDomain)) throw httpError(409, 'Esse domínio já está cadastrado.');
    const cleanName = String(name || '').trim().slice(0, 60) || cleanDomain;
    const id = newId();
    const businessUserId = newId();
    const dnsToken = 'zaplivre-verify=' + crypto.randomBytes(12).toString('hex');
    db.exec('BEGIN');
    try {
      s.insertBusinessUser.run(businessUserId, cleanDomain, id, cleanName, String(about || 'Atendimento oficial').slice(0, 140), now(), now());
      s.insert.run(id, cleanDomain, cleanName, ownerId, businessUserId, dnsToken, now() + TRIAL_DAYS * 86400000, now());
      s.insertMember.run(id, ownerId, 'owner', now());
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return view(s.byId.get(id), 'owner');
  }

  function listForUser(userId) {
    return s.forUser.all(userId).map((w) => view(w, w.role));
  }

  function get(workspaceId, userId) {
    const m = requireRole(workspaceId, userId);
    return view(s.byId.get(workspaceId), m.role);
  }

  function update(workspaceId, userId, { name, about, avatar }) {
    requireRole(workspaceId, userId, ['owner', 'admin']);
    const w = s.byId.get(workspaceId);
    const bu = s.userById.get(w.business_user_id);
    const cleanName = String(name ?? w.name).trim().slice(0, 60) || w.name;
    s.updateName.run(cleanName, workspaceId);
    s.updateBusinessUser.run(cleanName, String(about ?? bu.about).slice(0, 140), avatar === undefined ? bu.avatar : avatar, bu.id);
    return view(s.byId.get(workspaceId), 'owner');
  }

  // Verificação de domínio por registro DNS TXT em _zaplivre.<dominio>.
  async function verifyDomain(workspaceId, userId) {
    requireRole(workspaceId, userId, ['owner', 'admin']);
    const w = s.byId.get(workspaceId);
    if (w.verified) return { verified: true };
    let records = [];
    try {
      records = (await dnsResolver.resolveTxt('_zaplivre.' + w.domain)).flat();
    } catch (err) {
      throw httpError(400, `Registro TXT não encontrado em _zaplivre.${w.domain}. Adicione: ${w.dns_token}`);
    }
    if (!records.includes(w.dns_token)) throw httpError(400, `O TXT existe, mas não contém ${w.dns_token}.`);
    s.setVerified.run(workspaceId);
    return { verified: true };
  }

  function addAgent(workspaceId, userId, handle) {
    requireRole(workspaceId, userId, ['owner', 'admin']);
    const w = s.byId.get(workspaceId);
    const target = s.userByUsername.get(String(handle || '').replace(/^@/, '').toLowerCase());
    if (!target || target.kind !== 'person') throw httpError(404, 'Usuário não encontrado.');
    const limit = planOf(w).agents;
    if (s.members.all(workspaceId).length >= limit) throw httpError(402, `Seu plano permite ${limit} atendentes. Faça upgrade.`);
    s.insertMember.run(workspaceId, target.id, 'agent', now());
    return view(s.byId.get(workspaceId), 'owner');
  }

  function removeAgent(workspaceId, userId, targetId) {
    requireRole(workspaceId, userId, ['owner', 'admin']);
    const w = s.byId.get(workspaceId);
    if (targetId === w.owner_id) throw httpError(400, 'O dono não pode ser removido.');
    s.removeMember.run(workspaceId, targetId);
    return view(s.byId.get(workspaceId), 'owner');
  }

  // Chave de API: mostrada uma única vez; guardamos só o hash.
  function rotateApiKey(workspaceId, userId) {
    requireRole(workspaceId, userId, ['owner', 'admin']);
    const key = 'zl_live_' + crypto.randomBytes(24).toString('base64url');
    s.setApiKey.run(sha256(key), workspaceId);
    return { apiKey: key };
  }

  function authenticateApiKey(key) {
    if (!key || !key.startsWith('zl_live_')) return null;
    const w = s.byApiKeyHash.get(sha256(key));
    if (!w) return null;
    if (!planActive(w)) return null;
    return w;
  }

  function setWebhook(workspaceId, userId, url) {
    requireRole(workspaceId, userId, ['owner', 'admin']);
    let clean = null;
    if (url) {
      try {
        const u = new URL(url);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
        clean = u.toString();
      } catch {
        throw httpError(400, 'URL de webhook inválida.');
      }
    }
    const secret = clean ? crypto.randomBytes(16).toString('hex') : null;
    s.setWebhook.run(clean, secret, workspaceId);
    return { webhookUrl: clean, webhookSecret: secret };
  }

  // Dispara o webhook do robô (n8n, Typebot, Make, LangChain...). Assinado com HMAC-SHA256.
  async function deliverWebhook(workspace, event, payload) {
    if (!workspace.webhook_url) return;
    const body = JSON.stringify({ event, workspaceId: workspace.id, sentAt: now(), data: payload });
    const signature = crypto.createHmac('sha256', workspace.webhook_secret || '').update(body).digest('hex');
    let status = null;
    let error = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(workspace.webhook_url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-zaplivre-signature': signature, 'x-zaplivre-event': event },
          body,
          signal: AbortSignal.timeout(8000),
        });
        status = res.status;
        if (res.ok) { error = null; break; }
        error = 'HTTP ' + res.status;
      } catch (err) {
        error = err.message;
      }
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
    s.logWebhook.run(workspace.id, event, status, error, now());
    if (error) logger.warn(`[webhook] ${workspace.domain} ${event}: ${error}`);
  }

  function webhookLogs(workspaceId, userId) {
    requireRole(workspaceId, userId);
    return s.webhookLogs.all(workspaceId);
  }

  // Cobrança: o provedor (Asaas, Pagar.me, Stripe...) confirma pelo webhook de billing.
  function subscribe(workspaceId, userId, plan) {
    requireRole(workspaceId, userId, ['owner']);
    if (!PLANS[plan] || plan === 'trial') throw httpError(400, 'Plano inválido.');
    s.logBilling.run(workspaceId, 'checkout', 'requested:' + plan, null, now());
    return {
      plan,
      priceBRL: PLANS[plan].priceBRL,
      // O checkout real é criado no provedor de pagamento; aqui devolvemos a referência que ele deve ecoar.
      reference: `${workspaceId}:${plan}`,
    };
  }

  function activatePlan(workspaceId, plan, months = 1, provider = 'manual', payload = null) {
    if (!PLANS[plan]) throw httpError(400, 'Plano inválido.');
    const w = s.byId.get(workspaceId);
    if (!w) throw httpError(404, 'Empresa não encontrada.');
    const base = Math.max(now(), w.plan_expires_at || 0);
    s.setPlan.run(plan, base + months * 30 * 86400000, workspaceId);
    s.logBilling.run(workspaceId, provider, 'activated:' + plan, payload ? JSON.stringify(payload).slice(0, 4000) : null, now());
    return view(s.byId.get(workspaceId), 'owner');
  }

  function planOf(w) {
    return PLANS[planActive(w) ? w.plan : 'trial'];
  }
  function planActive(w) {
    return !w.plan_expires_at || w.plan_expires_at > now();
  }

  function view(w, role) {
    const members = s.members.all(w.id).map((u) => ({ ...publicUser(u), role: u.role }));
    return {
      id: w.id,
      domain: w.domain,
      handle: '@' + w.domain,
      name: w.name,
      verified: Boolean(w.verified),
      dnsRecord: { host: '_zaplivre.' + w.domain, type: 'TXT', value: w.dns_token },
      businessUser: publicUser(s.userById.get(w.business_user_id)),
      hasApiKey: Boolean(w.api_key_hash),
      webhookUrl: w.webhook_url,
      plan: w.plan,
      planLabel: PLANS[w.plan]?.label || w.plan,
      planActive: planActive(w),
      planExpiresAt: w.plan_expires_at,
      limits: planOf(w),
      members,
      role,
      createdAt: w.created_at,
    };
  }

  return {
    create,
    listForUser,
    get,
    update,
    verifyDomain,
    addAgent,
    removeAgent,
    rotateApiKey,
    authenticateApiKey,
    setWebhook,
    deliverWebhook,
    webhookLogs,
    subscribe,
    activatePlan,
    planOf,
    raw: (id) => s.byId.get(id),
    isMember: (workspaceId, userId) => Boolean(s.member.get(workspaceId, userId)),
    memberIds: (workspaceId) => s.members.all(workspaceId).map((u) => u.id),
  };
}
