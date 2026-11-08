// Read-only reachability evidence from the exact native core and production 150m flight boundary.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { createFlightBoundary, FLIGHT_GRACE } = await import(pathToFileURL(root + '/game/src/drone-boundary.js'));
const source = root + '/game/data/seattle-seatac.json';
const nativeFile = root + '/handoffs/fidelity/original-districts-refresh/proof/scenery-bridge-ordering/native-143dca/seattle-seatac-profile-dump.json.gz';
const data = JSON.parse(fs.readFileSync(source)), native = JSON.parse(gunzipSync(fs.readFileSync(nativeFile)));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const m = data.district.mask, bits = new Uint8Array(m.w * m.h); let k = 0, v = 0;
for (const run of m.rle) { bits.fill(v, k, k + run); k += run; v ^= 1; }
const B = (i, j) => i >= 0 && j >= 0 && i < m.w && j < m.h && bits[j * m.w + i] === 1;
const inside = (x, z) => B(Math.floor((x - m.x0) / m.cell), Math.floor((z - m.z0) / m.cell));
const segments = [];
// Individual cell-boundary segments have the exact same union as the merged straight runs in world.js.
for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (B(i, j)) {
    const x = m.x0 + i * m.cell, z = m.z0 + j * m.cell, c = m.cell;
    if (!B(i - 1, j)) segments.push({ ax: x, az: z, bx: x, bz: z + c });
    if (!B(i + 1, j)) segments.push({ ax: x + c, az: z, bx: x + c, bz: z + c });
    if (!B(i, j - 1)) segments.push({ ax: x, az: z, bx: x + c, bz: z });
    if (!B(i, j + 1)) segments.push({ ax: x, az: z + c, bx: x + c, bz: z + c });
}
const boundary = createFlightBoundary({ inside, segments });
const nearest = (p, filter = () => true) => native.core.filter(filter).map(e => {
    const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, ll = dx * dx + dz * dz;
    const t = ll ? Math.max(0, Math.min(1, ((p.x - e.a.x) * dx + (p.z - e.a.z) * dz) / ll)) : 0;
    const x = e.a.x + dx * t, z = e.a.z + dz * t;
    return { distanceM: Math.hypot(p.x - x, p.z - z), edgeId: e.id, sourceId: e.sourceId, x, z,
             roadDisplacementM: e.ya + (e.yb - e.ya) * t, publicDrive: e.publicDrive };
}).sort((a, b) => a.distanceM - b.distanceM)[0];
const points = [
    { label: 'Actual recorded upper/lower contact', x: -936.5227707050664, z: -1082.1481820196298 },
    { label: 'Actual four-arm source junction430536585', x: -902.0221829258136, z: -1072.5349319997863 },
].map(p => ({ ...p, insidePlayableMask: inside(p.x, p.z), distanceFromFlightDomain: boundary.sample(p.x, p.z),
              allowedByProductionFlightBoundary: boundary.allowed(p), nearestNativeCore: nearest(p),
              nearestPublicNativeCore: nearest(p, e => e.publicDrive !== false) }));
if (points.some(p => p.insidePlayableMask || p.allowedByProductionFlightBoundary)) throw Error('Reachability changed; review actual runtime before reusing this classification');
console.log(JSON.stringify({ scope: 'CPU read-only audit of retained actual native143dca source core. SeaTac has no Dinamo landmark domain extension. The exact source mask cell union is passed to the production createFlightBoundary function; no flight/controller movement is claimed.',
    sourceData: { path: path.relative(root, source), sha256: sha(source) },
    nativeCore: { sourceCommit: native.gameSourceCommit, path: path.relative(root, nativeFile), sha256: sha(nativeFile), edges: native.core.length },
    productionFlightGraceM: FLIGHT_GRACE, points,
    upperSourceNativeCoreEdges: native.core.filter(e => e.sourceId === 'w37017434').length,
    actualJunctionNativeCoreEdges: native.core.filter(e => e.a.sourceId === 430536585 || e.b.sourceId === 430536585).length,
    finding: 'The open S160 contact and four-arm junction are passive scenery outside both the playable mask and legal150m drone envelope. The visual terrain-model gap remains visible context; this classification does not clear the native body query or establish scenery fidelity.'
}, null, 2));
