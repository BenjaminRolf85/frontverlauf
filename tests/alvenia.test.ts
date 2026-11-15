/**
 * Heiliges Alvenia: Suende und Strafgericht, Maertyrer-Segen, eigene Bauarten, Grosses Strafgericht, alte Spielstaende, KI.
 * Holy Alvenia: sin and judgement, Martyr's Blessing, own designs, Great Judgement, old saves, AI.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand, blessingOf, combatPreview, createGame, defaultConfig, effectiveDefense, isSinner, judgementAt, judgementNeed, returnFire,
  rewardOptions, rosterUnits, sinDeed, sinRoundsLeft, trainCheck, unitCost, victoryStatus, type GameEvent, type GameState,
} from '../src/core';
import {
  AI, ALVENIA_UNITS, FACTIONS, HOME_DEFENSE, MARTYR, SIN, UNITS, VARIANTS, VICTORY_TECH, WONDERS, type FactionId,
} from '../src/data/balance';
import { isValidState, migrateState } from '../src/save/save';
import { planNextCommand } from '../src/ai/ai';
import { stationaryOnly } from '../src/ui/hud';
import { addCity, addUnit, blankGame, ok, revealAll, unit, untilTurnOf } from './helpers';

/** Alvenia (0) gegen b (1), beide mit Hauptquartier, alles aufgedeckt / Alvenia (0) against b (1), both with HQ, all revealed */
function duel(b: FactionId = 'korvat', extra: Parameters<typeof blankGame>[0] = {}): GameState {
  const s = blankGame({ factions: ['alvenia', b], stars: 300, ...extra });
  addCity(s, 1, 1, 0, { hq: true });
  addCity(s, 9, 9, 1, { hq: true });
  revealAll(s, 0); revealAll(s, 1);
  return s;
}
/** Zug an Fraktion f geben, ohne Zugbeginn zu verarbeiten / hand the turn to faction f without processing a turn start */
const actAs = (s: GameState, f: number) => { s.current = f; for (const u of s.units) if (u.owner === f) { u.fresh = false; u.exhausted = false; u.moved = false; u.attacked = false; u.moveDone = false; } };
const sinEvents = (evs: GameEvent[]) => evs.filter((e): e is Extract<GameEvent, { t: 'sin' }> => e.t === 'sin');

