# Literal controlled rail crossings

This candidate starts at ROOT `81c78e35167ef871d8e48f49be8e29118a1a2ec2`. It appends only `tramSourceCrossings` to the four existing rail datasets: Grozăvești 5 literal crossing ways, Pipera 2, Romană 2, Unirii 1. The independent ElementTree audit verifies complete raw way/node IDs, reference order, every raw tag, existing projection/q delta coordinates, rendered rail incidence and prepared source-road incidence. Every pre-existing JSON value, four earlier rail metadata fields, generated date and byte prefix is unchanged. The Unirii cache lacks 11 unrelated prepared road ways; none can be a candidate incidence on a selected crossing. Those are explicitly listed in the audit. Every selected crossing road has its raw source way available. No network is used.

Reproduce the append for a dataset without the new field:

```sh
node tools/osm/add-tram-source-metadata.mjs --crossings-only --data game/data/bucharest-grozavesti.json --osm /workspace/reality-pass/grozavesti/tiles --write --report /tmp/groz-crossing-write.json
```

`buildTramSourceSignals(data, network, world)` plans associations only from one complete literal crossing way. It requires controlled tags on both its rail node and road incidence, exact prepared motor source-node identity, existing `world.nodeLight` controller/approach identity, coordinate agreement within existing q rounding and the same conservative parallel-axis rule as `signals.js`. Multiple verified approaches must agree on the exact controller and phase. Missing/ambiguous context remains unresolved and fails initial binding/admission. An unresolved controlled rail node stays red. There is no nearest-light search, transitive curb merge, routing join, motor-node alias, new signal timing or rail-head mesh.

Traffic applies associations immediately after building the rail graph and before binding actors. `railNode.sourceSignal` contains `{node,edge,controller,phase,railEdges,crossingSourceIds,roadSourceId,roadSourceNodeId}`; `node` and `edge` are the verified existing motor references, while `railNode.motorNode` retains its original identical-source-node meaning. `railNode.hasLight=true` makes native signal stopping and source crossing-pad rules apply. `T.tramSourceSignals` and `T.initialTramBinding.sourceSignals` retain serializable `{passed,bindings,unresolved,uncontrolled}`. A false signal result also makes binding/admission fail. The association phase is carried by native box reservations so occupied conflicting phases continue to block both modes.

World dependency: ROOT `6a045054` decodes flag8 into `n.signal` and retains that controlled pedestrian crossing's own controller before junction BFS. This candidate does not edit World. Grozăvești's raw `w665913378` (`6234008737→6234008741→6234008736→6234008735`) binds both rail nodes to exact motor node98 / source node6234008741 / incoming edge78 on `w106797416`. Neighbor `w665913379` shares only the curb and is excluded. Historical source/native evidence copied unchanged from US `920fe6e5817bb8c54ce11297daa1bdd1d5ada0fa` retains the original missing-controller negative (`flags10`, `hasLight=false`). Its raw rail/road axes differ by 0.9167°/0.9291°; this supports only a shared synthetic game phase, never a real-world schedule.

Verification: 12 existing metadata/compiler controls, 8 new crossing controls, 14 actual-source/native-method signal controls and the unchanged native mapped-stop/source-boundary and crossing-claim regression suites pass. In the isolated Groz CPU source fixture, actual Traffic holds the whole tram front before the literal crossing during red, then physically crosses that source node on green. Green still yields to physical vehicle bodies, pedestrian obstacle gaps and crossing counts. Controller/phase mismatches, wrong IDs, wrong axes, unavailable coordinates, ambiguous phases, duplicate source nodes, outgoing-edge phase borrowing and missing context fail. Native World/Traffic road and both rail approaches agree on green/yellow/red; no timing, population, RNG or actor relocation override is added to production.

The CPU controller applies the explicit ROOT flag8 contract to recorded native6cb motor geometry; its held phases and empty static/other-actor fixture are stated in `signal-controls.json`. It is not a new combined native World capture. No browser was opened for this work. Final all-district publication, actual rendered controller, native rail stops/crossings, full-body/static/pedestrian and combined display/bridge gates remain pending ROOT's next immutable candidate. Existing negative native reports are unchanged.

```sh
node tools/osm/tram-sources.test.mjs
node tools/osm/tram-crossings.test.mjs
node tools/osm/tram-source-signals.test.mjs
python handoffs/fidelity/source-controlled-crossing/audit-metadata.py
node handoffs/fidelity/source-controlled-crossing/native-regressions/test-native-motion.mjs
node handoffs/fidelity/source-controlled-crossing/native-regressions/test-native-crossing.mjs
```

The existing general builder's four-field source extraction is unchanged; this bounded metadata addition is performed by the explicit append-only cached-source CLI. Existing rendered track arrays and motor graph fields are preserved byte-for-byte.
