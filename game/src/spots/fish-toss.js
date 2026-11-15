// ============================================================================
//  Pike Place Fish Market — the fish toss challenge (engine only: no three.js, unit-tested).
//
//  How the real toss works (pikeplacemarket.org FAQ "Wondering when they throw the fish?"; National Geographic,
//  "Meet the famous fish throwers of Seattle's Pike Place Market"; Port of Seattle blog "Flying fish lure visitors and
//  revenue"): when a customer buys a fish, the fishmonger out at the front display, on the customers' side of the
//  ice, shouts the order, the crew behind the counter echo it in unison, and the fish is thrown over the iced display
//  to a monger behind the counter, who catches it and wraps it. The custom goes back to the former owner Johnny
//  Yokoyama; visitors are sometimes invited behind the counter to try a catch.
//  Here two mongers at the front display take turns throwing to you, standing in the catcher's place behind the
//  counter: catch three of five. A catch needs the button at the end of the flight (the fish reaching your hands)
//  while you look at it.
//
//  Opening hours: Pike Place Fish, daily 7 am – 5 pm (pikeplacemarket.org FAQ, checked 2026-11-15). The challenge and
//  the mongers' show run in the in-game local hour inside that window.
// ============================================================================
export const FISH_HOURS = { open: 7, close: 17 };
/** is Pike Place Fish open at this local hour (0–24, fractional)? */
export const fishOpen = (hour) => Number.isFinite(hour) && hour >= FISH_HOURS.open && hour < FISH_HOURS.close;
export const FISH_ORDERS = ['wild king salmon', 'Copper River sockeye', 'silver salmon', 'whole halibut', 'Alaskan king salmon'];
export const FISH_TOSS = { throws: 5, need: 3, call: 1.5, early: 0.32, late: 0.1, caught: 1.0, dropped: 1.2 };

/**
 * @param {{ throws?:number, need?:number, rng?:()=>number }} o
 * state: 'call' (the monger shouts the order and winds up) → 'flight' → 'caught' | 'dropped' → next 'call' … → 'won' | 'lost'
 */
export function createFishToss({ throws = FISH_TOSS.throws, need = FISH_TOSS.need, rng = Math.random } = {}) {
    let state = 'call', time = 0, n = 0, catches = 0, misses = 0, cur = null, last = null;
    const next = () => { cur = { thrower: n % 2, dur: 0.95 + rng() * 0.3, lateral: (rng() - 0.5) * 0.8, arc: 0.7 + rng() * 0.4, order: FISH_ORDERS[Math.floor(rng() * FISH_ORDERS.length)] }; state = 'call'; time = 0; };
    const settle = () => { // after a catch or a drop: the next throw, or the result
        if (catches >= need) { state = 'won'; return; }
        if (catches + (throws - n) < need) { state = 'lost'; return; }
        next();
    };
    next();
    const inWindow = () => state === 'flight' && time >= cur.dur - FISH_TOSS.early && time <= cur.dur + FISH_TOSS.late;
    return {
        /** the catch button. aimOk: the player is looking at the fish. Returns 'catch' | 'early' | 'look' | null */
        action(aimOk = true) {
            if (state !== 'flight') return null;
            if (inWindow() && aimOk) { state = 'caught'; time = 0; catches++; n++; last = 'catch'; return 'catch'; }
            const why = inWindow() ? 'look' : 'early'; state = 'dropped'; time = 0; misses++; n++; last = why; return why;
        },
        tick(dt) {
            if (!Number.isFinite(dt) || dt < 0 || dt > 0.101) throw Error('Invalid activity step');
            if (['won', 'lost', 'cancelled'].includes(state)) return null;
            time += dt;
            if (state === 'call' && time >= FISH_TOSS.call) { state = 'flight'; time = 0; return 'throw'; }
            if (state === 'flight' && time > cur.dur + FISH_TOSS.late) { state = 'dropped'; time = 0; misses++; n++; last = 'late'; return 'late'; }
            if ((state === 'caught' && time >= FISH_TOSS.caught) || (state === 'dropped' && time >= FISH_TOSS.dropped)) { settle(); return state === 'call' ? 'next' : state; }
            return null;
        },
        cancel() { if (state !== 'won') state = 'cancelled'; },
        /** k: 0…1 along the current flight */
        snapshot() { return { state, time, thrown: n, throws, catches, misses, need, last, thrower: cur.thrower, dur: cur.dur, lateral: cur.lateral, arc: cur.arc, order: cur.order, k: state === 'flight' ? Math.min(1, time / cur.dur) : state === 'call' ? 0 : 1, catchNow: inWindow() }; },
    };
}
