// ============================================================================
//  Landmarks — Fountain water: the animated jets, spray and basin water of the Unirii fountains (shared materials, schedule, per-frame uniforms).
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { makeWaterMaterial } from '../water.js';

// Research (bucharest-unirii): 44 fountains along ~1.4 km (built late 1980s, reopened 2018 with light/music shows),
// grey granite / concrete rims, turquoise-tiled basin bottoms, jets 2-15 m; the round central plaza basin is
// "Fântâna lui Bucur". The 2026-11-08 OSM review retains 44 basin outlines (some fountains have two basins).
// Src: https://en.wikipedia.org/wiki/Piața_Unirii ; OSM natural=water / amenity=fountain ways ; game/research/bucharest-unirii.json (fountains_44)
// ---------------------------------------------------------------------------
//  Fountain water: translucent animated jets / spray crowns / foam rings and the basin water surface. Two shared
//  materials (one draw call each for the whole fountain field), animated in the shader by a time uniform; the CPU only
//  sets 3 uniforms once per frame (onBeforeRender of the meshes). Schedule (research bucharest-unirii.md "Fountains"):
//  running May-Oct 10:00-23:00 Bucharest time, basins drained Nov-Apr; "Simfonia Apei" show Fri-Sun 21:00-21:45
//  May-Sep with colour-cycling underwater LEDs; otherwise static white/blue underwater lights after sunset.
//  Night light: material.userData.nightEmissive (render.js eases emissiveIntensity at dusk). State source, in order:
//  FOUNTAIN_STATE.mode ('on'|'off'|'show'|null; URL ?fountains=on|off|show), FOUNTAIN_STATE.date, window.game.r3d /
//  window.spotDev.r3d .simDate, else now; render's season 'winter' (?season=winter) forces them off.
// ---------------------------------------------------------------------------
export const FOUNTAIN_STATE = { mode: null, date: null };
try { const q = new URLSearchParams(globalThis.location?.search || '').get('fountains'); if (['on', 'off', 'show'].includes(q)) FOUNTAIN_STATE.mode = q; } catch { /* no location */ }
const FU = { uTime: { value: 0 }, uOn: { value: 1 }, uShow: { value: 0 } };
let _fuFrame = -1, _fuCheck = -1e9;
const _bucFmt = (() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', month: 'numeric', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }); } catch { return null; } })();
export function fountainSchedule(date) {   // → { on, show } for a Date (Bucharest local time)
    let mo = date.getMonth() + 1, wd = date.getDay(), h = date.getHours() + date.getMinutes() / 60;
    if (_bucFmt) { const pp = Object.fromEntries(_bucFmt.formatToParts(date).map(x => [x.type, x.value])); mo = +pp.month; h = +pp.hour + +pp.minute / 60; wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(pp.weekday); }
    const season = mo >= 5 && mo <= 10, on = season && h >= 10 && h < 23;
    const show = on && mo <= 9 && (wd === 5 || wd === 6 || wd === 0) && h >= 21 && h < 21.75;
    return { on, show };
}
export function fountainTick(renderer) {
    const f = renderer?.info?.render?.frame ?? -2; if (f === _fuFrame) return; _fuFrame = f;
    const now = performance.now(); FU.uTime.value = (now / 1000) % 3600;
    if (now - _fuCheck < 1000) return; _fuCheck = now;
    const st = FOUNTAIN_STATE, r3d = globalThis.game?.r3d || globalThis.spotDev?.r3d;
    let on, show;
    if (st.mode) { on = st.mode !== 'off'; show = st.mode === 'show'; }
    else {
        ({ on, show } = fountainSchedule(st.date || r3d?.simDate || new Date()));
        if ((r3d?.weather?.season || r3d?._season?.season) === 'winter') on = show = false;
    }
    FU.uOn.value = on ? 1 : 0; FU.uShow.value = show ? 1 : 0;
    // basins (round 6 note 5): hold still, reflective water out of the jet season and are drained only in winter
    // (or ?fountains=off); running jets stir the surface; underwater lights only while the fountains run
    const mo = (st.date || r3d?.simDate || new Date()).getMonth() + 1;
    const drained = st.mode ? st.mode === 'off' : ((r3d?.weather?.season || r3d?._season?.season) === 'winter' || mo === 12 || mo <= 2);
    const W = FMATS?.water; if (W) {
        for (const m of FOUNTAIN_WATER) m.visible = !drained;
        const U = W.userData.waterU; U.uWRipple.value = on ? 2.4 : 0.5; U.uWWave.value = on ? 0.9 : 0.25;
        if (show) W.emissive.setHSL((FU.uTime.value * 0.12) % 1, 0.75, 0.45); else W.emissive.set(on ? '#2f86b0' : '#000000');
    }
}
export const FOUNTAIN_WATER = new Set();
let FMATS = null;
export function fountainMaterials() {
    if (FMATS) return FMATS;
    const head = 'uniform float uTime; uniform float uOn; uniform float uShow;\n';
    // jets: kind 0 = column, 1 = falling spray crown, 2 = foam ring (aJ = kind, seed, height)
    const jet = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, emissive: new THREE.Color('#bfe6ff'), emissiveIntensity: 0 });
    jet.name = 'landmark-fountain-jets'; jet.userData.nightEmissive = 1.4;
    jet.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, FU);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + head + 'attribute vec3 aJ; varying vec3 vJ; varying vec2 vU;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
