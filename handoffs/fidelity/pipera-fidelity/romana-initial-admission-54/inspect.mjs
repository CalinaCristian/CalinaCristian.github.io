// CPU only. Exact native preview and planner station provider; no live actors.
// node inspect.mjs EXACT_RUNTIME_ROOT [OUTPUT]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [root, output = path.join(here, 'diagnosis.json')] = process.argv.slice(2);
if (!root) throw Error('Exact native54 runtime source root required');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const imp = p => import(pathToFileURL(path.join(root, p)));
const [{ Traffic }, { previewInitialTrafficPose, nativeInitialTrafficCandidates }, { ordinaryVehicleStations, vehicleBodyPenetration }] = await Promise.all([
    imp('game/src/traffic.js'), imp('game/src/initial-traffic-admission.js'), imp('game/src/initial-vehicle-admission.js'),
]);
const fixture = JSON.parse(fs.readFileSync(path.join(here, 'fixture.json')));
const traffic = Object.create(Traffic.prototype);
let rngCalls = 0;
traffic.rng = () => { rngCalls++; throw Error('RNG forbidden in isolated preview'); };
const actors = fixture.actors.map(record => ({ ...record, mesh: {
    userData: {}, scale: { x: 1, y: 1, z: 1 },
    rotation: { x: record.meshPose.rotation[0], z: record.meshPose.rotation[2] },
} }));
const rows = actors.map(v => {
    assert(!v.long && !v.bus && !v.tram && !v.parked && !v.latBlend);
    const pose = previewInitialTrafficPose(traffic, v, v.s);
    const recordedPoseMaxError = Math.max(...['x', 'y', 'z', 'heading', 's'].map(k => Math.abs(pose[k] - v[k])));
    assert(recordedPoseMaxError < 1e-12);
    const stations = [...ordinaryVehicleStations(v)];
    const candidates = [...nativeInitialTrafficCandidates(traffic, v)];
    assert.deepEqual(candidates.map(v => v.s), stations);
    const attempts = fixture.initialAdmission.attempts.filter(a => a.id === v.id);
    const candidateLinearityMaxError = Math.max(0, ...candidates.flatMap(p => [
        Math.abs(p.x - (v.x + v.edge.dirx * v.dir * (p.s - v.s))),
        Math.abs(p.z - (v.z + v.edge.dirz * v.dir * (p.s - v.s))),
        Math.abs(p.heading - v.heading),
    ]));
    assert(candidateLinearityMaxError < 1e-12);
    return { id: v.id, kind: v.kind, sourceId: v.edge.access.sourceId, edgeId: v.edge.id,
        edgeLengthM: v.edge.len, bodyLengthM: v.length, endMarginM: .05,
        permittedStations: { lo: v.length / 2 + .05, hi: v.edge.len - v.length / 2 - .05 },
        stations, candidates, recordedPoseMaxError, candidateLinearityMaxError,
        originalS: v.s, nativeTopLevelAttempts: attempts.length,
        nativeAttemptReasons: Object.fromEntries([...new Set(attempts.map(a => a.reason))].map(reason => [reason, attempts.filter(a => a.reason === reason).length])),
        nativeCandidateStationsMatchAllRecordedAttempts: attempts.every(a => stations.some(s => Math.abs(s - a.s) < 1e-12)),
    };
});
const get = id => actors.find(v => v.id === id), row = id => rows.find(v => v.id === id);
function continuousPairCertificate(aId, bId) {
    const a = get(aId), b = get(bId), ar = row(aId), br = row(bId);
    const empty = r => r.permittedStations.hi < r.permittedStations.lo;
    // A body with no candidates remains at its exact unchanged baseline. This
    // is not asserted source-valid; it is the current planner's held body.
    const bounds = (v, r) => empty(r) ? [v.s] : [r.permittedStations.lo, r.permittedStations.hi];
    const corners = bounds(a, ar).flatMap(sa => bounds(b, br).map(sb => {
        const ap = { ...a, ...previewInitialTrafficPose(traffic, a, sa) }, bp = { ...b, ...previewInitialTrafficPose(traffic, b, sb) };
        return { aStation: sa, bStation: sb, penetrationM: vehicleBodyPenetration(ap, bp) };
    }));
    const minimum = Math.min(...corners.map(p => p.penetrationM));
    const recorded = fixture.initialAdmission.initialConflicts.find(p => p.a === aId && p.b === bId);
    assert(Math.abs(vehicleBodyPenetration(a, b) - recorded.penetration) < 1e-12);
    assert(minimum > 0);
    const discrete = ar.candidates.flatMap(ap => (br.candidates.length ? br.candidates : [b]).map(bp => vehicleBodyPenetration({ ...a, ...ap }, { ...b, ...bp })));
    return { a: aId, b: bId, originalPenetrationM: recorded.penetration, recordedVerticalOverlapM: recorded.verticalOverlapM,
        recordedUnknownHeight: recorded.unknownHeight, aEmptyDomain: empty(ar), bEmptyDomain: empty(br), corners,
        continuousStationDomainMinimumPenetrationM: minimum, providerPairMinimumPenetrationM: Math.min(...discrete),
        mathematicalScope: 'For each of the four fixed SAT axes, the projected centre difference is affine in the two stations and radii are constant. The maximum absolute affine value on the station rectangle occurs at a corner. Thus the minimum SAT penetration over the entire rectangle is attained among these corners. Positive minimum proves every allowed station pair still overlaps. An empty provider domain holds that actor at its unchanged baseline; no claim that baseline satisfies the candidate margin.' };
}
const report = { sourceCommit: fixture.sourceCommit, producerRawSha256: fixture.producerRawSha256,
    fixtureSha256: hash(fs.readFileSync(path.join(here, 'fixture.json'))),
    consumedSourceSha256: Object.fromEntries(['game/src/traffic.js', 'game/src/initial-traffic-admission.js', 'game/src/initial-vehicle-admission.js'].map(p => [p, hash(fs.readFileSync(path.join(root, p)))])),
    nativeSearch: fixture.initialAdmission.search, rows, pairs: [continuousPairCertificate(129, 172), continuousPairCertificate(154, 350)], rngCalls,
    conclusion: 'No work/depth exhaustion: current source-station-only domains cannot clear either retained pair. Blocker movement cannot remove overlap between these two held participants. This proves insufficiency of the present domains, not physical impossibility on the actual mapped road chain. No source, adapter, planner, body, count, lane, direction, tolerance, actor, RNG or live runtime change.',
    limitations: ['Only four selected native actors are replayed. No whole-scene static/shared/native-world acceptance.', 'Adjacent source-chain support and alternative legal admission domains are not implemented or certified by this proof.', 'Recorded vertical intervals come from the original native emitted models; this CPU necessary-condition proof tests their positive XY overlap without replacing their height evidence.'],
};
assert.equal(rngCalls, 0);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ rows: rows.map(r => ({ id: r.id, stations: r.stations.length, ...r.permittedStations })), pairs: report.pairs.map(p => ({ a: p.a, b: p.b, minimumPenetrationM: p.continuousStationDomainMinimumPenetrationM })), rngCalls, nativeWork: report.nativeSearch.work }));
