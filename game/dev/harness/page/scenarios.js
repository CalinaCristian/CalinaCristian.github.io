// ============================================================================
//  Scenarios. Each entry: { id, title, city, run(H, ctx) → result object }.
//  `city` is where the scenario starts ('bucharest' | 'seattle'); the runner
//  loads that city first. Keep every scenario ≤ 90 s of simulated time:
//  teleport (H.placeOnRoad) instead of driving long distances.
//  To add one: append to SCENARIOS (or STREETS for a new "drive 400 m" street).
// ============================================================================
import { canTravel, lanesDir, roadName, sideW, r1, r2, edgeLocal, colliderDist, colliderKind, pip, sleep, isMotorway, solidFor, yAlong } from './util.js';

/** streets for scenario b: regex on the edge name, reference point (lat/lon) and preferred bearing (deg, 0 = north) */
export const STREETS = [
    { id: 'magheru', name: 'Bd. Magheru', re: /Magheru/, ll: [44.4440, 26.0978], bearing: 0 },
    { id: 'victoriei', name: 'Calea Victoriei', re: /^Calea Victoriei$/, ll: [44.4395, 26.0962], bearing: 0 },
    { id: 'unirii', name: 'Bd. Unirii', re: /^Bulevardul Unirii$/, ll: [44.4262, 26.1080], bearing: 90 },
    { id: 'kiseleff', name: 'Șos. Kiseleff', re: /Kiseleff/, ll: [44.4620, 26.0810], bearing: 0 },
    { id: 'stefan', name: 'Șos. Ștefan cel Mare', re: /Ștefan cel Mare|Stefan cel Mare/, ll: [44.4505, 26.1110], bearing: 90 },
    { id: 'pipera', name: 'Șos. Pipera', re: /^Șoseaua Pipera$/, ll: [44.4940, 26.1150], bearing: 0 },
    { id: 'dn1', name: 'DN1', re: /DN1|București-Ploiești/, ll: [44.5150, 26.0840], bearing: 0 },
    { id: 'splaiul', name: 'Splaiul Independenței', re: /^Splaiul Independenței$/, ll: [44.4330, 26.0880], bearing: 90 },
    { id: 'catargiu', name: 'Bd. Lascăr Catargiu', re: /Lascăr Catargiu/, ll: [44.4480, 26.0925], bearing: 0 },
    { id: 'floreasca', name: 'Calea Floreasca', re: /^Calea Floreasca$/, ll: [44.4590, 26.1000], bearing: 0 },
    { id: 'barbu', name: 'Str. Barbu Văcărescu', re: /Barbu Văcărescu/, ll: [44.4740, 26.1050], bearing: 0 },
];

// ---------------------------------------------------------------- helpers
const bearingOf = (e, dir) => (Math.atan2(e.dirx * dir, -e.dirz * dir) * 180 / Math.PI + 360) % 360;
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
/**
 * Find `length` m of drivable road whose name matches `re`, near `ll` ([lat, lon]), travelling roughly along `bearing`.
 * → { edge, dir, s, end: {x, z}, length, names[] } or null
 */
export function findStreet(H, re, length, { ll = null, bearing = null, bridge = null, maxStart = 1500 } = {}) {
    const g = H.g, W = g.world;
    const nameOk = (e) => re.test(e.name || '') || re.test(e.ref || '');
    let cands = W.graph.edges.filter(e => nameOk(e) && e.main !== false && e.len > 8 && (bridge === null || !!e.bridge === bridge));
    if (!cands.length) return null;
    let ref = null;
    if (ll && g.city?.proj) ref = g.city.proj(ll[0], ll[1]);
    if (ref) cands.sort((a, b) => Math.hypot((a.a.x + a.b.x) / 2 - ref.x, (a.a.z + a.b.z) / 2 - ref.z) - Math.hypot((b.a.x + b.b.x) / 2 - ref.x, (b.a.z + b.b.z) / 2 - ref.z));
    let best = null;
    // the bearing is a preference: one-way streets (Calea Victoriei, Kiseleff…) may only run the other way
    for (const useBearing of bearing === null ? [false] : [true, false]) {
        for (const e0 of cands.slice(0, 40)) {
            if (ref && Math.hypot((e0.a.x + e0.b.x) / 2 - ref.x, (e0.a.z + e0.b.z) / 2 - ref.z) > maxStart && best) break;
            for (const d0 of [1, -1]) {
                if (!canTravel(e0, d0)) continue;
                if (useBearing && angDiff(bearingOf(e0, d0), bearing) > 70) continue;
                // walk forward along same-name edges, smallest turn first
                let e = e0, dir = d0, len = e0.len * 0.5, guard = 0; const used = new Set([e0]); const names = [roadName(e0)];
                while (len < length && guard++ < 400) {
                    const node = dir > 0 ? e.b : e.a; let nx = null, bd = Infinity;
                    for (const n of node.edges) {
                        if (used.has(n) || n.main === false) continue;
                        const nd = n.a === node ? 1 : -1; if (!canTravel(n, nd)) continue;
                        if (!nameOk(n)) continue;
                        const dot = n.dirx * nd * e.dirx * dir + n.dirz * nd * e.dirz * dir; if (dot < 0.3) continue;
                        if (-dot < bd) { bd = -dot; nx = { e: n, dir: nd }; }
                    }
                    if (!nx) break;
                    e = nx.e; dir = nx.dir; used.add(e); len += e.len;
                }
                const end = dir > 0 ? e.b : e.a;
                const cand = { edge: e0, dir: d0, s: e0.len * 0.5, end: { x: end.x, z: end.z }, length: len, names, bearing: Math.round(bearingOf(e0, d0)) };
                if (len >= length) return cand;
                if (!best || len > best.length) best = cand;
            }
        }
        if (best && best.length >= length * 0.6) return best;
    }
    return best;
}
async function prep(H, { night = false } = {}) {
    const g = H.g;
    try { if (g.hud?.panelOpen) g.hud.closePanel(); } catch { /* ignore */ }
    if (g.state === 'office' && g.office) { g.office.done = true; H.stepOnce(); }
    if (g.mapOpen) g.toggleMap(false);
    if (g.clock) g.clock.override = night ? 'night' : 'day';
    g.refuel = null; H.refuelInstant();
    g.navManual = false; g.nav?.clear?.();
    H.setControls(0, 0, true);
    for (let i = 0; i < 3; i++) H.stepOnce();
}
/** check the car pose is sane right after a teleport / spawn / fast travel */
function checkPose(H, label, edge = null) {
    const g = H.g, P = g.player, W = g.world; const probs = [];
    // the edge the car should be on: the one we placed it on, else the nearest one at the car's level
    let e = edge;
    if (!e) {
        // the road whose carriageway holds the car (a driveway / service stub that joins a wide road reaches
        // into its lanes, so "nearest centreline" would wrongly pick the driveway), service roads last
        const y = P.surfY ?? 0.24; let bd = Infinity;
        for (const c of g.nav.index.near(P.x, P.z, 40, [])) {
            if (c.virtual) continue;
            const ya = yAlong(c, P.x, P.z); if (ya !== null && Math.abs(0.24 + ya - y) > 1.5) continue;
            const L = edgeLocal(c, P.x, P.z), s = Math.max(0, Math.min(c.len, L.s));
            const d = Math.hypot(P.x - (c.a.x + c.dirx * s), P.z - (c.a.z + c.dirz * s));
            const out = Math.max(0, d - sideW(c, L.lat >= 0 ? 1 : -1)) + (c.type === 'service' ? 0.5 : 0) + d * 0.01;
            if (out < bd) { bd = out; e = c; }
        }
    }
    if (!e) probs.push('no road within 40 m at the car\'s level');
    else {
        const L = edgeLocal(e, P.x, P.z), w = sideW(e, L.lat >= 0 ? 1 : -1);
        if (Math.abs(L.lat) > w + 0.5) { probs.push(`${r1(Math.abs(L.lat))} m from the centreline of ${roadName(e)} (half-width ${r1(w)})`); if (Math.abs(L.lat) > w + 1.5) probs.severe = true; }
        const dir = (P.fx * e.dirx + P.fz * e.dirz) >= 0 ? 1 : -1;
        if (!canTravel(e, dir)) { probs.push(`facing against the one-way ${roadName(e)}`); probs.severe = true; }
        else if (Math.sign(L.lat) !== dir && Math.abs(L.lat) > 1 && !e.oneway) probs.push(`on the left-hand (oncoming) side of ${roadName(e)}`);
    }
    let hit = null; W.buildings?.query?.(P.x, P.z, 3, (c) => { if (!hit && solidFor(P, c, P.x, P.z) && colliderDist(c, P.x, P.z) < 0.9) hit = c; });
    if (hit) { probs.push(`touching a ${colliderKind(hit, H.lampSet)}`); probs.severe = true; }
    for (const v of g.traffic?.near(P.x, P.z, 6) || []) { if (Math.abs((v.y ?? 0.24) - (P.surfY ?? 0.24)) < 2) { probs.push(`${v.kind} ${v.id} within 6 m`); break; } }
    if (probs.length) H.issue('bad-placement', probs.severe ? 'high' : 'medium', `${label}: ${probs.join('; ')}`, {}, { shot: true });
    return probs;
}
async function enterOfficeAndRead(H, stop) {
    const g = H.g, P = g.player; const door = stop.poiRef; const res = { stop: stop.id };
    const dx = door.doorX ?? door.x, dz = door.doorZ ?? door.z;
    const d = Math.hypot(P.x - dx, P.z - dz); res.doorDist = r1(d);
    const reach = typeof g.doorReach === 'function' ? g.doorReach(door) : 11; res.reach = r1(reach);
    if (d >= reach || Math.abs(P.speed) >= 5) { H.issue('stop-unreachable', 'high', `could not stop within ${r1(reach)} m of the ${stop.id} door (closest ${r1(d)} m)`, { door: H.where(dx, dz) }, { shot: true, key: 'stop:' + stop.id }); res.ok = false; return res; }
    H.press('KeyE'); await H.run(0.2, () => g.state === 'office');
    if (g.state !== 'office') { H.issue('office-enter-failed', 'high', `pressed E at ${r1(d)} m from the ${stop.id} door but the office did not open`, {}, { shot: true, key: 'enter:' + stop.id }); res.ok = false; return res; }
    const o = g.office; const st = o.stations?.[0];
    if (!st) { H.issue('office-no-screens', 'high', `office ${stop.id} has no screens`, {}, { key: 'noscr:' + stop.id }); }
    else {
        o.x = st.x * 0.45; o.z = st.z; await H.run(0.2);
        H.press('KeyE'); await H.run(0.2);
        if (!g.hud.panelOpen) H.issue('office-read-failed', 'high', `office ${stop.id}: pressing E next to screen "${st.data?.title}" did not open the panel`, {}, { shot: true, key: 'read:' + stop.id });
        else if (!H._officeShot) { H._officeShot = true; res.shot = await H.shot(`${H.city}-office-${stop.id}`); }
        g.hud.closePanel(); await H.run(0.3);
    }
    o.x = 0; o.z = o.exitZ ?? 14; await H.run(0.2);
    H.press('KeyE'); await H.run(0.5, () => g.state === 'drive' || g.state === 'card');
    await sleep(0);
    // ('card': the chapter-complete card opened on leaving)
    if (g.state !== 'drive' && g.state !== 'card') { H.issue('office-leave-failed', 'high', `could not leave the ${stop.id} office with E at the exit`, {}, { key: 'leave:' + stop.id }); o.done = true; await H.run(0.3); }
    res.visited = g.visited?.has(stop.id); res.ok = !!res.visited || (!!g.freeRoam && g.state === 'drive'); // free roam: CV content only, no unlocks
    if (!res.ok) H.issue('office-not-unlocked', 'high', `left the ${stop.id} office after reading a screen but the stop is not marked visited`, {}, { key: 'unlock:' + stop.id });
    return res;
}
async function fast(H, x, z, label, station = false) {
    const g = H.g; H.refuelInstant();
    if (typeof g.fastTravel !== 'function') { H.issue('harness-api', 'medium', 'game.fastTravel missing', {}, { key: 'ft' }); return false; }
    let ok = false;
    try { ok = await g.fastTravel({ x, z, label, station }); } catch (e) { H.issue('fast-travel-failed', 'high', `fastTravel to ${label} threw ${e.message}`, {}, { key: 'ftt:' + label }); }
    await sleep(20);
    H.mon.skipH = 3; H.mon.prevRH = undefined;
    return ok;
}
function roadAt(g, x, z) {
    let best = null, bd = Infinity;
    for (const c of g.nav.index.near(x, z, 30, [])) {
        if (c.virtual) continue;
        const L = edgeLocal(c, x, z), s = Math.max(0, Math.min(c.len, L.s));
        const d = Math.hypot(x - (c.a.x + c.dirx * s), z - (c.a.z + c.dirz * s));
        const out = Math.max(0, d - sideW(c, L.lat >= 0 ? 1 : -1)) + (c.type === 'service' ? 0.5 : 0) + d * 0.01;
        if (out < bd) { bd = out; best = c; }
    }
    return best;
}
/** on foot: walk to (x, z) (straight line, sidestep when blocked) → true when within r */
async function walkTo(H, x, z, { r = 2.5, timeout = 90, run = true } = {}) {
    const F = H.g.foot; if (!F?.active) return false;
    let best = Infinity, lastT = H.scT; F.auto = { fwd: 1, run, side: 0 };
    await H.run(timeout, () => {
        if (!F.active) return true;
        const dx = x - F.x, dz = z - F.z, d = Math.hypot(dx, dz);
        F.auto.heading = Math.atan2(-dx, -dz);
        if (d < best - 0.5) { best = d; lastT = H.scT; F.auto.side = 0; }
        else if (H.scT - lastT > 3) { F.auto.side = F.auto.side ? -F.auto.side : 1; F.auto.jump = true; lastT = H.scT; }
        return d < r;
    });
    F.auto = null;
    return Math.hypot(x - F.x, z - F.z) < r;
}
async function driveStreet(H, st, len = 400) {
    const g = H.g;
    const seg = findStreet(H, st.re, len, { ll: st.ll, bearing: st.bearing });
    if (!seg) { H.issue('street-not-found', 'high', `no drivable edge named like ${st.re} (${st.name})`, { x: 0, z: 0 }, { key: 'street:' + st.id }); return { ok: false, reason: 'street not found' }; }
    const pose = H.placeOnRoad(0, 0, null, { edge: seg.edge, dir: seg.dir, s: seg.s });
    checkPose(H, `start of ${st.name}`, seg.edge);
    await H.run(0.5);
    const r = await H.driveTo(seg.end.x, seg.end.z, { label: st.name, arriveR: 15, timeout: 85, stop: false });
    // the road whose carriageway holds each path point (not the nearest centreline: a driveway stub joining the street
    // would be listed as "(service)" although the car never left the street)
    const names = new Set(); for (const [x, z] of H.mon.pathXZ) { const e = roadAt(g, x, z); if (e) names.add(roadName(e)); }
    if (!r.ok) H.issue('drive-failed', r.reason === 'no route' ? 'high' : 'medium', `could not drive ${st.name} (${Math.round(seg.length)} m): ${r.reason}, ${r.remaining} m left after ${r.t} s`, {}, { shot: true, key: 'drive:' + st.id });
    const oir = H.auditAroundPath(30);
    return { ...r, street: st.name, segLength: Math.round(seg.length), start: H.where(pose?.x ?? 0, pose?.z ?? 0), via: [...names].slice(0, 8), objectsInRoad: oir };
}

