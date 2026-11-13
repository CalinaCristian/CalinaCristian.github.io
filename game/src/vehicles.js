import * as THREE from '../vendor/three.module.min.js';
import { Batch, CARS, boxTruck, deliveryVan, kcmBus, policeCar, stbBus, stbTram, taxiCar } from './vehicle-models.js';
import { ENV_MAP, bodyMat, fleetMaterial, getTaxiSign, parkedMaterial, partsMat } from './vehicle-materials.js';
export { CAR_COLORS } from './vehicle-models.js';
export { setVehicleSnow, setVehicleEnvMap } from './vehicle-materials.js';
export { makeCockpit } from './vehicle-cockpit.js';

// ============================================================================
//  VEHICLES — country-specific fleet of unbranded silhouettes with real L/W/H,
//  built from extruded side profiles. One geometry per kind (+ a ~150-tri far
//  LOD) with per-vertex aMat = (emissive code, roughness, metalness, painted).
//  Traffic uses the instanced path (one draw call per kind × LOD for all cars);
//  the classic path = painted body mesh (per-colour material) + parts mesh.
//  forward = -z, ground at y = 0.
// ============================================================================

// ---------------------------------------------------------------------------
//  Kind registry, fleet mix, paint statistics
// ---------------------------------------------------------------------------
/** city used for plates / police livery / 'bus' alias when makeVehicle gets no `city` option (call per city load) */
let FLEET_CITY = 'bucharest';
export function setFleetCity(cityId) { FLEET_CITY = cityId === 'seattle' ? 'seattle' : 'bucharest'; }
const US = (city) => city === 'seattle';
const BUILDERS = {
    sedan: (c) => CARS.sedan(US(c) ? 'us' : 'eu'), 'compact-sedan': (c) => CARS['compact-sedan'](US(c) ? 'us' : 'eu'),
    hatch: (c) => CARS.hatch(US(c) ? 'us' : 'eu'), estate: (c) => CARS.estate(US(c) ? 'us' : 'eu'), 'small-suv': (c) => CARS['small-suv'](US(c) ? 'us' : 'eu'),
    crossover: (c) => CARS.crossover(US(c) ? 'us' : 'eu'), suv: (c) => CARS.suv(US(c) ? 'us' : 'eu'), 'ev-sedan': (c) => CARS['ev-sedan'](US(c) ? 'us' : 'eu'),
    minivan: (c) => CARS.minivan(US(c) ? 'us' : 'eu'), pickup: (c) => CARS.pickup(US(c) ? 'us' : 'eu'), van: (c) => CARS.van(US(c) ? 'us' : 'eu'),
    'delivery-van': (c) => deliveryVan(US(c) ? 'us' : 'eu'), truck: (c) => boxTruck(US(c) ? 'us' : 'eu'),
    taxi: (c) => taxiCar(US(c) ? 'us' : 'eu'), police: (c) => policeCar(US(c) ? 'us' : 'eu', c),
    'stb-bus': () => stbBus('eu'), trolleybus: () => stbBus('eu', true), 'kcm-bus': () => kcmBus('us'), 'kcm-artic': () => kcmBus('us', true),
    tram: () => stbTram('v3a'), 'tram-v3a': () => stbTram('v3a'), 'tram-imperio': () => stbTram('imperio'),
    bus: (c) => (US(c) ? kcmBus('us') : stbBus('eu')),
};
export const VEHICLE_KINDS = Object.keys(BUILDERS);
/** kinds that only make sense in one city (their plates follow it) */
const HOME = { 'stb-bus': 'bucharest', trolleybus: 'bucharest', tram: 'bucharest', 'tram-v3a': 'bucharest', 'tram-imperio': 'bucharest', 'kcm-bus': 'seattle', 'kcm-artic': 'seattle' };

