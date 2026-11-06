# 01 — Architecture, ownership, contracts

Static site, no build step, ES modules, Three.js r170 vendored (`game/vendor/`). Game entry `game/index.html` → `game/src/main.js`. Data from OpenStreetMap built offline by `tools/osm/` into `game/data/*.json`. Dev tooling: `npm run harness` (logic), `npm run harness:visual` (visual QA).

## Roles (agents) and file ownership
| Role | Owns (only these files) | Specs |
|---|---|---|
| **orchestrator** | `specs/*` structure, `STATUS.md` arbitration, commits, `public/*`, landing page (`index.html`, `index.css`, `index.js`, `canvas.js`), `game/src/telemetry-game.js`, `game/FEEDBACK.md` | all |
| **world** | `game/src/world.js`, `geobuild.js`, `buildings.js`, `cities.js`, `minimap.js`, `tools/osm/*`, `game/data/*` | 10 (data), 11, 12 |
| **gameplay** | `game/src/main.js`, `player.js`, `traffic.js`, `nav.js`, `hud.js`, `input.js`, `audio.js`, `data.js`, `onfoot.js` (new), `game/index.html`, `game/dev/harness/page/*` (autopilot only) | 10 (flow), 13, 14 |
| **cockpit-ui** | `game/src/vehicles.js`, `office.js`, `flight.js`, `photo.js` (new), `canvasText.js` (new), `game/style.css` | 16, 17 |
| **render** | `game/src/render.js`, `weather.js`, `game/dev/render.html`, `game/vendor/addons/*` | 18 |
| **landmarks** | `game/src/landmarks.js`, `game/dev/landmarks.html` | 12 (landmarks) |
| **spots** | `game/src/spots/*` (new), `game/data/spots/*` (new), `game/dev/spots.html` (new) | 15 |
| **qa** | `game/dev/harness/run.js`, `report.js`, `README.md`, `game/dev/harness/visual/*`, root `package.json` scripts | 19 |
| **research-*** | `game/research/*` only | 20 |

Shared files touched by several roles (`main.js` hooks for new modules) go through the **gameplay** role; others send the exact lines needed in their spec's *Requests* section.

