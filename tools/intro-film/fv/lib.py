"""
Gemeinsame Bausteine des Introfilms in Blender: Szene, Comic-Material (Stufen-Schattierung, Leuchten), Tuschekontur
(Inverted Hull), Spielmodelle aus dem Export, gezeichnete Einheiten (Atlas-Material, Tusche aus dem Abstandsfeld,
Umriss und Innenlinien als Geometrie), Himmel, Effekte und Kamerahilfen.
Shared building blocks of the intro film in Blender: scene, comic material (banded shading, glow), ink outline
(inverted hull), game models from the export, inked units (atlas material, ink from the distance field, silhouette and
inner lines as geometry), sky, effects and camera helpers.

Alle Farben kommen aus src/design/tokens.ts (ueber .cache/tokens.json, siehe export-models.mjs).
All colours come from src/design/tokens.ts (via .cache/tokens.json, see export-models.mjs).

Massstab: 1 Brettfeld des Spiels = 10 Blender-Einheiten (Meter), z zeigt nach oben.
Scale: 1 game board tile = 10 Blender units (metres), z points up.
"""
import base64
import json
import math
import os
import random

import bpy
import numpy as np
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(HERE))
BASE_CACHE = os.path.join(HERE, '.cache')
# Qualitaetsstufe aus quality.json: 'preview' (Standard: schnell, 12 fps, 1280x720, wie bisher) oder 'film' (24 fps,
# 1920x1080, mehr Bildproben, feine Schatten, Modelle aus dem Filmexport in .cache/film). Einzelne Werte lassen sich
# weiter ueber FV_SAMPLES, FV_SHADOW, FV_SHADOW_MAX, FV_SHADOW_STEPS, FV_MBLUR, FV_SCALE, FV_FPS ueberschreiben.
# quality level from quality.json: 'preview' (default: fast, 12 fps, 1280x720, as before) or 'film' (24 fps, 1920x1080,
# more samples, fine shadows, models from the film export in .cache/film). Single values can still be overridden with
# FV_SAMPLES, FV_SHADOW, FV_SHADOW_MAX, FV_SHADOW_STEPS, FV_MBLUR, FV_SCALE, FV_FPS.
QUALITY = os.environ.get('FV_QUALITY', 'preview')
with open(os.path.join(HERE, 'quality.json')) as _fh:
    PROFILE = json.load(_fh)[QUALITY]
# FV_CACHE: anderer Cache (Vergleiche) / other cache (comparisons)
CACHE = os.environ.get('FV_CACHE') or os.path.join(HERE, PROFILE['cache'])


def cache_file(*parts):
    """
    Datei im Cache der Qualitaetsstufe, sonst im Grund-Cache (so braucht die Filmstufe nur neu exportierte Einheiten).
    File in the quality level's cache, else in the base cache (so the film level only needs the re-exported units).
    """
    # Stufen mit 'fallback' (anime) suchen zuerst dort weiter (z. B. .cache/film), dann im Grund-Cache
    # levels with 'fallback' (anime) look there next (e.g. .cache/film), then in the base cache
    for c in [CACHE] + [os.path.join(HERE, f) for f in PROFILE.get('fallback', [])]:
        p = os.path.join(c, *parts)
        if os.path.exists(p):
            return p
    return os.path.join(BASE_CACHE, *parts)


def _render_fps():
    if os.environ.get('FV_FPS'):
        return int(os.environ['FV_FPS'])
    if PROFILE.get('renderFps'):
        return int(PROFILE['renderFps'])
    with open(os.path.join(ROOT, 'src', 'intro', 'film.json')) as fh:
        return int(json.load(fh)['renderFps'])


# Bilder je Sekunde beim Rendern (Vorschau 12, im Video auf 24 gehalten; Film 24) / frames per second when rendering
FPS = _render_fps()
# Aufloesung: die Szenen sind in Bildpunkten einer 1280 breiten Leinwand gebaut (Linienbreiten, Raster); SCALE
# vergroessert nur die Ausgabe, damit Linien im Verhaeltnis gleich dick bleiben
# resolution: the shots are built in pixels of a 1280 wide canvas (line widths, screen); SCALE only enlarges the
# output so lines stay equally thick in proportion
SCALE = float(os.environ.get('FV_SCALE', PROFILE['scale']))
# Weiche Bewegungen (Filmstufe): Fahrten und Stopps laufen ein und aus statt mit harter Kante; 0 = wie bisher
# eased motion (film level): moves and stops ease in and out instead of a hard edge; 0 = as before
EASE = os.environ.get('FV_EASE', '1' if PROFILE.get('ease') else '0') == '1'
TILE = 10.0
HULL = float(os.environ.get("FV_HULL", "2.2"))
# Rasterpunkte auf der Umgebung (Einheiten sind immer flach): 0 = flach (Standard), 1 = Punkte (nur zum Vergleich)
# halftone dots on the environment (units are always flat): 0 = flat (default), 1 = dots (for comparison only)
DOTS = os.environ.get('FV_DOTS', '0') == '1'
# Kantenglaettung: Bildproben je Bild (Tuschelinien brauchen sie) / anti-aliasing: samples per frame (ink lines need them)
SAMPLES = int(os.environ.get('FV_SAMPLES', PROFILE['samples']))

_TOK = None


def tokens():
    global _TOK
    if _TOK is None:
        with open(cache_file('tokens.json')) as fh:
            _TOK = json.load(fh)
    return _TOK


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(value, mul=1.0):
    """Hex-Farbe oder Tokenname -> lineares RGBA / hex colour or token name -> linear RGBA"""
    if not value.startswith('#'):
        t = tokens()
        value = t['intro'].get(value) or t['semantic'].get(value) or t['color'][value]
    h = value.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (_lin(r) * mul, _lin(g) * mul, _lin(b) * mul, 1.0)


def fac(f, key='primary'):
    return rgb(tokens()['faction'][f][key])


def mix(a, b, p):
    return tuple(a[i] + (b[i] - a[i]) * p for i in range(4))


# ---------- Zeit und Kurven / time and curves ----------
def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def seg(t, a, b):
    return clamp((t - a) / (b - a)) if b != a else (1.0 if t >= b else 0.0)


def lerp(a, b, p):
    return a + (b - a) * p


def vlerp(a, b, p):
    return Vector(a).lerp(Vector(b), p)


def ease_io(p):
    return 4 * p * p * p if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2


def ease_out(p):
    return 1 - (1 - p) ** 3


def ease_in(p):
    return p * p * p


def ease_back(p):
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2


def shake(t, at, amp, decay=7.0):
    """Kamerawackeln nach einem Treffer / camera shake after a hit"""
    d = t - at
    if d < 0 or d > 1.2:
        return Vector((0, 0, 0))
    a = amp * math.exp(-d * decay)
    return Vector((math.sin(d * 71 + at) * a, math.cos(d * 53 + at * 1.7) * a, math.sin(d * 37 + at * 0.3) * a * 0.6))


# ---------- Szene / scene ----------
class Shot:
    """Rahmen einer Einstellung: Szene, Kamera, Aktualisierung je Bild / frame of a shot: scene, camera, update per frame"""

    def __init__(self, dur, w=1280, h=720, samples=None):
        samples = samples or SAMPLES
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.sc = sc = bpy.context.scene
        self.dur = dur
        self.w, self.h = w, h
        sc.render.engine = 'BLENDER_EEVEE'
        sc.eevee.taa_render_samples = samples
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, int(round(SCALE * 100))
        sc.render.fps = FPS
        sc.frame_start, sc.frame_end = 1, int(round(dur * FPS))
        sc.render.filter_size = 0.9
        sc.view_settings.view_transform = 'Standard'
        sc.view_settings.look = 'None'
        sc.render.image_settings.file_format = 'PNG'
        sc.render.image_settings.color_mode = 'RGB'
        sc.render.image_settings.compression = 15
        sc.render.film_transparent = False
        # harte Schattenraender brauchen die volle Aufloesung, sonst zeigen sie Treppen / hard shadow edges need the full resolution, otherwise they show stair steps
        sc.eevee.shadow_resolution_scale = float(os.environ.get('FV_SHADOW', PROFILE['shadow']))
        # Sparen ohne sichtbaren Unterschied (gemessen, Bilder gleich): ein Schritt je Schattenstrahl (der Rand ist ohnehin
        # hart), kleinstes Streulicht (alle Materialien sind unbeleuchtet mit eigenen Stufen)
        # savings without a visible difference (measured, pictures equal): one step per shadow ray (the edge is hard
        # anyway), minimal indirect light (all materials are unlit with their own bands)
        sc.eevee.shadow_step_count = int(os.environ.get('FV_SHADOW_STEPS', PROFILE['shadowSteps']))
        # Bewegungsunschaerfe (nur zum Vergleich, Standard aus): Zeitschritte je Bild; die Szene folgt ueber
        # frame_change_pre auch den Zwischenzeiten / motion blur (comparison only, off by default): time steps per frame;
        # the scene follows the sub-frame times through frame_change_pre
        mb = int(os.environ.get('FV_MBLUR', PROFILE.get('motionBlur', 0)))
        sc.render.use_motion_blur = mb > 0
        if mb > 0:
            sc.eevee.motion_blur_steps = mb
            sc.render.motion_blur_shutter = float(os.environ.get('FV_SHUTTER', '0.5'))
        sc.eevee.fast_gi_method = 'AMBIENT_OCCLUSION_ONLY'
        sc.eevee.fast_gi_ray_count = 1
        sc.eevee.fast_gi_step_count = 1
        sc.eevee.fast_gi_resolution = '16'
        self.updaters = []
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        sc.collection.objects.link(cam)
        cam.data.lens = 35
        cam.data.clip_start = 0.1
        cam.data.clip_end = 4000
        cam.data.sensor_fit = 'HORIZONTAL'
        sc.camera = cam
        self.cam = cam
        self.sun = None
        self.toon = ToonGroup()
        # gezeichnete Einheiten und bewegliche Teile der Szene / inked units and moving parts of the scene
        self.units = []
        self.spinners = []

    @property
    def frames(self):
        return self.sc.frame_end

    def on(self, fn):
        """fn(t) wird vor jedem Bild aufgerufen / fn(t) runs before every frame"""
        self.updaters.append(fn)
        return fn

    def update(self, t):
        for fn in self.updaters:
            fn(t)
        units_refresh(self, t)

    def look(self, pos, target, roll=0.0):
        self.cam.location = Vector(pos)
        d = Vector(target) - Vector(pos)
        q = d.to_track_quat('-Z', 'Y')
        self.cam.rotation_euler = q.to_euler()
        if roll:
            self.cam.rotation_euler.rotate_axis('Z', roll)

    def sunlight(self, rot=(0.8, 0.2, 0.6), strength=math.pi, angle=0.0):
        if self.sun is None:
            self.sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
            self.sc.collection.objects.link(self.sun)
        self.sun.rotation_euler = Euler(rot)
        self.sun.data.energy = strength
        # harter Schattenrand ohne Streuung: der weiche Rand rauscht bei wenigen Bildproben wie ein Punktraster
        # hard shadow edge without scatter: with few samples the soft edge is noisy like a dot screen
        self.sun.data.angle = angle
        self.sun.data.shadow_filter_radius = 0.0
        # kleinster Weltabstand je Schattenkarten-Bildpunkt (kleiner = feiner) / smallest world size per shadow map texel (smaller = finer)
        self.sun.data.shadow_maximum_resolution = float(os.environ.get('FV_SHADOW_MAX', PROFILE['shadowMax']))
        # Lichtrichtung fuer Lichtbaender und Glanzfleck der Einheiten / light direction for the units' light bands and glint
        self.toon.set_sun(Euler(rot).to_matrix() @ Vector((0, 0, 1)))
        return self.sun

    def px(self, dist):
        """Weltgroesse eines Bildpunkts in Entfernung dist / world size of one pixel at distance dist"""
        fov = 2 * math.atan(self.cam.data.sensor_width / (2 * self.cam.data.lens))
        # Hochformat (Comicfelder): der Sensor liegt an der Bildhoehe an / portrait (comic panels): the sensor fits the picture height
        return 2 * dist * math.tan(fov / 2) / (self.h if self.cam.data.sensor_fit == 'VERTICAL' else self.w)

    def px_out(self, dist):
        """Weltgroesse eines ausgegebenen Bildpunkts (mit SCALE) / world size of one output pixel (with SCALE)"""
        return self.px(dist) * 100.0 / self.sc.render.resolution_percentage

    def _subframes(self):
        """
        Mit Bewegungsunschaerfe wertet Eevee Zwischenzeiten aus; die Szene wird von Python bewegt, also folgt sie ihnen
        ueber frame_change_pre. / With motion blur Eevee evaluates sub-frame times; the scene is moved by Python, so it
        follows them through frame_change_pre.
        """
        if not self.sc.render.use_motion_blur:
            return

        def follow(scene, *_):
            self.update((scene.frame_current - 1 + scene.frame_subframe) / FPS)
        bpy.app.handlers.frame_change_pre.append(follow)

    def render(self, out_dir, first=1, last=None, every=1):
        os.makedirs(out_dir, exist_ok=True)
        last = last or self.frames
        self._subframes()
        import time
        for f in range(first, last + 1, every):
            t = (f - 1) / FPS
            if os.environ.get('FV_RESUME') and os.path.exists(os.path.join(out_dir, '%04d.png' % f)):
                continue
            self.sc.frame_set(f)
            self.update(t)
            self.sc.render.filepath = os.path.join(out_dir, '%04d.png' % f)
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            print('FRAME %d/%d %.1fs' % (f, self.frames, time.time() - t0), flush=True)


