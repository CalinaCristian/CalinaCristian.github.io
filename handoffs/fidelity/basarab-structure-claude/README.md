# Packs A and B (Claude) · Basarab structure, traffic queues · 2026-11-10

Branch `fidelity/basarab-structure-claude`, from live master `139ab165`, with master merged in twice (`e21797e7`, then
`54ab3d3e`; no conflicts either time).
**Nothing here is published.** No owner report is closed by this branch: closing needs the original report poses, which were
not available (see "Not available"), publication and live verification by the integration owner.

## Commits (each applies on master by itself, in this order)

| commit | scope | shared files |
| --- | --- | --- |
| `c82b1fa5` | bridges: planned bents, closed slab slot, crowns out of elevated decks | `game/src/world.js` (+ new `bridge-bents.js`) |
| `dda67f21` | traffic: visible crossing knots open by bounded reversing | `game/src/traffic.js` |
| `d538aaad` | traffic: recovery "in view" test bounded at 700 m | `game/src/traffic.js` |
| `6c07fd94` | merge of `origin/master` (`e21797e7`) | none conflicting |
| `576adda5` | bridges: Basarab superstructure candidate r9 integrated selectively | `game/src/world.js`, `trees.js`, `bridge-bents.js` (+ four new modules) |
| `93f11cb0` | merge of `origin/master` (`a5f80d75`), conflicts resolved in `trees.js` and `world.js` | see Update 2 |
| `53c66104` | trams: body support costs less with identical results | `game/src/tram-body-support.js` (+ test and oracle fixture) |
| `d1883e09` | traffic: tram progress check (failing), CPU candidate evaluation, docs | none |

To keep master linear, cherry-pick `c82b1fa5`, `dda67f21`, `d538aaad` and `576adda5` in that order; the merge commits
(`6c07fd94`, `02562dea`) carry no change of their own.

## Update 3 · trams run, tram railings (2026-11-10)

The owner asked for both: fix the held trams, and the Basarab details.

**Trams (pack B).** A deterministic audit (`game/dev/harness/tram-sweep-audit.cjs`: the game's own tram pose and rail
guard at every metre of every rail leg) found 1051 of 14,831 poses refused by 65 static bodies on Grozăvești, ten of them
this branch's own bridge piers and one its stay. Now 105 poses, all at one estimated structure:

| commit | what | shared files |
| --- | --- | --- |
| `50988aac` | world: generated objects stay out of the tram sweep (new `tram-sweep.js`) | `world.js`, `basarab-structure.js` |
| `9e8ff070` | guard: a pitched tram is tested with the height of each stretch; height cache bounded | `initial-traffic-admission.js`, `initial-vehicle-admission.js` (**integration owner: please review, this refines your guard**) |
| `a4743707` | traffic: a tram plans its stop inside the district | `traffic.js` |
| `d1cdaf37` | world: tram viaduct railings, bridge guard collision band above a tram below, inferred shelters out of the sweep | `world.js` |

- `tram-progress-check.cjs`, 180 s: no tram refused on any step (was 3-4 of 4 on almost every step); three travel about
  1 km (in the GPU probe run one of them was on the Basarab deck at 180 s); the fourth stops at the district edge. Romana: 318 -> 0 refused poses, both trams run.
- Nine mapped trees with the trunk inside the sweep are left out and listed (`stats.tramSweep.conflicts.trees`), as
  master does for basins. Two of the nine are inside only the guard's 0.18 m disc reach, not the literal body.
- Five district-edge closure spans are shortened; two of them by about 9 m (roads with embedded track).
- **Open, needs the grade model's owner:** the estimated Basarab tram ramp rises from the fork node while the flat branch
  is still alongside (1.06 m high at 2.72 m separation). Flat-branch trams overlap the slab for about 15 m and are refused
  there (105 poses); one held there also blocks the up ramp. Numbers in `specs/13-traffic.md`.

**Basarab (pack A).** Piers no longer stand where a ground tram sweeps (65 bents + 3 wall piers on 107 columns). The
tram-only slabs have railings: 2099 m, 999 m of it outboard on a walkway strip where the rigid tram overhangs its slab on
a bend, 86 m still open. Budget, High, traffic and mirror, 117 driver poses: max 360 draw calls, 1,441,066 triangles
(about 4 % triangle headroom). Evidence: `evidence/after-tram-railings.jpg` (free-camera views, not report poses).

