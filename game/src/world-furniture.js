// ============================================================================
//  T
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { reviewedLampForm } from './lamp-reviews.js';
import { PEDESTRIAN_BRIDGES } from './pedestrian-bridges.js';
import { clamp, distPointSeg, pointInPolygon } from './util.js';
import { rgb } from './geobuild.js';
import { basarabEdge } from './basarab-structure.js';
import { emitDeckLamps } from './deck-lamps.js';
import { quayBalustradeRow, emitOrnamentalQuayPanels } from './quay-balustrades.js';
import { Y, props } from './world-shared.js';

export async function buildStreetFurniture(ctx) {
    const {
        US, addPropColl, basarabStructure, buildingAt, cellOf, channelAreas, city, data,
        distId, edges, elevatedPlan, finishPendingRanges, isWater, kerbSpot, lampGrid, lampNear,
        lampSpots, lamps, liftOnSide, medianFill, nearWater, nearestEdge, onRibbon, propColl,
        raisedTop, surfacesAt, sweptOut, tramGrades, tramPropEnvelope, tramSweep, walls, yAlong,
    } = ctx;
    // a lamp stands on the surface under its own base (deck, embankment, trench floor, sidewalk or ground), never at
    // the height of its parent edge's profile while standing beside it (the floating / sunk lamps of review #19b)
    const standY = (x, z, y) => { const rt = raisedTop(x, z, 0.2); if (rt !== null) return rt; let best = 0.15, bd = Math.abs(y - 0.15); surfacesAt(x, z, (h, raised) => { const v = raised ? h : h - Y.road + 0.15, d = Math.abs(v - y); if (d < bd) { bd = d; best = v; } }); return best; }; // (a raised sidewalk wins)
    const addLamp = (l) => { if (nearWater(l.x, l.z, 1.5)) { lampsWet++; return; } l.y = standY(l.x, l.z, l.y);
        if (l.osm === false && elevatedPlan.decks && elevatedPlan.under(l.x, l.z, 2.2)) { elevatedPlan.skipped.lamps++; return; } // (the 8 m mast and its arm would stand through the deck)
        if (l.osm === false && tramPropEnvelope && tramGrades.excludesInferredObstacle([l.x, l.z], [l.x, l.z], { inferred: true, bodyEnvelope: tramPropEnvelope, radiusM: .18, y0a: l.y, y1a: l.y + l.h, kind: 'inferred-street-lamp' })) return;
        if (l.osm === false && sweptOut('street-lamp', tramSweep?.circle(l.x, l.z, .18, 0, 3))) return; // (its collider spans 0-3 m)
        lamps.push(l); lampGrid.insert(l.x, l.z, l.x, l.z, l); addPropColl(l.x, l.z, 0.18, 'lamp'); Object.assign(propColl.at(-1), { mapped: l.osm === true, inferred: l.osm === false }); };
    const osmLamps = data.lamps || [];
    let lampsWet = 0;
    let lampsMoved = 0;
    for (let i = 0; i + 2 < osmLamps.length; i += 3) {
        let x = osmLamps[i] / 10, z = osmLamps[i + 1] / 10;
        if (lampNear(x, z, 3)) continue;
        const ne = nearestEdge(x, z, null, 80);
        let hh = osmLamps[i + 2] / 10, ly = 0;
        if (ne && onRibbon(x, z, 0.4)) { // mapped in the carriageway: move to the sidewalk edge on the same side
            const e = ne.edge, side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
            const sp = kerbSpot(e, clamp(ne.t, 0, 1) * e.len, side); x = sp.x; z = sp.z; lampsMoved++;
            if (onRibbon(x, z, 0.4)) continue;
        }
        let rot = 0;
        if (ne) { rot = Math.atan2(-(ne.cz - z), ne.cx - x); ly = ne.d < ne.edge.halfW + 6 && !ne.edge.tunnel ? yAlong(ne.edge, x, z) : 0; if (!hh) hh = /^(motorway|trunk|primary|secondary)/.test(ne.edge.type) ? 8 : 5; }
        if (!hh) hh = 6;
        if (buildingAt(x, z)) continue;
        addLamp({ x, z, h: hh, rot, y: 0.15 + ly, osm: true, ...(reviewedLampForm(city.id + '-' + distId, city.proj, x, z) === 'candelabra' ? { candelabra: true } : {}) }); // (r3-look-13: lamp-reviews.js)
    }
    for (const [x, z, ang, ly, hh] of lampSpots) {
        if (lampNear(x, z, osmLamps.length > 300 ? 17 : 10) || buildingAt(x, z) || onRibbon(x, z, 0.35)) continue;
        addLamp({ x, z, h: hh, rot: ang, y: 0.15 + ly, osm: false });
    }
    // ---- Pasajul Basarab deck lamps. The generic rule above keeps no lamp on a deck (its spot is on the carriageway
    //      ribbon), so the whole structure was unlit. One arc lamp stands in the guard line about every 30 m along each
    //      guarded outer edge of the road decks: ESTIMATED positions and form (a white post curving in over the deck).
    //      None inside a tram's sweep or touching a stay, pylon, arch or roof member.
    const basarabLamps = { basis: 'MODEL: estimated arc lamps in the guard line of the Basarab road decks, about every 30 m', lamps: 0, skippedStructure: 0, skippedTram: 0 };
    if (basarabStructure.report.active) {
        const along = new Map(), members = basarabStructure.colliders.filter(c => c.minHeightAt && c.roofHeightAt), H = 9, STEP = 30;
        const touches = (x, z, y0, y1) => members.some(c => { if (Math.abs(x - c.x) > c.r + .5 || Math.abs(z - c.z) > c.r + .5 || !pointInPolygon(x, z, c.poly)) return false; const lo = c.minHeightAt(x, z, .4), hi = c.roofHeightAt(x, z, .4); return lo !== null && hi !== null && hi > y0 && lo < y1; });
        for (const w of walls) {
            if (!w.wall || w.kind !== 'rail' || !w.edge || w.tramDeckRailing || !basarabEdge(data, w.edge)) continue;
            const side = w.nx * w.edge.nx + w.nz * w.edge.nz < 0 ? 1 : -1, key = w.edge.road + '|' + side, len = Math.hypot(w.bx - w.ax, w.bz - w.az);
            let cum = along.get(key) ?? STEP * .5;
            for (let d = STEP - cum; d <= len; d += STEP) {
                const t = len ? d / len : 0, x = w.ax + (w.bx - w.ax) * t, z = w.az + (w.bz - w.az) * t, y = w.y1a + (w.y1b - w.y1a) * t - 1.1;
                if (!(y > 2) || lampNear(x, z, 14)) continue;
                if (tramSweep?.circle(x, z, .2, y, y + H) || tramGrades.excludesInferredObstacle([x, z], [x, z], { inferred: true, bodyEnvelope: tramPropEnvelope, radiusM: .18, y0a: y, y1a: y + H, kind: 'inferred-deck-lamp' })) { basarabLamps.skippedTram++; continue; }
                if ([0, 1.2, 2.5].some(o => touches(x + w.nx * o, z + w.nz * o, y + (o ? 6.5 : 1.2), y + H + .4))) { basarabLamps.skippedStructure++; continue; }
                const l = { x, z, y, h: H, rot: Math.atan2(-w.nz, w.nx), osm: false, arc: true };
                lamps.push(l); lampGrid.insert(x, z, x, z, l); basarabLamps.lamps++;
                propColl.push({ x, z, r: .18, hw: .18, hd: .18, angle: 0, poly: null, prop: true, kind: 'lamp', inferred: true, y, h: H, top: y + H, y0: y - .3, y1: y + H });
            }
            along.set(key, (cum + len) % STEP);
        }
        // (reality check, Pasajul Basarab west ramp, Street View 2026-11-11) tall curved twin-arm lamps stand on the median
        // between the carriageways: two arc lamps back to back on the filled medians, about every 30 m (form estimated)
        const twins = [];
        for (const d of medianFill.decks) {
            if (d.medianKind === 'asphalt') continue;
            const x = d.x, z = d.z, y = d.roofHeightAt(x, z), skip = r => { (basarabLamps.medianSkipped ??= {})[r] = (basarabLamps.medianSkipped[r] || 0) + 1; };
            if (!(y > .3)) { skip('low'); continue; } if (!pointInPolygon(x, z, d.poly)) { skip('outside'); continue; } if (twins.some(q => Math.hypot(q[0] - x, q[1] - z) < 28)) { skip('spacing'); continue; }
            const ne = nearestEdge(x, z, null, 20); if (!ne) { skip('no-edge'); continue; } const e = ne.edge, MH = 10;
            if (tramSweep?.circle(x, z, .25, y, y + MH) || [0, 1.5, 2.6].some(o => [1, -1].some(sg => touches(x + e.nx * o * sg, z + e.nz * o * sg, y + (o ? 7 : 1.2), y + MH + .4)))) { basarabLamps.skippedStructure++; continue; }
            // an ordinary inferred lamp standing on this median gives way (Street View: the median carries the twin-arm lamps)
            for (let i = lamps.length - 1; i >= 0; i--) { const q = lamps[i]; if (q.osm === false && !q.arc && Math.hypot(q.x - x, q.z - z) < 16 && pointInPolygon(q.x, q.z, d.poly)) { lamps.splice(i, 1); basarabLamps.medianOrdinaryReplaced = (basarabLamps.medianOrdinaryReplaced || 0) + 1; } }
            twins.push([x, z]);
            for (const sg of [1, -1]) { const l = { x, z, y, h: MH, rot: Math.atan2(-e.nz * sg, e.nx * sg), osm: false, arc: true, twin: true }; lamps.push(l); lampGrid.insert(x, z, x, z, l); }
            propColl.push({ x, z, r: .2, hw: .2, hd: .2, angle: 0, poly: null, prop: true, kind: 'lamp', inferred: true, y, h: MH, top: y + MH, y0: y - .3, y1: y + MH });
            basarabLamps.medianTwin = (basarabLamps.medianTwin || 0) + 1;
        }
    }
    // (backlog r3-structures-3) single-arm lamps on both edges of reviewed road decks (deck-lamps.js; the generic rule keeps none on a deck)
    const deckLamps = emitDeckLamps({ district: distId, edges, onRibbon, lampNear, deckY: (e, x, z) => raisedTop(x, z, 0.2) ?? 0.15 + yAlong(e, x, z),
        place: (l) => { const q = { ...l, osm: false }; lamps.push(q); lampGrid.insert(q.x, q.z, q.x, q.z, q); propColl.push({ x: q.x, z: q.z, r: .18, hw: .18, hd: .18, angle: 0, poly: null, prop: true, kind: 'lamp', inferred: true, y: q.y, h: q.h, top: q.y + q.h, y0: q.y - .3, y1: q.y + q.h }); } });
    // street furniture from OSM (benches, bins, bollards, post boxes, hydrants, …) — never on a carriageway
    let furnCount = 0;
    {
        const F = data.furniture || [], K = data.furnKinds || [];
        const metal = rgb('#4b5563'), wood = rgb('#7a5534');
        for (let i = 0; i + 2 < F.length; i += 3) {
            const kind = K[F[i]], x = F[i + 1] / 10, z = F[i + 2] / 10;
            const R = { bench: 0.9, waste_basket: 0.3, bollard: 0.15, post_box: 0.35, bicycle_parking: 0.9, drinking_water: 0.25, fountain: 1.6, fire_hydrant: 0.2, recycling: 1.0, telephone: 0.5, vending_machine: 0.5, picnic_table: 1.0, advertising: 0.7 }[kind] ?? 0.4;
            if (onRibbon(x, z, R + 0.2) || buildingAt(x, z) || nearWater(x, z, R + 1.2)) continue;
            const ne = nearestEdge(x, z, null, 40); const ang = ne ? Math.atan2(ne.edge.dirx, ne.edge.dirz) : 0;
            const c = cellOf(x, z), sb = c.solid, v0f = sb.vc;
            switch (kind) {
                case 'bench': sb.box(x, 0.4, z, 0.5, 0.08, 1.7, ang, wood); sb.box(x, 0.15, z, 0.4, 0.25, 1.5, ang, metal); propColl.push({ x, z, hw: 0.3, hd: 0.85, angle: ang, r: 0.9, poly: null, h: 1, prop: true, kind }); break;
                case 'waste_basket': sb.box(x, 0.15, z, 0.4, 0.8, 0.4, ang, US ? rgb('#2f3a2f') : rgb('#3f6f4a')); addPropColl(x, z, 0.25, 'furniture'); break;
                case 'bollard': sb.box(x, 0.15, z, 0.16, 0.9, 0.16, ang, rgb('#3a3d42')); addPropColl(x, z, 0.12, 'furniture'); break;
                case 'post_box': sb.box(x, 0.15, z, 0.5, 1.15, 0.45, ang, US ? rgb('#1f4e9b') : rgb('#e3b021')); addPropColl(x, z, 0.3, 'furniture'); break;
                case 'fire_hydrant': sb.box(x, 0.15, z, 0.26, 0.7, 0.26, ang, US ? rgb('#c9a227') : rgb('#b91c1c')); addPropColl(x, z, 0.18, 'furniture'); break;
                case 'fountain': sb.geo(props().sphere, x, 0.12, z, 0, 1.6, 0.35, 1.6, rgb('#b8b1a3')); sb.box(x, 0.12, z, 0.4, 1.6, 0.4, 0, rgb('#a49c8c')); addPropColl(x, z, 1.5, 'furniture'); break;
                case 'recycling': sb.box(x, 0.15, z, 1.2, 1.4, 1.0, ang, rgb('#2f6b3f')); propColl.push({ x, z, hw: 0.6, hd: 0.5, angle: ang, r: 0.8, poly: null, h: 1.5, prop: true, kind }); break;
                case 'telephone': case 'vending_machine': sb.box(x, 0.15, z, 0.8, 2.0, 0.7, ang, kind === 'telephone' ? rgb('#9aa3ad') : rgb('#b91c1c')); addPropColl(x, z, 0.45, 'furniture'); break;
                case 'picnic_table': sb.box(x, 0.7, z, 0.8, 0.06, 1.8, ang, wood); sb.box(x, 0.4, z, 1.6, 0.05, 1.8, ang, wood); propColl.push({ x, z, hw: 0.8, hd: 0.9, angle: ang, r: 1.2, poly: null, h: 0.8, prop: true, kind }); break;
                case 'advertising': sb.box(x, 0.12, z, 1.1, 3.0, 1.1, ang + 0.4, rgb('#d9d4c4')); sb.box(x, 3.1, z, 1.3, 0.25, 1.3, ang + 0.4, rgb('#3f3f46')); addPropColl(x, z, 0.65, 'furniture'); break;
                case 'drinking_water': sb.box(x, 0.15, z, 0.3, 1.0, 0.3, ang, metal); addPropColl(x, z, 0.2, 'furniture'); break;
                case 'bicycle_parking': for (const o of [-0.6, 0, 0.6]) { const ox = Math.cos(ang) * o, oz = -Math.sin(ang) * o; sb.box(x + ox, 0.15, z + oz, 0.06, 0.75, 0.9, ang, metal); } propColl.push({ x, z, hw: 0.8, hd: 0.5, angle: ang, r: 0.95, poly: null, h: 0.8, prop: true, kind }); break;
                default: continue;
            }
            liftOnSide(c, v0f, null, x, z); // (on a raised sidewalk)
            furnCount++;
        }
    }
    // ---- Dâmbovița channel (note 11): quay wall, service bank, lower wall into the water, parapet + railing on the quay;
    //      cut where a street / bridge crosses (the decks stay at street level over the channel)
    let channelM = 0;
    // (r3-structures-4, Grozăvești: the Regie footbridge w799487638) a footbridge at street level lands on the quay: the parapet
    // and railing stay open across its width there (its mapped line, pedestrian-bridges.js)
    const footLandings = (PEDESTRIAN_BRIDGES[`${city.id}-${distId}`] || []).filter(b => b.cls === 'arched').map(b => ({ hw: b.widthM / 2 + .4, pts: b.nodes.map(([la, lo]) => { const q = city.proj(la, lo); return [q.x, q.z]; }) }));
    const onFootLanding = (x, z) => footLandings.some(f => f.pts.some((p, i) => i > 0 && distPointSeg(x, z, f.pts[i - 1][0], f.pts[i - 1][1], p[0], p[1]).d < f.hw));
    for (const a of channelAreas) {
        const CHAN = a.chanProfile; // (shadows the model section with this polygon's own, see water-channel-review.js)
        const conc = rgb('#9c9890'), wet = rgb('#5d615a'), bankC = rgb('#86857c'), rail = rgb('#3d4246'), capC = rgb('#b3afa6');
        for (const ring of [a.outer, ...a.holes]) for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L; let nx = -uz, nz = ux; // inward (toward the water) normal
            { const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (!isWater(mx + nx * 1.5, mz + nz * 1.5)) { nx = -nx; nz = -nz; } }
            const n = Math.max(1, Math.round(L / 4));
            for (let i = 0; i < n; i++) {
                const t0 = i / n * L, t1 = (i + 1) / n * L, P = (t, o, y) => [ax + ux * t + nx * o, y, az + uz * t + nz * o];
                const mx = ax + ux * (t0 + t1) / 2, mz = az + uz * (t0 + t1) / 2;
                if (onRibbon(mx, mz, 1.0) || onRibbon(mx + nx * 3, mz + nz * 3, 0.5)) continue; // a bridge / street over the channel
                const landing = onFootLanding(mx, mz);
                if (tramGrades.excludesInferredObstacle([ax + ux * t0, az + uz * t0], [ax + ux * t1, az + uz * t1], { inferred: true, y0a: 0, y1a: 1.15, radiusM: .15, kind: 'channel-quay-inferred' })) continue;
                const sb = cellOf(mx, mz).solid, o1 = CHAN.slope, o2 = CHAN.slope + CHAN.bankW, toW = [nx, 0.4, nz];
                sb.face4(P(t0, 0, 0.02), P(t1, 0, 0.02), P(t1, o1, CHAN.bank), P(t0, o1, CHAN.bank), conc, toW);            // quay wall (battered)
                sb.face4(P(t0, o1, CHAN.bank), P(t1, o1, CHAN.bank), P(t1, o2, CHAN.bank), P(t0, o2, CHAN.bank), bankC, [0, 1, 0]); // service bank
                sb.face4(P(t0, o2, CHAN.bank), P(t1, o2, CHAN.bank), P(t1, o2, CHAN.water - 0.4), P(t0, o2, CHAN.water - 0.4), wet, [nx, 0, nz]); // lower wall, wet
                // (fidelity pass r2, Unirii (-900, 32)) the ground stopped 0.3-0.4 m short of the quay kerb: an open slot along the whole bank,
                // read from the street as a thin strip of water at pavement level. A coping strip closes it (districts only).
                sb.face4(P(t0, -1.1, 0.03), P(t1, -1.1, 0.03), P(t1, 0, 0.03), P(t0, 0, 0.03), conc, [0, 1, 0]);
                const ang = Math.atan2(ux, uz), [rx, , rz] = P((t0 + t1) / 2, -0.15, 0);
                if (landing) { channelM += t1 - t0; continue; }
                if (distId === 'unirii') {
                    // (fidelity pass, street-level look 2024: Splaiul Unirii / Splaiul Independenței at Piața Unirii) no solid
                    // parapet: a low stone kerb and a dark-green iron balustrade (posts ≈ 2 m apart, three rails, top at 1.05 m)
                    const iron = rgb('#27402f'), KH = 0.22;
                    sb.face4(P(t0, 0, 0), P(t1, 0, 0), P(t1, 0, KH), P(t0, 0, KH), capC, [nx, 0, nz]);
                    sb.face4(P(t1, -0.3, 0), P(t0, -0.3, 0), P(t0, -0.3, KH), P(t1, -0.3, KH), capC, [-nx, 0, -nz]);
                    sb.face4(P(t0, -0.3, KH), P(t1, -0.3, KH), P(t1, 0, KH), P(t0, 0, KH), conc, [0, 1, 0]);
                    if (quayBalustradeRow(distId, a.sourceId)?.style === 'ornamental-panels') emitOrnamentalQuayPanels(sb, cellOf(mx, mz).detail, P, t0, t1, KH, [nx, 0, nz], ang, L); // (r3-look-5: east basin, quay-balustrades.js)
                    else {
                    for (const [ry, rh] of [[1.0, 0.06], [0.66, 0.035], [0.34, 0.035]]) sb.box(rx, ry, rz, 0.05, rh, t1 - t0, ang, iron);
                    for (let t = t0 + 1; t < t1; t += 2) { const [px, , pz] = P(t, -0.15, 0); sb.box(px, KH, pz, 0.08, 0.86, 0.08, ang, iron); }
                    }
                } else {
                // parapet (0.75 m, 0.3 m thick) on the quay edge + a steel railing on top (posts every 2.5 m, top rail at 1.15 m)
                sb.face4(P(t0, 0, 0), P(t1, 0, 0), P(t1, 0, 0.75), P(t0, 0, 0.75), capC, [nx, 0, nz]);
                sb.face4(P(t1, -0.3, 0), P(t0, -0.3, 0), P(t0, -0.3, 0.75), P(t1, -0.3, 0.75), capC, [-nx, 0, -nz]);
                sb.face4(P(t0, -0.3, 0.75), P(t1, -0.3, 0.75), P(t1, 0, 0.75), P(t0, 0, 0.75), conc, [0, 1, 0]);
                sb.box(rx, 1.1, rz, 0.05, 0.06, t1 - t0, ang, rail); sb.box(rx, 0.9, rz, 0.03, 0.03, t1 - t0, ang, rail);
                for (let t = t0 + 1.25; t < t1; t += 2.5) { const [px, , pz] = P(t, -0.15, 0); sb.box(px, 0.75, pz, 0.05, 0.4, 0.05, ang, rail); }
                }
                channelM += t1 - t0;
            }
        }
    }
    // ---- district edge closures (spec R10.9): a GTA-style closure set on every road cut at the boundary, sized to the
    //      road (small street / boulevard / highway) and local in style (RO: DRUM ÎNCHIS / LUCRĂRI / DEVIERE, red-white
    //      barriers, cones, jersey barriers, arrow boards, an excavator or a Poliția Rutieră car; US: ROAD CLOSED type III
    //      barricades, drums, DETOUR / LOCAL TRAFFIC ONLY, a flagger, ramp closed for bridge maintenance)
    const closures = [];
    await finishPendingRanges();
    return {
        basarabLamps, channelM, closures, deckLamps, furnCount, lampsMoved, get lampsWet() { return lampsWet; },
    };
}
