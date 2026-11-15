// ============================================================================
//  Spot context façades: whole storeys and bays, plain gables, night windows and a far look
//  (owner, 2026-11-15: "buildings are broken in cijmigiu", "arcul de triumb surrounding area is broken too --
//  buildings without roof that cut windows", "buildings in all tourist palces are broken (top window floor is cut)",
//  "also buildings in distance suck").
//
//  The OSM context buildings of every spot (osm.js buildBuildings, buc.js cityFiller and the cached Seattle source
//  context) map their façade tile from the wall base at the style's storey height: v = (y − base) / (4 · floor). A wall
//  that is not a whole number of storeys high ends in a sliced row of windows under the roof; u restarts and is
//  rounded on every footprint edge, so a curved front mapped as many short OSM edges shows squeezed / stretched
//  window columns that change at each vertex (the front reads as folded); gable and roof walls carry the window grid
//  cut by the roof slope; and at night every façade repeats one 4 × 4 tile of lit windows (curtain walls ~55 % lit,
//  in diagonal stripes once a building is a few pixels wide).
//
//  osm.js / source-buildings.js / kit.js are hashed into the Seattle source-context cache, so the fix is a post-pass
//  over the finished meshes (UVs only: positions, triangles, colliders and the source footprints are unchanged) and
//  a shader patch on the façade materials, as the district worlds do (world-extrusion.js: whole storeys per wall,
//  world-materials.js: lit windows in runs per floor, distance-stable average glow):
//    · per building (wall quads sharing a base and connected through their corners) n = round(height / storey),
//      storey = height / n, so the top storey ends at the eaves with its full window and lintel;
//    · per façade run (consecutive edges turning less than 15°: the mapping kinks of one straight or gently curved
//      front) u runs on along the run with a whole number of bays;
//    · non-rectangular façade faces (gables, mansard / skillion walls) are plain wall (no window cut by the roof), and
//      below the wall base (the footprint's highest ground point) the wall is a plain plinth in the shader;
//    · night windows: lit per window run from a hash of the building, wall, storey and bay; the lit share varies per
//      building (dark and bright blocks, shops mostly lit); beyond ~3 px per window the façade fades to its average
//      colour and glow (no moiré, no speckle). The near look by day is the tile as before.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';

const CONTEXT = /^(osm-buildings|city-filler|source-context):f-/; // façade meshes of the OSM context only (heroes keep their own mapping)
const DONE = new WeakMap(); // uv array → its seed array (normalised once)
const RUN_TURN = Math.cos(15 * Math.PI / 180), Q = 50; // run break at a bend over 15° (a window never folds over a real facet); 2 cm keys

/** Normalise the façade UVs of every context façade mesh under root and patch their materials. Returns stats. */
export function finishContextFacades(root) {
    const groups = new Map(), stats = { meshes: 0, quads: 0, buildings: 0, runs: 0, plainFaces: 0, skipped: 0, storeysChanged: 0, ms: 0 };
    const t0 = performance.now();
    root.traverse((o) => {
        if (!o.isMesh || !CONTEXT.test(o.name || '') || Array.isArray(o.material)) return;
        const g = o.geometry, S = o.material?.userData?.style; if (!g?.index || !g.attributes.uv || !g.attributes.position || !S) return;
        const key = g.attributes.uv; // Seattle source-context chunks share one attribute set per batch
        if (!groups.has(key)) groups.set(key, { S, plain: !/^city-filler/.test(o.name), meshes: [] });
        groups.get(key).meshes.push(o);
    });
    for (const grp of groups.values()) {
        // (the Seattle source-context packet keeps its arrays across visits: a second visit reuses the first result)
        const g0 = grp.meshes[0].geometry, U = g0.attributes.uv.array;
        let seed = DONE.get(U); if (!seed) { seed = normalise(g0.attributes.position, g0.attributes.uv, grp.meshes.map((m) => m.geometry.index.array), grp.S, grp.plain, stats); DONE.set(U, seed); } else stats.reused = (stats.reused || 0) + 1;
        const seedAttr = new THREE.BufferAttribute(seed, 2);
        for (const m of grp.meshes) { m.geometry.setAttribute('facadeSeed', seedAttr); patchWindowLights(m.material); stats.meshes++; }
        g0.attributes.uv.needsUpdate = true;
    }
    stats.ms = Math.round(performance.now() - t0);
    return stats;
}

