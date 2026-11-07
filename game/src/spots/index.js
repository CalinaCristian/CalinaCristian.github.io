// ============================================================================
//  TOURIST SPOTS (spec 15) — registry + loader + session.
//
//  SPOTS = [{ id, city, name, lat, lon, kind:'walk', blurb, scene }]
//  loadSpot(id, renderer?) → { scene, spawn, colliders, plaques[], dispose(), …extras }   (contract, 01-architecture)
//  startSpot(id, host)     → SpotSession: everything a host needs to play a spot
//                            (Renderer3D wiring, walker, crowd, plaques, photo challenge, sound, UI)
//  See game/src/spots/README.md for the scene-module API (how to add a spot).
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { CITIES } from '../cities.js';
import { Ground, Painter, buildTerrain } from './ground.js';
import { paintOSM, buildBuildings, buildTrees, buildLamps, buildFurniture, roadLampPoints, streetTrees, areaTrees, waterPlane, polyCollider } from './osm.js';
import { Crowd } from './people.js';
import { SpotUI, plaqueMesh } from './ui.js';
import { SpotSound } from './sound.js';
import { colliderIndex, LocalWalker, collide } from './walker.js';
import { countTris, disposeTree, headingFromBearing, inPoly, polyBox, DEG, rng } from './kit.js';

