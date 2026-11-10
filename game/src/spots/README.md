# Tourist spots framework (spec 15)

Walk-only, high-fidelity bonus scenes built from the research dossiers (spec 20). Seattle 10 + Bellevue 4 and
Bucharest 10 (7 scenes) are built on this framework (see *Adding a spot* and *Bucharest*). Owner role: **spots**
(`game/src/spots/*`, `game/data/spots/*`, `game/dev/spots.html`).

## Quick start

```bash
node game/src/spots/tools/build-data.mjs              # research → game/data/spots/<scene>.json (all scenes)
python3 -m http.server 8123                            # from the repo root
open http://localhost:8123/game/dev/spots.html?id=fremont-troll
```

Dev page parameters: `id` (spot id), `ov` (`day|sunset|dusk|night|dawn`), `hour` (local time at the spot),
`date` (ISO), `weather` (`clear|cloudy|drizzle|rain|snow|fog|storm`), `season`, `q` (quality), `walker=local`
(force the fallback walker), `at=x,z,bearing,pitch` (walker pose), `cam=x,y,z,bearing,pitch,fov` (free camera),
`fov`, `ui=0` (hide dev + spot UI), `hud=0` (hide the spot card/help), `manual=1` (no rAF loop; drive frames with
`spotDev.step(n, dt)` — used by the Playwright screenshots). `window.spotDev = { session, r3d, camera, setCam,
walkTo, step, photo, loadMs }`.

## API (contract in specs/01-architecture.md)

```js
import { SPOTS, loadSpot, startSpot, SpotSession, spotProgress } from './spots/index.js';

SPOTS // [{ id, city, area?, name, lat, lon, kind: 'walk', blurb, scene }]
const spot = await loadSpot(id, renderer?)   // → { scene, spawn, colliders, plaques[], dispose(), …extras }
const s = await startSpot(id, { r3d, camera, input, photo?, audio?, hud?, date?, override?, walker? })
loop: s.update(dt); r3d.frame(dt);
photo onPhoto(meta) → s.onPhoto(meta)        // crowd reactions + postcard challenge
photo getInfo()     → s.photoInfo()
s.teleport('chihuly')                          // another spawn of the same scene (seattle-center)
s.dispose()
```

`loadSpot` extras: `spawns{}`, `ground` (`heightAt`, `groundAt`), `groundAt(x,z,y)`, `env` (Renderer3D env),
`clock {lat, lon, timeZone}`, `lamps[]` + `lampHeadMesh` (for `r3d.setLamps`), `vegetation` (for
`r3d.setScene`), `crowd`, `interactables[]`, `challenges[]`, `updaters[]`, `nightHooks[]`, `sounds[]`, `tris`,
`timing`.

Source-backed surrounding terrain can expose its materials in `ctx.extras.sourceGroundMaterials`.
The loader adds them to `vegetation.groundMaterials` for the same weather/season treatment as the fine terrain;
they are not grass/crown materials and must not receive vegetation wind deformation.

`SpotSession` wires everything a host needs: `Renderer3D.setScene/setClock/setLamps` (real sun, weather and
season at the spot's lat/lon — spec 18), the walker (`OnFootController` from `src/onfoot.js` when present,
otherwise `walker.js` `LocalWalker` with the same interface), the crowd, the UI overlay (`ui.js`), the ambience
(`sound.js`), interactions (`E`), the postcard challenge, night lights (façade windows, neon, floodlights) and
telemetry (`spot_enter`, `spot_plaque`, `spot_postcard`, `spot_exit` via `window.cvTelemetry` when enabled).
Progress (postcards, coins, gum…) is kept in `localStorage['dmcv.spots.v1']`.

## Files

