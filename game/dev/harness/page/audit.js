// ============================================================================
//  Static world audit (no driving): road ribbons vs props / buildings /
//  landmark boxes, vertical profile (cliffs, node mismatches, height snaps),
//  reachability of POI doors, and overlaps in the freshly spawned traffic.
//  Issues are logged through harness.issue() with scenario 'audit:<city>'.
// ============================================================================
import { ribbonHits, hitLevel } from './core.js';
import { canTravel, lanesDir, laneOff, roadName, sideW, r1, r2, edgeLocal, pointInCollider, colliderDist, colliderKind, obbPen, pointInObb, pip, sleep, surfaceFor, yAlong, vObb } from './util.js';

export async function staticAudit(H, { maxPerType = 4000 } = {}) {
    const g = H.g, W = g.world, city = H.city;
    const t0 = performance.now();
    const counts = {};
    const add = (type, sev, msg, data, key) => {
        counts[type] = (counts[type] || 0) + 1;
        if (counts[type] > maxPerType) return;
        H.issue(type, sev, msg, data, { key });
    };
    const edges = W.graph?.edges || [];
    const lamps = H.lampSet;
    const isBuilding = (k) => k === 'building' || k === 'cv-building' || k === 'landmark-box';
    // ---------------------------------------------------------------- ribbons
    let i = 0;
    for (const e of edges) {
        if (++i % 2000 === 0) await sleep(0);
        if (!W.buildings?.query) break;
        for (const h of ribbonHits(e, W, lamps)) {
            const { level, deckY } = hitLevel(e, h);
            if (h.solid) {
                add(h.kind === 'landmark-box' ? 'landmark-box-in-road' : level === 'same' ? 'building-in-road' : 'building-under-elevated-road', level === 'same' ? 'high' : 'low',
                    `${h.kind} footprint covers ${h.samples} lane sample(s) of ${roadName(e)}${level !== 'same' ? ` (road y ${r1(deckY)} m — passes over/under it)` : ''}`,
                    { x: h.x, z: h.z, edge: e.id, type: e.type, samples: h.samples, colliderX: r1(h.cx), colliderZ: r1(h.cz), deckY: r1(deckY) }, `b:${e.id}:${Math.round(h.cx)},${Math.round(h.cz)}`);
            } else if (level === 'under') {
                add('prop-under-elevated-road', h.depth > 1.2 ? 'medium' : 'low', `${h.kind} (r=${r2(h.r ?? 0)}) stands under the deck of ${roadName(e)} (deck y ${r1(deckY)} m), ${r2(h.depth)} m inside its ribbon: pokes through the deck if taller`,
                    { x: h.x, z: h.z, edge: e.id, kind: h.kind, depth: r2(h.depth), deckY: r1(deckY) }, `u:${Math.round(h.x * 2)},${Math.round(h.z * 2)}`);
            } else if (level === 'over') {
                add('prop-over-sunken-road', h.depth > 1.2 ? 'medium' : 'low', `${h.kind} (r=${r2(h.r ?? 0)}) at ground level floats over the sunken ${roadName(e)} (road y ${r1(deckY)} m), ${r2(h.depth)} m inside its ribbon`,
                    { x: h.x, z: h.z, edge: e.id, kind: h.kind, depth: r2(h.depth), deckY: r1(deckY) }, `ov:${Math.round(h.x * 2)},${Math.round(h.z * 2)}`);
            } else {
                const w = h.lat >= 0 ? sideW(e, 1) : sideW(e, -1);
                const inLane = Math.abs(h.lat) < w - 0.6;
                add(h.kind === 'lamp' ? 'lamp-in-road' : h.kind === 'tree' ? 'tree-in-road' : 'prop-in-road', inLane ? 'high' : 'medium',
                    `${h.kind} (r=${r2(h.r)}) ${inLane ? 'inside a lane' : 'on the kerb line'} of ${roadName(e)}: ${r2(h.depth)} m into the carriageway (|lat| ${r1(Math.abs(h.lat))} m, half-width ${r1(w)} m)`,
                    { x: h.x, z: h.z, edge: e.id, type: e.type, kind: h.kind, depth: r2(h.depth), lat: r2(h.lat), halfW: r1(w) }, `o:${Math.round(h.x * 2)},${Math.round(h.z * 2)}`);
            }
        }
    }
    // junction boxes: props standing in the middle of an intersection
    const nodes = new Set(); for (const e of edges) { nodes.add(e.a); nodes.add(e.b); }
    for (const n of nodes) {
        if (!n.edges || n.edges.length < 3 || !W.buildings?.query) continue;
        const R = Math.min(...n.edges.map(e => Math.min(sideW(e, 1), sideW(e, -1)))) - 0.3;
        if (R < 1.5) continue;
        const ny = n.y ?? 0;
        W.buildings.query(n.x, n.z, R + 1, (c) => {
            if (c.wall || c.ax !== undefined || c.kind === 'pier' || c.yMax !== undefined) return;
            if (Math.abs((c.y ?? c.base ?? 0) - ny) > 1.5) return;
            const k = colliderKind(c, lamps);
            if (isBuilding(k)) { if (pointInCollider(c, n.x, n.z)) add('building-in-junction', 'high', `${k} covers the centre of a ${n.edges.length}-way junction (${n.edges.map(roadName).filter((v, j, a) => a.indexOf(v) === j).join(' / ')})`, { x: n.x, z: n.z, node: n.id }, `bj:${n.id}`); return; }
            if (colliderDist(c, n.x, n.z) < R) add('prop-in-junction', 'high', `${k} inside the junction box of ${n.edges.map(roadName).filter((v, j, a) => a.indexOf(v) === j).join(' / ')}`, { x: c.x, z: c.z, node: n.id, kind: k }, `pj:${Math.round(c.x * 2)},${Math.round(c.z * 2)}`);
        });
    }
    await sleep(0);
    // ---------------------------------------------------------------- vertical profile
    let elevated = 0;
    for (const e of edges) {
        if (e.ya === undefined) continue;
        if (Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3) elevated++;
        const dy = Math.abs(e.yb - e.ya);
        if (dy > 0.05 && dy / e.len > 0.25) add('cliff-edge', dy < 0.5 ? 'low' : dy / e.len > 0.5 ? 'high' : 'medium', `${roadName(e)} climbs ${r2(dy)} m over ${r1(e.len)} m (grade ${Math.round(dy / e.len * 100)} %)`, { x: (e.a.x + e.b.x) / 2, z: (e.a.z + e.b.z) / 2, edge: e.id, ya: r2(e.ya), yb: r2(e.yb), len: r1(e.len) }, `cl:${e.id}`);
    }
    for (const n of nodes) {
        if (!n.edges || n.edges.length < 2) continue;
        let lo = Infinity, hi = -Infinity;
        for (const e of n.edges) { const y = e.a === n ? e.ya : e.yb; if (y === undefined) continue; lo = Math.min(lo, y); hi = Math.max(hi, y); }
        if (hi - lo > 0.5) add('node-height-mismatch', 'high', `edges meeting at node ${n.id} disagree on height by ${r2(hi - lo)} m`, { x: n.x, z: n.z, node: n.id, lo: r2(lo), hi: r2(hi) }, `nh:${n.id}`);
    }
    // height snaps: driving along edge e at its own height, does the car's surface resolver put it on another road?
    let snapEdges = 0, snapHow = null;
    if ((typeof W.roadHeight === 'function' || typeof g.player?.surfaceAt === 'function') && elevated) {
        const hot = edges.filter(e => e.ya !== undefined && (Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3));
        const cand = new Set();
        for (const e of hot) { cand.add(e); for (const o of g.nav.index.near((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2, e.len / 2 + 25, [])) cand.add(o); }
        let k = 0; const P = g.player;
        for (const e of cand) {
            if (e.ya === undefined) continue;
            if (++k % 300 === 0) await sleep(0);
            let bad = 0, worst = 0, at = null;
            for (const dir of [1, -1]) {
                if (!canTravel(e, dir)) continue;
                const lat = laneOff(e, 0, dir) * dir;
                for (let s = 2; s < e.len - 2; s += 4) {
                    const x = e.a.x + e.dirx * s + e.nx * lat, z = e.a.z + e.dirz * s + e.nz * lat;
                    const want = 0.24 + yAlong(e, x, z);
                    const got = surfaceFor(P, W, x, z, want, e); snapHow = got.how;
                    const d = Math.abs(want - got.h);
                    if (d > 1.0) { bad++; if (d > worst) { worst = d; at = { x, z, want, got: got.h, edge: got.edge }; } }
                }
            }
            if (bad) {
                snapEdges++;
                const other = at.edge || W.nearestEdge?.(at.x, at.z, null, 40)?.edge;
                add('height-snap', 'high', `driving on ${roadName(e)} (y=${r2(at.want)}) the car would be put at y=${r2(at.got)}${other ? ' (height of ' + roadName(other) + ')' : ''}: ${bad} sample(s), up to ${r2(worst)} m [${snapHow}]`, { x: at.x, z: at.z, edge: e.id, other: other?.id, worst: r2(worst), samples: bad, bridge: !!e.bridge, layer: e.layer | 0 }, `hs:${e.id}`);
            }
        }
    }
    await sleep(0);
    // ---------------------------------------------------------------- POI doors
    const main = (e) => e.main !== false && (canTravel(e, 1) || canTravel(e, -1));
    const doorCheck = (label, x, z, reach, sev = 'high') => {
        if (x === undefined || z === undefined) { add('poi-door', sev, `${label}: no door position`, { x: 0, z: 0 }, `door:${label}`); return; }
        let best = Infinity, be = null;
        for (const e of g.nav.index.near(x, z, Math.max(60, reach + 30), [])) {
            if (!main(e)) continue;
            const L = edgeLocal(e, x, z); const s = Math.max(0, Math.min(e.len, L.s));
            const cx = e.a.x + e.dirx * s, cz = e.a.z + e.dirz * s;
            const d = Math.hypot(x - cx, z - cz), side = L.lat >= 0 ? 1 : -1;
            const reachD = Math.max(0, d - sideW(e, side) + 1.2); // car pulled up to the kerb on that side
            if (reachD < best) { best = reachD; be = e; }
        }
        if (best > reach) add('poi-door-unreachable', sev, `${label}: door is ${r1(best)} m from the nearest routable lane (interaction radius ${reach} m)`, { x, z, best: r1(best), edge: be?.id, street: be ? roadName(be) : null }, `door:${label}`);
        // inside a building? (the door must be outside a footprint or on its outline)
        let inside = null; W.buildings?.query?.(x, z, 1, (c) => { if (!inside && c.poly && pip(x, z, c.poly) && colliderDist(c, x, z) < -2) inside = c; });
        if (inside) add('poi-door-in-building', 'medium', `${label}: door point is ${r1(-colliderDist(inside, x, z))} m inside a building footprint`, { x, z }, `doorin:${label}`);
        // route from the spawn
        const sp = W.spawn || { x: g.player.x, z: g.player.z };
        let r = null; try { r = g.nav.compute(sp.x, sp.z, x, z, sp.heading ?? null); } catch { /* ignore */ }
        if (!r) add('route-failure', 'high', `no route from the spawn to ${label}`, { x, z }, `rt:${label}`);
    };
    for (const sp of g.stopPois || []) doorCheck(`stop ${sp.stop.id} (${sp.stop.company || sp.stop.short})`, sp.poi.doorX ?? sp.poi.x, sp.poi.doorZ ?? sp.poi.z, 11);
    for (const s of g.stops || []) if (!s.poiRef) add('poi-missing', 'high', `stop ${s.id} has no world POI '${s.poi}'`, { x: 0, z: 0 }, `pm:${s.id}`);
    if (g.airport) doorCheck('airport', g.airport.doorX ?? g.airport.x, g.airport.doorZ ?? g.airport.z, 90);
    else add('poi-missing', 'high', 'no airport POI', { x: 0, z: 0 }, 'pm:airport');
    for (const st of g.stations || []) doorCheck(`fuel ${st.brand}`, st.x, st.z, 12, 'medium');
    await sleep(0);
    // ---------------------------------------------------------------- spawned traffic
    const T = g.traffic, vs = T?.vehicles || [];
    let vo = 0;
    for (let a = 0; a < vs.length; a++) for (let b = a + 1; b < vs.length; b++) {
        const v = vs[a], o = vs[b];
        if (Math.abs(v.x - o.x) > 10 || Math.abs(v.z - o.z) > 10 || (v.layer ?? 0) !== (o.layer ?? 0)) continue;
        const pen = obbPen(vObb(v), vObb(o)); if (pen > 0.25) { vo++; add('spawn-vehicle-overlap', 'medium', `${v.kind} ${v.id}${v.parked ? ' (parked)' : ''} spawned overlapping ${o.kind} ${o.id}${o.parked ? ' (parked)' : ''} by ${r2(pen)} m`, { x: v.x, z: v.z }, `svo:${v.id}:${o.id}`); }
    }
    for (const v of vs) {
        if (!W.buildings?.query) break;
        let hit = null;
        for (const f of [v.length * 0.35, 0, -v.length * 0.35]) {
            const x = v.x + v.fx * f, z = v.z + v.fz * f;
            W.buildings.query(x, z, 2, (c) => { if (hit || c.wall || c.ax !== undefined) return; if (c.yMax !== undefined ? (v.y ?? 0.24) > c.yMax : Math.abs((c.y ?? c.base ?? 0) - ((v.y ?? 0.24) - 0.24)) > 1.5) return; if (colliderDist(c, x, z) < (c.poly ? -0.2 : 0.5)) hit = c; });
        }
        if (hit) add('spawn-vehicle-in-object', v.parked ? 'low' : 'medium', `${v.kind} ${v.id}${v.parked ? ' (parked)' : ''} spawned inside/through a ${colliderKind(hit, lamps)} on ${v.edge ? roadName(v.edge) : '?'}`, { x: v.x, z: v.z, kind: colliderKind(hit, lamps) }, `svb:${v.id}`);
    }
    for (const p of T?.peds?.list || []) {
        for (const v of vs) if (Math.abs(v.x - p.x) < 4 && Math.abs(v.z - p.z) < 4 && pointInObb(vObb(v), p.x, p.z, 0.1)) { add('spawn-ped-in-vehicle', 'medium', `pedestrian ${p.i} spawned inside ${v.kind} ${v.id}`, { x: p.x, z: p.z }, `spv:${p.i}`); break; }
        let inB = false; W.buildings?.query?.(p.x, p.z, 0.5, (c) => { if (!inB && c.poly && pip(p.x, p.z, c.poly) && colliderDist(c, p.x, p.z) < -0.5) inB = true; });
        if (inB) add('spawn-ped-in-building', 'low', `pedestrian ${p.i} (${p.state}) spawned inside a building footprint`, { x: p.x, z: p.z }, `spb:${p.i}`);
    }
    // player spawn
    const P = g.player;
    const ne = g.nav.index.nearest(P.x, P.z, 100);
    if (!ne || ne.d > (ne.edge.halfW ?? 6)) add('spawn-player', 'high', `player spawn is ${ne ? r1(ne.d) : '?'} m from the nearest road centreline`, { x: P.x, z: P.z }, 'spawn-off');
    let inC = null; W.buildings?.query?.(P.x, P.z, 3, (c) => { if (!inC && colliderDist(c, P.x, P.z) < 0.9) inC = c; });
    if (inC) add('spawn-player', 'high', `player spawn touches a ${colliderKind(inC, lamps)}`, { x: P.x, z: P.z }, 'spawn-coll');
    // ---------------------------------------------------------------- the world's own self-checks (shape-agnostic)
    const selfCheck = {};
    const SEV_SELF = { props: 'high', buildings: 'high', walls: 'high', lamps: 'high', cliffs: 'high', doors: 'high', blocked: 'high', deadEnds: 'low' };
    const ingest = (name, res) => {
        if (!res || typeof res !== 'object') return;
        selfCheck[name] = { counts: res.counts || null, ok: res.ok, blocked: res.blocked, deadEnds: res.deadEnds };
        const groups = { ...res, ...(res.samples || {}) };
        for (const [k, arr] of Object.entries(groups)) {
            if (!Array.isArray(arr)) continue;
            for (const it of arr) {
                if (!it || it.x === undefined || it.z === undefined) continue;
                const what = Object.entries(it).filter(([kk]) => kk !== 'x' && kk !== 'z').map(([kk, vv]) => `${kk}=${typeof vv === 'object' ? JSON.stringify(vv) : vv}`).join(', ');
                add(`${name}:${k}`, SEV_SELF[k] || 'medium', `${name}() ${k}: ${what}`, { ...it, x: it.x, z: it.z }, `${name}:${k}:${it.x},${it.z}`);
            }
        }
    };
    try { if (typeof W.audit === 'function') ingest('world.audit', W.audit({ max: 400 })); } catch (e) { add('harness-api', 'low', 'world.audit threw: ' + e.message, { x: 0, z: 0 }, 'waudit'); }
    try { if (typeof W.devCheck === 'function') ingest('world.devCheck', W.devCheck()); } catch (e) { add('harness-api', 'low', 'world.devCheck threw: ' + e.message, { x: 0, z: 0 }, 'devcheck'); }
    return { city, ms: Math.round(performance.now() - t0), edges: edges.length, nodes: nodes.size, colliders: W.buildings?.length, lamps: W.lamps?.length, elevatedEdges: elevated, snapEdges, snapResolver: snapHow, vehicles: vs.length, peds: T?.peds?.list?.length, counts, selfCheck, nav: g.nav?.mainStats || null };
}
