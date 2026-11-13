// ============================================================================
//  Ballard Locks — the lock buildings (sea-spots-b-3), from the dossier's notes (seattle-spots.md "Ballard Locks": grey
//  concrete walls with arched openings, the Administration front; red tile hipped roofs, seen from the dam) and OSM:
//  - The 1915 buildings (Administration Building w51475867, Operating Houses w285289605 / w285289606 of 1914, and the
//    other lock buildings the scene styles alike) get a concrete wall tile with tall round-arched windows instead of the
//    generic apartment tile. The tile keeps the apartment tile's bay (3.2 m) and floor (3.0 m) so the wall UVs line up.
//  - The Control Tower (w223562285: man_made=tower, tower:type=observation, start_date 1969, the lock's VHF station
//    "Locks", seamark radio_station) is a concrete shaft on its mapped footprint under a glazed control cab with a flat
//    roof and a radio mast, instead of a generic hipped block.
//  - The Fish Ladder Viewing Room (n3413278212, wheelchair=yes, opening_hours 07:00–21:00) is reached through the mapped
//    tunnel (w285281016 / w764035002, layer −1) from the ramp (w285281015) and the steps (w285281017). The scene's ground
//    is one terrain surface, so the room is built apart from the scene (like the Carusel bar) and entered at the mapped
//    tunnel mouths: a dim concrete room with a row of windows into the ladder, salmon swimming past.
//  Window size / spacing, tower heights (shaft 9 m, cab 3 m), the room's size, the window count and the fish are estimates.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, canvas, canvasTexture, rng, inPoly } from '../kit.js';
import { facadeMaterial } from '../osm.js';
import { signBoard, fishMesh } from '../props.js';
import { offsetRing } from '../gable-plan.js';

export const LOCKS_1915 = 'ballard-1915';
export const CONTROL_TOWER = 'w223562285';

/** after ctx.osmBackdrop(): the arched-window concrete tile on every building drawn with style LOCKS_1915 */
export function locks1915Material() {
    const mat = facadeMaterial(LOCKS_1915); if (mat.userData.locks1915) return mat;
    const T = 256, C = T / 4, c = canvas(T, T), g = c.getContext('2d'), e = canvas(T, T), ge = e.getContext('2d'), r = rng(1915);
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, T, T); ge.fillStyle = '#000'; ge.fillRect(0, 0, T, T);
    for (let i = 0; i < 900; i++) { const v = 225 + Math.floor(r() * 25); g.fillStyle = `rgba(${v},${v},${v - 4},0.35)`; g.fillRect(r() * T, r() * T, 2 + r() * 5, 1 + r() * 3); } // board-formed concrete grain
    for (let fy = 0; fy < 4; fy++) for (let fx = 0; fx < 4; fx++) {
        const x0 = fx * C, y0 = (3 - fy) * C, ww = C * 0.42, wx = x0 + (C - ww) / 2, wb = y0 + C * 0.9, rr = ww / 2, wt = y0 + C * 0.2 + rr;
        const arch = (gg, pad) => { gg.beginPath(); gg.moveTo(wx - pad, wb + pad); gg.lineTo(wx - pad, wt); gg.arc(wx + rr, wt, rr + pad, Math.PI, 0); gg.lineTo(wx + ww + pad, wb + pad); gg.closePath(); gg.fill(); };
        g.fillStyle = 'rgba(255,255,255,0.9)'; arch(g, 3);                 // cast surround
        g.fillStyle = 'rgba(0,0,0,0.22)'; arch(g, 1);
        g.fillStyle = '#28323a'; arch(g, 0);                               // glass
        g.fillStyle = 'rgba(236,232,222,0.9)'; g.fillRect(wx + rr - 1, wt - rr, 2, wb - wt + rr); for (let k = 1; k < 4; k++) g.fillRect(wx, wt + (wb - wt) * k / 4, ww, 1.5); // muntins
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, y0 + C - 2, C, 2); // floor joint
        if (r() < 0.3) { ge.fillStyle = `rgb(255,${205 + r() * 30},${140 + r() * 40})`; ge.fillRect(wx + 2, wt, ww - 4, wb - wt - 2); }
    }
    mat.map?.dispose(); mat.emissiveMap?.dispose();
    mat.map = canvasTexture(c, { repeat: true }); mat.emissiveMap = canvasTexture(e, { repeat: true });
    mat.userData.locks1915 = true; mat.needsUpdate = true;
    return mat;
}

