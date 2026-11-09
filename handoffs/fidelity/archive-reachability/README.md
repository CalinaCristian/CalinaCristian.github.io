# Evidence archive reachability correction

The archive planner now retains every local branch tip, fetched non-symbolic
remote-tracking tip and registered worktree HEAD, including detached sources.
Tracked JSON under `game/overview/evidence`, `game/overview/comparison-data` and
`handoffs/fidelity` supplies capture, implementation, prior-record and internal
proof source/candidate links. Each ref/worktree tip is a direct archive parent; a source-record
commit already reachable from a parent records that covering parent instead.
The archive commit keeps the requested source tree byte-for-byte.

Schema 2 retains the existing `sourceCommit`, `tree`, `captureSources`,
`archiveParents` and `missingCommitObjects` fields. `commitProvenance` records
every origin, its object status and its covering archive parent. `worktrees`
retains exact paths, branch/detached state and lock/prune metadata;
`excludedSymbolicRefs` explains excluded aliases. Missing/non-commit objects or
unexpected absent worktree HEADs produce a nonzero exit and a reviewable `--out`
plan, and block tag creation. Existing tags cannot be replaced.

The scanner accepts full 40-character commit/revision/baseline/source fields,
including `candidateCommit`, `parentMaster` and `sourceSha`, source-map SHA keys
and existing exact-repository GitHub links. Explicit commit hash fields such as
`baselineCommitHash` remain supported. File/blob/tree/image/digest fields,
SHA-256 values, paths used as dictionary keys and unrelated key words such as
`committee` are excluded. JSON blobs stream through one `git cat-file --batch`
process; object types are checked in one batch and parent reachability uses one
commit-graph read. `recordScan` lists scan counts, empty placeholders and invalid
JSON. Empty placeholders contain no references and are explicit; nonempty
invalid JSON blocks writes because its source references cannot be checked.
Compressed raw reports are not parsed; their tracked manifests remain scanned.

No normal dry run changes Git objects, refs or source files. `--out` writes only
the caller's requested JSON report. Only explicit `--write-tag` creates an
archive commit and annotated tag; the utility never fetches, pushes or deletes
branches/worktrees. Remote-tracking refs are only the last fetched snapshot.

## Validation

Run `python3 handoffs/fidelity/archive-reachability/test_archive_evidence.py`.
Ten bounded controls use disposable Git repositories, no browser or network:

- Byte-for-byte dry-run preservation, including Git internals, plus complete
  source/ref/worktree provenance and a path containing spaces, Unicode and newline.
- Annotated archive creation, unchanged source tree/record dates and actual
  survival of local/remote/detached/capture/implementation/prior/keyed-source
  commits after fixture branch/worktree removal, reflog expiry and Git GC.
  Unreferenced internal `candidateCommit`, `parentMaster`, `sourceSha` and
  source-map commits survive the same actual GC, with original proof dates.
- Missing capture and missing detached worktree commits remain explicit and
  fail closed; a non-commit remote tip also blocks archive writes.
- Missing internal proof commits keep their exact record provenance and block
  writes; image/file/tree/SHA-256 and misleading-key controls are excluded.
- Empty historical JSON placeholders are listed; nonempty invalid JSON blocks
  archive creation without changing Git state.
- Identical JSON blobs at different tracked paths retain every record origin.
- Reusing a tag refuses before creating another archive commit or changing refs.

Read-only actual-repository plan on source `3ce03474cbd7a8825f3d809b3c54cd0aba2af4ab`:
58 source-record commits, 111 unique parents, 72 local refs, 1 fetched remote ref,
102 registered worktrees, zero missing/invalid commits. The detached native
`143dca860f4d1e2e8b947f3579e18359f474064e` is now a direct parent with origin
`/workspace/reality-pass/original-districts-refresh/bridge-ordering-native/source`.
This is a snapshot before root fetches all remote task heads; it is not final
archive coverage. No actual-repository archive commit or tag was created.

Follow-up read-only plan at root source `57ba8f97ea9aae00e786a15b7f7e8ac3317cbe28`:
1,763 tracked JSON files (1,350 unique blobs), 165 recorded source commits,
117 parents and zero missing/non-commit/invalid-JSON objects. Four historical
zero-byte JSON placeholders are listed in the plan. All 58 previously recorded
source commits remain included. Unpublished overview first candidate
`a553a44455cdf1f7b4af32eae86dbfb57d924cfb`, with no branch/worktree HEAD, is a
direct parent with five internal proof origins, including `first-release-plan.json`
and `first-pass-report.json`. Counts describe that ref snapshot, not final remote
coverage; root must still fetch all remote task heads before the final archive.

## Root completion procedure

1. Integrate this branch's code, fixture and handoff together. Root owns global
   README/spec/status wording; suggested text is below.
2. After final source commits and all workers stop changing refs, fetch every
   remote's branch heads explicitly. For origin, the non-pruning form is
   `git fetch origin '+refs/heads/*:refs/remotes/origin/*'`. The leading `+` updates
   only local remote-tracking refs; it never pushes or rewrites remote history.
   Repeat for other remotes. Run fetch from root, not this worker lane.
3. Run `python3 tools/fidelity/archive-evidence.py --source <final-source-sha>
   --out <final-plan.json>` as one command. Check zero missing/invalid/unretained
   objects; inspect `commitProvenance` against the remote/dirty-file inventory.
   In particular verify all six previously uncovered remote task tips and the
   detached native SHA above. The planner includes existing objects only and
   cannot discover remote heads that were never fetched.
4. With those gates complete, root may explicitly run the same command with
   `--write-tag <new-final-archive-tag>` and a fresh report path. Recheck the
   created archive's parents/tree and push that immutable annotated tag.
5. Verify the tag and archived source commits are reachable on the remote before
   deleting only the effort's branches/worktrees. Keep all dirty-file backups
   and raw/incomplete reports under the existing inventory/cleanup procedure.

## Exact suggested global documentation wording

For the existing README developer-tool/archive description, append:

> `tools/fidelity/archive-evidence.py` plans retention of all local branch tips,
> fetched remote-tracking tips and worktree HEADs, plus capture, implementation
> and prior-record source commits, including tracked internal proof JSON under
> `handoffs/fidelity`. Its JSON plan shows ref/worktree/record provenance
> and missing objects. Dry runs are read-only; only explicit `--write-tag`
> creates a new immutable annotated archive, keeping the selected source tree
> and evidence dates unchanged. Fetch all remote heads before final archival.

For RESUME/FIDELITY-GOAL's final archive/cleanup checkpoint, use:

> Archive reachability correction is tested with ten temporary-Git controls:
> all local heads, fetched non-symbolic remote heads and detached worktree HEADs
> now have explicit retention provenance; capture/implementation/prior links
> and internal proof/candidate JSON remain covered, missing objects block writes,
> nonempty invalid JSON blocks archival, and existing tags are immutable.
> Root still owns the final all-remote fetch, fresh exact-source plan, explicit
> final archive tag/push/readback and inventory-controlled branch/worktree
> cleanup. No final archive tag was created by the correction worker.
