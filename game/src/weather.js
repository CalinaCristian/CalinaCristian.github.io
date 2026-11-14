import * as THREE from '../vendor/three.module.min.js';

// ---- precipitation shelters (2026-11-12): roofed interior volumes in which no rain streak / snow flake is drawn.
// The particle box wraps around the camera and knows nothing of roofs, so snow fell inside enterable rooms (the Carusel
// bookshop, the Old Town rooms, the Chihuly Glasshouse). A scene declares its interiors (spots/precip-shelter.js); each is
// an upright box { cx, cz, hx, hz, y0, y1, ux, uz } (centre, half sizes along the unit axis (ux, uz) and across it, levels).
// A list lasts SHELTER_TTL updates unless it is set again, so it cannot outlive the scene that declared it.
export const MAX_SHELTERS = 8;
const SHELTER_TTL = 3;
const SHELTER_GLSL = /* glsl */`
    uniform vec4 uShA[${MAX_SHELTERS}]; uniform vec4 uShB[${MAX_SHELTERS}]; uniform int uShN;
    bool sheltered(vec3 w){
        for (int i = 0; i < ${MAX_SHELTERS}; i++) {
            if (i >= uShN) break;
            vec4 a = uShA[i], b = uShB[i]; vec2 q = w.xz - a.xy;
            if (abs(q.x * b.z + q.y * b.w) < a.z && abs(q.y * b.z - q.x * b.w) < a.w && w.y > b.x && w.y < b.y) return true;
        }
        return false;
    }`;
const shelterUniforms = () => ({ uShA: { value: Array.from({ length: MAX_SHELTERS }, () => new THREE.Vector4()) }, uShB: { value: Array.from({ length: MAX_SHELTERS }, () => new THREE.Vector4(0, 0, 1, 0)) }, uShN: { value: 0 } });
function setShelters(fx, list) {
    const u = fx.uniforms, n = Math.min(MAX_SHELTERS, list?.length || 0);
    for (let i = 0; i < n; i++) { const s = list[i]; u.uShA.value[i].set(s.cx, s.cz, s.hx, s.hz); u.uShB.value[i].set(s.y0, s.y1, s.ux ?? 1, s.uz ?? 0); }
    u.uShN.value = n; fx._shelterTtl = n ? SHELTER_TTL : 0;
}
function ageShelters(fx) { if (fx._shelterTtl > 0 && --fx._shelterTtl === 0) fx.uniforms.uShN.value = 0; }

/**
 * GPU rain: N streaks in a box that wraps around the camera. All motion happens in the vertex
 * shader (no per-frame CPU work besides a few uniforms). Streak direction follows the rain's
 * velocity relative to the car, so streaks slant toward you when driving.
 */
