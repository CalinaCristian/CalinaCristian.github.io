// Player cockpit (split from vehicles.js, spec 22): dashboard, gauges, nav screen, wheel and mirrors laid out by viewing
// angle from the driver's eye. vehicles.js re-exports makeCockpit.
import * as THREE from '../vendor/three.module.min.js';
import { drawFitText } from './canvasText.js';
import { BOX, Batch, IDENT, M, beamM, extrude } from './vehicle-models.js';
import { cockpitMaterial, track } from './vehicle-materials.js';

// ============================================================================
//  COCKPIT
// ============================================================================
const GAUGE_W = 512, GAUGE_H = 200;
function gaugeCanvas() {
    const c = document.createElement('canvas'); c.width = GAUGE_W; c.height = GAUGE_H;
    return c;
}
const gFont = (w) => (s) => `${w} ${s}px system-ui, "Helvetica Neue", Arial, sans-serif`;
const GF6 = gFont('600'), GF5 = gFont('500'), GF7 = gFont('700');
function drawGauges(ctx, speedMs, rpm01, fuel01, mph) {
    const W = GAUGE_W, H = GAUGE_H;
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#07090c'); bg.addColorStop(1, '#101419');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const dial = (cx, cy, r, max, step, label, value, redFrom) => {
        const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        ctx.lineWidth = 3; ctx.strokeStyle = '#2b3440'; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
        if (redFrom != null) { ctx.strokeStyle = '#c0262d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r - 3, a0 + (a1 - a0) * redFrom / max, a1); ctx.stroke(); }
        ctx.fillStyle = '#cfd8e3';
        for (let v = 0; v <= max + 1e-6; v += step / 2) {
            const a = a0 + (a1 - a0) * v / max, major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
            ctx.strokeStyle = major ? '#e6edf5' : '#6b7787'; ctx.lineWidth = major ? 2.5 : 1.5;
            const r0 = r - (major ? 14 : 8);
            ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); ctx.stroke();
            if (major) drawFitText(ctx, String(Math.round(v)), cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30), 30, { maxSize: 16, minSize: 9, font: GF6, label: 'gauge tick' });
        }
        ctx.fillStyle = '#7d8a99'; drawFitText(ctx, label, cx, cy + r * 0.47, r * 0.95, { maxSize: 13, minSize: 8, font: GF5, label: 'gauge label' });
        const a = a0 + (a1 - a0) * Math.min(value, max * 1.02) / max;
        ctx.strokeStyle = '#ff5a2a'; ctx.lineWidth = 4; ctx.shadowColor = '#ff5a2a'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 10, cy - Math.sin(a) * 10); ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = '#1b2129'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    };
    const spd = Math.abs(speedMs) * (mph ? 2.23694 : 3.6);
    dial(110, 104, 88, mph ? 140 : 220, mph ? 20 : 40, mph ? 'MPH' : 'km/h', spd, null);
    dial(402, 104, 88, 8, 1, '×1000 rpm', rpm01 * 8, 6.5);
    // centre: digital speed + unit + fuel bar (each text fitted to the 112 px column between the dials)
    ctx.fillStyle = '#f2f6fa'; drawFitText(ctx, String(Math.round(spd)), 256, 82, 104, { maxSize: 46, minSize: 20, font: GF7, label: 'gauge speed' });
    ctx.fillStyle = '#7d8a99'; drawFitText(ctx, mph ? 'mph' : 'km/h', 256, 116, 90, { maxSize: 14, minSize: 9, font: GF5, label: 'gauge unit' });
    ctx.strokeStyle = '#2b3440'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(216, 158); ctx.lineTo(296, 158); ctx.stroke();
    ctx.strokeStyle = fuel01 < 0.15 ? '#ff8a1c' : '#5fd38d'; ctx.beginPath(); ctx.moveTo(216, 158); ctx.lineTo(216 + 80 * Math.max(0, Math.min(1, fuel01)), 158); ctx.stroke();
    ctx.fillStyle = '#7d8a99'; drawFitText(ctx, 'FUEL', 256, 178, 80, { maxSize: 12, minSize: 8, font: GF5, label: 'gauge fuel' });
}

// Driver eye in cockpit space (= player.js camHolder rest position). The dashboard parts are laid out by viewing
// angle from here so the cluster, the nav screen and the wheel never overlap at any FOV (72–86°) or aspect.
const EYE = new THREE.Vector3(-0.3, 1.36, -0.45);
const D2R = Math.PI / 180;
/** point at azimuth az (° right of straight ahead), elevation el (° below the horizon), distance dist from the eye */
const fromEye = (az, el, dist) => new THREE.Vector3(
    EYE.x + dist * Math.cos(el * D2R) * Math.sin(az * D2R), EYE.y - dist * Math.sin(el * D2R), EYE.z - dist * Math.cos(el * D2R) * Math.cos(az * D2R));
/** Euler (YXZ) that turns a +z-facing plane at p to face the eye */
const faceEyeEuler = (p) => { const n = EYE.clone().sub(p).normalize(); return new THREE.Euler(-Math.asin(n.y), Math.atan2(n.x, n.z), 0, 'YXZ'); };
// layout (degrees from the eye). FOV 72 puts the bottom of the view 36° below the horizon; the HUD's speedometer
// block starts ~41° right of centre at 16:9. Wheel rim top 27.5° (hub 44°, below the view), cluster above the
// rim, screen right of the rim and left of the HUD, everything below the windshield's bottom edge (rain overlay).
const CLUSTER = { az: 0, el: 20.6, dist: 0.75, w: 0.33, h: 0.33 * GAUGE_H / GAUGE_W, tilt: 18 };
const SCREEN = { az: 22, el: 20.5, dist: 0.86, w: 0.34, h: 0.2125, yaw: 0, tilt: 16 }; // integrated in the centre stack on the car's centreline, square to the dash (not turned toward the driver: after round 6), 16° back-tilt
const WHEEL = { pos: new THREE.Vector3(-0.3, 0.89, -0.945), tilt: -0.42, r: 0.178, tube: 0.02 };
const B_Z = 0.1; // front door rear edge / B-pillar (z, cockpit space): beside the front seat back, in view when looking 90° to the side
const MIRROR = { pos: new THREE.Vector3(0.0, 1.655, -1.125), w: 0.27, h: 0.09 };

