// ============================================================================
//  Centrul Vechi (Bucharest Old Town): Strada Lipscani with Cărturești Carusel
//  (enterable: the white six-level atrium, 2015 refit of an 1860s bank),
//  Hanul lui Manuc (1808 caravanserai: whitewashed walls, dark timber eaves,
//  wooden galleries round the courtyard), the Curtea Veche ruins + Vlad Țepeș
//  bust + the 1559 church (spot `old-town-lipscani`); Stavropoleos church
//  (1724: carved porch with lobed arches, painted saint medallions, tiled
//  tower), Caru' cu Bere, CEC Palace and the National History Museum on Calea
//  Victoriei (spot `stavropoleos-cec`). Shared-surface cobbles, terraces with
//  awnings in front of every bar, cast-iron lanterns, shop signs from OSM.
//  No photo textures (no freedom of panorama in Romania): all modelled.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, centroid, polyBox, inPoly, offsetPolyline, canvas, canvasTexture, fitDraw, obb, polyArea } from '../kit.js';
import { bucBackdrop, classicFacade, classicWalls, balustradeMaterial, palisade, osmPoly, cityFiller, placeLandmark, signAtlas, oldTownTerraces, floodlight } from '../buc.js';
import { wallGeometry } from '../osm.js';

function simplify(pts, tol) { if (pts.length < 4) return pts; const dist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / L; }; let md = 0, mi = 0; for (let i = 1; i < pts.length - 1; i++) { const dd = dist(pts[i], pts[0], pts[pts.length - 1]); if (dd > md) { md = dd; mi = i; } } if (md <= tol) return [pts[0], pts[pts.length - 1]]; return [...simplify(pts.slice(0, mi + 1), tol).slice(0, -1), ...simplify(pts.slice(mi), tol)]; }
const simplifyRing = (p, tol) => { const s2 = simplify([...p, p[0]], tol); s2.pop(); return s2.length >= 3 ? s2 : p; };
function grow(poly, d) { const cw = polyArea(poly) > 0; const o = offsetPolyline([...poly, poly[0], poly[1]], cw ? -d : d); return o.slice(1, poly.length + 1); }
const wallSeg = (ctx, ax, az, bx, bz, y0, y1) => ctx.collider({ wall: true, ax, az, bx, bz, y0a: y0, y1a: y1, y0b: y0, y1b: y1, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.5 });
/** walls of a closed ring as wall colliders, leaving `gaps` [{x, z, w}] open */
function ringWalls(ctx, poly, y0, y1, gaps = []) {
    for (let i = 0; i < poly.length; i++) {
        const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        let segs = [[0, 1]];
        for (const g of gaps) { const t = ((g.x - ax) * (bx - ax) + (g.z - az) * (bz - az)) / (L * L), dd = Math.abs((g.x - ax) * (bz - az) - (g.z - az) * (bx - ax)) / L; if (t < 0 || t > 1 || dd > 2) continue; const h = g.w / 2 / L; segs = segs.flatMap(([s, e]) => (t + h <= s || t - h >= e ? [[s, e]] : [[s, Math.max(s, t - h)], [Math.min(e, t + h), e]].filter(([p, q]) => q - p > 0.02))); }
        for (const [s, e] of segs) wallSeg(ctx, ax + (bx - ax) * s, az + (bz - az) * s, ax + (bx - ax) * e, az + (bz - az) * e, y0, y1);
    }
}

