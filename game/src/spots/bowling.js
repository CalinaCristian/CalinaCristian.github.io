// ============================================================================
//  Ten-pin bowling (engine only: no three.js, unit-tested; the Lincoln Square scene draws the lane). A short game of
//  three frames: line up on the foul line (A / D), aim with the mouse, release on the swinging power meter (E).
//
//  Lane frame (metres, USBC dimensions): x across the lane (the lane is 1.054 m wide, gutters to ±0.762), z along it from
//  the foul line (0) to the head pin (18.288); pins stand 0.3048 apart in a triangle; the pit starts at 19.5. Ball and
//  pins are discs sliding on the deck (2-D impulses): a pin struck hard enough falls and slides on, taking others with it
//  ("pin action"); the side kickbacks bounce pins back in; a ball over the lane edge drops into the gutter.
// ============================================================================
export const LANE = { width: 1.054, gutter: 0.762, head: 18.288, row: 0.2639, gap: 0.3048, pit: 19.5, deck: 17.9 };
export const BALL = { r: 0.1085, m: 6.8 }, PIN = { r: 0.0606, m: 1.53 };
export const BOWL = { frames: 3, minSpeed: 6.0, maxSpeed: 9.6, maxAngle: 0.06, maxX: 0.42, period: 1.6, step: 1 / 240 };

export const pinSpots = () => { const out = []; for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) out.push({ x: (k - r / 2) * LANE.gap, z: LANE.head + r * LANE.row }); return out; };
/** the swinging power meter, 0..1..0 */
export const powerAt = (t) => { const u = ((t / BOWL.period) % 1 + 1) % 1; return u < 0.5 ? u * 2 : 2 - u * 2; };
export const speedOf = (power) => BOWL.minSpeed + (BOWL.maxSpeed - BOWL.minSpeed) * Math.max(0, Math.min(1, power));

/** frame scores for a list of pinfall counts (`frames` frames, the last with its bonus balls). → { frames: [{ rolls, total|null }], total } */
export function scoreGame(rolls, frames = BOWL.frames) {
    const out = []; let i = 0, run = 0;
    for (let f = 0; f < frames; f++) {
        const last = f === frames - 1, r0 = rolls[i], r1 = rolls[i + 1], r2 = rolls[i + 2];
        if (r0 === undefined) { out.push({ rolls: [], total: null }); continue; }
        if (last) { const rs = rolls.slice(i, i + 3), need = r0 === 10 || r0 + (r1 ?? 0) === 10 ? 3 : 2, have = rs.slice(0, need); const done = have.length === need; run += done ? have.reduce((a, b) => a + b, 0) : 0; out.push({ rolls: have, total: done ? run : null }); i += have.length; continue; }
        if (r0 === 10) { const ok = r1 !== undefined && r2 !== undefined; if (ok) run += 10 + r1 + r2; out.push({ rolls: [10], total: ok ? run : null }); i += 1; continue; }
        if (r1 === undefined) { out.push({ rolls: [r0], total: null }); i += 1; continue; }
        const spare = r0 + r1 === 10, ok = !spare || r2 !== undefined; if (ok) run += r0 + r1 + (spare ? r2 : 0); out.push({ rolls: [r0, r1], total: ok ? run : null }); i += 2;
    }
    return { frames: out, total: run };
}
/** which frame / ball the next roll is, and whether the game is over: { frame, ball, over, fresh (a full rack) } */
export function nextRoll(rolls, frames = BOWL.frames) {
    let i = 0;
    for (let f = 0; f < frames; f++) {
        const last = f === frames - 1, r0 = rolls[i], r1 = rolls[i + 1], r2 = rolls[i + 2];
        if (r0 === undefined) return { frame: f, ball: 0, over: false, fresh: true };
        if (!last) { if (r0 === 10) { i += 1; continue; } if (r1 === undefined) return { frame: f, ball: 1, over: false, fresh: false }; i += 2; continue; }
        if (r1 === undefined) return { frame: f, ball: 1, over: false, fresh: r0 === 10 };
        if (r0 === 10 || r0 + r1 === 10) { if (r2 === undefined) return { frame: f, ball: 2, over: false, fresh: r0 === 10 ? r1 === 10 : true }; }
        return { frame: f, ball: 3, over: true, fresh: false };
    }
    return { frame: frames, ball: 0, over: true, fresh: false };
}

