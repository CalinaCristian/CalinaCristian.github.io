// ============================================================================
//  Kerry Park: shoot hoops on the basketball court of the lower park (owner, 2026-11-15: real activities, not the view).
//  The city lists a play area and basketball courts for Kerry Park and its lower half, Bayview-Kinnear ("Lower Kerry
//  Park", seattle.gov/parks/allparks/bayview-kinnear-(lower-kerry-park)), open 6 am – 10 pm; OSM maps the half court as
//  w730946886 (leisure=pitch, sport=basketball), down the 3rd Ave W steps below the terrace. The court is drawn on its
//  mapped outline (asphalt, lines, one hoop at its south-west end: which end carries the hoop is an estimate).
//
//  "Around the world": five marked spots round the key; walk (WASD) into the yellow ring, aim with the mouse (look up for
//  the arc) and shoot with E. Sink one from every spot within 12 balls. The ball physics is the game's own
//  (basketball.js: rim, backboard, the ball's slice through the rim plane). Leave or Esc stops anytime.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { BasketballPhysics, BASKETBALL_RADIUS } from '../../basketball.js';
import { activityFlow } from '../participation.js';
import { timedActivity } from '../park-hours.js';
import { seaActivity } from './sea-common.js';

export const KERRY_COURT_HOURS = { open: 6, close: 22, note: 'Kerry Park and Bayview-Kinnear are open 6 am – 10 pm (Seattle Parks).' };
// power: the shooter's release speed is set by the distance (just above the least speed that reaches the rim: the soft, high
// arc of a set shot); the player's part is the aim — straight at the rim, and the arc (look up ≈ 30–35°)
export const HOOPS = { spots: 5, balls: 12, radius: 3.6, angles: [-45, -22, 0, 22, 45], ring: 0.6, lob: 0.4, power: 1.025 };
/** release speed (m/s) for a shot d m (horizontal) from the rim and dh m below it */
export const shotSpeed = (d, dh) => Math.sqrt(9.81 * (dh + Math.hypot(dh, d))) * HOOPS.power;
const COURT = [[20.5, 49.5], [24.3, 44.7], [31.3, 50.3], [27.5, 55.1]]; // OSM w730946886: [0]–[1] is the hoop end

function courtTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 376; const x = c.getContext('2d'), k = 256 / 6.1;
    x.fillStyle = '#4a5a52'; x.fillRect(0, 0, 256, 376); x.fillStyle = '#7a3b32'; x.fillRect(128 - 2.44 * k, 0, 4.88 * k, 5.79 * k); // the painted key
    x.strokeStyle = '#f2f0e6'; x.lineWidth = 3; x.strokeRect(2, 2, 252, 372); x.strokeRect(128 - 2.44 * k, 0, 4.88 * k, 5.79 * k);
    x.beginPath(); x.arc(128, 5.79 * k, 1.8 * k, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(128, 1.58 * k, 6.0 * k, 0.25 * Math.PI, 0.75 * Math.PI); x.stroke(); // a short three-point arc (the half court is narrower than a full arc)
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; x.fillRect(Math.random() * 256, Math.random() * 376, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function ballMesh() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#d8691c'; x.fillRect(0, 0, 128, 64); x.strokeStyle = '#2a1a12'; x.lineWidth = 2;
    for (const u of [0, 32, 64, 96, 128]) { x.beginPath(); x.moveTo(u, 0); x.lineTo(u, 64); x.stroke(); } x.beginPath(); x.moveTo(0, 32); x.lineTo(128, 32); x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.SphereGeometry(BASKETBALL_RADIUS, 14, 10), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }));
    m.name = 'kerry-basketball'; m.castShadow = true; m.userData.noFloor = true; m.userData.noAudit = true; m.visible = false; return m;
}

