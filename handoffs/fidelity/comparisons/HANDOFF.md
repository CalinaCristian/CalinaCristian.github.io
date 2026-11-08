# Romană / Victoriei / Dinamo comparison baseline

This worker changed only this handoff. No game source/data, global docs, raw imagery or generated evidence is committed. There is no master push.

## Open the evidence

- [Navigable overhead comparison portal](/workspace/reality-pass/fidelity-goal/comparisons/index.html)
- [Romană spawn game / aerial](/workspace/reality-pass/fidelity-goal/comparisons/romana-spawn-pair.jpg)
- [Arnia / Europe House game / aerial](/workspace/reality-pass/fidelity-goal/comparisons/arnia-europe-house-pair.jpg)
- [Piața Victoriei game / aerial](/workspace/reality-pass/fidelity-goal/comparisons/victoriei-pair.jpg)
- [Dinamo game / aerial](/workspace/reality-pass/fidelity-goal/comparisons/dinamo-pair.jpg)
- [Baseline visual findings and limitations](/workspace/reality-pass/fidelity-goal/comparisons/BASELINE-REVIEW.md)
- [All 11 game-only obliques](/workspace/reality-pass/fidelity-goal/comparisons/master58129/oblique/index.html)
- [Six close roof diagnostics](/workspace/reality-pass/fidelity-goal/comparisons/master58129/roofs/index.html)
- [D5 window-plane failure](/workspace/reality-pass/fidelity-goal/comparisons/master58129/oblique/d5-west.jpg)
- [D5 A/B jitter evidence](/workspace/reality-pass/fidelity-goal/comparisons/master58129/jitter/d5-jitter-sheet.jpg)

The portal links the complete historical [195-pair overhead atlas](/workspace/reality-pass/romana/aerial-final-v2/index.html) and [1,144-pair / 55-street Street View archive](/workspace/reality-pass/romana/streetview/index.html). They retain their historical source labels. Top-down uses satellite/aerial imagery; Google Street View is ground-level imagery. No new Google images were fetched.

## Source and camera provenance

New baseline frames are from exact published master **`58129abe74a93be2ef52d3c3bf40682768531bc3`**, exported using `git archive` into `/workspace/reality-pass/fidelity-goal/comparisons/master58129/source`. The worker branch base `7349ab4` contains initial unverified fixes and is not used for the baseline frames. A [361-file frozen source manifest](/workspace/reality-pass/fidelity-goal/comparisons/master58129/source-manifest.json) includes the reference-mosaic SHA256. All source hashes were checked unchanged after the captures.

The overhead pairs are square, 250 m across, north up, height `216.50635094610968` m above local ground, pitch −90°, horizontal FOV 60°, 720 px square; high quality, summer, clear day. Romană spawn `44.44191,26.099036`; Europe House `44.45118,26.08795`; Victoriei `44.4529,26.0862`; Dinamo `44.45513,26.102319`. Dinamo uses the Floreasca world; others use Romană. Exact projected camera coordinates, rotations, height and FOV are in each `camera-poses.json` and the [combined manifest](/workspace/reality-pass/fidelity-goal/comparisons/comparison-manifest.json).

Reference is the existing local Esri World Imagery `m18.jpg` + `m18.json`, zoom 18, exact Web Mercator origin and pixel dimensions. The computed pixel extent is retained separately from the requested bbox. No manual image shift was applied. Source attribution: Esri, Maxar, Earthstar Geographics, and the GIS User Community. Acquisition date is unavailable in cached metadata, explicitly labeled and not inferred from timestamps. Perspective top-down frames match the ground plane; tall roofs expand relative to their footprint. All imagery remains local and must never be committed or published.

The 195-pair atlas is historical `b10d8d3` with three explicitly linked later overrides. The Street View archive has earlier frozen sources and labeled retakes. Neither archive is presented as a complete master58129 retake.

## Findings handed to root / geometry

1. **Confirmed visible D5 failure** in `d5-west.jpg`: blue facade/window strips span open space and neighbouring volumes. Source parent `w180556785` (Bl. D5), centre `44.4514250,26.0870147`. Exact capture uses lat `44.451425`, lon approximately `26.08594499`, height 40 m, heading 90°, pitch −16°, FOV 75°. [Source neighbour inventory](/workspace/reality-pass/fidelity-goal/comparisons/source-neighbours.json) retains parts `w923421208`, `w923426818/819/820`, `w923435909`, `w923520626/627`, with tagged heights and minimum heights.
2. **H6 remains un-cleared**: parent `w236091148`, `44.4518141,26.0878938`, parts `w1517168167`–`w1517168170`. South camera is occluded by/inside Europe House glazing; do not count it as a pass. East/west frames are retained for future targeted retakes. A single quiet angle is not sufficient to clear intermittent facade flicker.
3. **Ambasador source identified**: `w442813528`, `44.4419905,26.0996406`, east/right of Romană spawn. Frozen master constructs upper tiers with independent rectangles and rooftop lettering at rotation `Math.PI`. Three obliques retained; full tier support and intended text face still require geometry-worker verification. No clearance is claimed from wide images.
4. **Roof candidates retained**: [23 concave pitched/pyramid source rings within 230 m of spawn](/workspace/reality-pass/fidelity-goal/comparisons/concave-spawn-sources.json), six close oblique frames. `w342604772` near `44.4409335,26.0978592` shows a narrow triangular seam/vertical patch at a rear roof junction that warrants geometry review. `w1229725844` and nearby angular roofs west of spawn have close frames. Runtime archetype rules can flatten a data-pitched roof, so the serialized class alone is not evidence of the instantiated form. No blanket roof fix or full street-intrusion clearance is claimed.
5. **Jitter evidence scoped to its pose**: [raw results](/workspace/reality-pass/fidelity-goal/comparisons/master58129/jitter/results.json). Existing `zfightDiff` detector at 640×360 after a +0.001 m X/+0.001 m Y move: D5-west 6 blocks, Ambasador-NW 0, H6-west 0; identical-camera controls all 0, zero page errors. Unlit clones retain texture/depth/polygon-offset state; no cockpit mask because rig is hidden. Six D5 blocks concentrate on upper/horizon strips. Do not attribute every changing pixel to the central tower or use H6's zero to clear other angles.

## Checks and reuse

- Four overhead pairs, 11 obliques and six roof frames visually reviewed on sheets; D5 west and two roof frames also opened full resolution.
- Capture runs reported zero page errors. Pixel probe zero page errors.
- Portal local-link scan: zero missing paths. Browser: zero page errors / failed responses; location navigation works; atlas table 195 rows.
- Frozen source: all 361 hashes unchanged.
- No game source/data changed, so no game logic/performance acceptance claim is made. These main-view evidence captures are not a world + traffic + mirror performance test.

Local reproduction assets under `/workspace/reality-pass/fidelity-goal/comparisons/`: `build-portal.py`, `check-portal.cjs`, `jitter-probe.cjs`, `source-neighbours.py`; immutable master view lists under `master58129/{romana,dinamo,oblique,roof}-views.json`. Use `NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs`; every browser launch mutes audio. `build-portal.py` regenerates the local HTML and sheets; it does not fetch images. `check-portal.cjs` serves locally and validates browser navigation. `jitter-probe.cjs` intentionally names the frozen baseline path.

For final combined-source retakes, archive the exact root-supplied commit into a new scratch source directory and reuse these view lists. Keep baseline images/metadata intact; use a separate candidate label and directory. Do not run the evidence server against a changing worktree. Root is expected to request final targeted retakes after geometry integration.
