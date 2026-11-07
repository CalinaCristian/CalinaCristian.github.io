// ============================================================================
//  Ground for a spot scene: terrain from the research elevation grid (bicubic),
//  height modifiers (flatten a plaza, carve water, raise a terrace), walkable
//  surfaces (stairs, decks, a sculpture's top surface) and the painted ground:
//  a colour "splat" + a pattern mask (brick / slabs / grass / asphalt) drawn
//  from OSM areas and ways, detailed procedurally in the shader up close.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { clamp, canvas, canvasTexture, inPoly, polyBox, distSeg } from './kit.js';

const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

export class Ground {
    /** @param {{x0,z0,d,nx,nz,h:number[]}|null} terrain */
    constructor(terrain) {
        this.t = terrain || { x0: -100, z0: -100, d: 200, nx: 2, nz: 2, h: [0, 0, 0, 0] };
        this.mods = [];      // (x, z, h) => h
        this.waterY = null;  // set by scenes with open water: the walker can't wade in
        this.surfaces = [];  // walkable solids: { box?, poly?, hm?, top(x,z), bottom, wallAbove? }
        this._cache = new Map();
    }
    /** raw terrain (Catmull-Rom over the grid, clamped outside) */
    base(x, z) {
        const t = this.t;
        const fx = clamp((x - t.x0) / t.d, 0, t.nx - 1.0001), fz = clamp((z - t.z0) / t.d, 0, t.nz - 1.0001);
        const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
        const H = (ii, jj) => t.h[clamp(jj, 0, t.nz - 1) * t.nx + clamp(ii, 0, t.nx - 1)];
        const row = (jj) => cr(H(i - 1, jj), H(i, jj), H(i + 1, jj), H(i + 2, jj), u);
        return cr(row(j - 1), row(j), row(j + 1), row(j + 2), v);
    }
    /** terrain + modifiers (the visible ground) */
    heightAt(x, z) { let h = this.base(x, z); for (const m of this.mods) h = m(x, z, h); return h; }
    /** add a modifier (x,z,h)=>h */
    mod(fn) { this.mods.push(fn); return this; }
    /** flatten inside a polygon to y (number) or to the polygon's mean height; `edge` m blend outside */
    flatten(poly, y = null, edge = 6) {
        const bb = polyBox(poly);
        if (y === null) { let s = 0; for (const [x, z] of poly) s += this.heightAt(x, z); y = s / poly.length; }
        const yy = y;
        this.mod((x, z, h) => {
            if (x < bb.x0 - edge || x > bb.x1 + edge || z < bb.z0 - edge || z > bb.z1 + edge) return h;
            if (inPoly(x, z, poly)) return yy;
            if (edge <= 0) return h;
            let d = 1e9; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, distSeg(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]).d);
            if (d >= edge) return h;
            const k = d / edge, s = k * k * (3 - 2 * k);
            return yy + (h - yy) * s;
        });
        return yy;
    }
    /** a corridor along a polyline [[x,z]] flattened across (keeps its slope along); w = width, edge = blend */
    corridor(pts, w, edge = 5, yFn = null) {
        const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
        const bb = { x0: Math.min(...xs) - w - edge, x1: Math.max(...xs) + w + edge, z0: Math.min(...zs) - w - edge, z1: Math.max(...zs) + w + edge };
        const ys = pts.map(([x, z]) => (yFn ? yFn(x, z) : this.heightAt(x, z)));
        this.mod((x, z, h) => {
            if (x < bb.x0 || x > bb.x1 || z < bb.z0 || z > bb.z1) return h;
            let best = null, bi = 0;
            for (let i = 1; i < pts.length; i++) { const r = distSeg(x, z, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); if (!best || r.d < best.d) { best = r; bi = i; } }
            if (best.d > w / 2 + edge) return h;
            const yc = ys[bi - 1] + (ys[bi] - ys[bi - 1]) * best.t;
            if (best.d <= w / 2) return yc;
            const k = (best.d - w / 2) / edge, s = k * k * (3 - 2 * k);
            return yc + (h - yc) * s;
        });
    }
    // ---------------------------------------------------------------- walkable solids
    /** oriented box solid from y0 to y1 (stairs, planters, decks, benches you can jump on); angle = the mesh rotation.y (local z = long axis hd) */
    addBox(x, z, hw, hd, angle, y0, y1, o = {}) {
        const c = Math.cos(angle), s = Math.sin(angle);
        const s2 = { kind: 'box', x, z, hw, hd, angle, bottom: y0, r: Math.hypot(hw, hd), ...o,
            contains: (px, pz) => { const dx = px - x, dz = pz - z, lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) <= hw && Math.abs(lz) <= hd; },
            top: () => y1 };
        this.surfaces.push(s2); return s2;
    }
    /** polygon solid with a top height function (or number) */
    addPoly(poly, top, bottom = -1e3, o = {}) {
        const bb = polyBox(poly), cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
        const s2 = { kind: 'poly', x: cx, z: cz, r: Math.hypot(bb.x1 - bb.x0, bb.z1 - bb.z0) / 2, bottom, poly, ...o,
            contains: (px, pz) => px >= bb.x0 && px <= bb.x1 && pz >= bb.z0 && pz <= bb.z1 && inPoly(px, pz, poly),
            top: typeof top === 'function' ? top : () => top };
        this.surfaces.push(s2); return s2;
    }
    /** a sculpture's top-surface heightmap (sdfHeightmap result) placed with offset (ox, oy, oz) and yaw ry. Steep cells act as walls. */
    addHeightmap(hm, ox = 0, oy = 0, oz = 0, ry = 0, { maxSlope = 1.25, bottom = null } = {}) {
        const c = Math.cos(ry), s = Math.sin(ry);
        // slope per cell (max rise to a neighbour / cell)
        const steep = new Uint8Array(hm.nx * hm.nz);
        for (let j = 0; j < hm.nz; j++) for (let i = 0; i < hm.nx; i++) {
            const a = hm.h[i + j * hm.nx]; if (Number.isNaN(a)) continue;
            let m = 0;
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= hm.nx || jj >= hm.nz) continue;
                const b = hm.h[ii + jj * hm.nx]; m = Math.max(m, Number.isNaN(b) ? a / hm.d : Math.abs(a - b) / hm.d);
            }
            if (m > maxSlope) steep[i + j * hm.nx] = 1;
        }
        const toLocal = (px, pz) => { const dx = px - ox, dz = pz - oz; return [dx * c - dz * s, dx * s + dz * c]; };
        const x1 = hm.x0 + (hm.nx - 1) * hm.d, z1 = hm.z0 + (hm.nz - 1) * hm.d;
        const s2 = {
            kind: 'hm', x: ox, z: oz, r: Math.hypot(Math.max(-hm.x0, x1), Math.max(-hm.z0, z1)) + 1, bottom: bottom ?? oy, hm,
            contains: (px, pz) => { const [lx, lz] = toLocal(px, pz); return lx >= hm.x0 && lz >= hm.z0 && lx <= x1 && lz <= z1 && !Number.isNaN(hm.at(lx, lz)); },
            top: (px, pz) => { const [lx, lz] = toLocal(px, pz); return hm.at(lx, lz) + oy; },
            steepAt: (px, pz) => { const [lx, lz] = toLocal(px, pz); const i = Math.round((lx - hm.x0) / hm.d), j = Math.round((lz - hm.z0) / hm.d); return i >= 0 && j >= 0 && i < hm.nx && j < hm.nz && steep[i + j * hm.nx] === 1; },
        };
        this.surfaces.push(s2); return s2;
    }
    /** nearest walkable (not deep-water) point to (x, z), searching outward in rings (for spawns / challenge poses) */
    nearestDry(x, z, maxR = 80) {
        const ok = (px, pz) => { const g = this.groundAt(px, pz, this.heightAt(px, pz) + 1); return g < this.heightAt(px, pz) + 40; };
        if (ok(x, z)) return { x, z };
        for (let r = 2; r <= maxR; r += 2) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (ok(px, pz)) return { x: px, z: pz }; }
        return { x, z };
    }
    /**
     * what the walker stands on at (x, z) with feet at y: terrain or the highest walkable solid whose bottom is
     * at most ~head height above the feet (so a bridge deck overhead is ignored); steep sculpture cells above the
     * feet act as walls (a huge value → the controller refuses the move).
     */
    groundAt(x, z, y = 0) {
        let g = this.heightAt(x, z);
        for (const s of this.surfaces) {
            if (Math.abs(x - s.x) > s.r || Math.abs(z - s.z) > s.r) continue;
            if (s.bottom > y + 1.6) continue;
            if (!s.contains(x, z)) continue;
            const t = s.top(x, z); if (!Number.isFinite(t)) continue;
            if (s.steepAt && s.steepAt(x, z) && t > y + 0.35) return y + 50;
            if (t > g) g = t;
        }
        // deep water is not walkable (piers / decks above it are, through the surfaces)
        if (this.waterY !== null && this.waterY !== undefined && g < this.waterY - 0.5) return y + 50;
        return g;
    }
}

