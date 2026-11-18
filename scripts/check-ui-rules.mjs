// Prueft die Abnahmeregeln: keine festen Farben in UI-Komponenten, keine Emojis, alle Sprachschluessel in DE und EN mit gleichen Platzhaltern.
// Checks acceptance rules: no hard-coded colours in UI components, no emojis, all language keys in DE and EN with the same placeholders.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
let errors = 0;
const emoji = /\p{Extended_Pictographic}/u;
for (const f of files(join(root, 'src'))) {
  if (!/\.(ts|css|json|html)$/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  if (emoji.test(text)) { console.error('Emoji gefunden / emoji found:', f); errors++; }
  if (f.includes('/ui/') || f.includes('/xr/')) {
    text.split('\n').forEach((line, i) => {
      if (/#[0-9a-fA-F]{3,8}\b/.test(line) && !line.includes('&#')) { console.error(`Feste Farbe / hard-coded colour ${f}:${i + 1}: ${line.trim()}`); errors++; }
      if (f.endsWith('.css') && /\d+px/.test(line) && !line.includes('@media') && !line.includes('.sr-only')) { console.error(`Fester Wert / hard-coded value ${f}:${i + 1}: ${line.trim()}`); errors++; }
    });
  }
}
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const deMap = new Map(flat(JSON.parse(readFileSync(join(root, 'src/i18n/de.json'), 'utf8'))));
const enMap = new Map(flat(JSON.parse(readFileSync(join(root, 'src/i18n/en.json'), 'utf8'))));
const de = new Set(deMap.keys());
const en = new Set(enMap.keys());
for (const k of de) if (!en.has(k)) { console.error('Fehlt in EN / missing in EN:', k); errors++; }
for (const k of en) if (!de.has(k)) { console.error('Fehlt in DE / missing in DE:', k); errors++; }
// Gleiche Platzhalter und gleiche Listenlaenge in DE und EN, damit keine Zahl nur in einer Sprache steht
// same placeholders and same list length in DE and EN, so no number shows in one language only
const placeholders = (v) => [...new Set((Array.isArray(v) ? v : [v]).flatMap((s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort().join(', ');
for (const [k, dv] of deMap) {
  if (!enMap.has(k)) continue;
  const ev = enMap.get(k);
  if (Array.isArray(dv) !== Array.isArray(ev) || (Array.isArray(dv) && dv.length !== ev.length)) { console.error(`Listenform weicht ab / list shape differs: ${k}`); errors++; continue; }
  if (placeholders(dv) !== placeholders(ev)) { console.error(`Platzhalter weichen ab / placeholders differ: ${k} DE {${placeholders(dv)}} EN {${placeholders(ev)}}`); errors++; }
}
console.log(errors ? `${errors} Verstoesse / violations` : `OK: ${de.size} Sprachschluessel, keine Emojis, keine festen Farben / OK`);
process.exit(errors ? 1 : 0);
