import * as THREE from '../vendor/three.module.min.js';
import { configureOffAxisWindow } from './office-window-math.js';
import { boundedOfficeWindowSize, createOfficeWindowTarget, retainedOfficeWindowCapacity } from './office-window-target.js';
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
  ].map(([x, y]) => ({p:new THREE.Vector4(x, y, 0, 1).applyMatrix4(m),
    uv:new THREE.Vector2((x-b.min.x)/(b.max.x-b.min.x),(y-b.min.y)/(b.max.y-b.min.y))}));
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
        fa = a.p.w + sign * a.p[axis],
        fb = b.p.w + sign * b.p[axis];
      if (fa >= 0) out.push(a);
      if (fa >= 0 !== fb >= 0) {const t=fa/(fa-fb);out.push({p:a.p.clone().lerp(b.p,t),uv:a.uv.clone().lerp(b.uv,t)});}
    }
    poly = out;
    if (poly.length < 3) return null;
  }
  const xs = poly.map(({p}) => p.x / p.w),
    ys = poly.map(({p}) => p.y / p.w),
    w = ((Math.max(...xs) - Math.min(...xs)) * width) / 2,
    h = ((Math.max(...ys) - Math.min(...ys)) * height) / 2;
  const u0=Math.max(0,Math.min(...poly.map(v=>v.uv.x))-.001),u1=Math.min(1,Math.max(...poly.map(v=>v.uv.x))+.001),
    v0=Math.max(0,Math.min(...poly.map(v=>v.uv.y))-.001),v1=Math.min(1,Math.max(...poly.map(v=>v.uv.y))+.001);
  return w > 0.01 && h > 0.01 ? { width: w, height: h, u0,u1,v0,v1 } : null;
}

/** Crop the source facade itself; texture UVs perform the inverse crop on the unchanged room pane. */
export function officeWindowCrop(binding, region) {
  const {u0,u1,v0,v1}=region;
  if(![u0,u1,v0,v1].every(Number.isFinite)||u0<0||v0<0||u1>1||v1>1||u1<=u0||v1<=v0)throw Error('Invalid visible window region');
  const right=binding.lowerRight.clone().sub(binding.lowerLeft),up=binding.upperLeft.clone().sub(binding.lowerLeft),
    at=(u,v)=>binding.lowerLeft.clone().addScaledVector(right,u).addScaledVector(up,v);
  return {lowerLeft:at(u0,v0),lowerRight:at(u1,v0),upperLeft:at(u0,v1),
    repeat:[1/(u1-u0),1/(v1-v0)],offset:[-u0/(u1-u0),-v0/(v1-v0)]};
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
    capacity = null,
    capacityKey = null,
    captureInfo = null;
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
    get captureInfo() { return captureInfo; },
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
        target ||= createOfficeWindowTarget({
          renderer,
          maxPixels: 4194304,
          maxDimension: 4096,
          type: THREE.HalfFloatType,
          colorSpace: THREE.LinearSRGBColorSpace,
          linearHDR: true
        });
        const level=r3d.level??1,limits={maxPixels:level===0?4194304:level<=2?2097152:level===3?1048576:524288,maxDimension:level===0?4096:2048},
          key=[size.x,size.y,level].join('/');
        if(key!==capacityKey){capacity=null;capacityKey=key;}
        capacity = retainedOfficeWindowCapacity(pixels.width, pixels.height, capacity,limits);
        const requested=boundedOfficeWindowSize(capacity.width,capacity.height,1,limits),actual=target.resize(requested.width,requested.height,1),crop=officeWindowCrop(binding,pixels);
        configureOffAxisWindow(camera,{eye:camera.position,...crop,far:r3d.visibilityFar(far)});
        target.texture.repeat.set(...crop.repeat);target.texture.offset.set(...crop.offset);target.texture.updateMatrix();
        captureInfo={visiblePixels:{width:pixels.width,height:pixels.height},uv:{u0:pixels.u0,u1:pixels.u1,v0:pixels.v0,v1:pixels.v1},target:actual,limits};
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
