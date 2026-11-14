/**
 * Kampagne in der Oberflaeche: Einsatzliste, Comic-Besprechung, Ziel-Panel im Spiel und Ergebnis mit Sternen.
 * Campaign UI: mission list, comic briefing, in-game objective panel and result screen with stars.
 */
import './campaign.css';
import {
  MISSIONS, MISSION_IDS, missionById, missionConfig, objectiveProgress, isHoldObjective,
  type GameState, type MissionDef, type ObjectiveDef, type ObjectiveStatus, type Speaker,
} from '../core';
import type { FactionId } from '../data/balance';
import { t, tList } from '../i18n/i18n';
import {
  currentMissionId, isCompleted, isUnlocked, loadProgress, nextMissionId, recordResult, saveProgress, totalStars,
} from '../save/progress';
import { button, esc, factionBadge, factionChip, iconButton, openDialog, toast } from './components';
import { FACTION_EMBLEM, icon } from './icons';
import type { ScreenHost } from './screens';

const STATUS_ICON: Record<ObjectiveStatus, string> = { pending: 'hourglass', done: 'check', failed: 'close' };

/** Text eines Ziels / text of an objective */
export function objectiveText(m: MissionDef, o: ObjectiveDef, bonus: boolean, s?: GameState): string {
  const rounds = m.rounds;
  switch (o.k) {
    case 'capture': return bonus ? t('campaign.obj.bonusCapture') : t('campaign.obj.capture', { rounds });
    case 'cities': return bonus ? t('campaign.obj.bonusCities', { n: o.n }) : t('campaign.obj.cities', { n: o.n, rounds });
    case 'kills': return bonus ? t('campaign.obj.bonusKills', { n: o.n }) : t('campaign.obj.kills', { n: o.n, rounds });
    case 'points': return bonus ? t('campaign.obj.bonusPoints', { n: o.n }) : t('campaign.obj.points', { n: o.n, rounds });
    case 'fast': return t('campaign.obj.fast', { n: o.rounds });
    case 'eliminate': {
      const id = s ? s.factions[o.faction]?.id : m.enemies[o.faction - 1]?.id;
      return t('campaign.obj.eliminate', { name: id ? t(`factions.${id}.short`) : '', rounds });
    }
    default: return t(`campaign.obj.${o.k}`, { rounds });
  }
}

const missionTitle = (id: string) => t(`campaign.missions.${id}.title`);

function speakerFaction(m: MissionDef, sp: Speaker): FactionId {
  return sp === 'enemy' ? m.enemies[0].id : m.faction;
}

/** Comic-Panels mit Sprechblasen / comic panels with speech bubbles */
function comicPanels(m: MissionDef, panels: { speaker: Speaker; text: string }[]): string {
  return `<div class="comic ${panels.length >= 3 ? 'three' : ''}">${panels.map((p) => {
    const f = speakerFaction(m, p.speaker);
    const badge = factionBadge(f, p.speaker === 'scout' ? 'eye' : FACTION_EMBLEM[f]);
    return `<div class="comic-panel ${p.speaker}">
      <div class="comic-speaker">${badge}<span>${esc(t(`campaign.speakers.${p.speaker}`))}</span></div>
      <div class="bubble-text">${esc(p.text)}</div></div>`;
  }).join('')}</div>`;
}

