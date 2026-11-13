# 01 — Architecture, ownership, contracts

Static site, no build step, ES modules, Three.js r170 vendored (`game/vendor/`). Game entry `game/index.html` →
`game/src/main.js`. Every map is a 1:1 chapter district built offline from OpenStreetMap by `tools/osm/` into
`game/data/<city>-<district>.bin.gz` (decoded by `game/src/district-pack.js`). **The data format is documented only in
[`game/data/README.md`](../game/data/README.md)**; this file covers modules and the APIs between them. Tests and tools:
README.md → Tests and QA, spec 19.

## Roles and file ownership
| Role | Owns | Specs |
|---|---|---|
| **orchestrator** | `specs/*` structure, `public/*`, landing page (`index.html`, `index.css`, `index.js`, `canvas.js`), `game/src/telemetry-game.js`, `telemetry-health.js`, `handoffs/fidelity/BACKLOG.md` | all |
| **world** | `game/src/world.js` and the builder modules it imports (roads, bridges, buildings, facades, water, trees, props, boundary), `geobuild.js`, `buildings.js`, `cities.js`, `minimap.js`, `worldmap.js`, `tools/osm/*`, `game/data/*` | 10 (data), 11, 12 |
| **gameplay** | `game/src/main.js`, `player.js`, `traffic.js` and its `initial-*` / `tram-*` / `signals.js` / `shared-lanes.js` modules, `nav.js`, `hud.js`, `input.js`, `audio.js`, `data.js`, `onfoot.js`, `chapters.js`, `explore.js`, `drone.js`, `football.js`, `basketball.js`, `inspection.js`, `modal-controls.js`, `game/index.html`, `game/dev/harness/page/*` (autopilot) | 10 (flow), 13, 14 |
| **cockpit-ui** | `game/src/vehicles.js`, `office.js` and `office-*.js`, `flight.js`, `transition.js`, `finale.js`, `photo.js`, `canvasText.js`, `crowd.js`, `game/style.css` | 16, 17 |
| **render** | `game/src/render.js`, `weather.js`, `water.js`, `cockpit-displays.js`, `progressive-pmrem.js`, `game/dev/render.html`, `game/vendor/addons/*` | 18 |
| **landmarks** | `game/src/landmarks.js`, `landmark-*.js`, `game/dev/landmarks.html` | 12 (landmarks) |
| **spots** | `game/src/spots/*`, `spot-availability.js`, `game/data/spots/*`, `game/dev/spots.html` | 15 |
| **qa** | `game/dev/harness/run.js`, `report.js`, `README.md`, `game/dev/harness/visual/*`, root `package.json` scripts | 19 |
| **progression** | `game/src/achievements.js`, `save.js`; the `ACHIEVEMENTS` block in `data.js`; the `/* achievements */` block in `style.css`; hook lines in `hud.js` and `main.js` coordinated with gameplay | 23 |
| **research-\*** | `game/research/*` only | 20 |

Shared files touched by several roles (`main.js` hooks for new modules) go through **gameplay**.

## Contracts (keep in sync; update here first)

### World (`world.js`)
- `await buildWorld(city, renderer, { district, start, deferGround })` → `world` for `game/data/<city>-<district>.bin.gz`
  (`fetchDistrictPack`: gunzip + `decodeDistrictPack`; long cache signatures compared with `signatureMatches`). Node tools
  read packs with `tools/osm/district-data.mjs` `readDistrictData`.
- Pure passes run in module workers (`build-pool.js` / `build-worker.js`, one pool per page): pack parsing, inferred-detail
  clipping against neighbouring roofs (shared `triangulate.js`), the fallback ground (`fallback-partition.js`), overlap
  cuts, bridge deck shaping (`bridge-height-models.js`) and source roofs. Workers run the same functions on the same
  numbers, so the world is bit-identical with or without them; any worker failure falls back to the main thread.
- `opts.deferGround`: `buildWorld` returns before the fallback ground is placed and `world.ready` resolves when it is
  (main.js awaits it before the first frame). `landmarks.js` / `archetypes.js` are prefetched when `world.js` loads;
  `Renderer3D.prewarmEnvBake()` compiles the environment bake while idle; `Game.prefetchDistrictPacks()` warms the HTTP
  cache with the saved session's and the next chapter's packs while the menu is open.
