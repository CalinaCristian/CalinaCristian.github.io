// ============================================================================
//  TOURIST SPOTS (spec 15) — registry + loader + session (SpotSession: session.js; auditSpot / floorProbe: audit.js;
//  both re-exported here, so hosts import this module only).
//
//  SPOTS = [{ id, city, name, lat, lon, kind:'walk', blurb, scene }]
//  loadSpot(id, renderer?) → { scene, spawn, colliders, plaques[], dispose(), …extras }   (contract, 01-architecture)
//  startSpot(id, host)     → SpotSession: everything a host needs to play a spot
//                            (Renderer3D wiring, walker, crowd, plaques, photo challenge, sound, UI)
//  See game/src/spots/README.md for the scene-module API (how to add a spot).
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { CITIES } from '../cities.js';
import { MENU_ORDER, MENU_AVAILABLE, RECOMMENDED_SPOTS, PARK_WALKS } from '../spot-availability.js';
export { MENU_AVAILABLE } from '../spot-availability.js';
import { Ground, Painter, buildTerrain } from './ground.js';
import { buildWillows } from './willow.js';
import { patchSpotFacade } from '../facade-detail.js';
import { canopyPosts } from './canopy-posts.js';
import { withoutExtraFurniture, buildPicnicTables, buildFlagpoles } from './furniture-extra.js';
import { paintOSM, buildBuildings, buildTrees, buildLamps, buildFurniture, roadLampPoints, streetTrees, areaTrees, waterPlane, polyCollider, streetBands, carriagewayTest } from './osm.js';
import { Crowd } from './people.js';
import { plaqueMesh } from './ui.js';
import { colliderIndex, collide } from './walker.js';
import { countTris, disposeTree, headingFromBearing, inPoly, polyBox, rng } from './kit.js';
import { compactMaterialGroups } from './frame-budget.js';
import { floorProbe } from './audit.js';
export { floorProbe, auditSpot } from './audit.js';
import { SpotSession } from './session.js';
export { spotProgress, SpotSession, placeLabel, setNightWindows } from './session.js';