// ---------------------------------------------------------------------------- registry (Seattle 10 + Bellevue 4; Bucharest added by its builder)
export const SPOTS = [
    { id: 'pike-place', city: 'seattle', name: 'Pike Place Market & the Gum Wall', lat: 47.60897, lon: -122.33987, kind: 'walk', scene: 'pike-place', blurb: 'Seattle\'s 1907 public market under the red PUBLIC MARKET CENTER neon sign: flying fish, Rachel the bronze pig, the original Starbucks and the Gum Wall in Post Alley.' },
    { id: 'chihuly', city: 'seattle', name: 'Chihuly Garden and Glass', lat: 47.6204, lon: -122.3504, kind: 'walk', scene: 'seattle-center', blurb: 'Dale Chihuly\'s glass art at the foot of the Space Needle: the Glasshouse with its 100-ft red-orange-yellow suspended sculpture and a garden of glass among plants.' },
    { id: 'space-needle', city: 'seattle', name: 'Space Needle & Seattle Center', lat: 47.61995, lon: -122.34935, kind: 'walk', scene: 'seattle-center', blurb: 'The 605-ft (184 m) 1962 World\'s Fair tower with its flying-saucer top and the Seattle Center grounds at its feet.' },
    { id: 'fremont-troll', city: 'seattle', name: 'Fremont Troll', lat: 47.6506, lon: -122.34722, kind: 'walk', scene: 'fremont-troll', blurb: 'An 18-ft (5.5 m) concrete troll crouching under the north end of the Aurora Bridge, crushing a real Volkswagen Beetle in its left hand.' },
    { id: 'kerry-park', city: 'seattle', name: 'Kerry Park viewpoint', lat: 47.6295, lon: -122.3601, kind: 'walk', scene: 'kerry-park', blurb: 'A small terrace on Queen Anne Hill with Seattle\'s postcard view: the Space Needle in front of downtown, Elliott Bay, and Mount Rainier on clear days.' },
    { id: 'mopop', city: 'seattle', name: 'Museum of Pop Culture (MoPOP)', lat: 47.6216, lon: -122.3474, kind: 'walk', scene: 'seattle-center', blurb: 'Frank Gehry\'s "smashed guitar" of 21,000 stainless-steel and painted-aluminium shingles, with the Monorail gliding straight through it.' },
    { id: 'waterfront', city: 'seattle', name: 'Waterfront: Great Wheel & Pier 57', lat: 47.6069, lon: -122.3416, kind: 'walk', scene: 'waterfront', blurb: 'The rebuilt Elliott Bay waterfront: the 175-ft Great Wheel over the water at Pier 57, Miners Landing, the Aquarium and the Overlook Walk.' },
    { id: 'pioneer-square', city: 'seattle', name: 'Pioneer Square & Smith Tower', lat: 47.60166, lon: -122.3342, kind: 'walk', scene: 'pioneer-square', blurb: 'Seattle\'s 1890s birthplace: the cast-iron 1909 pergola, the totem pole, red-brick Romanesque blocks and the white terracotta Smith Tower.' },
    { id: 'ballard-locks', city: 'seattle', name: 'Ballard Locks & fish ladder', lat: 47.6664, lon: -122.397, kind: 'walk', scene: 'ballard-locks', blurb: 'Boats rise and fall 26 ft between Puget Sound and the lakes; salmon climb the fish ladder; a botanical garden on the north bank.' },
    { id: 'gas-works', city: 'seattle', name: 'Gas Works Park', lat: 47.6456, lon: -122.3356, kind: 'walk', scene: 'gas-works', blurb: 'The rusted towers of the last US coal-gasification plant on a lawn promontory in Lake Union, a kite hill and a skyline view.' },
    { id: 'bel-lincoln-square', city: 'seattle', area: 'bellevue', name: 'Lincoln Square & Bellevue Square (UiPath)', lat: 47.61755, lon: -122.20195, kind: 'walk', scene: 'bel-lincoln-square', blurb: 'Downtown Bellevue at NE 8th St × Bellevue Way: Bellevue Square, the Lincoln Square towers (UiPath\'s office since 2025) and the skybridges between them.' },
    { id: 'bel-downtown-park', city: 'seattle', area: 'bellevue', name: 'Bellevue Downtown Park', lat: 47.6133, lon: -122.2034, kind: 'walk', scene: 'bel-downtown-park', blurb: 'A circle of lawn ringed by a half-mile promenade and canal ending in a 240-ft-wide waterfall, with the skyline rising behind.' },
    { id: 'bel-botanical-garden', city: 'seattle', area: 'bellevue', name: 'Bellevue Botanical Garden', lat: 47.6088, lon: -122.1793, kind: 'walk', scene: 'bel-botanical-garden', blurb: '53 free acres of Pacific Northwest gardens: the Perennial Border, the Yao Japanese garden and a suspension bridge over a ravine.' },
    // ---- Bucharest (research: game/research/bucharest-spots.json; scenes share a module when adjacent)
    { id: 'palace-parliament', city: 'bucharest', name: 'Palace of the Parliament & Piața Constituției', lat: 44.42741, lon: 26.09205, kind: 'walk', scene: 'buc-parliament', blurb: 'The heaviest building on Earth, seen from the vast square at the head of Bulevardul Unirii: 270 m of cream stone façade, 84 m tall, built 1984–97.' },
    { id: 'peoples-salvation-cathedral', city: 'bucharest', name: 'People\'s Salvation Cathedral', lat: 44.42528, lon: 26.08135, kind: 'walk', scene: 'buc-parliament', blurb: 'The tallest Orthodox church in the world (127 m), white stone and gilded domes on the hill behind the Palace of the Parliament; consecrated 2018–2025.' },
    { id: 'old-town-lipscani', city: 'bucharest', name: 'Old Town: Lipscani & Cărturești Carusel', lat: 44.43218, lon: 26.10100, kind: 'walk', scene: 'buc-old-town', blurb: 'The pedestrian medieval core: guild-named lanes full of terraces, the white "carousel" bookshop, the 1808 Manuc\'s Inn and Vlad the Impaler\'s princely court.' },
    { id: 'stavropoleos-cec', city: 'bucharest', name: 'Stavropoleos, Caru\' cu Bere & CEC Palace', lat: 44.43212, lon: 26.09830, kind: 'walk', scene: 'buc-old-town', blurb: 'A tiny 1724 Brâncovenesc jewel of a church between a neo-Gothic beer hall, the domed CEC Palace and the National History Museum.' },
    { id: 'athenaeum-revolution', city: 'bucharest', name: 'Romanian Athenaeum & Piața Revoluției', lat: 44.44085, lon: 26.09765, kind: 'walk', scene: 'athenaeum-revolution', blurb: 'The domed 1888 concert hall in its garden, and the square where the December 1989 revolution began under the Central Committee balcony.' },
    { id: 'arcul-de-triumf', city: 'bucharest', name: 'Arcul de Triumf', lat: 44.46632, lon: 26.07850, kind: 'walk', scene: 'arcul-de-triumf', blurb: 'Bucharest\'s 27 m granite triumphal arch (1936) for the First World War and the 1918 union, in a busy roundabout on Șoseaua Kiseleff.' },
    { id: 'village-museum', city: 'bucharest', name: 'Dimitrie Gusti National Village Museum', lat: 44.47085, lon: 26.07800, kind: 'walk', scene: 'buc-herastrau', blurb: 'A whole Romanian village of real wooden houses, wells and churches moved to the shore of Lake Herăstrău in 1936, with the 1722 church from Dragomirești.' },
    { id: 'herastrau-park', city: 'bucharest', name: 'King Michael I (Herăstrău) Park', lat: 44.46985, lon: 26.08310, kind: 'walk', scene: 'buc-herastrau', blurb: 'Bucharest\'s biggest park: an alley of stone busts of writers and composers, the Sleeping Nymph, a Japanese garden and the south tip of Lake Herăstrău.' },
    { id: 'spring-palace', city: 'bucharest', name: 'Spring Palace (Ceaușescu Mansion)', lat: 44.46850, lon: 26.09235, kind: 'walk', scene: 'spring-palace', blurb: 'The Ceaușescus\' private home for 24 years on a quiet villa boulevard: a cream 1960s mansion with a mosaic pool wing — and peacocks in the garden.' },
    { id: 'cismigiu', city: 'bucharest', name: 'Cișmigiu Gardens', lat: 44.43700, lon: 26.09120, kind: 'walk', scene: 'cismigiu', blurb: 'Bucharest\'s oldest public garden (1847–54): rowing boats on a winding lake, weeping willows, chess players and the Writers\' Rotunda.' },
    { id: 'bel-meydenbauer', city: 'seattle', area: 'bellevue', name: 'Meydenbauer Bay Park', lat: 47.6106, lon: -122.2108, kind: 'walk', scene: 'bel-meydenbauer', blurb: 'Bellevue\'s lakefront: a sandy beach and a floating 420-ft crescent pier on Lake Washington with Seattle on the horizon.' },
];
/** spots still being built: loadable by id (dev page) but not listed in SPOTS / the game menu until verified */
export const DEV_SPOTS = [
];
export const spotById = (id) => SPOTS.find((s) => s.id === id) || DEV_SPOTS.find((s) => s.id === id) || null;

