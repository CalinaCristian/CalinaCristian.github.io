// ============================================================================
//  NAVIGATION — spatial edge index, A* routing on the road graph (one-way
//  aware), turn-by-turn instructions and the in-car display renderer.
// ============================================================================
import { distPointSeg, clamp } from './util.js';
import { endpointAccessEdges } from './road-access.js';

// ---------- edge contract helpers (work with both the hand-made and the OSM graph) ----------
/** lanes available when travelling the edge in `dir` (+1 = a→b, -1 = b→a). 0 = not allowed. */
export function lanesDir(e, dir) {
    if (dir > 0) return e.lanesF ?? e.lanes ?? 1;
    if (e.oneway) return 0;
    return e.lanesB ?? e.lanes ?? 1;
}
export const canTravel = (e, dir) => e.publicDrive !== false && lanesDir(e, dir) > 0;
export const edgeSpeed = (e) => e.maxspeed ?? e.speed ?? 13;
export const nodeList = (graph) => Array.isArray(graph.nodes) ? graph.nodes : Object.values(graph.nodes);
const MOTOR = new Set(['highway', 'motorway', 'motorway_link', 'trunk', 'trunk_link', 'ramp']);
export const isMotorway = (e) => MOTOR.has(e.type);
export function roadName(e) {
    if (!e) return '';
    if (e.name) return e.name;
    if (e.ref) return e.ref;
    const t = e.type || '';
    if (t.startsWith('motorway')) return 'Motorway';
    if (t.endsWith('_link') || t === 'ramp') return 'Ramp';
    if (t === 'service') return 'Service road';
    return 'Unnamed road';
}

// ---------- uniform grid of edges for nearest / range queries ----------
export class EdgeIndex {
    constructor(edges, cell = 50) {
        this.cell = cell; this.edges = edges; this.map = new Map();
        for (const e of edges) {
            const keys = new Set();
            const n = Math.max(1, Math.ceil(e.len / (cell * 0.4)));
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                keys.add(this.key(Math.floor((e.a.x + (e.b.x - e.a.x) * t) / cell), Math.floor((e.a.z + (e.b.z - e.a.z) * t) / cell)));
            }
            for (const k of keys) { let arr = this.map.get(k); if (!arr) this.map.set(k, arr = []); arr.push(e); }
        }
    }
    key(ix, iz) { return ix * 1000003 + iz; }
    /** nearest edge to a point → { edge, d, t, cx, cz } (same shape as world.nearestEdge) */
    nearest(x, z, maxR = 2000, filter = null) {
        const c = this.cell, ix = Math.floor(x / c), iz = Math.floor(z / c);
        let best = null, bd = Infinity;
        const K = Math.ceil(maxR / c);
        for (let k = 0; k <= K; k++) {
            for (let dx = -k; dx <= k; dx++) {
                for (let dz = -k; dz <= k; dz++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== k) continue;
                    const arr = this.map.get(this.key(ix + dx, iz + dz)); if (!arr) continue;
                    for (const e of arr) {
                        if (filter && !filter(e)) continue;
                        const r = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
                        if (r.d < bd) { bd = r.d; best = { edge: e, d: r.d, t: r.t, cx: r.cx, cz: r.cz }; }
                    }
                }
            }
            if (best && bd <= k * c) break;
        }
        return best;
    }
    /** all edges whose rasterised cells fall within r of (x,z) */
    near(x, z, r, out = []) {
        const c = this.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
        const seen = this._seen || (this._seen = new Set()); seen.clear(); out.length = 0;
        for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
            const arr = this.map.get(this.key(ix, iz)); if (!arr) continue;
            for (const e of arr) if (!seen.has(e)) { seen.add(e); out.push(e); }
        }
        return out;
    }
}

// ---------- binary heap ----------
class Heap {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    push(key, val) {
        const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
        while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
        k[i] = key; v[i] = val;
    }
    pop() {
        const k = this.k, v = this.v; const top = v[0]; const lk = k.pop(), lv = v.pop();
        if (k.length) {
            let i = 0; const n = k.length;
            for (;;) { let l = 2 * i + 1, r = l + 1, m = i; let mk = lk; if (l < n && k[l] < mk) { m = l; mk = k[l]; } if (r < n && k[r] < mk) m = r; if (m === i) break; k[i] = k[m]; v[i] = v[m]; i = m; }
            k[i] = lk; v[i] = lv;
        }
        return top;
    }
}

