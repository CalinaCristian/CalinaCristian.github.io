// ============================================================================
//  Crowd (R15.6): instanced low-poly pedestrians with personas (tourists,
//  locals, vendors, guides, buskers, staff, kids, fishmongers), walking the
//  footway network, standing / watching / photographing / posing / queuing /
//  sitting / performing at attractors. They react with chat bubbles (lines
//  from the research dialogue, translation under non-English text) when the
//  player walks up, bumps into them, photographs them or idles nearby, and
//  chat among themselves. One draw call per body part.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { rng, clamp, distSeg, inPoly } from './kit.js';
import { makeCrowd, dressFor, seasonOf } from '../crowd.js';

// ---------------------------------------------------------------------------- looks per persona
const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#9a6544', '#7a4b31', '#f5d6bc', '#d8a47f', '#5f3a26'];
const HAIR = ['#1d1a17', '#3b2a1e', '#5a3d27', '#8c6a43', '#c9a46a', '#2b2b2b', '#6b6b6b', '#b8b2a6', '#7a3b1e'];
const JEANS = ['#34465f', '#2b3a52', '#3d4f6b', '#22252b', '#4a4f57', '#5d6b54', '#7b6a55', '#2e2e33'];
export const LOOKS = {
    local: { top: ['#2f4a3a', '#22304a', '#1d1f22', '#3a3f45', '#4b5b3a', '#5a2e2e'], legs: JEANS, prop: ['cup', 'none', 'phone'], hood: 0.4 },
    tech: { top: ['#4a4f57', '#6b7280', '#1f2937', '#334155', '#3f3f46'], legs: ['#4b4f55', '#6b6a63', '#2b3a52', '#a39c88'], pack: 0.8, prop: ['phone', 'cup', 'none'] },
    tourist_us: { top: ['#1e3a5f', '#002244', '#7a1f2b', '#69be28', '#9ca3af', '#e5e7eb', '#a7c7e7'], legs: JEANS, prop: ['phone', 'bag', 'phone', 'cup'], pack: 0.3 },
    tourist_ca: { top: ['#b33a3a', '#2563eb', '#0f766e'], legs: JEANS, hat: ['#b91c1c', '#1f2937', '#f5f5f4'], prop: ['phone', 'none'] },
    tourist_cn: { top: ['#e5e7eb', '#fde68a', '#bfdbfe', '#fbcfe8', '#f5f5f4'], legs: ['#e7e5e4', '#1f2937', '#a8a29e', ...JEANS], hat: ['#f5f5dc', '#fef3c7', '#ffffff'], prop: ['selfie', 'phone'] },
    tourist_in: { top: ['#8b5e3c', '#6d2e46', '#7c2d12', '#1e3a8a', '#4c1d95'], legs: JEANS, prop: ['phone', 'none'] },
    tourist_kr: { top: ['#b8a07e', '#d6c7a6', '#e7e5e4', '#1f2937'], legs: ['#1f2937', '#e7e5e4', ...JEANS], prop: ['camera', 'phone'] },
    tourist_jp: { top: ['#e8e2d4', '#1e3a5f', '#f5f5f4', '#9ca3af'], legs: ['#1f2937', '#78716c', ...JEANS], pack: 0.6, prop: ['phone', 'umbrella', 'camera'] },
    tourist_de: { top: ['#d97706', '#2563eb', '#15803d', '#dc2626'], legs: ['#4b5563', '#57534e', ...JEANS], pack: 0.5, prop: ['book', 'phone'] },
    tourist_es: { top: ['#dc2626', '#dc2626', '#1d4ed8', '#f59e0b'], legs: JEANS, prop: ['phone', 'none'] },
    fishmonger: { top: ['#f2f2f0'], legs: ['#e8742a'], bib: '#e8742a', prop: ['none'], boots: true },
    vendor: { top: ['#3f6b4f', '#7c4a2d', '#334155', '#7f1d1d'], legs: JEANS, apron: ['#e7e5e4', '#3f6b4f', '#78350f'], prop: ['none'] },
    busker: { top: ['#5b4636', '#1f2937', '#78350f'], legs: JEANS, prop: ['guitar'], hat: ['#1f2937', '#78350f'] },
    guide: { top: ['#f59e0b', '#16a34a', '#2563eb'], legs: JEANS, prop: ['flag'], hat: ['#f59e0b', null] },
    staff: { top: ['#1f4e79', '#14532d', '#d4e157', '#7f1d1d'], legs: ['#1f2937', '#374151'], prop: ['none', 'radio'] },
    kid: { top: ['#f472b6', '#60a5fa', '#facc15', '#34d399', '#f87171', '#a78bfa'], legs: ['#1d4ed8', '#be185d', '#4b5563', ...JEANS], prop: ['none', 'none', 'phone'], scale: [0.55, 0.75] },
    photographer: { top: ['#1f2937', '#3f3f46', '#57534e'], legs: ['#1f2937', ...JEANS], pack: 0.7, prop: ['camera'] },
    // ---- Bucharest personas (research persona library)
    local_elder: { top: ['#4a4038', '#3b3a3f', '#5b4b3d', '#6b5b4b', '#2f3437', '#6a3f3a'], legs: ['#2e2e33', '#4a4740', '#3d3a35', '#55524c'], hat: ['#3a342e', '#5a4d40', null, null], prop: ['bag', 'none', 'bag'], scale: [0.9, 1.0] },
    local_young: { top: ['#1d1f22', '#f5f5f4', '#22304a', '#7a1f2b', '#3f6b4f', '#c2410c', '#6b7280'], legs: JEANS, pack: 0.35, prop: ['phone', 'phone', 'cup', 'none'] },
    local_parent: { top: ['#334155', '#9a3412', '#0f766e', '#e7e5e4', '#1e3a8a'], legs: JEANS, prop: ['bag', 'phone', 'none'] },
    tourist_uk: { top: ['#1e3a5f', '#e5e7eb', '#7a1f2b', '#14532d', '#f5f5f4'], legs: ['#a39c88', ...JEANS], prop: ['phone', 'cup', 'camera'], pack: 0.3 },
    tourist_it: { top: ['#1d4ed8', '#f5f5f4', '#1f2937', '#a16207', '#be123c'], legs: ['#1f2937', '#e7e5e4', ...JEANS], prop: ['phone', 'selfie', 'none'] },
    tourist_fr: { top: ['#1e3a8a', '#f5f5f4', '#7f1d1d', '#374151', '#d6c7a6'], legs: ['#1f2937', ...JEANS], prop: ['book', 'phone', 'camera'] },
    tourist_bg: { top: ['#15803d', '#dc2626', '#f5f5f4', '#1f2937', '#0369a1'], legs: JEANS, prop: ['phone', 'bag', 'none'] },
    waiter: { top: ['#f5f5f4', '#111111', '#f5f5f4'], legs: ['#111111', '#1f2937'], apron: ['#111111', '#3b2a1e', '#7f1d1d'], prop: ['none'] },
    guard: { top: ['#1f2a3a', '#2b3440', '#2d3a2a'], legs: ['#1f2a3a', '#22252b'], hat: ['#1f2a3a', '#2b3440'], prop: ['radio', 'none'] },
    tour_guide: { top: ['#f59e0b', '#facc15', '#16a34a', '#2563eb', '#dc2626'], legs: JEANS, prop: ['flag', 'umbrella'], hat: [null, null, '#f59e0b'] },
    priest: { top: ['#111111'], legs: ['#111111'], hat: ['#111111'], apron: ['#111111'], prop: ['none', 'book'] },
};
const PROP = { // size (w, h, d), colour, offset along the forearm
    none: null, phone: { s: [0.075, 0.15, 0.012], c: '#15171a' }, cup: { s: [0.085, 0.13, 0.085], c: '#f5f1e8' }, camera: { s: [0.13, 0.09, 0.09], c: '#1a1b1e' },
    bag: { s: [0.32, 0.36, 0.1], c: '#c8a46a', hang: true }, book: { s: [0.15, 0.21, 0.03], c: '#b45309' }, selfie: { s: [0.02, 0.85, 0.02], c: '#9ca3af', up: true },
    umbrella: { s: [0.05, 0.75, 0.05], c: '#1f2937', hang: true }, flag: { s: [0.025, 1.3, 0.025], c: '#f59e0b', up: true }, guitar: { s: [0.36, 0.95, 0.1], c: '#8a5a2b', body: true }, radio: { s: [0.06, 0.16, 0.04], c: '#111' },
};

