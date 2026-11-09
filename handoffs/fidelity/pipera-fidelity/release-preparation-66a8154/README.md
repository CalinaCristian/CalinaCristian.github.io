# Read-only release and cleanup preparation

This inventory is a preparation snapshot around root `66a8154a21a1584e6766fd1b9be684e55efc5171`, not FINAL runtime acceptance. Root and bridge refs advanced during inspection; `inventory-66a8154.json.gz` records both the pinned source and root HEAD observed at the end (`819cdd51…`). Refresh all refs, statuses, consumers and owner holds before release or cleanup. No branch, tag, master ref, worktree, production file or remote was changed by this lane. Cleanup remains **HOLD**.

The user then requested an overview preview. Root published `e354a500e95a5f741564becf528af1f9445bd265` on master. A read-only Git-tree check confirms all 177 external overview asset/report/media paths exist, and no runtime/public/landing file outside `game/overview` changed from `df9b2e2…`. This is a tree-closure check, not a deployment/browser claim. The exact external path lists are included; they contain favicon plus public tourist evidence. Source/research links in provenance records are not local runtime dependencies.

## Refs and preservation

The snapshot contains 74 local refs, 26 live remote heads, 101 worktrees, 15 dirty worktrees and 636 dirty/untracked entries. Every local/live-remote tip and worktree HEAD has exact commit parents/tree metadata. All referenced remote objects were available locally. The 66 `fidelity/*` branches are task worker branches; `fix/dinamo-and-ambasador` is the task staging branch owned by root. `master` is the release target. `work` was created from `FETCH_HEAD` at `cd75d627…` and has zero commits outside the preview master; its ownership is not assumed merely from its name. Root must classify it under the user's master-only instruction. Preserve the three existing local evidence tags.

The actual `archive-evidence.py` dry-run at 66a found 58 capture sources, 68 archive parents and zero missing capture objects. It created no tag. The dry-run covers named local worker/staging tips and published capture records, but it does not automatically include divergent live remote tips or every detached source checkout. The following were uncovered:

| Live remote task branch | Exact tip |
|---|---|
| `fidelity/facade-rendering` | `27b364c3d778cd5e7b2f858227b450038e34c52a` |
| `fidelity/grozavesti-fidelity` | `ed8fb52099722aa0867a524f49e6c3cded1ab676` |
| `fidelity/lipscani-activities` | `7b493a6d629bdaa06c4b303b1e6f9d48cda63458` |
| `fidelity/mobile-controls` | `9ddbd6351dde187c3d00eecb5aba37f3de47ecca` |
| `fidelity/mobile-transition-crash` | `30b466c54487c1c538fd81385f69e76b34005185` |
| `fidelity/signals-collisions` | `e0d3a041ca117532558f9182896c199c2930e557` |

Detached `/workspace/reality-pass/original-districts-refresh/bridge-ordering-native/source` at `143dca860f4d1e2e8b947f3579e18359f474064e` was also uncovered. Root/bridge tips that advanced after the dry-run are recorded as additional temporal gaps, not tool failures. At the final freeze, rerun the plan and add any still-uncovered live remote tips, detached heads and durable draft snapshots as archive parents before removing refs. Confirm the archive is published and reachable before cleanup; do not silently assume the current dry-run protects them.

## Drafts and held work

`held-text-drafts.json.gz` is a lossless safety bundle for 47 text files, with paths, base heads, modes, content hashes and stable-read checks. It preserves the two explicitly requested original tourist drafts unchanged:

| Original path in `tourist-context-activities` worktree | SHA-256 |
|---|---|
| `game/dev/harness/tourist-context-capture.cjs` | `9b6ff39bd888d929c332bbd8e593c9bcd8eea7beeea5cb031b15a083fbc50900` |
| `handoffs/fidelity/tourist-context-activities/review-notes.json` | `9b71979bdc48c9b0f659e2d36c62d195884b351bda79cb0e4c0fdb50ae4905cf` |

Other retained text drafts include older facade, mobile, transition, traffic, rail and QA tools/diagnostics. Their capture is preservation, not acceptance or permission to remove their worktrees. Another 584 binary/generated/large entries remain held in place; `game-overview` alone has 588 untracked paths including captures. Branch/tag reachability does not preserve uncommitted or ignored content. Do not use force-removal of worktrees to bypass those holds. `held-copies-and-owners.json` records active workers, exact raw exports, private references, constructor fixtures and owner declarations. Preserve all raw reports/captures/references and current source dependencies.

Verify or restore the text bundle without touching originals:

```sh
python handoffs/fidelity/pipera-fidelity/release-preparation-66a8154/verify-held-drafts.py
python handoffs/fidelity/pipera-fidelity/release-preparation-66a8154/verify-held-drafts.py /tmp/new-private-draft-restore
```

## Disk candidates, no deletion

