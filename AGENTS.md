# AGENTS.md — read this first (Claude Code, Codex, any coding agent)

`CLAUDE.md` imports this file, so Claude Code and Codex read the same instructions. Keep it current: when you learn something
the next agent needs, add it here (short, imperative) or in the relevant spec, and link it from here.

## The repo in one minute
- Continuing the long fidelity task: read `handoffs/fidelity/RESUME.md` and `handoffs/fidelity/FIDELITY-GOAL.md` before assuming a release or restarting jobs. Environment handovers can end agent sessions while Node/Chromium jobs survive; Node may have process name `MainThread`. Check saved progress and argv/PIDs before starting duplicate browsers. A surviving PID can also be a zombie: check its state and the report's terminal fields.
- Static CV site (`index.html`) + **Drive My CV**, a first-person 3D game in `game/` (Three.js, vanilla ES modules, **no build
  step**). Deployed by **GitHub Pages from `master`** → https://cristiancalina.com/game/. Work on your feature branch; nothing is
  live until it is merged into master, and merging is the owner's call (ask, never merge on your own).
- The owner also pushes to master (e.g. telemetry fixes): `git fetch origin master` and merge it into your branch before each push.
- Specs-driven: `specs/README.md` (process), `specs/00-vision.md`, `specs/01-architecture.md` (file ownership + contracts),
  `specs/STATUS.md`, one spec per area. Read the ones that touch your work before editing.
- World data: OSM → `tools/osm/build-data.mjs` → `game/data/<city>-<district>.json` (schema: `game/data/README.md`), rendered by
  `game/src/world.js`; landmarks `game/src/landmarks.js`; districts `game/src/cities.js`. Research / measured inputs live in
  `game/research/`.

## Checks before you push (look at the pictures — numbers alone have missed real breakage)
- Syntax of any edited module: `node --input-type=module --check < game/src/world.js` (a `//` comment pasted into a one-line
  statement once broke the whole game; `node --check` without `--input-type=module` does not catch it).
- Logic regression: `npm run harness -- --scenario=foot,a --city=bucharest` (must stay 0 high / 0 medium).
- Visual QA of the district you touched: `npm run harness:visual -- --city=bucharest --district=<id> --viewports=none`; compare
  the finding counts with a run on the previous commit, and keep the perf table under **1.5 M triangles / 400 draw calls**.
- When you keep editing while a harness runs, run it from a snapshot: `git worktree add /tmp/wt HEAD` (the static server
  serves files live). Every harness browser is started with `--mute-audio`; keep it that way.
- **README.md always reflects the latest game**: when a change adds, removes or changes a player-facing feature, a control,
  a mode, a district / landmark, a dev tool or a data source / credit, update README.md in the same commit (and the
  relevant spec). A feature change without its README update is not done.
- **Keep the entire published overview current.** Any game, data, model, rendering, UI, controls, activity, performance or
  evidence change that affects `/game/overview/` must update the affected overview material in the same change. This includes
  its prose, inventory, district/landmark/tourist records, comparisons, links, captions, status and **all affected published
  pictures, game screenshots, thumbnails, street/aerial views, activity frames and phone captures**. Recapture affected game
  images from the exact changed source; record the real source commit, date, camera, conditions and scope. Never just change
  an old image's source/date or keep a stale capture presented as current. Preserve old captures and provenance as explicitly
  historical or validation evidence. Inspect full-size pictures and desktop/mobile layouts: reject wrong-level cameras,
  obstructed or meaningless framing, and misleading comparisons. Verify affected selectors, image decoding, links and cache
  behavior; after publishing, check the live page and image assets. A change is not complete until its affected overview is
  synchronized. Street View remains comparison-only; never commit reference-provider imagery.
- Commit and push as you go on the assigned branch; no PR unless asked.

## District reality pass — how to make a district match reality (learned on Floreasca, 2026-11-08)
Full playbook with commands and acceptance numbers: **`specs/12-buildings-streetscape.md` → "Reality pass playbook"**.
Tools: `tools/aerial/README.md` (mosaic → roofs → trees / green ground), `tools/osm/building-audit.py`, and
`game/dev/harness/viewpoints.js` (`--walk` Street View street walk, `--topdown` aerial tiles; harness README).

