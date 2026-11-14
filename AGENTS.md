# AGENTS.md — read this first (Claude Code, Codex, any coding agent)

`CLAUDE.md` imports this file, so every agent reads the same instructions. Keep it current and short: when you learn
something the next agent needs, add it here (imperative) or in the relevant spec, and link it from here.

## The repo in one minute
- Static CV site (`index.html`) + **Drive My CV**, a first-person 3D game in `game/` (Three.js, vanilla ES modules, **no
  build step**), deployed by **GitHub Pages from `master`** → https://cristiancalina.com/game/.
- Open work: [`handoffs/fidelity/BACKLOG.md`](handoffs/fidelity/BACKLOG.md) is the single list (owner reports and other
  open items). Update it in the same commit as a fix; remove an item once it is fixed on `master`. Findings, to-dos and
  open questions live only there, never in specs, dossiers or READMEs.
- Specs: [`specs/README.md`](specs/README.md) (process), `specs/00-vision.md`, `specs/01-architecture.md` (modules,
  ownership, contracts), one spec per area. Specs hold requirements only; read the ones your work touches.
- World data: OSM → `tools/osm/build-data.mjs` → `game/data/<city>-<district>.bin.gz` (format and tools:
  [`game/data/README.md`](game/data/README.md), [`tools/osm/README.md`](tools/osm/README.md)), built into a scene by
  `game/src/world.js`; landmarks `game/src/landmarks.js`; districts and chapters `game/src/cities.js`. Research and
  measured inputs live in `game/research/`.
- Several agents work at once, each in its own git worktree. Never use bare `git stash`; commit only your own changes.
  Node/Chromium jobs can outlive an agent session (Node may show as process `MainThread`): check running PIDs, their
  state and saved progress before starting a duplicate browser.

## Publishing
- Fixes go straight to `master`, no PR unless asked (owner rule): run the checks below, `git fetch origin master`,
  merge it (keep both sides), then push. The owner and other agents push to `master` too, so fetch and merge again right
  before each push.
- Runtime changes also need the release stamp (`node tools/telemetry/stamp-release.mjs --write`, see README.md →
  Publishing).
- Keep the owner posted with short updates while long jobs run.

## Checks before you push (look at the pictures — numbers alone have missed real breakage)
- Syntax of every edited module: `node --input-type=module --check < game/src/world.js` (plain `node --check` misses
  a `//` comment pasted into a one-line statement).
- Unit tests: `node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` (known failures are listed in BACKLOG.md).
- Logic harness: `npm run harness -- --scenario=foot,a --city=bucharest` with 0 high / 0 medium.
- Bridge and tram audits: `node game/dev/harness/bridge-bents-check.cjs <repo> <out> bucharest grozavesti` and
  `node game/dev/harness/tram-sweep-audit.cjs <repo> <out> bucharest grozavesti`.
- Visual QA of the district you touched: `npm run harness:visual -- --city=bucharest --district=<id> --viewports=none`;
  compare the finding counts with a run on the previous commit and keep the frame under **1.5 M triangles / 400 draw
  calls**.
- If you keep editing while a harness runs, run it from a snapshot (`git worktree add <dir> HEAD`): the static server
  serves files live. Harness browsers start with `--mute-audio`; keep it that way.
- Capture coverage is an acceptance gate: missing, duplicate or timed-out views are not a visual pass.
- Never claim hardware frame rates from software-GL or emulation timings.

## Keep the docs and the overview current
- **README.md reflects the current game**: a change that adds, removes or changes a player-facing feature, control,
  district / landmark, dev tool or data source / credit updates README.md (and the relevant spec) in the same commit.
  Remove text that is no longer true; history lives in git, not in the docs.
- `handoffs/fidelity/` holds BACKLOG.md plus only the evidence that game code, tools, tests or the overview read (for
  example `d-otopeni/terminal-roof-measurements.json`); delete an evidence folder once nothing reads it.
- **Keep the published overview (`/game/overview/`) current.** A change that affects it updates the affected prose,
  inventory, district / landmark / tourist records, comparisons, links, captions and **every affected picture**
  (screenshots, thumbnails, street / aerial views, activity frames, phone captures) in the same change. Recapture from
  the exact changed source and record the real commit, date, camera, conditions and scope; never relabel an old image
  as current, and keep old captures as labelled history. Inspect full-size pictures and desktop / mobile layouts
  (reject wrong-level cameras, obstructed framing, misleading comparisons), verify selectors, image decoding, links and
  caching, and check the live page after publishing.

