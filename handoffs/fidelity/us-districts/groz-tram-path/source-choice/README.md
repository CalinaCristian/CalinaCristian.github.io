# Source choice before rail grade admission

The binder now selects the closest modeled source track in the actor's travel direction before filtering by grade. An unknown source grade/direction remains unresolved instead of disappearing from the search and allowing a different nearby surface track. Candidates remain within the source-connected admitted component. Complete retained ways outside unchanged rendered coverage are excluded from this actor-coverage decision. Source `level` is checked alongside `layer`; neither supplies metres.

`controls.json` proves the previous admitted-only search picks a different ground track 3 m away when the actual closest track is an unresolved bridge. The native Traffic binder now preserves the original actor/mesh/array and reports that source. Supplying a shared synthetic grade binds the correct source. Negative controls retain explicit level zero and ignore an unmodeled retained tunnel. No RNG is consumed.

`romana-native-actor-findings.json` extracts all nine affected modeled source segments and all three snapshots of the two native High/full constructor trams from QA's immutable **6cbf82b61de8267f662bf50239c37ccc1764635c** capture. Its full raw SHA is **c25b01cc7acf5b1d7cba51b9d1aa234439f431fcb493e297c0683b67d65496cf**. This is historical pre-binding native input, evaluated by current CPU methods, not current merged native acceptance.

| Render run | Source | Segments | Source grade context |
| --- | --- | ---: | --- |
| 0 | w241374326 | 3 | tunnel=yes, layer=-1, level=-1 |
| 3 | w920117619 | 4 | tunnel=yes, layer=-1, level=-1 |
| 1 | w243476552 | 2 | level=-1 only |

Native V3A **490** is 7.314899830 m from w243476552 segment 0 and now remains unresolved. Excluding unknown grades before source choice would instead find surface w920117610 segment 7 at 23.655790146 m. Native Imperio **489** is closest to untagged w920117620 segment 0 at 6.837094587 m and binds there in the isolated CPU control. That exit approach is source-connected to tunnel w920117619 at node 8544117712; it still needs a continuous shared tunnel model/render profile. The CPU binding does not establish its real grade. All 491 constructor actor identities are preserved.

The six Groz trams retain their prior source assignments, IDs and meshes in `groz263-binding-cpu.json`. The 13 pure rail controls, native motion and physical claim controls also pass. Their static world is empty by design; they do not establish full-world static/publication acceptance.

`crossing-context.json` is a separate read-only cached source finding: complete footway w665913378 links rail crossing nodes 6234008735/36 to motor node 6234008741 (native 98). The road retains flags 10 but World8cc had signal=false/hasLight=false. Both source rail approach axes are within 0.93° of the exact native road approach. The proposed `tramSourceCrossings` field enables a literal source-linked controller association; no nearest light, graph join, transitive footway flood, or measured real timing is asserted. Root/RO own its metadata/controller implementation.

Reproduce from the repository root:

```sh
node handoffs/fidelity/us-districts/groz-tram-path/source-choice/test.mjs
node handoffs/fidelity/us-districts/groz-tram-path/source-choice/audit-romana.mjs /path/to/constructor-facts.json /tmp/romana-findings.json
python3 handoffs/fidelity/us-districts/groz-tram-path/source-choice/audit-source-context.py --data /path/to/bucharest-grozavesti.json --support /path/to/native-support.json --raw /path/to/buc_44.4350_26.0450_44.4450_26.0610.xml --out /tmp/crossing-context.json
```

The raw inputs remain outside Git. This directory contains source metadata, bounded native actor extracts and audit code only. No browser was opened by this lane for these checks; no source road, rail vertex, model, dataset or global World/controller code is changed in this commit.
