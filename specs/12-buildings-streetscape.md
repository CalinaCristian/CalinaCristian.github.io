# 12 — Buildings, businesses, streetscape, landmarks in districts

Ground-road guard render ownership (2026-11-10): mark inferred outer motorway/trunk guards before existing lane cuts, preserve that metadata through splitting, and render only surviving collision intervals. Each panel uses the physical segment endpoints and native height band, with side/top/end faces. Existing central-median rendering retains its dimensions; mapped barriers and bridge guards keep their own paths. Exact owner Otopeni views and geometry controls are required before publication.

Owner roles: **world** (generic buildings, shopfronts, signs, furniture, trees), **landmarks** (hand-modelled landmarks). Inputs: research JSON per district (spec 20).

Inferred road-sign rail clearance (2026-11-09): `World.placeSign` reads `sidewalkWidth(edge,side)` with the shared legacy scalar fallback. `inferred-road-sign.js` queries the existing `tramGrades.excludesInferredObstacle` using the actual emitted fleet envelope for the complete source-ground sign unit: native post/collider footprint radius.1 at its actual post band, and both full-width plate segments at their separate native.06/.04 offsets and actual height. A conflict refuses the complete inferred unit before atlas/geometry/collider emission; mapped signs, source roads/rail paths/widths, vehicle models, guards and tolerances are untouched. `world.stats.tramGrades.inferredRoadSigns` records all source counts and bounded exact source/side/icon/component/reason samples. Unknown source grades confer no geometric clearance proof and preserve existing unresolved reporting. Native984's actual Imperio490/post intersection remains a negative; CPU26 controls reproduce all16 actual Float32 unit triangles/eight floor contacts, remove only that inferred unit, retain the clear right no-entry unit and legacy output exactly. Fresh World/publication/drive/visual/budget acceptance remains required.

Generated bridge render ownership (2026-11-10): independent Float32 subdivisions of a whole coincident inferred separation face share the earlier cap boundary within their calculated rounding cells. Crossing faces still clip at the exact boundary; mapped barriers, physical guards and source geometry are unchanged. The native 984 micrometre-depth witness is retained as a regression fixture. Validate bridge and underpass changes together after the playable implementation batch.

## Requirements
R12.1 Every building fronting a chapter route uses researched height/storeys (incl. setback attics), facade colour (hex), material, window grid, balconies, roof shape/colour; others use OSM tags + district style rules.
R12.2 Real ground-floor businesses with brand names, colours and logos-as-text (McDonald's, KFC, Starbucks, Mega Image, Profi, Carrefour Express, Lidl, BCR/BRD/ING/BT/Raiffeisen, Catena/Dona/Sensiblu, Orange/Vodafone, fuel brands; US: Starbucks, McDonald's, QFC, Safeway, Shell/Chevron/76/ARCO …) at their real addresses and side of the street.
R12.3 Rooftop advertising signs where they exist (Piața Victoriei, Romană, Unirii …) with brand + position.
R12.4 Street furniture per street from research: lamp models/heights (e.g. Calea Victoriei lanterns), trolleybus wires, tram poles, benches, bins, bollards, metro 'M' totems, bus shelters (STB style / King County Metro style), traffic-light models (RO vs US), street-name plates.
R12.5 Trees: species look (chestnut/linden/plane in Bucharest; maples/conifers in Seattle), positions from OSM/research, seasonal colours (spec 18).
R12.6 Landmarks inside districts get a fidelity pass from research (landmarks role); facade photo textures (CC-licensed, attributed) allowed for key buildings when it clearly improves fidelity within budget.
R12.6b **Lincoln Square (Bellevue)** is a hero landmark and the final CV stop: UiPath's Bellevue office moved there in September 2025 (two floors; previously Plaza Center, 10900 NE 8th St, 2022–2025). Model the whole complex at high fidelity from research (towers, podium, Westin/W, the skybridge to Bellevue Square, the NE 8th St × Bellevue Way corner, lobby entrance used by UiPath, signage); the `uipath-bel` stop door is the real entrance of UiPath's tower.
R12.7 Budget per district: ≤ 1.5 M visible triangles, ≤ 400 draw calls at high.

