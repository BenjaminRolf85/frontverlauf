/**
 * Kurzprofil einer Fraktion als gut lesbare Marken: Bonus, Spezialeinheit, eigenes Gebaeude, zweiter Bonus.
 * Short faction profile as easy-to-read chips: bonus, signature unit, own building, second bonus.
 */
import { FACTIONS, type BuildingId, type FactionId, type UnitTypeId } from '../data/balance';
import { has, t } from '../i18n/i18n';
import { esc } from './components';
import { leaderPortrait } from './leaders';
import { BUILD_ICON, UNIT_ICON } from './hud';
import { icon } from './icons';

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

export interface FactionTrait { kind: 'perk' | 'unit' | 'discount' | 'building' | 'perk2'; icon: string; label: string; value: string; desc: string }

/** Merkmale einer Fraktion / traits of a faction */
export function factionTraits(f: FactionId): FactionTrait[] {
  const out: FactionTrait[] = [];
  const k = (s: string) => t(`factions.${f}.${s}`);
  out.push({ kind: 'perk', icon: 'star', label: t('traits.perk'), value: k('perk'), desc: k('perkDesc') });
  if (has(`factions.${f}.perk2`)) out.push({ kind: 'perk2', icon: 'star', label: t('traits.perk2'), value: k('perk2'), desc: has(`factions.${f}.perk2Desc`) ? k('perk2Desc') : '' });
  const unit = SIGNATURE_UNIT[f];
  if (unit) out.push({ kind: 'unit', icon: UNIT_ICON[unit] ?? 'helmet', label: t('traits.unit'), value: t(`units.${unit}`), desc: has(`unitDesc.${unit}`) ? t(`unitDesc.${unit}`) : '' });
  const fs = FACTIONS[f];
  if (fs.discount > 0) {
    out.push({ kind: 'discount', icon: UNIT_ICON[fs.discountUnit] ?? 'helmet', label: t('traits.discount'),
      value: t('traits.discountValue', { unit: t(`units.${fs.discountUnit}`), pct: Math.round(fs.discount * 100) }), desc: '' });
  }
  const b = SIGNATURE_BUILDING[f];
  if (b) out.push({ kind: 'building', icon: BUILD_ICON[b] ?? 'build', label: t('traits.building'), value: t(`buildings.${b}`), desc: has(`buildingDesc.${b}`) ? t(`buildingDesc.${b}`) : '' });
  return out;
}

/** Marken als HTML / chips as HTML */
export function traitChips(f: FactionId, opts: { desc?: boolean } = {}): string {
  // span statt ul/li, damit die Marken auch in Knoepfen gueltig sind / spans instead of ul/li so chips are valid inside buttons
  return `<span class="trait-list" role="list" style="--trait-accent:var(--faction-${f}-primary)">${factionTraits(f).map((tr) => `
    <span class="trait trait-${tr.kind}" role="listitem" title="${esc(tr.desc || tr.value)}">${icon(tr.icon, 'icon-sm')}
      <span class="trait-text"><span class="trait-label">${esc(tr.label)}</span> <strong>${esc(tr.value)}</strong>${opts.desc && tr.desc ? `<span class="trait-desc">${esc(tr.desc)}</span>` : ''}</span></span>`).join('')}</span>`;
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
      ${opt('style', t('leaders.style'))}
      ${opt('aiStyle', t('identity.aiStyle'))}
    </div>
  </div>`;
}
