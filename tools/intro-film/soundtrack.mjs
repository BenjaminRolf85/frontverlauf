// Klangspur des Introfilms als WAV rechnen: Vite (Entwicklungsmodus) liefert die Exportseite ?intro-export=1, Playwright
// ruft window.__intro.filmWav() (OfflineAudioContext mit src/intro/filmScore.ts).
// Render the intro film's soundtrack as WAV: Vite (dev mode) serves the export page ?intro-export=1, Playwright calls
// window.__intro.filmWav() (OfflineAudioContext with src/intro/filmScore.ts).
//
// node tools/intro-film/soundtrack.mjs [--out tools/intro-film/.cache/soundtrack.wav]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const i = process.argv.indexOf('--out');
const out = resolve(i > 0 ? process.argv[i + 1] : join(root, 'tools/intro-film/.cache/soundtrack.wav'));
mkdirSync(dirname(out), { recursive: true });

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* weiter / continue */ }
  const g = execSync('npm root -g').toString().trim();
  return createRequire(join(g, 'noop.js'))('playwright');
}

const { createServer } = await import('vite');
const srv = await createServer({ root, configFile: false, base: './', logLevel: 'warn', server: { port: 5221, fs: { strict: false } } });
await srv.listen();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`${srv.resolvedUrls.local[0]}?intro-export=1&w=640&h=360`);
  await page.waitForFunction(() => window.__intro?.ready, null, { timeout: 120000 });
  writeFileSync(out, Buffer.from(await page.evaluate(() => window.__intro.filmWav()), 'base64'));
  console.log(out);
} finally {
  await browser.close();
  await srv.close();
}
