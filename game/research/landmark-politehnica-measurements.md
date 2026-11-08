# Rectoratul Politehnicii — source review, 2026-11-08

Model: `bPolitehnica`, registry `politehnica`, source footprint **OSM w28240552**. This review applies to the Rectorat body and dome. The neighbouring Aula/library/faculty wings are separate source buildings, not part of this model's footprint.

The OSM API 0.6 snapshot fetched 2026-11-08 gives `building=university`, `building:levels=5`, and the name `Rectorat Universitatea Politehnica din București`. It gives no metre height, roof dimensions, facade colour or construction year. The projected outline is approximately 47 by 48 m, 2,238 m². The existing P2 outline differs by less than 0.4 m at its corresponding vertices, so it is retained. The dome is a separate roof volume, not an excuse to raise the entire footprint.

Independent visual sources inspected locally:

- [Mister rf, January 2024 front facade](https://commons.wikimedia.org/wiki/File:Politehnica_University_of_Bucharest.jpg), CC BY-SA 4.0. Pale projecting vertical concrete fins, red main-floor panels, pale horizontal sills, brick lower facade, narrow recessed glazed upper floor and a wide projecting roof slab.
- [Mister rf, January 2024 oblique Rectorat view](https://commons.wikimedia.org/wiki/File:Politehnica_University_of_Bucharest_04.jpg), CC BY-SA 4.0. Confirms the main-floor frame/panel treatment on two adjoining faces.
- [Mister rf, April 2024 night front](https://commons.wikimedia.org/wiki/File:Politehnica_University_of_Bucharest_at_night_02.jpg), CC BY-SA 4.0. Blue dome-rim illumination and lit roof slab. Trees and the pedestrian forecourt are visible; they are measured from aerial/OSM sources for the game.
- [2004 Rectorat view](https://commons.wikimedia.org/wiki/File:RO_B_Politehnica_university_rectorate.jpg), CC BY-SA 3.0. Historical shape comparison only; the 2024 photos take precedence for the facade.
- Esri World Imagery mosaic downloaded 2026-11-08 at z18, 0.426 m/px. Ground footprint and roof observation corroborate the square body and central saucer dome. Acquisition date is not supplied by the XYZ service. Off-nadir roof displacement prevents an exact roof-to-ground centre measurement; a roughly 40 ± 4 m dome diameter is compatible with the retained 39.2 m authored dome.

The other January `_02` / `_03` photos and April `_at_night_01` show neighbouring campus buildings. They were inspected but are **not** used as Rectorat facade sources.

Changes: replace the model's plain glazed main storeys with the observed red panel / glass / pale-frame composition; use the brick lower facade and a mostly glazed recessed upper storey. The five OSM levels, original outline, dome and north forecourt entrance remain. No shop/tenant signage is introduced.

Limits: the 3.8 / 3.6 / 4.4 m authored floor heights, fin depths, exact bay widths, roof slab projection, drum height and flagpole dimensions remain estimates. The photos show a partly exposed lower level and individual altered window/panel bays; these are not modeled individually. No claim of measured metre height or complete campus landmark parity follows from this facade correction. No Google Street View data was extracted. Reference imagery is retained only in local scratch, never in git or public assets.
