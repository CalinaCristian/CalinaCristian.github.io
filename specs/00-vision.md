# 00 — Vision, requirements, quality bar

## Vision
An opt-in, interactive résumé on cristiancalina.com: you drive (and walk) through the real places of Cristian's career — Bucharest from high school (2009) to UiPath HQ (2020), then the flight to Seattle and the drive to UiPath Bellevue (2022 → Principal Engineer 2025). Each office unlocks a chapter of the CV. It should look and feel like the real cities, at real scale, with real traffic chaos (Bucharest) and calm (Seattle), real time of day, real weather and seasons, and be fun: honking, chat bubbles, facts, fines, fuel, photos, tourist spots.

## Requirements (summary)
**Fidelity**
- Very good, near-realistic graphics with no performance problems.
- Accurate streets, buildings and landmarks, including the real businesses on each street (fast food, cafés, supermarkets, banks, pharmacies, fuel stations and other well-known places).
- Main buildings modelled from real information about them (heights, materials, colours, roofs, signage).
- The areas we keep are researched in depth so the visuals match reality as closely as possible.
- Roads and markings must look correct in both countries; the route from the start to the first chapter must look right everywhere.

**Map & structure**
- Short trips between story points, while keeping a good amount of driving: chapters in compact districts of about 1 km², sized by drive time.
- Real standstill traffic in places known for congestion.
- Bonus content: the top 10 must-see tourist spots in each city (e.g. Seattle's Fremont Troll and Gum Wall) as small, high-fidelity, walk-only areas.

**Gameplay**
- First-person, behind the wheel; honking; drivers react with chat bubbles; traffic facts on the radio ticker (both are favourites, keep them).
- Get out of the car and walk/run/jump, GTA-style.
- A camera to take pictures: a viewfinder with a frame, capture the framed area, save it on the player's device.
- Fuel and gas stations; in-car display with map, waypoints and time; fast travel; speed limits; realistic reverse steering; mouse look; walking with mouse look, run and jump.
- Real local time of day (day/night/sunrise/sunset), street lights where they really are, headlights toggle; real weather and seasons.

**Quality**
- A QA harness that catches visual problems a person would notice, not only logic errors.
- No objects in the street, no invisible collisions, no jumping onto/off bridges, no flicker, no clipped text, nothing intersecting the in-car screen.

## Quality bar (definition of great)
- From the driver's seat, every street in a district reads as the real street: correct lanes and markings, sidewalks, building heights/colours/roofs, the real shops on the ground floor, the real rooftop signs, trees and lamps where they are.
- Zero visible defects in the visual QA review of every chapter route and every tourist spot (no black patches, z-fighting, stacked roads, floating/sunk objects, cut text, clipping cockpit).
- Logic harness: 0 high issues; every chapter completes; no player stuck.
- Performance: 60 fps at auto quality on a mid-range laptop GPU (owner's machine: 60 fps at ultra); playable on recent phones at low.
- Loads a district in < 4 s on a desktop.

## Non-goals
- Continuous city-wide driving (replaced by chapters; may return later as an option).
- Photoreal textures everywhere (we use procedural geometry + real colours + CC-licensed facade photos only where it pays off, with attribution).
- Multiplayer, accounts, uploading photos.
