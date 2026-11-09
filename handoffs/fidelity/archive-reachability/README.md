# Evidence archive reachability correction

The archive planner now retains every local branch tip, fetched non-symbolic
remote-tracking tip and registered worktree HEAD, including detached sources.
Overview capture, implementation and prior-record links keep their existing
retention rules. Each ref/worktree tip is a direct archive parent; a source-record
commit already reachable from a parent records that covering parent instead.
The archive commit keeps the requested source tree byte-for-byte.

Schema 2 retains the existing `sourceCommit`, `tree`, `captureSources`,
`archiveParents` and `missingCommitObjects` fields. `commitProvenance` records
every origin, its object status and its covering archive parent. `worktrees`
retains exact paths, branch/detached state and lock/prune metadata;
`excludedSymbolicRefs` explains excluded aliases. Missing/non-commit objects or
unexpected absent worktree HEADs produce a nonzero exit and a reviewable `--out`
plan, and block tag creation. Existing tags cannot be replaced.

No normal dry run changes Git objects, refs or source files. `--out` writes only
the caller's requested JSON report. Only explicit `--write-tag` creates an
archive commit and annotated tag; the utility never fetches, pushes or deletes
branches/worktrees. Remote-tracking refs are only the last fetched snapshot.

## Validation

Run `python3 handoffs/fidelity/archive-reachability/test_archive_evidence.py`.
Six bounded controls use disposable Git repositories, no browser or network:

- Byte-for-byte dry-run preservation, including Git internals, plus complete
  source/ref/worktree provenance and a path containing spaces, Unicode and newline.
- Annotated archive creation, unchanged source tree/record dates and actual
  survival of local/remote/detached/capture/implementation/prior/keyed-source
  commits after fixture branch/worktree removal, reflog expiry and Git GC.
- Missing capture and missing detached worktree commits remain explicit and
  fail closed; a non-commit remote tip also blocks archive writes.
- Reusing a tag refuses before creating another archive commit or changing refs.

Read-only actual-repository plan on source `3ce03474cbd7a8825f3d809b3c54cd0aba2af4ab`:
58 source-record commits, 111 unique parents, 72 local refs, 1 fetched remote ref,
102 registered worktrees, zero missing/invalid commits. The detached native
`143dca860f4d1e2e8b947f3579e18359f474064e` is now a direct parent with origin
`/workspace/reality-pass/original-districts-refresh/bridge-ordering-native/source`.
This is a snapshot before root fetches all remote task heads; it is not final
archive coverage. No actual-repository archive commit or tag was created.

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
> and prior-record source commits. Its JSON plan shows ref/worktree provenance
> and missing objects. Dry runs are read-only; only explicit `--write-tag`
> creates a new immutable annotated archive, keeping the selected source tree
> and evidence dates unchanged. Fetch all remote heads before final archival.

For RESUME/FIDELITY-GOAL's final archive/cleanup checkpoint, use:

> Archive reachability correction is tested with six temporary-Git controls:
> all local heads, fetched non-symbolic remote heads and detached worktree HEADs
> now have explicit retention provenance; capture/implementation/prior links
> remain covered, missing objects block writes, and existing tags are immutable.
> Root still owns the final all-remote fetch, fresh exact-source plan, explicit
> final archive tag/push/readback and inventory-controlled branch/worktree
> cleanup. No final archive tag was created by the correction worker.
