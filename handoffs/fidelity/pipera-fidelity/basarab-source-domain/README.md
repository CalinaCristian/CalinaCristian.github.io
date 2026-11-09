# Basarab literal source-domain access

Runtime/data candidate: `7330a2ab46e6e0938a3ca7ab046a036d5b9c6f2b`, based on root
`322ddcc639b219a34589006a0e1b493c214b65b1`. This is a bounded compiler/data change. World, Navigator,
Traffic, source coordinates, legal directions, physical dimensions and tolerances are unchanged.

The two reviewed source selections restore the northern exit/return (916.356110428m,26raw legs) and the southern
northbound bridge entry (1118.706216645m,18raw legs). Their40m domain buffers contain the complete conservative
road/sidewalk/shoulder/cockpit/raster envelope (maximum36.128575m). All187reviewed legs, including the earlier
Politehnica–Lukoil returns, are present and in-mask. Their new full600m surroundings are rebuilt from the same16raw
OSM tiles and canopy survey, rather than asserting that old compiled surroundings were complete.

**Native constructor, whole-body/grade/static clearance, continuous normal driving, new coverage pictures and native
render budgets remain open. The reverse ramp w84482671 remains passive and held; its separate96-leg2061.404m return
is not included. Current unchanged Navigator chooses a source-prohibited exit; these data changes do not certify legal
GPS or NPC choices. No new browser ran in this lane.**

## Recorded cause and exact source joins

Frozen native source `b006000f7bae6e6c64103b9548438082026c14eb` retains the full main bridge physically but excludes it
from its routable SCC. Its normal approach stopped at a synthetic closure. The apparent47m approach gap is not a
literal source join: w139758829 ends at n3208556810, while n6261926624 is fed by w84483724.
No straight connector is created between them.

Forced bridge approaches can lie outside the analytic district. The existing boundary-cut search assumes its inside
endpoint is in that analytic domain. This produces an exactly zero-length cut on w665933058 at n981599610 and another
on w668679788 at n6261963477. Production correctly drops edges shorter than.05m; the latter becomes an apparent
one-edge source endpoint and generates an additional closure bundle. The explicit finite source selections replace
these cuts with their full actual source legs; no threshold, SCC or routing exception changes.
`source-closure-topology.json` retains before/after incident source legs. In the candidate n6261963477 has two real
positive-length incident legs, including the48.802330m continuation to n3208556810. The later00c native cone lacks a
recorded bundleID; removing its actual physical obstruction still requires fresh native verification.

The source north exit obeys r21387140 and r21387141. At n981549744, r21387141 requires w668679784→w50586387;
returning toward w84483724 therefore follows a real block loop. Immediate source reversals remain rejected.

South entry touches raw r21068490 v2, which has a literal via n2159714520 and sole to w314448326, but no from member.
The retained cached XML and fresh official OSM API readback agree. The first compiler attempt correctly rejected it;
that negative is retained. The narrow validator now requires the known exit for **every** visited arrival at that node,
so this reviewed transition satisfies every possible missing-from completion. The raw member remains absent.
Conditional/via-way/unknown-to/ambiguous-to/different-exit/unobserved-exit cases remain rejected. This is reviewed-path
compliance, not a new runtime permission or reconstruction of the missing source member.

## Retention and CPU results

The baseline rebuild differs from accepted source only in four generated geometry-cache fields. The final rebuild keeps
all1185old positive source nodes at exactly the same XY; all2559old physical building footprints, holes and dimensions;
all303old source-road metadata/profile variants; all19289old crown records and all526old area-source identities.
No old in-mask cell is removed. It adds48road pieces,373source bodies and2500crowns with their actual context.

Domain promotion enabled a source bank's ground-floor band and otherwise changed Creditcoop w458458366 from14.5m
to15.5m. Its literal five levels did not change. One provenance/unchanged-dimensions/unchanged-raw-footprint gated prior
per-storey MODEL retains14.5m before roof/physical cache baking; source or research height always wins. This is not a
surveyed height. All81previous measured crowns filtered by the larger road domain retain their exact prior survey
indices/geometry. All142context-retention crowns were independently verified in the exact prior406a source dataset.
Their physical trunk clearance remains a separate gate.

Final source audit:0issues,0missing full-ring ways/vertices. The rebuilt data contains361road pieces,2932source
building bodies,21789trees and560areas. The two new centreline paths remain within the earlier600m source context;
their new40+600m detail bounding boxes also fit the retained tiles and declared canopy survey:

| Selection | Complete new detail bbox (south,west,north,east) |
|---|---|
| Northern exit/return |44.4394428827,26.0565645658,44.4532195173,26.0768524342|
| Southern entry |44.4286743827,26.0465631658,44.4467618173,26.0683528342|

Maximum excursion beyond the old analytic core is bounded by1m samples plus a.5m Lipschitz bound:
290.644695–291.144695m north and311.691271–312.191271m south. Source widths remain unchanged.

The corrected CPU graph builder uses production pair deduplication and the.05m edge minimum. It reproduces the native
baseline900main nodes/933main edges after the exact degree-two profile subdivision count. The candidate predicts
1180/1227, while all main w458458361 and shared w668676694/697 legs become routable. That is topology parity,
not a native frame or fleet measurement.22corridor controls and10context controls pass; syntax and whitespace pass.

## Retained GPS negative

`compiled-domain-check-final.json` runs the actual production Navigator on the exact compiled graph without OUT driving
edges. All four tested new routes exist, but each takes the r21387141-prohibited w668679784→w84483724 exit. The
approach n981567012→outer n6261926624 returns358.144577m using that prohibited exit; the independently valid source
approach is804.853428m. This negative is handed to the separate runtime restriction lane. The current restrictions
catalogue contains relations touching reviewed ways and is not claimed to cover every district restriction.

## Reproduction

Run from this candidate checkout. No command below starts a browser.

```sh
git show 322ddcc639b219a34589006a0e1b493c214b65b1:game/data/bucharest-grozavesti.json > /tmp/basarab-before.json
node tools/osm/source-return-corridors-check.mjs
node tools/osm/source-return-context-check.mjs
node handoffs/fidelity/pipera-fidelity/basarab-source-domain/audit.mjs handoffs/fidelity/pipera-fidelity/basarab-source-domain/native-b006-graph.json.gz /path/to/retained/tiles /tmp/basarab-paths.json
node handoffs/fidelity/pipera-fidelity/basarab-source-domain/check-data.mjs /tmp/basarab-before.json game/data/bucharest-grozavesti.json /tmp/basarab-compiled.json
python handoffs/fidelity/pipera-fidelity/basarab-source-domain/check-retention.py --accepted /tmp/basarab-before.json --candidate game/data/bucharest-grozavesti.json --out /tmp/basarab-retention.json
node tools/osm/road-source-audit.mjs --data game/data/bucharest-grozavesti.json --osm /path/to/retained/tiles
```

A rebuild writes its checkout's data file, so use an isolated checkout:

```sh
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles /path/to/retained/tiles --cache /path/to/retained/osm-cache --city bucharest --district grozavesti
```

The portable original-element XML subset preserves all reviewed way/node/restriction identities and raw tags. Its
subset is not a full600m context cache. The complete raw tiles, canonical native World export and all original failed
native reports remain held externally; their hashes and original source commits are recorded in manifest.json.
