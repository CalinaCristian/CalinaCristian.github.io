import * as THREE from '../vendor/three.module.min.js';
import { addPreRenderHook, getVehicleEnvMap } from './vehicles.js';

// ============================================================================
//  CROWD — instanced pedestrians (cockpit-ui / vehicles role).
//  One merged ~1k-tri person (near) + a ~60-tri person (far), every part tagged with an id; per instance: pose
//  matrix, clothes / skin / hair / accessory colours, walk phase + amplitude, outfit flags. Walk cycle (legs + arms
//  swinging about hip / shoulder) in the vertex shader. Culled per render (frustum + distance) in the shared Scene
//  pre-render hook of vehicles.js, so a whole crowd = 2 draw calls (+ shadow pass for the near one).
//  Local frame: feet at y = 0, faces −z (like the vehicles), 1.75 m at scale 1.
// ============================================================================

// part ids (aPart): colour + visibility rule in the shader
const P = { SKIN: 0, TOP: 1, BOTTOM: 2, SHOES: 3, HAIR: 4, COAT: 5, HAT: 6, UMBRELLA: 7, BAG: 8, STRIPE: 9, HELMET: 10, POLE: 11, SLEEVE: 12, SKIRT: 13, PHONE: 14, CAMERA: 15, FLAGPOLE: 16, FLAGCLOTH: 17, GUITAR: 18, GUITARNECK: 19, SCREEN: 20, FACE: 21, MOUTH: 22, SCARF: 23, PAINT: 24, SELFIE: 25, SELFIESCR: 26 };
// limbs (aLimb): 0 none, 1/2 left/right thigh, 3/4 left/right upper arm, 5/6 left/right forearm (+ hand, hand-held props),
// 7/8 left/right shin (+ shoe). Joints (rest pose, arms hanging): hip (±0.095, 0.90), knee (±0.095, 0.50),
// shoulder (±0.235, 1.43), elbow (±0.245, 1.15).
const HIP_Y = 0.9, KNEE_Y = 0.5, SHOULDER_Y = 1.43, ELBOW_Y = 1.15;
export const CROWD_FLAGS = { coat: 1, umbrella: 2, hat: 4, bag: 8, worker: 16, shortSleeves: 32, phone: 64, camera: 128, flag: 256, guitar: 512, fan: 1024 };
/** idle poses (crowd.set(i, { pose })): shader-driven, 'walk' = the walk cycle (amp), others hold / loop on their own */
export const CROWD_POSES = { walk: 0, stand: 0, sit: 1, phone: 2, photo: 3, wave: 4, point: 5, flag: 6, talk: 7, guitar: 8, umbrella: 9, cheer: 10 };
/** hand-held props (crowd.set(i, { prop })) → flag bits */
const PROP_BITS = { phone: 64, camera: 128, flag: 256, guitar: 512 };
const PROP_MASK = 64 | 128 | 256 | 512;

class PBatch {
    constructor() { this.pos = []; this.nor = []; this.part = []; this.limb = []; this.idx = []; this.n = 0; }
    add(geo, m, part, limb = 0) {
        const g = geo.index ? geo : geo, pa = g.attributes.position, na = g.attributes.normal;
        const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
        for (let i = 0; i < pa.count; i++) {
            v.fromBufferAttribute(pa, i).applyMatrix4(m); this.pos.push(v.x, v.y, v.z);
            v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); this.nor.push(v.x, v.y, v.z);
            this.part.push(part); this.limb.push(limb);
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(g.index.getX(i) + this.n);
        else for (let i = 0; i < pa.count; i++) this.idx.push(i + this.n);
        this.n += pa.count; return this;
    }
    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
        g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 1));
        g.setAttribute('aLimb', new THREE.Float32BufferAttribute(this.limb, 1));
        g.setIndex(this.idx); g.computeBoundingSphere();
        return g;
    }
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const TM = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
/** tapered cylinder between y0 (radius r0) and y1 (r1), elliptical (depth factor dz) */
const taper = (r0, r1, y0, y1, seg = 8, dz = 1, open = false) => { const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1, open); g.translate(0, (y0 + y1) / 2, 0); g.scale(1, 1, dz); return g; };

