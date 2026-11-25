/**
 * Gezeichnete Einheiten: Zeichnung des Panzers / inked units: drawing of the tank.
 *
 * Plattenfugen, Nietenreihen, Schweissnaehte, Kratzer, abgeplatzter Lack, Schlamm an der Unterwanne, Kennnummer und
 * Emblem, Gitter, Russ am Auspuff: alles gezeichnet, nichts modelliert. Die Wannenfarbe kommt aus der Vertexfarbe;
 * Kennnummer und Emblem tragen die Emblemfarbe der Fraktion (in der Einfuehrung laegen sie als kleine Zellen je
 * Fraktion im gemeinsamen Atlas).
 * Panel lines, rivet rows, weld seams, scratches, chipped paint, mud on the lower hull, number and emblem, grilles,
 * soot at the exhaust: all drawn, nothing modelled. The hull colour comes from the vertex colour; number and emblem
 * emblem lie on top as decals (cells 'emblem:<faction>' and 'digits' in trim.ts); the number here is neutral paper colour.
 */
import { rng } from '../kit';
import { look, mat, type Look } from '../look';
import { arc, rrect, spline, type Cell, type Pen, type Pt } from './atlas';
import { HULL, TURRET, turretRings } from './tank';
import { BARE, hatch, MUD_DRY, MUD_WET, SOOT, stencil, STEEL, streaks, WOOD } from './trim';

// ---------- Turm / turret ----------

/** Turmwand (720 x 104): s rundum (vorn in der Mitte), t Dachkante -> Turmkranz / turret wall: s around (front in the middle), t roof edge -> ring */
function paintTurret(p: Pen, L: Look): void {
  const W = p.w, H = p.h;
  const rings = turretRings(L), y0 = rings[0].y, y1 = rings[rings.length - 1].y;
  const Y = (dy: number) => ((y0 - (TURRET.y + dy)) / (y0 - y1)) * H;
  const lower = Y(0.014);
  // Gussoberflaeche: Sprenkel / cast surface: speckle
  const R = rng(101);
  for (let i = 0; i < 900; i++) p.dab(R() * W, R() * lower, 0.6 + R() * 1.3, R() < 0.5 ? 0.82 : 1.16, 0.5);
  p.gradient(0, 0, W, 14, [0, 0], [0, 14], 1.25, 1);
  // Gussnaht rundum, Schweissnaht zum Dach / casting seam all round, weld to the roof
  p.weld([0, Y(0.05)], [W * 0.38, Y(0.05) + 1], 4.4);
  p.weld([W * 0.62, Y(0.05) + 1], [W, Y(0.05)], 4.4);
  p.panel([[0, 3], [W, 3]], 1.4, 7);
  streaks(p, 0, 4, W, lower - 10, 18, 103);
  // Nieten ueber der Unterkante und am Turmkranz / rivets above the lower edge and on the ring
  p.rivets([10, lower - 7], [W - 10, lower - 7], 34, 2.8);
  p.line([[-3, lower + 0.5], [W + 3, lower + 0.5]], 1.4, { taper: 0, wobble: 0.2 });
  p.rivets([14, lower + 9], [W - 14, lower + 9], 26, 2.6);
  for (const s of [-1, 1]) {
    const side = W / 2 + s * W * 0.25;
    // Kennnummer und Stern an der Flanke / number and star on the flank
    // Pistolenluke, Sehschlitz, Haltegriff, Hebeoese / pistol port, vision slit, grab rail, lifting eye
    const px = side - s * 86;
    p.dab(px, Y(0.044), 9, 0.8, 0.9);
    p.line(arc(px, Y(0.044), 8, 8, 0, Math.PI * 2, 14), 1.8, { closed: true, wobble: 0.15 });
    p.line([[px - 5, Y(0.044)], [px + 5, Y(0.044)]], 2, { taper: 0.1 });
    p.dab(px - 3, Y(0.044) - 3.5, 2.2, 1.5, 0.8);
    const vx = W / 2 + s * 110;
    p.fill(rrect(vx - 16, Y(0.066) - 3.5, 32, 7, 2), SOOT);
    p.panel(rrect(vx - 20, Y(0.066) - 7, 40, 14, 3).concat([[vx + 17, Y(0.066) - 7]]), 1.5);
    for (const bx of [vx - 24, vx + 24]) p.rivet(bx, Y(0.066), 2.2);
    const gx = side + s * 100;
    p.line(spline([[gx - 22, Y(0.07) + 4], [gx - 20, Y(0.07) - 3], [gx + 20, Y(0.07) - 3], [gx + 22, Y(0.07) + 4]], 6), 3, { taper: 0.05, wobble: 0.2 });
    p.crease([[gx - 18, Y(0.07) - 6], [gx + 18, Y(0.07) - 6]], 1.6, 1.6, 0.8, { taper: 0.1 });
    p.crease([[gx - 20, Y(0.07) + 6], [gx + 20, Y(0.07) + 6]], 3, 0.7, 0.6, { taper: 0.2 });
    p.line(arc(W / 2 + s * 200, 12, 5, 5, Math.PI, Math.PI * 2, 8), 2.2, { taper: 0.1 });
    // abgeplatzter Lack an Kanten, Kratzer / chipped paint at the edges, scratches
    p.chips(side - 150, lower - 16, 300, 12, 16, BARE, 109 + s, 3.2);
    p.chips(side - 150, 2, 300, 9, 12, BARE, 113 + s, 2.8);
    p.scratches(side - 150, 16, 300, lower - 40, 14, 117 + s, 26);
  }
  p.splatter(0, lower - 30, W, H - lower + 30, 16, MUD_WET, 121, { size: 2.6, alpha: 0.5 });
}