// ---------------------------------------------------------------------------- registry (Seattle 10 + Bellevue 4; Bucharest added by its builder)
export const SPOTS_ALL = [
    { id: 'pike-place', city: 'seattle', name: 'Pike Place Market & the Gum Wall', lat: 47.60897, lon: -122.33987, kind: 'walk', scene: 'pike-place', blurb: 'Seattle\'s 1907 public market under the red PUBLIC MARKET CENTER neon sign: flying fish, Rachel the bronze pig, the original Starbucks and the Gum Wall in Post Alley.' },
    { id: 'chihuly', city: 'seattle', name: 'Chihuly Garden and Glass', lat: 47.6204, lon: -122.3504, kind: 'walk', scene: 'seattle-center', blurb: 'Dale Chihuly\'s glass art at the foot of the Space Needle: the Glasshouse with its 100-ft red-orange-yellow suspended sculpture and a garden of glass among plants.' },
    { id: 'space-needle', city: 'seattle', name: 'Seattle Center · Space Needle & Chihuly', lat: 47.61995, lon: -122.34935, kind: 'walk', scene: 'seattle-center', blurb: 'One Seattle Center visit: ride the Space Needle elevator, explore the observation deck and discover the Chihuly garden.' },
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
    { id: 'old-town-lipscani', city: 'bucharest', name: 'Old Town · clubs, Carusel & a hidden bar', lat: 44.43218, lon: 26.10100, kind: 'walk', scene: 'buc-old-town', blurb: 'Lipscani and Smârdan by day and by night: a coffee, papanași, a photo walk and Carusel by day; karaoke, Freddo’s dance floor and a virtual shot after dark; and a secret sports room.' },
    { id: 'stavropoleos-cec', city: 'bucharest', name: 'Stavropoleos, Caru\' cu Bere & CEC Palace', lat: 44.43212, lon: 26.09830, kind: 'walk', scene: 'buc-old-town', blurb: 'A tiny 1724 Brâncovenesc jewel of a church between a neo-Gothic beer hall, the domed CEC Palace and the National History Museum.' },
    { id: 'athenaeum-revolution', city: 'bucharest', name: 'Romanian Athenaeum & Piața Revoluției', lat: 44.44085, lon: 26.09765, kind: 'walk', scene: 'athenaeum-revolution', blurb: 'The domed 1888 concert hall in its garden, and the square where the December 1989 revolution began under the Central Committee balcony.' },
    { id: 'arcul-de-triumf', city: 'bucharest', name: 'Arcul de Triumf', lat: 44.46632, lon: 26.07850, kind: 'walk', scene: 'arcul-de-triumf', blurb: 'Bucharest\'s 27 m granite triumphal arch (1936) for the First World War and the 1918 union, in a busy roundabout on Șoseaua Kiseleff.' },
    { id: 'village-museum', city: 'bucharest', name: 'Dimitrie Gusti National Village Museum', lat: 44.47085, lon: 26.07800, kind: 'walk', scene: 'buc-herastrau', blurb: 'A whole Romanian village of real wooden houses, wells and churches moved to the shore of Lake Herăstrău in 1936, with the 1722 church from Dragomirești.' },
    { id: 'herastrau-park', city: 'bucharest', name: 'King Michael I (Herăstrău) Park', lat: 44.46985, lon: 26.08310, kind: 'walk', scene: 'buc-herastrau', blurb: 'Bucharest\'s biggest park: an alley of stone busts of writers and composers, the Sleeping Nymph, a Japanese garden and the south tip of Lake Herăstrău.' },
    { id: 'spring-palace', city: 'bucharest', name: 'Spring Palace (Ceaușescu Mansion)', lat: 44.46850, lon: 26.09235, kind: 'walk', scene: 'spring-palace', blurb: 'The Ceaușescus\' private home for 24 years on a quiet villa boulevard: a cream 1960s mansion with a mosaic pool wing — and peacocks in the garden.' },
    { id: 'cismigiu', city: 'bucharest', name: 'Cișmigiu Gardens', lat: 44.43700, lon: 26.09120, kind: 'walk', scene: 'cismigiu', blurb: 'Bucharest\'s oldest public garden (1847–54): row on the winding lake and play table — backgammon — against a park regular.' },
    { id: 'bel-meydenbauer', city: 'seattle', area: 'bellevue', name: 'Meydenbauer Bay Park', lat: 47.6106, lon: -122.2108, kind: 'walk', scene: 'bel-meydenbauer', blurb: 'Bellevue\'s lakefront: a sandy beach and a floating 420-ft crescent pier on Lake Washington with Seattle on the horizon.' },
];
/** spots still being built: loadable by id (dev page) but not listed in SPOTS / the game menu until verified */
export const DEV_SPOTS = [
];
/**
 * Activities shipped in the scenes (note 57; progression lists their achievements before they are done). Each scene fires
 * `game.emit('activity', { spot, id })` / `dmcv:activity` when one is completed. Scene lanes: ask spots-core to add yours.
 */
