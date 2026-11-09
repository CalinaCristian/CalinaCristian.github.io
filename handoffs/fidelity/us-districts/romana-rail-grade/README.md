# Romană source tram underpass model

`game/src/tram-tunnel-grade.js` supplies a pure source-segment grade Map for the shared rail renderer and Traffic. Its dimensions are explicit **MODEL estimates**, not surveyed elevation or measurements from imagery. No data, original source XY/node identity, motor profile/width, actor, mesh or random sequence is changed.

The west-to-east source chains are:

- `w241374323` reversed → `w241374326` reversed → `w243476552` reversed → `w920117610` reversed.
- `w920117611` → `w920117619` → `w920117620`.

West ground joins are literal rail nodes `2927621025` in ground continuation `w40503646`, and `8544126334` in `w920117625`. East joins are `296077845` at the end of ground source `w920117610`, and `8544117714` in ground source `w920117620`; subsequent connected revenue rail stays at the existing unsurveyed zero datum. Other connections there are source `service=yard`, which the source rail runtime excludes. None of the selected rail nodes equals a native motor node. No nearest-road datum or layer/level-to-metres conversion is used.

The two mapped underground stop nodes `8544117695` / `8544117694` share modeled displacement −7.6 m. The floor has a deep core from 15 m inside each source tunnel endpoint to 15 m before the other endpoint, with C1 ramps to the literal zero joins. This explicit estimated transition keeps the actual source ground roads above the raised pantograph while leaving the tagged tunnel endpoints sloped. Peak model grades are 4.801379% / 4.751887%, below the 8% cap. The rail floor has model half-width 1.7 m, top `0.2 + displacement` and thickness 0.35 m.

Only the flat ±30 m station interval per track initially has a roof descriptor: absolute underside −0.3 m, top 0 m. The 120 m total covered model length does **not** claim the full 297.075 / 297.914 m source-tagged tunnel lengths are covered. Roof extent, depth, transitions and portals remain estimated. Actual posed-body clearance is a separate gate, including the literal 5.79 m pantograph geometry plus the 0.24 m actor anchor; the separate motor tunnel's `maxheight=4.5` does not constrain rail clearance.

`controls-source.json` and `controls-native-source.json` pass the C1/source-node/zero-anchor/metric-tag/extra-branch/conflicting-native-node controls. Thirty complete source legs receive a model; all 27 unchanged rendered Romană legs are admitted, including the seven tagged tunnel and two level-only approach legs. Rendering coverage is unchanged: west approach source ways remain retained and unmodeled where the original render runs omit them.

`road-floor-native6cb.json` checks the actual composed shared support quad polygons against every native road ribbon/profile in immutable `constructor-facts.json` (SHA256 `c25b01cc7acf5b1d7cba51b9d1aa234439f431fcb493e297c0683b67d65496cf`, observed source `6cbf82b61de8267f662bf50239c37ccc1764635c`). There are 633 support pieces, 267 positive-area overlaps with overhead road ribbons, zero rail slab/road surface intersections and zero positive-area overlap with the seven adjacent motor tube/approach source ways. Minimum native road-top to rendered rail-floor separation is 7.576640 m. These CPU checks use the recorded shared-builder hash; they do not accept current native rendering, actual moving bodies or their roof clearance.

The rejected initial long-ramp proposal and its immutable floor intersection output remain as `source-proposal-initial-ramp.json` / `road-floor-native6cb-initial-ramp.json`. That proposal produced only 4.488985 m floor-to-ground-road separation and was replaced before integration. It is not a passing headroom model.

Reproduce with Node 24:

```sh
node tools/osm/tram-tunnel-grade-check.mjs
node tools/osm/tram-tunnel-grade-check.mjs /workspace/integration-qa-evidence/romana-constructor-6cb-native/constructor-facts.json
node handoffs/fidelity/us-districts/romana-rail-grade/check-road-floor.mjs /workspace/integration-qa-evidence/romana-constructor-6cb-native/constructor-facts.json /absolute/path/to/game/src/tram-grade.js
```

Shared World floor/sidewall/roof emission, open-ramp ground cuts and the physical support catalogue belong to the bridge lane. Actual rigid-body support fitting and nearest legal source admission belong to US. Current-root native publication/motion, posed pantograph/roof/overhead-road clearance, visual inspection, budgets and all-eight acceptance remain required.
