// ============================================================================
//  AREA FENCES — perimeter fences that OSM maps as a `barrier=fence` tag on an area (a school or university ground), not
//  as a barrier way. The district packs keep no barrier tags, so these rows carry the live-OSM outline (fetched
//  2026-11-13, OSM API 0.6) of each fenced ground the backlog asked for. Position is OSM's; the look is a class model
//  (a 2 m dark-green welded-mesh fence: posts every 2.5 m, top and bottom rails, the mesh as four horizontal wires); height and post
//  pitch are estimates.
//  The fence is left out wherever the outline runs along a building wall (the wall is the boundary), crosses or runs on a
//  mapped road / footway (OSM puts the path on the outline: the fence is not drawn across it), and for 1.5 m either side
//  of a mapped `barrier=gate` node of the outline.
//
//  r2-districts-view-14 (Grozăvești): the 46 × 33 m pitch w678756216 (44.439984, 26.055778) lies inside the school ground
//  w813901657 (`amenity=school`, `barrier=fence`), whose south-east side it shares with Universitatea Artifex w813677026
//  (`amenity=university`, `barrier=fence`); both fences are drawn.
// ============================================================================
import { rgb } from './geobuild.js';

export const FENCE_MODEL = { heightM: 2, postEveryM: 2.5, estimates: ['heightM', 'postEveryM', 'mesh look'] };
export const AREA_FENCES = {
    'bucharest-grozavesti': [
        { id: 'w813901657', tags: 'amenity=school, barrier=fence', gates: [[44.440673, 26.0556944]],
            ring: [[44.4408332, 26.0560162], [44.4407621, 26.0560506], [44.4405908, 26.0561335], [44.4406334, 26.0563124], [44.4403618, 26.056442], [44.4403562, 26.0564309],
                [44.4402719, 26.0562647], [44.4397935, 26.0560916], [44.4399051, 26.0554623], [44.4398836, 26.0554075], [44.4400256, 26.0553019], [44.4403321, 26.0550653],
                [44.4404226, 26.0552324], [44.4405435, 26.0554554], [44.4406127, 26.0555832], [44.440673, 26.0556944], [44.4407356, 26.0558098]] },
        { id: 'w813677026', tags: 'amenity=university (Universitatea Artifex), barrier=fence', gates: [[44.4396298, 26.0573952]],
            ring: [[44.4401497, 26.0575676], [44.4399694, 26.0578362], [44.4396298, 26.0573952], [44.439549, 26.0572903], [44.4397935, 26.0560916], [44.4402719, 26.0562647],
                [44.4403562, 26.0564309], [44.4403618, 26.056442], [44.4406334, 26.0563124], [44.4405908, 26.0561335], [44.4407621, 26.0560506], [44.4408332, 26.0560162],
                [44.4409815, 26.0564986], [44.4407325, 26.056622], [44.4408602, 26.0571177], [44.4403232, 26.057388], [44.4403472, 26.0574512]] },
    ],
};

/** env: { key, project(lat, lon) -> {x, z}, cellOf, blocked(x, z, r) -> reason | null, wallAt(x, z) -> bool, baseY(x, z), addCollider(x, z, hw, angle, h, rec) } */
export function emitAreaFences(env) {
    const out = { fences: [], model: FENCE_MODEL };
    const rows = AREA_FENCES[env.key]; if (!rows) return out;
    const POST = rgb('#2f4a3a'), MESH = rgb('#3c5a48'), H = FENCE_MODEL.heightM, STEP = FENCE_MODEL.postEveryM;
    const drawn = new Set(); // an edge shared by two fenced grounds is drawn once
    for (const f of rows) {
        const P = f.ring.map(([la, lo]) => { const q = env.project(la, lo); return [q.x, q.z]; }), G = (f.gates || []).map(([la, lo]) => { const q = env.project(la, lo); return [q.x, q.z]; });
        const rec = { id: f.id, metres: 0, skipped: { wall: 0, path: 0, gate: 0, shared: 0 } };
        for (let i = 0; i < P.length; i++) {
            const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.3) continue;
            const key = [ax.toFixed(1), az.toFixed(1), bx.toFixed(1), bz.toFixed(1)], k1 = key.join(','), k2 = [key[2], key[3], key[0], key[1]].join(',');
            if (drawn.has(k1) || drawn.has(k2)) { rec.skipped.shared += L; continue; } drawn.add(k1);
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux, ang = Math.atan2(ux, uz);
            const n = Math.max(1, Math.round(L / STEP)), seg = L / n;
            let run = null; const runs = [];
            for (let k = 0; k < n; k++) { // one panel per post interval: kept or not
                const t = (k + 0.5) * seg, mx = ax + ux * t, mz = az + uz * t;
                const why = G.some(([gx, gz]) => Math.hypot(gx - mx, gz - mz) < 1.5 + seg / 2) ? 'gate'
                    : (env.wallAt(mx + nx * 0.7, mz + nz * 0.7) || env.wallAt(mx - nx * 0.7, mz - nz * 0.7)) ? 'wall'
                    : env.blocked(mx, mz, 0.4) ? 'path' : null;
                if (why) { rec.skipped[why] += seg; run = null; continue; }
                if (!run) { run = { t0: k * seg, t1: (k + 1) * seg }; runs.push(run); } else run.t1 = (k + 1) * seg;
            }
            for (const r of runs) {
                const len = r.t1 - r.t0, cx = ax + ux * (r.t0 + len / 2), cz = az + uz * (r.t0 + len / 2), y = env.baseY(cx, cz), c = env.cellOf(cx, cz);
                for (let t = r.t0; t <= r.t1 + 1e-6; t += seg) { const px = ax + ux * t, pz = az + uz * t; c.detail.box(px, env.baseY(px, pz), pz, 0.07, H, 0.07, 0, POST); }
                // rails and the welded mesh's horizontal wires (see-through, as the mesh reads from the street)
                for (const yy of [0.12, 0.5, 0.9, 1.3, 1.65, H - 0.05]) c.detail.box(cx, y + yy, cz, 0.035, yy === 0.12 || yy === H - 0.05 ? 0.05 : 0.025, len, ang, yy === 0.12 || yy === H - 0.05 ? POST : MESH);
                env.addCollider(cx, cz, len / 2, ang, H, { id: f.id });
                rec.metres += len;
            }
        }
        for (const k of Object.keys(rec.skipped)) rec.skipped[k] = +rec.skipped[k].toFixed(1);
        rec.metres = +rec.metres.toFixed(1); out.fences.push(rec);
    }
    return out;
}
