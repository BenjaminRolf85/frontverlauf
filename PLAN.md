# Umsetzungsplan / Implementation plan — „Frontverlauf“

Gegliedert nach den Meilensteinen aus Abschnitt 12. Nach jedem Meilenstein ist das Spiel lauffähig.
Structured by the milestones of section 12. The game stays runnable after every milestone.

| # | Meilenstein / Milestone | Inhalt / Content | Ordner / Folders |
|---|---|---|---|
| 1 | Spielkern / Game core | Seed-Generator, Kartengenerator, Zustand, alle Kommandos, Kampf, Wirtschaft, Forschung, Gebäude, Außenposten, Diplomatie, Punkte, Spielmodi; Balancing-Datei; Vitest-Tests; Testansicht | `src/core`, `src/data/balance.ts`, `tests/` |
| 2 | Design System + 3D-Karte / Design system + 3D map | Drei-Ebenen-Tokens (CSS + TS), Komponenten, eigener SVG-Symbolsatz, isometrische Comic-Karte (Toon-Shading, Tuschekonturen), Maus/Touch, DE/EN | `src/design`, `src/ui`, `src/render`, `src/input`, `src/i18n` |
| 3 | Vollständig spielbar / Fully playable | alle Einheiten, Gebäude, radialer Forschungsbaum, Außenposten, Hubschrauber-Sprit mit Rückflug-Anzeige | `src/ui/screens` |
| 4 | Assets + Fraktionen / Assets + factions | prozedurale Low-Poly-Modelle in fünf Fraktionsvarianten (Skript, eigene Schöpfung), Blender-Exportskript, Perks und Rabatte | `src/render/models`, `blender/` |
| 5 | KI, Modi, Speichern / AI, modes, saving | KI in vier Stufen, Punkte/Eroberung/Sandkasten, Diplomatie, localStorage + Datei-Export/-Import, Hotseat mit Übergabebildschirm | `src/ai`, `src/save` |
| 6 | VR + AR (Quest 3) | WebXR immersive-vr / immersive-ar, Diorama 1,2 m, Lageraum, Hit-Test-Platzierung, Controller + Handtracking, Greifen/Skalieren, Panels im Raum | `src/xr` |
| 7 | Feinschliff / Polish | prozeduraler Klang (WebAudio, eigene Themen je Fraktion), Tutorial, Leistung (Instancing), Barrierefreiheit | `src/audio`, `src/ui/tutorial.ts` |

Annahmen stehen in `ANNAHMEN.md`, Asset-Nachweise in `ASSETS.md`, die Balancing-Beschreibung in `BALANCING.md`.
Assumptions are in `ANNAHMEN.md`, asset credits in `ASSETS.md`, the balancing description in `BALANCING.md`.
