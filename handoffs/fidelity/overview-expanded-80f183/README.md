# Expanded overview delivery and mobile layout check

## Preserved failing source

The unchanged committed `game/dev/harness/overview-current-check.cjs` ran from a
complete, read-only `git archive` of
[`80f18372804cc083359260d06c1c950319feb7b4`](https://github.com/CalinaCristian/CalinaCristian.github.io/tree/80f18372804cc083359260d06c1c950319feb7b4).
All 15,632 extracted files (1,094,037,385 bytes) matched their exact Git blob
identities before the browser; all file SHA-256 values remained unchanged after
the run. `source-identity.json` records the source tree, tool and runtime identities.
`source-files.json.gz` retains every source-file hash. `checked-assets.json.gz`
enumerates precisely the asset paths checked by the tool.

`attempt-01/report.json`, `run.log`, execution timestamps and desktop screenshot
are the actual failed run, kept unchanged. The report independently records:

- All eight current atlas collections (865 frames) and historical atlases
  (2,159 frames) loaded through their real selectors.
- Every current context/street-walk collection loaded, including full pagination:
  1,320 captures, with 2,637 image/thumbnail asset references.
- All 61 landmark records and 24 destination records loaded, including historical
  studies and their native-report links where present.
- All 9,044 distinct local game images/thumbnails hashed and browser-decoded;
  zero page or console errors. The 199 historical Romană thumbnails whose original
  ledgers lack hashes retain that explicit gap and separately observed hashes.
- **Mobile layout failed:** 390 px viewport, 421 px document width. Both dedicated
  evidence selectors were 48 px tall. The cache block was **not run** after the
  assertion failed; no cache success is inferred from this attempt.

Three sequential read-only diagnostic browsers (each closed before the next)
retained their exact helper versions, reports, logs and mobile screenshots under
`diagnostic-01/` through `diagnostic-03/`. The first broad bounding-box survey also
listed intentional locally scrolling tables; the final text-range/section-hiding
diagnostic establishes the actual cause: full commit hashes in `.lm-evidence`
list notes/checks extend to x=420.984375. Hiding `#coverage` restores document
width to 390 px. `failed-run-review.json` distinguishes the successful asset checks,
the layout failure and unrun cache controls. Original image dates/SHAs and all
evidence metadata are unchanged.

The aerial response is intercepted with a tiny synthetic fixture by these local
UI checks. It is **not live-provider browser proof**. The previously documented
cloud Chromium TLS limitation remains; no trust setting was changed. These checks
do not establish photographic parity, game WebGL performance, hardware FPS or a
physical-phone result.

## Reproduction

With Playwright installed, invoke the exact committed tool with an exact source
archive and a fresh output directory:

```sh
NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules \
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs \
node ROOT/game/dev/harness/overview-current-check.cjs ROOT OUT FULL40SHA
```

`system-chromium-preload.cjs` is the exact non-secret environment preload used by
this run; it only selects `/usr/bin/chromium`. `run-check.py` records timestamps,
argv, exit code and a complete post-run source-byte check. Each browser is muted.
Source/output arguments and PIDs in raw execution records are historical facts,
not assumptions about a current running process.
