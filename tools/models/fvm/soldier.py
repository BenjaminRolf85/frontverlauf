"""
Korvat-Schuetze als modelliertes Asset: verschmolzene Koerperformen (Jacke mit Aermeln, Reithose, Kopf mit Gesicht,
Haende mit Fingern), Stahlhelm als Schale, Ausruestung, Gewehr mit Bajonett, Skelett mit IK und drei Clips.
Korvat rifleman as a modelled asset: fused body forms (jacket with sleeves, breeches, head with face, hands with
fingers), steel helmet as a shell, gear, rifle with bayonet, skeleton with IK and three clips.

Masse in Modell-Einheiten, Proportion "Comic-Held": etwa 1.85 hoch bis zur Helmspitze, knapp 4 Kopfhoehen (Kopf, Haende
und Stiefel bewusst groesser als in der Natur, damit die Figur auf dem Brett lesbar bleibt). Das Spiel skaliert beim Laden.
Sizes in model units, "comic hero" proportion: about 1.85 tall to the helmet top, just under 4 heads (head, hands and
boots deliberately larger than life so the figure stays readable on the board). The game scales at load time.
"""
import math

import bpy
from mathutils import Matrix, Quaternion, Vector

from . import kit as K

V = Vector

# Kopf, Haende, Gliedmassen: Vergroesserung gegenueber natuerlichen Massen / head, hands, limbs: enlargement over natural sizes
HEAD_S = 1.5
HEAD_PIV = V((0, 0.012, 1.36))
HAND_S = 1.35
ARM = 1.22
# Beine gestaucht: alles unter CUT wird in der Hoehe mit LEG_S skaliert, der Rest rueckt um DROP nach unten
# legs squashed: everything below CUT is scaled in height by LEG_S, the rest moves down by DROP
LEG_S = 0.78
CUT = 0.74
DROP = CUT * (1 - LEG_S)
RIFLE_THICK = 1.3
HEAD_M = Matrix.Translation(HEAD_PIV) @ Matrix.Diagonal((HEAD_S, HEAD_S, HEAD_S, 1)) @ Matrix.Translation(-HEAD_PIV)

# Angaben fuer das Spiel: Hoehe bis zur Helmspitze (zum Angleichen der Groesse), Kopfmitte (Gesichtsansicht)
# facts for the game: height to the helmet top (for size matching), head centre (face view)
META = {'fitHeight': round((HEAD_M @ V((0, 0, 1.766))).z - DROP, 4), 'headCenter': round((HEAD_M @ V((0, 0, 1.53))).z - DROP, 4)}

# ---------- Gelenke der Ruhehaltung (A-Pose) / joints of the rest pose (A-pose) ----------
J0 = {
    'hips': V((0, 0.0, 0.86)), 'spine': V((0, 0.0, 0.98)), 'chest': V((0, 0.0, 1.14)), 'neck': V((0, 0.012, 1.325)),
    'head': V((0, 0.005, 1.40)), 'headTop': V((0, 0.005, 1.82)),
}
for s, sx in (('L', 1), ('R', -1)):
    sh = V((0.215 * sx, 0.012, 1.275))
    el = sh + V((0.62 * sx, 0.06, -0.78)).normalized() * 0.27
    wr = el + V((0.55 * sx, -0.22, -0.80)).normalized() * 0.25
    J0['shoulder.' + s], J0['elbow.' + s], J0['wrist.' + s] = sh, el, wr
    J0['handEnd.' + s] = wr + (wr - el).normalized() * 0.12
    J0['hip.' + s] = V((0.095 * sx, 0.0, 0.88))
    J0['knee.' + s] = V((0.105 * sx, -0.02, 0.48))
    J0['ankle.' + s] = V((0.11 * sx, 0.012, 0.105))
    J0['toe.' + s] = V((0.13 * sx, -0.19, 0.035))

J = {k: v.copy() for k, v in J0.items()}


def remap_z(z):
    return z * LEG_S if z <= CUT else z - DROP


# Gewehr in Ruhe (Hueftanschlag, Bajonett schraeg nach vorn): Griffpunkt der rechten Hand, Laufrichtung, Oberseite
# rifle at rest (carried at the hip, bayonet pointing forward at an angle): right hand grip point, barrel direction, top side
RIFLE_P = V((-0.205, -0.07, 0.835))
RIFLE_A = V((0.6, -0.76, 0.26)).normalized()
RIFLE_UP = V((0.05, 0.0, 1.0))
LEFT_GRIP = 0.33  # Abstand der linken Hand vor dem Griff / distance of the left hand ahead of the grip
# Mitte des umgriffenen Schafts im Handraum / centre of the gripped stock in hand space
GRIP_C = V((0, 0.094, -0.040)) * HAND_S


def bone_segments():
    seg = {
        'hips': (J['hips'], J['spine']), 'spine': (J['spine'], J['chest']), 'chest': (J['chest'], J['neck']),
        'neck': (J['neck'], J['head']), 'head': (J['head'], J['headTop']),
    }
    for s in ('L', 'R'):
        seg['upper_arm.' + s] = (J['shoulder.' + s], J['elbow.' + s])
        seg['forearm.' + s] = (J['elbow.' + s], J['wrist.' + s])
        seg['hand.' + s] = (J['wrist.' + s], J['handEnd.' + s])
        seg['thigh.' + s] = (J['hip.' + s], J['knee.' + s])
        seg['shin.' + s] = (J['knee.' + s], J['ankle.' + s])
        seg['foot.' + s] = (J['ankle.' + s], J['toe.' + s])
    return seg


SEG = bone_segments()


def reset_joints():
    """Gelenke auf die Bauhaltung zuruecksetzen (vor dem Stauchen der Beine) / reset the joints to the build pose (before the leg squash)"""
    J.clear()
    J.update({k: v.copy() for k, v in J0.items()})
    SEG.clear()
    SEG.update(bone_segments())


def squash_joints():
    for k in J:
        J[k] = V((J[k].x, J[k].y, remap_z(J[k].z)))


def lerp(a, b, t):
    return a + (b - a) * t


# ---------- Koerperteile / body parts ----------

def hard(parts, q):
    """Teile ohne Verschmelzung fuer die niedrige Detailstufe ausduennen / thin out unfused parts for the low detail level"""
    if q < 0.99:
        for p in parts:
            if K.tri_count(p) > 40:
                K.decimate(p, ratio=max(0.5, q + 0.12))
                p.data.shade_smooth()
                p.data.set_sharp_from_angle(angle=math.radians(40))
    return parts


