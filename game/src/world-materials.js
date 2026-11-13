// ============================================================================
//  WORLD MATERIALS — the facade atlas (day / night), the solid world material with its facade-detail shader, the
//  ground noise texture and the sign atlas (split out of world.js, spec 22)
// ============================================================================
import * as THREE from '../vendor/three.module.min.js';
import { makeCanvasTexture } from './util.js';
import { rgb } from './geobuild.js';
import { makeTextures } from './buildings.js';
import { FACADE_DETAIL_GLSL } from './facade-detail.js';

// ---------------------------------------------------------------------------
//  Materials / textures
// ---------------------------------------------------------------------------
export function makeAtlas() {
    // 4x4 tiles of 256 px: tiles 0-7 = buildings.js facade textures, 8-15 = variants drawn here
    const T = makeTextures();
    const S = 256;
    const win = (ctx, x, y, { cols, rows, ww, wh, frame = 'rgba(255,255,255,0.45)', glass = 'rgba(35,55,85,0.8)', lit = 0, arch = false, shutters = null, band = 0 }) => {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, S, S);
        const cw = S / cols, ch = S / rows;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
            const wx = x + i * cw + cw * (1 - ww) / 2, wy = y + j * ch + ch * (1 - wh) / 2, w = cw * ww, h = ch * wh;
            ctx.fillStyle = frame; ctx.fillRect(wx - 3, wy - 3, w + 6, h + 6);
            ctx.fillStyle = Math.random() < lit ? 'rgba(90,110,130,0.75)' : glass;
            if (arch) { ctx.beginPath(); ctx.moveTo(wx, wy + h); ctx.lineTo(wx, wy + w / 2); ctx.arc(wx + w / 2, wy + w / 2, w / 2, Math.PI, 0); ctx.lineTo(wx + w, wy + h); ctx.closePath(); ctx.fill(); }
            else ctx.fillRect(wx, wy, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(wx, wy + (arch ? w / 2 : 0), w, h * 0.12);
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(wx + w / 2 - 1, wy, 2, h); // mullion
            if (shutters) { ctx.fillStyle = shutters; ctx.fillRect(wx - w * 0.28, wy, w * 0.24, h); ctx.fillRect(wx + w * 1.04, wy, w * 0.24, h); }
            ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(wx - 4, wy + h + 3, w + 8, 4); // sill shadow
        }
        if (band) { ctx.fillStyle = `rgba(0,0,0,${band})`; for (let j = 0; j < rows; j++) ctx.fillRect(x, y + j * ch, S, 5); }
    };
    const tex = makeCanvasTexture(4 * S, 4 * S, (ctx) => {
        const order = ['interwar', 'eclectic', 'civic', 'bloc', 'glass', 'house', 'shop', 'plain'];
        const at = (k) => [(k % 4) * S, (3 - Math.floor(k / 4)) * S]; // flipY: uv row r → canvas row 3-r
        order.forEach((name, k) => {
            const [x, y] = at(k);
            if (name === 'plain') {
                ctx.fillStyle = '#f2f2f2'; ctx.fillRect(x, y, S, S);
                for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; ctx.fillRect(x + Math.random() * S, y + Math.random() * S, 2 + Math.random() * 4, 2 + Math.random() * 4); }
                ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x, y + S - 6, S, 6);
            } else ctx.drawImage(T[name].image, x, y, S, S);
        });
        // variants
        let [x, y] = at(8); win(ctx, x, y, { cols: 3, rows: 2, ww: 0.62, wh: 0.5, band: 0.12 });                                   // interwar: square windows, strong bands
        [x, y] = at(9); win(ctx, x, y, { cols: 3, rows: 2, ww: 0.36, wh: 0.66, arch: true, frame: 'rgba(255,255,255,0.7)' });       // eclectic: arched
        [x, y] = at(10); win(ctx, x, y, { cols: 2, rows: 2, ww: 0.5, wh: 0.7, frame: 'rgba(0,0,0,0.12)', glass: 'rgba(30,45,70,0.75)' }); // civic: tall
        [x, y] = at(11); win(ctx, x, y, { cols: 4, rows: 2, ww: 0.6, wh: 0.42, glass: 'rgba(25,35,55,0.8)', lit: 0.2, band: 0.08 }); // bloc: wide panes
        [x, y] = at(12); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, S, S);                                                       // glass: blue-green curtain wall
        for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) { ctx.fillStyle = (i + j) % 3 ? 'rgba(30,70,90,0.6)' : 'rgba(50,95,110,0.5)'; ctx.fillRect(x + i * S / 2 + 2, y + j * S / 4 + 2, S / 2 - 4, S / 4 - 4); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x + i * S / 2 + 2, y + j * S / 4 + 2, S / 2 - 4, 5); }
        [x, y] = at(13); win(ctx, x, y, { cols: 2, rows: 1, ww: 0.4, wh: 0.45, shutters: 'rgba(90,60,40,0.8)', frame: 'rgba(255,255,255,0.8)' }); // house: shutters
        [x, y] = at(14); ctx.drawImage(T.shop.image, x, y, S, S); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, S, S);  // shop (lighter)
        [x, y] = at(15); ctx.fillStyle = '#e9e6df'; ctx.fillRect(x, y, S, S); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * S / 4, y); ctx.lineTo(x + i * S / 4, y + S); ctx.stroke(); } // plain: panels
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    for (const t of Object.values(T)) t.dispose();
    return tex;
}

