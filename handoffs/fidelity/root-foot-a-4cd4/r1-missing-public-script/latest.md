# Play-test harness report

Generated 2026-11-09T15:48:43.901Z · 141 s wall · viewport 640×360 · quality low (software GL) · traffic full · physics 30 Hz

**Driving scenarios:** 1 high · 0 medium · 1 low (distinct issues; "×n" = occurrences)

## Scenarios

| id | city | result | sim s | wall s | new issues | notes |
|---|---|---|---:|---:|---:|---|
| foot | bucharest | ran | 64.7 | 22.1 | 0 |  |
| a | bucharest | ran | 15.8 | 10.2 | 0 | spawn Splaiul Independenței ok; nav "⬅Turn left onto Podul Grozăvești in 60 m"; first 150 m ok |

## Issues found while driving (grouped by type)

| type | severity | distinct | occurrences |
|---|---|---:|---:|
| resource-failed | high | 1 | 1 |
| perf-fps | low | 1 | 1 |

### resource-failed (high, 1)

- **high** [boot · ] Failed to load resource: the server responded with a status of 404 (Not Found) http://127.0.0.1:33201/public/telemetry.js —  

### perf-fps (low, 1)

- **low** [end · bucharest] 0.8 fps (1218 ms/frame, 113 draw calls, 301133 tris) at quality low 640×360 in software GL — not representative of real GPUs —  

## Caveats

- Software GL (SwiftShader): the simulation is stepped at a fixed dt with rendering only for screenshots, so fps numbers are not meaningful; the fps issue is informational (low).
- Traffic, pedestrians and the spawn-overlap audit only cover the ~650 m simulation bubble around the player.
- Collider kinds (tree / lamp / post…) are inferred from radius; world.js does not tag them.
- "invisible-collision" fires when the car is pushed for 2 s at < 0.5 m/s with no vehicle, collider, pedestrian or map edge within ~4 m ahead.