let GEO = null;
function personGeometry() {
    if (GEO) return GEO;
    const b = new PBatch(), BOX = new THREE.BoxGeometry(1, 1, 1);
    for (const s of [-1, 1]) {
        const R = s > 0, x = s * 0.095;
        b.add(BOX, TM(x, 0.04, -0.03, 0.088, 0.08, 0.235), P.SHOES, R ? 8 : 7);                  // shoe (slimmer)
        b.add(taper(0.06, 0.075, 0.08, KNEE_Y + 0.02, 7, 1.05), TM(x, 0, 0), P.BOTTOM, R ? 8 : 7); // shin
        b.add(taper(0.074, 0.088, KNEE_Y - 0.02, HIP_Y + 0.02, 7, 1.05), TM(x, 0, 0), P.BOTTOM, R ? 2 : 1); // thigh
        b.add(taper(0.055, 0.058, ELBOW_Y - 0.02, SHOULDER_Y - 0.02, 6), TM(s * 0.24, 0, 0), P.SLEEVE, R ? 4 : 3); // upper arm
        b.add(taper(0.045, 0.053, 0.88, ELBOW_Y + 0.02, 6), TM(s * 0.245, 0, 0), P.SLEEVE, R ? 6 : 5);   // forearm
        b.add(BOX, TM(s * 0.245, 0.83, 0, 0.065, 0.11, 0.085), P.SKIN, R ? 6 : 5);                 // hand
    }
    b.add(taper(0.155, 0.158, HIP_Y - 0.07, HIP_Y + 0.08, 10, 0.64), TM(0, 0, 0), P.BOTTOM);       // pelvis (elliptical: the old box's corners poked out of coats as dark 'pockets' — after round 6)
    b.add(taper(0.165, 0.2, 0.96, 1.46, 9, 0.62), TM(0, 0, 0), P.TOP);                         // torso
    b.add(BOX, TM(0, 1.425, 0, 0.42, 0.09, 0.185), P.TOP);                                     // shoulders
    b.add(BOX, TM(0, 1.43, 0, 0.455, 0.105, 0.215), P.COAT);                                   // coat shoulders (round 6 note 55: the shirt's shoulder plate poked out over the coat)
    b.add(taper(0.062, 0.054, 1.46, 1.57, 8), TM(0, 0, 0), P.SKIN);                             // neck (fuller: the old 5 cm stick read as a pin)
    const head = new THREE.SphereGeometry(0.105, 16, 12); b.add(head, TM(0, 1.645, -0.005, 0.9, 1.1, 1.0), P.SKIN);   // head (smoother)
    b.add(new THREE.SphereGeometry(0.06, 10, 6), TM(0, 1.585, -0.035, 1.25, 0.75, 1.0), P.SKIN);                       // jaw / chin
    for (const sx of [-1, 1]) b.add(new THREE.SphereGeometry(0.022, 6, 5), TM(sx * 0.094, 1.645, 0.0, 0.5, 1.1, 0.8), P.SKIN); // ears
    b.add(BOX, TM(0, 1.62, -0.1, 0.035, 0.05, 0.03), P.SKIN);                                  // nose
    for (const sx of [-1, 1]) {                                                                // face: eyes + brows (dark), mouth
        b.add(BOX, TM(sx * 0.036, 1.655, -0.1, 0.02, 0.014, 0.012), P.FACE);
        b.add(BOX, TM(sx * 0.037, 1.68, -0.097, 0.034, 0.007, 0.012, 0, 0, sx * 0.12), P.FACE);
    }
    b.add(BOX, TM(0, 1.597, -0.099, 0.04, 0.008, 0.012), P.MOUTH);
    b.add(taper(0.075, 0.072, 1.47, 1.53, 10, 1.1, false), TM(0, 0, 0), P.SCARF);                                       // fan scarf around the neck…
    for (const sx of [-1, 1]) b.add(BOX, TM(sx * 0.05, 1.33, -0.135, 0.07, 0.3, 0.012, 0.12, 0, 0), P.SCARF);           // …ends hanging down the front
    b.add(BOX, TM(-0.05, 1.63, -0.088, 0.045, 0.014, 0.01, 0, 0.5, 0), P.PAINT);                                          // face-paint stripe (tricolour)
    const cap = new THREE.SphereGeometry(0.112, 16, 7, 0, Math.PI * 2, 0, Math.PI * 0.55); b.add(cap, TM(0, 1.665, 0.012, 0.95, 1.05, 1.02), P.HAIR);
    // outfit pieces (hidden unless their flag is set)
    b.add(taper(0.215, 0.185, 0.5, 1.0, 9, 0.68, true), TM(0, 0, 0), P.SKIRT);                   // coat skirt to the knees (not when sitting)
    b.add(taper(0.21, 0.205, 0.98, 1.47, 9, 0.66), TM(0, 0, 0), P.COAT);                        // coat body (over the top)
    b.add(new THREE.SphereGeometry(0.118, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), TM(0, 1.672, 0.01, 1, 1.28, 1.02), P.HAT); // knit beanie: rounded crown…
    b.add(taper(0.123, 0.121, 1.655, 1.705, 12, 1.0, true), TM(0, 0, 0.01, 1, 1, 1.03), P.HAT);                                      // …folded brim
    b.add(BOX, TM(0, 1.2, 0.165, 0.28, 0.36, 0.13), P.BAG);                                    // backpack
    // umbrella held in the right hand in front of the chest (pose 'umbrella'): canopy rim ~1.9 m, apex ~2.15 m
    b.add(new THREE.ConeGeometry(0.5, 0.26, 10, 1, true), TM(0.074, 2.02, -0.25), P.UMBRELLA);
    b.add(taper(0.011, 0.011, 1.36, 2.12, 4), TM(0.074, 0, -0.25), P.POLE);   // the shaft runs through the fist (umbrella arm pose)
    for (const y of [1.12, 1.3]) b.add(taper(0.215, 0.212, y - 0.025, y + 0.025, 9, 0.66, true), TM(0, 0, 0), P.STRIPE); // hi-vis stripes
    b.add(new THREE.SphereGeometry(0.132, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), TM(0, 1.68, 0.0), P.HELMET);
    // hand-held props (right forearm; in the rest pose the hand hangs at (0.245, 0.83))
    b.add(BOX, TM(0.235, 0.80, -0.035, 0.012, 0.14, 0.07), P.PHONE, 6);                         // phone (screen faces the head when raised)
    b.add(BOX, TM(0.228, 0.80, -0.035, 0.002, 0.12, 0.058), P.SCREEN, 6);
    // (after round 6: "they hold the phone weird") phone photo: an upright phone at arm's length in front of the face,
    // screen toward the person (the arm-mounted phone showed edge-on, like a walkie-talkie)
    b.add(BOX, TM(0.21, 1.58, -0.66, 0.075, 0.15, 0.012, 0.12, 0, 0), P.SELFIE);
    b.add(BOX, TM(0.21, 1.58, -0.653, 0.066, 0.135, 0.002, 0.12, 0, 0), P.SELFIESCR);
    b.add(BOX, TM(0.17, 0.79, -0.06, 0.13, 0.085, 0.075), P.CAMERA, 6);                          // camera body
    b.add(taper(0.028, 0.028, -0.025, 0.025, 8), TM(0.17, 0.79, -0.11, 1, 1, 1, Math.PI / 2, 0, 0), P.CAMERA, 6); // lens
    b.add(taper(0.012, 0.012, -0.55, 0.9, 4), TM(0.245, 0, 0), P.FLAGPOLE, 6);                   // guide flag pole (points along the forearm)
    b.add(BOX, TM(0.245, -0.38, 0.17, 0.008, 0.3, 0.34), P.FLAGCLOTH, 6);                         // flag cloth near the tip
    // guitar (on the body, strap over the shoulder): body + neck to the left hand
    b.add(taper(0.17, 0.15, -0.045, 0.045, 10), TM(0.04, 1.02, -0.17, 1, 1, 1.25, Math.PI / 2, 0, 0.45), P.GUITAR);
    b.add(BOX, TM(-0.2, 1.2, -0.18, 0.5, 0.045, 0.03, 0, 0, 0.45), P.GUITARNECK);
    const near = b.build();
    // far LOD: legs, torso, head (+ coat / umbrella blocks)
    const f = new PBatch();
    for (const s of [-1, 1]) {
        f.add(BOX, TM(s * 0.095, 0.71, 0, 0.13, 0.42, 0.16), P.BOTTOM, s < 0 ? 1 : 2);
        f.add(BOX, TM(s * 0.095, 0.26, 0, 0.12, 0.5, 0.18), P.BOTTOM, s < 0 ? 7 : 8);
    }
    f.add(BOX, TM(0, 1.2, 0, 0.42, 0.52, 0.24), P.TOP);
    f.add(BOX, TM(0, 0.75, 0, 0.44, 0.5, 0.27), P.SKIRT);
    f.add(BOX, TM(0, 1.64, 0, 0.19, 0.24, 0.21), P.SKIN);
    f.add(BOX, TM(0, 1.75, 0.01, 0.2, 0.06, 0.22), P.HAIR);
    f.add(new THREE.ConeGeometry(0.5, 0.26, 6, 1, true), TM(0.074, 2.02, -0.25), P.UMBRELLA);
    f.add(BOX, TM(0.245, 0.17, 0, 0.02, 1.4, 0.02), P.FLAGPOLE, 6); f.add(BOX, TM(0.245, -0.38, 0.17, 0.01, 0.3, 0.34), P.FLAGCLOTH, 6);
    GEO = { near, far: f.build() };
    return GEO;
}

