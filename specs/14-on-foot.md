# 14 — On foot (GTA-style)

Owner role: **gameplay** (`onfoot.js` new, hooks in main.js/input.js/hud.js).

The player can leave the car and walk, run and jump, GTA-style.

## Requirements
R14.1 `Enter` (+ touch button) near/at the car: exit on the driver's side (short animation: door opens, camera steps out); get back in within 3 m of the driver's door.
R14.2 First person on foot: mouse look (pointer lock / hold-right / touch drag), WASD, Shift run (2×), Space jump, crouch optional; head bob; footstep sounds by surface.
R14.3 Collisions: buildings, props, walls, vehicles (cars can bump/push you; cars yield at crossings and honk); can't walk through the parked player car.
R14.4 The car stays where parked (hazard lights), is an obstacle for traffic; traffic routes around it.
R14.5 Walk into CV offices through the door; walking nav route on the dash map/minimap (sidewalk preferred); speed-limit HUD hidden on foot.
R14.6 Reusable `OnFootController` (contract in 01) used by the office interiors and tourist spots (spec 15).
R14.7 Photo mode works on foot (spec 16).

## Acceptance
- [ ] Exit/enter works in every district; can't fall through the world; can't get stuck (R reset on foot → nearest sidewalk).
- [ ] Harness scenario `foot`: exit, walk 200 m along sidewalks, cross at a zebra, enter an office, return, drive away — no issues.

## Requests
## Progress log

- 2026-11-07 02:40 UTC (gameplay) — R14 first version. `game/src/onfoot.js`: `OnFootController({scene, camera, input, colliders, world?, traffic?, audio?, obstacles?, groundAt?})` with `enter(x, z, heading, y)`, `exit()`, `update(dt)`, `position`, `teleport()`; mouse look (pointer lock / hold / touch drag via Input.takeLook), WASD (A/D strafe with mouse look, turn without), Shift run 4.6 m/s (walk 1.7), Space jump, head bob, footstep blips, kerbs ≤ 0.55 m, collisions with world.buildings (buildings, props, walls with height bands — the district-edge closure walls are fences on foot), vehicles (OBB push-out, a moving car shoves you: "Watch out" toast) and host boxes (the parked car). main.js: `Enter` (touch 🚶) at ≤ 1.5 m/s → out on the driver's side; the car stays as an exterior model with blinking hazards and keeps being the traffic's player obstacle (NPCs queue / bypass it); traffic.js stops for the walker like a pedestrian (Bucharest drivers occasionally honk); E within 7 m of a CV door walks into the office and you walk out of the door afterwards (chapter completion works on foot); nav route / objective / minimap follow the walker, speed limit hidden; R → nearest sidewalk; Enter / E within 3 m of the driver's door gets back in. Harness scenario `foot` (bucharest): exit 1.5 m from the car, walk 119 m along the route's sidewalk in 27.6 s, walk into rosetti, read, walk out on foot, walk back, get in, drive 86 m — 0 issues; screenshot report shots `*-foot-out.jpg`.

- 2026-11-07 04:10 UTC (gameplay) — spec 15 request: obstacles (people, cars, the parked car) block relative to their base height (`o.y`, vehicles pass theirs), so on-foot collisions work on spot terrain at −6 / −20 m. Harness `foot` (bucharest) re-run: exit 1.5 m from the car, walk 119 m in 27.6 s, into rosetti, out on foot, back in, drive away — passes (report `/tmp/claude-0/-home-user-CalinaCristian-github-io/c23e7db4-0398-5255-9d52-f406a6fe27a7/scratchpad/gameplay/h_fin/latest.md`).
