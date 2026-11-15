// ============================================================================
//  Lincoln Square: bowl a short game at Lucky Strike (owner, 2026-11-15: real activities; framing the tower is not one).
//  Lucky Strike Bellevue is a tenant of the Lincoln Square podium (OSM n4188521492 "Lucky Strike Lanes & Power Play",
//  sport=10pin; luckystrikeent.com/location/lucky-strike-bellevue: Lincoln Square North, 2nd floor, 16 lanes, billiards;
//  open Sun–Thu 11 am – midnight, Fri–Sat to 2 am, 21+ after 8 pm). The E point is on the podium's sidewalk front
//  nearest to that node; the lane is a remote interior (like the hidden bar's room): one lane of the real 60 ft
//  (18.29 m) length and 41.5 in width between neighbouring lanes, dark walls with LED strips, the masking unit over the
//  pins, a scoring screen. Its decoration is an estimate (no interior survey); the brand name is shown as on the venue.
//
//  Three frames (the engine is spots/bowling.js): A / D line you up on the foul line, the mouse aims (the dotted line on
//  the lane shows where), E releases on the swinging power meter. Leave or Esc stops anytime.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { activityFlow } from '../participation.js';
import { timedActivity } from '../park-hours.js';
import { inPoly } from '../kit.js';
import { declareInterior } from '../precip-shelter.js';
import { BOWL, BALL, LANE, PIN, createRoll, nextRoll, pinSpots, powerAt, scoreGame, speedOf } from '../bowling.js';
import { emitActivity } from './bel-common.js';
import { signBoard } from '../props.js';

export const LUCKY_STRIKE_HOURS = { open: 11, close: 24, note: 'Lucky Strike Bellevue: Sun–Thu 11 am – midnight, Fri–Sat until 2 am; 21+ after 8 pm.' };
const POI = 'n4188521492', X0 = 6400, Z0 = 6400;

function laneTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 2048; const x = c.getContext('2d');
    for (let i = 0; i < 39; i++) { const l = 52 + (i * 37 % 11); x.fillStyle = `hsl(32, 48%, ${l}%)`; x.fillRect(i * 128 / 39, 0, 128 / 39 + 1, 2048); } // 39 boards
    const zPx = (m) => 2048 - m / 19.2 * 2048;
    x.fillStyle = '#5a2a12'; for (const [b, m] of [[5, 4.57], [10, 4.42], [15, 4.27], [20, 4.12], [25, 4.27], [30, 4.42], [35, 4.57]]) { const px = b * 128 / 39, py = zPx(m); x.beginPath(); x.moveTo(px, py - 26); x.lineTo(px - 3, py); x.lineTo(px + 3, py); x.fill(); } // the target arrows
    for (const b of [3, 5, 8, 11, 14]) for (const s of [1, -1]) { x.beginPath(); x.arc(64 + s * (64 - b * 128 / 39) * -1 + (s < 0 ? 0 : 0), zPx(2.13), 1.8, 0, 7); x.fill(); }
    x.fillStyle = '#2b1a10'; x.fillRect(0, 2044, 128, 4); // the foul line
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function pinGeometry() {
    const pts = [[0, 0], [0.026, 0], [0.04, 0.03], [0.059, 0.11], [0.06, 0.14], [0.052, 0.2], [0.032, 0.25], [0.022, 0.27], [0.024, 0.3], [0.03, 0.33], [0.028, 0.36], [0.018, 0.375], [0, 0.381]].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 14);
}
function textCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function luckyStrikeBowling(ctx) {
    const d = ctx.data, g = ctx.ground, flow = activityFlow(ctx), poi = d.pois.find((p) => p.id === POI);
    if (!poi) return null;
    // ---- the E point: on the sidewalk in front of the building that holds the venue, nearest to its mapped node
    const holder = d.buildings.find((b) => inPoly(poi.x, poi.z, b.poly)), inAny = (x, z) => d.buildings.some((b) => inPoly(x, z, b.poly));
    let door = null;
    if (holder) { const P = holder.poly; for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], L = Math.hypot(bx - ax, bz - az); if (L < 2) continue; const nx = (bz - az) / L, nz = -(bx - ax) / L;
        for (let t = 1; t < L - 1; t += 1) { const px = ax + (bx - ax) * t / L, pz = az + (bz - az) * t / L; for (const sgn of [1, -1]) { const ox = px + nx * sgn * 1.6, oz = pz + nz * sgn * 1.6; if (inAny(ox, oz) || ctx.onRoad?.(ox, oz, 0.6)) continue; const dd = Math.hypot(px - poi.x, pz - poi.z); if (!door || dd < door.d) door = { x: ox, z: oz, d: dd, fx: -nx * sgn, fz: -nz * sgn }; } } } }
    if (!door) door = { x: poi.x - 40, z: poi.z, fx: 1, fz: 0 };
    door.y = g.heightAt(door.x, door.z);
    { const sg = signBoard('LUCKY STRIKE · 2nd floor', 2.6, 0.5, { bg: '#0b0d18', fg: '#ffd36b', font: (q) => `700 ${q}px Georgia, serif`, night: 1 }); sg.position.set(door.x + door.fx * 1.45, door.y + 2.9, door.z + door.fz * 1.45); sg.rotation.y = Math.atan2(-door.fx, -door.fz); sg.name = 'lucky-strike-door-sign'; ctx.add(sg); }
    // ---- the lane room (remote, ceilinged; built once, shown while you bowl)
    const room = new THREE.Group(); room.name = 'lucky-strike-lanes'; room.visible = false; ctx.add(room);
    const Y = g.heightAt(X0, Z0) + 0.03, W = (x, z, y = 0) => new THREE.Vector3(X0 + x, Y + y, Z0 - z); // lane frame → world (the lane runs north)
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
    const glow = (c, k = 1.2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.5 });
    const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.copy(W(x, z, y)); m.rotation.y = ry; m.receiveShadow = true; room.add(m); return m; };
    const PITCH = 1.86, LANES = [-1.5, -0.5, 0.5, 1.5].map((k) => k * PITCH); // ours is the second from the left (x = −0.93)
    const OURS = LANES[1], laneMat = M('#c79a5e', { map: laneTexture(), roughness: 0.25, metalness: 0.05, emissive: '#3a2a18', emissiveIntensity: 0.6 });
    const LEN = 19.2;
    for (const lx of LANES) {
        add(new THREE.BoxGeometry(LANE.width, 0.05, LEN), laneMat, lx, -0.025, LEN / 2);
        for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.235, 0.02, LEN), M('#2b2d31', { emissive: '#101114' }), lx + s * (LANE.width / 2 + 0.118), -0.07, LEN / 2); add(new THREE.BoxGeometry(0.06, 0.12, LEN + 4.6), M('#15161a'), lx + s * (PITCH / 2 - 0.03), 0.01, LEN / 2 - 2.3); }
        add(new THREE.BoxGeometry(PITCH, 0.05, 4.6), M('#d8b98a', { roughness: 0.3, emissive: '#4a3a26', emissiveIntensity: 0.5 }), lx, -0.025, -2.3); // the approach
        add(new THREE.BoxGeometry(PITCH, 0.8, 0.6), M('#0d0e12'), lx, -0.4, LANE.pit + 0.6); // the pit
    }
    // walls, ceiling, the masking units over the pin decks, LED strips
    const wallM = M('#121a2e', { emissive: '#0b1020', emissiveIntensity: 1 }), half = 2 * PITCH + 0.3;
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.2, 3.6, 30), wallM, s * half, 1.8, 7);
    add(new THREE.BoxGeometry(half * 2, 3.6, 0.2), wallM, 0, 1.8, -8); add(new THREE.BoxGeometry(half * 2, 3.6, 0.2), wallM, 0, 1.8, 21.5);
    add(new THREE.BoxGeometry(half * 2, 0.2, 30), M('#0a0c14', { emissive: '#06070c' }), 0, 3.6, 7);
    add(new THREE.BoxGeometry(half * 2, 0.04, 30), M('#30262a', { emissive: '#120c0e' }), 0, -0.1, 7);
    const mask = textCanvas(1024, 128), mx = mask.getContext('2d'); mx.fillStyle = '#0b0d18'; mx.fillRect(0, 0, 1024, 128); mx.font = '700 64px Georgia, serif'; mx.textAlign = 'center'; mx.fillStyle = '#ffd36b'; mx.fillText('LUCKY STRIKE', 512, 84);
    const maskT = new THREE.CanvasTexture(mask); maskT.colorSpace = THREE.SRGBColorSpace;
    add(new THREE.BoxGeometry(half * 2, 1.0, 0.3), new THREE.MeshStandardMaterial({ map: maskT, emissive: '#ffffff', emissiveMap: maskT, emissiveIntensity: 0.9 }), 0, 1.6, LANE.head - 1.3);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.05, 27), glow('#36c6ff', 1.6), s * (half - 0.12), 2.6, 7);
    add(new THREE.BoxGeometry(half * 2, 0.05, 0.05), glow('#ff3fa4', 1.6), 0, 1.08, LANE.head - 1.14);
    for (const lx of LANES) add(new THREE.BoxGeometry(LANE.width, 0.06, 0.4), glow('#fff3d6', 1.4), lx, 1.05, LANE.head - 0.95); // the pin-deck lights
    // the settee behind the approach and the scoring screen above it
    add(new THREE.BoxGeometry(2.6, 0.45, 0.7), M('#7a1f2b', { emissive: '#2a0a0f' }), OURS, 0.22, -6.4); add(new THREE.BoxGeometry(2.6, 0.5, 0.15), M('#7a1f2b', { emissive: '#2a0a0f' }), OURS, 0.65, -6.75);
    const scr = textCanvas(1024, 256), scrT = new THREE.CanvasTexture(scr); scrT.colorSpace = THREE.SRGBColorSpace;
    add(new THREE.BoxGeometry(2.2, 0.55, 0.06), new THREE.MeshStandardMaterial({ map: scrT, emissive: '#ffffff', emissiveMap: scrT, emissiveIntensity: 1 }), OURS, 2.75, -0.6).rotation.x = -0.25;
    const drawScore = (rolls, name = 'YOU') => {
        const x = scr.getContext('2d'), sg = scoreGame(rolls); x.fillStyle = '#10142a'; x.fillRect(0, 0, 1024, 256); x.strokeStyle = '#9fb4ff'; x.lineWidth = 4; x.font = '700 44px system-ui'; x.fillStyle = '#ffd36b'; x.fillText(name, 24, 150);
        sg.frames.forEach((f, i) => { const fx = 220 + i * 230; x.strokeRect(fx, 30, 220, 200); x.fillStyle = '#c9d4ff'; x.font = '600 30px system-ui'; x.fillText(String(i + 1), fx + 8, 60);
            const marks = []; f.rolls.forEach((r, k) => { const prev = k > 0 ? f.rolls[k - 1] : null; marks.push(r === 10 && (k === 0 || prev === 10 || (prev !== null && k === 2 && f.rolls[0] + f.rolls[1] === 10)) ? 'X' : prev !== null && prev !== 10 && prev + r === 10 ? '/' : r === 0 ? '–' : String(r)); });
            x.fillStyle = '#ffffff'; x.font = '700 40px system-ui'; marks.forEach((m, k) => x.fillText(m, fx + 80 + k * 46, 66)); if (f.total !== null) { x.font = '700 64px system-ui'; x.fillText(String(f.total), fx + 60, 190); } });
        scrT.needsUpdate = true;
    };
    drawScore([]);
    // pins (ours, moving), the neighbours' racks (still), the ball
    const pinG = pinGeometry(), pinM = M('#f5f3ee', { roughness: 0.3, emissive: '#3a3a38', emissiveIntensity: 0.6 }), stripeM = M('#c21d2b', { emissive: '#3a0508' });
    const spots = pinSpots(), pins = spots.map(() => { const p = new THREE.Group(); p.add(new THREE.Mesh(pinG, pinM)); for (const y of [0.262, 0.282]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.0235, 0.0235, 0.01, 12), stripeM); r.position.y = y; p.add(r); } room.add(p); return p; });
    for (const lx of LANES) if (lx !== OURS) for (const sp of spots) { const m = new THREE.Mesh(pinG, pinM); m.position.copy(W(lx + sp.x, sp.z)); room.add(m); }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL.r, 20, 14), new THREE.MeshStandardMaterial({ color: '#2547d0', roughness: 0.15, metalness: 0.2, emissive: '#0a1440' })); room.add(ball);
    const aimDots = new THREE.Group(); for (let i = 0; i < 14; i++) aimDots.add(new THREE.Mesh(new THREE.CircleGeometry(0.018, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.8 }))); room.add(aimDots);
    for (const [z, k] of [[-2, 30], [9, 30], [17, 26]]) { const l = new THREE.PointLight('#ffe7c4', k, 14, 1.6); l.position.copy(W(OURS, z, 3.1)); room.add(l); }
    declareInterior(ctx, { box: { x0: X0 - half, z0: Z0 - 22, x1: X0 + half, z1: Z0 + 8 }, y0: Y - 1, y1: Y + 3.7, pad: 1, name: 'lucky-strike-lanes' });
    const setPins = (standing, sim = null) => pins.forEach((p, i) => {
        const up = standing.includes(i), q = sim?.pins.find((s) => s.i === i);
        if (q && !q.gone) { p.visible = true; p.position.copy(W(OURS + q.x, q.z)); if (q.down) { p.userData.fall = Math.min(1, (p.userData.fall || 0) + 0.12); p.rotation.set(Math.PI / 2 * p.userData.fall, (q.i * 1.7) % 6.28, 0, 'YXZ'); } else p.rotation.set(0, 0, 0); }
        else if (q?.gone) p.visible = false;
        else { p.visible = up; p.userData.fall = 0; p.rotation.set(0, 0, 0); p.position.copy(W(OURS + spots[i].x, spots[i].z)); }
    });
    // ---- the game
    let st = null, last = null, lastSession = null, mapUpdate = null;
    const restoreMap = () => { if (mapUpdate && lastSession?.map) { lastSession.map.update = mapUpdate; mapUpdate = null; } };
    const say = (r, text) => { const nr = nextRoll(st.rolls), sg = scoreGame(st.rolls); r.status.textContent = `${text}  ·  frame ${Math.min(BOWL.frames, nr.frame + 1)} of ${BOWL.frames} · score ${sg.total}`; };
    const stop = (s) => { if (!st) return; st = null; room.visible = false; restoreMap(); s.ctl.enter(door.x, door.z, Math.atan2(door.fx, door.fz), door.y); /* (facing out to the street) */ s.returnFocus?.(); };
    const start = (s) => flow.begin(s, {
        title: '🎳 Lucky Strike · three frames', action: 'Release (E)', cameraRide: true,
        help: 'A / D line you up on the foul line, the mouse aims (the yellow dots show the line), E releases on the swinging power meter. Three frames — strikes and spares score as usual. Leave or Esc stops.',
        started(s2, r) {
            lastSession = s2; room.visible = true; if (!mapUpdate && s2.map) { mapUpdate = s2.map.update; s2.map.update = function (dt, p) { return mapUpdate.call(this, dt, room.visible ? { ...door, heading: p.heading } : p); }; }
            st = { rolls: [], standing: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], phase: 'aim', x: 0.12, look: 0, pitch: -0.12, t: 0, wait: 0, sim: null, camZ: -1.7 };
            drawScore([]); setPins(st.standing); r.progress.max = 1; say(r, 'Line up with A / D, aim with the mouse, E on the power you want.');
        },
        actioned(s2, r) {
            if (!st || st.phase !== 'aim') return;
            const power = powerAt(st.t), wobble = (Math.random() - 0.5) * 0.007 * (0.4 + power), angle = Math.max(-BOWL.maxAngle, Math.min(BOWL.maxAngle, -st.look * 0.15 + wobble)); /* (a harder ball wanders a little more) */
            st.sim = createRoll({ x: st.x, angle, speed: speedOf(power), standing: st.standing }); st.phase = 'roll'; r.busy = true; st.power = power; s2.sound?.play?.('thump', 0.25); say(r, `Released at ${speedOf(power).toFixed(1)} m/s…`);
        },
        update(dt, s2, r) {
            if (!st) return;
            const inp = s2.input || {}, keys = inp.keys || new Set(), lk = inp.takeLook?.() || { dx: 0, dy: 0 };
            st.look = Math.max(-0.4, Math.min(0.4, st.look - lk.dx * 0.0024)); st.pitch = Math.max(-0.6, Math.min(0.4, st.pitch - lk.dy * 0.0024));
            let camZ = -1.7, camX = OURS + st.x;
            if (st.phase === 'aim') {
                st.t += dt; const side = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
                st.x = Math.max(-BOWL.maxX, Math.min(BOWL.maxX, st.x + side * 0.8 * dt)); r.progress.value = powerAt(st.t);
                ball.position.copy(W(OURS + st.x + 0.18, -0.3, 0.75)); aimDots.visible = true;
                const angle = Math.max(-BOWL.maxAngle, Math.min(BOWL.maxAngle, -st.look * 0.15)); aimDots.children.forEach((m, i) => { const z = 1 + i * 0.6; m.position.copy(W(OURS + st.x + Math.sin(angle) * z, z, 0.006)); });
                setPins(st.standing);
            } else {
                aimDots.visible = false; const sim = st.sim;
                if (st.phase === 'roll') { for (let k = Math.round(dt / BOWL.step); k > 0 && !sim.done; k--) sim.step(); if (sim.done) { st.phase = 'settle'; st.wait = 1.6; const down = sim.down.length; st.rolls.push(down); drawScore(st.rolls);
                    const nr = nextRoll(st.rolls), fresh = st.standing.length === 10, all = down === st.standing.length; say(r, sim.gutter ? 'Gutter ball.' : all && fresh ? 'STRIKE!' : all ? 'Spare!' : `${down} pin${down === 1 ? '' : 's'}.`);
                    if (all) s2.ui.toast(fresh ? '🎳 Strike!' : '🎳 Spare!', fresh ? 'All ten.' : 'Cleaned up.'); st.next = nr; } }
                const b = sim.ball; ball.visible = !b.gone; ball.position.copy(W(OURS + b.x, b.z, BALL.r - (b.gutter ? 0.08 : 0))); ball.rotation.x -= dt * 30;
                setPins(st.standing, sim);
                camZ = Math.min(10.5, Math.max(-1.7, b.z - 6)); camX = OURS + st.x + (b.x - st.x) * 0.4;
                if (st.phase === 'settle') { st.wait -= dt; camZ = st.camZ; if (st.wait <= 0) {
                    if (st.next.over) { flow.complete(); return; }
                    st.standing = st.next.fresh ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : sim.standing; st.sim = null; st.phase = 'aim'; st.t = 0; r.busy = false; ball.visible = true;
                    say(r, st.next.ball === 0 ? 'Next frame — a full rack.' : st.next.fresh ? 'A fresh rack — bonus ball.' : `${st.standing.length} pin${st.standing.length === 1 ? '' : 's'} left: pick up the spare.`); } }
            }
            st.camZ = camZ;
            const c = s2.ctl, eye = W(camX, camZ, st.phase === 'aim' ? 1.55 : 1.45), yaw = st.look;
            c.x = door.x; c.z = door.z; c.y = door.y; c.heading = yaw; c.pitch = st.pitch;
            if (c.rig) { c.rig.position.copy(eye); c.rig.rotation.set(st.pitch, yaw, 0, 'YXZ'); }
            last = { phase: st.phase, rolls: st.rolls.slice(), x: st.x, look: st.look, standing: st.standing.slice(), total: scoreGame(st.rolls).total };
        },
        cancel(s2) { stop(s2); },
        complete(s2) { const sg = scoreGame(st.rolls), strikes = st.rolls.filter((v) => v === 10).length; stop(s2); emitActivity(s2, 'bel-lincoln-square', 'bowling', '🎳 Three frames at Lucky Strike', `You bowled ${sg.total} in three frames${strikes ? ` with ${strikes} strike${strikes > 1 ? 's' : ''}` : ''}.`); },
    });
    timedActivity(ctx, LUCKY_STRIKE_HOURS, { kind: 'bowling', x: door.x, z: door.z, y: door.y, r: 2.2, title: '🎳 Lucky Strike', label: 'Bowl three frames at Lucky Strike', source: POI, cond: () => !st, start });
    const api = { start, active: () => !!st, debug: () => st && last, door, room, lane: { x: OURS, W } };
    ctx.extras.luckyStrike = api;
    return api;
}
void PIN;