# ---------- Material / material ----------
def _nodes(m):
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return nt, nt.nodes, nt.links


class _Ctl:
    """
    Globaler Regler ueber mehrere Knotengruppen: verhaelt sich wie ein Wertknoten (ctl.outputs[0].default_value = v).
    Global control across several node groups: behaves like a value node (ctl.outputs[0].default_value = v).
    """

    def __init__(self):
        self.nodes = []

    @property
    def outputs(self):
        return [self]

    @property
    def default_value(self):
        return self.nodes[0].outputs[0].default_value

    @default_value.setter
    def default_value(self, v):
        for x in self.nodes:
            x.outputs[0].default_value = v


class ToonGroup:
    """
    Gemeinsame Knotengruppen aller Comic-Materialien. Globale Regler (je Bild aenderbar): Licht der Stufen, Fensterlicht,
    Leuchtstaerke, Sonnenrichtung. Fassungen mit denselben Reglern:
    - g_unit: fuer die gezeichneten Einheiten. Die drei Lichtbaender als flache Toene, gewaehlt wie im Spiel aus dem
      Winkel zwischen Normale und Sonne minus Verdeckung (Eingang Occ; Stufen bei +-1/3). Kein
      Schattenwurf auf die Einheit, keine Rasterpunkte, keine Schraffur: jede Flaeche hat genau einen Ton.
    - g: Umgebung. Baender aus dem beleuchteten Bild (mit Schattenwurf). Standard flach; nur mit FV_DOTS=1 bekommt sie
      die frueheren Rasterpunkte (Vergleichsbild).
    Shared node groups of all comic materials. Global controls (changeable per frame): band light, window light, glow
    strength, sun direction. Versions with the same controls:
    - g_unit: for the inked units. The three light bands as flat tones, picked as in the game from the angle between
      normal and sun minus the occlusion (input Occ; steps at +-1/3). No cast shadows on the unit, no
      halftone dots, no hatching: every surface has exactly one tone.
    - g: environment. Bands from the lit picture (with cast shadows). Flat by default; only with FV_DOTS=1 it gets the
      former halftone dots (comparison still).
    """

    def __init__(self):
        for name in ('shadow', 'mid', 'lit', 'dots_col', 'win_col', 't1', 't2', 'dots', 'win', 'glow', 'cell'):
            setattr(self, name, _Ctl())
        self._sun = []
        self.g_unit = self._build('ToonUnit', 'unit')
        self.g = self._build('ToonCore', 'dots' if DOTS else 'flat')

    def _build(self, name, mode):
        dotted = mode == 'dots'
        g = bpy.data.node_groups.new(name, 'ShaderNodeTree')
        g.interface.new_socket('Base', in_out='INPUT', socket_type='NodeSocketColor')
        g.interface.new_socket('Glow', in_out='INPUT', socket_type='NodeSocketFloat')
        g.interface.new_socket('Win', in_out='INPUT', socket_type='NodeSocketFloat')
        g.interface.new_socket('Occ', in_out='INPUT', socket_type='NodeSocketFloat')
        g.interface.new_socket('Color', in_out='OUTPUT', socket_type='NodeSocketColor')
        g.interface.new_socket('Lit', in_out='OUTPUT', socket_type='NodeSocketColor')
        g.interface.new_socket('Sun', in_out='OUTPUT', socket_type='NodeSocketVector')
        n, L = g.nodes, g.links
        gi = n.new('NodeGroupInput')
        go = n.new('NodeGroupOutput')

        def val(key, v):
            x = n.new('ShaderNodeValue')
            x.name = x.label = key
            x.outputs[0].default_value = v
            getattr(self, key).nodes.append(x)
            return x

        def col(key, v):
            x = n.new('ShaderNodeRGB')
            x.name = x.label = key
            x.outputs[0].default_value = v
            getattr(self, key).nodes.append(x)
            return x

        shadow = col('shadow', (0.50, 0.47, 0.62, 1))
        mid = col('mid', (0.80, 0.78, 0.86, 1))
        lit = col('lit', (1.0, 1.0, 1.0, 1))
        dots_col = col('dots_col', (0.74, 0.74, 0.8, 1))
        win_col = col('win_col', rgb('window300'))
        t1 = val('t1', 0.10)
        t2 = val('t2', 0.42)
        dots = val('dots', 1.0)
        win = val('win', 0.0)
        glow = val('glow', 1.0)
        cell = val('cell', 1280 / 6.0)
        sun = n.new('ShaderNodeCombineXYZ')
        sun.name = 'sun'
        sun.inputs[2].default_value = 1.0
        self._sun.append(sun)
        L.new(sun.outputs[0], go.inputs['Sun'])
        L.new(lit.outputs[0], go.inputs['Lit'])

        if mode == 'unit':
            # Stufen des Spiels (Stufentextur): Licht ueber 1/3, Schatten unter -1/3 / the game's steps (gradient map): light above 1/3, shadow below -1/3
            # Lichtwinkel minus Verdeckung, wie im Spiel / light angle minus occlusion, as in the game
            geo = n.new('ShaderNodeNewGeometry')
            ndl = n.new('ShaderNodeVectorMath')
            ndl.operation = 'DOT_PRODUCT'
            L.new(geo.outputs['Normal'], ndl.inputs[0])
            L.new(sun.outputs[0], ndl.inputs[1])
            sub = n.new('ShaderNodeMath')
            sub.operation = 'SUBTRACT'
            L.new(ndl.outputs['Value'], sub.inputs[0])
            L.new(gi.outputs['Occ'], sub.inputs[1])
            level, lo, hi = sub.outputs[0], n.new('ShaderNodeValue').outputs[0], n.new('ShaderNodeValue').outputs[0]
            lo.default_value, hi.default_value = -1 / 3, 1 / 3
        else:
            dif = n.new('ShaderNodeBsdfDiffuse')
            dif.inputs[0].default_value = (1, 1, 1, 1)
            s2r = n.new('ShaderNodeShaderToRGB')
            L.new(dif.outputs[0], s2r.inputs[0])
            bw = n.new('ShaderNodeRGBToBW')
            L.new(s2r.outputs[0], bw.inputs[0])
            level, lo, hi = bw.outputs[0], t1.outputs[0], t2.outputs[0]

        def cmpgt(a, b):
            m = n.new('ShaderNodeMath')
            m.operation = 'GREATER_THAN'
            L.new(a, m.inputs[0])
            L.new(b, m.inputs[1])
            return m.outputs[0]

        def mixc(fac_out, a, b):
            m = n.new('ShaderNodeMix')
            m.data_type = 'RGBA'
            L.new(fac_out, m.inputs['Factor'])
            L.new(a, m.inputs[6])
            L.new(b, m.inputs[7])
            return m.outputs[2]

        above1 = cmpgt(level, lo)
        above2 = cmpgt(level, hi)
        band = mixc(above1, shadow.outputs[0], mid.outputs[0])
        band = mixc(above2, band, lit.outputs[0])

        if dotted:
            # Rasterpunkte im Bildraum, um 45 Grad gedreht / halftone dots in screen space, rotated 45 degrees
            tc = n.new('ShaderNodeTexCoord')
            asp = n.new('ShaderNodeCombineXYZ')
            L.new(cell.outputs[0], asp.inputs[0])
            div = n.new('ShaderNodeMath')
            div.operation = 'MULTIPLY'
            div.inputs[1].default_value = 9 / 16
            L.new(cell.outputs[0], div.inputs[0])
            L.new(div.outputs[0], asp.inputs[1])
            asp.inputs[2].default_value = 1
            sc_ = n.new('ShaderNodeVectorMath')
            sc_.operation = 'MULTIPLY'
            L.new(tc.outputs['Window'], sc_.inputs[0])
            L.new(asp.outputs[0], sc_.inputs[1])
            rot = n.new('ShaderNodeVectorRotate')
            rot.rotation_type = 'Z_AXIS'
            rot.inputs['Angle'].default_value = math.radians(45)
            L.new(sc_.outputs[0], rot.inputs['Vector'])
            fr = n.new('ShaderNodeVectorMath')
            fr.operation = 'FRACTION'
            L.new(rot.outputs[0], fr.inputs[0])
            sub = n.new('ShaderNodeVectorMath')
            sub.operation = 'SUBTRACT'
            sub.inputs[1].default_value = (0.5, 0.5, 0)
            L.new(fr.outputs[0], sub.inputs[0])
            sep = n.new('ShaderNodeSeparateXYZ')
            L.new(sub.outputs[0], sep.inputs[0])
            cxy = n.new('ShaderNodeCombineXYZ')
            L.new(sep.outputs[0], cxy.inputs[0])
            L.new(sep.outputs[1], cxy.inputs[1])
            ln = n.new('ShaderNodeVectorMath')
            ln.operation = 'LENGTH'
            L.new(cxy.outputs[0], ln.inputs[0])

            # Radius: gross im Schatten, klein im Mittelton, keiner im Licht / radius: big in shadow, small in mid tone, none in light
            def inv(x):
                m = n.new('ShaderNodeMath')
                m.operation = 'SUBTRACT'
                m.inputs[0].default_value = 1.0
                L.new(x, m.inputs[1])
                return m.outputs[0]

            def madd(x, k, y=None):
                m = n.new('ShaderNodeMath')
                m.operation = 'MULTIPLY_ADD'
                L.new(x, m.inputs[0])
                m.inputs[1].default_value = k
                if y is None:
                    m.inputs[2].default_value = 0.0
                else:
                    L.new(y, m.inputs[2])
                return m.outputs[0]

            r_mid = madd(inv(above2), 0.2)
            r_all = madd(inv(above1), 0.14, r_mid)
            rad2 = n.new('ShaderNodeMath')
            rad2.operation = 'MULTIPLY'
            L.new(r_all, rad2.inputs[0])
            L.new(dots.outputs[0], rad2.inputs[1])
            dot = cmpgt(rad2.outputs[0], ln.outputs['Value'])
            dotted_mix = n.new('ShaderNodeMix')
            dotted_mix.data_type = 'RGBA'
            dotted_mix.blend_type = 'MULTIPLY'
            L.new(dot, dotted_mix.inputs['Factor'])
            L.new(band, dotted_mix.inputs[6])
            L.new(dots_col.outputs[0], dotted_mix.inputs[7])
            band = dotted_mix.outputs[2]

        shaded = n.new('ShaderNodeMix')
        shaded.data_type = 'RGBA'
        shaded.blend_type = 'MULTIPLY'
        shaded.inputs['Factor'].default_value = 1
        L.new(gi.outputs['Base'], shaded.inputs[6])
        L.new(band, shaded.inputs[7])
        # Eigenleuchten: Grundfarbe ungeschattet und heller / self glow: base colour unshaded and brighter
        gl = n.new('ShaderNodeMath')
        gl.operation = 'MULTIPLY'
        gl.use_clamp = True
        L.new(gi.outputs['Glow'], gl.inputs[0])
        L.new(glow.outputs[0], gl.inputs[1])
        bright = n.new('ShaderNodeMix')
        bright.data_type = 'RGBA'
        bright.blend_type = 'SCREEN'
        bright.inputs['Factor'].default_value = 0.35
        L.new(gi.outputs['Base'], bright.inputs[6])
        L.new(gi.outputs['Base'], bright.inputs[7])
        out1 = mixc(gl.outputs[0], shaded.outputs[2], bright.outputs[2])
        # Fensterlicht / window light
        wl = n.new('ShaderNodeMath')
        wl.operation = 'MULTIPLY'
        wl.use_clamp = True
        L.new(gi.outputs['Win'], wl.inputs[0])
        L.new(win.outputs[0], wl.inputs[1])
        wl2 = n.new('ShaderNodeMath')
        wl2.operation = 'MULTIPLY'
        wl2.inputs[1].default_value = 2.0
        wl2.use_clamp = True
        L.new(wl.outputs[0], wl2.inputs[0])
        out2 = mixc(wl2.outputs[0], out1, win_col.outputs[0])
        L.new(out2, go.inputs['Color'])
        return g

    def set_light(self, shadow, mid, lit=(1, 1, 1, 1), dots=None):
        self.shadow.default_value = shadow
        self.mid.default_value = mid
        self.lit.default_value = lit
        self.dots_col.default_value = dots or (0.74, 0.74, 0.8, 1)

    def set_sun(self, d):
        """Richtung zum Licht (Welt) / direction towards the light (world)"""
        for x in self._sun:
            for i in range(3):
                x.inputs[i].default_value = d[i]

    def night(self):
        self.set_light((0.16, 0.17, 0.30, 1), (0.30, 0.32, 0.50, 1), (0.55, 0.58, 0.80, 1))

    def day(self):
        self.set_light((0.50, 0.47, 0.62, 1), (0.80, 0.78, 0.86, 1))


