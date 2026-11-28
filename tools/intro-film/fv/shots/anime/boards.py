"""
Grobe Storyboard-Bilder des Anime-Schnitts (Blockout: flache Farben, Grundformen, vorhandene Modelle). FV_BOARD waehlt
das Bild: a02 (Hafen Meridons), b03 (Verteilungskriege), c01 (Gruendung Verdans), d05 (das Wrack), e2 (Dravon),
e3 (Velkar), e5 (Meridon), f02 (Wettlauf), f03 (Front und Titel). Anfuehrer ohne ganze Figur stehen als Platzhalter da:
ihre Bueste auf einem Koerper aus Grundformen.
Rough storyboard frames of the anime cut (blockout: flat colours, primitives, existing models). FV_BOARD picks the
frame. Leaders without a full figure stand in as placeholders: their bust on a body of primitives.
"""
import math
import os
import random

from mathutils import Vector

from ... import anime as A
from ... import kit as K
from ... import lib as L

BOARD = os.environ.get('FV_BOARD', 'a02')


def stand_in(s, f, loc, rot, scale, arm=(0.0, 0.0)):
    """
    Platzhalter-Figur: Bueste des Spiels oben, Beine, Mantel und Arme als Grundformen in den Fraktionsfarben.
    Placeholder figure: the game's bust on top, legs, coat and arms as primitives in the faction colours.
    """
    k = L.TILE * scale
    a = math.radians(rot)
    fwd = Vector((math.sin(-a) * -1, -math.cos(a), 0))
    z0 = loc[2] + 2.05 * k
    L.model(s, 'leader_%s' % f, loc=(loc[0], loc[1], z0), rot=rot, scale=scale)
    prim, sec = L.fac(f), L.fac(f, 'secondary')
    m1, m2 = L.toon(s, prim), L.toon(s, L.mix(sec, (0.05, 0.05, 0.06, 1), 0.5))
    side = Vector((math.cos(a), math.sin(a), 0))
    for sgn in (-1, 1):
        p = Vector(loc) + side * sgn * 0.16 * k
        L.prim(s, 'cyl', m2, loc=(p.x, p.y, loc[2] + 1.0 * k), size=(0.22 * k, 0.22 * k, 2.0 * k), segments=10)
        # Arme: haengend oder zeigend / arms: hanging or pointing
        sh = Vector((loc[0], loc[1], z0 + 0.28 * k)) + side * sgn * 0.42 * k
        lift = arm[0] if sgn > 0 else arm[1]
        d = (Vector((0, 0, -1)) * (1 - lift) + (fwd * 0.6 + side * sgn * 0.4) * lift).normalized()
        L.beam(s, m1, sh, sh + d * 0.9 * k, radius=0.08 * k, segments=10)
    # Rock bis zum Knie / skirt down to the knee
    L.prim(s, 'cyl', m1, loc=(loc[0], loc[1], z0 - 0.35 * k), size=(0.86 * k, 0.5 * k, 0.75 * k), segments=16, top=0.42)
    return z0


def sky_simple(s, grad, sun=(30, 5), glow=None, clouds=None, cols=None, smoke=None, land=None, name='sky', centre=(0, 0, 0), rays=0.0):
    spec = A.SkySpec(w=2048, h=896, az=(-80, 80), el=(-6, 50), sun=sun, grad=grad, glow=glow, rays=rays,
                     clouds=clouds or [], cloud_cols=cols or (A.hexc('smoke400'), A.hexc('smoke300'), A.hexc('cloud300'), A.hexc('cloud100')),
                     smoke=smoke, land=land or [], seed=7)
    return A.cyclorama(s, spec, centre, radius=3000, name='board_' + name)


def flat_ground(s, h, col, size=2400, sub=120, loc=(0, 0)):
    c = col if isinstance(col, str) or len(col) == 4 else A.lin(col)
    return L.ground(s, L.toon(s, c), size=size, sub=sub, height=h, loc=(loc[0], loc[1], 0))


