#!/usr/bin/env node
// Independent retained-source checks for optional railway scenery and measured canopy inputs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseFiles } from './parse-osm.mjs';
import { footprintMargin } from './geom.mjs';
const arg = k => process.argv.find(v => v.startsWith('--' + k + '='))?.split('=').slice(1).join('=');
const file = arg('data') || 'game/data/bucharest-grozavesti.json', tileDir = arg('osm');
if (!tileDir) throw Error('--osm=<source XML directory> is required');
const d = JSON.parse(fs.readFileSync(file)), p = d.proj, osm = parseFiles(fs.readdirSync(tileDir).filter(f => f.endsWith('.xml')).sort().map(f => path.join(tileDir, f)));
const project = id => { const ll = osm.nodes.get(id); return ll && [(ll[1] - p.lon0) * p.mPerLon * p.scale, -(ll[0] - p.lat0) * p.mPerLat * p.scale]; };
const decode = a => { let x = 0, z = 0; const out = []; for (let i = 0; i < a.length; i += 2) { x += a[i]; z += a[i + 1]; out.push([x / 10, z / 10]); } return out; };
const exported = new Map((d.railways || []).map(r => [r.id, r])); let sourceWays = 0, sourceLengthM = 0;
for (const [id, w] of osm.ways) {
    if (!['rail', 'narrow_gauge', 'light_rail', 'disused', 'abandoned'].includes(w.tags.railway)) continue;
    const pts = w.nodes.map(project); if (pts.length < 2 || pts.some(v => !v)) continue;
    if (!pts.slice(1).some((v, i) => footprintMargin([pts[i], v], d.district.geometry) <= 600)) continue;
    sourceWays++; const r = exported.get('w' + id); assert.ok(r, 'source railway ID retained: w' + id);
    assert.deepEqual(r.nodeIds, w.nodes, 'complete source way node IDs retained');
    assert.deepEqual(r.tags, w.tags, 'source gauge/layer/bridge/tunnel/status tags retained without synthetic defaults');
    const got = decode(r.points); assert.equal(got.length, pts.length);
    pts.forEach((v, i) => { assert.ok(Math.hypot(v[0] - got[i][0], v[1] - got[i][1]) <= Math.SQRT2 * 0.05001, 'only decimetre source quantization'); });
    sourceLengthM += pts.slice(1).reduce((s, v, i) => s + Math.hypot(v[0] - pts[i][0], v[1] - pts[i][1]), 0);
}
assert.equal(exported.size, sourceWays, 'railway source selection contains no invented ways');
assert.equal(d.treeCrownRadii.length, d.trees.length / 3, 'crown radius array stays parallel to retained trees');
let measured = 0; for (let i = 0; i < d.treeCrownRadii.length; i++) { const radius = d.treeCrownRadii[i]; assert.ok(Number.isFinite(radius) && radius >= 0); if (d.treeInfo[i * 3 + 2] & 32) { assert.ok(radius > 0, 'a retained aerial crown keeps its measured radius'); measured++; } }
const t = d.treeRetention; assert.equal(t.policy, 'all-measured'); assert.equal(t.thinned, 0, 'no frame-budget crown thinning');
assert.equal(t.retained, measured); assert.equal(t.inputCrowns, t.retained + t.rejectedGeometryOrDuplicate + t.outsideSurveyDistrict + t.thinned, 'all source inputs are accounted for');
console.log(JSON.stringify({ file, sourceRailwayWays: sourceWays, sourceRailwayLengthM: Math.round(sourceLengthM), retainedTreeRecords: d.trees.length / 3, measuredCrownRadii: measured, treeRetention: t }, null, 2));
