// Retaining walls with a rockery and a planted bank where a street lies below the road beside it (backlog seatac-6).
// Data © OpenStreetMap contributors (ODbL); levels: USGS 3DEP 1 m DEM (epqs.nationalmap.gov), sampled 2026-11-13.
//
// The district ground is flat: both streets stay at their own (equal) height and nothing is moved. Where a reviewed edge
// runs between them, a concrete wall stands at the back of the lower street's sidewalk, a rockery steps back from its
// top and a planted bank fills the strip up to the higher road's guard rail. The strip is found at load from the world's
// own surfaces: west from the lower street's carriageway, across its sidewalk (wall face), to the next carriageway.
//
// SeaTac, International Blvd (SR 99) west side between S 176th and S 170th St (game/research/seattle-seatac.md section 5):
// USGS has the boulevard at 107.9 m (47.4475) / 107.2 m (47.4460) and the Airport Expressway beside it 2.9 / 3.1 m higher,
// rising to an 8.6 m step at 47.4490 where the expressway climbs to its S 170th bridge; the reference shows a ~3 m concrete
// wall, rockery and planted bank under the expressway and the Link station. OSM maps no wall there. In the game the
// expressway lies at the boulevard's level 2–6 m away, so the full step cannot be drawn: the wall (1.4 m) and rockery
// (to 2.0 m) with shrubs on top (to about 3 m) give the boulevard side its measured height, and the expressway side sees
// a 2.0 m planted bank behind its guard rail; where the strip is under a metre the wall stands alone against the
// expressway's barrier. Wall, rockery and shrub sizes are estimates.
const RETAINING_BANKS = {
    seatac: [
        { id: 'seatac-intl-blvd-west', street: 'International Boulevard', side: 'west', from: [47.44875, -122.2963], to: [47.44545, -122.2963],
          wallH: 1.4, rockTopH: 2.0, bankBackH: 2.0, maxStripM: 9, review: 'USGS 3DEP steps 2.9–3.1 m (8.6 m at 47.4490); seattle-seatac.md section 5' },
    ],
};
const RETAINING_BANK_MODEL = { capW: 0.35, rockW: 0.9, step: 2, concrete: '#aaa69c', cap: '#b8b4aa', rock: ['#7b7366', '#8a8273', '#6e675c'], bank: '#5d7140', back: '#4f6236', shrub: ['#4b6a34', '#557a3a', '#44602f'] };

/** env: { district, proj(lat, lon) -> {x, z}, edges, onRibbon(x, z, r), raisedTop(x, z), buildingAt(x, z), cellOf(x, z), rgb,
 *  addCollider(x, z, hw, hd, angle, h, rec) }  Returns one audit record per run. */
