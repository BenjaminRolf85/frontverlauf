/**
 * Oberflaeche der schwebenden Akademie (Velkar, ACADEMY): Kopf und Werte im Stadtfeld (Zustand, Schild, Ausbildung,
 * Posten, Beamer), Aktionen Abheben, Ziehen, Landen, Schutzschild und Beamer, Einheiten-Aktionen Beamen und Akademie
 * angreifen, Meldungen. Zahlen aus ACADEMY, Texte aus academy.* und beam.* (DE und EN).
 * UI of the floating academy (Velkar, ACADEMY): head and values in the city panel (state, shield, training, posts,
 * beamer), actions lift off, move, land, shield and beamer, unit actions beam and attack academy, toasts. Numbers from
 * ACADEMY, texts from academy.* and beam.* (DE and EN).
 * Landen heisst Terraformen (ACADEMY.terraform): "Terraformen und landen" mit Beschreibung, was aus dem Feld wird,
 * "Einebnen und landen" fuer benachbarte neutrale Orte (mit Rueckfrage), Statuszeile und Abbrechen.
 * Landing means terraforming (ACADEMY.terraform): "terraform and land" with a description of what the tile becomes,
 * "level and land" for adjacent neutral places (with a confirmation), status line and cancel.
 */
import {
  academyAttackCheck, academyAttackPreview, academyBusy, academyMoves, academyOf, area, beamCheck, beamerCheck, cancelTerraformCheck, cityById, cityIncome, landCheck, landTarget, liftCheck,
  postsOf, shieldCheck, shieldHp, terraformPlan, tileAt, trainSlots, trainedNow, unitLimit, supportedUnits, type City, type GameEvent, type GameState, type Pos, type Unit,
  beamFired, beamLevel, beamShots, hullHp, interceptsLeft, moduleCheck, moduleCost, moduleLevel, moduleMax, rayPreview, rayReadyCheck, rayTargets, shieldMaxHp, shieldRegen,
} from '../core';
import { ACADEMY, ACADEMY_MODULES, type AcademyModule } from '../data/balance';
import type { Controller } from '../game/controller';
import { t } from '../i18n/i18n';
import { cityNameOf } from '../i18n/cityNames';
import { actionButton, esc, factionBadge, iconButton, progress, type ActionItem } from './components';
import { icon } from './icons';

/** Symbole der Module / icons of the modules */
const MODULE_ICON: Record<AcademyModule, string> = { shield: 'shield', missiles: 'missile', armour: 'barrier', beam: 'tesla' };

const cname = (s: GameState, id: number) => (cityById(s, id) ? cityNameOf(s, id) : '');

/** Zustandszeile der Akademie / state line of the academy */
export function academyState(s: GameState, c: City): string {
  if (c.air?.phase === 'lifting') return t('academy.lifting');
  if (c.air?.phase === 'terraform') return t('academy.terraforming');
  if (c.air) return c.air.steps <= 0 ? t('academy.flyingDone') : c.air.steps === 1 ? t('academy.flying1') : t('academy.flying', { n: c.air.steps });
  if (academyBusy(s, c)) return t('academy.calm');
  return t('academy.grounded');
}

/** Schildzeile mit Balken (oder "kein Schild" und Wartezeit) / shield line with a bar (or "no shield" and the wait) */
export function shieldLine(s: GameState, c: City): string {
  const hp = shieldHp(c);
  if (hp > 0) {
    const txt = t('academy.shieldHp', { hp, max: c.shield!.max });
    return `<div class="row academy-shield">${icon('shield', 'icon-sm')}<span>${esc(txt)}</span><div class="grow">${progress(hp, c.shield!.max, 'shield', txt)}</div></div>`;
  }
  const wait = c.shieldReady !== undefined ? c.shieldReady - s.round : 0;
  return `<div class="row academy-shield muted">${icon('shield', 'icon-sm')}<span>${esc(wait > 0 ? t('academy.shieldWait', { n: wait }) : t('academy.noShield'))}</span></div>`;
}

