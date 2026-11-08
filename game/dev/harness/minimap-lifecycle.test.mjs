import test from 'node:test';
import assert from 'node:assert/strict';
import { MiniMap } from '../../src/minimap.js';

test('one permanent legend listener routes to the current map with the existing coordinates and event behavior', () => {
    const listeners = [], canvas = {
        width: 200, height: 100,
        getContext: () => ({}),
        getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 50 }),
        addEventListener: (type, handler, options) => listeners.push({ type, handler, options }),
    };
    const first = new MiniMap(canvas, { graph: { edges: [] } }, {});
    let staleCalls = 0; first._legendL = true; first.legendHit = () => { staleCalls++; return true; };
    const current = new MiniMap(canvas, { graph: { edges: [] } }, {});
    let redraws = 0, point = null, stopped = 0, prevented = 0;
    current._legendL = true;
    current.legendHit = (x, y) => { point = { x, y }; return true; };
    current.onChange = () => redraws++;
    const event = { currentTarget: canvas, clientX: 35, clientY: 45,
        stopImmediatePropagation: () => stopped++, preventDefault: () => prevented++ };
    assert.equal(listeners.length, 1); assert.equal(listeners[0].type, 'click'); assert.equal(listeners[0].options.capture, true);
    listeners[0].handler(event);
    assert.deepEqual(point, { x: 50, y: 50 });
    assert.equal(staleCalls, 0); assert.equal(redraws, 1); assert.equal(stopped, 1); assert.equal(prevented, 1);
    current.legendHit = () => false; listeners[0].handler(event);
    assert.equal(redraws, 1); assert.equal(stopped, 1); assert.equal(prevented, 1);
    canvas.__mm = null; assert.doesNotThrow(() => listeners[0].handler(event));
});
