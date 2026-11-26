/**
 * Gezeichnete Einheiten: Fusstruppen (Schuetze, Scharfschuetze, Pionier, MG-Trupp, Sanitaeter, Spion) fuer alle Fraktionen.
 * Inked units: foot troops (rifleman, sniper, pioneer, MG team, medic, spy) for all factions.
 *
 * Jede Einheit: Figur(en) in Baugroesse in einer Gruppe mit dem Massstab FIG, dazu Waffe und Beiwerk. Beiwerk ohne
 * eigene Zeichnung (Sandsaecke, Dreibein, Trage) kommt ueber die Bruecke b.legacy() aus dem alten Baukasten.
 * Every unit: figure(s) at build size inside a group scaled by FIG, plus weapon and props. Props without their own
 * drawing (sandbags, tripod, stretcher) come through the bridge b.legacy() from the old toolkit.
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { fine, geo, mix, rng, shade, softBox, type V3 } from '../kit';
import { look, mat } from '../look';
import { TECH, techDot } from '../velkarTech';
import { ANKLE_Y, FIG, figure, kneelPose, PELVIS_Y, rifle, standPose } from './figure';
import { bead, box, cell, frontLoft, rod } from './figkit';
import { caseBox, sandbag as sandbagProp, shield } from './props';
import { emblemDecal } from './trim';
import { AtlasLayout, loft, UvBuilder, type Ring } from './uvkit';

const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
const along = (p: V3, dir: V3, t: number): V3 => { const v = V(dir).normalize(); return [p[0] + v.x * t, p[1] + v.y * t, p[2] + v.z * t]; };

/** Schuetze: Gewehr quer vor der Brust / rifleman: rifle across the chest */
export function infantry(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const G: V3 = [0.042, 0.362, 0.092], D: V3 = [-0.4, 0.26, 1];
  // etwas nach hinten, damit das Gewehr die Groesse nicht begrenzt / moved back a little so the rifle does not limit the size
  b.group({ p: [0.01, 0, -0.048], s: FIG }, () => {
    figure(b, A, f, {
      ...standPose([along(G, D, 0.132), [G[0] + 0.004, G[1] - 0.012, G[2] - 0.012]]),
      twist: [0, 0.42, 0], head: [0.04, -0.3, 0],
      footL: [-0.052, ANKLE_Y, 0.04], footR: [0.056, ANKLE_Y, -0.038], bootL: [0, -0.12, 0], bootR: [0, 0.42, 0],
    }, { pack: 'pack', seed: 11 });
    // Gewehr etwas ueberzeichnet, damit es auf dem Brett lesbar bleibt / rifle slightly oversized so it stays readable on the board
    rifle(b, A, G, D, { scale: 1.14, bayonet: f !== 'velkar' });
    if (f === 'velkar') b.legacy((k) => {
      // Laborwache: Energiezelle und Leuchtleiste am Gewehr / lab guard: energy cell and light strip on the rifle
      k.add(geo.cbox(0.03, 0.03, 0.05, 0.006), TECH.shell, { p: along(G, D, 0.15) });
      k.box(0.008, 0.008, 0.06, TECH.glow, along([G[0] + 0.02, G[1] + 0.012, G[2]], D, 0.2));
    });
  });
  return b;
}

