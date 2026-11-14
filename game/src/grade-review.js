// ============================================================================
//  GRADE REVIEW — approach ramps whose real length differs from the model grade (fidelity pass round 2, 2026-11-12).
//
//  The level solver lets an open approach climb / dive at one model grade (9 %), so every underpass ramp is about
//  67 m long. Where the street-level review found the road already between retaining walls further out, a row gives
//  the way a gentler grade (a factor on the model grade): the ramp starts earlier along the same mapped way. Nothing
//  is moved; the portal, the tunnel level and the mapped geometry stay the district data's. The factor is an estimate
//  from where the walls were seen to begin, not a surveyed profile.
// ============================================================================

const GRADE_REVIEW = {
    'bucharest-romana': {
        w27008418: { gradeK: .5, note: 'Pasajul Victoria west ramp, eastbound: the panorama at 44.452076, 26.082576 (about 115 m before the portal) is already between balustraded retaining walls' },
        // (w241374320, the westbound exit ramp, keeps the model grade: it was not seen from its own carriageway, and with a
        //  longer ramp the level solver holds it at full depth under an at-grade crossing of the same way)
    },
};

export const reviewedGradeK = (key, sourceId) => GRADE_REVIEW[key]?.[sourceId]?.gradeK || 0;