const TYPE_COST = { living_street: 1.8, service: 4, residential: 1.15, small: 1.15, track: 3 };
// entering a service road (parking aisle, driveway, private access) from a real street: a big fixed cost, so a
// route only uses one to reach a door that is on it, never as a shortcut
const SERVICE_ENTRY = 25;

/** signed turn angle from direction (ax,az) to (bx,bz). positive = right turn (x east, z south). */
export function turnAngle(ax, az, bx, bz) { return Math.atan2(-bx * az + bz * ax, ax * bx + az * bz); }

// ---------- router ----------
export class Navigator {
    constructor(world) {
        this.world = world;
        this.graph = world.graph;
        this.nodes = nodeList(world.graph);
        this.index = new EdgeIndex(world.graph.edges.filter(e => e.publicDrive !== false));
        this.nid = new Map(); this.nodes.forEach((n, i) => this.nid.set(n, i));
        this.markMainComponent();
        this.route = null; this.dest = null; this.offTimer = 0; this.progress = 0; this.segIdx = 0;
    }

    /**
     * Largest strongly-connected component of the directed (one-way aware) graph: edges inside it get
     * `edge.main = true`. Routing, resets and fast travel snap to these so nobody lands in a one-way trap
     * (OSM clipping / broken chains). Kosaraju, iterative.
     */
    markMainComponent() {
        // district maps: every road cut at the boundary (node.mapEnd) leads to / comes from "the rest of the city":
        // join them through one virtual outside node (as world.js does), so a one-way street entering the map is no trap
        const OUT = this.nodes.length, N = OUT + 1, nid = this.nid;
        const out = Array.from({ length: N }, () => []), inn = Array.from({ length: N }, () => []);
        this.nodes.forEach((n, i) => { if (n.mapEnd) { out[i].push(OUT); inn[OUT].push(i); out[OUT].push(i); inn[i].push(OUT); } });
        for (const e of this.graph.edges) {
            const a = nid.get(e.a), b = nid.get(e.b); if (a === undefined || b === undefined) continue;
            if (canTravel(e, 1)) { out[a].push(b); inn[b].push(a); }
            if (canTravel(e, -1)) { out[b].push(a); inn[a].push(b); }
        }
        const order = [], seen = new Uint8Array(N);
        for (let s = 0; s < N; s++) {
            if (seen[s]) continue;
            const st = [[s, 0]]; seen[s] = 1;
            while (st.length) {
                const top = st[st.length - 1]; const u = top[0];
                if (top[1] < out[u].length) { const w = out[u][top[1]++]; if (!seen[w]) { seen[w] = 1; st.push([w, 0]); } }
                else { order.push(u); st.pop(); }
            }
        }
        const comp = new Int32Array(N).fill(-1); const size = []; let c = 0;
        for (let i = N - 1; i >= 0; i--) {
            const s = order[i]; if (comp[s] >= 0) continue;
            let n = 0; const st = [s]; comp[s] = c;
            while (st.length) { const u = st.pop(); n++; for (const w of inn[u]) if (comp[w] < 0) { comp[w] = c; st.push(w); } }
            size.push(n); c++;
        }
        let big = 0; for (let i = 1; i < size.length; i++) if (size[i] > size[big]) big = i;
        // (the virtual node counts toward its component's size, but it is no real node)
        let nMain = 0;
        for (const e of this.graph.edges) { e.main = comp[nid.get(e.a)] === big && comp[nid.get(e.b)] === big; if (e.main) nMain++; }
        this.mainStats = { components: size.length, mainNodes: size[big] || 0, nodes: OUT, mainEdges: nMain, edges: this.graph.edges.length };
        if (nMain === 0) for (const e of this.graph.edges) e.main = true; // degenerate graph: don't filter
    }

