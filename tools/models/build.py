"""
Baut die modellierten Einheiten (Vorschlag C) in Blender und schreibt sie als .glb nach public/proto/c/.
Builds the modelled units (proposal C) in Blender and writes them as .glb to public/proto/c/.

Aufruf / usage (Blender als Python-Modul bpy 5.2, ohne GPU mit EGL_PLATFORM=surfaceless):
  EGL_PLATFORM=surfaceless <venv>/bin/python tools/models/build.py [soldier] [tank] [--blend] [--no-pack]

  --blend    speichert zusaetzlich die .blend-Quelle nach tools/models/.cache/ (z. B. fuer den Introfilm)
             also saves the .blend source to tools/models/.cache/ (e.g. for the intro film)
  --no-pack  laesst die Meshopt-Kompression aus (sonst: npx @gltf-transform/cli resample + meshopt, siehe PACK)
             skips the meshopt compression (otherwise: npx @gltf-transform/cli resample + meshopt, see PACK)

Je Einheit entstehen zwei Detailstufen (<name>.glb, <name>.low.glb) und ein Eintrag in manifest.json mit Dreiecken,
Bytes, Clips und Knochen. Die Ausgabe ist wiederholbar (siehe pin): keine Zufallszahlen, feste Strahlrichtungen beim Verdeckungslicht.
Per unit two detail levels are written (<name>.glb, <name>.low.glb) plus an entry in manifest.json with triangles,
bytes, clips and bones. The output is repeatable (see pin): no random numbers, fixed ray directions for the occlusion.
"""
import json
import os
import platform
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from fvm import kit as K  # noqa: E402

OUT = os.path.join(ROOT, 'public', 'proto', 'c')
CACHE = os.path.join(HERE, '.cache')
# Kompression nach dem Export: Meshopt (Quantisierung + EXT_meshopt_compression); der Decoder liegt Three.js bei
# compression after the export: meshopt (quantisation + EXT_meshopt_compression); the decoder ships with Three.js
PACK = ['npx', '--yes', '@gltf-transform/cli@4.5.1']
# Detailstufen: Name-Anhang und Anteil der Dreiecke / detail levels: name suffix and share of triangles
LEVELS = (('', 1.0), ('.low', 0.42))


def summary(path):
    with open(path, 'rb') as fh:
        data = fh.read()
    n = int.from_bytes(data[12:16], 'little')
    j = json.loads(data[20:20 + n])
    tris = 0
    verts = 0
    for m in j.get('meshes', []):
        for p in m['primitives']:
            tris += j['accessors'][p['indices']]['count'] // 3
            verts += j['accessors'][p['attributes']['POSITION']]['count']
    clips = {a['name']: round(max(j['accessors'][s['input']]['max'][0] for s in a['samplers']), 3) for a in j.get('animations', [])}
    bones = [j['nodes'][i]['name'] for sk in j.get('skins', []) for i in sk['joints']]
    targets = [t for m in j.get('meshes', []) for t in (m.get('extras', {}).get('targetNames') or [])]
    return {'bytes': len(data), 'triangles': tris, 'vertices': verts, 'clips': clips, 'bones': bones, 'morphTargets': targets}


def pack(src, dst):
    env = dict(os.environ)
    extra = os.environ.get('FV_GLTF_TRANSFORM')  # optional: Pfad zu einer installierten CLI / optional: path to an installed CLI
    tool = [extra] if extra else PACK
    # 1. doppelte Schluesselbilder entfernen, 2. quantisieren + Meshopt / 1. drop duplicate keyframes, 2. quantise + meshopt
    tmp = dst + '.tmp.glb'
    subprocess.run(tool + ['resample', src, tmp], check=True, env=env, stdout=subprocess.DEVNULL)
    subprocess.run(tool + ['meshopt', tmp, dst, '--level', 'medium'], check=True, env=env, stdout=subprocess.DEVNULL)
    os.remove(tmp)


def build_unit(name, save_blend, do_pack):
    mod = __import__('fvm.' + name, fromlist=['build'])
    entry = {}
    for suffix, q in LEVELS:
        t0 = time.time()
        arm, mesh = mod.build(q)
        raw = os.path.join(CACHE, name + suffix + '.raw.glb')
        K.export_glb(raw, [arm, mesh])
        dst = os.path.join(OUT, name + suffix + '.glb')
        if do_pack:
            pack(raw, dst)
        else:
            with open(raw, 'rb') as a, open(dst, 'wb') as b:
                b.write(a.read())
        info = summary(dst)
        info['rawBytes'] = os.path.getsize(raw)
        info['file'] = name + suffix + '.glb'
        secs = time.time() - t0
        info.update(getattr(mod, 'META', {}))
        entry['low' if suffix else 'high'] = info
        print('%s%s: %d tris, %d bytes (raw %d), %.1fs' % (name, suffix, info['triangles'], info['bytes'], info['rawBytes'], secs))
        if save_blend and not suffix:
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(CACHE, name + '.blend'))
    return entry


def pin():
    """
    Wiederholbarkeit: Voxel-Remesh, Reduktion und Boolesch liefern je nach Thread-Reihenfolge und Speicheradressen leicht
    andere Vertexfolgen. Mit einem Kern, ohne Adress-Zufall und festem Hash-Startwert ist die Ausgabe Byte fuer Byte gleich.
    Repeatability: voxel remesh, decimation and booleans yield slightly different vertex orders depending on thread order
    and memory addresses. With one core, no address randomisation and a fixed hash seed the output is byte-identical.
    """
    if os.environ.get('FV_PINNED') == '1' or not (shutil.which('taskset') and shutil.which('setarch')):
        return
    env = dict(os.environ, FV_PINNED='1', PYTHONHASHSEED='0')
    os.execvpe('taskset', ['taskset', '-c', '0', 'setarch', platform.machine(), '-R', sys.executable] + sys.argv, env)


def main():
    pin()
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    units = args or ['soldier', 'tank']
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    mpath = os.path.join(OUT, 'manifest.json')
    manifest = {}
    if os.path.exists(mpath):
        with open(mpath) as fh:
            manifest = json.load(fh)
    manifest['paletteSize'] = K.PALETTE_SIZE
    manifest['slots'] = K.SLOTS
    manifest.setdefault('units', {})
    for u in units:
        manifest['units'][u] = build_unit(u, '--blend' in flags, '--no-pack' not in flags)
    with open(mpath, 'w') as fh:
        json.dump(manifest, fh, indent=1, sort_keys=True)
        fh.write('\n')


if __name__ == '__main__':
    main()