// ---------------------------------------------------------------- scenarios
export const SCENARIOS = [
    {
        id: 'a', title: 'Spawn sanity', city: 'any',
        async run(H) {
            const g = H.g, W = g.world;
            await prep(H);
            g.placeSpawn ? g.placeSpawn(g.city, W) : null;
            g.traffic.setPlayer(g.player); H.mon.skipH = 3;
            // spawn sanity is about a fresh arrival: this city's stops unvisited (scenario f may already have
            // finished the story in Seattle); progress is restored at the end
            const wasVisited = (g.stops || []).filter(s => g.visited?.has(s.id)).map(s => s.id);
            for (const id of wasVisited) { g.visited.delete(id); const st = g.stops.find(s => s.id === id); if (st?.poiRef) st.poiRef.visited = false; }
            g.updateObjective?.();
            const res = { spawn: H.where(g.player.x, g.player.z) };
            if (wasVisited.length) res.resetVisited = wasVisited;
            res.problems = checkPose(H, 'spawn');
            await H.run(1.0);
            if (g.objective && !g.nav.route) H.issue('route-failure', 'high', `no nav route from the spawn to the objective ${g.objectivePlain}`, {}, { key: 'spawn-route' });
            if (g.nav.dest && !g.navInfo?.next) H.issue('nav-missing', 'medium', 'nav destination set but no next instruction after 1 s', {}, { key: 'spawn-nav' });
            const navline = document.querySelector('#navline')?.textContent?.trim() || '';
            res.navline = navline.slice(0, 120); res.street = document.querySelector('#street')?.textContent || '';
            if (g.objective && !navline) H.issue('nav-missing', 'medium', 'HUD nav line empty at the spawn while an objective is set', {}, { key: 'spawn-navline' });
            if (/off road/i.test(res.street)) H.issue('bad-placement', 'high', 'HUD says "Off road" at the spawn', {}, { key: 'spawn-offroad' });
            res.shot = await H.shot(`${H.city}-scenario-a-spawn`);
            // drive 150 m along the route to the objective (or straight down the road when there is none)
            const r = g.nav.route;
            let tgt = null;
            if (r) { let i = 0; while (i < r.points.length - 1 && r.cum[i] < 150) i++; tgt = r.points[i]; }
            else if (g.lanePose) { const lp = g.lanePose(g.player.x + g.player.fx * 150, g.player.z + g.player.fz * 150, g.player.heading); if (lp) tgt = [lp.x, lp.z]; res.noObjective = true; }
            if (tgt) {
                const [x, z] = tgt;
                res.drive = await H.driveTo(x, z, { label: 'first 150 m', timeout: 40, stop: false, arriveR: 15 });
                if (!res.drive.ok) H.issue('drive-failed', 'medium', `could not drive the first 150 m from the spawn: ${res.drive.reason}`, {}, { shot: true, key: 'spawn-drive' });
            }
            res.objectsInRoad = H.auditAroundPath(60);
            for (const id of wasVisited) { g.visited.add(id); const st = g.stops.find(s => s.id === id); if (st?.poiRef) st.poiRef.visited = true; }
            if (wasVisited.length) g.updateObjective?.();
            return res;
        },
    },
    ...STREETS.map(st => ({
        id: 'b:' + st.id, group: 'b', title: `Drive 400 m on ${st.name}`, city: 'bucharest',
        async run(H) { await prep(H); return driveStreet(H, st); },
    })),
    {
        id: 'c', title: 'Visit every CV stop (enter, read one screen, leave)', city: 'any',
        async run(H) {
            const g = H.g; await prep(H); const out = [];
            for (const stop of g.stops || []) {
                if (!stop.poiRef) { H.issue('poi-missing', 'high', `stop ${stop.id} has no POI`, { x: 0, z: 0 }, { key: 'pm:' + stop.id }); continue; }
                const dx = stop.poiRef.doorX ?? stop.poiRef.x, dz = stop.poiRef.doorZ ?? stop.poiRef.z;
                H.note(`visiting ${stop.id}`);
                H.mon.pathXZ = [];
                if (Math.hypot(g.player.x - dx, g.player.z - dz) > 150) {
                    const ok = await fast(H, dx, dz, stop.short || stop.id);
                    if (!ok) { H.issue('fast-travel-failed', 'high', `fastTravel to ${stop.id} returned false`, {}, { key: 'ftc:' + stop.id }); H.placeOnRoad(dx, dz); }
                }
                const r = await H.driveTo(dx, dz, { label: stop.id, arriveR: 7, timeout: 50, stop: true });
                const res = await enterOfficeAndRead(H, stop);
                out.push({ ...res, drive: r });
                await prep(H);
            }
            return { stops: out, visited: [...(g.visited || [])] };
        },
    },
    {
        id: 'd', title: 'Refuel at a station', city: 'any',
        async run(H) {
            const g = H.g, P = g.player; await prep(H);
            if (!g.stations?.length) { H.issue('no-stations', 'high', 'no gas stations in this city', {}, { key: 'nostations' }); return { ok: false }; }
            let ns = g.nearestStation ? g.nearestStation(P.x, P.z) : null;
            if (!ns) return { ok: false };
            if (ns.d > 400) { await fast(H, ns.st.x, ns.st.z, ns.st.brand, true); ns = g.nearestStation(P.x, P.z); }
            g.fuel = 8;
            const r = await H.driveTo(ns.st.x, ns.st.z, { label: 'station ' + ns.st.brand, arriveR: 5, timeout: 45, stop: true });
            const d = Math.hypot(P.x - ns.st.x, P.z - ns.st.z);
            const res = { station: ns.st.brand, at: H.where(ns.st.x, ns.st.z), drive: r, dist: r1(d) };
            if (d >= 12) { H.issue('station-unreachable', 'high', `could not stop within 12 m of the ${ns.st.brand} pumps (closest ${r1(d)} m)`, { station: H.where(ns.st.x, ns.st.z) }, { shot: true, key: 'st:' + Math.round(ns.st.x) }); return { ...res, ok: false }; }
            H.setControls(0, 0, true); await H.run(1.0, () => Math.abs(P.speed) < 0.3);
            H.press('KeyE'); await H.run(4.5);
            res.fuel = r1(g.fuel);
            res.ok = g.fuel > 44;
            if (!res.ok) H.issue('refuel-failed', 'high', `pressed E at the ${ns.st.brand} pumps (${r1(d)} m) but the tank is at ${r1(g.fuel)} L`, {}, { shot: true, key: 'refuel' });
            return res;
        },
    },
    {
        id: 'e', title: 'Fast travel to each stop', city: 'any',
        async run(H) {
            const g = H.g, P = g.player; await prep(H); const out = [];
            const targets = (g.stops || []).filter(s => s.poiRef).map(s => ({ id: s.id, x: s.poiRef.doorX ?? s.poiRef.x, z: s.poiRef.doorZ ?? s.poiRef.z, label: s.short || s.id }));
            if (g.airport) targets.push({ id: 'airport', x: g.airport.doorX ?? g.airport.x, z: g.airport.doorZ ?? g.airport.z, label: 'airport' });
            for (const t of targets) {
                if (Math.hypot(P.x - t.x, P.z - t.z) < 200) { H.placeOnRoad(P.x + 900, P.z + 600); await H.run(0.2); }
                H.mon.pathXZ = [];
                const ok = await fast(H, t.x, t.z, t.label);
                const res = { id: t.id, ok, landed: H.where(P.x, P.z), toDoor: r1(Math.hypot(P.x - t.x, P.z - t.z)) };
                if (!ok) { H.issue('fast-travel-failed', 'high', `fastTravel to ${t.id} returned false`, { to: H.where(t.x, t.z) }, { key: 'fte:' + t.id }); out.push(res); continue; }
                res.problems = checkPose(H, `fast-travel landing for ${t.id}`);
                await H.run(0.3);
                if (!g.nav.route) H.issue('nav-missing', 'medium', `no route after fast travel to ${t.id}`, {}, { key: 'ftnav:' + t.id });
                else res.navRemaining = Math.round(g.nav.route.total);
                const r = await H.driveTo(t.x, t.z, { label: t.id, arriveR: t.id === 'airport' ? 60 : 9, timeout: 20, stop: true });
                res.drive = r;
                if (!r.ok) H.issue('fast-travel-last-mile', 'medium', `after fast travel to ${t.id} the last ${res.toDoor} m could not be driven in 20 s (${r.reason}, ${r.remaining} m left)`, {}, { shot: true, key: 'ftlm:' + t.id });
                out.push(res);
            }
            return { targets: out };
        },
    },
    {
        id: 'f', title: 'Fly to Seattle, SR-518 → I-5 → I-90 bridge → I-405 → NE 8th, UiPath Bellevue, finale', city: 'bucharest',
        async run(H, ctx) {
            const g = H.g; await prep(H); const res = { legs: [] };
            if (g.city.id === 'bucharest') {
                const t0 = performance.now();
                const p = g.fly();
                for (let i = 0; i < 40 && g.state === 'flight'; i++) { await sleep(150); document.querySelector('#flight [data-skip]')?.click(); }
                await p;
                res.flightMs = Math.round(performance.now() - t0);
                if (g.city.id !== 'seattle' || g.state !== 'drive') { H.issue('flight-failed', 'high', `after fly(): city=${g.city.id} state=${g.state}`, {}, { key: 'fly' }); return res; }
                H.lampSet = null; H.begin(H.scenario); // new world: reset per-world state, keep the scenario name
                await prep(H);
                res.seattleSpawn = H.where(g.player.x, g.player.z);
                checkPose(H, 'Seattle spawn after the flight');
                res.shotSpawn = await H.shot('seattle-scenario-f-spawn');
            }
            const legs = [
                { name: 'SR-518', re: /SR-518/, len: 600, ll: [47.4640, -122.2950], bearing: 90 },
                { name: 'I-5', re: /^I-5$/, len: 700, ll: [47.5200, -122.2900], bearing: 0 },
                { name: 'I-90 floating bridge', re: /^I-90/, len: 900, ll: [47.5900, -122.2700], bearing: 90 },
                { name: 'I-405', re: /^I-405$/, len: 700, ll: [47.5950, -122.1880], bearing: 0 },
            ];
            for (const L of legs) {
                H.mon.pathXZ = [];
                const seg = findStreet(H, L.re, L.len, { ll: L.ll, bearing: L.bearing, maxStart: 3000 });
                if (!seg) { H.issue('street-not-found', 'high', `no drivable edge for ${L.name}`, { x: 0, z: 0 }, { key: 'sea:' + L.name }); res.legs.push({ name: L.name, ok: false }); continue; }
                const pose = H.placeOnRoad(0, 0, null, { edge: seg.edge, dir: seg.dir, s: seg.s });
                checkPose(H, `start of ${L.name}`, seg.edge);
                const bridge0 = !!g.flags?.bridge;
                const r = await H.driveTo(seg.end.x, seg.end.z, { label: L.name, arriveR: 20, timeout: 60, stop: false });
                if (!r.ok) H.issue('drive-failed', 'medium', `could not drive ${L.name} (${Math.round(seg.length)} m): ${r.reason}, ${r.remaining} m left`, {}, { shot: true, key: 'sea-drive:' + L.name });
                const leg = { name: L.name, from: H.where(pose?.x ?? 0, pose?.z ?? 0), length: Math.round(seg.length), ...r, objectsInRoad: H.auditAroundPath(30) };
                if (/I-90/.test(L.name)) { leg.bridgeAchievement = !!g.flags?.bridge; if (!bridge0 && !g.flags?.bridge) H.issue('bridge-not-detected', 'low', 'drove the I-90 leg but the floating-bridge achievement did not fire', {}, { key: 'bridge' }); }
                res.legs.push(leg);
            }
            // NE 8th → UiPath Bellevue
            const stop = (g.stops || []).find(s => s.id === 'uipath-bel');
            if (!stop?.poiRef) { H.issue('poi-missing', 'high', 'no UiPath Bellevue POI', { x: 0, z: 0 }, { key: 'pm:uipath-bel' }); return res; }
            const dx = stop.poiRef.doorX ?? stop.poiRef.x, dz = stop.poiRef.doorZ ?? stop.poiRef.z;
            const seg = findStreet(H, /^Northeast 8th Street$/, 300, { ll: [47.6170, -122.2010], bearing: 90 });
            H.mon.pathXZ = [];
            if (seg) H.placeOnRoad(0, 0, null, { edge: seg.edge, dir: seg.dir, s: seg.s });
            else { H.issue('street-not-found', 'high', 'no NE 8th St edge', { x: 0, z: 0 }, { key: 'ne8' }); H.placeOnRoad(dx - 300, dz); }
            const r = await H.driveTo(dx, dz, { label: 'UiPath Bellevue', arriveR: 7, timeout: 60, stop: true });
            res.legs.push({ name: 'NE 8th → UiPath Bellevue', ...r, objectsInRoad: H.auditAroundPath(30) });
            const office = await enterOfficeAndRead(H, stop);
            res.office = office;
            // finale panel opens 1.2 s (real time) after leaving the last office
            const t1 = performance.now(); while (performance.now() - t1 < 3000 && !g.hud.panelOpen) { await H.run(0.1); await sleep(50); }
            res.finale = g.hud.panelOpen && /Story complete/i.test(document.querySelector('#panel')?.textContent || '');
            if (res.finale) res.finaleShot = await H.shot('seattle-finale');
            else H.issue('finale-missing', 'high', 'left UiPath Bellevue after reading a screen but the finale panel did not open', {}, { shot: true, key: 'finale' });
            try { g.hud.closePanel(); } catch { /* ignore */ }
            return res;
        },
    },
    {
        id: 'g', title: 'Night run with headlights', city: 'bucharest',
        async run(H) {
            const g = H.g, P = g.player; await prep(H, { night: true });
            await H.run(0.5);
            const res = { phase: g.phase, nightLights: g.r3d?.nightLights, headlightsOn: g.headlightsOn, npcLights: g.traffic?.nightLights };
            if (!g.r3d?.nightLights) H.issue('night-lights', 'medium', 'clock override "night" but renderer nightLights is false', {}, { key: 'night-r3d' });
            if (!g.headlightsOn) H.issue('night-lights', 'medium', 'night: headlights (auto) are off', {}, { key: 'night-head' });
            if (!g.traffic?.nightLights) H.issue('night-lights', 'low', 'night: NPC lights are off', {}, { key: 'night-npc' });
            // lamp light-pool churn (flicker heuristic): run the renderer's lamp update every step, count visible swaps
            const r3d = g.r3d; let swaps = 0, frames = 0, lit = 0;
            const lampHook = () => {
                if (!r3d || typeof r3d._updateLamps !== 'function' || !r3d._lampPool?.length) return;
                const before = r3d._lampPool.map(l => [l.position.x, l.position.z, l.intensity]);
                r3d._updateLamps({ x: P.x, y: 0, z: P.z }, H.dt);
                r3d._lampPool.forEach((l, j) => { const b = before[j]; if (b[2] > 15 && l.intensity > 15 && Math.hypot(b[0] - l.position.x, b[1] - l.position.z) > 1) swaps++; if (l.intensity > 15) lit++; });
                frames++;
            };
            const st = STREETS.find(s => s.id === 'victoriei');
            const seg = findStreet(H, st.re, 400, { ll: st.ll, bearing: st.bearing });
            if (seg) H.placeOnRoad(0, 0, null, { edge: seg.edge, dir: seg.dir, s: seg.s });
            const orig = H.stepOnce.bind(H);
            H.stepOnce = (dt) => { orig(dt); if (g.state === 'drive') lampHook(); };
            const q0 = r3d?.qualityName;
            try {
                await H.run(1);
                res.shotStart = await H.shot(`${H.city}-scenario-g-night`);
                // the low tier has no lamp light pool: switch the (unrendered) renderer to 'high' for the heuristic
                if (r3d && !r3d._lampPool?.length && typeof r3d.setQuality === 'function') { r3d.setQuality('high'); r3d._syncLampPool?.(); res.lampTier = 'high'; H.noShots = true; }
                res.drive = seg ? await H.driveTo(seg.end.x, seg.end.z, { label: 'night ' + st.name, arriveR: 15, timeout: 70, stop: false }) : null;
            } finally { res.lampPoolSize = r3d?._lampPool?.length ?? 0; H.stepOnce = orig; H.noShots = false; if (res.lampTier && q0) r3d.setQuality(q0); }
            const simSec = frames * H.dt;
            res.lampPool = res.lampPoolSize; res.lampSwapsPerSec = simSec ? r2(swaps / simSec) : null; res.avgLitLamps = frames ? r1(lit / frames) : null;
            if (res.lampPool && res.lampSwapsPerSec > 1.5) H.issue('lamp-flicker', 'medium', `street-lamp light pool swaps ${res.lampSwapsPerSec} lit lights per second while driving (visible popping / flicker)`, { pool: res.lampPool }, { key: 'lamp-flicker' });
            if (!res.lampPool) H.note('lamp pool empty at this quality tier: flicker heuristic skipped');
            res.objectsInRoad = H.auditAroundPath(30);
            if (g.clock) g.clock.override = 'day';
            return res;
        },
    },
    {
        id: 'h', title: 'Collision / unstick (hit a wall, hit a prop, press R)', city: 'any',
        async run(H) {
            const g = H.g, P = g.player, W = g.world; await prep(H);
            const res = {};
            const st = g.city.id === 'bucharest' ? STREETS.find(s => s.id === 'catargiu') : { re: /^Northeast 8th Street$/, ll: [47.6170, -122.2010], bearing: 90 };
            const seg = findStreet(H, st.re, 200, { ll: st.ll, bearing: st.bearing });
            if (seg) H.placeOnRoad(0, 0, null, { edge: seg.edge, dir: seg.dir, s: seg.s }); else H.placeOnRoad(P.x, P.z);
            await H.run(0.3);
            // --- 1. a building wall within 40 m: aim at its nearest outline point and floor it
            let target = null, bd = Infinity;
            W.buildings.query(P.x, P.z, 40, (c) => {
                if (!c.poly) return;
                for (let i = 0, j = c.poly.length - 1; i < c.poly.length; j = i++) {
                    const ax = c.poly[j][0], az = c.poly[j][1], bx = c.poly[i][0], bz = c.poly[i][1];
                    const mx = (ax + bx) / 2, mz = (az + bz) / 2, d = Math.hypot(mx - P.x, mz - P.z);
                    if (d > 12 && d < bd && Math.hypot(bx - ax, bz - az) > 6) { bd = d; target = { x: mx, z: mz }; }
                }
            });
            if (!target) { H.issue('harness-scenario', 'low', 'no building wall within 40 m for the crash test', {}, { key: 'h-nowall' }); }
            else {
                P.heading = Math.atan2(-(target.x - P.x), -(target.z - P.z)); P.speed = 0;
                let maxV = 0, hitV = 0, touched = false;
                H.setControls(1, 0, false);
                await H.run(6, () => { maxV = Math.max(maxV, P.speed); if (P.touching && !touched) { touched = true; hitV = maxV; } return touched && Math.abs(P.speed) < 1; });
                await H.run(2.5); // keep pushing: the game should prompt for R
                res.wall = { at: H.where(target.x, target.z), dist: r1(bd), touched, impactSpeed: r1(hitV), stuckT: r1(g.stuckT || 0) };
                if (!touched) H.issue('wall-no-collision', 'high', `drove ${r1(bd)} m at a building wall at up to ${r1(maxV)} m/s but never touched it`, {}, { shot: true, key: 'h-wall' });
                res.wall.shot = await H.shot(`${H.city}-scenario-h-wall`);
                // --- R reset
                H.setControls(0, 0, true); await H.run(0.3);
                H.press('KeyR'); await H.run(0.4);
                res.reset = { pose: H.where(P.x, P.z), problems: checkPose(H, 'after R reset') };
                const r = g.nav.route || null;
                const ahead = g.lanePose ? g.lanePose(P.x + P.fx * 120, P.z + P.fz * 120, P.heading) : null;
                if (ahead) {
                    res.afterReset = await H.driveTo(ahead.x, ahead.z, { label: 'after reset', arriveR: 15, timeout: 30, stop: false });
                    if (!res.afterReset.ok) H.issue('unstick-failed', 'high', `could not drive away after R reset: ${res.afterReset.reason}`, {}, { shot: true, key: 'h-unstick' });
                }
                void r;
            }
            // --- 2. a prop (lamp / tree / post) next to the road: hit it at ~8 m/s, the car must stop
            let prop = null; bd = Infinity;
            W.buildings.query(P.x, P.z, 60, (c) => { if (c.prop && c.hw === c.r && c.r >= 0.15) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d > 14 && d < bd) { bd = d; prop = c; } } });
            if (prop) {
                // approach from 12 m on the road side
                const ne = g.nav.index.nearest(prop.x, prop.z, 40);
                let sx = prop.x, sz = prop.z;
                if (ne) { const ux = ne.cx - prop.x, uz = ne.cz - prop.z, l = Math.hypot(ux, uz) || 1; sx = prop.x + ux / l * 12; sz = prop.z + uz / l * 12; }
                P.place(sx, sz, Math.atan2(-(prop.x - sx), -(prop.z - sz))); g.traffic.clearAround?.(sx, sz, 20); H.mon.skipH = 3;
                let minD = Infinity, passed = false; const kind = colliderKind(prop, H.lampSet);
                H.setControls(1, 0, false);
                await H.run(4, () => { const d = Math.hypot(P.x - prop.x, P.z - prop.z); minD = Math.min(minD, d); if (Math.abs(P.speed) > 9) H.setControls(0, 0, false); const f = (prop.x - P.x) * P.fx + (prop.z - P.z) * P.fz; if (f < -3) passed = true; return passed || (P.touching && Math.abs(P.speed) < 0.5); });
                res.prop = { kind, r: prop.r, at: H.where(prop.x, prop.z), minDist: r2(minD), passedThrough: passed, touching: !!P.touching };
                if (passed || minD < 0.6) H.issue('prop-no-collision', 'high', `drove into a ${kind} (r=${r2(prop.r)}) and passed through it (closest ${r2(minD)} m)`, { x: prop.x, z: prop.z, kind }, { shot: true, key: 'h-prop' });
                H.setControls(0, 0, true); await H.run(0.5);
                H.press('KeyR'); await H.run(0.4);
                res.propReset = checkPose(H, 'after R reset (prop)');
            }
            return res;
        },
    },
    {
        id: 'i', title: '60 s stopped in a lane on Magheru (traffic must flow around)', city: 'bucharest',
        async run(H) {
            const g = H.g, P = g.player; await prep(H);
            const st = STREETS.find(s => s.id === 'magheru');
            // the longest multi-lane Magheru edge near the reference point; stop in the inner (through) lane
            const ref = g.city.proj(st.ll[0], st.ll[1]);
            const cands = g.world.graph.edges.filter(e => st.re.test(e.name || '') && e.main !== false && e.len > 40 && (lanesDir(e, 1) >= 2 || lanesDir(e, -1) >= 2))
                .sort((a, b) => (Math.hypot((a.a.x + a.b.x) / 2 - ref.x, (a.a.z + a.b.z) / 2 - ref.z) - a.len * 2) - (Math.hypot((b.a.x + b.b.x) / 2 - ref.x, (b.a.z + b.b.z) / 2 - ref.z) - b.len * 2));
            const e = cands[0];
            if (!e) { H.issue('street-not-found', 'high', 'no multi-lane Magheru edge', { x: 0, z: 0 }, { key: 'i-mag' }); return {}; }
            const dir = lanesDir(e, 1) >= 2 ? 1 : -1, lanes = lanesDir(e, dir);
            H.placeOnRoad(0, 0, null, { edge: e, dir, s: e.len * 0.55, lane: 0 });
            H.setControls(0, 0, true);
            const behind = new Map(); let passed = 0, maxQueue = 0, longest = 0;
            const watch = () => {
                let q = 0;
                for (const v of g.traffic.near(P.x, P.z, 70)) {
                    if (v.parked) continue;
                    const dx = v.x - P.x, dz = v.z - P.z, f = dx * P.fx + dz * P.fz, l = dx * -P.fz + dz * P.fx, same = v.fx * P.fx + v.fz * P.fz > 0.6;
                    if (!same) continue;
                    const rec = behind.get(v.id);
                    if (f < -2 && f > -60 && Math.abs(l) < 2.2) { if (!rec) behind.set(v.id, { t: 0, stillT: 0, passed: false }); }
                    if (rec) {
                        rec.t += H.dt;
                        if (Math.abs(v.speed) < 0.3 && f < 0) { rec.stillT += H.dt; longest = Math.max(longest, rec.stillT); } else rec.stillT = 0;
                        if (!rec.passed && f > 6) { rec.passed = true; passed++; }
                        if (f < 0 && f > -60 && Math.abs(v.speed) < 0.3) q++;
                    }
                }
                maxQueue = Math.max(maxQueue, q);
                return false;
            };
            await H.run(1); H.mon.pathXZ = [[P.x, P.z]];
            await H.run(60, watch);
            const shot = await H.shot(`${H.city}-scenario-i-stopped`);
            const res = { at: H.where(P.x, P.z), edgeLen: Math.round(e.len), lane: 0, lanes, approached: behind.size, passed, maxQueue, longestStillBehind: r1(longest), shot };
            if (behind.size > 0 && passed === 0) H.issue('traffic-no-flow', 'high', `stopped 60 s in a lane on Magheru: ${behind.size} vehicle(s) came up behind, none got past (queue ${maxQueue}, longest wait ${r1(longest)} s)`, {}, { key: 'i-noflow' });
            else if (longest > 35) H.issue('traffic-slow-flow', 'medium', `stopped in a lane on Magheru: a vehicle waited ${r1(longest)} s behind the player before getting around`, {}, { key: 'i-slow' });
            if (behind.size === 0) H.note('no traffic came up behind the stopped player in 60 s (sparse traffic at this spot)');
            res.objectsInRoad = H.auditAroundPath(40);
            return res;
        },
    },
    {
        id: 'ch', title: 'Chapter run: every chapter in its district (start pose, route, fast travel, last mile, office / boarding / waypoint, card → next)', city: 'bucharest',
        async run(H) {
            const g = H.g;
            if (!g.chapters || typeof g.goToChapter !== 'function') { H.note('no CHAPTERS: skipped'); return { skipped: true }; }
            const chm = await import('../../../src/chapters.js');
            const out = []; const N = g.chapters.length;
            const waitDrive = async (idx, ms = 240000) => { const t = performance.now(); while (!(g.state === 'drive' && g.chapterIdx === idx) && performance.now() - t < ms) { if (g.state === 'drive' || g.state === 'office') await H.run(0.2); await sleep(30); } return g.state === 'drive' && g.chapterIdx === idx; };
            const waitCard = async (ms = 6000) => { const t = performance.now(); while (!chm.chapterCardOpen() && performance.now() - t < ms) { if (g.state === 'drive' || g.state === 'office') await H.run(0.1); await sleep(30); } return chm.chapterCardOpen(); };
            g.goToChapter(0);
            for (let i = 0; i < N; i++) {
                const ch = g.chapters[i]; const res = { id: ch.id, district: ch.district };
                if (!await waitDrive(i)) { H.issue('chapter-load-failed', 'high', `chapter ${ch.id} (${ch.district}) did not start (state ${g.state}, chapter ${g.chapter})`, { x: 0, z: 0 }, { key: 'chl:' + ch.id }); out.push(res); break; }
                H.mon.skipH = 3; H.mon.prevRH = undefined; H.mon.pathXZ = []; H.refuelInstant(); H.setControls(0, 0, true);
                await H.run(0.5);
                res.world = g.world.district?.id || '(legacy map)';
                res.start = H.where(g.player.x, g.player.z);
                res.problems = checkPose(H, `chapter ${ch.id} start`);
                res.route = g.nav.route ? Math.round(g.nav.route.total) : null;
                const maxLen = ch.district === 'bellevue' ? 4000 : ch.district === 'seatac' ? 6000 : 2500; // bellevue ≤ 3 min since 2026-11-07
                if (!g.objective) H.issue('chapter-no-objective', 'high', `chapter ${ch.id}: no objective at the start`, {}, { key: 'cho:' + ch.id });
                else if (!g.nav.route) H.issue('route-failure', 'high', `chapter ${ch.id}: no route from the start to ${g.objectivePlain}`, {}, { key: 'chr:' + ch.id });
                else if (res.route < 1500 || res.route > maxLen) H.issue('chapter-route-length', 'low', `chapter ${ch.id}: route ${res.route} m from the start (spec 1.5–${maxLen / 1000} km)`, { route: res.route }, { key: 'chlen:' + ch.id });
                if (g.nav.route) res.via = [...new Set(g.nav.route.legs.map(l => roadName(l.e)))].slice(0, 6);
                if (g.nav.route?.legs.some(l => l.e.type === 'service' && l !== g.nav.route.legs[g.nav.route.legs.length - 1])) H.issue('chapter-route-service', 'low', `chapter ${ch.id}: the route uses a service road`, {}, { key: 'chsv:' + ch.id });
                // drive the first 150 m of the route (traffic, lanes, walls at the start)
                if (g.nav.route) { const r = g.nav.route; let k = 0; while (k < r.points.length - 1 && r.cum[k] < 150) k++; res.first = await H.driveTo(r.points[k][0], r.points[k][1], { label: `chapter ${ch.id} first 150 m`, timeout: 40, stop: false, arriveR: 15 }); g.navManual = false; g.autoRoute(true); }
                const o = g.objective;
                if (o) {
                    const ox = o.doorX ?? o.x, oz = o.doorZ ?? o.z;
                    if (Math.hypot(g.player.x - ox, g.player.z - oz) > 150) { res.fast = await fast(H, ox, oz, g.objectivePlain || ch.id); g.navManual = false; g.autoRoute(true); }
                    const stop = (g.stops || []).find(s => s.id === ch.stop && s.poiRef);
                    if (o.waypoint) res.drive = await H.driveTo(ox, oz, { label: ch.id, arriveR: 20, timeout: 60, stop: false });
                    else if (stop) { res.drive = await H.driveTo(ox, oz, { label: ch.id, arriveR: 7, timeout: 50, stop: true }); res.office = await enterOfficeAndRead(H, stop); }
                    else { res.drive = await H.driveTo(ox, oz, { label: ch.id, arriveR: 40, timeout: 50, stop: true }); H.setControls(0, 0, true); await H.run(1, () => Math.abs(g.player.speed) < 0.5); H.press('KeyE'); await H.run(0.3); }
                }
                res.card = await waitCard();
                if (i === N - 1) { res.finale = await (async () => { const t = performance.now(); while (!g.hud.panelOpen && performance.now() - t < 5000) await sleep(100); return g.hud.panelOpen; })(); if (!res.finale) H.issue('finale-missing', 'high', 'no finale panel after the last chapter', {}, { key: 'chfin' }); g.hud.closePanel?.(); }
                else if (!res.card) { H.issue('chapter-not-completed', 'high', `chapter ${ch.id}: reaching the goal did not complete the chapter (no card)`, {}, { shot: true, key: 'chc:' + ch.id }); out.push(res); g.goToChapter(i + 1); continue; }
                else chm.closeChapterCard('next');
                res.done = g.progress?.done?.has(ch.id);
                out.push(res);
            }
            return { chapters: out, done: [...(g.progress?.done || [])] };
        },
    },
    {
        id: 'jam', title: 'Rush hour in romana (08:30): Piața Victoriei hotspot crawls (< 2 m/s), outside flows (> 6 m/s), the player gets through (< 4 min)', city: 'bucharest',
        async run(H) {
            const g = H.g;
            const CITIES = (await import('../../../src/cities.js')).CITIES;
            if (!CITIES.bucharest?.districts?.romana) { H.note('no romana district: skipped'); return { skipped: true }; }
            const prevHour = g.clock.trafficHour;
            g.clock.trafficHour = 8.5;
            if (g.district !== 'romana' || g.city?.id !== 'bucharest') { g.state = 'loading'; await g.loadCity('bucharest', { district: 'romana' }); g.player.camHolder.add(g.camera); g.state = 'drive'; g.fuel = 45; }
            const T = g.traffic; T.setHour(8.5, true);
            const hs = T.hot?.[0]; if (!hs) { H.issue('jam-no-hotspots', 'high', 'romana has no congestion hotspots in traffic', {}, { key: 'jam-none' }); return {}; }
            H.setControls(0, 0, true);
            // the player waits 300 m south of the hotspot while the jam builds
            const P = g.player; const ang = Math.PI * 0.5; const sx = hs.x + Math.sin(ang) * 0, sz = hs.z + 300;
            H.placeOnRoad(sx, sz); await H.run(1);
            const inS = [], outS = [];
            for (let k = 0; k < 8; k++) {
                await H.run(5);
                for (const v of T.vehicles) { if (v.parked || v.tram) continue; const d = Math.hypot(v.x - hs.x, v.z - hs.z); if (d < hs.r * 0.8) inS.push(v.speed); else if (T.jamAt(v.x, v.z) < 0.05) outS.push(v.speed); }
            }
            const avg = (a) => a.length ? r2(a.reduce((x, y) => x + y, 0) / a.length) : null;
            const res = { hotspot: hs.note, level: r2(hs.L), vehicles: T.counts, avgIn: avg(inS), avgOut: avg(outS), updateMs: r2(T.stats.updateMs) };
            // transit + fleet (R13.3): kinds on the road, buses on bus routes, trolleybuses under wires, render cost
            { const kinds = {}; let bus = 0, busOn = 0, trol = 0, trolOn = 0; for (const v of T.vehicles) { kinds[v.kind] = (kinds[v.kind] || 0) + 1; if (v.trolley) { trol++; if (v.edge.trolleyWire) trolOn++; } else if (v.bus) { bus++; if (v.edge.busRoute) busOn++; } }
              H.renderFrame(); const rs = g.r3d?.stats || {};
              res.transit = { ...(T.transit || {}), kinds, bus, busOnRoute: busOn, trolley: trol, trolleyUnderWires: trolOn, drawCalls: rs.drawCalls, triangles: rs.triangles }; }
            if (!(res.avgIn < 2)) H.issue('jam-too-fluid', 'medium', `rush hour: average speed in the ${hs.note} hotspot ${res.avgIn} m/s (spec < 2)`, { x: hs.x, z: hs.z }, { key: 'jam-in' });
            if (!(res.avgOut > 6)) H.issue('jam-everywhere', 'medium', `rush hour: average speed outside the hotspots ${res.avgOut} m/s (spec > 6)`, {}, { key: 'jam-out' });
            // the player gets in: from ~300 m away to the hotspot centre through the queues
            g.navManual = false;
            const t0 = H.scT;
            res.cross = await H.driveTo(hs.x, hs.z, { label: 'into ' + hs.note, arriveR: 25, timeout: 240, stop: false });
            res.crossSec = r1(H.scT - t0);
            if (!res.cross.ok) H.issue('jam-impassable', 'high', `rush hour: the player could not get through ${hs.note} in 4 min (${res.cross.reason})`, {}, { shot: true, key: 'jam-cross' });
            g.clock.trafficHour = prevHour ?? false; T.setHour(g.trafficHours ? g.trafficHours() : 13, true);
            return res;
        },
    },
    {
        id: 'foot', title: 'On foot: get out, walk ~120 m on the sidewalk to an office, walk in, read, walk out, back to the car, drive away', city: 'bucharest',
        async run(H) {
            const g = H.g; if (typeof g.exitCar !== 'function') { H.note('no on-foot mode: skipped'); return { skipped: true }; }
            await prep(H);
            const stop = (g.stops || []).find(s => s.poiRef); if (!stop) return { skipped: 'no stop' };
            const door = { x: stop.poiRef.doorX ?? stop.poiRef.x, z: stop.poiRef.doorZ ?? stop.poiRef.z };
            const P = g.player; const res = { stop: stop.id };
            // park ~120 m before the door along the driving route
            const r0 = g.nav.compute(door.x + 300, door.z + 300, door.x, door.z);
            const route = g.nav.compute(P.x, P.z, door.x, door.z) || r0;
            if (route && route.total > 140 && g.poseAlongRoute) { const p = g.poseAlongRoute(route, route.total - 120); P.place(p.x, p.z, p.heading, p.edge); g.traffic.setPlayer(P); g.traffic.clearAround(p.x, p.z, 15); }
            else H.placeOnRoad(door.x + 60, door.z);
            H.setControls(0, 0, true); await H.run(1);
            H.press('Enter'); await H.run(0.3);
            res.exited = g.state === 'foot' && !!g.foot?.active;
            if (!res.exited) { H.issue('foot-exit-failed', 'high', `Enter at a standstill did not get the player out of the car (state ${g.state})`, {}, { shot: true, key: 'foot-exit' }); return res; }
            const F = g.foot; const car = { x: P.x, z: P.z };
            res.exitDist = r2(Math.hypot(F.x - P.x, F.z - P.z));
            res.shotOut = await H.shot(`${H.city}-foot-out`);
            // walk along the route, on the sidewalk to the right
            const wr = g.nav.compute(F.x, F.z, door.x, door.z);
            const pts = [];
            if (wr) for (let i = 1; i < wr.points.length; i++) { const leg = wr.legs[Math.min(i - 1, wr.legs.length - 1)], e = leg.e, off = (e.halfW ?? 4) + 1.6; pts.push([wr.points[i][0] + e.nx * leg.dir * off, wr.points[i][1] + e.nz * leg.dir * off]); }
            pts.push([door.x, door.z]);
            const t0 = H.scT; let inside = 0;
            for (const [x, z] of pts) {
                const ok = await walkTo(H, x, z, { r: 3, timeout: 40 });
                g.world.buildings.query(F.x, F.z, 2, (c) => { if (c.poly && !c.prop && pip(F.x, F.z, c.poly) && (c.h ?? 10) > 1) inside++; });
                if (!ok && Math.hypot(F.x - door.x, F.z - door.z) > 7) { H.issue('foot-walk-blocked', 'medium', `on foot: could not walk to (${r1(x)}, ${r1(z)}) toward ${stop.id}`, { x, z }, { shot: true, key: 'foot-walk' }); break; }
            }
            res.walkSec = r1(H.scT - t0); res.walked = r1(Math.hypot(F.x - car.x, F.z - car.z));
            if (inside) H.issue('foot-inside-building', 'high', `on foot: the walker ended up inside a building footprint ${inside}×`, {}, { shot: true, key: 'foot-inside' });
            res.doorDist = r1(Math.hypot(F.x - door.x, F.z - door.z));
            if (res.doorDist < 7) {
                H.press('KeyE'); await H.run(0.3, () => g.state === 'office');
                res.office = g.state === 'office';
                if (res.office) {
                    const o = g.office, st = o.stations?.[0];
                    if (st) { o.x = st.x * 0.45; o.z = st.z; await H.run(0.2); H.press('KeyE'); await H.run(0.2); g.hud.closePanel(); await H.run(0.3); }
                    o.x = 0; o.z = o.exitZ ?? 14; await H.run(0.2); H.press('KeyE'); await H.run(0.6, () => g.state !== 'office');
                    await sleep(0); if (g.state === 'card') { const chm = await import('../../../src/chapters.js'); chm.closeChapterCard('free'); await sleep(50); }
                    res.leftOnFoot = g.state === 'foot';
                    if (!res.leftOnFoot) H.issue('foot-office-exit', 'high', `walked into ${stop.id} but left it in state ${g.state} (expected on foot)`, {}, { key: 'foot-office' });
                } else H.issue('foot-office-enter', 'high', `on foot at ${res.doorDist} m from the ${stop.id} door, E did not open the office`, {}, { shot: true, key: 'foot-office-in' });
            } else H.issue('foot-door-unreached', 'medium', `on foot: ended ${res.doorDist} m from the ${stop.id} door`, {}, { key: 'foot-door' });
            // back to the car and drive away
            if (g.state === 'foot') {
                const d0 = g.carDoor();
                const back = await walkTo(H, d0.x, d0.z, { r: 2.2, timeout: 120 });
                H.press('Enter'); await H.run(0.3);
                res.backIn = g.state === 'drive';
                if (!res.backIn) H.issue('foot-enter-failed', 'high', `could not get back into the car (walked back: ${back}, state ${g.state})`, {}, { shot: true, key: 'foot-in' });
                else {
                    const ahead = g.lanePose(P.x + P.fx * 100, P.z + P.fz * 100, P.heading);
                    if (ahead) res.drive = await H.driveTo(ahead.x, ahead.z, { label: 'drive away after walking', arriveR: 15, timeout: 40, stop: false });
                }
            }
            return res;
        },
    },
];