function starsHtml(n: number, big = false): string {
  return `<span class="stars ${big ? 'big' : ''}" aria-label="${esc(t('campaign.rating', { n }))}">${[0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">${icon('star')}</span>`).join('')}</span>`;
}

function versus(m: MissionDef): string {
  return `${factionChip(m.faction, t(`factions.${m.faction}.short`))}<span class="muted">${esc(t('campaign.versus'))}</span>${m.enemies.map((e) => factionChip(e.id, t(`factions.${e.id}.short`))).join('')}`;
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
export function campaignScreen(host: ScreenHost): HTMLElement {
  const n = document.createElement('div');
  n.className = 'screen campaign-screen';
  const render = () => {
    const p = loadProgress();
    const cur = currentMissionId(p, MISSION_IDS);
    n.innerHTML = `
      <div class="campaign-head">${icon('map')}<div class="grow"><h2 class="display">${esc(t('campaign.title'))}</h2>
        <span class="campaign-total">${icon('star', 'icon-sm')}${esc(t('campaign.totalStars', { n: totalStars(p), max: MISSIONS.length * 3 }))}</span></div>
        ${iconButton('close', t('campaign.toMenu'), 'back')}</div>
      <div class="logo-sub">${esc(t('campaign.subtitle'))}</div>
      <div class="mission-list">${MISSIONS.map((m, i) => {
        const open = isUnlocked(p, MISSION_IDS, m.id);
        const rec = p.missions[m.id];
        return `<button type="button" class="mission-card ${m.id === cur ? 'current' : ''}" data-mission="${m.id}" aria-disabled="${!open}">
          <span class="mission-no">${open ? i + 1 : icon('lock')}</span>
          <span class="mission-body"><span class="muted">${esc(t('campaign.mission', { n: i + 1 }))} · ${esc(t('campaign.length', { n: m.rounds }))}</span>
            <strong>${esc(missionTitle(m.id))}</strong>
            <span class="muted">${esc(t(`campaign.missions.${m.id}.tagline`))}</span>
            <span class="mission-meta">${versus(m)}${starsHtml(rec?.stars ?? 0)}
              <span class="tag ${isCompleted(p, m.id) ? 'ok' : open ? '' : 'warn'}">${esc(isCompleted(p, m.id) ? t('campaign.completed') : open ? t('campaign.open') : t('campaign.locked'))}</span></span>
          </span></button>`;
      }).join('')}</div>`;
  };
  render();
  n.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="back"]')) { n.remove(); host.showMenu(); return; }
    const card = target.closest<HTMLElement>('[data-mission]');
    if (!card) return;
    const id = card.dataset.mission!;
    const p = loadProgress();
    if (!isUnlocked(p, MISSION_IDS, id)) {
      host.game.play('error');
      // Hinweis direkt in der Karte (Hinweise liegen unter dem Bildschirm) / hint inside the card (toasts sit below the screen)
      const tag = card.querySelector<HTMLElement>('.tag');
      if (tag) { tag.textContent = t('campaign.lockedHint', { n: MISSION_IDS.indexOf(id) }); tag.setAttribute('role', 'status'); }
      return;
    }
    host.game.play('click');
    briefingDialog(host, id);
  });
  return n;
}

/** Einsatzbesprechung als Comic / briefing as a comic */
export function briefingDialog(host: ScreenHost, id: string) {
  const m = missionById(id);
  if (!m) return;
  const texts = tList(`campaign.missions.${id}.brief`);
  const panels = m.briefing.map((speaker, i) => ({ speaker, text: texts[i] ?? '' }));
  const best = loadProgress().missions[id]?.stars ?? 0;
  // ueber dem Kampagnenbildschirm oeffnen / open above the campaign screen
  const parent = host.root.querySelector<HTMLElement>('.screen') ?? host.root;
  const d = openDialog(parent, `<div class="panel-title"><h2 class="display">${esc(t('campaign.mission', { n: MISSION_IDS.indexOf(id) + 1 }))}: ${esc(missionTitle(id))}</h2>${iconButton('close', t('actions.close'), 'close')}</div>
    <div class="row">${versus(m)}<span class="tag">${icon('hourglass', 'icon-sm')}${esc(t('campaign.length', { n: m.rounds }))}</span>${best ? `<span class="tag ok">${esc(t('campaign.best', { n: best }))}</span>` : ''}</div>
    <h3 class="display">${esc(t('campaign.briefing'))}</h3>
    ${comicPanels(m, panels)}
    ${objectiveList(m)}
    <div class="dialog-actions">${button(t('actions.cancel'), { action: 'close', variant: 'secondary' })}${button(t('campaign.start'), { action: 'start', icon: 'play' })}</div>`, { wide: true });
  d.node.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b) return;
    if (b.dataset.action === 'close') { d.close(); return; }
    if (b.dataset.action === 'start') {
      d.close();
      host.root.querySelectorAll('.screen').forEach((x) => x.remove());
      host.startGame(missionConfig(id));
    }
  });
}

// ---------- Ergebnis / result ----------
/**
 * Ergebnisbildschirm einer Mission; traegt den Fortschritt ein.
 * Mission result screen; records the progress.
 */
export function campaignResult(host: ScreenHost) {
  const s = host.game.state;
  const c = s?.campaign;
  const m = c ? missionById(c.mission) : undefined;
  if (!s || !c || !m) return;
  const won = c.result === 'won';
  const before = loadProgress();
  const after = recordResult(before, m.id, won, c.stars, s.round);
  saveProgress(after);
  const next = won ? nextMissionId(MISSION_IDS, m.id) : null;
  const finale = won && !next;
  // offene Hinweise wuerden das Ergebnis verdecken / open toasts would cover the result
  host.root.querySelectorAll('.toasts > *, .headline').forEach((x) => x.remove());
  const d = openDialog(host.root, `<div class="panel-title"><h2 class="display">${esc(t('campaign.debriefing'))}: ${esc(missionTitle(m.id))}</h2></div>
    <h1 class="logo result-title ${won ? '' : 'lost'}">${esc(won ? t('campaign.victory') : t('campaign.defeat'))}</h1>
    <div class="row center">${starsHtml(c.stars, true)}</div>
    <p class="center muted">${esc(t('campaign.rating', { n: c.stars }))}</p>
    ${comicPanels(m, [{ speaker: 'hq', text: t(`campaign.missions.${m.id}.${won ? 'won' : 'lost'}`) }, ...(finale ? [{ speaker: 'hq' as Speaker, text: t('campaign.finale') }] : [])])}
    ${objectiveList(m, s)}
    <div class="dialog-actions">
      ${button(t('campaign.toMenu'), { action: 'menu', variant: 'secondary' })}
      ${button(t('campaign.toCampaign'), { action: 'campaign', icon: 'map', variant: 'secondary' })}
      ${button(t('campaign.retry'), { action: 'retry', icon: 'rotateLeft', variant: next ? 'secondary' : 'primary' })}
      ${next ? button(t('campaign.next'), { action: 'next', icon: 'next' }) : ''}
    </div>`, { dismissable: false, wide: true });
  d.node.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'menu') { d.close(); host.showMenu(); }
    else if (a === 'campaign') { d.close(); openCampaign(host); }
    else if (a === 'retry') { d.close(); host.startGame(missionConfig(m.id)); }
    else if (a === 'next' && next) { d.close(); openCampaign(host); briefingDialog(host, next); }
  });
}

/** Hauptmenue durch den Kampagnenbildschirm ersetzen / replace the main menu with the campaign screen */
export function openCampaign(host: ScreenHost) {
  host.showMenu();
  const menu = host.root.querySelector('.screen');
  const scr = campaignScreen(host);
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
    const key = JSON.stringify([c.status, c.bonus, s.round, this.collapsed, s.factions[0].kills, s.cities.map((x) => x.owner)]);
    if (key === this.lastState) return;
    this.lastState = key;
    const done = c.status.filter((x) => x === 'done').length;
    const row = (o: ObjectiveDef, i: number, bonus: boolean) => {
      const st = bonus ? c.bonus[i] : c.status[i];
      const pr = st === 'pending' ? objectiveProgress(s, o, m.rounds) : null;
      const prog = pr && !(isHoldObjective(o) && bonus) ? `<span class="prog">${esc(t('campaign.progress', { have: pr.have, need: pr.need }))}</span>` : '<span></span>';
      return `<li class="${st} ${bonus ? 'bonus' : ''}">${icon(bonus && st === 'pending' ? 'star' : STATUS_ICON[st], 'icon-sm')}<span>${esc(objectiveText(m, o, bonus, s))}</span>${prog}</li>`;
    };
    this.node.classList.toggle('collapsed', this.collapsed);
    this.node.innerHTML = `<button type="button" class="obj-toggle" data-action="obj-toggle" aria-expanded="${!this.collapsed}" aria-label="${esc(t('campaign.toggle'))}">
        ${icon('capture', 'icon-sm')}<span class="title">${esc(this.collapsed ? t('campaign.short') : missionTitle(m.id))}</span>
        <span class="obj-count tag">${done}/${m.objectives.length}</span></button>
      ${this.collapsed ? '' : `<ul>${m.objectives.map((o, i) => row(o, i, false)).join('')}${m.bonus.map((o, i) => row(o, i, true)).join('')}</ul>
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
