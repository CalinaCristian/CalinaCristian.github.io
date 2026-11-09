# Grozăvești source return corridors · bounded candidate

The correct mapped Lukoil target is reachable from the native public spawn, but the old finite district removes legal
return roads from the Politehnica side. This candidate retains the actual directed source legs before clipping, rebuilds
their finite domain and600m context, and preserves all previously retained source geometry. It changes no Navigator,
World, Traffic, actor, source coordinate, direction or physical tolerance.

**This is an offline compiler/data pass. World boundary integration, native whole-body/static clearance, driven routes,
all affected overview captures and native render/population gates remain open.** In particular the old all-height mask
wall across a forced retained Basarab bridge is not fixed by claiming the two reviewed return paths are in-mask.

Candidate implementation/data commit: `c7185127d31c4f1d14cadcf8cbe0ed2f2e44d46d`; dataset SHA256
`fa12eda6365d369c79222ed8af0a068f5173899d71698a7f94cd70682dac4685`.

## Exact facts

QA8e4 native readback gives Lukoil's actual public curb at `(95.61743476365,-571.36829378971)`, source roof
`w256806132`, Șoseaua Orhideelor4. The actual UPB door is `(-298.57150347112,350.61397060986)`.
Native spawn→fuel succeeds694.375468m; the native near-ramp `(-72.4656,108.6855)`→fuel returnsnull. On the archived
ff6 native motor graph all44 Doina Cornea legs fail to reach the fuel street, including an independent direction/access
search over all actual exported edges. Virtual OUT does not supply a driving route.

Cached raw OSM source gives two public nonservice return paths with identical source-node joins, no immediate U-turn,
literal motor directions and no touching unsupported via-way restrictions. The compiler also checks terminal source
turn choices and retains the one touching relation `r3259668` (`only_straight_on`,198350034→723716274 via933659667).
At node4544523820,106797416 and242364260 are incoming one-way ways and241717664 is the sole legal outgoing way.
The mapped left bend is already inside106797416; its `left|left` tag is retained. A local−13.55° tangent after that bend
does not create a forbidden branch at the merge. Real choice junctions still undergo lane/turn validation.

| Raw source path | Length | Maximum beyond analytic old core | Maximum beyond native old mask cells |
|---|---:|---:|---:|
| Northbound Doina e164→Lukoil |1500.096709m|165.801930–165.926920m|139.298126–139.423116m|
| Southbound Doina e66→Lukoil |3258.137468m|394.280764–394.405754m|358.687074–358.812064m|

Bounds use samples no more than0.25m apart and a1-Lipschitz interval bound, not just vertex maxima. All41 north and102
south source legs are already represented completely by exact old core+passive-scenery donor coordinates;7/52 legs
respectively are not wholly represented as native directed physical core roads. All positive matched native source-node
coordinates agree exactly. The road graph therefore needs source promotion and a coherent domain rebuild.

Both centreline paths lie inside the old600m detail ring. Their **new full600m surroundings are not claimed covered by
the old compiled data**. Both complete new40m domain+600m context bounding boxes lie inside the retained16tile source
rectangle `[44.425,26.029,44.465,26.093]` and measured canopy survey `[44.428,26.038,44.458,26.079]`. The southern
new bounding box is `[44.42858518267646,26.04059736575271,44.45187221732354,26.06893293424729]`.
Compilation rebuilt that context rather than labelling the old ring complete.

The40m domain radius is an explicit finite gameplay buffer, not a measured asphalt width. The conservative
source-priority road+sidewalk+shoulder+actual cockpit corner+20m-cell half-diagonal bound is at most28.128575m.
Wider future source dimensions fail compilation instead of shrinking the road to fit.

## Retention and checks

Compared with accepted source data `406a53f1f1f1397a1667ea1bc77df78289a5667a` (same dataset bytes as ff6/8e4):

- All1045 positive source road nodes survive at exactly the same XY; all old road raw metadata and physical profiles agree.
- All2416 original source building outer/hole footprints, dimensions, styles, roof classes and levels agree exactly.
- All17002 original tree records retain their packed geometry, tree metadata and measured radii. New totals are2559
  buildings/19289trees/526areas, with313 road pieces and1339 literal source segments.
- All453 old source area identities survive; four accepted far-context water rings are carried unchanged with original
  identity/name/projection provenance. The16local tiles do not contain those distant lakes.
- The expanded compiler would filter61 already retained measured crowns near inferred carriageways. They match the
  exact original survey SHA/index/value and are kept. Their broad filter witnesses are recorded; this is **not** a trunk
  clearance certificate or a collision waiver. Those source/model contradictions remain for native review.
- Extended source retention also preserves every old area geometry/name, line row,131 complete tram source ways,18 raw route
  member lists,549 tagged rail nodes,211 rendered source rail segments,110 railway ways and96 parking polygons exactly.
- The same mask union adds360 occupied20m cells and removes zero old occupied cells. Every reviewed literal leg appears
  exactly once in the rebuilt directed graph; every≤0.5m centreline sample is inside its rebuilt mask.
- Production Navigator on the exact compiled XY/direction/access graph changes0/52 old Doina legs→fuel to69/69 rebuilt
  legs. This reconstruction explicitly omits native World grades/profile splitting/SCC and does not certify a driven route.
