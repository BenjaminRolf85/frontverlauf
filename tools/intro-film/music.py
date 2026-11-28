"""
Tonspur des Introfilms mischen: Musik aus den Stuecken des Spiels (public/music) nach music.json auf die Zeitleiste
schneiden, mit Ueberblendungen, auf einen Lautheitspegel bringen und die Geraeusche (soundtrack.mjs, Bus 'sfx')
darueberlegen. Ergebnis: .cache/soundtrack.wav, das assemble.py als Tonspur nimmt. Nur ffmpeg.
Mix the intro film's soundtrack: cut music from the game's tracks (public/music) onto the timeline as listed in
music.json, with crossfades, bring it to one loudness level and lay the sound effects (soundtrack.mjs, bus 'sfx') on
top. Result: .cache/soundtrack.wav, which assemble.py takes as the audio track. ffmpeg only.

python3 tools/intro-film/music.py [--sfx .cache/sfx.wav] [--out .cache/soundtrack.wav] [--music-only]
"""
import argparse
import json
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))


def run(args):
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error'] + args, check=True)


def lufs(path, start, length):
    """Integrierte Lautheit eines Ausschnitts / integrated loudness of an excerpt"""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-ss', '%.3f' % start, '-t', '%.3f' % length, '-i', path,
                        '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    m = re.findall(r'I:\s+(-?[0-9.]+) LUFS', r.stderr)
    return float(m[-1]) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sfx', default=os.path.join(HERE, '.cache', 'sfx.wav'))
    ap.add_argument('--out', default=os.path.join(HERE, '.cache', 'soundtrack.wav'))
    ap.add_argument('--music-only', action='store_true')
    a = ap.parse_args()
    cfg = json.load(open(os.path.join(HERE, 'music.json')))
    D = json.load(open(os.path.join(ROOT, 'src', 'intro', 'film.json')))['duration']
    fade = cfg['fade']
    ins, parts = [], []
    for i, c in enumerate(cfg['cues']):
        # jedes Stueck beginnt eine halbe Ueberblendung frueher und endet eine halbe spaeter
        # each piece starts half a crossfade earlier and ends half a crossfade later
        start = max(0.0, c['at'] - fade / 2)
        end = min(D, c['end'] + fade / 2)
        length = end - start
        src = c['from'] - (c['at'] - start)
        lead = max(0.0, -src)
        path = os.path.join(ROOT, 'public', 'music', c['track'] + '.mp3')
        ins += ['-i', path]
        # jedes Stueck einzeln auf denselben Pegel, damit kein Sprung am Uebergang entsteht
        # each piece on its own to the same level, so there is no jump at the transition
        level = lufs(path, max(0.0, src), length - lead)
        norm = (cfg['musicLufs'] - level) if level is not None else 0.0
        # beginnt das Stueck spaeter (Startpunkt naeher am Anfang als eine halbe Ueberblendung), wird die Einblendung
        # entsprechend kuerzer, damit sie trotzdem mit dem Ausblenden des Vorgaengers endet
        # if the piece starts later (start point closer to its beginning than half a crossfade), the fade-in gets
        # shorter accordingly so that it still ends together with the previous piece's fade-out
        fi = 0 if c['at'] == 0 else max(0.5, fade - lead)
        fo = 0 if c['end'] >= D else fade
        chain = ['aresample=48000', 'aformat=channel_layouts=stereo',
                 'atrim=start=%.3f:duration=%.3f' % (max(0.0, src), length - lead), 'asetpts=PTS-STARTPTS',
                 'volume=%.2fdB' % (norm + c.get('gain', 0))]
        if fi:
            chain.append('afade=t=in:st=0:d=%.3f:curve=hsin' % fi)
        if fo:
            chain.append('afade=t=out:st=%.3f:d=%.3f:curve=hsin' % (length - lead - fo, fo))
        delay = int(round((start + lead) * 1000))
        chain.append('adelay=%d|%d' % (delay, delay))
        parts.append('[%d:a]%s[m%d]' % (i, ','.join(chain), i))
    n = len(cfg['cues'])
    mix = ''.join('[m%d]' % i for i in range(n))
    # Schluss: die letzten 2 s ausblenden wie das Bild / end: fade out the last 2 s like the picture
    # kein dynamisches Angleichen mehr: die Stuecke haben schon denselben Pegel, so bleibt die Musik ohne Pumpen
    # no dynamic levelling any more: the pieces already share one level, so the music does not pump
    parts.append('%samix=inputs=%d:normalize=0:dropout_transition=0,atrim=duration=%s,'
                 'afade=t=out:st=%s:d=2[music]' % (mix, n, D, D - 2))
    out_label = 'music'
    if not a.music_only:
        ins += ['-i', a.sfx]
        parts.append('[%d:a]aresample=48000,aformat=channel_layouts=stereo,volume=%sdB[fx]' % (n, cfg['sfxGainDb']))
        # Laenge vor loudnorm festlegen und danach auffuellen: loudnorm verschluckt sonst das Ende
        # fix the length before loudnorm and pad afterwards: otherwise loudnorm swallows the end
        parts.append('[music][fx]amix=inputs=2:normalize=0:duration=longest,atrim=duration=%s,apad[mix]' % D)
        out_label = 'mix'
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    raw = a.out + '.raw.wav'
    run(ins + ['-filter_complex', ';'.join(parts), '-map', '[%s]' % out_label, '-t', str(D), '-ar', '48000', '-c:a', 'pcm_f32le', raw])
    # Gesamtpegel in einem Schritt: feste Verstaerkung auf masterLufs, Spitzen begrenzt
    # overall level in one step: fixed gain to masterLufs, peaks limited
    level = lufs(raw, 0, D)
    gain = (cfg['masterLufs'] - level) if level is not None else 0.0
    run(['-i', raw, '-af', 'volume=%.2fdB,alimiter=limit=0.84:level=false:attack=5:release=80' % gain,
         '-ar', '48000', '-c:a', 'pcm_s16le', a.out])
    os.remove(raw)
    print(a.out)


main()