- Graph: `world.graph.{nodes, edges}` (main strongly-connected network), `world.allEdges`; edge fields `id, a, b, dirx,
  dirz, len, nx, nz, name, type, lanesF, lanesB, lanes, oneway, laneW, median (negative on one-way), wR, wL, halfW,
  sidewalk, maxspeed, speed, tram, bridge, tunnel, layer, toll, busLane, roundabout, drivable, virtual, ya, yb`, plus
  `sidewalkRightM`, `sidewalkLeftM`, `sidewalkSource`, `sharedLane`, `lidded` (a tunnel deeper than 4.5 m along its whole
  length: only those get a ceiling, lid and portals).
- Lane centre: lateral offset right of the centreline `median/2 + laneW*(i+0.5)` (mirror for b→a).
- Queries: `world.nearestEdge(x, z, filter?, maxR?)`, `world.edgesInBox(...)`, `world.roadHeight(x, z, { y, edge } | edge?)`,
  `world.surfacesAt(x, z)`, `world.walkTop`, `world.onRibbon(x, z, r)`, `world.ribbons`, `world.sidewalkWidth(edge, side)`
  (`side` +1/−1 = right/left of `a→b`; pedestrians, furniture and roadside parking must use it; `edge.sidewalk` is the
  aggregate fallback).
- Static bodies: `world.buildings` (+ `.query(x, z, r, cb)`, records carry `holes` and optional `sourceId`),
  `collideBuildings(list, x, z, r, y?)` export (hole-aware), `world.walls[] {ax,az,bx,bz,y0a,y1a,y0b,y1b,nx,nz,kind,edge}`.
- `world.pois[] {id, kind, label, brand, x, z, doorX, doorZ, cv, interactive, …}`; CV stop ids `rosetti, upb, gts,
  luxoft, db, arnia, uipath-buc, otopeni, seatac, uipath-bel`. CV POIs with `passing: true` (e.g. `plaza-center`) are
  non-interactive captions (`poi.caption`). A CV POI hosted by a landmark (`poi.landmark`) gets a facade sign
  `poi.landmarkSign = {x, z, y, nx, nz, w, h}` unless the landmark has `ownSign`.
- `world.lamps[] {x,z,h,rot,y}`, `world.lampHeadMesh`, `world.vegetation {treeCrownMeshes, treeTrunkMeshes, deciduousMask,
  grassMaterials, groundMaterials, roofMaterials, trees[], update(x, z)}` (`update` refills the near tree LOD; crowns are
  near meshes `treeCrowns near <shape>` plus far chunks `treeCrowns <i,j> broadleaf|conifer far`). Tree species:
  `trees.js` (`buildSpeciesTrees`, `treeGeometries`, `SPECIES`, `speciesFromOSM`, `defaultSpecies`).
- `world.trafficProfile(hour, { cls, weekend })`, `world.audit({max})`, `world.devCheck()`, `world.spawn {x,z,heading,y}`
  (the chapter start on a legal lane), `world.scale`, `world.bounds`, `world.city.{center,timeZone}`, `world.landmarks[]`
  (with `mesh`), `world.stats`.
- District: `world.district = { id, name, label, bbox, center, landmarks, congestion, areaKm2, ends[{x,z,node,edge,kind,
  heading}], inside(x, z), mask, flightBoundary }`. `node.mapEnd === true` on roads cut at the boundary.
  `world.closures[] = { x, z, y, top, heading, edge, node, kind: 'small'|'boulevard'|'highway', leadsTo }`; walls
  `kind:'closure'` (`soft: true`) across each cut road and `kind:'boundary'` (invisible) along the outline.
  `district-boundary.js` derives the mask from the kept source road support plus the cockpit's circumradius; it feeds
  `inside`, player bounds, minimap containment and the wall outline. Closure warnings, soft-impact classification and
  crew chatter use the closure's own level band, so a closure under a bridge never affects the deck.
- Building materials (`solid`) are `MeshStandardMaterial` with `userData.nightEmissive`. Flat cell layers merge into
  500 m / 1 km super-cell meshes named by prefix (`ground`, `road`, `junction`, `marks`, `signs`, …); parked cars are
  `makeParkedCars` groups per cell. Merged solid/roof meshes keep their cell index spans: `cullMergedCells` selects spans
  per main, mirror and shadow camera; the mesh's raycast temporarily restores the full index. Large water is grouped
  into 500 m meshes (`world.waterMesh` may be a Group) and batched per camera; no source surface is removed for budget.
- Fountain basins unregister from the shared animation registry on `dispose`; disposing one scene never unregisters
  another scene's basins.
- Landmark colliders carry `landmark: '<id>'`, optional model-local vertical bands `h/y0/y1` (offset by the landmark base
  elevation) and optional exact `poly` / `holes` (rotated and scaled with the mesh; never replaced by their bounding box).

