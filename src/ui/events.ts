/**
 * Zufallsereignisse als Comic-Schlagzeile ("Extrablatt") mit Symbol und passendem Klang.
 * Random events as a comic headline ("breaking news") with icon and a fitting sound.
 */
import './campaign.css';
import type { GameEvent, GameState, RandomEventKind } from '../core';
import { audio } from '../audio/audio';
import { t } from '../i18n/i18n';
import { esc, toast } from './components';
import { cityName } from './hud';
import { icon } from './icons';

type RandomEvent = Extract<GameEvent, { t: 'randomEvent' }>;

export const EVENT_ICON: Record<RandomEventKind, string> = {
  storm: 'storm', epidemic: 'germ', rebels: 'torch', convoy: 'truck', defector: 'defector', luckyFind: 'chest', drought: 'drought',
};

/** Ereignis schlecht fuer den Betrachter? (Pech der anderen ist neutral) / bad for the viewer? (others' bad luck is neutral) */
function badFor(e: RandomEvent, viewer: number): boolean {
  switch (e.kind) {
    case 'convoy': case 'luckyFind': return false;
    case 'defector': return e.other === viewer;
    case 'epidemic': return !e.contained && e.faction === viewer;
    default: return e.faction === viewer;
  }
}

/** Ueberschrift und Text eines Ereignisses / title and body of an event */
export function randomEventText(e: RandomEvent, s: GameState): { title: string; body: string } {
  const name = e.faction !== undefined && s.factions[e.faction] ? t(`factions.${s.factions[e.faction].id}.short`) : '';
  const other = e.other !== undefined && s.factions[e.other] ? t(`factions.${s.factions[e.other].id}.short`) : '';
  const city = e.city !== undefined ? cityName(s, e.city) : '';
  const k = `randomEvents.${e.kind}`;
  switch (e.kind) {
    case 'storm': return { title: t(`${k}.title`), body: t(`${k}.body`, { name, n: e.count ?? 0 }) };
    case 'epidemic': return { title: t(`${k}.title`, { city }), body: t(e.contained ? `${k}.contained` : `${k}.body`, { name, city }) };
    case 'rebels': return { title: t(`${k}.title`, { city }), body: t(`${k}.body`, { name, other }) };
    case 'convoy': return { title: t(`${k}.title`), body: t(`${k}.body`, { name, n: e.stars ?? 0 }) };
    case 'defector': return { title: t(`${k}.title`), body: t(`${k}.body`, { name, other }) };
    case 'luckyFind': return { title: t(`${k}.title`), body: e.tech ? t(`${k}.bodyTech`, { name, tech: t(`techs.${e.tech}`) }) : t(`${k}.bodyStars`, { name, n: e.stars ?? 0 }) };
    case 'drought': return { title: t(`${k}.title`), body: t(e.ongoing ? `${k}.ongoing` : `${k}.body`, { name, n: e.stars ?? 0 }) };
  }
}

function playSound(e: RandomEvent, viewer: number) {
  const mine = e.faction === viewer;
  switch (e.kind) {
    case 'storm': audio.sting('alarm'); break;
    case 'epidemic': if (e.contained) audio.play('levelUp'); else audio.sting('alarm'); break;
    case 'rebels': audio.sting(mine ? 'cityLost' : 'alarm'); break;
    case 'convoy': audio.sting('levelUp'); break;
    case 'defector': audio.play('capture'); break;
    case 'luckyFind': audio.play(e.tech ? 'research' : 'levelUp'); break;
    case 'drought': audio.play('error'); break;
  }
}

let current: HTMLElement | null = null;
let timer = 0;

/**
 * Schlagzeile zeigen (eine zur Zeit, Antippen schliesst). Fortgesetzte Duerre nur als kurzer Hinweis.
 * Show a headline (one at a time, tap closes). An ongoing drought only as a short toast.
 */
export function showRandomEvent(root: HTMLElement, e: RandomEvent, s: GameState, viewer: number) {
  const { title, body } = randomEventText(e, s);
  if (e.ongoing) { if (e.faction === viewer) toast(root, body, EVENT_ICON[e.kind]); return; }
  playSound(e, viewer);
  current?.remove();
  window.clearTimeout(timer);
  const n = document.createElement('div');
  n.className = `headline ${badFor(e, viewer) ? 'bad' : ''}`;
  n.setAttribute('role', 'status');
  n.setAttribute('aria-live', 'polite');
  n.innerHTML = `<div class="kicker">${icon('info', 'icon-sm')}<span>${esc(t('randomEvents.kicker'))}</span><span class="grow"></span><span>${esc(t('hud.round'))} ${s.round}</span></div>
    <div class="main"><span class="unit-badge">${icon(EVENT_ICON[e.kind])}</span><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
  const close = () => {
    if (!n.isConnected) return;
    n.classList.add('out');
    window.setTimeout(() => n.remove(), 320);
    if (current === n) current = null;
  };
  n.addEventListener('click', close);
  root.appendChild(n);
  current = n;
  timer = window.setTimeout(close, 4200);
}
