'use strict';

function summarizeDraws(draws) {
    const measured = { calls: 0, triangles: 0 }, passes = {};
    for (const draw of draws) {
        measured.calls += draw.calls; measured.triangles += draw.triangles;
        const pass = passes[draw.pass] ||= { calls: 0, triangles: 0 };
        pass.calls += draw.calls; pass.triangles += draw.triangles;
    }
    return { measured, passes };
}

function accountFrame(preDrawCounters, postDrawCounters, nativeRawStats, draws) {
    const { measured, passes } = summarizeDraws(draws);
    const expectedNativeRawStats = { calls: preDrawCounters.calls + measured.calls, triangles: preDrawCounters.triangles + measured.triangles };
    return {
        measuredCompleteFrame: measured, passes, observedPriorCounterCarry: { calls: preDrawCounters.calls, triangles: preDrawCounters.triangles },
        nativeRawStats, expectedNativeRawStats,
        rawStatsAgreement: nativeRawStats.calls === expectedNativeRawStats.calls && nativeRawStats.triangles === expectedNativeRawStats.triangles,
        productionEndResetObserved: postDrawCounters.calls === 0 && postDrawCounters.triangles === 0,
        measuredFrameOverBudget: measured.calls > 400 || measured.triangles > 1500000,
        rawStatsOverBudget: nativeRawStats.calls > 400 || nativeRawStats.triangles > 1500000,
        method: 'Complete-frame work is the sum of individually observed draw deltas, including warm/reflection work. Raw stats and observed prior carry remain separate; no historical or inferred setup count is subtracted.',
    };
}

module.exports = { summarizeDraws, accountFrame };
