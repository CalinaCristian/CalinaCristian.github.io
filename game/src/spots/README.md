# Tourist spots framework

Walk-only, high-fidelity bonus scenes built from the research dossiers (spec 20). Requirements and acceptance:
[specs/15-tourist-spots.md](../../../specs/15-tourist-spots.md). Owner role: **spots** (`game/src/spots/*`,
`game/data/spots/*`, `game/dev/spots.html`). Visual QA of spots: `npm run harness:spots`
([game/dev/harness/visual/README.md](../../dev/harness/visual/README.md)).

## Quick start

```bash
node game/src/spots/tools/build-data.mjs     # research → game/data/spots/<scene>.json (all scenes)
python3 -m http.server 8123                   # from the repo root
open http://localhost:8123/game/dev/spots.html?id=fremont-troll
```

Dev page parameters: `id`, `ov` (`day|sunset|dusk|night|dawn`), `hour` (local time at the spot), `date` (ISO), `weather`
(`clear|cloudy|drizzle|rain|snow|fog|storm`), `season`, `q` (quality), `walker=local` (fallback walker),
`at=x,z,bearing,pitch` (walker pose), `cam=x,y,z,bearing,pitch,fov` (free camera), `fov`, `ui=0` (hide all UI), `hud=0`
(hide the spot card / help), `dev=0` (hide the dev panel), `manual=1` (no rAF loop; drive frames with
`spotDev.step(n, dt)`), `audit=1|0` (run / skip `auditSpot`; on by default under automation), `legacy=1` /
`ground=legacy` (pre-round-5 core behaviour for A/B). `window.spotDev = { session, r3d, camera, THREE, setCam, walkTo,
step, photo, loadMs, audit }`.

## API

```js
import { SPOTS, SPOTS_ALL, DEV_SPOTS, ACTIVITIES, MENU_AVAILABLE, spotById, loadSpot, startSpot, SpotSession, spotProgress } from './spots/index.js';

SPOTS_ALL  // [{ id, city, area?, name, lat, lon, kind: 'walk', blurb, scene }]
SPOTS      // the menu: SPOTS_ALL filtered by MENU_AVAILABLE (spot-availability.js), in MENU_ORDER;
           // ?spots=all or localStorage['dmcv.spots.showAll'] = '1' lists every spot
DEV_SPOTS  // loadable by id (dev page, spotById) but never listed
const spot = await loadSpot(id, renderer?)   // → { scene, spawn, colliders, plaques[], dispose(), …extras }
const s = await startSpot(id, { r3d, camera, input, photo?, audio?, hud?, date?, override?, walker? })
loop: s.update(dt); r3d.frame(dt);
photo onPhoto(meta) → s.onPhoto(meta)        // crowd reactions + postcard challenge
photo getInfo()     → s.photoInfo()
s.teleport(spotId)                            // another spawn of the same scene
s.cancelActivities(reason)                    // hosts call this before pause / photo / drone / map takeovers
s.dispose()
```

`loadSpot` extras: `spawns{}`, `ground` (`heightAt`, `groundAt`, `flightHeightAt`), `groundAt(x,z,y)`, `env`,
`clock {lat, lon, timeZone}`, `lamps[]` + `lampHeadMesh` (for `r3d.setLamps`), `vegetation` (for `r3d.setScene`),
`crowd`, `interactables[]`, `challenges[]`, `updaters[]`, `nightHooks[]`, `sounds[]`, `tris`, `timing`.

`SpotSession` wires `Renderer3D.setScene/setClock/setLamps` (real sun, weather and season at the spot — spec 18), the
walker (`OnFootController` from `src/onfoot.js`, else `walker.js` `LocalWalker`), the crowd, the UI (`ui.js`), the
ambience (`sound.js`), `E` interactions, the postcard challenge, night lights and telemetry (`spot_enter`, `spot_plaque`,
`spot_postcard`, `spot_exit` via `window.cvTelemetry`). Progress is kept in `localStorage['dmcv.spots.v1']`. Completing
an activity fires `game.emit('activity', { spot, id })` / `dmcv:activity`; activity ids are in `ACTIVITIES`.

### Activities

