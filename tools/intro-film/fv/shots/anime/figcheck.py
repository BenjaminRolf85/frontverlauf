"""
Kontrollbild der ganzen Figur (Anime-Schnitt): Brodnik von vorn, schraeg und von der Seite.
Check picture of the full figure (anime cut): Brodnik from the front, at an angle and from the side.
"""

from ... import lib as L


def build():
    s = L.Shot(1)
    s.toon.day()
    s.sunlight(rot=(0.85, 0.0, 0.55))
    L.sky(s, [(-1, 'hazeDay'), (1, 'sky700')])
    L.ground(s, 'paper100', size=400, sub=2)
    sc = 0.4
    for i, rot in enumerate((0, 35, 90, 180)):
        x = (i - 1.5) * 14
        L.model(s, 'leaderFull_korvat', loc=(x, 0, 19.5 * sc), rot=rot, scale=sc)
        L.model(s, 'leaderCape_korvat', loc=(x, 0, 19.5 * sc), rot=rot, scale=sc)
    s.cam.data.lens = 50
    s.look((0, -80, 8), (0, 0, 6))
    return s
