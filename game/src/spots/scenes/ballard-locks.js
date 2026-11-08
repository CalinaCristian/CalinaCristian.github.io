// ============================================================================
//  Hiram M. Chittenden (Ballard) Locks: the large lock (251.5 × 24.4 m) and
//  the small lock (45.7 × 9.1 m) side by side between Salmon Bay (lake level)
//  and Shilshole Bay (tidal), miter gates you walk across, boats rising and
//  falling, the spillway dam with tainter gates, the fish
//  ladder on the south bank, the 1915 buildings with red tile roofs and the
//  Carl S. English Jr. Botanical Garden on the north bank.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, clamp, lerp, smooth, headingFromBearing, polyBox, inPoly, capsuleGeometry } from '../kit.js';
import { signBoard } from '../props.js';
import { addTraffic } from '../cars.js';
import { waterMaterial, worldUV } from './sea-common.js';
import { seaActivity } from './sea-common.js';
import { activityFlow } from '../participation.js';

// lock axis from the west (sea) gate to the east (lake) gate — OSM lock_gate ways
const A = [-105, 42], B = [131, 130];
const LEN = Math.hypot(B[0] - A[0], B[1] - A[1]), U = [(B[0] - A[0]) / LEN, (B[1] - A[1]) / LEN], N = [-U[1], U[0]]; // N points south-east
const SEA = -8.9, LAKE = -3.5, WALL_TOP = 0.6, FLOOR = -17;
const toAx = (x, z) => { const dx = x - A[0], dz = z - A[1]; return [dx * U[0] + dz * U[1], dx * N[0] + dz * N[1]]; };
const fromAx = (s, t) => [A[0] + U[0] * s + N[0] * t, A[1] + U[1] * s + N[1] * t];
const YAW = Math.atan2(U[0], U[1]); // yaw that maps local +z onto the lock axis
const LARGE = { s0: 0, s1: LEN, t: 0, w: 24.4 }, SMALL = { s0: 62, s1: 108, t: 27, w: 9.1 };

