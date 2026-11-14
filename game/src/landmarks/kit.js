// ============================================================================
//  Landmarks — Builder kit: shared landmark materials, 2D geometry helpers and the Builder that merges a model into one mesh per material.
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { makeDinamoPaintTexture } from '../landmark-pitch-paint.js';
import { fountainTick, FOUNTAIN_WATER, fountainMaterials } from './fountain-water.js';

// ---------------------------------------------------------------------------
//  Shared materials (one set for all landmarks -> few programs / draw calls)
// ---------------------------------------------------------------------------
let MATS = null;
/** (2026-11-08, owner: "account for weather?") the matte landmark material: the renderer gives its up-facing surfaces (roofs,
 *  stands, courts, the stadium pitch) the same snow / wet look as the streets */
export function landmarkSurfaceMaterials() { const M = materials(); return [M.m, M.fl, M.nb, M.paint].filter(Boolean); }
export function materials() {
    if (MATS) return MATS;
    MATS = {
        m: new THREE.MeshLambertMaterial({ vertexColors: true }),                                   // masonry / matte
        g: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35 }), // glass / metal
        w: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false }), // water
        f: new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }),                       // far backdrops (mountains)
        e: new THREE.MeshBasicMaterial({ vertexColors: true }),                                     // self-lit: lobby glow, lit signage
    };
    MATS.m.name = 'landmark-masonry'; MATS.w.name = 'landmark-water'; MATS.f.name = 'landmark-backdrop'; MATS.f.userData.hazeHidden = true; MATS.e.name = 'landmark-glow';
    // (after round 6) glass at night: lit office floors behind the panes (≈ 30 % of panes, warm / cool, mullions, some blinds),
    // averaged to an even glow where panes get sub-pixel — glass towers (Hermes, Sky Tower, Bellevue) were dark stripes
    { const g = MATS.g; g.emissive = new THREE.Color('#ffe2b8'); g.emissiveIntensity = 0; g.userData.nightEmissive = 0.85; g.userData.nightGlow = 0.85; g.userData.dayGlow = 0;
      g.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW; varying vec3 vGN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGN = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW; varying vec3 vGN;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {   float wall = 1.0 - smoothstep(0.3, 0.6, abs(vGN.y));
            vec2 tg = normalize(vec2(-vGN.z, vGN.x) + 1e-5);
            vec2 c = vec2(dot(vGW.xz, tg) / 1.6, (vGW.y - 0.3) / 3.6); vec2 id = floor(c), f = fract(c);
            float run = floor(id.x / 4.0), hf = fract(sin(dot(vec2(run, id.y), vec2(12.9898, 78.233)) + floor(vGW.x * 0.01) * 3.1) * 43758.5453);
            float pid = fract(sin(dot(id, vec2(39.3, 11.7))) * 24634.63);
            float pane = smoothstep(0.03, 0.08, f.x) * (1.0 - smoothstep(0.92, 0.97, f.x)) * smoothstep(0.1, 0.18, f.y) * (1.0 - smoothstep(0.86, 0.94, f.y));
            float lit = step(hf, 0.3) * pane * (pid < 0.2 ? 0.2 : 1.0) * (0.6 + 0.4 * smoothstep(0.3, 0.85, f.y));
            float fw = length(fwidth(c)); lit = mix(lit, 0.3 * 0.7, smoothstep(0.3, 0.8, fw));
            vec3 tint = mix(vec3(0.75, 0.82, 0.95), vec3(1.0, 0.85, 0.65), step(0.5, fract(hf * 7.3)));
            float glassy = 1.0;
            #ifdef USE_COLOR
                glassy = step(vColor.r, vColor.b + 0.12) * step(max(vColor.r, max(vColor.g, vColor.b)), 0.75); // glass tints only — not gold domes / crosses, not white trims
            #endif
            totalEmissiveRadiance *= wall * lit * tint * glassy * step(2.5, vGW.y); }`);
      };
      g.customProgramCacheKey = () => 'landmark-glass-night2'; }
    // (2026-11-13, owner: "uipath is broken it has a building in side it") punched windows (Builder.windows on glass) are
    // whole panes: the world-space pane grid above does not line up with them, so at night it lit small panes inside a
    // shopfront and half panes in the upper windows — like a second building behind the facade. Each such window is one
    // pane: lit warm / cool at night (gww / gwc) or dark (gd); by day all three look like 'g'.
    { const pane = (name, col, night) => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35, emissive: new THREE.Color(col), emissiveIntensity: 0 }); m.name = name; m.userData.nightEmissive = night; m.userData.nightGlow = night; m.userData.dayGlow = 0; return m; };
      MATS.gww = pane('landmark-window-lit', '#ffd9a8', 0.7); MATS.gwc = pane('landmark-window-lit-cool', '#c4d3ee', 0.7); MATS.gd = pane('landmark-window', '#000000', 0); }
    // floodlit masonry (LANDMARKS[].floodlit): the 'm' geometry of floodlit monuments uses this material instead. Warm
    // emissive scaled per vertex by the vertex colour (stone glows, dark windows stay dark) and dimmed on up-facing
    // surfaces (floodlights hit the walls, not the roofs), fading with height and varying by facade direction. emissiveIntensity is 0 by day; render.js eases it to
    // userData.nightEmissive at night (contract 01-architecture "Night-lit materials").
    const fl = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#ffd7a3'), emissiveIntensity: 0 });
    // nightGlow/dayGlow mirror nightEmissive for the spots' setNightWindows() (spots/index.js), so both drivers agree
    fl.name = 'landmark-floodlit'; fl.userData.nightEmissive = 1.1; fl.userData.nightGlow = 1.1; fl.userData.dayGlow = 0; fl.userData.floodlit = true;
    fl.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFlood;')
            .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 fN = normalize(mat3(modelMatrix) * objectNormal); vFlood = (1.0 - 0.8 * max(fN.y, 0.0)) * (0.72 + 0.28 * abs(fN.x)) * mix(1.0, 0.55, clamp(position.y / 70.0, 0.0, 1.0));');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFlood;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb * vColor.rgb * 1.25;\n#endif\ntotalEmissiveRadiance *= vFlood;');
    };
    fl.customProgramCacheKey = () => 'landmark-floodlit';
    MATS.fl = fl;
    // dressed-stone masonry on the floodlit material (LANDMARKS[].masonry; owner, 2026-11-11, Arcul de Triumf: "a plain
    // block"): coursed blocks drawn in the shader from the model's own coordinates, so the joints run level and square to
    // the monument: 0.62 m courses, 1.24 m blocks, every other course shifted half a block, a slight tint per block. Only on
    // pale stone (not the dark, gilt or coloured parts) and only on walls; the joints fade out with distance. Sizes are
    // estimates of the Rușchița marble cladding.
    const masonry = (base, name) => {
        const mm = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: base.emissive.clone(), emissiveIntensity: base.emissiveIntensity });
        mm.name = name; Object.assign(mm.userData, base.userData);
        mm.onBeforeCompile = (sh) => {
            base.onBeforeCompile?.(sh);
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMsL; varying vec3 vMsN;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMsL = position; vMsN = objectNormal;');
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMsL; varying vec3 vMsN;')
                .replace('#include <color_fragment>', `#include <color_fragment>
            {
                vec3 an = abs(normalize(vMsN)); float lum = 1.0;
                #ifdef USE_COLOR
                    lum = min(vColor.r, min(vColor.g, vColor.b));
                #endif
                if (an.y < 0.6 && lum > 0.6) {
                    float row = floor(vMsL.y / 0.62), u = (an.z > an.x ? vMsL.x : vMsL.z) / 1.24 + 0.5 * mod(row, 2.0);
                    float fy = fract(vMsL.y / 0.62), fu = fract(u);
                    float wy = fwidth(vMsL.y / 0.62), wu = fwidth(u);
                    float jy = 1.0 - smoothstep(0.0, wy * 1.2 + 0.014, min(fy, 1.0 - fy));
                    float ju = 1.0 - smoothstep(0.0, wu * 1.2 + 0.009, min(fu, 1.0 - fu));
                    float fade = 1.0 - smoothstep(0.08, 0.35, max(wy, wu));
                    float id = fract(sin(dot(vec2(floor(u), row), vec2(12.9898, 78.233))) * 43758.5453);
                    diffuseColor.rgb *= mix(1.0, (0.955 + 0.07 * id) * (1.0 - 0.3 * max(jy, ju)), fade);
                }
            }`);
        };
        mm.customProgramCacheKey = () => name;
        return mm;
    };
    MATS.flm = masonry(fl, 'landmark-floodlit-masonry');
    MATS.mm = masonry(MATS.m, 'landmark-masonry');
    // night-lit accent (e.g. the blue-lit rim of the UPB Rectorat dome): vertex-coloured Lambert + emissive eased by render.js
    const nb = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#3f7fff'), emissiveIntensity: 0 });
    nb.name = 'landmark-nightlight'; nb.userData.nightEmissive = 2.2; nb.userData.nightGlow = 2.2; nb.userData.dayGlow = 0;
    MATS.nb = nb;
    // Filtered coverage preserves subpixel field paint. This cache owns the alpha
    // texture; sceneResources retains landmark materials/textures between worlds.
    const paint = fl.clone();
    paint.onBeforeCompile = fl.onBeforeCompile; paint.customProgramCacheKey = () => 'landmark-pitch-paint';
    paint.alphaMap = makeDinamoPaintTexture(); paint.transparent = true; paint.depthWrite = false;
    paint.polygonOffset = true; paint.polygonOffsetFactor = paint.polygonOffsetUnits = -1;
    paint.name = 'landmark-pitch-paint'; paint.userData.shared = true;
    MATS.paint = paint;
    return MATS;
}

const _col = new THREE.Color();
const _colCache = new Map();
export function rgb(c) {
    let v = _colCache.get(c);
    if (!v) { _col.set(c); v = [_col.r, _col.g, _col.b]; _colCache.set(c, v); }
    return v;
}

/** flat [x,z,x,z,...] -> [[x,z],...] */
export function pts(flat) { const o = []; for (let i = 0; i < flat.length; i += 2) o.push([flat[i], flat[i + 1]]); return o; }
export function rect(x0, z0, x1, z1) { return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; }
export function ellipse(cx, cz, rx, rz, n = 24, a0 = 0) { const o = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; o.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); } return o; }
export function roundRect(cx, cz, w, d, r, n = 4) {
    const o = [], hx = w / 2 - r, hz = d / 2 - r;
    const cs = [[hx, hz, 0], [-hx, hz, 1], [-hx, -hz, 2], [hx, -hz, 3]];
    for (const [x, z, q] of cs) for (let i = 0; i <= n; i++) { const a = (q + i / n) * Math.PI / 2; o.push([cx + x + Math.cos(a) * r, cz + z + Math.sin(a) * r]); }
    return o;
}
export function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; } return a / 2; }
export function centroid(p) { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; }
export function bbox(list) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const p of list) for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x0, z0, x1, z1 }; }
/** offset polygon outward by d (negative = inset), miter-limited */
export function offset(p, d) {
    const s = signedArea(p) > 0 ? 1 : -1, n = p.length, o = [];
    for (let i = 0; i < n; i++) {
        const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
        let e1x = b[0] - a[0], e1z = b[1] - a[1], e2x = c[0] - b[0], e2z = c[1] - b[1];
        const l1 = Math.hypot(e1x, e1z) || 1, l2 = Math.hypot(e2x, e2z) || 1;
        const n1x = s * e1z / l1, n1z = -s * e1x / l1, n2x = s * e2z / l2, n2z = -s * e2x / l2;
        let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz);
        if (ml < 1e-6) { mx = n1x; mz = n1z; } else { mx /= ml; mz /= ml; }
        const k = d / Math.max(0.35, mx * n1x + mz * n1z);
        o.push([b[0] + mx * k, b[1] + mz * k]);
    }
    return o;
}
/** z extent of polygon(s) along the vertical line x (returns [minZ, maxZ] or null) */
export function zAt(list, x) {
    let lo = Infinity, hi = -Infinity;
    for (const p of list) for (let i = 0; i < p.length; i++) {
        const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length];
        if ((x1 - x) * (x2 - x) <= 0 && x1 !== x2) { const z = z1 + (z2 - z1) * (x - x1) / (x2 - x1); lo = Math.min(lo, z); hi = Math.max(hi, z); }
    }
    return lo < hi ? [lo, hi] : null;
}
export function xAt(list, z) { return zAt(list.map(p => p.map(([a, b]) => [b, a])), z); }

/** deterministic pseudo random */
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// ---------------------------------------------------------------------------
//  Builder: accumulates flat-shaded, vertex-coloured triangles per material.
//  All inputs in model metres (real size); x/z are multiplied by `hs`.
// ---------------------------------------------------------------------------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
export function M(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ');
    return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
}

/** the material of one punched window on glass ('g'): about 30 % lit at night (as the old pane grid), only glass tints
 *  (not gold or white trims) and only above 2.5 m (shopfronts stay dark), chosen per window from its position */
function paneMat(mat, col, cx, cz, ya, yb) {
    if (mat !== 'g') return mat;
    const [r, g, b] = rgb(col);
    if (!(r <= b + 0.12 && Math.max(r, g, b) <= 0.75) || (ya + yb) / 2 < 2.5) return 'gd';
    const h = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233 + ya * 37.719) * 43758.5453) % 1;
    return h >= 0.3 ? 'gd' : (h * 7.3) % 1 < 0.5 ? 'gwc' : 'gww';
}
export class Builder {
    constructor(hs = 1) { this.hs = hs; this.wall = null; this.bk = {}; this.cols = []; this.extras = []; this.fences = []; this.covers = []; this.grounds = []; this.coverPolys = []; this.stack = [new THREE.Matrix4()]; this.ox = 0; this.oz = 0; this.baseY = 0; }
    /** translate everything that follows by (dx, dz) model metres (lets a builder keep its source coordinates when its anchor moves) */
    shift(dx, dz) { this.ox = dx; this.oz = dz; return this; }
    _b(mat) { return this.bk[mat] || (this.bk[mat] = { p: [], n: [], c: [] }); }
    get frame() { return this.stack[this.stack.length - 1]; }
    push(m) { this.stack.push(this.frame.clone().multiply(m)); return this; }
    pop() { this.stack.pop(); return this; }

    /** raw triangle; hint = approximate outward normal (unscaled) used to fix winding */
    tri(a, b, c, col, mat = 'm', hint = null) {
        const s = this.hs, ox = this.ox, oz = this.oz;
        const A = [(a[0] + ox) * s, a[1], (a[2] + oz) * s], Bv = [(b[0] + ox) * s, b[1], (b[2] + oz) * s], C = [(c[0] + ox) * s, c[1], (c[2] + oz) * s];
        const ux = Bv[0] - A[0], uy = Bv[1] - A[1], uz = Bv[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        let P2 = Bv, P3 = C;
        if (hint && nx * hint[0] / s + ny * hint[1] + nz * hint[2] / s < 0) { P2 = C; P3 = Bv; nx = -nx; ny = -ny; nz = -nz; }
        const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
        nx /= l; ny /= l; nz /= l;
        const k = this._b(mat), r = rgb(col);
        k.p.push(A[0], A[1], A[2], P2[0], P2[1], P2[2], P3[0], P3[1], P3[2]);
        k.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
        k.c.push(r[0], r[1], r[2], r[0], r[1], r[2], r[0], r[1], r[2]);
    }
    quad(a, b, c, d, col, mat, hint) { this.tri(a, b, c, col, mat, hint); this.tri(a, c, d, col, mat, hint); }

    /** vertical walls around polygon p (inward=true for courtyard holes) */
    ring(p, y0, y1, col, o = {}) {
        const s = (signedArea(p) > 0 ? 1 : -1) * (o.inward ? -1 : 1);
        for (let i = 0; i < p.length; i++) {
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length];
            const hint = [s * (bz - az), 0, -s * (bx - ax)];
            this.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], col, o.mat || 'm', hint);
        }
    }
    /** horizontal cap (with holes) at height y; up = +1 / -1 */
    cap(p, y, col, holes = [], up = 1, mat = 'm') {
        const c = p.map(([x, z]) => new THREE.Vector2(x, z));
        const h = holes.map(q => q.map(([x, z]) => new THREE.Vector2(x, z)));
        const all = c.concat(...h);
        let faces;
        try { faces = THREE.ShapeUtils.triangulateShape(c, h); } catch (e) { faces = []; }
        for (const [i, j, k] of faces) this.tri([all[i].x, y, all[i].y], [all[j].x, y, all[j].y], [all[k].x, y, all[k].y], col, mat, [0, up, 0]);
    }
    /** extruded polygon */
    prism(p, y0, y1, col, o = {}) {
        const holes = o.holes || [], mat = o.mat || 'm';
        this.ring(p, y0, y1, col, { mat });
        for (const h of holes) this.ring(h, y0, y1, o.holeCol || col, { mat, inward: true });
        if (o.top !== false) this.cap(p, y1, o.topCol || col, holes, 1, mat);
        if (o.bottom) this.cap(p, y0, col, holes, -1, mat);
    }
    /** horizontal window / spandrel bands, slightly proud of the facade */
    bands(p, y0, y1, fh, col, o = {}) {
        const frac = o.frac ?? 0.42, off = o.off ?? 0.18, mat = o.mat || 'm';
        const op = offset(p, off), hs = (o.holes || []).map(h => offset(h, -off));
        let ya = Infinity, yb = -Infinity;
        for (let y = y0 + (o.start ?? fh * 0.32); y + fh * frac <= y1 - 0.3; y += fh) {
            this.ring(op, y, y + fh * frac, col, { mat });
            for (const h of hs) this.ring(h, y, y + fh * frac, col, { mat, inward: true });
            ya = Math.min(ya, y); yb = Math.max(yb, y + fh * frac);
        }
        // piers in the wall colour split the bands into individual windows
        const wall = o.wall ?? (mat === 'm' ? this.wall : null);
        if (wall && ya < yb) {
            this.piers(offset(p, off + 0.06), ya - 0.05, yb + 0.05, o.pitch || 3.6, wall, false, o.pierW);
            for (const h of (o.holes || [])) this.piers(offset(h, -off - 0.06), ya - 0.05, yb + 0.05, o.pitch || 3.6, wall, true, o.pierW);
        }
    }
    /** single outward-facing pier quads along each edge */
    piers(p, y0, y1, pitch, col, inward = false, pw = 0.42) {
        const s = (signedArea(p) > 0 ? 1 : -1) * (inward ? -1 : 1);
        for (let i = 0; i < p.length; i++) {
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az);
            if (L < pitch * 0.8) continue;
            const k = Math.max(1, Math.round(L / pitch)), dx = (bx - ax) / L, dz = (bz - az) / L, hw = Math.min(L / k * pw / 2, 1.2);
            const hint = [s * dz, 0, -s * dx];
            for (let j = 0; j <= k; j++) {
                const t = j / k * L, cx = ax + dx * t, cz = az + dz * t;
                const t0 = Math.max(0, t - hw), t1 = Math.min(L, t + hw);
                this.quad([ax + dx * t0, y0, az + dz * t0], [ax + dx * t1, y0, az + dz * t1], [ax + dx * t1, y1, az + dz * t1], [ax + dx * t0, y1, az + dz * t0], col, 'm', hint);
            }
        }
    }
    /** mansard-ish roof: inset prism */
    roof(p, y, h, col, inset = 2, o = {}) { const q = offset(p, -inset); this.prism(q, y, y + h, col, { holes: (o.holes || []).map(x => offset(x, inset)), topCol: o.topCol }); }

    /** Pitched surface over the complete source outline, with open courts and shared subdivision edges.
     * Eaves/rise are explicit authoring estimates where OSM has no roof:height; no centroid fan or inset-box roof. */
    sourceRoof(p, y, h, col, inset = 2, { holes = [], mansard = false } = {}) {
        const contour = p.map(q => new THREE.Vector2(...q)), rings = holes.map(r => r.map(q => new THREE.Vector2(...q)));
        const all = contour.concat(...rings), points = all.map(q => [q.x, q.y]);
        let faces = THREE.ShapeUtils.triangulateShape(contour, rings);
        for (let pass = 0; pass < 10; pass++) {
            const mids = new Map(), next = [];
            for (const f of faces) for (let i = 0; i < 3; i++) {
                const a = f[i], c = f[(i + 1) % 3], key = a < c ? `${a},${c}` : `${c},${a}`;
                if (mids.has(key) || Math.hypot(points[a][0] - points[c][0], points[a][1] - points[c][1]) <= 4) continue;
                mids.set(key, points.length); points.push([(points[a][0] + points[c][0]) / 2, (points[a][1] + points[c][1]) / 2]);
            }
            if (!mids.size) break;
            for (const f of faces) {
                const mid = f.map((a, i) => { const c = f[(i + 1) % 3]; return mids.get(a < c ? `${a},${c}` : `${c},${a}`); });
                const n = mid.filter(i => i !== undefined).length;
                if (!n) { next.push(f); continue; }
                if (n === 3) { next.push([f[0], mid[0], mid[2]], [mid[0], f[1], mid[1]], [mid[2], mid[1], f[2]], mid); continue; }
                const k = n === 1 ? mid.findIndex(i => i !== undefined) : mid.findIndex(i => i === undefined), a = f[k], c = f[(k + 1) % 3], d = f[(k + 2) % 3];
                if (n === 1) next.push([a, mid[k], d], [mid[k], c, d]);
                else { const u = mid[(k + 1) % 3], v = mid[(k + 2) % 3]; next.push([d, v, u], [a, c, v], [c, u, v]); }
            }
            faces = next;
        }
        const vertex = ([x, z]) => {
            let distance = Infinity;
            for (const ring of [p, ...holes]) for (let i = 0; i < ring.length; i++) {
                const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1];
                const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
                distance = Math.min(distance, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
            }
            const t = Math.min(1, distance / inset), rise = mansard ? (t < 0.45 ? t / 0.45 * 0.8 : 0.8 + (t - 0.45) / 0.55 * 0.2) : t;
            return [x, y + h * rise, z];
        };
        // (spec 10 load budget) a point shared by several faces is lifted once (vertex is a pure function of the point; tri copies it)
        const lifted = new Array(points.length), at = i => lifted[i] || (lifted[i] = vertex(points[i]));
        for (const f of faces) this.tri(...f.map(at), col, 'm', [0, 1, 0]);
    }

    // ---- THREE geometry based primitives (respect the frame stack) ----
    geo(g, col, m, mat = 'm') {
        let gg = g.index ? g.toNonIndexed() : g.clone();
        const S = new THREE.Matrix4().makeScale(this.hs, 1, this.hs).multiply(new THREE.Matrix4().makeTranslation(this.ox, 0, this.oz)).multiply(this.frame);
        if (m) S.multiply(m);
        gg.applyMatrix4(S);
        if (!gg.attributes.normal) gg.computeVertexNormals();
        const P = gg.attributes.position.array, N = gg.attributes.normal.array, k = this._b(mat), r = rgb(col);
        for (let i = 0; i < P.length; i++) { k.p.push(P[i]); k.n.push(N[i]); }
        for (let i = 0; i < P.length / 3; i++) k.c.push(r[0], r[1], r[2]);
        gg.dispose();
    }
    box(x, y, z, w, h, d, col, o = {}) { this.geo(G.box, col, M(x, y + h / 2, z, o.ry || 0, w, h, d, o.rx || 0, o.rz || 0), o.mat); }
    cyl(x, y, z, rt, rb, h, col, seg = 12, o = {}) { this.geo(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), col, M(x, y + h / 2, z, o.ry || 0, 1, 1, 1, o.rx || 0, o.rz || 0), o.mat); }
    cone(x, y, z, r, h, col, seg = 12, o = {}) { this.geo(new THREE.ConeGeometry(r, h, seg, 1, true), col, M(x, y + h / 2, z, o.ry || 0), o.mat); }
    dome(x, y, z, r, h, col, seg = 16, o = {}) { this.geo(new THREE.SphereGeometry(1, seg, Math.max(3, Math.ceil(seg / 4)), 0, Math.PI * 2, 0, Math.PI / 2), col, M(x, y, z, 0, r, h, r), o.mat); }
    sphere(x, y, z, r, col, o = {}) { this.geo(new THREE.IcosahedronGeometry(r, o.detail ?? 1), col, M(x, y, z), o.mat); }
    /** cylinder lying along x */
    cylX(x, y, z, r, len, col, seg = 10, o = {}) { this.geo(new THREE.CylinderGeometry(o.r2 ?? r, r, len, seg), col, M(x, y, z, 0, 1, 1, 1, 0, -Math.PI / 2), o.mat); }
    /** square pyramid / hipped roof centred at x,z (base at y), rotated ry */
    hip(x, y, z, w, d, h, col, o = {}) {
        const ry = o.ry || 0, c = Math.cos(ry), s = Math.sin(ry), mat = o.mat || 'm';
        const T = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
        const r = o.ridge ?? Math.max(0, (w - d) / 2);  // half ridge length along local x
        const hw = w / 2, hd = d / 2;
        const A = T(-hw, 0, -hd), B = T(hw, 0, -hd), C = T(hw, 0, hd), D = T(-hw, 0, hd), R1 = T(-r, h, 0), R2 = T(r, h, 0);
        const up = (lx, lz) => [lx * c + lz * s, 0.5, -lx * s + lz * c];
        this.quad(A, B, R2, R1, col, mat, up(0, -1)); this.quad(C, D, R1, R2, col, mat, up(0, 1));
        this.tri(B, C, R2, col, mat, up(1, 0)); this.tri(D, A, R1, col, mat, up(-1, 0));
    }
    /** gable / triangular pediment prism: triangle in local x-y, extruded along local z */
    pediment(x, y, z, w, h, depth, col, ry = 0, mat = 'm') {
        const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2);
        this.geo(g, col, M(x, y, z, ry), mat);
    }
    /** wall slab in local x-y with arched openings cut from the bottom; extruded along local z */
    archWall(W, H, depth, arches, col, m, mat = 'm') {
        const s = new THREE.Shape(); s.moveTo(-W / 2, 0);
        for (const a of [...arches].sort((p, q) => p.x - q.x)) {
            const r = a.w / 2, spring = a.h - r;
            s.lineTo(a.x - r, 0); s.lineTo(a.x - r, spring); s.absarc(a.x, spring, r, Math.PI, 0, true); s.lineTo(a.x + r, 0);
        }
        s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.lineTo(-W / 2, 0);
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, -depth / 2);
        this.geo(g, col, m, mat);
    }
    /** row of columns between two points */
    colonnade(x0, z0, x1, z1, y, h, n, r, col, o = {}) {
        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0.5 : i / (n - 1), x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
            if (o.square) this.box(x, y, z, r * 2, h, r * 2, col, { ry: o.ry || 0 });
            else this.cyl(x, y, z, r * 0.88, r, h, col, o.seg || 8);
            if (o.capital) this.box(x, y + h - 0.6, z, r * 2.6, 0.6, r * 2.6, o.capital, { ry: o.ry || 0 });
        }
    }
    /** rectangular beam (w wide, h tall) between two 3D points — truss members, arch ribs, hangers (12 tris) */
    strut(a, c, w, h, col, mat = 'm') {
        const d = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), L = d.length(); if (L < 1e-4) return;
        d.divideScalar(L);
        const up = Math.abs(d.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const zA = new THREE.Vector3().crossVectors(d, up).normalize(), yA = new THREE.Vector3().crossVectors(zA, d).normalize();
        const m = new THREE.Matrix4().makeBasis(d, yA, zA).scale(_s.set(L, h, w)).setPosition((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
        this.geo(G.box, col, m, mat);
    }
    /** tube along points [[x,y,z],...] */
    tube(points, r, col, o = {}) {
        const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
        this.geo(new THREE.TubeGeometry(curve, o.seg || 16, r, o.radial || 6, !!o.closed), col, null, o.mat);
    }

    // ---- facade detail helpers (all cheap: 2 tris per window / 6 per pilaster) ----
    /**
     * Window grid on every edge of polygon p (holes: o.inward). One quad per window, floors of height fh from
     * y0 (+o.start) to y1, bays of ~o.bay metres. o.wf / o.hf = window width / height as a fraction of the bay
     * / floor; o.minL skips short edges; o.skip(edge, bay, floor, nBays) -> true hides a window; o.arch adds a
     * round-head triangle; o.edges limits to a list of edge indices.
     */
    windows(p, y0, y1, fh, col, o = {}) {
        const s = (signedArea(p) > 0 ? 1 : -1) * (o.inward ? -1 : 1), mat = o.mat || 'm', off = o.off ?? 0.07;
        const bay = o.bay ?? 3.6, wf = o.wf ?? 0.5, hf = o.hf ?? 0.55, start = o.start ?? fh * 0.25, nF = Math.max(0, Math.floor((y1 - y0 - start - fh * hf) / fh + 1 + 1e-6));
        let n = 0;
        for (let i = 0; i < p.length; i++) {
            if (o.edges && !o.edges.includes(i)) continue;
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az);
            if (L < (o.minL ?? bay * 0.9)) continue;
            const k = Math.max(1, Math.round(L / bay)), dx = (bx - ax) / L, dz = (bz - az) / L, nx = s * dz, nz = -s * dx, hw = L / k * wf / 2;
            const hint = [nx, 0, nz];
            for (let j = 0; j < k; j++) {
                const t = (j + 0.5) / k * L, cx = ax + dx * t + nx * off, cz = az + dz * t + nz * off;
                const x0 = cx - dx * hw, z0 = cz - dz * hw, x1 = cx + dx * hw, z1 = cz + dz * hw;
                for (let f = 0; f < nF; f++) {
                    if (o.skip && o.skip(i, j, f, k)) continue;
                    const ya = y0 + start + f * fh, yb = ya + fh * hf, wm = paneMat(mat, col, cx, cz, ya, yb);
                    this.quad([x0, ya, z0], [x1, ya, z1], [x1, yb, z1], [x0, yb, z0], col, wm, hint); n++;
                    if (o.arch) {  // round head approximated by a trapezoid cap
                        const ys = yb + hw * 0.72, k2 = 0.38;
                        this.quad([x0, yb, z0], [x1, yb, z1], [x1 - dx * hw * k2, ys, z1 - dz * hw * k2], [x0 + dx * hw * k2, ys, z0 + dz * hw * k2], col, wm, hint);
                    }
                }
            }
        }
        return n;
    }
    /** projecting cornice / string course: offset ring with top and bottom caps */
    cornice(p, y, h, out, col, o = {}) {
        const q = offset(p, out), holes = (o.holes || []).map(x => offset(x, -out));
        this.ring(q, y, y + h, col); for (const hq of holes) this.ring(hq, y, y + h, col, { inward: true });
        if (o.solid) { this.cap(q, y + h, o.topCol || col, holes, 1); this.cap(q, y, col, holes, -1); return; }
        // thin lips only (cheap): top ring between the wall and the cornice edge
        this.lip(p, q, y + h, o.topCol || col, 1); this.lip(p, q, y, col, -1);
        for (let k = 0; k < holes.length; k++) { this.lip(o.holes[k], holes[k], y + h, o.topCol || col, 1); this.lip(o.holes[k], holes[k], y, col, -1); }
    }
    /** horizontal strip between two parallel rings (same vertex count) */
    lip(a, b, y, col, up = 1) { for (let i = 0; i < a.length; i++) { const j = (i + 1) % a.length; this.quad([a[i][0], y, a[i][1]], [a[j][0], y, a[j][1]], [b[j][0], y, b[j][1]], [b[i][0], y, b[i][1]], col, 'm', [0, up, 0]); } }
    /** pilasters (3-faced, 6 tris) at bay boundaries along each edge; o.every = keep every n-th, o.ends = corners only */
    pilasters(p, y0, y1, pitch, w, d, col, o = {}) {
        const s = (signedArea(p) > 0 ? 1 : -1) * (o.inward ? -1 : 1);
        for (let i = 0; i < p.length; i++) {
            if (o.edges && !o.edges.includes(i)) continue;
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az);
            if (L < pitch * 0.9) continue;
            const k = Math.max(1, Math.round(L / pitch)), dx = (bx - ax) / L, dz = (bz - az) / L, nx = s * dz, nz = -s * dx, ev = o.every || 1;
            for (let j = o.ends ? 0 : (o.inner ? 1 : 0); j <= (o.inner ? k - 1 : k); j += (o.ends ? k : ev)) {
                const t = Math.min(L - w / 2, Math.max(w / 2, j / k * L)), cx = ax + dx * t, cz = az + dz * t;
                const A = [cx - dx * w / 2, cz - dz * w / 2], B = [cx + dx * w / 2, cz + dz * w / 2], A2 = [A[0] + nx * d, A[1] + nz * d], B2 = [B[0] + nx * d, B[1] + nz * d];
                this.quad([A2[0], y0, A2[1]], [B2[0], y0, B2[1]], [B2[0], y1, B2[1]], [A2[0], y1, A2[1]], col, 'm', [nx, 0, nz]);
                this.quad([A[0], y0, A[1]], [A2[0], y0, A2[1]], [A2[0], y1, A2[1]], [A[0], y1, A[1]], col, 'm', [-dx, 0, -dz]);
                this.quad([B2[0], y0, B2[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [B2[0], y1, B2[1]], col, 'm', [dx, 0, dz]);
            }
        }
    }
    /**
     * Block letters (5x7 pixel font, horizontal runs merged) on a vertical plane: text centred at (x, y..y+h, z),
     * reading along local +x rotated by ry, facing local +z rotated by ry (i.e. a reader standing at +z).
     */
    text(str, x, y, z, ry, h, col, o = {}) {
        const px = h / 7, adv = 6 * px, chars = [...str.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')];
        const W = chars.length * adv - px, c = Math.cos(ry), sn = Math.sin(ry), d = o.d ?? 0.08, mat = o.mat || 'm';
        // o.flat: lay the text on a horizontal plane at height y (letters' up = local -z, readable from above / +z side)
        const T = o.flat ? (lx, ly) => [x + lx * c - ly * sn, y + d, z - lx * sn - ly * c] : (lx, ly) => [x + lx * c + d * sn, y + ly, z - lx * sn + d * c];
        const hint = o.flat ? [0, 1, 0] : [sn, 0, c];
        chars.forEach((ch, ci) => {
            const g = FONT[ch]; if (!g) return;
            for (let r = 0; r < 7; r++) {
                const row = g[r]; let k = 0;
                while (k < 5) {
                    if (row[k] !== '1') { k++; continue; }
                    let e = k; while (e < 5 && row[e] === '1') e++;
                    const lx0 = -W / 2 + ci * adv + k * px, lx1 = -W / 2 + ci * adv + e * px, ly1 = h - r * px - (o.flat ? h / 2 : 0), ly0 = ly1 - px;
                    this.quad(T(lx0, ly0), T(lx1, ly0), T(lx1, ly1), T(lx0, ly1), col, mat, hint);
                    k = e;
                }
            }
        });
        return W;
    }
    /** fence / railing along a polyline: posts every `pitch` m plus top and bottom rails */
    fence(line, h, pitch, col, o = {}) {
        for (let i = 0; i + 1 < line.length; i++) {
            const [ax, az] = line[i], [bx, bz] = line[i + 1], L = Math.hypot(bx - ax, bz - az), ang = -Math.atan2(bz - az, bx - ax);
            const n = Math.max(1, Math.round(L / pitch));
            for (let j = 0; j <= n; j++) { const t = j / n; this.box(ax + (bx - ax) * t, 0, az + (bz - az) * t, o.post || 0.5, j % (o.big || 1e9) === 0 ? h * 1.15 : h, o.post || 0.5, o.postCol || col); }
            this.box((ax + bx) / 2, h - 0.25, (az + bz) / 2, L, 0.12, 0.12, col, { ry: ang });
            if (o.base) this.box((ax + bx) / 2, 0, (az + bz) / 2, L, o.base, 0.45, o.baseCol || col, { ry: ang });
            if (o.bars) { const nb = Math.round(L / o.bars); for (let j = 1; j < nb; j++) { if (j % Math.round(pitch / o.bars) === 0) continue; const t = j / nb; this.quad([ax + (bx - ax) * t - 0.03, 0.4, az + (bz - az) * t], [ax + (bx - ax) * t + 0.03, 0.4, az + (bz - az) * t], [ax + (bx - ax) * t + 0.03, h - 0.2, az + (bz - az) * t], [ax + (bx - ax) * t - 0.03, h - 0.2, az + (bz - az) * t], col, 'm', [Math.sin(ang), 0, Math.cos(ang)]); } }
        }
    }

    // ---- collision (model frame, unscaled metres) ----
    col(x, z, hw, hd, angle = 0, bands = {}) { this.cols.push({ x: x + this.ox, z: z + this.oz, hw, hd, angle, ...bands }); }
    colSeg(x0, z0, x1, z1, hw) { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); this.col((x0 + x1) / 2, (z0 + z1) / 2, L / 2, hw, -Math.atan2(dz, dx)); }
    /** Exact model-space solid, including open mapped courtyards; bounds only accelerate queries. */
    colPolygon(p, { holes = [], y0 = 0, y1 = 20 } = {}) {
        const shift = q => q.map(([x, z]) => [x + this.ox, z + this.oz]);
        const poly = shift(p), bb = bbox([poly]);
        this.cols.push({ x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2, hw: (bb.x1 - bb.x0) / 2, hd: (bb.z1 - bb.z0) / 2,
            angle: 0, h: y1, y0, y1, poly, holes: holes.map(shift) });
    }
    /** cover polygon(s) with axis-aligned strips (fills courtyards, good enough for a car) */
    colPoly(list, strip = 24) {
        const bb = bbox(list), n = Math.max(1, Math.round((bb.x1 - bb.x0) / strip)), w = (bb.x1 - bb.x0) / n;
        for (let i = 0; i < n; i++) {
            const xa = bb.x0 + i * w, xb = xa + w, iv = [];
            for (const x of [xa + 0.3, xa + w / 2, xb - 0.3]) {
                const zs = [];
                for (const p of list) for (let k = 0; k < p.length; k++) {
                    const [x1, z1] = p[k], [x2, z2] = p[(k + 1) % p.length];
                    if ((x1 - x) * (x2 - x) < 0) zs.push(z1 + (z2 - z1) * (x - x1) / (x2 - x1));
                }
                zs.sort((a, c) => a - c);
                for (let k = 0; k + 1 < zs.length; k += 2) iv.push([zs[k], zs[k + 1]]);
            }
            iv.sort((a, c) => a[0] - c[0]);
            const merged = [];
            for (const v of iv) { const m = merged[merged.length - 1]; if (m && v[0] <= m[1] + 1) m[1] = Math.max(m[1], v[1]); else merged.push([...v]); }
            for (const [lo, hi] of merged) if (hi - lo > 0.5) this.col((xa + xb) / 2, (lo + hi) / 2, w / 2, (hi - lo) / 2);
        }
    }
    /** point on the polygon perimeter at fraction t, with outward normal */
    perim(p, t) {
        const s = signedArea(p) > 0 ? 1 : -1; let L = 0; const seg = [];
        for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length], l = Math.hypot(c[0] - a[0], c[1] - a[1]); seg.push([a, c, l]); L += l; }
        let d = ((t % 1) + 1) % 1 * L;
        for (const [a, c, l] of seg) { if (d <= l) { const k = d / l, dx = (c[0] - a[0]) / l, dz = (c[1] - a[1]) / l; return { x: a[0] + dx * d, z: a[1] + dz * d, nx: s * dz, nz: -s * dx }; } d -= l; }
        return { x: p[0][0], z: p[0][1], nx: 1, nz: 0 };
    }
    /** merge everything into meshes */
    finish(o = {}) {
        const group = new THREE.Group(), MT = materials();
        let tris = 0;
        for (const [k0, b] of Object.entries(this.bk)) {
            if (!b.p.length) continue;
            const k = k0 === 'm' ? (o.floodlit ? (o.masonry ? 'flm' : 'fl') : o.masonry ? 'mm' : 'm') : k0;
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
            g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
            g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
            g.computeBoundingSphere(); g.computeBoundingBox();
            const mesh = new THREE.Mesh(g, k === 'fw' ? fountainMaterials().water : MT[k]);
            if (k === 'fw') {
                mesh.onBeforeRender = (r) => fountainTick(r); mesh.renderOrder = 1; FOUNTAIN_WATER.add(mesh);
                // Basin geometry belongs to this scene; the material/animation system is shared.
                // Releasing its geometry must also release the registry's strong scene reference.
                const releaseBasin = () => { FOUNTAIN_WATER.delete(mesh); g.removeEventListener('dispose', releaseBasin); };
                g.addEventListener('dispose', releaseBasin);
            }
            mesh.castShadow = k !== 'w' && k !== 'f' && k !== 'e' && k !== 'fw'; mesh.receiveShadow = k !== 'f' && k !== 'e' && k !== 'fw';
            group.add(mesh);
            tris += b.p.length / 9;
        }
        for (const m of this.extras) { group.add(m); tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }   // custom meshes (fountain jets)
        return { group, tris };
    }
}
const G = { box: new THREE.BoxGeometry(1, 1, 1) };

// 5x7 pixel font for signage / inscriptions (Builder.text). Diacritics are folded to the base letter.
const FONT = (() => {
    const src = {
        A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110',
        D: '11100 10010 10001 10001 10001 10010 11100', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
        G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001', I: '01110 00100 00100 00100 00100 00100 01110',
        J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
        M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110',
        P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
        S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
        V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
        Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
        0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00010 00100 01000 11111',
        3: '11111 00010 00100 00010 00001 10001 01110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
        6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110',
        9: '01110 10001 10001 01111 00001 00010 01100', '.': '00000 00000 00000 00000 00000 01100 01100', '-': '00000 00000 00000 01110 00000 00000 00000',
        '&': '01100 10010 10100 01000 10101 10010 01101', '/': '00001 00010 00010 00100 01000 01000 10000', "'": '00100 00100 01000 00000 00000 00000 00000', ' ': '00000 00000 00000 00000 00000 00000 00000',
    };
    const f = {}; for (const [k, v] of Object.entries(src)) f[k] = v.split(' '); return f;
})();
