// Exact planar subdivision of simple OSM footprints. Every vertex and segment
// intersection is a slice boundary, so narrow residual strips are retained.
const EPS = 1e-8;
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const ringArea = r => r.reduce((s, p, i) => s + cross(p, r[(i + 1) % r.length]), 0) / 2;
export function insideRing(p, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j];
        if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
}
const edgesOf = ring => ring.map((a, i) => [a, ring[(i + 1) % ring.length]]).filter(([a, b]) => Math.hypot(...sub(b, a)) > EPS);
const insideSolid = (p, solid) => insideRing(p, solid.ring) && !(solid.holes || []).some(hole => insideRing(p, hole));
const ownsBefore = (other, owner) => {
    const rank = typeof owner === 'number' ? 0 : (owner.surfacePriority ?? 0), index = typeof owner === 'number' ? owner : owner.i, otherRank = other.surfacePriority ?? 0;
    return otherRank < rank || otherRank === rank && other.i < index;
};
const boundsCache = new WeakMap();
const boundsOf = ring => {
    if (!boundsCache.has(ring)) boundsCache.set(ring, [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1])), Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))]);
    return boundsCache.get(ring);
};
const overlaps = (a, b) => a[0] <= b[2] + EPS && a[2] >= b[0] - EPS && a[1] <= b[3] + EPS && a[3] >= b[1] - EPS;
const unique = values => values.sort((a, b) => a - b).filter((x, i, a) => !i || x - a[i - 1] > EPS);
export function footprintCells(outline, parts = []) {
    const box = boundsOf(outline), relevant = parts.map((ring, i) => ({ ring, i })).filter(p => overlaps(box, boundsOf(p.ring)));
    const rings = [outline, ...relevant.map(p => p.ring)], edges = rings.flatMap(edgesOf), cuts = edges.map(([a]) => a[0]);
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
        const [a, b] = edges[i], [c, d] = edges[j], u = sub(b, a), v = sub(d, c), den = cross(u, v);
        if (Math.abs(den) < EPS) continue;
        const t = cross(sub(c, a), v) / den, w = cross(sub(c, a), u) / den;
        if (t > 0 && t < 1 && w > 0 && w < 1) cuts.push(a[0] + u[0] * t);
    }
    const xs = unique(cuts), result = [];
    const at = ([a, b], x) => a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    for (let i = 1; i < xs.length; i++) {
        const x0 = xs[i - 1], x1 = xs[i], x = (x0 + x1) / 2;
        const hits = edges.filter(([a, b]) => (a[0] > x) !== (b[0] > x)).sort((a, b) => at(a, x) - at(b, x));
        for (let k = 1; k < hits.length; k++) {
            const low = hits[k - 1], high = hits[k], z0 = at(low, x), z1 = at(high, x), p = [x, (z0 + z1) / 2];
            if (z1 - z0 < EPS || !insideRing(p, outline)) continue;
            const ring = [[x0, at(low, x0)], [x1, at(low, x1)], [x1, at(high, x1)], [x0, at(high, x0)]];
            if (ringArea(ring) > EPS) result.push({ ring, covered: relevant.flatMap(({ ring, i }) => insideRing(p, ring) ? [i] : []) });
        }
    }
    return result;
}
export function footprintCoverage(outline, parts) {
    const cells = footprintCells(outline, parts), area = Math.abs(ringArea(outline));
    const uncovered = cells.reduce((s, c) => s + (c.covered.length ? 0 : ringArea(c.ring)), 0);
    // Union outside the parent is computed once per independent part cell.
    let outside = 0;
    parts.forEach((part, i) => {
        for (const c of footprintCells(part, [outline, ...parts.slice(0, i)])) if (!c.covered.length) outside += ringArea(c.ring);
    });
    return { area, uncovered: Math.max(0, uncovered), outside: Math.max(0, outside) };
}
// Visible pieces of a vertical face after unioning the assembly's solid volumes.
// Splitting at all projected crossings also handles partially coincident walls.
export function exposedWall(a, b, y0, y1, nx, nz, others, owner = Infinity) {
    if (y1 - y0 <= EPS) return [];
    const box = [Math.min(a[0], b[0]) - 2e-5, Math.min(a[1], b[1]) - 2e-5, Math.max(a[0], b[0]) + 2e-5, Math.max(a[1], b[1]) + 2e-5];
    others = others.filter(o => o.h > y0 && (o.minH || 0) < y1 && overlaps(box, boundsOf(o.ring)));
    const u = sub(b, a), l2 = u[0] ** 2 + u[1] ** 2, cuts = [0, 1];
    if (l2 < EPS) return [];
    for (const o of others) for (const [c, d] of [o.ring, ...(o.holes || [])].flatMap(edgesOf)) {
        const v = sub(d, c), den = cross(u, v);
        if (Math.abs(den) > EPS) {
            const t = cross(sub(c, a), v) / den, w = cross(sub(c, a), u) / den;
            if (t > 0 && t < 1 && w >= -EPS && w <= 1 + EPS) cuts.push(t);
        } else if (Math.abs(cross(sub(c, a), u)) < EPS * Math.sqrt(l2)) {
            for (const p of [c, d]) { const q = sub(p, a), t = (q[0] * u[0] + q[1] * u[1]) / l2; if (t > 0 && t < 1) cuts.push(t); }
        }
    }
    const ts = unique(cuts), faces = [];
    for (let i = 1; i < ts.length; i++) {
        const t0 = ts[i - 1], t1 = ts[i], t = (t0 + t1) / 2;
        const p = [a[0] + u[0] * t + nx * 1e-5, a[1] + u[1] * t + nz * 1e-5];
        let bands = [[y0, y1]];
        for (const o of others) if (insideSolid(p, o) || (ownsBefore(o, owner) && insideSolid([p[0] - nx * 2e-5, p[1] - nz * 2e-5], o))) {
            bands = bands.flatMap(([lo, hi]) => [[lo, Math.min(hi, o.minH || 0)], [Math.max(lo, o.h), hi]].filter(([l, h]) => h - l > EPS));
        }
        for (const [lo, hi] of bands) faces.push({ t0, t1, y0: lo, y1: hi });
    }
    return faces;
}

