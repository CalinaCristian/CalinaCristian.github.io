// ============================================================================
//  Harness core (runs inside the game page): owns the simulation loop, the
//  autopilot driver and the per-frame invariant checks. Exposed as
//  window.harness by index.js. Everything that touches the game goes through
//  `this.g` (window.game) and is guarded, so a renamed API degrades into a
//  logged "harness-api" issue instead of a crash.
// ============================================================================
import {
    lanesDir, canTravel, edgeSpeed, laneOff, roadName, sideW, clamp, r1, r2, distPointSeg, pip, edgeLocal, yAlong,
    pointInCollider, colliderDist, colliderKind, lampSet, obbPen, pointInObb, sleep, atLevel, vObb, solidFor,
} from './util.js';

const SEV_ORDER = { high: 0, medium: 1, low: 2 };
// issue types whose screenshot rarely helps (remote / transient): never spend a software-GL frame on them
const NO_SHOT = new Set(['vehicle-overlap', 'vehicle-overlap-ghost', 'ped-in-vehicle', 'vehicle-off-road', 'ped-on-carriageway']);

export class Harness {
    constructor(game) {
        this.g = game;
        this.issues = [];
        this.byKey = new Map();
        this.scenario = 'boot';
        this.simT = 0;           // total simulated seconds
        this.scT = 0;            // simulated seconds in the current scenario
        this.dt = 1 / 30;
        this.maxShots = 40; this.shots = 0; this.shotCount = new Map();
        this.pendingShots = [];
        this.log = [];
        this.owned = false;
        this.renderEvery = 0;    // render a frame every N steps (0 = only for screenshots)
        this.ap = null;          // autopilot state
        this.ctl = { throttle: 0, steer: 0, brake: false };
        this.mon = { blockT: 0, offSurfT: 0, mismatchT: 0, vehOverlap: new Map(), pedRoad: new Map(), steps: 0, trafficSlowT: 0, fpsLowT: 0, pathXZ: [] };
        this.stats0 = {};
        this.lampSet = null;
        this.scenarioResults = [];
    }

    // ------------------------------------------------------------------ setup
    get city() { return this.g.city?.id || '?'; }
    install() {
        const g = this.g, H = this;
        if (this._installed) return; this._installed = true;
        // take over the game loop: the original body runs only while the harness does not own the sim
        g.loop = function loop() {
            requestAnimationFrame(g.loop);
            const dt = Math.min(0.1, g.frameClock.getDelta());
            if (H.owned) return;
            if (g.state === 'drive') g.updateDrive(dt);
            else if (g.state === 'office') g.updateOffice(dt);
        };
        // rendering is by far the most expensive part in software GL: render only on request
        const df = g.drawFrame.bind(g);
        g.drawFrame = (o) => { if (!H.owned || H._renderNow) { const t = performance.now(); df(o); H._lastRenderMs = performance.now() - t; } };
        if (typeof g.drawCarScreen === 'function') { const dc = g.drawCarScreen.bind(g); g.drawCarScreen = (...a) => { if (!H.owned || H._renderNow || (H.mon.steps % 15 === 0)) dc(...a); }; }
        if (g.office?.render) { /* office render patched per instance in step() */ }
        this.owned = true;
    }
    release() { this.owned = false; this.setControls(0, 0, false); const r = this.g.r3d?.renderer; if (r && this._pr0 !== undefined) { r.setPixelRatio(this._pr0); this.g.r3d?.composer?.setPixelRatio?.(this._pr0); this._pr0 = undefined; } }

    note(msg) { const line = `[${this.scenario} t=${this.scT.toFixed(1)}] ${msg}`; this.log.push(line); if (this.log.length > 6000) this.log.shift(); try { window.harnessLog?.(line); } catch { /* ignore */ } }

    // ------------------------------------------------------------------ issues
    where(x, z) {
        const g = this.g; const out = { x: r1(x), z: r1(z) };
        try { const ll = g.city?.proj?.inverse?.(x, z); if (ll) { out.lat = +ll.lat.toFixed(6); out.lon = +ll.lon.toFixed(6); } } catch { /* ignore */ }
        try { const ne = g.nav?.index?.nearest(x, z, 120); out.street = ne ? roadName(ne.edge) : '(off road)'; if (ne) out.edge = ne.edge.id; } catch { /* ignore */ }
        return out;
    }
    /**
     * Log an issue. `key` dedupes (same key → count++). opts.shot requests a screenshot (player-centric issues).
     */
    issue(type, severity, msg, data = {}, opts = {}) {
        const p = this.g.player;
        const x = data.x ?? p?.x ?? 0, z = data.z ?? p?.z ?? 0;
        const key = `${this.city}|${type}|${opts.key ?? (Math.round(x / 30) + ',' + Math.round(z / 30))}`;
        const old = this.byKey.get(key);
        if (old) { old.count++; old.lastScenario = this.scenario; if (SEV_ORDER[severity] < SEV_ORDER[old.severity]) old.severity = severity; return old; }
        const d = { ...data }; delete d.x; delete d.z;
        const it = { id: (this.idBase || 0) + this.issues.length + 1, type, severity, scenario: this.scenario, city: this.city, t: r1(this.scT), msg, ...this.where(x, z), count: 1, data: d };
        this.issues.push(it); this.byKey.set(key, it);
        this.note(`ISSUE ${severity} ${type}: ${msg} @ ${it.street} (${it.x}, ${it.z})`);
        if (opts.shot && !this.noShots && (this.shotAll || !NO_SHOT.has(type))) {
            const k = this.scenario + '|' + type, n = this.shotCount.get(k) || 0, ns = this.shotCount.get(this.scenario) || 0;
            if (n < 2 && ns < 3 && this.shots < this.maxShots) { this.shotCount.set(k, n + 1); this.shotCount.set(this.scenario, ns + 1); this.shots++; this.pendingShots.push(it); }
        }
        return it;
    }
    /** render the current frame and ask Node for a screenshot; returns the relative path */
    async shot(name) {
        if (typeof window.harnessShot !== 'function') return null;
        const t0 = performance.now();
        this.renderFrame();
        await sleep(30);
        try { return await window.harnessShot(name); } catch (e) { return null; }
        finally { this.pf().shot += performance.now() - t0; }
    }
    pf() { return this.perf || (this.perf = { ap: 0, game: 0, check: 0, n: 0, shot: 0, yield: 0, audit: 0 }); }
    renderFrame() {
        const g = this.g;
        this._renderNow = true;
        // software GL: clip the far plane for harness frames (≈10x fewer triangles) and force the GPU work now,
        // so the following page screenshot is cheap
        const cam = g.camera, far = cam?.far, FAR = 300;
        // half pixel ratio for harness frames. Never restore it right after rendering: resizing the drawing buffer
        // clears the canvas and the screenshot comes out black (release() restores it)
        const r = g.r3d?.renderer || g.renderer, comp = g.r3d?.composer;
        try {
            if (cam && far > FAR) { cam.far = FAR; cam.updateProjectionMatrix(); }
            if (r && r.getPixelRatio?.() > 0.5) { if (this._pr0 === undefined) this._pr0 = r.getPixelRatio(); r.setPixelRatio(0.5); comp?.setPixelRatio?.(0.5); }
            if (g.state === 'office' && g.office) g.office.render();
            else { g.drawCarScreen && g.carScreen && g.drawCarScreen(g.hud?.el?.street?.textContent || '', ''); g.drawFrame({ mirror: false }); }
            const gl = r?.getContext?.(); if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        } catch (e) { this.issue('harness-error', 'low', 'render failed: ' + e.message, {}, { key: 'render' }); }
        finally { if (cam && far > FAR) { cam.far = far; cam.updateProjectionMatrix(); } }
        this._renderNow = false;
    }
    async flushShots() {
        while (this.pendingShots.length) {
            const it = this.pendingShots.shift();
            it.shot = await this.shot(`${this.city}-${String(it.id).padStart(3, '0')}-${it.type}`);
        }
    }
    drainErrors() {
        const q = window.__harnessErrors; if (!q || !q.length) return;
        for (const e of q.splice(0)) {
            const msg = String(e.msg || '').slice(0, 300);
            if (/harness/i.test(e.stack || '') && !/game\/src/.test(e.stack || '')) { this.issue('harness-error', 'low', msg, { stack: e.stack }, { key: 'h:' + msg.slice(0, 80) }); continue; }
            this.issue(e.kind === 'console' ? 'console-error' : 'js-error', 'high', msg, { stack: (e.stack || '').slice(0, 600) }, { key: msg.slice(0, 120), shot: e.kind !== 'console' });
        }
    }

