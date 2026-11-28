"""
Kontrollbogen der Filmfiguren (Anime-Schnitt): FV_SHEET = turn (Brodnik von vier Seiten), poses (vier Posen),
hands (Haende gross), face (Gesicht gross), motion (Bewegungsprobe: Arm hebt sich, Kopf dreht, Atmen, Blinzeln).
Check sheet of the film figures (anime cut): FV_SHEET = turn (Brodnik from four sides), poses (four poses), hands
(hands large), face (face large), motion (motion proof: the arm rises, the head turns, breathing, a blink).
"""
import math
import os

from mathutils import Vector

from ... import anime as A
from ... import korvat as K
from ... import figure as F
from ... import lib as L
from ... import poses as P

KIND = os.environ.get('FV_SHEET', 'turn')
PIECES = ['fig_korvat_body', 'fig_korvat_head', 'fig_korvat_cape']
FACES = ['fig-korvat-head', 'fig-korvat-head-narrow', 'fig-korvat-head-blink']


def stage(dur=1.0):
    s = L.Shot(dur)
    s.toon.day()
    rot, sdir = A.sun_rot(140.0, 42.0)
    s.sunlight(rot=tuple(rot))
    L.sky(s, [(-1, 'paper100'), (1, 'paper50')])
    L.ground(s, 'paper100', size=60, sub=2)
    return s


def build():
    wind = F.Wind(direction=(-0.7, 0, -0.7), strength=0.35, wave=0.07)
    if KIND == 'turn':
        s = stage()
        for i, rot in enumerate((0, 50, 90, 180)):
            f = F.Figure(s, PIECES, loc=((i - 1.5) * 1.5, 0, 0), rot=rot, wind=wind)
            f.set_pose(P.STAND)
            f.update(0.3)
        s.cam.data.lens = 70
        s.look((0, -13.5, 1.15), (0, 0, 1.02))
    elif KIND == 'poses':
        s = stage()
        for i, (pose, rot) in enumerate(((P.STAND, 20), (P.KORVAT_READY, 12), (P.KORVAT_POINT, 12), (P.SALUTE, -20), (P.KORVAT_COMMAND, 15))):
            f = F.Figure(s, PIECES, loc=((i - 2) * 1.75, 0, 0), rot=rot, wind=wind)
            f.set_pose(pose)
            f.update(0.3 + i)
            # Fels unter dem hoeheren Fuss / rock under the higher foot
            for side in 'LR':
                p = f.world('ball' + side)
                if p.z > 0.12:
                    c = (p + f.world('heel' + side)) * 0.5
                    K.facet_rock(s, (c.x, c.y, c.z - 0.78 * (c.z / 0.78 + 0.1)), (0.5, 0.42, c.z / 0.78 + 0.1), A.lin(A.cmix('rock400', 'khaki500', 0.3)), seed=3 + i, px=2.0)
        s.cam.data.lens = 70
        s.look((0, -16.5, 1.25), (0, 0, 1.05))
    elif KIND in ('hands', 'face', 'half', 'one'):
        s = stage()
        f = F.Figure(s, PIECES, loc=(0, 0, 0), rot=float(os.environ.get('FV_ROT', '-25')), wind=wind)
        f.set_pose(getattr(P, os.environ.get('FV_POSE', 'KORVAT_POINT')))
        f.update(0.3)
        for side in 'LR':
            p = f.world('ball' + side)
            if p.z > 0.12:
                c = (p + f.world('heel' + side)) * 0.5
                K.facet_rock(s, (c.x, c.y, c.z - 0.78 * (c.z / 0.78 + 0.1)), (0.5, 0.42, c.z / 0.78 + 0.1), A.lin(A.cmix('rock400', 'khaki500', 0.3)), seed=3, px=2.0)
        s.cam.data.lens = 85
        if KIND == 'hands':
            side = os.environ.get('FV_SIDE', 'L')
            tip = f.world('grip' + side)
            s.look(tip + Vector((0.5, -1.9, 0.25)), tip)
        elif KIND == 'face':
            e = f.world('eyes')
            s.look(e + Vector((0.15, -1.9, 0.0)), e + Vector((0, 0, -0.02)))
        elif KIND == 'one':
            s.cam.data.lens = 70
            s.look((0.4, -7.6, 1.2), (0, 0, 1.04))
        else:
            e = f.world('eyes')
            s.look(e + Vector((0.6, -5.2, -0.3)), e + Vector((0, 0, -0.55)))
    elif KIND == 'army':
        # Reiter, Pferd, Banner, Posten nebeneinander / riders, horse, banner, sentry side by side
        from ... import army as AR
        s = stage()
        kind = os.environ.get('FV_GAIT', 'gallop')
        w2 = F.Wind(direction=(0, 0, -1), strength=0.3, wave=0.1)
        for i, kit in enumerate(('fig_korvat_rider', 'fig_korvat_lancer', 'fig_korvat_officer')):
            m = AR.Mounted(s, kit, loc=((i - 1.6) * 3.1, 0.6 * i, 0), rot=90 - 12 * i, wind=w2)
            m.pose(kind if i else 'stand', 0.13 + 0.3 * i)
        bn = AR.Banner(s, loc=(5.0, 0.5, 0), rot=180)
        bn.update(0.4)
        g = F.Figure(s, ['fig_korvat_guard'], loc=(6.1, -0.2, 0), rot=20, height=1.8)
        g.set_pose(P.GUARD)
        g.update(0)
        ld = F.Figure(s, PIECES, loc=(7.5, -0.2, 0), rot=10, wind=wind)
        ld.set_pose(P.STAND)
        ld.update(0.2)
        s.cam.data.lens = 50
        s.look((1.6, -15.5, 1.9), (1.6, 0, 1.25))
    else:
        # Bewegungsprobe (4 s) / motion proof (4 s)
        s = stage(4.0)
        f = F.Figure(s, PIECES, loc=(0, 0, 0), rot=12, wind=F.Wind(direction=(-0.9, 0, -0.44), strength=0.6, wave=0.1))
        f.layer(P.breathe(1.0))
        f.layer(P.sway(0.6))
        f.face_setup('fig_korvat_head', FACES)
        f.face([(0.0, FACES[2], 0.0), (0.45, FACES[2], 0.0), (0.5, FACES[2], 1.0), (0.6, FACES[2], 1.0), (0.66, FACES[2], 0.0),
                (2.4, FACES[1], 0.0), (2.6, FACES[1], 1.0)])
        f.set_pose(P.KORVAT_POINT)
        f.update(0)
        c = (f.world('ballL') + f.world('heelL')) * 0.5
        K.facet_rock(s, (c.x, c.y, c.z - 0.78 * (c.z / 0.78 + 0.1)), (0.5, 0.42, c.z / 0.78 + 0.1), A.lin(A.cmix('rock400', 'khaki500', 0.3)), seed=5, px=2.0)
        f.track([(0.0, P.KORVAT_READY), (0.7, P.KORVAT_READY), (1.6, P.KORVAT_POINT, L.ease_io), (4.0, P.KORVAT_POINT)])
        s.cam.data.lens = 60
        s.look((1.2, -7.0, 1.3), (0.1, 0, 1.08))
        s.on(f.update)
    return s
