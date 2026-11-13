/**
 * Kriegsstatistik: Verlaufsdiagramm (Punkte, Armee, Staedte, Sterne), Bilanz-Tabelle und Helden der Schlacht.
 * Fuer den Spielende-Bildschirm und mitten im Spiel aus dem Pausenmenue.
 * War statistics: line chart (score, army, cities, stars), balance table and heroes of the battle.
 * For the game over screen and mid-game from the pause menu.
 */
import { components } from '../design/tokens';
import { ensureHistory, factionTotals, historySeries, topUnits, type GameState, type RoundStats } from '../core';
import { t } from '../i18n/i18n';
import { dialogTitle, esc, openDialog, segmented } from './components';
import { FACTION_EMBLEM, icon } from './icons';

export type ChartMetric = 'score' | 'units' | 'cities' | 'stars';
const METRICS: ChartMetric[] = ['score', 'units', 'cities', 'stars'];
const CH = components.chart;

/** Fraktionen, die der Betrachter sehen darf / factions the viewer may see */
export function visibleFactions(s: GameState, viewer: number): number[] {
  if (s.over || viewer < 0 || !s.factions[viewer]) return s.factions.map((f) => f.index);
  return s.factions.filter((f) => f.index === viewer || s.factions[viewer].contacts.includes(f.index)).map((f) => f.index);
}

const fname = (s: GameState, i: number) => t(`factions.${s.factions[i].id}.short`);

function badge(s: GameState, i: number): string {
  const id = s.factions[i].id;
  return `<span class="stats-badge" style="background:var(--faction-${id}-primary);color:var(--faction-${id}-ink)">${icon(FACTION_EMBLEM[id], 'icon-sm')}</span>`;
}

/** "Schoene" Achsenschritte / "nice" axis steps */
function niceStep(max: number, ticks = 4): number {
  const raw = Math.max(1, max) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return Math.max(1, m * mag);
  return 10 * mag;
}

/**
 * Liniendiagramm als SVG in echten Pixeln (Schrift skaliert nicht mit).
 * Line chart as SVG in real pixels (text does not scale with it).
 */
export function chartSvg(s: GameState, rounds: RoundStats[], metric: ChartMetric, factions: number[], width: number): string {
  const w = Math.max(200, Math.round(width));
  const h = parseFloat(CH.height);
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const series = factions.map((f) => {
    const elim = s.factions[f].eliminatedRound;
    const pts = rounds.filter((r) => elim === null || r.round <= elim).map((r) => ({ r: r.round, v: r[metric][f] ?? 0 }));
    return { f, pts };
  });
  const all = series.flatMap((x) => x.pts);
  const minR = all.length ? Math.min(...all.map((p) => p.r)) : 1;
  const maxR = all.length ? Math.max(...all.map((p) => p.r)) : 1;
  const maxV = all.length ? Math.max(1, ...all.map((p) => p.v)) : 1;
  const step = niceStep(maxV);
  const top = Math.ceil(maxV / step) * step;
  const X = (r: number) => pad.l + (maxR === minR ? pw / 2 : ((r - minR) / (maxR - minR)) * pw);
  const Y = (v: number) => pad.t + ph - (v / top) * ph;
  let grid = '';
  for (let v = 0; v <= top + 1e-9; v += step) {
    grid += `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`;
    grid += `<text class="ytick" x="${pad.l - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${Math.round(v * 10) / 10}</text>`;
  }
  const rStep = Math.max(1, Math.ceil((maxR - minR) / 5));
  for (let r = minR; r <= maxR; r += rStep) grid += `<text class="xtick" x="${X(r).toFixed(1)}" y="${h - 6}" text-anchor="middle">${r}</text>`;
  if ((maxR - minR) % rStep !== 0) grid += `<text class="xtick" x="${X(maxR).toFixed(1)}" y="${h - 6}" text-anchor="middle">${maxR}</text>`;
  // menschliche Fraktionen zuletzt (oben) / human factions last (on top)
  const order = [...series].sort((a, b) => Number(s.factions[a.f].human) - Number(s.factions[b.f].human));
  const lines = order.map(({ f, pts }) => {
    if (!pts.length) return '';
    const id = s.factions[f].id;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.r).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    const human = s.factions[f].human ? ' human' : '';
    return `<g style="--line:var(--faction-${id}-primary)"><path class="line-o${human}" d="${d}"/><path class="line${human}" d="${d}"/>
      <circle class="dot" cx="${X(last.r).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="${CH.dot}"/></g>`;
  }).join('');
  const label = t('history.chartLabel', { metric: t(`history.${metric}`) });
  const summary = series.map(({ f, pts }) => `${fname(s, f)} ${pts.length ? pts[pts.length - 1].v : 0}`).join(', ');
  return `<svg class="stats-chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(`${label}: ${summary}`)}">
    <title>${esc(label)}</title>
    <line class="axis" x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${pad.t + ph}"/><line class="axis" x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t + ph}" y2="${pad.t + ph}"/>
    ${grid}${lines}</svg>`;
}

