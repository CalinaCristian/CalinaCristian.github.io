// ============================================================================
//  AREAS AND WATER — cells, district bounds / mask, tram sweep, landuse areas, water grids, river channels, trench corridors and ground cuts, water / park triangulation
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { coveredWaterHulls, projectCoveredWater } from './final-water-topology.js';
import { pointInPolygon } from './util.js';
import { triangulate } from './triangulate.js';
import { makeVehicle } from './vehicles.js';
import { MeshBuilder, rgb } from './geobuild.js';
import { waterChannelDecision } from './water-channel.js';
import { districtTramSweep } from './tram-sweep.js';
import { decodeDistrictMask } from './district-boundary.js';
import { subtractConvex } from './building-overlap.js';
import { channelProfile } from './water-channel-review.js';
import { AREA_Y, BoxGrid, CELL, FOUNTAIN_COPING, GRASSY, PAVED, SPORT_KINDS, Y, setProgress, shadeHex, signedArea, tick, undelta } from './world-shared.js';

export async function buildAreasWater(ctx) {
    const {
        US, city, data, distCfg, distId, edges, env, nodes,
        str, tramGrades,
    } = ctx;
    const graph = { nodes, edges };

    // -----------------------------------------------------------------------
    //  CELLS (chunked static geometry)
    // -----------------------------------------------------------------------
    const cells = new Map();
    const builderEpoch = { n: 0 }; // (counts the cells' builders made: the map-end pass keeps its list of them until it changes)
    const cellOf = (x, z) => {
        const i = Math.floor(x / CELL), j = Math.floor(z / CELL), k = i * 10007 + j;
        let c = cells.get(k);
        if (!c) builderEpoch.n++;
        if (!c) cells.set(k, c = { i, j, solid: new MeshBuilder(true), roof: new MeshBuilder(), ground: new MeshBuilder(), area: new MeshBuilder(), grass: new MeshBuilder(), pave: new MeshBuilder(), sport: new MeshBuilder(), marks: new MeshBuilder(), road: new MeshBuilder(), pad: new MeshBuilder(), water: new MeshBuilder(), backdrop: new MeshBuilder(), detail: new MeshBuilder(true), signs: [] });
        return c;
    };
    const signMB = (c, page) => c.signs[page] || (builderEpoch.n++, c.signs[page] = new MeshBuilder());

    // bounds
    const [bx0, bz0, bx1, bz1] = data.bounds.map(v => v * 0.1);
    const pad = 40;
    const bounds = { minX: bx0 - pad, maxX: bx1 + pad, minZ: bz0 - pad, maxZ: bz1 + pad };
    // district inside-mask (20 m cells, RLE rows): where the player may drive; boundary walls follow its outline
    let dmask = decodeDistrictMask(data.district?.mask);
    // A tram body is one rigid 27 m / 36 m box and the rail guard covers it with discs, so on a bend it reaches outside
    // the straight literal corridor. Whatever this builder adds itself stays out of that sweep (tram-sweep.js); mapped
    // trees found inside it are recorded as source conflicts. No rail, actor or guard rule is changed.
    const tramSweep = districtTramSweep(data, { resolveGrade: tramGrades.resolveGrade, makeVehicle, city: city.id, inside: dmask ? (x, z) => !!dmask.at(x, z) : null });
    const tramSweepConflicts = { droppedGenerated: {}, wallPiecesCut: {}, closures: [], trees: [], pierTopsLowered: 0 };
    const sweptOut = (kind, hit) => { if (hit) tramSweepConflicts.droppedGenerated[kind] = (tramSweepConflicts.droppedGenerated[kind] || 0) + 1; return !!hit; };
    if (dmask) Object.assign(bounds, { minX: dmask.x0 - pad, minZ: dmask.z0 - pad, maxX: dmask.x0 + dmask.w * dmask.cell + pad, maxZ: dmask.z0 + dmask.h * dmask.cell + pad });

    // -----------------------------------------------------------------------
    //  AREAS (landuse, parks, water, parking)
    // -----------------------------------------------------------------------
    setProgress('Parks, rivers and lakes…'); await tick();
    const areaColors = {
        water: env.water, park: env.grass, grass: shadeHex(env.grass, 1.08), forest: shadeHex(env.grass, 0.78), scrub: '#7c8a58', pitch: '#5e9b4a', cemetery: '#71865f',
        residential: shadeHex(env.ground, 1.08), industrial: '#8e8a86', commercial: '#a39896', retail: '#a6999a', railway: '#857d74', construction: '#9c8e78',
        parking: '#5f6064', apron: '#8b8c8e', runway: '#505256', track: '#a7a39a', clay: '#c06a45', // (velodrome concrete; clay courts / tartan)
        turf: '#3f7f3c', hard: '#4f7f8f', pool: '#4fb0d6', yard: '#9a978c', // (artificial turf; acrylic / asphalt courts; outdoor pools; school / hospital / sports grounds)
    };
    const areas = [];
    const waterGrid = new BoxGrid(200), parkGrid = new BoxGrid(200);
    for (let areaIndex = 0; areaIndex < data.areas.length; areaIndex++) {
        const a = data.areas[areaIndex], kind = data.areaKinds[a[0]];
        const rings = kind === 'parking' && data.parkingFootprints?.[areaIndex] || a.slice(2).map(r => undelta(r, 0));
        const outer = rings[0]; if (!outer || outer.length < 3) continue;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        const area = { kind, areaIndex, sourceId: data.areaSourceIds?.[areaIndex] || '', parkingLayout: data.parkingLayouts?.[areaIndex] || null, name: str(a[1]), rings, outer, holes: rings.slice(1), x0, z0, x1, z1, size: Math.abs(signedArea(outer)) };
        areas.push(area);
        if (kind === 'water') waterGrid.insert(x0, z0, x1, z1, area);
        if (kind === 'park' || kind === 'forest' || kind === 'grass' || kind === 'cemetery') parkGrid.insert(x0, z0, x1, z1, area);
    }
    const inArea = (a, x, z) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1 && pointInPolygon(x, z, a.outer) && !a.holes.some(h => pointInPolygon(x, z, h));
    const isWater = (x, z) => { let w = false; waterGrid.each(x, z, x, z, (a) => { if (!w && inArea(a, x, z)) w = true; }); return w; };
    // nothing stands in water / fountain basins (play-test note 17): `m` = margin for the basin rim / coping
    const nearWater = (x, z, m = 1.5) => isWater(x, z) || (m > 0 && (isWater(x + m, z) || isWater(x - m, z) || isWater(x, z + m) || isWater(x, z - m)));
    const isPark = (x, z) => { let w = false; parkGrid.each(x, z, x, z, (a) => { if (!w && inArea(a, x, z)) w = true; }); return w; };
    const bigWater = new MeshBuilder();
    const waterChannelAudit = [];
    // (play-test note 11) the Dâmbovița runs in a straight concrete channel: water ≈ 4.4 m below the Splai, a lower
    // service bank (≈ 2 m) above the waterline, a sloped / vertical concrete wall up to the quay, a parapet + railing
    const CHAN = { water: -4.4, bank: -3.2, bankW: 2.0, slope: 0.9 }, channelAreas = [];
    // flat ground layers do not write depth (drawn first, in this order) → no z-fighting, sunken roads stay visible
    const AREA_ORDER = ['residential', 'industrial', 'commercial', 'retail', 'railway', 'construction', 'yard', 'cemetery', 'grass', 'scrub', 'forest', 'park', 'track', 'pitch', 'turf', 'clay', 'hard', 'pool', 'parking', 'apron', 'runway', 'water'];
    areas.sort((p, q) => AREA_ORDER.indexOf(p.kind) - AREA_ORDER.indexOf(q.kind));
    // (owner, 2026-11-11, Unirii (-425, -27): "car drives under grass") The ground layers keep their depth so vehicles in
    // covered tunnels cannot show through; but a grass / landuse / paved polygon mapped across an OPEN trench (a road
    // sunk below the street, not a tunnel) then covered the trench, its road and its traffic. Those layers are cut out of
    // every open sunken carriageway corridor (the carriageway plus 0.6 m each side). Tunnels stay covered.
    const trenchQuads = [];
    for (const e of edges) {
        if (e.virtual || e.tunnel || !(Math.min(e.ya ?? 0, e.yb ?? 0) < -0.4)) continue;
        const wl = (e.wL ?? 4) + 0.6, wr = (e.wR ?? 4) + 0.6, ex = e.dirx * 0.3, ez = e.dirz * 0.3;
        const q = [[e.a.x - ex + e.nx * wr, e.a.z - ez + e.nz * wr], [e.b.x + ex + e.nx * wr, e.b.z + ez + e.nz * wr], [e.b.x + ex - e.nx * wl, e.b.z + ez - e.nz * wl], [e.a.x - ex - e.nx * wl, e.a.z - ez - e.nz * wl]];
        const xs = q.map(v => v[0]), zs = q.map(v => v[1]);
        trenchQuads.push({ q, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
    }
    // (owner, 2026-11-12, Grozăvești (102, -229): "i can randomly see water through the ground") A sunken water channel is
    // an opening of the same kind: its water lies 4.4 m below the street, under every flat ground layer. Flat water is
    // the top ground layer and shows through whatever is mapped across it; the sunken river did not, so a park or
    // landuse polygon mapped across it, and above all the aerial green raster (which reads the algae-green river as
    // lawn), covered the water and left it showing only through the raster's gaps. The channel decision is taken here,
    // before the layers are built, and the channel's own water triangles are cut out of them like the trenches.
    // Not where the river is covered (the Unirii slab: its water is dropped from the final mesh by triangle centre, so
    // the ground stays whole to 4 m past the covered line, the reach of a 6 m water triangle whose centre is inside).
    const convexApart = (p, q) => { // a separating axis among the edge normals of two convex polygons
        for (const poly of [p, q]) for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length], nx = b[1] - a[1], nz = a[0] - b[0];
            let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
            for (const v of p) { const d = v[0] * nx + v[1] * nz; if (d < p0) p0 = d; if (d > p1) p1 = d; }
            for (const v of q) { const d = v[0] * nx + v[1] * nz; if (d < q0) q0 = d; if (d > q1) q1 = d; }
            if (p1 <= q0 + 1e-9 || q1 <= p0 + 1e-9) return true;
        }
        return false;
    };
    const coveredWater = projectCoveredWater(city, { us: US }), coveredHulls = coveredWaterHulls(coveredWater, 4);
    const waterTris = new Map(), channelCuts = [];
    for (const a of areas) {
        if (a.kind !== 'water') continue;
        // Literal mapped water type precedes the legacy estimated channel classification.
        a.channelDecision = waterChannelDecision(a, { us: US, tags: data.areaSourceTags?.[a.sourceId] || {} });
        if (!a.channelDecision.channel) continue;
        const t = triangulate(a.outer, a.holes); waterTris.set(a, t);
        for (const tri of t.tris) {
            let open = [tri.map(k => t.pts[k])];
            for (const hull of coveredHulls) open = open.flatMap(q => convexApart(q, hull) ? [q] : subtractConvex(q, hull));
            for (const q of open) {
                const xs = q.map(v => v[0]), zs = q.map(v => v[1]);
                if (Math.abs(signedArea(q)) < 1e-6) continue;
                channelCuts.push({ q, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
            }
        }
    }
    // (fidelity pass round 2, Stadionul Dinamo) A landmark sunk below the street is an opening of the same kind: the flat
    // ground layers and the green raster are cut over its pit, and the horizon ground gets an aperture there (below).
    const landmarkPits = [];
    try {
        for (const pit of (await import('./landmarks.js')).landmarkGroundPits?.(city.id, distCfg?.landmarks) || []) {
            const o = city.proj(pit.lat, pit.lon), ring = pit.ring.map(([x, z]) => [o.x + x * data.proj.scale, o.z + z * data.proj.scale]), t = triangulate(ring);
            const tris = t.tris.map(tri => tri.map(k => t.pts[k]));
            landmarkPits.push({ id: pit.id, ring, tris, floorY: pit.floorY });
            for (const q of tris) { const xs = q.map(v => v[0]), zs = q.map(v => v[1]); if (Math.abs(signedArea(q)) > 1e-6) channelCuts.push({ q, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }); }
        }
    } catch (err) { console.warn('landmark pits', err); }
    const groundCuts = trenchQuads.concat(channelCuts);
    // (a river polygon's triangles are long slivers with large boxes: the exact test keeps the ground beside them whole)
    const groundCutsAt = (poly, x0, z0, x1, z1) => groundCuts.filter(h => h.x1 > x0 && h.x0 < x1 && h.z1 > z0 && h.z0 < z1 && !convexApart(poly, h.q));
    let trenchCutTris = 0;
    const cutTrenches = (pts, tris) => { // pts [[x, z]], tris [[i, j, k]] (flatPoly orients each triangle up itself)
        if (!groundCuts.length) return { pts, tris };
        const P = pts.slice(), T = [];
        for (const t of tris) {
            const tri = t.map(k => P[k]);
            const x0 = Math.min(tri[0][0], tri[1][0], tri[2][0]), x1 = Math.max(tri[0][0], tri[1][0], tri[2][0]), z0 = Math.min(tri[0][1], tri[1][1], tri[2][1]), z1 = Math.max(tri[0][1], tri[1][1], tri[2][1]);
            const hits = groundCutsAt(tri, x0, z0, x1, z1);
            if (!hits.length) { T.push(t); continue; }
            let pieces = [tri];
            for (const h of hits) { pieces = pieces.flatMap(pc => subtractConvex(pc, h.q)); if (!pieces.length) break; }
            trenchCutTris++;
            for (const pc of pieces) { const base = P.length; P.push(...pc.map(v => [v[0], v[1]])); for (let k = 1; k < pc.length - 1; k++) T.push([base, base + k, base + k + 1]); }
        }
        return { pts: P, tris: T };
    };
    const fountainBasinColl = []; // (round 3: fountain basins, see below)
    for (const a of areas) {
        let { pts, tris } = waterTris.get(a) || triangulate(a.outer, a.holes);
        if (a.kind !== 'water' && tris.length) ({ pts, tris } = cutTrenches(pts, tris));
        if (!tris.length) continue;
        const y = AREA_Y[a.kind] ?? Y.landuse;
        const col = rgb(areaColors[a.kind] || env.ground);
        if (a.kind === 'water') {
            const target = (a.x1 - a.x0 > CELL * 2 || a.z1 - a.z0 > CELL * 2) ? bigWater : cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2).water;
            const channel = a.channelDecision, chan = channel.channel;
            const chanP = channelProfile(distId, a.sourceId, CHAN); if (chan) a.chanProfile = chanP; // (r2: reviewed section per water polygon, water-channel-review.js)
            waterChannelAudit.push({ sourceId: a.sourceId, name: a.name, ...channel, surfaceM: chan ? chanP.water : y, surfaceSource: chan && chanP.source || 'model estimate' });
            // (round 3, r2-builder-fountain-outlines) a fountain basin mapped as an outline (areaSourceTags amenity=fountain,
            // tools/osm/add-areas.mjs) holds its water inside a low stone coping (≈ 0.45 m, an estimate), not at ground level
            // (round 3 review, Unirii Colțea garden w1180500523/4, w1180503225: natural=water only, 13–16 m², flat water at grass
            // level) an ornamental basin is also water=reflecting_pool|fountain, or a natural=water with no water=* type of at
            // most 30 m² (a mapped body of water that small in a city is a built basin, not a pond: the smallest mapped ponds in
            // the eight districts are 38 m² and up)
            const wt = data.areaSourceTags?.[a.sourceId], ornamental = !!wt && (wt.amenity === 'fountain' || /^(reflecting_pool|fountain)$/.test(wt.water || '') || (wt.natural === 'water' && !wt.water && a.size <= 30));
            const basin = !chan && ornamental, wy = basin ? 0.36 : y;
            const v0 = target.vc; target.flatPoly(pts, tris, chan ? chanP.water : wy, chan ? rgb('#3c4a42') : col, 0.02); a.waterMesh = { mb: target, v0, v1: target.vc };
            if (basin) { // coping: outer face, top (0.3 m wide), inner face down to the water, along the outer ring
                const sb = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2).solid, stone = rgb(FOUNTAIN_COPING[a.sourceId] || '#b9b2a5'), R = a.outer, ccw = signedArea(R) > 0, top = 0.45, base = 0;
                for (let k = 0; k < R.length; k++) {
                    const [ax, az] = R[k], [bx, bz] = R[(k + 1) % R.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
                    let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; } // (outward)
                    const ix = -nx * 0.3, iz = -nz * 0.3, Y0 = Math.min(base, wy - 0.1);
                    sb.face4([ax, Y0, az], [bx, Y0, bz], [bx, top + base, bz], [ax, top + base, az], stone, [nx, 0, nz]);
                    sb.face4([ax, top + base, az], [bx, top + base, bz], [bx + ix, top + base, bz + iz], [ax + ix, top + base, az + iz], stone, [0, 1, 0]);
                    sb.face4([bx + ix, wy - 0.05, bz + iz], [ax + ix, wy - 0.05, az + iz], [ax + ix, top + base, az + iz], [bx + ix, top + base, bz + iz], stone, [-nx, 0, -nz]);
                }
                fountainBasinColl.push({ x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2, r: Math.max(0.6, Math.min(a.x1 - a.x0, a.z1 - a.z0) / 2) }); // (collider added once addPropColl exists)
            }
            if (chan) { a.channel = true; channelAreas.push(a); }
        } else {
            const cc = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2);
            (SPORT_KINDS.has(a.kind) ? cc.sport : GRASSY.has(a.kind) ? cc.grass : PAVED.has(a.kind) ? cc.pave : cc.area).flatPoly(pts, tris, y, col, 0.1); // (sports grounds: own layer + weather)
        }
    }
    return {
        CHAN,
        areas,
        bigWater,
        bounds,
        builderEpoch,
        bx0,
        bx1,
        bz0,
        bz1,
        cellOf,
        cells,
        channelAreas,
        channelCuts,
        convexApart,
        coveredWater,
        cutTrenches,
        fountainBasinColl,
        graph,
        groundCutsAt,
        inArea,
        isPark,
        isWater,
        landmarkPits,
        nearWater,
        pad,
        signMB,
        sweptOut,
        tramSweep,
        tramSweepConflicts,
        trenchQuads,
        waterChannelAudit,
        waterGrid,
        get dmask() { return dmask; }, set dmask(v) { dmask = v; },
        get trenchCutTris() { return trenchCutTris; }, set trenchCutTris(v) { trenchCutTris = v; },
    };
}