#### Source-preserving geometry
- Source roads keep every original vertex and legal direction; `roadAccess` separates public/through legality from
  physical geometry; reviewed `roadWidths` win over class defaults, positive OSM width/placement wins over everything;
  `laneCenterShiftM` is relative to the edge's right vector.
- Shared physical lanes: edges from `sharedLanes` keep two legal directions with `sharedLane: true` and one carriageway.
  `SharedLaneGate` admits one direction at a time through connected narrow sections (reserve before the mouth, hold until
  the rear clears, then give the waiting side priority).
- Turn lanes: `turn-lanes.js` resolves `world.data.turnLanes` per edge; mapped lane roles constrain route continuations,
  turning cars keep their approach lane through the junction, straight lane drops still merge ahead; unknown roles never
  create a prohibition. `motor-turn-restrictions.js` is the shared node-via policy for GPS and traffic, reading
  `roadRestrictions`; unknowns stay explicit and no joins are added.
- Source sidewalk sides: `sourceSidewalkSides(data, edge)` resolves `sidewalk:left/right` before `sidewalk:both` / `sidewalk`
  on the source way's direction; `sidewalk=separate` suppresses inferred pavement. Raised pavement, kerbs, `raisedTop`,
  surface queries and pedestrian placement share that decision.
- Buildings: precise outer rings, courtyards and every positive-area source identity survive; physical surface ownership
  (`buildingUnions`) deduplicates rendering without deleting records; only listed landmark source IDs are replaced by
  authored models (`ctx.sourceBuildings` gives their rings, holes and dimensions). `buildingCoveredBy` renders a fully
  covering ground-based part once. `buildingRoofProfiles` separates total top, eaves and rise; literal OSM heights stay
  exact. Inferred detail is clipped only against complete neighbouring source roof planes. Invalid caches fall back to
  source bodies with recorded reasons.
- Covered roads: `buildCoveredRoadModels(data).useNativeRibbons(ribbons)` runs before `configurePassages`; it accepts only
  the reviewed covered way and its literal ground joins, uses the actual asphalt polygons, and withholds the opening on
  any width contradiction or unknown profile. Reviewed fuel-canopy drives (`reviewed-source-fuel-canopy-covered-road`)
  stay at surface level: a negative layer under an open roof is ordering, not a metre depth.
- Underpasses: `underpass-roof.js` closes a true tunnel's covered span with a positive estimated slab (min 0.25 m) under
  the lowest overhead skin; ceiling, fascia and portal share one mitred section; ramps stay open; legal `maxheight`
  stays a separate constraint. The roof top writes depth only (no colour) after flat ground, so lawns and paving above
  stay visible. `final-water-topology.js` gives the roof pass the same final small-water geometry the renderer uses; a
  raw big-water intersection stays unresolved.
- Bridges: scenery bridges keep source vertices, widths and tags; heights other than exact same-source ties are model
  estimates, recorded in `scenerySourceAudit.bridges.unresolved`. Passive slabs expose `roofHeightAt(x,z,radius)` and
  `minHeightAt(x,z,radius)` and create no traffic connections. `bridge-junction.js` adds the missing underside of an
  elevated bridge-only fork pad (`source-bridge-junction-slab` collider with exact top/bottom triangles); no wall is placed
  across a road mouth. `generated-parapet-ownership.js` lets an earlier emitted bridge cap own later inferred separation
  faces inside it; source and physical guards are always kept.
- `rail-roadside.js`: inferred shoulders, sidewalk underlays and bridge margins yield to a known flat tram corridor (actual
  emitted fleet bounds), outside the protected lane polygon; inferred crossing paving drops to the shared ground surface;
  mapped footways, areas and furniture are never edited. Results in `stats.railRoadside`.
- Transit shelters: `source-transit-shelter.js` classifies only the generic shelter unit. A `stop_position` /
  `railway=tram_stop` is a vehicle location, never a roof anchor; without validated geometry the guessed shelter and its
  colliders are withheld and reported unknown; literal `shelter=no` wins. Decisions in `poi.shelterModel` and
  `stats.transitShelters`.
- Return corridors (`district.sourceReturns`): reviewed raw way/node legs compiled before clipping, each join, direction
  and restriction validated; they create no runtime connector. Boundary walls protect the whole retained road at its
  level. A domain rebuild may keep reviewed prior fallback building models pinned in `source-context-<city>-<district>.json`;
  new source or research evidence wins.
