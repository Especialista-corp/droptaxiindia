// Verificação de layout em navegador real (Chromium via Playwright).
//  - sem overflow horizontal em 320, 360, 390, 412 px e desktop;
//  - nenhum conteúdo/botão fica sob a barra inferior fixa (ou sob a faixa do patrocinador no desktop);
//  - nenhum erro de console/página.
// Pré-requisitos: `npm run build` e Playwright disponível (NODE_PATH="$(npm root -g)").
// Uso: NODE_PATH="$(npm root -g)" node tests/e2e/layout.e2e.mjs [--shots]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const SHOTS = process.argv.includes('--shots');
const shotDir = join(root, 'tests/e2e/screenshots');

const VIEWPORTS = [
  { name: '320', width: 320, height: 568 },
  { name: '360', width: 360, height: 740 },
  { name: '390', width: 390, height: 844 },
  { name: '412', width: 412, height: 915 },
  { name: 'desktop', width: 1280, height: 800 },
];
const ROUTES = [
  '/',
  '/metas',
  '/metas/nova',
  '/metas/demo-goal-corrida',
  '/metas/demo-goal-corrida/editar',
  '/checkin',
  '/habitos',
  '/habitos/novo',
  '/contagem',
  '/calendario',
  '/relatorios',
  '/configuracoes',
  '/estado-do-beta',
];

async function waitForServer(url, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Servidor não respondeu em ${url}`);
}

let server = null;
if (!process.env.E2E_BASE_URL) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
}
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log('  ✗', msg);
};

try {
  await waitForServer(BASE);
  if (SHOTS) mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.addInitScript(() => localStorage.setItem('metaday:mode', 'demo'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
    console.log(`\n▶ ${vp.name} (${vp.width}x${vp.height})`);
    for (const route of ROUTES) {
      errors.length = 0;
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForSelector('main#conteudo h1, main#conteudo h2', { timeout: 8000 });
      const metrics = await page.evaluate(() => {
        const main = document.querySelector('main#conteudo');
        const doc = document.documentElement;
        const overflowing = [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right > window.innerWidth + 1 && !el.closest('.sr-only') && !el.closest('[data-allow-hscroll]') && getComputedStyle(el).position !== 'fixed' && !el.closest('.overflow-x-auto');
          })
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
        main.scrollTo({ top: main.scrollHeight });
        const content = main.firstElementChild;
        const last = content.lastElementChild;
        const lastBottom = last ? last.getBoundingClientRect().bottom : 0;
        const nav = [...document.querySelectorAll('nav')].find((n) => n.getBoundingClientRect().height > 0 && getComputedStyle(n).position !== 'static' && n.closest('aside') === null);
        const sponsor = document.querySelector('aside[aria-label^="Patrocinador"]');
        const floorTop = Math.min(
          nav && nav.getBoundingClientRect().height > 0 && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : Infinity,
          sponsor ? sponsor.getBoundingClientRect().top : Infinity,
        );
        return {
          docOverflow: doc.scrollWidth - window.innerWidth,
          mainOverflow: main.scrollWidth - main.clientWidth,
          overflowing,
          lastBottom,
          floorTop,
        };
      });
      const label = `${vp.name} ${route}`;
      if (metrics.docOverflow > 0) fail(`${label}: overflow horizontal no documento (+${metrics.docOverflow}px)`);
      if (metrics.mainOverflow > 0) fail(`${label}: overflow horizontal no conteúdo (+${metrics.mainOverflow}px)`);
      if (metrics.overflowing.length) fail(`${label}: elementos além da largura: ${metrics.overflowing.join(' | ')}`);
      if (metrics.lastBottom > metrics.floorTop + 1) fail(`${label}: conteúdo sob a barra inferior/patrocinador (${Math.round(metrics.lastBottom)} > ${Math.round(metrics.floorTop)})`);
      for (const e of errors) fail(`${label}: ${e}`);
      if (SHOTS) {
        await page.evaluate(() => document.querySelector('main#conteudo').scrollTo({ top: 0 }));
        await page.screenshot({ path: join(shotDir, `${vp.name}${route.replace(/\//g, '_') || '_home'}.png`) });
      }
    }
    await context.close();
  }
  await browser.close();
} finally {
  server?.kill();
}

if (failures.length) {
  console.log(`\n✗ ${failures.length} falha(s) de layout`);
  process.exit(1);
}
console.log(`\n✓ Layout OK: ${VIEWPORTS.length} larguras × ${ROUTES.length} telas, sem overflow horizontal, sem sobreposição e sem erros de console.`);
