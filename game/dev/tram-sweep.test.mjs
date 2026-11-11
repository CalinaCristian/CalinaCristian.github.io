// node --test game/dev/tram-sweep.test.mjs
// The build-time sweep of the rigid tram bodies (game/src/tram-sweep.js) on synthetic rail. These controls establish the
// pose rule, the cover reach and the queries; the generated district is audited with the game's own guard in
// game/dev/harness/tram-sweep-audit.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTramSweep, tramPathPoints, coverReach, TRAM_SWEEP_MODEL as M } from '../src/tram-sweep.js';
import { initialBodyCover } from '../src/initial-traffic-admission.js';

const node = (x, z) => ({ x, z, edges: [] });
function leg(a, b, { ya = 0, yb = 0, dirs = [1] } = {}) {
    const len = Math.hypot(b.x - a.x, b.z - a.z), e = { a, b, len, ya, yb, usable: true, railDirections: dirs, grade: {} };
    a.edges.push(e); b.edges.push(e); return e;
}
function line(points, opts) { const nodes = points.map(p => node(...p)), edges = []; for (let i = 1; i < nodes.length; i++) edges.push(leg(nodes[i - 1], nodes[i], opts)); return { nodes, edges }; }
const BODY = { kind: 'test-36', lengthM: 36, widthM: 2.4, outline: [[.01, -18], [.01, 18], [3.4, -18], [3.4, 18], [5.79, 4.3]] };
const SHORT = { kind: 'test-27', lengthM: 27, widthM: 2.4, outline: [[.01, -13.5], [.01, 13.5], [3.4, -13.5], [3.4, 13.5], [5.79, 4.3]] };

test('the cover reach is the reach of the guard\'s own disc cover', () => {
    for (const body of [BODY, SHORT]) {
        const reach = coverReach(body.lengthM, body.widthM); let along = 0, across = 0;
        for (const d of initialBodyCover({ x: 0, z: 0, heading: 0, length: body.lengthM, width: body.widthM })) { along = Math.max(along, Math.abs(d.along) + d.radius); across = Math.max(across, Math.abs(d.across) + d.radius); }
        assert.ok(Math.abs(along - body.lengthM / 2 - reach.alongM) < 1e-9); assert.ok(Math.abs(across - body.widthM / 2 - reach.acrossM) < 1e-9);
        assert.ok(reach.acrossM > .17 && reach.acrossM < .19);
    }
});

test('straight track: the sweep is the corridor of the cover, with nothing beyond the ends of the line', () => {
    const { edges } = line([[0, 0], [60, 0], [120, 0], [200, 0]]), sweep = buildTramSweep({ edges }, [BODY]);
    const half = 1.2 + coverReach(36, 2.4).acrossM + M.lateralSlackM;
    assert.ok(sweep.circle(100, half - .02, 0, 0, 3)); assert.equal(sweep.circle(100, half + .02, 0, 0, 3), null);
    assert.ok(sweep.circle(100, half + .08, .1, 0, 3), 'a bollard radius counts');
    assert.equal(sweep.circle(100, 0, .1, 7, 9), null, 'above the body'); assert.ok(sweep.circle(100, 0, .1, 5.9, 9), 'the raised pantograph');
    // no pose exists where the path 0.36 L behind or ahead is missing; the first body centre is 12.96 m in
    assert.equal(sweep.circle(-6, 0, 0, 0, 3), null); assert.ok(sweep.circle(-4.5, 0, 0, 0, 3));
    assert.ok(sweep.report.openEnded > 0 && sweep.report.poses > 300);
});

