"""
Introfilm zusammensetzen (ohne Blender, nur ffmpeg): Einzelbilder je Einstellung (12 fps, render.py) -> Zwischenclips,
Comicseite aus drei Feldern fuer "awaken", Verkettung, Klangspur (soundtrack.mjs), Ausgabe als WebM (VP9 + Opus) und
MP4 (H.264 + AAC) sowie Standbild (WebP) nach public/intro.
Assemble the intro film (no Blender, only ffmpeg): frames per shot (12 fps, render.py) -> intermediate clips, a comic
page of three panels for "awaken", concatenation, soundtrack (soundtrack.mjs), output as WebM (VP9 + Opus) and
MP4 (H.264 + AAC) plus a poster (WebP) to public/intro.

  python3 assemble.py [--quality preview|film] [--frames .cache/frames] [--out ../../public/intro] [--vb-webm 640k] [--vb-mp4 690k] [--encode-only]

--quality (oder FV_QUALITY) waehlt die Stufe aus quality.json: Bildrate der Einzelbilder, Bildgroesse (auch der
Comicseite) und Cache; Standard 'preview' wie bisher. Die Kodierung (Zielbitraten) bleibt dieselbe, bis sie fuer die
Filmstufe entschieden ist. / --quality (or FV_QUALITY) picks the level from quality.json: frame rate of the frames,
picture size (also of the comic page) and cache; default 'preview' as before. Encoding (target bitrates) stays the same
until it is decided for the film level.
"""
import argparse
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))


def run(args):
    print(' '.join(args[:6]), '...', flush=True)
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error'] + args, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quality', default=os.environ.get('FV_QUALITY', 'preview'))
    ap.add_argument('--frames', default=None)
    ap.add_argument('--work', default=None)
    ap.add_argument('--audio', default=os.path.join(HERE, '.cache', 'soundtrack.wav'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'intro'))
    # Zielbitraten (zwei Durchgaenge): beide Fassungen zusammen unter 25 MB / target bitrates (two passes): both versions together below 25 MB
    ap.add_argument('--vb-webm', default='640k')
    ap.add_argument('--vb-mp4', default='690k')
    ap.add_argument('--encode-only', action='store_true')
    a = ap.parse_args()
    film = json.load(open(os.path.join(ROOT, 'src', 'intro', 'film.json')))
    prof = json.load(open(os.path.join(HERE, 'quality.json')))[a.quality]
    cache = os.path.join(HERE, prof['cache'])
    a.frames = a.frames or os.path.join(cache, 'frames')
    a.work = a.work or os.path.join(cache, 'clips')
    tok = json.load(open(os.path.join(HERE, '.cache', 'tokens.json')))
    ink = tok['intro']['ink'].lstrip('#')
    paper = tok['intro']['paper'].lstrip('#')
    # Bildrate der Einzelbilder (Vorschau: aus film.json, 12, im Video auf 24 gehalten; Film: 24) und Massstab der
    # 1280x720-Leinwand / frame rate of the frames (preview: from film.json, 12, held to 24 in the video; film: 24) and
    # scale of the 1280x720 canvas
    rfps, fps = prof.get('renderFps') or film['renderFps'], film['fps']
    k = float(prof['scale'])
    W, H = int(round(1280 * k)), int(round(720 * k))

    def px(v):
        return int(round(v * k))
    os.makedirs(a.work, exist_ok=True)
    os.makedirs(a.out, exist_ok=True)
    clips = []
    for s in ([] if a.encode_only else film['shots']):
        dur = s['end'] - s['start']
        clip = os.path.join(a.work, s['id'] + '.mp4')
        clips.append(clip)
        common = ['-t', str(dur), '-r', str(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '8', '-pix_fmt', 'yuv420p', clip]
        if s['id'] == 'awaken':
            # Comicseite: Papier, drei Hochformatfelder mit Tuscherahmen, die nacheinander hereinrutschen
            # comic page: paper, three portrait panels with ink frames that slide in one after another
            ins, filt = [], ['color=c=0x%s:s=%dx%d:r=%d:d=%s[bg]' % (paper, W, H, fps, dur)]
            last = 'bg'
            for i, name in enumerate(('awaken_nexus', 'awaken_vesper', 'awaken_zyrr')):
                ins += ['-framerate', str(rfps), '-i', os.path.join(a.frames, name, '%04d.png')]
                at = film['panels'][i]
                x = px(8 + i * 424)
                filt.append('[%d]fps=%d,pad=%d:%d:%d:%d:color=0x%s[p%d]' % (i, fps, px(424), px(672), px(4), px(4), ink, i))
                xe = "'if(lt(t-%.2f,0.3),%d+(1-(t-%.2f)/0.3)*(%d-%d),%d)'" % (at, x - px(4), at, px(1300), x, x - px(4))
                filt.append('[%s][p%d]overlay=x=%s:y=%d:enable=\'gte(t,%.2f)\'[o%d]' % (last, i, xe, px(24), at, i))
                last = 'o%d' % i
            run(ins + ['-filter_complex', ';'.join(filt), '-map', '[%s]' % last] + common)
        else:
            run(['-framerate', str(rfps), '-i', os.path.join(a.frames, s['id'], '%04d.png'), '-vf', 'fps=%d' % fps] + common)
    lst = os.path.join(a.work, 'list.txt')
    joined = os.path.join(a.work, 'joined.mp4')
    D = film['duration']
    if not a.encode_only:
        with open(lst, 'w') as fh:
            fh.write(''.join("file '%s'\n" % c for c in clips))
        run(['-f', 'concat', '-safe', '0', '-i', lst, '-vf', 'fade=in:st=0:d=0.6,fade=out:st=%.2f:d=1.0' % (D - 1.0), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '8', '-pix_fmt', 'yuv420p', joined])
    base = os.path.join(a.out, 'frontverlauf-intro')
    log = os.path.join(a.work, 'pass')
    vp9 = ['-c:v', 'libvpx-vp9', '-b:v', a.vb_webm, '-row-mt', '1', '-cpu-used', '2', '-tile-columns', '2', '-g', '240', '-pix_fmt', 'yuv420p']
    run(['-i', joined, '-t', str(D)] + vp9 + ['-pass', '1', '-passlogfile', log + 'vp9', '-an', '-f', 'null', os.devnull])
    run(['-i', joined, '-i', a.audio, '-map', '0:v', '-map', '1:a', '-t', str(D)] + vp9 + ['-pass', '2', '-passlogfile', log + 'vp9',
         '-c:a', 'libopus', '-b:a', '96k', base + '.webm'])
    h264 = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', a.vb_mp4, '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-g', '240']
    run(['-i', joined, '-t', str(D)] + h264 + ['-pass', '1', '-passlogfile', log + 'x264', '-an', '-f', 'null', os.devnull])
    run(['-i', joined, '-i', a.audio, '-map', '0:v', '-map', '1:a', '-t', str(D)] + h264 + ['-pass', '2', '-passlogfile', log + 'x264',
         '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart', base + '.mp4'])
    # Standbild aus dem Titel / poster from the title
    run(['-ss', '%.2f' % (D - 3.0), '-i', joined, '-frames:v', '1', '-vf', 'scale=%d:%d' % (W, H), '-c:v', 'libwebp', '-quality', '78', base + '-poster.webp'])
    for ext in ('.webm', '.mp4', '-poster.webp'):
        print('%s%s: %.2f MB' % (base, ext, os.path.getsize(base + ext) / 1e6))


main()
