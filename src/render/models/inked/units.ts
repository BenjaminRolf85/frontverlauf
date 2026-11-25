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
import { addEmblem } from '../emblems';
import { fine, geo, mix, rng, shade, type Builder, type V3 } from '../kit';
import { look, mat } from '../look';
import { TECH, techDot } from '../velkarTech';
import { ANKLE_Y, FIG, figure, kneelPose, PELVIS_Y, rifle, standPose } from './figure';
import { AtlasLayout, UvBuilder } from './uvkit';

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
    // Tarnueberwurf: Buckel aus Laubbuescheln auf Ruecken und Beinen / ghillie: a hump of leaf tufts on back and legs
    b.group({ p: pelvis, r: body }, () => b.legacy((k) => {
      const R = rng(77);
      const tones = [mat.leafDark, shade(mat.leaf, 0.78), mix(mat.leafDark, L.primary, 0.3), shade(mat.leafDark, 0.82)];
      const n = hi ? 34 : 12;
      for (let i = 0; i < n; i++) {
        const y = -0.24 + R() * 0.4;
        const hump = Math.max(0, 1 - Math.abs(y - 0.06) / 0.2);
        const x = (R() - 0.5) * (y < 0 ? 0.15 : 0.19);
        const s = 0.03 + R() * 0.024 + hump * 0.012;
        k.add(geo.ico(s, 0), tones[i % tones.length], { p: [x, y, -0.05 - hump * (0.02 + R() * 0.04)], r: [R() * 3, R() * 3, R() * 3], s: [1, 1, 0.7] });
      }
      if (hi) for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        k.add(geo.cone(0.02, 0.09, 4), tones[i % 4], { p: [Math.cos(a) * 0.085, 0.22 + Math.sin(a) * 0.03, -0.045 + Math.sin(a) * 0.04], r: [-0.6 + (R() - 0.5) * 0.6, 0, Math.cos(a) * 1.2] });
      }
    }));
  });
  return b;
}

/** Sandsack oder Fertigteilblock der Velkar / sandbag or Velkar prefab block */
function sandbag(k: Builder, x: number, y: number, z: number, ry: number, tech: boolean) {
  k.add(geo.ctaper(0.118, 0.072, 0.1, 0.056, 0.046, 0.016), tech ? TECH.shell : mat.sandbag, { p: [x, y + 0.023, z], r: [0, ry, 0] });
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
  b.legacy((k) => {
    sandbag(k, -0.13, 0, 0.21, 0.35, tk);
    sandbag(k, -0.01, 0, 0.24, 0.05, tk);
    sandbag(k, 0.11, 0, 0.22, -0.3, tk);
    sandbag(k, 0.05, 0.046, 0.23, -0.12, tk);
    if (hi) { sandbag(k, -0.07, 0.046, 0.225, 0.2, tk); sandbag(k, -0.01, 0.092, 0.23, 0.05, tk); sandbag(k, 0.23, 0, 0.1, -1.0, tk); }
    if (tk) k.box(0.07, 0.008, 0.006, TECH.glow, [-0.01, 0.07, 0.262], [0, 0.05, 0]);
  });
  return b;
}