## Acceptance
- [ ] Research coverage ≥ 90 % of buildings fronting chapter routes applied (log counts).
- [ ] Visual review: no "wrong height/colour/roof" or "missing shop" items on chapter routes.
- [ ] Owner spot-check on a street they know.

## Reality pass playbook (any district; first done on Floreasca, 2026-11-08)

Goal: the district matches reality street by street — real footprints, heights, roof shapes and colours, facades by type, real
shops only, trees, gardens, parked cars, fences, sports grounds — inside the playable area **and** in a 600 m ring of real
buildings + streets outside it (boxes only beyond). Street View is only for looking (see AGENTS.md rules).

Steps (scratch = any folder outside the repo; commit only code + `game/research/*.json` measurements + `game/data/*.json`)
1. OSM tiles: `node tools/osm/fetch-tiles.mjs --out $S/tiles --only buc` (Overpass is blocked here; the OSM API works).
2. Aerial mosaic of the district bbox + ~300 m: `python3 tools/aerial/mosaic.py --bbox … --z 18 --cache $S/esri --out $S/m18`.
3. Roofs: `python3 -I tools/aerial/roofs.py --mosaic $S/m18 --osm <tiles> --out game/research/roofs-<city>-<district>.json`.
   Calibrate on crops (draw footprint + label over the imagery for ~80 random buildings) before trusting it; check the global
   registration offset it prints (Floreasca: 2.1 m E, 1.7 m N).
4. Trees + green ground: `python3 -I tools/aerial/trees.py --mosaic … --osm … --out game/research/trees-…json --ground-out
   game/research/green-…json`; check the `--debug` overlay (pitches / lawns must not become crowns).
5. Build: `node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles $S/tiles --districts --district <id>` (picks the
   three files up by name; `district.outerRing` in cities.js overrides the 600 m ring). `DEBUG_DROPS=$S/drops.json` lists any
   footprint inside the area not kept, and why.
6. Audit: `python3 -I tools/osm/building-audit.py --data game/data/<city>-<id>.json --osm <tiles> --roofs … --ring 600`.
   Targets (Floreasca reached them): inside — 100 % of OSM footprints matched, median centroid offset 0 m, ≤ 2 trimmed below
   60 % of their area, OSM-tagged heights 100 % within ±25 % / 2.5 m, roof flat/pitched vs aerial 100 %; ring ≥ 99 % heights,
   ≥ 99 % roofs (its "missing" ones should all be just past the ring edge); world.js shrinks / drops 0 at load (`world.stats`).
7. Look: `node game/dev/harness/viewpoints.js --district=<id> --topdown=250 --mosaic=$S/m18` (whole district, game vs aerial)
   and `--walk --streetview --every=50 --headings=left,right,fwd --max=2000` (every drivable street, both sidewalks, facade +
   along-street views next to Street View; ~850 views / 40 min for Floreasca; `--dry` first to count). Fix what differs, street
   by street; re-render the affected streets (`--streets=<regex>`); Street View images are cached in `<out>/sv-cache`.
