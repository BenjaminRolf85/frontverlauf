# Introfilm in Blender / intro film in Blender

Der Introfilm "Die Vorgeschichte" (Drehbuch: `docs/intro-film.md`) wird vollstaendig aus Code gebaut: Spielmodelle
exportieren, Einstellungen in Blender aufbauen und rendern, Klangspur rechnen, mit ffmpeg zusammensetzen.
Ergebnis: `public/intro/frontverlauf-intro.webm`, `.mp4` und `-poster.webp`.

The intro film "The backstory" (script: `docs/intro-film.md`) is built entirely from code: export the game models,
build and render the shots in Blender, render the soundtrack, assemble with ffmpeg.
Result: `public/intro/frontverlauf-intro.webm`, `.mp4` and `-poster.webp`.

## Bausteine / parts

| Datei / file | Aufgabe / purpose |
|---|---|
| `export-models.mjs`, `web/` | Vite + Playwright: baut die prozeduralen Modelle aus `src/render/models`. Gelaende, Bauwerke, Requisiten als Rohdaten (Positionen, Normalen, Vertexfarben, Leuchtmaske) nach `.cache/models/`; alles, was dem Vertrag der gezeichneten Einheiten folgt (uv, fx, Farbe, Normalen, `userData.inked`, `userData.inkSrc`), nach `.cache/units/`: die Einheiten und die gezeichneten Anfuehrer-Buesten; ihre Atlanten als PNG nach `.cache/atlas/` (Brett 2048 statt 1024, Heldenatlanten der Anfuehrer in ihrer eigenen Groesse aus `atlasSize`, 2048), Kenngroessen des Stils nach `.cache/inked.json`, die Design-Tokens nach `.cache/tokens.json` / builds the procedural models: terrain, buildings, props as raw data; everything that follows the inked units' contract to `.cache/units/`: the units and the inked leader busts; their atlases as PNG (board atlases at 2048 instead of 1024, the leaders' hero atlases at their own size from `atlasSize`, 2048), the figures of the style and the design tokens |
| `fv/lib.py` | Szene, Comic-Material (3 flache Lichtbaender, Leuchten, Fensterlicht), Tuschekontur (umgedrehte Huelle), Modell-Import, gezeichnete Einheiten (Atlas-Material, Umriss und Innenlinien), Himmel, Rauch, Strahlen / scene, comic material (3 flat light bands, glow, window light), ink outline, model import, inked units (atlas material, silhouette and inner lines), sky, smoke, beams |
| `fv/kit.py` | Gelaende, Explosionen, Truemmer, Flaggen, Meer, Wolken, Lichtboegen / terrain, explosions, debris, flags, sea, clouds, arcs |
| `fv/shots/*.py` | eine Datei je Einstellung (`build()` gibt eine `Shot` mit Aktualisierung je Bild zurueck); `sheet.py` ist ein Modellbogen zur Kontrolle / one file per shot; `sheet.py` is a model sheet for checks |
| `render.py` | rendert eine Einstellung als PNG-Folge oder einzelne Standbilder / renders one shot as a PNG sequence or single stills |
| `render-all.sh` | rendert alle Einstellungen in Abschnitten auf zwei Prozesse verteilt und setzt nach Abbruch fort / renders all shots in sections across two processes and resumes after an abort |
| `soundtrack.mjs` | rechnet die Klangspur (`src/intro/filmScore.ts`) per OfflineAudioContext als WAV / renders the soundtrack as WAV |
| `assemble.py` | setzt Clips, Comicseite, Ton, WebM/MP4 und Standbild zusammen (nur ffmpeg) / assembles clips, comic page, audio, WebM/MP4 and poster (ffmpeg only) |

Die Zeitleiste (`src/intro/film.json`) teilen sich Blender und Spiel; Einstellungslaengen nur dort aendern.
Blender and the game share the timeline (`src/intro/film.json`); change shot lengths only there.

## Einrichten / setup

```bash
# Blender als Python-Modul (getestet: bpy 5.2 unter Python 3.13) / Blender as a Python module (tested: bpy 5.2 on Python 3.13)
python3.13 -m venv /tmp/bpyenv && /tmp/bpyenv/bin/pip install bpy fonttools brotli
# alternativ eine Blender-Installation: blender -b -P render.py -- --shot verdan / alternatively a Blender install
# ffmpeg mit libvpx-vp9, libopus, libx264 / ffmpeg with libvpx-vp9, libopus, libx264
npm install   # Vite, three, Playwright (global oder lokal / global or local)
```

