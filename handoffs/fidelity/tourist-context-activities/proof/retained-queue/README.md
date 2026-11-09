# Retained queue, actual guide and physical follower

Immutable source `f0de4e4`, served from the archive recorded in `source.json`. This run selected only the physical Waterfront queue case and the final runtime-error assertion. The raw report is unmodified.

The initial static route crosses the retained queue; 71 nearby moving bodies participate in planning. The actual guide and production OnFootController follower reach the real Pier 57 plaque over 1,664 updates, with 156.07 m of guide travel (156.86 m planned). Maximum per-update guide movement is 0.130 m and player movement is 0.230 m. No source building changes, no removed visitors/colliders, no positional snaps: population stays 76 and colliders stay 259. Both selected assertions pass, with zero map/tour/runtime errors. The full GAME screenshot was inspected and shows the guide, follower viewpoint and plaque at arrival.

This accepts `a046623`'s crowd-aware short-route planning and bounded guide movement. It does not infer full scene architecture parity or a completed tour/postcard award from the arrival. The older tour-state fixtures use explicit synthetic destination poses and are labelled accordingly in the runner.
