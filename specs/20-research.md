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
- **Dialogue (R15.6)**: 15-persona library + 61 spot personas (15-25 lines each, 1,083 lines; RO/EN/DE/IT/FR/BG with English translations) + general pedestrian set (honked_at, near_miss, sidewalk_parking, idle, small_talk) + 14 sourced culture notes.
- **Refs**: 95 Commons images (31 facade-texture candidates) (CC BY / CC BY-SA / CC0 / PD, ≤400 KB) in `game/research/refs/buc-spots/<spot>/` with per-spot `LICENSES.md` + index; facade-texture candidates marked; no-FoP copyright notes (Palace, Arch, Cathedral, Carusel interior, Royal Palace 1937 façade, Memorial of Rebirth) → reference only.
- Verified by: OSM tile parse (scripts in scratchpad), Wikipedia en/ro extracts, photo inspection + pixel sampling for colours. Gaps listed in the dossier §4.

### 2026-11-06 22:18 UTC — research-sea-districts: `bellevue` + `seatac` delivered (review)
- **Files**: `game/research/seattle-bellevue.json` (1.19 MB) + `.md`, `refs/bellevue/` (19 CC/PD photos ≤ 400 KB + LICENSES.md with 19 more vetted candidates); `game/research/seattle-seatac.json` (0.28 MB) + `.md`, `refs/seatac/LICENSES.md` (11 vetted candidates, no files — upload.wikimedia.org returned 429/Retry-After 600 for the whole second half of the run).
- **Method**: fresh OSM API 0.6 tiles (bellevue 47.568–47.630 × −122.308…−122.172; seatac 47.433–47.473 × −122.313…−122.253) → oneway-aware router (HOV-only links excluded) → every route way in driving order with lanes / hov:lanes / turn:lanes / destination:lanes / surface / bridge / tunnel / layer; buildings within 70 m (footprints + parts) or ≥ 25 m tall; POIs within 60 m; furniture nodes. Curated overlay with sources (Wikipedia, WSDOT Standard Plans M-20.10/20.20/20.30/20.40/24.20/24.40/24.60, MUTCD 3A/3D, WSDOT mobility dashboard, Bellevue Transportation Design Manual 2024 + Mobility Implementation Plan, UiPath offices page, GeekWire). Photo colours = median RGB of picked regions.
- **Coverage (bellevue)**: route A 14,392 m (166 ways, 165 with lane counts), route B 13,217 m; 198 buildings listed, 78 within 40 m of downtown route streets → 39 with OSM height/levels, rest rule-estimated; curated heights for 18 towers (Wikipedia list); facade hex for Lincoln Square North, One Lincoln Tower, 400/Two Lincoln, Plaza Center (photo 2026), Bellevue Towers; 133 businesses (brands + sign colours); 1,132 OSM trees; 10 landmarks incl. `lincoln-square` (UiPath at Lincoln Square North, 700 Bellevue Way NE Ste 2000, entrance 47.61723,−122.20148 facing Bellevue Way, 3 skybridges) and `plaza-center` (10900 NE 8th, 68 m/16 fl, ivory piers `#ddd6bf` + dark glass `#2f3338`); 8 congestion hotspots with CITIES-ready `traffic.congestionForCities`.
- **Coverage (seatac)**: route 5,616 m (30/30 ways with lanes); 95 buildings (11 with OSM height/levels); 144 businesses (47 landside); 5 landmarks (terminal, 12,100-space garage + 6 skybridges, Link station, ATC tower, IAF); 3 hotspots (Port of Seattle peaks).
- **Decisions for world/orchestrator**: (1) bellevue route A is 14.4 km (spec 10 says ≤ 12 km) — keep for the tunnel-portal reveal or start on the Murrow bridge (s≈2 km); route B (Bellevue Way, 13.2 km) passes Lincoln Square/Bellevue Square at street level. (2) Proposed bellevue district = I-90/I-405 corridor bands + 1 km² downtown core (polygons in JSON). (3) Never route the player via the I-405 NE 6th HOV-only ramp.
- **Gaps**: Lincoln Square lobby/UiPath signage undocumented; NE 8th/Bellevue Way street trees under-mapped in OSM; sign legends reconstructed from OSM destination tags; signal-pole colour unverified; seatac terminal facade/door signs not photo-verified; 30 photos still to fetch.

### 2026-11-06 22:33 UTC — research-sea-spots: Seattle top-10 + Bellevue top-4 tourist spots
- **Ranking** justified in `game/research/seattle-spots.md` §1: Tripadvisor (Stacker copy, data 2024-05-31; live site 403), Visit Seattle Top 25 (2026), Lonely Planet (2025), Wikivoyage Seattle/Downtown/Fremont/Bellevue, visitor numbers (Pike Place ~10 M, Needle 1.3 M, Locks >1 M, Bellevue Square 23 M); alternates with reasons.
- **Scene specs**: `game/research/seattle-spots.json` (~285 KB) — `spots[14]` (10 seattle + 4 `city:'bellevue'`), each with walk polygon (150–440 m), spawn + heading + ground elevation, structures (dims, OSM ids, materials, hex colours, signage text), ground, vegetation, furniture (OSM counts), lighting day/night, backdrop, crowd, sounds, 3–6 plaques with source URLs, interaction, iconic photo angle (lat/lon, heading, pitch, FOV), seasonal notes; `ranking`, `culture` (Seattle Freeze, honking PEMCO polls, coffee, visitor languages — sourced).
- **Dialogue (R15.6)**: 17 personas; 296 spot lines (19–29 per spot, ctx greeting/bumped/photographed/idle/spot/rain) + 49-line general pedestrian set (incl. honked_at/near_miss) for the Seattle/Bellevue driving districts; non-English lines in fr-CA, zh-Hans, hi, ko, ja, de, es with English text.
- **OSM + terrain**: `game/research/osm/sea-spots/<spot>.json` (buildings w/ footprints + heights, 150 m backdrop ring, ways, areas, trees, furniture, POIs) from api.openstreetmap.org bboxes; `<spot>.terrain.json` USGS 3DEP 40 m grids.
- **Refs**: 63 Commons images (CC BY/BY-SA/CC0/PD, ≤400 KB) in `game/research/refs/sea-spots/<spot>/` + per-spot `LICENSES.md` and index; 40 more vetted (licence + URL listed as candidates) blocked by upload.wikimedia.org 429 (Ballard Locks, Gas Works, Bellevue spots). Troll, Pike Place sign, MoPOP skin and pergola descriptions verified against photos.
- Gaps in dossier §5 (UiPath lobby/second floor, a few paint colours, unfetched refs).