function boat(color, len = 12) {
    const g = new THREE.Group(); g.name = 'boat';
    const hull = new THREE.Mesh(capsuleGeometry(len * 0.13, len * 0.72, 4, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, 0.55); hull.position.y = 0.2; g.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.2, len * 0.11, len * 0.3), new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.5 })); cabin.position.set(0, len * 0.1, -len * 0.05); g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, len * 0.9, 6), cabin.material); mast.position.set(0, len * 0.45, len * 0.1); if (len < 13) g.add(mast);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
}
function buildLock(ctx, L, water) {
    const g = ctx.ground, b = new GeoBatch(), conc = '#b9b5ab';
    // carve the chamber
    g.mod((x, z, h) => { const [s, t] = toAx(x, z); return s > L.s0 - 2 && s < L.s1 + 2 && Math.abs(t - L.t) < L.w / 2 + 3.0 ? FLOOR : h; });
    // walls (both sides) + walkable tops + railings
    for (const side of [-1, 1]) {
        const t = L.t + side * (L.w / 2 + 1.6), [cx, cz] = fromAx((L.s0 + L.s1) / 2, t);
        b.box(cx, FLOOR, cz, 3.2, WALL_TOP - FLOOR, L.s1 - L.s0 + 6, conc, 'concrete', YAW);
        g.addBox(cx, cz, 1.6, (L.s1 - L.s0) / 2 + 3, YAW, FLOOR, WALL_TOP);
        const [ax, az] = fromAx(L.s0, L.t + side * L.w / 2), [bx, bz] = fromAx(L.s1, L.t + side * L.w / 2);
        b.rod([ax, WALL_TOP + 1.05, az], [bx, WALL_TOP + 1.05, bz], 0.04, '#2f3a40', 'metal', 5);
        for (let s = L.s0; s <= L.s1; s += 4) { const [px, pz] = fromAx(s, L.t + side * L.w / 2); b.rod([px, WALL_TOP, pz], [px, WALL_TOP + 1.05, pz], 0.035, '#2f3a40', 'metal', 5); }
        ctx.collider({ wall: true, ax, az, bx, bz, y0a: FLOOR, y1a: WALL_TOP + 1.1, y0b: FLOOR, y1b: WALL_TOP + 1.1, nx: 0, nz: 1 });
    }
    // miter gates (two leaves in a shallow V) at both ends, with a walkway on top
    for (const s of [L.s0, L.s1]) {
        for (const side of [-1, 1]) {
            const [p0x, p0z] = fromAx(s, L.t + side * L.w / 2), [p1x, p1z] = fromAx(s + (s === L.s0 ? 3 : -3), L.t);
            const mx = (p0x + p1x) / 2, mz = (p0z + p1z) / 2, len = Math.hypot(p1x - p0x, p1z - p0z), yaw = Math.atan2(p1x - p0x, p1z - p0z);
            b.box(mx, FLOOR, mz, 1.0, WALL_TOP - FLOOR + 0.2, len, '#4f5a5f', 'steel', yaw);
            b.box(mx, WALL_TOP + 0.2, mz, 1.6, 0.15, len, '#7a6a52', 'wood', yaw);
            g.addBox(mx, mz, 0.8, len / 2, yaw, FLOOR, WALL_TOP + 0.35);
            b.rod([p0x, WALL_TOP + 1.3, p0z], [p1x, WALL_TOP + 1.3, p1z], 0.035, '#d9b23a', 'paint', 5);
        }
    }
    ctx.add(b.build('lock'));
    // chamber water (animated level)
    const [cx, cz] = fromAx((L.s0 + L.s1) / 2, L.t);
    const wg = new THREE.PlaneGeometry(L.w, L.s1 - L.s0); worldUV(wg, 25); const wm = new THREE.Mesh(wg, water.material); wm.rotation.set(-Math.PI / 2, 0, YAW); wm.position.set(cx, SEA, cz); wm.name = 'lock-water'; ctx.add(wm);
    return { water: wm, cx, cz };
}

