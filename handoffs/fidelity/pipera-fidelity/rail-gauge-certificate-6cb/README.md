# Exact north guardrail / source-gauge certificate

**The entire inferred native guardrail face is inside the mapped track's running gauge, at a compatible modeled height.** This result needs neither uncertain asphalt widths nor a long-train swept envelope.

The immutable native source is `6cbf82b61de8267f662bf50239c37ccc1764635c`; export SHA is `a1dcca3b1a573028b7f659787b2c7db34dd874b0a28b6697d34593be6f417bb3`. The exact Float32 vertices of `solid 1,-2` triangles 648/649 define a 0.9883 m vertical wall between:

- A: `(581.0740356445312, −853.4430541992188)`
- B: `(581.8907470703125, −853.99951171875)`

Raw OSM way `205971103` has `railway=tram`, `gauge=1435`. Both endpoints project inside its exact source segment 20, nodes `6187848807 → 6187848833`. The native retained source polyline uses the same segment identities.

| Endpoint | Distance to precise raw OSM centerline | Distance to retained native centerline |
|---|---:|---:|
| A | 0.398302767 m | 0.419532142 m |
| B | 0.350895528 m | 0.372253152 m |

The half-gauge is 0.7175 m. Both projections are interior to the same segment; the projection parameter and signed perpendicular distance vary affinely along the wall. Their endpoint bounds therefore certify the **whole face**, with minimum margins of 0.319197233 m against raw geometry and 0.297967858 m against retained native geometry. The other literal track, `118416425`, is approximately 2.72 m away and supplies a negative control.

The wall's native vertical band is `[11.239999771, 12.340000153]` m. The current known 100 m rise model has constant rail displacement 11 m across this segment. Its rendered rail-head plane is `11 + 0.24 + 0.03 + 0.006 = 11.276` m, strictly inside that band. This is a **modeled** grade compatibility check, not a surveyed elevation or conversion of OSM layer to metres. Input snapshots retain the consumed grade-module hashes.

The wall occupies space **between** the two rails at their running height. This does not claim that it touches a steel railhead itself. It establishes a track-gauge obstruction independently of body length, pantograph or aerial registration.

The source module at the native commit emits these bridge-default railings in `world.js` under `// bridges: railings` / `if (e.bridge)`, using road widths and `c.solid.wall`, with a separate generated `kind:'rail'` collision path. This block does not consume an OSM barrier record. The road's source identity `w1552024282` is not a mapped fence identity. Exact source excerpts and full module SHA are in `inputs.json`.

The cached raw OSM search found zero barrier ways within 100 m of this north location. That is retained as a limited cache result, **not proof that no physical barrier exists**. Inferred origin comes from the emission code. The certificate supports a generic, height-aware **inferred-only** rail-clearance omission or clipping; it does not authorize deleting mapped barriers, altering source centerlines, choosing passing road widths or changing grade. The bridge worker owns implementation and final native verification.

Reproduce with no browser or external dependencies:

```sh
python handoffs/fidelity/pipera-fidelity/rail-gauge-certificate-6cb/certificate.py /tmp/new-source-gauge-certificate.json
```

The script verifies source node identities, both exact geometry representations, the whole-segment gauge bound and height compatibility. Negative controls retain the other mapped track, a wall shifted three metres and an incompatible ground-level vertical band. This folder is separate from the earlier width measurements and vehicle-body snapshots. No production files or reference imagery were changed.
