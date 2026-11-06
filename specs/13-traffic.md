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
## Progress log
