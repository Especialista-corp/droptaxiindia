// Verifica, em Chromium real, que após a 1ª visita o app abre OFFLINE e mantém os dados locais.
// Uso: NODE_PATH="$(npm root -g)" node tests/e2e/offline.e2e.mjs   (requer `npm run build`)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 4174, BASE = `http://127.0.0.1:${PORT}`;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
let ok = false;
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1500);
  // cria um objetivo online
  await page.getByRole('link', { name: /criar meu primeiro objetivo/i }).click();
  await page.getByLabel('Título').fill('Meta offline');
  await page.getByRole('button', { name: 'Criar objetivo' }).click();
  await page.getByRole('heading', { name: 'Meta offline', level: 1 }).waitFor();
  // recarrega a página com o service worker já controlando (garante que a página é servida do cache)
  await page.reload({ waitUntil: 'networkidle' });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Meta offline', level: 1 }).waitFor({ timeout: 10000 });
  await page.goto(BASE + '/habitos', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Hábitos', level: 1 }).waitFor({ timeout: 10000 });
  ok = true;
  await browser.close();
} catch (e) { console.error('✗ offline falhou:', e.message); }
finally { server.kill(); }
console.log(ok ? '✓ Offline OK: app e dados locais abrem sem rede após a 1ª visita (Chromium).' : '');
process.exit(ok ? 0 : 1);
