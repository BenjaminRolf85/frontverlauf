/**
 * Gezeichnete Einheiten: Baukasten, Atlanten und Einbindung (laeuft in Node, ohne DOM und ohne GPU).
 * Inked units: kit, atlases and integration (runs in Node, without DOM and without a GPU).
 */
import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FACTION_IDS, type FactionId, type UnitTypeId } from '../src/data/balance';
import { getUnitQuality, INKED, inkedType, legacyUnitGeometry, setInkedUnits, setUnitQuality, splitTurrets, unitGeometry } from '../src/render/models';
import { ATLAS_SIZE, atlasBudget, atlasDef, atlasIds, atlasTextures, distanceField, MAX_ATLASES } from '../src/render/models/inked/atlas';
import { defineAtlases, INKED_MAX_EXT, INKED_MAX_H } from '../src/render/models/inked';
import { inkFor, inkGeometry } from '../src/render/models/inked/ink';
import { AtlasLayout, loft, REF, subdivide, UvBuilder } from '../src/render/models/inked/uvkit';
import { semantic } from '../src/design/tokens';
import { unitMaterial } from '../src/render/toon';
import { isInked, unitMaterialFor, unitMaterialLike, unitOutlined } from '../src/render/unitDraw';

const types = Object.keys(INKED) as UnitTypeId[];
const factionsOf = (t: UnitTypeId): FactionId[] => INKED[t]!.factions ?? FACTION_IDS;

describe('Gezeichnete Einheiten: Atlanten / inked units: atlases', () => {
  it('alle Atlanten passen, Zellen liegen im Atlas und ueberlappen nicht / all atlases fit, cells lie inside the atlas and do not overlap', () => {
    defineAtlases();
    expect(atlasIds().length).toBeGreaterThanOrEqual(2);
    expect(atlasIds().length).toBeLessThanOrEqual(MAX_ATLASES);
    for (const id of atlasIds()) {
      const def = atlasDef(id);
      const rs = def.cells.map((c) => def.layout.get(c.name));
      expect(def.layout.get('blank')).toBeTruthy();
      for (const r of rs) expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= REF && r.y + r.h <= REF, `${id} ${r.name}`).toBe(true);
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j];
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        if (!apart) throw new Error(`${id}: ${a.name} overlaps ${b.name}`);
      }
    }
  });

  it('jede Fraktion hat ihre Emblemzelle in beiden Atlanten / every faction has its emblem cell in both atlases', () => {
    defineAtlases();
    for (const id of ['figure', 'vehicle']) for (const f of FACTION_IDS) expect(atlasDef(id).layout.get(`emblem:${f}`)).toBeTruthy();
  });

  it('Texturspeicher ist begrenzt / texture memory is bounded', () => {
    // je Atlas RGBA + 8 Bit Tusche samt Mip-Stufen / per atlas RGBA + 8 bit ink including mip levels
    expect(atlasBudget('high')).toBe(Math.round((MAX_ATLASES * 1024 * 1024 * 5 * 4) / 3));
    expect(atlasBudget('low')).toBeLessThan(22 * 1024 * 1024);
    expect(ATLAS_SIZE.low).toBe(512);
  });

  it('ohne DOM bleiben die Texturen neutral und nichts wirft / without a DOM the textures stay neutral and nothing throws', () => {
    defineAtlases();
    const t = atlasTextures('figure', ATLAS_SIZE.low);
    expect(t.ready).toBe(false);
    expect((t.paint.image.data as Uint8Array)[0]).toBe(128);
    expect((t.ink.image.data as Uint8Array)[0]).toBe(0);
    expect(atlasTextures('figure', ATLAS_SIZE.low)).toBe(t);
  });

  it('Abstandsfeld: innen ueber, aussen unter der Kante / distance field: above the edge inside, below it outside', () => {
    const n = 24, rgba = new Uint8ClampedArray(n * n * 4);
    for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) rgba[(y * n + x) * 4 + 3] = 255;
    const d = distanceField(rgba, n, n, 5);
    expect(d[12 * n + 12]).toBeGreaterThan(160);
    expect(d[12 * n + 2]).toBeLessThan(100);
    expect(d[12 * n + 8]).toBeGreaterThan(d[12 * n + 7]);
    expect(distanceField(new Uint8ClampedArray(n * n * 4), n, n, 5).every((v) => v === 0)).toBe(true);
  });
});

