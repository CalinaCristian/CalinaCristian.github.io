import * as THREE from '../vendor/three.module.min.js';
import { FullScreenQuad } from '../vendor/addons/Pass.js';

// World rendering keeps its adaptive resolution. Only the two physical display
// planes are drawn again at output resolution, using the original scene depth.
// No geometry, camera, input surface or visible hierarchy is moved/reparented.
const MAX_OUTPUT_PIXELS = 4_000_000;
const MAX_DISPLAY_DPR = 3;
const PATCH = 'cockpit-display-depth-v1';

export function displayPixelRatio(worldRatio, dpr, width, height, active) {
    if (!active) return worldRatio;
    return Math.max(worldRatio, Math.min(dpr || 1, MAX_DISPLAY_DPR,
        Math.sqrt(MAX_OUTPUT_PIXELS / Math.max(1, width * height))));
}

function depthTexture(renderer, width, height) {
    return new THREE.DepthTexture(width, height,
        renderer.capabilities.reverseDepthBuffer ? THREE.FloatType : THREE.UnsignedIntType);
}

function patchMaterial(material) {
    if (material.userData.sharpCockpitDepth) return material.userData.sharpCockpitDepth;
    const uniforms = {
        uDisplayPass: { value: 0 }, uDisplayDepth: { value: null },
        uDisplayWorldSize: { value: new THREE.Vector2(1, 1) },
        uDisplayOutputSize: { value: new THREE.Vector2(1, 1) },
        uDisplayDepthSign: { value: 1 }, uDisplayMultisample: { value: 0 },
    };
    const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
    material.onBeforeCompile = function (shader, renderer) {
        compile.call(this, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
            #include <packing>
            uniform float uDisplayPass, uDisplayDepthSign, uDisplayMultisample;
            uniform sampler2D uDisplayDepth;
            uniform vec2 uDisplayWorldSize, uDisplayOutputSize;`)
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
            if (uDisplayPass > 0.5) {
                vec2 worldPixel = floor(gl_FragCoord.xy * uDisplayWorldSize / uDisplayOutputSize) + 0.5;
                vec2 delta = worldPixel * uDisplayOutputSize / uDisplayWorldSize - gl_FragCoord.xy;
                vec2 slope = vec2(dFdx(gl_FragCoord.z), dFdy(gl_FragCoord.z));
                // Window depth is affine across a projected plane. Compare at
                // the sampled scene texel, rather than lifting the display.
                float planeDepth = gl_FragCoord.z + dot(slope, delta);
                float sceneDepth = unpackRGBAToDepth(texture2D(uDisplayDepth, worldPixel / uDisplayWorldSize));
                // MSAA depth resolve can select an intra-pixel sample. This is
                // its bounded sampling uncertainty, plus four 24-bit depth ULPs.
                float tolerance = 4.0 / 16777216.0 + uDisplayMultisample * 0.5 *
                    dot(abs(slope), uDisplayOutputSize / uDisplayWorldSize);
                if ((planeDepth - sceneDepth) * uDisplayDepthSign > tolerance) discard;
            }`);
    };
    material.customProgramCacheKey = () => key + '|' + PATCH;
    material.needsUpdate = true;
    material.userData.sharpCockpitDepth = uniforms;
    return uniforms;
}

function visibleInScene(object, scene, camera) {
    if (!object || !camera.layers.test(object.layers)) return false;
    for (let o = object; o; o = o.parent) {
        if (!o.visible) return false;
        if (o === scene) return true;
    }
    return false;
}

export class CockpitDisplays {
    constructor(renderer, composer) {
        this.renderer = renderer;
        this.scene = new THREE.Scene();
        this.bindings = [];
        this.active = false;
        this.stats = { active: false, drawCalls: 0, triangles: 0 };
        for (const target of [composer.renderTarget1, composer.renderTarget2]) {
            target.depthTexture ||= depthTexture(renderer, target.width, target.height);
        }
        this.savedDepth = new THREE.WebGLRenderTarget(1, 1, {
            minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
            depthBuffer: false, stencilBuffer: false,
        });
        this.savedDepth.texture.name = 'cockpit-scene-depth';
        this.lowTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
        this.lowTarget.texture.name = 'low-world';
        this.lowTarget.samples = Math.min(4, renderer.capabilities.maxSamples);
        this.lowTarget.depthTexture = depthTexture(renderer, 1, 1);
        this.copyMaterial = new THREE.ShaderMaterial({
            name: 'save-cockpit-scene-depth', toneMapped: false,
            depthTest: false, depthWrite: false, blending: THREE.NoBlending,
            uniforms: { sourceDepth: { value: null } },
            vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
            fragmentShader: '#include <packing>\nuniform sampler2D sourceDepth;varying vec2 vUv;void main(){gl_FragColor=packDepthToRGBA(texture2D(sourceDepth,vUv).x);}',
        });
        this.copyQuad = new FullScreenQuad(this.copyMaterial);
        this.capturePass = {
            enabled: true, needsSwap: false,
            setSize: (w, h) => this.savedDepth.setSize(w, h),
            render: (r, write, read) => { if (this.active) this.captureDepth(read, false); },
        };
    }