/** Rumpfzeile (Panzerung) mit Balken, nur mit Modul / hull line (armour) with a bar, only with the module */
export function hullLine(c: City): string {
  if (!c.hull) return '';
  const hp = hullHp(c);
  const txt = t('academy.hullHp', { hp, max: c.hull.max });
  return `<div class="row academy-shield ${hp > 0 ? '' : 'muted'}">${icon('barrier', 'icon-sm')}<span>${esc(txt)}</span><div class="grow">${progress(hp, c.hull.max, 'hp', txt)}</div></div>`;
}

/**
 * Werte des Ausbaus: Neutronenstrahl (Schuesse), Abfaenge und Modulstufen, sichtbar ohne Tooltip (auch am Telefon).
 * Upgrade values: neutron beam (shots), interceptions and module levels, visible without a tooltip (phones too).
 */
export function moduleStats(s: GameState, c: City): string {
  const shots = beamShots(c), used = beamFired(s, c);
  const pd = moduleLevel(c, 'missiles');
  const tags = ACADEMY_MODULES.map((m) => {
    const n = m === 'beam' ? beamLevel(c) : moduleLevel(c, m), max = m === 'beam' ? moduleMax(m) + 1 : moduleMax(m);
    // Strahl: Stufe des Neutronenstrahls (1 eingebaut) / beam: level of the neutron beam (1 built in)
    return `<span class="tag ${n > 0 ? '' : 'muted'}">${icon(MODULE_ICON[m], 'icon-sm')}${esc(t('academy.modLevel', { name: m === 'beam' ? t('academy.beam') : t(`academy.mod.${m}.name`), n, max }))}</span>`;
  }).join('');
  const wait = beamWait(s, c);
  return `<div class="stats academy-modules"><span class="stat">${icon('tesla', 'icon-sm')}${esc(wait > 0 ? t('academy.beamWait', { n: wait }) : t('academy.beamShots', { n: Math.max(0, shots - used), max: shots }))}</span>
    ${pd ? `<span class="stat">${icon('missile', 'icon-sm')}${esc(t('academy.intercepts', { n: interceptsLeft(c), max: pd }))}</span>` : ''}</div>
    <div class="row wrap academy-modules sheet-more" aria-label="${esc(t('academy.upgrades'))}">${tags}</div>`;
}

/** Wirkung eines Moduls (mit den jetzigen Werten) / effect of a module (with the current values) */
export function moduleDesc(c: City, m: AcademyModule): string {
  const next = moduleLevel(c, m) + 1;
  if (m === 'shield') return t('academy.mod.shield.desc', { hp: shieldMaxHp(c), regen: shieldRegen(c) });
  if (m === 'armour') return t('academy.mod.armour.desc', { hp: ACADEMY.modules.armour.hp * Math.min(next, moduleMax(m)) });
  if (m === 'missiles') return t('academy.mod.missiles.desc', { n: Math.min(next, moduleMax(m)) });
  return t('academy.mod.beam.desc');
}

/** Runden, bis der Strahl nach seiner Ruhe wieder bereit ist (0 = bereit) / rounds until the beam is ready again after its rest (0 = ready) */
export const beamWait = (s: GameState, c: City): number => (c.rayReady !== undefined && c.rayReady > s.round ? c.rayReady - s.round : 0);

/**
 * Kopf und Werte fuer Akademie und Posten (fuer alle Betrachter; Gegner sehen Zustand und Schild).
 * Head and values for academy and post (for every viewer; opponents see state and shield).
 */
