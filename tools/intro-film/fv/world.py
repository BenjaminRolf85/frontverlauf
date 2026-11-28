"""
Welt-Baukasten des Anime-Schnitts (nur Film): Netzbauer fuer Architektur, Materialien mit gemalten Fassaden und
schaltbaren Lichtern, Dunst nach Entfernung und Hoehe, Wasser mit Spiegelung, gemalter Boden, Himmel je Akt, Atmosphaere
(Dunstbaenke, Lichtfinger, gezeichneter Rauch, Staub, Glut, Regen, Asche, Voegel).
World kit of the anime cut (film only): mesh builder for architecture, materials with painted facades and switchable
lights, haze by distance and height, water with reflection, painted ground, sky per act, atmosphere (haze banks, light
shafts, drawn smoke, dust, embers, rain, ash, birds).

Regeln / rules:
- Farben nur aus den Design-Tokens (gemischt), gemalt wird mit numpy, alles deterministisch (feste Zufallszahlen).
  colours only from the design tokens (mixed), painting uses numpy, everything deterministic (fixed random numbers).
- Jedes Material dieses Baukastens endet in der Dunst-Gruppe (FVHaze): ein Regler fuer die ganze Szene (haze()).
  every material of this kit ends in the haze group (FVHaze): one control for the whole scene (haze()).
- Lichter (Fenster, Lampen, Schilder) haengen an einer Uhr (clock()) und einer Abschaltzeit je Bauteil: so laeuft die
  Stromausfall-Welle ohne Objektwechsel. / lights (windows, lamps, signs) hang on a clock (clock()) and a switch-off
  time per part: the blackout wave runs without swapping objects.
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

from . import anime as A
from . import lib as L

NEVER = 1.0e6


def col(c, mul=1.0):
    """Token, sRGB-Tripel (numpy) oder lineares RGBA -> lineares RGB / token, sRGB triple or linear RGBA -> linear RGB"""
    if isinstance(c, str):
        r = L.rgb(c)
    elif isinstance(c, np.ndarray):
        r = A.lin(c)
    else:
        r = c
    return (r[0] * mul, r[1] * mul, r[2] * mul)


def mixc(a, b, t):
    """Mischung zweier Tokens (in sRGB gemischt), linear zurueck / mix of two tokens (mixed in sRGB), returned linear"""
    return col(A.cmix(a, b, t))


# ---------- Bilder / pictures ----------
def image(name, arr, srgb=True):
    """numpy (h, w, 3|4), 0..1, oberste Zeile zuerst -> Blender-Bild / numpy, top row first -> Blender image"""
    old = bpy.data.images.get(name)
    if old is not None:
        return old
    h, w, c = arr.shape
    if c == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1), np.float32)], 2)
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    img.alpha_mode = 'CHANNEL_PACKED'
    img.pixels.foreach_set(np.clip(arr[::-1], 0, 1).astype(np.float32).ravel())
    img.update()
    return img


# ---------- Gruppen: Uhr, Schalter, Dunst / groups: clock, switch, haze ----------
_G = {}
_MAT = {}


def _alive(key):
    """Nach einer neuen Shot (read_factory_settings) sind alle Bloecke weg / after a new Shot all data blocks are gone"""
    g = _G.get(key)
    if g is None:
        return None
    try:
        g.name
    except ReferenceError:
        _G.clear()
        _MAT.clear()
        return None
    return g


def _group(name, ins, outs):
    g = bpy.data.node_groups.new(name, 'ShaderNodeTree')
    for nm, ty in ins:
        g.interface.new_socket(nm, in_out='INPUT', socket_type=ty)
    for nm, ty in outs:
        g.interface.new_socket(nm, in_out='OUTPUT', socket_type=ty)
    return g, g.nodes, g.links, g.nodes.new('NodeGroupInput'), g.nodes.new('NodeGroupOutput')


def _m(n, Lk, op, a, b=None, c=None, clamp=False):
    x = n.new('ShaderNodeMath')
    x.operation = op
    x.use_clamp = clamp
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            x.inputs[i].default_value = v
        else:
            Lk.new(v, x.inputs[i])
    return x.outputs[0]


def _mix(n, Lk, f, a, b, blend='MIX'):
    x = n.new('ShaderNodeMix')
    x.data_type = 'RGBA'
    x.blend_type = blend
    for i, v in ((0, f), (6, a), (7, b)):
        if isinstance(v, (int, float)):
            x.inputs[i].default_value = v
        elif isinstance(v, tuple):
            x.inputs[i].default_value = (v[0], v[1], v[2], 1.0)
        else:
            Lk.new(v, x.inputs[i])
    return x.outputs[2]


def _rgb(n, name, c):
    x = n.new('ShaderNodeRGB')
    x.name = name
    c = col(c)
    x.outputs[0].default_value = (c[0], c[1], c[2], 1)
    return x.outputs[0]


def clock_group():
    g = _alive('clock')
    if g:
        return g
    g, n, Lk, gi, go = _group('FVClock', [], [('Clock', 'NodeSocketFloat')])
    v = n.new('ShaderNodeValue')
    v.name = 'clock'
    Lk.new(v.outputs[0], go.inputs[0])
    _G['clock'] = g
    return g


def clock(t):
    """Uhr aller Lichter und Wasserwellen setzen (Sekunden) / set the clock of all lights and water ripples (seconds)"""
    clock_group().nodes['clock'].outputs[0].default_value = float(t)


def on_group():
    """
    Schalter: 1 solange Uhr < Off (+- Streuung nach H), mit Flackern in den letzten 0,35 s.
    Switch: 1 while clock < Off (+- scatter by H), with a flicker in the last 0.35 s.
    """
    g = _alive('on')
    if g:
        return g
    g, n, Lk, gi, go = _group('FVOn', [('Off', 'NodeSocketFloat'), ('H', 'NodeSocketFloat')], [('On', 'NodeSocketFloat')])
    ck = n.new('ShaderNodeGroup')
    ck.node_tree = clock_group()
    off = _m(n, Lk, 'MULTIPLY_ADD', gi.outputs['H'], 0.5, gi.outputs['Off'])
    d = _m(n, Lk, 'SUBTRACT', off, _m(n, Lk, 'ADD', ck.outputs[0], 0.25))
    on = _m(n, Lk, 'GREATER_THAN', d, 0.0)
    near = _m(n, Lk, 'LESS_THAN', d, 0.35)
    ph = _m(n, Lk, 'MULTIPLY_ADD', ck.outputs[0], 55.0, _m(n, Lk, 'MULTIPLY', gi.outputs['H'], 60.0))
    fl = _m(n, Lk, 'LESS_THAN', _m(n, Lk, 'SINE', ph), -0.1)
    out = _m(n, Lk, 'MULTIPLY', on, _m(n, Lk, 'SUBTRACT', 1.0, _m(n, Lk, 'MULTIPLY', near, fl)))
    Lk.new(out, go.inputs[0])
    _G['on'] = g
    return g


def haze_group():
    """
    Dunst: Farbe -> Mischung mit der Dunstfarbe nach Blickentfernung (1 - exp) und Hoehe (unten dichter). Keep nimmt
    Lichter aus (0 = voller Dunst, 1 = keiner). / haze: colour -> mix with the haze colour by view distance and height
    (denser below). Keep exempts lights (0 = full haze, 1 = none).
    """
    g = _alive('haze')
    if g:
        return g
    g, n, Lk, gi, go = _group('FVHaze', [('Color', 'NodeSocketColor'), ('Keep', 'NodeSocketFloat')], [('Color', 'NodeSocketColor')])

    def val(name, v):
        x = n.new('ShaderNodeValue')
        x.name = name
        x.outputs[0].default_value = v
        return x.outputs[0]
    start, dist, amount = val('start', 60.0), val('dist', 900.0), val('amount', 0.0)
    hfloor, hscale, z0 = val('hfloor', 1.0), val('hscale', 60.0), val('z0', 0.0)
    c = n.new('ShaderNodeRGB')
    c.name = 'color'
    cd = n.new('ShaderNodeCameraData')
    x = _m(n, Lk, 'DIVIDE', _m(n, Lk, 'SUBTRACT', cd.outputs['View Distance'], start), dist)
    x = _m(n, Lk, 'MAXIMUM', x, 0.0)
    f = _m(n, Lk, 'SUBTRACT', 1.0, _m(n, Lk, 'EXPONENT', _m(n, Lk, 'MULTIPLY', x, -1.0)))
    geo = n.new('ShaderNodeNewGeometry')
    sep = n.new('ShaderNodeSeparateXYZ')
    Lk.new(geo.outputs['Position'], sep.inputs[0])
    hz = _m(n, Lk, 'DIVIDE', _m(n, Lk, 'MAXIMUM', _m(n, Lk, 'SUBTRACT', sep.outputs[2], z0), 0.0), hscale)
    hk = _m(n, Lk, 'EXPONENT', _m(n, Lk, 'MULTIPLY', hz, -1.0))
    hk = _m(n, Lk, 'ADD', hfloor, _m(n, Lk, 'MULTIPLY', hk, _m(n, Lk, 'SUBTRACT', 1.0, hfloor)))
    f = _m(n, Lk, 'MULTIPLY', _m(n, Lk, 'MULTIPLY', f, amount), hk, clamp=True)
    f = _m(n, Lk, 'MULTIPLY', f, _m(n, Lk, 'SUBTRACT', 1.0, gi.outputs['Keep']), clamp=True)
    Lk.new(_mix(n, Lk, f, gi.outputs['Color'], c.outputs[0]), go.inputs[0])
    _G['haze'] = g
    return g


def haze(shot, color, start=60.0, dist=900.0, amount=0.9, hfloor=1.0, hscale=60.0, z0=0.0, others=True, ink=None):
    """
    Dunst der Szene setzen: dist = Entfernung, bei der 63 % erreicht sind; hfloor < 1 laesst den Dunst nach oben auf
    diesen Anteil abnehmen (Hoehe hscale ueber z0). others: auch alle fremden Materialien (Spielmodelle, Tusche)
    bekommen den Entfernungsdunst (anime.haze_all).
    Set the scene's haze: dist = distance at which 63 % is reached; hfloor < 1 lets the haze fall to that share with
    height (scale hscale above z0). others: all foreign materials (game models, ink) get the distance haze as well.
    """
    c = col(color)
    g = haze_group()
    for k, v in (('start', start), ('dist', dist), ('amount', amount), ('hfloor', hfloor), ('hscale', hscale), ('z0', z0)):
        g.nodes[k].outputs[0].default_value = v
    g.nodes['color'].outputs[0].default_value = (c[0], c[1], c[2], 1)
    if others:
        # ink: Dunst der Tuschelinien; am Tag etwas mehr als die Flaechen (Linien verblassen zuerst), in der Nacht weniger
        # (sonst stehen helle Linien auf dunklen Flaechen) / ink: haze of the ink lines; by day a little more than the
        # faces (lines fade first), at night less (otherwise light lines stand on dark faces)
        A.haze_all(shot, (c[0], c[1], c[2], 1.0), start=start, dist=dist / 3.0, amount=amount, ink_amount=min(1.0, amount * 1.08) if ink is None else ink)


def _finish(m, color, keep=0.0, alpha=None, add=False, shadow=True):
    """Farbe -> Dunst -> Emission -> Ausgang; alpha = Deckung, add = additiv / colour -> haze -> emission -> output"""
    nt = m.node_tree
    n, Lk = nt.nodes, nt.links
    out = n.new('ShaderNodeOutputMaterial')
    hz = n.new('ShaderNodeGroup')
    hz.node_tree = haze_group()
    hz.name = 'haze'
    if isinstance(color, tuple):
        hz.inputs['Color'].default_value = (color[0], color[1], color[2], 1)
    else:
        Lk.new(color, hz.inputs['Color'])
    if isinstance(keep, (int, float)):
        hz.inputs['Keep'].default_value = keep
    else:
        Lk.new(keep, hz.inputs['Keep'])
    em = n.new('ShaderNodeEmission')
    em.name = 'em'
    Lk.new(hz.outputs[0], em.inputs[0])
    m['fv_hazed'] = 1
    if alpha is None and not add:
        if shadow:
            Lk.new(em.outputs[0], out.inputs[0])
        else:
            L._no_shadow(m, em.outputs[0], out)
        return em
    tr = n.new('ShaderNodeBsdfTransparent')
    if add:
        # additiv: Emission (x Deckung) + durchsichtig / additive: emission (x alpha) + transparent
        if alpha is not None:
            if isinstance(alpha, (int, float)):
                em.inputs[1].default_value = alpha
            else:
                Lk.new(alpha, em.inputs[1])
        ad = n.new('ShaderNodeAddShader')
        Lk.new(tr.outputs[0], ad.inputs[0])
        Lk.new(em.outputs[0], ad.inputs[1])
        Lk.new(ad.outputs[0], out.inputs[0])
    else:
        mx = n.new('ShaderNodeMixShader')
        mx.name = 'mix'
        if isinstance(alpha, (int, float)):
            mx.inputs[0].default_value = alpha
        else:
            Lk.new(alpha, mx.inputs[0])
        Lk.new(tr.outputs[0], mx.inputs[1])
        Lk.new(em.outputs[0], mx.inputs[2])
        Lk.new(mx.outputs[0], out.inputs[0])
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = False
    m.use_transparent_shadow = True
    return em


# ---------- Materialien / materials ----------
# Lichtfarben der Fenster (Tokens) / window light colours (tokens)
WIN_COLS = ('window300', 'yellow400', 'sunDusk', 'paper50', 'window300')


def arch_mat(shot, tex=None, unit=False, name=None, win_cols=WIN_COLS, glass=None, lit_gain=1.0, keep=0.45):
    """
    Material der Architektur: Eckenfarbe 'Col' (Alpha = Verlauf Fuss..Traufe) x gemalte Fassade (tex: RGB Zeichnung,
    Alpha Fensterscheiben), Comic-Lichtbaender des Films; Fenster leuchten nach Zufall je Scheibe (Dichte aus 'aux'.y)
    bis zur Abschaltzeit ('aux'.x), 'aux'.z laesst die ganze Flaeche leuchten (Lampen, Schilder). unit: Baender ohne
    Schattenwurf (Spiegelbilder, ferne Schichten).
    Architecture material: corner colour 'Col' (alpha = gradient base..eaves) x painted facade (tex: RGB drawing, alpha
    window panes), the film's comic light bands; windows glow by chance per pane (density from 'aux'.y) until the
    switch-off time ('aux'.x), 'aux'.z makes the whole face glow (lamps, signs). unit: bands without cast shadows
    (mirror images, far layers).
    """
    _alive('clock')
    key = name or 'arch_%s_%d' % (tex.name if tex else 'plain', int(unit))
    if key in _MAT:
        return _MAT[key]
    m = bpy.data.materials.new(key)
    nt, n, Lk = L._nodes(m)
    ca = n.new('ShaderNodeAttribute')
    ca.attribute_name = 'Col'
    ax = n.new('ShaderNodeAttribute')
    ax.attribute_name = 'aux'
    sep = n.new('ShaderNodeSeparateXYZ')
    Lk.new(ax.outputs['Vector'], sep.inputs[0])
    # Verlauf: unten dunkler (Schmutz, Schatten der Strasse), oben heller / gradient: darker below, lighter above
    gr = n.new('ShaderNodeMapRange')
    Lk.new(ca.outputs['Alpha'], gr.inputs['Value'])
    gr.inputs['To Min'].default_value = 0.66
    gr.inputs['To Max'].default_value = 1.05
    gv = n.new('ShaderNodeCombineXYZ')
    for i in range(3):
        Lk.new(gr.outputs[0], gv.inputs[i])
    base = _mix(n, Lk, 1.0, ca.outputs['Color'], gv.outputs[0], 'MULTIPLY')
    mask = None
    if tex is not None:
        uv = n.new('ShaderNodeUVMap')
        tx = n.new('ShaderNodeTexImage')
        tx.image = tex
        tx.interpolation = 'Linear'
        tx.extension = 'REPEAT'
        Lk.new(uv.outputs['UV'], tx.inputs['Vector'])
        base = _mix(n, Lk, 1.0, base, tx.outputs['Color'], 'MULTIPLY')
        mask = tx.outputs['Alpha']
    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g_unit if unit else shot.toon.g
    Lk.new(base, tg.inputs['Base'])
    shaded = tg.outputs['Color']
    sw = n.new('ShaderNodeGroup')
    sw.node_tree = on_group()
    Lk.new(sep.outputs[0], sw.inputs['Off'])
    sw.inputs['H'].default_value = 0.5
    lit = _m(n, Lk, 'MULTIPLY', sep.outputs[2], sw.outputs[0])
    litc = ca.outputs['Color']
    if tex is not None:
        # Zufall je Fenster / chance per window
        fl = n.new('ShaderNodeVectorMath')
        fl.operation = 'FLOOR'
        Lk.new(uv.outputs['UV'], fl.inputs[0])
        wn = n.new('ShaderNodeTexWhiteNoise')
        wn.noise_dimensions = '2D'
        Lk.new(fl.outputs[0], wn.inputs['Vector'])
        hs = n.new('ShaderNodeSeparateColor')
        Lk.new(wn.outputs['Color'], hs.inputs[0])
        Lk.new(hs.outputs[1], sw.inputs['H'])
        pane = _m(n, Lk, 'GREATER_THAN', mask, 0.5)
        chosen = _m(n, Lk, 'LESS_THAN', wn.outputs['Value'], sep.outputs[1])
        wl = _m(n, Lk, 'MULTIPLY', _m(n, Lk, 'MULTIPLY', pane, chosen), sw.outputs[0])
        ramp = n.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'CONSTANT'
        els = ramp.color_ramp.elements
        for i, c in enumerate(win_cols):
            e = els[i] if i < 2 else els.new(i / len(win_cols))
            e.position = i / len(win_cols)
            cc = col(c, lit_gain)
            e.color = (cc[0], cc[1], cc[2], 1)
        Lk.new(hs.outputs[2], ramp.inputs[0])
        # eine unbeleuchtete Scheibe spiegelt den Himmel / an unlit pane mirrors the sky
        if glass is not None:
            shaded = _mix(n, Lk, _m(n, Lk, 'MULTIPLY', pane, 0.8), shaded, _rgb(n, 'glass', glass))
        # leuchtende Flaechen ohne Scheibe nehmen ihre Eckenfarbe / glowing faces without a pane take their corner colour
        litc = _mix(n, Lk, pane, ca.outputs['Color'], ramp.outputs['Color'])
        lit = _m(n, Lk, 'MAXIMUM', lit, wl)
    litf = _m(n, Lk, 'MINIMUM', lit, 1.0)
    outc = _mix(n, Lk, litf, shaded, litc)
    _finish(m, outc, keep=_m(n, Lk, 'MULTIPLY', litf, keep))
    _MAT[key] = m
    return m


def sprite_mat(name, tex=None, color=None, add=False, alpha=1.0, keep=0.0, switch=False, attr_col=False, shape=None):
    """
    Flache Karte: Farbe (fest, aus 'Col' oder aus dem Bild) x Deckung (Bild-Alpha oder Form); add = additiv (Lichthoefe),
    switch = haengt an Uhr und 'aux'.x. shape: 'disc' weicher Kreis aus den UV, 'vfade' nach oben auslaufend (v),
    'hfade' zu beiden Seiten und nach v auslaufend (Lichtfinger).
    Flat card: colour (fixed, from 'Col' or from the picture) x alpha (picture alpha or shape); add = additive (halos),
    switch = hangs on the clock and 'aux'.x. shape: 'disc' soft circle from the UV, 'vfade' fading along v, 'hfade'
    fading to both sides and along v (light shafts).
    """
    _alive('clock')
    if name in _MAT:
        return _MAT[name]
    m = bpy.data.materials.new(name)
    nt, n, Lk = L._nodes(m)
    uv = n.new('ShaderNodeUVMap')
    a = None
    c = None
    if tex is not None:
        tx = n.new('ShaderNodeTexImage')
        tx.name = 'tex'
        tx.image = tex
        tx.extension = 'CLIP'
        mp = n.new('ShaderNodeMapping')
        mp.name = 'map'
        Lk.new(uv.outputs['UV'], mp.inputs['Vector'])
        Lk.new(mp.outputs['Vector'], tx.inputs['Vector'])
        a = tx.outputs['Alpha']
        c = tx.outputs['Color']
    sp = n.new('ShaderNodeSeparateXYZ')
    Lk.new(uv.outputs['UV'], sp.inputs[0])
    if shape == 'disc':
        v = n.new('ShaderNodeVectorMath')
        v.operation = 'SUBTRACT'
        Lk.new(uv.outputs['UV'], v.inputs[0])
        v.inputs[1].default_value = (0.5, 0.5, 0)
        ln = n.new('ShaderNodeVectorMath')
        ln.operation = 'LENGTH'
        Lk.new(v.outputs[0], ln.inputs[0])
        d = _m(n, Lk, 'SUBTRACT', 1.0, _m(n, Lk, 'MULTIPLY', ln.outputs['Value'], 2.0), clamp=True)
        a = _m(n, Lk, 'POWER', d, 2.4)
    elif shape == 'vfade':
        d = _m(n, Lk, 'SUBTRACT', 1.0, sp.outputs[1], clamp=True)
        a = _m(n, Lk, 'POWER', d, 1.6)
    elif shape == 'hfade':
        d = _m(n, Lk, 'SUBTRACT', 1.0, sp.outputs[1], clamp=True)
        e = _m(n, Lk, 'SUBTRACT', 1.0, _m(n, Lk, 'ABSOLUTE', _m(n, Lk, 'MULTIPLY_ADD', sp.outputs[0], 2.0, -1.0)), clamp=True)
        a = _m(n, Lk, 'MULTIPLY', _m(n, Lk, 'POWER', d, 1.3), _m(n, Lk, 'POWER', e, 1.5))
    if attr_col:
        ca = n.new('ShaderNodeAttribute')
        ca.attribute_name = 'Col'
        c = ca.outputs['Color'] if c is None else _mix(n, Lk, 1.0, c, ca.outputs['Color'], 'MULTIPLY')
        a = ca.outputs['Alpha'] if a is None else _m(n, Lk, 'MULTIPLY', a, ca.outputs['Alpha'])
    elif color is not None:
        c = _rgb(n, 'color', color)
    av = n.new('ShaderNodeValue')
    av.name = 'alpha'
    av.outputs[0].default_value = alpha
    a = av.outputs[0] if a is None else _m(n, Lk, 'MULTIPLY', a, av.outputs[0])
    if switch:
        ax = n.new('ShaderNodeAttribute')
        ax.attribute_name = 'aux'
        sep = n.new('ShaderNodeSeparateXYZ')
        Lk.new(ax.outputs['Vector'], sep.inputs[0])
        sw = n.new('ShaderNodeGroup')
        sw.node_tree = on_group()
        Lk.new(sep.outputs[0], sw.inputs['Off'])
        Lk.new(sep.outputs[1], sw.inputs['H'])
        a = _m(n, Lk, 'MULTIPLY', a, sw.outputs[0])
    _finish(m, c, keep=keep, alpha=a, add=add)
    _MAT[name] = m
    return m


def set_alpha(mat, a):
    mat.node_tree.nodes['alpha'].outputs[0].default_value = a


def flat_mat(name, color, keep=0.0, shadow=False):
    """Ungeschattete Farbe mit Dunst (Silhouetten, ferne Schichten) / unshaded colour with haze (silhouettes, far layers)"""
    _alive('clock')
    if name in _MAT:
        return _MAT[name]
    m = bpy.data.materials.new(name)
    nt, n, Lk = L._nodes(m)
    _finish(m, _rgb(n, 'color', color), keep=keep, shadow=shadow)
    _MAT[name] = m
    return m


# ---------- Netzbauer / mesh builder ----------
class MeshB:
    """
    Sammelt Flaechen mit Eckenfarbe, UV, Lichtdaten (aux = Abschaltzeit, Fensterdichte, Leuchten) und Materialnummer
    und baut daraus ein Netz. Eine Matrix (push/pop) setzt ganze Bauwerke. Tusche als umgedrehte Huelle, deren Staerke
    je Ecke der Entfernung zur Kamera folgt (gleich breite Linie im Bild).
    Collects faces with corner colour, UV, light data (aux = switch-off time, window density, glow) and material index
    and builds a mesh from them. A matrix (push/pop) places whole buildings. Ink as an inverted hull whose strength per
    vertex follows the distance to the camera (a line of equal width in the picture).
    """

    def __init__(self):
        self.v, self.f, self.uv, self.c, self.a, self.mi, self.sm = [], [], [], [], [], [], []
        self.stack = [Matrix.Identity(4)]
        self.off, self.dens = NEVER, 0.5
        # Tuschestaerke der folgenden Flaechen (duenne Staebe: klein) / ink strength of the following faces (thin rods: small)
        self.ink, self.iw = 1.0, []

    @property
    def m(self):
        return self.stack[-1]

    def push(self, x=0.0, y=0.0, z=0.0, rot=0.0, scale=1.0):
        s = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
        M = Matrix.Translation((x, y, z)) @ Matrix.Rotation(math.radians(rot), 4, 'Z') @ Matrix.Diagonal((s[0], s[1], s[2], 1.0))
        self.stack.append(self.m @ M)
        return self

    def pop(self):
        self.stack.pop()

    def face(self, pts, color, mat=0, uvs=None, grad=None, emit=0.0, smooth=False, off=None, dens=None):
        k = len(self.v)
        M = self.m
        for p in pts:
            self.v.append(tuple(M @ Vector(p)))
            self.iw.append(self.ink)
        self.f.append(tuple(range(k, k + len(pts))))
        c = col(color)
        for i in range(len(pts)):
            g = 1.0 if grad is None else grad[i]
            self.c.append((c[0], c[1], c[2], g))
            self.uv.append(uvs[i] if uvs else (0.5, 0.5))
            self.a.append((self.off if off is None else off, self.dens if dens is None else dens, emit))
        self.mi.append(mat)
        self.sm.append(smooth)

    def box(self, x0, y0, z0, x1, y1, z1, color, mat=0, top=None, top_mat=0, bay=None, floor=None, uo=0, g0=1.0, g1=1.0, emit=0.0,
            bottom=False, sides='nsew', dens=None, cap=True):
        """
        Quader; mit bay/floor bekommen die Seiten Fassaden-UV (ganze Felder), top = Farbe des Dachs.
        Box; with bay/floor the sides get facade UVs (whole cells), top = roof colour.
        """
        w, d, h = x1 - x0, y1 - y0, z1 - z0
        nf = max(1, round(h / floor)) if floor else 1
        for key, (a, b, ln) in {'s': ((x0, y0), (x1, y0), w), 'e': ((x1, y0), (x1, y1), d), 'n': ((x1, y1), (x0, y1), w), 'w': ((x0, y1), (x0, y0), d)}.items():
            if key not in sides:
                continue
            nb = max(1, round(ln / bay)) if bay else 1
            u0 = uo + {'s': 0, 'e': 31, 'n': 67, 'w': 101}[key]
            uvs = [(u0, 0), (u0 + nb, 0), (u0 + nb, nf), (u0, nf)]
            self.face([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], color, mat, uvs, (g0, g0, g1, g1), emit, dens=dens)
        if cap:
            tc = top if top is not None else color
            self.face([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], tc, top_mat, None, (g1,) * 4, emit)
        if bottom:
            self.face([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], color, top_mat, None, (g0,) * 4, emit)

    def cbox(self, cx, cy, z0, w, d, h, color, **kw):
        self.box(cx - w / 2, cy - d / 2, z0, cx + w / 2, cy + d / 2, z0 + h, color, **kw)

    def gable(self, x0, y0, x1, y1, z, h, color, wall=None, axis='x', over=0.0, mat=0):
        """Satteldach, First entlang axis / gable roof, ridge along axis"""
        wall = color if wall is None else wall
        o = over
        a, b, c2, d = (x0 - o, y0 - o, z), (x1 + o, y0 - o, z), (x1 + o, y1 + o, z), (x0 - o, y1 + o, z)
        if axis == 'x':
            ym = (y0 + y1) / 2
            r0, r1 = (x0 - o, ym, z + h), (x1 + o, ym, z + h)
            self.face([a, b, r1, r0], color, mat)
            self.face([c2, d, r0, r1], color, mat)
            self.face([(x0, y1, z), (x0, y0, z), (x0, ym, z + h)], wall, mat)
            self.face([(x1, y0, z), (x1, y1, z), (x1, ym, z + h)], wall, mat)
        else:
            xm = (x0 + x1) / 2
            r0, r1 = (xm, y0 - o, z + h), (xm, y1 + o, z + h)
            self.face([b, c2, r1, r0], color, mat)
            self.face([d, a, r0, r1], color, mat)
            self.face([(x0, y0, z), (x1, y0, z), (xm, y0, z + h)], wall, mat)
            self.face([(x1, y1, z), (x0, y1, z), (xm, y1, z + h)], wall, mat)

    def frustum(self, x0, y0, x1, y1, z, h, inset, color, top=None, mat=0):
        """Walm- oder Mansarddach: nach innen geneigte Seiten, flacher Deckel / hip or mansard roof"""
        i = inset
        lo = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]
        hi = [(x0 + i, y0 + i, z + h), (x1 - i, y0 + i, z + h), (x1 - i, y1 - i, z + h), (x0 + i, y1 - i, z + h)]
        for k in range(4):
            self.face([lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k]], color, mat)
        self.face(hi, color if top is None else top, mat)

    def revolve(self, cx, cy, profile, color, n=16, mat=0, smooth=True, a0=0.0, a1=360.0, colors=None, emit=0.0, cap=True):
        """Drehkoerper aus einem Profil [(Radius, z)] / solid of revolution from a profile [(radius, z)]"""
        full = abs(a1 - a0) >= 360
        steps = n if full else max(2, int(n * abs(a1 - a0) / 360))
        ang = [math.radians(a0 + (a1 - a0) * i / steps) for i in range(steps + 1)]
        for j in range(len(profile) - 1):
            (r0, z0), (r1, z1) = profile[j], profile[j + 1]
            cc = colors[j] if colors is not None else color
            for i in range(steps):
                ta, tb = ang[i], ang[i + 1]
                p = [(cx + math.cos(ta) * r0, cy + math.sin(ta) * r0, z0), (cx + math.cos(tb) * r0, cy + math.sin(tb) * r0, z0),
                     (cx + math.cos(tb) * r1, cy + math.sin(tb) * r1, z1), (cx + math.cos(ta) * r1, cy + math.sin(ta) * r1, z1)]
                if r1 < 1e-6:
                    p = p[:3]
                elif r0 < 1e-6:
                    p = [p[0], p[2], p[3]]
                self.face(p, cc, mat, None, None, emit, smooth)
        if cap and profile[-1][0] > 1e-6:
            r, z = profile[-1]
            self.face([(cx + math.cos(a) * r, cy + math.sin(a) * r, z) for a in ang[:steps]], colors[-1] if colors is not None else color, mat, None, None, emit)

    def cyl(self, cx, cy, z0, r, h, color, n=10, r2=None, **kw):
        self.revolve(cx, cy, [(r, z0), (r if r2 is None else r2, z0 + h)], color, n=n, **kw)

    def tube(self, a, b, r, color, n=6, mat=0, emit=0.0, r2=None):
        """Stab von a nach b (Kranausleger, Masten, Gelaender) / rod from a to b (crane jibs, masts, rails)"""
        a, b = Vector(a), Vector(b)
        d = (b - a)
        if d.length < 1e-6:
            return
        q = d.to_track_quat('Z', 'Y').to_matrix()
        r2 = r if r2 is None else r2
        dirs = [q @ Vector((math.cos(2 * math.pi * i / n), math.sin(2 * math.pi * i / n), 0)) for i in range(n)]
        ring0 = [a + v * r for v in dirs]
        ring1 = [b + v * r2 for v in dirs]
        for i in range(n):
            self.face([ring0[i], ring0[(i + 1) % n], ring1[(i + 1) % n], ring1[i]], color, mat, None, None, emit, n > 4)
        self.face(ring1, color, mat, None, None, emit)
        self.face(ring0[::-1], color, mat, None, None, emit)

    def card(self, p, w, h, cam, color, mat=0, alpha=1.0, off=None, hsh=0.5, up=None, uvr=None):
        """Karte um p, der Kamera zugewandt (Lichthoefe, Schilder, Figuren); uvr = Ausschnitt eines Bogens / card around p facing the camera; uvr = cut-out of a sheet"""
        P = self.m @ Vector(p)
        d = (Vector(cam) - P).normalized()
        r = Vector((0, 0, 1)).cross(d)
        r = r.normalized() if r.length > 1e-6 else Vector((1, 0, 0))
        u = Vector(up) if up is not None else d.cross(r).normalized()
        k = len(self.v)
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            self.v.append(tuple(P + r * sx * w / 2 + u * sy * h / 2))
            self.iw.append(0.0)
        self.f.append((k, k + 1, k + 2, k + 3))
        c = col(color)
        u0, v0, u1, v1 = uvr or (0, 0, 1, 1)
        for uvp in ((u0, v0), (u1, v0), (u1, v1), (u0, v1)):
            self.c.append((c[0], c[1], c[2], alpha))
            self.uv.append(uvp)
            self.a.append((self.off if off is None else off, hsh, 1.0))
        self.mi.append(mat)
        self.sm.append(False)

    def build(self, shot, name, mats, ink=None, cam=None, weld=True, shadow=True, ink_max=None):
        """
        Netz bauen. ink = Linienbreite in Bildpunkten (1280er Leinwand) oder None; cam = Kamerastandpunkt fuer die
        Linienstaerke (Standard: aktuelle Kamera). / build the mesh. ink = line width in pixels (1280 canvas) or None;
        cam = camera position for the line strength (default: current camera).
        """
        me = bpy.data.meshes.new(name)
        if not self.f:
            self.face([(0, 0, -1e4), (0.001, 0, -1e4), (0, 0.001, -1e4)], (0, 0, 0))
        me.from_pydata(self.v, [], self.f)
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        ca.data.foreach_set('color', np.asarray(self.c, np.float32).ravel())
        ax = me.attributes.new('aux', 'FLOAT_VECTOR', 'CORNER')
        ax.data.foreach_set('vector', np.asarray(self.a, np.float32).ravel())
        uv = me.uv_layers.new(name='UVMap')
        uv.data.foreach_set('uv', np.asarray(self.uv, np.float32).ravel())
        if len(self.iw) == len(self.v):
            ia = me.attributes.new('inkscale', 'FLOAT', 'POINT')
            ia.data.foreach_set('value', np.asarray(self.iw, np.float32))
        me.polygons.foreach_set('material_index', np.asarray(self.mi, np.int32))
        me.polygons.foreach_set('use_smooth', np.asarray(self.sm, bool))
        for m in mats:
            me.materials.append(m)
        if weld:
            import bmesh
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-3)
            bm.to_mesh(me)
            bm.free()
        me.update()
        ob = bpy.data.objects.new(name, me)
        shot.sc.collection.objects.link(ob)
        ob.visible_shadow = shadow
        if ink:
            add_ink(shot, ob, ink, cam, ink_max)
        return ob


def add_ink(shot, ob, px=2.0, cam=None, max_dist=None):
    """
    Tuschehuelle mit Staerke nach Entfernung je Ecke (Gewichtsgruppe): die Linie bleibt im Bild gleich breit, auch in
    einem Netz, das von vorn bis zum Horizont reicht. max_dist: dahinter keine Linie mehr (ferne Schichten sind gemalt).
    Ink hull with strength by distance per vertex (weight group): the line keeps its width in the picture, even in a
    mesh reaching from the front to the horizon. max_dist: no line beyond it (far layers are painted).
    """
    me = ob.data
    cam = Vector(cam) if cam is not None else Vector(shot.cam.location)
    co = np.empty(len(me.vertices) * 3, np.float64)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    Mw = np.array(ob.matrix_world)
    wco = co @ Mw[:3, :3].T + Mw[:3, 3]
    d = np.linalg.norm(wco - np.array(cam), axis=1)
    far = max(float(d.max()), 1.0)
    w = np.clip(d / far, 0.0, 1.0)
    if max_dist:
        w = w * np.clip((max_dist - d) / (0.25 * max_dist), 0, 1)
    if 'inkscale' in me.attributes and len(me.attributes['inkscale'].data) == len(w):
        sc = np.empty(len(w), np.float32)
        me.attributes['inkscale'].data.foreach_get('value', sc)
        w = w * sc
    vg = ob.vertex_groups.new(name='inkw')
    # Gewichte in Stufen setzen (schnell genug fuer grosse Netze) / set weights in steps (fast enough for big meshes)
    q = np.round(w * 127).astype(int)
    for level in np.unique(q):
        idx = np.nonzero(q == level)[0]
        vg.add(idx.tolist(), float(level) / 127.0, 'REPLACE')
    if L.ink_mat().name not in [s.name for s in me.materials if s]:
        me.materials.append(L.ink_mat())
    mod = ob.modifiers.new('ink', 'SOLIDIFY')
    mod.thickness = -shot.px(far) * px * L.HULL / max(1e-6, max(ob.scale))
    mod.vertex_group = 'inkw'
    mod.thickness_vertex_group = 0.0
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(me.materials) - 1
    mod.use_even_offset = False
    return ob
