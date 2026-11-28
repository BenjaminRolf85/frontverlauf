"""
8 Das Tor (62-70 s): Kamerafahrt durch das Tor der Zyrr. Dahinter die violette Landschaft ihrer Heimat mit zwei
Monden, wie sie den Planeten umformen wollen, dann die rote Wueste mit alten Ruinen Verdans, in die ab 5,4 s violetter
Xeno-Boden vordringt und fremde Kristalle spriessen (Kanon docs/lore.md: der Schwarm macht den Planeten zur zweiten
Heimat).
8 The gate (62-70 s): camera flight through the Zyrr gate. Behind it the violet landscape of their home with two moons,
as they want to reshape the planet, then the red desert with old Verdan ruins into which violet xeno-soil spreads from
5.4 s and alien crystals sprout (canon docs/lore.md: the swarm turns the planet into a second home).
"""
import math
import random

from mathutils import Euler, Vector

from .. import kit as K
from .. import lib as L

T1, T2 = 2.6, 5.2


def swirl(shot, name, c1, c2):
    """Wirbelscheibe (Spirale aus Wellentextur), unbeleuchtet / swirl disc (spiral from a wave texture), unlit"""
    import bpy
    m = bpy.data.materials.new(name)
    nt, n, Lk = L._nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    tc = n.new('ShaderNodeTexCoord')
    wave = n.new('ShaderNodeTexWave')
    wave.wave_type = 'RINGS'
    wave.inputs['Scale'].default_value = 3.0
    wave.inputs['Distortion'].default_value = 6.0
    wave.name = 'wave'
    Lk.new(tc.outputs['Object'], wave.inputs['Vector'])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    e = ramp.color_ramp.elements
    e[0].color, e[1].position, e[1].color = L.rgb(c1), 0.5, L.rgb(c2)
    Lk.new(wave.outputs['Fac'], ramp.inputs[0])
    em = n.new('ShaderNodeEmission')
    Lk.new(ramp.outputs[0], em.inputs[0])
    Lk.new(em.outputs[0], out.inputs[0])
    return m


def xeno_soil(shot, color, origin, name='xenosoil'):
    """
    Violetter Xeno-Boden: Comic-Ton, sichtbar innerhalb eines wachsenden Radius um origin mit ausgefranstem Rand
    (Rauschen); Regler 'radius' je Bild.
    Violet xeno-soil: comic tone, visible within a growing radius around origin with a frayed edge (noise); control
    'radius' per frame.
    """
    import bpy
    m = bpy.data.materials.new(name)
    nt, n, Lk = L._nodes(m)
    out = n.new('ShaderNodeOutputMaterial')
    tg = n.new('ShaderNodeGroup')
    tg.node_tree = shot.toon.g
    tg.inputs['Base'].default_value = L.rgb(color)
    em = n.new('ShaderNodeEmission')
    Lk.new(tg.outputs[0], em.inputs[0])
    geo = n.new('ShaderNodeNewGeometry')
    sub = n.new('ShaderNodeVectorMath')
    sub.operation = 'SUBTRACT'
    sub.inputs[1].default_value = origin
    Lk.new(geo.outputs['Position'], sub.inputs[0])
    flat = n.new('ShaderNodeVectorMath')
    flat.operation = 'MULTIPLY'
    flat.inputs[1].default_value = (1, 1, 0)
    Lk.new(sub.outputs[0], flat.inputs[0])
    ln = n.new('ShaderNodeVectorMath')
    ln.operation = 'LENGTH'
    Lk.new(flat.outputs[0], ln.inputs[0])
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 0.035
    noise.inputs['Detail'].default_value = 2.0
    Lk.new(geo.outputs['Position'], noise.inputs['Vector'])
    fray = n.new('ShaderNodeMath')
    fray.operation = 'MULTIPLY_ADD'
    fray.inputs[1].default_value = 70.0
    fray.inputs[2].default_value = -35.0
    Lk.new(noise.outputs['Fac'], fray.inputs[0])
    dist = n.new('ShaderNodeMath')
    dist.operation = 'ADD'
    Lk.new(ln.outputs['Value'], dist.inputs[0])
    Lk.new(fray.outputs[0], dist.inputs[1])
    rad = n.new('ShaderNodeValue')
    rad.name = 'radius'
    rad.outputs[0].default_value = 0.0
    inside = n.new('ShaderNodeMath')
    inside.operation = 'LESS_THAN'
    Lk.new(dist.outputs[0], inside.inputs[0])
    Lk.new(rad.outputs[0], inside.inputs[1])
    tr = n.new('ShaderNodeBsdfTransparent')
    mx = n.new('ShaderNodeMixShader')
    Lk.new(inside.outputs[0], mx.inputs[0])
    Lk.new(tr.outputs[0], mx.inputs[1])
    Lk.new(em.outputs[0], mx.inputs[2])
    Lk.new(mx.outputs[0], out.inputs[0])
    try:
        m.surface_render_method = 'DITHERED'
    except AttributeError:
        m.blend_method = 'HASHED'
    return m


