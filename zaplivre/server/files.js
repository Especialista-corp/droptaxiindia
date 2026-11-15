// Arquivos: fotos, áudios e documentos. Os bytes moram num destino trocável (server/storage.js),
// aqui ficam os metadados e a impressão digital. Transcrição de áudio sob demanda.
import path from 'node:path';
import crypto from 'node:crypto';
import { now, newId } from './db.js';
import { httpError } from './auth.js';

const MAX_SIZE = 25 * 1024 * 1024;
// Vídeo é o único que precisa de folga: 25 MB não dá nem meio minuto de celular.
const MAX_SIZE_VIDEO = 60 * 1024 * 1024;
const KINDS = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  // O que o navegador grava e toca sem plugin. O celular costuma entregar mp4.
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp'],
  audio: ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a', 'audio/aac'],
  document: ['application/pdf', 'text/plain', 'text/csv', 'application/zip',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
};

// Categorias automáticas do painel de mídias (heurística por nome e tipo; IA pode refinar depois).
const CATEGORY_RULES = [
  ['comprovante', /comprovante|recibo|pagamento|pix|transfer|boleto|nf-?e?|nota.?fiscal|fatura|invoice/i],
  ['contrato', /contrato|termo|acordo|proposta|or[cç]amento/i],
  ['planilha', /\.(xlsx?|csv)$/i],
  ['apresentacao', /\.pptx?$/i],
];

