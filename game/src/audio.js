/** Tiny procedural audio: engine hum, horns, rain, UI blips. No audio files needed. */
export class Audio {
    constructor() {
        this.ctx = null; this.enabled = false; this.muted = false;
    }
    init() {
        if (this.ctx) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AC();
            this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.6 * (this.volume ?? 1); this.master.connect(this.ctx.destination);
            // engine
            this.engOsc = this.ctx.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 50;
            this.engOsc2 = this.ctx.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 25;
            this.engFilter = this.ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 320;
            this.engGain = this.ctx.createGain(); this.engGain.gain.value = 0.0;
            this.engOsc.connect(this.engFilter); this.engOsc2.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
            this.engOsc.start(); this.engOsc2.start();
            // rain / ambience (filtered noise)
            const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
            const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            this.noise = this.ctx.createBufferSource(); this.noise.buffer = buf; this.noise.loop = true;
            this.noiseFilter = this.ctx.createBiquadFilter(); this.noiseFilter.type = 'bandpass'; this.noiseFilter.frequency.value = 900; this.noiseFilter.Q.value = 0.4;
            this.noiseGain = this.ctx.createGain(); this.noiseGain.gain.value = 0;
            this.noise.connect(this.noiseFilter); this.noiseFilter.connect(this.noiseGain); this.noiseGain.connect(this.master);
            this.noise.start();
            this.enabled = true;
        } catch (e) { console.warn('audio unavailable', e); }
    }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.6 * (this.volume ?? 1); }
    /** master volume 0..1 (settings) */
    setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); if (this.master && !this.muted) this.master.gain.value = 0.6 * this.volume; }
    engine(speed, throttle, dt) {
        if (!this.enabled) return;
        const rpm = 45 + Math.abs(speed) * 6 + Math.abs(throttle) * 20;
        this.engOsc.frequency.setTargetAtTime(rpm, this.ctx.currentTime, 0.08);
        this.engOsc2.frequency.setTargetAtTime(rpm / 2, this.ctx.currentTime, 0.08);
        this.engGain.gain.setTargetAtTime(0.05 + Math.abs(throttle) * 0.05 + Math.abs(speed) * 0.002, this.ctx.currentTime, 0.1);
    }
    ambience(level) { if (this.enabled) this.noiseGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.5); }
    stopEngine() { if (this.enabled) this.engGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); }
    /** a car horn. pan -1..1, dist in metres */
    horn(pan = 0, dist = 0, pitch = 1, dur = 0.5) {
        if (!this.enabled) return;
        const t = this.ctx.currentTime;
        dur=Math.max(.16,Math.min(1.2,Number.isFinite(dur)?dur:.45));pitch=Math.max(.8,Math.min(1.15,Number.isFinite(pitch)?pitch:1));dist=Math.max(0,Number.isFinite(dist)?dist:0);
        this._hornEnds=(this._hornEnds||[]).filter(end=>end>t);
        if(this._hornEnds.length>=6)return;
        const g = this.ctx.createGain(),vol=.14/(1+dist/20)/Math.sqrt(1+this._hornEnds.length*.6);
        this._hornEnds.push(t+dur);
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.045);g.gain.setValueAtTime(vol,t+dur-.09);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
        this._hornWave ||= this.ctx.createPeriodicWave(new Float32Array(7),new Float32Array([0,1,.55,.30,.14,.09,.04]));
        const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(this.master); } else g.connect(this.master);
        for (const f of [400 * pitch, 500 * pitch]) {
            const o = this.ctx.createOscillator();o.setPeriodicWave(this._hornWave);o.frequency.setValueAtTime(f*.985,t);o.frequency.exponentialRampToValueAtTime(f,t+.035);
            const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400/(1+dist/120);fl.Q.value=.7;
            o.connect(fl); fl.connect(g); o.start(t); o.stop(t + dur);
            o.onended=()=>{o.disconnect();fl.disconnect();};
        }
    }
    blip(freq = 880, dur = 0.08, vol = 0.12) {
        if (!this.enabled) return;
        const t = this.ctx.currentTime; const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
    }
    crash(strength = 1) {
        if (!this.enabled) return;
        const t = this.ctx.currentTime; const src = this.ctx.createBufferSource(); src.buffer = this.noise.buffer;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.4 * strength, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
        src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.3);
    }
    /** fuel pump: filtered noise hum + nozzle clicks */
    pump(dur = 2.5) {
        if (!this.enabled) return;
        const t = this.ctx.currentTime; const src = this.ctx.createBufferSource(); src.buffer = this.noise.buffer; src.loop = true;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 3;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.15); g.gain.setValueAtTime(0.18, t + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 110; const og = this.ctx.createGain(); og.gain.value = 0.04;
        o.connect(og); og.connect(g);
        src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur); o.start(t); o.stop(t + dur);
        this.blip(1800, 0.04, 0.08); setTimeout(() => this.blip(1500, 0.05, 0.1), dur * 1000);
    }
    /** speed-camera shutter */
    shutter() { this.blip(2400, 0.03, 0.12); setTimeout(() => this.blip(1200, 0.06, 0.08), 40); }
    /** short police siren whoop */
    siren(dur = 1.2) {
        if (!this.enabled) return;
        const t = this.ctx.currentTime; const o = this.ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(600, t); o.frequency.linearRampToValueAtTime(1300, t + dur * 0.5); o.frequency.linearRampToValueAtTime(650, t + dur);
        const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2200;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.05); g.gain.setValueAtTime(0.12, t + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(fl); fl.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
    }
    chime() { this.blip(660, 0.12, 0.1); setTimeout(() => this.blip(880, 0.12, 0.1), 110); setTimeout(() => this.blip(1320, 0.2, 0.1), 220); }
    tramBell() { this.blip(1200, 0.3, 0.08); setTimeout(() => this.blip(1200, 0.3, 0.08), 350); }
}
