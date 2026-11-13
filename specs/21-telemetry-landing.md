# 21 — Telemetry and landing page

Owner role: **orchestrator**. Dashboards, the health tables and their sync / validation commands:
[`tools/telemetry/README.md`](../tools/telemetry/README.md).

## Privacy and transport
- PostHog Cloud EU, cookieless (`persistence: 'memory'`), lazy, production hosts only, Do Not Track / Global Privacy
  Control respected, bots filtered. No persistent visitor identity, no session replay, no free text, no positions (the
  finest location is the district id); props are ids from fixed lists, counts and rounded minutes.
- Early exceptions queue for the lazy SDK (at most 200 items).

## Events
- Landing: `cv_toggle, cv_pdf_open, social_click, play_cta_click`.
- Game funnel: `game_start` (`entry`: `story` | `spot`) → `world_loaded` → `stop_visited` → `office_screen_read` →
  `flight_taken` → `seattle_arrived` → `finale_reached` → `game_exit`; feature usage, `perf_summary`, health.
- `world_loaded` is sent after every completed `game.loadCity` (each district load), with `district`, `load_ms` (the
  duration of `loadCity` itself) and `first` (first load of the page visit, cold caches and shader compilation).
- Health (`telemetry-health.js`): `load_started/completed/failed`, bucketed `load_stages`, `scene_first_frame`,
  `scene_released`, `continue_result`, `render_stall`, UI/office action events; performance summaries keep a bounded
  4,096-value reservoir of frame intervals, frame-budget breach counts and texture/geometry/program counts (not total
  browser RAM/VRAM). A per-tab sessionStorage breadcrumb (15 minutes; fixed place/action IDs, attempt ID, load stage)
  identifies an interrupted load or first frame on the next boot; it does not prove an OS crash.
- Releases: `tools/telemetry/stamp-release.mjs` fingerprints the committed runtime and stamps release/source metadata
  into both HTML entry pages; diagnostics carry `telemetry_schema: 2`, `release_id` and the source commit.

Sent by `game/src/telemetry-game.js` (observes `window.game`, wraps a few methods, never breaks the game):

| event | when | props |
|---|---|---|
| `chapter_start` | a chapter is entered (start, Continue, select, replay) | `id`, `n` (1–10), `district`, `city`, `replay`, `minutes` (session) |
| `chapter_complete` | the chapter goal is reached | `id`, `district`, `minutes` (in the chapter), `replay`, `fast_travels` |
| `chapter_select` | a chapter picked from the menu, the map panel or the map's "Next chapter" | `id`, `source`: `menu` \| `map` \| `next` |
| `free_drive` | "Free drive here" on the chapter card | `chapter`, `district` |
| `boundary_hit` | the district-edge closure toast is shown (max 20 per session) | `district`, `kind`, `leads_to`, `chapter` |
| `on_foot` | out of / back into the car | `action`: `enter` \| `exit`, `seconds` (exit), `district`, `city` (enter) |
| `photo_taken` | a picture is taken (place name removed) | `mode` (`drive` \| `foot` \| `office` \| `spot`), `filter`, `city`, `district` or `spot` |
| `spot_enter` / `spot_leave` | a tourist spot opens / is left | `id`, `city`, `from` / `id`, `seconds` |
| `spot_plaque` | an info plaque is read | `id`, `plaque` (index) |
| `spot_challenge` | the postcard challenge is completed | `id`, `first` |
| `parking_event` | the player's car left illegally: detected / ticket / clamp / tow / cleared | `type`, `reason`, `city`, `district` |
| `free_roam_start` | free roam started | `district`, `tod`, `weather` |
| `worldmap_jump` | a place picked on the world-map hub | `to` (`district:<id>` \| `spot:<id>`), `from` |
| `story_resume` | "📖 Resume story" (chip / pause) | `chapter`, `from` |
| `achievement` | an achievement unlocks | `id` |
| `completion_milestone` | completion crosses 25 / 50 / 75 / 100 % | `pct` |

spots/* and photo.js call `cvTelemetry.track` themselves; telemetry-game.js filters those calls into the shapes above
(`spot_exit` → `spot_leave`, `spot_postcard` → `spot_challenge`, titles → index, place names dropped).

## Landing page
Opt-in "🎮 Play my CV — discover my career interactively" CTA (pill + card footer); a lightweight background
(`public/background.svg`, dark navy gradient with soft glows, a faint grid and road curves) with small drifting city
lights (`canvas.js`).
