/**
 * Gezeichnete Anfuehrer: alle acht Heldenbuesten in allen Stimmungen und beiden Qualitaeten (laeuft in Node, ohne DOM
 * und ohne GPU; die Atlanten werden nur angelegt, nicht gemalt).
 * Inked leaders: all eight hero busts in every mood and both qualities (runs in Node, without DOM and without a GPU;
 * the atlases are only defined, not painted).
 */
import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FACTION_IDS } from '../src/data/balance';
import { getUnitQuality, leaderAtlasId, leaderGeometry, LEADER_MOODS, setUnitQuality } from '../src/render/models';
import { withDetail } from '../src/render/models/kit';
import { atlasBudget, atlasDef, atlasIds, atlasSize, ATLAS_SIZE, HERO_ATLAS_SIZE, heroAtlasIds, MAX_ATLASES } from '../src/render/models/inked/atlas';
import { defineAtlases } from '../src/render/models/inked';
import { buildLeader, hasInkedLeader } from '../src/render/models/inked/leaders';
import { REF } from '../src/render/models/inked/uvkit';

const quality0 = getUnitQuality();
afterAll(() => setUnitQuality(quality0));

/** Dreiecke einer Flaechengeometrie / triangles of a fill geometry */
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/** Buesten zu bauen dauert (32 je Qualitaet, auf einer belasteten Maschine mehrere Sekunden) / building busts takes time (32 per quality, several seconds on a busy machine) */
const SLOW = { timeout: 180_000 };