Not done in pack A: station lift tower (no source position in the district data; it would be a pure guess), inclined
ramp piers, curved lamp posts, the three short unguarded deck edges, the open slot at the north-east end of the station,
low ramps above a street, Ultra, driven journeys, the original report cameras, overview imagery.

Checks on this tree: 68 unit tests, built-world bridge check on all eight districts, tram sweep audit on all eight
(Grozăvești and Romana have trams), tram progress check on Grozăvești and Romana, foot/a 0 high / 0 medium.

## Update 2 · CPU candidate evaluated, tram cost, held trams (2026-11-10)

Master `a5f80d75` merged (`93f11cb0`). It conflicted in `trees.js` (the same `exclude` hook landed on master: master's
text kept) and in `world.js` (master's water-basin tree conflicts next to the covered-platform ones: both are kept and
feed one exclusion set; master's stats plus `bridgeBents` and `treeDeckClearance`).

- **Candidate `67b39084` (pedestrian peer scan, `walkTop` cache): evaluated, not integrated.** State hashes identical over
  180 simulated seconds, no measurable saving (its target runs 3.3 times per step). Details in `specs/13-traffic.md`.
- **Tram body support, same results for less work** (`game/src/tram-body-support.js`, not a shared-world change): four
  trams took about a third of the simulation step. Step 25.6 -> 19.8 ms average over 180 s with identical state hashes at
  every 30 s checkpoint; equality test against the previous implementation in `game/dev/tram-body-support.test.mjs`.
- **Trams are held by static bodies, on master too.** `game/dev/harness/tram-progress-check.cjs` (new, currently
  failing): on master three of four Grozăvești trams are refused on almost every step by the closure wall `w50584780`
  (end 0.35 m past the rail centreline), a generated bollard row reached by the tail of the rigid 27 m body, and a mapped
  chestnut 1.36 m from the centreline. Each refused tram restarts every step, which is the tram CPU cost and why stall
  recovery never fires for them.
- **Correction to the superstructure update above.** "No point of the elevated tram track touches a `basarab-*` member"
  came from a centreline point sweep. With the full rigid body the longest stay's deck anchor end (1.89 m from the
  centreline of rail `w118416425` near (793, -996)) held a tram for 357 steps in one run. That conflict is this
  branch's (from candidate r9), is not fixed, and must be fixed before the superstructure is considered for publication.
- Nothing was changed in the rail guard or in the world for the holds at that point; Update 3 does.

Cherry-pick list for a linear master is now `c82b1fa5`, `dda67f21`, `d538aaad`, `576adda5`, then `53c66104`
(tram body support) and `d1883e09` (tram check and docs); neither touches a shared source file.

Checks on this tree (`93f11cb0` + those two): all 58 `node --test game/dev/*.test.mjs` tests, `vehicle-knot-recovery`,
`recovery-view-range`, the built-world bridge check on Grozăvești, Otopeni and Bellevue, and
`npm run harness -- --scenario=foot,a --city=bucharest` at 0 high / 0 medium. `tram-progress-check.cjs` fails as described.

## Pack A · reports 12-17 (in progress)

**Update, superstructure integrated.** On the owner's instruction the candidate `fidelity/basarab-render-r9` (`81464a88`) was
integrated selectively after the first three commits. The numbers in the list below are from before that integration; the
current ones are:

- Taken: `basarab-structure.js`, `basarab-anchor-clearance.js`, `basarab-source.js`, `covered-platform-canopies.js`, the
  `exclude` hook in `trees.js`, and the `world.js` wiring (guard drawing, structure build, platform/tree conflicts).
- Not taken: `tree-view-selection.js` and far-tree culling, the larger merged render cells (`SUPER`), and the traffic CPU
  commit `67b39084` (pack B; not evaluated yet). `fidelity/basarab-piers-r22` was not used at all.
- Grozăvești now: 72 crosshead bents and 3 wall piers on 125 columns; **47 pier stations are left to the stays and the arch**;
  60 of 60 stays anchored, 0 unresolved; 336 centre-support pieces; 2 literal platforms; 412 slot infill quads (3195 m²);
  3 measured canopies inside a covered platform excluded after generation.