export function academySheet(s: GameState, c: City): { head: string; body: string } {
  const fid = s.factions[c.owner!].id;
  const name = cname(s, c.id);
  const sub = (kind: string, extra = '') => `<div class="muted unit-sub">${esc(kind)}${extra} · ${esc(t(`factions.${fid}.short`))}</div>`;
  if (c.post) {
    const ac = academyOf(s, c.owner!);
    const head = `${factionBadge(fid, 'researchPost')}<div class="grow"><h3 class="display" title="${esc(name)}">${esc(name)}</h3>${sub(t('academy.post'), c.base ? ` · ${t(`bases.name.${c.base}`)}` : '')}</div>`;
    const relay = c.relay ? `<span class="tag">${icon('beam', 'icon-sm')}${esc(t('beam.built'))}</span>` : '';
    const arriving = (s.transit ?? []).filter((b) => b.relay === c.id).length;
    const body = `<div class="row"><span class="stat">${icon('star', 'icon-sm')}${esc(t('hud.income'))} +${cityIncome(s, c)}</span>${relay}${arriving ? `<span class="tag">${esc(t('beam.pending', { n: arriving }))}</span>` : ''}</div>
      <p class="muted">${esc(t('academy.postDesc'))}${ac ? ` ${esc(t('academy.postOf', { city: cname(s, ac.id) }))}` : ''}</p>`;
    return { head, body };
  }
  const head = `${factionBadge(fid, 'academy')}<div class="grow"><h3 class="display" title="${esc(name)}">${esc(name)}</h3>${sub(t('academy.name'), ` · ${t('hud.level', { n: c.level })}`)}</div>`;
  const posts = postsOf(s, c.owner!).length;
  const transit = (s.transit ?? []).filter((b) => b.unit.owner === c.owner).length;
  const state = academyState(s, c);
  const air = !!c.air;
  // Terraformen: was aus dem Zielfeld wird, sichtbar ohne Tooltip (auch am Telefon) / terraforming: what the target tile becomes, visible without a tooltip (phones too)
  const tf = c.air?.phase === 'terraform' || c.air?.phase === 'flying' ? `<p class="muted academy-terraform">${esc(terraformHint(s, c))}</p>` : '';
  const body = `<div class="row academy-state ${air ? 'airborne' : ''}">${icon(air ? 'liftOff' : 'academy', 'icon-sm')}<strong>${esc(state)}</strong></div>
    ${tf}
    ${shieldLine(s, c)}
    ${hullLine(c)}
    ${moduleStats(s, c)}
    <div class="stats sheet-more"><span class="stat">${icon('helmet', 'icon-sm')}${esc(t('hud.units', { n: supportedUnits(s, c), max: unitLimit(s, c) }))}</span>
      <span class="stat">${icon('train', 'icon-sm')}${esc(t('academy.slots', { n: trainedNow(s, c), max: trainSlots(s, c) }))}</span>
      <span class="stat">${icon('researchPost', 'icon-sm')}${esc(t('academy.posts', { n: posts }))}</span>
      ${transit ? `<span class="stat">${icon('beam', 'icon-sm')}${esc(t('academy.transit', { n: transit }))}</span>` : ''}</div>
    <p class="muted sheet-more">${esc(t('academy.desc'))} ${esc(t('academy.airRule'))}</p>`;
  return { head, body };
}

/**
 * Beschreibung des Terraformens auf p: Zusatzrunde, was aus dem Feld wird, aufgenommener Rohstoff, Eingeebnetes.
 * Description of terraforming on p: extra round, what the tile becomes, absorbed resource, what is levelled.
 */
export function landDesc(s: GameState, c: City, p: Pos): string {
  const plan = terraformPlan(s, c, p);
  const tile = tileAt(s, p.x, p.y)!;
  const now = [t(`terrain.${plan.terrain}`), tile.biome && tile.biome !== 'grassland' ? t(`biomes.${tile.biome}`) : ''].filter(Boolean).join(' · ');
  const parts = [t('academy.landDesc', { into: (plan.reshape ? t('academy.terraformInto', { terrain: now }) : t('academy.terraformFlat')) })];
  if (plan.resource) parts.push(t('academy.landResource', { resource: t(`resources.${plan.resource}`) }));
  if (plan.cleared) parts.push(t('academy.landCleared', { what: t(plan.cleared in FEATURE_KEYS ? `academy.feature.${plan.cleared}` : `buildings.${plan.cleared}`) }));
  return parts.join(' ');
}
const FEATURE_KEYS: Record<string, true> = { bunker: true, radar: true, crashSite: true, labRuin: true };

