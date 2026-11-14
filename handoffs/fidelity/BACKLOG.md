# Backlog · the one list of open work

Only what is still open. A finished item is removed once its fix is on `master` and re-checked live (owner reports: at
the report pose, from the F8 JSON the owner pastes); its record is the git history. Rules, push checks and what this
folder may hold: [`AGENTS.md`](../../AGENTS.md).

## Owner reports

None open.

## Other open work

| Item | Evidence | Next step |
|---|---|---|
| Chapter drives at legal speed (`--scenario=drive:<id>`): gts, arnia, uipath-buc and uipath-bel still time out within 300 s; upb and db pass in most runs, not all. Left: a stopped bus with a car's nose in it and a queue packed behind that car (no follower can back; Șoseaua Pipera at Barbu Văcărescu, about (-805, -11)); lane changes into the stopped four-lane Kiseleff / Titulescu queues into Piața Victoriei knot cars side to side (about (-440, -460), (-520, -404)); Piața Unirii box occupants held by walkers and contact knots (about (-395, 431)); Bellevue 108th Avenue NE / NE 8th Street claim waits (about (-102, -344)), and an R reset there that turns the car onto a 2.4 km detour. | `npm run harness -- --scenario=drive:<id> --city=bucharest`, two runs each: rosetti, luxoft, otopeni, seatac pass both; upb 1 of 2; db 0 of 2 (144 m short after three resets; it passed both runs in four earlier rounds); gts 672 / 801 m left; arnia 420; uipath-buc 1012 / 88; uipath-bel 1891 / 1958. | Back a packed follower chain up one car at a time to open a contact knot; keep a full car gap for lane changes into a stopped queue; make the R reset keep the driving direction when it can still route. |
