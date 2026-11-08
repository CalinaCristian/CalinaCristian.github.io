# Independent roof colour quality

The Seattle calibration found small gray pitched roofs that the inherited shape classifier confidently called flat. Lowering the shape confidence previously also discarded a usable median roof colour. The optional research `colourMeasurements` map now separates those independent observations; existing four-slot arrays are unchanged.

Colour sampling records raw median RGB, pixel count, luma, deep-shadow fraction, vegetation contamination, spread and registration gain. More than 20% vegetation, median luma below50 or more than35% deep-shadow pixels makes colour unusable. Mixed light and tiny samples reduce confidence. Builder application requires confidence>=0.65 and preserves OSM colour/material priority. An explicitly unreliable independent sample never inherits the older shape-confidence shortcut. No Street View attributes or reference images are used.

Validation: `node tools/osm/roof-colour-check.mjs` passes seven actual-builder checks covering independent gray colour with uncertain pitch, unreliable tree/shadow sample, OSM colour and copper material overrides, legacy uncertain/confident behaviour and separate shape provenance.