/** night-window data atlas, same layout as the facade atlas: R = window glass mask, G = per-window random, B = shopfront
 *  (always lit). Built from the facade atlas pixels (dark bluish glass), windows = 4-connected components. */
/** night / window data atlases, same layout as the facade atlas. nightMap: R = window glass, G = per-window random,
 *  B = shopfront (255) / brand band (128). winMap: RG = window rectangle origin in tile texels (v up), BA = rectangle size; zero width = non-glass.
 *  Windows = connected glass pixels of the facade atlas, filled to their bounding rectangle (the per-pixel colour test
 *  left noisy holes that read as "TV static" reflections); specks under 24 px are dropped. */
export function nightAtlas(atlas) {
    const src = atlas.image, W = src.width, H = src.height;
    const sctx = src.getContext('2d', { willReadFrequently: true }), d = sctx.getImageData(0, 0, W, H).data;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); return { c, x, im: x.createImageData(W, H) }; };
    const N = mk(), o = N.im.data, u = new Uint8Array(W * H * 4);
    const glass = new Uint8Array(W * H), comp = new Int32Array(W * H).fill(-1), S = W / 4;
    const tileAt = (x, y) => (x / S | 0) + (3 - (y / S | 0)) * 4; // canvas row 0 = uv row 3 (flipY)
    for (let k = 0, p = 0; k < W * H; k++, p += 4) {
        const r = d[p], g = d[p + 1], b = d[p + 2], t = tileAt(k % W, k / W | 0), shop = t === 6 || t === 14;
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        const fy = ((k / W | 0) % S) / S; // (0 = top of the cell: the shop texture's coloured sign band is the top ~14 %)
        glass[k] = shop ? (fy < 0.15 && lum > 40 ? 3 : b > r + 25 && lum > 60 ? 2 : 0) : (lum < 150 && b >= r + 4 ? 1 : 0);
    }
    for (let k = 0; k < W * H; k++) o[k * 4 + 3] = 255;
    const stack = [];
    for (let k = 0; k < W * H; k++) {
        if (!glass[k] || comp[k] >= 0) continue;
        const kind = glass[k], px = []; comp[k] = 1; stack.push(k);
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        while (stack.length) {
            const q = stack.pop(), x = q % W, y = q / W | 0; px.push(q);
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
            for (const n of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1]) if (n >= 0 && glass[n] === kind && comp[n] < 0) { comp[n] = 1; stack.push(n); }
        }
        if (px.length < 24 && kind === 1) continue;
        const rv = ((x0 * 73 + y0 * 151 + x1 * 199 + y1 * 47) >>> 0) % 255;
        if (kind === 1) { // fill the window rectangle
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                const p = (y * W + x) * 4; o[p] = 255; o[p + 1] = rv; o[p + 2] = 0;
                // Constant metadata keeps a room attached to one opening. Interpolating quantised local positions made
                // floor / furniture edges step as the camera moved, and a 4x4 UV seed split wider windows into rooms.
                u[p] = x0 % S; u[p + 1] = S - 1 - y1 % S; u[p + 2] = x1 - x0 + 1; u[p + 3] = y1 - y0 + 1;
            }
        } else for (const q of px) { const p = q * 4; o[p] = kind === 3 ? 0 : 255; o[p + 1] = rv; o[p + 2] = kind === 2 ? 255 : 128; }
    }
    N.x.putImageData(N.im, 0, 0);
    const tex = (c, nearest) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter; t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter; t.generateMipmaps = !nearest; t.anisotropy = 4; return t; };
    // Canvas alpha premultiplication corrupts rectangle bytes when A stores height. Upload the bytes directly.
    const rect = new THREE.DataTexture(u, W, H); rect.flipY = true; rect.needsUpdate = true;
    rect.minFilter = rect.magFilter = THREE.NearestFilter; rect.generateMipmaps = false;
    return { night: tex(N.c, false), win: rect };
}

