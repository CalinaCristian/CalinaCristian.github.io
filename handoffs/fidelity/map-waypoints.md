# Map waypoints and explicit travel

Branch: `fidelity/map-waypoints`, based on `d43fb9e`.

Map clicks now choose a destination. The Here tab retains a labeled mark and the available road/walking route; it never calls the old warp callback. District/spot pins, list rows, Recent, and search Enter mark a place. Remote marks clear the local road route and explain that F travels to another area. Picking a destination leaves the current chapter/objective/progress intact. Clear restores the existing story route. Start here remains an explicit title-screen action; in-game travel buttons say Fast travel.

Hold F works with manual/selected destinations in free roam, Story, and on foot, including directly from the open hub or native district map. Brief presses cancel. Local district travel calls the existing Game.fastTravel path, retaining fuel accounting/refusal, station rescue, legal landing, and other travel checks; on foot it returns to the parked car first (enterCar rather than calling the car to a new pickup pose). Remote travel reuses jump and its preserved travelConditions. Clamp/refuel/transit guards apply before remote travel. The drone T action remains separate. Native tourist M maps retain their existing selection-only behavior; hub Here in a tourist scene marks dry ground and uses the scene's actual walking path, with F as the explicit move.

API added on game.explore:

- destination: null, a point `{kind:'point', key, sceneKey, x, z, label, station?, pin?, route?}`, or a remote place `{kind:'place', key, item, label, remote:true}`. Remote destinations never enter the local road graph.
- selectHere(x,z,pin), selectPlace(item), clearDestination({restore=true}), onNavDestination(dest,manual), fastTravelSelected().
- Game.setNavDest notifies onNavDestination and computes walking routes from the walker. autoRoute leaves a remote mark alone. New chapter/free-roam loads clear stale marks.

Integration in the root-owned car section: routeToCar bypasses Game.setNavDest today. Replace its direct nav.setDestination call with `this.setNavDest({ x: door.x, z: door.z, label: 'Your car' }, true)`, or notify `explore.onNavDestination(dest,true)` there. This prevents an old remote F target from surviving an intentional car route.

Root-owned README/spec updates needed:

- Replace the Here-tab click-to-fast-travel wording with click-to-mark/route. Holding F or pressing the clearly labeled Fast travel action performs travel.
- Controls: M chooses/marks destinations in either story/free roam; hold F 1.2 s travels to the marked destination (otherwise the story objective). On foot, existing district fast travel returns to the car.
- Architecture/map contract: selection is separate from travel; remote places use explore.destination and no invented local road route; the objective/progress remains unchanged until normal play or explicit travel.
- `specs/19-map-explore.md` does not exist in this checkout; the relevant current map contract/history lives in specs/10-districts-chapters.md.

Validation command:

```sh
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node game/dev/harness/map-waypoints-check.cjs --out=/tmp/map-waypoints-final
```

The harness uses actual M/F Input/Game handlers and canvas/list UI interactions with fixed physics steps. It shortens travel films, leaves real travel checks/loading intact, and tests mapped Pipera fuel behavior. The final phone runs send actual touch events at 390×844 and 844×390. Final acceptance: **25/25 checks passed, zero browser exceptions** with `NO_SHOTS=1`, report `/tmp/map-waypoints-acceptance/report.json`. Separately inspected desktop/portrait/landscape/remote PNGs: `/tmp/map-waypoints-visual/`. Extra tourist spot UI/F probe passed all three checks, zero browser exceptions: `/tmp/map-waypoints-spots.log`, marked walking-route screenshot `/tmp/map-waypoints-spot.png`. Screenshot captures temporarily hide the fully covered WebGL canvas to avoid an expensive compositor readback; map pixels are unchanged.

Syntax checks: `node --input-type=module --check` on explore.js, worldmap.js, and main.js; `git diff --check`.

No README/spec shared-file edits are included; those are owned by the root integration agent. No push or master changes.
