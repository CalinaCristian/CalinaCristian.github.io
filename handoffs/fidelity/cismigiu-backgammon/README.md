# Cișmigiu full backgammon match

Base: `7423ec24553528f29a5042472939dc498ebce46e`, including the captured-tour
semantics in `activityFlow`. Root owns menu/catalog, achievement data, global
documentation and overview integration. This lane owns the pure engine,
scene activity helper and the existing La Șahiști table2 replacement.

`game/src/spots/backgammon-engine.js` is independent of Three, DOM, clocks and
randomness. Its frozen positions conserve fifteen checkers per player.
It implements opening one-die rolls/ties, closed points, hits, bar priority,
both movement directions, four moves for doubles, compulsory maximum dice
use, the higher playable die rule, exact/oversized bearing off, terminal
winners and single/gammon/backgammon results. Legal prefixes come from full
legal turns. The deterministic opponent scores entire legal turns rather
than moving a scripted opening. Activity dice are sampled independently of
world generation; undo cannot reroll them.

`backgammonGame(ctx,{x,y,z,source,onDone})` in
`game/src/spots/backgammon-game.js` uses `activityFlow`. `y` is the existing
concrete tabletop. Table2 remains at the same source La Șahiști POI
(`n473428599` when present), with the original six concrete bases and seats.
The board faces the existing east seat; Doru, a fictional grey-haired park
regular, occupies the west seat. That table's two generic background sitters
are excluded to prevent an overlap and reserve the player seat. Other crowd
groups and all park/shore source geometry are unchanged by this lane.

There are thirty actual instanced 3D checkers and two six-faced dice. Click
or touch selects a legal die, checker and highlighted destination. Captured
checkers must enter from the bar; bearing off is enabled only when legal.
The regular rolls and moves his actual checkers on his turn. Undo works only
within the unconfirmed human turn. Confirm cannot skip a compulsory move.
Leave, Escape and host takeovers restore control, undo the unconfirmed human
turn while retaining the dice, and award nothing. A loss permits a complete
new match. A legal human victory still requires `Confirm match win` before
`onDone` and the captured tour completion fire exactly once. The next visit
to an already-confirmed winning board starts a fresh game.

The source scene emits only `cismigiu:backgammon` on a confirmed win. Root's
intended achievement is `lm-cismigiu-backgammon`; this branch deliberately
does not edit the root-owned registry/data files.

CPU evidence in `validation/`:

- 22 engine controls and20 complete seeded engine matches:2,446 legal moves,
  205 hits, maximum104 turns. Original positions, dice and RNG remain intact.
- 9 real DOM/Three/controller controls use the actual production click
  handlers. Three complete matches lose twice before a legal human win:
  486 actions/788 events, no loss/cancel awards, all15 final white 3D checkers
  in the off tray, exact captured-tour completion once. Undo, pause takeover,
  stale removed controls and leaving restore the correct state.
- Edited source passes module syntax and whitespace checks.

The DOM fixture uses LinkeDOM in `/tmp`, not a product dependency. Reproduce
with `npm install --cache /tmp/bg-npm-cache --prefix /tmp/bg-dom --no-save
--ignore-scripts linkedom`, then set `BACKGAMMON_DOM_PACKAGE` to the installed
`/tmp/bg-dom/node_modules/linkedom` directory when running
`controller-controls.mjs`. Both test runners accept an output directory.
The initial invalid engine fixture was rejected by winner validation; its
original error log is retained and the fixture was corrected.

These are CPU/controller checks, not a native public-scene or visual pass.
Native desktop/phone actual play, a genuine win and actual achievement,
visible opponent/table screenshots, normal input/cancel/mute controls,
source/geometry provenance, resource disposal and the affected overview
recaptures remain pending root integration and a coordinated browser slot.
No browser has been launched for this activity by this lane yet.
