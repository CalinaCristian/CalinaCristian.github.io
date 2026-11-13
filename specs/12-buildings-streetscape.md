# 12 — Buildings, businesses, streetscape, landmarks in districts

Owner roles: **world** (generic buildings, shopfronts, signs, furniture, trees), **landmarks** (hand-modelled
landmarks). Inputs: research JSON per district (spec 20). How to run a district reality pass: AGENTS.md → "District
reality pass".

## Requirements
R12.1 Every building fronting a chapter route uses researched height/storeys (incl. setback attics), facade colour,
material, window grid, balconies, roof shape/colour; others use OSM tags, aerial measurements and district style rules.
Real buildings and streets continue in a 600 m ring outside the playable area; boxes only beyond.
R12.2 Real ground-floor businesses with brand names, colours and logos-as-text at their real addresses and side of the
street, only from OSM, POIs or research. A hotel, fuel station or museum names its own building; signs sit on street
fronts (at the mapped entrance when one exists); a building under construction gets no fascia.
R12.3 Rooftop advertising signs where they exist (Piața Victoriei, Romană, Unirii …) with brand and position.
R12.4 Street furniture per street from research: lamp models/heights, trolleybus wires, tram poles, benches, bins,
bollards, metro 'M' totems, bus shelters (STB / King County Metro), traffic-light models (RO vs US), street-name plates.
Generic OSM classes (statues, busts, crosses, fountains, car parks, fuel pumps and canopies, places of worship) appear
at their mapped place as plain objects of their class, never a likeness.
R12.5 Trees: species look (chestnut/linden/plane in Bucharest; maples/conifers in Seattle), positions from OSM and
aerial crowns, seasonal colours (spec 18).
R12.6 Landmarks inside districts get a fidelity pass from research (landmarks role); facade photo textures
(CC-licensed, attributed) only for key buildings when they clearly improve fidelity within budget.
R12.6b **Lincoln Square (Bellevue)** is a hero landmark and the final CV stop: UiPath's Bellevue office moved there in
September 2025 (previously Plaza Center, 10900 NE 8th St, 2022–2025). Model the complex at high fidelity (towers,
podium, Westin/W, skybridges, the NE 8th St × Bellevue Way corner, signage); the `uipath-bel` door is the real entrance of
UiPath's tower.
R12.7 Budget per district: ≤ 1.5 M visible triangles, ≤ 400 draw calls at high, including traffic and the mirror.

## Acceptance
- Research coverage ≥ 90 % of buildings fronting chapter routes applied.
- `tools/osm/building-audit.py`, inside the playable area: 100 % of OSM footprints matched, median centroid offset 0 m,
  ≤ 2 trimmed below 60 % of their area, OSM-tagged heights 100 % within ±25 % / 2.5 m, roof flat/pitched vs aerial
  100 %; scenery ring ≥ 99 % heights and roofs; world.js shrinks / drops 0 at load (`world.stats`).
- Visual review: no "wrong height/colour/roof" or "missing shop" items on chapter routes.
