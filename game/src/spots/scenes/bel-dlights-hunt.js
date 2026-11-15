// ============================================================================
//  Bellevue Botanical Garden: the Garden d'Lights critter hunt (owner, 2026-11-15: real activities; the bridge walk and
//  the plant labels are not). Garden d'Lights is the garden's holiday light show; its 2026 run is Nov 28 – Jan 3 (closed
//  Dec 25), first entry 4:30 pm, last entry 9 pm, lights out 9:30 pm, and it has a "plants and critters" scavenger hunt
//  map (bellevuebotanical.org/garden-dlights). The game shows the critters in season (the dates, or Winter picked in the
//  K panel) after dark, 16:30–21:30 by the in-game hour.
//
//  Eight light critters stand beside the paths in the mapped garden rooms (their shapes, colours and exact places are the
//  game's: the real display's pieces are not surveyed). Find six before the lights go out (4 minutes): the panel names
//  the nearest critter you have not found, its garden room and its compass bearing; walk up (WASD), look at it and press
//  E. Leave or Esc stops.
// ============================================================================
import { activityFlow } from '../participation.js';
import { timedActivity, seasonWindow } from '../park-hours.js';
import { polyBox, inPoly } from '../kit.js';
import { fairyLights, emitActivity } from './bel-common.js';

export const DLIGHTS = { open: 16.5, close: 21.5, need: 6, secs: 240, reach: 4.2, aim: 0.45 };
// [critter, colour, garden room (OSM area id)] — shapes are drawn below
const CRITTERS = [['frog', '#7dff6a', 'Fuchsia Garden', 'r19658437'], ['snail', '#ffd166', 'Waterwise Garden', 'r19674922'], ['hummingbird', '#ff5fd2', 'Perennial Border', 'r19655849'], ['dragonfly', '#5fe3ff', 'Rock Garden', 'r19795610'],
    ['heron', '#e8f4ff', 'Iris Rain Garden', 'r19675944'], ['salmon', '#ff8a5c', 'Rhododendron Glen', 'r19675946'], ['owl', '#ffc94d', 'Tapestry Hedge', 'r19655850'], ['butterfly', '#b48cff', 'Shorts House Plantings', 'r19655851']];
