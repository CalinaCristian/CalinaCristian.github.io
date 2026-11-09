// CPU consumption of immutable native buffers. No WebGL, runtime actor moves,
// source edits or changed collision tolerances. See README for bounded scope.
import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import * as THREE from '../../../../game/vendor/three.module.min.js';
import { MeshBuilder } from '../../../../game/src/geobuild.js';
import { buildTramGrades } from '../../../../game/src/tram-grade.js';
import { buildTramNetwork } from '../../../../game/src/tram-path.js';
const folder = path.resolve(process.argv[2] || new URL('./native-fixture/', import.meta.url).pathname);
const output = process.argv[3] || '/tmp/drivecv-shelter-route-check.json';
const placementImplementation = new URL(process.argv.includes('--failed-projection') ? './failed-stop-projection-model.mjs' : '../../../../game/src/source-transit-stop.js', import.meta.url);
const { sourceTransitStopPlacement, transitShelterModel } = await import(placementImplementation.href);
const require = createRequire(import.meta.url), D = require(folder + '/decode-geometry.cjs');
const raw = fs.existsSync(folder + '/native-blocker-fixture.json') ? fs.readFileSync(folder + '/native-blocker-fixture.json') : zlib.gunzipSync(fs.readFileSync(folder + '/native-blocker-fixture.json.gz')), f = JSON.parse(raw);
const data = JSON.parse(fs.readFileSync(new URL('../../../../game/data/bucharest-grozavesti.json', import.meta.url)));
const { publicTransportSources, ...original } = data;
assert.deepEqual(original, f.data, 'metadata-only append must preserve every native source field');
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceFiles = ['game/src/world.js', 'game/src/source-transit-stop.js', 'tools/osm/public-transport-sources.mjs', 'game/data/bucharest-grozavesti.json'].map(file => ({ file, sha256: hash(fs.readFileSync(new URL('../../../../' + file, import.meta.url))) }));
const report = { nativeSourceCommit: f.sourceCommit, nativeFixtureSha256: hash(raw), sourceFiles,
    placementImplementation: { file: placementImplementation.pathname, sha256: hash(fs.readFileSync(placementImplementation)) },
    scope: 'Actual captured native primary geometry, immutable original native rail source XY, and unchanged generic shelter boxes. Continuous perpendicular-separation certificate bounds every local actual primary vertex for every heading of the connected axle chord near the two shelters. Flat local source/support only. Native first-publication/static/admission/body and global drive gates remain required.',
    sourceFieldsPreserved: true, actorsMoved: 0, rngDraws: 0, placements: [], nativeLegacyMeshParity: [], nativePoseParity: [], continuousRailBody: [], actualTriangleProbes: [] };
