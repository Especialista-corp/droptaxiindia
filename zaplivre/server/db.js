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
      category TEXT NOT NULL DEFAULT 'social' CHECK (category IN ('social', 'work', 'desk')),
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
      tags TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_chats_workspace ON chats(workspace_id);

    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
      joined_at INTEGER NOT NULL,
      last_read_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (chat_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_members_user ON chat_members(user_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      sender_id TEXT REFERENCES users(id),
      agent_id TEXT REFERENCES users(id),
      type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio', 'document', 'system')),
      body TEXT NOT NULL,
      attachment_id TEXT,
      reply_to TEXT REFERENCES messages(id),
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);

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
      kind TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'document')),
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
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
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