// share of the moving car fleet per city (passenger cars + vans/trucks; transit, police and taxis on top are the
// caller's choice — Bucharest taxis are in the mix since they are ~5–10 % of central traffic)
const MIX = {
    bucharest: [['hatch', 0.2], ['compact-sedan', 0.19], ['estate', 0.11], ['small-suv', 0.13], ['sedan', 0.08], ['crossover', 0.05], ['taxi', 0.09], ['van', 0.05], ['delivery-van', 0.06], ['ev-sedan', 0.01], ['truck', 0.03]],
    seattle: [['crossover', 0.24], ['sedan', 0.15], ['pickup', 0.16], ['suv', 0.13], ['ev-sedan', 0.07], ['minivan', 0.06], ['hatch', 0.06], ['delivery-van', 0.05], ['van', 0.02], ['truck', 0.03], ['compact-sedan', 0.03]],
};
// body colour shares (European / US fleet surveys: white, grey, black and silver ≈ 70–80 % of cars)
const PAINT_EU = [[['#eef0f1', '#f6f6f3', '#e4e6e7'], 0.24], [['#6d7177', '#55595f', '#868a8f', '#3f4348'], 0.21], [['#111214', '#1b1d21'], 0.15], [['#b9bdc2', '#a5aab0'], 0.11],
    [['#1f3f7a', '#2a5291', '#17284a', '#3b6ea8'], 0.12], [['#9a1b1f', '#b3262b', '#6e1418'], 0.07], [['#5a4636', '#b8a78a', '#7a6a55'], 0.05], [['#2f4a3a', '#43573f'], 0.02], [['#c8641e', '#d6a81c'], 0.02], [['#5b2a3a'], 0.01]];
const PAINT_US = [[['#eef0f1', '#f6f6f3', '#e2e4e5'], 0.25], [['#111214', '#1b1d21', '#0c0d0f'], 0.22], [['#6d7177', '#55595f', '#868a8f', '#43474c'], 0.19], [['#b9bdc2', '#a5aab0'], 0.11],
    [['#1f3f7a', '#2a5291', '#17284a', '#3e6f99'], 0.09], [['#9a1b1f', '#b3262b', '#7a1418'], 0.09], [['#2f4a3a', '#56603f'], 0.02], [['#5a4636', '#8c7a5e'], 0.02], [['#c8641e', '#e0b324'], 0.01]];
const pickW = (list, r) => { let t = 0; for (const [, w] of list) t += w; let x = r() * t; for (const [k, w] of list) { if ((x -= w) <= 0) return k; } return list[list.length - 1][0]; };
const R01 = (rng) => (typeof rng === 'function' ? rng : Math.random);
/** the city's car mix as [[kind, weight], …] (weights sum to 1) — what traffic.js feature-detects */
export function fleetMix(cityId) { return MIX[cityId === 'seattle' ? 'seattle' : 'bucharest'].map(([k, w]) => [k, w]); }
/** a car kind for this city's moving traffic (weights = real fleet mix). rng: () → [0,1) (or an object with .random / the traffic RNG function) */
export function pickFleetKind(cityId, rng = Math.random) { return pickW(MIX[cityId === 'seattle' ? 'seattle' : 'bucharest'], R01(rng)); }
/** transit kind for a mode: 'bus' | 'trolleybus' | 'tram' (Bucharest trams: ~1/3 Imperio, rest V3A family; Seattle: ~30 % articulated) */
export function pickTransitKind(cityId, mode = 'bus', rng = Math.random) {
    const r = R01(rng)();
    if (cityId === 'seattle') return mode === 'bus' ? (r < 0.3 ? 'kcm-artic' : 'kcm-bus') : 'kcm-bus';
    if (mode === 'tram') return r < 0.35 ? 'tram-imperio' : 'tram-v3a';
    if (mode === 'trolleybus') return 'trolleybus';
    return 'stb-bus';
}
/** body colour for a kind in this city (fleet statistics; fixed liveries for taxis, police, transit, delivery vans mostly white) */
export function fleetColor(kind, cityId, rng = Math.random) {
    const r = R01(rng); const sea = cityId === 'seattle';
    if (kind === 'taxi') return sea ? '#f6f6f3' : '#f2c200';
    if (kind === 'police') return sea ? '#121316' : '#f4f5f7';
    if (HOME[kind] || kind === 'bus') return null; // livery
    if (kind === 'delivery-van' && r() < 0.75) return '#f3f4f2';
    if (kind === 'van' && r() < 0.45) return '#eef0f1';
    if (kind === 'truck') return pickW([['#eef0f1', 0.6], ['#c0322b', 0.1], ['#1f3f7a', 0.15], ['#55595f', 0.15]], r);
    const shades = pickW(sea ? PAINT_US : PAINT_EU, r);
    return shades[Math.floor(r() * shades.length) % shades.length];
}

