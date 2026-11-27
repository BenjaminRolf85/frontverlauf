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
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))


def run(args):
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error'] + args, check=True)


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
        ins += ['-i', os.path.join(ROOT, 'public', 'music', c['track'] + '.mp3')]
        fi = 0 if c['at'] == 0 else fade
        fo = 0 if c['end'] >= D else fade
        chain = ['aresample=48000', 'aformat=channel_layouts=stereo',
                 'atrim=start=%.3f:duration=%.3f' % (max(0.0, src), length - lead), 'asetpts=PTS-STARTPTS',
                 'volume=%.2fdB' % c.get('gain', 0)]
        if fi:
            chain.append('afade=t=in:st=0:d=%.3f:curve=qsin' % fi)
        if fo:
            chain.append('afade=t=out:st=%.3f:d=%.3f:curve=qsin' % (length - lead - fo, fo))
        delay = int(round((start + lead) * 1000))
        chain.append('adelay=%d|%d' % (delay, delay))
        parts.append('[%d:a]%s[m%d]' % (i, ','.join(chain), i))
    n = len(cfg['cues'])
    mix = ''.join('[m%d]' % i for i in range(n))
    # Schluss: die letzten 2 s ausblenden wie das Bild / end: fade out the last 2 s like the picture
    parts.append('%samix=inputs=%d:normalize=0:dropout_transition=0,atrim=duration=%s,'
                 'loudnorm=I=%s:TP=-2:LRA=11,afade=t=out:st=%s:d=2[music]' % (mix, n, D, cfg['musicLufs'], D - 2))
    out_label = 'music'
    if not a.music_only:
        ins += ['-i', a.sfx]
        parts.append('[%d:a]aresample=48000,aformat=channel_layouts=stereo,volume=%sdB[fx]' % (n, cfg['sfxGainDb']))
        # Laenge vor loudnorm festlegen und danach auffuellen: loudnorm verschluckt sonst das Ende
        # fix the length before loudnorm and pad afterwards: otherwise loudnorm swallows the end
        parts.append('[music][fx]amix=inputs=2:normalize=0:duration=longest,atrim=duration=%s,'
                     'loudnorm=I=%s:TP=-1.5:LRA=11,apad[mix]' % (D, cfg['masterLufs']))
        out_label = 'mix'
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    run(ins + ['-filter_complex', ';'.join(parts), '-map', '[%s]' % out_label, '-t', str(D), '-ar', '48000', '-c:a', 'pcm_s16le', a.out])
    print(a.out)


main()
