#!/usr/bin/env node
// Pure geofence and routing fixtures; no renderer or dependencies needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
    const source = fs.readFileSync(path.join(__dirname, '../../src/drone-boundary.js'), 'utf8');
    const { createFlightBoundary, polygonFlightSource } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    let checks = 0;
    const test = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
    const rect = createFlightBoundary(polygonFlightSource([[[0, 0], [100, 0], [100, 100], [0, 100]]]));
    test('Euclidean20m buffer on edges and rounded corners', () => {
        assert.equal(rect.sample(110, 110).distance, Math.sqrt(200)); assert(rect.allowed({ x: 114, z: 114 })); assert(!rect.allowed({ x: 115, z: 115 }));
        for (let i = 0; i < 360; i++) { const a = i * Math.PI / 180, p = { x: 100 + Math.cos(a) * 40, z: 100 + Math.sin(a) * 40 }; rect.project(p); assert(rect.sample(p.x, p.z).distance <= 20); }
    });
    test('outward speed stops; tangential and inward speed remain', () => {
        const p = { x: 130, z: 50 }, v = { x: 47, z: 12 }; rect.constrain(p, v, { x: 119, z: 50 }); assert(p.x < 120); assert.equal(v.x, 0); assert.equal(v.z, 12);
        const inward = { x: -12, z: 7 }; rect.constrain({ x: 119.999, z: 50 }, inward); assert.deepEqual(inward, { x: -12, z: 7 });
    });
    test('approach braking is gradual and preserves tangent velocity', () => {
        const p = { x: 112, z: 50 }, v = { x: 46.8, z: 12 }; rect.constrain(p, v);
        assert(v.x > 20 && v.x < 46.8); assert.equal(v.z, 12);
        const near = { x: 46.8, z: 12 }; rect.constrain({ x: 118, z: 50 }, near); assert(near.x < v.x); assert(near.x > 0);
    });
    const l = createFlightBoundary(polygonFlightSource([[[0, 0], [300, 0], [300, 70], [70, 70], [70, 300], [0, 300]]]));
    test('concavity blocks a shortcut and A* routes around it', () => {
        const a = { x: 35, z: 270 }, b = { x: 270, z: 35 }; assert(!l.segmentAllowed(a, b));
        const route = l.route(a, b, { home: b, range: 800 }); assert(route?.length > 1);
        let p = a; for (const q of route) { assert(l.segmentAllowed(p, q)); p = q; } assert.deepEqual(p, b);
    });
    const outer = [[0, 0], [300, 0], [300, 300], [0, 300]], hole = [[70, 70], [230, 70], [230, 230], [70, 230]], polygon = polygonFlightSource([outer]), inner = polygonFlightSource([hole]);
    const donut = createFlightBoundary({ inside: (x, z) => polygon.inside(x, z) && !inner.inside(x, z), segments: [...polygon.segments, ...inner.segments] });
    test('holes remain excluded and return routes go around them', () => {
        const a = { x: 30, z: 150 }, b = { x: 270, z: 150 }; assert(!donut.allowed({ x: 150, z: 150 })); assert(!donut.segmentAllowed(a, b));
        let p = a; const route = donut.route(a, b, { home: b, range: 800 }); assert(route?.length > 1); for (const q of route) { assert(donut.segmentAllowed(p, q)); p = q; }
    });
    test('rotated diagonal boundaries project to nearest edge', () => {
        const diamond = createFlightBoundary(polygonFlightSource([[[0, 100], [100, 0], [200, 100], [100, 200]]]));
        const p = { x: 170, z: 170 }, v = { x: 26, z: 26 }; diamond.constrain(p, v); assert(Math.abs(diamond.sample(p.x, p.z).distance - 19.999) < 1e-7); assert(Math.hypot(v.x, v.z) < 1e-8);
    });
    test('separate islands cannot be crossed by a fast step', () => {
        const islands = createFlightBoundary(polygonFlightSource([[[0, 0], [100, 0], [100, 100], [0, 100]], [[150, 0], [250, 0], [250, 100], [150, 100]]]));
        const p = { x: 160, z: 50 }, v = { x: 47, z: 0 }; islands.constrain(p, v, { x: 95, z: 50 }); assert(p.x <= 120); assert(islands.sample(p.x, p.z).distance <= 20);
        assert.equal(islands.route({ x: 95, z: 50 }, { x: 160, z: 50 }, { home: { x: 160, z: 50 }, range: 800 }), null);
    });
    test('union of declared landmark/member extents stays traversable', () => {
        const joined = createFlightBoundary(polygonFlightSource([[[0, 0], [100, 0], [100, 100], [0, 100]], [[90, 40], [240, 40], [240, 160], [90, 160]]]));
        assert(joined.segmentAllowed({ x: 50, z: 50 }, { x: 230, z: 150 })); assert(joined.allowed({ x: 250, z: 160 })); assert(!joined.allowed({ x: 260, z: 180 }));
    });
    test('safe return remains within manual range', () => {
        const home = { x: 270, z: 35 }, start = { x: 35, z: 270 }, route = l.route(start, home, { home, range: 450 }); assert(route);
        for (const p of route) assert(Math.hypot(p.x - home.x, p.z - home.z) <= 450);
    });
    console.log(`${checks}/${checks} drone boundary fixtures passed`);
})().catch(e => { console.error(e); process.exitCode = 1; });
