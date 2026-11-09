// Inferred facade/roof dressing never owns a surface inside a neighbouring
// source building. Source footprints, roofs, courtyards and colliders stay put.
import { visibleRoofMesh } from './building-roofs.js';
const finite = Number.isFinite;
const validFace = face => Array.isArray(face) && face.length === 3 && face.every(p => Array.isArray(p) && p.length >= 3 && p.every(finite));
const emitted = face => face.map(p => p.map((v, i) => i < 3 ? Math.fround(v) : v));
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
        occluders.push({ i: other.i, minH: other.minH, mesh: { faces: other.mesh.faces.map(emitted) } });
    }
    if (!occluders.length) return { faces, clippedAreaM2: 0, issues };
    const input = faces.map(emitted);
    // A literal source solid wins equal-height ownership over all inferred
    // dressing, independently of the relative source record order.
    const clipped = visibleRoofMesh({ faces: input, walls: [] }, { i: Infinity }, occluders).faces;
    const before = input.reduce((s, f) => s + area(f), 0), after = clipped.reduce((s, f) => s + area(f), 0);
    return { faces: clipped, clippedAreaM2: Math.max(0, before - after), issues };
}