describe('Suende / sin', () => {
  it('Eroberung einer fremden Stadt zeichnet die Fraktion SIN.rounds Runden, die Tat-Runde zaehlt mit / capturing a foreign city marks the faction for SIN.rounds rounds, the round of the deed counts', () => {
    const s = blankGame({ factions: ['alvenia', 'korvat', 'dravon'], stars: 100 });
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true }); addCity(s, 9, 1, 2, { hq: true });
    const c = addCity(s, 5, 5, 2);
    addCity(s, 5, 8, 2);
    const inf = addUnit(s, 'infantry', 1, 5, 5);
    actAs(s, 1);
    expect(isSinner(s, 1)).toBe(false);
    const r = ok(s, { type: 'capture', unit: inf.id });
    expect(c.owner).toBe(1);
    const ev = sinEvents(r.events);
    expect(ev).toEqual([{ t: 'sin', faction: 1, deed: 'capture', until: s.round + SIN.rounds - 1, fresh: true }]);
    expect(sinDeed(s, 1)).toBe('capture');
    expect(sinRoundsLeft(s, 1)).toBe(SIN.rounds);
    // Ablauf: nach SIN.rounds Runden nicht mehr gezeichnet / expiry: no longer marked after SIN.rounds rounds
    const start = s.round;
    s.round = start + SIN.rounds - 1;
    expect(isSinner(s, 1)).toBe(true);
    expect(sinRoundsLeft(s, 1)).toBe(1);
    s.round = start + SIN.rounds;
    expect(isSinner(s, 1)).toBe(false);
    expect(sinRoundsLeft(s, 1)).toBe(0);
  });

  it('eine neue Tat frischt das Zeichen auf, ohne neue Meldung / a new deed refreshes the mark without a new toast', () => {
    const s = duel('korvat');
    s.factions[1].relations[0] = 'peace'; s.factions[0].relations[1] = 'peace';
    s.factions[1].sin = { deed: 'capture', until: s.round };
    actAs(s, 1);
    const r = ok(s, { type: 'diplomacy', action: 'announceBreak', target: 0 });
    expect(sinEvents(r.events)).toEqual([{ t: 'sin', faction: 1, deed: 'breakPeace', until: s.round + SIN.rounds - 1, fresh: false }]);
    expect(sinDeed(s, 1)).toBe('breakPeace');
  });

  it('Pluendern, Brandschatzen und Bekehren durch den Kult / plundering, burning and converting by the cult', () => {
    const s = blankGame({ factions: ['alvenia', 'vesper', 'korvat'], stars: 100 });
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true }); addCity(s, 1, 9, 2, { hq: true });
    s.factions[1].techs.push('forestry', 'camouflage');
    // Pluendern einer Siedlung / plundering a settlement
    addCity(s, 5, 5, null);
    const z = addUnit(s, 'zealot', 1, 5, 5);
    actAs(s, 1);
    let r = ok(s, { type: 'capture', unit: z.id });
    expect(r.events.some((e) => e.t === 'capture' && (e.plunder ?? 0) > 0)).toBe(true);
    expect(sinEvents(r.events)[0]).toMatchObject({ faction: 1, deed: 'plunder', fresh: true });
    // Brandschatzen: Angriff mit Fackeltraeger / burning: attack with a torchbearer
    s.factions[1].sin = undefined;
    const tb = addUnit(s, 'torchbearer', 1, 3, 3);
    const v = addUnit(s, 'infantry', 2, 3, 4);
    actAs(s, 1);
    r = ok(s, { type: 'attack', unit: tb.id, target: v.id });
    expect(sinEvents(r.events)[0]).toMatchObject({ faction: 1, deed: 'burn' });
    // Bekehren / converting
    s.factions[1].sin = undefined;
    const pr = addUnit(s, 'prophet', 1, 7, 3);
    const w = addUnit(s, 'jeep', 2, 7, 4);
    actAs(s, 1);
    r = ok(s, { type: 'convert', unit: pr.id, target: w.id });
    expect(sinEvents(r.events)[0]).toMatchObject({ faction: 1, deed: 'convert' });
  });

  it('Frevel: ein Angriff auf Alvenia zeichnet erst nach dem Treffer / sacrilege: an attack on Alvenia marks only after the hit', () => {
    const s = duel('korvat');
    const a = addUnit(s, 'infantry', 1, 5, 5);
    const d = addUnit(s, 'lightWarden', 0, 5, 6);
    actAs(s, 1);
    const pre = combatPreview(s, a, d);
    const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
    const att = r.events.find((e) => e.t === 'attack')!;
    // Gegenschlag ohne Strafgericht, wie in der Vorschau / return fire without judgement, as in the preview
    expect(att.t === 'attack' && att.ret).toBe(pre.toAttacker);
    expect(sinEvents(r.events)[0]).toMatchObject({ faction: 1, deed: 'sacrilege', fresh: true });
  });

  it('ohne lebende richtende Fraktion keine Zeichen; Alvenia selbst wird nie gezeichnet / no marks without a living judging faction; Alvenia itself is never marked', () => {
    const s = blankGame({ factions: ['korvat', 'dravon'], stars: 100 });
    addCity(s, 1, 1, 0, { hq: true }); addCity(s, 9, 9, 1, { hq: true }); addCity(s, 5, 5, 1); addCity(s, 5, 8, 1);
    const inf = addUnit(s, 'infantry', 0, 5, 5);
    actAs(s, 0);
    expect(sinEvents(ok(s, { type: 'capture', unit: inf.id }).events)).toHaveLength(0);
    expect(s.factions[0].sin).toBeUndefined();
    const t = duel('korvat');
    addCity(t, 5, 5, 1); addCity(t, 5, 8, 1);
    const w = addUnit(t, 'lightWarden', 0, 5, 5);
    actAs(t, 0);
    expect(sinEvents(ok(t, { type: 'capture', unit: w.id }).events)).toHaveLength(0);
    expect(isSinner(t, 0)).toBe(false);
  });
});