    setPlayer(player) {
        this.bindings = [];
        this.scene.clear();
        for (const source of [player?.cockpit?.userData.cluster, player?.cockpit?.userData.screen]) {
            if (!source?.isMesh || !source.material?.isMeshBasicMaterial) continue;
            const uniforms = patchMaterial(source.material);
            const mesh = new THREE.Mesh(source.geometry, source.material);
            mesh.matrixAutoUpdate = false;
            mesh.layers.mask = source.layers.mask;
            this.scene.add(mesh);
            this.bindings.push({ source, mesh, uniforms });
        }
        // Allocate persistent auxiliary targets during normal cockpit setup,
        // rather than on the first headlight or Low-quality interaction.
        if (this.bindings.length) {
            this.renderer.initRenderTarget(this.lowTarget);
            this.renderer.initRenderTarget(this.savedDepth);
        }
    }

    begin(scene, camera, player, worldRatio, width, height) {
        this.active = !!player?.driveRigShown && this.bindings.some(b => visibleInScene(b.source, scene, camera));
        const ratio = displayPixelRatio(worldRatio, globalThis.devicePixelRatio, width, height, this.active);
        if (this.renderer.getPixelRatio() !== ratio) this.renderer.setPixelRatio(ratio);
        this.stats = { active: this.active, worldPixelRatio: worldRatio, outputPixelRatio: ratio,
            outputPixels: this.renderer.domElement.width * this.renderer.domElement.height,
            worldPixels: this.savedDepth.width * this.savedDepth.height,
            drawCalls: 0, triangles: 0 };
    }

    resize(width, height, worldRatio) {
        const w = Math.max(1, Math.floor(width * worldRatio)), h = Math.max(1, Math.floor(height * worldRatio));
        this.lowTarget.setSize(w, h);
        this.savedDepth.setSize(w, h);
    }

    captureDepth(target, multisample) {
        const r = this.renderer, before = { ...r.info.render }, prev = r.getRenderTarget();
        this.copyMaterial.uniforms.sourceDepth.value = target.depthTexture;
        r.setRenderTarget(this.savedDepth);
        this.copyQuad.render(r);
        r.setRenderTarget(prev);
        this.multisample = multisample;
        this.stats.drawCalls += r.info.render.calls - before.calls;
        this.stats.triangles += r.info.render.triangles - before.triangles;
    }

    renderLow(scene, camera, outputPass) {
        const r = this.renderer, prev = r.getRenderTarget();
        r.setRenderTarget(this.lowTarget);
        r.render(scene, camera);
        if (this.active) this.captureDepth(this.lowTarget, this.lowTarget.samples > 0);
        const before = { ...r.info.render }, screen = outputPass.renderToScreen;
        outputPass.renderToScreen = true;
        try { outputPass.render(r, null, this.lowTarget); }
        finally { outputPass.renderToScreen = screen; r.setRenderTarget(prev); }
        this.stats.drawCalls += r.info.render.calls - before.calls;
        this.stats.triangles += r.info.render.triangles - before.triangles;
    }

    render(scene, camera) {
        if (!this.active) return;
        const r = this.renderer, before = { ...r.info.render }, prev = r.getRenderTarget(), clear = r.autoClear;
        const changes = [];
        this.scene.fog = scene.fog;
        this.scene.environment = scene.environment;
        try {
            for (const { source, mesh, uniforms } of this.bindings) {
                mesh.visible = visibleInScene(source, scene, camera);
                if (!mesh.visible) continue;
                mesh.matrix.copy(source.matrixWorld);
                const material = source.material;
                changes.push({ material, depthTest: material.depthTest, depthWrite: material.depthWrite, uniforms });
                material.depthTest = false; material.depthWrite = false;
                uniforms.uDisplayPass.value = 1;
                uniforms.uDisplayDepth.value = this.savedDepth.texture;
                uniforms.uDisplayWorldSize.value.set(this.savedDepth.width, this.savedDepth.height);
                uniforms.uDisplayOutputSize.value.set(r.domElement.width, r.domElement.height);
                uniforms.uDisplayDepthSign.value = r.capabilities.reverseDepthBuffer ? -1 : 1;
                uniforms.uDisplayMultisample.value = this.multisample ? 1 : 0;
            }
            r.autoClear = false;
            r.setRenderTarget(null);
            r.render(this.scene, camera);
        } finally {
            for (const c of changes) { c.material.depthTest = c.depthTest; c.material.depthWrite = c.depthWrite; c.uniforms.uDisplayPass.value = 0; }
            r.autoClear = clear; r.setRenderTarget(prev);
            this.scene.fog = this.scene.environment = null;
        }
        this.stats.drawCalls += r.info.render.calls - before.calls;
        this.stats.triangles += r.info.render.triangles - before.triangles;
    }

    dispose() {
        this.setPlayer(null);
        this.copyQuad.dispose(); this.copyMaterial.dispose();
        this.savedDepth.dispose(); this.lowTarget.dispose();
    }
}
