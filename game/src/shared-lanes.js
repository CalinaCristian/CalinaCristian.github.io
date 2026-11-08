// A mapped two-way street can have one physical lane. Reserve its continuous
// narrow section before entry; graph directions remain legal in both directions.
export class SharedLaneGate {
    constructor(edges, bodySizes = []) {
        this.byEdge = new Map(); this.groups = []; this.tails = new Map(); this.serial = 0; this.time = 0;
        const narrow = edges.filter(e => e.sharedLane && !e.oneway && !e.virtual);
        const candidates = new Set(narrow);
        const clearance = sizes => Math.max(1.6, ...sizes.map(s => (s.length + s.width) / 2 + .6));
        const roadClearance = clearance(bodySizes.filter(s => s.transit !== 'tram')), railClearance = clearance(bodySizes);
        const adjacent = node => node.edges.filter(e => candidates.has(e));
        for (const first of narrow) {
            if (this.byEdge.has(first)) continue;
            const group = { edges: [], occupants: new Map(), claims: new Map(), waiting: new Map(), exclusive: false };
            this.groups.push(group);
            const pending = [first], found = new Set(), nodes = new Set();
            while (pending.length) {
                const edge = pending.pop(); if (found.has(edge)) continue;
                found.add(edge); group.edges.push(edge);
                for (const node of [edge.a, edge.b]) { nodes.add(node); for (const next of adjacent(node)) if (!found.has(next)) pending.push(next); }
            }
            group.bodyClearance = group.edges.some(e => e.tram) ? railClearance : roadClearance;
            const ends = [...nodes].filter(n => adjacent(n).length === 1);
            // A wider side road (including a private driveway) is an entry to the
            // same bottleneck, not a place where opposing bodies can pass.
            // Forks/cycles and blind ends have no single consistent flow: admit
            // one vehicle until its rear clears, including any necessary U-turn.
            const exit = node => node.edges.some(e => !candidates.has(e) && !e.virtual && e.drivable !== false && e.publicDrive !== false && e.throughAccess !== false && (!e.oneway || e.a === node) && !(e.a === node ? e.b : e.a).mapEnd);
            group.exclusive = ends.length !== 2 || [...nodes].some(n => adjacent(n).length > 2) || ends.some(n => !exit(n));
            if (group.exclusive) { for (const edge of found) this.byEdge.set(edge, { group, sign: 1 }); continue; }
            let start = ends[0], edge = adjacent(start)[0];
            for (;;) {
                const sign = edge.a === start ? 1 : -1;
                this.byEdge.set(edge, { group, sign });
                const end = sign > 0 ? edge.b : edge.a, next = adjacent(end).find(e => e !== edge);
                if (!next) break;
                edge = next; start = end;
            }
        }
    }
    entry(edge, dir) { const info = this.byEdge.get(edge); return info && { group: info.group, sign: info.sign * dir }; }
    mouthClearance(from, dir, to) {
        const target = this.byEdge.get(to); if (!target) return 1.6;
        const node = dir > 0 ? from.b : from.a, fx = -from.dirx * dir, fz = -from.dirz * dir;
        // A bus turning out can sweep past the centreline mouth before it aligns
        // with its own feeder lane. Keep the opposing queue outside that body
        // envelope from the outset, even if the bus has not arrived yet.
        const turns = node.edges.some(edge => {
            if (this.byEdge.get(edge)?.group !== target.group) return false;
            const entering = edge.b === node ? 1 : -1;
            return (edge.dirx * fx + edge.dirz * fz) * entering < .95;
        });
        return turns ? target.group.bodyClearance : 1.6;
    }
    canPlace(edge, dir, vehicles, self = null, pose = self) {
        const target = this.entry(edge, dir);
        if (!target) {
            // Do not seed/relocate a queue head inside the reserved turning
            // envelope. It could not make room without backing up in view.
            if (pose) {
                const node = dir > 0 ? edge.b : edge.a;
                for (const next of node.edges) if (this.byEdge.has(next)) {
                    const clearance = this.mouthClearance(edge, dir, next);
                    if (clearance > 1.6 && edge.len - pose.s - pose.length / 2 < (node.radius || 3) + clearance + .5) return false;
                }
            }
            return true;
        }
        const { group, sign } = target;
        const conflicts = direction => group.exclusive || direction !== sign;
        const playerDirection = this.player ? group.occupants.get(this.player) : undefined;
        if (playerDirection !== undefined && conflicts(playerDirection)) return false;
        for (const [other, claim] of group.claims) if (other !== self && !other.inactive && claim.generation === (other._moveGeneration || 0) && conflicts(claim.sign)) return false;
        for (const other of vehicles) {
            if (other === self || other.inactive) continue;
            const current = this.entry(other.edge, other.dir);
            if (current?.group === group && conflicts(current.sign)) return false;
            const tail = this.tails.get(other);
            if (tail?.group === group && tail.generation === (other._moveGeneration || 0) && conflicts(tail.sign) && other.odo < tail.until) return false;
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
                if (!live.has(v) || v.inactive || claim.generation !== (v._moveGeneration || 0) || time - claim.seen > 2 || (time - claim.granted > 4 && v.speed < .1)) group.claims.delete(v);
            }
            for (const [v, wait] of group.waiting) if (!live.has(v) || v.inactive || time - wait.seen > 2) group.waiting.delete(v);
        }
        for (const [v, tail] of this.tails) {
            if (!live.has(v) || v.inactive || tail.generation !== (v._moveGeneration || 0) || v.odo >= tail.until) this.tails.delete(v);
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
        const opposing = [...group.occupants].some(([other, direction]) => other !== v && (group.exclusive || direction !== sign));
        const old = group.claims.get(v);
        if (old?.sign === sign && !opposing) { old.seen = this.time; return true; }
        let wait = group.waiting.get(v);
        if (!wait || wait.sign !== sign) { wait = { sign, order: this.serial++, seen: this.time }; group.waiting.set(v, wait); }
        wait.seen = this.time;
        if (opposing) return false;
        for (const [other, claim] of group.claims) if (other !== v && (group.exclusive || claim.sign !== sign)) return false;
        // Once an opposite request exists, let the admitted batch clear before
        // admitting more of the same direction. A busy approach cannot starve it.
        if ((group.occupants.size || group.claims.size) && (group.exclusive || [...group.waiting.values()].some(value => value.sign !== sign))) return false;
        const first = [...group.waiting.values()].reduce((a, b) => !a || b.order < a.order ? b : a, null);
        if (!group.occupants.size && !group.claims.size && (group.exclusive ? first !== wait : first?.sign !== sign)) return false;
        group.claims.set(v, { sign, granted: this.time, seen: this.time, generation: v._moveGeneration || 0 }); group.waiting.delete(v);
        return true;
    }
    advance(v, from, fromDir, to, toDir, node) {
        const old = this.entry(from, fromDir), next = this.entry(to, toDir);
        if (old && old.group !== next?.group) this.tails.set(v, { ...old, generation: v._moveGeneration || 0, until: v.odo + v.length / 2 + (node.radius || 3) + 1 });
    }
}
