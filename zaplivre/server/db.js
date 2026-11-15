// Camada de dados: SQLite embutido no Node (node:sqlite). Sem dependências nativas.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function openDatabase(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE,
      username TEXT UNIQUE,
      kind TEXT NOT NULL DEFAULT 'person' CHECK (kind IN ('person', 'business')),
      workspace_id TEXT,
      name TEXT NOT NULL DEFAULT '',
      about TEXT NOT NULL DEFAULT 'Olá! Estou usando o ZapLivre.',
      avatar TEXT,
      discoverable_by_phone INTEGER NOT NULL DEFAULT 1,
      recovery_hash TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      invite_code TEXT,
      created_at INTEGER NOT NULL,
      last_seen INTEGER
    );

    CREATE TABLE IF NOT EXISTS otps (
      phone TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      last_used INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    -- Empresas: identidade por domínio (@suaempresa.com.br), API, robôs e plano.
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      domain TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      business_user_id TEXT REFERENCES users(id),
      verified INTEGER NOT NULL DEFAULT 0,
      dns_token TEXT NOT NULL,
      api_key_hash TEXT,
      webhook_url TEXT,
      webhook_secret TEXT,
      plan TEXT NOT NULL DEFAULT 'trial',
      plan_expires_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'agent')),
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ws_members_user ON workspace_members(user_id);

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
      -- Endereço da conversa: a chave de uma aba de arquivo. Sem CHECK fechado,
      -- porque abas novas entram pelo catálogo em server/tabs.js, não por
      -- migração de banco.
      tab_key TEXT NOT NULL DEFAULT 'social',
      name TEXT,
      avatar TEXT,
      direct_key TEXT UNIQUE,
      workspace_id TEXT REFERENCES workspaces(id),
      created_by TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL,
      -- Atendimento (aba Desk): estado do ticket e do robô.
      ticket_status TEXT NOT NULL DEFAULT 'open' CHECK (ticket_status IN ('open', 'in_progress', 'done')),
      assignee_id TEXT REFERENCES users(id),
      bot_paused INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      -- Mensagens temporárias: 0 desligado, senão segundos de validade.
      ephemeral_seconds INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_chats_workspace ON chats(workspace_id);

    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
      joined_at INTEGER NOT NULL,
      last_read_at INTEGER NOT NULL DEFAULT 0,
      -- Organização da lista: cada pessoa fixa, silencia e arquiva a SUA visão
      -- da conversa, sem mexer na do outro.
      -- Cada pessoa pode guardar a MESMA conversa numa aba diferente da do outro.
      tab_key TEXT,
      pinned_at INTEGER,
      muted_until INTEGER,
      archived INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (chat_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_members_user ON chat_members(user_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      sender_id TEXT REFERENCES users(id),
      agent_id TEXT REFERENCES users(id),
      type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'audio', 'document', 'location', 'system')),
      body TEXT NOT NULL,
      attachment_id TEXT,
      reply_to TEXT REFERENCES messages(id),
      forwarded INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);

    -- Uma reação por pessoa por mensagem, como no WhatsApp.
    CREATE TABLE IF NOT EXISTS reactions (
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (message_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);

    CREATE TABLE IF NOT EXISTS message_receipts (
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delivered_at INTEGER,
      read_at INTEGER,
      PRIMARY KEY (message_id, user_id)
    );

    -- Arquivos (fotos, áudios, documentos) guardados em disco; aqui só os metadados.
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      access_key TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('image', 'video', 'audio', 'document')),
      mime TEXT NOT NULL,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      category TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      duration INTEGER,
      transcript TEXT,
      summary TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_attachments_chat ON attachments(chat_id, created_at);

    CREATE TABLE IF NOT EXISTS blocks (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, blocked_id)
    );

    -- Registro de entregas de webhook (para depuração da integração com robôs).
    CREATE TABLE IF NOT EXISTS webhook_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      event TEXT NOT NULL,
      status INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL
    );

    -- Plano Cômodos: quais abas cada pessoa ligou, em que ordem, com que ajustes.
    -- O catálogo do que existe mora em server/tabs.js; aqui fica só a escolha
    -- de cada um.
    CREATE TABLE IF NOT EXISTS user_tabs (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tab_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL DEFAULT 0,
      config TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, tab_key)
    );

    -- Configuração do servidor que precisa sobreviver a reinício (ex.: chaves VAPID).
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Aparelhos inscritos para receber aviso com o aplicativo fechado (Web Push).
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      last_ok INTEGER,
      failures INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

    -- Convites: entrada no piloto sem depender de disparo de SMS contratado.
    CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      note TEXT NOT NULL DEFAULT '',
      max_uses INTEGER NOT NULL DEFAULT 1,
      uses INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER,
      revoked_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invite_uses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      phone TEXT NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      used_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_invite_uses_code ON invite_uses(code);

    CREATE TABLE IF NOT EXISTS billing_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      event TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Migrações leves para bancos criados pela versão anterior.
  addColumnIfMissing(db, 'users', 'username', 'TEXT');
  addColumnIfMissing(db, 'users', 'kind', "TEXT NOT NULL DEFAULT 'person'");
  addColumnIfMissing(db, 'users', 'workspace_id', 'TEXT');
  addColumnIfMissing(db, 'users', 'discoverable_by_phone', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing(db, 'chats', 'category', "TEXT NOT NULL DEFAULT 'social'");
  addColumnIfMissing(db, 'chats', 'workspace_id', 'TEXT');
  addColumnIfMissing(db, 'chats', 'ticket_status', "TEXT NOT NULL DEFAULT 'open'");
  addColumnIfMissing(db, 'chats', 'assignee_id', 'TEXT');
  addColumnIfMissing(db, 'chats', 'bot_paused', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'chats', 'tags', "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(db, 'messages', 'agent_id', 'TEXT');
  addColumnIfMissing(db, 'messages', 'attachment_id', 'TEXT');
  addColumnIfMissing(db, 'users', 'recovery_hash', 'TEXT');
  addColumnIfMissing(db, 'users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'users', 'invite_code', 'TEXT');
  addColumnIfMissing(db, 'messages', 'forwarded', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'messages', 'expires_at', 'INTEGER');
  addColumnIfMissing(db, 'chat_members', 'pinned_at', 'INTEGER');
  addColumnIfMissing(db, 'chat_members', 'muted_until', 'INTEGER');
  addColumnIfMissing(db, 'chat_members', 'archived', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'chats', 'ephemeral_seconds', 'INTEGER NOT NULL DEFAULT 0');
  widenTypeChecks(db);
  migrateToTabs(db);

  // Plano Baú, Etapa 0. Depois de widenTypeChecks, que pode reconstruir `attachments`.
  // `storage` diz em que destino o arquivo mora; linhas antigas valem 'local'.
  addColumnIfMissing(db, 'attachments', 'sha256', 'TEXT');
  addColumnIfMissing(db, 'attachments', 'storage', "TEXT NOT NULL DEFAULT 'local'");
  addColumnIfMissing(db, 'attachments', 'storage_key', 'TEXT');
  addColumnIfMissing(db, 'attachments', 'deleted_at', 'INTEGER');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');

  buildSearchIndex(db);
}

// Busca de mensagens: índice de texto do SQLite (FTS5), sem acentos e sem
// diferenciar maiúsculas. Mantido em dia por gatilhos, para que nenhum caminho
// de escrita precise lembrar de atualizar o índice.
function buildSearchIndex(db) {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      message_id UNINDEXED,
      chat_id UNINDEXED,
      body,
      tokenize = 'unicode61 remove_diacritics 2'
    );

    CREATE TRIGGER IF NOT EXISTS messages_fts_ins AFTER INSERT ON messages
    WHEN new.type <> 'system' AND new.deleted_at IS NULL AND new.body <> ''
    BEGIN
      INSERT INTO messages_fts(message_id, chat_id, body) VALUES (new.id, new.chat_id, new.body);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_fts_del AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE message_id = old.id;
    END;

    -- Mensagem apagada sai da busca na hora.
    CREATE TRIGGER IF NOT EXISTS messages_fts_upd AFTER UPDATE OF body, deleted_at ON messages BEGIN
      DELETE FROM messages_fts WHERE message_id = old.id;
      INSERT INTO messages_fts(message_id, chat_id, body)
        SELECT new.id, new.chat_id, new.body
        WHERE new.deleted_at IS NULL AND new.type <> 'system' AND new.body <> '';
    END;
  `);

  // Banco que já existia antes da busca: preenche o índice uma vez.
  const indexed = db.prepare('SELECT COUNT(*) AS n FROM messages_fts').get().n;
  if (indexed === 0) {
    db.exec(`
      INSERT INTO messages_fts(message_id, chat_id, body)
      SELECT id, chat_id, body FROM messages
      WHERE deleted_at IS NULL AND type <> 'system' AND body <> ''
    `);
  }
}

// Guarda um valor de configuração do servidor no próprio banco.
export function getSetting(db, key) {
  return db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)?.value ?? null;
}
export function setSetting(db, key, value) {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, Date.now());
}

// As restrições CHECK de 'messages.type' e 'attachments.kind' não podem ser
// alteradas por ALTER TABLE. Um banco criado antes do vídeo e da localização
// recusaria as mensagens novas em silêncio, então a tabela é reconstruída.
function widenTypeChecks(db) {
  const sqlOf = (t) => db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(t)?.sql || '';
  if (!sqlOf('messages').includes("'video'")) {
    rebuildTable(db, 'messages', `
      CREATE TABLE messages__novo (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        sender_id TEXT REFERENCES users(id),
        agent_id TEXT REFERENCES users(id),
        type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'audio', 'document', 'location', 'system')),
        body TEXT NOT NULL,
        attachment_id TEXT,
        reply_to TEXT REFERENCES messages(id),
        forwarded INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`, ['CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at)']);
  }
  if (!sqlOf('attachments').includes("'video'")) {
    rebuildTable(db, 'attachments', `
      CREATE TABLE attachments__novo (
        id TEXT PRIMARY KEY,
        access_key TEXT NOT NULL,
        owner_id TEXT NOT NULL REFERENCES users(id),
        chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('image', 'video', 'audio', 'document')),
        mime TEXT NOT NULL,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        path TEXT NOT NULL,
        category TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        duration INTEGER,
        transcript TEXT,
        summary TEXT,
        created_at INTEGER NOT NULL
      )`, ['CREATE INDEX IF NOT EXISTS idx_attachments_chat ON attachments(chat_id, created_at)']);
  }
}

// Plano Cômodos, Etapa 0: o campo fixo `category` vira `tab_key`, a chave de uma
// aba registrada. O CHECK antigo prendia o aplicativo a três abas para sempre.
// Social, Trabalho e Atendimento viram abas registradas sem ninguém notar: os
// valores guardados são exatamente os mesmos.
function migrateToTabs(db) {
  const colunas = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);

  if (!colunas('chats').includes('tab_key')) {
    rebuildTable(db, 'chats', `
      CREATE TABLE chats__novo (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
        tab_key TEXT NOT NULL DEFAULT 'social',
        name TEXT,
        avatar TEXT,
        direct_key TEXT UNIQUE,
        workspace_id TEXT REFERENCES workspaces(id),
        created_by TEXT REFERENCES users(id),
        created_at INTEGER NOT NULL,
        ticket_status TEXT NOT NULL DEFAULT 'open' CHECK (ticket_status IN ('open', 'in_progress', 'done')),
        assignee_id TEXT REFERENCES users(id),
        bot_paused INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]',
        ephemeral_seconds INTEGER NOT NULL DEFAULT 0
      )`, ['CREATE INDEX IF NOT EXISTS idx_chats_workspace ON chats(workspace_id)'],
      { category: 'tab_key' });
  }

  if (!colunas('chat_members').includes('tab_key')) {
    rebuildTable(db, 'chat_members', `
      CREATE TABLE chat_members__novo (
        chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
        joined_at INTEGER NOT NULL,
        last_read_at INTEGER NOT NULL DEFAULT 0,
        tab_key TEXT,
        pinned_at INTEGER,
        muted_until INTEGER,
        archived INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (chat_id, user_id)
      )`, ['CREATE INDEX IF NOT EXISTS idx_members_user ON chat_members(user_id)'],
      { category: 'tab_key' });
  }
}

// Troca uma tabela por outra preservando as linhas, pelas colunas em comum.
// `renomeadas` mapeia coluna antiga -> coluna nova, para um campo que mudou de
// nome não perder os dados na reconstrução.
// Os gatilhos da busca caem junto com a tabela antiga e são refeitos logo
// depois, em buildSearchIndex.
function rebuildTable(db, table, createNewSql, indexes, renomeadas = {}) {
  const novo = table + '__novo';
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec(createNewSql);
    const colsNovo = db.prepare(`PRAGMA table_info(${novo})`).all().map((c) => c.name);
    const colsVelho = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    const destino = [];
    const origem = [];
    for (const c of colsNovo) {
      if (colsVelho.includes(c)) { destino.push(c); origem.push(c); continue; }
      const antiga = Object.keys(renomeadas).find((k) => renomeadas[k] === c);
      if (antiga && colsVelho.includes(antiga)) { destino.push(c); origem.push(antiga); }
    }
    db.exec(`INSERT INTO ${novo} (${destino.join(', ')}) SELECT ${origem.join(', ')} FROM ${table}`);
    db.exec(`DROP TABLE ${table}`);
    db.exec(`ALTER TABLE ${novo} RENAME TO ${table}`);
    for (const sql of indexes) db.exec(sql);
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export const now = () => Date.now();
export const newId = () => crypto.randomUUID();

// Normaliza telefone para E.164 assumindo Brasil (+55) quando o DDI é omitido.
export function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (raw.trim().startsWith('+')) {
    // já veio com DDI
  } else if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits; // DDD + número
  } else if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = '55' + digits.slice(1); // 0DD + número
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return '+' + digits;
}

// @usuario: 3 a 30 caracteres, letras minúsculas, números, ponto e sublinhado.
export function normalizeUsername(raw) {
  if (typeof raw !== 'string') return null;
  const u = raw.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9._]{2,29}$/.test(u)) return null;
  if (u.includes('..')) return null;
  return u;
}

// Domínio de empresa: usado como identidade (@suaempresa.com.br).
export function normalizeDomain(raw) {
  if (typeof raw !== 'string') return null;
  const d = raw.trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return null;
  return d;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
