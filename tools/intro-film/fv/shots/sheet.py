"""
Modellbogen zur Kontrolle von Ausrichtung, Groesse und Aussehen. Ohne Angabe eine Auswahl an Bauwerken und Einheiten;
FV_SHEET=name1,name2 zeigt genau diese Modelle nebeneinander aus der Brettsicht des Spiels (zum Vergleich mit den
Bildern der Vorschau des Spiels), FV_SHEET_GAP den Abstand, FV_SHEET_ZOOM die Naehe.
Model sheet to check orientation, size and look. Without arguments a selection of buildings and units;
FV_SHEET=name1,name2 shows exactly these models side by side from the game's board view (to compare with the pictures
of the game's preview), FV_SHEET_GAP the spacing, FV_SHEET_ZOOM the closeness.
"""
import math
import os

from .. import lib as L

NAMES = ['divineSpark_alvenia', 'academy_air', 'emplacement_dravon', 'silo_meridon', 'portal_2', 'mothership',
         'temple', 'datacenter_nexus', 'privateer_meridon', 'steppeRider_korvat', 'leader_korvat', 'bell_tower',
         'crash_site_0', 'teslaTank_velkar', 'android_nexus', 'zealot_vesper']


def build():
    s = L.Shot(1)
    s.toon.day()
    pick = [n for n in os.environ.get('FV_SHEET', '').split(',') if n]
    if pick:
        # Brettsicht: von vorne rechts oben, dunkler Grund wie die Vorschau des Spiels / board view: from front right above, dark ground like the game's preview
        gap = float(os.environ.get('FV_SHEET_GAP', '10'))
        zoom = float(os.environ.get('FV_SHEET_ZOOM', '1'))
        s.sunlight(rot=(0.85, 0.0, 0.55))
        L.sky(s, [(-1, 'ink900'), (1, 'ink900')])
        L.ground(s, 'ink900', size=400, sub=2)
        n = len(pick)
        for i, name in enumerate(pick):
            L.model(s, name, loc=((i - (n - 1) / 2) * gap, 0, 0), rot=float(os.environ.get('FV_SHEET_ROT', '0')), scale=1.6)
        r = (gap * n * 0.95 + 9) / zoom
        s.cam.data.lens = 50
        s.look((r * 0.75, -r * 0.95, r * 0.8), (0, 0, 3.6))
        return s
    s.sunlight(rot=(0.9, 0.2, 0.5))
    L.sky(s, [(-1, 'hazeDay'), (1, 'sky700')])
    s.look((0, -95, 55), (0, 10, 0))
    s.cam.data.lens = 30
    L.ground(s, 'paper100', size=400, sub=2)
    for i, n in enumerate(NAMES):
        x = (i % 4 - 1.5) * 26
        y = (i // 4) * 24
        L.model(s, n, loc=(x, y, 0), scale=1.6)
    return s
