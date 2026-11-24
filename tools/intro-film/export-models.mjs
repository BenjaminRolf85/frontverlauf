// Spielmodelle fuer den Introfilm exportieren: Vite (Entwicklungsmodus) liefert tools/intro-film/web/models.html,
// Playwright ruft je Modell window.__models.dump(name) und schreibt eine JSON-Datei je Modell.
// Export game models for the intro film: Vite (dev mode) serves tools/intro-film/web/models.html, Playwright calls
// window.__models.dump(name) per model and writes one JSON file per model.
//
// node tools/intro-film/export-models.mjs [--out tools/intro-film/.cache/models] [--only name1,name2]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const out = resolve(args.out ?? join(root, 'tools/intro-film/.cache/models'));
mkdirSync(out, { recursive: true });

/** Playwright lokal oder global / Playwright local or global */
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* weiter / continue */ }
  const g = execSync('npm root -g').toString().trim();
  return createRequire(join(g, 'noop.js'))('playwright');
}

const { createServer } = await import('vite');
const srv = await createServer({ root, configFile: false, base: '/', logLevel: 'warn', server: { port: Number(args.port ?? 5219), fs: { strict: false } } });
await srv.listen();
const url = `${srv.resolvedUrls.local[0]}tools/intro-film/web/models.html`;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__models?.ready, null, { timeout: 180000 });
  writeFileSync(join(out, '..', 'tokens.json'), JSON.stringify(await page.evaluate(() => window.__models.tokens()), null, 1));
  const only = args.only ? new Set(args.only.split(',')) : null;
  const names = (await page.evaluate(() => window.__models.names)).filter((n) => !only || only.has(n));
  for (const name of names) {
    const data = await page.evaluate((n) => window.__models.dump(n), name);
    if (data.error) { console.error(`${name}: ${data.error}`); continue; }
    writeFileSync(join(out, `${name}.json`), JSON.stringify(data));
    console.log(`${name}: ${data.count / 3} tris`);
  }
} finally {
  await browser.close();
  await srv.close();
}
