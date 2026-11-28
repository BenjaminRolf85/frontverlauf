"""
1 Die alte Welt (0-16 s), Kanon docs/lore.md: die Weltrepublik Meridon und der Grosse Stillstand.
0-8 s: Hafenstadt Meridons in der Abenddaemmerung. Mittelpunkt ist die grosse Bank (Saeulen, Kuppel, Emblem Meridons)
mit einem Laufschriftband voller Kurse; Fenster leuchten, Frachter liegen am Kai, Kraene schwenken, Muenzen stroemen vom
Hafen in die Bank. Die Kamera faehrt ruhig auf die Bank zu.
Ab 8,4 s der Grosse Stillstand: die Laufschrift flackert und erlischt (9,0 s), dann gehen die Lichter Viertel fuer
Viertel von hinten zur Kamera hin aus (bis 11,8 s), Kraene, Schiffe und Muenzen bleiben stehen bzw. fallen. Danach ist
alles dunkel bis auf das kalt leuchtende Rechenzentrum von NEXUS am Horizont, auf das die Kamera zuletzt schaut.
1 The old world (0-16 s), canon docs/lore.md: the world republic of Meridon and the Great Standstill.
0-8 s: Meridon's harbour city at dusk. The focal point is the grand bank (columns, dome, Meridon emblem) with a ticker
band full of prices; windows glow, freighters lie at the quay, cranes swing, coins stream from the harbour into the
bank. The camera moves calmly towards the bank.
From 8.4 s the Great Standstill: the ticker flickers and dies (9.0 s), then the lights go out district by district from
the back towards the camera (until 11.8 s), cranes, ships and coins stop or fall. Afterwards everything is dark except
the cold-lit NEXUS data centre on the horizon, which the camera looks at last.
"""
import math
import random

from mathutils import Euler, Vector

from .. import kit as K
from .. import lib as L

# Zeitpunkte, an denen die Klangspur haengt (src/intro/filmScore.ts) / moments the soundtrack hangs on (src/intro/filmScore.ts)
FLICKER = 8.4   # Laufschrift flackert, Stromausfall beginnt / ticker flickers, the power-down starts
TICK_DIE = 9.0  # Laufschrift aus / ticker dead
WAVE = (9.0, 11.8)  # Lichter gehen von hinten nach vorne aus / lights go out from back to front
BLACK = 11.8    # letzte Lampe aus, Stille / last lamp out, silence

BANK = Vector((0, 70, 0))
NEXUS = Vector((150, 440, 0))


def off_time(y):
    """Abschaltzeit nach Tiefe: hinten zuerst, vorne zuletzt / switch-off time by depth: back first, front last"""
    return L.lerp(WAVE[0], WAVE[1], L.clamp((220 - y) / 260))


class Lights:
    """
    Fensterflaechen und Lampen (eigene Objekte, leuchtendes Material) und Fenster der Spielmodelle (lightsoff), jedes mit
    eigener Abschaltzeit und kurzem Flackern davor.
    Window panes and lamps (own objects, glowing material) and windows of the game models (lightsoff), each with its own
    switch-off time and a short flicker before.
    """

    def __init__(self, shot):
        self.panes, self.models = [], []
        self.dark = L.toon(shot, 'ink800')

    def pane(self, ob, at, lit, hide=False):
        """hide: aus heisst unsichtbar (Lichtkreise) statt dunkel / hide: off means invisible (light pools) instead of dark"""
        self.panes.append((ob, at, lit, hide))
        return ob

    def model(self, ob, at):
        self.models.append((ob, at))
        return ob

    @staticmethod
    def level(t, at):
        """1 an, 0 aus; Flackern in den 0,35 s davor / 1 on, 0 off; flicker in the 0.35 s before"""
        if t >= at:
            return 0.0
        if t > at - 0.35:
            return 1.0 if int(t * 24 + at * 7) % 3 else 0.0
        return 1.0

    def update(self, t):
        for ob, at, lit, hide in self.panes:
            on = self.level(t, at) > 0.5
            if hide:
                L.hide(ob, not on)
            else:
                ob.data.materials[0] = lit if on else self.dark
        for ob, at in self.models:
            v = 1.0 - self.level(t, at)
            ob['lightsoff'] = v
            ob['glowoff'] = v
            ob.update_tag()


