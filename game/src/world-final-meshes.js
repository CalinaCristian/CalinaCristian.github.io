// ============================================================================
//  WORLD FINAL MESHES — cull radii, tram trench, kerb parking, water mesh
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import * as THREE from '../vendor/three.module.min.js';
import { makeRng } from './util.js';
import { CAR_COLORS, makeParkedCars } from './vehicles.js';
import { batchWaterChunks } from './water-batch.js';
import { cullMergedCells } from './cell-frustum.js';
import { buildTramTrenchCutter } from './tram-trench.js';
import { BoxGrid, CELL, shoulderOf } from './world-shared.js';

export function buildFinalMeshes(ctx) {
    const {
        US, areaMat, areas, backdropMat, bigWater, buildingAt, cells, cellsGroup,
        city, data, edges, fallbackApertures, grassMat, groundMat, horizon, inArea,
        lampNear, landmarkPits, mapEnds, marksMat, nearDoor, nearWater, obbPoly, padMat,
        parkedLots, paveMat, poiDoorGuides, poiGroup, pois, polyOnRibbon, preparedSmallWater, propColl,
        raisedTop, retract, roadMat, roofMat, shoreFoam, signMats, solidMat, spillMat,
        sportMat, str, tramGrades, treeClear, treeNear, underpassCover, useInst, vegetation,
        waterMat,
    } = ctx;
    let tris = underpassCover.ic / 3;
    // Destination guides are gameplay markers, including at doors reached from a sidewalk.
    // Keep their exact paint/material while batching them separately from physical carriageway markings.
    if (!poiDoorGuides.empty) {
        const m = new THREE.Mesh(poiDoorGuides.build(), marksMat);
        m.name = 'poi-door-guides'; m.receiveShadow = true; m.renderOrder = 4;
        m.matrixAutoUpdate = false; m.updateMatrix(); poiGroup.add(m); tris += poiDoorGuides.ic / 3;
    }
    const addMesh = (mb, mat, cast, name) => {
        if (mb.empty) return null;
        const m = new THREE.Mesh(mb.build(), mat);
        m.castShadow = cast; m.receiveShadow = true; m.name = name; m.matrixAutoUpdate = false; m.updateMatrix();
        tris += mb.ic / 3;
        m.userData.cx = (cx + 0.5) * CELL; m.userData.cz = (cz + 0.5) * CELL;
        if (name.startsWith('signs')) m.userData.cull = 520; else if (name.startsWith('marks')) m.userData.cull = 820;
        cellsGroup.add(m); return m;
    };
    // view ranges (render's weather-driven visibility is 15–20 km on clear days, so culling no longer follows the fog):
    // buildings / ground / roads ≈ 2.7 km, small props / trees / parked cars ≈ 1.2 km, signs 520 m, markings 820 m
    const VIEW = { far: 2700, props: 1200 };
    const cullR = VIEW.far + CELL * 0.71;
    let cx = 0, cz = 0;
    // (2026-11-07, world-visual) draw calls: the flat / cheap layers of neighbouring cells are merged into super-cells
    // (2×2 cells = 500 m; the far backdrop 4×4) — fewer meshes for the same pixels; solid buildings stay per cell (culling)
    const SUPER = { area: 4, grass: 4, pave: 4, sport: 4, roof: 4, backdrop: 4, ground: 2, road: 2, pad: 2, marks: 2, water: 4, signs: 4, spill: 4, solid: 2, detail: 1 };
    const supers = new Map();
    const superOf = (c, layer, page = 0) => {
        const K = SUPER[layer], I = Math.floor(c.i / K), J = Math.floor(c.j / K), key = layer + page + ':' + I + ',' + J;
        let o = supers.get(key); if (!o) supers.set(key, o = { layer, page, K, I, J, mb: null });
        return o;
    };
    const tramTrench = buildTramTrenchCutter(tramGrades.support);
    // (spec 10 load budget) a super-cell's first builder takes the others once, at their final size (appendAll), when its
    // mesh is made: the same arrays as appending them one by one here; o.ic is the merged index count so far
    const superAdd = (o, mb) => { if (!o.mb) o.mb = mb; else (o.pending ||= []).push(mb); o.ic = (o.ic || 0) + mb.ic; };
    for (const c of cells.values()) {
        for (const layer of ['area', 'grass', 'pave', 'sport', 'roof', 'backdrop', 'ground', 'road', 'pad', 'marks', 'water', 'solid', 'detail']) {
            if (c[layer].empty) continue;
            if (['area', 'grass', 'pave', 'sport', 'ground'].includes(layer)) c[layer] = tramTrench.cut(c[layer]);
            const o = superOf(c, layer);
            if (['solid', 'roof', 'area', 'grass', 'pave', 'sport', 'ground', 'road', 'pad', 'marks'].includes(layer)) {
                const mb = c[layer], box = new THREE.Box3().setFromArray(mb.p.subarray(0, mb.vc * 3));
                (o.parts ||= []).push({ start: o.ic || 0, count: mb.ic, bounds: [...box.min.toArray(), ...box.max.toArray()] });
            }
            superAdd(o, c[layer]);
        }
        c.signs.forEach((mb, k) => { if (!mb || mb.empty) return; superAdd(superOf(c, 'signs', k), mb); });
        if (c.spill && !c.spill.empty) superAdd(superOf(c, 'spill'), c.spill);
    }
    const addSuper = (o, mat, cast, name) => {
        if (o.pending) { o.mb.appendAll(o.pending); o.pending = null; }
        cx = o.I * o.K + o.K / 2 - 0.5; cz = o.J * o.K + o.K / 2 - 0.5; // (addMesh centres at (cx + 0.5) · CELL)
        const m = addMesh(o.mb, mat, cast, `${name} ${o.I},${o.J}`); if (!m) return null;
        if(['ground','road','pad'].includes(o.layer))fallbackApertures.addGeometry(m.geometry,'road-floor');
        if (o.parts) cullMergedCells(m, o.parts, { blockTriangles: o.layer === 'ground' || o.layer === 'grass' ? 64 : 0 });
        const extra = CELL * (o.K - 1) * 0.71; m.userData.cull = (m.userData.cull || cullR) + extra;
        return m;
    };
    for (const o of supers.values()) {
        switch (o.layer) {
            case 'area': { const m = addSuper(o, areaMat, false, 'area'); if (m) m.renderOrder = -19.5; break; }
            case 'grass': { const m = addSuper(o, grassMat, false, 'grass'); if (m) m.renderOrder = -19.2; break; }
            case 'pave': { const m = addSuper(o, paveMat, false, 'pave'); if (m) m.renderOrder = -19; break; }
            // (2026-11-08, owner: a band across a pitch) pitch stripes / court lines draw after every grass / paved mesh: these
            // layers do not write depth, so a neighbouring cell's lawn drawn later painted over the part of a pitch in its cell
            case 'sport': { const m = addSuper(o, sportMat, false, 'sport'); if (m) m.renderOrder = -18.9; break; }
            case 'roof': addSuper(o, roofMat, true, 'roofs'); break;
            case 'backdrop': { const m = addSuper(o, backdropMat, true, 'backdrop'); if (m) m.userData.cull = cullR + 600 + CELL * (o.K - 1) * 0.71; break; }
            case 'ground': { const m = addSuper(o, groundMat, false, 'ground'); if (m) m.renderOrder = 1; break; }
            case 'road': { const m = addSuper(o, roadMat, false, 'road'); if (m) m.renderOrder = 2; break; }
            case 'pad': { const m = addSuper(o, padMat, false, 'junction'); if (m) m.renderOrder = 3; break; }
            case 'marks': { const m = addSuper(o, marksMat, false, 'marks'); if (m) m.renderOrder = 4; break; }
            case 'water': { const m = addSuper(o, waterMat, false, 'water'); if (m) { m.renderOrder = -18; shoreFoam(m, preparedSmallWater?.get(o.I + ',' + o.J)); fallbackApertures.addGeometry(m.geometry,'final-water'); } break; }
            case 'solid': addSuper(o, solidMat, true, 'solid'); break;
            case 'detail': { const m = addSuper(o, solidMat, false, 'detail'); if (m) { m.userData.cull = 110 + CELL * 0.71; m.layers.set(2); } break; } // (main view only) // near LOD only // (2026-11-08: no shadow pass — pickets, wires, nets: the frame budget)
            case 'signs': addSuper(o, signMats[o.page], false, 'signs'); break;
            case 'spill': { const m = addSuper(o, spillMat, false, 'shop-spill'); if (m) { m.renderOrder = 5; m.castShadow = m.receiveShadow = false; } break; }
        }
    }
    if (preparedSmallWater && [...preparedSmallWater.values()].some(entry => !entry.consumed)) throw Error('A certified small-water group was not assembled');
    // ---- kerbside parking (district worlds, Bucharest): mapped parking keeps its location / orientation; legacy yes
    //      flags alone cannot authorize sidewalk cars. Untagged residential / unclassified streets (and tertiary streets
    //      with one lane each way) retain the parallel-kerb fallback where the sidewalk is ≥ 2.2 m. Clear of junctions,
    //      crossings, bus stops, fuel forecourts, trees, lamps and buildings. Kerb cars stand on the raised sidewalk;
    //      surface-lot cars above must clear that pavement with their whole footprint.
    let kerbParked = 0;
    if (!US && useInst) {
        const RI = data.roadInfo || [], kRng = makeRng(90127), cols = CAR_COLORS;
        const mappedParking = new Map((data.parking || []).map(row => [row[0], row]));
        const stops = pois.filter(p => p.kind === 'busstop'), parkLots = areas.filter(a => a.kind === 'parking');
        const kinds = ['hatch', 'hatch', 'sedan', 'suv', 'hatch', 'sedan'];
        const pcGrid = new BoxGrid(16); for (const pc of propColl) { const r = pc.r || 0.5; pcGrid.insert(pc.x - r, pc.z - r, pc.x + r, pc.z + r, pc); }
        for (const e of edges) {
            if (!e.drivable || e.virtual || e.tunnel || e.bridge || e.len < 22 || Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3) continue;
            const rf = RI[e.road * 6 + 1] | 0;
            const parking = mappedParking.get(e.road);
            const resid = /^(residential|unclassified|living_street)$/.test(e.type) || (e.type === 'tertiary' && e.lanesF <= 1 && e.lanesB <= 1);
            for (const sd of [1, -1]) {
                const tagged = sd > 0 ? (rf & 64) : (rf & 128), none = sd > 0 ? (rf & 256) : (rf & 512);
                if (none || (!resid && !tagged) || e.sidewalk < 2.2) continue;
                // Legacy yes flags omit the mapped location/orientation. A parking
                // lane (e.g. Calea Floreasca) does not authorize sidewalk cars.
                if (tagged && !parking) continue;
                if (parking) {
                    const offset = sd > 0 ? 1 : 3, location = str(parking[offset]), orientation = str(parking[offset + 1]);
                    // This pass draws parallel cars wholly on the kerb. Mapped
                    // carriageway bays, diagonal/perpendicular parking and half-on-
                    // kerb arrangements need their own surfaces/placement; don't
                    // silently turn those source facts into parallel sidewalk cars.
                    if ((orientation && orientation !== 'parallel') || (location && location !== 'on_kerb')) continue;
                    if (orientation && !location) continue;
                }
                const occ = tagged ? 0.86 : 0.72;
                const s0 = retract(e, e.a) + 9 + (e.a.crossing ? 8 : 0), s1 = e.len - retract(e, e.b) - 9 - (e.b.crossing ? 8 : 0);
                const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e), o = w + 1.2, yaw = Math.atan2(e.dirx, e.dirz) + (kRng() < 0.5 ? 0 : Math.PI);
                for (let sAl = s0 + kRng() * 2; sAl < s1; sAl += 5.4 + kRng() * 0.8) {
                    if (kRng() > occ) { if (kRng() < 0.25) sAl += 6; continue; } // (gaps, sometimes a driveway)
                    const x = e.a.x + e.dirx * sAl + e.nx * o * sd, z = e.a.z + e.dirz * sAl + e.nz * o * sd;
                    const box = { x, z, hw: 0.92, hd: 2.25, angle: yaw, r: 2.4, poly: null, h: 1.5, prop: true, kind: 'parked' };
                    const fp = obbPoly(box);
                    if (polyOnRibbon(fp) || fp.some(([qx, qz]) => buildingAt(qx, qz)) || buildingAt(x, z) || nearWater(x, z, 2.5)) continue;
                    const ry = raisedTop(x, z); if (ry === null) continue; // (only where the sidewalk is raised: the wheels stand on it)
                    if (treeNear(x, z, 2.2) || lampNear(x, z, 1.9) || treeClear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < (q.r + 3) ** 2)) continue;
                    if (stops.some(p => Math.hypot(p.x - x, p.z - z) < 14) || nearDoor(x, z)) continue;
                    // (2026-11-08, owner: "remove the cars parked next to the parking lot — their wheels are in the road") a
                    // street front with a car park behind the sidewalk has no kerbside parking: people park in the lot
                    if (parkLots.some(a => [2.5, 5, 8].some(d => { const qx = x + e.nx * sd * d, qz = z + e.nz * sd * d; return inArea(a, qx, qz); }))) continue;
                    if (mapEnds.some(m => Math.hypot(m.x - x, m.z - z) < 30)) continue; // (owner: "this sign is overlapping a car": the road-closure scene at the map edge)
                    let blocked = false; pcGrid.each(x - 3, z - 3, x + 3, z + 3, (pc) => { if (!blocked && Math.hypot(pc.x - x, pc.z - z) < (pc.r || 0.5) + 1.6) blocked = true; });
                    if (blocked) continue;
                    pcGrid.insert(x - 2.4, z - 2.4, x + 2.4, z + 2.4, box);
                    const k2 = Math.floor(x / (CELL * 2)) + ',' + Math.floor(z / (CELL * 2)); let L = parkedLots.get(k2); if (!L) parkedLots.set(k2, L = []);
                    const kind = kinds[Math.floor(kRng() * kinds.length)], color = cols[Math.floor(kRng() * cols.length)], cyaw = yaw + (kRng() - 0.5) * 0.05;
                    L.push({ kind, color, x, y: ry + 0.005, z, yaw: cyaw });
                    propColl.push(box); kerbParked++;
                }
            }
        }
    }
    let parkedCalls = 0;
    for (const [k, list] of parkedLots) {
        const [I, J] = k.split(',').map(Number);
        const pg = makeParkedCars(list, { city: city.id, paintSpace: 'linear', castShadow: false }); // (no shadow pass for lots) pg.name = `parked ${k}`; // (CAR_COLORS are sRGB hex: let three.js linearise them, as the old merged lots did)
        pg.userData.cx = (I + 0.5) * CELL * 2; pg.userData.cz = (J + 0.5) * CELL * 2; pg.userData.cull = 300 + CELL * 0.71; // (district worlds line every residential kerb with cars: drawn to ≈ 0.3 km beyond the cell)
        tris += pg.userData.triangles || 0; parkedCalls += pg.userData.drawCalls || 0;
        pg.traverse(o => o.layers.set(2)); // (layer 2, main view only: the mirror pass skips parked lots)
        cellsGroup.add(pg);
    }
    for (const m of vegetation.treeCrownMeshes.concat(vegetation.treeTrunkMeshes)) { cellsGroup.add(m); tris += (m.userData.always ? m.instanceMatrix.count : m.count) * (m.geometry.index.count / 3); }
    { const hMat = new THREE.MeshLambertMaterial({ vertexColors: true }); hMat.name = 'horizon'; const hm = addMesh(horizon, hMat, false, 'horizon'); if (hm) { hm.userData.always = true; hm.frustumCulled = true; } }
    let waterMesh = addMesh(bigWater, waterMat, false, 'water-big'); if (waterMesh) shoreFoam(waterMesh);
    if (waterMesh && (waterMesh.geometry.index?.count || waterMesh.geometry.attributes.position.count) > 15000) {
        // A single lake/river mesh spanning the district defeats frustum culling:
        // the mirror submitted all 60k water triangles even when it saw no water.
        // Partition after shoreline calculation, preserving every triangle and
        // attribute (including shore distance) so chunk edges add no foam seams.
        const source = waterMesh.geometry, position = source.attributes.position, index = source.index;
        const chunks = new Map(), count = index ? index.count : position.count;
        const vertex = i => index ? index.getX(i) : i;
        for (let i = 0; i < count; i += 3) {
            const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2);
            const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
            const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
            const key = Math.floor(x / 500) + ',' + Math.floor(z / 500);
            let vertices = chunks.get(key); if (!vertices) chunks.set(key, vertices = []);
            vertices.push(a, b, c);
        }
        if (chunks.size > 1) {
            const parent = new THREE.Group(); parent.name = 'water-big';
            for (const [key, vertices] of chunks) {
                const geometry = new THREE.BufferGeometry();
                for (const [name, attribute] of Object.entries(source.attributes)) {
                    const size = attribute.itemSize, array = new attribute.array.constructor(vertices.length * size);
                    vertices.forEach((v, i) => { for (let c = 0; c < size; c++) array[i * size + c] = attribute.array[v * size + c]; });
                    geometry.setAttribute(name, new THREE.BufferAttribute(array, size, attribute.normalized));
                }
                geometry.computeBoundingSphere();
                const mesh = new THREE.Mesh(geometry, waterMat); mesh.name = 'water-big ' + key;
                mesh.receiveShadow = true; mesh.renderOrder = -18; mesh.matrixAutoUpdate = false;
                parent.add(mesh);
            }
            parent.userData.triangles = count / 3; parent.userData.chunks = chunks.size;
            waterMesh.removeFromParent(); source.dispose(); cellsGroup.add(parent); waterMesh = parent;
        }
    }
    if (waterMesh) { waterMesh.userData.always = true; waterMesh.renderOrder = -18; }
    if (waterMesh?.isGroup) {
        // Group order precedes mesh order in Three's opaque sort. Keep this group
        // neutral so land draws first; small water/shore meshes still overlay it.
        waterMesh.renderOrder = 0;
        for (const mesh of waterMesh.children) mesh.renderOrder = -18.1;
    }
    // Read the complete final retained water before its first view selection.
    if(waterMesh?.isGroup)for(const m of waterMesh.children)fallbackApertures.addGeometry(m.geometry,'final-water');
    else if(waterMesh?.geometry)fallbackApertures.addGeometry(waterMesh.geometry,'final-water');
    for (const pit of landmarkPits) for (const q of pit.tris) { const v = q.map(([x, z]) => [x, pit.floorY, z]); fallbackApertures.addTriangle(v, 'landmark-pit'); fallbackApertures.addTriangle([v[0], v[2], v[1]], 'landmark-pit'); }
    if (waterMesh?.isGroup) batchWaterChunks(waterMesh);
    // distance culling: cells beyond the fog are hidden (three.js only frustum-culls, and the camera far plane is 5 km).
    // The viewer is world.camera if set, else the widest perspective camera found in the scene.
    const _v = new THREE.Vector3();
    return {
        _v, cullR, kerbParked, tramTrench, waterMesh, get tris() { return tris; },
    };
}
