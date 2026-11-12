// ============================================================================
//  Romanian Athenaeum & Piața Revoluției (Bucharest).
//  Ateneul Român (Albert Galleron, 1888): landmarks.js model (bAteneu, read-only
//  import) in its garden with the Eminescu statue; the frieze reads ATHENEUL ROMAN
//  (with H — overlaid here, see spec 12 Request). Piața Revoluției: the Royal
//  Palace (National Museum of Art, landmarks.js bRegal), the Central University
//  Library with the equestrian Carol I in front (2010 recreation of Ivan
//  Meštrović's 1930 statue), the former Central Committee building with the
//  1989 balcony, and the Memorial of Rebirth (2005: white marble pillar through
//  a dark "crown") on its granite plaza with the backless benches. All modelled
//  (no photo textures); artists credited on the plaques.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, centroid, polyBox, inPoly, offsetPolyline, polyArea, obb } from '../kit.js';
import { bucBackdrop, classicFacade, classicWalls, osmPoly, cityFiller, placeLandmark, signAtlas, balustrade, balustradeMaterial, flagpole, floodlight, bucActivity } from '../buc.js';
import { photoHunt } from '../photo-hunt.js';
import { bench } from '../osm.js';
import { addTraffic } from '../cars.js';
import { mappedTreeSizes, poiSigns, bust, standingFigure } from '../buc-streetscape.js';

function grow(poly, d) { const cw = polyArea(poly) > 0; const o = offsetPolyline([...poly, poly[0], poly[1]], cw ? -d : d); return o.slice(1, poly.length + 1); }
const local = (lm, x, z) => { const c = Math.cos(lm.lm.rotation), s = Math.sin(lm.lm.rotation); return { x: lm.x + x * c + z * s, z: lm.z - x * s + z * c }; };

