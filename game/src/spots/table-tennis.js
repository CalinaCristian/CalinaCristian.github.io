// ============================================================================
//  Table tennis against a park regular (engine only: no three.js, unit-tested; the scene draws it). A first-to-five
//  game on an outdoor table: you stand behind your end, slide along it (A / D), aim the return with the mouse (where
//  you look along the table) and swing with E as the ball reaches you. Serve changes every two points.
//
//  Table frame: u along the table (you at u < 0, the regular at u > 0; ends at ±1.37 m), v across it (±0.7625 m), y
//  above the playing surface. Real table: 2.74 × 1.525 m, net 15.25 cm (ITTF).
// ============================================================================
// (he stays where he played his last shot and moves only once you strike: move him from corner to corner to win points)
export const TT = { half: 1.37, width: 0.7625, net: 0.1525, hitU: 1.62, reach: 0.42, oppReach: 0.4, window: 0.15, move: 2.6, oppMove: 1.5, toWin: 5, pause: 1.3, vMax: 1.15 };

/**
 * @param {{ rng?:()=>number, toWin?:number }} o
 * state: 'serve' (you hold the ball: E serves) | 'oppServe' (he is about to serve) | 'in' (coming to you) | 'out' (going to him)
 *        | 'point' (a short pause) | 'won' | 'lost' | 'cancelled'
 */
export function createRally({ rng = Math.random, toWin = TT.toWin } = {}) {
    let state = 'oppServe', time = 0, me = 0, opp = 0, pv = 0, ov = 0, flight = null, last = null, rally = 0, hits = 0, best = 0;
    const server = () => (Math.floor((me + opp) / 2) % 2 === 0 ? 'opp' : 'me'); // he serves first
    const clampV = (v, m = TT.width - 0.08) => Math.max(-m, Math.min(m, v));
    // a flight from (u0, v0) to a bounce at (ub, vb) and on to the far hit plane: total time, the plane crossing
    const fly = (dir, u0, v0, ub, vb, speed) => {
        const uEnd = dir * TT.hitU, d1 = Math.hypot(ub - u0, vb - v0), d2 = Math.abs(uEnd - ub), k = (uEnd - ub) / (ub - u0 || 1e-6);
        const vEnd = Math.max(-0.95, Math.min(0.95, vb + (vb - v0) * k)), t1 = d1 / speed, t2 = Math.hypot(uEnd - ub, vEnd - vb) / (speed * 0.85);
        void d2; return { dir, u0, v0, ub, vb, uEnd, vEnd, t1, T: t1 + t2, t: 0 };
    };
    const point = (who, why) => { if (who === 'me') me++; else opp++; best = Math.max(best, rally); rally = 0; last = { who, why }; flight = null; state = 'point'; time = 0; };
    const settle = () => {
        if (me >= toWin) { state = 'won'; return; } if (opp >= toWin) { state = 'lost'; return; }
        state = server() === 'me' ? 'serve' : 'oppServe'; time = 0;
    };
    // his shot towards you: a random placement on your half
    const oppHit = (serve) => { const vb = clampV((rng() - 0.5) * 1.3), ub = -(0.35 + rng() * 0.8), speed = serve ? 6.2 : 6.5 + rng() * 2.6; flight = fly(-1, TT.hitU * (serve ? 0.92 : 1), ov, ub, vb, speed); state = 'in'; time = 0; };
    // your shot towards him: aimed across the table, struck clean (e = 0) … at the edge of the window (e = 1)
    const myHit = (aim, e) => {
        const vb = clampV(aim + (rng() - 0.5) * 0.5 * e, TT.width + 0.25), ub = 0.45 + rng() * 0.75 + (e > 0.75 && rng() < 0.55 ? 0.6 : 0);
        flight = fly(1, -TT.hitU, pv, ub, vb, 7 + rng() * 2); flight.out = Math.abs(vb) > TT.width || ub > TT.half; state = 'out'; time = 0; rally++; hits++;
    };
    return {
        /** your swing (E). aim: where across his half you aim (−1 … 1 of the half-width). Returns 'hit' | 'serve' | 'early' | 'late' | 'reach' | null */
        swing(aim = 0) {
            const a = clampV(aim * TT.width);
            if (state === 'serve') { myHit(a, 0.25); return 'serve'; }
            if (state !== 'in') return null;
            const dt = time - flight.T, vAt = flight.vEnd;
            if (dt < -TT.window) { point('opp', 'early'); return 'early'; }
            if (dt > TT.window) { point('opp', 'late'); return 'late'; }
            if (Math.abs(pv - vAt) > TT.reach) { point('opp', 'reach'); return 'reach'; }
            myHit(a, Math.abs(dt) / TT.window); return 'hit';
        },
        /** dt s; side: −1 (A), 0, +1 (D) moves you along your end. Returns an event name or null */
        tick(dt, side = 0) {
            if (!Number.isFinite(dt) || dt < 0 || dt > 0.101) throw Error('Invalid activity step');
            if (['won', 'lost', 'cancelled'].includes(state)) return null;
            time += dt; pv = Math.max(-TT.vMax, Math.min(TT.vMax, pv + side * TT.move * dt));
            if (state === 'point' && time >= TT.pause) { settle(); return state === 'won' || state === 'lost' ? state : 'next'; }
            if (state === 'oppServe') { ov += Math.max(-1, Math.min(1, (0 - ov) * 4)) * dt; if (time >= 1.1) { oppHit(true); return 'oppServe'; } return null; }
            if (!flight) return null;
            flight.t = time;
            if (state === 'in') {
                if (time > flight.T + TT.window) { point('opp', 'missed'); return 'missed'; }
                return null;
            }
            // 'out': he runs for it; balls going off the table he lets go
            if (!flight.out) { const want = flight.vEnd, d = want - ov; ov += Math.sign(d) * Math.min(Math.abs(d), TT.oppMove * dt); }
            if (time >= flight.T) {
                if (flight.out) { point('opp', 'out'); return 'myOut'; } // (your ball off the table: his point)
                if (Math.abs(ov - flight.vEnd) <= TT.oppReach) { if (rng() < 0.06) { point('me', 'error'); return 'oppError'; } oppHit(false); return 'oppHit'; }
                point('me', 'winner'); return 'winner';
            }
            return null;
        },
        cancel() { if (!['won', 'lost'].includes(state)) state = 'cancelled'; },
        /** the ball (u, v, y above the table) along the current flight, or null */
        ball() {
            if (!flight) return null;
            const f = flight, t = Math.min(f.t, f.T + 0.3);
            if (t <= f.t1) { const q = t / f.t1; return { u: f.u0 + (f.ub - f.u0) * q, v: f.v0 + (f.vb - f.v0) * q, y: (1 - q) * 0.22 + Math.sin(q * Math.PI) * 0.32 }; }
            const q = (t - f.t1) / (f.T - f.t1); return { u: f.ub + (f.uEnd - f.ub) * q, v: f.vb + (f.vEnd - f.vb) * q, y: Math.sin(Math.min(q, 1.2) / 1.2 * Math.PI * 0.62) * 0.36 + Math.max(0, q - 1) * -0.4 };
        },
        snapshot() { return { state, time, me, opp, pv, ov, server: server(), rally, best, hits, last, toWin, flight: flight && { dir: flight.dir, T: flight.T, vEnd: flight.vEnd, t: flight.t, out: !!flight.out }, inWindow: state === 'in' && Math.abs(time - flight.T) <= TT.window }; },
    };
}