describe('Gezeichnete Einheiten: Baukasten / inked units: kit', () => {
  const A = new AtlasLayout();
  const cell = A.alloc('blank', 16, 16), skin = A.alloc('skin', 128, 64);

  it('Loft: gueltige Normalen auch an Deckeln ueber harten Ringpaaren / loft: valid normals even on caps above hard ring pairs', () => {
    const g = loft([{ y: 0.05, rx: 0.011, hard: true }, { y: 0.05, rx: 0.0135, hard: true }, { y: 0, rx: 0.015 }], { seg: 8, region: skin, capFirst: cell, capLast: true });
    const n = g.getAttribute('normal');
    for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeGreaterThan(0.98);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) expect(uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= 0 && uv.getY(i) <= 1).toBe(true);
  });

  it('Bruecke: alte Teile kommen mit Farbe, neutraler Zelle und Tuschegewicht an / bridge: old parts arrive with colour, neutral cell and ink weight', () => {
    const b = new UvBuilder(cell);
    b.legacy((k) => k.box(0.1, 0.1, 0.1, semantic.white, [0, 0.05, 0]), { map: (v) => { v.y *= 2; } });
    const g = b.build();
    expect(g.getAttribute('position').count).toBeGreaterThan(0);
    for (const a of ['normal', 'uv', 'color', 'fx']) expect(g.getAttribute(a).count).toBe(g.getAttribute('position').count);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.y).toBeCloseTo(0.2, 3);
    expect(g.getAttribute('uv').getX(0)).toBeCloseTo((cell.x + cell.w / 2) / REF, 5);
    expect(g.getAttribute('fx').getY(0)).toBe(1);
  });

  it('Unterteilung ohne T-Stoesse: keine neuen Knickkanten / subdivision without T-junctions: no new crease edges', () => {
    const b = new UvBuilder(cell);
    b.legacy((k) => k.add(new THREE.BoxGeometry(0.4, 0.1, 0.3), semantic.white));
    const g = b.build();
    const fine = subdivide(g, 0.06);
    expect(fine.getAttribute('position').count).toBeGreaterThan(g.getAttribute('position').count * 4);
    // nur die zwoelf Kanten des Quaders, jetzt in Stuecken: 4 x (8 + 8 + 2) / only the box's twelve edges, now in pieces: 4 x (8 + 8 + 2)
    expect(inkGeometry(g).userData.creases).toBe(12);
    expect(inkGeometry(fine).userData.creases).toBe(4 * (8 + 8 + 2));
    expect(inkGeometry(g, { creases: false }).userData.creases).toBe(0);
  });
});

