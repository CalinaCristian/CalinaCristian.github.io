// Offline source-solid visibility cache; no source records or collision change.
import { assemblySignature, bakeSourceSolidSurface, simpleFootprint, touchingSolids } from './building-parts.js';
import { parseMeasure } from './building-roofs.js';
import { signatureMatches } from './district-pack.js';

export function sourceSurfaceAuthority(b) {
    const raw = b.roofProfile?.originalOSM || b.roofProfile?.raw || {};
    const literal = parseMeasure(raw.height), levels = Number(raw['building:levels']);
    const researched = (b.roofProfile?.heightSource?.startsWith('research') && b.heightSourceCode !== 2) || b.heightSourceCode === 1;
    const priority = Number.isFinite(literal) && literal > 0 ? 0 : researched ? 1 : Number.isFinite(levels) && levels > 0 ? 2 : 3;
    return { priority, signature: JSON.stringify([b.sourceId ?? null, priority, raw.height ?? null, raw['building:levels'] ?? null, b.roofProfile?.heightSource ?? null, b.heightSourceCode ?? null]) };
}

export function sourceSurfaceEligible(b) {
    const rings = [b.ring, ...(b.holes || [])];
    return !b.suppressed && !b.skip && !b.canopy && !b.aircraft && !b.passages?.length && Number.isFinite(b.h) && Number.isFinite(b.minH) && b.h > Math.max(.18, b.minH) && rings.every(r => Array.isArray(r) && r.length >= 3 && r.every(p => p.length === 2 && p.every(Number.isFinite)) && simpleFootprint(r));
}

export function buildSourceSurfaceCache(physical) {
    const active = physical.filter(sourceSurfaceEligible).map(b => ({ ...b, surfacePriority: sourceSurfaceAuthority(b).priority }));
    const neighbours = new Map(active.map(b => [b.i, []])), spatial = new Map();
    for (const b of active) {
        const box = [Math.min(...b.ring.map(p => p[0])), Math.min(...b.ring.map(p => p[1])), Math.max(...b.ring.map(p => p[0])), Math.max(...b.ring.map(p => p[1]))], seen = new Set();
        for (let x = Math.floor(box[0] / 40); x <= Math.floor(box[2] / 40); x++) for (let z = Math.floor(box[1] / 40); z <= Math.floor(box[3] / 40); z++) {
            const key = x + ',' + z, cell = spatial.get(key) || [];
            for (const other of cell) if (!seen.has(other.i)) {
                seen.add(other.i);
                if (touchingSolids(b, other)) { neighbours.get(b.i).push(other); neighbours.get(other.i).push(b); }
            }
            cell.push(b); spatial.set(key, cell);
        }
    }
    const bodies = active.filter(b => neighbours.get(b.i).length), required = new Set(bodies.flatMap(b => [b.i, ...neighbours.get(b.i).map(p => p.i)]));
    return { version: 2,
        sources: active.filter(b => required.has(b.i)).map(b => ({ i: b.i, signature: assemblySignature(b, []), authoritySignature: sourceSurfaceAuthority(b).signature })),
        surfaces: bodies.map(b => ({ i: b.i, neighbours: neighbours.get(b.i).map(p => p.i).sort((a, b) => a - b), surface: bakeSourceSolidSurface(b, [b, ...neighbours.get(b.i)]) })) };
}

export function validateSourceSurface(spec, cache, records, { eligible = sourceSurfaceEligible, requireAuthority = cache.version >= 2, points } = {}) {
    if (!spec || !Array.isArray(spec.neighbours)) return 'missing-neighbours';
    const sources = cache instanceof Map ? cache : new Map((cache.sources || []).map(s => [s.i, s]));
    const owner = records[spec.i], indices = [spec.i, ...spec.neighbours];
    for (const i of indices) {
        const b = records[i], source = sources.get(i);
        if (!b || !eligible(b)) return 'inactive-or-unsupported-source';
        if (!source || !signatureMatches(source.signature, assemblySignature(b, []))) return 'prepared-geometry-mismatch';
        if ((requireAuthority || source.authoritySignature !== undefined) && !signatureMatches(source.authoritySignature, sourceSurfaceAuthority(b).signature)) return 'prepared-authority-mismatch';
    }
    if (spec.surface?.walls?.length !== owner.ring.length || owner.holes.length && (spec.surface?.holeWalls?.length !== owner.holes.length || spec.surface.holeWalls.some((walls, i) => walls.length !== owner.holes[i].length))) return 'prepared-face-mismatch';
    const bandValid = f => f && [f.t0,f.t1,f.y0,f.y1].every(Number.isFinite) && f.t0 >= 0 && f.t1 <= 1 && f.t1 > f.t0 && f.y0 >= (owner.minH > 0 ? owner.minH : Math.min(.18, owner.h)) - 1e-7 && f.y1 <= (owner.roofProfile?.eavesM ?? owner.h) + 1e-7 && f.y1 > f.y0;
    if ([...spec.surface.walls,...(spec.surface.holeWalls || []).flat()].some(bands => !Array.isArray(bands) || !bands.every(bandValid))) return 'prepared-wall-band-mismatch';
    const validRing = ring => Array.isArray(ring) && ring.length >= 3 && ring.every(p => { const point=points ? Number.isInteger(p) && points[p] : p; return Array.isArray(point) && point.length === 2 && point.every(Number.isFinite); });
    if (![spec.surface.roof,spec.surface.underside].every(rings => Array.isArray(rings) && rings.every(validRing))) return 'prepared-cap-mismatch';
    return null;
}
