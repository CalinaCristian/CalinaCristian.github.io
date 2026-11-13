// ============================================================================
//  WORLD BUILDINGS — map ends, building records, outlines, roofs, overlap cuts, landmark models
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { distPointSeg, pointInPolygon } from './util.js';
import { assemblySignature, footprintCells, geometryRing, geometrySurface } from './building-parts.js';
import { validRoofProfile } from './building-roofs.js';
import { signatureMatches } from './district-pack.js';
import { rgb } from './geobuild.js';
import { passageBaseUnknown, passageSolids } from './building-passages.js';
import { tramGradeRenderPieces, tramSupportPieceId } from './tram-grade.js';
import { uncoveredTramTrenchWall } from './tram-trench.js';
import { sidewalkWidth } from './sidewalk-source.js';
import { planOverlapCuts, planOverlapCutsParallel } from './building-overlap.js';
import { districtMaskSegments, normalizeSourceMapEnds } from './district-boundary.js';
import { carParkOf, reviewedCarParkHeight } from './car-parks.js';
import { fuelStationRow } from './fuel-look.js';
import { WILBURTON_STATION } from './bellevue-guideway.js';
import { applyBuildingReview } from './building-review.js';
import { applyEntranceCanopies } from './underpass-mouths.js';
import { applyFuelCanopyReview } from './fuel-canopy-review.js';
import { BoxGrid, Y, centroid, isMotorwayTrunk, landmarksModule, setProgress, shoulderOf, signedArea, tick, undelta } from './world-shared.js';