- Independent raw-source audit has0issues:184 whole core source ways,1075 visible core/ring ways and5577 required visible
  vertices; none missing.18 covered/tunnel source ways outside the physical core remain explicit scenery exclusions.
- Independent building audit matches all170 core+2368ring valid way/part identities and all4core+17ring multipolygon
  identities/topologies; all literal positive heights/storey counts match. Estimates remain estimates.
-19focused return-corridor cases,8context-retention cases, all8 source-road builder controls plus2virtual-connector
  route controls,15access cases/5router/10builder checks, module syntax and `git diff --check` pass.

The sparse `roadSourceNodeTags` map retains10 actual source-node `level` values, including literal unparsed`-1w`.
The coverage record inspects5414 original core/scenery source nodes,0missing. No `ele/incline` values were found in
that bounded set; no metres or grade were inferred from any level. Older missing metadata remains unknown.

## World integration contract · root owns application

1. Resolve reviewed positive-node source legs against actual kept core edges, retaining exact source IDs/directions/XY.
   Use actual emitted road ribbons/junction-pad support and actual level for body/closure checks. Passive scenery and
   virtual OUT never create a protected driving connection. Missing/mismatched source data remains an explicit failure.
2. Build one finite driving domain from the data mask plus whole-body margin around **already kept source core road
   support**, including bridges retained by the builder's forced whole-span rule. Update the same decoded mask,
   `district.inside`, World/player bounds and invisible-wall outline before publication. Do not open unrelated scenery.
   Source containment must be checked on the whole body/support, not just a point or coarse centre sample.
3. QA's actual8e4 counterexample is e1118/w668700431, lane1, `(638.2198575,-866.8309326)`, road surface11.24m: collider27535
   is a synthetic vertical cell wall at x640,z[-900,-840],y[-40,80] while the source asphalt continues. Preserve this
   negative as a regression. A source bridge retained outside the original mask needs the same finite domain rule;
   deleting all boundary walls or accepting a locally inside centre is insufficient.
4. Rebuild synthetic road-end cross-sections from surviving cuts. Bundle only physically overlapping local same-level
   closures; retain the actual union so each outgoing lane still ends visibly and physically. Clip synthetic walls and
   every corresponding visible barrier/cone/trench/excavator footprint against other retained source support at its
   actual compatible level. Distant/other-level/legitimate external boundaries and mapped fences/barriers stay intact.
5. Physical `mapEnds` and QA's closure dressing must consume the same normalized bundle/intervals. An independently
   hidden decoration with a remaining collider is a failure. The OTP/HenriCoandă central gray-divider and Bellevue/OTP
   overlapping roadworks reports need this shared boundary-source test; their exact causes are not certified here.

Recommended narrow World locations: after exact ribbons/pads exist and before synthetic boundary construction
(currently~2929–2990), normalize domain/cuts; expose surviving common `mapEnds` to dressing~4825–4970. Existing actual
roadside/source-bridge slab gates must remain. No World patch is included in this commit.

## Reproduction and provenance

Run from an isolated checkout. The raw16tile ledger is embedded in
`game/research/source-returns-bucharest-grozavesti.json`; survey/context hashes are embedded in
`game/research/source-context-bucharest-grozavesti.json`.

```sh
node tools/osm/source-return-corridors-check.mjs
node tools/osm/source-return-context-check.mjs
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles /path/to/grozavesti/tiles --cache /path/to/grozavesti/osm-cache --city bucharest --district grozavesti
node tools/osm/road-source-audit.mjs --data game/data/bucharest-grozavesti.json --osm /path/to/grozavesti/tiles
python tools/osm/building-audit.py --data game/data/bucharest-grozavesti.json --osm /path/to/grozavesti/tiles/*.xml --roofs game/research/roofs-bucharest-grozavesti.json --out /tmp/groz-return-buildings
node tools/osm/road-source-check.mjs
node tools/osm/road-access-check.mjs
python handoffs/fidelity/pipera-fidelity/groz-lukoil-source-returns/reproduce.py --repo /path/to/candidate-checkout --native-source /path/to/ff6-source --native-world /path/to/grozavesti-world.json.gz --osm /path/to/grozavesti/tiles --out /tmp/groz-return-replay
```

`manifest.json` pins every portable artifact and lossless gzip's raw SHA/size. The original accepted dataset and actual
unchanged-mask baseline output are retained losslessly. Source graph/mask diagnostics and failed build/tool logs remain
separately labelled. The first candidate's blind local-turn classifier rejection and the first building-auditor glob
invocation failure are tool negatives, not app failures. Successful later reports do not replace those logs.
The preserved diagnostic scripts retain explicit original workspace defaults for exact archived inputs. `reproduce.py`
safely substitutes their path literals from the explicit arguments above, verifies the native World/source hashes and
runs only read-only CPU checks into a new directory. It does not replay the historical pre-preservation crown-filter
report against the already-preserved final data. Native ff6 World exports are separately retained by QA's
portable `preview-ff6b2bff-native` proof; current native target readback is copied byte-for-byte here. No browser ran
in this lane for this work, no provider imagery is included, and no current runtime/native acceptance is inferred.
