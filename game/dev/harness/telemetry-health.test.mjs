import test from 'node:test';
import assert from 'node:assert/strict';
import { GameHealth, frameSummary, readPending } from '../../src/telemetry-health.js';

test('reload breadcrumbs reject stale, malformed and future records without requiring working storage', () => {
    const at = 10000000, storage = value => ({ getItem: () => value });
    assert.equal(readPending(storage('{broken'), at), null);
    assert.equal(readPending(storage(JSON.stringify({ v: 1, updated: at })), at), null);
    assert.equal(readPending(storage(JSON.stringify({ v: 2, updated: at - 900001 })), at), null);
    assert.equal(readPending(storage(JSON.stringify({ v: 2, updated: at + 60001 })), at), null);
    assert.equal(readPending({ getItem() { throw new Error('Storage denied'); } }, at), null);
    const record = { v: 2, updated: at - 500, loading: true, attempt: 'bounded-attempt', destination: 'grozavesti' };
    assert.deepEqual(readPending(storage(JSON.stringify(record)), at), record);
});

test('frame percentiles expose real stalls rather than averaging smoothed FPS values', () => {
    assert.equal(frameSummary([]), null);
    const steady = frameSummary(Array(120).fill(1000 / 60));
    assert.equal(steady.avg_fps, 60); assert.equal(steady.p5_fps, 60);
    const stalled = frameSummary([...Array(95).fill(16), ...Array(5).fill(200)]);
    assert.equal(stalled.frame_p95_ms, 200); assert.equal(stalled.p5_fps, 5);
    assert.equal(stalled.avg_fps, 40); assert.equal(stalled.max_frame_ms, 200);
    assert.equal(frameSummary([20000]).max_frame_ms, 20000);
});

test('diagnostic wrappers preserve values and the original sync/async exception when observers fail', async () => {
    const health = Object.create(GameHealth.prototype), failure = new TypeError('original');
    const obj = { factor: 3, value(n) { return n * this.factor; }, fail() { throw failure; }, async valueAsync(n) { return n + this.factor; }, async failAsync() { throw failure; } };
    let failures = 0;
    const brokenObserver = () => { throw new Error('analytics offline'); };
    for (const name of Object.keys(obj).filter(k => typeof obj[k] === 'function')) health.observe(obj, name, brokenObserver, brokenObserver, () => { failures++; throw new Error('ignored'); });
    assert.equal(obj.value(4), 12); assert.equal(await obj.valueAsync(4), 7);
    assert.throws(() => obj.fail(), error => error === failure);
    await assert.rejects(obj.failAsync(), error => error === failure);
    assert.equal(failures, 2);
});
