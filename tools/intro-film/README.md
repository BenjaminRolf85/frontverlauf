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
| `soundtrack.mjs` | rechnet die Geraeusche des Films (`src/intro/filmScore.ts`, Bus 'sfx') per OfflineAudioContext als WAV / renders the film's sound effects (bus 'sfx') as WAV |
| `music.json`, `music.py` | Musik aus den Stuecken des Spiels (`public/music`) je Abschnitt mit Ueberblendung, Lautheit angeglichen, Geraeusche darueber gemischt / music from the game's tracks per section with crossfades, loudness matched, effects mixed on top |
| `assemble.py` | setzt Clips, Comicseite, Ton, WebM/MP4 und Standbild zusammen (nur ffmpeg) / assembles clips, comic page, audio, WebM/MP4 and poster (ffmpeg only) |

Die Zeitleiste (`src/intro/film.json`) teilen sich Blender und Spiel; Einstellungslaengen nur dort aendern.
Blender and the game share the timeline (`src/intro/film.json`); change shot lengths only there.

## Einrichten / setup

```bash
# Blender als Python-Modul (getestet: bpy 5.2 unter Python 3.13) / Blender as a Python module (tested: bpy 5.2 on Python 3.13)
python3.13 -m venv /tmp/bpyenv && /tmp/bpyenv/bin/pip install bpy fonttools brotli
# alternativ eine Blender-Installation: blender -b -P render.py -- --shot oldworld / alternatively a Blender install
# ffmpeg mit libvpx-vp9, libopus, libx264 / ffmpeg with libvpx-vp9, libopus, libx264
npm install   # Vite, three, Playwright (global oder lokal / global or local)
```

Ohne GPU rendert Eevee ueber Mesa (llvmpipe); dafuer `EGL_PLATFORM=surfaceless` setzen.
Without a GPU Eevee renders via Mesa (llvmpipe); set `EGL_PLATFORM=surfaceless` for that.

## Ablauf / steps

