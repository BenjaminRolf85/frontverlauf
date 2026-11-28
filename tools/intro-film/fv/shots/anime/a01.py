"""
A01 (0-4 s): die Chronik am Kartentisch. Kerzenlicht, die Karte des Kontinents auf dunklem Holz, ein altes Buch, eine
Seite schlaegt um, Kreide liegt bereit, Staub tanzt im Lichtkegel. Kamera: Detail von oben, langsame Zufahrt auf das
Buch. Die schreibende Hand kommt spaeter aus dem Figuren-Baukasten.
A01 (0-4 s): the chronicle at the map table. Candle light, the map of the continent on dark wood, an old book, a page
turns, chalk lies ready, dust dances in the cone of light. Camera: detail from above, a slow push towards the book. The
writing hand comes later from the character kit.
"""
import math

import bpy
import numpy as np
from mathutils import Vector

from ... import anime as A
from ... import atmo as AT
from ... import lib as L
from ... import scenery as S
from ... import world as W

DUR = 4.0
CANDLE = (0.27, 0.36)
BOOK = (0.66, -0.02)
TURN = (1.1, 2.9)


def candle_light(cv, cx, cy, radius, dark, amount=0.9):
    """Gemaltes Kerzenlicht: zum Rand faellt alles ins Dunkel / painted candle light: everything falls into darkness towards the edge"""
    yy, xx = np.mgrid[0:cv.h, 0:cv.w].astype(np.float32)
    wx = cv.area[0] + (xx + 0.5) / cv.sx
    wy = cv.area[3] - (yy + 0.5) / cv.sy
    d = np.sqrt((wx - cx) ** 2 + (wy - cy) ** 2) / radius
    # weicher Abfall: Kerzenlicht hat keine Kante / a soft falloff: candle light has no edge
    k = np.clip(np.clip(d - 0.18, 0, 1.6) ** 1.25 * amount, 0, 0.95)
    cv.img += (S.Canvas._c(dark)[None, None, :] - cv.img) * k[..., None]


