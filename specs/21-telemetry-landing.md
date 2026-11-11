# 21 — Telemetry and landing page

Owner role: **orchestrator**.

## Telemetry (shipped)

Read-only dashboard/event review (2026-11-08): `handoffs/fidelity/TELEMETRY-REVIEW.md` (removed 2026-11-11; git history: `handoffs/fidelity/TELEMETRY-REVIEW.md` (removed 2026-11-11, in git history)).
Existing dashboards are useful for visit funnels and successful loads/FPS; the review proposes interrupted-load recovery, release identity,
mode-aware performance/resource growth and interaction-outcome diagnostics. The starter retention
chart is not reliable with memory-only anonymous identities. No PostHog configuration was changed by this review.

## Health observer v2 (staged, release gate pending)

`telemetry-health.js` observes district loads, releases, real render frames, office rendering and fixed UI actions.
`load_started/completed/failed`, bucketed `load_stages`, `scene_first_frame`, `scene_released`, `continue_result`,
`render_stall` and UI/office action events provide context missing from the original observer. Performance summaries
cover rendered modes with a bounded 4,096-value reservoir of frame intervals, actual frame-budget breach counts and
texture/geometry/program counts. These counters are not total browser RAM/VRAM. Unsupported long-task observation is labelled.

A per-tab sessionStorage breadcrumb expires after 15 minutes and contains fixed place/action IDs, attempt ID and
load stage only. It can identify an ungracefully interrupted load or first frame on the next boot, not prove an OS crash.
Normal pagehide is marked; capture/storage respects DNT/GPC and disabled tracking. No persistent visitor identity or replay
is added. Early exceptions queue for the lazy SDK (bounded at 200 items), avoiding the previous cold-start blind spot.

`tools/telemetry/stamp-release.mjs` fingerprints committed runtime assets and stamps release/source metadata into both HTML
entry pages. Its self-referential meta lines are excluded from the hash. Run after committing runtime changes and before
deployment; diagnostics include `telemetry_schema:2`, `release_id` and the source commit. Dashboard definitions and observer
behavior pass 12 actual-browser checks and eight pure privacy/wrapper tests. Seven release-aware health tables were applied
to project338182 and read back successfully; their definitions and idempotent sync command are in `tools/telemetry/`.
They remain empty until a v2 game release is published. Full rollout still requires the final combined release gate.

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
| `parking_event` | the player's car left illegally: detected / ticket / clamp / tow / cleared (round 5, note 8) | `type`, `reason` (rule id), `city`, `district` |
| `free_roam_start` | free roam started from the menu / map | `district`, `tod`, `weather` |
| `worldmap_jump` | a place picked on the world-map hub (explore.js) | `to` (`district:<id>` \| `spot:<id>`), `from` (current place key or null) |
| `story_resume` | (2026-11-08) "📖 Resume story" (chip / pause): back from free roam to the story | `chapter`, `from` (district or null) |
| `free_roam_start` | a district is opened from the free-roam menu | `district`, `tod` (preset id), `weather` (picker value) |
| `completion_milestone` | overall completion crosses 25 / 50 / 75 / 100 % (achievements.js) | `pct` (25 \| 50 \| 75 \| 100) |

Implementation notes: spots/* and photo.js call `cvTelemetry.track` themselves (`spot_enter`, `spot_exit`, `spot_plaque` with the plaque title, `spot_postcard`, `photo_taken` with the place name); telemetry-game.js installs a filter on `cvTelemetry.track` that rewrites those into the shapes above (`spot_exit` → `spot_leave`, `spot_postcard` → `spot_challenge`, titles → index, place dropped). `game_start` gained `entry` (`story` \| `spot`), `world_loaded` gained `district`. Existing events unchanged.

`world_loaded` (2026-11-08): sent after every completed `game.loadCity` (each city or district load, not only a city change), on the next tick in drive / foot so it still follows `game_start`. `load_ms` is the duration of `loadCity` itself; `first` is true for the first load of the page visit (includes shader compilation and cold caches). Before this change `load_ms` was measured from leaving the menu (story start: ~0 ms, because the state stays `menu` while loading) or from takeoff (Explore map browsing / flight cutscene included, up to minutes), so events without `first` have unusable `load_ms`.

## Landing page
Opt-in "🎮 Play my CV — discover my career interactively" CTA (pill + card footer); lightweight background (owner's choice still pending: plain dark gradient / tech texture / light theme / own photo; keep or drop the bouncing balls).

## Progress log
- 2026-11-07 04:12 UTC (gameplay, grant this round): events above implemented in `game/src/telemetry-game.js`; verified with a capturing `cvTelemetry` stub in Playwright: `chapter_select {id:'luxoft', source:'menu'}`, `chapter_start {id:'luxoft', n:4, district:'pipera', …}`, `chapter_complete {id:'luxoft', minutes:0.9, …}`, `chapter_start {id:'db', n:5, district:'pipera'}`, `on_foot {action:'enter', district:'floreasca'}`, `spot_enter {id:'fremont-troll', city:'seattle', from:'foot'}`, `spot_leave {id:'fremont-troll', seconds:9}`; no free text or coordinates in any of them. Existing events unchanged.
- 2026-11-08: `world_loaded.load_ms` now times `game.loadCity` (see the note above). PostHog showed median 8 ms / p90 132 s with the old timer. Verified in the browser with a capturing `cvTelemetry` stub: story start `world_loaded {district:'floreasca', load_ms:3107, first:true}` right after `game_start`; then 4 s on a card + `enterChapter(upb)` → `world_loaded {district:'grozavesti', load_ms:1581, first:false}` (the call took 1612 ms, so the card wait is no longer counted). PostHog dashboards: see the "Game health and performance" dashboard in project 338182; its load-time tile filters on `first` being set, so old events are excluded.
- 2026-11-08 (gameplay, one mode — Explore deleted): `explore_enter` is gone (a world-map jump is `worldmap_jump`, a free-roam start `free_roam_start`); `explore_exit` is renamed `story_resume` (props `chapter`, `from`). PostHog: old `explore_*` events stay in history; dashboards on them should read `story_resume` from now on.

- 2026-11-08: root verified 12 browser diagnostics checks: real load/build/first-frame pairing, native headlights, mode-isolated frame tails, failed district replacement, Continue retaining fuel0, interrupted-first-frame recovery, blocked storage, DNT/GPC, queued pre-SDK exception and no external test ingestion. New pure checks also prevent `?track=1` from bypassing DNT/GPC. Dashboard metadata now labels historical periodic summaries and exit-only duration accurately; retention is explicitly unavailable with memory-only identities. No persistent identity was added.

- 2026-11-09 root: release stamper accepts optional `--source=<commit>` for curated unsigned master releases. It resolves a real commit and validates every canonical runtime file against that commit before changing HTML/release metadata; default remains HEAD. This avoids telemetry pointing to an unpublished integration ancestor.
