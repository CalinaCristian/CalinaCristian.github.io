// Procedural landmark geometry invariants. No browser, downloaded images, or reference-derived attributes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { collideBuildings } from '../../game/src/world-collide.js';
const url = new URL('../../game/src/landmarks.js', import.meta.url);
const source = (await fs.readFile(url, 'utf8')).replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, url).href}'`) + '\nexport { Builder };';
const { Builder, LANDMARKS, buildLandmark } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const ring = [[0, 0], [24, 0], [24, 20], [16, 20], [16, 10], [0, 10]], hole = [[4, 3], [9, 3], [9, 7], [4, 7]];
const b = new Builder(); b.shift(13, -8); b.colPolygon(ring, { holes: [hole], y0: 2, y1: 14 });
const c = b.cols[0]; c.r = Math.hypot(c.hw, c.hd);
assert.equal(collideBuildings([c], 19, -3, 0.3, 3), null, 'Courtyard remains clear');
assert.equal(collideBuildings([c], 15, 9, 0.3, 3), null, 'Concave outside notch remains clear');
assert(collideBuildings([c], 15, -3, 0.3, 3), 'Solid west wing blocks');
assert(collideBuildings([c], 17.1, -3, 0.3, 3), 'Courtyard inner wall blocks finite body');
assert.equal(collideBuildings([c], 15, -3, 0.3, 1), null, 'Underside is open');
assert.equal(collideBuildings([c], 15, -3, 0.3, 15), null, 'Above roof is open');
let checks = 6;
for (const mansard of [false, true]) {
    const roof = new Builder(); roof.sourceRoof(ring, 6, 3, '#888888', 4, { holes: [hole], mansard });
    const p = roof.bk.m.p, n = roof.bk.m.n, edges = new Map(); let projectedArea = 0, raised = false;
    const point = i => p.slice(i, i + 3), key = p => p.map(v => v.toFixed(6)).join(',');
    for (let i = 0; i < p.length; i += 9) {
        const [a, c, d] = [point(i), point(i + 3), point(i + 6)];
        assert([...a, ...c, ...d].every(Number.isFinite));
        assert(n[i + 1] > 0, 'All roof normals face up');
        projectedArea += Math.abs((c[0] - a[0]) * (d[2] - a[2]) - (c[2] - a[2]) * (d[0] - a[0])) / 2;
        for (const v of [a, c, d]) { assert(v[1] >= 6 && v[1] <= 9); if (v[1] > 7) raised = true; }
        for (const [u, v] of [[a, c], [c, d], [d, a]]) { const k = [key(u), key(v)].sort().join('|'); edges.set(k, (edges.get(k) || 0) + 1); }
        checks += 3;
    }
    assert(Math.abs(projectedArea - (24 * 10 + 8 * 10 - 5 * 4)) < 1e-5, 'Projected roof covers source solid exactly, including courtyard hole');
    assert(raised, 'Roof has sloping volume');
    for (const [edge, count] of edges) {
        assert(count === 1 || count === 2, 'No duplicated overlapping roof triangles');
        if (count === 1) assert(edge.split('|').every(v => Math.abs(+v.split(',')[1] - 6) < 1e-5), 'Only source eaves may be unshared; no interior cracks/T-junctions');
        checks++;
    }
}
const models = [];
for (const lm of LANDMARKS) {
    const model = buildLandmark(lm, { realScale: true }); let triangles = 0;
    model.mesh.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position;
        assert(Array.from(p.array).every(Number.isFinite), `${lm.id}: finite geometry`); assert(o.geometry.attributes.normal, `${lm.id}: normals`);
        triangles += (o.geometry.index?.count ?? p.count) / 3; checks += 2; });
    assert.equal(triangles, model.triangles, `${lm.id}: triangle accounting`); checks++;
    models.push({ id: lm.id, triangles, collision: model.collision.length });
}
console.log(JSON.stringify({ passed: true, checks, models }, null, 2));
