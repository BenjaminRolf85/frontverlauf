/**
 * Kurzprofil einer Fraktion als gut lesbare Marken: Bonus, Spezialeinheit, eigenes Gebaeude, zweiter Bonus.
 * Short faction profile as easy-to-read chips: bonus, signature unit, own building, second bonus.
 */
import { CULT, EMPLACEMENT, FACTIONS, FIREPOWER, HIT, ENTRENCH, HOME_DEFENSE, MOVE_FIRE, RANGE_BONUS, RESOURCE, SEA_POWER, UNITS, WITHDRAW, type BuildingId, type FactionId, type UnitTypeId, UPKEEP } from '../data/balance';
import { factionRace } from '../core';
import { has, num, t } from '../i18n/i18n';
import { esc } from './components';
import { leaderPortrait } from './leaders';
import { loreButton, narrationHtml, storyButton } from './lore';
import { BUILD_ICON, UNIT_ICON, buildingDescText } from './hud';
import { icon } from './icons';
import { victoryGoalText, victoryShortText } from './victory';

/** Kennzeichnende Einheit je Fraktion / signature unit per faction */
const SIGNATURE_UNIT: Partial<Record<FactionId, UnitTypeId>> = {
  // Meridon: das Schattenkommando steht fuer die Schattenflotte (das Kaperschiff bleibt die einzigartige Einheit)
  // Meridon: the Shadow Commando stands for the shadow fleet (the privateer stays the unique unit)
  korvat: 'steppeRider', dravon: 'stormbreaker', alvenia: 'peacekeeper', meridon: 'shadowCommando', velkar: 'protoWalker',
  zyrr: 'tripod', vesper: 'zealot', nexus: 'titan',
};
/** Eigenes Gebaeude je Fraktion / own building per faction */
const SIGNATURE_BUILDING: Partial<Record<FactionId, BuildingId>> = {
  korvat: 'kolkhoz', dravon: 'mercenaryBarracks', alvenia: 'embassyPalace', meridon: 'tradingPost', velkar: 'testLab',
  zyrr: 'xenoHive', vesper: 'shrine', nexus: 'dataCenter',
};

/** Symbol des Fraktionsmerkmals / icon of the faction feature */
const FEATURE_ICON: Partial<Record<FactionId, string>> = { velkar: 'tesla', alvenia: 'emblemHalo', korvat: 'heavyTank', meridon: 'silo', nexus: 'kamikaze', vesper: 'roleBerserker' };
/** Symbol des zweiten Fraktionsmerkmals (Meridon: Marines, Rollensymbol Infanterie) / icon of the second faction feature (Meridon: marines, infantry role icon) */
const FEATURE2_ICON: Partial<Record<FactionId, string>> = { meridon: 'roleInfantry', velkar: 'academy', nexus: 'hack' };

export interface FactionTrait { kind: 'perk' | 'unit' | 'discount' | 'upkeep' | 'building' | 'resource' | 'perk2' | 'combat' | 'feature' | 'drawback' | 'aim' | 'victory'; icon: string; label: string; value: string; desc: string }

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
  // Meridon: Absetzen nach dem Angriff und leichte Bewaffnung (WITHDRAW, FIREPOWER) / Meridon: withdrawing after the attack and light armament (WITHDRAW, FIREPOWER)
  if (WITHDRAW.factions.includes(f)) out.push({ icon: 'withdraw', name: t('shadow.withdraw.name'), desc: t('shadow.withdraw.desc') });
  if (FIREPOWER.land[f] !== undefined) out.push({ icon: 'warning', name: t('shadow.firepower.name'), desc: t('shadow.firepower.desc', { firepowerPct: pct(1 - FIREPOWER.land[f]!) }) });
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
  // Korvat "Steppenkoloss" / Korvat "Steppe Colossus"
  if (f === 'korvat') {
    const c = UNITS.steppeColossus, k = UNITS.tank;
    return { hp: c.hp, tankHp: k.hp, atk: num(c.attack), tankAtk: num(k.attack), cost: c.cost ?? 0, tankCost: k.cost ?? 0,
      upkeep: UPKEEP.flat.steppeColossus ?? 0, tankUpkeep: UPKEEP.flat.tank ?? 0 };
  }
  // NEXUS "Neue Baureihen": Rechenleistung und Boni / NEXUS "New series": compute and bonuses
  if (f === 'nexus') {
    const d = UNITS.kamikazeDrone, pct = (x: number) => Math.round((x - 1) * 100);
    const race = (alien: boolean) => d.bonusRace?.find((r) => r.races.includes('alien') === alien)?.factor ?? 1;
    return { cyborgC: UNITS.cyborg.compute ?? 0, cyborgHp: UNITS.cyborg.hp, droneC: d.compute ?? 0, droneMove: d.move, droneFoot: pct(race(false)), droneAlien: pct(race(true)),
      flameC: UNITS.flameTank.compute ?? 0, flameFoot: pct(UNITS.flameTank.bonusVs?.foot ?? 1) };
  }
  // Meridon und Kult (Berserker): Zahlen kommen aus BALANCE_VARS / Meridon and the cult (berserker): numbers come from BALANCE_VARS
  if (f === 'meridon' || f === 'vesper') return {};
  return { cost: EMPLACEMENT.cost, range: EMPLACEMENT.range };
}