export function solidMaterial(atlas, preparedNight = null) {
    // (2026-11-07, world-visual) PBR so glass curtain walls pick up the sky probe / environment (tiles 4 / 12: metalness
    // 0.55, roughness 0.16; everything else matte), and lit windows at night: render.js eases emissiveIntensity from 0
    // by day to userData.nightEmissive at night (contract 01 → Render); ~42 % of windows lit, warm 2700–4000 K, a few
    // TV-blue, shopfronts always lit and brighter. One material, no extra draw calls.
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.92, metalness: 0, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0 });
    m.userData.nightEmissive = 1.2;
    m.userData.uClosed = { value: 0 }; // share of shops closed (shutters down), set by world from the local hour
    let night = null, win = null; try { ({ night, win } = preparedNight || nightAtlas(atlas)); } catch (e) { console.warn('[world] night atlas', e); }
    m.userData.ownedTextures = [night, win].filter(Boolean); // shader-closure textures belong to this district material
    m.onBeforeCompile = (sh) => {
        sh.uniforms.winTexel = { value: 4 / atlas.image.width }; sh.uniforms.nightMap = { value: night }; sh.uniforms.winMap = { value: win }; sh.uniforms.uClosed = m.userData.uClosed;
        sh.vertexShader = 'attribute float tile;\nvarying float vTileRaw;\nvarying float vWY;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvTileRaw = tile;').replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = FACADE_DETAIL_GLSL + '\nconst vec2 FD_GRID[16] = vec2[16](vec2(2.,2.),vec2(3.,2.),vec2(4.,2.),vec2(4.,2.),vec2(4.,2.),vec2(3.,1.),vec2(1.,1.),vec2(1.,1.),vec2(3.,2.),vec2(3.,2.),vec2(2.,2.),vec2(4.,2.),vec2(2.,4.),vec2(2.,1.),vec2(1.,1.),vec2(4.,1.));\nconst float FD_KIND[16] = float[16](2.,2.,1.,3.,-1.,0.,-1.,0.,2.,2.,1.,3.,-1.,0.,-1.,4.);\n' + 'varying float vTileRaw;\nvarying float vWY;\nuniform sampler2D nightMap;\nuniform sampler2D winMap;\nuniform float winTexel;\nuniform float uClosed;\nfloat fh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat fvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh1(i), fh1(i + vec2(1, 0)), f.x), mix(fh1(i + vec2(0, 1)), fh1(i + vec2(1, 1)), f.x), f.y); }\n' + sh.fragmentShader.replace('#include <map_fragment>', `
    float isGlass = 0.0, winFar = 1.0, glassOpen = 0.0; vec3 roomCol = vec3(0.0);
#ifdef USE_MAP
    // Derivatives are evaluated before divergent window branches, in the current draw camera's view frame.
    vec3 facadeDx = dFdx(-vViewPosition), facadeDy = dFdy(-vViewPosition);
    vec2 uvDx = dFdx(vMapUv), uvDy = dFdy(vMapUv);
    if (vTile > -0.5) {
        vec2 cellSz = vec2(0.25, 0.25);
        vec2 cellId = vec2(mod(vTile, 4.0), floor(vTile / 4.0 + 0.01));
        vec2 f = fract(vMapUv);
        vec2 auv = (cellId + 0.006 + f * 0.988) * cellSz;
        vec4 sampledDiffuseColor = textureGrad(map, auv, dFdx(vMapUv) * cellSz, dFdy(vMapUv) * cellSz);
        diffuseColor *= sampledDiffuseColor;
        bool shopT = abs(vTile - 6.0) < 0.1 || abs(vTile - 14.0) < 0.1, glassT = abs(vTile - 4.0) < 0.1 || abs(vTile - 12.0) < 0.1;
        float px = max(length(dFdx(vMapUv)), length(dFdy(vMapUv)));
        winFar = smoothstep(0.06, 0.22, px); // window cells of ≲ 15 px: the flat atlas look
        vec4 rect = texture(winMap, auv) * (255.0 * winTexel);
        vec2 windowUV = (fract(vMapUv) * 0.988 + 0.006 - rect.xy) / max(rect.zw, vec2(winTexel));
        isGlass = (shopT || glassT) ? 0.0 : step(winTexel * 0.5, rect.z);
        if (isGlass > 0.5 && winFar < 0.999) {
            // One stable room per connected window and repeated atlas tile. A window may span a quarter-tile boundary.
            vec2 key = floor(vMapUv) + rect.xy * 31.0 + vec2(vTile * 7.0, vTile);
            float r1 = fh1(key), r2 = fh1(key + 7.3), r3 = fh1(key + 13.1), r4 = fh1(key + 21.7);
            // Recover increasing-U / increasing-V axes and their metre scales from the facade itself. Cross(up,N)
            // reverses U on the opposite footprint winding; fixed room dimensions also make props slide in world space.
            float det = uvDx.x * uvDy.y - uvDx.y * uvDy.x;
            float invDet = 1.0 / (abs(det) > 1e-12 ? det : (det < 0.0 ? -1e-12 : 1e-12));
            vec3 dPdu = (facadeDx * uvDy.y - facadeDy * uvDx.y) * invDet;
            vec3 dPdv = (facadeDy * uvDx.x - facadeDx * uvDy.x) * invDet;
            vec3 Nv = normalize(vNormal), Tv = normalize(dPdu), Bv = normalize(dPdv);
            vec3 dir = -normalize(vViewPosition);
            vec3 dd = vec3(dot(dir, Tv), dot(dir, Bv), max(1e-3, dot(dir, -Nv)));
            float RW = max(0.1, length(dPdu) * rect.z / 0.988), RH = max(0.1, length(dPdv) * rect.w / 0.988), RD = 2.6 + 2.4 * r1;
            vec3 p0 = vec3(windowUV * vec2(RW, RH), 0.0);
            float tx = dd.x > 0.0 ? (RW - p0.x) / max(dd.x, 1e-4) : -p0.x / min(dd.x, -1e-4);
            float ty = dd.y > 0.0 ? (RH - p0.y) / max(dd.y, 1e-4) : -p0.y / min(dd.y, -1e-4);
            float tz = RD / dd.z, t = min(tx, min(ty, tz));
            vec3 hp = p0 + dd * t;
            vec3 wallC = mix(vec3(0.78, 0.72, 0.62), r2 < 0.5 ? vec3(0.62, 0.66, 0.7) : vec3(0.82, 0.76, 0.66), r3);
            vec3 c;
            if (t == tz) { c = wallC; if (hp.y < RH * 0.42 && fract(hp.x / RW * 1.7 + r2) > 0.45) c = vec3(0.24, 0.17, 0.12); // furniture silhouette
                           else if (hp.y > RH * 0.55 && hp.y < RH * 0.85 && fract(hp.x / RW * 2.3 + r4) > 0.7) c = vec3(0.35, 0.3, 0.26); } // picture / shelf
            else if (t == ty) c = dd.y < 0.0 ? vec3(0.36, 0.26, 0.18) : vec3(0.88, 0.86, 0.82);
            else c = wallC * 0.82;
            c *= mix(1.0, 0.5, hp.z / RD); // light falls off into the room
            // curtains / blinds (fabric on the glass plane, top down to a random height); a few open windows
            float cl = r4 < 0.55 ? 1.0 - (0.15 + 0.6 * r3) : 2.0;
            vec3 fabric = mix(vec3(0.9, 0.88, 0.82), r2 < 0.3 ? vec3(0.62, 0.52, 0.42) : vec3(0.82, 0.8, 0.74), r1);
            if (windowUV.y > cl) { c = fabric * (0.85 + 0.15 * sin(windowUV.x * 40.0)); glassOpen = 0.5; }
            if (r1 > 0.96 && r2 > 0.5) glassOpen = 1.0;
            roomCol = c;
            // reveal shadow along the top / one side of the opening
            float rev = 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.08, 1.0 - windowUV.y)) - 0.3 * (1.0 - smoothstep(0.0, 0.06, windowUV.x));
            diffuseColor.rgb = mix(c * 0.34 * rev, diffuseColor.rgb, winFar); // (rooms are darker than the street by day)
        }
        if (!shopT && !glassT && isGlass < 0.5) { // weathering: grime near the ground, rain streaks, plaster patches
            float g = 1.0 - 0.16 * (1.0 - smoothstep(0.2, 1.8, vWY));
            float streak = fvn(vec2(vMapUv.x * 9.0, 0.5)) * smoothstep(0.55, 1.0, fvn(vec2(vMapUv.x * 23.0, vMapUv.y * 0.6)));
            g *= 1.0 - 0.07 * streak;
            bool old = abs(vTile - 1.0) < 0.1 || abs(vTile - 9.0) < 0.1 || abs(vTile - 3.0) < 0.1 || abs(vTile - 11.0) < 0.1;
            if (old) g *= 0.94 + 0.12 * smoothstep(0.35, 0.75, fvn(vMapUv * vec2(1.7, 2.3) + vTile));
            diffuseColor.rgb *= mix(g, 1.0, winFar * 0.6);
            // stone, rusticated base, panel joints, plaster tone by facade type (facade-detail.js; owner, 2026-11-11: "improve
            // all buildings"). Metres along / up the wall from the facade's own UV derivatives (taken above, outside branches).
            int fdT = int(vTile + 0.5); float fdK = (fdT >= 0 && fdT < 16) ? FD_KIND[fdT] : -1.0;
            if (fdK > -0.5) {
                vec2 fdG = FD_GRID[fdT];
                float fdDet = uvDx.x * uvDy.y - uvDx.y * uvDy.x, fdInv = 1.0 / (abs(fdDet) > 1e-12 ? fdDet : 1e-12);
                float mU = length((facadeDx * uvDy.y - facadeDy * uvDx.y) * fdInv), mV = length((facadeDy * uvDx.x - facadeDx * uvDy.x) * fdInv);
                vec2 fdW = abs(uvDx) + abs(uvDy);
                diffuseColor.rgb = facadeDetail(diffuseColor.rgb, fdK, vMapUv.x * mU, vMapUv.y * mV, fdW.x * mU, fdW.y * mV, vMapUv.x * fdG.x, fdW.x * fdG.x, vMapUv.y * fdG.y, fdW.y * fdG.y);
            }
        }
        if (uClosed > 0.001 && (abs(vTile - 6.0) < 0.1 || abs(vTile - 14.0) < 0.1)) { // closed shops: roller shutters over the glass
            // the whole shop opening below the sign band (not the per-pixel glass mask, which aliased into vertical
            // streaks): horizontal roller-shutter slats every ~19 cm, a darker housing box at the top
            float sid = floor(vMapUv.x * 4.0), fu = fract(vMapUv.x * 4.0), fv = fract(vMapUv.y);
            float hc = fract(sin(dot(vec2(sid, floor(vMapUv.y) + vTile * 3.1), vec2(41.3, 289.1))) * 15731.743);
            if (hc < uClosed && fv < 0.85 && fv > 0.03 && fu > 0.04 && fu < 0.96) {
                float slat = 0.82 + 0.18 * smoothstep(0.35, 0.5, fract(vMapUv.y * 22.0)) * (1.0 - smoothstep(0.85, 1.0, fract(vMapUv.y * 22.0)));
                diffuseColor.rgb = vec3(0.36, 0.37, 0.38) * (fv > 0.78 ? 0.6 : slat);
            }
        }
    }
#endif`).replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
    if (vTile > -0.5 && (abs(vTile - 4.0) < 0.1 || abs(vTile - 12.0) < 0.1)) {
        // (backlog r3-landmarks-1) a light reviewed glass colour (Agora's silver-grey curtain wall, building-review.js) is pale
        // coated glass: less mirror, more of its own colour. The palette glass tints all stay below the threshold.
        float gLight = 0.0;
#ifdef USE_COLOR
        gLight = smoothstep(0.5, 0.56, dot(vColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vColor.rgb * 0.82, gLight * 0.6);
#endif
        metalnessFactor = mix(0.55, 0.12, gLight); roughnessFactor = mix(0.16, 0.34, gLight);
    }
#ifdef USE_MAP
    else if (isGlass > 0.5) { // window panes: calm sky reflection over the fake room (curtains / open windows reflect less)
        float gl = 1.0 - glassOpen;
        metalnessFactor = mix(metalnessFactor, 0.35, gl); roughnessFactor = mix(roughnessFactor, 0.12, gl);
    }
#endif`).replace('#include <emissivemap_fragment>', `
#ifdef USE_MAP
    if (vTile > -0.5 && totalEmissiveRadiance.r > 0.001) {
        vec2 cellSz2 = vec2(0.25, 0.25);
        vec2 cellId2 = vec2(mod(vTile, 4.0), floor(vTile / 4.0 + 0.01));
        vec2 auv2 = (cellId2 + 0.006 + fract(vMapUv) * 0.988) * cellSz2;
        vec3 nm = textureGrad(nightMap, auv2, dFdx(vMapUv) * cellSz2, dFdy(vMapUv) * cellSz2).rgb;
        // lit in runs (2–3 neighbouring bays of one floor share a state, like real offices / flats), and distance-stable:
        // once a facade tile covers only a few pixels, the per-window pattern fades to its average glow (no speckle)
        vec2 cellK = vec2(floor(vMapUv.x / 2.5), floor(vMapUv.y));
        float h = fract(sin(dot(cellK + vec2(floor(nm.g * 2.99) * 7.0, vTile), vec2(12.9898, 78.233))) * 43758.5453);
        float shop = step(0.75, nm.b), sign = step(0.25, nm.b) * (1.0 - shop), lit = max(shop, step(h, 0.42));
        float h2 = fract(h * 13.7);
        vec3 col = h2 > 0.93 ? vec3(0.55, 0.68, 1.0) : mix(vec3(1.0, 0.6, 0.3), vec3(1.0, 0.82, 0.58), h2);
        if (shop + sign > 0.5) { // shops: interior tint per shop (supermarket cool white, café warm, pharmacy green, bank blue, …)
            float sid = floor(vMapUv.x * 4.0);
            float hs = fract(sin(dot(vec2(sid, floor(vMapUv.y) + vTile * 3.1), vec2(127.1, 311.7))) * 43758.5453);
            float hc = fract(sin(dot(vec2(sid, floor(vMapUv.y) + vTile * 3.1), vec2(41.3, 289.1))) * 15731.743);
            vec3 tint = hs < 0.25 ? vec3(0.68, 0.78, 0.88) : hs < 0.5 ? vec3(1.0, 0.58, 0.28) : hs < 0.62 ? vec3(0.55, 1.0, 0.62) : hs < 0.74 ? vec3(0.5, 0.66, 1.0) : vec3(1.0, 0.8, 0.6);
            float closed = step(hc, uClosed);
            col = shop * tint * (0.85 + 0.3 * fract(hs * 7.3)) * (1.0 - 0.96 * closed)
                + sign * texture(map, auv2).rgb * 1.5 * (1.0 - 0.6 * closed); // brand band brighter than the glass
            lit = 1.0; nm.r = 1.0;
        }
        float far = smoothstep(0.12, 0.45, max(length(dFdx(vMapUv)), length(dFdy(vMapUv)))); // facade tiles per pixel
        float mask = mix(step(0.5, nm.r), nm.r, far);
        lit = mix(lit, mix(0.42, 1.0, max(shop, sign)), far);
        col = mix(col, shop + sign > 0.5 ? col : vec3(1.0, 0.74, 0.47), far);
        if (isGlass > 0.5) col *= mix(vec3(0.75), roomCol * 0.9 + 0.06, (1.0 - winFar) * (1.0 - far)); // (lit room, not a white card)
        if (abs(vTile - 4.0) < 0.1 || abs(vTile - 12.0) < 0.1) { // curtain walls: lit office floors in runs, dim cool light, never per-pane tiles
            float fl = floor(vMapUv.y * (abs(vTile - 12.0) < 0.1 ? 4.0 : 2.0)), run = floor(vMapUv.x / 3.0);
            float hf = fract(sin(dot(vec2(fl, run * 0.37 + floor(vMapUv.x / 9.0)), vec2(12.9898, 78.233))) * 43758.5453);
            float fv = fract(vMapUv.y * (abs(vTile - 12.0) < 0.1 ? 4.0 : 2.0));
            lit = step(hf, 0.28) * smoothstep(0.08, 0.2, fv) * (1.0 - smoothstep(0.8, 0.92, fv));
            // (after round 6: lit floors read as solid white slabs) panes between mullions, some with blinds down or dark
            // desks, ceiling lights brighter at the top of the floor, dimmer overall
            { float px2 = vMapUv.x * 4.0, pf = fract(px2), pid = fract(sin(dot(vec2(floor(px2), fl), vec2(39.3, 11.7))) * 24634.63);
              float mull = smoothstep(0.02, 0.07, pf) * (1.0 - smoothstep(0.93, 0.98, pf));
              lit *= mull * (pid < 0.18 ? 0.15 : pid < 0.35 ? 0.55 : 1.0) * (0.55 + 0.45 * smoothstep(0.3, 0.85, fv)); }
            col = mix(vec3(0.78, 0.84, 0.92), vec3(1.0, 0.82, 0.6), step(0.6, fract(hf * 9.1))) * 0.26;
            mask = 1.0; lit = mix(lit, 0.24, far) + 0.03;
        }
        totalEmissiveRadiance *= mask * lit * col;
    } else totalEmissiveRadiance *= 0.0;
#else
    totalEmissiveRadiance *= 0.0;
#endif`);
    };
    { const ob = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { ob(sh, r);
        // (the tile id is an interpolated varying: 7.99999 picked the wrong atlas cell on some pixels — the 'TV static' on
        //  windows; round it once per fragment)
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'void main() {\n\tfloat vTile = floor(vTileRaw + 0.5);'); }; }
    m.customProgramCacheKey = () => 'osm-solid-atlas-pbr5-anchored-rooms-facade-detail';
    return m;
}

