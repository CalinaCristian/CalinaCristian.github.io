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
- Research coverage ≥ 90 % of buildings fronting chapter routes applied (log counts).
- Visual review: no "wrong height/colour/roof" or "missing shop" items on chapter routes.
- Owner spot-check on a street they know.

## Reality pass playbook (any district; first done on Floreasca, 2026-11-08)

Goal: the district matches reality street by street — real footprints, heights, roof shapes and colours, facades by type, real
shops only, trees, gardens, parked cars, fences, sports grounds — inside the playable area **and** in a 600 m ring of real
buildings + streets outside it (boxes only beyond). Street View is only for looking (see AGENTS.md rules).

Steps (scratch = any folder outside the repo; commit only code + `game/research/*.json` measurements + `game/data/*.json`)
1. OSM tiles: `node tools/osm/fetch-tiles.mjs --out $S/tiles --only buc` (Overpass is blocked here; the OSM API works).
2. Aerial mosaic of the district bbox + ~300 m: `python3 tools/aerial/mosaic.py --bbox … --z 18 --cache $S/esri --out $S/m18`.
3. Roofs: `python3 -I tools/aerial/roofs.py --mosaic $S/m18 --osm <tiles> --out game/research/roofs-<city>-<district>.json`.
   Calibrate on crops (draw footprint + label over the imagery for ~80 random buildings) before trusting it; check the global
   registration offset it prints (Floreasca: 2.1 m E, 1.7 m N).
4. Trees + green ground: `python3 -I tools/aerial/trees.py --mosaic … --osm … --out game/research/trees-…json --ground-out
   game/research/green-…json`; check the `--debug` overlay (pitches / lawns must not become crowns).
5. Build: `node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles $S/tiles --districts --district <id>` (picks the
   three files up by name; `district.outerRing` in cities.js overrides the 600 m ring). `DEBUG_DROPS=$S/drops.json` lists any
   footprint inside the area not kept, and why.
6. Audit: `python3 -I tools/osm/building-audit.py --data game/data/<city>-<id>.json --osm <tiles> --roofs … --ring 600`.
   Targets (Floreasca reached them): inside — 100 % of OSM footprints matched, median centroid offset 0 m, ≤ 2 trimmed below
   60 % of their area, OSM-tagged heights 100 % within ±25 % / 2.5 m, roof flat/pitched vs aerial 100 %; ring ≥ 99 % heights,
   ≥ 99 % roofs (its "missing" ones should all be just past the ring edge); world.js shrinks / drops 0 at load (`world.stats`).
7. Look: `node game/dev/harness/viewpoints.js --district=<id> --topdown=250 --mosaic=$S/m18` (whole district, game vs aerial)
   and `--walk --streetview --every=50 --headings=left,right,fwd --max=2000` (every drivable street, both sidewalks, facade +
   along-street views next to Street View; ~850 views / 40 min for Floreasca; `--dry` first to count). Fix what differs, street
   by street; re-render the affected streets (`--streets=<regex>`); Street View images are cached in `<out>/sv-cache`.
8. Verify: logic regression + visual QA + frame budget (AGENTS.md). Floreasca after the pass: visual QA identical to the
   previous commit except one intentional finding (the market hall's own service lane enters it), worst frame 1.2–1.45 M tris.