function normalise(posAttr, uvAttr, indexArrays, S, plainOthers, stats) {
    const P = posAttr.array, U = uvAttr.array, n = posAttr.count, seed = new Float32Array(n * 2);
    if (posAttr.itemSize !== 3 || uvAttr.itemSize !== 2 || posAttr.isInterleavedBufferAttribute || uvAttr.isInterleavedBufferAttribute) return seed;
    const F4 = 4 * (S.floor || 3), bay = S.bay || 3;
    const x = (i) => P[i * 3], y = (i) => P[i * 3 + 1], z = (i) => P[i * 3 + 2], u = (i) => U[i * 2], v = (i) => U[i * 2 + 1];
    const near = (a, b, e = 2e-3) => Math.abs(a - b) <= e;
    const quads = [], others = new Set();
    for (const I of indexArrays) {
        for (let i = 0; i < I.length;) {
            let q = null, rect = false;
            if (i + 6 <= I.length) {
                let k = Infinity; for (let j = 0; j < 6; j++) k = Math.min(k, I[i + j]);
                let mask = 0, ok = true; for (let j = 0; j < 6; j++) { const d = I[i + j] - k; if (d > 3) { ok = false; break; } mask |= 1 << d; }
                if (ok && mask === 15 && k + 3 < n) {
                    const a = k, b = k + 1, c = k + 2, d = k + 3, L = Math.hypot(x(b) - x(a), z(b) - z(a)), h = y(d) - y(a), dv = v(d) - v(a);
                    rect = near(y(a), y(b)) && near(y(c), y(d)) && near(x(a), x(d)) && near(z(a), z(d)) && near(x(b), x(c)) && near(z(b), z(c)) && h > 0.01 && L > 0.01
                        && near(v(a), v(b), 1e-5) && near(v(c), v(d), 1e-5) && near(u(a), u(d), 1e-5) && near(u(b), u(c), 1e-5) && Math.abs(dv) > 1e-6;
                    // a wall quad mapped at the style's storey height (another mapping: left exactly as it is)
                    if (rect && Math.abs(h / dv / F4 - 1) < 0.02) q = { k, ax: x(a), az: z(a), bx: x(b), bz: z(b), y0: y(a), y1: y(d), base: y(a) - v(a) * (h / dv) };
                }
            }
            if (q) { quads.push(q); i += 6; } else if (rect) { stats.skipped++; i += 6; } else { if (i + 3 <= I.length) for (let j = 0; j < 3; j++) others.add(I[i + j]); i += 3; }
        }
    }
    for (const q of quads) for (let j = 0; j < 4; j++) others.delete(q.k + j);
    // ---- buildings: quads with one base and one eaves line, connected through their corners (union–find)
    const parent = quads.map((_, i) => i), find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
    const corner = new Map(), join = (key, i) => { const j = corner.get(key); if (j === undefined) corner.set(key, i); else { const a = find(i), b = find(j); if (a !== b) parent[a] = b; } };
    // (base and eaves both: two touching buildings on one datum keep their own storeys)
    quads.forEach((q, i) => { const b = Math.round(q.base * Q) + '|' + Math.round(q.y1 * Q); join(b + '|' + Math.round(q.ax * Q) + '|' + Math.round(q.az * Q), i); join(b + '|' + Math.round(q.bx * Q) + '|' + Math.round(q.bz * Q), i); });
    const clusters = new Map(); quads.forEach((q, i) => { const r = find(i); if (!clusters.has(r)) clusters.set(r, []); clusters.get(r).push(q); });
    let runId = 0;
    for (const qs of clusters.values()) {
        stats.buildings++;
        // whole storeys: the top storey ends at the eaves
        const base = qs[0].base; let top = -Infinity, cx = 0, cz = 0; for (const q of qs) { top = Math.max(top, q.y1); cx += q.ax; cz += q.az; }
        const H = top - base, st = F4 / 4, ns = Math.max(1, Math.round(H / st)), F4n = H > 0.5 ? 4 * H / ns : F4;
        if (Math.abs(F4n - F4) > 1e-3) stats.storeysChanged++;
        const bSeed = Math.floor(Math.abs(cx / qs.length * 0.731 + cz / qs.length * 1.379 + base * 3.17) % 911) + 1; // whole numbers (see the shader)
        // façade edges: collinear, touching bands of one footprint edge
        const edges = [];
        for (const q of qs) {
            const L = Math.hypot(q.bx - q.ax, q.bz - q.az), dx = (q.bx - q.ax) / L, dz = (q.bz - q.az) / L;
            let e = edges.find((e) => e.dx * dx + e.dz * dz > 0.9995 && Math.abs((q.ax - e.ox) * e.dz - (q.az - e.oz) * e.dx) < 0.03);
            const pa = e ? (q.ax - e.ox) * e.dx + (q.az - e.oz) * e.dz : 0, pb = pa + L;
            if (e && (pa > e.s1 + 0.03 || pb < e.s0 - 0.03)) e = null;
            if (!e) { e = { ox: q.ax, oz: q.az, dx, dz, s0: 0, s1: L }; edges.push(e); }
            else { e.s0 = Math.min(e.s0, pa); e.s1 = Math.max(e.s1, pb); }
            q.e = e;
        }
        // chains of edges (end of one = start of the next), split into runs at corners
        const k2 = (px, pz) => Math.round(px * Q) + '|' + Math.round(pz * Q), starts = new Map();
        for (const e of edges) { const key = k2(e.ox + e.dx * e.s0, e.oz + e.dz * e.s0); if (!starts.has(key)) starts.set(key, []); starts.get(key).push(e); }
        const next = (e) => { const c = starts.get(k2(e.ox + e.dx * e.s1, e.oz + e.dz * e.s1)); if (!c) return null; let best = null, bd = -2; for (const f of c) { const d = f.dx * e.dx + f.dz * e.dz; if (f !== e && d > bd) { bd = d; best = f; } } return best; };
        const succ = new Map(), prevOf = new Map(); for (const e of edges) { const f = next(e); succ.set(e, f); if (f && !prevOf.has(f)) prevOf.set(f, e); }
        const done = new Set(), runs = [];
        const walk = (e0) => {
            let run = null, prev = null;
            for (let e = e0; e && !done.has(e); prev = e, e = succ.get(e)) {
                done.add(e);
                if (!run || !prev || prev.dx * e.dx + prev.dz * e.dz < RUN_TURN) { run = { L: 0, id: ++runId }; runs.push(run); }
                e.run = run; e.off = run.L; run.L += e.s1 - e.s0;
            }
        };
        for (const e of edges) if (!prevOf.has(e)) walk(e);
        for (const e of edges) if (!done.has(e)) { // closed rings: start the walk after a corner when there is one
            let s = e; for (let f = e, i = 0; f && i < edges.length; f = succ.get(f), i++) { const p = prevOf.get(f); if (p && p.dx * f.dx + p.dz * f.dz < RUN_TURN && !done.has(f)) { s = f; break; } if (succ.get(f) === e) break; }
            walk(s);
        }
        for (const r of runs) r.k = Math.max(1, Math.round(r.L / bay)) / Math.max(r.L, 1e-3) / 4; // tile units per metre
        stats.runs += runs.length;
        for (const q of qs) {
            const e = q.e, r = e.run, pa = (q.ax - e.ox) * e.dx + (q.az - e.oz) * e.dz, pb = (q.bx - e.ox) * e.dx + (q.bz - e.oz) * e.dz;
            const ua = (e.off + pa - e.s0) * r.k, ub = (e.off + pb - e.s0) * r.k, va = (q.y0 - base) / F4n, vb = (q.y1 - base) / F4n;
            const k = q.k; U[k * 2] = ua; U[k * 2 + 1] = va; U[k * 2 + 2] = ub; U[k * 2 + 3] = va; U[k * 2 + 4] = ub; U[k * 2 + 5] = vb; U[k * 2 + 6] = ua; U[k * 2 + 7] = vb;
            for (let j = 0; j < 4; j++) { seed[(k + j) * 2] = bSeed; seed[(k + j) * 2 + 1] = (r.id % 997) + 1; }
        }
        stats.quads += qs.length;
    }
    // gables and other roof walls: plain wall left of a window, in the second storey row of the tile
    if (plainOthers) { const [pu, pv] = plainUV(S); for (const i of others) { U[i * 2] = pu; U[i * 2 + 1] = pv; } stats.plainFaces += others.size; }
    return seed;
}