/** Merkmale einer Fraktion / traits of a faction */
export function factionTraits(f: FactionId): FactionTrait[] {
  const out: FactionTrait[] = [];
  // Zahlen der Merkmalstexte kommen aus BALANCE_VARS (i18n) / numbers of the trait texts come from BALANCE_VARS (i18n)
  const k = (s: string) => t(`factions.${f}.${s}`);
  out.push({ kind: 'perk', icon: 'star', label: t('traits.perk'), value: k('perk'), desc: k('perkDesc') });
  if (has(`factions.${f}.perk2`)) out.push({ kind: 'perk2', icon: 'star', label: t('traits.perk2'), value: k('perk2'), desc: has(`factions.${f}.perk2Desc`) ? k('perk2Desc') : '' });
  // Fraktionsmerkmal (Dravon: Festungsbau), Zahlen aus balance.ts / faction feature (Dravon: fortress building), numbers from balance.ts
  if (has(`factions.${f}.feature`)) out.push({ kind: 'feature', icon: FEATURE_ICON[f] ?? 'range', label: t('traits.feature'), value: k('feature'), desc: t(`factions.${f}.featureDesc`, featureParams(f)) });
  // zweites Merkmal (Meridon: Marines) / second feature (Meridon: marines)
  if (has(`factions.${f}.feature2`)) out.push({ kind: 'feature', icon: FEATURE2_ICON[f] ?? 'range', label: t('traits.feature'), value: k('feature2'), desc: k('feature2Desc') });
  // Nachteil (Meridon: Korruption), Zahlen aus CORRUPTION ueber BALANCE_VARS / drawback (Meridon: corruption), numbers from CORRUPTION via BALANCE_VARS
  if (has(`factions.${f}.drawback`)) out.push({ kind: 'drawback', icon: 'warning', label: t('traits.drawback'), value: k('drawback'), desc: k('drawbackDesc') });
  const unit = SIGNATURE_UNIT[f];
  if (unit) out.push({ kind: 'unit', icon: UNIT_ICON[unit] ?? 'helmet', label: t('traits.unit'), value: t(`units.${unit}`), desc: has(`unitDesc.${unit}`) ? t(`unitDesc.${unit}`) : '' });
  const fs = FACTIONS[f];
  if (fs.discount > 0) {
    out.push({ kind: 'discount', icon: UNIT_ICON[fs.discountUnit] ?? 'helmet', label: t('traits.discount'),
      value: t('traits.discountValue', { unit: t(`units.${fs.discountUnit}`), pct: Math.round(fs.discount * 100) }), desc: '' });
  }
  // Seemacht (Meridon): Schiffe und Marinestuetzpunkt billiger / sea power (Meridon): ships and naval base cheaper
  const sea = SEA_POWER.discount[f];
  if (sea) out.push({ kind: 'discount', icon: 'sail', label: t('traits.discount'), value: t('shadow.seaPower.value', { seaPct: Math.round(sea * 100) }), desc: t('shadow.seaPower.desc', { seaPct: Math.round(sea * 100) }) });
  const b = SIGNATURE_BUILDING[f];
  if (b) out.push({ kind: 'building', icon: BUILD_ICON[b] ?? 'build', label: t('traits.building'), value: t(`buildings.${b}`), desc: has(`buildingDesc.${b}`) ? buildingDescText(b) : '' });
  // Ressourcengebaeude zum Rohstoff-Thema der Comics / resource building on the comics' resource theme
  const rb = RESOURCE.buildings[f];
  out.push({ kind: 'resource', icon: BUILD_ICON[rb] ?? 'build', label: t('traits.resource'), value: t(`buildings.${rb}`), desc: buildingDescText(rb) });
  // Weniger Sold (Korvat: Volksarmee) / less upkeep (Korvat: People's Army)
  const uk = UPKEEP.faction[f];
  if (uk !== undefined && uk < 1) out.push({ kind: 'upkeep', icon: 'star', label: t('traits.upkeep'), value: t('traits.upkeepValue', { pct: Math.round((1 - uk) * 100) }), desc: t('traits.upkeepDesc', { pct: Math.round((1 - uk) * 100) }) });
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

/**
 * Fusszeile einer Fraktionskarte: Hoergeschichte direkt abspielen (wenn es eine gibt) und Link zu den Details.
 * Footer of a faction card: play the audio story right there (if there is one) and the link to the details.
 */
export function cardLinks(f: FactionId): string {
  return `<span class="card-links">${storyButton(f)}${detailsLink(f)}</span>`;
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
      ${narrationHtml(f)}
      ${traitChips(f, { desc: true })}
      <p>${k('lore')}</p>
      ${loreButton(f)}
      ${opt('style', t('leaders.style'))}
      ${opt('aiStyle', t('identity.aiStyle'))}
    </div>
  </div>`;
}
