# Backlog · the one list of open work

Only what is still open. A finished item is removed once its fix is on `master` and re-checked live (owner reports: at
the report pose, from the F8 JSON the owner pastes); its record is the git history. Rules, push checks and what this
folder may hold: [`AGENTS.md`](../../AGENTS.md).

## Owner reports

None open.

## Other open work

| Item | Evidence | Next step |
|---|---|---|
| Chapter drives at legal speed (`--scenario=drive:<id>`): gts, arnia and uipath-buc still time out within 300 s (the other seven pass both runs). Left: Piața Victoriei, Kiseleff entry (about (-430, -440)): the head car in the dropping lane waits at its lane-drop line for 80-100 s while the lane beside it streams past on green (no zipper merge), and the four-stage 60 s cycle gives Kiseleff about 10 s of green; Piața Unirii (about (-441, 423) and (-405, 125)): queue heads held by exit-full and walkers pinned against boxed cars; arnia: four-stage 60 s cycles over long merged controllers (Magheru 12 nodes over 90 m, Piața Romană 15 nodes) cost 45 s reds, and the autopilot stops again inside the cluster. | Two runs each, 2026-11-14: gts 1105 / 1115 m left; uipath-buc 1020 / 1014; arnia 422 / 320. | A zipper merge at lane-drop lines (the car beside a held car lets it in); tie the stage length of a controller to its node span or split 65 m chains into one controller per junction (world rng and fingerprints change); walkers pinned against a stopped body leave the carriageway. |