// ---------------------------------------------------------------------------
//  Material: MeshStandard + per-instance colours / anim / flags; skeleton-free poses in the vertex shader
// ---------------------------------------------------------------------------
let MAT = null, DEPTH = null;
const UTIME = { value: 0 };
const GLSL_HEAD = `
    attribute float aPart; attribute float aLimb; attribute vec4 aAnim;
    uniform float uCrowdTime;
    float flagOn(float flags, float bit) { return mod(floor(flags / bit), 2.0); }
    mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
    mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
    mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
    // joints: arm = (shoulder pitch [+ forward], shoulder roll [+ outward], elbow [+ forearm forward]); leg = (hip pitch, knee)
    float cIs(float p, float id) { return 1.0 - step(0.5, abs(p - id)); }
    void armJoints(float side, out float pitch, out float roll, out float elbow, out float yaw) {
        float pose = aAnim.w, fl = aAnim.z, t = uCrowdTime + aAnim.x * 0.37, sw = sin(aAnim.x) * aAnim.y, R = step(0.0, side);
        float umb = max(flagOn(fl, 2.0), cIs(pose, 9.0));
        float idle = 1.0 - min(1.0, aAnim.y * 4.0);
        pitch = -side * sw * 0.32 + idle * sin(t * 1.3 + side) * 0.035; roll = -0.03 * idle + 0.04; elbow = 0.16 + abs(sw) * 0.25 + idle * 0.06; yaw = 0.0; // relaxed: arms along the body, slight sway
        if (cIs(pose, 10.0) > 0.5) { pitch = 2.75 + sin(t * 6.0 + side) * 0.12; roll = 0.35; elbow = 0.25 + max(0.0, sin(t * 6.0)) * 0.3; }       // cheer: both arms up
        if (umb > 0.5 && R > 0.5) { pitch = 0.4; roll = 0.0; elbow = 2.1; yaw = 0.6; }                          // umbrella: fist at (0.074, 1.43, −0.25), on the shaft (round 6 note 48)
        if (cIs(pose, 1.0) > 0.5) { pitch = 0.55; roll = 0.0; elbow = 0.75; yaw = 0.15; }                       // sit: hands on the thighs
        if (cIs(pose, 2.0) > 0.5) { if (R > 0.5) { pitch = 0.3; roll = 0.0; elbow = 1.85; yaw = 0.55; } else { pitch = 0.2; roll = 0.0; elbow = 1.55; yaw = 0.5; } } // phone
        if (cIs(pose, 3.0) > 0.5) { if (flagOn(fl, 64.0) > 0.5 && flagOn(fl, 128.0) < 0.5) { if (R > 0.5) { pitch = 1.62; roll = 0.0; elbow = 0.3; yaw = 0.12; } } // phone photo: right arm out to the phone held in front of the face (note 50)
            else { pitch = 1.0; roll = 0.0; elbow = 2.0; yaw = 0.62; } }                                         // camera photo: both hands at the face
        if (cIs(pose, 4.0) > 0.5 && R > 0.5) { pitch = 0.2; roll = 2.45 + sin(t * 7.0) * 0.28; elbow = 0.5; yaw = 0.0; } // wave
        if (cIs(pose, 5.0) > 0.5 && R > 0.5) { pitch = 1.45; roll = 0.1; elbow = 0.08; yaw = -0.15; }           // point
        if (cIs(pose, 6.0) > 0.5 && R > 0.5) { pitch = 2.75 + sin(t * 0.9) * 0.08; roll = 0.12; elbow = 0.1; yaw = 0.0; } // guide flag held up
        if (cIs(pose, 7.0) > 0.5) { pitch = 0.3 + sin(t * 2.1 + side) * 0.18; roll = 0.0; elbow = 1.2 + sin(t * 3.3 + side * 1.7) * 0.35; yaw = 0.3; } // talk
        if (cIs(pose, 8.0) > 0.5) { if (R > 0.5) { pitch = 0.4; roll = 0.0; elbow = 1.2 + sin(t * 9.0) * 0.12; yaw = 0.75; } else { pitch = 1.0; roll = 0.0; elbow = 0.6; yaw = 0.2; } } // guitar
    }
    void legJoints(float side, out float hip, out float knee) {
        float pose = aAnim.w, fl = aAnim.z, sw = sin(aAnim.x) * aAnim.y, coat = flagOn(fl, 1.0);
        hip = side * sw * 0.42 * (1.0 - 0.35 * coat); knee = -max(0.0, -sin(aAnim.x + side * 1.2)) * aAnim.y * 0.55;
        if (cIs(pose, 1.0) > 0.5) { hip = 1.5; knee = -1.5; }                                                       // sit
    }
    // pose a rest-pose point (and normal): returns the transformed point; n is rotated in place
    vec3 crowdPose(vec3 p, inout vec3 n) {
        float lb = aLimb;
        if (lb < 0.5) return p;
        float side = (mod(lb, 2.0) > 0.5) ? -1.0 : 1.0;   // odd ids = left
        if (lb < 2.5 || lb > 6.5) {                         // legs
            float hip, knee; legJoints(side, hip, knee);
            vec3 H = vec3(side * 0.095, ${HIP_Y.toFixed(2)}, 0.0), K = vec3(side * 0.095, ${KNEE_Y.toFixed(2)}, 0.0);
            mat3 Rh = rotX(hip);
            if (lb > 6.5) { mat3 Rk = rotX(knee); p = Rk * (p - K) + K; n = Rk * n; }
            p = Rh * (p - H) + H; n = Rh * n;
        } else {                                             // arms
            float pitch, roll, elbow, yaw; armJoints(side, pitch, roll, elbow, yaw);
            vec3 S = vec3(side * 0.235, ${SHOULDER_Y.toFixed(2)}, 0.0), E = vec3(side * 0.245, ${ELBOW_Y.toFixed(2)}, 0.0);
            mat3 Rs = rotZ(side * roll) * rotY(side * yaw) * rotX(pitch);
            if (lb > 4.5) { mat3 Re = rotX(elbow); p = Re * (p - E) + E; n = Re * n; }
            p = Rs * (p - S) + S; n = Rs * n;
        }
        return p;
    }
    float crowdShow() {
        float fl = aAnim.z, pose = aAnim.w, sit = cIs(pose, 1.0), coat = flagOn(fl, 1.0), umb = max(flagOn(fl, 2.0), cIs(pose, 9.0)), hat = flagOn(fl, 4.0), bag = flagOn(fl, 8.0), wk = flagOn(fl, 16.0);
        if (aPart > 4.5 && aPart < 5.5) return coat;
        if (aPart > 12.5 && aPart < 13.5) return coat * (1.0 - sit);
        if (aPart > 5.5 && aPart < 6.5) return hat * (1.0 - wk);
        if ((aPart > 6.5 && aPart < 7.5) || (aPart > 10.5 && aPart < 11.5)) return umb;
        if (aPart > 7.5 && aPart < 8.5) return bag * (1.0 - sit);
        if (aPart > 8.5 && aPart < 10.5) return wk;
        float selfie = cIs(pose, 3.0) * flagOn(fl, 64.0) * (1.0 - flagOn(fl, 128.0));
        if (aPart > 24.5) return selfie;
        if ((aPart > 13.5 && aPart < 14.5) || (aPart > 19.5 && aPart < 20.5)) return flagOn(fl, 64.0) * (1.0 - flagOn(fl, 128.0)) * (1.0 - selfie); // (the arm phone hides while the selfie phone shows)
        if (aPart > 22.5) return flagOn(fl, 1024.0);
        if ((aPart > 13.5 && aPart < 14.5) || (aPart > 19.5 && aPart < 20.5)) return flagOn(fl, 64.0) * (1.0 - flagOn(fl, 128.0));
        if (aPart > 14.5 && aPart < 15.5) return flagOn(fl, 128.0);
        if (aPart > 15.5 && aPart < 17.5) return flagOn(fl, 256.0);
        if (aPart > 17.5 && aPart < 19.5) return flagOn(fl, 512.0);
        return 1.0;
    }`;
