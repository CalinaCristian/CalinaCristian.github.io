// ============================================================================
//  WORLD PARKING AND LIGHTS — parked cars, traffic-light heads, lamp meshes, world materials
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { UNDERPASS_COVER_POLICY } from './underpass-roof.js';
import * as THREE from '../vendor/three.module.min.js';
import { makeCanvasTexture } from './util.js';
import { makeAtlas, noiseTexture, solidMaterial } from './world-materials.js';
import { CAR_COLORS, makeParkedCars, vehicleSize } from './vehicles.js';
import { assignSignalPhases } from './signals.js';
import { parkingBodyOverlap, parkingPolygonsOverlap, parkingRowPose, resolveParkingLayout } from './parking-layout.js';
import { sidewalkWidth } from './sidewalk-source.js';
import { BoxGrid, CELL, carProps, polysCross, setProgress, shoulderOf, tick } from './world-shared.js';

export async function buildParkingLights(ctx) {
    const {
        DY_SIDE, P, SIDE_BACK, US, addPropColl, areas, bGrid, buildingAt,
        cellOf, city, clusters, cornerPolys, data, dmask, earlyAtlas, edges,
        group, inArea, nearWater, nodeArr, obbPoly, onRibbon, pois, polyOnRibbon,
        propColl, raisedEdge, raisedTop, retract, rng, tramSweep, underpassCover, widthAsphalt,
    } = ctx;
    // parked cars on surface parking lots
    const carKinds = US ? ['suv', 'sedan', 'suv', 'hatch'] : ['hatch', 'sedan', 'hatch', 'suv'];
    // parked cars: vehicles.js `makeParkedCars` (low-detail ~250-tri parked models as one InstancedMesh per kind, per-car
    // colour), one group per 500 m super-cell (culling + few draw calls); full lots again (the 700 k cap is gone).
    // Fallback without it: merged low-LOD props, triangle-capped.
    const parkedLots = new Map(); // super-cell key → [{kind, color, x, y, z, yaw}]
    const parkingOverlap = parkingPolygonsOverlap;
    // Mapped lots can extend under the modeled pavement (the lot at the Rosetti
    // start does). Test the complete car, including intersections through its
    // edges, against sidewalk bands and junction corners; a clear centre is not
    // enough. Keep the source lot polygon and the remaining stalls in place.
    const parkingWalks = new BoxGrid(24);
    const addParkingWalk = (p) => parkingWalks.insert(Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1])), p);
    {
        for (const e of edges) if (raisedEdge(e)) for (const sd of [1, -1]) {
            if (!raisedEdge(e, sd)) continue;
            const wi = widthAsphalt(e, sd) + 0.02, wo = widthAsphalt(e, sd) + sidewalkWidth(e, sd) + SIDE_BACK;
            addParkingWalk([[e.a.x + e.nx * wi * sd, e.a.z + e.nz * wi * sd], [e.b.x + e.nx * wi * sd, e.b.z + e.nz * wi * sd], [e.b.x + e.nx * wo * sd, e.b.z + e.nz * wo * sd], [e.a.x + e.nx * wo * sd, e.a.z + e.nz * wo * sd]]);
        }
        for (const cp of cornerPolys) addParkingWalk(cp.p);
    }
    const parkingFits = (a, fp) => fp.every(([x, z]) => inArea(a, x, z)) && !polysCross(fp, a.outer) && !a.holes.some(h => parkingOverlap(fp, h));
    const parkingOnWalk = (fp) => {
        let hit = false;
        parkingWalks.each(Math.min(...fp.map(q => q[0])), Math.min(...fp.map(q => q[1])), Math.max(...fp.map(q => q[0])), Math.max(...fp.map(q => q[1])), p => { if (!hit && parkingOverlap(fp, p)) hit = true; });
        return hit;
    };
    const parkingOnBuilding = fp => {
        let hit = false;
        bGrid.each(Math.min(...fp.map(q => q[0])), Math.min(...fp.map(q => q[1])), Math.max(...fp.map(q => q[0])), Math.max(...fp.map(q => q[1])), b => {
            if (hit || b.skip && data.buildingGeometryPolicy !== 'source') return;
            hit = parkingBodyOverlap(fp, { outer: b.ring, holes: b.holes, minHeightM: b.minH, maxHeightM: b.h });
        });
        return hit;
    };
    const parkingSupports = new BoxGrid(24);
    for (const c of propColl) if (c.kind === 'canopy-support') {
        const p = c.poly || obbPoly(c);
        parkingSupports.insert(Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1])), p);
    }
    const parkingOnSupport = fp => {
        let hit = false;
        parkingSupports.each(Math.min(...fp.map(q => q[0])), Math.min(...fp.map(q => q[1])), Math.max(...fp.map(q => q[0])), Math.max(...fp.map(q => q[1])), p => { if (!hit && parkingOverlap(fp, p)) hit = true; });
        return hit;
    };
    // (2026-11-08, owner: cars parked across a CV stop's glowing door ring) no parked car within 7 m of a stop's door
    const stopDoors = pois.filter(p => p.interactive && p.doorX !== undefined), nearDoor = (x, z) => stopDoors.some(p => Math.hypot(p.doorX - x, p.doorZ - z) < 7);
    const useInst = typeof makeParkedCars === 'function';
    const carTris = useInst ? 260 : carKinds.reduce((s2, k) => { const pr = carProps(k, CAR_COLORS[0]); return s2 + (pr.index ? pr.index.length / 3 : 772); }, 0) / carKinds.length;
    const parkingClearance = { candidates: 0, retained: 0, outsideSourceLot: 0, raisedSidewalk: 0, buildingBody: 0, canopySupport: 0, measuredLots: [] };
    let parked = 0, lotSeeds = 0; const maxParked = Math.round(Math.min(city.id === 'bucharest' ? 2600 : 2000, 195000 / Math.max(1, carTris)));
    for (const a of areas) {
        if (a.kind !== 'parking' || lotSeeds >= maxParked || a.size < 120) continue;
        // orientation: longest edge
        let best = 0, ang = 0;
        for (let k = 0; k < a.outer.length; k++) { const [ax, az] = a.outer[k], [bx, bz] = a.outer[(k + 1) % a.outer.length]; const L = Math.hypot(bx - ax, bz - az); if (L > best) { best = L; ang = Math.atan2(bx - ax, bz - az); } }
        const measured = a.parkingLayout?.sourceId === a.sourceId ? resolveParkingLayout(a.parkingLayout, a.parkingLayout.sourceTags).layout : null;
        if (measured) parkingClearance.measuredLots.push(a.sourceId);
        if (measured) ang = parkingRowPose(measured, 0).rowYaw;
        const ux = Math.sin(ang), uz = Math.cos(ang), vx = uz, vz = -ux; // u along rows, v across
        const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2, R = Math.hypot(a.x1 - a.x0, a.z1 - a.z0) / 2;
        let lotCount = 0;
        // (2026-11-08) lots in the scenery ring outside the playable area (reality-pass districts): a light fill, frame budget
        const lotFill = dmask && !dmask.at(cx, cz) ? 0.22 : 0.72, lotMax = 45;
        for (let v = -R, row = 0; v < R; row++) {
            const measuredRow = measured ? parkingRowPose(measured, row) : null;
            for (let u = -R; u < R; u += measuredRow?.stallPitchM || 2.6) {
                const x = cx + ux * u + vx * v, z = cz + uz * u + vz * v;
                if (!inArea(a, x, z) || !inArea(a, x + vx * 2.6, z + vz * 2.6) || !inArea(a, x - vx * 2.6, z - vz * 2.6)) continue;
                if (!rng.chance(lotFill) || (buildingAt(x, z)?.minH ?? Infinity) <= 2.1 || nearWater(x, z, 3.5) || nearDoor(x, z)) continue; // (never on a channel quay slope / in water)
                const rot = measuredRow?.stallYaw ?? (ang + (row % 2 ? 0 : Math.PI) + Math.PI / 2);
                const box = { x, z, hw: 0.95, hd: 2.3, angle: rot, r: 2.5, poly: null, h: 1.5, prop: true, kind: 'parked', parkingSourceId: a.sourceId, parkingAreaIndex: a.areaIndex };
                if (polyOnRibbon(obbPoly({ ...box, hw: 1.3, hd: 2.7 })) || [-1.6, 0, 1.6].some(o => onRibbon(x + Math.sin(rot) * o, z + Math.cos(rot) * o, 1.2))) continue; // keep off any carriageway / lane strip
                const kind = rng.pick(carKinds), col = rng.pick(CAR_COLORS);
                // Consume the original seed and paint choices even when rejected:
                // removing an obstructing car must not shuffle the valid stalls.
                lotSeeds++; lotCount++;
                const size = vehicleSize(kind, city.id);
                box.hw = Math.max(box.hw, size.width / 2); box.hd = Math.max(box.hd, size.length / 2); box.r = Math.hypot(box.hw, box.hd);
                const fp = obbPoly({ ...box, hw: box.hw + 0.1, hd: box.hd + 0.1 });
                parkingClearance.candidates++;
                const fits = parkingFits(a, fp), walk = fits && parkingOnWalk(fp), body = fits && !walk && parkingOnBuilding(fp), support = fits && !walk && !body && parkingOnSupport(fp);
                if (!fits) parkingClearance.outsideSourceLot++;
                else if (walk) parkingClearance.raisedSidewalk++;
                else if (body) parkingClearance.buildingBody++;
                else if (support) parkingClearance.canopySupport++;
                else {
                    if (useInst) { const k2 = Math.floor(x / (CELL * 2)) + ',' + Math.floor(z / (CELL * 2)); let L = parkedLots.get(k2); if (!L) parkedLots.set(k2, L = []); L.push({ kind, color: col, x, y: 0.12, z, yaw: rot }); }
                    else cellOf(x, z).solid.geo(carProps(kind, col), x, 0.12, z, rot, 1, 1, 1, [255, 255, 255]);
                    propColl.push(box); parked++;
                    parkingClearance.retained++;
                }
                if (lotSeeds >= maxParked || lotCount > lotMax) break;
            }
            if (lotSeeds >= maxParked || lotCount > lotMax) break;
            v += row % 2 ? 7.5 : 5.2; // two rows back to back, then an aisle
        }
    }

    // -----------------------------------------------------------------------
    //  TRAFFIC LIGHTS (static poles + instanced lit lamps)
    // -----------------------------------------------------------------------
    const lights = [];
    const lampList = [];
    for (const n of nodeArr) {
        if (!n.hasLight || !n.edges.length) continue;
        const cl = n.lightCluster;
        const approaches = [];
        for (const e of n.edges) {
            const atA = e.a === n;
            if (atA && e.oneway) continue; // traffic only leaves the node on this edge
            const out = atA ? 1 : -1;
            const dx = e.dirx * out, dz = e.dirz * out; // pointing away from the node along the edge
            const rx = dz, rz = -dx; // right-hand side of the incoming travel direction (-d)
            const w = (atA ? e.wL : e.wR) + shoulderOf(e) + 0.9;
            const r = retract(e, n) + 1.2;
            let px = n.x + dx * r + rx * w, pz = n.z + dz * r + rz * w;
            const poleBlocked = () => onRibbon(px, pz, 0.3) || !!tramSweep?.circle(px, pz, 0.2, 0, 3);
            for (let k = 0; k < 5 && poleBlocked(); k++) { px += rx * 0.7; pz += rz * 0.7; } // never in another approach's carriageway or in a tram's swept body
            const noPole = !!poleBlocked(); // no room for a pole: the approach keeps its phase, no pole is drawn
            const c = cellOf(px, pz);
            const rot = Math.atan2(-dz, dx); // housing local +x faces along +d (toward incoming cars)
            const tly = 0.15 + n.y + (raisedTop(px, pz, 0.3) !== null ? DY_SIDE : 0); // (on a raised corner)
            if (!noPole) { c.solid.geo(P.tlight, px, tly, pz, rot, 1, 1, 1, [255, 255, 255]); addPropColl(px, pz, 0.2, 'tlight'); }
            const ap = { edge: e, node: n, x: px + dx * 0.36, z: pz + dz * 0.36, y: noPole ? -200 : tly, state: null, lamp: lampList.length, lamps: null, noPole };
            lampList.push(ap);
            approaches.push(ap);
        }
        if (approaches.length) lights.push({ node: n, approaches, offset: cl.offset });
    }
    for (const cl of clusters.values()) cl.phaseCount = assignSignalPhases(lights.filter(l => l.node.lightCluster === cl).flatMap(l => l.approaches));
    const nodeLight = {};
    for (const l of lights) nodeLight[l.node.id] = l;
    const lampMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), Math.max(1, lampList.length));
    lampMesh.count = lampList.length;
    lampMesh.frustumCulled = false;
    lampMesh.name = 'trafficLamps';
    const LAMP_COL = { red: new THREE.Color('#ff3b30').multiplyScalar(1.6), yellow: new THREE.Color('#ffcc00').multiplyScalar(1.6), green: new THREE.Color('#34c759').multiplyScalar(1.6) };
    const LAMP_Y = { red: 4.5, yellow: 4.12, green: 3.74 };
    const tmpM = new THREE.Matrix4();
    for (const ap of lampList) { tmpM.makeTranslation(ap.x, ap.y + 4.5, ap.z); lampMesh.setMatrixAt(ap.lamp, tmpM); lampMesh.setColorAt(ap.lamp, LAMP_COL.red); }
    group.add(lampMesh);

    // -----------------------------------------------------------------------
    //  MESHES
    // -----------------------------------------------------------------------
    setProgress('Finishing…'); await tick();
    const atlas = earlyAtlas ? earlyAtlas.atlas : makeAtlas();
    const solidMat = solidMaterial(atlas, earlyAtlas?.night);
    // shop light spill: additive, black diffuse + warm emissive with a falloff away from the window; render eases
    // emissiveIntensity 0 → nightEmissive at dusk (0 by day: adds nothing); dimmed as shops close (uClosed)
    const spillMat = (() => {
        const g = makeCanvasTexture(4, 64, (ctx, w, h) => { const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#6a6a6a'); gr.addColorStop(1, '#000000'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); });
        g.colorSpace = THREE.NoColorSpace;
        const m = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: new THREE.Color('#ffc890'), emissiveMap: g, emissiveIntensity: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12, fog: true });
        m.userData.nightEmissive = 0.3; m.name = 'shop-spill';
        m.onBeforeCompile = (sh) => { sh.uniforms.uClosed = solidMat.userData.uClosed; sh.fragmentShader = 'uniform float uClosed;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= 1.0 - 0.8 * uClosed;'); };
        return m;
    })();
    const noise = noiseTexture();
    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise });
    if (!underpassCover.empty) {
        const material = new THREE.MeshBasicMaterial({ colorWrite: UNDERPASS_COVER_POLICY.colorWrite, depthWrite: UNDERPASS_COVER_POLICY.depthWrite, depthTest: UNDERPASS_COVER_POLICY.depthTest });
        material.name = 'underpass-earth-cover';
        const mesh = new THREE.Mesh(underpassCover.build(), material);
        mesh.name = 'underpass-earth-cover'; mesh.renderOrder = UNDERPASS_COVER_POLICY.renderOrder;
        mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.castShadow = mesh.receiveShadow = false;
        group.add(mesh);
    }
    // strict layering (spec R11.2): ground/sidewalks (0) < carriageways (-1) < junction pads (-2) < markings (-4); each also has
    // its own renderOrder, so coplanar pieces resolve the same way every frame (no z-fighting / flicker)
    const roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); roadMat.name = 'road';
    const padMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); padMat.name = 'junction';
    const marksMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }); marksMat.name = 'markings';
    return {
        LAMP_COL, LAMP_Y, atlas, groundMat, lampMesh, lights, marksMat, nearDoor,
        nodeLight, noise, padMat, parked, parkedLots, parkingClearance, roadMat, solidMat,
        spillMat, tmpM, useInst,
    };
}
