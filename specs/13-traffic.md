# 13 — Traffic, congestion, pedestrians, transit

Owner role: **gameplay** (traffic.js). Data: **world** (`congestion` in cities.js, `trafficProfile`).

## Requirements
R13.1 Keep: lanes/one-ways, lights, junction claims, overlap guard, honking, chat bubbles, facts ticker (owner favourites), traffic-by-hour, weather slow-down.
R13.2 **Standstill traffic in real hotspots**: per district `congestion [{lat,lon,radius,hours,level}]` → at those local hours dense spawning, queues spilling back from junctions, crawling/stopped cars, honk storms + bubbles; cleared smoothly off-peak; the player can still get through slowly (gaps, lane changes, side streets).
R13.3 Transit with real liveries/routes from research: STB trams (red/yellow, articulated), trolleybuses (with poles under wires), buses; King County Metro buses, Sound Transit Link (Bellevue) if visible.
R13.4 Pedestrians: never inside cars, never on the carriageway except crossings; density by area/hour; tourists with cameras at landmarks.
R13.5 Zero NPC–NPC and NPC–player overlaps visible (harness ≤ 5 minor).
R13.6 District boundaries: vehicles despawn/respawn out of view at the edges.

## Acceptance
- [ ] Harness: vehicle-overlap ≤ 5, ped-in-vehicle 0, vehicle-overlaps-player 0, scenario i passes.
- [ ] Rush-hour run in `romana` at 08:00: average speed in the Piața Victoriei hotspot < 2 m/s, outside > 6 m/s; player crosses it in < 4 min.
- [ ] Night run: light traffic.

## Requests
- (world, 2026-11-06) District maps: nodes with `node.mapEnd === true` (also `world.district.ends[{x,z,node,edge}]`) are roads cut at the district boundary, closed by a red/white barrier + wall 1.5 m inside the end. Despawn vehicles that reach one and spawn entering vehicles at one-way sources there; don't route NPCs through them otherwise. Congestion hotspots: `CITIES[city].districts[id].congestion[{lat, lon, radius, hours:[[h0,h1]], level 0..1, note}]` (convert with `world.city.proj` / `city.proj`).
## Progress log
- 2026-11-06 22:05 UTC (gameplay) — fix pass. traffic.js: deadlock resolver never fired in view when the queue head had no leader (`still` capped at 12 forever) → head ghosted, 3 tries then recycled; overlap guard lets an already-overlapping car move apart, and a car reverted every frame for 1.5 s gets a 1.5 s ghost (merge freezes); lane-drop no longer stops a car already at/inside the junction; waiting pedestrians are kerb-clamped (they skipped the clamp) and crossing/corner plan points are moved out of other carriageways; `v.stopWhy` debug field. player.js: wedged against walls → speed = real displacement. main.js: R reset clamps to the carriageway (service roads centred), fast travel lands 22–60 m before the door on a clear spot and clears the queue to the door. nav.js: service roads cost ×4 + 25 s entry, start/goal snap prefers a street within 3 m, arrival radius 14 m. Harness: checkPose/via use the carriageway that holds the car (not the nearest centreline), pinned-car stall detection, scenario a resets this city's visited stops. Full harness on the HEAD world (live world.js was mid-edit): autopilot-no-progress 7→1 (Lukoil, world), drive-failed 2→0, bad-placement 2→0, fast-travel-last-mile 1→0, ped-on-carriageway 4→2, vehicle-overlap 8→7, seattle a/h ok. Report: scratchpad fixpass_traffic/full1/latest.md.

- 2026-11-07 01:30 UTC (gameplay) — R13.2 standstill hotspots: `traffic.setCongestion(list, proj)` from `world.district.congestion` (fallback `CITIES[city].districts[id].congestion`); per hotspot level × hour activity (40-min ramps), extra cars (≈ lane-length/9 m × 0.55 × level, built once and pooled off-peak) placed inside the hotspot, NPC desired speed ×(1−0.9·jam), stop-and-go holds, honk storms (audio capped at ~6 horns/s), jams count as 35 % "still" for the deadlock resolver; NPCs never route into / spawn on district-edge closure edges. Test hooks `?hour=8.5`, `?jam=1`, `clock.trafficHour`. Probe romana 08:30: Piața Victoriei avg 1.08 m/s (spec < 2), outside hotspots 9.13 m/s (> 6), off-peak 13:00 → 6.9 m/s in the same area; traffic.update 5.6–10 ms with 618 cars (software GL machine). Harness scenario `jam` added (crawl/flow speeds + the player crossing in < 4 min).