export class Rain {
    constructor({ count = 4000, box = 44, height = 24, color = '#b9c4cf', opacity = 0.32 } = {}) {
        const pos = new Float32Array(count * 2 * 3), end = new Float32Array(count * 2), seed = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
            const x = Math.random() * box, y = Math.random() * height, z = Math.random() * box, s = Math.random();
            for (let k = 0; k < 2; k++) {
                pos.set([x, y, z], (i * 2 + k) * 3); end[i * 2 + k] = k; seed[i * 2 + k] = s;
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
        this.uniforms = {
            uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3(0.8, -9.5, 0.3) },
            uBox: { value: box }, uH: { value: height }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity },
            uStreak: { value: 0.045 },
            fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 }, ...shelterUniforms(),
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms, transparent: true, depthWrite: false, fog: false,
            vertexShader: /* glsl */`
                attribute float aEnd; attribute float aSeed;
                uniform float uTime, uBox, uH, uStreak; uniform vec3 uCam, uVel;
                varying float vA;${SHELTER_GLSL}
                void main(){
                    vec3 p = position;
                    float fall = -uVel.y * (0.85 + aSeed * 0.3);
                    p.y = mod(p.y - uTime * fall, uH);
                    vec3 drift = vec3(uVel.x, 0.0, uVel.z) * (p.y / max(fall, 0.1));
                    vec3 w = vec3(mod(p.x - uCam.x - drift.x, uBox), p.y + uCam.y - uH * 0.35, mod(p.z - uCam.z - drift.z, uBox));
                    w.xz += uCam.xz - uBox * 0.5;
                    if (sheltered(w)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; } // both ends of a streak test its head
                    w -= uVel * uStreak * aEnd * (0.8 + aSeed * 0.4);
                    vec4 mv = modelViewMatrix * vec4(w, 1.0);
                    gl_Position = projectionMatrix * mv;
                    float d = length(mv.xyz);
                    vA = (1.0 - aEnd * 0.6) * smoothstep(0.6, 2.5, d) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, d));
                }`,
            fragmentShader: /* glsl */`
                uniform vec3 uColor; uniform float uOpacity; varying float vA;
                void main(){ gl_FragColor = vec4(uColor, uOpacity * vA);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }`,
        });
        this.mesh = new THREE.LineSegments(g, mat);
        this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
        this.mesh.userData.shared = true;
    }
    /** camPos: world position; carVel: Vector3 world velocity of the player (m/s); wind: {x, z} m/s (optional) */
    update(dt, camPos, carVel, wind) {
        const u = this.uniforms;
        u.uTime.value += dt; ageShelters(this);
        u.uCam.value.copy(camPos);
        // rain velocity relative to the car (wind + falling - car motion)
        const wx = wind ? wind.x * 0.8 : 0.8, wz = wind ? wind.z * 0.8 : 0.3;
        u.uVel.value.set(wx - (carVel ? carVel.x : 0), -9.5, wz - (carVel ? carVel.z : 0));
    }
    /** intensity 0..1 → number of streaks drawn */
    setIntensity(k) { const n = this.mesh.geometry.attributes.position.count; this.mesh.geometry.setDrawRange(0, 2 * Math.round(n / 2 * THREE.MathUtils.clamp(k, 0, 1))); }
    /** roofed volumes without rain (see the note at the top); call every frame while they apply */
    setShelters(list) { setShelters(this, list); }
    dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

// ============================================================================
//  Time of day: solar position + sky/lighting keyframes
// ============================================================================
const RAD = Math.PI / 180;
/**
 * Low-precision solar position (≈0.5° accuracy, good for 1950–2050).
 * @param {number} ms  epoch milliseconds (absolute instant — time zone does not matter)
 * @returns {{elevation:number, azimuth:number}} degrees; azimuth from north, clockwise (90 = east)
 */
export function solarPosition(ms, lat, lon) {
    const d = ms / 86400000 - 10957.5; // days since J2000.0
    const g = (357.529 + 0.98560028 * d) * RAD;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
    const e = (23.439 - 0.00000036 * d) * RAD;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
    const H = (gmst * 15 + lon) * RAD - ra;
    const la = lat * RAD;
    const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(H));
    return { elevation: el / RAD, azimuth: ((az / RAD) % 360 + 360) % 360 };
}
/** world direction (x = east, y = up, z = south) from elevation/azimuth in degrees */
export function dirFromElAz(el, az, out = new THREE.Vector3()) {
    const e = el * RAD, a = az * RAD;
    return out.set(Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a));
}

