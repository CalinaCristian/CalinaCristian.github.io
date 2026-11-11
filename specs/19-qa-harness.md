# 19 — QA: logic harness + visual QA (definition of done)

Owner role: **qa**. Everyone uses it.

The harness must catch the visual problems a person notices, not only logic errors.

## Logic harness
`npm run harness` (all), `-- --scenario=<id>[:<street>] --city=<c>`, `-- --audit`. Report `game/dev/harness/report/latest.md` (not tracked in git). Scenarios a–i; per-frame invariants; static audit.

## Visual QA
R19.1 `npm run harness:visual` surveys every chapter route (from `CHAPTERS`) and district main streets: HUD-hidden forward shots every ~40 m, side/back looks + top-down orthographic tiles every ~200 m, cockpit shots at 1280×720, 1920×1080, 2560×1080, 844×390.
R19.2 Detectors: coplanar overlaps (z-fighting), stacked ribbons (0.05–4 m), markings outside ribbons / across junction pads, flipped triangles, ribbon gaps, floating/sunk objects, buildings over roads, black/hole pixels in the road region, jitter-diff flicker, nav screen frustum/occlusion, DOM HUD overlaps, canvas text overflow (fillText monkeypatch).
R19.3 Human-style review: the QA agent LOOKS at every contact sheet and writes `game/dev/harness/visual/report/review.md` — numbered defects with location + severity + likely cause, grouped by category. Re-run after fixes.
R19.4 Tourist spots and on-foot routes included when they exist (spec 14/15).
R19.5 Fast loop: subset flags (`--city`, `--chapter`, `--from/--to`, `--no-aerial`, `--viewports`); full run < 15 min in software GL.

## Definition of done (any requirement in any spec)
The driving caller must sense the actual asymmetric player body as well as the planned path. Its bounded swept corridor follows native bicycle steering/lag and uses emitted vertical bounds where available; it must brake for the recorded Unirii truck214 approach while retaining a clear curved lane change. Preserve native physics, signal/target behavior and watchdogs. Focused reconstruction is separate from whole-route acceptance.

For combined root acceptance, `handoffs/fidelity/root-acceptance-archive/prepare-root-acceptance.py` prepares exact committed runtime, current game Node tests and their reviewed dependencies without copying comparison galleries. Keep the native foot/a runner in its archived path because its server root derives from `__dirname`; use the recorded external output directory. Verify the complete archive's file set, Git blobs and SHA hashes before and after tests. Archive preparation controls never count as executed game tests or browser acceptance.

1. Acceptance criteria met, evidence in the spec's progress log.
2. Logic harness: 0 high; no new medium issues in the area touched.
3. Visual QA: detectors clean in the area touched; review.md has no medium+ defect in the area touched.
4. The checks in `handoffs/fidelity/BACKLOG.md` pass; the owner publishes and re-checks live.

## Published overview upkeep

Any change affecting the published overview must update its affected prose, inventory, controls, source/evidence records, links, captions, comparisons and pictures in the same change. This includes district/landmark/tourist images, thumbnails, street/aerial frames, activities and phone captures. Recapture from the exact changed source with real dates, camera/conditions and scope; retain old material as labelled history or validation, never relabel old pixels as new. Inspect full-size images and desktop/mobile delivery, verify affected selectors/decoding/links/cache behavior, and check the live page/images after publication. The shared AGENTS.md rule and CLAUDE.md reminder make this part of completion. External Street View imagery remains comparison-only.




