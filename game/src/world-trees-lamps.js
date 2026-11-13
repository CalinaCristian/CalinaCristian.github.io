// ============================================================================
//  WORLD TREES AND LAMPS — tree clearances, elevated plans, OSM / added trees, vegetation, lamps
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { sourceWaterTreeConflicts } from './source-water-tree-conflicts.js';
import { reviewedTreeExclusions } from './tree-reviews.js';
import { clamp, pointInPolygon } from './util.js';
import { sourceTreeCentrePolicy, treeCentreDuplicate, treeCentreWater } from './source-tree-centres.js';
import { SPECIES, buildSpeciesTrees, defaultSpecies, speciesFromOSM, treeGeometries } from './trees.js';
import { coveredPlatformCanopies } from './covered-platform-canopies.js';
import { BASARAB_PLATFORMS } from './basarab-source.js';
import { placeTreeAdditions } from './tree-additions.js';
import { planElevatedSources } from './elevated-sources.js';
import { BoxGrid, Y, undelta } from './world-shared.js';
import { buildStreetFurniture } from './world-furniture.js';

export async function buildTreesLamps(ctx) {
    const {
        US, addPropColl, areas, bGrid, basarabStructure, buildingAt, cellOf, channelAreas,
        city, clearOf, data, distId, edges, finishPendingRanges, inArea, isWater,
        kerbSpot, lampSpots, landmarkWaterFootprints, liftOnSide, lmGrounds, maxTrees, medianFill, nearWater,
        nearestEdge, onRibbon, pierColl, polyDist, propColl, raisedTop, ribGrid, rng,
        sceneryDeckGrid, str, surfacesAt, sweptOut, tramGrades, tramPropEnvelope, tramSweep, tramSweepConflicts,
        treeBodies, treeClear, treeList, treeSourceMetadata, treeSpots, walls, yAlong,
    } = ctx;
    const treeSeen = new Set();
    const exactTreeCentres = new Set();
    const dtSea = US ? city.proj(47.6062, -122.3321) : null, dtBel = US ? city.proj(47.6150, -122.2000) : null;
    const coniferChance = (x, z, kind) => {
        if (!US) return kind === 'forest' ? 0.1 : 0; // (Bucharest: conifers only where OSM says needleleaved, or in woods — note 17)
        const dt = Math.min(Math.hypot(x - dtSea.x, z - dtSea.z) / 1300, Math.hypot(x - dtBel.x, z - dtBel.z) / 700);
        return kind === 'street' ? (dt < 1 ? 0.08 : 0.3) : dt < 1 ? 0.2 : 0.62;
    };
    // species trees (trees.js): species from OSM where mapped, else per city / street-type defaults (one species per
    // street row; conifers only where OSM says needleleaved, in parks / forests / gardens); size from the OSM height,
    // else typical per kind. `s` (legacy ≈ 1 for a 6–8 m tree) only seeds the height when nothing better is known.
    const TG = treeGeometries();
    const treeGrid = new BoxGrid(20), treeNear = (x, z, r) => { let f = false; treeGrid.each(x - r, z - r, x + r, z + r, (t) => { if (!f && Math.hypot(t.x - x, t.z - z) < r) f = true; }); return f; };
    const treeCoverage = Array.isArray(data.treeCoverage) && data.treeCoverage.length === 4 ? data.treeCoverage : null;
    const measuredCanopyAt = (x, z) => {
        if (!treeCoverage) return false;
        const ll = city.proj.inverse(x, z);
        return ll.lat >= treeCoverage[0] && ll.lat <= treeCoverage[2] && ll.lon >= treeCoverage[1] && ll.lon <= treeCoverage[3];
    };
    // elevated decks a crown must keep out of: raised carriageways / pads and elevated rail slabs (nearest within reach)
    const TREE_DECK_GAP = .6, treeDeckClearance = { narrowed: 0, lowered: 0, excluded: [] };
    const elevatedDeckNear = (x, z, reach) => {
        let best = null; const take = (poly, soffit, top) => { const d = pointInPolygon(x, z, poly) ? 0 : polyDist(x, z, poly); if (d < reach && (!best || d < best.d)) best = { d, soffit, top }; };
        ribGrid.each(x - reach, z - reach, x + reach, z + reach, rb => {
            if (rb.y < 2.5 || x < rb.x0 - reach || x > rb.x1 + reach || z < rb.z0 - reach || z > rb.z1 + reach) return;
            const low = rb.e ? Math.min(rb.e.ya, rb.e.yb) : rb.node.y; take(rb.poly, low + Y.road - Math.min(1.1, Math.max(.05, low)), rb.y + Y.road);
        });
        sceneryDeckGrid.each(x - reach, z - reach, x + reach, z + reach, d => { if ((d.kind === 'source-tram-deck' || d.kind === 'bridge-slot-infill' || d.kind === 'basarab-centre-support' || d.kind === 'basarab-platform') && d.y1 > 2.5) take(d.poly, d.y0, d.y1); });
        return best;
    };
    const treeBuildingClearance = { narrowed: 0, skipped: 0, mapped: 0 };
    // the 12 probe directions of a crown's wall test (cos / sin of k·π/6, the same numbers each time)
    const WALL_PROBE_COS = Array.from({ length: 12 }, (_, k) => Math.cos(k * Math.PI / 6)), WALL_PROBE_SIN = Array.from({ length: 12 }, (_, k) => Math.sin(k * Math.PI / 6));
    const elevatedDataset = `${city.id}-${distId}`, elevatedPlan = planElevatedSources(data, undelta, elevatedDataset); // rail viaduct / footbridge decks: no tree or inferred lamp grows through them
    const poolAreas = areas.filter(a => a.kind === 'pool');
    const poolNear = (x, z, m) => poolAreas.some(a => x > a.x0 - m && x < a.x1 + m && z > a.z0 - m && z < a.z1 + m && (inArea(a, x, z) || polyDist(x, z, a.outer) < m));
    const placeTree = (x, z, s, kind, con = null, dec = null, opt = {}) => {
        if (elevatedPlan.decks && elevatedPlan.under(x, z, 1.5)) { elevatedPlan.skipped.trees++; return false; }
        // Mapped/measured crowns arrive first as 'osm'. Where a canopy survey
        // actually covers the ground, do not fill its lawns/gaps with invented trees.
        if (kind !== 'osm' && measuredCanopyAt(x, z)) return false;
        if (treeList.length >= maxTrees) return false;
        if (kind === 'street' && treeNear(x, z, 4.5)) return false; // (a mapped OSM tree already stands there)
        { let under = false; surfacesAt(x, z, (hh,raised,surface) => { if(surface?.kind?.startsWith('basarab-')||surface?.kind==='bridge-slot-infill')return;if (hh > Y.road + 2.5) under = true; }); if (under) return false; } // New Basarab survey conflicts and slot slabs are audited after generation, preserving retained instances/RNG.
        if (kind === 'street' && onRibbon(x, z, 1.3)) return false; // (no row trees on medians / verges narrower than ≈ 2.6 m)
        const sourceCentre = sourceTreeCentrePolicy(kind, data.treeRetention);
        const k = Math.round(x / 1.6) + ',' + Math.round(z / 1.6);
        if (treeCentreDuplicate(x, z, sourceCentre, treeSeen, exactTreeCentres)) return false;
        if (onRibbon(x, z, 0.35 * s + 0.5) || buildingAt(x, z) || treeCentreWater(x, z, sourceCentre, isWater, nearWater)) return false;
        if (kind !== 'osm' && poolNear(x, z, 1.2)) return false; // (round 3 review, Otopeni Ramada w1322339467: an invented trunk on the pool edge) no invented tree in a mapped pool or on its deck
        if (lmGrounds.some(g => x > g.x0 - 1.5 && x < g.x1 + 1.5 && z > g.z0 - 1.5 && z < g.z1 + 1.5 && (pointInPolygon(x, z, g.p) || polyDist(x, z, g.p) < 1.5))) return false;
        treeSeen.add(k);
        const isCon = con ?? (kind === 'street' || kind === 'osm' ? false : rng.chance(coniferChance(x, z, kind)));
        let species = opt.species || (isCon ? 'conifer' : defaultSpecies(city.id, kind, opt.road ?? Math.round(x * 0.01 + z * 0.013), rng()));
        if (species === 'conifer' && !isCon) species = 'generic';
        const shape = TG.shapes[(SPECIES[species] || SPECIES.generic).shape];
        const H = opt.h > 0 ? opt.h : kind === 'street' ? (US ? rng.range(8, 12) : rng.range(10, 14)) * (shape.top < 9 ? 0.75 : 1) : kind === 'garden' ? rng.range(5, 9) : kind === 'forest' ? rng.range(12, 20) : rng.range(8, 15);
        let sz = clamp(H / shape.top, 0.35, 1.5);
        // a crown that would reach over a carriageway is narrowed toward it (clear stems keep foliage above the lanes;
        // review #20); conifers are slimmed, never lifted
        const measuredCrown = opt.crownRadiusM > 0;
        let sh = measuredCrown ? opt.crownRadiusM / (shape.rx * sz) : 1;
        const R = shape.rx * sz;
        if (!measuredCrown && onRibbon(x, z, R)) {
            let lo = 0.35 * s + 0.5, hi = R;
            for (let it = 0; it < 4; it++) { const m = (lo + hi) / 2; if (onRibbon(x, z, m)) hi = m; else lo = m; }
            const lowCrown = (shape.cy - shape.ry * 0.8) * sz < 4.4; // crown bottom below truck height
            sh = clamp((lo + (lowCrown ? 0.3 : 1.6)) / R, isCon ? 0.35 : 0.55, 1);
        }
        // (owner report: crowns through the elevated carriageway) a crown may not occupy an elevated deck or the tram
        // viaduct beside it: measured crowns included. Narrow it to the deck edge; a trunk too close for that keeps
        // its place as a tree that stays below the soffit; only one that fits neither way is a physical exclusion.
        {
            const deck = elevatedDeckNear(x, z, shape.rx * sz * sh + TREE_DECK_GAP);
            if (deck && shape.top * sz > deck.soffit - .2 && (shape.cy - shape.ry) * sz < deck.top + 5) {
                const fit = (deck.d - TREE_DECK_GAP) / (shape.rx * sz);
                if (fit >= .45) { if (fit < sh) { sh = fit; treeDeckClearance.narrowed++; } }
                else if (deck.soffit - .4 >= shape.top * .35) { sz = Math.min(sz, (deck.soffit - .4) / shape.top); treeDeckClearance.lowered++; }
                else { treeDeckClearance.excluded.push({ x: +x.toFixed(1), z: +z.toFixed(1), kind, soffitM: +deck.soffit.toFixed(2) }); return false; }
            }
        }
        // guards (route-blocked on Str. Buzești): the trunk collider plus 0.3 m must be off every carriageway / lane strip,
        // and a crown hanging below 4.4 m may not reach over one (else it is dropped, never left in a lane)
        const collR = 0.3 * Math.max(0.6, sz * 1.4);
        if (onRibbon(x, z, collR + 0.3)) return false;
        if (treeClear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r)) return false;
        if (kind !== 'osm' && pierColl.some(q => Math.abs(x - q.x) < q.r + 1.2 && Math.abs(z - q.z) < q.r + 1.2)) return false; // (inferred trees keep off the bridge columns)
        if (!measuredCrown && (shape.cy - shape.ry * 0.8) * sz < 4.4 && onRibbon(x, z, R * sh * 0.9)) { if (kind === 'street' || kind === 'garden') return false; sh = Math.max(0.3, sh * 0.6); }
        // (owner register #23, Unirii: "tree crown intersects building facade") a crown may not reach into a building: it is narrowed
        // to 0.3 m off the nearest wall (down to 45 %); an invented tree closer than that is not planted, a mapped one keeps its place
        {
            // (spec 10 load budget) every probe lies within Rc of the tree: the buildings that could hold one are gathered once
            // (as buildingAt finds them: not skipped, its box, its ring outside its holes); wallAt asks only whether one does
            const Rc = shape.rx * sz * sh, near = [], reach = Rc + 1e-6;
            bGrid.each(x - reach, z - reach, x + reach, z + reach, (b) => { if (!b.skip && b.x1 >= x - reach && b.x0 <= x + reach && b.z1 >= z - reach && b.z0 <= z + reach && !near.includes(b)) near.push(b); });
            const inBuilding = (px, pz) => { for (const b of near) if (px >= b.x0 && px <= b.x1 && pz >= b.z0 && pz <= b.z1 && pointInPolygon(px, pz, b.ring) && !b.holes.some(h => pointInPolygon(px, pz, h))) return true; return false; };
            const wallAt = r => { for (let k = 0; k < 12; k++) if (inBuilding(x + WALL_PROBE_COS[k] * r, z + WALL_PROBE_SIN[k] * r)) return true; return false; };
            if (wallAt(Rc)) {
                let lo = 0, hi = Rc; for (let it = 0; it < 6; it++) { const m = (lo + hi) / 2; if (wallAt(m)) hi = m; else lo = m; }
                const fit = (lo - .3) / (shape.rx * sz);
                if (fit >= .45) { sh = Math.min(sh, fit); treeBuildingClearance.narrowed++; }
                else if (kind !== 'osm') { treeBuildingClearance.skipped++; return false; }
                else { sh = Math.min(sh, .45); treeBuildingClearance.mapped++; }
            }
        }
        treeList.push({ x, z, s: sz, species, con: !!isCon, dec: dec ?? (isCon ? 0 : 1), kind, sh }); treeGrid.insert(x, z, x, z, treeList[treeList.length - 1]);
        exactTreeCentres.add(`${x},${z}`);
        addPropColl(x, z, collR, 'tree');
        if(basarabStructure.report.active&&Number.isInteger(opt.sourceIndex))treeSourceMetadata.set(treeList.at(-1),{sourceIndex:opt.sourceIndex,crownRadiusM:opt.crownRadiusM||0,collider:propColl.at(-1)});
        treeBodies.set(treeList.at(-1), propColl.at(-1));
        return true;
    };
    // OSM natural=tree / tree_row (real positions, leaf type where tagged)
    const osmTrees = data.trees || [];
    const TI = data.treeInfo || [];
    let treesOSM = 0, treesRows = 0;
    for (let i = 0; i + 2 < osmTrees.length; i += 3) {
        const x = osmTrees[i] / 10, z = osmTrees[i + 1] / 10, t = osmTrees[i + 2], hh = (t >> 1) / 10;
        // treeInfo (world-data): taxon text → species, circumference → size, leaf bits (2 needleleaved, 1 broadleaved)
        const k = i / 3, taxon = TI[k * 3] >= 0 ? str(TI[k * 3]) : '', circ = TI[k * 3 + 1] || 0, leaf = TI[k * 3 + 2] || 0;
        let species = taxon ? speciesFromOSM(taxon) : null;
        const con = species === 'conifer' || (leaf & 2) ? true : (t & 1) && !(leaf & 1) && !TI.length ? true : false; // (leaf data known: needleleaved only)
        if (con) species = 'conifer'; else if (species === 'conifer') species = null;
        const dbh = circ > 0 ? circ / Math.PI : 0; // trunk diameter, cm
        const h = hh > 0 ? hh : dbh > 0 ? clamp(4 + dbh * 0.2, 4, 26) : 0;
        if (placeTree(x, z, h > 0 ? clamp(h / 6.5, 0.6, 2.0) : rng.range(0.85, 1.25), 'osm', con, null, { h, species: species || undefined, crownRadiusM: (data.treeCrownRadii?.[k] || 0) / 10,sourceIndex:k })) treesOSM++;
    }
    for (const [x, z, s, kind, road, sp] of treeSpots) if (placeTree(x, z, s, kind, null, null, { road, species: sp || undefined })) treesRows++;
    // parks & forests
    for (const a of areas) {
        if (!['park', 'forest', 'scrub', 'cemetery', 'grass'].includes(a.kind)) continue;
        const dens = a.kind === 'forest' ? 1 / 70 : a.kind === 'park' ? 1 / 140 : a.kind === 'cemetery' ? 1 / 120 : a.kind === 'scrub' ? 1 / 200 : 1 / 600;
        const n = Math.min(3000, Math.floor(a.size * dens));
        for (let i = 0; i < n; i++) {
            const x = rng.range(a.x0, a.x1), z = rng.range(a.z0, a.z1);
            if (!inArea(a, x, z)) continue;
            placeTree(x, z, rng.range(0.9, a.kind === 'forest' ? 1.7 : 1.4), a.kind);
        }
    }
    // residential gardens (sparse)
    for (const a of areas) {
        if (a.kind !== 'residential' || treeList.length >= maxTrees) continue;
        const n = Math.min(400, Math.floor(a.size / (US ? 500 : 900)));
        for (let i = 0; i < n; i++) {
            const x = rng.range(a.x0, a.x1), z = rng.range(a.z0, a.z1);
            if (!inArea(a, x, z) || !clearOf(x, z, 2.5)) continue;
            placeTree(x, z, rng.range(0.8, 1.3), 'garden');
        }
    }
    const coveredCanopies=coveredPlatformCanopies(treeList,BASARAB_PLATFORMS.filter(p=>basarabStructure.report.sourcePlatforms.includes(p.sourceId)),treeSourceMetadata);
    basarabStructure.report.treeSourceConflicts={excludedMeasured:coveredCanopies.conflicts,retainedMapped:coveredCanopies.unresolved};
    const waterTreeConflicts = sourceWaterTreeConflicts(treeList, landmarkWaterFootprints, t => treeBodies.get(t));
    // A trunk inside the swept cover of the tram bodies cannot stand where the source puts it (the source positions of a
    // rail and of a tree are each good to about a metre). It is listed and left out after generation, as the basin
    // conflicts are: retained trees keep their rotation, colour and random stream.
    const tramTreeConflicts = new Set();
    if (tramSweep) for (const t of treeList) {
        const body = treeBodies.get(t), hit = body && tramSweep.circle(t.x, t.z, body.r, 0, body.h ?? 3); if (!hit) continue;
        const dx = t.x - hit.x, dz = t.z - hit.z;
        tramTreeConflicts.add(t); tramSweepConflicts.trees.push({ x: t.x, z: t.z, kind: t.kind, species: t.species ?? null, trunkRadiusM: body.r, acrossBodyAxisM: Math.abs(dz * hit.fx - dx * hit.fz), bodyHalfWidthM: hit.body.widthM / 2, bodyLengthM: hit.body.lengthM });
    }
    const treeAdditions = placeTreeAdditions(distId, city.proj, placeTree); // (r3-look-8: aerial-measured crowns the survey missed, tree-additions.js)
    const reviewedTreeOut = reviewedTreeExclusions(treeList, city.proj, distId); // (tree-reviews.js: street-level reviewed crowns)
    const excludedTrees = new Set([...coveredCanopies.excluded, ...waterTreeConflicts.excluded, ...tramTreeConflicts, ...reviewedTreeOut]);
    const treeCount = treeList.length - excludedTrees.size;
    // instanced trees in district 250 m / legacy 500 m chunks; crowns keep a per-instance colour (instanceColor)
    // so the season / weather code can tint each tree (world.vegetation)
    const vegetation = { treeCrownMeshes: [], treeTrunkMeshes: [], deciduousMask: null, grassMaterials: [], groundMaterials: [], roofMaterials: [], trees: treeList };
    {
        // (2026-11-08) district worlds carry the measured canopy (thousands of real trees): fewer full-detail near trees
        const T = buildSpeciesTrees(treeList, { rng, cull: 480, chunk: 250, near: 60, maxNear: 110, farLayer: 2, exclude: excludedTrees, stemLod: 180 }); // Covered-platform and water-basin source conflicts are recorded separately from LOD/culling; smaller district chunks cull off-screen trees precisely; no trees or LOD geometry are removed
        // Generate every instance first so unaffected colours, rotations and RNG stay identical.
        if (excludedTrees.size) {
            const bodies = new Set([...excludedTrees].map(t => treeBodies.get(t)));
            treesOSM -= [...excludedTrees].filter(t => t.kind === 'osm').length;
            let at = 0; for (const t of treeList) if (!excludedTrees.has(t)) treeList[at++] = t; treeList.length = at;
            at = 0; for (const p of propColl) if (!bodies.has(p)) propColl[at++] = p; propColl.length = at;
        }
        vegetation.treeCrownMeshes.push(...T.crownMeshes); vegetation.treeTrunkMeshes.push(...T.trunkMeshes);
        vegetation.update = T.update;
        vegetation.deciduousMask = new Float32Array(treeList.map(t => t.dec));
    }
    // street lamps: real OSM highway=street_lamp nodes (moved to the sidewalk edge when mapped on the carriageway)
    // + synthesized ones on lit / main roads at the outer edge of the sidewalk
    const lamps = [];
    const lampGrid = new BoxGrid(30);
    const lampNear = (x, z, r) => { let f = false; lampGrid.each(x - r, z - r, x + r, z + r, (l) => { if (!f && Math.hypot(l.x - x, l.z - z) < r) f = true; }); return f; };
    // (t: world-furniture.js)
    const __buildStreetFurniture = await buildStreetFurniture({
        US, addPropColl, basarabStructure, buildingAt, cellOf, channelAreas, city, data,
        distId, edges, elevatedPlan, finishPendingRanges, isWater, kerbSpot, lampGrid, lampNear,
        lampSpots, lamps, liftOnSide, medianFill, nearWater, nearestEdge, onRibbon, propColl,
        raisedTop, surfacesAt, sweptOut, tramGrades, tramPropEnvelope, tramSweep, walls, yAlong,
    });
    const {
        basarabLamps, channelM, closures, deckLamps, furnCount, lampsMoved,
    } = __buildStreetFurniture;
    return {
        __buildStreetFurniture, basarabLamps, channelM, closures, deckLamps, elevatedDataset, elevatedPlan, furnCount,
        lampGrid, lampNear, lamps, lampsMoved, treeAdditions, treeBuildingClearance, treeCount, treeDeckClearance,
        treeNear, treesOSM, treesRows, vegetation, waterTreeConflicts,
    };
}
