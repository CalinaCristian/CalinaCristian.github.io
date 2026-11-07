// ============================================================================
//  Light street traffic for spot scenes: cars looping along lane polylines
//  (yielding to the walker and to the car ahead), plus parked cars. Uses the
//  game's vehicle models (vehicles.js, read-only import). Pike Place has none.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { makeVehicle, CAR_COLORS } from '../vehicles.js';
import { alongPolyline, polylineLength, rng } from './kit.js';

const KINDS = ['sedan', 'sedan', 'hatch', 'suv', 'suv', 'pickup', 'van', 'sedan'];
/**
 * @param {SceneContext} ctx
 * @param {{ lanes?: [{pts:[[x,z]], n?:number, speed?:number, kinds?:string[]}], parked?: [{x,z,yaw,kind?,color?}], seed?:number }} o
 */
export function addTraffic(ctx, o = {}) {
    const r = rng(o.seed || 11), cars = [];
    for (const p of o.parked || []) {
        const v = makeVehicle(p.kind || r.pick(KINDS), p.color || r.pick(CAR_COLORS));
        v.position.set(p.x, ctx.ground.heightAt(p.x, p.z) + 0.02, p.z); v.rotation.y = p.yaw; ctx.add(v);
        const L = v.userData.length || 4.5, W = v.userData.width || 1.8;
        ctx.box(p.x, p.z, W / 2, L / 2, p.yaw, { prop: true, h: 1.5, y: ctx.ground.heightAt(p.x, p.z) });
    }
    for (const lane of o.lanes || []) {
        const L = polylineLength(lane.pts), n = lane.n ?? Math.max(1, Math.round(L / 60));
        for (let i = 0; i < n; i++) {
            const v = makeVehicle(r.pick(lane.kinds || KINDS), r.pick(CAR_COLORS)); ctx.add(v);
            cars.push({ v, lane, L, s: (i / n) * L + r() * 10, speed: 0, vmax: (lane.speed || 9) * (0.85 + r() * 0.3), len: v.userData.length || 4.5, wid: v.userData.width || 1.8, x: 0, z: 0, yaw: 0 });
        }
    }
    if (!cars.length) return { cars };
    const fwd = new THREE.Vector3();
    ctx.onUpdate((dt, session, pl) => {
        for (const c of cars) {
            // gap to the car ahead on the same lane, and to the walker on the carriageway
            let gap = 1e9;
            for (const d of cars) if (d !== c && d.lane === c.lane) { let ds = d.s - c.s; if (ds < 0) ds += c.L; if (ds < gap) gap = ds - (d.len + c.len) / 2; }
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
