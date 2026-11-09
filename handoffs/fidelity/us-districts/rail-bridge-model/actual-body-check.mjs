import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';

const [nativeFile, runtimeRoot, gradeRoot, output, vertexOutput] = process.argv.slice(2);
if (!output) throw new Error('native.json runtimeRoot gradeRoot output.json required');
const imp = p => import(pathToFileURL(path.join(runtimeRoot, p)));
const [THREE, { Traffic }, { makeVehicle }, { buildTramNetwork }, { buildTramGrades }] = await Promise.all([
    imp('game/vendor/three.module.min.js'), imp('game/src/traffic.js'), imp('game/src/vehicles.js'), imp('game/src/tram-path.js'), import(pathToFileURL(path.join(gradeRoot, 'game/src/tram-grade.js'))),
]);
const bytes = fs.readFileSync(nativeFile), native = JSON.parse(bytes), grade = buildTramGrades(native.data, { coreEdges: native.allEdges });
const nodes = [...new Map(native.allEdges.flatMap(e => [e.a, e.b]).map(n => [n.id, n])).values()];
const net = buildTramNetwork(native.data, { motorNodes: nodes, resolveGrade: grade.resolveGrade });
const toV = p => new THREE.Vector3(...p);
const box = vertices => new THREE.Box3().setFromPoints(vertices);
const road = native.renderedContext.filter(m => /^(road|solid) /.test(m.name)).flatMap(mesh => mesh.vertices.map(t => {
    const vertices = t.vertices.map(toV); return { mesh: mesh.name, triangle: t.triangle, vertices, box: box(vertices) };
}));
const point = new THREE.Vector3(), direction = new THREE.Vector3(), ray = new THREE.Ray();
const intersect = (a, b) => {
    for (const [edges, target] of [[a, b], [b, a]]) for (let k = 0; k < 3; k++) {
        const p = edges[k], q = edges[(k + 1) % 3], length = direction.subVectors(q, p).length();
        if (length < 1e-8) continue;
        ray.set(p, direction.clone().multiplyScalar(1 / length));
        const hit = ray.intersectTriangle(...target, false, point);
        if (hit && hit.distanceTo(p) < length - 1e-7 && hit.distanceTo(p) > 1e-7) return hit.toArray();
    }
    return null;
};
const result = [], worldVertexReports = [];
for (const fixture of [{ source: 'w205971103', segment: 20, t: .8431372549019608 }, { source: 'w205971103', segment: 27, t: .8181818181818182 }]) for (const kind of ['tram-v3a', 'tram-imperio']) {
    const edge = net.edges.find(e => e.sourceId === fixture.source && e.sourceSegment === fixture.segment), mesh = makeVehicle(kind, undefined, { city: 'bucharest', instanced: true });
    const dir = edge.railDirections[0], v = { edge, dir, s: (dir > 0 ? fixture.t : 1 - fixture.t) * edge.len, tram: true, long: true, length: mesh.userData.length, width: mesh.userData.width,
        mesh, route: [], hist: [], speed: 0, lane: 0, laneCur: 0, latExtraCur: 0, lateralExtra: 0, latBlend: 0, y: .24 };
    const traffic = Object.create(Traffic.prototype); traffic.ensureRoute(v); traffic.placeOnLane(v, true, 0); mesh.updateMatrixWorld(true);
    const geo = mesh.userData._model.geo, attr = geo.attributes.position;
    const vertices = Array.from({ length: attr.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld));
    if (vertexOutput) worldVertexReports.push({ fixture, kind, actualNativePose: { x: v.x, y: v.y, z: v.z, heading: v.heading, pitch: mesh.rotation.x }, worldVertices: vertices.map(p => p.toArray()) });
    const bodyBox = box(vertices), candidates = road.filter(r => r.box.intersectsBox(bodyBox)), contacts = [];
    const indexes = geo.index?.array || Uint32Array.from(vertices.map((_, i) => i));
    for (let i = 0; i < indexes.length; i += 3) {
        const body = [vertices[indexes[i]], vertices[indexes[i + 1]], vertices[indexes[i + 2]]], bodyBounds = box(body);
        for (const r of candidates) if (bodyBounds.intersectsBox(r.box)) {
            const hit = intersect(body, r.vertices);
            if (hit && contacts.length < 30) contacts.push({ point: hit, bodyTriangle: i / 3, contextMesh: r.mesh, contextTriangle: r.triangle, contextVertices: r.vertices.map(v => v.toArray()) });
        }
    }
    result.push({ fixture, kind, actualNativePose: { x: v.x, y: v.y, z: v.z, heading: v.heading, pitch: mesh.rotation.x }, emittedVertices: vertices.length,
        emittedBounds: { min: bodyBox.min.toArray(), max: bodyBox.max.toArray() }, candidateContextTriangles: candidates.length, contacts, passed: contacts.length === 0 });
    mesh.userData._model.geo; // Shared fleet geometry ownership remains with its native module.
}
const report = { sourceNativeCommit: native.sourceCommit, nativeExportSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    consumedSourcesSha256: Object.fromEntries([
        ...['game/src/traffic.js', 'game/src/vehicles.js', 'game/src/tram-path.js', 'game/vendor/three.module.min.js'].map(p => [path.join(runtimeRoot, p), crypto.createHash('sha256').update(fs.readFileSync(path.join(runtimeRoot, p))).digest('hex')]),
        ...['game/src/tram-grade.js', 'game/src/tram-grade-models.js'].map(p => [path.join(gradeRoot, p), crypto.createHash('sha256').update(fs.readFileSync(path.join(gradeRoot, p))).digest('hex')]),
    ]),
    scope: 'CPU actual native Traffic pose and emitted fleet triangles against immutable native road/solid context triangles. This proves positive intersections; omitted context/props prevent a whole-scene negative acceptance.',
    gradeModel: grade.report, result, passed: result.every(r => r.passed) };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
if (vertexOutput) fs.writeFileSync(vertexOutput, JSON.stringify({ nativeExportSha256: report.nativeExportSha256, consumedSourcesSha256: report.consumedSourcesSha256, cases: worldVertexReports }, null, 2) + '\n');
console.log(JSON.stringify(result.map(r => ({ fixture: r.fixture, kind: r.kind, pose: r.actualNativePose, contacts: r.contacts.length, first: r.contacts[0] })), null, 2));
