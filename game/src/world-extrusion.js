// ============================================================================
//  WORLD BUILDING EXTRUSION — walls, roofs, shopfronts and facade detail of every building record
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { emitOvalDormers } from './reviewed-dormers.js';
import { nonShopWindowBands } from './facade-window-bands.js';
import { clamp, distPointSeg, makeRng, pointInPolygon } from './util.js';
import { triangulate } from './triangulate.js';
import { canopyGeometry } from './building-canopies.js';
import { MeshBuilder, rgb, shadeRgb } from './geobuild.js';
import { aircraftBody } from './building-aircraft.js';
import { clipPassageWall } from './building-passages.js';
import { carParkLevels, carParkOf, emitCarParkWall } from './car-parks.js';
import { fasciaQuads, fuelLookFor, fuelStationRow } from './fuel-look.js';
import { emitWorshipOpenings, worshipHasTowerTag } from './worship.js';
import { TILE, TILE_GRID, VILLA_PAL, Y, brandStyle, mixRgb, polysCross, props, signedArea } from './world-shared.js';

export function buildExtrusion(ctx) {
    const {
        ARCH, addDetail, addFacadeSign, addNearDetail, addSignQuad, bGrid, bRecs, builderEpoch,
        buildingAt, carParkOutlines, cellOf, city, clipBuildingDetails, collision, convexRing, data,
        distId, edgesInBox, insetRing, isPark, lazyRoofMesh, nearestEdge, obbPoly, onRibbon,
        palette, polyDist, polyOnRibbon, prefetchedRoof, propColl, raisedTop, roofCols, roofProfileAudit,
        roofSignatureMatch, signs, str, streetFacing,
    } = ctx;
    let { wallTris } = ctx; // (updated here, handed back: see the return)
    for (const b of bRecs) {
        if (b.skip) continue;
        const c = cellOf(b.c[0], b.c[1]);
        const mb = c.solid;
        if (b.aircraft) {
            const body = aircraftBody(b.ring, b.h);
            if (!body) continue;
            const col = rgb(b.colour || '#8b9390'), dark = shadeRgb(col, .7), ring = b.ring;
            const {pts,tris} = triangulate(ring,b.holes);
            if (tris.length) c.roof.flatPoly(pts,tris,body.wingTopM,col,.1,-1);
            for (const tri of tris) mb.face3(...tri.map(i=>[pts[i][0],body.wingBaseM,pts[i][1]]),dark,[0,-1,0]);
            for(let i=0;i<ring.length;i++){const a=ring[i],p=ring[(i+1)%ring.length],L=Math.hypot(p[0]-a[0],p[1]-a[1]);if(L>.01)mb.wall(a[0],a[1],p[0],p[1],body.wingBaseM,body.wingTopM,(p[1]-a[1])/L,-(p[0]-a[0])/L,col);}
            for(const f of body.faces)mb.face3(...f,col);
            c.detail.face3(...body.tail,col);c.detail.face3(...body.tail.slice().reverse(),dark);
            const box={x:b.c[0],z:b.c[1],r:Math.max(...ring.map(p=>Math.hypot(p[0]-b.c[0],p[1]-b.c[1]))),sourceId:data.buildingIds?.[b.i],aircraft:true,estimated:true,angle:0};
            collision.push({...box,poly:ring,holes:b.holes,minH:body.wingBaseM,h:body.wingTopM,y1:body.wingTopM});
            collision.push({...box,poly:body.footprint,holes:[],minH:body.bodyBaseM,h:body.bodyTopM,y1:body.bodyTopM});
            collision.push({...box,poly:body.tailFootprint,holes:[],minH:b.h*.48,h:b.h,y1:b.h});
            for(const [x,z] of body.gear){mb.box(x,.13,z,.22,Math.max(.05,body.bodyBaseM-.13),.18,0,dark);propColl.push({x,z,r:.16,hw:.11,hd:.09,angle:0,poly:null,h:body.bodyBaseM,prop:true,kind:'aircraft-gear',sourceId:box.sourceId,estimated:true});}
            continue;
        }
        if (b.canopy) {
            // Explicitly reviewed open roof: preserve its full mapped plan and its vertical collision band.
            // Dimension/support provenance stays in data.buildingCanopies; estimates are not OSM clearance tags.
            const ring = b.ring, roofCol = rgb(b.roofColour || '#a7a8a2');
            // (r3) a fuel canopy's brand: the source POI on it, else the canopy review row's OSM brand; look per station (fuel-look.js)
            const fuelPoi = data.pois.find(r => r[6] === b.i && data.poiKinds[r[0]] === 'fuel' && (str(r[4]) || str(r[3]))), fuelText = fuelPoi ? (str(fuelPoi[4]) || str(fuelPoi[3])) : (b.canopy.brand || (fuelStationRow(city.id + '-' + distId, data.buildingIds?.[b.i])?.brand) || ''); // (r3-look-3: a reviewed canopy row names the brand of an untagged canopy)
            const fuelLk = fuelText ? fuelLookFor(fuelText, fuelStationRow(city.id + '-' + distId, data.buildingIds?.[b.i])) : null;
            const sideCol = rgb(fuelLk?.soffit || '#d6d5ce');
            const canopy = canopyGeometry(b, triangulate), sourceRoof = canopy.native;
            const canopyAudit = roofProfileAudit.canopies ||= { native: [], legacyFlat: [] };
            canopyAudit[sourceRoof ? 'native' : 'legacyFlat'].push({ sourceId: data.buildingIds?.[b.i] || b.i, shape: sourceRoof ? b.roofProfile.shape : 'flat', totalM: b.h, eavesM: canopy.eavesM, minimumM: b.minH });
            const cached = sourceRoof && data.buildingRoofSurfaces?.[b.i];
            const valid = cached?.sources?.every(s => { const source = bRecs[s.i]; return source && !source.skip && roofSignatureMatch(source)(s.signature); });
            if (cached) { if (valid) roofProfileAudit.surfacesApplied++; else roofProfileAudit.surfacesRejected.push(data.buildingIds?.[b.i] || b.i); }
            const unpack = face => data.buildingRoofGeometryPoints ? face.map(i => data.buildingRoofGeometryPoints[i]) : face;
            if (sourceRoof) for (const face of valid ? cached.faces.map(unpack) : canopy.roofFaces) c.roof.face3(...face, roofCol, [0, 1, 0]);
            else c.roof.flatPoly(canopy.triangulation.pts, canopy.triangulation.tris, b.h, roofCol, .1, -1);
            for (const face of canopy.underside) mb.face3(...face, sideCol, [0, -1, 0]);
            // (fidelity pass 2026-11-12, Pipera Petrom w241976323 / Lukoil w547396767) a mapped fuel canopy with an OSM brand has its
            // fascia in the brand's colours and the brand name on its two longest faces; no pumps / pylon are guessed
            const fuelBrand = fuelLk ? fuelLk.sign : fuelText ? brandStyle(fuelText) : null;
            const fasciaCol = fuelLk ? rgb(fuelLk.fascia) : fuelBrand ? rgb(fuelBrand[0]) : sideCol;
            for (const wall of canopy.walls) for (const q of fasciaQuads(wall, fuelLk)) mb.face4(...q.v, q.col ? rgb(q.col) : fasciaCol, wall.normal);
            if (fuelBrand && canopy.eavesM - b.minH >= 0.3) {
                const fs = signs.get((fuelLk?.text || fuelText).slice(0, 18), fuelBrand[0], fuelBrand[1], fuelBrand[2]), sh = Math.min(0.75, (canopy.eavesM - b.minH) * 0.84);
                if (fs) for (const wall of canopy.walls.map(wl => ({ wl, L: Math.hypot(wl.vertices[1][0] - wl.vertices[0][0], wl.vertices[1][2] - wl.vertices[0][2]) })).sort((p, q) => q.L - p.L).slice(0, 2)) {
                    const [p0, p1] = wall.wl.vertices, n = wall.wl.normal, sw = Math.min(wall.L * 0.8, sh * fs.aspect);
                    (b.brandBoardFaces ||= []).push({ nx: n[0], nz: n[2] }); // (the POI pass adds no second board on these faces)
                    addSignQuad(c, (p0[0] + p1[0]) / 2 + n[0] * 0.03, (p0[2] + p1[2]) / 2 + n[2] * 0.03, Math.atan2(n[0], n[2]), 1, sw, sw / fs.aspect, b.minH + (canopy.eavesM - b.minH - sw / fs.aspect) / 2, fs, 0.02);
                }
            }
            if (valid) for (const wall of cached.walls) mb.face3(...unpack(wall.vertices), sideCol, wall.normal);
            else if (sourceRoof) for (const [i, wall] of sourceRoof.walls.entries()) mb.face4(...wall, sideCol, sourceRoof.wallNormals[i]);
            // Structural supports are an explicit authoring estimate, placed only where their complete square is clear.
            const width = b.canopy.supportWidthM || 0.35, supports = [];
            if (b.canopy.estimateSupports) for (const p of ring) {
                const dx = b.c[0] - p[0], dz = b.c[1] - p[1], L = Math.hypot(dx, dz); if (L < 1.2) continue;
                const x = p[0] + dx / L, z = p[1] + dz / L;
                if (supports.some(q => Math.hypot(q[0] - x, q[1] - z) < 3)) continue;
                const fp = obbPoly({ x, z, hw: width / 2, hd: width / 2, angle: 0 });
                if (!fp.every(q => pointInPolygon(q[0], q[1], ring) && !b.holes.some(h => pointInPolygon(q[0], q[1], h))) || polyOnRibbon(fp)) continue;
                let blocked = false;
                bGrid.each(x - width, z - width, x + width, z + width, o => { if (o !== b && !o.skip && (fp.some(q => pointInPolygon(q[0], q[1], o.ring)) || o.ring.some(q => pointInPolygon(q[0], q[1], fp)) || polysCross(fp, o.ring))) blocked = true; });
                if (blocked) continue;
                mb.box(x, Y.side, z, width, Math.max(0.01, b.minH - Y.side), width, 0, rgb(fuelLk?.column || '#b8b9b4'));
                propColl.push({ x, z, r: width * Math.SQRT1_2, hw: width / 2, hd: width / 2, angle: 0, poly: fp, h: b.minH, prop: true, kind: 'canopy-support', sourceId: data.buildingIds?.[b.i], estimated: true });
                supports.push([x, z]);
            }
            b.canopySupports = supports.length;
            collision.push({ x: b.c[0], z: b.c[1], r: Math.max(...ring.map(p => Math.hypot(p[0] - b.c[0], p[1] - b.c[1]))), poly: ring, holes: b.holes, sourceId: data.buildingIds?.[b.i], minH: b.minH, h: b.h, ...(sourceRoof ? { y0: b.minH, y1: b.h, roofHeightAt: sourceRoof.heightAt } : {}), angle: 0, hw: (b.x1 - b.x0) / 2, hd: (b.z1 - b.z0) / 2, canopy: true });
            continue;
        }
        const surface = b.sourceSurface || b.assemblySurface;
        const seedI = b.overlapCut ? b.derivedFrom : b.i; // (the pieces of a cut building keep its one colour and style)
        const brng = makeRng(seedI * 7919 + 13);
        const carParkOutline = carParkOutlines.length ? carParkOutlines.find(o => o.i === (b.derivedFrom ?? b.i)) || carParkOutlines.find(o => o.skip && b.c[0] >= o.x0 && b.c[0] <= o.x1 && b.c[1] >= o.z0 && b.c[1] <= o.z1 && pointInPolygon(b.c[0], b.c[1], o.ring)) : null;
        const carPark = carParkOutline ? carParkOf(data.buildingIds?.[carParkOutline.i], data.buildingSourceTags) : null; // (fidelity pass r2) open parking decks: car-parks.js
        const AR = !carPark && !b.roofProfile && !b.assembly && !b.sourceSurface && !b.holes.length && !b.passages?.length && b.arch && ARCH ? ARCH.emit(b, c, makeRng(seedI * 7919 + 17)) : null; // archetype roofs do not yet support courtyards
        // (2026-11-08) Bucharest villas keep the interwar facade tiles but the villa quarter's warmer plasters (cream, ochre,
        // pale yellow, salmon, off-white, sage — Floreasca / Dorobanți), not the interwar blocks' greys
        const pal = (b.villa && VILLA_PAL) || palette[b.style] || palette.plain;
        // OSM / research colour first, but the research estimates are mostly the same pale beige: a pale, unsaturated
        // tagged colour only sets the tone, the hue comes from the city / style / era palette (per-building variety)
        const palPick = rgb(pal[Math.floor(brng() * pal.length)]);
        let wallCol = palPick;
        if (b.colour && (b.style !== 'glass' || b.reviewedColour)) { // (backlog r3-landmarks-1: a reviewed glass colour is kept, Agora's silver-grey wall rendered dark blue)
            const tc = rgb(b.colour), mx = Math.max(...tc), mn = Math.min(...tc), sat = mx ? (mx - mn) / mx : 0;
            // (fidelity pass, Hanul lui Manuc: OSM building:colour=white came out ochre) a literal source colour tag is not a
            // research estimate: it wins outright wherever the raw source tags are retained (data.buildingSourceTags)
            const literalColour = !!b.reviewedColour || !!data.buildingSourceTags?.[data.buildingIds?.[b.derivedFrom ?? b.i]]?.['building:colour']; // (reviewedColour: building-review.js)
            wallCol = literalColour || sat > 0.3 || mx < 120 ? tc : mixRgb(tc, palPick, 0.85); // (research estimates: tone only)
        }
        { // per-building hue / value jitter
            const j = 0.9 + brng() * 0.16, w = (brng() - 0.5) * 0.08;
            wallCol = [clamp(Math.round(wallCol[0] * j * (1 + w)), 0, 255), clamp(Math.round(wallCol[1] * j), 0, 255), clamp(Math.round(wallCol[2] * j * (1 - w)), 0, 255)];
            if (b.style !== 'glass') { const l = (wallCol[0] + wallCol[1] + wallCol[2]) / 3, k = 1.35; wallCol = wallCol.map(v => clamp(Math.round(l + (v - l) * k), 0, 255)); } // (AgX desaturates pale plasters)
        }
        if (b.cv) wallCol = shadeRgb(rgb('#f4f1ea'), 1);
        // very dark researched / tagged facades (dark glass, black cladding: linear luminance < 0.05) read as flat black
        // blocks in shade: lift them to dark-grey glass and give them the curtain-wall tile
        const lum = (0.2126 * wallCol[0] + 0.7152 * wallCol[1] + 0.0722 * wallCol[2]) / 255;
        let darkGlass = false;
        if (lum < 0.05) { wallCol = lum > 0.004 ? shadeRgb(wallCol, 0.07 / lum) : [17, 19, 22]; darkGlass = true; }
        // facade texture: base tile or its variant (atlas rows 2–3), slightly varied bay width per building
        const tile = (darkGlass ? TILE.glass : (TILE[b.style] ?? 7)) + (brng() < 0.5 ? 8 : 0);
        let floorH = b.style === 'bloc' ? 2.9 : b.style === 'glass' ? 3.6 : b.style === 'eclectic' || b.style === 'church' ? 3.7 : 3.2;
        if (b.levels > 0 && b.style !== 'church') floorH = clamp(((b.roofProfile?.eavesM ?? b.h) - Math.max(0, b.minH)) / b.levels, 2.6, 5.5); // real floor count from building:levels
        const bayW = (b.style === 'glass' ? 2.4 : b.style === 'house' ? 3.6 : 3.3) * (0.88 + brng() * 0.24);
        const ring = b.ring;
        const ccw = signedArea(ring) > 0; // counter-clockwise (x right, z up) → outward normal = (dz, -dx)
        const h = b.roofProfile?.eavesM ?? b.h, y0 = b.minH > 0 ? b.minH : Math.min(0.18, h);
        // (after round 6) whole storeys: the wall holds an integer number of window rows, so the top row is never sliced
        // by the eaves / roof line. Church facades use the same atlas and need whole rows too.
        if (h - y0 > 2) { const n = Math.max(1, Math.round((h - y0) / floorH)); floorH = (h - y0) / n; }
        const shop = (b.flags & 1) && b.minH <= 0 && h > 6 && !carPark && b.style !== 'church' && !b.reviewedNoShopfront;
        if (shop && !b.shopFaces) b.shopFaces = streetFacing(b, signedArea(b.ring) > 0); // (district worlds: shopfronts on the street faces only)
        if (shop && b.shopFaces && b.shopFaceAt) { // (building-review row `shopFaceAt`: the reviewed shop opens on the face nearest its OSM node only; r3-look-12)
            const p = city.proj(b.shopFaceAt[0], b.shopFaceAt[1]); let kBest = -1, dBest = Infinity;
            for (let k = 0; k < b.ring.length; k++) { const a = b.ring[k], q = b.ring[(k + 1) % b.ring.length], dd = distPointSeg(p.x, p.z, a[0], a[1], q[0], q[1]).d; if (dd < dBest) { dBest = dd; kBest = k; } }
            b.shopFaces = b.shopFaces.map((v, k) => !!v && k === kBest);
        }
        const yShop = y0 + (b.gfh || 4.2); // (researched ground-floor height)
        const pitched = b.roof === 'gabled' || b.roof === 'pyramid';
        const wallTop = h;
        // (2026-11-08, owner: "this building still has weird windows at the roof") the facade tile repeats one window row per
        // storey from the top of the shopfront: the storeys above a shop must also be whole, or the last row is sliced by the roof
        if (shop && b.style !== 'church' && h - yShop > 2) { const n = Math.max(1, Math.round((h - yShop) / floorH)); floorH = (h - yShop) / n; }
        let perim = 0;
        if (!AR) for (let k = 0; k < ring.length; k++) { // (archetype buildings: walls from archetypes.js)
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
            const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
            if (wallTop <= y0) continue;
            // outward normal: for signedArea<0 (counter-clockwise on screen with z down) the right-hand normal points out
            let nx = (bz - az) / L, nz = -(bx - ax) / L;
            if (!ccw) { nx = -nx; nz = -nz; }
            const [gc, gr] = TILE_GRID[tile] || [1, 1];
            if (carPark) { // spandrel / open-band decks on the unchanged source wall faces (passages stay open)
                const cp = b.carParkCols ||= (() => { const lv = carParkLevels(carPark, b.levels, wallTop - y0), con = carPark.wallColour ? rgb(carPark.wallColour) : b.colour ? wallCol : rgb('#b9b6ae'), lou = rgb(carPark.louvreColour || '#4b5058'); (roofProfileAudit.carParks ||= []).push({ sourceId: data.buildingIds?.[b.derivedFrom ?? b.i], levels: lv.levels, levelsSource: lv.source, baseM: y0, topM: wallTop, facade: carPark.facade || 'open' }); return { levels: lv.levels, base: y0, top: wallTop, concrete: con, dark: rgb('#2c2e31'), pier: shadeRgb(con, 1.06), facade: carPark.facade || 'open', louvre: lou, slat: shadeRgb(lou, 1.35) }; })();
                for (const face of clipPassageWall([ax, az], [bx, bz], surface ? surface.walls[k] : [{ t0: 0, t1: 1, y0, y1: wallTop }], b.passages || []))
                    emitCarParkWall(mb, ax + (bx - ax) * face.t0, az + (bz - az) * face.t0, ax + (bx - ax) * face.t1, az + (bz - az) * face.t1, face.y0, face.y1, cp.base, cp.top, cp.levels, nx, nz, cp);
                perim += L; continue;
            }
            // (after round 6) whole window bays per wall, restarting at every corner: windows were sliced at the corners of
            // narrow houses (the bays ran on round the perimeter); a wall too short for a bay shows plain wall
            const nbay = Math.round(L / bayW), u0 = k * 5, u1 = nbay > 0 ? u0 + nbay / gc : u0 + 0.02 / gc;
            const sourceWall=surface?.walls[k], wholeSourceWall=sourceWall?.length===1&&sourceWall[0].t0===0&&sourceWall[0].t1===1&&Math.abs(sourceWall[0].y0-y0)<1e-7&&Math.abs(sourceWall[0].y1-wallTop)<1e-7;
            if (surface && (!b.sourceSurface || !wholeSourceWall) || b.passages?.length) {
                const faces=clipPassageWall([ax,az],[bx,bz],surface?surface.walls[k]:[{t0:0,t1:1,y0,y1:wallTop}],b.passages||[]);
                for (const face of faces) {
                    const lerp = t => [ax + (bx - ax) * t, az + (bz - az) * t];
                    const a = lerp(face.t0), p = lerp(face.t1);
                    if (b.sourceSurface && !b.assembly && shop && !(b.shopFaces && !b.shopFaces[k])) {
                        const split=Math.min(face.y1,yShop);
                        if(split>face.y0)mb.wall(a[0],a[1],p[0],p[1],face.y0,split,nx,nz,distId?mixRgb(wallCol,[255,255,255],.45):rgb('#ffffff'),(perim+L*face.t0)/16,(perim+L*face.t1)/16,(face.y0-y0)/(yShop-y0),(split-y0)/(yShop-y0),TILE.shop+(b.i%2)*8);
                        const lower=Math.max(face.y0,yShop);
                        if(face.y1>lower)mb.wall(a[0],a[1],p[0],p[1],lower,face.y1,nx,nz,wallCol,u0+(u1-u0)*face.t0,u0+(u1-u0)*face.t1,(lower-yShop)/(floorH*gr),(face.y1-yShop)/(floorH*gr),tile);
                    } else if (b.sourceSurface && !b.assembly && shop) {
                        for (const band of nonShopWindowBands(face.y0,face.y1,y0,yShop,floorH,gr))
                            mb.wall(a[0],a[1],p[0],p[1],band.y0,band.y1,nx,nz,wallCol,u0+(u1-u0)*face.t0,u0+(u1-u0)*face.t1,band.v0,band.v1,tile);
                    } else mb.wall(a[0],a[1],p[0],p[1],face.y0,face.y1,nx,nz,wallCol,u0+(u1-u0)*face.t0,u0+(u1-u0)*face.t1,(face.y0-y0)/(floorH*gr),(face.y1-y0)/(floorH*gr),tile);
                }
                if(b.sourceSurface&&!b.assembly)perim += L;
                continue;
            }
            if (shop && !(b.shopFaces && !b.shopFaces[k])) { // (researched shopfronts: street faces only)
                // (district worlds: the shopfront's frame / piers take a light tint of the building's plaster, so a unit in
                //  an old house reads as windows in a rendered wall, not an aluminium curtain)
                mb.wall(ax, az, bx, bz, y0, yShop, nx, nz, mixRgb(wallCol, [255, 255, 255], 0.45), perim / 16, (perim + L) / 16, 0, 1, TILE.shop + (seedI % 2) * 8);
                mb.wall(ax, az, bx, bz, yShop, wallTop, nx, nz, wallCol, u0, u1, 0, (wallTop - yShop) / (floorH * gr), tile);
                // night light spill on the sidewalk in front of the shop window (additive decal, 0 by day)
                if (L > 2.5) {
                    const mx = (ax + bx) / 2, mz = (az + bz) / 2, D = 3.0;
                    const ne = nearestEdge(mx + nx * 3, mz + nz * 3, (e) => !e.virtual && e.type !== 'service', 30);
                    // only shopfronts on a street (its carriageway within ≈ 12 m: a sidewalk), never fronts on a square / plaza
                    const wallToRoad = ne ? Math.max(0, ne.d + 3 - (((mx + nx * 3 - ne.cx) * ne.edge.nx + (mz + nz * 3 - ne.cz) * ne.edge.nz) >= 0 ? ne.edge.wR : ne.edge.wL)) : Infinity;
                    if (ne && wallToRoad < 12 && !buildingAt(mx + nx * 1.5, mz + nz * 1.5) && !isPark(mx + nx * 2, mz + nz * 2)) {
                        const sb = c.spill || (builderEpoch.n++, c.spill = new MeshBuilder()), w0 = [255, 255, 255], yS2 = (raisedTop(mx + nx * 1.5, mz + nz * 1.5) !== null ? Y.road + Y.kerb : Y.side) + 0.02;
                        // inset 0.3 m at both ends; stop at the kerb (never on the carriageway)
                        const ux = (bx - ax) / L, uz = (bz - az) / L, p0x = ax + ux * 0.3, p0z = az + uz * 0.3, p1x = bx - ux * 0.3, p1z = bz - uz * 0.3;
                        let d = Math.min(D, wallToRoad - 0.4); const offRoad = (dd) => { for (const f of [0, 0.25, 0.5, 0.75, 1]) { const px = p0x + (p1x - p0x) * f + nx * dd, pz = p0z + (p1z - p0z) * f + nz * dd; if (onRibbon(px, pz, 0.25)) return false; } return true; }; while (d > 0.8 && !offRoad(d)) d -= 0.4;
                        if (d > 0.8) {
                            const i0 = sb.v(p0x, yS2, p0z, 0, 1, 0, 0.5, 1, w0), i1 = sb.v(p1x, yS2, p1z, 0, 1, 0, 0.5, 1, w0);
                            const i2 = sb.v(p1x + nx * d, yS2, p1z + nz * d, 0, 1, 0, 0.5, 1 - d / D, w0), i3 = sb.v(p0x + nx * d, yS2, p0z + nz * d, 0, 1, 0, 0.5, 1 - d / D, w0);
                            sb.triUp(i0, i1, i2); sb.triUp(i0, i2, i3);
                        }
                    }
                }
            } else if (shop) {
                for (const band of nonShopWindowBands(y0,wallTop,y0,yShop,floorH,gr))
                    mb.wall(ax,az,bx,bz,band.y0,band.y1,nx,nz,wallCol,u0,u1,band.v0,band.v1,tile);
            } else mb.wall(ax,az,bx,bz,y0,wallTop,nx,nz,wallCol,u0,u1,0,(wallTop-y0)/(floorH*gr),tile);
            if (!shop && L > 2 && b.style !== 'glass' && b.style !== 'house' && wallTop > 6) mb.wall(ax + nx * 0.04, az + nz * 0.04, bx + nx * 0.04, bz + nz * 0.04, y0, y0 + 0.9, nx, nz, shadeRgb(wallCol, 0.68)); // darker plinth
            wallTris += shop ? 4 : 2;
            perim += L;
        }
        if (b.style === 'church' && !AR && !carPark && !b.passages?.length) emitWorshipOpenings(mb, ring, ccw, y0, wallTop, wallCol); // (places of worship: tall arched openings, no window grid)
        if (!AR && !carPark && !b.assembly && !b.passages?.length) { const target=h>40?mb:c.detail,start={ic:target.ic,vc:target.vc}; addDetail(b,target,brng,wallCol,h,y0,shop,yShop,floorH,ccw); clipBuildingDetails(target,start,b); } // (cornices / balconies / mullions: near LOD only, except towers' silhouettes)
        for (const [holeIndex, hole] of b.holes.entries()) {
            const ccwHole = signedArea(hole) > 0;
            for (let i = 0; i < hole.length; i++) {
                const a = hole[i], p = hole[(i + 1) % hole.length], length = Math.hypot(p[0] - a[0], p[1] - a[1]);
                if (length < 0.05) continue;
                const sign = ccwHole ? -1 : 1, nx = sign * (p[1] - a[1]) / length, nz = -sign * (p[0] - a[0]) / length;
                const [columns, rows] = TILE_GRID[tile] || [1, 1];
                for(const face of clipPassageWall(a,p,surface?.holeWalls?.[holeIndex]?.[i]||[{t0:0,t1:1,y0,y1:wallTop}],b.passages||[])){
                    const lo=[a[0]+(p[0]-a[0])*face.t0,a[1]+(p[1]-a[1])*face.t0],hi=[a[0]+(p[0]-a[0])*face.t1,a[1]+(p[1]-a[1])*face.t1];
                    if (b.carParkCols) emitCarParkWall(mb, lo[0], lo[1], hi[0], hi[1], face.y0, face.y1, b.carParkCols.base, b.carParkCols.top, b.carParkCols.levels, nx, nz, b.carParkCols); else
                    mb.wall(lo[0],lo[1],hi[0],hi[1],face.y0,face.y1,nx,nz,wallCol,0,Math.max(1,Math.round(length/bayW))/columns,0,(face.y1-face.y0)/(floorH*rows),tile);
                }
            }
        }
        // (2026-11-08, owner: the Piața Floreasca service lane ran into a blank wall) where a large named building's own
        // service lane meets its wall: a dark portal (loading bay / building passage) with a concrete frame
        if ((b.flags & 64) && !b.passages?.length) edgesInBox(b.x0 - 2, b.z0 - 2, b.x1 + 2, b.z1 + 2, (e) => {
            if (e.type !== 'service' || e.virtual) return;
            for (let k = 0; k < ring.length; k++) {
                const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
                const d1x = e.b.x - e.a.x, d1z = e.b.z - e.a.z, d2x = bx - ax, d2z = bz - az, den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-6) continue;
                const t = ((ax - e.a.x) * d2z - (az - e.a.z) * d2x) / den, u = ((ax - e.a.x) * d1z - (az - e.a.z) * d1x) / den;
                if (t < 0 || t > 1 || u < 0 || u > 1) continue;
                const px = e.a.x + d1x * t, pz = e.a.z + d1z * t, ux = d2x / L, uz = d2z / L;
                let nx = uz, nz = -ux; if (!ccw) { nx = -nx; nz = -nz; }
                const hw = Math.min(L / 2 - 0.3, Math.max(e.wR, e.wL) + 0.9), hp = Math.min(4.3, h - y0 - 0.8); if (hw < 1.2 || hp < 2.4) continue;
                const p0x = px - ux * hw + nx * 0.06, p0z = pz - uz * hw + nz * 0.06, p1x = px + ux * hw + nx * 0.06, p1z = pz + uz * hw + nz * 0.06;
                mb.wall(p0x, p0z, p1x, p1z, y0, y0 + hp, nx, nz, rgb('#1d1f22'));                                            // the opening
                (b.portals ||= []).push({ px, pz, hw: hw + 0.35, top: y0 + hp + 0.45 }); // (signs over it go above the lintel)
                c.solid.box(px + nx * 0.18, y0 + hp, pz + nz * 0.18, 0.35, 0.45, hw * 2 + 0.7, Math.atan2(ux, uz), shadeRgb(wallCol, 0.75)); // lintel
                for (const sg of [-1, 1]) c.solid.box(px + ux * sg * (hw + 0.17) + nx * 0.18, y0, pz + uz * sg * (hw + 0.17) + nz * 0.18, 0.35, hp, 0.35, Math.atan2(ux, uz), shadeRgb(wallCol, 0.75));
            }
        });
        // roof (own mesh / material: world.vegetation.roofMaterials, so weather can tint it, e.g. snow)
        const rmb = c.roof;
        const flatRoofCol = b.roofColour ? rgb(b.roofColour) : rgb(roofCols.flat[Math.floor(brng() * roofCols.flat.length)]);
        const pitchCol = b.roofColour ? rgb(b.roofColour) : rgb(roofCols.pitched[Math.floor(brng() * roofCols.pitched.length)]);
        const quad4 = ring.length === 4 || (ring.length === 5 && Math.hypot(ring[0][0] - ring[4][0], ring[0][1] - ring[4][1]) < 0.3);
        if (surface) for (const underside of surface.underside) {
            const { pts, tris } = triangulate(underside);
            for (const tri of tris) mb.face3(...tri.map(i => [pts[i][0], b.minH, pts[i][1]]), shadeRgb(wallCol, 0.75), [0, -1, 0]);
        }
        // (spec 10 load budget) a valid prepared roof surface is drawn from the pack; the roof mesh is then only read by the
        // collider's roofHeightAt, so it is computed on its first use there (from the same ring, holes and profile)
        const roofLazy = b.roofProfile ? lazyRoofMesh(b, ring) : null;
        const cached = b.roofProfile ? data.buildingRoofSurfaces?.[b.i] : undefined, valid = cached?.sources?.every(s => { const source = bRecs[s.i]; return source && !source.skip && roofSignatureMatch(source)(s.signature); });
        const sourceRoof = b.roofProfile ? (valid ? { heightAt: (...a) => roofLazy().heightAt(...a) } : prefetchedRoof(b, roofLazy) ?? roofLazy()) : null;
        if (sourceRoof) {
            if (cached) { if (valid) roofProfileAudit.surfacesApplied++; else roofProfileAudit.surfacesRejected.push(data.buildingIds?.[b.i] || b.i); }
            const unpack = face => data.buildingRoofGeometryPoints ? face.map(i => data.buildingRoofGeometryPoints[i]) : face;
            const visibleFaces = valid ? cached.faces.map(unpack) : sourceRoof.faces;
            for (const face of visibleFaces) rmb.face3(...face, b.roofProfile.shape === 'flat' ? flatRoofCol : pitchCol, [0, 1, 0]);
            if (valid) for (const face of cached.walls) mb.face3(...unpack(face.vertices), wallCol, face.normal);
            else for (const [i, face] of sourceRoof.walls.entries()) {
                mb.face4(...face, wallCol, sourceRoof.wallNormals[i]);
            }
            if (b.dormers === 'oval') emitOvalDormers({ ring, eavesM: b.roofProfile.eavesM, heightAt: (x, z) => sourceRoof.heightAt(x, z), cols: { wall: wallCol, slate: pitchCol, glass: rgb('#2b3036') }, // (reviewed-dormers.js, building-review row `dormers`)
                box: (x, y, z, w, hh, d, rot, col) => mb.box(x, y, z, w, hh, d, rot, col), ellipsoid: (x, y, z, rot, sx, sy, sz, col) => rmb.geo(props().sphere, x, y, z, rot, sx, sy, sz, col) });
            if (!surface && b.minH > 0) {
                const underside = triangulate(ring, b.holes);
                for (const tri of underside.tris) mb.face3(...tri.map(i => [underside.pts[i][0], b.minH, underside.pts[i][1]]), shadeRgb(wallCol, 0.75), [0, -1, 0]);
            }
        } else if (surface && b.roof === 'flat') {
            for (const roof of surface.roof) {
                const { pts, tris } = triangulate(roof);
                if (tris.length) rmb.flatPoly(pts, tris, h, flatRoofCol, 0.1, -1);
            }
        } else if (b.holes.length) {
            // Preserve the source courtyard before applying any generic roof style:
            // neither a centroid fan nor rooftop clutter may bridge its opening.
            const { pts, tris } = triangulate(ring, b.holes);
            if (tris.length) rmb.flatPoly(pts, tris, h, b.roofColour ? rgb(b.roofColour) : flatRoofCol, 0.1, -1);
        } else if (AR && !AR.roof) { /* (archetypes.js: flat roof, parapet, plant) */ } else if ((b.roof === 'hipped' || b.roof === 'skillion') && quad4 && convexRing(ring)) {
            let [p0, p1, p2, p3] = ring;
            if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) [p0, p1, p2, p3] = [p1, p2, p3, p0];
            const P = (p, y = h) => [p[0], y, p[1]];
            const outOf = (pts) => { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length; return [cx - b.c[0], cy - h + 0.01, cz - b.c[1]]; };
            const depth = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
            if (b.roof === 'hipped') {
                const rise = clamp(depth * 0.32, 1.2, 5);
                const m12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], m30 = [(p3[0] + p0[0]) / 2, (p3[1] + p0[1]) / 2];
                const len = Math.hypot(m12[0] - m30[0], m12[1] - m30[1]) || 1, ux = (m12[0] - m30[0]) / len, uz = (m12[1] - m30[1]) / len;
                const inset = Math.min(depth / 2, len * 0.45);
                const r1 = [m12[0] - ux * inset, h + rise, m12[1] - uz * inset], r0 = [m30[0] + ux * inset, h + rise, m30[1] + uz * inset];
                rmb.face4(P(p0), P(p1), r1, r0, pitchCol, outOf([P(p0), P(p1), r1, r0]));
                rmb.face4(P(p2), P(p3), r0, r1, pitchCol, outOf([P(p2), P(p3), r0, r1]));
                rmb.face3(P(p1), P(p2), r1, shadeRgb(pitchCol, 0.92), outOf([P(p1), P(p2), r1]));
                rmb.face3(P(p3), P(p0), r0, shadeRgb(pitchCol, 0.92), outOf([P(p3), P(p0), r0]));
            } else { // skillion: one slope rising toward p2–p3
                const rise = clamp(depth * 0.18, 0.8, 3);
                rmb.face4(P(p0), P(p1), P(p2, h + rise), P(p3, h + rise), pitchCol, [0, 1, 0]);
                const nb = [p3[0] - p0[0], 0, p3[1] - p0[1]];
                mb.face4(P(p2), P(p3), P(p3, h + rise), P(p2, h + rise), wallCol, nb); // (skillion upstand: plain)
                mb.face3(P(p1), P(p2), P(p2, h + rise), wallCol, outOf([P(p1), P(p2)]));
                mb.face3(P(p3), P(p0), P(p3, h + rise), wallCol, outOf([P(p3), P(p0)]));
            }
        } else if (b.roof === 'gabled' && ring.length === 4) {
            let [p0, p1, p2, p3] = ring;
            if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) [p0, p1, p2, p3] = [p1, p2, p3, p0];
            const rise = clamp(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.35, 1.2, 4.5);
            const r1 = [(p1[0] + p2[0]) / 2, h + rise, (p1[1] + p2[1]) / 2], r0 = [(p3[0] + p0[0]) / 2, h + rise, (p3[1] + p0[1]) / 2];
            const P = (p) => [p[0], h, p[1]];
            const mid = [b.c[0], h + rise * 0.5, b.c[1]];
            const outOf = (pts) => { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length; return [cx - mid[0], cy - mid[1] + 0.01, cz - mid[2]]; };
            rmb.face4(P(p0), P(p1), r1, r0, pitchCol, outOf([P(p0), P(p1), r1, r0]));
            rmb.face4(P(p2), P(p3), r0, r1, pitchCol, outOf([P(p2), P(p3), r0, r1]));
            mb.face3(P(p1), P(p2), r1, wallCol, outOf([P(p1), P(p2), r1])); // (gable end: plain plaster — the window tile put windows in the roof triangle)
            mb.face3(P(p3), P(p0), r0, wallCol, outOf([P(p3), P(p0), r0]));
        } else if ((pitched || b.roof === 'hipped') && ring.length <= 10 && convexRing(ring)) {
            const rise = clamp(Math.sqrt(b.area) * 0.32, 1.2, 6);
            const apex = [b.c[0], h + rise, b.c[1]];
            for (let k = 0; k < ring.length; k++) {
                const a = ring[k], bb = ring[(k + 1) % ring.length];
                const pa = [a[0], h, a[1]], pb = [bb[0], h, bb[1]];
                rmb.face3(pa, pb, apex, pitchCol, [(a[0] + bb[0]) / 2 - b.c[0], 0.5, (a[1] + bb[1]) / 2 - b.c[1]]);
            }
        } else if ((pitched || b.roof === 'hipped') && insetRing(ring, b.area)) {
            // (2026-11-08, owner: "multiple roofs seem incomplete") an L / T / U footprint: the centroid fan crossed itself
            // (holes, backwards faces). A hip roof that rises from the eaves to an inset copy of the outline, flat between.
            const inner = insetRing(ring, b.area), d = inner.d, rise = d * 0.62;
            for (let q = 0; q < ring.length; q++) {
                const a0 = ring[q], a1 = ring[(q + 1) % ring.length], i0 = inner.p[q], i1 = inner.p[(q + 1) % ring.length];
                const ex = a1[0] - a0[0], ez = a1[1] - a0[1], el = Math.hypot(ex, ez) || 1, sg = signedArea(ring) > 0 ? 1 : -1;
                rmb.face4([a0[0], h, a0[1]], [a1[0], h, a1[1]], [i1[0], h + rise, i1[1]], [i0[0], h + rise, i0[1]], q % 2 ? pitchCol : shadeRgb(pitchCol, 0.94), [sg * ez / el, 1.2, -sg * ex / el]);
            }
            const { pts, tris } = triangulate(inner.p);
            if (tris.length) rmb.flatPoly(pts, tris, h + rise, shadeRgb(pitchCol, 0.9), 0.1, -1);
        } else if ((pitched || b.roof === 'hipped') && !insetRing(ring, b.area)) {
            // A very short/re-entrant source edge can prevent a valid mitred
            // inset. Subdivide the footprint triangulation and lift its interior
            // by distance to the true eaves; all shared edges stay watertight.
            const { pts, tris } = triangulate(ring);
            const P = p => [p[0], h + Math.min(6, polyDist(p[0], p[1], ring) * 0.62), p[1]];
            for (const tri of tris) {
                const points = tri.map(i => pts[i]), centre = [points.reduce((s, p) => s + p[0], 0) / 3, points.reduce((s, p) => s + p[1], 0) / 3];
                for (let j = 0; j < 3; j++) {
                    const a = points[j], z = points[(j + 1) % 3], mid = [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2];
                    rmb.face3(P(a), P(mid), P(centre), pitchCol, [0, 1, 0]);
                    rmb.face3(P(mid), P(z), P(centre), pitchCol, [0, 1, 0]);
                }
            }
        } else {
            const mansard = ((b.roof === 'mansard' && b.area < 6000) || (b.roof === 'flat' && !(b.flags & 16) && b.style === 'eclectic' && b.area > 120 && b.area < 2500 && h > 10)) && insetRing(ring, b.area);
            if (mansard) { // slate mansard roof: sloped ring up to an inset flat top
                const inner = mansard.p, rise = Math.min(2.6, mansard.d * 1.2), sg = signedArea(ring) > 0 ? 1 : -1;
                const slate = b.roofColour ? rgb(b.roofColour) : rgb(brng() < 0.5 ? '#4b4f57' : '#5a4a41');
                for (let q = 0; q < ring.length; q++) {
                    const a0 = ring[q], a1 = ring[(q + 1) % ring.length], i0 = inner[q], i1 = inner[(q + 1) % ring.length];
                    const ex = a1[0] - a0[0], ez = a1[1] - a0[1], len = Math.hypot(ex, ez) || 1;
                    rmb.face4([a0[0], h, a0[1]], [a1[0], h, a1[1]], [i1[0], h + rise, i1[1]], [i0[0], h + rise, i0[1]], slate, [sg * ez / len, 1.2, -sg * ex / len]);
                }
                const { pts, tris } = triangulate(inner);
                if (tris.length) rmb.flatPoly(pts, tris, h + rise, shadeRgb(slate, 0.85), 0.1, -1);
            } else {
            const { pts, tris } = triangulate(ring);
            if (tris.length) rmb.flatPoly(pts, tris, h, b.style === 'glass' && !b.roofColour ? rgb('#3b4a57') : flatRoofCol, 0.1, -1);
            }
            // parapet line + rooftop clutter on large flat roofs
            if (b.area > 250 && h > 9 && b.style !== 'house') {
                const s = Math.sqrt(b.area) * 0.18;
                const x = b.c[0] + (brng() - 0.5) * s, z = b.c[1] + (brng() - 0.5) * s, w = clamp(s, 2, 7), d = clamp(s * 0.8, 2, 6), angle = brng() * 3;
                if (pointInPolygon(x, z, ring) && polyDist(x, z, ring) > Math.hypot(w, d) / 2) mb.box(x, h, z, w, 2.2, d, angle, shadeRgb(flatRoofCol, 1.15));
            }
            if (b.roof === 'dome') { const r = clamp(Math.sqrt(b.area) * 0.28, 3, 14); rmb.geo(props().sphere, b.c[0], h, b.c[1], 0, r, r * 0.9, r, rgb(b.style === 'church' ? '#7a8a8f' : '#8c9aa3')); }
        }
        if (!b.roofProfile && b.style === 'church' && b.area > 120 && !b.holes.length && worshipHasTowerTag(data.buildingSourceTags?.[data.buildingIds?.[b.derivedFrom ?? b.i]])) { // (a cupola only where the source tags a tower / dome) // a generic centroid cupola cannot span a courtyard
            const r = clamp(Math.sqrt(b.area) * 0.12, 1.5, 4);
            mb.box(b.c[0], h, b.c[1], r * 2, r * 2.4, r * 2, 0, wallCol, tile);
            mb.geo(props().sphere, b.c[0], h + r * 2.4, b.c[1], 0, r * 1.05, r * 1.4, r * 1.05, rgb('#6f8f86'));
        }
        if (!b.assembly && !b.passages?.length && h >= 5 && b.style !== 'church' && !AR && !carPark && !(b.flags & 32)) { const start={ic:c.detail.ic,vc:c.detail.vc}; addNearDetail(b,c.detail,brng,wallCol,h,y0,shop,yShop,floorH,bayW,ccw,flatRoofCol); clipBuildingDetails(c.detail,start,b); } // (flags 32: the scenery ring outside the playable area — no street-level clutter)
        // collision
        collision.push({ x: b.c[0], z: b.c[1], r: Math.max(...ring.map(([x, z]) => Math.hypot(x - b.c[0], z - b.c[1]))), poly: ring, holes: b.holes, passageSolids: b.passageSolids, sourceId: data.buildingIds?.[b.derivedFrom ?? b.i], derived: b.derivedFrom !== undefined, minH: b.minH, angle: 0, hw: (b.x1 - b.x0) / 2, hd: (b.z1 - b.z0) / 2, h: sourceRoof ? b.h : h, ...(sourceRoof ? { y0: b.minH, y1: b.h, roofHeightAt: sourceRoof.heightAt } : {}), poi: b.cv || undefined });
        // facade sign
        // (2026-11-12: none on OSM building=construction — Automatica Ford, way/39348916, is a wrapped building site, its historic name is not a sign)
        // (fidelity pass: the Unirea car park was signed "Spălătorie Unirea Etaj 7") a business named for an upper floor is not the building's street sign
        if ((b.flags & 2) && b.name && (b.cvSign || b.area < 20000) && !AR?.signed && b.poiSign == null && str(data.buildingInfo?.[b.i * 5] ?? -1) !== 'construction' && !/\betaj(ul)?\s*[1-9]/i.test(b.name)) addFacadeSign(b, h, shop, wallCol);
    }
    return {
        wallTris: wallTris,
    };
}