```bash
node tools/intro-film/export-models.mjs                 # Modelle + Tokens / models + tokens
PY=/tmp/bpyenv/bin/python tools/intro-film/render-all.sh # alle Einstellungen / all shots (.cache/frames)
node tools/intro-film/soundtrack.mjs                    # .cache/sfx.wav (Geraeusche / effects)
python3 tools/intro-film/music.py                       # .cache/soundtrack.wav (Musik + Geraeusche / music + effects)
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
14,2 s (fruehere Eroeffnung, Stadt Verdan, 192 Bilder); alle 1728 Bilder mit zwei Prozessen in 91 Minuten. Die neue
Eroeffnung `oldworld` (Hafen Meridons, 192 Bilder) braucht im Mittel 9,7 s je Bild, mit zwei Prozessen rund 16 Minuten. Die Nahaufnahmen der
Anfuehrer-Buesten (bis 36.000 Dreiecke, Heldenatlas 2048) kosten rund 6 s je Bild. Zusammensetzen und Kodieren (zwei
Durchgaenge VP9 und H.264) rund 12 Minuten.
Chosen: Eevee with one sample, all materials unlit (emission) with their own banded shading from Shader-to-RGB, shadow
resolution 0.25 and sun shadow maps 0.2 (halves the time), 12 frames per second, held to 24 fps in the video.
1488 frames plus 3 x 120 comic panels (416x664) in total. Measured with the inked units (silhouette and inner lines as
geometry, atlases at 2048): on average 6.1 s per frame and process, from 3.4 s (bell) to 14.2 s (earlier opening, Verdan city, 192
frames); all 1728 frames with two processes in 91 minutes. The new opening `oldworld` (Meridon's harbour, 192 frames)
takes 9.7 s per frame on average, about 16 minutes with two processes. The close-ups of the leader busts (up to 36,000 triangles,
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

## Filmqualitaet / film quality

Zwei Stufen in `quality.json`, umgeschaltet mit `FV_QUALITY` (render.py, render-all.sh, assemble.py `--quality`) und
`export-models.mjs --quality film`. Ohne Angabe gilt `preview`: genau der bisherige schnelle Weg (12 fps, 1280x720,
4 Bildproben, Schatten 0,5 / 0,05, Cache `.cache/`). Die Filmstufe hat eigenen Cache (`.cache/film/`: Modelle, Einheiten,
Atlanten, Bilder, Clips); fehlt dort eine Datei, nimmt lib.py die aus `.cache/`.
Two levels in `quality.json`, switched with `FV_QUALITY` (render.py, render-all.sh, assemble.py `--quality`) and
`export-models.mjs --quality film`. Without it `preview` applies: exactly the previous fast path (12 fps, 1280x720,
4 samples, shadows 0.5 / 0.05, cache `.cache/`). The film level has its own cache (`.cache/film/`: models, units,
atlases, frames, clips); a file missing there is taken from `.cache/`.

```bash
node tools/intro-film/export-models.mjs --quality film            # .cache/film (Segmente x2, Heldenatlanten 4096)
FV_QUALITY=film PY=/tmp/bpyenv/bin/python tools/intro-film/render-all.sh korvat banners oldworld
python3 tools/intro-film/assemble.py --quality film               # 24 fps, 1920x1080 (Kodierung noch wie bisher)
```

| Stufe / level | fps | Bild / picture | Proben / samples | Schatten / shadows | Modelle / models |
|---|---|---|---|---|---|
| `preview` | 12 (auf 24 gehalten / held to 24) | 1280x720 | 4 | 0,5 / 0,05 | Spiel `high`, Atlanten 2048 |
| `film` | 24 | 1920x1080 | 8 | 1,0 / 0,01 | Filmexport: Segmente und Ringe x2, Heldenatlanten 4096 |
| `filmLite` | 24 | 1920x1080 | 4 | 0,5 / 0,01 | wie `film` / as `film` |

- Bewegung / motion: 24 echte Bilder je Sekunde; `FV_EASE` (in den Filmstufen an) laesst die Fahrten der
  Anfuehrer-Nahaufnahmen nach dem Schnitt weich auslaufen und die Frachter der Eroeffnung abbremsen statt hart zu
  stehen; die uebrigen Kamerafahrten liefen schon mit `ease_io`. Bewegungsunschaerfe (`FV_MBLUR=1`, die Szene folgt den
  Zwischenzeiten ueber `frame_change_pre`) funktioniert (+15 %), verwischt aber die Tuschelinien und ist aus. / 24 real
  frames per second; `FV_EASE` (on in the film levels) lets the leader close-up moves ease out after the cut and the
  opening's freighters slow down instead of stopping hard; the other camera moves already used `ease_io`. Motion blur
  (`FV_MBLUR=1`, the scene follows the sub-frame times via `frame_change_pre`) works (+15 %) but smears the ink lines
  and is off.
- Bild / picture: `FV_SCALE` vergroessert nur die Ausgabe (die Szenen bleiben in Bildpunkten einer 1280 breiten
  Leinwand gebaut, Linien behalten ihr Verhaeltnis; die weiche Tuschekante folgt dem ausgegebenen Bildpunkt). / `FV_SCALE`
  only enlarges the output (the shots stay built in pixels of a 1280 wide canvas, lines keep their proportion; the soft
  ink edge follows the output pixel).
- Modelle / models: `setFilmSegments` (src/render/models/kit.ts) wird nur vom Filmexport gesetzt; das Spiel baut `high`
  und `low` unveraendert (Tests, Fingerabdruck aller Modelle gleich). / `setFilmSegments` is set by the film export
  only; the game builds `high` and `low` unchanged (tests, fingerprint of all models equal).

Gemessen (Testlauf korvat, banners, oldworld; 4 Kerne, zwei Prozesse) / measured (test run, 4 cores, two processes):

| | s je Bild und Prozess / s per frame and process | ganzer Film (Hochrechnung) / whole film (projection) |
|---|---|---|
| `preview` | korvat 6,4, banners 6,3, oldworld 9,7 (12 fps) | ~1,4 h |
| `film` | korvat 28,3, banners 15,5, oldworld 32,3 (24 fps; 696 Bilder in 2 h 49 min) | ~10,8 h |
| `filmLite` | aus Standbildern / from stills: etwa 1,7 / 1,4 / 1,3 x `preview` je Bild | ~4,3 h |

Hebel einzeln (ein Prozess, s je Bild korvat / banners / oldworld) / levers alone: bisher 4,1 / 3,7 / 6,0; 1080p mit
4 Proben 5,3 / 4,7 / 7,4; 8 Proben 9,8 / 8,5 / 13,7; 16 Proben 19,3 / 16,2 / 26,6; feine Schatten (Aufloesung 1,0)
etwa +40-80 % in Szenen mit Sonne; Filmmodelle bis +15 %. Knie der Kantenglaettung bei 8 Proben (gegen 16: 46-50 dB).
Zwischenbilder 1080p etwa 1,8 MB je PNG, ganzer Film etwa 6 GB. Kodierung bei 1080p24 ohne Verschmieren (H.264 CRF 18 /
VP9 CRF 30): 4,5-9 Mbit/s je nach Bewegung, ganzer Film etwa 73-115 MB je Format; die Zielbitraten in assemble.py
bleiben bis zur Entscheidung wie bisher.
Single levers (one process): 1080p costs only +20-30 %, samples scale almost linearly, fine shadows (scale 1.0) cost
+40-80 % in sunlit shots, film models up to +15 %. Anti-aliasing knee at 8 samples. Frames at 1080p about 1.8 MB per
PNG, about 6 GB for the film. Encoding at 1080p24 without smear: 4.5-9 Mbit/s depending on motion, about 73-115 MB per
format for the whole film; assemble.py keeps its target bitrates until that is decided.

## Musik / music

Die Musik stammt aus den Stuecken des Spiels (`public/music`, vom Auftraggeber geliefert). `music.json` legt je Abschnitt
Stueck, Startpunkt und Pegel fest: Trompetenruf fuer die Vorgeschichte (0-32 s), "tense-1" fuer brennenden Himmel,
Absturz und Glocke (32-52 s), Zyrr-Thema fuer das Erwachen (52-62 s), "battle-city-attacked" fuer Tor und Bruch
(62-76 s), dann je Fraktionsszene ihr eigenes Thema (Korvat, Alvenia, Dravon, Velkar, Meridon, je 7 s) und der
Triumphmarsch fuer Anfuehrer und Titel (111-124 s). Uebergaenge blenden 1,2 s, die Musik wird auf -19 LUFS gebracht,
die Geraeusche liegen darueber, die Mischung endet bei -16 LUFS mit 2 s Ausblendung. Andere Stuecke oder Schnitte: nur
`music.json` aendern und `music.py` sowie `assemble.py --encode-only` neu laufen lassen (kein neues Rendern noetig).

The music comes from the game's tracks (`public/music`, supplied by the owner). `music.json` sets track, start point
and level per section: trumpet call for the backstory (0-32 s), "tense-1" for the burning sky, crash and bell
(32-52 s), the Zyrr theme for the awakening (52-62 s), "battle-city-attacked" for gate and fracture (62-76 s), then
each faction scene its own theme (Korvat, Alvenia, Dravon, Velkar, Meridon, 7 s each) and the triumphal march for the
leaders and the title (111-124 s). Transitions crossfade over 1.2 s, the music is brought to -19 LUFS, the effects sit
on top, the mix ends at -16 LUFS with a 2 s fade. Other tracks or cuts: change only `music.json` and re-run `music.py`
and `assemble.py --encode-only` (no re-render needed).

## Anime-Schnitt (Test) / anime cut (test)

Stilbeweis fuer einen neuen Schnitt, der die Geschichte wie ein Anime-Film erzaehlt (Drehbuch und Storyboard liegen
beim Auftraggeber). Der bisherige Film, seine Einstellungen und `public/intro/` bleiben unberuehrt; neu sind nur
eigene Dateien und die Stufen `anime` / `animeRough` in `quality.json` mit eigenem Cache `.cache/anime/` (fehlende
Dateien aus `.cache/film/`, dann `.cache/`).
Style proof for a new cut that tells the story like an anime film (script and storyboard are with the owner). The
current film, its shots and `public/intro/` stay untouched; new are only own files and the levels `anime` /
`animeRough` in `quality.json` with their own cache `.cache/anime/` (missing files from `.cache/film/`, then `.cache/`).

| Datei / file | Aufgabe / purpose |
|---|---|
| `web/figureKit.ts`, `web/figureHuman.ts` | nur Filmexport: Figurenbaukasten. Skelett, Gewichte je Ecke (Knochen, Gewicht gegen den Elternknochen, Tuchwert), Glieder mit Anatomie; der Mensch mit Armen, Haenden mit Fingern, Beinen, Stiefeln, Rumpf / export only: figure kit. Skeleton, weights per vertex, limbs with anatomy; the human with arms, hands with fingers, legs, boots, trunk |
| `web/figureKorvat.ts`, `web/figureArmy.ts`, `web/figures.ts` | Brodnik als Filmfigur (Kopf, Brust und Orden aus der unveraenderten Heldenbueste; Koerper, Umhang, Gesichtszeichnungen neu), das Heer (Soldat in vier Ausruestungen, Pferd, Banner mit Zahnrad), Verzeichnis fuer den Export / Brodnik as a film figure (head, chest and medals from the unchanged hero bust; body, cape, face drawings new), the army (soldier in four kits, horse, banner with the cog), directory for the export |
| `fv/anime.py` | gemalter Himmel als Rundhorizont (Verlauf, Sonne, Lichtfinger, Wolkenbaenke mit drei Toenen und Saum, ferne Huegel; numpy, deterministisch), gemaltes Gelaende, Luftperspektive fuer alle Materialien, Randlicht auf den gezeichneten Figuren, Rauchfahnen / painted sky as a cyclorama, painted terrain, aerial perspective for all materials, rim light on the inked figures, smoke plumes |
| `fv/figure.py`, `fv/poses.py`, `fv/army.py` | bewegliche Figuren: Posen als Tabellen von Gelenkwinkeln, Bewegung zwischen Schluesselposen, Atmen, Wind im Tuch, Blinzeln und Mienenwechsel; Heere aus gebackenen Phasen (Galopp, Marsch) / movable figures: poses as tables of joint angles, motion between key poses, breathing, wind in cloth, blinks and changes of expression; armies from baked phases (gallop, march) |
| `fv/korvat.py`, `fv/shots/anime/e1a.py`, `e1b.py`, `e1c.py` | die Welt der Korvat in wahrem Massstab und ihre drei Einstellungen (Heimat mit Heer, Heldenpose, Nahaufnahme) / the Korvat world at true scale and its three shots (homeland with army, hero pose, close-up) |
| `fv/shots/anime/figsheet.py` | Kontrollboegen der Figuren (`FV_SHEET=turn`, `poses`, `one`, `half`, `hands`, `face`, `army`, `motion`) / check sheets of the figures |
| `FILM-GUIDE.md` | Leitfaden fuer weitere Anfuehrer und Szenen: Figur und Pose anlegen, Proportion und Texeldichte, Licht und Schichten, Pruefliste, Zeiten / guide for further leaders and scenes |
| `fv/shots/anime/boards.py` | grobe Storyboard-Blockouts (`FV_BOARD=a02`, `b03`, `c01`, `d05`, `e2`, `e3`, `e5`, `f02`, `f03`) / rough storyboard blockouts |

```bash
cp tools/intro-film/.cache/film/inked.json tools/intro-film/.cache/anime/   # einmal vor dem ersten Export / once before the first export
node tools/intro-film/export-models.mjs --quality film --out tools/intro-film/.cache/anime/models --only fig_korvat_body,fig_korvat_head,fig_korvat_cape,figatlas_korvat_head_narrow,figatlas_korvat_head_blink,fig_korvat_rider,fig_korvat_lancer,fig_korvat_officer,fig_korvat_foot,fig_korvat_guard,fig_korvat_horse,fig_korvat_banner
FV_SHEET=turn FV_QUALITY=anime EGL_PLATFORM=surfaceless $PY tools/intro-film/render.py --shot anime.figsheet --stills 0
FV_QUALITY=anime EGL_PLATFORM=surfaceless $PY tools/intro-film/render.py --shot anime.e1b --stills 2.6 --scale 0.5
FV_RESUME=1 FV_QUALITY=anime EGL_PLATFORM=surfaceless $PY tools/intro-film/render.py --shot anime.e1b   # 96 Bilder / frames; e1a 72, e1c 24
FV_QUALITY=animeRough FV_BOARD=e2 EGL_PLATFORM=surfaceless $PY tools/intro-film/render.py --shot anime.boards --stills 1
```