def build():
    s = L.Shot(L.shot_dur('gate'))
    R = random.Random(51)
    s.toon.night()
    s.sunlight(rot=(0.9, 0.1, 2.2), strength=math.pi * 0.9)
    L.sky(s, [(-1, 'alienSky900'), (0.0, 'alienSky500'), (0.25, 'alienSky700'), (1, 'alienSky900')], stars=1.0)
    s.cam.data.lens = 28
    # Erde: Tor in der Wueste bei Nacht / Earth: gate in the desert at night
    L.ground(s, 'xeno600', size=300, sub=2)
    gate = L.model(s, 'portal_2', loc=(0, 0, 0), scale=6)
    sw = swirl(s, 'swirl', 'alienSky500', 'alienGlow')
    disc = L.prim(s, 'cyl', sw, loc=(0, 0.3, 4.6 * 1.38 * 0.55 * 6 / 6 * 1.0 + 0.0), size=(30, 30, 0.2), rot=(math.pi / 2, 0, 0), segments=32, ink=False)
    # Heimatwelt der Zyrr / Zyrr homeworld
    X = 2000
    L.ground(s, 'alienGround500', size=900, sub=40, loc=(X, 0, 0), height=K.hills(3, 0.03, 4))
    for i in range(26):
        x, y = X + R.uniform(-160, 160), R.uniform(40, 360)
        kind = R.choice(['ico', 'cone', 'uv'])
        col = R.choice(['alienCrystal300', 'alienMoss500', 'alienCrystal500', 'xeno400'])
        L.prim(s, kind, L.toon(s, col, glow=0.4 if 'Crystal' in col else 0), loc=(x, y, R.uniform(2, 8)), size=(R.uniform(5, 12), R.uniform(5, 12), R.uniform(8, 26)), sub=1)
    for k, (x, z, r, c) in enumerate(((X - 120, 150, 50, 'alienMoon100'), (X + 160, 110, 26, 'alienMoonAcid'))):
        L.prim(s, 'cyl', L.flat(c), loc=(x, 700, z), size=(r * 2, r * 2, 1), rot=(math.pi / 2, 0, 0), segments=32, ink=False)
    nest = L.model(s, 'city_zyrr_5', loc=(X + 30, 120, 0), rot=200, scale=5)
    rift = L.prim(s, 'cyl', swirl(s, 'rift', 'rift700', 'riftGold'), loc=(X, 200, 30), size=(36, 36, 0.2), rot=(math.pi / 2, 0, 0), segments=32, ink=True)
    # Dritte Welt: rote Wueste / third world: red desert
    Y = 4000
    L.ground(s, 'marsSand500', size=900, sub=40, loc=(Y, 0, 0), height=K.dunes(3))
    for i, n in enumerate(['verdan_desert_ruin_1', 'verdan_desert_ruin_0', 'verdan_desert_ruin_3', 'verdan_desert_ruin_2', 'verdan_desert_ruin_1']):
        x, y = Y - 60 + i * 30 + R.uniform(-6, 6), 60 + (i % 2) * 40
        L.model(s, n, loc=(x, y, 1), rot=R.uniform(0, 360), scale=9)
    L.prim(s, 'cyl', L.flat('marsSun'), loc=(Y + 90, 700, 120), size=(70, 70, 1), rot=(math.pi / 2, 0, 0), segments=32, ink=False)
    # Xeno-Boden der Zyrr breitet sich ueber die Wueste aus, Kristalle spriessen / the Zyrr xeno-soil spreads over the desert, crystals sprout
    SOIL0 = Vector((Y - 52, -22, 0))
    soil_m = xeno_soil(s, 'xeno600', SOIL0)
    dh = K.dunes(3)
    soil = L.ground(s, soil_m, size=600, sub=60, loc=(Y, 0, 0), height=lambda xx, yy: dh(xx, yy) + 0.35, name='xenosoil')
    soil.visible_shadow = False
    crystals = []
    for i in range(16):
        a_ = R.uniform(-0.3, 1.5)
        r_ = R.uniform(15, 150)
        cx, cy = SOIL0.x + math.cos(a_) * r_, SOIL0.y + math.sin(a_) * r_
        col = R.choice(['alienCrystal300', 'alienCrystal500', 'xeno400', 'alienMoss500'])
        ob = L.prim(s, R.choice(['cone', 'ico']), L.toon(s, col, glow=0.35), loc=(cx, cy, dh(cx, cy)), size=1.0, sub=1, px=2.6)
        crystals.append((ob, r_, R.uniform(4, 9), R.uniform(10, 24)))
    SPREAD = (5.4, 8.2, 165.0)
    worlds_sky = [
        [(-1, 'alienSky900'), (0.0, 'alienSky500'), (0.25, 'alienSky700'), (1, 'alienSky900')],
        [(-1, 'alienSky700'), (0.0, 'alienHaze'), (0.25, 'alienSky500'), (1, 'alienSky900')],
        [(-1, 'marsSky700'), (0.0, 'marsSunset'), (0.25, 'marsSky500'), (1, 'marsSky900')],
    ]
    flash = L.cam_plane(s, L.flat('white', alpha=0.0, name='gateflash'), dist=1.0, scale=1.2)
    disc_z = 0.72 * 10 * 6

    @s.on
    def update(t):
        stage = 0 if t < T1 else 1 if t < T2 else 2
        cr = L.sky_ramp(s)
        for i, (pos, c) in enumerate(worlds_sky[stage]):
            cr.elements[i].color = L.rgb(c)
        if stage == 0:
            disc.location = (0, 0.6, disc_z)
            disc.scale = (34, 34, 0.2)
            p = L.ease_in(L.seg(t, 0, T1))
            s.look(L.vlerp((0, -150, 22), (0, -3, disc_z), p), (0, 10, disc_z * (0.8 + 0.2 * p)))
            s.toon.set_light((0.16, 0.17, 0.30, 1), (0.30, 0.32, 0.50, 1), (0.55, 0.58, 0.80, 1))
        elif stage == 1:
            p = L.ease_io(L.seg(t, T1, T2))
            s.look(L.vlerp((X, -40, 20), (X, 120, 32), p), (X, 210, 30))
            s.toon.set_light((0.3, 0.2, 0.42, 1), (0.6, 0.45, 0.7, 1), (0.95, 0.85, 1.0, 1))
        else:
            p = L.ease_out(L.seg(t, T2, s.dur))
            s.look(L.vlerp((Y - 20, -70, 26), (Y + 5, -40, 30), p), (Y + 10, 90, 18))
            s.toon.set_light((0.42, 0.22, 0.24, 1), (0.75, 0.48, 0.42, 1), (1.0, 0.86, 0.74, 1))
        grow = L.ease_io(L.seg(t, SPREAD[0], SPREAD[1])) * SPREAD[2]
        soil_m.node_tree.nodes['radius'].outputs[0].default_value = grow
        for ob, r_, w_, h_ in crystals:
            k = L.ease_back(L.seg(grow - r_, 0, 18)) if grow > r_ else 0.0
            ob.scale = (max(w_ * k, 0.001), max(w_ * k, 0.001), max(h_ * k, 0.001))
        wv = disc.material_slots[0].material.node_tree.nodes['wave']
        wv.inputs['Phase Offset'].default_value = -t * 8
        rift.material_slots[0].material.node_tree.nodes['wave'].inputs['Phase Offset'].default_value = -t * 6
        d = min(abs(t - T1), abs(t - T2))
        K.set_alpha(flash.material_slots[0].material, L.clamp(1 - d / 0.25) if t > 1.0 else 0.0)

    update(0)
    return s
