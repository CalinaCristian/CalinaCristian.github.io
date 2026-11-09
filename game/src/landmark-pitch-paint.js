import * as THREE from '../vendor/three.module.min.js';
import { DINAMO_PAINT_COVERAGE } from './landmark-pitch-paint-coverage.js';

// These are the existing Dinamo paint centre-lines, in its authored (u,v) frame.
// Keep the 40 straight circle chords and butt ends: filtering changes sampling,
// never the physical paint footprint or the football activity's dimensions.
export function dinamoPaintSegments() {
    const lines = [], line = (u0, v0, u1, v1) => lines.push([u0, v0, u1, v1, 0.12]);
    const PL = 52, PW = 32.5;
    line(-PL, -PW, PL, -PW); line(-PL, PW, PL, PW);
    line(-PL, -PW, -PL, PW); line(PL, -PW, PL, PW); line(0, -PW, 0, PW);
    for (const s of [-1, 1]) {
        const g = s * PL;
        line(g, -20.16, g - s * 16.5, -20.16); line(g - s * 16.5, -20.16, g - s * 16.5, 20.16); line(g - s * 16.5, 20.16, g, 20.16);
        line(g, -9.16, g - s * 5.5, -9.16); line(g - s * 5.5, -9.16, g - s * 5.5, 9.16); line(g - s * 5.5, 9.16, g, 9.16);
    }
    for (let i = 0; i < 40; i++) {
        const a = i / 40 * Math.PI * 2, c = (i + 1) / 40 * Math.PI * 2;
        line(Math.cos(a) * 9.15, Math.sin(a) * 9.15, Math.cos(c) * 9.15, Math.sin(c) * 9.15);
    }
    return lines;
}

export function paintPolygon([u0, v0, u1, v1, width]) {
    const length = Math.hypot(u1 - u0, v1 - v0), nu = -(v1 - v0) / length * width / 2, nv = (u1 - u0) / length * width / 2;
    return [[u0 + nu, v0 + nv], [u1 + nu, v1 + nv], [u1 - nu, v1 - nv], [u0 - nu, v0 - nv]];
}

export const DINAMO_PAINT = Object.freeze({ width: 1024, height: 1024, halfU: 54, halfV: 34.5, coverage: 'exact-polygon-union-area', channels: 2, mipBytes: 2796202 });

// The alpha map reads its green channel. RG8 avoids a four-channel colour texture;
// the immutable asset stores only green coverage, RLE-compressed for transport.
// No canvas, Image or other DOM resource is needed by geometry checks.
export function makeDinamoPaintTexture() {
    const { width, height } = DINAMO_PAINT, data = new Uint8Array(width * height * 2);
    const packed = atob(DINAMO_PAINT_COVERAGE);
    let pixel = 0;
    for (let i = 0; i < packed.length; i += 3) {
        const count = packed.charCodeAt(i) * 256 + packed.charCodeAt(i + 1), coverage = packed.charCodeAt(i + 2);
        for (let j = 0; j < count; j++, pixel++) data[pixel * 2 + 1] = coverage;
    }
    if (pixel !== width * height) throw new Error('Dinamo paint coverage length mismatch');
    const texture = new THREE.DataTexture(data, width, height, THREE.RGFormat, THREE.UnsignedByteType);
    texture.name = 'dinamo-paint-coverage'; texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.userData.shared = true; texture.userData.mipBytes = DINAMO_PAINT.mipBytes; texture.needsUpdate = true;
    return texture;
}

export function makeDinamoPaintMesh(W, scale, material) {
    const { halfU: u, halfV: v } = DINAMO_PAINT;
    const positions = [[-u, -v], [u, -v], [u, v], [-u, v]].flatMap(([a, c]) => { const [x, z] = W(a, c); return [x * scale, 0.18, z * scale]; });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    // (u,v) frame has negative x/z determinant; this winding faces upward.
    geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material); mesh.name = 'dinamo-pitch-paint';
    mesh.castShadow = false; mesh.receiveShadow = true;
    return mesh;
}
