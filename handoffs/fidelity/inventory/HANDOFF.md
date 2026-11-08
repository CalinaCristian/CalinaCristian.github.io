# Inventory handoff

Base: `7349ab481f87acefb59ff9d260d671e0aacb0907`. Branch: `fidelity/location-inventory`. Edit boundary: `handoffs/fidelity/inventory/` only. No game/source/global specs/status changes, push, branch creation, merge or deployment.

Delivered an exact registry snapshot and dependency queue: 8 districts, 61 landmark entries with 60 source builders, 24 tourist entries grouped into 19 scenes, 43 proposed tasks, 6 reserved current workstreams. All locations have source/review/check status and an owner/task record; proposed owners remain unassigned. `rainier`/`olympics` backdrop flags and every district's separate scenery-only memberships are retained. Historical specs' 57-model build count is stale.

The manifest preserves current Dinamo, Ambasador/geometry, signals/collisions, conditions, comparison and global invented-location ownership. District data/research, function-scoped models, shared scene members, helper owners, dependencies, conflict groups and unique branch/worktree names are explicit. Proposed branches/worktrees were not created. The single briefing generator emits one selected task, its gaps/evidence and inherited acceptance requirements, avoiding a repeated full-context prompt.

Evidence inspected: AGENTS.md, specs/STATUS.md and specs 12/15/20; current fidelity goal/orchestrator prompt; actual CITIES, LANDMARKS and SPOTS_ALL/READY/DEV_SPOTS declarations; district dataset measurement/scenery availability; local Romană and rebase-master evidence README texts, Street View/aerial coverage notes. No reference images were reviewed/copied and no fresh game/runtime QA was performed. The runtime skill environment check was read; no secret values or reference imagery enter these artifacts.

Floreasca/Romană historical reference passes remain open due to material fidelity gaps and newer owner reports. Six other districts have no current complete reality-pass evidence established by this inventory. The source registry lists 12 READY tourist entries; readiness is not a completion claim. Missing/estimated facades, scene-side historical audits, incomplete botanical ravine, generic roofs/canopy, legacy/off-district models and absent source-linked Floreasca comparison index remain explicit.

Validation passed:

- `node handoffs/fidelity/inventory/verify.mjs`: exact registry hashes/metadata/counts, all entity task/check records, unique proposed task/branch/worktree names, one owner per shared builder/scene, complete memberships and acyclic dependencies.
- `node --check` on `source-snapshot.mjs`, `brief.mjs`, `verify.mjs`.
- Brief generation for `S-SEATTLE-CENTER` and `D-PIPERA` showed shared members, exact scopes, gaps and evidence without loading the whole manifest into worker context.
- `git diff --check`.

Root launches subsequent workers from the latest tested staging SHA, not blindly from this inventory snapshot. Current registry hashes will intentionally make the verifier fail after later source edits until inventory refresh/review. Root retains final staged integration, combined reference/controller/collision/performance acceptance, latest-master fast-forward/remote verification and scoped cleanup. The goal is not complete merely because this inventory is complete.
