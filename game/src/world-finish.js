// ============================================================================
//  WORLD FINISH — landuse materials, scenery, final meshes and culling, ground plane, sky, play areas, collision index, spawn, drivable graph, stats
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build;
//  names world.js still owns or assigns later are read / written through `__live`)
// ============================================================================
import { consumePreparedSmallWater, prepareFinalWaterGeometry } from './final-water-topology.js';
import * as THREE from '../vendor/three.module.min.js';
import { clamp, pointInPolygon } from './util.js';
import { motorOneway } from './contraflow-bus.js';
import { collisionBounds } from './world-collide.js';
import { CHAPTERS } from './cities.js';
import { rgb } from './geobuild.js';
import { cullMergedCells } from './cell-frustum.js';
import { buildFallbackGround, buildFallbackGroundParallel } from './fallback-ground.js';
import { emitFreewayCuts } from './freeway-cut.js';
import { BoxGrid, PHASES, Y, buildSky, setProgress } from './world-shared.js';
import { buildScenery } from './world-scenery.js';
import { buildFinalMeshes } from './world-final-meshes.js';

export function buildWorldFinish(ctx) {
    const {
        ASPHALT, LANDMARKS, US, WATER_API, __buildPaintSetup, __buildRibbons, __buildRoadGraphAids, __buildStreetFurniture,
        addPropColl, areas, assemblyAudit, assemblyRejected, atlas, bDropped, bGrid, bRecs,
        bShrunk, basarabLamps, bigWater, boundarySupport, bounds, bridgeBents, bridgeJunctionAudit, bridgeWalkways, buildPool,
        buildingAt, buildingPassageAudit, cellOf, cells, channelCuts, channelM, city, clearanceAudit,
        collision, collisionBoxes, cornerPolys, cornerSkips, country, coveredOutlines, coveredRoadModels, coveredWater,
        crossings, data, deckLamps, distCfg, distId, dmask, edges, elevatedDataset,
        elevatedPlan, entranceCanopies, env, facadeBoards, fasciaLayoutAudit, fenceSegs, fillLamps, floatingSupport,
        fuelForecourts, fuelLog, furnCount, graph, groundMat, group, guardCompletion, hallFurnitureStats,
        heightFixes, inArea, inferredDetailAudit, isPark, isWater, lampNear, lamps, lampsMoved,
        landmarkPits, landmarkSourceReplacements, landmarkSurfaceMats, landmarkWaterFootprints, landmarks, liftOnSide, lights, lmDrop,
        lmTrim, mapEnds, marksMat, medianFill, medianLinkSidewalks, nearDoor, nearWater, nearestEdge,
        nodeArr, nodes, noise, obbPoly, onRibbon, opts, outlineParts, overlapCuts,
        padMat, parked, parkedLots, parkingClearance, pasajPortals, pasajStats, physicalUnionAudit, physicalUnionRejected,
        pierColl, poiDoorGuides, poiGroup, pois, polyDist, polyOnRibbon, preparedSmallWater, profileStats,
        propColl, railRoadside, railingDrops, railingNetwork, raisedTop, retract, reviewedBridgeRailings, ribGrid,
        rng, roadMat, roofAdList, roofAds, roofProfileAudit, sceneryDeckGrid, sideJoins, signedSpots,
        signs, solidMat, spillMat, sportAreaLog, str, surfacesAt, sweptOut, t0,
        tramGrades, tramPropEnvelope, tramRailings, tramSweep, tramSweepConflicts, transitShelterAudit, treeAdditions, treeBuildingClearance,
        treeClear, treeCount, treeDeckClearance, treeNear, treesOSM, treesRows, trenchGoreCuts, trenchQuads,
        underpassColl, underpassCollEdges, underpassCover, underpassOwners, underpassRoofAudit, useInst, vacantUnits, vegetation,
        wallCut, walls, waterBridgeRailings, waterChannelAudit, waterLineAudit, waterMat, waterOutlineAudit, waterTreeConflicts,
        yAlong,
    } = ctx;
    const __live = ctx.__live;
    // shoreline foam / shallow tint / wet edges (water.js): every water mesh is re-tessellated (≤ 6 m edges) and gets
    // its per-vertex distance to the shore; all-or-nothing, since the shared material then expects `aShore` everywhere
    let shoreTris = 0;
    const sourceShoreSampler = WATER_API?.makeSourceShoreSampler?.(areas.filter(a => a.kind === 'water'), { maxD: 30 });
    const waterShoreAudit = [];
    const shoreFoam = (m, prepared = null) => {
        if (!WATER_API || !m.geometry) { if (prepared) throw Error('Prepared water lost its final assembly API'); return; }
        try { const g2 = prepared ? consumePreparedSmallWater(prepared, m.geometry) : prepareFinalWaterGeometry(m.geometry, { subdivide: WATER_API.subdivideWater, covered: coveredWater }); const sd = WATER_API.computeShoreDistance(g2, { maxD: 30, material: waterMat, sourceSampler: sourceShoreSampler });
            // (after round 6) a big lake that hit the triangle cap keeps only shore vertices: distance 0 everywhere read as
            // salt-and-pepper foam over the whole of Lake Floreasca — such a mesh gets calm open water instead
            if (!sourceShoreSampler) { let near = 0; for (let i = 0; i < sd.length; i++) if (sd[i] < 1.5) near++; if (near > sd.length * 0.6 && sd.length > 200) sd.fill(30); }
            if (g2.userData.sourceShoreAudit) waterShoreAudit.push({ mesh: m.name, ...g2.userData.sourceShoreAudit });
            m.geometry.dispose(); m.geometry = g2; shoreTris += g2.attributes.position.count / 3; }
        catch (err) { if (prepared) throw err; console.warn('shore foam failed', err); }
    };
    // Compose native opaque ground in its existing painter order, then retain
    // the final surface depth so later vehicles below it cannot show through.
    const areaMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: true, depthFunc: THREE.AlwaysDepth }); areaMat.name = 'landuse';
    const paveMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: true, depthFunc: THREE.AlwaysDepth }); paveMat.name = 'paved-areas';
    const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: true, depthFunc: THREE.AlwaysDepth }); grassMat.name = 'grass';
    const sportMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: true, depthFunc: THREE.AlwaysDepth });
    // (t: world-scenery.js)
    const __buildScenery = buildScenery({
        ASPHALT, LANDMARKS, US, addPropColl, atlas, bGrid, bRecs, bounds,
        buildingAt, cellOf, city, country, data, distCfg, distId, edges,
        elevatedDataset, elevatedPlan, env, fenceSegs, group, isPark, isWater, landmarks,
        liftOnSide, nearWater, nearestEdge, obbPoly, onRibbon, polyDist, polyOnRibbon, propColl,
        raisedTop, retract, rng, sceneryDeckGrid, signs, sportMat, str, surfacesAt,
        sweptOut, tramGrades, tramSweep,
    });
    const {
        areaFences, backdropCount, backdropInLandmark, backdropMat, backdropSourceOwnership, bollards, carParkFronts, cellsGroup,
        elevatedSources, facadeBands, fallbackApertures, horizon, monuments, parkWalls, pedestrianBridges, playgrounds,
        hillStructures, railStats, retainingBanks, roofMat, scenerySourceAudit, sceneryStreets, signMats, signTex, underpassMouths, weirs,
    } = __buildScenery;
    // (backlog bellevue-2) a freeway in a cut under a cross-street bridge: median barrier and abutment walls (freeway-cut.js)
    const freewayCuts = emitFreewayCuts({ district: distId, proj: (la, lo) => city.proj(la, lo), onRibbon, cellOf, rgb,
        deckAbove: (x, z) => { let top = null; ribGrid.each(x, z, x, z, (rb) => { // (the lowest raised carriageway / pad over the point: its surface height)
            if (rb.y <= 1.0 || x < rb.x0 || x > rb.x1 || z < rb.z0 || z > rb.z1 || !pointInPolygon(x, z, rb.poly)) return;
            const h = rb.e ? rb.e.ya + (rb.e.yb - rb.e.ya) * clamp(((x - rb.e.a.x) * rb.e.dirx + (z - rb.e.a.z) * rb.e.dirz) / rb.e.len, 0, 1) : rb.node.y;
            if (h > 1.0 && (top === null || h < top)) top = h; }); return top; },
        solidAt: (x, z, r) => pierColl.some(p => Math.abs(p.x - x) < (p.r || 1) + r && Math.abs(p.z - z) < (p.r || 1) + r),
        addCollider: (x, z, hw, hd, angle, h, kind, cut) => propColl.push({ x, z, hw, hd, angle, r: Math.hypot(hw, hd), poly: null, h, prop: true, kind, sourceId: cut.id, estimated: true }) });
    // (world final meshes: world-final-meshes.js)
    const __buildFinalMeshes = buildFinalMeshes({
        US, areaMat, areas, backdropMat, bigWater, buildingAt, cells, cellsGroup,
        city, data, edges, fallbackApertures, grassMat, groundMat, horizon, inArea,
        lampNear, landmarkPits, mapEnds, marksMat, nearDoor, nearWater, obbPoly, padMat,
        parkedLots, paveMat, poiDoorGuides, poiGroup, pois, polyOnRibbon, preparedSmallWater, propColl,
        raisedTop, retract, roadMat, roofMat, shoreFoam, signMats, solidMat, spillMat,
        sportMat, str, tramGrades, treeClear, treeNear, underpassCover, useInst, vegetation,
        waterMat,
    });
    const {
        _v, cullR, kerbParked, tramTrench, waterMesh,
    } = __buildFinalMeshes;
    let viewerCam = null, lastCull = null;
    // shops closing at night: the share of shutters down follows the district's local hour (render's simulated clock;
    // a fixed 'night' look counts as 23:00, 'dusk' as 19:00): 0 until 21:00, ~55 % at 23:00, ~70 % 00–06, open by 07:30
    let closedT = 0;
    const closedShare = () => {
        const r3 = globalThis.game?.r3d, ov = r3?.clock?.override;
        let h = null;
        if (ov) h = { night: 23, dusk: 19, sunset: 18.5, dawn: 6.5, day: 12 }[ov] ?? 12;
        else { const d = r3?.simDate || new Date(); try { const f = new Intl.DateTimeFormat('en-GB', { timeZone: city.timeZone || 'UTC', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d); h = +f.find(x => x.type === 'hour').value + +f.find(x => x.type === 'minute').value / 60; } catch { h = d.getHours(); } }
        if (h >= 21) return clamp((h - 21) / 2, 0, 1) * 0.55 + clamp((h - 23) / 1, 0, 1) * 0.15;
        if (h < 6) return 0.7;
        if (h < 7.5) return 0.7 * (1 - (h - 6) / 1.5);
        return 0;
    };
    cellsGroup.updateMatrixWorld = function (force) {
        { const now = performance.now(); if (now - closedT > 2000) { closedT = now; solidMat.userData.uClosed.value = closedShare(); } }
        const cam = __live.world.camera || viewerCam || (viewerCam = findCamera(this));
        if (cam) {
            cam.getWorldPosition(_v);
            if (!lastCull || Math.abs(_v.x - lastCull.x) + Math.abs(_v.z - lastCull.z) > 20) {
                lastCull = { x: _v.x, z: _v.z };
                fillLamps(_v.x, _v.z, Math.min(cullR, 1100));
                vegetation.update?.(_v.x, _v.z);
                for (const m of this.children) if (!m.userData.always) m.visible = Math.hypot(m.userData.cx - _v.x, m.userData.cz - _v.z) < (m.userData.cull || cullR);
            }
        }
        THREE.Group.prototype.updateMatrixWorld.call(this, force);
    };
    function findCamera(obj) {
        let root = obj; while (root.parent) root = root.parent;
        if (!root.isScene) return null;
        let best = null; root.traverse(o => { if (o.isPerspectiveCamera && (!best || o.fov > best.fov)) best = o; });
        return best;
    }
    // ground plane
    const W = bounds.maxX - bounds.minX, H = bounds.maxZ - bounds.minZ;
    // (the plane reaches 30 km past the map: its edge was visible at ~3 km on clear days with render's 15–20 km visibility)
    const GPAD = 60000;
    const fallbackOpts={x0:bounds.minX-GPAD/2,x1:bounds.maxX+GPAD/2,z0:bounds.minZ-GPAD/2,z1:bounds.maxZ+GPAD/2};
    // (spec 10 load budget) with the build workers the fallback ground is walked there while the rest of the build and the
    // caller's setup go on: the plane's mesh and material are made here, in their place, and get the geometry, depth write,
    // culling and report when the walk is done (world.ready; buildWorld waits for it unless opts.deferGround).
    const fallbackJob=buildPool?buildFallbackGroundParallel(fallbackApertures,fallbackOpts,buildPool):null;
    const groundPlaneMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(env.ground).multiplyScalar(0.72), map: noise }); groundPlaneMat.name = 'groundPlane';
    const ground = new THREE.Mesh(new THREE.BufferGeometry(), groundPlaneMat);
    vegetation.grassMaterials.push(grassMat);
    vegetation.groundMaterials.push(groundPlaneMat, areaMat, paveMat);
    vegetation.roofMaterials.push(roofMat);
    vegetation.sportMaterials = [sportMat, ...landmarkSurfaceMats];
    const placeGround=fallback=>{
        fallbackApertures.cuts.length=0;
        let groundGeo=fallback.geometry;
        if(!groundGeo){
            groundGeo=new THREE.PlaneGeometry(W+GPAD,H+GPAD,1,1);groundGeo.rotateX(-Math.PI/2);
            const uv=groundGeo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(W+GPAD)/12,uv.getY(i)*(H+GPAD)/12);
        }
        groundPlaneMat.depthWrite=fallback.report.known;
        ground.geometry.dispose(); ground.geometry=groundGeo;
        if(!fallback.report.known)ground.position.set((bounds.minX + bounds.maxX) / 2, -0.3, (bounds.minZ + bounds.maxZ) / 2);
        else cullMergedCells(ground,fallback.parts,{blockTriangles:64});
        ground.userData.fallbackGround=fallback.report;
        return fallback;
    };
    const fallbackReady=fallbackJob?fallbackJob.then(placeGround):Promise.resolve(placeGround(buildFallbackGround(fallbackApertures,fallbackOpts)));
    ground.renderOrder = -20; // far horizon filler only; the city's ground is per cell
    ground.receiveShadow = true; ground.name = 'ground';
    group.add(ground);

    // sky dome (render.js may hide it and draw its own)
    const sky = buildSky(env);
    group.add(sky);

    // Mapped stadium interiors must not be cut by the artificial driving-mask boundary.
    const landmarkPlayAreas = [];
    for (const lm of landmarks) if (lm.id === 'dinamo') lm.mesh?.traverse(source => {
        const area = source.userData.footballPitch?.playArea; if (!area?.length) return;
        landmarkPlayAreas.push(area.map(([x, z]) => { const p = source.localToWorld(new THREE.Vector3(x, 0, z)); return [p.x, p.z]; }));
    });
    if (landmarkPlayAreas.length) {
        const retained = [];
        for (const w of walls) {
            if (w.kind !== 'boundary') { retained.push(w); continue; }
            const dx = w.bx - w.ax, dz = w.bz - w.az, cuts = [0, 1];
            for (const poly of landmarkPlayAreas) for (let i = 0; i < poly.length; i++) {
                const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex;
                if (Math.abs(den) < 1e-9) continue;
                const rx = a[0] - w.ax, rz = a[1] - w.az, t = (rx * ez - rz * ex) / den, u = (rx * dz - rz * dx) / den;
                if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
            }
            cuts.sort((a, b) => a - b);
            for (let i = 1; i < cuts.length; i++) {
                const a = cuts[i - 1], b = cuts[i], m = (a + b) / 2; if (b - a < 1e-7) continue;
                if (landmarkPlayAreas.some(p => pointInPolygon(w.ax + dx * m, w.az + dz * m, p))) continue;
                const ax = w.ax + dx * a, az = w.az + dz * a, bx = w.ax + dx * b, bz = w.az + dz * b;
                const lerp = (v0, v1, t) => v0 + (v1 - v0) * t;
                retained.push({ ...w, ax, az, bx, bz, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3,
                    y0a: lerp(w.y0a, w.y0b, a), y0b: lerp(w.y0a, w.y0b, b), y1a: lerp(w.y1a, w.y1b, a), y1b: lerp(w.y1a, w.y1b, b) });
            }
        }
        walls.splice(0, walls.length, ...retained);
    }
    // Flight includes the complete stadium model; the walking/driving opening remains the pitch play area.
    const landmarkFlightAreas = [];
    for (const lm of landmarks) if (lm.id === 'dinamo' && lm.mesh) {
        lm.mesh.updateWorldMatrix(true, true);
        const extent = new THREE.Box3().setFromObject(lm.mesh);
        if (!extent.isEmpty() && [extent.min.x, extent.min.z, extent.max.x, extent.max.z].every(Number.isFinite)) {
            landmarkFlightAreas.push({ id: lm.id, poly: [[extent.min.x, extent.min.z], [extent.max.x, extent.min.z], [extent.max.x, extent.max.z], [extent.min.x, extent.max.z]] });
        }
    }
    // ---- collision list with spatial query
    const insideDistrict = (x, z) => dmask ? !!(dmask.at(x, z) || landmarkPlayAreas.some(p => pointInPolygon(x, z, p))) : true;
    const flightBoundary = dmask ? {
        inside: (x, z) => insideDistrict(x, z) || landmarkFlightAreas.some(a => pointInPolygon(x, z, a.poly)),
        landmarkAreas: landmarkFlightAreas,
        segments: walls.filter(w => w.kind === 'boundary').map(({ ax, az, bx, bz }) => ({ ax, az, bx, bz }))
            .concat([...landmarkPlayAreas, ...landmarkFlightAreas.map(a => a.poly)].flatMap(poly => poly.map((a, i) => {
                const b = poly[(i + 1) % poly.length]; return { ax: a[0], az: a[1], bx: b[0], bz: b[1] };
            }))),
    } : null;
    const allColl = collision.concat(collisionBoxes, propColl, pierColl, underpassColl, walls);
    const collGrid = new BoxGrid(16), collisionQueryBounds = new WeakMap();
    // Index the actual footprint. A long thin wall's bounding-circle square
    // formerly occupied whole city blocks and was visited by every walker.
    for (const b of allColl) { const box=collisionBounds(b);collisionQueryBounds.set(b,box);collGrid.insert(...box,b); }
    // A body spans several grid cells: each is reported once per query. A fresh Set per query was 6 % of the traffic step
    // (every walker asks twice a step). A query mark on the body does the same; a query started inside another one's
    // callback keeps the Set, so the outer marks are never disturbed.
    // "Is any body's box within r of this point?" Every walker asks before each step; the full query visited every body
    // of the cells around it to answer yes or no. This stops at the first one. Same answer as query() calling back at all.
    Object.defineProperty(allColl, 'anyBoxNear', { value: (x, z, r) => { // (not `some`: a plain array of bodies has that name already)
        const c = collGrid.cell, x0 = x - r, x1 = x + r, z0 = z - r, z1 = z + r;
        for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
            const list = collGrid.cell_(i, j); if (!list) continue;
            for (let k = 0; k < list.length; k++) { const box = collisionQueryBounds.get(list[k]); if (box[2] >= x0 && box[0] <= x1 && box[3] >= z0 && box[1] <= z1) return true; }
        }
        return false;
    }, enumerable: false });
    let collQueryMark = 0, collQueryDepth = 0; const collQueryMarkable = allColl.every(b => Object.isExtensible(b)); // (a frozen body cannot carry the mark)
    Object.defineProperty(allColl, 'query', { value: (x, z, r, cb) => {
        if (collQueryDepth > 0 || !collQueryMarkable) { const seen = new Set(); collGrid.each(x - r, z - r, x + r, z + r, (b) => { const box=collisionQueryBounds.get(b);if (!seen.has(b) && box[2]>=x-r && box[0]<=x+r && box[3]>=z-r && box[1]<=z+r) { seen.add(b); cb(b); } }); return; }
        const mark = ++collQueryMark; collQueryDepth++;
        try { collGrid.each(x - r, z - r, x + r, z + r, (b) => { if (b._collQuery === mark) return; const box=collisionQueryBounds.get(b); if (box[2]>=x-r && box[0]<=x+r && box[3]>=z-r && box[1]<=z+r) { b._collQuery = mark; cb(b); } }); }
        finally { collQueryDepth--; }
    }, enumerable: false });

    // ---- districts / labels
    const districts = data.places.map(([n, x, z, rank]) => ({ name: str(n), x: x / 10, z: z / 10, rank }));

    // ---- spawn
    let spawn = null;
    // district: the chapter start (opts.start, else the first chapter played here) {lat, lon, heading°, road}
    const startLL = (() => { const st = opts.start || (CHAPTERS.find(c => c.city === city.id && c.district === distId) || {}).start; return st ? { lat: st.lat, lon: st.lon, road: st.road, bearing: st.heading ?? st.bearing } : null; })();
    if (startLL) {
        const sp = startLL; const q = city.proj(sp.lat, sp.lon);
        const brW = (sp.bearing ?? 0) * Math.PI / 180, wantX = Math.sin(brW), wantZ = -Math.cos(brW);
        const legalDir = (e) => sp.bearing == null || !motorOneway(e) || e.dirx * wantX + e.dirz * wantZ > 0.2; // a one-way carriageway must run the way the chapter faces
        const flt = (e) => e.drivable && legalDir(e) && (sp.road ? sp.road.test(e.name) : true) && (sp.classes ? sp.classes.test(e.type) : sp.road ? true : !/motorway/.test(e.type)) && e.len > 15;
        const ne = nearestEdge(q.x, q.z, flt, 1500) || nearestEdge(q.x, q.z, (e) => e.drivable && e.len > 10);
        const e = ne.edge;
        const br = (sp.bearing ?? 0) * Math.PI / 180; const want = [Math.sin(br), -Math.cos(br)];
        let dir = (e.dirx * want[0] + e.dirz * want[1]) >= 0 ? 1 : -1;
        if (motorOneway(e)) dir = 1;
        const t = clamp(ne.t, 0.15, 0.85);
        city.spawn = { edge: [e.a.id, e.b.id], t, dir };
        const lat = (e.sharedLane ? 0 : (e.median / 2 + e.laneW * 0.5) * dir) + (e.laneCenterShiftM || 0);
        spawn = { x: e.a.x + e.dirx * e.len * t + e.nx * lat, z: e.a.z + e.dirz * e.len * t + e.nz * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir };
        spawn.y = Y.road + yAlong(e, spawn.x, spawn.z); // road surface at the spawn (the SeaTac departures drive is an elevated deck)
    }

    // ---- expose only the main strongly-connected network to routing / traffic (everything stays rendered)
    const allEdges = edges;
    const driv = edges.filter(e => e.drivable), rest = edges.filter(e => !e.drivable);
    driv.forEach((e, i) => { e.id = i; }); rest.forEach((e, i) => { e.id = driv.length + i; });
    underpassColl.forEach((c, i) => { c.sourceEdgeId = underpassCollEdges[i].id; });
    for (const n of nodeArr) if (n.edges.length) { n.allEdges = n.edges; n.edges = n.edges.filter(e => e.drivable); }
    for (const id of Object.keys(nodes)) if (!nodes[id].drivable) delete nodes[id];
    graph.edges = driv;

    setProgress(''); const phases = PHASES.splice(0);
    const stats = { hallFurniture: hallFurnitureStats, waterBridgeRailings, reviewedBridgeRailings, fasciaLayout: { records: fasciaLayoutAudit, boards: facadeBoards, scope: 'Inferred coplanar fascia boards on existing source walls; source POIs and names unchanged' }, sourceWaterTreeConflicts: { records: waterTreeConflicts.records, sourceRecordsRetained: true, marginM: 0, scope: 'Physical trunk bodies intersect detailed basins and their rendered granite rims; not canopy thinning or road/traffic change' }, parkingClearance, phases, railways: railStats, network: __buildRoadGraphAids.sccInfo, edges: edges.length, walls: walls.length, wallPiecesCut: wallCut.n, piers: pierColl.length, bridgeBents: bridgeBents.report, treeDeckClearance, furniture: furnCount, roadSigns: __live.signCount, roofAds, roofAdList, backdrop: backdropCount, backdropSourceOwnership, sceneryStreets, kerbParked, marksDropped: edges.filter(e => (e._mkAll || 0) > 4 && ((e._mkDrop || 0) + (e._mkOut || 0)) / e._mkAll > 0.2).sort((p, q) => ((q._mkDrop || 0) + (q._mkOut || 0)) / q._mkAll - ((p._mkDrop || 0) + (p._mkOut || 0)) / p._mkAll).slice(0, 30).map(e => ({ name: e.name, type: e.type, id: e.id, lanes: [e.lanesF, e.lanesB], oneway: e.oneway, x: Math.round((e.a.x + e.b.x) / 2), z: Math.round((e.a.z + e.b.z) / 2), len: Math.round(e.len), cover: +((e._mkDrop || 0) / e._mkAll).toFixed(2), out: +((e._mkOut || 0) / e._mkAll).toFixed(2) })), raisedSidewalk: { pieces: __buildRibbons.raisedPieces, corners: cornerPolys.length, joins: sideJoins.size, skipped: cornerSkips }, greenQuads: __buildPaintSetup.greenQuads, fenceM: Math.round(__buildScenery.fenceM), bollards, pitchesDressed: __live.pitchesDressed, sportAreas: sportAreaLog, fuel: fuelLog,
        buildingRoofProfiles: roofProfileAudit, profile: profileStats, buildingPassages: buildingPassageAudit, treesOSM, treesRows, heightFixes: heightFixes.length, heightFixSamples: heightFixes.slice(0, 30), buildingsShrunk: bShrunk, buildingClearance: clearanceAudit, buildingsDropped: bDropped, buildingsCovered: coveredOutlines, buildingAssemblies: assemblyAudit, buildingAssembliesRejected: assemblyRejected, buildingUnions: physicalUnionAudit, buildingUnionsRejected: physicalUnionRejected, inferredBuildingDetails: inferredDetailAudit, landmarkSourceReplacements, landmarkBoxesTrimmed: lmTrim, landmarkBoxesDropped: lmDrop, lampsMovedToKerb: lampsMoved, lampsInWater: __buildStreetFurniture.lampsWet, shoreTris: Math.round(shoreTris), vacantUnits, channelM: Math.round(channelM), unitSigns: __live.unitSigns, unitSignSpots: signedSpots.slice(0, 40).map(q => q.map(v => Math.round(v))), crossings: crossings.length, corridorKm2: data.corridor?.areaKm2, nodes: Object.keys(nodes).length, buildings: collision.length, pois: pois.length, trees: treeCount, parked, lights: lights.length, lamps: lamps.length, osmLamps: lamps.filter(l => l.osm).length, cells: cells.size, triangles: Math.round(__buildFinalMeshes.tris), meshes: cellsGroup.children.length, signPages: signTex.length, buildMs: Math.round(performance.now() - t0) };
    stats.scenerySource = scenerySourceAudit;
    stats.backdropInLandmark = backdropInLandmark;
    stats.treeBuildingClearance = treeBuildingClearance;
    stats.floatingSupport = { parts: floatingSupport.parts, columns: floatingSupport.columns, grounded: floatingSupport.grounded || 0 };
    stats.medianFill = { quads: medianFill.quads, areaM2: medianFill.areaM2, grass: medianFill.decks.filter(d => d.medianKind === 'grass').length, concrete: medianFill.decks.filter(d => d.medianKind === 'concrete').length, asphalt: medianFill.decks.filter(d => d.medianKind === 'asphalt').length };
    stats.fallbackGround=null; // (set when the fallback ground is placed: world.ready)
    stats.districtBoundary = boundarySupport.report;
    stats.transitShelters = { schema: 1, records: transitShelterAudit, withheldUnknown: transitShelterAudit.filter(r => r.status === 'unknown-shelter-geometry').length, literalNo: transitShelterAudit.filter(r => r.status === 'literal-no-shelter').length, legacyUnreviewed: transitShelterAudit.filter(r => r.status === 'legacy-unreviewed').length, limits: 'Inferred generic-unit decisions only; no real shelter absence, mapped geometry removal or constructor/route clearance acceptance.' };
    stats.waterShore = waterShoreAudit;
    stats.waterChannels = waterChannelAudit;
    stats.waterOutlineExceptions = waterOutlineAudit; // (pipera-2: coarse outlines narrowed to their river line, sunken-lakes.js)
    stats.waterLines = waterLineAudit;
    stats.tramGrades = tramGrades.report;
    stats.railRoadside = railRoadside.report;
    stats.bridgeJunctions = bridgeJunctionAudit;
    stats.tramTrench = tramTrench.report;
    stats.tramPropEnvelope = tramPropEnvelope;
    stats.tramSweep = tramSweep ? { ...tramSweep.report, conflicts: tramSweepConflicts } : null;
    stats.tramRailings = tramRailings;
    stats.monuments = monuments; stats.playgrounds = playgrounds; stats.carParkFronts = carParkFronts; stats.parkWalls = parkWalls; stats.retainingBanks = retainingBanks; stats.hillStructures = hillStructures; stats.freewayCuts = freewayCuts; stats.deckLamps = deckLamps; stats.facadeBands = facadeBands; stats.treeAdditions = treeAdditions; stats.weirs = weirs; stats.medianLinkSidewalks = medianLinkSidewalks; if (bridgeWalkways) stats.bridgeWalkways = bridgeWalkways;
    stats.fuelForecourts = fuelForecourts;
    stats.landmarkWaterFootprints = landmarkWaterFootprints;
    stats.trenchGroundCuts = { corridors: trenchQuads.length, channelWaterTriangles: channelCuts.length, triangles: __live.trenchCutTris }; // (ground layers cut out of open trenches and sunken water channels)
    stats.trenchGoreCuts = trenchGoreCuts.n; // (#59: trench wall sides stopped at another sunken ramp)
    stats.pasajUnirii = { ...pasajStats, portals: pasajPortals.length }; // (unirii-pasaj-look: planters, motif triangles, portal headers)
    stats.buildingOverlapCuts = overlapCuts; // (world-space basin outlines: audits of what stands in or over them)
    stats.buildingOutlineParts = outlineParts; // (style-estimated outlines left undrawn in favour of the tagged volumes inside them)
    stats.bridgeGuardCompletion = guardCompletion; stats.railingNetwork = railingNetwork; stats.railingDrops = railingDrops;
    stats.elevatedSources = elevatedSources.report; stats.areaFences = areaFences; stats.underpassMouths = underpassMouths; stats.entranceCanopies = entranceCanopies; stats.pedestrianBridges = pedestrianBridges;
    stats.basarabLamps = basarabLamps;
    stats.barrierJoins = walls.barrierJoins || null;
    stats.coveredRoadModels = coveredRoadModels.report;
    stats.underpassRoofs = { estimated: true, ownerIndex: underpassOwners.report, roofTriangles: underpassCover.ic / 3, colliders: underpassColl.length,
        models: underpassRoofAudit.map(({ edge, ...record }) => ({ ...record, edgeId: edge.id })) };
    stats.sidewalkSource = { explicitEdges: edges.filter(e => e.sidewalkSource.explicit).length,
        directionalEdges: edges.filter(e => e.sidewalkRightM !== e.sidewalkLeftM).length,
        unresolved: edges.filter(e => e.sidewalkSource.unresolved).map(e => ({ edge: e.id, sourceId: e.sidewalkSource.sourceId, reason: e.sidewalkSource.unresolved })) };
    console.info('[world]', city.id, stats);
    return {
        allColl, allEdges, collGrid, districts, fallbackReady, flightBoundary, insideDistrict, sky,
        spawn, stats, waterMesh,
    };
}
