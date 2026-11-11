// (owner L28: "video unavailable; should play in the background without action") the hidden bar's sports TV plays an
// original, procedurally drawn match broadcast on its own while the room is visible: a stylised pitch from the main camera,
// two teams (Romania's tricolour kit against a light-blue side), a ball that is passed, crossed and scored, a score bug and a
// replay card after each goal. No footage, logo or broadcast graphics are copied; the official highlights stay one key away.
const KIT = { home: ['#fcd116', '#002b7f'], away: ['#74acdf', '#ffffff'] };

export function createBarBroadcast(canvasEl, { fps = 12 } = {}) {
    const x = canvasEl.getContext('2d'), W = canvasEl.width, H = canvasEl.height;
    let t = 0, acc = 0, score = [0, 0], replayT = 0, phase = 0, minute = 1;
    // eleven a side on a 105 x 68 pitch, in formation slots that sway with play
    const slots = side => [[-48, 0], [-34, -22], [-36, -7], [-36, 7], [-34, 22], [-14, -18], [-18, 0], [-14, 18], [4, -24], [8, 0], [4, 24]].map(([u, v]) => ({ u: u * side, v, side }));
    const players = [...slots(1), ...slots(-1)];
    const ball = { u: 0, v: 0, tu: 0, tv: 0, owner: 9 };
    const view = { u: 0 };
    const pass = () => {
        const attackers = players.filter(p => p.side === players[ball.owner].side), forward = players[ball.owner].side;
        // short passes building up, then a run at goal: a shot after about 15 s of build-up, three in ten scored
        if (phase > 15) { phase = 0; ball.tu = 52.5 * forward; ball.tv = (Math.random() - .5) * 6; ball.shot = true; return; }
        const options = attackers.filter(p => (p.u - ball.u) * forward > -6 && p !== players[ball.owner]);
        const next = options[Math.floor(Math.random() * options.length)] || attackers[0];
        ball.owner = players.indexOf(next); ball.tu = next.u; ball.tv = next.v; ball.shot = false;
    };
    const step = dt => {
        t += dt; phase += dt; minute = Math.min(90, 1 + Math.floor(t / 6) % 90);
        if (replayT > 0) { replayT -= dt; return; }
        const k = Math.min(1, dt * (ball.shot ? 2.6 : 1.6));
        ball.u += (ball.tu - ball.u) * k; ball.v += (ball.tv - ball.v) * k;
        if (Math.hypot(ball.tu - ball.u, ball.tv - ball.v) < .8) {
            if (ball.shot) { const side = ball.tu > 0 ? 0 : 1; if (Math.random() < .3) { score[side]++; replayT = 3.2; } ball.u = ball.v = 0; ball.owner = side === 0 ? 20 : 9; ball.tu = ball.tv = 0; ball.shot = false; }
            else if (Math.random() < .04 + .02 * dt) { ball.owner = (ball.owner + 11) % 22; } // a tackle: possession changes
            pass();
        }
        for (const [i, p] of players.entries()) { const base = slots(p.side)[i % 11], drift = (ball.u - 0) * .45; p.u += ((base.u + drift + Math.sin(t * .7 + i) * 2) - p.u) * Math.min(1, dt * .8); p.v += ((base.v + (ball.v - base.v) * .18 + Math.cos(t * .5 + i) * 1.5) - p.v) * Math.min(1, dt * .8); }
        const own = players[ball.owner]; own.u += (ball.u - own.u) * Math.min(1, dt * 3); own.v += (ball.v - own.v) * Math.min(1, dt * 3);
        view.u += (Math.max(-30, Math.min(30, ball.u)) - view.u) * Math.min(1, dt * 1.2);
    };
    // broadcast camera: high in the stand, looking across the pitch (simple perspective)
    const project = (u, v) => { const depth = (v + 40) / 80, sx = W / 2 + (u - view.u) * (W / 70) * (0.62 + depth * .55), sy = H * .24 + depth * H * .66; return [sx, sy, 0.62 + depth * .55]; };
    const draw = () => {
        if (replayT > 0) {
            x.fillStyle = '#0a1118'; x.fillRect(0, 0, W, H);
            for (const [i, col] of ['#002b7f', '#fcd116', '#ce1126'].entries()) { x.fillStyle = col; x.fillRect(i * W / 3, H * .44, W / 3, H * .12); }
            x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `800 ${H * .17}px Helvetica, Arial`; x.fillText('GOAL', W / 2, H * .36);
            x.font = `700 ${H * .08}px Helvetica, Arial`; x.fillText(`ROU ${score[0]} – ${score[1]} OPP · replay`, W / 2, H * .72); return;
        }
        x.fillStyle = '#2a5a30'; x.fillRect(0, 0, W, H); x.fillStyle = '#3b4249'; x.fillRect(0, H * .24, W, H * .07); // track and advertising-free hoardings behind the pitch
        const sky = x.createLinearGradient(0, 0, 0, H * .26); sky.addColorStop(0, '#1b2430'); sky.addColorStop(1, '#3a4652'); x.fillStyle = sky; x.fillRect(0, 0, W, H * .26);
        for (let i = 0; i < 60; i++) { x.fillStyle = ['#c8b04a', '#2a3b8f', '#b8303a', '#d8d8d8'][i % 4]; x.fillRect((i * 37 + t * 3) % W, H * .12 + (i % 5) * 6, 9, 5); } // the crowd in the far stand
        for (let s = 0; s < 12; s++) { const [a, ya] = project(-52.5 + s * 8.75, -34), [b2, yb] = project(-52.5 + (s + 1) * 8.75, -34), [c2, yc] = project(-52.5 + (s + 1) * 8.75, 34), [d2, yd] = project(-52.5 + s * 8.75, 34); x.fillStyle = s % 2 ? '#2f7d36' : '#358a3c'; x.beginPath(); x.moveTo(a, ya); x.lineTo(b2, yb); x.lineTo(c2, yc); x.lineTo(d2, yd); x.closePath(); x.fill(); }
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2; const line = (pts) => { x.beginPath(); pts.forEach(([u, v], i) => { const [px, py] = project(u, v); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); };
        line([[-52.5, -34], [52.5, -34], [52.5, 34], [-52.5, 34], [-52.5, -34]]); line([[0, -34], [0, 34]]);
        for (const sd of [-1, 1]) line([[52.5 * sd, -20], [36 * sd, -20], [36 * sd, 20], [52.5 * sd, 20]]);
        { const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; pts.push([Math.cos(a) * 9, Math.sin(a) * 9]); } line(pts); }
        const order = players.map((p, i) => ({ p, i })).sort((a, b) => a.p.v - b.p.v);
        for (const { p } of order) { const [px, py, sc] = project(p.u, p.v), [shirt, shorts] = KIT[p.side > 0 ? 'home' : 'away'], hgt = 15 * sc;
            x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(px - 4 * sc, py - 1, 8 * sc, 2);
            x.fillStyle = shorts; x.fillRect(px - 3 * sc, py - hgt * .45, 6 * sc, hgt * .2); x.fillStyle = shirt; x.fillRect(px - 3.5 * sc, py - hgt * .85, 7 * sc, hgt * .42); x.fillStyle = '#e0b48c'; x.fillRect(px - 2 * sc, py - hgt, 4 * sc, hgt * .16); }
        { const [bx, by, sc] = project(ball.u, ball.v); x.fillStyle = '#fff'; x.beginPath(); x.arc(bx, by - 2 * sc, 3 * sc, 0, 7); x.fill(); }
        // score bug (top left) and match clock
        x.fillStyle = 'rgba(8,12,18,.85)'; x.fillRect(16, 14, 236, 36); x.fillStyle = '#fcd116'; x.fillRect(16, 14, 6, 36);
        x.fillStyle = '#fff'; x.textAlign = 'left'; x.font = '700 20px Helvetica, Arial'; x.fillText(`ROU ${score[0]} – ${score[1]} OPP`, 30, 39); x.fillStyle = '#c2cbd0'; x.fillText(`${minute}'`, 196, 39);
        x.fillStyle = 'rgba(8,12,18,.7)'; x.fillRect(W - 210, H - 40, 196, 26); x.fillStyle = '#c2cbd0'; x.font = '15px Helvetica, Arial'; x.textAlign = 'right'; x.fillText('E · official highlights', W - 22, H - 22);
    };
    draw();
    return {
        /** advance and redraw at most `fps` times a second; returns true when the canvas changed */
        update(dt) { acc += dt; if (acc < 1 / fps) return false; const d = Math.min(acc, .25); acc = 0; step(d); draw(); return true; },
        get score() { return score.slice(); },
    };
}
