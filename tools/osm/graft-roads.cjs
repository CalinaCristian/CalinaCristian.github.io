// node graft.cjs <old.json> <band.json> <out.json>
// Road-only graft: the committed district file keeps every building, POI, tree, area and string index; only the road
// rows that the wider boundary changes (re-cut or new) are taken from the fresh build, together with the district
// boundary and the scenery streets those rows replace.
const fs = require('fs');
const [oldF, newF, outF] = process.argv.slice(2);
const O = JSON.parse(fs.readFileSync(oldF, 'utf8')), N = JSON.parse(fs.readFileSync(newF, 'utf8'));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b), assert = (c, m) => { if (!c) throw new Error(m); };
for (const k of ['classes', 'q', 'proj', 'roadGeometryPolicy']) assert(eq(O[k], N[k]), 'header differs: ' + k);
const str = i => { if (i < 0 || i == null) return i; const s = N.strings[i]; let j = O.strings.indexOf(s); if (j < 0) { j = O.strings.length; O.strings.push(s); } return j; };

// ---- nodes: new index -> old index (same OSM id; a boundary cut by its exact position)
const oldById = new Map(O.roadNodeIds.map((id, i) => [id, i])), n2o = new Map();
const pos = (D, i) => [D.roadNodePositions[i * 2], D.roadNodePositions[i * 2 + 1]];
N.roadNodeIds.forEach((id, i) => {
    if (id > 0) { if (oldById.has(id)) { const j = oldById.get(id), p = pos(N, i), q = pos(O, j); assert(Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6, 'node moved ' + id); n2o.set(i, j); } return; }
    const p = pos(N, i); for (let j = 0; j < O.roadNodeIds.length; j++) if (O.roadNodeIds[j] < 0) { const q = pos(O, j); if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6) { n2o.set(i, j); break; } }
});
// ---- rows
const HEAD = 10, src = (D, r) => D.roadSourceGeometry[r].sourceId;
const keyN = r => src(N, r) + '|' + N.roads[r].slice(HEAD).map(n => n2o.has(n) ? n2o.get(n) : 'N' + n).join(',');
const keyO = r => src(O, r) + '|' + O.roads[r].slice(HEAD).join(',');
const oldKeys = new Map(O.roads.map((_, r) => [keyO(r), r])), sameNew = new Map(), freshNew = [];
N.roads.forEach((_, r) => { const k = keyN(r); if (oldKeys.has(k)) sameNew.set(oldKeys.get(k), r); else freshNew.push(r); });
const changedOld = O.roads.map((_, r) => r).filter(r => !sameNew.has(r));
console.log('rows unchanged', sameNew.size, 'old rows to replace', changedOld.map(r => r + ':' + src(O, r)).join(' '), '| fresh new rows', freshNew.map(r => src(N, r)).join(' '));
// unchanged rows really are unchanged
for (const [o, n] of sameNew) { const a = O.roads[o].slice(0, HEAD), b = N.roads[n].slice(0, HEAD); a[0] = O.strings[a[0]] ?? a[0]; b[0] = N.strings[b[0]] ?? b[0]; assert(eq(a, b), 'row head differs ' + o + ' ' + JSON.stringify(a) + JSON.stringify(b)); }
// pair each replaced old row with a fresh row of the same way; the rest are appended
const target = new Map(); // new row -> final index
const pool = freshNew.slice();
for (const o of changedOld) { const i = pool.findIndex(n => src(N, n) === src(O, o)); assert(i >= 0, 'old row vanished: ' + o + ' ' + src(O, o)); target.set(pool[i], o); pool.splice(i, 1); }
let next = O.roads.length; for (const n of pool) target.set(n, next++);
// ---- node slots: orphans of the replaced rows are reused, then appended
const stillUsed = new Set(); O.roads.forEach((row, r) => { if (sameNew.has(r)) for (const n of row.slice(HEAD)) stillUsed.add(n); });
const need = []; for (const n of target.keys()) for (const v of N.roads[n].slice(HEAD)) { if (n2o.has(v)) stillUsed.add(n2o.get(v)); else if (!need.includes(v)) need.push(v); }
const orphans = []; for (const o of changedOld) for (const v of O.roads[o].slice(HEAD)) if (!stillUsed.has(v) && !orphans.includes(v)) orphans.push(v);
console.log('new nodes', need.length, 'orphaned old nodes', orphans.length);
const flagsOld = new Map(); for (let i = 0; i < O.nodeFlags.length; i += 2) flagsOld.set(O.nodeFlags[i], O.nodeFlags[i + 1]);
const flagsNew = new Map(); for (let i = 0; i < N.nodeFlags.length; i += 2) flagsNew.set(N.nodeFlags[i], N.nodeFlags[i + 1]);
let nodeCount = O.roadNodeIds.length; const freed = orphans.slice();
for (const v of need) {
    const slot = freed.length ? freed.shift() : nodeCount++;
    n2o.set(v, slot); flagsOld.delete(slot);
    O.nodes[slot * 2] = N.nodes[v * 2]; O.nodes[slot * 2 + 1] = N.nodes[v * 2 + 1];
    O.roadNodePositions[slot * 2] = N.roadNodePositions[v * 2]; O.roadNodePositions[slot * 2 + 1] = N.roadNodePositions[v * 2 + 1];
    O.roadNodeIds[slot] = N.roadNodeIds[v]; if (flagsNew.has(v)) flagsOld.set(slot, flagsNew.get(v));
}
assert(!freed.length, 'unused orphan node slots remain: ' + freed);
// a node kept from the old file that was a plain end and is now a tagged through node takes the new flags
for (const [v, o] of n2o) if (flagsNew.has(v) && !flagsOld.has(o)) flagsOld.set(o, flagsNew.get(v));
O.nodeFlags = [...flagsOld].sort((a, b) => a[0] - b[0]).flat();
// ---- write rows + parallel arrays
const tl = (D) => { const m = new Map(); for (let i = 0; i < (D.turnLanes || []).length; i += 3) m.set(D.turnLanes[i], [D.turnLanes[i + 1], D.turnLanes[i + 2]]); return m; };
const tlO = tl(O), tlN = tl(N), parkO = new Map((O.parking || []).map(p => [p[0], p])), parkN = new Map((N.parking || []).map(p => [p[0], p]));
for (const [n, f] of target) {
    const row = N.roads[n].slice(); row[0] = str(row[0]); for (let k = HEAD; k < row.length; k++) row[k] = n2o.get(row[k]);
    O.roads[f] = row;
    const info = N.roadInfo.slice(n * 6, n * 6 + 6); info[4] = str(info[4]); info[5] = str(info[5]); for (let k = 0; k < 6; k++) O.roadInfo[f * 6 + k] = info[k];
    O.roadAccess[f] = N.roadAccess[n]; O.roadSourceGeometry[f] = N.roadSourceGeometry[n];
    for (const key of ['roadWidths', 'sharedLanes']) { if (O[key]) { delete O[key][f]; if (N[key]?.[n]) O[key][f] = N[key][n]; } }
    tlO.delete(f); if (tlN.has(n)) tlO.set(f, tlN.get(n).map(str));
    parkO.delete(f); if (parkN.has(n)) { const p = parkN.get(n); parkO.set(f, [f, ...p.slice(1).map(str)]); }
}
O.turnLanes = [...tlO].sort((a, b) => a[0] - b[0]).flatMap(([r, v]) => [r, ...v]);
O.parking = [...parkO.values()].sort((a, b) => a[0] - b[0]);
// ---- boundary
O.bounds = N.bounds;
O.district = { ...O.district, areaKm2: N.district.areaKm2, geometry: N.district.geometry, mask: N.district.mask, ends: N.district.ends.map(v => { assert(n2o.has(v), 'end node unmapped ' + v); return n2o.get(v); }).sort((a, b) => a - b) };
if (O.corridor && N.corridor) O.corridor = { ...O.corridor, areaKm2: N.corridor.areaKm2 };
// ---- scenery: a street the fresh build re-cut or absorbed takes its fresh pieces; farther new ring streets are not added
const sid = (D, i) => D.scenerySourceGeometry[i].sourceId, byNew = new Map();
N.scenery.forEach((row, i) => { const k = sid(N, i); if (!byNew.has(k)) byNew.set(k, []); byNew.get(k).push(i); });
const sc = [], sg = [], sa = [], done = new Set(); let dropped = 0, recut = 0;
O.scenery.forEach((row, i) => {
    const k = sid(O, i), ns = byNew.get(k) || [];
    if (ns.some(j => eq(N.scenery[j], row))) { sc.push(row); sg.push(O.scenerySourceGeometry[i]); sa.push(O.sceneryAccess[i]); return; }
    if (done.has(k)) return; done.add(k);
    if (!ns.length) { dropped++; return; }
    recut++; for (const j of ns) if (!O.scenery.some((r2, i2) => sid(O, i2) === k && eq(r2, N.scenery[j]))) { sc.push(N.scenery[j]); sg.push(N.scenerySourceGeometry[j]); sa.push(N.sceneryAccess[j]); }
});
console.log('scenery', O.scenery.length, '->', sc.length, { dropped, recut });
O.scenery = sc; O.scenerySourceGeometry = sg; O.sceneryAccess = sa;
fs.writeFileSync(outF, JSON.stringify(O));
console.log('roads', O.roads.length, 'nodes', O.roadNodeIds.length, 'strings', O.strings.length, 'ends', O.district.ends.length);