/** MG-Trupp: schweres MG auf Dreibein mit Schild, kniender Schuetze, Ladeschuetze / MG team: heavy MG on a tripod with shield, kneeling gunner, loader */
export function mgTeam(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const gy = 0.155, K = 1.3, GZ = 0.04;
  b.group({ p: [0, 0, GZ], s: K }, () => b.legacy((k) => {
    for (const [x, z] of [[0.09, 0.09], [-0.09, 0.09], [0, -0.12]] as [number, number][]) k.tube([0, gy - 0.025, 0], [x, 0.004, z], 0.007, 6, mat.dark);
    k.cyl(0.016, 0.02, 0.03, 8, mat.dark, [0, gy - 0.03, 0]);
    k.add(geo.cbox(0.05, 0.052, 0.14, 0.01), mat.dark, { p: [0, gy, 0] });
    k.box(0.044, 0.014, 0.1, mat.metal, [0, gy + 0.032, 0]);
    if (f === 'velkar') {
      // gekuehlter Laufmantel mit Leuchtringen / cooled barrel shroud with glowing rings
      k.add(geo.cyl(0.03, 0.03, 0.19, 10), TECH.shell, { p: [0, gy + 0.004, 0.16], r: [HALF_PI, 0, 0] });
      for (const z of hi ? [0.1, 0.145, 0.19, 0.235] : [0.16]) k.add(geo.cyl(0.033, 0.033, 0.01, 10, true), TECH.glow, { p: [0, gy + 0.004, z], r: [HALF_PI, 0, 0] });
    } else {
      k.cyl(0.021, 0.021, 0.18, 12, mat.metal, [0, gy + 0.004, 0.16], [HALF_PI, 0, 0]);
      if (hi) for (const z of [0.11, 0.16, 0.21]) k.add(geo.cyl(0.025, 0.025, 0.008, 12, true), mat.dark, { p: [0, gy + 0.004, z], r: [HALF_PI, 0, 0] });
    }
    k.cyl(0.009, 0.009, 0.06, 8, mat.ink, [0, gy + 0.004, 0.28], [HALF_PI, 0, 0]);
    k.cyl(0.016, 0.013, 0.03, 8, mat.dark, [0, gy + 0.004, 0.3], [HALF_PI, 0, 0]);
    for (const s of [-1, 1]) k.box(0.012, 0.035, 0.012, mat.wood, [s * 0.03, gy - 0.005, -0.075], [0.3, 0, 0]);
    // Kennform: breiter Schutzschild mit Fluegeln in Stahlgrau, Emblem / signature: wide gun shield with wings in steel grey, emblem
    const steel = mix(mat.metal, L.primary, 0.22);
    k.add(geo.rtaper(0.2, 0.014, 0.18, 0.014, 0.17, 0.006), steel, { p: [0, gy + 0.05, 0.075], r: [-0.12, 0, 0] });
    if (hi) for (const s of [-1, 1]) k.add(geo.rtaper(0.07, 0.012, 0.06, 0.012, 0.15, 0.005), shade(steel, 0.82), { p: [s * 0.124, gy + 0.045, 0.06], r: [-0.12, s * 0.5, 0] });
    k.box(0.2, 0.016, 0.018, L.secondary, [0, gy + 0.137, 0.09], [-0.12, 0, 0]);
    k.box(0.04, 0.012, 0.022, mat.ink, [-0.04, gy + 0.105, 0.085], [-0.12, 0, 0]);
    addEmblem(k, f, 0.026, 0.006, L.primary, { p: [0.045, gy + 0.05, 0.085], r: [-0.12, 0, 0] });
    // Munitionskasten und Gurt / ammo box and belt
    k.add(geo.cbox(0.07, 0.055, 0.045, 0.01), L.gear, { p: [0.085, 0.028, 0] });
    const n = hi ? 14 : 4;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      k.box(0.012, 0.026, 0.009, mat.gold, [0.075 - t * 0.05, 0.06 + Math.sin(t * Math.PI) * 0.06 + t * 0.03, 0], [0, 0, 0.6 - t * 0.9]);
    }
  }));
  // Schuetze kniend an den Griffen (Figurmass: Einheitenkoordinaten / FIG) / gunner kneeling at the grips (figure size: unit coordinates / FIG)
  const gripY = ((gy - 0.005) * K) / FIG, gripZ = 0.115;
  b.group({ p: [0, 0, GZ - 0.075 * K - gripZ * FIG], s: FIG }, () =>
    figure(b, A, f, { ...kneelPose([[-0.03 * K / FIG, gripY, gripZ], [0.03 * K / FIG, gripY, gripZ]]), head: [0.2, 0, 0] }, { detail: hi ? 1 : 0, seed: 41 }),
  );
  // Ladeschuetze seitlich mit Gurtkasten / loader at the side with a belt box
  b.group({ p: [-0.26, 0, -0.13], r: [0, 1.1, 0], s: FIG }, () => {
    figure(b, A, f, kneelPose([[-0.035, 0.22, 0.15], [0.045, 0.21, 0.15]]), { detail: 0, pack: hi ? 'pack' : 'none', seed: 43 });
    b.legacy((k) => k.add(geo.cbox(0.08, 0.06, 0.05, 0.01), L.gear, { p: [0, 0.03, 0.2] }));
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
    b.legacy((k) => {
      // weisser Koffer in der Hand, Umhaengetasche / white case in hand, shoulder satchel
      k.add(geo.rbox(0.034, 0.07, 0.09, 0.01), mat.white, { p: [HR[0] + 0.004, HR[1] - 0.085, 0.03] });
      k.add(geo.rbox(0.036, 0.016, 0.092, 0.004), L.primary, { p: [HR[0] + 0.004, HR[1] - 0.085, 0.03] });
      k.add(geo.rbox(0.012, 0.014, 0.04, 0.003), f === 'velkar' ? TECH.glow : L.secondary, { p: [HR[0] + 0.004, HR[1] - 0.045, 0.03] });
      if (hi) addEmblem(k, f, 0.018, 0.004, L.primary, { p: [HR[0] + 0.022, HR[1] - 0.085, 0.03], r: [0, HALF_PI, 0] });
      k.add(geo.rbox(0.04, 0.07, 0.085, 0.01), mat.white, { p: [-0.108, 0.3, 0] });
      k.add(geo.rbox(0.042, 0.02, 0.087, 0.005), L.primary, { p: [-0.108, 0.315, 0] });
      if (f === 'velkar') {
        // Kryo-Kanister ragt statt der Kraxe ueber den Helm / the cryo canister rises above the helmet instead of the frame pack
        k.cyl(0.05, 0.05, 0.2, 12, TECH.shell, [0, PELVIS_Y + 0.29, -0.125]);
        k.add(geo.cyl(0.052, 0.052, 0.08, 12, true), TECH.glow, { p: [0, PELVIS_Y + 0.29, -0.125] });
        for (const y of [0.19, 0.39]) k.cyl(0.036, 0.042, 0.022, 10, TECH.gear, [0, PELVIS_Y + y, -0.125]);
        techDot(k, [0.06, PELVIS_Y + 0.4, -0.08], 0.009);
      }
    });
  });
  // Krankentrage neben dem Sanitaeter / stretcher on the ground next to the medic
  b.group({ p: [0.17, 0, -0.02], r: [0, -0.35, 0] }, () => b.legacy((k) => {
    const canvas = mix(mat.white, mat.sand, 0.35);
    for (const sx of [-1, 1]) {
      k.cyl(0.009, 0.009, 0.44, 8, mat.wood, [sx * 0.06, 0.04, 0], [HALF_PI, 0, 0]);
      for (const z of [-0.15, 0.15]) k.box(0.012, 0.03, 0.012, mat.dark, [sx * 0.06, 0.018, z]);
    }
    k.add(geo.rbox(0.12, 0.012, 0.34, 0.004), canvas, { p: [0, 0.042, 0] });
    if (hi) {
      k.add(geo.rbox(0.1, 0.02, 0.12, 0.008), shade(L.gear, 1.2), { p: [0, 0.058, -0.08] });
      for (const z of [-0.03, 0.08]) k.box(0.126, 0.008, 0.016, L.gear, [0, 0.05, z]);
      k.add(geo.rbox(0.07, 0.03, 0.05, 0.01), mat.white, { p: [0, 0.064, 0.11] });
    }
  }));
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
    b.legacy((k) => {
      // Schal in Zweitfarbe, Aktentasche, Zeitung unter dem Arm / scarf in the secondary colour, briefcase, newspaper under the arm
      k.add(geo.rbox(0.098, 0.022, 0.082, 0.008), L.secondary, { p: [0, PELVIS_Y + 0.178, 0.004] });
      k.add(geo.rbox(0.03, 0.07, 0.012, 0.004), L.secondary, { p: [0.03, PELVIS_Y + 0.135, 0.056], r: [0.1, 0, 0.1] });
      k.add(geo.rbox(0.03, 0.075, 0.1, 0.008), mat.dark, { p: [HR[0] + 0.004, HR[1] - 0.09, -0.01] });
      k.add(geo.rbox(0.032, 0.012, 0.102, 0.003), shade(mat.dark, 1.4), { p: [HR[0] + 0.004, HR[1] - 0.068, -0.01] });
      for (const z of [-0.036, 0.016]) k.box(0.034, 0.012, 0.012, mat.gold, [HR[0] + 0.004, HR[1] - 0.064, z]);
      if (hi) {
        k.add(geo.rbox(0.012, 0.05, 0.07, 0.004), mat.paper, { p: [-0.118, 0.36, 0], r: [0, 0, 0.15] });
        k.box(0.013, 0.008, 0.06, mat.ink, [-0.118, 0.37, 0], [0, 0, 0.15]);
      }
      if (f === 'velkar') {
        // Datensammler: Handscanner mit Antenne / data collector: hand scanner with antenna
        k.add(geo.cbox(0.05, 0.03, 0.07, 0.006), TECH.shell, { p: [-0.118, 0.31, 0.075] });
        k.box(0.03, 0.006, 0.04, TECH.glow, [-0.118, 0.327, 0.075]);
        techDot(k, [-0.14, 0.4, 0.03], 0.007);
      }
    });
  });
  return b;
}