    /** a snap onto a service road → the nearest real street instead when it is at most `slack` m further away */
    preferStreet(x, z, hit, filter, slack) {
        if (!hit || hit.edge.type !== 'service') return hit;
        const alt = this.index.nearest(x, z, hit.d + slack + 1, (e) => e.type !== 'service' && filter(e));
        return alt && alt.d <= hit.d + slack ? alt : hit;
    }
    /** A* on travel time. heading (optional) penalises starting against the player's heading. */
    compute(fx, fz, tx, tz, heading = null, fy = null) {
        // on foot (nav.walking): every street both ways (no one-way rules), walking pace, no heading penalty; motorways excluded
        const W = !!this.walking, canTravelW = (e, dir) => W ? !isMotorway(e) : canTravel(e, dir), speedW = (e) => W ? 1.5 : edgeSpeed(e);
        if (W) heading = null;
        const main = (e) => e.main !== false;
        // start on the road at the car's level (a bridge deck above / a street below is not where we are)
        const yAt = (e) => { if (e.ya === undefined) return 0.24; const t = Math.max(0, Math.min(1, ((fx - e.a.x) * e.dirx + (fz - e.a.z) * e.dirz) / e.len)); return 0.24 + e.ya + (e.yb - e.ya) * t; };
        // (callers that do not pass the height but start at the player's position get the player's level)
        const P = this.player; if (fy == null && P && Math.hypot(P.x - fx, P.z - fz) < 1.5) fy = P.surfY ?? P.y ?? null;
        const level = (e) => main(e) && (fy == null || Math.abs(yAt(e) - fy) < 2);
        const s = this.preferStreet(fx, fz, (fy != null && this.index.nearest(fx, fz, 60, level)) || this.index.nearest(fx, fz, 400, main) || this.index.nearest(fx, fz), (e) => level(e), 3);
        const g = this.preferStreet(tx, tz, this.index.nearest(tx, tz, 600, main) || this.index.nearest(tx, tz), main, 3);
        if (!s || !g) return null;
        const N = this.nodes.length, GOAL = N;
        const dist = new Float64Array(N + 1).fill(Infinity);
        const prevE = new Array(N + 1), prevN = new Int32Array(N + 1).fill(-2);
        const heap = new Heap();
        const vmax = 36;
        const h = (n) => Math.hypot(n.x - tx, n.z - tz) / vmax;
        const se = s.edge;
        const hx = heading === null ? 0 : -Math.sin(heading), hz = heading === null ? 0 : -Math.cos(heading);
        const startOpts = [];
        for (const dir of [1, -1]) {
            if (!canTravelW(se, dir)) continue;
            const node = dir > 0 ? se.b : se.a;
            const along = dir > 0 ? (1 - s.t) * se.len : s.t * se.len;
            const against = heading !== null && (se.dirx * dir * hx + se.dirz * dir * hz) < -0.3;
            const cost = along / speedW(se) + (against ? 25 : 0);
            startOpts.push({ dir, node, cost, along });
            const i = this.nid.get(node);
            if (cost < dist[i]) { dist[i] = cost; prevN[i] = -1; prevE[i] = { e: se, dir }; heap.push(cost + h(node), i); }
        }
        // direct along the same edge
        const ge = g.edge;
        const endpointAccess = endpointAccessEdges(se, ge);
        let direct = null;
        if (ge === se) {
            for (const o of startOpts) {
                const ahead = o.dir > 0 ? g.t >= s.t : g.t <= s.t;
                if (ahead) { const c = Math.abs(g.t - s.t) * se.len / speedW(se) + (o.cost - o.along / speedW(se)); direct = { dir: o.dir, cost: c }; }
            }
        }
        const goalCost = new Map(); // nodeIdx -> {cost, dir}
        for (const dir of [1, -1]) {
            if (!canTravelW(ge, dir)) continue;
            const entry = dir > 0 ? ge.a : ge.b;
            const along = dir > 0 ? g.t * ge.len : (1 - g.t) * ge.len;
            goalCost.set(this.nid.get(entry), { cost: along / speedW(ge), dir });
        }
        if (direct) { dist[GOAL] = direct.cost; prevN[GOAL] = -3; }
        let found = !!direct, iter = 0;
        while (heap.size && iter++ < 400000) {
            const u = heap.pop();
            if (u === GOAL) { found = true; break; }
            const du = dist[u];
            const node = this.nodes[u];
            const gc = goalCost.get(u);
            if (gc && du + gc.cost < dist[GOAL]) { dist[GOAL] = du + gc.cost; prevN[GOAL] = u; prevE[GOAL] = { e: ge, dir: gc.dir }; heap.push(dist[GOAL], GOAL); }
            for (const e of node.edges) {
                const dir = e.a === node ? 1 : -1;
                if (!canTravelW(e, dir)) continue;
                if (!W && e.throughAccess === false && !endpointAccess.has(e)) continue;
                const other = dir > 0 ? e.b : e.a;
                const vi = this.nid.get(other); if (vi === undefined) continue;
                const pe = prevE[u];
                const turnPen = !pe ? 0 : pe.e === e ? 40 : (node.edges.length >= 3 && (pe.e.name || '') !== (e.name || '')) ? 7 : 0;
                const svc = e.type === 'service' && pe && pe.e.type !== 'service' ? SERVICE_ENTRY : 0;
                const c = du + e.len / speedW(e) * (TYPE_COST[e.type] || 1) + turnPen + svc;
                if (c < dist[vi]) { dist[vi] = c; prevN[vi] = u; prevE[vi] = { e, dir }; heap.push(c + h(other), vi); }
            }
        }
        if (!found || dist[GOAL] === Infinity) return null;
        // reconstruct
        const legs = [];
        let points;
        if (prevN[GOAL] === -3) {
            legs.push({ e: se, dir: direct.dir });
            points = [[s.cx, s.cz], [g.cx, g.cz]];
        } else {
            let cur = GOAL;
            const chain = [];
            while (cur >= 0) { chain.push({ leg: prevE[cur], node: cur === GOAL ? null : this.nodes[cur] }); cur = prevN[cur]; }
            chain.reverse();
            points = [[s.cx, s.cz]];
            for (const c of chain) { legs.push(c.leg); if (c.node) points.push([c.node.x, c.node.z]); }
            points.push([g.cx, g.cz]);
        }
        const route = this.buildRoute(points, legs);
        if (W && route) {
            // on foot: no "U-turn" (you just turn round), and a short way that the road graph only reaches round a median /
            // a block (the street network has no crossing links) is walked straight across
            for (const st of route.steps) if (st.type === 'uturn') st.type = 'sharp';
            const dd = Math.hypot(tx - fx, tz - fz);
            if (dd < 120 && route.total > dd * 1.6) return { points: [[fx, fz], [tx, tz]], cum: [0, dd], total: dd, steps: [{ at: dd, type: 'arrive', name: '', x: tx, z: tz }], legs: [legs[0]] };
        }
        return route;
    }