const DATA_URL = (scene) => new URL(`../../data/spots/${scene}.json`, import.meta.url).href;
const STORE = 'dmcv.spots.v1';
export function spotProgress() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
function saveProgress(p) { try { localStorage.setItem(STORE, JSON.stringify(p)); } catch { /* private mode */ } }

// ============================================================================
//  Scene context handed to scene modules (scenes/<scene>.js → export default { build(ctx), env? })
// ============================================================================
class SceneContext {
    constructor(data, spotId) {
        this.data = data; this.spotId = spotId; this.id = data.id;
        this.scene = new THREE.Scene(); this.scene.name = 'spot:' + data.id;
        this.ground = new Ground(data.terrain);
        this.painter = new Painter();
        this.colliders = []; this.plaques = []; this.interactables = []; this.challenges = []; this.updaters = []; this.nightHooks = [];
        this.lampPoints = []; this.lampOpts = {}; this.trees = []; this.crownMeshes = []; this.grassMaterials = []; this.roofMaterials = [];
        this.sounds = []; this.spawns = {}; this.crowdCfg = null; this.exclude = []; this.skipBuildings = new Set(); this.skipWays = new Set(); this.skipAreas = new Set();
        this.terrainOpts = {}; this.env = {}; this.walkPoly = null; this.waterLevel = null; this.extras = {};
        const pr = data.projection, o = data.origin;
        this.ll = (lat, lon) => ({ x: (lon - o.lon) * pr.mLon, z: -(lat - o.lat) * pr.mLat });
        this.rng = rng(data.id.length * 131 + 17);
    }
    /** research spec of a member spot */
    spot(id = this.spotId) { return this.data.spots[id] || Object.values(this.data.spots)[0]; }
    add(...objs) { for (const o of objs) this.scene.add(o); return objs[0]; }
    collider(c) { this.colliders.push(c); return c; }
    box(x, z, hw, hd, angle = 0, extra = {}) { return this.collider({ x, z, hw, hd, angle, r: Math.hypot(hw, hd), ...extra }); }
    circle(x, z, r, h = 3, extra = {}) { return this.collider({ x, z, r, hw: r, prop: true, h, ...extra }); }
    poly(poly, extra = {}) { return this.collider({ ...polyCollider(poly), ...extra }); }
    onUpdate(fn) { this.updaters.push(fn); }
    onNight(fn) { this.nightHooks.push(fn); }
    /** a plaque (research entry) at (x, z) facing yaw (reader stands on the +z side of the board) */
    plaque(pl, x, z, yaw, { credit = null, style = 'bronze', y = null } = {}) {
        const p = { ...pl, credit: credit || pl.credit || null, x, z };
        const m = plaqueMesh(p, { style }); m.position.set(x, y ?? this.ground.heightAt(x, z), z); m.rotation.y = yaw; this.scene.add(m);
        p.mesh = m; p.place = this.data.name; this.plaques.push(p);
        this.circle(x, z, 0.08, 1.2);
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        this.interactables.push({ kind: 'plaque', plaque: p, x: x + fx * 0.8, z: z + fz * 0.8, r: 1.8, label: `Read: ${pl.title}`, use: (s) => s.readPlaque(p) });
        return p;
    }
    /** postcard photo challenge at the research iconic viewpoint */
    challenge(spotId, o = {}) {
        const sp = this.spot(spotId), ic = sp.photo?.iconic; if (!ic) return null;
        const c = { view: o.view || null, id: spotId, x: o.x ?? ic.x, z: o.z ?? ic.z, bearing: o.heading ?? ic.heading_deg, pitch: o.pitch ?? ic.pitch_deg ?? 0, fov: ic.fov_deg, text: o.text || ic.frame, r: o.r ?? 8, tol: o.tol ?? 32, targets: o.targets || [], cond: o.cond || null, condHint: o.condHint || null };
        this.challenges.push(c);
        return c;
    }
    /** standard OSM backdrop: paint ground, buildings, trees, lamps, furniture (excluding hero areas) */
    osmBackdrop(o = {}) {
        const d = this.data, ex = [...this.exclude, ...(o.exclude || [])];
        paintOSM(this.painter, d, { skipWays: this.skipWays, skipAreas: this.skipAreas, skipBuildings: this.skipBuildings, ...o.paint });
        const B = buildBuildings(d, this.ground, { skip: this.skipBuildings, exclude: ex, urban: o.urban ?? true, style: o.style, filter: o.filter, shopStyle: o.shopStyle });
        this.add(B.group); this.colliders.push(...B.colliders); this.extras.buildings = B;
        if (o.trees !== false) {
            this.trees.push(...d.trees.filter(([x, z]) => !ex.some((p) => inPoly(x, z, p))).map(([x, z, lt]) => ({ x, z, kind: lt === 'needleleaved' ? 'con' : 'broad' })));
            if (o.streetTrees !== false) this.trees.push(...streetTrees(d, { exclude: ex, skip: this.skipWays, ...(o.streetTreeOpts || {}) }));
            if (o.areaTrees !== false) this.trees.push(...areaTrees(d, { exclude: ex, ...(o.areaTreeOpts || {}) }));
        }
        if (o.lamps !== false) {
            const fromOsm = (d.furniture.street_lamp || []).map(([x, z]) => ({ x, z, rot: 0 }));
            this.lampPoints.push(...(fromOsm.length > 6 ? fromOsm : []), ...roadLampPoints(d, { skip: this.skipWays, inside: (x, z) => !ex.some((p) => inPoly(x, z, p)), ...(o.lampOpts || {}) }));
        }
        if (o.furniture !== false) { const F = buildFurniture(d, this.ground, { exclude: ex }); this.add(F.group); this.colliders.push(...F.colliders); }
    }
    /** water plane at level y over a box (terrain inside `polys` is pushed below it) */
    water(y, box, polys = [], o = {}) {
        this.waterLevel = y; if (o.walkable !== true) this.ground.waterY = Math.max(this.ground.waterY ?? -1e9, y);
        if (polys.length) { const bbs = polys.map(polyBox); this.ground.mod((x, z, h) => { for (let i = 0; i < polys.length; i++) { const b = bbs[i]; if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && inPoly(x, z, polys[i])) return Math.min(h, y - (o.depth ?? 2.5)); } return h; }); }
        const w = waterPlane(y, box, o); this.add(w); this.extras.water = w; return w;
    }
    sound(kind, x, z, radius = 80, gain = 1) { this.sounds.push({ kind, x, z, radius, gain }); }
    /** all research plaques of a spot on an arc around (x, z) facing the centre (radius r, from angle a0 by step) */
    plaquesAround(spotId, x, z, r, a0 = Math.PI / 2, step = 0.35, o = {}) {
        const pls = this.spot(spotId).plaques || [];
        pls.forEach((pl, i) => { const a = a0 + (i - (pls.length - 1) / 2) * step, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; this.plaque(pl, px, pz, Math.atan2(x - px, z - pz) + Math.PI, { ...o, credit: o.credits?.[i] ?? o.credit ?? null }); });
    }
    /** walkable lines from OSM footways / pedestrian ways / sidewalks inside a polygon (or everywhere) */
    footLines(poly = null, { min = 6 } = {}) {
        const out = [];
        for (const w of this.data.ways) {
            if (!['footway', 'pedestrian', 'path', 'steps', 'cycleway', 'living_street'].includes(w.k) || w.layer || w.indoor === 'yes' || w.tunnel || (w.level && !/^0/.test(String(w.level)))) continue;
            if (w.pts.length < 2) continue;
            const pts = poly ? w.pts.filter(([x, z]) => inPoly(x, z, poly)) : w.pts;
            if (pts.length < 2) continue;
            let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
            if (L >= min) out.push(pts);
        }
        return out;
    }
    /** the walk polygon of a spot, grown by `pad` metres (bbox-ish) */
    walkArea(spotId = this.spotId, pad = 60) { const p = this.spot(spotId).extent?.polygon || []; const b = polyBox(p.length ? p : [[-150, -150], [150, 150]]); return [[b.x0 - pad, b.z0 - pad], [b.x1 + pad, b.z0 - pad], [b.x1 + pad, b.z1 + pad], [b.x0 - pad, b.z1 + pad]]; }
}