const cache = {};
function vehicleModel(kind, city) {
    if (!BUILDERS[kind]) kind = 'sedan';
    const c = HOME[kind] || city || FLEET_CITY;
    const key = kind + '|' + (US(c) ? 'us' : 'eu');
    let m = cache[key];
    if (!m) {
        m = cache[key] = BUILDERS[kind](c);
        m.key = key; m.kind = kind;
        m.geo.computeBoundingSphere(); m.radius = Math.hypot(m.length / 2, m.width / 2, (m.height || 2) / 2);
        if (m.sections) m.sectionModels = sectionModels(m);
        // split into painted body + parts for the classic (non-instanced) meshes
        m.split = null;
    }
    return m;
}
/** the triangles of g whose centroid z lies in [lo, hi), moved by dz along z (one tram section, centred on its own origin) */
function sliceZ(g, lo, hi, dz) {
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, a = g.attributes.aMat, idx = g.index, out = new Batch(), map = new Map();
    for (let i = 0; i < idx.count; i += 3) {
        const tri = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)], cz = (p.getZ(tri[0]) + p.getZ(tri[1]) + p.getZ(tri[2])) / 3;
        if (cz < lo || cz >= hi) continue;
        for (const v of tri) {
            let j = map.get(v);
            if (j === undefined) {
                j = out.n++; map.set(v, j);
                out.pos.push(p.getX(v), p.getY(v), p.getZ(v) + dz); out.nor.push(n.getX(v), n.getY(v), n.getZ(v));
                out.col.push(c.getX(v), c.getY(v), c.getZ(v)); out.mat.push(a ? a.getX(v) : 0, a ? a.getY(v) : 0, a ? a.getZ(v) : 0, a ? a.getW(v) : 0);
            }
            out.idx.push(j);
        }
    }
    return out.build(!!a);
}
/** articulated models: one instanced model per section (cut half way across each joint gap), centred on the section */
function sectionModels(m) {
    const S = m.sections, last = S.length - 1;
    return S.map((q, i) => {
        const lo = i ? (S[i - 1].z1 + q.z0) / 2 : -Infinity, hi = i < last ? (q.z1 + S[i + 1].z0) / 2 : Infinity, centerZ = (q.z0 + q.z1) / 2, length = q.z1 - q.z0;
        const geo = sliceZ(m.geo, lo, hi, -centerZ), far = sliceZ(m.far, lo, hi, -centerZ);
        return { key: m.key + '#' + i, kind: m.kind, geo, far, length, width: m.width, height: m.height, transit: m.transit, centerZ, radius: Math.hypot(length / 2 + .5, m.width / 2, (m.height || 2) / 2) };
    });
}
function splitModel(m, lod = 'near') {
    if (lod === 'parked') return m.splitParked || (m.splitParked = splitGeo(m.parked || m.far));
    return m.split || (m.split = splitGeo(m.geo));
}
function splitGeo(g) {
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, a = g.attributes.aMat, idx = g.index;
    const body = new Batch(), parts = new Batch(), map = [new Map(), new Map()];
    for (let i = 0; i < idx.count; i += 3) {
        const tri = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
        const painted = a.getW(tri[0]) > 0.5, tgt = painted ? body : parts, mp = map[painted ? 0 : 1];
        for (const v of tri) {
            let j = mp.get(v);
            if (j === undefined) {
                j = tgt.n++; mp.set(v, j);
                tgt.pos.push(p.getX(v), p.getY(v), p.getZ(v)); tgt.nor.push(n.getX(v), n.getY(v), n.getZ(v));
                tgt.col.push(c.getX(v), c.getY(v), c.getZ(v)); tgt.mat.push(a.getX(v), a.getY(v), a.getZ(v), 0);
            }
            tgt.idx.push(j);
        }
    }
    return { body: body.build(false), parts: parts.build() };
}
const POLICE_LAMP = new THREE.BoxGeometry(0.42, 0.1, 0.22);
function policeLamps(grp, bar) {
    const mL = new THREE.MeshBasicMaterial({ color: '#1e3a8a' }), mR = new THREE.MeshBasicMaterial({ color: FLEET_CITY === 'seattle' && bar.w > 1.15 ? '#7f1d1d' : '#1e3a8a' });
    const l = new THREE.Mesh(POLICE_LAMP, mL), r = new THREE.Mesh(POLICE_LAMP, mR);
    l.position.set(-bar.w / 4, bar.y, bar.z); r.position.set(bar.w / 4, bar.y, bar.z); l.userData.shared = r.userData.shared = true;
    grp.add(l, r);
    const redR = grp.userData.city === 'seattle';
    grp.userData.flash = (t) => {
        const ph = (t * 2.2) % 1, a = ph < 0.25 && (ph * 16 | 0) % 2 === 0, b = ph > 0.5 && ph < 0.75 && (ph * 16 | 0) % 2 === 0;
        mL.color.setRGB(a ? 0.4 : 0.03, a ? 0.8 : 0.06, a ? 6 : 0.25);
        if (redR) mR.color.setRGB(b ? 6 : 0.25, b ? 0.3 : 0.03, b ? 0.3 : 0.03); else mR.color.setRGB(b ? 0.4 : 0.03, b ? 0.8 : 0.06, b ? 6 : 0.25);
    };
    return [l, r];
}

