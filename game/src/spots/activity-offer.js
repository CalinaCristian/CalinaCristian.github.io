// What a spot offers as an activity: the spot map (M) list, its 🎯 markers and the short guided tour.
// (owner, 2026-11-15: "activities should not have photo walks", "reading signs should not be part of guided tours",
// "look out from the viewpoint goals are dumb", "clean this up I want easy to follow things -- it should be based on
// what's available at my hour") Only interactive things are offered: rides, boats, games, food and drink, music,
// candles, coins. Plaques, inscriptions, viewpoints, framing / photo walks, stairs and exit / return steps stay in
// the scene (E still works where they exist) but are never listed as something to do.

/** interactable kinds that are never an offered activity */
export const NOT_OFFERED = new Set(['plaque', 'guide', 'talk', 'photo-hunt', 'frame', 'stairs', 'inscription', 'plant', 'viewpoint', 'walk-goal', 'exit', 'step']);
const STEP_LABEL = /^(exit|return|leave|walk the visible stairs|take the stairs)\b|\bback (down|up)\b/i;
/** interiors (the hidden bar, Freddo's room, the Carusel interior) are built far outside the street scene */
const INTERIOR = 4000;

const text = (it, s) => String((typeof it.label === 'function' ? it.label(s) : it.label) || '').trim();

/** is this interactable an activity at all (whatever the hour)? */
export function offered(it, s) {
    if (!it || it.hidden || it.offer === false || NOT_OFFERED.has(it.kind)) return false;
    if (!(Math.abs(it.x) < INTERIOR && Math.abs(it.z) < INTERIOR)) return false;
    const label = text(it, s);
    return !!label && !STEP_LABEL.test(label);
}

/**
 * 'now' (can be done at this hour / season), 'later' (a venue that opens later, an off-season boat) or null (not
 * here right now: a condition such as "not while another activity runs" or "only inside" fails).
 */
export function availability(it, s) {
    try {
        if (it.cond && !it.cond(s)) return null;
        if (it.tourAvailable && !it.tourAvailable(s)) return 'later';
    } catch { return null; }
    return 'now';
}

/** a short, whole name for the list: "Freddo · closed · opens at 22:00" → "Freddo · opens at 22:00" */
export function offerName(it, s) {
    return text(it, s).replace(/\s*·\s*closed\s*·\s*/i, ' · ').replace(/\s*\((warm season)\)\s*$/i, ' · $1');
}