/** Scharfschuetze: liegend mit Zielfernrohr, Zweibein und Tarnueberwurf / sniper: prone with scope, bipod and ghillie cover */
export function sniper(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const pelvis: V3 = [0, 0.062, -0.17], body: V3 = [HALF_PI, 0, 0];
  const G: V3 = [0.034, 0.098, 0.115];
  b.group({ p: [0.0, 0.034, -0.02], r: [0, 0.3, 0], s: FIG }, () => {
    figure(b, A, f, {
      pelvis, body, head: [-1.15, 0, 0],
      handL: [0.02, 0.1, G[2] + 0.115], handR: [G[0] + 0.004, G[1] - 0.012, G[2] - 0.01],
      footL: [-0.075, 0.034, -0.415], footR: [0.07, 0.034, -0.42], bootL: [HALF_PI, 0.25, 0], bootR: [HALF_PI, -0.25, 0],
      kneePoleL: [0, -1, 0], kneePoleR: [0, -1, 0], elbowPoleL: [-0.7, -1, 0], elbowPoleR: [0.7, -1, 0],
    }, { armband: true, seed: 23 });
    rifle(b, A, G, [0, -0.01, 1], { scale: 1.28, scope: true, bipod: 0.098, bayonet: false });
    // Tarnueberwurf: ein Buckel ueber Ruecken und Beinen mit gezeichnetem Laub, am Rand einzelne Bueschel
    // ghillie: one hump over back and legs with drawn foliage, single tufts along the edge
    b.group({ p: pelvis, r: body }, () => {
      const base = mix(mix(mat.leafDark, mat.leaf, 0.25), L.primary, 0.12);
      const row = (y: number, rx: number, up: number) => ({ y, rx, rz: up, rzB: 0.012, cz: 0.024, e: 2.3 });
      b.add(frontLoft([
        { y: 0.265, rx: 1e-7, cz: 0.03, c: base }, row(0.235, 0.07, 0.04), row(0.15, 0.108, 0.082), row(0.03, 0.112, 0.078), row(-0.1, 0.098, 0.062),
        row(-0.24, 0.086, 0.05), row(-0.33, 0.06, 0.03), { y: -0.36, rx: 1e-7, cz: 0.03 },
      ], { seg: hi ? 20 : 10, region: cell(A, 'ghillie') }), null, { xf: { r: [0, Math.PI, 0] }, crease: 0 });
      const R = rng(77);
      const tones = [mat.leafDark, shade(mat.leaf, 0.78), mix(mat.leafDark, L.primary, 0.3)];
      const n = hi ? 10 : 4;
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1, y = 0.2 - (i / n) * 0.5 + R() * 0.03;
        b.add(loft([{ y: 0, rx: 0.02, rz: 0.008 }, { y: 0.018, rx: 0.024, rz: 0.008 }, { y: 0.04 + R() * 0.016, rx: 1e-7 }], { seg: 4, region: A.get('blank'), color: tones[i % 3] }), null, { xf: { p: [side * (0.07 + R() * 0.03), y, -0.05 - R() * 0.02], r: [-1.2 + R() * 0.5, 0, side * (-0.9 - R() * 0.5)] }, crease: 0.5 });
      }
    });
  });
  return b;
}

/** Sandsack oder Fertigteilblock der Velkar / sandbag or Velkar prefab block */
function sandbag(b: UvBuilder, A: AtlasLayout, x: number, y: number, z: number, ry: number, tech: boolean) {
  sandbagProp(b, A, x, y, z, ry, tech ? TECH.shell : mat.sandbag);
}