def build():
    s = L.Shot(4)
    R = random.Random(5)
    s.cam.data.clip_end = 6000
    b = BOARD
    if b == 'a02':
        # Hafen Meridons in der goldenen Daemmerung: Bank mit Kuppel, Schiffe, Kraene / Meridon's harbour at golden dusk
        s.toon.set_light(A.lin(A.cmix('sky700', 'sunDusk', 0.4)), A.lin(A.cmix('sunDusk', 'skyMid', 0.2)), A.lin(A.cmix('paper50', 'yellow400', 0.3)))
        rot, d = A.sun_rot(-30, 12)
        s.sunlight(rot=tuple(rot))
        sky_simple(s, [(-6, 'hazeDusk'), (2, A.cmix('yellow400', 'sunDusk', 0.5)), (14, 'sunDusk'), (35, A.cmix('skyMid', 'sunDusk', 0.3)), (50, 'sky700')],
                   sun=(-28, 3), glow=(A.hexc('sunDusk'), A.hexc('flash100')),
                   clouds=[{'at': (10, 9), 'w': 60, 'h': 5, 'n': 30, 'size': 2.4, 'tone': 0.4}],
                   cols=(A.cmix('skyMid', 'sunDusk', 0.4), A.cmix('sunDusk', 'orange500', 0.3), A.cmix('yellow400', 'flash100', 0.4), A.hexc('flash100')), name='a02')
        sea = K.Sea(s, size=3000, sub=60, color='sea', amp=0.6, loc=(0, 500, 0))
        L.ground(s, 'verdanStone', size=600, sub=4, loc=(0, 820, 1.5))
        for i in range(-5, 6):
            L.model(s, 'city_meridon_5', loc=(i * 34, 840 + abs(i) * 6, 1.5), rot=R.uniform(0, 360), scale=3.2)
        L.model(s, 'trading_post_meridon', loc=(0, 760, 1.5), scale=6)
        for x, y in ((-110, 650), (60, 600), (150, 690)):
            L.model(s, 'battleship_meridon', loc=(x, y, 0.5), rot=R.uniform(60, 120), scale=3)
        s.cam.data.lens = 32
        s.look((-30, 560, 18), (0, 840, 40))
    elif b == 'b03':
        # Verteilungskriege: Staub, Rauch, Wracks, Silhouetten im Gegenlicht / distribution wars: dust, smoke, wrecks, silhouettes against the light
        s.toon.set_light(A.lin(A.cmix('ink800', 'mud700', 0.5)), A.lin(A.cmix('mud500', 'smoke700', 0.4)), A.lin(A.cmix('dust300', 'mud500', 0.3)))
        rot, d = A.sun_rot(0, 8)
        s.sunlight(rot=tuple(rot))
        sky_simple(s, [(-6, 'dust300'), (3, A.cmix('dust300', 'fire400', 0.3)), (14, A.cmix('mud500', 'smoke700', 0.4)), (50, 'smoke700')], sun=(4, 6),
                   glow=(A.cmix('dust300', 'fire400', 0.5), A.hexc('flash100')),
                   clouds=[{'at': (-30, 6), 'w': 50, 'h': 14, 'n': 40, 'size': 3, 'tone': 0.5}, {'at': (40, 4), 'w': 40, 'h': 18, 'n': 40, 'size': 3, 'tone': 0.8}],
                   cols=(A.hexc('smoke700'), A.cmix('smoke400', 'mud500', 0.5), A.cmix('dust300', 'smoke400', 0.4), A.hexc('fire400')), name='b03')
        flat_ground(s, K.hills(3, 0.01, 2), A.cmix('mud500', 'dust300', 0.4))
        fs = ['korvat', 'dravon', 'velkar', 'meridon', 'alvenia']
        for i in range(10):
            L.model(s, 'hulk_tank_%s' % fs[i % 5], loc=(R.uniform(-120, 120), R.uniform(80, 300), 0), rot=R.uniform(0, 360), scale=2.2, tint=('rust', 0.6, 'wash'))
        for i in range(24):
            f = fs[i % 5]
            L.model(s, 'infantry_%s' % f, loc=(R.uniform(-60, 60), R.uniform(40, 90), 0), rot=R.uniform(0, 360), scale=2.0)
        for i in range(5):
            L.Puffs(s, 8, 'smoke', (R.uniform(-150, 150), R.uniform(150, 400), 0), spread=8, rise=60, size=(10, 25), life=6, seed=i).update(3)
        s.cam.data.lens = 28
        s.look((0, -10, 4), (0, 100, 12))
    elif b == 'c01':
        # Gruendung: fuenf Banner werden im Morgenlicht auf einem Huegel gehisst / founding: five banners raised on a hill at dawn
        s.toon.set_light(A.lin(A.cmix('sky700', 'skyDawn', 0.5)), A.lin(A.cmix('skyDawn', 'grass500', 0.2)), A.lin(A.cmix('paper50', 'sunDawn', 0.3)))
        rot, d = A.sun_rot(0, 10)
        s.sunlight(rot=tuple(rot))
        sky_simple(s, [(-6, 'hazeDay'), (2, 'sunDawn'), (12, 'skyDawn'), (30, A.cmix('skyDawn', 'water300', 0.4)), (50, 'water500')], sun=(0, 4),
                   glow=(A.hexc('sunDawn'), A.hexc('flash100')), rays=0.6, name='c01')

        def hh(x, y):
            return 14 * math.exp(-(x * x + (y - 120) ** 2) / 4000.0)
        flat_ground(s, hh, A.cmix('grass500', 'steppe300', 0.3))
        for i, f in enumerate(['korvat', 'alvenia', 'dravon', 'velkar', 'meridon']):
            x = (i - 2) * 12
            K.flag(s, {'korvat': 'korvatRed', 'alvenia': 'alveniaBlue', 'dravon': 'dravonCamo', 'velkar': 'velkarGreen', 'meridon': 'meridonTeal'}[f],
                   (x, 120 - abs(i - 2) * 4, hh(x, 120)), w=8, h=5, pole=22)[1](1.0, 1.4)
            L.model(s, 'infantry_%s' % f, loc=(x + 1.5, 116 - abs(i - 2) * 4, hh(x, 116)), rot=180, scale=2.2)
        K.flag(s, 'verdanRed', (0, 126, hh(0, 126)), w=14, h=8, pole=34)[1](1.0, 1.0)
        s.cam.data.lens = 28
        s.look((0, 40, 3), (0, 120, 22))
    elif b == 'd05':
        # Morgen nach dem Absturz: der rauchende Rumpf im Krater, winzige Spaeher am Rand / morning after the crash
        s.toon.set_light(A.lin(A.cmix('zyrrViolet', 'sky700', 0.5)), A.lin(A.cmix('desert300', 'zyrrViolet', 0.3)), A.lin(A.cmix('paper50', 'sunDawn', 0.4)))
        rot, d = A.sun_rot(-60, 9)
        s.sunlight(rot=tuple(rot))
        sky_simple(s, [(-6, 'hazeDusk'), (2, 'sunDawn'), (12, A.cmix('skyDawn', 'zyrrViolet', 0.3)), (50, A.cmix('zyrrViolet', 'sky800', 0.5))], sun=(-55, 3),
                   glow=(A.hexc('sunDawn'), A.hexc('flash100')),
                   smoke={'base': (8, 0.5), 'height': 30, 'lean': -10, 'r0': 2, 'r1': 8, 'col': (A.hexc('smoke700'), A.cmix('smoke400', 'sunDawn', 0.4)), 'glow': A.cmix('zyrrViolet', 'flash100', 0.4)}, name='d05')
        flat_ground(s, K.dunes(5), A.cmix('desert300', 'sand300', 0.4))
        L.model(s, 'crash_site_0', loc=(0, 320, 0), rot=20, scale=24)
        for i in range(5):
            L.model(s, 'jeep_korvat' if i % 2 else 'infantry_dravon', loc=(-30 + i * 7, 120, K.dunes(5)(-30 + i * 7, 120)), rot=200, scale=2.0)
        s.cam.data.lens = 35
        s.look((-40, 40, 14), (0, 320, 30))
    elif b == 'e2':
        # Dravon: Festungsmauer bei Nacht, Regen, Scheinwerfer, Voss als Platzhalter-Figur, Truppen im Hof / Dravon fortress at night
        s.toon.set_light(A.lin(A.cmix('ink900', 'sky800', 0.5)), A.lin(A.cmix('sky800', 'dravonCamo', 0.3)), A.lin(A.cmix('dravonGold', 'paper50', 0.5)))
        rot, d = A.sun_rot(160, 25)
        s.sunlight(rot=tuple(rot))
        sky_simple(s, [(-6, 'sky900'), (5, 'sky800'), (50, 'ink900')], sun=(170, 20), name='e2')
        flat_ground(s, None, A.cmix('dravonAnthracite', 'mud700', 0.5))
        L.prim(s, 'cube', L.toon(s, 'rock600'), loc=(0, 60, 9), size=(160, 14, 18))
        stand_in(s, 'dravon', (-8, 60, 18), 200, 0.42, arm=(0.0, 0.0))
        for i in range(6):
            for j in range(3):
                L.model(s, 'infantry_dravon', loc=(10 + i * 7, 40 - j * 8, 0), rot=180, scale=2.0)
        for x in (-60, 40):
            L.beam(s, L.flat(A.lin(A.cmix('dravonGold', 'flash100', 0.6)), alpha=0.25), (x, 70, 20), (x * 1.4 + 20, 500, 420), radius=5, ink=False)
        s.cam.data.lens = 28
        s.look((-14, 6, 3), (-2, 60, 24))
    elif b == 'e3':
        # Velkar: Stadt im ewigen Eis unter Polarlicht, Kesh auf einer Bruecke / Velkar: city in the eternal ice under the aurora
        s.toon.set_light(A.lin(A.cmix('sky800', 'velkarIce', 0.3)), A.lin(A.cmix('velkarIce', 'sky700', 0.3)), A.lin(A.cmix('white', 'velkarFrost', 0.3)))
        rot, d = A.sun_rot(30, 20)
        s.sunlight(rot=tuple(rot))
        sky_simple(s, [(-6, 'velkarFrost'), (3, A.cmix('velkarTeal', 'sky800', 0.4)), (16, A.cmix('velkarGreen', 'sky800', 0.5)), (30, 'sky800'), (50, 'sky900')], sun=(30, 30),
                   rays=0.0, name='e3')
        flat_ground(s, K.hills(4, 0.01, 1), 'snow100')
        L.model(s, 'academy_air', loc=(30, 260, 40), rot=0, scale=10)
        for i in range(4):
            L.model(s, 'teslaTank_velkar', loc=(-20 + i * 14, 120, 0), rot=170, scale=2.2)
        L.prim(s, 'cube', L.toon(s, 'velkarIce'), loc=(-10, 60, 10), size=(40, 6, 1.5))
        stand_in(s, 'velkar', (-10, 60, 10.8), 190, 0.42, arm=(0.7, 0.0))
        s.cam.data.lens = 28
        s.look((-26, 20, 4), (5, 120, 22))
    elif b == 'e5':
        # Meridon: offenes Meer bei Sonnenuntergang, Nerezza auf der Bruecke des Schlachtschiffs / Meridon: open sea at sunset
        s.toon.set_light(A.lin(A.cmix('sky700', 'meridonTeal', 0.4)), A.lin(A.cmix('sunDusk', 'meridonTeal', 0.3)), A.lin(A.cmix('paper50', 'meridonOrange', 0.3)))
        rot, d = A.sun_rot(40, 8)
        s.sunlight(rot=tuple(rot))
        sky_simple(s, [(-6, 'sea'), (1, 'meridonOrange'), (10, 'sunDusk'), (30, A.cmix('skyMid', 'meridonTeal', 0.3)), (50, 'sky800')], sun=(40, 2),
                   glow=(A.hexc('meridonOrange'), A.hexc('flash100')), name='e5')
        K.Sea(s, size=3000, sub=60, color='seaDeep', amp=0.8, loc=(0, 600, 0))
        L.model(s, 'battleship_meridon', loc=(40, 160, 0), rot=110, scale=6)
        for i in range(5):
            L.model(s, 'destroyer_meridon', loc=(100 + i * 40, 260 + i * 60, 0), rot=120, scale=3)
        L.prim(s, 'cube', L.toon(s, 'verdanStone'), loc=(-10, 50, 2), size=(30, 14, 4))
        stand_in(s, 'meridon', (-8, 50, 4), 210, 0.4, arm=(0.0, 0.8))
        s.cam.data.lens = 30
        s.look((-26, 14, 6), (8, 90, 16))
    elif b == 'f02':
        # Wettlauf: fuenf Staubfahnen aus fuenf Richtungen auf das rauchende Wrack zu, von oben / race: five dust trails from five directions towards the smoking wreck, from above
        s.toon.set_light(A.lin(A.cmix('mars700', 'sky700', 0.4)), A.lin(A.cmix('desert300', 'mars500', 0.3)), A.lin(A.cmix('paper50', 'desert300', 0.3)))
        rot, d = A.sun_rot(-40, 30)
        s.sunlight(rot=tuple(rot))
        sky_simple(s, [(-6, 'desert300'), (50, 'desert500')], name='f02')
        flat_ground(s, K.dunes(4), A.cmix('desert300', 'sand300', 0.3), size=3000)
        L.model(s, 'crash_site_0', loc=(0, 0, 0), rot=20, scale=18)
        L.Puffs(s, 10, 'smoke', (0, 0, 10), spread=10, rise=120, size=(20, 40), life=6, seed=3).update(4)
        for i, f in enumerate(['korvat', 'dravon', 'velkar', 'alvenia', 'meridon']):
            a = math.radians(i * 72 + 15)
            for k in range(6):
                r = 300 + k * 26
                p = (math.sin(a) * r, math.cos(a) * r)
                L.model(s, 'tank_%s' % f, loc=(p[0], p[1], 0), rot=-math.degrees(a), scale=4.5)
                L.Puffs(s, 3, 'dust300', (p[0] + math.sin(a) * 14, p[1] + math.cos(a) * 14, 0), spread=6, rise=6, size=(6, 12), life=2, seed=i * 10 + k).update(1.5)
        s.cam.data.lens = 28
        s.look((0, -420, 520), (0, 40, 0))
    else:
        # f03: Kartentisch, die Kreidelinie wandert, dahinter der Titel / map table, the chalk line moves, the title behind it
        s.toon.set_light(A.lin(A.cmix('ink800', 'wood', 0.4)), A.lin(A.cmix('wood', 'sunDusk', 0.3)), A.lin(A.cmix('paper50', 'fire400', 0.2)))
        rot, d = A.sun_rot(-50, 35)
        s.sunlight(rot=tuple(rot))
        sky_simple(s, [(-6, 'ink900'), (50, 'ink800')], name='f03')
        L.ground(s, 'plansParchment', size=120, sub=2)
        from .. import chalk as C
        line = C.chalk_line(s, z=0.3, width=1.2, mat=L.toon(s, 'hazard', glow=0.6))
        for o in line:
            o.location.z = 0.3
        L.text_obj(s, 'FRONTVERLAUF', size=7, extrude=1.0, color='hazard', loc=(0, 18, 9), rot=(math.pi / 2, 0, 0))
        for i, f in enumerate(['korvat', 'alvenia', 'dravon', 'velkar', 'meridon']):
            L.model(s, 'tank_%s' % f, loc=((i - 2) * 9, -6, 0), rot=180, scale=1.4)
        s.cam.data.lens = 35
        s.look((0, -46, 26), (0, 10, 4))
    A.haze_all(s, A.hexc('hazeDusk'), start=200, dist=1500, amount=0.6)
    s.update(1.0)
    return s