def build_pants(q):
    parts = []
    pelvis = K.tube('pelvis', [
        (V((0, 0.005, 0.74)), 0.10, 0.10), (V((0, 0.005, 0.80)), 0.165, 0.125), (V((0, 0.005, 0.88)), 0.17, 0.13),
        (V((0, 0.0, 0.97)), 0.15, 0.115),
    ], 'pants', seg=16, ref=(1, 0, 0))
    K.subsurf(pelvis, 1)
    K.skin_bones(pelvis, ['hips'], SEG)
    parts.append(pelvis)
    for s, sx in (('L', 1), ('R', -1)):
        hip, knee, ank = J['hip.' + s], J['knee.' + s], J['ankle.' + s]
        out = V((sx, 0, 0))
        # Reithose: weit am Oberschenkel (nach aussen ausgestellt), eng unter dem Knie
        # breeches: wide at the thigh (flared outwards), tight below the knee
        rings = [
            (hip + V((0, 0, 0.02)), 0.098, 0.104),
            (lerp(hip, knee, 0.22) + out * 0.014, 0.116, 0.118),
            (lerp(hip, knee, 0.50) + out * 0.03, 0.128, 0.116),
            (lerp(hip, knee, 0.74) + out * 0.02, 0.106, 0.1),
            (lerp(hip, knee, 0.93), 0.078, 0.082),
            (knee + V((0, -0.004, -0.02)), 0.07, 0.076),
            (lerp(knee, ank, 0.25), 0.062, 0.068),
            (lerp(knee, ank, 0.45), 0.056, 0.062),
        ]
        leg = K.tube('leg.' + s, rings, 'pants', seg=14, ref=(1, 0, 0))
        K.subsurf(leg, 1)
        K.skin_bones(leg, ['thigh.' + s, 'shin.' + s], SEG, power=5)
        parts.append(leg)
    return K.fuse('pants', parts, 'pants', voxel=0.012, smooth=4, tris=int(1300 * q))


def build_boot(s, sx, q):
    knee, ank, toe = J['knee.' + s], J['ankle.' + s], J['toe.' + s]
    top = lerp(knee, ank, 0.2)
    shaft = K.tube('shaft', [
        (top, 0.082, 0.088), (lerp(knee, ank, 0.34), 0.078, 0.084), (lerp(knee, ank, 0.62), 0.066, 0.074),
        (lerp(knee, ank, 0.88), 0.06, 0.07), (ank + V((0, 0.005, -0.03)), 0.062, 0.074),
    ], 'boots', seg=14, ref=(1, 0, 0))
    K.subsurf(shaft, 1)
    # Stulpe als Wulst am Schaftrand / cuff as a roll at the top of the shaft
    cuff = K.tube('cuff', [(top + V((0, 0, 0.014)), 0.088, 0.095), (top + V((0, 0, -0.014)), 0.09, 0.097)], 'boots', seg=14, ref=(1, 0, 0))
    K.subsurf(cuff, 1)
    heel = V((ank.x, ank.y + 0.05, 0.06))
    foot = K.tube('foot', [
        (heel, 0.056, 0.05), (V((ank.x, ank.y - 0.02, 0.078)), 0.064, 0.068), (V((lerp(ank, toe, 0.5).x, ank.y - 0.11, 0.064)), 0.072, 0.056),
        (V((toe.x, toe.y - 0.01, 0.058)), 0.076, 0.05), (V((toe.x, toe.y - 0.075, 0.052)), 0.06, 0.042),
    ], 'boots', seg=14, ref=(1, 0, 0))
    K.subsurf(foot, 1)
    for p in (shaft, cuff):
        K.skin_bones(p, ['shin.' + s, 'foot.' + s], SEG, power=6)
    K.skin_rigid(foot, 'foot.' + s)
    boot = K.fuse('boot.' + s, [shaft, cuff, foot], 'boots', voxel=0.009, smooth=3, tris=int(460 * q))
    # Sohle mit Absatz / sole with heel
    pts = []
    for a in range(0, 360, 30):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        pts.append((ank.x + 0.012 * sx + 0.078 * ca * (1.0 if sa < 0 else 0.84), ank.y - 0.085 + 0.19 * sa))
    sole = K.extrude_profile('sole.' + s, pts, 0.03, 'rubber', axis='Z', bevel=0.007, segs=1)
    K.move(sole, (0, 0, 0.015))
    K.skin_rigid(sole, 'foot.' + s)
    return [boot] + hard([sole], q)


def build_jacket(q):
    parts = []
    torso = K.tube('torso', [
        (V((0, 0.006, 0.735)), 0.262, 0.192, 2.3), (V((0, 0.006, 0.83)), 0.232, 0.172, 2.3),
        (V((0, 0.004, 0.955)), 0.162, 0.126, 2.2), (V((0, 0.002, 1.005)), 0.178, 0.138, 2.2),
        (V((0, -0.004, 1.11)), 0.196, 0.148, 2.3), (V((0, -0.008, 1.20)), 0.208, 0.153, 2.4),
        (V((0, 0.0, 1.275)), 0.2, 0.128, 2.6), (V((0, 0.008, 1.32)), 0.13, 0.108, 2.2),
        (V((0, 0.012, 1.35)), 0.092, 0.092, 2.0),
    ], 'jacket', seg=20, ref=(1, 0, 0), flat=(True, False))
    K.subsurf(torso, 1)

    def torso_w(co):
        if co.z < 0.93:
            t = min(1.0, (0.93 - co.z) / 0.17)
            side = max(0.0, min(1.0, 0.5 + co.x / 0.12))
            return {'hips': 1 - 0.5 * t, 'thigh.L': 0.5 * t * side, 'thigh.R': 0.5 * t * (1 - side)}
        if co.z < 1.06:
            t = (co.z - 0.93) / 0.13
            return {'hips': 1 - t, 'spine': t}
        if co.z < 1.2:
            t = (co.z - 1.06) / 0.14
            return {'spine': 1 - t, 'chest': t}
        return {'chest': 1.0}
    K.skin_fn(torso, torso_w)
    parts.append(torso)
    for s, sx in (('L', 1), ('R', -1)):
        sh, el, wr = J['shoulder.' + s], J['elbow.' + s], J['wrist.' + s]
        cap = K.ellipsoid('cap.' + s, sh + V((-0.012 * sx, 0, 0.004)), (0.09, 0.086, 0.08), 'jacket')
        K.skin_fn(cap, lambda co, s=s: {'chest': 0.5, 'upper_arm.' + s: 0.5})
        parts.append(cap)
        back = V((0, 1, 0))
        rr = [0.074, 0.071, 0.064, 0.063, 0.061, 0.055, 0.052]
        rr = [r * ARM for r in rr]
        rings = [
            (sh, rr[0], rr[0]), (lerp(sh, el, 0.35), rr[1], rr[1]), (lerp(sh, el, 0.75), rr[2], rr[2] * 1.03),
            (el + back * 0.006, rr[3], rr[3] * 1.05), (lerp(el, wr, 0.3), rr[4], rr[4]), (lerp(el, wr, 0.7), rr[5], rr[5]),
            (lerp(el, wr, 0.9), rr[6], rr[6]),
        ]
        sleeve = K.tube('sleeve.' + s, rings, 'jacket', seg=12)
        K.subsurf(sleeve, 1)
        K.skin_bones(sleeve, ['upper_arm.' + s, 'forearm.' + s], SEG, power=5)
        parts.append(sleeve)
        d = (wr - el).normalized()
        # Faltenwuelste in der Armbeuge / fold rolls at the elbow
        for t in (-0.04, 0.04):
            c = el + d * t if t > 0 else el + (el - sh).normalized() * t
            fold = K.ellipsoid('fold', c, (0.078, 0.078, 0.016), 'jacket', m=K.frame((0, 0, 0), d, (0, 0, 1)).to_3x3().to_4x4() @ K.rot('X', 90))
            K.skin_bones(fold, ['upper_arm.' + s, 'forearm.' + s], SEG, power=5)
            parts.append(fold)
    # Knopfleiste vorn / button placket in front
    placket = K.box('placket', (0, -0.142, 1.10), (0.05, 0.03, 0.44), 'jacket', bevel=0.012)
    K.skin_fn(placket, lambda co: {'spine': 0.5, 'chest': 0.5} if co.z > 1.0 else {'hips': 1.0})
    parts.append(placket)
    return K.fuse('jacket', parts, 'jacket', voxel=0.011, smooth=3, tris=int(2400 * q))


