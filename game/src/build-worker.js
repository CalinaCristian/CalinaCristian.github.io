// Module worker for pure, data-in / data-out passes of buildWorld (spec 10 load budget). It runs the same functions the
// main thread would, on the same numbers, so the results are bit-identical; world.js decides where they go.
// Numbers travel as Float64Array (exact). Messages: see build-pool.js.
import { clipInferredBuildingDetail } from './building-detail-visibility.js';
import { fallbackVisit, fallbackState } from './fallback-partition.js';
import { overlapCandidates, overlapPieces, unpackOverlapRecords, overlapGrid } from './building-overlap.js';
import { fetchDistrictPackText } from './district-pack.js';

let overlapLive = [], overlapIndex = new Map(), overlapCells = null; // the live building records of this build (overlap cuts)
let cuts = []; // fallback ground source openings of this build, sent once per worker
const roofs = new Map(); // building index → complete roof faces ([[x, y, z] × 3] …), sent once per worker
const unpack = (flat, size) => { const faces = []; for (let k = 0; k < flat.length; k += 3 * size) { const f = []; for (let j = 0; j < 3; j++) f.push(Array.from(flat.subarray(k + j * size, k + (j + 1) * size))); faces.push(f); } return faces; };

function fallbackLeaf(box, nearby, params) {
    const st = fallbackVisit(box, Array.from(nearby, (i) => cuts[i]), fallbackState({ report: { known: true, reason: null, nodes: 0, leaves: 0 }, ...params }));
    return { report: st.report, parts: st.parts, positions: Float64Array.from(st.positions), normals: Float64Array.from(st.normals), uv: Float64Array.from(st.uv), indices: Float64Array.from(st.indices) };
}
const fallbackBuffers = (r) => [r.positions.buffer, r.normals.buffer, r.uv.buffer, r.indices.buffer];
function clipJob(m) {
    const faces = unpack(m.faces, 12);
    const neighbours = m.neighbours.map((n) => (n.roof ? { i: n.i, sourceId: n.sourceId, minH: n.minH, mesh: { faces: roofs.get(n.i) } } : { i: n.i, sourceId: n.sourceId, minH: n.minH }));
    const r = clipInferredBuildingDetail(faces, m.owner, neighbours, { inferred: true });
    // the faces only matter when the range is replaced (clippedAreaM2 > 1e-10); points keep their 12 attributes
    let out = null;
    if (r.clippedAreaM2 > 1e-10) {
        out = new Float64Array(r.faces.length * 36);
        let k = 0;
        for (const f of r.faces) { if (f.length !== 3) throw new Error('clip: non-triangle face'); for (const p of f) { if (p.length !== 12) throw new Error('clip: point with ' + p.length + ' attributes'); out.set(p, k); k += 12; } }
    }
    return { id: m.id, clippedAreaM2: r.clippedAreaM2, issues: r.issues, faces: out };
}

self.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'pack') { fetchDistrictPackText(m.url).then((text) => self.postMessage({ id: m.id, text }), (e) => self.postMessage({ id: m.id, error: String(e && e.stack || e) })); return; }
    try {
        if (m.type === 'reset') { roofs.clear(); cuts = []; overlapLive = []; overlapIndex = new Map(); overlapCells = null; return; }
        if (m.type === 'roofs') { for (const [i, flat] of m.roofs) roofs.set(i, unpack(flat, 3)); return; }
        if (m.type === 'clip') { const r = clipJob(m); self.postMessage(r, r.faces ? [r.faces.buffer] : []); return; }
        if (m.type === 'clips') {
            // flat columns (build-pool.js flush): neighbour minH travels as a double (undefined → NaN: both fail the finite test)
            const batch = [];
            for (let k = 0, f = 0, q = 0; k < m.ids.length; k++) {
                const neighbours = [];
                for (; q < m.nEnd[k]; q++) neighbours.push({ i: m.nI[q], sourceId: m.nSid[q], minH: m.nMinH[q], roof: m.nRoof[q] === 1 });
                const job = { id: m.ids[k], faces: m.faces.subarray(f, m.faceEnd[k]), owner: { i: m.ownerI[k], sourceId: m.ownerSid[k] }, neighbours };
                f = m.faceEnd[k];
                try { batch.push(clipJob(job)); } catch (e) { batch.push({ id: job.id, error: String(e && e.stack || e) }); }
            }
            self.postMessage({ batch }, batch.flatMap((r) => (r.faces ? [r.faces.buffer] : [])));
            return;
        }
        if (m.type === 'fallbackCuts') {
            const { lens, boxes, coords } = m; let k = 0; cuts = [];
            for (let i = 0; i < lens.length; i++) { const poly = []; for (let q = 0; q < lens[i]; q++) { poly.push([coords[k], coords[k + 1]]); k += 2; } cuts.push({ poly, x0: boxes[4 * i], x1: boxes[4 * i + 1], z0: boxes[4 * i + 2], z1: boxes[4 * i + 3] }); }
            return;
        }
        if (m.type === 'fallback') { const r = fallbackLeaf(m.box, m.nearby, m.params); self.postMessage({ id: m.id, ...r }, fallbackBuffers(r)); return; }
        if (m.type === 'fallbackBatch') { const results = m.leaves.map((l) => fallbackLeaf(l.box, l.nearby, m.params)); self.postMessage({ id: m.id, results }, results.flatMap(fallbackBuffers)); return; }
        if (m.type === 'overlapRecs') { overlapLive = unpackOverlapRecords(m.packed); overlapIndex = new Map(overlapLive.map((b, k) => [b, k])); overlapCells = overlapGrid(overlapLive); return; }
        if (m.type === 'overlap') {
            const { cutters, skipped } = overlapCandidates(overlapLive, m.from, m.to, m.opts, overlapCells), cuts = overlapPieces(cutters, m.opts), holeParts = [];
            for (let k = m.from; k < m.to; k++) if (overlapLive[k].holeParts) holeParts.push([k, overlapLive[k].holeParts]);
            // lowerRing travels in the same message as the pieces, so shared point objects stay recognisable
            self.postMessage({ id: m.id, skipped, holeParts, cuts: cuts.map((c) => ({ lower: overlapIndex.get(c.lower), lowerRing: c.lower.ring, tallers: c.tallers.map((t) => overlapIndex.get(t)), overlapM2: c.overlapM2, pieces: c.pieces, removedM2: c.removedM2 })) });
            return;
        }
        throw new Error('build worker: unknown message ' + m.type);
    } catch (e) {
        self.postMessage({ id: m.id, error: String(e && e.stack || e) });
    }
};