- `activityFlow(ctx)` (`participation.js`): the shared participatory flow — 44 px buttons, E / Escape, explicit busy
  phases, completion callbacks only on a real finish, cleanup on map, travel, visibility change and disposal. Camera
  rides set `cameraRide: true`; other locked activities keep mouse / touch look.
- `onActivityCancel(ctx, cancel)`: walking courses (no panel) register here so `cancelActivities()` clears their partial
  progress.
- Helpers: `buc.js` `boatRide`, `race-course.js`, `water-route.js` (paddle courses, dry-bank landings), `photo-hunt.js`, `venue-activities.js`
  (held-item sequences), `candle-light.js`, `coin-drop.js`, `stone-skipping.js`, `dance-camera.js`, `bike.js`,
  `backgammon-*.js`, `baguette-game.js`, `chess-opening.js`, `tour.js` (guided-walk routing), `walk-boundary.js`
  (visit boundary applied after walker and crowd collision).

## Seattle context cache

`game/data/spots/seattle-context-render.bin.gz` records the SHA-256 of the scripts it was built with
(`game/data/spots/seattle-context-manifest.json` → `nativeGeometryConsumerHashes`: `spots/osm.js`,
`spots/source-buildings.js`, `spots/kit.js`, `spots/source-context-data.js`, `spots/context-array-codec.js`,
`building-parts.js`, `building-roofs.js`). If one changes, the cache is refused and Pike Place and the Space Needle do not
open; the generator is not in this repository. `game/dev/source-context-consumers.test.mjs` fails first. Put fixes in
separate modules instead (`furniture-extra.js`, `canopy-posts.js`, `willow.js`, `source-facade.js`,
`game/src/facade-detail.js`).

## Files

- Core: `index.js` (registry, `loadSpot`, `SpotSession`, the `SceneContext`, `auditSpot`, `floorProbe`),
  `scenes/<scene>.js` (`export default { env?, async build(ctx) }`, plus helper modules per scene), `walker.js`
  (collider index, `LocalWalker`), `people.js` (`Crowd`), `ui.js` (`SpotUI`, `SpotMap`, `BubbleLayer`, `plaqueMesh`),
  `sound.js` (`SpotSound`), `cars.js`.
- Data: `tools/build-data.mjs` (research JSON + OSM extract + terrain grid → `game/data/spots/<scene>.json`),
  `tools/fetch-buc.mjs` (Bucharest Overpass OSM + EU-DEM, cached in `$SPOTS_OSM_CACHE`, default
  `<tmp>/dmcv-spots-osm/buc`, never in git; run by the builder when missing; `NODE_USE_ENV_PROXY=1` behind a proxy).
- Terrain: `ground.js` (`Ground`, `Painter`, `buildTerrain`), `scenes/fine-dem*.js` (`applyFineDem`: USGS 1 m DEM where
  the 20 m grid is too coarse), `source-*.js` (literal source context shared with the street worlds).
- Building kits: `osm.js` and `kit.js` (hash-locked, see above), `sdf.js` (sculptures), `props.js`, `space-needle.js`
  (`spaceNeedleModel`, `needlePavilion`, `NEEDLE`; estimates in its header), `backdrop.js` (Seattle far backdrop),
  `buc.js` (Bucharest kit: `bucBackdrop`, `classicFacade`, `placeLandmark`, `signAtlas`, `oldTownTerraces`, …),
  `buc-barriers.js` (`osmBarriers`), `buc-places.js` (`osmPlaces`), `buc-streetscape.js`, `scenes/buc-green.js`,
  `scenes/buc-walls.js` (`stoneWall`), `landmark-colliders.js`.
- `frame-budget.js`: `compactMaterialGroups`, batched city context per 120 m cell with frustum / skyline culling (falls
  back without `BatchedMesh` internals or `WEBGL_multi_draw`); test `game/dev/frame-budget.test.mjs`. Late hooks go in
  `ctx.extras.finishers`; a collider with `solid: true` may occlude the skyline cull.
- `precip-shelter.js`: `declareInterior(ctx, { poly | box, y0, y1 })` for roofed interiors (no rain / snow, umbrellas
  closed).

## Coordinates

