// Erzeugt src/design/tokens.css aus src/design/tokens.ts / generates tokens.css from tokens.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const mod = await import('../src/design/tokens.ts');
const out = fileURLToPath(new URL('../src/design/tokens.css', import.meta.url));
writeFileSync(out, mod.tokensCss());
console.log('tokens.css written:', mod.tokenEntries().length, 'tokens');
