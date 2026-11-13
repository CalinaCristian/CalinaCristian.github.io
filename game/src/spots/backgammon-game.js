// ============================================================================
//  A game of table (Romanian backgammon) at a concrete table of "La Șahiști", Cișmigiu, against Doru, a fictional
//  park regular (not a representation of a real person). The player sits down on the east seat and plays on the
//  board itself: throws the dice, taps or drags a checker to a marked landing spot, hands the dice over; Doru then
//  throws and moves his own checkers and talks the way old table players do (backgammon-banter.js). Rules:
//  backgammon-engine.js (Romanian opening, linie / marț scoring, first to three lines). Research and the sources of
//  the lines: game/research/bucharest-spots.md, "Table (Romanian backgammon)". Board, checker and dice sizes are estimates.
//
//  ctx.extras.backgammon: { state(), score(), result(), legalMoves(), events(), debug: { … } } for checks.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { GeoBatch, M } from './kit.js';
import { makeCrowd } from '../crowd.js';
import { activityFlow, activityBlocked } from './participation.js';
import { createGame, rollDice, legalMoves, applyMove, confirmTurn, chooseTurn, pipCount, gameResult, checkerRoutes, rollLuck } from './backgammon-engine.js';
import { createBanter, analyse, callRoll, TALK } from './backgammon-banter.js';

const CSS = `.sp-participation.bg-game{left:50%;right:auto;transform:translateX(-50%);bottom:12px;width:min(900px,calc(100vw - 24px));padding:8px 12px;background:#182027ee;display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"dice text nav" "more more more";column-gap:12px;align-items:center}
.bg-game h2,.bg-game [data-help],.bg-game progress{display:none}
.bg-game .bg-dice{grid-area:dice;display:flex;gap:5px;align-items:center;justify-content:center;min-width:74px;min-height:36px}
.bg-die{width:34px;height:34px;border-radius:7px;background:#f8efd9;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);padding:5px;box-sizing:border-box;box-shadow:0 2px 0 #b9ad92}
.bg-die i{width:6px;height:6px;border-radius:50%;background:#201b18;place-self:center}.bg-die[data-used]{opacity:.32}.bg-die[data-his]{background:#e2d3b4}
.bg-die.small{width:25px;height:25px;padding:3px;border-radius:5px}.bg-die.small i{width:4.5px;height:4.5px}
.bg-game .bg-text{grid-area:text;min-width:0}.bg-game .bg-text p{margin:0}
.bg-game [data-status]{font-weight:600;font-size:14px;min-height:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bg-game .bg-log{font-size:12px;color:#fde9b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bg-game .bg-log small{color:#c9d1d8;font-style:italic;margin-left:6px}
.bg-game .bg-summary{font-size:11px;color:#c9d1d8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bg-game .bg-summary b{color:#fff}
.bg-game nav{grid-area:nav;margin:0;flex-wrap:nowrap;gap:6px}.bg-game nav button{padding:8px 11px;white-space:nowrap}.bg-game .bg-quiet{background:#465360;color:#fff}
.bg-game .bg-more{grid-area:more}.bg-game .bg-talk,.bg-game .bg-rules{display:none;margin-top:8px}.bg-game .bg-talk.open{display:flex;flex-wrap:wrap;gap:6px}.bg-game .bg-rules.open{display:block;font-size:12px;color:#d6dce2}.bg-game .bg-rules p{margin:3px 0}
.bg-game .bg-talk button{min-height:40px;padding:6px 10px;background:#2f3d4a;color:#fff;font-weight:600;text-align:left}.bg-game .bg-talk button small{display:block;font-weight:400;opacity:.75;font-style:italic}
@media(max-width:700px),(max-height:500px){.sp-participation.bg-game{left:8px;right:8px;transform:none;width:auto;padding:8px 10px;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"dice text" "nav nav" "more more";row-gap:6px}.bg-game nav{flex-wrap:wrap}.bg-game nav button{padding:8px 9px;font-size:13px;flex:1 1 auto}.bg-game [data-status]{font-size:13px;white-space:normal;min-height:2.7em}.bg-game .bg-log{white-space:normal;min-height:2.7em}}`;

const side = (p) => (p === 1 ? 0 : 1), cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const CH_R = 0.018, CH_H = 0.009, DIE = 0.026;
const pointX = (i) => { const col = i >= 12 ? i - 12 : 11 - i; return (col - 5.5) * 0.045 + (col < 6 ? -0.014 : 0.014); };
/** where a checker lies, in board coordinates (x across, z toward the player, y up from the playing surface) */
const place = (p, point, stack) => {
    if (point === 'bar') return new THREE.Vector3(0, 0.0165 + stack * 0.010, p === 1 ? 0.065 : -0.065);
    if (point === 'off') return new THREE.Vector3(p === 1 ? 0.365 : -0.365, -0.0075, (p === 1 ? 0.245 : -0.245) - (p === 1 ? 1 : -1) * stack * 0.035);
    const top = point >= 12, j = stack % 5;
    return new THREE.Vector3(pointX(point), 0.0055 + Math.floor(stack / 5) * 0.010, (top ? -0.238 : 0.238) + (top ? 1 : -1) * j * 0.036);
};
const locations = (s) => [1, -1].map((p) => {
    const out = [];
    for (let i = 0; i < 24; i++) for (let j = 0; j < s.points[i] * p; j++) out.push(place(p, i, j));
    for (let j = 0; j < s.bar[side(p)]; j++) out.push(place(p, 'bar', j));
    for (let j = 0; j < s.off[side(p)]; j++) out.push(place(p, 'off', j));
    return out;
}).flat();
const randomDie = () => { if (globalThis.crypto?.getRandomValues) { const a = new Uint32Array(1), limit = Math.floor(0x100000000 / 6) * 6; do { crypto.getRandomValues(a); } while (a[0] >= limit); return a[0] % 6 + 1; } return Math.floor(Math.random() * 6) + 1; };
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [-1, 1], [1, -1], [1, 1]], 5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]] };
const FACES = [null, { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] }, { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] }, { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] }, { n: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] }, { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] }];
const UP = new THREE.Vector3(0, 1, 0);

// short wooden knocks out of the spot's noise buffer (checkers put down, dice rattling in the box)
function knock(s, { f = 1400, q = 4, gain = 0.5, dur = 0.05, delay = 0 } = {}) {
    const a = s?.sound; if (!a?.started || !a.ctx || a.muted || !a.out || !a.noise) return;
    try {
        const c = a.ctx, t = c.currentTime + delay, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
        src.buffer = a.noise; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
        g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(fl); fl.connect(g); g.connect(a.out); src.start(t, Math.random()); src.stop(t + dur + 0.02);
    } catch { /* audio is optional */ }
}
const clack = (s, hard = false) => { knock(s, { f: 1050, q: 3, gain: hard ? 1.1 : 0.6, dur: 0.06 }); knock(s, { f: 2600, q: 2, gain: hard ? 0.5 : 0.25, dur: 0.025 }); };
const rattle = (s) => { for (let i = 0; i < 8; i++) knock(s, { f: 2600 + Math.random() * 1800, q: 5, gain: 0.45 * (1 - i / 10), dur: 0.03, delay: 0.05 + i * 0.07 + Math.random() * 0.03 }); };

