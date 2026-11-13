// ============================================================================
//  Frame budget helpers for the tourist scenes (1.5 M triangles / 400 draw calls per High frame).
//  Nothing here removes or simplifies content: the same triangles exist, fewer are submitted.
//
//  compactMaterialGroups(root)   a mesh with a material ARRAY is drawn once per geometry group; a sign board
//                                ([side, side, side, side, face, side]) cost 6 calls per pass. Groups that use the same
//                                material are made contiguous in the index and merged (same pixels, 2 calls).
//  batchSourceContext(ctx)       the literal city context (16 700 source buildings, 855 k triangles) was drawn as one
//                                mesh per material per 800 m chunk: ~270 meshes, culled 800 m at a time. Here each
//                                material is ONE multi-draw (THREE.BatchedMesh over the cache's own vertex arrays, no
//                                copy) whose items are 120 m cells with their own bounds: frustum culling per cell,
//                                and horizonCuller() can hide cells that are entirely behind nearer solid blocks.
//  horizonCuller(ctx, o)         per camera position a skyline (azimuth → elevation angle) of the solid building shells
//                                given as occluders; an item whose box lies wholly under that skyline is not submitted.
//                                Conservative: occluder tops are lowered by a margin, items need every azimuth bin hidden.
//  batchUnits(groups, name)      many small GeoBatch builds (one per building face …) as ONE multi-draw per material with
//                                per-unit bounds: frustum + skyline culling per unit, the draw calls of one merged mesh.
//  castProxy(batch, name)        a plain, colourless mesh that only casts the sun shadow (walls, roofs, canopies) so that
//                                a facade's thousands of frames, sills and glazing bars do not go through the shadow pass.
//  distanceHide(meshes, d)       sub-pixel parts (far-LOD tree trunks under their crowns) are not submitted beyond d metres.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';

/** merge geometry groups that share a material (lossless). Returns { meshes, before, after } group counts. */
export function compactMaterialGroups(root) {
    const use = new Map(), stat = { meshes: 0, before: 0, after: 0 };
    root.traverse((o) => {
        if (!o.isMesh || o.isBatchedMesh || !o.geometry) return;
        const g = o.geometry, rec = use.get(g) || { sig: null, bad: false, meshes: [] }; use.set(g, rec);
        if (!Array.isArray(o.material) || !g.index || !(g.groups?.length > 1)) { rec.bad = true; return; }
        const canon = g.groups.map((gr) => o.material.indexOf(o.material[gr.materialIndex])), sig = canon.join(',');
        if (rec.sig != null && rec.sig !== sig) rec.bad = true;
        rec.sig = sig; rec.canon = canon; rec.meshes.push(o);
    });
    for (const [g, rec] of use) {
        if (rec.bad || !rec.meshes.length) continue;
        const order = [...new Set(rec.canon)].filter((k) => k >= 0); if (order.length >= g.groups.length) continue;
        const src = g.index.array, out = new src.constructor(src.length), groups = []; let at = 0;
        for (const k of order) { const start = at;
            g.groups.forEach((gr, i) => { if (rec.canon[i] !== k) return; const n = Math.min(gr.count, src.length - gr.start); out.set(src.subarray(gr.start, gr.start + n), at); at += n; });
            groups.push({ start, count: at - start, materialIndex: k }); }
        stat.meshes += rec.meshes.length; stat.before += g.groups.length * rec.meshes.length; stat.after += groups.length * rec.meshes.length;
        g.setIndex(new THREE.BufferAttribute(at === out.length ? out : out.slice(0, at), 1)); g.groups = groups;
    }
    return stat;
}

/**
 * The literal source city context as one multi-draw per material (see the header). Call after addSourceContext(ctx).
 * Falls back to the original chunk meshes when the browser has no WEBGL_multi_draw (checked on the first update).
 * @returns {{ items: {mesh, id, box:THREE.Box3}[], meshes: THREE.BatchedMesh[] } | null}
 */
