# Game health telemetry

The browser observer uses PostHog EU project 338182. It sends fixed game IDs, transient attempt IDs, coarse device/render context and aggregate timing/resource counters. It does not send photographs, precise positions, dialogue text, session replay or a persistent visitor identity. DNT/GPC and `?notrack` prevent capture and health-breadcrumb storage, including when `?track=1` is present.

The per-tab sessionStorage breadcrumb expires after 15 minutes. A later boot can report an unfinished load or first frame; this does not establish an operating-system crash. Normal pagehide is marked separately. Original attempt release metadata survives a reload; absent historical metadata stays unknown.

## Release identity

After committing runtime changes, run:

```sh
node tools/telemetry/stamp-release.mjs --write
node tools/telemetry/stamp-release.mjs
```

Commit the generated `game/release.json` and both HTML meta tags. Runtime file hashes, excluding those meta lines, form `release_id`. The source commit identifies the committed code that was stamped. A later runtime change requires a new stamp. There is no production build step.

## Dashboards as code

`dashboard-definitions.json` defines seven health tables and explicit metadata corrections for existing historical charts. Each table states its time window and denominator. Median summary percentiles are not whole-visit percentiles; renderer object counts are not RAM/VRAM. Cross-visit retention cannot be measured with memory-only anonymous identity.

The sync script is restricted to the owner's project and managed dashboard 1094323. The personal API key comes from `POSTHOG_PERSONAL_API_KEY` in the environment; it never enters the game, reports or git. Default execution validates queries without changing dashboards:

```sh
python3 tools/telemetry/sync-dashboards.py --out=/tmp/drivecv-dashboard-review
python3 tools/telemetry/sync-dashboards.py --apply --out=/tmp/drivecv-dashboard-review
```

All seven queries validate before mutation. Applying upserts managed insights by a stable description marker, preserves unrelated insights, updates the listed descriptions, pins the health dashboard and unpins the misleading starter dashboard. Original definitions are backed up privately in the output directory; read-back verifies saved queries and membership. No synthetic events are sent to PostHog.

## Verification

```sh
node --test game/dev/harness/telemetry-health.test.mjs game/dev/harness/telemetry-privacy.test.cjs
node game/dev/harness/telemetry-health-check.cjs --root=/tmp/immutable-game --out=/tmp/health-proof
```

The browser harness fulfills the production origin from an immutable local checkout and replaces the SDK with a capturing stub. It exercises real transitions, an intentional failed request, Continue, native input, frame sampling, storage denial and privacy controls. The expected fixture error is reported separately. It does not diagnose a physical iPhone termination or send test data to the service.
