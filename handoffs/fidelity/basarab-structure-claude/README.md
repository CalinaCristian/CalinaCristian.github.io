# Packs A and B (Claude) · Basarab structure, traffic queues · 2026-11-10

Branch `fidelity/basarab-structure-claude`, from live master `139ab165`, with master `e21797e7` merged in (no conflicts).
**Nothing here is published.** No owner report is closed by this branch: closing needs the original report poses, which were
not available (see "Not available"), publication and live verification by the integration owner.

## Commits (each applies on master by itself, in this order)

| commit | scope | shared files |
| --- | --- | --- |
| `c82b1fa5` | bridges: planned bents, closed slab slot, crowns out of elevated decks | `game/src/world.js` (+ new `bridge-bents.js`) |
| `dda67f21` | traffic: visible crossing knots open by bounded reversing | `game/src/traffic.js` |
| `d538aaad` | traffic: recovery "in view" test bounded at 700 m | `game/src/traffic.js` |
| `6c07fd94` | merge of `origin/master` (`e21797e7`) | none conflicting |

To keep master linear, cherry-pick the first three; the merge commit carries no change of its own.

## Pack A · reports 12-17 (in progress)

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
crossing and the rail-yard crossing keep an open span. **The arch and the cable-stayed structure that really carry those
spans are not modelled here**, so those spans still read as unsupported.

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
- CPU: no reduction made.
- The Basarab drive that stalls in the integration owner's candidate `1444d5f8` was not reproduced: that commit is not on
  this machine or on the remote.

Found, not changed:

- `Traffic` defines both `get bubble()` (650 m) and the speech-bubble method `bubble(v, kind)`. The method wins, so in the
  legacy corridor worlds every `relocate(v, …, this.bubble, …)` finds no candidate edge and `recycle` never fires.
- The legacy harness scenario `b:dn1` is route-blocked by a barrier wall on live master `139ab165` as well.
- `harness/landmark-cec-source.test.mjs` and `harness/spot-availability.test.mjs` fail on live master (stale expectations).

## Checks run on the merged tree `6c07fd94`

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
