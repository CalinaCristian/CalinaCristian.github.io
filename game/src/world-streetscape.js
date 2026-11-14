// ============================================================================
//  STREETSCAPE — trees, lamps, street furniture, road signs, parked cars, lights and the shared world materials
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { CANDELABRA_MODEL } from './lamp-reviews.js';
import * as THREE from '../vendor/three.module.min.js';
import { bakeProp, mergeProps, rgb } from './geobuild.js';
import { sidewalkWidth } from './sidewalk-source.js';
import { inferredRoadSignUnit } from './inferred-road-sign.js';
import { setProgress, shoulderOf, tick } from './world-shared.js';
import { motorOneway } from './contraflow-bus.js';
import { buildParkingLights } from './world-parking-lights.js';
import { buildTreesLamps } from './world-trees-lamps.js';
import { buildMapEndClosures } from './world-map-ends.js';

export async function buildStreetscape(ctx) {
    const {
        ASPHALT, DY_SIDE, P, SIDE_BACK, US, addPropColl, addSignQuad, areas,
        bGrid, basarabStructure, boundarySupport, builderEpoch, buildingAt, cellOf, cells, channelAreas,
        city, clearOf, clusters, cornerPolys, data, distId, dmask, earlyAtlas,
        edges, finishPendingRanges, group, inArea, isWater, kerbSpot, lampSpots, landmarkWaterFootprints,
        liftOnSide, lmGrounds, mapEnds, medianFill, nearWater, nearestEdge, nodeArr, obbPoly,
        onRibbon, pierColl, pois, polyDist, polyOnRibbon, propColl, raisedEdge, raisedTop,
        retract, ribGrid, rng, sceneryDeckGrid, signs, str, surfacesAt, sweptOut,
        tramGrades, tramPropEnvelope, tramSweep, tramSweepConflicts, treeClear, treeSpots, underpassCover, walls,
        widthAsphalt, yAlong,
    } = ctx;
    // -----------------------------------------------------------------------
    //  TREES, LAMPS, PARKED CARS
    // -----------------------------------------------------------------------
    setProgress('Planting trees…'); await tick();
    // every tree / lamp / prop below is checked against the carriageway ribbons (onRibbon) before it is placed
    const maxTrees = city.id === 'bucharest' ? 32000 : 28000;
    const treeList = [], treeBodies = new WeakMap(), treeSourceMetadata = new WeakMap();
    // (world trees and lamps: world-trees-lamps.js)
    const {
        __buildStreetFurniture, basarabLamps, channelM, closures, deckLamps, elevatedDataset, elevatedPlan, furnCount,
        lampGrid, lampNear, lamps, lampsMoved, treeAdditions, treeBuildingClearance, treeCount, treeDeckClearance,
        treeNear, treesOSM, treesRows, vegetation, waterTreeConflicts,
    } = await buildTreesLamps({
        US, addPropColl, areas, bGrid, basarabStructure, buildingAt, cellOf, channelAreas,
        city, clearOf, data, distId, edges, finishPendingRanges, inArea, isWater,
        kerbSpot, lampSpots, landmarkWaterFootprints, liftOnSide, lmGrounds, maxTrees, medianFill, nearWater,
        nearestEdge, onRibbon, pierColl, polyDist, propColl, raisedTop, ribGrid, rng,
        sceneryDeckGrid, str, surfacesAt, sweptOut, tramGrades, tramPropEnvelope, tramSweep, tramSweepConflicts,
        treeBodies, treeClear, treeList, treeSourceMetadata, treeSpots, walls, yAlong,
    });
    // (world map-end closures: world-map-ends.js)
    buildMapEndClosures({
        ASPHALT, US, addPropColl, addSignQuad, boundarySupport, builderEpoch, buildingAt, cellOf,
        cells, city, closures, data, distId, dmask, isWater, mapEnds,
        propColl, signs, yAlong,
    });
    // road signs: speed limits where the limit changes, one-way at one-way entries, no-entry at one-way exits
    let signCount = 0;
    {
        const signRailAudit = tramGrades.report.inferredRoadSigns = { checked: 0, refused: 0, bySource: {}, samples: [], scope: 'Complete inferred post/front/back-plate unit only; mapped signs unchanged; unknown source grades not certified.' };
        const kmh = (e) => Math.round(e.maxspeed * 3.6);
        const label = (e) => US ? Math.round(kmh(e) / 1.609 / 5) * 5 : Math.round(kmh(e) / 10) * 10;
        const placeSign = (e, along, sd, faceSign, icon) => { // faceSign: +1 faces along +dir, -1 against
            const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e);
            const sw = sidewalkWidth(e, sd), o = sw >= 1.2 ? w + Math.min(0.6, sw * 0.4) : w + 0.7;
            const x = e.a.x + e.dirx * along + e.nx * o * sd, z = e.a.z + e.dirz * along + e.nz * o * sd;
            if (onRibbon(x, z, 0.2) || buildingAt(x, z)) return false;
            const y0 = 0.15 + yAlong(e, x, z) + (raisedTop(x, z) !== null ? DY_SIDE : 0), ang = Math.atan2(e.dirx * faceSign, e.dirz * faceSign);
            const unit = inferredRoadSignUnit({ grades:tramGrades, envelope:tramPropEnvelope, x, z, angle:ang, baseY:y0, width:icon.w||.75, height:icon.h||.75, sourceId:data.roadSourceGeometry?.[e.road]?.sourceId||e.access?.sourceId||null });
            signRailAudit.checked++;
            const signSource = data.roadSourceGeometry?.[e.road]?.sourceId||e.access?.sourceId||null, sourceAudit = signRailAudit.bySource[signSource||'unattributed'] ||= { checked:0, refused:0 };
            sourceAudit.checked++;
            if (!unit.allowed) { signRailAudit.refused++; sourceAudit.refused++; if(signRailAudit.samples.length<200)signRailAudit.samples.push({ sourceId:signSource, edgeId:e.id, along, side:sd, icon:icon.key, x, z, baseY:y0, ...unit }); return false; }
            const s = signs.icon(icon.key, icon.draw); if (!s) return false;
            const c = cellOf(x, z);
            c.solid.box(x, y0, z, 0.07, 2.3, 0.07, ang, rgb('#8d939a'));
            addSignQuad(c, x, z, ang, 1, icon.w || 0.75, icon.h || 0.75, y0 + 2.0, s, 0.06);
            const back = signs.icon('back', (ctx, X, Y2, S2) => { ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.arc(X + S2 / 2, Y2 + S2 / 2, S2 / 2 - 2, 0, 7); ctx.fill(); });
            if (back) addSignQuad(c, x, z, ang, -1, icon.w || 0.75, icon.h || 0.75, y0 + 2.0, back, 0.04);
            addPropColl(x, z, 0.1, 'sign'); signCount++;
            return true;
        };
        const speedIcon = (v) => US
            ? { key: 'mph' + v, w: 0.6, h: 0.75, draw: (ctx, X, Y2, S2) => { ctx.fillStyle = '#111'; ctx.fillRect(X + 6, Y2, S2 - 12, S2); ctx.fillStyle = '#fff'; ctx.fillRect(X + 9, Y2 + 3, S2 - 18, S2 - 6); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = 'bold 9px Arial'; ctx.fillText('SPEED', X + S2 / 2, Y2 + 14); ctx.fillText('LIMIT', X + S2 / 2, Y2 + 24); ctx.font = 'bold 26px Arial'; ctx.fillText(String(v), X + S2 / 2, Y2 + 52); } }
            : { key: 'kmh' + v, draw: (ctx, X, Y2, S2) => { const c2 = [X + S2 / 2, Y2 + S2 / 2]; ctx.fillStyle = '#d0021b'; ctx.beginPath(); ctx.arc(c2[0], c2[1], S2 / 2 - 1, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c2[0], c2[1], S2 / 2 - 8, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${v >= 100 ? 20 : 26}px Arial`; ctx.fillText(String(v), c2[0], c2[1] + 1); } };
        const noEntry = { key: 'noentry', draw: (ctx, X, Y2, S2) => { ctx.fillStyle = '#d0021b'; ctx.beginPath(); ctx.arc(X + S2 / 2, Y2 + S2 / 2, S2 / 2 - 1, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(X + 12, Y2 + S2 / 2 - 6, S2 - 24, 12); } };
        const oneWay = { key: 'oneway', w: 0.9, h: 0.5, draw: (ctx, X, Y2, S2) => { ctx.fillStyle = US ? '#111' : '#1d4ed8'; ctx.fillRect(X, Y2 + 14, S2, S2 - 28); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(X + 8, Y2 + 28); ctx.lineTo(X + 40, Y2 + 28); ctx.lineTo(X + 40, Y2 + 21); ctx.lineTo(X + 57, Y2 + 32); ctx.lineTo(X + 40, Y2 + 43); ctx.lineTo(X + 40, Y2 + 36); ctx.lineTo(X + 8, Y2 + 36); ctx.closePath(); ctx.fill(); } };
        // (contraflow-bus.js) the no-entry sign where a contraflow bus lane enters a one-way carries the supplementary plate
        // that exempts buses: white with a black border, "EXCEPTÂND" over a bus pictogram (Romanian additional panel; US:
        // "EXCEPT BUSES"), about 0.6 × 0.3 m just under the disc on the same post. Wording and size are an estimate
        // (research dossiers: bucharest-floreasca.md, bucharest-unirii.md → Estimates).
        const plateIcon = { key: US ? 'except-buses' : 'exceptand-autobuz', draw: (ctx, X, Y2, S2) => {
            const y = Y2 + S2 / 4, h = S2 / 2; // the plate is the middle band of the square cell (drawn 2:1 on a square quad)
            ctx.fillStyle = '#111'; ctx.fillRect(X + 1, y, S2 - 2, h); ctx.fillStyle = '#fff'; ctx.fillRect(X + 3, y + 2, S2 - 6, h - 4);
            ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if (US) { ctx.font = 'bold 10px Arial'; ctx.fillText('EXCEPT', X + S2 / 2, y + 10, S2 - 8); ctx.fillText('BUSES', X + S2 / 2, y + 22, S2 - 8); return; }
            ctx.font = 'bold 8px Arial'; ctx.fillText('EXCEPTÂND', X + S2 / 2, y + 8, S2 - 8);
            const bx = X + 17, by = y + 14, bw = 30, bh = 12; // bus pictogram: body, windows, wheels
            ctx.fillRect(bx, by, bw, bh - 3); ctx.fillStyle = '#fff';
            for (let k = 0; k < 4; k++) ctx.fillRect(bx + 2 + k * 6.5, by + 2, 4.5, 3);
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(bx + 7, by + bh - 3, 2.6, 0, 7); ctx.arc(bx + bw - 7, by + bh - 3, 2.6, 0, 7); ctx.fill();
        } };
        const busPlate = (e, along, sd) => {
            const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e), sw = sidewalkWidth(e, sd), o = sw >= 1.2 ? w + Math.min(0.6, sw * 0.4) : w + 0.7;
            const x = e.a.x + e.dirx * along + e.nx * o * sd, z = e.a.z + e.dirz * along + e.nz * o * sd; // (the no-entry sign's post)
            const y0 = 0.15 + yAlong(e, x, z) + (raisedTop(x, z) !== null ? DY_SIDE : 0), ang = Math.atan2(e.dirx, e.dirz);
            const s = signs.icon(plateIcon.key, plateIcon.draw); if (!s) return;
            const c = cellOf(x, z), S = 0.62; // square quad; the drawn plate is its middle band, 0.62 × 0.31 m
            addSignQuad(c, x, z, ang, 1, S, S, y0 + 2.0 - 0.375 - 0.04 - S / 4, s, 0.06);
            const back = signs.icon('plate-back', (ctx, X, Y2, S2) => { ctx.fillStyle = '#9aa0a6'; ctx.fillRect(X + 1, Y2 + S2 / 4, S2 - 2, S2 / 2); });
            if (back) addSignQuad(c, x, z, ang, -1, S, S, y0 + 2.0 - 0.375 - 0.04 - S / 4, back, 0.04);
            signCount++;
        };
        const cont = (n, e) => { // the edge continuing e through node n (same name preferred, best aligned)
            let best = null, bs = -Infinity;
            for (const f of n.edges) { if (f === e || f.virtual) continue; const out = f.a === n ? 1 : -1, inn = e.b === n ? 1 : -1; const d = (f.dirx * out) * (e.dirx * inn) + (f.dirz * out) * (e.dirz * inn); const sc = d + (f.name && f.name === e.name ? 1 : 0); if (sc > bs) { bs = sc; best = f; } }
            return bs > 0.6 ? best : null;
        };
        for (const e of edges) {
            if (e.virtual || e.tunnel || !e.drivable || e.type === 'service' || e.len < 20) continue;
            const mw = /motorway/.test(e.type);
            for (const dir of motorOneway(e) ? [1] : [1, -1]) { // (a contraflow bus lane keeps the one-way's signs)
                const n = dir > 0 ? e.a : e.b; // node where traffic in direction `dir` enters e
                const f = cont(n, e);
                if (!f || label(f) === label(e) || (mw && !/motorway/.test(f.type))) continue;
                const r = retract(e, n) + 6; if (r > e.len - 6) continue;
                placeSign(e, dir > 0 ? r : e.len - r, dir, -dir, speedIcon(label(e)));
            }
            if (!motorOneway(e) || mw || e.roundabout || /_link/.test(e.type)) continue;
            if (e.a.edges.length >= 3) placeSign(e, retract(e, e.a) + 3, 1, -1, oneWay);
            if (e.b.edges.length >= 3) { const r = e.len - retract(e, e.b) - 2.5; if (r > 3) for (const sd of [1, -1]) if (placeSign(e, r, sd, 1, noEntry) && e.contraflowBus) busPlate(e, r, sd); }
        }
    }
    // instanced posts + heads (filled with the lamps near the viewer, see the culling hook below)
    const postGeo = new THREE.BufferGeometry(), headGeo = new THREE.BufferGeometry();
    {
        const pole = new THREE.CylinderGeometry(0.07, 0.11, 1, 5);
        const toGeo = (p, g) => { g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(p.nor, 3)); g.setIndex(new THREE.BufferAttribute(p.index, 1)); };
        toGeo(mergeProps([bakeProp(pole, { y: 4, sy: 8 }), bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 0.9, y: 7.9, sx: 1.9, sy: 0.12, sz: 0.12 })]), postGeo);
        toGeo(bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 1.8, y: 7.78, sx: 0.75, sy: 0.16, sz: 0.34 }), headGeo);
    }
    const arcPostGeo = new THREE.BufferGeometry(), arcHeadGeo = new THREE.BufferGeometry();
    {
        // unit height 8 like the street lamp (scaled by h / 8): a straight post to 5.6, then three chords curving in to 2.1 m
        const toGeo = (p, g) => { g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(p.nor, 3)); g.setIndex(new THREE.BufferAttribute(p.index, 1)); };
        const pts = [[0, 5.6], [.3, 6.7], [.95, 7.5], [1.95, 7.9]], parts = [bakeProp(new THREE.CylinderGeometry(0.075, 0.12, 1, 5), { y: 2.8, sy: 5.6 })];
        for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0); parts.push(bakeProp(new THREE.BoxGeometry(L + .06, .13, .13), { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rz: Math.atan2(y1 - y0, x1 - x0) })); }
        toGeo(mergeProps(parts), arcPostGeo);
        toGeo(bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 2.3, y: 7.84, sx: 0.8, sy: 0.14, sz: 0.34 }), arcHeadGeo);
    }
    const candPostGeo = new THREE.BufferGeometry(), candHeadGeo = new THREE.BufferGeometry();
    { // (r3-look-13) candelabra: dark post on a plinth, a cross of arms and a cluster of globes (unit height 8, CANDELABRA_MODEL)
        const toGeo = (p, g) => { g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(p.nor, 3)); g.setIndex(new THREE.BufferAttribute(p.index, 1)); };
        const C = CANDELABRA_MODEL, a = C.armHalfM;
        toGeo(mergeProps([bakeProp(new THREE.BoxGeometry(1, 1, 1), { y: 0.45, sx: 0.55, sy: 0.9, sz: 0.55 }), bakeProp(new THREE.CylinderGeometry(0.1, 0.16, 1, 6), { y: 3.9, sy: 6.0 }),
            bakeProp(new THREE.BoxGeometry(1, 1, 1), { y: 6.95, sx: a * 2 + 0.1, sy: 0.1, sz: 0.1 }), bakeProp(new THREE.BoxGeometry(1, 1, 1), { y: 6.95, sx: 0.1, sy: 0.1, sz: a * 2 + 0.1 }),
            bakeProp(new THREE.CylinderGeometry(0.07, 0.09, 1, 5), { y: 7.35, sy: 0.8 })]), candPostGeo);
        const globe = (x, y, z) => bakeProp(new THREE.IcosahedronGeometry(C.globeR, 1), { x, y, z });
        toGeo(mergeProps([globe(0, 7.85, 0), globe(a, 7.3, 0), globe(-a, 7.3, 0), globe(0, 7.3, a), globe(0, 7.3, -a)]), candHeadGeo);
    }
    const CAND_MAX = lamps.filter(l => l.candelabra).length || 1;
    const ARC_MAX = lamps.filter(l => l.arc).length || 1;
    const LAMP_MAX = Math.min(lamps.length, 6000) || 1;
    const lampPostMesh = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: '#4a4f57' }), LAMP_MAX);
    const lampHeadMesh = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: '#f4f1e6', emissive: '#000000', emissiveIntensity: 1, roughness: 0.4 }), LAMP_MAX);
    lampPostMesh.name = 'lampPosts'; lampHeadMesh.name = 'lampHeads';
    lampPostMesh.castShadow = true; lampPostMesh.frustumCulled = false; lampHeadMesh.frustumCulled = false;
    lampPostMesh.count = lampHeadMesh.count = 0;
    group.add(lampPostMesh, lampHeadMesh);
    const arcPostMesh = new THREE.InstancedMesh(arcPostGeo, new THREE.MeshLambertMaterial({ color: '#dfe4e3' }), ARC_MAX), arcHeadMesh = new THREE.InstancedMesh(arcHeadGeo, lampHeadMesh.material, ARC_MAX);
    arcPostMesh.name = 'lampArcPosts'; arcHeadMesh.name = 'lampArcHeads'; arcPostMesh.castShadow = true; arcPostMesh.frustumCulled = false; arcHeadMesh.frustumCulled = false;
    arcPostMesh.count = arcHeadMesh.count = 0;
    if (lamps.some(l => l.arc)) group.add(arcPostMesh, arcHeadMesh);
    const candPostMesh = new THREE.InstancedMesh(candPostGeo, new THREE.MeshLambertMaterial({ color: '#2b2f33' }), CAND_MAX), candHeadMesh = new THREE.InstancedMesh(candHeadGeo, lampHeadMesh.material, CAND_MAX);
    candPostMesh.name = 'lampCandelabraPosts'; candHeadMesh.name = 'lampCandelabraHeads'; candPostMesh.castShadow = true; candPostMesh.frustumCulled = false; candHeadMesh.frustumCulled = false;
    candPostMesh.count = candHeadMesh.count = 0;
    if (lamps.some(l => l.candelabra)) group.add(candPostMesh, candHeadMesh);
    const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _lp = new THREE.Vector3(), _ls = new THREE.Vector3(), _ly = new THREE.Vector3(0, 1, 0);
    const fillLamps = (vx, vz, R) => {
        let n = 0, na = 0, nc = 0;
        lampGrid.each(vx - R, vz - R, vx + R, vz + R, (l) => {
            if (Math.abs(l.x - vx) > R || Math.abs(l.z - vz) > R || (l.arc ? na >= ARC_MAX : l.candelabra ? nc >= CAND_MAX : n >= LAMP_MAX)) return;
            const k = l.h / 8;
            _lm.compose(_lp.set(l.x, l.y, l.z), _lq.setFromAxisAngle(_ly, l.rot), _ls.set(k, k, k));
            if (l.arc) { arcPostMesh.setMatrixAt(na, _lm); arcHeadMesh.setMatrixAt(na, _lm); na++; }
            else if (l.candelabra) { candPostMesh.setMatrixAt(nc, _lm); candHeadMesh.setMatrixAt(nc, _lm); nc++; }
            else { lampPostMesh.setMatrixAt(n, _lm); lampHeadMesh.setMatrixAt(n, _lm); n++; }
        });
        lampPostMesh.count = lampHeadMesh.count = n; arcPostMesh.count = arcHeadMesh.count = na; candPostMesh.count = candHeadMesh.count = nc;
        candPostMesh.instanceMatrix.needsUpdate = true; candHeadMesh.instanceMatrix.needsUpdate = true;
        lampPostMesh.instanceMatrix.needsUpdate = true; lampHeadMesh.instanceMatrix.needsUpdate = true;
        arcPostMesh.instanceMatrix.needsUpdate = true; arcHeadMesh.instanceMatrix.needsUpdate = true;
    };
    void P;
    // (world parking and lights: world-parking-lights.js)
    const {
        LAMP_COL, LAMP_Y, atlas, groundMat, lampMesh, lights, marksMat, nearDoor,
        nodeLight, noise, padMat, parked, parkedLots, parkingClearance, roadMat, solidMat,
        spillMat, tmpM, useInst,
    } = await buildParkingLights({
        DY_SIDE, P, SIDE_BACK, US, addPropColl, areas, bGrid, buildingAt,
        cellOf, city, clusters, cornerPolys, data, dmask, earlyAtlas, edges,
        group, inArea, nearWater, nodeArr, obbPoly, onRibbon, pois, polyOnRibbon,
        propColl, raisedEdge, raisedTop, retract, rng, tramSweep, underpassCover, widthAsphalt,
    });
    // shared water material from render's water.js (Fresnel env reflection, ripples, flow, night light streaks — note 11);
    // the old flat vertex-colour material stays as the fallback if the module is missing
    let waterMat = null;
    return {
        LAMP_COL,
        LAMP_Y,
        __buildStreetFurniture,
        atlas,
        basarabLamps,
        channelM,
        closures,
        deckLamps,
        elevatedDataset,
        elevatedPlan,
        fillLamps,
        furnCount,
        groundMat,
        lampGrid,
        lampHeadMesh,
        lampMesh,
        lampNear,
        lampPostMesh,
        lamps,
        lampsMoved,
        lights,
        marksMat,
        nearDoor,
        nodeLight,
        noise,
        padMat,
        parked,
        parkedLots,
        parkingClearance,
        roadMat,
        solidMat,
        spillMat,
        tmpM,
        treeAdditions,
        treeBuildingClearance,
        treeCount,
        treeDeckClearance,
        treeList,
        treeNear,
        treesOSM,
        treesRows,
        useInst,
        vegetation,
        waterTreeConflicts,
        get signCount() { return signCount; }, set signCount(v) { signCount = v; },
        get waterMat() { return waterMat; }, set waterMat(v) { waterMat = v; },
    };
}
