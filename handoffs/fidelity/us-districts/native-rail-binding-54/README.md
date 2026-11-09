# Exact native54 failed tram bindings: causal diagnosis

Source **54c044421640cfe3569bfc3f72159d2169f87581**, read-only. The fresh QA export supersedes the older isolated 263-actor CPU binding fixture for whole-World admission. No production, dataset, source geometry, actor, tolerance or browser changes are made by this handoff.

`diagnose-candidates.mjs` consumes the exact native pre-binding actors, typed emitted primary geometry, complete collider records and source data. It uses unchanged source54 projection/placement/static methods. Identified own-slab callbacks are rebuilt from the exact54 shared catalogue and piece IDs; other serialized roof closures are explicitly omitted and enumerated. Primitive rejection positives are causal even with those omissions. A result without a primitive hit is **not** a static clearance pass, and native first-callback ordering is not asserted. Positive bare-mask containment proves native containment without needing its extra landmark areas.

| Failed actor | Total source candidates | Local candidates under unchanged limit | Actual obstruction |
| --- | ---: | ---: | --- |
| Groz 258, V3A 27 m | 77 | 1 | synthesized lamp 20190 |
| Groz 259, V3A 27 m | 75 | 2 | generated separation barriers 27611/27612 |
| Romana 490, Imperio 36 m | 16 | 3 | synthesized lamp 25695 in first two; bus-stop proxy in third |

All failed actors' local candidate bodies are fully inside the raw native district mask. The relevant candidates have source grade 0/native anchor .24. Their rejection is not caused by unknown grade, legal direction, source mode or a support-certificate exception.

**Groz 258:** nearest source w660918285 segment 21, source nodes 12329244827→6187777608, station 80.763972551, distance 7.207631647 m. Proposed pose (-50.877746483, .24, 98.434524723), heading -.737723472. Lamp 20190 is at (-56.131442687, 102.630212160), native radius .18/height 3. Its vertical centre axis intersects exact emitted V3A triangle 1603 at Y .5400000119. This is a real mesh obstruction, not just the disc cover's conservative extension.

**Groz 259:** local source w128304860 segments 11 and 12, distances 8.001445473/18.241483870 m. Both intersect the actual generated concrete geometry. The proof reconstructs the literal World54 rendered barrier, with ±.15 m sides, base native `y0+.45` and top .9 above that base, instead of treating its lower collision band as the concrete geometry. Barrier 27611 intersects emitted triangle 881 at (.376561718, 1.709758060, 36.826225278); barrier 27612 intersects triangle 778 at (-6.210161947, 1.584005961, 43.643459924). The first centreline alone appeared outside the nominal body; the rendered thickness resolves that uncertainty as a true visual contact.

Both barriers belong to generated `genBarriers` separation runs on actual bridge-road w458458374, native edges 1255/1256, estimated profile near 1–2.2 m. The source road tags contain bridge=yes/layer=1, not a mapped barrier. The emission path does not currently invoke the existing source-rail inferred-obstacle gate. Source road/bridge data and profiles must remain intact.

**Romana 490:** first two local candidates are w920117620 segments 5/6, distances 8.996660181/10.382797462 m. Lamp 25695 at (66.471096430, -475.100664646) intersects emitted Imperio triangles 1038/1039 at Y .5400000119. The third candidate at 25.243233413 m is blocked by bus-stop disc 6891 (radius .75). Its centre axis produced no positive emitted-triangle intersection in this bounded check, so it remains a proxy/geometry uncertainty; it is not declared a true visible blocker or a clearance pass.

Both fresh datasets have **zero mapped `data.lamps` entries**. The offending lamps therefore come from the inferred `lampSpots`/osm:false path. Actual mapped lamp records are outside the proposed inferred-only repair.

Bounded correction proposed to root/World owner: apply source-backed actual emitted tram clearance to synthesized lamp emission and generated separation-barrier portions, coupling visible and physical emission. Preserve mapped lamps/barriers, every source road/rail vertex/profile, all actors/IDs/RNG and existing body tolerances. The maximum actual emitted lateral extent must be used, not nominal width metadata: independently scanned actual54 bounds are asymmetric [-1.215000033, +1.223000050]. Barrier 27611 lies 1.357624212 m from the literal rail centreline; nominal 1.2 + .15 would miss its genuine contact. No station relocation or population cut repairs the source scenery conflict.

RO independently found a separate accepted Groz 256/257 mesh contact with raised ground at .37; that source/geometry classification remains with its owner. This handoff does not certify the rest of the World or erase that failure. QA owns any fresh combined native export after root GO; no additional browser was needed to establish these positive causes.

Reproduce with QA's portable54 export/decoder (commit be2b7958f0af0c778ca11d4f77493559429105a6):

```sh
node handoffs/fidelity/us-districts/native-rail-binding-54/diagnose-candidates.mjs /path/to/proof-54c-r2 grozavesti /tmp/groz-candidates.json
node handoffs/fidelity/us-districts/native-rail-binding-54/diagnose-candidates.mjs /path/to/proof-54c-r2 romana /tmp/romana-candidates.json
```

The complete native raw buffers, failed captures and source54 remain immutable in QA's proof. The bounded extracted reports here retain every local candidate and omitted-closure index; no pass is inferred from missing callback coverage.
