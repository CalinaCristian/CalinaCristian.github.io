# Tourist spots framework (spec 15)

Walk-only, high-fidelity bonus scenes built from the research dossiers (spec 20). Seattle 10 + Bellevue 4 are
done on this framework; Bucharest's 10 are added the same way (see *Adding a spot*). Owner role: **spots**
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
           ctx.spawns['<id>'] = { x, z, heading }
       },
   };
   ```
4. Check it in `game/dev/spots.html?id=<id>` (day, dusk, rain), compare with `game/research/refs/<dir>/` side by
   side, keep ≤ 1 M triangles (the dev stats show scene / drawn triangles) and load < 3 s.

Data caveats: the OSM extracts drop multipolygon inner rings (a lake around a park becomes one big polygon) — derive shorelines from the terrain grid (`g.mod((x,z,h) => h < level ? …)`) and let the water plane draw the water; linear waterways are painted as lines. Research coordinates (iconic photo points) can fall inside buildings or water: `loadSpot` moves spawns and challenge poses to the nearest dry spot; check them in the dev page.

Rules (spec 15): artworks are modelled in 3-D from the research description (no photo textures) and credited on a
plaque; dialogue comes from the research (`spots[].dialogue`, translation under non-English lines); keep
deep water / dangerous structures unwalkable (Gas Works towers are fenced).
