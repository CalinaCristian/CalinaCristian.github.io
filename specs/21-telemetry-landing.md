# 21 — Telemetry and landing page

Owner role: **orchestrator**.

## Telemetry (shipped)
PostHog Cloud EU, cookieless (`persistence: 'memory'`), lazy, production hosts only, DNT/GPC respected, bots filtered. Landing events: `cv_toggle, cv_pdf_open, social_click, play_cta_click`. Game: funnel (`game_start → world_loaded → stop_visited → office_screen_read → flight_taken → seattle_arrived → finale_reached → game_exit`), feature usage, `perf_summary`, health. Chapter / on-foot / photo / spot events: see below. **Todo**: owner to set Authorized URLs + Error tracking in PostHog.

## Game events: chapters, on foot, photo, tourist spots (gameplay, 2026-11-07)
Sent by `game/src/telemetry-game.js` (observes `window.game`, wraps a few game methods; never breaks the game). Cookieless like the rest; props are ids from fixed lists, counts and rounded minutes only — no free text, no positions (the finest location is the district id).

| event | when | props |
|---|---|---|
| `chapter_start` | a chapter is entered (start, Continue, select, replay) | `id`, `n` (1–10), `district`, `city`, `replay` (already completed before), `minutes` (session) |
| `chapter_complete` | the chapter goal is reached (office read / boarding / waypoint) | `id`, `district`, `minutes` (in the chapter, 0.1), `replay`, `fast_travels` (session count) |
| `chapter_select` | a chapter picked from the menu chapter list, the map panel, or the map's "Next chapter" | `id`, `source`: `menu` \| `map` \| `next` |
| `free_drive` | "Free drive here" on the chapter card | `chapter`, `district` |
| `boundary_hit` | the district-edge closure toast is shown (max 20 per session) | `district`, `kind` (`small` \| `boulevard` \| `highway`), `leads_to` (district id or null), `chapter` |
| `on_foot` | out of / back into the car | `action`: `enter` \| `exit`, `seconds` (exit), `district`, `city` (enter) |
| `photo_taken` | a picture is taken (photo.js sends it; telemetry-game.js removes the place name) | `mode` (`drive` \| `foot` \| `office` \| `spot`), `filter`, `city`, `district` (or `spot` in a spot) — never image data |
| `spot_enter` | a tourist spot opens | `id`, `city`, `from` (`menu` \| `drive` \| `foot`) |
| `spot_leave` | the spot is left | `id`, `seconds` |
| `spot_plaque` | an info plaque is read | `id`, `plaque` (index in the spot's plaque list) |
| `spot_challenge` | the postcard photo challenge is completed | `id`, `first` (first time in this browser) |

Implementation notes: spots/* and photo.js call `cvTelemetry.track` themselves (`spot_enter`, `spot_exit`, `spot_plaque` with the plaque title, `spot_postcard`, `photo_taken` with the place name); telemetry-game.js installs a filter on `cvTelemetry.track` that rewrites those into the shapes above (`spot_exit` → `spot_leave`, `spot_postcard` → `spot_challenge`, titles → index, place dropped). `game_start` gained `entry` (`story` \| `spot`), `world_loaded` gained `district`. Existing events unchanged.

## Landing page
Opt-in "🎮 Play my CV — discover my career interactively" CTA (pill + card footer); lightweight background (owner's choice still pending: plain dark gradient / tech texture / light theme / own photo; keep or drop the bouncing balls).

## Progress log
- 2026-11-07 04:12 UTC (gameplay, grant this round): events above implemented in `game/src/telemetry-game.js`; verified with a capturing `cvTelemetry` stub in Playwright: `chapter_select {id:'luxoft', source:'menu'}`, `chapter_start {id:'luxoft', n:4, district:'pipera', …}`, `chapter_complete {id:'luxoft', minutes:0.9, …}`, `chapter_start {id:'db', n:5, district:'pipera'}`, `on_foot {action:'enter', district:'floreasca'}`, `spot_enter {id:'fremont-troll', city:'seattle', from:'foot'}`, `spot_leave {id:'fremont-troll', seconds:9}`; no free text or coordinates in any of them. Existing events unchanged.