def paint_table():
    c = A.cmix
    area = (-1.7, -1.2, 1.7, 1.2)
    cv = S.Canvas(area, 4096, c('timber', 'ink700', 0.35))
    for i, y in enumerate(np.arange(-1.2, 1.2, 0.2)):
        cv.rect(-1.7, y, 1.7, y + 0.2, c('timber', 'ink700', 0.28 + 0.1 * ((i * 7) % 3)), 1.0)
        cv.rect(-1.7, y, 1.7, y + 0.006, c('ink800', 'timber', 0.2), 0.9)
    R = np.random.default_rng(5)
    for _ in range(140):
        x, y = float(R.uniform(-1.7, 1.5)), float(R.uniform(-1.2, 1.2))
        cv.line((x, y), (x + float(R.uniform(0.1, 0.5)), y + float(R.uniform(-0.004, 0.004))), 0.003, c('ink800', 'timber', 0.3), 0.5)
    # ----- die Karte: Pergament mit dem Kontinent / the map: parchment with the continent -----
    mx0, my0, mx1, my1 = -1.38, -0.74, 0.24, 0.5
    cv.rect(mx0 + 0.015, my0 - 0.02, mx1 + 0.02, my1 - 0.015, c('ink800', 'timber', 0.2), 0.8)
    parch = c('plansParchment', 'paper200', 0.4)
    cv.rect(mx0, my0, mx1, my1, parch)
    cv.wash(c('plansParchment', 'timber', 0.3), 0.45, 0.16, 9, thr=0.58, area=(mx0, my0, mx1, my1))
    i0, i1, j0, j1 = cv._win(mx0 + 0.04, my0 + 0.04, mx1 - 0.04, my1 - 0.04)
    hh, ww = j1 - j0, i1 - i0
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
    u, v = xx / ww * 2 - 1, yy / hh * 2 - 1
    f = A.fbm(hh, ww, ww / 5.0, 31, 4) + 0.42 - 0.62 * (u * u * 0.9 + v * v * 1.25)
    land = np.clip((f - 0.5) * 60 + 0.5, 0, 1)
    coast = np.clip(1 - np.abs(f - 0.5) * 110, 0, 1)
    sea = np.clip(1 - np.abs(f - 0.455) * 160, 0, 1) * 0.5 + np.clip(1 - np.abs(f - 0.41) * 200, 0, 1) * 0.3
    sub = cv.img[j0:j1, i0:i1]
    sub += (np.asarray(c('paper100', 'plansParchment', 0.3)) - sub) * (land * 0.8)[..., None]
    # die fuenf Laender, zart getoent / the five lands, lightly tinted
    ang = np.arctan2(v + 0.05, u)
    for k, tok in enumerate(('korvatRed', 'alveniaBlue', 'meridonTeal', 'velkarGreen', 'dravonGold')):
        m = land * (((ang + math.pi) / (2 * math.pi) * 5).astype(int) % 5 == k) * 0.09
        sub += (A.hexc(tok) - sub) * m[..., None]
    sub += (np.asarray(c('ink700', 'timber', 0.4)) - sub) * (coast * 0.9)[..., None]
    sub += (np.asarray(c('ink700', 'timber', 0.5)) - sub) * (sea * (1 - land))[..., None]
    ink = c('ink700', 'timber', 0.35)
    # Gebirge, Fluesse, Staedte / mountains, rivers, towns
    for _ in range(60):
        x, y = float(R.uniform(mx0 + 0.2, mx1 - 0.2)), float(R.uniform(my0 + 0.15, my1 - 0.15))
        ii, jj = int((x - mx0 - 0.04) * cv.sx), int((my1 - 0.04 - y) * cv.sy)
        if 0 <= jj < hh and 0 <= ii < ww and f[jj, ii] > 0.56:
            if R.random() < 0.6:
                cv.poly([(x - 0.014, y), (x, y + 0.022), (x + 0.014, y)], 0.0035, ink, 0.9)
            else:
                cv.disc((x, y), 0.007, ink, 0.9, ring=0.003)
    # Windrose, Rand, Massstab / compass rose, border, scale bar
    rx, ry = mx1 - 0.2, my0 + 0.2
    for k in range(8):
        a = k * math.pi / 4
        rr = 0.11 if k % 2 == 0 else 0.06
        cv.line((rx, ry), (rx + rr * math.cos(a), ry + rr * math.sin(a)), 0.006 if k % 2 == 0 else 0.004, ink, 0.9)
    cv.disc((rx, ry), 0.075, ink, 0.8, ring=0.004)
    for (a_, b_) in (((mx0 + 0.03, my0 + 0.03), (mx1 - 0.03, my0 + 0.03)), ((mx1 - 0.03, my0 + 0.03), (mx1 - 0.03, my1 - 0.03)), ((mx1 - 0.03, my1 - 0.03), (mx0 + 0.03, my1 - 0.03)),
                     ((mx0 + 0.03, my1 - 0.03), (mx0 + 0.03, my0 + 0.03))):
        cv.line(a_, b_, 0.005, ink, 0.85)
    for k in range(6):
        cv.rect(mx0 + 0.1 + k * 0.05, my0 + 0.08, mx0 + 0.15 + k * 0.05, my0 + 0.092, ink, 0.9 if k % 2 == 0 else 0.25)
    # Wachsflecken und Kreidestaub / wax spots and chalk dust
    cv.flecks(9, (0.008, 0.02), c('paper50', 'window300', 0.4), 8, alpha=0.9, area=(CANDLE[0] - 0.14, CANDLE[1] - 0.14, CANDLE[0] + 0.14, CANDLE[1] + 0.1))
    cv.line((-0.36, -0.5), (-0.2, -0.46), 0.02, A.cmix('chalk', 'paper50', 0.5), 0.5, soft=0.015)
    candle_light(cv, CANDLE[0] + 0.05, CANDLE[1] - 0.2, 1.0, c('ink900', 'timber', 0.12))
    return cv.image('a01_table'), area