// ---------------------------------------------------------------------------- Cărturești Carusel (Lipscani 55)
// OSM way 658009149: 27.4 × 13.4 m, the narrow front faces Lipscani (south). Street front: rusticated white stucco, a giant
// arch over two storeys filled with a three-light arched window, the "cărturești" band over the shop window, an attic
// aedicule with urn finials and the glass mansard roof. Inside: six white levels round an oval atrium with undulating
// balustrades, bookshelves on every wall, the bistro on the top floor (levels reached with E at the stair).
function buildCarusel(ctx) {
    const d = ctx.data, g = ctx.ground, bd = d.buildings.find((x) => x.id === 'w658009149'); if (!bd) return null;
    ctx.skipBuildings.add(bd.id);
    const p = bd.poly, o = obb(p), y0 = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) + 0.05;
    // front edge = the edge facing Lipscani (largest z)
    let fi = 0, fz = -1e9; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length], mz = (p[i][1] + q[1]) / 2; if (mz > fz && Math.hypot(q[0] - p[i][0], q[1] - p[i][1]) > 8) { fz = mz; fi = i; } }
    const A = p[fi], B = p[(fi + 1) % p.length], fx = (A[0] + B[0]) / 2, fzz = (A[1] + B[1]) / 2, FW = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const ux = (B[0] - A[0]) / FW, uz = (B[1] - A[1]) / FW; let nx = uz, nz = -ux; if (nz < 0) { nx = -nx; nz = -nz; } // outward normal (toward the street)
    const yaw = Math.atan2(nx, nz), H = 19.5, b = new GeoBatch(), WH = '#e9e2d2';
    const fac = classicFacade('carusel-side', [{ t: 'blank', rustic: true }, { t: 'rect', w: 0.3 }, { t: 'rect', w: 0.3 }, { t: 'small', w: 0.26 }], { bay: 3.4, floor: 4.9, lit: 0.5 });
    classicWalls(b, fac, p, y0, y0 + H, WH, y0);
    // the street front: a canvas elevation (no photo): rustication, giant arch with 3 arched lights, sign band, door
    const fc = canvas(512, 768), x = fc.getContext('2d'), S = 512 / FW, PX = (m) => m * S, PY = (m) => 768 - m * (768 / (H + 0.5));
    x.fillStyle = '#ebe5d8'; x.fillRect(0, 0, 512, 768);
    x.fillStyle = 'rgba(80,70,55,0.18)'; for (let yy = PY(H); yy < 768; yy += 9) x.fillRect(0, yy, 512, 1.6); // rustication
    // giant arch (2 storeys), moulded archivolt with beads
    const ax0 = PX(1.6), ax1 = PX(FW - 1.6), aTop = PY(14.2), aw = ax1 - ax0;
    x.fillStyle = '#e2dccd'; x.beginPath(); x.moveTo(ax0 - 18, PY(0.4)); x.lineTo(ax0 - 18, aTop + aw / 2 * 0.62); x.quadraticCurveTo(256, aTop - 46, ax1 + 18, aTop + aw / 2 * 0.62); x.lineTo(ax1 + 18, PY(0.4)); x.fill();
    x.strokeStyle = 'rgba(120,108,88,0.6)'; x.lineWidth = 3; x.stroke();
    for (let i = 0; i < 26; i++) { const t = i / 25, px = ax0 - 9 + (aw + 18) * t, py = aTop + aw / 2 * 0.62 - Math.sin(t * Math.PI) * (aw * 0.31 + 23); x.fillStyle = '#d6cfbf'; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); }
    x.fillStyle = '#b9b29f'; x.fillRect(ax0, aTop + 30, aw, PY(0.4) - aTop - 30); // grey frame
    const gl = (gx, gy, gw, gh) => { const gr = x.createLinearGradient(0, gy, 0, gy + gh); gr.addColorStop(0, '#9fb3bf'); gr.addColorStop(1, '#46525a'); x.fillStyle = gr; x.beginPath(); x.moveTo(gx, gy + gh); x.lineTo(gx, gy + gw / 2); x.arc(gx + gw / 2, gy + gw / 2, gw / 2, Math.PI, 0); x.lineTo(gx + gw, gy + gh); x.fill(); x.fillStyle = 'rgba(70,72,70,0.9)'; x.fillRect(gx, gy + gh * 0.55, gw, 3); };
    gl(ax0 + aw * 0.05, PY(12.6), aw * 0.36, PY(6.4) - PY(12.6)); gl(ax0 + aw * 0.44, PY(12.0), aw * 0.12, PY(6.4) - PY(12.0)); gl(ax0 + aw * 0.59, PY(12.6), aw * 0.36, PY(6.4) - PY(12.6));
    x.fillStyle = '#f7f6f2'; x.fillRect(ax0 + aw * 0.02, PY(6.3), aw * 0.96, PY(5.0) - PY(6.3)); // sign band
    fitDraw(x, 'cărturești', ax0 + aw * 0.06, PY(6.25), aw * 0.6, (PY(5.45) - PY(6.25)), { font: (q) => `500 ${q}px "Courier New", monospace`, color: '#2f6b3a', align: 'left' });
    fitDraw(x, 'carte, ceai, muzică, dichis', ax0 + aw * 0.06, PY(5.5), aw * 0.6, (PY(5.05) - PY(5.5)), { font: (q) => `500 ${q}px "Courier New", monospace`, color: '#333', align: 'left' });
    x.fillStyle = '#3d8b3d'; x.fillRect(ax0 + aw * 0.78, PY(6.2), aw * 0.1, PY(5.1) - PY(6.2));
    gl(ax0 + aw * 0.04, PY(4.9), aw * 0.36, PY(0.5) - PY(4.9)); gl(ax0 + aw * 0.6, PY(4.9), aw * 0.36, PY(0.5) - PY(4.9));
    x.fillStyle = '#2a2a28'; x.fillRect(ax0 + aw * 0.44, PY(4.0), aw * 0.12, PY(0.4) - PY(4.0)); // door
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.arc(256, aTop - 4, 22, 0, 7); x.fill(); x.fillStyle = '#8a3a2a'; x.fillRect(244, aTop - 2, 24, 8); // cartouche
    x.fillStyle = 'rgba(90,80,65,0.5)'; x.fillRect(0, PY(H - 0.4), 512, 6); // cornice shadow
    const ft = canvasTexture(fc);
    const fm = new THREE.MeshStandardMaterial({ map: ft, roughness: 0.75, emissive: new THREE.Color('#ffe7c2'), emissiveMap: ft, emissiveIntensity: 0 }); fm.userData.dayGlow = 0; fm.userData.nightGlow = 0.45;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(FW, H + 0.5), fm); front.position.set(fx + nx * 0.06, y0 + (H + 0.5) / 2, fzz + nz * 0.06); front.rotation.y = yaw; front.name = 'carusel-front'; ctx.add(front);
    // cornice, attic aedicule with urns, glass mansard
    b.box(fx + nx * 0.3, y0 + H - 0.2, fzz + nz * 0.3, 0.9, 0.9, FW + 0.6, '#f1ece2', 'stone', yaw + Math.PI / 2);
    b.box(fx - nx * 0.6, y0 + H + 0.7, fzz - nz * 0.6, 1.2, 5.6, 4.2, WH, 'stone', yaw + Math.PI / 2);
    b.add(new THREE.ConeGeometry(2.9, 1.6, 3), 'stone', M(fx - nx * 0.2, y0 + H + 7.1, fzz - nz * 0.2, 0, yaw, Math.PI / 2, 1, 1, 0.45), '#f1ece2');
    for (const s of [-1, 1]) { const qx = fx + ux * s * (FW / 2 - 0.6), qz = fzz + uz * s * (FW / 2 - 0.6); b.box(qx, y0 + H + 0.7, qz, 1, 1.4, 1, WH, 'stone'); b.sphere(qx, y0 + H + 2.6, qz, 0.5, 0.7, 0.5, '#efe9dc', 'stone', 10, 8); }
    b.sphere(fx - nx * 0.3, y0 + H + 8.3, fzz - nz * 0.3, 0.45, 0.6, 0.45, '#efe9dc', 'stone', 10, 8);
    const roofP = grow(p, -0.3), oc = o;
    b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.7, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4), 'darkglass', M(oc.cx, y0 + H + 2.3, oc.cz, 0, -oc.angle, 0, oc.len - 0.6, 4.6, oc.wid - 0.6), '#3b4148');
    void roofP;
    // ---- interior: levels, atrium, balustrades, shelves
    const LV = [0, 4.6, 8.4, 12.2, 16.0], innerP = grow(p, -0.35), ecx = oc.cx + (fx - oc.cx) * 0.08, ecz = oc.cz + (fzz - oc.cz) * 0.08;
    const along = Math.atan2(oc.ux, oc.uz); // long axis direction
    const ell = (k, rxK = 1) => { const pts = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, wob = 1 + 0.07 * Math.sin(a * 5 + k * 1.3), rx = (3.1 - k * 0.1) * wob * rxK, rz = (8.2 - k * 0.35) * wob * rxK; const lx = Math.cos(a) * rx, lz = Math.sin(a) * rz; pts.push([ecx + lx * Math.cos(along) + lz * Math.sin(along), ecz - lx * Math.sin(along) + lz * Math.cos(along)]); } return pts; };
    const iw = new GeoBatch(), WHITE = '#f6f5f1';
    const shelf = (() => { const c = canvas(256, 256), q = c.getContext('2d'); q.fillStyle = '#f2f0ea'; q.fillRect(0, 0, 256, 256); const r = rng(5); for (let row = 0; row < 4; row++) { const y = row * 64; q.fillStyle = '#e6e3db'; q.fillRect(0, y + 56, 256, 8); for (let xx = 2; xx < 254;) { const w = 3 + r() * 6, h = 34 + r() * 18; q.fillStyle = `hsl(${r() * 360},${30 + r() * 40}%,${30 + r() * 40}%)`; q.fillRect(xx, y + 56 - h, w, h); xx += w + 0.6; } } const t = canvasTexture(c, { repeat: true }); const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 0.22 }); return m; })();
    const shelves = new GeoBatch();
    for (let k = 0; k < LV.length; k++) {
        const ly = y0 + LV[k];
        if (k > 0) { // slab with the atrium hole (white, slightly self-lit so the interior reads bright)
            const sh = new THREE.Shape(innerP.map(([a, c]) => new THREE.Vector2(a, -c))); sh.holes.push(new THREE.Path(ell(k).map(([a, c]) => new THREE.Vector2(a, -c))));
            const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.38, bevelEnabled: false, curveSegments: 4 }); sg.rotateX(-Math.PI / 2); sg.translate(0, ly - 0.38, 0);
            iw.add(sg, 'paint', null, WHITE, { emissive: '#ffffff', emissiveIntensity: 0.28, roughness: 0.5 }); sg.dispose();
            // undulating balustrade round the hole + walk surface + wall collider at this level
            const e = ell(k), pos = [], idx = [];
            for (let i = 0; i <= e.length; i++) { const [a, c] = e[i % e.length], hh = 1.05 + 0.12 * Math.sin(i / e.length * Math.PI * 10 + k); pos.push(a, ly - 0.38, c, a, ly + hh, c); if (i) { const j = (i - 1) * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); } }
            const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
            iw.add(bg, 'paint', null, '#fbfaf7', { emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.4, side: THREE.DoubleSide }); bg.dispose();
            for (let i = 0; i < e.length; i++) { const [a, c] = e[i], [a2, c2] = e[(i + 1) % e.length]; wallSeg(ctx, a, c, a2, c2, ly - 0.2, ly + 1.1); }
            const holeE = ell(k);
            g.surfaces.push({ kind: 'carusel', x: oc.cx, z: oc.cz, r: oc.len / 2 + 2, bottom: ly - 0.6, contains: (px, pz) => inPoly(px, pz, innerP) && !inPoly(px, pz, holeE), top: () => ly });
        }
        // shelves along the long walls (not across the front)
        for (let i = 0; i < innerP.length; i++) { const [ax, az] = innerP[i], [bx, bz] = innerP[(i + 1) % innerP.length], L = Math.hypot(bx - ax, bz - az); if (L < 6) continue; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (Math.hypot(mx - fx, mz - fzz) < 3) continue; const a = Math.atan2(bx - ax, bz - az); shelves.box(mx, ly, mz, 0.4, 3.1, L - 0.8, '#ffffff', 'shelf', a); }
    }
    // ground floor tables of books + the white stair (E: up / down a level)
    const r = rng(8);
    for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6 - 0.5, px = oc.cx + oc.ux * t * oc.len * 0.6, pz = oc.cz + oc.uz * t * oc.len * 0.6; iw.box(px + (r() - 0.5), y0, pz, 1.3, 0.8, 0.8, '#d8d2c4', 'wood', along); ctx.box(px, pz, 0.7, 0.45, along, { prop: true, h: 0.8 }); }
    const stair = { x: oc.cx - oc.ux * oc.len * 0.38, z: oc.cz - oc.uz * oc.len * 0.38 };
    for (let k = 0; k < LV.length - 1; k++) for (let s = 0; s < 10; s++) { const a = s / 10 * Math.PI + k * Math.PI, rr = 1.7; iw.box(stair.x + Math.cos(a) * rr, y0 + LV[k] + (LV[k + 1] - LV[k]) * s / 10, stair.z + Math.sin(a) * rr, 1.2, 0.18, 0.5, WHITE, 'paint', -a); }
    // walls (enter through the shop door): wall colliders round the outline with a door gap on the front
    ringWalls(ctx, p, y0 - 1, y0 + H + 6, [{ x: fx, z: fzz, w: 3.2 }]);
    ctx.extras.caruselFloor = () => ctx.painter.poly(innerP, '#ebe8e1', 'slab');
    ctx.add(iw.build('carusel-interior', { castShadow: false }));
    ctx.add(shelves.build('carusel-shelves', { castShadow: false, matOverrides: { shelf } }));
    ctx.add(b.build('carusel', { matOverrides: { [fac.key]: fac.mat } }));
    for (let k = 0; k < LV.length; k++) ctx.lampPoints.push({ x: ecx, z: ecz, h: LV[k] + 3.6 - (ctx.ground.heightAt(ecx, ecz) - y0), noPost: true });
    // stairs: E to go up / down (the levels are walkable)
    const lvOf = (yy) => LV.reduce((bi, L, i) => (Math.abs(y0 + L - yy) < Math.abs(y0 + LV[bi] - yy) ? i : bi), 0);
    ctx.interactables.push({ x: stair.x, z: stair.z, r: 2.6, y: undefined, label: (s) => { const k = lvOf(s.position.y); return k < LV.length - 1 ? `Climb to level ${k + 1}${k + 1 === LV.length - 1 ? ' (bistro)' : ''}` : 'Go down to the ground floor'; },
        use: (s) => { const k = lvOf(s.position.y), to = k < LV.length - 1 ? k + 1 : 0, px = stair.x + (ecx - stair.x) * 0.15, pz = stair.z + (ecz - stair.z) * 0.15; s.ctl.y = y0 + LV[to]; s.ctl.teleport(px, pz, s.ctl.heading); s.sound.play('step', 0.5); if (to === LV.length - 1) s.ui.toast('☕ Bistro', 'Top floor of Cărturești Carusel.'); } });
    return { front: { x: fx, z: fzz, nx, nz, yaw }, y0, LV, ecx, ecz, along, stair };
}