/** Ziel des laufenden Terraformens (fuer das Brett) / target of the running terraforming (for the board) */
export const terraformTarget = (s: GameState, c: City): Pos | null => (c.air?.phase === 'terraform' ? landTarget(s, c) : null);

/**
 * Kurzzeile zum Terraformen: im Flug "Landen kostet eine Terraform-Runde ...", waehrend des Terraformens das Ziel.
 * Short terraforming line: in flight "landing takes a terraforming round ...", while terraforming the target.
 */
export function terraformHint(s: GameState, c: City): string {
  const p = landTarget(s, c);
  const plan = terraformPlan(s, c, p);
  const tile = tileAt(s, p.x, p.y)!;
  const now = [t(`terrain.${plan.terrain}`), tile.biome && tile.biome !== 'grassland' ? t(`biomes.${tile.biome}`) : ''].filter(Boolean).join(' · ');
  const into = (plan.reshape ? t('academy.terraformInto', { terrain: now }) : t('academy.terraformFlat'));
  return c.air?.phase === 'terraform' ? `${t('academy.terraformNext')} ${into}${plan.razed ? ` ${t('academy.razeWarn')}` : ''}` : `${t('academy.landHint')} ${into}`;
}

/** Aktionen der eigenen Akademie / actions of the own academy */
export function academyActions(s: GameState, g: Controller, c: City, err: (code: string) => string): ActionItem[] {
  const out: ActionItem[] = [];
  const f = c.owner!;
  if (!c.air) {
    const chk = liftCheck(s, f, c);
    out.push({ id: 'academy-lift', icon: 'liftOff', label: t('academy.lift'), variant: 'primary', enabled: chk === 'ok', desc: t('academy.liftDesc'),
      reason: chk === 'ok' ? t('academy.liftDesc') : err(chk), run: () => void g.exec({ type: 'liftAcademy', city: c.id }) });
  } else {
    const moves = academyMoves(s, c);
    const active = g.academyMoveCity === c.id;
    const moveReason = c.air.phase === 'lifting' ? err('lifting') : c.air.phase === 'terraform' ? err('terraforming') : c.air.steps <= 0 ? err('noSteps') : t('academy.moveDesc', { n: c.air.steps });
    out.push({ id: 'academy-move', icon: 'move', label: active ? t('actions.cancel') : t('academy.move'), variant: 'primary', enabled: active || moves.length > 0,
      desc: t('academy.moveDesc', { n: c.air.steps }), reason: moveReason, run: () => g.toggleAcademyMove(c.id) });
    if (c.air.phase === 'terraform') {
      // Terraformen laeuft: abbrechen (schwebt weiter, Felder des Zuges verbraucht) / terraforming running: cancel (keeps floating, the turn's tiles used up)
      const chk = cancelTerraformCheck(s, f, c);
      out.push({ id: 'academy-cancel', icon: 'close', label: t('academy.cancelTerraform'), enabled: chk === 'ok', desc: t('academy.cancelDesc'),
        reason: chk === 'ok' ? t('academy.cancelDesc') : err(chk), run: () => void g.exec({ type: 'cancelTerraform', city: c.id }) });
    } else {
      const chk = landCheck(s, f, c);
      const desc = landDesc(s, c, c);
      out.push({ id: 'academy-land', icon: 'land', label: t('academy.land'), variant: 'primary', enabled: chk === 'ok', desc,
        reason: chk === 'ok' ? desc : err(chk), run: () => void g.landAcademy(c.id) });
      // benachbarte neutrale Orte: einebnen und landen (mit Rueckfrage) / adjacent neutral places: level and land (with a confirmation)
      for (const p of area(s.size, c.x, c.y, 1)) {
        const id = tileAt(s, p.x, p.y)!.cityId;
        const v = id !== null && id !== c.id ? cityById(s, id) : undefined;
        if (!v || v.owner !== null || landCheck(s, f, c, p) !== 'ok') continue;
        const city = cname(s, v.id);
        const rd = `${t('academy.razeDesc', { city })} ${landDesc(s, c, p)}`;
        out.push({ id: `academy-raze-${v.id}`, icon: 'land', label: t('academy.raze'), sub: t('academy.razeSub', { city }), variant: 'danger', enabled: true, desc: rd, reason: rd,
          run: () => void g.landAcademy(c.id, { x: p.x, y: p.y }) });
      }
    }
  }
  // Neutronenstrahl: Zielauswahl mit Reichweite (ACADEMY.beam) / neutron beam: targeting with range (ACADEMY.beam)
  const ray = rayReadyCheck(s, f, c);
  const targets = ray === 'ok' ? rayTargets(s, c).length : 0;
  const shots = beamShots(c), used = beamFired(s, c);
  const wait = beamWait(s, c);
  const rayReason = ray === 'rayCooldown' ? t('academy.beamWait', { n: wait }) : ray !== 'ok' ? err(ray) : targets ? t('academy.beamPick') : t('academy.beamNone');
  out.push({ id: 'academy-beam', icon: 'tesla', label: t('academy.beam'), sub: wait > 0 ? t('academy.beamWait', { n: wait }) : t('academy.beamSub', { n: Math.max(0, shots - used), max: shots }), variant: 'danger',
    enabled: ray === 'ok' && targets > 0, desc: t('academy.beamDesc'), reason: rayReason, run: () => g.startBeam(c.id) });
  const sh = shieldCheck(s, f, c);
  if (sh !== 'alreadyBuilt') {
    const wait = c.shieldReady !== undefined && c.shieldReady > s.round && !academyBusy(s, c);
    out.push({ id: 'academy-shield', icon: 'shield', label: t('academy.shield'), cost: ACADEMY.shield.cost, variant: 'primary', enabled: sh === 'ok', desc: t('academy.shieldDesc'),
      reason: sh === 'ok' ? t('academy.shieldDesc') : wait ? t('academy.shieldWait', { n: c.shieldReady! - s.round }) : err(sh), run: () => void g.exec({ type: 'academyShield', city: c.id }) });
  }
  // Akademie-Ausbau: vier Module mit Stufe, Preis, Wirkung und Sperrgrund / academy upgrades: four modules with level, price, effect and blocking reason
  for (const m of ACADEMY_MODULES) {
    const chk = moduleCheck(s, f, c, m);
    if (chk === 'moduleMax') continue;
    const n = m === 'beam' ? beamLevel(c) : moduleLevel(c, m);
    const desc = moduleDesc(c, m);
    out.push({ id: `academy-mod-${m}`, icon: MODULE_ICON[m], label: t(`academy.mod.${m}.name`), sub: t('academy.modSub', { n: n + 1 }), cost: moduleCost(c, m), variant: 'primary',
      enabled: chk === 'ok', desc, reason: chk === 'ok' ? desc : err(chk), run: () => void g.exec({ type: 'academyModule', city: c.id, module: m }) });
  }
  return out;
}