export function batchSourceContext(ctx, { cellM = 120 } = {}) {
    const state = ctx.extras.sourceContext, group = state?.group; if (!group) return null;
    // The zero-copy table below is written into THREE.BatchedMesh's own records (r170 layout). On any other layout the
    // city stays as the builder's 800 m chunk meshes: slower, never wrong (frame-budget.test.mjs pins the vendored layout).
    if (!batchedInternals()) { state.batched = { cellM, items: 0, triangles: 0, fallback: 'BatchedMesh layout is not the r170 one: 800 m chunk meshes' }; return null; }
    const p = state.packet, omit = state.visualOmitIds || state.modelOmitIds, centre = new Map();
    for (const b of p.data.buildings) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of b.poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } centre.set(b.id, [(x0 + x1) / 2, (z0 + z1) / 2]); }
    const old = group.children.slice(), matOf = new Map(); for (const m of old) matOf.set(m.name.split(':')[1], m.material);
    const meshes = [], items = [], v = new THREE.Vector3(); let triangles = 0;
    group.updateMatrixWorld(true);
    for (const batch of p.batches) {
        const material = matOf.get(batch.key); if (!material) continue;
        const cells = new Map(); let total = 0;
        for (const r of batch.sourceRanges) { if (omit.has(r.source)) continue; const c = centre.get(r.source); if (!c) continue;
            const key = Math.floor(c[0] / cellM) + ',' + Math.floor(c[1] / cellM), a = cells.get(key) || []; a.push(r); cells.set(key, a); total += r.count; }
        if (!total) continue;
        const pos = batch.attributes.position.array, vcount = pos.length / 3, index = new (vcount > 65535 ? Uint32Array : Uint16Array)(total);
        const geo = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(batch.attributes)) geo.setAttribute(k, new THREE.BufferAttribute(a.array, a.itemSize)); geo.setIndex(new THREE.BufferAttribute(index, 1));
        const bm = new THREE.BatchedMesh(cells.size, 1, 1, material);
        // the batch keeps the cache's vertex arrays (no copy): its geometry table is filled directly — each item is an index range
        bm.geometry.dispose(); bm.geometry = geo; bm._geometryInitialized = true; bm._maxVertexCount = vcount; bm._maxIndexCount = total;
        let at = 0;
        for (const ranges of cells.values()) { const start = at, box = new THREE.Box3();
            for (const r of ranges) { index.set(batch.index.subarray(r.start, r.start + r.count), at); at += r.count; }
            for (let i = start; i < at; i++) { const k = index[i] * 3; box.expandByPoint(v.set(pos[k], pos[k + 1], pos[k + 2])); }
            const sphere = box.getBoundingSphere(new THREE.Sphere());
            bm._geometryInfo.push({ vertexStart: 0, vertexCount: vcount, reservedVertexCount: vcount, indexStart: start, indexCount: at - start, reservedIndexCount: at - start, start, count: at - start, boundingBox: box, boundingSphere: sphere, active: true });
            const id = bm.addInstance(bm._geometryCount++);
            items.push({ mesh: bm, id, box: box.clone().applyMatrix4(group.matrixWorld), set(vis) { bm.setVisibleAt(id, vis); } }); }
        bm._nextIndexStart = total; bm._nextVertexStart = vcount;
        bm.sortObjects = false; bm.castShadow = false; bm.receiveShadow = false; bm.name = 'source-context:' + batch.key;
        bm.userData.sourceContext = true; bm.userData.sourceTriangleCount = total / 3; triangles += total / 3;
        bm.computeBoundingBox(); bm.computeBoundingSphere();
        meshes.push(bm);
    }
    for (const m of old) group.remove(m);
    for (const m of meshes) group.add(m);
    state.meshChunks = meshes.length; state.batched = { cellM, items: items.length, triangles };
    let checked = false;
    ctx.onUpdate((dt, s) => { if (checked) return; const r = s?.r3d?.renderer; if (!r) return; checked = true;
        if (r.extensions.has('WEBGL_multi_draw')) { for (const m of old) m.geometry.dispose(); return; }
        for (const m of meshes) group.remove(m); for (const m of old) group.add(m); for (const it of items) it.set = () => {}; state.batched.fallback = 'no WEBGL_multi_draw: 800 m chunk meshes'; state.meshChunks = old.length; });
    (ctx.extras.sceneCleanups ||= []).push(() => { for (const m of meshes) m.dispose(); });
    return { items, meshes };
}
/** the BatchedMesh records batchSourceContext() fills by hand exist with the r170 shape (probed on a throw-away batch) */
export function batchedInternals() {
    try {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); g.setIndex([0, 1, 2]);
        const bm = new THREE.BatchedMesh(1, 3, 3, new THREE.MeshBasicMaterial()), id = bm.addInstance(bm.addGeometry(g)), info = bm._geometryInfo?.[0];
        const ok = id === 0 && bm._geometryInitialized === true && bm._geometryCount === 1 && bm._maxVertexCount === 3 && bm._maxIndexCount === 3 && bm._nextIndexStart === 3 && bm._nextVertexStart === 3
            && !!info && ['vertexStart', 'vertexCount', 'reservedVertexCount', 'indexStart', 'indexCount', 'reservedIndexCount', 'start', 'count', 'boundingBox', 'boundingSphere', 'active'].every((k) => k in info);
        bm.dispose(); g.dispose(); return ok;
    } catch { return false; }
}

/**
 * Skyline occlusion. occluders: [{ poly:[[x,z]…], top }] solid shells standing on the ground (top = wall top, world y).
 * items: [{ box:THREE.Box3 (world), set(visible) }]. Returns { update(camera), stats }.
 * A bin's skyline is the highest angle that some wall segment covers across the WHOLE bin; an item is hidden when the
 * top of its box, seen from the eye at its nearest horizontal distance, is below the skyline of every bin it spans,
 * and it lies beyond every wall that made those bins (walls nearer than the item's nearest point).
 */
