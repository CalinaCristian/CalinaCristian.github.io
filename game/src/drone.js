// ============================================================================
//  DRONE (note 74, explore lane) — "Deploy drone" on foot, in the districts and in the tourist spots
//  (never indoors / under cover): lift-off from the player's hand → drone camera with its own HUD
//  (altitude, distance from you, battery, horizon, REC), procedural rotor audio pitched with speed + wind,
//  sway + gimbal, adjustable speed, range limit + return-home, battery, photo mode through PhotoMode's
//  public API, landing back in the hand. One extra mesh group (the drone + a home marker), no extra pass.
//
//  new Drone(game, { onEvent }) · canDeploy() → { ok, reason } · deploy() · land() · returnHome() · abort()
//  frame(dt) → true when the drone owns this frame (explore.js calls it from its loop hook)
// ============================================================================
import * as THREE from '../vendor/three.module.min.js';
import { collideBuildings } from './world.js';
import { createFlightBoundary, spotFlightSource, FLIGHT_GRACE } from './drone-boundary.js';
import { makeCrowd, dressFor, seasonOf, CROWD_FLAGS } from './crowd.js';

const flightBoundaries = new WeakMap();
function flightBoundary(scene, source) {
    if (!flightBoundaries.has(scene)) flightBoundaries.set(scene, createFlightBoundary(source));
    return flightBoundaries.get(scene);
}

const DEG = Math.PI / 180;
const MODES = [
    { id: 'C', name: 'Cine', h: 4 },
    { id: 'N', name: 'Normal', h: 12 },
    { id: 'S', name: 'Sport', h: 26 },
];
const BOOST = 1.8;                // Shift: Sport + boost ≈ 47 m/s — fast enough to cross a district in half a minute
const COLLISION_STEP = 0.35;      // no movement step skips a thin roof band, wall or the drone's collision radius
const RANGE = { district: 800, spot: 450 };
const CEIL_M = 120;               // EU open category: 120 m above ground; FAA recreational: 400 ft (121.9 m)
const BATTERY_S = 10 * 60;        // ~10 min of hover; faster flight drains faster
const RTH_LOW = 0.15;             // smart return-to-home at 15 %
const EYE = 1.65;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const store = {
    get() { try { return JSON.parse(localStorage.getItem('dmcv.explore.v1') || '{}'); } catch { return {}; } },
    set(v) { try { localStorage.setItem('dmcv.explore.v1', JSON.stringify(v)); } catch { /* private mode */ } },
};

// ---------------------------------------------------------------------------- model
function buildDroneModel() {
    const g = new THREE.Group(); g.name = 'drone';
    const dark = new THREE.MeshLambertMaterial({ color: '#30343a' }), grey = new THREE.MeshLambertMaterial({ color: '#8b9097' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.16), grey); g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.02, 0.1), dark); top.position.set(0, 0.03, -0.01); g.add(top);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.03), dark); cam.position.set(0, -0.03, -0.085); g.add(cam);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.009, 12), new THREE.MeshBasicMaterial({ color: '#0b1220' })); lens.position.set(0, -0.03, -0.101); lens.rotation.y = Math.PI; g.add(lens);
    const rotors = [];
    const discMat = new THREE.MeshBasicMaterial({ color: '#d7dbe0', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
    const bladeMat = new THREE.MeshLambertMaterial({ color: '#1f2328' });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.12), dark);
        arm.position.set(sx * 0.07, 0.005, sz * 0.06); arm.rotation.y = Math.atan2(sx, sz); g.add(arm);
        const hub = new THREE.Group(); hub.position.set(sx * 0.11, 0.025, sz * 0.1); g.add(hub);
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.022, 10), dark); hub.add(motor);
        const blades = new THREE.Group(); blades.position.y = 0.014; hub.add(blades);
        for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.002, 0.012), bladeMat); b.rotation.y = i * Math.PI; b.position.x = 0; blades.add(b); }
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.068, 20), discMat); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.015; hub.add(disc);
        rotors.push({ blades, dir: sx * sz });
        // navigation LEDs: front red/green arms, rear white
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: sz < 0 ? (sx < 0 ? '#ef4444' : '#22c55e') : '#f8fafc' }));
        led.position.set(sx * 0.11, -0.012, sz * 0.1); g.add(led);
    }
    g.userData.rotors = rotors; g.userData.disc = discMat;
    g.traverse((o) => { o.frustumCulled = false; o.renderOrder = 2; });
    return g;
}
/** where you stand while the drone is up: a small figure + a pulsing "H" pad ring */
function buildHomeMarker(city, season) {
    const g = new THREE.Group(); g.name = 'drone-home';
    // The pilot shares the NPC body, face, clothes and phone pose, without crowd AI.
    // Stable identity and palette across flights; only city/season clothing changes.
    const pilot = makeCrowd({ max: 1, city, season, rng: () => 0.42 });
    const outfit = dressFor(city, season, null, () => 0.42);
    outfit.skin = '#e8bc9a'; outfit.hair = '#3b2a1e';
    outfit.flags &= CROWD_FLAGS.coat | CROWD_FLAGS.hat | CROWD_FLAGS.shortSleeves;
    pilot.dress(0, outfit); pilot.count = 1;
    pilot.set(0, { pose: 'phone', prop: 'phone', amp: 0 });
    pilot.object.name = 'drone-pilot'; g.add(pilot.object);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.85, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.75, 40), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    const hTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fbbf24'; x.font = 'bold 52px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', 32, 35); return new THREE.CanvasTexture(c); })();
    const h = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: hTex, transparent: true, depthWrite: false })); h.rotation.x = -Math.PI / 2; h.position.set(0, 0.07, 1.2); g.add(h);
    g.userData.ring = ring; g.userData.figure = [pilot.object]; g.userData.pilot = pilot;
    g.userData.dispose = () => {
        pilot.dispose(); ring.geometry.dispose(); ringMat.dispose();
        h.geometry.dispose(); h.material.dispose(); hTex.dispose();
    };
    return g;
}

