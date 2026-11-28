"""
A03 (10-13 s): "Eigentum bedeutete Macht." Untersicht vom Platz: oben auf dem Balkon der Bank Gestalten in Abendrobe
vor erleuchteten Fenstern, unten im Schatten des Sockels Arbeiter mit Kisten und ein Karren. Kamera: Halbtotale von
unten, langsamer Schwenk nach oben, der am Ende beide Welten in einem Bild haelt.
A03 (10-13 s): "Property meant power." Low angle from the square: above, on the bank's balcony, figures in evening
dress before lit windows; below, in the shadow of the podium, workers with crates and a cart. Camera: medium wide from
below, a slow tilt up that ends holding both worlds in one frame.

Ohne Nahfiguren gebaut: alle Menschen sind Silhouetten (Karten). Fuer ein Gesicht am Balkon braucht es spaeter eine
Figur aus dem Figuren-Baukasten. / built without close characters: all people are silhouettes (cards). A face on the
balcony needs a figure from the character kit later.
"""
import math
import os

import numpy as np

from ... import anime as A
from ... import arch as AR
from ... import atmo as AT
from ... import lib as L
from ... import meridon as M
from ... import scenery as S
from ... import world as W
from . import a02 as A02

DUR = 3.0
PITCH = (1.5, 12.5)


def build():
    s = L.Shot(DUR)
    c = A.cmix
    R = np.random.default_rng(31)
    s.cam.data.lens = 28
    s.cam.data.clip_start, s.cam.data.clip_end = 0.5, 16000.0
    sc = M.BANK_SCALE
    A02.dusk_light(s)
    cam = (102.5, 67.5, M.height(102.5, 67.5) + 1.25)
    s.look(cam, (90, 96, 14))
    city = M.Meridon(s, cam, lit=0.55, glass=c('sunDusk', 'sky700', 0.45), far=False, ships=False, people=False, rows=[0, 1, 2, 3, 4], mirror=False, ink=1.6, avenue=False)
    b = city.bank
    bal = (M.BANK[0] + b['balcony'][0], M.BANK[1] + b['balcony'][1], M.BANK[2] + b['balcony'][2])
    az = math.degrees(math.atan2(bal[0] - cam[0], bal[1] - cam[1])) + 2.0
    A02.dusk_sky(s, (cam[0], cam[1], 0.0), name='sky_a03')
    # Gestalten auf dem Balkon vor dem Licht / figures on the balcony before the light
    kinds_up = ['gent', 'lady', 'gent', 'lady', 'hat', 'lady']
    up = AT.people_atlas('a03_up', kinds_up, c('ink800', 'sky800', 0.35), rim=c('window300', 'paper50', 0.4), seed=3, cell=(240, 432), back=True, rim_px=1.8,
                         flip=[False, True, True, False, False, True])
    # dicht an der Balustrade (von unten sonst verdeckt) / close to the balustrade (hidden from below otherwise)
    fy_ = -1.5 * sc
    # (aus der Untersicht verdeckt das Gelaender sonst alles bis zum Scheitel: die Gestalten stehen erhoeht und etwas groesser)
    # (from the low angle the rail would hide everything up to the crown: the figures stand raised and a little larger)
    places = [(bal[0] + dx * sc, bal[1] + fy_ + dy, bal[2] + 0.42, k, 1.18) for dx, dy, k in ((-4.6, 0.1, 0), (-3.5, 0.25, 1), (-0.9, 0.0, 2), (0.3, 0.2, 3), (3.0, 0.15, 5), (4.2, 0.0, 4))]
    AT.people(s, 'a03_up', up, places, cam=cam)
    # Lichthof hinter den Gestalten: Ursprung des Objekts weit hinten, damit er vor den Figuren gezeichnet wird
    # (durchscheinende Objekte werden nach dem Abstand ihres Ursprungs sortiert)
    # halo behind the figures: the object's origin far back so it is drawn before the figures (translucent objects are
    # sorted by the distance of their origin)
    glow = W.MeshB()
    glow.card((bal[0], bal[1] + 1.2 - 400.0, bal[2] + 3.4), 26, 13, (cam[0], cam[1] - 400.0, cam[2]), c('window300', 'sunDusk', 0.3), mat=0, alpha=0.4)
    glow.build(s, 'balcony_glow', [city.halo], weld=False, shadow=False).location = (0.0, 400.0, 0.0)
    # Arbeiter im Schatten des Sockels / workers in the shadow of the podium
    kinds_dn = ['carry', 'push', 'carry', 'stand', 'old', 'carry']
    dn = AT.people_atlas('a03_down', kinds_dn, c('ink800', 'sky900', 0.5), rim=c('sunDusk', 'skyMid', 0.5), light=(-1.0, 0.3), seed=8, cell=(240, 432),
                         flip=[False, False, True, False, True, False], rim_px=1.5)
    gz = M.height(96.0, 86.0)
    wk = [(87.5, 91.0, 0), (90.6, 89.6, 2), (94.4, 91.2, 1), (96.6, 88.4, 5), (101.5, 90.5, 3), (84.5, 89.0, 4), (99.0, 92.2, 0)]
    AT.people(s, 'a03_down', dn, [(x, y, M.height(x, y), k) for x, y, k in wk], cam=cam)
    cart = W.MeshB()
    pal = city.pal
    cart.push(92.6, 91.4, gz, rot=8)
    wood = c('timber', 'ink700', 0.35)
    cart.box(-1.6, -0.9, 0.75, 1.6, 0.9, 0.9, wood, bottom=True)
    for sx in (-1.6, 1.6):
        cart.box(sx - 0.06, -0.9, 0.9, sx + 0.06, 0.9, 1.5, wood)
    for sy in (-1, 1):
        ring = [(0.62 * math.cos(t), sy * 1.0, 0.62 + 0.62 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 14, endpoint=False)]
        cart.face(ring if sy < 0 else ring[::-1], wood)
    cart.ink = 0.5
    cart.tube((1.6, -0.5, 0.8), (3.4, -0.5, 1.0), 0.05, wood, n=4)
    cart.tube((1.6, 0.5, 0.8), (3.4, 0.5, 1.0), 0.05, wood, n=4)
    cart.ink = 1.0
    cart.pop()
    AR.crates(cart, R, 92.6, 91.4, gz + 0.9, 5, pal, spread=1.1, plain=True, size=(0.6, 0.9))
    AR.crates(cart, R, 86.5, 92.6, gz, 9, pal, spread=2.2, plain=True, size=(0.7, 1.2))
    AR.crates(cart, R, 100.5, 92.8, gz, 7, pal, spread=2.0, plain=True, size=(0.7, 1.1))
    cart.build(s, 'cart', city.mats, ink=1.6, cam=cam)
    W.haze(s, c('hazeDusk', 'yellow400', 0.12), start=60.0, dist=500.0, amount=0.85, hfloor=0.6, hscale=110.0)

    def update(t):
        u = L.clamp(t / DUR)
        p = 0.3 * u + 0.7 * L.ease_io(u)
        e = math.radians(L.lerp(PITCH[0], PITCH[1], p))
        a = math.radians(az)
        s.look(cam, (cam[0] + math.sin(a) * math.cos(e) * 50, cam[1] + math.cos(a) * math.cos(e) * 50, cam[2] + math.sin(e) * 50))
        W.clock(t)
        city.update(t)
    s.on(update)
    return s
