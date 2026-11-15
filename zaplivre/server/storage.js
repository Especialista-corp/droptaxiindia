// Armazenamento de arquivos com destino trocável (Plano Baú, Etapa 0).
// O resto do servidor só conhece esta interface: gravar, ler e abrir como fluxo.
// Disco local é o padrão. Qualquer serviço compatível com S3 (AWS, Cloudflare R2,
// Backblaze B2, MinIO, Wasabi) entra por variável de ambiente, sem tocar no código de negócio.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';

const KEY_OK = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function checkKey(key) {
  if (typeof key !== 'string' || !KEY_OK.test(key) || key.includes('..')) throw new Error('Chave de arquivo inválida.');
  return key;
}

// Os dois destinos sinalizam "não existe" do mesmo jeito, para quem usa não precisar saber qual é.
function notFound(detail) {
  return Object.assign(new Error(detail || 'Arquivo não encontrado no armazenamento.'), { code: 'ENOENT' });
}

export function createLocalStorage({ dir }) {
  fs.mkdirSync(dir, { recursive: true });
  const fileOf = (key) => path.join(dir, checkKey(key));
  return {
    name: 'local',
    locator: (key) => fileOf(key),
    async put(key, buffer) {
      const destino = fileOf(key);
      const tmp = `${destino}.${process.pid}.tmp`;
      await fs.promises.writeFile(tmp, buffer);
      await fs.promises.rename(tmp, destino);
    },
    read: (key) => fs.promises.readFile(fileOf(key)),
    // Falha cedo, antes de a rota mandar cabeçalhos, quando o arquivo sumiu.
    async stream(key) {
      const file = fileOf(key);
      await fs.promises.access(file);
      return fs.createReadStream(file);
    },
  };
}

// ---------- S3: assinatura AWS Signature V4 sem dependência externa ----------

const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const EMPTY_SHA256 = sha256hex('');
const encodeSegment = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

// Assina todos os cabeçalhos recebidos, mais host, x-amz-date e x-amz-content-sha256.
// Não há consulta na URL: nenhuma chamada nossa usa.
export function signRequest({ method, url, headers = {}, payloadHash, region, accessKeyId, secretAccessKey, date = new Date(), service = 's3' }) {
  const u = new URL(url);
  if (u.search) throw new Error('URL com consulta não é suportada pelo assinador.');
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const all = { ...headers, host: u.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const lower = {};
  for (const [k, v] of Object.entries(all)) lower[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  const names = Object.keys(lower).sort();
  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalUri = u.pathname.split('/').map((seg) => encodeSegment(decodeURIComponent(seg))).join('/') || '/';
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac('AWS4' + secretAccessKey, day), region), service), 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');
  return {
    signature,
    signedHeaders,
    headers: {
      ...headers,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

export function createS3Storage({
  bucket, accessKeyId, secretAccessKey,
  region = 'us-east-1', endpoint = '', pathStyle = Boolean(endpoint), prefix = '',
  timeoutMs = 60000, fetchImpl = fetch,
}) {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const objectKey = (key) => (cleanPrefix ? cleanPrefix + '/' : '') + checkKey(key);

  function urlFor(key) {
    const k = objectKey(key);
    if (!endpoint) return `https://${bucket}.s3.${region}.amazonaws.com/${k}`;
    const base = new URL(endpoint);
    const basePath = base.pathname.replace(/\/$/, '');
    if (pathStyle) return `${base.origin}${basePath}/${bucket}/${k}`;
    return `${base.protocol}//${bucket}.${base.host}${basePath}/${k}`;
  }

  async function call(method, key, { body, headers = {} } = {}) {
    const url = urlFor(key);
    const payloadHash = body ? sha256hex(body) : EMPTY_SHA256;
    const signed = signRequest({ method, url, headers, payloadHash, region, accessKeyId, secretAccessKey }).headers;
    const ctrl = new AbortController();
    // O prazo vale até chegarem os cabeçalhos. Depois disso o corpo corre sem relógio,
    // porque um vídeo grande numa conexão lenta passa de um minuto.
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { method, headers: signed, body, signal: ctrl.signal });
      if (res.status === 404) { await res.body?.cancel(); throw notFound(); }
      if (!res.ok) throw new Error(`S3 ${method} respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: 's3',
    locator: (key) => `s3://${bucket}/${objectKey(key)}`,
    async put(key, buffer, { mime } = {}) {
      const res = await call('PUT', key, { body: buffer, headers: { 'content-type': mime || 'application/octet-stream' } });
      await res.body?.cancel();
    },
    async read(key) {
      return Buffer.from(await (await call('GET', key)).arrayBuffer());
    },
    async stream(key) {
      return Readable.fromWeb((await call('GET', key)).body);
    },
  };
}

// ---------- Escolha do destino ----------

// `primary` recebe os arquivos novos. Cada arquivo guarda em que destino mora, então trocar o
// destino principal não afeta o que já foi gravado: os dois seguem abrindo.
export function createStorage(drivers, primaryName) {
  if (!drivers[primaryName]) throw new Error(`Destino de armazenamento "${primaryName}" não está configurado.`);
  return { primary: drivers[primaryName], driver: (name) => drivers[name] || null };
}

export function buildStorage(env = process.env, { uploadDir } = {}) {
  const drivers = { local: createLocalStorage({ dir: uploadDir }) };
  const wanted = String(env.STORAGE_DRIVER || 'local').trim().toLowerCase();
  if (wanted !== 'local' && wanted !== 's3') throw new Error(`STORAGE_DRIVER inválido: "${env.STORAGE_DRIVER}". Use "local" ou "s3".`);

  // Fica registrado mesmo com STORAGE_DRIVER=local, para os arquivos já gravados no S3 continuarem abrindo.
  if (env.S3_BUCKET) {
    if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) throw new Error('S3_BUCKET exige S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY.');
    const prefix = env.S3_PREFIX || '';
    if (!/^[A-Za-z0-9._/-]*$/.test(prefix)) throw new Error('S3_PREFIX só aceita letras, números, ponto, hífen, sublinhado e barra.');
    drivers.s3 = createS3Storage({
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      region: env.S3_REGION || 'us-east-1',
      endpoint: env.S3_ENDPOINT || '',
      pathStyle: env.S3_ENDPOINT ? env.S3_PATH_STYLE !== '0' : false,
      prefix,
    });
  }
  if (wanted === 's3' && !drivers.s3) throw new Error('STORAGE_DRIVER=s3 exige S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY.');
  return createStorage(drivers, wanted);
}
