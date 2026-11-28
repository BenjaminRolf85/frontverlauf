# Film-Leitfaden: Figuren, Posen, Licht und Schichten / film guide: figures, poses, light and layers

Fuer alle, die weitere Anfuehrer und Szenen des Anime-Schnitts bauen. Massstab ist die Korvat-Szene (E1a, E1b, E1c):
jedes Bild muss als Standbild einer Shop-Seite bestehen. Deutsch zuerst, [English below](#english).

Dateien / files:

| Datei / file | Aufgabe / purpose |
|---|---|
| `web/figureKit.ts` | Skelett (`Rig`), Gewichte (`Skinner`), Glieder (`limb`), Export (`figureExtras`) / skeleton, weights, limbs, export |
| `web/figureHuman.ts` | der Mensch: Skelett `humanRig`, Arme, Haende, Beine, Stiefel, Rumpf, Guertel / the human: rig, arms, hands, legs, boots, trunk, belt |
| `web/figureKorvat.ts` | Brodnik: Bueste zerlegen, Kostuem, Zellen und Maler, Umhang, Gesichtszeichnungen / Brodnik: splitting the bust, costume, cells and painters, cape, face drawings |
| `web/figureArmy.ts` | Soldat (vier Ausruestungen), Pferd, Banner; ein Atlas / soldier (four kits), horse, banner; one atlas |
| `web/figures.ts` | Verzeichnis der Filmfiguren fuer `export-models.ts` / directory of the film figures |
| `fv/figure.py` | `Figure` (Pose, Bewegung, Wind, Mimik), `Baked` (Heere), Gelenkformeln / poses, motion, wind, expression, armies, joint formulas |
| `fv/poses.py` | Posen als Tabellen, Atmen, Wiegen, Gangarten / poses as tables, breathing, sway, gaits |
| `fv/army.py` | Reiter auf Pferd, Backen von Gangarten, Banner / rider on horse, baking gaits, banners |
| `fv/korvat.py` | Welt der Korvat: Gelaende, Himmel, Fels, Gras, Heer, Licht / the Korvat world |
| `fv/shots/anime/e1a.py`, `e1b.py`, `e1c.py` | die drei Einstellungen / the three shots |
| `fv/shots/anime/figsheet.py` | Kontrollboegen (`FV_SHEET=turn, poses, one, half, hands, face, army, motion`) / check sheets |

```bash
PY=/tmp/bpyenv/bin/python
node tools/intro-film/export-models.mjs --quality film --out tools/intro-film/.cache/anime/models \
  --only fig_korvat_body,fig_korvat_head,fig_korvat_cape,figatlas_korvat_head_narrow,figatlas_korvat_head_blink,fig_korvat_rider,fig_korvat_lancer,fig_korvat_officer,fig_korvat_foot,fig_korvat_guard,fig_korvat_horse,fig_korvat_banner
FV_SHEET=turn FV_QUALITY=anime EGL_PLATFORM=surfaceless $PY tools/intro-film/render.py --shot anime.figsheet --stills 0
FV_QUALITY=anime EGL_PLATFORM=surfaceless $PY tools/intro-film/render.py --shot anime.e1b --stills 2.6 --scale 0.5   # Probe / test
FV_RESUME=1 FV_QUALITY=anime EGL_PLATFORM=surfaceless $PY tools/intro-film/render.py --shot anime.e1b             # 96 Bilder / frames
```

---

## Deutsch

### 1. Wie eine Figur entsteht

Eine Filmfigur ist ein gezeichnetes Modell wie die Einheiten (Flaeche mit Atlas, Tuschehuelle, Knicklinien), dazu ein
Skelett. Sie wird EINMAL in der Bindehaltung gebaut (A-Haltung: Arme 30 Grad abgespreizt, Beine leicht offen, damit die
Verdeckung sauber gebacken wird). Jede Ecke haengt an einem Knochen mit einem Gewicht gegen dessen Elternknochen und
einem Tuchwert. Posen leben in Blender.

1. **Skelett**: `humanRig(P)` mit den Massen `HumanProp` (in Einheiten der Bueste, Kopfhoehe 0,38). `HERO` ist die
   Heldenfigur. Knochen: `root, spine, chest, neck, head`, je Seite `clav, arm, elbow, hand, leg, knee, foot` und
   15 Fingerknochen. Eigene Wesen (Pferd, Zyrr) bauen ihr `Rig` selbst (`figureArmy.horseRig`).
2. **Teile bauen**: alles innerhalb von `sk.part(gewichte, () => ...)` bekommt diese Gewichte. `sk.rigid('chest')`
   haengt starr, `sk.chain(['arm', 'elbow'], 0.075)` beugt ueber dem Gelenk weich (Aermel bleibt ein Stueck Stoff).
   `limb(pfad, radius(d, a), ...)` ist das Grundteil: ein Schlauch mit freiem Querschnitt entlang der Gelenke, UV
   laengs / rundum. Fertige Teile: `arms, hands, legs, boots, trunk, belt` (figureHuman.ts). Gelenke nahtlos:
   weiche Beuge an Ellbogen, Knie, Knoechel, Hals, Taille; ueberlappende starre Teile an Schulter (Kappe unter dem
   Schulterstueck), Huefte (unter dem Rockschoss), Handgelenk (Hand im Aufschlag). Wo Teile sich treffen, zieht die
   Tuschehuelle von selbst eine Linie.
3. **Kopf und Koerper aus einem Guss**: `figureKorvat.bustPart` ruft die Heldenbueste unveraendert auf und trennt
   sie nach Atlaszellen in Kopf, Hals, Kragen, Schulterstuecke, Brust. Der Kopf wird ein eigenes Teil mit eigenem
   Atlas (Gesichtszelle 1,4 bis 1,5-fach), die Brust bleibt mit Orden und Knoepfen, darunter schliesst `trunk` mit
   denselben 88 Spalten nahtlos an (erste Zeile = `torsoPoint(T, a, 0)`). Die Bueste dunkelt zu ihrem unteren Rand
   ab; `unfade` hebt das in der Tonschicht auf.
4. **Zeichnung**: Zellen (`Cell`) mit Malern wie bei den Buesten (`Pen`: `shade` = harter Ton, `fill` = Farbe, `line`
   = Tusche, `fold` = Faltenlinie mit Schattenkeil). Keine Schraffur, keine Rasterpunkte. Formschatten nur
   symmetrisch malen (Innenseite der Glieder dunkler), nie gerichtet: das gerichtete Licht kommt aus den drei
   Lichtbaendern. Farben nur aus `look(...)`, `mat` und den Tokens.
5. **Abschluss**: `finish(b, sk, atlas, fallback, meta)` backt die Verdeckung, haengt Skelett und Gewichte an.
   Eintrag in `figures.ts`, Export wie oben. `meta.floor` = Sohle, `meta.height` = Hoehe fuer den Massstab.

### 2. Wie eine Pose entsteht

Eine Pose ist eine Tabelle `{Knochen: [Winkel in Grad]}` in `fv/poses.py`. Nicht genannte Knochen bleiben in der
Bindehaltung. Die Winkel sind sprechend (in Ruhe haengen Arme und Beine gerade nach unten):

| Gelenk | Winkel |
|---|---|
| `root` | Nicken, Drehen, Rollen |
| `spine, chest, neck, head` | vorbeugen, nach links neigen, nach links drehen |
| `clavL/R` | heben, vorziehen |
| `armL/R`, `legL/R` | nach vorn, abspreizen, Aussendrehung |
| `elbowL/R`, `kneeL/R` | beugen |
| `handL/R` | zur Handflaeche beugen, zur Daumenseite, Aussendrehung (negativ = Handflaeche nach unten) |
| `footL/R` | Spitze hoch, Spitze nach aussen, kippen; oder `'flat'` / `'flat:6'` (Sohle waagerecht) |
| `fingersL/R` | `'relaxed'`, `'open'`, `'fist'`, `'point'`, `'grip'` oder eigene Fingerwinkel |
| `pos`, `scale` | Versatz der Huefte (Modelleinheiten), Massstab je Knochen (Atmen) |

```python
fig = F.Figure(shot, ['fig_korvat_body', 'fig_korvat_head', 'fig_korvat_cape'], loc=(x, y, z), rot=180 - azimut, height=1.86, wind=F.Wind((-0.9, 0, -0.44), 0.85))
fig.track([(0.0, P.KORVAT_READY), (0.35, P.KORVAT_READY), (1.25, P.KORVAT_POINT, L.ease_io)])   # Schluesselposen / key poses
fig.layer(P.breathe(1.0)); fig.layer(P.sway(0.5))                                              # Atmen, Wiegen
fig.face_setup('fig_korvat_head', FACES); fig.face([(2.55, FACES[2], 0), (2.6, FACES[2], 1), (2.76, FACES[2], 0)])  # Blinzeln
shot.on(fig.update)
```

- Die tiefste Sohle steht immer auf `loc`. Steht ein Fuss hoeher, den Block darunter aus `fig.world('ballL')` setzen.
- Bewegung: zwischen Schluesselposen werden die Winkel gemischt und je Bild die Ecken um ihre Gelenke gedreht (die
  Drehung wird gemischt, nicht der Ort: nichts schrumpft). Begrenzte Animation ist erwuenscht: wenige Schluesselposen,
  `ease_io`, dazu Atmen, Wiegen, Tuch im Wind, Blinzeln.
- Mimik: gleiche Kopfgeometrie, weitere Gesichtszeichnungen als eigene Atlanten (`FACES` in figureKorvat.ts: Zahlen
  der `MoodArt`). Blender blendet die zweite Zeichnung in Stufen 0, 1/2, 1 ein (Farbe gemischt, Tusche ueber das
  Abstandsfeld).
- Tuch: Tuchwert 0 (fest) bis 1 (frei) je Ecke; `F.Wind(richtung im Modell, staerke, welle)` verformt vor dem Drehen.
  Tuchteile bekommen kein Rand- und Bodenlicht (`fig.no_rim(teil)`), sonst werden die Falten fleckig.
- Heere: `fig.bake(ink_px=..., lod=...)` friert eine Pose als geteiltes Netz ein, `F.Baked` stellt Kopien auf und
  wechselt Phasen (Galopp, Marsch). `K.Army` waehlt drei Klassen nach Entfernung: nah (alles), mittel (halbe Dreiecke,
  nur Umriss), fern (28 %, ohne Tusche, ohne Schattenwurf).

### 3. Regeln fuer Proportion und Texeldichte

- Mensch: gut 7,5 Koepfe (Modell 2,95 hoch, Kopf 0,38), Beine ab Hueftgelenk 1,6, Schulterbreite der Bueste 0,9,
  Hand 0,31, Fuss 0,40. Mit Muetze oder Helm wirkt der Kopf groesser: lieber laengere Beine als kuerzerer Rumpf.
- Wahrer Massstab in der Szene: 1 Einheit = 1 Meter. Anfuehrer 1,86 m, Soldat 1,80 m, Pferd 1,55 m Widerrist,
  Panzer des Spiels mit `scale=0.66` (4,4 m lang). Nie eine Figur groesser stellen, um sie hervorzuheben: naeher
  heran oder laengere Brennweite.
- Texel: Heldenatlanten 4096. Gesicht mindestens 9000 Texel je Modelleinheit (Kopf 1700 Texel breit): reicht fuer
  ein Bild, das von Muetzenschirm bis Schnurrbart reicht. Koerper 700 bis 2800 Texel je Einheit; eine Hand, die das
  halbe Bild fuellt, braucht eine Handzelle von 130 Bezugspixeln aufwaerts. Heeresatlas wird in Blender auf 2048
  verkleinert.
- Dreiecke: Held rund 120.000 Flaeche, Soldat in der Menge 17.000, Pferd 20.000.

### 4. Licht und Schichten

- Drei flache Lichtbaender je Einstellung (`shot.toon.set_light(schatten, mitte, licht)`): Schatten kuehl (violett),
  Licht warm. Eine Sonne fuer Richtung und Schattenwurf; fuer Nahaufnahmen wird sie zum Gesicht gedreht
  (`K.lights(shot, az=146, el=20)`), der Himmel bleibt.
- Randlicht `A.rim_units` in Sonnenfarbe, Bodenlicht `K.bounce_units` auf nach unten zeigenden Flaechen.
- Dunst nach Entfernung fuer alle Materialien (`A.haze_all`): beginnt bei 16 m. So trennt sich die Figur vom Heer
  dahinter.
- Schichten von vorn nach hinten: dunkles Vordergrundgras auf einer Bodenwelle direkt vor der Kamera (`K.BUMPS`),
  Fels und Figur scharf, Heer im Tal im Dunst, Felder und Fabriken fast in Dunstfarbe, gemalter Himmel.
- Kamera: Figur mit langer Brennweite (62 mm) aus 9 m, Kamera knapp ueber ihrer Standflaeche; Heer 40 bis 250 m
  dahinter. Die Figur zeigt der Kamera die Brust; gezeigt wird zur Seite, der Kopf geht ins Dreiviertelprofil.
- Gelaende in drei Schichten mit demselben Maler an Weltkoordinaten (`K.paint_land`): fern, mittel, nah.

### 5. Pruefliste

1. Bogen `turn`: Anatomie von vier Seiten, Fuesse auf dem Boden, keine Luecken an Gelenken.
2. Bogen `poses`: jede neue Pose einzeln, Gewicht auf dem Standbein, klare Linie durch den Koerper.
3. Bogen `hands` und `face`: 1:1 ansehen. Finger getrennt lesbar, Gesicht scharf.
4. Massstab: ein Soldat (`fig_korvat_guard`) neben dem Anfuehrer (Bogen `army`).
5. Standbild der Einstellung in halber Groesse, dann als Daumennagel (240 Pixel breit): liest man die Figur?
6. Trennt sich die Figur vom Hintergrund? Kopf und Hand nicht vor dunklen Formen (Rauch, Wolke).
7. Tuch ohne Flecken, Linien nicht ausgefranst, kein Durchdringen (Arm durch Schulterstueck, Saebel durchs Bein).
8. Erstes, mittleres, letztes Bild der Einstellung ansehen, erst dann die Folge rendern.
9. Vor dem Push: `npm run check`, `npx vitest run < /dev/null`, `npm run build`; `git diff --stat -- src` ist leer.

### 6. Zeiten (4 Kerne ohne GPU, ein Prozess, ein zweiter Agent renderte gleichzeitig)

RENDER_TIMES_DE

---

## English

### 1. How a figure is made

A film figure is an inked model like the units (fill with an atlas, ink hull, crease lines) plus a skeleton. It is
built ONCE in the bind pose (an A pose: arms spread by 30 degrees, legs slightly open so the occlusion bakes cleanly).
Every vertex hangs on one bone with a weight against that bone's parent and a cloth value. Poses live in Blender.

1. **Skeleton**: `humanRig(P)` with the sizes `HumanProp` (in units of the bust, head height 0.38). `HERO` is the hero
   figure. Bones: `root, spine, chest, neck, head`, per side `clav, arm, elbow, hand, leg, knee, foot` and 15 finger
   bones. Other creatures (horse, Zyrr) build their own `Rig` (`figureArmy.horseRig`).
2. **Building parts**: everything inside `sk.part(weights, () => ...)` gets those weights. `sk.rigid('chest')` hangs
   rigidly, `sk.chain(['arm', 'elbow'], 0.075)` bends softly across the joint (the sleeve stays one piece of cloth).
   `limb(path, radius(d, a), ...)` is the basic part: a hose with a free cross-section along the joints, uv along /
   around. Ready parts: `arms, hands, legs, boots, trunk, belt` (figureHuman.ts). Seamless joints: a soft bend at
   elbow, knee, ankle, neck, waist; overlapping rigid parts at the shoulder (cap below the epaulette), hip (below the
   skirt), wrist (hand in the cuff). Where parts meet, the ink hull draws a line by itself.
3. **Head and body from one mould**: `figureKorvat.bustPart` calls the hero bust unchanged and splits it by atlas
   cells into head, neck, collar, epaulettes, chest. The head becomes a piece of its own with its own atlas (face cell
   1.4 to 1.5 times larger), the chest stays with medals and buttons, and `trunk` joins below it seamlessly with the
   same 88 columns (first row = `torsoPoint(T, a, 0)`). The bust darkens towards its bottom edge; `unfade` cancels
   that in the tone layer.
4. **Drawing**: cells (`Cell`) with painters as for the busts (`Pen`: `shade` = hard tone, `fill` = colour, `line` =
   ink, `fold` = fold line with a shade wedge). No hatching, no halftone dots. Paint form shade symmetrically only
   (inner side of limbs darker), never directed: the directed light comes from the three light bands. Colours only
   from `look(...)`, `mat` and the tokens.
5. **Finishing**: `finish(b, sk, atlas, fallback, meta)` bakes the occlusion and attaches skeleton and weights. Add an
   entry in `figures.ts`, export as above. `meta.floor` = sole, `meta.height` = height used for the scale.

### 2. How a pose is made

A pose is a table `{bone: [angles in degrees]}` in `fv/poses.py`. Bones not named stay in the bind pose. The angles
speak for themselves (at rest arms and legs hang straight down):

| joint | angles |
|---|---|
| `root` | pitch, yaw, roll |
| `spine, chest, neck, head` | bend forward, lean left, turn left |
| `clavL/R` | raise, pull forward |
| `armL/R`, `legL/R` | forward, out, outward twist |
| `elbowL/R`, `kneeL/R` | bend |
| `handL/R` | flex to the palm, to the thumb side, supination (negative = palm down) |
| `footL/R` | toes up, toes out, roll; or `'flat'` / `'flat:6'` (sole level) |
| `fingersL/R` | `'relaxed'`, `'open'`, `'fist'`, `'point'`, `'grip'` or own finger angles |
| `pos`, `scale` | offset of the hips (model units), scale per bone (breathing) |

(Code example above.)

- The lowest sole always stands on `loc`. If one foot stands higher, place the block below it from
  `fig.world('ballL')`.
- Motion: between key poses the angles are blended and per frame the vertices are rotated about their joints (the
  rotation is blended, not the place: nothing shrinks). Limited animation is wanted: few key poses, `ease_io`, plus
  breathing, sway, cloth in the wind, blinks.
- Expression: the same head geometry, further face drawings as atlases of their own (`FACES` in figureKorvat.ts: the
  numbers of `MoodArt`). Blender blends the second drawing in in steps 0, 1/2, 1 (colour mixed, ink through the
  distance field).
- Cloth: cloth value 0 (fixed) to 1 (free) per vertex; `F.Wind(direction in the model, strength, wave)` deforms before
  the rotation. Cloth pieces get no rim and bounce light (`fig.no_rim(piece)`), otherwise the folds turn blotchy.
- Armies: `fig.bake(ink_px=..., lod=...)` freezes a pose as a shared mesh, `F.Baked` places copies and switches
  phases (gallop, march). `K.Army` picks three classes by distance: near (everything), mid (half the triangles,
  silhouette only), far (28 %, no ink, no cast shadow).

### 3. Rules for proportion and texel density

- Human: a good 7.5 heads (model 2.95 tall, head 0.38), legs from the hip joint 1.6, shoulder width of the bust 0.9,
  hand 0.31, foot 0.40. With a cap or helmet the head looks larger: prefer longer legs to a shorter trunk.
- True scale in the scene: 1 unit = 1 metre. Leader 1.86 m, soldier 1.80 m, horse 1.55 m at the withers, the game's
  tank at `scale=0.66` (4.4 m long). Never enlarge a figure to stress it: move closer or use a longer lens.
- Texels: hero atlases 4096. Face at least 9000 texels per model unit (head 1700 texels wide): enough for a frame
  reaching from the cap peak to the moustache. Body 700 to 2800 texels per unit; a hand filling half the frame needs a
  hand cell of 130 reference pixels or more. The army atlas is shrunk to 2048 in Blender.
- Triangles: hero about 120,000 fill, soldier in a crowd 17,000, horse 20,000.

### 4. Light and layers

- Three flat light bands per shot (`shot.toon.set_light(shadow, mid, lit)`): shadow cool (violet), light warm. One
  sun for direction and cast shadows; for close-ups it is turned to the face (`K.lights(shot, az=146, el=20)`), the
  sky stays.
- Rim light `A.rim_units` in the sun's colour, bounce light `K.bounce_units` on faces pointing down.
- Haze by distance for all materials (`A.haze_all`): starts at 16 m. That separates the figure from the army behind.
- Layers front to back: dark foreground grass on a hump right in front of the camera (`K.BUMPS`), rock and figure
  sharp, army in the valley in haze, fields and factories almost in the haze colour, painted sky.
- Camera: the figure with a long lens (62 mm) from 9 m, camera just above the surface it stands on; army 40 to 250 m
  behind. The figure shows the camera its chest; it points sideways, the head turns into a three-quarter profile.
- Terrain in three layers with the same painter at world coordinates (`K.paint_land`): far, mid, near.

### 5. Checklist

1. Sheet `turn`: anatomy from four sides, feet on the ground, no gaps at the joints.
2. Sheet `poses`: every new pose alone, weight on the standing leg, a clear line through the body.
3. Sheets `hands` and `face`: look at them 1:1. Fingers readable apart, face sharp.
4. Scale: a soldier (`fig_korvat_guard`) next to the leader (sheet `army`).
5. A still of the shot at half size, then as a thumbnail (240 pixels wide): does the figure read?
6. Does the figure separate from the background? Head and hand not in front of dark shapes (smoke, cloud).
7. Cloth without blotches, lines not frayed, no interpenetration (arm through epaulette, sabre through leg).
8. Look at the first, middle and last frame of the shot, only then render the sequence.
9. Before the push: `npm run check`, `npx vitest run < /dev/null`, `npm run build`; `git diff --stat -- src` is empty.

### 6. Timings (4 cores without a GPU, one process, a second agent was rendering at the same time)

RENDER_TIMES_EN
