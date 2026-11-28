"""
Posen der Filmfiguren als Tabellen (Anime-Schnitt). Eine Pose nennt je Knochen die Gelenkwinkel in Grad; nicht genannte
Knochen bleiben in der Bindehaltung. Bedeutung der Winkel je Gelenkart: fv/figure.py joint_rot (und FILM-GUIDE.md).
Poses of the film figures as tables (anime cut). A pose lists the joint angles in degrees per bone; bones not named
stay in the bind pose. Meaning of the angles per joint kind: fv/figure.py joint_rot (and FILM-GUIDE.md).

Kurz / in short:
  root   [Nicken, Drehen, Rollen]            spine / chest / neck / head  [vorbeugen, nach links neigen, nach links drehen]
  clav   [heben, vorziehen]                  arm / leg (Kugelgelenk)      [nach vorn, abspreizen, Aussendrehung]
  elbow  [beugen]   knee [beugen]            hand                         [zur Handflaeche, zur Daumenseite, Aussendrehung]
  foot   [Spitze hoch, Spitze aussen, kippen] oder 'flat' / 'flat:12' (Sohle waagerecht, 12 Grad nach aussen)
  fingersL / fingersR: 'relaxed', 'open', 'fist', 'point', 'grip' (figure.HANDS) oder eigene Fingerwinkel
  pos    Versatz der Huefte in Modelleinheiten (x links, y hoch, z vorn); scale {Knochen: (x, y, z)}
  root   [pitch, yaw, roll]                  spine / chest / neck / head  [bend forward, lean left, turn left]
  clav   [raise, pull forward]               arm / leg (ball joint)       [forward, out, outward twist]
  elbow  [bend]     knee [bend]              hand                         [to the palm, to the thumb side, supination]
  foot   [toes up, toes out, roll] or 'flat' / 'flat:12' (sole level, 12 degrees outward)
  fingersL / fingersR: 'relaxed', 'open', 'fist', 'point', 'grip' (figure.HANDS) or own finger angles
  pos    offset of the hips in model units (x left, y up, z front); scale {bone: (x, y, z)}
"""
import math

