// A mapped two-way street can have one physical lane. Reserve its continuous
// narrow section before entry; graph directions remain legal in both directions.
export class SharedLaneGate {
    constructor(edges) {
        this.byEdge = new Map(); this.groups = []; this.tails = new Map(); this.serial = 0; this.time = 0;
        const narrow = edges.filter(e => e.sharedLane && !e.oneway && !e.virtual);
        const candidates = new Set(narrow);
        const otherAt = (node, edge) => {
            const roads = node.edges.filter(e => !e.virtual && e.drivable !== false);
            if (roads.length !== 2) return null;
            const other = roads.find(e => e !== edge);
            return candidates.has(other) ? other : null;
        };
        for (const first of narrow) {
            if (this.byEdge.has(first)) continue;
            const group = { edges: [], occupants: new Map(), claims: new Map(), waiting: new Map() };
            this.groups.push(group);
            // Walk to an end first. A closed cycle uses the original edge as its seam.
            let edge = first, start = first.a; const seen = new Set([first]);
            for (;;) {
                const previous = otherAt(start, edge);
                if (!previous || seen.has(previous)) break;
                seen.add(previous); edge = previous; start = edge.a === start ? edge.b : edge.a;
            }
            for (;;) {
                if (this.byEdge.has(edge)) break;
                const sign = edge.a === start ? 1 : -1;
                this.byEdge.set(edge, { group, sign }); group.edges.push(edge);
                const end = sign > 0 ? edge.b : edge.a, next = otherAt(end, edge);
                if (!next) break;
                edge = next; start = end;
            }
        }
    }
    entry(edge, dir) { const info = this.byEdge.get(edge); return info && { group: info.group, sign: info.sign * dir }; }
    canPlace(edge, dir, vehicles, self = null) {
        const target = this.entry(edge, dir); if (!target) return true;
        const playerDirection = this.player ? target.group.occupants.get(this.player) : undefined;
        if (playerDirection !== undefined && playerDirection !== target.sign) return false;
        for (const other of vehicles) {
            if (other === self || other.inactive) continue;
            const current = this.entry(other.edge, other.dir);
            if (current?.group === target.group && current.sign !== target.sign) return false;
            const tail = this.tails.get(other);
            if (tail?.group === target.group && tail.sign !== target.sign && other.odo < tail.until) return false;
        }
        return true;
    }
    update(vehicles, player, time) {
        if (!this.groups.length) return;
        this.time = time; this.player = player;
        const live = new Set(vehicles);
        for (const group of this.groups) {
            group.occupants.clear();
            for (const [v, claim] of group.claims) {
                if (!live.has(v) || v.inactive || v._resp || time - claim.seen > 2 || (time - claim.granted > 4 && v.speed < .1)) group.claims.delete(v);
            }
            for (const [v, wait] of group.waiting) if (!live.has(v) || v.inactive || time - wait.seen > 2) group.waiting.delete(v);
        }
        for (const [v, tail] of this.tails) {
            if (!live.has(v) || v.inactive || v._resp || v.odo >= tail.until) this.tails.delete(v);
            else tail.group.occupants.set(v, tail.sign);
        }
        for (const v of vehicles) {
            if (v.inactive) continue;
            const current = this.entry(v.edge, v.dir);
            if (current) { current.group.occupants.set(v, current.sign); current.group.claims.delete(v); }
            const next = v.route?.[0], target = next && this.entry(next.e, next.dir);
            const end = v.dir > 0 ? v.edge.b : v.edge.a;
            // The front has committed to the shared mouth, even before its centre changes edge.
            if (target && v.edge.len - v.s < v.length / 2 + (end.radius || 3)) target.group.occupants.set(v, target.sign);
        }
        if (player) for (const group of this.groups) {
            for (const edge of group.edges) {
                const co = ((player.front ?? 2.2) - (player.rear ?? 2.2)) / 2;
                const dx = player.x + player.fx * co - edge.a.x, dz = player.z + player.fz * co - edge.a.z;
                const along = dx * edge.dirx + dz * edge.dirz, lateral = dx * edge.nx + dz * edge.nz;
                const halfL = (player.length || 4.4) / 2, halfW = (player.width || 1.8) / 2;
                const dot = player.fx * edge.dirx + player.fz * edge.dirz, cross = player.fx * edge.nx + player.fz * edge.nz;
                const aRadius = Math.abs(dot) * halfL + Math.abs(cross) * halfW;
                const lRadius = Math.abs(cross) * halfL + Math.abs(dot) * halfW;
                const y = .24 + (edge.ya || 0) + ((edge.yb || 0) - (edge.ya || 0)) * Math.max(0, Math.min(1, along / edge.len));
                if (Math.abs((player.y ?? .24) - y) > 2.5 || along + aRadius < 0 || along - aRadius > edge.len || Math.abs(lateral) > (edge.sharedLaneWidthM || edge.wR * 2 || 3.2) / 2 + lRadius) continue;
                const info = this.byEdge.get(edge);
                group.occupants.set(player, Math.abs(dot) < .5 ? 0 : Math.sign(dot) * info.sign); break;
            }
        }
    }
    canEnter(v, edge, dir) {
        const target = this.entry(edge, dir); if (!target) return true;
        const { group, sign } = target;
        if (group.occupants.has(v)) return true;
        const opposing = [...group.occupants].some(([other, direction]) => other !== v && direction !== sign);
        const old = group.claims.get(v);
        if (old?.sign === sign && !opposing) { old.seen = this.time; return true; }
        let wait = group.waiting.get(v);
        if (!wait || wait.sign !== sign) { wait = { sign, order: this.serial++, seen: this.time }; group.waiting.set(v, wait); }
        wait.seen = this.time;
        if (opposing) return false;
        for (const claim of group.claims.values()) if (claim.sign !== sign) return false;
        // Once an opposite request exists, let the admitted batch clear before
        // admitting more of the same direction. A busy approach cannot starve it.
        if (group.occupants.size && [...group.waiting.values()].some(value => value.sign !== sign)) return false;
        const first = [...group.waiting.values()].reduce((a, b) => !a || b.order < a.order ? b : a, null);
        if (!group.occupants.size && !group.claims.size && first?.sign !== sign) return false;
        group.claims.set(v, { sign, granted: this.time, seen: this.time }); group.waiting.delete(v);
        return true;
    }
    advance(v, from, fromDir, to, toDir, node) {
        const old = this.entry(from, fromDir), next = this.entry(to, toDir);
        if (old && old.group !== next?.group) this.tails.set(v, { ...old, until: v.odo + v.length / 2 + (node.radius || 3) + 1 });
    }
}
