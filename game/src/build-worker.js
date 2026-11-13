// Module worker for pure, data-in / data-out passes of buildWorld (spec 10 load budget). It runs the same functions the
// main thread would, on the same numbers, so the results are bit-identical; world.js decides where they go.
// Numbers travel as Float64Array (exact). Messages: see build-pool.js.
import { clipInferredBuildingDetail } from './building-detail-visibility.js';
import { fallbackVisit, fallbackState } from './fallback-partition.js';
import { overlapCandidates, overlapPieces, unpackOverlapRecords, overlapGrid } from './building-overlap.js';
import { fetchDistrictPackText } from './district-pack.js';
import { roofMesh } from './building-roofs.js';
import { triangulate } from './triangulate.js';
import { shapeDeckSoup } from './bridge-surface-mesh.js';
import { sharedContextFromSpec, sharedEdgeHeight, descentFromSpec, padFromSpec } from './bridge-height-models.js';

let overlapLive = [], overlapIndex = new Map(), overlapCells = null; // the live building records of this build (overlap cuts)
let cuts = []; // fallback ground source openings of this build, sent once per worker
const specs = new Map(), roofs = new Map(); // building index → roof spec (sent once per worker) / its complete roof faces
// a neighbour's complete roof, as world.js completeDetailRoof makes it (1: roofMesh of its profile, 2: flat at its height)
const roofFaces = (i) => {
    let f = roofs.get(i); if (f) return f;
    const sp = specs.get(i);
    if (sp.kind === 1) f = roofMesh(sp.ring, sp.holes, sp.profile, triangulate).faces;
    else { const { pts, tris } = triangulate(sp.ring, sp.holes); f = tris.map((t) => t.map((k) => [pts[k][0], sp.h, pts[k][1]])); }
    roofs.set(i, f); return f;
};
// deck height models of this build (world.js deckModels): made from their specs on first use
let deckSpec = null, deckShared = null;
const deckDescents = new Map(), deckPads = new Map();
const padOf = (id) => { if (!deckSpec.padIds.has(id)) return undefined; let f = deckPads.get(id); if (!f) deckPads.set(id, f = padFromSpec(deckSpec.padIds.get(id))); return f; };
function deckHeight(grade, verge) {
    let f;
    if (grade.kind === 'shared') { deckShared ||= sharedContextFromSpec(deckSpec.shared); const { atWorld } = sharedEdgeHeight(deckShared, grade.edge, padOf); f = (x, z) => atWorld([x, z]); }
    else if (grade.kind === 'descent') { let d = deckDescents.get(grade.modelId); if (!d) deckDescents.set(grade.modelId, d = descentFromSpec(deckSpec.descents.find((s) => s.modelId === grade.modelId))); f = d.atWorld; }
    else throw new Error('deck: unknown grade ' + grade.kind);
    // world.js's verge rule for an embankment ramp: beyond its sidewalk the ground stays down
    if (!verge) return f;
    return (x, z) => { const lat = (x - verge.ax) * verge.nx + (z - verge.az) * verge.nz; return Math.abs(lat) <= (lat >= 0 ? verge.wPos : verge.wNeg) + 0.05 ? f(x, z) : Math.min(0, f(x, z)); };
}
const ring = (a) => { const r = []; for (let k = 0; k < a.length; k += 2) r.push([a[k], a[k + 1]]); return r; };
const unpack = (flat, size) => { const faces = []; for (let k = 0; k < flat.length; k += 3 * size) { const f = []; for (let j = 0; j < 3; j++) f.push(Array.from(flat.subarray(k + j * size, k + (j + 1) * size))); faces.push(f); } return faces; };

function fallbackLeaf(box, nearby, params) {
    const st = fallbackVisit(box, Array.from(nearby, (i) => cuts[i]), fallbackState({ report: { known: true, reason: null, nodes: 0, leaves: 0 }, ...params }));
    return { report: st.report, parts: st.parts, positions: Float64Array.from(st.positions), normals: Float64Array.from(st.normals), uv: Float64Array.from(st.uv), indices: Float64Array.from(st.indices) };
}
const fallbackBuffers = (r) => [r.positions.buffer, r.normals.buffer, r.uv.buffer, r.indices.buffer];
function clipJob(m) {
    const faces = unpack(m.faces, 12);
    const neighbours = m.neighbours.map((n) => (n.roof ? { i: n.i, sourceId: n.sourceId, minH: n.minH, mesh: { faces: roofFaces(n.i) } } : { i: n.i, sourceId: n.sourceId, minH: n.minH }));
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
        if (m.type === 'reset') { roofs.clear(); specs.clear(); deckSpec = null; deckShared = null; deckDescents.clear(); deckPads.clear(); cuts = []; overlapLive = []; overlapIndex = new Map(); overlapCells = null; return; }
        if (m.type === 'deckModels') { deckSpec = { ...m.spec, padIds: new Map(m.spec.pads) }; deckShared = null; deckDescents.clear(); deckPads.clear(); return; }
        if (m.type === 'deck') { const r = shapeDeckSoup(m.input, deckHeight(m.grade, m.verge)); self.postMessage({ id: m.id, ...r }, [r.p.buffer, r.n.buffer, r.u.buffer, r.c.buffer]); return; }
        if (m.type === 'roofSpecs') { for (const sp of m.specs) specs.set(sp.i, { kind: sp.kind, ring: ring(sp.ring), holes: sp.holes.map(ring), profile: sp.profile, h: sp.h }); return; }
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
