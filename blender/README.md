# Blender-Pipeline / Blender pipeline

## Deutsch

Das Spiel erzeugt alle 3D-Modelle zur Laufzeit prozedural im Code (`src/render/models/`).
`generate_assets.py` ist die dokumentierte Blender-Pipeline dazu: Das Skript baut die Grundmodelle
mit denselben Proportionen und Farben in Blender nach und exportiert sie als binäres glTF (`.glb`)
mit Draco-komprimierter Geometrie nach `public/assets/`.

Enthaltene Grundmodelle, je Fraktion (Korvat, Dravon, Alvenia, Meridon, Velkar):

- Soldat (mit fraktionstypischem Helm/Barett), Jeep, Panzer, Kampfhubschrauber
- Schiffsrümpfe: Landungsboot, U-Boot, Zerstörer, Kriegsschiff
- Haus im Baustil der Fraktion, zusätzlich ein neutrales Dorfhaus

### Ausführen

Voraussetzung: Blender 3.6 oder neuer (getestet ist die API ab 3.6 bis 4.x; der glTF-Exporter mit
Draco ist in Blender enthalten).

```bash
# im Projektordner
blender -b -P blender/generate_assets.py

# optional: Zielordner und .blend-Quelldatei angeben
blender -b -P blender/generate_assets.py -- --out public/assets --blend blender/frontverlauf_models.blend
```

- `-b` startet Blender ohne Oberfläche, `-P` führt das Skript aus.
- Die Farben liest das Skript aus `src/design/tokens.ts`. Es gibt also keine zweite Farbquelle.
- Koordinaten: Das Skript beschreibt die Modelle wie der TypeScript-Code (y oben, Blick nach +z,
  1 Kachel = 1 Einheit, Ursprung unten mittig) und rechnet für Blender auf z oben um. Der Export
  (`export_yup`) rechnet wieder auf y oben zurück, sodass die `.glb`-Dateien direkt zu Three.js passen.
- Vertexfarben werden als Farbattribut `Color` gespeichert und als `COLOR_0` exportiert. Das Material
  nutzt nur diese Vertexfarben; Toon-Shading und Tuschekonturen setzt der Renderer.
- Mit `--blend` wird zusätzlich die Blender-Quelldatei gespeichert.

Lizenz der erzeugten Dateien: CC0 (eigene Schöpfung des Frontverlauf-Projekts).

## English

The game builds all 3D models procedurally in code at runtime (`src/render/models/`).
`generate_assets.py` is the documented Blender pipeline for them: the script rebuilds the base meshes
with the same proportions and colours in Blender and exports them as binary glTF (`.glb`) with
Draco-compressed geometry to `public/assets/`.

Included base meshes, per faction (Korvat, Dravon, Alvenia, Meridon, Velkar):

- soldier (with the faction's helmet/beret), jeep, tank, combat helicopter
- ship hulls: landing boat, submarine, destroyer, battleship
- house in the faction's building style, plus one neutral village house

### Running

Requirement: Blender 3.6 or newer (API used is available from 3.6 up to 4.x; the glTF exporter with
Draco ships with Blender).

```bash
# from the project root
blender -b -P blender/generate_assets.py

# optional: output folder and .blend source file
blender -b -P blender/generate_assets.py -- --out public/assets --blend blender/frontverlauf_models.blend
```

- `-b` runs Blender without UI, `-P` runs the script.
- Colours are read from `src/design/tokens.ts`, so there is no second colour source.
- Coordinates: the script describes models like the TypeScript code (y up, facing +z, 1 tile = 1 unit,
  origin at bottom centre) and converts to z up for Blender. The export (`export_yup`) converts back to
  y up, so the `.glb` files match Three.js directly.
- Vertex colours are stored as colour attribute `Color` and exported as `COLOR_0`. The material only uses
  these vertex colours; toon shading and ink outlines are added by the renderer.
- `--blend` additionally saves the Blender source file.

Licence of the generated files: CC0 (own creation of the Frontverlauf project).
