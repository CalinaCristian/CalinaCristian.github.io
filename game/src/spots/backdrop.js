// ============================================================================
//  Far backdrop for Seattle-area spots: the Space Needle at its real position,
//  the downtown towers, a low-rise city filler between, Elliott Bay / lakes,
//  Mount Rainier and the Olympics (fog-free impostors at true angular size).
//  Everything is placed from lat/lon through the scene's projection (ctx.ll).
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { rng, inPoly } from './kit.js';
import { spaceNeedle, skyline, mountain, SEATTLE_TOWERS } from './props.js';

export const NEEDLE_LL = [47.6205063, -122.3493043, 40.5]; // lat, lon, base elevation (m NAVD88)
export const RAINIER_LL = [46.8529, -121.7604, 4392];
/** Elliott Bay shoreline (north → south), land is east of it */
export const ELLIOTT_SHORE = [[47.6420, -122.4040], [47.6345, -122.3890], [47.6290, -122.3790], [47.6230, -122.3700], [47.6170, -122.3600], [47.6115, -122.3500], [47.6075, -122.3445], [47.6030, -122.3405], [47.5980, -122.3385], [47.5900, -122.3390], [47.5820, -122.3460], [47.5700, -122.3600]];

function distM(ctx, la, lo) { const p = ctx.ll(la, lo); return Math.hypot(p.x, p.z); }
function bearingTo(ctx, la, lo) { const p = ctx.ll(la, lo); return ((Math.atan2(p.x, -p.z) * 180 / Math.PI) + 360) % 360; }

/**
 * @param {SceneContext} ctx
 * @param {{needle?:boolean, towers?:boolean, filler?:number, bay?:boolean, rainier?:boolean, olympics?:boolean, clear?:number, groundNavd?:(la,lo)=>number}} o
 *   clear: no filler / towers within this distance of the origin (the OSM scene is there)
 */
