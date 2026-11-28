"""
Eine Einstellung des Introfilms rendern (Blender als Python-Modul "bpy" oder blender -b -P).
Render one shot of the intro film (Blender as the Python module "bpy" or blender -b -P).

  python render.py --shot oldworld [--out DIR] [--first 1] [--last N] [--every 1] [--stills 2.5,8] [--scale 0.5]
  blender -b -P render.py -- --shot oldworld

--stills rendert nur einzelne Zeitpunkte (Sekunden) als Vorschau; --scale veraendert die Aufloesung der Stufe fuer Tests.
--stills renders single moments (seconds) as a preview; --scale changes the level's resolution for tests.
FV_QUALITY=film waehlt die Filmstufe aus quality.json (24 fps, 1920x1080, Bilder nach .cache/film/frames).
FV_QUALITY=film picks the film level from quality.json (24 fps, 1920x1080, frames to .cache/film/frames).
"""
import argparse
import importlib
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from fv import lib  # noqa: E402


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--shot', required=True)
    ap.add_argument('--out', default=os.path.join(lib.CACHE, 'frames'))
    ap.add_argument('--first', type=int, default=1)
    ap.add_argument('--last', type=int, default=0)
    ap.add_argument('--every', type=int, default=1)
    ap.add_argument('--stills', default='')
    ap.add_argument('--scale', type=float, default=1.0)
    a = ap.parse_args(argv)
    t0 = time.time()
    mod = importlib.import_module('fv.shots.' + a.shot)
    shot = mod.build()
    if a.scale != 1.0:
        shot.sc.render.resolution_percentage = int(round(a.scale * shot.sc.render.resolution_percentage))
    r = shot.sc.render
    print('BUILD %.1fs, %d frames, %s %dx%d %d fps, %d samples' % (time.time() - t0, shot.frames, lib.QUALITY, r.resolution_x * r.resolution_percentage // 100,
                                                                    r.resolution_y * r.resolution_percentage // 100, lib.FPS, shot.sc.eevee.taa_render_samples), flush=True)
    out = os.path.join(a.out, a.shot)
    if a.stills:
        os.makedirs(out, exist_ok=True)
        shot._subframes()
        for s in a.stills.split(','):
            t = float(s)
            f = int(round(t * lib.FPS)) + 1
            shot.sc.frame_set(f)
            shot.update(t)
            shot.sc.render.filepath = os.path.join(out, 'still_%s.png' % s.replace('.', '_'))
            t1 = time.time()
            import bpy
            bpy.ops.render.render(write_still=True)
            print('STILL %s %.1fs' % (s, time.time() - t1), flush=True)
        return
    shot.render(out, a.first, a.last or shot.frames, a.every)
    print('DONE %.1fs' % (time.time() - t0), flush=True)


main()