/**
 * Zielauswahl "Neutronenstrahl": Kopf mit Reichweite, Statuszeile (Hinweis, angepeiltes Ziel mit Schaden, Sperrgrund),
 * Feuern und Abbrechen.
 * "Neutron beam" targeting: head with the range, status line (hint, aimed target with damage, blocking reason), fire and
 * cancel.
 */
export function beamSheet(s: GameState, g: Controller, err: (code: string) => string): { html: string; actions: ActionItem[] } {
  const c = cityById(s, g.beamCity!)!;
  const f = s.current;
  const n = rayTargets(s, c).length;
  let status = n ? t('academy.beamPick') : t('academy.beamNone'), cls = n ? '' : 'warn';
  let ok = false;
  if (g.beamAim) {
    const pre = rayPreview(s, f, c, g.beamAim.x, g.beamAim.y);
    ok = pre.check === 'ok';
    const name = pre.unit ? t(`units.${pre.unit.type}`) : t('academy.beamStructure');
    status = ok ? `${t('academy.beamTarget', { target: name, hp: pre.hp, dmg: pre.dmg })}${pre.kill ? ` ${t('academy.beamKill')}` : ''}. ${t('academy.beamConfirm')}` : err(pre.check);
    cls = ok ? '' : 'warn';
  }
  const shots = beamShots(c), used = beamFired(s, c);
  const actions: ActionItem[] = [
    { id: 'beamGo', icon: 'tesla', variant: 'danger', label: t('academy.beamFire'), enabled: ok, desc: t('academy.beamDesc'), reason: status, run: () => void g.fireBeam() },
    { id: 'beamCancel', icon: 'close', label: t('actions.cancel'), enabled: true, run: () => g.cancelBeam() },
  ];
  const head = `<div class="sheet-head"><span class="unit-badge orbital-head">${icon('tesla')}</span><div class="grow"><h3 class="display">${esc(t('academy.beam'))}</h3>
    <div class="muted unit-sub">${esc(t('stats.range'))} ${ACADEMY.beam.range} · ${esc(t('academy.beamSub', { n: Math.max(0, shots - used), max: shots }))} · ${esc(cname(s, c.id))}</div></div>${iconButton('close', t('actions.cancel'), 'beamCancel')}</div>`;
  const body = `<p class="orbital-status ${cls}" role="status" aria-live="polite">${cls ? icon('warning', 'icon-sm') : icon('info', 'icon-sm')}<span>${esc(status)}</span></p>`;
  const bar = `<div class="action-wrap"><div class="action-bar" role="toolbar">${actions.map(actionButton).join('')}</div></div>`;
  return { html: `${head}${body}${bar}`, actions };
}