def build_jacket_trim(jacket, q):
    """Kragen, Aermelaufschlaege, Brusttaschen, Knoepfe / collar, cuffs, chest pockets, buttons"""
    tree = K.surface_tree(jacket)
    out = []
    c = K.tube('collar', [(V((0, 0.012, 1.318)), 0.097, 0.099), (V((0, 0.012, 1.392)), 0.09, 0.093)], 'jacketDark', seg=14, ref=(1, 0, 0), cap=False)
    K.solidify(c, 0.016, offset=1.0)
    c.data.set_sharp_from_angle(angle=math.radians(50))
    K.skin_fn(c, lambda co: {'chest': 0.6, 'neck': 0.4})
    out.append(c)
    for s, sx in (('L', 1), ('R', -1)):
        el, wr = J['elbow.' + s], J['wrist.' + s]
        d = (wr - el).normalized()
        # Aermelaufschlag in der Zweitfarbe / cuff in the secondary colour
        cuff = K.tube('cuffj.' + s, [(wr - d * 0.085, 0.063 * ARM, 0.063 * ARM), (wr - d * 0.05, 0.064 * ARM, 0.064 * ARM), (wr - d * 0.012, 0.062 * ARM, 0.062 * ARM)], 'trim', seg=12, flat=(True, True))
        K.set_line(cuff, 0.6)
        K.skin_rigid(cuff, 'forearm.' + s)
        out.append(cuff)
        # Brusttasche mit Klappe und Knopf / chest pocket with flap and button
        x = 0.128 * sx
        pocket = K.strap('pocket.' + s, [(x, -0.25, 1.2), (x, -0.25, 1.15), (x, -0.25, 1.1)], 0.084, 'jacket', tree=tree, thickness=0.007, offset=0.002, per=3)
        flap = K.strap('pflap.' + s, [(x, -0.25, 1.208), (x, -0.25, 1.185), (x, -0.25, 1.166)], 0.094, 'jacketDark', tree=tree, thickness=0.008, offset=0.008, per=2)
        loc, nor, _i, _d = tree.find_nearest(V((x, -0.25, 1.176)))
        btn = K.ellipsoid('pbutton.' + s, loc + nor * 0.017, 0.0085, 'brass', seg=8, rings=5)
        K.set_line(pocket, 0.45)
        K.set_line(flap, 0.45)
        K.set_line(btn, 0.0)
        for p in (pocket, flap, btn):
            K.skin_rigid(p, 'chest')
        out += [pocket, flap, btn]
    for z in (1.04, 1.12, 1.2, 1.278):
        loc, nor, _i, _d = tree.find_nearest(V((0, -0.3, z)))
        b = K.ellipsoid('button', loc + nor * 0.004, (0.0115, 0.0115, 0.0115), 'brass', seg=8, rings=5)
        K.set_line(b, 0.0)
        K.skin_rigid(b, 'chest' if z > 1.15 else 'spine')
        out.append(b)
    return hard(out, q)


def hand_local(side, q):
    """
    Hand im Handraum (y zu den Fingern, z Handruecken, Daumen bei +x * side), um einen Schaft gekruemmt. Handflaeche und
    Daumen sind verschmolzen, die vier Finger eigene Glieder: so zieht die Tuschelinie die Finger nach.
    Hand in hand space (y towards the fingers, z back of the hand, thumb at +x * side), curled around a stock. Palm and
    thumb are fused, the four fingers separate members: this way the ink line traces the fingers.
    """
    parts = [K.box('palm', (0, 0.052, 0.0), (0.098, 0.104, 0.038), 'skin', bevel=0.015, segs=2)]
    parts.append(K.ellipsoid('heel', (0.0, 0.02, -0.006), (0.04, 0.03, 0.02), 'skin', seg=12, rings=8))
    # Daumen legt sich von der anderen Seite um den Schaft / thumb wraps the stock from the other side
    p0 = V((0.046 * side, 0.036, -0.01))
    p1 = p0 + V((0.38 * side, 0.6, -0.55)).normalized() * 0.046
    p2 = p1 + V((-0.25 * side, 0.55, -0.8)).normalized() * 0.036
    parts.append(K.tube('thumb', [(p0 - V((0.01 * side, 0.02, 0)), 0.02, 0.02), (p0, 0.019, 0.019), (lerp(p0, p1, 0.6), 0.016, 0.016), (p1, 0.0155, 0.0155), (lerp(p1, p2, 0.6), 0.0135, 0.0135), (p2, 0.011, 0.011)], 'skin', seg=8))
    # Handgelenk / wrist
    parts.append(K.tube('wrist', [(V((0, -0.06, 0)), 0.034, 0.028), (V((0, 0.02, 0)), 0.04, 0.03)], 'skin', seg=10, ref=(1, 0, 0)))
    out = [K.fuse('hand', parts, 'skin', voxel=0.0055, smooth=2, tris=int(260 * q), keep_weights=False)]
    fingers = [  # x, Laengen, Radius / x, lengths, radius
        (0.037, (0.046, 0.032, 0.026), 0.0128), (0.0125, (0.05, 0.034, 0.027), 0.0132),
        (-0.012, (0.046, 0.032, 0.026), 0.0128), (-0.0355, (0.036, 0.026, 0.022), 0.0115),
    ]
    curls = (50, 72, 55)
    for i, (x, lens, r) in enumerate(fingers):
        p = V((x * side, 0.096, 0.002))
        ang = 0.0
        rings = [(p - V((0, 0.03, 0)), r, r)]
        for k in range(3):
            ang += curls[k] + (4 if i == 0 else 0)
            d = V((0, math.cos(math.radians(ang)), -math.sin(math.radians(ang))))
            rr = r * (1 - 0.1 * k)
            rings.append((p + d * lens[k] * 0.1, rr * 1.06, rr * 1.06))
            rings.append((p + d * lens[k] * 0.62, rr * 0.95, rr * 0.95))
            p = p + d * lens[k]
        rings.append((p, r * 0.7, r * 0.7))
        out.append(K.tube('finger%d' % i, rings, 'skin', seg=6 if q > 0.99 else 5))
    h = K.join(out, 'hand')
    h.data.shade_smooth()
    K.transform(h, Matrix.Diagonal((HAND_S, HAND_S, HAND_S, 1)))
    K.set_line(h, 0.4)
    return h


