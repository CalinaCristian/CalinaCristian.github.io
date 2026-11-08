// ============================================================================
//  Seattle kit for the spots-sea scenes (round 5, lane spots-sea): the real
//  city around the hero spots, at 1:1 and from lat/lon.
//   - seaHeight(lat, lon): bare-earth ground (m NAVD88) from a few calibrated
//     terms (downtown slope off the seawall, Queen Anne / Capitol / First Hill,
//     Lake Union and Elliott Bay at sea level)
//   - facadeMaterial(style): curtain-wall / punched-window façades drawn in the
//     shader from world position (no textures, no noise): mullions, spandrels,
//     reflective glass by day, coherent lit offices / flats at night
//     (material.userData.nightEmissive = render.js night-lit contract), filtered
//     to the floor average at distance (no moiré at 3 km)
//   - seaTowers(): ~40 downtown / Belltown / SLU towers with their real
//     heights, footprints and silhouettes (Columbia Center's three stepped
//     lobes, 1201 Third's crown, Smith Tower's pyramid, the Westin cylinders…)
//   - seaMidrise(): instanced low / mid-rise blocks on land between the viewer
//     and downtown (same façade shader)
//   - cityGround(): the far ground (hills, slopes, street grid) around the scene
//   - seaWater(): Elliott Bay / Lake Union water (normal-mapped, reflects the
//     PMREM sky; ripples drift) — switch to render's shared water when it lands
//   - ferries (WSF Jumbo Mark II on the Bainbridge run), port cranes (T-46 /
//     Harbor Island), bay lights
//   - seaNeedle(): the Space Needle rebuilt (no coplanar discs: one lathe
//     profile for the top house, recessed glass bands, radial underside beams,
//     three gold elevator cabs on the core, SkyLine ring, floodlit at night)
//   - seaWheel(): the Seattle Great Wheel (42 enclosed gondolas, LED rim)
//   - seaBackdrop(ctx, o): everything above in one call
// Coordinates: scene metres (x east, z south, y up, y = 0 at data.origin.elev).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, clamp, smooth, lerp, inPoly, canvas, canvasTexture, fitDraw } from '../kit.js';
import { LANDMARKS, buildLandmark } from '../../landmarks.js';
import { sourceMountain } from '../source-landmark.js';

export const NEEDLE_LL = [47.6205063, -122.3493043, 40.5];
export const RAINIER_LL = [46.8529, -121.7604, 4392];
/** Elliott Bay shoreline (north → south); land is east of it */
export const ELLIOTT_SHORE = [[47.6440, -122.4100], [47.6380, -122.4000], [47.6330, -122.3880], [47.6290, -122.3790], [47.6240, -122.3690], [47.6200, -122.3600], [47.6165, -122.3545], [47.6125, -122.3470], [47.6090, -122.3432], [47.6060, -122.3410], [47.6030, -122.3385], [47.6000, -122.3370], [47.5960, -122.3375], [47.5920, -122.3395], [47.5860, -122.3440], [47.5800, -122.3500], [47.5700, -122.3600]];
/** Lake Union (clockwise from the Fremont Cut), approximate shoreline incl. the Gas Works point */
export const LAKE_UNION = [[47.6487, -122.3492], [47.6478, -122.3440], [47.6466, -122.3398], [47.6452, -122.3372], [47.6440, -122.3345], [47.6446, -122.3318], [47.6462, -122.3300], [47.6478, -122.3268], [47.6488, -122.3225], [47.6455, -122.3238], [47.6400, -122.3255], [47.6345, -122.3268], [47.6300, -122.3290], [47.6275, -122.3325], [47.6266, -122.3370], [47.6290, -122.3405], [47.6340, -122.3432], [47.6400, -122.3450], [47.6450, -122.3470], [47.6480, -122.3500]];
/** Salmon Bay / Lake Washington Ship Canal is not needed by the downtown views. */

const DEG = Math.PI / 180;
const shoreLonAt = (la) => {
    const S = ELLIOTT_SHORE;
    if (la >= S[0][0]) return S[0][1];
    for (let i = 1; i < S.length; i++) { const [a1, b1] = S[i - 1], [a2, b2] = S[i]; if (la <= a1 && la >= a2) return b1 + (b2 - b1) * (la - a1) / (a2 - a1); }
    return S[S.length - 1][1];
};
const LU_POLY = LAKE_UNION.map(([la, lo]) => [lo, la]);
export const inLakeUnion = (la, lo) => inPoly(lo, la, LU_POLY);
export const inElliott = (la, lo) => lo < shoreLonAt(la);
export const isWater = (la, lo) => inElliott(la, lo) || inLakeUnion(la, lo);
/** east distance (m) from the Elliott Bay seawall */
const shoreDist = (la, lo) => (lo - shoreLonAt(la)) * 75000;
const HILLS = [ // lat, lon, height m, sigma m, exponent (2 = Gaussian; 3 = flatter top, steeper sides)
    [47.6368, -122.3575, 145, 1050, 3],   // Queen Anne (Kerry Park terrace ≈ 100 m, top ≈ 140 m)
    [47.6255, -122.3165, 92, 900, 2],     // Capitol Hill
    [47.6075, -122.3215, 40, 520, 2],     // First Hill
    [47.5850, -122.3110, 88, 850, 2],     // Beacon Hill
    [47.6600, -122.3550, 70, 600, 2],     // Phinney Ridge
    [47.6620, -122.3340, 70, 550, 2],     // Wallingford
];
/** bare-earth ground in m NAVD88 (calibrated: Kerry Park 101, Needle base 40, Pike Place 29, Columbia 52, Pioneer Sq 12, waterfront 6, Gas Works ≈ 10) */
export function seaHeight(la, lo) {
    if (inLakeUnion(la, lo)) return 6.1 - 4;             // Lake Union surface 6.1 m (bed below)
    const sd = shoreDist(la, lo); if (sd < 0) return -6;
    const band = (1 - smooth(47.622, 47.632, la)) * smooth(47.5995, 47.6045, la);
    let h = 4 + 6 * (1 - band) + (26 * smooth(30, 230, sd) + 8 * smooth(300, 900, sd)) * band;
    for (const [a, b, H, s, e] of HILLS) { const dx = (lo - b) * 75000, dy = (la - a) * 111000, d = Math.hypot(dx, dy) / s; h += H * Math.exp(-(e === 2 ? d * d / 2 : Math.pow(d, e))); }
    // lake shores stay low (Gas Works point, Westlake, Eastlake)
    const lu = Math.hypot((lo + 122.336) * 75000, (la - 47.637) * 111000); if (lu < 1500) h = lerp(Math.min(h, 10), h, smooth(500, 1500, lu));
    return h;
}

