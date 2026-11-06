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

### 2026-11-06 22:15 UTC — research-buc-spots: Bucharest top-10 tourist spots
- **Ranking** justified in `game/research/bucharest-spots.md` §1 from Wikivoyage See lists, Visit Bucharest search studies 2022 + 2024, Trip.com 2025, Tripadvisor 2015 mentions, visitor numbers (Palace ~152k 2023; Village Museum ~800k 2017). Tripadvisor / Lonely Planet / Trip.com / bucharest.ro not reachable from this environment (403/DNS) — positions from search snippets (caveat logged).
- **Scene specs**: `game/research/bucharest-spots.json` (1.8 MB, compact) — `spots[10]`, each with footprint polygon (~300-440 m), structures (dims, materials, colours hex, ornament, signage, OSM polygons for key buildings), ground surfaces, vegetation, furniture, lighting, backdrop, crowd, sounds, 4-6 sourced plaques, interaction, postcard photo angle, seasonal notes, measured colour samples, and a full OSM extract per footprint (buildings + parts, paths with surface, areas, trees with species, lamps, furniture, artworks, named businesses). Coverage: 10/10 spots; OSM trees with species: palace 333/355, cathedral 172/174, Stavropoleos 106/108; parks (Herăstrău, Cișmigiu, Village Museum) have almost no OSM trees → described from photos.
- **Dialogue (R15.6)**: 15-persona library + 62 spot personas (14-25 lines each, ~1,060 lines; RO/EN/DE/IT/FR/BG with English translations) + general pedestrian set (honked_at, near_miss, sidewalk_parking, idle, small_talk) + 14 sourced culture notes.
- **Refs**: ~100 Commons images (CC BY / CC BY-SA / CC0 / PD, ≤400 KB) in `game/research/refs/buc-spots/<spot>/` with per-spot `LICENSES.md` + index; facade-texture candidates marked; no-FoP copyright notes (Palace, Arch, Cathedral, Carusel interior, Royal Palace 1937 façade, Memorial of Rebirth) → reference only.
- Verified by: OSM tile parse (scripts in scratchpad), Wikipedia en/ro extracts, photo inspection + pixel sampling for colours. Gaps listed in the dossier §4.
