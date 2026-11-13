// ============================================================================
//  WORLD LANDMARK GROUNDS — landmark fences / water / grounds, collision boxes, building detail clipping
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import * as THREE from '../vendor/three.module.min.js';
import { distPointSeg, landmarkHelpers, makeRng, pointInPolygon } from './util.js';
import { geometrySurface } from './building-parts.js';
import { roofMesh } from './building-roofs.js';
import { triangulate } from './triangulate.js';
import { sourceSurfaceEligible, validateSourceSurface } from './building-surface-cache.js';
import { clipBuildingDetailRange } from './building-detail-range.js';
import { rgb } from './geobuild.js';
import { scenerySourceProfile } from './scenery-source.js';
import { BoxGrid, undelta } from './world-shared.js';

export function buildLandmarkGrounds(ctx) {
    const {
        LANDMARKS, US, bGrid, bRecs, buildLandmarkFn, buildPool, bx0, bx1,
        bz0, bz1, cellOf, city, data, edges, group, isWater,
        landmarkSourceReplacements, landmarks, onRibbon, surfacesAt,
    } = ctx;
    const landmarkFences = []; // (2026-11-08) fences of landmark grounds, drawn off the streets (below)
    const landmarkWaterFootprints = [];
    const lmGrounds = []; // (2026-11-08) a landmark's own surfaces (sports grounds): no measured / generated trees on them
    const collisionBoxes = [];
    // ---- floating source parts (owner register #51 Romana "floating detached upper office volume", #55 Otopeni "large floating
    //      roof / upper building shell": the elevated train station, OSM min_height 5). A mapped part that starts above the ground
    //      (min_height > 2.5 m) with nothing under it read as hovering. Where no lower part or building reaches its underside,
    //      it stands on columns (inset 0.6 m along its outline, at most 9 m apart, never on a road, rail or water); an estimate.
    const floatingSupport = { parts: 0, columns: 0, colls: [] };
    {
        const grid = new BoxGrid(32);
        for (const o of bRecs) { if (!o.ring || o.ring.length < 3) continue; const xs = o.ring.map(p => p[0]), zs = o.ring.map(p => p[1]); grid.insert(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), o); }
        const conc = rgb('#a9a69e');
        for (const b of bRecs) {
            if (!(b.minH > 2.5) || !b.ring || b.ring.length < 3) continue;
            if (b.canopy?.estimateSupports) continue; // (r3: a reviewed open canopy draws its own estimated columns; these doubled them at every fuel station)
            const cx = b.ring.reduce((n, p) => n + p[0], 0) / b.ring.length, cz = b.ring.reduce((n, p) => n + p[1], 0) / b.ring.length;
            const inset = (p, d) => { const dx = cx - p[0], dz = cz - p[1], L = Math.hypot(dx, dz) || 1; return [p[0] + dx / L * Math.min(d, L * .5), p[1] + dz / L * Math.min(d, L * .5)]; };
            const under = (x, z) => { let hit = false; grid.each(x, z, x, z, o => { if (!hit && o !== b && o.minH < b.minH - .3 && o.h >= b.minH - .6 && pointInPolygon(x, z, o.ring)) hit = true; }); return hit; };
            const samples = [[cx, cz], ...b.ring.map(p => inset(p, 1))];
            if (samples.filter(([x, z]) => under(x, z)).length >= samples.length * .4) continue;
            // a volume more than 8 m up with nothing under it is a source part whose lower storeys are not mapped (not a 60 m stilt
            // frame): it is drawn down to the ground
            if (b.minH > 8 && samples.some(([x, z]) => onRibbon(x, z, 1) || isWater(x, z))) continue; // (a building spanning a street or water: a real passage over it)
            if (b.minH > 8) { b.minH = 0; floatingSupport.grounded = (floatingSupport.grounded || 0) + 1; continue; }
            let n = 0;
            for (let i = 0; i < b.ring.length; i++) {
                const a = b.ring[i], c = b.ring[(i + 1) % b.ring.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), k = Math.max(1, Math.ceil(L / 9));
                for (let j = 0; j < k; j++) {
                    const [x, z] = inset([a[0] + (c[0] - a[0]) * j / k, a[1] + (c[1] - a[1]) * j / k], .6);
                    if (under(x, z) || onRibbon(x, z, .6) || isWater(x, z)) continue;
                    cellOf(x, z).solid.box(x, 0, z, .6, b.minH, .6, 0, conc); floatingSupport.colls.push({ x, z, hw: .3, hd: .3, angle: 0, r: .45, poly: null, h: b.minH, prop: true, kind: 'pier' }); n++;
                }
            }
            if (n) { floatingSupport.parts++; floatingSupport.columns += n; }
        }
    }
    const lmGroup = new THREE.Group(); lmGroup.name = 'landmarks'; group.add(lmGroup);
    const sourceBuildingRecs = new Map();
    if (data.buildingGeometryPolicy === 'source') for (const b of bRecs) {
        if (b.i >= data.buildings.length) continue; // derived residuals do not invent additional source identities
        const sourceId = data.buildingIds?.[b.i];
        if (sourceId) { const list = sourceBuildingRecs.get(sourceId) || []; list.push(b); sourceBuildingRecs.set(sourceId, list); }
    }
    // (owner, 2026-11-12, Bd. Unirii: "fountains ... towards street or on street") the carriageway edges as built, drivable
    // ribbons and scenery streets alike, for a model that stands between two carriageways (ctx.kerbAlong below)
    let kerbGrid = null;
    const kerbSegments = () => {
        if (kerbGrid) return kerbGrid;
        kerbGrid = new BoxGrid(64);
        const add = (ax, az, bx, bz) => kerbGrid.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), [ax, az, bx, bz]);
        for (const e of edges) {
            if (e.virtual || e.tunnel || e.bridge || e.layer) continue;
            for (const o of [-e.wL, e.wR]) add(e.a.x + e.nx * o, e.a.z + e.nz * o, e.b.x + e.nx * o, e.b.z + e.nz * o);
        }
        for (const [ri, r] of (data.scenery || []).entries()) {
            const profile = scenerySourceProfile(data, ri, undelta(r, 4)), pts = profile.points;
            for (let i = 0; i + 1 < pts.length; i++) {
                const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
                const nx = -(bz - az) / L, nz = (bx - ax) / L;
                for (const o of [-profile.leftM, profile.rightM]) add(ax + nx * o, az + nz * o, bx + nx * o, bz + nz * o);
            }
        }
        return kerbGrid;
    };
    // (r2-builder) the scenery street nearest to a point, shaped like nearestEdge's result: businesses of the edge strip
    // (data.pois appended by tools/osm/add-pois.mjs, up to 100 m outside the playable edge) face a real street that is not
    // a graph edge, so their fascia had no "street front" to go on
    // (round 3, r2-builder-ring-stops) the scenery street piece nearest to a point, shaped like nearestEdge's result
    // ({d, cx, cz, edge: {nx, nz, dirx, dirz, wL, wR, sidewalk, type}}): a bus / tram stop outside the playable edge faces it
    /** metres outside the playable area (data.district.geometry: buffered polylines, circles, polygons); ≤ 0 inside */
    function stopMarginM(x, z) {
        const G = data.district?.geometry; if (!G) return Infinity; let m = Infinity;
        for (const pc of G.pieces || []) for (let i = 0; i + 1 < pc.pts.length; i++) m = Math.min(m, distPointSeg(x, z, pc.pts[i][0], pc.pts[i][1], pc.pts[i + 1][0], pc.pts[i + 1][1]).d - pc.r);
        for (const c of G.circles || []) m = Math.min(m, Math.hypot(x - c.x, z - c.z) - c.r);
        for (const r of G.polys || []) { if (pointInPolygon(x, z, r)) return Math.min(m, -1); for (let i = 0, j = r.length - 1; i < r.length; j = i++) m = Math.min(m, distPointSeg(x, z, r[j][0], r[j][1], r[i][0], r[i][1]).d); }
        return m;
    }
    function sceneryStopEdge(x, z, maxR) {
        let best = null;
        for (const [ri, r] of (data.scenery || []).entries()) {
            if (r[3] & 1) continue; // (bridge decks)
            const profile = scenerySourceProfile(data, ri, undelta(r, 4)), pts = profile.points;
            for (let i = 0; i + 1 < pts.length; i++) {
                const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
                const s = distPointSeg(x, z, ax, az, bx, bz); if (s.d > maxR || (best && s.d >= best.d)) continue;
                best = { d: s.d, cx: s.cx, cz: s.cz, edge: { nx: -(bz - az) / L, nz: (bx - ax) / L, dirx: (bx - ax) / L, dirz: (bz - az) / L, wL: profile.leftM, wR: profile.rightM, sidewalk: r[1] / 10, type: data.classes?.[r[2]] || 'residential', scenery: true } };
            }
        }
        return best;
    }
    let sceneryStreetGrid = null;
    const sceneryStreetNear = (x, z, maxR) => {
        if (!sceneryStreetGrid) {
            sceneryStreetGrid = new BoxGrid(64);
            for (const [ri, r] of (data.scenery || []).entries()) {
                if (r[3] & 1) continue; // (bridge decks: not a street front)
                const pts = scenerySourceProfile(data, ri, undelta(r, 4)).points;
                for (let i = 0; i + 1 < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; sceneryStreetGrid.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), [ax, az, bx, bz]); }
            }
        }
        let best = null, bd = maxR;
        sceneryStreetGrid.each(x - maxR, z - maxR, x + maxR, z + maxR, ([ax, az, bx, bz]) => { const q = distPointSeg(x, z, ax, az, bx, bz); if (q.d < bd) { bd = q.d; best = { d: q.d, cx: q.cx, cz: q.cz }; } });
        return best;
    };
    for (const lm of LANDMARKS) {
        try {
            let p = city.proj(lm.lat, lm.lon);
            // district worlds (1:1): realScale models (contract 01: lk = scale / authoredScale, R = radiusM · scale)
            const ctx = { THREE, rng: makeRng(Math.floor(Math.abs(lm.lat * 1e4 + lm.lon * 1e4))), helpers: landmarkHelpers, proj: city.proj, scale: data.proj.scale, US, realScale: true };
            { // (owner register #59 / #60, SeaTac: ramps cut into the garage helix) a model may ask whether a mapped road surface passes
              // a point of its own (local, unrotated) frame within a height band, to leave an opening there
              const c0 = Math.cos(lm.rotation || 0), s0 = Math.sin(lm.rotation || 0), sc = data.proj.scale;
              ctx.roadAt = (lx, lz, y0, y1) => { const wx = p.x + (lx * c0 + lz * s0) * sc, wz = p.z + (-lx * s0 + lz * c0) * sc; let hit = false; surfacesAt(wx, wz, h => { if (h > y0 - .4 && h < y1 + 2.2) hit = true; }, null, true); return hit; };
              // distance (m, model frame) from a point of the model along a unit direction to the nearest carriageway edge, or null
              ctx.kerbAlong = (lx, lz, dx, dz, maxM = 14) => {
                  const wx = p.x + (lx * c0 + lz * s0) * sc, wz = p.z + (-lx * s0 + lz * c0) * sc, ux = dx * c0 + dz * s0, uz = -dx * s0 + dz * c0, R = maxM * sc;
                  let best = Infinity;
                  kerbSegments().each(Math.min(wx, wx + ux * R), Math.min(wz, wz + uz * R), Math.max(wx, wx + ux * R), Math.max(wz, wz + uz * R), ([ax, az, bx, bz]) => {
                      const ex = bx - ax, ez = bz - az, den = ux * ez - uz * ex; if (Math.abs(den) < 1e-9) return;
                      const t = ((ax - wx) * ez - (az - wz) * ex) / den, s = ((ax - wx) * uz - (az - wz) * ux) / den;
                      if (t > 0 && t <= R && s >= 0 && s <= 1 && t < best) best = t;
                  });
                  return best < Infinity ? best / sc : null;
              };
            }
            if (data.buildingGeometryPolicy === 'source') {
                const c = Math.cos(lm.rotation || 0), s = Math.sin(lm.rotation || 0), scale = data.proj.scale;
                const local = ([x, z]) => { const dx = (x - p.x) / scale, dz = (z - p.z) / scale; return [dx * c - dz * s, dx * s + dz * c]; };
                ctx.sourceBuildings = Object.fromEntries((lm.sourceIds || []).map(sourceId => [sourceId, (sourceBuildingRecs.get(sourceId) || []).map(b => ({
                    sourceId, ring: b.ring.map(local), holes: b.holes.map(h => h.map(local)), h: b.h, minH: b.minH, levels: b.levels, roof: b.roof,
                    colour: b.colour, roofColour: b.roofColour, roofProfile: b.roofProfile, rawHeight: b.roofProfile?.originalOSM?.height ?? b.roofProfile?.raw?.height, heightSource: b.roofProfile?.heightSource, heightSourceCode: data.buildingInfo?.[b.i * 5 + 4],
                    provenance: 'precise district source geometry; inverse landmark yaw and projection scale; dimensions retain their recorded source/estimate code',
                }))]));
            }
            if (lm.backdrop) {
                // real position is beyond the far plane: pull it in along the same bearing from the map centre and shrink it
                const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
                const dx = p.x - cx, dz = p.z - cz, real = Math.hypot(dx, dz) || 1;
                const want = Math.min(real, 3600);
                ctx.backdropScale = want / real;
                p = { x: cx + dx / real * want, z: cz + dz / real * want };
            }
            const res = buildLandmarkFn ? buildLandmarkFn(lm, ctx) : lm.build(ctx);
            if (!res || !res.mesh) continue;
            res.mesh.position.set(p.x, res.mesh.position.y || 0.12, p.z);
            // models are authored at 1:1 → match the world's x/z scale (1 in every district pack)
            const lk = data.proj.scale / (res.authoredScale || 1);
            if (lk !== 1 && !lm.backdrop) { res.mesh.scale.x *= lk; res.mesh.scale.z *= lk; }
            if (lm.backdrop) { lmGroup.add(res.mesh); res.mesh.traverse(o => { if (o.isMesh) o.frustumCulled = false; }); continue; }
            res.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            lmGroup.add(res.mesh);
            const names = (lm.osmNames || []).map(s => s.toLowerCase());
            const R = (lm.radiusM || 0) * data.proj.scale;
            const sourcePolicy = data.buildingGeometryPolicy === 'source';
            const replacementIds = new Set(lm.sourceIds || []), replacedSources = new Set();
            if (sourcePolicy) {
                for (const b of bRecs) if (replacementIds.has(data.buildingIds?.[b.derivedFrom ?? b.i])) {
                    b.skip = true;
                    b.landmarkReplacement = lm.id; b.landmarkUnitSigns = !!lm.unitSigns; // (unitSigns: a mall model keeps its mapped tenants' fascias)
                    replacedSources.add(data.buildingIds[b.derivedFrom ?? b.i]);
                }
                landmarkSourceReplacements.push({ landmark: lm.id, declared: [...replacementIds], replaced: [...replacedSources], unmatched: [...replacementIds].filter(id => !replacedSources.has(id)) });
            }
            bGrid.each(p.x - R - 60, p.z - R - 60, p.x + R + 60, p.z + R + 60, (b) => {
                if (sourcePolicy) return; // identity, never a nearby centroid/name, determines the authored replacement
                if (b.skip) return;
                const nm = b.name.toLowerCase();
                const dB = Math.hypot(b.c[0] - p.x, b.c[1] - p.z);
                // (2026-11-08) a name match only counts near the model: the school's name reached its sports hall (a POI sign)
                // 65 m away and hid it
                const namedMatch = nm && names.some(n => nm.includes(n));
                // A scenery landmark's radius is only a coarse clearing hint.
                // Keep other named OSM buildings in the detailed ring (e.g.
                // Sala Palatului behind the Royal Palace), not covered by it.
                const namedNeighbour = (b.flags & 32) && nm && !namedMatch;
                if ((namedMatch && dB < R + 25) || (dB < R && !namedNeighbour)) b.skip = true;
                else if (nm && names.some(n => nm.includes(n)) && (lm.ownSign || lm.cvStop)) { b.flags &= ~2; b.name = ''; } // (its name only: the model carries the sign)
            });
            for (const cb of res.collision || []) {
                const baseY = res.mesh.position.y || 0.12, bands = { h: cb.h === undefined ? 20 : cb.h + baseY };
                // Explicit structural bands use the complete native body height.
                // Legacy authored colliders have no minH and retain their exact bands.
                if (cb.minH !== undefined) bands.minH = cb.minH + baseY;
                if (cb.structureKind) { bands.structureKind = cb.structureKind; bands.sourceId = cb.sourceId; }
                if (cb.y0 !== undefined) bands.y0 = cb.y0 + baseY;
                if (cb.y1 !== undefined) bands.y1 = cb.y1 + baseY;
                if (cb.poly?.length >= 3) {
                    const toWorld = ([x, z]) => [p.x + x * lk, p.z + z * lk];
                    const poly = cb.poly.map(toWorld), holes = (cb.holes || []).map(h => h.map(toWorld));
                    const xs = poly.map(v => v[0]), zs = poly.map(v => v[1]);
                    const x = (Math.min(...xs) + Math.max(...xs)) / 2, z = (Math.min(...zs) + Math.max(...zs)) / 2;
                    const hw = (Math.max(...xs) - Math.min(...xs)) / 2, hd = (Math.max(...zs) - Math.min(...zs)) / 2;
                    collisionBoxes.push({ x, z, hw, hd, angle: 0, r: Math.hypot(hw, hd), ...bands, poly, holes, landmark: lm.id });
                    continue;
                }
                collisionBoxes.push({ x: p.x + cb.x * lk, z: p.z + cb.z * lk, hw: cb.hw * lk, hd: cb.hd * lk, angle: cb.angle || 0, r: Math.hypot(cb.hw, cb.hd) * lk, ...bands, poly: null, landmark: lm.id });
            }
            const toW = ([x, z]) => [p.x + x * lk, p.z + z * lk];
            for (const a of res.waterFootprints || []) landmarkWaterFootprints.push({ ...a, ring: a.ring.map(toW) });
            for (const f of res.fences || []) landmarkFences.push({ ...f, ring: f.ring.map(toW), inside: f.inside ? f.inside.map(toW) : (f.closed ? f.ring.map(toW) : null), gates: (f.gates || []).map(g => ({ ...g, x: p.x + g.x * lk, z: p.z + g.z * lk, w: (g.w || 4) * lk })) });
            for (const g of res.grounds || []) { const q = g.map(toW); lmGrounds.push({ p: q, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) }); }
            for (const g of res.coverPolys || []) { // every OSM building centred inside (a stadium's own stands / boxes)
                const q = g.map(toW), x0 = Math.min(...q.map(v => v[0])), x1 = Math.max(...q.map(v => v[0])), z0 = Math.min(...q.map(v => v[1])), z1 = Math.max(...q.map(v => v[1]));
                if (!sourcePolicy) bGrid.each(x0, z0, x1, z1, (b) => { if (!b.skip && pointInPolygon(b.c[0], b.c[1], q)) b.skip = true; });
            }
            for (const pt of res.covers || []) { // OSM buildings the model replaces (e.g. a school's sports hall)
                const [cx, cz] = toW(pt);
                if (!sourcePolicy) bGrid.each(cx, cz, cx, cz, (b) => { if (!b.skip && cx >= b.x0 && cx <= b.x1 && cz >= b.z0 && cz <= b.z1 && pointInPolygon(cx, cz, b.ring)) b.skip = true; });
            }
            landmarks.push({ id: lm.id, label: lm.name, x: p.x, z: p.z, clear: res.clear || R, radius: R, mesh: res.mesh });
        } catch (err) { console.warn('landmark failed', lm.id, err); }
    }
    // Validate physical visibility after authored replacements, without changing
    // source assembly membership or suppressing legitimate exterior details.
    const physicalUnionAudit = [], physicalUnionRejected = [];
    const unionSources = new Map((data.buildingUnions?.sources || []).map(s => [s.i, s]));
    const unionChecks = new Map(); // (this loop only sets b.sourceSurface, which no check reads)
    for (const spec of data.buildingUnions?.surfaces || []) {
        const b = bRecs[spec.i], reason = validateSourceSurface(spec, unionSources, bRecs, { requireAuthority: data.buildingUnions.version >= 2, points: data.buildingGeometryPoints, memo: unionChecks });
        if (reason) { physicalUnionRejected.push({ source: data.buildingIds?.[b?.derivedFrom ?? spec.i] || spec.i, reason }); continue; }
        b.sourceSurface = geometrySurface(spec.surface, data.buildingGeometryPoints);
        physicalUnionAudit.push({ source: data.buildingIds?.[b.derivedFrom ?? b.i] || b.i, neighbours: spec.neighbours.length });
    }
    const inferredDetailAudit = { ranges: 0, clippedAreaM2: 0, issues: [] }, detailRoofs = new Map();
    // roofMesh is pure and its result is only read: a building's roof (the building loop) and the same building as a
    // detail-clipping neighbour share one computation while its ring, holes and profile are the same objects
    const roofMeshMemo = new Map();
    function roofMeshOf(b) {
        const m = roofMeshMemo.get(b);
        if (m && m.ring === b.ring && m.holes === b.holes && m.profile === b.roofProfile) return m.mesh;
        const mesh = roofMesh(b.ring, b.holes, b.roofProfile, triangulate);
        roofMeshMemo.set(b, { ring: b.ring, holes: b.holes, profile: b.roofProfile, mesh }); return mesh;
    }
    /** () => the roof mesh of b over `ring` with b's current holes and profile, computed on the first call */
    function lazyRoofMesh(b, ring) {
        const holes = b.holes, profile = b.roofProfile; let mesh = null;
        return () => mesh || (mesh = ring === b.ring && holes === b.holes && profile === b.roofProfile ? roofMeshOf(b) : roofMesh(ring, holes, profile, triangulate));
    }
    function completeDetailRoof(b) {
        if (detailRoofs.has(b.i)) return detailRoofs.get(b.i);
        let mesh = null;
        if (sourceSurfaceEligible(b)) {
            if (b.roofProfile) mesh = roofMeshOf(b);
            else if (b.roof === 'flat') { const { pts, tris } = triangulate(b.ring, b.holes); mesh = { faces: tris.map(t => t.map(i => [pts[i][0], b.h, pts[i][1]])) }; }
        }
        const result = mesh ? { i: b.i, sourceId: b.sourceId, minH: b.minH, mesh } : null;
        detailRoofs.set(b.i, result); return result;
    }
    // (spec 10 load budget) With the build workers, a range's clipping is computed there: its faces stay in the builder
    // for now and finishDetailClips(), right after the building loop and before anything else reads those builders,
    // splices each clipped result in, in call order, shifting the vertex indices of the triangles appended after it.
    // That yields the arrays the in-place clip (clipBuildingDetailRange) produces, and the same audit, in the same order.
    const pendingDetailClips = [];
    const unflatFaces = (flat, size) => { const faces = []; for (let k = 0; k < flat.length; k += 3 * size) { const f = []; for (let j = 0; j < 3; j++) f.push(Array.from(flat.subarray(k + j * size, k + (j + 1) * size))); faces.push(f); } return faces; };
    // (spec 10 load budget) with the build workers a neighbour's complete roof is made there, from its ring, holes, profile
    // and height as they are at its first use here (completeDetailRoof keeps a neighbour's first roof in the same way)
    const detailSpecs = new Map();
    function detailSpec(b) {
        if (detailSpecs.has(b.i)) return detailSpecs.get(b.i);
        const kind = sourceSurfaceEligible(b) ? (b.roofProfile ? 1 : b.roof === 'flat' ? 2 : 0) : 0;
        const spec = kind ? { i: b.i, sourceId: b.sourceId, minH: b.minH, kind, ring: b.ring, holes: b.holes, profile: b.roofProfile, h: b.h } : null;
        detailSpecs.set(b.i, spec); return spec;
    }
    /** the complete roof faces of a spec, as completeDetailRoof makes them (build-worker.js makes the same) */
    const specFaces = spec => { if (spec.kind === 1) return roofMesh(spec.ring, spec.holes, spec.profile, triangulate).faces; const { pts, tris } = triangulate(spec.ring, spec.holes); return tris.map(t => t.map(i => [pts[i][0], spec.h, pts[i][1]])); };
    function detailNeighbours(owner, faces, flat = null, spec = false) {
            let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
            if(flat)for(let k=0;k<flat.length;k+=12){x0=Math.min(x0,flat[k]);z0=Math.min(z0,flat[k+2]);x1=Math.max(x1,flat[k]);z1=Math.max(z1,flat[k+2]);}
            else for(const f of faces)for(const p of f){x0=Math.min(x0,p[0]);z0=Math.min(z0,p[2]);x1=Math.max(x1,p[0]);z1=Math.max(z1,p[2]);}
            const neighbours=[],seen=new Set();
            bGrid.each(x0,z0,x1,z1,b=>{
                if(seen.has(b.i))return;seen.add(b.i);
                // BoxGrid visits each occupied cell. Query each actual source
                // once, and reject disjoint bounds in the emitted Float32 frame.
                if(b===owner||b.skip||Math.min(b.x0,Math.fround(b.x0))>x1||Math.max(b.x1,Math.fround(b.x1))<x0||Math.min(b.z0,Math.fround(b.z0))>z1||Math.max(b.z1,Math.fround(b.z1))<z0)return;
                if(spec){const s=detailSpec(b);neighbours.push(s?{i:s.i,sourceId:s.sourceId,minH:s.minH,spec:s}:{i:b.i,sourceId:b.sourceId,minH:b.minH,spec:null});return;}
                const roof=completeDetailRoof(b);
                if(roof)neighbours.push(roof);else neighbours.push({i:b.i,sourceId:b.sourceId,minH:b.minH});
            });
            return neighbours;
    }
    function clipBuildingDetails(builder, start, owner) {
        if (data.buildingGeometryPolicy !== 'source' || builder.ic === start.ic) return;
        if (buildPool) {
            // the faces exactly as clipBuildingDetailRange reads them (12 attributes per point)
            const P = builder.p, N = builder.n, U = builder.u, C = builder.c, Tl = builder.t, I = builder.i, nf = (builder.ic - start.ic) / 3, flat = new Float64Array(nf * 36);
            let k = 0;
            for (let q = start.ic; q < builder.ic; q++) { const v = I[q]; flat[k++] = P[v * 3]; flat[k++] = P[v * 3 + 1]; flat[k++] = P[v * 3 + 2]; flat[k++] = N[v * 3]; flat[k++] = N[v * 3 + 1]; flat[k++] = N[v * 3 + 2]; flat[k++] = U[v * 2]; flat[k++] = U[v * 2 + 1]; flat[k++] = C[v * 3]; flat[k++] = C[v * 3 + 1]; flat[k++] = C[v * 3 + 2]; flat[k++] = Tl ? Tl[v] : -1; }
            const neighbours = detailNeighbours(owner, null, flat, true);
            const job = { builder, sv: start.vc, ev: builder.vc, si: start.ic, ei: builder.ic, owner, flat, neighbours };
            job.promise = buildPool.clip(flat, { i: owner.i, sourceId: owner.sourceId }, neighbours);
            pendingDetailClips.push(job);
            return;
        }
        const result = clipBuildingDetailRange(builder, start, owner, faces => detailNeighbours(owner, faces));
        inferredDetailAudit.ranges++; inferredDetailAudit.clippedAreaM2 += result.clippedAreaM2;
        for(const issue of result.issues)if(inferredDetailAudit.issues.length<100)inferredDetailAudit.issues.push({owner:owner.sourceId,...issue});
    }
    return {
        clipBuildingDetails, collisionBoxes, floatingSupport, inferredDetailAudit, landmarkFences, landmarkWaterFootprints, lazyRoofMesh, lmGrounds,
        lmGroup, pendingDetailClips, physicalUnionAudit, physicalUnionRejected, sceneryStopEdge, sceneryStreetNear, specFaces, stopMarginM,
        unflatFaces,
    };
}