/** Aktion des eigenen Postens: Beamer bauen / action of the own post: build the beamer */
export function postActions(s: GameState, g: Controller, c: City, err: (code: string) => string): ActionItem[] {
  if (c.relay) return [];
  const chk = beamerCheck(s, c.owner!, c);
  if (chk === 'invalidTarget') return [];
  return [{ id: 'beam-build', icon: 'beam', label: t('beam.build'), cost: ACADEMY.beamer.cost, variant: 'primary', enabled: chk === 'ok', desc: t('beam.buildDesc'),
    reason: chk === 'ok' ? t('beam.buildDesc') : err(chk), run: () => void g.exec({ type: 'buildBeamer', city: c.id }) }];
}

/**
 * Einheiten-Aktionen: zu jedem eigenen Relay beamen (gesperrt mit Grund) und die angewaehlte feindliche Akademie angreifen.
 * Unit actions: beam to every own relay (locked with a reason) and attack the selected hostile academy.
 */
export function unitAcademyActions(s: GameState, g: Controller, u: Unit, err: (code: string) => string): ActionItem[] {
  const out: ActionItem[] = [];
  const ac = academyOf(s, u.owner);
  if (ac) {
    for (const c of s.cities) {
      if (!c.relay || c.owner !== u.owner) continue;
      const chk = beamCheck(s, u, c);
      if (chk === 'notAtAcademy' || chk === 'invalid') continue;
      const city = cname(s, c.id);
      out.push({ id: `beam-${c.id}`, icon: 'beam', label: t('beam.action', { city }), enabled: chk === 'ok', desc: t('beam.actionDesc', { city }),
        reason: chk === 'ok' ? t('beam.actionDesc', { city }) : err(chk), run: () => void g.exec({ type: 'beam', unit: u.id, city: c.id }) });
    }
  }
  const target = g.pendingAcademy !== null ? cityById(s, g.pendingAcademy) : undefined;
  if (target && target.academy) {
    const chk = academyAttackCheck(s, u, target);
    if (chk === 'ok' || chk === 'airTarget') {
      const pre = academyAttackPreview(s, u, target);
      const sub = pre.intercept ? t('academy.attackIntercept') : pre.forced ? t('academy.attackForce') : pre.layer === 'hull' ? t('academy.attackHull', { dmg: pre.toShield }) : t('academy.attackShield', { dmg: pre.toShield });
      out.push({ id: 'attackAcademy', icon: 'attack', variant: 'danger', label: t('academy.attack'), sub, enabled: chk === 'ok', desc: `${sub}. ${t('academy.attackDesc')}`,
        reason: chk === 'ok' ? `${sub}. ${t('academy.attackDesc')}` : err(chk), run: () => void g.exec({ type: 'attackAcademy', unit: u.id, city: target.id }) });
    }
  }
  return out;
}

