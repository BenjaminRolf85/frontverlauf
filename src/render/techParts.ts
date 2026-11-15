/**
 * Bewegliche Teile der Velkar-Einheiten ("Labor im Feld"): Rotoren des Oktokopters, knisternde Lichtboegen des Tesla-Panzers,
 * schwebende Messdrohnen. Sie haengen als Kinder am 'model'-Objekt (folgen also Haltung und Gang) und werden pro Bild bewegt.
 * Ohne Animationen stehen sie still in einer festen Haltung (ein Lichtbogen sichtbar, Rotoren und Drohnen ruhen).
 * Niedrige Qualitaet: keine Drohnen, nur ein Lichtbogen, Rotoren ohne Kontur.
 * Moving parts of the Velkar units ("lab in the field"): octocopter rotors, crackling Tesla tank arcs, hovering survey drones.
 * They hang as children of the 'model' object (so they follow pose and gait) and move per frame.
 * Without animations they rest in a fixed pose (one arc visible, rotors and drones still).
 * Low quality: no drones, a single arc, rotors without an outline.
 */
import * as THREE from 'three';
import type { FactionId, UnitTypeId } from '../data/balance';
import { semantic } from '../design/tokens';
import { techParts, type TechPart } from './models';
import { OCTO_BLADE, rotorBlades, surveyDrone, teslaArc } from './models/velkarTech';
import { memo } from './models/kit';
import { unitGlowMaterial, withGlow } from './atmosphere';
import { outlined } from './toon';
import { OUTLINE } from './config';
import { glowColor } from './post';

const geoRotor = () => memo('tech|rotor', () => withGlow(rotorBlades(OCTO_BLADE).build(), 'nature'));
const geoDrone = () => memo('tech|drone', () => withGlow(surveyDrone().build(), 'nature'));
const geoArc = (v: number) => memo(`tech|arc|${v}`, () => teslaArc(v).build());

let arcMat: THREE.MeshBasicMaterial | null = null;
/**
 * Lichtbogen: tuerkis (hebt sich auch vor Schnee und Frostweiss ab), unbeleuchtet und ueber 1 fuer den Bloom, mit Tuschelinie.
 * Arc: teal (stands out against snow and frost white too), unlit and above 1 for the bloom, with an ink line.
 */
function arcMaterial(): THREE.MeshBasicMaterial {
  if (!arcMat) arcMat = new THREE.MeshBasicMaterial({ color: glowColor(semantic.velkarTechGlow, 1.5), toneMapped: false });
  return arcMat;
}

interface Live { obj: THREE.Object3D; part: TechPart; phase: number }

/** Verwaltung der beweglichen Teile aller Einheiten / manager of the moving parts of all units */
export class TechParts {
  private live = new Map<number, Live[]>();

  /** Teile an das Modell haengen (einmal je neuem Modell) / attach parts to the model (once per new model) */
  attach(id: number, model: THREE.Object3D, type: UnitTypeId, f: FactionId, finishScale: number, low: boolean): void {
    this.live.delete(id);
    const parts = techParts(type, f);
    if (!parts.length) return;
    const list: Live[] = [];
    const k = finishScale;
    for (const part of parts) {
      let obj: THREE.Object3D;
      if (part.kind === 'rotor') {
        obj = low ? new THREE.Mesh(geoRotor(), unitGlowMaterial()) : outlined(geoRotor(), OUTLINE.unit * 0.7, unitGlowMaterial());
      } else if (part.kind === 'drone') {
        if (low) continue;
        obj = outlined(geoDrone(), OUTLINE.unit * 0.8, unitGlowMaterial());
      } else {
        if (low && (part.variant ?? 0) > 0) continue;
        obj = outlined(geoArc(part.variant ?? 0), OUTLINE.unit * 0.5, arcMaterial());
        obj.visible = (part.variant ?? 0) === 0;
      }
      obj.name = 'techPart';
      obj.position.set(part.p[0] * k, part.p[1] * k, part.p[2] * k);
      obj.scale.setScalar(k);
      obj.traverse((o) => { o.raycast = () => {}; });
      model.add(obj);
      list.push({ obj, part, phase: (id * 0.618) % 1 * Math.PI * 2 });
    }
    this.live.set(id, list);
  }

  /** Einheit verschwunden / unit gone */
  detach(id: number): void { this.live.delete(id); }

  /** Pro Bild; true, wenn sich etwas bewegt hat / per frame; true if anything moved */
  update(now: number, animations: boolean): boolean {
    if (!this.live.size) return false;
    const t = now / 1000;
    for (const list of this.live.values()) {
      for (const l of list) {
        const o = l.obj, p = l.part;
        if (!animations) {
          // feste Ruhehaltung / fixed rest pose
          if (p.kind === 'rotor') o.rotation.y = l.phase;
          else if (p.kind === 'arc') o.visible = (p.variant ?? 0) === 0;
          continue;
        }
        if (p.kind === 'rotor') o.rotation.y = l.phase + t * 26 * (p.dir ?? 1);
        else if (p.kind === 'arc') {
          // knistern: je Zeitschritt eine andere Variante, gelegentlich dunkel / crackle: a different variant per time step, sometimes dark
          const step = Math.floor(t * 14 + l.phase * 3);
          const pick = (step * 7 + Math.floor(l.phase * 10)) % 4;
          o.visible = pick === (p.variant ?? 0);
        } else {
          // Messdrohne: kleiner Kreis mit Auf und Ab / survey drone: small circle with a bob
          const k = o.scale.x;
          o.position.set(p.p[0] * k + Math.sin(t * 0.9 + l.phase) * 0.05, p.p[1] * k + Math.sin(t * 2.1 + l.phase) * 0.02, p.p[2] * k + Math.cos(t * 0.9 + l.phase) * 0.05);
          o.rotation.y = t * 0.9 + l.phase;
        }
      }
    }
    return animations;
  }
}
