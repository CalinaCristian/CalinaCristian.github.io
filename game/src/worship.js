// ============================================================================
//  PLACES OF WORSHIP — facade class (fidelity pass round 2, 2026-11-12).
//
//  The district `church` style used the eclectic window tile, so every church and synagogue read as a four-storey
//  house. A place of worship is drawn with a plain wall and a row of tall round-arched openings instead: one tall
//  storey, no window grid. This is a class appearance (what a nave wall looks like), not a likeness of any one church:
//  positions, footprints, heights and roof shapes stay the district data's. A tower / dome is only drawn where the
//  data has one (a building part, a roof shape, a tower tag): see `worshipHasTowerTag`.
// ============================================================================

const GLASS = [38, 46, 58], FRAME_K = .8;

// tags that say the mapped object itself has a tower or dome (the generic centroid cupola is kept only then)
export const worshipHasTowerTag = t => !!t && (/dome|onion|round|cone|spire/.test(t['roof:shape'] || '') || t['tower:type'] !== undefined || t.man_made === 'tower' || t['building:part'] === 'tower' || t.tower !== undefined);

// Tall round-arched openings on every wall of the ring long and high enough to carry one.
// mb: mesh builder; ring: [[x, z], ...]; ccw: signedArea(ring) > 0; y0 / top: wall base / eaves; wallCol: [r, g, b].
export function emitWorshipOpenings(mb, ring, ccw, y0, top, wallCol, skip = null) {
    const H = top - y0; if (!(H >= 4.2)) return 0;
    const frame = wallCol.map(v => Math.round(v * FRAME_K)); let n = 0;
    for (let k = 0; k < ring.length; k++) {
        if (skip && skip(k)) continue;
        const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 3.2) continue;
        let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
        const ux = (bx - ax) / L, uz = (bz - az) / L, count = Math.max(1, Math.round(L / 4.4)), pitch = L / count;
        const w = Math.min(1.25, pitch * .34, H * .16), sill = y0 + Math.max(1.5, H * .3), spring = Math.min(top - w / 2 - .7, sill + Math.max(1.6, H * .42)); if (spring - sill < 1.2) continue;
        for (let i = 0; i < count; i++) {
            const t = (i + .5) * pitch, cx = ax + ux * t, cz = az + uz * t;
            const arch = (hw, off, col, drop) => {
                const P = (du, y) => [cx + ux * du + nx * off, y, cz + uz * du + nz * off], out = [nx, 0, nz];
                mb.face4(P(-hw, sill - drop), P(hw, sill - drop), P(hw, spring), P(-hw, spring), col, out);
                const S = 6; for (let s = 0; s < S; s++) { const a0 = Math.PI * s / S, a1 = Math.PI * (s + 1) / S; mb.face3(P(0, spring), P(Math.cos(a0) * hw, spring + Math.sin(a0) * hw), P(Math.cos(a1) * hw, spring + Math.sin(a1) * hw), col, out); }
            };
            arch(w / 2 + .14, .04, frame, .12); arch(w / 2, .07, GLASS, 0); n++;
        }
    }
    return n;
}