def hand_rest_matrix(s, sx):
    """Ruhelage des Handknochens: y entlang der Hand, z = Handruecken (nach aussen) / rest frame of the hand bone: y along the hand, z = back of the hand (outwards)"""
    wr, el = J['wrist.' + s], J['elbow.' + s]
    return K.frame(wr, wr - el, V((sx, 0.25, 0.3)))


def build_head(q):
    parts = [
        K.ellipsoid('cranium', (0, 0.012, 1.578), (0.119, 0.135, 0.128), 'skin', seg=24, rings=14),
        K.ellipsoid('jaw', (0, -0.022, 1.475), (0.099, 0.108, 0.09), 'skin', seg=20, rings=12),
        K.ellipsoid('chin', (0, -0.094, 1.418), (0.054, 0.038, 0.036), 'skin', seg=14, rings=8),
        K.ellipsoid('brow', (0, -0.1, 1.59), (0.094, 0.03, 0.02), 'skin', seg=14, rings=8),
        K.ellipsoid('muzzle', (0, -0.1, 1.456), (0.056, 0.034, 0.034), 'skin', seg=14, rings=8),
        K.ellipsoid('lip', (0, -0.121, 1.436), (0.03, 0.014, 0.011), 'skin', seg=12, rings=6),
        K.tube('neck', [(V((0, 0.02, 1.29)), 0.08, 0.08), (V((0, 0.012, 1.36)), 0.075, 0.078), (V((0, 0.006, 1.46)), 0.08, 0.084)], 'skin', seg=14, ref=(1, 0, 0)),
        K.tube('nose', [(V((0, -0.112, 1.578)), 0.013, 0.012), (V((0, -0.134, 1.545)), 0.016, 0.016), (V((0, -0.16, 1.512)), 0.025, 0.023), (V((0, -0.152, 1.492)), 0.02, 0.014)], 'skin', seg=10, ref=(1, 0, 0)),
    ]
    for sx in (1, -1):
        parts.append(K.ellipsoid('cheek', (0.064 * sx, -0.074, 1.488), (0.042, 0.036, 0.042), 'skin', seg=12, rings=8))
        parts.append(K.ellipsoid('nostril', (0.02 * sx, -0.138, 1.497), (0.016, 0.016, 0.012), 'skin', seg=10, rings=6))
        parts.append(K.ellipsoid('ear', (0.121 * sx, 0.02, 1.528), (0.016, 0.034, 0.05), 'skin', seg=12, rings=8, m=K.rot('Z', -22 * sx)))
    for p in parts:
        K.skin_rigid(p, 'head')
    K.skin_fn(parts[6], lambda co: {'chest': 1.0} if co.z < 1.32 else ({'neck': 1.0} if co.z < 1.4 else {'head': 1.0}))
    for p in parts:
        if p.name != 'neck':
            K.transform(p, HEAD_M)
    cut = []
    for sx in (1, -1):
        cut.append(K.transform(K.ellipsoid('socket', (0.052 * sx, -0.098, 1.544), (0.036, 0.03, 0.03), 'skin', seg=16, rings=10), HEAD_M))
        cut.append(K.transform(K.ellipsoid('earhole', (0.137 * sx, 0.012, 1.528), (0.01, 0.016, 0.026), 'skin', seg=10, rings=6), HEAD_M))
    head = K.fuse('head', parts, 'skin', voxel=0.0068, smooth=2, tris=int(2300 * q), cutters=cut)
    # Gesicht und Ohren: feine Linie, damit Nase und Lippen nicht zuschmieren / face and ears: fine line so nose and lips do not clog
    front = (HEAD_M @ V((0, -0.06, 0))).y
    K.set_line_fn(head, lambda co: 0.3 if co.y < front or abs(co.x) > 0.118 * HEAD_S else 1.0)
    extra = []
    for sx in (1, -1):
        eye = K.ellipsoid('eye', (0.052 * sx, -0.086, 1.544), (0.033, 0.03, 0.029), 'eyeWhite', seg=12, rings=7)
        pupil = K.ellipsoid('pupil', (0.049 * sx, -0.111, 1.542), (0.0155, 0.007, 0.017), 'ink', seg=8, rings=5)
        # Oberlid als dunkler Strich / upper lid as a dark stroke
        lid = K.tube('lid', [(V((0.017 * sx, -0.106, 1.553)), 0.004, 0.004), (V((0.034 * sx, -0.117, 1.571)), 0.006, 0.006), (V((0.066 * sx, -0.113, 1.571)), 0.006, 0.006), (V((0.089 * sx, -0.094, 1.553)), 0.004, 0.004)], 'ink', seg=5)
        brow = K.tube('eyebrow', [(V((0.014 * sx, -0.134, 1.586)), 0.009, 0.008), (V((0.05 * sx, -0.133, 1.603)), 0.013, 0.01), (V((0.094 * sx, -0.108, 1.6)), 0.007, 0.006)], 'hair', seg=6, ref=(1, 0, 0))
        K.set_bright(eye)
        K.set_bright(pupil)
        extra += [eye, pupil, lid, brow]
    mouth = K.tube('mouth', [(V((-0.04, -0.118, 1.457)), 0.003, 0.003), (V((-0.02, -0.134, 1.4515)), 0.0052, 0.0046), (V((0.02, -0.134, 1.4515)), 0.0052, 0.0046), (V((0.04, -0.118, 1.455)), 0.003, 0.003)], 'ink', seg=5)
    hair = K.ellipsoid('hair', (0, 0.03, 1.565), (0.122, 0.132, 0.125), 'hair', seg=16, rings=10)
    K.boolean(hair, K.box('haircut', (0, -0.12, 1.5), (0.4, 0.34, 0.5), 'hair', m=K.rot('X', -14)), 'DIFFERENCE')
    extra.append(mouth)
    for p in extra:
        K.set_line(p, 0.0)
    extra.append(hair)
    for p in extra:
        K.transform(p, HEAD_M)
        K.skin_rigid(p, 'head')
    return [head] + hard(extra, q)