export default {
    env: { fogFar: 4500 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('ballard-locks');
        // water bodies from the DEM: lake level east of the locks / dam, tidal sea level west
        g.mod((x, z, h) => (h < -2.6 ? Math.min(h, (h > -6.2 ? LAKE : SEA) - 2.6) : h));
        // round 5 (note 64): rippled water that reflects the sky (sea-common), the lock chambers and Salmon Bay share it
        const waterMat = waterMaterial(ctx, { color: '#24413f', rough: 0.12, name: 'spot-water' });
        const seaG = new THREE.PlaneGeometry(9000, 9000); seaG.rotateX(-Math.PI / 2); worldUV(seaG, 60);
        const sea = new THREE.Mesh(seaG, waterMat); sea.position.y = SEA; sea.name = 'water-puget-sound'; ctx.add(sea);
        { // lake surface = grid cells where the DEM sits at lake level
            const pos = [], step = 4, bb = { x0: -500, x1: 900, z0: -400, z1: 700 };
            for (let x = bb.x0; x < bb.x1; x += step) for (let z = bb.z0; z < bb.z1; z += step) {
                const h = g.base(x + step / 2, z + step / 2), [s, t] = toAx(x + 2, z + 2);
                if (!(h < -2.6 && h > -6.2)) continue;
                if (s > -5 && s < LEN + 5 && t > -16 && t < 40) continue; // not over the locks
                pos.push(x, LAKE, z, x, LAKE, z + step, x + step, LAKE, z + step, x, LAKE, z, x + step, LAKE, z + step, x + step, LAKE, z);
            }
            const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); worldUV(geo, 60);
            const lake = new THREE.Mesh(geo, waterMat); lake.name = 'water-salmon-bay'; ctx.add(lake);
        }
        const big = buildLock(ctx, LARGE, sea), small = buildLock(ctx, SMALL, sea);
        // spillway dam with 6 tainter gates (south of the small lock) + the fish ladder on the south bank
        {
            const b = new GeoBatch(), s0 = 30, s1 = 102, t = 62;
            const [cx, cz] = fromAx((s0 + s1) / 2, t);
            b.box(cx, FLOOR, cz, 6, WALL_TOP - FLOOR, s1 - s0, '#b3afa5', 'concrete', YAW);
            for (let i = 0; i < 6; i++) { const [gx, gz] = fromAx(s0 + 6 + i * 12, t - 3.5); b.box(gx, SEA - 0.5, gz, 1.2, LAKE - SEA + 1.5, 9.8, '#5d6a70', 'steel', YAW); b.box(gx, WALL_TOP + 0.2, gz, 3.5, 3.2, 1.2, '#8f2c22', 'paint', YAW); }
            g.addBox(cx, cz, 3, (s1 - s0) / 2, YAW, FLOOR, WALL_TOP);
            // fish ladder: 21 weirs of 0.3 m climbing from sea to lake level
            const fl = [[-64, 178], [-21, 196]], L = Math.hypot(fl[1][0] - fl[0][0], fl[1][1] - fl[0][1]), ux = (fl[1][0] - fl[0][0]) / L, uz = (fl[1][1] - fl[0][1]) / L, yaw = Math.atan2(ux, uz);
            for (let i = 0; i < 21; i++) { const x = fl[0][0] + ux * L * i / 21, z = fl[0][1] + uz * L * i / 21, y = lerp(SEA, LAKE, i / 20); b.box(x, y - 1.2, z, 5, 1.2, L / 21, '#a8a49a', 'concrete', yaw); b.box(x - uz * 2.7, y - 1.2, z + ux * 2.7, 0.4, 2.6, L / 21, '#a8a49a', 'concrete', yaw); b.box(x + uz * 2.7, y - 1.2, z - ux * 2.7, 0.4, 2.6, L / 21, '#a8a49a', 'concrete', yaw); }
            ctx.add(b.build('spillway-fishladder'));
        }
        // 1915 buildings: buff walls, red tile hipped roofs
        for (const bd of d.buildings) if (/Administration|Operating House|Control Tower|Visitor Center|Machine Shop|Office and Shop|Mechanics|Warehouse No|Steel Shop|Gatehouse/.test(bd.name || '')) { bd.estimatedRoof = 'hipped'; bd.rc = '#a2452d'; bd.c = '#d9ccad'; bd.estimatedHeight = /Administration/.test(bd.name) ? 11 : 7; }
        ctx.terrainOpts = { bg: '#5f7a3c', innerPx: 2048, skirtY: SEA - 0.2, skirtColor: '#36525a' };
        ctx.osmBackdrop({ paint: {}, urban: false, style: (bd) => (bd.rc === '#a2452d' ? 'apartment' : undefined), areaTreeOpts: { conifer: 0.5, density: 1 / 70 } });
        // Carl S. English Jr. Botanical Garden: specimen trees + beds
        { const gd = d.areas.find((a) => a.id === 'w51475864'); if (gd) { const bb = polyBox(gd.poly), r = rng(14); for (let i = 0; i < 260; i++) { const x = bb.x0 + r() * (bb.x1 - bb.x0), z = bb.z0 + r() * (bb.z1 - bb.z0); if (!inPoly(x, z, gd.poly)) continue; ctx.trees.push({ x, z, kind: r() < 0.25 ? 'con' : r() < 0.6 ? 'broad' : 'shrub', s: 0.6 + r() * 0.7 }); } } }
        // night: lamps along the lock walls (every 24 m, both sides) and the garden / promenade paths
        for (const side of [-1, 1]) for (let s0 = 8; s0 < LEN - 4; s0 += 24) { const [x, z] = fromAx(s0, LARGE.t + side * (LARGE.w / 2 + 2.6)); ctx.lampPoints.push({ x, z, rot: 0, y: WALL_TOP }); }
        { let n = 0; for (const pts of ctx.footLines()) { let acc = 0; for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc > 28 && n < 60) { acc = 0; n++; ctx.lampPoints.push({ x: pts[i][0] + 1.1, z: pts[i][1], rot: 0 }); } } } }
        ctx.lampOpts = { style: 'acorn', color: '#1f2a26', h: 4.2 };
        // boats in the large lock, rising and falling with the water
        const boats = [['#1f3b57', 11], ['#e8e4d8', 14], ['#7a2c2c', 9], ['#f2f2ee', 18], ['#2d5a3a', 10]].map(([c, l], i) => { const bt = boat(c, l); const [x, z] = fromAx(30 + i * 42, (i % 2 ? 6 : -6)); bt.position.set(x, SEA, z); bt.rotation.y = YAW; ctx.add(bt); return bt; });
        // An ambient, shortened lock cycle. Visitors observe from the public
        // walkway; the activity never gives them control of operating equipment.
        let level = SEA, phase = 'low', timer = 20;
        const runLockage = () => { phase = 'fill'; timer = 0; };
        ctx.onUpdate((dt, s) => {
            timer += dt;
            if (phase === 'low' && timer > 40) runLockage();
            else if (phase === 'fill') { level = lerp(SEA, LAKE, smooth(0, 1, timer / 25)); if (timer > 25) { phase = 'high'; timer = 0; } }
            else if (phase === 'high' && timer > 25) { phase = 'drain'; timer = 0; }
            else if (phase === 'drain') { level = lerp(LAKE, SEA, smooth(0, 1, timer / 25)); if (timer > 25) { phase = 'low'; timer = 0; } }
            big.water.position.y = level; small.water.position.y = level;
            boats.forEach((bt, i) => { bt.position.y = level + 0.05 + Math.sin(s.t * 0.8 + i) * 0.04; bt.rotation.z = Math.sin(s.t * 0.6 + i * 2) * 0.02; });
        });
        // The public observation point sits on the existing north-wall deck.
        // The former point was outside that deck on the coarse, lowered DEM.
        const [tx, tz] = fromAx(108, -LARGE.w / 2 - 1.6);
        const flow=activityFlow(ctx),stages=[['fill','The boats are rising'],['high','They reached lake level'],['drain','The boats are descending'],['low','Back at sea level']];
        ctx.extras.lockage={debug:()=>({phase,timer,level})};
        ctx.interactables.push({kind:'lockage',x:tx,z:tz,r:4,label:'Watch a lock cycle from the public walkway',use:s=>flow.begin(s,{
            title:'Watch the Ballard Locks',focus:{x:fromAx(108,0)[0],z:fromAx(108,0)[1],y:level+1.5},action:stages[0][1],lockWalker:false,
            help:'Watch the boats and water through a shortened cycle. Identify each stage when you see it; Leave or Esc ends the visit.',
            started(s,r){r.stage=0;r.busy=true;},
            actioned(s,r){r.stage++;if(r.stage===stages.length){flow.complete();return;}r.busy=true;r.button.textContent=stages[r.stage][1];},
            update(dt,s,r){r.busy=phase!==stages[r.stage][0]||timer<3;r.status.textContent=`${phase==='fill'?'Filling':phase==='drain'?'Draining':phase==='high'?'At lake level':'At sea level'} · ${Math.round((level-SEA)/(LAKE-SEA)*100)}% of the rise`;r.progress.value=r.stage/4;if(Math.hypot(s.position.x-tx,s.position.z-tz)>14)flow.cancel('distance');},
            complete(s){seaActivity(s,'lm-locks-lockage','ballard-locks');s.ui.toast('🚢 Lock cycle observed','You watched the boats rise to lake level and return to sea level.');s.sound.play('bell');},
        })});
        // signage
        const sg = signBoard('HIRAM M. CHITTENDEN LOCKS', 6.5, 0.9, { bg: '#1e3a2b', fg: '#f1ead4', font: (q) => `700 ${q}px Georgia, serif` }); sg.position.set(55, g.heightAt(55, -140) + 2.2, -140); sg.rotation.y = Math.PI; ctx.add(sg);
        addTraffic(ctx, { lanes: [{ pts: [[-142, -119], [-99, -126], [-63, -131], [32, -148], [56, -157], [69, -167]], n: 2, speed: 9 }] });
        // plaques on the north lock wall walkway + visitor centre
        const PL = sp.plaques;
        PL.forEach((pl, i) => {
            // Keep the reader on the rendered 3.2m north-wall walkway. These
            // informational boards face outwards from its chamber-side edge;
            // their +1.2m reading pose falls near the centre of the same deck.
            const [x, z] = fromAx(40 + i * 30, -LARGE.w / 2 - 0.6);
            ctx.plaque(pl, x, z, YAW + Math.PI / 2, { y: WALL_TOP, credit: i === 0 ? 'U.S. Army Corps of Engineers; opened 1917.' : null });
        });
        { const [cx, cz] = fromAx(205, -LARGE.w / 2 - 1.8); ctx.challenge('ballard-locks', { x: cx, z: cz, heading: 290, pitch: -10, r: 16, tol: 35 }); } // on the north lock wall, looking down the chamber full of boats
        // crowd: people along the lock walls watching boats, the garden, the fish ladder windows
        const wallLine = (t) => [fromAx(10, t), fromAx(LEN - 10, t)];
        ctx.crowdCfg = {
            personas: { local: 3, tourist_us: 4, tourist_cn: 1.2, tourist_kr: 1, tourist_jp: 1, tourist_de: 1.2, tourist_es: 1, tourist_ca: 1, tourist_in: 1, kid: 1.5, photographer: 1, staff: 0.4 },
            walkers: 22, paths: [...ctx.footLines(), wallLine(-LARGE.w / 2 - 1.6), wallLine(LARGE.w / 2 + 1.6)],
            groups: [
                { x: fromAx(70, -14.5)[0], z: fromAx(70, -14.5)[1], r: 5, n: 10, act: 'watch', look: fromAx(70, 0), y: WALL_TOP, personas: ['tourist_us', 'local', 'kid', 'tourist_de', 'tourist_cn'] },
                { x: fromAx(150, -14.5)[0], z: fromAx(150, -14.5)[1], r: 4, n: 6, act: 'photo', look: fromAx(150, 0), y: WALL_TOP, personas: ['photographer', 'tourist_jp', 'tourist_kr', 'tourist_us'] },
                { x: tx, z: tz, r: 0.3, n: 1, act: 'watch', look: fromAx(108, 0), y: WALL_TOP, personas: ['staff'] },
                { x: -40, z: 186, r: 3, n: 6, act: 'watch', look: [-44, 183], personas: ['tourist_us', 'kid', 'local', 'tourist_es'] },
                { x: -30, z: -9, r: 8, n: 6, act: 'talk', personas: ['local', 'tourist_us', 'tourist_ca'] },
            ],
        };
        ctx.sound('water', fromAx(80, 50)[0], fromAx(80, 50)[1], 120, 1.2); ctx.sound('gulls', 0, 120, 220, 1); ctx.sound('crowd', fromAx(70, -15)[0], fromAx(70, -15)[1], 50, 0.8); ctx.sound('bell', fromAx(108, -16)[0], fromAx(108, -16)[1], 200, 0.6);
        ctx.spawns['ballard-locks'] = { x: sp.spawn.x, z: sp.spawn.z, heading: headingFromBearing(sp.spawn.heading_deg) };
        void clamp; void M;
    },
};