// Mitred roof inset with explicit non-folding strip validation.
export function insetFootprint(r, area = Math.abs(ringArea(r))) {
        const A0 = ringArea(r), s0 = A0 > 0 ? 1 : -1, n = r.length; let res = null;
        const segX = (p, q, u, v) => { const d = (q[0] - p[0]) * (v[1] - u[1]) - (q[1] - p[1]) * (v[0] - u[0]); if (Math.abs(d) < 1e-9) return false; const t = ((u[0] - p[0]) * (v[1] - u[1]) - (u[1] - p[1]) * (v[0] - u[0])) / d, w = ((u[0] - p[0]) * (q[1] - p[1]) - (u[1] - p[1]) * (q[0] - p[0])) / d; return t > 1e-3 && t < 1 - 1e-3 && w > 1e-3 && w < 1 - 1e-3; };
        for (let d = Math.max(1.2, Math.min(4.5, Math.sqrt(Math.abs(area)) * 0.2)); d >= 0.04 && !res; d *= 0.6) {
            const p = [];
            for (let i = 0; i < n; i++) {
                const a = r[(i - 1 + n) % n], b2 = r[i], c2 = r[(i + 1) % n];
                const l1 = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1, l2 = Math.hypot(c2[0] - b2[0], c2[1] - b2[1]) || 1;
                const n1 = [-s0 * (b2[1] - a[1]) / l1, s0 * (b2[0] - a[0]) / l1], n2 = [-s0 * (c2[1] - b2[1]) / l2, s0 * (c2[0] - b2[0]) / l2]; // inward normals
                let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz); if (ml < 1e-6) { mx = n1[0]; mz = n1[1]; } else { mx /= ml; mz /= ml; }
                const k = d / Math.max(0.35, mx * n1[0] + mz * n1[1]); p.push([b2[0] + mx * k, b2[1] + mz * k]);
            }
            const A1 = ringArea(p); if (Math.sign(A1) !== s0 || Math.abs(A1) < Math.abs(A0) * 0.12) continue;
            let bad = false; for (let i = 0; i < n && !bad; i++) for (let j = i + 2; j < n && !bad; j++) { if (i === 0 && j === n - 1) continue; if (segX(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) bad = true; }
            if (!bad && p.some(q => !insideRing(q, r))) bad = true;
            for (let i = 0; i < n && !bad; i++) {
                const j = (i + 1) % n, a = r[i], b2 = r[j], u = p[i], v = p[j];
                if ((b2[0] - a[0]) * (v[0] - u[0]) + (b2[1] - a[1]) * (v[1] - u[1]) <= 0) { bad = true; break; }
                for (const t of [0.25, 0.5, 0.75]) if (!insideRing([u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t], r) || !insideRing([a[0] + (u[0] - a[0]) * t, a[1] + (u[1] - a[1]) * t], r)) { bad = true; break; }
            }
            // Both triangles of every strip must face upward and retain area.
            // A flipped strip was still accepted by centroid/edge samples alone.
            for (let i = 0; i < n && !bad; i++) {
                const j = (i + 1) % n;
                for (const tri of [[r[i], r[j], p[j]], [r[i], p[j], p[i]]]) if (ringArea(tri) * s0 <= 1e-9) bad = true;
            }
            if (!bad) res = { p, d };
        }
    return res;
}