    buildRoute(points, legs) {
        const pts = points; // one point per traversed node (+ start/end) so indices line up with legs
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const total = cum[cum.length - 1];
        // maneuvers: legs[i] ends at node between legs[i] and legs[i+1]
        const steps = [];
        let onRb = null;
        for (let i = 0; i < legs.length - 1; i++) {
            const A = legs[i], B = legs[i + 1];
            const node = A.dir > 0 ? A.e.b : A.e.a;
            // distance along the route to this node = cum at the point index of this node (points: start, n0, n1, ...)
            const nodeAt = cum[Math.min(i + 1, cum.length - 1)];
            const ang = turnAngle(A.e.dirx * A.dir, A.e.dirz * A.dir, B.e.dirx * B.dir, B.e.dirz * B.dir);
            const deg = node.edges.length;
            const nameA = A.e.name || A.e.ref || '', nameB = B.e.name || B.e.ref || '';
            if (B.e.roundabout && !A.e.roundabout) { onRb = { at: nodeAt, exits: 0, x: node.x, z: node.z }; continue; }
            if (onRb) {
                if (B.e.roundabout) { if (deg >= 3) onRb.exits++; continue; }
                steps.push({ at: onRb.at, type: 'roundabout', exit: onRb.exits + 1, ang, name: nameB, x: onRb.x, z: onRb.z });
                onRb = null; continue;
            }
            const a = Math.abs(ang);
            let type = null;
            if (a > 2.6) type = 'uturn';
            else if (deg >= 3 && a > 0.35 && !(nameA && nameA === nameB && a < 0.8)) type = a < 0.8 ? 'slight' : a < 2.0 ? 'turn' : 'sharp';
            else if (deg <= 2 && a > 1.0 && nameA !== nameB && nameB) type = 'turn';
            else if (nameA !== nameB && nameB && nameA && deg >= 3 && a > 0.12) type = 'slight';
            if (!type) continue;
            const last = steps[steps.length - 1];
            // merge maneuvers that are really one junction (dual carriageways, split intersections)
            if (last && last.type !== 'roundabout' && nodeAt - last.at < 25) {
                const A2 = last.ang + ang, a2 = Math.abs(A2);
                last.ang = A2; last.side = A2 > 0 ? 'right' : 'left'; last.name = nameB || last.name;
                last.type = a2 > 2.6 ? 'uturn' : a2 > 2.0 ? 'sharp' : a2 > 0.8 ? 'turn' : a2 > 0.2 ? 'slight' : 'continue';
                if (last.type === 'continue' && !last.name) steps.pop();
                continue;
            }
            steps.push({ at: nodeAt, type, side: ang > 0 ? 'right' : 'left', ang, name: nameB, x: node.x, z: node.z });
        }
        steps.push({ at: total, type: 'arrive', name: '', x: pts[pts.length - 1][0], z: pts[pts.length - 1][1] });
        return { points: pts, cum, total, steps, legs };
    }

