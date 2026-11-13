# Backlog · the one list of open work

Updated 2026-11-13. Only what is still open. A finished item is removed once its fix is on `master` and re-checked live
(owner reports: at the report pose); its record is the git history. Report poses:
[owner-reports-20261110.json](owner-reports-20261110.json), [owner-reports-20261112.json](owner-reports-20261112.json)
and the F8 JSON the owner pastes.

## Owner reports

| Where | Report | State / diagnosis |
| --- | --- | --- |
| Romana, UiPath (241, -184), 2026-11-13 | "uipath is broken it has a building in side it" | open: at the pose the model's dark door canopy and frame stand out of the west face; no other building, part or mesh found inside The Landmark's footprint (ray scan of the volume) |
| SeaTac (-981, -16), 2026-11-13 | "bridges with borders that don't connect", "floating connecting buildings that don't connect to anything", "invisible wall … can't even reach destination" | wall fixed (the Airport Expressway fork's junction slab, node 255158306, stood 0.13-0.37 m above the road height the car follows: a car within 0.5 m of a junction slab's top is on it); railings: every raised deck of every district takes the Basarab guard rule now (one railing on the outline of the union of the raised carriageways, joined and pruned as one network, drawn as the reviewed guard class or a concrete parapet); SeaTac 486 runs, 14 open ends left at abutments and the garage helix. Floating connectors: the garage skybridges were checked from the drives and reach both ends; the owner's pose of the floating one is needed |
| Bellevue, 2026-11-13 | "fences do not connect, etc" | railings as SeaTac (50 runs, 8 open ends); the Exit to NE 8th St West keeps 0.58 m above NE 8th where it merges (327, -329), so its inferred side barrier crosses the street's lanes: ramp profile still open |
| SeaTac and Bellevue, 2026-11-13 | "lanes are drawn badly on both seattle and bellevue" | the median-side edge line of every US one-way carriageway is yellow now (MUTCD 3B.06; it was white except on motorways / trunks); the Bellevue merge barrier above is the other visible fault |

## Other open work

