# Grozăvești reservation-order correction

The C2 first-publication gate retained six real body contacts at physical time zero. The constructor has **263 actors**, with **374 vehicles / 560 pedestrians** after normal publication additions. This change fixes a bounded-search ordering failure; it does **not** certify the separate tram rail alignment or legal assignment issue identified by US's source audit.

## Exact cause

The retained native 263-body / 30,459-candidate fixture exactly matches every original second-load Grozăvești actor pose, dimensions, emitted vertical interval, source edge, lane and direction. Replaying the frozen pre-correction helper reproduces C2's **entire search metrics and all 116 attempt records exactly**:

- 8,192 work units, no committed transaction, 2,591 rolled-back branches and 2,567 cycle prunes.
- Every retained top-level attempt concerns the first tram, **261**: 112 body rejections (23 against car 64, 89 against bus 231) and four native full-body static rejections.
- **7,857 / 8,192 work units** go to bus **231**: 2,645 candidate visits and 5,212 validations. The bus search is entered 23 times under the same held tram pose and different temporarily repaired car-64 poses. Every cycle prune is **231 → held 261**.

All **115** native source/static-valid bus-231 choices intersect tram 261 held at its original station 5.297091201872295; even the best has 0.399146 m penetration. Changing car 64 therefore cannot make that reservation feasible. The fourth tram reservation, station **4.797091201872295**, permits a clear bus choice. The old first-ID blocker order exhausts its global budget before reaching it. Later pairs are unsearched, not proven impossible.

The six original pairs are car64 / 36 m tram261; hatch71 / 27 m tram259; crossover97 / 27 m tram260; hatch188 / hatch223; 12 m bus231 / tram261; and hatch249 / tram260. The short ordinary ways for 188/223 are 7.981392 m and 5.714896 m. Their existing strict candidate sets contain **49** clear combinations against all other retained actors, so this case provides no basis to weaken ordinary whole-edge containment. Cars 97/249 also have legal clear choices around unchanged tram 260.

## Narrow response

Only `game/src/initial-vehicle-admission.js` changes in production. When a candidate has multiple conflicts, a held body takes priority because that collision cannot be repaired in the transaction. Otherwise the longer conflicting body is tried first; equal lengths retain original fleet order. Candidate order, direct-first repair preference, every validation callback, rollback, body geometry and all source contracts remain in use. The limits stay **depth six / 8,192 work**, with the same 0.05 m clearance. No actors, source geometry, IDs, lanes, directions, dimensions or reservations are hidden or relaxed.

The exact retained Grozăvești fixture now has **zero unresolved contacts** at **2,221 work units** (922 candidate visits / 1,299 validation calls), depth two and at most three reserved bodies. Node cached-validation search measured 27.5 ms; native constructor cost is a separate measurement. Updates retain IDs 231, 64, 261, 259, 97, 188, 223 and 249; tram **260 is not updated**. All 121 of its candidates still receive the existing source-edge/direction/lane rejection. This does not establish that its inherited native assignment is legally or physically on the mapped rail; the independent source rail audit remains an acceptance blocker.

The Unirii 484-body / 48,294-candidate regression still passes, now using **593 work units** rather than 948. The previous 13 transactional controls, 11 planner controls and 13 native-adapter controls pass. The new test also includes a small ordering counterexample: the old planner exhausts the same 96-unit bound, while the priority planner solves it in **46**, with no bound increase. Both retained native fixtures replay deterministically without RNG or input mutation.

## Evidence and reproduction

`priority.test.mjs` verifies the old native failure, observes the frozen helper in memory without changing its decisions, proves the held-tram/bus domain obstruction, checks short-way feasibility and runs the new planner. The observer is pure test instrumentation; no production file or browser is modified by it. All 263 bodies and original source references remain in each collision check. Cached validation is used only at exact retained poses with context-independent nonshared-mouth results; candidates needing a changed shared-context recheck are conservatively rejected.

`fixtures/native-groz-c2acc8d/` reuses RO commit `89af74b55f6e9030cb51eca3378a57291b48e9f1` byte for byte, including the full 768-node / 801-edge native graph, zero-difference second-load parity, source hashes, observer and setup-attempt provenance. Its **1,308,677-byte gzip** expands to the original **45,418,884-byte JSON**, SHA256 `8f6cb9e27941445c0d8515a79a1fb715797f6b86ab2af2e1952473aa8cf8ee9c`. No large raw fixture is tracked. The frozen old helper has SHA256 `7d3a81bebbcaeaabed1f964843f1d958534e5ca312ae9ccc433725355edc2ba0`.

From the repository root:

```sh
node handoffs/fidelity/pipera-fidelity/initial-admission-packing/groz-c2-priority/priority.test.mjs --out=/tmp/groz-priority-new.json
node --input-type=module --check < game/src/initial-vehicle-admission.js
```

All five successful final reports are in `controls/`. `manifest.json` records production/test/fixture hashes and metrics. Actual native provider regeneration, source/static/shared revalidation, exact live application, publication and all-eight-district gates remain required after root resolves the separate sourced-rail assignment issue. No browser, source adapter, traffic controller or render module was changed in this lane.