export function noiseTexture() {
    const t = makeCanvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < img.data.length; i += 4) { const v = 235 + Math.random() * 20 - (Math.random() < 0.03 ? 30 : 0); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; }
        ctx.putImageData(img, 0, 0);
        for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.03})`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 0, 7); ctx.fill(); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
}

/** Sign atlas: pages of 2048x2048 with 256x64 cells */
export class SignAtlas {
    constructor() { this.pages = []; this.map = new Map(); this.cols = 8; this.rows = 32; }
    get(text, bg = '#1f2937', fg = '#ffffff', accent = null, force = false, twoLine = false) {
        const key = text + '|' + bg + '|' + fg + '|' + accent + (twoLine ? '|2' : '');
        let r = this.map.get(key); if (r) return r;
        let page = this.pages[this.pages.length - 1];
        if (!page || page.n >= this.cols * this.rows) {
            if (this.pages.length >= (force ? 7 : 6)) return null; // road-sign pictograms may use one extra page
            const c = document.createElement('canvas'); c.width = 2048; c.height = 2048;
            page = { canvas: c, ctx: c.getContext('2d'), n: 0, tex: null };
            this.pages.push(page);
        }
        const i = page.n++, col = i % this.cols, row = Math.floor(i / this.cols);
        const W = 256, H = 64, x = col * W, y = row * H, ctx = page.ctx;
        ctx.fillStyle = bg; ctx.fillRect(x, y, W, H);
        if (accent) { ctx.fillStyle = accent; ctx.fillRect(x, y + H - 7, W, 7); }
        ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let size = 40; ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
        while (ctx.measureText(text).width > W - 16 && size > 14) { size -= 2; ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`; }
        // (2026-11-12 render review, fascias) twoLine: a name that only fits a 256 px cell in small type ("Minimarket Bobtig
        // Non-Stop" at ~16 px) is set on two balanced lines in larger type instead
        let lines = null;
        if (twoLine && size < 26 && text.includes(' ')) {
            const sp = [...text.matchAll(/ /g)].map(m => m.index), mid = text.length / 2, cut = sp.reduce((a, b) => Math.abs(b - mid) < Math.abs(a - mid) ? b : a);
            const L2 = [text.slice(0, cut), text.slice(cut + 1)], usable = H - (accent ? 10 : 6);
            let s2 = Math.min(28, Math.floor(usable / 2.1)); const f2 = (q) => `bold ${q}px "Helvetica Neue", Arial, sans-serif`; ctx.font = f2(s2);
            while (Math.max(...L2.map(l => ctx.measureText(l).width)) > W - 16 && s2 > 14) { s2 -= 1; ctx.font = f2(s2); }
            if (s2 > size) { lines = L2; size = s2; } else ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
        }
        if (lines) { const cy = y + H / 2 - (accent ? 3 : 0), dy = size * 0.55; ctx.fillText(lines[0], x + W / 2, cy - dy, W - 12); ctx.fillText(lines[1], x + W / 2, cy + dy, W - 12); }
        else ctx.fillText(text, x + W / 2, y + H / 2 - (accent ? 3 : 0), W - 12);
        const pi = this.pages.indexOf(page), tw = lines ? Math.max(...lines.map(l => ctx.measureText(l).width)) : ctx.measureText(text).width;
        r = { page: pi, u0: (x + 1) / 2048, u1: (x + W - 1) / 2048, v0: 1 - (y + H - 1) / 2048, v1: 1 - (y + 1) / 2048, aspect: Math.min(4, Math.max(1.6, tw / H + 0.6)) };
        this.map.set(key, r); return r;
    }
    /** a 64×64 pictogram (road signs) drawn by draw(ctx, x, y, size); four per atlas cell */
    icon(key, draw) {
        const k = 'icon|' + key;
        let r = this.map.get(k); if (r) return r;
        if (!this.sq || this.sq.k >= 4) {
            const cell = this.get('\u0000' + (this.nIcon = (this.nIcon || 0) + 1), 'rgba(0,0,0,0)', '#000', null, true); if (!cell) return null;
            const page = this.pages[cell.page];
            const x = Math.round(cell.u0 * 2048 - 1), y = Math.round((1 - cell.v1) * 2048 - 1);
            page.ctx.clearRect(x, y, 256, 64);
            this.sq = { page: cell.page, x, y, k: 0 };
        }
        const S2 = 64, x = this.sq.x + this.sq.k * 64, y = this.sq.y, ctx = this.pages[this.sq.page].ctx;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, S2, S2); ctx.clip(); draw(ctx, x, y, S2); ctx.restore();
        this.sq.k++;
        r = { page: this.sq.page, u0: (x + 1) / 2048, u1: (x + S2 - 1) / 2048, v0: 1 - (y + S2 - 1) / 2048, v1: 1 - (y + 1) / 2048, aspect: 1 };
        this.map.set(k, r); return r;
    }
    textures() {
        return this.pages.map(p => { const t = new THREE.CanvasTexture(p.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
    }
}