- Surface lots: full vehicle footprints must clear lot boundaries (`parkingFootprints`, `parkingLayouts`), raised
  sidewalks and ground-level buildings; source locations are never moved to fit.

#### Source rails
- `world.data` exposes rail source records independently of the motor graph (`tramSources`, `tramSourceWays`,
  `tramRoutes`, `tramSourceNodeTags`, `tramSourceCrossings`; format in `game/data/README.md`). The rail runtime
  (`tram-path.js`) builds directed paths joining only identical source node IDs; a nearby road, crossing or median never
  creates rail connectivity or travel rights. Rail edges expose `publicTram` / `throughTram` separately from motor access
  (`publicDrive: false`); traffic rejects a non-tram actor on a rail edge.
- `world.tramGrade(way, {a, b, index, len})` → `{known, ya, yb, heightAt?, basis, estimated, provenance}`: one model for
  physical rail sampling and rendered rail/support geometry, as displacements from the road datum. Layer tags never
  supply metres. `world.tramDeckSupportAt` exposes the rendered support pieces (`.at(...)`, `.inBox(...)`); tram body
  fitting (`tram-body-support.js`) derives pitch and clearance from the actual emitted mesh, and a static admission
  exception applies only to the tram's own identified support slab.
- `buildTramSourceSignals` (`tram-source-signals.js`): a source rail node may reference a physical signal through literal
  crossing-footway context (`sourceSignal`, separate from `motorNode`); controlled-crossing flag 8 keeps a standalone
  pedestrian controller at its node; a signalized `railway=tram_crossing` without mapped tram heads is recorded in
  `pedestrianControlled` (pedestrian control, not a tram red phase). Timings are the game's synthetic ones.

### Cities (`cities.js`)
- `CITIES[city].districts = { id: { name, label, bbox:[minLat,minLon,maxLat,maxLon], center:{lat,lon}, poly?, bands?,
  circles?, landmarks:[ids], scenery?:[ids], congestion:[{lat,lon,radius,hours:[[h0,h1],…],level,note}] } }` (playable
  area fields: `game/data/README.md`).
- `export const CHAPTERS = [{ id, stop, city, district, year, title, intro, start:{lat,lon,heading?,road?}, waypoint?,
  montageCaption? }]` in story order (spec 10). `waypoint {lat, lon, label}` for chapters without an office;
  `montageCaption` is the travel the montage into this chapter stands for.
- `game/data/places.json` (built by `tools/osm/places.mjs`) feeds `MiniMap.places`, `.legend`, `.landmarks` (reachable
  only); `MiniMap.drawsOutside === true`, `legendHit(px, py)`, `onChange`.

### Render (`render.js`)
- `new Renderer3D(canvas, {quality, toneMapping?, reverseDepth?})`, `.renderer`, `setScene(scene, camera, env, {sky,
  units})`, `setPlayer(p)`, `setClock({date,lat,lon,timeZone,override,timeScale})`, `setLamps(lamps,{headMesh})`,
  `setVegetation(v)`, `setHeadlights(bool|null)`, `setWeather(kind|null)`, `setSeason(s|null)`, `setLampLightsEnabled(b)`,
  `frame(dt)`, `resize(w,h)`, `setQuality(q)`; state `phase, sunElevation, nightLights, headlightsOn, weather, stats`;
  callbacks `onNightLights, onWeatherChange, onThunder`.
- `advanceEnvironment(dt, {camera, cockpit=true, cull=true})` advances only the retained scene environment (no draw, no
  actors, no FPS sample). Office windows call it with their own camera, `cockpit:false`, `cull:false`.
- Diagnostics: `stats.frameMs` is the last visible frame interval and `stats.fps` averages real intervals over ≥ 0.5 s,
  independent of the simulation dt; a new scene or hidden tab resets sampling.
- Lighting: AgX tone mapping by default; ambient is a `THREE.LightProbe` (`r3d.probe`), so scenes must not add their own
  hemisphere/ambient lights (`setScene` removes them). Optional `env.ambientCity`, `env.groundAlbedo`, `env.wallAlbedo`.
- **Night-lit materials**: any material with `material.userData.nightEmissive = <emissiveIntensity at full night>` (and an
  `emissive` colour / `emissiveMap`) found at `setScene` / `setVegetation` (or listed in `vegetation.nightMaterials`) gets
  `emissiveIntensity` eased 0 → value at dusk.
