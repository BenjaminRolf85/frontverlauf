# Frontverlauf

**Deutsch** · [English](#english)

Rundenbasiertes 4X-Strategiespiel mit modernem Militärthema im Comic-Look. Es läuft komplett im Browser: am Desktop, mobil mit Touch im Hochformat und auf der Meta Quest 3 im VR- und AR-Modus. Es gibt 2 bis 5 frei erfundene Fraktionen, Mensch oder KI, Partien dauern 15 bis 60 Minuten. Der Kampf kennt keinen Zufall, und Sterne sind die einzige Währung.

## Starten

```bash
npm install
```

```bash
npm run dev
```

Dann im Browser http://localhost:5173 öffnen.

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run dev:https` | HTTPS-Server im lokalen Netz (für WebXR auf der Quest) |
| `npm test` | Automatische Tests (Vitest), decken die Regeln der Abschnitte 3 bis 9 ab |
| `npm run build` | Typprüfung und Produktions-Build nach `dist/` |
| `npm run preview` | Produktions-Build lokal ausliefern |
| `npm run tokens` | `src/design/tokens.css` aus `src/design/tokens.ts` erzeugen |
| `npm run check` | Typprüfung und Regelprüfung (keine Emojis, keine festen Farben, alle Texte in DE und EN) |

## Auf der Meta Quest 3 spielen

1. Rechner und Quest ins selbe WLAN bringen.
2. `npm run dev:https` starten. Vite zeigt eine Netzwerkadresse an, etwa `https://192.168.1.20:5173`.
3. Diese Adresse im Quest-Browser öffnen und die Zertifikatswarnung bestätigen (selbst signiertes Zertifikat).
4. Eine Partie starten, dann im Menü „VR starten“ oder „AR starten“ wählen. Die Schaltflächen erscheinen nur, wenn der Browser die jeweilige WebXR-Sitzung unterstützt.
5. Bedienung: Zeigestrahl und Auslöser oder Pinch wählen Felder und Schaltflächen. Mit der Grifftaste greift man die Karte und kann sie verschieben und drehen, mit zwei Händen skaliert man sie. Bei Handtracking: Pinch halten und bewegen. Über das Menü am linken Handgelenk beendet man den Zug, öffnet die Forschung oder verlässt XR.

Am Desktop lässt sich XR mit einem WebXR-Emulator testen, zum Beispiel mit der Browser-Erweiterung „Immersive Web Emulator“.

## Aufbau

| Ordner | Schicht |
|---|---|
| `src/core` | Spielkern: reines TypeScript, deterministisch, Zufall nur über den Seed-Generator, Kommandos sind serialisierbar |
| `src/data/balance.ts` | Balancing-Daten: alle Zahlenwerte (siehe `BALANCING.md`) |
| `src/render` | Darstellung: Three.js-Szene, liest den Zustand und verändert ihn nie; `models/` erzeugt die Modelle prozedural |
| `src/input`, `src/game` | Eingabe: Maus, Touch und XR werden zu denselben Kommandos |
| `src/ui`, `src/design` | Oberfläche auf dem tokenbasierten Design System (Grundwerte, semantische Tokens, Komponenten-Tokens) |
| `src/ai` | KI in vier Stufen, nutzt nur die öffentliche Schnittstelle des Spielkerns |
| `src/i18n` | Sprachdateien `de.json` und `en.json` |
| `src/xr` | VR- und AR-Modus |
| `src/audio`, `src/save` | Klang (WebAudio), Speichern im `localStorage` sowie Export und Import als Datei |
| `blender/` | Blender-Skript für die Grundformen und den glTF-Export |

Weitere Dateien: `PLAN.md` (Umsetzungsplan), `ANNAHMEN.md` (Annahmen), `ASSETS.md` (Herkunft und Lizenzen), `BALANCING.md`.

---

## English

A turn-based 4X strategy game with a modern military theme in comic style. It runs entirely in the browser: on desktop, on mobile with touch in portrait mode, and on Meta Quest 3 in VR and AR mode. There are 2 to 5 fictional factions, human or AI, and a game lasts 15 to 60 minutes. Combat has no randomness, and stars are the only currency.

### Getting started

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run dev:https` | HTTPS server on the local network (WebXR on Quest) |
| `npm test` | Automated tests (Vitest) covering the rules of sections 3 to 9 |
| `npm run build` | Type check and production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run tokens` | Generate `src/design/tokens.css` from `src/design/tokens.ts` |
| `npm run check` | Type check and rule check (no emojis, no hard-coded colours, all texts in DE and EN) |

### Playing on Meta Quest 3

1. Put your computer and the Quest on the same Wi-Fi.
2. Run `npm run dev:https`. Vite prints a network address such as `https://192.168.1.20:5173`.
3. Open that address in the Quest browser and accept the certificate warning (self-signed certificate).
4. Start a game, then choose "Start VR" or "Start AR" in the menu. The buttons only appear if the browser supports that WebXR session.
5. Controls: the pointer ray with the trigger or a pinch selects tiles and buttons. The grip button grabs the map so you can move and rotate it, and two hands scale it. With hand tracking, hold the pinch and move. The menu on your left wrist ends the turn, opens research or exits XR.

On desktop you can test XR with a WebXR emulator, for example the "Immersive Web Emulator" browser extension.

### Structure

See the table above. More files: `PLAN.md` (implementation plan), `ANNAHMEN.md` (assumptions), `ASSETS.md` (sources and licences), `BALANCING.md`.
