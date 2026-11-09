# Copy-paste orchestrator prompt

Act as the integration owner for this repository's fidelity, gameplay and performance goal. Start by reading AGENTS.md, specs/00-vision.md, specs/01-architecture.md, specs/STATUS.md and handoffs/fidelity/FIDELITY-GOAL.md. Inspect the actual checkout and current upstream; preserve existing user changes. The user has authorized parallel agents on their own branches, final tested integration to master, and removal of this effort's branches. Use Git name CalinaCristian and email cristycalina@gmail.com.

Fidelity is a release gate. Review all remaining districts, landmarks and tourist locations against the applicable sources, not only a small set of examples. Never claim 100% parity merely because every screenshot was reviewed. Source gaps and known defects remain unresolved until sourced and fixed. The current reports and reproduction IDs are in FIDELITY-GOAL.md. The user also explicitly requires performance, pedestrians, collisions and signal behavior.

## Isolation and context

1. Fetch master first. Create a staging/orchestrator branch from the verified base. Create a separate git worktree or checkout and task branch for every concurrently active worker. Branches alone do not isolate one shared working directory.
2. Spawn workers with fresh context (`fork_turns="none"` where supported). Send only their compact task brief, exact worktree/branch, owned files/functions, relevant specs, evidence paths and acceptance checks. Do not fork this conversation or send a huge transcript.
3. Limit concurrency to available slots. Keep one integration owner. Assign shared systems (world/render/traffic helpers, schemas, global data and docs) to one owner per wave. Landmark agents may edit only their assigned function/data rows in landmarks.js; no whole-file formatting, shared material changes or neighboring models.
4. Keep district data/research tasks separate by district. Schedule shared landmark-model work so it does not race a district agent over the same function/data. Group tourist locations that share a scene under one scene owner. Inventory IDs come from cities.js, LANDMARKS and the spots registry, not memory.
5. Every worker writes `handoffs/fidelity/<task-id>/HANDOFF.md`: base SHA, branch, owned files, exact source changes, tests, performance, reviewed artifact paths, remaining issues and requested integration edits. Workers do not edit global STATUS/spec logs or push master. They commit only their own changes.

## Worker brief template

You own task <id> in worktree <absolute path>, branch <branch>, based on <SHA>. Read AGENTS.md, <relevant specs> and only the source files needed for this task. Do not switch branches outside your worktree. Your edit boundary is <files/functions/data rows>. Your objective is <specific observable behavior/reference mismatch>. Inputs/reproductions: <IDs, coords, local artifacts, source URLs>. Existing local imagery may be absent in a new environment: regenerate it with the repository's generic tools and configured secure credentials; never paste keys or commit imagery. OSM tags win over aerial measurements; measurements win over defaults; Street View supplies visual comparisons only. Keep the high-quality traffic/mirror budget <=1.5M triangles and <=400 calls. Use muted browser tests and inspect screenshots. Run <specific meaningful checks>. If you need a shared change outside your ownership, write a precise integration request; do not independently rewrite that subsystem. Produce <concrete outputs>, commit your work, and return a short handoff with SHAs and unresolved issues. Do not publish or push master.

## Research and implementation gates

- Use OSM footprints, building parts/courtyards, tagged heights/roofs, mapped parking, businesses and facilities. Audit complete core + 600m ring coverage and source identities. Do not shrink/delete/move a real structure to make a road prop or invented facility fit.
- Use aerial imagery for overhead roof/canopy/ground comparisons and measurements; Street View for matching street-level visual comparisons only. Retain source dates, unavailable coverage, exact poses and comparable/noncomparable classifications. No imagery in git or public reports.
- Remove fabricated gameplay places everywhere, not only district mode. Clean dead constructors, map/UI paths and assumptions; preserve sourced places and valid gameplay without fake stand-ins.
- Test the reported defects directly: nearby-camera jitter for facade overlap; top-down and oblique roofs; tier support; sign-facing street views; pitch-wide continuous controller trajectories and both goals; hostile traffic phases; pedestrian/collision paths; initial/menu/conditions selections through travel and Continue.
- Keep source geometry and useful density while optimizing. Use measured frame costs, source/geometry invariants and culling/LOD where justified. Do not hide fidelity errors by deleting visible content or loosening budgets/detectors.

## Integration and completion

Review each worker diff and handoff. Merge or cherry-pick into staging one at a time, preserving the user's newest master changes. Resolve semantic overlaps, not only textual conflicts. Run the mandatory logic harness, appropriate complete district visual/traffic survey, close drone and night/weather checks, meaningful regression tests and budget stress on immutable snapshots. Inspect the pictures and retain raw findings. Repeat only tests justified by subsequent changes.

Maintain a compact task manifest with every district/landmark/scene, owner, branch, source coverage, tests, artifacts and unresolved parity gaps. Run successive waves until the goal's gates are actually met. Do not silently turn an unknown detail into a claim of fidelity. If a required source/key/decision is missing, finish independent work, state the exact blocker and request only the missing input. Secrets go in secure environment settings.

Before release, fetch master again and rebase/integrate any newer user fixes, rerun affected checks, then fast-forward/push master with normal Git protection. Verify the remote contains the integrated result before deleting this effort's feature branches (local and remote) and worktrees. Leave unrelated branches and user changes intact. Report the final master SHA, verified coverage/budgets/tests, evidence links, and any genuine unresolved blockers. Monitor workers until completion; do not stop at spawning them or preparing a plan.