_MATS = {}


def toon_attr(shot, name='toon_attr', tint=None, amount=0.5):
    """
    Comic-Material mit Vertexfarben der Spielmodelle; tint faerbt Richtung einer Farbe (Rost, Verdan-Rot).
    Objekt-Eigenschaften lightsoff/glowoff (0..1) schalten Fenster und Leuchten je Objekt aus.
    Comic material with the game models' vertex colours; tint shifts towards a colour (rust, Verdan red).
    Object properties lightsoff/glowoff (0..1) switch windows and glow off per object.
    """
    key = name if tint is None else '%s_%s_%.2f' % (name, tint, amount)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(key)
    nt, n, L = _nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    ca = n.new('ShaderNodeAttribute')
    ca.attribute_name = 'Col'
    ga = n.new('ShaderNodeAttribute')
    ga.attribute_name = 'glow'
    sep = n.new('ShaderNodeSeparateXYZ')
    L.new(ga.outputs['Vector'], sep.inputs[0])
    base = ca.outputs['Color']
    if tint is not None:
        mx = n.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        mx.blend_type = 'MIX'
        mx.inputs['Factor'].default_value = amount
        L.new(base, mx.inputs[6])
        mx.inputs[7].default_value = rgb(tint) if isinstance(tint, str) else tint
        base = mx.outputs[2]

    def off(prop, src):
        oa = n.new('ShaderNodeAttribute')
        oa.attribute_type = 'OBJECT'
        oa.attribute_name = prop
        inv = n.new('ShaderNodeMath')
        inv.operation = 'SUBTRACT'
        inv.inputs[0].default_value = 1.0
        L.new(oa.outputs['Fac'], inv.inputs[1])
        mul = n.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        L.new(src, mul.inputs[0])
        L.new(inv.outputs[0], mul.inputs[1])
        return mul.outputs[0]

    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g
    L.new(base, tg.inputs['Base'])
    L.new(off('glowoff', sep.outputs[0]), tg.inputs['Glow'])
    L.new(off('lightsoff', sep.outputs[1]), tg.inputs['Win'])
    em = n.new('ShaderNodeEmission')
    L.new(tg.outputs[0], em.inputs[0])
    L.new(em.outputs[0], out.inputs[0])
    _MATS[key] = m
    return m


def toon(shot, color, name=None, glow=0.0):
    """Comic-Material in einer Farbe; color ist Token, Hex oder RGBA / comic material in one colour"""
    c = rgb(color) if isinstance(color, str) else tuple(color)
    key = name or 'toon_%s_%.2f' % (','.join('%.3f' % x for x in c), glow)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(key)
    nt, n, L = _nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    cc = n.new('ShaderNodeRGB')
    cc.name = 'base'
    cc.outputs[0].default_value = c
    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g
    L.new(cc.outputs[0], tg.inputs['Base'])
    tg.inputs['Glow'].default_value = glow
    em = n.new('ShaderNodeEmission')
    L.new(tg.outputs[0], em.inputs[0])
    L.new(em.outputs[0], out.inputs[0])
    _MATS[key] = m
    return m


def flat(color, name=None, strength=1.0, alpha=None):
    """Ungeschattete Farbe (Feuer, Strahl, Himmel); mit alpha halbtransparent / unshaded colour; with alpha translucent"""
    c = rgb(color) if isinstance(color, str) else tuple(color)
    key = name or 'flat_%s_%.2f_%s' % (','.join('%.3f' % x for x in c), strength, alpha)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(key)
    nt, n, L = _nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    em = n.new('ShaderNodeEmission')
    em.name = 'em'
    em.inputs[0].default_value = c
    em.inputs[1].default_value = strength
    if alpha is None:
        L.new(em.outputs[0], out.inputs[0])
    else:
        tr = n.new('ShaderNodeBsdfTransparent')
        mx = n.new('ShaderNodeMixShader')
        mx.name = 'mix'
        mx.inputs[0].default_value = alpha
        L.new(tr.outputs[0], mx.inputs[1])
        L.new(em.outputs[0], mx.inputs[2])
        L.new(mx.outputs[0], out.inputs[0])
        try:
            m.surface_render_method = 'BLENDED'
        except AttributeError:
            m.blend_method = 'BLEND'
        m.use_backface_culling = False
    _MATS[key] = m
    return m


def ink_mat():
    if 'ink' in _MATS:
        return _MATS['ink']
    m = bpy.data.materials.new('ink')
    nt, n, L = _nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    em = n.new('ShaderNodeEmission')
    em.inputs[0].default_value = rgb('ink')
    _no_shadow(m, em.outputs[0], out)
    m.use_backface_culling = True
    _MATS['ink'] = m
    return m