// ---------------------------------------------------------------------------- rotor sound (WebAudio, procedural)
class RotorSound {
    constructor(audio) { this.audio = audio; this.on = false; }
    start() {
        const a = this.audio, ctx = a?.ctx; if (!ctx || this.on) return;
        try {
            const out = ctx.createGain(); out.gain.value = 0; out.connect(a.master || ctx.destination);
            // blade-pass buzz: two detuned saws through a band-pass, a soft square an octave up
            const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
            o1.type = 'triangle'; o2.type = 'triangle'; o3.type = 'sine'; // (soft hum — round 6: the saw/square buzz was grating)
            o1.frequency.value = 40; o2.frequency.value = 40; o3.frequency.value = 80;
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.8;
            const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
            const g3 = ctx.createGain(); g3.gain.value = 0.06;
            o1.connect(bp); o2.connect(bp); o3.connect(g3).connect(bp); bp.connect(lp).connect(out);
            // a slow wobble (rotors drifting in and out of phase)
            const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 3.1; lg.gain.value = 3; lfo.connect(lg); lg.connect(o2.frequency);
            // wind / air rush: looped noise through a band-pass
            const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
            let b = 0; for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6; }
            const nz = ctx.createBufferSource(); nz.buffer = buf; nz.loop = true;
            const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 700; nf.Q.value = 0.6;
            const ng = ctx.createGain(); ng.gain.value = 0; nz.connect(nf).connect(ng).connect(out);
            for (const o of [o1, o2, o3, lfo, nz]) o.start();
            this.n = { ctx, out, o1, o2, o3, bp, nf, ng, list: [o1, o2, o3, lfo, nz] }; this.on = true;
        } catch (e) { console.warn('[drone] audio', e); }
    }
    /** spin 0..1 (rotor speed), load 0..1 (speed / climb), wind 0..1 */
    set(spin, load, wind) {
        const n = this.n; if (!n) return; const t = n.ctx.currentTime;
        const f = 70 + spin * (80 + load * 70); // blade-pass ~150–220 Hz in flight (lower, less whiny)
        n.o1.frequency.setTargetAtTime(f, t, 0.12); n.o2.frequency.setTargetAtTime(f * 1.013, t, 0.12); n.o3.frequency.setTargetAtTime(f * 2, t, 0.12);
        n.bp.frequency.setTargetAtTime(260 + load * 280, t, 0.2);
        n.out.gain.setTargetAtTime(0.075 * spin * (0.75 + 0.25 * load), t, 0.15); // (was 0.22: too loud)
        n.ng.gain.setTargetAtTime(0.1 * spin * load + 0.12 * wind * spin + 0.04 * spin, t, 0.25); // (air rush carries the motion)
        n.nf.frequency.setTargetAtTime(500 + load * 900 + wind * 300, t, 0.3);
    }
    stop() {
        const n = this.n; if (!n) return; this.n = null; this.on = false;
        try { n.out.gain.setTargetAtTime(0, n.ctx.currentTime, 0.08); setTimeout(() => { for (const o of n.list) { try { o.stop(); } catch { /* ignore */ } } n.out.disconnect(); }, 600); } catch { /* ignore */ }
    }
}

// ---------------------------------------------------------------------------- HUD
const HUD_HTML = `
<div class="dr-frame"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i></div>
<div class="dr-top">
  <span class="dr-rec"><i></i>REC <b class="dr-time">00:00</b></span>
  <span class="dr-chip dr-mode" title="Speed mode — mouse wheel or 1 / 2 / 3">N</span>
  <span class="dr-chip dr-gps">GPS <b>▮▮▮▮</b></span>
  <span class="dr-chip dr-wind">Wind —</span>
  <span class="dr-bat"><span class="dr-batbar"><i></i></span><b class="dr-batpct">100%</b><small class="dr-battime">10:00</small></span>
</div>
<canvas class="dr-compass" width="360" height="34"></canvas>
<div class="dr-horizon"><div class="dr-hline"><i></i><i></i></div><div class="dr-reticle"><i></i><b></b><i></i></div><div class="dr-gimbal"><i></i><span>0°</span></div></div>
<div class="dr-left"><div class="dr-lbl">ALT</div><div class="dr-big dr-alt">0</div><div class="dr-unit dr-altu">m</div><div class="dr-sub">V.S <b class="dr-vs">0.0</b></div></div>
<div class="dr-right"><div class="dr-lbl">DIST</div><div class="dr-big dr-dist">0</div><div class="dr-unit dr-distu">m</div><div class="dr-sub">H.S <b class="dr-hs">0</b> <span class="dr-hsu">m/s</span></div></div>
<div class="dr-warn" aria-live="polite"></div>
<div class="dr-bottom">
  <div class="dr-modes"><button data-dr="mode:0">Cine</button><button data-dr="mode:1">Normal</button><button data-dr="mode:2">Sport</button></div>
  <div class="dr-acts"><button data-dr="gohere" title="Go here: walk-teleport to the ground under the drone, then land (T)">⇩ Go here</button><button data-dr="rth" title="Return home (H)">⌂ Home</button><button data-dr="photo" title="Photo (P)">📷</button><button data-dr="land" class="dr-exit" title="Fly back and land in your hand (G / X)">✕ Land</button></div>
</div>
<div class="dr-stick" aria-hidden="true"><i></i></div>
<div class="dr-help">Mouse look · W/S follow view · A/D strafe · look up/down + W to climb/descend · Shift boost · 1/2/3 or wheel speed · N minimap · T go here · H home (hold land) · G/X land · P photo · Esc pause</div>`;

export class Drone {
    constructor(game, { onEvent = null, onGoHere = null } = {}) {
        this.g = game; this.onEvent = onEvent; this.onGoHere = onGoHere;
        this.active = false; this.phase = null; this.mode = 1;
        this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.gimbal = 0;
        this.tiltP = 0; this.tiltR = 0; this.t = 0; this.battery = 1;
        this.stick = { x: 0, y: 0 };
        this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._v = new THREE.Vector3();
        this.sound = new RotorSound(game.audio);
        this.stats = { ...{ flights: 0, maxDist: 0, maxAlt: 0, km: 0, photos: 0 }, ...(store.get().drone || {}) };
    }
    get flying() { return this.active && this.phase === 'fly'; }

    // ------------------------------------------------------------------ context: district on foot, or a tourist spot
    ctx() {
        const g = this.g;
        if (g.state === 'spot' && g.spot?.ctl && g.spot.spot) {
            const s = g.spot, sp = s.spot;
            return { kind: 'spot', scene: sp.scene, walker: s.ctl, session: s, colliders: sp.colliders, boundary: flightBoundary(sp, spotFlightSource(sp)), units: sp.units === 'mph' ? 'imperial' : 'metric',
                groundAt: (x, z, y) => { try { const h = sp.groundAt(x, z, y); return Number.isFinite(h) ? h : sp.ground?.heightAt?.(x, z) ?? 0; } catch { return 0; } } };
        }
        if (g.state === 'foot' && g.foot?.active && g.world) {
            const w = g.world;
            return { kind: 'district', scene: g.scene, walker: g.foot, colliders: w.buildings, boundary: flightBoundary(w, w.district?.flightBoundary), units: g.city?.units === 'mph' ? 'imperial' : 'metric',
                groundAt: (x, z, y) => { try { const h = w.roadHeight?.(x, z, { y }); return Number.isFinite(h) ? Math.max(0, h - 0.24) : 0; } catch { return 0; } } };
        }
        return null;
    }
    /** on foot (district or spot), not in a panel / photo / pause, open sky above */
    canDeploy() {
        const g = this.g;
        if (this.active) return { ok: false, reason: 'The drone is already up.' };
        if (g.state === 'office') return { ok: false, reason: 'Not indoors: walk outside first.' };
        if (g.state === 'drive') return { ok: false, reason: 'Get out of the car first (Enter).' };
        const c = this.ctx(); if (!c) return { ok: false, reason: 'Only on foot, in a district or a tourist spot.' };
        if (g.photo?.active || g.hud?.panelOpen || g._pauseOpen || c.session?.ui?.panelOpen) return { ok: false, reason: 'Close the panel first.' };
        if (c.boundary && !c.boundary.allowed(c.walker)) return { ok: false, reason: `Outside the flight area: walk back within ${FLIGHT_GRACE} m of the playable area.` };
        if (this.covered(c)) return { ok: false, reason: 'Something is overhead (a roof, a bridge or tree crowns): step out under open sky.' };
        return { ok: true };
    }
    /** a short ray straight up from the head: roofs, decks, canopies, tree crowns */
    covered(c) {
        try {
            const w = c.walker, rc = this._rc || (this._rc = new THREE.Raycaster());
            rc.set(this._v.set(w.x, (w.y || 0) + EYE + 0.4, w.z), new THREE.Vector3(0, 1, 0)); rc.near = 0; rc.far = 35; rc.camera = this.g.camera;
            const hits = rc.intersectObject(c.scene, true);
            return hits.some((h) => h.object.isMesh && h.object.visible !== false && h.object.name !== 'drone' && !/sky|cloud|rain|snow/i.test(h.object.name || '') && !(h.object.material?.name || '').match(/sky|backdrop|horizon/i));
        } catch { return false; }
    }