Local metres: **x east, z south, y up**; origin = the scene origin in the data file (default: the first member spot's
research spawn); `y = 0` at `origin.elev` (NAVD88 for Seattle). `ctx.ll(lat, lon) → {x, z}`. Compass bearing → walker
yaw with `headingFromBearing(deg)`. Colliders use the `world.js` formats (polygon `{x,z,r,poly}`, oriented box
`{x,z,angle,hw,hd}`, circle prop `{x,z,r,hw:r,prop,h,y}`, wall segment `{wall,ax,az,bx,bz,y0a,y1a,y0b,y1b}`) and are
indexed (`.query`). Floor probes honour `userData.noFloor`. Drone altitude uses `ground.flightHeightAt()` (terrain,
reachable decks, water level); the walker's deep-water / steep-sculpture barrier stays in `groundAt()`.

## Adding a spot

1. Add a `SCENES` entry in `tools/build-data.mjs` (Bucharest: `research: 'bucharest-spots.json'`, `osmDir: 'buc-spots'`,
   `tz: 'Europe/Bucharest'`; several spots may share a scene with `members`). Run the builder.
2. Add the spot to `SPOTS_ALL` in `index.js` (or `DEV_SPOTS` until verified); menu access is `MENU_ORDER` in
   `game/src/spot-availability.js`.
3. Write `scenes/<scene>.js`:
   ```js
   export default {
       env: { fogFar: 4000 },                                       // optional Renderer3D env overrides
       async build(ctx) {
           const g = ctx.ground, sp = ctx.spot('<id>');
           g.flatten(poly, y) / g.corridor(pts, w) / g.mod(fn)        // shape the terrain
           ctx.water(y, box, polys)                                     // water plane + carve + not walkable
           ctx.terrainOpts = { bg, bgMask, brickAngle, skirtY, ... }    // ground textures / apron
           ctx.skipBuildings.add(osmId); ctx.exclude.push(poly)        // hero replaces OSM
           ctx.osmBackdrop({ urban, style, streetTreeOpts, lampOpts })  // ground paint, buildings, trees, lamps, furniture
           ctx.add(heroGroup); ctx.collider(...) / ctx.box / ctx.circle / ctx.poly; g.addBox / addPoly / addHeightmap
           ctx.plaque(sp.plaques[i], x, z, yaw, { credit })            // research plaques; credit the artist (R15.7)
           ctx.challenge('<id>', { r, tol, cond })                      // postcard from research photo.iconic
           ctx.interactables.push({ x, z, r, label, use(session) })     // E actions
           ctx.crowdCfg = { personas, walkers, paths: ctx.footLines(), groups: [...] }
           ctx.sound(kind, x, z, radius, gain); ctx.onUpdate(fn); ctx.onNight(fn)
           ctx.spawns['<id>'] = { x, z, heading, pitch: 0 }             // optional pitch (rad), clamped to ±1.3
           ctx.treeLod = { cap, near, max, force? }                     // optional tree budget: nearest `max` within `near` m at full detail
           ctx.extras.sourceGroundMaterials = [...]                     // extra terrain materials: weather / season, no wind
       },
   };
   ```
4. Check it in `game/dev/spots.html?id=<id>` (day, dusk, rain) beside `game/research/refs/<dir>/`; keep ≤ 1 M triangles
   (the dev stats show them) and load < 3 s.

Data caveats:
- The OSM extracts drop multipolygon inner rings: derive shorelines from the terrain grid and let the water plane draw
  the water.
- Research coordinates can fall inside buildings or water; `loadSpot` moves spawns and challenge poses to the nearest dry
  spot — check them in the dev page.
- Bucharest scenes can be rebuilt from live OSM (`tools/fetch-buc.mjs` + `build-data.mjs`; keep the classes added by
  `tools/spots/append-osm-features.mjs` and `tools/spots/enrich-osm-tags.mjs`). The Seattle / Bellevue extracts
  (`game/research/osm/sea-spots/`) have no fetch tool, and some content (the Lincoln Square skybridges) exists only in the
  prepared scene JSON: never rebuild those scenes from a fresh extract without carrying it over.
- `build-data.mjs` adapts the Bucharest dossier's own schema (`bucSpot`: spawns from `SCENES[].spawns`, extent from
  `footprint`, postcard from `photo_angle`, plaque titles from `BUC_TITLES`; `bucDialogue`: persona lines → `{p, ctx,
  text, orig, lang}` plus `when` / `wx` / `season` tags the crowd uses to pick lines that fit the time, weather and
  season).
