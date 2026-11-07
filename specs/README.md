# Drive My CV: specs (spec-driven development)

This folder is the single source of truth for what we are building, who owns what, and how far along it is.
Every agent **reads the relevant specs before working** and **updates progress here** while working.

| File | What |
|---|---|
| [00-vision.md](00-vision.md) | Product vision, the owner's requirements (verbatim), quality bar, non-goals |
| [01-architecture.md](01-architecture.md) | Modules, file ownership, contracts/APIs between modules |
| [STATUS.md](STATUS.md) | Task board: every requirement, owner role, status, last update |
| [10-districts-chapters.md](10-districts-chapters.md) | Story as chapters in ~1 km² real-scale districts; transitions; chapter flow |
| [11-roads-junctions-markings.md](11-roads-junctions-markings.md) | Road surfaces, junctions, markings, vertical profile, walls |
| [12-buildings-streetscape.md](12-buildings-streetscape.md) | Buildings, shopfronts/brands, rooftop signs, street furniture, trees, landmarks in districts |
| [13-traffic.md](13-traffic.md) | Traffic AI, congestion hotspots (standstill), pedestrians, transit |
| [14-on-foot.md](14-on-foot.md) | Get out of the car, walk/run/jump (GTA-style), enter offices on foot |
| [15-tourist-spots.md](15-tourist-spots.md) | Top-10 tourist spots per city as walk-only high-fidelity bonus scenes |
| [16-photo-mode.md](16-photo-mode.md) | Pull out a camera, viewfinder, take pictures, save to the device |
| [17-cockpit-ui.md](17-cockpit-ui.md) | Cockpit, in-car nav screen, mirror, HUD, text fitting, menus |
| [18-weather-lighting.md](18-weather-lighting.md) | Real-time sun, day/night, weather + seasons from real data, lighting |
| [19-qa-harness.md](19-qa-harness.md) | Logic harness + visual QA harness; definition of done |
| [20-research.md](20-research.md) | Field research for 100% visual fidelity: districts and tourist spots |
| [21-telemetry-landing.md](21-telemetry-landing.md) | Analytics (PostHog EU) and the landing page |
| [22-cleanup.md](22-cleanup.md) | Code cleanup after the district migration (remove corridor era, split world.js) |
| [23-achievements-completion.md](23-achievements-completion.md) | Achievements, completion %, achievements panel |

## Process (every agent)
1. **Before you start**: read `00-vision.md`, `01-architecture.md` (ownership + contracts), your spec(s), and `STATUS.md`.
2. **Claim**: set your rows in `STATUS.md` to `in progress` with your role name and the date/time (UTC).
3. **Work only in files you own** (see `01-architecture.md`). Need a change elsewhere? Write it in the owning spec's *Requests* section and in `STATUS.md` notes; the orchestrator relays it.
4. **Contracts**: if you change or add an API another module uses, update the *Contracts* section of `01-architecture.md` **first**, then implement, keeping old behaviour working (feature-detect) until consumers migrate.
5. **Progress log**: append dated entries to the *Progress log* at the bottom of your spec (append-only: what changed, how verified, numbers, screenshot paths).
6. **Verify**: every requirement has acceptance criteria. Run the logic harness and the visual QA (`19-qa-harness.md`) and LOOK at the screenshots. A requirement is `done` only when its acceptance criteria are met and the evidence is in the log.
7. **Do not commit or push**; the orchestrator integrates, runs the full QA and commits.
8. Status values: `todo`, `in progress`, `blocked (reason)`, `review` (done by you, waiting for QA), `done` (verified by QA/orchestrator).
