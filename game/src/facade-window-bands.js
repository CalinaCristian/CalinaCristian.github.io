// A non-shop face keeps one complete ground-storey row below the shop datum.
// Clip from the building's original datums, never restart UVs at a visibility cut.
export function nonShopWindowBands(lo, hi, base, shopTop, floorH, rows = 1) {
    const result = [];
    const groundTop = Math.min(hi, shopTop);
    if (groundTop > lo) result.push({y0:lo,y1:groundTop,v0:(lo-base)/((shopTop-base)*rows),v1:(groundTop-base)/((shopTop-base)*rows)});
    const upperBase = Math.max(lo, shopTop);
    if (hi > upperBase) result.push({y0:upperBase,y1:hi,v0:(upperBase-shopTop)/(floorH*rows),v1:(hi-shopTop)/(floorH*rows)});
    return result;
}