    // ------------------------------------------------------------------ scenario bookkeeping
    begin(name) {
        this.scenario = name; this.scT = 0;
        const m = this.mon; m.blockT = 0; m.offSurfT = 0; m.mismatchT = 0; m.vehOverlap.clear(); m.pedRoad.clear(); m.trafficSlowT = 0; m.fpsLowT = 0; m.prevRH = undefined; m.skipH = 3; m.pathXZ = []; m.stuckLog = 0;
        this.ap = null; this.setControls(0, 0, false);
        this.lampSet = this.lampSet && this._lampWorld === this.g.world ? this.lampSet : (this._lampWorld = this.g.world, lampSet(this.g.world));
        this.note('begin');
    }
    // ------------------------------------------------------------------ controls
    setControls(throttle, steer, brake) {
        const inp = this.g.input; if (!inp) return;
        this.ctl.throttle = throttle; this.ctl.steer = steer; this.ctl.brake = brake;
        inp.touch.throttle = throttle; inp.touch.steer = steer; inp.touch.brake = !!brake;
    }
    press(code) { this.g.input?.actions?.add(code); }

    // ------------------------------------------------------------------ simulation
    /** one fixed step of the game + autopilot + invariants */
    stepOnce(dt = this.dt) {
        const g = this.g;
        const pf = this.pf();
        if (g.state === 'drive') {
            const t0 = performance.now();
            if (this.ap) this.autopilot(dt);
            const t1 = performance.now();
            g.updateDrive(dt);
            const t2 = performance.now();
            this.checkDrive(dt);
            pf.ap += t1 - t0; pf.game += t2 - t1; pf.check += performance.now() - t2; pf.n++;
        } else if (g.state === 'office' && g.office) {
            if (!g.office._hPatched) { const r = g.office.render.bind(g.office); g.office.render = () => { if (this._renderNow) r(); }; g.office._hPatched = true; }
            g.updateOffice(dt);
        }
        this.simT += dt; this.scT += dt; this.mon.steps++;
        if (this.renderEvery && this.mon.steps % this.renderEvery === 0) this.renderFrame();
        this.drainErrors();
    }
    /** run the sim for `sec` simulated seconds (or until `until()` returns truthy). yields to the event loop regularly */
    async run(sec, until = null) {
        const end = this.scT + sec; let n = 0;
        while (this.scT < end) {
            if (this.g.state === 'montage' || this.g.state === 'flight' || this.g.state === 'loading') { await sleep(40); continue; }
            this.stepOnce();
            if (until && until()) break;
            if (++n % 40 === 0) { const ty = performance.now(); await sleep(0); this.pf().yield += performance.now() - ty; if (this.pendingShots.length) await this.flushShots(); }
        }
        if (this.pendingShots.length) await this.flushShots();
        return this.scT;
    }

    // ------------------------------------------------------------------ teleports
    /** place the player on the right lane of the nearest drivable edge (optionally on a given edge/dir/s) */
    placeOnRoad(x, z, heading = null, { edge = null, dir = null, s = null, lane = 0 } = {}) {
        const g = this.g; let pose = null;
        if (edge) {
            const d = dir ?? (canTravel(edge, 1) ? 1 : -1);
            const ss = s ?? edge.len / 2;
            const along = d > 0 ? ss : edge.len - ss;
            const sx = d > 0 ? edge.a.x : edge.b.x, sz = d > 0 ? edge.a.z : edge.b.z;
            const lat = laneOff(edge, Math.min(lane, Math.max(0, lanesDir(edge, d) - 1)));
            pose = { x: sx + edge.dirx * d * along + edge.nx * d * lat, z: sz + edge.dirz * d * along + edge.nz * d * lat, heading: Math.atan2(-edge.dirx * d, -edge.dirz * d), edge, dir: d };
        } else if (typeof g.lanePose === 'function') pose = g.lanePose(x, z, heading ?? g.player.heading);
        else if (typeof g.roadPose === 'function') pose = g.roadPose(x, z);
        if (!pose) { this.issue('harness-api', 'medium', 'no lanePose/roadPose available for teleport', { x, z }, { key: 'lanePose' }); g.player.place(x, z, heading ?? 0); return null; }
        g.player.place(pose.x, pose.z, pose.heading, pose.edge || null); g.player.contactAge = 9; g.player.steer = 0;
        g.stuckT = 0; g.prevEdgeInfo = null;
        try { g.traffic.setPlayer(g.player); g.traffic.clearAround?.(pose.x, pose.z, 14); } catch (e) { this.issue('harness-api', 'medium', 'traffic.setPlayer failed: ' + e.message, {}, { key: 'setPlayer' }); }
        this.mon.skipH = 3; this.mon.prevRH = undefined; this.mon.blockT = 0;
        if (g.nav?.dest) g.nav.reroute(g.player);
        return pose;
    }
    refuelInstant() { const g = this.g; g.fuel = 45; g.flags && (g.flags.emptyToast = false); }