Rules
- **Street View is for visual side-by-side comparison only** (Google's terms): never extract data from it into the game; never
  commit or publish its imagery. Building data comes from OSM + measurements on aerial imagery (only the measurements are committed).
- **OSM tags always win** over measurements; measurements win over rules of thumb; never invent (shops, signs, names, prices).
- Keep tools generic (any `--city` / `--district`), scratch data out of the repo.
- New street-level dressing is gated on `data.scenery` (`realPass` in world.js) so districts that have not had their own pass
  stay unchanged; rebuild a district, verify it, then it gets the dressing.

Pitfalls found the hard way (each one shipped a visible bug)
- The builder silently dropped every footprint 0–30 m past the playable edge, and every pitch / parking / lawn / yard more than
  120 m out → dead belts and empty patches. Use `DEBUG_DROPS=<file.json>` and `building-audit.py`; never trust counts alone.
- Blanket defaults by zone (`villaZone`: every footprint < 420 m² = 2-storey pitched house) made a "sea of roofs"; decide from
  measurements (aerial roof class + footprint shape), deterministic variety per OSM id.
- `roof:levels` is an attic inside a pitched roof, a set-back storey only under a flat roof.
- Preserve every valid source footprint and courtyard exactly, including small strips and elevated parts. Never move,
  shrink or delete a real building to clear a road. Resolve source conflicts through documented widths, grade, open
  canopies or actual building passages; retain unresolved source contradictions explicitly.
- Invented ground-floor shops round CV stops and address-like names (`Georges Bizet 10`, `Bl. 8A`) as shop signs were wrong;
  shops / signs come from OSM / POIs / research, on street faces only.
- Footprint tests must test the whole footprint, not its centre (fuel canopies cut through buildings).
- Landmark frames: with x east / z south, "v = east" of a long axis u is `(uz, −ux)`; check E/W on a top-down vs the aerial.
- Comparisons: render the game in the Street View season (`--season=summer`), at the pano position and camera height; take
  top-down tiles from below the tree / car draw distance (the 466 m camera made parks look treeless); square top-down frames.
- Frame budget: measured trees dominate (≈ 85 triangles each, near LOD far more), parked cars ≈ 260 each. Use culling,
  LOD, instancing and bounded rendering work. Preserve measured crowns and source records; never thin them to obtain a
  passing budget. Record physical exclusions separately from render optimizations.
- Aerial canopy surveys must record their actual coverage (`treeCoverage`): suppress inferred trees only there. Grey historic
  metal roofs can look flat to the classifier; inspect calibrated crops, retain uncertain results, and keep OSM tags first.
- Preserve OSM parking location and orientation (`data.parking`); diagonal street-side bays are not parallel sidewalk parking.
- Preserve multipolygon inner rings as open courtyards through roof triangulation, point queries and collision. Rooftop
  props need their whole footprint clear of holes; a few centre samples can miss small floating HVAC boxes.
- A full-footprint ground-based OSM building part can cover its outline: retain both source records for audits, use
  `buildingCoveredBy` to render the volume once, and preserve parent use/associations. Partial or elevated parts need the base.
- Panorama metadata has no altitude. Comparison poses retain source edge/layer; overlapping road levels stay flagged for
  review in `camera-poses.json`, rather than silently moving the camera onto another deck or inside a retaining wall.
- Do not use a variable before it is defined in `buildWorld` (TDZ error = the game does not boot): `data` is loaded after `distId`.
- OSM grounds / landuse polygons are often drawn to the street centre line: anything built along their edge (fences, hedges)
  must be snapped to the property line on the grounds' side (`inside`), never to the nearest side (the Rosetti fence jumped
  Garibaldi). The largest building inside a named amenity gets its name as a sign: drop it when a landmark carries the sign.
- Sidewalks in `realPass` districts are raised to the kerb's height (road + 0.13): anything standing on a sidewalk must use
  `raisedTop(x, z)` / `liftOnSide(...)` (props are authored at `Y.side`); physics and the crowd follow `surfacesAt` /
  `world.walkTop`. Cells are merged into meshes before the kerb parking pass: geometry added there must be its own mesh.
- Edges can be asymmetric (wL ≠ wR: two-way roads with different lane counts, lane-aligned one-way chains): use the side's
  own width, never `halfW`, for anything placed on one side (walkers' lines put people metres off the sidewalk).
- Anything a car or walker can hit needs a collider (`propColl` / `addPropColl`): fences, hedges and bollards once had none.
- Roofs / facades: use the shared native roof profiles, exact outer/inner rings and clipped roof surfaces. Literal height
  is the total top, not a wall height to which another roof is added. Keep unsupported roof shapes and estimated rises
  explicit. Window tiles must end on a whole storey, including above shopfronts; parapets remain plain.
- Fine wires / pickets / nets: thin two-sided strips in `c.detail` (no shadow pass), never boxes: the frame budget.
- Flat opaque ground layers (`area` / `grass` / `pave` / `sport`) preserve mesh painter order with AlwaysDepth and final depth writes. This closes lower-level cars showing through grass. Markings over ground still belong in a later layer (`c.sport` for pitches); verify native positive/negative depth controls when changing this policy.
- Do not call a `const` helper from code that runs earlier in `buildWorld` (signs run inside the building loop): use a
  function declaration (hoisted) or define it first — `clearPortal` once broke the boot.

- Never invent gameplay places either: gas stations come only from OSM `amenity=fuel` (the invented fallback forecourts were
  removed); never drop or move a real building to fit anything.
- The player's collision body is the cockpit model (nose 3.42 m ahead of the eye, boot 2.36 m behind: `player.front/rear`),
  not a box centred on the eye; anything checking the player's footprint (traffic SAT, pedestrians) offsets by it.
- No instant position snaps for people in view (knock-downs, un-piling, getting back to the sidewalk line): move them at a
  walking pace (`adoptLine`, `walkGoal`), a teleport is only acceptable out of the player's sight.
- Source roads keep every mapped vertex and legal direction, including private scenery. Do not offset parallel source
  ways or invent graph joins/U-turns. Physical width and measured left/right extents do not change lane legality; OSM
  width/placement wins. Use shared-road reservations when two legal directions share one physical lane.
- Capture coverage is an acceptance gate: missing, duplicate or timed-out views cannot be called a visual pass. A required
  foot/a run covers legacy chapter scenarios; test rebuilt districts and evolving traffic/mirror budgets separately.

Owner preferences (from play-test feedback)
- Reality first: real footprints, heights, roof shapes / colours, shops, trees, parked cars; nothing empty or dead, including
  outside the playable area (real buildings and streets in a 600 m ring, boxes only beyond).
- Show evidence: game-vs-reality comparison images for the whole district, not a sample.
- Ask before deploying; keep the owner posted with short updates while long jobs run.
