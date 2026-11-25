/** Spielstand als JSON im localStorage (immer in try/catch) und als Datei / save game as JSON in localStorage and as a file */
import { citySites, cityTiles, isWater, replacedFor, tileAt, usesSites, type GameState } from '../core';
import { outdatedCampaign, staleTempleSave } from '../core/campaign';
import { PRODUCTION, UNITS, type FactionId, type ProductionSiteId, type TechId, type UnitTypeId } from '../data/balance';
import type { Lang } from '../i18n/i18n';

const SAVE_KEY = 'frontverlauf.save.v1';
const SETTINGS_KEY = 'frontverlauf.settings.v1';

export interface Settings {
  lang: Lang | null;
  music: boolean;
  effects: boolean;
  animations: boolean;
  aiSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  quality: 'low' | 'high';
  tutorialDone: boolean;
  /** Prolog schon gesehen / prologue already seen */
  prologueSeen?: boolean;
  /** Intro vor dem ersten Kampagnenstart schon gezeigt / intro already shown before the first campaign start */
  introSeen?: boolean;
  barks: boolean;
  /** Funksprueche der Anfuehrer / leader dispatches */
  dispatches: boolean;
  /** Atmosphaere: Wetter, Voegel, ferner Gefechtslaerm / ambience: weather, birds, distant battle */
  ambience: boolean;
  /** Zuletzt gewaehlte eigene Fraktion in der Einsatzplanung / last own faction chosen in the game setup */
  lastFaction?: FactionId;
}

/**
 * Grundeinstellung der Qualitaet: Geraete mit Touch als Hauptzeiger (Handy, Tablet) starten mit der leichten Stufe,
 * seit die hohe Stufe deutlich detailreichere Einheiten zeichnet. In der Einstellung jederzeit umschaltbar.
 * Default quality: devices with touch as the primary pointer (phone, tablet) start on the light level, since the high
 * level draws clearly more detailed units. Can be switched any time in the settings.
 */