- Fog is aerial perspective: `scene.fog` stays a `THREE.FogExp2` whose `density` is the ground-level extinction (3.912 /
  visibility m, `r3d.weather.visibilityM`) with a 1.1 km haze scale height. `env.edgeM` (or a spot `fogFar ≥ 2500`) sets
  a minimum haze hiding a scene's edge.
- Weather/season patch targets: materials named `road`, `junction`, `markings` or meshes `road|junction|ground|marks i,j`
  (wet, puddles, lamp reflections, snow), `groundPlane` / `landuse` / `paved-areas`, `grass`, `roofs`, instanced
  `treeCrowns …`; crown patching needs `#include <begin_vertex>` / `<color_fragment>` (Lambert/Standard).
- Depth: conventional 24-bit by default (`reverseDepth: true` opts in). Keep camera near ≥ 0.2 m.
- Environment reflections build in bounded progressive PMREM slices (`progressive-pmrem.js`), keeping the old atlas until
  done.
- `CockpitDisplays` (`cockpit-displays.js`) redraws the cluster and nav screen after post-processing at a bounded output
  DPR with scene-depth occlusion, sharing the display geometry/materials; `Renderer3D.displayStats` reports the added
  work, which counts in the frame budget.

### Water (`water.js`)
- `makeWaterMaterial({ deep, shallow, flow:[x,z], wave, ripple, foam, roughness, transparent, opacity, envIntensity })` →
  patched `MeshStandardMaterial` (name `water`); `subdivideWater(geometry, maxEdge=4)`; `computeShoreDistance(geometry,
  { maxD, material })` → `aShore` (enables foam). render.js drives time and env (`tickWater`, `setWaterEnv`).

### Cockpit, fleet and crowd (`vehicles.js`, `crowd.js`)
- `makeCockpit()` → `userData.{wheel, screen, updateGauges(speedMs,rpm01,fuel01,mph), setRain, setNightGlow,
  driverSeatBack, rearCabin, headlights, cluster, hood, windshield, wiperState, tick(dt), setInteriorLight(k), mirrorMount,
  viewFor(aspect)}`. **All visible cockpit meshes are on layer 1** (the main camera renders 0+1, the mirror camera layer 0
  only); raycasts against the cockpit need `raycaster.layers.enable(1)`. Driver eye at rig (−0.3, 1.36, −0.45).
- `makeVehicle(kind, color, opts = {})` (forward −z, ground y 0) → `userData.{length, width, height, kind, city, transit,
  setLights, flash, setBrake(on|null)}`. `opts.city` `'bucharest'|'seattle'` (default `setFleetCity(cityId)`);
  `opts.instanced: true` draws every vehicle of a kind through shared `InstancedMesh`es filled in a chained
  `THREE.Scene.prototype.onBeforeRender` hook (do not replace `scene.onBeforeRender` on such scenes); `opts.lod: 'parked'`
  gives the cheap two-mesh model. Brake lights are automatic from motion (`userData.parked = true` disables).
- Kinds: `VEHICLE_KINDS` (cars, `taxi`, `police`, `stb-bus`, `trolleybus`, `tram-v3a`, `tram-imperio`, `kcm-bus`,
  `kcm-artic`, `bus` city alias). Helpers `fleetMix(cityId)`, `pickFleetKind`, `pickTransitKind`, `fleetColor`,
  `vehicleSize`, `vehicleTriangles(kind, 'near'|'far'|'parked')`, `setFleetOptions`, `fleetStats`,
  `makeParkedCars(cars, opts)` (one static `InstancedMesh` per kind; build one group per cell), `addPreRenderHook(fn)`,
  `getVehicleEnvMap()`. `sourceVehicleDimensions(actor)` measures emitted upright geometry for clearance checks.
- `makeCrowd({ max, city, season, weather, rng, castShadow })` → instanced pedestrians in 2 draw calls: `crowd.object`,
  `crowd.count`, `crowd.set(i, { x, y, z, yaw, phase, amp, scale, down?, fallDir?, pose?, prop? })`, `crowd.hide(i)`,
  `crowd.dress(i, outfit|null)`, `crowd.setWeather(kind)`, `crowd.stats`, `crowd.dispose()`. `dressFor(cityId, season,
  weather, rng, kind)`, `CROWD_FLAGS`, `CROWD_POSES` (incl. `sit`, `phone`, `photo`, `wave`, `point`, `flag`, `talk`,
  `guitar`, `umbrella`, `cheer`, activity-owned `throw` / `catch`), `seasonOf(date)`, `setCrowdOptions`,
  `crowdTriangles()`. `pose` and `prop` persist until the next `set` with that key.

