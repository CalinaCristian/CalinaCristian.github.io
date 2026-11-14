// ============================================================================
//  DISTRICT GRAPH — loads the district pack (worker / fetch), projection, rng, root group, nodes, roads, edges and the edge grid
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import * as THREE from '../vendor/three.module.min.js';
import { distPointSeg, makeRng } from './util.js';
import { makeAtlas, nightAtlas } from './world-materials.js';
import { districtFile, fetchDistrictPack, parseDistrictPackText } from './district-pack.js';
import { sharedBuildPool } from './build-pool.js';
import { VEHICLE_KINDS, vehicleSize } from './vehicles.js';
import { projector } from './cities.js';
import { reviewBrands } from './brand-review.js';
import { garageDeckRoads } from './garage-decks.js';
import { BoxGrid, CLASS_RANK, TRAFFIC_MUL, setProgress, setRESEARCHBRANDS, tick } from './world-shared.js';
import { contraflowBusLanes, contraflowEdge } from './contraflow-bus.js';

export async function loadDistrictGraph(ctx) {
    const {
        city, opts,
    } = ctx;
    const t0 = performance.now();
    setProgress('Loading OpenStreetMap data…');
    // buildWorld(city, renderer, { district, start }) builds one chapter district from game/data/<city>-<district>.bin.gz
    // (real 1:1 scale; the whole-city corridor maps are gone, spec 22)
    const distId = opts.district, distCfg = (city.districts || {})[distId];
    if (!distCfg) throw new Error(`unknown district ${city.id}:${distId}`);
    const inDistrictLL = (lat, lon, m = 0.0015) => (lat >= distCfg.bbox[0] - m && lat <= distCfg.bbox[2] + m && lon >= distCfg.bbox[1] - m * 1.4 && lon <= distCfg.bbox[3] + m * 1.4);
    // a lossless binary pack (game/src/district-pack.js, spec 10 size / load budget)
    const url = new URL(`../data/${districtFile(city.id, distId)}`, import.meta.url).href;
    // (spec 10 load budget) workers for the pure passes; null without module workers: then all runs here.
    // A worker fetches the pack and writes its JSON text; JSON.parse here gives the same object as fetchDistrictPack.
    const buildPool = sharedBuildPool();
    buildPool?.reset();
    let data = null;
    const packText = buildPool ? buildPool.packText(url) : null;
    // (spec 10 load budget) the facade atlas and its night data do not depend on the place: they are painted while the
    // worker decodes the pack (canvas textures only; the materials are made where they were)
    const earlyAtlas = (() => { try { const atlas = makeAtlas(); let night = null; try { night = nightAtlas(atlas); } catch (e) { /* solidMaterial reports it */ } return { atlas, night }; } catch (e) { return null; } })();
    // and the traffic's vehicle models (vehicles.js keeps one per kind and city, built the same whenever it is asked first)
    if (packText) try { for (const kind of VEHICLE_KINDS) vehicleSize(kind, city.id); } catch (e) { /* made where they were */ }
    if (packText) try { data = parseDistrictPackText(await packText); } catch (e) { console.warn('[world] pack worker failed, decoding here', e); }
    if (!data) data = await fetchDistrictPack(url);
    // field research (spec 20): street-tree notes per street, baked by tools/osm into data.streetTrees
    // ({street name: [species keys]}, [] = researched as treeless) — no runtime fetch of the research dossier
    const researchTrees = new Map(); // street name → { species: [...], none }
    for (const [name, out] of Object.entries(data.streetTrees || {})) researchTrees.set(name, { species: out, none: !out.length });
    setRESEARCHBRANDS(reviewBrands(city.id + '-' + distId, data.brands || {})); // (r3: sign colours corrected at the street, brand-review.js)
    setProgress('Building the road network…'); await tick();

    // projection (header is authoritative)
    city.proj = projector(data.proj);
    const US = city.id === 'seattle' || /US/i.test(city.country || '');
    const country = US ? 'US' : 'RO';
    const rng = makeRng(city.id === 'bucharest' ? 1337 : 4242);
    const env = city.env;
    const group = new THREE.Group();
    group.name = 'world';
    const sceneryDeckGrid = new BoxGrid(32); // surfacesAt is also called before scenery geometry is emitted
    const S = data.strings;
    const str = (i) => (i >= 0 ? S[i] : '');

    // -----------------------------------------------------------------------
    //  GRAPH
    // -----------------------------------------------------------------------
    const nodes = {};
    const nodeArr = [];
    for (let i = 0; i < data.nodes.length; i += 2) {
        const n = { id: i / 2, sourceId: data.roadNodeIds?.[i / 2], x: data.roadNodePositions?.[i] ?? data.nodes[i] * 0.1, z: data.roadNodePositions?.[i + 1] ?? data.nodes[i + 1] * 0.1, edges: [], radius: 0, hasLight: false, crossing: false, zebra: false, stop: false, flags: 0 };
        nodeArr.push(n);
    }
    for (let i = 0; i < data.nodeFlags.length; i += 2) {
        const n = nodeArr[data.nodeFlags[i]], f = data.nodeFlags[i + 1];
        n.flags = f; n.signal = !!(f & 1) || !!(f & 8); n.crossing = !!(f & 2); n.zebra = !!(f & 4) || !!(f & 8); n.stop = !!(f & 16); n.giveWay = !!(f & 32);
        n.busStop = !!(f & 64); n.tramStop = !!(f & 128); n.speedCamera = !!(f & 256); n.redLightCamera = !!(f & 1024);
    }
    const edges = [];
    const seenPair = new Set();
    const roads = data.roads.map((r, ri) => {
        const cls = data.classes[r[1]];
        const flags = r[8];
        const shared = data.sharedLanes?.[ri], width = data.roadWidths?.[ri];
        return {
            index: ri, name: str(r[0]), type: cls, lanesF: r[2], lanesB: r[3], median: shared ? 0 : width ? ((flags & 1) ? -width.widthM : width.medianM) : r[4] / 10, laneW: shared ? shared.widthM / 2 : width?.laneWidthM ?? r[5] / 10, sidewalk: r[6] / 10,
            sharedLane: !!shared, sharedLaneWidthM: shared?.widthM, sharedLaneSource: shared,
            roadWidthSource: width || null, laneCenterShiftM: width?.laneCenterShiftM || 0, access: data.roadAccess?.[ri] || null,
            maxspeed: r[7] / 3.6, flags, layer: r[9], ids: r.slice(10),
            oneway: !!(flags & 1), bridge: !!(flags & 2), tunnel: !!(flags & 4), roundabout: !!(flags & 8), busLane: !!(flags & 16),
            tram: !!(flags & 32), toll: !!(flags & 64), unpaved: !!(flags & 128), tramMedian: !!(flags & 256),
            bikeLane: !!(flags & 512), cycleTrack: !!(flags & 1024), lit: !!(flags & 2048), unlit: !!(flags & 4096),
            contraflow: (flags & 1) && !shared ? contraflowBusLanes(data.roadSourceGeometry?.[ri]?.tags, r[2]) : null, // (a bus lane against the one-way: contraflow-bus.js)
        };
    });
    const unnamed = US ? '' : '';
    const garageDecks = garageDeckRoads(data); // (h-seatac-garage: car-park deck aisles, garage-decks.js)
    for (const rd of roads) {
        if (garageDecks.has(rd.index)) continue;
        for (let i = 0; i < rd.ids.length - 1; i++) {
            const a = nodeArr[rd.ids[i]], b = nodeArr[rd.ids[i + 1]];
            if (a === b) continue;
            const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
            if (seenPair.has(key)) continue; seenPair.add(key);
            const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
            if (len < 0.05) continue;
            const dirx = dx / len, dirz = dz / len;
            const median = rd.median;
            const wR = rd.roadWidthSource?.rightM ?? median / 2 + rd.lanesF * rd.laneW;
            const wL = rd.roadWidthSource?.leftM ?? (rd.oneway ? rd.lanesF * rd.laneW / 2 : median / 2 + rd.lanesB * rd.laneW);
            const e = {
                id: edges.length, a, b, dirx, dirz, len, nx: -dirz, nz: dirx,
                name: rd.name || unnamed, type: rd.type, road: rd.index,
                lanesF: rd.lanesF, lanesB: rd.oneway ? 0 : rd.lanesB, lanes: Math.max(rd.lanesF, rd.oneway ? 0 : rd.lanesB), oneway: rd.oneway,
                laneW: rd.laneW, median, wR, wL, halfW: Math.max(wR, wL), sidewalk: rd.sidewalk,
                sharedLane: rd.sharedLane, sharedLaneWidthM: rd.sharedLaneWidthM, sharedLaneSource: rd.sharedLaneSource,
                roadWidthSource: rd.roadWidthSource, laneCenterShiftM: rd.laneCenterShiftM, access: rd.access, publicDrive: rd.access?.publicDrive !== false, throughAccess: rd.access?.throughAccess !== false,
                maxspeed: rd.maxspeed, speed: rd.maxspeed, tram: rd.tram, tramMedian: rd.tramMedian, bridge: rd.bridge, tunnel: rd.tunnel, toll: rd.toll,
                busLane: rd.busLane, roundabout: rd.roundabout, unpaved: rd.unpaved, layer: rd.layer, trafficMul: TRAFFIC_MUL[rd.type] ?? 0.5,
                bikeLane: rd.bikeLane, cycleTrack: rd.cycleTrack, lit: rd.lit, unlit: rd.unlit,
            };
            if (rd.contraflow) contraflowEdge(e, rd.contraflow);
            edges.push(e); a.edges.push(e); b.edges.push(e);
        }
    }
    // unnamed connector pieces (junction links of dual carriageways…) borrow a neighbour's name
    for (let pass = 0; pass < 3; pass++) for (const e of edges) {
        if (e.name || e.len > 80 || (CLASS_RANK[e.type] || 0) <= 2) continue;
        for (const n of [e.a, e.b]) { const o = n.edges.find(f => f !== e && f.name && (CLASS_RANK[f.type] || 0) >= (CLASS_RANK[e.type] || 0) - 1); if (o) { e.name = o.name; break; } }
    }
    // ---- (round 6) profile resolution: road heights live on nodes and are linear along an edge, so a 150 m deck edge
    //      (Doina Cornea's flyover) could only be one straight slope — its last 25 m lay 1–2 m above the street it merges
    //      into. Bridges and tunnels are cut into ≤ 10 m pieces (plain degree-2 nodes, like OSM's own) so the
    //      profile can bend where a ramp meets its street (gore pass below).
    {
        const PIECE = 10, src = edges.slice();
        // (2026-11-13) an at-grade approach that leaves a deck and has a ramp (*_link) merging inside its carriageway (Bellevue:
        // NE 8th St west of the I-405 bridge, one 92 m edge from the abutment to 112th Ave, with the Exit to NE 8th St
        // West joining along it) is cut too: as one straight slope it stayed 0.3–0.6 m above the ramp where they merge
        const shares = (e, f) => e.a === f.a || e.a === f.b || e.b === f.a || e.b === f.b;
        const nearDeck = new Map(); // node → graph distance to a deck end over at-grade edges (≤ 40 m)
        {
            const q = []; for (const f of src) if (f.bridge || f.tunnel) for (const n of [f.a, f.b]) if (!nearDeck.has(n)) { nearDeck.set(n, 0); q.push(n); }
            while (q.length) { const n = q.shift(), d = nearDeck.get(n); for (const f of n.edges) { if (f.bridge || f.tunnel) continue; const o = f.a === n ? f.b : f.a, nd = d + f.len; if (nd <= 40 && nd < (nearDeck.get(o) ?? Infinity)) { nearDeck.set(o, nd); q.push(o); } } }
        }
        const mergeApproach = (e) => {
            if (e.bridge || e.tunnel || !(nearDeck.has(e.a) || nearDeck.has(e.b))) return false;
            return src.some(f => f !== e && /_link$/.test(f.type) && !f.bridge && !f.tunnel && !nearDeck.has(f.a) && !nearDeck.has(f.b) && !shares(e, f) && (e.oneway && f.oneway ? 1 : Math.sign(e.dirx * f.dirx + e.dirz * f.dirz)) * (e.dirx * f.dirx + e.dirz * f.dirz) >= 0.85 // (a merge runs the same way: not the twin carriageway)
                && [f.a, f.b].some(p => { const q = distPointSeg(p.x, p.z, e.a.x, e.a.z, e.b.x, e.b.z); return q.t > 0.02 && q.t < 0.98 && q.d < e.halfW + f.halfW; })); // (the two carriageways overlap)
        };
        let split = 0, approaches = 0;
        for (const e of src) {
            if (e.len <= PIECE * 1.4 || !(e.bridge || e.tunnel || (mergeApproach(e) && ++approaches))) continue; // (other at-grade links stay whole: traffic queues / merges there)
            const k = Math.ceil(e.len / PIECE), b = e.b, plen = e.len / k;
            b.edges.splice(b.edges.indexOf(e), 1);
            let prev = e.a;
            for (let i = 1; i <= k; i++) {
                const n = i < k ? { id: nodeArr.length, x: e.a.x + e.dirx * plen * i, z: e.a.z + e.dirz * plen * i, edges: [], radius: 0, hasLight: false, crossing: false, zebra: false, stop: false, flags: 0, profilePt: true } : b;
                if (i < k) nodeArr.push(n);
                if (i === 1) e.seg = e.id;
                const p = i === 1 ? e : { ...e, id: edges.length };
                p.a = prev; p.b = n; p.len = plen;
                if (i === 1) { n.edges.push(e); } else { edges.push(p); prev.edges.push(p); n.edges.push(p); split++; }
                prev = n;
            }
        }
        if (split) console.info('[world] profile points: +' + split + ' edge pieces (' + approaches + ' merge approaches)');
    }
    for (const n of nodeArr) {
        if (!n.edges.length) continue;
        n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5;
        nodes[n.id] = n;
    }

    // ---- edge spatial index
    const EG = 40;
    const edgeGrid = new BoxGrid(EG);
    for (const e of edges) edgeGrid.insert(Math.min(e.a.x, e.b.x), Math.min(e.a.z, e.b.z), Math.max(e.a.x, e.b.x), Math.max(e.a.z, e.b.z), e);
    return {
        EG, US, buildPool, country, data, distCfg, distId, earlyAtlas,
        edgeGrid, edges, env, group, inDistrictLL, nodeArr, nodes, researchTrees,
        rng, roads, sceneryDeckGrid, str, t0,
    };
}
