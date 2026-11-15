/**
 * Kampagne in der Oberflaeche: Fraktionswahl, Einsatzliste nach Akten, Comic-Besprechung mit Portraets,
 * Ziel-Panel im Spiel und Ergebnis mit Sternen, Epilog und Zeitschleife nach dem Finale.
 * Campaign UI: faction picker, mission list by acts, comic briefing with portraits, in-game objective panel
 * and result screen with stars, epilogue and time loop after the finale.
 */
import { audio } from '../audio/audio';
import './campaign.css';
import {
  CAMPAIGN_FACTIONS, FINALE_ID, MISSIONS, MISSION_IDS, allyFor, missionById, missionConfig, objectiveProgress, isHoldObjective, panelOf,
  type GameEvent, type GameState, type MissionDef, type ObjectiveDef, type ObjectiveStatus, type Speaker,
} from '../core';
import { PERSUADE, UNITS, type FactionId } from '../data/balance';
import { t, tList } from '../i18n/i18n';
import {
  chooseFaction, clearNotice, currentMissionId, isCompleted, isUnlocked, loadStore, loopDone, loopsDone, nextMissionId, recordRunResult,
  runOf, saveStore, totalStars,
} from '../save/progress';
import { button, esc, factionBadge, factionChip, iconButton, openDialog, toast } from './components';
import { icon } from './icons';
import { leaderPortrait } from './leaders';
import { openPrologue } from './lore';
import type { ScreenHost } from './screens';

const STATUS_ICON: Record<ObjectiveStatus, string> = { pending: 'hourglass', done: 'check', failed: 'close' };
const ACTS = [1, 2, 3] as const;

// ---------- Texte mit Platzhaltern / texts with placeholders ----------

/** Mission im Zusammenhang einer Spielerfraktion / mission in the context of a player faction */
interface MissionCtx { m: MissionDef; f: FactionId; ally: FactionId | null }
const ctxOf = (m: MissionDef, f: FactionId): MissionCtx => ({ m, f, ally: allyFor(m.id, f) });

/** Platzhalter {leader} {faction} {enemy} {enemyLeader} {ally} {allyLeader} / placeholders */
function textVars(x: MissionCtx, enemy = 0): Record<string, string> {
  const e = x.m.enemies[enemy]?.id ?? x.m.enemies[0].id;
  return {
    leader: t(`factions.${x.f}.leader`), faction: t(`factions.${x.f}.short`),
    enemy: t(`factions.${e}.short`), enemyLeader: t(`factions.${e}.leader`),
    ally: x.ally ? t(`factions.${x.ally}.short`) : '', allyLeader: x.ally ? t(`factions.${x.ally}.leader`) : '',
  };
}
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (all, k) => (k in v ? v[k] : all));

/** Fraktions-Fassung, sonst allgemein / faction variant, else generic */
function missionLine(x: MissionCtx, key: 'won' | 'lost' | 'ally'): string {
  const base = `campaign.missions.${x.m.id}`;
  const v = t(`${base}.variants.${x.f}.${key}`);
  return fill(v.startsWith('campaign.') ? t(`${base}.${key}`) : v, textVars(x));
}
function briefList(x: MissionCtx): string[] {
  const own = tList(`campaign.missions.${x.m.id}.variants.${x.f}.brief`);
  return own.length ? own : tList(`campaign.missions.${x.m.id}.brief`);
}

