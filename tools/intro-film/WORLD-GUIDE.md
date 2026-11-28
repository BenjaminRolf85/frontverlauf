# Welt-Baukasten des Anime-Schnitts / world kit of the anime cut

Nur Film (Blender-Seite, `tools/intro-film/fv/`); das Spiel bleibt unberuehrt. Mit diesem Baukasten sind die Orte der
Akte I und II gebaut (Meridon, Stillstand, Verteilungskriege); die Heimaten der Fraktionen und die Sternfall-Wueste
sollen mit denselben Werkzeugen entstehen. English below: [English](#english).

## Bausteine

| Datei | Inhalt |
|---|---|
| `fv/world.py` | Netzbauer `MeshB` (Quader, Daecher, Drehkoerper, Staebe, Karten; Eckenfarbe, Fassaden-UV, Lichtdaten), Tusche als Huelle mit Staerke nach Entfernung (`add_ink`, je Ecke; `mb.ink` fuer duenne Teile), Materialien `arch_mat` (Fassade mit schaltbaren Fenstern), `sprite_mat` (Karten, Lichthoefe), `flat_mat`; Uhr (`clock`), Dunst (`haze`) |
| `fv/scenery.py` | gemalte Fassadenfelder (`FACADES`: res, grand, office, ware, shop, slit, glass, plain), `facade_mats`, Spiegelbilder (`mirror`), `Water`, Kielwasser, Malgrund `Canvas` und `ground` fuer Boeden |
| `fv/atmo.py` | Himmel (`sky`: Verlauf, Sonne, Kumulus, Wolkenbaender, Sterne, Landschichten), `haze_bank`, `shafts`, Rauch (`Trail` gemalt, `Smoke` als Ballen), `puff_atlas`, `Cards`, `Burst`, `Particles` (Asche, Glut, Regen/Schnee, Atem), `Birds`, `Flag`, Menschen als Silhouetten (`people_atlas`, `people`) |
| `fv/arch.py` | Architektur: `block`, `tower`, `warehouse`, `bank`, `lighthouse`, Kran, `bridge`, `quay`, `lamp`, `freighter`, `sailship`, `boat`, `jetty`, `tram`, `crates`; `Palette` |
| `fv/props.py` | Kriegslandschaft und Requisiten: `war_height` (Krater, Graeben), `ruin_wall`, `rubble`, `dead_tree`, `wire_fence`, `tanker`, `barrier`, `chain`, `bronze_gate`, `dead_lamp`, `Fire` |
| `fv/meridon.py` | der Ort Meridon als Klasse (Hafen, Bank, Terrassenstadt, ferne Viertel, NEXUS) mit Abschaltzeit je Viertel |
| `fv/shots/anime/a02.py … b04.py` | die Einstellungen; `acts.py` schneidet Akt I und II |

## Einen Ort bauen (Reihenfolge)

1. **Bild zuerst.** Standpunkt, Brennweite, Schwenk festlegen, bevor gebaut wird: Was ist der Mittelpunkt, was steht
   vorn, was in der Mitte, was hinten? Der Ort wird fuer diese Kamera gebaut, nicht als Modell fuer alle Seiten.
2. **Licht.** `s.sunlight(rot=A.sun_rot(az, el))` und `s.toon.set_light(Schatten, Mitte, Licht)` (drei Faktoren auf die
   Grundfarbe, aus Tokens gemischt). Die Lichtrichtung der Baender darf von der gemalten Sonne abweichen (A02: Sonne im
   Bild bei -34 Grad, Bandlicht von links bei -102 Grad), damit die Fassaden zur Kamera Form bekommen. Schwellen
   `s.toon.t1/t2` verschieben, wenn eine wichtige Flaeche im falschen Band liegt.
3. **Gelaende.** Hoehenfunktion `h(x, y)`; `Canvas` in Draufsicht bemalen (Strassen, Fugen, Gleise, Pfuetzen, Krater,
   Spuren, Schatten der Karten-Figuren), `S.ground(...)`. Nie eine einfarbige Flaeche: drei Toene (dunkel, mittel, hell).
   Nahe Flaechen brauchen 15-35 Bildpunkte je Meter im Malgrund, ferne 3-5.
4. **Architektur.** `mb = W.MeshB()`, Bauwerke mit `mb.push(x, y, z, rot)` … `mb.pop()` setzen, je Tiefenschicht ein
   Netz (vorn mit Tusche, hinten ohne): `mb.build(shot, name, S.facade_mats(shot), ink=1.3, cam=Standpunkt)`.
   Fenster: `mb.dens` = Anteil leuchtender Scheiben, `mb.off` = Abschaltzeit (Uhr in Sekunden, `W.NEVER` = immer an).
   Vielfalt kommt aus dem Zufallsgenerator je Bauwerk; Wahrzeichen einzeln setzen. Der Mittelpunkt muss frei gegen den
   Himmel stehen: Reihen dahinter niedriger halten.
5. **Wasser.** `S.Water(...)` (Verlauf nah-fern, Glanzbahn, Wellenstriche, ruhige Bahnen), darunter
   `S.mirror(shot, objekte, stretch=1.45)`; bewegte Objekte je Bild mit `S.mirror_follow` nachfuehren.
6. **Himmel.** `AT.sky(shot, name, centre, grad=…, sun=…, glow=…, clouds=…, bands=…, land=…)`: je Akt nach dem Farbskript.
7. **Atmosphaere.** `W.haze(...)` zuletzt (setzt den Dunst aller Materialien), `AT.haze_bank` zwischen den Reihen,
   Rauch, Staub, Teilchen, Voegel, Fahnen.
8. **Leben.** Im `update(t)`: Kamera, `W.clock(t)`, alles Bewegte. Nichts steht still: Schiffe, Kraene, Fahnen, Rauch,
   Wasser, Voegel, Bahnen, Flackern.
9. **Pruefen** (Abschnitt Pruefliste), dann rendern.

Geruest einer Einstellung:

```python
def build():
    s = L.Shot(6.0)
    s.cam.data.lens, s.cam.data.clip_start, s.cam.data.clip_end = 40, 4.0, 16000.0
    rot, d = A.sun_rot(-102.0, 10.0); s.sunlight(rot=tuple(rot)); s.toon.set_light(schatten, mitte, licht)
    mats = S.facade_mats(s, glass=A.cmix('sunDusk', 'sky700', 0.45))
    mb = W.MeshB(); mb.push(0, 100, 0); AR.block(mb, R, 22, 18, 5, pal); mb.pop()
    mb.build(s, 'stadt', mats, ink=1.3, cam=CAM)
    AT.sky(s, 'sky_x', (CAM[0], CAM[1], 0), grad=[...], sun=(az, el), glow=(...), bands=[...])
    W.haze(s, A.cmix('hazeDusk', 'yellow400', 0.12), start=250, dist=640, amount=0.9, hfloor=0.55, hscale=110)
    def update(t):
        s.look(pos(t), ziel(t)); W.clock(t)
    s.on(update); return s
```

## Schichten und Dunst

- Jedes Bild hat **Vordergrund, Mitte, Hintergrund** und einen gemalten Himmel. Der Vordergrund ist dunkel und gross
  (Steg, Wrack, Laterne, Ruecken), die Mitte traegt die Geschichte, der Hintergrund verblasst.
- `W.haze`: `start` = bis hier klar, `dist` = Entfernung fuer 63 % Dunst, `amount` = Obergrenze, `hfloor`/`hscale` =
  nach oben duenner (Fuesse der Haeuser im Dunst, Daecher klar). Richtwerte: Totale am Abend 250 / 640 / 0,9;
  Nacht 220 / 800 / 0,9; Staub 20 / 230 / 0,93; Nahszene 3 / 36 / 0,5.
- Die Dunstfarbe ist die Farbe des Himmels am Horizont. Fenster und Lampen behalten einen Teil ihrer Kraft (`keep`).
- Tuschelinien: am Tag verblassen sie etwas frueher als die Flaechen; in der Nacht und im Staub `ink=` kleiner setzen
  (0,4-0,86), sonst stehen helle Linien auf dunklen Flaechen.
- Dunstbaenke (`AT.haze_bank`) sparsam: jede ist eine bildbreite durchscheinende Flaeche und kostet Zeit; Deckung 0,08-0,3.
- Durchscheinende Objekte werden nach dem Abstand ihres Ursprungs sortiert, nicht je Flaeche: Karten in einem Netz von
  hinten nach vorn anlegen; ein Lichthof, der hinter Figuren liegen soll, bekommt einen Ursprung weit hinten (A03).

## Menschen

`AT.people_atlas(...)` malt Silhouetten (gent, lady, carry, push, stand, woman, fist, child, soldier, run, bearer, hat,
lean, old) mit Lichtsaum, `AT.people` stellt sie als Karten auf. Sie tragen bis etwa 250 Bildpunkte Hoehe; groesser
werden die einfachen Formen sichtbar. Karten werfen keinen Schatten: Schlagschatten in den Malgrund malen (B03, B02).
Naeher als etwa 5 m braucht es eine Figur aus dem Figuren-Baukasten.

## Pruefliste

- Liest man die Geschichte in einer Sekunde (Reichtum; die Lichter gehen aus; Krieg)?
- Ein klarer Mittelpunkt, frei gegen Himmel oder Licht; die Kamerafahrt fuehrt zu ihm.
- Vordergrund, Mitte, Hintergrund vorhanden; kein leeres Bilddrittel, keine einfarbige Flaeche.
- Massstab stimmt: Menschen, Laternen, Tueren im Bild.
- Farben aus dem Farbskript des Akts, ein warmer oder kalter Akzent gegen die Grundstimmung.
- Keine Wiederholung, die auffaellt (Tuerme, Fensterraster, Ballenketten im Rauch).
- 1:1-Ausschnitte ansehen: Tusche nicht dicker als die Form (duenne Teile `mb.ink = 0.3`), keine hellen Linien auf
  dunklen Flaechen, keine Flimmerkanten (`clip_start` so gross wie moeglich: 4 m fuer Totalen).
- Zwei aufeinanderfolgende Bilder vergleichen (Flackern), Anfangs- und Endbild der Fahrt ansehen.
- Bewegt sich etwas in jeder Schicht?

## Rendern und Zeiten

```bash
PY=…/bpyenv/bin/python; cd tools/intro-film
FV_QUALITY=anime FV_CACHE=$PWD/.cache/world FV_SAMPLES=6 FV_SHADOW=0.5 FV_SHADOW_MAX=0.05 FV_RESUME=1 \
  EGL_PLATFORM=surfaceless $PY render.py --shot anime.a02          # Bilder nach .cache/world/frames/anime.a02
… --stills 0,3,6 --scale 0.5                                       # Vorschau einzelner Zeitpunkte (FV_SKY=0.5: kleiner Himmel)
python3 acts.py --frames .cache/world/frames --out ZIEL            # act1.mp4, act2.mp4, sheet.jpg, Standbilder
```

Gemessen auf 4 Kernen ohne GPU (llvmpipe), 1920x1080, ein Prozess (ein zweiter bringt nichts, llvmpipe nutzt alle
Kerne; je Prozess rund 2,5 GB Speicher):

| | s je Bild |
|---|---|
| A02, 8 Proben, feine Schatten (1,0 / 0,01) | 41 |
| A02, 8 Proben, Schatten 0,5 / 0,05 | 24 |
| A02, 6 Proben, Schatten 0,5 / 0,05 (verwendet) | TIME_A02 |
| A02, 5 Proben, Schatten 0,5 / 0,05 | 14 |
| A04 / B03 / B01 / B02 / A03 / B04, 5 Proben (verwendet) | TIME_REST |

Die feinen Schatten des Filmprofils (0,01 m je Schattenpunkt) sind fuer Totalen unnoetig und in Nahszenen sehr teuer
(A03: 90 s statt 11 s je halbem Vorschaubild); 0,5 / 0,05 sieht gleich aus. Ab 5 Proben ist die Kantenglaettung der
Tuschelinien nicht mehr von 8 zu unterscheiden. Szenenaufbau 3-15 s, der Himmel wird einmal gemalt (10-40 s) und liegt
dann im Cache (`paint/`). Bilder rund 2-2,6 MB je PNG.

## Hinweise fuer die naechsten Orte

- **Korvat (Getreidesteppe, Fabriken):** `AT.sky` mit Kumulusbaenken wie A02, Felder als `Canvas`-Streifen, Fabriken aus
  `AR.warehouse` und Schloten (`mb.cyl`), Rauch als `AT.Trail`, Kolonnen als Spielmodelle; Staub wie B03.
- **Dravon (Festung, Nacht, Regen):** Mauern aus `mb.box` mit `plain`/`slit`, Scheinwerfer als `AT.shafts` (additiv),
  Regen `AT.Particles(mode='streak')`, Pfuetzen im Malgrund, Nachtlicht wie A04/B01.
- **Velkar (Eis, Polarlicht):** Himmel mit eigenem `post`-Maler fuer das Polarlicht, Eis als `Canvas` mit hellen
  Spiegelflaechen, Tuerme `AR.tower(style='glass')`, Lichtfarben ueber `win_cols`.
- **Alvenia (Kathedrale, Berge):** Berge als `land`-Schichten plus ein Gelaendenetz, Kathedrale aus `mb.revolve`
  (Kuppeln), `AR.tower(crown='spire')`, Lichtsaeule als additive Karte, Lichtfinger `AT.shafts`.
- **Meridon heute:** `fv/meridon.py` mit anderem Licht; Inselbasis aus `AR.quay`, Kraenen, Werfthallen.
- **Sternfall-Wueste:** Duenen als Hoehenfunktion, `Canvas` mit Windrippen, Hitzedunst (`hfloor` nahe 1, heller Dunst),
  Truemmerspuren im Himmel ueber `post`.

Neue Farben waren nicht noetig: alles ist aus vorhandenen Tokens gemischt (`A.cmix`).

---

<a name="english"></a>
# English

Film only (Blender side, `tools/intro-film/fv/`); the game is untouched. The places of acts I and II are built with
this kit (Meridon, the Standstill, the distribution wars); the faction homelands and the Starfall desert are meant to
be built with the same tools.

## Parts

| File | Content |
|---|---|
| `fv/world.py` | mesh builder `MeshB` (boxes, roofs, solids of revolution, rods, cards; corner colour, facade UVs, light data), ink as a hull with strength by distance (`add_ink`, per vertex; `mb.ink` for thin parts), materials `arch_mat` (facade with switchable windows), `sprite_mat` (cards, halos), `flat_mat`; clock (`clock`), haze (`haze`) |
| `fv/scenery.py` | painted facade cells (`FACADES`: res, grand, office, ware, shop, slit, glass, plain), `facade_mats`, mirror images (`mirror`), `Water`, wakes, the canvas `Canvas` and `ground` for grounds |
| `fv/atmo.py` | sky (`sky`: gradient, sun, cumulus, cloud bands, stars, land layers), `haze_bank`, `shafts`, smoke (`Trail` painted, `Smoke` as lumps), `puff_atlas`, `Cards`, `Burst`, `Particles` (ash, embers, rain/snow, breath), `Birds`, `Flag`, people as silhouettes (`people_atlas`, `people`) |
| `fv/arch.py` | architecture: `block`, `tower`, `warehouse`, `bank`, `lighthouse`, crane, `bridge`, `quay`, `lamp`, `freighter`, `sailship`, `boat`, `jetty`, `tram`, `crates`; `Palette` |
| `fv/props.py` | war landscape and props: `war_height` (craters, trenches), `ruin_wall`, `rubble`, `dead_tree`, `wire_fence`, `tanker`, `barrier`, `chain`, `bronze_gate`, `dead_lamp`, `Fire` |
| `fv/meridon.py` | the place Meridon as a class (harbour, bank, terraced city, far districts, NEXUS) with a switch-off time per district |
| `fv/shots/anime/a02.py … b04.py` | the shots; `acts.py` cuts acts I and II |

## Building a place (order)

1. **Picture first.** Fix the camera position, lens and move before building: what is the focal point, what stands
   in front, in the middle, at the back? The place is built for this camera, not as a model for all sides.
2. **Light.** `s.sunlight(rot=A.sun_rot(az, el))` and `s.toon.set_light(shadow, mid, lit)` (three factors on the base
   colour, mixed from tokens). The band light may differ from the painted sun (A02: sun in frame at -34 degrees, band
   light from the left at -102 degrees) so the facades facing the camera get form. Move the thresholds `s.toon.t1/t2`
   when an important surface falls into the wrong band.
3. **Terrain.** A height function `h(x, y)`; paint a `Canvas` in top view (streets, joints, rails, puddles, craters,
   tracks, the shadows of card figures), `S.ground(...)`. Never a single-colour plane: three tones (dark, mid, light).
   Near surfaces need 15-35 pixels per metre in the canvas, far ones 3-5.
4. **Architecture.** `mb = W.MeshB()`, place buildings with `mb.push(x, y, z, rot)` … `mb.pop()`, one mesh per depth
   layer (front with ink, back without): `mb.build(shot, name, S.facade_mats(shot), ink=1.3, cam=position)`. Windows:
   `mb.dens` = share of lit panes, `mb.off` = switch-off time (clock in seconds, `W.NEVER` = always on). Variety comes
   from the random generator per building; set landmarks by hand. The focal point must stand free against the sky:
   keep the rows behind it lower.
5. **Water.** `S.Water(...)` (near-far gradient, glitter path, ripple dashes, calm lanes), below it
   `S.mirror(shot, objects, stretch=1.45)`; make moving objects follow per frame with `S.mirror_follow`.
6. **Sky.** `AT.sky(shot, name, centre, grad=…, sun=…, glow=…, clouds=…, bands=…, land=…)`: per act after the colour script.
7. **Atmosphere.** `W.haze(...)` last (sets the haze of all materials), `AT.haze_bank` between the rows, smoke, dust,
   particles, birds, flags.
8. **Life.** In `update(t)`: camera, `W.clock(t)`, everything that moves. Nothing stands still: ships, cranes, flags,
   smoke, water, birds, trams, flicker.
9. **Check** (checklist below), then render. The shot skeleton is in the German part above.

## Layers and haze

- Every picture has a **foreground, a middle and a background** plus a painted sky. The foreground is dark and large
  (jetty, wreck, lamp, backs), the middle carries the story, the background fades.
- `W.haze`: `start` = clear up to here, `dist` = distance for 63 % haze, `amount` = upper limit, `hfloor`/`hscale` =
  thinner with height (the houses' feet in haze, the roofs clear). Guide values: wide shot at dusk 250 / 640 / 0.9;
  night 220 / 800 / 0.9; dust 20 / 230 / 0.93; close scene 3 / 36 / 0.5.
- The haze colour is the sky's colour at the horizon. Windows and lamps keep part of their strength (`keep`).
- Ink lines: by day they fade a little earlier than the faces; at night and in dust set `ink=` lower (0.4-0.86),
  otherwise light lines stand on dark faces.
- Haze banks (`AT.haze_bank`) sparingly: each is a frame-wide translucent plane and costs time; alpha 0.08-0.3.
- Translucent objects are sorted by the distance of their origin, not per face: lay out the cards of one mesh from
  back to front; a halo meant to lie behind figures gets an origin far back (A03).

## People

`AT.people_atlas(...)` paints silhouettes (gent, lady, carry, push, stand, woman, fist, child, soldier, run, bearer,
hat, lean, old) with a light fringe, `AT.people` places them as cards. They hold up to about 250 pixels of height;
beyond that the simple shapes show. Cards cast no shadows: paint cast shadows into the canvas (B03, B02). Closer than
about 5 m a figure from the character kit is needed.

## Checklist

- Does the story read in one second (wealth; the lights going out; war)?
- One clear focal point, free against sky or light; the camera move leads to it.
- Foreground, middle, background present; no empty third of the frame, no single-colour plane.
- The scale is right: people, lamps, doors in the picture.
- Colours from the act's colour script, one warm or cold accent against the base mood.
- No repeat that shows (towers, window grids, chains of balls in smoke).
- Look at 1:1 crops: ink not thicker than the form (thin parts `mb.ink = 0.3`), no light lines on dark faces, no
  flickering edges (`clip_start` as large as possible: 4 m for wide shots).
- Compare two consecutive frames (flicker), look at the first and the last frame of the move.
- Does something move in every layer?

## Rendering and timings

Commands as in the German part. Measured on 4 cores without a GPU (llvmpipe), 1920x1080, one process (a second one
gains nothing, llvmpipe uses all cores; about 2.5 GB of memory per process):

| | s per frame |
|---|---|
| A02, 8 samples, fine shadows (1.0 / 0.01) | 41 |
| A02, 8 samples, shadows 0.5 / 0.05 | 24 |
| A02, 6 samples, shadows 0.5 / 0.05 (used) | TIME_A02 |
| A02, 5 samples, shadows 0.5 / 0.05 | 14 |
| A04 / B03 / B01 / B02 / A03 / B04, 5 samples (used) | TIME_REST |

The fine shadows of the film profile (0.01 m per shadow texel) are unnecessary for wide shots and very expensive in
close scenes (A03: 90 s instead of 11 s per half-size preview still); 0.5 / 0.05 looks the same. From 5 samples up the
anti-aliasing of the ink lines cannot be told from 8. Scene build 3-15 s, the sky is painted once (10-40 s) and then
cached (`paint/`). Frames about 2-2.6 MB per PNG.

## Notes for the next places

- **Korvat (grain steppe, factories):** `AT.sky` with cumulus banks as in A02, fields as `Canvas` stripes, factories
  from `AR.warehouse` and chimneys (`mb.cyl`), smoke as `AT.Trail`, columns as game models; dust as in B03.
- **Dravon (fortress, night, rain):** walls from `mb.box` with `plain`/`slit`, search lights as `AT.shafts` (additive),
  rain `AT.Particles(mode='streak')`, puddles in the canvas, night light as in A04/B01.
- **Velkar (ice, aurora):** a sky with its own `post` painter for the aurora, ice as a `Canvas` with bright mirror
  patches, towers `AR.tower(style='glass')`, light colours via `win_cols`.
- **Alvenia (cathedral, mountains):** mountains as `land` layers plus a terrain mesh, the cathedral from `mb.revolve`
  (domes), `AR.tower(crown='spire')`, the pillar of light as an additive card, light shafts `AT.shafts`.
- **Meridon today:** `fv/meridon.py` with different light; the island base from `AR.quay`, cranes, shipyard sheds.
- **Starfall desert:** dunes as a height function, a `Canvas` with wind ripples, heat haze (`hfloor` near 1, light
  haze), debris trails in the sky via `post`.

No new colours were needed: everything is mixed from existing tokens (`A.cmix`).
