// Inferred facade/roof dressing never owns a surface inside a neighbouring
// source building. Source footprints, roofs, courtyards and colliders stay put.
import { visibleRoofMesh } from './building-roofs.js';
const finite = Number.isFinite;
const validFace = face => Array.isArray(face) && face.length === 3 && face.every(p => Array.isArray(p) && p.length >= 3 && p.every(finite));
const emitted = face => face.map(p => { const q = p.slice(); q[0] = Math.fround(q[0]); q[1] = Math.fround(q[1]); q[2] = Math.fround(q[2]); return q; });
// the emitted faces of a neighbour's complete roof, once per roof mesh (the same neighbour is met by many owners)
const emittedCache = new WeakMap(), emittedFaces = mesh => { let f = emittedCache.get(mesh); if (!f) emittedCache.set(mesh, f = mesh.faces.map(emitted)); return f; };
const SEPARATE = 1e-6, faceBox = face => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of face) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); } return [x0, x1, z0, z1]; };
const area = ([a,b,c]) => Math.hypot((b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;

/** Pure triangle/attribute clipping, for inferred dressing only.
 * neighbours[].mesh.faces must describe the COMPLETE source roof, including
 * actual holes, before visibility clipping against any other building. minH
 * is the source body's lower bound. Coordinates share the MeshBuilder frame.
 * Source-facing queries use the same Float32 representation as emitted meshes,
 * rather than a geometric inset, height change or depth bias. All additional
 * per-vertex attributes are interpolated through exact splits.
 */
export function clipInferredBuildingDetail(faces, owner, neighbours, { inferred = false } = {}) {
    if (!inferred) return { faces, clippedAreaM2: 0, issues: [], scope: 'literal/source faces retained' };
    const issues = [];
    if (!Number.isInteger(owner?.i) || !owner.sourceId || !Array.isArray(faces) || !faces.every(validFace)) return { faces, clippedAreaM2: 0, issues: [{ reason: 'unknown-detail-owner-or-geometry' }] };
    const occluders = [];
    for (const other of neighbours || []) {
        if (other?.i === owner.i) continue;
        if (!Number.isInteger(other?.i) || !other.sourceId || !finite(other.minH) || !Array.isArray(other.mesh?.faces) || !other.mesh.faces.length || !other.mesh.faces.every(validFace)) {
            issues.push({ reason: 'unknown-complete-neighbour-source-roof', i: other?.i, sourceId: other?.sourceId });
            continue;
        }
        occluders.push({ i: other.i, minH: other.minH, mesh: { faces: emittedFaces(other.mesh) } });
    }
    if (!occluders.length) return { faces, clippedAreaM2: 0, issues };
    const input = faces.map(emitted);
    // A literal source solid wins equal-height ownership over all inferred
    // dressing, independently of the relative source record order.
    // visibleRoofMesh tests every face against every occluder face; an occluder face whose box lies more than SEPARATE
    // (≫ its EPS of 1e-8 m) away from a face's box leaves every piece of that face unchanged, so each face is passed only
    // the occluder faces near it, in their original order: the same pieces, without the quadratic scan.
    // occluder faces in a 4 m grid by their box (grown by SEPARATE); a face's candidates are the faces listed in the
    // cells under its box, deduplicated and put back in their original (occluder, face) order before the exact test
    const flat = [], grid = new Map(), G = 4, key = (i, j) => i * 1048576 + j;
    occluders.forEach((o, k) => o.mesh.faces.forEach((f, j) => {
        const b = faceBox(f), n = flat.length; flat.push({ k, f, b });
        for (let i = Math.floor((b[0] - SEPARATE) / G); i <= Math.floor((b[1] + SEPARATE) / G); i++) for (let m = Math.floor((b[2] - SEPARATE) / G); m <= Math.floor((b[3] + SEPARATE) / G); m++) { const c = key(i, m); let l = grid.get(c); if (!l) grid.set(c, l = []); l.push(n); }
    }));
    const clipped = [];
    for (const face of input) {
        const [x0, x1, z0, z1] = faceBox(face), ids = new Set();
        for (let i = Math.floor(x0 / G); i <= Math.floor(x1 / G); i++) for (let m = Math.floor(z0 / G); m <= Math.floor(z1 / G); m++) for (const n of grid.get(key(i, m)) || []) ids.add(n);
        const near = [];
        for (const n of [...ids].sort((p, q) => p - q)) {
            const { k, f, b } = flat[n];
            if (b[1] < x0 - SEPARATE || b[0] > x1 + SEPARATE || b[3] < z0 - SEPARATE || b[2] > z1 + SEPARATE) continue;
            const last = near[near.length - 1];
            if (last && last.k === k) last.mesh.faces.push(f); else near.push({ k, i: occluders[k].i, minH: occluders[k].minH, mesh: { faces: [f] } });
        }
        clipped.push(...visibleRoofMesh({ faces: [face], walls: [] }, { i: Infinity }, near).faces);
    }
    const before = input.reduce((s, f) => s + area(f), 0), after = clipped.reduce((s, f) => s + area(f), 0);
    return { faces: clipped, clippedAreaM2: Math.max(0, before - after), issues };
}
