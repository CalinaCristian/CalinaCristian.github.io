// CPU scheduling bounds for changed passive profiles, compared with actual native before quads.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const arg = k => process.argv.find(s => s.startsWith('--' + k + '='))?.slice(k.length + 3);
const root = path.resolve(arg('root')), impact = path.resolve(arg('impact')), native = path.resolve(arg('native'));
const { scenerySourceProfile } = await import(pathToFileURL(root + '/game/src/scenery-source.js'));
const union = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const intersects = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const key = c => c.sourceId + ':' + c.x.toFixed(6) + ',' + c.z.toFixed(6);
const records = [];
for (const spec of process.argv.filter(s => s.startsWith('--atlas=')).map(s => s.slice(8))) {
    const [district, filename] = spec.split('=');
    const d = JSON.parse(fs.readFileSync(root + '/game/data/' + district + '.json'));
    const changes = JSON.parse(fs.readFileSync(impact + '/' + district + '.json'));
    const before = JSON.parse(fs.readFileSync(native + '/' + district + '.json'));
    const poses = JSON.parse(fs.readFileSync(filename));
    const old = new Map(before.cases.filter(c => changes.changedSourceIds.includes(c.sourceId)).map(c => [key(c), c]));
    const quads = [];
    for (const p of changes.candidateProfiles) {
        const profile = scenerySourceProfile(d, p.piece, []), sw = d.scenery[p.piece][1] / 10;
        const side = sw > .5 && !/service|motorway/.test(d.classes[d.scenery[p.piece][2]]) ? Math.max(1.2, sw) : 0;
        for (let i = 1; i < p.points.length; i++) {
            if (p.coveredSegments[i - 1]) continue;
            const a = p.points[i - 1], b = p.points[i];
            const normal = k => { const a = p.points[Math.max(0, k - 1)], b = p.points[Math.min(p.points.length - 1, k + 1)], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]; };
            const n0 = normal(i - 1), n1 = normal(i), left = profile.leftM + side, right = profile.rightM + side;
            const xy = [[a[0] - n0[0] * left, a[1] - n0[1] * left], [b[0] - n1[0] * left, b[1] - n1[1] * left], [b[0] + n1[0] * right, b[1] + n1[1] * right], [a[0] + n0[0] * right, a[1] + n0[1] * right]];
            const q = { sourceId: p.sourceId, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, boundsXZ: [Math.min(...xy.map(v => v[0])), Math.min(...xy.map(v => v[1])), Math.max(...xy.map(v => v[0])), Math.max(...xy.map(v => v[1]))], y0: .24 + Math.min(p.heights[i - 1], p.heights[i]) - p.thicknessM, y1: .24 + Math.max(p.heights[i - 1], p.heights[i]) };
            const previous = old.get(key(q));
            old.delete(key(q));
            if (previous && Math.abs(previous.y0 - q.y0) < 1e-8 && Math.abs(previous.y1 - q.y1) < 1e-8 && q.boundsXZ.every((v, j) => Math.abs(v - previous.boundsXZ[j]) < 1e-7)) continue;
            quads.push({ ...q, previous: previous ? { boundsXZ: previous.boundsXZ, y0: previous.y0, y1: previous.y1 } : null });
        }
    }
    for (const q of old.values()) quads.push({ sourceId: q.sourceId, x: q.x, z: q.z, boundsXZ: q.boundsXZ, y0: q.y0, y1: q.y1, removedPassiveProfile: true });
    const sun = before.lighting?.sunDirection;
    for (const q of quads) {
        let bounds = q.previous ? union(q.boundsXZ, q.previous.boundsXZ) : q.boundsXZ;
        const maxY = Math.max(0, q.y1, q.previous?.y1 ?? 0);
        const dx = sun?.[1] > 0 ? -sun[0] * maxY / sun[1] : 0, dz = sun?.[1] > 0 ? -sun[2] * maxY / sun[1] : 0;
        q.dayShadowBoundsXZ = union(bounds, [bounds[0] + dx, bounds[1] + dz, bounds[2] + dx, bounds[3] + dz]);
        q.reviewBoundsXZ = [q.dayShadowBoundsXZ[0] - 200, q.dayShadowBoundsXZ[1] - 200, q.dayShadowBoundsXZ[2] + 200, q.dayShadowBoundsXZ[3] + 200];
    }
    const frames = prop => poses.filter(p => quads.some(q => intersects(q[prop], p.boundsXZ))).map(p => p.id);
    records.push({ district, geometryUnchanged: changes.geometryUnchanged, changedSourceIds: changes.changedSourceIds, changedQuads: quads.length, lighting: before.lighting, atlasFrames: poses.length, directFrames: frames('boundsXZ'), dayShadowFrames: frames('dayShadowBoundsXZ'), reviewFrames: frames('reviewBoundsXZ'), quads });
}
const result = { baselineCommit: '4378317f3fcdccc886d6c7c1ed092ee15d95db8a', candidateSha256: crypto.createHash('sha256').update(fs.readFileSync(arg('candidate'))).digest('hex'), scope: 'CPU predicted changed emitted quad bounds compared with actual native before geometry. Source XY, widths, core grade and data unchanged. Native candidate collision/render follow-up required. Day shadow projection uses recorded matching summer clear day sun to zero plane. 200 m review margin is conservative scheduling only.', districts: records };
fs.writeFileSync(arg('out'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(records.map(d => ({ district: d.district, quads: d.changedQuads, direct: d.directFrames.length, shadow: d.dayShadowFrames.length, review: d.reviewFrames.length }))));