/** the Control Tower: shaft on the OSM footprint, glazed cab, flat roof, radio mast; returns stats */
export function controlTower(ctx) {
    const bd = ctx.data.buildings.find((q) => q.id === CONTROL_TOWER); if (!bd) return null;
    const g = ctx.ground, P = bd.poly, y0 = Math.max(...P.map(([x, z]) => g.heightAt(x, z))) - 0.3, b = new GeoBatch(); // (it stands on the lock wall: the lowest corner sample can fall into the chamber)
    const SH = 9, CAB = 3, grey = '#b4b1a7', cab = offsetRing(P, 0.45), roof = offsetRing(P, 0.9);
    b.prism(P, y0, y0 + SH, grey, 'concrete');
    b.prism(cab, y0 + SH, y0 + SH + 0.7, grey, 'concrete', { noTop: true });                 // sill band
    b.prism(cab, y0 + SH + 0.7, y0 + SH + CAB - 0.2, '#1d2a32', 'darkglass', { noTop: true }); // the glazed cab
    b.prism(roof, y0 + SH + CAB - 0.2, y0 + SH + CAB + 0.25, '#e9e7e1', 'paint', { bottom: true }); // flat roof slab
    let cx = 0, cz = 0; for (const [x, z] of P) { cx += x / P.length; cz += z / P.length; }
    for (let i = 0; i < cab.length; i++) { const [ax, az] = cab[i], [bx, bz] = cab[(i + 1) % cab.length], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.4));
        for (let k = 0; k < n; k++) { const t = k / n; b.box(ax + (bx - ax) * t, y0 + SH + 0.7, az + (bz - az) * t, 0.09, CAB - 0.9, 0.09, '#d9d6cf', 'paint'); } } // mullions
    // shaft windows: a slit per face on two floors
    for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
        let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (inPoly(mx + nx * 0.3, mz + nz * 0.3, P)) { nx = -nx; nz = -nz; }
        for (const y of [3.2, 6.2]) b.box(mx + nx * 0.04, y0 + y, mz + nz * 0.04, Math.min(2.2, L * 0.4), 1.3, 0.1, '#28323a', 'darkglass', Math.atan2(nx, nz)); }
    const top = y0 + SH + CAB + 0.25;
    b.cyl(cx, top, cz, 0.06, 4.5, '#5d6266', 'metal', 6); b.rod([cx - 0.6, top + 3.8, cz], [cx + 0.6, top + 3.8, cz], 0.025, '#5d6266', 'metal', 4); b.rod([cx, top + 3.2, cz - 0.5], [cx, top + 3.2, cz + 0.5], 0.025, '#5d6266', 'metal', 4);
    ctx.add(b.build('locks-control-tower'));
    ctx.poly(P, { y0: y0 - 1, y1: top });
    return { source: bd.id, top: +top.toFixed(2), shaft: SH, cab: CAB };
}

