// A reviewed source survey has already selected distinct mapped/measured crowns.
// Its exact centres must not be reinterpreted as a coarse planting grid or bank setback.
export function sourceTreeCentrePolicy(kind, retention) {
    return kind === 'osm' && retention?.policy === 'all-measured';
}

export function treeCentreDuplicate(x, z, sourceCentre, coarseSeen, exactSeen) {
    return sourceCentre ? exactSeen.has(`${x},${z}`) : coarseSeen.has(`${Math.round(x / 1.6)},${Math.round(z / 1.6)}`);
}

export function treeCentreWater(x, z, sourceCentre, isWater, nearWater) {
    return sourceCentre ? isWater(x, z) : nearWater(x, z, 2);
}