describe('Gezeichnete Einheiten im Spiel / inked units in the game', () => {
  const start = getUnitQuality();
  afterAll(() => { setUnitQuality(start); setInkedUnits(true); });

  it('umgebaute Typen: Fusstruppen, Panzer und Gelaendewagen fuer alle Fraktionen / converted types: foot troops, tanks and field cars for all factions', () => {
    for (const t of ['infantry', 'sniper', 'pioneer', 'mg', 'medic', 'spy'] as UnitTypeId[]) for (const f of FACTION_IDS) expect(inkedType(t, f), `${t} ${f}`).not.toBeNull();
    expect(inkedType('tank', 'korvat')).not.toBeNull();
    for (const t of ['tank', 'jeep', 'artillery', 'heli', 'antiAir', 'mineLayer', 'radarTruck', 'teslaTank', 'octocopter', 'steppeColossus'] as UnitTypeId[]) for (const f of FACTION_IDS) expect(inkedType(t, f), `${t} ${f}`).not.toBeNull();
  });

  for (const q of ['high', 'low'] as const) {
    it(`Geometrie vollstaendig, im Atlas, auf dem Feld (${q}) / geometry complete, inside the atlas, on the tile (${q})`, { timeout: 120_000 }, () => {
      setUnitQuality(q);
      for (const t of types) for (const f of factionsOf(t)) {
        const g = unitGeometry(t, f, null);
        const name = `${t} ${f} ${q}`;
        expect(isInked(g), name).toBe(true);
        expect(g.index).toBeNull();
        const n = g.getAttribute('position').count;
        for (const [a, size] of [['normal', 3], ['uv', 2], ['color', 3], ['fx', 2]] as const) {
          expect(g.getAttribute(a), `${name} ${a}`).toBeTruthy();
          expect(g.getAttribute(a).itemSize).toBe(size);
          expect(g.getAttribute(a).count).toBe(n);
        }
        const uv = g.getAttribute('uv').array as Float32Array, fx = g.getAttribute('fx').array as Float32Array, nor = g.getAttribute('normal');
        for (const v of uv) if (!(v >= 0 && v <= 1)) throw new Error(`${name}: uv ${v}`);
        for (let i = 0; i < n; i++) {
          // fx.y = Verdeckung 0..1 / fx.y = occlusion 0..1
          if (!(fx[i * 2 + 1] >= 0 && fx[i * 2 + 1] <= 1)) throw new Error(`${name}: ao ${fx[i * 2 + 1]}`);
          const l = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
          if (!(l > 0.97 && l < 1.03)) throw new Error(`${name}: normal ${i} has length ${l}`);
        }
        g.computeBoundingBox();
        const bb = g.boundingBox!;
        expect(bb.max.y, name).toBeLessThanOrEqual(INKED_MAX_H + 0.005);
        expect(Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z), name).toBeLessThanOrEqual(INKED_MAX_EXT + 0.01);
        // Werkzeug darf leicht im Boden stecken (bisher bis -0.08) / tools may stick slightly in the ground (up to -0.08 before)
        expect(bb.min.y, name).toBeGreaterThan(-0.03);
        // Tusche: Umriss immer, Innenlinien nur bei hoher Qualitaet / ink: silhouette always, inner lines on high quality only
        const ink = inkFor(g);
        expect(ink.index!.count).toBeGreaterThan(0);
        if (q === 'low') expect(ink.userData.creases, name).toBe(0); else expect(ink.userData.creases, name).toBeGreaterThan(100);
        expect(unitGeometry(t, f, null)).toBe(g);
      }
    });
  }

  it('deterministisch und vom bisherigen Modell getrennt / deterministic and separate from the previous model', () => {
    setUnitQuality('low');
    const a = unitGeometry('infantry', 'meridon', null);
    const old = legacyUnitGeometry('infantry', 'meridon', null);
    expect(isInked(old)).toBe(false);
    expect(old).not.toBe(a);
    expect(unitGeometry('infantry', 'meridon', null)).toBe(a);
    setInkedUnits(false);
    expect(unitGeometry('infantry', 'meridon', null)).toBe(old);
    setInkedUnits(true);
    const pos = Array.from((a.userData.inkSrc as THREE.BufferGeometry).getAttribute('position').array as Float32Array).slice(0, 600);
    const again = INKED.infantry!.build('meridon', atlasDef('figure').layout).build();
    const s = a.userData.finishScale as number;
    expect(Array.from(again.getAttribute('position').array as Float32Array).slice(0, 600).map((v) => v * s)).toEqual(pos);
  });

  it('Leuchteinheiten (Velkar, Alvenia) tragen die Leuchtmaske / glow units (Velkar, Alvenia) carry the glow mask', () => {
    setUnitQuality('low');
    for (const f of ['velkar', 'alvenia'] as FactionId[]) {
      const g = unitGeometry('infantry', f, null);
      expect(g.userData.unitGlow, f).toBe(true);
      const glow = g.getAttribute('glow');
      expect(glow.count).toBe(g.getAttribute('position').count);
      expect(Array.from(glow.array as Float32Array).some((v) => v > 0), f).toBe(true);
      expect(unitMaterialFor(g).userData.unitGlow).toBe(true);
    }
    expect(unitGeometry('infantry', 'korvat', null).userData.unitGlow).toBeFalsy();
  });

  it('ein Weg fuer Material und Tuschelinie beider Arten / one path for material and ink line of both kinds', () => {
    setUnitQuality('high');
    const g = unitGeometry('tank', 'korvat', null), old = legacyUnitGeometry('tank', 'dravon', null);
    const m = unitMaterialFor(g), dim = unitMaterialLike(m, { dim: true, transparent: true, opacity: 0.5 })!;
    expect(m.userData.unitMat).toBe(true);
    expect(m.userData.inked.atlas).toBe('vehicle');
    expect(dim).not.toBe(m);
    expect(dim.userData.inked.atlas).toBe('vehicle');
    expect(dim.transparent).toBe(true);
    expect(unitMaterialLike(dim, {})).toBe(m);
    // bisherige Modelle behalten unitMaterial / previous models keep unitMaterial
    expect(unitMaterialFor(old)).toBe(unitMaterial());
    expect(unitMaterialLike(unitMaterial(), { dim: true })).toBe(unitMaterial({ dim: true }));
    expect(unitMaterialLike(new THREE.MeshBasicMaterial(), {})).toBeNull();
    // Gruppe wie outlined(): Flaeche + Linie, je Turmteil eigene Tusche / group like outlined(): fill + line, own ink per turret part
    const split = splitTurrets(g)!;
    const grp = unitOutlined(split.turrets[0].geometry, 0.018);
    expect(grp.children).toHaveLength(2);
    expect(grp.userData.mesh).toBe(grp.children[0]);
    expect((grp.children[1] as THREE.Mesh).geometry).toBe(inkFor(split.turrets[0].geometry));
    expect(unitOutlined(old, 0.018).children).toHaveLength(2);
  });
});