| File | What |
|---|---|
| `index.js` | `SPOTS`, `loadSpot`, `startSpot`/`SpotSession`, the `SceneContext` handed to scene modules |
| `scenes/<scene>.js` | one module per scene: `export default { env?, async build(ctx) }` |
| `tools/build-data.mjs` | research JSON + OSM extract + terrain grid → `game/data/spots/<scene>.json` (local metres) |
| `ground.js` | `Ground` (bicubic terrain, modifiers, walkable solids, deep-water blocking), `Painter` (ground splat), ground shader (brick / cobbles / slab joints / grass / asphalt detail), `buildTerrain` |
| `osm.js` | OSM ground painting, buildings with procedural façades + night windows + gable roofs, trees (season-tinted by render.js), street lamps, furniture, water |
| `kit.js` | `GeoBatch` (merged vertex-coloured meshes per material), shared materials, canvas text / textures, polygon + polyline maths |
| `sdf.js` | SDF primitives + surface-nets mesher + top-surface heightmaps (sculptures: Troll, Rachel, MoPOP, Piloti…) |
| `props.js` | neon / painted signs, lattice frames, clock faces, canopies, market stalls, fish, Great Wheel, Space Needle, skyline, mountains, totem poles, railings, `SEATTLE_TOWERS` |
| `backdrop.js` | Seattle far backdrop: Needle at its real position, downtown towers, city filler, Elliott Bay, Rainier / Olympics (weather-dependent visibility) |
| `people.js` | `Crowd`: instanced personas, path network walkers, group acts (watch / photo / pose / queue / sit / talk / perform / guide / throw), reactions + chat bubbles |
| `ui.js` | `SpotUI` (title card, prompt, plaque reader, toasts, challenge line, crosshair) + `BubbleLayer` + `plaqueMesh` |
| `sound.js` | `SpotSound`: procedural positional ambience (traffic, crowd, water, waterfall, wind, birds, gulls, crows, bells, market calls, bridge thumps) + one-shots |
| `cars.js` | light traffic loops + parked cars (vehicles.js models) |
| `walker.js` | collider spatial index, collisions, `LocalWalker` fallback |
| `buc.js` | Bucharest kit: `bucBackdrop` (eclectic / bloc / interwar façades, white centre lines, lanterns / candelabras, tree LOD), `classicFacade` + `classicWalls` (canvas façade tiles for heroes: arcades, arched / pedimented windows, pilasters, niches, brick-band stripes, floodlit at night), `balustrade`, `palisade`, `hedge`, `flagpole` (RO / EU / NATO, waving in the real wind), `placeLandmark` (landmarks.js models at their lat/lon), `floodlight`, `signAtlas` (all shop signs in one draw call), `oldTownTerraces` (pergolas + awnings + tables in front of OSM bars), `cityFiller` (blocks beyond the OSM extract) |
| `tools/fetch-buc.mjs` | Bucharest sources: Overpass OSM extract + EU-DEM terrain (OpenTopoData, opened to bare earth) per scene, cached in `$SPOTS_OSM_CACHE` (default `<tmp>/dmcv-spots-osm/buc`), never in git |

## Coordinates

Local metres: **x east, z south, y up**; origin = the scene origin in the data file (default: the first member
spot's research spawn); `y = 0` at `origin.elev` (metres above the research datum, NAVD88 for Seattle).
`ctx.ll(lat, lon) → {x, z}`. Headings: compass bearing → walker yaw with `headingFromBearing(deg)`.
Colliders use the `world.js` formats (polygon `{x,z,r,poly}`, oriented box `{x,z,angle,hw,hd}`, circle prop
`{x,z,r,hw:r,prop,h,y}`, wall segment `{wall,ax,az,bx,bz,y0a,y1a,y0b,y1b}`) and are indexed (`.query`).

## Adding a spot (e.g. Bucharest)

1. Add a `SCENES` entry in `tools/build-data.mjs` (`research: 'bucharest-spots.json'`, `osmDir: 'buc-spots'`,
   `tz: 'Europe/Bucharest'`; several spots may share a scene with `members`). Run the builder.
2. Add the `SPOTS` entries in `index.js` (`city: 'bucharest'`, `scene: '<scene>'`). `CITIES[city].env` is used.
3. Write `scenes/<scene>.js`:
   ```js
   export default {
       env: { fogFar: 4000 },                      // optional Renderer3D env overrides
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
           ctx.interactables.push({ x, z, r, label, use(session) })     // E actions (fun)
           ctx.crowdCfg = { personas, walkers, paths: ctx.footLines(), groups: [...] }
           ctx.sound(kind, x, z, radius, gain); ctx.onUpdate(fn); ctx.onNight(fn)
           ctx.spawns['<id>'] = { x, z, heading, pitch: 0 } // optional finite pitch in radians, clamped to native ±1.3
       },
   };
   ```
4. Check it in `game/dev/spots.html?id=<id>` (day, dusk, rain), compare with `game/research/refs/<dir>/` side by
   side, keep ≤ 1 M triangles (the dev stats show scene / drawn triangles) and load < 3 s.

Data caveats: the OSM extracts drop multipolygon inner rings (a lake around a park becomes one big polygon) — derive shorelines from the terrain grid (`g.mod((x,z,h) => h < level ? …)`) and let the water plane draw the water; linear waterways are painted as lines. Research coordinates (iconic photo points) can fall inside buildings or water: `loadSpot` moves spawns and challenge poses to the nearest dry spot; check them in the dev page.

## Bucharest

Scenes: `buc-parliament` (palace-parliament + peoples-salvation-cathedral), `buc-old-town` (old-town-lipscani +
stavropoleos-cec), `athenaeum-revolution`, `arcul-de-triumf`, `buc-herastrau` (herastrau-park + village-museum),
`spring-palace`, `cismigiu`. The research dossier (`bucharest-spots.json`) has its own schema: `build-data.mjs`
adapts it (`bucSpot`: spawn from `SCENES[].spawns`, extent from `footprint`, postcard from `photo_angle`, plaque
titles from `BUC_TITLES`; `bucDialogue`: persona lines → `{p, ctx, text (en), orig, lang}` plus `when` /
`wx` / `season` tags derived from the text — the crowd prefers lines that fit the spot's local time, the real
weather and the season). OSM + terrain are fetched by `tools/fetch-buc.mjs` (Overpass + EU-DEM; run automatically
by the builder when the cache is missing; needs `NODE_USE_ENV_PROXY=1` behind a proxy). Romania has no freedom of
panorama: every building and artwork is modelled (canvas façade tiles are drawn procedurally, never photos);
architects / sculptors are credited on the plaques. Heroes: own models for the Palace of the Parliament (OSM parts:
29 / 58 / 86 m tiers, east portico), the People's Salvation Cathedral (section-drawing heights, ribbed gilded
domes), Cărturești Carusel (enterable 5-level white atrium, E at the stair), Hanul lui Manuc (courtyard, gate),
Stavropoleos (porch, painted frieze, tower), Curtea Veche, the Dragomirești wooden church + peasant households,
Spring Palace (+ peacocks); landmarks.js models (floodlit) for Arcul de Triumf, Ateneul Român (frieze plate
"ATHENEUL ROMAN"), Palatul Regal, CEC, MNIR. New spots go to `DEV_SPOTS` (loadable in the dev page, not listed)
until verified, then move to `SPOTS`. Tree LOD: `ctx.treeLod = { cap, near, max }` (Bucharest scenes) keeps
the `max` trees within `near` m of the camera at full detail, the rest low-poly.

