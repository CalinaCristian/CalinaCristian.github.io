// Mapped water polygons define the bank. Centreline ribbons fill only portions
// without a mapped surface; estimated widths must not paint over mapped banks.
export function uncoveredWaterLine(a, b, areas) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), cuts = [0, 1], epsilon = 1e-8;
    const cross = (x, z, u, v) => x * v - z * u;
    const point = t => [a[0] + dx * t, a[1] + dz * t];
    const rings = area => [area.outer, ...(area.holes || [])];
    const insideRing = (p, ring) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const u = ring[j], v = ring[i];
            if ((u[1] > p[1]) !== (v[1] > p[1]) && p[0] < (v[0] - u[0]) * (p[1] - u[1]) / (v[1] - u[1]) + u[0]) inside = !inside;
        }
        return inside;
    };
    const boundary = (p, ring) => ring.some((u, i) => {
        const v = ring[(i + 1) % ring.length], ux = v[0] - u[0], uz = v[1] - u[1], l2 = ux * ux + uz * uz;
        const t = l2 ? Math.max(0, Math.min(1, ((p[0] - u[0]) * ux + (p[1] - u[1]) * uz) / l2)) : 0;
        return Math.hypot(p[0] - u[0] - t * ux, p[1] - u[1] - t * uz) <= epsilon;
    });
    const candidates = areas.filter(area => area.outer?.length >= 3 && !(area.x1 < Math.min(a[0], b[0]) || area.x0 > Math.max(a[0], b[0]) || area.z1 < Math.min(a[1], b[1]) || area.z0 > Math.max(a[1], b[1])));
    if (length > epsilon) for (const area of candidates) for (const ring of rings(area)) for (let i = 0; i < ring.length; i++) {
        const u = ring[i], v = ring[(i + 1) % ring.length], ex = v[0] - u[0], ez = v[1] - u[1], qx = u[0] - a[0], qz = u[1] - a[1], denominator = cross(dx, dz, ex, ez);
        if (Math.abs(denominator) > epsilon) {
            const t = cross(qx, qz, ex, ez) / denominator, s = cross(qx, qz, dx, dz) / denominator;
            if (t >= 0 && t <= 1 && s >= 0 && s <= 1) cuts.push(t);
        } else if (Math.abs(cross(qx, qz, dx, dz)) <= epsilon) {
            for (const p of [u, v]) { const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (length * length); if (t > 0 && t < 1) cuts.push(t); }
        }
    }
    cuts.sort((x, y) => x - y);
    const outside = [], covered = [];
    for (let i = 1; i < cuts.length; i++) {
        const start = cuts[i - 1], end = cuts[i]; if ((end - start) * length <= epsilon) continue;
        const p = point((start + end) / 2), owners = candidates.filter(area => (insideRing(p, area.outer) && !(area.holes || []).some(h => insideRing(p, h))) || rings(area).some(ring => boundary(p, ring)));
        const span = { a: point(start), b: point(end), length: (end - start) * length };
        if (owners.length) covered.push({ ...span, sourceIds: owners.map(area => area.sourceId).filter(Boolean) }); else outside.push(span);
    }
    return { outside, covered, length, coveredLength: covered.reduce((sum, span) => sum + span.length, 0) };
}
