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

self.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'pack') { fetchDistrictPackText(m.url).then((text) => self.postMessage({ id: m.id, text }), (e) => self.postMessage({ id: m.id, error: String(e && e.stack || e) })); return; }
    try {
        if (m.type === 'reset') { roofs.clear(); cuts = []; overlapLive = []; overlapIndex = new Map(); overlapCells = null; return; }
        if (m.type === 'roofs') { for (const [i, flat] of m.roofs) roofs.set(i, unpack(flat, 3)); return; }
        if (m.type === 'clip') {
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
            self.postMessage({ id: m.id, clippedAreaM2: r.clippedAreaM2, issues: r.issues, faces: out }, out ? [out.buffer] : []);
            return;
        }
        if (m.type === 'fallbackCuts') { cuts = m.cuts.map((c) => { const poly = []; for (let k = 0; k < c.poly.length; k += 2) poly.push([c.poly[k], c.poly[k + 1]]); return { poly, x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1 }; }); return; }
        if (m.type === 'fallback') {
            const st = fallbackVisit(m.box, Array.from(m.nearby, (i) => cuts[i]), fallbackState({ report: { known: true, reason: null, nodes: 0, leaves: 0 }, ...m.params }));
            const out = { positions: Float64Array.from(st.positions), normals: Float64Array.from(st.normals), uv: Float64Array.from(st.uv), indices: Float64Array.from(st.indices) };
            self.postMessage({ id: m.id, report: st.report, parts: st.parts, ...out }, [out.positions.buffer, out.normals.buffer, out.uv.buffer, out.indices.buffer]);
            return;
        }
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
