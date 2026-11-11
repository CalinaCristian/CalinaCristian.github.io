# Reality check: OSM for geometry, street-level panoramas for validation

Owner (2026-11-11): "every single location should be REAL based on streetview data ... especially for stand-out
locations", "basically I want both OSM and streetview".

## The two sources and what each decides

| Source | Decides | How it enters the game |
| --- | --- | --- |
| OpenStreetMap (ODbL) | where things are: road centre lines, lanes, bridges and layers, building footprints, heights where tagged, trees, POIs, tram lines | the build pipeline (`game/data/*.json`), as today |
| Street-level panoramas (Google Street View) | what things look like and whether the game matches: grades and where a ramp starts, retaining walls vs slopes, parapets and railings, medians, lamp types, materials, colours, signage placement, what stands where | a person (or Claude) compares the game view with the panorama by eye and writes the finding as text; the fix is made in the game's own procedural geometry or in estimated parameters |

Rules:

- Panorama imagery is a visual reference only. It is never downloaded in bulk, stored in the repository, copied into
  textures, traced or published. The review sheet links to the panorama; it does not embed it.
- One viewpoint at a time, at the scale of stand-out locations (landmarks, CV stops, bridges, squares, tourist spots,
  owner reports). Automated checks over every street need openly licensed imagery (Mapillary, CC BY-SA) and are a
  separate step.
- OSM stays authoritative for positions. When a panorama shows OSM is wrong (a missing bridge tag, a wrong layer), the
  finding says so and the fix is a documented, reviewed exception, never a silent move.
- Every finding names the viewpoint, what the panorama shows, what the game shows, and the fix (or why not).

## Workflow

1. Add the viewpoint to `game/dev/reality/viewpoints.json`: id, district, name, lat/lon, heading, pitch, `surface`
   (`top` = on a deck, `ground`), eye height, source (report id, landmark).
2. Render the game views and the review sheet:

   ```
   node game/dev/reality/capture.cjs --district=grozavesti
   ```

   (`--only=id,id` for some viewpoints, `--cdp=http://127.0.0.1:9333` to use an already running GPU browser). The sheet
   (`review.html`, in a temp folder) shows each game view with a link to the panorama at the same place and heading.
3. Compare and record the findings in `REVIEW-<district>.md`; fix, re-capture, and mark the finding fixed with the
   commit.

## Districts

| District | Viewpoints | Review |
| --- | ---: | --- |
| Grozăvești | 18 | [REVIEW-grozavesti.md](REVIEW-grozavesti.md) |
| Unirii, Romană, Pipera, Floreasca, Otopeni, SeaTac, Bellevue | 0 | to add: landmarks, CV stops, bridges, squares, owner reports |
