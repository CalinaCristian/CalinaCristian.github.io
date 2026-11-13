#!/usr/bin/env node
// Cached-source road append for a reviewed exception: adds whole OSM ways the district build dropped (e.g. a carriageway
// tagged highway=construction during works) as ordinary road rows, without rebuilding the district. Every existing row,
// node, building, POI, tree, area and string keeps its value and index; only
//   roads, roadInfo        one appended row per way (builder schema; class, lanes, lane width, sidewalk, speed, flags as the
//                          builder derives them from the way's tags with `highway` replaced by the reviewed class)
//   nodes, roadNodePositions, roadNodeIds, nodeFlags
//                          the way's nodes that the graph does not have yet (existing junction nodes are reused by OSM id)
//   roadAccess, roadSourceGeometry
//                          per appended row (the source tags are kept as mapped; `reviewedException` says what was changed)
//   strings                new strings appended
//   roadAppend             provenance: tool, date, ways, reviewed class, reason
// are written. Usage (way JSON from https://api.openstreetmap.org/api/0.6/way/<id>/full.json, downloads stay outside the repo):
//   node tools/osm/add-roads.mjs --data game/data/bucharest-unirii.bin.gz --ways FILE[,FILE] --as primary --reason "…" [--write]
import fs from 'node:fs';
import { readDistrictData, writeDistrictData } from './district-data.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dataFile = arg('data'), wayFiles = (arg('ways') || '').split(',').filter(Boolean), cls = arg('as'), reason = arg('reason'), write = process.argv.includes('--write');
if (!dataFile || !wayFiles.length || !cls || !reason) throw new Error('usage: --data FILE --ways FILE[,FILE] --as <class> --reason "…" [--write]');
const D = readDistrictData(dataFile);
const ci = D.classes.indexOf(cls); if (ci < 0) throw new Error('unknown class ' + cls);
// builder constants (tools/osm/build-data.mjs)
const DEFAULT_LANES = { motorway: 3, trunk: 3, primary: 2, secondary: 2, tertiary: 1, residential: 1, unclassified: 1, living_street: 1 };
const laneWidthFor = (c) => /motorway|trunk/.test(c) ? 3.7 : (c === 'residential' || c === 'living_street' || c === 'unclassified' || c === 'service') ? 3.0 : 3.5;
const SIDEWALK = { motorway: 0, motorway_link: 0, trunk: 1.5, trunk_link: 1, primary: 4, primary_link: 2.5, secondary: 3.5, secondary_link: 2.5, tertiary: 3, tertiary_link: 2.5, residential: 2.5, unclassified: 2 };
const yes = (v) => v === 'yes' || v === 'true' || v === '1';
// node flags exactly as tools/osm/build-data.mjs nodeFlagOf (signals, crossings, stop / give-way, stops, cameras)
const nodeFlagOf = (t) => {
    if (!t) return 0; let f = 0; const h = t.highway || '';
    if (/traffic_signals/.test(h) || t.crossing === 'traffic_signals' && h === 'traffic_signals') f |= 1;
    if (/crossing/.test(h) || t.crossing) { f |= 2; if (t.crossing === 'zebra' || t.crossing_ref === 'zebra' || t.crossing === 'marked' || t.crossing === 'uncontrolled') f |= 4; if (t.crossing === 'traffic_signals') f |= 8; }
    if (h === 'stop') f |= 16;
    if (h === 'give_way') f |= 32;
    if (h === 'bus_stop' || t.public_transport === 'stop_position' && t.bus === 'yes') f |= 64;
    if (t.railway === 'tram_stop' || (t.public_transport === 'stop_position' && t.tram === 'yes')) f |= 128;
    if (h === 'speed_camera' && t.enforcement !== 'traffic_signals') f |= 256;
    if (t.enforcement === 'traffic_signals' || (h === 'speed_camera' && /red_light|traffic_signals/.test(t['camera:type'] || t.enforcement || ''))) f |= 1024;
    if (h === 'mini_roundabout') f |= 512;
    return f;
};
const S = (s) => { if (!s) return -1; let i = D.strings.indexOf(s); if (i < 0) { i = D.strings.length; D.strings.push(s); } return i; };
const P = D.proj, pt = ([la, lo]) => [(lo - P.lon0) * P.mPerLon, -(la - P.lat0) * P.mPerLat];
const idIndex = new Map(D.roadNodeIds.map((id, i) => [id, i])), report = [];
for (const f of wayFiles) {
    const J = JSON.parse(fs.readFileSync(f, 'utf8')), w = J.elements.find(e => e.type === 'way'), N = new Map(J.elements.filter(e => e.type === 'node').map(e => [e.id, e]));
    const sid = 'w' + w.id;
    if (Object.values(D.roadSourceGeometry).some(g => g.sourceId === sid)) { report.push({ sid, skipped: 'already a road row' }); continue; }
    const t = w.tags, oneway = yes(t.oneway), total = parseInt(t.lanes) || 0;
    if (t.oneway === '-1') throw new Error('oneway=-1 not handled');
    let lf, lb; if (oneway) { lf = total || DEFAULT_LANES[cls] || 1; lb = 0; } else if (total) { lf = Math.ceil(total / 2); lb = Math.max(1, total - lf); } else { lf = lb = DEFAULT_LANES[cls] || 1; }
    const laneW = laneWidthFor(cls); let sidewalk = SIDEWALK[cls] ?? 2; if (t.sidewalk === 'no' || t.sidewalk === 'none' || t.foot === 'no') sidewalk = Math.min(sidewalk, 0.8);
    const maxspeed = parseInt(t.maxspeed) || 50; // (RO urban default; the reviewed ways carry no maxspeed)
    let flags = oneway ? 1 : 0; if (/^(yes|24\/7|automatic)$/.test(t.lit || '')) flags |= 2048; if (t.lit === 'no') flags |= 4096;
    const median = oneway ? -(lf * laneW) : 0;
    const idx = w.nodes.map(id => {
        if (idIndex.has(id)) return idIndex.get(id);
        const n = N.get(id), p = pt([n.lat, n.lon]), i = D.roadNodeIds.length;
        D.nodes.push(Math.round(p[0] * 10), Math.round(p[1] * 10)); D.roadNodePositions.push(...p); D.roadNodeIds.push(id); idIndex.set(id, i);
        const fl = nodeFlagOf(n.tags); if (fl) D.nodeFlags.push(i, fl);
        return i;
    });
    const r = D.roads.length;
    D.roads.push([S(t.name || ''), ci, lf, oneway ? 0 : lb, Math.round(median * 10), Math.round(laneW * 10), Math.round(sidewalk * 10), maxspeed, flags, 0, ...idx]);
    D.roadInfo.push(0, 0, 0, 0, -1, -1);
    const exception = { from: { highway: t.highway, ...(t.access ? { access: t.access } : {}) }, drawnAs: { highway: cls, access: 'public' }, reason };
    D.roadAccess[r] = { sourceId: sid, publicDrive: true, throughAccess: true, key: null, value: null, reason: 'reviewed exception (tools/osm/add-roads.mjs): ' + reason, conditionalUnresolved: false, tags: { ...(t.oneway ? { oneway: t.oneway } : {}) } };
    D.roadSourceGeometry[r] = { sourceId: sid, nodeIds: w.nodes, wgs84: w.nodes.map(id => [N.get(id).lat, N.get(id).lon]), projected: w.nodes.map(id => pt([N.get(id).lat, N.get(id).lon])), tags: t, preparedNodeIds: w.nodes, reviewedException: exception };
    report.push({ sid, row: r, lanes: lf + '+' + lb, newNodes: w.nodes.filter((id, k) => idx[k] >= idIndex.size - w.nodes.length).length, junctions: w.nodes.filter(id => D.roadNodeIds.indexOf(id) >= 0).length });
}
D.roadAppend = D.roadAppend || { schema: 1, runs: [] };
D.roadAppend.runs.push({ tool: 'tools/osm/add-roads.mjs', date: new Date().toISOString().slice(0, 10), ways: report.filter(x => x.row != null).map(x => x.sid), as: cls, reason });
console.log(JSON.stringify(report, null, 1));
if (write) { const n = writeDistrictData(D, dataFile); console.log('wrote', dataFile, (n / 1048576).toFixed(2), 'MiB'); } else console.log('(dry run: --write to save)');
