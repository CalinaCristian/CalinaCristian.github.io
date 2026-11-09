# Expanded overview acceptance after source-note wrapping

**PASS within the recorded local UI and image-delivery scope.** The unchanged
expanded `game/dev/harness/overview-current-check.cjs` ran once from a complete,
read-only archive of
[`cbf885a7da5337330411b4214f2c86e28d2f9964`](https://github.com/CalinaCristian/CalinaCristian.github.io/tree/cbf885a7da5337330411b4214f2c86e28d2f9964).
Its only production overview change from the failing source is
`.lm-evidence{overflow-wrap:anywhere}`. The full text, source revisions, capture
objects, image bytes, dates and provenance remain unchanged.

The original
[`80f18372` failure](../overview-expanded-80f183/README.md) is preserved separately:
all image checks passed, then its 390 px viewport overflowed to 421 px and cache
checks were not reached. Read-only diagnostics attributed that overflow to full
commit hashes in landmark evidence notes/checks, with text extending to
x=420.984375. The correction wraps those exact strings without hiding overflow
or changing the intentional locally scrolling tables.

## Actual checks

`validation-summary.json` aggregates the untouched raw reports:

| Check | Recorded result |
| --- | --- |
| Current and historical atlas selectors | All eight districts; 865 current + 2,159 historical frames |
| Context and street-walk pagination | All 1,320 captures; 2,637 image/thumbnail references, including three native SeaTac views |
| Dedicated evidence instances | 61 landmarks: 183 current + 6 historical studies; 24 destinations: 70 current + 100 historical studies |
| Image delivery | All 9,044 distinct local images/thumbnails hashed and browser-decoded |
| Focused mobile layout | All 85 landmark/destination selections, max document width 390 px at a 390 px viewport |
| Expanded mobile layout | 390 px document width; both dedicated evidence selectors 48 px tall |
| Mocked aerial cache fixture | Reuse across reload at 10 minutes; refetch after original expiry at 16 minutes |
| Page/console errors | Zero in both focused and expanded checks |
| Source immutability | All 15,665 files match Git blobs before browsers; all SHA-256 values unchanged afterward |

The 199 old Romană thumbnail ledgers with absent historical hashes retain that
explicit gap and separately observed byte hashes. Their original metadata was
not rewritten. The prior [checked asset index](../overview-expanded-80f183/checked-assets.json.gz)
identifies the same 9,044 paths/bytes: the new source inventory independently
verifies that every one is unchanged. All game evidence metadata also remains
byte-identical. The report's `sourceInventory` stays at its actual existing
`ca16fcee1d3a9fcb8798aceaa6170c2007d41174` inventory pin; its separate
`snapshotSourceCommit` identifies the source actually tested here.

`attempt-01/` holds the expanded report, log, execution record and actual desktop
and mobile screenshots. `focused-mobile/` holds the 85-record layout report,
log, execution record and focused screenshots. `screenshot-review.json` records
the pictures inspected and their limits. The focused destination screenshot did
not await lazy image loading and is a text/layout record; the expanded check and
its mobile screenshot provide the complete image-delivery evidence. The desktop
aerial pane is the synthetic intercepted fixture, not real provider imagery.
Both browser processes closed normally before this package was assembled.

## Source and tool identity

- Source tree: `d8815797770fc18a75834c5bbd29410daa825a0f`.
- Full source-file inventory SHA-256:
  `10600a9bf6d075cc51143d975b251628ba7aef328873c9e4ee797b4f39da98e2`.
- Unchanged expanded tool SHA-256:
  `0ef59a6f93354d9c1ae197d1d6b6214ccfc60798ff4294fc2d36c3d622d78ce5`.
- Browser: system Chromium 156.0.8078.79, muted, headless; Playwright 1.62.1,
  Node v24.22.1. No game WebGL scene was loaded.

`source-identity.json` records the archive identity and exact changes from the
original source; `source-files.json.gz` retains all file hashes and Git blob IDs.
`source-postcheck.json` records zero altered files. Exact tool, wrapper and
non-secret browser preload copies are included. Execution records retain their
real timestamps, argv, source and helper hashes. `artifact-hashes.json` hashes
all packaged files except itself.

To rerun the unchanged expanded tool against an exact archive and fresh output:

```sh
NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules \
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs \
node ROOT/game/dev/harness/overview-current-check.cjs ROOT OUT FULL40SHA
```

The aerial cache result is explicitly a **mocked response fixture**, not a live
provider browser result. The existing cloud Chromium TLS limitation remains;
no browser trust setting was changed. This evidence does not establish
photographic parity, physical-phone behavior, game WebGL performance or hardware
FPS. Gameplay, traffic and native route acceptance remain separate source-bound
reports.
