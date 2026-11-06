# 12 — Buildings, businesses, streetscape, landmarks in districts

Owner roles: **world** (generic buildings, shopfronts, signs, furniture, trees), **landmarks** (hand-modelled landmarks). Inputs: research JSON per district (spec 20).

## Requirements
R12.1 Every building fronting a chapter route uses researched height/storeys (incl. setback attics), facade colour (hex), material, window grid, balconies, roof shape/colour; others use OSM tags + district style rules.
R12.2 Real ground-floor businesses with brand names, colours and logos-as-text (McDonald's, KFC, Starbucks, Mega Image, Profi, Carrefour Express, Lidl, BCR/BRD/ING/BT/Raiffeisen, Catena/Dona/Sensiblu, Orange/Vodafone, fuel brands; US: Starbucks, McDonald's, QFC, Safeway, Shell/Chevron/76/ARCO …) at their real addresses and side of the street.
R12.3 Rooftop advertising signs where they exist (Piața Victoriei, Romană, Unirii …) with brand + position.
R12.4 Street furniture per street from research: lamp models/heights (e.g. Calea Victoriei lanterns), trolleybus wires, tram poles, benches, bins, bollards, metro 'M' totems, bus shelters (STB style / King County Metro style), traffic-light models (RO vs US), street-name plates.
R12.5 Trees: species look (chestnut/linden/plane in Bucharest; maples/conifers in Seattle), positions from OSM/research, seasonal colours (spec 18).
R12.6 Landmarks inside districts get a fidelity pass from research (landmarks role); facade photo textures (CC-licensed, attributed) allowed for key buildings when it clearly improves fidelity within budget.
R12.7 Budget per district: ≤ 1.5 M visible triangles, ≤ 400 draw calls at high.

## Acceptance
- [ ] Research coverage ≥ 90 % of buildings fronting chapter routes applied (log counts).
- [ ] Visual review: no "wrong height/colour/roof" or "missing shop" items on chapter routes.
- [ ] Owner spot-check on a street they know.

## Requests
## Progress log
