// ============================================================================
//  Bellevue park activities (owner request 2026-11-15: "more creative activities … fully functional") — things
//  people really do there, played with WASD / mouse / E, each with a clear outcome, E or Leave to stop anytime, and
//  open by the in-game hour (park-hours.js). The scenes call these with the places they already model.
//
//  Bellevue Downtown Park (city page: open half an hour before sunrise to 11 pm; 10-acre lawn "for picnics";
//  Inspiration Playground; the seasonal Bellevue Downtown Ice Rink on the lower plaza, late Nov – mid Jan):
//    frisbee — a frisbee game on the great lawn with someone from the crowd   (6:00–23:00)
//    swing   — pump a swing at Inspiration Playground up to 50°               (6:00–23:00)
//    skate   — three laps of public skating at the rink                         (rink season, 10:00–22:00)
//  Meydenbauer Bay Park (city page: 6 am – 11 pm; beach, swimming area with summer lifeguards noon–7 pm, the
//  crescent pier with a hand-carry launch, seasonal kayak / paddleboard rentals — Best Kayak Rentals):
//    sup     — stand-up paddleboard round three buoys off the crescent pier     (warm seasons, 10:00–21:00)
//    swim    — swim out to the summer swim float inside the buoy line and back (swim season, 12:00–19:00)
//    skip    — the existing stone skipping, now with its own achievement      (6:00–23:00)
//  Sources: bellevuewa.gov parks pages (Downtown Park, Meydenbauer Bay Park, beach parks with lifeguards),
//  visitbellevuewa.com (Best Kayak Rentals hours), bellevuedowntown.com (ice rink season). Operator days of the
//  week are not modelled (only the hour can be set in the game); the hours above are the daily windows.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { emitActivity } from './bel-common.js';
import { gated, hoursLabel, openNow, seasonNow, seasonWindow } from '../park-hours.js';
import { lawnFrisbee } from '../lawn-frisbee.js';
import { swingRide } from '../swing-ride.js';
import { iceSkate } from '../ice-skate.js';
import { freeWaterRide } from '../free-water.js';
import { inPoly, distPolyline } from '../kit.js';

export const DOWNTOWN_PARK_HOURS = { open: 6, close: 23, note: 'The park opens half an hour before sunrise and closes at 11 pm.' };
export const MEYDENBAUER_HOURS = { open: 6, close: 23, note: 'Meydenbauer Bay Park is open 6 am – 11 pm.' };

export const parkActivity = (ctx, spec, it) => { // an interactable that names its hours when closed and is skipped by the tour while closed
    const label = it.label; ctx.interactables.push({ ...it, label: hoursLabel(spec, label), tourAvailable: (s) => openNow(spec, s), use: gated(spec, it.title, it.start) });
};

/** Downtown Park: the lawn, the swing, the rink. g: { C, R, mem, swing: {x, z}, rink: { poly, y, group } } */
export function downtownParkActivities(ctx, { C, R, mem, swing, rink }) {
    const g = ctx.ground, out = {};
    // ---- frisbee on the great lawn (inside the canal ring, clear of the memorial elms and the pools to the SW)
    const lawn = (x, z) => Math.hypot(x - C.x, z - C.z) < R - 12 && z < C.z + 18 && Math.hypot(x - mem.x, z - mem.z) > 13;
    const at = { x: C.x - 12, z: C.z + 6 }, facing = Math.atan2(-(-1), -(-0.35)); // the partner's end lies ~13 m west-north-west
    out.frisbee = lawnFrisbee(ctx, { at, facing, area: lawn, onDone: (s, st) => emitActivity(s, 'bel-downtown-park', 'frisbee', '🥏 Lawn game', `Three throws caught, three catches${st?.drops ? `, ${st.drops} dropped` : ''} — on the 10-acre lawn.`) });
    parkActivity(ctx, DOWNTOWN_PARK_HOURS, { kind: 'frisbee', x: at.x, z: at.z, r: 3, title: '🥏 Frisbee', label: 'Play frisbee on the lawn', cond: () => !out.frisbee.active(), start: (s) => out.frisbee.start(s) });
    // ---- the swing at Inspiration Playground (the OSM playground=swing frame; the seats are drawn by swingRide)
    if (swing) { const y = g.heightAt(swing.x, swing.z);
        out.swing = swingRide(ctx, { x: swing.x, y, z: swing.z, facing: -1, goal: 50, onDone: (s) => emitActivity(s, 'bel-downtown-park', 'swing', '🛝 Sky high', 'You pumped the swing up past 50°. E to hop off, or keep swinging.') });
        parkActivity(ctx, DOWNTOWN_PARK_HOURS, { kind: 'swing', x: swing.x + 0.6, z: swing.z - 1.1, r: 1.8, title: '🛝 Swing', label: 'Sit on the swing', cond: () => !out.swing.active(), start: (s) => out.swing.start(s) }); }
    // ---- public skating at the seasonal rink
    if (rink) {
        const on = seasonWindow(ctx, [11, 21], [1, 19], 'winter', (v) => { rink.group.visible = v; });
        const cx = rink.poly.reduce((a, p) => a + p[0], 0) / 4, cz = rink.poly.reduce((a, p) => a + p[1], 0) / 4;
        let gate = null; for (let i = 0; i < 4; i++) { const [ax, az] = rink.poly[i], [bx, bz] = rink.poly[(i + 1) % 4], mx = (ax + bx) / 2, mz = (az + bz) / 2, d = Math.hypot(mx - C.x, mz - C.z); if (!gate || d < gate.d) { const L = Math.hypot(mx - cx, mz - cz); gate = { d, x: mx + (mx - cx) / L * 1.3, z: mz + (mz - cz) / L * 1.3 }; } }
        out.skate = iceSkate(ctx, { poly: rink.poly, y: rink.y, gate, laps: 3, onDone: (s, st) => emitActivity(s, 'bel-downtown-park', 'skate', '⛸️ With the flow', `Three laps of the rink${st?.falls ? `, ${st.falls} fall${st.falls > 1 ? 's' : ''}` : ' without a fall'}.`) });
        const RINK = { open: 10, close: 22, season: on, seasonNote: 'The rink tent stands from late November to mid-January — or pick Winter in the time & weather panel (K).', note: 'Real public-session times vary; these are the game\'s.' };
        parkActivity(ctx, RINK, { kind: 'skate', x: gate.x, z: gate.z, r: 2.4, title: '⛸️ Ice rink', label: 'Rent skates and skate the rink', cond: () => !out.skate.active(), start: (s) => out.skate.start(s) });
    }
    ctx.extras.bellevueParkActivities = out;
    return out;
}

