# Native acceptance console accounting

The final mobile UI, marked-map, headlights and repeated-district runners now retain every browser console error and reject unexpected errors. Page exceptions alone do not establish a clean run.

The transition runner deliberately loads malformed destination JSON to test failed-travel Continue. It records the exact one expected `[world] district load failed` error, with its console index and fixture reason. All other console errors remain failures; the expected error is preserved in the raw report rather than filtered out.

Validation for this tooling slice: Node syntax checks and `git diff --check`. Final runtime executions remain separate acceptance evidence; this change makes no new runtime-pass claim.

Root owns the final source selection, README/spec consolidation and release.