const models = [2, 17].map(poiIndex => { const placement = sourceTransitStopPlacement(data, poiIndex); assert.equal(placement.resolved, true); report.placements.push({ poiIndex, ...placement }); return { poiIndex, placement, model: transitShelterModel(placement) }; });
const triangles = model => { const b = new MeshBuilder(); for (const p of model.boxes) b.box(p.x, p.y, p.z, p.w, p.h, p.d, p.angle, [128, 128, 128]); return Array.from({ length: b.ic / 3 }, (_, i) => [0, 1, 2].map(j => Array.from(b.p.subarray(b.i[i * 3 + j] * 3, b.i[i * 3 + j] * 3 + 3)))); };
const pointKey = p => p.map(v => Math.round(v * 10000)).join(','), triangleKey = t => t.map(pointKey).sort().join('|');
const nearProps = f.colliders.filter(c => c.kind === 'busstop' && c.x > -410 && c.x < -350 && c.z > 640 && c.z < 740);
assert.equal(nearProps.length, 8);
const legacy = [];
for (let i = 0; i < nearProps.length; i += 4) {
    const [a, mid, b, pole] = nearProps.slice(i, i + 4); assert.deepEqual([a.r, mid.r, b.r, pole.r], [.75, .75, .75, .15]);
    const ux = (b.x - a.x) / 2.6, uz = (b.z - a.z) / 2.6, nx = uz, nz = -ux;
    const side = Math.sign((pole.x - mid.x) * nx + (pole.z - mid.z) * nz);
    const frame = { x: mid.x + side * .5 * nx, z: mid.z + side * .5 * nz, angle: Math.atan2(ux, uz), side }, model = transitShelterModel(frame);
    for (let k = 0; k < 4; k++) assert.ok(Math.hypot(model.discs[k].x - nearProps[i + k].x, model.discs[k].z - nearProps[i + k].z) < 1e-9);
    legacy.push({ frame, model, triangles: triangles(model) });
}
const scene = JSON.parse(zlib.gunzipSync(fs.readFileSync(folder + '/native-canonical-scene.json.gz'))), nativeKeys = new Map();
for (const o of scene.objects.filter(o => o.name === 'solid -1,1')) {
    let g = scene.geometries[o.geometryId]; assert.ok(o.canonical?.canonicalIndex); g = { ...g, index: { itemSize: 1, count: o.canonical.sourceIndices, array: o.canonical.canonicalIndex } };
    for (const t of D.triangles(D.geometryPart(g, o.matrixWorld))) nativeKeys.set(triangleKey(t.vertices), { mesh: o.name, triangle: t.triangle });
}
for (const old of legacy) {
    const matches = old.triangles.map(t => nativeKeys.get(triangleKey(t)) || null);
    assert.equal(matches.filter(Boolean).length, 96, 'all unchanged legacy boxes must match canonical native triangles');
    report.nativeLegacyMeshParity.push({ frame: old.frame, matchedTriangles: matches.length, nativeTriangles: matches });
}
const grades = buildTramGrades(data, { coreEdges: f.allEdges }), network = buildTramNetwork(data, { resolveGrade: grades.resolveGrade });
const segDistance = (p, e) => { const t = Math.max(0, Math.min(1, ((p[0] - e.a.x) * e.dirx + (p[1] - e.a.z) * e.dirz) / e.len)); return Math.hypot(p[0] - e.a.x - e.dirx * e.len * t, p[1] - e.a.z - e.dirz * e.len * t); };
const partsPoints = m => m.boxes.flatMap(b => { const c = Math.cos(b.angle), s = Math.sin(b.angle); return [-1, 1].flatMap(u => [-1, 1].map(v => [b.x + u * b.w / 2 * c + v * b.d / 2 * s, b.z - u * b.w / 2 * s + v * b.d / 2 * c])); });
const unwrap = (h, ref) => ref + Math.atan2(Math.sin(h - ref), Math.cos(h - ref));
function maxProjection(vertices, nx, nz, lo, hi) {
    let max = -Infinity;
    for (const [x, , z] of vertices) {
        const A = nx * x + nz * z, B = nx * z - nz * x, critical = Math.atan2(B, A);
        const angles = [lo, hi]; for (let k = -3; k <= 3; k++) { const a = critical + k * 2 * Math.PI; if (a >= lo && a <= hi) angles.push(a); }
        for (const h of angles) max = Math.max(max, A * Math.cos(h) + B * Math.sin(h));
    } return max;
}
for (const actorId of [483, 484]) {
    const actor = f.actors.find(a => a.id === actorId), primary = D.attribute(f.geometryCatalog[actor.primaryGeometryId].attributes.position);
    const nativeMatrix = new THREE.Matrix4().compose(new THREE.Vector3(actor.x, actor.y, actor.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(...actor.mesh.rotation)), new THREE.Vector3(...actor.mesh.scale)).toArray();
    assert.ok(nativeMatrix.every((v, i) => Math.abs(v - actor.mesh.matrixWorld[i]) < 1e-10), 'captured parents must not add an unmodelled transform');
    const vertices = Array.from({ length: primary.count }, (_, i) => primary.get(i).map((v, j) => v * actor.mesh.scale[j]));
    const bodyRadius = Math.max(...vertices.map(p => Math.hypot(p[0], p[2]))), axleM = actor.length * .36;
    for (const sourceId of ['w660918285', 'w128304860']) for (const shelter of models) {
        const centre = shelter.placement.platformPoint, points = partsPoints(shelter.model), shelterRadius = Math.max(...points.map(p => Math.hypot(p[0] - centre[0], p[1] - centre[1])));
        const source = network.edges.filter(e => e.sourceId === sourceId), nearby = source.filter(e => segDistance(centre, e) <= bodyRadius + shelterRadius), chord = source.filter(e => segDistance(centre, e) <= bodyRadius + shelterRadius + axleM);
        assert.ok(nearby.length && chord.length); assert.ok(chord.every(e => e.grade.ya === 0 && e.grade.yb === 0 && e.railDirections.length === 1));
        // No omitted source continuation may enter the bounded chord region.
        assert.ok(chord.every(e => [e.a, e.b].every(n => n.edges.every(q => q.sourceId === sourceId || segDistance(centre, q) > bodyRadius + shelterRadius + axleM))));
        const ordered = network.allEdges.filter(e => e.sourceId === sourceId).sort((a, b) => a.sourceSegment - b.sourceSegment);
        let length = 0; const legs = ordered.map(e => { const leg = { e, lo: length, hi: length + e.len }; length += e.len; return leg; });
        const at = s => { const leg = legs.find(l => s >= l.lo - 1e-8 && s <= l.hi + 1e-8); assert.ok(leg, 'missing literal connected source span'); const t = Math.max(0, Math.min(1, (s - leg.lo) / leg.e.len)); return [leg.e.a.x + (leg.e.b.x - leg.e.a.x) * t, leg.e.a.z + (leg.e.b.z - leg.e.a.z) * t]; };
        const dir = chord[0].railDirections[0], heading = s => { const F = at(s + dir * axleM), R = at(s - dir * axleM); return Math.atan2(R[0] - F[0], R[1] - F[1]); };
        for (const p of f.proposals.filter(p => p.actorId === actorId && p.source === sourceId)) if (!report.nativePoseParity.some(r => r.actorId === actorId && r.sourceId === sourceId && r.segment === p.segment)) {
            const leg = legs.find(l => l.e.sourceSegment === p.segment), s = leg.lo + (dir > 0 ? p.s : leg.e.len - p.s), C = at(s), H = heading(s);
            const error = Math.max(Math.abs(C[0] - p.pose.x), Math.abs(C[1] - p.pose.z), Math.abs(Math.atan2(Math.sin(H - p.pose.heading), Math.cos(H - p.pose.heading))));
            assert.ok(error < 1e-8, 'continuous proof pose must reproduce original native preview');
            report.nativePoseParity.push({ actorId, sourceId, segment: p.segment, maximumPoseError: error, nativePose: p.pose });
        }
        let minimumM = Infinity; const edges = [];
        for (const leg of legs.filter(l => nearby.includes(l.e))) {
            // Split whenever either axle crosses an actual source vertex.
            // Within every resulting interval F-R is affine, so its heading
            // extrema occur at the endpoints (no zero chord is admitted).
            const cuts = [leg.lo, leg.hi];
            for (const l of legs) for (const s of [l.lo, l.hi]) for (const t of [s - axleM, s + axleM]) if (t > leg.lo && t < leg.hi) cuts.push(t);
            for (let s = leg.lo + .5; s < leg.hi; s += .5) cuts.push(s);
            cuts.sort((a, b) => a - b);
            for (let i = 1; i < cuts.length; i++) {
                const s0 = cuts[i - 1], s1 = cuts[i]; if (s1 - s0 < 1e-8) continue;
                const A = at(s0), B = at(s1), mid = at((s0 + s1) / 2), intervalRadius = Math.hypot(A[0] - B[0], A[1] - B[1]) / 2;
                if (Math.hypot(mid[0] - centre[0], mid[1] - centre[1]) > bodyRadius + shelterRadius + intervalRadius) continue;
                const h0 = heading(s0), h1 = unwrap(heading(s1), h0), lo = Math.min(h0, h1), hi = Math.max(h0, h1); assert.ok(hi - lo < Math.PI / 2);
                const e = leg.e, axes = [[e.nx, e.nz], [e.dirx, e.dirz], [Math.cos(shelter.placement.angle), -Math.sin(shelter.placement.angle)], [Math.sin(shelter.placement.angle), Math.cos(shelter.placement.angle)]];
                for (const h of [h0, h1]) axes.push([Math.cos(h), -Math.sin(h)], [Math.sin(h), Math.cos(h)]);
                let separationM = -Infinity;
                for (const [nx, nz] of axes) {
                    const obstacle = points.map(p => p[0] * nx + p[1] * nz), centers = [A[0] * nx + A[1] * nz, B[0] * nx + B[1] * nz];
                    const maxBody = Math.max(...centers) + maxProjection(vertices, nx, nz, lo, hi), minBody = Math.min(...centers) - maxProjection(vertices, -nx, -nz, lo, hi);
                    separationM = Math.max(separationM, Math.min(...obstacle) - maxBody, minBody - Math.max(...obstacle));
                }
                minimumM = Math.min(minimumM, separationM); edges.push({ sourceSegment: e.sourceSegment, s0, s1, headingRange: [lo, hi], separationM });
            }
        }
        report.continuousRailBody.push({ actorId, kind: actor.kind, sourceId, platformSourceId: shelter.placement.platformSourceId, bodyRadiusM: bodyRadius, minimumSeparationM: minimumM, clear: minimumM > 0, intervalCount: edges.length, edges });
        if (!(minimumM > 0)) {
            const part = D.geometryPart(f.geometryCatalog[actor.primaryGeometryId], new THREE.Matrix4().identity().toArray()), localTriangles = [...D.triangles(part)].map(t => t.vertices.map(p => p.map((v, i) => v * actor.mesh.scale[i])));
            for (const interval of edges.filter(e => e.separationM <= 0)) for (const s of [interval.s0, (interval.s0 + interval.s1) / 2, interval.s1]) {
                const C = at(s), h = heading(s), c = Math.cos(h), sn = Math.sin(h), contacts = [];
                for (const liftM of [0, .22]) for (const [boxIndex, b] of transitShelterModel(shelter.placement, liftM).boxes.entries()) {
                    const cb = Math.cos(b.angle), sb = Math.sin(b.angle), box = new THREE.Box3(new THREE.Vector3(-b.w / 2, 0, -b.d / 2), new THREE.Vector3(b.w / 2, b.h, b.d / 2));
                    for (const [triangleIndex, tri] of localTriangles.entries()) {
                        const vertices = tri.map(([x, y, z]) => { const dx = C[0] + c * x + sn * z - b.x, dz = C[1] - sn * x + c * z - b.z; return new THREE.Vector3(cb * dx - sb * dz, .24 + y - b.y, sb * dx + cb * dz); });
                        if (box.intersectsTriangle(new THREE.Triangle(...vertices))) { contacts.push({ triangleIndex, boxIndex, liftM, boxMaterial: b.material }); break; }
                    }
                }
                report.actualTriangleProbes.push({ actorId, sourceId, platformSourceId: shelter.placement.platformSourceId, sourceS: s, pose: { x: C[0], y: .24, z: C[1], heading: h }, contacts });
            }
        }
    }
}
report.passed = report.continuousRailBody.every(r => r.clear);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, nativeLegacyMeshParity: report.nativeLegacyMeshParity.map(r => r.matchedTriangles), continuousRailBody: report.continuousRailBody.map(({ edges, ...r }) => r) }, null, 2));
assert.equal(report.passed, true);
