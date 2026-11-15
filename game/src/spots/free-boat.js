// A rowing boat / kayak you steer yourself (owner, 2026-11-15: "the boat rowing is dumb"; "it should be wasd to control,
// and go anywhere you want, exit anytime you want"; "or quick exit with E or whatever").
// W / ↑ row forward, S / ↓ back water, A / D turn (the touch stick works too), the mouse looks around. Anywhere on the
// lake's open water (its mapped shoreline, a clearance from the bank, the scene's own no-go zones: bridges, piers, the
// swimming area, moorings). E at any moment: a short fade and you stand on the nearest dry bank; the boat goes back to
// its landing. Optional goal: three buoys spread over the reachable water; touch all three for the activity (the ride
// goes on until you leave). The map, pause or photo mode only pause the ride (participation.js `ride`).
//
//   freeBoat(ctx, boat, { poly, holes, avoid, y, floatHeight, eye, home, approach, title, paddle, outfit, onDone, reach })
//     → { start(s), active(), buoys, debug() }
import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';
import { inPoly, distPolyline } from './kit.js';
import { collide } from './walker.js';

/** open water: inside the shoreline, clear of the bank, islands and the scene's no-go zones (pure; the harness tests it) */
export function waterTest(poly, { holes = [], avoid = () => false, clearance = 1.6 } = {}) {
    const shore = [...poly, poly[0]], rings = holes.map((h) => [...h, h[0]]), memo = new Map();
    // (memoised on a 5 cm grid: the flood fill and every frame ask about the same few points)
    return (x, z) => { const k = Math.round(x * 20) + ',' + Math.round(z * 20); let v = memo.get(k); if (v === undefined) { v = test(x, z); if (memo.size > 200000) memo.clear(); memo.set(k, v); } return v; };
    function test(x, z) { return inPoly(x, z, poly) && distPolyline(x, z, shore).d >= clearance && !holes.some((h) => inPoly(x, z, h)) && !rings.some((r) => distPolyline(x, z, r).d < clearance) && !avoid(x, z); }
}

/** three buoys spread over the water reachable from `from` (grid flood fill, `cell` m), within `reach` m of it */
export function placeBuoys(water, from, { reach = 160, cell = 3, n = 3 } = {}) {
    const key = (i, j) => i + ',' + j, P = (i, j) => [from.x + i * cell, from.z + j * cell], seen = new Set([key(0, 0)]), q = [[0, 0]], cells = [];
    if (!water(from.x, from.z)) return [];
    for (let h = 0; h < q.length && q.length < 9000; h++) {
        const [i, j] = q[h], [x, z] = P(i, j); cells.push([x, z]);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, k = key(a, b); if (seen.has(k)) continue; seen.add(k); const [px, pz] = P(a, b);
            if (Math.hypot(px - from.x, pz - from.z) <= reach && water(px, pz) && water((px + x) / 2, (pz + z) / 2)) q.push([a, b]); }
    }
    // farthest-point sampling from the start: each buoy as far as possible from the start and from the others
    const out = [], far = (c) => Math.min(Math.hypot(c[0] - from.x, c[1] - from.z), ...out.map((b) => Math.hypot(c[0] - b.x, c[1] - b.z)));
    for (let k = 0; k < n; k++) { let best = null, bd = -1; for (const c of cells) { const d = far(c); if (d > bd) { bd = d; best = c; } } if (!best || bd < 8) break; out.push({ x: best[0], z: best[1] }); }
    return out;
}