export function backgammonGame(ctx, { x, y, z, source, onDone }) {
    const flow = activityFlow(ctx), root = new THREE.Group(); root.name = 'cismigiu-backgammon'; root.userData.noFloor = true; ctx.add(root);
    root.position.set(x, y + 0.012, z); root.rotation.y = Math.PI / 2; root.updateMatrixWorld(true); // the player's side of the board faces the east seat
    // ---- the board: a wooden box board with inlaid points, and what regulars keep beside it (a score notebook, a
    // wristwatch, a few one-ban coins)
    const batch = new GeoBatch(); batch.box(0, -0.012, 0, 0.66, 0.012, 0.55, '#a8794c', 'wood');
    for (const sd of [-1, 1]) { batch.box(sd * 0.326, 0, 0, 0.016, 0.018, 0.55, '#69472f', 'wood'); batch.box(0, 0, sd * 0.268, 0.66, 0.018, 0.014, '#69472f', 'wood'); }
    batch.box(0, 0, 0, 0.028, 0.012, 0.52, '#69472f', 'wood');
    for (let i = 0; i < 24; i++) { const px = pointX(i), top = i >= 12, zz = top ? -0.255 : 0.255; batch.flat([[px - 0.021, zz], [px + 0.021, zz], [px, top ? -0.035 : 0.035]], 0.001, i % 2 ? '#e5c78f' : '#783f2d', 'paint'); }
    batch.box(-0.2, -0.012, -0.375, 0.085, 0.008, 0.12, '#2f4a3a', 'paint', 0.2); batch.box(-0.2, -0.004, -0.375, 0.078, 0.002, 0.112, '#efe9da', 'paint', 0.2); // the notebook
    batch.cyl(0.28, -0.012, -0.4, 0.017, 0.006, '#c9c2b0', 'metal', 14); batch.box(0.28, -0.012, -0.4, 0.014, 0.003, 0.11, '#3a2c22', 'rubber', 0.5); // a wristwatch
    for (const [cx, cz, n] of [[-0.39, -0.3, 3], [-0.41, -0.275, 1]]) for (let k = 0; k < n; k++) batch.cyl(cx, -0.012 + k * 0.0016, cz, 0.0085, 0.0016, '#b98b4a', 'metal', 10);
    root.add(batch.build('backgammon-board'));
    const checkers = new THREE.InstancedMesh(new THREE.CylinderGeometry(CH_R, CH_R, CH_H, 20), new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.55, metalness: 0.02 }), 30);
    checkers.name = 'backgammon-30-checkers'; checkers.castShadow = true; checkers.receiveShadow = true; checkers.frustumCulled = false; root.add(checkers);
    for (let i = 0; i < 30; i++) checkers.setColorAt(i, new THREE.Color(i < 15 ? '#f2e4c7' : '#4d2c20')); checkers.instanceColor.needsUpdate = true;
    const diceMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(DIE, DIE, DIE), new THREE.MeshStandardMaterial({ color: '#f8efd9', roughness: 0.45 }), 2); diceMesh.name = 'backgammon-dice'; diceMesh.castShadow = true; diceMesh.frustumCulled = false; root.add(diceMesh);
    const pips = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0024, 8, 5), new THREE.MeshStandardMaterial({ color: '#201b18', roughness: 0.8 }), 42); pips.name = 'backgammon-dice-pips'; pips.frustumCulled = false; root.add(pips);
    // markers on the board: rings on the checkers that can move, discs where the chosen one can land, Doru's advice
    const glow = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false });
    const ringGeo = new THREE.TorusGeometry(CH_R + 0.0012, 0.0022, 6, 28); ringGeo.rotateX(Math.PI / 2);
    const mark = (geo, mat, n, name) => { const m = new THREE.InstancedMesh(geo, mat, n); m.name = name; m.count = 0; m.frustumCulled = false; m.userData.noAudit = true; m.renderOrder = 3; root.add(m); return m; };
    const srcRings = mark(ringGeo, glow('#ffd34d', 0.95), 16, 'backgammon-movable'), selRing = mark(ringGeo, glow('#ffffff', 1), 1, 'backgammon-selected');
    const dstDiscs = mark(new THREE.CylinderGeometry(CH_R * 0.92, CH_R * 0.92, 0.0018, 24), glow('#4ade80', 0.8), 8, 'backgammon-landing'), hintRings = mark(ringGeo, glow('#60a5fa', 1), 2, 'backgammon-advice');
    // ---- Doru and an onlooker (chibiț) standing by the table
    const people = makeCrowd({ max: 2, city: 'bucharest', rng: () => 0.5 }); people.count = 2;
    people.dress(0, { top: '#43594b', bottom: '#4b443d', skin: '#cda886', hair: '#a9a7a0', acc: '#82684d', flags: 0 });
    let doruPose = 'sit', reachT = 0;
    const seatDoru = (pose) => { if (pose === doruPose) return; doruPose = pose; people.set(0, { x: x - 0.95, y: y - 0.8, z, yaw: -Math.PI / 2, pose, amp: 0, phase: 1.4, scale: 0.98 }); };
    people.set(0, { x: x - 0.95, y: y - 0.8, z, yaw: -Math.PI / 2, pose: 'sit', amp: 0, phase: 1.4, scale: 0.98 });
    const kib = { x: x - 1.3, z: z + 1.0 };
    people.dress(1, { top: '#5d5f66', bottom: '#3d3a36', skin: '#d2b091', hair: '#8f8d88', acc: '#3b4148', flags: 4 });
    people.set(1, { x: kib.x, y: y - 0.8, z: kib.z, yaw: Math.atan2(kib.x - x, kib.z - z), pose: 'stand', amp: 0, phase: 0.6, scale: 1 });
    ctx.add(people.object); people.object.name = 'Doru-fictional-park-regular'; people.object.userData.fictional = true;
    ctx.circle(x - 0.95, z, 0.28, 1.3); ctx.circle(kib.x, kib.z, 0.26, 1.8); (ctx.extras.sceneCleanups ||= []).push(() => people.dispose());
    const mouths = { doru: { x: x - 0.93, y: y + 0.6, z }, kibitz: { x: kib.x, y: y + 0.62, z: kib.z } }; // (the onlooker's head is often above the seated view: his bubble hangs at his chest)

    // ---- state
    let match = createGame(), turnStart = match, undo = [], selected = null, routes = [], pendingMoves = [], played = 0, hitSaid = false;
    let score = { you: 0, doru: 0 }, games = 0, awarded = false, finishedThisSitting = false, scored = false, greeted = false;
    let clock = 0, aiWait = 0.8, plan = null, passT = 0, idleT = 0, nextIdle = 24, hint = null, hintT = 0, focus = -1;
    let moveCacheFor = null, moveCache = [];
    const banter = createBanter(), diceQueue = [];
    const die = () => (diceQueue.length ? diceQueue.shift() : randomDie());
    const movesFor = () => { if (moveCacheFor !== match) { moveCacheFor = match; moveCache = legalMoves(match); } return moveCache; };
    const events = [], record = (action, detail = {}) => { events.push({ action, ...detail, state: match }); if (events.length > 600) events.shift(); };
    const current = () => (flow.run?.backgammon === true ? flow.run : null);

    // ---- checkers on the board
    let toPos = locations(match), fromPos = toPos.map((v) => v.clone()), animT = 1, animHit = false, drag = null;
    const writeCheckers = () => {
        const k = animT < 1 ? animT * (2 - animT) : 1, v = new THREE.Vector3();
        const lifted = selected !== null && !drag ? topIndex(selected) : -1;
        for (let i = 0; i < 30; i++) {
            v.copy(fromPos[i]).lerp(toPos[i], k);
            if (animT < 1 && fromPos[i].distanceToSquared(toPos[i]) > 1e-10) v.y += Math.sin(animT * Math.PI) * 0.05;
            if (i === lifted) v.y += 0.012;
            if (drag?.index === i && drag.at) v.copy(drag.at);
            checkers.setMatrixAt(i, M(v.x, v.y, v.z));
        }
        checkers.instanceMatrix.needsUpdate = true;
    };
    const setCheckers = (s, animate) => {
        const next = locations(s);
        if (animate) {
            const assigned = Array(30), free = new Set(next.map((_, i) => i));
            for (let i = 0; i < 30; i++) { const j = [...free].find((q) => (i < 15) === (q < 15) && toPos[i].distanceToSquared(next[q]) < 1e-12); if (j !== undefined) { assigned[i] = next[j]; free.delete(j); } }
            for (let i = 0; i < 30; i++) if (!assigned[i]) { const j = [...free].find((q) => (i < 15) === (q < 15)); assigned[i] = next[j]; free.delete(j); }
            fromPos = toPos.map((v) => v.clone()); toPos = assigned; animT = 0;
        } else { toPos = next; fromPos = next.map((v) => v.clone()); animT = 1; }
        writeCheckers();
    };
    /** the instance lying on top of the player's stack at `from` */
    function topIndex(from) {
        const n = from === 'bar' ? match.bar[0] : match.points[from]; if (!(n > 0)) return -1;
        const at = place(1, from, n - 1); for (let i = 0; i < 15; i++) if (toPos[i].distanceToSquared(at) < 1e-12) return i; return -1;
    }

    // ---- dice
    const dice = [0, 1].map((i) => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), value: i ? 2 : 5, anim: null }));
    const waitSpot = (who, i) => new THREE.Vector3(who * (0.165 + i * 0.05), -0.012 + DIE / 2, who * (0.34 - i * 0.012));
    const restSpot = (who, i, other) => { let v; for (let k = 0; k < 12; k++) { v = new THREE.Vector3(who * (0.085 + Math.random() * 0.15), 0.001 + DIE / 2, (Math.random() - 0.5) * 0.09); if (!other || v.distanceTo(other) > 0.05) break; } return v; };
    const faceUp = (value, yaw) => new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...FACES[value].n), UP));
    const writeDice = () => {
        let at = 0; const p = new THREE.Vector3(), m = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
        dice.forEach((d, i) => {
            diceMesh.setMatrixAt(i, m.compose(d.pos, d.quat, one));
            for (let value = 1; value <= 6; value++) { const f = FACES[value]; for (const [a, b] of PIPS[value]) { p.set(...f.n).multiplyScalar(DIE / 2 + 0.0002).addScaledVector(new THREE.Vector3(...f.u), a * DIE * 0.24).addScaledVector(new THREE.Vector3(...f.v), b * DIE * 0.24).applyQuaternion(d.quat).add(d.pos); pips.setMatrixAt(at++, M(p.x, p.y, p.z)); } }
        });
        diceMesh.instanceMatrix.needsUpdate = true; pips.instanceMatrix.needsUpdate = true;
    };
    const throwDie = (i, who, value, other = null) => { const d = dice[i], p1 = restSpot(who, i, other); d.value = value; d.anim = { kind: 'throw', p0: d.pos.clone().setY(0.09), p1, q1: faceUp(value, Math.random() * Math.PI * 2), spin: [6 + Math.random() * 8, 5 + Math.random() * 7, 6 + Math.random() * 8].map((v, k) => v * ((i + k) % 2 ? -1 : 1)), t: 0, dur: 0.72 + i * 0.07 }; return p1; };
    const handDice = (who) => dice.forEach((d, i) => { const p1 = waitSpot(who, i); if (d.pos.distanceTo(p1) > 1e-4) d.anim = { kind: 'slide', p0: d.pos.clone(), p1, q0: d.quat.clone(), q1: faceUp(d.value, who === 1 ? 0.3 - i * 0.5 : 2.8 + i * 0.5), t: 0, dur: 0.5 }; });
    const stepDice = (dt) => {
        let moving = false;
        for (const d of dice) {
            const a = d.anim; if (!a) continue; moving = true;
            a.t = Math.min(1, a.t + dt / a.dur); const u = a.t;
            if (a.kind === 'throw') {
                const v = Math.min(1, u / 0.7), w = Math.max(0, (u - 0.7) / 0.3), k = 0.86 * v + 0.14 * w;
                d.pos.lerpVectors(a.p0, a.p1, k); d.pos.y = a.p0.y + (a.p1.y - a.p0.y) * v + 4 * 0.035 * v * (1 - v) + 4 * 0.012 * w * (1 - w);
                const f = Math.pow(1 - u, 1.6); d.quat.copy(a.q1).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(a.spin[0] * f, a.spin[1] * f, a.spin[2] * f)));
            } else { d.pos.lerpVectors(a.p0, a.p1, u * (2 - u)); d.pos.y += Math.sin(u * Math.PI) * 0.03; d.quat.slerpQuaternions(a.q0, a.q1, u); }
            if (a.t >= 1) { d.pos.copy(a.p1); d.quat.copy(a.q1); d.anim = null; }
        }
        if (moving) writeDice();
        return moving;
    };
    const diceMoving = () => dice.some((d) => d.anim), busy = () => animT < 1 || diceMoving() || pendingMoves.length > 0;
    dice.forEach((d, i) => { d.pos.copy(waitSpot(1, i)); d.quat.copy(faceUp(d.value, 0.3 - i * 0.5)); });
    setCheckers(match, false); writeDice();

    // ---- speech: one bubble at a time over the speaker's head, and the same line in the panel
    const speech = [], bubbles = {}; let speechT = 0, lastLine = null;
    const speak = (line, s) => { if (!line) return; if (speech.length > 2) speech.splice(0, speech.length - 2); speech.push(line); if (speechT <= 0 && s) stepSpeech(0, s); };
    const speakAll = (lines, s) => { for (const l of lines || []) speak(l, s); };
    function stepSpeech(dt, s) { // (a line is read for a moment before the next one; a speaker's new bubble replaces his last)
        speechT -= dt; if (speechT > 0 || !speech.length) return;
        const line = speech.shift(), layer = s.ui?.bubbles; lastLine = line;
        if (line.who !== 'you' && layer) {
            const old = bubbles[line.who] && layer.list.find((b) => b.el === bubbles[line.who]); if (old) old.until = 0;
            const el = bubbles[line.who] = layer.say(mouths[line.who] || mouths.doru, line.ro, line.en, line.who === 'kibitz' ? '' : 'friendly', 'ro'); el.dataset.prio = '1';
        }
        speechT = Math.min(2.4, 0.9 + (line.ro.length + line.en.length) * 0.012);
        if (line.who === 'doru' && (line.look || match.phase !== 'move')) view.glanceHold = speechT + 0.5; // (the player looks up at him between turns, not while checkers are being moved)
        record('say', { who: line.who, key: line.key, ro: line.ro });
        const r = current(); if (r) showLine(r);
    }
    const showLine = (r) => { r.log.replaceChildren(); if (!lastLine) return; const b = document.createElement('span'); b.lang = 'ro'; b.textContent = `${lastLine.who === 'you' ? 'You' : lastLine.who === 'kibitz' ? 'Onlooker' : 'Doru'}: „${lastLine.ro}”`; const e = document.createElement('small'); e.textContent = lastLine.en; r.log.append(b, e); };

    // ---- the game
    const resetSelection = () => { selected = null; routes = []; focus = -1; };
    const select = (from) => { selected = from; routes = from === null ? [] : checkerRoutes(match, from); focus = -1; if (from !== null && !routes.length) selected = null; };
    const sources = () => (match.turn === 1 && match.phase === 'move' ? [...new Set(movesFor().map((m) => m.from))] : []);
    const landing = (to) => (to === 'off' ? place(1, 'off', match.off[0]) : place(1, to, Math.max(0, match.points[to])));
    const newGame = () => {
        if (score.you >= 3 || score.doru >= 3) score = { you: 0, doru: 0 };
        match = createGame(); turnStart = match; undo = []; pendingMoves = []; played = 0; plan = null; scored = false; aiWait = 0.9; passT = 0; resetSelection();
        record('new-game'); setCheckers(match, false); handDice(1); idleT = 0;
    };
    const afterRoll = (s) => { // the roll is on the board: who says what, and whether the roller can move at all
        const who = match.turn, luck = rollLuck(match), moves = movesFor();
        speak(banter.roll({ who, dice: match.dice, pct: luck?.pct ?? null, canMove: moves.length > 0, onBar: match.bar[side(who)] > 0, hitChance: moves.some((m) => m.hit) }, clock), s);
        turnStart = match; undo = []; played = 0; hitSaid = false; plan = null; resetSelection();
        if (who === 1 && moves.some((m) => m.from === 'bar')) select('bar');
        if (who === 1 && !moves.length) passT = 2.2; // nothing can be played: the dice pass on by themselves
        aiWait = 2.1 + Math.random() * 0.6; idleT = 0; nextIdle = 26; // (Doru thinks until the camera is back over the board)
    };
    const roll = (s) => {
        if (busy() || !['opening', 'roll'].includes(match.phase)) return false;
        const a = die(), b = die(), opening = match.phase === 'opening', who = match.turn;
        match = rollDice(match, a, b); record('roll', { dice: [a, b], opening }); rattle(s); if (opening || who === -1) reachT = 0.9;
        if (opening) { // one die each: the player's falls on the near right, Doru's on his own right
            dice[0].pos.copy(waitSpot(1, 0)); dice[1].pos.copy(waitSpot(-1, 0)); throwDie(0, 1, a); throwDie(1, -1, b);
            speak(banter.opening([a, b], clock), s); aiWait = 2.1; idleT = 0; afterOpening = match.phase === 'roll' ? match.turn : 0;
        } else { const first = throwDie(0, who, a), second = throwDie(1, who, b, first); watchDice(first, second); afterRoll(s); }
        return true;
    };
    let afterOpening = 0; // the opening winner takes both dice once they have come to rest
    const applyOne = (m, s) => {
        const before = match, who = match.turn; match = applyMove(match, m); played++; if (who === -1) reachT = 0.75;
        record('move', { player: who, move: { ...m } }); animHit = !!m.hit; setCheckers(match, true);
        if (m.hit && who === 1 && !hitSaid) { hitSaid = true; speak(banter.turn({ who, tags: analyse(before, match, who) }, clock), s); }
        if (match.phase === 'finished') finish(s);
    };
    const playRoute = (route, s) => { undo.push({ match, played, hitSaid }); pendingMoves = route.moves.slice(1); resetSelection(); applyOne(route.moves[0], s); idleT = 0; };
    const endTurn = (s, said = true) => {
        if (match.phase !== 'move' || movesFor().length || busy()) return false;
        const who = match.turn, tags = analyse(turnStart, match, who); if (who === 1 && hitSaid) tags.hits = 0;
        if (said && played) speak(banter.turn({ who, tags }, clock), s);
        match = confirmTurn(match); record(who === 1 ? 'confirm-turn' : 'opponent-confirm'); turnStart = match; undo = []; played = 0; plan = null; resetSelection();
        handDice(match.turn); aiWait = 1.0; idleT = 0; nextIdle = 24;
        if (match.turn === -1) speak(banter.standing(match, clock), s);
        return true;
    };
    function finish(s) {
        if (scored) return; scored = true; finishedThisSitting = true; games++;
        const result = gameResult(match); score[result.winner === 1 ? 'you' : 'doru'] += result.points;
        record('game-over', { winner: result.winner, points: result.points, kind: result.kind, score: { ...score } });
        speakAll(banter.end(result, score, clock), s); pendingMoves = []; resetSelection();
        if (result.winner === 1 && !awarded) { awarded = true; record('awarded'); onDone?.(s, result); }
    }
    const undoMove = (s) => {
        if (match.turn !== 1 || match.phase !== 'move' || !undo.length || busy()) return false;
        const u = undo.pop(); match = u.match; played = u.played; hitSaid = u.hitSaid; record('undo'); resetSelection(); setCheckers(match, false); passT = 0;
        if (movesFor().some((m) => m.from === 'bar')) select('bar');
        speak(banter.say('pUndo', {}, clock), s); return true;
    };
    /** what the big button, E and a tap on the dice do now */
    const mainAction = (s) => {
        if (busy() || activityBlocked(s)) return false;
        if (match.phase === 'finished') { newGame(); return true; }
        if (match.phase === 'opening' || (match.phase === 'roll' && match.turn === 1)) return roll(s);
        if (match.phase === 'move' && match.turn === 1 && !movesFor().length) return endTurn(s);
        return false;
    };
    /** a tap on the board: { kind: 'dice' } | { kind: 'src', from } | { kind: 'dst', to } */
    const tap = (t, s) => {
        if (!t || busy() || activityBlocked(s)) return false;
        if (t.kind === 'dice') return mainAction(s);
        if (match.turn !== 1 || match.phase !== 'move') return false;
        if (t.kind === 'dst' && selected !== null) { const route = routes.find((q) => q.to === t.to); if (route) { playRoute(route, s); return true; } }
        if (t.kind === 'src') { select(selected === t.from && t.from !== 'bar' ? null : t.from); return true; }
        return false;
    };
    const talk = (id, s) => {
        const best = match.turn === 1 && match.phase === 'move' ? chooseTurn(match)[0] || null : null;
        speakAll(banter.talk(id, { phase: match.turn === 1 ? match.phase : 'wait', move: best }, clock).map((l) => (id === 'hint' && best ? l : { ...l, look: true })), s); record('talk', { id });
        if (id === 'hint' && best) { hint = best; hintT = 4.5; }
    };

    // ---- markers
    const writeMarks = () => {
        const human = match.turn === 1 && match.phase === 'move' && !busy(), pulse = 0.72 + 0.28 * Math.sin(clock * 5);
        let n = 0; srcRings.material.opacity = 0.55 + 0.4 * pulse;
        if (human) for (const from of sources()) { if (from === selected || n >= 16) continue; const c = from === 'bar' ? match.bar[0] : match.points[from], p = place(1, from, c - 1); srcRings.setMatrixAt(n++, M(p.x, p.y + CH_H / 2 + 0.0015, p.z)); }
        srcRings.count = n; srcRings.instanceMatrix.needsUpdate = true;
        selRing.count = 0; if (human && selected !== null && !drag) { const c = selected === 'bar' ? match.bar[0] : match.points[selected], p = place(1, selected, c - 1); selRing.setMatrixAt(0, M(p.x, p.y + 0.012 + CH_H / 2 + 0.0015, p.z)); selRing.count = 1; selRing.instanceMatrix.needsUpdate = true; }
        n = 0; dstDiscs.material.opacity = 0.5 + 0.4 * pulse;
        if (human && selected !== null) routes.forEach((q, k) => { if (n >= 8) return; const p = landing(q.to), big = k === focus ? 1.25 : 1; dstDiscs.setMatrixAt(n++, M(p.x, p.y - CH_H / 2 + 0.0016 + (q.to === 'off' ? 0 : 0), p.z, 0, 0, 0, big, 1, big)); });
        dstDiscs.count = n; dstDiscs.instanceMatrix.needsUpdate = true;
        n = 0; if (hint && hintT > 0 && human) { const c = hint.from === 'bar' ? match.bar[0] : match.points[hint.from]; if (c > 0) { const a = place(1, hint.from, c - 1), b = landing(hint.to), k = 1.15 + 0.2 * Math.sin(clock * 9); hintRings.setMatrixAt(n++, M(a.x, a.y + CH_H / 2 + 0.003, a.z, 0, 0, 0, k, 1, k)); hintRings.setMatrixAt(n++, M(b.x, b.y - CH_H / 2 + 0.003, b.z, 0, 0, 0, k, 1, k)); } }
        hintRings.count = n; hintRings.instanceMatrix.needsUpdate = true;
    };

    // ---- the seat: the camera sits down at the east seat and frames the board (and Doru beyond it) clear of the panel
    const view = { glance: 0, glanceHold: 0, pos: new THREE.Vector3(), aim: new THREE.Vector3(), goalPos: new THREE.Vector3(), goalAim: new THREE.Vector3(), key: '', sit: 0, from: null, lookYaw: 0, lookPitch: 0, lookHold: 0, zoom: 0, zoomHold: 0, zoomAt: new THREE.Vector3(), fit: null };
    const probe = new THREE.PerspectiveCamera(), v3 = new THREE.Vector3(), headAt = new THREE.Vector3(x - 0.93, y + 0.5, z);
    /** (owner, 2026-11-11: "need to see the dice and table better") Over the board the player leans in: the board is framed
     *  from a high angle, as large as the screen allows clear of the panel, so far and near points read alike. Doru is
     *  out of that picture; the camera looks up at him when he speaks outside the player's own move (placeCamera). */
    const fitView = (s, r) => {
        const cam = s.camera, cr = canvasOf(s).getBoundingClientRect(), W = cr.width, H = cr.height, pr = r.ui.getBoundingClientRect(), card = r.s.ui.el?.querySelector?.('.sp-card')?.getBoundingClientRect();
        if (!(W > 0 && H > 0)) return; // (a hidden page has no size: keep the last framing)
        const key = [W, H, Math.round(pr.top), Math.round(pr.height), cam.fov, cam.aspect].join(); if (key === view.key) return; view.key = key;
        let top = 6, bottom = H - 6; if (pr.height > 0) { if ((pr.top + pr.bottom) / 2 > cr.top + H / 2) bottom = pr.top - cr.top - 6; else top = pr.bottom - cr.top + 6; }
        if (card && card.height > 0 && card.bottom < cr.top + H / 2 && card.right > cr.left + W * 0.45) top = Math.max(top, card.bottom - cr.top + 6);
        const yHi = 1 - 2 * top / H, yLo = 1 - 2 * bottom / H;
        const L = (lx, lz) => root.localToWorld(new THREE.Vector3(lx, 0, lz)), corners = [L(-0.345, -0.285), L(0.345, -0.285), L(-0.345, 0.285), L(0.345, 0.285), L(0.24, 0.36), L(0.1, 0.36), L(0.405, 0.26), L(-0.405, -0.26), L(0.405, -0.1), L(-0.405, 0.1)], wa = L(-0.33, 0), wb = L(0.33, 0);
        probe.fov = cam.fov; probe.aspect = cam.aspect; probe.near = 0.05; probe.far = 60; probe.updateProjectionMatrix(); probe.rotation.order = 'YXZ';
        const fits = (e, d, adj) => {
            probe.position.set(x - 0.02 + Math.cos(e) * d, y + Math.sin(e) * d, z); probe.rotation.set(-e + adj, Math.PI / 2, 0); probe.updateMatrixWorld(true); probe.matrixWorldInverse.copy(probe.matrixWorld).invert();
            for (const c of corners) { v3.copy(c).project(probe); if (v3.z > 1 || Math.abs(v3.x) > 0.97 || v3.y < yLo + 0.02 || v3.y > yHi - 0.02) return null; }
            const ax = v3.copy(wa).project(probe).x, width = Math.abs(v3.copy(wb).project(probe).x - ax); v3.copy(headAt).project(probe);
            return { e, d, adj, width, head: v3.z < 1 && Math.abs(v3.x) < 0.9 && v3.y < yHi - 0.04 && v3.y > yLo };
        };
        let best = null, bestScore = -1; view.cands = [];
        for (const e of [0.56, 0.64, 0.72, 0.82, 0.94, 1.08, 1.24]) {
            let found = null;
            for (let d = 0.5; d < 2.8 && !found; d += 0.03) { if (Math.cos(e) * d > 1.35) break; for (const adj of [0.34, 0.28, 0.22, 0.16, 0.1, 0.05, 0, -0.06, -0.12]) { found = fits(e, d, adj); if (found) break; } }
            if (!found) continue; view.cands.push(found);
        }
        { const widest = Math.max(0, ...view.cands.map((c) => c.width)); for (const c of view.cands) { if (c.width < widest * 0.88) continue; const score = -Math.abs(c.e - 0.94); if (!best || score > bestScore) { bestScore = score; best = c; } } }
        best ||= { e: 1.2, d: 1.5, adj: 0, width: 0, head: false };
        const pitch = -best.e + best.adj;
        view.goalPos.set(x - 0.02 + Math.cos(best.e) * best.d, y + Math.sin(best.e) * best.d, z); view.goalAim.set(view.goalPos.x - Math.cos(pitch) * best.d, view.goalPos.y + Math.sin(pitch) * best.d, z); view.fit = best;
        if (view.sit === 0) { view.pos.copy(view.goalPos); view.aim.copy(view.goalAim); } // (later refits, a resized window or a taller panel, ease over)
    };
    /** (owner, 2026-11-11: "the table zooms in when I roll, and you see it from the top") the throw is watched from right
     *  above: the camera leans in over the dice while they roll and for a moment after, then sits back */
    const watchDice = (a, b) => { view.zoomAt.copy(a).add(b).multiplyScalar(0.5); root.localToWorld(view.zoomAt); view.zoomHold = 1.0; };
    const placeCamera = (s, dt) => {
        const rig = s.ctl.rig; if (!rig) return;
        view.sit = Math.min(1, view.sit + dt / 0.9); const k = view.sit * view.sit * (3 - 2 * view.sit), ease = Math.min(1, dt * 3);
        view.pos.lerp(view.goalPos, ease); view.aim.lerp(view.goalAim, ease);
        if (view.lookHold > 0) view.lookHold -= dt; else { const back = Math.min(1, dt * 2.5); view.lookYaw -= view.lookYaw * back; view.lookPitch -= view.lookPitch * back; }
        if (view.zoomHold > 0 && !diceMoving()) view.zoomHold -= dt;
        view.zoom += ((view.zoomHold > 0 ? 1 : 0) - view.zoom) * Math.min(1, dt * (view.zoomHold > 0 ? 5 : 3.2));
        if (view.glanceHold > 0) view.glanceHold -= dt;
        view.glance += ((view.glanceHold > 0 && !drag && !pointer ? 1 : 0) - view.glance) * Math.min(1, dt * 3.5);
        const P = view.pos.clone(), A = view.aim.clone(), zk = view.zoom * view.zoom * (3 - 2 * view.zoom), gk = view.glance * view.glance * (3 - 2 * view.glance) * (1 - zk);
        if (gk > 0.001) { const tall = s.camera.aspect < 0.8; P.lerp(v3.set(x + (tall ? 1.05 : 0.8), y + (tall ? 0.75 : 0.5), z), gk); A.lerp(new THREE.Vector3(x - 0.93, y + (tall ? 0.1 : 0.26), z), gk); } // (sitting back to look at Doru across the board)
        if (zk > 0.001) { const D = view.zoomAt, up = s.camera.aspect < 0.8 ? 0.62 : 0.46; P.lerp(v3.set(D.x + 0.07, D.y + up, D.z), zk); A.lerp(D, zk); } // (0.07 m toward the seat: Doru's side stays at the top of the picture)
        const dx = A.x - P.x, dy = A.y - P.y, dz = A.z - P.z, yaw = Math.atan2(-dx, -dz) + view.lookYaw, pitch = Math.max(-1.5, Math.min(0.6, Math.atan2(dy, Math.hypot(dx, dz)) + view.lookPitch));
        if (k < 1 && view.from) { let dyaw = yaw - view.from.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); rig.position.lerpVectors(view.from.pos, P, k); rig.rotation.set(view.from.pitch + (pitch - view.from.pitch) * k, view.from.yaw + dyaw * k, 0, 'YXZ'); }
        else { rig.position.copy(P); rig.rotation.set(pitch, yaw, 0, 'YXZ'); }
        // Doru's bubble hangs over his head, or over his hands when his head is above the picture
        rig.updateMatrixWorld(true); s.camera.updateMatrixWorld(true); s.camera.matrixWorldInverse.copy(s.camera.matrixWorld).invert();
        mouths.doru.y = v3.set(x - 0.93, y + 0.6, z).project(s.camera).y > 0.8 ? y + 0.2 : y + 0.6; mouths.doru.x = mouths.doru.y < y + 0.4 ? x - 0.6 : x - 0.93;
    };

    // ---- pointing at the board: the nearest thing that can be acted on, in screen pixels
    const canvasOf = (s) => s.r3d?.renderer?.domElement || document.querySelector('canvas');
    const targets = (s) => {
        const out = [], cam = s.camera, rect = canvasOf(s).getBoundingClientRect();
        s.ctl.rig?.updateMatrixWorld(true); cam.updateMatrixWorld(true); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
        const add = (local, t) => { v3.copy(local); root.localToWorld(v3).project(cam); if (v3.z < 1) out.push({ ...t, sx: rect.left + (v3.x + 1) / 2 * rect.width, sy: rect.top + (1 - v3.y) / 2 * rect.height }); };
        if (busy() || match.turn !== 1 && match.phase !== 'opening' && match.phase !== 'finished') return out;
        if (match.phase !== 'move' || !movesFor().length) { dice.forEach((d) => add(d.pos, { kind: 'dice' })); if (match.phase !== 'move') return out; }
        if (selected !== null) for (const q of routes) add(landing(q.to), { kind: 'dst', to: q.to });
        for (const from of sources()) { const c = from === 'bar' ? match.bar[0] : match.points[from]; for (let j = Math.max(0, c - 5); j < c; j++) add(place(1, from, j), { kind: 'src', from }); }
        return out;
    };
    const reach = (s) => { const a = root.localToWorld(v3.set(0, 0, 0)).clone().project(s.camera), b = root.localToWorld(v3.set(CH_R, 0, 0)).clone().project(s.camera), rect = canvasOf(s).getBoundingClientRect(); return Math.max(22, Math.min(64, Math.hypot((a.x - b.x) * rect.width / 2, (a.y - b.y) * rect.height / 2) * 1.9)); };
    const pick = (s, cx, cy, only = null) => {
        const list = targets(s); let best = null, bd = reach(s);
        for (const t of list) { if (only && t.kind !== only) continue; const d = Math.hypot(t.sx - cx, t.sy - cy) - (t.kind === 'dst' ? 6 : 0); if (d < bd) { bd = d; best = t; } }
        return best;
    };
    /** the point on the plane just above the board under a screen position (for a checker being dragged) */
    const boardPoint = (s, cx, cy) => {
        const cam = s.camera, rect = canvasOf(s).getBoundingClientRect(), o = new THREE.Vector3(), dir = new THREE.Vector3((cx - rect.left) / rect.width * 2 - 1, 1 - (cy - rect.top) / rect.height * 2, 0.5);
        cam.getWorldPosition(o); dir.unproject(cam).sub(o).normalize(); const py = root.position.y + 0.035; if (Math.abs(dir.y) < 1e-4) return null;
        const t = (py - o.y) / dir.y; if (!(t > 0)) return null; const p = root.worldToLocal(o.addScaledVector(dir, t)); p.x = Math.max(-0.42, Math.min(0.42, p.x)); p.z = Math.max(-0.3, Math.min(0.36, p.z)); return p;
    };
    let pointer = null, listening = null;
    const listen = (s, r) => {
        const canvas = canvasOf(s), mine = (e) => e.target === canvas && current() === r && !activityBlocked(s);
        const mousedown = (e) => { if (mine(e) && e.button === 0) e.stopPropagation(); }; // (a click on the board must not capture the mouse for looking around)
        const down = (e) => {
            if (!mine(e) || (e.pointerType === 'mouse' && e.button !== 0) || pointer) return;
            const t = pick(s, e.clientX, e.clientY);
            pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t, moved: false };
        };
        const move = (e) => {
            if (!pointer) { if (e.pointerType === 'mouse' && mine(e)) canvas.style.cursor = pick(s, e.clientX, e.clientY) ? 'pointer' : ''; return; }
            if (e.pointerId !== pointer.id) return;
            if (!pointer.moved && Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 7) {
                pointer.moved = true;
                if (pointer.t?.kind === 'src' && !busy()) { select(pointer.t.from); const index = topIndex(pointer.t.from); if (selected !== null && index >= 0) drag = { index, at: null }; }
            }
            if (drag) drag.at = boardPoint(s, e.clientX, e.clientY) || drag.at;
            else if (pointer.moved) { view.lookYaw = Math.max(-1.1, Math.min(1.1, view.lookYaw - (e.clientX - pointer.lx) * 0.003)); view.lookPitch = Math.max(-0.5, Math.min(0.75, view.lookPitch - (e.clientY - pointer.ly) * 0.003)); view.lookHold = 1.4; }
            pointer.lx = e.clientX; pointer.ly = e.clientY;
        };
        const up = (e) => {
            if (!pointer || e.pointerId !== pointer.id) return; const p = pointer; pointer = null;
            if (drag) { drag = null; const t = pick(s, e.clientX, e.clientY, 'dst'); if (t) tap(t, s); writeCheckers(); refresh(); return; }
            if (!p.moved && e.type === 'pointerup' && current() === r && !activityBlocked(s)) { tap(p.t, s); refresh(); }
        };
        const resize = () => { view.key = ''; };
        const old = canvas.style.touchAction; canvas.style.touchAction = 'none';
        window.addEventListener('mousedown', mousedown, true); window.addEventListener('pointerdown', down, true); window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true); window.addEventListener('resize', resize);
        listening = () => { window.removeEventListener('mousedown', mousedown, true); window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); window.removeEventListener('resize', resize); canvas.style.touchAction = old; canvas.style.cursor = ''; pointer = null; drag = null; listening = null; };
    };
    (ctx.extras.sceneCleanups ||= []).push(() => listening?.());

    // ---- the panel: who is to do what, the standing, what was last said
    const touch = () => document.body.classList.contains('touch');
    function refresh() {
        const r = current(); if (!r) return;
        const human = match.turn === 1, moves = movesFor(), wait = busy(), E = touch() ? '' : ' (E)';
        r.summary.replaceChildren(); for (const [name, p, k] of [['You', 1, 'you'], ['Doru', -1, 'doru']]) { const b = document.createElement('b'); b.textContent = name; r.summary.append(b, ` (${p === 1 ? 'cream' : 'brown'}) ${score[k]} ${score[k] === 1 ? 'line' : 'lines'} · ${pipCount(match, p)} points to go${p === 1 ? '  —  ' : ''}`); }
        r.diceBox.replaceChildren();
        { const face = (value, o = {}) => { const d = document.createElement('span'); d.className = 'bg-die' + (o.small ? ' small' : ''); if (o.used) d.dataset.used = ''; if (o.his) d.dataset.his = ''; const on = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[value]; for (let i = 0; i < 9; i++) d.append(document.createElement(on.includes(i) ? 'i' : 'span')); return d; };
            if (match.dice.length && !diceMoving()) { const dbl = match.dice[0] === match.dice[1], all = dbl ? Array(4).fill(match.dice[0]) : [...match.dice], left = [...match.remaining]; for (const v of all) { const i = left.indexOf(v); if (i >= 0) left.splice(i, 1); r.diceBox.append(face(v, { small: dbl, used: i < 0, his: match.turn === -1 })); } }
            else if (match.openingDice.length && !diceMoving()) { r.diceBox.append(face(match.openingDice[0]), face(match.openingDice[1], { his: true })); } }
        let label = 'Doru is playing…', status = '', can = false;
        const called = match.dice.length ? callRoll(...match.dice).en : '';
        if (match.phase === 'finished') { const g = gameResult(match), over = score.you >= 3 || score.doru >= 3; label = over ? 'New match' : 'Next game'; can = !wait; status = `${g.winner === 1 ? 'You won' : 'Doru won'} this game: a ${g.name} (${g.points} ${g.points === 1 ? 'line' : 'lines'}). ${over ? `The match to three lines is ${score.you >= 3 ? 'yours' : "Doru's"}.` : 'First to three lines takes the match.'}`; }
        else if (match.phase === 'opening') { label = `Throw a die${E}`; can = !wait; status = match.openingDice.length ? 'A tie. Throw one die each again.' : 'One die each: the higher one starts.'; }
        else if (!human) status = match.phase === 'roll' ? (match.openingDice.length && !wait ? 'Doru threw higher: he starts.' : 'Doru takes the dice.') : `Doru plays ${called}.`;
        else if (match.phase === 'roll') { label = `Roll the dice${E}`; can = !wait; status = match.openingDice.length ? 'You threw higher: roll both dice to start.' : `Your turn: roll the dice${touch() ? ' (tap them)' : ' (click them or press E)'}.`; }
        else if (!moves.length && !played) { label = 'No move'; status = `${cap(called)}: no checker can move. The dice pass to Doru.`; }
        else if (!moves.length) { label = `Hand over the dice${E}`; can = !wait; status = `${cap(called)} played. Hand the dice to Doru, or take a move back.`; }
        else { label = 'Your move'; status = match.bar[0] ? `${cap(called)}: bring your checker in from the bar, onto a green spot.` : selected !== null ? `${cap(called)}: put the checker on a green spot.` : `${cap(called)}: pick a checker with a gold ring${touch() ? '' : ', or drag it'}.`; }
        r.button.textContent = label; r.busy = !can; r.button.disabled = !can; r.status.textContent = status;
        r.undo.disabled = !(human && match.phase === 'move' && undo.length && !wait);
        showLine(r);
    }
    /** keyboard: ←/→ pick the next checker that can move, ↑/↓ its landing spot, Enter puts it there; Z takes a move
     *  back, T opens the talk row, Space is the big button */
    const byBoard = (a, b) => { const pa = a === 'bar' ? { x: 0, z: 0 } : place(1, a, 0), pb = b === 'bar' ? { x: 0, z: 0 } : place(1, b, 0); return pa.x - pb.x || pa.z - pb.z; };
    const key = (e, r) => {
        if (e.target instanceof Node && r.ui.contains(e.target) && ['Enter', 'Space'].includes(e.code)) return false;
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Space', 'KeyZ', 'Backspace', 'KeyT', 'Escape'].includes(e.code)) return false;
        if (e.type !== 'keydown' || e.repeat) return true;
        const s = r.s, src = busy() ? [] : sources().sort(byBoard);
        if (e.code === 'Escape') { if (selected !== null && selected !== 'bar') select(null); else { leave(); return true; } }
        else if (e.code === 'KeyZ' || e.code === 'Backspace') undoMove(s);
        else if (e.code === 'KeyT') r.talk.classList.toggle('open');
        else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { if (src.length) { const i = src.indexOf(selected), step = e.code === 'ArrowRight' ? 1 : -1; select(src[i < 0 ? (step > 0 ? 0 : src.length - 1) : (i + step + src.length) % src.length]); focus = routes.length ? 0 : -1; } }
        else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { if (routes.length) focus = (Math.max(0, focus) + (e.code === 'ArrowDown' ? 1 : routes.length - 1)) % routes.length; }
        else if (e.code === 'Enter' && selected !== null && routes.length && !busy()) tap({ kind: 'dst', to: routes[Math.max(0, focus)].to }, s);
        else mainAction(s);
        refresh(); return true;
    };
    const leave = () => { if (finishedThisSitting) flow.complete(); else flow.cancel('leave'); }; // (a finished game counts as the activity done, whenever the player gets up)
    const stand = (s) => {
        listening?.();
        if (match.phase === 'move' && match.turn === 1 && played) { match = turnStart; played = 0; undo = []; hitSaid = false; setCheckers(match, false); } // (an unfinished turn goes back to the roll)
        pendingMoves = []; resetSelection(); drag = null; view.sit = 0; view.from = null; view.key = ''; view.lookYaw = view.lookPitch = 0; view.zoom = view.zoomHold = 0; view.glance = view.glanceHold = 0; s.ctl.place?.(); writeMarks();
    };

    ctx.interactables.push({ kind: 'backgammon', source, x: x + 0.95, z, r: 1.8, label: 'Sit down for a game of table with Doru', use: (s) => flow.begin(s, {
        title: 'Table at La Șahiști', action: 'Throw a die', cameraRide: true, help: '',
        started(s, r) {
            r.backgammon = true; r.ui.classList.add('bg-game');
            if (!document.getElementById('backgammon-game-css')) { const st = document.createElement('style'); st.id = 'backgammon-game-css'; st.textContent = CSS; document.head.append(st); }
            const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }, nav = r.ui.querySelector('nav');
            r.diceBox = el('div', 'bg-dice'); r.diceBox.setAttribute('aria-hidden', 'true'); r.summary = el('p', 'bg-summary'); r.log = el('p', 'bg-log'); r.log.setAttribute('aria-live', 'polite');
            const text = el('div', 'bg-text'), more = el('div', 'bg-more'); text.append(r.status, r.log, r.summary); r.ui.insertBefore(r.diceBox, nav); r.ui.insertBefore(text, nav); r.ui.append(more);
            r.leave = r.ui.querySelector('[data-leave]'); r.leave.textContent = 'Stand up'; r.leave.onclick = () => leave();
            const quiet = (label, fn) => { const b = el('button', 'bg-quiet', label); b.type = 'button'; b.onclick = () => { b.blur(); if (current() === r && !activityBlocked(s)) fn(); refresh(); view.key = ''; }; nav.insertBefore(b, r.leave); return b; };
            r.undo = quiet('Take back', () => undoMove(s)); r.undo.dataset.undo = '';
            r.talk = el('div', 'bg-talk'); r.rules = el('div', 'bg-rules');
            quiet('Talk', () => { r.rules.classList.remove('open'); r.talk.classList.toggle('open'); }).dataset.talk = '';
            const help = quiet('Rules', () => { r.talk.classList.remove('open'); r.rules.classList.toggle('open'); }); help.dataset.rules = ''; help.setAttribute('aria-label', 'How table is played');
            for (const o of TALK) { const b = el('button'); b.type = 'button'; b.dataset.say = o.id; b.append(el('span', '', o.label), el('small', '', `„${o.ro}”`)); b.onclick = () => { b.blur(); if (current() !== r || activityBlocked(s)) return; r.talk.classList.remove('open'); view.key = ''; talk(o.id, s); refresh(); }; r.talk.append(b); }
            r.rules.append(el('p', '', 'Your cream checkers travel along the far side from right to left, then back along your side to your home, the six points at your near right. A checker lands on any point that does not hold two or more brown ones; a single brown checker there is hit and goes to the bar.'), el('p', '', 'Play both dice if you can (a double is played four times). A checker on the bar must come in first. With all fifteen at home, bear them off. A plain win is a linie (1 line); a marț (2) if the loser has borne off nothing. First to three lines.'));
            more.append(r.talk, r.rules);
            const p = s.ctl.rig; view.from = p ? { pos: p.position.clone(), pitch: p.rotation.x, yaw: p.rotation.y } : null; view.sit = 0; view.key = ''; view.lookYaw = view.lookPitch = 0;
            if (match.phase === 'finished') newGame();
            view.goalPos.set(x + 0.38, y + 0.55, z); view.goalAim.set(x - 0.06, y, z); view.pos.copy(view.goalPos); view.aim.copy(view.goalAim); // (until the first fit)
            listen(s, r); fitView(s, r); record('begin'); idleT = 0;
            speak(banter.say(greeted ? 'resume' : 'greet', {}, clock, true), s); if (!greeted) speak(banter.say('rules', {}, clock, true), s); greeted = true;
            if (match.turn === 1 && match.phase === 'move' && movesFor().some((m) => m.from === 'bar')) select('bar');
            refresh();
        },
        actioned(s, r) { if (current() === r) { mainAction(s); refresh(); } },
        key,
        update(dt, s, r) {
            clock += dt; s.input?.takeLook?.(); fitView(s, r); placeCamera(s, dt); stepSpeech(dt, s);
            const crowd = s.spot?.crowd; if (crowd) { crowd.chatT = Math.max(crowd.chatT ?? 0, 2); crowd.idleT = 0; } // (only Doru and the onlooker talk over the game)
            if (hintT > 0) hintT -= dt;
            const was = busy();
            if (!busy() && afterOpening) { handDice(afterOpening); afterOpening = 0; }
            if (!busy() && match.phase !== 'finished') {
                if (match.turn === -1 && match.phase !== 'opening') {
                    aiWait -= dt;
                    if (aiWait <= 0) {
                        if (match.phase === 'roll') roll(s);
                        else { plan ||= chooseTurn(match); if (plan.length) { applyOne(plan.shift(), s); aiWait = 0.55 + Math.random() * 0.35; } else endTurn(s); }
                    }
                } else if (match.turn === 1 && match.phase === 'move' && passT > 0) { passT -= dt; if (passT <= 0) endTurn(s, false); }
                else if (match.turn === 1 || match.phase === 'opening') { idleT += dt; if (idleT > nextIdle) { nextIdle = idleT + 32; speak(banter.say(match.phase === 'move' ? 'idleMove' : 'idleRoll', {}, clock), s); } }
            }
            writeMarks(); if (was !== busy()) refresh();
        },
        cancel(s, reason) { if (reason === 'leave' && match.phase !== 'opening') speak(banter.say('leave', {}, clock, true), s); record('cancel', { reason }); stand(s); },
        complete(s) { if (!['finished', 'opening'].includes(match.phase)) speak(banter.say('leave', {}, clock, true), s); record('stand-up', { score: { ...score } }); finishedThisSitting = false; stand(s); },
    }) });

    // checkers and dice keep moving whether or not the panel exists (a move in flight when the player stands up)
    ctx.onUpdate((dt, s) => {
        const seated = !!current();
        if (!seated) { clock += dt; stepSpeech(dt, s); }
        const diceWere = diceMoving(); stepDice(dt);
        if (reachT > 0) reachT -= dt; seatDoru(reachT > 0 ? 'play' : 'sit');
        if (animT < 1) {
            animT = Math.min(1, animT + dt / 0.34); writeCheckers();
            if (animT === 1) { clack(s, animHit); animHit = false; if (pendingMoves.length && seated && match.phase === 'move') applyOne(pendingMoves.shift(), s); else pendingMoves = []; if (seated && match.turn === 1 && match.phase === 'move' && movesFor().some((m) => m.from === 'bar')) select('bar'); refresh(); }
        } else if (drag || selected !== null || checkersDirty) { writeCheckers(); checkersDirty = selected !== null || !!drag; }
        if (diceWere && !diceMoving()) { knock(s, { f: 1900, q: 3, gain: 0.5, dur: 0.04 }); refresh(); }
    });
    let checkersDirty = false;

    ctx.extras.backgammon = {
        source, table: { x, y, z, boardRotationY: Math.PI / 2 }, opponent: { name: 'Doru', fictional: true, x: x - 0.95, y: y - 0.8, z, yaw: -Math.PI / 2 }, onlooker: { fictional: true, ...kib },
        state: () => match, score: () => ({ ...score, games }), result: () => Object.freeze({ finished: match.phase === 'finished', awarded }), legalMoves: () => movesFor().map((m) => ({ ...m })), events: () => events.map((e) => ({ ...e })),
        checkers, diceMesh, pips,
        debug: {
            dice: diceQueue, busy, selected: () => selected, routes: () => routes.map((q) => ({ to: q.to, dice: q.moves.map((m) => m.die), hit: q.hit })), view: () => ({ pos: view.pos.toArray(), aim: view.aim.toArray(), fit: view.fit, cands: view.cands, sit: view.sit, zoom: view.zoom }),
            targets: (s) => targets(s), tap: (t, s) => { const ok = tap(t, s); refresh(); return ok; }, main: (s) => { const ok = mainAction(s); refresh(); return ok; }, undo: (s) => { const ok = undoMove(s); refresh(); return ok; }, talk: (id, s) => { talk(id, s); refresh(); },
            said: () => events.filter((e) => e.action === 'say').map((e) => ({ who: e.who, key: e.key, ro: e.ro })),
            set: (state) => { match = state; turnStart = state; undo = []; pendingMoves = []; played = 0; plan = null; scored = false; resetSelection(); setCheckers(match, false); refresh(); },
        },
    };
    return root;
}
