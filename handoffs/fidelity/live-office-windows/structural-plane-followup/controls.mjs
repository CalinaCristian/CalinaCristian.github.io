import assert from 'node:assert/strict';
import * as THREE from '../../../../game/vendor/three.module.min.js';
import { structuralOwnerPlanes } from '../../../../game/src/office-window-structural-plane.js';
import { createOfficeWindowBinding, polygonFits } from '../../../../game/src/office-window-binding.js';
const checks = [],
  check = (name, fn) => {
    fn();
    checks.push(name);
  },
  near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function fixture(w = 12, d = 15) {
  const owner = new THREE.Group();
  owner.position.y = 0.12;
  const main = new THREE.Mesh(new THREE.BoxGeometry(w, 5.6, d), new THREE.MeshBasicMaterial());
  main.position.y = 2.8;
  owner.add(main);
  const args = {
    floor: 0.12,
    band: { baseM: 0, topM: 5.6, basis: 'explicit main-prism control' },
    width: 8,
    height: 1.7,
    sourceCenter: new THREE.Vector3(0, 1.92, d / 2),
    sourceOutward: new THREE.Vector3(0, 0, 1)
  };
  return { owner, main, args };
}
check(
  'actual plane follows unchanged structural triangles rather than an approximate source-edge direction',
  () => {
    const f = fixture();
    f.owner.rotation.y = 0.006;
    f.args.sourceCenter.z += 0.14;
    const r = structuralOwnerPlanes(f.owner, f.args);
    assert.equal(r.known, true);
    const p = r.planes.sort(
        (a, b) => b.outward.dot(f.args.sourceOutward) - a.outward.dot(f.args.sourceOutward)
      )[0],
      expected = new THREE.Vector3(0, 0, 1).applyQuaternion(f.owner.quaternion);
    near(p.outward.dot(expected), 1);
    for (const t of p.triangles)
      for (const v of t.worldVertices) near(new THREE.Vector3(...v).sub(p.center).dot(p.outward), 0);
    assert.equal(p.bodyRing.length, 4);
  }
);
check(
  'exterior mailbox, trim and substantial projection remain unchanged and never choose the clipping plane',
  () => {
    const f = fixture(),
      before = structuralOwnerPlanes(f.owner, f.args).planes[0],
      mail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshBasicMaterial()),
      canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 4), new THREE.MeshBasicMaterial());
    mail.position.set(0, 1.9, 10);
    canopy.position.set(0, 3, 9);
    f.owner.add(mail, canopy);
    const children = f.owner.children.slice(),
      bytes = Buffer.from(mail.geometry.attributes.position.array.buffer).toString('hex'),
      after = structuralOwnerPlanes(f.owner, f.args).planes[0];
    assert.deepEqual(after.center, before.center);
    assert.deepEqual(after.outward, before.outward);
    assert.deepEqual(after.triangles, before.triangles);
    assert.deepEqual(f.owner.children, children);
    assert.equal(mail.visible, true);
    assert.equal(canopy.visible, true);
    assert.equal(Buffer.from(mail.geometry.attributes.position.array.buffer).toString('hex'), bytes);
    assert.ok(mail.position.z - after.center.z > 2);
  }
);
check(
  'missing band, truncated main wall and multiple structural contours fail without guessing ownership',
  () => {
    const f = fixture();
    assert.equal(structuralOwnerPlanes(f.owner, { ...f.args, band: null }).known, false);
    const onlyDetail = new THREE.Group();
    onlyDetail.add(new THREE.Mesh(new THREE.BoxGeometry(12, 2, 15), new THREE.MeshBasicMaterial()));
    assert.equal(structuralOwnerPlanes(onlyDetail, f.args).known, false);
    const second = fixture();
    second.owner.position.x = 30;
    second.owner.position.y = 0;
    f.owner.add(second.owner);
    assert.equal(structuralOwnerPlanes(f.owner, f.args).known, false);
  }
);
check('a genuinely nonplanar full-height wall is never averaged into a planar certificate', () => {
  const f = fixture(),
    p = f.main.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getZ(i) > 0) p.setZ(i, p.getZ(i) + 0.1);
  p.needsUpdate = true;
  assert.equal(structuralOwnerPlanes(f.owner, f.args).known, false);
});
function bindingFixture(w = 12, d = 15) {
  const f = fixture(w, d),
    scene = new THREE.Scene(),
    pane = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.7), new THREE.MeshBasicMaterial());
  pane.position.set(4.75, 1.8, 0);
  pane.rotation.y = -Math.PI / 2;
  scene.add(pane);
  const ring = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2]
    ],
    world = {
      data: {
        proj: { scale: 1 },
        buildingIds: ['w245117704'],
        buildingFootprints: { 0: ring },
        buildingHoleFootprints: {}
      },
      landmarks: [{ id: 'gts', mesh: f.owner }],
      stats: { landmarkSourceReplacements: [{ landmark: 'gts', replaced: ['w245117704'] }] },
      nearestEdge: (x, z) => ({ d: z > 0 ? 5 : 50 })
    },
    office = { stop: { id: 'gts' }, windowPane: pane, bounds: { minX: -4, maxX: 4, minZ: -4, maxZ: 4 } };
  return { ...f, world, office };
}
check('binding requires both literal source support and the complete emitted structural eye envelope', () => {
  const f = bindingFixture();
  const b = createOfficeWindowBinding(f.world, f.office);
  assert.equal(b.known, true);
  assert.equal(b.skinOffsetM, 0);
  assert.equal(b.facadeEvidence.exteriorGeometryRetained, true);
  assert.equal(polygonFits(b.facadeEvidence.sourceEyeEnvelopeXZ, b.ring, b.holes), true);
  assert.equal(
    polygonFits(b.facadeEvidence.sourceEyeEnvelopeXZ, b.facadeEvidence.actualStructuralBodyRing),
    true
  );
  const narrow = bindingFixture(9, 6);
  narrow.world.data.buildingFootprints[0] = [
    [-10, -10],
    [10, -10],
    [10, 10],
    [-10, 10]
  ];
  assert.equal(createOfficeWindowBinding(narrow.world, narrow.office).known, false);
});
check(
  'retained source courtyard and wrong owner still hold despite a complete planar structural mesh',
  () => {
    const f = bindingFixture();
    f.world.data.buildingHoleFootprints[0] = [
      [
        [-3, -3],
        [3, -3],
        [3, 3],
        [-3, 3]
      ]
    ];
    assert.equal(createOfficeWindowBinding(f.world, f.office).known, false);
    delete f.world.data.buildingHoleFootprints[0];
    f.world.stats.landmarkSourceReplacements[0].replaced = [];
    assert.equal(createOfficeWindowBinding(f.world, f.office).known, false);
  }
);
console.log(
  JSON.stringify(
    {
      scope:
        'CPU structural-plane/source-projection/whole-eye controls; exterior geometry retained; no native eye pixels',
      passed: true,
      checks
    },
    null,
    2
  )
);
