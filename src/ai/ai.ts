/**
 * Computergegner: liefert Befehl fuer Befehl, damit die Oberflaeche den KI-Zug sichtbar abspielen kann.
 * Computer opponent: returns one command at a time so the UI can play the AI turn visibly.
 *
 * Deterministisch (kein Math.random), sieht nur Erkundetes und Sichtbares.
 * Deterministic (no Math.random), only uses explored tiles and visible units.
 */
import { applyCommand, cityById, type Command, type GameState } from '../core';
import { AI } from '../data/balance';
import { buildCtx } from './analysis';
import {
  planDiplomacy, planGrandProject, planPeaceResponses, planPurchase, planRewards,
} from './economy';
import { cmdKey, planAttack, planCapture, planConvert, planUnitMoves } from './tactics';

const END: Command = { type: 'endTurn' };

interface Memo {
  turnKey: string;
  count: number;
  /** Rechenzeit dieses Zuges in ms / compute time of this turn in ms */
  millis: number;
  lastFp: string;
  lastKey: string;
  /** Befehle ohne Wirkung (gescheitert) / commands without effect (failed) */
  failed: Set<string>;
}

const memos = new WeakMap<GameState, Memo>();

/** Diagnose fuer Tests / diagnostics for tests */
export const aiDebug = { errors: 0, lastError: null as unknown, maxTurnMillis: 0 };

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Fingerabdruck des fuer die Fraktion relevanten Zustands / fingerprint of the faction-relevant state */
function fingerprint(s: GameState, f: number): string {
  const fa = s.factions[f];
  const parts: (string | number)[] = [fa.stars, fa.techs.length, s.pendingRewards.length, s.nextId, fa.embassies.length, s.units.length, s.current, s.round];
  for (const g of s.factions) parts.push(g.peaceOffers.length, g.relations.join(''));
  for (const u of s.units) {
    if (u.owner !== f) continue;
    parts.push(u.id, u.x, u.y, u.hp, u.type, (u.moved ? 1 : 0) | (u.attacked ? 2 : 0) | (u.exhausted ? 4 : 0) | (u.moveDone ? 8 : 0));
  }
  for (const c of s.cities) if (c.owner === f) parts.push(c.id);
  return parts.join(',');
}

/** Pflichtschritte vor dem Zugende / mandatory steps before ending the turn */
function finishCommand(s: GameState, f: number, failed: Set<string>): Command {
  for (const p of s.pendingRewards) {
    const c = cityById(s, p.cityId);
    if (!c || c.owner !== f) continue;
    for (const choice of ['a', 'b'] as const) {
      const cmd: Command = { type: 'reward', city: c.id, choice };
      if (!failed.has(cmdKey(cmd))) return cmd;
    }
  }
  return END;
}

function plan(s: GameState, f: number, failed: Set<string>): Command {
  const ctx = buildCtx(s, f);
  return planRewards(ctx, failed)
    ?? planPeaceResponses(ctx, failed)
    ?? planGrandProject(ctx, failed)
    ?? planCapture(ctx, failed)
    ?? planConvert(ctx, failed)
    ?? planAttack(ctx, failed)
    ?? planUnitMoves(ctx, failed)
    ?? planPurchase(ctx, failed)
    ?? planDiplomacy(ctx, failed)
    ?? END;
}

/**
 * Naechster einzelner Befehl fuer Fraktion `faction` (muss s.current sein). {type:'endTurn'} wenn fertig.
 * Returns the next single command for faction `faction` (must be s.current). {type:'endTurn'} when done.
 */
export function planNextCommand(s: GameState, faction: number): Command {
  if (s.over || s.current !== faction || !s.factions[faction]?.alive) return END;
  const t0 = now();
  const turnKey = `${s.round}:${faction}`;
  let m = memos.get(s);
  if (!m || m.turnKey !== turnKey) {
    m = { turnKey, count: 0, millis: 0, lastFp: '', lastKey: '', failed: new Set() };
    memos.set(s, m);
  }
  const fp = fingerprint(s, faction);
  // Letzter Befehl ohne Wirkung? Dann nicht wiederholen / last command had no effect? then do not repeat it
  if (m.lastKey && m.lastFp === fp) m.failed.add(m.lastKey);
  m.count++;
  let cmd: Command;
  if (m.count > AI.maxCommandsPerTurn || m.millis > AI.maxMillis * 0.9) {
    cmd = finishCommand(s, faction, m.failed);
  } else {
    try {
      cmd = plan(s, faction, m.failed);
    } catch (e) {
      aiDebug.errors++;
      aiDebug.lastError = e;
      cmd = finishCommand(s, faction, m.failed);
    }
  }
  if (cmd.type === 'endTurn') cmd = finishCommand(s, faction, m.failed);
  m.lastKey = cmdKey(cmd);
  m.lastFp = fp;
  m.millis += now() - t0;
  aiDebug.maxTurnMillis = Math.max(aiDebug.maxTurnMillis, m.millis);
  return cmd;
}

/**
 * Spielt den ganzen KI-Zug (inkl. endTurn) und liefert die angewandten Befehle.
 * Plays the whole AI turn (incl. the final endTurn) and returns the applied commands.
 */
export function playAiTurn(s: GameState): Command[] {
  const f = s.current;
  const out: Command[] = [];
  for (let i = 0; i < AI.maxCommandsPerTurn + 10; i++) {
    if (s.over || s.current !== f) return out;
    const cmd = planNextCommand(s, f);
    const res = applyCommand(s, cmd);
    if (res.ok) out.push(cmd);
    if (cmd.type === 'endTurn' && res.ok) return out;
  }
  // Notausgang / emergency exit
  if (!s.over && s.current === f) {
    for (const p of s.pendingRewards.slice()) {
      const c = cityById(s, p.cityId);
      if (!c || c.owner !== f) continue;
      const cmd: Command = { type: 'reward', city: c.id, choice: 'a' };
      if (applyCommand(s, cmd).ok) out.push(cmd);
    }
    if (applyCommand(s, END).ok) out.push(END);
  }
  return out;
}