Ohne GPU rendert Eevee ueber Mesa (llvmpipe); dafuer `EGL_PLATFORM=surfaceless` setzen.
Without a GPU Eevee renders via Mesa (llvmpipe); set `EGL_PLATFORM=surfaceless` for that.

## Ablauf / steps

```bash
node tools/intro-film/export-models.mjs                 # Modelle + Tokens / models + tokens
PY=/tmp/bpyenv/bin/python tools/intro-film/render-all.sh # alle Einstellungen / all shots (.cache/frames)
node tools/intro-film/soundtrack.mjs                    # .cache/soundtrack.wav
python3 tools/intro-film/assemble.py                    # public/intro/*
```

Vorschau einzelner Momente / preview single moments:

```bash
EGL_PLATFORM=surfaceless /tmp/bpyenv/bin/python tools/intro-film/render.py --shot crash --stills 0.7,1.4,5 --scale 0.5
```

## Renderer und Zeiten / renderer and timings

Gemessen auf 4 CPU-Kernen ohne GPU (Mesa llvmpipe), 1280x720 / measured on 4 CPU cores without a GPU:

| Variante / variant | s je Bild / s per frame |
|---|---|
| Eevee, Standard-Samples / default samples | ca. 48 |
| Cycles CPU, 16 Samples | ca. 9,5 |
| Workbench | ca. 1 (kein Toon-Shading moeglich / no toon shading possible) |
| **Eevee, 1 TAA-Sample, Toon ueber Shader-to-RGB, grobe Schatten (verwendet / used)** | **ca. 3-14, Mittel / mean 6,1** |
| dasselbe mit feinen Schatten / same with fine shadows | ca. 10 |

Gewaehlt: Eevee mit einem Sample, alle Materialien unbeleuchtet (Emission) mit eigener Stufen-Schattierung aus
Shader-to-RGB, Schattenaufloesung 0,25 und Sonnen-Schattenkarten 0,2 (halbiert die Zeit), 12 Bilder je Sekunde, im Video
auf 24 fps gehalten. Gesamt 1488 Bilder plus 3 x 120 Comicfelder (416x664). Gemessen mit den gezeichneten Einheiten
(Umriss und Innenlinien als Geometrie, Atlanten 2048): im Mittel 6,1 s je Bild und Prozess, von 3,4 s (Glocke) bis
14,2 s (Stadt Verdan, 192 Bilder); alle 1728 Bilder mit zwei Prozessen in 91 Minuten. Die Nahaufnahmen der
Anfuehrer-Buesten (bis 36.000 Dreiecke, Heldenatlas 2048) kosten rund 6 s je Bild. Zusammensetzen und Kodieren (zwei
Durchgaenge VP9 und H.264) rund 12 Minuten.
Chosen: Eevee with one sample, all materials unlit (emission) with their own banded shading from Shader-to-RGB, shadow
resolution 0.25 and sun shadow maps 0.2 (halves the time), 12 frames per second, held to 24 fps in the video.
1488 frames plus 3 x 120 comic panels (416x664) in total. Measured with the inked units (silhouette and inner lines as
geometry, atlases at 2048): on average 6.1 s per frame and process, from 3.4 s (bell) to 14.2 s (Verdan city, 192
frames); all 1728 frames with two processes in 91 minutes. The close-ups of the leader busts (up to 36,000 triangles,
hero atlas 2048) cost about 6 s per frame. Assembly and encoding (two passes VP9 and H.264) about 12 minutes.

Kodierung / encoding: WebM VP9 640 kbit/s + Opus 96 kbit/s (11,9 MB), MP4 H.264 High 690 kbit/s + AAC 112 kbit/s
(12,6 MB), Standbild / poster 57 kB; zusammen / together 24,5 MB (Grenze / limit 25 MB). Feste Zielbitrate in
zwei Durchgaengen: die flachen Toene ohne Rasterpunkte brauchen weniger Bits, die feste Rate gibt sie den Einheiten als
Schaerfe zurueck statt kleinerer Dateien. / Fixed target bitrate in two passes: the flat tones without halftone dots
need fewer bits, the fixed rate gives them back to the units as sharpness instead of smaller files.
Einheiten und Anfuehrer-Buesten immer in der hohen Detailstufe (export-models.ts setzt setUnitQuality('high')).
Units and leader busts always at the high detail level (export-models.ts sets setUnitQuality('high')).

Groessen / sizes: Zwischenbilder (`.cache/`, nicht im Repository) etwa 1 GB / intermediate frames about 1 GB.

Lizenz / licence: eigene Schoepfung des Projekts, CC0; Modelle und Farben aus dem Spiel, Klang prozedural.
Own creation of the project, CC0; models and colours from the game, procedural sound.