Rules (spec 15): artworks are modelled in 3-D from the research description (no photo textures) and credited on a
plaque; dialogue comes from the research (`spots[].dialogue`, translation under non-English lines); keep
deep water / dangerous structures unwalkable (Gas Works towers are fenced).

Old Town terrace furniture requires explicit OSM `outdoor_seating=yes`. A venue's name alone supplies a façade sign,
not a canopy, tables or seating. Dristor's mapped terrace remains; Shoteria's `outdoor_seating=no` frontage carries its
name and the three-action drink interaction without generated outdoor furniture. Sign colours remain procedural estimates.
Tourist floor probes honour `userData.noFloor` and visibility on ancestors, so unnamed vehicle parts never lift a person
onto a car roof. Traffic starts at its lane pose before crowd placement, and initial guides keep clear of postcard cameras.

Scene participation uses `activityFlow(ctx)` (`participation.js`): native 44 px buttons, E/Escape, explicit busy phases,
complete-only callbacks, and cleanup on map, travel, visibility and disposal. Hosts must call
`session.cancelActivities(reason)` before pause/photo/drone takeovers; this delegates the earlier Lipscani venue controller
as well. Camera rides set `cameraRide: true`; other locked activities retain mouse/touch look.

`boatRide` now requires repeated strokes. Each stroke visibly moves both oars, adds velocity and advances a validated water
course; drag stops an idle boat. The full return course is required for completion. Cișmigiu uses the mapped Debarcader
`n473428602`, a dry-bank approach and a 48 m course inside lake `w16292044`, away from mapped bridges. Course length and
boat appearance are gameplay estimates, not surveyed rental equipment. Rental hours remain unconfirmed; the seasonal
calendar is a gameplay approximation. July visit dates and the renderer's winter season drive the relevant availability.
Entrance history is read one fact at a time outdoors; it does not claim an accessible interior.

Seattle Center's Glasshouse, Loupe and passing Monorail exercises require manual looking and an explicit shutter;
short steady-frame gates prevent a button press or idle timer from awarding the view. Each belongs to its active shared
entry. The animated Needle elevator uses the shared Leave/mode cancellation flow. The unmodelled stair transfer and
instant open-air-deck visit award are retired. Kerry Park's city-lights activity requires an actual dusk/night capture.
Palace pacing counts continuous walking along its public-frontage game course; its endpoints are UI waypoints without
invented marker posts. Botanical Garden trail notes are explicitly virtual at mapped rooms and add no physical plant-label
hardware or reading-count award; its suspension-bridge award requires continuous walking on the existing bridge deck.
Walking courses register `onActivityCancel(ctx, cancel)` for host takeovers. `SpotSession.cancelActivities()` clears their
partial progress immediately when the host opens a mode that freezes scene updates; visibility listeners are disposed with
the scene. This covers Palace pacing, the ravine crossing, the promenade loop and an unfinished Carusel climb.
Drone altitude queries use `ground.flightHeightAt()`: actual terrain, reachable deck surfaces and the declared water level.
The walker's deep-water/steep-sculpture `y + 50` movement barrier remains confined to `groundAt()`.
