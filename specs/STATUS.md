# STATUS — task board

Update your own rows when you start/finish (status, `updated` as `YYYY-MM-DD HH:MM UTC`, short note). Statuses: `todo` · `in progress` · `blocked (why)` · `review` (you're done, waiting for QA) · `done` (verified by orchestrator).

| ID | Item | Spec | Role | Status | Updated | Notes |
|---|---|---|---|---|---|---|
| R10.1–3 | District data at 1:1, ~1 km², boundaries + end-of-map | 10 | world | todo | 2026-11-06 21:45 | redirected from corridors; geometry work carries over |
| R10.4 | `CHAPTERS` + starts (1.5–2.5 km routes) | 10 | world | todo | | |
| R10.5–7 | Chapter flow, montage, chapter select, progress UI | 10 | gameplay | todo | | after current fix list |
| R10.8 | Congestion hotspot data per district | 10/13 | world | todo | | from research `traffic` |
| R11.1–2 | Continuous ribbons, junction pads, no coplanar overlaps, layering | 11 | world | in progress | 2026-11-06 21:20 | |
| R11.3 | Country-specific markings, turn arrows, no markings across pads | 11 | world | in progress | | |
| R11.4–5 | Vertical profile + walls (no stacked ribbons, no barriers in lanes) | 11 | world | in progress | | Orhideelor barrier; Seattle interchanges |
| R11.6–8 | Nothing on roads; sidewalks; GTS door; Lukoil | 11 | world | in progress | | |
| R12.1–5 | Buildings/businesses/rooftop signs/furniture/trees from research | 12 | world | todo | | waits on research |
| R12.6 | Landmark fidelity pass from research | 12 | landmarks | todo | | agent to spawn after research |
| R13.2 | Standstill traffic in hotspots | 13 | gameplay | todo | | queued |
| R13.3 | Transit liveries (STB trams/trolleys, KCM) | 13 | gameplay | todo | | |
| R13.4–5 | Pedestrians + overlaps clean; reset/objective/autopilot fixes | 13 | gameplay | in progress | 2026-11-06 21:10 | final-pass list |
| R14.* | On foot (exit car, walk/run/jump, enter offices) | 14 | gameplay | todo | | queued; reusable OnFootController |
| R15.* | 20 tourist spots, walk-only scenes | 15 | spots | todo | | agent to spawn after research |
| R16.* | Photo mode | 16 | cockpit-ui | todo | | queued after cockpit fixes |
| R17.1–4 | Nav screen housing, mirror, fitText, no gaps | 17 | cockpit-ui | in progress | 2026-11-06 21:25 | |
| R17.5 | HUD layout at all viewports | 17 | gameplay | todo | | detector from qa |
| R18.5 | Time/weather/season per district + spot | 18 | render | todo | | |
| R19.1–5 | Visual QA harness + human-style review | 19 | qa | in progress | 2026-11-06 21:25 | |
| R20.* | Research: Bucharest districts | 20 | research-buc-districts | todo | | spawning |
| R20.* | Research: Seattle districts | 20 | research-sea-districts | todo | | spawning |
| R20.* | Research: Bucharest top-10 spots | 20 | research-buc-spots | todo | | spawning |
| R20.* | Research: Seattle top-10 spots | 20 | research-sea-spots | todo | | spawning |
| R21 | Telemetry for chapters/on-foot/photo/spots | 21 | orchestrator | todo | | after features land |
| R21 | Landing background choice | 21 | owner | blocked (owner decision) | | |
