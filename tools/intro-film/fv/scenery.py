"""
Welt-Baukasten, Teil Oberflaechen: gemalte Fassadenfelder, Materialsatz der Architektur, Spiegelbilder, Wasser,
Kielwasser, Malgrund fuer Boeden (Strassen, Pflaster, Gleise, Pfuetzen, Krater, Asche) und Gelaende.
World kit, surfaces: painted facade cells, the architecture's material set, mirror images, water, wakes, a canvas for
grounds (streets, paving, rails, puddles, craters, ash) and terrain.
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

from . import anime as A
from . import lib as L
from . import world as W

# ---------- Gemalte Fassaden / painted facades ----------
FACADES = ('res', 'grand', 'office', 'ware', 'shop', 'slit', 'glass', 'plain')
MAT = {st: i + 1 for i, st in enumerate(FACADES)}
MAT['flat'] = 0
_GLASS = (0.30, 0.33, 0.40)


def _facade_cell(style):
    """
    Ein Fassadenfeld (eine Fensterachse x ein Geschoss) als Zeichnung: RGB = Faktor auf die Wandfarbe (1 = Zierglied im
    Licht, kleiner = Schattenfuge, Laden, Glas), Alpha = Scheibe (leuchtet, wenn das Fenster an ist).
    One facade cell (one bay x one storey) as a drawing: RGB = factor on the wall colour (1 = trim in light, lower =
    shadow joint, shutter, glass), alpha = pane (glows when the window is on).
    """
    S = 512
    rgb = np.full((S, S, 3), 0.90, np.float32)
    al = np.zeros((S, S), np.float32)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    X, Y = (xx + 0.5) / S, 1.0 - (yy + 0.5) / S

    def R(x0, y0, x1, y1, c=None, a=None, mask=None):
        k = (X >= x0) & (X < x1) & (Y >= y0) & (Y < y1)
        if mask is not None:
            k &= mask
        if c is not None:
            rgb[k] = c
        if a is not None:
            al[k] = a
        return k

    def arch(x0, y0, x1, y1, grow=0.0):
        """Rechteck mit Rundbogen oben / rectangle with a round arch on top"""
        r = (x1 - x0) / 2 + grow
        cx = (x0 + x1) / 2
        return ((X >= x0 - grow) & (X < x1 + grow) & (Y >= y0 - grow) & (Y < y1)) | (((X - cx) ** 2 + (Y - y1) ** 2 < r * r) & (Y >= y1))

    if style == 'res':
        R(0, 0, 1, 0.035, 0.74)
        R(0, 0.035, 1, 0.07, 1.0)
        R(0.255, 0.20, 0.745, 0.845, 1.0)
        R(0.24, 0.165, 0.76, 0.205, 1.0)
        R(0.24, 0.14, 0.76, 0.165, 0.68)
        R(0.30, 0.24, 0.70, 0.80, _GLASS, 1.0)
        R(0.30, 0.74, 0.70, 0.80, (0.2, 0.22, 0.28))
        R(0.488, 0.24, 0.512, 0.80, 0.86, 0.0)
        R(0.30, 0.585, 0.70, 0.605, 0.86, 0.0)
        for x0, x1 in ((0.15, 0.25), (0.75, 0.85)):
            R(x0, 0.23, x1, 0.81, (0.50, 0.74, 0.72))
            for k in range(9):
                R(x0 + 0.01, 0.25 + k * 0.062, x1 - 0.01, 0.262 + k * 0.062, (0.38, 0.58, 0.57))
    elif style == 'grand':
        for x0, x1 in ((0.0, 0.085), (0.915, 1.0)):
            R(x0, 0, x1, 1, 1.0)
        R(0.085, 0, 0.10, 1, 0.70)
        R(0.90, 0, 0.915, 1, 0.80)
        R(0, 0.93, 1, 1.0, 1.0)
        R(0, 0.905, 1, 0.93, 0.66)
        k = arch(0.29, 0.18, 0.71, 0.60, 0.045)
        rgb[k] = 1.0
        k = arch(0.29, 0.18, 0.71, 0.60)
        rgb[k] = _GLASS
        al[k] = 1.0
        R(0.488, 0.18, 0.512, 0.82, 0.88, 0.0, mask=k)
        R(0.29, 0.59, 0.71, 0.612, 0.88, 0.0)
        R(0.29, 0.385, 0.71, 0.40, 0.88, 0.0, mask=k)
        R(0.47, 0.80, 0.53, 0.875, 1.0, 0.0)
        R(0.47, 0.785, 0.53, 0.80, 0.7, 0.0)
        R(0.20, 0.04, 0.80, 0.135, 0.80)
        for i in range(8):
            R(0.215 + i * 0.073, 0.05, 0.25 + i * 0.073, 0.125, 1.0)
        R(0.18, 0.135, 0.82, 0.165, 1.0)
    elif style == 'office':
        R(0, 0, 1, 0.24, 0.80)
        R(0, 0.24, 1, 0.27, 1.0)
        R(0, 0.215, 1, 0.24, 0.62)
        R(0.045, 0.30, 0.955, 0.86, 0.62)
        R(0.07, 0.325, 0.93, 0.835, _GLASS, 1.0)
        R(0.487, 0.30, 0.513, 0.86, 0.62, 0.0)
        R(0.07, 0.64, 0.93, 0.66, 0.62, 0.0)
        R(0, 0, 0.02, 1, 0.74)
    elif style == 'ware':
        for i in range(10):
            R(0, i * 0.1, 1, i * 0.1 + 0.014, 0.80)
            for j in range(4):
                x = ((j + 0.5 * (i % 2)) * 0.25) % 1.0
                R(x, i * 0.1, x + 0.012, i * 0.1 + 0.1, 0.84)
        R(0, 0, 0.07, 1, 0.80)
        R(0.07, 0, 0.082, 1, 0.66)
        k = arch(0.36, 0.30, 0.66, 0.60, 0.04)
        rgb[k] = 1.0
        k = arch(0.36, 0.30, 0.66, 0.60)
        rgb[k] = _GLASS
        al[k] = 1.0
        for i in range(1, 3):
            R(0.36 + i * 0.1 - 0.008, 0.30, 0.36 + i * 0.1 + 0.008, 0.80, 0.82, 0.0, mask=k)
            R(0.36, 0.30 + i * 0.13 - 0.008, 0.66, 0.30 + i * 0.13 + 0.008, 0.82, 0.0, mask=k)
        R(0.33, 0.255, 0.69, 0.285, 1.0)
    elif style == 'shop':
        R(0, 0.90, 1, 1.0, 1.0)
        R(0, 0.875, 1, 0.90, 0.62)
        R(0.0, 0, 0.09, 0.875, 0.98)
        R(0.09, 0, 0.105, 0.875, 0.66)
        k = arch(0.16, 0.0, 0.84, 0.50)
        rgb[k] = (0.5, 0.5, 0.52)
        k2 = arch(0.19, 0.0, 0.81, 0.50) & (Y > 0.14)
        rgb[k2] = _GLASS
        al[k2] = 1.0
        R(0.19, 0, 0.81, 0.14, 0.52)
        R(0.488, 0.14, 0.512, 0.86, 0.5, 0.0, mask=k2)
        R(0.19, 0.50, 0.81, 0.52, 0.5, 0.0)
        # Markise: gestreift / awning: striped
        for i in range(8):
            R(0.12 + i * 0.095, 0.56, 0.12 + (i + 1) * 0.095, 0.70, (1.0, 0.62, 0.42) if i % 2 == 0 else (1.0, 0.96, 0.86), 0.0)
        R(0.12, 0.535, 0.88, 0.56, 0.58, 0.0)
    elif style == 'slit':
        for i in range(5):
            R(0, i * 0.2, 0.11 if i % 2 else 0.07, i * 0.2 + 0.19, 1.0)
            R(1 - (0.11 if i % 2 == 0 else 0.07), i * 0.2, 1, i * 0.2 + 0.19, 1.0)
        k = arch(0.41, 0.2, 0.59, 0.66, 0.035)
        rgb[k] = 1.0
        k = arch(0.41, 0.2, 0.59, 0.66)
        rgb[k] = _GLASS
        al[k] = 1.0
        R(0.36, 0.15, 0.64, 0.18, 1.0)
        R(0.36, 0.13, 0.64, 0.15, 0.68)
    elif style == 'glass':
        rgb[:] = 0.55
        R(0.035, 0.07, 0.485, 0.93, _GLASS, 1.0)
        R(0.515, 0.07, 0.965, 0.93, _GLASS, 1.0)
        R(0, 0, 1, 0.03, 0.4, 0.0)
    else:  # plain: Brandwand mit Putzfeldern / fire wall with render panels
        R(0, 0, 1, 0.03, 0.80)
        R(0, 0.03, 1, 0.055, 0.98)
        R(0.49, 0.055, 0.50, 1, 0.84)
    out = np.concatenate([rgb, al[..., None]], 2)
    # 2x verkleinern (geglaettete Kanten) / downsample 2x (smoothed edges)
    return out.reshape(S // 2, 2, S // 2, 2, 4).mean((1, 3))


def facade(style):
    """Fassadenbild eines Stils / facade picture of a style"""
    return W.image('facade_' + style, _facade_cell(style))


_SPEC = {}


def facade_mats(shot, glass='sky700', win_cols=W.WIN_COLS, lit_gain=1.0):
    """
    Materialsatz der Architektur: [0] glatt (Daecher, Zierglieder, Lampen), dann je Fassadenstil eines; die Nummern
    stehen in MAT. / material set of the architecture: [0] plain (roofs, trim, lamps), then one per facade style; the
    indices are in MAT.
    """
    mats = [W.arch_mat(shot)]
    _SPEC[mats[0].name] = {}
    for st in FACADES:
        kw = dict(tex=facade(st), glass=glass, win_cols=win_cols, lit_gain=lit_gain)
        m = W.arch_mat(shot, **kw)
        _SPEC[m.name] = kw
        mats.append(m)
    return mats


def model_mat(shot, unit=False):
    """Material der Spielmodelle (Eckenfarbe, Leuchtmaske) mit Dunst; unit = ohne Schattenwurf / game model material with haze"""
    W._alive('clock')
    key = 'wmodel_%d' % int(unit)
    if key in W._MAT:
        return W._MAT[key]
    m = bpy.data.materials.new(key)
    nt, n, Lk = L._nodes(m)
    ca = n.new('ShaderNodeAttribute')
    ca.attribute_name = 'Col'
    ga = n.new('ShaderNodeAttribute')
    ga.attribute_name = 'glow'
    sep = n.new('ShaderNodeSeparateXYZ')
    Lk.new(ga.outputs['Vector'], sep.inputs[0])
    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g_unit if unit else shot.toon.g
    Lk.new(ca.outputs['Color'], tg.inputs['Base'])
    Lk.new(sep.outputs[0], tg.inputs['Glow'])
    Lk.new(sep.outputs[1], tg.inputs['Win'])
    W._finish(m, tg.outputs[0])
    W._MAT[key] = m
    return m


def toon_mat(shot, color, unit=False, name=None, keep=0.0):
    """Einfarbiges Comic-Material mit Dunst / single-colour comic material with haze"""
    W._alive('clock')
    c = W.col(color)
    key = name or 'wtoon_%.3f_%.3f_%.3f_%d' % (c[0], c[1], c[2], int(unit))
    if key in W._MAT:
        return W._MAT[key]
    m = bpy.data.materials.new(key)
    nt, n, Lk = L._nodes(m)
    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g_unit if unit else shot.toon.g
    Lk.new(W._rgb(n, 'base', c), tg.inputs['Base'])
    W._finish(m, tg.outputs[0], keep=keep)
    W._MAT[key] = m
    return m


# ---------- Spiegelung / reflection ----------
def mirror(shot, obs, z=0.0, stretch=1.0):
    """
    Spiegelbilder unter der Wasserflaeche: Kopien mit umgekehrter Hoehe (stretch > 1 zieht sie lang wie gemalte
    Spiegelungen), ohne Tusche, Baukasten-Materialien ohne Schattenwurf (sonst laege das Spiegelbild im Schatten des
    Originals). / mirror images below the water surface: copies with inverted height (stretch > 1 elongates them like
    painted reflections), no ink, kit materials without cast shadows (the image would lie in the original's shadow).
    """
    out = []
    S = Matrix.Translation((0, 0, z)) @ Matrix.Diagonal((1, 1, -stretch, 1)) @ Matrix.Translation((0, 0, -z))
    bpy.context.view_layer.update()
    for ob in obs:
        if ob.type != 'MESH':
            continue
        o2 = bpy.data.objects.new(ob.name + '.mir', ob.data)
        shot.sc.collection.objects.link(o2)
        o2.matrix_world = S @ ob.matrix_world
        o2.visible_shadow = False
        for i, slot in enumerate(ob.material_slots):
            mm = slot.material
            if mm is None:
                continue
            if mm.name in _SPEC:
                mm = W.arch_mat(shot, unit=True, name=mm.name + '_u', **_SPEC[mm.name])
            elif mm.name in ('toon_attr', 'wmodel_0'):
                mm = model_mat(shot, unit=True)
            o2.material_slots[i].link = 'OBJECT'
            o2.material_slots[i].material = mm
        o2['fv_src'] = ob.name
        out.append((ob, o2, S))
    return out


def mirror_follow(pairs):
    """Spiegelbilder bewegter Objekte nachfuehren (je Bild) / make the mirror images of moving objects follow (per frame)"""
    bpy.context.view_layer.update()
    for ob, o2, S in pairs:
        o2.matrix_world = S @ ob.matrix_world


class Water:
    """
    Wasser im flachen gemalten Stil: Farbverlauf von nah (tief) nach fern (Himmelsspiegel), Glanzbahn zur Sonne,
    Wellen als waagerechte helle und dunkle Striche (bewegt), halb durchsichtig ueber den Spiegelbildern (mirror()).
    Die Striche liegen in Polarkoordinaten um den Kamerastandpunkt: so bleiben sie im Bild von vorn bis zum Horizont
    etwa gleich gross, wie gezeichnet.
    Water in the flat painted style: gradient from near (deep) to far (sky mirror), a glitter path towards the sun,
    ripples as horizontal bright and dark dashes (moving), half transparent above the mirror images (mirror()). The
    dashes live in polar coordinates around the camera position: they keep about the same size in the picture from the
    front to the horizon, as if drawn.
    """

    def __init__(self, shot, area, cam, near, far, hi, lo=None, sun_az=None, sun_col='flash100', sun_width=7.0, sun_gain=1.0,
                 far_dist=1500.0, alpha=(0.82, 0.5), z=0.0, dash=(1.0, 1.0), speed=0.35, name='water', hi_thr=(0.66, 0.5), mid=None, calm=0.46, calm_col=None):
        x0, y0, x1, y1 = area
        _m, _mix, _rgb = W._m, W._mix, W._rgb
        m = bpy.data.materials.new(name)
        nt, n, Lk = L._nodes(m)
        geo = n.new('ShaderNodeNewGeometry')
        rel = n.new('ShaderNodeVectorMath')
        rel.operation = 'SUBTRACT'
        Lk.new(geo.outputs['Position'], rel.inputs[0])
        rel.inputs[1].default_value = (cam[0], cam[1], z)
        sp = n.new('ShaderNodeSeparateXYZ')
        Lk.new(rel.outputs[0], sp.inputs[0])
        d = _m(n, Lk, 'SQRT', _m(n, Lk, 'ADD', _m(n, Lk, 'MULTIPLY', sp.outputs[0], sp.outputs[0]), _m(n, Lk, 'MULTIPLY', sp.outputs[1], sp.outputs[1])))
        th = _m(n, Lk, 'ARCTAN2', sp.outputs[0], sp.outputs[1])
        # Grundfarbe nach Entfernung / base colour by distance
        ramp = n.new('ShaderNodeValToRGB')
        els = ramp.color_ramp.elements
        stops = [(0.0, near)] + ([(0.3, mid)] if mid is not None else []) + [(1.0, far)]
        for i, (p, c) in enumerate(stops):
            e = els[i] if i < 2 else els.new(p)
            e.position = p
            cc = W.col(c)
            e.color = (cc[0], cc[1], cc[2], 1)
        dn = _m(n, Lk, 'POWER', _m(n, Lk, 'DIVIDE', d, far_dist, clamp=True), 0.6)
        Lk.new(dn, ramp.inputs[0])
        base = ramp.outputs['Color']
        wedge = None
        if sun_az is not None:
            dth = _m(n, Lk, 'DIVIDE', _m(n, Lk, 'SUBTRACT', th, math.radians(sun_az)), math.radians(sun_width))
            wedge = _m(n, Lk, 'EXPONENT', _m(n, Lk, 'MULTIPLY', _m(n, Lk, 'MULTIPLY', dth, dth), -1.0))
            wedge = _m(n, Lk, 'MULTIPLY', wedge, _m(n, Lk, 'MULTIPLY', dn, sun_gain, clamp=True))
            base = _mix(n, Lk, _m(n, Lk, 'MULTIPLY', wedge, 0.55), base, _rgb(n, 'sun', sun_col))
        # Wellenstriche / ripple dashes
        u = _m(n, Lk, 'MULTIPLY', _m(n, Lk, 'MULTIPLY', th, _m(n, Lk, 'POWER', d, 0.4)), 5.0 * dash[0])
        v = _m(n, Lk, 'MULTIPLY', _m(n, Lk, 'POWER', _m(n, Lk, 'MAXIMUM', d, 1.0), -0.6), 2600.0 * dash[1])
        ck = n.new('ShaderNodeGroup')
        ck.node_tree = W.clock_group()
        cv = n.new('ShaderNodeCombineXYZ')
        Lk.new(u, cv.inputs[0])
        Lk.new(_m(n, Lk, 'MULTIPLY_ADD', ck.outputs[0], speed * 0.6, v), cv.inputs[1])
        Lk.new(_m(n, Lk, 'MULTIPLY', ck.outputs[0], speed), cv.inputs[2])
        nz = n.new('ShaderNodeTexNoise')
        nz.noise_dimensions = '3D'
        nz.inputs['Scale'].default_value = 1.0
        nz.inputs['Detail'].default_value = 1.0
        nz.inputs['Roughness'].default_value = 0.4
        Lk.new(cv.outputs[0], nz.inputs['Vector'])
        f = nz.outputs[0]
        thr = hi_thr[0] if wedge is None else _m(n, Lk, 'MULTIPLY_ADD', wedge, hi_thr[1] - hi_thr[0], hi_thr[0])
        hi_m = _m(n, Lk, 'GREATER_THAN', f, thr)
        lo_m = _m(n, Lk, 'LESS_THAN', f, 0.36)
        c = _mix(n, Lk, _m(n, Lk, 'MULTIPLY', lo_m, 0.55), base, _rgb(n, 'lo', lo if lo is not None else near))
        hic = _rgb(n, 'hi', hi)
        if wedge is not None:
            hic = _mix(n, Lk, _m(n, Lk, 'MULTIPLY', wedge, 1.6, clamp=True), hic, _rgb(n, 'sun2', sun_col))
        c = _mix(n, Lk, hi_m, c, hic)
        a = _m(n, Lk, 'MULTIPLY_ADD', dn, alpha[1] - alpha[0], alpha[0])
        if calm:
            # ruhige Bahnen: breite Streifen deckender Wasserfarbe brechen das Spiegelbild wie gemalt
            # calm lanes: broad streaks of opaque water colour break the mirror image as in a painting
            cv2 = n.new('ShaderNodeCombineXYZ')
            Lk.new(_m(n, Lk, 'MULTIPLY', u, 0.11), cv2.inputs[0])
            Lk.new(_m(n, Lk, 'MULTIPLY_ADD', ck.outputs[0], speed * 0.15, _m(n, Lk, 'MULTIPLY', v, 0.42)), cv2.inputs[1])
            Lk.new(_m(n, Lk, 'MULTIPLY', ck.outputs[0], speed * 0.25), cv2.inputs[2])
            nz2 = n.new('ShaderNodeTexNoise')
            nz2.noise_dimensions = '3D'
            nz2.inputs['Scale'].default_value = 1.0
            nz2.inputs['Detail'].default_value = 0.0
            Lk.new(cv2.outputs[0], nz2.inputs['Vector'])
            cm = _m(n, Lk, 'GREATER_THAN', nz2.outputs[0], 1.0 - calm)
            c = _mix(n, Lk, _m(n, Lk, 'MULTIPLY', cm, _m(n, Lk, 'SUBTRACT', 1.0, hi_m)), c, _mix(n, Lk, 0.16, base, _rgb(n, 'calm', calm_col if calm_col is not None else far)))
            a = _m(n, Lk, 'MAXIMUM', a, _m(n, Lk, 'MULTIPLY', cm, 0.97))
        a = _m(n, Lk, 'MAXIMUM', a, hi_m)
        a = _m(n, Lk, 'ADD', a, _m(n, Lk, 'MULTIPLY', lo_m, 0.18), clamp=True)
        W._finish(m, c, alpha=a)
        self.mat = m
        self.ob = L.mesh_obj(shot, name, [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [(0, 1, 2, 3)], m)
        self.ob.visible_shadow = False


def wake(mb, length, width, color, mat, alpha=0.8, z=0.12):
    """Kielwasser als Keil hinter dem Heck (Bug zeigt nach +x) / wake as a wedge behind the stern (bow points to +x)"""
    c = W.col(color)
    for sgn in (-1, 1):
        pts = [(0, sgn * width * 0.12, z), (-length, sgn * width, z), (-length * 0.96, sgn * width * 0.72, z), (-length * 0.1, sgn * width * 0.05, z)]
        k = len(mb.v)
        for p in pts:
            mb.v.append(tuple(mb.m @ Vector(p)))
            mb.iw.append(0.0)
        mb.f.append((k, k + 1, k + 2, k + 3))
        for a in (alpha, 0.0, 0.0, alpha):
            mb.c.append((c[0], c[1], c[2], a))
            mb.uv.append((0.5, 0.5))
            mb.a.append((W.NEVER, 0.5, 0.0))
        mb.mi.append(mat)
        mb.sm.append(False)


def flat_disc(mb, p, r, color, mat, alpha=1.0, off=None, hsh=0.5):
    """Liegende Scheibe (Lichtkreis einer Lampe auf dem Boden) / lying disc (a lamp's pool of light on the ground)"""
    P = mb.m @ Vector(p)
    k = len(mb.v)
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        mb.v.append((P.x + sx * r, P.y + sy * r, P.z))
        mb.iw.append(0.0)
    mb.f.append((k, k + 1, k + 2, k + 3))
    c = W.col(color)
    for uvp in ((0, 0), (1, 0), (1, 1), (0, 1)):
        mb.c.append((c[0], c[1], c[2], alpha))
        mb.uv.append(uvp)
        mb.a.append((mb.off if off is None else off, hsh, 1.0))
    mb.mi.append(mat)
    mb.sm.append(False)


# ---------- Gemalter Boden / painted ground ----------
class Canvas:
    """
    Malgrund in Draufsicht ueber area = (x0, y0, x1, y1) in Weltmetern (sRGB): Flaechen, Linien, Scheiben, Laviertes,
    Sprenkel. Fuer Strassen, Pflaster, Gleise, Pfuetzen, Krater, Asche.
    Top-view canvas over area in world metres (sRGB): fills, lines, discs, washes, flecks. For streets, paving, rails,
    puddles, craters, ash.
    """

    def __init__(self, area, res, color):
        self.area = area
        x0, y0, x1, y1 = area
        self.w = res
        self.h = max(8, int(round(res * (y1 - y0) / (x1 - x0))))
        self.img = np.empty((self.h, self.w, 3), np.float32)
        self.img[:] = self._c(color)
        self.sx = self.w / (x1 - x0)
        self.sy = self.h / (y1 - y0)

    @staticmethod
    def _c(c):
        return A.hexc(c) if isinstance(c, str) else np.asarray(c, np.float32)

    def px(self, x, y):
        return (x - self.area[0]) * self.sx, (self.area[3] - y) * self.sy

    def _win(self, x0, y0, x1, y1):
        ax, ay = self.px(x0, y1)
        bx, by = self.px(x1, y0)
        i0, i1 = int(max(0, math.floor(ax))), int(min(self.w, math.ceil(bx) + 1))
        j0, j1 = int(max(0, math.floor(ay))), int(min(self.h, math.ceil(by) + 1))
        return i0, i1, j0, j1

    def _grid(self, i0, i1, j0, j1):
        yy, xx = np.mgrid[j0:j1, i0:i1].astype(np.float32)
        return self.area[0] + (xx + 0.5) / self.sx, self.area[3] - (yy + 0.5) / self.sy

    def blend(self, i0, i1, j0, j1, color, a):
        if i1 <= i0 or j1 <= j0:
            return
        c = self._c(color)
        sub = self.img[j0:j1, i0:i1]
        sub += (c[None, None, :] - sub) * a[..., None]

    def rect(self, x0, y0, x1, y1, color, alpha=1.0):
        i0, i1, j0, j1 = self._win(x0, y0, x1, y1)
        if i1 <= i0 or j1 <= j0:
            return
        wx, wy = self._grid(i0, i1, j0, j1)
        e = 0.5 / self.sx
        a = np.clip((wx - x0) / e / 2 + 0.5, 0, 1) * np.clip((x1 - wx) / e / 2 + 0.5, 0, 1) * np.clip((wy - y0) / e / 2 + 0.5, 0, 1) * np.clip((y1 - wy) / e / 2 + 0.5, 0, 1)
        self.blend(i0, i1, j0, j1, color, a * alpha)

    def line(self, p0, p1, width, color, alpha=1.0, soft=0.0):
        r = width / 2 + soft + 1.0 / self.sx
        i0, i1, j0, j1 = self._win(min(p0[0], p1[0]) - r, min(p0[1], p1[1]) - r, max(p0[0], p1[0]) + r, max(p0[1], p1[1]) + r)
        if i1 <= i0 or j1 <= j0:
            return
        wx, wy = self._grid(i0, i1, j0, j1)
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        ln = dx * dx + dy * dy + 1e-9
        t = np.clip(((wx - p0[0]) * dx + (wy - p0[1]) * dy) / ln, 0, 1)
        dist = np.sqrt((wx - p0[0] - t * dx) ** 2 + (wy - p0[1] - t * dy) ** 2)
        edge = max(soft, 1.0 / self.sx)
        self.blend(i0, i1, j0, j1, color, np.clip((width / 2 + edge / 2 - dist) / edge, 0, 1) * alpha)

    def poly(self, pts, width, color, alpha=1.0, soft=0.0):
        for a, b in zip(pts[:-1], pts[1:]):
            self.line(a, b, width, color, alpha, soft)

    def disc(self, c, r, color, alpha=1.0, soft=0.0, squash=1.0, ring=None):
        i0, i1, j0, j1 = self._win(c[0] - r - soft, c[1] - r * squash - soft, c[0] + r + soft, c[1] + r * squash + soft)
        if i1 <= i0 or j1 <= j0:
            return
        wx, wy = self._grid(i0, i1, j0, j1)
        dist = np.sqrt((wx - c[0]) ** 2 + ((wy - c[1]) / squash) ** 2)
        edge = max(soft, 1.0 / self.sx)
        a = np.clip((r + edge / 2 - dist) / edge, 0, 1)
        if ring:
            a *= np.clip((dist - (r - ring) + edge / 2) / edge, 0, 1)
        self.blend(i0, i1, j0, j1, color, a * alpha)

    def wash(self, color, amount, cell, seed, thr=None, octaves=3, area=None):
        """Lavierte Flecken (thr: harte Kante = flache Flecken) / washed blotches (thr: hard edge = flat patches)"""
        i0, i1, j0, j1 = self._win(*(area or self.area))
        f = A.fbm(j1 - j0, i1 - i0, cell * self.sx, seed, octaves)
        a = np.clip((f - thr) * 40 + 0.5, 0, 1) if thr is not None else np.clip((f - 0.3) / 0.4, 0, 1)
        self.blend(i0, i1, j0, j1, color, a * amount)

    def flecks(self, n, size, color, seed, alpha=1.0, area=None, squash=1.0):
        R = np.random.default_rng(seed)
        x0, y0, x1, y1 = area or self.area
        for _ in range(n):
            self.disc((R.uniform(x0, x1), R.uniform(y0, y1)), R.uniform(*size), color, alpha * R.uniform(0.5, 1.0), squash=squash)

    def image(self, name):
        return W.image(name, self.img)


def ground(shot, height, size, sub, tex, area, name='ground', loc=(0, 0, 0), unit=False, smooth=True):
    """
    Gelaende mit Relief und gemalter Draufsicht (Canvas), Comic-Lichtbaender mit Schattenwurf, Dunst des Baukastens.
    Terrain with relief and a painted top view (Canvas), comic light bands with cast shadows, the kit's haze.
    """
    if isinstance(size, (int, float)):
        size = (size, size)
    nx_, ny_ = (sub, sub) if isinstance(sub, int) else sub
    xs = np.linspace(-size[0] / 2, size[0] / 2, nx_ + 1) + loc[0]
    ys = np.linspace(-size[1] / 2, size[1] / 2, ny_ + 1) + loc[1]
    verts = [(x, y, height(x, y)) for y in ys for x in xs]
    faces = [(j * (nx_ + 1) + i, j * (nx_ + 1) + i + 1, (j + 1) * (nx_ + 1) + i + 1, (j + 1) * (nx_ + 1) + i) for j in range(ny_) for i in range(nx_)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    m = bpy.data.materials.new(name)
    nt, n, Lk = L._nodes(m)
    tc = n.new('ShaderNodeNewGeometry')
    mp = n.new('ShaderNodeMapping')
    x0, y0, x1, y1 = area
    mp.inputs['Location'].default_value = (-x0 / (x1 - x0), -y0 / (y1 - y0), 0)
    mp.inputs['Scale'].default_value = (1 / (x1 - x0), 1 / (y1 - y0), 1)
    Lk.new(tc.outputs['Position'], mp.inputs['Vector'])
    tx = n.new('ShaderNodeTexImage')
    tx.image = tex
    tx.interpolation = 'Linear'
    tx.extension = 'EXTEND'
    Lk.new(mp.outputs['Vector'], tx.inputs['Vector'])
    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g_unit if unit else shot.toon.g
    Lk.new(tx.outputs['Color'], tg.inputs['Base'])
    W._finish(m, tg.outputs[0])
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    shot.sc.collection.objects.link(ob)
    return ob
