// ============================================================================
//  Creep up on a peacock (engine only: no three.js, unit-tested; the Spring Palace scene animates the bird). The
//  peacocks walk free in the residence garden. A peacock feeds with its head down, then looks up and around: move while
//  it is looking and it runs off. Walk up while it feeds, freeze when it looks up (a short jerk of the head warns you),
//  never run near it, and stand still within a few metres of it: it turns to you and fans its tail.
//
//  tick(dt, dist, speed): dist = metres from you to the bird, speed = your walking speed (m/s).
// ============================================================================
export const PEACOCK = { near: 2.6, still: 1.8, stillSpeed: 0.12, notice: 15, run: 2.6, runNear: 9, spooks: 3, flee: 1.8 };

export function createStalk({ rng = Math.random } = {}) {
    let state = 'feed', time = 0, dur = 2.5 + rng() * 2, spooks = 0, still = 0, last = null;
    const next = (s, d) => { state = s; time = 0; dur = d; };
    return {
        tick(dt, dist, speed) {
            if (!Number.isFinite(dt) || dt < 0 || dt > 0.101) throw Error('Invalid activity step');
            if (['fanned', 'gone', 'cancelled'].includes(state)) return null;
            time += dt;
            if (state === 'flee') { if (time >= PEACOCK.flee) next('feed', 2 + rng() * 2); return null; }
            if (state === 'fan') { if (time >= 2.2) { state = 'fanned'; return 'fanned'; } return null; }
            const moving = speed > PEACOCK.stillSpeed;
            // spooked: running close by, or moving while it is looking (and close enough to notice)
            const spook = (speed > PEACOCK.run && dist < PEACOCK.runNear) || (state === 'look' && moving && dist < PEACOCK.notice);
            if (spook) { spooks++; last = speed > PEACOCK.run ? 'ran' : 'moved'; still = 0; if (spooks >= PEACOCK.spooks) { state = 'gone'; return 'gone'; } next('flee', PEACOCK.flee); return 'spooked'; }
            if (dist <= PEACOCK.near) { still = moving ? 0 : still + dt; if (still >= PEACOCK.still) { next('fan', 2.2); return 'fan'; } } else still = 0;
            if (time >= dur) {
                if (state === 'feed') { next('alert', 0.55); return 'alert'; }
                if (state === 'alert') { next('look', 1.4 + rng() * 1.6); return 'look'; }
                if (state === 'look') { next('feed', 2.2 + rng() * 2.8); return 'feed'; }
            }
            return null;
        },
        cancel() { if (state !== 'fanned') state = 'cancelled'; },
        snapshot() { return { state, time, left: Math.max(0, dur - time), spooks, still, last, watching: state === 'look' || state === 'alert' }; },
    };
}