def build_helmet(q):
    hx, hy, hz = 0, 0.016, 1.624
    prof = [(0.0, 0.142), (0.03, 0.14), (0.058, 0.133), (0.084, 0.12), (0.107, 0.103), (0.126, 0.08), (0.14, 0.054), (0.149, 0.03), (0.153, 0.004), (0.155, -0.022), (0.168, -0.04), (0.194, -0.052)]
    shell = K.lathe('helmet', prof, 'helmet', seg=20, sy=1.1)
    K.solidify(shell, 0.014, offset=-1.0)
    shell.data.shade_smooth()
    shell.data.set_sharp_from_angle(angle=math.radians(55))
    # rotes Band ueber der Krempe (Kennzeichen der Korvat) / red band above the brim (Korvat mark)
    K.paint_slot(shell, lambda c, n: 'primary' if -0.024 < c.z < 0.032 and n.z > -0.3 and (c.x * c.x + c.y * c.y / 1.21) > 0.14 ** 2 else None)
    parts = [shell]
    # Plakette mit Zahnrad vorn / badge with cog at the front
    badge = K.cylinder('badge', (0, -0.152, 0.06), (0, -0.168, 0.066), 0.05, 'primary', seg=14)
    cog = K.cylinder('cog', (0, -0.166, 0.0655), (0, -0.176, 0.069), 0.027, 'badge', seg=10)
    hub = K.cylinder('hub', (0, -0.174, 0.0685), (0, -0.18, 0.0705), 0.011, 'primary', seg=8)
    parts += [badge, cog, hub]
    for k in range(8):
        a = math.radians(k * 45)
        tooth = K.box('tooth', (math.cos(a) * 0.032, -0.1715, 0.0675 + math.sin(a) * 0.032), (0.016, 0.008, 0.013), 'badge', m=K.rot('Y', -k * 45))
        parts.append(tooth)
    for p in parts[1:]:
        K.set_line(p, 0.3)
    h = K.join(parts, 'helmet')
    K.transform(h, HEAD_M @ K.trs((hx, hy, hz), (-6, 0, 0)))
    K.skin_rigid(h, 'head')
    # Kinnriemen / chin strap
    pts = [(0.128, 0.02, 1.60), (0.12, -0.03, 1.52), (0.094, -0.078, 1.43), (0.0, -0.126, 1.392), (-0.094, -0.078, 1.43), (-0.12, -0.03, 1.52), (-0.128, 0.02, 1.60)]
    strap = K.tube('chinstrap', [(V(p), 0.0035, 0.008) for p in K._catmull(pts, 3)], 'boots', seg=4, ref=(0, 0.3, 1))
    K.transform(strap, HEAD_M)
    K.set_line(strap, 0.0)
    K.skin_rigid(strap, 'head')
    return hard([h, strap], q)


def build_gear(jacket, q):
    tree = K.surface_tree(jacket)
    out = []

    def ring(z, r=0.25, n=14):
        return [(math.cos(2 * math.pi * k / n) * r, math.sin(2 * math.pi * k / n) * r, z) for k in range(n)]
    belt = K.strap('belt', ring(0.957), 0.06, 'gear', tree=tree, thickness=0.012, offset=0.003, closed=True, per=3)
    K.skin_fn(belt, lambda co: {'hips': 0.5, 'spine': 0.5})
    buckle = K.box('buckle', (0, -0.147, 0.957), (0.066, 0.016, 0.07), 'brass', bevel=0.006, segs=1)
    K.set_line(buckle, 0.4)
    K.skin_fn(buckle, lambda co: {'hips': 0.5, 'spine': 0.5})
    out += [belt, buckle]
    # Patronentaschen / ammo pouches
    for sx in (1, -1):
        for k, ang in enumerate((30, 62)):
            a = math.radians(ang)
            x, y = math.sin(a) * 0.184 * sx, -math.cos(a) * 0.142
            m = K.rot('Z', ang * sx)
            pouch = K.box('pouch', (x, y, 0.943), (0.074, 0.044, 0.09), 'canvas', m=m, bevel=0.012, segs=1)
            flap = K.box('flap', (x * 1.03, y * 1.03, 0.972), (0.08, 0.05, 0.042), 'gear', m=m, bevel=0.012, segs=1)
            stud = K.ellipsoid('stud', (x * 1.17, y * 1.17, 0.956), 0.007, 'brass', seg=6, rings=4)
            K.set_line(stud, 0.0)
            for p in (pouch, flap, stud):
                K.skin_fn(p, lambda co: {'hips': 0.6, 'spine': 0.4})
            K.set_line(flap, 0.5)
            out += [pouch, flap, stud]
    # Tornister mit Deckenrolle, Tragriemen, Kochgeschirr / knapsack with bedroll, carrying straps, mess tin
    pack = K.box('pack', (0, 0.222, 1.125), (0.3, 0.14, 0.29), 'canvas', bevel=0.032, segs=2)
    lid = K.box('packlid', (0, 0.24, 1.215), (0.31, 0.125, 0.125), 'gear', bevel=0.027, segs=2)
    out += [pack, lid]
    roll = K.cylinder('bedroll', (-0.18, 0.21, 1.325), (0.18, 0.21, 1.325), 0.066, 'pants', seg=12)
    K.bevel(roll, 0.018, 2, angle=40)
    out.append(roll)
    for x in (-0.1, 0.1):
        rs = K.cylinder('rollstrap', (x - 0.013, 0.21, 1.325), (x + 0.013, 0.21, 1.325), 0.07, 'gear', seg=12)
        ps = K.box('packstrap', (x, 0.303, 1.14), (0.024, 0.012, 0.21), 'gear', bevel=0.004, segs=1)
        pb = K.box('packbuckle', (x, 0.31, 1.075), (0.032, 0.01, 0.028), 'brass')
        K.set_line(rs, 0.3)
        K.set_line(ps, 0.3)
        K.set_line(pb, 0.0)
        out += [rs, ps, pb]
    tin = K.cylinder('messtin', (0, 0, 1.15), (0, 0, 1.25), 0.052, 'metal', seg=12)
    K.transform(tin, K.trs((0, 0.312, 0), s=(1.25, 0.6, 1)))
    K.bevel(tin, 0.01, 1, angle=40)
    out.append(tin)
    for sx in (1, -1):
        st = K.strap('carry', [(0.09 * sx, 0.16, 1.27), (0.098 * sx, 0.06, 1.345), (0.092 * sx, -0.06, 1.33), (0.085 * sx, -0.14, 1.2), (0.09 * sx, -0.15, 1.06), (0.1 * sx, -0.135, 0.985)],
                     0.036, 'gear', tree=tree, thickness=0.009, offset=0.0035, per=5)
        out.append(st)
    # Feldflasche an der rechten Hueftseite hinten, Spaten links / canteen at the right rear hip, spade on the left
    can = K.ellipsoid('canteen', (-0.2, 0.09, 0.86), (0.054, 0.066, 0.08), 'gear', seg=12, rings=8, m=K.rot('Z', 28))
    cap = K.cylinder('canteencap', (-0.2, 0.09, 0.935), (-0.2, 0.09, 0.972), 0.019, 'metal', seg=8)
    K.set_line(cap, 0.3)
    out += [can, cap]
    blade = K.extrude_profile('spade', [(-0.055, 0.0), (0.055, 0.0), (0.06, -0.11), (0.0, -0.175), (-0.06, -0.11)], 0.012, 'metal', axis='Y', bevel=0.004, segs=1)
    K.transform(blade, K.trs((0.215, 0.075, 0.91), (0, 8, -25)))
    handle = K.cylinder('spadehandle', (0.215, 0.075, 0.91), (0.2, 0.075, 1.07), 0.014, 'wood', seg=8)
    out += [blade, handle]
    for p in out:
        if not len(p.vertex_groups):
            K.skin_rigid(p, 'hips' if p.name.startswith(('canteen', 'spade')) else 'chest')
    return hard(out, q)


