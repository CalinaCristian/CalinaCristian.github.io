# Native phone controls on c78

All 37 cases pass, with zero browser exceptions and console errors. Actual native touch covers portrait 390×844 and landscape 844×390 mini-map visibility/collapse, cockpit instrument clearance, pause/conditions/world-map modal isolation, recovery/explicit travel targets, marked-map actions, car/foot recovery, complete on-foot cockpit/mirror hiding, HUD panels, and actual short-tour Skip/End actions. The controlled moving-car guard also preserves fuel and progress.

All eight original PNGs were inspected: drive, conditions, marked map and tour at both viewports. Scrollable panels retain native reachable actions. The tour fixture intentionally suppresses renderer frames after entering the spot; its two black-canvas images prove visible UI/actions only, not tourist 3D rendering. The real spot controller and native input remain active. The raw report records the method and pre-scroll target positions rather than pretending every action begins in view.

Source is immutable c78a5f4. Root has scoped relevant DOM/input reuse while upcoming menu availability changes require their own current-source gate. Later tourist scene/runtime compatibility, repeated loads, headlights and final stamped telemetry remain separate. These are emulated phone controls, not a physical iPhone termination/FPS diagnosis.
