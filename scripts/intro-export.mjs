// Intro-Video exportieren: Vite (Entwicklungsmodus) liefert die Exportseite ?intro-export=1, Playwright rechnet jedes
// Bild bei 30 fps, ffmpeg setzt H.264 + AAC zusammen. Die Klangspur kommt aus einem OfflineAudioContext (WAV).
// Export the intro video: Vite (dev mode) serves the export page ?intro-export=1, Playwright renders every frame at
// 30 fps, ffmpeg muxes H.264 + AAC. The soundtrack comes from an OfflineAudioContext (WAV).
//
// node scripts/intro-export.mjs --out /pfad/zum/ordner [--langs de,en] [--formats 16x9,9x16] [--fps 30]
//   [--contact]           nur Kontaktbogen (1 Bild je Sekunde) / contact sheet only (1 frame per second)
//   [--frames 4.6,20]     einzelne Bilder als JPEG / single frames as JPEG
//   [--url http://localhost:5209/]  laufenden Vite-Server nutzen statt selbst einen zu starten / use a running Vite server
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const out = resolve(args.out ?? join(tmpdir(), 'frontverlauf-intro'));
const langs = (args.langs ?? 'de,en').split(',');
const formats = (args.formats ?? '16x9,9x16').split(',');
const fps = Number(args.fps ?? 30);
const SIZES = { '16x9': [1920, 1080], '9x16': [1080, 1920] };
const ffmpeg = args.ffmpeg ?? 'ffmpeg';
mkdirSync(out, { recursive: true });

/** Playwright lokal oder global / Playwright local or global */
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* weiter / continue */ }
  const g = execSync('npm root -g').toString().trim();
  return createRequire(join(g, 'noop.js'))('playwright');
}

/** Vite starten, falls keine Adresse uebergeben wurde / start Vite unless a URL was given */
async function server() {
  if (args.url) return { url: args.url, close: async () => {} };
  const { createServer } = await import('vite');
  const s = await createServer({ root, configFile: false, base: './', logLevel: 'warn', server: { port: Number(args.port ?? 5209), fs: { strict: false } } });
  await s.listen();
  return { url: s.resolvedUrls.local[0], close: () => s.close() };
}

function run(cmd, argv, feed) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, argv, { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} ${code}: ${err}`))));
    feed(p.stdin).then(() => p.stdin.end(), rej);
  });
}
const write = (stream, buf) => new Promise((res) => (stream.write(buf) ? res() : stream.once('drain', res)));
const jpeg = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

const { chromium } = await loadPlaywright();
const srv = await server();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function open(lang, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`${srv.url}?intro-export=1&lang=${lang}&w=${w}&h=${h}`);
  await page.waitForFunction(() => window.__intro?.ready, null, { timeout: 120000 });
  return page;
}

async function exportOne(lang, fmt, wav) {
  const [w, h] = SIZES[fmt];
  const page = await open(lang, w, h);
  const duration = await page.evaluate(() => window.__intro.duration);
  const file = join(out, `frontverlauf_intro_${lang}_${fmt}.mp4`);
  const n = Math.round(duration * fps);
  const started = Date.now();
  await run(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf ?? 21), '-maxrate', args.maxrate ?? '2800k', '-bufsize', '5600k',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps), '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', file], async (stdin) => {
    for (let i = 0; i < n; i++) {
      await write(stdin, jpeg(await page.evaluate((t) => window.__intro.frame(t, 0.94), i / fps)));
      if (i % 300 === 0) console.log(`${lang} ${fmt}: ${i}/${n}`);
    }
  });
  await page.close();
  const mb = statSync(file).size / 1e6;
  console.log(`${file}: ${mb.toFixed(1)} MB, ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

async function contact(lang, fmt) {
  const [w, h] = SIZES[fmt];
  const page = await open(lang, w, h);
  const duration = await page.evaluate(() => window.__intro.duration);
  const cols = fmt === '16x9' ? 8 : 12, rows = Math.ceil(duration / cols);
  const tw = fmt === '16x9' ? 480 : 270;
  const file = join(out, `contact_${lang}_${fmt}.jpg`);
  await run(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', '-', '-vf', `scale=${tw}:-1,tile=${cols}x${rows}:padding=6:color=black`, '-frames:v', '1', '-q:v', '3', file], async (stdin) => {
    for (let i = 0; i < cols * rows; i++) await write(stdin, jpeg(await page.evaluate((t) => window.__intro.frame(Math.min(t, window.__intro.duration - 0.01), 0.9), i + 0.5)));
  });
  await page.close();
  console.log(file);
}

async function frames(lang, fmt, list) {
  const [w, h] = SIZES[fmt];
  const page = await open(lang, w, h);
  for (const t of list) {
    const file = join(out, `frame_${lang}_${fmt}_${String(t).replace('.', '_')}.jpg`);
    writeFileSync(file, jpeg(await page.evaluate((x) => window.__intro.frame(x, 0.92), t)));
    console.log(file);
  }
  await page.close();
}

try {
  if (args.frames) {
    const list = args.frames.split(',').map(Number);
    for (const lang of langs) for (const fmt of formats) await frames(lang, fmt, list);
  } else if (args.contact) {
    await Promise.all(langs.flatMap((lang) => formats.map((fmt) => contact(lang, fmt))));
  } else {
    // Klangspur einmal rechnen (sprachunabhaengig) / render the soundtrack once (language independent)
    const page = await open(langs[0], 640, 360);
    const wav = join(out, 'frontverlauf_intro.wav');
    writeFileSync(wav, Buffer.from(await page.evaluate(() => window.__intro.wav()), 'base64'));
    await page.close();
    console.log(wav);
    const jobs = langs.flatMap((lang) => formats.map((fmt) => [lang, fmt]));
    const parallel = Number(args.jobs ?? 2);
    for (let i = 0; i < jobs.length; i += parallel) await Promise.all(jobs.slice(i, i + parallel).map(([l, f]) => exportOne(l, f, wav)));
  }
} finally {
  await browser.close();
  await srv.close();
}
