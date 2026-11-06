import * as THREE from '../vendor/three.module.min.js';

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
            fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 },
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms, transparent: true, depthWrite: false, fog: false,
            vertexShader: /* glsl */`
                attribute float aEnd; attribute float aSeed;
                uniform float uTime, uBox, uH, uStreak; uniform vec3 uCam, uVel;
                varying float vA;
                void main(){
                    vec3 p = position;
                    float fall = -uVel.y * (0.85 + aSeed * 0.3);
                    p.y = mod(p.y - uTime * fall, uH);
                    vec3 drift = vec3(uVel.x, 0.0, uVel.z) * (p.y / max(fall, 0.1));
                    vec3 w = vec3(mod(p.x - uCam.x - drift.x, uBox), p.y + uCam.y - uH * 0.35, mod(p.z - uCam.z - drift.z, uBox));
                    w.xz += uCam.xz - uBox * 0.5;
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
    /** camPos: world position; carVel: Vector3 world velocity of the player (m/s) */
    update(dt, camPos, carVel) {
        const u = this.uniforms;
        u.uTime.value += dt;
        u.uCam.value.copy(camPos);
        // rain velocity relative to the car (wind + falling - car motion)
        u.uVel.value.set(0.8 - (carVel ? carVel.x : 0), -9.5, 0.3 - (carVel ? carVel.z : 0));
    }
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
    { el: -14, zenith: '#02040b', horizon: '#080e1c', sun: '#000000', sunI: 0, hemiSky: '#2a3a5c', hemiGround: '#0a0c10', hemiI: 0.14, expo: 1.75, night: 1, cLit: '#141b29', cDark: '#070a10' },
    { el: -6, zenith: '#081127', horizon: '#252a45', sun: '#000000', sunI: 0, hemiSky: '#43517a', hemiGround: '#14141a', hemiI: 0.22, expo: 1.55, night: 0.75, cLit: '#2b2a3c', cDark: '#12131c' },
    { el: -1.5, zenith: '#16295a', horizon: '#c86a45', sun: '#ff6a2a', sunI: 0, hemiSky: '#6c76a0', hemiGround: '#3a2a26', hemiI: 0.36, expo: 1.3, night: 0.15, cLit: '#e08a64', cDark: '#3c3346' },
    { el: 2, zenith: '#22427f', horizon: '#f08a4b', sun: '#ff7f3a', sunI: 0.9, hemiSky: '#8a9cc8', hemiGround: '#6a4a36', hemiI: 0.5, expo: 1.18, night: 0, cLit: '#ffb07a', cDark: '#5a4a5e' },
    { el: 8, zenith: '#2c5aa2', horizon: '#f2c18e', sun: '#ffc27e', sunI: 1.9, hemiSky: '#9ec0f0', hemiGround: '#8a7050', hemiI: 0.7, expo: 1.06, night: 0, cLit: '#ffe4c4', cDark: '#8a8ea0' },
    { el: 25, zenith: '#2e6cc0', horizon: '#cfdeec', sun: '#fff0da', sunI: 2.8, hemiSky: '#a9cbff', hemiGround: '#8c7a62', hemiI: 0.85, expo: 1.0, night: 0, cLit: '#ffffff', cDark: '#a3adbb' },
    { el: 70, zenith: '#2a64b6', horizon: '#d6e4f1', sun: '#fff8ee', sunI: 3.1, hemiSky: '#a9cbff', hemiGround: '#8c7a62', hemiI: 0.9, expo: 0.98, night: 0, cLit: '#ffffff', cDark: '#a8b2bf' },
];
for (const k of KF) for (const key of ['zenith', 'horizon', 'sun', 'hemiSky', 'hemiGround', 'cLit', 'cDark']) k[key] = new THREE.Color(k[key]);
const _grey = new THREE.Color();
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
    // overcast: desaturate, dim the sun, lift the sky light
    const w = THREE.MathUtils.smoothstep(cover, 0.55, 1.0);
    if (w > 0) {
        for (const key of ['zenith', 'horizon', 'hemiSky', 'cLit', 'cDark']) greyed(s[key], w * 0.85);
        s.zenith.lerp(s.horizon, w * 0.6);
        s.sunI *= 1 - 0.6 * w; s.hemiI *= 1 + 0.25 * w; s.night *= 1 - 0.85 * w;
        greyed(s.sun, w * 0.5, 1.0);
    }
    s.overcast = w;
    return s;
}
