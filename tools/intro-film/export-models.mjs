// Spielmodelle fuer den Introfilm exportieren: Vite (Entwicklungsmodus) liefert tools/intro-film/web/models.html,
// Playwright ruft je Modell window.__models.dump(name) und schreibt eine JSON-Datei je Modell.
// Einheiten kommen als gezeichnete Modelle (dumpInked): <name>.json (Kopf) und <name>.bin (Felder) nach .cache/units/,
// ihre Atlanten als PNG nach .cache/atlas/ (<id>-paint.png RGBA, <id>-ink.png Abstandsfeld), Kenngroessen nach
// .cache/inked.json.
// Export game models for the intro film: Vite (dev mode) serves tools/intro-film/web/models.html, Playwright calls
// window.__models.dump(name) per model and writes one JSON file per model.
// Units come as inked models (dumpInked): <name>.json (header) and <name>.bin (arrays) to .cache/units/, their atlases
// as PNG to .cache/atlas/ (<id>-paint.png RGBA, <id>-ink.png distance field), figures of the style to .cache/inked.json.
//
// node tools/intro-film/export-models.mjs [--out tools/intro-film/.cache/models] [--only name1,name2] [--atlas 2048]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const out = resolve(args.out ?? join(root, 'tools/intro-film/.cache/models'));
const cache = join(out, '..');
const unitsOut = join(cache, 'units'), atlasOut = join(cache, 'atlas');
// Kantenlaenge der Atlanten: 2048, weil der Film Einheiten naeher zeigt als das Brett (die Maler sind aufloesungsunabhaengig)
// atlas edge length: 2048 because the film shows units closer than the board does (the painters are resolution independent)
const atlasSize = Number(args.atlas ?? 2048);
for (const d of [out, unitsOut, atlasOut]) mkdirSync(d, { recursive: true });

/** Playwright lokal oder global / Playwright local or global */
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* weiter / continue */ }
  const g = execSync('npm root -g').toString().trim();
  return createRequire(join(g, 'noop.js'))('playwright');
}

/** PNG ohne Abhaengigkeit schreiben (8 Bit, Graustufen oder RGBA mit geradem Alpha) / write a PNG without a dependency (8 bit, greyscale or RGBA with straight alpha) */
function png(data, w, h, channels) {
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8;
  head[9] = channels === 4 ? 6 : 0;
  const stride = w * channels;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

const { createServer } = await import('vite');
const srv = await createServer({ root, configFile: false, base: '/', logLevel: 'warn', server: { port: Number(args.port ?? 5219), fs: { strict: false } } });
await srv.listen();
const url = `${srv.resolvedUrls.local[0]}tools/intro-film/web/models.html`;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
let failed = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__models?.ready, null, { timeout: 180000 });
  writeFileSync(join(cache, 'tokens.json'), JSON.stringify(await page.evaluate(() => window.__models.tokens()), null, 1));
  const only = args.only ? new Set(args.only.split(',')) : null;
  const names = (await page.evaluate(() => window.__models.names)).filter((n) => !only || only.has(n));
  for (const name of names) {
    const data = await page.evaluate((n) => window.__models.dump(n), name);
    if (data.error) { console.error(`${name}: ${data.error}`); failed++; continue; }
    writeFileSync(join(out, `${name}.json`), JSON.stringify(data));
    console.log(`${name}: ${data.count / 3} tris`);
  }
  // Gezeichnete Einheiten / inked units
  const units = (await page.evaluate(() => window.__models.units)).filter((n) => !only || only.has(n));
  for (const name of units) {
    const data = await page.evaluate((n) => window.__models.dumpInked(n), name);
    if (data.error) { console.error(`${name}: ${data.error}`); failed++; continue; }
    const bin = Buffer.from(data.data, 'base64');
    delete data.data;
    writeFileSync(join(unitsOut, `${name}.bin`), bin);
    writeFileSync(join(unitsOut, `${name}.json`), JSON.stringify(data));
    console.log(`${name}: inked, atlas ${data.atlas}, ${data.tris} tris, ink ${data.inkTris}, ${data.parts.length - 1} turret(s), scale ${data.finishScale.toFixed(3)}`);
  }
  // Atlanten der exportierten Einheiten als Bilder / atlases of the exported units as images
  const style = await page.evaluate(() => window.__models.style());
  style.atlasSize = atlasSize;
  style.blank = {};
  for (const id of only ? [] : style.atlases) {
    const info = await page.evaluate(([i, s]) => window.__models.atlas(i, s), [id, atlasSize]);
    if (!info.ready) { console.error(`atlas ${id}: not painted`); failed++; continue; }
    style.blank[id] = info.blank;
    for (const [layer, bytes, channels] of [['paint', info.paintBytes, 4], ['ink', info.inkBytes, 1]]) {
      const parts = [];
      const step = 6 * 1024 * 1024;
      for (let off = 0; off < bytes; off += step) parts.push(Buffer.from(await page.evaluate(([i, s, l, o, n]) => window.__models.atlasChunk(i, s, l, o, n), [id, atlasSize, layer, off, step]), 'base64'));
      // Zeile 0 der Texturdaten ist v = 0 und zugleich die oberste Zeile der Zeichenflaeche: sie wird die oberste PNG-Zeile
      // row 0 of the texture data is v = 0 and also the top row of the drawing canvas: it becomes the top PNG row
      writeFileSync(join(atlasOut, `${id}-${layer}.png`), png(Buffer.concat(parts), atlasSize, atlasSize, channels));
    }
    console.log(`atlas ${id}: ${atlasSize} px`);
  }
  if (!only) writeFileSync(join(cache, 'inked.json'), JSON.stringify(style, null, 1));
} finally {
  await browser.close();
  await srv.close();
}
if (failed) { console.error(`${failed} export(s) failed`); process.exit(1); }
