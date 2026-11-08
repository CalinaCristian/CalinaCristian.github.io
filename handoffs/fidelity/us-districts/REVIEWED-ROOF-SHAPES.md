# Reviewed roof shape admission

The former simple-roof area restriction and style exclusions silently discarded two actual independent Bellevue classifications: the 2,261 m², eight-vertex Mutual Materials roof `w111868853` (gabled, confidence 0.85) and `w210912230` (hipped, confidence 0.58). Both were inspected in independent Esri aerial crops; neither has a literal OSM roof-shape tag. Native profiles now accept those existing reviewed classifications at the existing 0.5 confidence threshold. Explicit OSM roof shape still wins absolutely. No source boundary, courtyard, height or storey tag changes.

The aerial classification establishes shape only. Unmeasured roof rise, pitch, ridge axis and unsourced wall heights remain explicit native-profile estimates. Colour confidence and provenance remain separate. Google images supply no attributes.

`node tools/osm/reviewed-roof-shape-check.mjs` runs the real builder on the two original buildings, two original OSM-shape priority controls with deliberately conflicting test aerial inputs, and one original multipolygon courtyard. It verifies the expected profiles and every original source boundary vertex to the existing 0.1 mm serialization tolerance. The fixture distinguishes real measurements from intentionally conflicting test data. The existing native-profile and independent-colour suites also pass.
