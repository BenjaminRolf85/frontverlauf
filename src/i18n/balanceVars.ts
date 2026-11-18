/**
 * Zahlen aus balance.ts als feste Platzhalter fuer alle Texte: t() setzt sie ein, wenn der Aufrufer den Namen nicht selbst
 * uebergibt. So koennen Beschreibungen (Einheiten, Faehigkeiten, Gebaeude, Belohnungen, Merkmale) Zahlen nennen, ohne dass
 * jede Anzeigestelle sie kennt, und die Texte laufen beim Balancing nicht mehr auseinander.
 * Numbers from balance.ts as fixed placeholders for every text: t() fills them in when the caller does not pass the name
 * itself. Descriptions (units, abilities, buildings, rewards, traits) can name numbers without every display site knowing
 * them, and the texts no longer drift when the balancing changes.
 */
import {
  CITY, CITY_UPGRADES, COUNTER, DEFENSE_BONUS, ECON, FUEL, GRAND_PROJECTS, HEALING, HIT, INCOME, MARTYR, PERKS,
  PERKS2, RANGE_BONUS, REMAINS, RETREAT, SCORE, SIN, UNIQUE, UNITS, VETERAN, WEATHER, XENO, BARRIER, type UnitTypeId,
} from '../data/balance';

const pct = (x: number) => Math.round(x * 100);
const move = (u: UnitTypeId) => UNITS[u].move;
const range = (u: UnitTypeId) => UNITS[u].range;

/** Platzhaltername -> Zahl (Kommazahlen setzt t() in der Spielsprache) / placeholder name -> number (t() formats decimals in the game language) */
export const BALANCE_VARS: Readonly<Record<string, number>> = {
  // Bewegung und Reichweite / movement and range
  infantryMove: move('infantry'),
  jeepMove: move('jeep'),
  tankMove: move('tank'),
  tankRange: range('tank'),
  tankReturn: UNITS.tank.returnRange ?? range('tank'),
  teslaMove: move('teslaTank'),
  teslaRange: range('teslaTank'),
  reliquaryMove: move('reliquary'),
  reliquaryRange: range('reliquary'),
  wardenRange: range('lightWarden'),
  sniperRange: range('sniper'),
  artRange: range('artillery'),
  artRangeKorvat: range('artillery') + (RANGE_BONUS.bonus.korvat?.artillery ?? 0),
  subRange: range('submarine'),
  battleshipRange: range('battleship'),
  tripodRange: range('tripod'),
  rocketCartRange: range('rocketCart'),
  railgunRange: range('railgun'),
  antiTankRange: range('antiTank'),
  faustRange: range('faustZealot'),
  protoRange: range('protoWalker'),
  droneMove: move('kamikazeDrone'),
  // Faehigkeiten / abilities
  medicHeal: HEALING.medic,
  fuelRounds: FUEL.tank,
  uprisingMax: CITY.uprisingMaxUnits,
  flakDamage: COUNTER.flak.damage,
  mineCost: COUNTER.mine.cost,
  mineMax: COUNTER.mine.maxPerFaction,
  mendHp: UNIQUE.mendHp,
  plunderStars: UNIQUE.plunderStars,
  retreatPct: pct(RETREAT.damage),
  retreatCooldown: RETREAT.cooldown,
  wreckCover: REMAINS.wreckDefenseBonus,
  slowedMove: BARRIER.slowedMove,
  hitMin: pct(HIT.mult.miss),
  hitMax: pct(HIT.mult.crit),
  // Fraktionsmerkmale / faction traits
  outpostCost: ECON.outpostCost,
  earthworksCost: PERKS2.earthworksOutpostCost,
  veteranKills: VETERAN.kills,
  drillKills: VETERAN.killsDravon,
  hardenedAttack: PERKS2.battleHardenedAttack,
  boomLevel: PERKS.boomLevelReduction,
  pilotsMove: PERKS2.harbourPilotsMove,
  researchLeadPct: pct(PERKS.researchLeadDiscount),
  barrierCost: BARRIER.cost,
  engineerBarrierCost: PERKS2.engineerCorpsBarrierCost,
  forestSpawnHeal: PERKS2.forestSpawnHeal,
  martyrdomStars: PERKS2.martyrdomStars,
  sensorNetVision: PERKS2.sensorNetVision,
  sinRounds: SIN.rounds,
  judgementPct: pct(SIN.judgement),
  martyrHeal: MARTYR.heal,
  martyrDefPct: pct(MARTYR.defense),
  martyrRounds: MARTYR.rounds,
  // Gebaeude / buildings
  logisticsPer: INCOME.logisticsPerAdjacent,
  logisticsMax: INCOME.logisticsMax,
  rcBase: SCORE.researchCenterBase,
  rcStep: SCORE.researchCenterStep,
  rcInterval: SCORE.researchCenterInterval,
  rcMax: SCORE.researchCenterMax,
  outpostDef: DEFENSE_BONUS.outpost,
  kolkhozPop: UNIQUE.kolkhozPop,
  kolkhozInterval: UNIQUE.kolkhozInterval,
  tradingPostStars: UNIQUE.tradingPostPerHarbour,
  testLabPct: pct(UNIQUE.testLabDiscount),
  testLabMax: UNIQUE.testLabMax,
  cyberPct: pct(ECON.cyberneticsDiscount),
  // Grossprojekte / grand projects
  grandPop: GRAND_PROJECTS.pop,
  grandPoints: SCORE.grandProject,
  peaceRounds: GRAND_PROJECTS.peaceRounds,
  bankStars: GRAND_PROJECTS.bankStars,
  victoryKills: GRAND_PROJECTS.kills,
  tradeCities: GRAND_PROJECTS.connectedCities,
  palaceLevel: GRAND_PROJECTS.palaceLevel,
  // Stadtbelohnungen / city rewards
  factoryStars: INCOME.factory,
  bunkerRingDef: DEFENSE_BONUS.cityWithBunker,
  rewardStars: CITY.rewardStars,
  rewardPop: CITY.rewardPopulation,
  govStars: INCOME.govQuarter,
  govPoints: SCORE.govQuarter,
  expandMin: 2 * CITY.expandedRadius + 1,
  expandMax: 2 * CITY.growMaxRadius + 1,
  // Stadt-Ausbauten / city upgrades
  upgradeSlots: CITY_UPGRADES.slots,
  radioArea: 2 * CITY_UPGRADES.radioRadius + 1,
  radioRange: CITY_UPGRADES.radioRange,
  bunkerDef: CITY_UPGRADES.bunkerDefense,
  veteranHp: VETERAN.bonusHp,
  hospitalHeal: CITY_UPGRADES.hospitalHeal,
  cityFlakDamage: CITY_UPGRADES.flakDamage,
  depotIncome: CITY_UPGRADES.depotIncome,
  // Wetter und Xeno-Boden / weather and xeno ground
  weatherCycle: WEATHER.cycleRounds,
  windFuel: WEATHER.wind.fuelBurn,
  xenoDef: XENO.groundDefense,
  xenoHeal: XENO.groundHeal,
};
