# Legal source street sweep planning

The old longest-street fixture chose a farthest pair of source nodes. On Splaiul Independenței, that pair lies on opposite one-way river banks, without a legal connection inside this source district. Both route directions return null. The previous full visual run therefore remains incomplete.

The planner retains that original pair and both router outcomes in `visual.json`. It groups only edges sharing actual source nodes, verifies routes with the production Navigator, and covers every public legal directed edge on the requested street. It adds camera runs when a branch or direction needs one. A tiny endpoint inset can disambiguate a junction snap; it never edits source nodes, road shapes, access, lane counts or graph connections. Private and virtual exclusions remain explicit. Requested uncovered directed source edges make report coverage incomplete even if every planned image was captured.

`game/dev/harness/visual/fixtures/grozavesti-splai-source.json` preserves the exact 7 road records and 28 source/cut nodes from Grozăvești delivery `cf174db`, dataset SHA256 `48d8c39e95bfacc85302130cabc5e99cb3fed8806746cb8f1b248a06643fa27e`. The production Navigator verifies two legal bank runs, each about 260 m, covering all 26 directed source edges and retaining 12 forward samples at 40 m spacing. No connector or U-turn was added. The original farthest pair remains unreachable in both directions.

Validation:

- `node game/dev/harness/visual/street-sweeps.test.mjs`: 31 assertions, including the exact Splai fixture, ordinary bidirectional and one-way streets, a branch, a short component, an unavailable router, illegal reverse/virtual paths, and a private-only street.
- `node game/dev/harness/visual/coverage-check.cjs`: report-level controls verify requested source-edge gaps fail, unrequested sweep gaps do not invalidate a chapter-only request, missing/duplicate samples fail, and raw detector findings remain unchanged.
- JavaScript syntax checks and `git diff --check` pass.

These pure routing and report controls are not final visual acceptance. Actual browser captures use the final combined runtime/source snapshot after the remaining shared runtime changes land.
