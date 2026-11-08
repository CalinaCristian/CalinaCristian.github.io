// buildLandmark has already rotated its local colliders with the model.
// Tourist scenes only translate that exact solid and its vertical bands.
export function translatedLandmarkCollider(source, anchor, baseY, fallbackHeight = 60, landmark) {
    const ring = points => points.map(([x, z]) => [anchor.x + x, anchor.z + z]);
    return {
        ...source, x: anchor.x + source.x, z: anchor.z + source.z,
        r: source.r ?? Math.hypot(source.hw, source.hd), landmark,
        y0: baseY + (source.y0 ?? -1), y1: baseY + (source.y1 ?? source.h ?? fallbackHeight),
        ...(source.h !== undefined ? { h: baseY + source.h } : {}),
        ...(source.minH !== undefined ? { minH: baseY + source.minH } : {}),
        ...(source.poly ? { poly: ring(source.poly), holes: (source.holes || []).map(ring) } : {}),
    };
}
