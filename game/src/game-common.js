// Shared helpers and tables of the Game class (main.js and its game-*.js method modules): DOM lookup, chapter list,
// dev flag, weather / season / time-of-day tables, fuel model constants, prices and fines, money formatting.
import * as CITY_MOD from './cities.js';
import * as MINIMAP from './minimap.js';
import * as VEHICLES from './vehicles.js';

export const { MiniMap } = MINIMAP;
/** the map category toggles shared with minimap.js' legend (MAP_FILTER; spec 12 Request) — own defaults until it is exported */
// shared place-category filter (spec 12 Requests, note 81): `game.mapFilter` / minimap.js MAP_FILTER, keys cv landmark spot fuel shop park transit
export const mapFilter = () => globalThis.game?.mapFilter ?? MINIMAP.MAP_FILTER;
export const fkey = (cat) => (cat === 'business' ? 'shop' : cat);
export const { makeVehicle } = VEHICLES;

export const $ = (s) => document.querySelector(s);
export const { CITIES } = CITY_MOD;
// chapters in districts (spec 10): feature-detected — without CHAPTERS the old continuous-map flow runs
export const CHAPTERS = Array.isArray(CITY_MOD.CHAPTERS) && CITY_MOD.CHAPTERS.length && Object.values(CITIES).some(c => c.districts) ? CITY_MOD.CHAPTERS : null;
/** dev tools (collision overlay on B) only on localhost or with ?dev */
export const DEV = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(location.hostname) || /[?&]dev\b/.test(location.search);
// ---------- weather (render agent exposes r3d.weather / setWeather / onWeatherChange; all feature-detected) ----------
export const WEATHER_OVERRIDES = ['clear', 'cloudy', 'drizzle', 'rain', 'snow', 'fog', 'storm'];
export const WX_ICON = { clear: '☀️', cloudy: '☁️', rain: '🌧️', snow: '🌨️', fog: '🌫️', storm: '⛈️' };
export const WX_LABEL = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', fog: 'Fog', storm: 'Storm' };
/** coarse class of a weather object: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm' */
export function weatherKind(w) {
    if (!w) return 'clear';
    const c = w.code;
    if (typeof c === 'number') { // WMO weather codes
        if (c >= 95) return 'storm';
        if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
        if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
        if (c === 45 || c === 48) return 'fog';
        if (c >= 2) return 'cloudy';
    }
    const t = `${typeof c === 'string' ? c : ''} ${w.label || ''} ${w.kind || ''}`.toLowerCase();
    if (/thunder|storm/.test(t)) return 'storm';
    if (/snow|sleet|blizzard|flurr/.test(t)) return 'snow';
    if (/rain|drizzle|shower/.test(t)) return 'rain';
    if (/fog|mist|haze/.test(t)) return 'fog';
    if ((w.snowCm ?? 0) > 0.05) return 'snow';
    if ((w.precipMm ?? 0) > 0.1) return 'rain';
    if (Number.isFinite(w.visibilityM) && w.visibilityM < 1000) return 'fog';
    if (/cloud|overcast/.test(t) || (w.cloud ?? 0) > 0.7) return 'cloudy';
    return 'clear';
}
/** grip (1 dry) and NPC speed factor per weather class */
export const WX_GRIP = { rain: 0.72, storm: 0.66, snow: 0.45 };
export const WX_NPC = { rain: 0.85, storm: 0.8, snow: 0.65 };
export const SEASON_ICON = { winter: '❄️', spring: '🌸', summer: '☀️', autumn: '🍂', fall: '🍂' };
/** season text for a date and hemisphere (fallback when the weather object has none) */
export function seasonText(date, timeZone) {
    let m = date.getMonth();
    try { m = +new Intl.DateTimeFormat('en-GB', { timeZone, month: 'numeric' }).format(date) - 1; } catch { /* ignore */ }
    const names = ['winter', 'spring', 'summer', 'autumn'];
    const si = Math.floor(((m + 1) % 12) / 3), pos = (m + 1) % 3; // Dec-Feb winter … Sep-Nov autumn; 0 early, 1 mid, 2 late
    const name = names[si];
    return { name, text: pos === 0 ? `Early ${name}` : pos === 2 ? `Late ${name}` : name[0].toUpperCase() + name.slice(1) };
}
export const BAND_TEXT = {
    rush: ['🚦 Rush hour', 'Heavy traffic until the peak is over. Expect queues, honking and double-parkers.'],
    night: ['🌙 Night: light traffic', 'Empty streets — mind the speed cameras.'],
    normal: ['🚗 Traffic back to normal', ''],
};

// ---------- fuel model ----------
export const TANK_L = 45;
export const FUEL_IDLE = 0.8 / 3600;      // L/s at idle (~0.8 L/h)
export const FUEL_ROLL = 4.4e-5;          // L per metre-ish term (rolling / drivetrain)
export const FUEL_AERO = 5e-8;            // L/s per (m/s)^3
export const FUEL_ACC = 5e-5;             // L per (m/s^2 · m/s · s) while accelerating
// ≈ 7 L/100 km cruising at 50 km/h, ~12 in stop-and-go, ~9.5 at 110 km/h.
// The tank drains FUEL_GAME_MULT× faster than the trip computer shows, so a playthrough needs a fill-up.
export const FUEL_GAME_MULT = 6;
export const GAL = 3.78541;
export const PRICES = {
    bucharest: { cur: 'RON', unit: 'L', def: 7.35, brands: { Petrom: 7.39, OMV: 7.52, MOL: 7.36, Rompetrol: 7.41, Lukoil: 7.29, Socar: 7.34, Gazprom: 7.31 } },
    seattle: { cur: 'USD', unit: 'gal', def: 4.49, brands: { Chevron: 4.79, Shell: 4.69, '76': 4.59, Arco: 4.29, ARCO: 4.29, Costco: 4.19, BP: 4.55, Texaco: 4.65, Mobil: 4.62 } },
};
// fines by km/h over the limit (RO: OUG 195/2002 classes, approx 2025; WA: approx 2025 base + fees)
export function fineFor(cityId, overKmh) {
    if (cityId === 'bucharest') return overKmh <= 20 ? 580 : overKmh <= 30 ? 1015 : overKmh <= 40 ? 1450 : 2030;
    const mph = overKmh / 1.609;
    return mph <= 10 ? 187 : mph <= 15 ? 236 : mph <= 20 ? 289 : mph <= 25 ? 370 : mph <= 30 ? 463 : 555;
}
// ---------- local time of the current city ----------
export const OVERRIDE_HOURS = { dawn: 6.2, day: 13, sunset: 19.6, dusk: 20.3, night: 23.2 };
export const PHASE_ICON = { night: '🌙', dawn: '🌅', dusk: '🌇', day: '☀️' };
/** hours (0..24, fractional) of `date` in `timeZone` */
export function localHours(date, timeZone) {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
        const h = +parts.find(x => x.type === 'hour').value, m = +parts.find(x => x.type === 'minute').value;
        return h + m / 60;
    } catch { return date.getHours() + date.getMinutes() / 60; }
}
/** coarse phase from local hour (used when the render module does not expose one) */
export function phaseFromHours(h) { return h < 5.5 || h >= 21 ? 'night' : h < 7.5 ? 'dawn' : h >= 19 ? 'dusk' : 'day'; }
// RON: whole lei grouped with a thin space ("149 060 RON"); the ro-RO "." grouping read as decimals to most players
export const money = (cur, v) => cur === 'RON' ? `${Math.round(v).toLocaleString('en-US').replace(/,/g, ' ')} RON` : `$${v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(v >= 100 ? 0 : 2)}`;