/** Turmdach (176 x 176): eben von oben, Bug oben, +x links / turret roof: planar from above, bow up, +x left */
function paintTurretTop(p: Pen): void {
  const W = p.w, R0 = 0.092;
  const X = (x: number) => (0.5 - x / (2 * R0)) * W, Z = (z: number) => (0.5 - z / (2 * R0)) * W;
  const R = rng(127);
  for (let i = 0; i < 260; i++) p.dab(R() * W, R() * W, 0.6 + R() * 1.2, R() < 0.5 ? 0.84 : 1.14, 0.5);
  // Schweissring um die Kuppel, Sockel des MG / weld ring around the cupola, MG base
  p.line(arc(X(-0.054), Z(-0.012), 47, 47, 0, Math.PI * 2, 28), 2, { closed: true, wobble: 0.3 });
  p.line(arc(X(0.06), Z(0), 15, 15, 0, Math.PI * 2, 16), 1.8, { closed: true, wobble: 0.2 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.rivet(X(0.06) + Math.cos(a) * 21, Z(0) + Math.sin(a) * 21, 2.2); }
  // Ladeluke, Luefter, Winkelspiegel / loader's hatch, ventilator, periscopes
  hatch(p, X(0.074), Z(-0.03), X(0.02) - X(0.074), Z(-0.068) - Z(-0.03), 6);
  const vx = X(0.012), vz = Z(0.04);
  p.dab(vx, vz, 11, 0.86, 0.9);
  p.line(arc(vx, vz, 11, 11, 0, Math.PI * 2, 16), 1.8, { closed: true, wobble: 0.15 });
  for (const d of [-5, 0, 5]) p.line([[vx - 7, vz + d], [vx + 7, vz + d]], 1.6, { taper: 0.15 });
  for (const x of [-0.05, 0.05]) {
    p.fill(rrect(X(x) - 9, Z(0.048) - 4, 18, 8, 2), mat.glassDark);
    p.line(rrect(X(x) - 9, Z(0.048) - 4, 18, 8, 2), 1.5, { closed: true, wobble: 0.15 });
    p.spot(X(x) - 4, Z(0.048) - 1.5, 1.6, mat.white, 0.8);
  }
  p.scratches(10, 10, W - 20, W - 20, 12, 131, 18);
  p.chips(8, 8, W - 16, W - 16, 8, BARE, 137, 2.8);
}

/** Blende (128 x 64) / mantlet (128 x 64) */
function paintMantlet(p: Pen): void {
  const W = p.w, H = p.h;
  p.line(rrect(4, 4, W - 8, H - 8, 9), 1.5, { closed: true, wobble: 0.3 });
  for (const x of [W * 0.5 - 29, W * 0.5 + 29]) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.4; p.rivet(x + Math.cos(a) * 27, H / 2 + Math.sin(a) * 27, 2.2); }
  // Zieloptik und Blenden-MG / gun sight and coaxial MG
  p.fill(rrect(W / 2 - 7, 9, 14, 8, 2), SOOT);
  p.crease(rrect(W / 2 - 9, 7, 18, 12, 3).concat([[W / 2 + 6, 7]]), 1.4, 1.8, 0.8, { taper: 0 });
  p.fill(arc(W / 2, 46, 4.5, 4.5, 0, Math.PI * 2, 10), SOOT);
  p.crease(arc(W / 2, 46, 7, 7, 0, Math.PI * 2, 12), 1.4, 1.8, 0.8, { closed: true });
  p.scratches(6, 6, W - 12, H - 12, 6, 139, 14);
}