export const ACTIVITIES = [
    ['cismigiu', 'rowboat', 'Row a boat on the lake'], ['cismigiu', 'backgammon', 'Beat Doru at backgammon'], ['cismigiu', 'rotunda', 'Visit the Writers\' Rotunda'],
    ['herastrau-park', 'boat', 'Boat on Lake Herăstrău'], ['herastrau-park', 'nymph', 'Frame the Sleeping Nymph'], ['village-museum', 'farmhouse', 'Collect a virtual household passport'],
    ['old-town-lipscani', 'wcp-bar', 'Hidden project'], ['old-town-lipscani', 'romanian-style', 'Romanian style'],
    ['old-town-lipscani', 'freddo-dance', 'Find your rhythm at Freddo'], ['old-town-lipscani', 'freddo-shot', 'Pour, toast and drink at Freddo'],
    ['old-town-lipscani', 'carusel', 'Climb Cărturești Carusel'], ['old-town-lipscani', 'curtea-veche', 'Old Princely Court'],
    ['old-town-lipscani', 'dristor-shaorma', 'Eat a shaorma at Dristor Kebap'], ['old-town-lipscani', 'shoteria-shot', 'Pour, toast and drink at Shoteria'],
    ['old-town-lipscani', 'lipscani-coffee', 'Have a coffee on Lipscani'], ['old-town-lipscani', 'lipscani-photo-walk', 'Photo walk: Old Town details'],
    ['old-town-lipscani', 'lipscani-busker', 'Toss a coin to the busker'], ['old-town-lipscani', 'mojo-karaoke', 'Sing karaoke at Mojo'], ['old-town-lipscani', 'jacks-papanasi', 'Eat papanași at Jack’s Pub'],
    ['palace-parliament', 'balcony', 'Frame the Palace facade'], ['palace-parliament', 'pace', 'Walk the public Palace sidewalk'], ['peoples-salvation-cathedral', 'candle', 'Light a candle'], ['stavropoleos-cec', 'stavropoleos', 'Stavropoleos courtyard'],
    ['bel-meydenbauer', 'pier-end', 'Walk to the end of the pier'], ['bel-meydenbauer', 'kayak', 'Kayak on Meydenbauer Bay'], ['bel-downtown-park', 'loop', 'Walk the park loop'],
    ['bel-botanical-garden', 'bridge', 'Cross the suspension bridge'], ['bel-lincoln-square', 'badge-in', 'Frame Lincoln Square'],
    ['space-needle', 'lm-chihuly-glasshouse', 'Explore the Glasshouse details'], ['mopop', 'mopop-lobes', 'Frame MoPOP\'s metal lobes'],
    ['arcul-de-triumf', 'arcul-race', 'Win the island race'], ['arcul-de-triumf', 'arcul-baguette', 'Catch the baguette three times'],
].map(([spot, id, title]) => ({ spot, id, title }));
/**
 * READY retains historical side-by-side review records. MENU_AVAILABLE separately
 * lists current native access/control checks; it is not an architectural parity flag.
 * Every spot stays loadable by id (spotById, dev page); a
 * reviewer lists all with `?spots=all` in the URL or localStorage `dmcv.spots.showAll` = '1'.
 */
export const READY = new Set([ // Historical round5 review (2026-11-07); not the current menu-access gate.
    'palace-parliament', 'peoples-salvation-cathedral', 'arcul-de-triumf', 'athenaeum-revolution', 'cismigiu', 'village-museum', 'herastrau-park',
    'bel-lincoln-square', 'bel-meydenbauer', 'bel-downtown-park',
    'kerry-park', 'gas-works',
]);
const showAll = (() => { try { return /[?&]spots=all\b/.test(globalThis.location?.search || '') || globalThis.localStorage?.getItem('dmcv.spots.showAll') === '1'; } catch { return false; } })();
for (const s of SPOTS_ALL) { s.ready = READY.has(s.id); s.available = MENU_AVAILABLE.has(s.id); s.menuTier = RECOMMENDED_SPOTS.has(s.id) ? 'recommended' : PARK_WALKS.has(s.id) ? 'parks' : 'views'; }
export const SPOTS = SPOTS_ALL.filter((s) => s.available || showAll).sort((a,b) => (MENU_ORDER.indexOf(a.id) < 0 ? Infinity : MENU_ORDER.indexOf(a.id)) - (MENU_ORDER.indexOf(b.id) < 0 ? Infinity : MENU_ORDER.indexOf(b.id)));
export const spotById = (id) => SPOTS_ALL.find((s) => s.id === id) || DEV_SPOTS.find((s) => s.id === id) || null;

