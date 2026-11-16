/**
 * Kurzprofil einer Fraktion als gut lesbare Marken: Bonus, Spezialeinheit, eigenes Gebaeude, zweiter Bonus.
 * Short faction profile as easy-to-read chips: bonus, signature unit, own building, second bonus.
 */
import { CULT, EMPLACEMENT, FACTIONS, HIT, ENTRENCH, HOME_DEFENSE, MARTYR, MOVE_FIRE, RANGE_BONUS, RESOURCE, SIN, UNITS, type BuildingId, type FactionId, type UnitTypeId } from '../data/balance';
import { factionRace } from '../core';
import { has, num, t } from '../i18n/i18n';
import { esc } from './components';
import { leaderPortrait } from './leaders';
import { loreButton } from './lore';
import { BUILD_ICON, UNIT_ICON, buildingDescText } from './hud';
import { icon } from './icons';
import { victoryGoalText, victoryShortText } from './victory';

/** Kennzeichnende Einheit je Fraktion / signature unit per faction */
const SIGNATURE_UNIT: Partial<Record<FactionId, UnitTypeId>> = {
  korvat: 'steppeRider', dravon: 'stormbreaker', alvenia: 'peacekeeper', meridon: 'privateer', velkar: 'protoWalker',
  zyrr: 'tripod', vesper: 'zealot', nexus: 'titan',
};
/** Eigenes Gebaeude je Fraktion / own building per faction */
const SIGNATURE_BUILDING: Partial<Record<FactionId, BuildingId>> = {
  korvat: 'kolkhoz', dravon: 'mercenaryBarracks', alvenia: 'embassyPalace', meridon: 'tradingPost', velkar: 'testLab',
  zyrr: 'xenoHive', vesper: 'shrine', nexus: 'dataCenter',
};

export interface FactionTrait { kind: 'perk' | 'unit' | 'discount' | 'building' | 'resource' | 'perk2' | 'combat' | 'feature' | 'aim' | 'victory'; icon: string; label: string; value: string; desc: string }

/**
 * Kampfboni einer Fraktion mit Namen und Text: Feuern nach Bewegung (MOVE_FIRE.bonus, Korvat, Dravon), Reichweite (RANGE_BONUS, Korvat), Verschanzen (ENTRENCH, Korvat) und Verteidigung auf
 * eigenem Gebiet (HOME_DEFENSE, Alvenia); Zahlen aus balance.ts.
 * Combat bonuses of a faction with name and text: firing after moving (MOVE_FIRE.bonus, Korvat, Dravon), range (RANGE_BONUS, Korvat), entrenching (ENTRENCH, Korvat) and defence on own
 * territory (HOME_DEFENSE, Alvenia); numbers from balance.ts.
 */
export function combatBonusTexts(f: FactionId): { name: string; desc: string; icon: string }[] {
  const out: { name: string; desc: string; icon: string }[] = [];
  const pct = (x: number) => Math.round(x * 100);
  const b = MOVE_FIRE.bonus[f];
  if (b) {
    const rider = SIGNATURE_UNIT[f];
    out.push({ icon: 'boot', name: t(`moveFire.bonus.${f}`),
      desc: t(`moveFire.bonusDesc.${f}`, { pct: pct(b.all), base: pct(MOVE_FIRE.damage), rider: pct((rider && b.units?.[rider]) ?? b.all) }) });
  }
  // Fraktionsbonus auf kritische Treffer (Dravon) / faction crit bonus (Dravon)
  const c = HIT.factionCrit[f];
  if (c) out.push({ icon: 'dice', name: t(`hit.factionCrit.${f}`), desc: t(`hit.factionCritDesc.${f}`, { pct: pct(HIT.odds.human.crit + c), base: pct(HIT.odds.human.crit) }) });
  // Verschanzen (ENTRENCH, Korvat) / entrenching (ENTRENCH, Korvat)
  const e = ENTRENCH.bonus[f];
  if (e) out.push({ icon: 'shield', name: t('entrench.name'), desc: t('entrench.desc', { pct: pct(e) }) });
  // Reichweitenbonus (Korvat-Artillerie, RANGE_BONUS) / range bonus (Korvat artillery, RANGE_BONUS)
  const r = RANGE_BONUS.bonus[f];
  if (r) {
    for (const [type, n] of Object.entries(r) as [UnitTypeId, number][]) {
      out.push({ icon: 'range', name: t(`rangeBonus.bonus.${f}`), desc: t(`rangeBonus.bonusDesc.${f}`, { range: UNITS[type].range + n, base: UNITS[type].range }) });
    }
  }
  const h = HOME_DEFENSE.bonus[f];
  if (h) out.push({ icon: 'shield', name: t(`homeDefense.bonus.${f}`), desc: t(`homeDefense.bonusDesc.${f}`, { pct: pct(h) }) });
  // Kult: Mahnmal (zur Schau gestellte Gefallene) / cult: memorial (the fallen put on display)
  if (f === CULT.faction) out.push({ icon: 'emblemDoom', name: t('memorial.name'), desc: memorialText() });
  return out;
}

