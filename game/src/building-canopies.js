import { validRoofProfile, roofMesh } from './building-roofs.js';

// Open source roofs keep a flat measured underside and their full native top.
// Clearance is an input; this geometry never invents or raises a minimum.
export function canopyGeometry(building, triangulate) {
    const { ring, holes = [], h, minH } = building;
    const native = validRoofProfile(building.roofProfile, h, minH)
        ? roofMesh(ring, holes, building.roofProfile, triangulate) : null;
    const { pts, tris } = triangulate(ring, holes);
    const roofFaces = native ? native.faces : tris.map(t => t.map(i => [pts[i][0], h, pts[i][1]]));
    const underside = tris.map(t => t.map(i => [pts[i][0], minH, pts[i][1]]));
    const eavesM = native ? building.roofProfile.eavesM : h, walls = [];
    for (const boundary of [ring, ...holes]) {
        const area = boundary.reduce((sum, a, i) => { const b = boundary[(i + 1) % boundary.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
        const sign = Math.sign(area) * (boundary === ring ? 1 : -1);
        for (let i = 0; i < boundary.length; i++) {
            const a = boundary[i], b = boundary[(i + 1) % boundary.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (length < .05 || eavesM <= minH) continue;
            walls.push({ vertices: [[a[0], minH, a[1]], [b[0], minH, b[1]], [b[0], eavesM, b[1]], [a[0], eavesM, a[1]]], normal: [sign * (b[1] - a[1]) / length, 0, -sign * (b[0] - a[0]) / length] });
        }
    }
    return { native, roofFaces, underside, walls, eavesM, triangulation: { pts, tris } };
}
