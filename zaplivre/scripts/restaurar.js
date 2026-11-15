#!/usr/bin/env node
// Restaura um backup feito por scripts/backup.js.
//
//   node scripts/restaurar.js data/backups/2026-11-14T16-00-00
//
// Pare o servidor antes. O que existe hoje é movido para .antes-da-restauracao
// em vez de ser apagado: restauração errada não pode ser caminho sem volta.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(__dirname, '..');
const origem = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!origem || !fs.existsSync(path.join(origem, 'zaplivre.db'))) {
  console.error('Uso: node scripts/restaurar.js <pasta-do-backup>');
  process.exit(1);
}

const dbFile = process.env.DB_FILE || path.join(raiz, 'data', 'zaplivre.db');
const uploadDir = process.env.UPLOAD_DIR || path.join(path.dirname(dbFile), 'uploads');

// Confere antes de mexer no que está no ar.
const teste = new DatabaseSync(path.join(origem, 'zaplivre.db'), { readOnly: true });
const integridade = Object.values(teste.prepare('PRAGMA integrity_check').get())[0];
const mensagens = teste.prepare('SELECT COUNT(*) AS n FROM messages').get().n;
teste.close();
if (integridade !== 'ok') {
  console.error('O backup não passou na conferência de integridade. Nada foi alterado.');
  process.exit(1);
}

const guarda = path.join(path.dirname(dbFile), '.antes-da-restauracao-' + Date.now());
fs.mkdirSync(guarda, { recursive: true });
for (const sufixo of ['', '-wal', '-shm']) {
  if (fs.existsSync(dbFile + sufixo)) fs.renameSync(dbFile + sufixo, path.join(guarda, path.basename(dbFile) + sufixo));
}
if (fs.existsSync(uploadDir)) fs.renameSync(uploadDir, path.join(guarda, 'uploads'));

fs.mkdirSync(path.dirname(dbFile), { recursive: true });
fs.copyFileSync(path.join(origem, 'zaplivre.db'), dbFile);
const upBackup = path.join(origem, 'uploads');
if (fs.existsSync(upBackup)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  for (const nome of fs.readdirSync(upBackup)) fs.copyFileSync(path.join(upBackup, nome), path.join(uploadDir, nome));
}

console.log(`Restaurado de ${origem}: ${mensagens} mensagem(ns).`);
console.log(`O que estava no ar foi guardado em ${guarda}.`);
console.log('Pode subir o servidor.');