# ---------- Mensch / human ----------
# Grundstellung: aufrecht, Arme haengen, Gewicht auf beiden Beinen / at ease: upright, arms hanging, weight on both legs
STAND = {
    'spine': [-2, 0, 0], 'chest': [-3, 0, 0], 'neck': [4, 0, 0], 'head': [-2, 0, 0],
    'armL': [-2, 9, -8], 'elbowL': [14], 'handL': [4, 0, 0], 'fingersL': 'relaxed',
    'armR': [-2, 9, -8], 'elbowR': [14], 'handR': [4, 0, 0], 'fingersR': 'relaxed',
    'legL': [1, 4, 8], 'kneeL': [2], 'footL': 'flat', 'legR': [1, 4, 8], 'kneeR': [2], 'footR': 'flat',
}
# Haltung mit verschraenkten Haenden auf dem Ruecken / hands clasped behind the back
AT_EASE = {
    **STAND, 'chest': [-6, 0, 0], 'head': [-3, 0, 0],
    'armL': [-24, 10, -30], 'elbowL': [62], 'handL': [20, 0, 40], 'fingersL': 'grip',
    'armR': [-24, 10, -30], 'elbowR': [58], 'handR': [20, 0, 40], 'fingersR': 'fist',
    'legL': [0, 9, 10], 'legR': [0, 9, 10],
}
# Brodnik, Heldenpose (von vorn gesehen): linker Fuss seitlich auf dem Fels, der linke Arm zeigt zur Seite zum Horizont,
# rechte Faust in der Huefte, Brust heraus, der Kopf folgt dem Arm ins Dreiviertelprofil
# Brodnik, hero pose (seen from the front): left foot out to the side on the rock, the left arm points sideways to the
# horizon, right fist on the hip, chest out, the head follows the arm into a three-quarter profile
KORVAT_POINT = {
    'root': [-2, 0, -2], 'spine': [-4, -2, 5], 'chest': [-8, -1, 9], 'neck': [2, 0, 12], 'head': [-6, 2, 24],
    'clavL': [12, 0], 'armL': [26, 80, 14], 'elbowL': [6], 'handL': [-4, 4, -78], 'fingersL': 'point',
    'clavR': [2, -4], 'armR': [-20, 40, -62], 'elbowR': [112], 'handR': [34, 6, 30], 'fingersR': 'fist',
    'legL': [48, 36, 26], 'kneeL': [74], 'footL': 'flat:4',
    'legR': [-5, 7, 12], 'kneeR': [3], 'footR': 'flat:6',
}
# dieselbe Haltung vor der Geste: der linke Arm haengt, der Blick geht geradeaus / the same stance before the
# gesture: the left arm hangs, the eyes look straight ahead
KORVAT_READY = {
    **KORVAT_POINT, 'spine': [-3, -2, 1], 'chest': [-5, -1, 2], 'neck': [3, 0, 3], 'head': [-2, 0, 6],
    'clavL': [0, 0], 'armL': [4, 14, -6], 'elbowL': [24], 'handL': [6, 0, 0], 'fingersL': 'relaxed',
}
# Gruss: die Rechte flach am Muetzenschirm / salute: the right hand flat at the cap peak
SALUTE = {
    **STAND, 'chest': [-6, 0, 0], 'head': [-3, 0, 0],
    'clavR': [8, 0], 'armR': [30, 74, 24], 'elbowR': [132], 'handR': [-6, -8, -64], 'fingersR': 'open',
    'armL': [-3, 8, -8], 'elbowL': [8], 'fingersL': 'fist',
}
# Vorwaerts: die rechte Faust hoch, der Blick zur Seite / forward: the right fist high, the eyes to the side
KORVAT_COMMAND = {
    **STAND, 'spine': [-3, 0, -6], 'chest': [-6, 0, -8], 'head': [-4, 0, 14],
    'clavR': [14, 0], 'armR': [150, 24, 10], 'elbowR': [24], 'handR': [-10, 0, -30], 'fingersR': 'fist',
    'armL': [-10, 14, -20], 'elbowL': [40], 'fingersL': 'fist',
    'legL': [10, 8, 10], 'kneeL': [8], 'legR': [-8, 8, 12], 'kneeR': [3],
}


def breathe(amount=1.0, rate=0.32, phase=0.0):
    """Atmen: die Brust hebt und weitet sich, die Schultern steigen ein wenig / breathing: the chest rises and widens, the shoulders lift a little"""
    def fn(t):
        k = (0.5 - 0.5 * math.cos((t * rate + phase) * 2 * math.pi)) * amount
        return {'chest': [-1.4 * k, 0, 0], 'clavL': [2.2 * k, 0], 'clavR': [2.2 * k, 0], 'neck': [0.8 * k, 0, 0],
                'scale': {'chest': (1 + 0.018 * k, 1 + 0.006 * k, 1 + 0.03 * k)}}
    return fn


def sway(amount=1.0, rate=0.17, phase=0.0):
    """Wiegen: Gewicht wandert kaum merklich / sway: the weight shifts barely noticeably"""
    def fn(t):
        a = math.sin((t * rate + phase) * 2 * math.pi) * amount
        b = math.sin((t * rate * 1.7 + phase + 0.3) * 2 * math.pi) * amount
        return {'spine': [0.5 * b, 0.6 * a, 0.5 * b], 'chest': [0, -0.4 * a, 0.6 * a], 'head': [0.4 * b, 0, -0.5 * a]}
    return fn


