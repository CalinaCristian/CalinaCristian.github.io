#!/usr/bin/env node
// CPU diagnosis only: native scene construction and walking remain separate gates.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(process.argv[2] || '.');
const output = process.argv[3];
const base = '4787d7d7b6deaac7855a990f530d1ccff4917997';
const prepreview = 'dc5339f4da79e6fb84b8f98d9e241aa352e8bdf6';
const preview = '0b18608b215172ed3283cf062349978084495219';
const source = (ref, file) => execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8' });
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const groundFile = 'game/src/spots/ground.js';
const oldText = source(base, groundFile);
const rewritten = oldText.replaceAll("'../../vendor/three.module.min.js'", JSON.stringify(pathToFileURL(path.join(root, 'game/vendor/three.module.min.js')).href))
    .replaceAll("'./kit.js'", JSON.stringify(pathToFileURL(path.join(root, 'game/src/spots/kit.js')).href));
const { Ground: Before } = await import('data:text/javascript;base64,' + Buffer.from(rewritten).toString('base64'));
const { Ground: After, buildTerrain } = await import(pathToFileURL(path.join(root, groundFile)));
const THREE = await import(pathToFileURL(path.join(root, 'game/vendor/three.module.min.js')));
const { streetBands } = await import(pathToFileURL(path.join(root, 'game/src/spots/osm.js')));
const { default: pike } = await import(pathToFileURL(path.join(root, 'game/src/spots/scenes/pike-place.js')));
const d = JSON.parse(fs.readFileSync(path.join(root, 'game/data/spots/pike-place.json')));
const P = Object.values(d.spots).flatMap(s => s.extent?.polygon || []);
const bounds = { x0: Math.min(...P.map(p => p[0])) - 220, z0: Math.min(...P.map(p => p[1])) - 220,
    x1: Math.max(...P.map(p => p[0])) + 220, z1: Math.max(...P.map(p => p[1])) + 220 };
async function build(C) {
    const g = new C(d.terrain); g.pendingConform = { ...streetBands(d), bounds };
    const ctx = { ground: g, data: d, spot: () => d.spots['pike-place'], water() {}, exclude: [],
        osmBackdrop() { g.settle(); throw Error('audit-stop-before-backdrop'); } };
    try { await pike.build(ctx); } catch (e) { if (e.message !== 'audit-stop-before-backdrop') throw e; }
    return g;
}
const before = await build(Before), after = await build(After);
const m8 = n => Math.round(n / 8) * 8;
const inner = { x0: m8(Math.min(...P.map(p => p[0])) - 60), z0: m8(Math.min(...P.map(p => p[1])) - 60),
    x1: m8(Math.max(...P.map(p => p[0])) + 60), z1: m8(Math.max(...P.map(p => p[1])) + 60) };
function meshY(g, x, z) {
    const ax = inner.x0 + Math.floor((x - inner.x0) / 2) * 2, az = inner.z0 + Math.floor((z - inner.z0) / 2) * 2;
    const u = (x - ax) / 2, v = (z - az) / 2;
    // buildTerrain emits a,d,b and b,d,c; retain its actual diagonal.
    return u + v <= 1 ? g.heightAt(ax, az) * (1 - u - v) + g.heightAt(ax + 2, az) * u + g.heightAt(ax, az + 2) * v
        : g.heightAt(ax + 2, az + 2) * (u + v - 1) + g.heightAt(ax, az + 2) * (1 - u) + g.heightAt(ax + 2, az) * (1 - v);
}
function scan(g, box) {
    let maxJump = { deltaM: 0 }, maxWalkingMeshDifference = { deltaM: 0 }, count = 0;
    for (let z = box.z0; z <= box.z1; z += .5) for (let x = box.x0; x <= box.x1; x += .5) {
        const y = g.heightAt(x, z); assert(Number.isFinite(y)); count++;
        for (const [dx, dz] of [[.02, 0], [0, .02]]) {
            const y2 = g.heightAt(x + dx, z + dz), deltaM = Math.abs(y2 - y);
            if (deltaM > maxJump.deltaM) maxJump = { x, z, y, x2: x + dx, z2: z + dz, y2, deltaM };
        }
        const actualTriangleY = meshY(g, x, z), deltaM = Math.abs(actualTriangleY - y);
        if (deltaM > maxWalkingMeshDifference.deltaM) maxWalkingMeshDifference = { x, z, heightAt: y, actualTriangleY, deltaM };
    }
    return { count, sampleSpacingM: .5, jumpDistanceM: .02, maxJump, maxWalkingMeshDifference };
}
const boxes = { marketAndApproaches: { x0: -280, x1: 35, z0: -175, z1: 135 }, gumWall: { x0: -60, x1: -20, z0: 40, z1: 85 } };
const regions = Object.fromEntries(Object.entries(boxes).map(([id, box]) => [id, { box, before: scan(before, box), after: scan(after, box) }]));
// Full ownership of a source/profile interior must survive settlement unchanged.
function synthetic(C, modifier) {
    const g = new C({ x0: -50, z0: -50, d: 10, nx: 11, nz: 11, h: Array(121).fill(0) });
    g.conform({ lines: [{ pts: [[-40, 0], [40, 0]], w: 10 }] });
    modifier(g); g.settle(); return g;
}
const fixed = synthetic(After, g => g.corridor([[-40, 0], [40, 0]], 8, 6, () => -6));
assert.equal(fixed.heightAt(0, 0), -6); assert.equal(fixed.heightAt(15, 3.9), -6);
const sloped = synthetic(After, g => g.corridor([[-40, 0], [40, 0]], 8, 6, x => x * .08));
assert(Math.abs(sloped.heightAt(20, 0) - 1.6) < 1e-12);
const noMods = synthetic(After, () => {}); assert.equal(noMods.heightAt(0, 0), 0);
const once = fixed.mods.length; fixed.settle(); assert.equal(fixed.mods.length, once);
let blendJump = 0; for (let z = 3.5; z < 11; z += .001) blendJump = Math.max(blendJump, Math.abs(fixed.heightAt(0, z + .001) - fixed.heightAt(0, z)));
assert(blendJump < .01);
assert(regions.marketAndApproaches.before.maxJump.deltaM > 5);
assert(regions.marketAndApproaches.after.maxJump.deltaM < .1);
assert(regions.gumWall.after.maxJump.deltaM < .1);
// Independent native triangle raycast; no production floor helper used to
// calculate the expected result. A tiny texture stub avoids a DOM in CPU QA.
const terrain = buildTerrain(after, { render: () => [{ width: 1, height: 1 }, { width: 1, height: 1 }] },
    { inner, outer: { x0: inner.x0 - 16, z0: inner.z0 - 16, x1: inner.x1 + 16, z1: inner.z1 + 16 }, innerPx: 1, outerPx: 1 });