    // ------------------------------------------------------------------ deploy / land / abort
    deploy() {
        const chk = this.canDeploy(); if (!chk.ok) { this.toast('🚁 Can\'t take off here', chk.reason, 'warn'); return false; }
        const g = this.g;
        if (typeof g.spot?.cancelActivities === 'function') g.spot.cancelActivities('drone');
        else g.spot?.spot?.ctx?.extras?.venueActivities?.cancel('drone');
        const c = this.c = this.ctx(), w = c.walker, cam = g.camera;
        this.active = true; this.phase = 'lift'; this.t = 0; this.pt = 0; this.battery = 1; this.recT = 0; this.rth = false; this.rthPath = null; this.autoRth = false; this.maxD = 0; this.maxAlt = 0; this.dist = 0;
        this.home = { x: w.x, z: w.z, y: w.y || 0, heading: w.heading, pitch: w.pitch || 0 };
        this.yaw = w.heading; this.gimbal = 0; this.vel.set(0, 0, 0); this.tiltP = this.tiltR = 0;
        this.range = RANGE[c.kind]; this.imperial = c.units === 'imperial';
        // camera leaves the walker's head (world space); the walker freezes (its input is swapped for a dead one)
        this.saved = { fov: cam.fov, parent: cam.parent, r3dPlayer: g.r3d?.player ?? null, lookAllowed: g.input.lookAllowed };
        const eye = this._eye();
        cam.parent?.remove(cam); c.scene.add(cam);
        cam.position.copy(eye); cam.quaternion.copy(this._walkerQuat());
        this._freezeWalker(true);
        // models
        if (!this.model) this.model = buildDroneModel();
        if (!this.homeMk) this.homeMk = buildHomeMarker(c.kind === 'spot' ? c.session.spot.city : g.city?.id || 'bucharest', g.r3d?._seasonOverride || g.r3d?.weather?.season || seasonOf(g.nowDate?.()));
        c.scene.add(this.model); c.scene.add(this.homeMk);
        this.homeMk.position.set(w.x, this.home.y, w.z); this.homeMk.rotation.y = w.heading; this.homeMk.visible = false;
        this.handPos = this._hand();
        this.model.position.copy(this.handPos); this.model.rotation.set(0, w.heading, 0); this.model.visible = true; this.spin = 0;
        // renderer follows the drone (lamps / shadows around it), not the parked car or the walker
        this.proxy = { x: w.x, z: w.z, fx: -Math.sin(this.yaw), fz: -Math.cos(this.yaw), speed: 0 };
        try { g.r3d?.setPlayer?.(this.proxy); } catch { /* ignore */ }
        this._buildHud(); document.body.classList.add('drone-mode', 'drone-lift');
        g.hud?.prompt?.(null);
        g.input.flush(); g.input.lookAllowed = true;
        this.sound = new RotorSound(g.audio); g.audio?.init?.(); g.audio?.resume?.(); this.sound.start();
        this.stats.flights++; this._save();
        this.emit('deploy');
        return true;
    }
    /** H / ⌂: fly back over you and land */
    returnHome(auto = false) {
        if (!this.active || this.phase !== 'fly') return;
        const dock = this._returnDock(), boundary = this.c.boundary;
        this.rthPath = boundary ? boundary.route(this.pos, dock, { home: this.home, range: this.range }) : [{ x: dock.x, z: dock.z }];
        if (!this.rthPath) { this.rth = false; this.warn('No safe route home — fly back toward the playable area', 3, 'hot'); return; }
        this.rthAltitude = Math.max(this.pos.y, this.home.y + 30);
        this.rth = true; this.autoRth = auto; this.warn(auto ? 'Battery low — returning home' : 'Returning home', 2.5);
    }
    _returnDock() {
        const h = this.home, dock = new THREE.Vector3(h.x - Math.sin(h.heading) * 2.4, h.y + EYE + 2.6, h.z - Math.cos(h.heading) * 2.4);
        this.c.boundary?.project(dock); return dock;
    }
    /** G / ⤓: come back and land in your hand (RTH, then the dock animation) */
    land() { if (!this.active) return; if (this.phase === 'fly') this.returnHome(false); else if (this.phase === 'lift') { this.phase = 'fly'; this.returnHome(false); } }
    /** T / ⇩: scout-and-travel — you are moved (on foot) to walkable ground under the drone, then it lands in your hand */
    async goHere() {
        if (!this.active || this.phase !== 'fly' || this._going) return false;
        const c = this.c, x = this.pos.x, z = this.pos.z;
        this._going = true;
        let r = null;
        try { r = await this.onGoHere?.(x, z, c.kind); } catch (e) { console.warn('[drone] go here', e); }
        this._going = false;
        if (!this.active || !r) { this.warn(r === null ? 'No walkable ground below — fly over a street, square or path' : 'Can\'t go there', 2.2, 'hot'); return false; }
        const w = c.walker; w.heading = this.yaw; w.pitch = -0.1;
        this.home = { x: w.x, z: w.z, y: w.y || 0, heading: this.yaw, pitch: -0.1 };
        this.homeMk.position.set(w.x, this.home.y, w.z); this.homeMk.rotation.y = this.yaw;
        this.lastGo = { x: w.x, z: w.z, fromX: x, fromZ: z };
        this.emit('gohere', { dist: Math.round(Math.hypot(x - w.x, z - w.z)) });
        this._startDock();
        return true;
    }
    /** hold H: land at once (back to the walker's eyes, no flight home / landing animation) */
    quickLand() {
        if (!this.active) return;
        this.stats.maxDist = Math.max(this.stats.maxDist, Math.round(this.maxD || 0)); this.stats.maxAlt = Math.max(this.stats.maxAlt, Math.round(this.maxAlt || 0)); this.stats.km = +(this.stats.km + (this.dist || 0) / 1000).toFixed(2);
        this.toast('🚁 Drone landed', 'Quick landing (hold H)');
        this.abort(); this._hHold = 0; this._hQuick = false;
    }
    /** instant: back to the walker's eyes (a jump / a menu action while the drone is up) */
    abort() {
        if (!this.active) return;
        const g = this.g, c = this.c, cam = g.camera;
        if (g.photo?.active) { try { g.photo.close(); } catch { /* ignore */ } }
        this.model?.parent?.remove(this.model); this.homeMk?.parent?.remove(this.homeMk);
        this.homeMk?.userData.dispose?.(); this.homeMk = null;
        cam.parent?.remove(cam);
        const w = c?.walker;
        if (w?.rig && w.active !== false) { w.rig.add(cam); cam.position.set(0, 0, 0); cam.rotation.set(0, 0, 0); }
        else if (this.saved?.parent) { this.saved.parent.add(cam); cam.position.set(0, 0, 0); cam.rotation.set(0, 0, 0); }
        if (this.saved) { cam.fov = this.saved.fov; cam.updateProjectionMatrix(); try { g.r3d?.setPlayer?.(this.saved.r3dPlayer); } catch { /* ignore */ } }
        this._freezeWalker(false);
        this.sound.stop();
        this.active = false; this.phase = null; this.c = null;
        document.body.classList.remove('drone-mode', 'drone-lift', 'drone-dock');
        this.hudEl?.classList.remove('show');
        g.input.flush(); g.frameClock?.getDelta?.();
        this._save();
        this.emit('land', { dist: Math.round(this.maxD), alt: Math.round(this.maxAlt) });
    }

