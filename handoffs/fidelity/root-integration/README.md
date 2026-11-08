# Combined integration checkpoints

These are integration snapshots, not final all-district acceptance.

- `4fdacd3`: 128 source/tool module syntax checks passed. Focused pure tests passed except the legacy vehicle-lane fixture, which omitted the newly required reservation gate. The original failure remains in the initial summary.
- `4e3918d`: the fixture constructs the production gate; stopped/moving car and long-body steering, recovery and pedestrian controls pass. Immutable required Bucharest `foot,a` completed both scenarios with 0 high / 0 medium / 1 software-GL performance warning; both drives arrived with zero resets, and the walker completed119.2m, entered/left the office and returned to the car.
- These scenarios load the legacy chapter world. They do not replace native all-eight rebuilt-district geometry/performance tests. Asymmetric source widths, final measured datasets, passage-mouth changes and later code require their own frozen acceptance.
