# Health diagnostics and dashboards

Staged observer behavior is described in `tools/telemetry/README.md` and spec21. Runtime deployment remains part of the final integrated release.

The immutable `77978a3` browser snapshot, stamped game-12f25ac9fb24cbf8, passed12 actual browser checks with zero unexpected page errors. The one explicit pre-SDK exception and a503 district request are intentional fixtures. Real game loads, first frames, native L, paused/driving summaries, failed replacement and empty-fuel Continue were exercised. Six isolated browser contexts also cover pending-load recovery, blocked sessionStorage, DNT, GPC and lazy SDK errors. Production URLs were fulfilled locally and the SDK was a capturing stub; no synthetic events were sent to PostHog. See browser-77978a3.json.

Later small observer changes add the original attempt release/device metadata to reload breadcrumbs and a consistent mobile context. Eight pure wrapper/percentile/breadcrumb/privacy cases pass, including `?track=1` with DNT/GPC. The final combined release still needs its stamp and integrated tests.

Seven SQL queries validated against the actual PostHog project338182 before configuration mutation. They returned zero v2 rows because the runtime has not been deployed. Definitions were applied and read back twice, preserving the same seven managed insight IDs. The health dashboard is pinned; the starter dashboard is unpinned and retention is labelled unavailable with memory-only identity. Historical FPS summaries, chapter counts and exit-only duration have accurate labels. The second apply updated the original-release attribution and verified idempotency rather than creating duplicate tiles. The API enforces a400-character description limit; definitions now validate that locally before mutations. Original definitions are backed up privately at `/workspace/reality-pass/telemetry-dashboard-v2/before.json`, not committed.

Dashboard: https://eu.posthog.com/project/338182/dashboard/1094323

No persistent visitor identity, replay, precise location or dialogue text was added. Renderer object counts are not RAM/VRAM, interrupted breadcrumbs are not confirmed operating-system crashes, and successful-load timings exclude failed/interrupted attempts by definition. These limits are stated in the dashboard itself.
