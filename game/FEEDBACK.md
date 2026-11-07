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

Known gaps: Politehnica's door is at the Bd. Doina Cornea gate (~230 m from the Rectorat tower; campus roads are private); Bridges, overpasses and tunnels now have a vertical profile with ramps (car and traffic follow it); UiPath HQ door is on Str. Vasile Alecsandri; OTP terminal squashed to the compressed DN1 strip. I-90 floating bridges are tagged layer 1 in OSM so they sit on piers 6 m above the lake. Seattle overcast lighting was brightened (exposure 1.12).

# Play-test round 2 (2026-11-06 evening, build 8b861ec) — 60 fps at auto(high) on the owner's machine

1. Lights flicker while driving at night (street-lamp light pool swapping).
2. Steering wheel turns the wrong way.
3. Look around left/right (mouse look; touch drag on mobile).
4. Walking in offices: mouse look + Shift to run + Space to jump.
5. Trees planted in the middle of the street.
6. Pedestrians walk through cars.
7. Traffic density should depend on the hour (rush hours), ideally from real data.
8. Objects generated in the middle of the street, even at the spawn (big slab across Splaiul at Grozăvești).
9. Car can jump up onto / drop off bridges; no collision with objects on the road.
10. Build an automated harness that plays the whole game and finds/fixes issues, with a fast iteration loop.
11. Reverse should steer like a real car (inverted with the wheel).
12./15. Map should be much smaller but more accurate (keep realism).
13. Seattle spawn: road looks broken, invisible collisions, lamp posts in the middle of the street.
14. Look-behind shows half a car (no rear interior).
16. Main buildings should be more realistic, based on real information.
17. Weather from real data (live), plus seasons from real data (foliage, snow, climate).

# Play-test round 3 (2026-11-06 night, preview v5) — ultra at 60 fps on the owner's machine
1. Got stuck at a concrete barrier across the lane on Șos. Orhideelor (Belvedere / Grozăvești).
2. Map still looks broken in many places on the way from the start point to C.A. Rosetti.
3. All roads and markings in the US (Seattle) look broken: black patches, broken markings, overlapping carriageways.
4. In-car map screen: parts of the car go into it; it's cut by the bottom of the view.
5. Office lobby sign subtitle cut off ("…aureate — Mathematics & Computer Science · 2009"). [quick fix done]
6. The harness misses visual breakage → needs visual QA (screenshots + detectors + review).

## Round 4 play-test (owner, 2026-11-07) — collecting, not actioned yet
1. Politehnica (upb) chapter spawn, Șos. Orhideelor under the Pasajul Basarab viaduct: a road is missing — the elevated decks overhead read as disconnected slabs on piers with gaps where the carriageway should continue (screenshot kept in the orchestrator scratchpad: fb4-01-upb-spawn-viaduct.webp).
2. Politehnica (upb) section: roads completely broken around Pasajul Basarab — elevated ramps end in mid-air and are cut off, vans drive on deck stubs floating in the air, a huge sloped slab blocks the view ahead, decks don't connect to the ground roads; the car sits on a "Service road" (30 km/h) at the chapter start instead of Șos. Orhideelor (screenshot: fb4-02-upb-roads-broken.webp). Likely a regression from the latest deck-lifting pass.
3. Grozăvești: the Lukoil station shows its sign in Cyrillic ("Лукойл"). In Romania the brand is written "Lukoil" in Latin letters. Cause: the OSM text for that one station is used verbatim; it is the only Cyrillic string in the Bucharest district data. Needs a brand-name normalisation table in the build plus a check that no non-local scripts reach signage (screenshot: fb4-03-lukoil-cyrillic.png). Also visible: the station reads as a generic shopfront block rather than a fuel station with canopy and pumps.
4. Buses appear at random spots placed sideways across the carriageway / junction mouth (an STB bus parked broadside blocking the road), not in a lane or at a stop (screenshot: fb4-04-bus-across-road.webp). Probably transit spawn/stop placement or long-vehicle orientation at junctions. Same frame: a blank grey round sign (sign face missing or seen from behind with no back plate), and a red bus-lane strip that starts mid-junction.
5. Every fuel station must look like a real fuel station (forecourt canopy with brand fascia and lights, pump islands, price pylon, small shop, entry/exit driveways from the road, correct brand colours), not a generic building with a sign. Some stations currently render as ordinary buildings.
6. District-edge closure ("DRUM ÎNCHIS"): the roadworks worker stands with his head hidden behind the sign plate (sign at head height, worker placed right behind it); the worker is still the old blocky figure, not the new instanced crowd with work outfit; blocky red shapes in the foreground (a second figure/prop at the camera); the barrier spans only part of the carriageway; beyond the closure the world is a flat empty grey plain with scattered boxes — the road should visibly continue past the barrier (roadworks strip, then the low-detail city) instead of ending in a void (screenshot: fb4-06-closure.webp).
7. On foot it must be easy to find the car again: a car marker on the minimap / big map and the nav screen, a distance + direction indicator on the HUD (and an on-screen marker over the car when in view), a "Walk to car" route option, a key-fob "beep + flash hazards" action (e.g. a key / button that makes the car honk and flash so you can spot it), and possibly "call the car" (teleport it to the nearest kerb) if far away.