const GLSL_POSE = `
    { vec3 nDummy = vec3(0.0, 1.0, 0.0); transformed = crowdPose(transformed, nDummy); }
    transformed.y -= 0.45 * cIs(aAnim.w, 1.0);   // sit: hips at ~0.45 m
    transformed.y += cIs(aAnim.w, 10.0) * abs(sin((uCrowdTime + aAnim.x * 0.37) * 6.0)) * 0.07; // cheer: short bounce
    transformed *= crowdShow();`;
function crowdMaterial() {
    if (MAT) return MAT;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uCrowdTime = UTIME;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL_HEAD + `
            attribute vec3 aTop; attribute vec3 aBottom; attribute vec3 aSkin; attribute vec3 aHair; attribute vec3 aAcc;
            varying float vRough; varying float vEmis;`)
            .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n{ vec3 pDummy = crowdPose(position, objectNormal); }')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLSL_POSE)
            .replace('#include <color_vertex>', `#include <color_vertex>
            float fl = aAnim.z; vec3 cc = aTop; vRough = 0.85; vEmis = 0.0;
            if (aPart < 0.5) { cc = aSkin; vRough = 0.6; }
            else if (aPart < 1.5) cc = aTop;
            else if (aPart < 2.5) cc = aBottom;
            else if (aPart < 3.5) { cc = aBottom * 0.25 + vec3(0.012); vRough = 0.5; }
            else if (aPart < 4.5) cc = aHair;
            else if (aPart < 5.5) cc = aTop;
            else if (aPart < 6.5) { cc = mix(aAcc, vec3(0.16, 0.15, 0.15), 0.45); vRough = 0.95; }     // knit hat: muted
            else if (aPart < 7.5) { cc = aAcc; vRough = 0.45; }
            else if (aPart < 8.5) cc = aAcc * 0.8;
            else if (aPart < 9.5) { cc = vec3(0.85, 0.87, 0.82); vRough = 0.3; }
            else if (aPart < 10.5) { cc = vec3(0.95, 0.72, 0.02); vRough = 0.35; }
            else if (aPart < 11.5) cc = vec3(0.05);
            else if (aPart < 12.5) cc = mix(aTop, aSkin, flagOn(fl, 32.0));        // sleeves (bit 32 = short sleeves)
            else if (aPart < 13.5) cc = aTop;                                       // coat skirt
            else if (aPart < 14.5) { cc = vec3(0.02); vRough = 0.3; }              // phone
            else if (aPart < 15.5) { cc = vec3(0.015); vRough = 0.35; }            // camera
            else if (aPart < 16.5) { cc = vec3(0.55); vRough = 0.4; }              // flag pole
            else if (aPart < 17.5) cc = aAcc;                                       // flag cloth (accessory colour)
            else if (aPart < 18.5) { cc = vec3(0.42, 0.2, 0.07); vRough = 0.35; }  // guitar body
            else if (aPart < 19.5) cc = vec3(0.08, 0.05, 0.03);                     // guitar neck
            else if (aPart < 20.5) { cc = vec3(0.25, 0.45, 0.8); vEmis = 0.9; }      // phone screen
            else if (aPart < 21.5) { cc = vec3(0.035, 0.028, 0.024); vRough = 0.4; }  // eyes / brows
            else if (aPart < 22.5) cc = aSkin * vec3(0.72, 0.5, 0.48);                // mouth
            else if (aPart > 25.5) { cc = vec3(0.3, 0.5, 0.85); vEmis = 0.9; }   // selfie phone screen
            else if (aPart > 24.5) { cc = vec3(0.02); vRough = 0.3; }             // selfie phone body
            else { float tx = aPart < 23.5 ? position.x / 0.075 : (position.x + 0.05) / 0.022; cc = tx < -0.33 ? vec3(0.0, 0.12, 0.5) : tx < 0.33 ? vec3(0.95, 0.75, 0.0) : vec3(0.7, 0.03, 0.06); } // tricolour (blue / yellow / red)
            vColor.rgb = cc;`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRough; varying float vEmis;')
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRough;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vEmis;');
    };
    m.customProgramCacheKey = () => 'crowd7';
    const env = getVehicleEnvMap?.(); if (env) { m.envMap = env; m.envMapIntensity = 0.35; }
    return (MAT = m);
}
/** shadow-pass material with the same poses / outfit visibility */
function crowdDepthMaterial() {
    if (DEPTH) return DEPTH;
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    m.onBeforeCompile = (sh) => { sh.uniforms.uCrowdTime = UTIME; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL_HEAD).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLSL_POSE); };
    m.customProgramCacheKey = () => 'crowdDepth7';
    return (DEPTH = m);
}

