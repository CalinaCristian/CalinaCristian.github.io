# 19 — QA: logic harness + visual QA (definition of done)

Owner role: **qa**. Everyone uses it.

The harness must catch the visual problems a person notices, not only logic errors.

## Logic harness (shipped)
`npm run harness` (all), `-- --scenario=<id>[:<street>] --city=<c>`, `-- --audit`. Report `game/dev/harness/report/latest.md` (not tracked in git). Scenarios a–i; per-frame invariants; static audit.

## Visual QA (in progress)
R19.1 `npm run harness:visual` surveys every chapter route (from `CHAPTERS`) and district main streets: HUD-hidden forward shots every ~40 m, side/back looks + top-down orthographic tiles every ~200 m, cockpit shots at 1280×720, 1920×1080, 2560×1080, 844×390.
R19.2 Detectors: coplanar overlaps (z-fighting), stacked ribbons (0.05–4 m), markings outside ribbons / across junction pads, flipped triangles, ribbon gaps, floating/sunk objects, buildings over roads, black/hole pixels in the road region, jitter-diff flicker, nav screen frustum/occlusion, DOM HUD overlaps, canvas text overflow (fillText monkeypatch).
R19.3 Human-style review: the QA agent LOOKS at every contact sheet and writes `game/dev/harness/visual/report/review.md` — numbered defects with location + severity + likely cause, grouped by category. Re-run after fixes.
R19.4 Tourist spots and on-foot routes included when they exist (spec 14/15).
R19.5 Fast loop: subset flags (`--city`, `--chapter`, `--from/--to`, `--no-aerial`, `--viewports`); full run < 15 min in software GL.

## Definition of done (any requirement in any spec)
1. Acceptance criteria met, evidence in the spec's progress log.
2. Logic harness: 0 high; no new medium issues in the area touched.
3. Visual QA: detectors clean in the area touched; review.md has no medium+ defect in the area touched.
4. Orchestrator integration run passes; then `done` in STATUS.md.

## Requests
## Progress log
