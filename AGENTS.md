# AGENTS.md — read this first (Claude Code, Codex, any coding agent)

`CLAUDE.md` imports this file, so Claude Code and Codex read the same instructions. Keep it current: when you learn something
the next agent needs, add it here (short, imperative) or in the relevant spec, and link it from here.

## The repo in one minute
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
- Never scale a footprint toward its centroid to clear a road (houses kept at 35 % of their size): push back only the corners
  that touch the clearance, check neighbours, fall back to shrinking last.
- Invented ground-floor shops round CV stops and address-like names (`Georges Bizet 10`, `Bl. 8A`) as shop signs were wrong;
  shops / signs come from OSM / POIs / research, on street faces only.
- Footprint tests must test the whole footprint, not its centre (fuel canopies cut through buildings).
- Landmark frames: with x east / z south, "v = east" of a long axis u is `(uz, −ux)`; check E/W on a top-down vs the aerial.
- Comparisons: render the game in the Street View season (`--season=summer`), at the pano position and camera height; take
  top-down tiles from below the tree / car draw distance (the 466 m camera made parks look treeless); square top-down frames.
- Frame budget: measured trees dominate (≈ 85 triangles each, near LOD far more), parked cars ≈ 260 each; keep both inside
  the culling radii set for districts in world.js and thin the scenery ring, not the playable streets.
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
- Roofs / facades: a centroid-fan roof only for convex outlines (L / T / U shapes get the inset hip roof); window tiles
  must end on a whole storey (the storeys above a shopfront too, archetype parapets plain), or a sliced row shows at the roof.
- Fine wires / pickets / nets: thin two-sided strips in `c.detail` (no shadow pass), never boxes: the frame budget.
- Flat ground layers (`area` / `grass` / `pave` / `sport`) write no depth and draw in mesh order, so a later cell's lawn paints
  over anything crossing a cell border: markings over a ground go in a layer drawn after it (`c.sport` for pitches).
- Do not call a `const` helper from code that runs earlier in `buildWorld` (signs run inside the building loop): use a
  function declaration (hoisted) or define it first — `clearPortal` once broke the boot.

- Never invent gameplay places either: gas stations come only from OSM `amenity=fuel` (the invented fallback forecourts were
  removed); never drop or move a real building to fit anything.
- The player's collision body is the cockpit model (nose 3.42 m ahead of the eye, boot 2.36 m behind: `player.front/rear`),
  not a box centred on the eye; anything checking the player's footprint (traffic SAT, pedestrians) offsets by it.
- No instant position snaps for people in view (knock-downs, un-piling, getting back to the sidewalk line): move them at a
  walking pace (`adoptLine`, `walkGoal`), a teleport is only acceptable out of the player's sight.

Owner preferences (from play-test feedback)
- Reality first: real footprints, heights, roof shapes / colours, shops, trees, parked cars; nothing empty or dead, including
  outside the playable area (real buildings and streets in a 600 m ring, boxes only beyond).
- Show evidence: game-vs-reality comparison images for the whole district, not a sample.
- Ask before deploying; keep the owner posted with short updates while long jobs run.
