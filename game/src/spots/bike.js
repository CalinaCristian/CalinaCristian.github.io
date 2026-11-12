// ============================================================================
//  Rentable bikes at a docking station (Cișmigiu Gardens; first built for Herăstrău / King Michael I Park):
//  ride the park paths. A docking station with bikes; E rents one: the walker is parked and the camera rides a
//  city bike (W/S or ↑/↓ pedal / brake, A/D steer, Shift faster, mouse looks around); E again (anywhere walkable)
//  gets off at the actual last dry pose, and the bike stays standing there: E beside it gets back on (renting again at the
//  station brings it back). Ride 30 m and dismount to complete the activity. Collides with the scene, never rides into water.
//
//  Scene use:   import { addBikeRental } from '../bike.js';
//               addBikeRental(ctx, { x, z, heading, n: 6, name: 'I\'Velo', colour: '#d7262e' });
//  (x, z, heading: the station, heading = the way the docked bikes face, radians like headingFromBearing)
//  Returns { station, rides: () => number, riding: (s) => boolean }. The session's `riding` flag is true while on a bike.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { GeoBatch } from './kit.js';
import { collide } from './walker.js';
import { activityFlow } from './participation.js';

/** a city bike (frame, wheels, saddle, basket) in local coordinates: forward = −z, on the ground at y = 0 */
function bikeBatch(b, x, y, z, ry, colour, moving = false) {
    const c = Math.cos(ry), s = Math.sin(ry), P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    for (const wz of [-0.52, 0.52]) { // wheels: a thin torus-like ring of rods + hub
        const n = 14; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; b.rod(P(0, 0.34 + Math.cos(a0) * 0.33, wz + Math.sin(a0) * 0.33), P(0, 0.34 + Math.cos(a1) * 0.33, wz + Math.sin(a1) * 0.33), 0.022, '#1b1b1b', 'rubber', 5); }
        if (!moving) { b.rod(P(0, 0.34, wz - 0.3), P(0, 0.34, wz + 0.3), 0.006, '#9a9a9a', 'steel', 4); b.rod(P(0, 0.04, wz), P(0, 0.64, wz), 0.006, '#9a9a9a', 'steel', 4); }
    }
    const seat = P(0, 0.88, 0.2), head = P(0, 0.95, -0.4), bb = P(0, 0.32, 0.02);
    b.rod(P(0, 0.34, 0.52), seat, 0.022, colour, 'paint', 6); b.rod(seat, bb, 0.026, colour, 'paint', 6); b.rod(bb, head, 0.028, colour, 'paint', 6);
    b.rod(head, P(0, 0.34, -0.52), 0.022, colour, 'paint', 6); b.rod(P(0, 0.34, 0.52), bb, 0.02, colour, 'paint', 6);
    b.rod(head, P(0, 1.08, -0.42), 0.02, '#2a2a2a', 'metal', 6); b.rod(P(-0.27, 1.08, -0.4), P(0.27, 1.08, -0.4), 0.016, '#2a2a2a', 'metal', 6);
    b.boxC(...P(0, 0.93, 0.22), 0.14, 0.05, 0.26, '#1d1d1d', 'rubber', ry); b.boxC(...P(0, 0.88, -0.66), 0.32, 0.2, 0.24, '#2b2b2b', 'metal', ry); // saddle, basket
    b.boxC(...P(0, 0.62, 0.62), 0.12, 0.03, 0.34, colour, 'paint', ry); // rear mudguard plate (the rental colour)
}

