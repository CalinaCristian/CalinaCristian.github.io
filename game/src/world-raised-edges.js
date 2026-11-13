// ============================================================================
//  RAISED / SUNKEN EDGES — underpass owners, Pasaj Unirii, tram halls, trench walls and the per-edge pass over raised / sunken roads (decks, parapets, piers, trench sides)
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { HALL_FURNITURE_MODEL, emitHallFurniture } from './hall-furniture.js';
import { emitTrenchBalustrade, trenchParapetRow } from './trench-parapets.js';
import { emitPasajMotifs, emitPasajPlanters, emitPasajScreen, isPasajUnirii } from './pasaj-unirii-look.js';
import { combineUnderpassWaterOwners } from './final-water-topology.js';
import { buildUnderpassOwnerIndex } from './underpass-ground-owner.js';
import { underpassRoofCollider, underpassRoofFaces, underpassRoofModel } from './underpass-roof.js';
import { clamp, pointInPolygon } from './util.js';
import { MeshBuilder, rgb } from './geobuild.js';
import { inferredBridgeFasciaUpstand } from './bridge-junction.js';
import { BoxGrid, Y } from './world-shared.js';

export async function buildRaisedEdges(ctx) {
    const {
        bigWater, cellOf, cells, city, corner, data, displace, distId,
        edges, finishDeckJobs, nodeArr, railRoadside, railRoadsideCaps, raised, ribbons, sideCol,
        str, tramGrades, tramPropEnvelope, widthSide, yAlong,
    } = ctx;
    // structures under / beside elevated and sunken roads
    const pierSpots = [], pierColl = [], underpassColl = [], underpassCollEdges = [], underpassRoofAudit = [], underpassCover = new MeshBuilder();
    for (const e of edges) e.lidded = !!e.tunnel && !e.coveredRoadModel && !e.virtual && Math.max(e.ya, e.yb) < -4.5;
    const districtCutNodes = new Set((data.district?.ends || []).map(i => nodeArr[i]).filter(Boolean)); // (R24 tunnel end walls)
    const underpassRegions = edges.filter(e => e.tunnel && !e.virtual && !e.coveredRoadModel && Math.min(e.ya, e.yb) < -4.2).map(e => {
        const width = (f, side) => widthSide(f, side) + .3, points = [1, -1].flatMap(side => [e.a, e.b].map(n => corner(e, n, side, width(e, side), width)));
        return { x0: Math.min(...points.map(p => p[0])), x1: Math.max(...points.map(p => p[0])), z0: Math.min(...points.map(p => p[1])), z1: Math.max(...points.map(p => p[1])) };
    });
    const underpassOwnerOptions = { fallbackM: -.3, regions: underpassRegions }; // exact unchanged emitted groundPlane datum
    if (underpassRegions.length) await finishDeckJobs(); // (the index reads every ground triangle: the decks first)
    const underpassGroundOwners = buildUnderpassOwnerIndex(underpassRegions.length ? [
        ...[...cells].flatMap(([key, c]) => ['area', 'grass', 'pave', 'sport', 'ground', 'road', 'pad'].map(layer => ({ mesh: c[layer], id: layer + ':' + key }))),
        { mesh: bigWater, id: 'water-big', water: true },
    ] : [], underpassOwnerOptions);
    let underpassOwners = combineUnderpassWaterOwners(underpassGroundOwners, buildUnderpassOwnerIndex(underpassRegions.length ?
        [...cells].map(([key, c]) => ({ mesh: c.water, id: 'water:' + key, water: true })) : [], underpassOwnerOptions));
    const deferredUnderpassDown = [];
    const pasajPortals = [], pasajStats = { planters: 0, motifTris: 0, headers: 0 }; // (unirii-pasaj-look: pasaj-unirii-look.js)
    // open Pasajul Unirii ramps that share one cut (the south pair, centre lines 8.4 m apart): edge → its partner and the
    // partner's offset along the edge normal. Between them stand the planters, not trench walls or an inferred barrier.
    const pasajMedian = new Map(), pasajOpen = raised.filter(e => !e.tunnel && isPasajUnirii(data.roadSourceGeometry?.[e.road]));
    for (const e of pasajOpen) for (const f of pasajOpen) { if (f === e || f.dirx * e.dirx + f.dirz * e.dirz > -0.95) continue; const off = (f.a.x - e.a.x) * e.nx + (f.a.z - e.a.z) * e.nz; if (Math.abs(off) <= 12) pasajMedian.set(e, { f, off }); }
    const pasajMedianSide = (e, o) => { const m = pasajMedian.get(e); return !!m && Math.sign(m.off) === Math.sign(o); };
    const pasajMedianBarrier = (w) => { const e = w.edge, m = e && pasajMedian.get(e); if (!m) return false; const d = (w.x - e.a.x) * e.nx + (w.z - e.a.z) * e.nz; return Math.sign(d) === Math.sign(m.off) && Math.abs(d) < Math.abs(m.off); };
    // shared underpass hall (2026-11-12 fidelity pass): roofed tram-station pieces and the deep covered carriageways beside them
    const tramHallPieces = []; let hallRoads = null; const hallFurnitureStats = { posts: 0, benches: 0, lamps: 0 }, hallLampRuns = new Set();
    const hallTramStops = (data.pois || []).filter(r => data.poiKinds?.[r[0]] === 'busstop' && str(r[5]) === 'tram_stop').map(r => [r[1] / 10, r[2] / 10]);
    const hallStopNear = (x, z) => hallTramStops.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < HALL_FURNITURE_MODEL.stopReachM);
    const sharedHallTram = (x, z, ox, oz) => { let best = null;
        for (const p of tramHallPieces) { const dx = p.b[0] - p.a[0], dz = p.b[1] - p.a[1], L2 = dx * dx + dz * dz || 1, t = ((x - p.a[0]) * dx + (z - p.a[1]) * dz) / L2; if (t < -.1 || t > 1.1) continue;
            const d = (p.a[0] + dx * t - x) * ox + (p.a[1] + dz * t - z) * oz; if (d > .5 && d < 12 && (!best || d - p.half < best.gap)) best = { gap: d - p.half }; }
        return best; };
    const sharedHallRoad = (x, z, ox, oz) => { hallRoads = hallRoads || edges.filter(e => e.tunnel && !e.virtual && !e.coveredRoadModel && Math.min(e.ya, e.yb) < -4.2);
        return hallRoads.some(e => { const t = (x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz; if (t < -1 || t > e.len + 1) return false;
            const d = (e.a.x + e.dirx * t - x) * ox + (e.a.z + e.dirz * t - z) * oz; return d > .5 && d < 12 && e.ya + (e.yb - e.ya) * clamp(t / e.len, 0, 1) < -4.2; }); };
    // (owner register #59, SeaTac: "barrier pieces read broken") where two sunken ramps part, each one's trench wall and
    // rim parapet ran on through the other's carriageway (an X of walls at the gore). A trench wall stops where its line
    // lies on another road's carriageway — not the same road's own continuation (that is the wall going on).
    const carriagewayIndex = new BoxGrid(24);
    for (const rb of ribbons) if (rb.e && !rb.e.virtual && !(rb.e.tunnel && rb.e.lidded)) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of rb.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } carriagewayIndex.insert(x0, z0, x1, z1, { rb, x0, z0, x1, z1 }); }
    // (the other road is in the cut too: a wall between a sunken ramp and a street at grade always stays)
    const otherSunkenAt = (e, x, z) => { let lo = null; carriagewayIndex.each(x, z, x, z, (q) => { if (q.rb.e === e || q.rb.e.road === e.road || x < q.x0 || x > q.x1 || z < q.z0 || z > q.z1 || !pointInPolygon(x, z, q.rb.poly)) return; const h = yAlong(q.rb.e, x, z); if (h < -0.35 && (lo === null || h < lo)) lo = h; }); return lo; };
    const onOtherCarriageway = (e, x, z) => otherSunkenAt(e, x, z) !== null;
    // Two sunken ramps side by side share one wall: the lower road's (it retains the higher one and, rising to street
    // level, guards it too). The higher road, or both when they run level, leave that side open — before, each drew its
    // own wall and parapet, a doubled, stepped pair of barriers with a gap between (#59).
    const sharedTrenchSide = (e, x, z, ox, oz, y) => { const h = otherSunkenAt(e, x + ox * 1.2, z + oz * 1.2); return h !== null && h <= y + 0.45; };
    /** parts [t0, t1] of edge e's wall line at offset o that are clear of other carriageways (1 m samples) */
    const trenchWallRuns = (e, o) => {
        const n = Math.max(2, Math.ceil(e.len)), runs = [], sg = Math.sign(o) || 1; let start = null;
        for (let i = 0; i <= n; i++) { const t = i / n, x = e.a.x + e.dirx * e.len * t + e.nx * o, z = e.a.z + e.dirz * e.len * t + e.nz * o, free = !onOtherCarriageway(e, x, z) && !sharedTrenchSide(e, x, z, e.nx * sg, e.nz * sg, e.ya + (e.yb - e.ya) * t);
            if (free && start === null) start = i === 0 ? 0 : (i - 0.5) / n; if (!free && start !== null) { runs.push([start, (i - 0.5) / n]); start = null; } }
        if (start !== null) runs.push([start, 1]);
        return runs;
    };
    const clipRuns = (runs, a, b) => runs.map(([x, y]) => [Math.max(a, x), Math.min(b, y)]).filter(([x, y]) => y - x > 1e-4);
    const trenchGoreCuts = { n: 0 }; // (a counter object)
    let WATER_API = null, preparedSmallWater = null;
    for (const e of raised) {
        const c = cellOf((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2);
        const sb = c.solid, roadsideSolidStart = sb.ic, roadsideSolidVertexStart = sb.vc;
        const conc = rgb('#a9a69e'), dark = rgb('#55524d');
        const wr = widthSide(e, 1), wl = widthSide(e, -1);
        const P = (s2, o, y) => [e.a.x + e.dirx * s2 + e.nx * o, y, e.a.z + e.dirz * s2 + e.nz * o];
        // the same at the ends, mitred with the next edge (decks, walls and lids join without gaps / overlaps at bends)
        const Pm = (end, o, y) => { const sd = o >= 0 ? 1 : -1, ex = Math.abs(o) - widthSide(e, sd); const q = corner(e, end ? e.b : e.a, sd, Math.abs(o), (f, sf) => widthSide(f, sf) + ex); return [q[0], y, q[1]]; };
        const yA = e.ya + Y.road, yB = e.yb + Y.road;
        const up = Math.max(e.ya, e.yb) > 0.3, down = Math.min(e.ya, e.yb) < (e.tunnel || e.lidded ? -0.3 : -1.0); // (register #45: a dip under 1 m is a slope, no trench walls)
        if (up && e.bridge) {
            // deck fascia + underside + piers
            // (the fascia / underside thins to nothing where the deck meets the ground: no slab through the street)
            const shared=!!e.sourceBridgeGrade?.known,topA=shared?Y.road:yA,topB=shared?Y.road:yB;
            const dA = shared?Y.road-1.1:yA - Math.min(1.1, Math.max(0.05, e.ya)), dB = shared?Y.road-1.1:yB - Math.min(1.1, Math.max(0.05, e.yb));
            for (const [o, sgn] of [[wr, 1], [-wl, -1]]) {const A=Pm(0,o,0),B=Pm(1,o,0),lip=inferredBridgeFasciaUpstand(e,[A[0],A[2]],[B[0],B[2]],{grades:tramGrades,envelope:tramPropEnvelope});sb.face4(Pm(0, o, dA), Pm(1, o, dB), Pm(1, o, topB + lip), Pm(0, o, topA + lip), conc, [e.nx * sgn, 0, e.nz * sgn]);}
            sb.face4(Pm(0, wr, dA), Pm(1, wr, dB), Pm(1, -wl, dB), Pm(0, -wl, dA), dark, [0, -1, 0]);
            // (piers: one planned pass over whole deck chains, once the tram decks and buildings exist: see BRIDGE BENTS)
            if(shared)displace(sb,roadsideSolidVertexStart,(x,z)=>yAlong(e,x,z),e,roadsideSolidStart,{});
            railRoadside.apply(sb, roadsideSolidStart, e);
            const outer = [Pm(0, wr, 0), Pm(1, wr, 0), Pm(1, -wl, 0), Pm(0, -wl, 0)].map(p => [p[0], p[2]]);
            const bottomAt = (x, z) => { const y = yAlong(e, x, z); return y + Y.road - Math.min(1.1, Math.max(.05, y)); };
            railRoadsideCaps.push(...railRoadside.caps(sb, e, outer, bottomAt, (x, z) => yAlong(e, x, z) + Y.road, conc));
        } else if (up) {
            // ramp on an embankment: retaining walls down to the ground
            const shared=!!e.sourceBridgeGrade?.known,topA=shared?Y.road:Math.max(0,yA),topB=shared?Y.road:Math.max(0,yB);
            for (const [o, sgn] of [[wr, 1], [-wl, -1]]) sb.face4(Pm(0, o, 0), Pm(1, o, 0), Pm(1, o, topB), Pm(0, o, topA), conc, [e.nx * sgn, 0, e.nz * sgn]);
            if(shared)displace(sb,roadsideSolidVertexStart,(x,z,y)=>yAlong(e,x,z)*clamp(y/Y.road,0,1),e,roadsideSolidStart,{scaleY:Y.road});
        }
        if (down) {
            const emitDown = () => {
            const source = data.roadSourceGeometry?.[e.road];
            let roof = source?.sourceId && source.tags?.tunnel && source.tags.tunnel !== 'no' ? underpassRoofModel(e, { sourceTags: source.tags }) : { known: false, reason: 'source-tunnel-context-missing' };
            const roofPoint = (t, o, y) => { const a = Pm(0, o, y), b = Pm(1, o, y); return [a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t]; };
            const roofFootprint = roof.known ? [roofPoint(roof.span[0], wr + .3, 0), roofPoint(roof.span[1], wr + .3, 0), roofPoint(roof.span[1], -wl - .3, 0), roofPoint(roof.span[0], -wl - .3, 0)].map(p => [p[0], p[2]]) : null;
            const owner = roofFootprint ? underpassOwners.forPolygon(roofFootprint) : null;
            if (owner?.known) roof = underpassRoofModel(e, { sourceTags: source?.tags || {}, topM: owner.topM });
            const roofFaces = roof.known && owner?.known ? underpassRoofFaces(roof, { pointAt: roofPoint, rightM: wr, leftM: wl,
                portals: [true, true] /* close buried slab steps too; never a street-height parapet */ }) : null;
            const closedRoof = roofFaces?.known;
            if (e.tunnel && !e.coveredRoadModel && Math.min(e.ya, e.yb) < -4.2) underpassRoofAudit.push({ edge: e, sourceId: source?.sourceId, known: !!closedRoof, reason: owner?.reason || roofFaces?.reason || roof.reason, groundOwner: owner,
                estimated: true, minClearanceM: roof.minClearanceM, legalMaxheightM: roof.legalMaxheightM, span: roof.span, topM: roof.topM, minThicknessM: roof.minThicknessM });
            if (closedRoof) {
                for (const q of roofFaces.bottom) sb.face4(...q, dark, [0, -1, 0]);
                for (const face of roofFaces.fascia) sb.face4(...face.vertices, conc, face.out);
                for (const q of roofFaces.top) underpassCover.face4(...q, conc, [0, 1, 0]);
                const collider = underpassRoofCollider(roof, roofFaces, source?.sourceId);
                if (collider) { underpassColl.push(collider); underpassCollEdges.push(e); }
            }
            // The covered wall meets its actual underside, not a floating street-
            // level strip. Uncovered ramp retaining walls keep their prior rim.
            const wallStations = closedRoof ? [...new Set([0, ...roof.stations, 1])].sort((a, b) => a - b) : [0, 1];
            const sideRuns = closedRoof ? null : new Map([[wr, trenchWallRuns(e, wr)], [-wl, trenchWallRuns(e, -wl)]]);
            if (sideRuns) for (const r of sideRuns.values()) if (r.length !== 1 || r[0][0] > 0 || r[0][1] < 1) trenchGoreCuts.n++;
            for (let k = 1; k < wallStations.length; k++) {
                const a = wallStations[k - 1], b = wallStations[k], mid = (a + b) / 2;
                const covered = closedRoof && mid >= roof.span[0] && mid <= roof.span[1];
                const top = t => covered ? roof.ceilingAt(t) : .4;
                // (fidelity pass, street-level look 2024) Pasajul Unirii: dark perforated-metal cladding on the open ramps, pale
                // mesh panels inside the covered box; every other underpass keeps the plain concrete
                const pasaj = isPasajUnirii(source), wallCol = pasaj ? rgb(covered ? '#c3c5c1' : '#4d5154') : conc;
                for (const [o, sgn] of [[wr, -1], [-wl, 1]]) for (const [a2, b2] of sideRuns && !(pasaj && pasajMedianSide(e, o)) ? clipRuns(sideRuns.get(o), a, b) : pasaj && pasajMedianSide(e, o) ? [] : [[a, b]]) {
                    const yf = t => Math.min(yA + (yB - yA) * t, 0), pm = roofPoint((a2 + b2) / 2, o, 0);
                    const hall = covered ? sharedHallTram(pm[0], pm[2], -e.nx * sgn, -e.nz * sgn) : null;
                    if (!hall) { sb.face4(roofPoint(a2, o, yf(a2)), roofPoint(b2, o, yf(b2)), roofPoint(b2, o, top(b2)), roofPoint(a2, o, top(a2)), wallCol, [e.nx * sgn, 0, e.nz * sgn]);
                        if (pasaj && !covered) pasajStats.motifTris += emitPasajMotifs(c.detail, (s2, y) => roofPoint(s2 / e.len, o + sgn * 0.02, y), a2 * e.len, b2 * e.len, s2 => yf(s2 / e.len) + 0.35, () => 0.35, [e.nx * sgn, 0, e.nz * sgn]); // (leaf / flower / butterfly motifs on the ramp cladding)
                        continue; }
                    // shared hall (2026-11-12 fidelity pass, Pasajul Victoria): a covered carriageway beside the roofed tram
                    // station is one hall in reality — a raised platform strip and a pier row instead of a wall (estimated sizes)
                    const so = Math.sign(o), o2 = o + so * Math.max(0, hall.gap), pf = .25, up = [0, 1, 0], inn = [e.nx * sgn, 0, e.nz * sgn];
                    sb.face4(roofPoint(a2, o, yf(a2)), roofPoint(b2, o, yf(b2)), roofPoint(b2, o, yf(b2) + pf), roofPoint(a2, o, yf(a2) + pf), conc, inn);
                    sb.face4(roofPoint(a2, o, yf(a2) + pf), roofPoint(b2, o, yf(b2) + pf), roofPoint(b2, o2, yf(b2) + pf), roofPoint(a2, o2, yf(a2) + pf), conc, up);
                    sb.face4(roofPoint(a2, o, top(a2)), roofPoint(b2, o, top(b2)), roofPoint(b2, o2, top(b2)), roofPoint(a2, o2, top(a2)), dark, [0, -1, 0]);
                    for (const nrm of [[-inn[0], 0, -inn[2]], inn]) sb.face4(roofPoint(a2, o2, top(a2)), roofPoint(b2, o2, top(b2)), roofPoint(b2, o2, -.02), roofPoint(a2, o2, -.02), dark, nrm); // soffit step up to the tram roof
                    if (a2 <= .5 && b2 >= .5 && hall.gap > .9) {
                        const dt = Math.min(1.3, e.len * .3) / e.len, t0 = .5 - dt, t1 = .5 + dt, p0 = o + so * .25, p1 = o + so * Math.min(hall.gap, 1.45), red = rgb('#c23a2e');
                        const q = (t, off, y) => roofPoint(t, off, y), along = [e.dirx, 0, e.dirz], back = [-e.dirx, 0, -e.dirz], out = [-inn[0], 0, -inn[2]];
                        sb.face4(q(t0, p0, yf(t0) + pf), q(t1, p0, yf(t1) + pf), q(t1, p0, top(t1)), q(t0, p0, top(t0)), conc, inn);
                        sb.face4(q(t0, p1, yf(t0) + pf), q(t1, p1, yf(t1) + pf), q(t1, p1, top(t1)), q(t0, p1, top(t0)), conc, out);
                        sb.face4(q(t0, p0, yf(t0) + pf), q(t0, p1, yf(t0) + pf), q(t0, p1, top(t0)), q(t0, p0, top(t0)), conc, back);
                        sb.face4(q(t1, p0, yf(t1) + pf), q(t1, p1, yf(t1) + pf), q(t1, p1, top(t1)), q(t1, p0, top(t1)), conc, along);
                        const pb = o + so * .22; sb.face4(q(t0, pb, yf(t0) + pf + .35), q(t1, pb, yf(t1) + pf + .35), q(t1, pb, yf(t1) + pf + .8), q(t0, pb, yf(t0) + pf + .8), red, inn); // warning band on the pier foot
                    }
                    { // (romana-1) fence between the piers, tram-stop benches / pole on the platform, sodium lamps under the soffit (hall-furniture.js)
                        const pdt = Math.min(1.3, e.len * .3) / e.len, pier = a2 <= .5 && b2 >= .5 && hall.gap > .9 ? [.5 - pdt, .5 + pdt] : null;
                        const f = emitHallFurniture({ q: (t, off, y) => roofPoint(t, off, y), floor: t => yf(t) + pf, ceil: top, a2, b2, o, so, gap: hall.gap, len: e.len, pier, inn, along: [e.dirx, 0, e.dirz],
                            face4: (...v) => sb.face4(...v), rgb, lampOffset: hallLampRuns.has(e.id + ':' + a2) ? null : (hallLampRuns.add(e.id + ':' + a2), (wr - wl) / 2), nearStop: hallStopNear }); // (lamps once per run: the first hall side drawn)
                        hallFurnitureStats.posts += f.posts; hallFurnitureStats.benches += f.benches; hallFurnitureStats.lamps += f.lamps;
                    }
                }
                if (covered && wallCol !== conc) for (const [o, sgn] of [[wr, -1], [-wl, 1]]) { // yellow accent panels ≈ every 14 m and the light line along the wall head
                    const oi = o + sgn * 0.03, fl = t => Math.min(yA + (yB - yA) * t, 0), n = [e.nx * sgn, 0, e.nz * sgn];
                    sb.face4(roofPoint(a, oi, top(a) - 0.4), roofPoint(b, oi, top(b) - 0.4), roofPoint(b, oi, top(b) - 0.22), roofPoint(a, oi, top(a) - 0.22), rgb('#f7f6ea'), n);
                    for (let s = Math.ceil(a * e.len / 14) * 14; s + 3 < b * e.len; s += 14) { const p = s / e.len, q = (s + 3) / e.len; sb.face4(roofPoint(p, oi, fl(p) + 0.5), roofPoint(q, oi, fl(q) + 0.5), roofPoint(q, oi, top(q) - 0.6), roofPoint(p, oi, top(p) - 0.6), rgb('#e3bd1c'), n); }
                }
            }
            // parapet on the trench rim where the collision wall stands above street level (to 1.0 m; play-test note 46: the
            // 1 m trench wall beside Bd. Iancu de Hunedoara was invisible from the street side) — open / uncovered part only
            if (!e.lidded) {
                const fY = (t) => e.ya + (e.yb - e.ya) * t, tAt = (y) => clamp((y - e.ya) / ((e.yb - e.ya) || 1e-6), 0, 1);
                let p0 = 0, p1 = 1;
                const cut = (thr, keepBelow) => { if (fY(0) < thr === fY(1) < thr) return (fY(0) < thr) === keepBelow; const tc = tAt(thr); if ((fY(0) < thr) === keepBelow) p1 = Math.min(p1, tc); else p0 = Math.max(p0, tc); return true; };
                if (cut(-0.35, true) && (!e.tunnel || cut(-4.2, false)) && p1 - p0 > 0.01) {
                    const Pt = (t, o, y) => P(t * e.len, o, y), cap = rgb('#b4b0a8');
                    for (const [o, sgn] of [[wr, -1], [-wl, 1]]) for (const [q0, q1] of isPasajUnirii(source) && pasajMedianSide(e, o) ? [] : sideRuns ? clipRuns(sideRuns.get(o), p0, p1) : [[p0, p1]]) {
                        const oo = o + 0.25 * -sgn;
                        if (trenchParapetRow(`${city.id}-${distId}`, e.name)) { emitTrenchBalustrade(sb, c.detail, Pt, q0, q1, o, oo, [e.nx * sgn, 0, e.nz * sgn], e.len); continue; } // (round 3: reviewed rim class, trench-parapets.js)
                        if (isPasajUnirii(source)) { emitPasajScreen(sb, c.detail, Pt, q0, q1, o, oo, [e.nx * sgn, 0, e.nz * sgn], e.len, fY); continue; } // (unirii-pasaj-look: perforated screen above the rim)
                        sb.face4(Pt(q0, o, 0.4), Pt(q1, o, 0.4), Pt(q1, o, 1.0), Pt(q0, o, 1.0), conc, [e.nx * sgn, 0, e.nz * sgn]);
                        sb.face4(Pt(q1, oo, 0), Pt(q0, oo, 0), Pt(q0, oo, 1.0), Pt(q1, oo, 1.0), conc, [-e.nx * sgn, 0, -e.nz * sgn]);
                        sb.face4(Pt(q0, oo, 1.0), Pt(q1, oo, 1.0), Pt(q1, o, 1.0), Pt(q0, o, 1.0), cap, [0, 1, 0]);
                    }
                }
            }
            if (isPasajUnirii(source) && !e.tunnel) { // (unirii-pasaj-look) planter row between the carriageways sharing this cut; portal header
                const roadAt = (s2) => e.ya + (e.yb - e.ya) * clamp(s2 / e.len, 0, 1);
                const m = pasajMedian.get(e), f = m?.f;
                if (m && f.id > e.id) { // (once per pair)
                    const h = m.off / 2, onF = (x, z) => { const t = (x - f.a.x) * f.dirx + (z - f.a.z) * f.dirz; return t > 0 && t < f.len; };
                    const mid = (s2) => [e.a.x + e.dirx * s2 + e.nx * h, e.a.z + e.dirz * s2 + e.nz * h];
                    let s0 = Infinity, s1 = -Infinity; for (let s2 = 0; s2 <= e.len; s2 += 1) if (onF(...mid(s2))) { s0 = Math.min(s0, s2); s1 = Math.max(s1, s2); }
                    if (s1 > s0) pasajStats.planters += emitPasajPlanters(sb, c.detail, mid, (s2) => roadAt(s2) + Y.road, [e.dirx, e.dirz], s0, s1);
                }
                for (const [n, other] of [[e.a, e.b], [e.b, e.a]]) {
                    const yEnd = n === e.a ? e.ya : e.yb; if (yEnd > -3 || !n.edges.some(f => f !== e && f.tunnel && isPasajUnirii(data.roadSourceGeometry?.[f.road]))) continue;
                    const L = Math.hypot(other.x - n.x, other.z - n.z) || 1, cx = (wr - wl) / 2;
                    pasajPortals.push({ x: n.x + e.nx * cx, z: n.z + e.nz * cx, fx: (other.x - n.x) / L, fz: (other.z - n.z) / L, w: wr + wl, y: yEnd + Y.road });
                }
            }
            if (!closedRoof && e.tunnel && !e.coveredRoadModel && !e.lidded && Math.min(e.ya, e.yb) < -4.2) { // (play-test note 45) partly deep tunnel edge: the
                // covered part (deeper than 4.2 m) gets its lid / ceiling and a portal where it opens (the hole in Piața Victoriei)
                const tY = (y) => clamp((y - e.ya) / ((e.yb - e.ya) || 1e-6), 0, 1), t4 = tY(-4.2);
                const [t0, t1] = e.ya < e.yb ? [0, t4] : [t4, 1];
                const Pt = (t, o, y) => P(t * e.len, o, y);
                const y0c = e.ya + (e.yb - e.ya) * t0 + Y.road + 5.2, y1c = e.ya + (e.yb - e.ya) * t1 + Y.road + 5.2;
                sb.face4(Pt(t0, wr, y0c), Pt(t1, wr, y1c), Pt(t1, -wl, y1c), Pt(t0, -wl, y0c), dark, [0, -1, 0]);
                c.ground.face4(Pt(t0, wr + 0.3, 0.06), Pt(t1, wr + 0.3, 0.06), Pt(t1, -wl - 0.3, 0.06), Pt(t0, -wl - 0.3, 0.06), sideCol, [0, 1, 0]);
                const tp = e.ya < e.yb ? t1 : t0, yp = (tp === t1 ? y1c : y0c), out = e.ya < e.yb ? 1 : -1;
                sb.face4(Pt(tp, wr + 0.5, yp), Pt(tp, -wl - 0.5, yp), Pt(tp, -wl - 0.5, 1.2), Pt(tp, wr + 0.5, 1.2), rgb('#6b6862'), [e.dirx * out, 0, e.dirz * out]);
            }
            if (!closedRoof && e.tunnel && e.lidded) { // (shallow 'tunnels' < 4.5 m deep stay open trenches: a lid would lie on the street)
                const ca = yA + 5.2, cb = yB + 5.2;
                sb.face4(Pm(0, wr, ca), Pm(1, wr, cb), Pm(1, -wl, cb), Pm(0, -wl, ca), dark, [0, -1, 0]); // ceiling
                c.ground.face4(Pm(0, wr + 0.3, 0.06), Pm(1, wr + 0.3, 0.06), Pm(1, -wl - 0.3, 0.06), Pm(0, -wl - 0.3, 0.06), sideCol, [0, 1, 0]); // lid at street level (paved, like the square above)
                // portal facade where the tunnel opens onto a non-tunnel road
                for (const n of [e.a, e.b]) {
                    if (n.edges.every(f => f === e || f.virtual || f.lidded)) continue;
                    const s2 = n === e.a ? 0 : e.len, yc = (n === e.a ? ca : cb);
                    const out = n === e.a ? -1 : 1;
                    sb.face4(P(s2, wr + 0.5, yc), P(s2, -wl - 0.5, yc), P(s2, -wl - 0.5, 1.2), P(s2, wr + 0.5, 1.2), rgb('#6b6862'), [e.dirx * out, 0, e.dirz * out]);
                }
            }
            // (R24, Pipera (-762, 178): the Promenada Mall garage aisle cut by the district edge ran out into daylight) a lidded
            // tunnel that dead-ends is closed by a concrete end wall, floor to ceiling, 1 m in (the district edge clips what
            // stands on it). Only at the district boundary cut: some source tunnels (SeaTac Air Cargo Road) are unjoined pieces.
            if (e.lidded) for (const n of [e.a, e.b]) if (districtCutNodes.has(n) && n.edges.every(f => f === e || f.virtual)) {
                const atA = n === e.a, d = Math.min(1, e.len / 2), t = atA ? d / e.len : 1 - d / e.len, s2 = t * e.len,
                    yf = yA + (yB - yA) * t, yc = closedRoof ? roof.ceilingAt(t) : yf + 5.2, out = atA ? -1 : 1;
                sb.face4(P(s2, -wl, yf - 0.1), P(s2, wr, yf - 0.1), P(s2, wr, yc), P(s2, -wl, yc), conc, [-e.dirx * out, 0, -e.dirz * out]);
            }
            };
            const sourceTunnel = data.roadSourceGeometry?.[e.road]?.tags?.tunnel;
            if (e.tunnel && sourceTunnel && sourceTunnel !== 'no') deferredUnderpassDown.push(emitDown); else emitDown();
        }
    }
    return {
        deferredUnderpassDown,
        hallFurnitureStats,
        onOtherCarriageway,
        pasajMedianBarrier,
        pasajPortals,
        pasajStats,
        pierColl,
        pierSpots,
        sharedHallRoad,
        sharedTrenchSide,
        tramHallPieces,
        trenchGoreCuts,
        underpassColl,
        underpassCollEdges,
        underpassCover,
        underpassGroundOwners,
        underpassOwnerOptions,
        underpassRoofAudit,
        get WATER_API() { return WATER_API; }, set WATER_API(v) { WATER_API = v; },
        get preparedSmallWater() { return preparedSmallWater; }, set preparedSmallWater(v) { preparedSmallWater = v; },
        get underpassOwners() { return underpassOwners; }, set underpassOwners(v) { underpassOwners = v; },
    };
}