export function horizonCuller({ occluders = [], items = [], bins = 720, reach = 260, minDist = 10, margin = (h) => Math.max(2, h * 0.3), step = 1.5 } = {}) {
    const segs = [];
    for (const o of occluders) { const P = o.poly, n = P.length; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) continue; segs.push([a[0], a[1], b[0], b[1], o.top - margin(o.h ?? 10)]); } }
    const elev = new Float32Array(bins), dist = new Float32Array(bins), TAU = Math.PI * 2, bw = TAU / bins;
    const stats = { segs: segs.length, items: items.length, hidden: 0, updates: 0 };
    let lx = 1e9, ly = 1e9, lz = 1e9;
    const eye = new THREE.Vector3();
    function skyline(ex, ey, ez) {
        elev.fill(-9); dist.fill(0);
        for (const s of segs) {
            const ax = s[0] - ex, az = s[1] - ez, bx = s[2] - ex, bz = s[3] - ez, da = Math.hypot(ax, az), db = Math.hypot(bx, bz);
            if (Math.min(da, db) > reach || s[4] <= ey) continue;
            let a0 = Math.atan2(ax, -az), a1 = Math.atan2(bx, -bz), d = a1 - a0; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
            if (Math.abs(d) < bw) continue;
            if (d < 0) { a0 = a1; d = -d; }
            // bins wholly inside [a0, a0 + d]
            const first = Math.ceil(a0 / bw), last = Math.floor((a0 + d) / bw) - 1; if (last < first) continue;
            const far = Math.max(da, db), e = (s[4] - ey) / far; // lowest angle (tan) of the wall top anywhere along the segment
            for (let k = first; k <= last; k++) { const i = ((k % bins) + bins) % bins; if (e > elev[i]) { elev[i] = e; dist[i] = far; } }
        }
    }
    function update(camera) {
        camera.getWorldPosition(eye);
        if (stats.off) { if (lx < 1e8) { lx = 1e9; for (const it of items) if (it.vis === false) { it.vis = true; it.set(true); } stats.hidden = 0; } return false; } // (dev A/B: stats.off = true shows everything)
        if (Math.abs(eye.x - lx) + Math.abs(eye.z - lz) < step && Math.abs(eye.y - ly) < 0.5) return false;
        lx = eye.x; ly = eye.y; lz = eye.z; skyline(eye.x, eye.y, eye.z); stats.updates++; let hidden = 0;
        for (const it of items) {
            const b = it.box, cx = Math.max(b.min.x, Math.min(eye.x, b.max.x)), cz = Math.max(b.min.z, Math.min(eye.z, b.max.z)), near = Math.hypot(cx - eye.x, cz - eye.z);
            let vis = true;
            if (near > minDist) {
                const e = Math.max(0, (b.max.y - eye.y) / near); // highest possible angle (tan) of anything in the box
                // azimuth span of the box (its four corners)
                let lo = 1e9, hi = -1e9, ref = Math.atan2((b.min.x + b.max.x) / 2 - eye.x, -((b.min.z + b.max.z) / 2 - eye.z));
                for (let c = 0; c < 4; c++) { let a = Math.atan2((c & 1 ? b.max.x : b.min.x) - eye.x, -((c & 2 ? b.max.z : b.min.z) - eye.z)) - ref; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; if (a < lo) lo = a; if (a > hi) hi = a; }
                const first = Math.floor((ref + lo) / bw), last = Math.floor((ref + hi) / bw); vis = false;
                for (let k = first; k <= last; k++) { const i = ((k % bins) + bins) % bins; if (!(elev[i] > e) || dist[i] >= near) { vis = true; break; } }
            }
            if (it.vis !== vis) { it.vis = vis; it.set(vis); } if (!vis) hidden++;
        }
        stats.hidden = hidden; return true;
    }
    return { update, stats, reset() { lx = 1e9; } };
}

/**
 * Solid shells for horizonCuller from the scene's colliders: OSM / source buildings that stand on the ground (the
 * builders give those a base 30 m under their floor) and the colliders a scene marks `solid: true`. Open structures
 * (canopies, decks, glass houses) must not be marked.
 */
