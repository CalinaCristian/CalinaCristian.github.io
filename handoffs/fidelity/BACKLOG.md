# Backlog · the one list of open work

Only what is still open. A finished item is removed once its fix is on `master` and re-checked live (owner reports: at
the report pose, from the F8 JSON the owner pastes); its record is the git history. Rules, push checks and what this
folder may hold: [`AGENTS.md`](../../AGENTS.md).

## Owner reports

None open.

## Other open work

| Item | What is open |
|---|---|
| Two failing unit tests | `game/dev/harness/landmark-cec-source.test.mjs` expects the CEC source relation `r2230390` but the source data now gives `r13104090`; `game/dev/harness/spot-availability.test.mjs` expects a recommendation order (`fremont-troll`, `peoples-salvation-cathedral`, `old-town-lipscani`) that `spot-availability.js` no longer returns. Decide per test whether the expectation or the code is wrong and fix it. |
| Floreasca contraflow bus lane | Calea Floreasca's west-side bus lane runs against the one-way traffic (OSM `busway=opposite_lane`, plain asphalt with BUS lettering on the aerial); the build only sets the edge's bus-lane flag, so no contraflow lane exists in the road topology. |
