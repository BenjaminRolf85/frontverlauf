"""
Akt I und II des Anime-Schnitts aus den fertigen Welt-Einstellungen schneiden (nur ffmpeg und Pillow): je Akt ein MP4
(1080p, 24 fps, ohne Ton), ein Kontaktbogen mit einem Bild je Sekunde, Standbilder je Einstellung. Wo eine Einstellung
noch auf Figuren wartet, steht ein schwarzes Bild mit ihrer Kennung.
Cut acts I and II of the anime cut from the finished world shots (ffmpeg and Pillow only): one MP4 per act (1080p,
24 fps, no sound), a contact sheet with one frame per second, stills per shot. Where a shot still waits for
characters, a black frame with its id stands in.

  python3 tools/intro-film/acts.py --frames tools/intro-film/.cache/world/frames --out DIR
"""
import argparse
import os
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

FPS = 24
W, H = 1920, 1080
# (Kennung, Sekunden, Ordner der Bilder oder None, Standbild-Sekunde, Hinweis) / (id, seconds, frame folder or None, still second, note)
ACTS = {
    'act1': [
        ('A01', 4.0, 'anime.a01', 2.0, 'Kartentisch / map table'),
        ('A02', 6.0, 'anime.a02', 5.6, ''),
        ('A03', 3.0, 'anime.a03', 2.6, ''),
        ('A04a', 2.0, None, 0.0, 'Nahaufnahme: Augen des Bankiers (Figuren) / close-up: the banker\'s eyes (characters)'),
        ('A04b', 4.0, 'anime.a04', 0.3, ''),
    ],
    'act2': [
        ('B01', 4.0, 'anime.b01', 3.6, ''),
        ('B02', 2.0, 'anime.b02', 1.3, ''),
        ('B03', 6.0, 'anime.b03', 3.0, ''),
        ('B04', 4.0, 'anime.b04', 1.2, 'ohne Kind (Figuren) / without the child (characters)'),
    ],
}
STILLS = {'A02': 'a02.png', 'A03': 'a03.png', 'A04b': 'a04-blackout.png', 'B01': 'b01.png', 'B02': 'b02.png', 'B03': 'b03.png', 'B04': 'b04.png', 'A01': 'a01.png'}


def font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def placeholder(path, ident, note):
    im = Image.new('RGB', (W, H), (0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((W // 2, H // 2 - 30), ident, fill=(200, 200, 200), font=font(120), anchor='mm')
    if note:
        d.text((W // 2, H // 2 + 80), note, fill=(120, 120, 120), font=font(36), anchor='mm')
    im.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    sheet = []
    for act, shots in ACTS.items():
        tmp = tempfile.mkdtemp(prefix='fvact_')
        n = 0
        for ident, secs, folder, still_t, note in shots:
            want = int(round(secs * FPS))
            src = os.path.join(a.frames, folder) if folder else None
            have = src and all(os.path.exists(os.path.join(src, '%04d.png' % (i + 1))) for i in range(want))
            ph = os.path.join(tmp, 'ph_%s.png' % ident)
            if not have:
                placeholder(ph, ident, note or 'noch nicht gerendert / not rendered yet')
            for i in range(want):
                f = os.path.join(src, '%04d.png' % (i + 1)) if have else ph
                os.symlink(os.path.abspath(f), os.path.join(tmp, '%05d.png' % n))
                if (n % FPS) == FPS // 2:
                    sheet.append((f, '%s %s %ds' % (act, ident, n // FPS)))
                n += 1
            if have and ident in STILLS:
                shutil.copyfile(os.path.join(src, '%04d.png' % (int(round(still_t * FPS)) + 1)), os.path.join(a.out, STILLS[ident]))
        out = os.path.join(a.out, act + '.mp4')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, '%05d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '15',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], check=True)
        shutil.rmtree(tmp)
        print(act, n, 'frames ->', out)
    # Kontaktbogen: ein Bild je Sekunde / contact sheet: one frame per second
    cols, tw, th = 7, 384, 216
    rows = (len(sheet) + cols - 1) // cols
    im = Image.new('RGB', (cols * tw, rows * (th + 22)), (21, 19, 31))
    d = ImageDraw.Draw(im)
    for k, (f, label) in enumerate(sheet):
        x, y = (k % cols) * tw, (k // cols) * (th + 22)
        im.paste(Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS), (x, y))
        d.text((x + 6, y + th + 3), label, fill=(239, 230, 198), font=font(14))
    im.save(os.path.join(a.out, 'sheet.jpg'), quality=90)
    print('sheet', len(sheet))


main()
