# STATUS — task board

Update your own rows when you start/finish (status, `updated` as `YYYY-MM-DD HH:MM UTC`, short note). Statuses: `todo` · `in progress` · `blocked (why)` · `review` (you're done, waiting for QA) · `done` (verified by orchestrator).

| ID | Item | Spec | Role | Status | Updated | Notes |
|---|---|---|---|---|---|---|
| R10.1–3 | District data at 1:1, ~1 km², boundaries + end-of-map | 10 | world | review | 2026-11-06 23:10 | redirected from corridors; geometry work carries over |
| R10.4 | `CHAPTERS` + starts (1.5–2.5 km routes) | 10 | world | in progress | 2026-11-06 23:10 | |
| R10.5–7 | Chapter flow, montage, chapter select, progress UI | 10 | gameplay | review | 2026-11-07 01:30 UTC | `chapters.js` (card, district-jump montage, progress store) + main.js flow; harness `ch` plays all 10 chapters (load → start pose → route → fast travel → office/boarding/waypoint → card → next); open world items: luxoft door 62 m off, bellevue route 13.5 km |
| R10.8 | Congestion hotspot data per district | 10/13 | world | review | 2026-11-06 23:10 | from research `traffic` |
| R10.9 | Free drive + GTA-style boundaries (roadworks closures, story-hint signs, backdrop, turnaround) | 10 | world (geometry, props, backdrop) + gameplay (HUD toast, turnaround, NPC behaviour, map hatch) | in progress (world part: review; gameplay part: review) | 2026-11-07 01:30 UTC | gameplay: approach toast by `leadsTo` chapter, soft stop (no damage/fines) incl. the closure's cones/boards, U / tap → auto U-turn, NPCs never route into / spawn on cut edges, roadworks crew + ROADWORKS bubbles in Bucharest, hatched outside on both maps; on-foot fence pending R14 |
| R11.1–2 | Continuous ribbons, junction pads, no coplanar overlaps, layering | 11 | world | in progress | 2026-11-06 21:20 | |
| R11.3 | Country-specific markings, turn arrows, no markings across pads | 11 | world | in progress | | |
| R11.4–5 | Vertical profile + walls (no stacked ribbons, no barriers in lanes) | 11 | world | in progress | | Orhideelor barrier; Seattle interchanges |
| R11.6–8 | Nothing on roads; sidewalks; GTS door; Lukoil | 11 | world | in progress | | |
| R12.1–5 | Buildings/businesses/rooftop signs/furniture/trees from research | 12 | world | in progress | 2026-11-06 23:10 | waits on research |
| R12.6 | Landmark fidelity pass from research | 12 | landmarks | in progress | 2026-11-06 22:47 UTC | claimed by landmarks |
| R12.6b | Lincoln Square hero landmark (UiPath Bellevue stop) | 12 | landmarks | in progress | 2026-11-06 22:47 UTC | claimed by landmarks |
| R13.2 | Standstill traffic in hotspots | 13 | gameplay | review | 2026-11-07 01:30 UTC | `traffic.setCongestion` (+`?hour=8`, `?jam=1`): romana 08:30 → Piața Victoriei avg 1.08 m/s, outside 9.1 m/s, off-peak 6.9; harness scenario `jam` |
| R13.3 | Transit liveries (STB trams/trolleys, KCM) | 13 | gameplay | todo | | |
| R13.4–5 | Pedestrians + overlaps clean; reset/objective/autopilot fixes | 13 | gameplay | review | 2026-11-06 22:05 UTC | full harness: no-progress 7→1, drive-failed 2→0, bad-placement 2→0, ft-last-mile 1→0, ped-on-carriageway 4→2, overlap 8→7; remaining = world (Lukoil, DN1 barrier at Bretea) |
| R14.* | On foot (exit car, walk/run/jump, enter offices) | 14 | gameplay | in progress | 2026-11-07 01:30 UTC | next |
| R15.* | 20 tourist spots, walk-only scenes | 15 | spots | todo | | agent to spawn after research |
| R16.* | Photo mode | 16 | cockpit-ui | review | 2026-11-06 22:40 UTC | `photo.js` done + verified (download 182 KB, share path); needs the main.js hook in spec 16 Requests (gameplay) |
| R17.1–4 | Nav screen housing, mirror, fitText, no gaps | 17 | cockpit-ui | review | 2026-11-06 22:40 UTC | done in vehicles/office/flight/canvasText/style.css; needs player.js mirror mount + main.js camera near 0.2 (spec 17 Requests) |
| R17.5 | HUD layout at all viewports | 17 | gameplay | in progress | 2026-11-06 22:40 UTC | cockpit-ui did the CSS part (street top-centre, ticker/bottom-right clear of nav screen, compact phone HUD, 3×2 touch pad); detector from qa |
| R18.5 | Time/weather/season per district + spot | 18 | render | todo | | |
| R19.1–5 | Visual QA harness + human-style review | 19 | qa | in progress | 2026-11-06 22:40 | harness done (`npm run harness:visual`, README in `game/dev/harness/visual/`); full chapter-mode run per city in progress; review → `game/dev/harness/visual/report/review.md` |
| R20.* | Research: Bucharest districts | 20 | research-buc-districts | in progress | 2026-11-06 21:33 UTC | order: romana, unirii, floreasca, grozavesti, pipera, otopeni; output game/research/bucharest-<d>.json/.md + refs/ |
| R20.* | Research: Seattle districts | 20 | research-sea-districts | review | 2026-11-06 22:18 | bellevue + seatac JSON/MD/refs in game/research/; bellevue route A = 14.4 km (> spec-10 12 km) — world to decide; Lincoln Square + Plaza Center landmarks done; seatac photos pending (Wikimedia 429) |
| R20.* | Research: Bucharest top-10 spots | 20 | research-buc-spots | review | 2026-11-06 22:15 | top-10 confirmed with evidence; `game/research/bucharest-spots.{json,md}` (10 scene specs + dialogue) + `refs/buc-spots/` (95 CC images, LICENSES.md); Patriarchal Cathedral → People's Salvation Cathedral |
| R20.* | Research: Seattle top-10 spots (+ Bellevue top 4) | 20 | research-sea-spots | review | 2026-11-06 22:33 | `game/research/seattle-spots.{md,json}`: 10 Seattle + 4 Bellevue scene specs, dialogue, OSM+terrain per spot; refs 63/103 (rest vetted, 429-blocked); UiPath = Lincoln Square North Suite 2000 |
| R22.* | Code cleanup after district migration (remove corridor era, split world.js, dead code) | 22 | all + code-health | todo | | starts after spec 10 is done |
| R21 | Telemetry for chapters/on-foot/photo/spots | 21 | orchestrator | todo | | after features land |
| R21 | Landing background choice | 21 | owner | blocked (owner decision) | | |
| R16 hook / R17.2 / R17.4 | Photo mode construction + close on state changes, mirror mount, camera near 0.2 | 16/17 | gameplay | review | 2026-11-07 01:30 UTC | main.js / player.js per the cockpit-ui Requests |