export function createFileService(db, { storage, transcriber = null, logger = console } = {}) {
  if (!storage) throw new Error('createFileService precisa de um armazenamento (server/storage.js).');
  const s = {
    insert: db.prepare(
      `INSERT INTO attachments (id, access_key, owner_id, chat_id, kind, mime, name, size, path, category, tags, duration, created_at, sha256, storage, storage_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`
    ),
    byId: db.prepare('SELECT * FROM attachments WHERE id = ?'),
    setChat: db.prepare('UPDATE attachments SET chat_id = ? WHERE id = ?'),
    setTags: db.prepare('UPDATE attachments SET tags = ?, category = ? WHERE id = ?'),
    setTranscript: db.prepare('UPDATE attachments SET transcript = ?, summary = ? WHERE id = ?'),
    setDeleted: db.prepare('UPDATE attachments SET deleted_at = ? WHERE id = ?'),
    forChat: db.prepare('SELECT * FROM attachments WHERE chat_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 500'),
    linksForChat: db.prepare(
      `SELECT id, sender_id, body, created_at FROM messages WHERE chat_id = ? AND type = 'text' AND deleted_at IS NULL AND body LIKE '%http%' ORDER BY created_at DESC LIMIT 300`
    ),
  };

  function kindOf(mime) {
    for (const [kind, list] of Object.entries(KINDS)) if (list.includes(mime)) return kind;
    return null;
  }

  function categorize(name, mime) {
    for (const [cat, re] of CATEGORY_RULES) if (re.test(name)) return cat;
    if (mime === 'application/pdf') return 'documento';
    return null;
  }

  // Arquivos gravados antes do Plano Baú não têm chave própria: o nome do arquivo em disco era o id.
  const keyOf = (a) => a.storage_key || path.basename(a.path);
  const live = (id) => {
    const a = s.byId.get(id);
    return a && !a.deleted_at ? a : undefined;
  };

  function driverOf(a) {
    const driver = storage.driver(a.storage || 'local');
    if (!driver) throw httpError(503, `Este arquivo está no destino "${a.storage}", que não está configurado neste servidor.`);
    return driver;
  }

  // Erro do armazenamento vira resposta clara: sumiu (404) ou destino fora do ar (502).
  async function fromStorage(a, action) {
    const driver = driverOf(a);
    try {
      return await action(driver, keyOf(a));
    } catch (err) {
      if (err.code === 'ENOENT') throw httpError(404, 'Arquivo não encontrado.');
      logger.error(`Armazenamento "${driver.name}" falhou:`, err.message);
      throw httpError(502, 'Não foi possível acessar o arquivo agora.');
    }
  }

  async function save(ownerId, { buffer, mime, name, duration }) {
    const cleanMime = String(mime || '').split(';')[0].trim().toLowerCase();
    const kind = kindOf(cleanMime);
    if (!kind) throw httpError(415, 'Tipo de arquivo não suportado.');
    if (!buffer?.length) throw httpError(400, 'Arquivo vazio.');
    const limite = kind === 'video' ? MAX_SIZE_VIDEO : MAX_SIZE;
    if (buffer.length > limite) throw httpError(413, `Arquivo muito grande (máx. ${Math.round(limite / 1048576)} MB).`);
    const id = newId();
    const accessKey = crypto.randomBytes(16).toString('base64url');
    const safeName = String(name || 'arquivo').replace(/[\\/\0]/g, '_').slice(0, 120);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const driver = storage.primary;
    // Grava os bytes antes da linha: nunca existe metadado apontando para arquivo que não foi salvo.
    try {
      await driver.put(id, buffer, { mime: cleanMime });
    } catch (err) {
      logger.error(`Armazenamento "${driver.name}" falhou ao gravar:`, err.message);
      throw httpError(502, 'Não foi possível guardar o arquivo agora. Tente de novo.');
    }
    s.insert.run(id, accessKey, ownerId, null, kind, cleanMime, safeName, buffer.length, driver.locator(id), categorize(safeName, cleanMime), duration ? Number(duration) : null, now(), sha256, driver.name, id);
    return view(s.byId.get(id));
  }

  function attachToChat(id, chatId) {
    s.setChat.run(chatId, id);
  }

  function open(id, key) {
    const a = live(id);
    if (!a || a.access_key !== key) throw httpError(404, 'Arquivo não encontrado.');
    return { ...a, stream: () => fromStorage(a, (driver, k) => driver.stream(k)) };
  }

  function get(id) {
    return live(id);
  }

  // Exclusão suave: o arquivo some das telas e das buscas, mas os bytes e a impressão digital ficam.
  function softDelete(id) {
    const a = s.byId.get(id);
    if (!a) throw httpError(404, 'Arquivo não encontrado.');
    if (!a.deleted_at) s.setDeleted.run(now(), id);
  }

  function restore(id) {
    const a = s.byId.get(id);
    if (!a) throw httpError(404, 'Arquivo não encontrado.');
    s.setDeleted.run(null, id);
  }

  function updateTags(id, { tags, category }) {
    const a = live(id);
    if (!a) throw httpError(404, 'Arquivo não encontrado.');
    const cleanTags = [...new Set((Array.isArray(tags) ? tags : []).map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 10);
    s.setTags.run(JSON.stringify(cleanTags), category === undefined ? a.category : (String(category || '').slice(0, 30) || null), id);
    return view(s.byId.get(id));
  }

  // Painel lateral: tudo da conversa, agrupado por tipo, mais links extraídos das mensagens.
  function mediaHub(chatId) {
    const files = s.forChat.all(chatId).map(view);
    const links = [];
    for (const m of s.linksForChat.all(chatId)) {
      for (const url of m.body.match(/https?:\/\/[^\s<>"']+/g) || []) links.push({ url, messageId: m.id, senderId: m.sender_id, createdAt: m.created_at });
    }
    return {
      images: files.filter((f) => f.kind === 'image'),
      videos: files.filter((f) => f.kind === 'video'),
      audios: files.filter((f) => f.kind === 'audio'),
      documents: files.filter((f) => f.kind === 'document'),
      links,
      categories: [...new Set(files.map((f) => f.category).filter(Boolean))],
    };
  }

  // Transcrição + resumo sob demanda (nunca automática: respeita a privacidade e o custo).
  async function transcribe(id) {
    const a = live(id);
    if (!a || a.kind !== 'audio') throw httpError(404, 'Áudio não encontrado.');
    if (a.transcript) return view(a);
    if (!transcriber) throw httpError(503, 'Transcrição não configurada neste servidor.');
    const buffer = await fromStorage(a, (driver, k) => driver.read(k));
    let result;
    try {
      result = await transcriber({ buffer, mime: a.mime, name: a.name });
    } catch (err) {
      logger.error('Transcrição falhou:', err.message);
      throw httpError(502, 'Não foi possível transcrever agora.');
    }
    const transcript = String(result?.text || '').trim();
    if (!transcript) throw httpError(502, 'A transcrição voltou vazia.');
    const summary = result?.summary ? String(result.summary).trim() : localSummary(transcript);
    s.setTranscript.run(transcript, summary, id);
    return view(s.byId.get(id));
  }

  function view(a) {
    if (!a) return null;
    return {
      id: a.id,
      url: `/files/${a.id}/${a.access_key}`,
      kind: a.kind,
      mime: a.mime,
      name: a.name,
      size: a.size,
      chatId: a.chat_id,
      ownerId: a.owner_id,
      category: a.category,
      tags: JSON.parse(a.tags || '[]'),
      duration: a.duration,
      transcript: a.transcript,
      summary: a.summary,
      createdAt: a.created_at,
    };
  }

  return { save, attachToChat, open, get, softDelete, restore, updateTags, mediaHub, transcribe, view, kindOf };
}

// Resumo em tópicos sem IA: pega as frases mais representativas (fallback quando não há modelo).
export function localSummary(text) {
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 15);
  if (sentences.length <= 3) return sentences.map((x) => '• ' + x).join('\n');
  const words = text.toLowerCase().match(/[\p{L}]{4,}/gu) || [];
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const scored = sentences.map((sen, i) => ({ i, sen, score: (sen.toLowerCase().match(/[\p{L}]{4,}/gu) || []).reduce((n, w) => n + (freq.get(w) || 0), 0) / Math.sqrt(sen.length) }));
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.i - b.i).map((x) => '• ' + x.sen).join('\n');
}

// Transcritores prontos: endpoint compatível com a API da OpenAI (Whisper) ou um webhook próprio.
export function buildTranscriber(env = process.env, { logger = console } = {}) {
  if (env.TRANSCRIBE_WEBHOOK_URL) {
    return async ({ buffer, mime, name }) => {
      const res = await fetch(env.TRANSCRIBE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': mime, 'x-file-name': encodeURIComponent(name) },
        body: buffer,
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json(); // { text, summary? }
    };
  }
  if (env.OPENAI_API_KEY) {
    const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    return async ({ buffer, mime, name }) => {
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: mime }), name || 'audio.webm');
      form.append('model', env.TRANSCRIBE_MODEL || 'whisper-1');
      form.append('language', 'pt');
      const res = await fetch(base + '/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY },
        body: form,
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const { text } = await res.json();
      let summary = null;
      if (env.SUMMARY_MODEL) {
        try {
          const r = await fetch(base + '/chat/completions', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json' },
            body: JSON.stringify({
              model: env.SUMMARY_MODEL,
              messages: [
                { role: 'system', content: 'Resuma o áudio transcrito em até 3 tópicos curtos em português do Brasil. Responda só os tópicos, um por linha, começando com "• ".' },
                { role: 'user', content: text },
              ],
              max_tokens: 200,
            }),
            signal: AbortSignal.timeout(60000),
          });
          if (r.ok) summary = (await r.json()).choices?.[0]?.message?.content || null;
        } catch (err) {
          logger.warn('Resumo falhou:', err.message);
        }
      }
      return { text, summary };
    };
  }
  return null;
}