// ---------------------------------------------------------------- tourist spots (spec 15): enter from the drive, walk, photo, postcard, pause → leave
/** one spot visit: g.enterSpot(id) from the current drive, walk ~10 s, a photo, the postcard pose, Esc → "Leave tourist spot",
 *  then the drive must be back exactly as it was (state, scene, car pose) */
async function visitSpot(H, id) {
    const g = H.g, res = { id };
    if (typeof g.enterSpot !== 'function') { H.note('no tourist spots in the game: skipped'); return { skipped: true }; }
    if (g.state !== 'drive' && g.state !== 'foot') await prep(H);
    const from = g.state, P = g.player, car = P ? { x: P.x, z: P.z, h: P.heading } : null, scene0 = g.scene;
    H.setControls(0, 0, true);
    const t0 = performance.now();
    const ok = await g.enterSpot(id);
    res.loadMs = Math.round(performance.now() - t0);
    if (!ok || g.state !== 'spot' || !g.spot) { H.issue('spot-enter-failed', 'high', `tourist spot ${id}: enterSpot failed (state ${g.state})`, {}, { key: 'spe:' + id }); return res; }
    H.setControls(0, 0, false);
    const S = g.spot, C = S.ctl;
    res.walker = S.walkerKind; res.sceneTris = S.spot?.tris ?? null;
    await H.run(0.5);
    res.shotIn = await H.shot(`spot-${id}-in`);
    const rs = g.r3d?.stats; if (rs) res.render = { drawCalls: rs.drawCalls, triangles: rs.triangles, quality: rs.quality };
    // walk: 5 s ahead, then 4 s after a turn
    const p0 = { x: C.x, z: C.z };
    C.auto = { fwd: 1, side: 0, run: true, heading: C.heading };
    await H.run(5);
    C.auto.heading = C.heading + 1.4; await H.run(4);
    C.auto = null; await H.run(0.3);
    res.walked = r1(Math.hypot(C.x - p0.x, C.z - p0.z)); res.y = r2(C.y);
    if (![C.x, C.y, C.z].every(Number.isFinite)) H.issue('spot-nan', 'high', `tourist spot ${id}: walker position is NaN`, {}, { key: 'spn:' + id });
    else if (res.walked < 2) H.issue('spot-walk-stuck', 'medium', `tourist spot ${id}: walked only ${res.walked} m in 9 s from the spawn`, {}, { shot: true, key: 'sps:' + id });
    // photo (rendered on request, the harness owns the frames)
    if (g.photo) {
        const cam = (fn) => { const pr = g.photo.o.render; g.photo.o.render = () => H.renderFrame(); return fn().finally(() => { g.photo.o.render = pr; }); };
        g.photo.open(); await H.run(0.2);
        res.photoOpen = !!g.photo.active;
        const shot = await cam(() => g.photo.shoot());
        res.photoBytes = shot?.meta?.bytes ?? null; res.photoPlace = shot?.meta?.place ?? null;
        if (!shot) H.issue('spot-photo-failed', 'medium', `tourist spot ${id}: the camera produced no photo`, {}, { key: 'spp:' + id });
        // the postcard challenge pose (research iconic photo)
        const ch = (S.spot?.challenges || []).find(c => c.id === id) || S.spot?.challenges?.[0];
        if (ch && C.teleport) {
            C.teleport(ch.x, ch.z, -(ch.bearing * Math.PI / 180)); C.pitch = (ch.pitch || 3) * Math.PI / 180; C.place?.(); await H.run(0.2); // the challenge's own pitch (look-up postcards: space-needle 60°, chihuly 45°)
            const s2 = await cam(() => g.photo.shoot());
            res.postcard = !!s2 && !!(S.progress?.postcards?.[ch.id]);
        }
        g.photo.close(); await H.run(0.2);
    }
    // seattle-center: the other entrances via the pause panel
    // pause → leave
    H.press('Escape'); await H.run(0.2);
    res.paused = !!(g.pauseOpen ?? g.hud.panelOpen);
    if (!res.paused) H.issue('spot-pause-missing', 'medium', `tourist spot ${id}: Esc did not open the pause menu`, {}, { key: 'spz:' + id });
    const tp = document.querySelector('#pause-menu [data-pa^="tp:"]') || document.querySelector('#panel [data-spot-act=tp]');
    if (tp) { tp.click(); await H.run(0.5); const tid = tp.dataset.pa ? tp.dataset.pa.slice(3) : tp.dataset.id; res.teleported = g.spotId === tid; H.press('KeyM'); await H.run(0.2); }
    const leave = document.querySelector('#pause-menu [data-pa=leave-spot]') || document.querySelector('#panel [data-spot-act=leave]');
    if (leave) leave.click(); else g.leaveSpot();
    await H.run(0.3);
    res.back = g.state;
    if (g.state !== from) H.issue('spot-leave-state', 'high', `tourist spot ${id}: left to state ${g.state}, expected ${from}`, {}, { key: 'spl:' + id });
    if (g.r3d?.scene !== scene0) H.issue('spot-leave-scene', 'high', `tourist spot ${id}: the renderer did not get the street scene back`, {}, { key: 'spr:' + id });
    if (car && Math.hypot(P.x - car.x, P.z - car.z) > 0.5) H.issue('spot-car-moved', 'medium', `tourist spot ${id}: the car moved ${r1(Math.hypot(P.x - car.x, P.z - car.z))} m while away`, {}, { key: 'spc:' + id });
    if (document.body.classList.contains('in-spot')) H.issue('spot-leave-css', 'medium', `tourist spot ${id}: body.in-spot still set after leaving`, {}, { key: 'spk:' + id });
    await H.run(1);
    res.shotBack = await H.shot(`spot-${id}-back`);
    return res;
}
{
    let ids = [];
    try { const m = await import('../../../src/spots/index.js'); ids = (m.SPOTS_ALL || m.SPOTS).map(s => s.id); } catch (e) { console.warn('[harness] spots module', e); }
    for (const id of ids) SCENARIOS.push({ id: 'spots:' + id, group: 'spots', title: `Tourist spot ${id}: enter from the drive, walk, photo + postcard pose, pause → leave, drive restored`, city: 'bucharest', run: (H) => visitSpot(H, id) });
}

