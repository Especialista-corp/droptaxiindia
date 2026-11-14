#!/usr/bin/env node
// Backup do ZapLivre: banco e arquivos enviados.
//
// O banco é copiado com VACUUM INTO, que produz um arquivo consistente mesmo
// com o servidor rodando e gravando. Copiar o .db na mão enquanto há escrita
// gera um backup que parece bom e não restaura.
//
//   node scripts/backup.js                      # grava em data/backups
//   node scripts/backup.js --saida /mnt/backup  # grava em outro lugar
//   node scripts/backup.js --manter 14          # quantos backups guardar
//
// Restaurar está em scripts/restaurar.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(__dirname, '..');

function arg(nome, padrao) {
  const i = process.argv.indexOf('--' + nome);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

const dbFile = process.env.DB_FILE || path.join(raiz, 'data', 'zaplivre.db');
const uploadDir = process.env.UPLOAD_DIR || path.join(path.dirname(dbFile), 'uploads');
const saida = path.resolve(arg('saida', path.join(path.dirname(dbFile), 'backups')));
const manter = Math.max(Number(arg('manter', 14)) || 14, 1);

if (!fs.existsSync(dbFile)) {
  console.error(`Banco não encontrado: ${dbFile}`);
  process.exit(1);
}

const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const destino = path.join(saida, carimbo);
fs.mkdirSync(destino, { recursive: true });

// 1. Banco, em cópia consistente.
const db = new DatabaseSync(dbFile, { readOnly: true });
const alvoDb = path.join(destino, 'zaplivre.db');
db.exec(`VACUUM INTO '${alvoDb.replace(/'/g, "''")}'`);
db.close();
const tamanhoDb = fs.statSync(alvoDb).size;

// 2. Arquivos enviados (fotos, vídeos, áudios, documentos).
let arquivos = 0;
let bytes = 0;
if (fs.existsSync(uploadDir)) {
  const alvoUp = path.join(destino, 'uploads');
  fs.mkdirSync(alvoUp, { recursive: true });
  for (const nome of fs.readdirSync(uploadDir)) {
    const origem = path.join(uploadDir, nome);
    if (!fs.statSync(origem).isFile()) continue;
    fs.copyFileSync(origem, path.join(alvoUp, nome));
    arquivos += 1;
    bytes += fs.statSync(origem).size;
  }
}

// 3. Conferência: o backup abre e tem as tabelas esperadas?
const conferencia = new DatabaseSync(alvoDb, { readOnly: true });
const integridade = conferencia.prepare('PRAGMA integrity_check').get();
const contas = conferencia.prepare('SELECT COUNT(*) AS n FROM users').get().n;
const mensagens = conferencia.prepare('SELECT COUNT(*) AS n FROM messages').get().n;
const anexos = conferencia.prepare('SELECT COUNT(*) AS n FROM attachments').get().n;
conferencia.close();

const ok = Object.values(integridade)[0] === 'ok';
fs.writeFileSync(path.join(destino, 'backup.json'), JSON.stringify({
  feitoEm: new Date().toISOString(),
  origem: { dbFile, uploadDir },
  integridade: ok ? 'ok' : integridade,
  contas, mensagens, anexos, arquivos,
  bytes: { banco: tamanhoDb, arquivos: bytes },
}, null, 2));

// 4. Apaga os backups mais antigos do que o limite.
const antigos = fs.readdirSync(saida)
  .filter((n) => /^\d{4}-\d{2}-\d{2}T/.test(n))
  .sort()
  .slice(0, -manter);
for (const n of antigos) fs.rmSync(path.join(saida, n), { recursive: true, force: true });

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(`Backup em ${destino}`);
console.log(`  banco ${mb(tamanhoDb)} · ${contas} conta(s), ${mensagens} mensagem(ns), ${anexos} anexo(s)`);
console.log(`  arquivos ${arquivos} (${mb(bytes)})`);
console.log(`  integridade: ${ok ? 'ok' : 'FALHOU'}`);
if (antigos.length) console.log(`  apagados ${antigos.length} backup(s) antigo(s), mantendo ${manter}`);
if (!ok) process.exit(1);
