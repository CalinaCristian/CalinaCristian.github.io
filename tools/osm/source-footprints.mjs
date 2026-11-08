// Source geometry validation shared by the district builder and its regression fixtures.
// Removing a repeated closing/consecutive point changes neither the boundary nor its topology.
import { simpleFootprint } from '../../game/src/building-parts.js';

export function sourceRing(points) {
    if (!Array.isArray(points) || points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) return { reason: 'nonfinite-coordinate' };
    const ring = points.filter((p, i) => !i || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]).map(p => [...p]);
    if (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
    if (ring.length < 3) return { reason: 'fewer-than-three-distinct-vertices' };
    const area = Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    if (area <= 1e-8) return { reason: 'zero-source-area' };
    if (!simpleFootprint(ring)) return { reason: 'self-intersecting-source-ring' };
    return { ring, area };
}
