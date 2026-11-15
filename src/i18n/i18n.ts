/** Zweisprachigkeit: alle sichtbaren Texte stehen in de.json / en.json. Bilingual: all visible texts live in the JSON files. */
import de from './de.json';
import en from './en.json';

export type Lang = 'de' | 'en';
type Dict = Record<string, unknown>;
const dicts: Record<Lang, Dict> = { de, en };
let lang: Lang = 'de';
const listeners = new Set<() => void>();

export function detectLanguage(): Lang {
  try {
    const nav = (globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? 'de']).join(',').toLowerCase();
    const first = nav.split(',')[0] ?? 'de';
    return first.startsWith('de') ? 'de' : 'en';
  } catch {
    return 'de';
  }
}

export function setLanguage(l: Lang) {
  lang = l;
  try { document.documentElement.lang = l; } catch { /* kein DOM / no DOM */ }
  listeners.forEach((fn) => fn());
}
export const getLanguage = () => lang;
/** Gebietsschema der Spielsprache (Datum, Zahlen) / locale of the game language (dates, numbers) */
export const locale = () => (lang === 'de' ? 'de-DE' : 'en-GB');

const numFormats = new Map<Lang, Intl.NumberFormat>();
/**
 * Zahl in der Spielsprache: Dezimalkomma im Deutschen ("3,5"), Punkt im Englischen; ohne Tausendertrennung.
 * Number in the game language: decimal comma in German ("3,5"), point in English; no thousands grouping.
 */
export function num(n: number): string {
  let f = numFormats.get(lang);
  if (!f) { f = new Intl.NumberFormat(locale(), { maximumFractionDigits: 2, useGrouping: false }); numFormats.set(lang, f); }
  return f.format(n);
}
export function onLanguageChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function lookup(d: Dict, key: string): unknown {
  let cur: unknown = d;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Dict)) cur = (cur as Dict)[part];
    else return undefined;
  }
  return cur;
}

/** Text holen und Platzhalter {name} ersetzen / get text and replace {name} placeholders */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  let v = lookup(dicts[lang], key);
  if (v === undefined) v = lookup(dicts.de, key);
  if (typeof v !== 'string') return key;
  return v.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function tList(key: string): string[] {
  const v = lookup(dicts[lang], key);
  return Array.isArray(v) ? (v as string[]) : [];
}

export function has(key: string): boolean {
  return typeof lookup(dicts[lang], key) === 'string';
}
