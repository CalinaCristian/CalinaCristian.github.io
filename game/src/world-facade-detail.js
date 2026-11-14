// ============================================================================
//  FACADE DETAIL — building extrusion pass, near / far facade detail, shop-unit and facade signs, fuel forecourts, roof ads, transit shelters
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build;
//  names world.js still owns or assigns later are read / written through `__live`)
// ============================================================================
import { facadeSignBoard, fitFacadeSign } from './facade-sign-layout.js';
import { PASAJ_UNIRII_MODEL } from './pasaj-unirii-look.js';
import * as THREE from '../vendor/three.module.min.js';
import { clamp, distPointSeg, pointInPolygon } from './util.js';
import { solidMaterial } from './world-materials.js';
import { emitFacadeSlab } from './buildings.js';
import { roofSignature } from './building-roofs.js';
import { signatureMatcher } from './district-pack.js';
import { triangulate } from './triangulate.js';
import { rgb, shadeRgb } from './geobuild.js';
import { passageInterior } from './building-passages.js';
import { PEDESTRIAN_FRONTS } from './pedestrian-fronts.js';
import { AWNING, BoxGrid, brandStyle, centroid, mixRgb, signedArea } from './world-shared.js';
import { buildRoofAdsFuel } from './world-roofads-fuel.js';
import { buildRailingNetwork } from './world-railing-network.js';
import { buildFacadesGuards } from './world-facades-guards.js';
import { buildExtrusion } from './world-extrusion.js';

