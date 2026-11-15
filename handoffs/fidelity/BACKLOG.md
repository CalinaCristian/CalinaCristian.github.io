# Backlog · the one list of open work

Only what is still open. A finished item is removed once its fix is on `master` and re-checked live (owner reports: at
the report pose, from the F8 JSON the owner pastes); its record is the git history. Rules, push checks and what this
folder may hold: [`AGENTS.md`](../../AGENTS.md).

## Owner reports

All 2026-11-15 reports are fixed and re-checked live (release 9f47516f), so they are removed. What is left of them:

| Where | Open | Next step |
|---|---|---|
| Bellevue | Lane lines jump up to ~3.5 m where a restored one-way run meets a different lane count; bare junction interiors at 112th Ave / NE 8th St and the I-405 ramp terminal | Taper the lane change over the run; fill the interiors from the junction polygon |
| SeaTac | Ramp w31928834 overlaps w31928843 by ~1 m; the Airport Expressway 3-lane parts sit 1.85 m off their mapped line | Check against OSM and Street View at those ways |

## Other open work

| Item | Evidence | Next step |
|---|---|---|
| Chapter drives at legal speed (`--scenario=drive:<id>`, 300 s): master arrives 35/60 (10 chapters × 6 variants, 2026-11-15); otopeni, seatac and upb always, gts, arnia and uipath-bel never | The `knots` notes in each drive result (what the car ahead of the stalled player waits for, link by link) put the lost time at the squares: 45–50 s reds at Piața Unirii, Victoriei, Romană / Magheru and NE 8th St (signals.js caps a square at a 60 s cycle), first-come box claims of cars still crawling through a big cluster, lane drops on NE 8th St, and zebra walkers inside Piața Unirii. Nine rounds of knot fixes did not beat master. Spot rules (rounds 1–8) only moved the jams. A general wait-for resolution (round 9, branch `worktree-agent-a83ca3adc955d6452`, not merged) cut NPC knot time 75 % and resets 37 % but arrived 32/60 | The owner decides: shorter square cycles / budget, or treat this as realistic traffic and gate only on deadlocks (no NPC still > 120 s). Measure any change with 6 variants × 10 chapters against master in one batch |
