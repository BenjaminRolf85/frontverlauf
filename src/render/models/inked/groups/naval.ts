/**
 * Gruppe See und Fremde: Schiffe, Fremdmaschinen, Sonderbauarten der Alvenia, Lenkflugkoerper.
 * Atlanten: 'ship' (Zerstoerer, Schlachtschiff, U-Boot), 'boat' (Landungsboot, Kaperschiff, Nebelkutter,
 * Lenkflugkoerper), 'alien' (Terraformer, Gleiter, Mech, Dreibeiner, Schwarmmutter), 'faith' (Reliquiar, Sonnenlanze, Goettlicher
 * Funke). Jeder Atlas traegt die Embleme und, wo eine Besatzung zu sehen ist, die Besatzung in halber Groesse mit,
 * damit jede Einheit mit EINEM Atlas auskommt.
 * Group sea and aliens: ships, alien machines, Alvenia's special designs, guided missile.
 * Atlases: 'ship' (destroyer, battleship, submarine), 'boat' (landing boat, privateer, fog cutter, guided missile),
 * 'alien' (terraformer, skimmer, mech, tripod, swarm mother), 'faith' (reliquary, sun lance, divine spark). Every atlas carries the
 * emblems and, where a crew shows, the crew at half size, so every unit gets by with ONE atlas.
 */
import { mech, skimmer, terraformer, tripod } from '../aliens';
import { divineSpark, reliquary, sunLance } from '../alveniaSpecial';
import { faithCells } from '../alveniaSpecialPaint';
import { alienCells } from '../aliensPaint';
import { BOSS_MAX_EXT, BOSS_MAX_H, swarmMother } from '../boss';
import { bossCells } from '../bossPaint';
import { crewCells } from '../figurePaint';
import { fogCutter, guidedMissile, landingBoat, privateer } from '../boats';
import { boatCells } from '../boatsPaint';
import { crewCellsLegs, emblemCells, trimSome } from '../navalPaint';
import { battleship, destroyer, submarine } from '../ships';
import { shipCells } from '../shipsPaint';
import type { InkedGroup } from '../types';

export const naval: InkedGroup = {
  atlases: () => [
    ['ship', [...shipCells(), ...crewCells(0.5), ...emblemCells(48), ...trimSome(['digits', 'glowStrip'])]],
    ['boat', [...boatCells(), ...crewCellsLegs(0.5), ...emblemCells(48), ...trimSome(['digits', 'glowStrip', 'grille', 'exhaust', 'wheel', 'tyre'])]],
    ['alien', [...alienCells(), ...bossCells(), ...emblemCells(48)]],
    ['faith', [...faithCells(), ...crewCellsLegs(0.5), ...emblemCells(48), ...trimSome(['link', 'linkSide', 'bay', 'wheel', 'sprocket', 'tyre', 'exhaust'])]],
  ],
  types: {
    // Kriegsschiffe: alle Fraktionen (Bauform ueber styleOf) / warships: all factions (shape via styleOf)
    destroyer: { atlas: 'ship', build: destroyer, maxEdge: 0.09, voxel: 0.007 },
    battleship: { atlas: 'ship', build: battleship, maxEdge: 0.1, voxel: 0.0075 },
    submarine: { atlas: 'ship', build: submarine, maxEdge: 0.09, voxel: 0.007 },
    landingBoat: { atlas: 'boat', build: landingBoat, maxEdge: 0.09, voxel: 0.0065 },
    privateer: { atlas: 'boat', build: privateer, maxEdge: 0.09, voxel: 0.007 },
    fogCutter: { atlas: 'boat', build: fogCutter, maxEdge: 0.09, voxel: 0.0065 },
    guidedMissile: { atlas: 'boat', build: guidedMissile, maxEdge: 0.09, voxel: 0.006 },
    // Maschinen der Zyrr: die Farbe kommt vom Besitzer / the Zyrr's machines: the colour comes from the owner
    terraformer: { atlas: 'alien', build: terraformer, maxEdge: 0.08, voxel: 0.006 },
    skimmer: { atlas: 'alien', build: skimmer, maxEdge: 0.08, voxel: 0.006 },
    mech: { atlas: 'alien', build: mech, maxEdge: 0.08, voxel: 0.006 },
    tripod: { atlas: 'alien', build: tripod, maxEdge: 0.08, voxel: 0.006 },
    // Endgegner: dreifache Einheitenhoehe, eigene Grenzen statt der Kachel (Lebensbalken bei 2.15)
    // boss: three times unit height, own limits instead of the tile (HP badge at 2.15)
    swarmMother: { atlas: 'alien', build: swarmMother, maxEdge: 0.14, voxel: 0.011, maxH: BOSS_MAX_H, maxExt: BOSS_MAX_EXT },
    // Sonderbauarten der Alvenia (Formensprache FAITH, fuer jeden Besitzer gleich) / Alvenia's special designs (design language FAITH, the same for any owner)
    reliquary: { atlas: 'faith', build: reliquary, maxEdge: 0.085, voxel: 0.0065 },
    sunLance: { atlas: 'faith', build: sunLance, maxEdge: 0.085, voxel: 0.006 },
    divineSpark: { atlas: 'faith', build: divineSpark, maxEdge: 0.13, voxel: 0.0075 },
  },
};
