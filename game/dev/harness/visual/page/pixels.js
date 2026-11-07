// ============================================================================
//  Visual QA — pixel detectors on rendered frames (ImageData, RGBA 8-bit).
//    road-dark-patch   the lane ahead (projected route strip, cockpit masked out) has > 8 % near-black pixels
//    road-sky-hole     sky-coloured pixels inside the lane ahead (holes in the road surface)
//    road-not-asphalt  most of the lane ahead is not grey asphalt (a wall / slab / grass / building drawn over it)
//    zfight            two renders with a 1 mm camera jitter differ in flat (non-edge) regions → coplanar surfaces fighting
// ============================================================================

export const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** rasterise a polygon list (screen px) into a Uint8Array mask w×h using a 2D canvas */
export function polyMask(w, h, polys) {
    const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#fff';
    for (const P of polys) { if (P.length < 3) continue; x.beginPath(); x.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) x.lineTo(P[i][0], P[i][1]); x.closePath(); x.fill(); }
    const d = x.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
    return m;
}

/**
 * Analyse the lane-ahead region.
 * img: ImageData (w×h), lane: Uint8Array mask, cockpit: Uint8Array mask (1 = cockpit pixel), skyRef: [r,g,b] | null
 */
export function analyseRoad(img, lane, cockpit, skyRef) {
    const { data: d, width: w, height: h } = img;
    let n = 0, dark = 0, sky = 0, colourful = 0, grey = 0;
    let bx0 = w, by0 = h, bx1 = 0, by1 = 0; // bbox of dark pixels
    let sx0 = w, sy0 = h, sx1 = 0, sy1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!lane[i] || (cockpit && cockpit[i])) continue;
        const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
        n++;
        const L = lum(r, g, b), mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
        if (L < 0.06) { dark++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
        if (skyRef && b > r && Math.abs(r - skyRef[0]) + Math.abs(g - skyRef[1]) + Math.abs(b - skyRef[2]) < 36) { sky++; if (x < sx0) sx0 = x; if (x > sx1) sx1 = x; if (y < sy0) sy0 = y; if (y > sy1) sy1 = y; }
        // shaded asphalt is sky-tinted (grey-blue, e.g. (38, 45, 63)): blue-dominant pixels of moderate saturation count
        // as asphalt in shade, not as grass / wall / brick (round 2: hue test instead of saturation alone)
        const blueShade = b >= r && b >= g && sat < 0.5 && L < 0.45;
        if (sat > 0.28 && L > 0.08 && !blueShade) colourful++;
        else if (sat < 0.2 || blueShade) grey++;
    }
    return {
        n, dark: n ? dark / n : 0, sky: n ? sky / n : 0, colourful: n ? colourful / n : 0, grey: n ? grey / n : 0,
        darkBox: dark ? [bx0, by0, bx1, by1] : null, skyBox: sky ? [sx0, sy0, sx1, sy1] : null,
    };
}

/** sky reference colour: median of blue-ish bright pixels in a band above the horizon (cockpit masked) */
export function skyColour(img, cockpit, horizonY) {
    const { data: d, width: w, height: h } = img;
    const y0 = Math.max(0, Math.floor(horizonY - h * 0.18)), y1 = Math.max(0, Math.floor(horizonY - h * 0.04));
    const rs = [], gs = [], bs = [];
    for (let y = y0; y < y1; y += 2) for (let x = 0; x < w; x += 3) {
        const i = y * w + x; if (cockpit && cockpit[i]) continue;
        const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
        if (b >= r && b >= g * 0.95 && lum(r, g, b) > 0.3) { rs.push(r); gs.push(g); bs.push(b); }
    }
    if (rs.length < 200) return null;
    const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
    return [med(rs), med(gs), med(bs)];
}

/**
 * Z-fight diff of two renders of the same view (1 mm camera jitter). Ignores edges (local contrast) and the cockpit.
 * returns { frac, blocks: [{x,y,w,h,changed}], box }
 */
export function zfightDiff(a, b, cockpit, { block = 24, thr = 48, edgeThr = 26, blockFrac = 0.12 } = {}) {
    const { width: w, height: h } = a, A = a.data, Bd = b.data;
    const L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) L[i] = A[i * 4] * 0.3 + A[i * 4 + 1] * 0.59 + A[i * 4 + 2] * 0.11;
    const bw = Math.ceil(w / block), bh = Math.ceil(h / block);
    const cnt = new Uint32Array(bw * bh), tot = new Uint32Array(bw * bh);
    let changed = 0, valid = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (cockpit && cockpit[i]) continue;
        // edge mask: 3×3 contrast in the first frame
        const c = L[i];
        const e = Math.max(Math.abs(L[i - 1] - c), Math.abs(L[i + 1] - c), Math.abs(L[i - w] - c), Math.abs(L[i + w] - c), Math.abs(L[i - w - 1] - c), Math.abs(L[i + w + 1] - c), Math.abs(L[i - w + 1] - c), Math.abs(L[i + w - 1] - c));
        if (e > edgeThr) continue;
        valid++;
        const k = Math.floor(y / block) * bw + Math.floor(x / block); tot[k]++;
        const dd = Math.abs(A[i * 4] - Bd[i * 4]) + Math.abs(A[i * 4 + 1] - Bd[i * 4 + 1]) + Math.abs(A[i * 4 + 2] - Bd[i * 4 + 2]);
        if (dd > thr) { changed++; cnt[k]++; }
    }
    const blocks = [];
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let k = 0; k < cnt.length; k++) {
        if (tot[k] < block * block * 0.25 || cnt[k] / tot[k] < blockFrac || cnt[k] < 20) continue;
        const bx = (k % bw) * block, by = Math.floor(k / bw) * block;
        blocks.push({ x: bx, y: by, w: block, h: block, changed: cnt[k] });
        x0 = Math.min(x0, bx); y0 = Math.min(y0, by); x1 = Math.max(x1, bx + block); y1 = Math.max(y1, by + block);
    }
    return { frac: valid ? changed / valid : 0, blocks, box: blocks.length ? [x0, y0, Math.min(w, x1), Math.min(h, y1)] : null };
}
