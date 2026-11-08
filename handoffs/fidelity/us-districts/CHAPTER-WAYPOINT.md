# Airport waypoint completion

A SeaTac manual 154 m navigation probe arrived at x=-1091.7484258047868,z=877.7621581784335 while the chapter waypoint remained x=-1149.644183850554,z=-444.5535381487944 (1.32 km straight-line away, approximately 1.8 km of the restored legal road route). The manual-arrival handler cleared `navManual`, but the chapter predicate reused that manual route's 14 m remaining distance and opened the completion card.

The predicate now uses the destination/manual flag captured before navigation updates. Completion needs actual waypoint proximity (<30 m), or <25 m remaining from that same automatic navigation result with a destination matching the actual chapter objective within 0.01 m. A newly restored route cannot lend its destination identity to an older manual result. Free roam, completed chapters and office chapters remain guarded. No source waypoint or road is moved.

`node game/dev/harness/chapter-waypoint.test.mjs`: actual captured SeaTac negative, restored long route, actual proximity, matching automatic route, free roam and other chapter guards.