8. Verify: logic regression + visual QA + frame budget (AGENTS.md). Floreasca after the pass: visual QA identical to the
   previous commit except one intentional finding (the market hall's own service lane enters it), worst frame 1.2–1.45 M tris.

What the builder / world now do (so the next district gets it for free)
- Builder: real footprints out to the ring (flag 32: no shops / signs / near detail), scenery streets (`data.scenery`), areas out
  to the ring incl. `track`, `clay`, `turf`, `hard`, `pool`, `yard` kinds, aerial roofs (shape where OSM has none, colour
  desaturated on flat roofs; flag 16 = measured, world.js keeps it), aerial trees (ring crowns thinned: ≥ 2.2 m within 100 m,
  ≥ 3 m and 60 % beyond), green ground (`data.green`), OSM `parking:*` in roadInfo flags, address-like / residential names never
  become signs, large named buildings keep their own service lanes (flag 64), road clearance by pushing corners back.
- world.js (`realPass` districts): kerbside parking on the sidewalk along both kerbs of residential streets (OSM parking tags
  where mapped; the cars stand on the raised sidewalk, only where it is raised),
  **raised sidewalks** (2026-11-08): the sidewalk top at the kerb's height (road + 0.13 m) from the kerb to 0.3 m past the
  property line with a back face, junction corner pieces between neighbouring sidewalk ends (`cornerPolys`; stats
  `raisedSidewalk` incl. why a corner was left low), densely sampled so no side street / driveway / median / pad is paved
  over; physics (`surfacesAt` → walkers, a car mounting the kerb), the crowd (`world.walkTop`) and every prop on a sidewalk
  (`raisedTop` / `liftOnSide`: lamps, fences, hedges, bollards, signs, furniture, shelters, traffic lights, shop light
  spill) follow it. Walkers pass parked cars on the carriageway side, then step back on the sidewalk (traffic.js), railings / walls / hedges on the property line where a front garden lies behind the sidewalk, kerb bollards
  on main streets where parking is not allowed, lamps on residential streets, plain bus lanes (no red paint), businesses'
  fascias on the nearest building (no pole signs), shopfronts on street faces only, sports-ground markings / goals / nets /
  fences / hoops / pool copings, football pitches with mowing stripes, no trees on them, corner flags, dugouts,
  ball-stop fences and deeper goals, villa plaster palette, plain balconies on low blocks, lighter ring parking lots.
- Landmarks: model big sports venues from their OSM outline + aerial layout (Stadionul Dinamo `bDinamo`: track, terraced bowl
  following the outline, sector profiles, covered main stand, masts, scoreboard).
- Play-test round 2 (2026-11-08): front-garden boundaries chosen per plot from the building behind (blocks: none or a
  0.7 m railing; villas: railing on a plinth / plastered wall with a railing / hedge / rarely a solid wall), continuous
  (no random gaps); raised sidewalks end in a 1 m slope, not a ledge; district walkers follow each side's own sidewalk
  (`off(e, side)`, `maxOut`); one-way chains keep the left kerb where the narrowest neighbour puts it and extra lanes widen
  the right (`laneAligned`), wider-than-tagged one-way carriageways are marked evenly (the bus line on the last divider);
  Dinamo: sector heights ramped (no ledges), no trees / OSM boxes in the bowl (`grounds`, `coverPolys`); pitch goals with
  round posts and a sloping fine net, corner flags with arcs; solid garden fences, hedges, bollards, sports fences.
- Landmark grounds (2026-11-08, Rosetti): a landmark can hand the world `fences` (`line`/`ring`, `inside` = the grounds
  polygon, `gates`, `style` 'bars' | 'mesh', `h`, `plinth: 'arches'`), `covers` (points: the OSM buildings it replaces) and
  `grounds` (its own surfaces: no trees there). The world keeps every fence point off carriageways and sidewalks on the
  grounds' side of the street (OSM drew the Rosetti grounds' east edge on the Garibaldi centre line, so the fence had jumped
  the street). Rosetti now: salmon spandrel bands + wide windows, fire-escape stair, the sports hall (w545176891, ≈ 12.5 m
  from the aerial, yellow cladding, dark flat roof), the unmapped sports ground measured on the aerial (turf pitch, two red
  courts, blue surround), welded mesh on Garibaldi / Verdi (tall by the sports ground), bars on a painted plinth on Bizet;
  the school's OSM name no longer puts a second sign on the hall.

Floreasca facts measured / observed (for whoever continues here)
- Core around 44.4645, 26.1045: long 4-storey (P+3) flat-roofed 1950s–60s blocks with dark bitumen roofs, plain balconies; red-
  tile villas (1–3 storeys) scattered between them, denser on the composer streets west of Calea Floreasca; newer 4–6-storey
  flat-roofed blocks with light membrane roofs. Gardens, fences and dense tree canopy almost everywhere; cars parked on both
  kerbs (on the sidewalk) of the residential streets; bollards along the west side of Calea Floreasca; its bus lane is a
  contraflow lane on the west side, plain asphalt with BUS lettering (game still models the road as one-way 3 lanes — open).
- Piața Floreasca market hall (6275 m²) is on the route; Parcul Cinema Floreasca is a wooded park; the Dinamo complex has the
  stadium, velodrome (concrete track round a rugby pitch), clay tennis courts, pitches, outdoor pool, Sala Polivalentă.
- Open: facade colours are per-type palettes (no measurement source without Street View data); untagged heights are rule-based
  (a shadow-length height estimate calibrated on OSM-tagged buildings is the obvious next step); contraflow bus lane topology.

