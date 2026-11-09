# Bounded initial vehicle packing

The flat constructor planner could not repair the retained c4 Unirii bus pairs **61/366** (2.401272 m penetration) and **155/315** (2.045061 m): every legal station encountered either the paired bus or a neighbouring car. The new planner first preserves its existing direct-repair order, then reserves an exact candidate and searches for source-legal moves of its flexible blockers. It backtracks earlier blocker choices when a later body cannot fit.

The only production edit is `game/src/initial-vehicle-admission.js`. Candidate generation, native ordinary/connected-leg long-body placement, model-derived vertical intervals, source/static/shared-lane validation and live application remain with the existing caller. Source edges, lane, direction, dimensions, IDs, fleet objects and RNG are retained. No live body or mesh moves during planning.

Reservations prevent cycles and share a finite depth bound, including sibling blockers. Defaults are **six blocker levels / at most seven reserved bodies** and **8,192 total work units**. Work counts every candidate visit and validator call, including final full-context rechecks. Each failed branch restores planned body references, updates, validation-peer metadata and tentative accepted records through a transaction trail. Earlier independently committed repairs survive later failed transactions. Rejection diagnostics and aggregate work metrics remain observable. A failed search leaves true unresolved contacts visible; it never clears a neighbour without validating a complete plan.

## Pure results

- Existing **11 planner controls** and **13 native adapter controls** pass, including exact legacy repair IDs/poses, real emitted model heights, whole-body static coverage, shared reservations, unchanged source/mesh/route/history identity and connected-leg long-body semantics.
- **13 new synthetic controls** pass: the old bus/neighbour counterexample, three-body chains, sibling depth limits, backtracking, held cycles, an immovable third body, full-context validator rejection, parent/child record rollback, retention of earlier committed updates, work exhaustion, source contracts, determinism/RNG and long-leg semantics.
- The exact retained **484-body / 48,294-candidate c4 native fixture** passes and replays identically. Flat mode still retains the two original bus conflicts and its four ordinary repairs. Packing has **zero unresolved, invalid-body or unknown-height cases**, uses **948 work units** (393 candidate visits and 555 validation calls), reaches depth **2** with at most **three** reserved bodies, and records 175 rolled-back branches / 169 cycle prunes. The cached-validation Node search measured 27.8 ms; this is not native constructor timing or frame-rate evidence.

There are **11 accepted reservations and eight changed stations**: changed IDs are 40, 399, 127, 61, 145, 155, 423 and 461. Reservations 266, 366 and 315 keep their original stations. Every update retains its original vehicle/source identity; unchanged reservations remain explicitly validated. The full 484-body collision set stays present, with actual retained emitted vertical intervals and heading rectangles.

The native fixture is a finite pure control, not completed runtime integration. Its station providers were enumerated from their original native origins. The affected tunnel buses and flank cars use context-independent nonshared-mouth checks, so their exact cached source/static/shared results remain applicable. Candidates whose true shared-section result requires a changed-context native recheck are conservatively rejected by this fixture loader. **Actual native provider regeneration, final native shared/static rechecks, exact live application and first-publication/all-eight-district gates remain required.** No browser was launched by this lane.

## Fixture and reproduction

`fixtures/native-c4fd625/` copies the exact portable RO fixture/provenance from commit `eec74d8634563f935ef2f92ca68d0fccebe27e01`, produced against source `c4fd6255f928101e27874f37776ed5be8d805827`. Its 191 source hashes were independently rechecked against both the immutable archive and Git blobs. The extraction report records physical time zero, unchanged live poses/routes and hard-throw RNG channels. Source/input identity checks and global RNG refusal also run in the pure test.

- Uncompressed JSON: **69,281,411 bytes**, SHA256 `99cdc37345694ca7fff252f94dfe1adce7cb7caad63beb27459d37126f6dba0a`.
- Lossless gzip: **1,936,444 bytes**, SHA256 `5eb0ea4953959ea72f2fa0254dcec7cf035fcd9736d94e7082f440066f510a85`.

The gzip bytes are reused unchanged from RO's commit. No large uncompressed fixture is newly tracked. The loader verifies the original JSON hash and reads gzip directly. From the repository root, use new output names:

```sh
node handoffs/fidelity/pipera-fidelity/initial-admission-packing/blocker-packing.test.mjs --out=/tmp/packing-synthetic-new.json
node handoffs/fidelity/pipera-fidelity/initial-admission-packing/native-fixture.test.mjs --fixture=handoffs/fidelity/pipera-fidelity/initial-admission-packing/fixtures/native-c4fd625/fixture.json.gz --out=/tmp/packing-native-new.json
node --input-type=module --check < game/src/initial-vehicle-admission.js
```

Existing focused suites are `handoffs/fidelity/us-districts/start-admission-d981eee7/admission-check.mjs` and `handoffs/fidelity/us-districts/initial-traffic-adapter/adapter-check.mjs`. Both take `--native-root=EXACT_D981_ARCHIVE --out=NEW_REPORT`; they verify the pinned original placement/model modules before running. All four final reports are retained in `controls/`; `manifest.json` hashes the helper, tests, fixture and evidence.