// ---------------------------------------------------------------- the Bellevue finale at legal speed (spec 10: ≤ 3 min)
/** a whole chapter route at legal speed from the start (13:00): time, resets, junction stalls; `fin` = the Bellevue finale (≤ 180 s) */
async function driveChapter(H, chId, limit = null) {
        const g = H.g; const idx = (g.chapters || []).findIndex(c => c.id === chId);
        if (idx < 0) { H.note(`no ${chId} chapter: skipped`); return { skipped: true }; }
        const prevHour = g.clock.trafficHour; g.clock.trafficHour = 13;
        await g.enterChapter(idx, { initial: true }); H.lampSet = null;
        g.traffic.setHour(13, true); H.refuelInstant(); g.navManual = false; g.autoRoute(true);
        await H.run(1);
        const ch = g.chapters[idx], stop = g.stops.find(s => s.id === ch.stop);
        const o = stop?.poiRef || (g.objective ? { x: g.objective.doorX ?? g.objective.x, z: g.objective.doorZ ?? g.objective.z } : null); if (!o) return { skipped: 'no goal' };
        const res = { route: g.nav.route ? Math.round(g.nav.route.total) : null, via: g.nav.route ? [...new Set(g.nav.route.legs.map(l => roadName(l.e)))].slice(0, 8) : null };
        // junction watch: NPCs standing still inside a junction box for > 20 s
        const stuckIn = new Map(); let worst = 0, worstAt = null;
        const watch = () => {
            for (const v of g.traffic.vehicles) {
                if (v.parked) continue;
                const n = v.s < 6 ? (v.dir > 0 ? v.edge.a : v.edge.b) : v.edge.len - v.s < 6 ? (v.dir > 0 ? v.edge.b : v.edge.a) : null;
                if (n && n.hasLight && Math.abs(v.speed) < 0.2 && Math.hypot(v.x - g.player.x, v.z - g.player.z) > 25) { /* (not the ones queued behind / beside the player itself) */ const t = (stuckIn.get(v) || 0) + H.dt * 15; stuckIn.set(v, t); if (t > worst) { worst = t; const T = g.traffic, hits = {}; for (let k = 0; k < 60; k++) { const st = g.world.lightState ? g.world.lightState(n.id, v.edge, T.time + k, T.cycle) : T.lightState(n, v.edge); hits[st] = (hits[st] || 0) + 1; }
                    worstAt = { x: Math.round(v.x), z: Math.round(v.z), why: v.stopWhy || null, road: roadName(v.edge), kind: v.kind, node: n.id, cycle: T.cycle, light60s: hits, leader: v.leader && typeof v.leader === 'object' ? `${v.leader.kind || 'player'}:${v.leader.stopWhy || ''}` : String(v.leader), stopD: Math.round(v.stopD ?? -1) }; } }
                else stuckIn.delete(v);
            }
            return false;
        };
        const t0 = H.scT;
        const origStep = H.stepOnce.bind(H); H.stepOnce = (dt) => { origStep(dt); if (H.mon.steps % 15 === 0) watch(); };
        try { res.drive = await H.driveTo(o.doorX ?? o.x, o.doorZ ?? o.z, { label: `${chId} chapter drive`, arriveR: stop ? 9 : 25, timeout: 300, stop: !!stop }); }
        finally { H.stepOnce = origStep; }
        res.seconds = r1(H.scT - t0); res.junctionStillMax = r1(worst); res.junctionStillAt = worstAt;
        res.shot = await H.shot(`drive-${chId}-arrived`);
        if (!res.drive?.ok) H.issue('chapter-drive-failed', 'medium', `chapter ${chId}: the legal-speed drive from the start did not arrive (${res.drive?.reason}, ${res.drive?.resets} resets, ${res.drive?.remaining} m left)`, {}, { shot: true, key: 'chd:' + chId });
        if (limit && res.seconds > limit) H.issue('finale-too-long', 'medium', `${chId} took ${res.seconds} s at legal speed (spec ≤ ${limit} s)`, {}, { key: 'fin-time' });
        if (worst > 45) H.issue('junction-gridlock', 'high', `an NPC stood ${r1(worst)} s at a signalised junction on the finale route (${worstAt?.road}, ${worstAt?.why})`, worstAt || {}, { shot: true, key: 'fin-grid' });
        g.clock.trafficHour = prevHour;
        return res;
}
SCENARIOS.push({ id: 'fin', title: 'Bellevue finale (13:00): the chapter route at legal speed; ≤ 180 s, no junction gridlock', city: 'bucharest', run: (H) => driveChapter(H, 'uipath-bel', 180) });
for (const id of ['rosetti', 'upb', 'gts', 'luxoft', 'db', 'arnia', 'uipath-buc', 'otopeni', 'seatac', 'uipath-bel'])
    SCENARIOS.push({ id: 'drive:' + id, group: 'drive', title: `Chapter ${id}: the whole route at legal speed from the start (13:00)`, city: 'bucharest', run: (H) => driveChapter(H, id, id === 'uipath-bel' ? 180 : null) });

