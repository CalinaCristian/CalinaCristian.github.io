// Conservative simulation phases, not measured real-world signal timings. Each incoming
// road axis has its own phase. Opposing traffic shares green and yields through path
// reservations; a skew crossing must never fall into a binary 45° bucket.
export function assignSignalPhases(approaches) {
    const groups = [];
    for (const ap of approaches) {
        const dir = ap.edge.b === ap.node ? 1 : -1;
        ap.fx = ap.edge.dirx * dir; ap.fz = ap.edge.dirz * dir;
        let phase = groups.findIndex(g => g.every(a => Math.abs(a.fx * ap.fx + a.fz * ap.fz) > Math.cos(Math.PI / 9)));
        if (phase < 0) { phase = groups.length; groups.push([]); }
        groups[phase].push(ap); ap.phase = phase;
    }
    return Math.max(1, groups.length);
}

export function signalState(controller, phase, time, greenTime) {
    if (!Number.isInteger(phase) || phase < 0 || phase >= controller.phaseCount) return 'red';
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