def _no_shadow(m, shader, out):
    """
    Die Tuschehuelle wirft keinen Schatten: sie liegt knapp ueber der Flaeche und wuerde sie sonst bei feiner
    Schattenaufloesung verdunkeln (fuer Schattenstrahlen durchsichtig).
    The ink hull casts no shadow: it sits just above the surface and would otherwise darken it at a fine shadow
    resolution (transparent for shadow rays).
    """
    nt = m.node_tree
    lp = nt.nodes.new('ShaderNodeLightPath')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Shadow Ray'], mx.inputs[0])
    nt.links.new(shader, mx.inputs[1])
    nt.links.new(tr.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs[0])
    m.use_transparent_shadow = True


def outline(shot, ob, px=2.4, dist=None, thickness=None):
    """Tuschekontur als umgedrehte Huelle / ink outline as an inverted hull"""
    if thickness is None:
        if dist is None:
            dist = (ob.matrix_world.translation - shot.cam.location).length
        thickness = shot.px(max(dist, 1.0)) * px
    if ink_mat().name not in [s.name for s in ob.data.materials if s]:
        ob.data.materials.append(ink_mat())
    mod = ob.modifiers.get('ink') or ob.modifiers.new('ink', 'SOLIDIFY')
    mod.thickness = -thickness / max(1e-6, max(ob.scale))
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(ob.data.materials) - 1
    mod.use_even_offset = False
    return ob


# ---------- Spielmodelle / game models ----------
_MESH = {}


def _arr(b64, dtype=np.float32):
    return np.frombuffer(base64.b64decode(b64), dtype=dtype)


def model_mesh(name):
    """Spielmodell als Blender-Mesh (geteilt) / game model as a Blender mesh (shared)"""
    if name in _MESH:
        return _MESH[name]
    with open(cache_file('models', name + '.json')) as fh:
        d = json.load(fh)
    p = _arr(d['pos']).reshape(-1, 3).astype(np.float64)
    nrm = _arr(d['nor']).reshape(-1, 3)
    col = _arr(d['col']).reshape(-1, 3)
    glow = _arr(d['glow']).reshape(-1, 2)
    # three (y oben) -> Blender (z oben), Massstab / three (y up) -> Blender (z up), scale
    pb = np.stack([p[:, 0], -p[:, 2], p[:, 1]], 1) * TILE
    nb = np.stack([nrm[:, 0], -nrm[:, 2], nrm[:, 1]], 1)
    q = np.round(pb / 1e-3).astype(np.int64)
    uniq, inv = np.unique(q, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    verts = np.zeros((len(uniq), 3))
    np.add.at(verts, inv, pb)
    cnt = np.bincount(inv, minlength=len(uniq)).reshape(-1, 1)
    verts /= cnt
    tri = inv.reshape(-1, 3)
    ok = (tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])
    corner_ok = np.repeat(ok, 3)
    tri = tri[ok]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(), [], tri.tolist())
    me.update()
    nl = len(me.loops)
    c = col[corner_ok]
    rgba = np.concatenate([c, np.ones((len(c), 1), np.float32)], 1).astype(np.float32)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    if len(rgba) == nl:
        ca.data.foreach_set('color', rgba.ravel())
        ga = me.attributes.new('glow', 'FLOAT2', 'CORNER')
        ga.data.foreach_set('vector', glow[corner_ok].astype(np.float32).ravel())
        try:
            me.normals_split_custom_set([tuple(v) for v in nb[corner_ok]])
        except Exception as e:  # noqa: BLE001
            print('normals', name, e)
    else:
        print('WARN loop count mismatch', name, nl, len(rgba))
    _MESH[name] = me
    return me


def model(shot, name, loc=(0, 0, 0), rot=0.0, scale=1.0, ink=True, px=3.6, mat=None, parent=None, tint=None):
    """
    Spielmodell in die Szene setzen; rot = Drehung um z (Grad). Einheiten (Export unter .cache/units) kommen als
    gezeichnete Modelle (siehe unit()). tint = (Farbe, Anteil[, 'wash']) faerbt ein (Verdan-Rot, Rost).
    Place a game model; rot = rotation about z (degrees). Units (export under .cache/units) come as inked models
    (see unit()). tint = (colour, amount[, 'wash']) tints (Verdan red, rust).
    """
    if is_unit(name):
        return unit(shot, name, loc=loc, rot=rot, scale=scale, tint=tint, parent=parent)
    if tint is not None and mat is None:
        mat = toon_attr(shot, tint=tint[0], amount=tint[1])
    me = model_mesh(name)
    if not me.materials:
        me.materials.append(toon_attr(shot))
    ob = bpy.data.objects.new(name, me)
    shot.sc.collection.objects.link(ob)
    if mat is not None:
        # eigenes Material je Objekt (z. B. Rost), das Mesh bleibt geteilt / own material per object (e.g. rust), the mesh stays shared
        ob.material_slots[0].link = 'OBJECT'
        ob.material_slots[0].material = mat
    ob.location = Vector(loc)
    ob.rotation_euler = Euler((0, 0, math.radians(rot)))
    ob.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    if parent:
        ob.parent = parent
    if ink:
        _ink_shared(shot, ob, px)
    return ob


def _ink_shared(shot, ob, px):
    # Die Huelle braucht das Tuschematerial im geteilten Mesh / the hull needs the ink material in the shared mesh
    me = ob.data
    if ink_mat().name not in [s.name for s in me.materials if s]:
        me.materials.append(ink_mat())
    dist = (ob.matrix_world.translation - shot.cam.location).length
    th = shot.px(max(dist, 1.0)) * px
    mod = ob.modifiers.new('ink', 'SOLIDIFY')
    mod.thickness = -th / max(1e-6, max(ob.scale)) * HULL
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(me.materials) - 1
    mod.use_even_offset = False


def ink_refresh(shot, obs, px=2.4):
    """Konturstaerke nach aktueller Kamera neu setzen / reset outline width for the current camera"""
    for ob in obs:
        mod = ob.modifiers.get('ink')
        if mod:
            dist = (ob.matrix_world.translation - shot.cam.location).length
            mod.thickness = -shot.px(max(dist, 1.0)) * px / max(1e-6, max(ob.scale))


# ---------- Gezeichnete Einheiten / inked units ----------
# Die Einheiten des Spiels sind gezeichnet (src/render/models/inked): glatte Koerper mit Texturkoordinaten, die Zeichnung
# liegt in Atlanten (Zeichnung RGBA + Tusche als Abstandsfeld), dazu Umriss und Innenlinien. Der Film bildet das nach:
# - Material: Vertexfarbe x Zeichnung, deckende Farbe nach Alpha, Tusche aus dem Abstandsfeld (Schwelle 0.5), drei flache
#   Lichtbaender des Films mit der Verdeckung je Ecke, harter Glanzfleck, Leuchten nach der Leuchtmaske des Spiels.
#   Keine Rasterpunkte, keine Schraffur.
# - Linien: der Shader des Spiels faechert Huelle und Knickbaender im Bildraum auf; hier sind es Geometrien aus dem
#   Tuschebauer des Spiels: die umgestuelpte Huelle (verschweisste Ecken, geglaettete Normalen) und je Knickkante ein
#   duennes Prisma. Ein Geometry-Nodes-Modifikator schiebt beide je Bild auf die Breite, die das Spiel bei gleicher
#   Bildgroesse zeichnet (Grenzen in Bildpunkten wie im Shader des Spiels).
# The game's units are inked (src/render/models/inked): smooth bodies with texture coordinates, the drawing lives in
# atlases (drawing RGBA + ink as a distance field), plus silhouette and inner lines. The film reproduces that:
# - material: vertex colour x drawing, opaque colour by alpha, ink from the distance field (threshold 0.5), the film's
#   three flat light bands with the per-vertex occlusion, a hard glint, glow from the game's glow mask. No halftone
#   dots, no hatching.
# - lines: the game's shader fans hull and crease ribbons out in screen space; here they are geometry from the game's
#   ink builder: the inverted hull (welded vertices, smoothed normals) and a thin prism per crease edge. A geometry
#   nodes modifier moves both per frame to the width the game draws at the same picture size (pixel limits as in the
#   game's shader).
_UNIT = {}
_UMESH = {}
_STYLE = None
# Weiche Kante der gezeichneten Tusche in Bildpunkten (das Spiel nimmt fwidth, also gut einen Bildpunkt; hier glaetten
# zusaetzlich die Bildproben) / soft edge of the drawn ink in pixels (the game uses fwidth, a good pixel; here the
# samples smooth as well)
INK_SOFT = float(os.environ.get('FV_INK_SOFT', '0.7'))
# Linienbreiten in Bildpunkten bei 1280 Breite: das Spiel begrenzt den Umriss auf 1 .. 2.9 CSS-Pixel bei rund 1440 Breite
# line widths in pixels at 1280 width: the game limits the silhouette to 1 .. 2.9 CSS pixels at about 1440 width
INK_MAX_PX = float(os.environ.get('FV_INK_MAX', '2.6'))
INK_MIN_PX = float(os.environ.get('FV_INK_MIN', '1.0'))
# Verdeckung: das Spiel zieht (1 - ao) * 0.85 vom Lichtwinkel ab (material.ts) / occlusion: the game subtracts (1 - ao) * 0.85 from the light angle (material.ts)
AO_SHIFT = float(os.environ.get('FV_AO', '0.85'))
# Glanzfleck des Spiels (material.ts GLINT, Exponent 60 .. 260 je Glanzwert, Deckung 0.88) / the game's glint
GLINT = (0.46, 0.54, 60.0, 260.0, 0.88)


def style():
    """Kenngroessen des gezeichneten Stils aus dem Export / figures of the inked style from the export"""
    global _STYLE
    if _STYLE is None:
        with open(cache_file('inked.json')) as fh:
            _STYLE = json.load(fh)
    return _STYLE


def is_unit(name):
    return name in _UNIT or os.path.exists(cache_file('units', name + '.json'))


def unit_data(name):
    """Kopf und Felder einer exportierten Einheit / header and arrays of an exported unit"""
    if name in _UNIT:
        return _UNIT[name]
    with open(cache_file('units', name + '.json')) as fh:
        d = json.load(fh)
    with open(cache_file('units', name + '.bin'), 'rb') as fh:
        blob = fh.read()

    def arr(ref, width):
        dt = np.float32 if ref['type'] == 'f32' else np.uint32
        return np.frombuffer(blob, dtype=dt, count=ref['n'], offset=ref['off']).reshape(-1, width)

    for part in d['parts']:
        for key, width in (('pos', 3), ('nor', 3), ('uv', 2), ('col', 3), ('fx', 2), ('glow', 2)):
            part[key] = arr(part[key], width)
        ink = part['ink']
        for key, width in (('pos', 3), ('nor', 3), ('idx', 3), ('a', 3), ('b', 3), ('w', 2)):
            ink[key] = arr(ink[key], width)
    _UNIT[name] = d
    return d


