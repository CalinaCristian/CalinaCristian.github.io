# Backlog · the one list of open work

Only what is still open. A finished item is removed once its fix is on `master` and re-checked live (owner reports: at
the report pose, from the F8 JSON the owner pastes); its record is the git history. Rules, push checks and what this
folder may hold: [`AGENTS.md`](../../AGENTS.md).

## Owner reports

None open.

## Other open work

| Item | Evidence | Next step |
|---|---|---|
| Chapter drives at legal speed (`--scenario=drive:<id>`, 300 s) are not robust: on master, over the build and two perturbed variants, gts, arnia and uipath-buc always time out, otopeni passes 0-1 of 3, rosetti 1-2, uipath-bel 1 (luck). Knots left: NE 8th St at 106th / 108th Ave NE (-300, -327), (-102, -330): crossing cars nose to side in rings of yields and claims, undone only after 100-190 s; Calea Floreasca at Ceaikovski (-137, -167): a 12 m bus turning with a nose at its rear; Piața Unirii west (-401, 431): a walker held at a car's front on the crosswalk heads a square-wide queue (gts ~1600 m left); Piața Victoriei east (-360, -438): crosswalk waits and ring knots; Șoseaua Pipera (-845, -37): claim / exit-full waits of ~190 s. | Branch `worktree-agent-ae52be869b7cdbd6a`, commit 47f99a90 (not on master; spec 13 text included): contact knots resolve on their own, a car stopped at the box line obeys red (on master a claim stop 1.1 m before the pad counts as past the stop line and the car runs the red), the shared-lane gate holds until the pad, walkers step aside. Over 3 variants: otopeni, luxoft, upb, db, seatac 3/3; rosetti 1/3; uipath-bel 0/3; uipath-buc 426-1001 m left (master ~1000); gts, arnia unchanged. | Undo the NE 8th St rings within seconds (ring members inching ±1 m, backing refused by the bodies around them), then re-measure that branch against master over 3+ variants; clear the walker pinned at a car's front at Piața Unirii; the stages per junction of 35365ebe are still unmeasured on top. |
