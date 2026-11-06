# 12 — Buildings, businesses, streetscape, landmarks in districts

Owner roles: **world** (generic buildings, shopfronts, signs, furniture, trees), **landmarks** (hand-modelled landmarks). Inputs: research JSON per district (spec 20).

## Requirements
R12.1 Every building fronting a chapter route uses researched height/storeys (incl. setback attics), facade colour (hex), material, window grid, balconies, roof shape/colour; others use OSM tags + district style rules.
R12.2 Real ground-floor businesses with brand names, colours and logos-as-text (McDonald's, KFC, Starbucks, Mega Image, Profi, Carrefour Express, Lidl, BCR/BRD/ING/BT/Raiffeisen, Catena/Dona/Sensiblu, Orange/Vodafone, fuel brands; US: Starbucks, McDonald's, QFC, Safeway, Shell/Chevron/76/ARCO …) at their real addresses and side of the street.
R12.3 Rooftop advertising signs where they exist (Piața Victoriei, Romană, Unirii …) with brand + position.
R12.4 Street furniture per street from research: lamp models/heights (e.g. Calea Victoriei lanterns), trolleybus wires, tram poles, benches, bins, bollards, metro 'M' totems, bus shelters (STB style / King County Metro style), traffic-light models (RO vs US), street-name plates.
R12.5 Trees: species look (chestnut/linden/plane in Bucharest; maples/conifers in Seattle), positions from OSM/research, seasonal colours (spec 18).
R12.6 Landmarks inside districts get a fidelity pass from research (landmarks role); facade photo textures (CC-licensed, attributed) allowed for key buildings when it clearly improves fidelity within budget.
R12.6b **Lincoln Square (Bellevue)** is a hero landmark and the final CV stop: UiPath's Bellevue office moved there in September 2025 (two floors; previously Plaza Center, 10900 NE 8th St, 2022–2025). Model the whole complex at high fidelity from research (towers, podium, Westin/W, the skybridge to Bellevue Square, the NE 8th St × Bellevue Way corner, lobby entrance used by UiPath, signage); the `uipath-bel` stop door is the real entrance of UiPath's tower.
R12.7 Budget per district: ≤ 1.5 M visible triangles, ≤ 400 draw calls at high.

## Acceptance
- [ ] Research coverage ≥ 90 % of buildings fronting chapter routes applied (log counts).
- [ ] Visual review: no "wrong height/colour/roof" or "missing shop" items on chapter routes.
- [ ] Owner spot-check on a street they know.

## Requests
## Progress log
- 2026-11-07 00:50 UTC (world): research consumption, first pass. `tools/osm/build-data.mjs` (district mode) reads `game/research/<city>-<district>.json` and fills missing OSM tags of the researched buildings (height / heightM / heightEstM, levels / levelsEst, facade colour from `facade_hex(_est)` / `building_colour` / `facade.{colour,wall,glass}`, roof shape / colour, min_height): romana 179, unirii 239, grozavesti 71, floreasca 35, seatac 84, bellevue 57 buildings enriched; tall `building:part`s (≥ 20 m or ≥ 6 levels, e.g. Lincoln Square North 126 m, Lincoln Square South Tower) are now kept as buildings; research `businesses[].sign {bg, fg, accent}` become per-brand sign colours (`data.brands`, used by world.js `brandStyle` before the built-in table). Doors / chapter starts from research `stops[]` / `chapters[]` (spec 10 log). Pending: street-by-street furniture (lamp models, trolleybus wires, shelters), rooftop signs, tree species, per-building window grids from research.
