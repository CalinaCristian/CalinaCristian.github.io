# CEC and MNIR native collision bands

The Old Town callers now preserve `placeLandmark`'s translated native solids and courtyard openings. No caller supplies the obsolete common 50 m collider cap, and no extra filled parent polygon closes a real courtyard. Exact prepared wrappers `r13104229_0` / `r13104229_1` remain associated with the canonical CEC replacement.

Validation on the worker's retained canonical-source snapshot: module syntax; `tourist-source-buildings-check.mjs`; `landmark-cec-source.test.mjs` (162 native colliders, no duplicate roof triangles). The integration branch has a subsequent 161-volume canonical correction and must run its own current source test. This small caller correction does not establish scene visual acceptance.