// ---------------------------------------------------------------------------- Hanul lui Manuc
function buildManuc(ctx) {
    const d = ctx.data, g = ctx.ground, bd = d.buildings.find((x) => x.id === 'r19803024'); if (!bd) return null;
    ctx.skipBuildings.add(bd.id);
    const outer = bd.poly, hole = bd.holes?.[0] || null, y0 = Math.min(...outer.map(([x, z]) => g.heightAt(x, z))) - 0.2, H = 9.2;
    const fac = classicFacade('manuc', [{ t: 'rect', w: 0.28, top: 0.3, bottom: 0.2, cornice: false }, { t: 'rect', w: 0.3, top: 0.22, cornice: false }, { t: 'rect', w: 0.28, cornice: false }, { t: 'rect', w: 0.3, cornice: false }], { bay: 3.4, floor: 4.6, lit: 0.6 });
    const b = new GeoBatch(), WALL = '#f2efe7', WOOD = '#3b2a1e';
    classicWalls(b, fac, outer, y0, y0 + H, WALL, y0);
    if (hole) classicWalls(b, fac, [...hole].reverse(), y0, y0 + H, WALL, y0);
    // deep dark timber eave + roof (ring roof: two slopes to a ridge between the outer wall and the courtyard)
    const eo = grow(outer, 1.3); b.prism(eo, y0 + H - 0.1, y0 + H + 0.35, WOOD, 'wood', { noTop: true, bottom: true });
    if (hole) { const ei = grow(hole, -1.3); b.prism(hole, y0 + H - 0.1, y0 + H + 0.35, WOOD, 'wood', { noTop: true }); void ei; }
    const so = simplifyRing(outer, 2.5), eoS = grow(so, 1.3), ridgeO = grow(so, -5.8), roofCol = '#6b5a4c';
    const strip = (A, Bp, ya, yb) => { for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; b.quad([A[i][0], ya, A[i][1]], [A[j][0], ya, A[j][1]], [Bp[j][0], yb, Bp[j][1]], [Bp[i][0], yb, Bp[i][1]], roofCol, 'roofs'); b.quad([A[j][0], ya, A[j][1]], [A[i][0], ya, A[i][1]], [Bp[i][0], yb, Bp[i][1]], [Bp[j][0], yb, Bp[j][1]], roofCol, 'roofs'); } };
    strip(eoS, ridgeO, y0 + H + 0.35, y0 + H + 4.2);
    if (hole) { const sh = simplifyRing(hole, 2.5), hi = grow(sh, -1.4), ridgeI = grow(sh, 5.8); strip(hi, ridgeI, y0 + H + 0.35, y0 + H + 4.2); }
    // courtyard galleries: wooden posts + upper balustrade round the courtyard
    if (hole) { const gi = grow(hole, -2.2); for (let i = 0; i < gi.length; i++) { const [ax, az] = gi[i], [bx, bz] = gi[(i + 1) % gi.length], L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.round(L / 2.8)); for (let k = 0; k < n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; b.box(x, y0, z, 0.24, H, 0.24, WOOD, 'wood'); ctx.circle(x, z, 0.16, 3); } b.rod([ax, y0 + 4.6 + 1.0, az], [bx, y0 + 4.6 + 1.0, bz], 0.06, WOOD, 'wood', 4); b.rod([ax, y0 + 4.6, az], [bx, y0 + 4.6, bz], 0.18, WOOD, 'wood', 4); for (let k = 0; k <= n * 4; k++) { const t = k / (n * 4); b.box(ax + (bx - ax) * t, y0 + 4.6, az + (bz - az) * t, 0.05, 1.0, 0.05, WOOD, 'wood'); } } }
    // the gate on Str. Franceză (north wing) + "HANUL MANUC" letters
    // the gate: on the outer wall edge nearest Str. Franceză at x ≈ 200 (north wing), passage straight through to the courtyard
    let gate = { x: 199.5, z: 167.5 }, gn = { x: 0, z: -1 }, bestD = 1e9;
    for (let i = 0; i < outer.length; i++) { const [ax, az] = outer[i], [bx, bz] = outer[(i + 1) % outer.length], L = Math.hypot(bx - ax, bz - az); if (L < 4) continue; const t = Math.max(0.1, Math.min(0.9, ((200 - ax) * (bx - ax) + (150 - az) * (bz - az)) / (L * L))), px = ax + (bx - ax) * t, pz = az + (bz - az) * t, dd = Math.hypot(px - 200, pz - 150); if (dd < bestD) { bestD = dd; gate = { x: px, z: pz }; gn = { x: (bz - az) / L, z: -(bx - ax) / L }; if (gn.z > 0) { gn.x = -gn.x; gn.z = -gn.z; } } }
    const gate2 = { x: gate.x - gn.x * 17, z: gate.z - gn.z * 17 }, gyaw = Math.atan2(gn.x, gn.z);
    { // the arched gateway (dark passage), timber doors folded back
        const gc = canvas(256, 256), gx = gc.getContext('2d'); gx.fillStyle = '#f2efe7'; gx.fillRect(0, 0, 256, 256); gx.fillStyle = '#d9d2c2'; gx.beginPath(); gx.moveTo(40, 256); gx.lineTo(40, 90); gx.arc(128, 90, 88, Math.PI, 0); gx.lineTo(216, 256); gx.fill(); gx.fillStyle = '#1e1813'; gx.beginPath(); gx.moveTo(56, 256); gx.lineTo(56, 96); gx.arc(128, 96, 72, Math.PI, 0); gx.lineTo(200, 256); gx.fill();
        const gm = new THREE.MeshStandardMaterial({ map: canvasTexture(gc), roughness: 0.8 }), gp = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), gm); gp.position.set(gate.x + gn.x * 0.05, y0 + 2.3, gate.z + gn.z * 0.05); gp.rotation.y = gyaw; gp.name = 'manuc-gate'; ctx.add(gp);
    }
    const sg = signAtlas([{ x: gate.x + gn.x * 0.1, y: y0 + 5.4, z: gate.z + gn.z * 0.1, yaw: gyaw, w: 5.4, h: 0.8, text: 'HANUL MANUC', bg: '#f2efe7', fg: '#3b2a1e', border: false, font: (q) => `700 ${q}px Georgia, serif` }], { name: 'manuc-sign', night: 0.6 });
    if (sg) ctx.add(sg);
    // collisions: outer + inner ring walls with the gate passage open
    ringWalls(ctx, outer, y0 - 1, y0 + H + 4, [{ x: gate.x, z: gate.z, w: 3.6 }]);
    if (hole) ringWalls(ctx, hole, y0 - 1, y0 + H + 4, [{ x: gate2.x, z: gate2.z, w: 3.6 }]);
    for (const s of [-1, 1]) wallSeg(ctx, gate.x - gn.z * s * 1.8, gate.z + gn.x * s * 1.8, gate2.x - gn.z * s * 1.8, gate2.z + gn.x * s * 1.8, y0 - 1, y0 + H);
    ctx.add(b.build('manuc', { matOverrides: { [fac.key]: fac.mat } }));
    // courtyard: stone pavers, terrace tables under umbrellas
    if (hole) { ctx.painter.poly(hole, '#9a9286', 'cobble'); const t = new GeoBatch(), r = rng(4), bb = polyBox(hole); for (let i = 0; i < 16; i++) { const x = bb.x0 + 5 + r() * (bb.x1 - bb.x0 - 10), z = bb.z0 + 5 + r() * (bb.z1 - bb.z0 - 10); if (!inPoly(x, z, grow(hole, -3))) continue; t.cyl(x, y0 + 0.2, z, 0.05, 0.75, '#2a2a2a', 'metal', 6); t.cyl(x, y0 + 0.95, z, 0.45, 0.04, '#6b4a32', 'wood', 10); t.cyl(x, y0 + 0.2, z, 0.035, 2.4, '#d8d0c0', 'wood', 5); t.add(new THREE.ConeGeometry(1.5, 0.6, 8), 'fabric', M(x, y0 + 2.75, z), r.pick(['#efe7d4', '#7a2230', '#2f5a3a'])); ctx.circle(x, z, 0.8, 1); } ctx.add(t.build('manuc-yard')); }
    return { gate, gn, y0, hole };
}

