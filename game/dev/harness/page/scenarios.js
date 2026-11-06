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
    if (d >= 11 || Math.abs(P.speed) >= 5) { H.issue('stop-unreachable', 'high', `could not stop within 11 m of the ${stop.id} door (closest ${r1(d)} m)`, { door: H.where(dx, dz) }, { shot: true, key: 'stop:' + stop.id }); res.ok = false; return res; }
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
    H.press('KeyE'); await H.run(0.5, () => g.state === 'drive');
    if (g.state !== 'drive') { H.issue('office-leave-failed', 'high', `could not leave the ${stop.id} office with E at the exit`, {}, { key: 'leave:' + stop.id }); o.done = true; await H.run(0.3); }
    res.visited = g.visited?.has(stop.id); res.ok = !!res.visited;
    if (!res.visited) H.issue('office-not-unlocked', 'high', `left the ${stop.id} office after reading a screen but the stop is not marked visited`, {}, { key: 'unlock:' + stop.id });
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
            const waitDrive = async (idx, ms = 240000) => { const t = performance.now(); while (!(g.state === 'drive' && g.chapterIdx === idx) && performance.now() - t < ms) { if (g.state === 'drive' || g.state === 'office') await H.run(0.2); else await sleep(100); } return g.state === 'drive' && g.chapterIdx === idx; };
            const waitCard = async (ms = 6000) => { const t = performance.now(); while (!chm.chapterCardOpen() && performance.now() - t < ms) { if (g.state === 'drive' || g.state === 'office') await H.run(0.1); else await sleep(60); } return chm.chapterCardOpen(); };
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
                const maxLen = ch.district === 'bellevue' ? 12000 : 2500;
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
];
