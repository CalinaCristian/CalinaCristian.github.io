# Source ownership of unknown transit shelters

Base: `57dbb99ef150dd8ec1c8eeeeb6008785bf9585a3`. Grozăvești data is unchanged at SHA256 `649ff6069e2a2be96bde0a6a90ff41a63cb22850f4b0147334b3c04eb99ea093`. No browser, live actor construction or physical tick was run. Fresh immutable native constructor IDs/binding/body facts remain pending Bridge's combined preflight; old483/484 are historical identities only.

## Source facts and unresolved model

The exact raw source preserves vehicle stop points **n933659725/n8440717929**, with `public_transport=stop_position`, `railway=tram_stop` and no own shelter tag. Separate **w909062874/w909062875** are open platform lines,54.360472/54.638272 m long, tagged `shelter=yes`, `bench=yes`. They do not supply a shelter roof outline, width, station, overhang or metre elevation. All16 cached XML file hashes match current dataset provenance. The expanded catalogue has59 platform records and four stop areas; none of those four relates either target stop/platform. Four raw tram-route relations contain the stop nodes but no target platform member, so route membership does not create a roof association either. Suspension notes remain literal and do not remove actors.

A broader bounded source search finds one separately mapped `building=roof`, **w563649482**,128.358 m from the west stop. It is still current source building207, exact footprint approximately x[-493.9,-484.1],z[785.8,793.0], and retains its existing4m estimated roof profile. No source relation assigns it to these target stops/platforms. The gate neither repurposes nor removes it. No tagged `amenity=shelter` record was found within180m in the retained cache. This bounded result is not proof of real shelter absence; the platform shelter=yes remains explicit existence evidence.

Motor way **w723716274** retains literal two lanes, one-way and right sidewalk, without numeric width, placement or metre-height tags. The current CPU World prefix keeps both original source legs at modeled roadY.24, with2×3.5m lane width and zero lateral shift. Exact XY/grade/width/lanes/shift match the historical3f native edge facts by literal node pair, not by edge IDs. Nearby ordinary ground tracks are outside the specialized bridge/tunnel-grade resolver; its null result is not itself a failed current binding or proof of missing support. No road/track/profile/footprint/grade is shifted to clear a roof.

Previously fetched private Esri z19 imagery resolves the platform islands. It does not provide a reliable calibrated shelter roof outline/station/overhang or actual lane boundary sufficient for a new physical model. No measurement was adopted. Imagery date is unknown; z20 returns an unavailable grey tile. Full-size references and hashes are recorded privately; no provider pixels or Street View extraction are committed.

## Approved ownership change

The old World block manufactures an entire3.5×1.6m generic shelter, glass, bench, pole and sign beside a nearest motor road for every transport POI. A vehicle stop point does not authorize that geometry. The failed half-arclength placement draft **6e204029 remains HOLD and is not included**. Its actual whole-track rail/motor contradictions are preserved, rather than selecting a passing station or shrinking a roof/road.

`source-transit-shelter.js` controls only that unmapped generic UNIT:

- Current, source-proven vehicle stop_position/tram_stop → UNKNOWN roof geometry, with the whole guessed unit and matching inferred colliders withheld. Real existence and uncertain platform associations remain explicit. Same-name proximity never chooses a roof station.
- Valid own-source `shelter=no` → no inferred shelter unit; it never removes a mapped source object. An associated platform's negative does not invent a global stop absence.
- Missing/stale/unverified metadata or ordinary passenger-stop models → explicitly legacy/unreviewed, preserving the old behavior for that scope.

A validated dedicated shelter/roof remains independently owned by its source geometry/model. This helper never deletes, hides or edits mapped roofs/buildings, platforms, source stops, node flags, access, fleet inputs, actor identities or routes. It supplies no substitute pole on tracks. Decisions use no actor, contact, pass/fail, camera or RNG predicate. World preserves each POI identity and reports the decision in `poi.shelterModel` and `stats.transitShelters`.

Current source decisions:34 transport POIs,11 UNKNOWN,9 literal-no,14 legacy/unreviewed. These are decision counts, **not asserted emitted-unit removal counts**; the legacy emitter has additional existing placement gates. All34 POIs and all4,111 source building records remain untouched. The new unknown model does not establish real-world clearance or visual completeness of the unmodeled shelter.

## Checks and held opposites

`check.json` records15 passing controls, including current provenance, stale/malformed source refusal, exact literal negatives, genuine/uncertain platform associations, determinism and source immutability. The actual World shelter block is byte-identical except one decision gate. Its unknown control emits0 triangles/0 colliders/0 sign quads while a preexisting mapped roof's bytes stay identical. The legacy control retains all8 boxes/96 triangles/4 inferred colliders/2 sign quads; its mapped owner remains present. No tolerance or planner work limit is changed.

`current-field-57db.json`, `candidate-field.json`, `field-parity.json` preserve actual CPU field replay. `historical-current-road-parity.json` pins the unchanged motor source geometry against the old native fixture. These are source/profile checks, not a replacement for fresh constructor or physical movement.

The historical3f native reports remain lossless in `historical-*.json.gz`, producer proof `32897501b7d340af7aec42123bfa4a3820823a85`. They retain actual primary-body roof/pole/glass contacts, the failed stop-position projection and the platform-centre motor-body conflict. Their actor IDs, poses, source and date are not relabelled current. Full original canonical/native buffers remain in the held producer branch and external raw directory; no old diagnosis is declared fixed by new IDs.

```sh
node --no-warnings handoffs/fidelity/pipera-fidelity/groz-shelter-source-review/audit-source.mjs /tmp/shelter-source.json
node --no-warnings --max-old-space-size=4000 handoffs/fidelity/pipera-fidelity/groz-shelter-source-review/current-field.mjs /tmp/shelter-field.json
node --no-warnings handoffs/fidelity/pipera-fidelity/groz-shelter-source-review/check.mjs /tmp/shelter-check.json
```

Source JSON, Traffic/admission/binding/planner/clearance/grade/Main code and existing physical guards are unchanged. Fresh native whole constructor/cohort/source binding/static and body geometry, actual routes in both rail/motor directions, visuals, budgets and affected overview retakes remain required. The remaining historical ordinary overlap455/472 was unprocessed at work-limit exhaustion, not proven unsatisfiable or fixed. This candidate does not waive it.