/** equestrian statue (bronze, stylised volumes) on a stone plinth; returns colliders added */
function equestrian(b, ctx, x, z, yaw, { plinth = 5.5, s = 1.15 } = {}) {
    const y = ctx.ground.heightAt(x, z), BR = '#3f4a3c', c = Math.cos(yaw), sn = Math.sin(yaw), P = (u, v) => [x + u * c + v * sn, z - u * sn + v * c];
    b.box(x, y, z, 4.2, 0.6, 6.2, '#b7b0a2', 'stone', yaw); b.box(x, y + 0.6, z, 3.2, plinth - 0.6, 5.0, '#c9c2b4', 'stone', yaw); b.box(x, y + plinth, z, 3.6, 0.45, 5.4, '#d6cfc0', 'stone', yaw);
    const Y = y + plinth + 0.45;
    const [bx, bz] = P(0, 0.1); b.sphere(bx, Y + 1.75 * s, bz, 0.62 * s, 0.7 * s, 1.35 * s, BR, 'bronze', 12, 8); // body
    for (const [u, v] of [[-0.35, 0.95], [0.35, 0.95], [-0.35, -0.85], [0.35, -0.75]]) { const [lx, lz] = P(u * s, v * s); b.rod([lx, Y, lz], [lx, Y + 1.5 * s, lz], 0.1 * s, BR, 'bronze', 6); }
    const [nx, nz] = P(0, 1.5 * s); b.rod([bx, Y + 2.0 * s, bz], [nx, Y + 2.9 * s, nz], 0.3 * s, BR, 'bronze', 8); const [hx, hz] = P(0, 1.95 * s); b.sphere(hx, Y + 2.8 * s, hz, 0.2 * s, 0.22 * s, 0.5 * s, BR, 'bronze', 8, 6);
    const [tx, tz] = P(0, -1.45 * s); b.rod([tx, Y + 1.9 * s, tz], [tx, Y + 1.0 * s, tz], 0.12 * s, BR, 'bronze', 6);
    const [rx, rz] = P(0, -0.1 * s); b.cyl(rx, Y + 2.2 * s, rz, 0.3 * s, 0.85 * s, BR, 'bronze', 8); b.sphere(rx, Y + 3.25 * s, rz, 0.17 * s, 0.2 * s, 0.17 * s, BR, 'bronze', 8, 6); b.cyl(rx, Y + 3.35 * s, rz, 0.19 * s, 0.22 * s, BR, 'bronze', 8);
    ctx.box(x, z, 1.7, 2.6, yaw, { y0: y - 1, y1: y + plinth + 4 });
}
/** Memorial of Rebirth (Alexandru Ghilduș, 2005): 25 m white marble pyramid pillar piercing a dark crown, red marks below */
function memorial(b, ctx, x, z) {
    const y = ctx.ground.heightAt(x, z);
    b.cyl(x, y - 0.2, z, 14, 0.4, '#a39c94', 'stone', 32); // plaza disc
    b.cyl(x, y + 0.2, z, 2.6, 0.5, '#cfcac2', 'stone', 3); // base
    b.add(new THREE.CylinderGeometry(0.15, 1.9, 25, 3), 'stone', M(x, y + 0.7 + 12.5, z, 0, 0.3, 0), (px, py) => (py < y + 9 && py > y + 6.5 ? '#a8322a' : '#ece9e3'));
    const r = rng(14); // the "crown": a ragged dark metal basket at ~15 m
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, rr = 2.4 + r() * 1.4, yy = y + 15.2 + r() * 1.8; b.rod([x + Math.cos(a) * 0.6, y + 15.6, z + Math.sin(a) * 0.6], [x + Math.cos(a) * rr, yy + r() * 1.5, z + Math.sin(a) * rr], 0.12 + r() * 0.1, '#3c3a36', 'metal', 4); }
    b.cyl(x, y + 15.2, z, 1.4, 1.2, '#3c3a36', 'metal', 10, 1.5);
    ctx.circle(x, z, 2.6, 25);
    // eight backless benches facing each other round the plaza
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, bx = x + Math.cos(a) * 9, bz = z + Math.sin(a) * 9; b.box(bx, y, bz, 2.4, 0.45, 0.7, '#d6d0c6', 'stone', -a + Math.PI / 2); ctx.box(bx, bz, 1.2, 0.35, -a + Math.PI / 2, { prop: true, h: 0.45 }); }
    return { x, z, y };
}

