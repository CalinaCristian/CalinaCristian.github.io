// Short guided walks use the same clearance for planning, smoothing and movement.
import { collide, colliderIndex } from './walker.js';

/** Read-only overlay of the actual pedestrian/vehicle body dimensions. Static
 * collider objects keep their original index; rebuilding an index over shared
 * objects would make its query stamps interfere with the native walker. */
export function withMovingBodies(staticColliders, bodies, ignorePed = null) {
    const dynamic=bodies.filter(o=>o.ped!==ignorePed&&Number.isFinite(o.x)&&Number.isFinite(o.z)&&o.width>0&&o.length>0).map(o=>({x:o.x,z:o.z,angle:Math.atan2(o.fx,o.fz),hw:o.width/2,hd:o.length/2,r:Math.hypot(o.width,o.length)/2,...(Number.isFinite(o.y)?{y0:o.y,y1:o.y+1.8}:{})}));
    if(!dynamic.length)return staticColliders;
    const index=colliderIndex(dynamic);
    return {query(x,z,r,cb){if(staticColliders.query)staticColliders.query(x,z,r,cb);else for(const c of staticColliders)cb(c);index.query(x,z,r,cb);}};
}

export function walkHeight(ground, colliders, x, z) {
    const base = ground.heightAt(x, z), y = ground.groundAt(x, z, base + 1.2);
    if (!Number.isFinite(y) || y > base + 40 || (ground.waterY != null && y < ground.waterY + 0.03) || collide(colliders || [], x, z, 0.34, y + 0.3)) return NaN;
    return y;
}
export function walkSegment(ground, colliders, a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.3));
    let y = walkHeight(ground, colliders, ...a);
    if (!Number.isFinite(y)) return false;
    for (let i = 1; i <= n; i++) {
        const h = walkHeight(ground, colliders, a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n);
        if (!Number.isFinite(h) || Math.abs(h - y) > 0.55) return false;
        y = h;
    }
    return true;
}
export function pathLength(path) { return path.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0); }

/** A* with a strict interaction radius. Never substitutes a distant point or an untested straight line. */
export function findWalkPath(ground, colliders, ax, az, bx, bz, { radius = 1.5, maxLength = 180 } = {}) {
    const start = [ax, az], goal = [bx, bz], C = 1.5, margin = Math.min(90, maxLength / 2);
    if (Math.hypot(bx - ax, bz - az) > maxLength + radius || !Number.isFinite(walkHeight(ground, colliders, ax, az))) return null;
    if (walkSegment(ground, colliders, start, goal)) return Math.hypot(bx - ax, bz - az) <= maxLength ? [start, goal] : null;
    const x0 = Math.min(ax, bx) - margin, z0 = Math.min(az, bz) - margin;
    const nx = Math.ceil((Math.abs(ax - bx) + margin * 2) / C), nz = Math.ceil((Math.abs(az - bz) + margin * 2) / C);
    if (nx * nz > 260000) return null;
    const point = (k) => [x0 + (Math.floor(k / nz) + 0.5) * C, z0 + (k % nz + 0.5) * C];
    const heights = new Map(), at = (k) => { if (!heights.has(k)) heights.set(k, walkHeight(ground, colliders, ...point(k))); return heights.get(k); };
    const prev = new Map(), costs = new Map(), done = new Set(), heap = [];
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const first = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return first; };
    const si = Math.floor((ax - x0) / C), sj = Math.floor((az - z0) / C);
    // A valid exact start can lie beside a blocked grid centre: seed only reachable neighbours.
    for (let i = si - 1; i <= si + 1; i++) for (let j = sj - 1; j <= sj + 1; j++) {
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const k = i * nz + j, p = point(k), d = Math.hypot(p[0] - ax, p[1] - az);
        if (Number.isFinite(at(k)) && walkSegment(ground, colliders, start, p)) { costs.set(k, d); push([d + Math.hypot(p[0] - bx, p[1] - bz), k]); }
    }
    let end = null, count = 0;
    while (heap.length && count++ < 50000) {
        const [, k] = pop(); if (done.has(k)) continue; done.add(k);
        const p = point(k), cost = costs.get(k), dist = Math.hypot(p[0] - bx, p[1] - bz);
        if (dist <= radius) { end = k; break; }
        const i = Math.floor(k / nz), j = k % nz;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
            const kk = ii * nz + jj, q = point(kk), next = cost + Math.hypot(di, dj) * C;
            if (next > maxLength || next >= (costs.get(kk) ?? Infinity) || !Number.isFinite(at(kk)) || !walkSegment(ground, colliders, p, q)) continue;
            costs.set(kk, next); prev.set(kk, k); push([next + Math.hypot(q[0] - bx, q[1] - bz), kk]);
        }
    }
    if (end == null) return null;
    const points = []; for (let k = end; k != null; k = prev.get(k)) points.push(point(k)); points.reverse(); points.unshift(start);
    // Append the exact target only if its final segment is walkable (plaques/activities can have colliders at their centre).
    if (walkSegment(ground, colliders, points.at(-1), goal) && pathLength(points) + Math.hypot(points.at(-1)[0] - bx, points.at(-1)[1] - bz) <= maxLength) points.push(goal);
    const out = [start]; let a = 0;
    while (a < points.length - 1) { let b = points.length - 1; while (b > a + 1 && !walkSegment(ground, colliders, points[a], points[b])) b--; out.push(points[b]); a = b; }
    return pathLength(out) <= maxLength ? out : null;
}
