import * as THREE from '../vendor/three.module.min.js';

// This adapter follows the vendored r170 PMREMGenerator's fromScene pipeline. Each step renders one cubeUV face
// or one native two-pass blur. Keep the completed atlas in use until the entire replacement is ready.
export function supportsProgressivePMREM(pmrem) {
    return THREE.REVISION === '170' && ['_setSize', '_allocateTargets', '_applyPMREM', '_blur'].every(k => typeof pmrem[k] === 'function');
}

export function progressivePMREM(renderer, pmrem, scene, sigma = 0, near = 0.5, far = 300) {
    if (!supportsProgressivePMREM(pmrem)) return null;
    pmrem._setSize(256);
    const target = pmrem._allocateTargets();
    target.depthBuffer = true;
    const camera = new THREE.PerspectiveCamera(90, 1, near, far);
    const background = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({
        name: 'PMREM.Background', side: THREE.BackSide, depthWrite: false, depthTest: false,
        color: renderer.getClearColor(new THREE.Color()),
    }));

    function withState(draw) {
        const previous = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
        const xr = renderer.xr.enabled, autoClear = renderer.autoClear, toneMapping = renderer.toneMapping;
        renderer.xr.enabled = false; renderer.autoClear = false; renderer.toneMapping = THREE.NoToneMapping;
        try { draw(); }
        finally {
            renderer.setRenderTarget(previous, face, mip);
            renderer.xr.enabled = xr; renderer.autoClear = autoClear; renderer.toneMapping = toneMapping;
        }
    }

    let cleaned = false;
    function clean() { if (!cleaned) { cleaned = true; background.geometry.dispose(); background.material.dispose(); } }
    function* work() {
        try {
            // The orientations and atlas rectangles are exactly PMREMGenerator._sceneToCubeUV in r170.
            const up = [1, -1, 1, 1, 1, 1], forward = [1, 1, 1, -1, -1, -1];
            for (let face = 0; face < 6; face++) {
                const column = face % 3, size = pmrem._cubeSize;
                if (column === 0) { camera.up.set(0, up[face], 0); camera.lookAt(forward[face], 0, 0); }
                else if (column === 1) { camera.up.set(0, 0, up[face]); camera.lookAt(0, forward[face], 0); }
                else { camera.up.set(0, up[face], 0); camera.lookAt(0, 0, forward[face]); }
                target.viewport.set(column * size, face > 2 ? size : 0, size, size);
                target.scissor.copy(target.viewport);
                withState(() => { renderer.setRenderTarget(target); renderer.render(background, camera); renderer.render(scene, camera); });
                yield;
            }
            if (sigma > 0) { withState(() => pmrem._blur(target, 0, 0, sigma)); yield; }
            // Let the pinned native implementation choose its exact sigmas, mip levels and pole axes.
            const blurs = [], blur = pmrem._blur;
            pmrem._blur = (...args) => blurs.push(args);
            try { pmrem._applyPMREM(target); } finally { pmrem._blur = blur; }
            for (const args of blurs) { withState(() => blur.apply(pmrem, args)); yield; }
            target.scissorTest = false;
            target.viewport.set(0, 0, target.width, target.height); target.scissor.copy(target.viewport);
        } finally { clean(); }
    }

    const iterator = work();
    return {
        target,
        step: () => iterator.next().done,
        dispose() { iterator.return(); clean(); target.dispose(); },
    };
}