// ---------- Wanne / hull ----------

/** Flanke (448 x 96): oben 78 % schraege Platte, darunter Schuerze / flank: top 78 % sloped plate, skirt below */
function paintHullSide(p: Pen): void {
  const W = p.w, H = p.h, K = H * 0.78;
  // drei Platten mit Fugen und Nietenreihen / three plates with joints and rivet rows
  for (const x of [W * 0.34, W * 0.67]) { p.panel([[x, 2], [x, K - 1]], 1.8); p.rivets([x + 7, 9], [x + 7, K - 8], 6, 2.4); }
  p.rivets([10, 8], [W - 10, 8], 30, 2.4);
  p.weld([4, K - 1], [W - 4, K - 1], 4.4);
  streaks(p, 0, 3, W, K - 6, 16, 151);
  // Schaufel und Brechstange in Halterungen / shovel and crowbar in brackets
  const sy = 34;
  p.band([[26, sy], [112, sy]], 5, WOOD, 1.2);
  const blade = spline([[112, sy - 9], [134, sy - 10], [146, sy], [134, sy + 10], [112, sy + 9]], 5, true);
  p.fill(blade, BARE);
  p.line(blade, 1.6, { closed: true, wobble: 0.2 });
  p.line([[118, sy], [140, sy]], 1.1, { taper: 0.3 });
  p.spot(124, sy - 4, 2.4, mat.white, 0.6);
  for (const x of [44, 92]) { p.fill(rrect(x - 3, sy - 6, 6, 12, 1.5), BARE); p.line(rrect(x - 3, sy - 6, 6, 12, 1.5), 1.2, { closed: true, wobble: 0.1 }); }
  p.band([[22, sy + 20], [130, sy + 21]], 3.4, BARE, 1.1);
  p.line(spline([[130, sy + 21], [139, sy + 19], [143, sy + 13]], 4), 3, { taper: 0.1 });
  // Abschleppseil in Schlaufen / tow cable in loops
  const cable = spline([[176, 50], [220, 60], [262, 44], [280, 58]], 8);
  p.mark(cable, 4.4, BARE, 1, { taper: 0, wobble: 0.3 });
  p.line(cable.map((q): Pt => [q[0], q[1] - 2.4]), 1, { taper: 0.02, wobble: 0.3 });
  p.line(cable.map((q): Pt => [q[0], q[1] + 2.4]), 1.1, { taper: 0.02, wobble: 0.3 });
  for (let i = 2; i < cable.length - 1; i += 2) p.line([[cable[i][0] - 1.5, cable[i][1] - 2], [cable[i][0] + 1.5, cable[i][1] + 2]], 0.9, { taper: 0, wobble: 0 });
  p.line(arc(172, 50, 6, 5, 0, Math.PI * 2, 10), 2, { closed: true, wobble: 0.1 });
  // Kennung / marking
  stencil(p, mat.paper, 'K-217', 364, 30, 22, 157);
  p.scratches(0, 12, W, K - 22, 22, 163, 30);
  p.chips(0, 1, W, 8, 26, BARE, 167, 3);
  p.chips(0, K - 12, W, 9, 20, BARE, 173, 3);
  // Schuerze: Nieten, dicker Schlamm / skirt: rivets, thick mud
  p.rivets([12, K + 6], [W - 12, K + 6], 22, 2.2);
  p.mud(0, K - 30, W, H - K + 30, MUD_WET, MUD_DRY, 179, 0.5);
}