/**
 * Meydenbauer Bay: paddleboard and swim. m: { lakePoly, sdf, waterY, swim (poly), float: {x, z, top}, launch, put,
 * avoid(x, z) (piers, boats, sheds, swim area), pierLine (the crescent's centreline), summer (the swim-float group) }
 */
export function meydenbauerActivities(ctx, m) {
    const out = {}, Y = m.waterY;
    // ---- stand-up paddleboard from the hand-carry launch: round three of the mapped buoys off the crescent and back
    if (m.launch && m.put) {
        const shore = [...m.lakePoly, m.lakePoly[0]];
        const water = (x, z) => inPoly(x, z, m.lakePoly) && distPolyline(x, z, shore).d > 1.2 && !m.avoid(x, z) && distPolyline(x, z, m.pierLine).d > 3.3;
        const BUOYS = [[10, 66.1, 'the first buoy off the crescent'], [-14.6, 67.9, 'the second buoy'], [-41.1, 62.6, 'the third buoy']];
        const SUP = { open: 10, close: 21, season: (s) => seasonNow(s) !== 'winter', seasonNote: 'Board rentals run in the warm season — pick Spring, Summer or Autumn in the time & weather panel (K).', note: 'Best Kayak Rentals rents boards here Thu–Sun in season.' };
        out.sup = freeWaterRide(ctx, { kind: 'sup', waterY: Y, title: 'Stand-up paddleboard', action: 'Paddle back in',
            help: 'Hold W to paddle (Shift: harder strokes), A / D to turn, S to back-paddle; the mouse looks around. Turning hard at speed rocks the board — ease off or you fall in. Round the three buoys off the pier (yellow ring), then back to the dock. E, Leave or Esc returns you to the dock.',
            start: { x: m.put.x, z: m.put.z, heading: m.out ? Math.atan2(-(m.out.x - m.put.x), -(m.out.z - m.put.z)) : Math.atan2(-(BUOYS[0][0] - m.put.x), -(BUOYS[0][1] - m.put.z)) }, // (facing out of the moorage, along the kayak course)
            allowed: water, obstacles: (m.buoys || []).map(([x, z]) => ({ x, z, r: 0.9 })), blockedNote: 'Too close — keep clear of the pier, the moored boats and the swimming area.',
            checkpoints: BUOYS.map(([x, z, name]) => ({ x, z, r: 3.6, name })), finish: { x: m.put.x, z: m.put.z, r: 4, name: 'the launch dock' }, boardColour: '#e8f1f2',
            onDone: (s, st) => emitActivity(s, 'bel-meydenbauer', 'sup', '🏄 Round the pier buoys', `${Math.round(st.distance)} m on the board in ${Math.floor(st.secs / 60)}:${String(Math.round(st.secs % 60)).padStart(2, '0')}${st.falls ? `, ${st.falls} dip${st.falls > 1 ? 's' : ''} in the lake` : ', dry all the way'}.`) });
        parkActivity(ctx, SUP, { kind: 'sup', x: m.launch.x - 1.2, z: m.launch.z + 0.8, y: m.launch.y, r: 1.8, title: '🏄 Paddleboard', label: 'Rent a stand-up paddleboard', cond: () => !out.sup.active() && !m.busy?.(), start: (s) => out.sup.start(s) });
    }
    // ---- swim to the summer float (inside the buoy line, lifeguard hours) and back to the beach
    if (m.swim && m.float) {
        const swimArea = [...m.swim, m.swim[0]];
        // (the float itself sits ~3.5 m beyond the mapped buoy line, w737163174: the water round it counts as the swim area)
        const inSwim = (x, z) => (inPoly(x, z, m.swim) && distPolyline(x, z, swimArea).d > 0.7 || Math.hypot(x - m.float.x, z - m.float.z) < 6.5) && m.sdf(x, z) > 0.6 && Math.max(Math.abs(x - m.float.x), Math.abs(z - m.float.z)) > 2.9;
        // the entry: a point of the swim area's shoreline (the beach edge of its outline) with open water straight to the
        // float, nearest the lifeguard stand; you stand on the sand 2 m behind it and start swimming 3.5 m out
        let best = null; const ring = [...m.swim, m.swim[0]];
        for (let k = 1; k < ring.length; k++) { const [ax, az] = ring[k - 1], [bx, bz] = ring[k], Le = Math.hypot(bx - ax, bz - az);
            for (let t = 0; t <= Le; t += 1) { const cx = ax + (bx - ax) * t / Le, cz = az + (bz - az) * t / Le; if (Math.abs(m.sdf(cx, cz)) > 3) continue;
                const dx = m.float.x - cx, dz = m.float.z - cz, dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl;
                let qe = 0; while (qe > -10 && m.sdf(cx + ux * qe, cz + uz * qe) > -1.2) qe -= 0.5; let qp = 0; while (qp < 12 && !(m.sdf(cx + ux * qp, cz + uz * qp) > 2.2 && inSwim(cx + ux * qp, cz + uz * qp))) qp += 0.5;
                if (qe <= -10 || qp >= 12) continue; const entry = { x: cx + ux * qe, z: cz + uz * qe }, put = { x: cx + ux * qp, z: cz + uz * qp };
                let clear = true; for (let q = qp; q < dl - 4.5 && clear; q += 0.5) clear = inSwim(cx + ux * q, cz + uz * q); if (!clear) continue;
                const score = Math.hypot(cx - (m.guard?.x ?? cx), cz - (m.guard?.z ?? cz)); if (!best || score < best.score) best = { score, entry, put }; } }
        if (best) {
            const { entry, put } = best;
            const on = seasonWindow(ctx, [5, 25], [9, 8], 'summer', (v) => { if (m.summer) m.summer.visible = v; });
            const SWIM = { open: 12, close: 19, season: on, seasonNote: 'The swim float is out from late May to early September — or pick Summer in the time & weather panel (K).', note: 'Swim with the lifeguards: on duty noon – 7 pm in summer.' };
            out.swim = freeWaterRide(ctx, { kind: 'swim', waterY: Y, title: 'Swim to the float', action: 'Swim back in',
                help: 'Hold W to swim (Shift: faster), A / D to turn; the mouse looks around. Stay inside the buoy line. Swim out to the float (yellow ring), climb on, then swim back to the beach. E, Leave or Esc wades back to the beach.',
                start: { x: put.x, z: put.z, heading: Math.atan2(-(m.float.x - put.x), -(m.float.z - put.z)) },
                allowed: inSwim, blockedNote: 'Stay inside the buoy line — the lifeguards are watching.',
                checkpoints: [{ x: m.float.x, z: m.float.z, r: 3.9, name: 'the swim float', climb: { y: m.float.top, secs: 2.5, off: 4 } }], finish: { x: put.x, z: put.z, r: 3.2, name: 'the beach' },
                onDone: (s, st) => emitActivity(s, 'bel-meydenbauer', 'swim', '🏊 To the float and back', `${Math.round(st.distance)} m in Lake Washington in ${Math.floor(st.secs / 60)}:${String(Math.round(st.secs % 60)).padStart(2, '0')}.`) });
            parkActivity(ctx, SWIM, { kind: 'swim', x: entry.x, z: entry.z, r: 2.4, title: '🏊 Swim', label: 'Swim out to the float', cond: () => !out.swim.active(), start: (s) => out.swim.start(s) });
            out.swimEntry = { entry, put };
        }
    }
    ctx.extras.bellevueParkActivities = out;
    return out;
}
void THREE;
