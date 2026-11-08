Connected shared-lane reservation integration

The previous degree-two-only grouping deadlocked when a public or private wider side road joined the middle of a narrow two-way corridor: opposing vehicles entered its separately reserved halves and could not reserve the next half. A native Traffic trace on the previous gate leaves both cars stopped at x32.48/x47.23 for the entire 80 simulated seconds.

The gate now groups every connected narrow component, independent of wider side entrances. Simple through corridors retain consistent direction across reversed source segments, compatible same-direction platoons, and opposing FIFO batch fairness. Genuine narrow forks, cycles, and corridors that require a dead-end U-turn use one-vehicle admission until the rear clears; no single direction can describe those paths safely. Physical/legal road geometry and ambient population settings are unchanged. The ordinary graph path has no new controls.

Fresh placement respects outstanding entry claims as well as actual bodies. Tail and claim invalidation uses successful relocation generation; a failed respawn attempt's transient `_resp` flag cannot discard a body still occupying the corridor. Opposing waiters close the current batch while its first admitted vehicle is still approaching, so followers cannot indefinitely extend it.

Coordinator documentation delta: replace “continuous degree-two narrow sections” with “connected narrow sections; simple through corridors admit compatible direction batches, while narrow forks/cycles/blind ends admit one vehicle through rear clearance.” The coordinator owns README and global spec wording; this handoff carries the worker contract.

Reproduce focused tests:

- `node --test game/dev/shared-lanes.test.mjs` (16 cases)
- `node game/dev/shared-lanes-topology.mjs <source-district.json>` (source connectivity, independent of unrelated rendering)
- `node game/dev/harness/shared-lanes-check.cjs --case=private --browser=/usr/bin/chromium --out=/tmp/shared-private` (native Traffic, 80 simulated seconds)
- Other browser cases: `straight`, `public`, `narrow` (three-arm narrow junction, three cars), `cycle`, `platoon` (opposite waiter clears before follower), `player` (20-second stopped player then continuous lane-following departure), `light` (native timed signal holds and legal entry). Add `--long` for 12 m buses. `--browser` is optional for ordinary Playwright installations.

These controlled graph captures verify native movement, meshes, body SAT, flow compatibility, full traversal, active population preservation, no ghosting, no stopped slides, no position snaps, and red-signal entry. They do not claim full-world source visual fidelity or full-district performance acceptance. The player fixture follows the appropriate right-side feeder lane when departing the narrow centreline; driving the test player into an opposing waiting car is not counted as a traffic pass.