// ---------------------------------------------------------------------------- body part geometries (local: +z forward, y up, pivots at joints)
function partGeos() {
    const leg = new THREE.CylinderGeometry(0.085, 0.06, 0.86, 7); leg.translate(0, -0.43, 0);
    const shoe = new THREE.BoxGeometry(0.11, 0.08, 0.25); shoe.translate(0, -0.88, 0.05);
    const legG = mergeColored([[leg, 1], [shoe, 0.28]]);
    const arm = new THREE.CylinderGeometry(0.06, 0.05, 0.6, 6); arm.translate(0, -0.3, 0);
    const torso = new THREE.CylinderGeometry(0.2, 0.17, 0.62, 9); torso.scale(1, 1, 0.62); torso.translate(0, 0.31, 0);
    const shoulders = new THREE.SphereGeometry(0.2, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2); shoulders.scale(1.08, 0.38, 0.62); shoulders.translate(0, 0.6, 0);
    const torsoG = mergeColored([[torso, 1], [shoulders, 1]]);
    const head = new THREE.SphereGeometry(0.105, 12, 9); head.scale(0.92, 1.12, 1);
    const neck = new THREE.CylinderGeometry(0.045, 0.05, 0.1, 6); neck.translate(0, -0.13, 0);
    const nose = new THREE.SphereGeometry(0.022, 5, 4); nose.translate(0, 0, 0.1);
    const headG = mergeColored([[head, 1], [neck, 0.92], [nose, 0.95]]);
    const hair = new THREE.SphereGeometry(0.115, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55); hair.scale(0.95, 1.1, 1.05); hair.translate(0, 0.012, -0.012);
    const hat = new THREE.CylinderGeometry(0.1, 0.115, 0.1, 10); hat.translate(0, 0.1, 0); const brim = new THREE.CylinderGeometry(0.17, 0.17, 0.012, 12); brim.translate(0, 0.055, 0.0);
    const hatG = mergeColored([[hat, 1], [brim, 0.9]]);
    const hand = new THREE.SphereGeometry(0.045, 6, 5); hand.scale(0.9, 1.2, 0.8);
    const pack = new THREE.BoxGeometry(0.3, 0.38, 0.15);
    const prop = new THREE.BoxGeometry(1, 1, 1);
    const apron = new THREE.BoxGeometry(0.36, 0.62, 0.02);
    return { leg: legG, arm, torso: torsoG, head: headG, hair, hat: hatG, hand, pack, prop, apron };
}
function mergeColored(list) {
    const pos = [], nor = [], col = [];
    for (const [g0, k] of list) { const g = g0.index ? g0.toNonIndexed() : g0; const p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(k, k, k); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
}

// ---------------------------------------------------------------------------- path network
/** network of walkable polylines; links between endpoints and any vertex of another line within `snap` m */
export function pathNetwork(lines, snap = 2.5) {
    const L = lines.filter((p) => p.length > 1).map((pts, id) => ({ id, pts, links: [[], []] }));
    for (const a of L) for (const end of [0, 1]) {
        const e = end ? a.pts[a.pts.length - 1] : a.pts[0];
        for (const b of L) { if (b === a) continue; for (let i = 0; i < b.pts.length; i++) if (Math.hypot(b.pts[i][0] - e[0], b.pts[i][1] - e[1]) < snap) { a.links[end].push({ line: b, i }); break; } }
    }
    return L;
}

// ---------------------------------------------------------------------------- the crowd
const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();

export class Crowd {
    /**
     * @param {object} o
     *  ground       Ground (heightAt)
     *  dialogue     { lines:[{p,ctx,text,orig?,lang?}], personas:[] } (scene) ; general: { lines } (city-wide fallback)
     *  personas     { persona: weight }
     *  walkers      number of path walkers
     *  paths        [[ [x,z], ... ], ...] walkable polylines
     *  groups       [{ x, z, r?, n, act, look?:[x,z], yaw?, personas?:[], y?, line?:[[x,z]..], spacing?, say?:[ctx] }]
     *  bubbles      BubbleLayer
     *  seed
     */
    constructor(o) {
        this.o = o; this.ground = o.ground; this.r = rng(o.seed || 77);
        this.peds = []; this.t = 0; this.chatT = 4; this.globalCd = 0; this.idleT = 0; this.recent = [];
        this.lines = o.dialogue?.lines || []; this.general = o.general?.lines || [];
        this.rainy = false;
        /** current conditions for tagged lines (set by SpotSession): { hour, month, day, tempC, kind, snowCm } */
        this.cond = null;
        this.net = pathNetwork(o.paths || []);
        const weights = Object.entries(o.personas || { local: 1, tourist_us: 1 });
        const total = weights.reduce((s, [, w]) => s + w, 0);
        this.pickPersona = (list) => {
            if (list?.length) return this.r.pick(list);
            let x = this.r() * total; for (const [p, w] of weights) { x -= w; if (x <= 0) return p; } return weights[0][0];
        };
        for (const g of o.groups || []) this._spawnGroup(g);
        for (let i = 0; i < (o.walkers || 0) && this.net.length; i++) this._spawnWalker();
        this._buildMeshes();
    }
    _look(persona) {
        const L = LOOKS[persona] || LOOKS.local, r = this.r;
        const sc = L.scale ? r.range(L.scale[0], L.scale[1]) : r.range(0.93, 1.07);
        const hatC = L.hat ? r.pick(L.hat) : (L.hood && r() < L.hood ? null : null);
        return {
            top: r.pick(L.top), legs: r.pick(L.legs), skin: r.pick(SKIN), hair: r.pick(HAIR), scale: sc, hat: hatC,
            pack: L.pack && r() < L.pack ? r.pick(['#1f2937', '#374151', '#7c2d12', '#1e3a8a', '#3f3f46']) : null,
            prop: r.pick(L.prop || ['none']), apron: L.apron ? r.pick(L.apron) : L.bib || null, female: r() < 0.5,
        };
    }
    _ped(persona, x, z, yaw, act, extra = {}) {
        const look = this._look(persona);
        const p = { persona, look, x, z, y: 0, yaw, tyaw: yaw, act, phase: this.r() * 6.28, speed: 0, base: act, cd: 0, pose: null, poseT: 0, id: this.peds.length, sayCd: 0, ...extra };
        p.y = extra.y ?? this.ground.heightAt(x, z);
        this.peds.push(p); return p;
    }
    _spawnGroup(g) {
        const r = this.r, n = g.n || 1;
        for (let i = 0; i < n; i++) {
            let x, z, yaw;
            if (g.line) { // queue along a polyline (first = front)
                const sp = g.spacing || 0.85; let s = i * sp, k = 1;
                for (; k < g.line.length; k++) { const L = Math.hypot(g.line[k][0] - g.line[k - 1][0], g.line[k][1] - g.line[k - 1][1]); if (s <= L) break; s -= L; }
                k = Math.min(k, g.line.length - 1);
                const a = g.line[k - 1], b = g.line[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = clamp(s / L, 0, 1);
                x = a[0] + (b[0] - a[0]) * t + r.range(-0.12, 0.12); z = a[1] + (b[1] - a[1]) * t + r.range(-0.12, 0.12); yaw = Math.atan2(a[0] - b[0], a[1] - b[1]);
            } else {
                const ang = r() * 6.28, rad = (g.r ?? 2) * Math.sqrt(r());
                x = g.x + Math.cos(ang) * rad; z = g.z + Math.sin(ang) * rad;
                yaw = g.yaw ?? (g.look ? Math.atan2(g.look[0] - x, g.look[1] - z) : r() * 6.28);
                if (g.act === 'talk' && n > 1) { yaw = Math.atan2(g.x - x, g.z - z); }
            }
            const persona = this.pickPersona(g.personas);
            const p = this._ped(persona, x, z, yaw, g.act || 'watch', { home: { x, z, yaw }, lookAt: g.look, y: g.y !== undefined ? (typeof g.y === 'function' ? g.y(x, z) : g.y) : undefined, group: g });
            if (g.prop) p.look.prop = g.prop;
            if (g.act === 'photo' && p.look.prop === 'none') p.look.prop = 'phone';
        }
    }
    _spawnWalker(avoid = null) {
        const r = this.r;
        for (let tries = 0; tries < 12; tries++) {
            const line = r.pick(this.net), i = r.int(0, line.pts.length - 1), [x, z] = line.pts[i];
            if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 25) continue;
            const dir = i === 0 ? 1 : i === line.pts.length - 1 ? -1 : r() < 0.5 ? 1 : -1;
            const p = this._ped(this.pickPersona(), x, z, 0, 'walk', { line, i: i + dir, dir, off: r.range(-0.7, 0.7), vmax: r.range(1.1, 1.55) });
            return p;
        }
        return null;
    }
    _buildMeshes() {
        const G = partGeos(), N = this.peds.length, grp = new THREE.Group(); grp.name = 'crowd';
        // bodies: the shared instanced crowd (crowd.js: 2 draw calls, walk cycle in the shader, outfits by city / season /
        // weather); the legacy part meshes below only draw people who sit (benches, terraces, chess) and hand-held props
        this.cr = null;
        try {
            const city = this.o.city === 'bucharest' ? 'bucharest' : 'seattle', season = seasonOf(this.o.date || new Date()), r = this.r;
            this.cr = makeCrowd({ max: N, city, season, weather: null, rng: () => r() });
            this.cr.count = N; grp.add(this.cr.object);
            this.peds.forEach((p, i) => { const o = dressFor(city, season, null, () => r(), p.persona === 'guard' || p.persona === 'staff' ? 'adult' : 'adult'); const L = LOOKS[p.persona]; if (L && /guide|tour_guide|waiter|guard|vendor|fishmonger|staff|busker/.test(p.persona)) { o.top = p.look.top; o.bottom = p.look.legs; } if (p.look.scale < 0.8) o.flags = (o.flags || 0) & ~2; this.cr.dress(i, o); });
        } catch (e) { console.warn('[spots] crowd.js unavailable, legacy figures', e); this.cr = null; }
        const mk = (geo, n, name, vc = true) => {
            const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: vc && !!geo.attributes.color }), Math.max(1, n));
            m.name = 'crowd:' + name; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
            m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3);
            grp.add(m); return m;
        };
        this.mesh = {
            legs: mk(G.leg, N * 2, 'legs'), arms: mk(G.arm, N * 2, 'arms'), hands: mk(G.hand, N * 2, 'hands'), torso: mk(G.torso, N, 'torso'), head: mk(G.head, N, 'head'),
            hair: mk(G.hair, N, 'hair'), hat: mk(G.hat, N, 'hat'), pack: mk(G.pack, N, 'pack'), prop: mk(G.prop, N, 'prop'), apron: mk(G.apron, N, 'apron'),
        };
        this.group = grp;
        this.peds.forEach((p, i) => this._colour(p, i));
        for (const m of Object.values(this.mesh)) m.instanceColor.needsUpdate = true;
        this.update(0, null, null);
    }
    _colour(p, i) {
        const M = this.mesh, L = p.look, set = (m, k, c) => m.setColorAt(k, _c.set(c || '#888'));
        set(M.legs, i * 2, L.legs); set(M.legs, i * 2 + 1, L.legs);
        set(M.arms, i * 2, L.top); set(M.arms, i * 2 + 1, L.top);
        set(M.hands, i * 2, L.skin); set(M.hands, i * 2 + 1, L.skin);
        set(M.torso, i, L.top); set(M.head, i, L.skin); set(M.hair, i, L.hair); set(M.hat, i, L.hat || '#000');
        set(M.pack, i, L.pack || '#000'); set(M.prop, i, PROP[L.prop]?.c || '#000'); set(M.apron, i, L.apron || '#000');
    }
    /** walkable lines for spawning from a scene */
    get count() { return this.peds.length; }

    // -------------------------------------------------------------- simulation
    /**
     * @param {number} dt
     * @param {{x,z,y,speed,heading}} player
     * @param {THREE.Camera} camera
     */
    update(dt, player, camera) {
        this.t += dt; this.globalCd -= dt; this.chatT -= dt;
        const r = this.r;
        for (const p of this.peds) {
            p.cd -= dt; p.sayCd -= dt; p.poseT -= dt; if (p.poseT <= 0) p.pose = null;
            const dP = player ? Math.hypot(p.x - player.x, p.z - player.z) : 1e9;
            if (p.act === 'walk') this._walk(p, dt, player, dP);
            else {
                p.speed = 0;
                // fidget: dwellers shift weight, look around, sometimes turn toward the player
                if (player && dP < 4.5 && !p.group?.fixedYaw) p.tyaw = Math.atan2(player.x - p.x, player.z - p.z);
                else if (p.home) p.tyaw = p.home.yaw + Math.sin(this.t * 0.3 + p.id) * 0.25;
            }
            // turn smoothly
            let dy = p.tyaw - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * Math.min(1, dt * (p.act === 'walk' ? 6 : 2.5));
            // reactions to the player
            if (player) this._react(p, dt, player, dP);
        }
        // idle near people → someone comments
        if (player) {
            if (player.speed < 0.25) this.idleT += dt; else this.idleT = 0;
            if (this.idleT > 9 && this.globalCd <= 0) { const p = this._nearest(player, 7); if (p) { this._say(p, 'idle'); this.idleT = 0; } }
        }
        // ambient chatter among them (within earshot and on screen)
        if (this.chatT <= 0 && player && camera) {
            this.chatT = r.range(6, 12);
            const cand = this.peds.filter((p) => p.sayCd <= 0 && Math.hypot(p.x - player.x, p.z - player.z) < 26 && this._inView(p, camera));
            if (cand.length) { const p = r.pick(cand); if (!(this.rainy && r() < 0.3 && this._say(p, 'rain', { ambient: true }))) this._say(p, r() < 0.7 ? 'spot' : 'idle', { ambient: true }); }
        }
        this._writeMatrices();
    }
    _walk(p, dt, player, dP) {
        const line = p.line; let tgt = line.pts[p.i];
        if (!tgt) { this._nextLine(p); return; }
        // lateral offset (keep right)
        const prev = line.pts[p.i - p.dir] || tgt, sx = tgt[0] - prev[0], sz = tgt[1] - prev[1], sl = Math.hypot(sx, sz) || 1;
        const tx = tgt[0] - sz / sl * p.off, tz = tgt[1] + sx / sl * p.off;
        let dx = tx - p.x, dz = tz - p.z; const d = Math.hypot(dx, dz);
        if (d < 0.6) { p.i += p.dir; if (p.i < 0 || p.i >= line.pts.length) this._nextLine(p); return; }
        dx /= d; dz /= d;
        // give way to the player: step aside / slow
        let v = p.vmax;
        if (player && dP < 2.2) { const ax = player.x - p.x, az = player.z - p.z; if (ax * dx + az * dz > 0) { v *= dP < 1 ? 0 : 0.5; const side = (ax * dz - az * dx) > 0 ? -1 : 1; dx += -dz * side * 0.6; dz += dx * side * 0.6; } }
        p.speed += (v - p.speed) * Math.min(1, dt * 3);
        p.x += dx * p.speed * dt; p.z += dz * p.speed * dt;
        p.y = this.ground.heightAt(p.x, p.z);
        p.tyaw = Math.atan2(dx, dz);
        p.phase += dt * p.speed * 4.6;
    }
    _nextLine(p) {
        const end = p.dir > 0 ? 1 : 0, links = p.line.links[end];
        if (links.length && this.r() < 0.92) {
            const L = this.r.pick(links); p.line = L.line;
            p.dir = L.i === 0 ? 1 : L.i === L.line.pts.length - 1 ? -1 : (this.r() < 0.5 ? 1 : -1); p.i = L.i + p.dir;
        } else { p.dir = -p.dir; p.i += p.dir * 2; if (p.i < 0 || p.i >= p.line.pts.length) p.i = clamp(p.i, 0, p.line.pts.length - 1); }
    }
    _react(p, dt, player, dP) {
        if (dP < 0.62 && player.speed > 0.7 && p.cd <= 0) { // bump
            p.cd = 5; this._say(p, 'bumped', { force: true });
            const ax = p.x - player.x, az = p.z - player.z, L = Math.hypot(ax, az) || 1;
            if (p.act === 'walk') { p.x += ax / L * 0.25; p.z += az / L * 0.25; }
            p.pose = 'stumble'; p.poseT = 0.6;
        } else if (dP < 2.6 && player.speed > 0.3 && p.cd <= 0 && p.sayCd <= 0 && this.globalCd <= 0) {
            // greeting when the player approaches (facing them)
            const fx = -Math.sin(player.heading), fz = -Math.cos(player.heading);
            if (((p.x - player.x) * fx + (p.z - player.z) * fz) / dP > 0.5 && this.r() < 0.55) { p.cd = 25; this._say(p, 'greeting'); if (p.act !== 'walk') { p.pose = 'wave'; p.poseT = 1.6; } }
            else p.cd = 6;
        }
    }
    _inView(p, camera) {
        _v.set(p.x, p.y + 1.6 * p.look.scale, p.z).project(camera);
        return _v.z < 1 && Math.abs(_v.x) < 0.95 && Math.abs(_v.y) < 0.95;
    }
    _nearest(player, R) {
        let best = null, bd = R;
        for (const p of this.peds) { const d = Math.hypot(p.x - player.x, p.z - player.z); if (d < bd && p.sayCd <= 0) { bd = d; best = p; } }
        return best;
    }
    /** the player took a photo: people in the frame react (pose / comment) */
    onPhoto(camera) {
        const hits = this.peds.filter((p) => this._inView(p, camera) && camera.position && p.y !== undefined)
            .map((p) => ({ p, d: _v.set(p.x, p.y + 1.5, p.z).distanceTo(camera.getWorldPosition(new THREE.Vector3())) })).filter((h) => h.d < 28).sort((a, b) => a.d - b.d).slice(0, 2);
        for (const h of hits) { h.p.pose = this.r() < 0.5 ? 'peace' : 'wave'; h.p.poseT = 2.5; h.p.tyaw = Math.atan2(camera.position.x - h.p.x, camera.position.z - h.p.z); }
        if (hits[0]) this._say(hits[0].p, 'photographed', { force: true });
        return hits.length;
    }
    /** does a line's time / weather / season tag fit the current conditions? (untagged lines always fit) */
    fits(l) {
        const c = this.cond; if (!c || (!l.when && !l.wx && !l.season)) return true;
        const h = c.hour ?? 12, m = c.month ?? 6, t = c.tempC, k = c.kind || '';
        if (l.when === 'morning' && !(h >= 5 && h < 11)) return false;
        if (l.when === 'evening' && !(h >= 18 || h < 4)) return false;
        if (l.when === 'day' && !(h >= 9 && h < 19)) return false;
        if (l.wx === 'rain' && !/rain|drizzle|storm|shower/.test(k)) return false;
        if (l.wx === 'snow' && !(/snow/.test(k) || (c.snowCm || 0) > 0)) return false;
        if (l.wx === 'hot' && !(t !== undefined && t !== null ? t >= 25 : m >= 5 && m <= 7)) return false;
        if (l.wx === 'cold' && !(t !== undefined && t !== null ? t <= 4 : m === 11 || m <= 1)) return false;
        if (l.season === 'xmas' && !(m === 11 || (m === 10 && (c.day || 1) >= 25))) return false;
        if (l.season === 'march' && !(m === 2 && (c.day || 1) <= 9)) return false;
        if (l.season === 'winter' && !(m === 11 || m <= 1)) return false;
        if (l.season === 'spring' && !(m >= 2 && m <= 4)) return false;
        if (l.season === 'summer' && !(m >= 5 && m <= 8)) return false;
        if (l.season === 'autumn' && !(m >= 8 && m <= 10)) return false;
        return true;
    }
    /** pick a dialogue line for persona + context (scene lines first, then city-wide), avoiding repeats.
     *  Lines tagged for the current time / weather / season are preferred (about half the time when there are any). */
    pickLine(persona, ctx) {
        const fresh = (l) => !this.recent.includes(l);
        const ok = (l) => l.ctx === ctx && this.fits(l);
        const pools = [
            this.lines.filter((l) => ok(l) && l.p === persona), this.general.filter((l) => ok(l) && l.p === persona),
            this.lines.filter(ok), this.general.filter(ok),
        ];
        const tagged = pools[0].concat(pools[2]).filter((l) => (l.when || l.wx || l.season) && fresh(l));
        if (tagged.length && this.r() < 0.5) return this.r.pick(tagged);
        for (const pool of pools) { const f = pool.filter(fresh); if (f.length) return this.r.pick(f); }
        for (const pool of pools) if (pool.length) return this.r.pick(pool);
        return null;
    }
    _say(p, ctx, { force = false, ambient = false } = {}) {
        if (!force && (p.sayCd > 0 || this.globalCd > 0)) return false;
        const line = this.pickLine(p.persona, ctx); if (!line) return false;
        // a line written for another persona: borrow its voice only if this persona has nothing for the context
        this.recent.push(line); if (this.recent.length > 8) this.recent.shift();
        p.sayCd = 9; this.globalCd = ambient ? 1.5 : 2.2;
        const main = line.orig || line.text, sub = line.orig ? line.text : '';
        this.o.bubbles?.say(this._headRef(p), main, sub, ctx === 'bumped' ? 'angry' : ctx === 'greeting' ? 'friendly' : '', line.lang);
        this.onSay?.(p, line, ctx);
        if (p.act !== 'walk' && !p.pose) { p.pose = 'talk'; p.poseT = 2.5; }
        return true;
    }
    _headRef(p) { return { get x() { return p.x; }, get z() { return p.z; }, get y() { return p.y + 1.95 * p.look.scale + (p.act === 'sit' ? -0.45 : 0); } }; }
    /** obstacles for the walker (nearby peds as small boxes) */
    obstacles(x, z, R = 3) {
        const out = [];
        for (const p of this.peds) { if (Math.abs(p.x - x) > R || Math.abs(p.z - z) > R) continue; out.push({ x: p.x, z: p.z, fx: Math.sin(p.yaw), fz: Math.cos(p.yaw), length: 0.34, width: 0.5, ped: p, y: p.y }); }
        return out;
    }

    // -------------------------------------------------------------- animation → instance matrices
    _writeMatrices() {
        const M = this.mesh; if (!M) return;
        const cr = this.cr; if (cr && this.rainy !== this._crRain) { this._crRain = this.rainy; cr.setWeather(this.rainy ? 'rain' : 'clear'); }
        for (let i = 0; i < this.peds.length; i++) {
            const p = this.peds[i], L = p.look, s = L.scale, walking = p.act === 'walk' && p.speed > 0.1;
            const legacy = !cr || p.act === 'sit';
            if (cr) { if (legacy) cr.hide(i); else cr.set(i, { x: p.x, y: p.y, z: p.z, yaw: p.yaw + Math.PI, phase: p.phase, amp: walking ? clamp(p.speed / 1.4, 0.2, 1) : 0, scale: s }); }
            const sw = walking ? Math.sin(p.phase) * clamp(p.speed / 1.4, 0, 1.2) : 0;
            const sitting = p.act === 'sit';
            const bob = walking ? Math.abs(Math.cos(p.phase)) * 0.035 : Math.sin(this.t * 1.3 + i) * 0.004;
            const hipY = sitting ? 0.47 : 0.92;
            // base (feet on the ground)
            _b.compose(_v.set(p.x, p.y + bob * s, p.z), _q.setFromAxisAngle(_s.set(0, 1, 0), p.yaw), _s.set(s, s, s));
            const part = (mesh, k, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
                if (!legacy && mesh !== M.prop) { sx = sy = sz = 0; }
                _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
                _m.premultiply(_b); mesh.setMatrixAt(k, _m);
            };
            // legs
            const legA = sitting ? -1.45 : sw * 0.5;
            part(M.legs, i * 2, -0.1, hipY, 0, legA, 0, 0, 1, sitting ? 0.92 : 1);
            part(M.legs, i * 2 + 1, 0.1, hipY, 0, sitting ? -1.45 : -sw * 0.5, 0, 0, 1, sitting ? 0.92 : 1);
            // torso (slight lean when walking)
            const lean = walking ? 0.06 * p.speed : 0;
            part(M.torso, i, 0, hipY - 0.02, 0, lean);
            // arms by pose
            let aL = -sw * 0.4, aR = sw * 0.4, zL = -0.08, zR = 0.08; // rz > 0 swings an arm toward +x
            const pose = p.pose || ({ photo: 'photo', perform: 'perform', guide: 'flag', throw: 'throw' })[p.act] || (L.prop === 'flag' ? 'flag' : null);
            const tt = this.t * 6 + i;
            if (pose === 'photo') { aR = -1.45; aL = -1.3; zL = 0.32; zR = -0.32; }
            else if (pose === 'wave') { aR = -2.8; zR = 0.25 + Math.sin(tt) * 0.25; }
            else if (pose === 'peace') { aR = -2.4; zR = 0.1; aL = -0.2; }
            else if (pose === 'talk') { aR = -0.6 + Math.sin(tt * 0.6) * 0.25; aL = -0.25 + Math.sin(tt * 0.5 + 1) * 0.15; }
            else if (pose === 'flag') { aR = -2.9; zR = 0.05; }
            else if (pose === 'perform') { aR = -0.9 + Math.sin(tt * 1.4) * 0.25; aL = -1.2; zL = 0.5; zR = -0.25; }
            else if (pose === 'throw') { const k = Math.sin(this.t * 2.2 + i); aR = -1.2 - k * 1.4; aL = -1.2 - k * 1.4; }
            else if (pose === 'stumble') { aR = -1.0; aL = -1.0; zR = 0.6; zL = -0.6; }
            else if (L.prop === 'phone' && !walking && (i % 3 === 0)) { aR = -1.1; zR = -0.25; }
            else if (L.prop === 'cup' && (i % 2 === 0)) { aR = -1.3; zR = -0.15; }
            const shY = hipY + 0.55;
            part(M.arms, i * 2, -0.235, shY, 0, aL, 0, zL);
            part(M.arms, i * 2 + 1, 0.235, shY, 0, aR, 0, zR);
            // hands at the forearm ends
            const hand = (k, sxn, a, z) => { // end of the 0.6 m arm: R = Ry·Rx(a)·Rz(z) applied to (0, −0.6, 0)
                const x = sxn * 0.235 + 0.6 * Math.sin(z), y = shY - 0.6 * Math.cos(z) * Math.cos(a), zz = -0.6 * Math.cos(z) * Math.sin(a);
                part(M.hands, k, x, y, zz); return [x, y, zz];
            };
            const hl = hand(i * 2, -1, aL, zL), hr = hand(i * 2 + 1, 1, aR, zR);
            // head (+ looks around slightly)
            const nod = pose === 'talk' ? Math.sin(tt * 0.8) * 0.08 : 0;
            part(M.head, i, 0, shY + 0.21, 0.01, nod, walking ? 0 : Math.sin(this.t * 0.4 + i * 1.7) * 0.25);
            part(M.hair, i, 0, shY + 0.21, 0.01, nod, 0, 0, L.hat ? 0 : 1, L.hat ? 0 : 1, L.hat ? 0 : 1);
            part(M.hat, i, 0, shY + 0.27, 0.01, nod, 0, 0, L.hat ? 1 : 0, L.hat ? 1 : 0, L.hat ? 1 : 0);
            part(M.pack, i, 0, hipY + 0.36, -0.18, lean, 0, 0, L.pack ? 1 : 0, L.pack ? 1 : 0, L.pack ? 1 : 0);
            part(M.apron, i, 0, hipY + 0.12, 0.13, lean, 0, 0, L.apron ? 1 : 0, L.apron ? (p.persona === 'fishmonger' ? 1.15 : 1) : 0, L.apron ? 1 : 0);
            // prop in the right hand
            const pr = PROP[L.prop];
            if (pr) {
                if (pr.body) part(M.prop, i, 0.02, hipY + 0.25, 0.2, 0, 0, 0.9, ...pr.s);
                else if (pr.hang) part(M.prop, i, hr[0], hr[1] - pr.s[1] / 2, hr[2], 0, 0, 0, ...pr.s);
                else if (pr.up) part(M.prop, i, hr[0], hr[1] + pr.s[1] / 2 - 0.05, hr[2], 0, 0, 0, ...pr.s);
                else part(M.prop, i, hr[0], hr[1] + 0.02, hr[2] + 0.03, aR + 1.6, 0, 0, ...pr.s);
            } else part(M.prop, i, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            void hl;
        }
        if (this._anyLegacy === undefined) { this._anyLegacy = !cr || this.peds.some((p) => p.act === 'sit'); this._anyProp = this.peds.some((p) => PROP[p.look.prop]); for (const [k, m] of Object.entries(M)) m.visible = k === 'prop' ? this._anyProp || this._anyLegacy : this._anyLegacy; }
        for (const m of Object.values(M)) m.instanceMatrix.needsUpdate = true;
    }
    dispose() { this.cr?.dispose(); this.group?.traverse((o) => { if (o.isMesh && !o.userData.shared) { o.geometry.dispose(); o.material.dispose(); } }); }
}