// ---------------------------------------------------------------------------
//  Instanced fleet: every instanced vehicle of a kind (+ LOD) in a scene = 1 draw call.
//  Hooked into Scene.prototype.onBeforeRender (runs after the scene's matrixWorld update, before culling), so the
//  vehicle groups stay ordinary Object3Ds that callers move / hide / add / remove as before.
// ---------------------------------------------------------------------------
const LIVE = new Set();            // WeakRef<Group> of instanced vehicles
const SCENE_POOLS = new WeakMap(); // Scene → Map<key, Pool>
const TAXI_SIGN_POOLS = new WeakMap(); // Scene → shared-template signs, owned instance buffers
const FLEET_OPTS = { near: 70, nearBig: 140, far: 1200, margin: 8 };
export const fleetStats = { instances: 0, near: 0, far: 0, culled: 0, pools: 0, ms: 0 };
class Pool {
    constructor(geo, cast) { this.base = geo; this.cast = cast; this.cap = 0; this.n = 0; this.mesh = null; this.grow(32); }
    grow(cap) {
        const old = this.mesh;
        const g = new THREE.BufferGeometry();
        for (const k in this.base.attributes) g.setAttribute(k, this.base.attributes[k]);
        g.setIndex(this.base.index); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
        this.paint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.paint.setUsage(THREE.DynamicDrawUsage);
        this.lb = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); this.lb.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('aPaint', this.paint); g.setAttribute('aLB', this.lb);
        const mesh = new THREE.InstancedMesh(g, fleetMaterial(), cap);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false; mesh.castShadow = this.cast; mesh.receiveShadow = true; mesh.count = 0;
        mesh.name = 'fleet'; mesh.userData.shared = true; mesh.userData.fleet = true;
        if (old) { // keep what this render already wrote
            mesh.instanceMatrix.array.set(old.instanceMatrix.array); this.paint.array.set(old.geometry.attributes.aPaint.array); this.lb.array.set(old.geometry.attributes.aLB.array);
            old.parent?.add(mesh); old.parent?.remove(old); old.geometry.dispose(); old.dispose?.();
        }
        this.mesh = mesh; this.cap = cap;
    }
}
class TaxiSignPool {
    constructor(scene) { this.scene = scene; this.cap = 0; this.n = 0; this.mesh = null; this.grow(16); }
    grow(cap) {
        const old = this.mesh, sign = getTaxiSign();
        const mesh = new THREE.InstancedMesh(sign.geo, sign.mats, cap);
        mesh.name = 'fleet-taxi-signs'; mesh.userData.shared = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
        // Geometry/materials belong to getTaxiSign's cache; only this instance buffer belongs to the scene.
        if (old) { mesh.instanceMatrix.array.set(old.instanceMatrix.array); old.removeFromParent(); old.dispose(); }
        this.scene.add(mesh); this.mesh = mesh; this.cap = cap;
    }
    add(matrix) { if (this.n === this.cap) this.grow(this.cap * 2); this.mesh.setMatrixAt(this.n++, matrix); }
    finish() { this.mesh.count = this.n; this.mesh.visible = this.n > 0; if (this.n) this.mesh.instanceMatrix.needsUpdate = true; }
}
const _extraMatrix = new THREE.Matrix4(), _extraSphere = new THREE.Sphere();
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere(), _cp = new THREE.Vector3(), _col = new THREE.Color();
function fleetBeforeRender(renderer, scene, camera) {
    if (!LIVE.size || !camera) return;
    const t0 = performance.now();
    let pools = SCENE_POOLS.get(scene);
    if (!pools) SCENE_POOLS.set(scene, pools = new Map());
    for (const p of pools.values()) p.n = 0;
    let signs = TAXI_SIGN_POOLS.get(scene); if (signs) signs.n = 0;
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    _cp.setFromMatrixPosition(camera.matrixWorld);
    const now = t0 / 1000;
    let nNear = 0, nFar = 0, nCull = 0;
    for (const ref of LIVE) {
        const g = ref.deref();
        if (!g) { LIVE.delete(ref); continue; }
        let o = g, vis = true;
        while (o.parent) { if (!o.visible) { vis = false; break; } o = o.parent; }
        if (o !== scene || !vis || !scene.visible || !camera.layers.test(g.layers)) continue;
        const u = g.userData, e = g.matrixWorld.elements, m = u._model;
        // brake lights from the motion (decelerating or stopped in traffic), unless set explicitly / parked
        if (u._autoBrake && now - (u._tPrev || 0) > 0.04) {
            const dt = now - (u._tPrev || now - 1), dx = e[12] - (u._xPrev ?? e[12]), dz = e[14] - (u._zPrev ?? e[14]);
            const v = Math.hypot(dx, dz) / Math.max(dt, 1e-3), dv = v - (u._vPrev ?? v);
            const want = !u.parked && dt < 0.5 && (v < 0.4 ? (u._moved || false) : dv / dt < -0.9);
            if (v > 1) u._moved = true;
            u._brakeK += ((want ? 1 : 0) - u._brakeK) * Math.min(1, dt * 10);
            u._tPrev = now; u._xPrev = e[12]; u._zPrev = e[14]; u._vPrev = v;
        }
        _sp.center.set(e[12], e[13] + 1, e[14]); _sp.radius = m.radius + FLEET_OPTS.margin;
        const d = _sp.center.distanceTo(_cp);
        if (d > FLEET_OPTS.far || !_fr.intersectsSphere(_sp)) { nCull++; if (u._extras) for (const x of u._extras) x.visible = false; continue; }
        const near = d < (m.length > 7 ? FLEET_OPTS.nearBig : FLEET_OPTS.near);
        if (u._extras) for (const x of u._extras) x.visible = near;
        if (near && u._taxiSign && camera.layers.test(u._taxiSign.layers)) {
            const sign = u._taxiSign;
            _extraMatrix.multiplyMatrices(g.matrixWorld, sign.matrix);
            if (!sign.geometry.boundingSphere) sign.geometry.computeBoundingSphere();
            _extraSphere.copy(sign.geometry.boundingSphere).applyMatrix4(_extraMatrix);
            // The old child mesh was also frustum-culled independently of its parent vehicle.
            if (_fr.intersectsSphere(_extraSphere)) {
                if (!signs) { signs = new TaxiSignPool(scene); TAXI_SIGN_POOLS.set(scene, signs); }
                signs.add(_extraMatrix);
            }
        }
        const key = m.key + (near ? '' : '|far');
        let p = pools.get(key);
        if (!p) { p = new Pool(near ? m.geo : m.far, near || m.length > 7); pools.set(key, p); }
        if (p.n >= p.cap) p.grow(p.cap * 2);
        const i = p.n++;
        p.mesh.instanceMatrix.array.set(e, i * 16);
        p.paint.array[i * 3] = u._paint.r; p.paint.array[i * 3 + 1] = u._paint.g; p.paint.array[i * 3 + 2] = u._paint.b;
        p.lb.array[i * 2] = u._lights ? 1 : 0; p.lb.array[i * 2 + 1] = u._brake ?? u._brakeK;
        if (near) nNear++; else nFar++;
    }
    for (const p of pools.values()) {
        const mesh = p.mesh;
        if (p.n && mesh.parent !== scene) scene.add(mesh);
        mesh.count = p.n; mesh.visible = p.n > 0;
        if (p.n) { mesh.instanceMatrix.needsUpdate = true; p.paint.needsUpdate = true; p.lb.needsUpdate = true; }
    }
    signs?.finish();
    Object.assign(fleetStats, { instances: nNear + nFar, near: nNear, far: nFar, culled: nCull, pools: pools.size, ms: Math.round((performance.now() - t0) * 100) / 100 });
}
// other instanced renderers (crowd.js) that cull / fill per render call: fn(renderer, scene, camera)
const PRE_HOOKS = new Set();
/** register fn(renderer, scene, camera) to run in the shared Scene pre-render hook (before culling); returns the remover */
export function addPreRenderHook(fn) { PRE_HOOKS.add(fn); return () => PRE_HOOKS.delete(fn); }
export function getVehicleEnvMap() { return ENV_MAP; }
// install once (chained with any prototype hook present)
if (!THREE.Scene.prototype.__fleetHook) {
    const prev = THREE.Scene.prototype.onBeforeRender;
    THREE.Scene.prototype.onBeforeRender = function (renderer, scene, camera, rt) {
        prev?.call(this, renderer, scene, camera, rt);
        if (!camera) return;
        fleetBeforeRender(renderer, this, camera);
        for (const fn of PRE_HOOKS) fn(renderer, this, camera);
    };
    THREE.Scene.prototype.__fleetHook = true;
}
/** LOD / culling tuning: { near (m), nearBig (m, vehicles > 7 m), far (m), margin (m, frustum sphere padding for shadows) } */
export function setFleetOptions(o = {}) { Object.assign(FLEET_OPTS, o); }

