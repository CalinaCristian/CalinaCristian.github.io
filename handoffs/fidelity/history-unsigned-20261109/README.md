# Signature-label removal · 2026-11-09

The owner explicitly requested all existing master history have no verification labels, superseding the earlier never-rewrite-master direction for this operation only. GitHub reported the yellow sample as `unknown_key` with a signature, the green sample as `valid`, and the badge-free newer commits as `unsigned`. Vigilant mode was not the cause.

Original tip `9f6dd1a98b86c7f65aa83e4481e09ba8bcd39f56` was rewritten to `dc5339f4da79e6fb84b8f98d9e241aa352e8bdf6`: 113 commits retained; 97 signatures removed; 108 commit IDs changed through parent ancestry. All trees, messages, author/committer identities and dates, and parent topology were validated unchanged. The prepare-only script never updates refs. Publication used an exact original-tip force-with-lease; subsequent API readback confirmed all 113 commits are unsigned. No keys or account setting changes were required. New commits use local `commit.gpgsign=false`.

Before rewriting, all fetched remote heads, local heads, worktree heads and referenced capture/internal-proof commits were retained by remote annotated tag `fidelity-evidence-before-unsigned-history-20261109` (archive commit `b0a6c23c75069d70d6c06e28a7571f161dca61d5`). All 169 recorded capture sources were available; no missing/invalid objects, invalid JSON, or unretained worktree heads. The tag was pushed and read back before the rewrite. Original evidence revision links remain reachable through this archive. The existing source records are not relabeled.

The operation changed Git metadata only; the master tree is identical. Later playable-preview publication is a separate change. Existing old signed commits remain historical archive objects; master has none.
