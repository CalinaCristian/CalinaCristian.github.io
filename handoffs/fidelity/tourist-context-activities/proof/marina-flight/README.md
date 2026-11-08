# Source-scoped marina flight and real water altitude

The accepted `marina-flight-physical-f2e1824` run uses the actual host Drone and the sixteen finite source approach/landing/course strips from `493a661`, with estimated 3 m half-widths. They remain inside the prepared DEM; no whole-park/lake bounding box is introduced.

From an explicitly labelled initial dry-bank pose, starting the real drone cancels unfinished rowing, restores the shore before recording home, and grants no boating award. The exact north extreme allows 150 m and rejects 151 m. Real mouse look and W flight reach the constrained 149.999 m edge at 36.002 m above stable physical support; querying that support 10,000 m higher returns the same real water height. Return restores the original bank. All 411 source buildings, 3,182 colliders and 75 people remain. Zero page errors; captured high-quality frame 650,647 triangles / 153 calls.

The GAME outward view was inspected. It shows water and sparse bare banks beyond the prepared activity focus. That context is an explicit fidelity gap; this is flight/boundary acceptance, not a whole-park appearance acceptance or a full walking arrival from the distant park entrance.

The older `marina-flight-f0de4e4-desktop` report is retained unmodified. Its earlier assertions passed horizontal limits but omitted altitude. Inspection rejects that flight: it reached 48,608 m because the walker's `y + 50` water barrier was fed back as drone ground every frame, producing a blank outward image. The corrected physical run and runner add actual altitude assertions; the old `passed` console line does not turn the rejected flight into a pass.

Production `f2e1824` adds `Ground.flightHeightAt` for real terrain, reachable deck surfaces and declared water level. Walker deep-water and steep-cell barriers remain in `groundAt`; district drone queries are unchanged. The pure regression also checks stable water support through 50 km query heights, real deck support, overhead-deck exclusion, steep sculpture support and unchanged ordinary terrain. Native imagery and the pure checks establish the correction without weakening the walking barrier.
