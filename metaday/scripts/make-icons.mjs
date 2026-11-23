// Gera os ícones PNG do PWA a partir de public/favicon.svg (requer Playwright instalado globalmente).
// Uso: NODE_PATH="$(npm root -g)" node scripts/make-icons.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/favicon.svg'), 'utf8');

const BG = '#14232B';
// "Maskable": conteúdo dentro da zona segura (80%), fundo sangrando até a borda.
const maskableSvg = svg
  .replace(/<rect[^>]*\/>/, `<rect width="512" height="512" fill="${BG}"/>`)
  .replace('<circle', '<g transform="translate(51.2 51.2) scale(0.8)"><circle')
  .replace('</svg>', '</g></svg>');

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, source: svg },
  { file: 'public/icons/icon-512.png', size: 512, source: svg },
  { file: 'public/icons/icon-maskable-512.png', size: 512, source: maskableSvg },
  { file: 'public/icons/apple-touch-icon.png', size: 180, source: maskableSvg },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${t.source}`);
  await page.screenshot({ path: join(root, t.file), omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  console.log('gerado', t.file);
}
await browser.close();
