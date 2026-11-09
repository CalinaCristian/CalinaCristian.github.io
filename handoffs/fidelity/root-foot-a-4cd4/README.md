# Mandatory Bucharest foot/a regression

Frozen4cd4f08bc6ec0ce210e906f0fb6548558022dabd,382 source files verified unchanged after both runs. Command: `npm run harness -- --scenario=foot,a --city=bucharest` (same frozen runner invoked directly with separate port/output).

The complete run has0HIGH/0MEDIUM and one retained software-FPS LOW. Foot runs64.7simseconds; spawn/drive runs15.8simseconds. Actual legacy world has19,939edges/70,629colliders/0vehicles/250pedestrians; this is the required legacy scenario scope, not full-traffic district/body/lane or hardware Ultra acceptance. Cold build76,844ms and software0.6fps remain explicit observations.

First run's source archive omitted local public/telemetry.js, causing one actual404/HIGH. Its untouched report/pictures are in r1-missing-public-script. Restoring the15original public files from the same frozen Git source fixes that fixture closure; r2-complete is the passing retake. No product behavior, actors, tolerance or harness checks were changed to obtain it.

Current bridge/underpass work and later Carusel/source-clearance changes retain their separate native gates.
