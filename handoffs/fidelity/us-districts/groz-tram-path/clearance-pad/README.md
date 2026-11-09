# Source crossing pad clearance follow-up

The d77 source tram span stopped connected-leg traversal at a real motor crossing but returned zero extra distance. A27m tram could therefore be placed with its bumper at the crossing centre. This follow-up applies the existing native long-body pad rule: stop the body outside the native radius plus1.5m. A terminal source leaf at a real junction uses the same stop constraint; plain source/boundary leaves keep their previous endpoint rule. No motor geometry, topology, ordinary-car source buffer, IDs, fleet or RNG changes.

The baseline-vs-candidate fixture executes the unchanged d77 pure helper and current source span on identical source geometry. Baseline forward span ends86.5m (front100m); candidate ends80m (front93.5m), exactly outside the5m pad plus1.5m native margin. Reverse tail clearance also changes13.5→20m. Actual Traffic step methods on the isolated600tick fixture stop with front93.202m, preserve the actor and report rail-source-boundary. This is a CPU control with empty peer/static sets, not full native-world acceptance.

All263Groz actor/sixmesh source-binding controls, mapped-stop/boundary motion and two-way rail/motor claim priority were rerun and pass. Previous235/d77 proof bytes remain unchanged in their existing paths/history; this subdirectory records only the clearance follow-up.

Reproduce with the exact d77 helper saved into scratch, then run test.mjs from this directory using its baseline module path as the only argument. Git show d77ab012:game/src/tram-path.js supplies those baseline bytes. No browser was opened.
