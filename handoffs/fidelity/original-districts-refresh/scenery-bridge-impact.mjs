// CPU-only production core-grade reconstruction, verified against immutable native graph hashes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
const arg = k => process.argv.find(s => s.startsWith('--' + k + '='))?.slice(k.length + 3);
const root = path.resolve(arg('root')), out = path.resolve(arg('out'));
const candidate = path.resolve(arg('candidate'));
const native = path.resolve(arg('native'));
fs.mkdirSync(out, { recursive: true });
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
let prefix = fs.readFileSync(root + '/game/src/world.js', 'utf8');
const helpers = prefix.slice(prefix.indexOf('    function isPadNode(n)'), prefix.indexOf('    const widthAsphalt')).replace(/^    for \(const n of nodeArr\).*$/m, '');
prefix = prefix.slice(0, prefix.indexOf('    // ---- traffic lights:')) + helpers + '    return {data,edges,nodeArr};\n}\n';
prefix = prefix.replace(/from '(\.[^']+)'/g, (_, p) => `from '${new URL(p, pathToFileURL(root + '/game/src/world.js')).href}'`);
const { CITIES } = await import(pathToFileURL(root + '/game/src/cities.js'));
const { scenerySourceProfile } = await import(pathToFileURL(root + '/game/src/scenery-source.js'));
const baseline = await import(pathToFileURL(root + '/game/src/scenery-bridges.js'));
const changed = await import(pathToFileURL(candidate));
const { collideBuildings } = await import(pathToFileURL(root + '/game/src/world.js'));
const undelta = r => { let x = 0, z = 0; const p = []; for (let i = 4; i < r.length; i += 2) { x += r[i]; z += r[i + 1]; p.push([x / 10, z / 10]); } return p; };
const geometry = result => [...result.profiles].map(([piece, p]) => ({ piece, sourceId: p.sourceId, points: p.points, heights: p.heights, coveredSegments: p.coveredSegments, bridge: p.bridge, thicknessM: p.thicknessM }));
const districts = [];
for (const key of ['bucharest-floreasca', 'bucharest-romana', 'bucharest-grozavesti', 'bucharest-unirii', 'bucharest-otopeni', 'bucharest-pipera', 'seattle-bellevue', 'seattle-seatac']) {
    const [city, district] = key.split('-');
    const code = prefix.replace(/^    const url = new URL.*$/m, '    const url = ' + JSON.stringify(pathToFileURL(root + '/game/data/' + key + '.json').href) + ';');
    const originalFetch = globalThis.fetch; globalThis.fetch = async u => ({ json: async () => JSON.parse(fs.readFileSync(fileURLToPath(u), 'utf8')) });
    let world;
    try { const { buildWorld } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')); world = await buildWorld({ ...CITIES[city] }, null, { district }); }
    finally { globalThis.fetch = originalFetch; }
    const d = world.data, core = world.edges.filter(e => !e.virtual).map(e => ({ road: e.road, sourceId: d.roadSourceGeometry?.[e.road]?.sourceId, a: [e.a.x, e.a.z, e.ya], b: [e.b.x, e.b.z, e.yb], wL: e.wL, wR: e.wR, access: e.access }));
    const record = JSON.parse(fs.readFileSync(path.join(native, key + '.json')));
    if (hash(core) !== record.coreSha256) throw Error(key + ': reconstructed core differs from actual native grade');
    const profiles = d.scenery.map((r, i) => scenerySourceProfile(d, i, undelta(r)));
    const before = baseline.sceneryBridgeProfiles(d, profiles, world.edges), after = changed.sceneryBridgeProfiles(d, profiles, world.edges);
    if (JSON.stringify(before.stats) !== JSON.stringify(record.stats)) throw Error(key + ': reconstructed baseline profiles differ from actual native');
    const old = geometry(before), next = geometry(after), sourceIds = new Set([...old, ...next].map(p => p.sourceId));
    const changedSourceIds = [...sourceIds].filter(id => hash(old.filter(p => p.sourceId === id)) !== hash(next.filter(p => p.sourceId === id)));
    // Validate actual source-connected previous crossing locations without introducing a nearest-XY tie.
    const pairs = before.stats.unresolved.map(u => {
        const bodyProbe = result => {
            const slabs = [];
            for (const [piece, p] of result.profiles) if (p.sourceId === u.sourceId) for (let i = 1; i < p.points.length; i++) {
                if (p.coveredSegments[i - 1]) continue;
                const a = p.points[i - 1], b = p.points[i], dx = b[0] - a[0], dz = b[1] - a[1], t = ((u.x - a[0]) * dx + (u.z - a[1]) * dz) / (dx * dx + dz * dz);
                if (t < -1e-7 || t > 1 + 1e-7 || Math.hypot(a[0] + dx * t - u.x, a[1] + dz * t - u.z) >= 1e-5) continue;
                const profile = profiles[piece], sw = d.scenery[piece][1] / 10, cls = d.classes[d.scenery[piece][2]], sideM = sw > .5 && !/service|motorway/.test(cls) ? Math.max(1.2, sw) : 0;
                const nrm = k => { const a = p.points[Math.max(0, k - 1)], b = p.points[Math.min(p.points.length - 1, k + 1)], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]; };
                const n0 = nrm(i - 1), n1 = nrm(i), left = profile.leftM + sideM, right = profile.rightM + sideM;
                const poly = [[a[0] - n0[0] * left, a[1] - n0[1] * left], [b[0] - n1[0] * left, b[1] - n1[1] * left], [b[0] + n1[0] * right, b[1] + n1[1] * right], [a[0] + n0[0] * right, a[1] + n0[1] * right]];
                const band = changed.sceneryDeckBand(a, b, p.heights[i - 1], p.heights[i], p.thicknessM), ends = [band(...a), band(...b)];
                slabs.push({ sourceId: p.sourceId, roadDeck: true, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, r: Math.hypot(dx, dz) / 2 + left + right, poly, y0: Math.min(...ends.map(b => b.bottom)), y1: Math.max(...ends.map(b => b.top)), h: Math.max(...ends.map(b => b.top)), roofHeightAt: (x, z, r) => band(x, z, r).top, minHeightAt: (x, z, r) => band(x, z, r).bottom });
            }
            return lower.map(l => ({ lowerTopM: l.topM, bodyHeightM: 2, radiusM: .2, matchedPassiveSlabs: slabs.length, blocked: !!collideBuildings(slabs, u.x, u.z, .2, l.topM, 2) }));
        };
        const tops = id => {
            const values = [];
            for (const p of after.profiles.values()) if (p.sourceId === id) for (let i = 1; i < p.points.length; i++) {
                const a = p.points[i - 1], b = p.points[i], dx = b[0] - a[0], dz = b[1] - a[1], t = ((u.x - a[0]) * dx + (u.z - a[1]) * dz) / (dx * dx + dz * dz);
                if (t >= -1e-7 && t <= 1 + 1e-7 && Math.hypot(a[0] + dx * t - u.x, a[1] + dz * t - u.z) < 1e-5) values.push({ kind: p.coveredSegments[i - 1] ? 'same-source core-covered profile' : 'passive profile', topM: .24 + p.heights[i - 1] + (p.heights[i] - p.heights[i - 1]) * t });
            }
            for (const e of world.edges) if (!e.virtual && d.roadSourceGeometry?.[e.road]?.sourceId === id) {
                const t = ((u.x - e.a.x) * e.dirx + (u.z - e.a.z) * e.dirz) / e.len;
                if (t >= -1e-7 && t <= 1 + 1e-7 && Math.hypot(e.a.x + e.dirx * e.len * t - u.x, e.a.z + e.dirz * e.len * t - u.z) < 1e-5) values.push({ kind: 'exact source core segment', topM: .24 + e.ya + (e.yb - e.ya) * t });
            }
            return values;
        };
        const upper = tops(u.sourceId), lower = tops(u.lowerSourceId);
        if (!lower.length) lower.push({ kind: 'unchanged flat source scenery asphalt', topM: .20 });
        return { sourceId: u.sourceId, lowerSourceId: u.lowerSourceId, x: u.x, z: u.z, upper, lower, clearanceCandidatesM: upper.flatMap(a => lower.map(b => a.topM - .4 - b.topM)), productionBodyProbeBefore: bodyProbe(before), productionBodyProbeAfter: bodyProbe(after) };
    });
    const result = { district: key, nativeCoreSha256: record.coreSha256, coreHashMatchesNative: true, baselineStatsMatchNative: true, beforeGeometrySha256: hash(old), afterGeometrySha256: hash(next), geometryUnchanged: hash(old) === hash(next), changedSourceIds, before: before.stats, after: after.stats, previousUnresolvedActualPairs: pairs, candidateProfiles: next.filter(p => changedSourceIds.includes(p.sourceId)) };
    fs.writeFileSync(path.join(out, key + '.json'), JSON.stringify(result, null, 2) + '\n');
    const row = { district: key, coreHashMatchesNative: true, baselineStatsMatchNative: true, geometryUnchanged: result.geometryUnchanged, changedSourceIds, beforeUnresolved: before.stats.unresolved.length, afterUnresolved: after.stats.unresolved.length, minimumPreviousTargetClearanceM: Math.min(...pairs.flatMap(p => p.clearanceCandidatesM)), continuationEvidence: after.stats.continuations };
    districts.push(row); console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ sourceRoot: root, candidatePath: candidate, candidateSha256: crypto.createHash('sha256').update(fs.readFileSync(candidate)).digest('hex'), scope: 'CPU production core-grade reconstruction verified against actual native core hashes and complete baseline scenery stats. No renderer, source XY, data or core grade mutation. Candidate passive profiles and local paired clearance estimates need native collision/render follow-up.', districts }, null, 2) + '\n');