export async function buildFacadeDetail(ctx) {
    const {
        ASPHALT, DY_SIDE, LANDMARKS, US, areas, asphaltCorners, bGrid, bRecs,
        basarabBlue, bridgeJunctionDecks, buildPool, builderEpoch, buildingAt, buildingIndex, carParkOutlines, cellOf,
        cells, city, clipBuildingDetails, convexRing, country, coveredByOther, coveredOutlines, data,
        distId, edgeGrid, edges, edgesInBox, floatingSupport, fountainBasinColl, group, inDistrictLL,
        insetRing, isPark, isWater, landmarkFences, landmarks, lazyRoofMesh, liftOnSide, lmGroup,
        medianFill, medianGrid, nearestEdge, obbPoly, onRibbon, padHeightAt, pasajPortals, pasajStats,
        pierColl, pois, polyDist, polyOnRibbon, raised, raisedDeck, raisedTop, retainedDeck,
        roofPrefetch, roofProfileAudit, sceneryDeckGrid, sceneryStopEdge, sceneryStreetNear, segsCross, signMB, signs,
        sportsColl, stopMarginM, str, surfGrid, surfList, surfacesAt, tramDecks, tramGrades,
        tramPropEnvelope, tramSweep, tramSweepConflicts, trams, walls, widthAsphalt, widthSide, yAlong,
    } = ctx;
    const __live = ctx.__live;
    // (world facades and deck guards: world-facades-guards.js)
    const {
        ARCH, DROP, basarabStructure, bridgeBents, collision, facadeBoards, fasciaLayoutAudit, ghostRails,
        guardCompletion, lmSignColl, palette, propColl, railingDrops, roofCols, tramRailings,
    } = await buildFacadesGuards({
        ASPHALT, LANDMARKS, US, addSignQuad, asphaltCorners, bGrid, bRecs, bridgeJunctionDecks,
        buildingAt, buildingIndex, cellOf, cells, city, country, coveredByOther, coveredOutlines,
        data, distId, edgeGrid, edges, floatingSupport, group, isWater, landmarks,
        lmGroup, medianFill, medianGrid, nearestEdge, onRibbon, padHeightAt, pierColl, pois,
        polyDist, raised, raisedDeck, retainedDeck, sceneryDeckGrid, signMB, signs, surfGrid,
        surfList, surfacesAt, tramDecks, tramGrades, tramPropEnvelope, tramSweep, tramSweepConflicts, trams,
        walls, widthAsphalt, widthSide, yAlong,
    });
    // (world railing network: world-railing-network.js)
    const {
        addPropColl, fenceSegs, railingNetwork, reviewedBridgeRailings, treeClear, waterBridgeRailings,
    } = buildRailingNetwork({
        DROP, DY_SIDE, bRecs, basarabBlue, basarabStructure, buildingAt, buildingIndex, cellOf,
        coveredByOther, data, edgeGrid, edges, fountainBasinColl, ghostRails, group, isWater, landmarkFences,
        liftOnSide, lmSignColl, nearestEdge, onRibbon, propColl, raisedTop, segsCross, sportsColl,
        str, surfacesAt, tramSweep, walls, widthAsphalt, widthSide, yAlong,
    });
    let wallTris = 0;
    // (spec 10 load budget) a source building's roof signature (and its hash) is made once for this loop, which changes no
    // field the signature reads (i, h, minH, ring, holes, roofProfile): a building is the source of several roof surfaces
    const roofsReady = roofPrefetch ? await roofPrefetch : null;
    /** the worker's roof of b (its faces, walls and wall normals; heightAt made here on first use), or null */
    const prefetchedRoof = (b, roofLazy) => {
        const r = roofsReady?.get(b); if (!r || r.ring !== b.ring || r.holes !== b.holes || r.profile !== b.roofProfile) return null;
        return { faces: r.faces, walls: r.walls, wallNormals: r.wallNormals, heightAt: (...a) => roofLazy().heightAt(...a) };
    };
    const roofSignatureMatches = new Map(), roofSignatureMatch = (source) => { let m = roofSignatureMatches.get(source); if (!m) roofSignatureMatches.set(source, m = signatureMatcher(roofSignature(source))); return m; };
    // (world building extrusion: world-extrusion.js)
    const __buildExtrusion = buildExtrusion({
        ARCH, addDetail, addFacadeSign, addNearDetail, addSignQuad, bGrid, bRecs, builderEpoch,
        buildingAt, carParkOutlines, cellOf, city, clipBuildingDetails, collision, convexRing, data,
        distId, edgesInBox, insetRing, isPark, lazyRoofMesh, nearestEdge, obbPoly, onRibbon,
        palette, polyDist, polyOnRibbon, prefetchedRoof, propColl, raisedTop, roofCols, roofProfileAudit,
        roofSignatureMatch, signs, str, streetFacing, wallTris,
    });
    wallTris = __buildExtrusion.wallTris;
    buildPool?.flush(); // (the last clip jobs of the loop go out now; their results are spliced in below)
    // (spec 10 load budget) the clipped detail ranges are spliced in just before the map-end closure, the first pass that
    // reads those builders' contents: until then (passages, shops, trees) the builders are only appended to, and the
    // splice shifts what was appended after each range, as it did here
    {
        const sourceBodies=bRecs.filter(b=>!b.skip&&b.passages?.length),unique=new Map();
        for(const b of sourceBodies)for(const p of b.passages)unique.set(p.key,p);
        const interior=passageInterior([...unique.values()],sourceBodies.map(b=>({...b,h:b.roofProfile?.eavesM??b.h})));
        for(const w of interior.walls){const c=cellOf((w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2);c.solid.wall(...w.a,...w.b,w.y0,w.y1,...w.normal,rgb('#8e9190'));}
        for(const roof of interior.ceilings){const c0=centroid(roof.ring),c=cellOf(...c0),{pts,tris}=triangulate(roof.ring);for(const t of tris)c.solid.face3(...t.map(i=>[pts[i][0],roof.y,pts[i][1]]),rgb('#a3a5a3'),[0,-1,0]);}
    }
    // archetype facades: one mesh per 500 m super-cell, the city's facade shader on the archetype atlas (shutters follow
    // the city's shop-closing share); stats in world.group.userData.archetypes
    if (ARCH) { try { const archG = new THREE.Group(); archG.name = 'archetypes'; for (const m of ARCH.finish(solidMaterial, () => __live.solidMat.userData.uClosed.value)) archG.add(m); group.add(archG); group.userData.archetypes = ARCH.stats; } catch (err) { console.warn('[arch] meshes failed', err); } }

    // ---- facade detail (cornices, bands, balconies, colonnades, mullions, awnings)
    function streetFacing(b, ccw) {
        const ring = b.ring, out = new Array(ring.length).fill(false);
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
            const L = Math.hypot(bx - ax, bz - az); if (L < 4) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const mx = (ax + bx) / 2 + nx * 2, mz = (az + bz) / 2 + nz * 2;
            const ne = nearestEdge(mx, mz, null, 40);
            if (ne && ne.d < 35 && ((ne.cx - mx) * nx + (ne.cz - mz) * nz) > 0) out[k] = true;
        }
        return out;
    }
    /**
     * near-LOD facade / roof geometry (own 500 m super-cell meshes, drawn within ≈ 300 m; beyond, the facade atlas alone):
     * eclectic window surrounds + pediments, pilasters, rusticated ground floor; interwar floor bands; bloc balconies with
     * mixed enclosures, AC units, satellite dishes; glass spandrel bands + podium canopies; rooftop parapets, HVAC units,
     * water tanks (RO), elevator overruns, antennas. Window positions follow the facade atlas grid (TILE_GRID).
     */
    function addNearDetail(b, db, brng, wallCol, h, y0, shop, yShop, floorH, bayW, ccw, roofCol) {
        const st = b.style, ring = b.ring, n = ring.length, pitched = b.roof !== 'flat' && b.roof !== 'dome' && b.roof !== 'mansard';
        const faces = streetFacing(b, ccw);
        const yTop = h, yFirst = shop ? yShop : y0;
        const floors = Math.max(0, Math.floor((yTop - yFirst - 0.6) / floorH));
        const trim = st === 'eclectic' || st === 'civic' ? mixRgb(wallCol, [236, 230, 218], 0.6) : shadeRgb(wallCol, 0.82), deep = shadeRgb(wallCol, 0.62);
        let perim = 0;
        for (let k = 0; k < n; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n]; const L = Math.hypot(bx - ax, bz - az);
            const p0 = perim; perim += L;
            if (L < 4 || !faces[k]) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const ux = (bx - ax) / L, uz = (bz - az) / L, ang = Math.atan2(ux, uz);
            const P = (s2, o) => [ax + ux * s2 + nx * o, az + uz * s2 + nz * o];
            // cheap projecting element: front face + top (+ ends when deep): 4–8 triangles instead of a 12-triangle box
            const slab = (s2, y, w, hh, d, col, ends = d > 0.3) => {
                const lo=Math.max(0,s2-w/2),hi=Math.min(L,s2+w/2);if(hi<=lo)return;
                const [x0, z0] = P(lo, d), [x1, z1] = P(hi, d), [b0x, b0z] = P(lo, 0.02), [b1x, b1z] = P(hi, 0.02);
                db.wall(x0, z0, x1, z1, y, y + hh, nx, nz, col);
                db.flatQuad(b0x, b0z, b1x, b1z, x1, z1, x0, z0, y + hh, shadeRgb(col, 1.06), 0, -1);
                if (ends) { db.wall(b0x, b0z, x0, z0, y, y + hh, -ux, -uz, shadeRgb(col, 0.9)); db.wall(x1, z1, b1x, b1z, y, y + hh, ux, uz, shadeRgb(col, 0.9)); }
            };
            // window centres along this edge: the atlas puts one window column per bay, centred at (i + 0.5) bays
            const cols = []; for (let i = Math.ceil(p0 / bayW - 0.5); (i + 0.5) * bayW - p0 < L - 0.6; i++) { const s2 = (i + 0.5) * bayW - p0; if (s2 > 0.6) cols.push(s2); }
            if (st === 'eclectic' || st === 'civic') {
                for (let f = 0; f < Math.min(floors, 5); f++) { // (surrounds on the lower five storeys: what a driver sees)
                    const yb = yFirst + f * floorH, wTop = yb + floorH * 0.8, wBot = yb + floorH * 0.2;
                    for (const s2 of cols) {
                        slab(s2, wTop, bayW * 0.56, 0.28, 0.32, trim, false);                                // lintel / cornice over the window
                        if (f === 0 && st === 'eclectic') slab(s2, wTop + 0.28, bayW * 0.4, 0.34, 0.2, shadeRgb(trim, 0.95), false); // pediment
                        slab(s2, wBot - 0.12, bayW * 0.56, 0.12, 0.24, trim, false);                           // sill
                    }
                }
                if (cols.length > 3) for (let i = 1; i < cols.length; i += 2) { // pilasters between bays
                    slab((cols[i - 1] + cols[i]) / 2, yFirst, 0.45, Math.max(0.5, yTop - 0.8 - yFirst), 0.16, trim, false);
                }
                if (!shop && y0 + 3.6 < yTop) for (let y = y0 + 0.5; y < y0 + 3.6; y += 0.55) { // rusticated ground floor
                    const [x0, z0] = P(0, 0.05), [x1, z1] = P(L, 0.05); db.wall(x0, z0, x1, z1, y, y + 0.06, nx, nz, deep);
                }
            } else if (st === 'interwar') {
                for (let f = 0; f <= floors; f++) { // continuous parapet bands under the ribbon windows
                    const y = yFirst + f * floorH + floorH * 0.12; if (y > yTop - 0.8) break;
                    const [x0, z0] = P(0, 0.25), [x1, z1] = P(L, 0.25);
                    db.wall(x0, z0, x1, z1, y - 0.35, y, nx, nz, mixRgb(wallCol, [245, 242, 236], 0.5)); db.flatQuad(ax, az, bx, bz, x1, z1, x0, z0, y, [240, 238, 232], 0, -1);
                }
                if (!b.roofProfile && brng() < 0.25 && L > 10) { const [x, z] = P(L * 0.5, 0.3); db.box(x, yTop, z, 0.06, 4, 0.06, 0, rgb('#cfcfcf')); } // flag pole
            } else if (st === 'bloc') {
                const ACC = ['#c0564a', '#4f7fa8', '#d99a3a', '#6c9a5a', '#8d6a9e', '#d7d2c4', '#3f6f78'].map(rgb);
                const accent = ACC[Math.floor(brng() * ACC.length)];
                // (play-test note 10c) balconies read as balconies: real blocks stack the same balcony type up a bay column
                // (open slab + parapet, or enclosed by the owners: glazed / clad), with one parapet colour per building;
                // AC units hang on the balcony fronts / under windows, small and white, with a dark grille
                const neutral = shadeRgb(wallCol, 0.86), encl = [rgb('#c9d0cf'), rgb('#b8b2a3'), neutral];
                const colType = cols.map(() => { const r = brng(); return r < 0.55 ? 'open' : r < 0.85 ? 'glazed' : 'clad'; });
                // (2026-11-08, Street View walk of Str. Garibaldi) the low 1950s–60s blocks of the district worlds' villa
                // quarter (≤ 5 storeys) have plain balconies: no coloured parapet accents
                const colAcc = cols.map(() => brng() < (floors <= 5 ? 0 : 0.35));
                for (let f = 1; f < Math.min(floors, 9); f++) {
                    const yb = yFirst + f * floorH;
                    for (let i = 0; i < cols.length; i++) {
                        const s2 = cols[i], r = brng();
                        if (i % 2 === 0) {
                            const t = r < 0.12 ? (colType[i] === 'open' ? 'glazed' : 'open') : colType[i]; // (a few owners differ)
                            const front = colAcc[i] ? accent : t === 'clad' ? encl[i % encl.length] : neutral;
                            if (h <= 40) { // taller blocks retain the existing far silhouette in addDetail
                                emitFacadeSlab(db, { ax, az, ux, uz, nx, nz, length:L }, s2, yb - 0.1, bayW * 0.9, 0.12, 1.1, neutral); // floor incl. soffit / side edges
                                emitFacadeSlab(db, { ax, az, ux, uz, nx, nz, length:L }, s2, yb + 0.02, bayW * 0.9, 0.95, 1.1, front, { back: 1.02, soffit: false }); // thin parapet plate
                                // Balcony guards return to the facade at both ends;
                                // capping only the thin front plate left these sides open.
                                const left=Math.max(0,s2-bayW*.45),right=Math.min(L,s2+bayW*.45);
                                if(right-left>.16)for(const end of [left+.04,right-.04]) {
                                    emitFacadeSlab(db,{ax,az,ux,uz,nx,nz,length:L},end,yb+.02,.08,.95,1.02,front,{soffit:false});
                                    if(t!=='open')emitFacadeSlab(db,{ax,az,ux,uz,nx,nz,length:L},end,yb+.97,.08,floorH-1.15,1.02,t==='glazed'?rgb('#71879a'):shadeRgb(front,.92),{soffit:false});
                                }
                                if (t === 'glazed') slab(s2, yb + 0.97, bayW * 0.88, floorH - 1.15, 1.02, rgb('#71879a'));     // glazed upper part
                                else if (t === 'clad') slab(s2, yb + 0.97, bayW * 0.88, floorH - 1.15, 1.04, shadeRgb(front, 0.92));
                            }
                            if (r > 0.82) { slab(s2 + bayW * 0.25, yb + 0.25, 0.75, 0.5, 1.32, rgb('#ececea')); slab(s2 + bayW * 0.25, yb + 0.33, 0.5, 0.32, 1.34, rgb('#55585c'), false); } // AC on the front
                        } else if (r < 0.1) { slab(s2, yb + 0.15, 0.75, 0.5, 0.3, rgb('#ececea')); slab(s2, yb + 0.23, 0.5, 0.32, 0.32, rgb('#55585c'), false); } // AC under a window
                        else if (r < 0.13) slab(s2, yb + floorH * 0.7, 0.55, 0.55, 0.14, rgb('#d6d6d0'), false); // dish
                    }
                }
                const [x0, z0] = P(0, 0.03), [x1, z1] = P(L, 0.03); // prefab panel joints (horizontal)
                for (let f = 1; f <= floors; f++) { const y = yFirst + f * floorH - 0.03; if (y < yTop - 0.4) db.wall(x0, z0, x1, z1, y, y + 0.05, nx, nz, deep); }
            } else if (st === 'glass') {
                const sp = rgb(US ? '#3d4b57' : '#4a5965');
                const [x0, z0] = P(0, 0.06), [x1, z1] = P(L, 0.06);
                for (let y = yFirst + floorH; y < yTop - 1; y += floorH) db.wall(x0, z0, x1, z1, y - 0.45, y + 0.25, nx, nz, sp); // spandrels
                if (h > 30) { const [c0x, c0z] = P(0, 2.2), [c1x, c1z] = P(L, 2.2); db.flatQuad(ax, az, bx, bz, c1x, c1z, c0x, c0z, y0 + 4.6, rgb('#3a3f45'), 0, -1); db.flatQuad(ax, az, c0x, c0z, c1x, c1z, bx, bz, y0 + 4.58, rgb('#2a2e33'), 0, -1); } // podium canopy
            } else if (US && (st === 'interwar' || st === 'bloc') && h < 25) { // brick low-rise: stone trim bands
                const [x0, z0] = P(0, 0.06), [x1, z1] = P(L, 0.06);
                for (let f = 1; f <= floors; f++) { const y = yFirst + f * floorH - 0.15; if (y < yTop - 0.4) db.wall(x0, z0, x1, z1, y, y + 0.18, nx, nz, rgb('#d8d2c4')); }
            }
        }
        // rooftop: parapet + plant (flat roofs only)
        if (!b.roofProfile && !pitched && b.area > 60) {
            const pc = shadeRgb(wallCol, 0.92);
            for (let k = 0; k < n; k++) { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n]; if (Math.hypot(bx - ax, bz - az) < 0.5) continue; db.wall(ax, az, bx, bz, yTop, yTop + 0.9, 0, 1, pc); db.wall(bx, bz, ax, az, yTop, yTop + 0.9, 0, 1, shadeRgb(pc, 0.8)); }
            const nUnits = Math.min(6, Math.floor(b.area / 250));
            for (let u = 0; u < nUnits; u++) {
                const x = b.c[0] + (brng() - 0.5) * Math.sqrt(b.area) * 0.45, z = b.c[1] + (brng() - 0.5) * Math.sqrt(b.area) * 0.45;
                if (!pointInPolygon(x, z, ring)) continue;
                // Keep the entire largest plant box on a courtyard building's roof wings.
                // A centre-only test leaves HVAC floating over an inner opening.
                if (polyDist(x, z, ring) < 2.1 || b.holes.some(hole => pointInPolygon(x, z, hole) || polyDist(x, z, hole) < 2.1)) continue;
                const r = brng();
                if (r < 0.45) db.box(x, yTop, z, 1.8, 1.2, 1.2, brng() * 3, rgb('#a9adb1'));                      // HVAC
                else if (r < 0.6 && !US && st === 'bloc') db.box(x, yTop, z, 2.2, 2.6, 2.2, 0, rgb('#8d8f8c'));   // water tank / machine room
                else if (r < 0.8) db.box(x, yTop, z, 3.2, 2.8, 2.6, brng() * 3, shadeRgb(roofCol, 1.1));          // elevator overrun
                else db.box(x, yTop, z, 0.08, 4.5, 0.08, 0, rgb('#8a8a8a'));                                         // antenna
            }
        }
    }
    function addDetail(b, mb, brng, wallCol, h, y0, shop, yShop, floorH, ccw) {
        const st = b.style;
        const ring = b.ring, n = ring.length;
        const edgeN = (k) => { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n]; const L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; } return { ax, az, bx, bz, L, nx, nz, ux: (bx - ax) / L, uz: (bz - az) / L }; };
        let faces = null;
        if (st === 'house' || st === 'plain' || b.roof !== 'flat' && b.roof !== 'dome' || h < 6) {
            if (shop) awnings();
            return;
        }
        if (st === 'bloc' || st === 'civic' || st === 'interwar' || shop) faces = streetFacing(b, ccw);
        // projecting strip along every edge: front face + top
        const strip = (y, hh, out, col, onlyFaces = null) => {
            for (let k = 0; k < n; k++) {
                if (onlyFaces && !onlyFaces[k]) continue;
                const E = edgeN(k); if (E.L < 1) continue;
                const ox = E.nx * out, oz = E.nz * out;
                mb.wall(E.ax + ox, E.az + oz, E.bx + ox, E.bz + oz, y, y + hh, E.nx, E.nz, col);
                mb.flatQuad(E.ax, E.az, E.bx, E.bz, E.bx + ox, E.bz + oz, E.ax + ox, E.az + oz, y + hh, shadeRgb(col, 1.08), 0, -1);
            }
        };
        const dark = shadeRgb(wallCol, 0.78);
        if (st !== 'glass') strip(h - 0.75, 0.75, st === 'eclectic' ? 0.5 : 0.32, dark); // cornice
        if (st === 'interwar') { for (let y = y0 + (shop ? 4.2 : floorH * 2); y < h - 3; y += floorH * 2) strip(y, 0.22, 0.14, dark, faces); }
        if (st === 'eclectic' && h > 8) strip(y0 + 4.4, 0.35, 0.22, dark);
        if (st === 'civic') { // colonnade under a projecting slab on street fronts
            for (let k = 0; k < n; k++) {
                if (!faces[k]) continue;
                const E = edgeN(k); if (E.L < 8) continue;
                const off = 1.6;
                for (let s2 = 2; s2 < E.L - 1.5; s2 += 4) mb.box(E.ax + E.ux * s2 + E.nx * off, y0, E.az + E.uz * s2 + E.nz * off, 0.8, 6, 0.8, Math.atan2(E.ux, E.uz), shadeRgb(wallCol, 1.04));
                const ox = E.nx * (off + 0.6), oz = E.nz * (off + 0.6);
                mb.wall(E.ax + ox, E.az + oz, E.bx + ox, E.bz + oz, y0 + 6, y0 + 6.6, E.nx, E.nz, dark);
                mb.flatQuad(E.ax, E.az, E.bx, E.bz, E.bx + ox, E.bz + oz, E.ax + ox, E.az + oz, y0 + 6.6, dark, 0, -1);
            }
        }
        if (st === 'bloc' && (h > 40 || (b.flags & 32))) { // distant silhouettes; lower buildings get one complete set in addNearDetail
            const floors = Math.min(12, Math.floor((h - y0) / floorH));
            const bc = shadeRgb(wallCol, 0.86);
            for (let k = 0; k < n; k++) {
                if (!faces[k]) continue;
                const E = edgeN(k); if (E.L < 8) continue;
                for (let f = (shop ? 2 : 1); f < floors; f++) {
                    const y = y0 + f * floorH;
                    for (let s2 = 1.2; s2 + 2.8 < E.L - 0.8; s2 += 6.2) {
                        emitFacadeSlab(mb, E, s2 + 1.4, y - 0.12, 2.8, 0.12, 0.95, bc);
                        emitFacadeSlab(mb, E, s2 + 1.4, y, 2.8, 1.0, 0.95, bc, { back: 0.87, soffit: false });
                    }
                }
            }
        }
        if (st === 'glass') { // vertical mullions + roof crown
            const fin = shadeRgb(wallCol, 0.55);
            for (let k = 0; k < n; k++) {
                const E = edgeN(k); if (E.L < 3) continue;
                for (let s2 = 1.5; s2 < E.L - 0.5; s2 += 3) {
                    const x = E.ax + E.ux * s2 + E.nx * 0.12, z = E.az + E.uz * s2 + E.nz * 0.12;
                    mb.wall(x - E.ux * 0.14, z - E.uz * 0.14, x + E.ux * 0.14, z + E.uz * 0.14, y0, h, E.nx, E.nz, fin);
                }
            }
            strip(h - 0.2, b.roofProfile ? 0.2 : 1.2, 0.05, rgb('#2b3a48'));
        }
        if (shop) awnings();
        function awnings() {
            if (!shop) return;
            const fc = faces || streetFacing(b, ccw);
            // (2026-11-08, Street View walk of Calea Floreasca) district worlds: most small shops in the old houses / blocks
            // have no awning — one front in three gets one, deterministic per building
            if (((b.i * 2654435761) >>> 0) % 3 !== 0) return;
            for (let k = 0; k < ring.length; k++) {
                if (!fc[k]) continue;
                const E = edgeN(k); if (E.L < 5) continue;
                const col = AWNING[(b.i + k) % AWNING.length];
                for (let s2 = 0.8; s2 + 3.6 < E.L - 0.5; s2 += 5.4) {
                    const x0 = E.ax + E.ux * s2, z0 = E.az + E.uz * s2, x1 = x0 + E.ux * 3.6, z1 = z0 + E.uz * 3.6;
                    // (2026-11-08, owner: an awning across the "Implant Dent" fascia) the awning hangs under the fascia band
                    // (signs take the top ≈ 0.9 m of the shop storey), never in front of it
                    const yt = yShop - 1.0, yb = yt - 0.6, ox = E.nx * 1.2, oz = E.nz * 1.2; if (yb - y0 < 2.3) return;
                    mb.face4([x0, yt, z0], [x1, yt, z1], [x1 + ox, yb, z1 + oz], [x0 + ox, yb, z0 + oz], col, [E.nx, 1, E.nz]);
                    mb.face4([x0, yt - 0.02, z0], [x1, yt - 0.02, z1], [x1 + ox, yb - 0.02, z1 + oz], [x0 + ox, yb - 0.02, z0 + oz], shadeRgb(col, 0.6), [0, -1, 0]);
                }
            }
        }
    }

    /** (play-test note 10a) a business inside a building: its own ground-floor fascia (brand colours + name) over its
     *  unit, on the street wall nearest to the mapped point, + a projecting blade sign; lit at night with the signs */
    let unitSigns = 0, vacantUnits = 0;
    // (2026-11-12 render review) a fascia name never ends mid-word ("Mosto - Natural Wine Bar & Bistró" read "…& Bistr"):
    // a long name keeps its lead part before a " - " / " | " / ", " qualifier, else it is shortened at a word boundary
    // (a dangling "&" / "and" / "și" / "-" dropped)
    const fasciaText = (t, max = 32) => {
        t = String(t || '').replace(/\s+/g, ' ').trim(); if (t.length <= max) return t;
        const lead = t.split(/\s+[-–—|]\s+|,\s+/)[0].trim(); if (lead.length >= 3 && lead.length <= max) return lead;
        const words = t.split(' '); let out = '';
        for (const w of words) { if ((out ? out.length + 1 : 0) + w.length > max) break; out = out ? out + ' ' + w : w; }
        out = out.replace(/(\s+(&|and|si|și|de|la|du|des|of|the|[-–—|,]))+$/i, '').trim();
        return out || t.slice(0, max);
    };
    const normName = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    // (r2) pedestrian streets / footways from OSM (pedestrian-fronts.js): a business front on one is a street front too
    let pedGrid = null;
    const pedStreetNear = (x, z, maxR) => {
        if (!pedGrid) { pedGrid = new BoxGrid(32); for (const [, , pts] of PEDESTRIAN_FRONTS[city.id + '-' + distId] || []) { const P = pts.map(([la, lo]) => { const q = city.proj(la, lo); return [q.x, q.z]; }); for (let i = 0; i + 1 < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1]; pedGrid.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), [ax, az, bx, bz]); } } }
        let best = null; pedGrid.each(x - maxR, z - maxR, x + maxR, z + maxR, ([ax, az, bx, bz]) => { const d = distPointSeg(x, z, ax, az, bx, bz).d; if (d <= maxR && (!best || d < best.d)) best = { d, pedestrian: true }; });
        return best;
    };
    // (r2, Pipera Kaufland w1198250017) a large store mapped as one point deep inside its footprint says nothing about which
    // side carries the sign: there the face with the store's own OSM car park in front of it is the entrance front
    const parkFront = (px, pz, nx, nz) => { let n = 0; for (const dd of [8, 20]) { const qx = px + nx * dd, qz = pz + nz * dd; if (areas.some(a => a.kind === 'parking' && qx >= a.x0 && qx <= a.x1 && qz >= a.z0 && qz <= a.z1 && pointInPolygon(qx, qz, a.rings[0]))) n++; } return n; };
    // (round 3 review, Romană Cărturești / F.M. Medident / Xerox: boards 15–25 m from their OSM entrance node) an anchored
    // sign (data.poiSignAnchors: an entrance node on the outline, or a point on the address-street face) takes the facade
    // span nearest to the anchor: the whole-store / central-store face heuristics and the street-distance term (which
    // let a primary-street face win) do not apply, and the anchor's own edge counts as a front even without a street
    // within reach of the normal test (it still may not face an adjoining building)
    function addUnitSign(b, x, z, text, kind, poiIndex = -1, anchored = false) {
        if ((b.skip && !b.landmarkUnitSigns) || b.cv || (b.minH || 0) > 0.5 || b.h < 3) return;
        // (r3-look-6, Parcare Unirea w184169515: "Spălătorie Unirea Etaj 7" drew two stacked boards at street level) a business
        // named for an upper floor has no street-level fascia; the building sign names the building
        if (/\betaj(ul)?\s*[1-9]/i.test(text || '')) return;
        // (2026-11-08, owner: "Poke House duplicated") the building's own name sign already names this business
        // (2026-11-12: unless this POI owns that sign — b.poiSign — and places it here, over its own street front)
        if ((b.flags & 2) && b.name && !(poiIndex >= 0 && b.poiSign === poiIndex)) { const a = normName(b.name), c2 = normName(text); if (a && c2 && (a.includes(c2) || c2.includes(a) || a.split(' ')[0] === c2.split(' ')[0])) return; }
        const ring = b.ring, ccw = signedArea(ring) > 0;
        const central = !anchored && kind === 'shop' && Math.abs(signedArea(ring)) >= 1500 && ring.every((p, k) => { const q = ring[(k + 1) % ring.length]; return distPointSeg(x, z, p[0], p[1], q[0], q[1]).d >= 10; });
        // (2026-11-12 render review, Romstal Otopeni w219767593) a store that IS the whole mapped building (its name is the
        // building's) is mapped at the centroid, which says nothing about its front: the board went on the blank wall facing
        // a lawn. Such a store signs the face toward the most important street (and its own car park), not the nearest wall.
        const wholeStore = !anchored && kind === 'shop' && !!b.name && normName(b.name) === normName(text) && Math.abs(signedArea(ring)) >= 400;
        const streetRank = (e) => !e ? 0 : /^(trunk|primary)/.test(e.type) ? 30 : /^secondary/.test(e.type) ? 20 : /^tertiary/.test(e.type) ? 10 : e.type === 'service' ? -8 : 0;
        let best = null, bd = Infinity;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (L * L), 0, 1), px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
            const ne = nearestEdge(px + nx * 4, pz + nz * 4, (e) => !e.virtual && e.drivable, 30) || ((b.flags & 32) ? sceneryStreetNear(px + nx * 4, pz + nz * 4, 30) : null) || pedStreetNear(px + nx * 3, pz + nz * 3, 9);
            const own = anchored && Math.hypot(px - x, pz - z) < 1.5; // (the anchor's own edge)
            // (an entrance node is often a vertex: test the ground in front of the span beside it, not at the corner, where a
            // neighbour touching that corner read as "a building in front" — Romană Xerox)
            const tq = anchored ? clamp(t * L, Math.min(1.2, L / 2), Math.max(L / 2, L - 1.2)) / L : t, fx = ax + (bx - ax) * tq + nx * 1.5, fz = az + (bz - az) * tq + nz * 1.5;
            if ((!ne && !own) || buildingAt(fx, fz)) continue; // (a street front; scenery-ring buildings: a scenery street; r2: a mapped pedestrian street)
            const pf = (central || wholeStore) && L >= 12 ? parkFront(ax + (bx - ax) * .5, az + (bz - az) * .5, nx, nz) : 0;
            const d = anchored ? Math.hypot(px - x, pz - z)
                : wholeStore ? Math.hypot(px - x, pz - z) * 0.2 + ne.d * 0.5 - streetRank(ne.edge) - 30 * pf + (L < 8 ? 20 : 0)
                : Math.hypot(px - x, pz - z) + ne.d * 0.3 - (central && L >= 12 ? 60 * pf : 0);
            if (d < bd) { bd = d; best = { ax, az, bx, bz, L, nx, nz, t: (central || wholeStore) && L >= 12 && (pf || wholeStore) ? .5 : t }; }
        }
        if (!best) return;
        const bs = (kind === 'vacant' ? ['#f2f2ef', '#b91c1c', null] : null) || brandStyle(text) || (kind === 'pharmacy' ? ['#15803d', '#ffffff', null] : kind === 'bank' ? ['#1e3a8a', '#ffffff', null] : ['#1f2937', '#f5f5f4', null]);
        const s = signs.get(fasciaText((bs[3] || text).replace(/\s*\([^)]*\)/g, '').trim() || text), bs[0], bs[1], bs[2], false, true); if (!s) return; // (data.brands[k][3] = logo text; 32: "Trattoria Il Calcio Floreasca", "Mega Image Maison des Chefs" were cut mid-word at 24; a long name sets on two lines to stay readable)
        const { ax, az, bx, bz, L, nx, nz } = best, tx = (bx - ax) / L, tz = (bz - az) / L;
        let w = Math.min(6.5, L - 0.8), hh = Math.min(0.7, w / s.aspect); w = Math.min(w, hh * s.aspect);
        const shop = (b.flags & 1) && b.h > 6, proud = shop ? 0.14 : 0.36; // (r2-builder) no shopfront band: the board stands proud of the window surrounds (0.32 m), which cut through the name
        let tc = clamp(best.t * L, w / 2 + 0.4, L - w / 2 - 0.4), mx = ax + tx * tc + nx * proud, mz = az + tz * tc + nz * proud;
        let y = b.signY != null ? b.signY - hh / 2 : shop ? (b.gfh || 4.2) - hh - 0.1 : Math.min(3.0, b.h - hh - 0.3); // (archetypes: their fascia height)
        // (round 3 review, Floreasca Farmacia Dona at the Piața Floreasca car-park passage; panorama NWuTtHcsu_MBJEKTpucUsA @1
        // shows the unit and its board beside the portal) a unit board that would sit over a building passage on its own
        // wall slides along the wall to the portal's side nearer to the business, when the wall has room there; only
        // otherwise is it lifted over the portal (clearPortal)
        let slid = null;
        { // a carriageway entering the wall under the board (a car-park ramp / passage drawn as a road, not a facade portal)
            const hit = (u) => onRibbon(ax + tx * u + nx * 0.6, az + tz * u + nz * 0.6, 0) && onRibbon(ax + tx * u - nx * 1.0, az + tz * u - nz * 1.0, 0), over = (c) => { for (let u = c - w / 2; u <= c + w / 2 + 1e-6; u += 0.5) if (hit(u)) return true; return false; };
            if (over(tc)) { const lo = w / 2 + 0.4, hi = L - w / 2 - 0.4, pref = best.t * L >= tc ? 1 : -1; let to = null;
                for (let d = 0.5; d <= Math.max(6, w + 2) && to === null; d += 0.5) for (const sg of [pref, -pref]) { const c = tc + sg * d; if (c >= lo && c <= hi && !over(c)) { to = c; break; } }
                if (to !== null) { slid = { reason: 'carriageway-into-wall', fromM: +tc.toFixed(2), toM: +to.toFixed(2) }; tc = to; mx = ax + tx * tc + nx * proud; mz = az + tz * tc + nz * proud; } }
        }
        for (const pt of b.portals || []) {
            const ps = (pt.px - ax) * tx + (pt.pz - az) * tz, off = Math.abs((pt.px - ax) * nx + (pt.pz - az) * nz); if (off > 1.5 || y >= pt.top + 0.1) continue;
            if (Math.abs(ps - tc) >= w / 2 + pt.hw + 0.3) continue;
            const right = ps + pt.hw + 0.3 + w / 2, left = ps - pt.hw - 0.3 - w / 2, okR = right <= L - w / 2 - 0.4, okL = left >= w / 2 + 0.4, pref = best.t * L >= ps;
            const from = tc; if (okR && (pref || !okL)) tc = right; else if (okL) tc = left; if (tc !== from) slid = { reason: 'portal', fromM: +from.toFixed(2), toM: +tc.toFixed(2) };
            mx = ax + tx * tc + nx * proud; mz = az + tz * tc + nz * proud;
        }
        y = clearPortal(b, mx, mz, w, y);
        const fitted = fitFacadeSign(best, { centre: tc, width: w, minWidth: Math.min(w, s.aspect * 0.3), y0: y - 0.1, y1: y + hh + 0.1 }, facadeBoards);
        if (!fitted) { fasciaLayoutAudit.push({ text, building: b.i, status: 'no-clear-inferred-fascia-span', x, z }); return; }
        const original = { x: mx, z: mz, width: w };
        tc = fitted.centre; w = fitted.width; hh = Math.min(hh, w / s.aspect);
        mx = ax + tx * tc + nx * proud; mz = az + tz * tc + nz * proud;
        fasciaLayoutAudit.push({ text, building: b.i, status: 'placed', original, x: mx, z: mz, width: w, height: hh, y, ...(slid ? { slid } : {}), ...(anchored ? { anchored: true } : {}) });
        facadeBoards.push(facadeSignBoard(mx, mz, tx, tz, w + 0.5, y - 0.1, y + hh + 0.1, text));
        const cc = cellOf(mx, mz), white = [255, 255, 255], mbS = signMB(cc, s.page);
        const lx = mx - tx * w / 2, lz = mz - tz * w / 2, rx = mx + tx * w / 2, rz = mz + tz * w / 2;
        // viewer outside looks along -n; their right-hand vector is (nz, -nx) = +t when the ring is ccw-out
        const [Lx, Lz, Rx, Rz] = (nz * tx - nx * tz) > 0 ? [lx, lz, rx, rz] : [rx, rz, lx, lz];
        const i0 = mbS.v(Lx, y, Lz, nx, 0, nz, s.u0, s.v0, white), i1 = mbS.v(Rx, y, Rz, nx, 0, nz, s.u1, s.v0, white);
        const i2 = mbS.v(Rx, y + hh, Rz, nx, 0, nz, s.u1, s.v1, white), i3 = mbS.v(Lx, y + hh, Lz, nx, 0, nz, s.u0, s.v1, white);
        mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3);
        cc.solid.box(mx - nx * (shop ? 0.07 : 0.17), y - 0.1, mz - nz * (shop ? 0.07 : 0.17), shop ? 0.1 : 0.32, hh + 0.2, w + 0.5, Math.atan2(tx, tz), rgb(bs[0])); // fascia board
        if (tc + w / 2 + 1.3 < L && (b.flags & 1)) { // projecting blade sign (both faces), on a bracket — shopfronts only (owner: a stray plate on a blank wall)
            // (2026-11-12 render review, BRD by ING at Grozăvești: the blade hung below a separate bracket box, 0.5 m out with
            // one face, and read as a detached plate at an angle) the blade now stands 0.12 m off the wall, faces both ways
            // and hangs from a flat arm along its top edge that runs from the wall; the arm is two quads, not a 12-triangle box
            const cross = kind === 'pharmacy' ? signs.get('✚', '#15803d', '#ffffff', null, true) : null; // (category style: green cross)
            const bw = cross ? 0.8 : 1.1, bh = cross ? 0.8 : Math.max(0.28, 1.1 / s.aspect), by = y + hh + 0.4, off = 0.12 + bw / 2;
            const wx = mx - nx * proud + tx * (w / 2 + 0.7), wz = mz - nz * proud + tz * (w / 2 + 0.7), ex = wx + nx * off, ez = wz + nz * off;
            const ay0 = by + bh / 2 + 0.01, ay1 = ay0 + 0.05, out = 0.12 + bw + 0.06, arm = rgb('#2b2b2b');
            const A = (o, yy) => [wx + nx * o, yy, wz + nz * o];
            cc.solid.face4(A(0, ay0), A(out, ay0), A(out, ay1), A(0, ay1), arm, [tx, 0, tz]); cc.solid.face4(A(out, ay0), A(0, ay0), A(0, ay1), A(out, ay1), arm, [-tx, 0, -tz]);
            for (const sd of [1, -1]) addSignQuad(cc, ex, ez, Math.atan2(tx, tz), sd, bw, bh, by, cross || s, 0.012);
        }
        signedSpots.push([mx, mz, y]); unitSigns++;
    }
    const signedSpots = [];
    /** (2026-11-08, owner: "still broken sign there") a sign whose span [mx ± w/2] crosses a service portal of its building
     *  sits above the portal's lintel instead of behind it */
    function clearPortal(b, mx, mz, w, y) {
        for (const pt of b.portals || []) if (Math.hypot(pt.px - mx, pt.pz - mz) < w / 2 + pt.hw + 0.3 && y < pt.top + 0.1) y = pt.top + 0.15;
        return y;
    }
    function addFacadeSign(b, h, shop, wallCol) {
        // a hotel's own sign faces its address street (OSM addr:street) when that street is beside it, not a service lane behind it
        const addressEdge = b.signStreet ? nearestEdge(b.c[0], b.c[1], (e) => e.name === b.signStreet, 120) : null;
        const ne = addressEdge && addressEdge.d <= 90 ? addressEdge : nearestEdge(b.c[0], b.c[1]);
        if (!ne || ne.d > 90) return;
        // wall whose outward normal faces the road and is closest to it
        const ring = b.ring; const ccw = signedArea(ring) > 0;
        let best = -1, bs = -Infinity;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
            const L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const mx = (ax + bx) / 2, mz = (az + bz) / 2;
            const tx = ne.cx - mx, tz = ne.cz - mz, tl = Math.hypot(tx, tz) || 1;
            const score = (tx * nx + tz * nz) / tl * 2 - tl / 40 + Math.min(L, 12) / 12;
            if (score > bs) { bs = score; best = k; }
        }
        if (best < 0) return;
        const [ax, az] = ring[best], [bx, bz] = ring[(best + 1) % ring.length];
        const L = Math.hypot(bx - ax, bz - az);
        let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
        const brand = brandStyle(b.name);
        const cvp = b.cv;
        const st = cvp ? ['#111827', '#ffffff', cvp._color || '#f97316'] : brand || (b.flags & 8 ? ['#b91c1c', '#ffffff', null] : ['#1f2937', '#f5f5f4', null]);
        const s = signs.get(b.name, st[0], st[1], st[2]);
        if (!s) return;
        let w = Math.min(L * 0.8, cvp ? 18 : (b.flags & 8 ? 7 : 9)); let hh = w / s.aspect;
        // (play-test note 10a) businesses sign at ground floor: a fascia over the shop window (≤ 0.75 m high) or a board
        // over the door — never a box on an upper floor; only the CV buildings keep their big sign higher up
        const hMax = cvp ? 2.4 : shop ? 0.72 : 0.85;
        if (hh > hMax) { hh = hMax; w = hh * s.aspect; } if (w > L * 0.9) { w = L * 0.9; hh = w / s.aspect; }
        const y0b = b.minH || 0;
        let y = cvp ? Math.max(4, Math.min(h - hh - 1.5, 14)) : b.signY != null ? b.signY - hh / 2 : shop ? y0b + (b.gfh || 4.2) - hh - 0.08 : y0b + Math.min(3.0, Math.max(2.4, h - hh - 0.4));
        if (y < 1) y = 1;
        const mx = (ax + bx) / 2 + nx * 0.12, mz = (az + bz) / 2 + nz * 0.12;
        if (!cvp) y = clearPortal(b, mx, mz, w, y);
        // viewer outside looks along -n; their right-hand vector is (nz, -nx)
        const lx = mx - nz * w / 2, lz = mz + nx * w / 2, rx = mx + nz * w / 2, rz = mz - nx * w / 2;
        const mbS = signMB(cellOf(b.c[0], b.c[1]), s.page);
        const white = [255, 255, 255];
        const i0 = mbS.v(lx, y, lz, nx, 0, nz, s.u0, s.v0, white), i1 = mbS.v(rx, y, rz, nx, 0, nz, s.u1, s.v0, white);
        const i2 = mbS.v(rx, y + hh, rz, nx, 0, nz, s.u1, s.v1, white), i3 = mbS.v(lx, y + hh, lz, nx, 0, nz, s.u0, s.v1, white);
        mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3); // (i0,i1,i2) normal = n by construction
        if (!cvp) { // fascia board in the brand colour behind the letters + a projecting (blade) sign at the end of the front
            const sb = cellOf(b.c[0], b.c[1]).solid, bg = rgb(st[0]), pad = 0.12, tx = -nz, tz = nx; // tx/tz: along the wall
            const cx0 = (ax + bx) / 2 + nx * 0.06, cz0 = (az + bz) / 2 + nz * 0.06, bw2 = Math.min(L * 0.96, w + 0.8);
            sb.box(cx0, y - pad, cz0, 0.1, hh + pad * 2, bw2, Math.atan2(tx, tz), bg);
            facadeBoards.push(facadeSignBoard(cx0, cz0, tx, tz, bw2, y - pad, y + hh + pad, b.name));
            if (L > bw2 + 2 && shop) { // (2026-11-08, owner: "still broken signs") shopfronts only, and the bracket only with its blade
                const ex = (ax + bx) / 2 + tx * (bw2 / 2 + 0.6) + nx * 0.55, ez = (az + bz) / 2 + tz * (bw2 / 2 + 0.6) + nz * 0.55;
                const bh = 0.75, by = y + hh + 0.35;
                const bladeS = signs.get(b.name.slice(0, 14), st[0], st[1], st[2]);
                if (bladeS) { sb.box(ex - nx * 0.45, by + bh / 2 - 0.03, ez - nz * 0.45, 0.04, 0.04, 1.0, Math.atan2(nx, nz), rgb('#2b2b2b')); addSignQuad(cellOf(b.c[0], b.c[1]), ex, ez, Math.atan2(tx, tz), 1, 0.8, Math.min(0.8, 0.8 / bladeS.aspect * 1.6), by, bladeS, 0.06); }
            }
        }
        if (cvp) { // coloured band at the top of the CV building
            const mb = cellOf(b.c[0], b.c[1]).solid;
            const col = rgb(cvp._color || '#f97316');
            for (let k = 0; k < ring.length; k++) {
                const [px, pz] = ring[k], [qx, qz] = ring[(k + 1) % ring.length]; const LL = Math.hypot(qx - px, qz - pz); if (LL < 0.05) continue;
                let ox = (qz - pz) / LL, oz = -(qx - px) / LL; if (!ccw) { ox = -ox; oz = -oz; }
                mb.wall(px + ox * 0.08, pz + oz * 0.08, qx + ox * 0.08, qz + oz * 0.08, h - 1.0, h + 0.4, ox, oz, col);
            }
        }
    }
    // (world roof ads and fuel: world-roofads-fuel.js)
    const {
        P, fuelForecourts, fuelLog, roofAdList, roofAds, transitShelterAudit,
    } = await buildRoofAdsFuel({
        US, addPropColl, addSignQuad, addUnitSign, bGrid, bRecs, buildingAt, buildingIndex,
        cellOf, city, data, distId, edgeGrid, inDistrictLL, liftOnSide, nearestEdge,
        obbPoly, onRibbon, pois, polyDist, polyOnRibbon, propColl, raisedTop, sceneryStopEdge,
        signs, stopMarginM, str, surfacesAt, tramSweep, treeClear,
    });
    // vacant shop units (data.vacant, world-data Request): a plain 'DE ÎNCHIRIAT' / 'FOR LEASE' board over the unit
    { const V = data.vacant || []; let vac = 0;
      for (let i = 0; i + 2 < V.length; i += 3) { const bi = buildingIndex(V[i + 2], V[i] / 10, V[i + 1] / 10); if (bi >= 0 && bRecs[bi]) { addUnitSign(bRecs[bi], V[i] / 10, V[i + 1] / 10, US ? 'FOR LEASE' : 'DE ÎNCHIRIAT', 'vacant'); vac++; } }
      vacantUnits = vac; }
    /** a double/single sided sign quad at (x,z) rotated `ang` (local +z = facing), centre height y */
    function addSignQuad(c, x, z, ang, sd, w, h, y, s, thick = 0.1) {
        const fx = Math.sin(ang) * sd, fz = Math.cos(ang) * sd; // facing direction
        const cx = x + fx * thick, cz = z + fz * thick;
        const mbS = signMB(c, s.page), W = [255, 255, 255];
        // viewer in front looks along -f; their right-hand vector is (fz, -fx)
        const Lx = cx - fz * w / 2, Lz = cz + fx * w / 2, Rx = cx + fz * w / 2, Rz = cz - fx * w / 2;
        const y0 = y - h / 2, y1 = y + h / 2;
        const i0 = mbS.v(Lx, y0, Lz, fx, 0, fz, s.u0, s.v0, W), i1 = mbS.v(Rx, y0, Rz, fx, 0, fz, s.u1, s.v0, W);
        const i2 = mbS.v(Rx, y1, Rz, fx, 0, fz, s.u1, s.v1, W), i3 = mbS.v(Lx, y1, Lz, fx, 0, fz, s.u0, s.v1, W);
        mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3);
    }

    { // (unirii-pasaj-look) "PASAJUL UNIRII" header on a dark beam over each portal; portals of one cut side by side share one
        const H = PASAJ_UNIRII_MODEL.header, groups = [];
        for (const p of pasajPortals) { const g = groups.find(q => q.fx * p.fx + q.fz * p.fz > 0.9 && Math.hypot(q.x - p.x, q.z - p.z) < 12); if (g) { g.list.push(p); g.x = (g.x + p.x) / 2; g.z = (g.z + p.z) / 2; } else groups.push({ x: p.x, z: p.z, fx: p.fx, fz: p.fz, list: [p] }); }
        const sg = signs.get(H.text, H.bg, H.fg, null, true);
        for (const g of groups) {
            const ux = g.fz, uz = -g.fx; let lo = Infinity, hi = -Infinity; // span across the facing direction
            for (const p of g.list) { const d = (p.x - g.x) * ux + (p.z - g.z) * uz; lo = Math.min(lo, d - p.w / 2 - 0.25); hi = Math.max(hi, d + p.w / 2 + 0.25); }
            const cx = g.x + ux * (lo + hi) / 2, cz = g.z + uz * (lo + hi) / 2, half = (hi - lo) / 2, c = cellOf(cx, cz), y1 = 0.1, y0 = -H.beamM;
            const A = (s2, y) => [cx + ux * s2, y, cz + uz * s2];
            c.solid.face4(A(-half, y0), A(half, y0), A(half, y1), A(-half, y1), rgb(H.bg), [g.fx, 0, g.fz]);
            c.solid.face4(A(-half, y0), A(half, y0), [cx + ux * half - g.fx * 0.4, y0, cz + uz * half - g.fz * 0.4], [cx - ux * half - g.fx * 0.4, y0, cz - uz * half - g.fz * 0.4], rgb(H.bg), [0, -1, 0]);
            if (sg) { const w = Math.min(half * 2 - 1.5, 9); addSignQuad(c, cx, cz, Math.atan2(g.fx, g.fz), 1, w, H.letterM, (y0 + y1) / 2, sg, 0.04); pasajStats.headers++; }
        }
    }
    return {
        P,
        addPropColl,
        addSignQuad,
        basarabStructure,
        bridgeBents,
        collision,
        facadeBoards,
        fasciaLayoutAudit,
        fenceSegs,
        fuelForecourts,
        fuelLog,
        guardCompletion,
        propColl,
        railingDrops,
        railingNetwork,
        reviewedBridgeRailings,
        roofAdList,
        roofAds,
        signedSpots,
        tramRailings,
        transitShelterAudit,
        treeClear,
        vacantUnits,
        waterBridgeRailings,
        get unitSigns() { return unitSigns; }, set unitSigns(v) { unitSigns = v; },
    };
}
