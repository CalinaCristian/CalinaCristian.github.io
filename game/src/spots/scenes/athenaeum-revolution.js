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
import { bucBackdrop, bucStyle, classicFacade, classicWalls, osmPoly, cityFiller, placeLandmark, signAtlas, balustrade, balustradeMaterial, flagpole, floodlight, bucActivity, palisade } from '../buc.js';
import { photoHunt } from '../photo-hunt.js';
import { bench } from '../osm.js';
import { addTraffic } from '../cars.js';
import { mappedTreeSizes, poiSigns, bust, standingFigure } from '../buc-streetscape.js';
import { aisleParking } from './ctr-parking.js';
import { osmBarriers } from '../buc-barriers.js';

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
    // (round 2, 2026-11-12; Street View, 2024, from Calea Victoriei) The spire is plain white from base to tip, and the
    // "crown" is a dark, roughly spherical woven mass threaded on it at about three quarters of its height. It was a
    // ring of spikes at 15 m over a red band on the shaft (the 2012 paint is no longer there). Sizes are estimates.
    b.add(new THREE.CylinderGeometry(0.15, 1.9, 25, 3), 'stone', M(x, y + 0.7 + 12.5, z, 0, 0.3, 0), '#ece9e3');
    const r = rng(14), cy = y + 0.7 + 18.2, CR = '#3a352d';
    b.sphere(x, cy, z, 1.75, 1.5, 1.75, CR, 'metal', 12, 8);
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, e = (r() - 0.5) * 1.6, a2 = a + 0.9 + r() * 1.2, e2 = (r() - 0.5) * 1.6, P = (aa, ee) => [x + Math.cos(aa) * Math.cos(ee) * 1.86, cy + Math.sin(ee) * 1.6, z + Math.sin(aa) * Math.cos(ee) * 1.86]; b.rod(P(a, e), P(a2, e2), 0.09 + r() * 0.05, '#2c2822', 'metal', 4); }
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
            // (round 2; Street View 2024 from Calea Victoriei at the south wing) The piano nobile has tall round-arched
            // windows with balustraded sills between the pilasters and a low attic of small square windows above; it
            // was a storey of pedimented and one of plain rectangular windows.
            const fRG = classicFacade('royal-palace', [{ t: 'arch', w: 0.36, rustic: true, top: 0.2 }, { t: 'arch', w: 0.36, pil: 'pair', rail: true, top: 0.12, bottom: 0.14 }, { t: 'small', w: 0.24, pil: 'pair', dentils: true, top: 0.34 }, { t: 'small', w: 0.26 }], { bay: 4.6, floor: 17.5 / 3, lit: 0.3 });
            const y = Math.min(...rg.poly.map(([x, z]) => g.heightAt(x, z))) - 0.2, H = 17.5;
            classicWalls(b, fRG, rg.poly, y, y + H, '#e1d6bc', y); for (const hole of rg.holes || []) classicWalls(b, fRG, [...hole].reverse(), y, y + H, '#e1d6bc', y);
            b.prism(grow(rg.poly, 0.7), y + H - 0.7, y + H, '#ebe2cd', 'stone', { noTop: true }); b.flat(rg.poly, y + H, '#8f8d88', 'roofs'); balustrade(b, grow(rg.poly, 0.3), y + H, 1.0, { closed: true });
            ctx.poly(rg.poly, { y0: y - 1, y1: y + 30 }); matX[fRG.key] = fRG.mat;
            // The palace railings on Calea Victoriei and across the court (OSM barrier=fence ways; 1478814648, 1476829138
            // and 1476829137 are tagged height=2, material=metal over a 0.5 m wall): black iron on a low stone base,
            // as seen from the street. The two court ways carry no height tag: same build assumed.
            const rails = []; for (const id of ['w1478814648', 'w1476829138', 'w1476829137', 'w1457045952', 'w1457045969']) { const w = d.ways.find((q) => q.id === id || q.id === id + '_b'); if (!w || w.pts.length < 2) continue; Object.assign(matX, palisade(ctx, b, w.pts, { h: 1.5, plinth: 0.5, post: 3.2, plinthCol: '#cfc7b5', postCol: '#15181a' })); rails.push(id); }
            ctx.extras.palaceRailings = rails; }
        // Central University Library (eclectic, three storeys, domed corner pavilions)
        const bcu = d.buildings.find((x) => x.id === 'r19896250');
        const fBCU = classicFacade('bcu', [{ t: 'portal', w: 0.42, rustic: true }, { t: 'arch', w: 0.34, pil: 'pair', rail: true }, { t: 'pediment', w: 0.32, pil: 'pair' }, { t: 'small', w: 0.26, dentils: true }], { bay: 4.4, floor: 5.2, lit: 0.4 });
        if (bcu) { ctx.skipBuildings.add(bcu.id); const y = Math.min(...bcu.poly.map(([x, z]) => g.heightAt(x, z))) - 0.2; classicWalls(b, fBCU, bcu.poly, y, y + 20.8, '#e4dac3', y); b.prism(grow(bcu.poly, 0.8), y + 20.2, y + 21.0, '#ece4d2', 'stone', { noTop: true }); b.flat(bcu.poly, y + 21, '#8a8a86', 'roofs'); balustrade(b, grow(bcu.poly, 0.4), y + 21, 1.1, { closed: true }); b.prism(grow(bcu.poly, -1.6), y + 21, y + 24.6, '#474c52', 'roofs'); /* dark slate mansard behind the balustrade, as on the real library; height estimated */
            // (round 2; Street View 2024) The slate domes stand on the two rounded corner pavilions of the front on the
            // square (tall, with a lantern), sized to the mapped pavilion outline. They were two hemispheres on the
            // block's long axis, hidden from the square. Dome rise and lantern are estimates.
            const corner = (ax, az) => { const m = bcu.poly.filter(([px, pz]) => Math.hypot(px - ax, pz - az) < 8.5); if (m.length < 5) return null; const cx = m.reduce((t, q) => t + q[0], 0) / m.length, cz = m.reduce((t, q) => t + q[1], 0) / m.length; return [cx, cz, m.reduce((t, q) => t + Math.hypot(q[0] - cx, q[1] - cz), 0) / m.length]; };
            const domes = [corner(-23.5, 144.5), corner(-42, 105)].filter(Boolean); ctx.extras.bcuDomes = domes.map((q) => ({ x: +q[0].toFixed(1), z: +q[1].toFixed(1), r: +q[2].toFixed(1) }));
            for (const [cx, cz, r0] of domes) { const rr = Math.min(6, Math.max(3.6, r0 + 0.5)), hh = rr * 1.3; b.cyl(cx, y + 21, cz, rr, 1.2, '#e4dac3', 'stone', 16); b.add(new THREE.SphereGeometry(rr, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', M(cx, y + 22.2, cz, 0, 0, 0, 1, hh / rr, 1), '#474c52');
                b.cyl(cx, y + 22.2 + hh - 0.3, cz, rr * 0.2, 1.8, '#565b60', 'metal', 8); b.cyl(cx, y + 22.2 + hh + 1.5, cz, rr * 0.24, 1.3, '#474c52', 'metal', 8, 0.1); }
            ctx.poly(bcu.poly, { y0: y - 1, y1: y + 30 }); }
        // former Central Committee building (Ministry of Internal Affairs) with the 1989 balcony toward the square
        const cc = d.buildings.find((x) => x.id === 'w224624034');
        const fCC = classicFacade('cc-building', [{ t: 'rect', w: 0.34, rustic: true }, { t: 'rect', w: 0.3, pil: true }, { t: 'rect', w: 0.3, pil: true }, { t: 'rect', w: 0.28, pil: true, dentils: true }], { bay: 3.6, floor: 3.8, lit: 0.4 });
        let balcony = null;
        if (cc) { ctx.skipBuildings.add(cc.id); const y = Math.min(...cc.poly.map(([x, z]) => g.heightAt(x, z))) - 0.2, H = 26; classicWalls(b, fCC, cc.poly, y, y + H, '#e8e4da', y); b.prism(grow(cc.poly, 0.9), y + H - 0.8, y + H, '#efebe3', 'stone', { noTop: true }); b.flat(cc.poly, y + H, '#8a8784', 'roofs'); ctx.poly(cc.poly, { y0: y - 1, y1: y + 30 });
            // balcony on the west front (facing the square) above the entrance portico
            // (round 3, 2026-11-13; Street View 2024 from the car park, 44.43879, 26.09780) The front on the square is white
            // stone: two projecting wings and a recessed centre, each with giant engaged columns through four storeys over a
            // rusticated ground floor with arched openings, two attic storeys above the cornice (7 levels as mapped). The
            // 1989 balcony runs across the recessed centre above its three arched doors; it stood on the north wing.
            // Column rhythm and heights are estimates.
            const west = []; for (let i = 0; i < cc.poly.length; i++) { const [ax, az] = cc.poly[i], [bx2, bz2] = cc.poly[(i + 1) % cc.poly.length], L = Math.hypot(bx2 - ax, bz2 - az); if (L < 20) continue; let nx = (bz2 - az) / L, nz = -(bx2 - ax) / L; const mx = (ax + bx2) / 2, mz = (az + bz2) / 2; if (inPoly(mx + nx * 0.6, mz + nz * 0.6, cc.poly)) { nx = -nx; nz = -nz; } if (nx > -0.9) continue; west.push({ mx, mz, ux: (bx2 - ax) / L, uz: (bz2 - az) / L, L, ax, az, nx, nz }); }
            { const x0 = Math.min(...west.map((e) => e.mx)); for (let i = west.length - 1; i >= 0; i--) if (west[i].mx > x0 + 30) west.splice(i, 1); } // the square front, not courtyard walls
            west.sort((p, q) => p.mz - q.mz); const best = west.length ? west[Math.floor(west.length / 2)] : null;
            for (const e of west) { const n = Math.max(2, Math.round(e.L / 3.6)); for (let k = 0; k <= n; k++) { const u = (k / n) * e.L, cx2 = e.ax + e.ux * u + e.nx * 0.55, cz2 = e.az + e.uz * u + e.nz * 0.55; b.cyl(cx2, y + 5.2, cz2, 0.5, 14.6, '#f1eee7', 'stone', 10); b.box(cx2, y + 19.8, cz2, 1.3, 0.5, 1.3, '#efebe3', 'stone', Math.atan2(e.ux, e.uz)); }
                b.box(e.mx + e.nx * 0.6, y + 4.8, e.mz + e.nz * 0.6, 1.4, 0.4, e.L, '#e2ddd2', 'stone', Math.atan2(e.ux, e.uz)); b.box(e.mx + e.nx * 0.6, y + 20.3, e.mz + e.nz * 0.6, 1.5, 0.7, e.L, '#e2ddd2', 'stone', Math.atan2(e.ux, e.uz)); }
            ctx.extras.ccFront = { faces: west.length, balconyFace: best ? [+best.mx.toFixed(1), +best.mz.toFixed(1)] : null };
            if (best) { const nx = best.nx, nz = best.nz, a = Math.atan2(best.ux, best.uz); const bx3 = best.mx + nx * 1.4, bz3 = best.mz + nz * 1.4; b.box(bx3, y + 7.6, bz3, 2.8, 0.45, 10, '#e2dbc9', 'stone', a); balustrade(b, [[bx3 + nx * 1.3 - best.ux * 5, bz3 + nz * 1.3 - best.uz * 5], [bx3 + nx * 1.3 + best.ux * 5, bz3 + nz * 1.3 + best.uz * 5]], y + 8.05, 1.1); for (const s of [-1, -0.33, 0.33, 1]) { const q = [best.mx + nx * 2.6 + best.ux * s * 4.6, best.mz + nz * 2.6 + best.uz * s * 4.6]; b.cyl(q[0], y, q[1], 0.42, 7.6, '#ece6d8', 'stone', 12); ctx.circle(q[0], q[1], 0.45, 8); } balcony = { x: best.mx + nx * 14, z: best.mz + nz * 14 }; void a; }
            for (const [z0, k] of [[-6, 'ro'], [6, 'eu']]) { if (!best) break; const f = flagpole(best.mx - 0.8 + best.ux * z0, y + 12, best.mz + best.uz * z0, 4, k, { yaw: Math.PI }); f.group.rotation.z = 0.5; ctx.add(f.group); }
        }
        const mem = d.pois.find((p) => p.id === 'n1393030628') || { x: -15.6, z: 217.9 };
        for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (Math.hypot(cx - mem.x, cz - mem.z) < 14) ctx.skipBuildings.add(x.id); }
        const MEM = memorial(b, ctx, mem.x, mem.z);
        // (round 3, 2026-11-13) Zidul amintirii, the Wall of Remembrance (OSM ways 1454592908 / 1454592909, barrier=wall,
        // description "Zidul amintirii"): two curved stone walls on the memorial plaza, open on the axis between them, at
        // their mapped polylines. Height and thickness are not mapped: estimates.
        { const WH = 1.6, WT = 0.45; ctx.extras.rememberWall = [];
            for (const id of ['w1454592908', 'w1454592909']) { const w = d.ways.find((q) => q.id === id || q.id === id + '_b'); if (!w || w.pts.length < 2) continue; ctx.skipWays?.add?.(w.id); ctx.extras.rememberWall.push(id);
                for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue; const cx = (ax + bx) / 2, cz = (az + bz) / 2, yw = Math.min(g.heightAt(ax, az), g.heightAt(bx, bz)), a = Math.atan2(bx - ax, bz - az);
                    const k = (i % 2) * 0.03; // (neighbouring overlapping pieces never share a plane)
                    b.box(cx, yw - 0.35 - k, cz, WT, WH + 0.32 + 2 * k, L + WT * 0.6, '#d3cdc2', 'stone', a); b.box(cx, yw + WH + k, cz, WT + 0.12, 0.1, L + WT * 0.6 + 0.06, '#e2ddd3', 'stone', a);
                    ctx.collider({ wall: true, ax, az, bx, bz, y0a: yw - 1, y1a: yw + WH, y0b: yw - 1, y1b: yw + WH, x: cx, z: cz, r: L / 2 + 0.5 }); } } }
        ctx.painter.custom((x, T, k) => { const [px, py] = T(mem.x, mem.z); x.fillStyle = '#a39c94'; x.beginPath(); x.arc(px, py, 22 * k, 0, 7); x.fill(); });
        const carol = d.pois.find((p) => p.id === 'n1883108499') || { x: -51.1, z: 133.4 };
        // (round 2) OSM node 1883108499 gives height=13 for the monument; it was about 9.7 m. Plinth and bronze share
        // the mapped total about half and half, as seen from Calea Victoriei.
        equestrian(b, ctx, carol.x, carol.z, Math.PI * 0.55, { plinth: +carol.height > 6 ? +carol.height * 0.51 : 6.6, s: +carol.height > 6 ? (+carol.height * 0.49 - 0.45) / 3.57 : 1.67 });
        // Memorial Revoluție (OSM way 996044652: historic=memorial, memorial=sculpture, material=marble, a 6 m × 6 m
        // outline in front of the former Central Committee building; not in the scene extract of 2026-11-07). Its form
        // could not be seen from the street panoramas (trees): a plain low marble block stands on the mapped outline.
        // (round 3, 2026-11-13; Street View 2024 from the car park, 44.43851, 26.09789) It is a white marble wedge lying on
        // the lawn before the central doors: a slab rising from the grass at its south end to about 1.4 m at its north
        // end. Size, rise and orientation are estimates on the mapped 6 m outline.
        { const q = ctx.ll(44.438593, 26.098249), yq = g.heightAt(q.x, q.z), L = 5.6, W = 2.6, Hh = 1.4, ws = new THREE.BufferGeometry();
            const V = [[-W / 2, 0, -L / 2], [W / 2, 0, -L / 2], [W / 2, 0, L / 2], [-W / 2, 0, L / 2], [-W / 2, Hh, -L / 2], [W / 2, Hh, -L / 2]];
            ws.setAttribute('position', new THREE.Float32BufferAttribute(V.flat(), 3)); ws.setIndex([0, 1, 2, 0, 2, 3, 4, 3, 2, 4, 2, 5, 0, 4, 5, 0, 5, 1, 0, 3, 4, 1, 5, 2]); const wg = ws.toNonIndexed(); ws.dispose(); wg.computeVertexNormals();
            b.add(wg, 'stone', M(q.x, yq - 0.05, q.z, 0, 0.35, 0), '#f2f0ea'); wg.dispose(); ctx.box(q.x, q.z, W / 2, L / 2, 0.35, { y0: yq - 1, y1: yq + Hh }); ctx.extras.revolutionMemorial = { source: 'w996044652', x: q.x, z: q.z, formEstimated: true, form: 'wedge' }; }
        // (round 3, 2026-11-13) the long pool south of Calea Victoriei 68–70 (OSM w175449008, natural=water) with its row of
        // seven jets (OSM nodes 2468477097–2468477123, amenity=fountain) was a flat blue paint on the paving. Now a low stone
        // basin on the mapped outline, the water just under its coping, a jet at each mapped node. Rim and jet heights are
        // estimates.
        const pool = osmPoly(d, 'w175449008'), poolJets = ['n2468477097', 'n2468477098', 'n2468477099', 'n2468477103', 'n2468477121', 'n2468477122', 'n2468477123'].map(node => d.pois.find((p) => p.id === node)).filter(Boolean);
        if (pool) { ctx.skipAreas.add('w175449008'); const yq = Math.min(...pool.map(([x, z]) => g.heightAt(x, z))), rim = grow(pool, 0.35);
            b.prism(rim, yq - 0.2, yq + 0.45, '#cfc8ba', 'stone', { noTop: true }); b.prism(pool, yq - 0.2, yq + 0.45, '#b9b2a4', 'stone', { noTop: true });
            const n = pool.length, R = (i) => rim[(i + n - 1) % n]; // (grow() returns the ring starting at the second vertex)
            for (let i = 0; i < n; i++) { const A = pool[i], B = pool[(i + 1) % n], C = R(i + 1), E = R(i); b.quad([A[0], yq + 0.45, A[1]], [B[0], yq + 0.45, B[1]], [C[0], yq + 0.45, C[1]], [E[0], yq + 0.45, E[1]], '#ddd6c8', 'stone'); b.quad([E[0], yq + 0.45, E[1]], [C[0], yq + 0.45, C[1]], [B[0], yq + 0.45, B[1]], [A[0], yq + 0.45, A[1]], '#ddd6c8', 'stone'); }
            b.flat(pool, yq + 0.3, '#3d6470', 'water'); ctx.poly(rim, { y0: yq - 1, y1: yq + 0.45, prop: true });
            if (poolJets.length) { const jg = new THREE.CylinderGeometry(0.04, 0.16, 1.0, 6, 1, true); // (about a metre high in Street View 2024)
                const jm = new THREE.InstancedMesh(jg, new THREE.MeshStandardMaterial({ color: '#e9f4f7', transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }), poolJets.length); jm.name = 'fountain-jets-revolution'; const m4 = new THREE.Matrix4(); poolJets.forEach((p, i) => { m4.makeTranslation(p.x, yq + 0.3 + 0.5, p.z); jm.setMatrixAt(i, m4); }); ctx.add(jm); }
            ctx.extras.revolutionPool = { source: 'w175449008', jets: poolJets.map((p) => p.id) }; }
        // (round 3, 2026-11-13) OSM building:part w1476833908 (31–31.5 m, no parent relation, no footprint under it) reaches
        // 20 m south of Bl. 8 over the garden behind Kretzulescu church: it stood as a floating roof slab. Street View
        // (2024, from Calea Victoriei 47 at bearing 230, and from the garden path under it) shows open sky there. Not drawn;
        // kept in the record as an unresolved source contradiction (builder findings).
        ctx.skipBuildings.add('w1476833908'); ctx.extras.sourceContradictions = [{ id: 'w1476833908', why: 'elevated part without base; open sky in Street View 2024' }];
        // ---- (fidelity pass 2026-11-12) what OSM maps on the square and the scene did not show
        // Kretzulescu church (OSM w1476760553, 1722): bare red brick with pale bands, two towers with dark domes.
        // Modelled on the mapped outline (it was a generic plastered house); heights are estimates.
        const kr = d.buildings.find((x) => x.id === 'w1476760553');
        if (kr) { ctx.skipBuildings.add(kr.id); for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (x.part && inPoly(cx, cz, grow(kr.poly, 1))) ctx.skipBuildings.add(x.id); } const p = kr.poly, y = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) - 0.2, o = obb(p);
            const fK = classicFacade('kretzulescu', [{ t: 'arch', w: 0.22, top: 0.34, cornice: false }, { t: 'niches', n: 3, top: 0.2, bottom: 0.3 }, { t: 'blank', cornice: false }, { t: 'blank' }], { bay: 2.8, floor: 3.6, stripes: { brick: '#9a4a32', band: '#b98267' }, lit: 0.2 });
            classicWalls(b, fK, p, y, y + 9.4, '#ffffff', y); b.prism(grow(p, 0.5), y + 9.2, y + 9.6, '#b2603f', 'stone', { noTop: true });
            b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.3, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), 'metal', M(o.cx, y + 10.8, o.cz, 0, -o.angle, 0, o.len + 1, 2.4, o.wid + 1), '#4f5456');
            for (const [k, r0, h0] of [[-0.24, 2.6, 8.5], [0.16, 3.1, 7.5]]) { const tx = o.cx + o.ux * o.len * k, tz = o.cz + o.uz * o.len * k, oct = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; oct.push([tx + Math.cos(a) * r0, tz + Math.sin(a) * r0]); }
                classicWalls(b, fK, oct, y + 10.2, y + 10.2 + h0, '#ffffff', y + 10.2); b.add(new THREE.SphereGeometry(r0 * 1.06, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', M(tx, y + 10.2 + h0, tz, 0, 0, 0, 1, 1.25, 1), '#4f5456'); /* (round 3: OSM parts w1476760555/556 roof:shape=dome; round domes in Street View 2024, they were cones) */ b.box(tx, y + 10.2 + h0 + r0 * 1.32, tz, 0.12, 1.5, 0.12, '#c9a24e', 'bronze'); b.box(tx, y + 11.2 + h0 + r0 * 1.32, tz, 0.8, 0.1, 0.1, '#c9a24e', 'bronze'); }
            ctx.poly(p, { y0: y - 1, y1: y + 24 }); matX[fK.key] = fK.mat; }
        // busts and statues at their mapped nodes (stylised bronze volumes; no sculptor is credited: no plaque text is sourced)
        const node = (id) => d.pois.find((p) => p.id === id);
        for (const id of ['n7483056723', 'n11182793898', 'n11182793914']) { const p = node(id); if (p) bust(b, ctx, p.x, p.z, Math.atan2(-60 - p.x, 250 - p.z), { plinth: 1.9 }); }
        for (const id of ['n11068954269', 'n11068954270', 'n11068954271']) { const p = node(id); if (p) standingFigure(b, ctx, p.x, p.z, Math.PI / 2, { h: 2.1, plinth: 0.5, pw: 0.9 }); }
        { const a = d.areas.find((q) => q.id === 'w1454535798'); if (a) { const [x, z] = centroid(a.poly); ctx.skipAreas.add(a.id); standingFigure(b, ctx, x, z, Math.atan2(mem.x - x, mem.z - z), { h: 3.2, plinth: 0.9, pw: 2.2, metal: '#3b3a36' }); } } // Iuliu Maniu memorial (bronze figure on a low base)
        ctx.add(b.build('revolution', { matOverrides: { [fBCU.key]: fBCU.mat, [fCC.key]: fCC.mat, ...matX, balustrade: balustradeMaterial() } }));
        // ---- backdrop: Calea Victoriei eclectic façades, the garden, lamps, traffic
        ctx.terrainOpts = { bg: '#8b8780', bgMask: 'slab', innerPx: 2048, innerStep: 3, outerStep: 16, outerPad: 700 };
        // w958584624 (Calea Victoriei 68–70, building=apartments, 7 levels, start_date 1954 in live OSM) is a stone
        // neoclassical block in Street View 2024; the levels rule would give it the 1980s `bloc` look.
        const STYLE_BY_ID = { w958584624: 'eclectic' };
        bucBackdrop(ctx, { style: (bd) => STYLE_BY_ID[bd.id] || bucStyle(bd), lampStyle: 'lantern', lampColor: '#1b1d1e', lampH: 4.6, lampPad: 30, treeLod: { cap: 1200, max: 400 }, lampOpts: { spacing: 26, kinds: ['secondary', 'tertiary', 'residential', 'living_street', 'pedestrian'] }, streetTreeOpts: { kinds: ['tertiary', 'residential'], prob: 0.5 } });
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
            // (round 2) no name for what live OSM marks as closed: Hotel Lido (way 162494340, disused:tourism=hotel)
            // and any venue node with a disused:* key (English Bar, node 2463617058)
            const closed = (p) => Object.keys(p).some((k) => /^(disused|abandoned|was)(:|$)/.test(k));
            const big = d.buildings.filter((q) => !q.part && q.name && /hotel|theatre|library/.test(`${q.tourism || ''} ${q.amenity || ''} ${q.k || ''}`) && !['w16291602', 'r19896250', 'w162494340'].includes(q.id)).map((q) => { const [x, z] = centroid(q.poly); return { id: q.id, name: q.name.replace(/ Bucharest, by IHG$/, ''), x, z, big: true }; });
            const S = poiSigns(ctx, { inside: near, extra: big, max: 80, accept: (p) => !closed(p) && (!!(p.shop && p.shop !== 'vacant') || ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'bank', 'cinema', 'theatre', 'arts_centre', 'casino'].includes(p.amenity) || ['hotel', 'museum', 'gallery'].includes(p.tourism)) });
            ctx.extras.venueSigns = { signs: S.signs.map((q) => ({ source: q.source, text: q.text })), skipped: S.skipped };
            const SA = signAtlas(S.signs, { name: 'venue-signs', night: 0.7 }); if (SA) ctx.add(SA); }
        ctx.extras.mappedTrees = mappedTreeSizes(ctx);
        cityFiller(ctx, { ring: 600 });
        const way = (id) => d.ways.find((w) => w.id === id)?.pts || [];
        // (round 3, 2026-11-13) Piața George Enescu (OSM w241119386) and Parcare Piața Revoluției (w239206890) are full
        // surface car parks in Street View (2023/2024); the scene showed empty asphalt. Cars stand only inside the mapped
        // amenity=parking outlines (w23556789, w197638563, w703498155, w239206890, w1155809062, and w23556698: the lot before
        // the former Central Committee building, packed in Street View 2024), along their mapped parking aisles; the bay
        // layout is not mapped (perpendicular bays are an estimate). The Memorial Revoluție lawn stays clear.
        const memQ = ctx.ll(44.438593, 26.098249);
        const parked = aisleParking(ctx, ['w23556789', 'w197638563', 'w703498155', 'w239206890', 'w1155809062', 'w23556698'], { clear: (x, z) => Math.hypot(x - memQ.x, z - memQ.z) < 7 });
        ctx.extras.parkedCars = parked.length; ctx.extras.parkedList = parked;
        addTraffic(ctx, { merge: true, parked, lanes: [{ pts: [...way('w180685587').slice().reverse(), ...way('w668989981').slice().reverse(), ...way('w668989983').slice().reverse(), ...way('w244668685').slice().reverse(), ...way('w186554856').slice().reverse(), ...way('w139713885').slice().reverse()], n: 5, speed: 9 }] });
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
        // (round 4) the mapped walls, fences and hedges this scene does not draw itself (buc-barriers.js)
        osmBarriers(ctx, { skip: ['w1478814648', 'w1476829138', 'w1476829137', 'w1457045952', 'w1457045969', 'w1454592908', 'w1454592909'] });
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