### Canvas text (`canvasText.js`)
- `fitText(ctx, text, maxWidth, {maxSize, minSize, maxLines, maxHeight, lineHeight, font(size), label})` → `{size, font,
  lines[], fits}`; `drawFitText(ctx, text, x, y, maxWidth, opts)`. Fits needing > 2 lines or not fitting go to
  `window.fitTextLog`. Use it for every canvas text.

### Office, transition, flight, finale, touch
- `new Office(renderer, camera, stop, hud, input, audio)` tells a linear CV story: `E` starts/resumes, Enter/Space or
  Continue advances, Esc / close pauses; only the final Continue sets `conversationComplete` and `done`, which advances the
  chapter. `read` holds fully presented section indices; `cv-answer {stop,index,title,part,first}` events keep the
  persisted achievement keys. Office teardown preserves an active loading/menu transition.
- Office windows: `office-window-service.js` owns one HDR target and a camera on the retained district (never a World,
  actor or clock); main advances the retained clock/traffic once per frame while visiting. `office-window-binding.js`
  requires the room's eye envelope and pane projection to fit the literal source building ring; floors come from
  `office-floors.js` (`officeFloorElevation`). Mismatches, unknown heights and the UiPath Bucharest A/B conflict show an
  unavailable view; every view is an estimated room view, never an identified real window.
- `playChapterTransition({ cityName, districts, from, to, year0, year1, title, caption, kicker, travel, via, water, card,
  fromStop?, toStop?, globe?, audio?, duration? }) → Promise` (`transition.js`).
- `playFlight({ from, hud, audio, texts })`, `drawGlobe(ctx, {...})`, `slerpLL`, `ortho`, `drawPlane`, `OTP`, `SEA`
  (`flight.js`; Natural Earth in `geo-ne110.js`).
- `showFinale({ profile, stops, stats, actions: {cv?, worldmap?, spots?, replay?}, onAction }) → Promise<actionId>`.
- Touch (`input.js`): left half steers / floating thumbstick, right half looks, analog pedals while driving;
  `input.touch.stick {x, y, mag, active}`, `input.setTouchMode('drive'|'foot'|'drone'|null)`, `input.touchModeNow`.
- `modal-controls.js` gates host launchers (`Game.syncModalControls()` each frame): `body.ui-modal` for full modals,
  `body.ui-activity` during activities (global launchers hidden, tour Skip/End and the activity panel usable). Closed
  title-menu overlays must never take pointer/touch hits.

### Photo, on foot, chapters, traffic
- `class PhotoMode { constructor({renderer, getScene, getCamera, hud, audio, input}); open(); close(); get active();
  update(dt) }`.
- `class OnFootController { constructor({scene, camera, input, colliders, world?, traffic?, audio?, obstacles?,
  groundAt?}); enter(x, z, heading, y); exit(); update(dt); teleport(x, z, heading?); get position(); fx, fz, speed,
  active }`, reused by tourist spots; harness hook `auto = {fwd, side, heading, run, jump}`.
- Chapters (`chapters.js`): `chapterCard({done, next, index, total})`, `chapterMontage({cityName, districts, from, to,
  year0, year1, title, caption, kicker, travel, via})`, `loadProgress()` / `saveProgress()`; game `game.chapter`,
  `game.chapterIdx`, `game.goToChapter(i)`, `game.completeChapter()`, `game.progress.{reached, done}`. main.js passes
  `ch.montageCaption` as `travel` and `MONTAGE_VIA[ch.id]` (data.js) as `via`.
- Free roam (`explore.js`): `game.freeRoam`, `game.explore.roam(district)`, `game.explore.resumeStory()`; saves store free
  roam as `mode: 'explore'`. `travelConditions()` returns `{tod, weather, season}`; district and city travel keep them
  unless the caller overrides.
- Traffic: `traffic.setCongestion([{lat, lon, radius, hours, level}], proj)`, `traffic.jamAt(x, z)`,
  `traffic.jamOverride`, `traffic.walker`; transit from `VEHICLE_KINDS` / `fleetMix` and `TRANSIT` / `TRANSIT_RE`
  (data.js): edges `e.trolleyWire`, `e.busRoute`, vehicles `v.bus`, `v.trolley`, `v.tram`, `traffic.transit`. Cars never
  use the outermost lane of a `busLane` edge.