/** Text eines Ziels / text of an objective */
export function objectiveText(m: MissionDef, o: ObjectiveDef, bonus: boolean, s?: GameState): string {
  const rounds = m.rounds;
  // Hoehle: Hauptschacht und Nachschublinien statt HQ und Staedten / cavern: main shaft and supply lines instead of HQ and cities
  if (m.theme === 'cavern' && o.k === 'holdHq') return t('campaign.obj.holdShaft', { rounds });
  if (m.theme === 'cavern' && o.k === 'noCityLost') return t('campaign.obj.noLineLost');
  // Landetrupp: das Ziel ist der Vorposten der Zyrr / landing party: the target is the Zyrr outpost
  if (m.landing && o.k === 'capture') return bonus ? t('campaign.obj.bonusOutpost') : t('campaign.obj.outpost', { rounds });
  switch (o.k) {
    case 'capture': return bonus ? t('campaign.obj.bonusCapture') : t('campaign.obj.capture', { rounds });
    case 'cities': return bonus ? t('campaign.obj.bonusCities', { n: o.n }) : t('campaign.obj.cities', { n: o.n, rounds });
    case 'kills': return bonus ? t('campaign.obj.bonusKills', { n: o.n }) : t('campaign.obj.kills', { n: o.n, rounds });
    case 'points': return bonus ? t('campaign.obj.bonusPoints', { n: o.n }) : t('campaign.obj.points', { n: o.n, rounds });
    case 'fast': return t('campaign.obj.fast', { n: o.rounds });
    // Endgegner mit eigenem Satz (Artikel) / bosses with their own sentence (article)
    case 'destroyUnit': return t(UNITS[o.type].abilities.includes('boss') ? 'campaign.obj.boss' : 'campaign.obj.destroyUnit', { unit: t(`units.${o.type}`), rounds });
    case 'artifact': return t('campaign.obj.artifact', { n: o.rounds, rounds });
    case 'portal': return t('campaign.obj.portal', { n: o.rounds, rounds });
    case 'reach': {
      // Anfuehrer des Besitzers am Zielfeld, sonst des ersten Gegners / leader of the owner at the target, else of the first enemy
      const p = s?.campaign?.targets[o.target];
      const owner = p ? s?.cities.find((c) => c.x === p.x && c.y === p.y)?.owner : undefined;
      const id = owner !== undefined && owner !== null && s ? s.factions[owner].id : m.enemies[0].id;
      return t('campaign.obj.reach', { name: t(`factions.${id}.leader`), rounds });
    }
    case 'eliminate': {
      const id = s ? s.factions[o.faction]?.id : m.enemies[o.faction - 1]?.id;
      return t('campaign.obj.eliminate', { name: id ? t(`factions.${id}.short`) : '', rounds });
    }
    default: return t(`campaign.obj.${o.k}`, { rounds });
  }
}

const missionTitle = (id: string) => t(`campaign.missions.${id}.title`);

// ---------- Comic-Panels / comic panels ----------

interface Panel { speaker: Speaker | 'narration'; enemy?: number; text: string }

/** Kopf eines Panels: Portraet und Name des Sprechers / head of a panel: portrait and name of the speaker */
function speakerHead(x: MissionCtx, p: Panel): string {
  const role = (k: string) => `<small class="muted">${esc(t(`campaign.speakers.${k}`))}</small>`;
  const person = (f: FactionId, k: string) =>
    `${leaderPortrait(f, 'sm')}<span class="col"><strong>${esc(t(`factions.${f}.leader`))}</strong>${role(k)}</span>`;
  switch (p.speaker) {
    case 'hq': return person(x.f, 'hq');
    case 'enemy': return person(x.m.enemies[p.enemy ?? 0]?.id ?? x.m.enemies[0].id, 'enemy');
    case 'ally': return x.ally ? person(x.ally, 'ally') : '';
    case 'scout': return `${factionBadge(x.f, 'eye')}<span class="col"><strong>${esc(t('campaign.speakers.scout'))}</strong>${role('scoutRole')}</span>`;
    default: return '';
  }
}

/** Comic-Panels mit Sprechblasen; Erzaehlpanels ohne Sprecher / comic panels with speech bubbles; narration panels without a speaker */
function comicPanels(x: MissionCtx, panels: Panel[]): string {
  return `<div class="comic ${panels.length >= 3 ? 'three' : ''}">${panels.map((p) => {
    if (p.speaker === 'narration') return `<div class="comic-panel narration"><div class="caption">${esc(p.text)}</div></div>`;
    return `<div class="comic-panel ${p.speaker}">
      <div class="comic-speaker">${speakerHead(x, p)}</div>
      <div class="bubble-text">${esc(p.text)}</div></div>`;
  }).join('')}</div>`;
}

/** Panels der Besprechung: Missionstexte, Zeile des Verbuendeten, Hinweis aufs Ueberzeugen / briefing panels: mission texts, ally line, persuasion tip */
export function briefingPanels(x: MissionCtx): Panel[] {
  const texts = briefList(x);
  const panels: Panel[] = x.m.briefing.map((b, i) => {
    const p = panelOf(b);
    return { speaker: p.speaker, enemy: p.enemy, text: fill(texts[i] ?? '', textVars(x, p.enemy)) };
  });
  if (x.ally) panels.splice(Math.max(0, panels.length - 1), 0, { speaker: 'ally', text: missionLine(x, 'ally') });
  if (x.m.persuade && PERSUADE.factions.includes(x.f)) {
    // vor der Schlusszeile des eigenen Anfuehrers / before the own leader's closing line
    panels.splice(Math.max(0, panels.length - 1), 0, { speaker: 'scout', text: t('campaign.persuadeTip', { ...textVars(x), cost: PERSUADE.cost }) });
  }
  return panels;
}

