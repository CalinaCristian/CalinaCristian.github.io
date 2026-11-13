// ============================================================================
//  T
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { emitPlaygrounds } from './playgrounds.js';
import { emitCarParkFronts } from './car-park-fronts.js';
import { emitPedestrianBridges } from './pedestrian-bridges.js';
import * as THREE from '../vendor/three.module.min.js';
import { distPointSeg, makeRng, pointInPolygon } from './util.js';
import { MeshBuilder, rgb, shadeRgb } from './geobuild.js';
import { scenerySourceProfile } from './scenery-source.js';
import { sceneryBridgeProfiles, sceneryDeckBand } from './scenery-bridges.js';
import { fallbackGroundApertures } from './fallback-ground.js';
import { backdropSourceOwner } from './backdrop-source-owner.js';
import { sidewalkWidth } from './sidewalk-source.js';
import { emitMonuments } from './monuments.js';
import { emitParkWalls } from './park-walls.js';
import { emitRetainingBanks } from './retaining-banks.js';
import { emitFacadeBands } from './facade-bands.js';
import { emitWeirs } from './weirs.js';
import { emitBellevueGuideway } from './bellevue-guideway.js';
import { emitSeatacGuideway } from './seatac-guideway.js';
import { buildElevatedSources } from './elevated-sources.js';
import { emitAirportForecourt } from './airport-forecourt.js';
import { emitAreaFences } from './area-fences.js';
import { emitUnderpassMouths } from './underpass-mouths.js';
import { PALETTES, Y, props, shoulderOf, undelta } from './world-shared.js';

