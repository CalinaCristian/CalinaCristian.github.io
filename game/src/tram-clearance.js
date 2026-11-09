// Read actual native transit component vertices; nominal width/height metadata
// omits small trim and the raised pantograph. No live actor or traffic RNG is
// created/consumed; ordinary Three.js geometry UUIDs keep their native policy.
export function emittedTramClearance(makeVehicle, city = 'bucharest') {
    const limit = Math.atan(.08), envelope = { halfWidthM: 0, minY: Infinity, maxY: -Infinity, tiltedMinY: Infinity, tiltedMaxY: -Infinity,
        maxGrade: .08, kinds: ['tram-v3a', 'tram-imperio'], basis: 'literal native emitted tram component vertices; fixed paint, no instanced/live actors; no clearance padding' };
    for (const kind of envelope.kinds) {
        const group = makeVehicle(kind, '#ffffff', { city }); group.updateMatrixWorld(true);
        group.traverse(part => {
            const positions = part.geometry?.attributes?.position; if (!positions) return;
            const m = part.matrixWorld.elements;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Z = m[2] * x + m[6] * y + m[10] * z + m[14];
                envelope.halfWidthM = Math.max(envelope.halfWidthM, Math.abs(X)); envelope.minY = Math.min(envelope.minY, Y); envelope.maxY = Math.max(envelope.maxY, Y);
                const critical = Math.atan2(-Z, Y), pitches = [-limit, 0, limit]; if (Math.abs(critical) < limit) pitches.push(critical);
                for (const pitch of pitches) { const h = Y * Math.cos(pitch) - Z * Math.sin(pitch); envelope.tiltedMinY = Math.min(envelope.tiltedMinY, h); envelope.tiltedMaxY = Math.max(envelope.tiltedMaxY, h); }
            }
        });
    }
    return envelope;
}