export async function buildBuildingsLandmarks(ctx) {
    const {
        US, ballastCol, boundarySupport, bounds, buildPool, cellOf, city, coveredRoadModels,
        data, distCfg, distId, dmask, edgesInBox, inDistrictLL, nearestEdge, nodeArr,
        pad, polyOnRibbon, railCol, ribGrid, ribbons, sceneryDeckGrid, sharedHallRoad, str,
        tramDecks, tramGrades, tramHallPieces, trams, walls, yAlong,
    } = ctx;
    if (dmask) Object.assign(bounds, { minX: dmask.x0 - pad, minZ: dmask.z0 - pad,
        maxX: dmask.x0 + dmask.w * dmask.cell + pad, maxZ: dmask.z0 + dmask.h * dmask.cell + pad });
    // ---- district edge (chapters): every road cut at the district boundary ends in a red/white "road closed" barrier
    //      with a solid wall across it (kind 'end'); the inside-mask outline is an invisible wall (kind 'boundary')
    const mapEnds = [];
    if (data.district) {
        // (after round 6) the boundary cuts + every other dead end of a through road (a road whose continuation was dropped:
        // "the road stops without indication") — service lanes / living streets / short stubs are left as they are
        const endIdx = new Set(data.district.ends || []);
        nodeArr.forEach((n, i) => { if (!n || endIdx.has(i)) return; const real = n.edges.filter(f => !f.virtual && f.publicDrive !== false); if (real.length !== 1) return; const e = real[0];
            if (/service|living_street|track|path|footway|pedestrian|parking/.test(e.type || '') || (e.len || 0) < 25) return; endIdx.add(i); });
        const candidates = [];
        for (const i of endIdx) {
            const n = nodeArr[i]; const real = n ? n.edges.filter(f => !f.virtual && f.publicDrive !== false) : []; if (real.length !== 1) continue; // (a U-turn connector may join a cut dual carriageway)
            const e = real[0];
            const out = e.a === n ? 1 : -1; // into the edge (= into the map)
            // road direction over the last ~20 m (a short, skewed last OSM segment made the barrier run diagonally)
            let ix = e.dirx * out, iz = e.dirz * out;
            const px = -iz, pz = ix;
            const setback = Math.min(1.5, e.len / 2), cx = n.x + ix * setback, cz = n.z + iz * setback, y = Y.road + yAlong(e, cx, cz);
            n.mapEnd = true;
            const kind = isMotorwayTrunk(e.type) ? 'highway' : (/^(primary|secondary)(_link)?$/.test(e.type) || e.lanesF + e.lanesB >= 4) ? 'boulevard' : 'small';
            // One asymmetric full exit span (road/shoulder/source sidewalk) is
            // finalized before both the physical wall and visible decoration.
            const sgn = px * e.nx + pz * e.nz >= 0 ? 1 : -1,
                wP = (sgn > 0 ? e.wR : e.wL) + shoulderOf(e) + sidewalkWidth(e, sgn) + .3,
                wN = (sgn > 0 ? e.wL : e.wR) + shoulderOf(e) + sidewalkWidth(e, -sgn) + .3;
            candidates.push({ x: cx, z: cz, node: n, edge: e, ix, iz, px, pz, half: (wN + wP) / 2, y, barrierHeight: US ? 1.51 : 1.36, kind, heading: Math.atan2(ix, iz), l0: -wN, l1: wP });
        }
        mapEnds.push(...normalizeSourceMapEnds(candidates, boundarySupport));
        // (A road-closed barrier keeps its whole span even where a tram track crosses it: the tram plans its stop in front
        //  of it, Traffic.railDistrictLimit. Cutting the span to let the rigid tram body through left half a road open.)
        for (const m of mapEnds) {
            const { x, z, px, pz, y, ix, iz, l0, l1, edge, node } = m,
                ax = x + px * l0, az = z + pz * l0, bx = x + px * l1, bz = z + pz * l1;
            walls.push({ wall: true, ax, az, bx, bz, y0a: y, y1a: y + m.barrierHeight, y0b: y, y1b: y + m.barrierHeight,
                nx: ix, nz: iz, kind: 'closure', soft: true, edge, node,
                x: (ax + bx) / 2, z: (az + bz) / 2, r: m.half + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.2,
                normalizedSourceBoundary: true, bundleId: m.bundleId, l0, l1 });
        }
        for (const { ax, az, bx, bz, nx, nz } of districtMaskSegments(dmask))
            walls.push({ wall: true, ax, az, bx, bz, y0a: -40, y1a: 80, y0b: -40, y1b: 80, nx, nz, kind: 'boundary', edge: null,
                x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 0 });
    }
    // The same source grade resolver is later exposed to Traffic. Heights are
    // explicit model profiles, independent of motor routing and source layers.
    // tram tracks
    for (const [run, pl] of trams.entries()) {
        for (let i = 0; i < pl.length - 1; i++) {
            const [ax, az] = pl[i], [bx, bz] = pl[i + 1]; const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
            const grade = tramGrades.forRun(run, i);
            if (grade) {
                // Flat decks need only bounded pieces for cells; smooth ramp
                // chords stay within2mm of the exact shared continuous profile.
                for (const piece of tramGradeRenderPieces([ax, az], [bx, bz], grade, Y.ballast)) {
                    const { a, b, t0, t1, y0, y1, quad, supported, top, band } = piece, c = cellOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
                    if (supported) {
                        const bottom = top.map(p => [p[0], p[1] - grade.thicknessM, p[2]]), slab = rgb('#96938b');
                        c.solid.face4(...top, slab, [0, 1, 0]);
                        c.solid.face4(...bottom.slice().reverse(), rgb('#55524d'), [0, -1, 0]);
                        for (const [n, k] of [[0, 1], [2, 3]]) c.solid.face4(bottom[n], bottom[k], top[k], top[n], slab, n === 0 ? [nx, 0, nz] : [-nx, 0, -nz]);
                        const poly = top.map(p => [p[0], p[2]]), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
                        const deck = { x, z, r: Math.max(...poly.map(p => Math.hypot(p[0] - x, p[1] - z))), poly, holes: [], roadDeck: true, railDeck: true,
                            kind: 'source-tram-deck', sourceId: data.tramSources[run].sourceId, sourceSegment: grade.sourceSegment,
                            supportPieceId: tramSupportPieceId(data.tramSources[run].sourceId, grade.sourceSegment, piece, grade.modelId),
                            sourceNodeIds: data.tramSources[run].nodeIds.slice(i, i + 2), sourceTags: data.tramSources[run].tags,
                            estimated: true, elevationSource: grade.basis, sourceAnchorIds: grade.sourceAnchorIds, modelId: grade.modelId,
                            supportA: a, supportB: b, supportTop: top, topProfile: piece.topProfile, sourceBridgeModelId:grade.sourceBridgeModelId,
                            y0: Math.min(...bottom.map(p => p[1])), y1: Math.max(...top.map(p => p[1])), h: Math.max(...top.map(p => p[1])),
                            roofHeightAt: (px, pz, radius) => band(px, pz, radius).top, minHeightAt: (px, pz, radius) => band(px, pz, radius).bottom };
                        sceneryDeckGrid.insert(x - deck.r, z - deck.r, x + deck.r, z + deck.r, deck); tramDecks.push(deck);
                        tramGrades.report.renderedDeckPieces++; tramGrades.report.renderedTriangles += 8;
                    }
                    if (Math.min(y0, y1) < -1e-6) {
                        // Estimated retaining sides follow the actual source
                        // centreline; the source tunnel=yes length is roofed.
                        if (piece.roof) tramHallPieces.push({ a, b, half: grade.deckHalfWidthM });
                        const upper = piece.roof ? piece.roof.bottomM : 0, sides = quad(grade.deckHalfWidthM, Math.max(Y.ballast + y0, upper), Math.max(Y.ballast + y1, upper));
                        for (const [n, k, sign] of [[0, 1, -1], [2, 3, 1]]) {
                          for (const [lo, hi] of uncoveredTramTrenchWall(top[n], top[k], [-nx * sign, -nz * sign], tramGrades.support, grade.modelId)) {
                            const interpolate = (p, q, t) => p.map((v, j) => v + (q[j] - v) * t), A = interpolate(top[n], top[k], lo), B = interpolate(top[n], top[k], hi), U = interpolate(sides[n], sides[k], lo), V = interpolate(sides[n], sides[k], hi);
                            const mx = (A[0] + B[0]) / 2, mz = (A[2] + B[2]) / 2;
                            // (shared hall: beside a deep covered carriageway the roofed station has a pier row, not a wall; the collision wall stays)
                            if (!(piece.roof && (sharedHallRoad(mx, mz, nx, nz) || sharedHallRoad(mx, mz, -nx, -nz)))) c.solid.face4(A, B, V, U, rgb('#888982'), [nx * sign, 0, nz * sign]);
                            walls.push({ wall: true, ax: A[0], az: A[2], bx: B[0], bz: B[2], y0a: A[1], y0b: B[1], y1a: U[1], y1b: V[1],
                                nx: nx * sign, nz: nz * sign, kind: 'source-tram-trench', edge: null, sourceId: data.tramSources[run].sourceId,
                                sourceSegment: grade.sourceSegment, modelId: grade.modelId, estimated: true, elevationSource: grade.basis,
                                sourceNodeIds: data.tramSources[run].nodeIds.slice(i, i + 2), sourceTags: data.tramSources[run].tags,
                                renderPieceId: tramSupportPieceId(data.tramSources[run].sourceId, grade.sourceSegment, piece, grade.modelId) + `:wall:${sign}:${lo}:${hi}`,
                                renderedVertices: [A, B, V, U],
                                x: mx, z: mz, r: Math.hypot(B[0] - A[0], B[2] - A[2]) / 2 + .1, hw: 0, hd: 0, angle: 0, poly: null, h: Math.max(U[1], V[1]) });
                            tramGrades.report.renderedTriangles += 2;
                          }
                        }
                    }
                    if (piece.roof) {
                        const roof = piece.roof, roofTop = quad(grade.deckHalfWidthM, roof.topM, roof.topM), roofBottom = quad(grade.deckHalfWidthM, roof.bottomM, roof.bottomM);
                        c.solid.face4(...roofTop, rgb('#92938d'), [0, 1, 0]);
                        c.solid.face4(...roofBottom.slice().reverse(), rgb('#646761'), [0, -1, 0]);
                        for (const [n, k] of [[0, 1], [2, 3]]) c.solid.face4(roofBottom[n], roofBottom[k], roofTop[k], roofTop[n], rgb('#787b74'), n === 0 ? [nx, 0, nz] : [-nx, 0, -nz]);
                        const poly = roofTop.map(p => [p[0], p[2]]), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
                        const cover = { x, z, r: Math.max(...poly.map(p => Math.hypot(p[0] - x, p[1] - z))), poly, holes: [], roadDeck: true, railRoof: true,
                            kind: 'source-tram-roof', sourceId: data.tramSources[run].sourceId, sourceSegment: grade.sourceSegment,
                            sourceNodeIds: data.tramSources[run].nodeIds.slice(i, i + 2), sourceTags: data.tramSources[run].tags, modelId: grade.modelId, estimated: true, elevationSource: roof.basis,
                            renderPieceId: tramSupportPieceId(data.tramSources[run].sourceId, grade.sourceSegment, piece, grade.modelId) + ':roof', renderedTop: roofTop, renderedBottom: roofBottom,
                            y0: roof.bottomM, y1: roof.topM, h: roof.topM, roofHeightAt: () => roof.topM, minHeightAt: () => roof.bottomM };
                        sceneryDeckGrid.insert(x - cover.r, z - cover.r, x + cover.r, z + cover.r, cover); tramDecks.push(cover);
                        tramGrades.report.renderedRoofPieces = (tramGrades.report.renderedRoofPieces || 0) + 1; tramGrades.report.renderedTriangles += 8;
                    }
                    const ballast = quad(1.4, Y.ballast + y0 + (supported ? .001 : 0), Y.ballast + y1 + (supported ? .001 : 0));
                    (supported ? c.road : c.ground).face4(...ballast, ballastCol, [0, 1, 0], -1, ballast.map(p => [p[0] * .3, p[2] * .3]));
                    for (const offset of [-.72, .72]) {
                        const hw = .045, yy = Y.road + Y.mark + .006;
                        c.marks.face4([a[0] + nx * (offset + hw), yy + (grade.heightAtWorld?.(a[0]+nx*(offset+hw),a[1]+nz*(offset+hw))??y0), a[1] + nz * (offset + hw)], [b[0] + nx * (offset + hw), yy + (grade.heightAtWorld?.(b[0]+nx*(offset+hw),b[1]+nz*(offset+hw))??y1), b[1] + nz * (offset + hw)],
                            [b[0] + nx * (offset - hw), yy + (grade.heightAtWorld?.(b[0]+nx*(offset-hw),b[1]+nz*(offset-hw))??y1), b[1] + nz * (offset - hw)], [a[0] + nx * (offset - hw), yy + (grade.heightAtWorld?.(a[0]+nx*(offset-hw),a[1]+nz*(offset-hw))??y0), a[1] + nz * (offset - hw)], railCol, [0, 1, 0], -1, [[0, 0], [0, 0], [0, 0], [0, 0]]);
                    }
                    tramGrades.report.renderedTriangles += 6;
                }
                continue;
            }
            const c = cellOf(ax, az);
            c.ground.flatQuad(ax + nx * 1.4, az + nz * 1.4, bx + nx * 1.4, bz + nz * 1.4, bx - nx * 1.4, bz - nz * 1.4, ax - nx * 1.4, az - nz * 1.4, Y.ballast, ballastCol, 0.3);
            for (const o of [-0.72, 0.72]) {
                const hw = 0.045, y = Y.road + Y.mark + 0.006;
                c.marks.flatQuad(ax + nx * (o + hw), az + nz * (o + hw), bx + nx * (o + hw), bz + nz * (o + hw), bx + nx * (o - hw), bz + nz * (o - hw), ax + nx * (o - hw), az + nz * (o - hw), y, railCol, 0);
            }
        }
    }
    /** Exact containing new rail slabs only. The slab/ballast base is0.2m;
     * Traffic's native actor base remains0.24m above the same displacement. */
    const tramDeckSupportAt = tramGrades.support.at;

    // -----------------------------------------------------------------------
    //  BUILDINGS (+ CV POIs, landmarks)
    // -----------------------------------------------------------------------
    setProgress('Raising the buildings…'); await tick();
    const B_OFF = (data.version || 1) >= 2 ? 9 : 6;
    const bRecs = data.buildings.map((b, i) => {
        const ring = data.buildingFootprints?.[i] || undelta(b, B_OFF);
        const holes = data.buildingHoleFootprints?.[i] || (data.buildingHoles?.[i] || []).map(h => undelta(h, 0)).filter(h => h.length >= 3);
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        const c = centroid(ring);
        const sourceHeight = data.buildingDimensions?.[i]?.[0] ?? b[1] / 10, minimum = data.buildingDimensions?.[i]?.[1] ?? b[2] / 10;
        const roofProfile = validRoofProfile(data.buildingRoofProfiles?.[i], sourceHeight, minimum) ? data.buildingRoofProfiles[i] : null;
        // A building whose own source tags (kept for multipolygon relations) say it is a hotel shows the hotel's sign: the builder
        // reads POIs from nodes and ways only, so a tenant inside it had taken the sign (Courtyard, Bellevue, OSM r8064670).
        // (r2-builder) data.buildingOwnTags (tools/osm/add-pois.mjs): a way building's own name where a tenant POI had taken its
        // sign (Sheraton read "Pizza Hut", Victoria Center "Starbucks"); the tenant keeps its unit fascia (addUnitSign)
        const ownTags = data.buildingSourceTags?.[data.buildingIds?.[i]] || data.buildingOwnTags?.[data.buildingIds?.[i]];
        const ownSign = ownTags && /^(hotel|hostel|motel)$/.test(ownTags.tourism || '') ? (ownTags.brand || ownTags.name || '') : (data.buildingOwnTags?.[data.buildingIds?.[i]]?.name || '');
        return { i, sourceId: data.buildingIds?.[i], heightSourceCode: data.buildingInfo?.[i * 5 + 4], style: data.styles[b[0]], h: data.buildingDimensions?.[i]?.[0] ?? b[1] / 10, minH: data.buildingDimensions?.[i]?.[1] ?? b[2] / 10, roof: data.roofs[b[3]], name: ownSign || str(b[4]), flags: ownSign ? (b[5] | 2 | (ownTags.brand ? 8 : 0)) : b[5], signStreet: ownSign ? ownTags['addr:street'] || '' : '', ring, holes, c, x0, z0, x1, z1, area: Math.abs(signedArea(ring)), skip: false,
            roofProfile, canopy: data.buildingCanopies?.[i] || null, levels: B_OFF === 9 ? b[6] : 0, colour: B_OFF === 9 ? str(b[7]) : '', roofColour: B_OFF === 9 ? str(b[8]) : '' };
    });
    for (const b of bRecs) b.aircraft = data.buildingAircraft?.[b.i] || null;
    const carParkOutlines = bRecs.filter(o => o.ring?.length >= 3 && carParkOf(data.buildingIds?.[o.i], data.buildingSourceTags)); // (r2: a car park drawn through its building parts keeps its decks)
    const roofProfileAudit = { supplied: Object.keys(data.buildingRoofProfiles || {}).length, applied: bRecs.filter(b => b.roofProfile).length, rejected: bRecs.filter(b => data.buildingRoofProfiles?.[b.i] && !b.roofProfile).map(b => data.buildingIds?.[b.i] || b.i), uncertain: bRecs.filter(b => b.roofProfile?.issues?.length).map(b => ({ source: data.buildingIds?.[b.i] || b.i, issues: b.roofProfile.issues })), surfacesApplied: 0, surfacesRejected: [] };
    // ---- (round 6 notes 10 / 46) Bucharest 'house' buildings: the village-house look (shutters, steep gable) read wrong —
    //      in Floreasca / Romană they are interwar villas (plaster, low hipped roof), and a lone house among office towers
    //      (Pipera, Bd. Dimitrie Pompeiu) reads as a low commercial block. Seattle keeps its wooden houses.
    if (!US) {
        // (spec 10 load budget) the tall buildings by 70 m cell (each in the cell of its centre): a house reads the 3 × 3
        // cells round its own; the same distances, so the same count of those nearer than 70 m (up to 3)
        const tallCells = new Map(), tallKey = (i, j) => i * 100003 + j;
        for (const t of bRecs) if (t.h > 20) { const k = tallKey(Math.floor(t.c[0] / 70), Math.floor(t.c[1] / 70)); let l = tallCells.get(k); if (!l) tallCells.set(k, l = []); l.push(t); }
        for (const b of bRecs) {
            if (b.style !== 'house') continue;
            let n = 0; const bi = Math.floor(b.c[0] / 70), bj = Math.floor(b.c[1] / 70);
            near: for (let i = bi - 1; i <= bi + 1; i++) for (let j = bj - 1; j <= bj + 1; j++) for (const t of tallCells.get(tallKey(i, j)) || []) if (Math.hypot(t.c[0] - b.c[0], t.c[1] - b.c[1]) < 70 && ++n >= 3) break near;
            if (n >= 3 && !(b.flags & 16) && !b.roofProfile) { b.style = 'plain'; b.roof = 'flat'; }
            else { b.style = 'interwar'; b.villa = true; if (!b.roofProfile && !(b.flags & 16) && (b.roof === 'gabled' || b.roof === 'pitched')) b.roof = 'hipped'; } // (flags 16: roof shape measured — OSM / aerial survey — kept)
        }
    }
    // ---- facade style from data.buildingInfo (world-data: OSM type, start_date year, architect, material, height source)
    {
        const BI = data.buildingInfo || [];
        let restyled = 0;
        for (const b of bRecs) {
            const k = b.i * 5; if (k + 4 >= BI.length) break;
            const type = BI[k] >= 0 ? str(BI[k]) : '', yr = BI[k + 1] || 0, mat = BI[k + 3] >= 0 ? str(BI[k + 3]) : '';
            b.type = type; b.year = yr; b.material = mat;
            if (b.style === 'church' || b.style === 'house' || b.style === 'shop') continue;
            let st = null;
            if (/glass/.test(mat) || ((type === 'office' || type === 'commercial') && yr >= 1995)) st = 'glass';
            else if (yr && yr < 1914) st = US ? 'interwar' : 'eclectic';
            else if (yr >= 1925 && yr <= 1945) st = US ? 'interwar' : 'interwar';
            else if (yr >= 1960 && yr <= 1989 && /apartments|residential|yes|^$/.test(type) && !US) st = 'bloc';
            else if (/brick/.test(mat) && US) st = 'interwar';
            if (st && st !== b.style) { b.style = st; restyled++; }
        }
        if (restyled) console.info('[world] facade styles from buildingInfo:', restyled);
    }
    // ---- principal occupant (2026-11-12 fidelity pass, SeaTac): the data build signs a building with the first POI attached to
    //      it, so hotels carried a tenant's name (Hilton = "Spencer's", Radisson = "RBG Bar & Grill", Ramada = "Ginger Palace")
    //      and a fuel canopy its kiosk's ("Food Mart" on the 76). A hotel / motel (a hotel POI on the building, one named like it
    //      beside it, or tourism=* on the building's own source tags) or a fuel station names its building; and a US hotel is a
    //      windowed block, not the windowless 'plain' shed / glass 'shop' row the US style fallback gives untagged footprints.
    {
        const kindOf = (p) => data.poiKinds?.[p[0]], q = data.q || 10, lodging = new Map(), fuel = new Map(), museums = new Map();
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const p of data.pois || []) {
            const k = kindOf(p); if (k !== 'hotel' && k !== 'fuel') {
                // (Romană: Muzeul Țăranului Român was signed "Cinema Muzeul Țăranului") a museum POI attached to a building that is
                // signed with another POI's name names it; a building without a POI sign keeps its own name
                if (k === 'landmark' && str(p[5]) === 'museum' && p[6] >= 0 && str(p[3]) && !museums.has(p[6])) museums.set(p[6], str(p[3]));
                continue;
            }
            const brand = str(p[4]), name = str(p[3]); let i = p[6];
            if (i < 0 && k === 'hotel') { // not attached by the build: the building beside it that already carries its name
                let best = 60; for (const b of bRecs) { const n = norm(b.name); if (!n || (n !== norm(brand) && n !== norm(name))) continue; const d = Math.hypot(b.c[0] - p[1] / q, b.c[1] - p[2] / q); if (d < best) { best = d; i = b.i; } }
            }
            const seen = k === 'fuel' && i >= 0 ? fuelStationRow(city.id + '-' + distId, data.buildingIds?.[bRecs[i]?.i ?? i])?.text : null; // (r3-look-2: fuel-look.js seenBrand)
            if (i >= 0 && !(k === 'hotel' ? lodging : fuel).has(i)) (k === 'hotel' ? lodging : fuel).set(i, { text: seen || brand || name, brand: !!brand });
        }
        for (const b of bRecs) { const t = data.buildingSourceTags?.[b.sourceId] || data.buildingOwnTags?.[b.sourceId]; if (t && /^(hotel|motel|hostel|guest_house)$/.test(t.tourism || '') && !lodging.has(b.i)) lodging.set(b.i, { text: t.brand || t.name || '', brand: !!t.brand }); }
        for (const [i, s] of fuel) { const b = bRecs[i]; if (b && s.text && !lodging.has(i)) { b.name = s.text; b.flags |= 2 | (s.brand ? 8 : 0); } }
        for (const [i, text] of museums) { const b = bRecs[i]; if (b && (b.flags & 2) && !lodging.has(i) && !fuel.has(i)) { b.name = text; b.flags &= ~8; } }
        for (const [i, s] of lodging) {
            const b = bRecs[i]; if (!b) continue;
            if (s.text) { b.name = s.text; b.flags |= 2 | (s.brand ? 8 : 0); }
            if (US && (b.style === 'plain' || b.style === 'shop')) { b.style = 'bloc'; b.flags &= ~1; }
        }
    }
    // ---- street-level review rows by OSM id (round 2 fidelity pass; game/src/building-review.js): reviewed storeys / style / colour
    const buildingReviewAudit = applyBuildingReview({ key: city.id + '-' + distId, bRecs });
    // (r2-world-guideway) Wilburton's roof w615292866 (building=train_station, layer=1, no min_height) came out of the pack as a
    // 7.8 m windowed block on the ground round the guideway; bellevue-guideway.js draws the station at deck level instead
    if (distId === 'bellevue') for (const b of bRecs) if (data.buildingIds?.[b.derivedFrom ?? b.i] === WILBURTON_STATION.replacesSource) { b.skip = true; b.replacedBy = 'wilburton-station'; }    // ---- height sanity (2026-11-07, world-visual): the data build gives every untagged large footprint outside the old
    //      centre 8–10 storeys (23–30 m 'bloc'), so museums, villas and institutions on Kiseleff / Dorobanți became grey
    //      slabs. Buildings without building:levels whose height is exactly such a default are re-estimated here from
    //      their name and shape: real slab blocks (≤ 22 m wide, ≥ 30 m long) keep their storeys, compact or courtyard
    //      footprints become 3–5 storeys, named institutions 2–4 (data-build fix requested in spec 12 Requests)
    const heightFixes = [];
    {
        const DEF = new Set([11.6, 12.6, 14.5, 15.5, 23.2, 24.2, 29, 30]);
        const INST = /muze|museum|biseric|church|catedral|institut|[șs]coal|liceu|gr[ăa]dini|teatr|atene|bibliotec|universit|facult|spital|palat|casa |vila|villa|ambasada\b|embassy|primări|primari|tribunal|ministe/i;
        const minWidth = (ring) => { // smallest width over the footprint's own edge directions
            let best = Infinity, len = 0;
            for (let k = 0; k < ring.length; k++) {
                const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
                const ux = (bx - ax) / L, uz = (bz - az) / L; let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
                for (const [x, z] of ring) { const p = x * ux + z * uz, q = -x * uz + z * ux; a0 = Math.min(a0, p); a1 = Math.max(a1, p); c0 = Math.min(c0, q); c1 = Math.max(c1, q); }
                if (c1 - c0 < best) { best = c1 - c0; len = a1 - a0; }
            }
            return { w: best, l: len };
        };
        const villaZone = (x, z) => { if (US) return false; const ll = city.proj.inverse ? city.proj.inverse(x, z) : null; return !!ll && ll.lat > 44.447 && ll.lat < 44.48 && ll.lon > 26.07 && ll.lon < 26.112; }; // (to 26.112: Garibaldi / the composer streets)
        for (const b of bRecs) {
            if (b.roofProfile || b.levels > 0 || b.style === 'church' || b.style === 'glass' || b.minH > 0 || /^(bl(oc)?\.?\s|bloc\b|block\b)/i.test(b.name || '')) continue; // (a named apartment block keeps its storeys)
            const named = INST.test(b.name || '');
            const isDef = DEF.has(Math.round(b.h * 10) / 10);
            if (!isDef && !(named && b.h > 18)) continue;
            const { w, l } = minWidth(b.ring);
            const slab = w <= 22 && l >= 30 && !named && !villaZone(b.c[0], b.c[1]);
            if (slab || (!named && b.h < 16)) continue;
            const lv = named ? (b.area > 3000 ? 4 : b.area > 800 ? 3 : 2) : villaZone(b.c[0], b.c[1]) ? (b.area > 1500 ? 4 : 3) : (w > 22 ? 5 : 4);
            const floor = named ? 4.6 : 3.3, h2 = Math.round((lv * floor + 1.2) * 10) / 10;
            if (h2 >= b.h - 0.5) continue;
            heightFixes.push({ name: b.name || '', from: b.h, to: h2, w: Math.round(w), l: Math.round(l), x: Math.round(b.c[0]), z: Math.round(b.c[1]) });
            b.h = h2; b.levels = lv; if (named && b.style === 'bloc') b.style = US ? 'interwar' : 'eclectic';
            if (!named && villaZone(b.c[0], b.c[1]) && b.style === 'bloc') b.style = US ? 'interwar' : 'eclectic';
        }
        if (heightFixes.length) console.info('[world] height sanity:', heightFixes.length, 'buildings re-estimated', heightFixes.slice(0, 8));
    }
    for (const b of bRecs) { const rh = reviewedCarParkHeight(b.sourceId, b.heightSourceCode); if (rh && (!b.roofProfile || (b.roofProfile.shape === 'flat' && b.roofProfile.heightSource === 'style estimate'))) { b.h = rh; if (b.roofProfile) b.roofProfile = { ...b.roofProfile, totalM: rh, eavesM: rh, heightSource: 'street-level review estimate' }; } } // (r2: car-park storeys counted from the street: car-parks.js)
    const fuelCanopyReview = applyFuelCanopyReview(city.id + '-' + distId, bRecs, data.buildingIds); // (r2: reviewed open fuel roofs the pack draws as blocks: fuel-canopy-review.js)
    const entranceCanopies = applyEntranceCanopies(city.id + '-' + distId, bRecs, data.buildingIds); // (grozavesti-7: an OSM roof over a metro entrance is an open canopy, underpass-mouths.js)
    coveredRoadModels.useNativeRibbons(ribbons);
    const buildingPassageAudit=(data.buildingPassageIssues||[]).map(i=>({...i,accepted:false}));
    const configurePassages=b=>{
        b.passages=[];b.passageSolids=null;
        for(const source of [...(data.buildingPassages?.[b.derivedFrom??b.i]||[]),...(coveredRoadModels.passages.get(b.derivedFrom??b.i)||[])]){
            if(passageBaseUnknown(source.tags)){buildingPassageAudit.push({source:data.buildingIds?.[b.derivedFrom??b.i],road:source.sourceRoadId,accepted:false,reason:'absolute-passage-base-unknown',baseUnknown:true,tags:source.tags});continue;}
            const mid=centroid(source.ring),indices=new Set(source.roadIndices||[]);
            const ne=nearestEdge(mid[0],mid[1],e=>!e.virtual&&(indices.has(e.road)||data.roadAccess?.[e.road]?.sourceId===source.sourceRoadId),100);
            const roadY=ne?Y.road+yAlong(ne.edge,mid[0],mid[1]):Y.road,ceilingM=roadY+source.clearanceM,top=b.roofProfile?.eavesM??b.h;
            if(!(ceilingM>Math.max(0,b.minH)&&ceilingM<top-.01)){buildingPassageAudit.push({source:data.buildingIds?.[b.i],road:source.sourceRoadId,accepted:false,reason:'opening-clearance-incompatible-with-source-body',ceilingM,bodyTopM:top});continue;}
            const key=source.sourceRoadId+'/'+source.sourceSegment+'/'+(source.sourcePreparedEdgeId===undefined?'':source.sourcePreparedEdgeId+'/')+ceilingM.toFixed(5);
            b.passages.push({...source,key,ceilingM});
            buildingPassageAudit.push({source:data.buildingIds?.[b.i],road:source.sourceRoadId,accepted:true,clearanceM:source.clearanceM,ceilingM,widthM:source.widthM,clearanceSource:source.clearanceSource,widthSource:source.widthSource});
        }
        if(b.passages.length)b.passageSolids=passageSolids(b.ring,b.holes,b.minH,b.h,b.passages);
    };
    for(const b of bRecs)configurePassages(b);
    // Source-policy contacts are audited against the actual low passage voids.
    // Legacy data retains its historical clearance behaviour until rebuilt.
    let bShrunk = 0, bDropped = 0; const clearanceAudit = [];
    const laneInPoly = (ring, noService = false, b = null) => { // lane samples (as devCheck / traffic see them) inside the footprint (noService: a big named building's own service lanes don't count)
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        let hit = false;
        edgesInBox(x0 - 12, z0 - 12, x1 + 12, z1 + 12, (e) => {
            if (hit || e.virtual || e.tunnel || e.layer < 0 || (noService && e.type === 'service') || (b && (b.minH > Math.max(e.ya, e.yb) + Y.road + 3 || Math.min(e.ya, e.yb) > b.h + 1))) return;
            // (spec 10 load budget) every sample lies within the widest offset of the edge's box (|n| = 1): an edge whose box so
            // widened misses the footprint's box (by more than 1 µm) has no sample inside it
            const offs = [0, e.wR * 0.45, e.wR * 0.85, -e.wL * 0.45, -e.wL * 0.85], reach = Math.max(Math.abs(e.wR * 0.85), Math.abs(e.wL * 0.85)) + 1e-6;
            if (Math.min(e.a.x, e.b.x) - reach > x1 || Math.max(e.a.x, e.b.x) + reach < x0 || Math.min(e.a.z, e.b.z) - reach > z1 || Math.max(e.a.z, e.b.z) + reach < z0) return;
            for (let t = 0.03; t < 0.98 && !hit; t += Math.min(0.05, 1 / e.len)) for (const o of offs) {
                const x = e.a.x + (e.b.x - e.a.x) * t + e.nx * o, z = e.a.z + (e.b.z - e.a.z) * t + e.nz * o;
                if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && pointInPolygon(x, z, ring) && !b?.holes.some(h => pointInPolygon(x, z, h))) { hit = true; break; }
            }
        });
        return hit;
    };
    const bBad = (ring, b) => {
        if(b.passageSolids)return b.passageSolids.some(band=>band.polys.some(poly=>polyOnRibbon(poly,rb=>!(band.y0>rb.y+Y.road+2||rb.y>band.y1+1))));
        const filter = rb => !(b.minH > rb.y + Y.road + 3 || rb.y > b.h + 1) && (!(b.flags & 64) || (!(rb.e && rb.e.type === 'service') && !(rb.node && (rb.node.allEdges || rb.node.edges).every(q => q.type === 'service'))));
        let overlap = polyOnRibbon(ring, filter);
        if (overlap && b.holes.length) {
            overlap = false;
            ribGrid.each(b.x0, b.z0, b.x1, b.z1, rb => {
                if (overlap || !rb.block || !filter(rb)) return;
                // The solid wing, rather than its enclosing outline, must touch
                // a road: mapped roads through open courtyards remain open.
                overlap = footprintCells(rb.poly, [ring, ...b.holes]).some(c => c.covered.includes(0) && c.covered.length === 1 && Math.abs(signedArea(c.ring)) > 0.02);
            });
        }
        return overlap || laneInPoly(ring, !!(b.flags & 64), b);
    };
    for (const b of bRecs) {
        if (!bBad(b.ring, b)) continue;
        if (data.buildingGeometryPolicy === 'source') {
            clearanceAudit.push({ source: data.buildingIds?.[b.i] || b.i, before: b.area, after: b.area, conflict: true, resolution: 'source-footprint-preserved' });
            continue;
        }
        let ring = b.ring, holes = b.holes, ok = false;
        for (let k = 0; k < 6 && !ok; k++) {
            const shrink = ([x, z]) => [b.c[0] + (x - b.c[0]) * 0.88, b.c[1] + (z - b.c[1]) * 0.88];
            ring = ring.map(shrink); holes = holes.map(h => h.map(shrink)); ok = !bBad(ring, { ...b, holes });
        }
        if (!ok || Math.abs(signedArea(ring)) < 8) { b.skip = true; b.dropped = true; bDropped++; continue; }
        clearanceAudit.push({ source: data.buildingIds?.[b.i] || b.i, before: b.area, after: Math.abs(signedArea(ring)) });
        b.ring = ring; b.holes = holes; b.area = Math.abs(signedArea(ring)); bShrunk++;
        b.x0 = Math.min(...ring.map(p => p[0])); b.x1 = Math.max(...ring.map(p => p[0])); b.z0 = Math.min(...ring.map(p => p[1])); b.z1 = Math.max(...ring.map(p => p[1]));
    }
    // OSM 3-D outlines can have a separately mapped part over their whole footprint.
    // Keep both source records for audits, but draw/collide only the complete part.
    // Recheck after runtime clearance: an altered or dropped part cannot erase its outline.
    const coveredOutlines = [];
    const coveredBy = data.buildingCoveredBy || {}, targetCounts = new Map();
    for (const value of Object.values(coveredBy)) if (Number.isInteger(value)) targetCounts.set(value, (targetCounts.get(value) || 0) + 1);
    const ringKey = ring => {
        const pts = ring.map(([x, z]) => Math.round(x * 1e4) + ',' + Math.round(z * 1e4)), keys = [];
        for (const seq of [pts, [...pts].reverse()]) for (let i = 0; i < seq.length; i++) keys.push(seq.slice(i).concat(seq.slice(0, i)).join(';'));
        return keys.sort()[0] || '';
    };
    const footprintKey = b => ringKey(b.ring) + '|' + b.holes.map(ringKey).sort().join('|');
    for (const [key, index] of Object.entries(coveredBy)) {
        const baseIndex = Number(key), base = bRecs[baseIndex], part = bRecs[index];
        if (!Number.isInteger(baseIndex) || !Number.isInteger(index) || baseIndex === index || !base || !part || base.skip || part.skip || targetCounts.get(index) !== 1 || Object.hasOwn(coveredBy, index)) continue;
        if (part.minH > 0 || part.h + 1e-6 < base.h || footprintKey(base) !== footprintKey(part)) continue;
        base.skip = true; base.coveredBy = index;
        if (!part.name) { part.name = base.name; part.flags |= base.flags & (2 | 8); }
        part.flags |= base.flags & 1; // a sourced ground-floor tenant remains on the complete building
        if (!part.type || part.type === 'yes') part.type = base.type;
        for (const field of ['year', 'material', 'levels']) if (!part[field]) part[field] = base[field];
        coveredOutlines.push({ outline: data.buildingIds?.[baseIndex] || baseIndex, part: data.buildingIds?.[index] || index, type: part.type, levels: part.levels, name: part.name, sign: !!(part.flags & 2) });
    }
    const assemblyAudit = [], assemblyRejected = [];
    const claimedParts = new Map();
    for (const [key, spec] of Object.entries(data.buildingAssemblies || {})) for (const i of spec.parts || []) claimedParts.set(i, (claimedParts.get(i) || 0) + 1);
    for (const [key, spec] of Object.entries(data.buildingAssemblies || {})) {
        const base = bRecs[Number(key)], indices = spec.parts || [], parts = indices.map(i => bRecs[i]);
        const invalid = !base || base.skip ? 'missing-or-inactive-outline' : base.holes.length ? 'unsupported-courtyard-outline' : !parts.length ? 'empty-parts' : new Set(indices).size !== indices.length ? 'duplicate-part' : parts.some((p, n) => !p || p.skip || p === base || claimedParts.get(indices[n]) !== 1) ? 'missing-inactive-or-ambiguous-part' : parts.some(p => p.holes.length) ? 'unsupported-part-courtyard' : null;
        if (invalid) { assemblyRejected.push({ outline: data.buildingIds?.[Number(key)] || Number(key), reason: invalid }); continue; }
        const cached = spec.geometry, keepOutline = spec.mode === 'union';
        if (!cached || !Array.isArray(cached.residuals) || !Array.isArray(cached.surfaces) || !signatureMatches(cached.signature, assemblySignature(base, parts)) || cached.surfaces.length !== parts.length + cached.residuals.length + (keepOutline ? 1 : 0)) {
            assemblyRejected.push({ outline: data.buildingIds?.[base.i] || base.i, reason: 'prepared-geometry-mismatch' }); continue;
        }
        const residualH = spec.residualHeightM ?? spec.residualHeightDm / 10;
        const ground = parts.filter(p => p.minH === 0);
        const residuals = cached.residuals.map((source, n) => {
            const ring = geometryRing(source.ring, data.buildingGeometryPoints), x0 = Math.min(...ring.map(p => p[0])), x1 = Math.max(...ring.map(p => p[0])), z0 = Math.min(...ring.map(p => p[1])), z1 = Math.max(...ring.map(p => p[1]));
            return { ...base, i: bRecs.length + n, ring, holes: [], c: centroid(ring), x0, x1, z0, z1, area: Math.abs(signedArea(ring)), h: source.h, minH: 0, roof: 'flat', roofProfile: null, levels: 0, flags: base.flags & 32, name: '', derivedFrom: base.i };
        });
        base.skip = !keepOutline; base.assemblyParts = indices;
        const volumes = keepOutline ? [base, ...parts] : [...parts, ...residuals];
        for (const [ordinal, p] of volumes.entries()) {
            p.assemblySurface = geometrySurface(cached.surfaces[ordinal], data.buildingGeometryPoints);
            p.assembly = volumes; p.roof = p.roofProfile ? p.roofProfile.shape : (p.flags & 16) ? p.roof : 'flat';
            if (!p.type || p.type === 'yes') { p.type = base.type; if (p.style === 'plain' && p.area > 40 && !/glass/.test(p.material || '')) p.style = base.style; }
            for (const field of ['year', 'material']) if (!p[field]) p[field] = base[field];
        }
        // The source name belongs to the whole assembly, not to each tier.
        const primary = keepOutline ? base : ground.reduce((a, b) => a.area > b.area ? a : b);
        if (!primary.name) { primary.name = base.name; primary.flags |= base.flags & (1 | 2 | 8); }
        base.assemblyPrimary = primary.i;
        bRecs.push(...residuals);
        assemblyAudit.push({ mode: spec.mode, outline: data.buildingIds?.[base.i] || base.i, parts: indices.map(i => data.buildingIds?.[i] || i), residualArea: residuals.reduce((sum, p) => sum + p.area, 0), residualHeight: residualH, residualHeightSource: spec.residualHeightSource, residualHeights: [...new Set(residuals.map(p => p.h))].sort((a, b) => a - b), cells: residuals.length });
    }
    // ---- unpaired 3-D outlines (owner, 2026-11-12, Unirii bus stop: "WAT are those") OSM maps a detailed building as an
    // outline plus building:part volumes; the outline is then only an envelope. Where the prepared data did not pair them
    // (a part vertex 16 mm outside the outline), the outline was drawn at its style-estimated height and the overlap cut
    // below removed the measured parts inside it: two 3 m bus shelters stood as 7.2 m houses. An outline whose height is
    // only a style estimate, and whose footprint is covered by buildings with tagged heights standing inside it (at least
    // one of them from the ground), is not drawn: the tagged volumes are.
    const outlineParts = { outlines: 0, samples: [] };
    {
        const tagged = new BoxGrid(32);
        for (const p of bRecs) if (!p.skip && !p.assembly && p.ring?.length >= 3 && !p.holes.length && /^OSM /.test(p.roofProfile?.heightSource || '')) tagged.insert(p.x0, p.z0, p.x1, p.z1, p);
        const within = (x, z, ring, tol) => { if (pointInPolygon(x, z, ring)) return true; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if (distPointSeg(x, z, ring[j][0], ring[j][1], ring[i][0], ring[i][1]).d <= tol) return true; return false; };
        for (const o of bRecs) {
            if (o.skip || o.assembly || o.assemblyParts || !(o.ring?.length >= 3) || o.holes.length || o.minH > 0 || o.roofProfile?.heightSource !== 'style estimate') continue;
            const inside = new Set();
            tagged.each(o.x0, o.z0, o.x1, o.z1, p => { if (p !== o && !p.skip && p.x0 >= o.x0 - .3 && p.x1 <= o.x1 + .3 && p.z0 >= o.z0 - .3 && p.z1 <= o.z1 + .3 && p.ring.every(([x, z]) => within(x, z, o.ring, .3))) inside.add(p); });
            const ground = [...inside].filter(p => !(p.minH > 0)); if (!ground.length) continue;
            const step = Math.max(.2, Math.min(o.x1 - o.x0, o.z1 - o.z0) / 16); let n = 0, covered = 0;
            for (let x = o.x0 + step / 2; x < o.x1; x += step) for (let z = o.z0 + step / 2; z < o.z1; z += step) {
                if (!pointInPolygon(x, z, o.ring)) continue; n++;
                for (const p of inside) if (pointInPolygon(x, z, p.ring)) { covered++; break; }
            }
            if (!n || covered < n * .9) continue;
            o.skip = true; o.replacedByParts = [...inside].map(p => p.i);
            const primary = ground.reduce((a, b) => a.area > b.area ? a : b);
            if (o.name && !primary.name) { primary.name = o.name; primary.flags |= o.flags & (1 | 2 | 8); }
            for (const p of inside) if (!p.type || p.type === 'yes') p.type = o.type;
            outlineParts.outlines++; if (outlineParts.samples.length < 40) outlineParts.samples.push({ outline: data.buildingIds?.[o.i] || o.i, parts: [...inside].map(p => data.buildingIds?.[p.i] || p.i), coverage: +(covered / n).toFixed(3), estimatedH: o.h });
        }
    }
    // ---- overlapping source buildings (building-overlap.js): a lower building is cut to stop at a taller one's walls
    const overlapCuts = { pairs: 0, cut: 0, removedM2: 0, skipped: {}, samples: [] };
    {
        const plan = buildPool ? await planOverlapCutsParallel(bRecs, buildPool) : planOverlapCuts(bRecs);
        for (const q of plan.skipped) overlapCuts.skipped[q.reason] = (overlapCuts.skipped[q.reason] || 0) + 1;
        for (const cut of plan.cuts) {
            const L = cut.lower; overlapCuts.pairs += cut.tallers.length; overlapCuts.removedM2 += cut.removedM2;
            if (overlapCuts.samples.length < 40 || L.assembly) overlapCuts.samples.push({ lower: L.sourceId ?? L.i, tallers: cut.tallers.map(t => t.sourceId ?? t.i), overlapM2: Math.round(cut.overlapM2), pieces: cut.pieces.length, ...(L.assembly ? { assemblyMember: true, at: [Math.round(L.c?.[0] ?? (L.x0 + L.x1) / 2), Math.round(L.c?.[1] ?? (L.z0 + L.z1) / 2)], h: L.h } : {}) });
            L.skip = true; L.overlapCutBy = cut.tallers.map(t => t.i); overlapCuts.cut++;
            const primary = cut.pieces.reduce((a, b) => Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a, cut.pieces[0]);
            for (const ring of cut.pieces) {
                let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
                const own = ring === primary; // the name, sign and ground-floor tenant stay on the largest piece
                bRecs.push({ ...L, ...(L.assembly ? { assembly: null, assemblySurface: null, assemblyCut: true } : {}), i: bRecs.length, ring, holes: [], c: centroid(ring), x0, z0, x1, z1, area: Math.abs(signedArea(ring)), skip: false, derivedFrom: L.i, overlapCut: true, name: own ? L.name : '', flags: own ? L.flags : (L.flags & ~(1 | 2 | 8)) });
            }
        }
        overlapCuts.removedM2 = Math.round(overlapCuts.removedM2);
    }
    for(const b of bRecs)if(b.derivedFrom!==undefined)configurePassages(b);
    // (spec 10 load budget) the source roofs the building loop will mesh (a roof profile, no prepared roof surface) are
    // meshed in the build workers meanwhile, from the ring, holes and profile each building has now; the loop uses one only
    // while the building still has those same objects (else it meshes the roof itself, as before)
    const roofPrefetch = buildPool ? buildPool.roofMeshes(bRecs.filter(b => !b.skip && !b.canopy && b.roofProfile && !data.buildingRoofSurfaces?.[b.i]).map(b => ({ key: b, ring: b.ring, holes: b.holes, profile: b.roofProfile }))).catch(err => (console.warn('[world] roof workers failed, meshing here', err), null)) : null;
    const buildingIndex = (index, x, z) => {
        const b = bRecs[index];
        if (b?.assemblyParts) return b.assemblyParts.find(i => { const p = bRecs[i]; return p.minH === 0 && pointInPolygon(x ?? b.c[0], z ?? b.c[1], p.ring); }) ?? b.assemblyPrimary;
        return b?.coveredBy ?? index;
    };
    const bGrid = new BoxGrid(32);
    for (const b of bRecs) bGrid.insert(b.x0, b.z0, b.x1, b.z1, b);
    const buildingAt = (x, z) => { let r = null; bGrid.each(x, z, x, z, (b) => { if (!r && !b.skip && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pointInPolygon(x, z, b.ring) && !b.holes.some(h => pointInPolygon(x, z, h))) r = b; }); return r; };

    // landmarks (another module; optional)
    let LANDMARKS = [], buildLandmarkFn = null, landmarkSurfaceMats = [];
    try { const mod = await landmarksModule(); landmarkSurfaceMats = mod.landmarkSurfaceMaterials?.() || []; LANDMARKS = (mod.LANDMARKS || []).filter(l => l.city === city.id); buildLandmarkFn = mod.buildLandmark || null; } catch (err) { LANDMARKS = []; }
    // a district only builds its own landmarks (+ distant backdrops such as Rainier)
    // (a landmark the district lists explicitly may stand outside it, up to ~2.5 km: skyline landmarks seen down an
    //  avenue, e.g. the Parliament / People's Salvation Cathedral at the west end of Bd. Unirii seen from Piața Unirii)
    if (distCfg) LANDMARKS = LANDMARKS.filter(l => (distCfg.landmarks ? distCfg.landmarks.includes(l.id) : true) && (l.backdrop || inDistrictLL(l.lat, l.lon, distCfg.landmarks ? 0.022 : 0.004)));
    const landmarks = [], landmarkSourceReplacements = [];
    return {
        LANDMARKS, assemblyAudit, assemblyRejected, bDropped, bGrid, bRecs, bShrunk, buildLandmarkFn,
        buildingAt, buildingIndex, buildingPassageAudit, carParkOutlines, clearanceAudit, coveredOutlines, entranceCanopies, heightFixes,
        landmarkSourceReplacements, landmarkSurfaceMats, landmarks, mapEnds, outlineParts, overlapCuts, roofPrefetch, roofProfileAudit,
        tramDeckSupportAt,
    };
}