    // ------------------------------------------------------------------ autopilot
    /**
     * Drive to (x,z) following the nav route with pure-pursuit steering.
     * opts: { arriveR=12, timeout=90, speedMul=1, stop=true, lane=0, label, obeyLights=true }
     * resolves { ok, reason, t, dist, resets }
     */
    async driveTo(x, z, opts = {}) {
        const g = this.g, P = g.player;
        const o = { arriveR: 12, timeout: 90, speedMul: 1, stop: true, lane: 0, obeyLights: true, label: 'harness target', ...opts };
        if (g.state !== 'drive') return { ok: false, reason: 'not driving (state ' + g.state + ')' };
        const ap = this.ap = { tx: x, tz: z, o, route: null, path: null, pi: 0, s: 0, waitT: 0, stallT: 0, revT: 0, resets: 0, laneBias: 0, offT: 0, done: false, reason: '', dist0: g.stats?.dist ?? 0, t0: this.scT, rerouteN: 0, honkT: 0, lastProgressT: this.scT, bestRem: Infinity };
        // keep the game's own navigation in sync (instructions + HUD), but follow our own copy of the route
        try { g.setNavDest ? g.setNavDest({ x, z, label: o.label }, true) : g.nav.setDestination({ x, z, label: o.label }, P); } catch (e) { this.issue('harness-api', 'medium', 'setNavDest failed: ' + e.message, {}, { key: 'setNavDest' }); }
        if (!this.apRoute()) { this.ap = null; this.setControls(0, 0, true); return { ok: false, reason: 'no route' }; }
        await this.run(o.timeout, () => ap.done);
        this.setControls(0, 0, true);
        const res = { ok: ap.done && ap.reason === 'arrived', reason: ap.done ? ap.reason : 'timeout', t: r1(this.scT - ap.t0), dist: Math.round((g.stats?.dist ?? 0) - ap.dist0), resets: ap.resets, remaining: Math.round(ap.remaining ?? -1) };
        if (!res.ok) this.note(`driveTo ${o.label} failed: ${res.reason} (remaining ${res.remaining} m)`);
        this.ap = null;
        return res;
    }
    apRoute() {
        const g = this.g, P = g.player, ap = this.ap;
        let route = null;
        try { route = g.nav.compute(P.x, P.z, ap.tx, ap.tz, P.heading); } catch (e) { this.issue('route-failure', 'high', 'nav.compute threw: ' + e.message, {}, { key: 'compute-throw' }); }
        if (!route || !route.points || route.points.length < 2) {
            this.issue('route-failure', 'high', `no route from here to ${ap.o.label} (${r1(ap.tx)}, ${r1(ap.tz)})`, { to: this.where(ap.tx, ap.tz) }, { key: 'route:' + Math.round(ap.tx) + ',' + Math.round(ap.tz) });
            return false;
        }
        ap.route = route; ap.latShift = 0; ap.path = this.buildPath(route, ap.laneBias + ap.o.lane); ap.pi = 0; ap.rerouteN++; ap.bestS = 0; ap.lastProgressT = this.scT;
        return true;
    }
    /** right-hand lane-offset polyline of a route; seg i follows legs[i] */
    buildPath(route, lane, shift = 0) {
        const P = route.points, L = route.legs, segs = [];
        for (let i = 0; i < L.length && i < P.length - 1; i++) {
            const { e, dir } = L[i];
            const lanes = Math.max(1, lanesDir(e, dir));
            const off = laneOff(e, clamp(lane, 0, lanes - 1)) + (i <= 2 ? shift : 0);
            const ox = e.nx * dir * off, oz = e.nz * dir * off;
            segs.push([P[i][0] + ox, P[i][1] + oz, P[i + 1][0] + ox, P[i + 1][1] + oz, L[i]]);
        }
        const pts = [[segs[0][0], segs[0][1]]], legOf = [];
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i], n = segs[i + 1];
            if (n) pts.push([(s[2] + n[0]) / 2, (s[3] + n[1]) / 2]); else pts.push([s[2], s[3]]);
            legOf.push(s[4]);
        }
        const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        return { pts, cum, legOf, total: cum[cum.length - 1] };
    }
    pathPoint(path, s) {
        const { pts, cum } = path; let i = 0;
        while (i < pts.length - 2 && cum[i + 1] < s) i++;
        const L = cum[i + 1] - cum[i] || 1, t = clamp((s - cum[i]) / L, 0, 1);
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, i];
    }
    autopilot(dt) {
        const g = this.g, P = g.player, ap = this.ap; const path = ap.path; if (!path) return;
        const v = P.speed, av = Math.abs(v);
        // progress on the path
        let best = Infinity, bi = ap.pi, bs = ap.s;
        for (let i = Math.max(0, ap.pi - 2); i < Math.min(path.pts.length - 1, ap.pi + 30); i++) {
            const a = path.pts[i], b = path.pts[i + 1]; const q = distPointSeg(P.x, P.z, a[0], a[1], b[0], b[1]);
            if (q.d < best - 0.01) { best = q.d; bi = i; bs = path.cum[i] + (path.cum[i + 1] - path.cum[i]) * q.t; }
        }
        ap.pi = bi; ap.s = bs; ap.dev = best;
        const remaining = ap.remaining = Math.max(0, path.total - bs) + Math.hypot(path.pts[path.pts.length - 1][0] - ap.tx, path.pts[path.pts.length - 1][1] - ap.tz) * 0;
        const toTarget = Math.hypot(P.x - ap.tx, P.z - ap.tz);
        if (remaining < ap.bestRem - 3 || bs > (ap.bestS ?? -1) + 3) { ap.bestRem = Math.min(ap.bestRem, remaining); ap.bestS = Math.max(ap.bestS ?? 0, bs); ap.lastProgressT = this.scT; }
        if (this.trace && this.scT - (ap.traceT ?? -9) > this.trace) { ap.traceT = this.scT; this.note(`ap x=${r1(P.x)} z=${r1(P.z)} v=${r1(v)} s=${r1(bs)}/${r1(path.total)} dev=${r1(best)} pi=${bi} gap=${ap.gap === Infinity ? '-' : r1(ap.gap)} ${ap.leader || ''} thr=${r2(this.ctl.throttle)} st=${r2(this.ctl.steer)} br=${this.ctl.brake} leg=${roadName(path.legOf[Math.min(bi, path.legOf.length - 1)].e)}`); }
        // arrival
        if ((remaining < ap.o.arriveR || toTarget < ap.o.arriveR * 0.7) && (!ap.o.stop || av < 1.2)) { ap.done = true; ap.reason = 'arrived'; this.setControls(0, 0, true); return; }
        // off the path → own reroute (the game's nav reroutes itself too)
        if (best > 16) { ap.offT += dt; if (ap.offT > 2.5) { ap.offT = 0; this.note(`autopilot reroute (deviation ${best.toFixed(1)} m)`); if (!this.apRoute()) { ap.done = true; ap.reason = 'no route'; } return; } }
        else ap.offT = 0;
        // ---------- reversing out of a stall
        if (ap.revT > 0) { ap.revT -= dt; this.setControls(-1, 0, false); return; }
        // ---------- steering: pure pursuit
        const Ld = clamp(5 + av * 0.75, 7, 28);
        const [tx, tz, segI] = this.pathPoint(path, bs + Ld);
        const leg = path.legOf[Math.min(bi, path.legOf.length - 1)];
        const fx = P.fx, fz = P.fz, rx = -fz, rz = fx;
        const dx = tx - P.x, dz = tz - P.z;
        const alpha = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
        const lock = 0.65 + (0.22 - 0.65) * clamp(av / 30, 0, 1);
        const curvature = 2 * Math.sin(alpha) / Math.max(4, Math.hypot(dx, dz));
        let steer = clamp(2.8 * curvature / lock, -1, 1);
        if (v < -0.3) steer = 0;
        // ---------- speed planning
        const lim = edgeSpeed(leg.e) * ap.o.speedMul;
        let vt = Math.min(lim, 30);
        // corners ahead
        for (let k = bi + 1; k < path.pts.length - 1; k++) {
            const d = path.cum[k] - bs; if (d > 90) break;
            const a = path.pts[k - 1], b = path.pts[k], c = path.pts[k + 1];
            const ux = b[0] - a[0], uz = b[1] - a[1], wx = c[0] - b[0], wz = c[1] - b[1];
            const lu = Math.hypot(ux, uz), lw = Math.hypot(wx, wz); if (lu < 0.5 || lw < 0.5) continue;
            const th = Math.acos(clamp((ux * wx + uz * wz) / (lu * lw), -1, 1));
            if (th < 0.25) continue;
            const vc = Math.max(4, 15 * (1 - Math.min(th, 2.3) / 2.5));
            vt = Math.min(vt, Math.sqrt(vc * vc + 2 * 3.0 * Math.max(0, d - 2)));
        }
        // initial heading error (e.g. after a teleport facing the wrong way)
        if (Math.abs(alpha) > 1.2) vt = Math.min(vt, 4);
        // stop at the target
        if (ap.o.stop) vt = Math.min(vt, Math.sqrt(2 * 2.5 * Math.max(0, remaining - ap.o.arriveR * 0.4)) + 0.6);
        // red lights at the end of the current leg
        if (ap.o.obeyLights && leg) {
            const node = leg.dir > 0 ? leg.e.b : leg.e.a;
            const dn = path.cum[Math.min(bi + 1, path.cum.length - 1)] - bs;
            if (node.hasLight && dn < 45 && dn > 0) {
                let st = 'green'; try { st = g.traffic.lightState(node, leg.e); } catch { /* ignore */ }
                const stopAt = dn - (node.radius ?? 6) - 2.5;
                if (st === 'red' || (st === 'yellow' && stopAt > av * 0.8)) { if (stopAt > -1) vt = Math.min(vt, Math.sqrt(2 * 3.5 * Math.max(0, stopAt))); }
            }
        }
        // obstacles on the path (vehicles, pedestrians)
        const obs = this.obstacleAhead(path, bs, 55);
        ap.gap = obs.gap; ap.leader = obs.what;
        if (obs.gap < Infinity) {
            const vg = Math.min(Math.max(0, obs.speed) + Math.max(0, obs.gap - 5) * 0.7, Math.sqrt(2 * 4 * Math.max(0, obs.gap - 2.5)));
            vt = Math.min(vt, vg);
        }
        // ---------- longitudinal control
        let throttle = 0, brake = false;
        if (vt < 0.4 && av < 0.6) { brake = true; }
        else if (v < vt - 0.6) throttle = 1;
        else if (v > vt + 1.5) { if (v - vt > 4 || vt < 1) brake = true; else throttle = -1; }
        else throttle = v < vt ? 0.35 : 0;
        if (throttle < 0 && v < 0.6) throttle = 0; // never reverse by accident
        // ---------- stuck handling
        const wantsGo = vt > 2;
        if (wantsGo && av < 0.5) {
            if (obs.gap < 9) { ap.waitT += dt; ap.stallT = 0; }
            else { ap.stallT += dt; }
        } else { ap.waitT = Math.max(0, ap.waitT - dt * 2); ap.stallT = Math.max(0, ap.stallT - dt); }
        if (ap.waitT > 8 && ap.laneBias === 0 && lanesDir(leg.e, leg.dir) > 1) { ap.laneBias = 1; ap.path = this.buildPath(ap.route, ap.laneBias + ap.o.lane); this.note('blocked: switching lane'); ap.waitT = 6; }
        if (ap.waitT > 6 && this.scT - ap.honkT > 4) { ap.honkT = this.scT; this.press('KeyH'); }
        if (ap.waitT > 8 && obs.what === 'pedestrian' && !ap.ignorePeds) {
            this.issue('ped-blocks-lane', 'medium', `pedestrian(s) standing in the driving lane of ${roadName(leg.e)} for 8 s (autopilot then pushes through)`, {}, { shot: true });
            ap.ignorePeds = true; ap.waitT = 0;
        }
        if (ap.waitT > 18) {
            this.issue('traffic-blockage', 'medium', `autopilot blocked behind ${obs.what || 'traffic'} for 18 s (needed R reset)`, { leader: obs.info }, { shot: true });
            this.resetCar('blocked by traffic'); ap.waitT = 0; return;
        }
        if (ap.stallT > 2.2) {
            ap.stallT = 0; ap.stalls = (ap.stalls || 0) + 1;
            const blk = this.blockerAhead(4);
            if (blk && (blk.c || blk.what === 'deck edge') && (ap.dev ?? 9) < 2.5) {
                const c = blk.c, at = c ? (c.ax !== undefined ? { x: (c.ax + c.bx) / 2, z: (c.az + c.bz) / 2 } : { x: c.x, z: c.z }) : { x: P.x, z: P.z };
                const solid = c && (c.poly || !c.prop);
                this.issue('route-blocked', 'high', `following the nav route in its lane on ${roadName(leg.e)}, the car is stopped by a ${blk.what}${c?.wall ? ' wall' : ''} (static obstacle on a routable lane)`, { x: at.x, z: at.z, kind: blk.what, edge: leg.e.id, carX: r1(P.x), carZ: r1(P.z), solid: !!solid, last: P.debug?.lastCollider || null }, { shot: true, key: 'rb:' + Math.round(at.x) + ',' + Math.round(at.z) });
            }
            if (ap.stalls >= 4) { this.resetCar('stalled 4x'); ap.stalls = 0; return; }
            // go around whatever is in the way: other lane, else shift toward the centre line / kerb
            const lanes = lanesDir(leg.e, leg.dir);
            if (lanes > 1 && ap.stalls === 1) ap.laneBias = ap.laneBias ? 0 : 1;
            else ap.latShift = ap.stalls % 2 ? -1.6 : 1.4;
            ap.path = this.buildPath(ap.route, ap.laneBias + ap.o.lane, ap.latShift || 0);
            ap.revT = 1.2; this.note(`stalled: reversing, then lane ${ap.laneBias} shift ${ap.latShift || 0}`); return;
        }
        if (this.scT - ap.lastProgressT > 30) { this.issue('autopilot-no-progress', 'medium', `no progress toward ${ap.o.label} for 30 s`, {}, { shot: true }); ap.lastProgressT = this.scT; this.resetCar('no progress'); return; }
        this.setControls(throttle, steer, brake);
    }
    resetCar(why) {
        const g = this.g, ap = this.ap; this.note('reset to road (R): ' + why);
        if (ap) ap.resets++;
        this.setControls(0, 0, true);
        const P = g.player; P.speed = 0;
        let ok = false;
        try { if (typeof g.resetToRoad === 'function') ok = !!g.resetToRoad({ silent: true }); } catch (e) { this.issue('harness-api', 'medium', 'resetToRoad threw: ' + e.message, {}, { key: 'reset' }); }
        if (!ok) this.placeOnRoad(P.x, P.z, P.heading);
        this.mon.skipH = 3; this.mon.prevRH = undefined;
        if (ap && !this.apRoute()) { ap.done = true; ap.reason = 'no route after reset'; }
    }
    /** nearest vehicle / pedestrian on the path within `look` m → { gap, speed, what } */
    obstacleAhead(path, s0, look) {
        const g = this.g, P = g.player; let gap = Infinity, speed = 0, what = null, info = null;
        const T = g.traffic; if (!T) return { gap, speed, what };
        const i0 = Math.max(0, this.ap.pi), segs = [];
        for (let i = i0; i < path.pts.length - 1 && path.cum[i] < s0 + look; i++) segs.push(i);
        const test = (x, z, ax, az, halfW, halfL, sp, label, obj) => {
            // sample the obstacle's long axis (trams / buses are 12-30 m long)
            const n = Math.max(1, Math.ceil(halfL / 1.5));
            for (let k = -n; k <= n; k++) {
                const px = x + ax * halfL * k / n, pz = z + az * halfL * k / n;
                if ((px - P.x) * P.fx + (pz - P.z) * P.fz < 0.5) continue; // behind our front axle line
                let bd = Infinity, bsv = 0;
                for (const i of segs) { const a = path.pts[i], b = path.pts[i + 1]; const q = distPointSeg(px, pz, a[0], a[1], b[0], b[1]); if (q.d < bd) { bd = q.d; bsv = path.cum[i] + (path.cum[i + 1] - path.cum[i]) * q.t; } }
                if (bd > halfW + 1.25) continue;
                const gp = bsv - s0 - (P.length || 4.4) / 2;
                if (gp < -3 || gp > look) continue;
                if (gp < gap) { gap = gp; speed = sp; what = label; info = obj; }
            }
        };
        for (const v of T.near(P.x + P.fx * look * 0.5, P.z + P.fz * look * 0.5, look * 0.6 + 16)) {
            if (Math.abs((v.y ?? 0.24) - (P.y ?? 0.24)) > 3) continue;
            const along = v.fx * P.fx + v.fz * P.fz;
            test(v.x, v.z, v.fx, v.fz, v.width / 2, v.length / 2, v.speed * along, v.parked ? 'parked car' : (v.kind || 'car'), { id: v.id, kind: v.kind, parked: !!v.parked, speed: r1(v.speed) });
        }
        for (const p of (T.nearPeds && !this.ap.ignorePeds) ? T.nearPeds(P.x + P.fx * 15, P.z + P.fz * 15, 22) : []) if (p.state !== 'down') test(p.x, p.z, 1, 0, 0.4, 0, 0, 'pedestrian', null);
        return { gap, speed, what, info };
    }

    // ------------------------------------------------------------------ invariants (every frame)
    checkDrive(dt) {
        const g = this.g, P = g.player, W = g.world, m = this.mon, T = g.traffic;
        if (!P || !W) return;
        // NaN
        if (![P.x, P.z, P.heading, P.speed].every(Number.isFinite) || (P.y !== undefined && !Number.isFinite(P.y))) {
            this.issue('nan-state', 'high', `player state not finite: x=${P.x} z=${P.z} h=${P.heading} v=${P.speed} y=${P.y}`, { x: 0, z: 0 }, { key: 'player-nan' });
            return;
        }
        if (m.steps % 6 === 0 && m.pathXZ.length < 4000) m.pathXZ.push([r1(P.x), r1(P.z)]);
        // ---------- heights (player.surfY when the game tracks it, else world.roadHeight under the car)
        let rh = null;
        if (P.surfY !== undefined && Number.isFinite(P.surfY)) rh = P.surfY;
        else if (typeof W.roadHeight === 'function') rh = W.roadHeight(P.x, P.z);
        if (rh !== null) {
            if (m.skipH > 0) m.skipH--;
            else {
                if (m.prevRH !== undefined && Math.abs(rh - m.prevRH) > 1.5) this.issue('height-jump', 'high', `car surface height jumped ${r2(m.prevRH)} → ${r2(rh)} m in one frame (snaps on/off a bridge / into a trench)`, { from: r2(m.prevRH), to: r2(rh), last: P.debug?.lastCollider || null }, { shot: true });
                if (P.y !== undefined && Math.abs(P.y - rh) > 1) { m.offSurfT += dt; if (m.offSurfT > 0.6) { this.issue('car-off-surface', 'medium', `car y ${r2(P.y)} differs from its surface height ${r2(rh)} for > 0.6 s`, { y: r2(P.y), road: r2(rh) }); m.offSurfT = -5; } }
                else m.offSurfT = Math.max(0, m.offSurfT - dt);
                // the edge we are driving on (autopilot leg) vs the height the car actually got
                const leg = this.ap?.path ? this.ap.path.legOf[Math.min(this.ap.pi, this.ap.path.legOf.length - 1)] : null;
                if (leg && (this.ap.dev ?? 99) < 3) {
                    const ya = yAlong(leg.e, P.x, P.z);
                    if (ya !== null && Math.abs(0.24 + ya - rh) > 1.0) { m.mismatchT += dt; if (m.mismatchT > 0.1) { const first = leg === this.ap.route?.legs?.[0]; this.issue(first ? 'route-wrong-level' : 'surface-mismatch', 'high', first ? `nav route starts on ${roadName(leg.e)} at y=${r2(0.24 + ya)} but the car is at y=${r2(rh)} (route start snapped to a road on another level, nearest in 2D)` : `driving on ${roadName(leg.e)} (profile y=${r2(0.24 + ya)}) but the car is at y=${r2(rh)}: lifted onto / dropped from another road`, { edge: leg.e.id, expected: r2(0.24 + ya), got: r2(rh), support: P.supportEdge ? roadName(P.supportEdge) : null }, { shot: true }); m.mismatchT = -3; } }
                    else m.mismatchT = Math.max(0, m.mismatchT - dt);
                }
            }
            m.prevRH = rh;
        }
        // ---------- blocked with throttle while nothing is in front → invisible collision
        const inp = g.input; const thr = inp ? inp.throttle : 0;
        if (thr > 0.3 && !(inp.brake) && Math.abs(P.speed) < 0.5 && !g.refuel && g.fuel > 0.5) m.blockT += dt; else m.blockT = Math.max(0, m.blockT - dt * 2);
        if (m.blockT > 2) {
            m.blockT = -4;
            const what = this.whatIsAhead(4);
            const last = P.debug?.lastCollider ? { ...P.debug.lastCollider } : null;
            if (!what) this.issue('invisible-collision', 'high', `car pushed with throttle for 2 s at < 0.5 m/s with nothing within 4 m ahead${P.touching ? ' (player.touching = true)' : ''}${last ? ` — last collider: ${last.type} ${last.id ?? ''} at (${last.x}, ${last.z})` : ''}`, { touching: !!P.touching, lastCollider: last }, { shot: true });
            else this.note(`blocked by ${what}`);
        }
        // ---------- clipping (player overlapping static geometry)
        if (W.buildings?.query) {
            for (const o of [1.3, 0, -1.3]) {
                const px = P.x + P.fx * o, pz = P.z + P.fz * o;
                W.buildings.query(px, pz, 1.5, (c) => {
                    if (!solidFor(P, c, px, pz)) return;
                    if (c.poly) { if (pip(px, pz, c.poly)) this.issue('clipping', 'high', `car body inside a building footprint${c.poi ? ' (CV building)' : ''}`, { kind: colliderKind(c, this.lampSet) }, { shot: true }); }
                    else {
                        const d = colliderDist(c, px, pz);
                        // the player resolves a 1.0 m circle around each sample point: d < 0.4 = the object is inside the car body
                        if (d < 0.4) this.issue('clipping', c.prop ? 'medium' : 'high', `car passes through a ${colliderKind(c, this.lampSet)} (no collision response, overlap ${r2(1 - d)} m)`, { kind: colliderKind(c, this.lampSet), x: c.x, z: c.z }, { shot: true, key: 'c:' + Math.round(c.x * 2) + ',' + Math.round(c.z * 2) });
                    }
                });
            }
        }
        // ---------- navigation: a destination must always have a route and a next instruction
        if (g.nav?.dest && g.state === 'drive') {
            if (!g.nav.route) { m.navNoRouteT = (m.navNoRouteT || 0) + dt; if (m.navNoRouteT > 3) { this.issue('route-failure', 'high', `game nav has a destination (${g.nav.dest.label || ''}) but no route for 3 s`, { dest: this.where(g.nav.dest.x, g.nav.dest.z) }, { key: 'navnr:' + Math.round(g.nav.dest.x) + ',' + Math.round(g.nav.dest.z) }); m.navNoRouteT = -30; } }
            else { m.navNoRouteT = 0; if (!g.navInfo || !g.navInfo.next) { m.navNoInfoT = (m.navNoInfoT || 0) + dt; if (m.navNoInfoT > 2) { this.issue('nav-missing', 'medium', 'route present but nav.update() gives no next instruction', {}, { key: 'navni' }); m.navNoInfoT = -30; } } else m.navNoInfoT = 0; }
        }
        if (!T) return;
        // ---------- vehicles
        const vs = T.vehicles || [];
        const full = m.steps % 10 === 0;
        for (const v of vs) {
            if (!Number.isFinite(v.x) || !Number.isFinite(v.z) || !Number.isFinite(v.speed)) { this.issue('nan-state', 'high', `vehicle ${v.id} (${v.kind}) state not finite`, { x: 0, z: 0 }, { key: 'veh-nan-' + v.id }); continue; }
            const dP = Math.hypot(v.x - P.x, v.z - P.z);
            if (!full && dP > 160) continue;
            const e = v.edge; if (!e) continue;
            // against a one-way
            if (!v.tram && !canTravel(e, v.dir)) this.issue('vehicle-wrong-way', 'medium', `${v.kind} ${v.id} drives against the one-way ${roadName(e)}`, { x: v.x, z: v.z, edge: e.id }, { key: 'ww-' + e.id });
            // off its carriageway (corners / transitions / near junctions excluded)
            if (!v.transition || v.transition <= 0) {
                const L = edgeLocal(e, v.x, v.z);
                const nearNode = L.s < (e.a.radius ?? 6) + 6 || L.s > e.len - (e.b.radius ?? 6) - 6;
                if (!nearNode) {
                    const lim = sideW(e, L.lat >= 0 ? 1 : -1) + 1 + (v.parked ? 1.5 : 0) + (v.bypass ? 3 : 0);
                    if (Math.abs(L.lat) > lim) this.issue('vehicle-off-road', 'medium', `${v.kind} ${v.id} is ${r1(Math.abs(L.lat))} m from the centreline of ${roadName(e)} (carriageway ${r1(lim - 1)} m)`, { x: v.x, z: v.z, edge: e.id, parked: !!v.parked, lat: r1(L.lat) }, { key: 'off-' + e.id, shot: dP < 40 });
                }
            }
            // overlap with the player
            if (dP < 8) { const pen = obbPen(vObb(v), P); if (pen > 0.35) this.issue('vehicle-overlaps-player', 'medium', `${v.kind} ${v.id} overlaps the player by ${r2(pen)} m`, { x: v.x, z: v.z, pen: r2(pen) }, { shot: true }); }
        }
        // vehicle ↔ vehicle overlaps (near the player every frame, everywhere every 10th frame)
        const seen = m._seenPairs || (m._seenPairs = new Set()); seen.clear();
        const boxes = new Map(); const box = (v) => { let b = boxes.get(v); if (!b) boxes.set(v, b = vObb(v)); return b; };
        for (const v of vs) {
            if (!full && Math.hypot(v.x - P.x, v.z - P.z) > 160) continue;
            for (const o of T.near(v.x, v.z, 9)) {
                if (o === v || o.id < v.id) continue;
                if ((v.layer ?? 0) !== (o.layer ?? 0) || Math.abs((v.y ?? 0) - (o.y ?? 0)) > 2.5) continue;
                const pen = obbPen(box(v), box(o));
                const k = v.id + ':' + o.id; seen.add(k);
                if (pen > 0.5) {
                    const t = (m.vehOverlap.get(k) || 0) + (full ? dt * 10 : dt); m.vehOverlap.set(k, t);
                    if (t > 1.0) {
                        const ghost = v.ghost > 0 || o.ghost > 0;
                        this.issue(ghost ? 'vehicle-overlap-ghost' : 'vehicle-overlap', ghost ? 'low' : 'medium', `${v.kind} ${v.id}${v.parked ? ' (parked)' : ''} and ${o.kind} ${o.id}${o.parked ? ' (parked)' : ''} overlap by ${r2(pen)} m for ${r1(t)} s${ghost ? ' (deadlock ghosting)' : ''}`, { x: (v.x + o.x) / 2, z: (v.z + o.z) / 2, a: v.id, b: o.id, pen: r2(pen), speeds: [r1(v.speed), r1(o.speed)], parked: [!!v.parked, !!o.parked], sameEdge: v.edge === o.edge, nearJunction: this.nearJunction(v) || this.nearJunction(o) }, { key: 'vo-' + Math.round(v.x / 20) + ',' + Math.round(v.z / 20), shot: Math.hypot(v.x - P.x, v.z - P.z) < 40 });
                        m.vehOverlap.set(k, -1e9);
                    }
                }
            }
        }
        if (full) for (const k of m.vehOverlap.keys()) if (!seen.has(k) && m.vehOverlap.get(k) > -1e8) m.vehOverlap.delete(k);
        // ---------- pedestrians (staggered: every 5th frame)
        const ground = (e) => !(e.tunnel || (e.ya ?? 0) > 2 || (e.yb ?? 0) > 2 || (e.ya ?? 0) < -2 || (e.yb ?? 0) < -2);
        if (T.peds?.list && m.steps % 5 === 0) {
            const pdt = dt * 5;
            for (const p of T.peds.list) {
                if (p.state === 'down' || Math.hypot(p.x - P.x, p.z - P.z) > 250) continue;
                // inside a vehicle
                for (const v of T.near(p.x, p.z, 16)) if (Math.abs((v.y ?? 0.24) - (p.y ?? 0.24)) < 2 && pointInObb(vObb(v), p.x, p.z, 0.15)) { this.issue('ped-in-vehicle', 'medium', `pedestrian ${p.i} (${p.state}) inside ${v.kind} ${v.id}${v.parked ? ' (parked)' : ''}${v.speed > 0.5 ? ' (moving)' : ''}`, { x: p.x, z: p.z, ped: p.i, veh: v.id, pedState: p.state, vehKind: v.kind }, { key: 'piv-' + Math.round(p.x / 15) + ',' + Math.round(p.z / 15), shot: Math.hypot(p.x - P.x, p.z - P.z) < 30 }); break; }
                // on the carriageway away from a crossing
                const atCrossing = p.onRoad && p.legs?.[0]?.cross;
                const ne = g.nav.index.nearest(p.x, p.z, 30, ground);
                let onRoad = false;
                if (ne && !atCrossing) {
                    const e = ne.edge, L = edgeLocal(e, p.x, p.z);
                    const side = L.lat >= 0 ? 1 : -1;
                    const inside = Math.abs(L.lat) < sideW(e, side) - 0.4 && L.s > (e.a.radius ?? 6) && L.s < e.len - (e.b.radius ?? 6);
                    onRoad = inside;
                }
                const t = onRoad ? (m.pedRoad.get(p) || 0) + pdt : 0;
                m.pedRoad.set(p, t);
                if (t > 5) { this.issue('ped-on-carriageway', 'medium', `pedestrian ${p.i} (${p.state}) on the carriageway of ${roadName(ne.edge)} for > 5 s, not at a crossing`, { x: p.x, z: p.z, ped: p.i, pedState: p.state }, { key: 'por-' + Math.round(p.x / 15) + ',' + Math.round(p.z / 15) }); m.pedRoad.set(p, -1e9); }
                if (atCrossing && p.state === 'legs') { p._hCross = (p._hCross || 0) + pdt; if (p._hCross > 30) { this.issue('ped-stuck-crossing', 'low', `pedestrian ${p.i} has been crossing for > 30 s`, { x: p.x, z: p.z }, { key: 'psc-' + p.i }); p._hCross = -1e9; } } else if (p._hCross > 0) p._hCross = 0;
            }
        }
        // ---------- performance
        const ms = T.stats?.lastMs;
        if (ms !== undefined) {
            if ((T.stats.updateMs ?? ms) > 8) m.trafficSlowT += dt; else m.trafficSlowT = Math.max(0, m.trafficSlowT - dt);
            if (m.trafficSlowT > 2) { this.issue('perf-traffic-update', 'low', `traffic.update averaging ${r1(T.stats.updateMs)} ms (> 8 ms budget) on this machine`, { updateMs: r1(T.stats.updateMs), vehicles: vs.length }, { key: 'perf-traffic' }); m.trafficSlowT = -30; }
        }
    }
    nearJunction(v) {
        const e = v.edge; if (!e) return false; const L = edgeLocal(e, v.x, v.z);
        return (L.s < (e.a.radius ?? 6) + 8 && e.a.edges?.length >= 3) || (L.s > e.len - (e.b.radius ?? 6) - 8 && e.b.edges?.length >= 3);
    }
    /** what is within `r` m in front of the player? null = nothing (for the invisible-collision check) */
    whatIsAhead(r) { const o = this.blockerAhead(r); return o ? o.what : null; }
    blockerAhead(r) {
        const g = this.g, P = g.player, W = g.world; let what = null, coll = null;
        for (const v of g.traffic?.near(P.x, P.z, r + 16) || []) {
            if (Math.abs((v.y ?? 0.24) - (P.surfY ?? P.y ?? 0.24)) > 2) continue;
            const f = (v.x - P.x) * P.fx + (v.z - P.z) * P.fz, l = (v.x - P.x) * -P.fz + (v.z - P.z) * P.fx;
            if (obbPen(vObb(v), P) > -r * 0.5 || (f > -3 && f < r + 2.2 + v.length / 2 && Math.abs(l) < 2 + v.width / 2)) { what = (v.parked ? 'parked ' : '') + (v.kind || 'vehicle'); break; }
        }
        if (!what && W.buildings?.query) {
            for (const o of [-1, 0.5, 2, 3.5, 5]) for (const lat of [-1.2, 0, 1.2]) {
                if (what) break;
                const x = P.x + P.fx * (2.2 + o) - P.fz * lat, z = P.z + P.fz * (2.2 + o) + P.fx * lat;
                W.buildings.query(x, z, 2, (c) => { if (!what && solidFor(P, c, x, z) && colliderDist(c, x, z) < 1.1) { what = colliderKind(c, this.lampSet); coll = c; } });
            }
        }
        if (!what && g.traffic?.nearPeds) for (const p of g.traffic.nearPeds(P.x + P.fx * 3, P.z + P.fz * 3, r)) { what = 'pedestrian'; break; }
        const b = P.bounds; if (!what && b && (P.x < b.minX + 45 || P.x > b.maxX - 45 || P.z < b.minZ + 45 || P.z > b.maxZ - 45)) what = 'world bounds';
        if (!what && P.deckContact) what = 'deck edge';
        return what ? { what, c: coll } : null;
    }

    // ------------------------------------------------------------------ static checks around the driven path
    /** props / buildings intersecting road ribbons near the path driven in this scenario */
    auditAroundPath(radius = 40) {
        const t0 = performance.now();
        try { return this._auditAroundPath(radius); } finally { this.pf().audit += performance.now() - t0; }
    }
    _auditAroundPath(radius) {
        const g = this.g, W = g.world; if (!W.buildings?.query || !g.nav?.index) return 0;
        const edges = new Set();
        for (const [x, z] of this.mon.pathXZ) for (const e of g.nav.index.near(x, z, radius, [])) edges.add(e);
        let n = 0;
        for (const e of edges) for (const hit of ribbonHits(e, W, this.lampSet)) {
            n++;
            const { level, deckY } = hitLevel(e, hit);
            const type = level === 'same' ? 'object-in-road' : level === 'under' ? 'object-under-elevated-road' : 'object-over-sunken-road';
            const sev = hit.solid ? (level === 'same' ? 'high' : 'low') : hit.depth > 1.2 ? (level === 'same' ? 'high' : 'medium') : (level === 'same' ? 'medium' : 'low');
            const where = level === 'same' ? `intersects the carriageway of ${roadName(e)}` : level === 'under' ? `stands under the deck of ${roadName(e)} (deck y ${r1(deckY)} m; pokes through it if taller)` : `floats above the sunken ${roadName(e)} (road y ${r1(deckY)} m)`;
            this.issue(type, sev, `${hit.kind} ${where} by ${r2(hit.depth)} m`, { x: hit.x, z: hit.z, edge: e.id, kind: hit.kind, depth: r2(hit.depth), deckY: r1(deckY) }, { key: 'oir-' + Math.round(hit.x * 2) + ',' + Math.round(hit.z * 2) });
        }
        return n;
    }
}