def to_blender(p):
    """three (y oben) -> Blender (z oben), Brettfeld -> Meter / three (y up) -> Blender (z up), tile -> metres"""
    p = np.asarray(p, dtype=np.float64)
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], -1) * TILE


def _fill_mesh(name, i, part):
    """Flaeche eines Teils: uv, Vertexfarbe, fx (Glanz, Verdeckung), Leuchtmaske, Normalen / fill of a part"""
    key = '%s|fill%d' % (name, i)
    if key in _UMESH:
        return _UMESH[key]
    pb = to_blender(part['pos'])
    nb = to_blender(part['nor']) / TILE
    q = np.round(pb / 1e-3).astype(np.int64)
    uniq, inv = np.unique(q, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    verts = np.zeros((len(uniq), 3))
    np.add.at(verts, inv, pb)
    verts /= np.bincount(inv, minlength=len(uniq)).reshape(-1, 1)
    tri = inv.reshape(-1, 3)
    ok = (tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])
    corner = np.repeat(ok, 3)
    me = bpy.data.meshes.new(key)
    me.from_pydata(verts.tolist(), [], tri[ok].tolist())
    me.update()
    n = int(corner.sum())
    assert len(me.loops) == n, (key, len(me.loops), n)
    # Zeile 0 der Texturdaten (v = 0) ist die oberste Bildzeile, Blender zaehlt von unten / row 0 of the texture data (v = 0) is the top image row, Blender counts from the bottom
    uv = part['uv'][corner].astype(np.float32).copy()
    uv[:, 1] = 1.0 - uv[:, 1]
    me.uv_layers.new(name='UVMap').data.foreach_set('uv', uv.ravel())
    rgba = np.concatenate([part['col'][corner], np.ones((n, 1), np.float32)], 1).astype(np.float32)
    me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER').data.foreach_set('color', rgba.ravel())
    # Glanz und Verdeckung, Leuchtmaske: je drei Werte, damit Blender sie nicht fuer Texturkoordinaten haelt
    # gloss and occlusion, glow mask: three values each so Blender does not take them for texture coordinates
    for nm in ('glow', 'fx'):
        v3 = np.concatenate([part[nm][corner], np.zeros((n, 1), np.float32)], 1).astype(np.float32)
        me.attributes.new(nm, 'FLOAT_VECTOR', 'CORNER').data.foreach_set('vector', v3.ravel())
    for poly in me.polygons:
        poly.use_smooth = True
    me.normals_split_custom_set([tuple(v) for v in nb[corner]])
    _UMESH[key] = me
    return me


def _hash3(p):
    return np.modf(np.sin(p @ np.array([127.1, 311.7, 74.7])) * 43758.5453)[0] % 1.0


def _noise3(p):
    """Wertrauschen wie im Tuscheshader des Spiels (bNoise) / value noise as in the game's ink shader (bNoise)"""
    i = np.floor(p)
    f = p - i
    f = f * f * (3 - 2 * f)
    out = 0
    for dz in (0, 1):
        for dy in (0, 1):
            for dx in (0, 1):
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                out = out + w * _hash3(i + np.array([dx, dy, dz]))
    return out


def _ink_mesh(name, i, part):
    """
    Tusche eines Teils: Huelle (Flaechen gewendet, Material 0 mit Rueckseiten-Auslese) und je Knickkante ein vierseitiges
    Prisma (Material 1). Die Ecken liegen auf der Flaeche bzw. auf der Kante; die Attribute off (Normale), wav
    (Schwankung 0..1) und rad (Radius des Prismas mal Gewicht) sagen dem Modifikator, wohin er sie schiebt.
    Ink of a part: hull (faces flipped, material 0 with back-face culling) and a four-sided prism per crease edge
    (material 1). The vertices lie on the surface resp. on the edge; the attributes off (normal), wav (waver 0..1) and
    rad (prism radius times weight) tell the modifier where to move them.
    """
    key = '%s|ink%d' % (name, i)
    if key in _UMESH:
        return _UMESH[key]
    ink = part['ink']
    st = style()
    hp = to_blender(ink['pos'])
    hn = to_blender(ink['nor']) / TILE
    nv = len(hp)
    # Schwankung der Umrissbreite wie im Spiel: n = Rauschen(p * 34) * 0.65 + Rauschen(p * 11) * 0.35
    # waver of the silhouette width as in the game: n = noise(p * 34) * 0.65 + noise(p * 11) * 0.35
    p3 = ink['pos'].astype(np.float64)
    wav = _noise3(p3 * 34.0) * 0.65 + _noise3(p3 * 11.0) * 0.35
    faces = ink['idx'][:, [0, 2, 1]].astype(np.int64)
    a, b, w = to_blender(ink['a']), to_blender(ink['b']), ink['w'].astype(np.float64)
    nc = len(a)
    r0 = st['creaseHalfWidth'] * TILE
    d = b - a
    ln = np.linalg.norm(d, axis=1, keepdims=True)
    d = d / np.maximum(ln, 1e-9)
    ref = np.where(np.abs(d[:, 2:3]) > 0.9, np.array([[1.0, 0, 0]]), np.array([[0, 0, 1.0]]))
    u = np.cross(d, ref)
    u /= np.maximum(np.linalg.norm(u, axis=1, keepdims=True), 1e-9)
    v = np.cross(d, u)
    # Enden laufen wie im Spiel um 0.7 Breiten ueber die Kante hinaus / the ends run 0.7 widths beyond the edge as in the game
    a2 = a - d * (0.7 * r0) * w[:, 0:1]
    b2 = b + d * (0.7 * r0) * w[:, 1:2]
    # vier Ecken je Ende; der Umkreis 1.15 r gleicht die mittlere sichtbare Breite an 2 r an
    # four vertices per end; the circumradius 1.15 r matches the mean visible width to 2 r
    dirs = np.stack([u, v, -u, -v], 1)
    cpos = np.concatenate([np.repeat(a2[:, None, :], 4, 1), np.repeat(b2[:, None, :], 4, 1)], 1).reshape(-1, 3)
    crad = np.concatenate([dirs * (1.15 * r0) * w[:, 0, None, None], dirs * (1.15 * r0) * w[:, 1, None, None]], 1).reshape(-1, 3)
    base = nv + np.arange(nc)[:, None] * 8
    quads = []
    for k in range(4):
        k2 = (k + 1) % 4
        quads.append(np.stack([base[:, 0] + k, base[:, 0] + k2, base[:, 0] + 4 + k2, base[:, 0] + 4 + k], 1))
    quads = np.concatenate(quads, 0) if nc else np.zeros((0, 4), np.int64)
    verts = np.concatenate([hp, cpos], 0)
    me = bpy.data.meshes.new(key)
    me.from_pydata(verts.tolist(), [], faces.tolist() + quads.tolist())
    me.update()
    off = np.concatenate([hn, np.zeros((nc * 8, 3))], 0).astype(np.float32)
    rad = np.concatenate([np.zeros((nv, 3)), crad], 0).astype(np.float32)
    wv = np.concatenate([wav, np.zeros(nc * 8)], 0).astype(np.float32)
    me.attributes.new('off', 'FLOAT_VECTOR', 'POINT').data.foreach_set('vector', off.ravel())
    me.attributes.new('rad', 'FLOAT_VECTOR', 'POINT').data.foreach_set('vector', rad.ravel())
    me.attributes.new('wav', 'FLOAT', 'POINT').data.foreach_set('value', wv)
    me.materials.append(ink_mat())
    me.materials.append(ink_line_mat())
    mi = np.concatenate([np.zeros(len(faces), np.int32), np.ones(len(quads), np.int32)])
    me.polygons.foreach_set('material_index', mi)
    _UMESH[key] = me
    return me


def ink_line_mat():
    """Tusche der Innenlinien: von beiden Seiten sichtbar / ink of the inner lines: visible from both sides"""
    if 'ink_line' in _MATS:
        return _MATS['ink_line']
    m = bpy.data.materials.new('ink_line')
    nt, n, L = _nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    em = n.new('ShaderNodeEmission')
    em.inputs[0].default_value = rgb('ink')
    L.new(em.outputs[0], out.inputs[0])
    m.use_backface_culling = False
    _MATS['ink_line'] = m
    return m


def _ink_geo():
    """Knotengruppe des Tuschemodifikators: Ort += off * (A + B * wav) + rad * R / node group of the ink modifier"""
    g = bpy.data.node_groups.get('InkGeo')
    if g:
        return g
    g = bpy.data.node_groups.new('InkGeo', 'GeometryNodeTree')
    g.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    for nm in ('A', 'B', 'R'):
        g.interface.new_socket(nm, in_out='INPUT', socket_type='NodeSocketFloat')
    g.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    g.is_modifier = True
    n, L = g.nodes, g.links
    gi = n.new('NodeGroupInput')
    go = n.new('NodeGroupOutput')

    def named(name, kind):
        x = n.new('GeometryNodeInputNamedAttribute')
        x.data_type = kind
        x.inputs['Name'].default_value = name
        return x.outputs[0]

    amt = n.new('ShaderNodeMath')
    amt.operation = 'MULTIPLY_ADD'
    L.new(named('wav', 'FLOAT'), amt.inputs[0])
    L.new(gi.outputs['B'], amt.inputs[1])
    L.new(gi.outputs['A'], amt.inputs[2])
    s1 = n.new('ShaderNodeVectorMath')
    s1.operation = 'SCALE'
    L.new(named('off', 'FLOAT_VECTOR'), s1.inputs[0])
    L.new(amt.outputs[0], s1.inputs['Scale'])
    s2 = n.new('ShaderNodeVectorMath')
    s2.operation = 'SCALE'
    L.new(named('rad', 'FLOAT_VECTOR'), s2.inputs[0])
    L.new(gi.outputs['R'], s2.inputs['Scale'])
    add = n.new('ShaderNodeVectorMath')
    add.operation = 'ADD'
    L.new(s1.outputs[0], add.inputs[0])
    L.new(s2.outputs[0], add.inputs[1])
    sp = n.new('GeometryNodeSetPosition')
    L.new(gi.outputs['Geometry'], sp.inputs['Geometry'])
    L.new(add.outputs[0], sp.inputs['Offset'])
    L.new(sp.outputs['Geometry'], go.inputs['Geometry'])
    return g


