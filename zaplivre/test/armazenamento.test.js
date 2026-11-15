// Plano Baú, Etapa 0: armazenamento trocável, impressão digital e exclusão suave.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/index.js';
import { createFileService } from '../server/files.js';
import { createLocalStorage, createS3Storage, createStorage, buildStorage, signRequest } from '../server/storage.js';

const silent = { log() {}, error() {}, warn() {} };
const tmp = '/tmp/claude-0/zl-armazenamento-' + process.pid;
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const lerTudo = async (stream) => {
  const partes = [];
  for await (const p of stream) partes.push(p);
  return Buffer.concat(partes).toString();
};
const keyOf = (db, id) => db.prepare('SELECT access_key FROM attachments WHERE id = ?').get(id).access_key;
const linha = (db, id) => db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// Servidor que imita um S3: guarda os objetos em memória e recusa pedido sem assinatura no formato certo
// ou com o hash do corpo errado.
async function iniciarS3Falso() {
  const objects = new Map();
  const vistos = [];
  const server = http.createServer((req, res) => {
    const partes = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', () => {
      const body = Buffer.concat(partes);
      const auth = req.headers.authorization || '';
      vistos.push({ method: req.method, url: req.url, auth });
      const formatoOk = /^AWS4-HMAC-SHA256 Credential=AKTESTE\/\d{8}\/us-east-1\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/.test(auth);
      if (!formatoOk || req.headers['x-amz-content-sha256'] !== sha(body)) { res.writeHead(403); return res.end('<Error>SignatureDoesNotMatch</Error>'); }
      const chave = req.url.slice(1);
      if (req.method === 'PUT') { objects.set(chave, { body, type: req.headers['content-type'] }); res.writeHead(200); return res.end(); }
      if (req.method === 'GET') {
        const o = objects.get(chave);
        if (!o) { res.writeHead(404); return res.end('<Error>NoSuchKey</Error>'); }
        res.writeHead(200, { 'content-type': o.type, 'content-length': o.body.length });
        return res.end(o.body);
      }
      res.writeHead(405); res.end();
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { objects, vistos, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}
const novoS3 = (url, extra = {}) => createS3Storage({ bucket: 'bau', accessKeyId: 'AKTESTE', secretAccessKey: 'segredo', endpoint: url, ...extra });

test('assinatura AWS V4 reproduz os exemplos publicados pela AWS', () => {
  const credenciais = { region: 'us-east-1', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', date: new Date('2013-05-24T00:00:00Z') };
  const get = signRequest({ method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', headers: { range: 'bytes=0-9' }, payloadHash: sha(''), ...credenciais });
  assert.equal(get.signedHeaders, 'host;range;x-amz-content-sha256;x-amz-date');
  assert.equal(get.signature, 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');

  const corpo = 'Welcome to Amazon S3.';
  const put = signRequest({
    method: 'PUT', url: 'https://examplebucket.s3.amazonaws.com/test$file.text',
    headers: { date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
    payloadHash: sha(corpo), ...credenciais,
  });
  assert.equal(put.signedHeaders, 'date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class');
  assert.equal(put.signature, '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd');
});

test('destino local: grava, lê, abre como fluxo e recusa chave com caminho', async () => {
  const local = createLocalStorage({ dir: path.join(tmp, 'local') });
  await local.put('abc-1', Buffer.from('conteúdo'));
  assert.equal((await local.read('abc-1')).toString(), 'conteúdo');
  assert.equal(await lerTudo(await local.stream('abc-1')), 'conteúdo');
  await assert.rejects(() => local.read('nao-existe'), { code: 'ENOENT' });
  await assert.rejects(() => local.stream('nao-existe'), { code: 'ENOENT' });
  for (const ruim of ['../fora', 'a/b', '.oculto', '', 'a..b']) {
    await assert.rejects(() => local.put(ruim, Buffer.from('x')), /inválida/, `deveria recusar "${ruim}"`);
  }
  assert.deepEqual(fs.readdirSync(path.join(tmp, 'local')), ['abc-1'], 'nenhum arquivo temporário sobra');
});

test('destino S3: grava, lê, abre como fluxo e distingue "não existe" de falha', async () => {
  const falso = await iniciarS3Falso();
  try {
    const s3 = novoS3(falso.url);
    await s3.put('foto-1', Buffer.from('bytes da foto'), { mime: 'image/png' });
    assert.equal(falso.objects.get('bau/foto-1').type, 'image/png');
    assert.equal((await s3.read('foto-1')).toString(), 'bytes da foto');
    assert.equal(await lerTudo(await s3.stream('foto-1')), 'bytes da foto');
    await assert.rejects(() => s3.read('sumiu'), { code: 'ENOENT' });
    assert.equal(falso.vistos[0].url, '/bau/foto-1', 'endereço no estilo path-style');

    const errada = createS3Storage({ bucket: 'bau', accessKeyId: 'OUTRA', secretAccessKey: 'x', endpoint: falso.url });
    await assert.rejects(() => errada.put('x1', Buffer.from('x')), /403/);
  } finally { await falso.close(); }
});

test('destino S3: endereço da AWS, de endpoint próprio e com prefixo', async () => {
  const chamadas = [];
  const fetchImpl = async (url) => { chamadas.push(url); return new Response('ok', { status: 200 }); };
  const base = { bucket: 'bau', accessKeyId: 'a', secretAccessKey: 'b', fetchImpl };
  await createS3Storage({ ...base, region: 'sa-east-1' }).read('k1');
  await createS3Storage({ ...base, endpoint: 'https://conta.r2.cloudflarestorage.com' }).read('k1');
  await createS3Storage({ ...base, endpoint: 'https://s3.exemplo.com', pathStyle: false }).read('k1');
  await createS3Storage({ ...base, prefix: '/zaplivre/prod/' }).read('k1');
  assert.deepEqual(chamadas, [
    'https://bau.s3.sa-east-1.amazonaws.com/k1',
    'https://conta.r2.cloudflarestorage.com/bau/k1',
    'https://bau.s3.exemplo.com/k1',
    'https://bau.s3.us-east-1.amazonaws.com/zaplivre/prod/k1',
  ]);
  assert.equal(createS3Storage({ ...base, prefix: 'p' }).locator('k1'), 's3://bau/p/k1');
});

test('configuração por variável de ambiente: padrão local, S3 só com tudo preenchido', () => {
  const uploadDir = path.join(tmp, 'env');
  assert.equal(buildStorage({}, { uploadDir }).primary.name, 'local');
  assert.throws(() => buildStorage({ STORAGE_DRIVER: 'nuvem' }, { uploadDir }), /inválido/);
  assert.throws(() => buildStorage({ STORAGE_DRIVER: 's3' }, { uploadDir }), /exige S3_BUCKET/);
  assert.throws(() => buildStorage({ S3_BUCKET: 'bau' }, { uploadDir }), /S3_ACCESS_KEY_ID/);
  assert.throws(() => buildStorage({ S3_BUCKET: 'bau', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b', S3_PREFIX: '../x ' }, { uploadDir }), /S3_PREFIX/);

  const completo = { S3_BUCKET: 'bau', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b', S3_ENDPOINT: 'https://s3.exemplo.com' };
  assert.equal(buildStorage({ ...completo, STORAGE_DRIVER: 's3' }, { uploadDir }).primary.name, 's3');
  const voltouAoLocal = buildStorage({ ...completo, STORAGE_DRIVER: 'local' }, { uploadDir });
  assert.equal(voltouAoLocal.primary.name, 'local');
  assert.equal(voltouAoLocal.driver('s3').name, 's3', 'o S3 continua registrado para ler o que já está lá');
});

test('trocar o destino não quebra o que já existia, e o novo vai para o S3 com impressão digital', async () => {
  const falso = await iniciarS3Falso();
  try {
    const db = openDatabase(':memory:');
    db.exec('PRAGMA foreign_keys = OFF');
    const dir = path.join(tmp, 'servico');
    const local = createLocalStorage({ dir });
    const s3 = novoS3(falso.url);
    const antes = createFileService(db, { storage: createStorage({ local }, 'local'), logger: silent });
    const depois = createFileService(db, { storage: createStorage({ local, s3 }, 's3'), logger: silent });

    const velho = await antes.save('u1', { buffer: Buffer.from('comprovante antigo'), mime: 'application/pdf', name: 'velho.pdf' });
    const novo = await depois.save('u1', { buffer: Buffer.from('comprovante novo'), mime: 'application/pdf', name: 'novo.pdf' });

    assert.equal(linha(db, velho.id).storage, 'local');
    assert.equal(linha(db, novo.id).storage, 's3');
    assert.equal(linha(db, velho.id).sha256, sha('comprovante antigo'));
    assert.equal(linha(db, novo.id).sha256, sha('comprovante novo'));
    assert.ok(fs.existsSync(path.join(dir, velho.id)), 'o antigo está em disco');
    assert.deepEqual([...falso.objects.keys()], [`bau/${novo.id}`], 'o novo está no S3 e só ele');

    assert.equal(await lerTudo(await depois.open(velho.id, keyOf(db, velho.id)).stream()), 'comprovante antigo');
    assert.equal(await lerTudo(await depois.open(novo.id, keyOf(db, novo.id)).stream()), 'comprovante novo');

    // Se o S3 for desligado da configuração, o arquivo de lá avisa com clareza em vez de falhar em silêncio.
    const semS3 = createFileService(db, { storage: createStorage({ local }, 'local'), logger: silent });
    await assert.rejects(() => semS3.open(novo.id, keyOf(db, novo.id)).stream(), (err) => err.status === 503 && /não está configurado/.test(err.message));
    assert.equal(await lerTudo(await semS3.open(velho.id, keyOf(db, velho.id)).stream()), 'comprovante antigo');
  } finally { await falso.close(); }
});

test('arquivo gravado antes do Plano Baú continua abrindo, sem chave nem impressão digital', async () => {
  const db = openDatabase(':memory:');
  db.exec('PRAGMA foreign_keys = OFF');
  const dir = path.join(tmp, 'legado');
  const local = createLocalStorage({ dir });
  fs.writeFileSync(path.join(dir, 'legado-1'), 'foto velha');
  db.prepare(`INSERT INTO attachments (id, access_key, owner_id, chat_id, kind, mime, name, size, path, tags, created_at)
              VALUES ('legado-1', 'chave', 'u1', NULL, 'image', 'image/png', 'velha.png', 10, ?, '[]', 1)`).run(path.join(dir, 'legado-1'));
  const row = linha(db, 'legado-1');
  assert.equal(row.storage, 'local');
  assert.equal(row.storage_key, null);
  assert.equal(row.sha256, null);
  const files = createFileService(db, { storage: createStorage({ local }, 'local'), logger: silent });
  assert.equal(await lerTudo(await files.open('legado-1', 'chave').stream()), 'foto velha');
});

test('banco criado antes da Etapa 0 ganha as colunas novas e preserva as linhas', () => {
  const arquivo = path.join(tmp, 'antigo.db');
  fs.mkdirSync(tmp, { recursive: true });
  const velho = openDatabase(arquivo);
  velho.exec('PRAGMA foreign_keys = OFF');
  velho.prepare(`INSERT INTO attachments (id, access_key, owner_id, kind, mime, name, size, path, tags, created_at)
                 VALUES ('a1', 'k', 'u1', 'document', 'application/pdf', 'x.pdf', 4, '/dados/uploads/a1', '[]', 1)`).run();
  for (const coluna of ['sha256', 'storage', 'storage_key', 'deleted_at']) velho.exec(`ALTER TABLE attachments DROP COLUMN ${coluna}`);
  velho.close();

  const novo = openDatabase(arquivo);
  const colunas = novo.prepare('PRAGMA table_info(attachments)').all().map((c) => c.name);
  for (const coluna of ['sha256', 'storage', 'storage_key', 'deleted_at']) assert.ok(colunas.includes(coluna), `falta a coluna ${coluna}`);
  const row = novo.prepare("SELECT id, storage, deleted_at FROM attachments WHERE id = 'a1'").get();
  assert.deepEqual({ ...row }, { id: 'a1', storage: 'local', deleted_at: null });
  novo.close();
});

test('exclusão suave: some das telas e da abertura, os bytes e a impressão digital ficam, e dá para restaurar', async () => {
  const falso = await iniciarS3Falso();
  try {
    const db = openDatabase(':memory:');
    db.exec('PRAGMA foreign_keys = OFF');
    const local = createLocalStorage({ dir: path.join(tmp, 'suave') });
    const files = createFileService(db, { storage: createStorage({ local, s3: novoS3(falso.url) }, 's3'), logger: silent });
    const a = await files.save('u1', { buffer: Buffer.from('um'), mime: 'text/plain', name: 'um.txt' });
    const b = await files.save('u1', { buffer: Buffer.from('dois'), mime: 'text/plain', name: 'dois.txt' });
    files.attachToChat(a.id, 'chat1');
    files.attachToChat(b.id, 'chat1');
    assert.equal(files.mediaHub('chat1').documents.length, 2);

    files.softDelete(b.id);
    assert.equal(files.get(b.id), undefined);
    assert.throws(() => files.open(b.id, keyOf(db, b.id)), { status: 404 });
    assert.throws(() => files.updateTags(b.id, { tags: ['x'] }), { status: 404 });
    assert.equal(files.mediaHub('chat1').documents.length, 1);
    assert.ok(falso.objects.has(`bau/${b.id}`), 'os bytes continuam guardados');
    assert.equal(linha(db, b.id).sha256, sha('dois'), 'a impressão digital continua');
    assert.ok(linha(db, b.id).deleted_at > 0);

    files.softDelete(b.id);
    files.restore(b.id);
    assert.equal(files.mediaHub('chat1').documents.length, 2);
    assert.equal(await lerTudo(await files.open(b.id, keyOf(db, b.id)).stream()), 'dois');
    assert.throws(() => files.softDelete('inexistente'), { status: 404 });
  } finally { await falso.close(); }
});

test('servidor inteiro com S3: envio, download e transcrição passam pelo destino configurado', async () => {
  const falso = await iniciarS3Falso();
  const uploadDir = path.join(tmp, 'app');
  const recebido = [];
  const transcriber = async ({ buffer }) => { recebido.push(buffer.toString()); return { text: 'Transcrição vinda do S3. Segunda frase para o resumo ficar válido.' }; };
  const ctx = createApp({ dbFile: ':memory:', uploadDir, devShowOtp: true, logger: silent, transcriber, storage: buildStorage({
    STORAGE_DRIVER: 's3', S3_BUCKET: 'bau', S3_ACCESS_KEY_ID: 'AKTESTE', S3_SECRET_ACCESS_KEY: 'segredo', S3_ENDPOINT: falso.url,
  }, { uploadDir }) });
  await new Promise((r) => ctx.server.listen(0, r));
  const base = `http://127.0.0.1:${ctx.server.address().port}`;
  try {
    const pedido = await fetch(base + '/api/auth/request-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '11977770001' }) }).then((r) => r.json());
    const sessao = await fetch(base + '/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '11977770001', code: pedido.devCode, name: 'Rita', username: 'rita' }) }).then((r) => r.json());
    const auth = { authorization: 'Bearer ' + sessao.token };

    const envio = await fetch(base + '/api/uploads', { method: 'POST', headers: { ...auth, 'content-type': 'audio/webm', 'x-file-name': 'recado.webm' }, body: Buffer.from('audio-no-s3') });
    assert.equal(envio.status, 201);
    const { attachment } = await envio.json();
    assert.equal(falso.objects.size, 1, 'o arquivo foi para o S3');
    assert.deepEqual(fs.readdirSync(uploadDir), [], 'e nada ficou em disco');

    const baixado = await fetch(base + attachment.url);
    assert.equal(baixado.status, 200);
    assert.equal(baixado.headers.get('content-type'), 'audio/webm');
    assert.equal(await baixado.text(), 'audio-no-s3');

    const transcricao = await fetch(base + `/api/attachments/${attachment.id}/transcribe`, { method: 'POST', headers: auth });
    assert.equal(transcricao.status, 200);
    assert.deepEqual(recebido, ['audio-no-s3']);

    const sumiu = [...falso.objects.keys()][0];
    falso.objects.delete(sumiu);
    const aposSumir = await fetch(base + attachment.url);
    assert.equal(aposSumir.status, 404, 'objeto que sumiu do destino responde 404 limpo');
  } finally { await ctx.close(); await falso.close(); }
});
