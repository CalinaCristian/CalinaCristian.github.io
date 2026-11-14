// Traffic methods (spec 13 R13.5; mixed into Traffic by mixin.js): closed waiting cycles of stopped vehicles. Box claims
// and "keep the box clear" prevent most of them; one that still forms (a lane change into a box, a long body's swing)
// is undone in view the way drivers undo it: one car of the ring backs up a few metres along its lane at walking pace,
// and the car that waited for it goes. No vehicle is moved out of sequence, hidden or passed through another.
import { playerExtent } from './traffic-shared.js';

/** A ring is broken once all of its cars have stood this long (s). */
const RING_STUCK_S = 15;
/** Longest ring followed (vehicles). */
const RING_MAX = 12;
/** Reversing: pace (m/s), longest distance (m), the clearance it keeps to whatever is behind (m). */
const BACK_SPEED = 1, BACK_MAX_M = 4, BACK_KEEP_M = 0.8;

export class TrafficKnots {
    /** once a second: closed leader cycles of stopped vehicles; the member with the most room behind it backs up */
    breakLeaderRings() {
        const P = this.player, seen = this._ringSeen || (this._ringSeen = new Set()); seen.clear();
        for (const v of this.vehicles) {
            if (seen.has(v) || v.inactive || v.parked || v.speed > 0.3 || (v.stuck || 0) < RING_STUCK_S) continue;
            const chain = []; let h = v;
            while (h && typeof h === 'object' && h !== P && !h.parked && !h.inactive && chain.length < RING_MAX && !chain.includes(h)) { chain.push(h); h = h.leader; }
            for (const o of chain) seen.add(o);
            const at = chain.indexOf(h); if (at < 0) continue;
            const ring = chain.slice(at);
            if (ring.length < 2 || ring.some(o => o.speed > 0.3 || (o.stuck || 0) < RING_STUCK_S || o.backT > 0)) continue;
            let best = null, room = 1.5 + BACK_KEEP_M;
            for (const o of ring) { if (o.tram) continue; const r = this.roomBehind(o); if (r > room) { room = r; best = o; } }
            if (!best) continue;
            best.backT = Math.min(BACK_MAX_M, room - BACK_KEEP_M) / BACK_SPEED; best.backYield = ring.find(o => o.leader === best) || null;
            this.stats.ringBacks = (this.stats.ringBacks || 0) + 1;
        }
    }
    /** stepVehicle: a car backing out of a ring reverses at walking pace, then lets the car that waited for it go */
    ringBackStep(v, dt) {
        if (!(v.backT > 0)) return false;
        v.backT -= dt;
        const floor = v.hist?.length ? -1.5 : 0.3;
        if (v.backT <= 0 || v.s - BACK_SPEED * dt < floor) {
            v.backT = 0; v.speed = 0;
            const o = v.backYield; v.backYield = null;
            if (o && !o.inactive) { v.yieldTo = o; v.yieldT = 4; }
            return false;
        }
        v.speed = -BACK_SPEED; v.zeroWhy = 'ringBack';
        return true;
    }
    /** free distance behind v's rear along its own axis (m), to vehicles, the player and walkers */
    roomBehind(v, look = 12) {
        const bx = Math.sin(v.heading), bz = Math.cos(v.heading), rx = -bz, rz = bx, half = v.length / 2;
        let room = look;
        const consider = (x, z, ext, latExt) => {
            const dx = x - v.x, dz = z - v.z, f = dx * bx + dz * bz, l = dx * rx + dz * rz;
            if (f <= 0 || Math.abs(l) > v.width / 2 + latExt + 0.3) return;
            room = Math.min(room, f - half - ext);
        };
        this.grid.query(v.x + bx * (half + look / 2), v.z + bz * (half + look / 2), look / 2 + 10, (o) => {
            if (o === v || o.inactive || Math.abs(o.y - v.y) > 2) return;
            const ofx = -Math.sin(o.heading), ofz = -Math.cos(o.heading);
            const ext = Math.abs(ofx * bx + ofz * bz) * o.length / 2 + Math.abs(ofx * rx + ofz * rz) * o.width / 2;
            const lat = Math.abs(ofx * rx + ofz * rz) * o.length / 2 + Math.abs(ofx * bx + ofz * bz) * o.width / 2;
            consider(o.x, o.z, ext, lat);
        });
        const P = this.player;
        if (P && Math.abs((P.y ?? 0.24) - v.y) < 2.5) consider(P.x, P.z, playerExtent(P, bx, bz), playerExtent(P, rx, rz));
        this.peds?.grid.query(v.x + bx * (half + look / 2), v.z + bz * (half + look / 2), look / 2 + 2, (p) => consider(p.x, p.z, 0.4, 0.4));
        // its own lane behind: at most just over the node it came over (as a knot's follower backs)
        return Math.min(room, v.s - 0.3 + (v.hist?.length ? 1.5 : 0));
    }
}