    // ------------------------------------------------------------------ per frame
    frame(dt) {
        if (!this.active) return false;
        const g = this.g, c = this.c;
        if (!c || (c.kind === 'spot' && g.state !== 'spot') || (c.kind === 'district' && g.state !== 'foot')) { this.abort(); return false; }
        // timeline in real time (≤ 0.25 s per frame, so a slow frame does not stretch the lift-off), physics in ≤ 50 ms steps
        const dtT = Math.min(dt, 0.25); dt = Math.min(dtT, 0.05); this.t += dtT;
        const steps = Math.max(1, Math.round(dtT / 0.05));
        const inp = g.input;
        if (inp.take('Escape')) { g.togglePause?.(true); return true; }
        if (inp.take('KeyN') && g.opts) { g.opts.minimap = !g.opts.minimap; g.saveOpt?.('minimap', g.opts.minimap); g.applyOpts?.(); } // N: minimap on / off here too (after round 6)
        { // H: tap = return home (flown back + landing animation); hold ≥ 0.6 s = land right here, no animation (round 6 note 18)
            const held = inp.keys?.has?.('KeyH'); inp.take('KeyH');
            // (after round 6) the hold shows a progress ring (same as hold-F fast travel); a short tap still returns home
            let ring = document.getElementById('ft-hold'); if (!ring) { ring = document.createElement('div'); ring.id = 'ft-hold'; ring.innerHTML = '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="bg"/><circle cx="22" cy="22" r="18" class="fg"/></svg><span></span>'; document.body.appendChild(ring); }
            if (held && (this._hHold || 0) > 0.12 && !this._hQuick) { ring.classList.add('on'); ring.querySelector('span').textContent = 'Hold H · land here'; ring.querySelector('.fg').style.strokeDashoffset = String(113.1 * (1 - Math.min(1, this._hHold / 0.8))); } else ring.classList.remove('on');
            if (held) { this._hHold = (this._hHold || 0) + dtT; if (this._hHold >= 0.8 && !this._hQuick) { this._hQuick = true; ring.classList.remove('on'); this.quickLand(); return true; } }
            else if (this._hHold) { const tap = !this._hQuick; this._hHold = 0; this._hQuick = false; if (tap) this.returnHome(false); }
        }
        const w = c.walker;
        // keep the world alive around the frozen walker
        if (c.kind === 'district') {
            g.frame = (g.frame || 0) + 1;
            g.updateClock?.(dt); if (g.frame % 30 === 0) g.pollWeather?.();
            try { g.traffic?.setHour(g.trafficHours()); g.traffic?.update(dt); } catch (e) { console.warn('[drone] traffic', e); }
            if (g.carBody) g.carBody.userData.setLights?.(((g.clock.date?.getTime?.() ?? performance.now()) / 400 | 0) % 2 === 0);
            if (g.frame % 2 === 0) try { g.drawMiniAt?.(this.pos.x, this.pos.z, this.yaw, 0.2); } catch { /* no minimap */ } // the minimap follows the drone (round 6 note 43)
        }
        if (this.phase === 'lift') this._lift(dt);
        else if (this.phase === 'fly') { for (let i = 0; i < steps && this.phase === 'fly'; i++) this._fly(dtT / steps); }
        else if (this.phase === 'dock') this._dock(dt);
        if (!this.active) return false;
        if (c.kind === 'district' && !g.photo?.active) g.football?.update(dtT, this);
        // rotors
        if (this.model?.visible) { for (const r of this.model.userData.rotors) r.blades.rotation.y += r.dir * this.spin * 95 * dt; this.model.userData.disc.opacity = 0.32 * clamp(this.spin * 1.4 - 0.3, 0, 1); for (const r of this.model.userData.rotors) r.blades.visible = this.spin < 0.65; }
        if (this.homeMk) { const r = this.homeMk.userData.ring; r.material.opacity = 0.55 + 0.35 * Math.sin(this.t * 4); }
        // the scene (spot crowd / animations) — with the walker frozen
        if (c.kind === 'spot') { try { c.session.update(dt); } catch (e) { console.warn('[drone] spot update', e); } }
        this.proxy.x = this.pos.x; this.proxy.z = this.pos.z; this.proxy.fx = -Math.sin(this.yaw); this.proxy.fz = -Math.cos(this.yaw); this.proxy.speed = Math.hypot(this.vel.x, this.vel.z);
        this._hudUpdate(dt);
        const wind = this._wind();
        this.sound.set(this.spin, clamp(Math.hypot(this.vel.x, this.vel.z) / 30 + Math.abs(this.vel.y) / 10, 0, 1), clamp(wind.kmh / 40, 0, 1));
        if (c.kind === 'district') g.drawFrame(); else g.r3d.frame();
        void w;
        return true;
    }
    _eye() { const w = this.c.walker; return new THREE.Vector3(w.x, (w.y || 0) + EYE, w.z); }
    _walkerQuat() { const h = this.home; this._e.set(h.pitch || 0, h.heading, 0, 'YXZ'); return new THREE.Quaternion().setFromEuler(this._e); }
    _hand() { const h = this.home, fx = -Math.sin(h.heading), fz = -Math.cos(h.heading); return new THREE.Vector3(h.x + fx * 0.6 + fz * 0.06, h.y + EYE - 0.3, h.z + fz * 0.6 - fx * 0.06); }
    _droneQuat(sway = true) {
        const s = sway ? this._sway() : { p: 0, y: 0, r: 0 };
        this._e.set(this.gimbal + s.p + this.tiltP * 0.08, this.yaw + s.y, this.tiltR * 0.12 + s.r, 'YXZ');
        return this._q.setFromEuler(this._e);
    }
    /** yaw / pitch blend (shortest yaw), roll eased to the target's — no barrel roll when the yaws are far apart */
    _blend(out, qa, qb, k) {
        const a = (this._ea || (this._ea = new THREE.Euler(0, 0, 0, 'YXZ'))).setFromQuaternion(qa, 'YXZ'), b = (this._eb || (this._eb = new THREE.Euler(0, 0, 0, 'YXZ'))).setFromQuaternion(qb, 'YXZ');
        let dy = b.y - a.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this._e.set(lerp(a.x, b.x, k), a.y + dy * k, lerp(a.z, b.z, k), 'YXZ');
        return out.setFromEuler(this._e);
    }
    _wind() {
        const w = this.g.r3d?.weather; const kmh = Number.isFinite(w?.windKmh) ? w.windKmh : 8;
        const dir = Number.isFinite(w?.windDir) ? w.windDir * DEG : 0.8;
        return { kmh, x: Math.sin(dir) * kmh / 3.6, z: -Math.cos(dir) * kmh / 3.6 };
    }
    _sway() {
        const t = this.t, k = 0.0035 + clamp(this._wind().kmh, 0, 60) * 0.00018, sp = Math.hypot(this.vel.x, this.vel.z);
        const a = k * (1 + sp / 30);
        return { p: a * (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.9 + 1) * 0.4), y: a * 0.5 * Math.sin(t * 0.9 + 2), r: a * (Math.sin(t * 2.3 + 0.5) * 0.7 + Math.sin(t * 5.1) * 0.3) };
    }
    _lift(dt) {
        const g = this.g, cam = g.camera, T = 2.9, u = this.t / T, h = this.home;
        const eye = this._eye(), fx = -Math.sin(h.heading), fz = -Math.cos(h.heading);
        const up = new THREE.Vector3(h.x + fx * 1.3, h.y + EYE + 1.9, h.z + fz * 1.3);
        const fly0 = new THREE.Vector3(h.x + fx * 1.6, h.y + EYE + 7, h.z + fz * 1.6);
        this.spin = ease(this.t / 0.8);
        // model: hand → up (0.6–1.5 s) → flight start (to 2.9 s)
        const m = this.model.position;
        if (this.t < 0.6) m.copy(this.handPos).y += Math.sin(this.t * 30) * 0.002 * this.spin;
        else if (this.t < 1.5) m.lerpVectors(this.handPos, up, ease((this.t - 0.6) / 0.9));
        else m.lerpVectors(up, fly0, ease((this.t - 1.5) / 1.4));
        this.model.rotation.set(0, h.heading, 0);
        // camera: look up at it, then follow it up into the drone view
        const lookAt = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, m, new THREE.Vector3(0, 1, 0)));
        const q0 = this._walkerQuat();
        this.yaw = h.heading; this.gimbal = 0;
        if (this.t < 1.4) { cam.position.copy(eye); const qh = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, this.handPos.clone().add(new THREE.Vector3(0, 0.12, 0)), new THREE.Vector3(0, 1, 0))); cam.quaternion.copy(q0).slerp(qh, 0.55 * ease(this.t / 0.4)).slerp(lookAt, ease((this.t - 0.5) / 0.9)); }
        else {
            const k = ease((this.t - 1.4) / 1.5);
            cam.position.lerpVectors(eye, m, k);
            this._blend(cam.quaternion, lookAt, this._droneQuat(false).clone(), k);
        }
        this.model.visible = cam.position.distanceTo(m) > 0.35;
        this.homeMk.visible = cam.position.distanceTo(eye) > 2.5;
        for (const f of this.homeMk.userData.figure) f.visible = this.homeMk.visible;
        if (this.t > 2.2) document.body.classList.remove('drone-lift');
        if (u >= 1) { this.phase = 'fly'; this.pos.copy(fly0); this.c.boundary?.constrain(this.pos, this.vel); this.model.visible = false; this.t = 0; this.warn(`${MODES[this.mode].name} mode · ${this._fmtDist(this.range)} range · ${this.imperial ? '400 ft' : `${CEIL_M} m`} ceiling`, 3.5); }
    }
    _fly(dt) {
        // Looking upward/downward uses the full mode speed too. Sweep physical
        // collision at short intervals, including a boosted climb through a roof.
        const maxSpeed = Math.max(this.vel.length(), this.rth ? Math.hypot(16, 6) : MODES[this.mode].h * (this.g.input.shift ? BOOST : 1));
        const steps = Math.max(1, Math.ceil(dt * maxSpeed / COLLISION_STEP));
        if (steps > 1) { for (let i = 0; i < steps && this.phase === 'fly'; i++) this._fly(dt / steps); return; }
        const g = this.g, c = this.c, inp = g.input, cam = g.camera, h = this.home;
        const previous = { x: this.pos.x, z: this.pos.z };
        const photo = !!g.photo?.active;
        // look: yaw + gimbal tilt
        const lk = inp.takeLook();
        this.yaw -= lk.dx * 0.0022; this.gimbal = clamp(this.gimbal - lk.dy * 0.0022, -Math.PI / 2, Math.PI / 2);
        let fwd = 0, side = 0, boost = false;
        if (!photo && !this.rth) {
            const k = inp.keys;
            fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
            side = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
            boost = inp.shift;
            if (this.stick.x || this.stick.y) { fwd = -this.stick.y; side = this.stick.x; }
            else if (inp.touch?.stick?.active) {
                const stick = inp.touch.stick, mag = Math.hypot(stick.x, stick.y), response = mag > 0.12 ? (Math.min(1, mag) - 0.12) / (0.88 * mag) : 0;
                fwd = -stick.y * response; side = stick.x * response;
            }
            inp.take('Space'); inp.take('KeyE');
        }
        const M = MODES[this.mode], hs = M.h * (boost ? BOOST : 1);
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = -fz, rz = fx;
        // Follow the viewing heading in all three dimensions. The sideways axis stays
        // level, even when looking straight up/down; diagonal input keeps one speed.
        const pitchCos = Math.cos(this.gimbal);
        let tx = fx * pitchCos * fwd + rx * side, tz = fz * pitchCos * fwd + rz * side, ty = Math.sin(this.gimbal) * fwd;
        const tl = Math.hypot(tx, ty, tz); if (tl > 1) { tx /= tl; ty /= tl; tz /= tl; }
        tx *= hs; ty *= hs; tz *= hs;
        // return home: climb to a safe height, fly over you, descend in front of you
        const dHome = Math.hypot(this.pos.x - h.x, this.pos.z - h.z), gy0 = c.groundAt(this.pos.x, this.pos.z, this.pos.y);
        if (this.rth) {
            const dock = this._returnDock();
            // Each leg was certified against the buffered playable shape. Slow at bends
            // instead of cutting across a concavity with the old straight-line return.
            const path = this.rthPath || [{ x: dock.x, z: dock.z }];
            while (path.length > 1 && Math.hypot(path[0].x - this.pos.x, path[0].z - this.pos.z) < 0.8) path.shift();
            const target = path[0] || dock, dx = target.x - this.pos.x, dz = target.z - this.pos.z, dd = Math.hypot(dx, dz);
            const remaining = path.length > 1 ? Infinity : dd;
            const safe = Math.max(this.rthAltitude || h.y + 30, gy0 + 30);
            const sp = Math.min(16, dd * 0.9 + 1.2);
            if (remaining > 25 && this.pos.y < safe - 1) { tx = 0; tz = 0; ty = 6; }
            else { tx = dd > 0.01 ? dx / dd * sp : 0; tz = dd > 0.01 ? dz / dd * sp : 0; ty = clamp((remaining > 25 ? safe : dock.y) - this.pos.y, -6, 6); }
            const wantYaw = dd > 4 ? Math.atan2(-dx, -dz) : h.heading + Math.PI; // face you on the last metres
            let dy = wantYaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 2.5);
            this.gimbal = lerp(this.gimbal, dd > 25 ? -0.35 : -0.25, Math.min(1, dt * 2));
            if (path.length <= 1 && dd < 0.8 && Math.abs(dock.y - this.pos.y) < 0.6) { this._startDock(); return; }
        }
        // inertia
        const k = 1 - Math.exp(-(this.rth ? 3 : 2.2) * dt);
        this.vel.x += (tx - this.vel.x) * k; this.vel.z += (tz - this.vel.z) * k; this.vel.y += (ty - this.vel.y) * (this.rth ? 1 - Math.exp(-3.5 * dt) : k);
        const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt; let ny = this.pos.y + this.vel.y * dt;
        this.pos.x = nx; this.pos.z = nz;
        // limits: range around you, altitude ceiling, ground, then the playable flight area
        const rd = Math.hypot(this.pos.x - h.x, this.pos.z - h.z);
        if (rd > this.range) { const s = this.range / rd; this.pos.x = h.x + (this.pos.x - h.x) * s; this.pos.z = h.z + (this.pos.z - h.z) * s; const ux = (this.pos.x - h.x) / this.range, uz = (this.pos.z - h.z) / this.range, vr = this.vel.x * ux + this.vel.z * uz; if (vr > 0) { this.vel.x -= ux * vr; this.vel.z -= uz * vr; } this.warn(`Max range ${this._fmtDist(this.range)} — press H to return home`, 1.2, 'hot'); }
        else if (rd > this.range * 0.9) this.warn('Approaching max range', 0.6);
        const gy = c.groundAt(this.pos.x, this.pos.z, ny);
        const ceil = gy + (this.imperial ? 121.9 : CEIL_M);
        if (ny > ceil) { ny = ceil; if (this.vel.y > 0) this.vel.y = 0; this.warn(this.imperial ? 'Altitude limit 400 ft (FAA recreational ceiling)' : `Altitude limit ${CEIL_M} m (EU open category)`, 1.2); }
        if (ny < gy + 0.6) { ny = gy + 0.6; if (this.vel.y < 0) this.vel.y = 0; }
        this.pos.y = ny;
        this._collide(c, !!c.boundary);
        // The geofence runs after physical pushes, and at every height (including above
        // the driving-mask walls). Projection removes outward speed, preserving slides.
        if (c.boundary?.constrain(this.pos, this.vel, previous)) this.warn(`Flight area edge · ${FLIGHT_GRACE} m beyond the playable area`, 0.6);
        const finalRange = Math.hypot(this.pos.x - h.x, this.pos.z - h.z);
        if (finalRange > this.range) {
            // Keep the corrected step inside both the range disk and the flight domain.
            let lo = 0, hi = 1;
            for (let i = 0; i < 18; i++) { const t = (lo + hi) / 2, x = previous.x + (this.pos.x - previous.x) * t, z = previous.z + (this.pos.z - previous.z) * t; if (Math.hypot(x - h.x, z - h.z) <= this.range) lo = t; else hi = t; }
            this.pos.x = previous.x + (this.pos.x - previous.x) * lo; this.pos.z = previous.z + (this.pos.z - previous.z) * lo;
            const ux = (this.pos.x - h.x) / this.range, uz = (this.pos.z - h.z) / this.range, outward = this.vel.x * ux + this.vel.z * uz;
            if (outward > 0) { this.vel.x -= ux * outward; this.vel.z -= uz * outward; }
        }
        // body tilt into the motion (pitch forward / roll sideways), the gimbal keeps the camera level
        const vf = this.vel.x * fx + this.vel.z * fz, vr2 = this.vel.x * rx + this.vel.z * rz;
        this.tiltP = lerp(this.tiltP, clamp(-vf / 30, -0.45, 0.45), Math.min(1, dt * 4));
        this.tiltR = lerp(this.tiltR, clamp(-vr2 / 30, -0.45, 0.45), Math.min(1, dt * 4));
        cam.position.copy(this.pos); cam.quaternion.copy(this._droneQuat(true));
        if (cam.fov !== 70 && !photo) { cam.fov = 70; cam.updateProjectionMatrix(); }
        // battery, stats
        const sp = Math.hypot(this.vel.x, this.vel.z);
        this.battery = Math.max(0, this.battery - dt / BATTERY_S * (1 + sp / 40 + Math.abs(this.vel.y) / 12));
        if (this.battery < RTH_LOW && !this.rth) this.returnHome(true);
        if (this.battery <= 0.02 && this.rth) this.warn('Battery reserve — returning to land', 2, 'hot');
        this.recT += dt; this.dist += sp * dt;
        this.maxD = Math.max(this.maxD, rd); this.maxAlt = Math.max(this.maxAlt, this.pos.y - gy);
        this.homeMk.visible = true; for (const f of this.homeMk.userData.figure) f.visible = true;
        void dHome;
    }
    _collide(c, flightBoundary = false) {
        const C = c.colliders; if (!C) return;
        const y = this.pos.y, one = [null];
        const test = (b) => {
            if (flightBoundary && b.kind === 'boundary') return; // replaced by the height-independent flight domain
            let top;
            if (b.wall) top = Math.max(b.y1a ?? 0, b.y1b ?? 0);
            else if (b.y1 !== undefined) top = b.y1;
            else top = (b.y ?? 0) + (b.h ?? (b.prop ? 3 : 12));
            if (y > top + 0.4) return;
            if (b.y0 !== undefined && y < b.y0 - 0.4) return;
            if (b.yMax !== undefined) return; // bridge piers etc.: only for traffic below the deck
            one[0] = b;
            const r = collideBuildings(one, this.pos.x, this.pos.z, 0.35, y - 0.35, 0.7);
            if (r) { this.pos.x += r.px * 1.01; this.pos.z += r.pz * 1.01; const l = Math.hypot(r.px, r.pz) || 1, nx = r.px / l, nz = r.pz / l, vn = this.vel.x * nx + this.vel.z * nz; if (vn < 0) { this.vel.x -= nx * vn; this.vel.z -= nz * vn; } }
        };
        try { if (C.query) C.query(this.pos.x, this.pos.z, 2, test); else for (const b of C) test(b); } catch { /* ignore */ }
    }
    _startDock() {
        this.phase = 'dock'; this.t = 0; this.rth = false;
        this.dock0 = { pos: this.pos.clone(), q: this.g.camera.quaternion.clone() };
        this.model.position.copy(this.pos); this.model.rotation.set(0, this.yaw, 0);
        document.body.classList.add('drone-dock');
        this.warn('Landing', 1.5);
    }
    _dock(dt) {
        const g = this.g, cam = g.camera, T = 2.4, h = this.home;
        const eye = this._eye(), hand = this._hand();
        // camera: from the drone back into your eyes, looking at your hand
        // the drone: hover where it was, then down into the hand; rotors spin down at the end
        const m = this.model.position, u = ease((this.t - 0.5) / 1.5);
        m.lerpVectors(this.dock0.pos, hand, u);
        const k = ease(this.t / 1.1);
        cam.position.lerpVectors(this.dock0.pos, eye, k);
        const tgt = cam.position.distanceTo(m) > 0.6 ? m.clone() : hand.clone().add(new THREE.Vector3(0, 0.1, 0));
        const look = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, tgt, new THREE.Vector3(0, 1, 0)));
        this._blend(cam.quaternion, this.dock0.q, look, k);
        this.model.rotation.set(0, lerp(this.yaw, h.heading + Math.PI * 2 * Math.round((this.yaw - h.heading) / (Math.PI * 2)), u), 0);
        this.model.visible = cam.position.distanceTo(m) > 0.35;
        this.spin = 1 - ease((this.t - 1.7) / 0.7);
        this.homeMk.visible = cam.position.distanceTo(eye) > 2.5; for (const f of this.homeMk.userData.figure) f.visible = this.homeMk.visible;
        if (this.t >= T) {
            const c = this.c; this.homeMk.visible = false;
            this.toast('🚁 Drone landed', `${this._fmtDist(this.maxD)} out · ${this._fmtAlt(this.maxAlt)} up · ${this._fmtDist(this.dist)} flown`);
            this.stats.maxDist = Math.max(this.stats.maxDist, Math.round(this.maxD)); this.stats.maxAlt = Math.max(this.stats.maxAlt, Math.round(this.maxAlt)); this.stats.km = +(this.stats.km + this.dist / 1000).toFixed(2);
            // walker looks where the camera ended (down at the hand), then the head comes up
            if (c?.walker) { c.walker.pitch = -0.3; c.walker.heading = this.home.heading; c.walker.place?.(); } // = where the landing camera ended (looking at the hand)
            this.home.pitch = -0.3;
            this.abort();
        }
    }
    _freezeWalker(on) {
        const c = this.c; if (!c) return;
        const dead = this._dead || (this._dead = { keys: new Set(), actions: new Set(), touch: {}, take: () => false, takeLook: () => ({ dx: 0, dy: 0 }), flush() { }, get shift() { return false; }, lookHeld: false, locked: false, lookAllowed: false, releaseLock() { } });
        const w = c.walker;
        if (on) { this._wIn = w.input; w.input = dead; if (c.session) { this._sIn = c.session.input; c.session.input = dead; } }
        else { if (this._wIn) w.input = this._wIn; if (c.session && this._sIn) c.session.input = this._sIn; this._wIn = this._sIn = null; }
    }

    // ------------------------------------------------------------------ HUD
    _buildHud() {
        if (this.hudEl) { this.hudEl.classList.add('show'); this._hudSync(); return; }
        const el = this.hudEl = document.createElement('div'); el.id = 'drone-hud'; el.innerHTML = HUD_HTML; document.body.appendChild(el);
        const q = (s) => el.querySelector(s);
        this.q = { time: q('.dr-time'), mode: q('.dr-mode'), wind: q('.dr-wind'), bat: q('.dr-batbar i'), batPct: q('.dr-batpct'), batTime: q('.dr-battime'), alt: q('.dr-alt'), altu: q('.dr-altu'), vs: q('.dr-vs'), dist: q('.dr-dist'), distu: q('.dr-distu'), hs: q('.dr-hs'), hsu: q('.dr-hsu'), warn: q('.dr-warn'), hline: q('.dr-hline'), gim: q('.dr-gimbal span'), gimI: q('.dr-gimbal i'), compass: q('.dr-compass'), stick: q('.dr-stick'), knob: q('.dr-stick i'), batWrap: q('.dr-bat') };
        el.addEventListener('click', (e) => {
            const b = e.target.closest('[data-dr]'); if (!b) return; e.preventDefault();
            const [k, a] = b.dataset.dr.split(':');
            if (k === 'mode') this.setMode(+a);
            else if (k === 'rth') this.returnHome(false);
            else if (k === 'land') this.land();
            else if (k === 'gohere') this.goHere();
            else if (k === 'photo') this.g.photo?.open?.();
            b.blur();
        });
        // virtual stick (touch / mouse drag): forward/back + strafe
        const st = this.q.stick; let pid = null, cx = 0, cy = 0;
        st.addEventListener('pointerdown', (e) => { pid = e.pointerId; const r = st.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; st.setPointerCapture?.(pid); move(e); e.preventDefault(); });
        const move = (e) => { if (e.pointerId !== pid) return; const R = st.clientWidth / 2 || 60; let x = (e.clientX - cx) / R, y = (e.clientY - cy) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } this.stick.x = Math.abs(x) < 0.12 ? 0 : x; this.stick.y = Math.abs(y) < 0.12 ? 0 : y; this.q.knob.style.transform = `translate(${x * R * 0.6}px, ${y * R * 0.6}px)`; };
        const up = (e) => { if (e.pointerId !== pid) return; pid = null; this.stick.x = this.stick.y = 0; this.q.knob.style.transform = ''; };
        st.addEventListener('pointermove', move); st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
        el.classList.add('show'); this._hudSync();
    }
    setMode(i) { this.mode = clamp(i | 0, 0, MODES.length - 1); this._hudSync(); this.warn(`${MODES[this.mode].name} · up to ${this._fmtSpeed(MODES[this.mode].h)} (Shift ×${BOOST})`, 1.6); }
    cycleMode(d) { this.setMode((this.mode + d + MODES.length) % MODES.length); }
    _hudSync() {
        if (!this.q) return;
        this.q.mode.textContent = `⚡ ${MODES[this.mode].name} · ${this._fmtSpeed(MODES[this.mode].h)} (wheel / 1 2 3)`; this.q.mode.title = MODES[this.mode].name + ' mode'; // (after round 6: the bare 'N' chip didn't say it was the speed)
        for (const b of this.hudEl.querySelectorAll('[data-dr^=mode]')) b.classList.toggle('on', +b.dataset.dr.split(':')[1] === this.mode);
    }
    _fmtDist(m) { return this.imperial ? (m >= 1609 ? `${(m / 1609.34).toFixed(1)} mi` : `${Math.round(m * 3.281)} ft`) : (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`); }
    _fmtAlt(m) { return this.imperial ? `${Math.round(m * 3.281)} ft` : `${Math.round(m)} m`; }
    _fmtSpeed(ms) { return this.imperial ? `${Math.round(ms * 2.237)} mph` : `${Math.round(ms * 3.6)} km/h`; }
    warn(text, secs = 1.5, cls = '') { this._warnT = secs; if (this.q?.warn) { this.q.warn.textContent = text; this.q.warn.className = 'dr-warn show ' + cls; } }
    toast(title, body, cls = '') { try { if (this.g.state === 'spot' && this.g.spot?.ui?.toast) this.g.spot.ui.toast(title, body); else this.g.hud?.toast?.(title, body, cls); } catch { /* ignore */ } }
    _hudUpdate(dt) {
        const q = this.q; if (!q) return;
        if (this._warnT > 0) { this._warnT -= dt; if (this._warnT <= 0) q.warn.classList.remove('show'); }
        this._hudT = (this._hudT || 0) - dt; if (this._hudT > 0) return; this._hudT = 0.08;
        const h = this.home, c = this.c;
        const gy = c.groundAt(this.pos.x, this.pos.z, this.pos.y);
        const alt = this.phase === 'fly' ? this.pos.y - gy : 0, dist = this.phase === 'fly' ? Math.hypot(this.pos.x - h.x, this.pos.z - h.z) : 0;
        const im = this.imperial;
        q.alt.textContent = im ? Math.round(alt * 3.281) : alt.toFixed(alt < 10 ? 1 : 0); q.altu.textContent = im ? 'ft' : 'm';
        q.dist.textContent = im ? Math.round(dist * 3.281) : Math.round(dist); q.distu.textContent = im ? 'ft' : 'm';
        const hs = Math.hypot(this.vel.x, this.vel.z);
        q.hs.textContent = im ? Math.round(hs * 2.237) : hs.toFixed(hs < 10 ? 1 : 0); q.hsu.textContent = im ? 'mph' : 'm/s';
        q.vs.textContent = (im ? this.vel.y * 3.281 : this.vel.y).toFixed(1);
        const rec = Math.floor(this.recT || 0); q.time.textContent = `${String(Math.floor(rec / 60)).padStart(2, '0')}:${String(rec % 60).padStart(2, '0')}`;
        const b = this.battery, left = b * BATTERY_S / (1 + hs / 40);
        q.bat.style.width = `${Math.round(b * 100)}%`; q.batPct.textContent = `${Math.round(b * 100)}%`;
        q.batTime.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
        q.batWrap.classList.toggle('low', b < 0.3); q.batWrap.classList.toggle('crit', b < RTH_LOW);
        const wd = this._wind(); q.wind.textContent = `Wind ${im ? Math.round(wd.kmh / 1.609) + ' mph' : Math.round(wd.kmh) + ' km/h'}`;
        // horizon: the aircraft attitude (roll + pitch) against the camera's gimbal tilt
        const s = this._sway(), roll = this.tiltR + s.r * 3, pitchPx = (this.gimbal + this.tiltP * 0.3) * 260;
        q.hline.style.transform = `translateY(${clamp(pitchPx, -220, 220)}px) rotate(${(-roll / DEG).toFixed(2)}deg)`;
        const gd = Math.round(this.gimbal / DEG); q.gim.textContent = `${gd}°`; q.gimI.style.top = `${clamp((90 - gd) / 180 * 100, 0, 100)}%`;
        this._drawCompass();
    }
    _drawCompass() {
        const cv = this.q.compass, x = cv.getContext('2d'), W = cv.width, H = cv.height;
        x.clearRect(0, 0, W, H);
        let hd = ((-this.yaw / DEG) % 360 + 360) % 360; // compass bearing: 0 = north (−z)
        const pxPerDeg = 3.2;
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.fillStyle = '#fff'; x.font = '600 12px system-ui,sans-serif'; x.textAlign = 'center'; x.lineWidth = 1.5;
        for (let d = Math.floor(hd - 60); d <= hd + 60; d++) {
            if (d % 5) continue;
            const px = W / 2 + (d - hd) * pxPerDeg, dd = ((d % 360) + 360) % 360;
            x.beginPath(); x.moveTo(px, H - 2); x.lineTo(px, H - (dd % 15 ? 6 : 11)); x.stroke();
            if (dd % 45 === 0) { const lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[dd]; x.fillStyle = dd === 0 ? '#fbbf24' : '#fff'; x.fillText(lab, px, 13); }
        }
        // home direction marker
        const h = this.home, b = ((Math.atan2(h.x - this.pos.x, -(h.z - this.pos.z)) / DEG) + 360) % 360;
        let rel = b - hd; rel = ((rel + 540) % 360) - 180;
        const hx = W / 2 + clamp(rel, -58, 58) * pxPerDeg; x.fillStyle = '#fbbf24'; x.fillText('H', hx, 26);
        x.fillStyle = '#fff'; x.fillText(`${String(Math.round(hd) % 360).padStart(3, '0')}°`, W / 2, 26);
    }
    // ------------------------------------------------------------------ events / storage
    onPhoto() { if (!this.active) return; this.stats.photos++; this._save(); this.emit('photo', { alt: Math.round(this.pos.y - this.c.groundAt(this.pos.x, this.pos.z, this.pos.y)), dist: Math.round(Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z)) }); }
    emit(type, extra = {}) {
        const detail = { type, kind: this.c?.kind, stats: { ...this.stats }, ...extra };
        try { window.dispatchEvent(new CustomEvent('dmcv:drone', { detail })); } catch { /* ignore */ }
        try { window.cvTelemetry?.track?.('drone_' + type, { kind: detail.kind, dist: extra.dist, alt: extra.alt }); } catch { /* ignore */ }
        try { this.onEvent?.(detail); } catch { /* ignore */ }
    }
    _save() { const s = store.get(); s.drone = this.stats; store.set(s); }
    /** harness / debug: the drone's state */
    debug() { return this.active ? { phase: this.phase, x: this.pos.x, y: this.pos.y, z: this.pos.z, dist: Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z), battery: this.battery, mode: MODES[this.mode].id, range: this.range } : { phase: null }; }
}
export const DRONE_LIMITS = { RANGE, CEIL_M, BATTERY_S, MODES };