// ---------------------------------------------------------------------------
//  Outfits per city / season / weather (real-world-ish shares)
// ---------------------------------------------------------------------------
const SKIN_BUC = [['#f1cfb4', 0.32], ['#e8bc9a', 0.3], ['#d9a27c', 0.2], ['#c58c66', 0.1], ['#a8704d', 0.05], ['#7a4a30', 0.03]];
const SKIN_SEA = [['#f1cfb4', 0.26], ['#e5b896', 0.2], ['#d6a27c', 0.14], ['#c08a62', 0.12], ['#9a6644', 0.1], ['#6e452c', 0.1], ['#4a2e1e', 0.08]];
const HAIR = [['#1a1410', 0.3], ['#3b2a1e', 0.3], ['#5a4030', 0.15], ['#8a6a48', 0.08], ['#b8a07a', 0.06], ['#9a9a96', 0.08], ['#d8d6d0', 0.03]];
const BOTTOMS = [['#2c3e5c', 0.34], ['#1c1d21', 0.24], ['#3a3d44', 0.14], ['#4a5568', 0.08], ['#6b5d4a', 0.07], ['#8a8f96', 0.06], ['#d8cfc0', 0.04], ['#5b3a29', 0.03]];
const COATS_BUC = [['#18191c', 0.3], ['#2f3237', 0.17], ['#1f2a44', 0.14], ['#9a7652', 0.1], ['#4b5320', 0.07], ['#5a1f2b', 0.06], ['#6b6e72', 0.08], ['#c9c2b5', 0.04], ['#a33a2a', 0.04]];
const COATS_SEA = [['#16181c', 0.26], ['#1f2a44', 0.18], ['#2f3237', 0.12], ['#1f6f78', 0.1], ['#4b5320', 0.1], ['#9b2226', 0.07], ['#6b6e72', 0.08], ['#d9a62e', 0.04], ['#3a5a8a', 0.05]];
const TOPS_SUMMER = [['#f2f2ef', 0.2], ['#1c1d21', 0.16], ['#1f2a44', 0.1], ['#8fb3d9', 0.09], ['#b3262b', 0.06], ['#c9c2b5', 0.08], ['#6b6e72', 0.08], ['#e7a6b8', 0.05], ['#3f7a4a', 0.05], ['#e9c46a', 0.05], ['#5b3a8c', 0.04], ['#2a9d8f', 0.04]];
const TOPS_MID = [['#1c1d21', 0.2], ['#2f3237', 0.14], ['#1f2a44', 0.14], ['#6b6e72', 0.12], ['#9a7652', 0.08], ['#4b5320', 0.08], ['#f2f2ef', 0.08], ['#7a1f2b', 0.06], ['#3a5a8a', 0.06], ['#c9c2b5', 0.04]];
const ACC = [['#111214', 0.35], ['#1f2a44', 0.15], ['#7a1f2b', 0.1], ['#3a3d44', 0.12], ['#c9c2b5', 0.06], ['#2a9d8f', 0.06], ['#d9a62e', 0.06], ['#b3262b', 0.1]];
const pickW = (list, r) => { let t = 0; for (const [, w] of list) t += w; let x = r() * t; for (const [k, w] of list) if ((x -= w) <= 0) return k; return list[list.length - 1][0]; };
/** 'winter' | 'spring' | 'summer' | 'autumn' for a date (northern hemisphere) */
export function seasonOf(date = new Date()) { const m = date.getMonth(); return m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn'; }
/** an outfit: { top, bottom, skin, hair, acc, flags } (hex colours, CROWD_FLAGS bits) for a pedestrian in this city / season / weather */
/** kind: 'adult' | 'worker' | 'fan' (tricolour supporter: jersey, scarf, face paint; pair with pose 'cheer') */
export function dressFor(cityId, season = seasonOf(), weather = null, rng = Math.random, kind = 'adult') {
    const sea = cityId === 'seattle', r = rng;
    const o = { skin: pickW(sea ? SKIN_SEA : SKIN_BUC, r), hair: pickW(HAIR, r), bottom: pickW(BOTTOMS, r), acc: pickW(ACC, r), flags: 0, top: '#2f3237' };
    const cold = season === 'winter' ? 1 : season === 'autumn' ? 0.6 : season === 'spring' ? 0.35 : 0;
    if (r() < cold * (sea ? 0.75 : 0.85)) { o.flags |= CROWD_FLAGS.coat; o.top = pickW(sea ? COATS_SEA : COATS_BUC, r); }
    else o.top = pickW(season === 'summer' ? TOPS_SUMMER : TOPS_MID, r);
    if (season === 'summer' && !(o.flags & CROWD_FLAGS.coat) && r() < 0.7) o.flags |= 32; // short sleeves
    if (r() < cold * (sea ? 0.32 : 0.3)) o.flags |= CROWD_FLAGS.hat;
    if (r() < (sea ? 0.3 : 0.16)) o.flags |= CROWD_FLAGS.bag;
    if ((weather === 'rain' || weather === 'snow') && r() < (sea ? 0.18 : 0.55)) o.flags |= CROWD_FLAGS.umbrella;
    if (kind === 'worker') { o.flags = CROWD_FLAGS.worker; o.top = '#f97316'; o.bottom = '#1f2937'; }
    if (kind === 'fan') { o.flags = (o.flags & ~(CROWD_FLAGS.coat | CROWD_FLAGS.umbrella)) | CROWD_FLAGS.fan | (r() < 0.5 ? CROWD_FLAGS.shortSleeves : 0); o.top = r() < 0.75 ? '#f5d000' : (r() < 0.5 ? '#0b2a7a' : '#b01020'); } // Romanian supporters: tricolour jersey + scarf + face paint
    return o;
}

// ---------------------------------------------------------------------------
//  makeCrowd
// ---------------------------------------------------------------------------
const OPTS = { near: 45, far: 260, margin: 3 };
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere(), _cp = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _c = new THREE.Color();
/**
 * Instanced crowd. makeCrowd({ max, city, season?, weather?, rng?, castShadow? }) → crowd:
 *   crowd.object (Group to add to the scene), crowd.count (live instances 0..max),
 *   crowd.set(i, { x, y, z, yaw, phase, amp (0 standing … 1 walking), scale, down?, fallDir? }) per frame,
 *   crowd.dress(i, outfit | null) (null = a random dressFor(city, season, weather)), crowd.setWeather(kind) (re-rolls umbrellas),
 *   crowd.stats { near, far, culled, ms }, crowd.dispose().
 */
export function makeCrowd({ max = 256, city = 'bucharest', season = seasonOf(), weather = null, rng = Math.random, castShadow = true } = {}) {
    const G = personGeometry(), mat = crowdMaterial();
    const N = Math.max(1, max);
    const poses = new Float32Array(N), mats = new Float32Array(N * 16), anim = new Float32Array(N * 2), cols = new Float32Array(N * 15), flags = new Float32Array(N), live = new Uint8Array(N), rad = new Float32Array(N);
    const outfits = new Array(N);
    const object = new THREE.Group(); object.name = 'crowd';
    const mk = (geo, cast) => {
        const g = new THREE.BufferGeometry();
        for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
        g.setIndex(geo.index);
        const at = {};
        for (const [k, n] of [['aTop', 3], ['aBottom', 3], ['aSkin', 3], ['aHair', 3], ['aAcc', 3], ['aAnim', 4]]) { at[k] = new THREE.InstancedBufferAttribute(new Float32Array(N * n), n); at[k].setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, at[k]); }
        const mesh = new THREE.InstancedMesh(g, mat, N); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.customDepthMaterial = crowdDepthMaterial();
        mesh.frustumCulled = false; mesh.castShadow = cast; mesh.receiveShadow = true; mesh.count = 0; mesh.userData.shared = true;
        object.add(mesh);
        return { mesh, at };
    };
    const near = mk(G.near, castShadow), far = mk(G.far, false);
    near.mesh.name = 'crowd-near'; far.mesh.name = 'crowd-far';
    const crowd = {
        object, max: N, count: 0, city, season, weather, stats: { near: 0, far: 0, culled: 0, ms: 0 },
        set(i, { x = 0, y = 0, z = 0, yaw = 0, phase = 0, amp = 0, scale = 1, down = false, fallDir = 0, pose = 0, prop } = {}) {
            if (i >= N) return;
            if (down) _m4.compose(_p.set(x, y + 0.12 * scale, z), _q.setFromEuler(_e.set(-Math.PI / 2, fallDir, 0, 'YXZ')), _s.set(scale, scale, scale));
            else _m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, yaw, 0)), _s.set(scale, scale, scale));
            _m4.toArray(mats, i * 16); anim[i * 2] = phase; anim[i * 2 + 1] = down ? 0 : amp; live[i] = 1; rad[i] = 1.2 * scale;
            poses[i] = down ? 0 : (typeof pose === 'number' ? pose : (CROWD_POSES[pose] ?? 0));
            if (prop !== undefined) flags[i] = (flags[i] & ~PROP_MASK) | (prop ? (PROP_BITS[prop] || 0) : 0);
        },
        hide(i) { if (i < N) live[i] = 0; },
        /** (2026-11-08, owner: "people with objects in hand should account for the objects") how far this person's body +
         *  what they carry reaches from their centre (m): an open umbrella's canopy, a guitar, a flag, a bag, a phone held out */
        reach(i) {
            const f = flags[i] || 0, F = CROWD_FLAGS;
            return f & F.umbrella ? 0.55 : f & F.guitar ? 0.5 : f & F.flag ? 0.45 : f & F.bag ? 0.38 : f & (F.phone | F.camera) ? 0.34 : 0.3;
        },
        dress(i, o = null) {
            if (i >= N) return;
            o = o || dressFor(city, crowd.season, crowd.weather, rng);
            outfits[i] = o;
            ['top', 'bottom', 'skin', 'hair', 'acc'].forEach((k, j) => { _c.set(o[k]); cols[i * 15 + j * 3] = _c.r; cols[i * 15 + j * 3 + 1] = _c.g; cols[i * 15 + j * 3 + 2] = _c.b; });
            flags[i] = (o.flags || 0) | (flags[i] & PROP_MASK);
        },
        setWeather(w) {
            if (w === crowd.weather) return; crowd.weather = w;
            const wet = w === 'rain' || w === 'snow';
            for (let i = 0; i < N; i++) {
                if (!outfits[i] || (flags[i] & CROWD_FLAGS.worker)) continue;
                const u = wet && rng() < (city === 'seattle' ? 0.18 : 0.55);
                flags[i] = (flags[i] & ~CROWD_FLAGS.umbrella) | (u ? CROWD_FLAGS.umbrella : 0);
            }
        },
        dispose() { removePre(); object.parent?.remove(object); for (const x of [near, far]) { for (const k in x.at) x.mesh.geometry.deleteAttribute(k); x.mesh.geometry.dispose(); x.mesh.dispose?.(); } },
    };
    for (let i = 0; i < N; i++) crowd.dress(i);
    const write = (dst, j, i) => {
        dst.mesh.instanceMatrix.array.set(mats.subarray(i * 16, i * 16 + 16), j * 16);
        const a = dst.at;
        a.aTop.array.set(cols.subarray(i * 15, i * 15 + 3), j * 3); a.aBottom.array.set(cols.subarray(i * 15 + 3, i * 15 + 6), j * 3);
        a.aSkin.array.set(cols.subarray(i * 15 + 6, i * 15 + 9), j * 3); a.aHair.array.set(cols.subarray(i * 15 + 9, i * 15 + 12), j * 3);
        a.aAcc.array.set(cols.subarray(i * 15 + 12, i * 15 + 15), j * 3);
        a.aAnim.array[j * 4] = anim[i * 2]; a.aAnim.array[j * 4 + 1] = anim[i * 2 + 1]; a.aAnim.array[j * 4 + 2] = flags[i]; a.aAnim.array[j * 4 + 3] = poses[i];
    };
    const removePre = addPreRenderHook((renderer, scene, camera) => {
        let o = object, vis = true; while (o.parent) { if (!o.visible) { vis = false; break; } o = o.parent; }
        if (o !== scene || !vis || !object.visible) return;
        const t0 = performance.now(); UTIME.value = (t0 / 1000) % 3600;
        _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
        _cp.setFromMatrixPosition(camera.matrixWorld);
        const pw = object.matrixWorld, ident = pw.equals(_IDENT);
        let nn = 0, nf = 0, nc = 0;
        const lim = Math.min(N, crowd.count || N);
        for (let i = 0; i < lim; i++) {
            if (!live[i]) continue;
            _sp.center.set(mats[i * 16 + 12], mats[i * 16 + 13] + 0.9, mats[i * 16 + 14]); if (!ident) _sp.center.applyMatrix4(pw);
            _sp.radius = rad[i] + OPTS.margin;
            const d = _sp.center.distanceTo(_cp);
            if (d > OPTS.far || !_fr.intersectsSphere(_sp)) { nc++; continue; }
            if (d < OPTS.near) write(near, nn++, i); else write(far, nf++, i);
        }
        for (const [x, n] of [[near, nn], [far, nf]]) {
            x.mesh.count = n; x.mesh.visible = n > 0;
            if (n) { x.mesh.instanceMatrix.needsUpdate = true; for (const k in x.at) x.at[k].needsUpdate = true; }
        }
        crowd.stats = { near: nn, far: nf, culled: nc, ms: Math.round((performance.now() - t0) * 100) / 100 };
    });
    return crowd;
}
const _IDENT = new THREE.Matrix4();
/** LOD / cull distances for all crowds: { near (m, detailed model), far (m, culled beyond), margin } */
export function setCrowdOptions(o = {}) { Object.assign(OPTS, o); }
/** triangles of the near / far person model */
export function crowdTriangles() { const G = personGeometry(); return { near: G.near.index.count / 3, far: G.far.index.count / 3 }; }
