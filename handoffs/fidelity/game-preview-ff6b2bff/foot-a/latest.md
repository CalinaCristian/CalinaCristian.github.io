# Play-test harness report

Generated 2026-11-09T08:53:33.609Z · 98 s wall · viewport 640×360 · quality low (software GL) · traffic full · physics 30 Hz

**Driving scenarios:** 0 high · 0 medium · 1 low (distinct issues; "×n" = occurrences)

## Scenarios

| id | city | result | sim s | wall s | new issues | notes |
|---|---|---|---:|---:|---:|---|
| foot | bucharest | ran | 64.7 | 17.8 | 0 |  |
| a | bucharest | ran | 15.8 | 8.6 | 0 | spawn Splaiul Independenței ok; nav "⬅Turn left onto Podul Grozăvești in 60 m"; first 150 m ok |

## Issues found while driving (grouped by type)

| type | severity | distinct | occurrences |
|---|---|---:|---:|
| perf-fps | low | 1 | 1 |

### perf-fps (low, 1)

- **low** [end · bucharest] 0.9 fps (1163 ms/frame, 112 draw calls, 294851 tris) at quality low 640×360 in software GL — not representative of real GPUs —  

## Caveats

- Software GL (SwiftShader): the simulation is stepped at a fixed dt with rendering only for screenshots, so fps numbers are not meaningful; the fps issue is informational (low).
- Traffic, pedestrians and the spawn-overlap audit only cover the ~650 m simulation bubble around the player.
- Collider kinds (tree / lamp / post…) are inferred from radius; world.js does not tag them.
- "invisible-collision" fires when the car is pushed for 2 s at < 0.5 m/s with no vehicle, collider, pedestrian or map edge within ~4 m ahead.
