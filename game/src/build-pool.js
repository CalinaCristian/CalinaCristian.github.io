// A small pool of module workers (build-worker.js) for buildWorld's pure passes (spec 10: district loads < 4 s).
// createBuildPool() returns null where module workers are unavailable; callers then compute on the main thread.
// Jobs go to the least busy worker; a worker answers in order, so data it needs (roofs) is sent to it first.
let shared;
/** one pool for the page, created on first use (world.js asks at import, so the workers are ready by the first build) */
export const sharedBuildPool = () => (shared === undefined ? (shared = createBuildPool()) : shared);
export function createBuildPool(size = Math.max(1, Math.min(6, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 1))) {
    if (typeof Worker === 'undefined') return null;
    let workers;
    try { workers = Array.from({ length: size }, () => new Worker(new URL('./build-worker.js', import.meta.url), { type: 'module' })); }
    catch (e) { return null; }
    const state = workers.map((w) => ({ w, busy: 0, specs: new Set() })), pending = new Map();
    let next = 0, failed = null;
    for (const s of state) {
        const settle = (r) => { const p = pending.get(r.id); if (!p) return; pending.delete(r.id); s.busy--; if (r.error) p.reject(new Error(r.error)); else p.resolve(r); };
        s.w.onmessage = (ev) => { const r = ev.data; if (r.batch) for (const x of r.batch) settle(x); else settle(r); };
        s.w.onerror = (ev) => { failed = new Error('build worker failed: ' + (ev.message || 'error')); for (const [, p] of pending) p.reject(failed); pending.clear(); };
    }
    const pick = () => state.reduce((a, b) => (b.busy < a.busy ? b : a));
    // clip jobs travel in batches (one message per CLIP_BATCH jobs, and one answer per batch): a message per job cost more
    // on this thread than the clipping it handed over. flush() sends a partial batch.
    const CLIP_BATCH = 24;
    let batch = [], batchSpecs = new Map();
    return {
        size,
        /** inferred-detail clip job: faces Float64Array (36 per face), owner {i, sourceId}, neighbours [{i, sourceId, minH,
         *  spec: {i, kind (1 roof profile, 2 flat), ring, holes, profile, h} | null}] (a neighbour's spec is sent to a worker
         *  once; the worker makes its complete roof) → Promise<{clippedAreaM2, issues, faces: Float64Array | null}> */
        clip(faces, owner, neighbours) {
            if (failed) return Promise.reject(failed);
            const id = next++;
            for (const n of neighbours) if (n.spec) batchSpecs.set(n.i, n.spec);
            const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
            batch.push({ id, faces, owner, neighbours });
            if (batch.length >= CLIP_BATCH) this.flush();
            return promise;
        },
        /** send the clip jobs gathered so far */
        flush() {
            if (!batch.length) return;
            if (failed) { for (const j of batch) { const p = pending.get(j.id); pending.delete(j.id); p?.reject(failed); } batch = []; batchSpecs = new Map(); return; }
            const s = pick(), specs = [];
            const flat = (r) => { const a = new Float64Array(r.length * 2); r.forEach((p, k) => { a[2 * k] = p[0]; a[2 * k + 1] = p[1]; }); return a; };
            for (const [i, sp] of batchSpecs) if (!s.specs.has(i)) { s.specs.add(i); specs.push({ i, kind: sp.kind, ring: flat(sp.ring), holes: (sp.holes || []).map(flat), profile: sp.profile, h: sp.h }); }
            if (specs.length) s.w.postMessage({ type: 'roofSpecs', specs });
            s.busy += batch.length;
            // the batch as flat columns (few objects to clone): per job its id, owner, face range and neighbour range
            let nf = 0, nn = 0; for (const j of batch) { nf += j.faces.length; nn += j.neighbours.length; }
            const ids = new Float64Array(batch.length), ownerI = new Float64Array(batch.length), ownerSid = new Array(batch.length), faceEnd = new Int32Array(batch.length), nEnd = new Int32Array(batch.length);
            const faces = new Float64Array(nf), nI = new Float64Array(nn), nMinH = new Float64Array(nn), nRoof = new Uint8Array(nn), nSid = new Array(nn);
            let f = 0, q = 0;
            batch.forEach((j, k) => {
                ids[k] = j.id; ownerI[k] = j.owner.i; ownerSid[k] = j.owner.sourceId; faces.set(j.faces, f); f += j.faces.length; faceEnd[k] = f;
                for (const n of j.neighbours) { nI[q] = n.i; nMinH[q] = n.minH; nRoof[q] = n.spec ? 1 : 0; nSid[q] = n.sourceId; q++; }
                nEnd[k] = q;
            });
            s.w.postMessage({ type: 'clips', ids, ownerI, ownerSid, faceEnd, nEnd, faces, nI, nMinH, nRoof, nSid }, [faces.buffer]);
            batch = []; batchSpecs = new Map();
        },
        /** the deck height models of this build (bridge-height-models.js specs: { shared, descents, pads }), to every worker */
        deckModels(spec) { for (const s of state) s.w.postMessage({ type: 'deckModels', spec }); },
        /** shape one deck (bridge-surface-mesh.js shapeDeckSoup) with the height of grade spec `grade` (and the verge rule of
         *  world.js when `verge`) → Promise<{ stats, count, p, n, u, c }> */
        deck(input, grade, verge) { return this.job({ type: 'deck', input, grade, verge }); },
        /** the fallback ground's source openings ({poly: [[x, z]…], x0, x1, z0, z1}), to every worker */
        fallbackCuts(cuts) {
            // three flat arrays (copied by memcpy) instead of an object per opening: the same numbers
            let n = 0; for (const c of cuts) n += c.poly.length;
            const lens = new Int32Array(cuts.length), boxes = new Float64Array(cuts.length * 4), coords = new Float64Array(n * 2);
            let k = 0;
            cuts.forEach((c, i) => { lens[i] = c.poly.length; boxes[4 * i] = c.x0; boxes[4 * i + 1] = c.x1; boxes[4 * i + 2] = c.z0; boxes[4 * i + 3] = c.z1; for (const q of c.poly) { coords[k++] = q[0]; coords[k++] = q[1]; } });
            const msg = { type: 'fallbackCuts', lens, boxes, coords };
            for (const s of state) s.w.postMessage(msg);
        },
        /** walk one fallback-ground subtree (fallbackVisit) → Promise<{report, parts, positions, normals, uv, indices}> */
        fallback(box, nearby, params) { return this.job({ type: 'fallback', box, nearby, params }); },
        /** several subtrees in one message ([{box, nearby: Int32Array}]) → Promise<{results: [as fallback()]}> */
        fallbackBatch(leaves, params) { return this.job({ type: 'fallbackBatch', leaves: leaves.map((l) => ({ box: l.box, nearby: l.nearby.slice() })), params }); },
        /** the live building records for the overlap cuts (packOverlapRecords), to every worker */
        overlapRecords(packed) { for (const s of state) s.w.postMessage({ type: 'overlapRecs', packed }); },
        /** plan the overlap cuts of live[from…to) → Promise<{cuts, skipped, holeParts}> */
        overlap(from, to, opts) { return this.job({ type: 'overlap', from, to, opts }); },
        /** fetch a district pack and decode it to its JSON text (district-pack.js) → Promise<string> */
        packText(url) { return this.job({ type: 'pack', url }).then((r) => r.text); },
        job(msg) {
            if (failed) return Promise.reject(failed);
            const s = pick(), id = next++; s.busy++;
            return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); s.w.postMessage({ ...msg, id }); });
        },
        /** forget the previous build's data (roofs, cuts, records) before a new build */
        reset() { batch = []; batchSpecs = new Map(); for (const s of state) { s.specs.clear(); s.w.postMessage({ type: 'reset' }); } },
        close() { for (const s of state) s.w.terminate(); },
    };
}
