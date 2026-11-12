# CV room windows: source buildings and floors

Each of the eight CV rooms mapped to its retained district source building (research 2026-11-09). The matching JSON keeps
the 15 source parts with their outer / hole rings and facade edges; edge bearings are candidates, none is selected.
Metre elevations and window bearings stay unknown; floors come from the owner (below).

| Room | Retained district/source exterior | Supported building-storey evidence | Actual room/view gap |
| --- | --- | --- | --- |
| UPB | Grozăvești Rectorat, `w28240552`; dome roof `w1217715300` | Main building OSM 5; overlapping roof explicitly `building:part=roof`, `min_level=6`, `building:levels=7`, dome | Official tour's Rectorat cupola is a named interior, but no surveyed exterior window, numbered room floor or bearing is established. Roof tags do not mean seven usable interior floors. |
| Luxoft | Pipera Hermes `w533147567` Clădirea A; `w231123137`; `r6774709` Clădirea B+C | A 9; relationB+C 9; smaller way unknown | Official Hermes 5–7 address does not resolve HBC2/A/B/C or room floor. Novo E6 is also an official office. Noblesse design images do not prove a completed Hermes fitout. |
| UiPath Bucharest | Romană retained `w546500235` **Corp B** | Retained Corp B OSM 7 | Current official UiPath address explicitly **Building A**. Exact correspondence is unresolved, so automatic current-office binding is blocked. Nearby Corp C is not a substitute. Older5th/6th-floor prose lacks primary support. |
| Arnia | Romană Europe House `w246115249` | OSM 14 versus older owner/letting GF+10: unresolved count | Arnia and TECTO/UAR identify Europe House; plan/photos do not establish numbered office floor, geographic bearing or measured room dimensions. |
| GTS Global Intelligence | Unirii historical101CaleaCălărașilor `w245117704` | OSM 1 plus separately modelled mansard roof form | OPC entry supports this company/address. Exact CV-era room/floor and occupancy dates remain unproven. GTS Telecom and GlobalTechnicalSystems are different companies. |
| C.A.Rosetti | Floreasca main school `w28240279`; auxiliary `w544207404`, `w545176891` | Main OSM 3; auxiliary levels unknown | PROEDUS names actual classrooms, but no georeferenced classroom-to-exterior correspondence, floor, capture date or2009appearance is established. Viewer pano yaw is not surveyed north. |
| DB | Pipera BOB Tower `w55450549` | Older Globalworth GF+6; retained raw OSM has no height/level tag | DB/current event entry supports6A Pompeiu Entrance A. Estimated roomH 3.8m and prepared buildingH 28m are not floor evidence. Entrance A is not a numbered floor. |
| UiPath Bellevue | Lincoln Square North office tower `w604028609`; podium `w161929514`; bridge `w1364249504` | Primary OSM tower 126m / 28; retail podium 3; bridge not office floor | Official Suite 2000 does not prove floor 20. GeekWire confirms two floors without numbers. JPC's explicitly fourth-floor ImmersionLab belongs to **historical Plaza Center** `w33725899`, not current Lincoln. |

## Rules

Source URLs, response dates and SHA256 are in the matching JSON. Private reference imagery stays private; no provider
pixels or measured-floorplan claims ship. A window view comes from the one existing district world (its weather, time,
season and traffic); no source building, window or actor is removed, moved or replaced to improve a view. A floor number
alone does not establish a facade bearing.

## Owner floor assignments · 10 November 2026

GTS: floor2. Arnia: assumed floor6. Deutsche Bank: assumed floor6. UiPath: floor6, applied to both chapters. Politehnica: floor1. Rosetti: assumed floor2. Luxoft: floor 3 is an estimate (2026-11-11, register #52), for the owner to confirm. Metre elevations, window bearings, source-building identity conflicts and complete-aperture compatibility still require evidence; a numbered floor does not authorize relocating a real building or clipping unrelated geometry.

### Estimated outlook contract · 10 November 2026

Owner-assigned floors now select an estimated outlook from the retained source building even when the room’s wide virtual pane does not match one modeled wall opening. The complete room/pane projection must fit the source polygon and holes; the pane must lie within the emitted owner height. Only that owner’s exterior skin may supply the near plane, bounded to 1.2 m, with unrelated volumes rejected. Raw facade coverage remains recorded and `architecturalApertureVerified` is false. No source meshes or actors are altered. Building A/B identity conflicts and missing floor data remain unavailable.
