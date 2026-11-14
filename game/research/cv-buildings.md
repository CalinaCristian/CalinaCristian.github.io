# CV-stop buildings and CV room windows

Machine-readable twins: `cv-buildings.json` (building facts, research 2026-11-07) and `cv-window-bindings.json` (room → source building, the 15 source parts with outer / hole rings and facade edges, source URLs, response dates, SHA256; research 2026-11-09). Sources: OSM tiles of 2026-11-06 (tags; footprints measured from the outlines), the district dossiers (`bucharest-*.json` stops), Wikimedia Commons photos (reference only, licences listed below). No free Commons photo exists of BOB Tower, Hermes, Europe House, The Landmark (2017 buildings) or the Rosetti school (searched 2026-11-07), so their facades are rated medium / low below.

## GTS Global Intelligence — Calea Călărașilor 101
OSM w245117704 · 44.433492, 26.117628 · building facts high (OSM + 2023 photos), GTS occupancy medium. Modelled by `bGTS` in `game/src/landmarks/bucharest-districts.js`.

- Single-storey eclectic (Beaux-Arts) town house, listed monument LMI B-II-m-B-18379 (OSM heritage=2); building:levels=1 plus a mansard storey with a dormer.
- Footprint ≈ 272 m², ≈ 10 m street frontage × 30 m deep (long axis bearing 8°), N side of the street (odd numbers), tram tracks in the carriageway.
- Facade: warm off-white render (≈ #E6DCCD) with rustication grooves, grey rendered plinth with spalled patches; three tall round-arched windows on the street front (white frames, fanlights) under stucco laurel-garland arches with scroll keystones, a baluster panel under each; modillion cornice with a garland-and-ribbon frieze; rounded street corner with a narrow arched window.
- Roof: weathered grey zinc mansard, round-arched dormer, framed œil-de-bœuf vents, grey downpipes.
- Entrance not on the street: a black wrought-iron double gate on the WEST side opens onto a paved courtyard drive; white panelled double door (glazed, transom) on the long west facade up three stone steps, iron lantern, thuja in a lawn strip. The destination beacon belongs at the gate.
- Signage: only small company plaques on the door jamb (2023 photo, one "BYG") and a small board on the fence; 2013 had a red "DE ÎNCHIRIAT" banner and a "GENERALI" banner. The game shows a plaque only, no billboard (owner's choice).
- Neighbours: west, behind the gate, a white 6–7-storey block with glass balconies (built by 2023); east, a two-storey eclectic house (red standing-seam roof, dormers, red awnings), then no. 105 (1936, 6 storeys, w245117686, LMI B-II-m-B-18381); Hala Traian (no. 133) ≈ 240 m east.
- Occupancy: GTS at no. 101 comes from a group-level job listing (medium); the trade-register seat is Str. Frunzei 26, and GTS later moved to Hermes Business Campus (`bucharest-unirii.json` stops.gts).
- Photos: [101 Calea Călărașilor (01)](https://commons.wikimedia.org/wiki/File:101_Calea_Călărașilor,_Bucharest_(01).jpg) (west facade, entrance, mansard), [(02)](https://commons.wikimedia.org/wiki/File:101_Calea_Călărașilor,_Bucharest_(02).jpg) (window bay detail), [(03)](https://commons.wikimedia.org/wiki/File:101_Calea_Călărașilor,_Bucharest_(03).jpg) (street front, neighbours), all 2023, Neoclassicism Enthusiast, CC BY-SA 4.0; [Calarasi 101.jpg](https://commons.wikimedia.org/wiki/File:Calarasi_101.jpg), 2013-09-18, Nicubunu, CC BY-SA 3.0 RO.

## BOB Tower (Globalworth) — Deutsche Bank
OSM w55450549 · 44.47969, 26.114608 · massing high, floors high (Globalworth sheet), facade medium.
- Glass office building (Bucharest Office Building), 2008; GF + 6 (Globalworth); OSM has no levels or height tag.
- Footprint ≈ 8,370 m², ≈ 130 × 65 m, long axis bearing 66° along Bd. Dimitrie Pompeiu, S side, opposite Hermes; Globalworth Campus next door.
- Facade: blue-green curtain wall with grey spandrel bands (Pipera dossier). Roof flat with plant screens (assumed). No evidence of a DB logo on the facade: forecourt "BOB" totem and lobby tenant list (assumption).

## Hermes Business Campus — Luxoft
OSM w533147567 (Clădirea A, 9 levels), w231123137, r6774709 (Clădirea B+C, 9 levels) · 44.480733, 26.113878 · campus facts high, facade medium–low.
- Three buildings (HBC1–3), Atenor 2011–2016, ≈ 75,200 m², sold to Adventum 2021. Clădirea A ≈ 3,940 m² (≈ 67 × 58 m); second block ≈ 1,430 m².
- Facade: white / light-grey panels with horizontal bands, blue-grey glazing. Barrier-gated car entrance and lobby on the N side of Pompeiu; Pipera metro ≈ 200 m east. Campus name totem at the gate (assumption).

## Europe House — Arnia Software
OSM w246115249 · 44.451108, 26.087685 · facts high, facade medium.
- CA Immo glass office building, 2001–02, ≈ 16,400 m² GLA. OSM building:levels=14 (check_date 2026-06-15) against letting listings of 2 basements + GF + 10: unresolved.
- Footprint ≈ 1,684 m², ≈ 89 × 25 m slab, long axis bearing 125° on the SW side of Bd. Lascăr Catargiu.
- Blue-green reflective curtain wall, grey mullions, a taller glazed volume, stone / grey-panel base; flat roof with plant room and antennas. Orange shop on the corner (n3357667293); tenants include Orange Romania HQ, Bristol Myers Squibb, Tremend, arnia software. The photos in refs/romana show 54 Lascăr Catargiu, not Europe House.

## The Landmark — UiPath (Str. Vasile Alecsandri 4)
OSM w546500235 (Corp B), w583612401 (Corp C) · 44.450013, 26.094657 · facts high, facade low–medium.
- Class-A campus, 2016–17, ≈ 23,500 m², owner Vectr Holdings since 2024; Corp B and C building:levels=7 with a recessed top floor; Corp B ≈ 1,190 m² (≈ 38 × 39 m), Corp C ≈ 1,200 m² (≈ 53 × 32 m).
- Light stone / fibre-cement panels with vertical window bands, dark grey frames, glazed ground floor with cafés (Ted's Coffee, Friddi). E side of one-way southbound Vasile Alecsandri. UiPath's official address is Building A; no UiPath name on the building is evidenced (discreet entrance logo, assumption).
- Photo: [Bucharest - Str. Vasile Alecsandri 01.jpg](https://commons.wikimedia.org/wiki/File:Bucharest_-_Str._Vasile_Alecsandri_01.jpg), Joe Mabel, CC BY 3.0 / GFDL (street before The Landmark).

## Liceul Teoretic C.A. Rosetti (Str. Gen. Giuseppe Garibaldi 11)
OSM w28240279 (main), auxiliary w544207404, w545176891, grounds w253216276 · 44.467191, 26.106071 · massing high, facade low.
- building:levels=3, ≈ 1,340 m², ≈ 44 × 49 m L/U plan. Cream rendered masonry, white frames, regular tall windows (unverified). Gate on the W side of one-way northbound Garibaldi (address node n7119137467); name plate and flag (standard for state schools, unverified). Școala Gimnazială "Maria Rosetti" at Garibaldi 3 is a different school.

## Universitatea Politehnica — Rectorat
OSM w28240552, dome roof w1217715300 · 44.43848, 26.051453 · high.
- 1970s modernist block, building:levels=5, ≈ 2,240 m² (≈ 47 × 48 m); the roof part is tagged building:part=roof, min_level=6, building:levels=7 (not seven usable floors).
- Upper storeys: closely spaced slender white-grey concrete fins in front of dark recessed glazing, a cantilevered band at each floor, a projecting attic band; lower storey(s) and the side wings in red-brown brick. Wide shallow metal saucer dome (≈ ⅔ of the roof width) with a flag; rim lit at night. Forecourt to the north; private campus roads behind barriers (gate on Bd. Doina Cornea).
- Photos: [UPB rectorat 20080727.jpg](https://commons.wikimedia.org/wiki/File:UPB_rectorat_20080727.jpg) (CC BY 3.0); [RO B Politehnica university rectorate.jpg](https://commons.wikimedia.org/wiki/File:RO_B_Politehnica_university_rectorate.jpg) (2004, Andrei Stroe, CC BY-SA 3.0); [Politehnica_University_of_Bucharest.jpg and variants](https://commons.wikimedia.org/wiki/File:Politehnica_University_of_Bucharest.jpg) (2024, Mister rf, CC BY-SA 4.0); the last two are also in refs/grozavesti.

## CV room windows

Each CV room's window view comes from its retained district source building. Floors are the owner's (`game/src/office-floors.js`, `OFFICE_FLOORS`), except Luxoft's estimate; metre elevations and window bearings stay estimates, and a floor number does not establish a facade bearing.

| Room | Source building | Floor | Not established |
| --- | --- | --- | --- |
| UPB | Rectorat w28240552 | 1 (owner) | No surveyed exterior window or bearing for a named room. |
| Luxoft | Hermes w533147567 / w231123137 / r6774709 | 3 (estimate) | The official "Hermes 5–7" address does not say which building or floor; Novo E6 is also an official office. |
| UiPath Bucharest | The Landmark Corp B w546500235 | 6 (owner) | Official address is Building A; the A/B correspondence is unresolved (Corp C is not a substitute). |
| Arnia | Europe House w246115249 | 6 (owner assumption) | Level count unresolved (OSM 14 vs GF+10). |
| GTS | w245117704 | 2 (owner; storeys estimated 2.8 m) | CV-era room and occupancy dates unproven; GTS Telecom and GlobalTechnicalSystems are other companies. |
| C.A. Rosetti | w28240279 (+ auxiliary) | 2 (owner assumption) | No classroom-to-facade correspondence. |
| DB | BOB Tower w55450549 | 6 (owner assumption) | Entrance A (6A Pompeiu) is not a floor. |
| UiPath Bellevue | Lincoln Square North w604028609 (podium w161929514, bridge w1364249504) | 6 (owner, both UiPath chapters) | Suite 2000 does not prove floor 20; GeekWire confirms two floors without numbers. The fourth-floor ImmersionLab belongs to the historical Plaza Center w33725899, not Lincoln Square. |

Rules (`game/src/office-window-binding.js`): the owner floor selects an estimated outlook from the retained source building even when the room's pane matches no modelled wall opening; the whole room / pane projection must fit the source polygon and holes and lie within the owner's emitted height; only that owner's exterior skin may form the near plane, at most 1.2 m away (`floorViewSkinM`); `architecturalApertureVerified` stays false. The view uses the one existing district world (its weather, time, season, traffic); no source building, window or actor is removed, moved or replaced to improve a view. Private reference imagery stays private; no provider pixels or measured floor-plan claims ship.