// ============================================================================
//  Splat painter: records draw ops in world metres, replays them onto canvases
// ============================================================================
// mask weights live in RGB only (canvas alpha is premultiplied): R brick (cobble at half), G slab joints (wood at half), B grass (dirt at half); black = asphalt grain
export const MASK = { brick: [255, 0, 0], cobble: [120, 0, 0], slab: [0, 255, 0], wood: [0, 120, 0], grass: [0, 0, 255], dirt: [0, 0, 120], asphalt: [0, 0, 0], none: [0, 0, 0] };

export class Painter {
    constructor() { this.ops = []; }
    poly(poly, color, mask = 'none', holes = null) { if (poly?.length > 2) this.ops.push({ t: 'poly', poly, color, mask, holes }); return this; }
    line(pts, w, color, mask = 'none', o = {}) { if (pts?.length > 1) this.ops.push({ t: 'line', pts, w, color, mask, dash: o.dash || null, cap: o.cap || 'round', join: o.join || 'round' }); return this; }
    circle(x, z, r, color, mask = 'none') { this.ops.push({ t: 'circle', x, z, r, color, mask }); return this; }
    /** custom: fn(ctx, toPx(x,z)→[px,py], scale px/m, isMask) */
    custom(fn) { this.ops.push({ t: 'fn', fn }); return this; }
    /** replay onto a colour canvas and a mask canvas covering [x0,z0]–[x0+W, z0+H] */
    render(x0, z0, W, H, colorPx, maskPx, bg = '#6b7a4f', bgMask = 'grass') {
        const out = [];
        for (const [px, isMask] of [[colorPx, false], [maskPx, true]]) {
            if (!px) { out.push(null); continue; }
            const ph = Math.round(px * H / W), c = canvas(px, ph), g = c.getContext('2d');
            const k = px / W, T = (x, z) => [(x - x0) * k, (z - z0) * k];
            g.fillStyle = isMask ? rgba(MASK[bgMask]) : bg; g.fillRect(0, 0, px, ph);
            g.lineCap = 'round'; g.lineJoin = 'round';
            for (const o of this.ops) {
                if (o.t === 'fn') { g.save(); o.fn(g, T, k, isMask); g.restore(); continue; }
                const col = isMask ? rgba(MASK[o.mask] || MASK.none) : o.color;
                if (!col) continue;
                if (o.t === 'poly') {
                    g.beginPath();
                    for (const ring of [o.poly, ...(o.holes || [])]) ring.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
                    g.fillStyle = col; g.fill('evenodd');
                } else if (o.t === 'line') {
                    g.beginPath(); o.pts.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
                    g.strokeStyle = col; g.lineWidth = Math.max(isMask ? 0.6 : 0.8, o.w * k); g.lineCap = o.cap; g.lineJoin = o.join;
                    if (o.dash) g.setLineDash(o.dash.map((v) => v * k)); else g.setLineDash([]);
                    g.stroke();
                } else if (o.t === 'circle') {
                    const [a, b] = T(o.x, o.z); g.beginPath(); g.arc(a, b, Math.max(0.5, o.r * k), 0, Math.PI * 2); g.fillStyle = col; g.fill();
                }
            }
            out.push(c);
        }
        return out;
    }
}
function rgba(m) { return `rgb(${m[0]},${m[1]},${m[2]})`; }

