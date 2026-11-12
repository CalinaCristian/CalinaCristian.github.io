import * as THREE from '../vendor/three.module.min.js';
import { configureOffAxisWindow } from './office-window-math.js';
import { createOfficeWindowTarget, retainedOfficeWindowCapacity } from './office-window-target.js';
import { createOfficeWindowBinding, inRing } from './office-window-binding.js';

/** Homogeneous clipping gives actual visible aperture pixels, including near-plane crossings. */
export function projectedOfficeAperture(pane, camera, width, height) {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) return null;
  pane.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  pane.geometry.computeBoundingBox();
  const b = pane.geometry.boundingBox,
    m = new THREE.Matrix4()
      .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      .multiply(pane.matrixWorld);
  let poly = [
    [b.min.x, b.min.y],
    [b.max.x, b.min.y],
    [b.max.x, b.max.y],
    [b.min.x, b.max.y]
  ].map(([x, y]) => new THREE.Vector4(x, y, 0, 1).applyMatrix4(m));
  for (const [axis, sign] of [
    ['x', 1],
    ['x', -1],
    ['y', 1],
    ['y', -1],
    ['z', 1],
    ['z', -1]
  ]) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        fa = a.w + sign * a[axis],
        fb = b.w + sign * b[axis];
      if (fa >= 0) out.push(a);
      if (fa >= 0 !== fb >= 0) out.push(a.clone().lerp(b, fa / (fa - fb)));
    }
    poly = out;
    if (poly.length < 3) return null;
  }
  const xs = poly.map((p) => p.x / p.w),
    ys = poly.map((p) => p.y / p.w),
    w = ((Math.max(...xs) - Math.min(...xs)) * width) / 2,
    h = ((Math.max(...ys) - Math.min(...ys)) * height) / 2;
  return w > 0.01 && h > 0.01 ? { width: w, height: h } : null;
}
/** One retained scene/Traffic/environment; owns only camera, target and neutral placeholder. */
export function createOfficeWindowService({
  renderer,
  r3d,
  world,
  scene,
  traffic,
  office,
  entryCamera,
  binding
}) {
  if (!binding) {
    try {
      binding = createOfficeWindowBinding(world, office);
    } catch (error) {
      binding = { known: false, reason: 'Source aperture validation failed: ' + error.message };
    }
  }
  const camera = entryCamera.clone();
  camera.parent = null;
  camera.position.setFromMatrixPosition(entryCamera.matrixWorld);
  camera.quaternion.setFromRotationMatrix(entryCamera.matrixWorld);
  camera.scale.set(1, 1, 1);
  camera.updateMatrixWorld(true);
  const saved = {
    worldCamera: world.camera,
    observer: traffic.observerCamera,
    observerOwn: Object.hasOwn(traffic, 'observerCamera'),
    map: office.windowPane.material.map
  };
  const neutral = new THREE.DataTexture(new Uint8Array([28, 34, 39, 255]), 1, 1);
  neutral.colorSpace = THREE.LinearSRGBColorSpace;
  neutral.userData.officeExternal = true;
  neutral.needsUpdate = true;
  let target = null,
    disposed = false,
    active = false,
    reason = binding.reason || null,
    fault = reason,
    capacity = null;
  const far = entryCamera.far,
    eye = new THREE.Vector3(),
    size = new THREE.Vector2();
  const paneMap = (map) => {
    const material = office.windowPane.material;
    if (material.map !== map) {
      material.map = map;
      material.needsUpdate = true;
    }
  };
  paneMap(neutral);
  world.camera = camera;
  traffic.observerCamera = camera;
  const invalidate = () => {
    traffic._recoveryViewFrame = -1;
    if (traffic.peds) traffic.peds._viewFrame = -1;
  };
  invalidate();
  const hdr = renderer.capabilities?.isWebGL2 && renderer.extensions?.has?.('EXT_color_buffer_float');
  if (binding.known && !hdr) fault = reason = 'HDR window target is unsupported on this renderer';
  const hold = (message) => {
    active = false;
    fault = reason = message;
    paneMap(neutral);
  };
  const service = {
    camera,
    binding,
    get active() {
      return active;
    },
    get reason() {
      return reason;
    },
    get disposed() {
      return disposed;
    },
    get texture() {
      return target?.texture || null;
    },
    get label() {
      return active
        ? `Live district view${binding.floorAssignment?' · floor '+binding.floorAssignment.floor:''}`
        : 'Window view unavailable';
    },
    prepare(dt) {
      if (disposed) throw Error('Office window service is disposed');
      active = false;
      reason = fault;
      if (binding.known && hdr && !fault) {
        office.camera.getWorldPosition(eye);
        const mapped = binding.mapPoint(eye);
        if (
          ![eye.x, eye.y, eye.z].every(Number.isFinite) ||
          eye.x < office.bounds.minX ||
          eye.x > office.bounds.maxX ||
          eye.z < office.bounds.minZ ||
          eye.z > office.bounds.maxZ ||
          !inRing([mapped.x, mapped.z], binding.ring) ||
          binding.holes.some((h) => inRing([mapped.x, mapped.z], h, true)) ||
          eye.y < 1.55 ||
          eye.y > 2.3
        ) {
          reason = 'Virtual eye is outside the certified room envelope';
          paneMap(neutral);
        } else {
          camera.position.copy(mapped);
          camera.updateMatrixWorld(true);
          active = true;
        }
      }
      // The environment must never receive the office-local camera. Projection is configured last.
      r3d.advanceEnvironment(dt, { camera, cockpit: false, cull: false });
      if (active) {
        try {
          configureOffAxisWindow(camera, {
            eye: camera.position,
            lowerLeft: binding.lowerLeft,
            lowerRight: binding.lowerRight,
            upperLeft: binding.upperLeft,
            far: r3d.visibilityFar(far)
          });
          world.vegetation?.update?.(camera.position.x, camera.position.z);
        } catch (error) {
          hold(error.message);
        }
      }
      invalidate();
      return active;
    },
    capture() {
      if (disposed) throw Error('Office window service is disposed');
      if (!active) return false;
      renderer.getDrawingBufferSize(size);
      const pixels = projectedOfficeAperture(office.windowPane, office.camera, size.x, size.y);
      if (!pixels) return false;
      try {
        // (owner 2026-11-11: "when getting close to the windows in offices the graphics break") up close the window fills
        // the screen (2560 x 1440 = 3.7 MP) and the 1 MP cap stretched the view about 2x into blocks; High / Ultra now
        // render it at screen resolution (up to 4.19 MP), lower tiers keep 1 MP
        const big = /^(ultra|high)/.test(r3d.tier?.name || ''), limits = big ? { maxPixels: 4194304, maxDimension: 4096 } : { maxPixels: 1000000, maxDimension: 2048 };
        if (target && target.limitsBig !== big) { target.dispose?.(); target = null; capacity = null; }
        target ||= createOfficeWindowTarget({
          renderer,
          ...limits,
          type: THREE.HalfFloatType,
          colorSpace: THREE.LinearSRGBColorSpace,
          linearHDR: true
        });
        target.limitsBig = big;
        capacity = retainedOfficeWindowCapacity(pixels.width, pixels.height, capacity, limits);
        target.resize(capacity.width, capacity.height, 1);
        if (r3d.sun?.shadow) r3d.sun.shadow.needsUpdate = true;
        target.capture(camera, (c) => renderer.render(scene, c));
        paneMap(target.texture);
        return true;
      } catch (error) {
        hold('Window render failed: ' + error.message);
        return false;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      paneMap(saved.map);
      world.camera = saved.worldCamera;
      if (saved.observerOwn) traffic.observerCamera = saved.observer;
      else delete traffic.observerCamera;
      invalidate();
      target?.dispose();
      target = null;
      neutral.dispose();
      office.windowViewLabel = null;
      active = false;
    }
  };
  office.windowViewLabel = () => service.label;
  return service;
}