- Frame budget, High, traffic and mirror, 77 driver poses: **max 364 draw calls, 1,405,285 triangles** (about 6 % triangle
  headroom). If more headroom is needed, the candidate's far-tree selection and merged cells are the untaken options.
- No lane of any Basarab bridge edge and no point of the elevated tram track touches a `basarab-*` member or a pier (3998
  lane samples, 1015 track samples). Pre-existing contacts seen in that sweep and not investigated: 18 lane samples against
  tram slabs that overlap a carriageway, and 7 track samples against a lamp or road signs.
- Evidence: `evidence/after-superstructure.jpg`. The three earlier sheets predate the superstructure.
- Still wrong against the real bridge: no station lift tower, plain frames where the ramp has inclined piers, no curved lamp
  posts, and an open slot at the north-east end of the station. The source ledger `game/research/basarab.json` that
  `basarab-source.js` cites is not on the candidate branch.

Found on live master: Pasajul Basarab had **15 piers on about 3.5 km of elevated deck** (placed per short source edge by a
hash), open slots between the carriageway slabs and the tram slabs, and tree crowns standing in the elevated carriageway
(the under-deck rule tested only the trunk, and aerial-measured crowns skipped the narrowing rule).

Now, on Grozăvești (built-world check, High):

- 87 crosshead bents and 3 wall piers, 154 columns, 8 portal frames straddling the street under the viaduct. Columns stand
  only on free ground (no lower carriageway, sidewalk, pad, rail, water, building or mapped tree); minimum crosshead
  clearance over anything below 4.65 m.
- 620 slot infill quads, 3840 m², widest closed gap 5.93 m; every measured slot at one level now has a deck-level surface.
- Trees: 9 crowns narrowed, 4 kept below the soffit, 1 physical exclusion (OSM tree at (137.3, −353.2) under a 3 m soffit).
- Frame budget, High, traffic and mirror, 31 driver poses on and under the deck: **max 356 draw calls, 1,176,621 triangles**
  (targets 400 / 1.5 M). Ultra was not measured.
- The same planner runs in every district: Pipera 3 bents, Otopeni 5, SeaTac 34, Bellevue 2; the others have no elevated
  bridge decks. SeaTac's bents were looked at once; pack D owns that district's acceptance.

Pier positions are a MODEL estimate (30 m bents), not a survey. No support is invented where none can stand: the river
crossing and the rail-yard crossing keep an open span. (Before the superstructure integration those spans read as unsupported; see the update above.)

Still open in pack A:

- Ramp guards and upper parapets: a collision audit of every elevated deck edge facing open air found 2822 of 2835 samples
  guarded; three short unguarded runs remain (r253 at (872, −1097)…(866, −1089), 12 m; r179 at (357, −721)…(352, −717), 14 m).
  The rendered guards were not audited separately.
- The tram-only viaduct has no railings.
- "Missing lower-ramp pieces" / "cut deck underside": the south ramp (road 122, (77, 155)…(86, 41)) and the northern descent
  run in plan directly above a street, too low for any support; they are unchanged.
- Open wedges remain where a ramp leaves the main structure at a different level (more than 1.5 m apart): left open on purpose.
- Both-direction journeys with tram and bus clearance, side and mirror views at the original report cameras, Ultra.
- Overview imagery of Grozăvești / Basarab is now stale and has not been recaptured.

## Pack B · reports 6-9, 18, 37-39, 67 (in progress)

Measured on Grozăvești, High, 311 vehicles and 560 pedestrians, real CPU in headless Chromium on the owner's desktop:

- `traffic.update` costs about **15-25 ms per step** (`stepVehicle` ≈ 8 ms, `peds.update` ≈ 7 ms). The profile is flat; the
  spatial-grid query leads at ≈ 1.6 ms. It did not grow over 15 simulated minutes. District worlds have no level of detail
  at all (`large` is false below 4 km extent). **Nothing has been optimised yet.**
- Live-equivalent traffic runs to a standstill: total vehicle travel per 30 simulated seconds fell from 84.7 km to 1.6 km in
  seven minutes with a stationary player (296 of 311 vehicles stopped).

Two causes fixed:

