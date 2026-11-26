"""
Korvat-Panzer als modelliertes Asset: Wanne aus schraegen, gefasten Panzerplatten, gegossener Turm (Unterteilungs-
flaeche) mit Zwillingsrohr, Laufwerk mit Scheibenraedern, Kette aus Einzelgliedern entlang des Kettenlaufs, Stauraum.
Skelett: Wanne, Turm und Rohr als eigene Knochen (das Spiel dreht den Turm), je Rad ein Knochen; die Kette laeuft ueber
ein Morphziel (jedes Glied rueckt auf den Platz des naechsten). Clips: idle, drive, fire.
Korvat tank as a modelled asset: hull of sloped, bevelled armour plates, cast turret (subdivision surface) with twin
gun, running gear with disc wheels, track of single links along the track run, stowage. Skeleton: hull, turret and gun
as separate bones (the game rotates the turret), one bone per wheel; the track runs via a morph target (every link moves
to the place of the next). Clips: idle, drive, fire.

Masse in Modell-Einheiten: 3.0 breit ueber die Ketten, bewusst gedrungen (Comic), damit er auf ein Brettfeld passt.
Sizes in model units: 3.0 wide over the tracks, deliberately compact (comic) so it fits a board tile.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

from . import kit as K

V = Vector
META = {'fitWidth': 3.0}

# Laufwerk / running gear
TX = 1.2          # Kettenmitte / track centre x
TW = 0.56         # Kettenbreite / track width
WHEEL_Y = (-1.05, -0.35, 0.35, 1.05)
WHEEL_R = 0.335
AXLE_Z = 0.42
SPROCKET = (1.63, 0.57, 0.27)   # y, z, r (hinten / rear)
IDLER = (-1.63, 0.56, 0.25)     # y, z, r (vorn / front)
TRACK_T = 0.05    # halbe Kettendicke / half track thickness
LINKS = 42
# Turm / turret
TUR = V((0, 0.12, 1.14))
GUN_Z = 1.5
GUN_Y = -0.86
# Comic-Mass: Wanne und Turm kuerzer und hoeher als gebaut (Raeder und Kette bleiben rund)
# comic scale: hull and turret shorter and taller than built (wheels and track stay round)
SY, SZ, Z0 = 0.93, 1.12, 0.3
HULL_M = Matrix.Translation((0, 0, Z0)) @ Matrix.Diagonal((1, SY, SZ, 1)) @ Matrix.Translation((0, 0, -Z0))
LIFT = (HULL_M @ V((0, 0, 1.2))).z - 1.2
TUR_M = Matrix.Translation((0, 0, TUR.z + LIFT)) @ Matrix.Diagonal((1, SY, SZ, 1)) @ Matrix.Translation((0, 0, -TUR.z))
BARREL = 0.8      # Rohrlaenge als Anteil / barrel length as a share


def track_path():
    """Kettenlauf als geschlossene Linie in (y, z): unten ueber den Boden, hinten ums Treibrad, oben auf den Laufraedern, vorn ums Leitrad / track run as a closed line in (y, z)"""
    rw = WHEEL_R + TRACK_T
    top = AXLE_Z + rw
    pulleys = [((WHEEL_Y[0], AXLE_Z), rw), ((WHEEL_Y[-1], AXLE_Z), rw), ((SPROCKET[0], SPROCKET[1]), SPROCKET[2] + TRACK_T)]
    pulleys += [((y, top), 0.0) for y in reversed(WHEEL_Y)]
    pulleys.append(((IDLER[0], IDLER[1]), IDLER[2] + TRACK_T))
    n = len(pulleys)
    tang = []
    for i in range(n):
        (c1, r1), (c2, r2) = pulleys[i], pulleys[(i + 1) % n]
        d = V((c2[0] - c1[0], c2[1] - c1[1]))
        phi = math.atan2(d.y, d.x)
        beta = math.acos(max(-1, min(1, (r1 - r2) / d.length)))
        a = phi - beta
        nrm = V((math.cos(a), math.sin(a)))
        tang.append((V(c1) + nrm * r1, V(c2) + nrm * r2, a))
    pts = []
    for i in range(n):
        p_in, a_in = tang[(i - 1) % n][1], tang[(i - 1) % n][2]
        p_out, a_out = tang[i][0], tang[i][2]
        (c, r) = pulleys[i]
        if r > 0:
            while a_out < a_in:
                a_out += 2 * math.pi
            steps = max(2, int((a_out - a_in) / math.radians(12)))
            for k in range(steps + 1):
                a = a_in + (a_out - a_in) * k / steps
                pts.append(V(c) + V((math.cos(a), math.sin(a))) * r)
        else:
            pts.append(p_out)
    return pts


def sample_closed(pts, n, shift=0.0):
    """n gleich weit entfernte Punkte samt Richtung auf der geschlossenen Linie / n evenly spaced points with direction on the closed line"""
    seg = []
    total = 0.0
    m = len(pts)
    for i in range(m):
        a, b = pts[i], pts[(i + 1) % m]
        ln = (b - a).length
        seg.append((a, b, total, ln))
        total += ln
    out = []
    pitch = total / n
    j = 0
    for i in range(n):
        s = ((i + shift) * pitch) % total
        j = 0
        while not (seg[j][2] <= s <= seg[j][2] + seg[j][3] + 1e-9):
            j += 1
        a, b, s0, ln = seg[j]
        t = (s - s0) / max(ln, 1e-9)
        # Richtung ueber eine halbe Gliedlaenge geglaettet / direction smoothed over half a link
        def at(sv):
            sv %= total
            for a2, b2, s2, l2 in seg:
                if s2 <= sv <= s2 + l2 + 1e-9:
                    return a2 + (b2 - a2) * ((sv - s2) / max(l2, 1e-9))
            return seg[-1][1]
        d = (at(s + pitch * 0.5) - at(s - pitch * 0.5)).normalized()
        out.append((a + (b - a) * t, d))
    return out, pitch


def link_mesh(pitch):
    """Ein Kettenglied im eigenen Raum: Laufrichtung +y, aussen +z, Breite x / one track link in its own space: travel +y, outside +z, width x"""
    bm = bmesh.new()
    h = pitch * 0.46
    prof = [(-h, -0.03), (h, -0.03), (h, 0.02), (h * 0.45, 0.02), (h * 0.3, 0.062), (-h * 0.3, 0.062), (-h * 0.45, 0.02), (-h, 0.02)]
    lo = [bm.verts.new((-TW / 2, y, z)) for y, z in prof]
    hi = [bm.verts.new((TW / 2, y, z)) for y, z in prof]
    k = len(prof)
    bm.faces.new(lo)
    bm.faces.new(hi[::-1])
    for i in range(k):
        bm.faces.new((lo[i], lo[(i + 1) % k], hi[(i + 1) % k], hi[i]))
    # Fuehrungszahn innen / guide horn on the inside
    base = [bm.verts.new(p) for p in ((-0.05, -h * 0.5, -0.03), (0.05, -h * 0.5, -0.03), (0.05, h * 0.5, -0.03), (-0.05, h * 0.5, -0.03))]
    tip = bm.verts.new((0, 0, -0.13))
    for i in range(4):
        bm.faces.new((base[i], tip, base[(i + 1) % 4]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def build_track(sx):
    path = track_path()
    base, pitch = sample_closed(path, LINKS, 0.0)
    nxt, _ = sample_closed(path, LINKS, 1.0)
    proto = link_mesh(pitch)
    pv = [v.co.copy() for v in proto.verts]
    faces = [[v.index for v in f.verts] for f in proto.faces]
    proto.free()

    def place(samples):
        out = []
        for (p, d) in samples:
            t = V((0, d.x, d.y))
            n = V((0, d.y, -d.x))  # aussen / outside
            for c in pv:
                out.append(V((TX * sx + c.x, p.x, p.y)) + t * c.y + n * c.z)
        return out
    co0, co1 = place(base), place(nxt)
    bm = bmesh.new()
    vs = [bm.verts.new(c) for c in co0]
    nv = len(pv)
    for i in range(LINKS):
        for f in faces:
            bm.faces.new([vs[i * nv + k] for k in f])
    o = K.new_object('track.' + ('L' if sx > 0 else 'R'), bm, 'track', smooth=False)
    return o, co1


def wheel(name, y, z, r, kind):
    """Rad im Raum der linken Seite, Achse x; kind: road | sprocket | idler / wheel in left-side space, axle x"""
    parts = []
    if kind == 'road':
        prof = [(0.0, 0.2), (0.09, 0.2), (0.1, 0.17), (r * 0.5, 0.15), (r * 0.72, 0.19), (r * 0.8, 0.19), (r * 0.8, 0.215), (r, 0.215), (r, -0.215), (r * 0.8, -0.215), (r * 0.8, -0.19), (r * 0.6, -0.17), (0.0, -0.17)]
        w = K.lathe(name, prof, 'hullDark', seg=14)
        K.paint_slot(w, lambda c, n: 'rubber' if (c.x * c.x + c.y * c.y) > (r * 0.79) ** 2 else ('trim' if (c.x * c.x + c.y * c.y) < 0.105 ** 2 and c.z > 0.1 else None))
        parts.append(w)
        for k in range(12):
            a = math.radians(k * 30)
            b = K.box('bolt', (math.cos(a) * r * 0.62, math.sin(a) * r * 0.62, 0.18), (0.035, 0.035, 0.03), 'trim')
            K.set_line(b, 0.0)
            parts.append(b)
    elif kind == 'sprocket':
        prof = [(0.0, 0.2), (0.1, 0.2), (0.11, 0.16), (r * 0.8, 0.16), (r * 0.8, 0.21), (r, 0.21), (r, 0.13), (r * 0.75, 0.1), (r * 0.75, -0.1), (r, -0.13), (r, -0.21), (0.0, -0.21)]
        w = K.lathe(name, prof, 'trim', seg=10)
        parts.append(w)
        for k in range(10):
            a = math.radians(k * 36 + 18)
            for zz in (0.17, -0.17):
                t = K.box('tooth', (math.cos(a) * (r + 0.02), math.sin(a) * (r + 0.02), zz), (0.09, 0.07, 0.07), 'trim', m=K.rot('Z', k * 36 + 18))
                K.set_line(t, 0.3)
                parts.append(t)
    else:
        prof = [(0.0, 0.2), (0.08, 0.2), (0.09, 0.16), (r * 0.7, 0.14), (r * 0.85, 0.2), (r, 0.2), (r, -0.2), (0.0, -0.2)]
        w = K.lathe(name, prof, 'hullDark', seg=12)
        parts.append(w)
        for k in range(12):
            a = math.radians(k * 30)
            b = K.box('bolt', (math.cos(a) * r * 0.5, math.sin(a) * r * 0.5, 0.155), (0.03, 0.03, 0.03), 'trim')
            K.set_line(b, 0.0)
            parts.append(b)
    o = K.join(parts, name)
    o.data.shade_smooth()
    o.data.set_sharp_from_angle(angle=math.radians(35))
    # Achse von z nach x drehen, dann an den Platz / turn the axle from z to x, then into place
    K.transform(o, Matrix.Translation((TX, y, z)) @ K.rot('Y', 90))
    return o


def build_running_gear(q):
    """Raeder und Ketten beider Seiten; jedes Rad haengt an seinem Knochen / wheels and tracks of both sides; every wheel hangs on its bone"""
    wheels, tracks, bones = [], [], []
    specs = [('wheel%d' % i, y, AXLE_Z, WHEEL_R, 'road') for i, y in enumerate(WHEEL_Y)]
    specs += [('sprocket', SPROCKET[0], SPROCKET[1], SPROCKET[2], 'sprocket'), ('idler', IDLER[0], IDLER[1], IDLER[2], 'idler')]
    for nm, y, z, r, kind in specs:
        left = wheel(nm + '.L', y, z, r, kind)
        if q < 0.99:
            K.decimate(left, ratio=0.55)
            left.data.shade_smooth()
            left.data.set_sharp_from_angle(angle=math.radians(35))
        right = K.instance(left, nm + '.R', Matrix.Diagonal((-1, 1, 1, 1)))
        bm = bmesh.new()
        bm.from_mesh(right.data)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(right.data)
        bm.free()
        for o, s, sx in ((left, 'L', 1), (right, 'R', -1)):
            K.skin_rigid(o, nm + '.' + s)
            K.bake_ao(o, samples=24, dist=0.5, strength=0.55)
            bones.append((nm + '.' + s, (TX * sx, y, z), r, kind))
            wheels.append(o)
    shift = []
    for sx in (1, -1):
        t, moved = build_track(sx)
        K.skin_rigid(t, 'root')
        tracks.append(t)
        shift += moved
    return wheels, tracks, bones, shift


def build_hull(q):
    out = []
    # Wannenunterteil zwischen den Ketten / lower hull between the tracks
    lw = 0.88
    low = K.extrude_profile('lower', [(-1.95, 0.62), (-1.5, 0.3), (1.6, 0.3), (2.0, 0.66), (2.0, 0.9), (-1.95, 0.9)], lw * 2, 'hullDark', axis='X', bevel=0.03, segs=1)
    out.append(low)
    # Oberwanne: schraege Bugplatte, schraege Seiten, Heckplatte / upper hull: sloped glacis, sloped sides, rear plate
    pts = []
    for sx in (1, -1):
        pts += [(1.5 * sx, -1.62, 0.84), (1.5 * sx, 1.9, 0.84), (1.5 * sx, -1.74, 0.9), (1.5 * sx, 1.98, 0.9),
                (0.98 * sx, -0.78, 1.2), (1.0 * sx, 1.5, 1.2), (0.84 * sx, -2.06, 0.86), (0.84 * sx, -2.1, 0.66), (1.0 * sx, 2.08, 0.72)]
    up = K.convex('upper', pts, 'hull', bevel_w=0.035, segs=2)
    out.append(up)
    # Kettenabdeckungen mit runden Schmutzfaengern vorn / track guards with round mud guards in front
    for sx in (1, -1):
        prof = [(-2.0, 0.6), (-2.08, 0.72), (-2.02, 0.86), (-1.86, 0.93), (1.98, 0.93), (2.08, 0.84), (2.08, 0.72), (2.02, 0.72), (1.96, 0.87), (-1.84, 0.87), (-1.96, 0.82), (-2.02, 0.72), (-1.96, 0.62)]
        fender = K.extrude_profile('fender', prof, 0.7, 'hull', axis='X', bevel=0.012, segs=1)
        K.move(fender, (1.19 * sx, 0, 0))
        out.append(fender)
        # Staukasten und Kanister auf der Kettenabdeckung / stowage box and jerry can on the track guard
        boxy = K.box('stow', (1.24 * sx, 0.55, 1.02), (0.42, 0.78, 0.2), 'trim', bevel=0.03, segs=1)
        lid = K.box('stowlid', (1.24 * sx, 0.55, 1.13), (0.46, 0.82, 0.035), 'trimDark', bevel=0.012, segs=1)
        K.set_line(lid, 0.4)
        out += [boxy, lid]
        for k in (-1, 1):
            latch = K.box('latch', (1.47 * sx, 0.55 + 0.22 * k, 1.07), (0.03, 0.06, 0.09), 'metalLight')
            K.set_line(latch, 0.0)
            out.append(latch)
        # Scheinwerfer mit Gehaeuse / headlight with housing
        hl = K.cylinder('lamp', (1.12 * sx, -1.9, 1.0), (1.12 * sx, -1.74, 1.02), 0.105, 'hullDark', seg=12)
        gl = K.cylinder('lampglass', (1.12 * sx, -1.905, 1.0), (1.12 * sx, -1.92, 0.998), 0.085, 'lamp', seg=12)
        K.set_line(gl, 0.0)
        st = K.box('lampfoot', (1.12 * sx, -1.8, 0.93), (0.05, 0.08, 0.1), 'hullDark')
        out += [hl, gl, st]
        # Abschleppoese am Bug / tow eye at the bow
        eye = K.tube('toweye', [(V((0.5 * sx, -2.06, 0.7)), 0.03, 0.03), (V((0.5 * sx, -2.2, 0.7)), 0.03, 0.03), (V((0.5 * sx, -2.24, 0.78)), 0.03, 0.03), (V((0.5 * sx, -2.14, 0.84)), 0.03, 0.03), (V((0.5 * sx, -2.04, 0.82)), 0.03, 0.03)], 'metal', seg=6)
        K.set_line(eye, 0.4)
        out.append(eye)
        # Auspuff am Heck / exhaust at the rear
        ex = K.tube('exhaust', [(V((0.62 * sx, 1.9, 1.0)), 0.075, 0.075), (V((0.62 * sx, 2.14, 1.0)), 0.075, 0.075), (V((0.64 * sx, 2.28, 0.94)), 0.07, 0.07), (V((0.66 * sx, 2.32, 0.8)), 0.065, 0.065)], 'metal', seg=8, flat=(False, True))
        out.append(ex)
    # Fahrerluke in der Bugplatte, Sehschlitz, Bug-MG / driver's hatch in the glacis, vision slit, bow MG
    glacis = K.frame((0, -1.4, 1.03), V((0, -1.28, -0.34)), V((0, 0.34, -1.28)) * -1)
    hatch = K.box('hatch', (0, 0, 0), (0.62, 0.5, 0.06), 'hullLight', bevel=0.04, segs=2)
    K.transform(hatch, glacis @ Matrix.Translation((0.36, 0.0, 0.035)))
    slit = K.box('slit', (0, 0, 0), (0.3, 0.07, 0.03), 'ink')
    K.transform(slit, glacis @ Matrix.Translation((0.36, 0.1, 0.075)))
    K.set_line(slit, 0.0)
    hinge = K.cylinder('hinge', (0.12, -0.24, 0.05), (0.6, -0.24, 0.05), 0.035, 'hullDark', seg=6)
    K.transform(hinge, glacis)
    K.set_line(hinge, 0.3)
    ball = K.ellipsoid('mgball', (0, 0, 0), 0.15, 'hullDark', seg=12, rings=8)
    K.transform(ball, glacis @ Matrix.Translation((-0.45, 0.05, 0.02)))
    mg = K.cylinder('bowmg', (0, 0, 0.02), (0, 0.42, 0.14), 0.03, 'metal', seg=6)
    K.transform(mg, glacis @ Matrix.Translation((-0.45, 0.05, 0.02)))
    out += [hatch, slit, hinge, ball, mg]
    # Ersatzkettenglieder auf der Bugplatte / spare track links on the glacis
    for k in range(4):
        sp = K.new_object('spare', link_mesh(0.2), 'track', smooth=False)
        K.transform(sp, glacis @ Matrix.Translation((0.3 * (1 if k % 2 else -1) - 0.02, 0.36 + (k // 2) * 0.21, 0.04)) @ Matrix.Diagonal((0.9, 1, 1, 1)))
        K.set_line(sp, 0.5)
        out.append(sp)
    # Motordeck: Lueftergitter mit Rahmen, Wartungsklappen / engine deck: fan grille with frame, service hatches
    frame = K.box('grille', (0, 1.42, 1.21), (1.3, 0.74, 0.05), 'hullDark', bevel=0.015, segs=1)
    out.append(frame)
    for k in range(6):
        bar = K.box('louvre', (0, 1.14 + k * 0.112, 1.245), (1.16, 0.05, 0.03), 'ink', m=K.rot('X', 28))
        K.set_line(bar, 0.0)
        out.append(bar)
    for sx in (1, -1):
        plate = K.box('deckhatch', (0.5 * sx, 0.74, 1.212), (0.5, 0.3, 0.03), 'hullLight', bevel=0.012, segs=1)
        K.set_line(plate, 0.4)
        out.append(plate)
    # Fasser am Heck (Kennzeichen der Korvat) mit Spannbaendern und Traeger / fuel drums at the rear (Korvat mark) with straps and bracket
    for sx in (1, -1):
        drum = K.cylinder('drum', (0.14 * sx, 2.2, 1.12), (1.02 * sx, 2.2, 1.12), 0.2, 'trim', seg=14)
        K.bevel(drum, 0.03, 2, angle=40)
        out.append(drum)
        for t in (0.32, 0.58, 0.84):
            band = K.cylinder('drumband', ((t - 0.03) * sx, 2.2, 1.12), ((t + 0.03) * sx, 2.2, 1.12), 0.212, 'primaryDark', seg=14)
            K.set_line(band, 0.0)
            out.append(band)
        cap = K.cylinder('drumcap', (1.02 * sx, 2.2, 1.2), (1.07 * sx, 2.2, 1.2), 0.05, 'metalLight', seg=8)
        K.set_line(cap, 0.0)
        out.append(cap)
    out.append(K.box('drumrack', (0, 2.08, 0.98), (2.1, 0.3, 0.06), 'hullDark', bevel=0.012, segs=1))
    # Werkzeug und Abschleppseil an der linken Flanke / tools and tow cable on the left flank
    cable_pts = [(1.34, -1.3, 0.96), (1.36, -0.9, 1.0), (1.3, -0.5, 1.09), (1.24, -0.2, 1.1), (1.3, 0.05, 1.02)]
    cable = K.tube('cable', [(V(p), 0.03, 0.03) for p in K._catmull(cable_pts, 3)], 'metal', seg=5)
    K.set_line(cable, 0.4)
    out.append(cable)
    shaft = K.cylinder('shovelshaft', (-1.3, -1.25, 0.975), (-1.3, -0.3, 0.975), 0.028, 'wood', seg=6)
    blade = K.extrude_profile('shovel', [(-0.11, 0.0), (0.11, 0.0), (0.12, -0.2), (0.0, -0.32), (-0.12, -0.2)], 0.02, 'metal', axis='Z', bevel=0.006, segs=1)
    K.move(blade, (-1.3, -1.25, 0.965))
    out += [shaft, blade]
    for p in out:
        K.skin_rigid(p, 'body')
        K.transform(p, HULL_M)
    if q < 0.99:
        for p in out:
            if K.tri_count(p) > 60:
                K.decimate(p, ratio=0.6)
    return out


def build_turret(q):
    """Gegossener Turm: Querschnitte als Unterteilungsflaeche, Gussnaht, Kommandantenkuppel, Luken, Staukorb / cast turret: cross-sections as a subdivision surface, casting seam, cupola, hatches, stowage basket"""
    out = []
    c = TUR
    shell = K.tube('turret', [
        (c + V((0, 0.0, -0.02)), 0.9, 1.04, 2.5), (c + V((0, 0.0, 0.1)), 1.0, 1.14, 2.5), (c + V((0, 0.02, 0.3)), 1.02, 1.17, 2.5),
        (c + V((0, 0.05, 0.5)), 0.93, 1.08, 2.5), (c + V((0, 0.08, 0.66)), 0.76, 0.9, 2.4), (c + V((0, 0.1, 0.74)), 0.5, 0.62, 2.2),
    ], 'hull', seg=16, ref=(1, 0, 0), flat=(True, False))
    K.subsurf(shell, 1 if q > 0.99 else 0)
    # Turmheck als angegossene Ausbuchtung / turret bustle as a cast-on bulge
    bustle = K.ellipsoid('bustle', c + V((0, 0.98, 0.32)), (0.68, 0.5, 0.3), 'hull', seg=14, rings=8)
    cheek = [K.ellipsoid('cheek', c + V((0.5 * sx, -0.82, 0.3)), (0.34, 0.36, 0.3), 'hull', seg=12, rings=8) for sx in (1, -1)]
    body = K.fuse('turret', [shell, bustle] + cheek, 'hull', voxel=0.045, smooth=3, tris=int(1500 * q), keep_weights=False)
    out.append(body)
    tree = K.surface_tree(body)
    # Gussnaht rund um den Turm / casting seam around the turret
    seam = K.strap('seam', [(math.cos(a) * 1.6, 0.12 + math.sin(a) * 1.8, c.z + 0.3) for a in [2 * math.pi * k / 16 for k in range(16)]], 0.04, 'hullDark', tree=tree, thickness=0.014, offset=0.001, closed=True, per=3)
    K.set_line(seam, 0.0)
    out.append(seam)
    ring = K.cylinder('turretring', (0, c.y, c.z - 0.08), (0, c.y, c.z + 0.03), 1.0, 'trim', seg=20)
    out.append(ring)
    # Kommandantenkuppel mit Winkelspiegeln und Lukendeckel / commander's cupola with periscopes and hatch lid
    cx, cy, cz = -0.4, c.y + 0.3, c.z + 0.72
    cup = K.lathe('cupola', [(0.0, 0.2), (0.24, 0.2), (0.3, 0.16), (0.33, 0.04), (0.33, -0.12), (0.0, -0.12)], 'hull', seg=14, origin=(cx, cy, cz))
    out.append(cup)
    for k in range(6):
        a = math.radians(k * 60 + 30)
        peri = K.box('periscope', (cx + math.cos(a) * 0.3, cy + math.sin(a) * 0.3, cz + 0.1), (0.07, 0.13, 0.07), 'glass', m=K.rot('Z', k * 60 + 30))
        K.set_line(peri, 0.0)
        out.append(peri)
    # Ladeschuetzenluke und Dach-MG / loader's hatch and roof MG
    lx, ly = 0.42, c.y + 0.22
    lh = K.lathe('loaderhatch', [(0.0, 0.07), (0.2, 0.06), (0.26, 0.0), (0.0, 0.0)], 'hullLight', seg=12, origin=(lx, ly, c.z + 0.72))
    K.set_line(lh, 0.4)
    out.append(lh)
    post = K.cylinder('mgpost', (lx, ly, c.z + 0.76), (lx, ly, c.z + 0.98), 0.03, 'hullDark', seg=6)
    mgb = K.box('roofmg', (lx, ly - 0.08, c.z + 1.0), (0.07, 0.36, 0.09), 'trimDark', bevel=0.015, segs=1)
    mgl = K.cylinder('roofmgbarrel', (lx, ly - 0.2, c.z + 1.01), (lx, ly - 0.72, c.z + 1.03), 0.022, 'metal', seg=6)
    mga = K.box('roofmgammo', (lx + 0.09, ly - 0.05, c.z + 0.97), (0.11, 0.14, 0.12), 'trim', bevel=0.012, segs=1)
    for p in (post, mgb, mgl, mga):
        K.set_line(p, 0.4)
    out += [post, mgb, mgl, mga]
    # Antenne und Staukorb am Turmheck / antenna and stowage basket at the turret rear
    ant = K.cylinder('antenna', (0.62, c.y + 0.7, c.z + 0.55), (0.66, c.y + 0.84, c.z + 1.75), 0.014, 'trim', seg=5)
    antb = K.cylinder('antennabase', (0.62, c.y + 0.7, c.z + 0.5), (0.62, c.y + 0.7, c.z + 0.66), 0.045, 'hullDark', seg=8)
    K.set_line(ant, 0.5)
    out += [ant, antb]
    basket = K.box('basket', (0, c.y + 1.5, c.z + 0.3), (1.2, 0.32, 0.3), 'trim', bevel=0.05, segs=2)
    out.append(basket)
    for x in (-0.38, 0.0, 0.38):
        st = K.box('basketstrap', (x, c.y + 1.5, c.z + 0.3), (0.06, 0.345, 0.325), 'ink')
        K.set_line(st, 0.0)
        out.append(st)
    roll = K.cylinder('tarp', (-0.5, c.y + 1.5, c.z + 0.52), (0.5, c.y + 1.5, c.z + 0.52), 0.11, 'canvas', seg=10)
    K.bevel(roll, 0.03, 2, angle=40)
    out.append(roll)
    # Zahnrad-Wappen an den Turmseiten / cog emblem on the turret sides
    for sx in (1, -1):
        loc, nor, _i, _d = tree.find_nearest(V((1.6 * sx, c.y + 0.25, c.z + 0.36)))
        m = K.frame(loc + nor * 0.004, nor, (0, 0, 1))
        disc = K.cylinder('emblem', (0, 0, 0), (0, 0.02, 0), 0.15, 'emblem', seg=12)
        hub = K.cylinder('emblemhub', (0, 0.018, 0), (0, 0.03, 0), 0.062, 'hull', seg=8)
        teeth = [K.box('emblemtooth', (math.cos(math.radians(k * 45)) * 0.17, 0.01, math.sin(math.radians(k * 45)) * 0.17), (0.085, 0.02, 0.075), 'emblem', m=K.rot('Y', -k * 45)) for k in range(8)]
        e = K.join([disc, hub] + teeth, 'emblem')
        K.transform(e, m)
        K.set_line(e, 0.0)
        out.append(e)
    # Hebeoesen / lifting eyes
    for sx in (1, -1):
        for yy in (-0.45, 0.6):
            loc, nor, _i, _d = tree.find_nearest(V((0.75 * sx, c.y + yy, c.z + 0.9)))
            hook = K.tube('hook', [(loc - nor * 0.02 + V((0, -0.07, 0)), 0.02, 0.02), (loc + nor * 0.07 + V((0, -0.05, 0)), 0.02, 0.02), (loc + nor * 0.07 + V((0, 0.05, 0)), 0.02, 0.02), (loc - nor * 0.02 + V((0, 0.07, 0)), 0.02, 0.02)], 'hullDark', seg=5)
            K.set_line(hook, 0.3)
            out.append(hook)
    for p in out:
        K.skin_rigid(p, 'turret')
        K.transform(p, TUR_M)
    out += commander(q)
    return out


def commander(q):
    """
    Kommandant in der Kuppel: Kopf, Helm und Jacke stammen aus dem Schuetzen-Skript (gleiche Quelle, kein zweites Modell).
    Commander in the cupola: head, helmet and jacket come from the rifleman script (same source, no second model).
    """
    from . import soldier as S
    S.reset_joints()
    parts = S.build_head(0.4 * q) + S.build_helmet(0.6 * q)
    jacket = S.build_jacket(0.3 * q)
    parts += [jacket] + S.build_jacket_trim(jacket, 0.5)[:1]
    c = TUR_M @ (TUR + V((-0.4, 0.3, 0.72)))
    # Guertellinie der Figur auf den Lukenrand, Blick nach vorn / figure's belt line on the hatch rim, facing forward
    m = Matrix.Translation((c.x, c.y + 0.02, c.z + 0.2)) @ Matrix.Diagonal((0.92, 0.92, 0.92, 1)) @ Matrix.Translation((0, 0, -1.06))
    for p in parts:
        K.transform(p, m)
        K.skin_rigid(p, 'turret')
    # offener Lukendeckel hinter ihm / open hatch lid behind him
    lid = K.lathe('openlid', [(0.0, 0.05), (0.2, 0.04), (0.27, 0.0), (0.0, 0.0)], 'hullDark', seg=12)
    K.transform(lid, Matrix.Translation((c.x, c.y + 0.38, c.z + 0.44)) @ K.rot('X', -75))
    K.skin_rigid(lid, 'turret')
    return parts + [lid]


def build_gun(q):
    """Zwillingsrohr mit Blende, Rohrwiege und Muendungsbremsen / twin gun with mantlet, cradle and muzzle brakes"""
    fixed, moving = [], []
    c = TUR
    mant = K.box('mantlet', (0, c.y + GUN_Y - 0.12, GUN_Z), (1.0, 0.42, 0.5), 'hullDark', bevel=0.12, segs=3)
    fixed.append(mant)
    for sx in (1, -1):
        x = 0.24 * sx
        y0 = c.y + GUN_Y - 0.3
        collar = K.lathe('guncollar', [(0.0, 0.0), (0.2, 0.0), (0.2, 0.1), (0.15, 0.24), (0.0, 0.24)], 'hullDark', seg=12, origin=(0, 0, 0))
        K.transform(collar, Matrix.Translation((x, y0, GUN_Z)) @ K.rot('X', 90))
        fixed.append(collar)
        prof = [(r_, -0.3 if z_ < 0 else z_ * BARREL) for r_, z_ in [(0.0, -0.3), (0.115, -0.3), (0.115, 0.5), (0.1, 0.56), (0.095, 1.3), (0.105, 1.34), (0.105, 1.42), (0.09, 1.46), (0.09, 1.56), (0.0, 1.56)]]
        barrel = K.lathe('barrel', prof, 'hullDark', seg=10)
        K.paint_slot(barrel, lambda cc, n: 'metal' if cc.z > 0.56 * BARREL else None)
        K.transform(barrel, Matrix.Translation((x, y0, GUN_Z)) @ K.rot('X', 90))
        moving.append(barrel)
        # Muendungsbremse: Kasten mit seitlichen Schlitzen (Boolesch ausgeschnitten) / muzzle brake: box with side slots (cut by boolean)
        by = y0 - 1.56 * BARREL - 0.18
        brake = K.box('brake', (x, by, GUN_Z), (0.3, 0.36, 0.26), 'hullDark', bevel=0.04, segs=2)
        if q > 0.99:
            K.boolean(brake, K.box('brakecut', (x, by, GUN_Z), (0.5, 0.1, 0.13), 'ink'), 'DIFFERENCE')
            K.boolean(brake, K.cylinder('borecut', (x, by + 0.24, GUN_Z), (x, by - 0.26, GUN_Z), 0.07, 'ink', seg=8), 'DIFFERENCE')
            brake.data.shade_smooth()
            brake.data.set_sharp_from_angle(angle=math.radians(40))
        moving.append(brake)
        bore = K.cylinder('bore', (x, by - 0.16, GUN_Z), (x, by - 0.185, GUN_Z), 0.062, 'ink', seg=8)
        K.set_line(bore, 0.0)
        moving.append(bore)
    for p in fixed:
        K.skin_rigid(p, 'turret')
    for p in moving:
        K.skin_rigid(p, 'gun')
    for p in fixed + moving:
        K.transform(p, TUR_M)
    return fixed, moving


def build_rig(wheel_bones):
    c = TUR
    bones = [
        ('root', None, (0, 0, 0), (0, 0, 0.3), True),
        ('body', 'root', (0, 0, 0.6), (0, 0, 1.0), True),
        ('turret', 'body', TUR_M @ c, TUR_M @ c + V((0, 0, 0.5)), True),
        ('gun', 'turret', TUR_M @ V((0, c.y + GUN_Y, GUN_Z)), TUR_M @ V((0, c.y + GUN_Y, GUN_Z)) + V((0, -0.6, 0)), True, (0, 0, 1)),
    ]
    for nm, pos, r, kind in wheel_bones:
        sx = 1 if pos[0] > 0 else -1
        bones.append((nm, 'root', pos, (pos[0] + 0.3 * sx, pos[1], pos[2]), True, (0, 0, 1)))
    return K.make_armature('tank', bones)


def animate(arm, mesh, wheel_bones, pitch):
    pb = arm.pose.bones
    key = mesh.data.shape_keys
    roll = key.key_blocks['roll']
    key.animation_data_create()

    def kb(name, f, loc=None, rot=None):
        K.key(pb[name], f, loc=loc, rot_q=rot)

    # --- idle: Motor laeuft, Wanne zittert leicht / engine running, hull trembles slightly
    K.new_action(arm, 'idle')
    for f in range(0, 25, 2):
        t = f / 24 * 2 * math.pi
        kb('body', 1 + f, loc=V((0, 0.006 * math.sin(4 * t), 0)), rot=Quaternion((1, 0, 0), math.radians(0.25 * math.sin(2 * t))))
    K.stash(arm, 'idle')

    # --- drive: ein Kettenglied weiter je Durchlauf; Raeder drehen um genau ihre Teilung (Schleife ohne Sprung)
    # --- drive: one track link further per pass; wheels turn by exactly their pattern step (loop without a jump)
    n = 8
    K.new_action(arm, 'drive')
    for nm, pos, r, kind in wheel_bones:
        step = 36.0 if kind == 'sprocket' else 30.0
        sx = 1 if pos[0] > 0 else -1
        for f in (0, n):
            # Knochen-y zeigt nach aussen: vorwaerts rollt links und rechts gegensinnig / bone y points outwards: rolling forward is opposite left and right
            kb(nm, 1 + f, rot=Quaternion((0, 1, 0), math.radians(step * sx * f / n)))
    for f in range(0, n + 1, 2):
        t = f / n * 2 * math.pi
        kb('body', 1 + f, loc=V((0, 0.008 * math.sin(t), 0)), rot=Quaternion((1, 0, 0), math.radians(0.5 * math.sin(t))))
    K.linear_keys(arm.animation_data.action)
    K.stash(arm, 'drive')
    act = bpy.data.actions.new('drive.sk')
    key.animation_data.action = act
    roll.value = 0.0
    roll.keyframe_insert('value', frame=1)
    roll.value = 1.0
    roll.keyframe_insert('value', frame=1 + n)
    K.linear_keys(act)
    K.stash(key, 'drive')
    roll.value = 0.0

    # --- fire: Rohrruecklauf, Wanne nickt nach hinten und schwingt aus / gun recoil, hull rocks back and settles
    K.new_action(arm, 'fire')
    for f, back in ((1, 0), (3, 0.42), (5, 0.38), (12, 0.12), (18, 0.02), (22, 0)):
        kb('gun', f, loc=V((0, -back, 0)))
    for f, deg, dy in ((1, 0, 0), (4, -2.6, 0.05), (8, 1.1, -0.01), (13, -0.5, 0), (18, 0.2, 0), (24, 0, 0)):
        kb('body', f, loc=V((0, 0, -dy)), rot=Quaternion((1, 0, 0), math.radians(deg)))
    K.stash(arm, 'fire')
    for b in pb:
        b.location = (0, 0, 0)
        b.rotation_quaternion = (1, 0, 0, 0)
    bpy.context.scene.frame_set(1)


def build(q=1.0):
    K.reset()
    wheels, tracks, wheel_bones, shift = build_running_gear(q)
    hull = build_hull(q)
    turret = build_turret(q)
    fixed, moving = build_gun(q)
    if K.VERBOSE:
        K.report(wheels + tracks + hull + turret + fixed + moving)
    # Verdeckungslicht in Gruppen: drehende Teile nur mit sich selbst, damit kein Schatten mitwandert
    # occlusion in groups: turning parts only with themselves so no shadow travels along
    track = K.join(tracks, 'tracks')
    body = K.join(hull, 'hull')
    tur = K.join(turret + fixed, 'turretAll')
    gun = K.join(moving, 'gun')
    K.bake_ao(body, occluders=[track, tur] + wheels, samples=40, dist=1.0, floor=0.0, strength=0.8)
    K.bake_ao(track, occluders=[body] + wheels, samples=24, dist=0.6, floor=0.0, strength=0.6)
    K.bake_ao(tur, occluders=[gun], samples=40, dist=0.8, strength=0.8)
    K.bake_ao(gun, samples=24, dist=0.4, strength=0.6)
    # Kette zuerst: ihre Vertexnummern bleiben so die des Morphziels / track first: its vertex numbers thus stay those of the morph target
    mesh = K.join([track, body, tur, gun] + wheels, 'tank')
    K.write_slot_uv(mesh)
    mesh.shape_key_add(name='Basis')
    sk = mesh.shape_key_add(name='roll')
    for i, c in enumerate(shift):
        sk.data[i].co = c
    arm = build_rig(wheel_bones)
    K.bind(mesh, arm)
    animate(arm, mesh, wheel_bones, 0.2)
    return arm, mesh