export function defaultQuality(): Settings['quality'] {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

export const DEFAULT_SETTINGS: Settings = {
  lang: null, music: true, effects: true, animations: true, aiSpeed: 'normal', quality: defaultQuality(), tutorialDone: false, barks: true, dispatches: true, ambience: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): boolean {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function isValidState(s: unknown): s is GameState {
  if (!s || typeof s !== 'object') return false;
  const g = s as GameState;
  return g.version === 1 && Array.isArray(g.tiles) && Array.isArray(g.factions) && Array.isArray(g.units) &&
    Array.isArray(g.cities) && typeof g.size === 'number' && g.tiles.length === g.size * g.size && !!g.config;
}

/**
 * Alte Spielstaende angleichen: Trefferglueck und Fraktionssiege gab es damals nicht, fehlende Felder bedeuten also AUS
 * (neue Spiele setzen beide ausdruecklich, siehe createGame/defaultConfig).
 * Bring old saves up to date: hit luck and faction victories did not exist back then, so missing fields mean OFF
 * (new games set both explicitly, see createGame/defaultConfig). Old campaign saves (before the human campaign) become free games.
 */
export function migrateState(s: GameState): GameState {
  if (s.config.hitChance === undefined) s.config.hitChance = false;
  if (s.config.factionVictory === undefined) s.config.factionVictory = false;
  // Feuern nach Bewegung liest u.moved: fehlt das Feld, gilt die Einheit als in diesem Zug nicht gezogen
  // firing after moving reads u.moved: if the field is missing, the unit counts as not moved this turn
  for (const u of s.units) if (typeof u.moved !== 'boolean') u.moved = false;
  // Heiliges Alvenia: Voelkerbund-Charta wird zum Grossen Strafgericht, der Voelkerbund-Zaehler entfaellt;
  // Suendenzeichen (sin), Strafgericht-Zaehler (judged) und Segen (blessed) fehlen in alten Spielstaenden und gelten als nie gesetzt
  // Holy Alvenia: the League Charter becomes the Great Judgement, the League counter is dropped;
  // sinner marks (sin), the judgement counter (judged) and blessings (blessed) are missing in old saves and count as never set
  for (const fa of s.factions as (GameState['factions'][number] & { league?: number })[]) {
    fa.techs = fa.techs.map((t) => ((t as string) === 'leagueCharter' ? 'greatJudgement' : t));
    delete fa.league;
  }
  // Kampagnen-Spielstaende der alten Missionsfassung laufen als freie Eroberungspartie weiter (die Missionen gibt es so nicht mehr)
  // campaign saves of the old mission data continue as a free conquest game (those missions no longer exist)
  // dazu laufende m2-Partien der alten Bergung (vor dem Mutterschiff) und m4 vor den Kriegsplaenen (ohne Tempel)
  // plus running m2 games of the old salvage (before the mothership) and m4 before the war plans (no temple)
  if (s.campaign && (outdatedCampaign(s.campaign) || staleTempleSave(s))) {
    delete s.campaign;
    delete s.config.campaign;
    s.config.factionVictory = false;
  }
  if (s.sites === undefined) migrateSites(s);
  return s;
}

/**
 * Forschung, die eine Einheit vor den Produktionsstaetten freischaltete (Infanterie und Panzer: keine bzw. nicht kaeuflich).
 * Research that unlocked a unit before the production sites (infantry and tank: none or not for sale).
 */
export const LEGACY_UNIT_TECH: Partial<Record<UnitTypeId, TechId>> = {
  sniper: 'camouflage', jeep: 'motorization', pioneer: 'fortification', mg: 'armsIndustry', medic: 'cybernetics', artillery: 'ballistics',
  spy: 'intelligence', heli: 'armyAviation', antiTank: 'armsIndustry', antiAir: 'aerodynamics', mineLayer: 'fortification',
  steppeRider: 'livestock', stormbreaker: 'mining', peacekeeper: 'fortification', privateer: 'coastalEconomy', protoWalker: 'cybernetics',
  octocopter: 'armyAviation', railSniper: 'camouflage', sunLance: 'ballistics',
  // Landungsboot fehlt: Transportboote braucht keine Staette mehr (SHIPYARD) / landing boat omitted: transport boats need no site any more (SHIPYARD)
  submarine: 'diving', destroyer: 'shipbuilding', battleship: 'navalArtillery',
};

/**
 * Alte Spielstaende vor den Produktionsstaetten: jede Stadt einer Menschen-Fraktion bekommt die Staetten eingebaut (City.works),
 * deren Einheiten die Fraktion schon ausbilden konnte (Kaserne immer, Ruestungswerk mit Ruestungsindustrie usw.; Schiffs-
 * staetten nur in Staedten mit Wasser im Gebiet). So verliert niemand mitten in der Partie eine Einheit.
 * Old saves before the production sites: every city of a human faction gets the sites built in (City.works) whose units
 * the faction could already train (barracks always, armoury with arms industry etc.; ship sites only in cities with water
 * in their territory). So nobody loses a unit mid-game.
 */
export function migrateSites(s: GameState) {
  for (const fa of s.factions) {
    if (!usesSites(s, fa.index)) continue;
    const could = (u: UnitTypeId) => {
      const st = UNITS[u];
      if ((st.faction && st.faction !== fa.id) || replacedFor(fa.id, u)) return false;
      // Panzer und Bauarten waren nicht kaeuflich (nur Stadtbelohnung) / tanks and their designs were not for sale (city reward only)
      if (u === 'tank' || u === 'teslaTank' || u === 'reliquary' || u === 'steppeColossus') return false;
      const tech = LEGACY_UNIT_TECH[u];
      return !tech || fa.techs.includes(tech);
    };
    const grant = PRODUCTION.sites.filter((site) => PRODUCTION.units[site].some(could));
    for (const c of s.cities) {
      if (c.owner !== fa.index) continue;
      const have = citySites(s, c);
      const water = cityTiles(s, c).some((p) => isWater(tileAt(s, p.x, p.y)!));
      const add: ProductionSiteId[] = grant.filter((site) => !have.includes(site) && (water || (site !== 'navalBase' && site !== 'dryDock')));
      if (add.length) c.works = [...(c.works ?? []), ...add];
    }
  }
  s.sites = 1;
}

/** Gueltigen Spielstand pruefen und angleichen, sonst null / validate and migrate a save, otherwise null */
const loaded = (s: unknown): GameState | null => (isValidState(s) ? migrateState(s) : null);

export function saveGame(s: GameState): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return loaded(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nichts / nothing */ }
}

export function exportFile(s: GameState) {
  const blob = new Blob([JSON.stringify(s)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frontverlauf-round${s.round}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importFile(): Promise<GameState | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(loaded(JSON.parse(await file.text())));
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

// ---------- Mehrere Speicherstaende / multiple save slots ----------

const SLOT_KEY = (i: number) => `frontverlauf.slot.v1.${i}`;
export const SAVE_SLOTS = 6;

export interface SlotInfo { slot: number; savedAt: number; round: number; faction: string; mode: string; size: number; name: string }

export function slotInfo(i: number): SlotInfo | null {
  try {
    const raw = localStorage.getItem(SLOT_KEY(i));
    if (!raw) return null;
    const d = JSON.parse(raw) as { info: SlotInfo };
    return d.info ?? null;
  } catch {
    return null;
  }
}

export function listSlots(): (SlotInfo | null)[] {
  return Array.from({ length: SAVE_SLOTS }, (_, i) => slotInfo(i));
}

export function saveToSlot(i: number, s: GameState, name: string): boolean {
  const human = s.factions.find((f) => f.human) ?? s.factions[0];
  const info: SlotInfo = { slot: i, savedAt: Date.now(), round: s.round, faction: human.id, mode: s.config.mode, size: s.size, name };
  try { localStorage.setItem(SLOT_KEY(i), JSON.stringify({ info, state: s })); return true; } catch { return false; }
}

export function loadFromSlot(i: number): GameState | null {
  try {
    const raw = localStorage.getItem(SLOT_KEY(i));
    if (!raw) return null;
    const d = JSON.parse(raw) as { state: unknown };
    return loaded(d.state);
  } catch {
    return null;
  }
}

export function deleteSlot(i: number) {
  try { localStorage.removeItem(SLOT_KEY(i)); } catch { /* nichts / nothing */ }
}