/** Pionier: Schaufel ueber der Schulter, Spitzhacke, schweres Gepaeck, Sandsaecke / pioneer: shovel over the shoulder, pickaxe, heavy pack, sandbags */
export function pioneer(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const hi = fine();
  const G: V3 = [0.112, 0.4, 0.07], T: V3 = [0.135, 0.62, -0.2];
  const D: V3 = [T[0] - G[0], T[1] - G[1], T[2] - G[2]];
  const HL: V3 = [-0.128, 0.3, 0.09];
  b.group({ p: [0, 0, -0.085], s: FIG }, () => {
    figure(b, A, f, {
      ...standPose([HL, G]), twist: [0, -0.15, 0], head: [0.05, -0.25, 0],
      footL: [-0.052, ANKLE_Y, 0.03], footR: [0.052, ANKLE_Y, -0.02], elbowPoleR: [1, -0.4, 0.3],
    }, { pack: 'pioneer', seed: 31 });
    b.legacy((k) => {
      const len = V(D).length();
      k.tube(along(G, D, -0.07), along(G, D, len - 0.05), 0.011, 8, mat.wood);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(D).normalize());
      const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
      k.group({ p: along(G, D, len - 0.03), r: [e.x, e.y, e.z] }, () => {
        if (f === 'velkar') {
          // Frostschneider statt Schaufelblatt / frost cutter instead of the blade
          k.add(geo.cbox(0.05, 0.06, 0.05, 0.01), TECH.shell, { p: [0, 0.02, 0] });
          k.add(geo.cyl(0.075, 0.075, 0.01, 16), mat.metalLight, { p: [0, 0.075, 0], r: [0, 0, HALF_PI] });
          k.add(geo.torus(0.075, 0.006, 3, 16), TECH.glow, { p: [0, 0.075, 0], r: [0, HALF_PI, 0] });
        } else {
          k.add(geo.rtaper(0.1, 0.016, 0.115, 0.01, 0.13, 0.005), mat.metalLight, { p: [0, 0.07, 0] });
          k.add(geo.cyl(0.016, 0.02, 0.04, 8), mat.metal, { p: [0, 0, 0] });
          if (hi) for (const sx of [-1, 1]) k.box(0.006, 0.12, 0.02, mat.metal, [sx * 0.052, 0.072, 0]);
        }
      });
      // Spitzhacke in der linken Hand / pickaxe in the left hand
      k.tube(HL, [-0.15, 0.04, 0.2], 0.009, 6, mat.wood);
      k.group({ p: [-0.152, 0.03, 0.21], r: [0.55, 0, 0] }, () => {
        k.add(geo.taper(0.022, 0.02, 0.006, 0.008, 0.09), mat.metalLight, { p: [0, 0, 0.05], r: [HALF_PI, 0, 0] });
        k.add(geo.taper(0.022, 0.02, 0.006, 0.008, 0.07), mat.metalLight, { p: [0, 0, -0.04], r: [-HALF_PI, 0, 0] });
        k.box(0.026, 0.028, 0.026, mat.metal, [0, 0, 0]);
      });
    });
  });
  // Sandsackstapel / sandbag stack
  const tk = f === 'velkar';
  sandbag(b, A, -0.13, 0, 0.21, 0.35, tk);
  sandbag(b, A, -0.01, 0, 0.24, 0.05, tk);
  sandbag(b, A, 0.11, 0, 0.22, -0.3, tk);
  sandbag(b, A, 0.05, 0.046, 0.23, -0.12, tk);
  if (hi) { sandbag(b, A, -0.07, 0.046, 0.225, 0.2, tk); sandbag(b, A, -0.01, 0.092, 0.23, 0.05, tk); sandbag(b, A, 0.23, 0, 0.1, -1.0, tk); }
  if (tk) b.add(softBox(0.07, 0.008, 0.006, 0.002), TECH.glow, { xf: { p: [-0.01, 0.07, 0.275], r: [0, 0.05, 0] }, gloss: 1, crease: 0 });
  return b;
}

