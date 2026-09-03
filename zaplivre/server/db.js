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
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      about TEXT NOT NULL DEFAULT 'Olá! Estou usando o ZapLivre.',
      avatar TEXT,
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

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
      name TEXT,
      avatar TEXT,
      direct_key TEXT UNIQUE,
      created_by TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL
    );

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
      type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'system')),
      body TEXT NOT NULL,
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
  `);
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

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