test('a bend: the rigid body reaches outside the straight corridor on the outside at its ends and inside at its middle', () => {
    // 30 degrees in six 5-degree source legs of 8 m, between two long straights
    const pts = [[-80, 0], [0, 0]]; let x = 0, z = 0, h = 0;
    for (let i = 0; i < 6; i++) { h += 5 * Math.PI / 180; x += 8 * Math.cos(h); z += 8 * Math.sin(h); pts.push([x, z]); }
    pts.push([x + 80 * Math.cos(h), z + 80 * Math.sin(h)]);
    const { edges } = line(pts), sweep = buildTramSweep({ edges }, [BODY]);
    const centre = (px, pz) => Math.min(...edges.map(e => { const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, t = Math.max(0, Math.min(1, ((px - e.a.x) * dx + (pz - e.a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - e.a.x - dx * t, pz - e.a.z - dz * t); }));
    let far = 0; const half = 1.2 + coverReach(36, 2.4).acrossM;
    for (let px = -20; px <= 70; px += .5) for (let pz = -8; pz <= 40; pz += .25) { const d = centre(px, pz); if (d > half + .1 && d < 6 && sweep.circle(px, pz, 0, 0, 3)) far = Math.max(far, d); }
    assert.ok(far > half + .5, `the body leaves the straight corridor by ${(far - half).toFixed(2)} m`);
    assert.ok(far < half + 2.5);
    // the same point is clear of a straight line's sweep
    const straight = buildTramSweep({ edges: line([[-80, 0], [200, 0]]).edges }, [BODY]);
    assert.equal(straight.circle(60, half + .5, 0, 0, 3), null);
});

test('a fork contributes the poses of both branches; a one-way leg only its own direction', () => {
    const a = node(0, 0), f = node(60, 0), b1 = node(140, 0), b2 = node(138, 14), trunk = leg(a, f), main = leg(f, b1), side = leg(f, b2);
    assert.equal(tramPathPoints(trunk, 1, 70).length, 2); assert.equal(tramPathPoints(main, 1, -10).length, 1);
    const sweep = buildTramSweep({ edges: [trunk, main, side] }, [SHORT]);
    assert.ok(sweep.circle(100, 0, 0, 0, 3)); assert.ok(sweep.circle(60 + 40 * 78 / Math.hypot(78, 14), 40 * 14 / Math.hypot(78, 14), 0, 0, 3));
    assert.ok(sweep.poses.every(p => p.fx > 0), 'legs travelled in their one direction only');
    const both = buildTramSweep({ edges: line([[0, 0], [200, 0]], { dirs: [1, -1] }).edges }, [SHORT]);
    assert.ok(both.poses.some(p => p.fx < 0) && both.poses.some(p => p.fx > 0));
});

test('a ramp: heights follow the path, and a pose filter separates the tram above from the traffic below', () => {
    const { edges } = line([[0, 0], [100, 0], [200, 0]]); edges[0].ya = 0; edges[0].yb = 8; edges[1].ya = 8; edges[1].yb = 8;
    const sweep = buildTramSweep({ edges }, [BODY]);
    assert.equal(sweep.circle(150, 0, .5, 0, 7.9), null, 'under the level deck'); assert.ok(sweep.circle(150, 0, .5, 8.3, 9));
    // on the grade the guard's one height interval for the whole pitched 36 m body applies at every disc: the body
    // centred 18 m downhill still covers this point, with its low end's height (about 2.1 m where the rail is at 4.8 m)
    const under = sweep.undersideOver(60, 0, .5); assert.ok(under > 1.9 && under < 2.3, String(under));
    assert.equal(sweep.undersideOver(60, 0, .5, p => p.y < 2), Infinity);
    assert.ok(sweep.circle(60, 0, .5, 0, 4.5) && !sweep.circle(60, 0, .5, 0, 4.5, p => p.y < 3));
});

test('walls: a segment query and the runs of a wall left clear', () => {
    const { edges } = line([[0, 0], [200, 0]]), sweep = buildTramSweep({ edges }, [BODY]), half = 1.2 + coverReach(36, 2.4).acrossM + M.lateralSlackM;
    assert.ok(sweep.segment([100, -6], [100, 6], 0, 0, 1.5)); assert.equal(sweep.segment([100, 2], [100, 6], 0, 0, 1.5), null);
    assert.equal(sweep.segment([90, half + .2], [110, half + .2], .1, 0, 1.5), null); assert.ok(sweep.segment([90, half + .2], [110, half + .2], .3, 0, 1.5));
    const runs = sweep.freeRuns([100, -8], [100, 8], { r: 0, y0a: 0, y1a: 1.5, pieceM: .25 });
    assert.equal(runs.length, 2);
    assert.ok(Math.abs(runs[0][1] * 16 - 8 + half) < .26 && Math.abs(runs[1][0] * 16 - 8 - half) < .26, JSON.stringify(runs));
    assert.deepEqual(sweep.freeRuns([100, 4], [100, 9], { y0a: 0, y1a: 1 }), [[0, 1]]);
    assert.deepEqual(sweep.freeRuns([100, -1], [100, 1], { y0a: 0, y1a: 1 }), []);
});

test('a domain filter drops the poses that can never be taken', () => {
    const { edges } = line([[0, 0], [200, 0]]);
    const sweep = buildTramSweep({ edges }, [BODY], M, { keep: p => p.x < 100 });
    assert.ok(sweep.circle(80, 0, 0, 0, 3)); assert.equal(sweep.circle(130, 0, 0, 0, 3), null); assert.ok(sweep.report.outsideDomain > 100);
});
