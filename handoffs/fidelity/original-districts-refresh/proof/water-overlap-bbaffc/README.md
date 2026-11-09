# Scoped water and Dinamo atlas retakes

Captured immutable ROOT source: `bbaffc0d6cdccb6246edeb9478c58590852980d9` (water overlap correction338300a9 and final Dinamo paint d5795e20 included). The full `git archive` of `game` and `public` was extracted before either browser started. Both captures record the same7,994-file source tree and capture-tool hash in `source-archive-identity.json`. The supplied `capture-atlas-final.cjs` was copied byte-for-byte from that commit and retained here. One browser ran at a time; both jobs are closed.

The exact committed root water mask selects Floreasca19 and Grozăvești26. The final flat Dinamo paint quad intersects2 additional Floreasca250 m squares: `aerial-r09-c04` and `aerial-r10-c04`. Both were absent from the water mask. Romană's projected squares were checked, but `cities.js` excludes Dinamo from its district landmarks and `world.js` filters by that list before building models; no Dinamo paint is instantiated there. `paint-impact.json` records eligibility and exact ground bounds. Final retakes are Floreasca21 + Grozăvești26 =47.

All original poses are retained exactly: centre,250 m or context-square size, altitude, FOV60, square aspect, heading0 and pitch−90. District source-data bytes match. These are the existing technical north-up atlas conditions: summer clear/day, high quality, moving traffic and mirrors disabled, fog temporarily removed and depth extended by the atlas tool. They are separate from native normal-perspective clipping, controller, hardware FPS and driving/mirror acceptance.

Every fresh actual GAME image was reviewed against its existing private georeferenced Esri mosaic crop:47 pairs in9 private sheets, all with100% reference coverage. Both Dinamo pairs were additionally inspected at full1280×672 pair size. Only review ledgers, source/reference hashes and candid notes are published; no reference pixels, paired pictures or private review sheets enter Git. Reference acquisition dates remain unknown.

The source polygon shoreline remains visible without the broad overlapping estimated ribbon on bank/road where the river/lake appears. Some conservative mask squares principally show surrounding context; they do not themselves establish a visible water correction. Dinamo's visible centreline, circle and boxes are continuous in the fresh original tile crops. The separate northern training-pitch markings still look sparse/dotted at this aerial distance. Water remains model-blue against green references; sparse outer ground, approximate canopy, estimated facade/roof detail, industrial plant/cooling-tower profiles, occupancy, Circus's simplified lobed roof and date-specific stadium state remain explicit gaps. `realWorldParityAccepted` stays false.

Before changing either current atlas, the entire previous current collection was copied, including GAME images/thumbnails, raw metadata, context and provenance directories. Its prior historical subtree remains at its original stable paths. The full old90-frame Floreasca and100-frame Grozăvești current atlases now appear as separate historical collections. `full-current-archive-integrity.json` verifies all384 +297 prior current files byte-for-byte against Git6a0c7967, including unchanged manifest bytes. Every previous atlas frame is retained.

Only the47 fresh masked frames are replaced. All69 Floreasca and74 Grozăvești untouched item dictionaries, image bytes, thumbnail bytes, dates and source SHAs remain unchanged. Their129 perspective frames and separate perspective collection metadata are untouched. Current source counts are:

| Atlas | 4378317 original | 0775fdaf earlier water | bbaffc0d fresh |
| --- | ---: | ---: | ---: |
| Floreasca90 |63|6|21|
| Romană116 (untouched)|103|13|0|
| Grozăvești100 |69|5|26|

The mixed publisher rejects unreviewed or changed-ground-pose input before mutation; both negative controls are recorded. Fresh image hashes, source inventories, complete capture/validation logs and public paired-review hash ledgers live under each collection's `retakes/bbaffc0d6cdccb6246edeb9478c58590852980d9/`. Root's prior current manifests match the planning hashes. `installed-validation.json` reports0 failures across306 current atlas frames,884 historical frames and129 separately listed perspective frames. No current source date or source SHA is relabelled.
