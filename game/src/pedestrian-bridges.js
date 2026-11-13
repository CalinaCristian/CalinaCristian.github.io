// ============================================================================
//  PEDESTRIAN BRIDGES BY CLASS — footbridges / skybridges that the generic open truss of elevated-sources.js does not
//  fit (fidelity pass round 3, 2026-11-13). Position and length come from the OSM way (literal lat/lon nodes below,
//  © OpenStreetMap contributors, ODbL); the class is what an official street-level panorama shows (looked at only,
//  nothing stored). OSM carries no deck level, width or section for any of them: every dimension below is an ESTIMATE
//  and is repeated in the report (world.stats.pedestrianBridges).
//    'covered-glass'  concrete deck with a solid cream parapet band and a glazed pitched canopy on light steel frames
//                     (ASE, Piața Romană: 44.447532, 26.097783 h160 looking up)
//    'enclosed'       closed white corridor with a glazing band and a flat roof (Hilton wing skybridge, SeaTac:
//                     47.444099, -122.293207 h330)
//    'arched'         humped open footbridge with green steel railings, at street level at both ends (Regie footbridge
//                     over the Dâmbovița, 44.444677, 26.053527 h220)
//  Elevated decks (covered-glass, enclosed) join buildings at their ends: no stairs, no column on a carriageway. The arched
//  bridge lies in the scenery ring outside the playable area (no collision there); it is drawn in the near-only detail
//  layer so it costs nothing in far frames.
// ============================================================================

export const PEDESTRIAN_BRIDGES = {
    'bucharest-romana': [
        { id: 'w783025570', tags: { bridge: 'covered', highway: 'footway', layer: '1' }, cls: 'covered-glass', widthM: 3.2, soffitM: 5.2,
          nodes: [[44.447483, 26.097594], [44.447455, 26.097861], [44.447452, 26.097883], [44.447446, 26.097898], [44.447439, 26.097908], [44.447424, 26.097924]], pano: '44.447532, 26.097783 h160 (looking up)' },
        { id: 'w783025571', tags: { bridge: 'covered', highway: 'footway', layer: '1' }, cls: 'covered-glass', widthM: 3.2, soffitM: 5.2,
          nodes: [[44.447595, 26.098886], [44.447468, 26.098881]], pano: 'same class as w783025570 (not seen on its own)' },
        { id: 'w942676266', tags: { bridge: 'covered', highway: 'footway', layer: '1' }, cls: 'covered-glass', widthM: 3.2, soffitM: 5.2,
          nodes: [[44.447785, 26.097252], [44.447835, 26.097262]], pano: 'same class as w783025570 (not seen on its own)' },
    ],
    'seattle-seatac': [
        // corridor w1035290131 (highway=corridor, level 2) inside the man_made=bridge outline w1035290130 (about 4.7 m wide)
        { id: 'w1035290131', outline: 'w1035290130', tags: { bridge: 'yes', highway: 'corridor', indoor: 'yes', layer: '1', level: '2' }, cls: 'enclosed', widthM: 4.6, soffitM: 4.4,
          nodes: [[47.444342, -122.293417], [47.444340, -122.293077]], pano: '47.444099, -122.293207 h330' },
    ],
    'bucharest-grozavesti': [
        { id: 'w799487638', tags: { bridge: 'yes', highway: 'footway', layer: '1', type: 'moon bridge' }, cls: 'arched', widthM: 4.2, riseM: 1.6,
          nodes: [[44.444300, 26.053368], [44.444620, 26.053488]], pano: '44.444677, 26.053527 h220' },
    ],
};

