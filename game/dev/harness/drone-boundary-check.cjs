#!/usr/bin/env node
// Pure geofence and routing fixtures; no renderer or dependencies needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
    const source = fs.readFileSync(path.join(__dirname, '../../src/drone-boundary.js'), 'utf8');
    const { createFlightBoundary, polygonFlightSource, FLIGHT_GRACE } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    let checks = 0;
    const test = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
    const rect = createFlightBoundary(polygonFlightSource([[[0, 0], [100, 0], [100, 100], [0, 100]]]));
    test('Euclidean150m buffer on edges and rounded corners', () => {
        assert.equal(FLIGHT_GRACE, 150); assert.equal(rect.sample(110, 110).distance, Math.sqrt(200)); assert(rect.allowed({ x: 206, z: 206 })); assert(!rect.allowed({ x: 207, z: 207 }));
        for (let i = 0; i < 360; i++) { const a = i * Math.PI / 180, p = { x: 100 + Math.cos(a) * 300, z: 100 + Math.sin(a) * 300 }; rect.project(p); assert(rect.sample(p.x, p.z).distance <= 150); }
    });
    test('outward speed stops; tangential and inward speed remain', () => {
        const p = { x: 270, z: 50 }, v = { x: 47, z: 12 }; rect.constrain(p, v, { x: 249, z: 50 }); assert(p.x < 250); assert.equal(v.x, 0); assert.equal(v.z, 12);
        const inward = { x: -12, z: 7 }; rect.constrain({ x: 249.999, z: 50 }, inward); assert.deepEqual(inward, { x: -12, z: 7 });
    });
    test('approach braking is gradual and preserves tangent velocity', () => {
        const p = { x: 242, z: 50 }, v = { x: 46.8, z: 12 }; rect.constrain(p, v);
        assert(v.x > 20 && v.x < 46.8); assert.equal(v.z, 12);
        const near = { x: 46.8, z: 12 }; rect.constrain({ x: 248, z: 50 }, near); assert(near.x < v.x); assert(near.x > 0);
    });
    const l = createFlightBoundary(polygonFlightSource([[[0, 0], [1000, 0], [1000, 200], [200, 200], [200, 1000], [0, 1000]]]));
    test('concavity blocks a shortcut and A* routes around it', () => {
        const a = { x: 100, z: 900 }, b = { x: 900, z: 100 }; assert(!l.segmentAllowed(a, b));
        const route = l.route(a, b, { home: b, range: 1600 }); assert(route?.length > 1);
        let p = a; for (const q of route) { assert(l.segmentAllowed(p, q)); p = q; } assert.deepEqual(p, b);
    });
    const outer = [[0, 0], [900, 0], [900, 900], [0, 900]], hole = [[200, 200], [700, 200], [700, 700], [200, 700]], polygon = polygonFlightSource([outer]), inner = polygonFlightSource([hole]);
    const donut = createFlightBoundary({ inside: (x, z) => polygon.inside(x, z) && !inner.inside(x, z), segments: [...polygon.segments, ...inner.segments] });
    test('holes remain excluded and return routes go around them', () => {
        const a = { x: 100, z: 450 }, b = { x: 800, z: 450 }; assert(!donut.allowed({ x: 450, z: 450 })); assert(!donut.segmentAllowed(a, b));
        let p = a; const route = donut.route(a, b, { home: b, range: 1600 }); assert(route?.length > 1); for (const q of route) { assert(donut.segmentAllowed(p, q)); p = q; }
    });
    test('rotated diagonal boundaries project to nearest edge', () => {
        const diamond = createFlightBoundary(polygonFlightSource([[[0, 100], [100, 0], [200, 100], [100, 200]]]));
        const p = { x: 270, z: 270 }, v = { x: 26, z: 26 }; diamond.constrain(p, v); assert(Math.abs(diamond.sample(p.x, p.z).distance - 149.999) < 1e-7); assert(Math.hypot(v.x, v.z) < 1e-8);
    });
    test('separate islands cannot be crossed by a fast step', () => {
        const islands = createFlightBoundary(polygonFlightSource([[[0, 0], [100, 0], [100, 100], [0, 100]], [[500, 0], [600, 0], [600, 100], [500, 100]]]));
        const p = { x: 510, z: 50 }, v = { x: 47, z: 0 }; islands.constrain(p, v, { x: 95, z: 50 }); assert(p.x <= 250); assert(islands.sample(p.x, p.z).distance <= 150);
        assert.equal(islands.route({ x: 95, z: 50 }, { x: 510, z: 50 }, { home: { x: 510, z: 50 }, range: 1600 }), null);
    });
    test('union of declared landmark/member extents stays traversable', () => {
        const joined = createFlightBoundary(polygonFlightSource([[[0, 0], [100, 0], [100, 100], [0, 100]], [[90, 40], [240, 40], [240, 160], [90, 160]]]));
        assert(joined.segmentAllowed({ x: 50, z: 50 }, { x: 230, z: 150 })); assert(joined.allowed({ x: 380, z: 160 })); assert(!joined.allowed({ x: 400, z: 180 }));
    });
    test('safe return remains within manual range', () => {
        const home = { x: 900, z: 100 }, start = { x: 100, z: 900 }, route = l.route(start, home, { home, range: 1200 }); assert(route);
        for (const p of route) assert(Math.hypot(p.x - home.x, p.z - home.z) <= 1200);
    });
    console.log(`${checks}/${checks} drone boundary fixtures passed`);
})().catch(e => { console.error(e); process.exitCode = 1; });
