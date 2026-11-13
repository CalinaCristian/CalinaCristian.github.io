# Drive My CV: specs (spec-driven development)

This folder says what we are building and who owns what. Open work (owner reports and
everything else) lives in one place: [`handoffs/fidelity/BACKLOG.md`](../handoffs/fidelity/BACKLOG.md). Progress history is git history.

| File | What |
|---|---|
| [00-vision.md](00-vision.md) | Product vision, the owner's requirements (verbatim), quality bar, non-goals |
| [01-architecture.md](01-architecture.md) | Modules, file ownership, contracts/APIs between modules |
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
| [22-cleanup.md](22-cleanup.md) | Code cleanup after the district migration (split world.js, dead code, single sources) |
| [23-achievements-completion.md](23-achievements-completion.md) | Achievements, completion %, achievements panel |

## Process (every agent)
1. Read `00-vision.md`, `01-architecture.md` (ownership + contracts) and the spec(s) your work touches.
2. Contracts: change the *Contracts* section of `01-architecture.md` first when you change an API another module uses.
3. Specs hold requirements and acceptance only: no progress logs, request threads or finding lists. Findings go to
   `handoffs/fidelity/BACKLOG.md`, updated in the same commit as the fix; history stays in git.
4. Verify with the checks in `19-qa-harness.md` and BACKLOG.md, and look at the captures; a report closes only when
   published and re-checked live at the owner's pose.