def paint_page(name, seed, title=False, emblem=False):
    """Buchseite: Zeilen als Schriftbild, Initiale, Randleiste / book page: lines as writing, an initial, a border"""
    c = A.cmix
    cv = S.Canvas((0.0, 0.0, 0.3, 0.42), 1024, c('paper100', 'plansParchment', 0.35))
    cv.wash(c('paper200', 'plansParchment', 0.5), 0.4, 0.05, seed, thr=0.6)
    ink = c('ink700', 'timber', 0.3)
    R = np.random.default_rng(seed)
    y = 0.375
    if title:
        cv.rect(0.05, y - 0.004, 0.25, y + 0.012, c('stamp', 'ink700', 0.3), 0.9)
        y -= 0.04
    if emblem:
        cv.rect(0.035, y - 0.075, 0.105, y + 0.004, c('stamp', 'goldDark', 0.4), 0.9)
        cv.rect(0.045, y - 0.065, 0.095, y - 0.006, c('goldDark', 'paper100', 0.4), 0.9)
        for k in range(8):
            a = k * math.pi / 4
            rr = 0.024 if k % 2 == 0 else 0.01
            cv.line((0.07, y - 0.036), (0.07 + rr * math.cos(a), y - 0.036 + rr * math.sin(a)), 0.004, c('stamp', 'ink700', 0.4), 0.9)
    row = 0
    while y > 0.045:
        x = 0.035 + (0.085 if emblem and row < 5 else 0.0)
        while x < 0.262:
            w = float(R.uniform(0.008, 0.03))
            if x + w > 0.268:
                break
            cv.rect(x, y, x + w, y + 0.0048, ink, 0.82)
            x += w + 0.006
        y -= 0.0155
        row += 1
        if row % 9 == 8:
            y -= 0.012
    cv.rect(0.0, 0.0, 0.3, 0.004, c('paper300', 'timber', 0.3), 0.6)
    return cv.image(name)


