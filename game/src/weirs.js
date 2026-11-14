// ============================================================================
//  WEIRS — mapped OSM `waterway=weir` lines in the sunken river channels, drawn as what the street-level review saw
//  (fidelity pass round 3, 2026-11-13; unirii-small / r2-world-river).
//
//  OSM gives the line (position, length); the channel review gives the water level of the polygon it crosses
//  (water-channel-review.js); the form is the class seen in an official panorama: a row of separate concrete blocks
//  standing a little out of the water across the whole channel. Block count, size and freeboard are estimates read by
//  eye (WEIR_REVIEW, stated per row); nothing is drawn for a weir without a row, and nothing is moved.
// ============================================================================
import { channelProfile } from './water-channel-review.js';

const WEIR_REVIEW = {
    unirii: {
        w1434558024: { channel: 'w174991904', line: [[44.425858, 26.104542], [44.426063, 26.104577], [44.426298, 26.104613]],
            blocks: 16, blockAlongM: 1.9, blockAcrossM: 1.2, freeboardM: 0.45, colour: '#b9b4a8',
            estimates: 'block count, size and freeboard read by eye; water level from the channel review',
            evidence: 'panorama NrlzOfq1HTfol_d90aJ3FA (44.426089, 26.104331) heading 95: a row of about sixteen low grey concrete blocks across the basin just downstream of the covered section' },
    },
};

/** env: { district, project(lat, lon) -> {x, z}, cellOf(x, z), rgb, keep(x, z), inWater(x, z) }  Returns an audit list.
 *  A block is drawn only where the game has open water (Unirii: the basin's west end is ground until the Piața Unirii era is decided). */
export function emitWeirs(env) {
    const rows = WEIR_REVIEW[env.district], out = []; if (!rows) return out;
    for (const [id, w] of Object.entries(rows)) {
        const prof = channelProfile(env.district, w.channel, null); if (!prof) { out.push({ id, drawn: 0, reason: 'channel without a reviewed water level' }); continue; }
        const pts = w.line.map(([lat, lon]) => { const q = env.project(lat, lon); return [q.x ?? q[0], q.z ?? q[1]]; });
        const segs = []; let L = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push([pts[i - 1], pts[i], L, l]); L += l; }
        const at = (s) => { for (const [a, b, s0, l] of segs) if (s <= s0 + l || b === pts[pts.length - 1]) { const t = Math.min(1, Math.max(0, (s - s0) / (l || 1))); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1])]; } };
        const col = env.rgb(w.colour), top = prof.water + w.freeboardM, bottom = prof.water - 1.0;
        let n = 0, dry = 0;
        for (let k = 0; k < w.blocks; k++) {
            const [x, z, ang] = at((k + 0.5) * L / w.blocks);
            if (!env.keep(x, z)) continue;
            if (env.inWater && !env.inWater(x, z)) { dry++; continue; }
            env.cellOf(x, z).solid.box(x, bottom, z, w.blockAcrossM, top - bottom, w.blockAlongM, ang, col); n++;
        }
        out.push({ id, drawn: n, notInWater: dry, lengthM: +L.toFixed(1), topM: +top.toFixed(2), estimated: true });
    }
    return out;
}
