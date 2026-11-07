// ============================================================================
//  Light street traffic for spot scenes: cars looping along lane polylines
//  (yielding to the walker and to the car ahead), plus parked cars. Uses the
//  game's vehicle models (vehicles.js, read-only import). Pike Place has none.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { makeVehicle, CAR_COLORS, pickFleetKind, fleetColor } from '../vehicles.js';
import { alongPolyline, polylineLength, rng, GeoBatch } from './kit.js';

const KINDS = ['sedan', 'sedan', 'hatch', 'suv', 'suv', 'pickup', 'van', 'sedan'];
/**
 * @param {SceneContext} ctx
 * @param {{ lanes?: [{pts:[[x,z]], n?:number, speed?:number, kinds?:string[]}], parked?: [{x,z,yaw,kind?,color?}], seed?:number }} o
 */
export function addTraffic(ctx, o = {}) {
    const r = rng(o.seed || 11), cars = [];
    // Bucharest scenes: the city's own fleet mix / colours (Dacia & co.), whatever city the game drove last
    const buc = ctx.data.city === 'bucharest', vo = buc ? { city: 'bucharest' } : {};
    const kindOf = (k) => k || (buc ? pickFleetKind('bucharest', r) : r.pick(KINDS));
    const colOf = (c, k) => c || (buc ? fleetColor(k, 'bucharest', r) : r.pick(CAR_COLORS));
    if (o.merge && o.parked?.length) { // static parked cars merged into 2 draw calls (bodies + parts)
        const bodies = new GeoBatch(), parts = []; let partsMat = null;
        for (const p of o.parked) {
            const k = kindOf(p.kind), v = makeVehicle(k, colOf(p.color, k), vo), y = ctx.ground.heightAt(p.x, p.z) + 0.02;
            v.position.set(p.x, y, p.z); v.rotation.y = p.yaw; v.updateMatrixWorld(true);
            const [body, pt] = v.children;
            if (body?.geometry) bodies.add(body.geometry, 'carpaint', body.matrixWorld, body.material.color, { roughness: 0.32, metalness: 0.3 });
            if (pt?.geometry) { parts.push(pt.geometry.clone().applyMatrix4(pt.matrixWorld)); partsMat = pt.material; }
            const L = v.userData.length || 4.5, W = v.userData.width || 1.8;
            ctx.box(p.x, p.z, W / 2, L / 2, p.yaw, { prop: true, h: 1.5, y });
        }
        ctx.add(bodies.build('parked-bodies'));
        if (parts.length) { const g = mergeAll(parts); const m = new THREE.Mesh(g, partsMat); m.name = 'parked-parts'; m.castShadow = true; m.userData.shared = false; ctx.add(m); for (const q of parts) q.dispose(); }
    }
    for (const p of o.merge ? [] : o.parked || []) {
        const k = kindOf(p.kind), v = makeVehicle(k, colOf(p.color, k), vo);
        v.position.set(p.x, ctx.ground.heightAt(p.x, p.z) + 0.02, p.z); v.rotation.y = p.yaw; ctx.add(v);
        const L = v.userData.length || 4.5, W = v.userData.width || 1.8;
        ctx.box(p.x, p.z, W / 2, L / 2, p.yaw, { prop: true, h: 1.5, y: ctx.ground.heightAt(p.x, p.z) });
    }
    for (const lane of o.lanes || []) {
        const L = polylineLength(lane.pts), n = lane.n ?? Math.max(1, Math.round(L / 60));
        for (let i = 0; i < n; i++) {
            const k = lane.kinds ? r.pick(lane.kinds) : kindOf(null), v = makeVehicle(k, colOf(null, k), vo); ctx.add(v);
            cars.push({ v, lane, L, s: (i / n) * L + r() * 10, speed: 0, vmax: (lane.speed || 9) * (0.85 + r() * 0.3), len: v.userData.length || 4.5, wid: v.userData.width || 1.8, x: 0, z: 0, yaw: 0 });
        }
    }
    if (!cars.length) return { cars };
    // note 29: spot traffic never overlaps — spawn spacing on every lane (and across lanes that share road space),
    // then per frame a car yields to any car in its path on another lane (merges, roundabouts, crossings)
    const place = (c) => { const p = alongPolyline(c.lane.pts, c.s); c.x = p.x; c.z = p.z; c.yaw = Math.atan2(-p.tx, -p.tz); };
    const hits = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z, fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx); return Math.abs(along) < (a.len + b.len) / 2 + 1.5 && lat < (a.wid + b.wid) / 2 + 0.6; };
    for (let i = 0; i < cars.length; i++) { const c = cars[i]; place(c);
        for (let k = 0; k < 40 && cars.slice(0, i).some((d) => hits(c, d) || hits(d, c)); k++) { c.s = (c.s + c.len + 2) % c.L; place(c); }
        if (cars.slice(0, i).some((d) => hits(c, d) || hits(d, c))) { c.dead = true; c.v.visible = false; } }
    for (let i = cars.length - 1; i >= 0; i--) if (cars[i].dead) { ctx.scene.remove(cars[i].v); cars.splice(i, 1); }
    cars.forEach((c, i) => { c.id = i; });
    /** distance to a car on another lane that sits in c's path (ahead, within its width); mutual blocks: the higher id yields */
    const inPath = (c, d, look) => { const dx = d.x - c.x, dz = d.z - c.z, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx); return along > 0 && along < look && lat < (c.wid + d.wid) / 2 + 0.5 ? along - (c.len + d.len) / 2 : null; };
    const fwd = new THREE.Vector3();
    ctx.onUpdate((dt, session, pl) => {
        for (const c of cars) {
            // gap to the car ahead on the same lane, and to the walker on the carriageway
            let gap = 1e9;
            for (const d of cars) if (d !== c && d.lane === c.lane) { let ds = d.s - c.s; if (ds < 0) ds += c.L; if (ds < gap) gap = ds - (d.len + c.len) / 2; }
            for (const d of cars) { if (d === c || d.lane === c.lane) continue; const g = inPath(c, d, 16 + c.speed * 1.5); if (g === null) continue; if (inPath(d, c, 16 + d.speed * 1.5) !== null && c.id < d.id) continue; gap = Math.min(gap, g); }
            if (pl) { const ax = pl.x - c.x, az = pl.z - c.z, along = ax * Math.sin(c.yaw + Math.PI) + az * Math.cos(c.yaw + Math.PI), lat = Math.abs(ax * Math.cos(c.yaw) - az * Math.sin(c.yaw)); if (along > 0 && along < 14 && lat < 1.8) gap = Math.min(gap, along - c.len / 2 - 1.5); }
            const want = gap < 3 ? 0 : Math.min(c.vmax, (gap - 3) * 0.9);
            c.speed += Math.max(-7 * dt, Math.min(2.5 * dt, want - c.speed));
            c.s += c.speed * dt; if (c.s > c.L) c.s -= c.L;
            const p = alongPolyline(c.lane.pts, c.s);
            c.x = p.x; c.z = p.z; c.yaw = Math.atan2(-p.tx, -p.tz); // vehicles face −z
            c.v.position.set(p.x, session.spot.ground.heightAt(p.x, p.z) + 0.02, p.z); c.v.rotation.y = c.yaw;
            // fade in/out at the lane ends (cars appear/disappear out of sight)
            c.v.visible = c.s > 2 && c.s < c.L - 2;
            c.v.userData.setLights?.(session.nightK > 0.3);
        }
        void fwd;
    });
    ctx.extras.obstacles = () => cars.filter((c) => c.v.visible).map((c) => ({ x: c.x, z: c.z, fx: -Math.sin(c.yaw), fz: -Math.cos(c.yaw), length: c.len, width: c.wid, speed: c.speed }));
    return { cars };
}

/** concatenate geometries with identical attribute sets (indexed or not) */
function mergeAll(list) {
    const names = Object.keys(list[0].attributes), out = new THREE.BufferGeometry(), idx = []; let base = 0;
    const arrs = Object.fromEntries(names.map((n) => [n, []]));
    for (const g of list) {
        for (const n of names) { const a = g.attributes[n]; if (!a) continue; for (let i = 0; i < a.array.length; i++) arrs[n].push(a.array[i]); }
        const cnt = g.attributes.position.count;
        if (g.index) for (const i of g.index.array) idx.push(base + i); else for (let i = 0; i < cnt; i++) idx.push(base + i);
        base += cnt;
    }
    for (const n of names) out.setAttribute(n, new THREE.Float32BufferAttribute(arrs[n], list[0].attributes[n].itemSize));
    out.setIndex(base > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
}