// ============================================================================
//  loadSpot (contract) — builds the scene; no renderer wiring (startSpot does that)
// ============================================================================
/**
 * @param {string} id spot id from SPOTS
 * @param {object} [renderer] Renderer3D or THREE.WebGLRenderer (optional; used to pre-compile materials)
 * @param {{data?: object, onProgress?: (t:string)=>void}} [opts]
 */
export async function loadSpot(id, renderer = null, opts = {}) {
    const t0 = performance.now();
    const entry = spotById(id); if (!entry) throw new Error('unknown spot ' + id);
    const sceneId = entry.scene || id;
    opts.onProgress?.('Loading ' + entry.name + '…');
    const [data, mod] = await Promise.all([
        opts.data ? Promise.resolve(opts.data) : fetch(DATA_URL(sceneId)).then((r) => { if (!r.ok) throw new Error(`spot data ${sceneId}: HTTP ${r.status}`); return r.json(); }),
        import(`./scenes/${sceneId}.js`),
    ]);
    const tFetch = performance.now();
    const ctx = new SceneContext(data, id);
    const def = mod.default || mod;
    await def.build(ctx);
    const tBuild = performance.now();
    // ---- standard finish: terrain, trees, lamps, crowd, spawn
    const T = ctx.terrainOpts, W = Object.values(data.spots).flatMap((s) => s.extent?.polygon || []);
    const wb = W.length ? polyBox(W) : { x0: -150, z0: -150, x1: 150, z1: 150 };
    const m8 = (v) => Math.round(v / 8) * 8;
    const inner = T.inner || { x0: m8(wb.x0 - 60), z0: m8(wb.z0 - 60), x1: m8(wb.x1 + 60), z1: m8(wb.z1 + 60) };
    const outerPad = T.outerPad ?? 420;
    const outer = T.outer || { x0: inner.x0 - m8(outerPad), z0: inner.z0 - m8(outerPad), x1: inner.x1 + m8(outerPad), z1: inner.z1 + m8(outerPad) };
    const terr = buildTerrain(ctx.ground, ctx.painter, { inner, outer, innerPx: T.innerPx || 2048, outerPx: T.outerPx || 1024, innerStep: T.innerStep || 2, outerStep: T.outerStep || 8, bg: T.bg || '#617242', bgMask: T.bgMask || 'grass', brickAngle: T.brickAngle || 0, skirt: T.skirt ?? 6000, skirtY: T.skirtY ?? null, skirtColor: T.skirtColor ?? null });
    ctx.add(terr.group); ctx.extras.terrain = terr;
    // optional tree budget + dynamic LOD (ctx.treeLod = { cap, near, max }): beyond `cap` the trees farthest from every
    // member extent are dropped; the `max` trees within `near` m of the viewer get the full crown, the rest a low one
    ctx.finishTrees?.();
    // postcards with a `view` target [x, z]: no tree in the sight cone from the pose to the hero (the frame stays open)
    for (const c of ctx.challenges) { if (!c.view) continue; const [vx, vz] = c.view, dx = vx - c.x, dz = vz - c.z, L = Math.hypot(dx, dz) || 1;
        ctx.trees = ctx.trees.filter((t) => { const u = ((t.x - c.x) * dx + (t.z - c.z) * dz) / L; if (u < -4 || u > L) return true; const v = Math.abs((t.x - c.x) * dz - (t.z - c.z) * dx) / L; return v > 5 + Math.max(0, u) * 0.42; }); }
    if (ctx.treeLod) {
        const boxes = Object.values(data.spots).map((s) => polyBox(s.extent?.polygon?.length ? s.extent.polygon : [[-150, -150], [150, 150]]));
        const dist = (t) => Math.min(...boxes.map((b) => Math.hypot(Math.max(0, b.x0 - t.x, t.x - b.x1), Math.max(0, b.z0 - t.z, t.z - b.z1))));
        const cap = ctx.treeLod.cap ?? 4500; if (ctx.trees.length > cap) { for (const t of ctx.trees) t._d = dist(t); ctx.trees.sort((a, b) => a._d - b._d); ctx.trees.length = cap; }
    }
    const trees = buildTrees(ctx.trees, ctx.ground, { seed: data.id.length, lod: ctx.treeLod ? { near: ctx.treeLod.near ?? 90, max: ctx.treeLod.max ?? 700 } : null });
    if (trees.update) {
        const v = new THREE.Vector3();
        ctx.updaters.push((dt, s) => { s.camera.getWorldPosition(v); trees.update(v.x, v.z); });
        const sp0 = Object.values(ctx.spawns)[0] || data.spots[data.members[0]].spawn; trees.update(sp0.x, sp0.z);
    }
    ctx.add(trees.group); ctx.colliders.push(...trees.colliders); ctx.crownMeshes.push(...trees.crowns);
    const lamps = buildLamps(ctx.lampPoints, ctx.ground, ctx.lampOpts);
    ctx.add(lamps.group); ctx.colliders.push(...lamps.colliders);
    // props need their base height (walkers jump onto low props)
    for (const c of ctx.colliders) if (c.prop && c.y === undefined) c.y = ctx.ground.heightAt(c.x, c.z);
    const colliders = colliderIndex(ctx.colliders);
    for (const c of ctx.challenges) { const dry = ctx.ground.nearestDry(c.x, c.z); c.x = dry.x; c.z = dry.z; } // never a pose in the water
    // spawns (research spawn unless the scene placed one)
    const spawns = {};
    for (const sid of data.members) {
        const sp = ctx.spawns[sid] || (() => { const s = data.spots[sid].spawn; return { x: s.x, z: s.z, heading: headingFromBearing(s.heading_deg) }; })();
        const dry = ctx.ground.nearestDry(sp.x, sp.z); sp.x = dry.x; sp.z = dry.z;
        if (collide(colliders, sp.x, sp.z, 0.4, ctx.ground.heightAt(sp.x, sp.z) + 0.2)) { // spawn inside a building / prop: nearest free spot
            search: for (let r = 1; r <= 30; r += 1) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, x = sp.x + Math.cos(a) * r, z = sp.z + Math.sin(a) * r; if (!collide(colliders, x, z, 0.4, ctx.ground.heightAt(x, z) + 0.2) && ctx.ground.nearestDry(x, z).x === x) { sp.x = x; sp.z = z; break search; } }
        }
        let sy = ctx.ground.groundAt(sp.x, sp.z, 1e3); if (!(sy < 900)) sy = ctx.ground.heightAt(sp.x, sp.z);
        spawns[sid] = { ...sp, y: sy };
    }
    const spawn = spawns[id] || spawns[data.members[0]];
    // crowd
    let crowd = null;
    if (ctx.crowdCfg && data.city === 'bucharest') { // a few people chatting in view of every arrival point (bubbles from the first seconds)
        ctx.crowdCfg.groups = ctx.crowdCfg.groups || [];
        for (const sp of Object.values(spawns)) {
            const fx = -Math.sin(sp.heading), fz = -Math.cos(sp.heading);
            search: for (const f of [8, 11, 6, 14]) for (const sd of [6, -6, 4.5, -4.5]) { const x = sp.x + fx * f - fz * sd, z = sp.z + fz * f + fx * sd; if (collide(colliders, x, z, 0.6, ctx.ground.heightAt(x, z) + 0.2) || ctx.ground.nearestDry(x, z).x !== x) continue; ctx.crowdCfg.groups.push({ x, z, r: 1.2, n: 3, act: 'talk' }); break search; }
        }
    }
    if (ctx.crowdCfg) {
        const sp = ctx.spot();
        crowd = new Crowd({ ground: ctx.ground, dialogue: mergeDialogue(data, ctx.crowdCfg.spots || data.members), general: data.dialogueGeneral, seed: data.id.length * 7, ...ctx.crowdCfg });
        ctx.add(crowd.group);
        void sp;
    }
    const vegetation = { treeCrownMeshes: ctx.crownMeshes, grassMaterials: ctx.grassMaterials, groundMaterials: terr.materials, roofMaterials: ctx.roofMaterials };
    ctx.scene.userData.vegetation = vegetation;
    const tris = countTris(ctx.scene);
    const city = CITIES[entry.city] || CITIES.seattle;
    const env = { ...city.env, fogFar: 2400, ...(def.env || {}), ...ctx.env };
    const res = {
        id, sceneId, name: entry.name, city: entry.city, entry, data, scene: ctx.scene, spawn, spawns, colliders, plaques: ctx.plaques,
        ground: ctx.ground, groundAt: (x, z, y) => ctx.ground.groundAt(x, z, y), env, units: city.units || 'mph',
        clock: { lat: entry.lat, lon: entry.lon, timeZone: data.timeZone || city.timeZone || 'America/Los_Angeles' },
        lamps: lamps.lamps, lampHeadMesh: lamps.headMesh, vegetation, crowd, interactables: ctx.interactables, challenges: ctx.challenges,
        updaters: ctx.updaters, nightHooks: ctx.nightHooks, sounds: ctx.sounds, ctx, tris,
        timing: { fetch: Math.round(tFetch - t0), build: Math.round(tBuild - tFetch), finish: Math.round(performance.now() - tBuild), total: Math.round(performance.now() - t0) },
        dispose() { crowd?.dispose(); disposeTree(ctx.scene); ctx.scene.clear(); },
    };
    void renderer; // (programs compile on the first frame, after Renderer3D added its lights)
    console.info(`[spots] ${id} (${sceneId}): ${tris.toLocaleString()} tris, ${ctx.colliders.length} colliders, ${crowd?.count || 0} people, ${ctx.plaques.length} plaques — ${res.timing.total} ms (fetch ${res.timing.fetch}, build ${res.timing.build}, finish ${res.timing.finish})`);
    return res;
}
function mergeDialogue(data, ids) {
    const lines = [], personas = new Set();
    for (const id of ids) { const d = data.spots[id]?.dialogue; if (!d) continue; lines.push(...d.lines); for (const p of d.personas || []) personas.add(p); }
    return { lines, personas: [...personas] };
}

