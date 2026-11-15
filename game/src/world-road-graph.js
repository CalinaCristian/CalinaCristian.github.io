// ============================================================================
//  WORLD ROAD GRAPH — edge lookups, connectivity, lane tapers, tram refinement, level-solver crossings
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { clamp, distPointSeg, pointInPolygon } from './util.js';
import { TRAM_BRIDGE_MODELS } from './tram-grade-models.js';
import { buildCoveredRoadModels } from './covered-road-models.js';
import { BoxGrid, undelta } from './world-shared.js';
import { layContraflowLanes, motorOneway } from './contraflow-bus.js';

export function buildRoadGraphAids(ctx) {
    const {
        EG, data, edgeGrid, edges, nodeArr, str,
    } = ctx;
 // (surfacesAt's flat copy of these cells, made at its first query: surfCellsOf)
    const nearestEdge = (x, z, filter = null, maxR = 3000) => {
        const ix = Math.floor(x / EG), iz = Math.floor(z / EG);
        let best = null, bd = Infinity, bt = 0, bcx = 0, bcz = 0;
        const K = Math.ceil(maxR / EG);
        for (let k = 0; k <= K; k++) {
            for (let i = ix - k; i <= ix + k; i++) for (let j = iz - k; j <= iz + k; j++) {
                if (Math.max(Math.abs(i - ix), Math.abs(j - iz)) !== k) continue;
                const arr = edgeGrid.cell_(i, j); if (!arr) continue;
                for (const e of arr) {
                    if (filter && !filter(e)) continue;
                    const r = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
                    if (r.d < bd) { bd = r.d; best = e; bt = r.t; bcx = r.cx; bcz = r.cz; }
                }
            }
            if (best && bd <= k * EG) break;
        }
        return best ? { edge: best, d: bd, t: bt, cx: bcx, cz: bcz } : null;
    };
    // (spec 10 load budget) a box within one grid cell whose list holds no edge twice (an edge is listed twice in a cell only
    // when two of its cells share a hash key) visits that list as it is: the duplicate check could drop nothing there
    const cellListRepeats = new Map();
    const edgesInBox = (x0, z0, x1, z1, cb) => {
        const i0 = Math.floor(x0 / EG), j0 = Math.floor(z0 / EG);
        if (i0 === Math.floor(x1 / EG) && j0 === Math.floor(z1 / EG)) {
            const key = edgeGrid.k(i0, j0), list = edgeGrid.map.get(key); if (!list) return;
            let repeats = cellListRepeats.get(key); if (repeats === undefined) cellListRepeats.set(key, repeats = new Set(list).size !== list.length);
            if (!repeats) { for (const e of list) cb(e); return; }
        }
        const seen = new Set(); edgeGrid.each(x0, z0, x1, z1, (e) => { if (!seen.has(e)) { seen.add(e); cb(e); } });
    };

    // ---- strongly connected components (one-way aware): only the main SCC is drivable / routable
    let sccInfo;
    // district maps: roads cut at the boundary (map ends) all lead to / come from "the rest of the city", so for
    // connectivity they are joined through one virtual outside node (a one-way street entering the map is not a trap)
    for (const i of data.district?.ends || []) if (nodeArr[i]) nodeArr[i].mapEnd = true;
    const computeSCC = () => {
        const N = nodeArr.length + 1, OUT = nodeArr.length;
        const out = Array.from({ length: N }, () => []), inn = Array.from({ length: N }, () => []);
        for (const e of edges) { if (e.publicDrive === false) continue; out[e.a.id].push(e.b.id); inn[e.b.id].push(e.a.id); if (!motorOneway(e)) { out[e.b.id].push(e.a.id); inn[e.a.id].push(e.b.id); } }
        for (const n of nodeArr) if (n.mapEnd && n.edges.some(e => e.publicDrive !== false)) { out[n.id].push(OUT); inn[OUT].push(n.id); out[OUT].push(n.id); inn[n.id].push(OUT); }
        // Kosaraju (iterative)
        const order = [], seen = new Uint8Array(N);
        for (let s0 = 0; s0 < N; s0++) {
            if (seen[s0] || (s0 < OUT && !nodeArr[s0].edges.length) || (s0 === OUT && !out[OUT].length)) continue;
            const stack = [[s0, 0]]; seen[s0] = 1;
            while (stack.length) {
                const top = stack[stack.length - 1]; const [u, k] = top;
                if (k < out[u].length) { top[1]++; const v = out[u][k]; if (!seen[v]) { seen[v] = 1; stack.push([v, 0]); } }
                else { order.push(u); stack.pop(); }
            }
        }
        const comp = new Int32Array(N).fill(-1); let nc = 0; const sizes = [];
        for (let i = order.length - 1; i >= 0; i--) {
            const s0 = order[i]; if (comp[s0] >= 0) continue;
            const st = [s0]; comp[s0] = nc; let sz = 0;
            while (st.length) { const u = st.pop(); sz++; for (const v of inn[u]) if (comp[v] < 0) { comp[v] = nc; st.push(v); } }
            sizes.push(sz); nc++;
        }
        let main = 0; for (let c = 1; c < nc; c++) if (sizes[c] > sizes[main]) main = c;
        let off = 0;
        for (const n of nodeArr) { n.comp = comp[n.id]; n.drivable = comp[n.id] === main; }
        for (const e of edges) { e.drivable = e.publicDrive !== false && e.a.drivable && e.b.drivable; if (!e.drivable) off++; }
        // weakly connected components (for the report)
        const par = new Int32Array(N).map((_, i) => i); const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
        for (const e of edges) par[f(e.a.id)] = f(e.b.id);
        const wcc = new Set(); for (const n of nodeArr) if (n.edges.length) wcc.add(f(n.id));
        sccInfo = { scc: nc, mainNodes: sizes[main], nodesOutside: nodeArr.filter(n => n.edges.length && !n.drivable).length, edgesOff: off, weakComponents: wcc.size };
    };
    computeSCC();
    // one-way streets around the CV stops that are traps (not in the main network) become two-way,
    // so every stop's own street is reachable (e.g. Str. Vasile Alecsandri at UiPath HQ)

    // (2026-11-08, owner: "markings seem wrong here", Calea Floreasca) OSM changes a one-way street's lane count every few
    // dozen metres (3, 4, 3, 3, 4 …) and every segment was centred on the way: at each change both kerbs and every lane line
    // jumped 1.75 m sideways. District worlds: along a named one-way chain the left kerb stays where the narrowest
    // neighbouring segment puts it and the extra lanes widen the right side (a turn bay); lane i keeps its position
    // (traffic lanes are counted from the left: median/2 + laneW·(i + ½)).
    {
        let aligned = 0;
        // (a one-way with a contraflow bus lane counts all its lanes across; its bus lane stays along the left kerb)
        const across = (f) => f.contraflowBus ? f.contraflowTotal : f.lanesF;
        const nextOf = (e) => e.b.edges.filter(f => f !== e && f.a === e.b && motorOneway(f) && !f.virtual && f.name === e.name);
        const prevOf = (e) => e.a.edges.filter(f => f !== e && f.b === e.a && motorOneway(f) && !f.virtual && f.name === e.name);
        for (const e of edges) {
            if (!motorOneway(e) || e.virtual || !e.name || e.madeTwoWay || e.roadWidthSource?.leftM != null) continue;
            let base = across(e), f = e;
            for (let k = 0; k < 4; k++) { const n2 = prevOf(f); if (n2.length !== 1) break; f = n2[0]; base = Math.min(base, across(f)); }
            f = e; for (let k = 0; k < 4; k++) { const n2 = nextOf(f); if (n2.length !== 1) break; f = n2[0]; base = Math.min(base, across(f)); }
            if (base >= across(e) || Math.abs(e.laneW * across(e) - (e.wL + e.wR)) > 0.05) continue;
            e.wL = base * e.laneW / 2; e.wR = across(e) * e.laneW - e.wL; if (e.contraflowBus) layContraflowLanes(e); else e.median = -2 * e.wL; e.halfW = Math.max(e.wL, e.wR); aligned++;
        }
        if (aligned) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5; sccInfo.laneAligned = aligned; }
    }
    // (owner, 2026-11-12, Grozavesti (69, 19): "the road looks wrong here -- lane collapse suddenly"; OSM w665896755 lanes=2,
    // turn:lanes=merge_to_right|, then w665896756 lanes=1; Street View at 44.44100, 26.06002: two lanes, a merge arrow in the
    // lane that ends, then a taper of some 30-40 m into one lane) where a one-way street drops a lane at a plain node, the
    // carriageway stepped from two lanes to one there: half the step on the last edge before the node, half on the first
    // after it, with the edge line and the sidewalk left on the nominal line. A MAPPED merge (turn:lanes merge_to_*) now
    // keeps its full width to the node, where the lane line ends, and the outer edge closes in evenly over the edges that
    // follow, up to the first node at least 25 m on. e.taperR = [extra right-side width at a, at b]; corner() carries it
    // into every strip built from corners (asphalt, kerb, sidewalk). EXCEPTION to the source: the game keeps the left
    // kerb and ends the right-hand lane whichever lane the tag names (lanes are counted from the left).
    const laneTapers = [], sideExtra = (e, side, along) => side > 0 && e.taperR ? e.taperR[0] + (e.taperR[1] - e.taperR[0]) * clamp(along / e.len, 0, 1) : 0;
    {
        const tl = data.turnLanes || [], merges = new Set(); for (let i = 0; i + 2 < tl.length; i += 3) if (/merge_to_/.test(str(tl[i + 1]))) merges.add(tl[i]);
        const plain = e => e.oneway && !e.virtual && !e.bridge && !e.tunnel && !e.madeTwoWay && !e.roadWidthSource;
        for (const e of edges) {
            if (!plain(e) || !merges.has(e.road)) continue;
            const N = e.b, out = N.edges.filter(f => !f.virtual); if (out.length !== 2) continue;
            const f = out.find(g => g !== e); if (!f || f.a !== N || !plain(f) || f.lanesF !== e.lanesF - 1 || Math.abs(f.wL - e.wL) > .05) continue;
            const D = e.wR - f.wR; if (!(D > 1.5 && D < 5)) continue;
            const chain = []; let cur = f, total = 0;
            for (;;) {
                chain.push(cur); total += cur.len; if (total >= 25) break;
                const next = cur.b.edges.filter(g => !g.virtual); if (next.length !== 2) break;
                const g = next.find(h => h !== cur); if (!g || g.a !== cur.b || !plain(g) || g.lanesF !== f.lanesF || Math.abs(g.wR - f.wR) > .05 || Math.abs(g.wL - f.wL) > .05) break;
                cur = g;
            }
            if (total < 12 || total > 90) continue; // (too short to read as a taper; or one long edge with nowhere to end it)
            let at = 0; for (const g of chain) { g.taperR = [D * (1 - at / total), D * (1 - (at + g.len) / total)]; at += g.len; }
            laneTapers.push({ from: e, node: N, lengthM: total, widthM: D, edges: chain.length });
        }
        if (laneTapers.length) sccInfo.laneTapers = laneTapers.map(t => ({ at: [Math.round(t.node.x), Math.round(t.node.z)], lengthM: Math.round(t.lengthM), widthM: t.widthM, edges: t.edges, sourceId: data.roadSourceGeometry?.[t.from.road]?.sourceId }));
    }

    // refine tram flag per edge using the actual tram geometry
    const trams = data.trams.map(t => undelta(t, 0));
    {
        const tg = new BoxGrid(40);
        for (const pl of trams) for (let i = 0; i < pl.length - 1; i++) { const a = pl[i], b = pl[i + 1]; tg.insert(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), [a, b]); }
        for (const e of edges) {
            if (!e.tram) continue;
            const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
            let d = Infinity; tg.each(mx - 10, mz - 10, mx + 10, mz + 10, ([a, b]) => { d = Math.min(d, distPointSeg(mx, mz, a[0], a[1], b[0], b[1]).d); });
            // (owner, 2026-11-11, Grozavesti (863, -1109): "the tram path is still going on the street") on a bridge the trams
            // run on their own slab beside the carriageway (Pasajul Basarab: 5-7 m from a 3.5 m half width); rails are drawn
            // into a deck carriageway only where the tram line lies within its asphalt. At grade the mapping tolerance stays.
            e.tram = d < e.halfW + (e.bridge ? 0.5 : 4);
        }
        // (owner, 2026-11-11, Grozavesti: "the tram path is still going on the street") on the Basarab deck a tram line runs
        // 3-5 m from the mapped centre line of a carriageway drawn 3.5 m to each side, so the asphalt reached over the tracks.
        // The mapped line and the far edge stay; on a bridge carriageway the tram-facing side is narrowed to keep 2.2 m clear
        // of the track (at least 1.75 m) and the lanes share the narrower width (widening the far side pushed the deck into
        // neighbouring ramps).
        // (owner, 2026-11-12, Grozavesti: "fences are not continuous on the bridge still in many places") the nearest tram line
        // can be a street tram crossing below: at the Grozăvești end (335..386, -708..-739) one 0-1 m from the deck's centre
        // line hid the deck tram 3.6-4.5 m beside it, so the wrong side was narrowed or none, the asphalt reached over the deck
        // track and 60 m of railing between them was left out. Where an elevated tram line (a reviewed elevated way of
        // TRAM_BRIDGE_MODELS with its ramps, or one tagged bridge / layer > 0) runs beside the deck, it decides the side
        // (the narrower width when both agree); elsewhere the nearest line, as before.
        const elevatedWays = new Set(TRAM_BRIDGE_MODELS.flatMap(m => [...(m.bridgeWays || []), ...(m.paths || []).flatMap(p => p.ways.map(w => w[0]))]));
        const tgUp = new BoxGrid(40);
        trams.forEach((pl, i) => { const src = data.tramSources?.[i], t = src?.tags || {}; if (!src || (!elevatedWays.has(src.sourceId) && !(t.bridge && t.bridge !== 'no') && !(+t.layer > 0))) return; for (let k = 0; k < pl.length - 1; k++) { const a = pl[k], b = pl[k + 1]; tgUp.insert(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), [a, b]); } });
        let tramShifted = 0;
        for (const e of edges) {
            if (e.virtual || !e.bridge || !e.oneway) continue;
            const nearestOf = grid => { let d = Infinity, sgn = 0; for (const f of [0.1, 0.5, 0.9]) { const x = e.a.x + (e.b.x - e.a.x) * f, z = e.a.z + (e.b.z - e.a.z) * f;
                grid.each(x - 10, z - 10, x + 10, z + 10, ([a, b]) => { const q = distPointSeg(x, z, a[0], a[1], b[0], b[1]); if (q.d < d) { d = q.d; sgn = Math.sign((q.cx - x) * e.nx + (q.cz - z) * e.nz) || 1; } }); } return { d, sgn }; };
            const want = ({ d, sgn }) => !(d < e.halfW + 2.2) || d < 1.2 ? null : { near: sgn > 0 ? 'wR' : 'wL', nw: Math.max(1.75, d - 2.2) };
            const up = want(nearestOf(tgUp)), any = want(nearestOf(tg)), pick = up ? (any && any.near === up.near ? { near: up.near, nw: Math.min(up.nw, any.nw) } : up) : any;
            if (!pick) continue;
            const { near, nw } = pick, far = near === 'wR' ? 'wL' : 'wR', total = e.wL + e.wR;
            if (nw >= e[near] - 0.05) continue;
            e[near] = nw; e.laneW = (e.wL + e.wR) / Math.max(1, e.lanesF + e.lanesB); if (!e.roadWidthSource) e.median = -2 * e.wL; e.halfW = Math.max(e.wL, e.wR); e.tramClearShift = true; // (owner, 2026-11-12, Grozavesti (931, -1147), (603, -877): the lanes kept starting at the old left edge, so the outer lane ran onto the tram slab / into the railing; one-way lanes start at the narrowed edge) e.tram = false; tramShifted++; void far; void total;
        }
        if (tramShifted) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5; sccInfo.tramClearShift = tramShifted; }
        // (owner register #50 Romana: "building intersects street", #22 / #35 Unirii, L8) the default width of a street can be wider than
        // the space between real OSM footprints (Strada Caderea Bastiliei: 1.3 m into a building). The footprint is the source; a
        // street side that runs into ground-level footprints along more than a quarter of its length narrows to 0.3 m off the wall,
        // never below 2.6 m per lane on that side. Bridges, tunnels and edges without a building beside them are unchanged.
        {
            const BO = (data.version || 1) >= 2 ? 9 : 6, fps = [], fg = new BoxGrid(24);
            for (const [i, b] of (data.buildings || []).entries()) {
                const minH = data.buildingDimensions?.[i]?.[1] ?? b[2] / 10; if (minH > 2.5) continue; // (an overhang or a passage over the street)
                const ring = data.buildingFootprints?.[i] || undelta(b, BO); if (!ring || ring.length < 3) continue;
                const xs = ring.map(q => q[0]), zs = ring.map(q => q[1]); fg.insert(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), ring); fps.push(ring);
            }
            const inFp = (x, z) => { let hit = false; fg.each(x, z, x, z, r => { if (!hit && pointInPolygon(x, z, r)) hit = true; }); return hit; };
            let narrowed = 0;
            for (const e of edges) {
                if (e.virtual || e.bridge || e.tunnel || e.len < 4) continue;
                const span = motorOneway(e), lanesSide = sd => span ? Math.max(1, e.lanesF + e.lanesB) : Math.max(1, sd > 0 ? e.lanesF : e.lanesB); let changed = false;
                for (const sd of [1, -1]) {
                    const key = sd > 0 ? 'wR' : 'wL', w = e[key]; let n = 0, hits = 0, need = w;
                    for (let st = 1; st < e.len - 1; st += 1.5) {
                        n++; const x0 = e.a.x + e.dirx * st, z0 = e.a.z + e.dirz * st;
                        if (!inFp(x0 + e.nx * sd * w, z0 + e.nz * sd * w)) continue;
                        if (inFp(x0, z0)) continue; // (the centre line itself inside a footprint there: a covered way, not a width question)
                        hits++; let lo = 0, hi = w; for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (inFp(x0 + e.nx * sd * m, z0 + e.nz * sd * m)) hi = m; else lo = m; }
                        need = Math.min(need, lo);
                    }
                    if (hits < 0 || !n || (hits / n < .25 && hits * 1.5 < 3)) continue; // (a quarter of the side, or 3 m of it)
                    const other = sd > 0 ? e.wL : e.wR, minSide = span ? Math.max(1.3, 2.6 * lanesSide(sd) - other) : 2.6 * lanesSide(sd); // (one-way lanes span both sides)
                    const nw = Math.max(minSide, need - .3);
                    if (nw < w - .15) { e[key] = nw; narrowed++; changed = true; }
                }
                if (changed) { e.laneW = Math.min(e.laneW, (e.wL + e.wR) / Math.max(1, e.lanesF + e.lanesB)); if (e.oneway && !e.roadWidthSource) e.median = -2 * e.wL; layContraflowLanes(e); e.halfW = Math.max(e.wL, e.wR); e.footprintNarrowed = true; }
            }
            if (narrowed) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5; sccInfo.footprintNarrowed = narrowed; }
        }
    }

    // ---- vertical profile. Only real grade separations are lifted / lowered:
    //      * a bridge is raised only where it actually passes over (crosses or is stacked above) another road
    //        that does not share a junction with it — river / rail bridges stay at grade (OSM tags them layer=1,
    //        which used to lift them 6 m and drag the riverside roads up with them: the "slab" across Splaiul
    //        Independenței at Grozăvești);
    //      * tunnels are lowered (−6 m per layer);
    //      * the roads they pass over / under are pinned at their own level;
    //      * ramps are the "max of cones" around the anchors, along the connected graph (9 % grade on the
    //        approaches, ~3 % along bridge decks so viaducts stay up between the roads they cross).
    //      node.y / edge.ya / edge.yb are the vertical displacement of the road surface (asphalt top = 0.24 + y).
    const CLEAR = 6, GRADE = 0.09;
    const coveredRoadModels = buildCoveredRoadModels(data);
    for (const e of edges) if (coveredRoadModels.isCovered(e)) {
        e.coveredRoadModel = coveredRoadModels.accepted.find(m => m.roadIndices.includes(e.road)).id;
        e.modelLayer = 0; // source tunnel=yes still means cover; no underground metre datum
    }
    // (owner, 2026-11-11, Grozavesti (886, -1090) "WTF?", "SAME FOR UNDERGROUND PASSAGES"; Street View at 44.45084, 26.07040:
    // Soseaua Nicolae Titulescu runs at street level under the Basarab viaduct) OSM tunnel=passage / building_passage on
    // layer 0 is a way at street level under a structure (here a service drive under the viaduct, w1295846860), not a dug
    // tunnel: taken as a tunnel it was anchored 6 m down and dragged both Titulescu carriageways into a 5 m trench.
    // The same for a tunnel explicitly mapped on layer 0 (register #45, Pipera: a covered drive, tunnel=yes covered=yes layer=0,
    // w1284446130, pulled Soseaua Pipera and the Calea Floreasca junction 1.2-4 m down under Podul Barbu Vacarescu, where Street
    // View at 44.47973, 26.10135 shows them at street level): a covered way at street level.
    for (const e of edges) { const t = data.roadSourceGeometry?.[e.road]?.tags; if (e.tunnel && t && (/^(passage|building_passage)$/.test(t.tunnel) ? !(Number(t.layer) < 0) : t.layer !== undefined && Number(t.layer) === 0)) { e.tunnel = false; e.sourcePassage = true; } }
    // (owner, 2026-11-12, Otopeni (-89, -499) "underpass leads to a dead end"; OSM w1395443535: a service way tagged tunnel=yes
    // layer=-1 whose two ends are nodes of the airport station building w813193384, building on layer 1 with min_height=5,
    // between two untagged ground-level service ways) a tunnel way that lies wholly under one building raised at least 4 m
    // off the ground is the street-level passage under that building, not a dug tunnel: anchored 6 m down it sank the whole
    // service road into a pit with no way out.
    {
        const BO = (data.version || 1) >= 2 ? 9 : 6, rg = new BoxGrid(48); let any = false;
        for (const [i, b] of (data.buildings || []).entries()) {
            const minH = data.buildingDimensions?.[i]?.[1] ?? b[2] / 10; if (!(minH >= 4)) continue;
            const ring = data.buildingFootprints?.[i] || undelta(b, BO); if (!ring || ring.length < 3) continue;
            const xs = ring.map(q => q[0]), zs = ring.map(q => q[1]); rg.insert(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), ring); any = true;
        }
        if (any) {
            const byRoad = new Map();
            for (const e of edges) if (e.tunnel && !e.virtual && !e.coveredRoadModel) { if (!byRoad.has(e.road)) byRoad.set(e.road, []); byRoad.get(e.road).push(e); }
            for (const es of byRoad.values()) {
                let common = null; // the raised footprints that cover every sample of the way
                for (const e of es) for (const t of [.15, .5, .85]) {
                    const x = e.a.x + (e.b.x - e.a.x) * t, z = e.a.z + (e.b.z - e.a.z) * t, here = new Set();
                    rg.each(x, z, x, z, r => { if (pointInPolygon(x, z, r)) here.add(r); });
                    common = common ? new Set([...common].filter(r => here.has(r))) : here;
                }
                if (common?.size) for (const e of es) { e.tunnel = false; e.sourcePassage = true; }
            }
        }
    }
    const crossings = [];
    return {
        CLEAR, GRADE, coveredRoadModels, crossings, edgesInBox, laneTapers, nearestEdge, sideExtra,
        trams, get sccInfo() { return sccInfo; },
    };
}