export function solidShells(ctx, { pad = 300 } = {}) {
    const out = [], g = ctx.ground, B = ctx.extras.terrainBox || { x0: -400, z0: -400, x1: 400, z1: 400 };
    for (const c of ctx.colliders) { if (!c.poly || c.poly.length < 3 || !(c.y1 < 900) || c.x < B.x0 - pad || c.x > B.x1 + pad || c.z < B.z0 - pad || c.z > B.z1 + pad) continue;
        let lo = 1e9, hi = -1e9; for (const [x, z] of c.poly) { const y = g.heightAt(x, z); if (y < lo) lo = y; if (y > hi) hi = y; }
        if (!(c.solid || (c.building && c.sources && c.y0 <= lo - 5)) || c.y1 - hi < 4) continue;
        out.push({ poly: c.poly, top: c.y1, h: c.y1 - hi }); }
    return out;
}
/** run fn(camera) before every render of the scene with that render's own camera (walk, photo, drone, captures) */
export function onRenderCamera(scene, fn) {
    scene.onBeforeRender = function (renderer, sc, camera, target) { Object.getPrototypeOf(this).onBeforeRender.call(this, renderer, sc, camera, target); fn(camera); };
}

/**
 * GeoBatch.build() groups (one per unit) → one THREE.BatchedMesh per material; a unit = one item with its own bounds.
 * @returns {{ group: THREE.Group, items: {box, set}[], meshes: THREE.Object3D[] }}
 */
export function batchUnits(groups, name, { castShadow = null } = {}) {
    const by = new Map(), out = new THREE.Group(), items = [], meshes = []; out.name = name;
    for (const g of groups) for (const m of g.children) { if (!m.geometry?.index) continue; const a = by.get(m.material) || []; a.push(m); by.set(m.material, a); }
    for (const [material, list] of by) {
        let V = 0, I = 0, uv = false; for (const m of list) { V += m.geometry.attributes.position.count; I += m.geometry.index.count; uv ||= !!m.geometry.attributes.uv; }
        const bm = new THREE.BatchedMesh(list.length, V, I, material); bm.name = list[0].name; bm.sortObjects = false;
        bm.castShadow = castShadow ?? list[0].castShadow; bm.receiveShadow = list[0].receiveShadow;
        for (const m of list) { const g = m.geometry;
            if (uv && !g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
            g.computeBoundingBox(); g.computeBoundingSphere();
            const id = bm.addInstance(bm.addGeometry(g)); items.push({ box: g.boundingBox.clone(), set(v) { bm.setVisibleAt(id, v); } }); g.dispose(); }
        bm.computeBoundingBox(); bm.computeBoundingSphere(); out.add(bm); meshes.push(bm);
    }
    return { group: out, items, meshes };
}
/** browsers without WEBGL_multi_draw would issue one call per unit: there the batches fall back to plain merged meshes */
export function multiDrawGuard(ctx, batch) {
    let checked = false;
    ctx.onUpdate((dt, s) => { if (checked) return; const r = s?.r3d?.renderer; if (!r) return; checked = true; if (r.extensions.has('WEBGL_multi_draw')) return;
        for (const bm of batch.meshes) { const m = new THREE.Mesh(bm.geometry, bm.material); m.name = bm.name; m.castShadow = bm.castShadow; m.receiveShadow = bm.receiveShadow; bm.geometry.computeBoundingSphere(); bm.parent?.add(m); bm.parent?.remove(bm); }
        for (const it of batch.items) it.set = () => {}; });
    (ctx.extras.sceneCleanups ||= []).push(() => { for (const m of batch.meshes) m.dispose(); });
}
/** a GeoBatch as a shadow-only mesh: drawn without colour or depth in the view, a normal caster in the sun's shadow map */
export function castProxy(batch, name) {
    const grp = batch.build(name), mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); mat.name = 'shadow-proxy';
    grp.traverse((m) => { if (!m.isMesh) return; m.material = mat; m.castShadow = true; m.receiveShadow = false; m.userData.skipNormalPrepass = true; m.userData.noFloor = true; m.userData.noAudit = true;
        // in the view it is an empty draw (no triangles); the shadow pass gets the whole range
        const g = m.geometry; m.onBeforeRender = () => g.setDrawRange(0, 0); m.onBeforeShadow = () => g.setDrawRange(0, Infinity); });
    grp.userData.noFloor = true;
    return grp;
}
/** meshes (with a bounding sphere, static) that are not submitted when farther than `d` m from the rendering camera */
export function distanceHide(meshes, d) {
    const eye = new THREE.Vector3(), c = new THREE.Vector3(), list = meshes.map((m) => { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); return { m, mask: m.layers.mask, hidden: false }; });
    const stats = { meshes: list.length, hidden: 0 };
    return { stats, update(camera) { camera.getWorldPosition(eye); let n = 0;
        for (const it of list) { const m = it.m, bs = m.boundingSphere || m.geometry.boundingSphere; c.copy(bs.center).applyMatrix4(m.matrixWorld);
            const far = !stats.off && c.distanceTo(eye) - bs.radius > d; if (far) n++; if (far !== it.hidden) { it.hidden = far; m.layers.mask = far ? 0 : it.mask; } }
        stats.hidden = n; } };
}