/** MG-Trupp: schweres MG auf Dreibein mit Schild, kniender Schuetze, Ladeschuetze / MG team: heavy MG on a tripod with shield, kneeling gunner, loader */
export function mgTeam(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const gy = 0.155, K = 1.3, GZ = 0.04;
  b.group({ p: [0, 0, GZ], s: K }, () => {
    // Dreibein und Wiege / tripod and cradle
    for (const [x, z] of [[0.09, 0.09], [-0.09, 0.09], [0, -0.12]] as [number, number][]) rod(b, A, [0, gy - 0.025, 0], [x, 0.004, z], 0.0075, 0.0065, 5, mat.dark);
    rod(b, A, [0, gy - 0.045, 0], [0, gy - 0.015, 0], 0.02, 0.016, 6, mat.dark, { crease: 0.6 });
    // Gehaeuse mit Deckel, Griffe / receiver with cover, grips
    box(b, A, [0.05, 0.052, 0.14], 0.01, { px: 'case', nx: 'case' }, mat.dark, { xf: { p: [0, gy, 0] }, gloss: 0.4 });
    box(b, A, [0.044, 0.014, 0.1], 0.004, {}, mat.metal, { xf: { p: [0, gy + 0.032, 0] }, gloss: 0.6 });
    for (const s of [-1, 1]) box(b, A, [0.012, 0.035, 0.012], 0.003, {}, mat.wood, { xf: { p: [s * 0.03, gy - 0.005, -0.075], r: [0.3, 0, 0] } });
    // Lauf: Kuehlmantel mit Ringen (Velkar: gekuehlter Mantel mit Leuchtringen), Muendung / barrel: jacket with rings (Velkar: cooled shroud with glowing rings), muzzle
    const tech = f === 'velkar';
    const jr = tech ? 0.03 : 0.021, jc = tech ? TECH.shell : mat.metal, rc = tech ? TECH.glow : mat.dark;
    const rings: Ring[] = [{ y: -0.07, rx: jr, c: jc, hard: true }];
    for (const z of hi ? (tech ? [0.1, 0.145, 0.19, 0.235] : [0.11, 0.16, 0.21]) : [0.16]) rings.push({ y: -(z - 0.005), rx: jr, hard: true }, { y: -(z - 0.005), rx: jr + 0.004, hard: true, c: rc }, { y: -(z + 0.005), rx: jr + 0.004, hard: true }, { y: -(z + 0.005), rx: jr, hard: true, c: jc });
    rings.push({ y: -0.25, rx: jr, hard: true }, { y: -0.25, rx: 0.009, hard: true, c: mat.ink }, { y: -0.3, rx: 0.009, hard: true }, { y: -0.3, rx: 0.016, hard: true, c: mat.dark }, { y: -0.315, rx: 0.013, hard: true });
    b.add(loft(rings, { seg: hi ? 12 : 8, region: A.get('blank'), capLast: true }), null, { xf: { p: [0, gy + 0.004, 0], r: [-HALF_PI, 0, 0] }, gloss: 0.6 });
    // Kennform: breiter Schutzschild in Stahlgrau mit Sehschlitz, Leiste in der Zweitfarbe, Emblem / signature: wide gun shield in steel grey with a vision slit, bar in the secondary colour, emblem
    const steel = mix(mat.metal, L.primary, 0.22);
    b.group({ p: [0, gy - 0.036, 0.075], r: [-0.12, 0, 0] }, () => {
      shield(b, A, { w: 0.2, h: 0.172, t: 0.014, c: steel });
      if (hi) for (const s of [-1, 1]) b.group({ p: [s * 0.124, 0.008, -0.016], r: [0, s * 0.5, 0] }, () => box(b, A, [0.07, 0.15, 0.012], 0.005, { pz: 'plate' }, shade(steel, 0.82), { xf: { p: [0, 0.075, 0] }, gloss: 0.3 }));
      box(b, A, [0.204, 0.016, 0.018], 0.004, {}, L.secondary, { xf: { p: [0, 0.174, 0] } });
      emblemDecal(b, A, f, [0.048, 0.07, 0.0075], [0, 0, 1], 0.05, steel);
    });
    // Munitionskasten und Gurt / ammo box and belt
    caseBox(b, A, [0.07, 0.055, 0.045], L.gear, { p: [0.085, 0.028, 0] });
    b.legacy((k) => {
      const n = hi ? 14 : 4;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        k.box(0.012, 0.026, 0.009, mat.gold, [0.075 - t * 0.05, 0.06 + Math.sin(t * Math.PI) * 0.06 + t * 0.03, 0], [0, 0, 0.6 - t * 0.9]);
      }
    });
  });
  // Schuetze kniend an den Griffen (Figurmass: Einheitenkoordinaten / FIG) / gunner kneeling at the grips (figure size: unit coordinates / FIG)
  const gripY = ((gy - 0.005) * K) / FIG, gripZ = 0.115;
  b.group({ p: [0, 0, GZ - 0.075 * K - gripZ * FIG], s: FIG }, () =>
    figure(b, A, f, { ...kneelPose([[-0.03 * K / FIG, gripY, gripZ], [0.03 * K / FIG, gripY, gripZ]]), head: [0.2, 0, 0] }, { detail: hi ? 1 : 0, seed: 41 }),
  );
  // Ladeschuetze seitlich mit Gurtkasten / loader at the side with a belt box
  b.group({ p: [-0.26, 0, -0.13], r: [0, 1.1, 0], s: FIG }, () => {
    figure(b, A, f, kneelPose([[-0.035, 0.22, 0.15], [0.045, 0.21, 0.15]]), { detail: 0, pack: hi ? 'pack' : 'none', seed: 43 });
    caseBox(b, A, [0.08, 0.06, 0.05], L.gear, { p: [0, 0.03, 0.2] });
  });
  return b;
}