## Reality rules
- **Street View is for visual side-by-side comparison only** (Google's terms): never extract data from it, never
  download panoramas in bulk, trace them, copy them into textures, commit or publish them. Building data comes from OSM
  plus measurements on aerial imagery (only measurements are committed). OSM decides where things are; panoramas show
  what they look like. When a panorama shows OSM is wrong, the fix is a documented exception in the district dossier,
  never a silent move. Review sheets: `node game/dev/reality/capture.cjs --district=<id>` (viewpoints in
  `game/dev/reality/viewpoints.json`).
- **OSM tags always win** over measurements; measurements win over rules of thumb. Never invent shops, signs, names,
  prices or gameplay places (gas stations only from OSM `amenity=fuel`).
- Preserve every source footprint, courtyard and road exactly: never move, shrink or delete a real building to clear a
  road, never offset parallel source ways or invent graph joins / U-turns. Resolve conflicts through documented widths,
  grades, open canopies or real passages, and keep unresolved contradictions explicit.
- Keep tools generic (`--city` / `--district`) and scratch data out of the repo.

## District reality pass
1. Tiles and build: `tools/osm/README.md` → "Build a district" (`DEBUG_DROPS=<file>` lists footprints the build dropped).
2. Aerial mosaic → roofs → trees / green ground: `tools/aerial/README.md`. Calibrate the roof classifier on crops
   before trusting it.
3. Audit: `python3 -I tools/osm/building-audit.py` (targets in `specs/12-buildings-streetscape.md` → Acceptance).
4. Look: `node game/dev/harness/viewpoints.js --district=<id> --topdown=250 --mosaic=<dir>` (whole district vs aerial)
   and `--walk --streetview` (every street vs Street View; `--dry` first to count, images cost money). Render in the
   panorama's season (`--season=summer`) at the panorama's position and camera height; take top-down tiles from below
   the tree / car draw distance. Fix street by street, then run the checks above.
5. What a review establishes goes into the district's `game/research/` dossier; open gaps go to BACKLOG.md.

## Pitfalls (each one shipped a visible bug)
- Never trust counts alone: the builder can silently drop footprints just past the playable edge and far pitches /
  lawns, leaving dead belts. Check with `DEBUG_DROPS` and `building-audit.py`.
- Decide building types from measurements (aerial roof class + footprint shape) with deterministic variety per OSM id,
  never blanket zone defaults (a "sea of roofs").
- `roof:levels` is an attic inside a pitched roof, a set-back storey only under a flat roof. A literal height is the
  total top, not a wall height with a roof added. Use the shared roof profiles and clipped roof surfaces; window rows
  end on a whole storey.
- Footprint tests must test the whole footprint, not its centre. Rooftop props need their whole footprint clear of
  courtyard holes.
- Preserve multipolygon inner rings as open courtyards through roofs, point queries and collision. A full-footprint
  ground-based OSM building part covering its outline: keep both records, render once via `buildingCoveredBy`.
- Landmark frames: with x east / z south, "v = east" of a long axis u is `(uz, −ux)`; check E/W on a top-down vs aerial.
- Frame budget: measured trees dominate (≈ 85 triangles each, more at near LOD), parked cars ≈ 260 each. Use culling,
  LOD, instancing; never thin measured crowns or source records to pass a budget. Fine wires / pickets / nets are thin
  two-sided strips in `c.detail` (no shadow pass), never boxes.
- Aerial canopy surveys record their coverage (`treeCoverage`): suppress inferred trees only inside it. Grey historic
  metal roofs can read as flat to the classifier.
- Preserve OSM parking location and orientation (`data.parking`); diagonal bays are not parallel sidewalk parking.
- Panorama metadata has no altitude: comparison poses keep their source road level; overlapping levels stay flagged in
  `camera-poses.json`.
- `buildWorld` ordering: never use a variable before it is defined (`data` is loaded after `distId`), and never call a
  `const` helper from code that runs earlier (signs run inside the building loop): use a hoisted function declaration.
  Either breaks the boot.
- OSM grounds / landuse are often drawn to the street centre line: fences and hedges along them snap to the property
  line on the grounds' side (`inside`). The largest building in a named amenity gets its name as a sign: drop it when a
  landmark carries the sign.
- Sidewalks are raised to kerb height (road + 0.13, `Y.kerb`): anything on a sidewalk uses
  `raisedTop(x, z)` / `liftOnSide(...)`; physics and the crowd follow `surfacesAt` / `world.walkTop`. Cells are merged
  into meshes before the kerb parking pass, so geometry added there must be its own mesh.
- Edges can be asymmetric (`wL ≠ wR`): use the side's own width (`world.sidewalkWidth(edge, side)`), never `halfW`.
- Anything a car or walker can hit needs a collider (`propColl` / `addPropColl`).
- Flat opaque ground layers (`area` / `grass` / `pave` / `sport`) keep mesh painter order with AlwaysDepth and final
  depth writes; markings over ground belong in a later layer (`c.sport` for pitches).
- The player's collision body is the cockpit model (nose 3.42 m ahead of the eye, boot 2.36 m behind:
  `player.front/rear`), not a box centred on the eye.
- No instant position snaps for people in view (knock-downs, un-piling, returning to the sidewalk line): move them at
  walking pace (`adoptLine`, `walkGoal`); teleport only out of the player's sight.

## Owner preferences
- Reality first: real footprints, heights, roof shapes / colours, shops, trees, parked cars; nothing empty or dead,
  including outside the playable area (real buildings and streets in a 600 m ring, boxes only beyond).
- Show evidence: game-vs-reality comparisons for the whole district, not a sample.