/**
 * Create a vehicle. forward = −z, ground at y = 0. userData: length, width, height, kind, setLights(on), setBrake(on|null),
 * flash(t) (police). opts: { city: 'bucharest'|'seattle' (plates / police / 'bus' alias; default setFleetCity()),
 * instanced: true → no per-car meshes: drawn by the shared per-kind InstancedMeshes (≈ 1 draw call per kind and LOD),
 * near/far LOD + culling automatic; brake lights automatic from the motion (userData.parked = true disables) }.
 * Without `instanced` the group holds classic meshes (painted body + parts) — e.g. for baking into merged props.
 */
export function makeVehicle(kind, color, opts = {}) {
    const city = opts.city || FLEET_CITY;
    const m = vehicleModel(kind, city);
    if (m.paint && (m.transit || kind === 'police' || kind === 'taxi')) color = m.paint;
    else if (m.paint && !color) color = m.paint;
    if (!color) color = fleetColor(m.kind, city) || '#c9ccd1';
    const grp = new THREE.Group();
    const u = grp.userData;
    u.length = m.length; u.width = m.width; u.height = m.height; u.kind = m.kind; u.city = HOME[m.kind] || city; u.transit = m.transit || null;
    // (articulated body: each section's centre, forward of the body centre, and its length)
    if (m.sections) u.sections = m.sections.map(q => ({ along: -(q.z0 + q.z1) / 2, length: q.z1 - q.z0 }));
    const extras = [];
    if (m.taxiSign) {
        const s = getTaxiSign();
        const sign = new THREE.Mesh(s.geo, s.mats); sign.userData.shared = true;
        sign.position.set(0, 1.66, 0.35);
        if (opts.instanced) { sign.updateMatrix(); u._taxiSign = sign; }
        else { grp.add(sign); extras.push(sign); }
    }
    if (m.bar) extras.push(...policeLamps(grp, m.bar));
    if (opts.instanced) {
        u._model = m; u._paint = new THREE.Color(color); u._lights = false; u._brake = null; u._brakeK = 0; u._autoBrake = true; u._extras = extras.length ? extras : null;
        u.instanced = true;
        u.setLights = (on) => { u._lights = !!on; };
        u.setBrake = (on) => { u._brake = on == null ? null : (on ? 1 : 0); };
        u.setColor = (c) => { u._paint.set(c); };
        if (m.sectionModels) { // one instanced child per section; the owner (traffic.js) poses them along the rail
            u._sectionGroups = m.sectionModels.map(sm => {
                const c = new THREE.Group(), cu = c.userData; c.position.z = sm.centerZ;
                cu._model = sm; cu._paint = u._paint; cu._brakeK = 0; cu._autoBrake = true; cu.instanced = true; cu.section = true; cu._extras = null;
                Object.defineProperty(cu, '_lights', { get: () => u._lights }); Object.defineProperty(cu, '_brake', { get: () => u._brake });
                grp.add(c); LIVE.add(new WeakRef(c)); return c;
            });
            return grp;
        }
        LIVE.add(new WeakRef(grp));
        return grp;
    }
    const parkedLod = opts.lod === 'parked';
    if (parkedLod) { for (const x of extras) grp.remove(x); extras.length = 0; u.lod = 'parked'; }
    const sp = splitModel(m, parkedLod ? 'parked' : 'near');
    const body = new THREE.Mesh(sp.body, bodyMat(color));
    body.castShadow = true;
    const parts = new THREE.Mesh(sp.parts, partsMat(false, false));
    body.userData.shared = parts.userData.shared = true;
    if (extras.length) grp.remove(...extras);
    grp.add(body, parts); // children[0] = body, [1] = parts (spots/cars.js merges them), extras after
    if (extras.length) grp.add(...extras);
    let L = false, B = false;
    u.setLights = (on) => { L = !!on; parts.material = partsMat(L, B); };
    u.setBrake = (on) => { B = !!on; parts.material = partsMat(L, B); };
    return grp;
}
/**
 * Static parked cars as instanced meshes: one InstancedMesh per kind (the ~100–170-tri low model: closed tinted glass,
 * no interior / underside, lights off), per-instance body colour. cars: [{ kind, color?, x, y?, z, yaw }] (yaw = rotation.y,
 * forward −z; colour default = fleetColor). Returns a Group to add to the scene (call it per world cell to keep frustum
 * culling useful); group.userData = { count, triangles, drawCalls }. Not part of the per-frame fleet hook (zero CPU per frame).
 * group.userData.dispose() frees the per-group instance buffers (the shared model geometry stays).
 */