describe('Gottlos / godless', () => {
  it('Ausserirdische und Roboter sind dauerhaft Suender, solange Alvenia lebt; Menschen und Kult nicht / aliens and robots are permanent sinners while Alvenia lives; humans and the cult are not', () => {
    const s = blankGame({ factions: ['alvenia', 'zyrr', 'nexus', 'korvat', 'vesper'], stars: 100 });
    for (let g = 0; g < 5; g++) addCity(s, 1 + g * 2, 1, g, { hq: true });
    expect(SIN.godless).toEqual(['alien', 'robot']);
    for (const f of [1, 2]) {
      expect(isSinner(s, f)).toBe(true);
      expect(sinDeed(s, f)).toBe('godless');
      expect(sinRoundsLeft(s, f)).toBe(Infinity);
    }
    expect(isSinner(s, 0)).toBe(false);
    expect(isSinner(s, 3)).toBe(false);
    expect(isSinner(s, 4)).toBe(false);
    // dauerhaft: auch viele Runden spaeter / permanent: also many rounds later
    s.round += 50;
    expect(isSinner(s, 1)).toBe(true);
    // Strafgericht gegen Gottlose / judgement against the godless
    const a = addUnit(s, 'lightWarden', 0, 5, 4);
    const g = addUnit(s, 'grey', 1, 5, 6);
    expect(combatPreview(s, a, g).judgement).toBe(SIN.judgement);
    // keine neue Meldung bei einer Tat / no new toast on a deed
    addCity(s, 7, 7, 3); addCity(s, 7, 9, 3);
    const gr = addUnit(s, 'grey', 1, 7, 7);
    actAs(s, 1);
    const ev = sinEvents(ok(s, { type: 'capture', unit: gr.id }).events);
    expect(ev[0]).toMatchObject({ faction: 1, deed: 'capture', fresh: false });
    // ohne lebende richtende Fraktion kein Zeichen / without a living judging faction no mark
    s.factions[0].alive = false;
    expect(isSinner(s, 2)).toBe(false);
  });
});