export function freeBoat(ctx, boat, { poly, holes = [], avoid = () => false, y, floatHeight = .25, eye = .72, home, approach, title = 'Rowing boat', paddle = 'oars', outfit = true, onDone = null, reach = 160, speed = 2.2, clearance = 1.6 } = {}) {
    const g = ctx.ground, flow = activityFlow(ctx), open = waterTest(poly, { holes, avoid, clearance });
    // (and inside the scene's detailed terrain: a big lake such as Lake Washington runs on far past it)
    const water = (x, z) => { const b = ctx.extras.terrainBox; return (!b || (x > b.x0 + 20 && x < b.x1 - 20 && z > b.z0 + 20 && z < b.z1 - 20)) && open(x, z); };
    boat.userData.noFloor = true; boat.position.set(home.x, y + floatHeight, home.z);
    const homePose = { p: boat.position.clone(), r: boat.rotation.clone(), visible: boat.visible };
    boat.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.side = THREE.DoubleSide; });
    if (outfit) { const inside = new THREE.MeshStandardMaterial({ color: '#b39366', roughness: .8 });
        const floor = new THREE.Mesh(new THREE.BoxGeometry(1.05, .045, 2.5), inside); floor.position.y = -.19; boat.add(floor);
        const rim = new THREE.Curve(); rim.getPoint = (t, v = new THREE.Vector3()) => v.set(Math.sin(t * Math.PI * 2) * .75, .025, Math.cos(t * Math.PI * 2) * 1.9);
        boat.add(new THREE.Mesh(new THREE.TubeGeometry(rim, 40, .035, 5, true), inside)); }
    const wood = new THREE.MeshStandardMaterial({ color: '#8c643f', roughness: .85 }), paddles = [];
    if (paddle === 'kayak') { const pivot = new THREE.Group(); pivot.name = 'kayak-paddle'; pivot.position.set(0, .45, .95);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 2.1, 6), wood); shaft.rotation.z = Math.PI / 2; pivot.add(shaft);
        const blade = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: .7 }); for (const side of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.42, .035, .18), blade); b.position.x = side * 1.08; pivot.add(b); }
        boat.add(pivot); paddles.push({ pivot, side: 1, kayak: true });
    } else for (const side of [-1, 1]) { const pivot = new THREE.Group(); pivot.name = 'rowing-oar'; pivot.position.set(side * .7, .15, 1.0);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.65, 6), wood); shaft.rotation.z = Math.PI / 2; shaft.position.x = side * .7;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(.5, .055, .18), wood); blade.position.x = side * 1.35; pivot.add(shaft, blade); boat.add(pivot); paddles.push({ pivot, side }); }
    // the buoys: an optional goal, only shown while you are on the water (game guides, not fixtures)
    const start0 = (() => { for (let r = 0; r <= 12; r += .5) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r; if (water(x, z)) return { x, z }; } return null; })();
    const buoyGroup = new THREE.Group(); buoyGroup.name = 'boat-buoys'; buoyGroup.visible = false; ctx.add(buoyGroup);
    const buoys = [];
    // placed on the first launch (the flood fill over the water costs a moment; never at scene load)
    const placeAll = () => { if (buoys.placed || !start0) return; buoys.placed = true; buoys.push(...placeBuoys(water, start0, { reach }).map((p, i) => { const m = new THREE.Group(); m.position.set(p.x, y, p.z); m.userData.noFloor = true;
        const mat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: .5, emissive: new THREE.Color('#f97316'), emissiveIntensity: .25 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(.35, 14, 10), mat); body.scale.y = .8; m.add(body);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.1, 6), new THREE.MeshStandardMaterial({ color: '#f5f5f4' })); pole.position.y = .6; m.add(pole);
        buoyGroup.add(m); return { ...p, i, mesh: m, mat, hit: false }; })); };
    /** the boat starts pointing at the longest run of open water (never nose-first into the landing) */
    const openHeading = (o) => { let best = 0, bl = -1; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; let l = 0; while (l < 40 && water(o.x + Math.sin(a) * (l + 1), o.z + Math.cos(a) * (l + 1))) l += 1; if (l > bl) { bl = l; best = a; } } return best; };
    let ride = null, rewarded = false;
    const fade = (s, then) => { const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .25s;pointer-events:none;z-index:40'; document.body.append(o);
        requestAnimationFrame(() => { o.style.opacity = '1'; }); setTimeout(() => { then(); o.style.opacity = '0'; setTimeout(() => o.remove(), 300); }, 260); };
    /** the nearest dry, free, walkable bank point to the boat (else the landing it started from) */
    const ashore = (s, x, z) => {
        const boundary = ctx.extras.walkBoundary, ok = (px, pz) => { const gy = g.groundAt(px, pz, g.heightAt(px, pz) + 1.2); return Number.isFinite(gy) && !(g.waterY != null && gy < g.waterY - .2) && gy > y - .05 && !inPoly(px, pz, poly) && (!boundary || boundary.inside(px, pz)) && !collide(s.spot.colliders || [], px, pz, .35, gy + .3); };
        for (let r = 2; r <= 40; r += 1) for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (ok(px, pz)) return { x: px, z: pz, heading: Math.atan2(px - x, pz - z) + Math.PI }; }
        return { x: approach.x, z: approach.z, heading: s.ctl.heading };
    };
    const restore = (s, pos) => {
        if (!ride) return; const back = pos || ride.back; boat.position.copy(homePose.p); boat.rotation.copy(homePose.r); boat.visible = homePose.visible; buoyGroup.visible = false;
        paddles.forEach(({ pivot }) => pivot.rotation.set(0, 0, 0)); ride = null;
        s.ctl.active = true; s.ctl.teleport(back.x, back.z, back.heading ?? s.ctl.heading); s.ctl.place?.();
    };
    return {
        buoys, active: () => !!ride, water,
        debug: () => ride && { x: ride.x, z: ride.z, yaw: ride.yaw, v: ride.v, hits: buoys.filter((b) => b.hit).length, buoys: buoys.length },
        start(s) {
            if (ride || !start0) return false;
            placeAll();
            return flow.begin(s, { title, action: 'Go ashore (E)', cameraRide: true, ride: true,
                help: `W / ↑ row, S / ↓ back water, A / D turn (or the touch stick); look with the mouse. Go anywhere on the open water. ${buoys.length ? `Optional: touch the ${buoys.length} orange buoys. ` : ''}E takes you ashore at any time.`,
                started(_s, r) {
                    const p = s.position; ride = { x: start0.x, z: start0.z, yaw: openHeading(start0), v: 0, look: 0, pitch: -.12, t: 0, stroke: 0, back: { x: p.x, z: p.z, heading: s.ctl.heading } };
                    rewarded = false; boat.visible = true; buoyGroup.visible = true; buoys.forEach((b) => { b.hit = false; b.mat.color.set('#f97316'); b.mat.emissive.set('#f97316'); });
                    r.status.textContent = buoys.length ? `0/${buoys.length} buoys · row anywhere, E to go ashore` : 'Row anywhere, E to go ashore';
                },
                actioned(_s, r) { r.busy = true; const at = ashore(s, ride.x, ride.z); fade(s, () => flow.cancel('ashore')); ride.exit = at; },
                update(dt, _s, r) {
                    if (!ride || ride.exit) return; ride.t += dt;
                    const inp = s.input || {}, keys = inp.keys || new Set();
                    const thr = inp.throttle ?? ((keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0));
                    const steer = inp.steer ?? ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0));
                    ride.v += (thr > 0 ? 1.1 : thr < 0 ? -.8 : 0) * dt; ride.v *= Math.exp(-.5 * dt); ride.v = Math.max(-1, Math.min(speed, ride.v)); if (!thr && Math.abs(ride.v) < .02) ride.v = 0;
                    ride.yaw -= steer * dt * (.55 + .25 * Math.min(1, Math.abs(ride.v)));
                    const fx = Math.sin(ride.yaw), fz = Math.cos(ride.yaw); let nx = ride.x + fx * ride.v * dt, nz = ride.z + fz * ride.v * dt;
                    if (!water(nx, nz)) { if (water(nx, ride.z)) nz = ride.z; else if (water(ride.x, nz)) nx = ride.x; else { nx = ride.x; nz = ride.z; ride.v *= -.25; } ride.v *= .7; } // the bank: slide along, else bump back
                    ride.x = nx; ride.z = nz;
                    if (thr) ride.stroke += dt * (1.6 + Math.abs(ride.v)); const ph = Math.sin(ride.stroke * Math.PI);
                    paddles.forEach(({ pivot, side, kayak }) => { pivot.rotation.y = side * ph * .5 * (thr ? 1 : 0); pivot.rotation.z = kayak ? ph * .6 * (thr ? 1 : 0) : 0; });
                    const bob = Math.sin(ride.t * 1.6) * .025;
                    boat.position.set(ride.x, y + floatHeight + bob, ride.z); boat.rotation.set(0, ride.yaw, Math.sin(ride.t * 1.1) * .015);
                    const lk = inp.takeLook?.() || { dx: 0, dy: 0 }; ride.look = Math.max(-2.4, Math.min(2.4, ride.look - lk.dx * .0024)); ride.pitch = Math.max(-.9, Math.min(.8, ride.pitch - lk.dy * .0024));
                    if (Math.abs(lk.dx) < .01 && thr) ride.look *= Math.max(0, 1 - dt * .5);
                    s.ctl.rig.position.set(ride.x, y + eye + bob, ride.z); s.ctl.rig.rotation.set(ride.pitch, ride.yaw + Math.PI + ride.look, 0, 'YXZ');
                    s.ctl.x = ride.x; s.ctl.z = ride.z; // (the minimap and the crowd follow the boat)
                    for (const b of buoys) { b.mesh.position.y = y + Math.sin(ride.t * 2 + b.i) * .05; if (!b.hit && Math.hypot(b.x - ride.x, b.z - ride.z) < 3.2) { b.hit = true; b.mat.color.set('#22c55e'); b.mat.emissive.set('#22c55e'); s.sound?.play?.('chime', .15); } }
                    const n = buoys.filter((b) => b.hit).length; r.progress.value = buoys.length ? n / buoys.length : 0;
                    r.status.textContent = `${n}/${buoys.length} buoys · ${Math.abs(ride.v).toFixed(1)} m/s · E to go ashore`;
                    if (buoys.length && n === buoys.length && !rewarded) { rewarded = true; onDone?.(s); }
                },
                cancel() { restore(s, ride ? ride.exit || ashore(s, ride.x, ride.z) : null); }, // (Leave / Esc also land on the nearest bank)
                complete() { restore(s); },
            });
        },
    };
}