/**
 * Colliders intersecting the drivable ribbon of edge e → [{kind, x, z, depth, lat, r, base, solid}]
 * Props: circle / box corners vs the ribbon rectangle (depth = how far into the carriageway). Buildings and
 * landmark boxes: lane-centre samples (every 3 m) inside the footprint. Walls (trench / guard / rail) and
 * bridge piers are skipped: they are meant to follow / sit under roads (world.audit() checks walls itself).
 */
export function ribbonHits(e, W, lamps) {
    const out = []; if (e.len < 1 || e.tunnel || e.virtual) return out;
    const wR = sideW(e, 1), wL = sideW(e, -1);
    const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
    const ra = (e.a.edges?.length >= 3 ? (e.a.radius ?? 0) : 0), rb = (e.b.edges?.length >= 3 ? (e.b.radius ?? 0) : 0);
    const seen = new Set();
    W.buildings.query(mx, mz, e.len / 2 + Math.max(wR, wL) + 2, (c) => {
        if (seen.has(c)) return; seen.add(c);
        if (c.wall || c.ax !== undefined || c.kind === 'pier' || c.yMax !== undefined) return;
        const base = c.y ?? c.base ?? 0;
        if (c.prop) {
            const circle = c.hw === c.r;
            const pts = circle ? [[c.x, c.z, c.r]] : (() => {
                const co = Math.cos(c.angle || 0), si = Math.sin(c.angle || 0), q = [[c.x, c.z, 0]];
                // inverse of world.js's local transform (lx = dx·cos − dz·sin, lz = dx·sin + dz·cos)
                for (const [lx, lz] of [[c.hw, c.hd], [-c.hw, c.hd], [c.hw, -c.hd], [-c.hw, -c.hd]]) q.push([c.x + lx * co + lz * si, c.z - lx * si + lz * co, 0]);
                return q;
            })();
            let depth = -Infinity, lat0 = 0;
            for (const [x, z, r] of pts) {
                const L = edgeLocal(e, x, z);
                if (L.s < 0.5 || L.s > e.len - 0.5) continue;
                const d = (L.lat >= 0 ? wR : wL) + r - Math.abs(L.lat);
                if (d > depth) { depth = d; lat0 = L.lat; }
            }
            if (depth > 0.35) out.push({ kind: colliderKind(c, lamps), x: c.x, z: c.z, depth, lat: lat0, r: c.r, base, solid: false });
            return;
        }
        // buildings / landmark boxes: sample the lanes, skip the junction boxes (other edges own them)
        let hit = null, cnt = 0;
        const step = 3, s0 = Math.min(e.len / 2, ra + 1), s1 = Math.max(e.len / 2, e.len - rb - 1);
        for (let s = s0; s <= s1; s += step) for (const lat of [wR * 0.6, 0, -wL * 0.6]) {
            const x = e.a.x + e.dirx * s + e.nx * lat, z = e.a.z + e.dirz * s + e.nz * lat;
            if (pointInCollider(c, x, z, 0.05)) { cnt++; if (!hit) hit = { x, z }; }
        }
        if (hit) out.push({ kind: colliderKind(c, lamps), x: hit.x, z: hit.z, depth: cnt * 1.0, samples: cnt, cx: c.x, cz: c.z, base: c.minH ?? base, solid: true });
    });
    return out;
}
/**
 * Classify a ribbon hit by level: same level as the road (in the road), under an elevated deck, or above a
 * sunken road (floating over a trench / underpass) → { level: 'same'|'under'|'over', deckY }
 */
export function hitLevel(e, h) {
    const deckY = yAlong(e, h.x, h.z) ?? 0;
    const base = h.base ?? 0;
    if (Math.abs(deckY - base) < 1.5) return { level: 'same', deckY };
    return { level: deckY > base ? 'under' : 'over', deckY };
}