export function simpleFootprint(ring) {
    const edges = edgesOf(ring);
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
        const [a, b] = edges[i], [c, d] = edges[j], u = sub(b, a), v = sub(d, c), den = cross(u, v);
        if (Math.abs(den) < EPS) continue;
        const t = cross(sub(c, a), v) / den, w = cross(sub(c, a), u) / den;
        const adjacent = j === i + 1 || (i === 0 && j === edges.length - 1);
        if (!adjacent && t > EPS && t < 1 - EPS && w > EPS && w < 1 - EPS) return false;
    }
    for (let i = 0; i < ring.length; i++) {
        const a = ring[(i + ring.length - 1) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length], u = sub(b, a), v = sub(c, b);
        if (Math.abs(cross(u, v)) < EPS && u[0] * v[0] + u[1] * v[1] < -EPS) return false;
    }
    return true;
}

// Local clearance can move a notch past a neighbouring edge. Restore the simple
// boundary order by reversing only the crossed run; all corner positions remain.
// Valid source rings are returned untouched.
export function uncrossFootprint(ring) {
    const r = ring.map(p => [...p]);
    for (let pass = 0; pass < r.length * r.length; pass++) {
        let changed = false;
        for (let i = 0; i < r.length && !changed; i++) for (let j = i + 2; j < r.length; j++) {
            if (i === 0 && j === r.length - 1) continue;
            const a = r[i], b = r[(i + 1) % r.length], c = r[j], d = r[(j + 1) % r.length], u = sub(b, a), v = sub(d, c), den = cross(u, v);
            if (Math.abs(den) < EPS) continue;
            const t = cross(sub(c, a), v) / den, w = cross(sub(c, a), u) / den;
            if (t > EPS && t < 1 - EPS && w > EPS && w < 1 - EPS) {
                r.splice(i + 1, j - i, ...r.slice(i + 1, j + 1).reverse()); changed = true; break;
            }
        }
        if (!changed) break;
    }
    return r;
}

// Exact cache identity. Runtime validation is linear in source vertices; planar
// subdivision belongs in the offline data build, not the game loading path.
export function assemblySignature(base, parts) {
    return JSON.stringify([base, ...parts].map(b => [b.i, Math.round((b.roofProfile?.eavesM ?? b.h) * 1e4), Math.round(b.minH * 1e4), b.ring.map(p => p.map(v => Math.round(v * 1e4))), (b.holes || []).map(r => r.map(p => p.map(v => Math.round(v * 1e4))))]));
}
export function bakeAssembly(base, parts, residualHeight, adjacentGround, keepOutline = false) {
    const ground = parts.filter(p => p.minH === 0);
    const distance = (p, ring) => Math.min(...edgesOf(ring).map(([a, b]) => {
        const u = sub(b, a), q = sub(p, a), den = u[0] ** 2 + u[1] ** 2;
        const t = den ? Math.max(0, Math.min(1, (q[0] * u[0] + q[1] * u[1]) / den)) : 0;
        return Math.hypot(p[0] - a[0] - t * u[0], p[1] - a[1] - t * u[1]);
    }));
    const residuals = (keepOutline ? [] : footprintCells(base.ring, parts.map(p => p.ring))).filter(c => !c.covered.length).map((c, n) => {
        const centre = c.ring.reduce((s, p) => [s[0] + p[0] / c.ring.length, s[1] + p[1] / c.ring.length], [0, 0]);
        const near = adjacentGround ? ground.reduce((best, p) => { const d = distance(centre, p.ring); return !best || d < best.d ? { d, h: p.h } : best; }, null) : null;
        return { ring: c.ring, h: near?.h ?? residualHeight, minH: 0, i: 1e7 + n };
    });
    const volumes = keepOutline ? [base, ...parts] : [...parts, ...residuals];
    return { signature: assemblySignature(base, parts), residuals: residuals.map(({ ring, h }) => ({ ring, h })), surfaces: bakeSurfaces(volumes) };
}