/**
 * one delivery. standing: indices (0–9) of the pins still up. Returns a simulator: step() until done; then .down (indices
 * knocked down this ball), .gutter
 */
export function createRoll({ x, angle, speed, standing = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }) {
    const spots = pinSpots();
    const pins = standing.map((i) => ({ i, x: spots[i].x, z: spots[i].z, vx: 0, vz: 0, down: false, gone: false }));
    const ball = { x: Math.max(-BOWL.maxX, Math.min(BOWL.maxX, x)), z: 0, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, gutter: false, gone: false };
    let t = 0, done = false;
    const hit = (a, ma, ra, b, mb, rb, e) => { // two discs: separate and exchange an impulse along the normal
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d >= ra + rb || d < 1e-9) return 0;
        const nx = dx / d, nz = dz / d, push = (ra + rb - d), wa = mb / (ma + mb), wb = ma / (ma + mb);
        a.x -= nx * push * wa; a.z -= nz * push * wa; b.x += nx * push * wb; b.z += nz * push * wb;
        const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (vn >= 0) return 0;
        const j = -(1 + e) * vn / (1 / ma + 1 / mb); a.vx -= j * nx / ma; a.vz -= j * nz / ma; b.vx += j * nx / mb; b.vz += j * nz / mb; return j;
    };
    const step = () => {
        const h = BOWL.step; t += h;
        // the ball: rolls straight; off the lane edge it drops into the gutter and runs down to the pit
        if (!ball.gone) { ball.x += ball.vx * h; ball.z += ball.vz * h; if (!ball.gutter && Math.abs(ball.x) > LANE.width / 2 + 0.02 && ball.z < LANE.deck) { ball.gutter = true; ball.x = Math.sign(ball.x) * (LANE.width / 2 + 0.11); ball.vx = 0; } if (ball.z > LANE.pit + 0.4) ball.gone = true; }
        for (const p of pins) { if (p.gone) continue;
            if (!ball.gone && !ball.gutter) { const j = hit(ball, BALL.m, BALL.r, p, PIN.m, PIN.r, 0.55); if (j > 0.6) p.down = true; }
            p.x += p.vx * h; p.z += p.vz * h; const sp = Math.hypot(p.vx, p.vz); if (sp > 0) { const k = Math.max(0, sp - (p.down ? 2.2 : 6) * h) / sp; p.vx *= k; p.vz *= k; }
            if (Math.hypot(p.vx, p.vz) > 0.35) p.down = true;
            if (Math.abs(p.x) > LANE.gutter - PIN.r) { p.x = Math.sign(p.x) * (LANE.gutter - PIN.r); if (p.vx * Math.sign(p.x) > 0) p.vx *= -0.5; p.down = true; } // the kickbacks
            if (p.z > LANE.pit) { p.gone = true; p.down = true; } }
        for (let a = 0; a < pins.length; a++) for (let b = a + 1; b < pins.length; b++) { const A = pins[a], B = pins[b]; if (A.gone || B.gone) continue; const j = hit(A, PIN.m, PIN.r * (A.down ? 1.9 : 1), B, PIN.m, PIN.r * (B.down ? 1.9 : 1), 0.45); if (j > 0.25) { A.down = true; B.down = true; } } // (a falling pin sweeps a wider path)
        const still = pins.every((p) => p.gone || Math.hypot(p.vx, p.vz) < 0.03);
        if ((ball.gone && still) || t > 6) done = true;
        return done;
    };
    return {
        step, get done() { return done; }, get t() { return t; }, ball, pins,
        run() { while (!done) step(); return this; },
        get down() { return pins.filter((p) => p.down).map((p) => p.i); },
        get standing() { return pins.filter((p) => !p.down).map((p) => p.i); },
        get gutter() { return ball.gutter; },
    };
}
