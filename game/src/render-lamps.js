// Renderer3D methods: headlights and street lamps (light-pool discs and the few real lights assigned to the
// nearest lamps). Installed on Renderer3D.prototype by render.js (mixin).
import * as THREE from '../vendor/three.module.min.js';

export const LAMP_RANGE = 150;  // light-pool discs drawn within this distance (m)
const DISC_GAIN = 7;     // light-pool disc: lit surface × (1 + gain × falloff × lamp colour) at the pool centre
const MAX_DISCS = 220;
// street-lamp real lights (PointLight pool): assignment is hysteretic and every change fades, so nothing pops
const LAMP_LIGHT_I = 55;         // candela at full weight
const LAMP_LIGHT_NEAR = 55, LAMP_LIGHT_FAR = 85; // a light's intensity fades out with distance to the car over this band
const LAMP_ASSIGN_R = 80;        // lamps considered for a real light (m)
const LAMP_FADE_S = 0.4;         // fade-in / fade-out time of one real light
const LAMP_ASSIGN_DT = 0.2;      // re-selection period (s)
const LAMP_MAX_NEW = 2;          // at most this many new lights per re-selection (≤ 10 / s)

export class LampMethods {

    // ------------------------------------------------------------------ headlights
    /** true/false = manual; null = automatic (on whenever nightLights) */
    setHeadlights(v) { this._headManual = v === null || v === undefined ? null : !!v; this._updateHeadlights(); }
    _updateHeadlights() {
        const on = this._headManual ?? this.nightLights;
        this.headlightsOn = on;
        // by day (fog, rain, manual) the beams are dimmed: 140 cd at night, ≈ 25 cd in daylight (no white blow-out on a
        // light vehicle ahead); _updateNight re-applies it while the night factor eases
        this._headK = THREE.MathUtils.smoothstep(this._nightK, 0, 1);
        this.player?.cockpit?.userData.headlights?.setOn(on, 140 * (0.18 + 0.82 * this._headK));
    }

