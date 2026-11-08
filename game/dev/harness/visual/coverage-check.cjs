#!/usr/bin/env node
'use strict';
// Regression for a real failure: capture timeouts previously exited 0 with 0 high/medium findings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-coverage-'));
const rawIssue = { id: 1, type: 'pad-overlap', severity: 'low', city: 'bucharest', msg: 'Raw fixture geometry finding', count: 1, data: {} };
function report(name, shots, errors, expectedExit, expectedMissing, sweepPlanning = []) {
    const out = path.join(scratch, name); fs.mkdirSync(out);
    const input = { args: { city: 'bucharest', district: 'otopeni', quality: 'high' }, results: [{ city: 'bucharest', mode: 'chapters', groups: [], routes: [{ group: 'bucharest-otopeni', id: 'otopeni', base: 0, n: 3, shots, label: 'Fixture', total: 80 }], sheets: [], cockpit: [], offices: [], issues: [rawIssue], errors, log: [], timing: {}, sweepPlanning }] };
    fs.writeFileSync(path.join(out, 'visual.json'), JSON.stringify(input));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'run.js'), '--report-only', `--out=${out}`], { encoding: 'utf8' });
    assert.equal(result.status, expectedExit, result.stderr || result.stdout);
    const output = JSON.parse(fs.readFileSync(path.join(out, 'visual.json')));
    assert.equal(output.coverage.missingSamples, expectedMissing);
    assert.equal(output.coverage.complete, expectedExit === 0);
    assert.deepEqual(output.issues, [rawIssue], 'Capture status must not rewrite raw detector findings');
    const markdown = fs.readFileSync(path.join(out, 'visual.md'), 'utf8');
    assert.match(markdown, expectedExit ? /INCOMPLETE/ : /COMPLETE/);
    return output;
}
try {
    const timeout = report('timeout', [{ idx: 0 }], ['capture otopeni#1 timed out after 120 s'], 2, 2);
    assert.equal(timeout.coverage.errors.length, 1);
    report('silent-missing-frame', [{ idx: 0 }, { idx: 0 }, { idx: 2 }], [], 2, 1);
    report('complete-control', [{ idx: 0 }, { idx: 1 }, { idx: 2 }], [], 0, 0);
    const incompleteSweep = { group: 'bucharest-grozavesti', name: 'Source Street', requested: true, status: 'incomplete', uncovered: [{ sourceRoadId: 'w-control', direction: 1 }], components: [{}], requiredDirectedEdges: 2, coveredDirectedEdges: 1 };
    const missingRoute = report('unreachable-requested-source-edge', [{ idx: 0 }, { idx: 1 }, { idx: 2 }], [], 2, 0, [incompleteSweep]);
    assert.match(missingRoute.coverage.errors[0].message, /1 required directed source edges/);
    report('unrequested-sweep-control', [{ idx: 0 }, { idx: 1 }, { idx: 2 }], [], 0, 0, [{ ...incompleteSweep, requested: false }]);
    console.log('Visual coverage regression: timeouts, missing/duplicate samples and uncovered requested source edges fail; complete and unrequested-sweep controls pass; raw findings unchanged.');
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
