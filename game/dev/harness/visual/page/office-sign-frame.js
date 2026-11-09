import * as THREE from '../../../../vendor/three.module.min.js';

// Frame the actual authored sign plane, including side walls and scaled signs.
// Only the QA camera changes; restore() also runs if rendering/capture fails.
export function frameOfficeSign(office, { padding = 1.15, fov = 50 } = {}) {
    const sign = office.signMesh, camera = office.camera;
    if (!sign?.geometry || !camera?.isPerspectiveCamera) throw new Error('Missing actual office sign or perspective camera');
    office.scene.updateMatrixWorld(true);
    sign.geometry.computeBoundingBox();
    const box = sign.geometry.boundingBox, normals = sign.geometry.getAttribute('normal');
    if (!box || !normals?.count) throw new Error('Office sign has no finite plane bounds/normal');
    const normal = new THREE.Vector3().fromBufferAttribute(normals, 0).applyMatrix3(new THREE.Matrix3().getNormalMatrix(sign.matrixWorld)).normalize();
    const up = new THREE.Vector3(0, 1, 0).transformDirection(sign.matrixWorld);
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const corners = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(sign.matrixWorld));
    const centre = new THREE.Vector3(); corners.forEach(p => centre.add(p)); centre.multiplyScalar(1 / corners.length);
    const span = axis => { const values = corners.map(p => p.dot(axis)); return Math.max(...values) - Math.min(...values); };
    const requestedFov = fov, width = span(right), height = span(up), tangent = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    if (![width, height, camera.aspect, padding, tangent].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid actual office sign frame dimensions');
    let distance = Math.max(width / (2 * tangent * camera.aspect), height / (2 * tangent)) * padding + span(normal) / 2;
    // A portrait view can need a wider lens; moving beyond the opposite room wall
    // would frame an occluding wall despite all sign corners projecting on-screen.
    const bounds = office.bounds;
    if (bounds && ['minX', 'maxX', 'minZ', 'maxZ'].every(k => Number.isFinite(bounds[k]))) {
        const exits = [];
        for (const [axis, min, max] of [['x', 'minX', 'maxX'], ['z', 'minZ', 'maxZ']]) if (Math.abs(normal[axis]) > 1e-8) {
            const exit = ((normal[axis] > 0 ? bounds[max] : bounds[min]) - centre[axis]) / normal[axis];
            if (exit > 0) exits.push(exit);
        }
        const roomDistance = Math.min(...exits) * .8;
        if (distance > roomDistance) {
            distance = Math.max(camera.near * 4, roomDistance);
            fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(width / camera.aspect, height) * padding / (2 * distance)));
            if (!Number.isFinite(fov) || fov >= 175) throw new Error('Actual sign cannot fit from inside the office');
        }
    }
    // A room partition can stand between the sign and an otherwise valid frame.
    // Move the camera along the sign's normal and widen its lens until actual
    // scene rays reach the sign; preserve every authored object and material.
    const targets = [], ray = new THREE.Raycaster();
    for (const u of [.001, .5, .999]) for (const v of [.001, .5, .999]) targets.push(new THREE.Vector3(
        THREE.MathUtils.lerp(box.min.x, box.max.x, u), THREE.MathUtils.lerp(box.min.y, box.max.y, v), (box.min.z + box.max.z) / 2).applyMatrix4(sign.matrixWorld));
    const visible = object => { for (let o = object; o; o = o.parent) if (!o.visible) return false; return object.material?.visible !== false; };
    let clearRays = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = centre.clone().addScaledVector(normal, distance);
        clearRays = targets.filter(target => {
            ray.set(candidate, target.clone().sub(candidate).normalize());
            return ray.intersectObject(office.scene, true).find(hit => visible(hit.object))?.object === sign;
        }).length;
        if (clearRays === targets.length) break;
        distance *= .75;
        fov = Math.max(requestedFov, THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(width / camera.aspect, height) * padding / (2 * distance))));
        if (distance < camera.near * 4 || !Number.isFinite(fov) || fov >= 175) throw new Error('Actual office sign remains occluded within the available camera view');
    }
    if (clearRays !== targets.length) throw new Error('Actual office sign remains occluded');
    const eye = centre.clone().addScaledVector(normal, Math.max(distance, camera.near * 4));
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, centre, up));
    const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov, zoom: camera.zoom, far: camera.far };
    const parent = camera.parent;
    camera.position.copy(parent ? parent.worldToLocal(eye.clone()) : eye);
    camera.quaternion.copy(parent ? parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(quaternion) : quaternion);
    camera.fov = fov; camera.zoom = 1; camera.far = Math.max(saved.far, distance * 2 + 1);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const projected = corners.map(p => p.clone().project(camera).toArray());
    const proof = { centre: centre.toArray(), normal: normal.toArray(), eye: eye.toArray(), width, height, distance, aspect: camera.aspect, requestedFov, fov, padding, clearRays, visibilityRays: targets.length, projected,
        fits: projected.every(p => p.every(Number.isFinite) && Math.abs(p[0]) < 1 && Math.abs(p[1]) < 1 && p[2] > -1 && p[2] < 1) };
    let restored = false;
    return { proof, restore() {
        if (restored) return; restored = true;
        camera.position.copy(saved.position); camera.quaternion.copy(saved.quaternion);
        camera.fov = saved.fov; camera.zoom = saved.zoom; camera.far = saved.far;
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    } };
}