// ---------------------------------------------------------------------------- Curtea Veche: ruins, bust, 1559 church
function buildCurteaVeche(ctx) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch();
    const ru = osmPoly(d, 'w658220894');
    if (ru) { ctx.skipBuildings.add('w658220894'); const y = Math.min(...ru.map(([x, z]) => g.heightAt(x, z)));
        // excavated brick walls (low, ragged) on the outline + cross walls, a grassy pit, iron railing round it
        for (let i = 0; i < ru.length; i++) { const [ax, az] = ru[i], [bx, bz] = ru[(i + 1) % ru.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue; const n = Math.ceil(L / 2); for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, h = 1.1 + Math.abs(Math.sin(i * 3.1 + k * 1.7)) * 1.6; const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2; b.box(cx, y - 1.4, cz, 1.0, h + 1.4, L / n + 0.05, '#a65a3a', 'brick', Math.atan2(bx - ax, bz - az)); } }
        const o = obb(ru); for (let k = -2; k <= 2; k++) { const cx = o.cx + o.ux * k * o.len * 0.18, cz = o.cz + o.uz * k * o.len * 0.18; b.box(cx, y - 1.4, cz, 0.9, 1.8 + (k % 2 ? 0.8 : 0), o.wid * 0.8, '#9e5536', 'brick', Math.atan2(o.ux, o.uz) + Math.PI / 2); }
        g.mod((x, z, h) => (inPoly(x, z, ru) ? h - 1.4 : h)); ctx.painter.poly(ru, '#6f7d48', 'grass');
        const mats = palisade(ctx, b, [...grow(ru, 1.2), grow(ru, 1.2)[0]], { h: 1.1, post: 2.4 });
        ctx.extras.ruinMats = mats;
    }
    // Vlad Țepeș bust (OSM n6164270296): bronze bust on a stone plinth
    const vb = d.pois.find((p) => p.id === 'n6164270296') || { x: 135.8, z: 152.1 };
    { const y = g.heightAt(vb.x, vb.z); b.box(vb.x, y, vb.z, 1.3, 1.6, 1.0, '#c9c2b4', 'stone'); b.box(vb.x, y + 1.6, vb.z, 1.1, 0.2, 0.85, '#d6cfc0', 'stone'); b.sphere(vb.x, y + 2.25, vb.z, 0.55, 0.38, 0.4, '#3d3426', 'bronze', 12, 8); b.sphere(vb.x, y + 2.75, vb.z, 0.24, 0.3, 0.27, '#3d3426', 'bronze', 12, 9); b.cyl(vb.x, y + 2.95, vb.z, 0.26, 0.2, '#3a3122', 'bronze', 10, 0.8); b.box(vb.x, y + 2.62, vb.z + 0.24, 0.3, 0.12, 0.08, '#3a3122', 'bronze'); ctx.circle(vb.x, vb.z, 0.75, 2); }
    // the church (Buna Vestire / Sf. Anton, 1559): bands of red brick and white plaster, blind arcades, grey tower roof
    const ch = d.buildings.find((x) => x.id === 'w150803286');
    let church = null;
    if (ch) { for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (x.part && inPoly(cx, cz, ch.poly)) ctx.skipBuildings.add(x.id); } ctx.skipBuildings.add(ch.id);
        const p = ch.poly, y = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) - 0.2, o = obb(p);
        const fac = classicFacade('curtea-veche-church', [{ t: 'arch', w: 0.2, top: 0.36, cornice: false }, { t: 'niches', n: 3, top: 0.2, bottom: 0.3 }, { t: 'blank', cornice: false }, { t: 'blank' }], { bay: 2.6, floor: 3.4, stripes: { brick: '#9e4b33', band: '#ede6d6' }, lit: 0.2 });
        classicWalls(b, fac, p, y, y + 8.6, '#ffffff', y);
        b.prism(grow(p, 0.5), y + 8.4, y + 8.8, '#ede6d6', 'stone', { noTop: true });
        b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.25, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), 'metal', M(o.cx, y + 10.2, o.cz, 0, -o.angle, 0, o.len + 1, 2.8, o.wid + 1), '#5c5f60');
        const tx = o.cx - o.ux * o.len * 0.12, tz = o.cz - o.uz * o.len * 0.12, tw = 4.4;
        b.add(wallGeometry([[tx - tw / 2, tz - tw / 2], [tx + tw / 2, tz - tw / 2], [tx + tw / 2, tz + tw / 2], [tx - tw / 2, tz + tw / 2]], y + 8.8, y + 15, fac.S, y, '#ffffff'), fac.key, null, '#ffffff');
        b.add(new THREE.ConeGeometry(tw * 0.78, 6.5, 8), 'metal', M(tx, y + 18.2, tz), '#5c5f60'); b.box(tx, y + 21.4, tz, 0.15, 1.8, 0.15, '#c9a24e', 'bronze'); b.box(tx, y + 22.6, tz, 0.9, 0.12, 0.12, '#c9a24e', 'bronze');
        ctx.poly(p, { y0: y - 1, y1: y + 22 });
        church = { x: o.cx, z: o.cz, fac };
    }
    ctx.add(b.build('curtea-veche', { matOverrides: { ...(church ? { [church.fac.key]: church.fac.mat } : {}), ...(ctx.extras.ruinMats || {}) } }));
    return { bust: vb, church };
}

