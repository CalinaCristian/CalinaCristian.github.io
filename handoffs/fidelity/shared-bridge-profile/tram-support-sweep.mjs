import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {loadFixture,compileFixture} from './replay-geometry.mjs';
import {SHARED_BRIDGE_MODELS} from '../../../game/src/shared-bridge-models.js';
import {buildTramGrades} from '../../../game/src/tram-grade.js';
import * as THREE from '../../../game/vendor/three.module.min.js';
import { Traffic } from '../../../game/src/traffic.js';
import { makeVehicle } from '../../../game/src/vehicles.js';
import { buildTramNetwork, canTravelTram, tramSpan, sampleTramPath } from '../../../game/src/tram-path.js';
import { initialTrafficStaticClearance } from '../../../game/src/initial-traffic-admission.js';

const out=process.argv[2]||'/tmp/shared-tram-support-sweep.json',F=loadFixture(),model=structuredClone(SHARED_BRIDGE_MODELS[0]),plan=compileFixture(F,{...model,c1GroundEaseM:6});
if(!plan.known)throw Error(JSON.stringify(plan.report.unresolved));
const bySource=new Map(Object.entries(F.data.roadSourceGeometry).map(([i,w])=>[w.sourceId,Number(i)]));
const native={data:F.data,allEdges:F.edges.map(e=>({...e,road:bySource.get(e.sourceId)??-1})),sourceCommit:F.source},gradeRoot='current-worker',nativeFile='source-fixture.json.gz',bytes=fs.readFileSync(new URL('./source-fixture.json.gz',import.meta.url));
const grade=buildTramGrades(native.data,{coreEdges:native.allEdges,sharedProfile:plan}),nodes=[...new Map(native.allEdges.flatMap(e=>[e.a,e.b]).map(n=>[n.id,n])).values()];
const net = buildTramNetwork(native.data, { motorNodes: nodes, resolveGrade: grade.resolveGrade });
const traffic = Object.create(Traffic.prototype); traffic.world = { tramDeckSupportAt: grade.support.at };
const meshes = ['tram-v3a', 'tram-imperio'].map(kind => ({ kind, mesh: makeVehicle(kind, undefined, { city: 'bucharest', instanced: true }) }));
const fixtures = net.edges.flatMap(edge => Array.from({ length: Math.ceil(edge.len / 5) + 1 }, (_, k, n) => ({ edge, t: k / Math.ceil(edge.len / 5) })));
// Include the exact previous Imperio/new-slab counterexample station too.
const counter = net.edges.find(e => e.sourceId === 'w314447163' && e.sourceSegment === 0);
if (counter) fixtures.push({ edge: counter, t: .15 });
const result = [], benchmarks = [], vector = new THREE.Vector3(), begin = performance.now();
for (const fixture of fixtures) for (const { kind, mesh } of meshes) {
    const edge = fixture.edge, dir = edge.railDirections[0], station = (dir > 0 ? fixture.t : 1 - fixture.t) * edge.len, span = tramSpan(edge, dir, mesh.userData.length);
    const detail = { sourceId: edge.sourceId, segment: edge.sourceSegment, sourceNodeIds: edge.sourceNodeIds, t: fixture.t, kind, dir, station, span };
    const v = { edge, dir, s: station, tram: true, long: true, length: mesh.userData.length, width: mesh.userData.width, mesh, route: [], hist: [], speed: 0, lane: 0, laneCur: 0, latExtraCur: 0, lateralExtra: 0, latBlend: 0, y: .24 };
    let current = { e: edge, dir }, covered = 0; const seen = new Set([edge.id]);
    while (covered < v.length && v.hist.length < 256) {
        const node = current.dir > 0 ? current.e.a : current.e.b;
        const choices = node.edges.filter(e => e !== current.e && !seen.has(e.id)).map(e => ({ e, dir: e.b === node ? 1 : -1 })).filter(p => canTravelTram(p.e, p.dir));
        choices.sort((a, b) => Number(b.e.sourceId === current.e.sourceId) - Number(a.e.sourceId === current.e.sourceId) || (b.e.dirx * b.dir * current.e.dirx * current.dir + b.e.dirz * b.dir * current.e.dirz * current.dir) - (a.e.dirx * a.dir * current.e.dirx * current.dir + a.e.dirz * a.dir * current.e.dirz * current.dir) || String(a.e.id).localeCompare(String(b.e.id)));
        if (!choices.length) break;
        current = choices[0]; v.hist.unshift(current); seen.add(current.e.id); covered += current.e.len;
    }
    const start = performance.now();
    try {
        traffic.ensureRoute(v);
        if (!sampleTramPath(v, v.length / 2) || !sampleTramPath(v, -v.length / 2)) { result.push({ ...detail, scope: 'Beyond literal modeled source-body path span; never a physical pass. Boundary-stop controller must keep moving center outside this interval.', passed: null }); continue; }
        traffic.placeOnLane(v, true, 0);
    }
    catch (error) { result.push({ ...detail, reason: String(error.message), passed: false }); continue; }
    const ms = performance.now() - start, p = sampleTramPath(v); mesh.updateMatrixWorld(true);
    const attr = mesh.userData._model.geo.attributes.position, ids = v.railSupport.modelIds || [], bounds = new THREE.Box3(), penetration = [];
    let minClearance = Infinity;
    for (let i = 0; i < attr.count; i++) {
        vector.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld); bounds.expandByPoint(vector);
        for (const modelId of ids) {
            const support = grade.support.at(vector.x, vector.z, { modelId }); if (!support) continue;
            const clearance = vector.y - support.top; minClearance = Math.min(minClearance, clearance);
            if (clearance < -1e-7 && penetration.length < 3) penetration.push({ vertex: i, point: vector.toArray(), top: support.top, clearance });
        }
    }
    const sourceErrorM = Math.hypot(v.x - p.x, v.z - p.z);
    let ownSlabStaticControl = null;
    if (edge.sourceId === 'w314447163' && edge.sourceSegment === 0 && fixture.t === .15) {
        const pieces = [...new Set(ids.flatMap(modelId => grade.support.inBox(bounds.min.x, bounds.min.z, bounds.max.x, bounds.max.z, { modelId })))];
        const buildings = pieces.map(p => ({ poly: p.poly, holes: [], modelId: p.modelId, supportPieceId: p.id, x: (p.a[0] + p.b[0]) / 2, z: (p.a[1] + p.b[1]) / 2, r: 20, roadDeck: true, railDeck: true, sourceId: p.sourceId, kind: 'source-tram-deck', y0: Math.min(p.y0, p.y1) + .2 - .4, y1: Math.max(p.y0, p.y1) + .2, roofHeightAt: (x, z, r) => p.band(x, z, r).top, minHeightAt: (x, z, r) => p.band(x, z, r).bottom }));
        ownSlabStaticControl = initialTrafficStaticClearance({ buildings, tramDeckSupportAt: grade.support.at }, v);
    }
    result.push({ ...detail, actualPose: { x: v.x, y: v.y, z: v.z, heading: v.heading, pitch: mesh.rotation.x }, actualEmittedBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, support: v.railSupport, sourceErrorM, minVertexClearanceM: Number.isFinite(minClearance) ? minClearance : null, penetration, ownSlabStaticControl, fitTimeMs: ms, passed: sourceErrorM < 1e-10 && !penetration.length });
    if (false && edge.sourceId === 'w660918283' && edge.sourceSegment === 0 && Math.abs(fixture.t - 1 / 6) < 1e-10 && kind === 'tram-imperio') {
        const stationary = [], moving = [], certificate = v.railSupport;
        for (let i = 0; i < 240; i++) { const start = performance.now(); traffic.placeOnLane(v, false, 1 / 60); stationary.push(performance.now() - start); }
        const sameStationaryCertificate = certificate === v.railSupport;
        v.speed = 1;
        for (let i = 0; i < 120; i++) {
            v.s += .05; while (v.s >= v.edge.len) traffic.advance(v); traffic.ensureRoute(v);
            const start = performance.now(); traffic.placeOnLane(v, false, 1 / 60); moving.push(performance.now() - start);
        }
        const summary = times => { times.sort((a, b) => a - b); return { frames: times.length, medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * .95)], maxMs: times.at(-1) }; };
        benchmarks.push({ fixture: detail, stationary: summary(stationary), moving: summary(moving), sameStationaryCertificate, scope: 'Actual native source placement/support kernel only, warm CPU timings; excludes render and full-scene traffic/static queries, not hardware FPS.' });
    }
}
const passed = result.filter(r => r.passed === true), failed = result.filter(r => r.passed === false), excluded = result.filter(r => r.passed === null);
const report = { passed: !failed.length, scope: 'CPU actual native Traffic/source path and emitted mesh support sweep at all original vertices and <=5m intervals. Independent post-fit primary emitted-vertex queries; synthetic triangle-interior extrema controls are separate. Whole native static/roof/other-world-body acceptance remains pending.', input: { path: nativeFile, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), sourceCommit: native.sourceCommit }, gradeRoot, gradeReport: grade.report, sourceNetwork: { modeled: net.report.modeledSegments, admitted: net.report.admittedSegments, unresolved: net.report.unresolved }, summary: { poses: result.length, passed: passed.length, failed: failed.length, excludedOutsideLegalSpan: excluded.length, maxVerticalOffsetM: Math.max(0, ...passed.map(r => r.support.verticalOffsetM || 0)), maxSupportLiftM: Math.max(0, ...passed.map(r => r.support.supportLiftM || 0)), maxSourceErrorM: Math.max(0, ...passed.map(r => r.sourceErrorM)), totalCpuMs: performance.now() - begin }, benchmarks, result };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report.summary, passed: report.passed, firstFailure: failed[0] }, null, 2));