const ell = (cx, cy, rx, ry, n = 16, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n }, (_, i) => { const a = a0 + (a1 - a0) * i / (a1 - a0 >= 6.28 ? n : n - 1); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const line = (ax, ay, bx, by, n = 6) => Array.from({ length: n }, (_, i) => [ax + (bx - ax) * i / (n - 1), ay + (by - ay) * i / (n - 1)]);
/** a critter's outline in its own plane (a across, b up; metres) */
const SHAPES = {
    frog: () => [...ell(0, 0.35, 0.42, 0.26, 22), ...ell(-0.2, 0.66, 0.09, 0.09, 8), ...ell(0.2, 0.66, 0.09, 0.09, 8), ...line(-0.38, 0.2, -0.6, 0.02), ...line(0.38, 0.2, 0.6, 0.02)],
    snail: () => [...Array.from({ length: 28 }, (_, i) => { const a = i * 0.45, r = 0.06 + i * 0.011; return [0.12 + Math.cos(a) * r, 0.42 + Math.sin(a) * r]; }), ...line(-0.55, 0.08, 0.55, 0.08, 12), ...line(-0.5, 0.1, -0.62, 0.36, 4), ...line(-0.45, 0.1, -0.5, 0.38, 4)],
    hummingbird: () => [...ell(0, 0.5, 0.3, 0.12, 16), ...line(0.3, 0.52, 0.72, 0.6, 6), ...ell(-0.08, 0.72, 0.16, 0.24, 12), ...line(-0.3, 0.48, -0.5, 0.36, 4)],
    dragonfly: () => [...line(-0.7, 0.5, 0.5, 0.5, 14), ...ell(-0.1, 0.68, 0.22, 0.12, 10), ...ell(0.2, 0.68, 0.22, 0.12, 10), ...ell(-0.1, 0.32, 0.22, 0.12, 10), ...ell(0.2, 0.32, 0.22, 0.12, 10), ...ell(0.56, 0.5, 0.06, 0.06, 6)],
    heron: () => [...line(-0.05, 0, -0.05, 0.6, 6), ...line(0.08, 0, 0.08, 0.6, 6), ...ell(0, 0.78, 0.32, 0.18, 16), ...Array.from({ length: 10 }, (_, i) => [0.24 + Math.sin(i * 0.5) * 0.1, 0.9 + i * 0.05]), ...line(0.3, 1.38, 0.62, 1.32, 5)],
    salmon: () => [...ell(0, 0.5, 0.48, 0.2, 22), ...line(-0.48, 0.5, -0.75, 0.72, 4), ...line(-0.48, 0.5, -0.75, 0.28, 4), ...line(-0.75, 0.28, -0.75, 0.72, 4), ...ell(0.3, 0.56, 0.03, 0.03, 4)],
    owl: () => [...ell(0, 0.52, 0.32, 0.42, 22), ...ell(-0.13, 0.7, 0.1, 0.1, 9), ...ell(0.13, 0.7, 0.1, 0.1, 9), ...line(-0.24, 0.9, -0.3, 1.04, 3), ...line(0.24, 0.9, 0.3, 1.04, 3)],
    butterfly: () => [...ell(-0.28, 0.66, 0.26, 0.2, 14), ...ell(0.28, 0.66, 0.26, 0.2, 14), ...ell(-0.2, 0.32, 0.18, 0.16, 12), ...ell(0.2, 0.32, 0.18, 0.16, 12), ...line(0, 0.2, 0, 0.82, 6)],
};

export function gardenDLightsHunt(ctx) {
    const d = ctx.data, g = ctx.ground, flow = activityFlow(ctx);
    const inSeason = seasonWindow(ctx, [11, 28], [1, 3], 'winter');
    const SPEC = { open: DLIGHTS.open, close: DLIGHTS.close, season: inSeason, seasonNote: 'Garden d\'Lights runs from late November to early January — or pick Winter in the time & weather panel (K).', note: 'Garden d\'Lights: first entry 4:30 pm, last entry 9 pm, lights out 9:30 pm.' };
    const paths = d.ways.filter((w) => ['footway', 'path'].includes(w.k) && w.pts.length > 1);
    // each critter: by the path nearest its garden room's middle, 1.6 m off the path towards the room, facing the path
    const critters = [];
    for (const [kind, colour, room, id] of CRITTERS) {
        const polys = d.areas.filter((a) => a.id === id || a.id.startsWith(id + '_')).map((a) => a.poly); if (!polys.length) continue;
        const b = polyBox(polys[0]), c = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
        let best = null; for (const w of paths) for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue; for (let t = 0; t <= L; t += 1) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L, dd = Math.hypot(x - c.x, z - c.z); if (!best || dd < best.d) best = { x, z, d: dd, tx: (bx - ax) / L, tz: (bz - az) / L }; } }
        if (!best || best.d > 40) continue;
        let nx = -best.tz, nz = best.tx; if ((c.x - best.x) * nx + (c.z - best.z) * nz < 0) { nx = -nx; nz = -nz; } // off the path, into the room
        const x = best.x + nx * 1.6, z = best.z + nz * 1.6, y = g.heightAt(x, z), ax2 = best.tx, az2 = best.tz; // the outline runs along the path, facing it
        const pts = SHAPES[kind]().map(([a, bb]) => [x + ax2 * a, y + 0.25 + bb, z + az2 * a]);
        for (let k = 0; k < 3; k++) pts.push([x, y + k * 0.08, z]); // the stake
        const crit = { kind, colour, room, x, y: y + 0.7, z, found: false };
        fairyLights(ctx, pts, { color: colour, size: 0.11, twinkle: 0.2, on: (s) => inSeason(s), name: 'dlights-critter-' + kind });
        fairyLights(ctx, pts.map(([px, py, pz]) => [px, py, pz]), { color: '#fff6d8', size: 0.2, twinkle: 0.6, on: () => crit.found, name: 'dlights-critter-found-' + kind });
        critters.push(crit);
    }
    const bearing = (dx, dz) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360) / 45) % 8];
    let st = null, last = null;
    const nearestLeft = (p) => { let b = null; for (const c of critters) if (!c.found) { const dd = Math.hypot(c.x - p.x, c.z - p.z); if (!b || dd < b.d) b = { c, d: dd }; } return b; };
    const say = (r, p, extra = '') => { const n = nearestLeft(p), left = Math.max(0, DLIGHTS.secs - st.t), mm = Math.floor(left / 60), ss = String(Math.floor(left % 60)).padStart(2, '0');
        r.status.textContent = `${extra ? extra + '  ·  ' : ''}Found ${st.found}/${DLIGHTS.need} · ${mm}:${ss} left${n ? ` · nearest: the ${n.c.kind}, ${Math.round(n.d)} m ${bearing(n.c.x - p.x, n.c.z - p.z)} in the ${n.c.room}` : ''}`; r.progress.value = st.found / DLIGHTS.need; };
    const start = (s) => flow.begin(s, {
        title: '✨ Garden d\'Lights critter hunt', action: 'That one! (E)', lockWalker: false,
        help: `Eight light critters hide in the garden rooms. Find ${DLIGHTS.need} before the lights go out: walk up to one (WASD), look at it and press E. The panel points you to the nearest one you have not found. Leave or Esc stops.`,
        started(s2, r) { st = { t: 0, found: 0, over: false }; for (const c of critters) c.found = false; r.progress.max = 1; say(r, s2.ctl.position); },
        actioned(s2, r) {
            if (!st) return;
            if (st.over) { st = { t: 0, found: 0, over: false }; for (const c of critters) c.found = false; r.button.textContent = 'That one! (E)'; say(r, s2.ctl.position, 'A new hunt'); return; }
            const p = s2.ctl.position, h = s2.ctl.heading, fx = -Math.sin(h), fz = -Math.cos(h);
            let hit = null; for (const c of critters) { if (c.found) continue; const dx = c.x - p.x, dz = c.z - p.z, dd = Math.hypot(dx, dz); if (dd > DLIGHTS.reach) continue; const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / (dd || 1)))); if (ang < DLIGHTS.aim || dd < 1.2) { hit = c; break; } }
            if (!hit) { say(r, p, 'Nothing there — look straight at a critter, close by'); return; }
            hit.found = true; st.found++; s2.sound?.play?.('chime', 0.4); s2.ui.toast(`✨ The ${hit.kind}!`, `In the ${hit.room}. ${st.found}/${DLIGHTS.need}`);
            if (st.found >= DLIGHTS.need) { flow.complete(); return; }
            say(r, p, `The ${hit.kind}!`);
        },
        update(dt, s2, r) {
            if (!st || st.over) return;
            st.t += dt; const p = s2.ctl.position;
            if (st.t >= DLIGHTS.secs) { st.over = true; r.button.textContent = 'Hunt again (E)'; r.status.textContent = `Lights out! You found ${st.found} of ${DLIGHTS.need}. E hunts again, Leave stops.`; return; }
            if (Math.floor(st.t * 2) !== Math.floor((st.t - dt) * 2)) say(r, p);
            last = { t: st.t, found: st.found, left: critters.filter((c) => !c.found).map((c) => ({ kind: c.kind, x: c.x, z: c.z })) };
        },
        cancel() { st = null; for (const c of critters) c.found = false; },
        complete(s2) { const secs = Math.round(st?.t || 0); st = null; for (const c of critters) c.found = false; emitActivity(s2, 'bel-botanical-garden', 'dlights-hunt', '✨ Critter hunter', `Six of the Garden d'Lights critters found in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}.`); },
    });
    // the E point: by the visitor centre's garden door — the path point nearest the spawn
    const sp = ctx.spot('bel-botanical-garden').spawn || { x: 0, z: 0 }; let at = { x: sp.x, z: sp.z - 6 };
    { let bd = Infinity; for (const w of paths) for (const [x, z] of w.pts) { const dd = Math.hypot(x - sp.x, z - (sp.z - 8)); if (dd < bd && !d.buildings.some((b) => inPoly(x, z, b.poly))) { bd = dd; at = { x, z }; } } }
    timedActivity(ctx, SPEC, { kind: 'dlights-hunt', x: at.x, z: at.z, r: 2.4, title: '✨ Garden d\'Lights', label: 'Hunt the Garden d\'Lights critters', cond: () => !st, start });
    const api = { start, active: () => !!st, debug: () => st && last, critters, at, inSeason };
    ctx.extras.gardenDLights = api;
    return api;
}