/** Deck (312 x 336): Bug oben, +x links / deck: bow up, +x left */
function paintDeck(p: Pen): void {
  const W = p.w, H = p.h, { xd, zdf, zdr } = HULL;
  const X = (x: number) => ((xd - x) / (2 * xd)) * W, Z = (z: number) => ((zdf - z) / (zdf - zdr)) * H;
  // Fahrerluke und runde Funkerluke vor dem Turm / driver's hatch and round radio operator's hatch in front of the turret
  hatch(p, X(-0.06), Z(0.146), X(-0.15) - X(-0.06), Z(0.1) - Z(0.146), 7);
  for (const d of [-14, 14]) { const px = X(-0.105) + d; p.fill(rrect(px - 8, Z(0.153) - 3, 16, 6, 2), mat.glassDark); p.line(rrect(px - 8, Z(0.153) - 3, 16, 6, 2), 1.3, { closed: true, wobble: 0.1 }); }
  const rx = X(0.11), rz = Z(0.122);
  p.dab(rx, rz, 21, 0.9, 0.8);
  p.panel(arc(rx, rz, 21, 21, 0, Math.PI * 2, 22), 1.9);
  p.line(spline([[rx - 8, rz + 3], [rx, rz - 4], [rx + 8, rz + 3]], 5), 2.4, { taper: 0.15 });
  // Bolzenkranz um den Turm / bolt circle around the turret
  const tz = Z(TURRET.z);
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; p.rivet(W / 2 + Math.cos(a) * 143, tz + Math.sin(a) * 133, 2.4); }
  p.panel(arc(W / 2, tz, 150, 140, 0, Math.PI * 2, 40), 1.6);
  // Motorraum: Lamellengitter, Wartungsdeckel, Tankstutzen / engine bay: louvre grille, service lid, filler caps
  const gy = Z(-0.118), gh = H - gy - 8;
  for (const s of [-1, 1]) {
    const gx = W / 2 + s * 78 - 50;
    p.fill(rrect(gx, gy, 100, gh, 3), SOOT, 0.92);
    for (let y = gy + 4; y < gy + gh - 2; y += 6) p.crease([[gx + 3, y], [gx + 97, y]], 1.8, 1.9, 0.9, { taper: 0, wobble: 0 });
    p.panel(rrect(gx - 3, gy - 3, 106, gh + 6, 4).concat([[gx + 100, gy - 3]]), 1.7);
    for (const cx of [gx - 3, gx + 103]) for (const cy of [gy - 3, gy + gh + 3]) p.rivet(cx, cy, 2.2);
  }
  p.panel([[W / 2, gy - 8], [W / 2, H - 2]], 1.6);
  p.panel([[4, gy - 12], [W - 4, gy - 12]], 1.6);
  p.rivets([10, gy - 19], [W - 10, gy - 19], 16, 2.3);
  for (const x of [18, W - 18]) { p.dab(x, gy - 34, 8, 0.82, 0.9); p.line(arc(x, gy - 34, 8, 8, 0, Math.PI * 2, 12), 1.7, { closed: true, wobble: 0.15 }); p.line([[x - 4, gy - 34], [x + 4, gy - 34]], 1.6, { taper: 0.1 }); }
  // Russ hinter den Auspuffen, Schlamm von den Stiefeln / soot behind the exhausts, mud from boots
  for (const x of [X(0.158), X(-0.158)]) p.splatter(x - 18, Z(-0.168) - 26, 36, 26, 16, SOOT, 191, { size: 5, alpha: 0.5, rise: 1 });
  p.splatter(0, 0, W, Z(0.09), 12, MUD_WET, 193, { size: 3, alpha: 0.5, rise: 1 });
  p.scratches(0, 0, W, Z(0.09), 12, 197, 22);
  p.chips(0, 0, W, 8, 14, BARE, 199, 3);
  p.weld([3, 3], [W - 3, 3], 4);
}

/** Bugplatte (400 x 88): von vorn, Deckkante oben / glacis: from the front, deck edge at the top */
function paintGlacis(p: Pen): void {
  const W = p.w, H = p.h, { xb } = HULL;
  const X = (x: number) => ((x + xb) / (2 * xb)) * W;
  p.weld([X(-0.184), 3], [X(0.184), 3], 4.2);
  // Ersatzkettenglieder in der Mitte / spare track links in the centre
  for (let i = 0; i < 4; i++) {
    const x = W / 2 - 62 + i * 31, y = 30;
    p.fill(rrect(x, y, 28, 30, 3), mat.dark);
    p.line(rrect(x, y, 28, 30, 3), 1.6, { closed: true, wobble: 0.2 });
    for (const dy of [7, 23]) p.crease([[x + 4, y + dy], [x + 24, y + dy]], 4, 1.9, 0.8, { taper: 0, wobble: 0 });
    for (const dx of [5, 23]) p.spot(x + dx, y + 15, 1.8, STEEL);
  }
  p.band([[W / 2 - 68, 26], [W / 2 + 68, 26]], 3.4, BARE, 1);
  for (const s of [-1, 1]) {
    // Abschleppoesen, Nieten, Sehschlitz des Fahrers / tow eyes, rivets, driver's vision slit
    const tx = W / 2 + s * 150;
    p.line(arc(tx, H - 20, 9, 11, 0, Math.PI * 2, 14), 4, { closed: true, wobble: 0.15 });
    p.crease(arc(tx - 1, H - 21, 9, 11, Math.PI, Math.PI * 1.7, 6), 1.4, 1.9, 0.8, { taper: 0.2 });
    p.rivets([W / 2 + s * 96, 12], [W / 2 + s * 108, H - 10], 5, 2.4);
  }
  const vx = X(-0.105);
  p.fill(rrect(vx - 20, 34, 40, 8, 2), SOOT);
  p.panel(rrect(vx - 26, 27, 52, 22, 4).concat([[vx + 22, 27]]), 1.7);
  for (const bx of [vx - 31, vx + 31]) p.rivet(bx, 38, 2.2);
  // Schweissring um die Kugelblende / weld ring around the ball mount
  p.line(arc(X(0.1), 30, 19, 21, 0, Math.PI * 2, 18), 1.9, { closed: true, wobble: 0.25 });
  streaks(p, 0, 4, W, H * 0.6, 10, 211);
  p.scratches(0, 8, W, H - 30, 16, 223, 26);
  p.chips(0, 0, W, 8, 22, BARE, 227, 3);
  p.chips(0, H - 10, W, 8, 22, BARE, 229, 3);
  p.mud(0, H * 0.4, W, H * 0.6, MUD_WET, MUD_DRY, 233, 0.34);
}