// ============================================================================
//  Ground material: splat colour × procedural detail by mask (brick, slabs, grass, asphalt)
// ============================================================================
export function groundMaterial(colorTex, maskTex, { brickAngle = 0, name = 'groundPlane' } = {}) {
    const m = new THREE.MeshStandardMaterial({ map: colorTex, roughness: 0.93, metalness: 0 });
    m.name = name;
    const U = { uMask: { value: maskTex }, uBrickRot: { value: new THREE.Vector2(Math.cos(brickAngle), Math.sin(brickAngle)) } };
    m.userData.spotU = U;
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSpotW;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvSpotW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
            varying vec3 vSpotW; uniform sampler2D uMask; uniform vec2 uBrickRot;
            float sH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float sN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
                return mix(mix(sH(i), sH(i+vec2(1,0)), f.x), mix(sH(i+vec2(0,1)), sH(i+vec2(1,1)), f.x), f.y); }`)
            .replace('#include <map_fragment>', `#include <map_fragment>
            {
                vec4 mk = texture2D(uMask, vMapUv);
                vec2 w = vSpotW.xz;
                float dist = length(vSpotW - cameraPosition);
                float near = 1.0 - smoothstep(18.0, 45.0, dist), mid = 1.0 - smoothstep(35.0, 110.0, dist);
                float k = 1.0;
                // everywhere: low-frequency mottling so big flat areas are never uniform
                k *= 0.93 + 0.14 * sN(w * 0.35) + 0.05 * (sN(w * 2.3) - 0.5);
                // brick / pavers (running bond 0.20 × 0.10 m)
                if (mk.r > 0.02) {
                    float cob = 1.0 - smoothstep(0.55, 0.75, mk.r); // half-weight red = cobbles / setts
                    vec2 q = vec2(dot(w, uBrickRot), dot(w, vec2(-uBrickRot.y, uBrickRot.x)));
                    vec2 b = q / mix(vec2(0.205, 0.102), vec2(0.16, 0.13), cob); b.x += 0.5 * mod(floor(b.y), 2.0);
                    vec2 f = fract(b), id = floor(b);
                    float mortar = smoothstep(0.0, 0.07, f.x) * smoothstep(1.0, 0.93, f.x) * smoothstep(0.0, 0.12, f.y) * smoothstep(1.0, 0.88, f.y);
                    float tint = 0.82 + 0.3 * sH(id) - 0.08 * step(0.8, sH(id + 7.0));
                    float br = mix(0.62, tint, mortar);
                    k *= mix(1.0, br, clamp(mk.r * 1.6, 0.0, 1.0) * mix(0.35, 1.0, near));
                }
                // concrete slabs with joints (≈1.5 m)
                if (mk.g > 0.02) {
                    float wood = 1.0 - smoothstep(0.55, 0.75, mk.g);
                    vec2 f = fract(w / mix(vec2(1.52), vec2(0.14, 6.0), wood)), id = floor(w / 1.52);
                    float j = smoothstep(0.0, 0.012, f.x) * smoothstep(1.0, 0.988, f.x) * smoothstep(0.0, 0.012, f.y) * smoothstep(1.0, 0.988, f.y);
                    float sl = (0.95 + 0.1 * sH(id)) * mix(0.78, 1.0, j);
                    sl *= 0.97 + 0.06 * sN(w * 6.0);
                    k *= mix(1.0, sl, mk.g * mix(0.3, 1.0, mid));
                }
                // grass: clumps + blades shimmer
                if (mk.b > 0.02) {
                    float gN = 0.78 + 0.3 * sN(w * 1.7) + 0.16 * (sN(w * 11.0) - 0.5) * near + 0.12 * (sH(floor(w * 24.0)) - 0.5) * near;
                    k *= mix(1.0, gN, mk.b);
                }
                // asphalt grain + patches
                float asph = 1.0 - clamp((mk.r + mk.g + mk.b) * 3.0, 0.0, 1.0);
                if (asph > 0.02) {
                    float aN = 0.9 + 0.12 * sN(w * 0.8) + 0.1 * (sH(floor(w * 30.0)) - 0.5) * near;
                    k *= mix(1.0, aN, asph);
                }
                diffuseColor.rgb *= k;
            }`);
    };
    m.customProgramCacheKey = () => 'spotGround1';
    return m;
}

/**
 * Terrain meshes: an inner patch (fine grid, high-res splat) and an outer apron (coarse grid, low-res splat)
 * with the inner rectangle cut out. Returns { group, inner, outer, materials[] }.
 */
export function buildTerrain(ground, painter, { inner, outer, innerPx = 2048, outerPx = 1024, innerStep = 2, outerStep = 8, bg = '#6b7a4f', bgMask = 'grass', brickAngle = 0, skirt = 0, skirtY = null, skirtColor = null }) {
    const grp = new THREE.Group(); grp.name = 'terrain';
    const mats = [];
    const mk = (box, px, step, hole) => {
        const W = box.x1 - box.x0, H = box.z1 - box.z0;
        const [cc, mc] = painter.render(box.x0, box.z0, W, H, px, Math.round(px / 2), bg, bgMask);
        const ct = canvasTexture(cc, { aniso: 8 }), mt = canvasTexture(mc, { srgb: false, aniso: 4 });
        const m = groundMaterial(ct, mt, { brickAngle }); mats.push(m);
        const nx = Math.round(W / step), nz = Math.round(H / step);
        const pos = [], uv = [], idx = [], vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
        const insideHole = (x, z) => hole && x > hole.x0 + 0.01 && x < hole.x1 - 0.01 && z > hole.z0 + 0.01 && z < hole.z1 - 0.01;
        const vert = (i, j) => {
            const id = i + j * (nx + 1); if (vid[id] >= 0) return vid[id];
            const x = box.x0 + i * W / nx, z = box.z0 + j * H / nz;
            vid[id] = pos.length / 3; pos.push(x, ground.heightAt(x, z), z); uv.push(i / nx, 1 - j / nz); return vid[id];
        };
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
            const xa = box.x0 + i * W / nx, za = box.z0 + j * H / nz, xb = xa + W / nx, zb = za + H / nz;
            if (insideHole((xa + xb) / 2, (za + zb) / 2)) continue;
            const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1);
            idx.push(a, d, b, b, d, c);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'groundPlane';
        return mesh;
    };
    const i = mk(inner, innerPx, innerStep, null), o = mk(outer, outerPx, outerStep, inner);
    i.name = 'terrain-inner'; o.name = 'terrain-outer';
    grp.add(i, o);
    if (skirt > 0) { // a far apron disc so the horizon never shows a gap
        const g = new THREE.RingGeometry(Math.max(outer.x1 - outer.x0, outer.z1 - outer.z0) * 0.7, skirt, 48, 1); g.rotateX(-Math.PI / 2);
        const cx = (outer.x0 + outer.x1) / 2, cz = (outer.z0 + outer.z1) / 2;
        const m = new THREE.MeshStandardMaterial({ color: skirtColor || bg, roughness: 1 }); m.name = 'groundPlane'; mats.push(m);
        const ring = new THREE.Mesh(g, m); ring.position.set(cx, skirtY ?? ground.heightAt(cx, cz) - 2, cz); ring.name = 'terrain-apron'; grp.add(ring);
    }
    return { group: grp, inner: i, outer: o, materials: mats };
}