_ATLAS = {}


def _srgb(x):
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.maximum(x, 1e-9), 1 / 2.4) - 0.055)


def atlas_images(atlas):
    """
    Die zwei Texturen eines Atlas. Zeichnung: das Spiel rechnet rgb^2.2; hier wird das beim Laden einmal gerechnet und
    als sRGB-Bild abgelegt, die Grafikkarte liefert dann genau rgb^2.2 (linear), ohne Potenz je Bildpunkt. Alpha bleibt
    ein eigener Kanal (CHANNEL_PACKED: die Farbe wird nicht mit Alpha verrechnet). Tusche: Abstandsfeld als Daten.
    The two textures of an atlas. Drawing: the game computes rgb^2.2; here that is computed once at load and stored as
    an sRGB image, the graphics card then returns exactly rgb^2.2 (linear) without a power per fragment. Alpha stays
    a channel of its own (CHANNEL_PACKED: colour is not combined with alpha). Ink: distance field as data.
    """
    if atlas in _ATLAS:
        return _ATLAS[atlas]
    out = []
    for layer in ('paint', 'ink'):
        src = bpy.data.images.load(cache_file('atlas', '%s-%s.png' % (atlas, layer)))
        src.colorspace_settings.name = 'Non-Color'
        w, h = src.size
        px = np.empty(w * h * 4, np.float32)
        src.pixels.foreach_get(px)
        bpy.data.images.remove(src)
        if layer == 'paint':
            px = px.reshape(-1, 4)
            px[:, :3] = _srgb(np.power(px[:, :3], 2.2))
            px = px.ravel()
        img = bpy.data.images.new('%s-%s' % (atlas, layer), w, h, alpha=True, is_data=(layer == 'ink'))
        img.alpha_mode = 'CHANNEL_PACKED'
        img.pixels.foreach_set(px)
        img.update()
        out.append(img)
    _ATLAS[atlas] = tuple(out)
    return _ATLAS[atlas]


def inked_mat(shot, atlas, tint=None):
    """
    Material der gezeichneten Einheiten eines Atlas. Wie material.ts des Spiels:
    Farbe = mix(Vertexfarbe * Helligkeit * (2 rgb)^2.2, rgb^2.2, a), dann die drei Lichtbaender (flach, Verdeckung
    schiebt die Stufen), Glanzfleck, Leuchten, zuletzt die Tusche aus dem Abstandsfeld (weiche Kante um 0.5 in der
    Breite eines Bildpunkts: Objekt-Eigenschaft inkw, je Bild gesetzt).
    tint = (Farbe, Anteil): faerbt die Vertexfarbe um, die Zeichnung bleibt (Verdan-Rot);
    tint = (Farbe, Anteil, 'wash'): faerbt das fertige Bild nach seiner Helligkeit um (Rost, Brand).
    Material of the inked units of one atlas. As the game's material.ts:
    colour = mix(vertex colour * brightness * (2 rgb)^2.2, rgb^2.2, a), then the three light bands (flat, occlusion
    shifts the steps), glint, glow, finally the ink from the distance field (soft edge around 0.5 one pixel wide:
    object property inkw, set per frame).
    tint = (colour, amount): recolours the vertex colour, the drawing stays (Verdan red);
    tint = (colour, amount, 'wash'): recolours the finished picture by its brightness (rust, burn).
    """
    key = 'inked_%s_%s' % (atlas, tint)
    if key in _MATS:
        return _MATS[key]
    st = style()
    paint, inkimg = atlas_images(atlas)
    m = bpy.data.materials.new(key)
    nt, n, L = _nodes(m)
    out = n.new('ShaderNodeOutputMaterial')

    def math(op, a, b=None, c=None, clamp_=False):
        x = n.new('ShaderNodeMath')
        x.operation = op
        x.use_clamp = clamp_
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                x.inputs[i].default_value = v
            else:
                L.new(v, x.inputs[i])
        return x.outputs[0]

    def mixc(f, a, b, blend='MIX'):
        x = n.new('ShaderNodeMix')
        x.data_type = 'RGBA'
        x.blend_type = blend
        for sock, v in ((x.inputs['Factor'], f), (x.inputs[6], a), (x.inputs[7], b)):
            if isinstance(v, (int, float)):
                sock.default_value = v
            elif isinstance(v, tuple):
                sock.default_value = v
            else:
                L.new(v, sock)
        return x.outputs[2]

    def obj_prop(name):
        x = n.new('ShaderNodeAttribute')
        x.attribute_type = 'OBJECT'
        x.attribute_name = name
        return x.outputs['Fac']

    ca = n.new('ShaderNodeAttribute')
    ca.attribute_name = 'Col'
    col = ca.outputs['Color']
    wash = tint is not None and len(tint) > 2 and tint[2] == 'wash'
    if tint is not None and not wash:
        col = mixc(tint[1], col, rgb(tint[0]) if isinstance(tint[0], str) else tuple(tint[0]))
    uvm = n.new('ShaderNodeUVMap')
    uvm.uv_map = 'UVMap'
    tp = n.new('ShaderNodeTexImage')
    tp.image = paint
    tp.interpolation = 'Linear'
    tp.extension = 'EXTEND'
    L.new(uvm.outputs['UV'], tp.inputs['Vector'])
    ti = n.new('ShaderNodeTexImage')
    ti.image = inkimg
    ti.interpolation = 'Linear'
    ti.extension = 'EXTEND'
    L.new(uvm.outputs['UV'], ti.inputs['Vector'])
    # mul = Vertexfarbe * Helligkeit * 2^2.2 * rgb^2.2; abs = rgb^2.2 / mul = vertex colour * brightness * 2^2.2 * rgb^2.2; abs = rgb^2.2
    mul = n.new('ShaderNodeVectorMath')
    mul.operation = 'MULTIPLY'
    L.new(col, mul.inputs[0])
    L.new(tp.outputs['Color'], mul.inputs[1])
    mk = n.new('ShaderNodeVectorMath')
    mk.operation = 'SCALE'
    L.new(mul.outputs[0], mk.inputs[0])
    mk.inputs['Scale'].default_value = st['unitBrightness'] * 2 ** 2.2
    base = mixc(tp.outputs['Alpha'], mk.outputs[0], tp.outputs['Color'])
    if wash:
        # nach Helligkeit einfaerben: die Zeichnung bleibt als Hell-Dunkel erhalten / tint by brightness: the drawing survives as light and dark
        bw = n.new('ShaderNodeRGBToBW')
        L.new(base, bw.inputs[0])
        k = math('MULTIPLY_ADD', bw.outputs[0], 1.5, 0.3)
        tc = n.new('ShaderNodeVectorMath')
        tc.operation = 'SCALE'
        tc.inputs[0].default_value = (rgb(tint[0]) if isinstance(tint[0], str) else tuple(tint[0]))[:3]
        L.new(k, tc.inputs['Scale'])
        base = mixc(tint[1], base, tc.outputs[0])
    fx = n.new('ShaderNodeAttribute')
    fx.attribute_name = 'fx'
    fxs = n.new('ShaderNodeSeparateXYZ')
    L.new(fx.outputs['Vector'], fxs.inputs[0])
    gloss, ao = fxs.outputs[0], fxs.outputs[1]
    ga = n.new('ShaderNodeAttribute')
    ga.attribute_name = 'glow'
    gs = n.new('ShaderNodeSeparateXYZ')
    L.new(ga.outputs['Vector'], gs.inputs[0])
    glow = math('MULTIPLY', gs.outputs[0], math('SUBTRACT', 1.0, obj_prop('glowoff')))
    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g_unit
    geo = n.new('ShaderNodeNewGeometry')
    L.new(base, tg.inputs['Base'])
    L.new(glow, tg.inputs['Glow'])
    L.new(math('MULTIPLY', math('SUBTRACT', 1.0, ao), AO_SHIFT), tg.inputs['Occ'])
    # Glanzfleck mit harter Kante auf Metall und Glas: Winkel zwischen Normale und Halbvektor gegen Schwellen, die vom
    # Glanzwert abhaengen (wie im Spiel); in der Farbe des Lichtbands, damit er nachts nicht weiss leuchtet
    # hard-edged glint on metal and glass: angle between normal and half vector against thresholds that depend on the
    # gloss value (as in the game); in the colour of the light band so it does not shine white at night
    hv = n.new('ShaderNodeVectorMath')
    hv.operation = 'ADD'
    L.new(tg.outputs['Sun'], hv.inputs[0])
    L.new(geo.outputs['Incoming'], hv.inputs[1])
    hn = n.new('ShaderNodeVectorMath')
    hn.operation = 'NORMALIZE'
    L.new(hv.outputs[0], hn.inputs[0])
    ndh = n.new('ShaderNodeVectorMath')
    ndh.operation = 'DOT_PRODUCT'
    L.new(geo.outputs['Normal'], ndh.inputs[0])
    L.new(hn.outputs[0], ndh.inputs[1])
    g0, g1, e0, e1, cover = GLINT
    ex = math('DIVIDE', 1.0, math('MULTIPLY_ADD', gloss, e0 - e1, e1))
    sm = n.new('ShaderNodeMapRange')
    sm.interpolation_type = 'SMOOTHSTEP'
    L.new(ndh.outputs['Value'], sm.inputs['Value'])
    L.new(math('POWER', g0, ex), sm.inputs['From Min'])
    L.new(math('POWER', g1, ex), sm.inputs['From Max'])
    glint = math('MULTIPLY', math('MULTIPLY', sm.outputs['Result'], math('GREATER_THAN', gloss, 0.01)), cover)
    lit = mixc(glint, tg.outputs['Color'], tg.outputs['Lit'])
    # Tusche: weiche Kante um die Schwelle 0.5 / ink: soft edge around the threshold 0.5
    w = math('MAXIMUM', obj_prop('inkw'), 0.002)
    inkf = n.new('ShaderNodeMapRange')
    inkf.interpolation_type = 'SMOOTHSTEP'
    L.new(ti.outputs['Color'], inkf.inputs['Value'])
    L.new(math('SUBTRACT', 0.5, w), inkf.inputs['From Min'])
    L.new(math('ADD', 0.5, w), inkf.inputs['From Max'])
    final = mixc(inkf.outputs['Result'], lit, rgb('ink'))
    em = n.new('ShaderNodeEmission')
    L.new(final, em.inputs[0])
    L.new(em.outputs[0], out.inputs[0])
    _MATS[key] = m
    return m


