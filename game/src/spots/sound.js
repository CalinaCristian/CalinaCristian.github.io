// ============================================================================
//  Spot ambience (procedural WebAudio, no files): positional "sources" mixed
//  by distance — traffic drone, bridge expansion-joint thumps, crowd murmur,
//  water, wind, birds (crows / gulls / songbirds), market calls (bells). Hooks:
//  spot.sound.add(kind, x, z, radius, gain); spot.sound.play(kind) one-shots.
// ============================================================================
export class SpotSound {
    /** @param {{audio?: {ctx, master}}} o  reuse the game's AudioContext when given */
    constructor(o = {}) {
        this.host = o.audio || null; this.sources = []; this.ctx = null; this.started = false; this.t = 0; this.muted = false;
        this._gesture = () => this.start();
        if (!this.host?.ctx) { addEventListener('pointerdown', this._gesture, { once: true }); addEventListener('keydown', this._gesture, { once: true }); }
        else this.start();
    }
    add(kind, x, z, radius = 60, gain = 1) { const s = { kind, x, z, radius, gain, node: null }; this.sources.push(s); if (this.started) this._make(s); return s; }
    start() {
        if (this.started) return;
        try {
            if (this.host?.ctx) { this.host.init?.(); this.ctx = this.host.ctx; this.out = this.ctx.createGain(); this.out.connect(this.host.master || this.ctx.destination); }
            else { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.connect(this.ctx.destination); }
            this.out.gain.value = this.muted ? 0 : 0.7;
            const n = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
            let b = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.5 + b * 3.5; } // white + brown mix
            this.noise = buf; this.started = true;
            for (const s of this.sources) this._make(s);
            this.ctx.resume?.();
        } catch (e) { console.info('[spots] audio unavailable', e?.message || e); }
    }
    _noise(type, f, q) { const src = this.ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4; const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; src.connect(fl); src.start(0, Math.random() * 1.5); return fl; }
    _make(s) {
        const c = this.ctx, g = c.createGain(); g.gain.value = 0; g.connect(this.out); s.node = g;
        if (s.kind === 'traffic') this._noise('lowpass', 260, 0.7).connect(g);
        else if (s.kind === 'crowd') { const a = this._noise('bandpass', 520, 0.9), b = this._noise('bandpass', 1150, 1.4), m = c.createGain(); m.gain.value = 0.6; a.connect(m); b.connect(m); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.37; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(m.gain); lfo.start(); m.connect(g); }
        else if (s.kind === 'water') { const a = this._noise('highpass', 1400, 0.5), b = this._noise('bandpass', 400, 0.6); a.connect(g); b.connect(g); }
        else if (s.kind === 'waterfall') { const a = this._noise('bandpass', 900, 0.4); a.connect(g); }
        else if (s.kind === 'wind') { const a = this._noise('bandpass', 300, 0.3); a.connect(g); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 120; lfo.connect(lg); lg.connect(a.frequency); lfo.start(); }
        else if (s.kind === 'hum') { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 58; o.connect(g); o.start(); }
        // event kinds ('thump', 'crows', 'gulls', 'birds', 'bell', 'calls') are scheduled in update()
        s.next = 1 + Math.random() * 3;
    }
    /** listener position → per-source gains; schedules one-shot events */
    update(dt, x, z) {
        if (!this.started || !this.ctx) return;
        this.t += dt;
        const now = this.ctx.currentTime;
        for (const s of this.sources) {
            const d = Math.hypot(x - s.x, z - s.z), k = s.radius > 0 ? Math.max(0, 1 - d / s.radius) : 1, v = s.gain * k * k;
            if (s.node && !['thump', 'crows', 'gulls', 'birds', 'bell', 'calls'].includes(s.kind)) s.node.gain.setTargetAtTime(v * ({ traffic: 0.5, crowd: 0.35, water: 0.25, waterfall: 0.45, wind: 0.2, hum: 0.05 }[s.kind] || 0.3), now, 0.4);
            else if (v > 0.02) { s.next -= dt; if (s.next <= 0) { s.next = ({ thump: 1.2 + Math.random() * 3, crows: 6 + Math.random() * 12, gulls: 5 + Math.random() * 10, birds: 2 + Math.random() * 5, bell: 15 + Math.random() * 20, calls: 7 + Math.random() * 9 }[s.kind] || 5); this.play(s.kind, v); } }
        }
    }
    /** one-shot procedural sounds: 'thump' 'crows' 'gulls' 'birds' 'bell' 'calls' 'coin' 'splat' 'whoosh' 'catch' 'chime' */
    play(kind, v = 1) {
        if (!this.started || !this.ctx || this.muted) return;
        const c = this.ctx, t = c.currentTime, g = c.createGain(); g.connect(this.out);
        const env = (a, peak, dec) => { g.gain.setValueAtTime(0, t + a); g.gain.linearRampToValueAtTime(peak * v, t + a + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
        const osc = (type, f0, f1, dur, a = 0) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t + a); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + dur); o.connect(g); o.start(t + a); o.stop(t + a + dur + 0.05); return o; };
        if (kind === 'thump') { env(0, 0.5, 0.35); osc('sine', 70, 38, 0.3); env(0.12, 0.35, 0.3); }
        else if (kind === 'crows') { const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t + i * 0.42); o.frequency.linearRampToValueAtTime(380, t + i * 0.42 + 0.25); const gg = c.createGain(); gg.gain.setValueAtTime(0, t + i * 0.42); gg.gain.linearRampToValueAtTime(0.12 * v, t + i * 0.42 + 0.03); gg.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.42 + 0.3); o.connect(f); f.connect(gg); gg.connect(this.out); o.start(t + i * 0.42); o.stop(t + i * 0.42 + 0.35); } }
        else if (kind === 'gulls') { for (let i = 0; i < 3; i++) { env(i * 0.28, 0.07, 0.25); osc('triangle', 1700 - i * 80, 1100, 0.24, i * 0.28); } }
        else if (kind === 'birds') { const n = 3 + Math.floor(Math.random() * 4), b = 2600 + Math.random() * 1500; for (let i = 0; i < n; i++) { env(i * 0.11, 0.035, 0.08); osc('sine', b, b * 1.35, 0.07, i * 0.11); } }
        else if (kind === 'bell') { env(0, 0.08, 1.6); osc('sine', 880, null, 1.6); osc('sine', 1320, null, 1.2); }
        else if (kind === 'calls') { // market voices: short formant-ish bursts (a call and its echo from the crew)
            for (const [a, f] of [[0, 220], [0.5, 240]]) { const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 800; fl.Q.value = 2; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t + a); o.frequency.linearRampToValueAtTime(f * 1.3, t + a + 0.18); o.frequency.linearRampToValueAtTime(f * 0.9, t + a + 0.4); const gg = c.createGain(); gg.gain.setValueAtTime(0, t + a); gg.gain.linearRampToValueAtTime(0.05 * v, t + a + 0.05); gg.gain.exponentialRampToValueAtTime(0.0001, t + a + 0.45); o.connect(fl); fl.connect(gg); gg.connect(this.out); o.start(t + a); o.stop(t + a + 0.5); }
        }
        else if (kind === 'coin') { env(0, 0.18, 0.5); osc('triangle', 2400, 2200, 0.5); env(0.09, 0.12, 0.4); osc('triangle', 3100, 2900, 0.4, 0.09); }
        else if (kind === 'splat') { env(0, 0.25, 0.12); osc('square', 140, 60, 0.1); }
        else if (kind === 'whoosh') { const f = this._noise('bandpass', 700, 1.2); f.connect(g); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25 * v, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); setTimeout(() => f.disconnect(), 900); }
        else if (kind === 'catch') { env(0, 0.3, 0.2); osc('square', 180, 90, 0.15); }
        else if (kind === 'chime') { env(0, 0.12, 0.9); osc('sine', 1046, null, 0.9); env(0.12, 0.1, 0.9); osc('sine', 1568, null, 0.9, 0.12); }
        setTimeout(() => g.disconnect(), 2500);
    }
    setMuted(m) { this.muted = m; if (this.out) this.out.gain.value = m ? 0 : 0.7; }
    dispose() {
        removeEventListener('pointerdown', this._gesture); removeEventListener('keydown', this._gesture);
        for (const s of this.sources) s.node?.disconnect();
        this.out?.disconnect();
        if (this.ctx && !this.host?.ctx) this.ctx.close?.();
        this.sources = []; this.started = false;
    }
}