describe('Strafgericht / judgement', () => {
  it(`+${Math.round(SIN.judgement * 100)} % Schaden gegen Suender, Vorschau gleich dem echten Schaden / +${Math.round(SIN.judgement * 100)} % damage against sinners, preview equals actual damage`, () => {
    const s = duel('korvat');
    const a = addUnit(s, 'lightWarden', 0, 5, 4);
    const d = addUnit(s, 'infantry', 1, 5, 6);
    actAs(s, 0);
    const clean = combatPreview(s, a, d);
    expect(clean.judgement).toBe(0);
    s.factions[1].sin = { deed: 'capture', until: s.round + 2 };
    expect(judgementAt(s, a, d)).toBe(SIN.judgement);
    const pre = combatPreview(s, a, d);
    expect(pre.judgement).toBe(SIN.judgement);
    expect(pre.toDefender).toBeGreaterThan(clean.toDefender);
    const hp = d.hp;
    const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
    const att = r.events.find((e) => e.t === 'attack')!;
    expect(att.t === 'attack' && att.dmg).toBe(pre.toDefender);
    expect(unit(s, d.id)!.hp).toBe(hp - pre.toDefender);
    // Fremde Fraktionen bekommen keinen Bonus / other factions get no bonus
    const o = addUnit(s, 'infantry', 1, 2, 2);
    const k = addUnit(s, 'infantry', 0, 2, 3);
    expect(judgementAt(s, o, k)).toBe(0);
  });

  it('mit Trefferglueck: Vorschau und echter Treffer stimmen je Trefferart / with hit luck: preview and actual hit agree per hit kind', () => {
    const s = duel('korvat', { hitChance: true });
    s.factions[1].sin = { deed: 'burn', until: s.round + 3 };
    for (let i = 0; i < 6; i++) {
      const a = addUnit(s, 'sunLance', 0, 2 + i, 3);
      const d = addUnit(s, 'infantry', 1, 2 + i, 6);
      actAs(s, 0);
      const pre = combatPreview(s, a, d);
      const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
      const att = r.events.find((e) => e.t === 'attack');
      if (att?.t !== 'attack') throw new Error('no attack');
      const mult = { miss: 0, graze: 0.5, partial: 0.8, full: 1, crit: 1.5 }[att.hit ?? 'full'];
      expect(att.dmg).toBe(Math.round(pre.toDefender * mult));
      s.units = s.units.filter((u) => u.id !== d.id);
    }
  });

  it('Gegenschlag: Alvenia richtet auch einen suendigen Angreifer / return fire: Alvenia also judges a sinful attacker', () => {
    const s = duel('korvat');
    const a = addUnit(s, 'infantry', 1, 5, 5);
    const d = addUnit(s, 'peacekeeper', 0, 5, 6);
    const plain = returnFire(s, a, d, d.hp - 3);
    s.factions[1].sin = { deed: 'capture', until: s.round };
    expect(returnFire(s, a, d, d.hp - 3)).toBeGreaterThan(plain);
    actAs(s, 1);
    const pre = combatPreview(s, a, d);
    const r = ok(s, { type: 'attack', unit: a.id, target: d.id });
    const att = r.events.find((e) => e.t === 'attack')!;
    expect(att.t === 'attack' && att.ret).toBe(pre.toAttacker);
  });
});

describe('Maertyrer-Segen / Martyr\'s Blessing', () => {
  it('faellt eine Alvenia-Einheit, heilen und staerken sich die Nachbarn / when an Alvenia unit falls, its neighbours heal and grow stronger', () => {
    const s = duel('korvat');
    const victim = addUnit(s, 'lightWarden', 0, 5, 5, { hp: 1 });
    const n1 = addUnit(s, 'lightWarden', 0, 5, 4, { hp: 4 });
    const n2 = addUnit(s, 'peacekeeper', 0, 4, 5, { hp: UNITS.peacekeeper.hp - 1 });
    const far = addUnit(s, 'lightWarden', 0, 1, 4, { hp: 4 });
    const a = addUnit(s, 'infantry', 1, 6, 5);
    const def0 = effectiveDefense(s, n1);
    actAs(s, 1);
    const r = ok(s, { type: 'attack', unit: a.id, target: victim.id });
    expect(unit(s, victim.id)).toBeUndefined();
    const b = r.events.find((e) => e.t === 'blessing');
    expect(b).toMatchObject({ t: 'blessing', unit: victim.id, faction: 0, x: 5, y: 5, until: s.round + MARTYR.rounds - 1 });
    expect(unit(s, n1.id)!.hp).toBe(4 + MARTYR.heal);
    // nie ueber die vollen LP / never above full HP
    expect(unit(s, n2.id)!.hp).toBe(UNITS.peacekeeper.hp);
    expect(unit(s, far.id)!.hp).toBe(4);
    expect(blessingOf(s, unit(s, n1.id)!)).toBe(MARTYR.defense);
    expect(effectiveDefense(s, unit(s, n1.id)!)).toBeCloseTo(def0 * (1 + MARTYR.defense));
    expect(blessingOf(s, unit(s, far.id)!)).toBe(0);
    // gesegnet: der Gegner macht weniger Schaden, die Vorschau zeigt es / blessed: the enemy deals less damage, the preview shows it
    const e = addUnit(s, 'infantry', 1, 6, 4);
    expect(combatPreview(s, e, unit(s, n1.id)!).blessing).toBe(MARTYR.defense);
    // Ablauf nach MARTYR.rounds Runden / expiry after MARTYR.rounds rounds
    s.round += MARTYR.rounds;
    expect(blessingOf(s, unit(s, n1.id)!)).toBe(0);
  });

  it('nur fuer Alvenia und nur im Kampf / only for Alvenia and only in battle', () => {
    const s = duel('korvat');
    const victim = addUnit(s, 'infantry', 1, 5, 5, { hp: 1 });
    addUnit(s, 'infantry', 1, 5, 4, { hp: 4 });
    const a = addUnit(s, 'lightWarden', 0, 5, 7);
    actAs(s, 0);
    const r = ok(s, { type: 'attack', unit: a.id, target: victim.id });
    expect(r.events.some((e) => e.t === 'blessing')).toBe(false);
  });
});

