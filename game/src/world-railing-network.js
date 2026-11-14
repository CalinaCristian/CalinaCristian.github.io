// ============================================================================
//  WORLD RAILING NETWORK — raised-deck railings joined, pruned and drawn; street-level bridge railings; landmark fences
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { emitReviewedStreetBridgeRailings, emitStreetLevelWaterBridgeRailings } from './water-bridge-railings.js';
import { splitMeshByTiles } from './mesh-tiles.js';
import * as THREE from '../vendor/three.module.min.js';
import { clamp, pointInPolygon } from './util.js';
import { rgb } from './geobuild.js';
import { BASARAB_GUARD_STEEL, basarabGuardPlace, drawBasarabGuard } from './basarab-structure.js';
import { bridgeGuardRow, emitBridgeGuard } from './bridge-guards.js';
import { BoxGrid, Y, shoulderOf } from './world-shared.js';

export function buildRailingNetwork(ctx) {
    const {
        DROP, DY_SIDE, bRecs, basarabBlue, basarabStructure, buildingAt, buildingIndex, cellOf,
        coveredByOther, data, edgeGrid, edges, fountainBasinColl, ghostRails, group, isWater, landmarkFences,
        liftOnSide, lmSignColl, nearestEdge, onRibbon, propColl, raisedTop, segsCross, sportsColl,
        str, surfacesAt, tramSweep, walls, widthAsphalt, widthSide, yAlong,
    } = ctx;
    // ---- one railing network (owner, 2026-11-12: "fences are not continuous on the bridge still in many places", "random 1 off
    //      fences that are alone and randomly placed"). The road-deck guard, the tram-slab railings and the platform railings
    //      were each built and drawn by their own rule, so where one stopped and the next began there was an open end: a tram
    //      railing ending 1 m beside the road guard, two guards ending 2 m apart at a gore nose, the two inner railings of a
    //      slot ending without closing its end; and pieces that met nothing stood alone. All of them are one network now:
    //      (1) an open end in the air is joined to the nearest other open end (up to 12 m) or railing (up to 3 m) that it can
    //          reach without crossing a carriageway at its level, another railing or a tram's swept body;
    //      (2) a dead-end spur under 6 m and an isolated group under 16 m are removed;
    //      (3) only then is the railing drawn. What still ends in the air is listed in stats.railingNetwork.openEnds.
    const railingNetwork = { basis: 'MODEL: raised-deck railings joined into one network before they are drawn', joins: 0, joinM: 0, endToRailing: 0, prunedSpurs: 0, prunedIsolated: 0, prunedM: 0, openEnds: [] };
    {
        const mine = w => w.kind === 'rail' && w.basarabStyle === true;
        if (walls.some(mine) || ghostRails.length) { // (every district with raised decks since 2026-11-13: see raisedDeck)
            const TOUCH = .3, len = w => Math.hypot(w.bx - w.ax, w.bz - w.az);
            const analyse = () => {
                const rails = walls.filter(mine).concat(ghostRails), ends = [], grid = new BoxGrid(8), bodies = new BoxGrid(8);
                for (const w of rails) {
                    const L = len(w) || 1, pair = [];
                    for (const e of [0, 1]) { const q = { w, e, x: e ? w.bx : w.ax, z: e ? w.bz : w.az, top: e ? w.y1b : w.y1a, ux: (w.bx - w.ax) / L * (e ? 1 : -1), uz: (w.bz - w.az) / L * (e ? 1 : -1) }; pair.push(q); ends.push(q); grid.insert(q.x, q.z, q.x, q.z, q); }
                    pair[0].other = pair[1]; pair[1].other = pair[0];
                    bodies.insert(Math.min(w.ax, w.bx), Math.min(w.az, w.bz), Math.max(w.ax, w.bx), Math.max(w.az, w.bz), w);
                }
                const nearestOn = (w, x, z) => { const dx = w.bx - w.ax, dz = w.bz - w.az, t = clamp(((x - w.ax) * dx + (z - w.az) * dz) / (dx * dx + dz * dz || 1), 0, 1), px = w.ax + dx * t, pz = w.az + dz * t; return { t, x: px, z: pz, d: Math.hypot(x - px, z - pz), top: w.y1a + (w.y1b - w.y1a) * t }; };
                for (const q of ends) {
                    const mates = new Set(); grid.each(q.x - TOUCH, q.z - TOUCH, q.x + TOUCH, q.z + TOUCH, f => { if (f !== q && f.w !== q.w && Math.hypot(f.x - q.x, f.z - q.z) <= TOUCH && Math.abs(f.top - q.top) < .5) mates.add(f); });
                    q.mates = [...mates]; q.onBody = false;
                    if (!q.mates.length) bodies.each(q.x - TOUCH, q.z - TOUCH, q.x + TOUCH, q.z + TOUCH, w => { if (q.onBody || w === q.w) return; const p = nearestOn(w, q.x, q.z); if (p.d < TOUCH && Math.abs(p.top - q.top) < .5) { q.onBody = true; q.bodyW = w; } });
                    q.open = !q.mates.length && !q.onBody && q.top - 1.1 > .8; // (an end at street level is where the deck meets the ground)
                    q.ground = !q.mates.length && !q.onBody && !q.open;
                }
                return { rails, ends, grid, bodies, nearestOn };
            };
            // (1) joins
            {
                const N = analyse(), cands = [];
                N.ends.forEach((q, i) => { q.i = i; });
                for (const q of N.ends) {
                    if (!q.open) continue;
                    const seenE = new Set(), seenW = new Set();
                    N.grid.each(q.x - 12, q.z - 12, q.x + 12, q.z + 12, f => {
                        if (!f.open || f.w === q.w || f.i <= q.i || seenE.has(f)) return; seenE.add(f);
                        const dx = f.x - q.x, dz = f.z - q.z, d = Math.hypot(dx, dz); if (d > 12 || d < .05 || Math.abs(f.top - q.top) > Math.max(.5, d * .09)) return;
                        if (dx * q.ux + dz * q.uz < -.3 * d || -dx * f.ux - dz * f.uz < -.3 * d) return; // (the other end lies back along the railing)
                        cands.push({ d, q, f });
                    });
                    N.bodies.each(q.x - 4, q.z - 4, q.x + 4, q.z + 4, w => {
                        if (w === q.w || seenW.has(w)) return; seenW.add(w);
                        const p = N.nearestOn(w, q.x, q.z), dy = Math.abs(p.top - q.top); if (p.d > 4 || p.d < .05 || dy > Math.max(.5, p.d * .4) || (p.d > 3 && dy <= .5) || (p.x - q.x) * q.ux + (p.z - q.z) * q.uz < -.3 * p.d) return;
                        // (onto a railing at another level only along a surface that carries the piece: a sloped infill)
                        if (dy > .5 && ![.25, .5, .75].every(f => { let on = false; const y = q.top + (p.top - q.top) * f - 1.1; surfacesAt(q.x + (p.x - q.x) * f, q.z + (p.z - q.z) * f, h => { if (Math.abs(h - y) < .5) on = true; }); return on; })) return;
                        cands.push({ d: p.d, q, p });
                    });
                }
                cands.sort((a, b) => a.d - b.d || a.q.i - b.q.i);
                const used = new Set(), added = [];
                const free = (a, b, ya, yb, skip) => {
                    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / .5));
                    for (let i = 1; i < n; i++) { const f = i / n, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; if (coveredByOther(x, z, null, ya + (yb - ya) * f - Y.road, .35, false, .8)) return false; } // (through a carriageway: a mouth stays open)
                    if (tramSweep && tramSweep.segment(a, b, .05, Math.min(ya, yb) - .5, Math.max(ya, yb) + 1.1)) return false;
                    // (owner, SeaTac (-909, 1001), 2026-11-13: an invisible wall across Exit → Return To Terminal) the samples above
                    // test the ribbons' interiors; a join laid along the seam where a ramp's ribbon meets its bridge deck's lies on
                    // both rims and passed. A join never crosses a carriageway's centre line (0.5 m past its ends) at its own level.
                    let road = false;
                    edgeGrid.each(Math.min(a[0], b[0]) - 1, Math.min(a[1], b[1]) - 1, Math.max(a[0], b[0]) + 1, Math.max(a[1], b[1]) + 1, f => {
                        if (road || f.virtual) return;
                        const A = [f.a.x - f.dirx * .5, f.a.z - f.dirz * .5], B = [f.b.x + f.dirx * .5, f.b.z + f.dirz * .5];
                        if (!segsCross(a, b, A, B)) return;
                        const dx = b[0] - a[0], dz = b[1] - a[1], ex = B[0] - A[0], ez = B[1] - A[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) return;
                        const t = ((A[0] - a[0]) * ez - (A[1] - a[1]) * ex) / den, x = a[0] + dx * t, z = a[1] + dz * t;
                        if (Math.abs(yAlong(f, x, z) - (ya + (yb - ya) * t - Y.road)) < .8) road = true;
                    });
                    if (road) return false;
                    let cross = false; const test = w => { if (cross || skip.includes(w)) return; if (Math.abs((w.y1a + w.y1b) / 2 - 1.1 - (ya + yb) / 2) < 1.5 && segsCross(a, b, [w.ax, w.az], [w.bx, w.bz])) cross = true; };
                    N.bodies.each(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), test); for (const w of added) test(w);
                    return !cross;
                };
                for (const c of cands) {
                    if (used.has(c.q) || (c.f && used.has(c.f))) continue;
                    const a = [c.q.x, c.q.z], b = c.f ? [c.f.x, c.f.z] : [c.p.x, c.p.z], ta = c.q.top, tb = c.f ? c.f.top : c.p.top;
                    if (!free(a, b, ta - 1.1, tb - 1.1, [c.q.w, c.f ? c.f.w : null])) continue;
                    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), mx = -(b[1] - a[1]) / L, mz = (b[0] - a[0]) / L, sgn = Math.sign(mx * c.q.w.nx + mz * c.q.w.nz) || 1;
                    const w = { wall: true, estimated: true, completed: true, basarabStyle: true, networkJoin: true, tramDeckRailing: c.q.w.edge ? undefined : true, ax: a[0], az: a[1], bx: b[0], bz: b[1], y0a: ta - 1.3, y1a: ta, y0b: tb - 1.3, y1b: tb, yr: undefined, nx: mx * sgn, nz: mz * sgn, kind: 'rail', edge: c.q.w.edge || null,
                        x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, r: L / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.1 };
                    walls.push(w); added.push(w); used.add(c.q); if (c.f) used.add(c.f); else railingNetwork.endToRailing++;
                    railingNetwork.joins++; railingNetwork.joinM += L;
                }
                railingNetwork.joinM = Math.round(railingNetwork.joinM);
            }
            // (2) dead-end spurs and isolated groups
            for (let round = 0; round < 6; round++) {
                const N = analyse(), kill = new Set();
                for (const q of N.ends) {
                    if (!q.open || kill.has(q.w)) continue;
                    const chain = new Set(); let cur = q, total = 0, term = null;
                    for (;;) {
                        chain.add(cur.w); total += len(cur.w); const o = cur.other;
                        if (o.open) { term = 'open'; break; } if (o.ground) { term = 'ground'; break; }
                        if (o.onBody || o.mates.length !== 1 || o.mates[0].mates.length !== 1) { term = 'junction'; break; }
                        cur = o.mates[0]; if (chain.has(cur.w)) { term = 'loop'; break; }
                    }
                    if ((term === 'open' && total < 16) || (term === 'junction' && total < 6)) { for (const w of chain) kill.add(w); railingNetwork.prunedM += total; if (term === 'open') railingNetwork.prunedIsolated++; else railingNetwork.prunedSpurs++; DROP(q.x, q.z, 'pruned-' + term); }
                }
                if (!kill.size) break;
                for (let i = walls.length - 1; i >= 0; i--) if (kill.has(walls[i])) walls.splice(i, 1);
                for (let i = ghostRails.length - 1; i >= 0; i--) if (kill.has(ghostRails[i])) ghostRails.splice(i, 1);
            }
            // a small group that is closed on itself has no open end to start from (a 6 m ring on a gore nose, owner's pose
            // (426, -750)): every connected group under 16 m that does not reach the ground goes too
            {
                const N = analyse(), parent = new Map(N.rails.map(w => [w, w])), find = w => { let r = w; while (parent.get(r) !== r) r = parent.get(r); parent.set(w, r); return r; };
                for (const q of N.ends) { for (const f of q.mates) parent.set(find(q.w), find(f.w)); if (q.bodyW) parent.set(find(q.w), find(q.bodyW)); }
                const total = new Map(), grounded = new Set();
                for (const w of N.rails) total.set(find(w), (total.get(find(w)) || 0) + len(w));
                for (const q of N.ends) if (q.ground) grounded.add(find(q.w));
                const kill = new Set(N.rails.filter(w => total.get(find(w)) < 16 && !grounded.has(find(w))));
                if (kill.size) {
                    const groups = new Set([...kill].map(find)); railingNetwork.prunedGroups = groups.size; for (const g of groups) { railingNetwork.prunedM += total.get(g); DROP((g.ax + g.bx) / 2, (g.az + g.bz) / 2, 'pruned-group'); }
                    for (let i = walls.length - 1; i >= 0; i--) if (kill.has(walls[i])) walls.splice(i, 1);
                    for (let i = ghostRails.length - 1; i >= 0; i--) if (kill.has(ghostRails[i])) ghostRails.splice(i, 1);
                }
            }
            railingNetwork.prunedM = Math.round(railingNetwork.prunedM);
            { const N = analyse(); railingNetwork.rails = N.rails.length; railingNetwork.lengthM = Math.round(N.rails.reduce((n, w) => n + len(w), 0)); for (const q of N.ends) if (q.open) railingNetwork.openEnds.push([Math.round(q.x * 10) / 10, Math.round(q.z * 10) / 10, Math.round((q.top - 1.1) * 10) / 10]); }
        }
        // (3) draw (one post where two pieces meet)
        const posts = new Set(), postKey = (x, z) => Math.round(x * 20) + ',' + Math.round(z * 20), shared = basarabStructure.report.active;
        // (other districts, 2026-11-13) the guard of every other raised deck keeps the look its bridges were reviewed with: the
        // reviewed guard class of its way (bridge-guards.js), else the plain concrete parapet the per-edge rails drew
        const parapet = w => {
            const L = Math.hypot(w.bx - w.ax, w.bz - w.az), gc = cellOf((w.ax + w.bx) / 2, (w.az + w.bz) / 2);
            if (w.edge && emitBridgeGuard(gc.solid, gc.detail, w, bridgeGuardRow(data.roadSourceGeometry?.[w.edge.road]?.sourceId))) return;
            if (!(L > .05)) return;
            const sb = gc.solid, ta = w.y1a, tb = w.y1b, ba = ta - 1.1, bb = tb - 1.1, ox = -w.nx * .3, oz = -w.nz * .3;
            const A0 = [w.ax, ba, w.az], B0 = [w.bx, bb, w.bz], B1 = [w.bx, tb, w.bz], A1 = [w.ax, ta, w.az], A2 = [w.ax + ox, ta, w.az + oz], B2 = [w.bx + ox, tb, w.bz + oz], A3 = [w.ax + ox, ba, w.az + oz], B3 = [w.bx + ox, bb, w.bz + oz];
            sb.face4(A0, B0, B1, A1, rgb('#8a939d'), [w.nx, 0, w.nz]); sb.face4(B3, A3, A2, B2, rgb('#9aa3ad'), [-w.nx, 0, -w.nz]); sb.face4(A1, B1, B2, A2, rgb('#b0b8c0'), [0, 1, 0]);
            sb.face4(A3, A0, A1, A2, rgb('#9aa3ad'), [-(w.bx - w.ax) / L, 0, -(w.bz - w.az) / L]); sb.face4(B0, B3, B2, B1, rgb('#9aa3ad'), [(w.bx - w.ax) / L, 0, (w.bz - w.az) / L]);
        };
        for (const w of walls.concat(ghostRails)) {
            if (!mine(w)) continue;
            if (!shared) { parapet(w); continue; }
            const L = Math.hypot(w.bx - w.ax, w.bz - w.az), n = Math.max(1, Math.round(L / 2.4)), at = [];
            for (let i = 0; i <= n; i++) { const f = i / n, key = postKey(w.ax + (w.bx - w.ax) * f, w.az + (w.bz - w.az) * f); if (i > 0 && i < n) at.push(f); else if (!posts.has(key)) { posts.add(key); at.push(f); } }
            drawBasarabGuard(w, cellOf, basarabBlue, at, BASARAB_GUARD_STEEL[basarabGuardPlace(w, basarabStructure.report.superstructure?.carriedSpans)]); // (round 3: blue steel off the river arch, panoramas in bridge-guards.json)
        }
    }
    // ---- Pasajul Basarab by night: the blue light band along the deck edges (owner's reference photograph, 2026-11-11).
    //      The band is the guards' own blue fascia (drawn only here, a few centimetres wider than the fascia it replaces) in one
    //      mesh whose material glows at night (userData.nightEmissive). By day it is the same blue. ESTIMATE of colour and strength.
    if (basarabBlue.ic > 0) {
        const mesh = new THREE.Mesh(basarabBlue.build(), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#2444ff', emissiveIntensity: 0, roughness: 0.6 }));
        mesh.material.userData.nightEmissive = 2.2; mesh.name = 'Basarab night light band (estimate)'; mesh.castShadow = true; // (r2-perf-6: the band is the fascia now, drawBasarabGuard; it casts the fascia's shadow)
        group.add(splitMeshByTiles(mesh, 125)); // (tiles: culled out of view, same geometry)
    }
    const treeClear = []; // (after round 6) {x, z, r}: no trees here (fuel forecourts)
    const addPropColl = (x, z, r, kind = 'prop') => propColl.push({ x, z, r, hw: r, hd: r, angle: 0, poly: null, h: 3, prop: true, kind });
    for (const f of fountainBasinColl) addPropColl(f.x, f.z, f.r, 'fountain'); // (round 3: fountain basins drawn with the water areas)
    propColl.push(...sportsColl); // (pitch / court fences, dugouts, goal and hoop posts)
    // (fidelity pass 2026-11-12, Pipera: Strada Petricani over the Colentina) railings on street-level bridges with water on both sides
    const waterBridgeRailings = emitStreetLevelWaterBridgeRailings({ edges, isWater, widthSide, cellOf, addCollider: (x, z, r) => addPropColl(x, z, r, 'bridge-railing'),
        topAt: (x, z, e, s, road) => (road ? null : raisedTop(x, z, 0.3)) ?? (Y.road + yAlong(e, x, z)), colour: rgb('#8d949b'), postColour: rgb('#7b838b'),
        roadEdge: (e, s) => widthAsphalt(e, s) + .25, review: (e, s) => { const sid = data.roadSourceGeometry?.[e.road]?.sourceId, row = bridgeGuardRow(sid); if (!row?.atGrade) return null; const side = row[e.nx * s > 0 ? 'east' : 'west'] || {};
            return { way: sid, wBeam: !!row.wBeam, wBeamColour: rgb(row.wBeamColour || '#a9aeb1'), colour: side.colour && rgb(side.colour), postColour: side.postColour && rgb(side.postColour), pickets: side.pickets }; } }); // (round 3: reviewed sides, bridge-guards.js)
    // (round 3, 2026-11-13, Podul Grozăvești) reviewed outer railings of street-level bridges over mapped water (bridge-guards.js `outer`)
    const reviewedBridgeRailings = emitReviewedStreetBridgeRailings({ edges, widthSide, cellOf, rgb, rowOf: e => { const sid = data.roadSourceGeometry?.[e.road]?.sourceId, row = bridgeGuardRow(sid); return row && { ...row, way: sid }; },
        addCollider: (x, z, r) => addPropColl(x, z, r, 'bridge-railing'), topAt: (x, z, e) => raisedTop(x, z, 0.3) ?? (Y.road + yAlong(e, x, z)) });
    // ---- landmark ground fences (2026-11-08, owner: "the Rosetti fence is on the street"): the model's fence line follows the
    //      OSM grounds, which the game's wider road + sidewalk ribbons overlap (Rosetti: OSM draws the grounds' east edge on
    //      the Garibaldi centre line). Every point that falls on a carriageway or sidewalk is moved out to the property line
    //      (sidewalk's back edge + 0.15 m) on the side of the grounds (`inside`), gates included; styles: 'bars' (iron bars
    //      on a concrete plinth, `plinth: 'arches'` = painted arches) and 'mesh' (welded-mesh panels on posts); collision.
    const fenceSegs = []; // for the property-line fences: no second fence along a landmark's
    {
        const plinth = rgb('#a9a59c'), bars = rgb('#2e3438'), pill = rgb('#cfc8b8'), meshC = rgb('#87928a'), plWhite = rgb('#e3dfd5');
        const ARCH = ['#d8473f', '#f0b62e', '#3f7fc4', '#5aa35a', '#e07a2e'].map(rgb);
        const offStreet = (x, z, inside) => { // → [x, z] on the property line when (x, z) is on a street's carriageway / sidewalk
            for (let it = 0; it < 3; it++) {
                const ne = nearestEdge(x, z, (e) => !e.virtual && !e.tunnel, 25); if (!ne) break;
                const e = ne.edge; let sd = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
                const need = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + Math.max(0.6, e.sidewalk || 0) + 0.15;
                if (ne.d >= need - 0.01 && !onRibbon(x, z, 0.2)) break;
                if (inside) { // the grounds' side of the street, whichever side of the centre line OSM put the point on
                    const inP = pointInPolygon(ne.cx + e.nx * need, ne.cz + e.nz * need, inside), inM = pointInPolygon(ne.cx - e.nx * need, ne.cz - e.nz * need, inside);
                    if (inP !== inM) sd = inP ? 1 : -1;
                }
                const nd = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + Math.max(0.6, e.sidewalk || 0) + 0.15;
                x = ne.cx + e.nx * sd * nd; z = ne.cz + e.nz * sd * nd;
            }
            return [x, z];
        };
        for (const f of landmarkFences) {
            const R0 = f.ring, n = R0.length, segs = f.closed ? n : n - 1, mesh = f.style === 'mesh';
            const pts = [];
            for (let i = 0; i < segs; i++) { const [ax, az] = R0[i], [bx, bz] = R0[(i + 1) % n], L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(L / 1.0)); for (let j = 0; j < k; j++) pts.push(offStreet(ax + (bx - ax) * j / k, az + (bz - az) * j / k, f.inside)); }
            if (!f.closed) pts.push(offStreet(...R0[n - 1], f.inside)); else pts.push(pts[0]);
            const gates = (f.gates || []).map(g => { const [x, z] = offStreet(g.x, g.z, f.inside); return { ...g, x, z }; });
            const inGate = (x, z) => gates.some(g => Math.hypot(x - g.x, z - g.z) < g.w / 2);
            let run = 0; // metres along the fence (posts / arches at a steady pitch)
            for (let i = 0; i < pts.length - 1; i++) {
                const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.05 || L > 6) continue;
                const mx = (ax + bx) / 2, mz = (az + bz) / 2, r0 = run; run += L;
                if (inGate(mx, mz) || buildingAt(mx, mz) || onRibbon(mx, mz, 0.1)) continue;
                const ang = Math.atan2(bx - ax, bz - az), c = cellOf(mx, mz), ux = (bx - ax) / L, uz = (bz - az) / L, v0s = c.solid.vc, v0d = c.detail.vc;
                const wire = (px, pz, y0, y1, w, col) => { c.detail.wall(px - ux * w, pz - uz * w, px + ux * w, pz + uz * w, y0, y1, -uz, ux, col); c.detail.wall(px + ux * w, pz + uz * w, px - ux * w, pz - uz * w, y0, y1, uz, -ux, col); };
                if (mesh) { // welded-mesh panels (f.h tall, 2 m default): vertical wires every 0.33 m, flat horizontal wires every ≈ 0.45 m + a
                    //         V-bend, posts every 2.5 m (thin two-sided strips, not boxes: ≈ 30 triangles a metre — the frame budget)
                    const fh = f.h || 2.0, hz = (y, t) => { c.detail.wall(ax, az, bx, bz, Y.side + y, Y.side + y + t, -uz, ux, meshC); c.detail.wall(bx, bz, ax, az, Y.side + y, Y.side + y + t, uz, -ux, meshC); };
                    c.solid.box(mx, Y.side, mz, 0.12, 0.12, L + 0.02, ang, plinth);
                    const nV = Math.max(1, Math.round(L / 0.33));
                    for (let j = 0; j < nV; j++) { const t = (j + 0.5) / nV; wire(ax + (bx - ax) * t, az + (bz - az) * t, Y.side + 0.12, Y.side + fh, 0.011, meshC); }
                    const nH = Math.max(3, Math.round((fh - 0.3) / 0.45)); for (let k = 0; k <= nH; k++) hz(0.3 + (fh - 0.33) * k / nH, 0.025);
                    hz(fh * 0.66, 0.06);
                    if (Math.floor(r0 / 2.5) !== Math.floor(run / 2.5)) c.solid.box(ax, Y.side, az, 0.07, fh + 0.08, 0.07, ang, meshC);
                } else {
                    c.solid.box(mx, Y.side, mz, 0.28, 0.45, L + 0.02, ang, f.plinth === 'arches' ? plWhite : plinth);
                    c.solid.box(mx, Y.side + 1.95, mz, 0.06, 0.06, L, ang, bars); c.detail.box(mx, Y.side + 0.75, mz, 0.05, 0.05, L, ang, bars);
                    const nP = Math.max(1, Math.round(L / 0.14));
                    for (let j = 0; j < nP; j++) { const t = (j + 0.5) / nP; wire(ax + (bx - ax) * t, az + (bz - az) * t, Y.side + 0.45, Y.side + 2.0, 0.017, bars); }
                    if (i % 3 === 0) c.solid.box(ax, Y.side, az, 0.12, 2.1, 0.12, ang, bars);
                    if (f.plinth === 'arches') { // painted rainbow arches on both faces of the plinth, one per metre
                        const col = ARCH[Math.floor(r0) % ARCH.length];
                        for (const sg of [1, -1]) { const ox = -uz * sg * 0.145, oz = ux * sg * 0.145, nx = -uz * sg, nz = ux * sg;
                            const seg = (t0, t1, y0, y1) => { const x0 = mx + ux * t0 + ox, z0 = mz + uz * t0 + oz, x1 = mx + ux * t1 + ox, z1 = mz + uz * t1 + oz; if (sg > 0) c.detail.wall(x0, z0, x1, z1, Y.side + y0, Y.side + y1, nx, nz, col); else c.detail.wall(x1, z1, x0, z0, Y.side + y0, Y.side + y1, nx, nz, col); };
                            const h = Math.min(0.42, L / 2 - 0.02); seg(-h, -h + 0.09, 0.06, 0.3); seg(h - 0.09, h, 0.06, 0.3); seg(-h + 0.05, h - 0.05, 0.3, 0.4); }
                    }
                }
                liftOnSide(c, v0s, v0d, mx, mz, 0.6);
                propColl.push({ x: mx, z: mz, hw: 0.15, hd: L / 2, angle: ang, r: Math.hypot(0.15, L / 2), poly: null, h: 2, prop: true, kind: 'fence' });
                fenceSegs.push([ax, az, bx, bz]);
            }
            for (const g of gates) { // gate pillars on the fence line either side of the opening
                let best = null, bd = 6; for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - g.x, pts[i][1] - g.z); if (d < bd) { bd = d; best = i; } }
                if (best == null) continue;
                const a = pts[Math.max(0, best - 3)], b2 = pts[Math.min(pts.length - 1, best + 3)], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1, ux = (b2[0] - a[0]) / L, uz = (b2[1] - a[1]) / L, [gx, gz] = pts[best];
                for (const sg of [-1, 1]) { const px = gx + ux * sg * (g.w / 2 + 0.2), pz = gz + uz * sg * (g.w / 2 + 0.2); if (!onRibbon(px, pz, 0.25)) { cellOf(px, pz).solid.box(px, Y.side + (raisedTop(px, pz, 0.6) !== null ? DY_SIDE : 0), pz, 0.45, 2.4, 0.45, Math.atan2(ux, uz), pill); addPropColl(px, pz, 0.3, 'fence'); } }
            }
        }
    }
    for (const [x, z] of lmSignColl) addPropColl(x, z, 1.4, 'sign');
    // (fidelity pass 2026-11-12, Floreasca) a building whose sign text is the name of a business mapped inside it: the sign
    // belongs over that unit's street front (the OSM point), not on the wall nearest to the footprint centre, which was
    // often a rear service lane (Il Calcio, Komodo, Chez Toni, Roll Master had no sign on their street). The first such
    // POI owns the sign: addFacadeSign is skipped and addUnitSign places it in the POI pass.
    for (const [poiIndex, r] of data.pois.entries()) {
        if (!['food', 'shop', 'bank', 'pharmacy', 'hotel'].includes(data.poiKinds[r[0]]) || str(r[5]) === 'atm') continue;
        const pb = bRecs[buildingIndex(r[6], r[1] / 10, r[2] / 10)], text = str(r[4]) || str(r[3]);
        // (r3-builder-8, 2026-11-13) a business appended after the build (add-pois.mjs: `poiSources`) gets the builder's own
        // street-level rule (tools/osm/build-data.mjs: a food / shop / bank / pharmacy in a block or villa over 6 m is a
        // ground-floor shop unit, street faces only); the appender never rewrites building rows, so Germag (Grozăvești,
        // Bd. Banu Manta 2) and the other appended units showed a small board on a plain wall
        if (pb && data.poiSources?.[poiIndex] && data.poiKinds[r[0]] !== 'hotel' && !(pb.flags & 32) && /^(interwar|eclectic|civic|bloc|plain)$/.test(pb.style) && pb.h > 6) pb.flags |= 1;
        if (!pb || pb.poiSign != null || !(pb.flags & 2) || !pb.name || !text || pb.cv) continue;
        const nrm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        const a = nrm(pb.name), c2 = nrm(text);
        if (a && c2 && (a.includes(c2) || c2.includes(a) || a.split(' ')[0] === c2.split(' ')[0])) pb.poiSign = poiIndex;
    }
    return {
        addPropColl, fenceSegs, railingNetwork, reviewedBridgeRailings, treeClear, waterBridgeRailings,
    };
}