export function buildScenery(ctx) {
    const {
        ASPHALT, LANDMARKS, US, addPropColl, atlas, bGrid, bRecs, bounds,
        buildingAt, cellOf, city, country, data, distCfg, distId, edges,
        elevatedDataset, elevatedPlan, env, fenceSegs, group, isPark, isWater, landmarks,
        liftOnSide, nearWater, nearestEdge, obbPoly, onRibbon, polyDist, polyOnRibbon, propColl,
        raisedTop, retract, rng, sceneryDeckGrid, signs, sportMat, str, surfacesAt,
        sweptOut, tramGrades, tramSweep,
    } = ctx;
 sportMat.name = 'sport-ground'; // (own weather: a dusting, not buried like a lawn)
    const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true }); roofMat.name = 'roofs';
    const backdropMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlas, emissive: new THREE.Color('#ffc98a'), emissiveIntensity: 0 }); backdropMat.name = 'backdrop';
    // (after round 6) the distant city keeps its lights on at night: a procedural window grid on the walls (≈ 38 % lit,
    // warm, per-window brightness), averaged into an even glow where the cells get sub-pixel (no shimmer); render.js eases
    // emissiveIntensity to userData.nightEmissive at night
    backdropMat.userData.nightEmissive = 0.9;
    backdropMat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying vec3 vBW;\nvarying vec3 vBN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvBW = (modelMatrix * vec4(transformed, 1.0)).xyz; vBN = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = 'varying vec3 vBW;\nvarying vec3 vBN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
            // facade atlas on the walls only: a roof is plain (no windows on top of the boxes), a touch darker
            if (abs(vBN.y) < 0.5) diffuseColor *= texture2D(map, vMapUv); else diffuseColor.rgb *= 0.62;
        #endif`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {   float wall = 1.0 - smoothstep(0.3, 0.6, abs(vBN.y));
            vec2 tg = normalize(vec2(-vBN.z, vBN.x) + 1e-5);
            vec2 cell = vec2(dot(vBW.xz, tg), vBW.y - 1.0) / vec2(3.2, 3.0);
            vec2 id = floor(cell), f = fract(cell);
            float h = fract(sin(dot(id + floor(vBW.xz * 0.03) * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
            float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.28, f.y) * step(f.y, 0.82);
            float lit = step(h, 0.38) * (0.6 + 0.8 * fract(h * 37.0));
            float fw = length(fwidth(cell));
            float m = mix(win * lit, 0.31 * 0.38, smoothstep(0.35, 0.9, fw));
            totalEmissiveRadiance *= wall * m * step(0.0, cell.y); }`);
    };
    backdropMat.customProgramCacheKey = () => 'backdrop-night2';
    const signTex = signs.textures();
    // (owner L23 / #25: a facade sign flickering) a sign stands 0.14 m off its wall; with the 0.2 m near plane the depth
    // buffer cannot hold 0.14 m apart beyond about 600 m (drone views), so the wall and the sign fought. A small polygon
    // offset keeps the sign in front of its wall at any distance, as road markings over the asphalt
    const signMats = signTex.map(t => new THREE.MeshBasicMaterial({ map: t, color: '#e8e8e8', alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    // ---- front-garden boundaries (district worlds, Bucharest, 2026-11-08): along residential streets the property line
    //      behind the sidewalk is a railing on a low plinth, a plastered wall or a hedge (one kind per stretch, a gate /
    //      driveway gap every 15–35 m), wherever a garden lies between the sidewalk and the house. Visual only (no
    //      collision: pedestrians keep their sidewalk lines).
    let fenceM = 0;
    if (!US) {
        const fRng = makeRng(7331);
        const kindsF = [['rail', '#2f3a33'], ['rail', '#1f2326'], ['rail', '#4a4f55'], ['wall', '#d8cfbf'], ['wall', '#c9c2b4'], ['wall', '#e6dfd2'], ['rail', '#26292c'], ['wall', '#bfb8aa'], ['hedge', '#355e2e'], ['rail', '#3b4a3f'], ['rail', '#5a4a3c']];
        const plinth = rgb('#b8b2a6');
        for (const e of edges) {
            if (!e.drivable || e.virtual || e.tunnel || e.bridge || e.len < 16 || Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3) continue;
            if (!/^(residential|unclassified|living_street|tertiary)$/.test(e.type) || e.sidewalk < 1.2) continue;
            for (const sd of [1, -1]) {
                const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e), o = w + e.sidewalk + 0.12;
                const s0 = retract(e, e.a) + 4, s1 = e.len - retract(e, e.b) - 4; if (s1 - s0 < 6) continue;
                let run = null;
                // (2026-11-08, owner: "some of these fences don't make sense and they are not continuous") one boundary per plot,
                // chosen from the building behind it: apartment blocks keep open lawns (none, or a low railing); villas a
                // railing on a plinth, a plastered wall topped by a railing, a hedge, rarely a solid wall. No random gaps.
                const plotOf = (x, z) => { const ix = x + e.nx * sd * 7, iz = z + e.nz * sd * 7; let best = null, bd = 22;
                    bGrid.each(ix - 22, iz - 22, ix + 22, iz + 22, (b) => { if (b.skip || b.area < 25) return; const d2 = polyDist(ix, iz, b.ring); if (d2 < bd) { bd = d2; best = b; } }); return best; };
                const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }; // (deterministic per building)
                const kindOf = (b) => { if (!b) return null; const hh = hash01(b.i * 7919 + 17);
                    if (b.style === 'bloc' || b.h > 10.5 || b.area > 450) return hh < 0.55 ? null : ['low', '#2f3a33'];
                    const tone = ['#2f3a33', '#1f2326', '#4a4f55', '#26292c'][Math.floor(hash01(b.i * 104729 + 3) * 4)], plaster = ['#d8cfbf', '#c9c2b4', '#e6dfd2', '#bfb8aa'][Math.floor(hash01(b.i * 1299709 + 5) * 4)];
                    return hh < 0.5 ? ['rail', tone] : hh < 0.72 ? ['hedge', '#355e2e'] : hh < 0.92 ? ['wallrail', plaster, tone] : ['wall', plaster]; };
                let curPlot = undefined;
                const ok = (sAl) => {
                    const x = e.a.x + e.dirx * sAl + e.nx * o * sd, z = e.a.z + e.dirz * sAl + e.nz * o * sd;
                    if (onRibbon(x, z, 0.3) || buildingAt(x, z) || nearWater(x, z, 0.5)) return null;
                    if (fenceSegs.some(([ax, az, bx, bz]) => Math.abs(ax - x) < 12 && Math.abs(az - z) < 12 && distPointSeg(x, z, ax, az, bx, bz).d < 4)) return null; // (a landmark's own fence is there)
                    // Empty space alone is not evidence of a private garden: museums,
                    // civic forecourts and parks must not acquire invented perimeter walls.
                    const ix = x + e.nx * sd * 1.5, iz = z + e.nz * sd * 1.5; if (buildingAt(ix, iz)) return null;
                    if (isPark(ix, iz)) return null;
                    let home = null;
                    for (const depth of [3, 6, 10, 16, 24, 32]) {
                        const b = buildingAt(x + e.nx * sd * depth, z + e.nz * sd * depth);
                        if (b) { home = b; break; }
                    }
                    if (!home || home.name || (home.flags & 1) || home.h > 20 || !/^(house|interwar|eclectic|bloc)$/.test(home.style)) return null;
                    return [x, z];
                };
                const flushRun = () => {
                    if (!run || run.pts.length < 2) { run = null; return; }
                    const [k, hex] = run.kind, col = rgb(hex), pts = run.pts;
                    // (2026-11-08, owner: "some of them end abruptly") no stubs under 6 m; railings / walls end on a pier
                    let runL = 0; for (let i = 0; i < pts.length - 1; i++) runL += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
                    if (runL < 6) { run = null; return; }
                    if (k !== 'hedge') for (const q of [pts[0], pts[pts.length - 1]]) { const cq = cellOf(q[0], q[1]), v0 = cq.solid.vc; cq.solid.box(q[0], Y.side, q[1], k === 'low' ? 0.12 : 0.42, k === 'low' ? 0.8 : 1.75, k === 'low' ? 0.12 : 0.42, 0, k === 'wall' || k === 'wallrail' ? shadeRgb(col, 0.95) : k === 'low' ? col : rgb('#cfc8b8')); liftOnSide(cq, v0, null, q[0], q[1], 0.6); }
                    for (let i = 0; i < pts.length - 1; i++) {
                        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
                        const mx = (ax + bx) / 2, mz = (az + bz) / 2, ang = Math.atan2(bx - ax, bz - az), c = cellOf(mx, mz), v0s = c.solid.vc, v0d = c.detail.vc;
                        if (k === 'wall') { c.solid.box(mx, Y.side, mz, 0.22, 1.6, L + 0.02, ang, col); c.solid.box(mx, Y.side + 1.6, mz, 0.3, 0.07, L + 0.02, ang, shadeRgb(col, 0.82)); }
                        else if (k === 'low') { // a low railing round a block's lawn: two rails on posts
                            c.solid.box(mx, Y.side, mz, 0.12, 0.1, L + 0.02, ang, plinth);
                            c.detail.box(mx, Y.side + 0.68, mz, 0.04, 0.04, L, ang, col); c.detail.box(mx, Y.side + 0.35, mz, 0.03, 0.03, L, ang, col);
                            c.detail.box(ax, Y.side, az, 0.05, 0.72, 0.05, ang, col); }
                        else if (k === 'wallrail') { // a plastered wall with a coping, an iron railing on top, piers every few metres
                            const rc = rgb(run.kind[2] || '#26292c');
                            c.solid.box(mx, Y.side, mz, 0.3, 0.9, L + 0.02, ang, col); c.solid.box(mx, Y.side + 0.9, mz, 0.36, 0.06, L + 0.02, ang, shadeRgb(col, 0.85));
                            c.solid.box(mx, Y.side + 1.58, mz, 0.04, 0.04, L, ang, rc);
                            const nP = Math.max(1, Math.round(L / 0.18)), ux = (bx - ax) / L, uz = (bz - az) / L, pnx = -uz, pnz = ux;
                            for (let j = 1; j < nP; j++) { const f = j / nP, px = ax + (bx - ax) * f, pz = az + (bz - az) * f;
                                c.detail.wall(px - ux * 0.012, pz - uz * 0.012, px + ux * 0.012, pz + uz * 0.012, Y.side + 0.96, Y.side + 1.6, pnx, pnz, rc);
                                c.detail.wall(px + ux * 0.012, pz + uz * 0.012, px - ux * 0.012, pz - uz * 0.012, Y.side + 0.96, Y.side + 1.6, -pnx, -pnz, rc); }
                            if (i % 2 === 0) c.solid.box(ax, Y.side, az, 0.42, 1.75, 0.42, ang, shadeRgb(col, 0.95)); }
                        else if (k === 'hedge') { // a clipped hedge: uneven, rounded top, mottled greens (a flat green box read as a painted fence)
                            const ux = (bx - ax) / L, uz = (bz - az) / L, n2 = Math.max(1, Math.round(L / 0.9));
                            for (let j = 0; j < n2; j++) { const f = (j + 0.5) / n2, px = ax + (bx - ax) * f, pz = az + (bz - az) * f, hh2 = 1.25 + fRng() * 0.35, ww = 0.75 + fRng() * 0.25;
                                const g = shadeRgb(col, 0.8 + fRng() * 0.35); c.solid.box(px, Y.side, pz, ww, hh2, L / n2 + 0.2, ang, g);
                                c.solid.geo(props().sphere, px, Y.side + hh2 - 0.05, pz, ang, ww * 0.55, 0.28, L / n2 * 0.65 + 0.15, shadeRgb(g, 1.12)); }
                        }
                        else { // railing: plinth, two rails, posts every ~2 m and pickets as thin boxes (near LOD)
                            c.solid.box(mx, Y.side, mz, 0.26, 0.45, L + 0.02, ang, plinth);
                            c.solid.box(mx, Y.side + 1.55, mz, 0.05, 0.05, L, ang, col); c.detail.box(mx, Y.side + 0.62, mz, 0.04, 0.04, L, ang, col);
                            c.detail.box(ax, Y.side + 0.45, az, 0.08, 1.2, 0.08, ang, col);
                            // pickets: a 3 cm strip seen from both sides every 25 cm (4 triangles each, near LOD)
                            const nP = Math.max(1, Math.round(L / 0.25)), ux = (bx - ax) / L, uz = (bz - az) / L, pnx = -uz, pnz = ux;
                            for (let j = 1; j < nP; j++) { const f = j / nP, px = ax + (bx - ax) * f, pz = az + (bz - az) * f;
                                c.detail.wall(px - ux * 0.015, pz - uz * 0.015, px + ux * 0.015, pz + uz * 0.015, Y.side + 0.45, Y.side + 1.57, pnx, pnz, col);
                                c.detail.wall(px + ux * 0.015, pz + uz * 0.015, px - ux * 0.015, pz - uz * 0.015, Y.side + 0.45, Y.side + 1.57, -pnx, -pnz, col); }
                        }
                        liftOnSide(c, v0s, v0d, mx, mz, 0.6); // (on the raised sidewalk's back edge)
                        // (2026-11-08, owner: "I shouldn't be able to drive into this") solid: walls, hedges and railings collide
                        { const hwC = k === 'hedge' ? 0.45 : 0.15; propColl.push({ x: mx, z: mz, hw: hwC, hd: L / 2 + 0.05, angle: ang, r: Math.hypot(hwC, L / 2 + 0.05), poly: null, h: k === 'low' ? 0.8 : k === 'hedge' ? 1.5 : 1.7, prop: true, kind: 'fence' }); }
                        fenceM += L;
                    }
                    run = null;
                };
                for (let sAl = s0; sAl <= s1; sAl += 2) {
                    const p = ok(sAl);
                    if (!p) { flushRun(); curPlot = undefined; continue; }
                    const pl = plotOf(p[0], p[1]);
                    if (pl !== curPlot) { if (run) { run.pts.push(p); flushRun(); } curPlot = pl; } // (the next plot's boundary starts where this one ends: continuous)
                    const kind = kindOf(pl); if (!kind) { flushRun(); continue; }
                    if (!run) run = { kind, pts: [] };
                    run.pts.push(p);
                }
                flushRun();
            }
        }
    }
    // ---- kerb bollards (district worlds, Bucharest, 2026-11-08): the anti-parking posts that line the kerbs of the main
    //      streets wherever parking is not allowed (OSM parking:<side>=no; untagged sides of every other main street), with
    //      gaps at junctions, crossings and driveways. Visual only (near LOD).
    let bollards = 0;
    if (!US) {
        const RI = data.roadInfo || [], bc = rgb('#3a3d42'), cap = rgb('#b9b9b4');
        for (const e of edges) {
            if (!e.drivable || e.virtual || e.tunnel || e.bridge || e.len < 14 || Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3) continue;
            if (!/^(primary|secondary|tertiary)$/.test(e.type) || e.sidewalk < 1.5) continue;
            const rf = RI[e.road * 6 + 1] | 0;
            for (const sd of [1, -1]) {
                if (sidewalkWidth(e, sd) < 1.5) continue;
                const yes = sd > 0 ? (rf & 64) : (rf & 128), no = sd > 0 ? (rf & 256) : (rf & 512);
                if (yes || (!no && ((e.road * 31 + (sd > 0 ? 7 : 3)) % 2))) continue;
                const o = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + 0.35;
                const s0 = retract(e, e.a) + 3 + (e.a.crossing ? 5 : 0), s1 = e.len - retract(e, e.b) - 3 - (e.b.crossing ? 5 : 0);
                let gapAt = s0 + 25 + ((e.id * 13) % 20);
                for (let sAl = s0; sAl < s1; sAl += 2.2) {
                    if (sAl > gapAt) { sAl += 4; gapAt = sAl + 25 + ((e.id * 7 + Math.round(sAl)) % 25); continue; } // (a driveway / gate)
                    const x = e.a.x + e.dirx * sAl + e.nx * o * sd, z = e.a.z + e.dirz * sAl + e.nz * o * sd;
                    if (onRibbon(x, z, 0.15) || buildingAt(x, z)) continue;
                    if (sweptOut('bollard', tramSweep?.circle(x, z, .1, 0, 3))) continue; // (a generated row; its collider spans 0-3 m)
                    const c = cellOf(x, z), v0d = c.detail.vc; c.detail.box(x, Y.side, z, 0.11, 0.85, 0.11, 0, bc); c.detail.box(x, Y.side + 0.85, z, 0.13, 0.05, 0.13, 0, cap); bollards++;
                    liftOnSide(c, c.solid.vc, v0d, x, z);
                    addPropColl(x, z, 0.1, 'bollard'); // (owner: "I can drive through this") solid, like the OSM bollards
                }
            }
        }
    }
    // scenery streets (district worlds, 2026-11-08): the real streets of the ring of buildings outside the playable area
    // (data.scenery from build-data: carriageway width, sidewalk, class, flags, polyline) as flat asphalt + sidewalk strips,
    // below the drivable ribbons (no traffic, no markings beyond a centre dash on two-way main streets)
    let sceneryStreets = 0;
    const scenerySourceAudit = { precisePieces: 0, literalWidthPieces: 0, reviewedWidthPieces: 0, estimatedWidthPieces: 0, fallbackPieces: 0, resolvedWidths: [], issues: [] };
    {
        const SC = data.scenery || [], asp = rgb(ASPHALT), side = rgb(US ? '#a4a29d' : '#9d9a92'), dash = rgb('#cfcfca');
        const sourceProfiles = SC.map((r, i) => scenerySourceProfile(data, i, undelta(r, 4)));
        const bridgeProfiles = sceneryBridgeProfiles(data, sourceProfiles, edges);
        scenerySourceAudit.bridges = bridgeProfiles.stats;
        const yA = Y.side + 0.05, yS = Y.side + 0.03;
        const strip = (pts, l0, l1, y, col, heights = null, covered = null) => {
            for (let i = 0; i < pts.length - 1; i++) {
                if (covered?.[i]) continue;
                const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < (heights ? 1e-6 : 0.2)) continue;
                // mitred offsets at the joints
                const nrm = (k) => { const [px, pz] = pts[Math.max(0, k - 1)], [qx, qz] = pts[Math.min(pts.length - 1, k + 1)]; const l = Math.hypot(qx - px, qz - pz) || 1; return [-(qz - pz) / l, (qx - px) / l]; };
                const [n0x, n0z] = nrm(i), [n1x, n1z] = nrm(i + 1);
                const c = cellOf((ax + bx) / 2, (az + bz) / 2);
                if (heights) c.ground.face4([ax + n0x * l0, y + heights[i], az + n0z * l0], [bx + n1x * l0, y + heights[i + 1], bz + n1z * l0], [bx + n1x * l1, y + heights[i + 1], bz + n1z * l1], [ax + n0x * l1, y + heights[i], az + n0z * l1], col, [0, 1, 0]);
                else c.ground.flatQuad(ax + n0x * l0, az + n0z * l0, bx + n1x * l0, bz + n1z * l0, bx + n1x * l1, bz + n1z * l1, ax + n0x * l1, az + n0z * l1, y, col);
            }
        };
        for (const [ri, r] of SC.entries()) {
            const sw = r[1] / 10, cls = data.classes[r[2]] || 'residential', fl = r[3];
            const profile = sourceProfiles[ri], bridge = bridgeProfiles.profiles.get(ri), pts = bridge?.points || profile.points, wC = profile.widthM, heights = bridge?.heights;
            if (pts.length < 2) continue;
            scenerySourceAudit[profile.precise ? 'precisePieces' : 'fallbackPieces']++;
            scenerySourceAudit[profile.widthSource === 'OSM width' ? 'literalWidthPieces' : profile.review ? 'reviewedWidthPieces' : 'estimatedWidthPieces']++;
            if (profile.rawWidth || profile.review) scenerySourceAudit.resolvedWidths.push({ piece: ri, sourceId: profile.sourceId, widthM: profile.widthM, leftM: profile.leftM, rightM: profile.rightM, widthSource: profile.widthSource, rawWidth: profile.rawWidth, review: profile.review });
            if (profile.issue) scenerySourceAudit.issues.push({ piece: ri, sourceId: profile.sourceId, reason: profile.issue });
            strip(pts, -profile.leftM, profile.rightM, bridge ? Y.road : yA, asp, heights, bridge?.coveredSegments);
            const sideM = sw > 0.5 && !/service|motorway/.test(cls) ? Math.max(1.2, sw) : 0;
            // (owner, 2026-11-12, Bd. Unirii east: the fountain median was a slab of paving) one carriageway of a divided street
            // has its pavement on the outer side only (OSM oneway=yes + sidewalk=right|left): the median side gets none, so the
            // median shows its mapped grass instead of two pavements meeting in the middle
            const swTags = data.scenerySourceGeometry?.[ri]?.tags, divided = swTags?.oneway === 'yes' && /^(left|right)$/.test(swTags.sidewalk || '');
            const sideL = divided && swTags.sidewalk === 'right' ? 0 : sideM, sideR = divided && swTags.sidewalk === 'left' ? 0 : sideM;
            if (sideR) strip(pts, profile.rightM, profile.rightM + sideR, bridge ? Y.road : yS, side, heights, bridge?.coveredSegments);
            if (sideL) strip(pts, -profile.leftM - sideL, -profile.leftM, bridge ? Y.road : yS, side, heights, bridge?.coveredSegments);
            if (/primary|secondary|tertiary/.test(cls) && wC > 6) { // dashed centre line
                for (let i = 0; i < pts.length - 1; i++) { if (bridge?.coveredSegments[i]) continue; const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); for (let d = 1; d + 3 < L; d += 9) { const f0 = d / L, f1 = (d + 3) / L; strip([[ax + (bx - ax) * f0, az + (bz - az) * f0], [ax + (bx - ax) * f1, az + (bz - az) * f1]], profile.lineOffsetM - 0.07, profile.lineOffsetM + 0.07, (bridge ? Y.road : yA) + 0.005, dash, heights ? [heights[i] + (heights[i + 1] - heights[i]) * f0, heights[i] + (heights[i + 1] - heights[i]) * f1] : null); } }
            }
            if (bridge) for (let i = 1; i < pts.length; i++) {
                if (bridge.coveredSegments[i - 1]) continue;
                const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-6) continue;
                const nrm = k => { const p = pts[Math.max(0, k - 1)], q = pts[Math.min(pts.length - 1, k + 1)], L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [-(q[1] - p[1]) / L, (q[0] - p[0]) / L]; };
                const n0 = nrm(i - 1), n1 = nrm(i), left = profile.leftM + sideL, right = profile.rightM + sideR;
                const poly = [[a[0] - n0[0] * left, a[1] - n0[1] * left], [b[0] - n1[0] * left, b[1] - n1[1] * left], [b[0] + n1[0] * right, b[1] + n1[1] * right], [a[0] + n0[0] * right, a[1] + n0[1] * right]];
                const band = sceneryDeckBand(a, b, heights[i - 1], heights[i], bridge.thicknessM), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
                const top = [band(...a).top, band(...b).top], bottom = top.map(h => h - bridge.thicknessM), c = cellOf(x, z);
                const vertices = poly.map((p, j) => [p[0], top[j === 0 || j === 3 ? 0 : 1], p[1]]);
                if (bridge.bridge || Math.max(...heights.slice(i - 1, i + 1)) > .05) {
                    for (let j = 0; j < 4; j++) { const k = (j + 1) % 4, lo = v => [v[0], v[1] - bridge.thicknessM, v[2]], outward = [poly[k][1] - poly[j][1], 0, poly[j][0] - poly[k][0]]; c.solid.face4(lo(vertices[j]), lo(vertices[k]), vertices[k], vertices[j], rgb('#99968e'), outward); }
                    c.solid.face4(...vertices.map(v => [v[0], v[1] - bridge.thicknessM, v[2]]), rgb('#55524d'), [0, -1, 0]);
                    // (r3-structures-4) a raised scenery deck had no guard: a plain concrete parapet (0.9 m, 0.3 m thick) on both
                    // edges where the deck stands over 1 m above the street (scenery only, no collision: outside the playable area)
                    if (Math.min(...top) > Y.road + 1) for (const [p0, p1] of [[vertices[0], vertices[1]], [vertices[2], vertices[3]]]) {
                        const dx = p1[0] - p0[0], dz = p1[2] - p0[2], l = Math.hypot(dx, dz); if (l < .05) continue;
                        const ix = -dz / l * .3, iz = dx / l * .3, sgn = ((x - p0[0]) * ix + (z - p0[2]) * iz) > 0 ? 1 : -1, wx = ix * sgn, wz = iz * sgn;
                        const A = [p0[0], p0[1], p0[2]], B = [p1[0], p1[1], p1[2]], up = (v, dy) => [v[0], v[1] + dy, v[2]], inn = v => [v[0] + wx, v[1], v[2] + wz], col = rgb('#a5a39c');
                        c.solid.face4(A, B, up(B, .9), up(A, .9), col, [-wx, 0, -wz]); c.solid.face4(inn(B), inn(A), up(inn(A), .9), up(inn(B), .9), col, [wx, 0, wz]);
                        c.solid.face4(up(A, .9), up(B, .9), up(inn(B), .9), up(inn(A), .9), rgb('#b7b5ae'), [0, 1, 0]);
                    }
                }
                const deck = { x, z, r: Math.max(...poly.map(p => Math.hypot(p[0] - x, p[1] - z))), poly, holes: [], roadDeck: true, kind: 'scenery-road-deck', sourceId: bridge.sourceId, sourceTags: bridge.tags, access: bridge.access, estimated: true, elevationSource: bridge.elevationSource, y0: Math.min(...bottom), y1: Math.max(...top), h: Math.max(...top), roofHeightAt: (px, pz, radius) => band(px, pz, radius).top, minHeightAt: (px, pz, radius) => band(px, pz, radius).bottom };
                sceneryDeckGrid.insert(x - deck.r, z - deck.r, x + deck.r, z + deck.r, deck); propColl.push(deck);
            }
            sceneryStreets++;
        }
    }
    // low-poly backdrop: building masses beyond the corridors (so the horizon is not empty)
    let backdropCount = 0;
    const backdropSourceOwnership = [];
    const builtLandmarks = new Set(landmarks.map(lm => lm.id));
    // (owner register #31 / L25, Unirii: blank blocks in front of the Palace of the Parliament, "buildings inside distant
    // landmarks") backdrop and horizon masses are anonymous filler: none stands inside the grounds of a built landmark
    const landmarkDiscs = landmarks.filter(l => l.radius > 0 && !LANDMARKS.find(m => m.id === l.id)?.backdrop).map(l => ({ x: l.x, z: l.z, r: l.radius }));
    const inLandmarkGrounds = (x, z, w, d) => landmarkDiscs.some(L => Math.hypot(x - L.x, z - L.z) < L.r + Math.hypot(w, d) / 2);
    let backdropInLandmark = 0;
    const backdropBindings = LANDMARKS.filter(lm => builtLandmarks.has(lm.id)).flatMap(lm =>
        (lm.backdropSources?.[distId] || []).map(record => ({...record, landmark:lm.id, declaredSourceIds:lm.sourceIds || []})));
    const ringGeometry = data.district?.geometry || (distCfg?.bands ? {
        pieces: distCfg.bands.map(b => ({ r: b.r, ring: b.sceneryRing !== false, pts: b.line.map(([lat, lon]) => { const p = city.proj(lat, lon); return [p.x, p.z]; }) })),
        circles: (distCfg.circles || []).map(c => ({ ...city.proj(c.lat, c.lon), r: c.r })), polys: [],
    } : null);
    // detailOnly: skip playable strips added after the district data was built (cities.js `sceneryRing: false`): the data has
    // no real footprints round them, so the far backdrop must not be cleared there.
    // The compiled district geometry carries no flags: find the pieces of the `sceneryRing: false` strips by radius and end points.
    const lateStrips = (distCfg?.bands || []).filter(b => b.sceneryRing === false).map(b => ({ r: b.r, pts: b.line.map(([lat, lon]) => { const p = city.proj(lat, lon); return [p.x, p.z]; }) }));
    const sameEnd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 2;
    for (const p of ringGeometry?.pieces || []) if (p.pts?.length && lateStrips.some(b => b.r === p.r && ((sameEnd(b.pts[0], p.pts[0]) && sameEnd(b.pts.at(-1), p.pts.at(-1))) || (sameEnd(b.pts[0], p.pts.at(-1)) && sameEnd(b.pts.at(-1), p.pts[0]))))) p.ring = false;
    const sceneryMargin = (x, z, detailOnly = false) => {
        let margin = Infinity;
        for (const c of ringGeometry?.circles || []) margin = Math.min(margin, Math.hypot(x - c.x, z - c.z) - c.r);
        for (const p of ringGeometry?.pieces || []) if (!(detailOnly && p.ring === false)) for (let i = 1; i < p.pts.length; i++) {
            const a = p.pts[i - 1], b = p.pts[i];
            margin = Math.min(margin, distPointSeg(x, z, a[0], a[1], b[0], b[1]).d - p.r);
        }
        for (const p of ringGeometry?.polys || []) {
            let distance = Infinity;
            for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; distance = Math.min(distance, distPointSeg(x, z, a[0], a[1], b[0], b[1]).d); }
            margin = Math.min(margin, pointInPolygon(x, z, p) ? -distance : distance);
        }
        return margin;
    };
    // Optional source railway scenery. Ground assumptions are explicit; no layer-to-metre conversion or trains.
    const railStats = { sourceWays: data.railways?.length || 0, renderedWays: 0, renderedMetres: 0, ties: 0, unresolved: [] };
    // SeaTac: the Link aerial guideway has a sourced rail level (station platform 18 m), see seatac-guideway.js.
    const seatacGuideway = distId === 'seatac' ? emitSeatacGuideway({ railways: data.railways, undelta, cellOf, rgb, onRibbon, buildingAt, addPropColl,
        keep: (x, z, len) => !(ringGeometry && sceneryMargin(x, z) > (distCfg?.outerRing ?? 600) + len / 2), stationCentre: bRecs.find(b => b.sourceId === 'w54139654')?.c || null }) : null;
    if (seatacGuideway) railStats.guideway = { ways: [...seatacGuideway.ways], metres: seatacGuideway.metres, piers: seatacGuideway.piers, piersOmitted: seatacGuideway.piersOmitted };
    // Bellevue: the 2 Line guideway over I-405 to Wilburton; rail level is a stated estimate over USGS ground, see bellevue-guideway.js.
    const bellevueGuideway = distId === 'bellevue' ? emitBellevueGuideway({ railways: data.railways, scenery: data.scenery, undelta, cellOf, rgb, onRibbon, buildingAt, addPropColl, proj: (la, lo) => city.proj(la, lo),
        keep: (x, z, len) => !(ringGeometry && sceneryMargin(x, z) > (distCfg?.outerRing ?? 600) + len / 2) }) : null;
    if (bellevueGuideway) railStats.bellevueGuideway = { ...bellevueGuideway, ways: [...bellevueGuideway.ways] };
    for (const r of data.railways || []) {
        const t = r.tags || {}, gaugeMM = Number(t.gauge), layer = t.layer == null ? 0 : Number(t.layer);
        if (t.railway === 'abandoned') continue; // OSM abandoned tracks have had their rails removed.
        if (bellevueGuideway?.ways.has(r.id)) { railStats.renderedWays++; continue; }
        if (seatacGuideway?.ways.has(r.id)) { railStats.renderedWays++; continue; }
        if (!(gaugeMM > 0) || !Number.isFinite(layer) || layer !== 0 || (t.bridge && t.bridge !== 'no') || (t.tunnel && t.tunnel !== 'no')) { railStats.unresolved.push({ source: r.id, reason: 'unknown-gauge-or-vertical-placement' }); continue; }
        const pts = undelta(r.points, 0), gauge = gaugeMM / 1000, bedHalf = gauge / 2 + 0.8; let travelled = 0, emitted = false;
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
            const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = uz, nz = -ux, angle = Math.atan2(ux, uz), steps = Math.ceil(L / 12);
            for (let j = 0; j < steps; j++) {
                const lo = j * L / steps, hi = (j + 1) * L / steps, mid = (lo + hi) / 2, x = a[0] + ux * mid, z = a[1] + uz * mid, length = hi - lo;
                // A 1-Lipschitz margin certifies that no portion inside600m is omitted. Small overhang is far context.
                if (ringGeometry && sceneryMargin(x, z) > (distCfg?.outerRing ?? 600) + length / 2) continue;
                const c = cellOf(x, z), ax = a[0] + ux * lo, az = a[1] + uz * lo, bx = a[0] + ux * hi, bz = a[1] + uz * hi;
                c.ground.flatQuad(ax + nx * bedHalf, az + nz * bedHalf, bx + nx * bedHalf, bz + nz * bedHalf, bx - nx * bedHalf, bz - nz * bedHalf, ax - nx * bedHalf, az - nz * bedHalf, 0.135, rgb('#787269'), 0.2, -1);
                for (const sign of [-1, 1]) c.solid.box(x + nx * gauge / 2 * sign, 0.24, z + nz * gauge / 2 * sign, 0.07, 0.06, length + 0.02, angle, rgb('#777b7d'));
                // Ties are flat strips in the existing detail material, without an extra shadow pass.
                for (let s = Math.ceil((travelled + lo) / 0.7) * 0.7 - travelled; s < hi; s += 0.7) {
                    const tx = a[0] + ux * s, tz = a[1] + uz * s, half = gauge / 2 + 0.45, thick = 0.13;
                    c.detail.flatQuad(tx + nx * half - ux * thick, tz + nz * half - uz * thick, tx - nx * half - ux * thick, tz - nz * half - uz * thick, tx - nx * half + ux * thick, tz - nz * half + uz * thick, tx + nx * half + ux * thick, tz + nz * half + uz * thick, 0.21, rgb('#54483b'), 0.1, -1); railStats.ties++;
                }
                railStats.renderedMetres += length; emitted = true;
            }
            travelled += L;
        }
        if (emitted) railStats.renderedWays++;
    }
    railStats.renderedMetres = Math.round(railStats.renderedMetres);
    // Elevated source structures the road builder does not own: rail viaducts (bridge-tagged data.railways) and footbridges
    // (footbridge-sources.js). Geometry, estimates and the rule for supports: elevated-sources.js.
    const elevatedSources = buildElevatedSources(data, { cellOf, undelta, surfacesAt, addPropColl, roadY: Y.road, tramSweep, plan: elevatedPlan, dataset: elevatedDataset,
        visible: (x, z, len) => !ringGeometry || sceneryMargin(x, z) <= (distCfg?.outerRing ?? 600) + len / 2,
        overTrunk: (x, z) => { const q = nearestEdge(x, z, e => /^(motorway|trunk)$/.test(e.type) && !e.virtual, 40); return !!q && q.d < q.edge.halfW + 1.5; } });
    // (round 3) footbridges / skybridges by reviewed class (pedestrian-bridges.js: ASE covered footbridges, the Hilton wing skybridge, the Regie footbridge)
    const pedestrianBridges = emitPedestrianBridges({ dataset: elevatedDataset, proj: (la, lo) => city.proj(la, lo), cellOf, rgb,
        groundAt: (x, z) => { let g = null; surfacesAt(x, z, h => { if (h < 3 && (g === null || h > g)) g = h; }); return g; }, inBuilding: (x, z) => !!buildingAt(x, z) });
    // (fidelity pass r2) free-standing monuments / memorials / artworks at their mapped OSM positions (monuments.js): districts only
    const monuments = emitMonuments({ pois: data.pois.filter(r => data.poiKinds[r[0]] === 'landmark').map(r => ({ name: str(r[3]), sub: str(r[5]), x: r[1] / 10, z: r[2] / 10, building: r[6] })),
        project: (la, lo) => city.proj(la, lo), keep: (x, z) => !ringGeometry || sceneryMargin(x, z) <= 400, cellOf, rgb, shadeRgb, landmarkDiscs: landmarkDiscs.filter(d => d.r <= 12),
        blocked: (x, z, r) => onRibbon(x, z, r) ? 'on-carriageway' : buildingAt(x, z) ? 'inside-building' : underRoof(x, z) ? 'under-roof' : isWater(x, z) ? 'in-water' : tramSweep?.circle(x, z, r + 0.2, 0, 6) ? 'tram-sweep' : null,
        faceAngle: (x, z) => { const q = nearestEdge(x, z, e => !e.virtual && !e.tunnel, 80); return q ? Math.atan2(q.edge.dirx, q.edge.dirz) + Math.PI / 2 : 0; },
        baseY: (x, z) => raisedTop(x, z) ?? 0.05, addCollider: (x, z, r, h, rec) => propColl.push({ x, z, r, hw: r, hd: r, angle: 0, poly: null, h, prop: true, kind: 'monument', sourceId: rec.id, estimated: true }) });
    // (backlog r3-landmarks-9) reviewed boundary walls OSM does not map as barriers, on a mapped outline (park-walls.js)
    const parkWalls = emitParkWalls({ district: distId, project: (la, lo) => city.proj(la, lo), cellOf, rgb, baseY: (x, z) => raisedTop(x, z) ?? 0.05,
        blocked: (x, z, r) => onRibbon(x, z, r) ? 'on-carriageway' : buildingAt(x, z) ? 'inside-building' : tramSweep?.circle(x, z, r + 0.2, 0, 6) ? 'tram-sweep' : null,
        addWall: (ax, az, bx, bz, h, w) => { const L = Math.hypot(bx - ax, bz - az); propColl.push({ x: (ax + bx) / 2, z: (az + bz) / 2, hw: 0.15, hd: L / 2, angle: Math.atan2(bx - ax, bz - az), r: Math.hypot(0.15, L / 2), poly: null, h, prop: true, kind: 'wall', sourceId: w.id, estimated: true }); } });
    // (backlog seatac-6) a reviewed retaining wall, rockery and planted bank between a street and the higher road beside it (retaining-banks.js)
    const retainingBanks = emitRetainingBanks({ district: distId, proj: (la, lo) => city.proj(la, lo), edges, onRibbon, raisedTop, buildingAt, cellOf, rgb,
        addCollider: (x, z, hw, hd, angle, h, run) => propColl.push({ x, z, hw, hd, angle, r: Math.hypot(hw, hd), poly: null, h, prop: true, kind: 'retaining-wall', sourceId: run.id, estimated: true }) });
    // (backlog r3-landmarks-2) reviewed fascia bands / corner fronts on one-colour buildings (facade-bands.js)
    const facadeBands = emitFacadeBands({ district: distId, project: (la, lo) => city.proj(la, lo), cellOf, rgb,
        building: id => { const b = bRecs.find(o => !o.skip && data.buildingIds?.[o.derivedFrom ?? o.i] === id); return b ? { ring: b.ring, h: b.roofProfile?.eavesM ?? b.h } : null; } });
    const playgrounds = emitPlaygrounds({ district: distId, project: (la, lo) => city.proj(la, lo), cellOf, rgb, // (unirii-small: OSM playground nodes, playgrounds.js)
        blocked: (x, z, r) => onRibbon(x, z, r) ? 'on-carriageway' : buildingAt(x, z) ? 'inside-building' : isWater(x, z) ? 'in-water' : tramSweep?.circle(x, z, r + 0.2, 0, 6) ? 'tram-sweep' : null,
        faceAngle: (x, z) => { const q = nearestEdge(x, z, e => !e.virtual && !e.tunnel, 80); return q ? Math.atan2(q.edge.dirx, q.edge.dirz) : 0; },
        baseY: (x, z) => raisedTop(x, z) ?? 0.05, addCollider: (x, z, r, h, rec) => propColl.push({ x, z, r, hw: r, hd: r, angle: 0, poly: null, h, prop: true, kind: 'playground', sourceId: rec.id, estimated: true }) });
    const carParkFronts = emitCarParkFronts({ key: city.id + '-' + distId, project: (la, lo) => city.proj(la, lo), cellOf, rgb, baseY: (x, z) => raisedTop(x, z) ?? 0, // (r3-look-7: car-park-fronts.js)
        topAt: (x, z) => { let t = null; bGrid.each(x, z, x, z, (b) => { if (!b.skip && !b.dropped && b.ring?.length >= 3 && (b.minH || 0) <= 0.5 && pointInPolygon(x, z, b.ring)) t = Math.max(t ?? 0, b.roofProfile?.eavesM ?? b.h); }); return t; } });
    const weirs = emitWeirs({ district: distId, project: (la, lo) => city.proj(la, lo), cellOf, rgb, inWater: isWater, keep: (x, z) => !ringGeometry || sceneryMargin(x, z) <= 400 }); // (r3: mapped weirs in reviewed channels, weirs.js)
    // (2026-11-12 render review) under ANY mapped footprint, also one drawn by a landmark model (skipped here), a canopy
    // or an elevated part: SeaTac's Talking Fountain n8920167700 stands inside the Main Terminal w23772634 (drawn by its
    // landmark) and was drawn under the terminal roof. Only invalid (dropped) outlines do not count.
    function underRoof(x, z) { let r = false; bGrid.each(x, z, x, z, (b) => { if (!r && !b.dropped && b.ring?.length >= 3 && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pointInPolygon(x, z, b.ring) && !b.holes?.some(h => pointInPolygon(x, z, h))) r = true; }); return r; }
    // (fidelity pass r2) Otopeni: OSM lighting masts and the CFR station's platform vault (airport-forecourt.js)
    const airportForecourt = emitAirportForecourt({ key: city.id + '-' + distId, project: (la, lo) => city.proj(la, lo), cellOf,
        blocked: (x, z, r) => onRibbon(x, z, r) ? 'on-carriageway' : buildingAt(x, z) ? 'inside-building' : tramSweep?.circle(x, z, r + 0.2, 0, 6) ? 'tram-sweep' : null,
        baseY: (x, z) => raisedTop(x, z) ?? 0.05, addCollider: (x, z, r, h, rec) => propColl.push({ x, z, r, hw: r, hd: r, angle: 0, poly: null, h, prop: true, kind: 'lighting-mast', sourceId: rec.id }),
        // a source building a landmark model replaced (or any otherwise skipped record) is drawn by that model only
        building: id => { const recs = bRecs.filter(o => data.buildingIds?.[o.derivedFrom ?? o.i] === id), lmRec = recs.find(o => o.landmarkReplacement), b = recs.find(o => !o.skip);
            return lmRec ? { replacedBy: lmRec.landmarkReplacement } : b ? { ring: b.ring, h: b.h } : null; } });
    // (r2-districts-view-14) perimeter fences OSM maps as `barrier=fence` on a school / university ground (area-fences.js)
    const areaFences = emitAreaFences({ key: city.id + '-' + distId, project: (la, lo) => city.proj(la, lo), cellOf,
        blocked: (x, z, r) => onRibbon(x, z, r) ? 'path' : tramSweep?.circle(x, z, r + 0.2, 0, 6) ? 'tram-sweep' : null, wallAt: (x, z) => !!buildingAt(x, z),
        baseY: (x, z) => raisedTop(x, z) ?? 0.05,
        addCollider: (x, z, hd, angle, h, rec) => propColl.push({ x, z, hw: 0.1, hd, angle, r: Math.hypot(0.1, hd), poly: null, h, prop: true, kind: 'fence', sourceId: rec.id }) });
    // (grozavesti-7) street-level mouths of pedestrian underpasses OSM maps underground (underpass-mouths.js)
    const underpassMouths = emitUnderpassMouths({ key: city.id + '-' + distId, project: (la, lo) => city.proj(la, lo), cellOf,
        blocked: (x, z, r) => onRibbon(x, z, r) ? 'ribbon' : tramSweep?.circle(x, z, r + 0.2, 0, 6) ? 'tram-sweep' : null, inBuilding: (x, z) => !!buildingAt(x, z),
        baseY: (x, z) => raisedTop(x, z) ?? 0.05,
        addCollider: (x, z, hw, hd, angle, h, rec) => propColl.push({ x, z, hw, hd, angle, r: Math.hypot(hw, hd), poly: null, h, prop: true, kind: 'underpass-parapet', sourceId: rec.id }) });
    const touchesDetailedRing = (x, z, w, d) => ringGeometry && sceneryMargin(x, z, true) <= (distCfg?.outerRing ?? 600) + Math.hypot(w, d) / 2;
    {
        const bd = data.backdrop || [], pal = PALETTES[country];
        for (let i = 0; i + 5 < bd.length; i += 6) {
            const x = bd[i] / 10, z = bd[i + 1] / 10, w = bd[i + 2] / 10, d = bd[i + 3] / 10, h = bd[i + 4] / 10, rot = -bd[i + 5] * Math.PI / 180;
            const box = { x, z, hw: w / 2, hd: d / 2, angle: rot, r: Math.hypot(w, d) / 2, poly: null, h, kind: 'backdrop' };
            if (touchesDetailedRing(x, z, w, d)) continue;
            if (inLandmarkGrounds(x, z, w, d)) { backdropInLandmark++; continue; }
            if (polyOnRibbon(obbPoly({ ...box, hw: w / 2 + 2, hd: d / 2 + 2 }))) continue;
            const st = h > 30 ? 'glass' : h > 14 ? 'bloc' : US ? 'house' : 'bloc';
            const colr = shadeRgb(rgb(rng.pick(pal[st])), 0.9);
            // Consume the original palette draw above, retaining later RNG order.
            const owner = backdropSourceOwner(bd, i, backdropBindings);
            if (owner) { backdropSourceOwnership.push({index:i/6,landmark:owner.landmark,sourceIds:owner.sourceIds,tuple:owner.tuple}); continue; }
            cellOf(x, z).backdrop.box(x, 0.12, z, w, h, d, rot, colr);
            propColl.push(box); backdropCount++;
        }
    }
    // horizon masses (district worlds): the rest of the city as low-detail blocks in a ring 250 m – 4 km outside the map,
    // so the district edge and the empty ground beyond it never show (one merged mesh, always drawn). Bucharest: dense
    // 4–11 storey blocks; Seattle: low suburbs / wooded hills, no masses toward the open water west of Bellevue / SeaTac.
    const horizon = new MeshBuilder();
    {
        const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2, R0 = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 250;
        const hr = makeRng(4711 + distId.length * 31), pal = PALETTES[country];
        const woods = [shadeRgb(rgb(env.grass), 0.55), shadeRgb(rgb(env.grass), 0.45)];
        for (let ring = 0; ring < 4; ring++) {
            const R = R0 + ring * 900 + hr.range(0, 300), n = Math.round(2 * Math.PI * R / (US ? 70 : 55));
            for (let i = 0; i < n; i++) {
                const a = (i + hr.range(-0.3, 0.3)) / n * Math.PI * 2, x = cx + Math.cos(a) * (R + hr.range(-150, 150)), z = cz + Math.sin(a) * (R + hr.range(-150, 150));
                const westDeg = ((Math.atan2(z - cz, x - cx) * 180 / Math.PI) + 360) % 360; // 180 = west (−x)
                if (US && westDeg > 150 && westDeg < 230 && (distId === 'bellevue' || distId === 'seatac')) continue;
                if (isWater(x, z)) continue;
                const trees = US ? hr.chance(0.55) : hr.chance(0.15);
                const w = hr.range(30, 70), d = hr.range(14, 40), h = trees ? hr.range(10, 22) : US ? hr.range(6, ring === 0 ? 30 : 14) : hr.range(12, ring === 0 ? 36 : 28);
                const col = trees ? hr.pick(woods) : shadeRgb(rgb(hr.pick(pal[h > 20 ? 'bloc' : US ? 'house' : 'plain'] || pal.plain)), 0.85);
                const rotation = a + hr.range(-0.4, 0.4);
                if (touchesDetailedRing(x, z, w, d)) continue;
                if (inLandmarkGrounds(x, z, w, d)) { backdropInLandmark++; continue; }
                horizon.box(x, -0.2, z, w, h, d, rotation, col);
            }
        }
    }
    const cellsGroup = new THREE.Group(); cellsGroup.name = 'cells'; group.add(cellsGroup);
    const fallbackApertures=fallbackGroundApertures();
    for(const piece of tramGrades.support.pieces)if(!piece.roof&&piece.top){
        const top=piece.top.map(p=>p.map(Math.fround));
        fallbackApertures.addTriangle([top[0],top[1],top[2]],'tram-floor');
        fallbackApertures.addTriangle([top[0],top[2],top[3]],'tram-floor');
    }
    return {
        areaFences, backdropCount, backdropInLandmark, backdropMat, backdropSourceOwnership, bollards, carParkFronts, cellsGroup,
        elevatedSources, facadeBands, fallbackApertures, horizon, monuments, parkWalls, pedestrianBridges, playgrounds,
        railStats, retainingBanks, roofMat, scenerySourceAudit, sceneryStreets, signMats, signTex, underpassMouths, weirs,
        get fenceM() { return fenceM; },
    };
}
