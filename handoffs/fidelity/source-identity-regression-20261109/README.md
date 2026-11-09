# Regression checks retain actual source identities

The current59-file game Node suite on027b ran147 tests:144passed,3failed. All400hashed runtime/data/test inputs stayed unchanged. The three failures used old prepared-array row positions as if they were permanent source IDs. Source expansion had moved the MOL canopy road/roof and CEC source outers; the old cache rows now referred to unrelated buildings.

The repaired checks use the original OSM identities. CEC additionally requires exactly one complete unchanged source outer for each of162 compiled volumes, then checks every height, roof and courtyard as before. Multipolygon IDs alone are insufficient. Cache witnesses retain their exact relation/member neighbour identities, including the source relation's newly complete set of eight outers. The canopy check resolves its literal source road, joins, true-tunnel negatives and roof before applying the same19 mutation/profile controls. No numerical tolerance or physical expectation changed.

All three targeted files pass after this test-only repair. The original failed full-suite log and exact unchanged-input report remain retained; a new combined suite is still required after the parking candidate. No game geometry/data or compiled model is rewritten here.