def build_rifle(q):
    """Gewehr im eigenen Raum: Griff der rechten Hand im Ursprung, Lauf nach -y, oben +z / rifle in its own space: right hand grip at the origin, barrel towards -y, top +z"""
    parts = []
    stock = K.tube('stock', [
        (V((0, 0.31, -0.054)), 0.019, 0.058), (V((0, 0.24, -0.044)), 0.022, 0.054), (V((0, 0.13, -0.022)), 0.023, 0.038),
        (V((0, 0.04, -0.004)), 0.023, 0.027), (V((0, -0.03, 0.004)), 0.024, 0.028), (V((0, -0.12, 0.01)), 0.025, 0.031),
        (V((0, -0.3, 0.012)), 0.024, 0.029), (V((0, -0.52, 0.014)), 0.021, 0.025), (V((0, -0.56, 0.016)), 0.017, 0.02),
    ], 'wood', seg=8, ref=(1, 0, 0), power=2.4)
    K.subsurf(stock, 1)
    parts.append(stock)
    parts.append(K.box('buttplate', (0, 0.316, -0.054), (0.04, 0.012, 0.12), 'metal', bevel=0.005, segs=1))
    parts.append(K.cylinder('barrel', (0, 0.0, 0.04), (0, -0.84, 0.04), 0.0115, 'metal', seg=8))
    parts.append(K.box('receiver', (0, -0.035, 0.037), (0.038, 0.16, 0.034), 'metal', bevel=0.008, segs=1))
    bolt = K.cylinder('bolt', (-0.012, 0.02, 0.044), (-0.06, 0.03, 0.034), 0.0065, 'metalLight', seg=6)
    knob = K.ellipsoid('knob', (-0.064, 0.031, 0.033), 0.0135, 'metalLight', seg=8, rings=5)
    mag = K.box('magazine', (0, -0.08, -0.03), (0.026, 0.075, 0.044), 'metal', bevel=0.006, segs=1)
    guard = K.tube('guard', [(V((0, -0.04, -0.018)), 0.003, 0.006), (V((0, -0.03, -0.042)), 0.003, 0.006), (V((0, 0.0, -0.048)), 0.003, 0.006), (V((0, 0.03, -0.038)), 0.003, 0.006), (V((0, 0.036, -0.02)), 0.003, 0.006)], 'metal', seg=4, ref=(1, 0, 0))
    sight = K.box('rearsight', (0, -0.14, 0.058), (0.018, 0.04, 0.012), 'metal')
    fsight = K.box('frontsight', (0, -0.81, 0.06), (0.007, 0.014, 0.02), 'metal')
    parts += [bolt, knob, mag, guard, sight, fsight]
    for y in (-0.33, -0.53):
        band = K.cylinder('band', (0, y - 0.014, 0.024), (0, y + 0.014, 0.024), 0.034, 'metalLight', seg=10)
        K.transform(band, Matrix.Translation((0, 0, 0.024)) @ Matrix.Diagonal((0.82, 1, 1.12, 1)) @ Matrix.Translation((0, 0, -0.024)))
        K.set_line(band, 0.4)
        parts.append(band)
    # Bajonett / bayonet
    sock = K.cylinder('bayosocket', (0, -0.78, 0.04), (0, -0.85, 0.04), 0.017, 'metal', seg=8)
    blade = K.extrude_profile('bayonet', [(-0.84, 0.0), (-0.86, 0.014), (-1.14, 0.005), (-1.165, -0.002), (-0.86, -0.014)], 0.009, 'metalLight', axis='X', bevel=0.003, segs=1)
    K.move(blade, (-0.024, 0, 0.034))
    arm = K.box('bayoarm', (-0.013, -0.85, 0.037), (0.028, 0.014, 0.014), 'metal')
    parts += [sock, blade, arm]
    # Trageriemen / sling
    sling = K.strap('sling', [(0, -0.53, -0.012), (0, -0.4, -0.05), (0, -0.2, -0.078), (0, 0.0, -0.09), (0, 0.16, -0.08), (0, 0.25, -0.1)], 0.028, 'gear', thickness=0.006, per=3)
    K.set_line(sling, 0.4)
    parts.append(sling)
    for p in (bolt, knob, guard, sight, fsight, mag):
        K.set_line(p, 0.35)
    hard(parts, q)
    r = K.join(parts, 'rifle')
    # Comic-Mass: Querschnitt dicker, Laenge bleibt / comic scale: thicker cross-section, same length
    K.transform(r, Matrix.Diagonal((RIFLE_THICK, 1, RIFLE_THICK, 1)))
    K.skin_rigid(r, 'rifle')
    return r


def rifle_matrix(p=RIFLE_P, a=RIFLE_A, up=RIFLE_UP):
    """Gewehrraum -> Figur: -y des Gewehrs auf die Laufrichtung a / rifle space -> figure: rifle -y onto barrel direction a"""
    return K.frame(p, -Vector(a), up)


def rifle_bone_matrix(p=RIFLE_P, a=RIFLE_A, up=RIFLE_UP):
    """Lage des Gewehrknochens (y entlang des Laufs) / pose of the rifle bone (y along the barrel)"""
    return K.frame(p, Vector(a), up)


def hips_loc(dx, dy, dz):
    """Verschiebung im Figurenraum -> Knochenraum der aufrechten Rumpfknochen (x, oben, vorn) / offset in figure space -> bone space of the upright trunk bones (x, up, front)"""
    return V((dx, dz, -dy))


def foot_target(arm, s, offset, pitch=0.0, yaw=0.0):
    """Lage des Fuss-IK aus Versatz und Drehung um den Knoechel (Grad) / foot IK pose from an offset and rotation about the ankle (degrees)"""
    base = arm.data.bones['ik_foot.' + s].matrix_local
    piv = base.translation
    m = Matrix.Translation(V(offset) + piv) @ Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Rotation(math.radians(pitch), 4, 'X') @ Matrix.Translation(-piv)
    loc = base.inverted() @ (m @ base)
    return loc.to_translation(), loc.to_quaternion()