// Source association and physical visibility are separate. Adjacent/overlapping
// solids can share an interior face without being one enclosing OSM assembly.
export function touchingSolids(a, b) {
    if (!overlaps(boundsOf(a.ring), boundsOf(b.ring)) || a.h < b.minH - EPS || b.h < a.minH - EPS) return false;
    if (a.ring.some(p => insideSolid(p, b)) || b.ring.some(p => insideSolid(p, a))) return true;
    for (const [p, q] of [a.ring, ...(a.holes || [])].flatMap(edgesOf)) for (const [r, s] of [b.ring, ...(b.holes || [])].flatMap(edgesOf)) {
        const u = sub(q, p), v = sub(s, r), den = cross(u, v), d = sub(r, p);
        if (Math.abs(den) > EPS) { const t = cross(d, v) / den, w = cross(d, u) / den; if (t > EPS && t < 1 - EPS && w > EPS && w < 1 - EPS) return true; }
        else if (Math.abs(cross(d, u)) < EPS * Math.hypot(...u)) {
            const axis = Math.abs(u[0]) > Math.abs(u[1]) ? 0 : 1;
            if (Math.min(Math.max(p[axis], q[axis]), Math.max(r[axis], s[axis])) - Math.max(Math.min(p[axis], q[axis]), Math.min(r[axis], s[axis])) > EPS) return true;
        }
    }
    return false;
}

export function bakeSurfaces(volumes) {
    return volumes.map(b => bakeSurface(b, volumes));
}
export function bakeSurface(b, volumes) {
        const sg = Math.sign(ringArea(b.ring));
        const walls = b.ring.map((a, k) => {
            const p = b.ring[(k + 1) % b.ring.length], u = sub(p, a), length = Math.hypot(...u) || 1;
            return exposedWall(a, p, b.minH > 0 ? b.minH : 0.18, b.h, sg * u[1] / length, -sg * u[0] / length, volumes.filter(p => p !== b), b.i);
        });
        const topMasks = volumes.filter(p => p !== b && p.minH <= b.h + EPS && (p.h > b.h + EPS || (p.h >= b.h - EPS && p.i < b.i))).map(p => p.ring);
        const roof = footprintCells(b.ring, topMasks).filter(c => !c.covered.length).map(c => c.ring);
        const bottomMasks = b.minH > 0 ? volumes.filter(p => p !== b && p.h >= b.minH - EPS && (p.minH < b.minH - EPS || (p.minH <= b.minH + EPS && p.i < b.i))).map(p => p.ring) : [];
        const underside = b.minH > 0 ? footprintCells(b.ring, bottomMasks).filter(c => !c.covered.length).map(c => c.ring) : [];
    return { walls, roof, underside };
}

// Physical surface ownership is independent of an OSM building:part tag.
// h denotes the actual vertical BODY/eaves bound, not a pitched roof's maximum.
// Full source roof planes keep their existing separate visibility contract.
export function bakeSourceSolidSurface(b, volumes) {
    const others = volumes.filter(p => p !== b);
    const wallsFor = (ring, hole = false) => {
        const sg = Math.sign(ringArea(ring)) * (hole ? -1 : 1);
        return ring.map((a, i) => {
            const p = ring[(i + 1) % ring.length], u = sub(p, a), length = Math.hypot(...u) || 1;
            return exposedWall(a, p, b.minH > 0 ? b.minH : Math.min(.18, b.h), b.h, sg * u[1] / length, -sg * u[0] / length, others, b);
        });
    };
    const visibleHorizontal = occluders => {
        const masks = [...(b.holes || [])], ownHoles = masks.length, bands = [];
        for (const o of occluders) {
            const outer = masks.push(o.ring) - 1, holes = (o.holes || []).map(h => masks.push(h) - 1);
            bands.push({ outer, holes });
        }
        return footprintCells(b.ring, masks).filter(c => {
            const covered = new Set(c.covered);
            return !Array.from({ length: ownHoles }, (_, i) => i).some(i => covered.has(i)) && !bands.some(o => covered.has(o.outer) && !o.holes.some(i => covered.has(i)));
        }).map(c => c.ring);
    };
    const top = others.filter(p => p.minH <= b.h + EPS && (p.h > b.h + EPS || p.h >= b.h - EPS && ownsBefore(p, b)));
    const bottom = b.minH > 0 ? others.filter(p => p.h >= b.minH - EPS && (p.minH < b.minH - EPS || p.minH <= b.minH + EPS && ownsBefore(p, b))) : [];
    return { walls: wallsFor(b.ring), holeWalls: (b.holes || []).map(r => wallsFor(r, true)), roof: visibleHorizontal(top), underside: b.minH > 0 ? visibleHorizontal(bottom) : [] };
}

export const geometryRing = (ring, points) => points ? ring.map(i => points[i]) : ring;
export const geometrySurface = (surface, points) => points ? { walls: surface.walls, ...(surface.holeWalls ? { holeWalls: surface.holeWalls } : {}), roof: surface.roof.map(r => geometryRing(r, points)), underside: surface.underside.map(r => geometryRing(r, points)) } : surface;
