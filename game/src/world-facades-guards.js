// ============================================================================
//  WORLD FACADES AND DECK GUARDS — POI colours, archetypes, facade boards, bridge bents, the Basarab structure, the raised-deck guard
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import * as THREE from '../vendor/three.module.min.js';
import { clamp, pointInPolygon } from './util.js';
import { triangulate } from './triangulate.js';
import { rgb } from './geobuild.js';
import { BENT_MODEL, planBridgeBents } from './bridge-bents.js';
import { bridgeBeam, buildBasarabStructure } from './basarab-structure.js';
import { raisedRoadTriangles } from './basarab-anchor-clearance.js';
import { openRuns, weldEnds } from './deck-outline.js';
import { BoxGrid, CELL, PALETTES, ROOF_COL, TILE, TILE_GRID, Y, archetypesModule, brandStyle, signedArea, undelta } from './world-shared.js';

export async function buildFacadesGuards(ctx) {
    const {
        ASPHALT, LANDMARKS, US, addSignQuad, asphaltCorners, bGrid, bRecs, bridgeJunctionDecks,
        buildingAt, buildingIndex, cellOf, cells, city, country, coveredByOther, coveredOutlines,
        data, distId, edgeGrid, edges, floatingSupport, group, isWater, landmarks,
        lmGroup, medianFill, medianGrid, nearestEdge, onRibbon, padHeightAt, pierColl, pois,
        polyDist, raised, raisedDeck, retainedDeck, sceneryDeckGrid, signMB, signs, surfGrid,
        surfList, surfacesAt, tramDecks, tramGrades, tramPropEnvelope, tramSweep, tramSweepConflicts, trams,
        walls, widthAsphalt, widthSide, yAlong,
    } = ctx;
    // keep the marker colour in sync when main.js assigns poi.color later
    for (const p of pois) Object.defineProperty(p, 'color', {
        get() { return this._color; }, set(v) { this._color = v; if (this.marker && v) this.marker.userData.pin.material.color.set(v); }, configurable: true, enumerable: true,
    });
    for (const p of pois) p.color = p._color || (city.pois.find(q => q.id === p.id) || {}).color || null;
    const lmSignColl = []; // (monument signs: colliders added with the other props below)
    // CV facade sign on landmark-hosted stops (poi.landmark: uipath-bel → lincoln, uipath-buc → thelandmark, arnia →
    // europehouse): the models only carry real-world signage, so the stop's sign goes on the facade nearest its door,
    // found by casting rays from the door at sign height to the model (the real facade, not a trimmed collision box)
    {
        const rc = new THREE.Raycaster(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3(), nW = new THREE.Vector3();
        lmGroup.updateMatrixWorld(true);
        for (const poi of pois) {
            if (!poi.landmark || poi.passing) continue;
            const lmk = landmarks.find(l => l.id === poi.landmark); if (!lmk || !lmk.mesh) continue;
            if (LANDMARKS.some(l => l.id === lmk.id && l.ownSign)) continue; // the model carries its own real signage (landmarks Request)
            const s = signs.get(poi.label, '#111827', '#ffffff', poi._color || '#f97316'); if (!s) continue;
            const facadeAt = (ys, minDot) => { let best = null;
                for (let k = -6; k <= 6; k++) { // a fan of rays toward the model
                    const bx = lmk.x - poi.doorX, bz = lmk.z - poi.doorZ, a0 = Math.atan2(bz, bx) + k * 0.12;
                    o3.set(poi.doorX, ys, poi.doorZ); d3.set(Math.cos(a0), 0, Math.sin(a0));
                    rc.set(o3, d3); rc.far = 80;
                    const hit = rc.intersectObject(lmk.mesh, true).find(h => h.face && h.object.isMesh && h.object.visible);
                    if (!hit) continue;
                    nW.copy(hit.face.normal).transformDirection(hit.object.matrixWorld); nW.y = 0;
                    if (nW.lengthSq() < 0.25) continue; nW.normalize();
                    if (nW.x * -d3.x + nW.z * -d3.z < minDot) continue; // facing the door
                    if (!best || hit.distance < best.d) best = { d: hit.distance, x: hit.point.x, z: hit.point.z, nx: nW.x, nz: nW.z };
                }
                return best; };
            // beside the entrance at 7.5 m (its canopy carries the building's own lettering), else above the canopy,
            // on a flush stretch of facade (slid along it); last resort: over the door, narrower
            let pick = null;
            for (const ys of [7.5, 10, 12.5]) {
                const best = facadeAt(ys, 0.8); if (!best) continue;
                const { nx, nz } = best, w = 12;
                for (const sg of [0, 1, -1]) {
                    const tx = nz * (sg || 1), tz = -nx * (sg || 1), d = sg ? w / 2 + 3 : 0, px = best.x + tx * d, pz = best.z + tz * d;
                    let flush = true;
                    for (const f of [-w / 2 + 0.5, -w / 4, 0, w / 4, w / 2 - 0.5]) {
                        o3.set(px + tx * f + nx * 6, ys, pz + tz * f + nz * 6); d3.set(-nx, 0, -nz); rc.set(o3, d3); rc.far = 12;
                        const h2 = rc.intersectObject(lmk.mesh, true)[0]; if (!h2 || Math.abs(h2.distance - 6) > 0.6) { flush = false; break; }
                    }
                    if (flush) { pick = { ys, nx, nz, cx: px, cz: pz, w }; break; }
                }
                if (pick) break;
            }
            if (!pick) { // entrance canopy: tenant letters standing on its front edge, facing the street (above the canopy's own lettering)
                const best = facadeAt(4, 0.35) || facadeAt(7.5, 0.35);
                if (best) {
                    // walk from the kerb side of the door toward the building with downward rays: the first roof found
                    // 3–8.5 m up is the canopy's front edge
                    let end = null, ch = 0;
                    for (let k = 0; k < 40; k++) {
                        const px = poi.doorX + best.nx * 2 - best.nx * 0.3 * k, pz = poi.doorZ + best.nz * 2 - best.nz * 0.3 * k;
                        o3.set(px, 9.0, pz); d3.set(0, -1, 0); rc.set(o3, d3); rc.far = 9.0;
                        const h2 = rc.intersectObject(lmk.mesh, true)[0], hy = h2 ? 9.0 - h2.distance : 0;
                        if (h2 && hy > 3 && hy < 8.5) { end = [px, pz]; ch = hy; break; }
                        if (h2 && hy >= 8.5) break;
                    }
                    if (end) {
                        // (round 6 note 24) the letters must not run into the model: at Lincoln Square the 8 m sign's end went
                        // through the angled lobby glazing's mullions. Rays along the sign's face (left end → right end, at
                        // three heights) find anything crossing it; narrower / further forward until it is clear.
                        const asp = (signs.get(poi.label.split(' — ')[0], '#111827', '#ffffff', poi._color || '#f97316') || s).aspect, tx = best.nz, tz = -best.nx;
                        const clearAt = (cx, cz, ww, ys0, hh0) => {
                            for (const fy of [-0.4, 0, 0.4]) for (const fn of [-0.05, 0.05]) {
                                o3.set(cx - tx * (ww / 2 + 0.3) + best.nx * fn, ys0 + fy * hh0, cz - tz * (ww / 2 + 0.3) + best.nz * fn); d3.set(tx, 0, tz);
                                rc.set(o3, d3); rc.far = ww + 0.6; if (rc.intersectObject(lmk.mesh, true).some(h => h.object.isMesh && h.object.visible)) return false;
                            }
                            return true;
                        };
                        let fit = null;
                        for (const ww of [8, 7, 6, 5, 4.2]) { for (const fwd of [-0.4, 0.15, 0.7]) { const hh2 = ww / asp, cx = end[0] + best.nx * fwd, cz = end[1] + best.nz * fwd, ys0 = ch + hh2 / 2 + 0.25; if (clearAt(cx, cz, ww, ys0, hh2)) { fit = { ww, cx, cz, ys0 }; break; } } if (fit) break; }
                        if (!fit) { const hh2 = 4.2 / asp; fit = { ww: 4.2, cx: end[0] + best.nx * 0.7, cz: end[1] + best.nz * 0.7, ys0: ch + hh2 / 2 + 0.25 }; }
                        pick = { ys: fit.ys0, nx: best.nx, nz: best.nz, cx: fit.cx, cz: fit.cz, w: fit.ww, canopy: true, text: poi.label.split(' — ')[0] };
                    }
                }
            }
            if (!pick) { // no flush facade (glazed lobby under a canopy): a freestanding tenant monument sign by the entrance,
                // set across the sidewalk so it reads from the street in both directions (like real office-tower signage)
                const best = facadeAt(4, 0.35) || facadeAt(7.5, 0.35); if (!best) continue;
                const { nx, nz } = best, short = signs.get(poi.label.split(' — ')[0], '#111827', '#ffffff', poi._color || '#f97316'); if (!short) continue;
                const midX = (best.x + poi.doorX) / 2, midZ = (best.z + poi.doorZ) / 2;
                let placed = false;
                // (round 6 note 24) clear of the model itself: Lincoln Square's lobby mullions / door frames stand 0.66 m out
                // from its glazing and cut through a sign placed there
                const clearOfModel = (x, z, tx, tz, W) => {
                    for (const f of [-W / 2 - 0.3, 0, W / 2 + 0.3]) {
                        const px = x + tx * f, pz = z + tz * f;
                        for (const sd of [1, -1]) { o3.set(px, 1.6, pz); d3.set(nx * sd, 0, nz * sd); rc.set(o3, d3); rc.far = 1.4; if (rc.intersectObject(lmk.mesh, true).some(h => h.object.isMesh && h.object.visible)) return false; }
                        o3.set(px, 12, pz); d3.set(0, -1, 0); rc.set(o3, d3); rc.far = 11.8;
                        const h = rc.intersectObject(lmk.mesh, true).find(h => h.object.isMesh && h.object.visible); if (h && 12 - h.distance > 0.3 && 12 - h.distance < 3.5) return false;
                    }
                    return true;
                };
                for (const [off, out] of [[6, 0], [-6, 0], [9, 0], [-9, 0], [4, 0], [-4, 0], [6, 2], [-6, 2], [9, 2], [-9, 2], [0, 3], [12, 1], [-12, 1]]) {
                    const tx = nz, tz = -nx, x = midX + tx * off + nx * out, z = midZ + tz * off + nz * out;
                    if (onRibbon(x, z, 1.8) || buildingAt(x, z) || !clearOfModel(x, z, tx, tz, 3.2)) continue;
                    const c2 = cellOf(x, z), W = 3.2, H = W / short.aspect;
                    c2.solid.box(x, 0.15, z, W + 0.5, 0.35, 0.7, Math.atan2(nx, nz) + Math.PI / 2, rgb('#8a8d91')); // plinth
                    c2.solid.box(x, 0.5, z, W + 0.3, H + 0.5, 0.42, Math.atan2(nx, nz) + Math.PI / 2, rgb('#2b2f36')); // slab
                    for (const sd of [1, -1]) addSignQuad(c2, x, z, Math.atan2(tx, tz), sd, W, H, 0.75 + H / 2, short, 0.22);
                    lmSignColl.push([x, z]);
                    poi.landmarkSign = { x, z, y: 0.75 + H / 2, nx: tx, nz: tz, w: W, h: H, monument: true }; placed = true; break;
                }
                if (placed) continue;
                pick = { ys: 7.5, nx, nz, cx: best.x, cz: best.z, w: 8 };
            }
            const { ys, nx, nz, cx, cz, w } = pick;
            const sg = pick.text ? signs.get(pick.text, '#111827', '#ffffff', poi._color || '#f97316') || s : s;
            const hh = w / sg.aspect, mx = cx + nx * 0.15, mz = cz + nz * 0.15;
            const lx = mx - nz * w / 2, lz = mz + nx * w / 2, rx = mx + nz * w / 2, rz = mz - nx * w / 2;
            const mbS = signMB(cellOf(mx, mz), sg.page), wh = [255, 255, 255];
            const i0 = mbS.v(lx, ys - hh / 2, lz, nx, 0, nz, sg.u0, sg.v0, wh), i1 = mbS.v(rx, ys - hh / 2, rz, nx, 0, nz, sg.u1, sg.v0, wh);
            const i2 = mbS.v(rx, ys + hh / 2, rz, nx, 0, nz, sg.u1, sg.v1, wh), i3 = mbS.v(lx, ys + hh / 2, lz, nx, 0, nz, sg.u0, sg.v1, wh);
            mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3);
            poi.landmarkSign = { x: mx, z: mz, y: ys, nx, nz, w, h: hh };
        }
    }

    // ---- extrude buildings
    // (round 5, note 77) non-residential archetypes from the research building specs: game/src/archetypes.js
    let ARCH = null;
    const archetypeData = coveredOutlines.length && data.buildingSpec ? { ...data, buildingSpec: data.buildingSpec.map(row => row.length === 17 ? [buildingIndex(row[0]), ...row.slice(1)] : row) } : data;
    try { ARCH = (await archetypesModule()).createArchetypes({ city, distId, data: archetypeData, US, CELL, proj: (la, lo) => city.proj(la, lo), bGrid, buildingAt, nearestEdge, onRibbon, signs, addSignQuad, brandStyle, triangulate, pointInPolygon, signedArea, TILE, TILE_GRID }); ARCH.match(bRecs); }
    catch (err) { console.warn('[arch] archetypes unavailable', err); ARCH = null; }
    const palette = PALETTES[country], roofCols = ROOF_COL[country];
    const collision = [];
    const facadeBoards = [], fasciaLayoutAudit = [];
    const propColl = []; // small circles for street furniture (trees, posts, shelters…)
    propColl.push(...floatingSupport.colls); // (the columns under floating source parts, above)
    propColl.push(...tramDecks, ...bridgeJunctionDecks);
    // -----------------------------------------------------------------------
    //  BRIDGE BENTS (MODEL estimate; bridge-bents.js): one crosshead carries every parallel deck of a structure
    //  (both carriageways and the tram viaduct between them). Columns stand only on free ground: never on a lower
    //  carriageway, sidewalk, rail, water or building; a bent that cannot stand, or whose crosshead would foul the
    //  clearance of what passes below, is left out, so long spans keep their real long-span structure.
    // -----------------------------------------------------------------------
    let bridgeBents = { bents: [], report: null, chains: [] }, basarabStructure = { report: { active: false, sourcePlatforms: [] }, pieces: [], colliders: [] };
    {
        const basarabDistrict = city.id === 'bucharest' && distId === 'grozavesti';
        const deferredRailSlots = []; let emitSlot = null; // the slot between the two tram slabs, decided once the centre support exists
        const deckEdges = raised.filter(e => e.bridge && !e.virtual && Math.max(e.ya, e.yb) > 0.3 && !retainedDeck(e)); // (retained ramps stand on their walls)
        // elevated rail slabs join the same plan as pseudo-edges (their own half width and exact rendered band)
        const railNodes = new Map(), railNode = p => { const k = Math.round(p[0] * 100) + ',' + Math.round(p[1] * 100); let n = railNodes.get(k); if (!n) railNodes.set(k, n = { x: p[0], z: p[1] }); return n; };
        const railEdgeGrid = new BoxGrid(32), railEdges = [];
        for (const d of tramDecks) {
            if (d.kind !== 'source-tram-deck' || !d.supportA || !(d.y1 > 1.2)) continue;
            const [ax, az] = d.supportA, [bx, bz] = d.supportB, len = Math.hypot(bx - ax, bz - az); if (len < .05) continue;
            const dirx = (bx - ax) / len, dirz = (bz - az) / len, half = Math.abs((d.poly[0][0] - ax) * -dirz + (d.poly[0][1] - az) * dirx);
            const e = { a: railNode(d.supportA), b: railNode(d.supportB), dirx, dirz, len, nx: -dirz, nz: dirx, railDeck: d, half };
            railEdges.push(e); railEdgeGrid.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), e);
        }
        // rails that a column / crosshead must keep clear of: tram tracks (at their own level) and heavy rail at grade
        const railGrid = new BoxGrid(32), railSeg = (ax, az, bx, bz, y) => railGrid.insert(Math.min(ax, bx) - 4, Math.min(az, bz) - 4, Math.max(ax, bx) + 4, Math.max(az, bz) + 4, { ax, az, bx, bz, y });
        const railDeckTop = (x, z) => { let y = 0; sceneryDeckGrid.each(x, z, x, z, d => { if (d.kind === 'source-tram-deck' && pointInPolygon(x, z, d.poly)) y = Math.max(y, d.y1); }); return y; };
        for (const pl of trams) for (let i = 0; i < pl.length - 1; i++) { const [ax, az] = pl[i], [bx, bz] = pl[i + 1]; railSeg(ax, az, bx, bz, railDeckTop((ax + bx) / 2, (az + bz) / 2)); }
        for (const r of data.railways || []) { const t = r.tags || {}; if (t.railway === 'abandoned' || (t.tunnel && t.tunnel !== 'no')) continue; const pts = undelta(r.points, 0); for (let i = 1; i < pts.length; i++) railSeg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 0); }
        const railNear = (x, z, reach, belowY) => { let found = null; railGrid.each(x, z, x, z, s => { if (found || s.y >= belowY) return; const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1, t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / L2, 0, 1); if (Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) < reach) found = s; }); return found; };
        const lowerEdge = (x, z, margin, belowY, sidewalks) => { let found = null; edgeGrid.each(x - 14, z - 14, x + 14, z + 14, f => {
            if (found || f.virtual || f.lidded || Math.max(f.ya, f.yb) >= belowY) return;
            const s = (x - f.a.x) * f.dirx + (z - f.a.z) * f.dirz; if (s < -margin || s > f.len + margin) return;
            const lat = (x - f.a.x) * f.nx + (z - f.a.z) * f.nz, side = lat >= 0 ? 1 : -1;
            if (Math.abs(lat) < (sidewalks ? widthSide(f, side) : side > 0 ? f.wR : f.wL) + margin) found = f; }); return found; };
        const lowerRibbon = (x, z, r, belowY) => onRibbon(x, z, r, rb => rb.y < belowY);
        const ring = (x, z, r) => [[x, z], [x + r, z], [x - r, z], [x, z + r], [x, z - r]];
        // mapped / measured trees keep their place: a column stands clear of them (inferred trees avoid the columns later)
        const sourceTreeGrid = new BoxGrid(16); for (let i = 0; i + 2 < (data.trees || []).length; i += 3) { const tx = data.trees[i] / 10, tz = data.trees[i + 1] / 10; sourceTreeGrid.insert(tx, tz, tx, tz, [tx, tz]); }
        const sourceTreeNear = (x, z, reach) => { let hit = false; sourceTreeGrid.each(x - reach, z - reach, x + reach, z + reach, t => { if (!hit && Math.hypot(t[0] - x, t[1] - z) < reach) hit = true; }); return hit; };
        const columnFree = (x, z, r, belowY) => {
            if (sourceTreeNear(x, z, r + 1.6)) return false;
            if (ring(x, z, r + .6).some(([px, pz]) => isWater(px, pz) || buildingAt(px, pz))) return false;
            if (lowerRibbon(x, z, r + .3, belowY) || lowerEdge(x, z, r + .3, belowY, true) || railNear(x, z, 1.7 + r + .4, belowY)) return false;
            if (tramSweep?.circle(x, z, r + .1, -1, belowY + 1.5, p => p.y < belowY + 1)) return false; // the swept rigid body of a tram passing below or beside
            { let built = false; for (const [px, pz] of ring(x, z, r + .3)) surfacesAt(px, pz, h => { if (h < belowY) built = true; }); if (built) return false; } // any walked / driven surface
            let deck = false; sceneryDeckGrid.each(x - r, z - r, x + r, z + r, d => { if (!deck && d.h < belowY && ring(x, z, r).some(([px, pz]) => pointInPolygon(px, pz, d.poly))) deck = true; });
            return !deck;
        };
        // the highest thing passing below a crosshead: a lower carriageway with its sidewalks, a pad, a rail, a lower slab
        const lowerSurface = (x, z, belowY) => {
            let y = null, rail = false; const take = (h, isRail) => { if (y === null || h > y + .5) { y = h; rail = isRail; } };
            const track = railNear(x, z, 1.7, belowY); if (track) take(track.y, true);
            const rb = lowerRibbon(x, z, .5, belowY); if (rb) take(rb.y, false);
            const f = lowerEdge(x, z, 0, belowY, true); if (f) take(yAlong(f, x, z), false);
            sceneryDeckGrid.each(x, z, x, z, d => { if (d.h < belowY && pointInPolygon(x, z, d.poly)) take(d.roofHeightAt(x, z), d.kind === 'source-tram-deck'); });
            surfacesAt(x, z, h => { if (h < belowY) take(h, false); }); // also sidewalk hulls round junction corners
            return y === null ? null : { y, rail };
        };
        // ---- one structure, one deck: close the open slot between the parallel slabs of a structure (carriageway |
        //      tram slab | tram slab | carriageway). Only gaps up to the bent model's join gap, between slabs at one
        //      level; a slab that already overlaps its neighbour, or faces open air, is left as it is.
        const infill = { quads: 0, areaM2: 0, maxGapM: 0 };
        {
            const GAP = BENT_MODEL.joinGapM, LEVEL = BENT_MODEL.levelToleranceM, slab = rgb('#96938b'), dark = rgb('#55524d');
            const strips = [];
            for (const e of deckEdges) strips.push({ road: e, id: e.id, na: e.a, nb: e.b, a: [e.a.x, e.a.z], b: [e.b.x, e.b.z], nx: e.nx, nz: e.nz, half: s2 => widthSide(e, s2),
                topAt: (x, z) => yAlong(e, x, z) + Y.road, soffitAt: (x, z) => { const y = yAlong(e, x, z); return y + Y.road - Math.min(1.1, Math.max(.05, y)); } });
            for (const [i, e] of railEdges.entries()) strips.push({ rail: e.railDeck, id: 1e6 + i, na: e.a, nb: e.b, a: [e.a.x, e.a.z], b: [e.b.x, e.b.z], nx: e.nx, nz: e.nz, half: () => e.half,
                topAt: (x, z) => e.railDeck.roofHeightAt(x, z), soffitAt: (x, z) => e.railDeck.minHeightAt(x, z) });
            // (owner, 2026-11-11, Grozavesti (112, -197): "HOW?") a street-level bridge over water (Podul Grozavesti over
            // the Dambovita: two carriageways and the tram between them) left the slots between its slabs open, and the
            // river 4.4 m below showed through as water lying at street level. Street-level bridge slabs join the slot
            // infill too, where the slot lies over water (they get no bents: that plan stays elevated-only).
            for (const e of edges) if (e.bridge && !e.virtual && !e.tunnel && Math.max(e.ya, e.yb) <= .3) strips.push({ road: e, low: true, id: e.id, na: e.a, nb: e.b, a: [e.a.x, e.a.z], b: [e.b.x, e.b.z], nx: e.nx, nz: e.nz, half: s2 => widthSide(e, s2),
                topAt: (x, z) => yAlong(e, x, z) + Y.road, soffitAt: (x, z) => yAlong(e, x, z) + Y.road - .6 });
            for (const [i, d] of tramDecks.entries()) {
                if (d.kind !== 'source-tram-deck' || !d.supportA || d.y1 > 1.2) continue;
                const [ax, az] = d.supportA, [bx, bz] = d.supportB, len = Math.hypot(bx - ax, bz - az); if (len < .05) continue;
                const dirx = (bx - ax) / len, dirz = (bz - az) / len, half = Math.abs((d.poly[0][0] - ax) * -dirz + (d.poly[0][1] - az) * dirx);
                strips.push({ rail: d, low: true, id: 2e6 + i, na: railNode(d.supportA), nb: railNode(d.supportB), a: [ax, az], b: [bx, bz], nx: -dirz, nz: dirx, half: () => half,
                    topAt: (x, z) => d.roofHeightAt(x, z), soffitAt: (x, z) => d.minHeightAt(x, z) });
            }
            const stripGrid = new BoxGrid(32);
            for (const st of strips) {
                const wr = st.half(1), wl = st.half(-1);
                st.poly = [[st.a[0] + st.nx * wr, st.a[1] + st.nz * wr], [st.b[0] + st.nx * wr, st.b[1] + st.nz * wr], [st.b[0] - st.nx * wl, st.b[1] - st.nz * wl], [st.a[0] - st.nx * wl, st.a[1] - st.nz * wl]];
                stripGrid.insert(Math.min(...st.poly.map(q => q[0])), Math.min(...st.poly.map(q => q[1])), Math.max(...st.poly.map(q => q[0])), Math.max(...st.poly.map(q => q[1])), st);
            }
            // nearest neighbouring slab edge along a transverse ray from (ox, oz); null when the point is already on a neighbour
            const reach = (own, ox, oz, dx, dz, level, G = GAP) => {
                let best = null, covered = false;
                stripGrid.each(Math.min(ox, ox + dx * G), Math.min(oz, oz + dz * G), Math.max(ox, ox + dx * G), Math.max(oz, oz + dz * G), st => {
                    if (covered || st === own || st.na === own.na || st.na === own.nb || st.nb === own.na || st.nb === own.nb) return; // itself / its own run continuing
                    if (pointInPolygon(ox, oz, st.poly)) { if (Math.abs(st.topAt(ox, oz) - level) < LEVEL) covered = true; return; }
                    for (let i = 0, j = 3; i < 4; j = i++) {
                        const [x1, z1] = st.poly[j], [x2, z2] = st.poly[i], ex = x2 - x1, ez = z2 - z1, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
                        const t = ((x1 - ox) * ez - (z1 - oz) * ex) / den, u = ((x1 - ox) * dz - (z1 - oz) * dx) / den;
                        if (t > .03 && t <= G && u >= -1e-6 && u <= 1 + 1e-6 && (!best || t < best.t)) { const hx = ox + dx * t, hz = oz + dz * t; if (Math.abs(st.topAt(hx, hz) - level) < LEVEL) best = { t, st, x: hx, z: hz, top: st.topAt(hx, hz), soffit: st.soffitAt(hx, hz) }; }
                    }
                });
                return covered ? null : best;
            };
            // (owner L41, Grozavesti (731, -955): sky between the carriageway and the tram deck west of the Basarab station;
            // Street View under the station shows one continuous underside) an elevated tram deck joins a carriageway up to
            // 12 m away. Only the Basarab viaduct has tram decks this high, so nowhere else changes.
            const railJoin = (st, top) => st.rail && top > 8 + Y.road ? 12 : GAP;
            const slotQueue = [], goreQueue = [];
            for (const st of strips) for (const side of [1, -1]) {
                const w = st.half(side), dx = st.nx * side, dz = st.nz * side, ends = [st.a, st.b].map(q => { const ox = q[0] + dx * w, oz = q[1] + dz * w, top = st.topAt(ox, oz); return { ox, oz, top, soffit: st.soffitAt(ox, oz), hit: reach(st, ox, oz, dx, dz, top, st.low ? 10 : railJoin(st, top)) }; }); // (a street-level river bridge: its slabs up to 10 m apart are one deck)
                if (!ends[0].hit !== !ends[1].hit && Math.max(ends[0].top, ends[1].top) > 2.5 && !st.low) goreQueue.push({ st, side, w, dx, dz, ends }); // (one end joined: a split)
                if (!ends[0].hit || !ends[1].hit) continue;
                const overWater = st.low && ends.some(q => isWater((q.ox + q.hit.x) / 2, (q.oz + q.hit.z) / 2)); // (a street-level bridge: only its slots over water)
                if (!(ends[0].top > 2.5 || overWater) || (st.low && !overWater)) continue;
                if (st.road && !(ends[0].hit.st.road && ends[0].hit.st.id > st.id && st.low)) continue; // carriageway pairs: raised ones are the median fill's (above); street-level ones over water here; tram slabs fill toward carriageways
                if (st.rail && ends[0].hit.st.rail && ends[0].hit.st.id < st.id) continue;              // tram pair once
                if (basarabDistrict && st.rail && ends[0].hit.st.rail) { deferredRailSlots.push(ends); continue; } // Basarab: the literal centre support between the two tracks owns that gap where it exists (see below)
                ends.ownRoad = !!st.road; slotQueue.push(ends);
            }
            emitSlot = ends => {
                let [A, B] = ends;
                // (owner, 2026-11-12, Grozavesti (259, -645) "what is this gray spot") a slot whose transverse ray passed under a
                // carriageway at the same level (one not in the strip set) laid its concrete through that carriageway: a grey
                // patch fighting the asphalt. A slot never covers a carriageway.
                for (const f of [.25, .5, .75]) for (const g2 of [.15, .5, .85]) {
                    const L = (p, q, t) => p + (q - p) * t, ax = L(A.ox, A.hit.x, f), az = L(A.oz, A.hit.z, f), bx = L(B.ox, B.hit.x, f), bz = L(B.oz, B.hit.z, f), y = L(L(A.top, A.hit.top, f), L(B.top, B.hit.top, f), g2) - Y.road;
                    if (coveredByOther(L(ax, bx, g2), L(az, bz, g2), null, y, .3, false, .35)) { infill.overRoad = (infill.overRoad || 0) + 1; return; }
                }
                // (owner, 2026-11-12, Grozavesti (249, -617) "this looks random") consecutive slots along a bending pair of slabs met
                // at a point on one side only: a wedge of the ground 11 m below showed through. Each slot overlaps the next by 0.3 m.
                { const lx = B.ox - A.ox, lz = B.oz - A.oz, l = Math.hypot(lx, lz) || 1, ux = lx / l * .3, uz = lz / l * .3, mv = (q, s3) => ({ ...q, ox: q.ox + ux * s3, oz: q.oz + uz * s3, hit: { ...q.hit, x: q.hit.x + ux * s3, z: q.hit.z + uz * s3 } });
                  A = mv(A, -1); B = mv(B, 1); }
                const top = [[A.ox, A.top, A.oz], [B.ox, B.top, B.oz], [B.hit.x, B.hit.top, B.hit.z], [A.hit.x, A.hit.top, A.hit.z]], bottom = [[A.ox, A.soffit, A.oz], [B.ox, B.soffit, B.oz], [B.hit.x, B.hit.soffit, B.hit.z], [A.hit.x, A.hit.soffit, A.hit.z]];
                const up = (top[1][2] - top[0][2]) * (top[2][0] - top[0][0]) - (top[1][0] - top[0][0]) * (top[2][2] - top[0][2]) > 0; // +y normal for this winding?
                const sb = cellOf((A.ox + B.ox) / 2, (A.oz + B.oz) / 2).solid;
                // (owner, 2026-11-11, Grozavesti (549, -831): "why is this cut") a pale concrete strip tapering between a
                // carriageway and the tram slab read as a slice through the deck: next to a carriageway the infill is asphalt
                const topCol = ends.ownRoad && A.hit?.st?.road && B.hit?.st?.road ? rgb(ASPHALT) : slab; // (asphalt only between two carriageways; a tram slab keeps its concrete separator)
                sb.face4(...(up ? top : top.slice().reverse()), topCol, [0, 1, 0]);
                sb.face4(...(up ? bottom.slice().reverse() : bottom), dark, [0, -1, 0]);
                const poly = top.map(q => [q[0], q[2]]), cx = poly.reduce((n, q) => n + q[0], 0) / 4, cz = poly.reduce((n, q) => n + q[1], 0) / 4;
                const plane = (pts) => (x, z) => { // height on the quad's two triangles
                    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) { const a = pts[i], b = pts[j], c = pts[k], den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-12) continue; const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den; if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) return u * a[1] + v * b[1] + (1 - u - v) * c[1]; }
                    return pts.reduce((n, q) => n + q[1], 0) / 4; };
                const deck = { x: cx, z: cz, r: Math.max(...poly.map(q => Math.hypot(q[0] - cx, q[1] - cz))), poly, holes: [], roadDeck: true, kind: 'bridge-slot-infill', estimated: true,
                    y0: Math.min(...bottom.map(q => q[1])), y1: Math.max(...top.map(q => q[1])), h: Math.max(...top.map(q => q[1])), roofHeightAt: plane(top), minHeightAt: plane(bottom) };
                sceneryDeckGrid.insert(cx - deck.r, cz - deck.r, cx + deck.r, cz + deck.r, deck);
                const gap = Math.max(A.hit.t, B.hit.t), len = Math.hypot(B.ox - A.ox, B.oz - A.oz);
                infill.quads++; infill.areaM2 += len * (A.hit.t + B.hit.t) / 2; infill.maxGapM = Math.max(infill.maxGapM, gap);
            };
            for (const ends of slotQueue) emitSlot(ends);
            // a street-level bridge over water is one deck: its carriageways and tram slabs part at the banks and the
            // tram corridor between them has no slab of its own, so the river showed through. One plate (the convex
            // hull of each crossing's slabs, just under their surfaces) closes it.
            {
                const low = strips.filter(st => st.low && (isWater((st.a[0] + st.b[0]) / 2, (st.a[1] + st.b[1]) / 2) || st.poly.some(p => isWater(p[0], p[1])))), parent = low.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
                for (let i = 0; i < low.length; i++) for (let j = i + 1; j < low.length; j++) if (low[i].poly.some(p => low[j].poly.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 10))) parent[find(i)] = find(j);
                const groups = new Map(); low.forEach((st, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(st); });
                for (const g of groups.values()) {
                    if (g.length < 2) continue;
                    const pts = g.flatMap(st => st.poly).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
                    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
                    for (const p of pts.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
                    const hull = lo.slice(0, -1).concat(hi.slice(0, -1)); if (hull.length < 3) continue;
                    const y = Math.min(...g.map(st => st.topAt((st.a[0] + st.b[0]) / 2, (st.a[1] + st.b[1]) / 2))) - .04, yb = y - .9, cx = hull.reduce((n, p) => n + p[0], 0) / hull.length, cz = hull.reduce((n, p) => n + p[1], 0) / hull.length, sb = cellOf(cx, cz).solid;
                    for (let i = 1; i + 1 < hull.length; i++) { const a = hull[0], b = hull[i], c = hull[i + 1]; sb.face4([a[0], y, a[1]], [c[0], y, c[1]], [b[0], y, b[1]], [b[0], y, b[1]], slab, [0, 1, 0]); sb.face4([a[0], yb, a[1]], [b[0], yb, b[1]], [c[0], yb, c[1]], [c[0], yb, c[1]], dark, [0, -1, 0]); }
                    for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; sb.face4([a[0], y, a[1]], [b[0], y, b[1]], [b[0], yb, b[1]], [a[0], yb, a[1]], slab, [(b[1] - a[1]) / L, 0, -(b[0] - a[0]) / L]); }
                    infill.riverPlates = (infill.riverPlates || 0) + 1;
                }
            }
            // (owner, 2026-11-11, Grozavesti (731, -955): "why are there holes") where two decks split (the north-east Pasajul
            // branch leaving the main Basarab deck) only one end of a strip side reached the neighbour, so the whole wedge
            // stayed open and the sky showed through between the slabs near the nose. From the joined end, the gore is filled
            // in 1 m steps while the neighbour at the same level is within the join gap; beyond it the decks part.
            let gore = 0;
            for (const { st, side, w, dx, dz, ends } of goreQueue) {
                const k0 = ends[0].hit ? 0 : 1, P0 = k0 ? st.b : st.a, P1 = k0 ? st.a : st.b, L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), n = Math.max(1, Math.ceil(L));
                const hit0 = ends[k0].hit; if (st.road) continue; // (carriageway gores: the median fill)
                let prev = null;
                for (let i = 0; i <= n; i++) {
                    const f = i / n, cx = P0[0] + (P1[0] - P0[0]) * f, cz = P0[1] + (P1[1] - P0[1]) * f, ox = cx + dx * w, oz = cz + dz * w, top = st.topAt(ox, oz);
                    const cur = { ox, oz, top, soffit: st.soffitAt(ox, oz), hit: reach(st, ox, oz, dx, dz, top, railJoin(st, top)) };
                    if (!cur.hit) break;
                    // (owner, 2026-11-12, Grozavesti (387, -720) "flicker": where the two tracks part, this gore fill lay in the plane of
                    // the Basarab centre support between them) a gore between two tram slabs waits for that support, like the slots
                    if (prev) { const pair = [prev, cur]; pair.ownRoad = !!st.road; if (basarabDistrict && st.rail && prev.hit.st.rail && cur.hit.st.rail) deferredRailSlots.push(pair); else emitSlot(pair); gore++; }
                    prev = cur;
                }
            }
            infill.gore = gore;
        }
        // ---- Pasajul Basarab superstructure (basarab-structure.js, integrated from fidelity/basarab-render-r9): platforms,
        //      centre support, station roof, H-frame, stays and river arch. The slot infill above is real deck for its stay
        //      anchors; the stretches its stays and arch carry get no pier below.
        const basarabRoadRegions = basarabDistrict ? raisedRoadTriangles(cells.values()) : [];
        basarabStructure = buildBasarabStructure(data, tramGrades, cellOf, group, edges, { roadRegions: basarabRoadRegions, tramEnvelope: tramPropEnvelope, tramSweep, roadFootprints: basarabDistrict ? edges.filter(e => e.bridge && !e.virtual && !e.tunnel && raisedDeck(e)).map(e => asphaltCorners(e, (f, sd) => widthAsphalt(f, sd) + .4)) : [], supportAt: (x, z, base) => { let top = null; surfacesAt(x, z, h => { if (Math.abs(h - base) < .3 && (top === null || Math.abs(h - base) < Math.abs(top - base))) top = h; }); return top; } });
        const carriedSpans = basarabStructure.report.superstructure?.carriedSpans || [];
        // The slot between the two tram slabs is the centre support's where that exists (station, cable-stayed span).
        // Beyond its ends the slot stayed open: a hole in the deck with the ground visible through it. Closed there now.
        for (const ends of deferredRailSlots) {
            const mid = q => [(q.ox + q.hit.x) / 2, (q.oz + q.hit.z) / 2], [a, b] = ends.map(mid), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            if (basarabStructure.pieces.some(p => [a, b, c].some(m => pointInPolygon(m[0], m[1], p.poly)))) continue;
            // a piece that only reaches into the support at a corner lies 3 cm under it (two faces in one plane flicker)
            const corners = ends.flatMap(q => [[q.ox, q.oz], [q.hit.x, q.hit.z]]).map(m => [m[0] + (c[0] - m[0]) * .12, m[1] + (c[1] - m[1]) * .12]);
            const touches = basarabStructure.pieces.some(p => corners.some(m => pointInPolygon(m[0], m[1], p.poly)));
            emitSlot(touches ? Object.assign(ends.map(q => ({ ...q, top: q.top - .03, hit: { ...q.hit, top: q.hit.top - .03 } })), { ownRoad: ends.ownRoad }) : ends);
        }
        const carried = (x, z) => carriedSpans.some(sp => { const dx = sp.b[0] - sp.a[0], dz = sp.b[1] - sp.a[1], L = Math.hypot(dx, dz) || 1, t = ((x - sp.a[0]) * dx + (z - sp.a[1]) * dz) / L; return t > 6 && t < L - 6 && Math.abs((x - sp.a[0]) * -dz + (z - sp.a[1]) * dx) / L < sp.halfWidthM; });
        bridgeBents = planBridgeBents({
            edges: deckEdges.concat(railEdges),
            halfWidth: (e, side) => e.railDeck ? e.half : widthSide(e, side),
            topAt: (e, x, z) => e.railDeck ? e.railDeck.roofHeightAt(x, z) : yAlong(e, x, z) + Y.road,
            soffitAt: (e, x, z) => { if (e.railDeck) return e.railDeck.minHeightAt(x, z); const y = yAlong(e, x, z); return y + Y.road - Math.min(1.1, Math.max(.05, y)); },
            eachEdge: (x0, z0, x1, z1, cb) => { edgeGrid.each(x0, z0, x1, z1, cb); railEdgeGrid.each(x0, z0, x1, z1, cb); },
            columnFree, lowerSurface, carried,
            model: basarabDistrict ? { ...BENT_MODEL, wideFrame: { maxCantileverM: 12, straddleM: 9, maxSpanM: 32 } } : BENT_MODEL, // (Basarab only: the other districts keep the frames they were reviewed with)
        });
        // a single-deck fallback pier (hammerhead) must keep out of a tram's swept body like every generated structure.
        // (owner, 2026-11-12, Grozavesti (591, -854): "some pillars need to be added ... huge spots where there's no support";
        // 44 hammerheads along Soseaua Orhideelor were dropped, leaving 120-180 m spans) The beam's top is the seat the slab
        // rests on, not 0.1 m above it: a tram riding on the slab it carries no longer counts. A beam end reaching into the
        // sweep of a tram beside it is trimmed back to the free part instead of dropping the pier, while the free beam still
        // holds its columns and 60 % of the deck width.
        if (tramSweep) bridgeBents.bents = bridgeBents.bents.filter(b => {
            if (!b.single) return true;
            const beamHit = (o0, o1) => { const at = o => [b.x + b.nx * (o - (b.lo + b.hi) / 2), b.z + b.nz * (o - (b.lo + b.hi) / 2)]; return !!tramSweep.segment(at(o0), at(o1), BENT_MODEL.beamWidthM / 2 + .1, (b.soffit || 0) - .3, b.seat - .05); };
            let hit = b.columns.some(c => tramSweep.circle(c.x, c.z, BENT_MODEL.columnM * .75, -1, b.seat - .05));
            if (!hit && beamHit(b.lo, b.hi)) {
                const cLo = Math.min(...b.columns.map(c => c.o)) - BENT_MODEL.columnM * .5 - .2, cHi = Math.max(...b.columns.map(c => c.o)) + BENT_MODEL.columnM * .5 + .2;
                let lo = cLo, hi = cHi; if (beamHit(lo, hi)) hit = true;
                while (!hit && lo - .5 >= b.lo && !beamHit(lo - .5, lo)) lo -= .5;
                while (!hit && hi + .5 <= b.hi && !beamHit(hi, hi + .5)) hi += .5;
                if (!hit && hi - lo >= .6 * (b.deckHi - b.deckLo)) { const mid0 = (b.lo + b.hi) / 2, mid = (lo + hi) / 2; b.x += b.nx * (mid - mid0); b.z += b.nz * (mid - mid0); b.lo = lo; b.hi = hi; b.width = hi - lo; bridgeBents.report.hammerheadsTrimmed = (bridgeBents.report.hammerheadsTrimmed || 0) + 1; }
                else hit = true;
            }
            if (hit) { bridgeBents.report.hammerheadsInTramSweep = (bridgeBents.report.hammerheadsInTramSweep || 0) + 1; bridgeBents.report.bents--; }
            return !hit;
        });
        const conc = rgb('#a9a69e'), base = -.4;
        // The guard takes one height interval for a whole pitched tram body: on a ramp its low end reads below the deck
        // under its high end. A pier is under the slab that carries that tram, so its collider ends below that reading;
        // the drawn pier is unchanged and nothing but the tram above could reach the difference.
        const pierTop = (x, z, r, seat) => { const under = tramSweep ? tramSweep.undersideOver(x, z, r, p => p.y >= seat - .5) : Infinity; if (under - .05 < seat - .5) tramSweepConflicts.pierTopsLowered++; return Math.min(seat - .5, under - .05); };
        // A single-column bent with a wide crosshead becomes a V: two inclined legs from the column's own footing. Only
        // where both legs keep the planner's clearance over whatever passes under them (4.7 m road, 5.2 m rail), touch no
        // building, water or mapped tree and stay out of a tram's sweep; otherwise the plain stem stays. ESTIMATE of form.
        const veeLegs = b => {
            if (!basarabStructure.report.active) return null; // (the Basarab district only; other districts keep the plain stems they were reviewed with)
            if (b.kind !== 'crosshead' || b.columns.length !== 1 || b.width < 6 || b.soffit < 3.5) return null;
            const c = b.columns[0], mid = (b.lo + b.hi) / 2, spread = Math.min(b.hi - c.o - .9, c.o - b.lo - .9, Math.max(1.6, b.soffit * .22));
            if (!(spread >= 1.2)) return null;
            const foot = [c.x, .3, c.z], tops = [c.o - spread, c.o + spread].map(o => [b.x + b.nx * (o - mid), b.soffit + .15, b.z + b.nz * (o - mid)]);
            for (const top of tops) for (const t of [.1, .2, .3, .4, .5, .6, .7, .8, .9, 1]) { // (L17 recheck: between five samples a leg leaned 1 cm into a ground tram's body)
                const x = foot[0] + (top[0] - foot[0]) * t, y = foot[1] + (top[1] - foot[1]) * t, z = foot[2] + (top[2] - foot[2]) * t;
                if (buildingAt(x, z) || isWater(x, z) || sourceTreeNear(x, z, 1.3)) return null;
                const under = lowerSurface(x, z, y - .2);
                if (under && y - .7 - under.y < (under.rail ? BENT_MODEL.railClearanceM : BENT_MODEL.roadClearanceM)) return null;
                if (tramSweep?.circle(x, z, .8, y - .9, y + .7, q => q.y < b.seat - .5)) return null;
            }
            return { foot, tops, spread };
        };
        for (const b of bridgeBents.bents) {
            const sb = cellOf(b.x, b.z).solid;
            if (b.kind === 'wall') {
                const w = Math.max(1, b.width - .4);
                sb.box(b.x, base, b.z, w, b.seat - base, .9, b.angle, conc);
                pierColl.push({ x: b.x, z: b.z, hw: w / 2, hd: .45, angle: b.angle, r: Math.hypot(w / 2, .45), poly: null, h: b.seat, prop: true, kind: 'pier', yMax: pierTop(b.x, b.z, Math.hypot(w / 2, .45), b.seat) });
                continue;
            }
            sb.box(b.x, b.soffit, b.z, b.width + .6, BENT_MODEL.beamDepthM, BENT_MODEL.beamWidthM, b.angle, conc);
            for (const p of b.pedestals) sb.box(p.x, p.y0, p.z, p.width, p.y1 - p.y0, 1, b.angle, conc);
            const vee = veeLegs(b);
            if (vee) {
                // one footing, two inclined legs to the crosshead (the single stem of a hammerhead pier, opened into a V)
                const c = b.columns[0];
                sb.box(c.x, base, c.z, 2.4, .7 - base, 1.5, b.angle, conc);
                pierColl.push({ x: c.x, z: c.z, hw: 1.2, hd: .75, angle: b.angle, r: 1.45, poly: null, h: .7, prop: true, kind: 'pier' });
                for (const top of vee.tops) bridgeBeam(cellOf, vee.foot, top, .95, '#a9a69e', pierColl, 'pier');
                b.vee = { spreadM: vee.spread, foot: vee.foot, tops: vee.tops }; bridgeBents.report.veePiers = (bridgeBents.report.veePiers || 0) + 1;
                continue;
            }
            for (const c of b.columns) {
                const m = BENT_MODEL.columnM;
                sb.box(c.x, base, c.z, m, b.soffit - base, m, b.angle, conc);
                pierColl.push({ x: c.x, z: c.z, hw: m / 2, hd: m / 2, angle: b.angle, r: m * .75, poly: null, h: b.soffit, prop: true, kind: 'pier', yMax: pierTop(c.x, c.z, m * .75, b.seat) });
            }
        }
        bridgeBents.report.slotInfill = { riverPlates: infill.riverPlates || 0, quads: infill.quads, areaM2: Math.round(infill.areaM2), maxGapM: +infill.maxGapM.toFixed(2), goreQuads: infill.gore || 0, keptOffCarriageway: infill.overRoad || 0 };
    }
    propColl.push(...basarabStructure.colliders);
    for(const piece of basarabStructure.pieces){propColl.push(piece);tramDecks.push(piece);sceneryDeckGrid.insert(piece.x-piece.r,piece.z-piece.r,piece.x+piece.r,piece.z+piece.r,piece);}
    // ---- the guard of the Pasajul Basarab decks: one rule (deck-outline.js). The railing stands 0.3 m outside every
    //      elevated carriageway side and pad rim, wherever no other carriageway (or filled median) continues there at
    //      its level: the outline of the union of the carriageways. It replaces five stages that each cut or added
    //      pieces by their own tests (the builder's rail, the lane cut, the "completion" walk, end joins, width tapers,
    //      a last removal on other roads); their thresholds disagreed and left the reports of 2026-11-12: no guard above
    //      a street passing below (588, -861), none between the carriageway and the tram slab (498, -797), gore noses
    //      left open (426, -750), zigzag and stray pieces at merges (376, -727), (80, -90), (93, 72). A tram slab, the
    //      slot infill or a platform beside the carriageway no longer opens the edge (Street View on Pasajul Basarab at
    //      44.44503, 26.06120: the carriageway keeps its barrier along the tracks). The railing runs down to 0.15 m
    //      above the street (owner, (134, -475): "why not fence till the end").
    const ghostRails = []; // railing pieces drawn without a collision wall (inside the tram guard's cover, clear of the tram body)
    const railingDrops = [], DROP = (x, z, why) => railingDrops.push([Math.round(x * 10) / 10, Math.round(z * 10) / 10, why]); // (stats.railingDrops: where a railing piece was left out, and why)
    const guardCompletion = { basis: 'raised decks: railing on the outline of the union of the elevated carriageways (deck-outline.js)', candidates: 0, runs: 0, lengthM: 0, addedM: 0, welds: 0, strays: 0, sweptM: 0, replacedWalls: 0 };
    {
        const GROW = .3, EPS = .05, LEVEL = .6, LOW = .15;
        for (let i = walls.length - 1; i >= 0; i--) { const w = walls[i]; if (w.edge && !w.tramDeckRailing && raisedDeck(w.edge) && (w.kind === 'rail' || w.kind === 'embank' || (w.kind === 'barrier' && w.inferred === true))) { walls.splice(i, 1); guardCompletion.replacedWalls++; } }
        // is (x, z) of a guard line at road level y taken by another surface: within GROW of a carriageway or pad at this
        // level (its own guard line runs there, or the two are one road), inside a deck up to 3 m above (the line would stand
        // in that deck), or at a filled median
        const sidePolys = new Map(), sideOf = e => { let q = sidePolys.get(e); if (!q) sidePolys.set(e, q = asphaltCorners(e, widthSide)); return q; };
        const takenAt = (x, z, y, ownE, ownN, ownMedian = null) => {
            let hit = false;
            surfGrid.each(x - 1, z - 1, x + 1, z + 1, o => {
                if (hit || (ownE && o.e === ownE) || (ownN && o.node === ownN) || x < o.x0 - 1 || x > o.x1 + 1 || z < o.z0 - 1 || z > o.z1 + 1) return;
                const dy = o.h(x, z) - y; if (dy <= -LEVEL || dy >= 3) return;
                // (on another deck's walkway band too: two decks parting share their walkways until those separate, so the
                // two guards meet in one nose there instead of a short cage of two pieces before a filled median begins)
                if (pointInPolygon(x, z, o.poly) || polyDist(x, z, o.poly) < GROW - EPS || (o.e && o.e.bridge && pointInPolygon(x, z, sideOf(o.e)))) hit = true;
            });
            if (!hit) medianGrid.each(x - .7, z - .7, x + .7, z + .7, d => { if (!hit && d !== ownMedian && Math.abs(d.roofHeightAt(x, z) - Y.road - y) < 1.6 && (pointInPolygon(x, z, d.poly) || polyDist(x, z, d.poly) < (ownMedian ? .05 : .65))) hit = true; });
            return hit;
        };
        const cands = [];
        for (const e of edges) {
            if (!e.bridge || e.virtual || e.tunnel || !raisedDeck(e)) continue;
            const [aR, bR, bL, aL] = asphaltCorners(e, (f, sd) => widthAsphalt(f, sd) + GROW), h = (x, z) => yAlong(e, x, z);
            cands.push({ e, node: null, a: aR, b: bR, nx: -e.nx, nz: -e.nz, h, low: e.overWater ? -Infinity : LOW }, { e, node: null, a: aL, b: bL, nx: e.nx, nz: e.nz, h, low: e.overWater ? -Infinity : LOW });
        }
        for (const o of surfList) {
            const n = o.node; if (!n || o.poly.length < 3 || !n.edges.some(e => e.bridge && !e.virtual && !e.tunnel && raisedDeck(e))) continue;
            const P = o.poly, cx = P.reduce((s2, q) => s2 + q[0], 0) / P.length, cz = P.reduce((s2, q) => s2 + q[1], 0) / P.length, h = (x, z) => padHeightAt(n, x, z);
            for (let k = 0; k < P.length; k++) {
                const p = P[k], q = P[(k + 1) % P.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < .05) continue;
                let ox = (q[1] - p[1]) / L, oz = -(q[0] - p[0]) / L; if (((p[0] + q[0]) / 2 - cx) * ox + ((p[1] + q[1]) / 2 - cz) * oz < 0) { ox = -ox; oz = -oz; }
                cands.push({ e: n.edges.find(e => e.bridge && !e.virtual && raisedDeck(e)), node: n, a: [p[0] + ox * GROW, p[1] + oz * GROW], b: [q[0] + ox * GROW, q[1] + oz * GROW], nx: -ox, nz: -oz, h, low: LOW });
            }
        }
        // the open end of a filled median (where its two carriageways part by more than the fill spans) is an edge too
        for (const d of medianFill.decks) {
            if (!d.edge || !raisedDeck(d.edge)) continue;
            for (const [p, q] of d.caps) {
                const L = Math.hypot(q[0] - p[0], q[2] - p[2]); if (L < .3) continue;
                let ox = (q[2] - p[2]) / L, oz = -(q[0] - p[0]) / L; if (((p[0] + q[0]) / 2 - d.x) * ox + ((p[2] + q[2]) / 2 - d.z) * oz < 0) { ox = -ox; oz = -oz; }
                cands.push({ e: d.edge, node: null, median: d, a: [p[0], p[2]], b: [q[0], q[2]], ox, oz, nx: -ox, nz: -oz, h: (x, z) => d.roofHeightAt(x, z) - Y.road, low: LOW });
            }
        }
        guardCompletion.candidates = cands.length;
        const pieces = [];
        for (const c of cands) {
            const taken = c.median
                ? (x, z) => { const y = c.h(x, z); return !(y > c.low) || takenAt(x + c.ox * .3, z + c.oz * .3, y, null, null, c.median); } // (beyond the cap: the next piece of the fill, or a carriageway)
                : (x, z) => { const y = c.h(x, z); return !(y > c.low) || takenAt(x, z, y, c.node ? null : c.e, c.node); };
            for (const [t0, t1] of openRuns(c.a, c.b, taken)) {
                const a = [c.a[0] + (c.b[0] - c.a[0]) * t0, c.a[1] + (c.b[1] - c.a[1]) * t0], b = [c.a[0] + (c.b[0] - c.a[0]) * t1, c.a[1] + (c.b[1] - c.a[1]) * t1];
                pieces.push({ a, b, ya: c.h(...a), yb: c.h(...b), c });
            }
        }
        // a railing a tram's swept body reaches is not built (the tram would run through it): a run that the sweep touches
        // first moves toward its own carriageway, to the asphalt edge at most
        const bodyLine = (a, b, ya, yb) => !!tramSweep && !!tramSweep.segment(a, b, -.15, Math.min(ya, yb) - .6, Math.max(ya, yb) + 1.1); // (the tram's own body plus 5 cm)
        const sweptLine = (a, b, ya, yb) => !!tramSweep && !!tramSweep.segment(a, b, .05, Y.road + Math.min(ya, yb) - .6, Y.road + Math.max(ya, yb) + 1.1);
        for (const p of pieces) {
            if (p.c.median || !sweptLine(p.a, p.b, p.ya, p.yb)) continue;
            for (const d of [.15, .3, .45, .6]) { const a = [p.a[0] + p.c.nx * d, p.a[1] + p.c.nz * d], b = [p.b[0] + p.c.nx * d, p.b[1] + p.c.nz * d]; if (!sweptLine(a, b, p.ya, p.yb)) { p.a = a; p.b = b; guardCompletion.insetM = (guardCompletion.insetM || 0) + Math.hypot(b[0] - a[0], b[1] - a[1]); break; } }
            // still inside the cover the tram guard keeps free (its body plus 0.2 m): the nearest line clear of the body itself
            if (sweptLine(p.a, p.b, p.ya, p.yb)) for (const d of [0, .15, .3, .45, .6]) { const a = [p.a[0] + p.c.nx * d, p.a[1] + p.c.nz * d], b = [p.b[0] + p.c.nx * d, p.b[1] + p.c.nz * d]; if (!bodyLine(a, b, Y.road + p.ya, Y.road + p.yb)) { p.a = a; p.b = b; break; } }
        }
        guardCompletion.welds = weldEnds(pieces);
        // (owner, 2026-11-12, Grozavesti (376, -727) "area looks broken", (93, 72) "fence sticks out"; earlier (712, -965), (81, -32)) where
        // the deck's outline steps sideways (a carriageway joining, a side narrowing at a node) the railing made a square jog
        // out into the road. The step becomes a 1:4 diagonal: the wider side's run stops early and the step piece leads from
        // there to the narrow side's corner (the deck beyond the diagonal stays as a strip outside the railing).
        {
            const key = q => Math.round(q[0] * 100) + ',' + Math.round(q[1] * 100), ends = new Map(), len = p => Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
            for (const p of pieces) for (const k of ['a', 'b']) { const id = key(p[k]); if (!ends.has(id)) ends.set(id, []); ends.get(id).push({ p, k }); }
            const mate = (p, k) => (ends.get(key(p[k])) || []).filter(q => q.p !== p);
            const away = ({ p: q, k }) => { const o = q[k === 'a' ? 'b' : 'a'], dx = o[0] - q[k][0], dz = o[1] - q[k][1], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l, l]; };
            let tapers = 0;
            for (const p of pieces) {
                const L = len(p); if (L < .5 || L > 4 || p.c.median) continue;
                const ma = mate(p, 'a'), mb = mate(p, 'b'); if (ma.length !== 1 || mb.length !== 1) continue;
                const dx = (p.b[0] - p.a[0]) / L, dz = (p.b[1] - p.a[1]) / L, A = away(ma[0]), B = away(mb[0]);
                if (Math.abs(A[0] * dx + A[1] * dz) > .5 || Math.abs(B[0] * dx + B[1] * dz) > .5 || A[0] * B[0] + A[1] * B[1] > -.8) continue; // (two runs going opposite ways, square to the step)
                const wideAtA = A[0] * p.c.nx + A[1] * p.c.nz > 0, wide = wideAtA ? ma[0] : mb[0], W = wideAtA ? A : B, T = Math.min(4 * L, W[2] - .5); // (the run on the deck side of the step is the wider side's)
                if (T < 1.5 * L) continue;
                const q = wide.p, at = [q[wide.k][0] + W[0] * T, q[wide.k][1] + W[1] * T];
                q[wide.k] = at; p[wideAtA ? 'a' : 'b'] = at.slice();
                const l2 = len(p), mx = -(p.b[1] - p.a[1]) / l2, mz = (p.b[0] - p.a[0]) / l2, sgn = Math.sign(mx * q.c.nx + mz * q.c.nz) || 1; p.nx = mx * sgn; p.nz = mz * sgn; tapers++;
            }
            guardCompletion.tapers = tapers;
        }
        for (const p of pieces) {
            const L = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]); if (L < .05) continue;
            const k = Math.max(1, Math.round(L / 2.4)), at = f => [p.a[0] + (p.b[0] - p.a[0]) * f, p.a[1] + (p.b[1] - p.a[1]) * f], c = p.c;
            guardCompletion.runs++;
            for (let j = 0; j < k; j++) {
                const A = at(j / k), B = at((j + 1) / k), ya = Y.road + c.h(...A), yb = Y.road + c.h(...B), len = L / k;
                // the collision band hangs below the deck; above a tram passing below it starts higher. A railing a tram's
                // swept body itself reaches is not built (the tram would run through it)
                let base = null;
                for (const b of [2.2, 1.1, .3]) if (!tramSweep || !tramSweep.segment(A, B, .05, Math.min(ya, yb) - b - .3, Math.max(ya, yb) + 1.1)) { base = b; break; }
                // (owner, 2026-11-12: "fences are not continuous on the bridge still in many places") where the tram runs right beside
                // the carriageway the railing line lies inside the 0.2 m cover the tram guard keeps free around a tram's body, so
                // no wall can stand there. Clear of the body itself, the railing is still drawn, without a wall: a tram passes
                // 5 cm from it and a car can cross it onto the track slab, which is level with the road there.
                let ghost = false;
                if (base === null) { if (bodyLine(A, B, ya, yb)) { DROP((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, "swept"); guardCompletion.sweptM += len; continue; } ghost = true; base = .3; }
                const low = Math.min(ya, yb) - Y.road <= 2.6 && base === 2.2;
                const w = { wall: true, completed: true, ax: A[0], az: A[1], bx: B[0], bz: B[1], y0a: low ? -1.5 : ya - base, y1a: ya + 1.1, y0b: low ? -1.5 : yb - base, y1b: yb + 1.1, yr: undefined, nx: p.nx ?? c.nx, nz: p.nz ?? c.nz, kind: 'rail', edge: c.e, x: (A[0] + B[0]) / 2, z: (A[1] + B[1]) / 2, r: len / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1 };
                if (c.node) w.node = c.node;
                w.basarabStyle = true; // (drawn with the whole railing network, further on)
                if (ghost) { w.wall = false; w.ghost = true; ghostRails.push(w); guardCompletion.visualOnlyM = (guardCompletion.visualOnlyM || 0) + len; } else walls.push(w);
                guardCompletion.lengthM += len;
            }
        }
        // the station platforms: where the carriageway beside a platform descends, the platform's edge stands up to 2 m above
        // it with nothing along it. The same railing follows every platform side that has no surface at its level beside it
        // (the track slab, another platform piece) and no carriageway railing at its height within 0.8 m.
        {
            const gg = new BoxGrid(16); for (const w of walls) if (w.completed && w.kind === 'rail') gg.insert(Math.min(w.ax, w.bx) - .8, Math.min(w.az, w.bz) - .8, Math.max(w.ax, w.bx) + .8, Math.max(w.az, w.bz) + .8, w);
            const guardAt = (x, z, y) => { let hit = false; gg.each(x, z, x, z, w => { if (hit) return; const dx = w.bx - w.ax, dz = w.bz - w.az, t = clamp(((x - w.ax) * dx + (z - w.az) * dz) / (dx * dx + dz * dz || 1), 0, 1); if (Math.hypot(x - w.ax - dx * t, z - w.az - dz * t) < .8 && Math.abs(w.y1a + (w.y1b - w.y1a) * t - (y + 1.1)) < .6) hit = true; }); return hit; };
            let platformM = 0;
            for (const d of basarabStructure.pieces) {
                if (d.kind !== 'basarab-platform') continue;
                const P = d.poly, y = d.top.reduce((m, q) => m + q[1], 0) / d.top.length;
                for (let k = 0; k < P.length; k++) {
                    const a = P[k], b = P[(k + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < .3) continue;
                    let ox = (b[1] - a[1]) / L, oz = -(b[0] - a[0]) / L; if (((a[0] + b[0]) / 2 - d.x) * ox + ((a[1] + b[1]) / 2 - d.z) * oz < 0) { ox = -ox; oz = -oz; }
                    const taken = (x, z) => { let level = false; for (const o of [.4, .9]) surfacesAt(x + ox * o, z + oz * o, h => { if (Math.abs(h - y) < .4) level = true; }); return level || guardAt(x, z, y); };
                    for (const [t0, t1] of openRuns(a, b, taken)) {
                        const len = (t1 - t0) * L, k2 = Math.max(1, Math.round(len / 2.4)), at = f => [a[0] + (b[0] - a[0]) * (t0 + (t1 - t0) * f) - ox * .1, a[1] + (b[1] - a[1]) * (t0 + (t1 - t0) * f) - oz * .1];
                        if (len < 1.5) continue;
                        for (let j = 0; j < k2; j++) {
                            const A = at(j / k2), B = at((j + 1) / k2);
                            if (tramSweep && tramSweep.segment(A, B, .05, y - .5, y + 1.1)) continue;
                            const w = { wall: true, estimated: true, completed: true, platformRailing: true, ax: A[0], az: A[1], bx: B[0], bz: B[1], y0a: y - .2, y1a: y + 1.1, y0b: y - .2, y1b: y + 1.1, yr: undefined, nx: -ox, nz: -oz, kind: 'rail', edge: null, tramDeckRailing: true, x: (A[0] + B[0]) / 2, z: (A[1] + B[1]) / 2, r: len / k2 / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.1 };
                            walls.push(w); platformM += len / k2;
                            
                            w.basarabStyle = true;
                        }
                    }
                }
            }
            guardCompletion.platformM = Math.round(platformM);
        }
        guardCompletion.lengthM = Math.round(guardCompletion.lengthM); guardCompletion.addedM = guardCompletion.lengthM; guardCompletion.sweptM = Math.round(guardCompletion.sweptM * 10) / 10;
    }
    // ---- railings of the tram-only decks. The estimated tram viaduct had none: an open slab edge 6-11 m up. A railing runs
    //      along every slab edge that is high (or over water) and has no surface at its level beside it (the other track's
    //      slab, the slot infill, a platform, a carriageway). On a bend the rigid tram body overhangs its own 1.7 m slab
    //      edge: there the railing stands outboard, up to 0.75 m, on a walkway strip. Same white rails and blue fascia as
    //      the Basarab road decks; ESTIMATE, with a collision wall each.
    const tramRailings = { basis: 'MODEL: estimated railing on open edges of elevated tram slabs', runs: 0, lengthM: 0, outboardM: 0, sweptEdgeM: 0, besideGuardM: 0 };
    {
        // (owner, 2026-11-11: "fences on basarab are placed weirdly, they should be continuous" / "why is the fence not going all
        //  the way?") The outboard distance was chosen piece by piece, so the line stepped in and out every few metres; it
        //  stopped 1.5 m above the ground; and it doubled the road guard where one already stood beside the slab. Now: one
        //  outboard distance for each unbroken stretch of a source way's side (the largest any of its pieces needs), down to
        //  0.45 m above the ground, and none where a guard at least 0.6 m higher than the slab stands within 1.4 m.
        const ways = new Map();
        for (const d of tramDecks) { if (d.kind !== 'source-tram-deck' || !d.supportTop) continue; let l = ways.get(d.sourceId); if (!l) ways.set(d.sourceId, l = []); l.push(d); }
        // (owner, 2026-11-12, Grozavesti (1086, -1266): "should the fence not go all the way?") a street up to 1.2 m below the
        // descending tram slab counted as level with it and the railing stopped while the slab still stood a metre above the
        // street beside it. Only a surface within 0.35 m (the other track's slab, a platform) is level now.
        const level = (x, z, y) => { let found = false; surfacesAt(x, z, h => { if (Math.abs(h - y) < .35) found = true; }); return found; };
        const guardGrid = new BoxGrid(16); for (const w of walls) if (w.wall && (w.kind === 'rail' || w.kind === 'barrier')) guardGrid.insert(Math.min(w.ax, w.bx) - 1.4, Math.min(w.az, w.bz) - 1.4, Math.max(w.ax, w.bx) + 1.4, Math.max(w.az, w.bz) + 1.4, w);
        // (with a direction tx, tz only a guard converging at an angle counts: a parallel one 1 m off is the road's own barrier,
        // Street View on Pasajul Basarab shows both)
        const guardBeside = (x, z, y, reach = 1.4, tx = null, tz = null) => { let hit = false; guardGrid.each(x, z, x, z, w => { if (hit) return; const dx = w.bx - w.ax, dz = w.bz - w.az, t = clamp(((x - w.ax) * dx + (z - w.az) * dz) / (dx * dx + dz * dz || 1), 0, 1); if (tx !== null && Math.abs(dx * tx + dz * tz) / (Math.hypot(dx, dz) || 1) > .985) return; const top = w.y1a + (w.y1b - w.y1a) * t; if (Math.hypot(x - w.ax - dx * t, z - w.az - dz * t) < reach && top >= y + .6 && top <= y + 2.25 && w.y0a + (w.y0b - w.y0a) * t <= y + .3) hit = true; }); return hit; }; // (owner, 2026-11-12: the guard of a deck more than 1.15 m above the slab stands over its railing, it does not replace it; the tram ramp beside Orhideelor lost 20 m of railing to the collision band of the road deck 2.3 m above)
        // is the railing line of slab side A -> B, k m outboard, on a carriageway beside the slab at about its level
        const onRoadLine = (A, B, ux, uz, k) => [0, .5, 1].some(f => { const x = A[0] + (B[0] - A[0]) * f + ux * k, z = A[2] + (B[2] - A[2]) * f + uz * k, y = A[1] + (B[1] - A[1]) * f - Y.road; let hit = false;
            surfGrid.each(x - .3, z - .3, x + .3, z + .3, o => { if (hit || x < o.x0 - .3 || x > o.x1 + .3 || z < o.z0 - .3 || z > o.z1 + .3) return; const dy = o.h(x, z) - y; if (dy <= -6 || dy >= 1.5) return; const inside = pointInPolygon(x, z, o.poly), d = polyDist(x, z, o.poly); if (inside ? d > .05 && dy > (k <= 0 ? -1.2 : -4.5) : dy > .3 && d < .25) hit = true; }); return hit; }); // (over a lane: on the slab edge only from 1.2 m above it, outboard only with 4.5 m of headroom, or it stands among the cars; and never right at the edge of a carriageway higher than the slab, where it would sink into it)
        const emit = (a, b, ux, uz, out, split = true, ghost = false) => {
            const o = out - .1, A = [a[0] + ux * o, a[1], a[2] + uz * o], B = [b[0] + ux * o, b[1], b[2] + uz * o], len = Math.hypot(B[0] - A[0], B[2] - A[2]); if (len < .6) return;
            // (owner, 2026-11-12, Grozavesti (826, -1050) "what's going on here") the railing as finally placed (outboard) is checked
            // against the road guards: where one stands within 0.7 m, or converges at an angle within 1.6 m, that part is left
            // out (the two crossed); the rest is emitted in pieces
            if (split) {
                const tx = (B[0] - A[0]) / len, tz = (B[2] - A[2]) / len, n = Math.max(1, Math.ceil(len / .5)), runs = []; let run = null;
                for (let i = 0; i < n; i++) {
                    const f = (i + .5) / n, x = A[0] + (B[0] - A[0]) * f, z = A[2] + (B[2] - A[2]) * f, y = A[1] + (B[1] - A[1]) * f;
                    const blocked = guardBeside(x, z, y, .7) || guardBeside(x, z, y, 1.6, tx, tz);
                    if (blocked) { if (run) { runs.push(run); run = null; } } else if (run) run[1] = (i + 1) / n; else run = [i / n, (i + 1) / n];
                }
                if (run) runs.push(run);
                if (!(runs.length === 1 && runs[0][0] === 0 && runs[0][1] === 1)) {
                    const at = f => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
                    tramRailings.besideGuardM += len * (1 - runs.reduce((m, r) => m + r[1] - r[0], 0));
                    for (const [f0, f1] of runs) emit(at(f0), at(f1), ux, uz, out, false, ghost);
                    return;
                }
            }
            const w = { wall: true, estimated: true, tramDeckRailing: true, ax: A[0], az: A[2], bx: B[0], bz: B[2], y0a: A[1] - .2, y1a: A[1] + 1.1, y0b: B[1] - .2, y1b: B[1] + 1.1, nx: -ux, nz: -uz, kind: 'rail', edge: null,
                x: (A[0] + B[0]) / 2, z: (A[2] + B[2]) / 2, r: len / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.1 };
            w.basarabStyle = true; if (ghost) { w.wall = false; w.ghost = true; ghostRails.push(w); tramRailings.visualOnlyM = (tramRailings.visualOnlyM || 0) + len; } else walls.push(w); tramRailings.runs++; tramRailings.lengthM += len; if (out > 0) tramRailings.outboardM += len;
        };
        for (const pieces of ways.values()) for (const side of [0, 1]) {
            // what each piece of this side needs: null (no railing), or the smallest outboard distance clear of the tram sweep
            const need = pieces.map(d => {
                const T = d.supportTop, A = side ? T[3] : T[0], B = side ? T[2] : T[1]; // both sides run a -> b
                const mx = (A[0] + B[0]) / 2, mz = (A[2] + B[2]) / 2, my = (A[1] + B[1]) / 2, ox = mx - d.x, oz = mz - d.z, ol = Math.hypot(ox, oz) || 1, ux = ox / ol, uz = oz / ol, len = Math.hypot(B[0] - A[0], B[2] - A[2]);
                // (owner, 2026-11-12, Grozavesti (107, -234): "still random fence here") a slab at street level over the river is
                // inner where another slab or carriageway of the bridge lies beyond it (the river plate closes that slot): no railing
                const high = my > .45 || (isWater(mx + ux * 1.5, mz + uz * 1.5) && ![2, 4, 6, 8, 10].some(k => coveredByOther(mx + ux * k, mz + uz * k, null, my - Y.road, 0, false, .6)));
                if (!high || level(mx + ux * .5, mz + uz * .5, my) || level(mx + ux * 1.1, mz + uz * 1.1, my)) return null;
                // (owner, 2026-11-12, Grozavesti (135, -325), (159, -426): "missing fence chunks ... is the tram supposed to have
                // fence? check streetview"; Street View on Pasajul Basarab at 44.44503, 26.06120: the carriageway has a low concrete
                // barrier and the tram slab its own blue steel railing, both unbroken) a road guard beside the slab no longer
                // replaces the tram railing: where the road guard was cut, the slab was left open in chunks.
                if (guardBeside(mx + ux * .3, mz + uz * .3, my, .7) || [[mx, mz], [A[0], A[2]], [B[0], B[2]]].some(([px, pz]) => guardBeside(px + ux * .3, pz + uz * .3, my, 1.6, (B[0] - A[0]) / (len || 1), (B[2] - A[2]) / (len || 1)))) { tramRailings.besideGuardM += len; return null; } // (owner, 2026-11-12, (826, -1050): where they converge the two crossed; the road guard alone stands there) // (owner, 2026-11-12, (826, -1050) "what's going on here": only a guard within 0.7 m duplicates it; they crossed where they converged)
                // (owner, 2026-11-12, Grozavesti (983, -1179) "cars go in fence", (981, -1186) "goes underground": the outboard railing
                // stood in the lane of the street beside the descending slab, and sank into a carriageway higher than the slab)
                // the railing never stands on a carriageway; where no outboard place is free, a place just inside the slab edge is tried
                for (const out of [0, .25, .5, .75, 1, 1.25, 1.5, -.1, -.25]) { const k = out - .1; if (!onRoadLine(A, B, ux, uz, k) && !tramSweep?.segment([A[0] + ux * k, A[2] + uz * k], [B[0] + ux * k, B[2] + uz * k], .1, Math.min(A[1], B[1]) - .5, Math.max(A[1], B[1]) + 1.1)) return { A, B, ux, uz, out, len, mx, mz }; } // (up to 1.5 m outboard on a curve where a tram's body overhangs the slab)
                // (inside the cover the tram guard keeps free but clear of the tram body: drawn without a wall, like the road guard there)
                for (const out of [0, -.1, -.25, .25, .5]) { const k = out - .1; if (!onRoadLine(A, B, ux, uz, k) && !tramSweep?.segment([A[0] + ux * k, A[2] + uz * k], [B[0] + ux * k, B[2] + uz * k], -.15, Math.min(A[1], B[1]) - .5, Math.max(A[1], B[1]) + 1.1)) return { A, B, ux, uz, out, len, mx, mz, ghost: true }; }
                DROP(mx, mz, "t-swept"); tramRailings.sweptEdgeM += len; return null;
            });
            for (let i = 0; i < need.length;) {
                if (!need[i]) { i++; continue; }
                let j = i; while (j + 1 < need.length && need[j + 1] && (need[j + 1].out < 0) === (need[i].out < 0) && !!need[j + 1].ghost === !!need[i].ghost && Math.hypot(need[j + 1].A[0] - need[j].B[0], need[j + 1].A[2] - need[j].B[2]) < .3) j++;
                let out = need[i].out; for (let k = i; k <= j; k++) out = need[i].out < 0 ? Math.min(out, need[k].out) : Math.max(out, need[k].out);
                let start = need[i];
                const ghost = !!need[i].ghost, sweptAt = q => { const k = out - .1; return onRoadLine(q.A, q.B, q.ux, q.uz, k) || !!tramSweep?.segment([q.A[0] + q.ux * k, q.A[2] + q.uz * k], [q.B[0] + q.ux * k, q.B[2] + q.uz * k], ghost ? -.15 : .1, Math.min(q.A[1], q.B[1]) - .5, Math.max(q.A[1], q.B[1]) + 1.1); };
                for (let k = i; k <= j; k++) {
                    const q = need[k];
                    // the stretch's outboard distance can put this piece in the sweep of a neighbouring track: no railing here
                    if (sweptAt(q)) {
                        if (start !== q && k > i) emit(start.A, need[k - 1].B, q.ux, q.uz, out, true, ghost);
                        // (a piece the stretch's distance does not suit keeps its own place on the slab edge, when it has one)
                        if (q.out <= 0 && q.out !== out) emit(q.A, q.B, q.ux, q.uz, q.out, true, ghost); else { DROP(q.mx, q.mz, "t-swept2"); tramRailings.sweptEdgeM += q.len; }
                        start = need[k + 1]; continue;
                    }
                    if (!start) start = q;
                    if (out > 0) { // the walkway strip under an outboard railing
                        const mb = cellOf(q.mx, q.mz).solid, A1 = [q.A[0] + q.ux * out, q.A[1], q.A[2] + q.uz * out], B1 = [q.B[0] + q.ux * out, q.B[1], q.B[2] + q.uz * out], dn = v => [v[0], v[1] - .14, v[2]], grate = rgb('#8b8f8e');
                        mb.face4(q.A, q.B, B1, A1, grate, [0, 1, 0]); mb.face4(dn(A1), dn(B1), dn(q.B), dn(q.A), rgb('#5b5e5d'), [0, -1, 0]); mb.face4(dn(A1), A1, B1, dn(B1), grate, [q.ux, 0, q.uz]);
                    }
                    if (k === j || Math.hypot(need[k + 1].B[0] - start.A[0], need[k + 1].B[2] - start.A[2]) > 9.6) { emit(start.A, q.B, q.ux, q.uz, out, true, ghost); start = k < j ? need[k + 1] : null; }
                }
                i = j + 1;
            }
        }
        // (owner, 2026-11-12, Grozavesti (982, -1190): "not connected") stretches with different outboard distances, and the
        // pieces of two source ways meeting, ended side by side up to 1.5 m apart: two railings with an open step between them.
        // Two railing ends that close, at one height and facing each other, get a connecting piece clear of the tram sweep.
        {
            const rails = walls.filter(w => w.tramDeckRailing), ends = [];
            for (const w of rails) { const L = Math.hypot(w.bx - w.ax, w.bz - w.az) || 1; for (const end of [0, 1]) ends.push({ w, x: end ? w.bx : w.ax, z: end ? w.bz : w.az, y: end ? w.y1b : w.y1a, ux: (w.bx - w.ax) / L * (end ? 1 : -1), uz: (w.bz - w.az) / L * (end ? 1 : -1), used: false }); }
            for (const a of ends) {
                if (a.used) continue; let best = null;
                for (const b of ends) {
                    if (b === a || b.w === a.w || b.used || Math.abs(a.y - b.y) > .3) continue;
                    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < .05 || d > 1.5 || (best && d >= best.d)) continue;
                    if (a.ux * -b.ux + a.uz * -b.uz < .5 || dx * a.ux + dz * a.uz < -.6 || -dx * b.ux - dz * b.uz < -.6) continue; // (the two run on from each other)
                    best = { b, d };
                }
                if (!best) continue; const b = best.b;
                if (tramSweep?.segment([a.x, a.z], [b.x, b.z], .05, Math.min(a.y, b.y) - 1.3, Math.max(a.y, b.y))) continue;
                const len = best.d, w = { wall: true, estimated: true, tramDeckRailing: true, ax: a.x, az: a.z, bx: b.x, bz: b.z, y0a: a.y - 1.3, y1a: a.y, y0b: b.y - 1.3, y1b: b.y, nx: a.w.nx, nz: a.w.nz, kind: 'rail', edge: null,
                    x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, r: len / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.1, joinPiece: true };
                w.basarabStyle = true; walls.push(w); a.used = b.used = true; tramRailings.joins = (tramRailings.joins || 0) + 1;
            }
        }
        for (const k of ['lengthM', 'outboardM', 'sweptEdgeM', 'besideGuardM']) tramRailings[k] = Math.round(tramRailings[k]);
    }
    return {
        ARCH, DROP, basarabStructure, bridgeBents, collision, facadeBoards, fasciaLayoutAudit, ghostRails,
        guardCompletion, lmSignColl, palette, propColl, railingDrops, roofCols, tramRailings,
    };
}
