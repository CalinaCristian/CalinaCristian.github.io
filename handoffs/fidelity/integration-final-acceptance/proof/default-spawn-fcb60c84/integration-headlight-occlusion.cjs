// Optional read-only scene/ray dump plus an explicitly separate two-tick native follow-up.
// The original direct-load capture is retained; no meshes, poses or camera transforms are hidden/changed.
exports.probe = async (page, out) => {
    const fs = require('node:fs'), path = require('node:path');
    const rows = [];
    for (const phase of ['direct-load', 'after-two-native-drive-ticks']) {
        if (rows.length) await page.evaluate(() => { game.updateDrive(1 / 30); game.updateDrive(1 / 30); });
        const row = await page.evaluate(async phase => {
            const THREE = await import('/game/vendor/three.module.min.js'), { obbPen, vObb } = await import('/game/dev/harness/page/util.js'), g = game, p = g.player;
            g.scene.updateMatrixWorld(true); g.camera.updateMatrixWorld(true);
            const xyz = v => ({ x: v.x, y: v.y, z: v.z });
            const chain = object => { const result = []; for (let o = object; o; o = o.parent) result.push(o); return result; };
            const ray = new THREE.Raycaster(); ray.layers.mask = g.camera.layers.mask;
            const rays = [];
            for (const [x, y] of [[0, 0], [0, .3], [-.3, 0], [.3, 0]]) {
                ray.setFromCamera(new THREE.Vector2(x, y), g.camera);
                rays.push({ ndc: [x, y], hits: ray.intersectObjects(g.scene.children, true).slice(0, 8).map(hit => {
                    const ancestors = chain(hit.object), v = g.traffic.vehicles.find(v => ancestors.includes(v.mesh));
                    return { distance: hit.distance, point: xyz(hit.point), object: hit.object.name,
                        material: Array.isArray(hit.object.material) ? hit.object.material.map(m => m.name) : hit.object.material?.name,
                        instanceId: hit.instanceId, ownCockpit: ancestors.includes(p.cockpit), ownRig: ancestors.includes(p.rig),
                        vehicleId: v?.id, parents: ancestors.slice(0, 5).map(o => ({ name: o.name, type: o.type })) };
                }) });
            }
            const centreOffset = (p.front - p.rear) / 2, body = { x: p.x + p.fx * centreOffset, z: p.z + p.fz * centreOffset, fx: p.fx, fz: p.fz, length: p.length, width: p.width };
            const vehicles = g.traffic.vehicles.map(v => ({ id: v.id, kind: v.kind, x: v.x, z: v.z, y: v.y, heading: v.heading, length: v.length, width: v.width, speed: v.speed, inactive: v.inactive, visible: v.mesh.visible, distance: Math.hypot(v.x - p.x, v.z - p.z), bodySATPenetration: Math.abs((v.y ?? .24) - (p.y ?? .24)) < 2.5 ? obbPen(vObb(v), body) : null }));
            return { phase, district: g.district, state: g.state, camera: { world: xyz(g.camera.getWorldPosition(new THREE.Vector3())), local: xyz(g.camera.position), rotation: xyz(g.camera.rotation), parentIsCamHolder: g.camera.parent === p.camHolder },
                player: { x: p.x, z: p.z, y: p.y, heading: p.heading, speed: p.speed, rig: xyz(p.rig.position), camHolder: xyz(p.camHolder.position), camHolderRotation: xyz(p.camHolder.rotation), look: { ...p.look } }, rays,
                body, population: { maxVehicles: g.traffic.maxVehicles, activeIds: g.traffic.vehicles.map(v => v.id), poolIds: g.traffic.pool.map(v => v.id), peopleIds: g.traffic.peds.list.map(v => v.i), target: g.traffic.target, nativeCounts: g.traffic.counts, counts: { active: g.traffic.vehicles.length, pool: g.traffic.pool.length, people: g.traffic.peds.list.length } },
                overlappingVehicles: vehicles.filter(v => v.bodySATPenetration > 1e-6), nearestVehicles: vehicles.sort((a, b) => a.distance - b.distance).slice(0, 12) };
        }, phase);
        rows.push(row);
        fs.writeFileSync(path.join(out, 'travel-occlusion.json'), JSON.stringify({ method: 'Original direct-load capture retained. Rays are read-only. Separate follow-up advances exactly two normal drive ticks; no pose/material/visibility edits.', rows }, null, 2));
        if (rows.length > 1) {
            await page.evaluate(() => { harness.H._renderNow = true; game.drawFrame({ mirror: true }); harness.H._renderNow = false; const gl = game.renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); });
            await require('./integration-browser-bounds.cjs').captureViewport(page, path.join(out, 'travel-after-two-native-drive-ticks.png'));
        }
    }
    return { file: 'travel-occlusion.json', capture: 'travel-after-two-native-drive-ticks.png', phases: rows.map(r => r.phase) };
};