// keyframes by sun elevation (degrees) for a clear sky
const KF = [
    // (round 6 note 44) night ambient lifted: streets / sidewalks went near-black between the lamp pools
    { el: -14, zenith: '#02040b', horizon: '#080e1c', sun: '#000000', sunI: 0, hemiSky: '#3a4a70', hemiGround: '#1c1a1c', hemiI: 0.3, expo: 1.3, night: 1, cLit: '#141b29', cDark: '#070a10' },
    { el: -6, zenith: '#081127', horizon: '#252a45', sun: '#000000', sunI: 0, hemiSky: '#4a5884', hemiGround: '#201e22', hemiI: 0.34, expo: 1.3, night: 0.75, cLit: '#2b2a3c', cDark: '#12131c' },
    { el: -1.5, zenith: '#16295a', horizon: '#c86a45', sun: '#ff6a2a', sunI: 0, hemiSky: '#6c76a0', hemiGround: '#3a2a26', hemiI: 0.36, expo: 1.3, night: 0.15, cLit: '#e08a64', cDark: '#3c3346' },
    { el: 2, zenith: '#22427f', horizon: '#f08a4b', sun: '#ff7f3a', sunI: 0.9, hemiSky: '#8a9cc8', hemiGround: '#6a4a36', hemiI: 0.58, expo: 1.18, night: 0, cLit: '#ffb07a', cDark: '#5a4a5e' },
    { el: 8, zenith: '#2c5aa2', horizon: '#f2c18e', sun: '#ffc27e', sunI: 1.9, hemiSky: '#9ec0f0', hemiGround: '#8a7050', hemiI: 0.8, expo: 1.08, night: 0, cLit: '#ffe4c4', cDark: '#8a8ea0' },
    { el: 25, zenith: '#2e6cc0', horizon: '#cfdeec', sun: '#fff0da', sunI: 2.8, hemiSky: '#a9cbff', hemiGround: '#8c7a62', hemiI: 0.85, expo: 1.0, night: 0, cLit: '#ffffff', cDark: '#a3adbb' },
    { el: 70, zenith: '#2a64b6', horizon: '#d6e4f1', sun: '#fff8ee', sunI: 3.1, hemiSky: '#a9cbff', hemiGround: '#8c7a62', hemiI: 0.9, expo: 0.98, night: 0, cLit: '#ffffff', cDark: '#a8b2bf' },
];
for (const k of KF) for (const key of ['zenith', 'horizon', 'sun', 'hemiSky', 'hemiGround', 'cLit', 'cDark']) k[key] = new THREE.Color(k[key]);
const _grey = new THREE.Color();
const GLOW = { h: new THREE.Color('#33281e'), z: new THREE.Color('#0b0d16'), c: new THREE.Color('#3a312b'), cd: new THREE.Color('#231c18') };
function greyed(c, amt, lum = 0.92) {
    const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
    _grey.setRGB(l * lum, l * lum * 1.01, l * lum * 1.04);
    return c.lerp(_grey, amt);
}
/**
 * Sky + lighting state for a sun elevation and cloud cover (0..1).
 * Returned colours are linear THREE.Colors (fresh objects).
 */
export function skyState(el, cover = 0.4) {
    let i = 0; while (i < KF.length - 2 && el > KF[i + 1].el) i++;
    const a = KF[i], b = KF[i + 1];
    const t = THREE.MathUtils.clamp((el - a.el) / (b.el - a.el), 0, 1);
    const s = {};
    for (const key of ['zenith', 'horizon', 'sun', 'hemiSky', 'hemiGround', 'cLit', 'cDark']) s[key] = a[key].clone().lerp(b[key], t);
    for (const key of ['sunI', 'hemiI', 'expo', 'night']) s[key] = a[key] + (b[key] - a[key]) * t;
    const night0 = s.night;
    // overcast: desaturate, dim the sun, lift the sky light
    const w = THREE.MathUtils.smoothstep(cover, 0.55, 1.0);
    if (w > 0) {
        for (const key of ['zenith', 'horizon', 'hemiSky', 'cLit', 'cDark']) greyed(s[key], w * 0.85);
        s.zenith.lerp(s.horizon, w * 0.6);
        s.sunI *= 1 - 0.6 * w; s.hemiI *= 1 + 0.25 * w; s.night *= 1 - 0.85 * w;
        greyed(s.sun, w * 0.5, 1.0);
    }
    s.overcast = w;
    // urban sky glow at night (street lighting scattered by the haze and the cloud base): warm horizon, lit clouds
    const ng = night0 * (0.3 + 0.7 * w); // clear nights: a thin glow on the horizon only
    if (ng > 0.01) {
        s.horizon.lerp(GLOW.h, 0.45 * ng); s.zenith.lerp(GLOW.z, 0.3 * ng);
        s.cLit.lerp(GLOW.c, (0.3 + 0.4 * w) * ng); s.cDark.lerp(GLOW.cd, (0.3 + 0.4 * w) * ng);
    }
    return s;
}

