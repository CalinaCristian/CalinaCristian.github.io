import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../../../game/vendor/three.module.min.js';
import { polygonFits, emittedFacade, officePaneFrame } from '../../../game/src/office-window-binding.js';
import {
  createOfficeWindowService,
  projectedOfficeAperture
} from '../../../game/src/office-window-service.js';
import { Traffic } from '../../../game/src/traffic.js';
import { createOfficeWindowTarget } from '../../../game/src/office-window-target.js';
const checks = [],
  check = (name, fn) => {
    fn();
    checks.push(name);
  },
  near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const outer = [
  [0, 0],
  [20, 0],
  [20, 20],
  [0, 20]
];
check(
  'whole polygon catches a concave excursion and an enclosed courtyard despite all corners being in source',
  () => {
    assert.equal(
      polygonFits(
        [
          [1, 1],
          [19, 1],
          [19, 19],
          [1, 19]
        ],
        outer,
        [
          [
            [8, 8],
            [12, 8],
            [12, 12],
            [8, 12]
          ]
        ]
      ),
      false
    );
    assert.equal(
      polygonFits(
        [
          [1, 1],
          [19, 1],
          [19, 19],
          [1, 19]
        ],
        [
          [0, 0],
          [20, 0],
          [20, 20],
          [12, 20],
          [12, 8],
          [8, 8],
          [8, 20],
          [0, 20]
        ]
      ),
      false
    );
    assert.equal(
      polygonFits(
        [
          [0, 1],
          [7, 1],
          [7, 19],
          [0, 19]
        ],
        outer,
        [
          [
            [8, 8],
            [12, 8],
            [12, 12],
            [8, 12]
          ]
        ]
      ),
      true
    );
    assert.equal(
      polygonFits(
        [
          [8, 8],
          [12, 8],
          [12, 12],
          [8, 12]
        ],
        outer,
        [
          [
            [8, 8],
            [12, 8],
            [12, 12],
            [8, 12]
          ]
        ]
      ),
      false
    );
  }
);
function wall(x0, x1, y0, y1, z) {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z], 3)
  );
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial());
}
const facade = {
  center: new THREE.Vector3(),
  right: new THREE.Vector3(1, 0, 0),
  outward: new THREE.Vector3(0, 0, 1),
  width: 8,
  y0: 1,
  y1: 3,
  maxSkin: 0.26
};
check(
  'emitted facade requires full triangle union, detects an unsampled slit, and rejects a real proud structural projection',
  () => {
    const owner = new THREE.Group();
    owner.add(wall(-4, -0.1, 1, 3, 0), wall(0.1, 4, 1, 3, 0));
    assert.equal(emittedFacade(owner, facade).known, false);
    owner.add(wall(-0.1, 0.1, 1, 3, 0), wall(-2, 2, 1, 3, 0.12));
    const r = emittedFacade(owner, facade);
    assert.equal(r.known, true);
    near(r.offsetM, 0.12);
    owner.add(wall(0.05, 0.09, 1.1, 1.2, 0.7));
    assert.equal(emittedFacade(owner, facade).blocked, true);
  }
);
class Renderer {
  constructor() {
    this.target = { retained: true };
    this.viewport = new THREE.Vector4(4, 5, 800, 500);
    this.scissor = new THREE.Vector4(1, 2, 30, 40);
    this.scissorTest = true;
    this.autoClear = false;
    this.autoClearColor = false;
    this.autoClearDepth = true;
    this.autoClearStencil = false;
    this.xr = { enabled: true };
    this.toneMapping = THREE.AgXToneMapping;
    this.toneMappingExposure = 1.7;
    this.outputColorSpace = THREE.SRGBColorSpace;
    this.clearColor = new THREE.Color(0.1, 0.2, 0.3);
    this.clearAlpha = 0.4;
    this.capabilities = { isWebGL2: true, maxTextureSize: 4096 };
    this.extensions = { has: () => true };
    this.calls = [];
    this.info = {
      render: { calls: 0, triangles: 0 },
      reset: () => {
        this.info.render.calls = 0;
        this.info.render.triangles = 0;
      }
    };
  }
  getRenderTarget() {
    return this.target;
  }
  getActiveCubeFace() {
    return 3;
  }
  getActiveMipmapLevel() {
    return 2;
  }
  getViewport(o) {
    return o.copy(this.viewport);
  }
  getScissor(o) {
    return o.copy(this.scissor);
  }
  getScissorTest() {
    return this.scissorTest;
  }
  setRenderTarget(v) {
    this.target = v;
  }
  setViewport(...v) {
    this.viewport = v[0]?.isVector4 ? v[0].clone() : new THREE.Vector4(...v);
  }
  setScissor(...v) {
    this.scissor = v[0]?.isVector4 ? v[0].clone() : new THREE.Vector4(...v);
  }
  setScissorTest(v) {
    this.scissorTest = v;
  }
  getClearColor(v) {
    return v.copy(this.clearColor);
  }
  getClearAlpha() {
    return this.clearAlpha;
  }
  setClearColor(c, a) {
    this.clearColor.copy(c);
    this.clearAlpha = a;
  }
  clear() {}
  getDrawingBufferSize(v) {
    return v.set(2400, 1600);
  }
  render(scene, camera) {
    this.calls.push({ scene, camera });
    this.info.render.calls++;
    this.info.render.triangles += 20;
  }
}
function paneOffice() {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(70, 1.5, 0.2, 3000),
    pane = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({ map: new THREE.Texture() })
    );
  pane.position.set(5.25, 1.95, 0);
  pane.rotation.y = -Math.PI / 2;
  scene.add(pane, camera);
  camera.position.set(0, 1.62, 0);
  camera.lookAt(pane.position);
  camera.updateMatrixWorld(true);
  return {
    camera,
    windowPane: pane,
    scene,
    stop: { id: 'db' },
    bounds: { minX: -4.5, maxX: 4.5, minZ: -4.5, maxZ: 4.5 }
  };
}
function binding(office) {
  const f = officePaneFrame(office),
    mapPoint = (p) => new THREE.Vector3(p.z, p.y, -p.x);
  return {
    known: true,
    ring: [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10]
    ],
    holes: [],
    mapPoint,
    lowerLeft: mapPoint(f.ll),
    lowerRight: mapPoint(f.lr),
    upperLeft: mapPoint(f.ul)
  };
}
function harness() {
  const office = paneOffice(),
    renderer = new Renderer(),
    scene = new THREE.Scene(),
    world = {
      camera: { original: true },
      vegetation: {
        calls: [],
        update(x, z) {
          this.calls.push([x, z]);
        }
      }
    },
    traffic = { observerCamera: { original: true }, peds: {} },
    entryCamera = new THREE.PerspectiveCamera(75, 1.5, 0.2, 5000);
  entryCamera.position.set(200, 2, 300);
  entryCamera.updateMatrixWorld(true);
  const order = [],
    r3d = {
      advanceEnvironment(dt, o) {
        order.push('environment');
        assert.equal(o.cockpit, false);
        assert.equal(o.cull, false);
        assert.notEqual(o.camera, office.camera);
        this.time = (this.time || 0) + dt;
      },
      visibilityFar(f) {
        order.push('far');
        return f;
      }
    };
  return { office, renderer, scene, world, traffic, entryCamera, r3d, order };
}
check('one existing world capture, HDR linear target, exact state restoration and actual pixel caps', () => {
  const h = harness(),
    saved = {
      target: h.renderer.target,
      color: h.renderer.clearColor.clone(),
      world: h.world.camera,
      observer: h.traffic.observerCamera,
      map: h.office.windowPane.material.map
    },
    service = createOfficeWindowService({ ...h, binding: binding(h.office) });
  service.prepare(0.03);
  assert.deepEqual(h.order, ['environment', 'far']);
  const projection = service.camera.projectionMatrix.clone();
  assert.equal(service.capture(), true);
  assert.deepEqual(service.camera.projectionMatrix, projection);
  assert.equal(h.renderer.calls.length, 1);
  assert.equal(h.renderer.calls[0].scene, h.scene);
  assert.notEqual(h.renderer.calls[0].camera, h.office.camera);
  assert.equal(service.texture.type, THREE.HalfFloatType);
  assert.equal(service.texture.colorSpace, THREE.LinearSRGBColorSpace);
  const image = service.texture.image;
  assert.ok(image.width <= 2048 && image.height <= 2048 && image.width * image.height <= 1000000);
  assert.equal(h.renderer.target, saved.target);
  assert.equal(h.renderer.toneMapping, THREE.AgXToneMapping);
  assert.equal(h.renderer.toneMappingExposure, 1.7);
  assert.equal(h.renderer.outputColorSpace, THREE.SRGBColorSpace);
  assert.equal(h.renderer.xr.enabled, true);
  assert.deepEqual(h.renderer.clearColor, saved.color);
  service.dispose();
  service.dispose();
  assert.equal(h.office.windowPane.material.map, saved.map);
  assert.equal(h.world.camera, saved.world);
  assert.equal(h.traffic.observerCamera, saved.observer);
  assert.equal(service.texture, null);
  assert.equal(h.office.windowViewLabel, null);
  assert.throws(() => service.prepare(0));
});
check('target restores all tone/clear/viewport state after actual render error', () => {
  const renderer = new Renderer(),
    saved = {
      target: renderer.target,
      viewport: renderer.viewport.clone(),
      color: renderer.clearColor.clone()
    },
    target = createOfficeWindowTarget({ renderer, linearHDR: true });
  assert.throws(() =>
    target.capture(new THREE.PerspectiveCamera(), () => {
      assert.equal(renderer.toneMapping, THREE.NoToneMapping);
      assert.equal(renderer.outputColorSpace, THREE.LinearSRGBColorSpace);
      renderer.setClearColor(new THREE.Color('red'), 0);
      renderer.autoClearColor = true;
      renderer.toneMappingExposure = 12;
      throw Error('draw failed');
    })
  );
  assert.equal(renderer.target, saved.target);
  assert.deepEqual(renderer.viewport, saved.viewport);
  assert.deepEqual(renderer.clearColor, saved.color);
  assert.equal(renderer.clearAlpha, 0.4);
  assert.equal(renderer.autoClearColor, false);
  assert.equal(renderer.toneMappingExposure, 1.7);
  target.dispose();
});
check(
  'unsupported identity/HDR and failed world draw keep neutral pane, source environment and ownership restoration',
  () => {
    for (const mode of ['identity', 'hdr', 'error']) {
      const h = harness(),
        old = h.office.windowPane.material.map;
      if (mode === 'hdr') h.renderer.extensions.has = () => false;
      if (mode === 'error')
        h.renderer.render = () => {
          throw Error('native failure');
        };
      const service = createOfficeWindowService({
        ...h,
        binding: mode === 'identity' ? { known: false, reason: 'A/B conflict' } : binding(h.office)
      });
      service.prepare(0.01);
      assert.equal(service.capture(), false);
      assert.equal(h.r3d.time, 0.01);
      assert.notEqual(h.office.windowPane.material.map, old);
      assert.match(service.label, /unavailable/);
      service.dispose();
      assert.equal(h.office.windowPane.material.map, old);
    }
  }
);
check(
  'aperture measurement handles behind/offscreen and partially visible pane with real perspective',
  () => {
    const o = paneOffice();
    assert.ok(projectedOfficeAperture(o.windowPane, o.camera, 1200, 800));
    o.camera.lookAt(new THREE.Vector3(-100, 1.62, 0));
    o.camera.updateMatrixWorld(true);
    assert.equal(projectedOfficeAperture(o.windowPane, o.camera, 1200, 800), null);
    o.camera.lookAt(new THREE.Vector3(5.25, 1.95, 5));
    o.camera.updateMatrixWorld(true);
    const p = projectedOfficeAperture(o.windowPane, o.camera, 1200, 800);
    assert.ok(p && p.width <= 1200 && p.height <= 800);
  }
);
// Execute the actual narrow Main methods with real Three camera/scene ownership, no app/browser construction.
const source = readFileSync(new URL('../../../game/src/main.js', import.meta.url), 'utf8'),
  methods = source.slice(source.indexOf('    enterOffice(stop) {'), source.indexOf('    async fly() {'));
