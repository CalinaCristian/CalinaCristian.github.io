// ============================================================================
//  WORLD PAINT SETUP — green raster, water lines, asphalt / kerb / marking colours, pad asphalt
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { clamp, makeRng } from './util.js';
import { rgb, shadeRgb } from './geobuild.js';
import { uncoveredWaterLine } from './water-lines.js';
import { pavedReviewAreas } from './ground-review.js';
import { Y, setProgress, shadeHex, tick, undelta } from './world-shared.js';

export async function buildPaintSetup(ctx) {
    const {
        CHAN, US, areas, cellOf, channelAreas, city, cutTrenches, data,
        distId, env, groundCutsAt, inArea, nodeArr, waterGrid,
    } = ctx;
    // green ground (district worlds, 2026-11-08): gardens, lawns, courtyards and the ground under the crowns, measured on
    // aerial imagery (data.green raster, build-data / tools/aerial/trees.py), as grass quads under everything paved —
    // the quarter's private gardens were bare grey ground. Runs merged across rows into rectangles.
    let greenQuads = 0;
    if (data.green?.rle) {
        const G = data.green, base = rgb(shadeHex(env.grass, 0.94)), gr = makeRng(4421);
        const open = new Map(); // "c:n" → {c, n, r0}
        const flush = (o, r1) => {
            const x0 = G.x0 + o.c * G.cx, x1 = G.x0 + (o.c + o.n) * G.cx, z0 = G.z0 + o.r0 * G.cz, z1 = G.z0 + r1 * G.cz;
            const k = 0.9 + gr() * 0.16, col = [Math.round(base[0] * k), Math.round(base[1] * (k + 0.02)), Math.round(base[2] * k)];
            const gq = cellOf((x0 + x1) / 2, (z0 + z1) / 2).grass;
            // (the aerial green raster also sees grass on the banks of open trenches, and lawn in the green water of a
            // sunken river channel: cut it out of them like the areas)
            const quad = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
            if (groundCutsAt(quad, x0, z0, x1, z1).length) { const cut = cutTrenches(quad, [[0, 1, 2], [0, 2, 3]]); if (cut.tris.length) gq.flatPoly(cut.pts, cut.tris, Y.grass + 0.004, col, 0.1); }
            else gq.flatQuad(x0, z0, x1, z0, x1, z1, x0, z1, Y.grass + 0.004, col, 0.1);
            greenQuads++;
        };
        let r = 0, c = 0, cur = 0; let rowRuns = [];
        // (owner, 2026-11-12, Unirii: "random green patches on the water") from the air a river is as green as a lawn, and
        // the raster marks cells on the Dâmbovița. No green cell is drawn on mapped water: the columns of a row that a
        // water polygon touches (on the cell row's top, middle or bottom line) are taken out of its runs.
        const waterAreas = areas.filter(a => a.kind === 'water').concat(pavedReviewAreas(city.id + '-' + distId, (la, lo) => city.proj(la, lo))); // (+ squares reviewed as paved: ground-review.js)
        let rowWater = null;
        const waterCols = () => { // sorted, merged [c0, c1) column spans of row r on water
            const spans = [];
            for (const f of [0.02, 0.5, 0.98]) {
                const z = G.z0 + (r + f) * G.cz;
                for (const a of waterAreas) {
                    if (z < a.z0 || z > a.z1) continue;
                    const xs = [];
                    for (const ring of a.rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                        const [xi, zi] = ring[i], [xj, zj] = ring[j];
                        if ((zi > z) !== (zj > z)) xs.push(xi + (xj - xi) * (z - zi) / (zj - zi));
                    }
                    xs.sort((p, q) => p - q);
                    for (let k = 0; k + 1 < xs.length; k += 2) spans.push([Math.floor((xs[k] - G.x0) / G.cx), Math.floor((xs[k + 1] - G.x0) / G.cx) + 1]);
                }
            }
            spans.sort((p, q) => p[0] - q[0]);
            const merged = [];
            for (const s of spans) { const last = merged[merged.length - 1]; if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else merged.push([s[0], s[1]]); }
            return merged;
        };
        const pushRun = (c0, n) => {
            if (waterAreas.length) {
                rowWater ??= waterCols();
                let a = c0; const end = c0 + n;
                for (const [w0, w1] of rowWater) {
                    if (w1 <= a) continue; if (w0 >= end) break;
                    if (w0 > a) rowRuns.push([a, w0 - a]);
                    a = Math.max(a, w1); if (a >= end) return;
                }
                if (a < end) rowRuns.push([a, end - a]);
            } else rowRuns.push([c0, n]);
        };
        const endRow = () => {
            const seen = new Set();
            for (const [c2, n2] of rowRuns) { const key = c2 + ':' + n2; seen.add(key); if (!open.has(key)) open.set(key, { c: c2, n: n2, r0: r }); }
            for (const [key, o] of open) if (!seen.has(key)) { flush(o, r); open.delete(key); }
            rowRuns = []; rowWater = null; r++; c = 0; cur = 0;
        };
        for (const v of G.rle) { if (v < 0) { endRow(); continue; } if (cur && v > 0) pushRun(c, v); c += v; cur ^= 1; }
        for (const o of open.values()) flush(o, r);
    }
    // Exact mapped water banks take precedence over fallback centreline widths.
    const waterLineAudit = [];
    for (const [lineIndex, l] of data.lines.entries()) {
        const source = data.lineSources?.[lineIndex], kind = data.lineKinds[l[0]], w = source?.widthM > 0 ? source.widthM : l[1] / 10, pts = source?.points?.length >= 2 ? source.points : undelta(l[3], 0);
        const airfield = kind === 'runway' || kind === 'taxiway';
        const audit = airfield ? null : { lineIndex, sourceId: source?.sourceId || `prepared-line:${lineIndex}`, kind, preparedWidthM: w, widthSource: source?.widthSource || 'legacy prepared width; raw provenance unavailable', sourceLengthM: 0, coveredByMappedWaterM: 0, renderedFallbackM: 0, unresolvedBoundaryM: 0, mappedSources: [] };
        if (audit) waterLineAudit.push(audit);
        const col = rgb(kind === 'runway' ? '#4f5156' : kind === 'taxiway' ? '#5d5f63' : env.water);
        const y = kind === 'runway' || kind === 'taxiway' ? Y.parking + 0.012 : Y.water - 0.005;
        for (let i = 0; i < pts.length - 1; i++) {
            const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
            const nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2;
            const tgt = kind === 'runway' || kind === 'taxiway' ? cellOf(ax, az).pave : cellOf(ax, az).water;
            const inChan = channelAreas.length && kind !== 'runway' && kind !== 'taxiway' && channelAreas.find(c2 => inArea(c2, (ax + bx) / 2, (az + bz) / 2)); // (the river line inside the sunken channel)
            let spans = [{ a: [ax, az], b: [bx, bz], length: L }];
            if (audit) {
                const candidates = new Set(); waterGrid.each(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), area => candidates.add(area));
                const selection = uncoveredWaterLine([ax, az], [bx, bz], [...candidates]); spans = selection.outside;
                // A known bank plus an explicitly unmeasured width cannot justify
                // painting land at a conflicting source endpoint. Keep the source
                // line and report that unresolved span, using the mapped surface.
                if (selection.covered.length && source?.widthSource?.startsWith('estimate:')) { audit.unresolvedBoundaryM += spans.reduce((sum, span) => sum + span.length, 0); spans = []; }
                audit.sourceLengthM += L; audit.coveredByMappedWaterM += selection.coveredLength;
                audit.renderedFallbackM += spans.reduce((sum, span) => sum + span.length, 0);
                for (const source of selection.covered.flatMap(span => span.sourceIds)) if (!audit.mappedSources.includes(source)) audit.mappedSources.push(source);
            }
            for (const span of spans) { const [x0, z0] = span.a, [x1, z1] = span.b; tgt.flatQuad(x0 + nx, z0 + nz, x1 + nx, z1 + nz, x1 - nx, z1 - nz, x0 - nx, z0 - nz, inChan ? (inChan.chanProfile || CHAN).water - 0.01 : y, col, 0.05); }
            if (kind === 'runway') for (let s = 10; s < L - 10; s += 50) { const ux = (bx - ax) / L, uz = (bz - az) / L; const cx = ax + ux * s, cz = az + uz * s; const hw = 0.5, hl = 15; cellOf(cx, cz).marks.flatQuad(cx - uz * hw, cz + ux * hw, cx - uz * hw + ux * hl * 2, cz + ux * hw + uz * hl * 2, cx + uz * hw + ux * hl * 2, cz - ux * hw + uz * hl * 2, cx + uz * hw, cz - ux * hw, y + 0.02, rgb('#e8e8e8')); }
        }
    }

    // -----------------------------------------------------------------------
    //  ROADS
    // -----------------------------------------------------------------------
    setProgress('Paving the streets…'); await tick();
    // asphalt albedo (linear vertex colour): weathered asphalt is ≈ 0.09–0.15, so the road reads mid-grey in shade
    // and does not wash out in sun under ACES. Bucharest: lighter, sun-bleached, patched; Seattle: darker, wetter
    // asphalt, and Portland-cement concrete panels on the motorway main lines (I-5 / I-405 / SR-518).
    // (env.asphalt, the old near-black [7, 8, 9] in Seattle, is no longer used for carriageways)
    const ASPHALT = US ? '#535250' : '#5d5c5a', CONCRETE = '#7c7a76'; // (render's AgX + SH ambient target: albedo ≈ 0.08–0.12) // (slightly warm: the sky-lit shade is blue)
    const asphaltBase = rgb(ASPHALT), concreteCol = rgb(CONCRETE);
    const sideCol = shadeRgb(rgb(env.sidewalk), 0.8); // (QA r2: sidewalks read snow-white under AgX; paving albedo ≈ 0.3)
    const kerbCol = shadeRgb(rgb(env.sidewalk), 1.18);
    const white = rgb('#e9e9e6'), yellow = rgb('#e3b341'), busCol = rgb('#8a3b34'), railCol = rgb('#55524e'), ballastCol = rgb('#6d6861');
    const layerY = () => 0; // real heights are applied per vertex (node.y), see displace()
    const isConcrete = (e) => US && e.type === 'motorway';
    // US ramps: concrete where they leave / join the motorway (they overlap it at the gore), fading to asphalt over
    // 40–120 m along the ramp, so neither the gore nor the ramp terminal shows a two-colour slab (review #2)
    // distance along the ramps from the motorway (dM) and from the street network (dA): concrete at the motorway end,
    // asphalt at the street end, a smooth blend between (no light slab where an off-ramp meets an arterial deck)
    const rampDist = (seed) => {
        const dist = new Map(), q = [];
        for (const n of nodeArr) if (n.edges.some(seed)) { dist.set(n, 0); q.push(n); }
        while (q.length) {
            const n = q.shift(), d0 = dist.get(n);
            for (const e of n.edges) { if (e.type !== 'motorway_link' || e.virtual) continue; const o = e.a === n ? e.b : e.a, d = d0 + e.len; if (d < (dist.get(o) ?? Infinity) && d < 400) { dist.set(o, d); q.push(o); } }
        }
        return dist;
    };
    const dMot = US ? rampDist(isConcrete) : new Map(), dArt = US ? rampDist(e => !e.virtual && !/^motorway/.test(e.type)) : new Map();
    const mixCol = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
    const nodeSurf = (n) => {
        const m = dMot.get(n); if (m == null) return asphaltBase;
        const a = dArt.get(n) ?? 400, t = clamp((m - 25) / Math.max(1, m + a - 50), 0, 1);
        return mixCol(concreteCol, asphaltBase, t * t * (3 - 2 * t));
    };
    const asphaltOf = (e) => { // (one shade per class family: overlapping ribbons of one colour cannot flicker)
        if (e.unpaved) return rgb('#6b645b');
        if (isConcrete(e)) return e.tunnel ? shadeRgb(concreteCol, 0.85) : concreteCol;
        return e.tunnel ? shadeRgb(asphaltBase, 0.85) : asphaltBase;
    };
    /** [colour at a, colour at b] of a carriageway (ramps fade) */
    const asphaltEnds = (e) => (US && e.type === 'motorway_link' && !e.tunnel) ? [nodeSurf(e.a), nodeSurf(e.b)] : [asphaltOf(e), asphaltOf(e)];
    const padAsphalt = (n) => { const es = n.edges.filter(f => !f.virtual); const cc = es.filter(isConcrete).length; if (cc * 2 >= es.length && cc) return concreteCol; if (es.length && es.every(f => f.tunnel)) return shadeRgb(asphaltBase, 0.85); return es.some(f => f.type === 'motorway_link') ? nodeSurf(n) : asphaltBase; };
    return {
        ASPHALT, asphaltBase, asphaltEnds, ballastCol, concreteCol, isConcrete, kerbCol, layerY,
        padAsphalt, railCol, sideCol, waterLineAudit, white, yellow, get greenQuads() { return greenQuads; },
    };
}