// ---------------------------------------------------------------------------- Stavropoleos (1724)
function friezeTexture() {
    const c = canvas(1024, 128), x = c.getContext('2d'), r = rng(17);
    x.fillStyle = '#c99a4e'; x.fillRect(0, 0, 1024, 128); x.fillStyle = '#2b4a6b'; x.fillRect(0, 0, 1024, 10); x.fillRect(0, 118, 1024, 10);
    for (let i = 0; i < 8; i++) { const cx = 64 + i * 128; x.fillStyle = '#e8d7a8'; x.beginPath(); x.arc(cx, 64, 50, 0, 7); x.fill(); x.fillStyle = '#7a2f22'; x.beginPath(); x.arc(cx, 64, 45, 0, 7); x.fill(); x.fillStyle = '#2d4c6e'; x.beginPath(); x.arc(cx, 64, 40, 0, 7); x.fill();
        x.fillStyle = '#e5c364'; x.beginPath(); x.arc(cx, 50, 16, 0, 7); x.fill(); x.fillStyle = '#d9b48c'; x.beginPath(); x.arc(cx, 52, 10, 0, 7); x.fill(); // halo + face
        x.fillStyle = r() < 0.5 ? '#8a3324' : '#3f5f3a'; x.beginPath(); x.moveTo(cx - 22, 104); x.quadraticCurveTo(cx, 54, cx + 22, 104); x.fill();
        x.strokeStyle = '#6d4a20'; x.lineWidth = 2; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(cx + 54 + k * 2, 14); x.lineTo(cx + 54 + k * 2, 114); x.stroke(); }
        x.fillStyle = '#e8d7a8'; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx + 64, 20 + k * 22, 4, 0, 7); x.fill(); } }
    return canvasTexture(c, { repeat: true });
}
function porchTexture() { // the carved stone porch: five lobed (trefoil) arches on carved columns, foliate spandrels
    const c = canvas(1024, 512), x = c.getContext('2d');
    x.fillStyle = '#d8c7a2'; x.fillRect(0, 0, 1024, 512);
    const n = 5, w = 1024 / n;
    for (let i = 0; i < n; i++) { const cx = i * w + w / 2, top = 120, bot = 512, aw = w * 0.74;
        x.fillStyle = '#2f2a24'; x.beginPath(); x.moveTo(cx - aw / 2, bot); x.lineTo(cx - aw / 2, top + 70); x.arc(cx - aw / 4, top + 70, aw / 4, Math.PI, Math.PI * 1.5); x.arc(cx, top + 30, aw / 4.2, Math.PI * 1.15, Math.PI * 1.85); x.arc(cx + aw / 4, top + 70, aw / 4, Math.PI * 1.5, 0); x.lineTo(cx + aw / 2, bot); x.fill();
        x.strokeStyle = '#a8895a'; x.lineWidth = 6; x.stroke();
        for (let k = 0; k < 7; k++) { x.fillStyle = 'rgba(120,90,50,0.35)'; x.beginPath(); x.arc(i * w + 6 + (k % 2) * 6, 30 + k * 14, 8, 0, 7); x.fill(); } }
    x.fillStyle = '#b8955a'; x.fillRect(0, 0, 1024, 18);
    return canvasTexture(c);
}
function buildStavropoleos(ctx) {
    const d = ctx.data, g = ctx.ground, ch = d.buildings.find((x) => x.id === 'w78444014'); if (!ch) return null;
    for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (x.part && inPoly(cx, cz, grow(ch.poly, 3))) ctx.skipBuildings.add(x.id); } ctx.skipBuildings.add(ch.id);
    const p = ch.poly, o = obb(p), y = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) - 0.1, b = new GeoBatch();
    const fac = classicFacade('stavropoleos', [{ t: 'arch', w: 0.24, top: 0.3, bottom: 0.18, cornice: false }, { t: 'niches', n: 2, cornice: false }, { t: 'blank' }, { t: 'blank' }], { bay: 2.8, floor: 2.9, lit: 0.25 });
    const WALL = '#e7d8b8';
    classicWalls(b, fac, p, y, y + 5.6, WALL, y);
    // painted frieze of saint medallions all round under the eaves
    const fm = new THREE.MeshStandardMaterial({ map: friezeTexture(), roughness: 0.8 }); fm.map.repeat.set(1, 1);
    const fz = new GeoBatch(); fz.add(wallGeometry(p, y + 5.6, y + 7.1, { bay: 1.5 / 4 * 8 / 4 * 2, floor: 1.5 / 4 }, y + 5.6, '#ffffff'), 'frieze', null, '#ffffff');
    // deep eaves + red clay-tile hipped roof
    b.prism(grow(p, 1.2), y + 7.1, y + 7.45, '#5a3a24', 'wood', { noTop: true, bottom: true });
    b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.35, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), 'roofs', M(o.cx, y + 7.45 + 1.4, o.cz, 0, -o.angle, 0, o.len + 2.4, 2.8, o.wid + 2.4), '#8a4a33');
    // tower over the nave: octagonal drum with painted panels, tiled helmet roof, cross
    const tx = o.cx + o.ux * o.len * 0.05, tz = o.cz + o.uz * o.len * 0.05;
    const oct = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; oct.push([tx + Math.cos(a) * 2.6, tz + Math.sin(a) * 2.6]); }
    classicWalls(b, fac, oct, y + 8.2, y + 12, WALL, y + 8.2);
    fz.add(wallGeometry(oct, y + 11.0, y + 12.2, { bay: 0.3, floor: 0.3 }, y + 11, '#ffffff'), 'frieze', null, '#ffffff');
    b.prism(grow(oct, 0.8), y + 12.2, y + 12.5, '#5a3a24', 'wood', { noTop: true, bottom: true });
    b.add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'roofs', M(tx, y + 12.5, tz, 0, 0, 0, 3.0, 2.4, 3.0), '#8a4a33');
    b.cyl(tx, y + 14.9, tz, 0.3, 0.6, '#9a4a2c', 'roofs', 8, 0.6); b.box(tx, y + 15.4, tz, 0.12, 1.8, 0.12, '#c9a24e', 'bronze'); b.box(tx, y + 16.5, tz, 0.9, 0.1, 0.1, '#c9a24e', 'bronze');
    // the porch (west end): open, five lobed arches on carved columns — a carved canvas on the west face + real columns
    const wx = o.cx - o.ux * o.len / 2, wz = o.cz - o.uz * o.len / 2, wyaw = Math.atan2(-o.ux, -o.uz);
    const pm = new THREE.MeshStandardMaterial({ map: porchTexture(), roughness: 0.75 });
    const porch = new THREE.Mesh(new THREE.PlaneGeometry(o.wid * 0.98, 5.6), pm); porch.position.set(wx - o.ux * 0.08, y + 2.8, wz - o.uz * 0.08); porch.rotation.y = wyaw; ctx.add(porch);
    for (let i = 0; i <= 5; i++) { const t = -0.5 + i / 5, cx = wx - o.ux * 0.35 + (-o.uz) * t * o.wid * 0.94, cz = wz - o.uz * 0.35 + o.ux * t * o.wid * 0.94; b.cyl(cx, y, cz, 0.24, 0.5, '#cdb68a', 'stone', 8); b.cyl(cx, y + 0.5, cz, 0.17, 3.0, '#d8c7a2', 'stone', 10); b.cyl(cx, y + 3.5, cz, 0.3, 0.45, '#cdb68a', 'stone', 8, 1.4); }
    ctx.poly(p, { y0: y - 1, y1: y + 18 });
    ctx.add(fz.build('stavropoleos-frieze', { matOverrides: { frieze: fm } }));
    // courtyard wall: low stone wall, pillars with urn finials, black iron grilles (OSM: churchyard around the church)
    const yard = grow(p, 4.5), wb = new GeoBatch();
    for (let i = 0; i < yard.length; i++) { const [ax, az] = yard[i], [bx, bz] = yard[(i + 1) % yard.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue; const n = Math.max(1, Math.round(L / 3.2)); for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, yy = g.heightAt(x, z); wb.box(x, yy, z, 0.55, 1.75, 0.55, '#d6c9ad', 'stone'); wb.cyl(x, yy + 1.75, z, 0.2, 0.25, '#cbbd9e', 'stone', 8); wb.sphere(x, yy + 2.15, z, 0.2, 0.26, 0.2, '#cbbd9e', 'stone', 6, 4); } const cx = (ax + bx) / 2, cz = (az + bz) / 2; wb.box(cx, g.heightAt(cx, cz), cz, 0.4, 0.7, L, '#d6c9ad', 'stone', Math.atan2(bx - ax, bz - az)); }
    const gm = palisade(ctx, wb, [...yard, yard[0]], { h: 1.0, plinth: 0.7, post: 3.2, postCol: '#d6c9ad' });
    // entrance gap: remove nothing visually, but the gate in the north wall is drawn open (the wall collider stays: enter by the gate interaction)
    ctx.add(wb.build('stavropoleos-yard', { matOverrides: gm }));
    ctx.painter.poly(yard, '#a9a49a', 'slab');
    ctx.add(b.build('stavropoleos', { matOverrides: { [fac.key]: fac.mat } }));
    return { x: o.cx, z: o.cz, y, west: { x: wx, z: wz }, yard, o };
}