export function addBikeRental(ctx, { x, z, heading = 0, n = 6, name = 'Bike rental', colour = '#d7262e', speed = 5.5, fast = 11 } = {}) {
    const g = ctx.ground, y0 = g.heightAt(x, z), fx = -Math.sin(heading), fz = -Math.cos(heading), rx = Math.cos(heading), rz = -Math.sin(heading);
    // ---- docking station: a row of stands + a pay terminal with the operator's colour
    const b = new GeoBatch();
    const slots = [];
    for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 0.8, sx = x + rx * o, sz = z + rz * o; slots.push({ x: sx, z: sz }); b.box(sx - fx * 0.75, y0, sz - fz * 0.75, 0.1, 0.8, 0.1, '#5b6066', 'metal', heading); bikeBatch(b, sx, y0, sz, heading, colour); }
    const tx = x + rx * ((n + 1) / 2 * 0.8), tz = z + rz * ((n + 1) / 2 * 0.8);
    b.box(tx, y0, tz, 0.45, 1.7, 0.3, '#30353a', 'metal', heading); b.boxC(tx - fx * 0.16, y0 + 1.45, tz - fz * 0.16, 0.42, 0.42, 0.02, colour, 'paint', heading);
    const dock = b.build('bike-dock'); ctx.add(dock);
    ctx.box(x, z, (n * 0.8) / 2 + 0.2, 0.9, heading, { prop: true, h: 1.1, y: y0 }); ctx.circle(tx, tz, 0.3, 1.7);
    ctx.lampPoints?.push?.({ x: tx, z: tz, noPost: true, h: 2 });
    // ---- the ridden bike (one mesh, shown while riding)
    const rb = new GeoBatch(); bikeBatch(rb, 0, 0, 0, 0, colour, true); const ride = rb.build('bike-ridden'); ride.visible = false; ride.userData.noFloor = true; ctx.add(ride);
    const wheels = [-.52,.52].map(z => { const b = new GeoBatch(); b.rod([0,-.3,0],[0,.3,0],.006,'#aaa','steel',4); b.rod([0,0,-.3],[0,0,.3],.006,'#aaa','steel',4); const m=b.build('bike-wheel-spokes');m.position.set(0,.34,z);ride.add(m);return m; });
    const pb=new GeoBatch();pb.rod([-.16,0,0],[.16,0,0],.018,'#777','steel',5);for(const side of [-1,1]){pb.rod([side*.13,0,0],[side*.13,side*.14,0],.016,'#777','steel',5);pb.boxC(side*.18,side*.14,0,.12,.025,.08,'#222','rubber');}const pedals=pb.build('bike-pedals');pedals.position.set(0,.32,.02);ride.add(pedals);
    const flow = activityFlow(ctx);
    let st = null, rides = 0, parked = null; // parked: where the bike was left ({ x, z, y, yaw }), until it is ridden again
    const stationIt = { kind: 'bike', x: x + fx * 1.4, z: z + fz * 1.4, r: 2.4, label: (s) => (st ? 'Dismount' : `Rent a bike — ${name}`), use: (s) => (st ? flow.cancel('station-return') : start(s)) };
    ctx.interactables.push(stationIt);
    // (owner, 2026-11-11: "the bike is lost when I dismount it, it should stay where I left it")
    const parkedIt = { kind: 'bike', noTour: true, x: 1e9, z: 1e9, r: 2.2, label: () => (parked && !st ? 'Get back on your bike' : ''), cond: () => !!parked && !st, use: (s) => start(s, true) };
    ctx.interactables.push(parkedIt);
    const start = (s, fromParked = false) => flow.begin(s, {
        title: 'Ride the park paths', action: 'Dismount', cameraRide: true,
        help: 'Pedal with W / ↑ or the touch stick; steer with A / D or the stick. Pedal and Brake buttons also work. Ride 30 m, then Dismount / E to finish; Leave or Esc cancels.',
        started(s,r) {
        const p = fromParked && parked ? { x: parked.x, z: parked.z, y: parked.y } : s.ctl.position, yaw0 = fromParked && parked ? parked.yaw : s.ctl.heading;
        parked = null; parkedIt.x = parkedIt.z = 1e9;
        st = { x: p.x, z: p.z, y: p.y, yaw: yaw0, v: 0, look: 0, pitch: -0.12, lean: 0, distance: 0, pedalSeconds: 0, push: 0, brake: 0 };
        s.riding = true; ride.visible = true; ride.position.set(p.x,p.y,p.z); ride.rotation.y=st.yaw; rides++;
        for(const[label,pressed]of[['Pedal',()=>{st.push=1.8;st.brake=0;}],['Brake',()=>{st.brake=1.2;st.push=0;}]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.bike=label.toLowerCase();button.onclick=pressed;r.ui.querySelector('nav').append(button);}
        },
        actioned(){if(st.distance>=30&&st.pedalSeconds>=3)flow.complete();else flow.cancel('dismount');},
        cancel(s){stop(s);},
        complete(s){stop(s);s._bucDone=s._bucDone||new Set();s._bucDone.add(s.spot.id+':bike');try{if(typeof window.game?.emit==='function')window.game.emit('activity',{spot:s.spot.id,id:'bike'});else window.dispatchEvent(new CustomEvent('dmcv:activity',{detail:{spot:s.spot.id,id:'bike'}}));}catch{}s.ui.toast('🚲 Park ride completed','You pedalled at least 30 m and dismounted on dry ground.');},
        update(dt,s,r){update(dt,s,r);},
    });
    const stop = (s) => {
        if (!st) return; s.riding = false;
        // the bike stands where the rider got off, half a metre to their right (or left; on the spot when both sides are
        // blocked or the ground falls away, as at the lake kerb)
        { const rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw); let bx = st.x, bz = st.z, by = st.y;
            for (const k of [0.55, -0.55]) { const x2 = st.x + rx * k, z2 = st.z + rz * k, y2 = g.groundAt(x2, z2, st.y + 0.5); if (Number.isFinite(y2) && Math.abs(y2 - st.y) < 0.1 && !(g.waterY != null && y2 < g.waterY - 0.3) && !collide(s.spot.colliders || [], x2, z2, 0.3, y2 + 0.3)) { bx = x2; bz = z2; by = y2; break; } }
            parked = { x: bx, z: bz, y: by, yaw: st.yaw }; ride.visible = true; ride.position.set(bx, by, bz); ride.rotation.set(0, st.yaw, 0.09, 'YXZ'); parkedIt.x = bx; parkedIt.z = bz; }
        // The rider has actually travelled here. Dismount/cancel keeps that
        // last dry pose; returning to a distant dock would be a teleport.
        const c=s.ctl;c.x=st.x;c.z=st.z;c.y=st.y;c.heading=st.yaw;c.pitch=st.pitch;c.vx=c.vz=0;c.vel=0;c.active=true;c.place?.();st=null;
    };
    const update = (dt, s, r) => {
        if (!st) return;
        const inp = s.input || {}, keys = inp.keys || new Set();
        st.push=Math.max(0,st.push-dt);st.brake=Math.max(0,st.brake-dt);
        const thr = st.push>0?1:(inp.throttle ?? ((keys.has('KeyW') || keys.has('ArrowUp')) ? 1 : 0)), brk = st.brake>0||keys.has('KeyS') || keys.has('ArrowDown') || (inp.throttle ?? 0) < 0 || inp.brake ? 1 : 0, steer = inp.steer ?? ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0));
        // Shift = sprint (stronger pedalling, higher top speed); S from a stop = push the bike backwards (round 6 note 17)
        const vmax = inp.shift ? fast : speed, REV = 1.8;
        if (thr > 0) st.v += Math.min(inp.shift ? 3.6 : 2.2, Math.max(0, (vmax - st.v) * 1.2)) * dt + (st.v < 0 ? 4 * dt : 0);
        else if (brk) st.v -= (st.v > 0.15 ? 5 : 1.6) * dt;
        st.v -= st.v * 0.18 * dt; if (!thr && !brk && Math.abs(st.v) < 0.05) st.v = 0;
        st.v = Math.max(-REV, Math.min(Math.max(vmax, st.v - 2.5 * dt), st.v)); // (over the cruise cap after a sprint: coast down)
        const sgn = st.v < 0 ? -1 : 1, av = Math.abs(st.v);
        const turn = sgn * steer * dt * (0.9 + 1.4 / (1 + av)) * Math.min(1, 0.4 + av / 3); st.yaw -= turn; st.lean += ((-steer * Math.min(1, Math.max(0, st.v) / 4)) * 0.22 - st.lean) * Math.min(1, dt * 4);
        const dfx = -Math.sin(st.yaw), dfz = -Math.cos(st.yaw); let nx = st.x + dfx * st.v * dt, nz = st.z + dfz * st.v * dt;
        let ny = g.groundAt(nx, nz, st.y + 0.5);
        if (!Number.isFinite(ny) || Math.abs(ny-st.y)>.6 || (g.waterY != null && ny < g.waterY - 0.3)) { st.v = 0; nx = st.x; nz = st.z; ny = st.y; } // a wall / steps up / water: stop
        const people=(s.spot.crowd?.obstacles(nx,nz,4)||[]).filter(o=>Math.abs((o.y??ny)-ny)<1.7).map(o=>({x:o.x,z:o.z,r:Math.hypot(o.width,o.length)/2,hw:o.width/2,hd:o.length/2,angle:Math.atan2(o.fx,o.fz),y0:o.y??ny,y1:(o.y??ny)+1.8}));
        const hit = collide(s.spot.colliders||[],nx,nz,.45,ny+.3)||collide(people,nx,nz,.45,ny+.3);
        if (hit) { nx += hit.px; nz += hit.pz; st.v *= 0.3; ny = g.groundAt(nx, nz, st.y + 0.5); if (!(ny < st.y + 0.6)) { nx = st.x; nz = st.z; ny = st.y; } }
        st.distance+=Math.hypot(nx-st.x,nz-st.z);if(thr>0&&!brk)st.pedalSeconds+=dt;
        st.x = nx; st.z = nz; st.y += (ny - st.y) * Math.min(1, dt * 12);
        wheels.forEach(m=>m.rotation.x-=st.v*dt/.33);if(thr>0&&!brk)pedals.rotation.x-=dt*(2+Math.abs(st.v));r.progress.value=Math.min(1,st.distance/30);r.status.textContent=`${Math.floor(st.distance)} / 30 m pedalled · ${st.distance>=30&&st.pedalSeconds>=3?'Dismount to finish':'keep to dry public paths'}`;
        // the walker follows (crowd reactions, interactions, sound) without moving the camera
        const c = s.ctl; c.x = st.x; c.z = st.z; c.y = st.y; c.heading = st.yaw; if ('vel' in c) c.vel = st.v; else if (!Object.getOwnPropertyDescriptor(Object.getPrototypeOf(c), 'speed')?.get) c.speed = st.v;
        ride.position.set(st.x, st.y, st.z); ride.rotation.set(0, st.yaw, st.lean, 'YXZ');
        const lk = inp.takeLook?.() || { dx: 0, dy: 0 }; st.look = Math.max(-2.2, Math.min(2.2, st.look - lk.dx * 0.0024)); st.pitch = Math.max(-0.9, Math.min(0.7, st.pitch - lk.dy * 0.0024));
        if (Math.abs(lk.dx) < 0.01) st.look *= Math.max(0, 1 - dt * 0.6); // the view drifts back to the road
        const bob = Math.sin(s.t * 7) * 0.012 * Math.min(1, st.v / 3);
        if (c.rig) { c.rig.position.set(st.x - dfx * 0.12, st.y + 1.62 + bob, st.z - dfz * 0.12); c.rig.rotation.set(st.pitch, st.yaw + st.look, st.lean * 0.5, 'YXZ'); }
    };
    return { station: dock, rides: () => rides, riding: () => !!st, parked: () => parked && { ...parked }, slots, debug: () => st && ({x:st.x,y:st.y,z:st.z,distance:st.distance,pedalSeconds:st.pedalSeconds,speed:st.v,wheelAngle:wheels[0].rotation.x,pedalAngle:pedals.rotation.x}) };
}