/**
 * Meldung zu Akademie-, Schild-, Posten- und Beamer-Ereignissen fuer den Betrachter (null = keine).
 * Toast for academy, shield, post and beamer events for the viewer (null = none).
 */
export function academyToast(e: GameEvent, s: GameState, viewer: number): { text: string; icon: string } | null {
  const seen = (x: number, y: number) => viewer < 0 || s.factions[viewer]?.explored[y * s.size + x] === 1;
  if (e.t === 'academy') {
    const city = cname(s, e.city);
    if (e.faction !== viewer && !(e.what === 'forced' && seen(e.x, e.y))) return null;
    if (e.what === 'land' && e.razed) return { text: t('academy.toastRazed', { city, kind: t(`academy.razed.${e.razed}`) }), icon: 'land' };
    if (e.what === 'land' && (e.terrain || e.biome)) return { text: t('academy.toastLandTerraform', { city, terrain: e.terrain ? t(`terrain.${e.terrain}`) : t(`biomes.${e.biome}`) }), icon: 'land' };
    const key = { lift: 'toastLift', float: 'toastFloat', move: '', land: 'toastLand', forced: 'toastForced', transfer: 'toastTransfer', terraform: 'toastTerraform', cancel: 'toastCancel', abort: 'toastAbort' }[e.what];
    return key ? { text: t(`academy.${key}`, { city }), icon: e.what === 'forced' || e.what === 'abort' ? 'warning' : e.what === 'land' || e.what === 'terraform' ? 'land' : 'liftOff' } : null;
  }
  if (e.t === 'shield') {
    if (e.what !== 'built' && e.what !== 'down') return null;
    const c = cityById(s, e.city);
    if (!c || (e.faction !== viewer && !seen(c.x, c.y))) return null;
    return { text: t(e.what === 'built' ? 'academy.toastShield' : 'academy.toastShieldDown', { city: cname(s, e.city) }), icon: e.what === 'built' ? 'shield' : 'warning' };
  }
  if (e.t === 'module') {
    if (e.faction !== viewer) return null;
    return { text: t('academy.toastModule', { city: cname(s, e.city), name: t(`academy.mod.${e.module}.name`), n: e.module === 'beam' ? e.level + 1 : e.level }), icon: MODULE_ICON[e.module] };
  }
  if (e.t === 'intercept') {
    if (e.faction !== viewer) return null;
    return { text: t('academy.toastIntercept', { city: cname(s, e.city), n: e.left }), icon: 'missile' };
  }
  if (e.t === 'hull' && e.what === 'down') {
    const c = cityById(s, e.city);
    if (!c || (e.faction !== viewer && !seen(c.x, c.y))) return null;
    return { text: t('academy.toastHullDown', { city: cname(s, e.city) }), icon: 'warning' };
  }
  if (e.t === 'post') {
    if (e.faction !== viewer) return null;
    return { text: t('academy.toastPost', { city: cname(s, e.city), pop: e.pop }), icon: 'researchPost' };
  }
  if (e.t === 'beam') {
    if (e.faction !== viewer) return null;
    const city = cname(s, e.city);
    const unit = e.unitType ? t(`units.${e.unitType}`) : '';
    const key = { built: 'toastBuilt', depart: 'toastDepart', arrive: 'toastArrive', return: 'toastReturn' }[e.what];
    return { text: t(`beam.${key}`, { city, unit }), icon: e.what === 'return' ? 'warning' : 'beam' };
  }
  return null;
}
