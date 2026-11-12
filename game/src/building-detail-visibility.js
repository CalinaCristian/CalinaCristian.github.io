// Inferred facade/roof dressing never owns a surface inside a neighbouring
// source building. Source footprints, roofs, courtyards and colliders stay put.
import { visibleRoofMesh } from './building-roofs.js';
const finite = Number.isFinite;
const validFace = face => Array.isArray(face) && face.length === 3 && face.every(p => Array.isArray(p) && p.length >= 3 && p.every(finite));
const emitted = face => face.map(p => p.map((v, i) => i < 3 ? Math.fround(v) : v));
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
    const boxes = occluders.map(o => o.mesh.faces.map(faceBox)), clipped = [];
    for (const face of input) {
        const [x0, x1, z0, z1] = faceBox(face), near = [];
        occluders.forEach((o, k) => {
            const keep = o.mesh.faces.filter((f, j) => { const b = boxes[k][j]; return !(b[1] < x0 - SEPARATE || b[0] > x1 + SEPARATE || b[3] < z0 - SEPARATE || b[2] > z1 + SEPARATE); });
            if (keep.length) near.push({ i: o.i, minH: o.minH, mesh: { faces: keep } });
        });
        clipped.push(...visibleRoofMesh({ faces: [face], walls: [] }, { i: Infinity }, near).faces);
    }
    const before = input.reduce((s, f) => s + area(f), 0), after = clipped.reduce((s, f) => s + area(f), 0);
    return { faces: clipped, clippedAreaM2: Math.max(0, before - after), issues };
}
