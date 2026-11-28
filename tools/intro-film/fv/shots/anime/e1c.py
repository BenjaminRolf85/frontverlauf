"""
Anime-Schnitt E1c (1 s): Gross. Die Augen des Marschalls unter dem Muetzenschirm verengen sich (die zweite
Gesichtszeichnung wird in zwei Stufen eingeblendet), dazu ein kaum merkliches Heranfahren. Gleiche Pose, gleiches Licht
wie E1b; hinter ihm der Abendhimmel.
Anime cut E1c (1 s): close-up. The marshal's eyes narrow below the cap peak (the second face drawing is blended in in
two steps), with a barely noticeable push-in. Same pose, same light as E1b; the evening sky behind him.
"""
import math

from mathutils import Vector

from ... import korvat as K
from ... import lib as L
from ... import poses as P
from . import e1b

DUR = 1.0
# Kamera: Abstand von den Augen, Azimut der Blickrichtung, Hoehe gegen die Augen / camera: distance from the eyes, view azimuth, height against the eyes
CAM = (0.8, 4.0, -0.06)


def build():
    s = L.Shot(DUR)
    # Hauptlicht fuer das Gesicht weiter nach vorn gedreht / key turned further to the front for the face
    sdir = K.lights(s, az=146.0, el=20.0)
    s.cam.data.lens = 85
    s.cam.data.clip_start = 0.05
    s.cam.data.clip_end = 6000
    top = K.hz(*K.M) + 0.6
    fig = e1b.marshal(s, top)
    fig.layer(P.breathe(0.6, phase=0.4))
    fig.face_setup('fig_korvat_head', e1b.FACES)
    fig.face([(0.0, e1b.FACES[1], 0.0), (0.3, e1b.FACES[1], 0.0), (0.5, e1b.FACES[1], 1.0)])
    eyes = fig.world('eyes')
    a = math.radians(CAM[1])
    view = Vector((math.sin(a), math.cos(a), 0))
    cam0 = eyes - view * CAM[0] + Vector((0, 0, CAM[2]))
    K.sky(s, cam0)
    K.land(s, (K.M[0], K.M[1]))
    K.finish_light(s, sdir)

    @s.on
    def update(t):
        fig.update(t)
        p = L.ease_out(L.seg(t, 0, DUR))
        e = fig.world('eyes')
        s.look(cam0 + view * (0.05 * p), e + Vector((0, 0, -0.012)))

    update(0)
    return s
