# Play-test harness report

Generated 2026-11-08T21:52:12.090Z · 594 s wall · viewport 640×360 · quality low (software GL) · traffic full · physics 30 Hz

**Driving scenarios:** 0 high · 0 medium · 2 low (distinct issues; "×n" = occurrences)

## Scenarios

| id | city | result | sim s | wall s | new issues | notes |
|---|---|---|---:|---:|---:|---|
| foot | bucharest | ran | 64.7 | 82.3 | 0 |  |
| a | bucharest | ran | 37.4 | 42.9 | 1 | spawn Splaiul Independenței ok; nav "⬅Turn left onto Podul Grozăvești in 60 m"; first 150 m ok |

## Issues found while driving (grouped by type)

| type | severity | distinct | occurrences |
|---|---|---:|---:|
| perf-traffic-update | low | 1 | 6 |
| perf-fps | low | 1 | 1 |

### perf-traffic-update (low, 1)

- **low** [a · bucharest] traffic.update averaging 9.7 ms (> 8 ms budget) on this machine — Splaiul Independenței (-2351.9, -1256.6) · 44.442954, 26.060237 ×6

### perf-fps (low, 1)

- **low** [end · bucharest] 0 fps (26469 ms/frame, 109 draw calls, 439953 tris) at quality low 640×360 in software GL — not representative of real GPUs —  

## Caveats

- Software GL (SwiftShader): the simulation is stepped at a fixed dt with rendering only for screenshots, so fps numbers are not meaningful; the fps issue is informational (low).
- Traffic, pedestrians and the spawn-overlap audit only cover the ~650 m simulation bubble around the player.
- Collider kinds (tree / lamp / post…) are inferred from radius; world.js does not tag them.
- "invisible-collision" fires when the car is pushed for 2 s at < 0.5 m/s with no vehicle, collider, pedestrian or map edge within ~4 m ahead.
