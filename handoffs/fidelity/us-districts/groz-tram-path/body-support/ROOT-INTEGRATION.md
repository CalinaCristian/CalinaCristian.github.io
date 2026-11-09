# Root integration notes

Runtime dependency: integrate the shared rail grade/render support catalogue and piece IDs from rail-bridge-model f1681a2442ae1155f90ebb566fc98c22d31af145 or its later composition commit. No World edit is included here. Preserve sourceSignal/controller and motor turn-lane hunks when combining the additional Traffic import and final rail-only placeOnLane branch.

Root owns the current architecture contract, README and spec13 updates. Suggested current feature wording: "Trams follow mapped directed rail paths with shared modeled bridge/tunnel profiles. Their rigid emitted meshes use actual wheel support and exact own-slab geometry; source datums, slab estimates and rigid proxy limitations remain explicit. Unknown source spans and true slab, roof, post and other-model contacts block admission. Counts, source geometry and RNG are preserved. Fresh native validation remains required."

The body support handoff is candidate implementation/CPU proof, not final physical acceptance. Retain the old failed curved-slab evidence and historical source-choice/native captures. The material .928 m rigid lift requires the independent full emitted body/static/roof native checks; QA owns that sole fresh export after root GO. RO's independent auditor does not import this fitter or trust its certificate assertions.