- Initial admission: `admitInitialTraffic(traffic)` (`initial-traffic-admission.js`, planning in
  `initial-vehicle-admission.js`) runs after `spawnAll`, before pedestrians and the first frame; it keeps actor arrays,
  IDs, fleet and RNG, repairs only through accepted source stations (bounded transactional packing with rollback) and
  records everything in `traffic.initialAdmission`; it is refused once physics has started. Initial parking
  (`initial-parking-behavior.js`, `T.initialParking`) admits a parked pose only with legal, supported, clear placement;
  otherwise the same car drives on its lane. `initial-ordinary-source-span.js` lets a car's body span a degree-two shape
  point of the same source way when the whole body stays on actual asphalt. Trams bind to source-legal rail poses before
  publication (`traffic.initialTramBinding`).
- `Game.loadCity` places the player at the new spawn before `traffic.setPlayer` and `clearForPlayer`, before
  `attachWorldRender`.
- Route clearance: `roadClearancePolicy` / `assessRoadClearance` keep source height/width limits with their units and
  unknowns; GPS and NPC route choices exclude known violations for the actual vehicle (`nav.sourceVehicle = player`).
- Pedestrian relocation may index the unchanged peer population for one candidate search
  (`pedestrian-relocation-peers.js`); candidate order, RNG draws and every physical rule stay the same. A vehicle waiting
  beside a crossing pedestrian moves only when its next body pose increases clearance.

### Landmarks (`landmarks.js`)
- `LANDMARKS[] {id, city, name, lat, lon, rotation, osmNames, radiusM, sourceIds?, backdrop?, cvStop?, passing?, hero?,
  districtOnly?, floodlit?, ownSign?, masonry?}`; `buildLandmark(lm, ctx)` → `{mesh, collision[], triangles, clear,
  clearM, authoredScale}`. Models are authored in real metres; world uses `lk = proj.scale / authoredScale`,
  `R = radiusM · proj.scale`. `translatedLandmarkCollider` gives tourist scenes the same polygons and bands.
- `cvStop: '<poi id>'` / `passing: 'plaza-center'`: the CV POI whose door the model hosts (→ `poi.landmark`).
  `ownSign: true`: the model carries its real entrance and tenant plate; world skips `poi.landmarkSign`.
- `floodlit: true` builds masonry with the shared `landmark-floodlit` material (`userData = { nightEmissive: 1.1,
  nightGlow: 1.1, dayGlow: 0, floodlit: true }`, see Night-lit materials); do not clone it (a clone drops the per-vertex
  patch). `buildLandmark(lm, { floodlit: false })` opts out.
- Fountains: jets in `fountain-jets` (`landmark-fountain-jets`), basin water `landmark-fountain-water`, shader-animated;
  `fountainSchedule(date)` (May–Oct 10:00–23:00 Bucharest time, Simfonia Apei Fri–Sun 21:00–21:45 May–Sep, drained
  Nov–Apr); overrides `FOUNTAIN_STATE.mode` / `?fountains=on|off|show`; winter forces off.
- Dinamo: `mesh.userData.footballPitch = {center, axis, halfLength, halfWidth, goalHalfWidth, goalHeight, playArea}` in
  model-local coordinates (consumers use `mesh.localToWorld`); boundary walls are clipped only inside `playArea`.

### Spots (`spots/*`)
- Module API, dev page and files: [`game/src/spots/README.md`](../game/src/spots/README.md); requirements: spec 15.
- `loadSpot(id, renderer) → { scene, spawn, colliders, plaques[], dispose(), …extras }`;
  `startSpot(id, { r3d, camera, input, photo?, audio?, date?, override?, onProgress? }) → SpotSession` (`update(dt)`,
  `onPhoto(meta)`, `photoInfo()`, `teleport(spotId)`, `openMap()`, `startTour()`, `endTour()`, `skipTourStop()`,
  `objectives()`, `setConditions(options)`, `cancelActivities(reason)`, `dispose()`).
- `spot-availability.js` is the shared pure contract for menu order (`MENU_ORDER`, `MENU_AVAILABLE`), recommendations, park
  grouping, retired activities and completion targets. `SPOTS` follows the menu; `SPOTS_ALL` keeps every scene.
- In the game: `game.enterSpot(id)`, `game.leaveSpot()`, `game.state === 'spot'`, `game.spot` (the session),
  `game.spotId`, `game.spotReturn`, `game.attachWorldRender()`; `body.in-spot` while in a spot. Hosts pass explicit
  `weather`, `season` and `timeZone`; explicit local hours follow travel, Live follows each destination.
