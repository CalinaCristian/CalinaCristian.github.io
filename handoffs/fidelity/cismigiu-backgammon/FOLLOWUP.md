# Native511 findings and bounded follow-up

The original source is `511b448b0cc5c6961b3e560238574077f95e7047`.
Its browser closed at 2026-11-09 13:28:45.013 UTC. All234 copied Git/SHA blobs
were verified before/after, with no console or HTTP errors. The raw run's
`complete` field remains false: the preserved initial fact-export tool used
`game.scene`, which is absent when a spot opens directly from the menu.
That instrumentation error was not relabeled as a source pass.

Native public input covered208.72m from the actual Cismigiu spawn to the real
table. The first driver chunk stopped12m short because a fixed iteration
bound did not cover a long returned source-path leg; it did not hit a physical
obstruction. The second chunk continued from exactly that pose using keyboard
input and the native controller. No pose, auto-controller, dice, actor or
source overrides were used. Original failed/partial evidence is retained.

The first fair native match completed in42.54s of observer wall time, with50
human click-driven moves and40turns, including doubles and a hit. White bore
off all15checkers. `lm-cismigiu-backgammon` was false before confirmation and
true afterward; the modal closed and walking controls restored. Actual Undo,
Leave and Escape later preserved the rolled position and awarded nothing.
Full-size approach, opening, pre-confirm and post-confirm views were inspected.
This uses native `SpotSession.update(1/30)` and actual UI input with sampled
whole-scene draws, not a hardware FPS result or a whole game acceptance.

Two real negatives remain explicitly historical:

- The regular faces away: actual uploaded crowd matrix transforms local−Z
  to a direction with `faceDotTable=-0.9999999999948403`. Crowd meshes face
  local−Z, so the helper's +π/2 yaw was wrong. The follow-up uses−π/2 and
  focuses on the elder's position so his face clears the desktop panel.
- After actual `leaveSpot` to the menu and one standard GC, board/checkers/elder
  WeakRefs were all live although detached. Renderer.player still held the
  inactive OnFootController, whose obstacle callback retains the session.
  Root owns the common lifecycle fix in `13722bed`; no reference was cleared
  by the observer to manufacture collection. Mute and active-tour checks were
  not completed by this historical observer.

Measured native input/callback CPU, in milliseconds:

| Work | p95 | Maximum |
|---|---:|---:|
| Actual click handler path |4.8|78.9|
| Activity flow/opponent callback |0.1|3.1|
| Checker animation plus DOM refresh |1.0|28.9|
| Same callback during doubles |1.9|7.8|
| legalTurns on134 actual positions |1.0|5.2|
| legalMoves on the same positions |0.5|3.5|
| chooseTurn on the same positions |1.1|11.3|

The follow-up therefore caches legal moves only for the current frozen
position, invalidating by identity on every move, roll, undo and turn change.
Read-only diagnostics return copies. It also keeps the existing DOM controls
while only checker/die matrices animate, refreshing when controls re-enable.
No rule, dice distribution, turn timing, movement duration, AI score or result
is changed. The cache retains one position and no scene history.

The follow-up is based on root `13722bedb3969a785062c6c3f9f29e8f47708317`,
which includes the0efc activity/tour layout and renderer release fixes.
Twenty-two engine controls plus11 DOM/controller controls pass, including
three complete click-driven fixture matches, a cache-output mutation check
and preservation of live DOM controls through a checker-only animation.
These are CPU fixtures, not fresh native visual or resource acceptance.
Fresh native face/table, phone full-match/44px controls, cancel/mute/tour,
post-release WeakRefs and affected overview captures remain pending root GO.
