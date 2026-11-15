// ============================================================================
//  An evening concert and its applause (engine only: no three.js, unit-tested; the Athenaeum scene draws and plays it).
//  The concert-hall custom: you applaud when the conductor walks on, NOT between the movements of a symphony (the
//  conductor keeps the baton raised in the pause), not while the last chord dies away, and as soon as the baton comes down
//  at the end; keep the applause going through the bows and the orchestra may give an encore.
//
//  clap() is E. A clap in a pause, in the music or in the held silence after the last chord is a faux pas (the hall
//  shushes you); the concert goes on regardless. Perfect etiquette = no faux pas and an applause at the end.
// ============================================================================
export const PROGRAMME = [
    ['tuning', 3.2], ['entrance', 3.4], ['m1', 9], ['pause1', 4], ['m2', 9], ['pause2', 4], ['m3', 10], ['hold', 2.2], ['ovation', 5], ['bows', 5], ['encore', 7], ['end', 0],
];
export const ENCORE_CLAPS = 4;
const MUSIC = new Set(['m1', 'm2', 'm3', 'encore']);
export const MOVEMENTS = { m1: 'I. Allegro', m2: 'II. Adagio', m3: 'III. Finale', encore: 'Encore' };

export function createConcert() {
    let i = 0, time = 0, claps = 0, endClaps = 0, faux = [], welcomed = false, applauded = false, encore = false, state = PROGRAMME[0][0];
    const go = () => { i++; time = 0; state = PROGRAMME[i][0]; if (state === 'encore' && !encore) { i++; state = PROGRAMME[i][0]; } };
    return {
        /** E: returns 'welcome' | 'bravo' | 'between' | 'during' | 'too-soon' | 'ok' | null */
        clap() {
            if (state === 'end' || state === 'cancelled') return null;
            claps++;
            if (state === 'entrance') { welcomed = true; return 'welcome'; }
            if (state === 'ovation' || state === 'bows') { applauded = true; endClaps++; if (endClaps >= ENCORE_CLAPS) encore = true; return 'bravo'; }
            if (state === 'pause1' || state === 'pause2') { faux.push('between'); return 'between'; }
            if (MUSIC.has(state)) { if (state === 'encore') return 'ok'; faux.push('during'); return 'during'; }
            if (state === 'hold') { faux.push('too-soon'); return 'too-soon'; }
            return 'ok'; // (tuning: a stray clap while the oboe gives the A is harmless)
        },
        tick(dt) {
            if (!Number.isFinite(dt) || dt < 0 || dt > 0.101) throw Error('Invalid activity step');
            if (state === 'end' || state === 'cancelled') return null;
            time += dt; const dur = PROGRAMME[i][1];
            if (time >= dur) { const was = state; go(); return was === 'bows' && !encore ? 'end' : state; }
            return null;
        },
        cancel() { if (state !== 'end') state = 'cancelled'; },
        snapshot() {
            const dur = PROGRAMME[i]?.[1] || 0;
            return { state, time, left: Math.max(0, dur - time), claps, endClaps, faux: faux.slice(), welcomed, applauded, encore, music: MUSIC.has(state), movement: MOVEMENTS[state] || null, perfect: state === 'end' && faux.length === 0 && applauded };
        },
    };
}