describe('Gezeichnete Anfuehrer / inked leaders', () => {
  it('alle acht Fraktionen haben eine gezeichnete Bueste / all eight factions have an inked bust', () => {
    for (const f of FACTION_IDS) expect(hasInkedLeader(f), f).toBe(true);
  });

  for (const q of ['high', 'low'] as const) {
    it(`alle Fraktionen und Stimmungen bauen, Vertrag von buildInked, Groesse und Budget (${q}) / every faction and mood builds, buildInked contract, size and budget (${q})`, SLOW, () => {
      setUnitQuality(q);
      for (const f of FACTION_IDS) for (const mood of LEADER_MOODS) {
        const g = leaderGeometry(f, mood), key = `${f} ${mood} ${q}`;
        // Vertrag: Attribute gleich lang, uv, fx, Farbe, Normalen, inked.atlas, inkSrc / contract: attributes of equal length, uv, fx, colour, normals, inked.atlas, inkSrc
        const n = g.attributes.position.count;
        for (const a of ['normal', 'uv', 'color', 'fx']) expect(g.getAttribute(a)?.count, `${key} ${a}`).toBe(n);
        expect(g.userData.inked?.atlas, key).toBe(leaderAtlasId(f, mood));
        const src = g.userData.inkSrc as THREE.BufferGeometry;
        expect(src?.attributes.position.count, `${key} inkSrc`).toBe(n);
        // Werte endlich, uv im Atlas und in einer Zelle des eigenen Atlas / values finite, uv inside the atlas and inside a cell of its own atlas
        const def = atlasDef(g.userData.inked.atlas);
        expect(def.hero, key).toBe(true);
        const rs = def.cells.map((c) => def.layout.get(c.name));
        const pos = g.attributes.position.array as Float32Array, uv = g.attributes.uv.array as Float32Array, fx = g.getAttribute('fx').array as Float32Array;
        for (const v of pos) if (!Number.isFinite(v)) throw new Error(`${key}: position not finite`);
        for (const v of fx) if (!Number.isFinite(v) || v < -1e-4 || v > 1.0001) throw new Error(`${key}: fx ${v}`);
        const eps = 1.5 / REF;
        for (let i = 0; i < uv.length; i += 2) {
          const s = uv[i], t = uv[i + 1];
          if (!(s >= 0 && s <= 1 && t >= 0 && t <= 1)) throw new Error(`${key}: uv ${s} ${t}`);
          const x = s * REF, y = t * REF;
          if (!rs.some((r) => x >= r.x - eps * REF && x <= r.x + r.w + eps * REF && y >= r.y - eps * REF && y <= r.y + r.h + eps * REF)) throw new Error(`${key}: uv ${s.toFixed(4)} ${t.toFixed(4)} outside every cell`);
        }
        // Groesse: Blick +z, Ursprung unten mittig, etwa 1.0 hoch und 0.9 breit / size: facing +z, origin bottom centre, about 1.0 tall and 0.9 wide
        g.computeBoundingBox();
        const b = g.boundingBox!;
        expect(b.min.y, `${key} bottom`).toBeGreaterThan(-0.03);
        expect(b.min.y, `${key} bottom`).toBeLessThan(0.03);
        expect(b.max.y, `${key} height`).toBeGreaterThan(0.95);
        expect(b.max.y, `${key} height`).toBeLessThan(1.15);
        expect(b.max.x - b.min.x, `${key} width`).toBeGreaterThan(0.85);
        expect(b.max.x - b.min.x, `${key} width`).toBeLessThan(1.06);
        expect(Math.abs(b.max.x + b.min.x), `${key} centred`).toBeLessThan(0.02);
        // Budget: hoch bis 40 000 Dreiecke, niedrig deutlich darunter / budget: high up to 40,000 triangles, low clearly below
        expect(tris(g), key).toBeLessThanOrEqual(q === 'high' ? 40000 : 12000);
        // Leuchtmaske: nur 0 oder 1, und wenn vorhanden, leuchtet etwas / glow mask: only 0 or 1, and if present, something glows
        const glow = g.getAttribute('glow');
        if (glow) {
          const arr = glow.array as Float32Array;
          let lit = 0;
          for (let i = 0; i < arr.length; i += 2) { if (arr[i] !== 0 && arr[i] !== 1) throw new Error(`${key}: glow ${arr[i]}`); lit += arr[i]; }
          expect(lit, `${key} glow`).toBeGreaterThan(0);
          expect(g.userData.unitGlow, key).toBe(true);
        }
      }
    });
  }

  it('hoch ist feiner als niedrig, mit eigenem Atlas je Anfuehrer und Stimmung / high is finer than low, with an own atlas per leader and mood', SLOW, () => {
    for (const f of FACTION_IDS) {
      setUnitQuality('high');
      const hi = leaderGeometry(f, 'neutral');
      setUnitQuality('low');
      const lo = leaderGeometry(f, 'neutral');
      expect(tris(hi), f).toBeGreaterThan(tris(lo) * 2);
      expect(hi.userData.inked.atlas).toBe(lo.userData.inked.atlas);
    }
    const ids = new Set(FACTION_IDS.flatMap((f) => LEADER_MOODS.map((m) => leaderAtlasId(f, m))));
    expect(ids.size).toBe(FACTION_IDS.length * LEADER_MOODS.length);
    for (const id of ids) {
      expect(atlasSize(id, 'high')).toBe(HERO_ATLAS_SIZE.high);
      expect(atlasSize(id, 'low')).toBe(HERO_ATLAS_SIZE.low);
      // jede Bueste hat ihre eigenen Zellen fuer Gesicht oder Kopf und Brust / every bust has its own cells for face or head and chest
      const names = atlasDef(id).cells.map((c) => c.name);
      expect(names.includes('face') || names.includes('head'), id).toBe(true);
      expect(names, id).toContain('chest');
    }
  });

  it('deterministisch: zweimal gebaut, dieselbe Geometrie / deterministic: built twice, the same geometry', SLOW, () => {
    for (const f of FACTION_IDS) {
      const a = withDetail(1.6, true, () => buildLeader(f, 'smug', false), { smooth: true, fine: false });
      const b = withDetail(1.6, true, () => buildLeader(f, 'smug', false), { smooth: true, fine: false });
      for (const name of ['position', 'uv', 'color', 'fx']) {
        const x = a.getAttribute(name).array, y = b.getAttribute(name).array;
        expect(x.length, `${f} ${name}`).toBe(y.length);
        for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) throw new Error(`${f} ${name}[${i}] differs`);
      }
    }
  });

  it('Heldenatlanten zaehlen nicht gegen die Grenze des Bretts, dessen Speicher bleibt gleich / hero atlases do not count against the board limit, its memory stays the same', () => {
    // alle Buesten sind oben schon gebaut: 32 Heldenatlanten / all busts are built above already: 32 hero atlases
    expect(heroAtlasIds().filter((id) => id.startsWith('leader-')).length).toBe(FACTION_IDS.length * LEADER_MOODS.length);
    defineAtlases();
    expect(atlasIds().some((id) => id.startsWith('leader-'))).toBe(false);
    expect(atlasIds().length).toBeLessThanOrEqual(MAX_ATLASES);
    expect(MAX_ATLASES).toBe(12);
    expect(ATLAS_SIZE).toEqual({ high: 1024, low: 512 });
    expect(atlasBudget('high')).toBe(Math.round((12 * 1024 * 1024 * 5 * 4) / 3));
    expect(atlasBudget('low')).toBe(Math.round((12 * 512 * 512 * 5 * 4) / 3));
  });
});