/** the Fish Ladder Viewing Room, apart from the scene, entered at the mapped tunnel mouths; returns stats */
export function fishLadderViewingRoom(ctx) {
    const d = ctx.data, poi = d.pois.find((p) => p.id === 'n3413278212'); if (!poi) return null;
    const way = (id) => d.ways.find((w) => w.id === id)?.pts || null, ramp = way('w285281015'), tunnel = way('w285281016'), steps = way('w285281017');
    const mouths = []; if (tunnel) mouths.push({ x: tunnel[0][0], z: tunnel[0][1] }); if (steps) { const s = steps[steps.length - 1], s0 = steps[0]; mouths.push(Math.hypot(s0[0] - poi.x, s0[1] - poi.z) > Math.hypot(s[0] - poi.x, s[1] - poi.z) ? { x: s0[0], z: s0[1] } : { x: s[0], z: s[1] }); }
    void ramp; if (!mouths.length) return null;
    // the room: 18 × 7 m, 3.2 m high, far below the scene's south edge (out of every view), windows along its north wall
    const RX = poi.x, RZ = poi.z + 2600, Y = 80, L = 18, D = 7, H = 3.2, room = new THREE.Group(); room.name = 'fish-ladder-viewing-room'; room.visible = false; ctx.add(room);
    const b = new GeoBatch(), floor = [[RX - L / 2, RZ - D / 2], [RX + L / 2, RZ - D / 2], [RX + L / 2, RZ + D / 2], [RX - L / 2, RZ + D / 2]];
    b.box(RX, Y - 0.3, RZ, L + 0.6, 0.3, D + 0.6, '#55534e', 'concrete'); b.box(RX, Y + H, RZ, L + 0.6, 0.25, D + 0.6, '#2c2d2e', 'concrete');
    b.box(RX, Y, RZ + D / 2 + 0.15, L + 0.6, H, 0.3, '#8d8a83', 'concrete'); for (const s of [-1, 1]) b.box(RX + s * (L / 2 + 0.15), Y, RZ, 0.3, H, D, '#8d8a83', 'concrete');
    // north wall: piers between six windows (2.4 × 2.2 m from 0.45 m), the ladder's water behind
    const NW = 6, WW = 2.4, zw = RZ - D / 2;
    for (let k = 0; k <= NW; k++) { const x = RX - L / 2 + (L / NW) * k; b.box(x, Y + 0.45, zw - 0.15, L / NW - WW, 2.2, 0.3, '#7d7a74', 'concrete'); } // (between sill and lintel: no overlapping faces)
    b.box(RX, Y, zw - 0.15, L, 0.45, 0.3, '#7d7a74', 'concrete'); b.box(RX, Y + 2.65, zw - 0.15, L, H - 2.65, 0.3, '#7d7a74', 'concrete');
    for (let k = 0; k < 3; k++) b.box(RX - 4 + k * 4, Y, RZ + 0.8, 2.6, 0.45, 0.5, '#6b4a2e', 'wood'); // benches
    room.add(b.build('fish-room'));
    const water = new THREE.Mesh(new THREE.BoxGeometry(L, 3.2, 3.6), new THREE.MeshStandardMaterial({ color: '#1c4f4c', emissive: new THREE.Color('#0f3b3a'), emissiveIntensity: 0.9, roughness: 0.9, side: THREE.BackSide }));
    water.position.set(RX, Y + 1.2, zw - 2.1); room.add(water);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.3), new THREE.MeshStandardMaterial({ color: '#7fb3b0', transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false })); glass.position.set(RX, Y + 1.55, zw - 0.02); room.add(glass);
    const light = new THREE.PointLight('#bfe3dc', 14, 14, 2); light.position.set(RX, Y + 2.8, RZ); room.add(light);
    const sg = signBoard('FISH LADDER VIEWING ROOM', 6, 0.5, { bg: '#1e2b2a', fg: '#e7efe9', font: (s) => `700 ${s}px Arial, sans-serif`, depth: 0.05 }); sg.position.set(RX, Y + 2.92, zw + 0.03); room.add(sg);
    // salmon swimming upstream past the windows (east → west), each on its own depth and bob
    const r = rng(1976), fish = [];
    for (let i = 0; i < 14; i++) { const f = fishMesh(); f.scale.setScalar(0.75 + r() * 0.35); f.rotation.y = -Math.PI / 2; room.add(f); fish.push({ f, x: r() * L, y: 0.5 + r() * 2.2, z: 0.6 + r() * 2.6, v: 0.25 + r() * 0.35, ph: r() * 6 }); }
    ctx.onUpdate((dt, s) => { if (!room.visible) return; for (const q of fish) { q.x = (q.x + q.v * dt) % L; q.f.position.set(RX + L / 2 - q.x, Y + q.y + Math.sin(s.t * 0.9 + q.ph) * 0.08, zw - q.z); q.f.rotation.z = Math.sin(s.t * 6 + q.ph) * 0.08; } });
    // walls and floor for the walker; enter / leave at the tunnel mouths
    ctx.ground.addPoly(floor, Y, Y - 2, { kind: 'fish-room-floor' });
    for (const [ax, az, bx, bz] of [[RX - L / 2, zw, RX + L / 2, zw], [RX + L / 2, zw, RX + L / 2, RZ + D / 2], [RX + L / 2, RZ + D / 2, RX - L / 2, RZ + D / 2], [RX - L / 2, RZ + D / 2, RX - L / 2, zw]])
        ctx.collider({ wall: true, kind: 'fish-room-wall', ax, az, bx, bz, intended: true /* drawn only while the room is shown */, y0a: Y - 1, y1a: Y + H, y0b: Y - 1, y1b: Y + H, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.5, nx: 0, nz: 0, hw: 0, hd: 0, angle: 0, poly: null, h: 0 });
    let back = null;
    for (const m of mouths) ctx.interactables.push({ x: m.x, z: m.z, r: 2.4, label: 'Go down to the Fish Ladder Viewing Room', cond: () => !room.visible,
        use: (s) => { back = { x: m.x, z: m.z, heading: s.ctl.heading }; room.visible = true; s.ctl.enter(RX + L / 2 - 1.6, RZ + 1.2, Math.PI / 2, Y); s.sound?.play?.('step'); } });
    ctx.interactables.push({ x: RX + L / 2 - 1.2, z: RZ + 1.2, y: Y, r: 2.0, label: 'Back up to the locks', cond: () => room.visible,
        use: (s) => { const p = back || mouths[0]; room.visible = false; s.ctl.enter(p.x, p.z, p.heading ?? 0, ctx.ground.heightAt(p.x, p.z)); } });
    ctx.onUpdate((dt, s) => { if (room.visible && Math.hypot(s.position.x - RX, s.position.z - RZ) > 40) room.visible = false; });
    // a name board at each mouth
    const mb = new GeoBatch(); for (const m of mouths) { const y = ctx.ground.heightAt(m.x, m.z); mb.cyl(m.x + 1.4, y, m.z, 0.05, 2.2, '#2f3a36', 'metal', 6); const s2 = signBoard('FISH LADDER VIEWING ROOM', 1.9, 0.4, { bg: '#1e2b2a', fg: '#e7efe9', font: (q) => `700 ${q}px Arial, sans-serif`, depth: 0.04 }); s2.position.set(m.x + 1.4, y + 2.0, m.z); s2.rotation.y = Math.atan2(poi.x - m.x, poi.z - m.z) + Math.PI / 2; ctx.add(s2); }
    ctx.add(mb.build('fish-room-mouths'));
    ctx.extras.fishLadderRoom = { mouths: mouths.map((m) => [+m.x.toFixed(1), +m.z.toFixed(1)]), room: [RX, RZ, Y], fish: fish.length };
    return ctx.extras.fishLadderRoom;
}