def grip_frames(rm):
    """Soll-Lage der Handgelenke am Gewehr (Matrix im Figurenraum) / target wrist frames on the rifle (matrix in figure space)"""
    a = -(rm.to_3x3() @ V((0, 1, 0)))  # Laufrichtung / barrel direction
    up = rm.to_3x3() @ V((0, 0, 1))
    right = -(rm.to_3x3() @ V((1, 0, 0)))  # rechts vom Schuetzen aus / right as seen by the shooter
    out = {}
    # rechte Hand am Kolbenhals: Daumenseite nach vorn, Handruecken nach rechts-oben
    # right hand at the stock wrist: thumb side forward, back of the hand to the upper right
    xh = -a
    zh = (right + up * 0.35).normalized()
    yh = zh.cross(xh).normalized()
    zh = xh.cross(yh).normalized()
    R = Matrix((xh, yh, zh)).transposed().to_4x4()
    R.translation = rm.translation - R.to_3x3() @ GRIP_C
    out['R'] = R
    # linke Hand unter dem Vorderschaft: Daumenseite nach vorn, Handruecken nach unten
    # left hand under the fore-end: thumb side forward, back of the hand down
    xh = a
    zh = (-up).normalized()
    yh = zh.cross(xh).normalized()
    L = Matrix((xh, yh, zh)).transposed().to_4x4()
    L.translation = rm.translation + a * LEFT_GRIP + up * (0.012 * RIFLE_THICK) - L.to_3x3() @ GRIP_C
    out['L'] = L
    return out


# ---------- Skelett / skeleton ----------

def build_rig():
    rm = rifle_matrix()
    grips = grip_frames(rm)
    a = RIFLE_A
    bones = [
        ('root', None, (0, 0, 0), (0, 0.2, 0), False),
        ('hips', 'root', J['hips'], J['spine'], True),
        ('spine', 'hips', J['spine'], J['chest'], True),
        ('chest', 'spine', J['chest'], J['neck'], True),
        ('neck', 'chest', J['neck'], J['head'], True),
        ('head', 'neck', J['head'], J['headTop'], True),
        ('rifle', 'chest', rm.translation, rm.translation + a * 0.3, True, rm.to_3x3() @ V((0, 0, 1))),
    ]
    for s, sx in (('L', 1), ('R', -1)):
        hm = hand_rest_matrix(s, sx)
        bones += [
            ('upper_arm.' + s, 'chest', J['shoulder.' + s], J['elbow.' + s], True),
            ('forearm.' + s, 'upper_arm.' + s, J['elbow.' + s], J['wrist.' + s], True),
            ('hand.' + s, 'forearm.' + s, J['wrist.' + s], J['handEnd.' + s], True, hm.to_3x3() @ V((0, 0, 1))),
            ('thigh.' + s, 'hips', J['hip.' + s], J['knee.' + s], True),
            ('shin.' + s, 'thigh.' + s, J['knee.' + s], J['ankle.' + s], True),
            ('foot.' + s, 'shin.' + s, J['ankle.' + s], J['toe.' + s], True, (0, 0, 1)),
            ('ik_foot.' + s, 'root', J['ankle.' + s], J['toe.' + s], False, (0, 0, 1)),
            ('pole_knee.' + s, 'root', J['knee.' + s] + V((0, -0.6, 0)), J['knee.' + s] + V((0, -0.7, 0)), False),
            ('pole_elbow.' + s, 'chest', J['elbow.' + s] + V((0.25 * sx, 0.45, -0.25)), J['elbow.' + s] + V((0.25 * sx, 0.55, -0.25)), False),
        ]
        g = grips[s]
        y = g.to_3x3() @ V((0, 1, 0))
        bones.append(('ik_hand.' + s, 'rifle', g.translation, g.translation + y * 0.1, False, g.to_3x3() @ V((0, 0, 1))))
    arm = K.make_armature('soldier', bones)
    pb = arm.pose.bones
    for s in ('L', 'R'):
        for chain, target, pole in (('forearm.' + s, 'ik_hand.' + s, 'pole_elbow.' + s), ('shin.' + s, 'ik_foot.' + s, 'pole_knee.' + s)):
            c = pb[chain].constraints.new('IK')
            c.target = arm
            c.subtarget = target
            c.chain_count = 2
            c.pole_target = arm
            c.pole_subtarget = pole
            c.pole_angle = pole_angle(arm, pb[chain].parent.name, chain, pole)
            c.use_stretch = False
        for bone, target in (('hand.' + s, 'ik_hand.' + s), ('foot.' + s, 'ik_foot.' + s)):
            c = pb[bone].constraints.new('COPY_ROTATION')
            c.target = arm
            c.subtarget = target
    return arm


def pole_angle(arm, base, ik, pole):
    """Polwinkel so, dass die Ruhelage erhalten bleibt (bekannte Formel) / pole angle that keeps the rest pose (known formula)"""
    b = arm.data.bones
    base_b, ik_b, pole_b = b[base], b[ik], b[pole]
    pole_normal = (ik_b.tail_local - base_b.head_local).cross(pole_b.head_local - base_b.head_local)
    proj = pole_normal.cross(base_b.tail_local - base_b.head_local)
    x_axis = base_b.matrix_local.to_3x3() @ V((1, 0, 0))
    n = base_b.tail_local - base_b.head_local
    ang = x_axis.angle(proj)
    if x_axis.cross(proj).angle(n) < 1:
        ang = -ang
    return ang


# ---------- Clips ----------

def qx(deg):
    return Quaternion((1, 0, 0), math.radians(deg))


def qy(deg):
    return Quaternion((0, 1, 0), math.radians(deg))


def qz(deg):
    return Quaternion((0, 0, 1), math.radians(deg))


def set_world(arm, name, m):
    """Posenknochen auf eine Lage im Figurenraum setzen / put a pose bone at a pose in figure space"""
    bpy.context.view_layer.update()
    arm.pose.bones[name].matrix = m
    bpy.context.view_layer.update()


