// Conservative simulation phases, not measured real-world signal timings. Each incoming
// road axis has its own phase. Opposing traffic shares green and yields through path
// reservations; a skew crossing must never fall into a binary 45° bucket.
// A controller over several nodes (a split junction, a square) runs its stages for the roads entering it from outside.
// A link between two of its own nodes (`internal(ap)`) gets no stage of its own: a car on it entered on the entry
// signal and clears the box on it; the head on the link shows the stage of the entry axis it lines up with best. Giving
// every inner link its own stage cut each approach's green to one slot in up to eight (Piața Romană, Piața Victoriei)
// and their queues drained at a few cars a minute.
export function assignSignalPhases(approaches, internal = null) {
    const groups = [];
    const inner = [];
    for (const ap of approaches) {
        const dir = ap.edge.b === ap.node ? 1 : -1;
        ap.fx = ap.edge.dirx * dir; ap.fz = ap.edge.dirz * dir;
        if (internal?.(ap)) { inner.push(ap); continue; }
        let phase = groups.findIndex(g => g.every(a => Math.abs(a.fx * ap.fx + a.fz * ap.fz) > Math.cos(Math.PI / 9)));
        if (phase < 0) { phase = groups.length; groups.push([]); }
        groups[phase].push(ap); ap.phase = phase;
    }
    for (const ap of inner) {
        let best = -1, bd = -Infinity;
        groups.forEach((g, i) => { for (const a of g) { const d = Math.abs(a.fx * ap.fx + a.fz * ap.fz); if (d > bd) { bd = d; best = i; } } });
        if (best < 0) { best = groups.length; groups.push([]); }
        groups[best].push(ap); ap.phase = best;
    }
    return Math.max(1, groups.length);
}

/** Longest whole cycle of a multi-node controller with stretched stages (s). */
const CYCLE_MAX_S = 60;
export function signalState(controller, phase, time, greenTime) {
    if (!Number.isInteger(phase) || phase < 0 || phase >= controller.phaseCount) return 'red';
    // A controller over three or more nodes (a square: Piața Romană, Piața Victoriei, Piața Unirii) runs longer stages,
    // as such squares do: each slot up to twice the base, the whole cycle no longer than CYCLE_MAX_S.
    if ((controller.nodes?.length || 0) >= 3) greenTime = Math.min(2 * greenTime, Math.max(greenTime, CYCLE_MAX_S / controller.phaseCount));
    const yellow = 2.2, clearing = 3, green = Math.max(4, greenTime - yellow - clearing);
    const slot = green + yellow + clearing, period = slot * controller.phaseCount;
    const t = ((time + controller.offset) % period + period) % period;
    if (Math.floor(t / slot) !== phase) return 'red';
    // Slow/stopped vehicles retain their reservation until their rear clears the whole
    // split junction. Do not release a conflicting green just because a timer elapsed
    // (traffic-step.js syncSignalOccupancy: only an occupant stalled in the box stops holding it).
    if (controller.occupiedPhases?.some(p => p !== phase)) return 'red';
    const local = t % slot;
    return local < green ? 'green' : local < green + yellow ? 'yellow' : 'red';
}