QA confirmed these source copies are closed and reconstructible. All their payload files were read and matched against exact Git blobs. The only non-Git file in each was `qa-source-manifest.json`; every such manifest has now been preserved losslessly outside the source copy and included here. Complete file/Git-blob inventories are retained. No current direct argv/cwd consumer was found, and QA's reported PIDs 394390, 410619, 361893 and 355926 were independently observed as zombies. Recheck at action time; process inspection alone is not proof of every future dependency.

| Exact closed SOURCE directory under `/workspace/integration-qa-evidence/` | Allocated bytes | Source commit |
|---|---:|---|
| `default-spawn-fcb60c84-source` | 627,441,664 | `fcb60c84a7909ceacd682ffb1ab26133c18ac22a` |
| `menu-d53da8ff-source` | 753,254,400 | `d53da8ffb633bdceeafa8302e3e818e42f69c69b` |
| `menu-headlights-e12abd00-source` | 627,253,248 | `e12abd000b5488ea0adf291731a9ee7cee7b77df` |
| `transitions-c4fd6255-source` | 792,920,064 | `c4fd6255f928101e27874f37776ed5be8d805827` |

These four account for approximately **2.6085 GiB allocated**, all single-link files. Smaller closed `fountain-memory-06d471c4-source` and `groz-support-6cb-source` add roughly 228 MiB but are lower priority; retain them unless root decides otherwise. **Only SOURCE directories are candidates.** Their sibling `*-native` reports, images, exports, launch records and source manifests stay. Additional retired RO/combined source copies named by owners are listed separately and have not been byte-verified. No deletion has occurred; root retains the decision, and latest steering keeps cleanup on hold.

## Minimal logical curation without a full checkout

Use the latest fetched `origin/master`, now including the overview preview, rather than the stale local `master` (58129abe at inventory). After all FINAL gates, pin an accepted **pre-stamp** root A. In the existing root checkout, run the existing release stamper only after A is committed and its runtime files are clean, then commit its three metadata files as accepted stamped checkpoint S. The stamp correctly identifies archived tested source A; it need not identify the curated-history commit. Preserve A/S and all source/proof/draft parents in the immutable evidence archive.

`plan-curation.py` partitions base→A paths into runtime/tests/tools, overview/docs, and proof groups and emits exact mode/blob `index-info` instructions. It verifies actual Git tree hashes in memory without creating Git objects, indexes or refs. The preparation run from preview e354 to 66a has 798 runtime/test paths, 28 overview/doc paths and 3,060 proof paths. Its final virtual tree exactly equals `66a^{tree}` (`e2fa0ebc1daac28efbbfc17d23e1601352cf9b6f`). This demonstrates the mechanism, not acceptance of that older runtime.

At FINAL, rerun the planner against fresh master and A. Root can then use a temporary `GIT_INDEX_FILE` outside every checkout: `read-tree` the base, apply each group's `update-index -z --index-info`, `write-tree`, verify the expected tree, and create one `commit-tree` child per nonempty logical group. This materializes no overview images or game assets. Suggested groups are:

1. Runtime, source data, physical game systems and tests.
2. Overview/docs and final behavior notes (the preview is already on master).
3. Validation reports and immutable capture provenance.
4. Only `index.html`, `game/index.html`, `game/release.json` stamp blobs from S.

After group 3 require literal tree equality with A. Apply only the three A→S stamp blobs as group 4, then require the final curated tree to equal **S exactly**. Do not claim literal post-stamp equality to an unstamped tree. The stamper normalizes the release/source meta lines, so canonical tested runtime content stays unchanged. No second full worktree is needed. Only after review, final acceptance, fresh upstream comparison, archive publication and durable draft preservation should root update/push master and later remove released task refs/worktrees. This lane has not executed any of those actions.

Reproduce the preparation:

```sh
python handoffs/fidelity/pipera-fidelity/release-preparation-66a8154/inventory.py /workspace/CalinaCristian.github.io FINAL_SHA /tmp/new-ref-inventory.json
python /workspace/CalinaCristian.github.io/tools/fidelity/archive-evidence.py --source FINAL_SHA --out /tmp/new-archive-plan.json
python handoffs/fidelity/pipera-fidelity/release-preparation-66a8154/plan-curation.py /workspace/CalinaCristian.github.io origin/master ACCEPTED_PRESTAMP_SHA /tmp/new-curation-plan
```

No tag or deletion flag belongs in this read-only preparation. Final reset-free 23-frame native budget work remains held until root supplies the actual FINAL source.

## Authorized source-copy reclamation after preparation

Root explicitly authorized removal of the four previously certified closed QA source copies only. Each copy was reverified against its original Git tree and preserved producer/per-file ledgers immediately before removal; no active process or held consumer used it. `authorized-source-cleanup-receipt.json` records exact paths, checks and observed recovery of 2,808,541,184 bytes. All raw reports, captures, six producer/per-file ledgers, worktrees, branches and other source copies remain. The receipt is a narrow later action; the original66 inventory remains dated and unchanged.
