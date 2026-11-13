# 10 — Chapters in districts

Owner roles: **world** (district data, CHAPTERS, boundaries), **gameplay** (chapter flow, transitions, chapter select).

## Requirements
R10.1 Districts at **real 1:1 scale**, ~**1 km²** each, sized so the chapter route is 1.5–2.5 km (≈ 2–4 min with
traffic); the Bellevue finale drive is **≤ 3 min** at legal speeds including signals. The playable area is 130 m either
side of the chapter routes, 200 m round each door, 110 m round each start and 120 m round the CV-stop building, fully
covered (roads, buildings, POIs, trees, furniture).
R10.2 District list:
| id | city | area | chapters (stop · year) |
|---|---|---|---|
| `floreasca` | bucharest | Calea Floreasca, Barbu Văcărescu, Garibaldi, Floreasca Park | rosetti · 2009 |
| `grozavesti` | bucharest | Grozăvești, Politehnica, Splaiul, Podul Grozăvești | upb · 2013 |
| `unirii` | bucharest | Piața Unirii (fountains), Calea Călărașilor, Hala Traian, Bd. Unirii east | gts · 2015 |
| `pipera` | bucharest | Pipera, Bd. Dimitrie Pompeiu | luxoft · 2017 (Hermes Business Campus, Bd. Dimitrie Pompeiu 5-7), db · 2017 (BOB Tower, Bd. Dimitrie Pompeiu 6A) |
| `romana` | bucharest | Piața Romană, Lascăr Catargiu, Vasile Alecsandri, Piața Victoriei | arnia · 2019, uipath-buc · 2020 |
| `otopeni` | bucharest | Henri Coandă terminal + short DN1 approach | otopeni · 2022 (boarding) |
| `seatac` | seattle | SeaTac terminal loop from the Airport Expressway (terminal, garage and Link station as scenery) | seatac · 2022 (waypoint: drive out) |
| `bellevue` | seattle | Downtown Bellevue + I-405 at the NE 8th St exit (NE 8th, Bellevue Way, Lincoln Square); the I-90 floating bridge appears only in the montage | uipath-bel · 2022→2025 (UiPath's entrance in Lincoln Square; Plaza Center shown as a passing landmark) |

R10.3 Roads leaving a district end at a visible closure with a soft wall; traffic never drives into it and despawns out of
view behind it; the player cannot leave.
R10.4 `CHAPTERS` in cities.js in story order, each `start` on a legal lane so the route to the stop runs 1.5–2.5 km through
the district's most characteristic streets.
R10.5 Chapter flow: leaving the office (or reaching a waypoint) shows "Chapter complete" → "Next: <year> · <title>" with
Continue / Free drive here; the transition is a 4–6 s montage on the city map; the next district loads (reused if the
same); otopeni → flight cutscene → seatac.
R10.6 Chapter select (menu and map) for chapters reached.
R10.7 Progress UI shows chapters (n/10) and the year; the finale follows uipath-bel.
R10.8 Congestion hotspots per district in `CITIES[city].districts[id].congestion` (spec 13).
R10.9 **Free drive inside every district** with in-world, GTA-style boundaries:
- **Bucharest**: authentic roadworks closures ("DRUM ÎNCHIS / LUCRĂRI", red-white barriers, cones, a "DEVIERE" arrow, an
  excavator or a dug-up trench, sometimes a police car, a worker joking about the roadworks); main boulevards get larger
  setups (jersey barriers, arrow boards).
- **Seattle/Bellevue**: WSDOT/SDOT closures ("ROAD CLOSED" type III barricades with flashers, drums, "LOCAL TRAFFIC ONLY" /
  "DETOUR" signs, a flagger).
- **Story hints**: a closure on a road toward a later chapter names it ("Road closed — Pipera opens in Chapter 4 (2017)");
  other closures say the area is outside the story.
- **A city past the edge**: real buildings and streets continue in a 600 m ring, then low-detail backdrop with haze; the
  map shows the outside area as a calm flat dim.
- **Smooth turnaround**: pushing into a closure stops the car softly; after 2 s a prompt offers an automatic U-turn.
R10.10 **One mode with a world-map hub.** The chapters are the spine; the 🌍 hub (title screen, HUD, pause menu) reaches
every district and tourist spot for everyone. Jumping elsewhere leaves the story for free roam (no objective or chapter
cards; offices can still be read; story progress unaffected); "📖 Resume story · Chapter N" (chip and pause menu)
returns to the story where the player left it.
- Selecting a place on the map marks it and sets any available local driving or walking route; it never moves the
  player. Remote districts/spots keep the mark without a route through unloaded areas. Holding `F` for 1.2 s or the
  labelled Fast travel action moves; a short press cancels; fuel, clamp, landing and transit checks still apply.
  On-foot travel to another district returns to the parked car first.
- Time of day (24 h slider + presets), weather (live / clear / cloudy / rain / storm / fog / snow) and season (auto or
  fixed) change live from `K`, the ☀️ panel and Pause → Settings, in driving and on foot, on phones too. Choices follow
  district/city travel, story resume and Continue; Live/Auto follows the destination. Traffic density follows the hour.
  Continue keeps an empty tank empty.
R10.11 A landmark is offered (marker, label, route) only where it is reachable; the others stay as background `scenery`.
Map: by default CV stops, reachable landmarks, spots and fuel with clear non-overlapping labels; an opaque, collapsible
legend whose rows filter categories (shops and transit off by default; shops as dots only when zoomed in). The minimap
shows the CV stop, the next objective and fuel only.
R10.12 Office visits: E starts or resumes the teacher's / professor's / manager's fixed CV sequence; Enter, Space or one
Continue button advances it, follow-up lines included in order. Esc or close pauses; leaving early does not complete
the chapter; the final Continue finishes the visit and advances the story. Completion counts fully presented sections
and keeps existing achievement keys.

## Acceptance
- All 8 district packs build; each ≤ 3 MiB.
- Each district loads in < 4 s (desktop) / < 12 s (software GL).
- Every chapter route 1.5–2.5 km (bellevue ≤ 3 min), routable, no detours via service roads.
- Full story playable in ≈ 20–30 min; logic harness `c` passes per chapter.
- Visual QA review of each chapter route: 0 defects of severity ≥ medium.
