// Pure horizontal flight domain. The source is the playable area, never terrain/camera bounds.
export const FLIGHT_GRACE = 150;
const CAP = FLIGHT_GRACE - 0.001;
const point = p => ({ x: p.x, z: p.z });
export function polygonFlightSource(polygons) {
    const inside = (x, z) => polygons.some(poly => {
        let yes = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[i], b = poly[j];
            if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
        }
        return yes;
    });
    return { inside, segments: polygons.flatMap(poly => poly.map((a, i) => {
        const b = poly[(i + 1) % poly.length]; return { ax: a[0], az: a[1], bx: b[0], bz: b[1] };
    })) };
}
export function createFlightBoundary(source) {
    if (!source?.inside || !source.segments?.length) return null;
    const segments = source.segments;
    function sample(x, z) {
        if (source.inside(x, z)) return { distance: 0, x, z, nx: 0, nz: 0 };
        let best = Infinity, qx = x, qz = z;
        for (const s of segments) {
            const dx = s.bx - s.ax, dz = s.bz - s.az, ll = dx * dx + dz * dz;
            const t = ll ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / ll)) : 0;
            const px = s.ax + dx * t, pz = s.az + dz * t, d2 = (x - px) ** 2 + (z - pz) ** 2;
            if (d2 < best) { best = d2; qx = px; qz = pz; }
        }
        const distance = Math.sqrt(best);
        return { distance, x: qx, z: qz, nx: distance ? (x - qx) / distance : 0, nz: distance ? (z - qz) / distance : 0 };
    }
    const allowed = (p, margin = FLIGHT_GRACE) => sample(p.x, p.z).distance <= margin;
    function project(p, margin = CAP) {
        const s = sample(p.x, p.z);
        if (s.distance > margin) { p.x = s.x + s.nx * margin; p.z = s.z + s.nz * margin; }
        return s;
    }
    // Distance to an area is 1-Lipschitz. Certify whole intervals; never accept a shortcut
    // merely because its endpoints happen to lie in separate arms of a concave district.
    function segmentAllowed(a, b, margin = FLIGHT_GRACE) {
        if (!allowed(a, margin) || !allowed(b, margin)) return false;
        function check(ax, az, bx, bz, depth) {
            const x = (ax + bx) / 2, z = (az + bz) / 2, clearance = margin - sample(x, z).distance;
            if (clearance < 0) return false;
            const length = Math.hypot(bx - ax, bz - az);
            if (length / 2 <= clearance + 1e-9) return true;
            if (depth >= 18 || length < 0.002) return false;
            return check(ax, az, x, z, depth + 1) && check(x, z, bx, bz, depth + 1);
        }
        return check(a.x, a.z, b.x, b.z, 0);
    }
    function constrain(p, velocity, previous = null) {
        if (previous && !allowed(previous)) { previous = point(previous); project(previous); }
        const s = project(p);
        if (previous && !segmentAllowed(previous, p)) {
            // A fast step cannot jump across a narrow excluded strip or between islands.
            let lo = 0, hi = 1;
            for (let i = 0; i < 16; i++) {
                const t = (lo + hi) / 2, q = { x: previous.x + (p.x - previous.x) * t, z: previous.z + (p.z - previous.z) * t };
                if (segmentAllowed(previous, q)) lo = t; else hi = t;
            }
            p.x = previous.x + (p.x - previous.x) * lo; p.z = previous.z + (p.z - previous.z) * lo;
        }
        const edge = sample(p.x, p.z), normal = edge.distance > CAP - 0.05 ? edge : s.distance > CAP ? s : null;
        if (velocity && edge.distance > 0) {
            // Brake progressively over the stopping distance; leave inward and tangent
            // components alone. Projection above is the final cap after any collision.
            const n = normal || edge, outward = velocity.x * n.nx + velocity.z * n.nz;
            const limit = normal ? 0 : Math.sqrt(2 * 60 * Math.max(0, CAP - edge.distance));
            if (outward > limit) { velocity.x -= (outward - limit) * n.nx; velocity.z -= (outward - limit) * n.nz; }
        }
        return s.distance > CAP || (normal && edge.distance >= CAP - 0.05);
    }
    function route(start, finish, { home = finish, range = Infinity, cell = 10 } = {}) {
        const goal = point(finish); project(goal);
        const inRange = p => Math.hypot(p.x - home.x, p.z - home.z) <= range + 1e-6;
        const clear = (a, b) => inRange(a) && inRange(b) && segmentAllowed(a, b);
        if (clear(start, goal)) return [goal];
        // Bounded A*: only the manual range disk is searched, with a 2m routing cushion.
        // A lattice anchored at takeoff works for masked stair-steps, holes and rotated polygons.
        const radius = Number.isFinite(range) ? range : Math.max(...segments.flatMap(s => [Math.hypot(s.ax - home.x, s.az - home.z), Math.hypot(s.bx - home.x, s.bz - home.z)])) + FLIGHT_GRACE;
        const bound = Math.ceil(radius / cell) + 2, key = (i, j) => `${i},${j}`;
        const at = (i, j) => ({ x: home.x + i * cell, z: home.z + j * cell });
        const open = [], nodes = new Map(), valid = new Map();
        const push = n => { open.push(n); let i = open.length - 1; while (i) { const p = (i - 1) >> 1; if (open[p].f <= n.f) break; open[i] = open[p]; i = p; } open[i] = n; };
        const pop = () => { const first = open[0], last = open.pop(); if (open.length) { let i = 0; while (true) { let c = i * 2 + 1; if (c >= open.length) break; if (c + 1 < open.length && open[c + 1].f < open[c].f) c++; if (open[c].f >= last.f) break; open[i] = open[c]; i = c; } open[i] = last; } return first; };
        const usable = (i, j) => {
            const k = key(i, j); if (!valid.has(k)) { const p = at(i, j); valid.set(k, Math.abs(i) <= bound && Math.abs(j) <= bound && inRange(p) && allowed(p, FLIGHT_GRACE - 2)); } return valid.get(k);
        };
        const si = Math.round((start.x - home.x) / cell), sj = Math.round((start.z - home.z) / cell);
        for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
            const i = si + di, j = sj + dj, p = at(i, j);
            if (!usable(i, j) || !clear(start, p)) continue;
            const g = Math.hypot(p.x - start.x, p.z - start.z), n = { i, j, p, g, f: g + Math.hypot(p.x - goal.x, p.z - goal.z), parent: null };
            nodes.set(key(i, j), n); push(n);
        }
        let found = null, expanded = 0;
        while (open.length && expanded++ < 60000) {
            const n = pop(); if (n.closed || nodes.get(key(n.i, n.j)) !== n) continue; n.closed = true;
            if (Math.hypot(n.p.x - goal.x, n.p.z - goal.z) <= cell * 3 && clear(n.p, goal)) { found = n; break; }
            for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
                if (!di && !dj) continue;
                const i = n.i + di, j = n.j + dj, k = key(i, j), p = at(i, j), g = n.g + Math.hypot(di, dj) * cell;
                if (!usable(i, j) || (nodes.get(k)?.g ?? Infinity) <= g || !segmentAllowed(n.p, p, FLIGHT_GRACE - 1)) continue;
                const next = { i, j, p, g, f: g + Math.hypot(p.x - goal.x, p.z - goal.z), parent: n }; nodes.set(k, next); push(next);
            }
        }
        if (!found) return null;
        const path = [goal]; for (let n = found; n; n = n.parent) path.push(n.p); path.reverse();
        const result = []; let from = start, i = 0;
        while (i < path.length) { let next = i; for (let j = i + 1; j < path.length; j++) if (clear(from, path[j])) next = j; result.push(path[next]); from = path[next]; i = next + 1; }
        return result;
    }
    return { sample, allowed, project, constrain, segmentAllowed, route };
}
