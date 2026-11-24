"""
1 Verdan (0-16 s): Nachtflug ueber die Maschinenstadt des Reichs Verdan, Fenster, Suchscheinwerfer, Panzerparade.
Ab 8,4 s der Grosse Stillstand: die Lichter gehen in einer Welle von hinten nach vorne aus, alles steht still.
1 Verdan (0-16 s): night flight over the machine city of the Verdan empire, windows, searchlights, tank parade.
From 8.4 s the Great Standstill: the lights go out in a wave from back to front, everything stands still.
"""
import math
import random

from mathutils import Vector

from .. import lib as L

OFF = 8.4


def build():
    s = L.Shot(L.shot_dur('verdan'))
    R = random.Random(7)
    s.toon.night()
    s.toon.win.outputs[0].default_value = 1.0
    s.sunlight(rot=(1.05, 0.15, 2.6), strength=math.pi * 0.9)
    L.sky(s, [(-1, 'skyNight'), (0.0, 'hazeNight'), (0.12, 'skyNight'), (1, 'space950')], stars=1.0)
    s.look((0, -38, 30), (0, 60, 2))
    night_sky = [tuple(e.color) for e in L.sky_ramp(s).elements]

    L.ground(s, 'asphalt700', size=900, sub=2)
    # Strassen / roads
    L.prim(s, 'cube', L.toon(s, 'asphalt500'), loc=(0, 120, 0.02), size=(14, 400, 0.05), ink=False)

    built = []
    kinds = ['city_neutral_8'] * 5 + ['city_neutral_5'] * 3 + ['city_neutral_3', 'factory_neutral', 'factory_neutral', 'nuclear_neutral', 'verdan_outpost_3']
    for j in range(0, 12):
        for i in range(-4, 5):
            x, y = i * 19.0, 12 + j * 20.0
            if abs(x) < 9:
                continue
            k = R.choice(kinds)
            ob = L.model(s, k, loc=(x + R.uniform(-1.5, 1.5), y, 0), rot=R.choice([0, 90, 180, 270]), scale=R.uniform(1.6, 1.9))
            built.append(ob)
    # Waechtertuerme Verdans am Prachtboulevard / Verdan guard towers along the grand boulevard
    turrets = []
    for j in range(0, 8):
        for side in (-1, 1):
            turrets.append(L.model(s, 'verdan_turret_on', loc=(side * 9.5, 10 + j * 22, 0), rot=90 * side, scale=1.4))
    built += turrets
    # Schornsteine mit Rauch / smokestacks with smoke
    smoke = []
    for (x, y) in [(-38, 40), (44, 70), (-60, 110), (62, 150), (-18, 160)]:
        L.model(s, 'smokestack', loc=(x, y, 0), scale=2.2)
        smoke.append(L.Puffs(s, 6, 'smoke700', (x, y, 9), spread=1.5, rise=14, size=(2.5, 4.5), life=4.0, seed=int(x * 3 + y), wind=(6, 4, 0)))
    # Banner mit Verdan-Farben / banners in Verdan colours
    red, white = L.toon(s, 'verdanRed'), L.toon(s, 'verdanWhite')
    for j in range(0, 6):
        for side in (-1, 1):
            y = 21 + j * 44
            L.prim(s, 'cube', red, loc=(side * 7.4, y, 9), size=(0.3, 3.2, 9))
            L.prim(s, 'cube', white, loc=(side * 7.25, y, 9.5), size=(0.2, 0.9, 6.5), ink=False)
    # Panzerparade in Verdan-Rot / tank parade in Verdan red
    tint = L.toon_attr(s, tint='verdanRed', amount=0.55)
    tanks = [L.model(s, 'tank_korvat', loc=(-3 + (i % 2) * 6, 2 + (i // 2) * 11, 0), rot=180, scale=1.6, mat=tint) for i in range(6)]
    # Kampfmaschinen Verdans (eingefaerbte Titanen) / Verdan war machines (tinted titans)
    white_t = L.toon_attr(s, tint='verdanWhite', amount=0.45)
    titans = [L.model(s, 'titan_nexus', loc=(x, y, 0), rot=180, scale=3.2, mat=white_t) for x, y in ((-5, 48), (5, 66))]
    tanks += titans
    tank0 = [Vector(t.location) for t in tanks]
    # Suchscheinwerfer / searchlights
    beam_mat = L.flat('window300', alpha=0.28, name='searchlight')
    lights = []
    for (x, y, ph) in [(-30, 50, 0.0), (35, 80, 1.7), (-50, 130, 3.1), (55, 160, 4.4), (0, 210, 2.2)]:
        b = L.prim(s, 'cone', beam_mat, loc=(x, y, 0), size=(9, 9, 160), ink=False, segments=16)
        lights.append((b, Vector((x, y, 0)), ph))
    moon = L.prim(s, 'cyl', L.flat('moon300'), loc=(-120, 600, 190), size=(70, 70, 1), rot=(math.radians(80), 0, 0), segments=32, ink=False)
    moon.hide_render = False

    # Abschaltzeit je Gebaeude: Welle von hinten nach vorne / switch-off time per building: wave from back to front
    off_at = {ob.name: OFF + (240 - ob.location.y) / 240 * 2.2 + R.uniform(0, 0.35) for ob in built}

    @s.on
    def update(t):
        p = L.ease_io(L.seg(t, 0, 10.5))
        pos = L.vlerp((0, -38, 30), (0, -4, 21), p)
        tgt = L.vlerp((0, 60, 2), (0, 80, 6), p)
        s.look(pos + L.shake(t, OFF, 0.25, 4), tgt)
        for ob in built:
            v = L.seg(t, off_at[ob.name], off_at[ob.name] + 0.12)
            # kurzes Flackern vor dem Aus / short flicker before going dark
            if 0 < t - off_at[ob.name] + 0.3 < 0.3:
                v = 0.6 if int(t * 24) % 2 else 0.0
            ob['lightsoff'] = v
            ob['glowoff'] = v
            ob.update_tag()
        for i, tk in enumerate(tanks):
            run = min(t, OFF + 0.6)
            tk.location = tank0[i] + Vector((0, 4.2 * run, abs(math.sin(run * 3 + i)) * 0.5 if i >= 6 and t < OFF else 0))
        dark = L.seg(t, OFF, OFF + 1.0)
        for b, base, ph in lights:
            a = t * 0.45 + ph
            tilt = 0.35 + 0.15 * math.sin(t * 0.7 + ph)
            d = Vector((math.sin(a) * math.sin(tilt), math.cos(a) * math.sin(tilt), math.cos(tilt)))
            L.set_beam(b, base + d * 160, base, 9 * (1 - L.seg(t, OFF + 0.2, OFF + 0.7)) + 0.001)
        for sm in smoke:
            sm.update(t)
        s.toon.win.outputs[0].default_value = 1.0
        # nach dem Stillstand dunkler und kaelter / colder and darker after the standstill
        # nach dem Stillstand fast schwarz: nur Umrisse gegen den Mondhimmel / after the standstill almost black: only outlines against the moonlit sky
        s.toon.set_light(L.mix((0.16, 0.17, 0.30, 1), (0.03, 0.03, 0.06, 1), dark), L.mix((0.30, 0.32, 0.50, 1), (0.06, 0.06, 0.12, 1), dark),
                         L.mix((0.55, 0.58, 0.80, 1), (0.17, 0.18, 0.3, 1), dark))
        for ob in tanks:
            ob['glowoff'] = dark
            ob.update_tag()
        cr = L.sky_ramp(s)
        for i, c in enumerate(night_sky):
            cr.elements[i].color = L.mix(c, tuple(x * 0.35 for x in c[:3]) + (1,), dark)

    update(0)
    return s
