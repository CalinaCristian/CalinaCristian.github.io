# Source road paint, joins and closures

The immutable baseline is root `406a53f1f1f1397a1667ea1bc77df78289a5667a`.
`freeze.mjs` copies only exact Git runtime blobs. `native-capture.cjs` loads
SeaTac and Bellevue through `game.startFreeRoam` at High/noon/clear/summer.
Static camera observations do not move any actor or exercise a driving route.
The native clock is frozen by the ordinary harness loop stop; original native
construction, populations, source geometry, and collision remain active.

The baseline completed at 2026-11-09 11:25:09.970 UTC and closed its browser.
It preserved 149 native vehicle actors and 180 pedestrians in each district.
All 224 copied source blobs were checked before and after, and every served
file was checked against the same Git/SHA ledger. There were no page, console,
or HTTP errors. The baseline harness did not stamp its own hash at launch;
the candidate harness adds that check. Original baseline pixels and reports
are retained unchanged in `baseline/`.

Concrete baseline source witnesses:

- Airport Expressway edge26, source w23609850: both right asphalt corners and
  both left corners collapse to identical points. Its half-width alignment
  changes from 5.55/9.25m to 7.4/7.4m at edge27 over a short bend. An offset
  miter extends past the entire leg before `asphaltCorners` collapses it.
- All 5.659148m² of edge26's attempted paint is discarded. Across SeaTac,
  28 multi-lane painted legs are shorter than the old 4.5m initial gap and
  289 are shorter than one 12m US dash cycle.
- Closure edge792 has a 9.8m visible span after dressing mutates its frame;
  its already-created physical wall spans 8.9m. Boundary normalization and
  removal of this mutation are owned by the separate Pipera/root lane.
- The two-way motorway/trunk central-median render branch has no native
  SeaTac instances in this baseline. Its full-edge render versus trimmed
  collider mismatch is a separate code defect, not the attributed cause of
  the photographed SeaTac outer separation fragments.

The correction uses existing full-width junction-pad geometry for a degree2
join whose miter cannot fit either adjoining leg. Source coordinates, widths,
road arrays, tags and layers are unchanged. Dash stations continue only along
literal same-source, compatible degree2 chains, stopping at actual pads,
controls, branches and lane/width changes. Convex clipping retains each valid
paint fragment inside its source ribbon and outside the actual competing
same-level footprints, preserving the existing level/class priority. An
explicit non-affine height exception retains the previous point policy.
Generated central-median render is deferred until its actual collision
intervals have survived the existing lane cuts. Real OSM barriers are untouched.

The first native candidate `4e6361949fa7b81513c86d0ef63dd5ab8cf7bbbf`
repaired the degenerate native SeaTac ribbons and preserved the complete
source dataset, source widths/layers and profile report. Inspection of its
matched Bellevue views exposed another paint defect: source-station dashes
could enter the stop/zebra envelope that the old restarted gap had hidden.
The follow-up reserves each actually emitted stop/zebra envelope, including
the chosen crossing setback, before emitting longitudinal paint. Pads remove
their complete mouth footprint, avoiding small paint fragments in their rim.
This first candidate remains intermediate evidence, not final acceptance.
Independent native comparison also caught a 0.390379m Bellevue service leg
(edge475) whose valid 0.039038m strip between two bevel pads was erased by
the old less-than-5cm collapse guard. The final guard collapses only a
nonpositive/numerically-zero longitudinal side. The controls now replay that
last guard literally and include this exact short-leg regression. Original
intermediate captures and the failed comparison remain preserved.

Root reassigned the remaining closure-decoration work (the worksite/props and
backdrop strip clipping) to the Pipera boundary lane. This branch does not
claim that the Bellevue closure cluster or all outer guard fragments are fixed.

`controls.mjs` includes actual complete native SeaTac/Bellevue source-corner
replays and focused continuity, clipping, winding, area, level, priority,
non-affine, source-identity and short-leg controls. This CPU replay is not a
native candidate acceptance. Matched candidate captures and any unresolved
visual/collision issues will be recorded separately; no all8/15/37/900 gate
or driver pass is claimed here.

## Ready source and native proof

Runtime `bc896279c798e007ffd16dffc5163b331e06d4c3` is the reviewed candidate.
The implementation series is `4e636194` → `bcefbe52` → `bc896279`.
Nineteen CPU controls, syntax and whitespace checks pass. The final immutable
native source loaded both districts and closed at 2026-11-09 11:59:10.619 UTC.
All 226 copied Git/SHA blobs were verified before/after and every served file
was verified. Page, console and HTTP errors were zero.

The independent native comparison in `validation/native-comparison.json`
checks all actual ribbon polygons: SeaTac's three zero-area source ribbons
are repaired, and both districts have zero degenerate source ribbons. Every
new native bevel pad and its source legs retain centerline coverage; the
Airport Expressway edge24–28 quarter-metre samples are also covered. Source
data, all source edge coordinates/IDs, widths/layers and the complete native
profile reports are identical to baseline. Both districts preserve all 149
native vehicle IDs and 180 pedestrians and report initial admission/binding
true. Those flags are recorded diagnostics, not independent full-body proof.

The three final 1440×900 pictures in `final-bc896/` were inspected against the
same baseline cameras. The corrected join and crossing envelopes are visible;
the nearby skybridge camera provides the Bellevue width/join control. Exact
source tags and before/after native polygons for all newly beveled joins are
included in the comparison report. The exact latest user screenshot location
could not be independently matched from its description alone.

Final recorded native static frame counters peak at 375 calls / 720,915
triangles. These are the actual Render3D stats for the requested High views,
with the ordinary mirror call immediately before `frame(0)`; they are not the
final all8 budget gate or a hardware FPS result. The affine clipping path
retains the previous policy for 39 SeaTac and 11 Bellevue non-affine input
exceptions. Intermediate failed native comparison and original raw geometry
are kept. Original additional captures remain under
`/workspace/reality-pass/road-marking-closure-{406a,4e636,bcef}-native/`;
the full manifests retain their hashes, while the portable package includes
the three matched before/after views and the intermediate crossing negatives.

Outer inferred guard fragments, closure worksite/prop placement and the wider
reported Bellevue junction/bulge scene remain separate unresolved scopes.
Pipera/root own the common boundary-support/closure-decoration follow-up.
Root's combined foot/a, all8, mobile15, phone37 and long physical acceptance
remain required on the eventual integrated source.
