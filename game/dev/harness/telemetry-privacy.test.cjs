const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const script = readFileSync(resolve(__dirname, '../../../public/telemetry.js'), 'utf8');
for (const [name, navigator, search] of [
    ['DNT', { doNotTrack: '1' }, ''],
    ['GPC', { globalPrivacyControl: true }, ''],
    ['DNT with forced diagnostics', { doNotTrack: '1' }, '?track=1'],
    ['GPC with forced diagnostics', { globalPrivacyControl: true }, '?track=1'],
    ['explicit disabled tracking', {}, '?notrack&track=1']
]) test(name + ' prevents initialization and capture', () => {
    const context = { window: {}, navigator, URLSearchParams, location: { hostname: 'cristiancalina.com', search }, document: { currentScript: null } };
    runInNewContext(script, context);
    assert.equal(context.window.cvTelemetry.enabled, false);
    assert.doesNotThrow(() => context.window.cvTelemetry.track('fixture'));
    assert.equal(context.window.posthog, undefined);
});