| ID | Item | Spec | State |
| --- | --- | --- | --- |
| R22 | Code cleanup after the district migration (spec 22) | 22 | in progress. Done: corridor era (maps, harness, main.js, world.js / landmarks.js branches); world.js 860 → 227 KB in 21 `world-*.js` modules, every step with world, collider, graph, stats and crowd fingerprints identical on all 8 districts. Left: the rest of `buildWorld` (227 KB: the `world` API object, sports dressing, the facade / sign helpers are tied to later state), `world-facades-guards.js` 74 KB and `world-ribbons.js` 63 KB, other files over 60 KB (landmarks.js 415, traffic.js 280, main.js 219, vehicles.js 125, pedestrian-fronts.js 113, render.js 108, buildings.js 81, archetypes.js 70; data modules landmark-cec-source.js / landmark-source-masses.js), the corridor build branch in tools/osm/build-data.mjs, dead code (R22.3), single sources (R22.4) |
| unirii-pasaj-look | Unirii: Pasajul Unirii still lacks the leaf / butterfly motifs on the ramp cladding, the "PASAJUL UNIRII" portal header, the planter median between the carriageways and the tall wall screen above street level (panorama May 2024); north ramp not compared at the pano pose (camera lands beside the trench) | 12 | todo |
| sea-spots-b-3 | Ballard Locks: the Control Tower (w223562285) is still a generic block, the 1915 buildings keep generic windows and the fish-ladder viewing room interior (n3413278212) is not modelled. Their look needs a Street View review of the lock grounds, which the 2026-11-13 session could not open (no browser pane); the level / tide estimates of this row are in `seattle-spots.md`, "Ballard Locks" | 15 | open (needs panorama review) |
| r2-perf-5 | Unirii has 33,000 triangles of headroom on Pasajul Unirii (worst frame 1.467 M of 1.5 M, quality medium, world alone). Near trees are drawn three times there (main, mirror, shadow: 82,500 triangles each) and the fountains landmark twice plus shadows (130,000); a mirror-pass LOD would give real margin | 19 | open |
| r3-look-5 | Unirii east basin w174991904: the ornamental balustrade along the quay (unirii-quay-level) is not modelled (railing lane: quay / bridge railings are owned there). The west-polygon level question is closed in round 4 (one level kept, `bucharest-unirii.md` "Estimates and open questions") | 12 | todo (railing lane) |
| r3-look-11 | Places of worship: 6 compared in round 3 (Boteanu, Crețulescu, Amzei recoloured; Albă, Icoanei, Domnița Bălașa match the class); about 110 others in the eight districts not compared; porches / bell towers not modelled (only OSM-tagged towers / domes) | 12 | todo |
| r3-look-14 | Raster lawn on pedestrian streets (r2-world-b-pedestrian-lawn): top-down renders of mapped pedestrian ways in Romană (44.4398, 26.0968), Grozăvești, Pipera and Bellevue looked at in round 3 (no lawn on the bands; plazas outside the 3.5 m band keep raster green in Romană); none compared with a panorama | 12 | todo |
| r3-landmarks-8 | Promenada Mall east (Barbu Văcărescu) front, pano 44.478431, 26.104866 h 255: dark glazed band, LED screen, rounded corners and curved roof edge not modelled (extents not measured); the model's white panels read as a plain grey wall there | 12 | todo |
| r3-sea-spots-b-1 | Pioneer Square fronts: not yet drawn from a panorama — the fronts behind the walk area (2nd Ave, Yesler east of Occidental, S Washington St east), Smith Tower's storefront base, Merchant's Cafe's own sign board (the 2026-11-13 session could not open Street View). Vault lights are iron panels of prisms and the Occidental Square playground w1155308011 is drawn since 2026-11-13; the estimates (bays, openings, floors, colours, the square's unmapped trees) are in `seattle-spots.md`, "Pioneer Square & Smith Tower" | 15 | open (needs panorama review) |
| r3-sea-spots-b-3 | Pioneer Square west end (rest of sea-spots-a-11): streets, crossings, beds, trees and 17 signals are now the live OSM snapshot (`pioneer-square-westend-data.js`); the WSF terminal is a glazed ground floor under a timber storey (panorama 96BnTtZETD_9PxJd3_oy9w); still not done: the Water Taxi terminal's look, the ferry slips and Pier 48 surface, the terminal's roof canopy and stairs, the seawall promenade dressing (Waterfront Trail benches, lamps); the outer terrain west of x = −336 stays in 8 m steps | 15 | open (needs panorama review: the 2026-11-13 session could not open Street View) |
| r3-sea-spots-b-4 | Seattle Center (rest of r3-sea-spots-2): Climate Pledge Arena parts and glass wall and the monorail station canopy done; still open: MoPOP skin (iridescent purple-bronze / silver curved lobes), screening trees at the Armory and the Needle pavilion, the arena's A-frames on the other sides (only the mapped east one drawn) and its "CLIMATE PLEDGE ARENA" lettering; replaces r2-sea-spots-2 | 15 | open (needs panorama review; the Pacific Science Center estimate is in `seattle-spots.md`, "Seattle Center") |
| r3-sea-spots-b-5 | Pike Place (rest of r3-sea-spots-3 / r2-sea-spots-b-3): the market's west walls now white with red steel sash (panorama iFZRr4o9WP2yFdlbuLUkeQ @ 60); still open: the Western Ave west side (low pink-stucco parking building, cream three-storey block, which of the mapped volumes they are), "Pike Place Market" lettering on the west face, the street-level colonnade there, Steinbrueck benches / lamps, Market Place North | 15 | open (needs panorama review; the garage wall is a parking front since 2026-11-13) |
| r3-sea-spots-b-6 | Waterfront: Pier 57's joined sheds and Pier 60's open gabled roof over its irregular plan are not modelled (Pier 60 is a low grey-green shed). Done 2026-11-13: Pier 58 playground (w1417461575), the promenade's dark square-section lamp posts, shrubs in the planted beds; the bridge steps' fall and the Ocean Pavilion roof (no view of either) are estimates in `seattle-spots.md`, "Waterfront" | 15 | open (needs panorama review) |

## Rules

- Fixes go straight to `master`, no PR (owner rule), after the checks below pass. `git fetch origin master` and merge
  before each push.
- OSM decides where things are; Street View panoramas decide what they look like. Panoramas are a visual reference only:
  never downloaded in bulk, stored, traced, copied into textures or published. When a panorama shows OSM is wrong, the fix
  is a documented exception, never a silent move. Review tool: `node game/dev/reality/capture.cjs --district=<id>`
  (viewpoints in `game/dev/reality/viewpoints.json`); what a review establishes goes into the district's
  `game/research/` dossier.
- Do not claim hardware frame rates from emulation.
- The other folders here hold only evidence that game code, tools, tests or the overview read (for example
  `d-otopeni/terminal-roof-measurements.json`); delete a folder once nothing reads it (git history keeps it).

## Checks before every push

`node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` (landmark-cec-source and spot-availability fail on
`master` too), `npm run harness -- --scenario=foot,a --city=bucharest` (0 high / 0 medium),
`node game/dev/harness/bridge-bents-check.cjs <repo> <out> bucharest grozavesti`,
`node game/dev/harness/tram-sweep-audit.cjs <repo> <out> bucharest grozavesti`.
