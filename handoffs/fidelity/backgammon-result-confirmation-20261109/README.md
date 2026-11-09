# Backgammon result confirmation · 9 November 2026

**Candidate behavior:** explicitly confirming a finished full match closes its activity and completes its captured tour step whether the human won or lost. The win callback/achievement remains human-win-only. Loss is never recorded as awarded. Opening, rolling, animation, Leave/Escape, host takeover, exit and tour skip do not confirm a result.

Base: root `57dbb99ef150dd8ec1c8eeeeb6008785bf9585a3`, checked out into the same existing worker worktree on `fidelity/backgammon-result-confirmation-20261109`. No new worktree, source snapshot/clone, browser, World or WebGL renderer was created. Prior pushed OldTown/CV/dialogue branches and all native artifacts remain retained. Only `backgammon-game.js`, this new scoped handoff/tests and the spec 15 append change.

## Behavior / integration

The helper now tracks `resultConfirmed`, `resultClosed` and `awarded` separately. A finished loss offers **Confirm match** instead of immediately resetting into another match. A finished human win retains **Confirm match win**. Both explicit actions call the existing `activityFlow.complete()`, which restores control and calls the actual captured `SpotSession.completeTourActivity` authority. Only a confirmed winner 1 invokes `onDone(s,gameResult)` and records `awarded`; loss records `result-closed` with winner −1 and no award callback.

Before confirmation, cancellation retains the exact immutable finished position for the next interaction. Previously, cancelling a human finish rolled back its last bear-off through the normal partial-turn undo path. That rollback now applies only to unfinished human turns. Finished-board Undo is disabled. Confirmation still waits for the last checker/dice animation to finish. The next interaction after any confirmed closed result starts a normal full opening match, with 15 checkers each. Existing earned progress remains owned by the unchanged registry/callback.

Each opening retains its own run identity, so a detached old confirmation button cannot act on a new activity run. Duplicate confirmation/completion calls do not reaward a win or advance a second tour stop. Skipping cancels the activity and marks the tour stop skipped through the existing core; resuming and confirming that old match cannot complete the unrelated current stop because the actual captured-stop authority rejects it.

Read-only diagnostics `ctx.extras.backgammon.result()` return a frozen `{confirmed,closed,awarded}`. Events retain the existing human `confirm-win`/`awarded` records and add `confirm-result`/`result-closed` for either result. No mutable fixture setter is added to production. Engine/rules/AI/dice function, physical board/checker/opponent geometry, Main/Traffic, global docs and shared flow/session code are unchanged. No core integration hook is required beyond adopting this helper candidate.

## CPU proof / exact limits

Run:

```sh
node handoffs/fidelity/backgammon-result-confirmation-20261109/controls.mjs
node handoffs/fidelity/cismigiu-backgammon/engine-controls.mjs /tmp/backgammon-engine-current
```

The new controller proof uses LinkeDOM 0.18.15, actual production `activityFlow`, actual `SpotSession.captureTourActivity/completeTourActivity/_nextTourStop/skipTourStop`, actual DOM/action/key handlers and the actual unchanged engine/AI. A synthetic flat next-leg route permits testing tour state only; it is not source-path or physical approach evidence.

Two explicitly supplied **valid near-finished endgame fixtures** are injected into the constructor factory in memory only. All final bear-offs happen through real human point/die/off clicks or real opponent update/chooseTurn/applyMove; the final positions validate through the unchanged engine. Subsequent rematches use the normal production factory. Initial/final positions, legal final moves, results and transformed test-module hashes are retained in `controller-report.json`. This is neither a fair full-opening controller match nor native public-game evidence; no production rule/die/position mutation API is shipped.

16 focused controller checks pass: no open/roll credit; actual legal human finish; unconfirmed finished-board cancel/resume; disabled finished Undo; actual E confirmation and once-only win callback/tour advancement; stale confirmation/completion/rematch; last-checker animation guard and cancellation; real opponent legal finish; loss confirmation/no award; next-interaction full rematch; actual core skip and unrelated-stop rejection; host takeover; and actual flow disposal/exit without credit. Reports retain exact runtime source hashes.

Existing unchanged engine controls also pass **22 checks / 20 seeded complete games / 2,446 legal moves / 205 hits**, max 104 turns. The engine SHA256 remains `2fe6d657d3df1c37a80eb2b9e73f3eaca5967be48301ed4fbd2f8bb3c4fea485`, byte-equal to the baseline. No dice distribution, rule, AI or random-source change was made.

An initial controller attempt failed in a **test-only constructor-fixture reuse** case: a later fixture accidentally began an ordinary opening game, so its action rolled instead of confirming. `fixture-loader-negative.json` retains the assertion, failed tool/runtime hashes and diagnosis. The loader now resets its first-constructor flag per test instance; production source was not changed to fix this test issue.

Pending: root adoption and a fresh immutable native match/phone/tour result confirmation run. QA’s earlier immutable 1a9 fair-phone match and every dated source/photo retain their original scope; they are not relabelled as proof of this candidate. No source/current-live/final visual acceptance is claimed.

## Separate dialogue clarification

Prior branch docs-only candidate `1ed2f173` clarifies that `weatherObserved:true` means positively known **current simulation** weather/temperature, including an explicit game override. It does not claim live real-world weather observation. Approved field name is retained. That clarification is a separate commit, not included in this result-fix branch’s delta.
