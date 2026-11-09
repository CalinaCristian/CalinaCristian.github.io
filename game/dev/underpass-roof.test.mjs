import assert from 'node:assert/strict';
import { underpassRoofModel, underpassRoofFaces, underpassRoofBand, underpassRoofCollider, UNDERPASS_COVER_POLICY } from '../src/underpass-roof.js';
import { MeshBuilder } from '../src/geobuild.js';
import { buildUnderpassOwnerIndex } from '../src/underpass-ground-owner.js';

import { fixture, edges, nativeWidth, nativePoint } from './underpass-roof-native.mjs';
const byId = new Map(edges.map(e => [e.id, e]));
const tests = [];
const test = (name, run) => { run(); tests.push(name); };
const generic = { id: 1, a: { x: 0, z: 0 }, b: { x: 0, z: 20 }, dirx: 0, dirz: 1, len: 20, tunnel: true, lidded: true, ya: -6, yb: -5 };
test('all 15 actual native inverted-roof witnesses become positive slabs; literal 3.5m remains separate', () => {
    for (const witness of fixture.inversionWitnesses) {
        assert.ok(witness.ceiling[0].y > witness.lids[0].y);
        const e = byId.get(witness.edgeId), m = underpassRoofModel(e, { sourceTags: e.sourceTags });
        assert.equal(m.known, true); assert.equal(m.legalMaxheightM, 3.5);
        assert.ok(m.topM - m.ceilingAt(witness.u) >= .25 - 1e-12);
        assert.ok(m.ceilingAt(witness.u) - m.floorAt(witness.u) >= 3.5);
    }
});
test('all 112 true Pasaj road profiles and legal tags remain exact', () => {
    const original = JSON.stringify(fixture.edges), es = edges.filter(e => [12, 13, 213].includes(e.road));
    assert.equal(es.length, 112);
    for (const e of es) {
        const m = underpassRoofModel(e, { sourceTags: e.sourceTags }); assert.ok(m.known);
        for (let k = 0; k <= 100; k++) {
            const t = k / 100; assert.equal(m.floorAt(t), .24 + e.ya + (e.yb - e.ya) * t);
            assert.ok(m.ceilingAt(t) <= m.topM - .25 + 1e-12); assert.ok(m.ceilingAt(t) - m.floorAt(t) >= 3.5);
        }
    }
    assert.equal(JSON.stringify(fixture.edges), original);
});
test('actual native mitred portal beam and underside share exact Float32 endpoints', () => {
    for (const id of [30, 39, 835, 1005]) {
        const e = byId.get(id), m = underpassRoofModel(e, { sourceTags: e.sourceTags });
        const faces = underpassRoofFaces(m, { pointAt: nativePoint(e), rightM: nativeWidth(e, 1), leftM: nativeWidth(e, -1) });
        const mb = new MeshBuilder();
        for (const q of faces.bottom) mb.face4(...q, [80, 80, 80], [0, -1, 0]);
        for (const face of faces.fascia) mb.face4(...face.vertices, [80, 80, 80], face.out);
        const positions = [];
        for (let k = 0; k < mb.vc; k++) positions.push(Array.from(mb.p.slice(k * 3, k * 3 + 3)));
        for (const section of faces.sections.filter(s => s.t === m.span[0] || s.t === m.span[1])) {
            for (const p of [section.right, section.left]) {
                const f32 = p.map(Math.fround); assert.ok(positions.filter(q => q.every((v, i) => v === f32[i])).length >= 2);
            }
        }
    }
});
test('each proposed native slab is closed at roof, sides and buried endpoint height steps', () => {
    for (const id of [30, 39, 835, 1005]) {
        const e = byId.get(id), m = underpassRoofModel(e, { sourceTags: e.sourceTags }), f = underpassRoofFaces(m, { pointAt: nativePoint(e), rightM: nativeWidth(e, 1), leftM: nativeWidth(e, -1) });
        const tris = [...f.bottom, ...f.top, ...f.fascia.map(q => q.vertices)].flatMap(q => [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]);
        const counts = new Map();
        for (const t of tris) for (let k = 0; k < 3; k++) {
            const a = t[k].map(Math.fround).join(','), b = t[(k + 1) % 3].map(Math.fround).join(','), key = a < b ? a + '/' + b : b + '/' + a;
            if (a !== b) counts.set(key, (counts.get(key) || 0) + 1);
        }
        assert.ok([...counts.values()].every(n => n === 2));
    }
});
test('cap-to-native-clearance transition is split at the true kink, not interpolated above the slab', () => {
    const m = underpassRoofModel(generic); assert.equal(m.stations.length, 3);
    assert.ok(m.stations[1] > 0 && m.stations[1] < 1);
    assert.ok(Math.abs(m.ceilingAt(m.stations[1]) - (m.topM - .25)) < 1e-12);
    assert.equal(m.ceilingAt(0), -6 + .24 + 5.2);
});
test('partly covered literal tunnel retains an open ramp and closes only its old covered interval', () => {
    const e = { ...generic, lidded: false, ya: -3, yb: -6 }, m = underpassRoofModel(e, { sourceTags: { maxheight: '3.5' } });
    assert.equal(m.known, true); assert.ok(Math.abs(m.span[0] - .4) < 1e-12); assert.equal(m.span[1], 1);
    assert.equal(underpassRoofBand(m, e, 0, 2), null); assert.ok(underpassRoofBand(m, e, 0, 12));
});
test('ordinary surface, source canopy, elevated bridge and open ramp get no roof', () => {
    for (const e of [{ ...generic, tunnel: false }, { ...generic, coveredRoadModel: {} }, { ...generic, bridge: true }, { ...generic, virtual: true }, { ...generic, lidded: false, ya: -1, yb: -3 }]) assert.equal(underpassRoofModel(e).known, false);
});
test('literal height above available opening stays unresolved; roof is not lifted', () => {
    const e = { ...generic, lidded: false, ya: -4.2, yb: -6 };
    assert.equal(underpassRoofModel(e, { sourceTags: { maxheight: '4.5' } }).reason, 'modeled-opening-below-literal-height');
    assert.equal(underpassRoofModel(e, { sourceTags: { 'maxheight:physical': '4.2' } }).known, false);
});
test('missing and non-metric legal tags stay explicit, never become measured clearance', () => {
    for (const maxheight of [undefined, 'default', '12 feet', '3.5;4']) {
        const m = underpassRoofModel(generic, { sourceTags: { maxheight } }); assert.equal(m.legalHeightMapped, false); assert.equal(m.legalMaxheightM, null); assert.equal(m.estimated, true);
    }
});
test('literal physical opening wins over the generic estimate when the positive slab can contain it', () => {
    const m = underpassRoofModel({ ...generic, ya: -6, yb: -6 }, { sourceTags: { 'maxheight:physical': '4.2', maxheight: '3.5' } });
    assert.ok(m.known); assert.equal(m.physicalMaxheightM, 4.2);
    assert.ok(Math.abs(m.ceilingAt(.5) - m.floorAt(.5) - 4.2) < 1e-12);
});
test('malformed source profiles and nonpositive slab inputs are refused', () => {
    assert.equal(underpassRoofModel({ ...generic, ya: NaN }).known, false);
    assert.equal(underpassRoofModel(generic, { minThicknessM: 0 }).known, false);
    assert.equal(underpassRoofFaces(underpassRoofModel(generic), { pointAt: () => [NaN, 0, 0], rightM: 3, leftM: 3 }).known, false);
});
test('earth roof occluder preserves source color and blocks later underground bodies only inside its covered footprint', () => {
    assert.equal(UNDERPASS_COVER_POLICY.colorWrite, false); assert.equal(UNDERPASS_COVER_POLICY.depthWrite, true);
    assert.ok(UNDERPASS_COVER_POLICY.renderOrder > -18 && UNDERPASS_COVER_POLICY.renderOrder < 0);
    // Standard opaque depth test, camera above: native grass color(.049) is
    // already drawn; roof(.06) writes nearer depth without replacing it.
    const draw = (state, { depth, color, depthWrite = false, colorWrite = true }) => depth <= state.depth ? { depth: depthWrite ? depth : state.depth, color: colorWrite ? color : state.color } : state;
    let s = draw({ depth: Infinity, color: 'sky' }, { depth: 10 - .049, color: 'actual-grass' });
    s = draw(s, { depth: 10 - .06, color: 'inferred-concrete', ...UNDERPASS_COVER_POLICY });
    s = draw(s, { depth: 10 - (-6 + .24 + 1.5), color: 'underground-car', depthWrite: true });
    assert.equal(s.color, 'actual-grass');
    const road = draw(s, { depth: 10 - .24, color: 'actual-overlying-road', depthWrite: true }); assert.equal(road.color, 'actual-overlying-road');
    // Outside the roof footprint no mask is submitted; an open-ramp actor is
    // still drawn. This is not a global terrain/material depth-write change.
    const open = draw({ depth: Infinity, color: 'actual-ground' }, { depth: 14, color: 'open-ramp-car', depthWrite: true }); assert.equal(open.color, 'open-ramp-car');
});
test('roof collider follows actual Float32 slab planes and permits the literal 3.5m body below', () => {
    for (const id of [30, 39, 835, 1005]) {
        const e = byId.get(id), m = underpassRoofModel(e, { sourceTags: e.sourceTags }), pointAt = nativePoint(e);
        const faces = underpassRoofFaces(m, { pointAt, rightM: nativeWidth(e, 1), leftM: nativeWidth(e, -1) });
        const c = underpassRoofCollider(m, faces, `native-way-${e.road}`); assert.ok(c); assert.ok(c.y0 < c.y1);
        for (const t of m.stations) {
            // Float32 centre of the actual quad, not a source-centre shortcut at
            // a mitred edge. Near endpoints use an interior native station.
            const u = Math.max(.001, Math.min(.999, t)), p = pointAt(u, 0, 0), bottom = c.minHeightAt(p[0], p[2]);
            assert.ok(bottom !== null); assert.ok(bottom - m.floorAt(u) >= 3.5 - 1e-6);
            assert.ok(c.roofHeightAt(p[0], p[2]) - bottom >= .25 - 1e-6);
            assert.ok(c.minHeightAt(p[0], p[2], .5) <= bottom);
        }
    }
});
const nativeSkin = (y, x0 = -5, x1 = 5, z0 = -5, z1 = 25) => {
    const m = new MeshBuilder(); m.flatQuad(x0, z0, x1, z0, x1, z1, x0, z1, y, [40, 90, 40]); return m;
};
const footprint = [[-4, 0], [-4, 20], [4, 20], [4, 0]];
test('roof top follows actual native grass/pave bands without lifting or recoloring their vertices', () => {
    const grass = nativeSkin(.049), pave = nativeSkin(.095), before = Buffer.from(grass.p.buffer).toString('hex');
    const index = buildUnderpassOwnerIndex([{ mesh: grass, id: 'grass' }, { mesh: pave, id: 'pave' }], { fallbackM: -.3 });
    const owner = index.forPolygon(footprint); assert.equal(owner.known, true); assert.equal(owner.topM, Math.fround(.049)); assert.equal(owner.fallbackAreaM2, 0);
    const m = underpassRoofModel(generic, { topM: owner.topM, sourceTags: { maxheight: '3.5' } });
    assert.ok(m.known); assert.equal(m.topM, Math.fround(.049)); assert.ok(m.ceilingAt(1) <= Math.fround(.049) - .25);
    assert.equal(Buffer.from(grass.p.buffer).toString('hex'), before);
});
test('source-ground coverage gaps use the unchanged native base-plane datum and stay explicit', () => {
    const half = nativeSkin(.049, -5, 0);
    const owner = buildUnderpassOwnerIndex([{ mesh: half, id: 'partial-aerial-grass' }], { fallbackM: -.3 }).forPolygon(footprint);
    assert.ok(owner.known); assert.equal(owner.topM, -.3); assert.ok(Math.abs(owner.fallbackAreaM2 - 80) < 1e-8);
    assert.equal(underpassRoofModel(generic, { topM: owner.topM, sourceTags: { maxheight: '3.5' } }).known, true);
});
test('the sunken road cannot become its own overhead earth owner', () => {
    const roof = buildUnderpassOwnerIndex([{ mesh: nativeSkin(-5.76), id: 'sunken-road' }, { mesh: nativeSkin(.02), id: 'source-landuse' }], { fallbackM: -.3 }).forPolygon(footprint);
    assert.equal(roof.topM, Math.fround(.02)); assert.equal(roof.bands.some(b => b.id.startsWith('sunken-road')), false);
});
test('lower transparent water remains unresolved regardless of opaque renderOrder; no guessed top shift', () => {
    for (const waterY of [-4.4, .11]) {
        const owner = buildUnderpassOwnerIndex([{ mesh: nativeSkin(.049), id: 'grass' }, { mesh: nativeSkin(waterY), id: 'raw-water', water: true }], { fallbackM: -.3 }).forPolygon(footprint);
        assert.equal(owner.known, false); assert.equal(owner.reason, 'retained-water-topology-unresolved'); assert.equal(owner.waters[0].minY, Math.fround(waterY));
    }
    const outside = buildUnderpassOwnerIndex([{ mesh: nativeSkin(-4.4, 20, 25), id: 'separate-water', water: true }], { fallbackM: -.3 }).forPolygon(footprint);
    assert.ok(outside.known); assert.equal(outside.topM, -.3);
});
test('malformed native surface data is reported instead of becoming a clearance certificate', () => {
    const index = buildUnderpassOwnerIndex([{ mesh: null, id: 'missing' }], { fallbackM: -.3 }); assert.equal(index.report.malformed, 1);
    assert.equal(index.forPolygon(footprint).reason, 'malformed-native-surface-data');
    assert.equal(index.forPolygon([[NaN, 0], [0, 1], [1, 1]]).known, false);
});
console.log(JSON.stringify({ passed: tests.length, tests, historicalNativeSource: fixture.source, currentNativeVisualAcceptance: false }, null, 2));