describe('Eigene Bauarten / own designs', () => {
  it('Lichtschuetzen, Reliquiar und Sonnenlanze ersetzen Infanterie, Panzer und Artillerie / Light Wardens, Reliquary and Sun Lance replace infantry, tank and artillery', () => {
    expect(VARIANTS.alvenia).toEqual({ infantry: 'lightWarden', tank: 'reliquary', artillery: 'sunLance' });
    const s = createGame(defaultConfig({ seed: 7, size: 16, factions: (['alvenia', 'korvat', 'vesper'] as FactionId[]).map((id) => ({ id, human: false, difficulty: 'normal' as const })) }));
    const list = rosterUnits(s, 0);
    for (const t of ['lightWarden', 'sunLance'] as const) expect(list).toContain(t);
    for (const t of ['infantry', 'artillery', 'tank'] as const) expect(list).not.toContain(t);
    // Start mit Lichtschuetzen / start with Light Wardens
    expect(s.units.find((u) => u.owner === 0)!.type).toBe('lightWarden');
    // die anderen behalten ihre Truppen / the others keep their troops
    expect(rosterUnits(s, 1)).toContain('infantry');
    expect(s.units.find((u) => u.owner === 1)!.type).toBe('infantry');
    // Stadtbelohnung: Reliquiar / city reward: Reliquary
    const hq = s.cities.find((c) => c.owner === 0)!;
    expect(trainCheck(s, hq, 'infantry')).toBe('invalid');
    expect(trainCheck(s, hq, 'lightWarden')).not.toBe('invalid');
  });

  it('Werte: Reichweite, Verteidigung, nur aus dem Stand, Rabatt / stats: range, defence, stationary only, discount', () => {
    expect(UNITS.lightWarden.range).toBe(2);
    expect(UNITS.lightWarden.defense).toBeGreaterThan(UNITS.infantry.defense);
    expect(UNITS.reliquary.range).toBe(2);
    expect(UNITS.reliquary.defense).toBeGreaterThan(UNITS.tank.defense);
    expect(UNITS.reliquary.cost).toBeNull();
    expect(UNITS.sunLance.range).toBeGreaterThan(UNITS.artillery.range);
    for (const t of ALVENIA_UNITS) {
      expect(UNITS[t].faction).toBe('alvenia');
      expect(UNITS[t].abilities).not.toContain('dash');
      expect(stationaryOnly(t)).toBe(true);
    }
    expect(FACTIONS.alvenia.discountUnit).toBe('sunLance');
    const s = duel('korvat');
    expect(unitCost(s, 0, 'sunLance')).toBe(Math.ceil(UNITS.sunLance.cost! * (1 - FACTIONS.alvenia.discount)));
    // nach einer Bewegung kein Schuss / no shot after moving
    const w = addUnit(s, 'lightWarden', 0, 4, 4);
    addUnit(s, 'infantry', 1, 4, 7);
    actAs(s, 0);
    ok(s, { type: 'move', unit: w.id, to: { x: 4, y: 5 } });
    expect(applyCommand(s, { type: 'attack', unit: w.id, target: s.units.find((u) => u.owner === 1 && u.type === 'infantry')!.id }).error).toBe('cannotAttack');
  });

  it('Stadtbelohnung Panzer wird zum Reliquiar / the tank city reward becomes a Reliquary', () => {
    const s = duel('korvat');
    const c = s.cities.find((x) => x.owner === 0)!;
    s.pendingRewards.push({ cityId: c.id, level: 5 });
    actAs(s, 0);
    expect(rewardOptions(c, 5)[1]).toBe('tank');
    ok(s, { type: 'reward', city: c.id, choice: 'b' });
    expect(s.units.some((u) => u.owner === 0 && u.type === 'reliquary')).toBe(true);
    expect(s.units.some((u) => u.owner === 0 && u.type === 'tank')).toBe(false);
  });
});