export function emitRetainingBanks(env) {
    const out = [], M = RETAINING_BANK_MODEL;
    for (const run of RETAINING_BANKS[env.district] || []) {
        const a = env.proj(run.from[0], run.from[1]), b = env.proj(run.to[0], run.to[1]);
        const rec = { id: run.id, stations: 0, metres: 0, skipped: {}, stripM: [Infinity, 0] }, skip = (why) => { rec.skipped[why] = (rec.skipped[why] || 0) + 1; };
        const dir = Math.sign(b.z - a.z) || 1, west = run.side === 'west' ? -1 : 1;
        const streetEdges = env.edges.filter(e => !e.virtual && e.name === run.street && !e.bridge && !e.tunnel);
        // one cross-section per station: [xFace (back of the sidewalk), xBack (the other road's edge)] or null
        const section = (z) => {
            let xc = null;
            for (const e of streetEdges) {
                const z0 = Math.min(e.a.z, e.b.z), z1 = Math.max(e.a.z, e.b.z); if (z < z0 || z > z1 || z1 - z0 < 0.5) continue;
                const x = e.a.x + (e.b.x - e.a.x) * (z - e.a.z) / (e.b.z - e.a.z);
                if (xc === null || x * west > xc * west) xc = x;
            }
            if (xc === null) return skip('no-street'), null;
            let x = xc, k = 0;
            while (env.onRibbon(x, z, 0) && k++ < 120) x += west * 0.25;           // across the carriageway
            if (k >= 120) return skip('carriageway'), null;
            if (env.raisedTop(x + west * 0.3, z) === null) return skip('no-sidewalk'), null; // (a junction mouth or a driveway)
            k = 0; while (env.raisedTop(x, z) !== null && k++ < 40) x += west * 0.25; // across the sidewalk: the wall's face
            const xFace = x; k = 0;
            while (!env.onRibbon(x, z, 0) && k++ < run.maxStripM * 4) x += west * 0.25;
            const xBack = env.onRibbon(x, z, 0) ? x - west * 0.3 : xFace + west * 4; // (0.3 m clear of the other road's edge)
            const strip = (xFace - xBack) * -west;
            // the sidewalk meets the other road's edge (its barrier stands on that line): the wall takes the back 0.4 m of the
            // sidewalk, round the barrier, and stands alone
            if (strip < 0.25) return rec.closedM = (rec.closedM || 0) + M.step, [xFace - west * 0.4, xFace, true];
            if (env.buildingAt((xFace + xBack) / 2, z)) return skip('building'), null;
            return [xFace, xBack, strip < 1.0]; // (narrow: the wall alone, against the other road's barrier)
        };
        const len = Math.abs(b.z - a.z), n = Math.floor(len / M.step);
        let prev = null, prevZ = 0;
        const conc = env.rgb(M.concrete), capC = env.rgb(M.cap), bankC = env.rgb(M.bank), backC = env.rgb(M.back), rocks = M.rock.map(env.rgb), shrubs = M.shrub.map(env.rgb);
        const hash = (x, z, k) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
        // the profile closed off at the end of a run of slices (normal along ±z)
        let lastDrawn = false, lastThin = false;
        const endCap = (s0, zc, thin, nz) => {
            const [f, k] = s0, c = env.cellOf(f, zc).solid, cap = thin ? k : f + west * M.capW, r = cap + west * Math.min(M.rockW, Math.abs(k - cap) * 0.6);
            c.face4([f, 0, zc], [f, run.wallH, zc], [k, run.wallH, zc], [k, 0, zc], conc, [0, 0, nz]);
            if (!thin) c.face4([cap, run.wallH, zc], [r, run.rockTopH, zc], [k, run.bankBackH, zc], [k, run.wallH, zc], rocks[0], [0, 0, nz]);
        };
        for (let i = 0; i <= n; i++) {
            const z = a.z + dir * i * M.step, sec = section(z);
            if (sec && prev && !lastDrawn) endCap(prev, prevZ, prev[2] || sec[2], -dir);
            if (!(sec && prev) && lastDrawn) endCap(prev, prevZ, lastThin, dir);
            if (sec && prev && lastDrawn && (prev[2] || sec[2]) !== lastThin) endCap(prev, prevZ, false, lastThin ? -dir : dir); // (bank ↔ wall alone)
            lastDrawn = !!(sec && prev); if (lastDrawn) lastThin = prev[2] || sec[2];
            if (sec && prev) {
                const c = env.cellOf((sec[0] + prev[0]) / 2, (z + prevZ) / 2).solid, nOut = [-west, 0, 0];
                const [f0, k0, thin0] = prev, [f1, k1, thin1] = sec, thin = thin0 || thin1;
                const cap0 = thin ? k0 : f0 + west * M.capW, cap1 = thin ? k1 : f1 + west * M.capW;
                const r0 = cap0 + west * Math.min(M.rockW, Math.abs(k0 - cap0) * 0.6), r1 = cap1 + west * Math.min(M.rockW, Math.abs(k1 - cap1) * 0.6); // (rockery top line)
                const P = (x, y, zz) => [x, y, zz];
                c.face4(P(f0, 0, prevZ), P(f1, 0, z), P(f1, run.wallH, z), P(f0, run.wallH, prevZ), conc, nOut);                         // wall face
                c.face4(P(f0, run.wallH, prevZ), P(f1, run.wallH, z), P(cap1, run.wallH, z), P(cap0, run.wallH, prevZ), capC, [0, 1, 0]);  // coping
                if (thin) { // the wall alone: its back face down to the other road's barrier line
                    c.face4(P(cap0, run.wallH, prevZ), P(cap1, run.wallH, z), P(cap1, 0, z), P(cap0, 0, prevZ), conc, [west, 0, 0]);
                    env.addCollider((f0 + f1 + cap0 + cap1) / 4, (z + prevZ) / 2, Math.max(0.1, Math.abs((f0 + f1) / 2 - (cap0 + cap1) / 2) / 2), Math.abs(z - prevZ) / 2, 0, run.wallH, run);
                    rec.metres += Math.abs(z - prevZ); rec.stations++; rec.wallOnlyM = (rec.wallOnlyM || 0) + Math.abs(z - prevZ);
                    prev = sec; prevZ = z; continue;
                }
                c.face4(P(cap0, run.wallH, prevZ), P(cap1, run.wallH, z), P(r1, run.rockTopH, z), P(r0, run.rockTopH, prevZ), rocks[i % 3], [-west, 1, 0]); // rockery
                c.face4(P(r0, run.rockTopH, prevZ), P(r1, run.rockTopH, z), P(k1, run.bankBackH, z), P(k0, run.bankBackH, prevZ), bankC, [0, 1, 0]); // planted top
                c.face4(P(k0, run.bankBackH, prevZ), P(k1, run.bankBackH, z), P(k1, 0, z), P(k0, 0, prevZ), backC, [west, 0, 0]);          // back (earth) face
                // boulders on the rockery and shrubs on the bank (sizes / spacing estimates, placed by a position hash)
                for (let q = 0; q < 2; q++) {
                    const t = hash(f0, prevZ, q), zz = prevZ + (z - prevZ) * t, xr = cap0 + (r0 - cap0) * (0.3 + 0.4 * hash(f0, prevZ, q + 5)), s = 0.45 + 0.35 * hash(f0, prevZ, q + 9);
                    c.box(xr, run.wallH + (run.rockTopH - run.wallH) * 0.35 - s * 0.3, zz, s * 1.2, s, s, hash(f0, prevZ, q + 13) * 3, rocks[(i + q + 1) % 3]);
                }
                if (Math.abs(k0 - r0) > 0.6) {
                    const t = hash(k0, prevZ, 3), zz = prevZ + (z - prevZ) * t, xs = r0 + (k0 - r0) * (0.25 + 0.5 * hash(k0, prevZ, 4)), sh = 0.7 + 0.4 * hash(k0, prevZ, 6);
                    c.box(xs, run.rockTopH - 0.05, zz, Math.min(1.6, Math.abs(k0 - r0) * 0.8), sh, 1.5, 0, shrubs[i % 3]);
                }
                const xm = (f0 + f1 + k0 + k1) / 4, hw = Math.abs((f0 + f1) / 2 - (k0 + k1) / 2) / 2;
                env.addCollider(xm, (z + prevZ) / 2, hw, Math.abs(z - prevZ) / 2, 0, run.rockTopH, run);
                rec.metres += Math.abs(z - prevZ); rec.stations++;
                const w = Math.abs(f1 - k1); rec.stripM = [Math.min(rec.stripM[0], w), Math.max(rec.stripM[1], w)];
            }
            prev = sec; prevZ = z;
        }
        if (lastDrawn) endCap(prev, prevZ, lastThin, dir);
        rec.metres = Math.round(rec.metres); rec.stripM = rec.stripM.map(v => Number.isFinite(v) ? +v.toFixed(1) : null);
        out.push(rec);
    }
    return out;
}