def build():
    s = L.Shot(DUR)
    c = A.cmix
    s.cam.data.lens = 40
    s.cam.data.clip_start, s.cam.data.clip_end = 0.05, 200.0
    cam0, cam1 = Vector((0.12, -0.72, 1.85)), Vector((0.34, -0.5, 1.22))
    look0, look1 = Vector((0.05, 0.02, 0.0)), Vector((0.42, 0.02, 0.0))
    s.look(cam0, look0)
    rot, d = A.sun_rot(-150.0, 62.0)
    s.sunlight(rot=tuple(rot))
    s.toon.set_light(A.lin(c('ink800', 'timber', 0.3)), A.lin(c('sunDusk', 'timber', 0.35)), A.lin(c('paper50', 'window300', 0.35)))
    s.sc.world = bpy.data.worlds.new('dark')
    s.sc.world.use_nodes = True
    s.sc.world.node_tree.nodes['Background'].inputs[0].default_value = L.rgb('ink900')
    tex, area = paint_table()
    S.ground(s, lambda x, y: 0.0, (3.4, 2.4), (1, 1), tex, area, name='a01_table', loc=(0.0, 0.0, 0.0), unit=True)
    mats = S.facade_mats(s, glass='ink900')
    mb = W.MeshB()
    # ----- Buch: Deckel, Seitenbloecke / the book: cover, page blocks -----
    bx, by = BOOK
    leather, gold = c('plansCase', 'ink700', 0.3), c('goldDark', 'timber', 0.3)
    mb.box(bx - 0.325, by - 0.225, 0.0, bx + 0.325, by + 0.225, 0.014, leather)
    for sx in (-1, 1):
        x0, x1 = (bx - 0.31, bx - 0.006) if sx < 0 else (bx + 0.006, bx + 0.31)
        mb.box(x0, by - 0.212, 0.014, x1, by + 0.212, 0.05, c('paper200', 'timber', 0.25), top=c('paper100', 'plansParchment', 0.35))
        for cx in ((x0 + 0.004, x1 - 0.004)[0 if sx < 0 else 1],):
            mb.box(cx - 0.004, by - 0.212, 0.014, cx + 0.004, by + 0.212, 0.052, c('paper300', 'timber', 0.3))
    for (cx, cy) in ((bx - 0.325, by - 0.225), (bx + 0.305, by - 0.225), (bx - 0.325, by + 0.205), (bx + 0.305, by + 0.205)):
        mb.box(cx, cy, 0.0, cx + 0.02, cy + 0.02, 0.016, gold)
    # Lesezeichen, Kreide, Tintenfass, Feder / ribbon, chalk, ink pot, quill
    mb.box(bx + 0.02, by - 0.3, 0.001, bx + 0.035, by - 0.2, 0.004, c('stamp', 'ink700', 0.2))
    mb.push(-0.24, -0.47, 0.012, rot=14)
    mb.tube((-0.04, 0, 0), (0.04, 0, 0), 0.0085, A.cmix('chalk', 'white', 0.5), n=7, emit=0.35)
    mb.pop()
    mb.push(0.78, 0.36, 0.0)
    mb.revolve(0, 0, [(0.036, 0.0), (0.042, 0.03), (0.03, 0.05), (0.02, 0.056), (0.022, 0.066)], c('ink800', 'sky800', 0.3), n=12)
    mb.pop()
    mb.ink = 0.5
    mb.tube((0.79, 0.36, 0.06), (0.94, 0.26, 0.22), 0.004, c('paper100', 'timber', 0.2), n=4)
    mb.ink = 1.0
    mb.face([(0.84, 0.33, 0.115), (0.94, 0.26, 0.22), (0.925, 0.235, 0.215), (0.86, 0.285, 0.14)], c('paper50', 'paper200', 0.4))
    # Kerze im Messinghalter / the candle in a brass holder
    kx, ky = CANDLE
    brass = c('brass400', 'timber', 0.25)
    mb.revolve(kx, ky, [(0.075, 0.0), (0.08, 0.008), (0.03, 0.016), (0.026, 0.05), (0.034, 0.056)], brass, n=14)
    mb.cyl(kx, ky, 0.05, 0.02, 0.13, c('paper50', 'window300', 0.25), n=10, emit=0.35)
    mb.tube((kx, ky, 0.18), (kx + 0.002, ky, 0.192), 0.002, 'ink800', n=4)
    mb.build(s, 'a01_props', mats, ink=1.3, cam=tuple(cam1))
    # ----- Seiten: gemalt, die rechte schlaegt um / pages: painted, the right one turns -----
    pages = [paint_page('a01_p%d' % k, 11 + k * 5, title=(k == 1), emblem=(k in (1, 2))) for k in range(4)]
    pm = [W.sprite_mat('a01_pm%d' % k, tex=pages[k]) for k in range(4)]

    def flat_page(name, x0, mat, z):
        me = bpy.data.meshes.new(name)
        me.from_pydata([(x0, by - 0.21, z), (x0 + 0.3, by - 0.21, z), (x0 + 0.3, by + 0.21, z), (x0, by + 0.21, z)], [], [(0, 1, 2, 3)])
        uv = me.uv_layers.new(name='UVMap')
        for i, t in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
            uv.data[i].uv = t
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        s.sc.collection.objects.link(ob)
        ob.visible_shadow = False
        return ob
    flat_page('page_left', bx - 0.306, pm[0], 0.0512)
    flat_page('page_right', bx + 0.006, pm[3], 0.0512)
    # die umschlagende Seite: Streifen um den Buchruecken / the turning page: strips around the spine
    n = 10
    verts = [(0, 0, 0)] * ((n + 1) * 2)
    faces = [(2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1) for i in range(n)]
    turn = []
    for k, mat in enumerate((pm[1], pm[2])):
        me = bpy.data.meshes.new('turn%d' % k)
        me.from_pydata(verts, [], faces)
        uv = me.uv_layers.new(name='UVMap')
        for p in me.polygons:
            for li in p.loop_indices:
                vi = me.loops[li].vertex_index
                uu = (vi // 2) / n
                uv.data[li].uv = (uu if k == 0 else 1 - uu, 0.0 if vi % 2 == 0 else 1.0)
        me.materials.append(mat)
        ob = bpy.data.objects.new('turn%d' % k, me)
        s.sc.collection.objects.link(ob)
        ob.visible_shadow = False
        turn.append(me)
    # ----- Flamme, Lichthof, Staub im Licht / flame, halo, dust in the light -----
    from ... import props as P
    fl = P.Fire(s, 'flame', (kx + 0.001, ky, 0.186), width=0.03, height=0.07, n=3, seed=4)
    halo = W.sprite_mat('a01_halo', attr_col=True, add=True, shape='disc', keep=1.0)
    gl = W.MeshB()
    gl.card((kx, ky, 0.21), 0.5, 0.5, tuple(cam1), c('window300', 'fire400', 0.25), mat=0, alpha=0.6)
    S.flat_disc(gl, (kx, ky, 0.004), 0.42, c('window300', 'fire400', 0.2), 0, alpha=0.22)

    gl.build(s, 'a01_glow', [halo], weld=False, shadow=False)
    AT.shafts(s, [((kx + 0.02, ky - 0.05, 0.6), (bx - 0.25, by - 0.05, 0.05), 0.12, 0.5)], c('window300', 'paper50', 0.4), alpha=0.07)
    motes = AT.Particles(s, 'motes', 90, ((-0.3, -0.5, 0.06), (0.85, 0.6, 0.75)), (0.012, 0.004, 0.01), (0.0008, 0.002), c('paper50', 'window300', 0.4), mode='ember', seed=6, sway=0.02)
    W.haze(s, 'ink900', start=5.0, dist=50.0, amount=0.0, others=False)

    def update(t):
        u = L.clamp(t / DUR)
        p = 0.3 * u + 0.7 * L.ease_io(u)
        s.look(cam0.lerp(cam1, p), look0.lerp(look1, p))
        W.clock(t)
        # Seite: Winkel 0 (liegt rechts) bis 180 Grad (liegt links), in der Mitte gewoelbt / page: angle 0 (lies right) to 180 degrees (lies left), bulged midway
        q = L.ease_io(L.seg(t, TURN[0], TURN[1]))
        a = q * math.pi
        bend = math.sin(q * math.pi) * 0.55
        co, back = [], []
        for i in range(n + 1):
            r = 0.3 * i / n
            ai = max(0.0, a - bend * (i / n) ** 2 * 0.9)
            x = bx + 0.006 * math.cos(a) + r * math.cos(ai)
            z = 0.0525 + r * math.sin(ai) + 0.002 * math.sin(q * math.pi)
            co += [(x, by - 0.21, z), (x, by + 0.21, z)]
            # Rueckseite knapp unter der Vorderseite (entlang der Seitennormalen) / the back just below the front (along the page normal)
            ox, oz = math.sin(ai) * 0.0007, -math.cos(ai) * 0.0007
            back += [(x + ox, by - 0.21, z + oz), (x + ox, by + 0.21, z + oz)]
        turn[0].vertices.foreach_set('co', np.asarray(co, np.float64).ravel())
        turn[1].vertices.foreach_set('co', np.asarray(back, np.float64).ravel())
        turn[0].update()
        turn[1].update()
        fl.update(t)
        motes.update(t)
        W.set_alpha(halo, 0.9 + 0.1 * math.sin(t * 17.0) * math.sin(t * 5.3 + 0.7))
    s.on(update)
    return s
