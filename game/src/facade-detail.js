// Facade surface detail (owner, 2026-11-11: "i like that masonry variant -- can we also improve all buildings to make
// them look nicer (the generic ones too ...)"). One GLSL routine shared by the driving world's facade shader (world.js)
// and the spots' facade materials (patched at load, spots/index.js; spots/osm.js is not changed: it is hashed into the
// Seattle source-context cache). Drawn in the shader from the wall's own coordinates, on the wall (not the glass):
//   kind 0  plaster: a fine stucco tone and broad patches
//   kind 1  ashlar stone: 0.6 m courses, 1.2 m blocks, alternate courses offset half a block, a tint per block
//   kind 2  plaster above a rusticated ground storey (deep horizontal grooves every 0.45 m), as on Bucharest's
//           19th-century and interwar fronts
//   kind 3  precast concrete panels: joints at every storey and bay line (the blocs)
//   kind 4  tone only (brick and cladding textures already carry their pattern)
// plus grime fading up from the base of the wall. Line widths are given by the caller from the UV derivatives (no
// derivatives inside branches) and the detail fades out as a pixel covers more than about 0.12 m. Sizes are estimates.
import * as THREE from '../vendor/three.module.min.js';

export const FACADE_DETAIL_GLSL = /* glsl */`
float fdH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fdN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fdH(i), fdH(i + vec2(1.0, 0.0)), f.x), mix(fdH(i + vec2(0.0, 1.0)), fdH(i + vec2(1.0, 1.0)), f.x), f.y); }
// 1 on a line at every integer of x, half width w (units of x), anti-aliased over fw (the pixel footprint in units of x)
float fdLine(float x, float w, float fw){ float d = abs(fract(x + 0.5) - 0.5); return 1.0 - smoothstep(w, w + max(fw, 1e-4) * 1.5, d); }
// c: wall colour; kind as above; u, y: metres along / up the wall from its base; fu, fy: metres per pixel along u / y;
// bay: bay coordinate (1 per bay) and its pixel footprint fb; st: storey coordinate (1 per storey) and fs
vec3 facadeDetail(vec3 c, float kind, float u, float y, float fu, float fy, float bay, float fb, float st, float fs) {
    float mpp = max(fu, fy), fade = 1.0 - smoothstep(0.05, 0.12, mpp);
    if (fade <= 0.0) return c;
    float n = fdN(vec2(u, y) * 1.9) * 0.55 + fdN(vec2(u * 0.21, y * 0.29)) * 0.45, k = 1.0 + (n - 0.5) * (kind > 3.5 ? 0.05 : 0.09);
    if (kind > 0.5 && kind < 1.5) {
        float row = floor(y / 0.6), bu = u / 1.2 + 0.5 * mod(row, 2.0);
        float j = max(fdLine(y / 0.6, 0.016, fy / 0.6), fdLine(bu, 0.008, fu / 1.2));
        k *= (0.955 + 0.075 * fdH(vec2(floor(bu), row))) * (1.0 - 0.26 * j);
    } else if (kind > 1.5 && kind < 2.5 && st < 0.92) {
        float j = fdLine(y / 0.45, 0.045, fy / 0.45);
        k *= 1.0 - 0.3 * j;
    } else if (kind > 2.5 && kind < 3.5) {
        float j = max(fdLine(st, 0.006, fs), max(fdLine(bay, 0.005, fb), fdLine(st - 0.28, 0.004, fs) * 0.6));
        k *= (0.97 + 0.05 * fdH(vec2(floor(bay), floor(st)))) * (1.0 - 0.22 * j);
    }
    k *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 1.4, y)); // grime and splash at the base
    return c * mix(1.0, k, fade);
}`;

/** facade kind for a spot facade style (spots/osm.js STYLES keys) */
export function spotFacadeKind(style) {
    // (eclectic / interwar: plaster only: the spot walls cannot tell a shop ground floor from the first floor above it, so a
    // rusticated base would land above the shops)
    if (/civic/.test(style)) return 1;
    if (/bloc|concrete|apartment|parking/.test(style)) return 3;
    if (/brick|office|mall|industrial|shop|glass/.test(style)) return 4;
    return 0; // house, plain plaster
}

const PATCHED = new WeakSet();
/** Add the detail to a spot facade material (made by spots/osm.js facadeMaterial: map = 4 bays x 4 storeys per tile,
 *  userData.style = { bay, floor, ... }). Glass is told apart by its dark colour in the map. Idempotent. */
export function patchSpotFacade(m) {
    if (!m || PATCHED.has(m) || !m.map || !/^facade-/.test(m.name || '') || !m.userData?.style) return false;
    PATCHED.add(m);
    const S = m.userData.style, kind = spotFacadeKind(m.name.slice(7)), prev = m.onBeforeCompile;
    m.onBeforeCompile = function (sh, r) {
        prev?.call(this, sh, r);
        sh.uniforms.fdBay = { value: S.bay || 4 }; sh.uniforms.fdFloor = { value: S.floor || 4 };
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float fdBay; uniform float fdFloor;\n${FACADE_DETAIL_GLSL}`)
            .replace('#include <map_fragment>', `#include <map_fragment>
            #ifdef USE_MAP
            {
                vec2 fdDx = dFdx(vMapUv), fdDy = dFdy(vMapUv), fdW = abs(fdDx) + abs(fdDy);
                float bay = vMapUv.x * 4.0, st = vMapUv.y * 4.0, lum = dot(sampledDiffuseColor.rgb, vec3(0.3, 0.59, 0.11));
                if (lum > 0.5) diffuseColor.rgb = facadeDetail(diffuseColor.rgb, ${kind.toFixed(1)}, bay * fdBay, st * fdFloor, fdW.x * 4.0 * fdBay, fdW.y * 4.0 * fdFloor, bay, fdW.x * 4.0, st, fdW.y * 4.0);
            }
            #endif`);
    };
    const key = m.customProgramCacheKey?.bind(m);
    m.customProgramCacheKey = () => (key ? key() : '') + '|facade-detail-' + kind;
    m.needsUpdate = true;
    return true;
}
void THREE;