- Pause, map, photo/panels, scene exit/teleport and a successful drone launch cancel an unfinished activity without
  awarding it (`session.cancelActivities`, venue `ctx.extras.venueActivities`), restoring the walker to a safe pose.
- Guided tours start at a reachable available activity; `TOUR_WALK_LIMIT_M = 300` bounds the whole itinerary (≤ 3
  stops); if nothing fits, the guide declines the tour. Walking routes stay on the walker's supported floor and never
  route between storeys; waypoints keep their floor height.

### Drone, football, inspection
- Drone flight is limited to the district's playable mask plus explicit landmark flight extents (`flightBoundary` with
  `inside(x,z)`, boundary segments, `landmarkAreas`) plus a 150 m buffer, with swept physical movement; return-home
  respects it. Tourist scenes derive theirs from scene extents plus optional `ctx.extras.droneFlightAreas`.
- `createDinamoFootball(game) → DinamoFootball | null`; `game.football.update(dt, drone?)`, `.allowsFlightAt(position)`,
  `.reset()`, `.dispose()`. Only a whole-ball crossing between the posts and below the bar after a drone touch unlocks
  hidden `dinamo-drone-goal`.
- `inspection.js`: `inspectionEnabled(search?)`, `inspectionReport(game)`, `mountInspection(game)`. `?inspect=1` adds the
  coordinate overlay and F8 report and lifts the drone's range/ceiling/battery/geofence limits (physical geometry stays).
  Normal play creates no inspection DOM, timer or listener.

### Progression (`achievements.js`)
- `initAchievements(game)` (main.js, once) → `game.achievements`: `unlock(id)`, `isUnlocked(id)`, `count(id)`,
  `completion()` → `{pct, exact, all, parts[{key,label,weight,n,total,frac,points}], unlocked, total}`, `open(filter?)`,
  `close()`, `isOpen`, `state` (localStorage `dmcv.progression.v1`), `reset()`. Exports `WEIGHTS`, `CATEGORIES`,
  `ringSvg(pct, size)`.
- `hud.achievement(id)` delegates to `game.achievements.unlock(id)`; `hud.unlocked` holds this session's unlocks.
- Observed, never required: `game.state, progress.done, chapters, chapter, chapterDone, freeRoam, spotId, spot, spotsMod,
  office, officeFromFoot, foot, player, world.graph.nodes, nav, navManual, traffic, wxKind, r3d, carBody`; wrappers on
  `enterChapter, goToChapter, onCollide, closureText, playerHonk, onPhoto, buildNavList, spotPause`. Renaming these
  silently disables the matching achievement.
- Catalogue: `ACHIEVEMENTS` in data.js (`{id, cat, icon, title, desc, hidden?, target?, unit?, activity?, live?}`).

### Activities
- A spot activity reports itself with `window.game?.emit?.('activity', { spot, id })` (or
  `window.dispatchEvent(new CustomEvent('dmcv:activity', { detail: { spot, id } }))`). `game.emit(type, detail)` dispatches
  `dmcv:<type>`. `spotsMod.ACTIVITIES = [{ spot, id, title }]` marks activities as present. Achievements with
  `activity: '<spot>:<id>'` count only once live (`live: true`, listed in `ACTIVITIES`, or fired once) and only for
  available destinations.

### Save (`save.js`)
- `import { save } from './save.js'` (singleton; `initAchievements` calls `save.attach(game)` → `game.save`);
  `await save.ready`; `save.mode` = `'idb'|'local'|'memory'`.
- IndexedDB `dmcv` v1: store `kv` (`meta:schema`, `session`, `ls:<key>` mirror of every `dmcv*` localStorage key) and
  `photos` (newest 60). Sync readers keep using localStorage; save.js mirrors it.
- `save.capture(game)` → session snapshot (mode, city, district, chapter, free roam, car / foot pose, fuel, stats, clock,
  conditions…); autosave every 30 s, after chapter/office/spot/car transitions, on `visibilitychange` and `pagehide`.
  `save.hasSession()`, `await save.restore(game)`. Photo mode is never restored.
- Photos: `save.addPhoto(blob, meta)`, `listPhotos()`, `deletePhoto(id)`, `openGallery()`; `save.clearAll()` resets.
- Main menu Continue (`#save-continue`) appears only when a resumable session exists.

### Telemetry
- `window.cvTelemetry.track(event, props)` (no-op unless enabled). `telemetry-game.js` reads `game.state, game.city.id,
  game.visited, game.office, game.stats, game.headlights, game.hud.unlocked, game.r3d.stats, game.r3d.weather,
  game.chapter`. Events: spec 21.
