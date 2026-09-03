// Arquivos: fotos, áudios e documentos gravados em disco. Transcrição de áudio sob demanda.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { now, newId } from './db.js';
import { httpError } from './auth.js';

const MAX_SIZE = 25 * 1024 * 1024;
const KINDS = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
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

export function createFileService(db, { uploadDir, transcriber = null, logger = console } = {}) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const s = {
    insert: db.prepare(
      `INSERT INTO attachments (id, access_key, owner_id, chat_id, kind, mime, name, size, path, category, tags, duration, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`
    ),
    byId: db.prepare('SELECT * FROM attachments WHERE id = ?'),
    setChat: db.prepare('UPDATE attachments SET chat_id = ? WHERE id = ?'),
    setTags: db.prepare('UPDATE attachments SET tags = ?, category = ? WHERE id = ?'),
    setTranscript: db.prepare('UPDATE attachments SET transcript = ?, summary = ? WHERE id = ?'),
    forChat: db.prepare('SELECT * FROM attachments WHERE chat_id = ? ORDER BY created_at DESC LIMIT 500'),
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

  function save(ownerId, { buffer, mime, name, duration }) {
    const cleanMime = String(mime || '').split(';')[0].trim().toLowerCase();
    const kind = kindOf(cleanMime);
    if (!kind) throw httpError(415, 'Tipo de arquivo não suportado.');
    if (!buffer?.length) throw httpError(400, 'Arquivo vazio.');
    if (buffer.length > MAX_SIZE) throw httpError(413, 'Arquivo muito grande (máx. 25 MB).');
    const id = newId();
    const accessKey = crypto.randomBytes(16).toString('base64url');
    const safeName = String(name || 'arquivo').replace(/[\\/\0]/g, '_').slice(0, 120);
    const file = path.join(uploadDir, id);
    fs.writeFileSync(file, buffer);
    s.insert.run(id, accessKey, ownerId, null, kind, cleanMime, safeName, buffer.length, file, categorize(safeName, cleanMime), duration ? Number(duration) : null, now());
    return view(s.byId.get(id));
  }

  function attachToChat(id, chatId) {
    s.setChat.run(chatId, id);
  }

  function open(id, key) {
    const a = s.byId.get(id);
    if (!a || a.access_key !== key) throw httpError(404, 'Arquivo não encontrado.');
    return { ...a, stream: () => fs.createReadStream(a.path) };
  }

  function get(id) {
    return s.byId.get(id);
  }

  function updateTags(id, { tags, category }) {
    const a = s.byId.get(id);
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
      audios: files.filter((f) => f.kind === 'audio'),
      documents: files.filter((f) => f.kind === 'document'),
      links,
      categories: [...new Set(files.map((f) => f.category).filter(Boolean))],
    };
  }

  // Transcrição + resumo sob demanda (nunca automática: respeita a privacidade e o custo).
  async function transcribe(id) {
    const a = s.byId.get(id);
    if (!a || a.kind !== 'audio') throw httpError(404, 'Áudio não encontrado.');
    if (a.transcript) return view(a);
    if (!transcriber) throw httpError(503, 'Transcrição não configurada neste servidor.');
    let result;
    try {
      result = await transcriber({ path: a.path, mime: a.mime, name: a.name });
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

  return { save, attachToChat, open, get, updateTags, mediaHub, transcribe, view, kindOf };
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
    return async ({ path: file, mime, name }) => {
      const res = await fetch(env.TRANSCRIBE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': mime, 'x-file-name': encodeURIComponent(name) },
        body: fs.readFileSync(file),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json(); // { text, summary? }
    };
  }
  if (env.OPENAI_API_KEY) {
    const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    return async ({ path: file, mime, name }) => {
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(file)], { type: mime }), name || 'audio.webm');
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