def unit(shot, name, loc=(0, 0, 0), rot=0.0, scale=1.0, tint=None, parent=None):
    """
    Gezeichnete Einheit in die Szene setzen. Rueckgabe: die Wanne (Flaeche); Kinder sind ihre Tusche, die Drehtuerme
    (am Drehpunkt, Ruhewinkel; siehe turrets() und aim()) mit eigener Tusche und die beweglichen Teile (Rotoren, Drohnen).
    Place an inked unit. Returns the hull (fill); its children are its ink, the turrets (at their pivot, rest heading;
    see turrets() and aim()) with their own ink, and the moving parts (rotors, drones).
    """
    d = unit_data(name)
    mat = inked_mat(shot, d['atlas'], tint)
    root = None
    rec = {'name': name, 'parts': [], 'turrets': [], 'data': d}
    for i, part in enumerate(d['parts']):
        me = _fill_mesh(name, i, part)
        if not me.materials:
            me.materials.append(inked_mat(shot, d['atlas']))
        fill = bpy.data.objects.new(name if i == 0 else '%s.turret%d' % (name, i), me)
        shot.sc.collection.objects.link(fill)
        if tint is not None:
            fill.material_slots[0].link = 'OBJECT'
            fill.material_slots[0].material = mat
        fill['glowoff'] = 0.0
        fill['inkw'] = 0.05
        if i == 0:
            root = fill
            fill.location = Vector(loc)
            fill.rotation_euler = Euler((0, 0, math.radians(rot)))
            fill.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
            if parent:
                fill.parent = parent
        else:
            fill.parent = root
            fill.location = Vector(to_blender(part['pivot']))
            fill.rotation_euler = Euler((0, 0, part['yaw']))
            rec['turrets'].append(fill)
        line = bpy.data.objects.new(fill.name + '.ink', _ink_mesh(name, i, part))
        shot.sc.collection.objects.link(line)
        line.parent = fill
        line.visible_shadow = False
        mod = line.modifiers.new('ink', 'NODES')
        mod.node_group = _ink_geo()
        rec['parts'].append((fill, line, mod))
    # bewegliche Teile wie TechParts des Spiels / moving parts as the game's TechParts
    for k, tp in enumerate(d['tech']):
        if tp['kind'] not in ('rotor', 'drone'):
            continue
        ob = model(shot, 'tech_' + tp['kind'], loc=Vector(to_blender(tp['p'])), scale=tp['scale'], px=1.6, parent=root)
        shot.spinners.append((ob, tp, Vector(ob.location), (len(shot.spinners) * 0.618) % 1 * 2 * math.pi))
    root['fv_unit'] = name
    shot.units.append(rec)
    return root


def unit_rec(shot, ob):
    for rec in shot.units:
        if rec['parts'][0][0] == ob:
            return rec
    raise KeyError(ob.name)


def turrets(shot, ob):
    """Drehtuerme einer Einheit / turrets of a unit"""
    return unit_rec(shot, ob)['turrets']


def aim(shot, ob, target, index=0):
    """
    Turm index der Einheit auf einen Weltpunkt drehen (nur um die Hochachse, innerhalb der Schwenkgrenze des Modells).
    Turn turret index of the unit towards a world point (about the vertical axis only, within the model's traverse limit).
    """
    rec = unit_rec(shot, ob)
    if index >= len(rec['turrets']):
        return
    tur = rec['turrets'][index]
    part = rec['data']['parts'][index + 1]
    local = _world(ob).inverted() @ Vector(target) - tur.location
    # das Rohr zeigt in Ruhe nach -y (three: +z) / at rest the barrel points along -y (three: +z)
    a = math.atan2(local.x, -local.y)
    if part['arc'] is not None:
        rest = part['yaw']
        dlt = (a - rest + math.pi) % (2 * math.pi) - math.pi
        a = rest + max(-part['arc'], min(part['arc'], dlt))
    tur.rotation_euler = Euler((0, 0, a))


def unit_point(ob, p):
    """Modellpunkt (three-Koordinaten des Spiels) als Weltpunkt / model point (the game's three coordinates) as a world point"""
    return _world(ob) @ Vector(to_blender(p))


def _world(ob):
    """Weltmatrix aus Ort, Drehung, Groesse der Elternkette (ohne Auswertung der Szene) / world matrix from the parent chain (without evaluating the scene)"""
    m = ob.matrix_basis.copy()
    while ob.parent is not None:
        ob = ob.parent
        m = ob.matrix_basis @ m
    return m


def _smooth(a, b, x):
    t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)


def units_refresh(shot, t=0.0):
    """
    Je Bild: Linienbreiten der gezeichneten Einheiten fuer die aktuelle Kamera, Kantenbreite der Tusche, Leuchtschalter
    an die Teile weitergeben, bewegliche Teile drehen.
    Umriss wie ink.ts: Breite 0.018 Feldbreiten mal Schwankung (0.25 .. 1.75), begrenzt auf INK_MIN_PX .. INK_MAX_PX.
    Innenlinien: halbe Breite 0.0021 Feldbreiten mal Gewicht, nie unter einem halben Bildpunkt, darunter ausgeblendet.
    Per frame: line widths of the inked units for the current camera, edge width of the ink, pass the glow switch on to
    the parts, turn the moving parts.
    Silhouette as ink.ts: width 0.018 tile widths times waver (0.25 .. 1.75), limited to INK_MIN_PX .. INK_MAX_PX.
    Inner lines: half width 0.0021 tile widths times weight, never below half a pixel, faded out below that.
    """
    if not shot.units and not shot.spinners:
        return
    st = style()
    cam = shot.cam.location
    for rec in shot.units:
        root = rec['parts'][0][0]
        glowoff = float(root.get('glowoff', 0.0))
        for fill, line, mod in rec['parts']:
            mw = _world(fill)
            sc = max(1e-6, mw.to_scale().x)
            dist = max(1.0, (mw.translation - cam).length)
            px = shot.px(dist)
            width = st['outline'] * TILE * sc
            lo = min(max(0.25 * width, INK_MIN_PX * px), INK_MAX_PX * px)
            hi = min(max(1.75 * width, INK_MIN_PX * px), INK_MAX_PX * px)
            wpx = 2 * st['creaseHalfWidth'] * TILE * sc / px
            rr = max(wpx, 0.5) * _smooth(0.16, 0.62, wpx) / max(wpx, 1e-6)
            ins = mod.properties.inputs
            for sock, v in zip(_ink_sockets(), (lo / sc, (hi - lo) / sc, rr)):
                getattr(ins, sock).value = float(v)
            line.update_tag()
            # Kantenbreite der Tusche im Abstandsfeld: Feldwert je Bildpunkt (wie fwidth im Spiel)
            # edge width of the ink in the distance field: field value per pixel (like fwidth in the game)
            # (je ausgegebenem Bildpunkt: bei hoeherer Aufloesung bleibt die Kante einen Bildpunkt breit und wird schaerfer)
            # (per output pixel: at a higher resolution the edge stays one pixel wide and gets sharper)
            fill['inkw'] = float(min(0.5, st['ref'] / (2.0 * st['sdfRange']) * INK_SOFT * shot.px_out(dist) / (TILE * sc)))
            fill['glowoff'] = glowoff
            fill.update_tag()
    for ob, tp, base, phase in shot.spinners:
        if tp['kind'] == 'rotor':
            ob.rotation_euler = Euler((0, 0, phase + t * 26 * tp['dir']))
        else:
            # Messdrohne: kleiner Kreis mit Auf und Ab / survey drone: small circle with a bob
            ob.location = base + Vector((math.sin(t * 0.9 + phase) * 0.5, -math.cos(t * 0.9 + phase) * 0.5, math.sin(t * 2.1 + phase) * 0.2)) * tp['scale']
            ob.rotation_euler = Euler((0, 0, t * 0.9 + phase))


_SOCK = None


def _ink_sockets():
    global _SOCK
    if _SOCK is None:
        g = _ink_geo()
        by = {it.name: it.identifier for it in g.interface.items_tree if getattr(it, 'in_out', '') == 'INPUT'}
        _SOCK = (by['A'], by['B'], by['R'])
    return _SOCK


# ---------- Grundformen / primitives ----------
def mesh_obj(shot, name, verts, faces, mat, loc=(0, 0, 0), ink=False, px=2.4, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    if ink:
        _ink_shared(shot, ob, px)
    return ob


def prim(shot, kind, mat, loc=(0, 0, 0), size=1.0, rot=(0, 0, 0), ink=True, px=3.6, segments=12, smooth=False, **kw):
    """Grundform ueber bmesh, ohne Operator-Kontext / primitive via bmesh, without operator context"""
    import bmesh
    bm = bmesh.new()
    if kind == 'cube':
        bmesh.ops.create_cube(bm, size=1.0)
    elif kind == 'ico':
        bmesh.ops.create_icosphere(bm, subdivisions=kw.get('sub', 1), radius=0.5)
    elif kind == 'uv':
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=max(4, segments // 2), radius=0.5)
    elif kind == 'cyl':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=0.5, radius2=kw.get('top', 0.5), depth=1.0)
    elif kind == 'cone':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=0.5, radius2=0.0, depth=1.0)
    elif kind == 'plane':
        bmesh.ops.create_grid(bm, x_segments=kw.get('sub', 1), y_segments=kw.get('sub', 1), size=0.5)
    elif kind == 'torus':
        r1, r2 = 0.5, kw.get('tube', 0.06)
        verts = []
        segs, tubes = segments * 2, 6
        for i in range(segs):
            a = 2 * math.pi * i / segs
            for j in range(tubes):
                b = 2 * math.pi * j / tubes
                verts.append(bm.verts.new(((r1 + r2 * math.cos(b)) * math.cos(a), (r1 + r2 * math.cos(b)) * math.sin(a), r2 * math.sin(b))))
        for i in range(segs):
            for j in range(tubes):
                a = i * tubes + j
                b_ = ((i + 1) % segs) * tubes + j
                c = ((i + 1) % segs) * tubes + (j + 1) % tubes
                d = i * tubes + (j + 1) % tubes
                bm.faces.new((verts[a], verts[b_], verts[c], verts[d]))
    me = bpy.data.meshes.new(kind)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(kind, me)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = Euler(rot)
    ob.scale = (size, size, size) if isinstance(size, (int, float)) else size
    if ink:
        _ink_shared(shot, ob, px)
    return ob


