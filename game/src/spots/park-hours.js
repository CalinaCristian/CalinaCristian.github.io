// ============================================================================
//  Opening hours for spot activities, read from the in-game clock (the hour slider / time presets of the
//  conditions panel, or the destination's simulated date), and seasonal props that follow either the date
//  window or the season the player picked. Used by the Bellevue park activities (bel-park-activities.js).
//
//  hours spec: { open: 6, close: 23, note?: 'text shown when closed', season?: (s) => bool, seasonNote?: 'text' }
//  (hours are local decimal hours in the spot's time zone; close is exclusive; close < open wraps past midnight)
// ============================================================================
import { inWindow } from './scenes/bel-common.js';

// the nominal hours of the fixed time-of-day looks (game-common.js OVERRIDE_HOURS; copied: spots stay host-free)
const OVERRIDE_HOURS = { dawn: 6.2, day: 13, sunset: 19.6, dusk: 20.3, night: 23.2 };

/** local time at the spot: { h (decimal hour), m, d (month 1-12, day) } — the override's nominal hour when one is set */
export function spotTime(s) {
    const ov = s?.r3d?.clock?.override, date = s?.r3d?.simDate || s?.host?.date || new Date();
    const tz = s?.spot?.clock?.timeZone || 'America/Los_Angeles';
    let h = 12, m = date.getMonth() + 1, d = date.getDate();
    try {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(date).map((q) => [q.type, q.value]));
        h = +p.hour + +p.minute / 60; m = +p.month; d = +p.day;
    } catch { h = date.getHours() + date.getMinutes() / 60; }
    if (ov && OVERRIDE_HOURS[ov] != null) h = OVERRIDE_HOURS[ov];
    return { h, m, d };
}
const hhmm = (h) => `${Math.floor(h) % 24}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
export const hoursText = (spec) => `${hhmm(spec.open)}–${hhmm(spec.close)}`;
/** is the activity open now? (hour window + optional season test) */
export function openNow(spec, s) {
    if (spec.season && !spec.season(s)) return false;
    const { h } = spotTime(s), { open, close } = spec;
    return open <= close ? h >= open && h < close : h >= open || h < close;
}
/** start(s) only when open; otherwise a toast that says when (and how to get there: the time / season panel) */
export function gated(spec, title, start) {
    return (s) => {
        if (spec.season && !spec.season(s)) { s.ui.toast(`${title}: out of season`, spec.seasonNote || 'Pick another season in the time & weather panel (K).'); return false; }
        if (!openNow(spec, s)) { s.ui.toast(`${title}: closed now`, `Open ${hoursText(spec)} (local time).${spec.note ? ' ' + spec.note : ''} Change the hour in the time & weather panel (K).`); return false; }
        return start(s);
    };
}
/** an interactable label with the hours when closed: 'Throw a frisbee (opens 6:00)' */
export function hoursLabel(spec, label) {
    return (s) => (openNow(spec, s) ? label : `${label} (${spec.season && !spec.season(s) ? 'out of season' : 'open ' + hoursText(spec)})`);
}
/** the season the player picked in the conditions panel (null = from the date) */
export const seasonPicked = (s) => s?.r3d?._seasonOverride || null;
/** the season in force (picked, or from the date) */
export const seasonNow = (s) => seasonPicked(s) || s?.r3d?.weather?.season || null;
/**
 * a seasonal prop / activity window: on while the simulated date is inside [from, to] (month, day), or — when the
 * player picked a season — while that season is `season`. fn(on) runs now and on every change (checked every 2 s).
 * Returns a predicate (s) => on, for the activity gates.
 */
export function seasonWindow(ctx, from, to, season, fn = null) {
    const test = (s) => { const p = seasonPicked(s); if (p) return p === season; const t = spotTime(s); return inWindow({ m: t.m, d: t.d }, from, to); };
    let last = null, t = 0;
    if (fn) ctx.onUpdate((dt, s) => { t -= dt; if (t > 0 && last !== null) return; t = 2; const on = test(s); if (on !== last) { last = on; fn(on, s); } });
    return test;
}
