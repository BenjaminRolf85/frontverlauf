/**
 * Hackturm der NEXUS (Modell, HACK.tower): sechseckiger Betonsockel mit Serverschrank, schlanker Gittermast, oben eine
 * geneigte Datenschuessel und ein Sendekopf mit leuchtenden Ringen in der Fraktionsfarbe (Cyan bei NEXUS). Kleiner und
 * schlichter als das Hack-Relais (Wunder), damit beide auf dem Brett unterscheidbar bleiben. memo je Fraktion und Stufe:
 * active = gerade mit einer Einheit verbunden (Ringe heller, Signalboegen am Kopf).
 * NEXUS hack tower (model, HACK.tower): hexagonal concrete plinth with a server cabinet, slim lattice mast, a tilted data
 * dish at the top and an emitter head with rings glowing in the faction colour (cyan for NEXUS). Smaller and plainer than
 * the hack relay (wonder) so both stay distinguishable on the board. memo per faction and state: active = currently
 * linked to a unit (rings brighter, signal arcs at the head).
 * Ursprung unten mittig, Kachel 1x1, Blick +z / origin bottom centre, tile 1x1, facing +z.
 */
import type * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { factionTokens } from '../../design/tokens';
import { Builder, col, geo, memo, mix } from './kit';
import { look, mat } from './look';
import { dish } from './architecture';

const HALF_PI = Math.PI / 2;

export function hackTowerGeometry(f: FactionId, active = false): THREE.BufferGeometry {
  return memo(`hackTower|${f}|${active}`, () => {
    const L = look(f);
    const b = new Builder();
    const metal = mat.gunmetal;
    // Leuchtfarbe: Markierungsfarbe der Fraktion, verbunden heller / glow colour: the faction's marker colour, brighter when linked
    const marker = col(factionTokens[f].marker);
    const g = active ? mix(marker, mat.white, 0.2) : mix(marker, metal, 0.25);
    // Sockel: Sechseckplatte, Leuchtfuge, Serverschrank mit Lichtleiste / plinth: hexagon slab, glowing joint, server cabinet with a light strip
    b.add(geo.cyl(0.36, 0.4, 0.06, 6), mix(mat.concreteDark, metal, 0.4), { p: [0, 0.03, 0] });
    b.add(geo.cyl(0.3, 0.3, 0.008, 6), g, { p: [0, 0.064, 0] });
    b.add(geo.cbox(0.16, 0.16, 0.11, 0.015), L.jacket, { p: [0.2, 0.14, -0.12] });
    for (let i = 0; i < 3; i++) b.box(0.1, 0.008, 0.004, g, [0.2, 0.1 + i * 0.035, -0.063]);
    // Gittermast: drei Beine mit Querstreben / lattice mast: three legs with cross braces
    const base = 0.06, top = 0.86;
    const w = (y: number) => 0.1 * (1 - (y - base) / (top - base + 0.2)) + 0.025;
    const legs = [0, 1, 2].map((k) => (k / 3) * Math.PI * 2 + HALF_PI);
    const at = (a: number, y: number): [number, number, number] => [Math.cos(a) * w(y), y, Math.sin(a) * w(y)];
    for (const a of legs) b.tube(at(a, base), at(a, top), 0.012, 5, metal);
    const levels = 6;
    for (let i = 1; i <= levels; i++) {
      const y = base + ((top - base) * i) / levels, yp = base + ((top - base) * (i - 1)) / levels;
      for (let k = 0; k < 3; k++) {
        b.tube(at(legs[k], y), at(legs[(k + 1) % 3], y), 0.005, 4, metal);
        b.tube(at(legs[k], yp), at(legs[(k + 1) % 3], y), 0.004, 3, metal);
      }
    }
    // Kabel vom Schrank zum Mast / cable from the cabinet to the mast
    b.tube([0.16, 0.12, -0.08], [0.03, 0.2, -0.02], 0.007, 4, mat.ink);
    // Datenschuessel auf halber Hoehe, zur Front geneigt / data dish halfway up, tilted to the front
    dish(b, 0, 0.5, 0.06, 0.12, 0.85, L.jacket, 0);
    b.add(geo.cyl(0.02, 0.02, 0.008, 8), g, { p: [0, 0.69, 0.16] });
    // Sendekopf: Kugel mit drei Leuchtringen und Antennenspitze / emitter head: sphere with three glowing rings and an antenna tip
    b.add(geo.cyl(0.07, 0.05, 0.05, 6), metal, { p: [0, top + 0.02, 0] });
    b.add(geo.ico(0.06, 1), L.jacket, { p: [0, top + 0.09, 0] });
    for (const [y, r] of [[top + 0.05, 0.1], [top + 0.09, 0.085], [top + 0.13, 0.065]] as [number, number][]) {
      b.add(geo.torus(r, 0.007, 3, 16), g, { p: [0, y, 0], r: [HALF_PI, 0, 0] });
    }
    b.tube([0, top + 0.14, 0], [0, top + 0.32, 0], 0.006, 4, metal);
    b.add(geo.ico(0.018, 0), g, { p: [0, top + 0.33, 0] });
    // verbunden: senkrechte Signalringe um den Kopf / linked: upright signal rings around the head
    if (active) {
      for (const r of [0.15, 0.22]) b.add(geo.torus(r, 0.006, 3, 18), g, { p: [0, top + 0.09, 0] });
    }
    addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [0.2, 0.15, -0.063] });
    return b.build();
  });
}