/** Regeltext des Mahnmals mit Zahlen aus balance.ts (CULT) / rule text of the memorial with numbers from balance.ts (CULT) */
export function memorialText(): string {
  return t('memorial.desc', { rounds: CULT.memorialRounds, zeal: Math.round(CULT.memorialAttack * 100), fear: Math.round(CULT.memorialFear * 100) });
}

/**
 * Zahlen zum Fraktionsmerkmal aus balance.ts: Dravon Festungsbau, Velkar "Labor im Feld" (eigene Bauarten).
 * Numbers for the faction feature from balance.ts: Dravon fortress building, Velkar "lab in the field" (own designs).
 */
export function featureParams(f: FactionId): Record<string, string | number> {
  // Heiliges Alvenia "Fernwaffen des Ordens" / Holy Alvenia "Arms of the Order"
  if (f === 'alvenia') {
    return { warden: UNITS.lightWarden.range, inf: UNITS.infantry.range, wardenDef: num(UNITS.lightWarden.defense), reliq: UNITS.reliquary.range, tank: UNITS.tank.range,
      reliqDef: num(UNITS.reliquary.defense), tankDef: num(UNITS.tank.defense), lance: UNITS.sunLance.range, art: UNITS.artillery.range };
  }
  if (f === 'velkar') {
    return { tesla: UNITS.teslaTank.attack, tank: UNITS.tank.attack, miss: Math.round((HIT.unit.teslaTank?.miss ?? 0) * 100),
      rail: UNITS.railSniper.range, sniper: UNITS.sniper.range };
  }
  return { cost: EMPLACEMENT.cost, range: EMPLACEMENT.range };
}

/**
 * Zahlen fuer die Merkmalstexte aus balance.ts (Alvenia: Strafgericht und Maertyrer-Segen).
 * Numbers for the trait texts from balance.ts (Alvenia: Judgement and Martyr's Blessing).
 */
export function perkParams(): Record<string, number> {
  return { pct: Math.round(SIN.judgement * 100), rounds: SIN.rounds, heal: MARTYR.heal, def: Math.round(MARTYR.defense * 100), blessRounds: MARTYR.rounds };
}

