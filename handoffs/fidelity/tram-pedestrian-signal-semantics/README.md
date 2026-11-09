# Pedestrian signal semantics at tram crossings

This candidate starts at ROOT `57ba8f97ea9aae00e786a15b7f7e8ac3317cbe28`. It changes only the pure source-signal classification, focused proof/tests and localized architecture/traffic/README wording. No Traffic, World, source dataset, graph, actor, RNG, timer, physical yield or collision code changes. No browser was opened. Native54 binding/admission/geometry failures remain preserved; this CPU result is not a new native publication or pedestrian-head rendering pass.

The four actual source nodes14189436070/068/069/067 are **`railway=tram_crossing` + `crossing=traffic_signals`**, not railway vehicle signal nodes. Raw `w1559923424` is an asphalt crossing footway with ordered references2159725232→14189436070→14189436068→14189436069→14189436067→3653645079→14189436066. Those four nodes were created2026-09-17T14:44:24Z. All literal rail ways and native rail node grades are ground0. The incident source tram ways are w47373428,w314810034,w660927531,w905360051; no explicit tram-vehicle head tags occur on their39 literal source nodes in the cached coverage. This is not a claim that physical hardware does not exist.

The exact road incidences are source2159725232 on w139756123 (Calea Giulești; crossing=marked) and source3653645079 on w23770526 (Calea Giulești; crossing=uncontrolled). Fresh native54 motor nodes904/765 both have flags6,hasLight=false,Y0 and no light controller. No rail node has an identical motor source node. Nearby source footways w668883524 and w1559923423 share curb14189436066; they do not create a transitive signal association. Raw source/cache and native54 hashes are retained in the fixture/manifest. Motor edge identity uses the actual `edge.access.sourceId` when no direct `edge.sourceId` was exported.

The OSM documentation explicitly distinguishes these meanings:

- [railway=tram_crossing](https://wiki.openstreetmap.org/wiki/Tag:railway%3Dtram_crossing) says “Pedestrians can cross a tramway here.” Its combination table describes crossing signals for pedestrians crossing the tracks.
- [crossing:signals](https://wiki.openstreetmap.org/wiki/Key:crossing:signals) describes signal control of a pedestrian/bicycle/equestrian crossing. [crossing=traffic_signals](https://wiki.openstreetmap.org/wiki/Tag:crossing%3Dtraffic_signals) describes traffic-light-controlled pedestrian crossings.
- [railway=signal](https://wiki.openstreetmap.org/wiki/Tag:railway%3Dsignal) and [railway:signal:main](https://wiki.openstreetmap.org/wiki/Key:railway:signal:main) describe railway vehicle heads. Those tags, and traffic_signals=tram, are absent from this literal context. Their absence does not establish vehicle priority or actual phase timing.

The helper now returns those complete literal `tram_crossing` contexts in `pedestrianControlled`, with source way/node IDs, all raw node/way tags, original references, road incidences and documented evidence. `vehicleControl:'not mapped'` and `pedestrianHeadRendering:'not verified'` remain explicit. These entries add no vehicle red phase or unresolved motor-controller requirement. They do not invent a pedestrian button/request system, vehicle priority, schedule, head position, graph link or rendered head.

Explicit railway=signal, any railway:signal* key or traffic_signals=tram still prevents pedestrian-only classification and retains unresolved vehicle control without valid evidence. Complete source-footway/coordinate/prepared-road identity is required; missing or inconsistent context keeps the previous coverage guard. Physical tram/pedestrian obstacle, crossing and collision checks are untouched. The separately verified source35/36→motor98/edge78 association retains its existing synthetic controller phase and all prior native-method controls.

8 new focused cases and14 existing actual-source/native-method signal/yield cases pass, including the exact four nodes against both uncontrolled road counterparts, explicit vehicle-head negatives, contradictory same-node contexts, missing/invalid source context and read-only state. The actual4-node fixture produces passed=true,pedestrianControlled4,associations0,bindings0,unresolved0. Future native acceptance still requires ROOT's combined corrected source and evolving physical checks.

```sh
node handoffs/fidelity/tram-pedestrian-signal-semantics/test.mjs
node tools/osm/tram-source-signals.test.mjs
```

OSM source data: © OpenStreetMap contributors, ODbL. Documentation canonical URLs and fetched-byte hashes are in the wiki ledgers; raw fetched HTML remains external at `/workspace/reality-pass/remaining-ro/source-signal-semantics/`. No reference imagery is included.