    /** set a destination {x,z,label}; computes route from the player */
    setDestination(dest, player) {
        this.dest = dest; this.player = player;
        this.reroute(player);
    }
    clear() { this.dest = null; this.route = null; }
    reroute(player) {
        if (!this.dest) { this.route = null; return; }
        this.player = player;
        this.route = this.compute(player.x, player.z, this.dest.x, this.dest.z, player.heading, player.surfY ?? player.y ?? null);
        this.segIdx = 0; this.progress = 0; this.offTimer = 0;
    }

    /** track progress; returns {remaining, next, distToNext, arrived, rerouted} */
    update(player, dt) {
        const r = this.route; if (!r) return null;
        const P = r.points;
        let best = Infinity, bi = this.segIdx, bt = 0;
        const from = Math.max(0, this.segIdx - 3), to = Math.min(P.length - 1, this.segIdx + 60);
        for (let i = from; i < to; i++) {
            const q = distPointSeg(player.x, player.z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]);
            if (q.d < best - 0.01) { best = q.d; bi = i; bt = q.t; }
        }
        this.segIdx = bi;
        this.progress = r.cum[bi] + (r.cum[bi + 1] - r.cum[bi]) * bt;
        this.deviation = best;
        let rerouted = false;
        if (best > 25) { this.offTimer += dt; if (this.offTimer > 3) { this.reroute(player); rerouted = true; } }
        else this.offTimer = 0;
        const rr = this.route; if (!rr) return null;
        const remaining = Math.max(0, rr.total - this.progress);
        const next = rr.steps.find(s => s.at > this.progress + 3) || rr.steps[rr.steps.length - 1];
        return { remaining, next, distToNext: Math.max(0, next.at - this.progress), arrived: remaining < 14 && best < 30, rerouted };
    }
}