class Office {
  static fail = false;
  constructor(renderer, camera, stop) {
    if (Office.fail) throw Error('constructor failed');
    Object.assign(this, paneOffice());
    this.camera = camera;
    this.scene.add(camera);
    this.stop = stop;
    this.read = new Set([0]);
    this.done = false;
  }
  update() {}
  render() {
    this.renderer?.render(this.scene, this.camera);
  }
  dispose() {
    this.camera.removeFromParent();
  }
}
const elements = new Map(),
  getElement = (s) => {
    if (!elements.has(s)) elements.set(s, { style: { display: '' }, classList: { add() {}, remove() {} } });
    return elements.get(s);
  };
let time = 100;
const Host = vm.runInNewContext('(class Host {' + methods + '})', {
  THREE,
  Office,
  $: getElement,
  createOfficeWindowService: (o) => {
    const service = createOfficeWindowService({ ...o, binding: binding(o.office) });
    return service;
  },
  makeVehicle: () => {
    const g = new THREE.Group();
    g.userData.length = 4.2;
    g.userData.width = 1.8;
    return g;
  },
  performance: { now: () => time },
  document: { visibilityState: 'visible' },
  STOPS: [],
  queueMicrotask,
  performanceNow: () => time
});
function mainHost(fromFoot) {
  const h = harness(),
    host = new Host();
  Object.assign(host, h, {
    state: fromFoot ? 'foot' : 'drive',
    city: { id: 'bucharest' },
    hud: { update() {}, toast() {}, setStreet() {}, prompt() {}, setNavLine() {} },
    audio: { stopEngine() {}, blip() {} },
    input: { flush() {} },
    freeRoam: true,
    player: {
      x: 300,
      z: 400,
      surfY: 11.24,
      heading: 0.5,
      fx: 1,
      fz: 0,
      speed: 0,
      camHolder: new THREE.Group(),
      resetLook() {},
      driveRigShown: !fromFoot
    },
    frame: 0,
    clock: { date: new Date() },
    office: null,
    carBody: null,
    carBox: null,
    updateClock(dt) {
      this.clockUpdates = (this.clockUpdates || 0) + 1;
    },
    pollWeather() {},
    trafficHours: () => 8.5,
    setDriveRigShown(v) {
      this.player.driveRigShown = v;
    },
    returnFocus() {}
  });
  host.camera = h.office.camera;
  host.player.camHolder.add(host.camera);
  host.camera.position.set(0, 2, 0);
  host.r3d.stats = {};
  host.traffic.setHour = () => {};
  host.traffic.update = () => {
    host.trafficUpdates = (host.trafficUpdates || 0) + 1;
  };
  host.foot = {
    x: 320,
    y: 11,
    z: 420,
    heading: 0.9,
    pitch: 0.2,
    active: fromFoot,
    exit() {
      this.active = false;
      host.camera.removeFromParent();
    },
    enter(x, z, heading, y) {
      Object.assign(this, { x, z, heading, y, active: true });
    },
    place() {}
  };
  if (fromFoot) {
    host.carBody = new THREE.Group();
    host.scene.add(host.carBody);
    host.carBox = { parked: true };
  }
  return host;
}
check(
  'actual Main office methods update native clock/Traffic once and restore drive/foot plus physical parked car',
  () => {
    for (const fromFoot of [false, true]) {
      const h = mainHost(fromFoot),
        originalBox = h.carBox,
        physical = { x: h.player.x, z: h.player.z },
        oldFoot = { x: h.foot.x, z: h.foot.z, y: h.foot.y };
      h.enterOffice({ id: 'db', company: 'DB', icon: '', short: 'DB' });
      h.office.renderer = h.renderer;
      assert.equal(h.player.driveRigShown, false);
      assert.equal(h.carBody.parent, h.scene);
      assert.equal(getElement('#bubbles').style.display, 'none');
      h.updateOffice(0.03);
      assert.equal(h.clockUpdates, 1);
      assert.equal(h.trafficUpdates, 1);
      assert.deepEqual({ x: h.player.x, z: h.player.z }, physical);
      assert.equal(h.renderer.info.render.calls, 0);
      time += 40;
      h.renderOffice();
      assert.equal(h.r3d.stats.frameMs, 40);
      for (let i = 0; i < 12; i++) {
        time += 40;
        h.renderOffice();
      }
      assert.equal(h.r3d.stats.fps, 25);
      h.leaveOffice();
      assert.equal(h.state, fromFoot ? 'foot' : 'drive');
      assert.equal(h.officeWindow, null);
      assert.equal(h.office, null);
      assert.equal(h.carBox, originalBox);
      assert.equal(h.player.driveRigShown, !fromFoot);
      if (fromFoot) assert.deepEqual({ x: h.foot.x, z: h.foot.z, y: h.foot.y }, oldFoot);
      else assert.equal(h.carBody.parent, null);
      assert.equal(getElement('#bubbles').style.display, '');
    }
  }
);
check(
  'actual Main failed entry rolls back street camera, parked-car lease, HUD and drive state without CV completion',
  () => {
    const h = mainHost(false);
    Office.fail = true;
    h.enterOffice({ id: 'db', company: 'DB' });
    Office.fail = false;
    assert.equal(h.state, 'drive');
    assert.equal(h.office, null);
    assert.equal(h.officeReturn, null);
    assert.equal(h.carBody.parent, null);
    assert.equal(h.camera.parent, h.player.camHolder);
    assert.equal(h.player.driveRigShown, true);
    assert.equal(getElement('#bubbles').style.display, '');
    h.restoreOfficeReturn();
    assert.equal(h.state, 'drive');
  }
);
check(
  'twenty repeated retained-world target leases restore references and release each owned target/placeholder once',
  () => {
    const h = harness(),
      worldCamera = h.world.camera,
      observer = h.traffic.observerCamera,
      old = h.office.windowPane.material.map;
    let targets = 0,
      placeholders = 0;
    for (let i = 0; i < 20; i++) {
      const service = createOfficeWindowService({ ...h, binding: binding(h.office) });
      h.office.windowPane.material.map.addEventListener('dispose', () => placeholders++);
      service.prepare(0.01);
      const render = h.renderer.render;
      h.renderer.render = function (s, c) {
        this.getRenderTarget().addEventListener('dispose', () => targets++);
        return render.call(this, s, c);
      };
      service.capture();
      h.renderer.render = render;
      service.dispose();
      service.dispose();
      assert.equal(h.world.camera, worldCamera);
      assert.equal(h.traffic.observerCamera, observer);
      assert.equal(h.office.windowPane.material.map, old);
    }
    assert.equal(targets, 20);
    assert.equal(placeholders, 20);
  }
);
check(
  'actual vehicle and pedestrian recovery hooks use the source observer camera, without the office camera or cockpit mirror',
  () => {
    const old = globalThis.game,
      sourceCamera = new THREE.PerspectiveCamera(70, 1, 0.2, 500),
      officeCamera = new THREE.PerspectiveCamera(70, 1, 0.2, 500);
    sourceCamera.position.set(1000, 1.6, 0);
    sourceCamera.lookAt(1000, 1.6, -100);
    sourceCamera.updateMatrixWorld(true);
    officeCamera.lookAt(0, 0, 100);
    officeCamera.updateMatrixWorld(true);
    const t = {
        player: { x: 0, z: 0, fx: 0, fz: 1, mirrorEnabled: true, mirrorCam: officeCamera },
        _frame: 1,
        observerCamera: sourceCamera
      },
      actor = { x: 1000, z: -150, y: 0.24, length: 5, width: 2 };
    globalThis.game = { traffic: t, camera: officeCamera };
    assert.equal(Traffic.prototype.inView.call(t, actor), true);
    assert.equal(t._recoveryViews.length, 1);
    delete t.observerCamera;
    t._frame++;
    assert.equal(Traffic.prototype.inView.call(t, actor), false);
    const source = readFileSync(new URL('../../../game/src/traffic.js', import.meta.url), 'utf8'),
      start = source.indexOf('    inView(p) {', source.indexOf('class Pedestrians')),
      end = source.indexOf('    /** Keep the physical pose', start),
      Ped = vm.runInNewContext('(class Ped {' + source.slice(start, end) + '})', { THREE, globalThis });
    t.observerCamera = sourceCamera;
    const p = new Ped();
    Object.assign(p, { t, _fr: 1 });
    assert.equal(p.inView(actor), true);
    assert.equal(p._views.length, 1);
    delete t.observerCamera;
    p._fr++;
    assert.equal(p.inView(actor), false);
    if (old === undefined) delete globalThis.game;
    else globalThis.game = old;
  }
);
console.log(
  JSON.stringify(
    {
      scope: 'CPU actual Three and exact Main method execution; no native/GPU/whole-app acceptance',
      passed: true,
      checks
    },
    null,
    2
  )
);