## Contracts (keep in sync; update here first)
### World (`world.js`)
- `await buildWorld(city, renderer, { district } = {})` → `world`; without `district` loads the legacy corridor JSON `game/data/<city>.json`; with it loads `game/data/<city>-<district>.json`.
- `world.graph.{nodes, edges}` (main strongly-connected network), `world.allEdges`, edge fields: `id, a, b, dirx, dirz, len, nx, nz, name, type, lanesF, lanesB, lanes, oneway, laneW, median (negative on one-way), wR, wL, halfW, sidewalk, maxspeed, speed, tram, bridge, tunnel, layer, toll, busLane, roundabout, drivable, virtual, ya, yb`.
- Lane centre: lateral offset right of centreline `median/2 + laneW*(i+0.5)` (mirror for b→a).
- `world.nearestEdge(x, z, filter?, maxR?)`, `world.edgesInBox(...)`, `world.roadHeight(x, z, { y, edge } | edge?)`, `world.surfacesAt(x, z)`, `world.onRibbon(x, z, r)`, `world.ribbons`.
- `world.buildings` (+ `.query(x, z, r, cb)`), `collideBuildings(list, x, z, r, y?)` export, `world.walls[] {ax,az,bx,bz,y0a,y1a,y0b,y1b,nx,nz,kind,edge}`.
- `world.pois[] {id, kind, label, brand, x, z, doorX, doorZ, cv, interactive, ...}`; CV stop ids: `rosetti, upb, gts, luxoft, db, arnia, uipath-buc, otopeni, seatac, uipath-bel`.
- `world.lamps[] {x,z,h,rot,y}`, `world.lampHeadMesh`, `world.vegetation {treeCrownMeshes, treeTrunkMeshes, deciduousMask, grassMaterials, groundMaterials, roofMaterials}`.
- `world.trafficProfile(hour, { cls, weekend })`, `world.audit({max})`, `world.devCheck()`, `world.spawn {x,z,heading,y}`, `world.scale`, `world.bounds`, `world.district`, `world.city.{center,timeZone}`.
- Districts (world, 2026-11-07): `buildWorld(city, renderer, { district, start })` (or `city.activeDistrict` / `city.activeStart` set before the legacy call); `world.spawn` = the chapter start on a legal lane facing `start.heading`. `world.district = { id, name, label, bbox, center, landmarks, congestion, areaKm2, ends[{x,z,node,edge,kind,heading}], inside(x, z) }`; `node.mapEnd === true` on roads cut at the boundary (SCC treats them as connected through the outside). `world.closures[] = { x, z, heading (facing the closure), edge, node, kind: 'small'|'boulevard'|'highway', leadsTo: districtId|null }`; walls `kind:'closure'` (flag `soft: true`) across each cut road + `kind:'boundary'` (invisible, along the playable-area outline). CV POIs with `passing: true` (e.g. `plaza-center`) are non-interactive captions (`poi.caption`). Props of the closures are colliders of `kind:'closure'`.
### Cities (`cities.js`)
- `CITIES[city].districts = { id: { name, label, bbox:[minLat,minLon,maxLat,maxLon], center:{lat,lon}, landmarks:[ids], congestion:[{lat,lon,radius,hours:[[h0,h1],...],level,note}] } }`.
- `export const CHAPTERS = [{ id, stop, city, district, year, title, intro, start:{lat,lon,heading?} }]` in story order (see spec 10).
### Render (`render.js`)
- `new Renderer3D(canvas, {quality})`, `.renderer`, `setScene(scene, camera, env, {sky, units})`, `setPlayer(p)`, `setClock({date,lat,lon,timeZone,override,timeScale})`, `setLamps(lamps,{headMesh})`, `setVegetation(v)`, `setHeadlights(bool|null)`, `setWeather(kind|null)`, `setSeason(s|null)`, `setLampLightsEnabled(b)`, `frame(dt)`, `resize(w,h)`, `setQuality(q)`; state `phase, sunElevation, nightLights, headlightsOn, weather, stats`; callbacks `onNightLights, onWeatherChange, onThunder`.
### Cockpit (`vehicles.js`)
- `makeVehicle(kind, color)` (forward −z, `userData.length/width/setLights/flash`), `makeCockpit()` → `userData.{wheel, screen (MeshBasicMaterial; map set by nav), updateGauges(speedMs,rpm01,fuel01,mph), setRain, setNightGlow, driverSeatBack, rearCabin, headlights}`.
- (2026-11-06, cockpit-ui) `makeCockpit().userData` also has: `cluster` (gauge plane), `hood`, `windshield`, `wiperState`, `tick(dt)`, `setInteriorLight(k)`, and `mirrorMount = { position, quaternion, width, height, camPosition, camRotation, camFov }` (where player.js should put the rear-view mirror glass + its camera). **All visible cockpit meshes are on layer 1** (main camera renders 0+1 via render.js; the mirror camera renders layer 0 only, so it never sees the car). Raycasts against the cockpit need `raycaster.layers.enable(1)`. The cockpit layout assumes the driver eye at rig (−0.3, 1.36, −0.45) and a main-camera near plane ≤ 0.2 m.
### Canvas text (`canvasText.js`, new, cockpit-ui)
- `fitText(ctx, text, maxWidth, {maxSize, minSize, maxLines, maxHeight, lineHeight, font(size), label})` → `{size, font, lines[], fits}` (largest size / fewest balanced lines that fit; hard-wraps + ellipsizes as a last resort, so it never overflows); `drawFitText(ctx, text, x, y, maxWidth, opts)` draws the block centred on y. Fits needing > 2 lines or not fitting are pushed to `fitTextLog` (`window.fitTextLog`) and logged with `console.info('[fitText] …')`. Use it for every canvas text.
### Photo (`photo.js`, new)
- `class PhotoMode { constructor({renderer, getScene, getCamera, hud, audio, input}); open(); close(); get active(); update(dt) }`.
### On foot (`onfoot.js`, new)
- `class OnFootController { constructor({scene, camera, input, colliders, world?}); enter(x, z, heading, y); exit(); update(dt); get position(); }` — reused by tourist spots.
### Spots (`spots/*`, new)
- `loadSpot(id, renderer) → { scene, spawn, colliders, plaques[], dispose() }`; `SPOTS = [{ id, city, name, lat, lon, kind:'walk', blurb }]`.
### Telemetry
- `window.cvTelemetry.track(event, props)` (no-op unless enabled). Game state read by `telemetry-game.js`: `game.state, game.city.id, game.visited, game.office, game.stats, game.headlights, game.hud.unlocked, game.r3d.stats, game.r3d.weather, game.chapter`.
