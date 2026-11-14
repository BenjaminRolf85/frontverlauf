# Balancing-Datei / Balancing file

**Datei / file:** `src/data/balance.ts`. Alle Zahlenwerte der Regeln stehen nur dort. Der Regelcode in `src/core/` liest sie von dort und enthält keine eigenen Zahlen.
All rule numbers live only there; the rule code in `src/core/` reads them and contains no numbers of its own.

| Block | Inhalt / Content |
|---|---|
| `UNITS` | Preis, LP, Angriff, Verteidigung, Bewegung, Reichweite, Sicht, Fähigkeiten, Freischaltung (Schiffe: Aufrüstpreis, LP von der getragenen Einheit) / price, HP, attack, defence, movement, range, vision, abilities, unlock (ships: upgrade price, HP from carried unit) |
| `COMBAT`, `DEFENSE_BONUS` | Faktor 4,5 der Kampfformel, Flächenschaden 50 %, Boni 1,0 / 1,5 / 1,5 / 3,0 / 4,0 / combat factor 4.5, splash 50 %, bonuses |
| `HEALING`, `VETERAN`, `FUEL`, `VISION` | 4/2 LP, Veteran nach 3 (Dravon 2) Abschüssen +5 LP, Tank 4 Runden, Sichtweiten / heal amounts, veteran rule, fuel, vision |
| `START`, `INCOME`, `CITY` | 25 Startsterne, Einkommen je Stufe 3, HQ/Fabrik/Regierungsviertel +4, Logistik 3 je Feld max. 24, Botschaft 6, Sold: 4 Einheiten frei, dann 30 % des Preises, Panzer 12, KI-Bonus, Wachstum n+1, Einheitenlimit Stufe+1 / start, income, growth, unit limit |
| `ECON` | Forschungskosten `(Stufe x Städte + 4) x 5`, Botschaft 25 + 25 je weitere, Außenposten 25, Erstkontakt 15 je 1000 Punkte max. 60, Kybernetik 33 % / research cost, embassy, outpost, first contact, cybernetics |
| `BUILDINGS` | Preis, Bevölkerung, Technologie, Gelände, Ressource, „einmal pro Stadt“, Nachbarschaftsboni / price, population, tech, terrain, resource, one per city, adjacency |
| `TECHS` | 25 Technologien in 5 Ästen mit Stufe und Vorgänger / 25 techs in 5 branches with tier and parent |
| `FACTIONS`, `PERKS` | Perk, 20 % Rabatt, Starttechnologie, Gewichte des Heimatgebiets / perk, 20 % discount, start tech, home region weights |
| `FACTIONS.perk2`, `PERKS2` | Zweites Merkmal je Fraktion: Außenposten 15 (Korvat), Veteranen +0,5 Angriff (Dravon), +1 Heilung (Alvenia), Landungsboote +1 Bewegung (Meridon), Panzersperre 5 (Velkar), +1 Heilung im Wald (Zyrr), 3 Sterne je Gefallenem (Vesper), +1 Sicht (NEXUS) / second trait per faction |
| `UNIQUE`, `UNIQUE_UNITS`, `UNIQUE_BUILDINGS` | Einzigartige Einheit und einzigartiges Gebäude je klassischer Fraktion: Selbstheilung 2 LP, Kaperbeute 10 Sterne, Kolchose +1 Bevölkerung alle 5 Runden, Botschaftspalast 4 Sterne je Frieden, Handelskontor 3 Sterne je verbundener Hafenstadt, Versuchslabor 5 % Forschungsrabatt (max. 3) / unique unit and building per classic faction |
| `GRAND_PROJECTS`, `SCORE`, `MODES` | Bedingungen, Punktetabelle, 30 Runden / conditions, score table, 30 rounds |
| `COUNTER`, `UNITS.bonusVs` | Konter: Fahrzeugliste, Schadensfaktoren gegen Fahrzeuge/Flieger/Fußtruppen, Flakzone 3 Schaden, Mine 10 Sterne, 6/15 Schaden, max. 8 je Fraktion / counters: vehicle list, damage factors vs vehicles/flyers/foot, flak zone 3 damage, mine 10 stars, 6/15 damage, max 8 per faction |
| `BUNKER`, `MAP_TYPES`, `MAPGEN` | Bunkerbelohnungen, Landanteil je Kartentyp, Siedlungs- und Bunkerdichte / bunker rewards, land ratio per map type, densities |

Alle Preise und Einkommen sind ganze Zahlen (Faktor 5), Rabatte werden multipliziert und auf ganze Sterne aufgerundet.
All prices and incomes are integers (factor 5); discounts are multiplied and rounded up to whole stars.
Die Werte sind Startwerte für das Balancing. / The values are starting points for balancing.
