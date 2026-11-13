// ============================================================================
//  WORLD ROOF ADS AND FUEL — rooftop adverts, fuel forecourts, transit shelters
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { sourceTransitShelterDecision } from './source-transit-shelter.js';
import { pointInPolygon } from './util.js';
import { rgb } from './geobuild.js';
import { emitFuelForecourt } from './fuel-forecourt.js';
import { fuelLookFor, fuelStationRow } from './fuel-look.js';
import { KIND_STYLE, STOP_POLE_ONLY, Y, brandStyle, polysCross, props, setProgress, shoulderOf, signedArea, tick } from './world-shared.js';

export async function buildRoofAdsFuel(ctx) {
    const {
        US, addPropColl, addSignQuad, addUnitSign, bGrid, bRecs, buildingAt, buildingIndex,
        cellOf, city, data, distId, edgeGrid, inDistrictLL, liftOnSide, nearestEdge,
        obbPoly, onRibbon, pois, polyDist, polyOnRibbon, propColl, raisedTop, sceneryStopEdge,
        signs, stopMarginM, str, surfacesAt, tramSweep, treeClear,
    } = ctx;
    // ---- rooftop advertising (R12.3) from the field research (game/research/bucharest-romana.json rooftop_signs):
    //      lit sign boxes on the roof edge facing the street / square, on a steel frame; sign-atlas material = self-lit
    const ROOF_ADS = {
        bucharest: [
            { lat: 44.44660, lon: 26.09700, text: 'Coca-Cola', bg: '#e41e2b', fg: '#ffffff', w: 26 },   // Piața Romană 9 (photo Apr 2023)
            { lat: 44.44720, lon: 26.09560, text: 'NetBet', bg: '#141a2e', fg: '#3aa0ff', w: 16 },      // Lascăr Catargiu 2–4 (photo Apr 2023)
            // Piața Victoriei: rooftop ads exist on the 1990s blocks but the current brands are not researched → unbranded frames
            { lat: 44.45160, lon: 26.08720, text: 'SPAȚIU PUBLICITAR', bg: '#e8e8e4', fg: '#55585c', w: 20, generic: true },
            { lat: 44.45250, lon: 26.08690, text: 'SPAȚIU PUBLICITAR', bg: '#e8e8e4', fg: '#55585c', w: 20, generic: true },
        ],
    }[city.id] || [];
    let roofAds = 0; const roofAdList = [];
    for (const ad of ROOF_ADS) {
        if (!inDistrictLL(ad.lat, ad.lon, 0)) continue;
        const q = city.proj(ad.lat, ad.lon);
        let b = buildingAt(q.x, q.z); if (b && (b.skip || b.h < 18)) b = null;
        if (!b) { let bd = 70; bGrid.each(q.x - 70, q.z - 70, q.x + 70, q.z + 70, (o) => { if (o.skip || o.area < 200 || o.h < 18) return; const d = Math.hypot(o.c[0] - q.x, o.c[1] - q.z); if (d < bd) { bd = d; b = o; } }); }
        if (!b) continue; // (rooftop signs stand on blocks of ≥ 6 storeys)
        const ne = nearestEdge(b.c[0], b.c[1], (e) => !e.virtual && /^(primary|secondary|trunk)/.test(e.type), 120); if (!ne) continue;
        // the roof edge facing that road
        const ring = b.ring, ccw = signedArea(ring) > 0; let best = null, bs = -Infinity;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 8) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const mx = (ax + bx) / 2, mz = (az + bz) / 2, tx = ne.cx - mx, tz = ne.cz - mz, tl = Math.hypot(tx, tz) || 1;
            const sc = (tx * nx + tz * nz) / tl * 2 + Math.min(L, 30) / 30; if (sc > bs) { bs = sc; best = { mx, mz, nx, nz, L }; }
        }
        if (!best) continue;
        const sg = signs.get(ad.text, ad.bg, ad.fg, null, true); if (!sg) continue;
        const w = Math.min(ad.w, best.L * 0.9), hh = Math.min(4.5, w / sg.aspect), c2 = cellOf(best.mx, best.mz);
        const x = best.mx - best.nx * 1.0, z = best.mz - best.nz * 1.0, ang = Math.atan2(best.nx, best.nz), y = b.h + 1.2 + hh / 2;
        addSignQuad(c2, x, z, ang, 1, w, hh, y, sg, 0.15);
        const steel = rgb('#3a3d42');
        for (const f of [-0.42, 0, 0.42]) { const px = x + best.nz * w * f, pz = z - best.nx * w * f; c2.solid.box(px, b.h, pz, 0.14, 1.2 + hh, 0.14, ang, steel); }
        c2.solid.box(x - best.nx * 0.08, b.h + 1.2, z - best.nz * 0.08, w, hh, 0.12, ang, steel);
        roofAds++; roofAdList.push({ text: ad.text, x: Math.round(x), z: Math.round(z), y: Math.round(y), nx: +best.nx.toFixed(2), nz: +best.nz.toFixed(2) });
    }
    // (the warm 'square glow' pools were removed: render's lamps / floodlights carry the squares at night)

    // -----------------------------------------------------------------------
    //  POIs from OSM (businesses, transport…)
    // -----------------------------------------------------------------------
    setProgress('Opening the shops…'); await tick();
    const P = props();
    const fuelLog = []; // fuel forecourts: where the canopy went (or why not) — world.stats.fuel
    // (fidelity pass r2) pump islands under the mapped canopy + a brand pylon at the street: fuel-forecourt.js (districts only)
    const fuelForecourts = [];
    const fuelForecourt = (x, z, label, canopyRec) => {
        if (!label) return;
        // a second fuel point of one station (an LPG point beside the canopy) gets no pylon of its own
        if (!canopyRec && data.pois.some(r => { if (data.poiKinds[r[0]] !== 'fuel') return false; const d = Math.hypot(r[1] / 10 - x, r[2] / 10 - z); const other = (str(r[4]) || str(r[3])).toLowerCase(); return d > 1 && d < 60 && !!other && label.toLowerCase().includes(other) && !!bRecs[buildingIndex(r[6], r[1] / 10, r[2] / 10)]?.canopy; })) return; // (same brand only: GPL Lukoil beside Lukoil)
        const bsF = brandStyle(label) || ['#1f2937', '#ffffff', '#f97316'], lane = canopyRec ? nearestEdge(canopyRec.c[0], canopyRec.c[1], q => q.type === 'service' && !q.virtual && !q.tunnel, 22) : null;
        // (2026-11-12) the street is looked for from the canopy (else the mapped point); emitFuelForecourt keeps the pylon on
        // the station's own frontage, so a street that only passes 70 m away gives no pylon (was 90-98 m from the station)
        const ax = canopyRec ? canopyRec.c[0] : x, az = canopyRec ? canopyRec.c[1] : z;
        const streets = [], seenE = new Set();
        for (let k = 0; k < 3; k++) { // the three nearest public street edges (different edges), nearest first
            const stE = nearestEdge(ax, az, q => q.drivable && !q.virtual && !q.tunnel && q.type !== 'service' && !/motorway/.test(q.type) && Math.abs(q.ya) < 0.3 && Math.abs(q.yb) < 0.3 && !seenE.has(q), 70);
            if (!stE) break; seenE.add(stE.edge);
            const q = stE.edge, sd = ((ax - stE.cx) * q.nx + (az - stE.cz) * q.nz) >= 0 ? 1 : -1, off = (sd > 0 ? q.wR : q.wL) + 1.0;
            streets.push({ x: stE.cx + q.nx * off * sd, z: stE.cz + q.nz * off * sd, nx: q.nx * sd, nz: q.nz * sd, dirx: q.dirx, dirz: q.dirz });
        }
        const street = streets[0] || null;
        // (r3) the station's panorama review (fuel-look.js): pylon only where one was seen, brand look, islands beside the drive lane
        const review = fuelStationRow(city.id + '-' + distId, canopyRec ? data.buildingIds?.[canopyRec.i] : null, label, x, z, city.proj), look = fuelLookFor(label, review);
        const pq = review?.pylon?.lat != null ? city.proj(review.pylon.lat, review.pylon.lon) : null, sgn = look?.sign || bsF, lanes = [];
        if (canopyRec) edgeGrid.each(canopyRec.x0 - 4, canopyRec.z0 - 4, canopyRec.x1 + 4, canopyRec.z1 + 4, q => { if (q.type === 'service' && !q.virtual && !lanes.includes(q)) lanes.push(q); });
        const notSvc = rb => rb.e ? rb.e.type !== 'service' : (rb.node?.allEdges || rb.node?.edges || []).some(q => q.type !== 'service');
        fuelForecourts.push(emitFuelForecourt({ cellOf, rgb, baseY: (px, pz) => raisedTop(px, pz) ?? Y.side,
            blocked: (px, pz, r, o) => (o?.serviceOk ? onRibbon(px, pz, r, notSvc) : onRibbon(px, pz, r)) ? 'carriageway' : buildingAt(px, pz) && buildingAt(px, pz) !== canopyRec ? 'building' : tramSweep?.circle(px, pz, r + 0.2, 0, 7) ? 'tram-sweep' : null,
            addCollider: (px, pz, r, kind) => propColl.push({ x: px, z: pz, r, hw: r, hd: r, angle: 0, poly: null, h: 3, prop: true, kind, estimated: true }), addSign: addSignQuad },
            { name: label, at: [x, z], ring: canopyRec?.ring || null, laneDir: lane ? [lane.edge.dirx, lane.edge.dirz] : null, street, streets, colours: bsF, review, look, pylonAt: pq ? [pq.x, pq.z] : null, lanes: lanes.map(q => [[q.a.x, q.a.z], [q.b.x, q.b.z]]),
              sign: signs.get((look?.text || label).slice(0, 18), sgn[0], sgn[1], sgn[2]), panel: signs.get(' ', '#15181c', '#15181c', null) }));
    };
    const transitShelterAudit = [];
    for (const [poiIndex, r] of data.pois.entries()) {
        const kind = data.poiKinds[r[0]];
        const x = r[1] / 10, z = r[2] / 10, name = str(r[3]), brand = str(r[4]), sub = str(r[5]), bIdx = buildingIndex(r[6], x, z);
        const ks = KIND_STYLE[kind] || KIND_STYLE.landmark;
        // (r3-look-2) a station a panorama shows under another brand than OSM's (fuel-look.js `seenBrand`, documented exception)
        // is labelled on the map as it is drawn; the data keeps the OSM brand
        const seenFuel = kind === 'fuel' && bIdx >= 0 ? fuelStationRow(city.id + '-' + distId, data.buildingIds?.[bRecs[bIdx]?.i])?.text : null;
        const label = seenFuel || name || brand || (kind === 'busstop' ? (sub.startsWith('tram') ? (US ? 'Streetcar stop' : 'Stație tramvai') : (US ? 'Bus stop' : 'Stație autobuz')) : kind === 'metro' ? (US ? 'Link station' : 'Metrou') : kind);
        const poi = { id: 'osm' + pois.length, kind, sub, label, brand: seenFuel && brand ? seenFuel : brand, x, z, doorX: x, doorZ: z, color: ks.color, icon: sub.startsWith('cafe') ? '☕' : sub === 'atm' ? '🏧' : ks.icon, // (unirii-small: a mapped ATM is an ATM on the map, not a bank)
             visited: false, h: 4, w: 4, d: 4, interactive: false, building: bIdx };
        pois.push(poi);
        if (kind === 'busstop') { poi.shelterModel = sourceTransitShelterDecision(data, poiIndex); transitShelterAudit.push({ poiId: poi.id, ...poi.shelterModel }); }
        if (kind === 'fuel') { // the pump is reached from the street: door at the kerb of the nearest drivable lane
            const okLane = (q) => q.drivable && !q.virtual && !q.tunnel && !/motorway|_link/.test(q.type) && Math.abs(q.ya) < 0.3 && Math.abs(q.yb) < 0.3;
            const dn = nearestEdge(x, z, (q) => okLane(q) && q.type !== 'service', 60) || nearestEdge(x, z, okLane, 150); // a street, not the forecourt's own service lane
            if (dn) {
                const q = dn.edge, sd = ((x - dn.cx) * q.nx + (z - dn.cz) * q.nz) >= 0 ? 1 : -1;
                let off = (sd > 0 ? q.wR : q.wL) + 1.2, dx = dn.cx + q.nx * off * sd, dz = dn.cz + q.nz * off * sd;
                if (buildingAt(dx, dz)) { off = (sd > 0 ? q.wR : q.wL) + 0.4; dx = dn.cx + q.nx * off * sd; dz = dn.cz + q.nz * off * sd; }
                poi.doorX = dx; poi.doorZ = dz;
            }
        }
        const c = cellOf(x, z);
        // (round 3, r2-builder-sign-side) data.poiSignAnchors (tools/osm/fix-pois.mjs): where OSM says the sign is (an entrance node, the face on the POI's own address street); else the POI point
        const anchor = data.poiSignAnchors?.[poiIndex];
        if (['food', 'shop', 'bank', 'pharmacy', 'hotel'].includes(kind) && bIdx >= 0 && bRecs[bIdx] && (brand || name) && sub !== 'atm') addUnitSign(bRecs[bIdx], anchor ? anchor[0] : x, anchor ? anchor[1] : z, (brand || name), kind, poiIndex, !!anchor); // (ATMs do not name a unit — world-data Request)
        let ne = nearestEdge(x, z);
        if (!ne) continue;
        let e = ne.edge;
        let side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
        let roadAng = Math.atan2(e.dirx, e.dirz); // rotation about Y that maps local +z onto the edge direction
        if (kind === 'fuel') { // sourced stations keep their anchor; only clear footprints get forecourt decoration
            let sourceCanopy = bIdx >= 0 ? bRecs[bIdx] : null;
            if (!sourceCanopy?.canopy) { // (r3-look-3) a station node whose canopies OSM maps as separate untagged roofs: fuel-look.js row canopies, nearest first
                const ids = fuelStationRow(city.id + '-' + distId, null, brand || name, x, z, city.proj)?.canopies || [];
                const recs = ids.map(id => bRecs.find(o => !o.skip && o.canopy && data.buildingIds?.[o.i] === id)).filter(Boolean);
                if (recs.length) { sourceCanopy = recs[0]; for (const extra of recs.slice(1)) fuelForecourt(x, z, brand || name, extra); }
            }
            if (sourceCanopy?.canopy && !sourceCanopy.skip) {
                // The source roof was already emitted at its real footprint. Do not add a guessed 10x16m canopy/pumps.
                poi.h = sourceCanopy.h; poi.w = sourceCanopy.x1 - sourceCanopy.x0; poi.d = sourceCanopy.z1 - sourceCanopy.z0;
                fuelLog.push({ name: brand || name, x: Math.round(x), z: Math.round(z), canopy: true, source: data.buildingIds?.[sourceCanopy.i], sourceFootprint: true, topM: sourceCanopy.h, clearanceM: sourceCanopy.minH, topSource: sourceCanopy.canopy.topSource, clearanceSource: sourceCanopy.canopy.clearanceSource, supports: sourceCanopy.canopySupports || 0, supportSource: sourceCanopy.canopy.supportSource });
                { // (2026-11-12) the mapped canopy carries the station's brand board on its (up to four) main fascias (brand from the
                  // source POI, colours from the brand table); pumps / pylon stay unknown and are not drawn
                    const lkC = fuelLookFor(brand || name, fuelStationRow(city.id + '-' + distId, data.buildingIds?.[sourceCanopy.i])); // (r3: fuel-look.js)
                    const bsC = lkC?.sign || brandStyle(brand || name), fsC = bsC && (brand || name) ? signs.get((lkC?.text || brand || name).slice(0, 18), bsC[0], bsC[1], bsC[2]) : null, R = sourceCanopy.ring;
                    if (fsC && R?.length >= 3) {
                        // (2026-11-12 render review) one board per facing side: an L-shaped canopy (Grozăvești Petrom wraps its
                        // kiosk) has two parallel edges on one face; an edge against another building (the kiosk wall) carries
                        // none; and a face the canopy builder already signed (brandBoardFaces, its two longest walls) gets no
                        // second board: those two boards read "Petrom / Petrom". Outward normal from the ring's winding.
                        const ccwC = signedArea(R) > 0, faces = [...(sourceCanopy.brandBoardFaces || [])];
                        const edges = R.map((a, k) => { const b2 = R[(k + 1) % R.length], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1; let nx = (b2[1] - a[1]) / L, nz = -(b2[0] - a[0]) / L; if (!ccwC) { nx = -nx; nz = -nz; } return { a, b: b2, L, nx, nz }; }).sort((p, q) => q.L - p.L);
                        for (const ed of edges) {
                            if (ed.L < 4 || faces.length >= 4) continue;
                            if (faces.some(f => f.nx * ed.nx + f.nz * ed.nz > Math.cos(25 * Math.PI / 180))) continue;
                            const mx = (ed.a[0] + ed.b[0]) / 2, mz = (ed.a[1] + ed.b[1]) / 2, ob = buildingAt(mx + ed.nx * 0.6, mz + ed.nz * 0.6);
                            if (ob && ob !== sourceCanopy) continue;
                            faces.push(ed);
                            addSignQuad(cellOf(mx, mz), mx, mz, Math.atan2(ed.nx, ed.nz), 1, Math.min(ed.L * 0.6, 1.0 * fsC.aspect), 1.0, sourceCanopy.h - 0.2, fsC, 0.04);
                        }
                    }
                }
                fuelForecourt(x, z, brand || name, sourceCanopy);
                continue;
            }
            if (data.buildingGeometryPolicy === 'source') {
                poi.h = sourceCanopy?.h || 4; fuelForecourt(x, z, brand || name, null);
                fuelLog.push({ name: brand || name, x: Math.round(x), z: Math.round(z), canopy: false, sourceFootprint: false, reason: 'No reviewed mapped canopy at this source POI; canopy/pumps/pylon dimensions and fuel grades are unknown' });
                continue;
            }
            // canopy on pillars + pumps + pylon sign
            const fx = x, fz = z, pyl = { e, ne, side }; // the mapped station anchor never moves to fit decoration
            { // the forecourt (canopy 10 × 16 m + apron 14 × 22 m) must stay off every carriageway AND every building footprint
              // (2026-11-08: only its centre was tested, so the Pipera Petrom canopy cut through the station's own building):
              // if the complete footprint is unsafe at the mapped anchor, omit it instead of moving the station
                const notService = (rb) => rb.e ? rb.e.type !== 'service' : (rb.node.allEdges || rb.node.edges).some(q => q.type !== 'service'); // (the forecourt's own service lanes run under the canopy)
                const fpFreeA = (cx, cz, ang) => {
                    const fp = obbPoly({ x: cx, z: cz, hw: 7, hd: 11, angle: ang });
                    { let deck = false; surfacesAt(cx, cz, (hh) => { if (hh > Y.road + 2.5) deck = true; }); if (deck) return false; } // (never under a viaduct deck)
                    if (polyOnRibbon(fp, notService) || buildingAt(cx, cz) || fp.some(([qx, qz]) => buildingAt(qx, qz))) return false;
                    let hit = false;
                    bGrid.each(cx - 14, cz - 14, cx + 14, cz + 14, (o) => { if (hit || o.skip) return; if (o.ring.some(([qx, qz]) => pointInPolygon(qx, qz, fp)) || polysCross(o.ring, fp)) hit = true; });
                    return !hit;
                };
                if (!fpFreeA(fx, fz, roadAng)) { poi.h = 4; fuelLog.push({ name: brand || name, x: Math.round(x), z: Math.round(z), canopy: false }); continue; }
                fuelLog.push({ name: brand || name, x: Math.round(x), z: Math.round(z), canopy: true, fx: Math.round(fx), fz: Math.round(fz) });
            }
            const bs = brandStyle(brand || name) || ['#1f2937', '#ffffff', '#f97316'];
            const ca = Math.cos(roadAng), sa = Math.sin(roadAng);
            const L2W = (lx, lz) => [fx + lx * ca + lz * sa, fz - lx * sa + lz * ca];
            const canopyCol = rgb('#f3f4f6');
            treeClear.push({ x: fx, z: fz, r: 14 }); // the forecourt + shop stay clear of trees (they covered it)
            // (after round 6) canopy: a brand-coloured fascia all round with an accent stripe, a light underside
            c.solid.box(fx, 4.95, fz, 10, 0.1, 16, roadAng, canopyCol);
            c.solid.box(fx, 5.0, fz, 10.1, 0.85, 16.1, roadAng, rgb(bs[0]));
            c.solid.box(fx, 5.02, fz, 10.14, 0.12, 16.14, roadAng, rgb(bs[2] || bs[1]));
            for (const [lx, lz] of [[-3.5, -6], [3.5, -6], [-3.5, 6], [3.5, 6]]) { const [px, pz] = L2W(lx, lz); c.solid.box(px, 0.2, pz, 0.45, 4.8, 0.45, roadAng, rgb('#d1d5db')); addPropColl(px, pz, 0.35, 'fuel'); }
            for (const [lx, lz] of [[-1.6, -3.5], [1.6, -3.5], [-1.6, 3.5], [1.6, 3.5]]) { const [px, pz] = L2W(lx, lz); c.solid.box(px, 0.2, pz, 0.9, 1.7, 0.6, roadAng, rgb('#e5e7eb')); c.solid.box(px, 1.5, pz, 0.92, 0.35, 0.62, roadAng, rgb(bs[0])); addPropColl(px, pz, 0.55, 'fuel'); }
            c.ground.flatFan([L2W(-7, -11), L2W(7, -11), L2W(7, 11), L2W(-7, 11)], Y.parking + 0.003, rgb('#77787b'), 0.15);
            { // canopy fascia with the sourced brand, underside light panels and pump island kerbs
              const fs = signs.get((brand || name || 'Benzinărie').slice(0, 18), bs[0], bs[1], bs[2]);
              if (fs) for (const sd of [1, -1]) { const [qx, qz] = L2W(sd * 5.06, 0); addSignQuad(c, qx, qz, roadAng + Math.PI / 2, sd, Math.min(9, 0.75 * fs.aspect), 0.75, 5.0, fs, 0.02); }
              for (const lz of [-4.5, 0, 4.5]) for (const lx of [-2.5, 2.5]) { const [qx, qz] = L2W(lx, lz); c.solid.box(qx, 4.53, qz, 1.4, 0.03, 0.6, roadAng, rgb('#fbfbf2')); }
              for (const lx of [-1.6, 1.6]) { const [qx, qz] = L2W(lx, 0); c.solid.box(qx, 0.05, qz, 1.2, 0.18, 9.5, roadAng, rgb('#c9c6bd')); }
            }
            // pylon at the kerb (of the reference street)
            const off2 = (pyl.side > 0 ? pyl.e.wR : pyl.e.wL) + 2.5;
            const px = pyl.ne.cx + pyl.e.nx * off2 * pyl.side + pyl.e.dirx * 9, pz = pyl.ne.cz + pyl.e.nz * off2 * pyl.side + pyl.e.dirz * 9;
            if (onRibbon(px, pz, 1.4)) { poi.h = 6; poi.w = 10; poi.d = 16; continue; }
            c.solid.box(px, 0.2, pz, 0.6, 7.5, 2.4, roadAng + Math.PI / 2, rgb(bs[0]));
            const s = signs.get((brand || name || 'Fuel').slice(0, 18), bs[0], bs[1], bs[2]);
            if (s) for (const sd of [1, -1]) addSignQuad(c, px, pz, roadAng, sd, 2.3, Math.min(2.2, 2.3 / s.aspect * 2), 5.6, s, 0.32);
            { // price-board panels under the logo: fuel grades only (no invented prices)
              const g1 = signs.get(US ? 'REGULAR' : 'BENZINĂ', '#111111', '#f5f5f5', null), g2 = signs.get(US ? 'DIESEL' : 'MOTORINĂ', '#111111', '#f5f5f5', null);
              for (const sd of [1, -1]) { if (g1) addSignQuad(c, px, pz, roadAng, sd, 2.0, 0.45, 3.9, g1, 0.32); if (g2) addSignQuad(c, px, pz, roadAng, sd, 2.0, 0.45, 3.3, g2, 0.32); } }
            propColl.push({ x: px, z: pz, r: 1.4, poly: null, angle: roadAng + Math.PI / 2, hw: 0.3, hd: 1.2, h: 7, prop: true });
            poi.h = 6; poi.w = 10; poi.d = 16;
            continue;
        }
        if (kind === 'metro' && sub === 'subway_entrance') {
            if (onRibbon(x, z, 0.8)) continue;
            c.solid.box(x, 0.18, z, 0.18, 3.2, 0.18, roadAng, rgb('#4b5563')); addPropColl(x, z, 0.3, 'metro');
            const s = signs.get('M', '#1d4ed8', '#ffffff', null);
            if (s) for (const sd of [1, -1]) addSignQuad(c, x, z, roadAng, sd, 0.9, 0.9, 3.0, s, 0.11);
            c.solid.box(x, 2.95, z, 0.95, 0.95, 0.2, roadAng, rgb('#1d4ed8'));
            continue;
        }
        if (kind === 'busstop') {
            if (!poi.shelterModel.emitInferred) continue; // no guessed unit/colliders; source owners and POI remain intact
            // (owner register #2, Floreasca: "bus shelter facing wrong direction or misplaced; check public road versus path
            // alignment") the shelter took the nearest edge of any kind (a service lane, a drive); it faces the bus road: the
            // nearest public carriageway within 25 m
            const neBus = nearestEdge(x, z, f => !f.virtual && !f.tunnel && f.publicDrive !== false && f.type !== 'service', 25);
            if (neBus) { ne = neBus; e = neBus.edge; side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1; roadAng = Math.atan2(e.dirx, e.dirz); }
            // (round 3, r2-builder-ring-stops) a stop appended outside the playable edge (add-pois.mjs) stands on a scenery street, not
            // a graph edge: that street's source piece (centre line, left / right carriageway, sidewalk) stands in for the edge
            if (!neBus || neBus.d > (side > 0 ? e.wR : e.wL) + 12) { const sc = stopMarginM(x, z) <= 30 ? sceneryStopEdge(x, z, 25) : null; // (frontages across the edge street only: a stop further out is distant scenery, and its shelter pushed Grozăvești past the 1.5 M frame budget)
                if (sc) { ne = sc; e = sc.edge; side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1; roadAng = Math.atan2(e.dirx, e.dirz); } }
            const sideW = side > 0 ? e.wR : e.wL;
            if (ne.d > sideW + 12) continue;
            let off = sideW + shoulderOf(e) + Math.max(1.3, Math.min(e.sidewalk, 3) * 0.6);
            let sx = ne.cx + e.nx * off * side, sz = ne.cz + e.nz * off * side;
            const ang = roadAng; const ca = Math.cos(ang), sa = Math.sin(ang);
            { const shelterBad = () => { if (polyOnRibbon(obbPoly({ x: sx, z: sz, hw: 1.2, hd: 2.2, angle: ang }))) return true;
                    for (const [lx, lz, r] of [[-side * 0.5, -1.3, 0.75], [-side * 0.5, 0, 0.75], [-side * 0.5, 1.3, 0.75], [side * 0.3, 1.9, 0.15]]) if (onRibbon(sx + lx * ca + lz * sa, sz - lx * sa + lz * ca, r) || tramSweep?.circle(sx + lx * ca + lz * sa, sz - lx * sa + lz * ca, r, 0, 3)) return true; return false; }; // (an inferred shelter also keeps out of a tram's swept body)
              let k = 0; while (k < 8 && shelterBad()) { off += 0.6; sx = ne.cx + e.nx * off * side; sz = ne.cz + e.nz * off * side; k++; }
              if (shelterBad() || buildingAt(sx, sz)) continue; }
            const L2W = (lx, lz) => [sx + lx * ca + lz * sa, sz - lx * sa + lz * ca];
            const back = L2W(-side * 0.8, 0), v0b = c.solid.vc; // local +x points toward the road (= -normal)
            // (real STB / King County Metro shelter: ~3.4 × 1.5 m, 2.3 m roof, tinted glass on a raised frame — not a pale box)
            const glass = rgb('#6f8a99'), frame = rgb(US ? '#2f3e46' : '#3b3f45');
            // (r3-builder-4) a reviewed stop whose official panorama shows only a stop pole keeps the pole and its sign
            const poleOnly = !!STOP_POLE_ONLY[data.poiSources?.[poiIndex]];
            if (!poleOnly) {
            c.solid.box(back[0], 0.35, back[1], 0.06, 1.9, 3.2, ang, glass);
            for (const lz of [-1.6, 1.6]) { const p2 = L2W(-side * 0.8, lz); c.solid.box(p2[0], 0.2, p2[1], 0.1, 2.15, 0.1, ang, frame); const p3 = L2W(-side * 0.25, lz); c.solid.box(p3[0], 0.35, p3[1], 1.1, 1.9, 0.05, ang, glass); }
            const roofP = L2W(-side * 0.25, 0); c.solid.box(roofP[0], 2.35, roofP[1], 1.6, 0.1, 3.5, ang, frame);
            const bench = L2W(-side * 0.5, 0); c.solid.box(bench[0], 0.45, bench[1], 0.4, 0.08, 2.4, ang, rgb('#6b4a2f'));
            for (const lz of [-1.3, 0, 1.3]) { const q2 = L2W(-side * 0.5, lz); addPropColl(q2[0], q2[1], 0.75, 'busstop'); }
            }
            const pole = L2W(side * 0.3, 1.9);
            addPropColl(pole[0], pole[1], 0.15, 'busstop'); c.solid.box(pole[0], 0.2, pole[1], 0.08, 2.8, 0.08, ang, frame);
            const s = signs.get(sub.startsWith('tram') ? 'T' : 'BUS', sub.startsWith('tram') ? '#c2410c' : '#0f766e', '#ffffff', null);
            if (s) for (const sd of [1, -1]) addSignQuad(c, pole[0], pole[1], ang, sd, 0.6, 0.5, 2.5, s, 0.05);
            liftOnSide(c, v0b, null, sx, sz, 0.5);
            continue;
        }
        // businesses without a building of their own (or in a building already signed) → small pylon / board
        if (['food', 'shop', 'bank', 'pharmacy', 'hotel'].includes(kind) && bIdx < 0 && (brand || name)) {
            // (fidelity pass 2026-11-12) reality-pass districts: every mapped business names its unit, branded or not (moft,
            // Mondayz Coffee, iMZA, Cozofino, Pizzeria Due Amici were dropped as "unbranded clutter" before the fascia rule
            // below was reached, and a pylon spot inside a building dropped others): the fascia goes on the nearest building
            if (sub !== 'atm') {
                // (round 3 review, Romană Xerox node/3232228161) a POI outside every footprint with a sign anchor: the anchor
                // (its entrance node on the outline) picks the building and the span
                const near = (qx, qz, R) => { let nb = null, nd = R; bGrid.each(qx - R, qz - R, qx + R, qz + R, (o) => { if (o.skip || o.cv || o.h < 3 || (o.minH || 0) > 0.5) return; const d = pointInPolygon(qx, qz, o.ring) ? 0 : polyDist(qx, qz, o.ring); if (d < nd) { nd = d; nb = o; } }); return nb; };
                const ab = anchor ? near(anchor[0], anchor[1], 3) : null;
                if (ab) { addUnitSign(ab, anchor[0], anchor[1], brand || name, kind, poiIndex, true); continue; }
                const nb = near(x, z, brand || brandStyle(name) || kind === 'pharmacy' ? 30 : 16); // (unbranded: only a building at the point; a kiosk 20 m from any wall gets no fascia)
                if (nb) addUnitSign(nb, x, z, brand || name, kind);
                continue;
            }
            const bs = brandStyle(brand || name);
            if (!bs && kind !== 'pharmacy' && !brand) continue; // unbranded tiny places: skip the clutter
            const st = bs || [ks.bg, ks.fg, null];
            const sideW = side > 0 ? e.wR : e.wL;
            if (ne.d > sideW + 40) continue;
            const off = sideW + shoulderOf(e) + Math.max(1.5, Math.min(e.sidewalk, 4) * 0.8);
            const px = ne.cx + e.nx * off * side, pz = ne.cz + e.nz * off * side;
            if (onRibbon(px, pz, 1.2) || buildingAt(px, pz)) continue;
            const s = signs.get((brand || name).slice(0, 22), st[0], st[1], st[2]);
            if (!s) continue;
            if (sub === 'atm') { // only an explicitly mapped ATM gets a booth; a bank POI alone does not establish one
                const fx = -e.nx * side, fz = -e.nz * side, fAng = Math.atan2(-e.nx * side, -e.nz * side);
                c.solid.box(px, 0, pz, 1.0, 2.25, 0.7, fAng, rgb('#3a3f46'));
                c.solid.box(px + fx * 0.36, 0.95, pz + fz * 0.36, 0.55, 0.4, 0.04, fAng, rgb('#5d7f93'));                  // screen
                addSignQuad(c, px + fx * 0.36, pz + fz * 0.36, Math.atan2(fx, fz), 1, 0.95, Math.min(0.5, 0.95 / s.aspect), 1.95, s, 0.02);
                addPropColl(px, pz, 0.6, 'pylon'); continue;
            }
        }
    }
    return {
        P, fuelForecourts, fuelLog, roofAdList, roofAds, transitShelterAudit,
    };
}