const DATA_URL = (scene) => new URL(`../../data/spots/${scene}.json`, import.meta.url).href;
// extra city-wide crowd lines + culture tips shared with the city on foot (data/dialogue.json, after round 6)
let _extraTalk = null;
export const extraDialogue = () => (_extraTalk ??= fetch(new URL('../../data/dialogue.json', import.meta.url).href).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

// ============================================================================
//  Scene context handed to scene modules (scenes/<scene>.js → export default { build(ctx), env? })
// ============================================================================
class SceneContext {
    constructor(data, spotId) {
        this.data = data; this.spotId = spotId; this.id = data.id;
        this.scene = new THREE.Scene(); this.scene.name = 'spot:' + data.id;
        this.ground = new Ground(data.terrain);
        // street-conformed ground (notes 48/56/68), built on the first height query; a scene opts out with
        // `ctx.ground.pendingConform = null` (or tunes it: `ctx.ground.pendingConform.opts = {...}`) before querying heights
        this.ground.pendingConform = streetBands(data);
        { const W = Object.values(data.spots).flatMap((s) => s.extent?.polygon || []); if (W.length) { const b = polyBox(W); this.ground.pendingConform.bounds = { x0: b.x0 - 220, z0: b.z0 - 220, x1: b.x1 + 220, z1: b.z1 + 220 }; } }
        /** (x, z, margin) → inside a ground-level carriageway? (lamps, trees, furniture are clipped against it) */
        this.onRoad = carriagewayTest(data);
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
        if (!String(pl?.title || '').trim() || !String(pl?.text || '').trim()) { console.warn('[spots] plaque without text skipped', pl?.title); return null; } // note 36: no empty signs
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
        this.ground.settle?.(o.settle);
        paintOSM(this.painter, d, { skipWays: this.skipWays, skipAreas: this.skipAreas, skipBuildings: this.skipBuildings, ...o.paint });
        const B = buildBuildings(d, this.ground, { skip: this.skipBuildings, preserveSources:o.preserveSources, wallOpenings:o.wallOpenings, exclude: ex, urban: o.urban ?? true, style: o.style, filter: o.filter, shopStyle: o.shopStyle });
        this.add(B.group); this.colliders.push(...B.colliders); this.extras.buildings = B;
        { const P = canopyPosts(d, this.ground, B.sourceMembers, { skip: this.skipBuildings }); if (P.group) { this.add(P.group); this.colliders.push(...P.colliders); } this.extras.canopyPosts = P.posts; }
        if (o.trees !== false) {
            this.trees.push(...d.trees.filter(([x, z]) => !ex.some((p) => inPoly(x, z, p))).map(([x, z, lt]) => ({ x, z, kind: lt === 'needleleaved' ? 'con' : 'broad' })));
            if (o.streetTrees !== false) this.trees.push(...streetTrees(d, { exclude: ex, skip: this.skipWays, ...(o.streetTreeOpts || {}) }));
            if (o.areaTrees !== false) this.trees.push(...areaTrees(d, { exclude: ex, ...(o.areaTreeOpts || {}) }));
        }
        if (o.lamps !== false) {
            const fromOsm = (d.furniture.street_lamp || []).map(([x, z]) => ({ x, z, rot: 0 }));
            this.lampPoints.push(...(fromOsm.length > 6 ? fromOsm : []), ...roadLampPoints(d, { skip: this.skipWays, inside: (x, z) => !ex.some((p) => inPoly(x, z, p)), ...(o.lampOpts || {}) }));
        }
        if (o.furniture !== false) { const F = buildFurniture(withoutExtraFurniture(d), this.ground, { exclude: ex, onRoad: this.onRoad }); this.add(F.group); this.colliders.push(...F.colliders);
            const T = buildPicnicTables(d, this.ground, { exclude: ex, onRoad: this.onRoad }); if (T.group) this.add(T.group); this.colliders.push(...T.colliders);
            this.flagpoleExclude = ex; } // flagpoles go in after the scene build (furniture-extra.js: skip the poles a scene dressed)
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
    const [data, mod, xtra] = await Promise.all([
        opts.data ? Promise.resolve(opts.data) : fetch(DATA_URL(sceneId)).then((r) => { if (!r.ok) throw new Error(`spot data ${sceneId}: HTTP ${r.status}`); return r.json(); }),
        import(`./scenes/${sceneId}.js`), extraDialogue(),
    ]);
    { const X = xtra?.[data.city === 'bucharest' ? 'bucharest' : 'seattle']; if (X && !data._xtra) { data._xtra = true; // (spot JSONs are cached by the host: merge once)
        data.dialogueGeneral = { ...(data.dialogueGeneral || {}), lines: [...(data.dialogueGeneral?.lines || []), ...(X.lines || []).filter((l) => l.ctx !== 'street' && l.src !== 'spots' && !l.spot)] };
        // L30: lines written for one place (its history, customs, yearly events) join that place's own lines
        for (const l of X.lines || []) { const s = l.spot && data.spots?.[l.spot]; if (s) { const { spot, ...line } = l; (s.dialogue ??= { lines: [] }).lines.push(line); } }
        data.talkTips = X.culture || []; } } // (player-facing tips: the spots' own `culture` notes are writing guidance for the lines)
    const tFetch = performance.now();
    const ctx = new SceneContext(data, id);
    if (opts.legacyGround) { ctx.ground.pendingConform = null; ctx.ground._settled = true; } // dev A/B: the pre-round-5 raw DEM ground
    const def = mod.default || mod;
    await def.build(ctx);
    if (ctx.flagpoleExclude) { const F = buildFlagpoles(data, ctx.ground, ctx.scene, { exclude: ctx.flagpoleExclude }); if (F.group) ctx.add(F.group); ctx.colliders.push(...F.colliders); }
    const tBuild = performance.now();
    // ---- standard finish: terrain, trees, lamps, crowd, spawn
    const T = ctx.terrainOpts, W = Object.values(data.spots).flatMap((s) => s.extent?.polygon || []);
    const wb = W.length ? polyBox(W) : { x0: -150, z0: -150, x1: 150, z1: 150 };
    const m8 = (v) => Math.round(v / 8) * 8;
    const inner = T.inner || { x0: m8(wb.x0 - 60), z0: m8(wb.z0 - 60), x1: m8(wb.x1 + 60), z1: m8(wb.z1 + 60) };
    const outerPad = T.outerPad ?? 420;
    const outer = T.outer || { x0: inner.x0 - m8(outerPad), z0: inner.z0 - m8(outerPad), x1: inner.x1 + m8(outerPad), z1: inner.z1 + m8(outerPad) };
    const terr = buildTerrain(ctx.ground, ctx.painter, { inner, outer, innerPx: T.innerPx || 2048, outerPx: T.outerPx || 1024, innerStep: T.innerStep || 2, outerStep: T.outerStep || 8, bg: T.bg || '#617242', bgMask: T.bgMask || 'grass', brickAngle: T.brickAngle || 0, skirt: T.skirt ?? 6000, skirtY: T.skirtY ?? null, skirtColor: T.skirtColor ?? null, cutouts: T.cutouts || [] });
    ctx.add(terr.group); ctx.extras.terrain = terr; ctx.extras.terrainBox = inner;
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
    { const cut = globalThis.__spotsLegacy ? [] : ctx.trees.filter((t) => !t.keepOnRoad && ctx.onRoad(t.x, t.z, 0.2)); ctx.trees = ctx.trees.filter((t) => !cut.includes(t)); ctx.extras.clippedOnRoad = { trees: cut.length, treeSamples: cut.slice(0, 6).map((t) => [Math.round(t.x), Math.round(t.z)]) }; }
    // weeping willows have their own builder (willow.js; osm.js is hashed into the Seattle source-context cache)
    { const W = ctx.trees.filter((t) => t.kind === 'willow'); if (W.length) { ctx.trees = ctx.trees.filter((t) => t.kind !== 'willow'); const B = buildWillows(W, ctx.ground), eye = new THREE.Vector3(); ctx.add(B.group); ctx.colliders.push(...B.colliders); ctx.crownMeshes.push(...B.crowns); ctx.extras.willows = W.length; ctx.updaters.push((dt, s) => { s.camera.getWorldPosition(eye); B.update(dt, eye.x, eye.z, s.r3d?.weather?.windKmh); }); } }
    const trees = buildTrees(ctx.trees, ctx.ground, { seed: data.id.length, lod: ctx.treeLod ? { near: ctx.treeLod.near ?? 90, max: ctx.treeLod.max ?? 700, force: ctx.treeLod.force } : null });
    if (trees.update) {
        const v = new THREE.Vector3();
        ctx.updaters.push((dt, s) => { s.camera.getWorldPosition(v); trees.update(v.x, v.z, v.y); });
        const sp0 = Object.values(ctx.spawns)[0] || data.spots[data.members[0]].spawn; trees.update(sp0.x, sp0.z);
    }
    ctx.add(trees.group); ctx.colliders.push(...trees.colliders); ctx.crownMeshes.push(...trees.crowns);
    // facade surface detail (stone, rusticated bases, panel joints, plaster) on every facade material of the spot
    ctx.scene.traverse((o) => { for (const m of !o.material ? [] : Array.isArray(o.material) ? o.material : [o.material]) patchSpotFacade(m); });
    // note 29: no lamp post or tree inside a carriageway (scene points included; `keepOnRoad: true` keeps a deliberate one)
    { const n0 = ctx.lampPoints.length;
        if (!globalThis.__spotsLegacy) ctx.lampPoints = ctx.lampPoints.filter((p) => p.noPost || p.keepOnRoad || !ctx.onRoad(p.x, p.z, 0.25));
        ctx.extras.clippedOnRoad.lamps = n0 - ctx.lampPoints.length; }
    const lamps = buildLamps(ctx.lampPoints, ctx.ground, ctx.lampOpts);
    // meshless light entries (scene-built lamps) come back from the hash-locked osm.js without their flag and arm yaw: a
    // `rot` given on a noPost point puts the light pool under the head (render.js head offset), as for the generated posts
    { const np = ctx.lampPoints.filter((p) => p.noPost), ex = lamps.lamps.slice(lamps.lamps.length - np.length); ex.forEach((l, i) => { l.noPost = true; if (np[i].rot != null) l.rot = np[i].rot; }); }
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
    if (ctx.crowdCfg) { // a few people chatting in view of every arrival point (bubbles from the first seconds)
        ctx.crowdCfg.groups = ctx.crowdCfg.groups || [];
        for (const sp of Object.values(spawns)) {
            const fx = -Math.sin(sp.heading), fz = -Math.cos(sp.heading);
            search: for (const f of [8, 11, 6, 14]) for (const sd of [6, -6, 4.5, -4.5]) { const x = sp.x + fx * f - fz * sd, z = sp.z + fz * f + fx * sd; if (collide(colliders, x, z, 0.6, ctx.ground.heightAt(x, z) + 0.2, true) || ctx.ground.nearestDry(x, z).x !== x) continue; ctx.crowdCfg.groups.push({ x, z, r: 1.2, n: 3, act: 'talk' }); break search; }
        }
    }
    if (ctx.crowdCfg) {
        const sp = ctx.spot();
        const fp = globalThis.__spotsLegacy ? null : floorProbe(ctx.scene); ctx.extras.floorProbe = fp;
        // the tour guide (note 67): waits with a flag a few metres from the first spawn until the player joins the tour
        if (ctx.crowdCfg.tour !== false) { const s0 = spawn || Object.values(spawns)[0], fx = -Math.sin(s0.heading), fz = -Math.cos(s0.heading);
            let gx = s0.x - fz * 2, gz = s0.z + fx * 2;
            // Initial placement only: keep the guide beside the approach and out
            // of each actual postcard camera, without moving anyone after arrival.
            searchGuide: for (const f of [4, 6, 2, 8]) for (const side of [4, -4, 6, -6, 2.5, -2.5]) {
                const x = s0.x + fx * f + fz * side, z = s0.z + fz * f - fx * side;
                if (ctx.challenges.some(c => Math.hypot(c.x - x, c.z - z) < 3) || collide(colliders, x, z, .4, ctx.ground.heightAt(x, z) + .2) || ctx.ground.nearestDry(x, z).x !== x) continue;
                gx = x; gz = z; break searchGuide;
            }
            ctx.crowdCfg = { ...ctx.crowdCfg, groups: [...(ctx.crowdCfg.groups || []), { x: gx, z: gz, r: 0, n: 1, act: 'guide', personas: ['tour_guide'], tour: true, fixedYaw: true, yaw: Math.atan2(s0.x - gx, s0.z - gz) }] }; }
        crowd = new Crowd({ lift: fp?.lift, city: data.city, ground: ctx.ground, dialogue: mergeDialogue(data, ctx.crowdCfg.spots || data.members), general: data.dialogueGeneral, seed: data.id.length * 7, colliders, ...ctx.crowdCfg });
        ctx.add(crowd.group);
        void sp;
    }
    const vegetation = { treeCrownMeshes: ctx.crownMeshes, grassMaterials: ctx.grassMaterials, groundMaterials: [...terr.materials, ...(ctx.extras.sourceGroundMaterials || [])], roofMaterials: ctx.roofMaterials };
    ctx.scene.userData.vegetation = vegetation;
    // frame budget: scene hooks that need the finished scene, then one draw call per material of a multi-material mesh
    // (a sign board or plaque was 6-7 calls per pass; same pixels) — frame-budget.js
    for (const f of ctx.extras.finishers || []) f(ctx);
    ctx.extras.drawGroups = compactMaterialGroups(ctx.scene);
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
        dispose() { ctx.extras.participation?.dispose(); for (const clean of ctx.extras.sceneCleanups || []) clean(); crowd?.dispose(); disposeTree(ctx.scene); ctx.scene.clear(); },
    };
    void renderer; // (programs compile on the first frame, after Renderer3D added its lights)
    console.info(`[spots] ${id} (${sceneId}): ${tris.toLocaleString()} tris, ${ctx.colliders.length} colliders, ${crowd?.count || 0} people, ${ctx.plaques.length} plaques — ${res.timing.total} ms (fetch ${res.timing.fetch}, build ${res.timing.build}, finish ${res.timing.finish})`);
    return res;
}
function mergeDialogue(data, ids) {
    const lines = [], personas = new Set();
    const anchors = {};
    for (const id of ids) { const s = data.spots[id], d = s?.dialogue; if (!d) continue;
        // L30: each line remembers the sub-spot it was written for (extent centre, else spawn), so a person at Lipscani
        // talks about Lipscani, not about the Stavropoleos church two streets away (anchor: the sub-spot's spawn; members
        // of one scene often share a single extent)
        const poly = s.extent?.polygon, at = Number.isFinite(s.spawn?.x) ? { x: s.spawn.x, z: s.spawn.z } : poly?.length ? { x: poly.reduce((a, p) => a + p[0], 0) / poly.length, z: poly.reduce((a, p) => a + p[1], 0) / poly.length } : null;
        if (at) anchors[id] = at;
        for (const l of d.lines) lines.push(at ? { ...l, at: id } : l);
        for (const p of d.personas || []) personas.add(p); }
    return { lines, personas: [...personas], anchors };
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
    const spot = await loadSpot(id, host.r3d, { onProgress: host.onProgress, legacyGround: host.legacyGround });
    const s = new SpotSession(spot, host);
    await s.start();
    return s;
}
