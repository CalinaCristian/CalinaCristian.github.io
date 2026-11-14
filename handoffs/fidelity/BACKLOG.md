# Backlog · the one list of open work

Only what is still open. A finished item is removed once its fix is on `master` and re-checked live (owner reports: at
the report pose, from the F8 JSON the owner pastes); its record is the git history. Rules, push checks and what this
folder may hold: [`AGENTS.md`](../../AGENTS.md).

## Owner reports

None open.

## Other open work

| Item | What is open |
|---|---|
| Floreasca contraflow bus lane | Calea Floreasca has a contraflow bus lane on its west side (OSM `busway=opposite_lane` on its one-way ways; plain asphalt with BUS lettering on the aerial). The build only sets the edge's bus-lane flag (`tools/osm/build-data.mjs`), so no contraflow lane exists in the road topology. |