// ---------- formatting ----------
export function fmtDist(m, units) {
    if (units === 'mph') {
        const mi = m / 1609.34;
        if (mi < 0.1) return Math.max(50, Math.round(m * 3.281 / 50) * 50) + ' ft';
        return (mi < 10 ? mi.toFixed(1) : Math.round(mi)) + ' mi';
    }
    if (m < 1000) return Math.max(10, Math.round(m / 10) * 10) + ' m';
    return (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km';
}
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
export function stepText(step, dist, units) {
    if (!step) return '';
    const inD = dist != null ? ` in ${fmtDist(dist, units)}` : '';
    const onto = step.name ? ` onto ${step.name}` : '';
    switch (step.type) {
        case 'arrive': return `Arrive at destination${inD}`;
        case 'uturn': return `Make a U-turn${inD}`;
        case 'roundabout': return `At the roundabout, take the ${ORD[step.exit - 1] || step.exit + 'th'} exit${onto}${inD}`;
        case 'continue': return `Continue${onto}${inD}`;
        case 'slight': return `Slight ${step.side}${onto}${inD}`;
        case 'sharp': return `Sharp ${step.side}${onto}${inD}`;
        default: return `Turn ${step.side}${onto}${inD}`;
    }
}
export function stepArrow(step) {
    if (!step) return '⬆';
    switch (step.type) {
        case 'arrive': return '🏁';
        case 'uturn': return '⤺';
        case 'roundabout': return '⟳';
        case 'continue': return '⬆';
        case 'slight': return step.side === 'right' ? '↗' : '↖';
        case 'sharp': return step.side === 'right' ? '↘' : '↙';
        default: return step.side === 'right' ? '➡' : '⬅';
    }
}

/** vector arrow for the in-car display */
export function drawTurnArrow(ctx, step, cx, cy, size, color = '#fff') {
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = size * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const head = (x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -size * 0.2); ctx.lineTo(size * 0.2, size * 0.06); ctx.lineTo(-size * 0.2, size * 0.06); ctx.closePath(); ctx.fill(); ctx.restore(); };
    const type = step ? step.type : 'continue';
    if (type === 'arrive') {
        ctx.beginPath(); ctx.arc(0, -size * 0.12, size * 0.26, Math.PI, 0); ctx.lineTo(0, size * 0.42); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0f1720'; ctx.beginPath(); ctx.arc(0, -size * 0.12, size * 0.1, 0, 7); ctx.fill();
    } else if (type === 'uturn') {
        ctx.beginPath(); ctx.moveTo(size * 0.2, size * 0.4); ctx.lineTo(size * 0.2, -size * 0.1); ctx.arc(0, -size * 0.1, size * 0.2, 0, Math.PI, true); ctx.lineTo(-size * 0.2, size * 0.15); ctx.stroke();
        head(-size * 0.2, size * 0.25, Math.PI);
    } else if (type === 'roundabout') {
        ctx.beginPath(); ctx.arc(0, 0, size * 0.22, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, size * 0.45); ctx.lineTo(0, size * 0.22); ctx.stroke();
        const a = step.ang || 0; ctx.beginPath(); ctx.moveTo(Math.sin(a) * size * 0.22, -Math.cos(a) * size * 0.22); ctx.lineTo(Math.sin(a) * size * 0.42, -Math.cos(a) * size * 0.42); ctx.stroke();
        head(Math.sin(a) * size * 0.42, -Math.cos(a) * size * 0.42, a);
    } else {
        const sgn = step && step.side === 'left' ? -1 : 1;
        const a = type === 'continue' ? 0 : type === 'slight' ? 0.65 * sgn : type === 'sharp' ? 2.3 * sgn : 1.5708 * sgn;
        ctx.beginPath(); ctx.moveTo(0, size * 0.45); ctx.lineTo(0, 0);
        const ex = Math.sin(a) * size * 0.36, ez = -Math.cos(a) * size * 0.36;
        ctx.lineTo(ex, ez); ctx.stroke();
        head(ex, ez, a);
    }
    ctx.restore();
}

// ---------- in-car display ----------
const ROAD_CLASS = (e) => {
    const t = e.type || '';
    if (t === 'highway' || t.startsWith('motorway') || t.startsWith('trunk') || t === 'ramp') return 0;
    if (t === 'boulevard' || t === 'dn' || t.startsWith('primary')) return 1;
    if (t.startsWith('secondary') || t === 'avenue' || t === 'street' || t.startsWith('tertiary')) return 2;
    return 3;
};
const CLASS_COL = ['#c98b2b', '#8794aa', '#66738a', '#465063'];
const CLASS_W = [11, 10, 7, 4.5];

