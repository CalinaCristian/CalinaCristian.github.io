# Own-checkout disk relief · 9 November 2026

Reclaimed **766,849,024 allocated bytes (731.32MiB)** by unlinking12,331 closed duplicate checkout files. Measured target `du -B1` reduction is exactly the same. Global free space immediately afterward was1,689,022,464bytes; its concurrent increase was766,767,104bytes because other lanes continued writing. Source objects, protected refs, pushed branch and the worktree remain intact.

Only this worker’s `game/data/*` and published `game/overview/comparison-data/*` duplicates were eligible. Every removed file matched its exact source31ed Git blob, independently hashed Git-object/local SHA256, and the retained **canonical root checkout** SHA256. Canonical root files were read-only and remain at `/workspace/CalinaCristian.github.io/<path>`. All roughly1GB handoff/raw-proof directories, private evidence/reference roots, untracked/user originals and other lanes were preserved. `game/data/README.md` differed from the canonical root and was preserved. No directory-tree deletion, source snapshot/clone, browser or server was used.

Immutable source: `31ed79e0d89ef131a701b1c7ec04c0155f64f18b`.

Protected local ref: `refs/fidelity/retained-worker-source/old-town-before-sparse-31ed79e0`.

The exact source commit was verified on pushed branch `fidelity/backgammon-result-confirmation-20261109` before removal. Its original result candidate, older dialogue/result branches and every source object remain retained. This receipt is a separate later proof-only commit; it does not replace/relabel original source or captures.

`verified-files.jsonl.gz` is the compact per-file source/canonical/blob/SHA256/size/allocation/stat manifest. `removed-files.jsonl.gz` identifies the exact subset actually removed. `verification.json` records the pre-removal verification and cwd/argv/open-FD scans. The conservative initial verifier returned nonzero solely because it demanded every candidate match; its one README mismatch was then excluded, not removed. `receipt.json` records successful verified-subset removal, exact measurements and repeated process scans with no non-audit reader. Its manifest SHA256 values protect the compressed receipts.

The worker’s own linked-worktree index now marks removed paths **skip-worktree**, so no deletion is staged. No common sparse-checkout/config or another worktree/index was changed. This worker cannot serve a full world/overview until the required files are restored; use the canonical root for active validation. Do not let a branch switch blindly repopulate these duplicate assets.

## Restore when explicitly needed

The source blobs remain available without checkout: `git show refs/fidelity/retained-worker-source/old-town-before-sparse-31ed79e0:<path>`. Inspect one blob at a time; no full-tree copy is needed.

To restore the removed tracked paths for the **current branch**, first ensure enough space (~767MB) and verify no listed path has become an untracked/user original. This example refuses to overwrite existing files. It clears only this worktree’s skip bits and restores from currentHEAD; source31ed remains separately pinned for dated reconstruction.

```python
import pathlib, gzip, json, subprocess
root = pathlib.Path('/workspace/fidelity-workers/old-town-nightlife')
receipt = root/'handoffs/fidelity/old-town-worker-disk-relief-20261109/removed-files.jsonl.gz'
with gzip.open(receipt, 'rt') as stream:
    paths = [json.loads(line)['path'] for line in stream]
assert all(not (root/path).exists() for path in paths), 'Preserve existing originals; review these paths first'
# Review current tracked paths before applying this after later branch changes.
subprocess.run(['git','update-index','-z','--no-skip-worktree','--stdin'],
               cwd=root, input=b'\0'.join(p.encode() for p in paths)+b'\0', check=True)
subprocess.run(['git','restore','--source=HEAD','--worktree',
                '--pathspec-from-file=-','--pathspec-file-nul'], cwd=root,
               input=b'\0'.join((':(literal)'+p).encode() for p in paths)+b'\0', check=True)
```

For exact original source31ed rather than currentHEAD, use the protected source ref after reviewing branch differences. Never restore over untracked/user originals. No restoration command was run during this cleanup.
