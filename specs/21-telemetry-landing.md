# 21 — Telemetry and landing page

Owner role: **orchestrator**.

## Telemetry (shipped)
PostHog Cloud EU, cookieless (`persistence: 'memory'`), lazy, production hosts only, DNT/GPC respected, bots filtered. Landing events: `cv_toggle, cv_pdf_open, social_click, play_cta_click`. Game: funnel (`game_start → world_loaded → stop_visited → office_screen_read → flight_taken → seattle_arrived → finale_reached → game_exit`), feature usage, `perf_summary`, health. **Todo**: chapter events (`chapter_start {id}`, `chapter_complete {id, minutes}`), `on_foot {seconds}`, `photo_taken`, `spot_visited {id}` once those features land; owner to set Authorized URLs + Error tracking in PostHog.

## Landing page
Opt-in "🎮 Play my CV — discover my career interactively" CTA (pill + card footer); lightweight background (owner's choice still pending: plain dark gradient / tech texture / light theme / own photo; keep or drop the bouncing balls).

## Progress log
