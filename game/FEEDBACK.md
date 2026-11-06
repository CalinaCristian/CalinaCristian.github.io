# Play-test feedback (2026-11-06, interim OSM build) and plan

Owner's feedback after driving the private preview:

1. **Traffic blocks the street / getting stuck.** Cars drive randomly or block the road; after a collision it is hard to get moving again.
   - Plan: NPC avoidance of the player (yield/steer around a stopped player), stronger push-apart on collision, an "unstick / reset to road" key (R) that places the car in the nearest lane facing the right way, no double-parked cars on narrow or one-way streets, deadlock resolver tuned, fewer random lane changes.
2. **Map is too long between destinations** (keep it close to reality, but trips take too long).
   - Plan: uniform world scale ≈0.6–0.7 (shape and street layout stay identical, distances shrink), slightly higher speed limits/NPC speeds, and **fast travel** from the map to any discovered stop/POI (short "driving montage" cutscene), plus "skip to next chapter" after each office.
3. **Map still not accurate enough, buildings lack detail.**
   - Plan: finish the rendering/world workstreams (stopped at the owner's request): facade detail per style, real roof shapes, signage, textures, lamps; verify landmark placement; compare key streets (Magheru, Calea Victoriei, Unirii, Kiseleff, Pipera) against reality.
4. **No collision with trees and other props.** Add trees, lamp posts, poles, bus shelters, signs to the collision set.
5. **Some roads are broken: they run into a road block.** Investigate tile-border clipping, tunnel/bridge layers, construction roads, buildings extruded over one-way roads (centreline offset), and dead-end stubs; make the router avoid non-drivable segments.
6. **Keep: chat bubbles and the traffic facts.** Loved.

## Status (same day, second build)

Done: NPCs yield to / steer around the player and never push into it; no spawns in front of the player; double-parkers only on wide streets away from junctions; non-sticky collisions; `R` reset-to-road; deadlock resolver; Bucharest scaled 0.7; fast travel (`F` / map buttons) with montage; tree/lamp/pole/shelter collisions; broken roads fixed (0 ribbons into buildings, one-way traps removed, service roads kept as connectors, only the main strongly-connected network is routable); facade detail (bands, cornices, balconies, colonnades, shop fronts, roofs); rendering integrated (real-time sun from local time, dawn/day/sunset/night, stars/moon, bloom/AA/vignette, adaptive quality, street-lamp lighting, headlights `L`, wipers/rain, better car models, cockpit gauges + nav screen).

Known gaps: UiPath HQ door is on Strada Povernei (72 m); OTP terminal sits in the compressed DN1 strip; bridges have no ramps; Seattle downtown is dark under overcast lighting.