// ============================================================================
//  Snow: GPU flakes (THREE.Points) in a box that wraps around the camera. Slow fall, per-flake swirl, drifts with
//  the wind (world-anchored: driving through them does not drag them along). Like Rain, all motion is in the vertex shader.
// ============================================================================
export class Snow {
    constructor({ count = 6000, box = 46, height = 22, size = 0.06, opacity = 0.9 } = {}) {
        const pos = new Float32Array(count * 3), seed = new Float32Array(count);
        for (let i = 0; i < count; i++) { pos.set([Math.random() * box, Math.random() * height, Math.random() * box], i * 3); seed[i] = Math.random(); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
        this.count = count;
        this.uniforms = {
            uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3(0, -1.1, 0) },
            uBox: { value: box }, uH: { value: height }, uSize: { value: size }, uColor: { value: new THREE.Color('#f4f7fb') },
            uOpacity: { value: opacity }, uScale: { value: 400 }, ...shelterUniforms(),
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms, transparent: true, depthWrite: false, fog: false,
            vertexShader: /* glsl */`
                attribute float aSeed;
                uniform float uTime, uBox, uH, uSize, uScale; uniform vec3 uCam, uVel;
                varying float vA;${SHELTER_GLSL}
                void main(){
                    vec3 p = position;
                    float fall = -uVel.y * (0.7 + aSeed * 0.6);
                    p.y = mod(p.y - uTime * fall, uH);
                    float age = uTime * (0.6 + aSeed);
                    vec3 swirl = vec3(sin(age * 1.7 + aSeed * 40.0), 0.0, cos(age * 1.3 + aSeed * 23.0)) * 0.35;
                    vec3 drift = vec3(uVel.x, 0.0, uVel.z) * uTime * (0.8 + aSeed * 0.4); // wind only, carried over time: the flakes stay put in the world while the car moves (round 6 note 40)
                    vec3 w = vec3(mod(p.x - uCam.x - drift.x + swirl.x, uBox), p.y + uCam.y - uH * 0.35, mod(p.z - uCam.z - drift.z + swirl.z, uBox));
                    w.xz += uCam.xz - uBox * 0.5;
                    if (sheltered(w)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; vA = 0.0; return; }
                    vec4 mv = modelViewMatrix * vec4(w, 1.0);
                    gl_Position = projectionMatrix * mv;
                    float d = length(mv.xyz);
                    gl_PointSize = clamp(uSize * (0.6 + aSeed * 0.8) * uScale / max(d, 0.1), 1.0, 24.0);
                    vA = smoothstep(0.5, 2.0, d) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, d));
                }`,
            fragmentShader: /* glsl */`
                uniform vec3 uColor; uniform float uOpacity; varying float vA;
                void main(){
                    vec2 c = gl_PointCoord - 0.5; float r = dot(c, c);
                    if (r > 0.25) discard;
                    gl_FragColor = vec4(uColor, uOpacity * vA * (1.0 - r * 3.2));
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }`,
        });
        this.mesh = new THREE.Points(g, mat);
        this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
        this.mesh.userData.shared = true;
    }
    /** intensity 0..1 → number of flakes drawn */
    setIntensity(k) { this.mesh.geometry.setDrawRange(0, Math.round(this.count * THREE.MathUtils.clamp(k, 0, 1))); }
    update(dt, camPos, carVel, wind) {
        const u = this.uniforms;
        u.uTime.value += dt; ageShelters(this);
        u.uCam.value.copy(camPos);
        u.uVel.value.set(wind ? wind.x : 0, -1.1, wind ? wind.z : 0); void carVel; // (the car's own motion needs no term: the flakes are world-anchored)
    }
    /** roofed volumes without snow (see the note at the top); call every frame while they apply */
    setShelters(list) { setShelters(this, list); }
    dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

// ============================================================================
//  Weather: live (Open-Meteo), climatology fallback, overrides
// ============================================================================
/** WMO weather code → coarse kind + label + icon (Open-Meteo `weather_code`) */
export function classifyWMO(code, isDay = true) {
    const c = +code;
    const day = (a, n) => (isDay ? a : n);
    if (c === 0) return { kind: 'clear', label: 'Clear sky', icon: day('☀️', '🌙') };
    if (c === 1) return { kind: 'clear', label: 'Mainly clear', icon: day('🌤️', '🌙') };
    if (c === 2) return { kind: 'partly', label: 'Partly cloudy', icon: day('⛅', '☁️') };
    if (c === 3) return { kind: 'overcast', label: 'Overcast', icon: '☁️' };
    if (c === 45 || c === 48) return { kind: 'fog', label: c === 48 ? 'Rime fog' : 'Fog', icon: '🌫️' };
    if (c >= 51 && c <= 57) return { kind: 'drizzle', label: c >= 56 ? 'Freezing drizzle' : 'Drizzle', icon: '🌦️' };
    if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { kind: 'rain', label: c >= 80 ? 'Rain showers' : c >= 66 ? 'Freezing rain' : c === 65 ? 'Heavy rain' : c === 61 ? 'Light rain' : 'Rain', icon: '🌧️' };
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { kind: 'snow', label: c >= 85 ? 'Snow showers' : c === 77 ? 'Snow grains' : c === 75 ? 'Heavy snow' : c === 71 ? 'Light snow' : 'Snow', icon: '🌨️' };
    if (c >= 95) return { kind: 'storm', label: c > 95 ? 'Thunderstorm with hail' : 'Thunderstorm', icon: '⛈️' };
    return { kind: 'partly', label: 'Cloudy', icon: '☁️' };
}

