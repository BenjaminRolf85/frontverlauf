/**
 * Eigener SVG-Symbolsatz (24x24, Konturstil, keine Emojis).
 * Own SVG icon set (24x24, stroke style, no emojis).
 */
const P: Record<string, string> = {
  star: '<path d="M12 2.8l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.7l-5.6 3.1 1.3-6.2L3 9.3l6.3-.7z" fill="currentColor" stroke-linejoin="round"/>',
  medal: '<circle cx="12" cy="14" r="6"/><path d="M8.5 3h7l-2 6h-3z"/><path d="M12 11.2l.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2z" fill="currentColor"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  research: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
  diplomacy: '<path d="M3 12l4-4 4 3 3-3 4 1 3 3"/><path d="M7 8l-4 9M17 9l4 8M9 14l2 2M11 12l3 3M13 11l3 3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  next: '<path d="M5 12h12M12 6l6 6-6 6"/>',
  endTurn: '<path d="M4 5v14l9-7z" fill="currentColor"/><path d="M14 5v14l7-7z" fill="currentColor"/>',
  rotateLeft: '<path d="M4 4v6h6"/><path d="M5.5 15a8 8 0 1 0 1.5-8.5L4 10"/>',
  rotateRight: '<path d="M20 4v6h-6"/><path d="M18.5 15A8 8 0 1 1 17 6.5L20 10"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M7.5 10.5h6"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  attack: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  heal: '<path d="M12 21s-7.5-4.6-9-9.2C1.8 8 4.3 4.5 7.6 4.5c2 0 3.3 1.1 4.4 2.6 1.1-1.5 2.4-2.6 4.4-2.6 3.3 0 5.8 3.5 4.6 7.3-1.5 4.6-9 9.2-9 9.2z"/><path d="M12 9.5v6M9 12.5h6"/>',
  capture: '<path d="M5 21V3"/><path d="M5 4h12l-3 4 3 4H5" fill="currentColor"/>',
  train: '<circle cx="9" cy="7" r="3.5"/><path d="M2.5 20c.6-4 3.2-6 6.5-6s5.9 2 6.5 6"/><path d="M19 8v6M16 11h6"/>',
  build: '<path d="M14.5 6.5l3 3L8 19l-3.5.5L5 16z"/><path d="M13 4l3-1 5 5-1 3-2-2"/>',
  outpost: '<path d="M3 20h18"/><path d="M5 20v-6h14v6"/><path d="M5 14c1-2 3-2 4 0 1-2 3-2 4 0 1-2 3-2 4 0 1-2 2-2 2 0"/><path d="M12 14V4l5 2-5 2"/>',
  upgrade: '<path d="M12 20V5M6 11l6-6 6 6"/><path d="M5 21h14"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  soundOn: '<path d="M4 9.5h4l5-4.5v14l-5-4.5H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  soundOff: '<path d="M4 9.5h4l5-4.5v14l-5-4.5H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  vr: '<path d="M3 8.5h18v8h-5.5l-2-3h-3l-2 3H3z"/><path d="M7 8.5V6h10v2.5"/>',
  ar: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  folder: '<path d="M3 6h7l2 2.5h9V19H3z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  fuel: '<path d="M6 4h8l4 4v12H6z"/><path d="M9 4V2.5h4V4M9 11l6 5M15 11l-6 5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z"/>',
  sword: '<path d="M14.5 3.5H20.5V9.5L9.5 20.5 3.5 14.5z"/><path d="M6 12l6 6M3 21l3-3"/>',
  hp: '<path d="M12 20.5s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9.5c0 6-8 11-8 11z" fill="currentColor"/>',
  boot: '<path d="M7 3h6v8l6 3.5c1.2.7 1.5 2 1.5 3.5V20H4V9z"/><path d="M4 16.5h16.5"/>',
  range: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  warning: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  people: '<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 19c.5-3.5 2.8-5.5 5.5-5.5s5 2 5.5 5.5M13.5 15c.8-1.4 1.9-2 3-2 2.3 0 4 1.7 4.5 5"/>',
  helmet: '<path d="M3.5 15a8.5 8.5 0 0 1 17 0z"/><path d="M2 15h20v2.5H2zM12 6.5V15"/>',
  city: '<path d="M3 21V10l5-3v14M8 21V5l7 3v13M15 21V12l6 2.5V21M2 21h20"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lightning: '<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/>',
  grand: '<path d="M4 21h16M6 21v-9M10 21v-9M14 21v-9M18 21v-9M3 12h18L12 4z"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  tutorial: '<path d="M4 5.5C7 4 10 4 12 6c2-2 5-2 8-.5V19c-3-1.5-6-1.5-8 .5-2-2-5-2-8-.5z"/><path d="M12 6v13.5"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10.5V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6.5 7S5 18.5 4 15.5L3 12.5a1.5 1.5 0 0 1 2.6-1.4L8 14"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  rain: '<path d="M6.5 14.5a4.5 4.5 0 0 1 .6-9 5.5 5.5 0 0 1 10.4 1.5 3.75 3.75 0 0 1 0 7.5z"/><path d="M8 17.5l-1 3M12 17.5l-1 3M16 17.5l-1 3"/>',
  snow: '<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  // Zufallsereignisse und Kampagne / random events and campaign
  storm: '<path d="M6.5 13.5a4.5 4.5 0 0 1 .6-9 5.5 5.5 0 0 1 10.4 1.5 3.75 3.75 0 0 1 0 7.5"/><path d="M12.5 11.5l-3 5h4l-2.5 5" stroke-linejoin="round"/>',
  germ: '<circle cx="12" cy="12" r="5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8"/><circle cx="10.5" cy="10.5" r="1" fill="currentColor"/><circle cx="13.5" cy="13.2" r="1" fill="currentColor"/>',
  torch: '<path d="M9 10.5h6l-1.6 10.5h-2.8z"/><path d="M12 2.5c2.6 2.3 3.1 4.4 1.9 6.8h-3.8C8.9 6.9 9.7 4.6 12 2.5z" fill="currentColor"/>',
  truck: '<path d="M2.5 6h11v10h-11zM13.5 9.5H18l3 3.5v3h-7.5"/><circle cx="6.5" cy="17.5" r="2" fill="currentColor"/><circle cx="17" cy="17.5" r="2" fill="currentColor"/>',
  defector: '<circle cx="8" cy="7" r="3"/><path d="M2.5 20c.6-4 2.6-6 5.5-6s4.9 2 5.5 6"/><path d="M14 11h7M18 8l3 3-3 3"/>',
  chest: '<path d="M3 10h18v10H3z"/><path d="M3 10c0-3.5 2-5.5 4.5-5.5h9C19 4.5 21 6.5 21 10"/><path d="M3 13.5h18"/><path d="M10.5 12h3v4h-3z" fill="currentColor"/>',
  drought: '<circle cx="12" cy="8" r="3.5"/><path d="M12 1.5V3M5.5 8H4M20 8h-1.5M7.4 3.4l1 1M16.6 3.4l-1 1"/><path d="M3 15h18M7 15l2 3-1.5 3M15 15l-1.5 2.5 2 3.5M11.5 15l.5 2"/>',
  map: '<path d="M3 6l6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 3.5V18M15 6v14.5"/>',
  // Fraktionsembleme / faction emblems
  emblemGear: '<path d="M12 2.5l1.6 2.4 2.8-.8.6 2.9 2.8.9-.9 2.8 2.4 1.6-2.4 1.6.9 2.8-2.8.9-.6 2.9-2.8-.8L12 21.5l-1.6-2.4-2.8.8-.6-2.9-2.8-.9.9-2.8L2.7 12l2.4-1.6-.9-2.8 2.8-.9.6-2.9 2.8.8z" fill="currentColor"/><circle cx="12" cy="12" r="3.5" fill="var(--s-surface-raised)"/>',
  emblemFist: '<path d="M6 10.5h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" fill="currentColor"/><path d="M6 10.5V6.5a1.5 1.5 0 0 1 3 0V10M9 10V5.5a1.5 1.5 0 0 1 3 0V10M12 10V5.5a1.5 1.5 0 0 1 3 0V10M15 10V7a1.5 1.5 0 0 1 3 0v3.5" fill="currentColor"/>',
  emblemStarRing: '<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5l1.9 4 4.4.5-3.3 3 .9 4.4L12 15.2l-3.9 2.2.9-4.4-3.3-3 4.4-.5z" fill="currentColor"/>',
  emblemCompass: '<circle cx="12" cy="12" r="9.5"/><path d="M12 2.5l2 7.5 7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2z" fill="currentColor"/>',
  emblemDoom: '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M12 3v3M5.2 6.6l2 2M18.8 6.6l-2 2M2.5 11h2.5M19 11h2.5"/><path d="M2.5 18.5h19"/><path d="M10.5 15l1.5-3 1.5 3"/>',
  emblemNode: '<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="6.8" r="1.2" fill="currentColor"/><circle cx="7.5" cy="14.6" r="1.2" fill="currentColor"/><circle cx="16.5" cy="14.6" r="1.2" fill="currentColor"/><path d="M12 8v2M8.5 14l2-1M15.5 14l-2-1"/>',
  emblemSaucer: '<ellipse cx="12" cy="13" rx="9.5" ry="3.2"/><path d="M7.5 11.6a4.5 4.5 0 0 1 9 0" fill="currentColor"/><path d="M8 17.5l-1.5 3M12 17.5v3M16 17.5l1.5 3"/>',
  emblemHex: '<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><path d="M12 7l4.3 2.5v5L12 17l-4.3-2.5v-5z" fill="currentColor"/>',
};

export type IconName = keyof typeof P;

export const FACTION_EMBLEM: Record<string, IconName> = {
  korvat: 'emblemGear', dravon: 'emblemFist', alvenia: 'emblemStarRing', meridon: 'emblemCompass', velkar: 'emblemHex', zyrr: 'emblemSaucer', vesper: 'emblemDoom', nexus: 'emblemNode',
};

/** SVG-Markup fuer ein Symbol / SVG markup for an icon */
export function icon(name: IconName | string, cls = 'icon'): string {
  const body = P[name] ?? P.info;
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/** Symbol an fester Position in einem SVG / icon at a fixed position inside an SVG */
export function iconAt(name: IconName | string, x: number, y: number, size: number): string {
  const body = P[name] ?? P.info;
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/** Pfad-Rohdaten fuer Canvas (XR-Panels) / raw SVG body for canvas use (XR panels) */
export function iconSvgDataUrl(name: IconName | string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" color="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${(P[name] ?? P.info).replace(/currentColor/g, color)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