    // ------------------------------------------------------------------ street lamps
    /**
     * @param {Array<{x,z,h,rot?,y?}>|Float32Array|number[]|Array<[number,number,number]>} lamps
     *        world.lamps objects (head offset 1.8·h/8 m along `rot`, base height y), or [x, z, height] triples
     * @param {{headMesh?: THREE.Mesh, headMaterial?: THREE.Material}} o  lamp heads to light up at night (world.lampHeadMesh)
     */
    setLamps(lamps, o = {}) {
        // internal layout: stride 4 = [headX, headZ, headY, groundY]
        const n = !lamps ? 0 : (typeof lamps[0] === 'number' ? Math.floor(lamps.length / 3) : lamps.length);
        const flat = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
            let x, z, h, rot = null, y = 0;
            if (typeof lamps[0] === 'number') { x = lamps[i * 3]; z = lamps[i * 3 + 1]; h = lamps[i * 3 + 2] || 8; }
            else if (Array.isArray(lamps[i])) { [x, z, h = 8] = lamps[i]; }
            else { ({ x, z } = lamps[i]); h = lamps[i].h || 8; rot = lamps[i].candelabra ? null : lamps[i].rot ?? null; y = lamps[i].y || 0; } // (a candelabra's globes sit over its post: no arm offset)
            const k = h / 8;
            if (rot !== null) { x += Math.cos(rot) * 1.8 * k; z -= Math.sin(rot) * 1.8 * k; }
            flat.set([x, z, y + 7.7 * k, y], i * 4);
        }
        this.lamps = flat;
        // dense lamp areas (squares, boulevards with lamps every few metres) must not add up to a uniform flood: each
        // lamp's pool / light is scaled by 1/√(lamps within 14 m); a per-lamp tint mixes sodium and LED stock
        {
            const dens = this._lampDens = new Float32Array(n), tint = this._lampTint = new Float32Array(n * 3), cell = new Map(), C = 14;
            for (let i = 0; i < n; i++) { const k = Math.floor(flat[i * 4] / C) + ',' + Math.floor(flat[i * 4 + 1] / C); (cell.get(k) || cell.set(k, []).get(k)).push(i); }
            const us = (this.clock?.lon ?? this._wxPlace?.().lon ?? 26) < 0, c = new THREE.Color();
            for (let i = 0; i < n; i++) {
                const x = flat[i * 4], z = flat[i * 4 + 1], cx = Math.floor(x / C), cz = Math.floor(z / C); let m = 0;
                for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of cell.get((cx + a) + ',' + (cz + b)) || []) if ((flat[j * 4] - x) ** 2 + (flat[j * 4 + 1] - z) ** 2 < C * C) m++;
                dens[i] = 1 / Math.sqrt(Math.max(1, m));
                const hsh = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
                c.set(hsh < (us ? 0.15 : 0.45) ? '#ffad5c' : us ? '#f2f0ff' : '#ffe0b8'); // sodium | LED (US cooler)
                tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b;
            }
        }
        const head = o.headMaterial || o.headMesh?.material || null;
        if (this._lampHead && this._lampHead !== head && this._lampHead.emissive) this._lampHead.emissiveIntensity = 0;
        this._lampHead = head;
        if (this._lampHead?.color && !this._lampHead.emissive) this._lampHead.userData.dayColor ??= '#' + this._lampHead.color.getHexString();
        if (!this._discs) {
            // light pools multiply the lit surface (out = dst × (1 + pool)): a lamp lights asphalt, paving and grass by
            // their own albedo — round 6 note 27: the old additive white disc made the same glowing blob on dark grass.
            // The falloff lives in RGB (opaque black canvas): the blend factors ignore alpha.
            const c = document.createElement('canvas'); c.width = c.height = 128;
            const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
            gr.addColorStop(0, 'rgb(255,255,255)'); gr.addColorStop(0.3, 'rgb(190,190,190)'); gr.addColorStop(0.65, 'rgb(80,80,80)'); gr.addColorStop(1, 'rgb(0,0,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
            const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace;
            const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(DISC_GAIN, DISC_GAIN, DISC_GAIN), transparent: true, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
                blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneFactor });
            this._discs = new THREE.InstancedMesh(geo, mat, MAX_DISCS);
            this._discs.count = 0; this._discs.frustumCulled = false; this._discs.renderOrder = 2; this._discs.userData.shared = true;
            this._discs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DISCS * 3), 3);
        }
        this.scene?.add(this._discs);
        this._discs.count = 0; this._discs.visible = false;
        this._lampNear = []; this._lampReal = new Float32Array(n);
        for (const sl of this._lampSlots) { sl.lamp = -1; sl.w = 0; sl.target = 0; sl.light.intensity = 0; }
        this._syncLampPool();
        this._lampAt.set(1e9, 0, 1e9); this._lampT = 0; this._lampAssignT = 0;
    }
    _syncLampPool() {
        const want = this.lamps && this.lamps.length ? (this.tier?.lamps ?? 0) : 0;
        const slots = this._lampSlots;
        while (slots.length > want) {
            const sl = slots.pop(); this._lampGroup.remove(sl.light);
            if (sl.lamp >= 0 && this._lampReal) this._lampReal[sl.lamp] = 0;
        }
        while (slots.length < want) {
            const l = new THREE.PointLight('#ffc98a', 0, 28, 1.7); l.userData.shared = true;
            slots.push({ light: l, lamp: -1, w: 0, target: 0 }); this._lampGroup.add(l);
        }
        this._lampPool = slots.map(sl => sl.light);
        this._lampGroup.visible = (this._lampK || 0) > 0 && slots.length > 0;
    }
    /**
     * Street lamps at night.
     *  - candidate scan (≤ 4 Hz or after 8 m): lamps within LAMP_RANGE, sorted by distance; disc matrices set here
     *  - every frame: disc brightness from the exact distance (continuous fade, no switching)
     *  - real PointLights: re-selected at 5 Hz with hysteresis (assigned lamps keep their light until clearly worse),
     *    stable ordering (look-ahead distance, tie-break by lamp id), ≤ LAMP_MAX_NEW new lights per selection;
     *    each light fades in/out over LAMP_FADE_S and its intensity also falls off continuously with distance.
     */
    _updateLamps(cam, dt, camera = this.camera) {
        if (!(this._nightK > 0) || !this.lamps || !this.lamps.length) {
            if (this._lampSlots.length && this._lampSlots[0].lamp !== -2) { // day: release every light once, then idle
                for (const sl of this._lampSlots) { if (sl.lamp >= 0 && this._lampReal) this._lampReal[sl.lamp] = 0; sl.lamp = -1; sl.w = 0; sl.target = 0; sl.light.intensity = 0; }
                this._lampSlots[0].lamp = -2;
            }
            return;
        }
        if (this._lampSlots.length && this._lampSlots[0].lamp === -2) this._lampSlots[0].lamp = -1;
        // (owner register #66: "night drone view does not show the road lighting") the pools and real lights followed the
        // player on the ground while the drone flew elsewhere. A camera away from the player (drone, free camera) is the
        // centre instead: its ground point plus a look-ahead that grows with height, and from higher up a wider range.
        const p0 = this.player, camAway = !p0 || Math.hypot(cam.x - p0.x, cam.z - p0.z) > 40 || cam.y - (p0.y || 0) > 25;
        let cx = p0 ? p0.x : cam.x, cz = p0 ? p0.z : cam.z, rangeK = 1;
        if (camAway && camera) {
            const f = camera.getWorldDirection(this._tmp.dir || (this._tmp.dir = new THREE.Vector3())), fl = Math.hypot(f.x, f.z) || 1, h = Math.max(0, cam.y - (p0?.y || 0));
            const la = THREE.MathUtils.clamp(h * 0.8, 0, 120);
            cx = cam.x + f.x / fl * la; cz = cam.z + f.z / fl * la; rangeK = 1 + THREE.MathUtils.clamp(h / 100, 0, 1);
        }
        const p = camAway ? null : p0, RANGE = LAMP_RANGE * rangeK;
        const L = this.lamps, sm = THREE.MathUtils.smoothstep;
        // ---- candidate scan
        this._lampT -= dt;
        const moved = (cx - this._lampAt.x) ** 2 + (cz - this._lampAt.z) ** 2;
        const D = this._discs, m = this._tmp.m;
        if (this._lampT <= 0 || moved > 64) {
            this._lampT = 0.25; this._lampAt.set(cx, 0, cz);
            const R = RANGE + 12, R2 = R * R, near = [];
            for (let i = 0; i < L.length; i += 4) {
                const dx = L[i] - cx, dz = L[i + 1] - cz, d2 = dx * dx + dz * dz;
                if (d2 < R2) near.push({ d2, i });
            }
            near.sort((a, b) => a.d2 - b.d2 || a.i - b.i); // stable: distance, then lamp id
            const n = Math.min(near.length, MAX_DISCS), list = this._lampNear = new Int32Array(n);
            for (let k = 0; k < n; k++) list[k] = near[k].i;
            // more candidates than discs: fade the far end out before the cut-off so the last discs never pop
            this._discFarT = near.length > MAX_DISCS ? Math.min(RANGE, Math.sqrt(near[MAX_DISCS].d2) - 10) : RANGE;
            for (let k = 0; k < n; k++) {
                const i = list[k], r = (L[i + 2] - L[i + 3]) * (1.1 + 0.6 * (this._lampDens?.[i / 4] ?? 1)); // tighter pools where lamps are dense
                m.makeScale(r, 1, r).setPosition(L[i], L[i + 3] + 0.22, L[i + 1]);
                D.setMatrixAt(k, m);
            }
            D.count = n; D.instanceMatrix.needsUpdate = true;
        }
        this._discFar += ((this._discFarT ?? RANGE) - this._discFar) * Math.min(1, dt * 2);
        const list = this._lampNear, real = this._lampReal, nk = THREE.MathUtils.smoothstep(this._nightK, 0, 1);
        // ---- real lights: selection
        const slots = this._lampSlots, lk = this._lampK || 0;
        if (slots.length && lk > 0) {
            this._lampAssignT -= dt;
            if (this._lampAssignT <= 0) { this._lampAssignT = LAMP_ASSIGN_DT; this._assignLampLights(cx, cz, p, rangeK); }
        } else if (slots.length) for (const sl of slots) { sl.target = 0; }
        // ---- real lights: fade + distance falloff (every frame)
        for (const sl of slots) {
            if (sl.lamp < 0) continue;
            const step = dt / LAMP_FADE_S;
            sl.w = sl.target > sl.w ? Math.min(1, sl.w + step) : Math.max(0, sl.w - step);
            const i = sl.lamp * 4, d = Math.hypot(L[i] - cx, L[i + 1] - cz);
            const k = sm(sl.w, 0, 1) * (1 - sm(d / rangeK, LAMP_LIGHT_NEAR, LAMP_LIGHT_FAR)); // (from a drone the lit reach widens with height)
            // low arcade / bollard lamps (2–4 m) would blow out the floor at street-lamp candela: scale with height²
            const hh = (L[sl.lamp * 4 + 2] - L[sl.lamp * 4 + 3]) / 7.7, hK = THREE.MathUtils.clamp(hh * hh, 0.12, 1);
            sl.light.intensity = LAMP_LIGHT_I * k * lk * hK * (0.35 + 0.65 * (this._lampDens?.[sl.lamp] ?? 1));
            real[sl.lamp] = k * lk;
            if (sl.w <= 0 && sl.target <= 0) { real[sl.lamp] = 0; sl.lamp = -1; sl.light.intensity = 0; }
        }
        // ---- discs: continuous distance fade; slightly dimmer where a real light already lights the ground
        const col = this._tmp.col || (this._tmp.col = new THREE.Color()), far = this._discFar;
        for (let k = 0; k < list.length; k++) {
            const i = list[k], d = Math.hypot(L[i] - cx, L[i + 1] - cz);
            const f = (1 - sm(d, far * 0.65, far)) * nk * (1 - 0.35 * real[i / 4]);
            const li = i / 4, td = this._lampTint, dd = this._lampDens ? this._lampDens[li] : 1;
            D.setColorAt(k, td ? col.setRGB(td[li * 3], td[li * 3 + 1], td[li * 3 + 2]).multiplyScalar(f * dd * 1.25 * THREE.MathUtils.clamp((L[i + 2] - L[i + 3]) / 7.7, 0.35, 1)) : col.setScalar(f));
        }
        if (D.instanceColor) D.instanceColor.needsUpdate = true;
        D.visible = list.length > 0;
    }
    _assignLampLights(cx, cz, p = this.player, rangeK = 1) {
        const L = this.lamps, slots = this._lampSlots, list = this._lampNear;
        const sp = p ? Math.abs(p.speed || 0) : 0, la = THREE.MathUtils.clamp(10 + sp * 0.9, 10, 32);
        const ax = p ? cx + p.fx * la : cx, az = p ? cz + p.fz * la : cz;
        const owner = new Map(); for (const sl of slots) if (sl.lamp >= 0) owner.set(sl.lamp, sl);
        // score = distance to the look-ahead point; lamps that already own a light get a strong bonus (hysteresis)
        const cand = [], R2 = (LAMP_ASSIGN_R * rangeK) ** 2;
        for (let k = 0; k < list.length; k++) {
            const i = list[k], dx = L[i] - cx, dz = L[i + 1] - cz;
            if (dx * dx + dz * dz > R2) continue;
            const id = i / 4, sl = owner.get(id);
            let sc = Math.hypot(L[i] - ax, L[i + 1] - az);
            if (sl && sl.target > 0) sc = sc * 0.7 - 10;
            cand.push({ id, sc });
        }
        cand.sort((a, b) => a.sc - b.sc || a.id - b.id);
        const spare = Math.max(1, Math.round(slots.length * 0.2)), K = Math.max(1, slots.length - spare);
        const want = new Set(); for (let k = 0; k < Math.min(K, cand.length); k++) want.add(cand[k].id);
        for (const sl of slots) if (sl.lamp >= 0) sl.target = want.has(sl.lamp) ? 1 : 0;
        let added = 0;
        for (let k = 0; k < Math.min(K, cand.length) && added < LAMP_MAX_NEW; k++) {
            const id = cand[k].id; if (owner.has(id)) continue;
            const sl = slots.find(s => s.lamp < 0); if (!sl) break;
            const i = id * 4;
            sl.lamp = id; sl.w = 0; sl.target = 1; sl.light.intensity = 0;
            sl.light.position.set(L[i], L[i + 2] - 0.4, L[i + 1]);
            if (this._lampTint) sl.light.color.setRGB(this._lampTint[id * 3], this._lampTint[id * 3 + 1], this._lampTint[id * 3 + 2]);
            owner.set(id, sl); added++;
        }
    }
}