const WX_URL = 'https://api.open-meteo.com/v1/forecast';
const WX_FIELDS = 'temperature_2m,weather_code,cloud_cover,precipitation,rain,showers,snowfall,snow_depth,wind_speed_10m,wind_direction_10m,visibility,is_day';
export const WEATHER_TTL_MS = 15 * 60 * 1000;
/**
 * Current weather from Open-Meteo (keyless, CORS *). Cached per location in sessionStorage for 15 min.
 * Throws on network failure, HTTP errors and the API's `{error:true, reason}` JSON (e.g. daily quota exceeded).
 * @returns normalised {code, tempC, precipMm, rainMm, snowfallCm, snowDepthCm, windKmh, windDir, visibilityM, cloud, isDay, time}
 */
export async function fetchLiveWeather(lat, lon, timeZone = 'auto', { timeoutMs = 8000, cache = true } = {}) {
    const key = `wx:${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (cache) {
        try {
            const c = JSON.parse(sessionStorage.getItem(key) || 'null');
            if (c && Date.now() - c.t < WEATHER_TTL_MS && c.w) return { ...c.w, cached: true };
        } catch { /* storage unavailable */ }
    }
    const url = `${WX_URL}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=${WX_FIELDS}&timezone=${encodeURIComponent(timeZone || 'auto')}`;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : 0;
    let j;
    try {
        const r = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
        j = await r.json().catch(() => null);
        if (!r.ok || !j || j.error) throw new Error(`open-meteo: ${j?.reason || r.status}`);
    } finally { if (to) clearTimeout(to); }
    const c = j.current || {};
    if (typeof c.weather_code !== 'number') throw new Error('open-meteo: no current weather');
    const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
    const w = {
        code: c.weather_code, tempC: num(c.temperature_2m, 15), precipMm: num(c.precipitation), rainMm: num(c.rain) + num(c.showers),
        snowfallCm: num(c.snowfall), snowDepthCm: num(c.snow_depth) * 100, windKmh: num(c.wind_speed_10m), windDir: num(c.wind_direction_10m),
        visibilityM: num(c.visibility, 24000), cloud: num(c.cloud_cover, 40) / 100, isDay: c.is_day !== 0, time: c.time || null,
    };
    if (cache) { try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), w })); } catch { /* ignore */ } }
    return w;
}

// Monthly climate normals (Jan..Dec). t = daily mean °C, wet = days with ≥ 1 mm precipitation, snow = days with
// snowfall, cover = days with snow on the ground, fog = fog days, thunder = thunderstorm days, cloud = mean cloud cover.
// Sources (1991–2020 normals, rounded): Bucharest-Băneasa — ANM / Wikipedia "Bucharest" climate box (temperature,
// precipitation days, snowy days, sunshine → cloud); Seattle-Tacoma Intl — NOAA NCEI / Wikipedia "Seattle" climate box.
// Cloud cover estimated from mean monthly sunshine (% of possible). Fog/thunder days: WMO station summaries (approx.).
export const CLIMATE = {
    bucharest: {
        lat: 44.43, lon: 26.10,
        t: [-0.6, 1.4, 5.8, 11.7, 17.2, 21.2, 23.3, 22.9, 17.6, 11.4, 5.9, 0.9],
        wet: [6, 6, 6, 7, 8, 8, 6, 5, 5, 5, 6, 7],
        snow: [7, 6, 3, 0.3, 0, 0, 0, 0, 0, 0.1, 2, 5],
        cover: [13, 10, 3, 0, 0, 0, 0, 0, 0, 0, 2, 8],
        fog: [5, 4, 2, 1, 0.5, 0.3, 0.2, 0.3, 1, 3, 5, 6],
        thunder: [0, 0, 0.2, 1, 4, 6, 6, 4, 2, 0.4, 0, 0],
        cloud: [0.72, 0.66, 0.6, 0.54, 0.48, 0.4, 0.3, 0.3, 0.38, 0.5, 0.68, 0.76],
        mm: [3.5, 3.5, 3.5, 4.5, 6, 8, 8, 6, 5, 4.5, 4, 3.5], // typical intensity on a wet hour (mm/h, scaled)
    },
    seattle: {
        lat: 47.61, lon: -122.33,
        t: [5.6, 6.1, 7.8, 10.2, 13.7, 16.4, 19.6, 19.8, 16.8, 11.9, 7.9, 5.3],
        wet: [18, 15, 17, 14, 10, 8, 4, 4, 7, 13, 18, 18],
        snow: [1.6, 1.4, 0.4, 0, 0, 0, 0, 0, 0, 0, 0.4, 1.3],
        cover: [2, 1.5, 0.3, 0, 0, 0, 0, 0, 0, 0, 0.3, 1.5],
        fog: [4, 3, 1.5, 0.8, 0.5, 0.5, 0.6, 1.2, 3, 5, 5, 5],
        thunder: [0.1, 0.1, 0.3, 0.4, 0.6, 0.6, 0.6, 0.6, 0.6, 0.3, 0.2, 0.1],
        cloud: [0.84, 0.8, 0.8, 0.74, 0.66, 0.6, 0.4, 0.44, 0.52, 0.72, 0.84, 0.86],
        mm: [2, 1.8, 1.8, 1.5, 1.4, 1.3, 1.2, 1.3, 1.5, 2, 2.5, 2.2],
    },
};
export function nearestClimate(lat, lon) {
    let best = null, bd = Infinity;
    for (const k in CLIMATE) { const c = CLIMATE[k], d = Math.hypot(c.lat - lat, (c.lon - lon) * Math.cos(lat * RAD)); if (d < bd) { bd = d; best = k; } }
    return { id: best, ...CLIMATE[best] };
}
function localParts(date, timeZone) {
    let y = date.getUTCFullYear(), m = date.getUTCMonth(), d = date.getUTCDate(), h = date.getUTCHours();
    try {
        const f = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date);
        const g = (t) => +f.find(p => p.type === t).value;
        y = g('year'); m = g('month') - 1; d = g('day'); h = g('hour') % 24;
    } catch { /* no Intl time zone: UTC */ }
    return { y, m, d, h };
}
const hash01 = (...a) => { let x = 2166136261; for (const v of a) { x ^= Math.floor(v * 1000) | 0; x = Math.imul(x, 16777619); x ^= x >>> 13; } return ((x >>> 0) % 100000) / 100000; };
/**
 * Plausible weather for a place and time from the climate normals (deterministic per hour; persistent per day /
 * 3-hour block). Same normalised shape as fetchLiveWeather.
 */
export function climateWeather(lat, lon, date, timeZone) {
    const C = nearestClimate(lat, lon), { y, m, d, h } = localParts(date, timeZone);
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const dayKey = [y, m, d, Math.round(lat), Math.round(lon)], blk = Math.floor(h / 3);
    const rDay = hash01(...dayKey, 1), rBlk = hash01(...dayKey, blk, 2), rHr = hash01(...dayKey, h, 3);
    const anomaly = (hash01(...dayKey, 4) - 0.5) * 6;
    const tempC = C.t[m] + anomaly + 4 * Math.cos((h - 15) / 24 * Math.PI * 2);
    const wetDay = rDay < C.wet[m] / dim;
    const thunderDay = hash01(...dayKey, 5) < C.thunder[m] / dim;
    const fogDay = hash01(...dayKey, 6) < C.fog[m] / dim;
    const snowCoverDay = hash01(...dayKey, 7) < C.cover[m] / dim;
    let code = 0, precipMm = 0, snowfallCm = 0, visibilityM = 24000;
    let cloud = THREE.MathUtils.clamp(C.cloud[m] + (rBlk - 0.5) * 0.5, 0, 1);
    if (thunderDay && h >= 14 && h <= 20 && rBlk < 0.6) { code = rHr < 0.2 ? 96 : 95; precipMm = C.mm[m] * (1 + rHr); cloud = 1; }
    else if (wetDay && rBlk < 0.55) {
        const snowy = tempC < 0.5 || (C.snow[m] > 0 && hash01(...dayKey, 8) < C.snow[m] / Math.max(C.wet[m], 1) && tempC < 3);
        const k = rHr; // 0 light … 1 heavy
        if (snowy) { code = k < 0.45 ? 71 : k < 0.85 ? 73 : 75; snowfallCm = 0.1 + k * 0.6; precipMm = snowfallCm / 0.7; }
        else if (k < 0.25) { code = 53; precipMm = 0.2 + k; }
        else { code = k < 0.6 ? 61 : k < 0.9 ? 63 : 65; precipMm = C.mm[m] * (0.15 + k * 0.6); }
        cloud = Math.max(cloud, 0.88);
        visibilityM = snowy ? 2500 + (1 - k) * 6000 : 8000 + (1 - k) * 12000;
    } else if (fogDay && h >= 3 && h <= 10) { code = 45; visibilityM = 250 + rBlk * 600; cloud = Math.max(cloud, 0.7); }
    else code = cloud < 0.2 ? 0 : cloud < 0.45 ? 1 : cloud < 0.75 ? 2 : 3;
    const snowDepthCm = snowCoverDay || (snowfallCm > 0 && tempC < 1) ? 2 + hash01(...dayKey, 9) * 12 : 0;
    const windKmh = 6 + hash01(...dayKey, blk, 10) * 18 + (code >= 95 ? 20 : precipMm > 0 ? 6 : 0);
    const windDir = (C.id === 'seattle' ? 200 : 300) + (hash01(...dayKey, 11) - 0.5) * 120;
    return { code, tempC: Math.round(tempC * 10) / 10, precipMm, rainMm: snowfallCm > 0 ? 0 : precipMm, snowfallCm, snowDepthCm, windKmh, windDir: (windDir + 360) % 360, visibilityM, cloud, isDay: null, time: null, climate: C.id };
}

/** synthetic weather for the menu / ?weather= overrides (same normalised shape) */
export const WEATHER_PRESETS = {
    clear: { code: 0, tempC: 22, precipMm: 0, snowfallCm: 0, snowDepthCm: 0, windKmh: 8, windDir: 270, visibilityM: 30000, cloud: 0.1 },
    cloudy: { code: 3, tempC: 14, precipMm: 0, snowfallCm: 0, snowDepthCm: 0, windKmh: 14, windDir: 250, visibilityM: 20000, cloud: 0.95 },
    rain: { code: 63, tempC: 11, precipMm: 3.5, snowfallCm: 0, snowDepthCm: 0, windKmh: 18, windDir: 240, visibilityM: 9000, cloud: 1 },
    drizzle: { code: 53, tempC: 9, precipMm: 0.4, snowfallCm: 0, snowDepthCm: 0, windKmh: 10, windDir: 240, visibilityM: 12000, cloud: 0.95 },
    snow: { code: 73, tempC: -2, precipMm: 0.8, snowfallCm: 0.6, snowDepthCm: 12, windKmh: 12, windDir: 330, visibilityM: 3000, cloud: 1 },
    fog: { code: 45, tempC: 4, precipMm: 0, snowfallCm: 0, snowDepthCm: 0, windKmh: 3, windDir: 90, visibilityM: 220, cloud: 0.85 },
    storm: { code: 95, tempC: 19, precipMm: 9, snowfallCm: 0, snowDepthCm: 0, windKmh: 38, windDir: 260, visibilityM: 5000, cloud: 1 },
};

/**
 * Meteorological visibility (m) for a weather state: the reported visibility, capped by what the sky type allows
 * (station / model values saturate at 24–50 km and miss urban haze). Clear 15–20 km, partly 12, overcast 6,
 * drizzle 4, rain 2–3.5, storm 2, snow 1–2.5, fog 0.15–0.8 km.
 */
function meteorologicalRange(w, kind = classifyWMO(w.code).kind) {
    const cloud = THREE.MathUtils.clamp(w.cloud ?? 0.4, 0, 1), p = w.precipMm || 0;
    const cap = { clear: 20000 - 5000 * cloud, partly: 12000, overcast: 6000, drizzle: 4000, rain: THREE.MathUtils.clamp(3500 - p * 250, 2000, 3500), storm: 2000, snow: THREE.MathUtils.clamp(2500 - (w.snowfallCm || 0) * 1500, 1000, 2500), fog: 800 }[kind] ?? 12000;
    return THREE.MathUtils.clamp(Math.min(w.visibilityM ?? 24000, cap), 150, 20000);
}

/**
 * Render targets for a weather state: cloud 0..1, rain 0..1, snow 0..1, fogDensity multiplier source (visibility),
 * wind (m/s toward x/z), thunder flag, sun dimming, snowCover 0..1 (ground dusting).
 */
export function weatherTargets(w) {
    const { kind } = classifyWMO(w.code);
    const t = { cloud: THREE.MathUtils.clamp(w.cloud ?? 0.4, 0, 1), rain: 0, snow: 0, thunder: kind === 'storm', visibilityM: w.visibilityM ?? 24000, windX: 0, windZ: 0, snowCover: 0, sunMul: 1 };
    if (kind === 'drizzle') t.rain = THREE.MathUtils.clamp(0.25 + (w.precipMm || 0) * 0.3, 0.25, 0.4);
    if (kind === 'rain' || kind === 'storm') t.rain = THREE.MathUtils.clamp(0.35 + (w.precipMm || 0) / 7, 0.35, 1);
    if (kind === 'snow') t.snow = THREE.MathUtils.clamp(0.3 + (w.snowfallCm || 0) * 1.2, 0.3, 1);
    if (kind === 'overcast' || t.rain || t.snow) t.cloud = Math.max(t.cloud, 0.9);
    if (kind === 'storm') { t.cloud = 1; t.sunMul = 0.55; }
    else if (t.rain) t.sunMul = 0.75;
    t.snowCover = THREE.MathUtils.clamp((w.snowDepthCm || 0) / 6, 0, 1);
    t.visibilityM = meteorologicalRange(w, kind);
    // wind: direction the wind comes FROM (meteorological, ° from north) → velocity toward (x east, z south)
    const ms = (w.windKmh || 0) / 3.6, to = ((w.windDir || 0) + 180) * RAD;
    t.windX = Math.sin(to) * ms; t.windZ = -Math.cos(to) * ms;
    return t;
}

// ============================================================================
//  Seasons: vegetation state by date + latitude (+ climate type)
// ============================================================================
const ramp = (x, a, b) => THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
/**
 * Vegetation look for a date at a latitude. Returns weights 0..1:
 *  blossom (spring flowering), autumn (leaf colour), bare (deciduous crowns leafless), brown (grass dormant / dry),
 *  fresh (light spring green) and the season name. maritime = mild winters / dry summers (Seattle).
 */
export function seasonState(date, lat = 45, { timeZone, maritime = false, override = null } = {}) {
    const { y, m, d } = localParts(date, timeZone);
    let doy = (Date.UTC(y, m, d) - Date.UTC(y, 0, 1)) / 864e5; // 0..365
    if (lat < 0) doy = (doy + 182.5) % 365;
    if (override) doy = { spring: 112, summer: 195, autumn: 306, winter: 20 }[override] ?? doy;
    // phenology (Bucharest-like continental; maritime shifts spring earlier and autumn slightly earlier)
    const sh = maritime ? -14 : 0, latSh = (Math.abs(lat) - 45) * 2.5; // ~2.5 days later per degree north in spring
    const leafOut0 = 85 + sh + latSh, leafOut1 = 118 + sh + latSh;          // ~26 Mar → 28 Apr
    const aut0 = (maritime ? 272 : 283) - latSh, aut1 = (maritime ? 305 : 315) - latSh; // colour: Oct → Nov
    const bare0 = (maritime ? 300 : 305) - latSh, bare1 = (maritime ? 330 : 335) - latSh;
    let bare = doy < leafOut1 ? 1 - ramp(doy, leafOut0, leafOut1) : ramp(doy, bare0, bare1);
    const autumn = doy >= aut0 ? ramp(doy, aut0, aut1) : 0;
    const blossom = Math.max(0, 1 - Math.abs(doy - (leafOut0 + 22)) / 18) * (1 - bare * 0.3);
    const fresh = doy > leafOut0 && doy < 165 ? Math.max(0, 1 - Math.abs(doy - (leafOut1 + 8)) / 40) : 0;
    let brown = maritime ? Math.max(0, 1 - Math.abs(doy - 225) / 45) * 0.6 + (doy < 60 || doy > 340 ? 0.15 : 0)
        : Math.max(doy < leafOut0 ? 0.75 * (1 - ramp(doy, leafOut0 - 20, leafOut0 + 10)) : 0, doy > bare0 ? 0.75 * ramp(doy, bare0, bare1 + 10) : 0, Math.max(0, 1 - Math.abs(doy - 225) / 30) * 0.3);
    const season = override || (doy < 59 || doy >= 334 ? 'winter' : doy < 151 ? 'spring' : doy < 243 ? 'summer' : 'autumn');
    return { season, blossom, autumn, bare, brown: Math.min(1, brown), fresh, doy };
}