/** Sanitaeter: hohe Kraxe, Armbinde, Koffer, Trage / medic: tall frame pack, armband, case, stretcher */
export function medic(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const HR: V3 = [0.135, 0.245, 0.03];
  b.group({ p: [-0.07, 0, 0.01], s: FIG }, () => {
    figure(b, A, f, { ...standPose([[-0.12, 0.27, 0.07], HR]), twist: [0, -0.1, 0] }, { pack: 'medbag', armband: true, seed: 51 });
    // weisser Koffer in der Hand mit Band in Fraktionsfarbe, Umhaengetasche / white case in hand with a band in the faction colour, shoulder satchel
    caseBox(b, A, [0.036, 0.074, 0.094], mat.white, { p: [HR[0] + 0.004, HR[1] - 0.085, 0.03] });
    box(b, A, [0.039, 0.016, 0.097], 0.004, {}, L.primary, { xf: { p: [HR[0] + 0.004, HR[1] - 0.085, 0.03] } });
    box(b, A, [0.012, 0.014, 0.04], 0.003, {}, f === 'velkar' ? TECH.glow : L.secondary, { xf: { p: [HR[0] + 0.004, HR[1] - 0.043, 0.03] } });
    if (hi) emblemDecal(b, A, f, [HR[0] + 0.0245, HR[1] - 0.1, 0.03], [1, 0, 0], 0.028, mat.white);
    box(b, A, [0.04, 0.07, 0.085], 0.01, { nx: 'pouch' }, mat.white, { xf: { p: [-0.108, 0.3, 0] } });
    box(b, A, [0.043, 0.02, 0.088], 0.005, {}, L.primary, { xf: { p: [-0.108, 0.318, 0] } });
    if (f === 'velkar') b.legacy((k) => {
      // Kryo-Kanister ragt statt der Kraxe ueber den Helm / the cryo canister rises above the helmet instead of the frame pack
      k.cyl(0.05, 0.05, 0.2, 12, TECH.shell, [0, PELVIS_Y + 0.29, -0.125]);
      k.add(geo.cyl(0.052, 0.052, 0.08, 12, true), TECH.glow, { p: [0, PELVIS_Y + 0.29, -0.125] });
      for (const y of [0.19, 0.39]) k.cyl(0.036, 0.042, 0.022, 10, TECH.gear, [0, PELVIS_Y + y, -0.125]);
      techDot(k, [0.06, PELVIS_Y + 0.4, -0.08], 0.009);
    });
  });
  // Krankentrage neben dem Sanitaeter: Holme, Segeltuch mit Naht, Decke / stretcher next to the medic: poles, canvas with stitching, blanket
  b.group({ p: [0.17, 0, -0.02], r: [0, -0.35, 0] }, () => {
    const canvas = mix(mat.white, mat.sand, 0.35);
    for (const sx of [-1, 1]) {
      rod(b, A, [sx * 0.06, 0.04, -0.22], [sx * 0.06, 0.04, 0.22], 0.009, 0.009, hi ? 8 : 5, mat.wood);
      for (const z of [-0.15, 0.15]) box(b, A, [0.012, 0.03, 0.012], 0.002, {}, mat.dark, { xf: { p: [sx * 0.06, 0.018, z] } });
    }
    b.group({ p: [0, 0.042, 0], r: [-HALF_PI, 0, 0] }, () => box(b, A, [0.12, 0.34, 0.012], 0.004, { pz: 'cloth' }, canvas));
    if (hi) {
      box(b, A, [0.1, 0.02, 0.12], 0.008, { py: 'pouch' }, shade(L.gear, 1.2), { xf: { p: [0, 0.058, -0.08] } });
      for (const z of [-0.03, 0.08]) box(b, A, [0.126, 0.008, 0.016], 0.003, {}, L.gear, { xf: { p: [0, 0.05, z] } });
      caseBox(b, A, [0.07, 0.03, 0.05], mat.white, { p: [0, 0.064, 0.11] });
    }
  });
  return b;
}