# ---------- Soldat / soldier ----------
# Reitsitz: Schenkel am Pferd, Unterschenkel am Gurt, Faeuste am Zuegel vor dem Sattelknauf
# riding seat: thighs on the horse, lower legs at the girth, fists on the reins in front of the pommel
RIDE = {
    'root': [8, 0, 0], 'spine': [2, 0, 0], 'chest': [-4, 0, 0], 'neck': [2, 0, 0], 'head': [-6, 0, 0],
    'legL': [58, 27, -6], 'kneeL': [76], 'footL': [10, -6, 0], 'legR': [58, 27, -6], 'kneeR': [76], 'footR': [10, -6, 0],
    'armL': [22, 8, -14], 'elbowL': [72], 'handL': [0, 0, -40], 'fingersL': 'fist',
    'armR': [22, 8, -14], 'elbowR': [72], 'handR': [0, 0, -40], 'fingersR': 'fist',
}
# Lanze senkrecht in der Rechten, die Linke am Zuegel / lance upright in the right hand, the left on the reins
RIDE_LANCE = {**RIDE, 'armR': [16, 16, 0], 'elbowR': [84], 'handR': [0, 0, 6], 'fingersR': 'grip'}
# Offizier: Saebel hoch nach vorn / officer: sabre raised to the front
RIDE_SABRE = {**RIDE, 'chest': [-8, 0, -8], 'head': [-8, 0, 6], 'clavR': [12, 0], 'armR': [128, 26, 0], 'elbowR': [28], 'handR': [0, -18, 0], 'fingersR': 'grip'}
# Standartentraeger: die Rechte haelt die Stange, die im Steigbuegel steht / standard bearer: the right hand holds the pole standing in the stirrup
RIDE_BANNER = {**RIDE, 'armR': [34, 22, 0], 'elbowR': [58], 'handR': [0, 0, 6], 'fingersR': 'grip'}
# Posten: steht, die Haende am Koppel / sentry: standing, hands at the belt
GUARD = {**STAND, 'head': [-3, 0, 0], 'armL': [-4, 12, -18], 'elbowL': [48], 'handL': [14, 0, 10], 'fingersL': 'fist',
         'armR': [-4, 12, -18], 'elbowR': [48], 'handR': [14, 0, 10], 'fingersR': 'fist', 'legL': [0, 7, 10], 'legR': [0, 7, 10]}


def march(phase):
    """Marschschritt, phase 0..1: Beine schwingen gegengleich, Arme dagegen / marching step, phase 0..1: legs swing in opposition, arms against them"""
    a = math.sin(phase * 2 * math.pi)
    c = math.cos(phase * 2 * math.pi)
    kl = max(0.0, c) * 46 + 4    # linkes Knie beugt, waehrend das Bein nach vorn schwingt / the left knee bends while the leg swings forward
    kr = max(0.0, -c) * 46 + 4
    return {
        'root': [3, 0, 2 * a], 'spine': [1, 0, -5 * a], 'chest': [-3, 0, -6 * a], 'head': [-2, 0, 4 * a],
        'legL': [26 * a, 3, 6], 'kneeL': [kl], 'footL': [8 * a, 4, 0], 'legR': [-26 * a, 3, 6], 'kneeR': [kr], 'footR': [-8 * a, 4, 0],
        'armL': [-20 * a, 8, -10], 'elbowL': [22 + 10 * max(0.0, -a)], 'fingersL': 'fist',
        'armR': [20 * a, 8, -10], 'elbowR': [22 + 10 * max(0.0, a)], 'fingersR': 'fist',
        'pos': (0, -0.03 * abs(a), 0),
    }


# ---------- Pferd / horse ----------
HORSE_STAND = {'neck1': [-4, 0, 0], 'head': [6, 0, 0], 'tail': [6, 0, 0]}
HOOVES = ('hoofFL', 'hoofFR', 'hoofHL', 'hoofHR')
# Gangarten: Standanteil, Takt der Beine (HL, HR, VL, VR), Ausschlaege / gaits: stance share, leg beats (HL, HR, FL, FR), amplitudes
GAITS = {
    'walk': {'stance': 0.62, 'beat': (0.0, 0.5, 0.25, 0.75), 'f': (17, 17, 42, 24), 'h': (17, 16, 20, 34, 18), 'pitch': 1.0, 'bob': 0.02, 'neck': (2, 3), 'tail': 8, 'spine': 1.5, 'air': 0.0},
    'trot': {'stance': 0.42, 'beat': (0.0, 0.5, 0.5, 0.0), 'f': (25, 24, 70, 34), 'h': (24, 22, 30, 52, 26), 'pitch': 1.5, 'bob': 0.05, 'neck': (4, 2), 'tail': 20, 'spine': 2.0, 'air': 0.03},
    'gallop': {'stance': 0.3, 'beat': (0.0, 0.12, 0.4, 0.54), 'f': (40, 30, 98, 44), 'h': (42, 30, 44, 76, 34), 'pitch': 5.0, 'bob': 0.07, 'neck': (16, 7), 'tail': 46, 'spine': 5.0, 'air': 0.1},
}


