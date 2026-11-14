# Backlog · the one list of open work

Only what is still open. A finished item is removed once its fix is on `master` and re-checked live (owner reports: at
the report pose, from the F8 JSON the owner pastes); its record is the git history. Rules, push checks and what this
folder may hold: [`AGENTS.md`](../../AGENTS.md).

## Owner reports

None open.

## Other open work

| Item | Evidence | Next step |
|---|---|---|
| Chapter drives at legal speed (`--scenario=drive:<id>`) still mostly time out within 300 s. Left: junction knots of a 12 m bus turning across a queue that stopped in its sweep (Calea Floreasca at Str. Protopopescu, about (-176, 97)); a circular leader queue inside the Petricani / Fabrica de Glucoză box (about (992, 138)); slow drain of the 15-node Piața Romană controller; signal gridlocks on the SeaTac and Bellevue finale routes (International Boulevard at South 170th Street, about (-841, -68); Northeast 8th Street lane drop, about (-502, -335)); `no route after reset` after R resets. | `npm run harness -- --scenario=drive --city=bucharest`: otopeni passes on master; upb and db also pass in some runs since the traffic deadlock fixes; the rest time out. | Prevent box entry into a long vehicle's swept path; detect a closed leader cycle in a junction box and back one car out. |
