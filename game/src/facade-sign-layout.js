// Fit an inferred fascia along its existing source wall. Names/POIs are unchanged.
// Reserve complete opaque boards, including padding, instead of centre distances.
export function fitFacadeSign(wall, wanted, occupied) {
    const { ax, az, bx, bz } = wall, length = Math.hypot(bx - ax, bz - az);
    if (!(length > 0)) return null;
    const tx = (bx - ax) / length, tz = (bz - az) / length;
    const pad = wanted.pad ?? 0.25, edge = wanted.edge ?? 0.15, gap = wanted.gap ?? 0.08;
    let spans = [[edge, length - edge]];
    for (const board of occupied) {
        if (board.y1 <= wanted.y0 || board.y0 >= wanted.y1) continue;
        const dx = board.bx - board.ax, dz = board.bz - board.az, len = Math.hypot(dx, dz);
        if (!len || Math.abs((dx * tx + dz * tz) / len) < 0.98) continue;
        const normalDistance = Math.abs((board.ax - ax) * -tz + (board.az - az) * tx);
        if (normalDistance > 0.4) continue;
        const u = (board.ax - ax) * tx + (board.az - az) * tz, v = (board.bx - ax) * tx + (board.bz - az) * tz;
        const lo = Math.min(u, v) - gap, hi = Math.max(u, v) + gap;
        spans = spans.flatMap(([a, b]) => hi <= a || lo >= b ? [[a, b]] : [[a, Math.min(b, lo)], [Math.max(a, hi), b]].filter(([c, d]) => d > c));
    }
    let best = null;
    for (const [lo, hi] of spans) {
        const width = Math.min(wanted.width, hi - lo - 2 * pad);
        if (width < (wanted.minWidth ?? 0.6)) continue;
        const half = width / 2 + pad, centre = Math.max(lo + half, Math.min(hi - half, wanted.centre));
        // Prefer readable unshrunk text, then the closest point to its source anchor.
        const score = (wanted.width - width) * 4 + Math.abs(centre - wanted.centre);
        if (!best || score < best.score) best = { width, centre, score };
    }
    return best;
}

export function facadeSignBoard(mx, mz, tx, tz, width, y0, y1, label) {
    return { ax: mx - tx * width / 2, az: mz - tz * width / 2, bx: mx + tx * width / 2, bz: mz + tz * width / 2, y0, y1, label };
}