def horse_gait(phase, kind='gallop'):
    """
    Gangart des Pferds als Pose je Phase 0..1. Rueckgabe: (Pose, Hufe am Boden). Jedes Bein laeuft denselben Zyklus mit
    eigenem Takt: im Stand schiebt es von vorn nach hinten, im Schwung faltet es sich und greift vor.
    The horse's gait as a pose per phase 0..1. Returns (pose, hooves on the ground). Every leg runs the same cycle with
    its own beat: in stance it pushes from front to back, in swing it folds and reaches forward.
    """
    g = GAITS[kind]
    st = g['stance']
    pose = {}
    down = []

    def cyc(beat):
        u = (phase - beat) % 1.0
        if u < st:
            return u / st, 0.0, True       # Stand: 0..1 von vorn nach hinten / stance: 0..1 from front to back
        v = (u - st) / (1 - st)
        return 1.0 - (0.5 - 0.5 * math.cos(v * math.pi)), math.sin(v * math.pi), False

    ff, fb, fk, fp = g['f']
    hf, hb_, h1, h2, hp = g['h']
    for side, beat_h, beat_f in (('L', g['beat'][0], g['beat'][2]), ('R', g['beat'][1], g['beat'][3])):
        k, fold, on = cyc(beat_f)
        pose['fa' + side] = [-ff + (ff + fb) * k - 14 * fold, 0, 0]
        pose['fb' + side] = [fk * fold, 0, 0]
        pose['fc' + side] = [fp * fold - (10 if on else 0) * math.sin(k * math.pi), 0, 0]
        if on:
            down.append('hoofF' + side)
        k, fold, on = cyc(beat_h)
        pose['ha' + side] = [-hf + (hf + hb_) * k - 8 * fold, 0, 0]
        pose['hb' + side] = [h1 * fold + (6 if on else 0) * math.sin(k * math.pi), 0, 0]
        pose['hc' + side] = [-h2 * fold - (8 if on else 0) * math.sin(k * math.pi), 0, 0]
        pose['hd' + side] = [hp * fold, 0, 0]
        if on:
            down.append('hoofH' + side)
    w = phase * 2 * math.pi
    pose['body'] = [g['pitch'] * math.sin(w + 0.9), 0, 0]
    pose['chest'] = [g['spine'] * 0.5 * math.sin(w + 2.4), 0, 0]
    pose['hind'] = [-g['spine'] * math.sin(w + 0.3), 0, 0]
    pose['neck1'] = [g['neck'][0] + g['neck'][1] * math.sin(w + 2.2), 0, 0]
    pose['neck2'] = [g['neck'][0] * 0.4, 0, 0]
    pose['head'] = [-g['neck'][0] * 0.9 + 4 + 3 * math.sin(w + 3.0), 0, 0]
    pose['tail'] = [g['tail'] + 5 * math.sin(w * 2), 0, 0]
    pose['pos'] = (0, g['bob'] * math.sin(w * (2 if kind != 'gallop' else 1) + 1.2) + (0.0 if down else g['air']), 0)
    return pose, down


def rider_on(horse_pose, base, kind='gallop', phase=0.0):
    """Reiterpose passend zur Gangart: beugt sich vor, federt in den Hueften / rider pose matching the gait: leans forward, gives in the hips"""
    lean = {'walk': 0, 'trot': 4, 'gallop': 12}[kind]
    w = phase * 2 * math.pi
    out = dict(base)
    r = list(base.get('root', [0, 0, 0]))
    out['root'] = [r[0] + lean + 2.5 * math.sin(w + 0.6), r[1], r[2]]
    sp = list(base.get('spine', [0, 0, 0]))
    out['spine'] = [sp[0] + lean * 0.35 - 2 * math.sin(w + 0.6), sp[1], sp[2]]
    hd = list(base.get('head', [0, 0, 0]))
    out['head'] = [hd[0] - lean * 0.9, hd[1], hd[2]]
    return out
