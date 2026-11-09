# Bellevue covered-street native failure and shared-asphalt candidate

Frozen runtime7bd9eae1a9de9c6b6d0ab3959d44b979b4f99d79 verifies the reviewed Avenue Square street/ground anchors at floor0, asphalt0.24, while retaining literal tunnel=yes and effective modelLayer0. All20 historical comparison camera bases become0.24. Both parentw1223091246 and overlapping partw1223091251 retain physical ceiling and outside solids. No images were captured after the physical gate failed.

Actual native e839,t.85,lateral1.5 shows a0.01613668m car-corner contact with parentw1223091246. The corner circle is INSIDE actual native asphalt e840. The earlier CPU replay incorrectly omitted the renderer's default0.15m shoulder on each side; that replay is retained, explicitly superseded. Actual asphalt6.3m versus the source lane/class estimate6m is the cause. This is not a camera problem or a valid outside-road negative. A49.2simsec/75m native input-driven passage route completes with zero contacts/resets; the earlier45s bound timed out7m short with zero contacts/resets. Both raw runs remain intact. Slow software-renderer traffic-update warnings remain low severity and are not a mobile performance acceptance.

The candidate shares EXACT existing asphalt polygons with rendered and physical building passages. It includes only w1222672054 plus the already reviewed literal portal chains w1285047732, w1225324172 and w1225324171. Their source node/segment identities, effective floor0 and complete coverage are checked. The unreviewed anchor roads are excluded. Native prepared edge IDs835–844,862–865,916 are recorded individually; source segment8 has two pieces and must not be deduplicated. Parent/part clipping bounds the opening; all original source footprints, tags, access, road geometry and upper volumes remain. Existing numeric width/clearance priority remains: an actual ribbon beyond literal width fails closed. The source6m estimate and native6.299997–6.3m shoulder-inclusive extent remain separate.

Replacing capsules with only the tunnel's native quads exposed five portal fixture contacts because the tagged tunnel endpoints lie inside the cover. The approved completion uses the exact reviewed mapped ground-join polygons through those mouths, not round caps or a clearance epsilon. No nearest road or invented graph join is used.

Nine focused CPU controls pass against actual frozen native polygons/bands. All66 car fixtures are physically clear with the candidate;65 have whole circular-boundary containment in the actual native asphalt union. One source-tangent fixture at e835,t.85,lateral−1.5 extends outside asphalt and is excluded from the legal-positive count. Both source bodies retain upper/outside controls, and a genuine ground-level parent wall beyond asphalt still blocks. Literal-width contradiction, missing span and wrong-floor negatives withhold the complete opening. Full fresh candidate World, route, render-budget and picture acceptance remain pending.

Portable raw native reports are gzip copies with raw/compressed hashes in proof/provenance.json. Source184-file Git/blob/SHA ledger is proof/source-provenance-7bd.json. Historical2b2b970→7bd profile comparison matches way, ordered original endpoint IDs AND actual endpointXZ:45 changed edges, bounds x[−611.739,−507.506],z[−502.558,−373.415]. No other source geometry changes are inferred from that historical comparison.

Run from repository root:

```
node handoffs/fidelity/overview-bellevue-covered-7bd9eae1/check-native-ribbons.mjs handoffs/fidelity/overview-bellevue-covered-7bd9eae1/proof /tmp/bellevue-covered-cpu.json
node --input-type=module --check < game/src/covered-road-models.js
node --input-type=module --check < game/src/world.js
```

All426 original street captures and aabd known-issue retakes remain untouched. New corrected-source captures will be a separate collection after native acceptance. Reference-provider pixels remain private and are absent from this proof.