/** HTML der Statistik (Diagramm wird beim Einhaengen gezeichnet) / statistics HTML (chart drawn when mounted) */
export function statsPanel(s: GameState, viewer: number): string {
  ensureHistory(s);
  const facs = visibleFactions(s, viewer);
  const totals = factionTotals(s).filter((x) => facs.includes(x.faction));
  const heroes = topUnits(s, 5, facs);
  const legend = facs.map((f) => `<span class="stats-key">${badge(s, f)}<span>${esc(fname(s, f))}</span></span>`).join('');
  const col = (key: string, ic: string) => `<th scope="col" title="${esc(t(`history.${key}`))}">${icon(ic, 'icon-sm')}<span class="label">${esc(t(`history.${key}`))}</span></th>`;
  const rows = totals.sort((a, b) => b.score - a.score).map((x) => `<tr${x.faction === viewer ? ' class="me"' : ''}>
      <th scope="row"><span class="row">${badge(s, x.faction)}<span>${esc(fname(s, x.faction))}</span></span></th>
      <td>${x.kills}</td><td>${x.losses}</td><td>${x.captures}</td><td>${x.techs}</td></tr>`).join('');
  const heroList = heroes.length ? `<ol class="hero-list">${heroes.map((hr, i) => `<li class="hero-row${i === 0 ? ' first' : ''}">
      <span class="hero-rank display">${i + 1}</span>${badge(s, hr.faction)}
      <span class="grow col"><strong>${esc(t(`units.${hr.type}`))}</strong>
        <span class="muted">${esc(fname(s, hr.faction))}${i === 0 ? ` · ${esc(t('history.hero'))}` : ''}</span>
        <span class="row">${hr.veteran ? `<span class="tag ok">${esc(t('stats.veteran'))}</span>` : ''}<span class="tag${hr.alive ? '' : ' warn'}">${esc(hr.alive ? t('history.alive') : t('history.fallen', { n: hr.round ?? s.round }))}</span></span></span>
      <span class="hero-kills">${icon('sword', 'icon-sm')}<span>${esc(hr.kills === 1 ? t('history.heroKill') : t('history.heroKills', { n: hr.kills }))}</span></span></li>`).join('')}</ol>`
    : `<p class="muted">${esc(t('history.noHeroes'))}</p>`;
  const note = s.over ? `<h3 class="display">${esc(t('history.title'))}</h3>` : `<p class="muted">${esc(t('history.midGame', { n: s.round }))}</p>`;
  return `<section class="stats-panel" aria-label="${esc(t('history.title'))}">
    ${note}
    <div role="group" aria-label="${esc(t('history.tabs'))}">${segmented('stat', METRICS.map((m) => ({ value: m, label: t(`history.${m}`) })), 'score')}</div>
    <div class="stats-chart-wrap" data-chart></div>
    <div class="stats-legend">${legend}</div>
    <h3 class="display">${esc(t('history.totals'))}</h3>
    <div class="stats-table-wrap"><table class="stats-table">
      <thead><tr><th scope="col">${esc(t('history.faction'))}</th>${col('kills', 'sword')}${col('losses', 'warning')}${col('captures', 'capture')}${col('techs', 'research')}</tr></thead>
      <tbody>${rows}</tbody></table></div>
    <h3 class="display">${esc(t('history.heroes'))}</h3>
    ${heroList}
  </section>`;
}

/** Reiter und Diagramm verdrahten / wire up tabs and chart */
export function mountStats(node: HTMLElement, s: GameState, viewer: number) {
  const box = node.querySelector<HTMLElement>('[data-chart]');
  if (!box) return;
  const facs = visibleFactions(s, viewer);
  const rounds = historySeries(s);
  let metric: ChartMetric = 'score';
  let lastW = 0;
  const draw = () => {
    const w = box.clientWidth || 320;
    lastW = w;
    box.innerHTML = chartSvg(s, rounds, metric, facs, w);
  };
  node.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-seg="stat"]');
    if (!b || !node.contains(b)) return;
    metric = b.dataset.value as ChartMetric;
    node.querySelectorAll<HTMLElement>('[data-seg="stat"]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  });
  draw();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => { if (!box.isConnected) { ro.disconnect(); return; } if (Math.abs(box.clientWidth - lastW) > 4) draw(); });
    ro.observe(box);
  }
}

/** Statistik mitten im Spiel (Pausenmenue) / statistics mid-game (pause menu) */
export function statsDialog(root: HTMLElement, s: GameState, viewer: number) {
  const d = openDialog(root, `${dialogTitle(t('history.title'))}${statsPanel(s, viewer)}`, { wide: true });
  d.node.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-action="close"]')) d.close(); });
  mountStats(d.node, s, viewer);
}