/** centre-screen home page (512×320): clock, date, media card, nav hint — what the screen shows until the map is drawn */
function homeScreenCanvas() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
    const ctx = canvas.getContext('2d'), F = (w) => (sz) => `${w} ${sz}px system-ui, "Helvetica Neue", Arial, sans-serif`;
    let lastKey = '';
    const draw = (date = new Date()) => {
        const hh = String(date.getHours()).padStart(2, '0'), mm = String(date.getMinutes()).padStart(2, '0'), key = hh + mm;
        if (key === lastKey) return false; lastKey = key;
        const g = ctx.createLinearGradient(0, 0, 512, 320); g.addColorStop(0, '#0e1a2b'); g.addColorStop(0.6, '#0a1220'); g.addColorStop(1, '#16213a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 320);
        ctx.fillStyle = 'rgba(80,140,220,0.10)'; ctx.beginPath(); ctx.arc(430, 40, 160, 0, 7); ctx.fill();
        // status bar
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 0, 512, 34);
        ctx.fillStyle = '#c7d2e0'; ctx.textAlign = 'left'; drawFitText(ctx, 'Home', 18, 17, 150, { maxSize: 15, minSize: 10, font: F('600'), label: 'screen home' });
        ctx.textAlign = 'right'; drawFitText(ctx, `${hh}:${mm}`, 494, 17, 90, { maxSize: 15, minSize: 10, font: F('600'), label: 'screen clock small' });
        // clock + date
        ctx.textAlign = 'left'; ctx.fillStyle = '#f4f7fb';
        drawFitText(ctx, `${hh}:${mm}`, 28, 112, 250, { maxSize: 84, minSize: 30, font: F('300'), label: 'screen clock' });
        ctx.fillStyle = '#8fa3bb';
        drawFitText(ctx, date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), 30, 168, 250, { maxSize: 18, minSize: 11, font: F('500'), label: 'screen date' });
        // media card
        const card = (x, y, w, h) => { ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 14) : ctx.rect(x, y, w, h); ctx.fill(); };
        card(300, 60, 186, 118);
        ctx.fillStyle = '#2b6cb0'; ctx.fillRect(316, 76, 44, 44); ctx.fillStyle = '#e6eef8'; ctx.textAlign = 'center';
        drawFitText(ctx, 'FM', 338, 98, 40, { maxSize: 16, minSize: 9, font: F('700'), label: 'screen fm' });
        ctx.textAlign = 'left'; ctx.fillStyle = '#f4f7fb'; drawFitText(ctx, 'Radio', 372, 88, 104, { maxSize: 16, minSize: 10, font: F('600'), label: 'screen radio' });
        ctx.fillStyle = '#8fa3bb'; drawFitText(ctx, '98.3 FM', 372, 110, 104, { maxSize: 14, minSize: 9, font: F('500'), label: 'screen station' });
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(316, 146, 154, 4); ctx.fillStyle = '#5fa8ff'; ctx.fillRect(316, 146, 62, 4);
        // tiles row
        const tiles = [['Navigation', '#3b82f6'], ['Phone', '#22c55e'], ['Media', '#f59e0b'], ['Settings', '#94a3b8']];
        tiles.forEach(([t, c], i) => {
            const x = 28 + i * 118; card(x, 206, 106, 78);
            ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 53, 236, 13, 0, 7); ctx.fill();
            ctx.fillStyle = '#c7d2e0'; ctx.textAlign = 'center'; drawFitText(ctx, t, x + 53, 268, 96, { maxSize: 13, minSize: 8, font: F('500'), label: 'screen tile' });
        });
        return true;
    };
    draw();
    return { canvas, draw };
}

