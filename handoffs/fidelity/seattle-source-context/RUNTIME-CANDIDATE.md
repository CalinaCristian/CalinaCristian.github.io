# Seattle source-context runtime candidate

This is a reviewable runtime/data candidate, not a native visual/release pass. All browsers in this lane are closed. Root owns the combined source freeze, final native allocation and publication; no remote push has occurred.

The candidate replaces procedural midrise/tower scatter and the clamped exterior apron only in Pike Place and Seattle Center. It preserves the original close-up DEM queries, authored streets and current native source records. The literal city dataset retains 17028 building records, all source rings/holes/tags, original OSM identities and complete selected relation member lists. Seven elevated parts without a usable minimum-height/level remain raw, named and withheld before CSG. The complete modeled subset has 17021 records / 17278 volumes. The manifest enumerates actual source closure issues and unmodeled structural grades/decks; the earlier prototype ledger is historical, not a current completeness count.

`r20085315` is an existing source defect: the native record concatenates two separately closed outer rings into one invalid64-point polygon. The guarded scene correction skips that malformed body and uses the two complete literal outer components. Raw native data remains unchanged. Pike's existing Needle model reuses `w12903132` and its uniquely contained source parts rather than a second generic source tower; this is an explicit hero replacement, not a far-scene physical-parity assertion.

The numeric assets total about 27 MiB. The lossless binary cache avoids base64 string retention and repeated GPU attribute uploads for each spatial chunk. Shader-input stream equality, source ownership, cache rejection controls, actual indexed bounds and shared attributes are CPU checked. The typed arrays stay in one 105 MB numeric backing buffer; no scene/world is stored in the global packet. New ground/solid groups do not enter the crowd step-probe grid. This does not establish mobile memory, loading or submitted triangle/draw budgets.

Ground CPU controls check every retained triangle centroid against its actual emitted-face query, sampled independent Raycaster hits, every original seam sample, and source water masks. Derived water-clip seam error is reported separately. Serialization-invalid sub-Float32 fragments are rejected by orientation/side classification without spatial padding; all literal source rings remain retained. The complete reports are in `proof/runtime-candidate/`. These are geometry-only tests, not actual authored scene walks or picture acceptance.

Reproduction from retained external source cache:

```sh
node tools/osm/build-spot-context.mjs --tiles /workspace/reality-pass/seattle-source-context/tiles --terrain /workspace/reality-pass/seattle-source-context/terrain-surround.json --ledger /workspace/reality-pass/seattle-source-context/source-ledger.json --bbox=-122.375,47.596,-122.31,47.645 --frame game/data/spots/seattle-center.json --out /workspace/reality-pass/seattle-source-context/final-context.json
python tools/osm/audit-spot-context.py /workspace/reality-pass/seattle-source-context/tiles /workspace/reality-pass/seattle-source-context/final-context.json /tmp/context-source-audit.json
node tools/osm/bake-context-plan.mjs /workspace/reality-pass/seattle-source-context/final-context.json /tmp/context-plan.json
node tools/osm/bake-context-render.mjs /workspace/reality-pass/seattle-source-context/final-context.json /tmp/context-plan.json /tmp/context-render.bin.gz
node tools/osm/source-context-controls.mjs /workspace/reality-pass/seattle-source-context/final-context.json
node tools/osm/context-surface-controls.mjs /workspace/reality-pass/seattle-source-context/final-context.json
node tools/osm/context-cache-controls.mjs /workspace/reality-pass/seattle-source-context/final-context.json game/data/spots/seattle-context-render.bin.gz
```

After root merges newer geometry kernels, rebake the plan/cache against those exact bytes and update asset hashes before freezing a native capture. The runtime intentionally rejects stale kernel hashes. Preserve previous proof/kernel hashes as historical; never relabel old pixels. The next required gate is an actual public-app cold load and Pike/Needle ground/elevated/activity/walking/weather/phone views with submitted r3d.stats, source/camera metadata and full-size inspection, followed by affected overview synchronization. Market facade/canopy realism and the earlier blocked Gum Wall approach remain open until that native investigation.