function starsHtml(n: number, big = false): string {
  return `<span class="stars ${big ? 'big' : ''}" aria-label="${esc(t('campaign.rating', { n }))}">${[0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">${icon('star')}</span>`).join('')}</span>`;
}

function versus(x: MissionCtx): string {
  const chip = (f: FactionId) => factionChip(f, t(`factions.${f}.short`));
  return `${chip(x.f)}${x.ally ? `<span class="muted">${esc(t('campaign.and'))}</span>${chip(x.ally)}` : ''}<span class="muted">${esc(t('campaign.versus'))}</span>${x.m.enemies.map((e) => chip(e.id)).join('')}`;
}

function objectiveList(m: MissionDef, s?: GameState): string {
  const c = s?.campaign;
  const row = (o: ObjectiveDef, i: number, bonus: boolean) => {
    const st: ObjectiveStatus = c ? (bonus ? c.bonus[i] : c.status[i]) : 'pending';
    return `<li class="${st}">${icon(bonus ? 'star' : STATUS_ICON[st], 'icon-sm')}<span>${esc(objectiveText(m, o, bonus, s))}${c ? ` · ${esc(t(`campaign.status.${st}`))}` : ''}</span></li>`;
  };
  return `<h3 class="display">${esc(t('campaign.objectives'))}</h3><ul class="brief-objectives">${m.objectives.map((o, i) => row(o, i, false)).join('')}</ul>
    <h3 class="display">${esc(t('campaign.bonus'))}</h3><ul class="brief-objectives">${m.bonus.map((o, i) => row(o, i, true)).join('')}</ul>`;
}

// ---------- Kampagnenbildschirm / campaign screen ----------

/** Fraktionswahl / faction picker */
function pickerHtml(current: FactionId | null): string {
  const st = loadStore();
  const max = MISSIONS.length * 3;
  return `<section class="campaign-picker" aria-labelledby="camp-pick-title">
    <h3 class="display" id="camp-pick-title">${esc(t('campaign.chooseFaction'))}</h3>
    <p class="muted">${esc(t('campaign.chooseHint'))}</p>
    <div class="faction-grid">${CAMPAIGN_FACTIONS.map((f) => {
      const run = runOf(st, f);
      const isCur = f === current;
      const loop = loopDone(st, f, FINALE_ID);
      return `<div class="faction-card" ${isCur ? 'aria-current="true"' : ''}>
        <button type="button" class="faction-pick" data-pick="${f}" aria-pressed="${isCur}">
          ${leaderPortrait(f, 'md')}
          <span class="col grow"><strong>${esc(t(`factions.${f}.name`))}</strong>
            <span>${esc(t(`factions.${f}.leaderTitle`))} <strong>${esc(t(`factions.${f}.leader`))}</strong></span>
            <span class="campaign-pitch">${esc(t(`campaign.pitch.${f}`))}</span>
            <span class="row">
              <span class="tag">${icon('star', 'icon-sm')}${esc(t('campaign.totalStars', { n: totalStars(run), max }))}</span>
              ${loop ? `<span class="tag ok loop-badge">${icon('rotateLeft', 'icon-sm')}${esc(t('campaign.loopBadge'))}</span>` : ''}
              ${isCur ? `<span class="tag">${esc(t('setup.current'))}</span>` : ''}
            </span></span>
        </button>
      </div>`;
    }).join('')}</div>
    ${current ? button(t('actions.cancel'), { action: 'pick-cancel', variant: 'secondary' }) : ''}
  </section>`;
}

export function campaignScreen(host: ScreenHost, opts: { pick?: boolean } = {}): HTMLElement {
  const n = document.createElement('div');
  n.className = 'screen campaign-screen';
  let picking = !!opts.pick;
  const render = () => {
    const st = loadStore();
    const f = st.faction;
    const loops = loopsDone(st, FINALE_ID).length;
    const head = `
      <div class="campaign-head">${icon('map')}<div class="grow"><h2 class="display">${esc(t('campaign.title'))}</h2>
        ${f ? `<span class="campaign-total">${icon('star', 'icon-sm')}${esc(t('campaign.totalStars', { n: totalStars(runOf(st, f)), max: MISSIONS.length * 3 }))}</span>` : ''}</div>
        ${iconButton('close', t('campaign.toMenu'), 'back')}</div>
      <div class="campaign-intro">
        <p>${esc(t('campaign.intro'))}</p>
        <button type="button" class="btn secondary lore-btn" data-action="prologue">${icon('book', 'icon-sm')}<span>${esc(t('campaign.prologue'))}</span></button>
      </div>
      ${st.notice ? `<div class="campaign-notice" role="status"><p>${icon('info', 'icon-sm')}<span>${esc(st.notice === 'migrated' ? t('campaign.migrated', { faction: t(`factions.${f ?? 'korvat'}.short`) }) : t('campaign.expanded'))}</span></p>${button(t('campaign.noticeOk'), { action: 'notice-ok', variant: 'secondary' })}</div>` : ''}
      ${loops ? `<p class="campaign-loops">${icon('rotateLeft', 'icon-sm')}<span>${esc(t('campaign.loops', { n: loops, max: CAMPAIGN_FACTIONS.length }))}</span></p>` : ''}`;
    if (!f || picking) { n.innerHTML = head + pickerHtml(f); return; }
    const p = runOf(st, f);
    const cur = currentMissionId(p, MISSION_IDS);
    const card = (m: MissionDef) => {
      const i = MISSION_IDS.indexOf(m.id);
      const open = isUnlocked(p, MISSION_IDS, m.id);
      const rec = p.missions[m.id];
      const x = ctxOf(m, f);
      return `<button type="button" class="mission-card ${m.id === cur ? 'current' : ''}" data-mission="${m.id}" aria-disabled="${!open}">
        <span class="mission-no">${open ? i + 1 : icon('lock')}</span>
        <span class="mission-body"><span class="muted">${esc(t('campaign.mission', { n: i + 1 }))} · ${esc(t('campaign.length', { n: m.rounds }))} · ${esc(t(`difficulty.${m.level}`))}</span>
          <strong>${esc(missionTitle(m.id))}</strong>
          <span class="muted">${esc(fill(t(`campaign.missions.${m.id}.tagline`), textVars(x)))}</span>
          <span class="mission-meta">${versus(x)}${starsHtml(rec?.stars ?? 0)}
            <span class="tag ${isCompleted(p, m.id) ? 'ok' : open ? '' : 'warn'}">${esc(isCompleted(p, m.id) ? t('campaign.completed') : open ? t('campaign.open') : t('campaign.locked'))}</span></span>
        </span></button>`;
    };
    n.innerHTML = `${head}
      <div class="campaign-faction">${leaderPortrait(f, 'sm')}
        <span class="col grow"><strong>${esc(t(`factions.${f}.name`))}</strong><span class="muted">${esc(t(`factions.${f}.leaderTitle`))} ${esc(t(`factions.${f}.leader`))}</span>
          ${loopDone(st, f, FINALE_ID) ? `<span class="tag ok loop-badge">${icon('rotateLeft', 'icon-sm')}${esc(t('campaign.loopBadge'))}</span>` : ''}</span>
        ${button(t('campaign.changeFaction'), { action: 'pick', variant: 'secondary', icon: 'people' })}
      </div>
      <div class="mission-list">${ACTS.map((a) => `
        <div class="act-head"><h3 class="display">${esc(t(`campaign.acts.a${a}.title`))}</h3><span class="muted">${esc(t(`campaign.acts.a${a}.tagline`))}</span></div>
        ${MISSIONS.filter((m) => m.act === a).map(card).join('')}`).join('')}</div>`;
  };
  render();
  n.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const act = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (act === 'back') { n.remove(); host.showMenu(); return; }
    if (act === 'prologue') { openPrologue(host.root); return; }
    if (act === 'notice-ok') { saveStore(clearNotice(loadStore())); render(); return; }
    if (act === 'pick') { host.game.play('click'); picking = true; render(); return; }
    if (act === 'pick-cancel') { picking = false; render(); return; }
    const pick = target.closest<HTMLElement>('[data-pick]');
    if (pick) {
      host.game.play('click');
      saveStore(chooseFaction(loadStore(), pick.dataset.pick as FactionId));
      picking = false;
      render();
      n.scrollTop = 0;
      return;
    }
    const card = target.closest<HTMLElement>('[data-mission]');
    if (!card) return;
    const id = card.dataset.mission!;
    const st = loadStore();
    if (!st.faction) return;
    if (!isUnlocked(runOf(st, st.faction), MISSION_IDS, id)) {
      host.game.play('error');
      // Hinweis direkt in der Karte (Hinweise liegen unter dem Bildschirm) / hint inside the card (toasts sit below the screen)
      const tag = card.querySelector<HTMLElement>('.tag:last-child');
      if (tag) { tag.textContent = t('campaign.lockedHint', { n: MISSION_IDS.indexOf(id) }); tag.setAttribute('role', 'status'); }
      return;
    }
    host.game.play('click');
    briefingDialog(host, id, st.faction);
  });
  return n;
}

/** Einsatzbesprechung als Comic / briefing as a comic */
export function briefingDialog(host: ScreenHost, id: string, faction?: FactionId) {
  const m = missionById(id);
  const f = faction ?? loadStore().faction;
  if (!m || !f) return;
  audio.briefingMusic();
  const x = ctxOf(m, f);
  const best = runOf(loadStore(), f).missions[id]?.stars ?? 0;
  // ueber dem Kampagnenbildschirm oeffnen / open above the campaign screen
  const parent = host.root.querySelector<HTMLElement>('.screen') ?? host.root;
  const d = openDialog(parent, `<div class="panel-title"><h2 class="display">${esc(t('campaign.mission', { n: MISSION_IDS.indexOf(id) + 1 }))}: ${esc(missionTitle(id))}</h2>${iconButton('close', t('actions.close'), 'close')}</div>
    <div class="row">${versus(x)}<span class="tag">${icon('hourglass', 'icon-sm')}${esc(t('campaign.length', { n: m.rounds }))}</span><span class="tag">${esc(t(`difficulty.${m.level}`))}</span>${best ? `<span class="tag ok">${esc(t('campaign.best', { n: best }))}</span>` : ''}</div>
    <h3 class="display">${esc(t('campaign.briefing'))}</h3>
    ${comicPanels(x, briefingPanels(x))}
    ${objectiveList(m)}
    <div class="dialog-actions">${button(t('actions.cancel'), { action: 'close', variant: 'secondary' })}${button(t('campaign.start'), { action: 'start', icon: 'play' })}</div>`, { wide: true });
  d.node.classList.add('briefing');
  d.node.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b) return;
    if (b.dataset.action === 'close') { d.close(); return; }
    if (b.dataset.action === 'start') {
      d.close();
      host.root.querySelectorAll('.screen').forEach((n) => n.remove());
      host.startGame(missionConfig(id, f));
    }
  });
}

// ---------- Ergebnis / result ----------

/** Epilog nach dem Finale: Akt-Abschluesse, Fraktions-Epilog, Zeitschleife / epilogue after the finale: act closings, faction epilogue, time loop */
function finaleHtml(x: MissionCtx): string {
  const closings: Panel[] = ACTS.map((a) => ({ speaker: 'narration', text: fill(t(`campaign.acts.a${a}.closing`), textVars(x)) }));
  const twist: Panel[] = tList('campaign.twist').map((text) => ({ speaker: 'narration', text: fill(text, textVars(x)) }));
  return `<h3 class="display">${esc(t('campaign.epilogueTitle'))}</h3>
    ${comicPanels(x, closings)}
    ${comicPanels(x, [{ speaker: 'hq', text: fill(t(`campaign.epilogue.${x.f}`), textVars(x)) }])}
    <h3 class="display twist-title">${esc(t('campaign.twistTitle'))}</h3>
    ${comicPanels(x, twist)}
    <p class="center campaign-replay-hint">${esc(t('campaign.replayHint'))}</p>`;
}

/**
 * Ergebnisbildschirm einer Mission; traegt den Fortschritt im Feldzug der Spielerfraktion ein.
 * Mission result screen; records the progress in the player faction's run.
 */
export function campaignResult(host: ScreenHost) {
  const s = host.game.state;
  const c = s?.campaign;
  const m = c ? missionById(c.mission) : undefined;
  if (!s || !c || !m) return;
  const f = s.factions[0].id;
  const won = c.result === 'won';
  saveStore(recordRunResult(loadStore(), f, m.id, won, c.stars, s.round));
  const next = won ? nextMissionId(MISSION_IDS, m.id) : null;
  const finale = won && !next;
  const x = ctxOf(m, f);
  // offene Hinweise wuerden das Ergebnis verdecken / open toasts would cover the result
  host.root.querySelectorAll('.toasts > *, .headline').forEach((n) => n.remove());
  const d = openDialog(host.root, `<div class="panel-title"><h2 class="display">${esc(t('campaign.debriefing'))}: ${esc(missionTitle(m.id))}</h2></div>
    <h1 class="logo result-title ${won ? '' : 'lost'}">${esc(won ? t('campaign.victory') : t('campaign.defeat'))}</h1>
    <div class="row center">${starsHtml(c.stars, true)}</div>
    <p class="center muted">${esc(t('campaign.rating', { n: c.stars }))}</p>
    ${comicPanels(x, [{ speaker: 'hq', text: missionLine(x, won ? 'won' : 'lost') }])}
    ${finale ? finaleHtml(x) : ''}
    ${objectiveList(m, s)}
    <div class="dialog-actions">
      ${button(t('campaign.toMenu'), { action: 'menu', variant: 'secondary' })}
      ${button(t('campaign.toCampaign'), { action: 'campaign', icon: 'map', variant: 'secondary' })}
      ${button(t('campaign.retry'), { action: 'retry', icon: 'rotateLeft', variant: next || finale ? 'secondary' : 'primary' })}
      ${next ? button(t('campaign.next'), { action: 'next', icon: 'next' }) : ''}
      ${finale ? button(t('campaign.replay'), { action: 'replay', icon: 'people' }) : ''}
    </div>`, { dismissable: false, wide: true });
  // oben beginnen: der Fokus auf dem ersten Knopf scrollt sonst ans Ende (Epilog wuerde uebersprungen)
  // start at the top: focusing the first button would otherwise scroll to the end (skipping the epilogue)
  d.node.scrollTop = 0;
  d.node.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'menu') { d.close(); host.showMenu(); }
    else if (a === 'campaign') { d.close(); openCampaign(host); }
    else if (a === 'retry') { d.close(); host.startGame(missionConfig(m.id, f)); }
    else if (a === 'next' && next) { d.close(); openCampaign(host); briefingDialog(host, next, f); }
    // Zeitschleife: direkt zur Fraktionswahl / time loop: straight to the faction picker
    else if (a === 'replay') { d.close(); openCampaign(host, { pick: true }); }
  });
}

/** Hauptmenue durch den Kampagnenbildschirm ersetzen / replace the main menu with the campaign screen */
export function openCampaign(host: ScreenHost, opts: { pick?: boolean } = {}) {
  host.showMenu();
  const menu = host.root.querySelector('.screen');
  const scr = campaignScreen(host, opts);
  if (menu) menu.replaceWith(scr); else host.root.appendChild(scr);
}

// ---------- Ziel-Panel im Spiel / in-game objective panel ----------
export class ObjectivePanel {
  private node: HTMLElement;
  private collapsed: boolean;
  private visible = false;

  constructor(root: HTMLElement) {
    this.node = document.createElement('aside');
    this.node.className = 'objectives';
    this.node.hidden = true;
    // auf schmalen Geraeten eingeklappt starten / start collapsed on narrow devices
    this.collapsed = typeof window !== 'undefined' && window.innerWidth < 480;
    root.appendChild(this.node);
    this.node.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('[data-action="obj-toggle"]')) return;
      this.collapsed = !this.collapsed;
      this.lastState = null;
      this.render(this.lastGame);
    });
  }

  private lastGame: GameState | null = null;
  private lastState: string | null = null;

  show(on: boolean) { this.visible = on; if (!on) this.node.hidden = true; }

  render(s: GameState | null) {
    this.lastGame = s;
    const c = s?.campaign;
    const m = c ? missionById(c.mission) : undefined;
    if (!s || !c || !m || !this.visible) { this.node.hidden = true; return; }
    this.node.hidden = false;
    const key = JSON.stringify([c.status, c.bonus, s.round, this.collapsed, s.factions[0].kills, s.cities.map((x) => x.owner), c.hold, c.portalHold, c.landing, (c.units ?? []).map((id) => s.units.find((u) => u.id === id)?.hp ?? 0)]);
    if (key === this.lastState) return;
    this.lastState = key;
    const done = c.status.filter((x) => x === 'done').length;
    const row = (o: ObjectiveDef, i: number, bonus: boolean) => {
      const st = bonus ? c.bonus[i] : c.status[i];
      const pr = st === 'pending' ? objectiveProgress(s, o, m.rounds) : null;
      const prog = pr && !(isHoldObjective(o) && bonus) ? `<span class="prog">${esc(t('campaign.progress', { have: pr.have, need: pr.need }))}</span>` : '<span></span>';
      return `<li class="${st} ${bonus ? 'bonus' : ''}">${icon(bonus && st === 'pending' ? 'star' : STATUS_ICON[st], 'icon-sm')}<span>${esc(objectiveText(m, o, bonus, s))}</span>${prog}</li>`;
    };
    // Artefakt in fremder Hand: Warnzeile / artifact in enemy hands: warning line
    const h = c.hold;
    const art = m.objectives.find((o) => o.k === 'artifact');
    const warn = art && art.k === 'artifact' && h && h.faction !== null && h.faction !== 0 && !c.allies?.includes(h.faction)
      ? `<div class="obj-warn">${icon('warning', 'icon-sm')}${esc(t('campaign.artifactHeld', { name: t(`factions.${s.factions[h.faction].id}.short`), have: h.n, need: art.rounds }))}</div>`
      // Landetrupp ohne Stadt / landing party without a city
      : c.landing ? `<div class="obj-warn">${icon('warning', 'icon-sm')}${esc(t('campaign.landing'))}</div>` : '';
    this.node.classList.toggle('collapsed', this.collapsed);
    this.node.innerHTML = `<button type="button" class="obj-toggle" data-action="obj-toggle" aria-expanded="${!this.collapsed}" aria-label="${esc(t('campaign.toggle'))}">
        ${icon('capture', 'icon-sm')}<span class="title">${esc(this.collapsed ? t('campaign.short') : missionTitle(m.id))}</span>
        <span class="obj-count tag">${done}/${m.objectives.length}</span></button>
      ${this.collapsed ? '' : `<ul>${m.objectives.map((o, i) => row(o, i, false)).join('')}${m.bonus.map((o, i) => row(o, i, true)).join('')}</ul>${warn}
        <div class="obj-round">${esc(t('campaign.roundOf', { n: Math.min(s.round, m.rounds), max: m.rounds }))}</div>`}`;
  }
}

/** Hinweis bei Statuswechsel eines Ziels / toast when an objective changes status */
export function objectiveToast(root: HTMLElement, s: GameState, index: number, bonus: boolean, status: ObjectiveStatus) {
  const m = s.campaign ? missionById(s.campaign.mission) : undefined;
  if (!m || status === 'pending' || s.campaign?.result) return;
  const o = (bonus ? m.bonus : m.objectives)[index];
  if (!o) return;
  const text = objectiveText(m, o, bonus, s);
  if (status === 'done') toast(root, t(bonus ? 'campaign.bonusDone' : 'campaign.objectiveDone', { text }), bonus ? 'star' : 'check');
  else toast(root, t('campaign.objectiveFailed', { text }), 'warning');
}

/**
 * Endgegner: Auftauchen (Hinweis und Funkspruch der Schwarmmutter), Schrei und Brut (Hinweise).
 * Boss: emergence (toast and the Swarm Mother's dispatch), scream and brood (toasts).
 */
export function bossToast(root: HTMLElement, s: GameState, e: Extract<GameEvent, { t: 'boss' }>, say: (f: FactionId, text: string) => void) {
  const f = s.factions[e.faction]?.id;
  if (!f) return;
  if (e.what === 'emerge') {
    toast(root, t('campaign.bossEmerge', { name: t(`factions.${f}.leader`) }), 'warning');
    say(f, t('campaign.bossLine', { leader: t(`factions.${s.factions[0].id}.leader`) }));
  } else if (e.what === 'scream') toast(root, t('campaign.bossScream', { n: e.hits?.length ?? 0 }), 'warning');
  else if (e.what === 'brood' && s.factions[0].explored[e.y * s.size + e.x]) toast(root, t('campaign.bossBrood', { n: e.count ?? 0 }), 'warning');
}

/** Hinweis, wenn eine Welle eintrifft / toast when a wave arrives */
export function waveToast(root: HTMLElement, s: GameState, faction: number, count: number) {
  if (faction === 0) toast(root, t('campaign.waveOwn', { n: count }), 'shield');
  else toast(root, t('campaign.waveEnemy', { name: t(`factions.${s.factions[faction].id}.short`), n: count }), 'warning');
}
