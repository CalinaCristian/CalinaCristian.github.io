# 20 — Field research for visual fidelity

Owner roles: **research-buc-districts**, **research-buc-spots**, **research-sea-districts**, **research-sea-spots**. Output only under `game/research/`.

Research the kept areas in depth so the visuals match reality as closely as possible.

## Output format (per area)
- `game/research/<city>-<area>.json` — machine-readable, keyed by stable ids (OSM way/node ids where possible):
  - `streets[]`: name, OSM ids, per segment: lanes per direction, turn lanes/arrows, bus lanes (+colour), tram tracks (position), trolleybus wires, median type, parking type, sidewalk width & paving, kerb style, speed limit, road surface tone, marking style, street trees (species, spacing, side), furniture (lamp model/height/colour, benches, bins, bollards, bike lanes), transit lines with liveries.
  - `buildings[]`: OSM id, address, height/storeys (+ setback floors), facade material + colour (hex), window grid & frame colour, balconies, roof shape + colour, ornament, style/era, condition, rooftop ad sign (brand, position), ground-floor businesses (brand, colours, side of street).
  - `businesses[]`: brand, name, address, lat/lon, kind, sign colours/logo text.
  - `landmarks[]`: corrections/details for models in `landmarks.js`, with sources.
  - `squares[]` / `junctions[]`: real layout (islands, fountains, monuments, metro entrances, crossings, lane arrangement, signals).
  - `colours`: palette (facades, road, sidewalk, kerb, markings).
  - `traffic`: congestion hotspots (location, hours, severity, source e.g. TomTom/news) → feeds `congestion` (spec 13).
- `game/research/<city>-<area>.md` — readable dossier with a source URL for every claim + "top 30 things a local would notice if wrong".
- `game/research/refs/<area>/` — free-licensed reference images only (Wikimedia Commons CC-BY/CC-BY-SA/PD), ≤ 400 KB each, ≤ 60 per area, with `LICENSES.md` (author, license, URL; mark facade-texture candidates).
- Tourist spots and districts additionally: `dialogue` per spot/district — personas (locals, tourists by origin, vendors, guides, buskers, staff) with 15–40 short lines each for: greeting, bumped, photographed, idle chatter, spot-specific; original language + English translation; cultural notes on tone/etiquette with sources; no stereotypes.
- Tourist spots additionally: `spots[]` with full scene spec (footprint, dimensions, materials, colours, signage text, props, vegetation, typical crowd, sounds, 3–6 plaque facts with sources, fun interaction idea, best photo angle).

## Areas
| Role | Areas |
|---|---|
| research-buc-districts | floreasca, grozavesti, unirii, pipera, romana, otopeni (spec 10 table) |
| research-sea-districts | seatac, bellevue (incl. I-90 floating bridge approach) |
| research-buc-spots | Bucharest top 10 tourist spots (spec 15) — confirm the list with evidence first |
| research-sea-spots | Seattle top 10 tourist spots (spec 15) — confirm the list with evidence first |

## Sources & etiquette
OSM tags (building:levels, building:colour, roof:*, building:material, shop/amenity/brand, lanes, turn:lanes, lanes:bus, cycleway, sidewalk, surface, lit, natural=tree, railway=tram, trolley_wire), raw tiles in `/tmp/claude-0/-home-user-CalinaCristian-github-io/c23e7db4-0398-5255-9d52-f406a6fe27a7/scratchpad/osm/tiles/` or api.openstreetmap.org; Wikipedia (en/ro), Wikivoyage, Wikimedia Commons categories, KartaView open imagery (Mapillary needs a token — skip), brand store locators, transit agencies (STB, King County Metro, Sound Transit), city open data (Seattle SDOT, Bellevue GIS), TomTom Traffic Index. Rate-limit (≥ 1.5 s between Wikimedia requests, descriptive User-Agent).

## Acceptance
- [ ] Every chapter-route street and every fronting building covered (log coverage %).
- [ ] Every claim sourced; images licensed.
- [ ] Tourist top-10 lists justified with sources.

## Progress log