/** a plain-wall point of the style's tile: left of the first window, in the second storey row */
function plainUV(S) { const w = S.win || [0.2, 0.2, 0.8, 0.8]; return [w[0] * 0.5 / 4, 1.5 / 4]; }

// ---------------------------------------------------------------------------- night windows + far look (shader)
const PATCHED = new WeakSet();
/** lit window shape: the brightest cell of the material's emissive tile (all cells share the window rectangle) */
function litCell(m) {
    const img = m.emissiveMap?.image; let best = [0, 0], bs = -1, frac = 0.3;
    try {
        const c = img.getContext ? img : null, g = c?.getContext('2d'); if (!g) return { cell: best, frac };
        const W = c.width, H = c.height, d = g.getImageData(0, 0, W, H).data, cw = W / 4, ch = H / 4;
        for (let fy = 0; fy < 4; fy++) for (let fx = 0; fx < 4; fx++) {
            let s = 0, lit = 0; for (let py = fy * ch; py < (fy + 1) * ch; py++) for (let px = fx * cw; px < (fx + 1) * cw; px++) { const o = (py * W + px) * 4, b = Math.max(d[o], d[o + 1], d[o + 2]); s += b; if (b > 40) lit++; }
            if (s > bs) { bs = s; best = [fx, 3 - fy]; frac = lit / (cw * ch); } // canvas row fy from the top = uv row 3 − fy
        }
    } catch { /* no pixel access: first cell, an estimated window share */ }
    return { cell: best, frac };
}
export function patchWindowLights(m) {
    if (!m || PATCHED.has(m) || !m.map || !m.emissiveMap || !/^facade-/.test(m.name || '')) return false;
    PATCHED.add(m);
    const S = m.userData.style || {}, L = litCell(m), share = S.shop ? 0.82 : S.curtain ? 0.26 : 0.3, run = S.curtain ? 3.0 : S.bloc ? 1.0 : 2.0, gain = S.curtain ? 0.4 : S.shop ? 1.0 : 0.85; // curtain walls: dim office light
    const prev = m.onBeforeCompile, key = m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile = function (sh, r) {
        prev?.call(this, sh, r);
        sh.uniforms.ffLitCell = { value: new THREE.Vector2(L.cell[0], L.cell[1]) };
        sh.uniforms.ffPlain = { value: new THREE.Vector2(...plainUV(S)) };
        sh.uniforms.ffShare = { value: share }; sh.uniforms.ffRun = { value: run }; sh.uniforms.ffGain = { value: gain }; sh.uniforms.ffMaskAvg = { value: L.frac };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 facadeSeed;\nflat varying vec2 vFfSeed;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFfSeed = facadeSeed;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nflat varying vec2 vFfSeed;\nuniform vec2 ffLitCell, ffPlain; uniform float ffShare, ffRun, ffMaskAvg, ffGain;')
            .replace('#include <map_fragment>', `#include <map_fragment>
#ifdef USE_MAP
            { // far: the façade tile fades to its mean colour once a window cell covers less than ~3 px (no moiré)
              float ffCells = max(length(dFdx(vMapUv)), length(dFdy(vMapUv))) * 4.0;
              vec3 ffAvg = textureLod(map, vMapUv, 9.0).rgb;
              // below the wall base (the footprint's highest ground point) the wall is a plain plinth, not the tile's top row
              vec3 ffTo = vMapUv.y < 0.0 ? textureLod(map, ffPlain, 0.0).rgb : mix(sampledDiffuseColor.rgb, ffAvg, smoothstep(0.3, 0.8, ffCells));
              diffuseColor.rgb *= ffTo / max(sampledDiffuseColor.rgb, vec3(0.004)); }
#endif`)
            .replace('#include <emissivemap_fragment>', `
#ifdef USE_EMISSIVEMAP
            {
              vec2 ffU = vEmissiveMapUv * 4.0, ffId = floor(ffU), ffDx = dFdx(vEmissiveMapUv), ffDy = dFdy(vEmissiveMapUv);
              vec3 ffEm = textureGrad(emissiveMap, (ffLitCell + 0.02 + fract(ffU) * 0.96) * 0.25, ffDx, ffDy).rgb;
              float ffMask = max(ffEm.r, max(ffEm.g, ffEm.b));
              vec2 ffSeed = floor(vFfSeed + 0.5); // (whole, flat: an interpolated seed turns the hash below into per-pixel noise)
              float ffHb = fract(sin(dot(ffSeed, vec2(12.9898, 78.233))) * 43758.5453);           // the building
              float ffShareB = clamp(ffShare * mix(0.25, 1.75, ffHb), 0.0, 0.95);
              vec2 ffK = vec2(floor(ffId.x / ffRun), ffId.y);                                       // a room spans a few bays
              float ffH = fract(sin(dot(ffK + ffSeed * vec2(0.37, 1.91), vec2(127.1, 311.7))) * 43758.5453);
              float ffLit = step(ffH, ffShareB), ffH2 = fract(ffH * 13.7 + ffHb * 3.1);
              vec3 ffCol = ffH2 > 0.9 ? vec3(0.62, 0.74, 1.0) : mix(vec3(1.0, 0.6, 0.32), vec3(1.0, 0.84, 0.62), ffH2);
              float ffFar = smoothstep(0.3, 0.8, max(length(ffDx), length(ffDy)) * 4.0);
              totalEmissiveRadiance *= mix(ffMask * ffLit * ffCol, vec3(1.0, 0.74, 0.47) * ffMaskAvg * ffShareB * 0.7, ffFar) * ffGain * step(0.0, vEmissiveMapUv.y);
            }
#endif`);
    };
    m.customProgramCacheKey = () => (key ? key() : '') + '|facade-finish-3';
    m.needsUpdate = true;
    return true;
}