export default {
    env: { fogFar: 3200, ambientCity: 0.45, groundAlbedo: 0.15 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('athenaeum-revolution');
        const T0 = g.heightAt(0, 0); g.mod((x, z, h) => T0 + (h - T0) * 0.4);
        const b = new GeoBatch();
        // ---- the Athenaeum (landmarks.js) + its garden
        const at = d.buildings.find((x) => x.id === 'w16291602');
        if (at) { ctx.skipBuildings.add(at.id); for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (x.part && inPoly(cx, cz, grow(at.poly, 2))) ctx.skipBuildings.add(x.id); } }
        const AT = placeLandmark(ctx, 'ateneu', { colliderH: 45 });
        // (the frieze 'ATHENEUL ROMAN' and the gold roundels are in the landmarks.js model since its 2026-11-07 fix)
        const garden = osmPoly(d, 'w23556716');
        // Eminescu statue in the garden (OSM n1911337561; Gheorghe D. Anghel, 1966): a standing bronze figure on a low stone
        // base, facing away from the portico toward Calea Victoriei (it was a post with a ball on a 2.6 m block). Sizes estimated.
        { const e = d.pois.find((p) => p.id === 'n1911337561') || { x: -69.3, z: -24.3 }; standingFigure(b, ctx, e.x, e.z, AT ? Math.atan2(e.x - AT.x, e.z - AT.z) : -2, { h: 3.4, plinth: 1.1, pw: 1.5, metal: '#2f3a33' }); }
        // ---- Piața Revoluției
        const matX = {}; const rg = d.buildings.find((x) => x.id === 'w232472401'); if (rg) { ctx.skipBuildings.add(rg.id); for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (x.part && inPoly(cx, cz, rg.poly)) ctx.skipBuildings.add(x.id); } 
            // (fidelity pass 2026-11-12) The landmarks.js model is now a mass model in the mapped colour name (pale goldenrod),
            // almost without windows: on the square it read as an olive windowless block. Here the mapped outline gets the
            // palace's own front (Street View, 2024): beige limestone, rusticated ground floor with arched windows, two upper
            // storeys between paired pilasters, cornice and attic balustrade. Height 17.5 m after the mapped parts (15.7–18 m).
            const fRG = classicFacade('royal-palace', [{ t: 'arch', w: 0.36, rustic: true, top: 0.2 }, { t: 'pediment', w: 0.32, pil: 'pair', rail: true, top: 0.3 }, { t: 'rect', w: 0.3, pil: 'pair', dentils: true, top: 0.3 }, { t: 'small', w: 0.26 }], { bay: 4.6, floor: 17.5 / 3, lit: 0.3 });
            const y = Math.min(...rg.poly.map(([x, z]) => g.heightAt(x, z))) - 0.2, H = 17.5;
            classicWalls(b, fRG, rg.poly, y, y + H, '#e1d6bc', y); for (const hole of rg.holes || []) classicWalls(b, fRG, [...hole].reverse(), y, y + H, '#e1d6bc', y);
            b.prism(grow(rg.poly, 0.7), y + H - 0.7, y + H, '#ebe2cd', 'stone', { noTop: true }); b.flat(rg.poly, y + H, '#8f8d88', 'roofs'); balustrade(b, grow(rg.poly, 0.3), y + H, 1.0, { closed: true });
            ctx.poly(rg.poly, { y0: y - 1, y1: y + 30 }); matX[fRG.key] = fRG.mat; }
        // Central University Library (eclectic, three storeys, domed corner pavilions)
        const bcu = d.buildings.find((x) => x.id === 'r19896250');
        const fBCU = classicFacade('bcu', [{ t: 'portal', w: 0.42, rustic: true }, { t: 'arch', w: 0.34, pil: 'pair', rail: true }, { t: 'pediment', w: 0.32, pil: 'pair' }, { t: 'small', w: 0.26, dentils: true }], { bay: 4.4, floor: 5.2, lit: 0.4 });
        if (bcu) { ctx.skipBuildings.add(bcu.id); const y = Math.min(...bcu.poly.map(([x, z]) => g.heightAt(x, z))) - 0.2; classicWalls(b, fBCU, bcu.poly, y, y + 20.8, '#e4dac3', y); b.prism(grow(bcu.poly, 0.8), y + 20.2, y + 21.0, '#ece4d2', 'stone', { noTop: true }); b.flat(bcu.poly, y + 21, '#8a8a86', 'roofs'); balustrade(b, grow(bcu.poly, 0.4), y + 21, 1.1, { closed: true }); b.prism(grow(bcu.poly, -1.6), y + 21, y + 24.6, '#474c52', 'roofs'); /* dark slate mansard behind the balustrade, as on the real library; height estimated */ const o = obb(bcu.poly); for (const s of [-1, 1]) { const cx = o.cx + o.ux * s * o.len * 0.42, cz = o.cz + o.uz * s * o.len * 0.42; b.add(new THREE.SphereGeometry(5.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', M(cx, y + 24.6, cz, 0, 0, 0, 1, 1.25, 1), '#474c52'); } ctx.poly(bcu.poly, { y0: y - 1, y1: y + 30 }); }
        // former Central Committee building (Ministry of Internal Affairs) with the 1989 balcony toward the square
        const cc = d.buildings.find((x) => x.id === 'w224624034');
        const fCC = classicFacade('cc-building', [{ t: 'rect', w: 0.34, rustic: true }, { t: 'rect', w: 0.3, pil: true }, { t: 'rect', w: 0.3, pil: true }, { t: 'rect', w: 0.28, pil: true, dentils: true }], { bay: 3.6, floor: 3.8, lit: 0.4 });
        let balcony = null;
        if (cc) { ctx.skipBuildings.add(cc.id); const y = Math.min(...cc.poly.map(([x, z]) => g.heightAt(x, z))) - 0.2, H = 26; classicWalls(b, fCC, cc.poly, y, y + H, '#d9d0bc', y); b.prism(grow(cc.poly, 0.9), y + H - 0.8, y + H, '#e4dccb', 'stone', { noTop: true }); b.flat(cc.poly, y + H, '#8a8784', 'roofs'); ctx.poly(cc.poly, { y0: y - 1, y1: y + 30 });
            // balcony on the west front (facing the square) above the entrance portico
            let best = null; for (let i = 0; i < cc.poly.length; i++) { const [ax, az] = cc.poly[i], [bx2, bz2] = cc.poly[(i + 1) % cc.poly.length], L = Math.hypot(bx2 - ax, bz2 - az); if (L < 20) continue; const mx = (ax + bx2) / 2, mz = (az + bz2) / 2; if (!best || mx < best.mx) best = { mx, mz, ux: (bx2 - ax) / L, uz: (bz2 - az) / L, L }; }
            if (best) { let nx = best.uz, nz = -best.ux; if (nx > 0) { nx = -nx; nz = -nz; } const a = Math.atan2(best.ux, best.uz); const bx3 = best.mx + nx * 1.4, bz3 = best.mz + nz * 1.4; b.box(bx3, y + 7.6, bz3, 2.8, 0.45, 10, '#e2dbc9', 'stone', a); balustrade(b, [[bx3 + nx * 1.3 - best.ux * 5, bz3 + nz * 1.3 - best.uz * 5], [bx3 + nx * 1.3 + best.ux * 5, bz3 + nz * 1.3 + best.uz * 5]], y + 8.05, 1.1); for (const s of [-1, -0.33, 0.33, 1]) { const q = [best.mx + nx * 2.6 + best.ux * s * 4.6, best.mz + nz * 2.6 + best.uz * s * 4.6]; b.cyl(q[0], y, q[1], 0.42, 7.6, '#ece6d8', 'stone', 12); ctx.circle(q[0], q[1], 0.45, 8); } balcony = { x: best.mx + nx * 14, z: best.mz + nz * 14 }; void a; }
            for (const [z0, k] of [[-6, 'ro'], [6, 'eu']]) { if (!best) break; const f = flagpole(best.mx - 0.8 + best.ux * z0, y + 12, best.mz + best.uz * z0, 4, k, { yaw: Math.PI }); f.group.rotation.z = 0.5; ctx.add(f.group); }
        }
        const mem = d.pois.find((p) => p.id === 'n1393030628') || { x: -15.6, z: 217.9 };
        for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (Math.hypot(cx - mem.x, cz - mem.z) < 14) ctx.skipBuildings.add(x.id); }
        const MEM = memorial(b, ctx, mem.x, mem.z);
        ctx.painter.custom((x, T, k) => { const [px, py] = T(mem.x, mem.z); x.fillStyle = '#a39c94'; x.beginPath(); x.arc(px, py, 22 * k, 0, 7); x.fill(); });
        const carol = d.pois.find((p) => p.id === 'n1883108499') || { x: -51.1, z: 133.4 };
        equestrian(b, ctx, carol.x, carol.z, Math.PI * 0.55, { plinth: 5.2 });
        // ---- (fidelity pass 2026-11-12) what OSM maps on the square and the scene did not show
        // Kretzulescu church (OSM w1476760553, 1722): bare red brick with pale bands, two towers with dark conical roofs.
        // Modelled on the mapped outline (it was a generic plastered house); heights are estimates.
        const kr = d.buildings.find((x) => x.id === 'w1476760553');
        if (kr) { ctx.skipBuildings.add(kr.id); for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (x.part && inPoly(cx, cz, grow(kr.poly, 1))) ctx.skipBuildings.add(x.id); } const p = kr.poly, y = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) - 0.2, o = obb(p);
            const fK = classicFacade('kretzulescu', [{ t: 'arch', w: 0.22, top: 0.34, cornice: false }, { t: 'niches', n: 3, top: 0.2, bottom: 0.3 }, { t: 'blank', cornice: false }, { t: 'blank' }], { bay: 2.8, floor: 3.6, stripes: { brick: '#9a4a32', band: '#b98267' }, lit: 0.2 });
            classicWalls(b, fK, p, y, y + 9.4, '#ffffff', y); b.prism(grow(p, 0.5), y + 9.2, y + 9.6, '#b2603f', 'stone', { noTop: true });
            b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.3, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), 'metal', M(o.cx, y + 10.8, o.cz, 0, -o.angle, 0, o.len + 1, 2.4, o.wid + 1), '#4f5456');
            for (const [k, r0, h0] of [[-0.24, 2.6, 8.5], [0.16, 3.1, 7.5]]) { const tx = o.cx + o.ux * o.len * k, tz = o.cz + o.uz * o.len * k, oct = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; oct.push([tx + Math.cos(a) * r0, tz + Math.sin(a) * r0]); }
                classicWalls(b, fK, oct, y + 10.2, y + 10.2 + h0, '#ffffff', y + 10.2); b.add(new THREE.ConeGeometry(r0 * 1.12, 4.6, 8), 'metal', M(tx, y + 10.2 + h0 + 2.3, tz), '#4f5456'); b.box(tx, y + 14.8 + h0, tz, 0.12, 1.5, 0.12, '#c9a24e', 'bronze'); b.box(tx, y + 15.8 + h0, tz, 0.8, 0.1, 0.1, '#c9a24e', 'bronze'); }
            ctx.poly(p, { y0: y - 1, y1: y + 24 }); matX[fK.key] = fK.mat; }
        // busts and statues at their mapped nodes (stylised bronze volumes; no sculptor is credited: no plaque text is sourced)
        const node = (id) => d.pois.find((p) => p.id === id);
        for (const id of ['n7483056723', 'n11182793898', 'n11182793914']) { const p = node(id); if (p) bust(b, ctx, p.x, p.z, Math.atan2(-60 - p.x, 250 - p.z), { plinth: 1.9 }); }
        for (const id of ['n11068954269', 'n11068954270', 'n11068954271']) { const p = node(id); if (p) standingFigure(b, ctx, p.x, p.z, Math.PI / 2, { h: 2.1, plinth: 0.5, pw: 0.9 }); }
        { const a = d.areas.find((q) => q.id === 'w1454535798'); if (a) { const [x, z] = centroid(a.poly); ctx.skipAreas.add(a.id); standingFigure(b, ctx, x, z, Math.atan2(mem.x - x, mem.z - z), { h: 3.2, plinth: 0.9, pw: 2.2, metal: '#3b3a36' }); } } // Iuliu Maniu memorial (bronze figure on a low base)
        ctx.add(b.build('revolution', { matOverrides: { [fBCU.key]: fBCU.mat, [fCC.key]: fCC.mat, ...matX, balustrade: balustradeMaterial() } }));
        // ---- backdrop: Calea Victoriei eclectic façades, the garden, lamps, traffic
        ctx.terrainOpts = { bg: '#8b8780', bgMask: 'slab', innerPx: 2048, innerStep: 3, outerStep: 16, outerPad: 700 };
        bucBackdrop(ctx, { lampStyle: 'lantern', lampColor: '#1b1d1e', lampH: 4.6, lampPad: 30, treeLod: { cap: 1200, max: 400 }, lampOpts: { spacing: 26, kinds: ['secondary', 'tertiary', 'residential', 'living_street', 'pedestrian'] }, streetTreeOpts: { kinds: ['tertiary', 'residential'], prob: 0.5 } });
        if (garden) { ctx.painter.poly(garden, '#5f7d3f', 'grass'); const r = rng(3), bb = polyBox(garden); const axis = AT ? [local(AT, 30, 0), local(AT, 110, 0)] : null; for (let i = 0; i < 90; i++) { const x = bb.x0 + r() * (bb.x1 - bb.x0), z = bb.z0 + r() * (bb.z1 - bb.z0); const onAxis = axis && Math.abs((x - axis[0].x) * (axis[1].z - axis[0].z) - (z - axis[0].z) * (axis[1].x - axis[0].x)) / 80 < 14; if (inPoly(x, z, grow(garden, -3)) && !onAxis && !(at && inPoly(x, z, grow(at.poly, 6)))) ctx.trees.push(r() < 0.4 ? { x, z, kind: 'con', s: 1.25 + r() * 0.5, keep: true } : { x, z, kind: 'broad', s: 1.1 + r() * 0.6, keep: true }); }
            // (fidelity pass 2026-11-12; Street View 2023) the garden is closed by a white stone balustrade on a low wall and
            // shaded by tall old trees, many of them conifers; it was an open lawn with 16 small trees. The balustrade follows
            // the mapped garden outline (open where a mapped path crosses it); tree positions are estimates.
            { const gb = new GeoBatch(), ring = grow(garden, -0.6), foot = d.ways.filter((w) => ['footway', 'path', 'pedestrian', 'steps', 'service'].includes(w.k)), yb = g.heightAt(...centroid(garden));
                const cross = (a, c) => { const out = []; for (const w of foot) for (let i = 1; i < w.pts.length; i++) { const [px, pz] = w.pts[i - 1], [qx, qz] = w.pts[i], d1x = c[0] - a[0], d1z = c[1] - a[1], d2x = qx - px, d2z = qz - pz, den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-9) continue; const t = ((px - a[0]) * d2z - (pz - a[1]) * d2x) / den, u = ((px - a[0]) * d1z - (pz - a[1]) * d1x) / den; if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push(t); } return out.sort((m, n) => m - n); };
                for (let i = 0; i < ring.length; i++) { const A = ring[i], B = ring[(i + 1) % ring.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 1) continue; const cuts = cross(A, B), gap = 2.2 / L; let t0 = 0;
                    const seg = (ta, tb) => { if ((tb - ta) * L < 1.2) return; const P0 = [A[0] + (B[0] - A[0]) * ta, A[1] + (B[1] - A[1]) * ta], P1 = [A[0] + (B[0] - A[0]) * tb, A[1] + (B[1] - A[1]) * tb]; gb.box((P0[0] + P1[0]) / 2, yb - 0.2, (P0[1] + P1[1]) / 2, 0.42, 0.65, (tb - ta) * L, '#e6e0d2', 'stone', Math.atan2(B[0] - A[0], B[1] - A[1])); balustrade(gb, [P0, P1], yb + 0.45, 0.85, { colour: '#f1ece0' }); ctx.collider({ wall: true, ax: P0[0], az: P0[1], bx: P1[0], bz: P1[1], y0a: yb - 1, y1a: yb + 1.3, y0b: yb - 1, y1b: yb + 1.3, x: (P0[0] + P1[0]) / 2, z: (P0[1] + P1[1]) / 2, r: (tb - ta) * L / 2 + 0.5 }); };
                    for (const c of cuts) { seg(t0, c - gap); t0 = c + gap; } seg(t0, 1); }
                ctx.add(gb.build('athenaeum-garden-balustrade', { matOverrides: { balustrade: balustradeMaterial() } })); }
        }
        ctx.painter.custom((x, T, k) => { const [px, py] = T(mem.x, mem.z); x.strokeStyle = '#c9c0b4'; x.lineWidth = 1.5 * k; x.beginPath(); x.arc(px, py, 14 * k, 0, 7); x.stroke(); });
        // name signs of the mapped venues facing the walk (hotels, museums, banks, cafés, shops), each on its own building
        { const eb = polyBox(sp.extent.polygon), near = (x, z) => x > eb.x0 - 40 && x < eb.x1 + 40 && z > eb.z0 - 40 && z < eb.z1 + 40;
            const big = d.buildings.filter((q) => !q.part && q.name && /hotel|theatre|library/.test(`${q.tourism || ''} ${q.amenity || ''} ${q.k || ''}`) && !['w16291602', 'r19896250'].includes(q.id)).map((q) => { const [x, z] = centroid(q.poly); return { id: q.id, name: q.name.replace(/ Bucharest, by IHG$/, ''), x, z, big: true }; });
            const S = poiSigns(ctx, { inside: near, extra: big, max: 80, accept: (p) => !!(p.shop && p.shop !== 'vacant') || ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'bank', 'cinema', 'theatre', 'arts_centre', 'casino'].includes(p.amenity) || ['hotel', 'museum', 'gallery'].includes(p.tourism) });
            ctx.extras.venueSigns = { signs: S.signs.map((q) => ({ source: q.source, text: q.text })), skipped: S.skipped };
            const SA = signAtlas(S.signs, { name: 'venue-signs', night: 0.7 }); if (SA) ctx.add(SA); }
        ctx.extras.mappedTrees = mappedTreeSizes(ctx);
        cityFiller(ctx, { ring: 600 });
        const way = (id) => d.ways.find((w) => w.id === id)?.pts || [];
        addTraffic(ctx, { lanes: [{ pts: [...way('w180685587').slice().reverse(), ...way('w668989981').slice().reverse(), ...way('w668989983').slice().reverse(), ...way('w244668685').slice().reverse(), ...way('w186554856').slice().reverse(), ...way('w139713885').slice().reverse()], n: 5, speed: 9 }], parked: [] });
        // plaques
        const PL = sp.plaques;
        if (AT) { const p0 = local(AT, 33, -17), p1 = local(AT, 33, 17); const yaw = AT.lm.rotation + Math.PI / 2; ctx.plaque(PL[0], p0.x, p0.z, yaw, { style: 'bronze', credit: 'Architect Albert Galleron (1886–88).' }); ctx.plaque(PL[1], p1.x, p1.z, yaw, { style: 'bronze', credit: 'Fresco by Costin Petrescu (1933–38).' }); }
        ctx.plaque(PL[2], -84, -4, Math.PI / 2, { style: 'city' });
        if (balcony) ctx.plaque(PL[3], balcony.x, balcony.z + 4, -Math.PI / 2, { style: 'bronze' });
        ctx.plaque(PL[4], MEM.x - 12, MEM.z + 4, Math.PI / 2, { style: 'city', credit: 'Memorial of Rebirth (2005), sculptor Alexandru Ghilduș.' });
        ctx.plaque(PL[5], carol.x + 5, carol.z + 4, Math.PI * 0.75, { style: 'bronze', credit: 'After Ivan Meštrović (1930); recreated by Florin Codre (2010).' });
        // Frame visible exterior details from the garden. The historic fundraising
        // campaign belongs on the plaques; no current donation box is verified.
        if (AT) { const start = local(AT, 76, -8), column = local(AT, 26.2, -12), frieze = local(AT, 27.2, 0), dome = local(AT, 8.4, 0);
            photoHunt(ctx, { ...start, title: 'Frame the Athenaeum', unavailable: 'The concert hall interior is not modelled; this visit stays in the public garden.', targets: [
                { label: 'An Ionic portico column', ...column, y: AT.y + 9, radius: 1.4 },
                { label: 'ATHENEUL ROMAN above the portico', ...frieze, y: AT.y + 15.3, radius: 1.2 },
                // Front rib at the canonical lathe profile radius12.4 / original rise10.
                // The model scales its roof rise to the literal41m total.
                { label: 'The ribbed dome', ...dome, y: AT.y + 27.7 + 10 * (41-27.7)/(47.4-27.7), radius: 1.6, surfaceTolerance: 2 },
            ], onDone: s => bucActivity(s, 'athenaeum-revolution', 'concert-hall', '📷 Athenaeum details', 'You framed the Ionic portico, inscription and dome from the garden.') });
        }
        if (balcony) ctx.interactables.push({ x: balcony.x, z: balcony.z, r: 4, label: 'Stand below the balcony (21 December 1989)', use: (s) => { s.ui.toast('21 December 1989', 'Ceaușescu\'s last speech from this balcony was booed by the crowd; he fled by helicopter from the roof the next day.'); s.sound.play('crowd', 0.6); } });
        // postcard: from the garden in front of the portico, looking back at the portico and the dome (the research point
        // lies at the building's south side; the portico faces the garden / Calea Victoriei)
        if (AT) { const cp = local(AT, 56, 7), hd = (Math.atan2(AT.x - cp.x, -(AT.z - cp.z)) * 180 / Math.PI + 360) % 360; ctx.challenge('athenaeum-revolution', { view: [AT.x, AT.z], x: cp.x, z: cp.z, heading: hd, r: 12, tol: 26 }); const sp2 = local(AT, 56, -8); ctx.spawns['athenaeum-revolution'] = { x: sp2.x, z: sp2.z, heading: headingFromBearing((Math.atan2(AT.x - sp2.x, -(AT.z - sp2.z)) * 180 / Math.PI + 360) % 360) }; }
        else ctx.challenge('athenaeum-revolution', { r: 12, tol: 30 });
        // crowd
        ctx.crowdCfg = {
            personas: { local_young: 3, local_elder: 2, tourist_fr: 1.5, tourist_de: 1.5, tourist_us: 1.5, local_parent: 1, kid: 0.5 },
            walkers: 40, paths: ctx.footLines(),
            groups: [
                ...(AT ? [{ x: local(AT, 40, 4).x, z: local(AT, 40, 4).z, r: 4, n: 7, act: 'photo', look: [AT.x, AT.z], personas: ['tourist_fr', 'tourist_de', 'tourist_us'] }, { x: local(AT, 36, -6).x, z: local(AT, 36, -6).z, r: 0.3, n: 1, act: 'guide', look: [local(AT, 40, 4).x, local(AT, 40, 4).z], personas: ['tour_guide'] }, { x: local(AT, 34, 9).x, z: local(AT, 34, 9).z, r: 2.5, n: 5, act: 'talk', personas: ['local_elder', 'local_young'] }] : []),
                { x: MEM.x + 4, z: MEM.z + 9, r: 3, n: 5, act: 'photo', look: [MEM.x, MEM.z], personas: ['tourist_de', 'tourist_us', 'local_young'] },
                { x: MEM.x + 3, z: MEM.z - 3, r: 0.3, n: 1, act: 'watch', personas: ['guard'] },
                { x: MEM.x - 8, z: MEM.z + 6, r: 1, n: 3, act: 'sit', personas: ['local_elder', 'local_young'] },
                { x: -60, z: 10, r: 0.3, n: 1, act: 'perform', personas: ['busker'], prop: 'guitar' },
            ],
        };
        ctx.sound('traffic', -60, 120, 140, 0.9); ctx.sound('crowd', -30, 0, 50, 0.5); ctx.sound('birds', -80, -10, 60, 0.6); ctx.sound('water', MEM.x, MEM.z + 40, 40, 0.3);
        if (!ctx.spawns['athenaeum-revolution']) ctx.spawns['athenaeum-revolution'] = { x: sp.spawn.x, z: sp.spawn.z, heading: headingFromBearing(sp.spawn.heading_deg) };
    },
};