/** draws the court and its hoop and adds the activity; returns { start, active, debug, hoop, spots, at } */
export function kerryHoops(ctx) {
    const g = ctx.ground, flow = activityFlow(ctx);
    const [P0, P1, P2, P3] = COURT, cx = COURT.reduce((a, p) => a + p[0], 0) / 4, cz = COURT.reduce((a, p) => a + p[1], 0) / 4;
    const Y = COURT.reduce((a, [x, z]) => a + g.heightAt(x, z), 0) / 4; // the mapped corners' mean: the court is level
    const grown = COURT.map(([x, z]) => [cx + (x - cx) * 1.12, cz + (z - cz) * 1.12]);
    g.flatten(grown, Y, 9); // (a long blend: the court is cut into the slope; a short one read as a grey rock face)
    ctx.trees = ctx.trees.filter((t) => Math.hypot(t.x - cx, t.z - cz) > 7.5);
    // unit vectors: u from the hoop end into the court, w across it
    const mA = [(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2], mC = [(P2[0] + P3[0]) / 2, (P2[1] + P3[1]) / 2], L = Math.hypot(mC[0] - mA[0], mC[1] - mA[1]);
    const ux = (mC[0] - mA[0]) / L, uz = (mC[1] - mA[1]) / L;
    // ---- the court surface (its own quad on the mapped corners, the hoop end at the canvas top)
    const geo = new THREE.BufferGeometry(), y = Y + 0.025;
    geo.setAttribute('position', new THREE.Float32BufferAttribute([P0[0], y, P0[1], P1[0], y, P1[1], P2[0], y, P2[1], P3[0], y, P3[1]], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)); geo.setIndex([0, 2, 1, 0, 3, 2]); geo.computeVertexNormals();
    if (geo.attributes.normal.getY(0) < 0) geo.setIndex([0, 1, 2, 0, 2, 3]), geo.computeVertexNormals();
    const surf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: courtTexture(), roughness: 0.92 })); surf.name = 'kerry-basketball-court'; surf.receiveShadow = true; ctx.add(surf);
    // ---- the hoop: pole outside the baseline, arm, backboard, rim and net
    const board = { x: mA[0] + ux * 1.2, z: mA[1] + uz * 1.2 }, rim = { x: mA[0] + ux * 1.58, z: mA[1] + uz * 1.58, y: Y + 3.05 }, yaw = Math.atan2(ux, uz);
    const hoopG = new THREE.Group(); hoopG.name = 'kerry-hoop'; const paint = new THREE.MeshStandardMaterial({ color: '#2d4f6b', roughness: 0.6, metalness: 0.3 });
    const add = (geom, mat, x, yy, z) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, yy, z); m.castShadow = true; hoopG.add(m); return m; };
    add(new THREE.CylinderGeometry(0.08, 0.09, 3.6, 10), paint, mA[0] - ux * 0.35, Y + 1.8, mA[1] - uz * 0.35);
    add(new THREE.BoxGeometry(0.1, 0.1, 1.55), paint, mA[0] + ux * 0.42, Y + 3.45, mA[1] + uz * 0.42).rotation.y = yaw;
    const bd = add(new THREE.BoxGeometry(1.83, 1.07, 0.05), new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.5 }), board.x, Y + 3.43, board.z); bd.rotation.y = yaw;
    const sq = add(new THREE.BoxGeometry(0.59, 0.45, 0.052), new THREE.MeshStandardMaterial({ color: '#c0392b' }), board.x + ux * 0.002, Y + 3.3, board.z + uz * 0.002); sq.rotation.y = yaw; sq.scale.set(1, 1, 1.02);
    const ring = add(new THREE.TorusGeometry(0.2286, 0.01, 6, 28), new THREE.MeshStandardMaterial({ color: '#e0601e', metalness: 0.5, roughness: 0.4 }), rim.x, rim.y, rim.z); ring.rotation.x = Math.PI / 2;
    const net = add(new THREE.CylinderGeometry(0.22, 0.14, 0.42, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#f2f2f2', wireframe: true }), rim.x, rim.y - 0.22, rim.z); net.castShadow = false;
    ctx.add(hoopG); ctx.circle(mA[0] - ux * 0.35, mA[1] - uz * 0.35, 0.12, 3.6);
    const hoop = { rim: [rim.x, rim.y, rim.z], radius: 0.2286, wire: 0.01, board: [board.x, Y + 3.43, board.z], normal: [ux, uz], width: 1.83, height: 1.07, thickness: 0.05 };
    // ---- the five spots ("around the world"), the ring marker, the ball
    const spots = HOOPS.angles.map((deg) => { const a = deg * Math.PI / 180, dx = ux * Math.cos(a) - uz * Math.sin(a), dz = uz * Math.cos(a) + ux * Math.sin(a); return { x: rim.x + dx * HOOPS.radius, z: rim.z + dz * HOOPS.radius }; });
    const mark = new THREE.Mesh(new THREE.RingGeometry(HOOPS.ring - 0.12, HOOPS.ring, 28), new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    mark.rotation.x = -Math.PI / 2; mark.visible = false; mark.name = 'kerry-hoops-spot'; mark.userData.noFloor = true; mark.userData.noAudit = true; ctx.add(mark);
    const ball = ballMesh(); ctx.add(ball);
    let st = null, last = null;
    // held in both hands below the view; released from the view's centre line, so the ball flies where you look
    const handPos = (s) => s.camera.localToWorld(new THREE.Vector3(0, -0.3, -0.6)), releasePos = (s) => s.camera.localToWorld(new THREE.Vector3(0, -0.22, -0.5));
    const shotDir = (s) => { const q = s.camera.getWorldQuaternion(new THREE.Quaternion()), gz = new THREE.Vector3(0, 0, -1).applyQuaternion(q), hz = Math.hypot(gz.x, gz.z) || 1, p = Math.min(1.5, Math.asin(Math.max(-1, Math.min(1, gz.y))) + HOOPS.lob); return { x: gz.x / hz * Math.cos(p), y: Math.sin(p), z: gz.z / hz * Math.cos(p) }; };
    const at = { x: mC[0] - ux * 1.0, z: mC[1] - uz * 1.0 };
    const status = (r, text) => { r.status.textContent = `${text}  ·  spot ${Math.min(HOOPS.spots, st.spot + 1)} of ${HOOPS.spots} · ball ${Math.min(HOOPS.balls, st.shots + (st.held ? 1 : 0))} of ${HOOPS.balls}`; r.progress.value = st.spot / HOOPS.spots; };
    const placeMark = () => { const p = spots[Math.min(st.spot, spots.length - 1)]; mark.position.set(p.x, Y + 0.05, p.z); mark.visible = st.spot < HOOPS.spots && !st.over; };
    const reset = (r) => { st.spot = 0; st.shots = 0; st.over = false; st.held = true; st.fly = 0; st.physics.reset(); placeMark(); r.button.textContent = 'Shoot (E)'; };
    const stop = () => { st = null; ball.visible = false; mark.visible = false; };
    const start = (s) => flow.begin(s, {
        title: '🏀 Around the world · Bayview-Kinnear court', action: 'Shoot (E)', lockWalker: false,
        help: 'Walk (WASD) into the yellow ring, aim with the mouse — look up to give the ball an arc — and shoot with E. Sink one from each of the five spots round the key within 12 balls. Leave or Esc stops.',
        started(s2, r) {
            st = { spot: 0, shots: 0, held: true, over: false, fly: 0, t: 0, feedback: '', physics: new BasketballPhysics({ center: [cx, Y, cz], hoops: [hoop] }, () => { st.made = true; }) };
            reset(r); ball.visible = true; r.progress.max = 1; status(r, 'Walk into the yellow ring.');
        },
        actioned(s2, r) {
            if (!st) return;
            if (st.over) { reset(r); status(r, 'New game: walk into the yellow ring.'); return; }
            if (!st.held) return;
            const p = s2.ctl.position, sp = spots[st.spot];
            if (Math.hypot(p.x - sp.x, p.z - sp.z) > HOOPS.ring) { status(r, 'Step into the yellow ring to shoot.'); return; }
            const rp = releasePos(s2); st.physics.launch(rp, shotDir(s2), shotSpeed(Math.hypot(rim.x - rp.x, rim.z - rp.z), rim.y - rp.y)); st.held = false; st.fly = 0; st.made = false; st.shots++; st.closest = 9; s2.sound?.play?.('whoosh', 0.2); status(r, 'Up it goes…');
        },
        update(dt, s2, r) {
            if (!st) return;
            const p = s2.ctl.position; st.t += dt;
            if (Math.hypot(p.x - cx, p.z - cz) > 26) { flow.cancel('left'); s2.ui.toast('🏀 Game over', 'You walked away from the court.'); return; }
            if (st.held) { ball.position.copy(handPos(s2)); ball.rotation.y += dt; if (!st.over) { const sp = spots[st.spot], d = Math.hypot(p.x - sp.x, p.z - sp.z); if (!st.feedback) status(r, d > HOOPS.ring ? `Walk into the yellow ring (${d.toFixed(1)} m).` : 'In the ring — aim, then E to shoot.'); } }
            else {
                st.physics.update(dt); st.fly += dt; const b = st.physics.pos; ball.position.set(b.x, b.y, b.z); ball.rotation.x -= dt * 6;
                if (b.y > rim.y - 0.4) st.closest = Math.min(st.closest, Math.hypot(b.x - rim.x, b.z - rim.z));
                if (st.made) { st.made = false; st.spot++; s2.sound?.play?.('catch', 0.4); st.feedback = st.spot >= HOOPS.spots ? 'Around the world!' : 'Swish! On to the next spot.'; s2.ui.toast('🏀 Basket!', st.feedback); if (st.spot >= HOOPS.spots) { st.fly = 0; st.done = true; } placeMark(); status(r, st.feedback); }
                if (st.fly > 2.3) { // the rebound: you get the ball back
                    if (st.done) { flow.complete(); return; }
                    if (st.feedback === '' || st.feedback === 'miss') { const toRim = Math.hypot(rim.x - p.x, rim.z - p.z); st.feedback = st.closest > 0.6 ? (Math.hypot(b.x - p.x, b.z - p.z) < toRim ? 'Short — aim a little higher.' : 'Long or off the board — aim a little lower.') : 'Off the rim! So close.'; }
                    st.held = true; st.physics.reset();
                    if (st.shots >= HOOPS.balls) { st.over = true; mark.visible = false; r.button.textContent = 'Play again (E)'; status(r, `Out of balls: ${st.spot} of 5 spots. E plays again.`); }
                    else status(r, st.feedback); st.feedback = '';
                }
            }
            last = { spot: st.spot, shots: st.shots, held: st.held, over: st.over, ball: ball.position.toArray() };
        },
        cancel() { stop(); },
        complete(s2) { const shots = st?.shots; stop(); seaActivity(s2, 'hoops', 'kerry-park', '🏀 Around the world', `A basket from all five spots in ${shots} balls, on the Bayview-Kinnear court below Kerry Park.`); },
    });
    timedActivity(ctx, KERRY_COURT_HOURS, { kind: 'hoops', x: at.x, z: at.z, r: 2.2, title: '🏀 Basketball court', label: 'Shoot hoops on the lower Kerry Park court', source: 'w730946886', cond: () => !st, start });
    const api = { start, shotSpeed, active: () => !!st, debug: () => st && { ...last, spotAt: spots[Math.min(st.spot, 4)] }, hoop, spots, at, Y, rim };
    ctx.extras.kerryHoops = api;
    return api;
}
