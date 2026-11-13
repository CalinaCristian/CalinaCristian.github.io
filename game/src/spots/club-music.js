// Original procedural composition, "Lipscani after dark" (2026), CC0-1.0.
// No samples, quotations, recordings or known melodies. See game/research/bucharest-spots.md, "Things to do by day and night".
export const CLUB_BPM = 126;
export const CLUB_BEAT = 60 / CLUB_BPM;

/** Deterministic stereo eight-bar house loop. Pure PCM generation also supports offline verification. */
export function clubPCM(sampleRate = 44100) {
    const length = Math.round(32 * CLUB_BEAT * sampleRate), channels = [new Float32Array(length), new Float32Array(length)];
    let seed = 76357;
    const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    const add = (time, duration, wave, pan = 0) => {
        const start = Math.round(time * sampleRate), count = Math.ceil(duration * sampleRate);
        const l = Math.sqrt((1 - pan) / 2), r = Math.sqrt((1 + pan) / 2);
        for (let i = 0; i < count; i++) { const v = wave(i / sampleRate, i / count), j = (start + i) % length; channels[0][j] += v * l; channels[1][j] += v * r; }
    };
    for (let beat = 0; beat < 32; beat++) {
        const at = beat * CLUB_BEAT;
        // Four-to-the-floor kick: integrated falling frequency, short click and sub tail.
        add(at, .36, t => .72 * Math.sin(2 * Math.PI * (48 * t + 8 * (1 - Math.exp(-t * 25)))) * Math.exp(-t * 15) + .045 * noise() * Math.exp(-t * 260));
        if (beat % 4 === 1 || beat % 4 === 3) add(at, .18, t => .22 * noise() * (Math.exp(-t * 32) + .45 * Math.exp(-Math.max(0, t - .025) * 45)) * Math.min(1, t * 900), .1);
        add(at + CLUB_BEAT * .5, .12, t => .11 * noise() * Math.exp(-t * 48), beat % 2 ? -.35 : .35);
        if (beat % 4 === 3) add(at + CLUB_BEAT * .75, .05, t => .065 * noise() * Math.exp(-t * 110), -.3);
        // Original syncopated bass, without a lead melody.
        const root = [55, 55, 65.4064, 48.9994][Math.floor(beat / 8)];
        for (const [offset, gain] of [[.24, .17], [.7, .11]]) add(at + offset * CLUB_BEAT, .22, t => gain * (Math.sin(2 * Math.PI * root * t) + .2 * Math.sin(4 * Math.PI * root * t)) * Math.min(1, t * 150) * Math.exp(-t * 16));
        if (beat % 2 === 0) {
            const chord = [root * 4, root * 4 * 1.189207, root * 6, root * 7.127189];
            const stab = t => chord.reduce((v, f) => v + Math.sin(2 * Math.PI * f * t) + .15 * Math.sin(4 * Math.PI * f * t), 0) * .022 * Math.min(1, t * 100) * Math.exp(-t * 9);
            add(at + CLUB_BEAT * .75, .6, stab, -.25);
            add(at + CLUB_BEAT * 1.5, .6, t => stab(t) * .32, .5);
        }
    }
    for (const channel of channels) for (let i = 0; i < length; i++) channel[i] = Math.tanh(channel[i] * 1.25) * .7;
    return { channels, sampleRate, length, duration: length / sampleRate };
}

/** Reuses SpotSound's existing context/output, so all game volume/mute controls apply. */
export function clubMusic() {
    let source = null, gain = null, filter = null, disposed = false, startedAt = 0;
    const pause = () => { if (gain) gain.gain.setValueAtTime(0, gain.context.currentTime); };
    const visibility = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', visibility);
    return {
        update(sound, volume, indoors = false) {
            if (disposed || !sound?.started || !sound.ctx || !sound.out) return;
            if (!source) {
                const c = sound.ctx, pcm = clubPCM(c.sampleRate), buffer = c.createBuffer(2, pcm.length, c.sampleRate);
                pcm.channels.forEach((data, i) => buffer.copyToChannel(data, i));
                gain = c.createGain(); gain.gain.value = 0; gain.connect(sound.out);
                filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = indoors ? 14000 : 950; filter.Q.value = .7; filter.connect(gain);
                source = c.createBufferSource(); source.buffer = buffer; source.loop = true; source.connect(filter); startedAt = c.currentTime; source.start();
            }
            filter.frequency.setTargetAtTime(indoors ? 14000 : 950, sound.ctx.currentTime, .2);
            gain.gain.setTargetAtTime(document.hidden ? 0 : Math.max(0, Math.min(1, volume)) * .8, sound.ctx.currentTime, .15);
        },
        pause,
        dispose() { if (disposed) return; disposed = true; pause(); source?.stop(); source?.disconnect(); filter?.disconnect(); gain?.disconnect(); source = gain = filter = null; document.removeEventListener('visibilitychange', visibility); },
        get started() { return !!source; },
        get beat() { return source ? (gain.context.currentTime-startedAt)/CLUB_BEAT : null; },
        get disposed() { return disposed; },
    };
}