/** The cockpit the player sits in. Coordinates in the car rig space (driver eye at (-0.3, 1.36, -0.45), forward -z). */
export function makeCockpit() {
    const g = new THREE.Group();
    g.userData.shared = true;
    const interior = new Batch();
    const DASH = '#16181b', DASH2 = '#1e2024', TRIM = '#303338', SOFT = '#202226', HEAD = '#2f2e2c', GLOSS = '#0b0c0e';
    const DR = { r: 0.85 }, DR2 = { r: 0.7 };
    // ---- windshield frame geometry (shared with wipers + rain shader) ----
    const cowl = new THREE.Vector3(0, 1.05, -1.78), header = new THREE.Vector3(0, 1.76, -1.06);
    const sAxis = new THREE.Vector3().subVectors(header, cowl); const wsLen = sAxis.length(); sAxis.normalize();
    const halfW0 = 0.76, halfW1 = 0.69;
    // ---- dashboard (extruded profile): top just under the glass, rounded lip, driver-facing front ----
    const dashProfile = [[-1.86, 0.5], [-1.86, 1.0], [-1.8, 1.036], [-1.6, 1.04], [-1.38, 1.03], [-1.27, 1.012], [-1.215, 0.985], [-1.2, 0.95],
        [-1.2, 0.86], [-1.215, 0.66], [-1.32, 0.56], [-1.5, 0.5]];
    interior.add(extrude(dashProfile, -0.8, 0.8), IDENT, DASH, DR);
    interior.add(BOX, M(0, 0.905, -1.197, 1.58, 0.05, 0.012), TRIM, { r: 0.4, m: 0.3 }); // trim strip across the dash face
    interior.add(BOX, M(0.5, 0.79, -1.207, 0.5, 0.004, 0.012), '#0d0e10', { r: 0.6 });   // glovebox seam
    interior.add(BOX, M(0.5, 0.74, -1.205, 0.08, 0.018, 0.016), '#3a3d42', { r: 0.4, m: 0.4 }); // glovebox latch
    // outboard air vents (dark grille + two slats)
    for (const x of [-0.66, 0.66]) {
        interior.add(BOX, M(x, 0.958, -1.2, 0.15, 0.06, 0.014), '#0d0e10', { r: 0.6 });
        for (const dy of [-0.012, 0.012]) interior.add(BOX, M(x, 0.958 + dy, -1.192, 0.14, 0.006, 0.006), '#3a3d42', { r: 0.4, m: 0.4 });
    }
    interior.add(BOX, M(-0.68, 0.8, -1.205, 0.1, 0.05, 0.016), '#24272b', DR2); // light switch panel
    // stitching hints: dashed seam along the dash lip (passenger half) and over the door armrests
    for (let x = 0.2; x < 0.76; x += 0.026) interior.add(BOX, M(x, 0.972, -1.21, 0.013, 0.003, 0.004), '#4d4a44', { r: 0.8 });
    for (const sx of [-1, 1]) for (let z = -0.6; z < -0.1; z += 0.026) interior.add(BOX, M(sx * 0.72, 0.851, z, 0.004, 0.003, 0.013), '#4a4741', { r: 0.8 });
    // firewall / footwell front (closes the gap under the dash) + floor
    interior.add(BOX, M(0, 0.56, -1.79, 1.56, 0.26, 0.1), '#141518', { r: 0.95 });

    // ---- instrument cluster pod: a binnacle on the dash top, seen over the steering-wheel rim ----
    const cPos = fromEye(CLUSTER.az, CLUSTER.el, CLUSTER.dist), cRot = new THREE.Euler(-CLUSTER.tilt * D2R, 0, 0, 'YXZ'); // square to the car axis, leaned back like a real binnacle
    {
        // profile along the cluster face (tilted toward the eye), 8 mm behind it, with a short visor on top
        const up = new THREE.Vector3(0, 1, 0).applyEuler(cRot), nrm = new THREE.Vector3(0, 0, 1).applyEuler(cRot);
        const top = cPos.clone().addScaledVector(up, CLUSTER.h / 2).addScaledVector(nrm, -0.008);
        const bot = cPos.clone().addScaledVector(up, -CLUSTER.h / 2).addScaledVector(nrm, -0.008);
        const tip = top.clone().addScaledVector(up, 0.012).addScaledVector(nrm, 0.02);
        const pod = [[bot.z + 0.004, 0.94], [bot.z + 0.004, bot.y - 0.004], [bot.z, bot.y], [top.z, top.y], [tip.z, tip.y], [tip.z - 0.02, tip.y + 0.012],
            [-1.3, tip.y + 0.01], [-1.44, 1.06], [-1.44, 0.94]];
        const hw = CLUSTER.w / 2 + 0.012;
        interior.add(extrude(pod, cPos.x - hw, cPos.x + hw), IDENT, DASH2, DR);
    }
    const gc = gaugeCanvas(), gctx = gc.getContext('2d');
    const gtex = new THREE.CanvasTexture(gc); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 4;
    drawGauges(gctx, 0, 0.1, 0.72, false);
    const cluster = new THREE.Mesh(new THREE.PlaneGeometry(CLUSTER.w, CLUSTER.h), new THREE.MeshBasicMaterial({ map: gtex, toneMapped: false }));
    cluster.name = 'cluster';
    cluster.position.copy(cPos); cluster.rotation.copy(cRot);
    g.add(cluster);
    g.userData.cluster = cluster;

    // ---- centre screen integrated at the top of the centre stack: square to the dash, mild driver yaw + back-tilt ----
    const sPos = fromEye(SCREEN.az, SCREEN.el, SCREEN.dist), sRot = new THREE.Euler(-SCREEN.tilt * D2R, -SCREEN.yaw * D2R, 0, 'YXZ');
    {
        // centre stack under the screen, aligned with the screen's yaw (front face just behind the bezel's bottom edge)
        const yawM = new THREE.Matrix4().makeRotationY(sRot.y), at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(yawM).add(sPos);
        const down = new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(sRot.x, 0, 0)); // screen "down" in the yaw frame
        const bz = down.z * (SCREEN.h / 2 + 0.014), by = down.y * (SCREEN.h / 2 + 0.014);  // bezel bottom edge (yaw frame)
        const stackTop = by - 0.004, stackFront = bz - 0.03, stackBottom = 0.6 - sPos.y;
        const sc = at(0, (stackTop + stackBottom) / 2, stackFront - 0.07);
        const SM = (x, y, z, sx, sy, sz) => M(at(x, y, z).x, at(x, y, z).y, at(x, y, z).z, sx, sy, sz, 0, sRot.y, 0);
        interior.add(BOX, M(sc.x, sc.y, sc.z, 0.3, stackTop - stackBottom, 0.14, 0, sRot.y, 0), DASH2, DR2);
        // stack face: two centre vents, climate strip with knobs, hazard button
        for (const x of [-0.075, 0.075]) {
            interior.add(BOX, SM(x, stackTop - 0.045, stackFront + 0.002, 0.11, 0.05, 0.01), '#0d0e10', { r: 0.6 });
            for (const dy of [-0.01, 0.01]) interior.add(BOX, SM(x, stackTop - 0.045 + dy, stackFront + 0.008, 0.1, 0.005, 0.006), '#3a3d42', { r: 0.4, m: 0.4 });
        }
        interior.add(BOX, SM(0, stackTop - 0.1, stackFront + 0.004, 0.06, 0.03, 0.012), '#7a1d1f', { r: 0.4 }); // hazard
        interior.add(BOX, SM(0, stackTop - 0.165, stackFront + 0.002, 0.26, 0.07, 0.01), '#111214', { r: 0.25, m: 0.2 }); // climate panel
        for (const x of [-0.09, 0.09]) interior.add(new THREE.CylinderGeometry(0.022, 0.024, 0.024, 12), M(at(x, stackTop - 0.165, stackFront + 0.014).x, at(x, stackTop - 0.165, stackFront + 0.014).y, at(x, stackTop - 0.165, stackFront + 0.014).z, 1, 1, 1, Math.PI / 2, sRot.y, 0), '#4a4e55', { r: 0.35, m: 0.6 });
        for (let i = -1; i <= 1; i++) interior.add(BOX, SM(i * 0.035, stackTop - 0.165, stackFront + 0.008, 0.024, 0.014, 0.004), '#5d6670', { e: 0.6, r: 0.4 });
    }
    // home screen (clock, media, hint) shown wherever the assigned map texture is still empty (alpha 0: e.g. before the
    // navigation's first draw), plus an anti-glare glass finish (soft sheen, faint daylight veil, dimmer at night)
    const home = homeScreenCanvas(), htex = new THREE.CanvasTexture(home.canvas); htex.colorSpace = THREE.SRGBColorSpace; htex.anisotropy = 4;
    const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
    const screenMat = new THREE.MeshBasicMaterial({ map: blank, color: '#ffffff', toneMapped: false });
    screenMat.userData.uHome = { value: htex }; screenMat.userData.uScreen = { value: new THREE.Vector2(1, 0.035) }; // (brightness, veil)
    screenMat.onBeforeCompile = (sh) => {
        sh.uniforms.uHome = screenMat.userData.uHome; sh.uniforms.uScreen = screenMat.userData.uScreen;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uHome;\nuniform vec2 uScreen;')
            .replace('#include <map_fragment>', `#include <map_fragment>
            #ifdef USE_MAP
                vec4 homeC = texture2D(uHome, vMapUv);
                diffuseColor.rgb = mix(homeC.rgb, diffuseColor.rgb / max(sampledDiffuseColor.a, 1e-3) * sampledDiffuseColor.a, step(0.02, sampledDiffuseColor.a));
                float sheen = smoothstep(0.35, 1.0, vMapUv.y * 0.8 + (1.0 - vMapUv.x) * 0.5) * 0.05;
                diffuseColor.rgb = diffuseColor.rgb * uScreen.x * 0.92 + vec3(uScreen.y + sheen) * (0.6 + 0.4 * uScreen.x);
                diffuseColor.a = 1.0;
            #endif`);
    };
    screenMat.customProgramCacheKey = () => 'carScreen1';
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat);
    screen.name = 'screen';
    screen.position.copy(sPos); screen.rotation.copy(sRot);
    // housing: glossy bezel just behind the glass + a deeper back shell (children: they follow the screen)
    const housingMat = track(new THREE.MeshStandardMaterial({ color: GLOSS, roughness: 0.12, metalness: 0.35 })); // piano black
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(SCREEN.w + 0.028, SCREEN.h + 0.028, 0.026), housingMat);
    bezel.position.z = -0.0135; bezel.name = 'screen-bezel'; screen.add(bezel);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(SCREEN.w - 0.03, SCREEN.h - 0.03, 0.05), new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.8 }));
    shell.position.z = -0.045; shell.name = 'screen-shell'; screen.add(shell);
    g.add(screen);
    g.userData.screen = screen;

    // ---- centre console between the seats ----
    interior.add(BOX, M(0.03, 0.5, -0.62, 0.26, 0.2, 1.1), DASH2, DR2);
    interior.add(BOX, M(0.03, 0.605, -0.86, 0.2, 0.012, 0.3), '#111214', { r: 0.3, m: 0.2 }); // gear selector bezel
    interior.add(BOX, M(0.03, 0.66, -0.84, 0.035, 0.1, 0.05), '#26292d', { r: 0.5 });       // selector
    interior.add(BOX, M(0.03, 0.62, 0.1, 0.22, 0.08, 0.36), DASH2, DR2);                     // armrest
    // ---- A-pillars (slim), header, headliner, visors ----
    for (const s of [-1, 1]) {
        const a = new THREE.Vector3(s * (halfW0 + 0.03), 1.04, -1.79), b = new THREE.Vector3(s * (halfW1 + 0.03), 1.77, -1.05);
        interior.add(BOX, beamM(a, b, 0.05, 0.034), HEAD, { r: 0.9 });
    }
    interior.add(BOX, M(0, 1.79, -0.94, 1.56, 0.06, 0.24), HEAD, { r: 0.95 }); // header
    interior.add(BOX, M(0, 1.83, -0.1, 1.6, 0.04, 1.5), HEAD, { r: 0.95 }); // headliner
    interior.add(BOX, M(-0.33, 1.752, -0.93, 0.4, 0.018, 0.17), '#3f3d39', { r: 0.95 }); // driver visor (stowed)
    interior.add(BOX, M(0.33, 1.752, -0.93, 0.4, 0.018, 0.17), '#3f3d39', { r: 0.95 });
    // rear-view mirror mount: foot glued to the glass, stalk, housing behind the mirror glass (glass = player.js)
    {
        const tWs = (1.738 - cowl.y) / (header.y - cowl.y), foot = cowl.clone().addScaledVector(sAxis, tWs * wsLen).add(new THREE.Vector3(MIRROR.pos.x, 0, 0.012));
        interior.add(BOX, M(foot.x, foot.y, foot.z, 0.04, 0.024, 0.02, -0.75), '#1a1b1e', { r: 0.6 });
        const back = MIRROR.pos.clone().add(new THREE.Vector3(0, 0.03, -0.03));
        interior.add(BOX, beamM(foot, back, 0.016, 0.016), '#1a1b1e', { r: 0.6 });
    }
    // ---- doors (left = driver, right = passenger): panel, belt line trim, armrest, handle, window frame ----
    for (const s of [-1, 1]) {
        const x = s * 0.8;
        interior.add(extrude([[-1.75, 0.43], [-1.75, 1.0], [-1.6, 1.07], [B_Z, 1.07], [B_Z, 0.43]], x - 0.03, x + 0.03), IDENT, SOFT, DR);
        interior.add(BOX, M(x - s * 0.035, 1.075, (-1.6 + B_Z) / 2, 0.05, 0.03, B_Z + 1.6), TRIM, { r: 0.5, m: 0.2 });
        interior.add(BOX, M(x - s * 0.012, 1.098, (-1.15 + B_Z) / 2, 0.03, 0.02, B_Z + 1.15), '#0c0d0f', { r: 0.6 }); // window channel seal at the sill
        // door window frame (#25): front edge up the A-pillar, top rail ~0.3 m above the eye (real greenhouse height),
        // sloping roof-side panel up to the headliner — what frames the side window when the driver looks left/right
        interior.add(BOX, beamM(new THREE.Vector3(s * 0.8, 1.09, -1.18), new THREE.Vector3(s * 0.795, 1.64, -1.02), 0.04, 0.05), HEAD, { r: 0.92 });
        interior.add(BOX, beamM(new THREE.Vector3(s * 0.795, 1.655, -1.03), new THREE.Vector3(s * 0.795, 1.655, B_Z), 0.05, 0.045), HEAD, { r: 0.92 });
        interior.add(BOX, M(s * 0.705, 1.745, (-1.02 + 1.3) / 2, 0.27, 0.02, 2.32, 0, 0, s < 0 ? 0.76 : Math.PI - 0.76), HEAD, { r: 0.95 });
        interior.add(BOX, M(s * 0.74, 1.70, -0.25, 0.03, 0.03, 0.22), '#3a3936', { r: 0.8 }); // grab handle
        // mirror sail (triangle trim at the front lower corner of the window)
        interior.add(extrude([[-1.6, 1.07], [-1.15, 1.07], [-1.15, 1.2], [-1.3, 1.07]], x - 0.025, x + 0.025), IDENT, SOFT, DR);
        interior.add(BOX, M(x - s * 0.08, 0.82, -0.35, 0.1, 0.06, 0.6), DASH2, DR2);
        interior.add(BOX, M(x - s * 0.04, 0.95, -0.95, 0.02, 0.04, 0.12), '#8d939a', { r: 0.3, m: 0.8 });
        interior.add(BOX, M(x - s * 0.035, 0.6, -0.9, 0.012, 0.16, 0.5), '#1a1b1e', { r: 0.9 }); // door pocket
        // door skin behind the trim: what you see when the camera's near plane (0.4 m) cuts the driver's door
        // panel at the edge of a very wide view (21:9) — keeps the outside from showing through below the belt line
        // (driver side further out: the eye is only 0.47 m from that panel)
        if (s < 0) interior.add(BOX, M(-0.985, 0.71, -0.2, 0.03, 0.58, 3.4), '#141518', { r: 0.95 });
        else interior.add(BOX, M(0.93, 0.75, -0.2, 0.03, 0.66, 3.4), '#141518', { r: 0.95 });
        // exterior side mirror (painted housing, mirror glass facing back, arm to the door)
        interior.add(BOX, M(s * 1.0, 1.12, -1.6, 0.18, 0.11, 0.1), '#a3242a', { r: 0.3, m: 0.3 });
        interior.add(BOX, M(s * 1.0, 1.12, -1.548, 0.155, 0.085, 0.006), '#5d6f80', { r: 0.02, m: 1 });
        interior.add(BOX, M(s * 0.88, 1.09, -1.62, 0.1, 0.035, 0.05), '#1a1b1e');
    }
    // roof skin above the headliner + roof rails above the side windows (same reason as the door skin, when
    // looking up: the headliner/rails can be cut by the near plane, and nothing may show sky above the windows)
    interior.add(BOX, M(0, 2.12, 0.1, 1.72, 0.03, 2.1), '#141518', { r: 0.95 });
    interior.add(BOX, M(0, 1.845, -0.99, 1.66, 0.03, 0.2), HEAD, { r: 0.95 });   // over the windshield header
    for (const s of [-1, 1]) {
        interior.add(BOX, M(s * 0.81, 1.85, 0.08, 0.06, 0.1, 2.36), HEAD, { r: 0.95 });
        interior.add(BOX, M(s * 0.86, 1.99, 0.0, 0.03, 0.3, 2.1), '#141518', { r: 0.95 }); // roof edge skin
    }
    // cowl panel (between windshield and hood)
    interior.add(BOX, M(0, 1.0, -1.88, 1.7, 0.03, 0.2), '#121315', { r: 0.8 });
    // night ambient strips (emit only with the cabin glow): along the dash trim + door belt lines
    interior.add(BOX, M(0, 0.877, -1.196, 1.5, 0.006, 0.006), '#2c4766', { e: 2.6, r: 0.5 });
    for (const s of [-1, 1]) interior.add(BOX, M(s * 0.762, 1.052, -0.75, 0.004, 0.006, 1.7), '#2c4766', { e: 1.8, r: 0.5 });
    // floor, front seats (passenger complete; driver cushion + lower back; the driver's upper back + headrest is a
    // separate mesh hidden while looking back, as if the head turned past it)
    const SEAT = '#26272b', SEAT2 = '#1c1d20', CARPET = '#141518', FAB = { r: 0.95 };
    interior.add(BOX, M(0, 0.43, -0.4, 1.56, 0.03, 2.7), CARPET, FAB);
    const driverBack = new Batch();
    for (const x of [-0.3, 0.36]) {
        interior.add(BOX, M(x, 0.56, -0.3, 0.5, 0.13, 0.52), SEAT, FAB);                       // cushion
        interior.add(BOX, M(x, 0.47, -0.3, 0.42, 0.08, 0.46), SEAT2, FAB);                     // cushion base
        const tgt = x < 0 ? driverBack : interior;
        interior.add(BOX, beamM(new THREE.Vector3(x, 0.6, 0.0), new THREE.Vector3(x, 0.92, 0.06), 0.5, 0.11), SEAT, FAB);  // lower back
        tgt.add(BOX, beamM(new THREE.Vector3(x, 0.92, 0.06), new THREE.Vector3(x, 1.24, 0.13), 0.48, 0.11), SEAT, FAB);    // upper back
        tgt.add(BOX, M(x, 1.37, 0.15, 0.26, 0.18, 0.09, -0.12), SEAT2, FAB);                   // headrest
        for (const dx of [-0.07, 0.07]) tgt.add(BOX, M(x + dx, 1.27, 0.14, 0.012, 0.08, 0.012), '#8d939a', { r: 0.3, m: 0.8 });
    }
    const interiorMat = cockpitMaterial();
    const interiorMesh = new THREE.Mesh(interior.build(), interiorMat);
    interiorMesh.name = 'interior'; interiorMesh.receiveShadow = true; g.add(interiorMesh);
    const driverBackMesh = new THREE.Mesh(driverBack.build(), interiorMat);
    driverBackMesh.name = 'driver-seat-back'; driverBackMesh.receiveShadow = true; g.add(driverBackMesh);
    g.userData.driverSeatBack = driverBackMesh;

    // ---- rear cabin (seen when looking back / around) ----
    const rear = new Batch();
    // rear bench: cushion, back, outer headrests, centre armrest seam
    rear.add(BOX, M(0, 0.57, 0.92, 1.42, 0.14, 0.52), SEAT, FAB);
    rear.add(BOX, M(0, 0.47, 0.92, 1.38, 0.08, 0.48), SEAT2, FAB);
    rear.add(BOX, beamM(new THREE.Vector3(0, 0.62, 1.22), new THREE.Vector3(0, 1.16, 1.38), 1.44, 0.13), SEAT, FAB);
    for (const x of [-0.24, 0.24]) rear.add(BOX, beamM(new THREE.Vector3(x, 0.66, 1.17), new THREE.Vector3(x, 1.12, 1.31), 0.012, 0.02), SEAT2, FAB);
    for (const x of [-0.45, 0.45]) {
        rear.add(BOX, M(x, 1.27, 1.41, 0.26, 0.15, 0.08, -0.2), SEAT2, FAB);
        for (const dx of [-0.07, 0.07]) rear.add(BOX, M(x + dx, 1.18, 1.38, 0.012, 0.07, 0.012), '#8d939a', { r: 0.3, m: 0.8 });
    }
    // parcel shelf + rear window frame (no glass: the mirror and the player look straight through)
    const rwTop = [1.17, 1.80], rwBot = [1.76, 1.15];
    rear.add(BOX, M(0, 1.135, 1.58, 1.46, 0.03, 0.4), '#18191c', FAB);
    rear.add(BOX, M(0, rwTop[1], rwTop[0], 1.4, 0.06, 0.07), HEAD, { r: 0.95 });
    rear.add(BOX, M(0, rwBot[1] + 0.02, rwBot[0], 1.42, 0.05, 0.06), '#141518', FAB);
    for (const s of [-1, 1]) {
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.66, rwTop[1], rwTop[0]), new THREE.Vector3(s * 0.7, rwBot[1], rwBot[0]), 0.05, 0.05), '#141518', FAB);
        // B-pillar (trim, beltline → roof)
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.78, 1.06, B_Z + 0.1), new THREE.Vector3(s * 0.76, 1.8, B_Z + 0.08), 0.07, 0.19), HEAD, { r: 0.9 });
        rear.add(BOX, M(s * 0.74, 1.56, B_Z + 0.06, 0.012, 0.05, 0.04), '#3a3b3e', { r: 0.6 }); // belt anchor
        // C-pillar trim panel between the rear door window and the rear glass
        rear.add(extrude([[0.98, 1.79], [rwTop[0], rwTop[1]], [rwBot[0], rwBot[1]], [1.74, 1.07], [1.22, 1.07]], s > 0 ? 0.70 : -0.85, s > 0 ? 0.85 : -0.70), IDENT, HEAD, { r: 0.92 });
        // rear door: panel, belt trim, armrest, handle, window frame (open, like the front windows)
        rear.add(extrude([[B_Z + 0.02, 0.43], [B_Z + 0.02, 1.07], [1.3, 1.07], [1.3, 0.43]], s * 0.8 - 0.03, s * 0.8 + 0.03), IDENT, SOFT, DR);
        rear.add(BOX, M(s * 0.765, 1.075, (B_Z + 1.3) / 2, 0.05, 0.03, 1.3 - B_Z), TRIM, { r: 0.5, m: 0.2 });
        rear.add(BOX, M(s * 0.72, 0.8, 0.95, 0.1, 0.06, 0.5), DASH2, DR2);
        rear.add(BOX, M(s * 0.76, 0.95, 0.6, 0.02, 0.04, 0.1), '#8d939a', { r: 0.3, m: 0.8 });
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.795, 1.655, B_Z), new THREE.Vector3(s * 0.79, 1.655, 1.05), 0.05, 0.045), HEAD, { r: 0.95 });
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.775, 1.07, 1.22), new THREE.Vector3(s * 0.755, 1.79, 0.98), 0.045, 0.04), HEAD, { r: 0.95 });
        // rear quarter panel beside the bench, wheel-arch hump
        rear.add(extrude([[1.3, 0.43], [1.3, 1.07], [1.74, 1.07], [1.86, 0.9], [1.86, 0.43]], s * 0.79 - 0.03, s * 0.79 + 0.03), IDENT, SOFT, DR);
        rear.add(BOX, M(s * 0.7, 0.62, 1.3, 0.14, 0.2, 0.5), SOFT, DR);
    }
    // roof headliner over the rear cabin + dome light
    rear.add(BOX, M(0, 1.83, 0.93, 1.5, 0.04, 0.58), HEAD, { r: 0.95 });
    rear.add(BOX, M(0, 1.806, 0.55, 0.18, 0.012, 0.08), '#d9d6cf', { e: 0.25, r: 0.6 });
    rear.add(BOX, M(0, 0.43, 0.95, 1.56, 0.03, 1.1), CARPET, FAB); // rear floor
    rear.add(BOX, M(0, 0.5, 0.35, 0.3, 0.12, 0.5), DASH2, DR2);       // tunnel / rear console end
    const rearMesh = new THREE.Mesh(rear.build(), interiorMat);
    rearMesh.name = 'rear-cabin'; rearMesh.receiveShadow = true; g.add(rearMesh);
    g.userData.rearCabin = rearMesh;

    // ---- hood (painted, tapered toward the nose) ----
    const hoodGeo = extrude([[-1.86, 1.0], [-3.3, 0.88], [-3.42, 0.8], [-3.4, 0.6], [-1.86, 0.6]], -0.87, 0.87, (x, y, z) => 1 - 0.12 * THREE.MathUtils.clamp((-z - 1.86) / 1.5, 0, 1));
    const hood = new THREE.Mesh(hoodGeo, track(new THREE.MeshStandardMaterial({ color: '#b3262b', roughness: 0.34, metalness: 0.3 })));
    hood.material.userData.envScale = 0.55; hood.receiveShadow = true; hood.name = 'hood'; g.add(hood);
    g.userData.hood = hood;
    g.userData.extent = { front: 3.42, rear: 2.36, half: 0.9 }; // (body from the eye: hood nose / boot / sides — the player's collision body)
    // trunk lid behind the rear window
    const trunk = new THREE.Mesh(extrude([[1.74, 1.12], [2.25, 1.04], [2.36, 0.92], [2.36, 0.6], [1.74, 0.6]], -0.82, 0.82), hood.material);
    trunk.receiveShadow = true; trunk.name = 'trunk'; g.add(trunk);

    // ---- shadow proxy (lower body + roof + pillars): casts the car's shadow, never drawn (stays on layer 0) ----
    const proxyB = new Batch();
    proxyB.add(BOX, M(0, 0.62, -0.2, 1.78, 0.66, 4.4));
    proxyB.add(BOX, M(0, 1.8, 0.05, 1.5, 0.06, 2.4)); // roof incl. the rear cabin
    for (const s of [-1, 1]) proxyB.add(BOX, beamM(new THREE.Vector3(s * 0.79, 1.05, -1.79), new THREE.Vector3(s * 0.72, 1.76, -1.14), 0.08, 0.08));
    for (const s of [-1, 1]) proxyB.add(BOX, M(s * 0.78, 1.4, B_Z + 0.09, 0.06, 0.75, 0.19));  // B-pillars
    for (const s of [-1, 1]) proxyB.add(BOX, M(s * 0.76, 1.4, 1.35, 0.06, 0.72, 0.5));   // C-pillars
    const proxy = new THREE.Mesh(proxyB.build(false), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    proxy.castShadow = true; proxy.renderOrder = -10; proxy.name = 'shadow-proxy'; g.add(proxy);

    // ---- steering wheel (low enough that the cluster reads over the rim) ----
    const wb = new Batch(), WR = WHEEL.r;
    wb.add(new THREE.TorusGeometry(WR, WHEEL.tube, 7, 28), IDENT, '#151619', { r: 0.65 });
    wb.add(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 12), M(0, 0, 0.012, 1, 1, 1, Math.PI / 2), '#1d1f22', { r: 0.7 });
    wb.add(BOX, M(0, -0.005, 0.04, 0.09, 0.07, 0.012), '#25282c', { r: 0.6 }); // airbag pad (logo-less)
    for (const a of [0, Math.PI, -Math.PI / 2]) {
        const r = WR * 0.65, l = WR * 0.7, vert = a === -Math.PI / 2;
        wb.add(BOX, M(Math.cos(a) * r, Math.sin(a) * r * (vert ? 0.95 : 1) - (vert ? 0 : 0.02), 0.01, vert ? 0.05 : l, vert ? l : 0.05, 0.02), '#1d1f22', { r: 0.6 });
    }
    wb.add(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 8), M(0, 0, -0.18, 1, 1, 1, Math.PI / 2), '#141517', { r: 0.8 }); // column
    const wheel = new THREE.Group();
    const wheelMat = cockpitMaterial(WHEEL.pos);
    const wheelMesh = new THREE.Mesh(wb.build(), wheelMat);
    wheelMesh.name = 'steering-wheel';
    wheel.add(wheelMesh);
    wheel.position.copy(WHEEL.pos); wheel.rotation.x = WHEEL.tilt;
    g.add(wheel);
    g.userData.wheel = wheel;

    let last = { s: -1, r: -1, f: -1, u: null }, lastT = 0;
    g.userData.updateGauges = (speedMs, rpm01 = 0.1, fuel01 = 0.7, mph = false) => {
        const now = performance.now();
        const s = Math.round(Math.abs(speedMs) * 3.6), r = Math.round(rpm01 * 80), f = Math.round(fuel01 * 50);
        if (s === last.s && r === last.r && f === last.f && mph === last.u) return;
        if (now - lastT < 66) return; // ≤ 15 Hz uploads
        lastT = now; last = { s, r, f, u: mph };
        drawGauges(gctx, speedMs, rpm01, fuel01, mph); gtex.needsUpdate = true;
    };

    // ---- rear-view mirror placement (the mirror glass + its camera live in player.js) ----
    {
        const q = new THREE.Quaternion().setFromEuler(faceEyeEuler(MIRROR.pos));
        // housing: black plastic shell around / behind the glass (player.js draws the glass + its thin frame), rounded ends
        const hb = new Batch(), nrm = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        const hm = (off, sx, sy, sz) => new THREE.Matrix4().compose(MIRROR.pos.clone().addScaledVector(nrm, off), q, new THREE.Vector3(sx, sy, sz));
        hb.add(BOX, hm(-0.02, MIRROR.w + 0.026, MIRROR.h + 0.026, 0.026), '#121315', { r: 0.45, m: 0.1 });
        hb.add(BOX, hm(-0.042, MIRROR.w - 0.02, MIRROR.h - 0.01, 0.03), '#141517', { r: 0.6 });
        for (const sx of [-1, 1]) {
            const c = new THREE.CylinderGeometry((MIRROR.h + 0.026) / 2, (MIRROR.h + 0.026) / 2, 0.026, 10);
            const end = MIRROR.pos.clone().addScaledVector(nrm, -0.02).add(new THREE.Vector3(sx * (MIRROR.w / 2 + 0.013), 0, 0).applyQuaternion(q));
            hb.add(c, new THREE.Matrix4().compose(end, q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))), new THREE.Vector3(1, 1, 1)), '#121315', { r: 0.45, m: 0.1 });
        }
        const housing = new THREE.Mesh(hb.build(), interiorMat); housing.name = 'mirror-housing'; g.add(housing);
        g.userData.mirrorMount = {
            position: MIRROR.pos.clone(), quaternion: q, width: MIRROR.w, height: MIRROR.h,
            // camera: centred, under the roof, looking straight back through the rear window; nothing of the car is
            // drawn for it (every cockpit mesh is on layer 1, the mirror camera renders layer 0 only)
            camPosition: new THREE.Vector3(0, 1.52, 0.9), camRotation: new THREE.Euler(-0.04, Math.PI, 0, 'YXZ'), camFov: 30,
        };
    }

    // ---- wipers (in the windshield plane) ----
    // plane basis: u = +x, s = up the glass, n = cross(u, s) (points into the cabin)
    const nIn = new THREE.Vector3(1, 0, 0).cross(sAxis).normalize();
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), sAxis, nIn);
    const wiperDefs = [{ px: -0.55, ps: 0.03, len: 0.72 }, { px: 0.12, ps: 0.03, len: 0.66 }];
    const wiperMat = new THREE.MeshStandardMaterial({ color: '#0e0f11', roughness: 0.6, metalness: 0.3 });
    const wipers = wiperDefs.map((d) => {
        const base = new THREE.Group();
        base.position.copy(cowl).addScaledVector(new THREE.Vector3(1, 0, 0), d.px).addScaledVector(sAxis, d.ps).addScaledVector(nIn, -0.025);
        base.quaternion.setFromRotationMatrix(basis);
        const arm = new THREE.Group(); base.add(arm);
        const ab = new Batch();
        ab.add(BOX, M(d.len * 0.5, 0, 0, d.len, 0.014, 0.012));
        ab.add(BOX, M(d.len * 0.55, 0.012, -0.008, d.len * 0.86, 0.02, 0.014));
        ab.add(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8), M(0, 0, 0, 1, 1, 1, Math.PI / 2));
        const mesh = new THREE.Mesh(ab.build(false), wiperMat);
        arm.add(mesh); g.add(base);
        return { ...d, base, arm };
    });
    // wiper timing (shared with the windshield rain shader): linear sweep up, linear back, pause
    const W_A0 = 0.04, W_A1 = 1.72, W_SWEEP = 0.42, W_PERIOD = 1.7;
    const ws = { on: false, t: 0, rainT: 0, a0: W_A0, a1: W_A1, sweep: W_SWEEP, period: W_PERIOD };
    const angleAt = (ct) => {
        if (ct < W_SWEEP) return W_A0 + (W_A1 - W_A0) * (ct / W_SWEEP);
        if (ct < 2 * W_SWEEP) return W_A1 - (W_A1 - W_A0) * ((ct - W_SWEEP) / W_SWEEP);
        return W_A0;
    };
    let parking = false;
    g.userData.setRain = (on) => { if (on && !ws.on) { ws.t = 0; ws.rainT = 0; } ws.on = !!on; parking = !on; };
    let homeT = 0;
    g.userData.tick = (dt) => {
        if ((homeT -= dt) <= 0) { homeT = 5; if (home.draw()) htex.needsUpdate = true; }
        if (ws.on) { ws.t = (ws.t + dt) % W_PERIOD; ws.rainT += dt; }
        else if (parking) { // finish the current sweep, then park
            if (ws.t > 0 && ws.t < 2 * W_SWEEP) ws.t = Math.min(2 * W_SWEEP, ws.t + dt); else parking = false;
        }
        const a = angleAt(ws.t);
        for (const w of wipers) w.arm.rotation.z = a;
    };
    g.userData.tick(0);
    g.userData.wiperState = ws;
    /** scale direct lighting on the interior (1 = day; ~0.3 at night so street lamps don't light the cabin through the roof) */
    g.userData.setInteriorLight = (k) => { interiorMat.userData.uDirect.value = wheelMat.userData.uDirect.value = k; };
    /** night cabin glow 0..1 (instrument + screen backlight, dim cabin fill, ambient strips) */
    g.userData.setNightGlow = (k) => { interiorMat.userData.uGlow.value = wheelMat.userData.uGlow.value = k; screenMat.userData.uScreen.value.set(1 - 0.3 * k, 0.035 * (1 - k)); }; // screen: dimmed at night, faint daylight veil by day

    // ---- headlights: two warm spot lights + emissive lamp boxes. Keep the light layout stable when off. ----
    const lampMat = new THREE.MeshStandardMaterial({ color: '#cfd5db', emissive: '#fff0d2', emissiveIntensity: 0, roughness: 0.15, metalness: 0.2 });
    const spots = [];
    for (const s of [-1, 1]) {
        const lamp = new THREE.Mesh(BOX, lampMat); lamp.scale.set(0.34, 0.11, 0.06); lamp.position.set(s * 0.6, 0.73, -3.4); g.add(lamp);
        const sp = new THREE.SpotLight('#ffe6bf', 0, 60, 0.42, 0.55, 1.5);
        sp.position.set(s * 0.6, 0.75, -3.45); sp.target.position.set(s * 0.9, 0, -26);
        sp.castShadow = false; sp.userData.shared = true; // no spot shadow (cost + shimmer)
        g.add(sp, sp.target); spots.push(sp);
    }
    g.userData.headlights = {
        spots, on: false,
        /** on/off; intensity in candela (physically based lights) */
        setOn(on, intensity = 140) {
            this.on = !!on;
            // Changing visible light counts recompiles every lit material on the first toggle.
            for (const sp of spots) { sp.visible = true; sp.intensity = this.on ? intensity : 0; }
            lampMat.emissiveIntensity = this.on ? 5 : 0;
        },
    };
    /**
     * Driving view per viewport aspect (camera = player.js camHolder child). Landscape: the layout above (eye at EYE, FOV 72).
     * Portrait phones (aspect < 1): the eye moves back / up / toward the centre, the view turns 9° right and the vertical FOV
     * opens to ~92° so the cluster AND the nav screen sit in the lower third, between the top HUD cards and the touch pad.
     * Touch uses 3° less vertical FOV in either orientation for slightly larger instruments; desktop stays unchanged.
     * → { fov (vertical, °, at rest; add the speed zoom on top), yaw (rad, + = left), pitch (rad), eye: Vector3 offset }
     */
    const _pv = { fov: 72, yaw: 0, pitch: 0, eye: new THREE.Vector3() };
    g.userData.viewFor = (aspect = 16 / 9, touch = false) => {
        const a = THREE.MathUtils.clamp((1 - aspect) / (1 - 390 / 844), 0, 1);
        _pv.fov = 72 + 20 * a - (touch ? 3 : 0); _pv.yaw = -9 * D2R * a; _pv.pitch = 0; _pv.eye.set(0.07 * a, 0.05 * a, 0.2 * a);
        return _pv;
    };
    g.userData.windshield = { origin: cowl.clone(), u: new THREE.Vector3(1, 0, 0), s: sAxis.clone(), len: wsLen, halfW0, halfW1, wipers: wiperDefs };
    // Every visible cockpit mesh lives on layer 1: the main camera renders layers 0 + 1 (render.js), the rear-view
    // mirror camera only layer 0, so no part of the car can ever show up in the mirror. The invisible shadow proxy
    // stays on layer 0 (shadow casting). Raycasts against the cockpit need raycaster.layers.enable(1).
    g.traverse((o) => { if ((o.isMesh || o.isLine || o.isPoints) && o !== proxy) o.layers.set(1); });
    return g;
}
