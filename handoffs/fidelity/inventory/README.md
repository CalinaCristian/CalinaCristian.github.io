# Remaining location inventory

Snapshot: `7349ab481f87acefb59ff9d260d671e0aacb0907`, 2026-11-08. This inventory inspected registry/source declarations, specs and available local evidence **text**. It did not inspect comparison images or run new game acceptance checks.

[manifest.json](manifest.json) records **8 districts, 61 landmark entries / 60 builder functions, 24 tourist spots / 19 scenes**, 43 proposed tasks and the six existing workstream reservations. Every entity has a task, source/review evidence status and required check profile. No entity is marked complete. Historical “57/57 landmarks build” statements are stale relative to the actual 61-entry registry.

`LANDMARKS[].backdrop` is distinct from a district's `scenery` list. Only `rainier` and `olympics` have `backdrop: true`; many additional landmarks are scenery-only in particular districts. Models absent from district lists remain inventoried, including the two Murrow IDs sharing `bMurrow`. The source scanner records actual IDs, builder names, citations, coordinates and district/scenery membership without building browser modules.

| City | District IDs | Evidence state |
| --- | --- | --- |
| Bucharest | `floreasca`, `romana` | Aerial measurement files and historical reference passes exist; material source/parity gaps and current owner reports remain open. |
| Bucharest | `grozavesti`, `unirii`, `pipera`, `otopeni` | Research/implementation exists; complete current reality-pass comparisons and acceptance are unproven. |
| Seattle | `seatac`, `bellevue` | Research/implementation exists; complete current reality-pass comparisons and acceptance are unproven. |

Only Floreasca and Romană currently have baked `data.scenery` plus roofs/trees/green measurement files. Romană's local index reports 1,144 Street View pairs (1,142 usable), 195 aerial tiles and a historical full performance survey. Those captures have immutable older source snapshots and localized retakes; they do not certify the current tree. Floreasca's spec describes street-by-street comparisons, but this inventory did not locate an exact source-linked comparison index under `/workspace/reality-pass`. Missing evidence remains missing.

The actual tourist registry has 24 `SPOTS_ALL` entries, 12 in `READY`, and no `DEV_SPOTS` entries. Unready spots remain loadable by ID; `?spots=all` exposes them for review. A READY flag reflects a historical listing gate, not full current fidelity acceptance.

| Shared scene | Member spot IDs |
| --- | --- |
| `seattle-center` | `chihuly`, `space-needle`, `mopop` |
| `buc-parliament` | `palace-parliament`, `peoples-salvation-cathedral` |
| `buc-old-town` | `old-town-lipscani`, `stavropoleos-cec` |
| `buc-herastrau` | `village-museum`, `herastrau-park` |
| Single-member scenes | `pike-place`, `fremont-troll`, `kerry-park`, `waterfront`, `pioneer-square`, `ballard-locks`, `gas-works`, `bel-lincoln-square`, `bel-downtown-park`, `bel-botanical-garden`, `bel-meydenbauer`, `athenaeum-revolution`, `arcul-de-triumf`, `spring-palace`, `cismigiu` |

Reserve the current Dinamo, Ambasador/geometry, signal/collision, conditions, comparison and invented-location work. In particular, do not assign another worker to the fictional Old Town bar while the global locations audit owns that question. Complete the six remaining district data passes, Floreasca/Romană residual work, model groups and scene groups in dependency order. Every scene task owns all its member spots. Model tasks own explicit functions and associated rows only; `bMurrow` must never be split between workers.

Use a separate branch **and** worktree/checkout per active worker; branches do not isolate one shared directory. Keep one root integration owner and at most six workers. Assign generic world/data/render helpers and spot kits/registry to single owners. Freeze shared changes before starting dependent work; precise helper requests return to that owner. Disjoint model functions can have separate workers, but their shared-file diffs still integrate sequentially. Proposed branches/worktrees in the manifest are names only; this inventory creates none.

The manifest describes conservative waves: reserved fixes → shared helper freeze → six new district passes → two district residual passes → model batches → scene batches → combined QA. Root may start independent tasks earlier only when their dependencies and edit boundaries permit it. Rebase new workers on the latest tested staging SHA; the inventory's base is historical provenance, not the future launch base.

Generate one compact briefing per worker instead of repeating the full orchestrator prompt:

```bash
node handoffs/fidelity/inventory/brief.mjs D-PIPERA /workspace/fidelity-workers/d-pipera FROZEN_STAGING_SHA
node handoffs/fidelity/inventory/verify.mjs
```

The verifier checks registry hashes and exact entity metadata/coverage, unique tasks/branches/worktrees, scene/function ownership and an acyclic dependency graph. It deliberately reports stale inventory when source registries change. Refresh/review the snapshot when integrating later changes. It is an inventory consistency check, not gameplay QA.

Root integrates commits one at a time into staging, resolves semantic overlaps, freezes the combined tree and runs the complete logic/controller/collision/reference/performance gates. Fetch latest master and integrate owner changes, rerun affected checks, then use the owner-authorized normal fast-forward/push and verify the remote before deleting only this effort's branches/worktrees. No force-push, unrelated cleanup or deployment claim follows from completing this inventory. Native `/goal` is unavailable; these tracked artifacts are the queue.