// env: { dataset, proj(lat, lon) -> {x, z}, cellOf, rgb, groundAt(x, z) -> street level or null }
export function emitPedestrianBridges(env) {
    const list = PEDESTRIAN_BRIDGES[env.dataset] || [], report = { bridges: [], estimates: ['widthM', 'soffitM', 'riseM', 'parapet / canopy / corridor section'] };
    const C = env.rgb, CREAM = C('#ddd6c3'), CON = C('#bdb8ad'), GLASS = C('#9db6be'), FRAME = C('#c7cbcc'), WHITE = C('#e6e4de'), BAND = C('#7f97a2'), GREEN = C('#2f6a4b'), DECK = C('#a8a49b');
    for (const b of list) {
        const pts = b.nodes.map(([lat, lon]) => { const q = env.proj(lat, lon); return [q.x ?? q[0], q.z ?? q[1]]; });
        let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        let g = 0, n = 0; for (const p of pts) { const h = env.groundAt(p[0], p[1]); if (h != null) { g += h; n++; } }
        const ground = n ? g / n : 0, W = b.widthM, hw = W / 2, rec = { id: b.id, cls: b.cls, lengthM: +L.toFixed(1), widthM: W, groundM: +ground.toFixed(2), pano: b.pano };
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], q = pts[i], len = Math.hypot(q[0] - a[0], q[1] - a[1]); if (len < 0.05) continue;
            const ux = (q[0] - a[0]) / len, uz = (q[1] - a[1]) / len, nx = -uz, nz = ux, ang = Math.atan2(ux, uz);
            const P = (f, o, y) => [a[0] + ux * len * f + nx * o, y, a[1] + uz * len * f + nz * o];
            if (b.cls === 'covered-glass' || b.cls === 'enclosed') {
                const base = ground + b.soffitM, m = env.cellOf((a[0] + q[0]) / 2, (a[1] + q[1]) / 2).solid, mx = (a[0] + q[0]) / 2, mz = (a[1] + q[1]) / 2;
                m.box(mx, base, mz, W, 0.55, len + 0.02, ang, b.cls === 'enclosed' ? WHITE : CON); // deck slab
                if (b.cls === 'covered-glass') {
                    for (const s of [1, -1]) {
                        m.box(mx + nx * (hw - 0.1) * s, base + 0.55, mz + nz * (hw - 0.1) * s, 0.2, 1.1, len + 0.02, ang, CREAM); // parapet band
                        m.face4(P(0, (hw - 0.05) * s, base + 1.65), P(1, (hw - 0.05) * s, base + 1.65), P(1, (hw - 0.05) * s, base + 2.75), P(0, (hw - 0.05) * s, base + 2.75), GLASS, [nx * s, 0, nz * s]);
                        m.face4(P(1, (hw - 0.05) * s, base + 1.65), P(0, (hw - 0.05) * s, base + 1.65), P(0, (hw - 0.05) * s, base + 2.75), P(1, (hw - 0.05) * s, base + 2.75), GLASS, [-nx * s, 0, -nz * s]);
                        m.face4(P(0, (hw - 0.05) * s, base + 2.75), P(1, (hw - 0.05) * s, base + 2.75), P(1, 0, base + 3.45), P(0, 0, base + 3.45), GLASS, [nx * s * .6, .8, nz * s * .6]); // pitched roof
                        m.face4(P(1, (hw - 0.05) * s, base + 2.75), P(0, (hw - 0.05) * s, base + 2.75), P(0, 0, base + 3.45), P(1, 0, base + 3.45), GLASS, [-nx * s * .6, -.8, -nz * s * .6]);
                    }
                    const frames = Math.max(1, Math.round(len / 2.5));
                    for (let k = 0; k <= frames; k++) { const f = k / frames, c = P(f, 0, 0);
                        for (const s of [1, -1]) { const p = P(f, (hw - 0.05) * s, 0); m.box(p[0], base + 1.65, p[2], 0.08, 1.1, 0.08, ang, FRAME); m.box((p[0] + c[0]) / 2, base + 3.08, (p[2] + c[2]) / 2, hw, 0.07, 0.08, ang, FRAME); } }
                } else {
                    for (const s of [1, -1]) {
                        const o = (hw - 0.05) * s, wall = (y0, y1, col) => { m.face4(P(0, o, y0), P(1, o, y0), P(1, o, y1), P(0, o, y1), col, [nx * s, 0, nz * s]); m.face4(P(1, o, y0), P(0, o, y0), P(0, o, y1), P(1, o, y1), col, [-nx * s, 0, -nz * s]); };
                        wall(base + 0.55, base + 1.5, WHITE); wall(base + 1.5, base + 2.6, BAND); wall(base + 2.6, base + 3.4, WHITE);
                    }
                    m.box(mx, base + 3.4, mz, W + 0.3, 0.3, len + 0.02, ang, WHITE); // flat roof with a small overhang
                }
            } else if (b.cls === 'arched') {
                const d = env.cellOf((a[0] + q[0]) / 2, (a[1] + q[1]) / 2).detail, N = Math.max(6, Math.ceil(len / 2.5)), y = f => ground + 0.3 + b.riseM * 4 * f * (1 - f);
                for (let k = 0; k < N; k++) {
                    const f0 = k / N, f1 = (k + 1) / N, A = P(f0, hw, y(f0)), B = P(f1, hw, y(f1)), Cc = P(f1, -hw, y(f1)), D = P(f0, -hw, y(f0));
                    d.face4(A, B, Cc, D, DECK, [0, 1, 0]);
                    d.face4(D, Cc, B, A, CON, [0, -1, 0]); // soffit
                    for (const s of [1, -1]) {
                        const e0 = P(f0, hw * s, y(f0)), e1 = P(f1, hw * s, y(f1)), dn = p => [p[0], p[1] - 0.6, p[2]], up = (p, h) => [p[0], p[1] + h, p[2]];
                        d.face4(dn(e0), dn(e1), e1, e0, CON, [nx * s, 0, nz * s]); d.face4(dn(e1), dn(e0), e0, e1, CON, [-nx * s, 0, -nz * s]); // fascia
                        for (const [h0, h1] of [[1.0, 1.08], [0.12, 0.18]]) { d.face4(up(e0, h0), up(e1, h0), up(e1, h1), up(e0, h1), GREEN, [nx * s, 0, nz * s]); d.face4(up(e1, h0), up(e0, h0), up(e0, h1), up(e1, h1), GREEN, [-nx * s, 0, -nz * s]); }
                        const bal = Math.max(2, Math.round(len / N / 0.15));
                        for (let j = 0; j < bal; j++) { const fa = f0 + (f1 - f0) * (j + .45) / bal, fb = f0 + (f1 - f0) * (j + .55) / bal, p0 = P(fa, hw * s, y(fa)), p1 = P(fb, hw * s, y(fb)); d.face4(up(p0, .18), up(p1, .18), up(p1, 1.0), up(p0, 1.0), GREEN, [nx * s, 0, nz * s]); d.face4(up(p1, .18), up(p0, .18), up(p0, 1.0), up(p1, 1.0), GREEN, [-nx * s, 0, -nz * s]); }
                    }
                }
                rec.riseM = b.riseM;
            }
        }
        if (b.soffitM != null) rec.soffitM = b.soffitM;
        report.bridges.push(rec);
    }
    return report;
}
