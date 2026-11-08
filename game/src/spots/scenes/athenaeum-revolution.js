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
import { bucBackdrop, classicFacade, classicWalls, osmPoly, cityFiller, placeLandmark, signAtlas, balustrade, balustradeMaterial, flagpole, floodlight, narratedVisit } from '../buc.js';
import { bench } from '../osm.js';
import { addTraffic } from '../cars.js';

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
        if (at) ctx.poly(at.poly, { y0: -50, y1: 60 });
        // (the frieze 'ATHENEUL ROMAN' and the gold roundels are in the landmarks.js model since its 2026-11-07 fix)
        const garden = osmPoly(d, 'w23556716');
        // Eminescu statue (bronze, seated poet) in the garden
        { const e = d.pois.find((p) => p.id === 'n1911337561') || { x: -69.3, z: -24.3 }, y = g.heightAt(e.x, e.z); b.box(e.x, y, e.z, 1.3, 2.6, 1.3, '#a9a397', 'stone'); b.cyl(e.x, y + 2.6, e.z, 0.42, 1.55, '#2f3a33', 'bronze', 10, 0.75); b.sphere(e.x, y + 4.35, e.z, 0.22, 0.27, 0.24, '#2f3a33', 'bronze', 10, 8); ctx.circle(e.x, e.z, 1.3, 4); }
        // ---- Piața Revoluției
        const rg = d.buildings.find((x) => x.id === 'w232472401'); if (rg) { ctx.skipBuildings.add(rg.id); for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (x.part && inPoly(cx, cz, rg.poly)) ctx.skipBuildings.add(x.id); } const RG = placeLandmark(ctx, 'regal', { colliderH: 30 }); ctx.poly(rg.poly, { y0: -50, y1: 60 }); }
        // Central University Library (eclectic, three storeys, domed corner pavilions)
        const bcu = d.buildings.find((x) => x.id === 'r19896250');
        const fBCU = classicFacade('bcu', [{ t: 'portal', w: 0.42, rustic: true }, { t: 'arch', w: 0.34, pil: 'pair', rail: true }, { t: 'pediment', w: 0.32, pil: 'pair' }, { t: 'small', w: 0.26, dentils: true }], { bay: 4.4, floor: 5.2, lit: 0.4 });
        if (bcu) { ctx.skipBuildings.add(bcu.id); const y = Math.min(...bcu.poly.map(([x, z]) => g.heightAt(x, z))) - 0.2; classicWalls(b, fBCU, bcu.poly, y, y + 20.8, '#e4dac3', y); b.prism(grow(bcu.poly, 0.8), y + 20.2, y + 21.0, '#ece4d2', 'stone', { noTop: true }); b.flat(bcu.poly, y + 21, '#8a8a86', 'roofs'); balustrade(b, grow(bcu.poly, 0.4), y + 21, 1.1, { closed: true }); const o = obb(bcu.poly); for (const s of [-1, 1]) { const cx = o.cx + o.ux * s * o.len * 0.42, cz = o.cz + o.uz * s * o.len * 0.42; b.add(new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', M(cx, y + 21, cz, 0, 0, 0, 1, 1.3, 1), '#5c6466'); } ctx.poly(bcu.poly, { y0: y - 1, y1: y + 30 }); }
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
        ctx.add(b.build('revolution', { matOverrides: { [fBCU.key]: fBCU.mat, [fCC.key]: fCC.mat, balustrade: balustradeMaterial() } }));
        // ---- backdrop: Calea Victoriei eclectic façades, the garden, lamps, traffic
        ctx.terrainOpts = { bg: '#8b8780', bgMask: 'slab', innerPx: 2048, innerStep: 3, outerStep: 16, outerPad: 700 };
        bucBackdrop(ctx, { lampStyle: 'lantern', lampColor: '#1b1d1e', lampH: 4.6, lampPad: 30, treeLod: { cap: 1200, max: 400 }, lampOpts: { spacing: 26, kinds: ['secondary', 'tertiary', 'residential', 'living_street', 'pedestrian'] }, streetTreeOpts: { kinds: ['tertiary', 'residential'], prob: 0.5 } });
        if (garden) { ctx.painter.poly(garden, '#5f7d3f', 'grass'); const r = rng(3), bb = polyBox(garden); const axis = AT ? [local(AT, 30, 0), local(AT, 110, 0)] : null; for (let i = 0; i < 16; i++) { const x = bb.x0 + r() * (bb.x1 - bb.x0), z = bb.z0 + r() * (bb.z1 - bb.z0); const onAxis = axis && Math.abs((x - axis[0].x) * (axis[1].z - axis[0].z) - (z - axis[0].z) * (axis[1].x - axis[0].x)) / 80 < 14; if (inPoly(x, z, grow(garden, -3)) && !onAxis && !(at && inPoly(x, z, grow(at.poly, 6)))) ctx.trees.push({ x, z, kind: 'broad', s: 0.9 + r() * 0.5 }); } }
        ctx.painter.custom((x, T, k) => { const [px, py] = T(mem.x, mem.z); x.strokeStyle = '#c9c0b4'; x.lineWidth = 1.5 * k; x.beginPath(); x.arc(px, py, 14 * k, 0, 7); x.stroke(); });
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
        // fun: give one leu for the Athenaeum (donation box by the steps)
        if (AT) { const q = local(AT, 31.5, 0); ctx.interactables.push({ x: q.x, z: q.z, r: 2.6, label: 'Give one leu for the Athenaeum', use: (s) => { const P = s.progress; P.lei = (P.lei || 0) + 1; try { localStorage.setItem('dmcv.spots.v1', JSON.stringify(P)); } catch { /* */ } s.ui.toast('🪙 "Dați un leu pentru Ateneu!"', `You gave ${P.lei} leu — the 1880s campaign raised the money for the hall this way.`); s.sound.play('coin', 0.6); } }); }
        // activity (note 57, `lm-ateneu-concert`): sit in on a rehearsal in the domed hall (interior narrated, not modelled)
        if (AT) { const q = local(AT, 28, 6); narratedVisit(ctx, { x: q.x, z: q.z, r: 9, label: 'Read about the concert hall at the entrance', spot: 'athenaeum-revolution', id: 'concert-hall', title: '🎻 Athenaeum history read', body: 'The George Enescu Philharmonic rehearses here; the hall seats about 800 under a 41 m dome.', steps: [
            ['🎻 The foyer', 'Marble columns, a spiral of four stairs up to the round hall.'], ['🎻 The round hall', 'Red velvet, gilded ribs; the orchestra tunes to the oboe\'s A.'], ['🎨 The fresco', 'Costin Petrescu\'s 75 m ring runs from Trajan\'s conquest of Dacia to the 1918 Great Union.'] ] }); }
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