def windows(shot, lights, lit, x, y, z0, w, rows, cols, depth_y=None, gap=0.8, size=(1.6, 2.2), at=None):
    """Fensterraster auf einer Fassade (Normale -y) / window grid on a facade (normal -y)"""
    out = []
    for r in range(rows):
        for c in range(cols):
            px = x - w / 2 + (c + 0.5) * w / cols
            pz = z0 + r * (size[1] + gap * 1.6)
            ob = L.prim(shot, 'cube', lit, loc=(px, y, pz), size=(size[0], 0.3, size[1]), ink=False)
            lights.pane(ob, at if at is not None else off_time(y), lit)
            out.append(ob)
    return out


def bank(shot, lights, lit):
    """Die grosse Bank Meridons aus Grundformen / Meridon's grand bank from primitives"""
    tok = L.tokens()['faction']['meridon']
    stone, stone2, gold = L.toon(shot, 'paper100'), L.toon(shot, 'paper200'), L.toon(shot, 'gold')
    teal, orange = L.toon(shot, tok['primary']), L.toon(shot, tok['secondary'])
    x, y = BANK.x, BANK.y
    # Treppe / steps
    for i in range(4):
        L.prim(shot, 'cube', stone2 if i % 2 else stone, loc=(x, y - 4 + i * 1.2, 0.6 + i * 1.2), size=(64 - i * 3, 30 - i * 2.2, 1.2))
    base = 4.8
    # Baukoerper / body
    L.prim(shot, 'cube', stone, loc=(x, y + 4, base + 13), size=(52, 22, 26))
    windows(shot, lights, lit, x, y - 7.2, base + 4.5, 44, 3, 9, size=(2.0, 3.4), gap=1.4)
    # Saeulen / columns
    for i in range(10):
        cx = x - 25 + i * (50 / 9)
        L.prim(shot, 'cyl', L.toon(shot, 'paper50'), loc=(cx, y - 10, base + 11), size=(2.6, 2.6, 22), segments=12, px=2.4)
        L.prim(shot, 'cube', stone2, loc=(cx, y - 10, base + 0.6), size=(3.6, 3.6, 1.2), px=2.4)
        L.prim(shot, 'cube', stone2, loc=(cx, y - 10, base + 22.4), size=(3.6, 3.6, 1.2), px=2.4)
    # Gebaelk mit Laufschriftband / entablature with the ticker band
    L.prim(shot, 'cube', stone, loc=(x, y - 9, base + 24.6), size=(56, 6, 3.2))
    band_z = base + 24.6
    band = L.prim(shot, 'cube', L.toon(shot, 'ink900'), loc=(x, y - 12.15, band_z), size=(50, 0.5, 3.4), px=2.0)
    # Giebel / pediment
    v = [(-29, 0, 0), (29, 0, 0), (0, 0, 9), (-29, 6, 0), (29, 6, 0), (0, 6, 9)]
    f = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    L.mesh_obj(shot, 'pediment', v, f, stone, loc=(x, y - 12, base + 26.2), ink=True, px=3.0)
    # Emblem Meridons im Giebel: Scheibe mit vierzackigem Stern / Meridon emblem in the pediment: disc with a four-pointed star
    L.prim(shot, 'cyl', gold, loc=(x, y - 12.3, base + 29.4), size=(7.4, 7.4, 0.4), rot=(math.pi / 2, 0, 0), segments=28, px=2.0)
    L.prim(shot, 'cyl', teal, loc=(x, y - 12.6, base + 29.4), size=(6.2, 6.2, 0.4), rot=(math.pi / 2, 0, 0), segments=28, ink=False)
    star = []
    for k in range(8):
        a = k * math.pi / 4
        r = 2.8 if k % 2 == 0 else 0.9
        star.append((math.sin(a) * r, 0, math.cos(a) * r))
    L.mesh_obj(shot, 'star', [(0, 0, 0)] + star, [(0, 1 + k, 1 + (k + 1) % 8) for k in range(8)], L.toon(shot, 'paper50'),
               loc=(x, y - 12.9, base + 29.4))
    # Tambour und Kuppel / drum and dome
    L.prim(shot, 'cyl', stone2, loc=(x, y + 6, base + 30), size=(24, 24, 8), segments=24)
    windows_drum = []
    for k in range(9):
        a = math.radians(-60 + k * 15)
        ob = L.prim(shot, 'cube', lit, loc=(x + math.sin(a) * 12.1, y + 6 - math.cos(a) * 12.1, base + 30), size=(1.4, 0.3, 4.0),
                    rot=(0, 0, a), ink=False)
        lights.pane(ob, off_time(y) - 0.2, lit)
        windows_drum.append(ob)
    L.prim(shot, 'uv', teal, loc=(x, y + 6, base + 34), size=(23, 23, 22), segments=24, smooth=False)
    L.prim(shot, 'cyl', gold, loc=(x, y + 6, base + 45.5), size=(1.4, 1.4, 4), segments=8, px=2.0)
    L.prim(shot, 'uv', gold, loc=(x, y + 6, base + 48), size=(2.4, 2.4, 2.4), segments=10, px=2.0)
    # Fahnen Meridons auf dem Dach / Meridon flags on the roof
    flags = []
    for sx in (-22, 22):
        ob, wave = K.flag(shot, tok['primary'], (x + sx, y - 2, base + 26), w=7, h=4.4, pole=12, stripe=tok['secondary'])
        flags.append(wave)
    return band, band_z, flags, orange