export function seattleBackdrop(ctx, o = {}) {
    const E = ctx.data.origin.elev, grp = new THREE.Group(); grp.name = 'seattle-backdrop';
    const clear = o.clear ?? 380;
    // city ground (m NAVD88): base + Gaussian hills (Queen Anne, Capitol Hill, First Hill, Beacon Hill) + the downtown slope
    const HILLS = [[47.636, -122.357, 125, 1100], [47.625, -122.316, 100, 1000], [47.608, -122.322, 85, 650], [47.585, -122.31, 90, 900], [47.645, -122.35, 40, 700]];
    const groundNavd = o.groundNavd || ((la, lo) => { let h = 12 + Math.max(0, Math.min(40, (lo + 122.342) * 6000)) * (la < 47.615 && la > 47.598 ? 1 : 0.3); for (const [a, b, H, s] of HILLS) { const dx = (lo - b) * 75000, dy = (la - a) * 111000; h += H * Math.exp(-(dx * dx + dy * dy) / (2 * s * s)); } return h; });
    const out = { group: grp };
    const place = (la, lo, h) => {
        let gy = groundNavd(la, lo) - E;
        // inside the scene's terrain grid the block stands on the modelled ground (never floating above a lower street)
        const q = ctx.ll(la, lo); { const gl = ctx.ground.heightAt(q.x, q.z) - 1.5; if (gl < gy) { h += gy - gl; gy = gl; } }
        return o.baseY === undefined ? { y: gy, h } : { y: o.baseY, h: h + Math.max(0, gy - o.baseY) };
    };
    if (o.needle !== false && distM(ctx, NEEDLE_LL[0], NEEDLE_LL[1]) > 250) {
        const p = ctx.ll(NEEDLE_LL[0], NEEDLE_LL[1]), n = spaceNeedle(p.x, NEEDLE_LL[2] - E, p.z, { detail: 0.5 });
        if (o.baseY !== undefined && NEEDLE_LL[2] - E > o.baseY + 2) { const ped = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, NEEDLE_LL[2] - E - o.baseY, 16), new THREE.MeshLambertMaterial({ color: '#7d7a70' })); ped.position.set(p.x, (NEEDLE_LL[2] - E + o.baseY) / 2, p.z); grp.add(ped); }
        n.traverse((m) => { if (m.isMesh) { m.castShadow = false; } }); grp.add(n); out.needle = n;
        ctx.onNight((k) => n.userData.night?.(k));
    }
    if (o.towers !== false) {
        // baseY: extend every block down to the scene's apron level (no floating blocks where the far hills are not modelled)
        const list = SEATTLE_TOWERS.map(([la, lo, h, w, d, c, crown]) => { const p = ctx.ll(la, lo), pl = place(la, lo, h); return { x: p.x, z: p.z, w, d, h: pl.h, c, crown, y: pl.y, dist: Math.hypot(p.x, p.z) }; }).filter((t) => t.dist > clear);
        // + procedural mid/high-rises filling the downtown core between the landmark towers
        if (o.coreTowers) {
            const r = rng(31), pal = ['#5d7184', '#7a8a99', '#3f4b57', '#9aa7b2', '#c5bfb2', '#6b7f73', '#8c9aa6', '#2f3a45'];
            for (let i = 0; i < o.coreTowers; i++) {
                const la = 47.6015 + r() * 0.0165, lo = -122.3425 + r() * 0.0165, p = ctx.ll(la, lo), dd = Math.hypot(p.x, p.z);
                if (dd < clear) continue;
                const core = Math.exp(-((la - 47.607) ** 2 + ((lo + 122.334) * 0.67) ** 2) / 0.000012);
                const pl = place(la, lo, 45 + r() * 60 + core * r() * 90); list.push({ x: p.x, z: p.z, w: 22 + r() * 22, d: 22 + r() * 18, h: pl.h, c: pal[i % pal.length], crown: r() < 0.15 ? 'stepped' : 'flat', y: pl.y, yaw: 0.62 });
            }
        }
        const sk = skyline(list, { hazeK: o.hazeK ?? 0.22 }); grp.add(sk); out.skyline = sk;
        ctx.onNight((k) => sk.userData.night?.(k));
    }
    if (o.filler) { // low-rise city blocks (instanced) between the viewer and downtown, on land only
        const n = o.filler, r = rng(77), land = (la, lo) => { // east of the shoreline polyline
            for (let i = 1; i < ELLIOTT_SHORE.length; i++) { const [a1, b1] = ELLIOTT_SHORE[i - 1], [a2, b2] = ELLIOTT_SHORE[i]; if (la <= a1 && la >= a2) { const t = (la - a1) / (a2 - a1); return lo > b1 + (b2 - b1) * t + 0.0008; } } return true; };
        const box = o.fillerBox || [47.596, -122.372, 47.636, -122.312];
        const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
        const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', fog: true }); mat.name = 'roofs';
        const im = new THREE.InstancedMesh(geo, mat, n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
        const pal = ['#b8b2a6', '#9aa3ab', '#c9c1b2', '#8e8a83', '#a9927c', '#d3cfc6', '#7f8a92', '#b39b84'];
        let k = 0;
        for (let i = 0; i < n * 3 && k < n; i++) {
            const la = box[0] + r() * (box[2] - box[0]), lo = box[1] + r() * (box[3] - box[1]); if (!land(la, lo)) continue;
            const p = ctx.ll(la, lo), dd = Math.hypot(p.x, p.z); if (dd < clear) continue;
            if ((o.fillerExclude || []).some((poly) => inPoly(p.x, p.z, poly))) continue;
            const core = Math.exp(-((la - 47.607) ** 2 + ((lo + 122.335) * 0.67) ** 2) / 0.00002), h = 6 + r() * 18 + core * r() * 70;
            const w = 14 + r() * 26, d2 = 14 + r() * 26;
            const pl = place(la, lo, h); m4.compose(new THREE.Vector3(p.x, pl.y - 1, p.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.62 + (r() < 0.2 ? r() : 0)), new THREE.Vector3(w, pl.h, d2));
            im.setMatrixAt(k, m4); im.setColorAt(k, col.set(pal[k % pal.length])); k++;
        }
        im.count = k; im.castShadow = false; im.receiveShadow = false; im.name = 'city-filler'; im.computeBoundingSphere();
        grp.add(im); out.filler = im;
    }
    if (o.bay) { // Elliott Bay at sea level
        const w = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshStandardMaterial({ color: '#33515e', roughness: 0.08, metalness: 0.3 }));
        w.rotation.x = -Math.PI / 2; w.position.y = (o.seaLevel ?? 0) - E; w.name = 'elliott-bay'; w.renderOrder = -10; grp.add(w); out.bay = w;
    }
    if (o.rainier) {
        const R = RAINIER_LL, dist = distM(ctx, R[0], R[1]), b = bearingTo(ctx, R[0], R[1]);
        const m = mountain(0, 0, b, dist, R[2] - E, 26000, { dist: 7000, eyeY: (o.eyeY ?? 0), color: '#7d8ea6', snow: '#f4f6fa', haze: '#b9c7d6', seed: 4 });
        m.userData.weatherMountain = true; grp.add(m); out.rainier = m;
    }
    if (o.olympics) {
        const ranges = [[275, 2100, 26000], [290, 2300, 30000], [305, 2000, 24000], [258, 1800, 20000]];
        for (const [b, h, w] of ranges) { const m = mountain(0, 0, b, 75000, h - E, w, { dist: 7400, eyeY: o.eyeY ?? 0, color: '#6f7f99', snow: '#e8edf3', haze: '#b4c2d2', seed: b }); m.userData.weatherMountain = true; grp.add(m); }
    }
    ctx.add(grp);
    // mountains fade with cloud cover / visibility ("the Mountain is out")
    ctx.onUpdate((dt, s) => {
        const w = s.r3d.weather, vis = w ? Math.min(1, (w.visibilityM ?? 20000) / 25000) * (1 - Math.max(0, ((w.cloud ?? 0.3) - 0.6) / 0.4)) : 1;
        grp.traverse((m) => { if (m.userData?.weatherMountain) { m.visible = vis > 0.15; m.material.transparent = true; m.material.opacity = Math.min(1, vis * 1.3); } });
        out.mountainVisible = vis > 0.4;
    });
    return out;
}