export class CarScreen {
    constructor(w = 512, h = 320) {
        this.canvas = document.createElement('canvas'); this.canvas.width = w; this.canvas.height = h;
        this.ctx = this.canvas.getContext('2d');
        this._near = [];
    }
    /**
     * info: { player, index, route, nav (update result), dest, street, limit {value, units, country}, over,
     *         fuel (0..1), liters, year, units, speed, pois: [{x,z,icon,color}] }
     */
    draw(info) {
        const { ctx, canvas } = this; const W = canvas.width, H = canvas.height;
        const p = info.player;
        ctx.save();
        ctx.fillStyle = '#0d141c'; ctx.fillRect(0, 0, W, H);
        const scale = clamp(1.25 - Math.abs(p.speed) * 0.02, 0.55, 1.25); // zoom out at speed
        const cy = H * 0.66;
        ctx.save();
        ctx.translate(W / 2, cy); ctx.rotate(p.heading); ctx.scale(scale, scale); ctx.translate(-p.x, -p.z);
        const R = Math.hypot(W, H) / scale * 0.6;
        const edges = info.index.near(p.x, p.z, R, this._near);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // one stroke per road class (fast even with thousands of OSM segments)
        const cls = this._cls || (this._cls = [[], [], [], []]);
        for (const c of cls) c.length = 0;
        for (const e of edges) cls[ROAD_CLASS(e)].push(e);
        for (let k = 3; k >= 0; k--) {
            const list = cls[k]; if (!list.length) continue;
            ctx.beginPath();
            for (const e of list) { ctx.moveTo(e.a.x, e.a.z); ctx.lineTo(e.b.x, e.b.z); }
            ctx.strokeStyle = '#05080c'; ctx.lineWidth = (CLASS_W[k] + 2.5) / scale; ctx.stroke();
            ctx.strokeStyle = CLASS_COL[k]; ctx.lineWidth = CLASS_W[k] / scale; ctx.stroke();
        }
        // route
        const r = info.route;
        if (r) {
            ctx.beginPath();
            const start = Math.max(0, (info.segIdx || 0));
            ctx.moveTo(p.x, p.z);
            for (let i = start + 1; i < r.points.length; i++) ctx.lineTo(r.points[i][0], r.points[i][1]);
            ctx.strokeStyle = 'rgba(30,64,175,0.9)'; ctx.lineWidth = 11 / scale; ctx.stroke();
            ctx.strokeStyle = '#3b9bff'; ctx.lineWidth = 7 / scale; ctx.stroke();
        }
        // POIs (fuel etc.)
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const q of info.pois || []) {
            if (Math.abs(q.x - p.x) > R || Math.abs(q.z - p.z) > R) continue;
            ctx.save(); ctx.translate(q.x, q.z);
            { const t = ctx.getTransform(); if (t.e < -12 || t.e > W + 12 || t.f < -12 || t.f > H + 12) { ctx.restore(); continue; } } // off the screen canvas (review #26b)
            ctx.rotate(-p.heading); ctx.scale(1 / scale, 1 / scale);
            ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fillStyle = q.color || '#334155'; ctx.fill();
            ctx.font = '11px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(q.icon || '•', 0, 1);
            ctx.restore();
        }
        // destination pin
        if (info.dest) {
            ctx.save(); ctx.translate(info.dest.x, info.dest.z); ctx.rotate(-p.heading); ctx.scale(1 / scale, 1 / scale);
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, -18, 10, Math.PI, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -18, 4, 0, 7); ctx.fill();
            ctx.restore();
        }
        ctx.restore();
        // player arrow
        ctx.save(); ctx.translate(W / 2, cy);
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(0, 4); ctx.lineTo(-10, 10); ctx.closePath();
        ctx.fillStyle = '#f8fafc'; ctx.fill(); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();

        // ---- top banner: next maneuver ----
        const nav = info.nav;
        ctx.fillStyle = 'rgba(16,94,60,0.95)'; if (!nav) ctx.fillStyle = 'rgba(30,41,59,0.92)';
        ctx.fillRect(0, 0, W, 74);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        if (nav) {
            drawTurnArrow(ctx, nav.next, 40, 38, 54);
            ctx.font = 'bold 30px sans-serif'; ctx.fillText(fmtDist(nav.distToNext, info.units), 80, 36);
            ctx.font = '19px sans-serif';
            const txt = nav.next.type === 'arrive' ? (info.dest?.label || 'Destination') : (nav.next.name || stepText(nav.next, null, info.units));
            ctx.fillText(ellipsize(ctx, txt, W - 96), 80, 62);
            ctx.textAlign = 'right'; ctx.font = '15px sans-serif'; ctx.fillStyle = '#bbf7d0';
            ctx.fillText(fmtDist(nav.remaining, info.units), W - 12, 30);
            const eta = nav.remaining / Math.max(6, Math.abs(p.speed) * 0.7 + 4);
            ctx.fillText(Math.max(1, Math.round(eta / 60)) + ' min', W - 12, 50);
        } else {
            ctx.font = 'bold 20px sans-serif'; ctx.fillText('No route', 18, 32);
            ctx.font = '15px sans-serif'; ctx.fillStyle = '#cbd5e1'; ctx.fillText('Press M to pick a destination', 18, 56);
        }
        // ---- bottom bar ----
        const by = H - 54;
        ctx.fillStyle = 'rgba(15,23,42,0.92)'; ctx.fillRect(0, by, W, 54);
        // limit sign
        const lim = info.limit;
        let lx = 12;
        if (lim) {
            if (lim.us) {
                ctx.fillStyle = '#fff'; roundRect(ctx, lx, by + 5, 34, 44, 4); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; roundRect(ctx, lx + 2, by + 7, 30, 40, 3); ctx.stroke();
                ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = 'bold 7px sans-serif'; ctx.fillText('SPEED', lx + 17, by + 16); ctx.fillText('LIMIT', lx + 17, by + 24);
                ctx.font = 'bold 18px sans-serif'; ctx.fillText(lim.value, lx + 17, by + 43);
                lx += 44;
            } else {
                ctx.beginPath(); ctx.arc(lx + 22, by + 27, 21, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
                ctx.lineWidth = 6; ctx.strokeStyle = '#d62828'; ctx.beginPath(); ctx.arc(lx + 22, by + 27, 18, 0, 7); ctx.stroke();
                ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = 'bold 17px sans-serif'; ctx.fillText(lim.value, lx + 22, by + 33);
                lx += 52;
            }
            if (info.over && (performance.now() % 600) < 350) { ctx.fillStyle = 'rgba(239,68,68,0.35)'; ctx.fillRect(0, by, W, 54); }
        }
        ctx.textAlign = 'left'; ctx.fillStyle = '#f1f5f9'; ctx.font = 'bold 17px sans-serif';
        ctx.fillText(ellipsize(ctx, info.street || '', 230), lx + 4, by + 24);
        ctx.font = '14px sans-serif'; ctx.fillStyle = info.over ? '#fca5a5' : '#94a3b8';
        ctx.fillText(`${info.speedText}${info.over ? '  ⚠ slow down' : ''}`, lx + 4, by + 44);
        // fuel
        const fx = W - 190;
        ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif'; ctx.fillText('⛽', fx, by + 22);
        ctx.fillStyle = '#1e293b'; ctx.fillRect(fx + 20, by + 12, 70, 12);
        const f = clamp(info.fuel, 0, 1);
        ctx.fillStyle = f < 0.15 ? '#ef4444' : f < 0.3 ? '#f59e0b' : '#22c55e'; ctx.fillRect(fx + 20, by + 12, 70 * f, 12);
        ctx.fillStyle = f < 0.15 && (performance.now() % 800) < 400 ? '#fca5a5' : '#cbd5e1'; ctx.font = '12px sans-serif';
        ctx.fillText(info.fuelText, fx, by + 44);
        // clock/year
        const d = new Date();
        const clock = info.clock || `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        ctx.textAlign = 'right'; ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`${info.weather ? info.weather.split(' ').slice(0, 2).join(' ') + '  ' : ''}${info.phaseIcon ? info.phaseIcon + ' ' : ''}${clock}`, W - 12, by + 24);
        ctx.font = '13px sans-serif'; ctx.fillStyle = '#fbbf24'; ctx.fillText(String(info.year || ''), W - 12, by + 44);
        // compass N
        ctx.save(); ctx.translate(W - 22, 96); ctx.rotate(p.heading);
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(6, 4); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', 0, 16);
        ctx.restore();
        ctx.restore();
    }
}
function ellipsize(ctx, s, max) {
    if (ctx.measureText(s).width <= max) return s;
    while (s.length > 3 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
