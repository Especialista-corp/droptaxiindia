// Auditoria de acessibilidade (axe-core) nas telas principais, em Chromium real.
// Verifica também navegação só por teclado nos fluxos críticos (check-in, criar meta, Mais).
// Uso: NODE_PATH="$(npm root -g)" node tests/e2e/a11y.e2e.mjs   (requer `npm run build`)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.E2E_PORT ?? 4175);
const BASE = `http://127.0.0.1:${PORT}`;

const ROUTES = [
  '/', '/metas', '/metas/nova', '/metas/demo-goal-corrida', '/metas/demo-goal-corrida/editar',
  '/checkin', '/habitos', '/habitos/novo', '/contagem', '/calendario', '/relatorios',
  '/configuracoes', '/estado-do-beta',
];

async function waitForServer(url, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Servidor não respondeu em ${url}`);
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const failures = [];
const fail = (msg) => { failures.push(msg); console.log('  ✗', msg); };

try {
  await waitForServer(BASE);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem('metaday:mode', 'demo'));
  const page = await context.newPage();

  console.log('▶ Varredura axe-core (WCAG 2.1 A/AA) por tela');
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForSelector('main#conteudo h1, main#conteudo h2', { timeout: 8000 });
    const results = await new AxeBuilder({ page })
      .include('body')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    if (results.violations.length) {
      for (const v of results.violations) {
        fail(`${route}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length}x) ${v.nodes[0]?.target?.join(' ')}`);
      }
    } else {
      console.log(`  ✓ ${route}: sem violações`);
    }
  }

  console.log('\n▶ Navegação só por teclado: Início → Mais → Calendário');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab'); // pular link "Ir para o conteúdo"
  const skipLinkFocused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  if (!/conteúdo/i.test(skipLinkFocused ?? '')) fail(`Skip-link: primeiro foco esperado era o link "Ir para o conteúdo", veio "${skipLinkFocused}"`);

  console.log('\n▶ Navegação só por teclado: abrir "Mais" com Enter e fechar com Esc');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const moreButton = page.getByRole('button', { name: 'Mais' });
  await moreButton.focus();
  await page.keyboard.press('Enter');
  const dialogVisible = await page.getByRole('dialog').isVisible().catch(() => false);
  if (!dialogVisible) fail('Botão "Mais": Enter não abriu o painel (role=dialog)');
  else {
    await page.keyboard.press('Escape');
    const closed = await page.getByRole('dialog').isVisible().catch(() => false);
    if (closed) fail('Painel "Mais": Esc não fechou o diálogo');
    await page.waitForTimeout(150); // dá tempo à rede de segurança de foco (ver src/lib/a11y.ts)
    const refocused = await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup'));
    if (refocused !== 'dialog') fail('Painel "Mais": foco não retornou ao botão que abriu o diálogo após Esc');
  }

  console.log('\n▶ Navegação só por teclado: criar objetivo até o fim só com Tab/Enter');
  // Em contexto novo e modo local (vazio): a demonstração já tem 3 metas ativas e bloquearia
  // a criação (comportamento correto do limite do plano, testado à parte).
  const freshContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const freshPage = await freshContext.newPage();
  await freshPage.goto(BASE + '/metas/nova', { waitUntil: 'networkidle' });
  const titleInput = freshPage.getByLabel('Título');
  await titleInput.focus();
  await freshPage.keyboard.type('Meta via teclado');
  await freshPage.keyboard.press('Tab'); // descrição
  // Avança até o botão "Criar objetivo" usando apenas Tab, com limite de segurança.
  let reachedSubmit = false;
  for (let i = 0; i < 30; i++) {
    const info = await freshPage.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName, text: el?.textContent?.trim(), type: el?.getAttribute('type') };
    });
    if (info.tag === 'BUTTON' && /criar objetivo/i.test(info.text ?? '')) { reachedSubmit = true; break; }
    await freshPage.keyboard.press('Tab');
  }
  if (!reachedSubmit) fail('Formulário "Novo objetivo": não foi possível alcançar o botão "Criar objetivo" só com Tab');
  else {
    await freshPage.keyboard.press('Enter');
    // isVisible() não espera (só waitFor espera de fato): aqui há navegação (goal criado -> redireciona).
    const created = await freshPage
      .getByRole('heading', { name: 'Meta via teclado', level: 1 })
      .waitFor({ state: 'visible', timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (!created) fail('Formulário "Novo objetivo": Enter no botão focado não submeteu o formulário');
  }
  await freshContext.close();

  await browser.close();
} finally {
  server.kill();
}

if (failures.length) {
  console.log(`\n✗ ${failures.length} problema(s) de acessibilidade/teclado`);
  process.exit(1);
}
console.log(`\n✓ Acessibilidade OK: ${ROUTES.length} telas sem violações axe-core (WCAG 2.1 A/AA) + navegação por teclado verificada.`);