/** Massstab des Spions: kleiner als der Schuetze / scale of the spy: smaller than the rifleman */
export const SPY_SCALE = 0.73;
/** Spion: Mantel, Hut, Schal, Aktentasche, Zeitung / spy: coat, hat, scarf, briefcase, newspaper */
export function spy(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const HR: V3 = [0.135, 0.25, -0.01];
  b.group({ s: SPY_SCALE }, () => {
    figure(b, A, f, {
      ...standPose([[-0.118, 0.3, 0.045], HR]), head: [0.1, 0.25, 0],
      footL: [-0.048, ANKLE_Y, 0.025], footR: [0.05, ANKLE_Y, -0.02],
    }, { coat: true, hat: 'fedora', seed: 61 });
    // Schal in Zweitfarbe, Aktentasche, Zeitung unter dem Arm / scarf in the secondary colour, briefcase, newspaper under the arm
    b.add(loft([{ y: 0.012, rx: 0.036, rz: 0.035 }, { y: 0, rx: 0.049, rz: 0.042 }, { y: -0.012, rx: 0.047, rz: 0.041 }], { seg: hi ? 14 : 8, region: A.get('blank'), color: L.secondary }), null, { xf: { p: [0, PELVIS_Y + 0.178, 0.004] }, crease: 0.6 });
    box(b, A, [0.03, 0.07, 0.012], 0.004, {}, L.secondary, { xf: { p: [0.03, PELVIS_Y + 0.135, 0.056], r: [0.1, 0, 0.1] } });
    caseBox(b, A, [0.03, 0.075, 0.1], mat.dark, { p: [HR[0] + 0.004, HR[1] - 0.09, -0.01] });
    for (const z of [-0.036, 0.016]) box(b, A, [0.034, 0.012, 0.012], 0.003, {}, mat.gold, { xf: { p: [HR[0] + 0.004, HR[1] - 0.064, z] }, gloss: 0.7 });
    if (hi) {
      box(b, A, [0.012, 0.05, 0.07], 0.004, {}, mat.paper, { xf: { p: [-0.118, 0.36, 0], r: [0, 0, 0.15] } });
      box(b, A, [0.013, 0.008, 0.06], 0.002, {}, mat.ink, { xf: { p: [-0.118, 0.37, 0], r: [0, 0, 0.15] }, crease: 0 });
    }
    if (f === 'velkar') {
      // Datensammler: Handscanner mit Leuchtfeld / data collector: hand scanner with a glowing panel
      caseBox(b, A, [0.05, 0.03, 0.07], TECH.shell, { p: [-0.118, 0.31, 0.075] });
      box(b, A, [0.03, 0.006, 0.04], 0.002, {}, TECH.glow, { xf: { p: [-0.118, 0.327, 0.075] }, gloss: 1, crease: 0 });
      bead(b, A, [-0.14, 0.4, 0.03], 0.007, TECH.glow, 5, { gloss: 1 });
    }
  });
  return b;
}