class Ticker:
    """Laufschrift mit Kursen (nur Ziffern und Pfeile, sprachneutral) / ticker with prices (digits and arrows only, language neutral)"""

    def __init__(self, shot, x, y, z, width, lit):
        self.items = []
        R = random.Random(5)
        self.x, self.w = x, width
        dark = L.flat('ink700')
        self.lit, self.dark = lit, dark
        up = L.flat('green500')
        self.up = up
        pos = 0.0
        self.span = 0.0
        for i in range(12):
            body = '%d.%02d' % (R.randint(12, 980), R.randint(0, 99))
            ob = L.text_obj(shot, body, size=2.8, extrude=0.02, loc=(0, y - 0.35, z - 0.05), ink=False)
            ob.data.materials[0] = lit
            # Pfeil nach oben als Dreieck / up arrow as a triangle
            ar = L.mesh_obj(shot, 'arrow', [(-0.6, 0, -0.5), (0.6, 0, -0.5), (0, 0, 0.6)], [(0, 1, 2)], up, loc=(0, y - 0.4, z))
            wlen = len(body) * 1.4 + 3.6
            self.items.append((ob, ar, pos, len(body) * 1.4))
            pos += wlen
        self.span = pos
        self.z = z

    def update(self, t, on, speed=7.0):
        for ob, ar, p, ln in self.items:
            # von rechts nach links, umlaufend / right to left, wrapping
            u = (p - t * speed) % self.span - self.span / 2 + self.w / 2
            cx = self.x + u
            vis = abs(u) < self.w / 2 - ln / 2 - 1.2
            ob.location.x = cx - ln / 2 + 0.6
            ar.location.x = cx - ln / 2 - 0.8
            ob.data.materials[0] = self.lit if on else self.dark
            ar.data.materials[0] = self.up if on else self.dark
            L.hide(ob, not vis)
            L.hide(ar, not vis)


def crane(shot, loc, rot, color='yellow400'):
    """Hafenkran: Turm, Fuehrerhaus, drehbarer Ausleger mit Last / harbour crane: tower, cab, rotating jib with a load"""
    mat, ink = L.toon(shot, color), L.toon(shot, 'ink700')
    x, y, z = loc
    L.prim(shot, 'cube', ink, loc=(x, y, z + 1), size=(6, 6, 2))
    L.prim(shot, 'cube', mat, loc=(x, y, z + 13), size=(2.4, 2.4, 24), px=2.4)
    pivot = L.prim(shot, 'cube', mat, loc=(x, y, z + 26), size=(4, 4, 3.4), px=2.4)
    pivot.rotation_euler = Euler((0, 0, math.radians(rot)))
    jib = L.prim(shot, 'cube', mat, loc=(0, 0, 0), size=(1.0, 1.0, 1.0), px=2.4)
    jib.parent = pivot
    jib.location = (0, -4.2, 0.4)
    jib.scale = (1.4 / 4, 22 / 4, 1.2 / 3.4)
    cw = L.prim(shot, 'cube', ink, loc=(0, 0, 0), size=1.0, px=2.4)
    cw.parent = pivot
    cw.location = (0, 1.6, 0)
    cw.scale = (3.2 / 4, 3 / 4, 2.2 / 3.4)
    cable = L.prim(shot, 'cube', ink, loc=(0, 0, 0), size=1.0, ink=False)
    cable.parent = pivot
    cable.location = (0, -12.4 / 4 * 4 / 4 * 1, -2.4)
    cable.scale = (0.12 / 4, 0.12 / 4, 8 / 3.4)
    box = L.prim(shot, 'cube', L.toon(shot, L.tokens()['faction']['meridon']['secondary']), loc=(0, 0, 0), size=1.0, px=2.4)
    box.parent = pivot
    box.location = (0, -3.1, -4.7)
    box.scale = (2.6 / 4, 6 / 4, 2.6 / 3.4)
    return pivot


