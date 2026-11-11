// Bellevue Way entrance: OSM entrance n5752777692 and CC0 April 2023 photo.
// Plan boundaries are source geometry; heights, glazing bays and frame sizes
// below are explicit model estimates (research/landmarks-bellevue-square.json).
import { ringArea } from './building-parts.js';
export const BELLEVUE_MACYS_SOURCE = [[-50.5779,-58.4861],[-50.119,-83.7367],[-49.5809,-126.8627],[-5.3145,-126.4812],[-5.6997,-109.7128],[1.5136,-109.6111],[1.5995,-111.4327],[5.7561,-111.3702],[16.358,-111.1803],[16.2948,-109.6883],[22.9279,-109.5318],[23.2,-119.5539],[23.373,-126.1029],[31.2643,-125.9926],[53.3218,-125.5454],[51.9621,-59.2013],[47.0499,-59.2827],[4.8481,-59.8775],[-35.1496,-60.538],[-35.2921,-57.4119],[-43.7927,-57.5885],[-43.7595,-58.5409]];

export const BELLEVUE_SQUARE_PROFILE = Object.freeze({
    bodyHeightM: 15, entranceX: 9, entranceFrontZ: -111.4,
    gableHalfWidthM: 5.2, gableSpringM: 18.4, gablePeakM: 21,
    sourceIds: ['w29234887', 'w497739259'],
    policy: 'The undimensioned Macy’s part shares the three-level mall envelope; 15m remains an estimate. No 57.6m tower is supported by the source.'
});

export function buildBellevueSquare(b, outline, macys) {
    const p = BELLEVUE_SQUARE_PROFILE, H = p.bodyHeightM;
    const stone = '#aaa69c', brick = '#876351', glass = '#425465', frame = '#c3c5c1';
    const sign = Math.sign(ringArea(outline));
    // One physical envelope owns the outline and its completely contained part.
    // No generic copy of Macy's is drawn through it. Keep the entire mapped plan.
    b.cap(outline, H, '#b2ada3');
    outline.forEach((a, i) => {
        const c = outline[(i + 1) % outline.length], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz);
        if (L < 1e-6) return;
        const nx = sign * dz / L, nz = -sign * dx / L;
        const at = (t, y, off = 0) => [a[0] + dx * t + nx * off, y, a[1] + dz * t + nz * off];
        const wall = (lo, hi, col) => b.quad(at(0, lo), at(1, lo), at(1, hi), at(0, hi), col, 'm', [nx, 0, nz]);
        // The source entrance recess and its returns, not a box across the wings.
        const recess = a[0] >= -6 && a[0] <= 24 && c[0] >= -6 && c[0] <= 24 &&
            a[1] >= -120 && a[1] <= -108 && c[1] >= -120 && c[1] <= -108;
        const macysFront = Math.min(a[1], c[1]) < -108 && Math.max(a[0], c[0]) < 54 && Math.min(a[0], c[0]) > -51;
        wall(0, 9.4, stone); wall(9.4, H, macysFront && !recess ? brick : stone);
        if (recess) {
            for (const [lo, hi] of [[.4, 3.5], [4.1, 8.9], [9.5, 14.4]]) {
                b.quad(at(0, lo, .055), at(1, lo, .055), at(1, hi, .055), at(0, hi, .055), glass, 'g', [nx, 0, nz]);
                // Estimated 14cm mullions remain legible at the reported drone distance.
                const n = Math.max(1, Math.round(L / 1.25));
                for (let j = 0; j <= n; j++) {
                    const t = j / n, half = Math.min(.07 / L, .2), t0 = Math.max(0, t - half), t1 = Math.min(1, t + half);
                    b.quad(at(t0, lo, .075), at(t1, lo, .075), at(t1, hi, .075), at(t0, hi, .075), frame, 'm', [nx, 0, nz]);
                }
                for (let y = lo + 1.2; y + .14 <= hi; y += 1.2)
                    b.quad(at(0, y, .075), at(1, y, .075), at(1, y + .14, .075), at(0, y + .14, .075), frame, 'm', [nx, 0, nz]);
            }
        } else if (L > 2) {
            // Existing shop-level glazing, bounded by each real wall segment.
            const t = Math.min(.35 / L, .15);
            b.quad(at(t, .5, .055), at(1 - t, .5, .055), at(1 - t, 3.7, .055), at(t, 3.7, .055), glass, 'g', [nx, 0, nz]);
        }
    });
    b.colPolygon(outline, { y1: H });
    // The entrance roof feature stands on the mall wall, above the actual recess.
    // Its open shoulders and central sign glass follow the reference silhouette.
    const x = p.entranceX, z = p.entranceFrontZ - .055, hw = p.gableHalfWidthM, y = p.gableSpringM;
    for (const side of [-1, 1]) b.box(x + side * (hw - .22), H, z + .16, .44, y - H, .36, stone);
    b.strut([x - hw, y, z + .16], [x, p.gablePeakM, z + .16], .36, .5, stone);
    b.strut([x, p.gablePeakM, z + .16], [x + hw, y, z + .16], .36, .5, stone);
    b.box(x, H, z + .13, 7.6, 3.65, .22, glass, { mat: 'g' });
    for (let u = -3.8; u <= 3.801; u += .95) b.box(x + u, H, z - .005, .10, 3.65, .045, frame);
    for (let v = H; v < H + 3.66; v += .73) b.box(x, v, z - .005, 7.6, .10, .045, frame);
    b.text('BELLEVUE', x, 16.75, z - .07, Math.PI, 1.1, '#e0e2de', { d: .025 });
    b.text('SQUARE', x, 15.35, z - .07, Math.PI, 1.1, '#e0e2de', { d: .025 });
    // Roof feature is physically solid where the visible frame and glazing stand.
    b.colPolygon([[x-3.8,z+.02],[x+3.8,z+.02],[x+3.8,z+.24],[x-3.8,z+.24]], { y0:H, y1:H+3.65 });
    b.cols.at(-1).minH=H; delete b.cols.at(-1).y0;
    for (const side of [-1,1]) {
        b.col(x+side*(hw-.22),z+.16,.22,.18,0,{minH:H,y1:y});
        // Short bands retain the slope instead of blocking the open shoulders.
        for(let i=0;i<26;i++) {
            const u0=i/26*hw,u1=(i+1)/26*hw;
            const lo=p.gablePeakM-(p.gablePeakM-y)*u1/hw-.23;
            const hi=p.gablePeakM-(p.gablePeakM-y)*u0/hw+.23;
            b.col(x+side*(u0+u1)/2,z+.16,(u1-u0)/2+.12,.18,0,{minH:lo,y1:hi});
        }
    }
    b.sourceMassAudit = { ...(b.sourceMassAudit || {}), bellevueSquare: {
        sourceIds: p.sourceIds, outline, macys, bodyHeightM:H, heightStatus:p.policy,
        sourceEntranceNode:5752777692, facadeStatus:'Source recess with photo-led estimated facade/gable; not a surveyed elevation.'
    } };
}