export function makeParkedCars(cars, { city, castShadow = true, receiveShadow = true, paintSpace = 'linear' } = {}) {
    const c0 = city || FLEET_CITY, grp = new THREE.Group(), byKey = new Map();
    for (const car of cars) {
        const m = vehicleModel(car.kind, c0); let e = byKey.get(m.key);
        if (!e) byKey.set(m.key, e = { m, list: [] });
        e.list.push(car);
    }
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    let tris = 0, n = 0; const owned = [];
    for (const { m, list } of byKey.values()) {
        const g = new THREE.BufferGeometry();
        const pg = m.parked || m.far;
        for (const k in pg.attributes) g.setAttribute(k, pg.attributes[k]);
        g.setIndex(pg.index);
        const paint = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3), lb = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 2), 2);
        g.setAttribute('aPaint', paint); g.setAttribute('aLB', lb);
        const mesh = new THREE.InstancedMesh(g, parkedMaterial(), list.length);
        list.forEach((c, i) => {
            mesh.setMatrixAt(i, _m.compose(_p.set(c.x, c.y || 0, c.z), _q.setFromAxisAngle(_y, c.yaw || 0), _s));
            col.set(m.transit || m.paint ? (m.paint || '#cccccc') : (c.color || fleetColor(m.kind, c0) || '#c9ccd1'));
            if (paintSpace === 'world') col.convertLinearToSRGB(); // world convention: hex bytes / 255 used as linear (as the old merged lots)
            paint.setXYZ(i, col.r, col.g, col.b);
        });
        mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
        mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow; mesh.name = 'parked-cars ' + m.kind; mesh.userData.parkedFleet = true;
        grp.add(mesh); owned.push(g);
        tris += list.length * pg.index.count / 3; n += list.length;
    }
    grp.userData = { count: n, triangles: tris, drawCalls: byKey.size, dispose: () => { for (const g of owned) { g.deleteAttribute('aPaint'); g.deleteAttribute('aLB'); g.dispose(); } } };
    return grp;
}
/** triangle count of a kind's near / far model (diagnostics) */
export function vehicleTriangles(kind, lod = 'near', city) { const m = vehicleModel(kind, city); const g = lod === 'far' ? m.far : lod === 'parked' ? (m.parked || m.far) : m.geo; return g.index.count / 3; }
/** model dimensions without building a mesh: { length, width, height, transit } */
export function vehicleSize(kind, city) { const m = vehicleModel(kind, city); return { length: m.length, width: m.width, height: m.height, transit: m.transit || null }; }