// ---------------------------------------------------------------- free roam (spec 10, R10.10)
SCENARIOS.push({
    id: 'roam', title: 'Free roam: every district (start pose, drive 200 m), one office, district switch via the Explore world map (montage / flight), conditions panel (time / weather / season → r3d)', city: 'bucharest',
    async run(H) {
        const g = H.g; if (typeof g.startFreeRoam !== 'function') { H.note('no free roam: skipped'); return { skipped: true }; }
        const out = { districts: [] };
        const ds = g.roamDistricts();
        const skipFlight = async (p) => { let done = false; p.then(() => { done = true; }); while (!done) { document.querySelector('#flight [data-skip]')?.click(); document.querySelector('#chapter-montage')?.dispatchEvent(new Event('pointerdown')); await sleep(200); } return p; };
        for (let i = 0; i < ds.length; i++) {
            const d = ds[i], res = { id: d.id };
            const ok = i === 0 ? await g.startFreeRoam(d.id, { tod: 'noon', weather: 'clear' }) : await skipFlight(g.explore?.jump ? g.explore.jump('district:' + d.id) : g.startFreeRoam(d.id, { tod: 'noon', weather: 'clear' }));
            H.lampSet = null;
            res.ok = !!ok && g.state === 'drive' && g.district === d.id && !!g.freeRoam && !g.ch;
            if (!res.ok) { H.issue('roam-load-failed', 'high', `free roam ${d.id}: state ${g.state}, district ${g.district}`, {}, { key: 'roam:' + d.id }); out.districts.push(res); continue; }
            H.refuelInstant(); H.mon.skipH = 3; H.mon.prevRH = undefined; H.mon.pathXZ = [];
            await H.run(0.5);
            res.start = H.where(g.player.x, g.player.z); res.problems = checkPose(H, `free roam ${d.id} start`);
            res.objective = g.objective; res.label = g.hud?.el?.chapter?.textContent;
            const P = g.player, ahead = g.lanePose(P.x + P.fx * 200, P.z + P.fz * 200, P.heading);
            if (ahead) { res.drive = await H.driveTo(ahead.x, ahead.z, { label: `free roam ${d.id} 200 m`, arriveR: 20, timeout: 45, stop: false }); }
            if ((res.drive?.dist ?? 0) < 100) H.issue('roam-drive', 'medium', `free roam ${d.id}: drove only ${res.drive?.dist ?? 0} m in 45 s from the start`, {}, { shot: true, key: 'roamd:' + d.id }); // (the target 200 m ahead may need a long one-way detour: distance driven is what counts)
            if (i === 0) {
                // conditions panel: each control must reach Renderer3D
                g.toggleConditions(true); res.panel = !!document.getElementById('cond-panel')?.classList.contains('show');
                const r3 = g.r3d, frame = () => { g.updateClock(0); H.renderFrame(); };
                g.setRoamTime('night'); frame(); res.night = r3.phase;
                g.setRoamTime('noon'); frame(); res.noon = r3.phase;
                g.setRoamHour(19.0); frame(); res.h19 = { phase: r3.phase, sun: Math.round(r3.sunElevation ?? 0), traffic: Math.round(g.trafficHours() * 10) / 10 };
                g.setRoamWeather('rain'); frame(); res.rain = r3._wxOverride || r3.weather?.kind;
                g.setRoamWeather('snow'); frame(); res.snow = r3._wxOverride || r3.weather?.kind;
                g.setRoamWeather('live'); frame(); res.live = r3._wxOverride ?? null;
                g.setRoamSeason('winter'); r3.frame?.(0.02); frame(); res.winter = r3._season?.season || r3.weather?.season;
                g.setRoamSeason('summer'); r3.frame?.(0.02); frame(); res.summer = r3._season?.season || r3.weather?.season;
                g.setRoamSeason('auto'); g.setRoamTime('noon'); g.setRoamWeather('clear');
                g.toggleConditions(false); res.panelClosed = !document.getElementById('cond-panel')?.classList.contains('show');
                const bad = []; if (res.night !== 'night') bad.push('night→' + res.night); if (res.noon !== 'day') bad.push('noon→' + res.noon); if (res.rain !== 'rain') bad.push('rain→' + res.rain); if (res.snow !== 'snow') bad.push('snow→' + res.snow); if (res.winter !== 'winter') bad.push('winter→' + res.winter); if (res.summer !== 'summer') bad.push('summer→' + res.summer);
                if (bad.length) H.issue('roam-conditions', 'high', `conditions panel did not reach the renderer: ${bad.join(', ')}`, {}, { key: 'roam-cond' });
                // one office: fast travel to the district's stop, drive to the door, read, leave (no story progress)
                const stop = (g.stops || []).find(s => s.poiRef);
                if (stop) {
                    const doneBefore = [...g.progress.done].join();
                    const o = stop.poiRef, ox = o.doorX ?? o.x, oz = o.doorZ ?? o.z;
                    if (Math.hypot(P.x - ox, P.z - oz) > 150) await fast(H, ox, oz, stop.short);
                    await H.driveTo(ox, oz, { label: stop.id, arriveR: 7, timeout: 50, stop: true });
                    res.office = await enterOfficeAndRead(H, stop);
                    res.progressUnchanged = [...g.progress.done].join() === doneBefore && !g.ch && g.state === 'drive';
                    if (!res.progressUnchanged) H.issue('roam-progress', 'high', `free roam office ${stop.id} changed story state (state ${g.state}, chapter ${g.chapter})`, {}, { key: 'roam-prog' });
                }
            }
            res.shot = await H.shot(`roam-${d.id}`);
            out.districts.push(res);
        }
        return out;
    },
});

