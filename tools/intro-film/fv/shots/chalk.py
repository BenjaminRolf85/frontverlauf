"""
3 Kreide (24-32 s): eine alte Karte auf dem Kartentisch, eine Kreidelinie zieht sich als Grenze ueber den Kontinent,
Spielfiguren der fuenf Menschenfraktionen stehen links und rechts der Linie. Auch fracture.py nutzt diese Karte.
3 Chalk (24-32 s): an old map on the map table, a chalk line draws itself across the continent as a border,
game pieces of the five human factions stand on both sides of the line. fracture.py uses this map too.
"""
import math
import random

import bpy
from mathutils import Vector

from .. import lib as L

FACTIONS = ['korvat', 'alvenia', 'dravon', 'velkar', 'meridon']
# Kreidegrenze in Kartenkoordinaten / chalk border in map coordinates
BORDER = [(-34, -26), (-22, -14), (-12, -15), (-4, -3), (6, 0), (10, 10), (20, 14), (24, 24), (36, 28)]


def map_material(shot, tint=None, amount=0.0, name='oldmap'):
    """Alte Karte: Land und Meer aus Rauschen, Kuestenlinie, Gradnetz / old map: land and sea from noise, coastline, grid"""
    m = bpy.data.materials.new(name)
    nt, n, Lk = L._nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    tc = n.new('ShaderNodeTexCoord')
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 0.035
    noise.inputs['Detail'].default_value = 3
    Lk.new(tc.outputs['Object'], noise.inputs['Vector'])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.0, L.rgb('water300', 0.9)
    e[1].position, e[1].color = 0.47, L.rgb('ink')
    e2 = e.new(0.485)
    e2.color = L.rgb('paper50')
    e3 = e.new(0.62)
    e3.color = L.rgb('paper200')
    Lk.new(noise.outputs['Fac'], ramp.inputs[0])
    # Gradnetz / grid lines
    sep = n.new('ShaderNodeSeparateXYZ')
    Lk.new(tc.outputs['Object'], sep.inputs[0])

    def line(axis):
        d = n.new('ShaderNodeMath')
        d.operation = 'PINGPONG'
        d.inputs[1].default_value = 6.0
        Lk.new(sep.outputs[axis], d.inputs[0])
        c = n.new('ShaderNodeMath')
        c.operation = 'LESS_THAN'
        c.inputs[1].default_value = 0.12
        Lk.new(d.outputs[0], c.inputs[0])
        return c.outputs[0]

    mx = n.new('ShaderNodeMath')
    mx.operation = 'MAXIMUM'
    Lk.new(line(0), mx.inputs[0])
    Lk.new(line(1), mx.inputs[1])
    gl = n.new('ShaderNodeMix')
    gl.data_type = 'RGBA'
    gl.blend_type = 'MULTIPLY'
    Lk.new(mx.outputs[0], gl.inputs['Factor'])
    gl.inputs['Factor'].default_value = 0.0
    Lk.new(ramp.outputs[0], gl.inputs[6])
    gl.inputs[7].default_value = L.rgb('paper300', 0.85)
    col = gl.outputs[2]
    if tint:
        tm = n.new('ShaderNodeMix')
        tm.data_type = 'RGBA'
        tm.blend_type = 'MULTIPLY'
        tm.inputs['Factor'].default_value = amount
        Lk.new(col, tm.inputs[6])
        tm.inputs[7].default_value = L.rgb(tint) if isinstance(tint, str) else tint
        col = tm.outputs[2]
    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g
    Lk.new(col, tg.inputs['Base'])
    em = n.new('ShaderNodeEmission')
    Lk.new(tg.outputs[0], em.inputs[0])
    Lk.new(em.outputs[0], out.inputs[0])
    return m


def border_points(step=1.2):
    pts = []
    for i in range(len(BORDER) - 1):
        a, b = Vector(BORDER[i] + (0,)), Vector(BORDER[i + 1] + (0,))
        k = max(1, int((b - a).length / step))
        for j in range(k):
            pts.append(a.lerp(b, j / k))
    pts.append(Vector(BORDER[-1] + (0,)))
    return pts


def chalk_line(shot, z=0.15, width=2.2, mat=None):
    """Kreidestriche als kurze, leicht versetzte Quader / chalk strokes as short, slightly offset boxes"""
    R = random.Random(5)
    pts = border_points()
    mat = mat or L.toon(shot, 'paper50')
    segs = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        d = b - a
        ob = L.prim(shot, 'cube', mat, loc=(a + b) / 2 + Vector((0, 0, z)), size=(d.length * 1.15, width * R.uniform(0.8, 1.15), 0.12), px=2.0)
        ob.rotation_euler.z = math.atan2(d.y, d.x) + R.uniform(-0.06, 0.06)
        segs.append(ob)
    return segs


def table(shot):
    L.prim(shot, 'cube', L.toon(shot, 'timber600'), loc=(0, 0, -1.6), size=(160, 120, 3), ink=False)
    paper = L.mesh_obj(shot, 'map', [(-48, -35, 0.02), (48, -35, 0.02), (48, 35, 0.02), (-48, 35, 0.02)], [(0, 1, 2, 3)], map_material(shot))
    # Rand der Karte / map edge
    edge = L.toon(shot, 'paper300')
    for (x, y, w, hh) in ((0, 35.4, 97, 0.8), (0, -35.4, 97, 0.8), (48.4, 0, 0.8, 71), (-48.4, 0, 0.8, 71)):
        L.prim(shot, 'cube', edge, loc=(x, y, 0.05), size=(w, hh, 0.1), ink=False)
    return paper


def build():
    s = L.Shot(L.shot_dur('chalk'))
    R = random.Random(3)
    s.toon.set_light((0.55, 0.45, 0.38, 1), (0.82, 0.72, 0.6, 1), (1.0, 0.95, 0.85, 1))
    s.sunlight(rot=(0.55, 0.25, 0.9))
    L.sky(s, [(-1, 'ink900'), (1, 'ink800')])
    s.look((0, -52, 62), (0, 0, 0))
    table(s)
    segs = chalk_line(s)
    for sg in segs:
        sg['len'] = sg.scale.x
    # Figuren beiderseits der Grenze / pieces on both sides of the border
    pieces = []
    west = [(-30, 6), (-20, 10), (-26, 22), (-8, 20), (2, 26)]
    east = [(-8, -24), (8, -14), (22, -4), (30, 6), (16, -26)]
    for i, f in enumerate(FACTIONS):
        for (x, y) in (west[i], east[(i + 2) % 5]):
            ob = L.model(s, 'infantry_%s' % f, loc=(x, y, 0), rot=R.uniform(0, 360), scale=1.7)
            pieces.append(ob)
    chalk_bits = L.Puffs(s, 6, 'chalk', (0, 0, 0.5), spread=0.6, rise=1.5, size=(0.3, 0.6), life=1.2, seed=9)

    @s.on
    def update(t):
        p = L.ease_io(L.seg(t, 0, s.dur))
        ang = -0.4 + 0.35 * p
        r = 70 - 16 * p
        s.look((math.sin(ang) * r, -math.cos(ang) * r, 96 - 18 * p), (0, 2, 0))
        draw = L.seg(t, 0.6, 6.4)
        n = len(segs)
        for i, sg in enumerate(segs):
            k = L.clamp(draw * n - i)
            sg.scale.x = max(sg['len'] * k, 0.001)
        tip = segs[min(n - 1, int(draw * n))]
        chalk_bits.origin = Vector((tip.location.x, tip.location.y, 0.4))
        chalk_bits.update(t if draw < 1 else -10)

    update(0)
    return s