describe('Grosses Strafgericht / Great Judgement', () => {
  it('Abschuesse von Suendern zaehlen nur mit Siegtechnologie, Sieg beim Ziel / kills of sinners count only with the victory tech, victory at the goal', () => {
    const s = duel('korvat', { mode: 'points', roundLimit: 30 });
    s.config.factionVictory = true;
    expect(VICTORY_TECH.alvenia).toBe('greatJudgement');
    const need = judgementNeed(s);
    // Zweikampf: Ziel x WONDERS.judgementByRivals[1] / duel: goal x WONDERS.judgementByRivals[1]
    expect(need).toBe(Math.round(WONDERS.judgementKills[11] * WONDERS.judgementByRivals[1]));
    const kill = () => {
      const v = addUnit(s, 'infantry', 1, 6, 6, { hp: 1 });
      const a = addUnit(s, 'lightWarden', 0, 6, 4);
      actAs(s, 0);
      ok(s, { type: 'attack', unit: a.id, target: v.id });
      s.units = s.units.filter((u) => u.id !== a.id);
    };
    // ohne Suende zaehlt nichts / without sin nothing counts
    s.factions[0].techs.push('greatJudgement');
    kill();
    expect(s.factions[0].judged ?? 0).toBe(0);
    // ohne Technik zaehlt nichts / without the tech nothing counts
    s.factions[0].techs = s.factions[0].techs.filter((t) => t !== 'greatJudgement');
    s.factions[1].sin = { deed: 'capture', until: 99 };
    kill();
    expect(s.factions[0].judged ?? 0).toBe(0);
    s.factions[0].techs.push('greatJudgement');
    kill(); kill();
    expect(s.factions[0].judged).toBe(2);
    expect(victoryStatus(s, 0)).toMatchObject({ goal: 'judgement', phase: 'judgement', have: 2, need, tech: true });
    s.factions[0].judged = need - 1;
    kill();
    expect(s.factions[0].judged).toBe(need);
    expect(s.over).toBe(false);
    untilTurnOf(s, 0);
    expect(s.over).toBe(true);
    expect(s.victory).toEqual({ kind: 'faction', faction: 'alvenia' });
  });

  it('Ziel waechst mit der Kartengroesse und sinkt mit mehr Gegnern / the goal grows with the map size and drops with more rivals', () => {
    for (let i = 1; i < WONDERS.judgementByRivals.length; i++) expect(WONDERS.judgementByRivals[i]).toBeLessThanOrEqual(WONDERS.judgementByRivals[i - 1]);
    const five = blankGame({ factions: ['alvenia', 'korvat', 'dravon', 'meridon', 'velkar'] });
    expect(judgementNeed(five)).toBe(WONDERS.judgementKills[11]);
    const sizes = Object.keys(WONDERS.judgementKills).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < sizes.length; i++) expect(WONDERS.judgementKills[sizes[i] as 14]).toBeGreaterThan(WONDERS.judgementKills[sizes[i - 1] as 14]);
  });
});