def ground(shot, color, size=400, sub=60, height=None, loc=(0, 0, 0), ink=False, name='ground'):
    """Gelaende als Gitter mit Hoehenfunktion height(x, y) / terrain as a grid with height function height(x, y)"""
    n = sub
    verts, faces = [], []
    for j in range(n + 1):
        for i in range(n + 1):
            x = (i / n - 0.5) * size
            y = (j / n - 0.5) * size
            verts.append((x, y, height(x + loc[0], y + loc[1]) if height else 0.0))
    for j in range(n):
        for i in range(n):
            a = j * (n + 1) + i
            faces.append((a, a + 1, a + n + 2, a + n + 1))
    mat = toon(shot, color) if isinstance(color, (str, tuple)) else color
    return mesh_obj(shot, name, verts, faces, mat, loc=loc, ink=ink)


# ---------- Himmel / sky ----------
def sky(shot, stops, stars=0.0, star_col='starWarm'):
    """
    Himmel nur fuer Kamerastrahlen (Verlauf nach Hoehe), Licht kommt nur von der Sonne.
    Sky for camera rays only (gradient by height), light only comes from the sun.
    stops: [(pos -1..1, Farbe)], pos = z der Blickrichtung / pos = z of the view direction
    """
    w = bpy.data.worlds.new('sky')
    shot.sc.world = w
    # der Himmel beleuchtet nichts: keine Sonne aus dem Himmel ableiten (spart je Bild rund eine Sekunde)
    # the sky lights nothing: derive no sun from the sky (saves about a second per frame)
    w.use_sun_shadow = False
    w.probe_resolution = '128'
    nt, n, L = _nodes(w)
    out = n.new('ShaderNodeOutputWorld')
    tc = n.new('ShaderNodeTexCoord')
    sep = n.new('ShaderNodeSeparateXYZ')
    norm = n.new('ShaderNodeVectorMath')
    norm.operation = 'NORMALIZE'
    L.new(tc.outputs['Generated'], norm.inputs[0])
    L.new(norm.outputs[0], sep.inputs[0])
    mr = n.new('ShaderNodeMapRange')
    mr.inputs[1].default_value = -1
    mr.inputs[2].default_value = 1
    L.new(sep.outputs[2], mr.inputs[0])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.name = 'ramp'
    cr = ramp.color_ramp
    stops = [((p + 1) / 2, rgb(c) if isinstance(c, str) else c) for p, c in stops]
    cr.elements[0].position, cr.elements[0].color = stops[0]
    cr.elements[1].position, cr.elements[1].color = stops[-1]
    for p, c in stops[1:-1]:
        e = cr.elements.new(p)
        e.color = c
    L.new(mr.outputs[0], ramp.inputs[0])
    col = ramp.outputs[0]
    if stars:
        vor = n.new('ShaderNodeTexVoronoi')
        vor.feature = 'F1'
        vor.inputs['Scale'].default_value = 90
        L.new(norm.outputs[0], vor.inputs['Vector'])
        th = n.new('ShaderNodeMath')
        th.operation = 'LESS_THAN'
        th.inputs[1].default_value = 0.035
        L.new(vor.outputs['Distance'], th.inputs[0])
        up = n.new('ShaderNodeMath')
        up.operation = 'MULTIPLY'
        up.name = 'stars'
        up.inputs[1].default_value = stars
        L.new(th.outputs[0], up.inputs[0])
        mx = n.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        L.new(up.outputs[0], mx.inputs['Factor'])
        L.new(col, mx.inputs[6])
        mx.inputs[7].default_value = rgb(star_col)
        col = mx.outputs[2]
    bg = n.new('ShaderNodeBackground')
    L.new(col, bg.inputs[0])
    dark = n.new('ShaderNodeBackground')
    dark.inputs[0].default_value = (0, 0, 0, 1)
    lp = n.new('ShaderNodeLightPath')
    ms = n.new('ShaderNodeMixShader')
    L.new(lp.outputs['Is Camera Ray'], ms.inputs[0])
    L.new(dark.outputs[0], ms.inputs[1])
    L.new(bg.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs[0])
    return w


def sky_ramp(shot):
    return shot.sc.world.node_tree.nodes['ramp'].color_ramp


# ---------- Effekte / effects ----------
class Puffs:
    """Comic-Rauch: Kugeln, die wachsen, steigen und verblassen (schrumpfen) / comic smoke: balls that grow, rise and fade (shrink)"""

    def __init__(self, shot, n, color, origin, spread=3.0, rise=6.0, size=(1.5, 4.0), life=3.0, seed=1, wind=(0, 0, 0), px=2.0, glow=0.0, start=0.0, rate=None):
        R = random.Random(seed)
        self.items = []
        mat = toon(shot, color, glow=glow)
        # Huelle relativ zur spaeteren Groesse / hull relative to the later size
        px_eff = px / max(1.0, (size[0] + size[1]) / 2)
        for i in range(n):
            ob = prim(shot, 'ico', mat, loc=origin, size=1, sub=1, px=px_eff, ink=True)
            off = Vector((R.uniform(-spread, spread), R.uniform(-spread, spread), R.uniform(0, spread * 0.3)))
            birth = start + i * life / n
            self.items.append((ob, off, birth, R.uniform(*size), R.uniform(0.7, 1.3), R.uniform(0, 6.28)))
        self.origin, self.rise, self.life, self.wind = Vector(origin), rise, life, Vector(wind)

    def update(self, t):
        for ob, off, birth, sz, sp, ph in self.items:
            age = (t - birth) % self.life if t >= birth else -1
            if age < 0:
                ob.scale = (0.001,) * 3
                continue
            p = age / self.life
            s = sz * math.sin(min(1.0, p * 1.4) * math.pi * 0.5) * (1 - seg(p, 0.75, 1.0))
            ob.scale = (max(s, 0.001),) * 3
            ob.location = self.origin + off * (0.5 + p) + Vector((0, 0, self.rise * p * sp)) + self.wind * p
            ob.rotation_euler = Euler((ph + p, ph * 0.5, ph + p * 2))


def ring(shot, mat, loc, radius=1.0, tube=0.06, rot=(0, 0, 0), ink=True):
    return prim(shot, 'torus', mat, loc=loc, size=radius * 2, rot=rot, ink=ink, segments=24, tube=tube)


def beam(shot, mat, a, b, radius=1.0, segments=10, ink=True, px=2.0):
    """Zylinder von a nach b / cylinder from a to b"""
    a, b = Vector(a), Vector(b)
    d = b - a
    ob = prim(shot, 'cyl', mat, loc=(a + b) / 2, size=(radius * 2, radius * 2, d.length), segments=segments, ink=ink, px=px)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob


def set_beam(ob, a, b, radius):
    a, b = Vector(a), Vector(b)
    d = b - a
    ob.location = (a + b) / 2
    ob.scale = (radius * 2, radius * 2, max(d.length, 0.001))
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()


def cam_plane(shot, mat, dist=1.0, scale=1.0, name='overlay'):
    """Flaeche vor der Kamera, fuellt das Bild / plane in front of the camera, fills the frame"""
    w = shot.px(dist) * shot.w * scale
    h = w * shot.h / shot.w
    ob = mesh_obj(shot, name, [(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)], [(0, 1, 2, 3)], mat)
    ob.parent = shot.cam
    ob.location = (0, 0, -dist)
    return ob


def speed_lines(shot, n=40, dist=2.0, seed=3, inner=0.35, color='ink'):
    """Radiale Speedlines als Dreiecke vor der Kamera / radial speed lines as triangles in front of the camera"""
    R = random.Random(seed)
    w = shot.px(dist) * shot.w
    h = w * shot.h / shot.w
    verts, faces = [], []
    rmax = math.hypot(w, h) * 0.6
    for i in range(n):
        a = 2 * math.pi * i / n + R.uniform(-0.05, 0.05)
        da = R.uniform(0.004, 0.012)
        r0 = rmax * (inner + R.uniform(0, 0.25))
        k = len(verts)
        verts += [(math.cos(a) * r0 * w / rmax / 0.6 * 0.5, math.sin(a) * r0 * h / rmax / 0.6 * 0.5, 0),
                  (math.cos(a - da) * rmax, math.sin(a - da) * rmax, 0), (math.cos(a + da) * rmax, math.sin(a + da) * rmax, 0)]
        faces.append((k, k + 1, k + 2))
    ob = mesh_obj(shot, 'speed', verts, faces, flat(color))
    ob.parent = shot.cam
    ob.location = (0, 0, -dist)
    return ob


def text_obj(shot, body, size=1.0, extrude=0.1, color='hazard', font='bangers', loc=(0, 0, 0), rot=(math.pi / 2, 0, 0), align='CENTER', ink=True, px=3.0):
    cu = bpy.data.curves.new('txt', 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = extrude * 0.25
    cu.align_x = align
    cu.align_y = 'CENTER'
    path = font_path(font)
    if path:
        cu.font = bpy.data.fonts.load(path)
    ob = bpy.data.objects.new('txt', cu)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = Euler(rot)
    # in ein Mesh umwandeln, damit die Huelle funktioniert / convert to a mesh so the hull works
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    me.materials.append(toon(shot, color))
    ob = bpy.data.objects.new('txt', me)
    shot.sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = Euler(rot)
    if ink:
        _ink_shared(shot, ob, px)
    return ob


def font_path(name):
    """Schrift aus @fontsource (woff) als TTF in den Cache / font from @fontsource (woff) as TTF in the cache"""
    out = cache_file(name + '.ttf')
    if os.path.exists(out):
        return out
    for base in (os.path.join(ROOT, 'node_modules'), os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(ROOT))), 'node_modules')):
        src = os.path.join(base, '@fontsource', name, 'files', '%s-latin-400-normal.woff' % name)
        if os.path.exists(src):
            try:
                from fontTools.ttLib import TTFont
                f = TTFont(src)
                f.flavor = None
                f.save(out)
                return out
            except Exception as e:  # noqa: BLE001
                print('font', e)
    return None


def hide(ob, hidden):
    ob.hide_render = hidden
    for c in ob.children_recursive:
        c.hide_render = hidden


def film():
    """Zeitleiste des Films (gemeinsam mit dem Spiel) / film timeline (shared with the game)"""
    with open(os.path.join(ROOT, 'src', 'intro', 'film.json')) as fh:
        return json.load(fh)


def shot_dur(shot_id):
    for s in film()['shots']:
        if s['id'] == shot_id:
            return s['end'] - s['start']
    raise KeyError(shot_id)