/** Merkmale einer Fraktion / traits of a faction */
export function factionTraits(f: FactionId): FactionTrait[] {
  const out: FactionTrait[] = [];
  const k = (s: string) => t(`factions.${f}.${s}`, perkParams());
  out.push({ kind: 'perk', icon: 'star', label: t('traits.perk'), value: k('perk'), desc: k('perkDesc') });
  if (has(`factions.${f}.perk2`)) out.push({ kind: 'perk2', icon: 'star', label: t('traits.perk2'), value: k('perk2'), desc: has(`factions.${f}.perk2Desc`) ? k('perk2Desc') : '' });
  // Fraktionsmerkmal (Dravon: Festungsbau), Zahlen aus balance.ts / faction feature (Dravon: fortress building), numbers from balance.ts
  if (has(`factions.${f}.feature`)) out.push({ kind: 'feature', icon: f === 'velkar' ? 'tesla' : f === 'alvenia' ? 'emblemHalo' : 'range', label: t('traits.feature'), value: k('feature'), desc: t(`factions.${f}.featureDesc`, featureParams(f)) });
  const unit = SIGNATURE_UNIT[f];
  if (unit) out.push({ kind: 'unit', icon: UNIT_ICON[unit] ?? 'helmet', label: t('traits.unit'), value: t(`units.${unit}`), desc: has(`unitDesc.${unit}`) ? t(`unitDesc.${unit}`) : '' });
  const fs = FACTIONS[f];
  if (fs.discount > 0) {
    out.push({ kind: 'discount', icon: UNIT_ICON[fs.discountUnit] ?? 'helmet', label: t('traits.discount'),
      value: t('traits.discountValue', { unit: t(`units.${fs.discountUnit}`), pct: Math.round(fs.discount * 100) }), desc: '' });
  }
  const b = SIGNATURE_BUILDING[f];
  if (b) out.push({ kind: 'building', icon: BUILD_ICON[b] ?? 'build', label: t('traits.building'), value: t(`buildings.${b}`), desc: has(`buildingDesc.${b}`) ? buildingDescText(b) : '' });
  // Ressourcengebaeude zum Rohstoff-Thema der Comics / resource building on the comics' resource theme
  const rb = RESOURCE.buildings[f];
  out.push({ kind: 'resource', icon: BUILD_ICON[rb] ?? 'build', label: t('traits.resource'), value: t(`buildings.${rb}`), desc: buildingDescText(rb) });
  // Kampfboni (Korvat: Steppensturm, Alvenia: Glaubensbollwerk) / combat bonuses (Korvat: Steppe Storm, Alvenia: Bulwark of Faith)
  for (const cb of combatBonusTexts(f)) out.push({ kind: 'combat', icon: cb.icon, label: t('traits.combat'), value: cb.name, desc: cb.desc });
  // Treffsicherheit der Rasse / race accuracy
  const race = factionRace(f);
  out.push({ kind: 'aim', icon: 'dice', label: t('hit.title'), value: t(`hit.race.${race}`), desc: t(`hit.raceDesc.${race}`) });
  // eigene Siegbedingung / own victory condition
  out.push({ kind: 'victory', icon: 'trophy', label: t('traits.victory'), value: victoryShortText(f), desc: victoryGoalText(f) });
  return out;
}

/** Marken als HTML / chips as HTML */
/** compact: nur Bonus und Spezialeinheit in einer Zeile (Rest ueber "Details") / only perk and special unit in one row (rest via "Details") */
export function traitChips(f: FactionId, opts: { desc?: boolean; compact?: boolean } = {}): string {
  const traits = factionTraits(f).filter((tr) => !opts.compact || tr.kind === 'perk' || tr.kind === 'unit');
  // span statt ul/li, damit die Marken auch in Knoepfen gueltig sind / spans instead of ul/li so chips are valid inside buttons
  return `<span class="trait-list ${opts.compact ? 'compact' : ''}" role="list" style="--trait-accent:var(--faction-${f}-primary)">${traits.map((tr) => `
    <span class="trait trait-${tr.kind}" role="listitem" title="${esc(opts.compact ? `${tr.label}: ${tr.value}` : tr.desc || tr.value)}">${icon(tr.icon, 'icon-sm')}
      <span class="trait-text">${opts.compact ? `<span class="sr-only">${esc(tr.label)}:</span>` : `<span class="trait-label">${esc(tr.label)}</span>`} <strong>${esc(tr.value)}</strong>${opts.desc && tr.desc ? `<span class="trait-desc">${esc(tr.desc)}</span>` : ''}</span></span>`).join('')}</span>`;
}

/** Link zur ausfuehrlichen Ansicht / link to the detailed view */
export function detailsLink(f: FactionId): string {
  return `<button type="button" class="details-link" data-details="${f}" aria-label="${esc(t('traits.detailsFor', { name: t(`factions.${f}.name`) }))}">${icon('info', 'icon-sm')}<span>${esc(t('traits.details'))}</span></button>`;
}

/** Ausfuehrliche Fraktionsansicht / detailed faction view */
export function factionDetails(f: FactionId): string {
  const k = (s: string) => esc(t(`factions.${f}.${s}`));
  const opt = (s: string, label: string) => (has(`factions.${f}.${s}`) ? `<p><span class="muted">${esc(label)}:</span> ${k(s)}</p>` : '');
  return `<div class="leader-card faction-details">
    ${leaderPortrait(f, 'lg')}
    <div class="col grow">
      <strong class="display">${k('name')}</strong>
      <span><span class="muted">${esc(t('leaders.leader'))}:</span> ${k('leaderTitle')} <strong>${k('leader')}</strong></span>
      <q class="leader-quote">${k('quote')}</q>
      ${traitChips(f, { desc: true })}
      <p>${k('lore')}</p>
      ${loreButton(f)}
      ${opt('style', t('leaders.style'))}
      ${opt('aiStyle', t('identity.aiStyle'))}
    </div>
  </div>`;
}
