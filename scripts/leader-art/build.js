// Baut alle Anfuehrer-Portraits / builds all leader portraits:
//   node scripts/leader-art/build.js [factionId ...] [mood ...]
// Output: public/leaders/<factionId>_<mood>_<A|B>.svg
// Level A = clean comic for small sizes, level B = rich comic for large views.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOODS } from './common.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'public', 'leaders');
const FACTIONS = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar', 'zyrr', 'vesper', 'nexus'];

const args = process.argv.slice(2);
const factions = args.filter((a) => FACTIONS.includes(a));
const moods = args.filter((a) => MOODS.includes(a));

mkdirSync(OUT, { recursive: true });
let count = 0;
for (const f of factions.length ? factions : FACTIONS) {
  const { default: render } = await import(`./${f}.js`);
  for (const mood of moods.length ? moods : MOODS) {
    for (const level of ['A', 'B']) {
      writeFileSync(join(OUT, `${f}_${mood}_${level}.svg`), render(level, mood));
      count++;
    }
  }
}
console.log(`leader-art: ${count} SVG files written to public/leaders/`);
