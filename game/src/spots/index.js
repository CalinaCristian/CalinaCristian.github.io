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
import { paintOSM, buildBuildings, buildTrees, buildLamps, buildFurniture, roadLampPoints, streetTrees, areaTrees, waterPlane, polyCollider, streetBands, carriagewayTest } from './osm.js';
import { Crowd } from './people.js';
import { SpotUI, SpotMap, plaqueMesh } from './ui.js';
import { SpotSound } from './sound.js';
import { colliderIndex, LocalWalker, collide } from './walker.js';
import { countTris, disposeTree, headingFromBearing, inPoly, polyBox, DEG, rng, distPolyline } from './kit.js';

// ---------------------------------------------------------------------------- registry (Seattle 10 + Bellevue 4; Bucharest added by its builder)
export const SPOTS_ALL = [
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
/**
 * Activities shipped in the scenes (note 57; progression lists their achievements before they are done). Each scene fires
 * `game.emit('activity', { spot, id })` / `dmcv:activity` when one is completed. Scene lanes: ask spots-core to add yours.
 */
export const ACTIVITIES = [
    ['cismigiu', 'rowboat', 'Row a boat on the lake'], ['cismigiu', 'chess', 'Watch the chess players'], ['cismigiu', 'rotunda', 'Visit the Writers\' Rotunda'],
    ['herastrau-park', 'boat', 'Boat on Lake Herăstrău'], ['village-museum', 'farmhouse', 'Step into a farmhouse'],
    ['old-town-lipscani', 'carusel', 'Climb Cărturești Carusel'], ['old-town-lipscani', 'curtea-veche', 'Old Princely Court'], ['old-town-lipscani', 'wcp-bar', 'A drink on Lipscani'],
    ['palace-parliament', 'balcony', 'The balcony view'], ['palace-parliament', 'pace', 'Pace the esplanade'], ['peoples-salvation-cathedral', 'candle', 'Light a candle'], ['stavropoleos-cec', 'stavropoleos', 'Stavropoleos courtyard'],
    ['bel-meydenbauer', 'pier-end', 'Walk to the end of the pier'], ['bel-meydenbauer', 'kayak', 'Kayak on Meydenbauer Bay'], ['bel-downtown-park', 'loop', 'Walk the park loop'],
    ['bel-botanical-garden', 'bridge', 'Cross the suspension bridge'], ['bel-botanical-garden', 'plants', 'Garden plants'], ['bel-lincoln-square', 'badge-in', 'Badge in at UiPath'],
].map(([spot, id, title]) => ({ spot, id, title }));
/**
 * Review gate (owner note 61): a spot is listed in SPOTS (game menu, world map, explore pins, achievements) only once
 * its scene passed the side-by-side review against real photos (day / night, spawn, postcard, 3 walk poses). Scene
 * lanes ask for the flip in spec 15 Requests → spots-core. Every spot stays loadable by id (spotById, dev page); a
 * reviewer lists all with `?spots=all` in the URL or localStorage `dmcv.spots.showAll` = '1'.
 */
export const READY = new Set([ // round 5 review (2026-11-07): passed the side-by-side review + audit gate
    'palace-parliament', 'peoples-salvation-cathedral', 'arcul-de-triumf', 'athenaeum-revolution', 'cismigiu', 'village-museum', 'herastrau-park',
    'bel-lincoln-square', 'bel-meydenbauer', 'bel-downtown-park',
    'kerry-park', 'gas-works',
]);
const showAll = (() => { try { return /[?&]spots=all\b/.test(globalThis.location?.search || '') || globalThis.localStorage?.getItem('dmcv.spots.showAll') === '1'; } catch { return false; } })();
for (const s of SPOTS_ALL) s.ready = READY.has(s.id);
export const SPOTS = SPOTS_ALL.filter((s) => s.ready || showAll);
export const spotById = (id) => SPOTS_ALL.find((s) => s.id === id) || DEV_SPOTS.find((s) => s.id === id) || null;

const DATA_URL = (scene) => new URL(`../../data/spots/${scene}.json`, import.meta.url).href;
// extra city-wide crowd lines + culture tips shared with the city on foot (data/dialogue.json, after round 6)
let _extraTalk = null;
export const extraDialogue = () => (_extraTalk ??= fetch(new URL('../../data/dialogue.json', import.meta.url).href).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
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
        if (o.furniture !== false) { const F = buildFurniture(d, this.ground, { exclude: ex, onRoad: this.onRoad }); this.add(F.group); this.colliders.push(...F.colliders); }
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
        data.dialogueGeneral = { ...(data.dialogueGeneral || {}), lines: [...(data.dialogueGeneral?.lines || []), ...(X.lines || []).filter((l) => l.ctx !== 'street' && l.src !== 'spots')] };
        data.talkTips = X.culture || []; } } // (player-facing tips: the spots' own `culture` notes are writing guidance for the lines)
    const tFetch = performance.now();
    const ctx = new SceneContext(data, id);
    if (opts.legacyGround) { ctx.ground.pendingConform = null; ctx.ground._settled = true; } // dev A/B: the pre-round-5 raw DEM ground
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
    const trees = buildTrees(ctx.trees, ctx.ground, { seed: data.id.length, lod: ctx.treeLod ? { near: ctx.treeLod.near ?? 90, max: ctx.treeLod.max ?? 700 } : null });
    if (trees.update) {
        const v = new THREE.Vector3();
        ctx.updaters.push((dt, s) => { s.camera.getWorldPosition(v); trees.update(v.x, v.z); });
        const sp0 = Object.values(ctx.spawns)[0] || data.spots[data.members[0]].spawn; trees.update(sp0.x, sp0.z);
    }
    ctx.add(trees.group); ctx.colliders.push(...trees.colliders); ctx.crownMeshes.push(...trees.crowns);
    // note 29: no lamp post or tree inside a carriageway (scene points included; `keepOnRoad: true` keeps a deliberate one)
    { const n0 = ctx.lampPoints.length;
        if (!globalThis.__spotsLegacy) ctx.lampPoints = ctx.lampPoints.filter((p) => p.noPost || p.keepOnRoad || !ctx.onRoad(p.x, p.z, 0.25));
        ctx.extras.clippedOnRoad.lamps = n0 - ctx.lampPoints.length; }
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
    if (ctx.crowdCfg) { // a few people chatting in view of every arrival point (bubbles from the first seconds)
        ctx.crowdCfg.groups = ctx.crowdCfg.groups || [];
        for (const sp of Object.values(spawns)) {
            const fx = -Math.sin(sp.heading), fz = -Math.cos(sp.heading);
            search: for (const f of [8, 11, 6, 14]) for (const sd of [6, -6, 4.5, -4.5]) { const x = sp.x + fx * f - fz * sd, z = sp.z + fz * f + fx * sd; if (collide(colliders, x, z, 0.6, ctx.ground.heightAt(x, z) + 0.2) || ctx.ground.nearestDry(x, z).x !== x) continue; ctx.crowdCfg.groups.push({ x, z, r: 1.2, n: 3, act: 'talk' }); break search; }
        }
    }
    if (ctx.crowdCfg) {
        const sp = ctx.spot();
        const fp = globalThis.__spotsLegacy ? null : floorProbe(ctx.scene); ctx.extras.floorProbe = fp;
        // the tour guide (note 67): waits with a flag a few metres from the first spawn until the player joins the tour
        if (ctx.crowdCfg.tour !== false) { const s0 = spawn || Object.values(spawns)[0], fx = -Math.sin(s0.heading), fz = -Math.cos(s0.heading);
            let gx = s0.x + fx * 4 + fz * 2.5, gz = s0.z + fz * 4 - fx * 2.5; if (collide(colliders, gx, gz, 0.4, ctx.ground.heightAt(gx, gz) + 0.2)) { gx = s0.x - fz * 2; gz = s0.z + fx * 2; }
            ctx.crowdCfg = { ...ctx.crowdCfg, groups: [...(ctx.crowdCfg.groups || []), { x: gx, z: gz, r: 0, n: 1, act: 'guide', personas: ['tour_guide'], tour: true, fixedYaw: true, yaw: Math.atan2(s0.x - gx, s0.z - gz) }] }; }
        crowd = new Crowd({ lift: fp?.lift, city: data.city, ground: ctx.ground, dialogue: mergeDialogue(data, ctx.crowdCfg.spots || data.members), general: data.dialogueGeneral, seed: data.id.length * 7, colliders, ...ctx.crowdCfg });
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
    const spot = await loadSpot(id, host.r3d, { onProgress: host.onProgress, legacyGround: host.legacyGround });
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
        cam.near = 0.25; // on foot: render's depth-precision test (note 55) cam.far = Math.max(cam.far, 9000); cam.updateProjectionMatrix();
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
        this.ui.setHelp('WASD walk · Shift run · Space jump · E interact · G drone · P camera · click to look (Esc releases)');
        if (spot.crowd) spot.crowd.o.bubbles = this.ui.bubbles;
        this.sound = new SpotSound({ audio: host.audio });
        for (const so of spot.sounds) this.sound.add(so.kind, so.x, so.z, so.radius, so.gain);
        spot.ctx.session = this;
        this._updateChallengeText();
        try { this._initMap(); } catch (e) { console.warn('[spots] map', e); }
        T.push(performance.now());
        this.startTiming = T.slice(1).map((t, i) => Math.round(t - T[i]));
        console.info('[spots] session start ms (setScene, setClock, setLamps, walker+ui+sound):', this.startTiming.join(', '));
        window.cvTelemetry?.track?.('spot_enter', { id: spot.id, scene: spot.sceneId, city: spot.city });
    }
    get position() { return this.ctl.position; }
    // ------------------------------------------------------------------ spot map + objectives + guided tour (notes 32/33/67)
    /** everything worth finding in this scene: { kind, x, z, label, done, icon? } (landmarks, plaques, postcard, activities, entrances) */
    objectives() {
        const S = this.spot, out = [], P = this.progress, read = P.plaques || {};
        for (const mid of S.data.members || []) { const e = spotById(mid), d = S.data.spots[mid]; if (!e || !d) continue;
            const ch = S.challenges.find((c) => c.id === mid), ext = d.extent?.polygon?.length ? polyBox(d.extent.polygon) : null;
            // the spot itself (its extent centre, else the postcard stand / spawn) — not ch.view, the point the postcard
            // looks AT (Kerry Park: downtown, 1.2 km away — the tour walked you into the city; after round 6)
            const hx = ext ? (ext.x0 + ext.x1) / 2 : ch?.x ?? d.spawn?.x ?? 0, hz = ext ? (ext.z0 + ext.z1) / 2 : ch?.z ?? d.spawn?.z ?? 0;
            out.push({ kind: 'hero', x: hx, z: hz, label: e.name, blurb: e.blurb, done: !!this._seen?.has('hero:' + mid) }); }
        for (const [k, sp] of Object.entries(S.spawns || {})) if (Object.keys(S.spawns).length > 1) out.push({ kind: 'entrance', x: sp.x, z: sp.z, label: 'Entrance: ' + (spotById(k)?.name || k), done: true, noTour: true });
        for (const pl of S.plaques) out.push({ kind: 'plaque', x: pl.x, z: pl.z, label: pl.title, text: pl.text, done: !!read[S.sceneId + ':' + pl.title], plaque: pl });
        for (const c of S.challenges) out.push({ kind: 'postcard', x: c.x, z: c.z, label: 'Postcard photo: ' + (spotById(c.id)?.name || 'the iconic view'), text: c.text, done: !!P.postcards?.[c.id] });
        const acts = [];
        for (const it of S.interactables) { if (it.kind === 'plaque' || it.kind === 'guide' || it.kind === 'talk' || it.hidden) continue; const lb = typeof it.label === 'function' ? it.label(this) : it.label; if (!lb) continue;
            acts.push({ kind: it.kind === 'bike' ? 'bike' : 'activity', x: it.x, z: it.z, full: lb, done: !!this._seen?.has('act:' + lb) }); }
        // short labels; activities sharing a "Verb: name" prefix (≥ 3, e.g. the Village Museum houses) become one group objective
        const pre = (l) => (/^([^:—]{3,40}):\s*(.+)$/.exec(l) || null), count = {};
        for (const a of acts) { const m = pre(a.full); if (m) count[m[1]] = (count[m[1]] || 0) + 1; }
        for (const a of acts) { const m = pre(a.full);
            if (m && count[m[1]] >= 3) { a.group = groupName(m[1]); a.name = m[2]; a.label = shortLabel(m[2]); }
            else { a.name = a.full; a.label = shortLabel(a.full.split(' — ')[0]); } out.push(a); }
        for (const o of out) { if (!o.name) o.name = o.label; o.short = o.short || shortLabel(o.label); }
        return out;
    }
    _initMap() {
        const S = this.spot, b = S.ctx.extras.terrainBox || { x0: -200, z0: -200, x1: 200, z1: 200 }, tp = S.ctx.terrainOpts || {};
        const px = 900, [img] = S.ctx.painter.render(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0, px, null, tp.bg || '#617242', tp.bgMask || 'grass');
        this._seen = new Set(); this.map = new SpotMap(this.ui, { image: img, bounds: b });
        this.ui.$('.sp-mini').onclick = () => this.openMap();
        this.ui.setHelp('WASD walk · Shift run · Space jump · E interact · M map · G drone · P camera · click to look (Esc releases)');
        this.ui.setTour(null);
        // the tour guide ped + its interactable
        this.guide = S.crowd?.peds.find((p) => p.group?.tour) || null;
        if (this.guide) {
            this.guide.driven = true; this.guide.speed = 0;
            this._guideIt = { kind: 'guide', x: this.guide.x, z: this.guide.z, r: 2.6, label: (s) => (s.tour?.state === 'done' ? 'Thanks for the tour!' : s.tour?.said ? 'Next stop, please' : s.tour ? 'Tour guide — follow the flag' : 'Join the free guided tour'), use: (s) => { if (!s.tour) s.startTour(); else if (s.tour.said && s.tour.state === 'arrive') s.tour.wait = 99; } }; // (E at the guide after the narration: on to the next stop)
            S.interactables.push(this._guideIt);
        }
        // E — talk to people (after round 6): the nearest person in front of the player within reach stops, turns and
        // answers (greeting → this place → a local custom as a tip → small talk), see Crowd.talkTo
        if (S.crowd) {
            const talk = { kind: 'talk', r: 2.6, ped: null, get x() { return this.ped ? this.ped.x : 1e9; }, get z() { return this.ped ? this.ped.z : 1e9; },
                cond: (s) => { const c = s.ctl, fx = -Math.sin(c.heading), fz = -Math.cos(c.heading); let best = null, bd = 2.4;
                    for (const q of S.crowd.peds) { if (q.hidden || q.driven || q === s.guide) continue; const dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz); if (d < bd && d > 0.2 && (dx * fx + dz * fz) / d > 0.35 && Math.abs((q.y ?? c.y) - c.y) < 1.6) { bd = d; best = q; } }
                    talk.ped = best; return !!best; },
                label: () => (talk.ped ? `Talk to ${Crowd.whoLabel(talk.ped)}` : ''), use: (s) => s.talkTo(talk.ped) };
            S.interactables.push(talk);
        }
        this._refreshMarkers();
    }
    _refreshMarkers() {
        if (!this.map) return; const list = this.objectives(), cur = this.tour?.stops?.[this.tour.i];
        if (this.guide) list.push({ kind: 'guide', x: this.guide.x, z: this.guide.z, label: this.tour ? 'Your guide' : 'Free guided tour', done: false });
        for (const m of list) if (cur && m.kind === cur.kind && m.label === cur.label) m.cur = true;
        this.map.setMarkers(list); this._objs = list;
    }
    async openMap() {
        if (this.ui.panelOpen || !this.map) return;
        if (this.input) { this.input.lookAllowed = false; this.input.releaseLock?.(); }
        this._refreshMarkers();
        const ICONS = { hero: '⭐', plaque: '📜', postcard: '📷', bike: '🚲', activity: '🎯' }, items = [], groups = new Map();
        for (const m of this._objs) { if (m.kind === 'guide' || m.kind === 'entrance') continue;
            if (m.group) { let g = groups.get(m.group); if (!g) { g = { icon: ICONS[m.kind] || '•', label: m.group, members: [], kind: m.kind }; groups.set(m.group, g); items.push(g); } g.members.push(m); continue; }
            items.push({ icon: ICONS[m.kind] || '•', label: m.short || m.label, done: m.done, kind: m.kind, marker: m }); }
        for (const g of groups.values()) { const d = g.members.filter((m) => m.done).length; g.label = `${g.label} (${d}/${g.members.length})`; g.done = d === g.members.length; }
        await this.ui.showMap(this.map, { title: this.spot.name, items, tour: this.guide && !this.tour ? { label: '🚩 Start the guided tour', run: () => this.startTour() } : null });
        if (this.input) { this.input.lookAllowed = true; this.input.flush?.(); this.input.keys?.clear?.(); }
        this.returnFocus();
    }
    /** E on a person: their answer in a bubble, a local custom as a tip now and then */
    talkTo(ped) {
        if (!ped || !this.spot.crowd) return;
        const D = this.spot.ctx.data, cult = D.talkTips || [], { line, tip } = this.spot.crowd.talkTo(ped, this.ctl, cult);
        if (tip) { let n = String(tip.note || ''); if (n.length > 230) n = n.slice(0, n.lastIndexOf('. ', 230) > 80 ? n.lastIndexOf('. ', 230) + 1 : 230) + (n.lastIndexOf('. ', 230) > 80 ? '' : '…'); this.ui.toast('💬 Local tip — ' + tip.topic, n); }
        else if (!line) this.ui.toast('💬', 'They smile and nod.');
        this._talks = (this._talks || 0) + 1;
        try { window.dispatchEvent(new CustomEvent('dmcv:activity', { detail: { spot: this.spot.id, id: 'talk', n: this._talks } })); } catch { /* no host */ }
    }
    /** optional guided tour: the guide walks ahead with a flag to each stop (landmark → plaques → activities → postcard), narrates, ticks the checklist */
    startTour() {
        if (!this.guide || this.tour) return;
        // (after round 6) only what belongs to the spot you are in: inside its mapped extent (+40 m) or within 230 m of its
        // entrance — a scene shared by two spots (Herăstrău + Village Museum) or a far 'hero' view point (Kerry Park, 1.2 km)
        // sent the guide on a 10-minute walk
        const sd = this.spot.data.spots?.[this.spot.id], ext = sd?.extent?.polygon?.length ? sd.extent.polygon : null, sp0 = this.spot.spawn || { x: this.guide.x, z: this.guide.z };
        const near = (m) => (ext ? (inPoly(m.x, m.z, ext) || distPolyline(m.x, m.z, [...ext, ext[0]]).d < 40) : true) && Math.hypot(m.x - sp0.x, m.z - sp0.z) < (ext ? 600 : 230);
        const objs = this.objectives().filter((m) => !m.noTour && m.kind !== 'entrance' && near(m));
        const stops = []; let cx = this.guide.x, cz = this.guide.z; const pool = objs.filter((m) => m.kind !== 'postcard'), post = objs.filter((m) => m.kind === 'postcard');
        let walked = 0; // (after round 6) a tour of a few minutes: ≤ 5 stops and ≈ 350 m of walking, nearest first
        while (pool.length && stops.length < 5) { let bi = 0, bd = 1e9; pool.forEach((m, i) => { const r = Math.hypot(m.x - cx, m.z - cz), d = r + (m.kind === 'hero' && r < 150 ? -60 : 0); if (d < bd) { bd = d; bi = i; } });
            const m = pool[bi], leg = Math.hypot(m.x - cx, m.z - cz); if (stops.length && walked + leg > 350) break; pool.splice(bi, 1); walked += leg; stops.push(m); cx = m.x; cz = m.z; }
        if (post[0] && (Math.hypot(post[0].x - cx, post[0].z - cz) < 160 || !stops.length)) stops.push(post[0]); // finish at the postcard viewpoint (when it's on the way)
        for (const m of stops) { m.done = false; const dry = this.spot.ground.nearestDry(m.x, m.z); m.tx = dry.x; m.tz = dry.z; } // the guide stops next to it
        this.tour = { stops, i: 0, state: 'walk', wait: 0, said: false, t: 0 };
        this.guide.act = 'guide';
        this.guide.sayCd = 1e9; // the guide speaks only through the tour (one bubble at a time)
        this.tour.narr = `Follow my flag — ${stops.length} stops. M shows the map.`;
        try { window.dispatchEvent(new CustomEvent('dmcv:activity', { detail: { spot: this.spot.id, id: 'tour-start' } })); } catch { /* no host */ }
        this._tourUI(); this._routeLine();
    }
    _tourUI() { const T = this.tour; if (!T) return this.ui.setTour(null);
        const st = T.stops[Math.min(T.i, T.stops.length - 1)];
        return this.ui.setTour({ title: T.state === 'done' ? 'Tour complete' : 'Guided tour', i: Math.min(T.i, T.stops.length), n: T.stops.length, done: T.state === 'done', stop: T.state === 'done' ? '' : (st.short || shortLabel(st.label)), text: T.narr || '', dots: T.stops.map((m, k) => (k < T.i ? 1 : k === T.i ? 2 : 0)) }); this.ui.setTour(T.stops.map((m, i) => ({ label: m.label, done: i < T.i || m.done && i < T.i, cur: i === T.i && T.state !== 'done' })), T.state === 'done' ? 'Tour complete' : `Guided tour ${Math.min(T.i + 1, T.stops.length)}/${T.stops.length}`); }
    /** a dashed ground line from the guide to the current stop (3-D) + the same route on the map */
    _routeLine() {
        if (this._route) { this.spot.scene.remove(this._route); this._route.geometry.dispose(); this._route = null; }
        const T = this.tour, st = T?.stops[T.i]; if (!st || T.state === 'done') { this.map?.setRoute(null); return; }
        const a = this.guide, L = Math.hypot(st.tx - a.x, st.tz - a.z), n = Math.max(1, Math.floor(L / 1.6)), pos = [], g = this.spot.ground;
        for (let i = 0; i < n; i += 1) { const u0 = i / n, u1 = Math.min(1, (i + 0.55) / n); for (const [u, sd] of [[u0, -0.12], [u0, 0.12], [u1, 0.12], [u1, -0.12]]) { const x = a.x + (st.tx - a.x) * u, z = a.z + (st.tz - a.z) * u, nx = -(st.tz - a.z) / (L || 1), nz = (st.tx - a.x) / (L || 1); pos.push(x + nx * sd, g.groundAt(x, z, g.heightAt(x, z) + 1) + 0.06, z + nz * sd); } }
        const idx = []; for (let q = 0; q < pos.length / 12; q++) { const b = q * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        m.name = 'tour-route'; m.userData.noAudit = true; m.renderOrder = 2; this.spot.scene.add(m); this._route = m;
        this.map?.setRoute([[a.x, a.z], [st.tx, st.tz]]);
    }
    _updateTour(dt, p) {
        const T = this.tour, G = this.guide; if (!T || !G || T.state === 'done') return;
        const st = T.stops[T.i]; T.t += dt;
        let dP = Math.hypot(p.x - G.x, p.z - G.z), dS = Math.hypot(st.tx - G.x, st.tz - G.z);
        const pS = Math.hypot(st.tx - p.x, st.tz - p.z); // player → stop
        if (T.state === 'walk') {
            // (round 6 note 15) the player got there first: the guide catches up at once (next to the stop, behind the
            // player when possible) and narrates — no waiting for a slow walker
            if (pS < 5 && dS > 4) {
                const ax = (p.x - st.tx) / (pS || 1), az = (p.z - st.tz) / (pS || 1), gx = st.tx + ax * 2.4 - az * 1.2, gz = st.tz + az * 2.4 + ax * 1.2;
                if (!collide(this.spot.colliders, gx, gz, 0.3, (G.y ?? 0) + 0.3)) { G.x = gx; G.z = gz; } else { G.x = st.tx; G.z = st.tz; }
                G.y = this.spot.ground.groundAt(G.x, G.z, (G.y ?? 0) + 0.45); dS = Math.hypot(st.tx - G.x, st.tz - G.z); dP = Math.hypot(p.x - G.x, p.z - G.z);
                T.state = 'arrive'; T.wait = 0; G.speed = 0;
            }
        }
        if (T.state === 'walk') {
            const wait = dP > 14 && pS > dS; // the guide waits for a player who is behind, waving the flag
            if (dS < 2.2) { T.state = 'arrive'; T.wait = 0; G.speed = 0; }
            else if (!wait) {
                // keeps the player's pace: a stroll when the player is close behind, a jog when the player is ahead
                const pv = Math.abs(p.vel ?? p.speed ?? 0), ahead = pS < dS;
                const v = ahead ? Math.min(4.5, Math.max(2.6, pv + 0.6)) : Math.min(3.0, Math.max(1.7, Math.min(pv + 0.5, 1.4 + Math.max(0, 9 - dP) * 0.2))); // (brisker: a tour is a few minutes, not ten)
                let dx = (st.tx - G.x) / dS, dz = (st.tz - G.z) / dS;
                const cols = this.spot.colliders; let nx = G.x + dx * v * dt, nz = G.z + dz * v * dt;
                for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) { const c = Math.cos(turn), s2 = Math.sin(turn), ex = dx * c - dz * s2, ez = dx * s2 + dz * c; nx = G.x + ex * v * dt; nz = G.z + ez * v * dt; if (!collide(cols, nx, nz, 0.3, G.y + 0.3)) { dx = ex; dz = ez; break; } }
                G.x = nx; G.z = nz; G.y = this.spot.ground.groundAt(nx, nz, G.y + 0.45); G.speed = v; G.phase += dt * v * 4.6; G.yaw = Math.atan2(dx, dz); G.tyaw = G.yaw;
                if ((T.t % 1) < dt) this._routeLine();
            } else { G.speed = 0; G.yaw = Math.atan2(p.x - G.x, p.z - G.z); }
        }
        if (T.state === 'arrive') {
            G.speed = 0; G.yaw = Math.atan2(st.x - G.x, st.z - G.z); T.wait += dt;
            if ((dP < 10 || T.wait > 8) && !T.said) { // narration: the guide's bubble + the full line in a toast (also when you hang back)
                T.said = true; const text = st.kind === 'hero' ? (st.blurb || st.label) : st.kind === 'plaque' ? (st.text || st.label) : st.kind === 'postcard' ? 'Best photo of the day from right here — ' + (st.text || 'the classic view') : st.label;
                this._guideBubble?.remove(); // at most one guide bubble at a time
                this._guideBubble = this.ui.bubbles?.say(this.spot.crowd?._headRef?.(G) || G, st.kind === 'hero' ? 'Here it is!' : st.kind === 'postcard' ? 'Photo time!' : 'Look here…', '', 'friendly');
                if (this._guideBubble) this._guideBubble.dataset.prio = '1';
                T.narr = text.slice(0, 320); this._tourUI(); this._seen.add((st.kind === 'hero' ? 'hero:' : 'act:') + st.label); T.wait = 0;
            }
            const left = T.said && T.wait > 1.5 && pS > 12; // the player already walked on: so does the tour
            if (T.said && (T.wait > 6 || left)) { st.done = true; T.i++; T.said = false; T.t = 0; if (T.i >= T.stops.length) return this._finishTour(); T.state = 'walk'; this._tourUI(); this._routeLine(); this._refreshMarkers(); }
        }
        if (this._guideIt) { this._guideIt.x = G.x; this._guideIt.z = G.z; }
    }
    _finishTour() {
        const T = this.tour; T.state = 'done'; this.guide.speed = 0; this.guide.sayCd = 5; T.narr = `That's the tour — ${T.stops.length} stops. Enjoy ${this.spot.name}!`; this._tourUI(); this._routeLine();
        const P = this.progress, k = this.spot.sceneId; (P.tours || (P.tours = {}))[k] = Date.now(); saveProgress(P);
        this.ui.toast('🏅 Tour complete', `You saw ${T.stops.length} stops at ${this.spot.name}.`);
        try { this.host.onTour?.({ scene: k, spot: this.spot.id, stops: T.stops.length }); } catch { /* host */ }
        try { window.dispatchEvent(new CustomEvent('dmcv:activity', { detail: { spot: this.spot.id, id: 'tour' } })); } catch { /* no host */ }
        window.cvTelemetry?.track?.('spot_tour', { id: this.spot.id });
        this._refreshMarkers();
    }
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
        this.ui.setChallenge(`Postcard: ${shortLabel(c.title || spotById(c.id)?.name || 'the iconic view', 40)}${done ? ' — done' : ''}`, done); // short (note 81); the full brief is in the map / photo mode
    }
    async readPlaque(p) {
        if (this.input) { this.input.lookAllowed = false; this.input.releaseLock?.(); }
        window.cvTelemetry?.track?.('spot_plaque', { id: this.spot.id, title: p.title });
        await this.ui.showPlaque(p, this.spot.name);
        { const P = this.progress; (P.plaques || (P.plaques = {}))[this.spot.sceneId + ':' + p.title] = Date.now(); saveProgress(P); this._refreshMarkers?.(); }
        if (this.input) { this.input.lookAllowed = true; this.input.flush?.(); this.input.keys?.clear?.(); }
        this.returnFocus();
    }
    /** note 21: back to play after a spot panel closed — the host's returnFocus (main.js) or: focus the canvas, flush input */
    returnFocus() {
        if (this.host.returnFocus) { try { this.host.returnFocus(); return; } catch { /* fall through */ } }
        const a = document.activeElement; if (a && a !== document.body) a.blur?.();
        const cv = this.host.r3d?.renderer?.domElement || this.host.r3d?.canvas; try { cv?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
        if (this.input) { this.input.flush?.(); this.input.keys?.clear?.(); this.input.lookAllowed = true; }
    }
    /** per-frame: walker, crowd, interactions, scene animations, night, UI, sound */
    update(dt) {
        dt = Math.min(dt, 0.1); this.t += dt;
        const photo = this.host.photo?.active, panel = this.ui.panelOpen;
        if (!panel) this.ctl.update(photo ? 0 : dt);
        if (this.ctl.active !== false && this.ctl.rig) this.ctl.rig.rotation.z = 0; // the walker camera stays level on slopes
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
        try { // map + tour never break the frame loop
            if (this.tour) this._updateTour(dt, p);
            if (this.map && !photo) { /* (the drone's position while it flies — note 43) */ const dr = this.host.explore?.drone, flying = dr?.active && dr.phase === 'fly'; this.map.update(dt, flying ? { x: dr.pos.x, z: dr.pos.z, heading: dr.yaw } : { x: p.x, z: p.z, heading: this.ctl.heading }); if (this.guide && (this._mkT = (this._mkT ?? 0) - dt) <= 0) { this._mkT = 1; this._refreshMarkers(); } }
        } catch (e) { if (!this._mapErr) { this._mapErr = true; console.warn('[spots] map/tour', e); } }
        if (!photo && !panel && this.input?.take?.('KeyM')) this.openMap(); // (G is the drone everywhere — round 6 note 14)
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
function shortLabel(t, n = 28) { const s = String(t || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
function groupName(p) { return /house|household|farm|gospod|casa/i.test(p) ? 'Households' : shortLabel(p.replace(/^(step into|visit|see|try|read)\s+(the\s+)?/i, (m) => m), 24); }
function firstSentence(t) { const s = String(t || '').trim(); const m = s.match(/^.{20,220}?[.!?](\s|$)/); return (m ? m[0] : s.slice(0, 200)).trim(); }
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

// ============================================================================
//  Rendered floors (note 27): big, near-horizontal triangles of the static scene meshes (steps, plinths, terraces,
//  decks) in an x/z grid. lift(x, z, y) raises a person whose body cuts such a floor (top within (y, y + 1.4]) onto it,
//  repeatedly (a flight of steps); furniture / roofs / vehicles are not floors.
// ============================================================================
export function floorProbe(scene, { minArea = 0.25, cell = 4 } = {}) {
    scene.updateMatrixWorld(true);
    const grid = new Map(), key = (i, j) => i * 100003 + j, v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], list = [];
    const skip = /^(terrain|ground|sky|water|people|crowd|tree|lamp|bench|table|chair|terrace|stall|car|parked|furniture|sign|plaque|roof|canopy|awning|umbrella|bubble)/i;
    scene.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible || skip.test(o.name || '') || /roof|canopy|awning|bench|table|chair|shelf|car/i.test(o.name || '')) return;
        const pos = o.geometry?.attributes?.position, idx = o.geometry?.index; if (!pos) return;
        const n = idx ? idx.count / 3 : pos.count / 3, mw = o.matrixWorld;
        for (let t = 0; t < n; t++) {
            for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx ? idx.getX(t * 3 + k) : t * 3 + k).applyMatrix4(mw);
            const ux = v[1].x - v[0].x, uy = v[1].y - v[0].y, uz = v[1].z - v[0].z, wx = v[2].x - v[0].x, wy = v[2].y - v[0].y, wz = v[2].z - v[0].z;
            const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, A2 = Math.hypot(nx, ny, nz);
            if (A2 < minArea * 2 || ny * ny < 0.85 * 0.85 * A2 * A2) continue; // small or not horizontal
            const T = [v[0].x, v[0].z, v[1].x, v[1].z, v[2].x, v[2].z, (v[0].y + v[1].y + v[2].y) / 3];
            if (Math.max(T[0], T[2], T[4]) - Math.min(T[0], T[2], T[4]) > 60 || Math.max(T[1], T[3], T[5]) - Math.min(T[1], T[3], T[5]) > 60) continue; // ground plates / water: not steps (and no grid blow-up)
            list.push(T);
            for (let i = Math.floor(Math.min(T[0], T[2], T[4]) / cell); i <= Math.floor(Math.max(T[0], T[2], T[4]) / cell); i++) for (let j = Math.floor(Math.min(T[1], T[3], T[5]) / cell); j <= Math.floor(Math.max(T[1], T[3], T[5]) / cell); j++) { const k = key(i, j); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(T); }
        }
    });
    const inT = (x, z, T) => { const s = (ax, az, bx, bz) => (x - bx) * (az - bz) - (ax - bx) * (z - bz); const d1 = s(T[0], T[1], T[2], T[3]), d2 = s(T[2], T[3], T[4], T[5]), d3 = s(T[4], T[5], T[0], T[1]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
    /** the highest rendered floor whose top is within (y + lo, y + hi] at (x, z), or null */
    const above = (x, z, y, lo = 0.08, hi = 1.4) => { let best = null; for (const T of grid.get(key(Math.floor(x / cell), Math.floor(z / cell))) || []) { const ty = T[6]; if (ty > y + lo && ty <= y + hi && (best === null || ty > best) && inT(x, z, T)) best = ty; } return best; };
    return { tris: list.length, above, lift: (x, z, y) => { for (let k = 0; k < 12; k++) { const t = above(x, z, y); if (t === null) return y; y = t; } return y; } };
}

// ============================================================================
//  Spot audit (owner notes 23/26/27/29/36; run by dev/spots.html → harness:spots). Static checks on the built scene:
//   zfight        coplanar, same-facing triangles of the scene's static meshes that overlap in their plane (> 0.05 m²)
//   phantom       colliders with no rendered geometry inside their footprint at body height (invisible walls)
//   pedCollider   standing / walking people inside a collider; pedBelow: below the walkable surface (steps, plinths)
//   badGeometry   NaN positions / normals, zero-length normals, degenerate triangles (area < 1e-8 m²)
//   lampOnRoad    lamp posts inside a carriageway; carOverlap: traffic cars intersecting each other
//   emptySign     plaques / signs without text
// Each finding keeps a few samples { x, z, … } for a close-up.
// ============================================================================
export function auditSpot(spot, { maxSamples = 6 } = {}) {
    const t0 = performance.now(), out = {}, add = (k, s) => { const o = out[k] || (out[k] = { n: 0, samples: [] }); o.n++; if (o.samples.length < maxSamples && s) o.samples.push(s); };
    const scene = spot.scene; scene.updateMatrixWorld(true);
    const skipMesh = (o) => !o.visible || /^(terrain|ground|sky|water|bubble|sign|label|plaque)/i.test(o.name || '') || o.material?.transparent && (o.material.opacity ?? 1) < 0.6 || o.material?.alphaTest > 0 || o.material?.depthWrite === false;
    const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    // ---- triangle soup (static meshes) + boxes of instanced meshes for the phantom test
    const tris = [], boxes = [], geoSeen = new Set(), v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], m4 = new THREE.Matrix4(), bb = new THREE.Box3();
    scene.traverse((o) => {
        if (!o.isMesh || !visible(o) || o.userData.noAudit) return;
        const g = o.geometry, pos = g?.attributes?.position; if (!pos) return;
        if (!geoSeen.has(g)) { geoSeen.add(g); // geometry sanity once per geometry
            const nrm = g.attributes.normal, idx = g.index;
            for (let i = 0; i < pos.count; i++) if (!Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))) { add('badGeometry', { mesh: o.name, kind: 'NaN position' }); break; }
            if (nrm) for (let i = 0; i < nrm.count; i++) { const a = nrm.getX(i), b = nrm.getY(i), c = nrm.getZ(i); if (!Number.isFinite(a + b + c)) { add('badGeometry', { mesh: o.name, kind: 'NaN normal' }); break; } if (a * a + b * b + c * c < 1e-8) { add('badGeometry', { mesh: o.name, kind: 'zero normal' }); break; } }
            const n = idx ? idx.count / 3 : pos.count / 3; let deg = 0;
            for (let t = 0; t < n; t++) { const [a, b, c] = idx ? [idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2]; v[0].fromBufferAttribute(pos, a); v[1].fromBufferAttribute(pos, b); v[2].fromBufferAttribute(pos, c); if (v[1].sub(v[0]).cross(v[2].sub(v[0])).lengthSq() < 4e-16) deg++; }
            if (deg) add('badGeometry', { mesh: o.name, kind: 'degenerate', count: deg });
        }
        if (o.isInstancedMesh) { if (!g.boundingBox) g.computeBoundingBox(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); bb.copy(g.boundingBox).applyMatrix4(m4); boxes.push([bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z]); } return; }
        if (o.isSkinnedMesh || o.morphTargetInfluences) return;
        const idx = g.index, n = idx ? idx.count / 3 : pos.count / 3, mw = o.matrixWorld, zf = !skipMesh(o) && !/^(people|crowd|trees?|treeCrowns|lamps?)/i.test(o.name || '');
        for (let t = 0; t < n; t++) {
            for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx ? idx.getX(t * 3 + k) : t * 3 + k).applyMatrix4(mw);
            const ax = v[0].x, ay = v[0].y, az = v[0].z, bx = v[1].x, by = v[1].y, bz = v[1].z, cx = v[2].x, cy = v[2].y, cz = v[2].z;
            boxes.push([Math.min(ax, bx, cx), Math.min(ay, by, cy), Math.min(az, bz, cz), Math.max(ax, bx, cx), Math.max(ay, by, cy), Math.max(az, bz, cz)]);
            if (!zf) continue;
            const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
            let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const A2 = Math.hypot(nx, ny, nz); if (A2 < 0.6) continue; // < 0.3 m²
            nx /= A2; ny /= A2; nz /= A2;
            tris.push({ o: o.id, name: o.name, n: [nx, ny, nz], d: nx * ax + ny * ay + nz * az, p: [ax, ay, az, bx, by, bz, cx, cy, cz] });
        }
    });
    // ---- z-fight: bucket by quantised plane, overlap test in the plane (vertex / centroid strictly inside the other)
    const buckets = new Map(), qk = (t, dd) => `${Math.round(t.n[0] * 40)},${Math.round(t.n[1] * 40)},${Math.round(t.n[2] * 40)},${Math.round(t.d / 0.02) + dd}`;
    for (const t of tris) { const k = qk(t, 0); let b = buckets.get(k); if (!b) buckets.set(k, b = []); b.push(t); }
    const proj = (t) => { const [nx, ny, nz] = t.n, ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz), P = t.p; return ax >= ay && ax >= az ? [[P[1], P[2]], [P[4], P[5]], [P[7], P[8]]] : ay >= az ? [[P[0], P[2]], [P[3], P[5]], [P[6], P[8]]] : [[P[0], P[1]], [P[3], P[4]], [P[6], P[7]]]; };
    const inTri = (p, T) => { const s = (a, b, c) => (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1]); const d1 = s(p, T[0], T[1]), d2 = s(p, T[1], T[2]), d3 = s(p, T[2], T[0]), e = 1e-3; return (d1 > e && d2 > e && d3 > e) || (d1 < -e && d2 < -e && d3 < -e); };
    const zseen = new Set(); let zpairs = 0;
    for (const [k, b] of buckets) {
        const parts = k.split(','), near = [b]; for (const dd of [1]) { const b2 = buckets.get(`${parts[0]},${parts[1]},${parts[2]},${+parts[3] + dd}`); if (b2) near.push(b2); }
        const all = near.flat(); if (all.length < 2 || all.length > 4000) continue;
        const pr = all.map(proj);
        for (let i = 0; i < b.length; i++) for (let j = i + 1; j < all.length; j++) {
            const A = pr[i], B = pr[j], ta = all[i], tb = all[j]; if (Math.abs(ta.d - tb.d) > 0.02) continue;
            const ca = [(A[0][0] + A[1][0] + A[2][0]) / 3, (A[0][1] + A[1][1] + A[2][1]) / 3], cb = [(B[0][0] + B[1][0] + B[2][0]) / 3, (B[0][1] + B[1][1] + B[2][1]) / 3];
            if (!(inTri(ca, B) || inTri(cb, A))) continue;
            zpairs++; const key = `${Math.round(ta.p[0] / 4)},${Math.round(ta.p[2] / 4)}`; if (zseen.has(key)) continue; zseen.add(key);
            add('zfight', { x: +ta.p[0].toFixed(1), y: +ta.p[1].toFixed(1), z: +ta.p[2].toFixed(1), a: ta.name, b: tb.name });
        }
    }
    if (out.zfight) out.zfight.pairs = zpairs;
    // ---- phantom colliders: nothing rendered inside the footprint between the ground and +2.2 m
    const cell = 4, grid = new Map(), gk = (i, j) => i * 100003 + j;
    boxes.forEach((B, n) => { if (B[3] - B[0] > 120 || B[5] - B[2] > 120) return; for (let i = Math.floor(B[0] / cell); i <= Math.floor(B[3] / cell); i++) for (let j = Math.floor(B[2] / cell); j <= Math.floor(B[5] / cell); j++) { const k = gk(i, j); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(n); } });
    const anyIn = (x0, z0, x1, z1, y0, y1, test) => { for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) for (const n of grid.get(gk(i, j)) || []) { const B = boxes[n]; if (B[0] <= x1 && B[3] >= x0 && B[2] <= z1 && B[5] >= z0 && B[1] <= y1 && B[4] >= y0 && (!test || test(B))) return true; } return false; };
    const G = spot.ground;
    for (const c of spot.colliders) {
        if (c.intended || c.invisible) continue;
        const pts = c.wall ? [0.15, 0.5, 0.85].map((u) => [c.ax + (c.bx - c.ax) * u, c.az + (c.bz - c.az) * u]) : c.poly ? [[c.x, c.z], ...c.poly.slice(0, 6)].map(([x, z]) => [x + (c.x - x) * 0.15, z + (c.z - z) * 0.15]) : [[c.x, c.z]];
        let miss = 0, blocks = false;
        for (const [x, z] of pts) { const gy = c.y ?? G.groundAt(x, z, G.heightAt(x, z) + 1), r = c.wall ? 0.6 : c.poly ? 1.5 : Math.max(0.3, Math.min(c.r, 3)); const y0 = c.wall ? Math.min(c.y0a ?? -1e9, c.y0b ?? -1e9) : c.y0, y1 = c.wall ? Math.max(c.y1a ?? 1e9, c.y1b ?? 1e9) : c.y1; if (y1 !== undefined && y1 < gy) continue; blocks = true;
            const b0 = y0 !== undefined && y0 > gy + 1.2 ? y0 : gy + 0.05, b1 = Math.min(y1 ?? 1e9, b0 + 2.2); if (!anyIn(x - r, z - r, x + r, z + r, b0 - 0.1, b1)) miss++; } // a raised collider (upper-floor railing, overhang) is checked at its own height
        if (blocks && miss === pts.length) add('phantom', { x: +c.x.toFixed(1), z: +c.z.toFixed(1), kind: c.wall ? 'wall' : c.poly ? 'poly' : c.prop ? 'prop' : 'box', r: +(c.r || 0).toFixed(1) });
    }
    // ---- people
    const fp = spot.ctx?.extras?.floorProbe || floorProbe(scene);
    for (const p of spot.crowd?.peds || []) {
        if (p.act === 'sit' || p.hidden) continue;
        { const t = fp.above(p.x, p.z, p.y, 0.15, 1.2); if (t !== null) add('pedSunk', { x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2), floor: +t.toFixed(2), act: p.act }); }
        if (spot.colliders.length && collide(spot.colliders, p.x, p.z, 0.2, p.y + 0.3)) add('pedCollider', { x: +p.x.toFixed(1), z: +p.z.toFixed(1), act: p.act });
        const gy = G.groundAt(p.x, p.z, p.y + 1.2); if (Number.isFinite(gy) && gy < p.y + 30 && p.y < gy - 0.15) add('pedBelow', { x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2), floor: +gy.toFixed(2) });
    }
    // ---- lamps / cars on carriageways
    const onRoad = spot.ctx?.onRoad;
    if (onRoad) for (const l of spot.lamps || []) if (!l.noPost && l.h > 4 && onRoad(l.x, l.z, 0.1)) add('lampOnRoad', { x: +l.x.toFixed(1), z: +l.z.toFixed(1) });
    const cars = spot.ctx?.extras?.obstacles?.() || [];
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, along = Math.abs(dx * a.fx + dz * a.fz), lat = Math.abs(dx * a.fz - dz * a.fx); if (along < (a.length + b.length) / 2 - 0.3 && lat < (a.width + b.width) / 2 - 0.2) add('carOverlap', { x: +a.x.toFixed(1), z: +a.z.toFixed(1) }); }
    // ---- signs (notes 51/52): tilted boards, boards overlapping each other
    const signs = []; const up = new THREE.Vector3(), q = new THREE.Quaternion();
    scene.traverse((o) => { if (!o.isMesh || !/^sign:/.test(o.name) || !visible(o)) return; o.getWorldQuaternion(q); up.set(0, 1, 0).applyQuaternion(q); const b = new THREE.Box3().setFromObject(o);
        if (up.y < 0.995 && !o.userData.tiltOk) add('signTilted', { x: +b.getCenter(up).x.toFixed(1), z: +up.z.toFixed(1), name: o.name.slice(5, 40), deg: Math.round(Math.acos(Math.min(1, new THREE.Vector3(0, 1, 0).applyQuaternion(q).y)) / DEG) });
        signs.push({ b, name: o.name }); });
    for (let i = 0; i < signs.length; i++) for (let j = i + 1; j < signs.length; j++) { const A = signs[i].b, B = signs[j].b; if (!A.intersectsBox(B)) continue; const I = A.clone().intersect(B), s1 = I.getSize(new THREE.Vector3()); if (s1.y > 0.08 && Math.max(s1.x, s1.z) > 0.15) add('signOverlap', { x: +I.min.x.toFixed(1), y: +I.min.y.toFixed(1), z: +I.min.z.toFixed(1), a: signs[i].name.slice(5, 30), b: signs[j].name.slice(5, 30) }); }
    // ---- empty signs / plaques
    for (const p of spot.plaques || []) if (!String(p.title || '').trim() || !String(p.text || '').trim()) add('emptySign', { x: p.x, z: p.z, title: p.title || '' });
    const counts = Object.fromEntries(Object.entries(out).map(([k, o]) => [k, o.n]));
    return { spot: spot.id, ms: Math.round(performance.now() - t0), tris: tris.length, colliders: spot.colliders.length, counts, findings: out };
}
