import assert from 'node:assert/strict';
import * as THREE from '../../game/vendor/three.module.min.js';
import { collideBuildings } from '../../game/src/world.js';
import { parseMeasure, makeRoofProfile, parseRoofDirection, validRoofProfile, roofMesh, visibleRoofMesh, roofSignature } from '../../game/src/building-roofs.js';
const close = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const triangulate = (outer, holes = []) => ({ pts: outer.concat(...holes), tris: THREE.ShapeUtils.triangulateShape(outer.map(p => new THREE.Vector2(...p)), holes.map(r => r.map(p => new THREE.Vector2(...p)))) });
for (const [raw, metres] of [['10', 10], ['10 m', 10], ["10ft", 3.048], ["10' 6\"", 3.2004], ['6 in', 0.1524], ['80 cm', 0.8], ['35mm', 0.035], ['2.5 metres', 2.5], ['-2 ft', -0.6096]]) close(parseMeasure(raw), metres);
for (const raw of ['', null, '10-12', '10;12', '~10m', '10 storeys', '10 fathoms', '10m garbage', '1,500']) assert.ok(Number.isNaN(parseMeasure(raw)), raw);
assert.equal(parseRoofDirection('NE'), 45); assert.equal(parseRoofDirection('360'), 0); assert.equal(parseRoofDirection('90°'), 90); assert.equal(parseRoofDirection('1;2'), null);
const rectangle = [[0, 0], [20, 0], [20, 10], [0, 10]];
let profile = makeRoofProfile({ tags: { height: '9', 'roof:height': '3', 'roof:shape': 'gabled' }, ring: rectangle, height: 9, heightIsTotal: true, heightSource: 'OSM height' });
close(profile.totalM, 9); close(profile.eavesM, 6); close(profile.riseM, 3); assert.ok(validRoofProfile(profile, 9));
profile = makeRoofProfile({ tags: { height: '30ft', 'roof:angle': '45', 'roof:direction': 'N', 'roof:shape': 'gabled' }, ring: rectangle, height: parseMeasure('30ft'), heightIsTotal: true });
close(profile.riseM, 5); close(profile.eavesM, 4.144); close(profile.axis[0], 0); close(profile.axis[1], -1);
const priority = makeRoofProfile({ tags: { 'roof:height': '2ft', 'roof:angle': '45', 'roof:levels': '2' }, ring: rectangle, shape: 'gabled', height: 8 });
close(priority.riseM, 0.6096); close(priority.eavesM, 8); close(priority.totalM, 8.6096);
const flat = makeRoofProfile({ ring: rectangle, height: 0.8, heightIsTotal: true }); close(flat.totalM, 0.8); close(flat.eavesM, 0.8);
const zeroAngle = makeRoofProfile({ tags: { 'roof:angle': '0' }, ring: rectangle, shape: 'gabled', height: 9, heightIsTotal: true }); close(zeroAngle.riseM, 0); close(zeroAngle.eavesM, 9); assert.equal(zeroAngle.angle, 0); assert.equal(zeroAngle.riseSource, 'OSM roof:angle'); assert.equal(zeroAngle.issues, undefined);
const across = makeRoofProfile({ tags: { 'roof:orientation': 'across', 'roof:angle': '45' }, ring: rectangle, shape: 'gabled', height: 6 }); close(across.riseM, 10);
const hip = makeRoofProfile({ tags: { 'roof:height': '3' }, ring: rectangle, shape: 'hipped', height: 9, heightIsTotal: true }), hipMesh = roofMesh(rectangle, [], hip, triangulate); close(hipMesh.heightAt(5, 5), 9); close(hipMesh.heightAt(15, 5), 9); close(hipMesh.heightAt(1, 5), 6.6);
const surveyedRectangle = [[0, 0], [8, 0.02], [20, 0], [20, 5], [20, 10], [14, 9.98], [0, 10], [0, 6]];
const surveyedHip = makeRoofProfile({ tags: { 'roof:height': '3', 'roof:direction': 'N' }, ring: surveyedRectangle, shape: 'hipped', height: 9, heightIsTotal: true }), surveyedMesh = roofMesh(surveyedRectangle, [], surveyedHip, triangulate);
for (const [x, z] of [[5, 5], [10, 5], [15, 5], [10, 1], [10, 9]]) close(surveyedMesh.heightAt(x, z), hipMesh.heightAt(x, z));
const irregularAngle = makeRoofProfile({ tags: { 'roof:angle': '45' }, ring: [[0, 0], [20, 0], [20, 6], [6, 6], [6, 20], [0, 20]], holes: [], triangulate, shape: 'hipped', height: 9, heightIsTotal: true }); assert.ok(irregularAngle.riseM < 4, 'concave angle used bounding width instead of actual eaves distance');
const unknown = makeRoofProfile({ tags: { 'roof:shape': 'sawtooth' }, ring: rectangle, height: 10 }); assert.ok(unknown.issues.some(s => s.includes('unsupported roof:shape'))); assert.equal(unknown.raw['roof:shape'], 'sawtooth');
const barrel = makeRoofProfile({ tags: { 'roof:shape': 'round', 'roof:direction': 'N', 'roof:height': '1' }, ring: rectangle, height: 4, heightIsTotal: true }), barrelMesh = roofMesh(rectangle, [], barrel, triangulate);
close(barrel.totalM, 4); close(barrel.eavesM, 3); close(barrelMesh.heightAt(10, 5), 4); close(barrelMesh.heightAt(1, 5), 4); close(barrelMesh.heightAt(10, 0), 3); assert.equal(barrel.issues, undefined);
const fixtures = [
    { name: 'rectangle', ring: rectangle, holes: [], area: 200 },
    { name: 'L', ring: [[0, 0], [20, 0], [20, 6], [6, 6], [6, 20], [0, 20]], holes: [], area: 204 },
    { name: 'U', ring: [[0, 0], [20, 0], [20, 20], [14, 20], [14, 6], [6, 6], [6, 20], [0, 20]], holes: [], area: 288 },
    { name: 'court', ring: [[0, 0], [20, 0], [20, 20], [0, 20]], holes: [[[6, 6], [6, 14], [14, 14], [14, 6]]], area: 336 },
    { name: 'thin-part', ring: [[0, 0], [20, 0], [20, 0.15], [0, 0.15]], holes: [], area: 3 },
];
for (const fixture of fixtures) for (const shape of ['flat', 'gabled', 'skillion', 'hipped', 'mansard', 'dome', 'round']) {
    const p = makeRoofProfile({ tags: { 'roof:height': '3', 'roof:direction': '35' }, ring: fixture.ring, shape, height: 9, heightIsTotal: true });
    const mesh = roofMesh(fixture.ring, fixture.holes, p, triangulate), edges = new Map();
    let area = 0, maxHeight = -Infinity;
    for (const triangle of mesh.faces) {
        const [a, b, c] = triangle;
        area += Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 2;
        for (const vertex of triangle) { assert.ok(vertex.every(Number.isFinite)); maxHeight = Math.max(maxHeight, vertex[1]); assert.ok(vertex[1] >= p.eavesM - 1e-8 && vertex[1] <= p.totalM + 1e-8); close(mesh.heightAt(vertex[0], vertex[2]), vertex[1]); }
        for (let i = 0; i < 3; i++) { const a = triangle[i], b = triangle[(i + 1) % 3], key = [a, b].map(v => v.map(n => n.toFixed(7)).join(',')).sort().join('|'); edges.set(key, (edges.get(key) || 0) + 1); }
    }
    close(area, fixture.area); close(maxHeight, p.totalM);
    assert.ok([...edges.values()].every(n => n <= 2), `${fixture.name}/${shape}: duplicate interior roof face`);
    if (fixture.holes.length) assert.equal(mesh.heightAt(10, 10), null, `${fixture.name}/${shape}: courtyard filled`);
    if (shape === 'hipped') assert.ok(mesh.faces.some(t => t.some(v => v[1] > p.eavesM + 1)), `${fixture.name}: roof flattened`);
}
console.log('building roof fixtures: strict units, total/eaves, height priority, direction/orientation, L/U/courtyard and thin part passed');
const body = (i, ring, height, shape, minimum = 0) => { const roofProfile = makeRoofProfile({ tags: { 'roof:height': shape === 'flat' ? 0 : 3 }, ring, shape, height, minHeight: minimum, heightIsTotal: true }); return { i, ring, holes: [], h: height, minH: minimum, roofProfile, mesh: roofMesh(ring, [], roofProfile, triangulate) }; };
const lower = body(0, rectangle, 9, 'gabled'), higher = body(1, [[5, -2], [15, -2], [15, 12], [5, 12]], 12, 'flat');
const clipped = visibleRoofMesh(lower.mesh, lower, [higher]);
let clippedArea = 0;
for (const [a, b, c] of clipped.faces) { const x = (a[0] + b[0] + c[0]) / 3; assert.ok(x <= 5 + 1e-7 || x >= 15 - 1e-7, 'hidden lower roof still drawn'); clippedArea += Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 2; }
close(clippedArea, 100);
const identical = body(2, rectangle, 9, 'gabled'); assert.equal(visibleRoofMesh(identical.mesh, identical, [lower]).faces.length, 0); close(visibleRoofMesh(lower.mesh, lower, [identical]).faces.reduce((sum, [a, b, c]) => sum + Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 2, 0), 200);
const overhead = body(3, rectangle, 15, 'flat', 12); close(visibleRoofMesh(lower.mesh, lower, [overhead]).faces.reduce((sum, [a, b, c]) => sum + Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 2, 0), 200);
assert.equal(roofSignature(lower), roofSignature({ ...lower, h: 9.00000001 })); assert.notEqual(roofSignature(lower), roofSignature({ ...lower, roofProfile: { ...lower.roofProfile, riseM: 2 } }));
const collider = { x: 10, z: 5, r: 12, poly: rectangle, holes: [], minH: 0, h: 9, y0: 0, y1: 9, roofHeightAt: lower.mesh.heightAt };
assert.ok(collideBuildings([collider], 10, 5, 0.35, 8 - 0.35, 0.7), 'drone should hit actual ridge');
assert.equal(collideBuildings([collider], 10, 1, 0.35, 8 - 0.35, 0.7), null, 'drone blocked by imaginary total-height roof box');
assert.equal(collideBuildings([collider], 10, -0.1, 0.35, 8 - 0.35, 0.7), null, 'drone blocked above eaves outside footprint');
assert.equal(collideBuildings([{ ...collider, minH: 6, y0: 6 }], 10, 5, 0.35, 5.2 - 0.35, 0.7), null, 'drone below source underside');
assert.ok(collideBuildings([{ ...collider, minH: 6, y0: 6 }], 10, 5, 0.35, 5.8 - 0.35, 0.7), 'drone intersects source underside');
assert.ok(collideBuildings([{ ...collider, minH: 1.9, y0: 1.9 }], 10, 5, 0.45, 0.24), 'car/foot body intersects low overhead solid');
console.log('roof source-solid fixtures: overlap clipping, equal-plane ownership, elevated parts and cache signature passed');

const zeroSourceBand=makeRoofProfile({tags:{height:'15',min_height:'15','roof:shape':'flat'},ring:[[0,0],[10,0],[10,10],[0,10]],height:15,minHeight:15,heightIsTotal:true});
assert.equal(zeroSourceBand.totalM,15);assert.equal(zeroSourceBand.eavesM,15);assert.equal(zeroSourceBand.riseM,0);assert(zeroSourceBand.issues.some(s=>s.startsWith('zero vertical source band')));