def freighter(shot, lights, lit, loc, rot, seed):
    """Frachter mit Containern und erleuchteter Bruecke / freighter with containers and a lit bridge"""
    R = random.Random(seed)
    tok = L.tokens()['faction']['meridon']
    hull_m = L.toon(shot, 'ink700')
    root = L.prim(shot, 'cube', hull_m, loc=loc, size=(9, 40, 4))
    root.rotation_euler = Euler((0, 0, math.radians(rot)))
    stripe = L.prim(shot, 'cube', L.toon(shot, 'red700'), loc=(0, 0, 0), size=1.0, ink=False)
    stripe.parent = root
    stripe.location = (0, 0, -0.42)
    stripe.scale = (1.02, 1.0, 0.18)
    cols = [tok['primary'], tok['secondary'], 'paper200', 'blue600', 'red500']
    for i in range(5):
        for j in range(2):
            c = L.prim(shot, 'cube', L.toon(shot, R.choice(cols)), loc=(0, 0, 0), size=1.0, px=2.0)
            c.parent = root
            c.location = ((j - 0.5) * 0.46, -0.32 + i * 0.13, 0.5 + 0.38 + R.choice((0, 0, 0.6)) * 0.62)
            c.scale = (0.42, 0.11, 0.6)
    bridge = L.prim(shot, 'cube', L.toon(shot, 'paper50'), loc=(0, 0, 0), size=1.0, px=2.0)
    bridge.parent = root
    bridge.location = (0, 0.4, 1.3)
    bridge.scale = (0.8, 0.12, 1.2)
    win = L.prim(shot, 'cube', lit, loc=(0, 0, 0), size=1.0, ink=False)
    win.parent = root
    win.location = (0, 0.33, 1.6)
    win.scale = (0.7, 0.01, 0.22)
    lights.pane(win, off_time(loc[1]) + 0.3, lit)
    funnel = L.prim(shot, 'cyl', L.toon(shot, tok['secondary']), loc=(0, 0, 0), size=1.0, segments=10, px=2.0)
    funnel.parent = root
    funnel.location = (0, 0.42, 2.3)
    funnel.scale = (0.22, 0.06, 0.9)
    return root