/** Heckplatte (400 x 88) / rear plate (400 x 88) */
function paintRear(p: Pen): void {
  const W = p.w, H = p.h;
  p.weld([30, 3], [W - 30, 3], 4.2);
  // Wartungsklappe mit Bolzen, Schlusslicht / access plate with bolts, tail light
  const plate = rrect(W / 2 - 62, 26, 124, 44, 8);
  p.shade(plate, 0.9, 0.8);
  p.panel(plate.concat([[W / 2 + 54, 26]]), 1.8);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; p.rivet(W / 2 + Math.cos(a) * 52, 48 + Math.sin(a) * 15, 2.2); }
  p.spot(W / 2 + 150, 30, 5, mat.red);
  p.line(arc(W / 2 + 150, 30, 5.5, 5.5, 0, Math.PI * 2, 12), 1.5, { closed: true, wobble: 0.1 });
  for (const s of [-1, 1]) {
    p.line(arc(W / 2 + s * 120, H - 22, 8, 10, 0, Math.PI * 2, 14), 3.6, { closed: true, wobble: 0.15 });
    // Russfahnen unter den Auspuffen / soot plumes below the exhausts
    const ex = W / 2 + s * 133;
    p.gradient(ex - 18, 0, 36, 60, [0, 0], [0, 60], 0.4, 1, 0.8);
    p.splatter(ex - 20, 0, 40, 64, 20, SOOT, 241 + s, { size: 5, alpha: 0.55, rise: 0.6 });
  }
  p.rivets([12, 12], [W - 12, 12], 18, 2.3);
  p.chips(0, 0, W, 8, 20, BARE, 251, 3);
  p.mud(0, H * 0.4, W, H * 0.6, MUD_WET, MUD_DRY, 257, 0.38);
}

/** Schuerze vorn / hinten und Unterwanne (192 x 32) / skirt front / rear and lower hull (192 x 32) */
function paintNoseStrip(p: Pen): void {
  const W = p.w, H = p.h;
  p.rivets([8, H * 0.72], [W - 8, H * 0.72], 14, 2);
  p.mud(0, 0, W, H, MUD_WET, MUD_DRY, 269, 0.4);
}

// ---------- Laufwerk / running gear ----------









/** Eigene Zellen des Korvat-Panzers; alles andere kommt aus dem Fahrzeug-Baukasten (trim.ts) / the Korvat tank's own cells; everything else comes from the vehicle kit (trim.ts) */
export function tankCells(): Cell[] {
  const L = look('korvat');
  return [
    { name: 'turret', w: 720, h: 104, paint: (p) => paintTurret(p, L) },
    { name: 'turretTop', w: 176, h: 176, paint: paintTurretTop },
    { name: 'mantlet', w: 128, h: 64, paint: paintMantlet },
    { name: 'hullSide', w: 448, h: 96, paint: paintHullSide },
    { name: 'deck', w: 312, h: 336, paint: paintDeck },
    { name: 'glacis', w: 400, h: 88, paint: paintGlacis },
    { name: 'rear', w: 400, h: 88, paint: paintRear },
    { name: 'hullNose', w: 192, h: 32, paint: paintNoseStrip },
  ];
}