export default {
    env: { fogFar: 3000, ambientCity: 0.65, groundAlbedo: 0.15 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, spL = ctx.spot('old-town-lipscani'), spS = ctx.spot('stavropoleos-cec');
        // a flat old town (bare-earth grid) — smooth the DEM noise
        const T0 = g.heightAt(0, 0); g.mod((x, z, h) => T0 + (h - T0) * 0.35);
        // most old-town buildings have no height in OSM: 2–5 storeys (uneven skyline), lantern-lit ground floors
        for (const bd of d.buildings) if (!bd.part && !bd.h && !bd.lv && bd.k !== 'church' && bd.k !== 'roof') { const hsh = Math.abs(Math.sin(bd.poly[0][0] * 12.9898 + bd.poly[0][1] * 78.233) * 43758.5453) % 1; bd.lv = 2 + Math.floor(hsh * 4); }
        const CA = buildCarusel(ctx), MA = buildManuc(ctx), CV = buildCurteaVeche(ctx), ST = buildStavropoleos(ctx);
        // CEC Palace + Post Palace (History Museum) from landmarks.js
        for (const [lmId, osmId] of [['cec', 'w973712798'], ['mnir', 'r19919941']]) { const bd = d.buildings.find((x) => x.id === osmId); if (!bd) continue; ctx.skipBuildings.add(osmId); for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (x.part && inPoly(cx, cz, bd.poly)) ctx.skipBuildings.add(x.id); } const L2 = placeLandmark(ctx, lmId, { colliderH: 50 }); ctx.poly(bd.poly, { y0: -50, y1: 80 }); }
        // Caru' cu Bere (Str. Stavropoleos 5): neo-Gothic front, sign, queue
        const caruB = d.buildings.find((x) => x.id === 'w1456401783');
        if (caruB) { ctx.skipBuildings.add(caruB.id); const b = new GeoBatch(), y = Math.min(...caruB.poly.map(([x, z]) => g.heightAt(x, z))) - 0.2; const fac = classicFacade('caru', [{ t: 'arch', w: 0.36, top: 0.1, bottom: 0.06, rustic: true }, { t: 'arch2', w: 0.34, pil: true }, { t: 'arch', w: 0.26, pil: true, top: 0.3 }, { t: 'small', w: 0.24 }], { bay: 3.2, floor: 4.2, lit: 0.85 }); classicWalls(b, fac, caruB.poly, y, y + 15.5, '#c9b79a', y); b.flat(caruB.poly, y + 15.5, '#6b5f55', 'roofs'); const o = obb(caruB.poly); b.add(new THREE.ConeGeometry(4.5, 5, 4), 'roofs', M(-111, y + 18, -73.5, 0, Math.PI / 4, 0, 1, 1, 0.35), '#5a4f46'); ctx.poly(caruB.poly, { y0: y - 1, y1: y + 22 }); ctx.add(b.build('caru-cu-bere', { matOverrides: { [fac.key]: fac.mat } })); void o; }
        // ground: shared-surface grey granite setts over every pedestrian street (no kerbs), slab bands
        ctx.terrainOpts = { bg: '#8f8b84', bgMask: 'cobble', innerPx: 2048, innerStep: 3, outerStep: 16, outerPad: 700 };
        bucBackdrop(ctx, { lampStyle: 'lantern', lampColor: '#191b1c', lampH: 4.4, lampPad: 15, treeLod: { cap: 1600, max: 400 }, lampOpts: { spacing: 24, kinds: ['pedestrian', 'living_street'] }, streetTreeOpts: { kinds: ['primary', 'secondary', 'tertiary'], prob: 0.5 }, style: (bd) => (bd.k === 'church' ? 'eclectic' : undefined) });
        for (const w of d.ways) if (['pedestrian', 'living_street'].includes(w.k) && !w.tunnel) ctx.painter.line(w.pts, 11, '#7f7c76', 'cobble');
        ctx.extras.caruselFloor?.();
        { const lanes = d.ways.filter((w) => w.k === 'pedestrian' && /Lipscani|Șelari|Smârdan|Gabroveni|Franceză|Stavropoleos|Covaci|Poștei|Șepcari/.test(w.name || '')); const near = (t) => lanes.some((w) => { for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((t.x - ax) * dx + (t.z - az) * dz) / L2)); if (Math.hypot(t.x - ax - dx * u, t.z - az - dz * u) < 7) return true; } return false; }); ctx.trees = ctx.trees.filter((t) => !near(t)); }
        ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; for (const w of d.ways) { if (w.k !== 'pedestrian') continue; x.strokeStyle = 'rgba(205,200,190,0.55)'; x.lineWidth = Math.max(1, 0.9 * k); x.beginPath(); w.pts.forEach(([a, c], i) => { const [px, py] = T(a, c); if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); } });
        // terraces + shop signs from OSM (bars, restaurants, cafés, shops along the pedestrian lanes)
        const inside = (x, z) => Object.values(d.spots).some((s) => inPoly(x, z, s.extent.polygon));
        const TR = oldTownTerraces(ctx, { inside, seed: 3 });
        ctx.add(TR.group); ctx.lampPoints.push(...TR.lamps.filter((_, i) => i % 2 === 0));
        const signs = [...TR.signs];
        if (caruB) signs.push({ x: -111, y: g.heightAt(-111, -71.5) + 5.4, z: -71.4, yaw: 0, w: 6.2, h: 1.0, text: "CARU' CU BERE", bg: '#2a1d14', fg: '#e8c870', font: (q) => `700 ${q}px "Times New Roman", serif` });
        const SA = signAtlas(signs.slice(0, 96), { name: 'shop-signs' }); if (SA) ctx.add(SA);
        // overhead cables across the lanes (string lights at night)
        const cab = new GeoBatch(), bulbs = new GeoBatch(), r = rng(12);
        for (const w of d.ways) { if (w.k !== 'pedestrian' || !/Lipscani|Șelari|Smârdan|Gabroveni/.test(w.name || '')) continue; for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); for (let s = 4; s < L; s += 7 + r() * 5) { const t = s / L, cx = ax + (bx - ax) * t, cz = az + (bz - az) * t, nx = -(bz - az) / L, nz = (bx - ax) / L, y = g.heightAt(cx, cz) + 6.2 + r() * 1.4; const A = [cx + nx * 5, y, cz + nz * 5], Bq = [cx - nx * 5, y, cz - nz * 5]; cab.rod(A, [cx, y - 0.35, cz], 0.015, '#151515', 'metal', 3); cab.rod([cx, y - 0.35, cz], Bq, 0.015, '#151515', 'metal', 3); for (let q = 0; q <= 8; q++) { const u = q / 8, sag = Math.sin(u * Math.PI) * 0.35; bulbs.sphere(A[0] + (Bq[0] - A[0]) * u, y - sag - 0.08, A[2] + (Bq[2] - A[2]) * u, 0.05, 0.06, 0.05, '#fff2c8', 'glow', 4, 3); } } } }
        ctx.add(cab.build('cables', { castShadow: false }));
        const bulbG = bulbs.build('string-lights', { castShadow: false }); bulbG.visible = false; ctx.add(bulbG);
        ctx.onNight((k) => { bulbG.visible = k > 0.4; });
        cityFiller(ctx, { ring: 600 });
        // plaques
        const PL = spL.plaques, PS = spS.plaques, gy = (x, z) => g.heightAt(x, z);
        if (CA) { const f = CA.front; ctx.plaque(PL[5], f.x + f.nz * 9.5 + f.nx * 1.2, f.z - f.nx * 9.5 + f.nz * 1.2, f.yaw, { style: 'city', credit: '2015 refit: architects Square One (Ana Petrescu & Ramona Iliescu); the 1860s building restored by the Cărturești chain.' }); }
        ctx.plaque(PL[0], 108, -58, Math.PI, { style: 'city' }); ctx.plaque(PL[1], 76, -40, -Math.PI / 2, { style: 'city' });
        if (MA) ctx.plaque(PL[2], MA.gate.x + MA.gn.x * 1.6 - MA.gn.z * 4.2, MA.gate.z + MA.gn.z * 1.6 + MA.gn.x * 4.2, Math.atan2(MA.gn.x, MA.gn.z), { style: 'city' });
        ctx.plaque(PL[3], CV.bust.x + 2.2, CV.bust.z - 1.6, Math.PI, { style: 'bronze' });
        if (CV.church) ctx.plaque(PL[4], CV.church.x - 14, CV.church.z - 4, -Math.PI / 2, { style: 'city' });
        if (ST) { ctx.plaque(PS[0], ST.west.x - 6.5, -64.5 + 3.5, Math.PI, { style: 'bronze' }); ctx.plaque(PS[1], ST.x + 9, -66.5, Math.PI, { style: 'bronze' }); }
        if (caruB) ctx.plaque(PS[2], -104, -67.5, Math.PI, { style: 'city' });
        ctx.plaque(PS[3], -212, -82, -Math.PI / 2, { style: 'city', credit: 'Architect Paul Gottereau (1897–1900).' });
        ctx.plaque(PS[4], -212, -32, -Math.PI / 2, { style: 'city', credit: 'Post Palace (1894–1900), architect Alexandru Săvulescu.' });
        // fun: Dracula magnets ("Nu, mersi"), light a candle at Stavropoleos, the Carusel postcard needs level 2
        ctx.interactables.push({ x: CV.bust.x - 3, z: CV.bust.z - 3, r: 2.4, label: 'Souvenir stall: "Dracula magnet, only 10 lei!" — say "Nu, mersi"', use: (s) => s.ui.toast('🧛 "Nu, mersi!"', 'Vlad III ruled from this court in 1459 — locals see him as a hero, not a vampire.') });
        if (ST) ctx.interactables.push({ x: ST.west.x - 3.5, z: -64.5 + 1.2, r: 2.4, label: 'Light a candle (Stavropoleos)', use: (s) => { s.ui.toast('🕯 Candle lit', 'Quiet please — the choir sings Byzantine chant.'); s.sound.play('chime', 0.3); } });
        if (CA) ctx.challenge('old-town-lipscani', { x: CA.ecx + (CA.front.x - CA.ecx) * 0.75, z: CA.ecz + (CA.front.z - CA.ecz) * 0.75, heading: (Math.atan2(CA.ecx - CA.front.x, -(CA.ecz - CA.front.z)) * 180 / Math.PI + 360) % 360, r: 6, tol: 40, text: 'Cărturești Carusel: the white atrium and its stacked balconies (best from the level-2 balcony)' });
        if (MA) ctx.challenge('old-town-lipscani', { x: MA.gate.x + MA.gn.x * 14, z: MA.gate.z + MA.gn.z * 14, heading: (Math.atan2(-MA.gn.x, MA.gn.z) * 180 / Math.PI + 360) % 360, r: 7, tol: 30, text: "Hanul lui Manuc's gate on Str. Franceză" });
        ctx.challenge('stavropoleos-cec', { view: ST ? [ST.x, ST.z] : null, r: 7, tol: 30 });
        // crowd: busy lanes, waiters at every terrace, a tour at Stavropoleos, the Caru' cu Bere queue
        const groups = [];
        TR.terraces.slice(0, 14).forEach((t, i) => { groups.push({ x: t.x + Math.sin(t.yaw) * (t.depth / 2 + 0.6), z: t.z + Math.cos(t.yaw) * (t.depth / 2 + 0.6), r: 0.3, n: 1, act: 'watch', yaw: t.yaw, personas: ['waiter'] }); if (i % 2 === 0) groups.push({ x: t.x, z: t.z, r: 1.2, n: 2, act: 'sit', personas: ['local_young', 'tourist_uk', 'tourist_it', 'tourist_us'] }); });
        if (ST) groups.push({ x: ST.x + 4, z: -67.5, r: 2.6, n: 8, act: 'photo', look: [ST.x, ST.z], personas: ['tourist_de', 'tourist_fr', 'tourist_us'] }, { x: ST.x + 8.5, z: -66.5, r: 0.3, n: 1, act: 'guide', look: [ST.x + 4, -67.5], personas: ['tour_guide'] });
        if (caruB) groups.push({ line: [[-111, -70.2], [-105, -69.6], [-99, -69.2], [-93, -68.8]], n: 9, act: 'queue', personas: ['tourist_de', 'tourist_us', 'local_young', 'tourist_fr', 'tourist_uk'] });
        if (CA) groups.push({ x: CA.front.x + CA.front.nx * 4, z: CA.front.z + CA.front.nz * 4, r: 2.5, n: 5, act: 'photo', look: [CA.front.x, CA.front.z], personas: ['tourist_it', 'tourist_us', 'local_young'] }, { x: CA.ecx, z: CA.ecz, r: 3, n: 5, act: 'watch', personas: ['local_young', 'tourist_uk', 'tourist_fr'] });
        groups.push({ x: CV.bust.x - 3, z: CV.bust.z - 3.5, r: 0.3, n: 1, act: 'watch', personas: ['vendor'] }, { x: CV.bust.x + 2, z: CV.bust.z - 4, r: 2, n: 4, act: 'photo', look: [CV.bust.x, CV.bust.z], personas: ['tourist_uk', 'tourist_it', 'tourist_us'] });
        groups.push({ x: 60, z: -66, r: 0.3, n: 1, act: 'perform', personas: ['busker'], prop: 'guitar' }, { x: 62, z: -62, r: 2.5, n: 4, act: 'watch', look: [60, -66], personas: ['local_young', 'tourist_uk'] });
        if (MA) groups.push({ x: MA.gate.x + MA.gn.x * 2.5 + MA.gn.z * 2.6, z: MA.gate.z + MA.gn.z * 2.5 - MA.gn.x * 2.6, r: 0.3, n: 1, act: 'watch', yaw: Math.atan2(MA.gn.x, MA.gn.z), personas: ['waiter'] });
        ctx.crowdCfg = {
            spots: ['old-town-lipscani', 'stavropoleos-cec'],
            personas: { local_young: 4, tourist_uk: 2.5, tourist_it: 1.8, tourist_us: 1.8, tourist_de: 1.5, tourist_fr: 1.2, local_elder: 1, local_parent: 0.8, kid: 0.4 },
            walkers: 46, paths: ctx.footLines().concat(d.ways.filter((w) => w.k === 'pedestrian').map((w) => w.pts)), groups,
        };
        // ambience
        ctx.sound('crowd', 120, -60, 60, 1); ctx.sound('crowd', 200, 120, 50, 0.8); ctx.sound('crowd', -60, -66, 40, 0.6);
        ctx.sound('bell', CV.church?.x ?? 205, CV.church?.z ?? 134, 260, 0.45); ctx.sound('traffic', -240, -60, 120, 0.7); ctx.sound('traffic', 300, 0, 120, 0.5);
        // spawns
        ctx.spawns['old-town-lipscani'] = { x: 128, z: -56.5, heading: headingFromBearing(78) };
        ctx.spawns['stavropoleos-cec'] = { x: -92, z: -67.5, heading: headingFromBearing(100) };
        void balustradeMaterial; void fitDraw;
    },
};