## SkyTower overlap correction · 10 November 2026

SkyTower keeps its source outline,137m top,flat cap and37-level rhythm. Glass panes and estimated0.08m frame bands partition every complete source edge fromY=5to137; their emitted rectangles have no positive-area overlap. Original2.5cm-proud strips could interfere at grazing views. A direct production-builder control over the literal26-point source ring and reverse winding covers17139.3872878067m² exactly with6362quads, retaining the roof/collider heights and source buffers. Fine members may still alias below a pixel; roof-service dimensions remain unknown.

Floreasca's retained coarse row3186,tuple[745,-15068,403,317,1370,104], is reproduced from the literal w219622660 source in the Pipera dataset, transformed into Floreasca's projection and original40m-cell compiler. Every source centroid in that cell was checked; w219622660 is its sole contributor. The catalogue binds that exact tuple to the same successfully built source owner. Missing, changed, ambiguous, partial or invalid ownership retains the mass. All input data remains unchanged; the authored full footprint/height collider supplies this building once. The original palette RNG draw is consumed before duplicate render/collider suppression. No proximity rule hides neighbours.

Immutable native runtimea8fedd35: matched Floreasca/Pipera owner-area views and tiny camera movements retain matching actor counts; captured Ultra frames peak372calls/775845tri. The literal supplied Pipera bearing points over the mall, so the public pair is explicitly an additional tower-facing supplement with its actual camera exported. Requiredfoot/a0H0M and all8productionWorld constructors pass; only Floreasca has one exact coarse-ownership record. These are scoped appearance/constructor checks, not whole-district or journey/hardware-FPS acceptance. Original PNGs, cameras, conditions, hashes and controls:game/overview/assets/landmarks/skytower/native-20261110/summary.json.

### Church window rows (10 November 2026)
The shared facade atlas must end on a whole window row for churches as well as other buildings. Keep the selected row count, source footprint, total height, eaves, roof profile and collision unchanged; adjust only the per-row UV height to fit the wall band. Report49 is the native visual acceptance witness.

Pipera facade candidate (2026-11-10): use one edge-space facade skin for Hermes and BOB. Retain the existing floor/pilaster rhythm, colours and fin depths; emit opaque structural strips instead of the underlying glass/wall, with returns for projecting fins. BOB white acute-corner strips replace coplanar triangular overlay prisms. Preserve source rings, inner courtyards, heights, roof caps and colliders. Required gates: finite disjoint facade coverage, original native reported poses and movement, foot/a and paired district visual budgets.

Runtime9ae4ae1e passes the four geometry controls, reported native High/Ultra facade views and ±0.15m lateral offsets, and foot/a0H0M. Paired Pipera visual coverage9/9 retains identical92 existing findings, peak288calls and855316triangles. Six isolated model studies were refreshed from the same runtime. This accepts the two reported facade artifacts only, not other district defects or hardware FPS.

Floreasca report5 candidate: restore shared balcony end returns from893e81fd as a facade-only change. Both end guards and enclosed upper sides use the existing solid facade-slab emitter. Source bodies, floors and balcony fronts are retained; require original reported native views and combined regression before acceptance.

Report4 candidate: non-shop sides of shopfront buildings must not continue the upper-floor atlas negatively below the shop datum. Partition those faces at the original shop height, mapping one whole ground-storey row below it. Source visibility clips retain their original building datums, and upper rows keep the existing floor height. Footprints, source levels, roof and collision stay unchanged.

Floreasca reports4/5 runtimea5c7ca16: original High views plus±.15m offsets and Ultra views pass full-size inspection with0browsererrors. High maxima201calls/712479tri; Ultra368calls/1350381tri. Three window-band controls pass. Foot/a0H0M/2low (softwareFPS and9.9msTrafficupdate) retained. PairedFloreasca6/6 capturecoverage and identical36issues; medium peak250calls/863641tri versus858219before. Desktop1440/phone390 comparison-card image/hash/layout checks pass. No claim of all-district or hardwareperformance acceptance.

## Detailed fountain basin / trunk agreement · 11 November 2026

