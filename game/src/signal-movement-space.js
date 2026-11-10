// Admission only: a conservative swept lane waits for an occupied movement.
// Collision, yielding, source legality and committed-body guards stay native.

/** Find the next existing controller node along this literal route. An unlit
 * branching node can lie between its stop lines just as a shape node can.
 * Never bridge another controller, U-turn, missing leg or disconnected join. */
export function nextControllerRouteEnd(route, start, controller, limit = 100, expectedStart = null) {
    let distance = 0, previous = expectedStart;
    for (let i = start; i < route.length; i++) {
        const step = route[i], e = step?.e;
        if (!e || step.uturn || (step.dir !== 1 && step.dir !== -1)) return -1;
        const begin = step.dir > 0 ? e.a : e.b, end = step.dir > 0 ? e.b : e.a;
        if (previous && begin !== previous) return -1;
        if (!(Number.isFinite(e.len) && e.len > 0)) return -1;
        distance += e.len;
        if (distance > limit) return -1;
        if (end.lightCluster) return end.lightCluster === controller ? i : -1;
        if (end.hasLight) return -1;
        previous = end;
    }
    return -1;
}

function distanceToBody(segment, body) {
    const c = Math.cos(body.heading), s = Math.sin(body.heading);
    const local = (x, z) => { const dx = x - body.x, dz = z - body.z; return [c * dx - s * dz, s * dx + c * dz]; };
    const a = local(segment.p0x, segment.p0z), b = local(segment.p1x, segment.p1z);
    const w = body.width / 2, l = body.length / 2;
    // Slab intersection gives zero distance, including a segment entirely
    // inside the rectangle. Otherwise use the exact four finite edge pairs.
    let lo = 0, hi = 1;
    for (const [axis, half] of [[0, w], [1, l]]) {
        const d = b[axis] - a[axis];
        if (d === 0) { if (Math.abs(a[axis]) > half) { hi = -1; break; } }
        else { let u = (-half - a[axis]) / d, v = (half - a[axis]) / d; if (u > v) [u, v] = [v, u]; lo = Math.max(lo, u); hi = Math.min(hi, v); }
    }
    if (lo <= hi) return 0;
    const pointSegment = (p, q, r) => {
        const dx = r[0] - q[0], dz = r[1] - q[1], den = dx * dx + dz * dz;
        const t = den ? Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dz) / den)) : 0;
        return Math.hypot(p[0] - q[0] - t * dx, p[1] - q[1] - t * dz);
    };
    const corners = [[-w, -l], [w, -l], [w, l], [-w, l]];
    let distance = Infinity;
    for (let i = 0; i < 4; i++) {
        const p = corners[i], q = corners[(i + 1) % 4];
        distance = Math.min(distance, pointSegment(a, p, q), pointSegment(b, p, q), pointSegment(p, a, b), pointSegment(q, a, b));
    }
    return distance;
}

export function signalMovementBlocked(vehicle, path, peers) {
    for (const other of peers) {
        if (other === vehicle || other.inactive || other.speed >= 2 || Math.abs(other.y - vehicle.y) > 2) continue;
        if (![other.x, other.z, other.heading, other.width, other.length].every(Number.isFinite) || other.width <= 0 || other.length <= 0) continue;
        for (const segment of path.segments) {
            if (distanceToBody(segment, other) < vehicle.width / 2 + .5) return true;
        }
    }
    return false;
}
