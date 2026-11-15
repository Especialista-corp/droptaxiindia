// Aviso com o aplicativo fechado (Web Push / VAPID).
//
// Sem isto o ZapLivre não é um mensageiro: a mensagem chega no servidor e fica
// parada até a pessoa abrir o aplicativo de novo. O navegador só entrega aviso
// em segundo plano através deste caminho.
//
// No iPhone, a Apple só permite depois que o aplicativo foi instalado na tela
// inicial. É limitação do sistema deles, não do ZapLivre.
import * as webpush from 'web-push';
import { newId, now, getSetting, setSetting } from './db.js';

const KEY_PUBLIC = 'vapid_public';
const KEY_PRIVATE = 'vapid_private';
const MAX_FAILURES = 5;

export function createPushService(db, {
  publicKey = process.env.VAPID_PUBLIC_KEY || '',
  privateKey = process.env.VAPID_PRIVATE_KEY || '',
  subject = process.env.VAPID_SUBJECT || 'mailto:contato@zaplivre.app',
  logger = console,
  send,
} = {}) {
  // Chaves do ambiente têm prioridade. Sem elas, geramos uma vez e guardamos no
  // banco, para o servidor subir sozinho sem configuração e não perder as
  // inscrições dos aparelhos a cada reinício.
  if (!publicKey || !privateKey) {
    publicKey = getSetting(db, KEY_PUBLIC) || '';
    privateKey = getSetting(db, KEY_PRIVATE) || '';
  }
  if (!publicKey || !privateKey) {
    const generated = webpush.generateVAPIDKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    setSetting(db, KEY_PUBLIC, publicKey);
    setSetting(db, KEY_PRIVATE, privateKey);
    logger.log('Chaves de notificação geradas e guardadas no banco.');
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    logger.error('Chaves de notificação inválidas:', err.message);
  }

  // Injetável para os testes não saírem para a internet.
  const deliverOne = send || ((subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 24 }));

  function subscribe(userId, subscription, userAgent = '') {
    const endpoint = String(subscription?.endpoint || '');
    const p256dh = String(subscription?.keys?.p256dh || '');
    const auth = String(subscription?.keys?.auth || '');
    if (!endpoint.startsWith('https://') || !p256dh || !auth) {
      const err = new Error('Inscrição de notificação inválida.');
      err.status = 400;
      throw err;
    }
    db.prepare(`
      INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, failures)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        failures = 0
    `).run(newId(), userId, endpoint, p256dh, auth, String(userAgent).slice(0, 300), now());
    return { ok: true };
  }

  function unsubscribe(userId, endpoint) {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, String(endpoint || ''));
    return { ok: true };
  }

  function listFor(userId) {
    return db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  }

  function drop(id) {
    db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(id);
  }

  // Envia para todos os aparelhos de uma pessoa. Nunca lança: aviso que falha
  // não pode derrubar a entrega da mensagem.
  async function sendToUser(userId, payload) {
    const rows = listFor(userId);
    if (!rows.length) return 0;
    const body = JSON.stringify(payload);
    let delivered = 0;
    await Promise.all(rows.map(async (row) => {
      const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      try {
        await deliverOne(subscription, body);
        db.prepare('UPDATE push_subscriptions SET last_ok = ?, failures = 0 WHERE id = ?').run(now(), row.id);
        delivered += 1;
      } catch (err) {
        const status = err?.statusCode || err?.status || 0;
        // 404 e 410: o navegador descartou a inscrição. Não adianta insistir.
        if (status === 404 || status === 410) return drop(row.id);
        const failures = row.failures + 1;
        if (failures >= MAX_FAILURES) return drop(row.id);
        db.prepare('UPDATE push_subscriptions SET failures = ? WHERE id = ?').run(failures, row.id);
        logger.error?.('push:', status || err.message);
      }
    }));
    return delivered;
  }

  return { publicKey, subscribe, unsubscribe, listFor, sendToUser };
}