Report29's west-facing view shows the trunk at(-794.6,303.9) only0.049m outside source basinw1177038227: it intersects the rendered0.35m granite rim. The first centre-only candidate also found3genuine water conflicts (including-764.7,306.5 inw1177023228) but did not fix the reported rim tree; retain that failed native comparison. The landmark now exports all44rendered outer granite rings with their source IDs. A post-generation pass checks the existing physical trunk body against those exact rings, removes only intersecting instances and matching colliders, and records source IDs/coordinates/radii in World.stats.sourceWaterTreeConflicts. Source data remains unchanged. Instance RNG is consumed before exclusion to preserve retained rotations/colours and downstream dressing. No extra bank margin or rendering-budget thinning is applied. Native original-camera High/Ultra views are clear; 16 physical conflicts are excluded and 18,590 retained tree/collider records match exactly. Source data and basin geometry hashes are unchanged. Foot/a has 0 high / 0 medium findings. Paired district sweeps cover155/155samples each without capture errors or new findings. Existing whole-district geometry/office findings and two Pasaj frame-budget overruns remain open (maximum1,508,314→1,507,390triangles;279calls). No matched frame increases in triangles or calls. Nine affected overview atlas squares were recaptured from b2c4ea4a; previous pixels/provenance remain historical. See `/game/overview/#fountain-tree-fix` and its summary for scope.

The fountain release also refreshes all 16 Unirii walking-height gallery images (four unchanged poses × summer/winter day/night) from exact source `0a60128f`. Original capture times, conditions and checksums remain in `game/overview/comparison-data/unirii/context/ground-0a60128f/manifest.json`; earlier images retain their historical source. All 16 images were inspected. These fixed appearance views do not establish route completion or hardware FPS.

## OTP terminal source assembly · 11 November 2026

Report56: w771096083 is an outline, not an additional full-height pier through its32mapped parts. `landmark-otp-source.js` retains their precise projected footprints and literal height/minimum bands; `landmark-otp-pier.js` partitions exposed union faces and uses matching collision volumes. The complete3.48031688m² residual footprint remains, with an explicit nearest-part infill band estimate. This fixes the tall14.6m residual fins from the rejected intermediate. Bridge minima remain5m before the common0.12m landmark placement datum. The old six estimated bridge boxes are removed in favour of the complete mapped connectors. Source POIs, roads and datasets do not change.

Facade bay spacing8m, horizontal bands4m and bridgehead finish/flat roofs are appearance estimates. They do not certify interior floor locations. Controls in `tools/fidelity/test-otp-pier.mjs` cover all32literal footprints/bands, residual plan coverage, finite faces and152source/infill collision volumes. Native candidate46bf originalUltra plus five other views have0errors, max234calls/385035triangles. Native body queries pass below the bridge/upper part and still collide within those solids. Paired Otopeni53/53 fixtures retain132existing findings(2H/3M/127L); these defects remain open. Final isolated-release foot/a, original retakes, affected overview and live verification remain required.

## Shop fascia overlap candidate · 11 November 2026

Reports27/36: the previous centre-only3.5m unit-sign check ignored the full board width and building-name signs. A shared wall-span allocator now reserves full padded coplanar fascia boards at their actual height, fits subsequent inferred unit labels into clear spans near their source point, and records placements/unavailable spans. It does not move buildings, change POIs or rename businesses. Perpendicular blade signs and measured signage require independent validation; this candidate is not accepted until original report views and retained source records are checked.

Validation: eight layout controls; native all-eight-district audit checks378placed unit boards against936registered boards with zero coplanar overlap. Original27/36High/Ultra views, final8addfoot/a0H0M, paired155/155Unirii sweep with unchanged228findings, and34atlas/56ground/37context retakes. Columns/balconies still obscure some boards; no whole-district fidelity or budget acceptance. Public evidence: `game/overview/fix-shop-signs/summary.json`.

## Bellevue Square assembly · 11 November 2026

Report71: keep exact parentw29234887 and contained department-store partw497739259, rendered as one physical low mall envelope. Macy’s has no literal height/levels; the official store lists LowerLevel/Floor1/Floor2 and parentOSM specifies3levels. Existing15m mall height remains an explicit estimate. Source entrance n5752777692 locates the recessed glazing; the CC0 April2023 photograph guides the raised gable, stacked lettering and brick flanks. Geometry must preserve every source plan vertex and collision coverage; all affected native/overview views require recapture. No imagery texture or reference publication.
