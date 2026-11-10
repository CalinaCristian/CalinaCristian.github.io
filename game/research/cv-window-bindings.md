# CV room live-window binding candidates · 9 November 2026

This ledger maps all eight retained CV room IDs to the actual retained district source buildings. It does **not** identify their actual room windows. Every current room's numbered floor, floor elevation, geographic window bearing and source aperture remain `null`. Registry anchors locate authored landmark models, not office rooms. Prepared room dimensions and district-cache heights cannot establish office elevations.

The matching JSON retains the exact input Git blobs/SHA256 at `79e1e4fd602f1434aa5aa4d10fa8a234bce298dc`, all 15 source parts, their precise district-space outer/hole rings, and all 163 nonzero outer edges and four courtyard edges. Edge bearings are geometric candidates only. None is selected. Projection remains full source metres (x east/z south); the ledger creates no city panorama, world, simulation or environment.

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

## Source/fallback contract

Primary source URLs, response dates and SHA256 are retained in the JSON, alongside exact retained source-catalog tags and fresh read-only OSM checks. Private reference imagery remains private; no provider pixels or measured-floorplan claims are shipped. Interior visual selection is documented separately in `cv-interiors.*`. Older source prose is retained as historical evidence; conflicts here prevent promotion to a current-room fact.

Root selects any fallback. A defensible candidate is a visibly declared **estimated ground-facade live district view**, after checking the source identity and actual emitted facade geometry. Suggested visitor label: “Live district view · room floor/viewpoint not verified”. It must not be presented as the actual office window. All unknown fields remain null. The known UiPathA/B identity mismatch needs resolution before a current-office binding; any illustrative district view must be separately labelled as such.

The root window adapter must read the real `Office.windowPane` aperture geometry and derive world-space exterior facade corners/eye from the one existing district. It must obtain vertical coordinates from actual current source geometry/ground, not room height, baked generic height or suite digits. It should clip the near plane just outside the **actual outer source facade plane**; off-axis math cannot remove retained solid geometry or justify moving the plane beyond a building. No source actors/buildings/windows are removed, relocated or replaced to improve the view. Weather/time/season and traffic remain those of the one existing world.

Clarification sufficient to improve binding would identify building/block, approximate era, numbered floor and which side/landmark the window faced. A floor number alone does not establish a facade bearing.

## CPU preparation

`office-window-math.js` configures a dedicated unparented capture camera from world-space rectangular source corners. `office-window-target.js` owns one pixel-bounded render target and synchronously invokes the root's existing-world render callback, restoring renderer target/cubeface/mipmap, viewport, scissor/test, autoClear and XR state. Its texture is marked externally owned so Office disposal does not adopt it. Neither helper creates a scene/world/environment/simulation/timer or chooses a geographic fallback.

The unique handoff contains reproducible matrix, parallax, near-clipping, invalid-input, exact pixel-cap, exception/restoration, disposal and source-ledger controls. Native GPU/portal visual/resource checks and verified actual room floor/view remain pending.


## Staged retained-world adapter

The runtime candidate now validates the complete unchanged unit-scale room eye envelope and full pane against the current source polygon/holes, independently certifying a same-owner emitted thin facade envelope. Actual floors, bearings and source windows in this research ledger remain unknown. CPU replay of the unchanged builders supports Rosetti, Arnia and DB. GTS has a slightly oblique authored wall versus its literal source edges; the conservative plane certificate is unresolved, not proof of an actual opening. Lincoln ground/podium projections, UPB fins/recesses and Hermes’ floor transition remain incompatible with the tested full apertures. The UiPath Bucharest A/B identity conflict remains held. No room, source mass or window has been resized or removed to pass. See `handoffs/fidelity/live-office-windows/README.md` for exact candidate scope and outstanding native checks.


The separate structural-plane follow-up certifies GTS against its actual unchanged main-prism triangles, rather than averaging the wall into a parallel source-edge plane. Its full structural aperture projects onto the literal edge and the eye envelope fits both source and emitted contours. Exterior mailbox, gate and trim remain visible ahead of the wall plane and do not choose its clipping offset. This is a fourth CPU-compatible estimated view, with the actual GTS office floor/window still unknown. Native pixels and the other four room bindings remain open; the earlier three-room reports retain their original source/checkpoint.

## Owner floor assignments · 10 November 2026

GTS: floor2. Arnia: assumed floor6. Deutsche Bank: assumed floor6. UiPath: floor6, applied to both chapters. Politehnica: floor1. Rosetti: assumed floor2. Luxoft remains unspecified. These owner instructions supersede earlier unknown-floor/ground-view descriptions, while dated historical proof retains its original source. Metre elevations, window bearings, source-building identity conflicts and complete-aperture compatibility still require evidence; a numbered floor does not authorize relocating a real building or clipping unrelated geometry.

### Estimated outlook contract · 10 November 2026

Owner-assigned floors now select an estimated outlook from the retained source building even when the room’s wide virtual pane does not match one modeled wall opening. The complete room/pane projection must fit the source polygon and holes; the pane must lie within the emitted owner height. Only that owner’s exterior skin may supply the near plane, bounded to 1.2 m, with unrelated volumes rejected. Raw facade coverage remains recorded and `architecturalApertureVerified` is false. No source meshes or actors are altered. Building A/B identity conflicts and missing floor data remain unavailable. This supersedes earlier ground-floor-only integration notes, not their dated research evidence.
