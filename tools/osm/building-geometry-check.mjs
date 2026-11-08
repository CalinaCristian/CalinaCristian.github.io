#!/usr/bin/env node
// Source-data regression: conservative assemblies preserve all footprint area,
// mapped parts keep their vertical bands, and complex roofs triangulate fully.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseFiles } from './parse-osm.mjs';
import { assembleRings, footprintMargin, polyCentroid } from './geom.mjs';
import * as THREE from '../../game/vendor/three.module.min.js';
import { footprintCells, footprintCoverage, exposedWall, insetFootprint, ringArea, simpleFootprint, assemblySignature, touchingSolids, geometryRing } from '../../game/src/building-parts.js';
import { collideBuildings, buildingBlocksRoad as worldBuildingBlocksRoad } from '../../game/src/world.js';
import { buildingBlocksRoad as harnessBuildingBlocksRoad } from '../../game/dev/harness/visual/page/geometry.js';
import { sourceRing } from './source-footprints.mjs';
import { parseMeasure } from '../../game/src/building-roofs.js';
const close = (a, b, label) => assert.ok(Math.abs(a - b) < Math.max(1e-5, Math.abs(b) * 1e-8), `${label}: ${a} != ${b}`);
const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
assert.deepEqual(sourceRing([[0,0],[.04,0],[.04,1],[0,1],[0,0]]).ring, [[0,0],[.04,0],[.04,1],[0,1]], 'a four-centimetre structural strip retains its complete positive-area footprint');
assert.deepEqual(sourceRing([[0,0],[2,0],[2,1],[0,1],[0,0]]).ring, [[0,0],[2,0],[2,1],[0,1]], 'a two-square-metre source building is not a minimum-area casualty');
assert.equal(sourceRing([[0,0],[1,0],[2,0],[0,0]]).reason, 'zero-source-area');
assert.equal(sourceRing([[0,0],[4,4],[0,4],[3,0],[0,0]]).reason, 'self-intersecting-source-ring');
close(footprintMargin([[-20,-1],[20,-1],[20,1],[-20,1]], {pieces:[{pts:[[0,-20],[0,20]],r:2}]}), -2, 'crossing edges enter a band despite distant vertices');
close(footprintMargin(square, {circles:[{x:5,z:5,r:1}]}), -1, 'contained circle intersects the source footprint');
close(footprintMargin(square, {circles:[{x:5,z:5,r:1}]}, [[[2,2],[8,2],[8,8],[2,8]]]), 2, 'a core circle inside a courtyard does not touch the building');
close(footprintMargin(square, {polys:[[[20,0],[30,0],[30,10],[20,10]]]}), 10, 'polygon edge gap is exact');
assert.ok(footprintMargin(square, {polys:[[[-1,4],[11,4],[11,6],[-1,6]]]}) <= 0, 'crossing source/core edges intersect without contained vertices');
close(footprintCoverage(square, [[[0, 0], [9.999, 0], [9.999, 10], [0, 10]]]).uncovered, 0.01, 'sub-centimetre gap survives subdivision');
close(footprintCoverage(square, [square, square]).uncovered, 0, 'overlapping parts count once');
close(footprintCoverage(square, [[[9, 0], [11, 0], [11, 10], [9, 10]]]).outside, 10, 'outside area is exact');
const wall = exposedWall([0, 0], [10, 0], 0, 20, 0, 1, [{ ring: square, minH: 5, h: 12 }]);
assert.deepEqual(wall.map(f => [f.y0, f.y1]), [[0, 5], [12, 20]], 'part underside/top split the visible parent wall');
assert.equal(exposedWall([0, 0], [10, 0], 0, 20, 0, -1, [{ ring: square, minH: 0, h: 20, i: 1 }], 2).length, 0, 'coincident exterior faces have one stable owner');
assert.equal(exposedWall([0, 0], [10, 0], 0, 20, 0, -1, [{ ring: square, minH: 0, h: 20, i: 2 }], 1).length, 1, 'the earlier exterior face remains visible');
for (const check of [worldBuildingBlocksRoad, harnessBuildingBlocksRoad]) {
    assert.equal(check({ poly: square, h: 10 }, 5, 5, 0.24), true, 'a real ground building over a road remains a finding');
    assert.equal(check({ poly: square, minH: 4.8, h: 5.2 }, 5, 5, 0.24), false, 'a vehicle fits under the reviewed open canopy');
    assert.equal(check({ poly: square, minH: 4.8, h: 5.2 }, 5, 5, 4.8), true, 'the roof band still blocks a road at its level');
    assert.equal(check({ poly: square, minH: 1.8, h: 2.2 }, 5, 5, 0.24), true, 'a low underside does not clear the vehicle body');
    assert.equal(check({ poly: square, h: 5 }, 5, 5, 10), false, 'a deck above the roof does not touch the building');
    const opening = { poly: square, h: 10, passageSolids: [{ y0: 0, y1: 3.34, polys: [[[0,0],[2,0],[2,10],[0,10]], [[8,0],[10,0],[10,10],[8,10]]] }, { y0: 3.34, y1: 10, polys: [square] }] };
    assert.equal(check(opening, 5, 5, .24), false, 'the mapped low void clears the road vehicle');
    assert.equal(check(opening, 1, 5, .24), true, 'source side posts remain a real road contact');
    assert.equal(check(opening, 5, 5, 3.5), true, 'the upper source body remains solid');
    const court = { poly: square, holes: [[[2,2],[8,2],[8,8],[2,8]]], h: 10 };
    assert.equal(check(court, 5, 5, 0.24), false, 'a mapped courtyard passage stays open');
    assert.equal(check(court, 1, 5, 0.24), true, 'a solid courtyard wing over a road remains a finding');
}
const raised = { x: 5, z: 5, r: 8, poly: square, minH: 9, h: 20 };
assert.equal(collideBuildings([raised], 5, 5, 0.4, 0.24), null, 'a sourced elevated passage is traversable');
assert.ok(collideBuildings([raised], 5, 5, 0.4, 9), 'the upper source volume collides');
const file = process.argv.find(a => a.startsWith('--data='))?.slice(7) || 'game/data/bucharest-romana.json';
const data = JSON.parse(fs.readFileSync(file));
const rings = data.buildings.map((b, i) => { let x = 0, z = 0; const r = []; for (let j = 9; j < b.length; j += 2) { x += b[j]; z += b[j + 1]; r.push([x / 10, z / 10]); } return data.buildingFootprints?.[i] || r; });
rings.forEach((r, i) => assert.ok(simpleFootprint(r), `source footprint ${data.buildingIds?.[i] || 'legacy-index:' + i} stays simple after preparation`));
const report = { file, sourceRecords: data.buildings.length, assemblies: [], roofs: { checked: 0, inset: 0, fallback: [] } };
const used = new Set();
for (const [key, spec] of Object.entries(data.buildingAssemblies || {})) {
    const i = +key, partRings = spec.parts.map(p => rings[p]);
    for (const p of spec.parts) { assert.ok(!used.has(p), 'part has a unique enclosing outline'); used.add(p); const dimensions = data.buildingDimensions?.[p] || [data.buildings[p][1] / 10, data.buildings[p][2] / 10]; assert.ok(dimensions[0] >= dimensions[1], 'precise source part band never inverts'); if (dimensions[0] === dimensions[1]) { assert.ok(data.buildingSourceIssues?.[p]?.some(v => v.startsWith('zero vertical source band')), 'literal zero-band source has an explicit anomaly'); const raw = data.buildingRoofProfiles?.[p]?.originalOSM || data.buildingRoofProfiles?.[p]?.raw; assert.ok(raw && parseMeasure(raw.height) === dimensions[0] && parseMeasure(raw.min_height) === dimensions[1], 'zero band is the unchanged literal source, never an invented thickness'); } }
    const cells = footprintCells(rings[i], partRings), residuals = cells.filter(c => !c.covered.length).map(c => c.ring);
    const volume = i => ({ i, ring: rings[i], holes: [], h: data.buildingRoofProfiles?.[i]?.eavesM ?? data.buildingDimensions?.[i]?.[0] ?? data.buildings[i][1] / 10, roofProfile: data.buildingRoofProfiles?.[i], minH: data.buildingDimensions?.[i]?.[1] ?? data.buildings[i][2] / 10 });
    assert.equal(spec.geometry.signature, assemblySignature(volume(i), spec.parts.map(volume)), 'offline geometry cache matches every source vertex and height');
    assert.equal(spec.geometry.surfaces.length, spec.parts.length + spec.geometry.residuals.length + (spec.mode === 'union' ? 1 : 0));
    assert.ok(spec.geometry.surfaces.every(s => s.walls.every(w => w.every(f => f.y1 > f.y0))), 'cached wall bands never invert');
    const cov = footprintCoverage(rings[i], partRings);
    close(cells.reduce((s, c) => s + ringArea(c.ring), 0), Math.abs(ringArea(rings[i])), 'no missing projected area');
    close(residuals.reduce((s, r) => s + ringArea(r), 0), cov.uncovered, 'residuals retain every outline strip');
    close(footprintCoverage(rings[i], [...partRings, ...residuals]).uncovered, 0, 'no new holes');
    assert.ok((spec.mode === 'union' || spec.sourceCoverage >= 0.9) && spec.sourceOutsideArea <= spec.parts.length * 0.1);
    assert.ok(spec.residualHeightDm >= 0 && !data.buildingHoles?.[i]);
    if (spec.mode === 'parts') close(spec.geometry.residuals.reduce((sum, p) => sum + Math.abs(ringArea(geometryRing(p.ring, data.buildingGeometryPoints))), 0), cov.uncovered, 'cached residuals leave no void');
    else assert.equal(spec.geometry.residuals.length, 0, 'partial parts retain their complete source base body');
    report.assemblies.push({ source: data.buildingIds?.[i] || 'legacy-index:' + i, mode: spec.mode, parts: spec.parts.map(p => data.buildingIds?.[p] || 'legacy-index:' + p), residualArea: cov.uncovered, residualHeight: spec.residualHeightM ?? spec.residualHeightDm / 10 });
}
const physical = rings.map((ring, i) => ({ i, ring, holes: data.buildingHoleFootprints?.[i] || data.buildingHoles?.[i] || [], h: data.buildingRoofProfiles?.[i]?.eavesM ?? data.buildingDimensions?.[i]?.[0] ?? data.buildings[i][1] / 10, roofProfile: data.buildingRoofProfiles?.[i], minH: data.buildingDimensions?.[i]?.[1] ?? data.buildings[i][2] / 10 }));
for (const [key, spec] of Object.entries(data.buildingAssemblies || {})) {
    if (spec.mode === 'parts') physical[+key].suppressed = true;
    for (const r of spec.geometry.residuals) physical.push({ i: physical.length, ring: geometryRing(r.ring, data.buildingGeometryPoints), holes: [], h: r.h, minH: 0 });
}
for (const key of Object.keys(data.buildingCoveredBy || {})) physical[+key].suppressed = true;
for (const s of data.buildingUnions?.sources || []) { assert.ok(physical[s.i] && !physical[s.i].suppressed); assert.equal(s.signature, assemblySignature(physical[s.i], []), 'physical union keeps exact local source identity'); }
const surfaceIds = new Set();
for (const s of data.buildingUnions?.surfaces || []) {
    assert.ok(!surfaceIds.has(s.i)); surfaceIds.add(s.i); const b = physical[s.i];
    assert.equal(s.surface.walls.length, b.ring.length);
    assert.ok(s.surface.walls.every(w => w.every(f => f.t1 > f.t0 && f.y1 > f.y0)), 'physical face bands are non-folding');
    for (const i of s.neighbours) assert.ok(touchingSolids(b, physical[i]), 'visibility neighbours physically touch without claiming source association');
    for (const roof of [...s.surface.roof, ...s.surface.underside]) assert.ok(ringArea(geometryRing(roof, data.buildingGeometryPoints)) > 0, 'every exposed cap retains positive projected area');
}
report.physicalUnionSurfaces = surfaceIds.size;
for (let i = 0; i < rings.length; i++) {
    if (!['hipped', 'gabled', 'pyramid', 'mansard'].includes(data.roofs[data.buildings[i][3]])) continue;
    const r = rings[i], area = Math.abs(ringArea(r)), inset = insetFootprint(r);
    report.roofs.checked++;
    if (inset) {
        const sg = Math.sign(ringArea(r)); let strips = 0;
        for (let k = 0; k < r.length; k++) {
            const j = (k + 1) % r.length;
            for (const tri of [[r[k], r[j], inset.p[j]], [r[k], inset.p[j], inset.p[k]]]) { const a = ringArea(tri) * sg; assert.ok(a > 0, 'no folded roof strip'); strips += a; }
        }
        close(strips + Math.abs(ringArea(inset.p)), area, 'complete roof projected coverage'); report.roofs.inset++;
    } else {
        const tris = THREE.ShapeUtils.triangulateShape(r.map(p => new THREE.Vector2(...p)), []);
        close(tris.reduce((s, t) => s + Math.abs(ringArea(t.map(j => r[j]))), 0), area, 'fallback pitched triangulation covers footprint');
        report.roofs.fallback.push(data.buildingIds?.[i] || 'legacy-index:' + i);
    }
}
if (process.argv.includes('--baseline')) {
    const old = JSON.parse(execFileSync('git', ['show', '7349ab4:' + file], { maxBuffer: 8e6 }));
    const oldIds = new Map(old.buildingIds.map((id, i) => [id, i])), ids = new Map(data.buildingIds.map((id, i) => [id, i]));
    const missing = [...oldIds.keys()].filter(id => !ids.has(id)); assert.deepEqual(missing, [], 'every original source identity survives');
    const counts = a => a.reduce((m, id) => m.set(id, (m.get(id) || 0) + 1), new Map());
    for (const [id, n] of counts(old.buildingIds)) assert.ok(counts(data.buildingIds).get(id) >= n, 'all source relation outer rings survive: ' + id);
    const added = [...ids.keys()].filter(id => !oldIds.has(id));
    const unchanged = ['roads', 'nodes', 'nodeFlags', 'trees', 'treeInfo', 'areas', 'scenery', 'parking', 'green', 'backdrop'];
    const semantic = (d, field) => field === 'areas' ? d.areas.map(a => [a[0], d.strings[a[1]] || '', ...a.slice(2)]) : field === 'treeInfo' ? d.treeInfo.map((v, i) => i % 3 === 0 ? d.strings[v] || '' : v) : d[field];
    for (const field of unchanged) assert.deepEqual(semantic(data, field), semantic(old, field), field + ' remains exact, resolving shifted string indices');
    report.originalSourceIdentities = oldIds.size; report.addedSourceParts = added.length;
    report.preciseFootprints = Object.keys(data.buildingFootprints || {}).map(i => data.buildingIds[i]);
    report.exactDimensions = Object.keys(data.buildingDimensions || {}).length;
    report.sourceFieldsUnchanged = unchanged;

}
const osmDir = process.argv.find(a => a.startsWith('--osm='))?.slice(6);
if (osmDir) {
    const osm = parseFiles(fs.readdirSync(osmDir).filter(f => f.endsWith('.xml')).sort().map(f => path.join(osmDir, f)));
    const source = id => (id?.[0] === 'w' ? osm.ways : osm.rels).get(+id?.slice(1));
    const numeric = parseMeasure;
    const rawRing = (id, index) => {
        const object = source(id); if (!object) return null;
        const chains = id[0] === 'w' ? [object.nodes] : assembleRings(object.members.filter(m => m.type === 'way' && m.role !== 'inner').map(m => osm.ways.get(m.ref)?.nodes).filter(Boolean)).rings;
        const candidates = chains.filter(r => r?.length >= 4 && r.every(n => osm.nodes.has(n))).map(r => r.slice(0, -1).map(n => { const [la, lo] = osm.nodes.get(n); return [(lo - data.proj.lon0) * data.proj.mPerLon * data.proj.scale, -(la - data.proj.lat0) * data.proj.mPerLat * data.proj.scale]; }));
        if (candidates.length <= 1) return candidates[0] || null;
        // A relation can contain several separate outer buildings with the same source ID. Match its prepared outer.
        const centre = polyCentroid;
        const c = centre(rings[index]);
        return candidates.sort((a, b) => { const p = centre(a), q = centre(b); return Math.hypot(p[0] - c[0], p[1] - c[1]) - Math.hypot(q[0] - c[0], q[1] - c[1]); })[0];
    };
    const box = r => [Math.min(...r.map(p => p[0])), Math.min(...r.map(p => p[1])), Math.max(...r.map(p => p[0])), Math.max(...r.map(p => p[1]))];
    const sourceBases = data.buildingIds.flatMap((id, i) => { const t = source(id)?.tags, ring = rawRing(id, i); return t && !t['building:part'] && !(data.buildingDimensions?.[i]?.[1] ?? data.buildings[i][2] / 10) && !data.buildingCoveredBy?.[i] && !data.buildingHoles?.[i] && ring && simpleFootprint(ring) ? [{ i, ring, box: box(ring) }] : []; });
    let explicitHeights = 0, explicitMinima = 0, sourceParts = 0;
    data.buildingIds.forEach((id, i) => {
        const t = source(id)?.tags; if (!t) return;
        const h = data.buildingDimensions?.[i]?.[0] ?? data.buildings[i][1] / 10, minH = data.buildingDimensions?.[i]?.[1] ?? data.buildings[i][2] / 10;
        if (t['building:part'] && t['building:part'] !== 'no') sourceParts++;
        if (Number.isFinite(numeric(t.height)) && numeric(t.height) > 0) { close(h, numeric(t.height), 'literal height ' + id); explicitHeights++; }
        if (Number.isFinite(numeric(t.min_height)) && numeric(t.min_height) < h) { close(minH, numeric(t.min_height), 'literal minimum ' + id); explicitMinima++; }
        if (Number.isFinite(numeric(t.height)) && numeric(t.height) <= 0) assert.ok(data.buildingSourceIssues?.[i]?.some(v => v.startsWith('nonpositive OSM height=')), 'nonpositive height remains a source anomaly: ' + id);
        const canopy = data.buildingCanopies?.[i];
        if (canopy) {
            assert.ok(canopy.evidence?.length && canopy.classificationSource, 'canopy classification has an explicit source record');
            close(h, canopy.topM, 'canopy roof top ' + id); close(minH, canopy.clearanceM, 'canopy underside ' + id);
            assert.ok(h > minH && minH > 0, 'canopy remains a positive roof band');
            const body = { x: 0, z: 0, r: 1e6, poly: rings[i], minH, h };
            const c = rings[i][0];
            assert.equal(collideBuildings([body], c[0], c[1], 0.1, 0.24), null, 'open canopy keeps ground passage');
            assert.ok(collideBuildings([body], c[0], c[1], 0.1, minH), 'canopy roof band remains collidable');
        }
    });
    for (const [key, spec] of Object.entries(data.buildingAssemblies || {})) {
        const parent = source(data.buildingIds[key]); assert.ok(parent && !parent.tags?.['building:part']);
        for (const i of spec.parts) {
            assert.ok(source(data.buildingIds[i])?.tags?.['building:part'], 'assembly members are real OSM parts');
            const ring = rawRing(data.buildingIds[i], i), b = box(ring);
            const candidates = sourceBases.filter(p => b[0] >= p.box[0] - 0.001 && b[1] >= p.box[1] - 0.001 && b[2] <= p.box[2] + 0.001 && b[3] <= p.box[3] + 0.001 && footprintCoverage(p.ring, [ring]).outside <= 0.1);
            assert.deepEqual(candidates.map(p => p.i), [+key], 'raw XML geometry has one unambiguous parent: ' + data.buildingIds[i]);
        }
        const cov = footprintCoverage(rawRing(data.buildingIds[key], +key), spec.parts.map(i => rawRing(data.buildingIds[i], i)));
        close(cov.outside, spec.sourceOutsideArea, 'recorded raw outside area');
        assert.ok(Math.abs((1 - cov.uncovered / cov.area) - spec.sourceCoverage) < 1e-7, 'raw coverage record remains reproducible');
    }
    if (process.argv.includes('--baseline')) {
        const old = JSON.parse(execFileSync('git', ['show', '7349ab4:' + file], { maxBuffer: 8e6 })), oldIds = new Set(old.buildingIds);
        for (const id of data.buildingIds.filter(id => !oldIds.has(id))) assert.ok(source(id)?.tags?.['building:part'], 'new records are mapped parts, not invented structures');
        const queues = new Map(); data.buildingIds.forEach((id, i) => queues.set(id, [...(queues.get(id) || []), i]));
        const header = (d, i) => { const b = d.buildings[i], info = d.buildingInfo.slice(i * 5, i * 5 + 5); return [d.styles[b[0]], ...b.slice(1, 4), d.strings[b[4]] || '', ...b.slice(5, 7), d.strings[b[7]] || '', d.strings[b[8]] || '', d.strings[info[0]] || '', info[1], d.strings[info[2]] || '', d.strings[info[3]] || '', info[4]]; };
        let unchangedOutlines = 0;
        old.buildingIds.forEach((id, i) => {
            const j = queues.get(id).shift(), t = source(id)?.tags;
            if (t?.['building:part'] && t['building:part'] !== 'no') return;
            assert.deepEqual(header(data, j), header(old, i), 'source outline semantics remain exact: ' + id);
            if (id !== 'w182932596') assert.deepEqual(data.buildings[j].slice(9), old.buildings[i].slice(9), 'source outline corners remain exact: ' + id);
            else { const decode = b => { let x = 0, z = 0; const p = []; for (let k = 9; k < b.length; k += 2) { x += b[k]; z += b[k + 1]; p.push([x, z]); } return p.sort((a, b) => a[0] - b[0] || a[1] - b[1]); }; assert.deepEqual(decode(data.buildings[j]), decode(old.buildings[i]), 'boundary-order repair preserves every prepared corner position'); }
            assert.deepEqual(data.buildingHoles?.[j], old.buildingHoles?.[i], 'source courtyard rings remain exact: ' + id);
            unchangedOutlines++;
        });
        report.originalOutlineRecordsUnchanged = unchangedOutlines;
    }
    report.rawSource = { sourceParts, explicitHeights, explicitMinima, tiles: fs.readdirSync(osmDir).filter(f => f.endsWith('.xml')).length };
}
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