terrain.group.updateMatrixWorld(true);
const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), origin = new THREE.Vector3();
let rayCount = 0, maxRayErrorM = 0;
for (const [x, z] of [[-59, 47], [-33.5, 83.5], [-11.5, 119.5], [0, 0], [-100, -40], [-420, -300], [104, 192], [-416, -304]]) {
    ray.set(origin.set(x, 1000, z), down);
    const hit = ray.intersectObject(terrain.group, true)[0]; assert(hit, `missing terrain ${x},${z}`);
    const error = Math.abs(after.terrainHeightAt(x, z) - hit.point.y);
    maxRayErrorM = Math.max(maxRayErrorM, error); assert(error < 1e-9); rayCount++;
    assert(Math.abs(after.groundAt(x, z, hit.point.y) - hit.point.y) < 1e-9);
}
after.addBox(-59, 47, 1, 1, 0, -5, -4);
assert.equal(after.groundAt(-59, 47, -5), -4); // reachable solid still wins
assert(after.groundAt(-59, 47, -10) < -6); // overhead solid stays overhead
after.waterY = 100;
assert.equal(after.groundAt(0, 0, 0), 50); // deep-water barrier retained
assert.equal(after.flightHeightAt(0, 0, 0), 100); // aircraft receives no walker sentinel
const groundFunctions = s => s.slice(s.indexOf('    conform('), s.indexOf('    /** is (x, z)'));
const pikeGround = s => s.slice(s.indexOf('        // ---- ground:'), s.indexOf('        // ---- paint'));
const historical = { prepreview, preview,
    groundConformSettleIdentical: groundFunctions(source(prepreview, groundFile)) === groundFunctions(source(preview, groundFile)),
    pikeGroundProfilesIdentical: pikeGround(source(prepreview, 'game/src/spots/scenes/pike-place.js')) === pikeGround(source(preview, 'game/src/spots/scenes/pike-place.js')) };
assert(historical.groundConformSettleIdentical && historical.pikeGroundProfilesIdentical);
const report = { scope: 'CPU actual Pike ground modifiers and exact buildTerrain 2m triangle diagonal; native visuals/walking pending', base,
    sourceHashes: { beforeGround: hash(oldText), afterGround: hash(fs.readFileSync(path.join(root, groundFile))), pikeData: hash(fs.readFileSync(path.join(root, 'game/data/spots/pike-place.json'))) },
    historical, innerTerrain: inner, regions, controls: { exactFlatCorridor: true, exactEightPercentGrade: true, unchangedNoModifiers: true, idempotentSettle: true, continuousBlendMaxOneMmStepM: blendJump,
        independentEmittedTriangleRaycasts: rayCount, maxRayErrorM, reachableSolid: true, overheadSolid: true, deepWaterAndAircraft: true } };
if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
