// Optional read-only scene/ray dump plus an explicitly separate two-tick native follow-up.
// The original direct-load capture is retained; no meshes, poses or camera transforms are hidden/changed.
exports.probe = async (page, out) => {
    const fs = require('node:fs'), path = require('node:path');
    const rows = [];
    for (const phase of ['direct-load', 'after-two-native-drive-ticks']) {
        if (rows.length) await page.evaluate(() => { game.updateDrive(1 / 30); game.updateDrive(1 / 30); });
        const row = await page.evaluate(async phase => {
            const THREE = await import('/game/vendor/three.module.min.js'), g = game, p = g.player;
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
            return { phase, district: g.district, state: g.state, camera: { world: xyz(g.camera.getWorldPosition(new THREE.Vector3())), local: xyz(g.camera.position), rotation: xyz(g.camera.rotation), parentIsCamHolder: g.camera.parent === p.camHolder },
                player: { x: p.x, z: p.z, y: p.y, heading: p.heading, speed: p.speed, rig: xyz(p.rig.position), camHolder: xyz(p.camHolder.position), camHolderRotation: xyz(p.camHolder.rotation), look: { ...p.look } }, rays,
                nearestVehicles: g.traffic.vehicles.map(v => ({ id: v.id, type: v.type, x: v.x, z: v.z, heading: v.heading, length: v.length, width: v.width, speed: v.speed, inactive: v.inactive, visible: v.mesh.visible, distance: Math.hypot(v.x - p.x, v.z - p.z) })).sort((a, b) => a.distance - b.distance).slice(0, 12) };
        }, phase);
        rows.push(row);
        fs.writeFileSync(path.join(out, 'travel-occlusion.json'), JSON.stringify({ method: 'Original direct-load capture retained. Rays are read-only. Separate follow-up advances exactly two normal drive ticks; no pose/material/visibility edits.', rows }, null, 2));
        if (rows.length > 1) {
            await page.evaluate(() => { harness.H._renderNow = true; game.drawFrame({ mirror: true }); harness.H._renderNow = false; });
            await require('./integration-browser-bounds.cjs').captureViewport(page, path.join(out, 'travel-after-two-native-drive-ticks.png'));
        }
    }
    return { file: 'travel-occlusion.json', capture: 'travel-after-two-native-drive-ticks.png', phases: rows.map(r => r.phase) };
};