1. A visible knot could never open: a refused step left the overlap guard before its only back-off, and the path-order
   rule reversed the wrong car in a T-bone. Recorded case: node 210 (Splaiul Independenței / Șos. Orhideelor), twelve cars
   frozen for 95-158 s. Now the nose car reverses at most 0.8 m/s to a real gap and a merge-corner pair settles who yields.
2. Recovery was disabled almost everywhere: the "in view" test was an unbounded frustum (305 of 311 vehicles "visible",
   219 of them beyond 400 m). It now ends 700 m from the active camera.

| vehicle travel per 30 s | live-equivalent | + knot recovery | + bounded view test |
| --- | --- | --- | --- |
| 0-30 s | 84.7 km | 84.6 km | 88.5 km |
| 150-180 s | 12.5 km | 12.5 km | 37.7 km |
| 390-420 s | 1.6 km | 4.3 km | 22.6 km |

Still open in pack B:

- Traffic is still not steady: throughput keeps falling, and at 420 s about 100 vehicles had been stopped for more than two
  minutes in queues whose head is in view within 700 m (`box-full`, `claim` and follower waits). That needs physical
  resolution at the junctions.
- Pedestrian piles are untouched: after 15 minutes 111 of 560 people stood in piles, the largest at (62.8, −469.4) and
  (101.7, −424).
- CPU: first reduction made (tram body support, see Update 2); pedestrians (42-47 % of the step) untouched.
- The Basarab drive that stalls in the integration owner's candidate `1444d5f8` was not reproduced: that commit is not on
  this machine or on the remote.

Found, not changed:

- `Traffic` defines both `get bubble()` (650 m) and the speech-bubble method `bubble(v, kind)`. The method wins, so in the
  legacy corridor worlds every `relocate(v, …, this.bubble, …)` finds no candidate edge and `recycle` never fires.
- The legacy harness scenario `b:dn1` is route-blocked by a barrier wall on live master `139ab165` as well.
- `harness/landmark-cec-source.test.mjs` and `harness/spot-availability.test.mjs` fail on live master (stale expectations).

## Checks run on the merged tree `6c07fd94` (re-run after the superstructure and the second merge, `02562dea`: planner 6/6, traffic tests, Grozăvești and Pipera built-world check, foot/a 0 high / 0 medium)

- `node --test game/dev/bridge-bents.test.mjs` 5/5; `vehicle-knot-recovery` (fails on the previous guard: contact stays at
  0.049 m), `recovery-view-range`, `vehicle-cell-boundary` (updated: only the bounded back-off may follow its rollback),
  `signals`, `vehicle-separation` and the other traffic / pedestrian tests pass.
- `node game/dev/harness/bridge-bents-check.cjs . <out> <city> <district>`: Grozăvești, Otopeni, SeaTac pass on the merged
  tree; all eight districts passed before the merge.
- `npm run harness -- --scenario=foot,a --city=bucharest`: 0 high / 0 medium. Scenarios `b,i` are identical before and after
  the traffic change (the one high issue is the pre-existing `b:dn1`).

## Evidence (captured from this branch on the owner's GPU, headless, High, autumn clear day, 2026-11-10)

- `evidence/after-ground-and-oblique.jpg`: bents from the ground and from above at six stations.
- `evidence/after-slot-and-frames.jpg`: closed slot from above and below, a straddle frame, the tram level.
- `evidence/after-driver-deck.jpg`: twelve driver views on the deck with their draw calls and triangles.
- `evidence/bucharest-grozavesti.json`: built-world check report.

These are free-camera and programmatically placed driver views at stations chosen along the deck. They are **not** the
owner's original report poses and not a driven journey.

## Not available to this lane

`REPORT-STATUS-20261110.md`, `owner-reports-20261110.json` (the 71-record register with the report cameras),
`ACTIVE-20261110.md`, `OWNER-REGRESSIONS-GOAL.md`, `BASARAB-20261110.md`, `NIGHT-DRONE-20261110.md` and the candidate
commits named in the handover (`1444d5f8`, `893e81fd`, `ba8b1c66`, `e0b58319`, `1816a467`) are neither on this machine nor on
any remote branch. The rejected forked-pier study was therefore never seen; this planner is independent of it.