// ============================================================================
//  SpotSession — play a spot inside a host (the game, or game/dev/spots.html)
// ============================================================================
/**
 * @param {string} id
 * @param {{ r3d, camera, input, canvas?, hud?, audio?, photo?, date?, onExit?, uiRoot?, quality? }} host
 *   r3d    Renderer3D (lighting, sky, weather, seasons at the spot's lat/lon)
 *   input  the game's Input (keys, look, take('KeyE'))
 *   photo  PhotoMode instance (spec 16); the host should call session.onPhoto(meta) from its onPhoto
 */
export async function startSpot(id, host) {
    const spot = await loadSpot(id, host.r3d, { onProgress: host.onProgress });
    const s = new SpotSession(spot, host);
    await s.start();
    return s;
}

export class SpotSession {
    constructor(spot, host) {
        this.spot = spot; this.host = host; this.t = 0; this.nightK = 0; this.idleCheck = 0; this.progress = spotProgress();
        this.camera = host.camera; this.input = host.input; this.r3d = host.r3d;
    }
    async start() {
        const { spot, host } = this, r3d = this.r3d, cam = this.camera;
        cam.near = Math.min(cam.near, 0.1); cam.far = Math.max(cam.far, 9000); cam.updateProjectionMatrix();
        const T = [performance.now()];
        r3d.setScene(spot.scene, cam, spot.env, { units: spot.units, vegetation: spot.vegetation }); T.push(performance.now());
        r3d.setClock({ date: host.date || new Date(), lat: spot.clock.lat, lon: spot.clock.lon, timeZone: spot.clock.timeZone, timeScale: host.timeScale ?? 1, override: host.override ?? null }); T.push(performance.now());
        r3d.setLamps(spot.lamps, { headMesh: spot.lampHeadMesh }); T.push(performance.now());
        r3d.setHeadlights?.(false);
        // walker: the game's OnFootController (spec 14) when present, else the local fallback
        let Ctl = null;
        if (host.walker !== 'local') { try { Ctl = (await import('../onfoot.js')).OnFootController; } catch { Ctl = null; } }
        const obstacles = () => { const p = this.ctl; return [...(this.spot.crowd ? this.spot.crowd.obstacles(p.x, p.z) : []), ...(this.spot.ctx.extras.obstacles?.() || [])]; };
        const opts = { scene: spot.scene, camera: cam, input: this.input, colliders: spot.colliders, audio: host.audio, obstacles, groundAt: spot.groundAt };
        this.ctl = Ctl ? new Ctl(opts) : new LocalWalker(opts);
        this.walkerKind = Ctl ? 'OnFootController' : 'LocalWalker';
        const sp = spot.spawn; this.ctl.enter(sp.x, sp.z, sp.heading, sp.y);
        r3d.setPlayer(this.ctl);
        if (this.input) this.input.lookAllowed = true;
        // UI + sound
        this.ui = new SpotUI(host.uiRoot || document.body);
        this.ui.setTitle(spot.name, `${placeLabel(spot)} · walk-only bonus`);
        this.ui.setHelp('WASD walk · Shift run · Space jump · E interact · P camera · click to look (Esc releases)');
        if (spot.crowd) spot.crowd.o.bubbles = this.ui.bubbles;
        this.sound = new SpotSound({ audio: host.audio });
        for (const so of spot.sounds) this.sound.add(so.kind, so.x, so.z, so.radius, so.gain);
        spot.ctx.session = this;
        this._updateChallengeText(); T.push(performance.now());
        this.startTiming = T.slice(1).map((t, i) => Math.round(t - T[i]));
        console.info('[spots] session start ms (setScene, setClock, setLamps, walker+ui+sound):', this.startTiming.join(', '));
        window.cvTelemetry?.track?.('spot_enter', { id: spot.id, scene: spot.sceneId, city: spot.city });
    }
    get position() { return this.ctl.position; }
    /** photo-mode hook (host's PhotoMode onPhoto → here) */
    onPhoto(meta = {}) {
        const n = this.spot.crowd?.onPhoto(this.camera) || 0;
        const done = this.checkChallenge();
        return { people: n, postcard: done };
    }
    /** info for PhotoMode.getInfo while in a spot */
    photoInfo() { const sp = this.spot; return { place: sp.name, city: sp.city, timeZone: sp.clock.timeZone, night: !!this.r3d.nightLights, sub: placeLabel(sp) }; }
    /** local time / weather / season for the crowd's tagged lines (spec 15 R15.6) */
    _conditions() {
        const d = this.r3d.simDate || this.host.date || new Date(), w = this.r3d.weather || {};
        let hour = 12, month = d.getMonth(), day = d.getDate();
        try {
            const f = new Intl.DateTimeFormat('en-GB', { timeZone: this.spot.clock.timeZone, hour: 'numeric', hourCycle: 'h23', month: 'numeric', day: 'numeric' }).formatToParts(d);
            const g = (t) => +f.find((x) => x.type === t)?.value; hour = g('hour'); month = g('month') - 1; day = g('day');
        } catch { /* old browsers: device time */ }
        return { hour, month, day, tempC: w.tempC, kind: w.kind || '', snowCm: w.snowCm || 0 };
    }
    checkChallenge() {
        const cam = this.camera, p = this.ctl.position, dir = cam.getWorldDirection(new THREE.Vector3());
        const bearing = ((Math.atan2(dir.x, -dir.z) / DEG) % 360 + 360) % 360;
        for (const c of this.spot.challenges) {
            if (Math.hypot(p.x - c.x, p.z - c.z) > c.r) continue;
            let db = Math.abs(bearing - c.bearing) % 360; if (db > 180) db = 360 - db;
            if (db > c.tol) continue;
            if (c.cond && !c.cond(this)) { this.ui.toast('📷 Almost', c.condHint || 'Not quite the postcard — try again.'); continue; }
            const P = this.progress.postcards || (this.progress.postcards = {});
            const first = !P[c.id]; P[c.id] = Date.now(); saveProgress(this.progress);
            this.ui.toast(first ? '🏆 Postcard challenge complete' : '📷 Postcard', c.text || this.spot.name);
            this.sound.play('chime');
            window.cvTelemetry?.track?.('spot_postcard', { id: c.id, first });
            this._updateChallengeText();
            return c.id;
        }
        return null;
    }
    _updateChallengeText() {
        const c = this.spot.challenges.find((x) => x.id === this.spot.id) || this.spot.challenges[0];
        if (!c) { this.ui.setChallenge(''); return; }
        const done = !!this.progress.postcards?.[c.id];
        this.ui.setChallenge(`Postcard: ${c.text ? c.text.split(/[—.;]/)[0].trim() : 'take the iconic photo'}${done ? ' — done' : ''}`, done);
    }
    async readPlaque(p) {
        if (this.input) { this.input.lookAllowed = false; this.input.releaseLock?.(); }
        window.cvTelemetry?.track?.('spot_plaque', { id: this.spot.id, title: p.title });
        await this.ui.showPlaque(p, this.spot.name);
        if (this.input) { this.input.lookAllowed = true; this.input.flush?.(); this.input.keys?.clear?.(); }
    }
    /** per-frame: walker, crowd, interactions, scene animations, night, UI, sound */
    update(dt) {
        dt = Math.min(dt, 0.1); this.t += dt;
        const photo = this.host.photo?.active, panel = this.ui.panelOpen;
        if (!panel) this.ctl.update(photo ? 0 : dt);
        if (this.ctl.active !== false) this._pushOut();
        const p = this.ctl.position, pl = { x: p.x, z: p.z, y: p.y, speed: this.ctl.speed || 0, heading: this.ctl.heading };
        // night factor (lamps, windows, neon)
        const tgt = this.r3d.nightLights ? 1 : 0; this.nightK += Math.sign(tgt - this.nightK) * Math.min(Math.abs(tgt - this.nightK), dt / 1.5);
        if (this._lastNightK !== this.nightK) { this._lastNightK = this.nightK; setNightWindows(this.spot.scene, this.nightK); for (const f of this.spot.nightHooks) f(this.nightK, this); }
        if (this.spot.crowd) {
            this.condT = (this.condT ?? 0) - dt;
            if (this.condT <= 0) { this.condT = 2; this.spot.crowd.cond = this._conditions(); }
            this.spot.crowd.rainy = (this.r3d.weather?.kind || '').includes('rain'); this.spot.crowd.update(dt, pl, this.camera);
        }
        for (const f of this.spot.updaters) f(dt, this, pl);
        // interactions (nearest within reach)
        if (!photo && !panel) {
            let best = null, bd = 1e9;
            for (const it of this.spot.interactables) { if (it.cond && !it.cond(this)) continue; const d = Math.hypot(p.x - it.x, p.z - it.z); if (d < (it.r || 2) && d < bd && Math.abs((it.y ?? p.y) - p.y) < 3) { bd = d; best = it; } }
            this.ui.prompt(best ? `<kbd>E</kbd>${escapeHtml(typeof best.label === 'function' ? best.label(this) : best.label)}` : null);
            this.ui.crosshair(!!best?.aim);
            if (best && this.input?.take?.('KeyE')) best.use(this, best);
            else this.input?.take?.('KeyE');
            // reset if fallen out of the world
            if (p.y < (this.spot.ctx.minY ?? -80)) this.ctl.teleport(this.spot.spawn.x, this.spot.spawn.z, this.spot.spawn.heading);
        } else this.ui.prompt(null);
        this.ui.update(this.camera);
        this.sound.update(dt, p.x, p.z);
    }
    /** people and cars are solid at any ground height (onfoot.js only checks obstacles near y = 0, see spec 15 Requests) */
    _pushOut() {
        const c = this.ctl, feet = c.y + (c.jumpY || 0); let moved = false;
        const boxes = [...(this.spot.crowd ? this.spot.crowd.obstacles(c.x, c.z, 2) : []), ...(this.spot.ctx.extras.obstacles?.() || [])];
        for (const o of boxes) {
            if (Math.abs((o.y ?? feet) - feet) > 1.3) continue;
            const dx = c.x - o.x, dz = c.z - o.z, f = dx * o.fx + dz * o.fz, l = dx * -o.fz + dz * o.fx, hl = o.length / 2 + 0.3, hw = o.width / 2 + 0.3;
            if (Math.abs(f) >= hl || Math.abs(l) >= hw) continue;
            const pf = hl - Math.abs(f), pw = hw - Math.abs(l);
            if (pw < pf) { const s = l >= 0 ? 1 : -1; c.x += -o.fz * s * pw; c.z += o.fx * s * pw; } else { const s = f >= 0 ? 1 : -1; c.x += o.fx * s * pf; c.z += o.fz * s * pf; }
            moved = true;
        }
        if (moved) c.place?.();
    }
    /** move the walker to another spawn of the same scene (seattle-center: space-needle / chihuly / mopop) */
    teleport(spotId) { const s = this.spot.spawns[spotId]; if (s) { this.ctl.teleport(s.x, s.z, s.heading); this.spot.id = spotId; this._updateChallengeText(); } }
    dispose() {
        this.ctl?.exit(); this.ui?.dispose(); this.sound?.dispose(); this.spot?.dispose();
        this.r3d.setLamps?.([]);
        window.cvTelemetry?.track?.('spot_exit', { id: this.spot.id, seconds: Math.round(this.t) });
    }
}
/** "Seattle, WA" / "Bellevue, WA" / "Bucharest, Romania" */
export function placeLabel(sp) { return sp.entry?.area === 'bellevue' ? 'Bellevue, WA' : sp.city === 'seattle' ? 'Seattle, WA' : sp.city === 'bucharest' ? 'Bucharest, Romania' : sp.city; }
function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
/** façade night windows + anything flagged userData.nightWindows / nightGlow */
export function setNightWindows(root, k) {
    const seen = new Set();
    root.traverse((o) => {
        const m = o.material; if (!m || Array.isArray(m) || seen.has(m)) return; seen.add(m);
        if (m.userData?.nightWindows) m.emissiveIntensity = (m.userData.dayWindows || 0) + (0.9 - (m.userData.dayWindows || 0)) * k;
        else if (m.userData?.nightGlow !== undefined) m.emissiveIntensity = m.userData.dayGlow + (m.userData.nightGlow - m.userData.dayGlow) * k;
    });
}
