# PostHog review — 2026-11-08

Read-only review of EU project 338182, its four custom dashboards, starter dashboard, saved insight definitions,
and a two-day event sample. No dashboards, project settings or event history were changed. The personal API key
is held only in the environment's secure settings; no credential belongs in the game or this report.

## Assessment

The custom dashboard structure is useful: CV acquisition, story progress, exploration, and
[game health/performance](https://eu.posthog.com/project/338182/dashboard/1094323).
Keep those groups. They currently describe usage and successful play much better than interrupted loads or crashes.

Verified strengths:

- Load insight 7188430 has median/p90 and separates first/subsequent loads. Its `first is_set` filter correctly
  excludes the historical load-duration instrumentation bug.
- Health insight 7188431 includes JavaScript exceptions, WebGL context loss, stuck cars and road resets.
- FPS insights 7188427–29 include low FPS, device/quality and GPU breakdowns.
- Exploration insight 7188421 references actual current events, including `drone_deploy`; story and parking
  event names also match the source.

Verified gaps and misleading interpretations:

- The game records completed `world_loaded` events but not load attempts, stages or failed loads. A hard browser
  process termination can send neither `$exception` nor `pagehide`; zero errors is not evidence of no crashes.
- All sampled events have the same fixed `app_version` from 2026-11-06. It cannot distinguish recent deployments.
- Load charts group by city/first, so districts with very different content and phone/desktop results are mixed.
- FPS insight 7188427's description says session averages, but its query takes medians over periodic summaries.
  Longer visits produce more summaries. Samples are one-second snapshots of reported FPS, not raw frame-time
  percentiles. The current observer samples driving only; tourist, drone, office and loading performance is absent.
- Starter weekly retention and unique-player interpretations are unreliable with `persistence: memory`: a reload
  creates a new anonymous identity. Keep privacy choices and describe visit-level metrics honestly rather than
  silently adding persistent tracking.
- Exit/duration charts depend on `pagehide`, missing abrupt process loss. The ordered story funnel is a visit-level
  funnel and does not reconstruct saved progress across reloads or days.
- Raw daily error counts need denominators (load attempts, visits or play minutes) to distinguish worse reliability
  from more play. A two-day snapshot contained only 24 successful loads and 46 performance summaries; small buckets
  should show their sample counts.

The inspected sample contained no `$exception` or `context_lost`. iOS menu returns and successful Grozăvești loads
were visible, but cannot establish the reported reload's cause or identify every menu return as a crash.

## Proposed additions, in priority order

These are recommendations, not claims that the events below have shipped.

1. **Travel/load lifecycle.** One bounded attempt ID with source/destination, mode, release and start time;
   completed/failed result; stage durations for fetch, parse/build, upload/first playable frame. Include a small
   per-tab, expiring pending-load breadcrumb surviving reload. On next boot label it `interrupted_load`, not
   `confirmed_crash`: manual refresh can interrupt a load too. Record Continue/recovery result.
2. **Release and context.** An actual release identifier and telemetry-schema version; district or tourist-scene ID,
   mode, browser/OS, effective graphics tier, device DPR and actual rendering scale. Flush performance summaries
   when the context changes so one sample does not mix places/modes.
3. **Resources and stalls.** Before/after travel counts of renderer textures/geometries, render-buffer dimensions,
   triangles and calls including shadow/mirror work. Add bounded frame-time histograms and budget-exceedance counts;
   long-task observations only where supported. These are diagnostic counters, not measurements of total iPhone RAM
   or VRAM. Avoid a production event per frame, pedestrian or resource.
4. **Interaction outcomes.** Activity start/completion/cancellation with a fixed activity ID, step, duration and
   reason; guided-tour start/skip/end; office-dialogue answer and Achievements-open source/modal owner. This helps
   distinguish inaccessible controls, accidental overlays and abandoned activities without recording button text,
   touch coordinates, photos or a replay.
5. **Bounded gameplay anomalies.** Aggregated blocked-pedestrian/density and traffic-conflict counts by district;
   drone boundary violations and failed travel/action reasons. Keep fixed reason codes, cooldowns and per-visit caps.
   Geometry fidelity still requires source audits and visual tests; production telemetry cannot prove it.

## Dashboard changes to pair with that instrumentation

- Health: load success/failure/interrupted rates, recovery success, p50/p95 load and first-playable time by district,
  release and device; show denominators and sample counts.
- Performance: mode/district/release filters, frame-time tails, frame-budget breach rates and resource growth over
  repeated travel. Keep existing FPS trends, with accurate summary-level labels.
- Experience: activity/tour start-to-completion funnels and cancellation reasons, separate from simple visit counts.
- Acquisition/story: label anonymous visit metrics and visit-level funnels; remove misleading retention from the
  pinned starter view or clearly mark it inapplicable to memory-only identities.

Use fixed-cardinality properties, rate limits and aggregated periodic summaries. Preserve DNT/GPC and production-only
capture. No global autocapture, session recording or new persistent visitor identity is needed for these fixes.