describe('Alte Spielstaende / old saves', () => {
  it('Voelkerbund-Charta wird zum Grossen Strafgericht, fehlende Felder gelten als nie gesetzt / League Charter becomes the Great Judgement, missing fields count as never set', () => {
    const s = duel('korvat');
    const old = JSON.parse(JSON.stringify(s)) as GameState & { factions: { league?: number }[] };
    old.factions[0].techs.push('leagueCharter' as never);
    old.factions[0].league = 3;
    for (const f of old.factions) { delete f.sin; delete f.judged; }
    for (const u of old.units) delete u.blessed;
    expect(isValidState(old)).toBe(true);
    const m = migrateState(old);
    expect(m.factions[0].techs).toContain('greatJudgement');
    expect(m.factions[0].techs).not.toContain('leagueCharter');
    expect((m.factions[0] as { league?: number }).league).toBeUndefined();
    expect(isSinner(m, 1)).toBe(false);
    expect(victoryStatus(m, 0)).toMatchObject({ have: 0, tech: true });
    // geladenes Spiel laeuft weiter / the loaded game keeps running
    const a = addUnit(m, 'lightWarden', 0, 5, 4);
    const d = addUnit(m, 'infantry', 1, 5, 6);
    actAs(m, 0);
    expect(combatPreview(m, a, d).judgement).toBe(0);
    ok(m, { type: 'attack', unit: a.id, target: d.id });
    expect(JSON.parse(JSON.stringify(m)).factions[0].techs).toContain('greatJudgement');
  });
});

describe('KI / AI', () => {
  it('Alvenia gegen Kult und andere: 30 Runden ohne Fehlbefehl, kein Friedensbruch durch Alvenia / Alvenia against the cult and others: 30 rounds without failed commands, no breach of peace by Alvenia', () => {
    for (const [seed, ids] of [[3, ['alvenia', 'vesper', 'korvat']], [11, ['vesper', 'alvenia']], [5, ['dravon', 'alvenia', 'meridon', 'vesper']]] as [number, FactionId[]][]) {
      const s = createGame(defaultConfig({
        seed, size: 14, mode: 'points', mapType: 'continent', roundLimit: 30,
        factions: ids.map((id) => ({ id, human: false, difficulty: 'normal' as const })),
      }));
      const a = s.factions.findIndex((f) => f.id === 'alvenia');
      let failed = 0, breaks = 0, sins = 0, blessings = 0;
      while (!s.over && s.round <= 30) {
        const f = s.current;
        for (let i = 0; i < AI.maxCommandsPerTurn + 5 && !s.over; i++) {
          const cmd = planNextCommand(s, f);
          const res = applyCommand(s, cmd);
          if (!res.ok) failed++;
          if (res.ok && f === a && cmd.type === 'diplomacy' && cmd.action === 'announceBreak') breaks++;
          for (const e of res.events) { if (e.t === 'sin') sins++; if (e.t === 'blessing') blessings++; }
          if (cmd.type === 'endTurn' && res.ok) break;
        }
      }
      expect(failed, `seed ${seed}`).toBe(0);
      expect(breaks, `seed ${seed}`).toBe(0);
      expect(s.factions[a].sin).toBeUndefined();
      // mit dem Kult gibt es Suender / with the cult there are sinners
      expect(sins, `seed ${seed}`).toBeGreaterThan(0);
      expect(blessings + sins).toBeGreaterThan(0);
    }
  }, 120_000);

  it('Glaubensbollwerk ist staerker als das alte Friedensbollwerk / the Bulwark of Faith is stronger than the old Peace Bulwark', () => {
    expect(HOME_DEFENSE.bonus.alvenia).toBeGreaterThan(0.25);
  });
});