vJ = aJ; vU = uv;
if (aJ.x < 1.5) transformed.y *= 1.0 + 0.05 * sin(uTime * 2.3 + aJ.y * 17.0) * uv.y;
if (uOn < 0.5) transformed *= 0.0;`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + head + 'varying vec3 vJ; varying vec2 vU;')
            .replace('#include <color_fragment>', `#include <color_fragment>
float k = vJ.x, sd = vJ.y, a = 0.0;
if (k < 0.5) {            // rising column: streaks moving up, thinning to the top
  float st = 0.5 + 0.5 * sin(vU.y * vJ.z * 2.2 - uTime * 9.0 + sd * 30.0 + sin(vU.x * 37.7 + sd) * 1.5);
  a = (0.32 + 0.4 * st) * smoothstep(1.0, 0.7, vU.y) * smoothstep(0.0, 0.06, vU.y);
} else if (k < 1.5) {     // spray crown: droplet curtains falling outward
  float fall = fract(vU.y * 2.5 - uTime * 1.3 + sd);
  float drops = smoothstep(0.35, 0.9, fract(vU.x * 48.0 + sd * 7.0 + fall * 0.6)) * 0.6 + 0.4;
  a = 0.5 * drops * (0.55 + 0.45 * fall) * smoothstep(1.0, 0.65, vU.y);
} else {                  // foam ring where the water falls back
  vec2 q = vU - 0.5; float d = length(q) * 2.0, an = atan(q.y, q.x);
  float fo = sin(an * 7.0 + d * 19.0 - uTime * 2.3 + sd * 9.0) * sin(an * 13.0 - d * 11.0 + uTime * 1.7) + 0.6 * sin(an * 3.0 + uTime * 0.9 + sd * 4.0);
  a = 0.8 * smoothstep(1.0, 0.45, d) * (0.45 + 0.35 * fo) + 0.35 * smoothstep(0.3, 0.0, d);
}
diffuseColor.a *= a * uOn;`)
            .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * 0.45 * (1.0 - min(length(emissive) * 0.7, 1.0));   // light scattered in the spray (daylight)\n#include <opaque_fragment>')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
vec3 hue = 0.55 + 0.45 * cos(6.2832 * (uTime * 0.12 + sd * 0.35 + vec3(0.0, 0.33, 0.67)));
totalEmissiveRadiance *= mix(vec3(0.75, 0.9, 1.0), hue * 1.3, uShow) * a * uOn;`);
    };
    jet.customProgramCacheKey = () => 'landmark-fountain-jets';
    // basin water surface: the shared reflective water (sky / façades in the Fresnel reflection, ripple normals),
    // shallow turquoise-tiled basins; drained (hidden) in winter, stirred while the jets run (fountainTick)
    const water = makeWaterMaterial({ deep: '#2a5c64', shallow: '#4c8f96', transparent: true, opacity: 0.9, ripple: 0.5, wave: 0.25, foam: 0, roughness: 0.05 });
    water.name = 'landmark-fountain-water'; water.emissive = new THREE.Color('#000000'); water.userData.nightEmissive = 0.35;
    FMATS = { jet, water };
    return FMATS;
}
