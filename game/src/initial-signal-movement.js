import {canTravel} from './nav.js';

// A newly spawned body can already be between the entry and exit heads of one
// split controller. Prove ownership through literal directed source joins in
// both directions. Unknown entry phase is deliberately NOT inferred from angle.
export function initialSignalMovement(v, allowsTurn = () => true, limit = 100) {
    const source = e => e && !e.rail && typeof e.access?.sourceId === 'string' &&
        Number.isFinite(e.len) && e.len > 0 && e.a?.sourceId != null && e.b?.sourceId != null;
    const valid = r => r && !r.uturn && source(r.e) && (r.dir === 1 || r.dir === -1) && canTravel(r.e, r.dir);
    if (v.inactive || v.parked || v.tram || v.isPolice || (v.odo || 0) !== 0 || (v._moveGeneration || 0) !== 0 ||
        !Number.isFinite(v.s) || v.s < 0 || !valid({e:v.edge,dir:v.dir}) || v.s > v.edge.len) return null;
    const steps = [{e:v.edge,dir:v.dir}, ...(v.route || [])];
    let previous = null, distance = 0, controller = null;
    for (const r of steps) {
        if (!valid(r)) return null;
        const begin = r.dir > 0 ? r.e.a : r.e.b, end = r.dir > 0 ? r.e.b : r.e.a;
        if (previous && (begin !== previous.node || !allowsTurn(previous.step.e, previous.step.dir, r.e, r.dir))) return null;
        distance += r.e.len;
        if (distance > limit) return null;
        if (end.lightCluster) { controller = end.lightCluster; break; }
        if (end.hasLight) return null;
        previous = {node:end,step:r};
    }
    if (!controller) return null;
    let visits = 0;
    const origins = new Set();
    function upstream(n, next, travelled, seen) {
        if (++visits > 256 || travelled > limit || seen.size > 32) return false;
        if (n.lightCluster) { if (n.lightCluster !== controller) return false; origins.add(n); return true; }
        if (n.hasLight || !Array.isArray(n.edges) || !n.edges.includes(next.e)) return false;
        let count = 0;
        for (const e of n.edges) {
            if (e === next.e) continue;
            if (e.a !== n && e.b !== n) return false;
            const dir = e.b === n ? 1 : -1;
            if (!canTravel(e,dir) || !allowsTurn(e,dir,next.e,next.dir)) continue;
            if (!source(e) || seen.has(e)) return false;
            count++;
            const trail = new Set(seen); trail.add(e);
            if (!upstream(dir > 0 ? e.a : e.b,{e,dir},travelled+e.len,trail)) return false;
        }
        return count > 0;
    }
    if (!upstream(v.dir > 0 ? v.edge.a : v.edge.b,steps[0],v.edge.len,new Set([v.edge]))) return null;
    return {controller, origins:[...origins], phase:-1};
}
