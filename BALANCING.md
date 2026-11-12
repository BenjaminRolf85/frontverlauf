# Balancing-Datei / Balancing file

**Datei / file:** `src/data/balance.ts`. Alle Zahlenwerte der Regeln stehen nur dort. Der Regelcode in `src/core/` liest sie von dort und enthält keine eigenen Zahlen.
All rule numbers live only there; the rule code in `src/core/` reads them and contains no numbers of its own.

| Block | Inhalt / Content |
|---|---|
| `UNITS` | Preis, LP, Angriff, Verteidigung, Bewegung, Reichweite, Sicht, Fähigkeiten, Freischaltung (Schiffe: Aufrüstpreis, LP von der getragenen Einheit) / price, HP, attack, defence, movement, range, vision, abilities, unlock (ships: upgrade price, HP from carried unit) |
| `COMBAT`, `DEFENSE_BONUS` | Faktor 4,5 der Kampfformel, Flächenschaden 50 %, Boni 1,0 / 1,5 / 1,5 / 3,0 / 4,0 / combat factor 4.5, splash 50 %, bonuses |
| `HEALING`, `VETERAN`, `FUEL`, `VISION` | 4/2 LP, Veteran nach 3 (Dravon 2) Abschüssen +5 LP, Tank 4 Runden, Sichtweiten / heal amounts, veteran rule, fuel, vision |
| `START`, `INCOME`, `CITY` | 25 Startsterne, Einkommen je Stufe 5, HQ/Fabrik/Regierungsviertel +5, Logistik 5 je Feld max. 40, Botschaft 10, KI-Bonus, Wachstum n+1, Einheitenlimit Stufe+1 / start, income, growth, unit limit |
| `ECON` | Forschungskosten `(Stufe x Städte + 4) x 5`, Botschaft 25 + 25 je weitere, Außenposten 25, Erstkontakt 15 je 1000 Punkte max. 60, Kybernetik 33 % / research cost, embassy, outpost, first contact, cybernetics |
| `BUILDINGS` | Preis, Bevölkerung, Technologie, Gelände, Ressource, „einmal pro Stadt“, Nachbarschaftsboni / price, population, tech, terrain, resource, one per city, adjacency |
| `TECHS` | 25 Technologien in 5 Ästen mit Stufe und Vorgänger / 25 techs in 5 branches with tier and parent |
| `FACTIONS`, `PERKS` | Perk, 20 % Rabatt, Starttechnologie, Gewichte des Heimatgebiets / perk, 20 % discount, start tech, home region weights |
| `GRAND_PROJECTS`, `SCORE`, `MODES` | Bedingungen, Punktetabelle, 30 Runden / conditions, score table, 30 rounds |
| `BUNKER`, `MAP_TYPES`, `MAPGEN` | Bunkerbelohnungen, Landanteil je Kartentyp, Siedlungs- und Bunkerdichte / bunker rewards, land ratio per map type, densities |

Alle Preise und Einkommen sind ganze Zahlen (Faktor 5), Rabatte werden multipliziert und auf ganze Sterne aufgerundet.
All prices and incomes are integers (factor 5); discounts are multiplied and rounded up to whole stars.
Die Werte sind Startwerte für das Balancing. / The values are starting points for balancing.
