# Grozăvești tram source audit — c2acc8d5

**The native trams follow motor carriageways several metres away from the mapped tracks.** The motor-road one-way rules are correct. A reverse motor-road exception would not fix this source error.

Read-only audit of source `c2acc8d59cab1ca5f8da4f1f44bbdc5706f56f76`, native constructor fixture SHA-256 `8f6cb9e27941445c0d8515a79a1fb715797f6b86ab2af2e1952473aa8cf8ee9c` (263 actors, 768 graph nodes, 801 motor edges). All 16 existing cached OSM tiles were read without downloading anything. Their 168,629 nodes, 24,931 ways, 913 relations and 131 tram ways have zero conflicting duplicate objects. Exact tile hashes, source tags/versions, way node IDs and projected coordinates remain in `raw-audit.json` and `all-tram-source-ways.json`. No browser, production edit, reference imagery or actor removal was used.

The two motor ways **80013062** and **277315765** are secondary roads named Bulevardul Doina Cornea, each `oneway=yes`, `lanes=2`, `sidewalk=right`; neither carries a tram direction exception. They have no explicit measured width. Native 7 m road width, 3.5 m lanes, median -7 m and zero centre shift are model defaults, not measurements.

The real tracks are separate ways:

| Source rail way | Actual source direction | Ordered route evidence | Track tags |
| --- | --- | --- | --- |
| **128304860** | node1418266859 → node933659753, locally southbound | relation1274386/ref1: 128304859 → 128304860 → 909062900, shared endpoints1418266859/933659753 | tram, oneway=yes, gauge1435, STB, contact_line, 750V DC |
| **660918285** | node8440717953 → node6187777607, locally northbound | relation2212351/ref10: 109850457 → 660918285 → 660918286, shared endpoints8440717953/6187777607 | same |

The existing rendered tram polylines already follow these sources: prepared index0→128304860 (maximum vertex-to-source error .05798 m), index1→660918285 (.05342 m). All **24** prepared polylines are matched to their actual source ways, with maximum errors below .071 m, in `alignment-findings.json`. Keep these render points unchanged when adding identity/direction metadata. The native `world.js` proximity flag and `traffic.js` synthetic tram offset do not establish that a motor carriageway is a rail path.

| Actor / motor edge | Correct-direction source rail | Body centre distance to that rail | Rail lateral coordinate in motor-edge frame | Native body centre lateral coordinate |
| --- | --- | ---: | ---: | ---: |
| 259 / e161 w277315765 | 660918285, nodes8440717934–8440717935 | 5.0536 m | -3.6030 m | +1.4500 m |
| 260 / e161 w277315765, reverse motor dir | 128304860, nodes933659662–933659677 | 5.2282 m | -6.5698 m | -1.3417 m |
| 261 / e74 w80013062 | 128304860, nodes933659685–6570499867 | 8.2905 m | -6.8393 m | +1.4500 m |
| 262 / e74 w80013062, reverse motor dir | 660918285, nodes8440717932–8440717933 | 8.1820 m | -9.6217 m | -1.4500 m |

Actor260's *nearest* rail is 2.527 m away but points against its mapped one-way direction. Its correct-direction rail is the other source track above. Actor262 has the same distinction. The complete fixture also contains trams257/258 on e63/w80013062; both are off track and are retained as additional controls. All six native tram centres and full 27/36 m ×2.4 m drawn envelopes are audited, rather than inspecting only a road midpoint. Twenty-five samples along each drawn body centreline plus a 1-Lipschitz continuous-distance bound prove the mapped track centre stays outside the whole body XY envelope in all six cases; even actor260's conservative bound is1.2937 m versus its1.2 m half-width. See the standalone [source-body map](source-body-map.svg).

Gauge1435 mm measures between rails, not tram-body width or clearance. Local track ways lack bridge/layer/tunnel/ele/incline tags; absolute rail height, pavement datum and slope are not surveyed. Separate northern continuations128304859/660918286 carry bridge/layer1 tags, which cannot be converted into metres. The ref11 relations retain their `Temporary suspended due to rail repair` notes. Ref1/10 membership is cached source evidence, not a live-service timetable.

[PROPOSAL.md](PROPOSAL.md) gives the smallest generic directed source-rail adapter and dataset fields. The motor graph and source geometry stay unchanged; trams need real rail ownership, source-node-only continuity, shared physical controls and truthful unknown-grade handling. Station packing alone cannot certify these off-track poses. No implementation or native acceptance is claimed by this commit.

Reproduce the read-only CPU audit from existing caches:

```sh
python audit-raw.py /workspace/reality-pass/grozavesti/tiles /workspace/reality-pass/remaining-ro/admission-fixture-groz-c2acc8d/fixture.json /workspace/reality-pass/remaining-ro/source-c2acc8d /tmp/groz-tram-source-audit
python analyse-alignment.py /tmp/groz-tram-source-audit /workspace/reality-pass/remaining-ro/source-c2acc8d
```

The large original fixture stays in its existing lane; only the six relevant native actor records, source geometry and the small derived proof are included here. Raw tile and native fixture hashes are pinned in `proof-manifest.json`; no raw evidence was deleted.
