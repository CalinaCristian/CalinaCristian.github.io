# Ordinary vehicle support at mapped shape points

The native 54 Romană and Unirii constructor failures exposed an overly narrow source-domain rule: an ordinary car had to fit wholly inside a single leg between two mapped vertices. Some literal source legs are shorter than a car. The bounded search was preserving that restriction correctly; raising its work limit could not create legal candidates.

The new pure helper permits body support over a unique, legal, internal degree-two continuation of the **same source way**, retaining lane profile and known flat grade. The centre remains on the assigned leg; edge, direction, lane, kind, dimensions, IDs, objects and RNG remain unchanged. Pads, signals, crossings, stops, forks, foreign ways, width changes and unknown profiles are boundaries. The complete rectangle must lie inside the exact native asphalt union and behind the retained endpoint planes. Polygon subtraction checks interior gaps as well as corners. The native static, pedestrian, shared-lane, long-body and full-fleet transactional guards remain in place. Missing canonical context retains the old one-leg rule.

## Final bounded CPU results

| Native54 fixture | Original constructor | Original unresolved peers | Candidate unresolved peers | Work / depth | Separate retained failure |
| --- | ---: | --- | --- | --- | --- |
| Romană | 492 | 129/172, 154/350 | none | 134 / 1 | Unbound tram 490 remains invalid; overall admission stays false |
| Unirii | 482 | 232/465 | none | 950 / 4 | None in this constructor replay |

`romana-final.json` and `unirii-final.json` are the final reports. Both first reproduce the original native unresolved pairs, all original applied station repairs, invalid rail modes **and complete search metrics exactly**. The unchanged limits remain depth 6 / work 8192. All constructor objects and ID order survive; both global and Traffic RNG throw if called during admission. Final application uses original native placement and checks exact planned poses.

Unirii's export includes all primary buffers and complete world-height intervals. The replay checks byte-identical primary position arrays and matching actual world intervals for all 482 actors in both baseline and candidate inputs (964 checks of each). Romană's older export has full body poses but only tram buffers; its original emitted-height conflict records and exact native baseline/search match remain the height evidence for ordinary actors.

The Romană necessary-condition proof in `diagnosis.json` independently shows why the old domains fail. Across their entire continuous station domains,129/172 still overlap by at least 0.907518852m,154/350 by 1.074208780m with350 held at its unchanged baseline. Vehicle 350 has no one-leg candidate: its 4.305747m leg cannot contain a 4.28m body plus two .05 m margins. This proves the old domain is insufficient, not that mapped road space is absent. Signal node 397 remains a boundary;129's forward limit is unchanged. The actual repairs move 172 alongw178060182 and 350 alongw448266588 without changing their assigned legs or lanes.

## Exact native inputs and reconstruction

Original native source is54c044421640cfe3569bfc3f72159d2169f87581. QA's time-zero exports retain every negative finding. `fixtures/*/constructor-facts.json.gz` copies the producer gzip byte-for-byte. `world.json.gz` is an exact JSON-value projection of the canonical graph, native ribbons and every collider; only unused world sections and per-collider diagnostic`directBandSamples` are omitted. Each fixture manifest records original/projected hashes and counts. No closure code is evaluated or reconstructed.

Each collider property is independently decoded because the observer gives each original`safe()` call its own reference root. The native node export records`allEdges`; actual motor adjacency is reconstructed by the exact order-preserving`e.drivable` filter in native world.js:5817. Captured native rail lane counts reconstruct their omitted direction array, as defined by tram-path.js:153; rail source modes otherwise remain unchanged.

Captured collider functions remain unknown and throw if needed. A collider whose complete horizontal outer/band geometry is provably disjoint from the cover disc cannot collide at any height; the replay uses the unchanged native horizontal collision calculation for that conservative exclusion. It never infers a roof/underside function value. Unirii excludes 57 such disjoint callback occurrences; actual positive horizontal cases still run the native explicit collider checks. Encountering an unknown relevant closure would fail the proof. The CPU canvas stub paints only the taxi sign texture and does not affect physical model geometry; Unirii's byte checks verify that directly.

These are CPU copies of real constructor state, **not** live browser publication, all-district static acceptance, moving-body acceptance or a render-budget result. Romană's unbound tram, other source/World corrections and the final combined native gates remain separate. The earlier54 budget attempts stopped before driving and are not promoted here.

## Controls and reproduction

Seventeen focused tests cover positive same-source support, fallback, every controlled boundary, foreign source, width/grade/lane changes, opposing one-way and rail mode, forks, disconnected geometry, a protruding corner, an interior uncovered strip, a sharp bend, large-coordinate precision, original centre/identity and determinism. Existing 11 planner, 13 native adapter and 13 transactional blocker controls pass. Native static/source/shared rejection behavior and the planner work limit are unchanged.

Use Node 24 and an exact minimal54 runtime archive. It needs source/vendor files; no overview or browser is required:

```sh
node --test handoffs/fidelity/pipera-fidelity/romana-initial-admission-54/source-span.test.mjs
node handoffs/fidelity/pipera-fidelity/romana-initial-admission-54/inspect.mjs EXACT54_RUNTIME /tmp/new-domain-proof.json
node handoffs/fidelity/pipera-fidelity/romana-initial-admission-54/replay-native.mjs EXACT54_RUNTIME handoffs/fidelity/pipera-fidelity/romana-initial-admission-54/fixtures/romana/world.json.gz handoffs/fidelity/pipera-fidelity/romana-initial-admission-54/fixtures/romana/constructor-facts.json.gz /tmp/new-romana-proof.json
node handoffs/fidelity/pipera-fidelity/romana-initial-admission-54/replay-native.mjs EXACT54_RUNTIME handoffs/fidelity/pipera-fidelity/romana-initial-admission-54/fixtures/unirii/world.json.gz handoffs/fidelity/pipera-fidelity/romana-initial-admission-54/fixtures/unirii/constructor-facts.json.gz /tmp/new-unirii-proof.json
```

`intermediate` reports are labelled development observations, not the final source result. Original CPU setup attempts remain under`/workspace/reality-pass/combined-native-budget`: initial canvas/shared-gate/rail-metadata reconstruction errors, a conservative unknown-closure stop, and a motor-adjacency reconstruction mismatch were corrected before the exact native baseline assertions passed. They are observer/setup limitations, not new production failures. No raw native report or source copy was removed during this work.
