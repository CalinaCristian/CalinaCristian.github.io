# 19 — QA: logic harness + visual QA (definition of done)

Owner role: **qa**. Everyone uses it. The harness must catch the visual problems a person notices, not only logic
errors. Usage: [`game/dev/harness/README.md`](../game/dev/harness/README.md) and
[`game/dev/harness/visual/README.md`](../game/dev/harness/visual/README.md).

## Logic harness
R19.0 `npm run harness` drives the chapter districts in headless Chromium with per-frame invariants and a static road
audit, and writes `game/dev/harness/report/latest.md` (not tracked). Its autopilot senses the player's actual body
along a short swept steering corridor, not only the planned path.

## Visual QA
R19.1 `npm run harness:visual` surveys every chapter route (from `CHAPTERS`) and district main streets: HUD-hidden
forward shots, side/back looks, top-down tiles, and cockpit shots at 1280×720, 1920×1080, 2560×1080, 844×390.
R19.2 Detectors: coplanar overlaps (z-fighting), stacked ribbons (0.05–4 m), markings outside ribbons / across junction
pads, flipped triangles, ribbon gaps, floating/sunk objects, buildings over roads, black/hole pixels in the road region,
flicker, nav screen frustum/occlusion, DOM HUD overlaps, canvas text overflow.
R19.3 Human-style review: the QA agent LOOKS at every contact sheet and writes `game/dev/harness/visual/report/review.md`
— numbered defects with location, severity and likely cause, grouped by category. Re-run after fixes.
R19.4 Tourist spots and on-foot routes are included (spec 14/15).
R19.5 Fast loop: subset flags (`--city`, `--district`, `--chapter`, `--viewports`); a full run < 15 min in software GL.

## Definition of done (any requirement in any spec)
1. Acceptance criteria met, evidence in the commit message.
2. Logic harness: 0 high; no new medium issues in the area touched.
3. Visual QA: detectors clean in the area touched; review.md has no medium+ defect there; capture coverage complete.
4. The push checks in `AGENTS.md` pass; the change is published and re-checked live (owner reports at the report
   pose).
5. README.md, the relevant spec and the published overview are updated in the same change (AGENTS.md → "Keep the docs
   and the overview current").
