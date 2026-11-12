// A small pool of module workers (build-worker.js) for buildWorld's pure passes (spec 10: district loads < 4 s).
// createBuildPool() returns null where module workers are unavailable; callers then compute on the main thread.
// Jobs go to the least busy worker; a worker answers in order, so data it needs (roofs) is sent to it first.
export function createBuildPool(size = Math.max(1, Math.min(6, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 1))) {
    if (typeof Worker === 'undefined') return null;
    let workers;
    try { workers = Array.from({ length: size }, () => new Worker(new URL('./build-worker.js', import.meta.url), { type: 'module' })); }
    catch (e) { return null; }
    const state = workers.map((w) => ({ w, busy: 0, roofs: new Set() })), pending = new Map();
    let next = 0, failed = null;
    for (const s of state) {
        s.w.onmessage = (ev) => { const r = ev.data, p = pending.get(r.id); if (!p) return; pending.delete(r.id); s.busy--; if (r.error) p.reject(new Error(r.error)); else p.resolve(r); };
        s.w.onerror = (ev) => { failed = new Error('build worker failed: ' + (ev.message || 'error')); for (const [, p] of pending) p.reject(failed); pending.clear(); };
    }
    const pick = () => state.reduce((a, b) => (b.busy < a.busy ? b : a));
    return {
        size,
        /** inferred-detail clip job: faces Float64Array (36 per face), owner {i, sourceId}, neighbours [{i, sourceId, minH,
         *  roof: Float64Array (9 per face) | null}] → Promise<{clippedAreaM2, issues, faces: Float64Array | null}> */
        clip(faces, owner, neighbours) {
            if (failed) return Promise.reject(failed);
            const s = pick(), id = next++, roofs = [];
            for (const n of neighbours) if (n.roof && !s.roofs.has(n.i)) { s.roofs.add(n.i); roofs.push([n.i, n.roof]); }
            if (roofs.length) s.w.postMessage({ type: 'roofs', roofs });
            s.busy++;
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject });
                s.w.postMessage({ type: 'clip', id, faces, owner, neighbours: neighbours.map((n) => ({ i: n.i, sourceId: n.sourceId, minH: n.minH, roof: !!n.roof })) });
            });
        },
        /** the fallback ground's source openings ({poly: [[x, z]…], x0, x1, z0, z1}), to every worker */
        fallbackCuts(cuts) {
            const msg = { type: 'fallbackCuts', cuts: cuts.map((c) => { const poly = new Float64Array(c.poly.length * 2); c.poly.forEach((q, k) => { poly[2 * k] = q[0]; poly[2 * k + 1] = q[1]; }); return { poly, x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1 }; }) };
            for (const s of state) s.w.postMessage(msg);
        },
        /** walk one fallback-ground subtree (fallbackVisit) → Promise<{report, parts, positions, normals, uv, indices}> */
        fallback(box, nearby, params) { return this.job({ type: 'fallback', box, nearby, params }); },
        /** the live building records for the overlap cuts (packOverlapRecords), to every worker */
        overlapRecords(packed) { for (const s of state) s.w.postMessage({ type: 'overlapRecs', packed }); },
        /** plan the overlap cuts of live[from…to) → Promise<{cuts, skipped, holeParts}> */
        overlap(from, to, opts) { return this.job({ type: 'overlap', from, to, opts }); },
        job(msg) {
            if (failed) return Promise.reject(failed);
            const s = pick(), id = next++; s.busy++;
            return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); s.w.postMessage({ ...msg, id }); });
        },
        close() { for (const s of state) s.w.terminate(); },
    };
}