// ============================================================================ façade shader
const STYLES = {
    // bay width m, floor height m, mullion frac (x), spandrel frac (y), glass colour, lit share, glass metalness, roughness, metal
    glass: { bay: 1.52, floor: 3.95, fx: 0.06, fy: 0.24, glass: '#22323f', lit: 0.36, gm: 0.35, rough: 0.6, metal: 0.25, night: 1.15 },
    dark: { bay: 1.52, floor: 3.95, fx: 0.05, fy: 0.22, glass: '#161c22', lit: 0.34, gm: 0.4, rough: 0.5, metal: 0.3, night: 1.1 },
    stone: { bay: 1.6, floor: 3.9, fx: 0.24, fy: 0.36, glass: '#262d33', lit: 0.4, gm: 0.45, rough: 0.82, metal: 0.02, night: 1.05 },
    brick: { bay: 2.1, floor: 3.7, fx: 0.3, fy: 0.42, glass: '#22282d', lit: 0.36, gm: 0.35, rough: 0.9, metal: 0, night: 0.95 },
    resi: { bay: 3.1, floor: 3.05, fx: 0.22, fy: 0.38, glass: '#2a3238', lit: 0.33, gm: 0.4, rough: 0.85, metal: 0.02, night: 0.9 },
    roof: null,
};
const FACADE = new Map();
/** shared façade material per style; vertex colour = wall colour */
export function facadeMaterial(style = 'glass') {
    if (FACADE.has(style)) return FACADE.get(style);
    const S = STYLES[style] || STYLES.glass;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: S.rough, metalness: S.metal, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 });
    m.name = 'sea-facade-' + style;
    m.userData.nightEmissive = S.night; m.userData.seaFacade = style; m.userData.shared = true;
    const U = { uWin: { value: new THREE.Vector4(S.bay, S.floor, S.fx, S.fy) }, uGlass: { value: new THREE.Color(S.glass) }, uLit: { value: new THREE.Vector2(S.lit, S.gm) } };
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSW;\nvarying vec3 vSN;')
            .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
            { vec4 sw = vec4(transformed, 1.0); vec3 sn = objectNormal;
            #ifdef USE_INSTANCING
              sw = instanceMatrix * sw; sn = mat3(instanceMatrix) * sn;
            #endif
              sw = modelMatrix * sw; vSW = sw.xyz; vSN = normalize(mat3(modelMatrix) * sn); }`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
            uniform vec4 uWin; uniform vec3 uGlass; uniform vec2 uLit; varying vec3 vSW; varying vec3 vSN;
            float sfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
            .replace('#include <color_fragment>', `#include <color_fragment>
            float sWall = 1.0 - smoothstep(0.35, 0.6, abs(vSN.y));
            vec2 sTg = normalize(vec2(-vSN.z, vSN.x) + vec2(1e-5));
            vec2 sUV = vec2(dot(vSW.xz, sTg) / uWin.x, vSW.y / uWin.y);
            vec2 sFw = fwidth(sUV);
            float sFar = smoothstep(0.22, 0.55, max(sFw.x, sFw.y));
            vec2 sF = fract(sUV), sC = floor(sUV);
            vec2 sAa = sFw * 1.2 + 0.002;
            float sWx = smoothstep(uWin.z - sAa.x, uWin.z + sAa.x, sF.x) * (1.0 - smoothstep(1.0 - uWin.z - sAa.x, 1.0 - uWin.z + sAa.x, sF.x));
            float sWy = smoothstep(uWin.w - sAa.y, uWin.w + sAa.y, sF.y) * (1.0 - smoothstep(0.97 - sAa.y, 0.97 + sAa.y, sF.y));
            float sCov = (1.0 - 2.0 * uWin.z) * (0.97 - uWin.w);
            float sWin = mix(sWx * sWy, sCov, sFar) * sWall;
            // lit rooms: blocks of 2–4 bays per floor (fine) / of floors (far)
            float sHf = sfHash(vec2(floor(sC.x / 3.0) + floor(vSW.x * 0.013) * 7.0, sC.y + floor(vSW.z * 0.011) * 5.0));
            float sHc = sfHash(vec2(floor(sC.x / 4.0) + floor(vSW.x * 0.011) * 3.0, sC.y + floor(vSW.z * 0.009) * 13.0));
            float sLitF = step(1.0 - uLit.x, sHf), sLitC = step(1.0 - uLit.x, sHc);
            float sLit = mix(sLitF * sWx * sWy, sLitC * sCov * 0.32, sFar) * sWall;
            vec3 sTint = mix(vec3(1.0, 0.78, 0.48), vec3(0.82, 0.90, 1.0), step(0.7, sfHash(sC + 3.7)));
            float sVar = 0.75 + 0.5 * sfHash(sC + 11.3);
            diffuseColor.rgb = mix(diffuseColor.rgb, uGlass * mix(sVar, 1.0, sFar), sWin);`)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.1, sWin);')
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, uLit.y, sWin);')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= sLit * sTint * mix(0.8, 1.15, sfHash(sC + 5.1));')
            // skyline towers keep more contrast than the haze floor gives far ground (clear PNW days: 30+ km visibility)
            .replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace('fogDensity * length', 'fogDensity * 0.4 * length'));
    };
    m.customProgramCacheKey = () => 'sea-facade-v1';
    FACADE.set(style, m);
    return m;
}

// ============================================================================ towers
/**
 * [name, lat, lon, height m, w, d, shape, style, colour, yaw°]  (yaw: +32° = the downtown street grid)
 * shapes: box | chamfer | round | twin | columbia | stepped | crown | smith | pedestal | taper | notch | spire
 * Heights to the roof (Wikipedia / Emporis); footprints estimated from OSM building outlines.
 */
export const TOWERS = [
    ['Columbia Center', 47.6045, -122.3306, 284, 52, 48, 'columbia', 'dark', '#2a2c30', 32],
    ['Rainier Square Tower', 47.6093, -122.3340, 259, 34, 42, 'taper', 'glass', '#8ea3b1', 32],
    ['1201 Third Avenue', 47.6076, -122.3369, 235, 40, 40, 'crown', 'stone', '#cbbfa9', 32],
    ['Two Union Square', 47.6110, -122.3322, 226, 40, 38, 'notch', 'glass', '#476574', 32],
    ['Seattle Municipal Tower', 47.6052, -122.3297, 220, 44, 36, 'stepped', 'dark', '#4a4234', 32],
    ['F5 Tower', 47.6067, -122.3314, 201, 34, 30, 'round', 'glass', '#7d97a7', 32],
    ['U.S. Bank Centre', 47.6101, -122.3352, 203, 38, 34, 'chamfer', 'glass', '#6a8090', 32],
    ['Safeco Plaza', 47.6060, -122.3333, 192, 40, 40, 'box', 'dark', '#2b2c2e', 32],
    ['Russell Investments Center', 47.6075, -122.3385, 181, 44, 34, 'box', 'glass', '#5a7a92', 32],
    ['Wells Fargo Center', 47.6053, -122.3351, 175, 38, 38, 'chamfer', 'stone', '#c2bcb1', 32],
    ['Fourth & Madison', 47.6049, -122.3321, 172, 34, 32, 'stepped', 'stone', '#cfc5b2', 32],
    ['1000 Second Avenue', 47.6046, -122.3361, 166, 34, 30, 'box', 'glass', '#6f8796', 32],
    ['Seattle Tower', 47.6077, -122.3339, 105, 26, 26, 'stepped', 'brick', '#8a5a3e', 32],
    ['Rainier Tower', 47.6089, -122.3350, 157, 32, 32, 'pedestal', 'stone', '#b7b2a6', 32],
    ['2+U', 47.6083, -122.3383, 148, 36, 30, 'box', 'glass', '#89a2b0', 32],
    ['Hyatt Regency', 47.6127, -122.3316, 150, 46, 26, 'box', 'glass', '#5e7584', 32],
    ['Westin Seattle (north)', 47.6139, -122.3383, 125, 30, 30, 'round', 'stone', '#d4cfc4', 0],
    ['Westin Seattle (south)', 47.6134, -122.3372, 118, 30, 30, 'round', 'stone', '#d4cfc4', 0],
    ['Park Place', 47.6113, -122.3355, 135, 32, 32, 'box', 'dark', '#3a3e44', 32],
    ['Washington Athletic Club', 47.6103, -122.3359, 85, 26, 26, 'box', 'brick', '#9a7a5c', 32],
    ['Amazon Day 1', 47.6163, -122.3394, 150, 40, 32, 'box', 'glass', '#6d8ca2', 32],
    ['Amazon Doppler', 47.6155, -122.3383, 140, 38, 32, 'box', 'glass', '#5f7f93', 32],
    ['Amazon re:Invent', 47.6176, -122.3383, 130, 36, 30, 'box', 'glass', '#7b93a4', 32],
    ['Insignia North', 47.6177, -122.3446, 125, 28, 28, 'box', 'glass', '#93a6b4', 32],
    ['Insignia South', 47.6169, -122.3455, 125, 28, 28, 'box', 'glass', '#93a6b4', 32],
    ['Nexus', 47.6174, -122.3360, 133, 30, 30, 'box', 'glass', '#a5b4bf', 32],
    ['Spire', 47.6175, -122.3398, 135, 28, 28, 'chamfer', 'glass', '#9fb1bf', 32],
    ['Kinects', 47.6164, -122.3418, 122, 28, 28, 'box', 'glass', '#7f95a5', 32],
    ['The Emerald', 47.6115, -122.3420, 135, 30, 28, 'round', 'glass', '#79a39a', 32],
    ['Escala', 47.6134, -122.3398, 100, 30, 26, 'box', 'resi', '#b8b1a4', 32],
    ['Cielo / 2nd & Pine', 47.6111, -122.3407, 135, 28, 28, 'box', 'glass', '#8199a9', 32],
    ['Premiere on Pine', 47.6140, -122.3330, 125, 30, 28, 'box', 'glass', '#7c8f9c', 32],
    ['Seattle Hilton / 1001 Fifth area', 47.6087, -122.3318, 145, 30, 30, 'box', 'glass', '#6f8392', 32],
    ['Smith Tower', 47.6019, -122.3318, 148, 20, 18, 'smith', 'stone', '#ece6d6', 32],
    ['Exchange Building', 47.6036, -122.3355, 80, 28, 28, 'stepped', 'stone', '#c7bfae', 32],
    ['Madison Centre', 47.6043, -122.3335, 160, 30, 34, 'notch', 'glass', '#7a95a6', 32],
    ['800 Fifth / Bank of America Fifth Ave', 47.6058, -122.3307, 165, 34, 34, 'box', 'stone', '#b0aa9e', 32],
    ['Pacific Tower / Amazon Tower area 1918 8th', 47.6165, -122.3374, 152, 34, 30, 'box', 'glass', '#9bb0bd', 32],
    ['Mirabella / SLU', 47.6234, -122.3390, 60, 50, 40, 'box', 'resi', '#c2b8a8', 0],
    ['1200 Stewart', 47.6191, -122.3330, 135, 28, 28, 'box', 'glass', '#8ca0ad', 32],
];

function shapePoly(shape, w, d) {
    const hw = w / 2, hd = d / 2;
    if (shape === 'round') { const out = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; out.push([Math.cos(a) * hw, Math.sin(a) * hd]); } return out; }
    if (shape === 'chamfer') { const c = Math.min(hw, hd) * 0.32; return [[-hw + c, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c], [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c]]; }
    if (shape === 'notch') { const n = Math.min(hw, hd) * 0.28; return [[-hw, -hd], [-n, -hd], [-n, -hd + n], [n, -hd + n], [n, -hd], [hw, -hd], [hw, hd], [n, hd], [n, hd - n], [-n, hd - n], [-n, hd], [-hw, hd]]; }
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
}
/** extruded polygon (local x, z) from y0 to y1 → geometry (walls + top cap) */
function prismGeo(poly, y0, y1) {
    const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    return g;
}
const scalePoly = (p, k, kz = k) => p.map(([x, z]) => [x * k, z * kz]);

/** one tower → pushes geometries into batch b (keys: 'f-<style>', 'roof') at x, y, z */
function addTower(b, t, x, y, z) {
    const [, , , H, w, d, shape, style, col, yawDeg] = t;
    const yaw = yawDeg * DEG, key = 'f-' + style, roof = '#5b6066';
    const put = (geo, k = key, c = col) => { b.add(geo, k, M(x, y, z, 0, yaw, 0), c); geo.dispose(); };
    const base = shapePoly(shape === 'twin' ? 'round' : shape, w, d);
    const sink = 6; // below ground so slopes never show the underside
    if(shape==='columbia'||shape==='smith'){
        // Skyline and close visitor models share source footprints, tier heights and roofs.
        const lm=LANDMARKS.find(l=>l.id===shape),model=buildLandmark(lm,{realScale:true});model.mesh.updateMatrixWorld(true);
        const dx=(lm.lon-t[2])*111320*Math.cos(lm.lat*DEG),dz=-(lm.lat-t[1])*111132;
        const translation=new THREE.Matrix4().makeTranslation(x+dx,y,z+dz);
        model.mesh.traverse(m=>{if(!m.isMesh)return;const matrix=translation.clone().multiply(m.matrixWorld);b.add(m.geometry,'roof',matrix,'#ffffff');m.geometry.dispose();});
        return;
    }
    if (shape === 'pedestal') { // Rainier Tower (1977): 11-storey tapered concrete pedestal under a 29-storey box
        const g = new THREE.CylinderGeometry(w * 0.72, w * 0.28, 37, 4, 1, false); g.rotateY(Math.PI / 4); g.translate(0, 18.5, 0); put(g, 'f-stone', '#c9c4b8');
        put(prismGeo(base, 37, H));
        put(prismGeo(scalePoly(base, 0.9), H, H + 2), 'roof', roof);
        return;
    }
    if (shape === 'taper') { // Rainier Square Tower: the base slopes back on one side (the "swoosh")
        const n = 8; for (let i = 0; i < n; i++) { const y0 = i * 9, y1 = (i + 1) * 9, k = 0.62 + 0.38 * (i + 1) / n; put(prismGeo(base.map(([px, pz]) => [px, pz < 0 ? pz * k : pz]), i ? y0 : -sink, y1)); }
        put(prismGeo(base, n * 9, H));
        put(prismGeo(scalePoly(base, 0.86), H, H + 6), key, col);
        return;
    }
    if (shape === 'stepped') {
        put(prismGeo(base, -sink, H * 0.62)); put(prismGeo(scalePoly(base, 0.84), H * 0.62, H * 0.86)); put(prismGeo(scalePoly(base, 0.66), H * 0.86, H));
        put(prismGeo(scalePoly(base, 0.5), H, H + 4), 'roof', roof);
        return;
    }
    if (shape === 'crown') { // 1201 Third: setbacks + the lattice "crown" (pyramid caps)
        put(prismGeo(base, -sink, H * 0.84)); put(prismGeo(scalePoly(base, 0.8), H * 0.84, H * 0.94));
        const p = new THREE.ConeGeometry(w * 0.48, H * 0.1, 4); p.rotateY(Math.PI / 4); p.translate(0, H * 0.94 + H * 0.05, 0); put(p, 'roof', '#8f8b84');
        return;
    }
    put(prismGeo(base, -sink, H));
    put(prismGeo(scalePoly(base, 0.7), H, H + 3.5), 'roof', roof);
}

function towerBatchBuild(b, name) {
    const ov = {}; for (const s of Object.keys(STYLES)) if (STYLES[s]) ov['f-' + s] = facadeMaterial(s);
    ov.roof = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const g = b.build(name, { castShadow: false, receiveShadow: false, matOverrides: ov });
    g.traverse((m) => { if (m.isMesh) m.frustumCulled = true; });
    return g;
}

/** place the towers (not within `clear` m of the origin) */
export function seaTowers(ctx, { clear = 300, list = TOWERS, skip = [], groundY = null } = {}) {
    const E = ctx.data.origin.elev, b = new GeoBatch(); let n = 0;
    for (const t of list) {
        if (skip.includes(t[0])) continue;
        const p = ctx.ll(t[1], t[2]); if (Math.hypot(p.x, p.z) < clear) continue;
        const y = groundY ? groundY(p.x, p.z, t) : seaHeight(t[1], t[2]) - E;
        addTower(b, t, p.x, y, p.z); n++;
    }
    const g = towerBatchBuild(b, 'sea-towers'); g.userData.count = n;
    // aircraft warning lights on the tallest roofs
    const beacons = new THREE.Group(); beacons.name = 'tower-beacons';
    const bb2 = new GeoBatch();
    for (const t of list) { if (t[3] < 180 || skip.includes(t[0])) continue; const p = ctx.ll(t[1], t[2]); if (Math.hypot(p.x, p.z) < clear) continue; bb2.sphere(p.x, seaHeight(t[1], t[2]) - E + t[3] + 4, p.z, 1.6, 1.6, 1.6, '#ff2a1a', 'glow', 6, 4); }
    beacons.add(bb2.build('beacons', { castShadow: false }));
    g.add(beacons);
    ctx.onUpdate((dt, s) => { beacons.visible = (s.nightK ?? 0) > 0.2 && Math.floor((s.t ?? 0) * 0.8) % 2 === 0; });
    return g;
}

/** inside the scene's own terrain (DEM grid + the terrain apron pad): there the scene ground wins */
function nearScene(ctx, x, z, pad = 420) { const T = ctx.data.terrain; return x > T.x0 - pad && x < T.x0 + (T.nx - 1) * T.d + pad && z > T.z0 - pad && z < T.z0 + (T.nz - 1) * T.d + pad; }
// ============================================================================ mid / low rise filler (instanced)
/**
 * blocks on land in `box` [lat0, lon0, lat1, lon1], heights by neighbourhood; skips water, `exclude` polys (scene
 * metres) and everything closer than `clear`. Downtown-core blocks are taller (mid-rise office), the rest flats.
 */
export function seaMidrise(ctx, { box = [47.596, -122.372, 47.640, -122.312], n = 1400, clear = 300, exclude = [], seed = 77, groundY = null, near = null } = {}) {
    const E = ctx.data.origin.elev, r = rng(seed), grp = new THREE.Group(); grp.name = 'sea-midrise';
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const kinds = { resi: [], stone: [], glass: [], brick: [] }, occ = new Map();
    const palR = ['#c9c1b2', '#b8b2a6', '#a7a196', '#d3cfc6', '#9aa3ab', '#b39b84', '#c4b39a', '#8f8a82', '#d8d0bf', '#a68f78'];
    const palO = ['#9aa7b2', '#7f8a92', '#bdb6a8', '#8c98a3', '#c9c0b0', '#6f7f8b'];
    for (let i = 0; i < n * 4 && Object.values(kinds).reduce((s, a) => s + a.length, 0) < n; i++) {
        const la = box[0] + r() * (box[2] - box[0]), lo = box[1] + r() * (box[3] - box[1]);
        if (isWater(la, lo) || shoreDist(la, lo) < 25) continue;
        const p = ctx.ll(la, lo), dd = Math.hypot(p.x, p.z); if (dd < clear) continue;
        if (exclude.some((poly) => inPoly(p.x, p.z, poly))) continue;
        if (near && !near(p.x, p.z, la, lo)) continue;
        // Seattle Center grounds / Needle base stay open
        if (Math.hypot((lo - NEEDLE_LL[1]) * 75000, (la - NEEDLE_LL[0]) * 111000) < 230) continue;
        const core = Math.exp(-((la - 47.608) ** 2 + ((lo + 122.335) * 0.67) ** 2) / 0.000016);
        const belltown = Math.exp(-((la - 47.6155) ** 2 + ((lo + 122.346) * 0.67) ** 2) / 0.00001);
        const slu = Math.exp(-((la - 47.6235) ** 2 + ((lo + 122.338) * 0.67) ** 2) / 0.000014);
        const office = core > 0.3 || (slu > 0.4 && r() < 0.6);
        const h = office ? 18 + r() * 40 + core * r() * 55 : 9 + r() * 12 + belltown * r() * 40 + slu * r() * 18;
        const w = office ? 26 + r() * 22 : 16 + r() * 24, d = office ? 24 + r() * 20 : 14 + r() * 22;
        const yaw = (la < 47.6215 && lo > -122.352 ? 32 : 0) * DEG + (r() < 0.08 ? (r() - 0.5) * 0.4 : 0);
        const y = groundY ? groundY(p.x, p.z) : (nearScene(ctx, p.x, p.z) ? Math.min(seaHeight(la, lo) - E, ctx.ground.heightAt(p.x, p.z) + 0.5) : seaHeight(la, lo) - E);
        // no two blocks in one another (round 6 note 26: overlapping random boxes read as a jumble of half-buried slabs)
        const R0 = Math.max(w, d) * 0.62, ci = Math.floor(p.x / 40), cj = Math.floor(p.z / 40);
        let hit = false; for (let a = -2; a <= 2 && !hit; a++) for (let b = -2; b <= 2 && !hit; b++) for (const o of occ.get((ci + a) + ',' + (cj + b)) || []) if (Math.hypot(o.x - p.x, o.z - p.z) < o.r + R0 + 4) { hit = true; break; }
        if (hit) continue;
        { const k = ci + ',' + cj; (occ.get(k) || occ.set(k, []).get(k)).push({ x: p.x, z: p.z, r: R0 }); }
        const style = office ? (r() < 0.55 ? 'glass' : 'stone') : (r() < 0.12 ? 'brick' : 'resi');
        kinds[style].push({ x: p.x, z: p.z, y, w, d, h, yaw, c: office ? palO[i % palO.length] : palR[i % palR.length] });
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    let total = 0;
    for (const [style, list] of Object.entries(kinds)) {
        if (!list.length) continue;
        const mat = facadeMaterial(style);
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((t, i) => { m4.compose(new THREE.Vector3(t.x, t.y - 4, t.z), q.setFromAxisAngle(up, t.yaw), new THREE.Vector3(t.w, t.h + 4, t.d)); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(t.c)); });
        im.name = 'sea-midrise-' + style; im.castShadow = false; im.receiveShadow = false; im.computeBoundingSphere(); grp.add(im); total += list.length;
    }
    // flat roofs read darker from above: a thin roof cap instanced in grey
    grp.userData.count = total;
    return grp;
}

// ============================================================================ far ground
/**
 * a ground mesh from seaHeight over `box` (scene metres) with a hole over the scene's own terrain (`hole`, dropped
 * below it); vertex colours: urban grey-green, darker street grid, parks greener; water areas sit below the water plane.
 */
export function cityGround(ctx, { box, hole = null, step = 24, holeDrop = 1.5, seed = 3, lakeY = null, simplify = 0, omitSubmerged = false } = {}) {
    const E = ctx.data.origin.elev, pr = ctx.data.projection, o = ctx.data.origin, r = rng(seed);
    const toLL = (x, z) => [o.lat - z / pr.mLat, o.lon + x / pr.mLon];
    const nx = Math.round((box.x1 - box.x0) / step), nz = Math.round((box.z1 - box.z0) / step);
    const pos = [], col = [], idx = [];
    const c = new THREE.Color();
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const x = box.x0 + i * (box.x1 - box.x0) / nx, z = box.z0 + j * (box.z1 - box.z0) / nz, [la, lo] = toLL(x, z);
        let y = seaHeight(la, lo) - E;
        if (lakeY !== null && inLakeUnion(la, lo)) y = lakeY;
        if (hole && x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1) y = nearScene(ctx, x, z) ? Math.min(y - holeDrop, ctx.ground.heightAt(x, z) - 1.0) : y - holeDrop; // just under the scene's own terrain
        pos.push(x, y, z);
        const water = isWater(la, lo), k = r();
        if (water) c.set('#2c3836'); else c.set(k < 0.45 ? '#4f5a47' : k < 0.75 ? '#5c5e56' : k < 0.9 ? '#46553c' : '#6a675e');
        col.push(c.r, c.g, c.b);
    }
    const at = (i, j) => j * (nx + 1) + i, height = (i, j) => pos[at(i, j) * 3 + 1];
    const oldHeight = (x, z) => {
        const i = Math.min(nx - 1, Math.floor(x)), j = Math.min(nz - 1, Math.floor(z)), u = x - i, v = z - j;
        return u + v <= 1 ? height(i, j) * (1 - u - v) + height(i + 1, j) * u + height(i, j + 1) * v
            : height(i + 1, j + 1) * (u + v - 1) + height(i, j + 1) * (1 - u) + height(i + 1, j) * (1 - v);
    };
    let submerged = 0, patches = 0, maxError = 0;
    const leaves = [];
    const covered = (i, j, w, h) => {
        if (!omitSubmerged) return false;
        // Keep every coastal cell. Only the seabed fully below opaque water is redundant.
        for (let z = j; z <= j + h; z += 0.5) for (let x = i; x <= i + w; x += 0.5) {
            const wx = box.x0 + x * (box.x1 - box.x0) / nx, wz = box.z0 + z * (box.z1 - box.z0) / nz, [la, lo] = toLL(wx, wz);
            const waterY = inLakeUnion(la, lo) ? 6.1 - E : inElliott(la, lo) ? 1 - E : -Infinity;
            if (oldHeight(x, z) >= waterY - 0.05) return false;
        }
        return true;
    };
    const patch = (i, j, w, h) => {
        if (covered(i, j, w, h)) { submerged += w * h * 2; return; }
        if (w === 1 && h === 1) { leaves.push({ i, j, w, h }); return; }
        if (simplify > 0 && w >= 2 && h >= 2) {
            // First test the four-corner fan against the original surface. Neighbour
            // corners are stitched at their original height in a second pass.
            // Final geometry is independently checked against the original surface.
            const cx = i + w / 2, cz = j + h / 2, cy = oldHeight(cx, cz), rim = [];
            rim.push([i, j], [i, j + h], [i + w, j + h], [i + w, j]);
            const candidates = rim.map((a, k) => [a, rim[(k + 1) % rim.length]]);
            let error = 0;
            for (let z = j; z <= j + h && error <= simplify; z += 0.5) for (let x = i; x <= i + w; x += 0.5) {
                for (const [a, b2] of candidates) {
                    const det = (a[0] - cx) * (b2[1] - cz) - (b2[0] - cx) * (a[1] - cz);
                    const u = ((x - cx) * (b2[1] - cz) - (b2[0] - cx) * (z - cz)) / det;
                    const v = ((a[0] - cx) * (z - cz) - (x - cx) * (a[1] - cz)) / det;
                    if (u < -1e-8 || v < -1e-8 || u + v > 1 + 1e-8) continue;
                    error = Math.max(error, Math.abs(cy * (1 - u - v) + height(...a) * u + height(...b2) * v - oldHeight(x, z))); break;
                }
                if (error > simplify) break;
            }
            if (error <= simplify) { leaves.push({ i, j, w, h, cx, cz, cy }); patches++; maxError = Math.max(maxError, error); return; }
        }
        const w0 = Math.floor(w / 2), h0 = Math.floor(h / 2);
        if (w0 && h0) { patch(i, j, w0, h0); patch(i + w0, j, w - w0, h0); patch(i, j + h0, w0, h - h0); patch(i + w0, j + h0, w - w0, h - h0); }
        else if (w0) { patch(i, j, w0, h); patch(i + w0, j, w - w0, h); }
        else { patch(i, j, w, h0); patch(i, j + h0, w, h - h0); }
    };
    if (simplify > 0 || omitSubmerged) {
        // Small fixed tiles bound build work; steep / irregular tiles naturally remain at full resolution.
        for (let j = 0; j < nz; j += 16) for (let i = 0; i < nx; i += 16) patch(i, j, Math.min(16, nx - i), Math.min(16, nz - j));
        // A corner shared by two different patch sizes appears in both boundaries.
        // This avoids cracks and retains the full original grid along unsimplified areas.
        const rows = new Map(), columns = new Map();
        const corner = (i, j) => { if (!rows.has(j)) rows.set(j, new Set()); rows.get(j).add(i); if (!columns.has(i)) columns.set(i, new Set()); columns.get(i).add(j); };
        for (const { i, j, w, h } of leaves) { corner(i, j); corner(i + w, j); corner(i, j + h); corner(i + w, j + h); }
        for (const { i, j, w, h, cx, cz, cy } of leaves) {
            if (cx === undefined) { const a = at(i, j), b2 = a + 1, cc = a + nx + 1, d = cc + 1; idx.push(a, cc, b2, b2, cc, d); continue; }
            const rim = [
                ...[...columns.get(i)].filter((z) => z >= j && z < j + h).sort((a, b) => a - b).map((z) => [i, z]),
                ...[...rows.get(j + h)].filter((x) => x >= i && x < i + w).sort((a, b) => a - b).map((x) => [x, j + h]),
                ...[...columns.get(i + w)].filter((z) => z > j && z <= j + h).sort((a, b) => b - a).map((z) => [i + w, z]),
                ...[...rows.get(j)].filter((x) => x > i && x <= i + w).sort((a, b) => b - a).map((x) => [x, j]),
            ];
            const cidx = pos.length / 3, wx = box.x0 + cx * (box.x1 - box.x0) / nx, wz = box.z0 + cz * (box.z1 - box.z0) / nz;
            pos.push(wx, cy, wz);
            const ci = at(Math.floor(cx), Math.floor(cz)) * 3; col.push(col[ci], col[ci + 1], col[ci + 2]);
            for (let k = 0; k < rim.length; k++) idx.push(cidx, at(...rim[k]), at(...rim[(k + 1) % rim.length]));
        }
    } else for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = at(i, j), b2 = a + 1, cc = a + nx + 1, d = cc + 1; idx.push(a, cc, b2, b2, cc, d); }
    if (simplify > 0 || omitSubmerged) {
        // The omitted seabed / patch interiors must not leave orphan vertices with
        // zero normals in the uploaded geometry (or in geometry-quality audits).
        const used = new Map(), p2 = [], c2 = [];
        for (let k = 0; k < idx.length; k++) { const old = idx[k]; if (!used.has(old)) { used.set(old, used.size); p2.push(...pos.slice(old * 3, old * 3 + 3)); c2.push(...col.slice(old * 3, old * 3 + 3)); } idx[k] = used.get(old); }
        pos.length = 0; col.length = 0;
        for (let k = 0; k < p2.length; k++) { pos.push(p2[k]); col.push(c2[k]); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    m.name = 'sea-city-ground';
    m.onBeforeCompile = (sh) => { // street grid (downtown grid 32°, elsewhere N–S) as darker lines + light pavement edges
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW;')
            .replace('#include <color_fragment>', `#include <color_fragment>
            { vec2 p = vCW.xz; float a = 0.5585; vec2 q = vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
              vec2 g1 = abs(fract(p / vec2(110.0, 92.0)) - 0.5) * vec2(110.0, 92.0);
              vec2 fw = fwidth(p) * 1.5 + 0.01; float l1 = 1.0 - smoothstep(5.5, 5.5 + fw.x * 3.0, min(g1.x, g1.y));
              float tt = 1.0 - smoothstep(0.0, 1.0, max(fw.x, fw.y) / 6.0);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.31, 0.32), l1 * 0.75 * tt); }`);
    };
    m.customProgramCacheKey = () => 'sea-cityground-v1';
    const mesh = new THREE.Mesh(g, m); mesh.name = 'ground-sea-city'; mesh.userData.noFloor = true; mesh.receiveShadow = false;
    if (simplify > 0 || omitSubmerged) mesh.userData.simplification = { originalTriangles: nx * nz * 2, triangles: idx.length / 3, submergedTriangles: submerged, patches, maxSampledError: maxError, tolerance: simplify };
    return mesh;
}

/** instanced street-tree crowns over land (season colour via vertex colour) */
export function cityTrees(ctx, { box, n = 3000, clear = 250, seed = 11, exclude = [], season = null } = {}) {
    const E = ctx.data.origin.elev, pr = ctx.data.projection, o = ctx.data.origin, r = rng(seed);
    const geo = new THREE.IcosahedronGeometry(1, 1); geo.translate(0, 0.6, 0); // (detail 1: round crowns, not hexagons from across the lake)
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95 }); mat.name = 'sea-city-trees';
    const im = new THREE.InstancedMesh(geo, mat, n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const mo = (season ?? new Date().getMonth()); const autumn = mo >= 9 && mo <= 10, winter = mo === 11 || mo <= 1;
    const pal = winter ? ['#5d5348', '#4b5a3c', '#605548', '#3f5a3a'] : autumn ? ['#8a5a2a', '#9b7a2c', '#4f6a35', '#3e5a33', '#a0522d'] : ['#3f6233', '#4a6e36', '#36552d', '#557a3b'];
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
        const x = box.x0 + r() * (box.x1 - box.x0), z = box.z0 + r() * (box.z1 - box.z0); if (Math.hypot(x, z) < clear) continue;
        const la = o.lat - z / pr.mLat, lo = o.lon + x / pr.mLon; if (isWater(la, lo) || shoreDist(la, lo) < 20) continue;
        if (exclude.some((p) => inPoly(x, z, p))) continue;
        const s = 3 + r() * 4.5;
        m4.compose(new THREE.Vector3(x, seaHeight(la, lo) - E + s * 0.7, z), q, new THREE.Vector3(s, s * 1.15, s)); im.setMatrixAt(k, m4); im.setColorAt(k, c.set(pal[k % pal.length])); k++;
    }
    im.count = k; im.name = 'sea-city-trees'; im.castShadow = false; im.computeBoundingSphere();
    return im;
}

// ============================================================================ water
let _waterNormals = null;
function waterNormals() {
    if (_waterNormals) return _waterNormals;
    const S = 256, c = canvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), r = rng(17);
    // sum of a few periodic waves → height → normals (tileable)
    const waves = []; for (let i = 0; i < 14; i++) waves.push([Math.floor(1 + r() * 7) * (r() < 0.5 ? -1 : 1), Math.floor(1 + r() * 7) * (r() < 0.5 ? -1 : 1), r() * 6.28, 0.3 + r() * 0.7]);
    const H = (u, v) => { let h = 0; for (const [a, b, ph, amp] of waves) h += Math.sin((a * u + b * v) * Math.PI * 2 / S + ph) * amp / Math.hypot(a, b); return h; };
    for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
        const dx = H(u + 1, v) - H(u - 1, v), dy = H(u, v + 1) - H(u, v - 1), n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize(), i = (v * S + u) * 4;
        img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    _waterNormals = canvasTexture(c, { repeat: true, srgb: false });
    return _waterNormals;
}
/**
 * water surface at y over `box` (scene metres) or a polygon list: dark green-grey, low roughness so it mirrors the
 * sky (scene.environment); two drifting normal layers. Not walkable (the scene sets ground.waterY / ctx.water).
 */
export function seaWater(ctx, y, { box = { x0: -12000, z0: -12000, x1: 12000, z1: 12000 }, poly = null, color = '#203540', name = 'sea-water', repeat = 90, rough = 0.22, opacity = 1 } = {}) {
    let g;
    if (poly) { g = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([px, pz]) => new THREE.Vector2(px, -pz)))); g.rotateX(-Math.PI / 2); }
    else { g = new THREE.PlaneGeometry(box.x1 - box.x0, box.z1 - box.z0, 1, 1); g.rotateX(-Math.PI / 2); g.translate((box.x0 + box.x1) / 2, 0, (box.z0 + box.z1) / 2); }
    worldUV(g, repeat);
    const m = waterMaterial(ctx, { color, rough, opacity, name });
    const mesh = new THREE.Mesh(g, m); mesh.position.y = y; mesh.name = 'water-' + name; mesh.userData.noFloor = true; mesh.receiveShadow = true; mesh.renderOrder = -5;
    return mesh;
}
/** world-space uv (metres / repeat) on a geometry already in its final x/z placement (for waterMaterial's ripples) */
export function worldUV(g, repeat = 90, m = null) {
    const P = g.attributes.position, uv = [], v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); if (m) v.applyMatrix4(m); uv.push(v.x / repeat, v.z / repeat); }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
}
/** the water material (two drifting normal layers, sky reflections; time driven by the scene) */
export function waterMaterial(ctx, { color = '#203540', rough = 0.22, opacity = 1, name = 'sea-water' } = {}) {
    const nm = waterNormals().clone(); nm.needsUpdate = true; nm.wrapS = nm.wrapT = THREE.RepeatWrapping;
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05, normalMap: nm, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.0, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    m.name = name; m.userData.water = true;
    const U = { uT: { value: 0 } };
    m.onBeforeCompile = (sh) => { // second, slower normal layer at another scale and direction
        sh.uniforms.uT = U.uT;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT;')
            .replace('#include <normal_fragment_maps>', `
            vec3 mapN = texture2D(normalMap, vNormalMapUv + vec2(uT * 0.011, uT * 0.006)).xyz * 2.0 - 1.0;
            vec3 mapN2 = texture2D(normalMap, vNormalMapUv * 0.37 + vec2(-uT * 0.004, uT * 0.009)).xyz * 2.0 - 1.0;
            mapN = normalize(vec3((mapN.xy + mapN2.xy) * normalScale, mapN.z * mapN2.z));
            normal = normalize(tbn * mapN);`);
    };
    m.customProgramCacheKey = () => 'sea-water-v1';
    ctx.onUpdate((dt, s) => { U.uT.value = s.t ?? (U.uT.value + dt); });
    return m;
}

// ============================================================================ ships, cranes, bay lights
/** Washington State Ferries Jumbo Mark II (≈ 140 m × 27 m): white superstructure, green trim, two wheelhouses */
export function ferry() {
    const b = new GeoBatch(), W = '#f2f3f0', G = '#1f6a3c', D = '#26313a';
    b.box(0, -2, 0, 26, 5.5, 140, W, 'paint'); b.box(0, -2.2, 0, 26.3, 1.4, 140.3, G, 'paint');
    b.box(0, 3.5, 0, 23, 3.2, 112, W, 'paint'); b.box(0, 4.3, 0, 23.15, 1.3, 106, D, 'darkglass');
    b.box(0, 6.7, 0, 20, 3.2, 80, W, 'paint'); b.box(0, 7.5, 0, 20.15, 1.3, 76, D, 'darkglass');
    for (const s of [-1, 1]) { b.box(0, 9.9, s * 30, 10, 2.8, 6, W, 'paint'); b.box(0, 10.6, s * 30, 10.15, 1.1, 6.15, D, 'darkglass'); }
    b.box(0, 9.9, 0, 4, 7, 7, W, 'paint'); b.box(0, 16.9, 0, 4.1, 1.2, 7.1, G, 'paint');
    const g = b.build('wsf-ferry', { castShadow: false });
    // night: deck lights
    const lb = new GeoBatch(); for (let i = -6; i <= 6; i++) for (const s of [-1, 1]) lb.box(s * 11.7, 4.0, i * 8.2, 0.3, 0.6, 3.5, '#ffe2a8', 'glow');
    const lights = lb.build('ferry-lights', { castShadow: false }); lights.visible = false; g.add(lights); g.userData.lights = lights;
    return g;
}
/** container crane (≈ 75 m to the A-frame top, boom up or down) in Port of Seattle orange-red */
export function crane(boomUp = false) {
    const b = new GeoBatch(), C = '#c4472c', K = '#2b2b2b';
    for (const sx of [-9, 9]) for (const sz of [-8, 8]) b.box(sx, 0, sz, 1.6, 46, 1.6, C, 'paint');
    for (const sz of [-8, 8]) { b.box(0, 44, sz, 20, 2.2, 1.6, C, 'paint'); b.box(0, 22, sz, 20, 1.2, 1.2, C, 'paint'); }
    b.box(0, 46, -6, 4, 2.4, 64, C, 'paint');             // girder + boom (landward part)
    if (boomUp) { b.add(new THREE.BoxGeometry(3, 2.2, 52), 'paint', M(0, 66, 28, -1.05, 0, 0), C); } else b.box(0, 46, 50, 3.4, 2.2, 52, C, 'paint');
    b.box(0, 48.4, -2, 9, 6, 10, '#d9d6cf', 'paint');      // machinery house
    for (const sx of [-1, 1]) b.rod([sx * 2, 48, -10], [0, 74, 0], 0.5, C, 'paint', 6);
    b.rod([0, 74, 0], [0, 48, boomUp ? 26 : 70], 0.25, K, 'steel', 4); b.rod([0, 74, 0], [0, 48, -36], 0.25, K, 'steel', 4);
    const g = b.build('crane', { castShadow: false });
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3020', toneMapped: false })); red.position.y = 75; g.add(red);
    return g;
}

// ============================================================================ Space Needle (1962)
/**
 * The Space Needle at 1:1 (y = base): 184.4 m; SkyLine level 30.5–36.6 m; restaurant / Loupe level 152.4 m with its
 * rotating glass floor; open-air observation deck 158.5 m (tilted glass barriers); roof halo; spire 181 m + mast.
 * No coplanar surfaces: the top house is ONE lathe profile; glass bands are recessed open cylinders; slabs never
 * share a plane with another face. Returns a Group with userData { night(k), elevators[], update(dt), levels }.
 */
export function seaNeedle({ detail = 1, cabs = true, visitorGlass = false } = {}) {
    const N = detail >= 1 ? 48 : 24, grp = new THREE.Group(); grp.name = 'space-needle';
    const white = new THREE.MeshStandardMaterial({ color: '#eef0ec', roughness: 0.5, metalness: 0.05, emissive: new THREE.Color('#fff4e2'), emissiveIntensity: 0 });
    white.userData.nightEmissive = 0.22; white.name = 'needle-white';
    const steel = new THREE.MeshStandardMaterial({ color: '#c9cdcf', roughness: 0.4, metalness: 0.6 }); steel.name = 'needle-steel';
    const glass = new THREE.MeshStandardMaterial({ color: '#33454f', roughness: 0.06, metalness: 0.75, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0, side: THREE.DoubleSide });
    // The hero is visited from inside. Backdrop needles retain their old distant
    // treatment; the visitor version must show the city through the real glazing.
    if (visitorGlass) { glass.color.set('#b8d5e0'); glass.metalness = 0.12; glass.transparent = true; glass.opacity = 0.18; glass.depthWrite = false; }
    // Clear visitor glazing transmits light; it is not a luminous panel or an
    // opaque shadow caster. Keep structural members casting their real shadows.
    glass.userData.nightEmissive = visitorGlass ? 0 : 0.55; glass.name = 'needle-glass';
    const barrier = new THREE.MeshStandardMaterial({ color: '#9fb6c2', roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }); barrier.name = 'needle-barrier'; barrier.forceSinglePass = true;
    const add = (geo, m, name) => { const me = new THREE.Mesh(geo, m); me.name = name; me.castShadow = detail >= 1 && !(visitorGlass && m.transparent); me.receiveShadow = detail >= 1; grp.add(me); return me; };
    const b = new GeoBatch();
    // ---- legs: three pairs; leg centre radius r(y) and pair half-gap d(y)
    const R = (y) => (y < 113 ? 5.2 + 12.6 * Math.pow(1 - y / 113, 1.55) : 5.2 + Math.pow((y - 113) / 31, 1.35) * 7.6);
    const D = (y) => (y < 113 ? 0.95 + 2.3 * Math.pow(1 - y / 113, 1.3) : 0.95 + (y - 113) / 31 * 1.9);
    const legTop = 144;
    for (let k = 0; k < 3; k++) {
        const a = k * 2 * Math.PI / 3 + Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
        for (const s of [-1, 1]) {
            const pts = []; for (let i = 0; i <= 24; i++) { const y = i / 24 * legTop, r = R(y), d = D(y) * s; pts.push([ca * r - sa * d, y, sa * r + ca * d]); }
            b.tube(pts, 0.78, '#eef0ec', 'paint', 10);
        }
        for (let y = 6; y < legTop - 2; y += 7.5) { const r = R(y), d = D(y); b.rod([ca * r - sa * d, y, sa * r + ca * d], [ca * r + sa * d, y + 3.2, sa * r - ca * d], 0.22, '#e4e6e2', 'paint', 5); b.rod([ca * r + sa * d, y, sa * r - ca * d], [ca * r - sa * d, y + 3.2, sa * r + ca * d], 0.22, '#e4e6e2', 'paint', 5); }
        // feet on the foundation
        b.box(ca * R(0), -0.5, sa * R(0), 7, 1.4, 7, '#c9c6bd', 'concrete', -a);
        // ties pair → core at the SkyLine level and the 200-ft ring
        for (const y of [30.5, 61, 92]) b.rod([ca * R(y), y, sa * R(y)], [ca * 4.2, y, sa * 4.2], 0.32, '#e8eae6', 'paint', 6);
    }
    // core (stairs + elevator shafts)
    b.cyl(0, 0, 0, 4.0, 141, '#dfe1dd', 'paint', 24);
    // elevator rails (between the leg pairs)
    for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + Math.PI / 6; for (const s of [-0.9, 0.9]) b.rod([Math.cos(a) * 4.5 - Math.sin(a) * s, 0, Math.sin(a) * 4.5 + Math.cos(a) * s], [Math.cos(a) * 4.5 - Math.sin(a) * s, 142, Math.sin(a) * 4.5 + Math.cos(a) * s], 0.12, '#bfc3c5', 'steel', 5); }
    // ---- SkyLine level (100 ft): slab, recessed glass band, roof slab
    b.cyl(0, 29.9, 0, 11.6, 0.7, '#eef0ec', 'paint', N);
    b.cyl(0, 36.6, 0, 11.6, 0.8, '#eef0ec', 'paint', N);
    b.cyl(0, 61, 0, 6.4, 1.2, '#eef0ec', 'paint', N);                      // the 200-ft ring
    // ---- underside radial beams (the "sunburst" seen from the plaza), just below the lathe soffit
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a); b.rod([c * 5.6, 139.4, s2 * 5.6], [c * 20.2, 150.9, s2 * 20.2], 0.32, '#f2f3ef', 'paint', 5); }
    // tilted glass barrier posts on the open deck + bench line
    for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a); b.rod([c * 21.0, 158.6, s2 * 21.0], [c * 21.5, 161.6, s2 * 21.5], 0.045, '#d0d4d6', 'steel', 4); }
    // Loupe floor rim seams + mullions on the glass bands
    for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a); b.rod([c * 20.45, 152.6, s2 * 20.45], [c * 20.45, 156.0, s2 * 20.45], 0.06, '#e6e8e4', 'paint', 4); b.rod([c * 17.25, 158.6, s2 * 17.25], [c * 17.25, 162.4, s2 * 17.25], 0.05, '#e6e8e4', 'paint', 4); }
    // spire + mast
    b.add(new THREE.CylinderGeometry(0.55, 3.2, 10.6, 12, 1, true), 'paint', M(0, 175.6, 0), '#eef0ec');
    b.rod([0, 180.8, 0], [0, 184.4, 0], 0.16, '#c9cdcf', 'steel', 6);
    const legs = b.build('needle-structure', { matOverrides: { paint: white, steel } });
    grp.add(legs);
    // ---- top house: one lathe (outer skin) from the soffit up to the spire base
    const prof = [[3.9, 138.2], [6.5, 141.2], [11.5, 145.6], [16.8, 149.2], [20.4, 151.6], [21.15, 152.25], [21.15, 152.55], // soffit → rim
        [20.3, 152.6], [20.3, 156.1],                                    // (recess for the Loupe glass band: hidden behind the glass)
        [21.2, 156.15], [21.2, 157.7], [21.9, 158.2], [21.9, 158.45],    // white band + deck slab edge
        [17.0, 158.45], [17.0, 162.4],                                   // deck floor in to the indoor glass wall (recess)
        [22.45, 162.8], [22.45, 163.5],                                  // the roof halo (eave)
        [19.2, 165.6], [13.0, 168.1], [7.2, 169.8], [3.3, 170.6], [3.2, 170.61]];
    const lathe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), N);
    if (visitorGlass) {
        // These two profile strips were opaque cylinders directly behind the window
        // bands. They are duplicate fill, not real walls in the glazed visitor rings.
        const p = lathe.attributes.position, keep = [], indices = lathe.index.array;
        for (let i = 0; i < indices.length; i += 3) {
            const tri = [indices[i], indices[i + 1], indices[i + 2]], ys = tri.map((k) => p.getY(k)), lo = Math.min(...ys), hi = Math.max(...ys);
            if (hi - lo > 1 && ((lo >= 152.59 && hi <= 156.11) || (lo >= 158.44 && hi <= 162.41))) continue;
            keep.push(...tri);
        }
        lathe.setIndex(keep);
    }
    add(lathe, white, 'needle-tophouse');
    // glass bands (recessed by 0.1 m behind the rims, never coplanar)
    const gb1 = new THREE.CylinderGeometry(20.42, 20.42, 3.45, N, 1, true); gb1.translate(0, 154.35, 0); add(gb1, glass, 'needle-loupe-glass');
    const gb2 = new THREE.CylinderGeometry(17.12, 17.12, 3.85, N, 1, true); gb2.translate(0, 160.45, 0); add(gb2, glass, 'needle-deck-glass');
    const core2 = new THREE.CylinderGeometry(14.75, 14.75, 3.4, N, 1, true); core2.translate(0, 154.3, 0); add(core2, white, 'needle-loupe-core'); // the Loupe's inner wall (kitchen / lifts core)
    const gb3 = new THREE.CylinderGeometry(11.75, 11.75, 5.9, N, 1, true); gb3.translate(0, 33.6, 0); add(gb3, glass, 'needle-skyline-glass');
    // open-deck barrier glass (tilted outward) — transparent, double-sided
    const bar = new THREE.CylinderGeometry(21.5, 21.0, 3.0, N, 1, true); bar.translate(0, 160.1, 0); add(bar, barrier, 'needle-deck-barrier');
    // the Loupe's rotating glass floor (seen from inside / from right below) and the deck walking surface
    const floorMat = new THREE.MeshStandardMaterial({ color: '#8fa7b4', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false }); floorMat.name = 'loupe-floor';
    const loupe = new THREE.Mesh(new THREE.RingGeometry(14.5, 20.2, N, 1), floorMat); loupe.rotation.x = -Math.PI / 2; loupe.position.y = 152.62; loupe.name = 'loupe-floor'; grp.add(loupe);
    const deckMat = new THREE.MeshStandardMaterial({ color: '#b9b8b2', roughness: 0.8 }); deckMat.name = 'needle-deck';
    const deck = new THREE.Mesh(new THREE.RingGeometry(17.1, 21.85, N, 1), deckMat); deck.rotation.x = -Math.PI / 2; deck.position.y = 158.5; deck.name = 'needle-deck-floor'; grp.add(deck);
    // ---- elevator cabs (gold-tinted glass, white frame), interior light at night
    const elevators = [];
    if (cabs) {
        const cabMat = new THREE.MeshStandardMaterial({ color: '#c99b3c', roughness: 0.25, metalness: 0.8, emissive: new THREE.Color('#ffd28a'), emissiveIntensity: 0 }); cabMat.userData.nightEmissive = 0.9; cabMat.name = 'needle-cab';
        const cabGlass = new THREE.MeshStandardMaterial({ color: '#d8b56a', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.55 }); cabGlass.name = 'needle-cab-glass';
        for (let k = 0; k < 3; k++) {
            const a = k * 2 * Math.PI / 3 + Math.PI / 6, cab = new THREE.Group(); cab.name = 'needle-elevator-' + k; // between the leg pairs (90° / 210° / 330°)
            const frame = new GeoBatch();
            frame.box(0, 0, 0, 3.0, 0.35, 2.4, '#c99b3c', 'metal'); frame.box(0, 3.1, 0, 3.0, 0.35, 2.4, '#c99b3c', 'metal');
            for (const [x, z] of [[-1.45, 1.15], [1.45, 1.15], [-1.45, -1.15], [1.45, -1.15]]) frame.box(x, 0, z, 0.12, 3.4, 0.12, '#f0efe9', 'paint');
            const fr = frame.build('cab-frame', { matOverrides: { metal: cabMat } }); cab.add(fr);
            const gl = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.75, 2.3), cabGlass); gl.position.y = 1.72; cab.add(gl);
            cab.position.set(Math.cos(a) * 5.7, 2 + k * 41, Math.sin(a) * 5.7); cab.rotation.y = -a + Math.PI / 2;
            grp.add(cab); elevators.push({ cab, a, y: 2 + k * 41, dir: k % 2 ? -1 : 1, hold: 0 });
        }
    }
    // night: halo floodlight ring, beacon, top light
    const ringM = new THREE.MeshBasicMaterial({ color: '#fff1d6', toneMapped: false });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(22.2, 0.18, 6, N * 2), ringM); halo.rotation.x = Math.PI / 2; halo.position.y = 162.75; halo.visible = false; halo.name = 'needle-halo-lights'; grp.add(halo);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false })); beacon.position.y = 184.6; grp.add(beacon);
    let nightK = 0, t = 0;
    grp.userData = {
        levels: { skyline: 30.5, loupe: 152.6, deck: 158.5, top: 184.4, deckR0: 17.2, deckR1: 21.0, loupeR0: 14.6, loupeR1: 20.1 },
        elevators, loupe, deck,
        night: (k) => { nightK = k; halo.visible = k > 0.3; },
        /** elevators run 158 m in ≈ 41 s (3.9 m/s), wait 20 s at each end; `ride` pins one cab for the activity */
        update(dt) {
            t += dt; beacon.visible = nightK < 0.2 || Math.floor(t * 0.7) % 2 === 0;
            for (const e of elevators) {
                if (e.pinned) { e.cab.position.y = e.y; continue; }
                if (e.hold > 0) { e.hold -= dt; continue; }
                e.y += e.dir * 3.9 * dt; if (e.y > 141) { e.y = 141; e.dir = -1; e.hold = 20; } else if (e.y < 0.6) { e.y = 0.6; e.dir = 1; e.hold = 20; }
                e.cab.position.y = e.y;
            }
        },
    };
    return grp;
}

// ============================================================================ Seattle Great Wheel (2012)
/**
 * 53.3 m to the top (175 ft), 42 fully enclosed gondolas (8 riders each), white trussed rim + cable spokes on a white
 * A-frame at the end of Pier 57, overhanging the bay ~12 m; LED light shows at night (≈ 500,000 LEDs).
 * yaw: the wheel plane's normal direction (rotation.y of the group). Returns { group, update(dt, nightK, t), hub,
 * radius, gondolaAt(i) → world-space pose, rotor }.
 */
export function seaWheel(x, y, z, yaw, { spin = true } = {}) {
    const grp = new THREE.Group(); grp.name = 'great-wheel'; grp.position.set(x, y, z); grp.rotation.y = yaw;
    const H = 53.3, R = 23.8, hub = H - R - 2.6, W = '#f3f5f6';
    const paint = new THREE.MeshStandardMaterial({ color: '#f3f5f6', roughness: 0.45, metalness: 0.15, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, vertexColors: true }); paint.userData.nightEmissive = 0.05;
    const b = new GeoBatch();
    // A-frame: two legs per side (z = ±) splayed along the plane, a back strut
    for (const sz of [-1, 1]) { for (const sx of [-1, 1]) b.rod([sx * 15, 0, sz * 6.5], [0, hub, sz * 2.6], 0.75, W, 'paint', 12, 0.55); b.rod([0, 0, sz * 14], [0, hub - 1, sz * 2.8], 0.55, W, 'paint', 10, 0.45); b.rod([-15, 0.5, sz * 6.5], [15, 0.5, sz * 6.5], 0.4, W, 'paint', 8); }
    b.rod([0, hub, -3.2], [0, hub, 3.2], 1.25, '#dfe3e6', 'steel', 16);
    b.box(0, -0.4, 0, 36, 0.8, 26, '#8f8b82', 'concrete');
    const fixed = b.build('wheel-frame', { matOverrides: { paint } });
    const rot = new THREE.Group(); rot.name = 'wheel-rotor'; rot.position.y = hub;
    const w = new GeoBatch();
    // trussed rim: two rings ± 1.3 m + an inner chord, zig-zag diagonals between them
    for (const sz of [-1.3, 1.3]) { const ring = new THREE.TorusGeometry(R, 0.32, 8, 168); w.add(ring, 'paint', M(0, 0, sz), W); ring.dispose(); const r2 = new THREE.TorusGeometry(R - 1.9, 0.22, 6, 168); w.add(r2, 'paint', M(0, 0, sz), W); r2.dispose(); }
    for (let i = 0; i < 84; i++) {
        const a0 = i / 84 * Math.PI * 2, a1 = (i + 0.5) / 84 * Math.PI * 2;
        for (const sz of [-1.3, 1.3]) w.rod([Math.cos(a0) * R, Math.sin(a0) * R, sz], [Math.cos(a1) * (R - 1.9), Math.sin(a1) * (R - 1.9), sz], 0.1, W, 'paint', 4);
        if (i % 2 === 0) w.rod([Math.cos(a0) * R, Math.sin(a0) * R, -1.3], [Math.cos(a0) * R, Math.sin(a0) * R, 1.3], 0.12, W, 'paint', 4);
    }
    for (let i = 0; i < 42; i++) { const a = i / 42 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); for (const sz of [-1, 1]) w.rod([0, 0, sz * 2.6], [c * (R - 1.9), s * (R - 1.9), sz * 1.3], 0.045, '#d8dcdf', 'steel', 4); }
    const rotor = w.build('wheel-rotor-geo', { matOverrides: { paint } }); rot.add(rotor);
    // LED strips on the rim (night shows) — per-vertex hue animated in the shader
    const led = new THREE.Group(); led.visible = false;
    const ledMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, vertexColors: true });
    const ledU = { uT: { value: 0 }, uMode: { value: 0 } };
    ledMat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, ledU);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uMode; varying vec3 vLp;\nvec3 hsv(float h){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return k; }')
            .replace('#include <color_fragment>', `#include <color_fragment>
            { float ang = atan(vLp.y, vLp.x); float rr = length(vLp.xy);
              vec3 c1 = hsv(fract(ang / 6.2832 + uT * 0.05));
              vec3 c2 = mix(vec3(0.2, 0.5, 1.0), vec3(1.0, 0.25, 0.6), 0.5 + 0.5 * sin(rr * 0.6 - uT * 3.0));
              vec3 c3 = vec3(1.0, 0.92, 0.75) * (0.6 + 0.4 * step(0.5, fract(ang * 6.684 + uT * 0.8)));
              diffuseColor.rgb = uMode < 0.5 ? c1 : (uMode < 1.5 ? c2 : c3); diffuseColor.rgb *= 1.6; }`);
    };
    ledMat.customProgramCacheKey = () => 'sea-wheel-led-v1';
    { const lb = new GeoBatch(); for (const sz of [-1.45, 1.45]) { const t1 = new THREE.TorusGeometry(R + 0.34, 0.09, 4, 336); lb.add(t1, 'glow', M(0, 0, sz), '#ffffff'); t1.dispose(); }
      for (let i = 0; i < 42; i += 1) { const a = i / 42 * Math.PI * 2; for (const sz of [-1, 1]) lb.rod([Math.cos(a) * 2.2, Math.sin(a) * 2.2, sz * 2.3], [Math.cos(a) * (R - 2), Math.sin(a) * (R - 2), sz * 1.35], 0.06, '#ffffff', 'glow', 3); }
      const lg = lb.build('wheel-led', { castShadow: false, matOverrides: { glow: ledMat } }); led.add(lg); }
    rot.add(led);
    // gondolas: enclosed cabins (white frame + glass) hanging below the rim, instanced, always upright
    const cab = new GeoBatch();
    cab.box(0, -1.25, 0, 2.3, 0.22, 2.0, '#e9ecee', 'paint'); cab.box(0, 1.15, 0, 2.3, 0.25, 2.0, '#e9ecee', 'paint');
    for (const [cx, cz] of [[-1.1, -0.95], [1.1, -0.95], [-1.1, 0.95], [1.1, 0.95]]) cab.box(cx, -1.2, cz, 0.12, 2.45, 0.12, '#e9ecee', 'paint');
    cab.rod([0, 1.3, 0], [0, 1.95, 0], 0.12, '#cfd4d8', 'steel', 6);
    const cabGeo = (() => { const gg = cab.build('g'); const geo = gg.children[0].geometry; return geo; })();
    const gondolas = new THREE.InstancedMesh(cabGeo, paint, 42); gondolas.frustumCulled = false; gondolas.castShadow = true;
    const glassM = new THREE.MeshStandardMaterial({ color: '#5d7c8c', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.55, emissive: new THREE.Color('#ffe7c0'), emissiveIntensity: 0 }); glassM.userData.nightEmissive = 0.35;
    const gGlass = new THREE.InstancedMesh(new THREE.BoxGeometry(2.18, 2.3, 1.88), glassM, 42); gGlass.frustumCulled = false;
    grp.add(fixed, rot, gondolas, gGlass);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(1e-4, 1e-4, 1e-4);
    let ang = 0, mode = 0, modeT = 0;
    const out = { group: grp, hub, radius: R, rotor: rot, angle: () => ang, speed: 1, hide: -1 }; // hide: the gondola you ride in (its interior is drawn by the scene)
    const cabCentre = (i, target = new THREE.Vector3()) => { const a = ang + i / 42 * Math.PI * 2; return target.set(Math.cos(a) * (R + 0.2), hub + Math.sin(a) * (R + 0.2) - 2.05, 0); };
    out.cabLocal = cabCentre;
    out.update = (dt, night = 0, t = 0) => {
        if (spin) ang += dt * out.speed * (Math.PI * 2 / 360); // one revolution ≈ 6 min when boarding (rides: 3 turns)
        rot.rotation.z = ang;
        for (let i = 0; i < 42; i++) { cabCentre(i, v); m4.compose(v, q, i === out.hide ? zero : one); gondolas.setMatrixAt(i, m4); gGlass.setMatrixAt(i, m4); }
        gondolas.instanceMatrix.needsUpdate = true; gGlass.instanceMatrix.needsUpdate = true;
        led.visible = night > 0.25; modeT += dt; if (modeT > 40) { modeT = 0; mode = (mode + 1) % 3; }
        ledU.uT.value = t; ledU.uMode.value = mode;
    };
    out.update(0);
    return out;
}

// ============================================================================ the whole city backdrop
/**
 * @param ctx SceneContext
 * @param o { needle?, towers?, midrise? (count), ground? ({box, hole}), trees?, bay?, lake?, ferries?, cranes?,
 *            rainier?, olympics?, clear?, eyeY?, exclude?[], midBox? }
 * → { group, needle, towers, water, mountainVisible }
 */
export function seaBackdrop(ctx, o = {}) {
    const E = ctx.data.origin.elev, grp = new THREE.Group(); grp.name = 'sea-backdrop';
    const out = { group: grp, mountainVisible: true };
    const clear = o.clear ?? 300;
    if (o.needle !== false) {
        const p = ctx.ll(NEEDLE_LL[0], NEEDLE_LL[1]);
        if (Math.hypot(p.x, p.z) > 250) { const n = seaNeedle({ detail: o.needleDetail ?? 0.5, cabs: true }); n.position.set(p.x, NEEDLE_LL[2] - E, p.z); n.traverse((m) => { if (m.isMesh) m.castShadow = false; }); grp.add(n); out.needle = n; ctx.onNight((k) => n.userData.night(k)); ctx.onUpdate((dt) => n.userData.update(dt)); }
    }
    if (o.towers !== false) { out.towers = seaTowers(ctx, { clear, skip: o.skipTowers || [] }); grp.add(out.towers); }
    if (o.midrise) grp.add(out.midrise = seaMidrise(ctx, { n: o.midrise, clear: o.midClear ?? clear, exclude: o.exclude || [], box: o.midBox, near: o.midNear }));
    if (o.ground) grp.add(out.ground = cityGround(ctx, o.ground));
    if (o.trees) grp.add(out.trees = cityTrees(ctx, { box: o.ground?.box || { x0: -3000, z0: -3000, x1: 3000, z1: 3000 }, n: o.trees, clear: o.treeClear ?? clear, exclude: o.exclude || [] }));
    if (o.bay !== false) { out.water = seaWater(ctx, (o.seaLevel ?? 1.0) - E, { name: 'elliott-bay' }); grp.add(out.water); }
    if (o.lake) { const poly = LAKE_UNION.map(([la, lo]) => { const p = ctx.ll(la, lo); return [p.x, p.z]; }); out.lake = seaWater(ctx, 6.1 - E, { poly, name: 'lake-union', color: '#22383f' }); grp.add(out.lake); }
    if (o.ferries !== false) {
        // Seattle (Colman Dock, Pier 52) ↔ Bainbridge (bearing ≈ 265°) and ↔ Bremerton
        const dock = ctx.ll(47.6025, -122.3405), bain = ctx.ll(47.6230, -122.5100), brem = ctx.ll(47.5900, -122.5000);
        const runs = [[dock, bain, 0], [bain, dock, 0.45], [dock, brem, 0.7]];
        out.ferries = runs.map(([a, b2, ph]) => { const f = ferry(); grp.add(f); return { f, a, b: b2, ph }; });
        const placeFerries = (s) => {
            const t = s.t ?? 0;
            for (const r of out.ferries) {
                const L = Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z), u = ((t * 9 / L + r.ph) % 1); const k = smooth(0, 1, Math.min(1, u * 1.15));
                r.f.position.set(lerp(r.a.x, r.b.x, k), (o.seaLevel ?? 1.0) - E + 1.6, lerp(r.a.z, r.b.z, k)); r.f.rotation.y = Math.atan2(r.b.x - r.a.x, r.b.z - r.a.z);
                r.f.userData.lights.visible = (s.nightK ?? 0) > 0.25;
            }
        };
        placeFerries({ t: 0, nightK: 0 }); ctx.onUpdate((dt, s) => placeFerries(s));
    }
    if (o.cranes !== false) { // Terminal 46 (2 cranes) + Terminal 18/Harbor Island (5)
        const cs = [[47.5925, -122.3418, 0.5, false], [47.5905, -122.3420, 0.5, true], [47.5795, -122.3540, 1.57, false], [47.5770, -122.3545, 1.57, true], [47.5745, -122.3548, 1.57, false], [47.5718, -122.3550, 1.57, false], [47.5690, -122.3552, 1.57, true]];
        for (const [la, lo, yaw, up] of cs) { const c = crane(up), p = ctx.ll(la, lo); c.position.set(p.x, 3 - E, p.z); c.rotation.y = yaw; grp.add(c); }
    }
    if(o.rainier!==false){const m=sourceMountain(ctx,'rainier',{distance:8000,eyeY:o.eyeY??1.6});grp.add(m);out.rainier=m;}
    if(o.olympics!==false)grp.add(sourceMountain(ctx,'olympics',{distance:7800,eyeY:o.eyeY??1.6}));
    ctx.add(grp);
    ctx.onNight((k) => grp.traverse((m) => { if (m.userData?.weatherMountain) m.material.color.setScalar(1 - 0.88 * k); }));
    ctx.onUpdate((dt, s) => {
        const w = s.r3d?.weather, vis = w ? Math.min(1, (w.visibilityM ?? 20000) / 25000) * (1 - Math.max(0, ((w.cloud ?? 0.3) - 0.6) / 0.4)) : 1;
        grp.traverse((m) => { if (m.userData?.weatherMountain) { m.visible = vis > 0.15; m.material.transparent = true; m.material.opacity = Math.min(1, vis * 1.3); } });
        out.mountainVisible = vis > 0.4;
    });
    return out;
}
const ACT_IDS = { 'lm-needle-up': 'elevator', 'lm-needle-loupe': 'loupe', 'lm-needle-360': 'deck', 'lm-great-wheel': 'great-wheel', 'lm-pike-fish': 'fish', 'lm-gum-wall': 'gum-wall', 'lm-pike-rachel': 'rachel', 'lm-troll-climb': 'climb', 'lm-gasworks-kite': 'kite', 'lm-locks-lockage': 'lockage', 'lm-kerry-blue-hour': 'blue-hour' };
/** the activities the spots-sea scenes ship (for spots/index.js ACTIVITIES, contract 01 *Activities*) */
export const SEA_ACTIVITIES = [
    { spot: 'space-needle', id: 'elevator', title: 'Ride the elevator up (41 s)' }, { spot: 'space-needle', id: 'loupe', title: 'Look down through The Loupe' },
    { spot: 'waterfront', id: 'great-wheel', title: 'Ride the Great Wheel' }, { spot: 'pike-place', id: 'fish', title: 'Catch a flying fish' }, { spot: 'pike-place', id: 'gum-wall', title: 'Add gum to the Gum Wall' },
    { spot: 'pike-place', id: 'rachel', title: 'Feed Rachel a coin' }, { spot: 'fremont-troll', id: 'climb', title: 'Climb the Troll' }, { spot: 'gas-works', id: 'kite', title: 'Fly a kite on Kite Hill' },
    { spot: 'ballard-locks', id: 'lockage', title: 'Run a lockage' }, { spot: 'kerry-park', id: 'blue-hour', title: 'Blue hour over Seattle' },
    { spot: 'chihuly', id: 'lm-chihuly-glasshouse', title: 'Under the Glasshouse' }, { spot: 'mopop', id: 'lm-mopop-monorail', title: 'Monorail through the guitar' },
    { spot: 'pioneer-square', id: 'lm-totem-read', title: 'Read the pole' }, { spot: 'pioneer-square', id: 'lm-underground', title: 'Below Seattle' },
];
/**
 * A landmark activity was completed (note 57; contract 01 *Activities*): `window.game.emit('activity', { spot, id })`
 * (or the `dmcv:activity` window event without a game), `host.onActivity` when given, toast, and
 * localStorage 'dmcv.spots.v1'.activities['<spot>:<id>'].
 */
export function seaActivity(s, lmId, spot, title = null, text = '') {
    const id = ACT_IDS[lmId] || lmId, key = spot + ':' + id;
    const A = s.progress.activities || (s.progress.activities = {}), first = !A[key]; A[key] = Date.now();
    try { localStorage.setItem('dmcv.spots.v1', JSON.stringify(s.progress)); } catch { /* private mode */ }
    if (title) s.ui?.toast?.(title, text);
    const detail = { spot, id, first };
    try { s.host?.onActivity?.(detail); } catch (e) { console.warn('[sea] onActivity', e); }
    try { if (window.game?.emit) window.game.emit('activity', { spot, id }); else window.dispatchEvent(new CustomEvent('dmcv:activity', { detail })); } catch { /* no window */ }
    return first;
}
/**
 * fake planar reflection for a calm lake: a y-mirrored copy (shared geometry / materials) of `objs` about the water
 * plane y = wy; the water must be partly transparent and the bed deep enough not to hide the mirrored copy.
 */
export function mirrorAbout(objs, wy, name = 'sea-reflection') {
    const m = new THREE.Group(); m.name = name; m.scale.set(1, -1, 1); m.position.y = 2 * wy;
    for (const o of objs) { if (!o) continue; const c = o.clone(true); c.traverse((q) => { q.castShadow = false; q.receiveShadow = false; }); m.add(c); }
    return m;
}
/**
 * Many small signboards in ONE draw call (+ one for the frames): all faces share a canvas atlas.
 * items: [{ text, w, h, x, y, z, yaw, bg, fg, font?, depth? }] (centre position, yaw = facing like signBoard rotation.y).
 * Night: the faces glow (userData.dayGlow / nightGlow, read by the spots night hook).
 */
export function signAtlas(items, { name = 'sign-atlas', ppm = 90, glow = 0.05, night = 1.0 } = {}) {
    const grp = new THREE.Group(); grp.name = name; if (!items.length) return grp;
    const W = 2048, rowsH = items.map((it) => Math.max(24, Math.round(it.h * ppm)));
    // shelf packing
    let x = 0, y = 0, rowH = 0; const rects = [];
    items.forEach((it, i) => { const w = Math.min(W, Math.max(32, Math.round(it.w * ppm))), h = rowsH[i]; if (x + w > W) { x = 0; y += rowH + 2; rowH = 0; } rects.push([x, y, w, h]); x += w + 2; rowH = Math.max(rowH, h); });
    const H = Math.min(4096, 1 << Math.ceil(Math.log2(y + rowH + 2)));
    const c = canvas(W, H), cx = c.getContext('2d');
    items.forEach((it, i) => { const [rx, ry, rw, rh] = rects[i]; cx.fillStyle = it.bg || '#1f3d2b'; cx.fillRect(rx, ry, rw, rh); fitDraw(cx, it.text, rx + rw * 0.04, ry + rh * 0.12, rw * 0.92, rh * 0.76, { font: it.font || ((q) => `700 ${q}px Georgia, serif`), color: it.fg || '#f2e9d0', maxLines: 1 }); });
    const tex = canvasTexture(c);
    const pos = [], uv = [], idx = []; const fb = new GeoBatch();
    items.forEach((it, i) => {
        const [rx, ry, rw, rh] = rects[i], co = Math.cos(it.yaw || 0), si = Math.sin(it.yaw || 0), d = (it.depth ?? 0.06) / 2 + 0.003;
        const P = (u, v) => [it.x + co * u + si * d, it.y + v, it.z - si * u + co * d];
        const base = pos.length / 3;
        for (const [u, v] of [[-it.w / 2, -it.h / 2], [it.w / 2, -it.h / 2], [it.w / 2, it.h / 2], [-it.w / 2, it.h / 2]]) pos.push(...P(u, v));
        const u0 = rx / W, u1 = (rx + rw) / W, v0 = 1 - (ry + rh) / H, v1 = 1 - ry / H;
        uv.push(u0, v0, u1, v0, u1, v1, u0, v1); idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        fb.box(it.x, it.y - it.h / 2, it.z, it.w + 0.04, it.h + 0.04, it.depth ?? 0.06, '#1d1f20', 'paint', it.yaw || 0);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: glow }); m.userData.dayGlow = glow; m.userData.nightGlow = night;
    const face = new THREE.Mesh(g, m); face.name = 'sign-atlas-faces'; grp.add(face, fb.build('sign-frames', { castShadow: false }));
    return grp;
}
export { clamp };