def animate(arm):
    pb = arm.pose.bones
    rest_rifle = rifle_matrix()

    def k(name, f, loc=None, rot=None):
        K.key(pb[name], f, loc=loc, rot_q=rot)

    # --- idle: atmen, Gewicht verlagern, Blick wandert / breathing, weight shift, wandering gaze (3 s Schleife / loop)
    K.new_action(arm, 'idle')
    n = 72
    for f in range(0, n + 1, 6):
        t = f / n * 2 * math.pi
        br = math.sin(2 * t)  # zwei Atemzuege / two breaths
        sw = math.sin(t)
        k('hips', 1 + f, loc=hips_loc(0.012 * sw, 0.0, -0.012 - 0.003 * math.cos(2 * t)), rot=qy(-7 - 1.2 * sw) @ qz(1.5 * sw))
        k('spine', 1 + f, rot=qx(0.8 * br) @ qy(0.8 * sw))
        k('chest', 1 + f, loc=V((0, 0.004 * br + 0.004, 0)), rot=qx(1.6 * br + 1.0) @ qy(0.8 * sw))
        k('neck', 1 + f, rot=qy(3))
        k('head', 1 + f, rot=qy(4 + 7 * math.sin(t + 0.6)) @ qx(-1.5 * br + 1.5 * math.sin(t)))
        k('rifle', 1 + f, loc=V((0, 0.004 * br, 0)), rot=qx(1.2 * br))
        for s, off, yaw in (('L', (0.01, -0.07, 0), 4), ('R', (-0.02, 0.055, 0), -24)):
            loc, rq = foot_target(arm, s, off, 0.0, yaw)
            k('ik_foot.' + s, 1 + f, loc=loc, rot=rq)
    K.stash(arm, 'idle')

    # --- walk: Schritt auf der Stelle, 1 s Schleife / in-place step, 1 s loop
    K.new_action(arm, 'walk')
    n = 24
    stride, lift = 0.24, 0.07
    for f in range(0, n + 1, 2):
        p = f / n
        t = p * 2 * math.pi
        bob = -0.014 - 0.014 * math.cos(2 * t)
        k('hips', 1 + f, loc=hips_loc(0.014 * math.sin(t), 0, bob), rot=qy(5 * math.sin(t)) @ qz(-2.0 * math.sin(t)) @ qx(2))
        k('spine', 1 + f, rot=qy(-4 * math.sin(t)) @ qx(2))
        k('chest', 1 + f, rot=qy(-5 * math.sin(t)) @ qx(2))
        k('head', 1 + f, rot=qy(4 * math.sin(t)) @ qx(-1))
        k('rifle', 1 + f, loc=V((0, 0.012 * math.cos(2 * t), 0)), rot=qx(3 * math.sin(2 * t)))
        for s, ph in (('L', 0.0), ('R', 0.5)):
            q = (p + ph) % 1.0
            if q < 0.5:  # Standphase: Fuss wandert nach hinten / stance: foot travels back
                u = q / 0.5
                y = -stride / 2 + stride * u
                z = 0.0
                pitch = -12 * (1 - u * 4) if u < 0.25 else (22 * (u - 0.7) / 0.3 if u > 0.7 else 0.0)
            else:  # Schwungphase / swing
                u = (q - 0.5) / 0.5
                y = stride / 2 - stride * (0.5 - 0.5 * math.cos(math.pi * u))
                z = lift * math.sin(math.pi * u) ** 1.0
                pitch = 22 * (1 - u * 2.2) if u < 0.45 else -12 * min(1.0, (u - 0.45) / 0.4)
            loc, rq = foot_target(arm, s, (0, y, z), pitch)
            k('ik_foot.' + s, 1 + f, loc=loc, rot=rq)
    K.stash(arm, 'walk')

    # --- aimFire: anlegen, zielen, Schuss mit Rueckstoss, absetzen / shoulder, aim, shot with recoil, lower
    K.new_action(arm, 'aimFire')
    aim_p = V((-0.085, -0.31, 1.375 - DROP))
    aim_a = V((0.0, -1.0, 0.0)).normalized()
    aim_up = V((0.12, 0, 1))

    def pose(f, w, kick=0.0):
        """w = 0 Ruhe .. 1 angelegt / w = 0 rest .. 1 shouldered"""
        e = w * w * (3 - 2 * w)
        k('hips', f, loc=hips_loc(0.0, 0.02 * e + 0.012 * kick, -0.03 * e), rot=qy(-14 * e) @ qx(2 * e))
        k('spine', f, rot=qy(-12 * e) @ qx(5 * e - 2.5 * kick))
        k('chest', f, rot=qy(-14 * e) @ qx(7 * e - 4 * kick))
        k('neck', f, rot=qy(16 * e))
        k('head', f, rot=qy(14 * e) @ qz(6 * e) @ qx(-5 * e + 3 * kick))
        for s, sx in (('L', 1), ('R', -1)):
            loc, rq = foot_target(arm, s, (0.02 * sx * e, (-0.11 if s == 'L' else 0.10) * e, 0), 0.0, (-10 if s == 'L' else -38) * e)
            k('ik_foot.' + s, f, loc=loc, rot=rq)
        pos = rest_rifle.translation.lerp(aim_p, e) + V((0, 0.045 * kick, 0.012 * kick))
        a = RIFLE_A.lerp(aim_a, e).normalized()
        a = (Quaternion((1, 0, 0), math.radians(-5 * kick)) @ a)
        up = RIFLE_UP.lerp(aim_up, e)
        set_world(arm, 'rifle', rifle_bone_matrix(pos, a, up))
        pb['rifle'].keyframe_insert('location', frame=f)
        pb['rifle'].keyframe_insert('rotation_quaternion', frame=f)
        # linke Hand rutscht beim Anlegen etwas zurueck / the left hand slides back a little when shouldering
        k('ik_hand.L', f, loc=V((0, -0.05 * e, 0)))

    seq = [(1, 0.0, 0), (5, 0.35, 0), (10, 0.9, 0), (13, 1.0, 0), (22, 1.0, 0), (23, 1.0, 1.0), (25, 1.0, 0.55), (29, 1.0, 0.08), (33, 1.0, 0.0), (40, 1.0, 0.0), (45, 0.7, 0), (52, 0.12, 0), (57, 0.0, 0)]
    for f, w, kick in seq:
        pose(f, w, kick)
    K.stash(arm, 'aimFire')
    for b in pb:
        b.location = (0, 0, 0)
        b.rotation_quaternion = (1, 0, 0, 0)
    bpy.context.scene.frame_set(1)


# ---------- Zusammenbau / assembly ----------

def build(q=1.0):
    """q: Anteil der Dreiecke fuer die niedrige Detailstufe / q: share of triangles for the low detail level"""
    K.reset()
    reset_joints()
    body = []
    pants = build_pants(q)
    jacket = build_jacket(q)
    body += [pants, jacket]
    body += build_jacket_trim(jacket, q)
    for s, sx in (('L', 1), ('R', -1)):
        body += build_boot(s, sx, q)
        h = hand_local(sx, q)
        K.transform(h, hand_rest_matrix(s, sx))
        K.skin_rigid(h, 'hand.' + s)
        body.append(h)
    body += build_head(q)
    body += build_helmet(q)
    body += build_gear(jacket, q)
    if K.VERBOSE:
        K.report(body)
    # Beine stauchen, alles darueber absenken; Stiefel dabei breiter / squash the legs, lower everything above; widen the boots
    for p in body:
        stem = p.name.split('.')[0]
        if stem in ('pants', 'boot', 'sole'):
            for v in p.data.vertices:
                v.co.z = remap_z(v.co.z)
            if stem != 'pants':
                a = J0['ankle.' + p.name.split('.')[1]]
                piv = Matrix.Translation((a.x, a.y - 0.03, 0))
                K.transform(p, piv @ Matrix.Diagonal((1.2, 1.12, 1.12, 1)) @ piv.inverted())
        else:
            K.move(p, (0, 0, -DROP))
    squash_joints()
    fig = K.join(body, 'soldierBody')
    K.bake_ao(fig, samples=48, dist=0.3, floor=0.0, strength=0.85)
    rifle = build_rifle(q)
    if K.VERBOSE:
        K.report([rifle])
    K.bake_ao(rifle, samples=32, dist=0.12, strength=0.7)
    K.transform(rifle, rifle_matrix())
    mesh = K.join([fig, rifle], 'soldier')
    K.write_slot_uv(mesh)
    arm = build_rig()
    K.bind(mesh, arm)
    animate(arm)
    return arm, mesh