// ---------------------------------------------------------------- round 5: pause menu, fines, achievements timing, focus, photo restore, chapter chaining
SCENARIOS.push({
    id: 'pause', group: 'r5', title: 'Pause menu: Esc opens it in the drive and on foot, the game is paused, sub-views + settings work, Resume / Esc closes it, focus back on the game', city: 'bucharest',
    async run(H) {
        const g = H.g; if (typeof g.togglePause !== 'function') return { skipped: true };
        await prep(H); const P = g.player, res = {};
        H.setControls(1, 0, false); await H.run(2); H.setControls(0, 0, false);
        const p0 = { x: P.x, z: P.z, t: g.traffic.time };
        H.press('Escape'); await H.run(0.2);
        res.openDrive = g.pauseOpen; await H.run(2);
        res.pausedMoved = r2(Math.hypot(P.x - p0.x, P.z - p0.z)); res.trafficFrozen = g.traffic.time === p0.t || Math.abs(g.traffic.time - p0.t) < 0.25;
        res.items = [...document.querySelectorAll('#pause-menu [data-pa]')].map(b => b.dataset.pa);
        for (const v of ['settings', 'chapters', 'spots', 'roam']) { const b = document.querySelector(`#pause-menu [data-pa="${v}"]`); if (b) { b.click(); res['view_' + v] = g._pauseView === v; document.querySelector('#pause-menu [data-pa=back]')?.click(); } }
        document.querySelector('#pause-menu [data-pa=settings]')?.click(); const sens = document.querySelector('#pause-menu [data-set=sens]'); if (sens) { sens.value = '1.5'; sens.dispatchEvent(new Event('input', { bubbles: true })); } res.sens = g.input.sens;
        document.querySelector('#pause-menu [data-pa=back]')?.click();
        H.press('Escape'); await H.run(0.2); res.closedByEsc = !g.pauseOpen; res.focusCanvas = document.activeElement === g.canvas;
        g.input.sens = 1; g.saveStr('sens', '1');
        // on foot
        P.speed = 0; await H.run(0.5); H.press('Enter'); await H.run(0.3);
        if (g.state === 'foot') { H.press('Escape'); await H.run(0.2); res.openFoot = g.pauseOpen; document.querySelector('#pause-menu [data-pa=resume]')?.click(); await H.run(0.2); res.closedResume = !g.pauseOpen && g.state === 'foot'; g.enterCar(); }
        const bad = []; if (!res.openDrive) bad.push('no menu on Esc (drive)'); if (res.pausedMoved > 0.05) bad.push(`car moved ${res.pausedMoved} m while paused`); if (!res.closedByEsc) bad.push('Esc did not resume'); if (!res.focusCanvas) bad.push('focus not on the game after resume'); if (res.openFoot === false) bad.push('no menu on Esc (foot)'); if (res.sens !== 1.5) bad.push('sensitivity setting');
        if (bad.length) H.issue('pause-menu', 'high', `pause menu: ${bad.join(', ')}`, {}, { shot: true, key: 'pause' });
        return res;
    },
});
SCENARIOS.push({
    id: 'fines', group: 'r5', title: 'Fines: 5 min of driving with traffic and crashes into walls must not pile up fines (only real offences: cameras, police, red lights, pedestrians in the road)', city: 'bucharest',
    async run(H) {
        const g = H.g; await prep(H); const P = g.player, res = { kinds: {} };
        const orig = g.giveFine; g.giveFine = function (title, body, over, kind) { res.kinds[kind] = (res.kinds[kind] || 0) + 1; return orig.call(this, title, body, over, kind); };
        const f0 = g.stats.fineCount, m0 = { ...g.stats.fines }; let crashes = 0;
        const oc = g.onCollide.bind(g); g.onCollide = (s, w, v) => { if (w !== 'pedestrian') crashes++; return oc(s, w, v); };
        try {
            const t0 = H.scT;
            while (H.scT - t0 < 300) {
                const ahead = g.lanePose(P.x + P.fx * 400 + (Math.random() - 0.5) * 300, P.z + P.fz * 400 + (Math.random() - 0.5) * 300, P.heading);
                if (!ahead) break;
                await H.driveTo(ahead.x, ahead.z, { label: 'fines drive', arriveR: 20, timeout: 60, stop: false });
                // a crash into whatever is beside the road every lap
                H.setControls(1, 0.8, false); await H.run(2.5); H.setControls(0, 0, true); await H.run(0.5); g.resetToRoad({ silent: true });
            }
        } finally { g.giveFine = orig; delete g.onCollide; }
        res.fines = g.stats.fineCount - f0; res.crashes = crashes; res.amount = Object.fromEntries(Object.entries(g.stats.fines).map(([k, v]) => [k, v - (m0[k] || 0)]));
        res.label = document.getElementById('trip')?.innerText?.replace(/\n/g, ' | ') || '';
        if (res.fines > 8) H.issue('fines-pileup', 'high', `${res.fines} fines in 5 min of driving (${JSON.stringify(res.kinds)}, ${crashes} crashes)`, {}, { key: 'fines' });
        return res;
    },
});
SCENARIOS.push({
    id: 'chain', group: 'r5', title: 'Achievements at the event + same-district chapters chain in place (luxoft → db, arnia → uipath-buc): no card, no respawn, objective switches where the player is', city: 'bucharest',
    async run(H) {
        const g = H.g; if (!g.chapters) return { skipped: true };
        const chm = await import('../../../src/chapters.js'); const out = [];
        for (const [a, b] of [['luxoft', 'db'], ['arnia', 'uipath-buc']]) {
            const ia = g.chapters.findIndex(c => c.id === a); if (ia < 0) continue;
            await g.enterChapter(ia, { initial: true }); H.lampSet = null; await H.run(0.5);
            const P = g.player, p0 = { x: P.x, z: P.z }, r = { from: a };
            const ach = 'ch-' + a; const had = g.achievements?.isUnlocked?.(ach);
            g.completeChapter(); await sleep(0); await H.run(0.1);
            r.achNow = !g.achievements || had || g.achievements.isUnlocked(ach); r.toast = !!document.querySelector('#achv-toasts .achv-toast');
            r.chapter = g.chapter; r.card = chm.chapterCardOpen(); r.state = g.state; r.moved = r1(Math.hypot(P.x - p0.x, P.z - p0.z));
            r.objective = g.objectivePlain; r.route = g.nav.route ? Math.round(g.nav.route.total) : null;
            const bad = []; if (r.chapter !== b) bad.push(`chapter ${r.chapter}`); if (r.card) { bad.push('card shown'); chm.closeChapterCard('free'); } if (r.moved > 0.5) bad.push(`moved ${r.moved} m`); if (!r.achNow) bad.push(`${ach} not unlocked at once`);
            if (bad.length) H.issue('chapter-chain', 'high', `${a} → ${b}: ${bad.join(', ')}`, {}, { shot: true, key: 'chain:' + a });
            out.push(r);
        }
        return { pairs: out };
    },
});
SCENARIOS.push({
    id: 'restore', group: 'r5', title: 'Photo mode zoom is undone on close (FOV, near/far, layers) and closing panels / map hands focus + mouse look back to the game', city: 'bucharest',
    async run(H) {
        const g = H.g; await prep(H); const res = {}, cam = g.camera;
        await H.run(1);
        const before = { fov: cam.fov, near: cam.near, far: cam.far, layers: cam.layers.mask };
        g.photo.open(); g.photo.setFov(25); await H.run(0.3); g.photo.close(); await H.run(0.05);
        res.fov = [r1(before.fov), r1(cam.fov)]; res.nearFar = [cam.near === before.near, cam.far === before.far, cam.layers.mask === before.layers];
        if (Math.abs(cam.fov - before.fov) > 1.5 || !res.nearFar.every(Boolean)) H.issue('photo-restore', 'high', `photo mode close left FOV ${r1(cam.fov)} (was ${r1(before.fov)}) near/far/layers ${res.nearFar}`, {}, { key: 'photo-restore' });
        // panels: map, hud panel, pause → focus on the canvas, look allowed, no stuck keys
        const checks = {};
        g.toggleMap(true); await H.run(0.2); g.toggleMap(false); await H.run(0.1); checks.map = document.activeElement === g.canvas && g.input.lookAllowed;
        g.hud.panel('<p>test</p>'); await H.run(0.2); document.querySelector('#panel [data-close]')?.click(); await H.run(0.1); checks.panel = document.activeElement === g.canvas && g.input.lookAllowed;
        g.togglePause?.(true); await H.run(0.1); document.querySelector('#pause-menu [data-pa=resume]')?.click(); await H.run(0.1); checks.pause = document.activeElement === g.canvas && g.input.lookAllowed;
        if (g.achievements?.open) { g.achievements.open(); await H.run(0.1); g.achievements.close(); await H.run(0.1); checks.achievements = document.activeElement === g.canvas && g.input.lookAllowed; }
        res.focus = checks;
        const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
        if (bad.length) H.issue('focus-after-panel', 'high', `focus / mouse look not back after closing: ${bad.join(', ')}`, {}, { key: 'focus' });
        return res;
    },
});
SCENARIOS.push({
    id: 'office-talk', group: 'r5', title: 'Office conversation (note 37): E at the host opens the talk, every topic can be asked (A–D), "Thanks, bye" closes it, leave at the exit', city: 'bucharest',
    async run(H) {
        const g = H.g; await prep(H); const stop = (g.stops || []).find(s => s.poiRef); if (!stop) return { skipped: true };
        g.enterOffice(stop); await H.run(0.3);
        const o = g.office, res = { stop: stop.id, stations: o.stations?.length };
        const st = o.stations?.[0]; if (st) { o.x = st.x * 0.45; o.z = st.z; } await H.run(0.2);
        H.press('KeyE'); await H.run(0.3); res.talkOpen = g.hud.panelOpen;
        for (let k = 0; k < 20 && o.read.size < (o.stations?.length || 0); k++) {
            const b = [...document.querySelectorAll('#panel .dlg-opts button')].find(x => !x.classList.contains('bye') && !x.classList.contains('again')) || document.querySelector('#panel .dlg-opts button:not(.bye)');
            if (!b) break; b.click(); await H.run(0.3);
        }
        res.read = o.read.size;
        document.querySelector('#panel .dlg-opts button.bye')?.click(); await H.run(0.3); res.closed = !g.hud.panelOpen;
        o.x = 0; o.z = o.exitZ ?? 14; await H.run(0.2); H.press('KeyE'); await H.run(0.6, () => g.state !== 'office');
        await sleep(0); if (g.state === 'card') { const chm = await import('../../../src/chapters.js'); chm.closeChapterCard('free'); await sleep(50); }
        res.left = g.state !== 'office'; res.focus = document.activeElement === g.canvas;
        const bad = []; if (!res.talkOpen) bad.push('E did not open the talk'); if (res.read < res.stations) bad.push(`heard ${res.read}/${res.stations}`); if (!res.closed) bad.push('bye did not close'); if (!res.left) bad.push('could not leave');
        if (bad.length) H.issue('office-talk', 'high', `office ${stop.id}: ${bad.join(', ')}`, {}, { shot: true, key: 'otalk' });
        return res;
    },
});
SCENARIOS.push({
    id: 'findcar', group: 'r5', title: 'Find the car on foot (note 7): HUD chip with distance + direction, map marker, walk-back route, key-fob beep, call the car, get back in', city: 'bucharest',
    async run(H) {
        const g = H.g; await prep(H); const P = g.player, res = {};
        H.setControls(0, 0, true); await H.run(1); H.press('Enter'); await H.run(0.3);
        if (g.state !== 'foot') { H.issue('findcar', 'high', 'could not get out of the car', {}, { key: 'fc-exit' }); return res; }
        const F = g.foot, car = { x: P.x, z: P.z };
        // walk ~80 m along the street, on the sidewalk
        const ne = g.nav.index.nearest(F.x, F.z, 50), e = ne.edge, dir = (e.dirx * P.fx + e.dirz * P.fz) > 0 ? 1 : -1;
        const side = ((F.x - ne.cx) * e.nx + (F.z - ne.cz) * e.nz) >= 0 ? 1 : -1, off = (e.halfW ?? 4) + 1.6;
        await walkTo(H, ne.cx + e.dirx * dir * 80 + e.nx * side * off, ne.cz + e.dirz * dir * 80 + e.nz * side * off, { r: 4, timeout: 60 });
        await H.run(0.3);
        res.away = r1(Math.hypot(F.x - car.x, F.z - car.z));
        const chip = document.getElementById('car-finder'); res.chip = chip?.classList.contains('show') ? chip.textContent : null;
        g.routeToCar(); res.route = g.nav.route ? Math.round(g.nav.route.total) : null; const d0 = g.carDoor();
        res.routeEndsAtCar = g.nav.route ? r1(Math.hypot(g.nav.route.points.at(-1)[0] - d0.x, g.nav.route.points.at(-1)[1] - d0.z)) : null;
        g.toggleMap(true); await H.run(0.2); res.mapEntry = !!document.querySelector('#navlist [data-car=route]'); res.shotMap = await H.shot('findcar-map'); g.toggleMap(false);
        H.press('KeyL'); await H.run(0.4); res.beeped = !!g._fobT;
        H.press('KeyT'); await H.run(0.4); res.calledDist = r1(Math.hypot(P.x - F.x, P.z - F.z));
        res.shot = await H.shot('findcar-called');
        const d1 = g.carDoor(); await walkTo(H, d1.x, d1.z, { r: 2.2, timeout: 30 }); H.press('Enter'); await H.run(0.3); res.backIn = g.state === 'drive';
        const bad = []; if (!res.chip) bad.push('no HUD chip'); if (!res.route) bad.push('no route to the car'); if (res.routeEndsAtCar > 15) bad.push(`route ends ${res.routeEndsAtCar} m from the car`); if (!res.mapEntry) bad.push('no map entry'); if (!(res.calledDist < 25)) bad.push(`called car ${res.calledDist} m away`); if (!res.backIn) bad.push('could not get back in');
        if (bad.length) H.issue('findcar', 'high', `find the car: ${bad.join(', ')}`, {}, { shot: true, key: 'findcar' });
        return res;
    },
});
SCENARIOS.push({
    id: 'parking', group: 'r5', title: 'Illegal parking (traffic note 8): the tow leaves the car at a legal kerbside spot; a wheel clamp keeps the car still until "Pay fine"', city: 'bucharest',
    async run(H) {
        const g = H.g; await prep(H); const P = g.player, res = {};
        H.setControls(0, 0, true); await H.run(1); H.press('Enter'); await H.run(0.3);
        if (g.state !== 'foot') { H.issue('parking', 'high', 'could not get out of the car', {}, { key: 'pk-exit' }); return res; }
        const from = { x: P.x, z: P.z };
        g.onParkingEvent({ type: 'tow', fine: { amount: 1520, currency: 'RON', label: 'test tow' } }); await H.run(0.3);
        const chk = g.traffic.assessParking(P);
        res.tow = { moved: Math.round(Math.hypot(P.x - from.x, P.z - from.z)), kerb: !!g.lastTow?.kerb, legal: !chk.illegal, reasons: chk.reasons, edge: chk.edge?.type, lat: Math.round(Math.abs(chk.lat) * 10) / 10, hw: chk.edge?.halfW };
        res.shotTow = await H.shot('parking-tow');
        g.onParkingEvent({ type: 'clamp', fine: { amount: 1120, currency: 'RON', label: 'test clamp' } });
        const d1 = g.carDoor(); await walkTo(H, d1.x, d1.z, { r: 2.2, timeout: 120 }); H.press('Enter'); await H.run(0.3);
        res.inCar = g.state === 'drive';
        const c0 = { x: P.x, z: P.z }; H.setControls(1, 0, false); await H.run(3); H.setControls(0, 0, true);
        res.clampedMoved = Math.round(Math.hypot(P.x - c0.x, P.z - c0.z) * 10) / 10;
        res.payItem = g.pauseItems().some(i => i[0] === 'pay-clamp');
        g.togglePause(true); document.querySelector('#pause-menu [data-pa="pay-clamp"]')?.click(); await H.run(0.2);
        res.paid = !g.clamp && !g._pauseOpen;
        const c1 = { x: P.x, z: P.z }; H.setControls(0.6, 0, false); await H.run(1.5); H.setControls(0, 0, true); // (short: a kerb spot on a short side street)
        res.paidMoved = Math.round(Math.hypot(P.x - c1.x, P.z - c1.z));
        const bad = []; if (!res.tow.kerb || !res.tow.legal) bad.push(`tow spot not legal (${res.tow.reasons?.join(',')}, ${res.tow.edge})`); if (!res.inCar) bad.push('could not get back in');
        if (res.clampedMoved > 0.5) bad.push(`clamped car moved ${res.clampedMoved} m`); if (!res.payItem || !res.paid) bad.push('no "Pay fine" / clamp not removed'); if (!(res.paidMoved > 3)) bad.push(`after paying the car moved only ${res.paidMoved} m`);
        if (bad.length) H.issue('parking', 'high', `parking: ${bad.join(', ')}`, {}, { shot: true, key: 'parking' });
        return res;
    },
});