def build():
    s = L.Shot(L.shot_dur('oldworld'))
    R = random.Random(17)
    dusk = ((0.30, 0.28, 0.42, 1), (0.58, 0.55, 0.68, 1), (1.0, 0.90, 0.80, 1))
    s.toon.set_light(*dusk)
    s.toon.win.outputs[0].default_value = 1.0
    s.sunlight(rot=(1.28, 0.0, -2.2), strength=math.pi * 0.9)
    L.sky(s, [(-1, 'seaDeep'), (0.0, 'sunDusk'), (0.06, 'skyDusk'), (0.22, 'skyMid'), (0.55, 'sky700'), (1, 'sky900')], stars=0.25)
    sky0 = [tuple(e.color) for e in L.sky_ramp(s).elements]
    s.cam.data.lens = 35
    cam_a, cam_b = Vector((0, -160, 30)), Vector((0, -104, 22))
    tgt_a, tgt_b = Vector((0, 70, 24)), Vector((4, 70, 26))
    s.look(cam_a, tgt_a)

    lit = L.flat('window300', name='lit')
    lights = Lights(s)
    sea = K.Sea(s, size=700, sub=40, color='sea', amp=0.5, loc=(0, -150, 0))
    # Kai und Stadtboden / quay and city ground
    L.prim(s, 'cube', L.toon(s, 'verdanStone'), loc=(0, 230, -1), size=(700, 420, 4), ink=False)
    L.prim(s, 'cube', L.toon(s, 'paper300'), loc=(0, 21, 1.2), size=(700, 6, 1.6), ink=False)
    # Huegel am Horizont mit dem Rechenzentrum von NEXUS / hill on the horizon with the NEXUS data centre
    L.ground(s, L.toon(s, 'verdanStoneDark'), size=420, sub=16, loc=(NEXUS.x, NEXUS.y + 60, 0),
             height=lambda xx, yy: max(0.0, 58 * math.cos(min(1.0, math.hypot(xx - NEXUS.x, (yy - NEXUS.y) * 1.4) / 190) * math.pi / 2) ** 2))
    nexus = [L.model(s, 'datacenter_nexus', loc=NEXUS + Vector((-22, -4, 56)), rot=200, scale=8.0),
             L.model(s, 'hacktower_nexus', loc=NEXUS + Vector((18, 4, 56)), rot=200, scale=6.0),
             L.model(s, 'powerplant_nexus', loc=NEXUS + Vector((-48, 14, 52)), rot=180, scale=4.0)]
    # kalte Fensterbaender und ein Lichtstrahl in den Himmel: das einzige Licht nach dem Stillstand
    # cold window bands and a light beam into the sky: the only light after the standstill
    cold = L.flat('nexusGlow', name='nexus_cold')
    hall = NEXUS + Vector((-24, -26, 56))
    L.prim(s, 'cube', L.toon(s, 'nexusSteel'), loc=hall + Vector((0, 0, 8)), size=(44, 14, 16))
    L.prim(s, 'cube', L.toon(s, 'nexusIce'), loc=hall + Vector((0, 0, 16.6)), size=(46, 15, 1.4))
    for r in range(3):
        for c in range(8):
            L.prim(s, 'cube', cold, loc=hall + Vector((-18.4 + c * 5.25, -7.2, 3.4 + r * 4.4)), size=(3.6, 0.3, 2.6), ink=False)
    halo = L.flat('nexusGlow', alpha=0.0, name='nexus_halo')
    halo_ob = L.prim(s, 'cone', halo, loc=NEXUS + Vector((18, 4, 300)), size=(26, 26, 500), rot=(math.pi, 0, 0), segments=16, ink=False)

    # Die Bank / the bank
    band, band_z, flags, orange = bank(s, lights, lit)
    ticker = Ticker(s, BANK.x, BANK.y - 12.15, band_z, 47, L.flat('gold', name='ticker'))
    # Viertel Meridons: Tuerme links, rechts und dahinter / Meridon districts: towers left, right and behind
    towers = []
    for (x, y, sc) in [(-62, 82, 3.4), (-98, 60, 3.0), (-84, 128, 3.6), (-130, 96, 3.2), (-46, 150, 3.2), (-150, 150, 3.4),
                       (64, 84, 3.4), (100, 62, 3.0), (86, 130, 3.6), (178, 112, 3.2), (48, 156, 3.0), (210, 160, 3.4),
                       (-20, 200, 3.0), (24, 210, 3.2), (-110, 210, 3.6), (70, 226, 3.0), (-180, 80, 3.0), (150, 70, 3.0)]:
        ob = L.model(s, 'city_meridon_5', loc=(x + R.uniform(-2, 2), y, 0), rot=R.choice([0, 90, 180, 270]), scale=sc)
        lights.model(ob, off_time(y))
        towers.append(ob)
        # Fensterbaender an der Frontseite der Tuerme / window bands on the towers' front side
        w = 10 * sc * 0.55
        windows(s, lights, lit, x, y - 5.0 * sc * 0.62, 4, w, 5, 4, size=(1.5, 1.8), gap=1.6, at=off_time(y) + R.uniform(-0.15, 0.15))
    # Kontore am Kai / trading houses at the quay
    for x in (-150, -120, -92, 92, 120, 150):
        ob = L.model(s, 'trading_post_meridon', loc=(x, 34, 0), rot=180, scale=3.2)
        lights.model(ob, off_time(34))
    for x in (-64, 64):
        ob = L.model(s, 'naval_meridon', loc=(x, 30, 0), rot=180, scale=3.0)
        lights.model(ob, off_time(30))
    # Kraene / cranes
    cranes = [(crane(s, (x, 20, 2), r), r, ph) for x, r, ph in ((-66, 30, 0.0), (66, -40, 1.7), (-134, 10, 3.1), (134, -20, 4.2))]
    # Frachter / freighters
    ships = []
    for (x, y, r, v) in ((-46, -6, 90, 0.0), (52, -6, 90, 0.0), (-190, -34, 90, -3.2), (150, -40, 90, 2.4)):
        sh = freighter(s, lights, lit, (x, y, 1.5), r, int(x))
        ships.append((sh, Vector((x, y, 1.5)), r, v))
    # Lampen am Kai mit Lichtkreis / quay lamps with a pool of light
    pool = L.flat('window300', alpha=0.35, name='pool')
    for k in range(-7, 8):
        x = k * 22 + 11
        L.prim(s, 'cyl', L.toon(s, 'ink700'), loc=(x, 17, 6), size=(0.5, 0.5, 10), segments=6, px=2.0)
        lamp = L.prim(s, 'uv', lit, loc=(x, 17, 11.4), size=1.6, segments=8, px=2.0)
        lights.pane(lamp, BLACK - 0.25 + R.uniform(-0.1, 0.2), lit)
        disc = L.prim(s, 'cyl', pool, loc=(x, 17, 2.1), size=(9, 9, 0.05), segments=16, ink=False)
        lights.pane(disc, lights.panes[-1][1], pool, hide=True)
    # Muenzstrom vom Hafen in die Bank / stream of coins from the harbour into the bank
    coin_m = L.toon(s, 'gold', glow=0.7)
    coins = []
    for i in range(16):
        c = L.prim(s, 'cyl', coin_m, loc=(0, 0, 0), size=(1.7, 1.7, 0.35), segments=12, px=1.6)
        src = Vector((-46, -6, 6)) if i % 2 else Vector((52, -6, 6))
        coins.append((c, src, i / 16.0, R.uniform(0, 6)))
    dst = BANK + Vector((0, -6, 8))

    @s.on
    def update(t):
        # ruhige Fahrt auf die Bank, zuletzt Blick zum Rechenzentrum / calm move towards the bank, at the end a look to the data centre
        p = L.ease_io(L.seg(t, 0, 11.5))
        pos = L.vlerp(cam_a, cam_b, p)
        q = L.ease_io(L.seg(t, 12.0, 16.0))
        tgt = L.vlerp(tgt_a, tgt_b, p).lerp(NEXUS + Vector((-12, -20, 66)), q)
        s.look(pos, tgt)
        s.cam.data.lens = 35 + 22 * q
        sea.update(t if t < BLACK else BLACK + (t - BLACK) * 0.3)
        lights.update(t)
        on = t < FLICKER or (t < TICK_DIE and int(t * 24) % 3 != 0)
        ticker.update(min(t, TICK_DIE), on)
        dark = L.seg(t, WAVE[0], BLACK)
        for wave in flags:
            wave(t if t < BLACK else BLACK)
        # Kraene schwenken und bleiben stehen / cranes swing and come to a stop
        tc = t if t < 9.0 else 9.0 + (1 - math.exp(-(t - 9.0) * 2.0)) / 2.0
        for pv, r, ph in cranes:
            pv.rotation_euler = Euler((0, 0, math.radians(r + 28 * math.sin(tc * 0.45 + ph))))
        # Frachter fahren ein und stoppen / freighters come in and stop
        for sh, b, r, v in ships:
            ts = min(t, 9.5)
            d = Vector((math.sin(math.radians(r)), -math.cos(math.radians(r)), 0)) * -v * ts
            sh.location = b + d + Vector((0, 0, 0.35 * math.sin(t * 1.3 + b.x)))
        # Muenzen: Bogen vom Schiff zur Bank; nach dem Stillstand fallen sie / coins: arc from ship to bank; after the standstill they fall
        for c, src, ph, sp in coins:
            u = (ph + t * 0.16) % 1.0
            if t >= FLICKER:
                u0 = (ph + FLICKER * 0.16) % 1.0
                fall = t - FLICKER
                pt = src.lerp(dst, u0) + Vector((0, 0, 26 * math.sin(u0 * math.pi))) + Vector((0, 0, -9.8 * fall * fall))
                c.location = pt
                L.hide(c, pt.z < 0)
            else:
                c.location = src.lerp(dst, u) + Vector((0, 0, 26 * math.sin(u * math.pi)))
                L.hide(c, False)
            c.rotation_euler = Euler((math.pi / 2, 0, t * 3 + sp))
        # Licht der Daemmerung erlischt, Himmel wird Nacht / dusk light fades, sky turns to night
        night = ((0.006, 0.006, 0.011, 1), (0.012, 0.012, 0.024, 1), (0.024, 0.024, 0.044, 1))
        s.toon.set_light(*[L.mix(dusk[i], night[i], dark) for i in range(3)])
        cr = L.sky_ramp(s)
        for i, c in enumerate(sky0):
            cr.elements[i].color = L.mix(c, tuple(x * 0.07 for x in c[:3]) + (1,), dark)
        # NEXUS bleibt an und leuchtet nach dem Stillstand kalt auf / NEXUS stays on and glows cold after the standstill
        for ob in nexus:
            ob['glowoff'] = 0.0
            ob.update_tag()
        K.set_alpha(halo, 0.06 + 0.16 * L.ease_out(L.seg(t, BLACK - 0.4, BLACK + 1.6)) * (0.85 + 0.15 * math.sin(t * 3.0)))

    update(0)
    return s
