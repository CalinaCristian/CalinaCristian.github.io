// The outline is an envelope, not a second solid through every mapped terminal part.
import { footprintCells, bakeSourceSolidSurface, ringArea } from './building-parts.js';
import { OTP_PIER_PARTS } from './landmark-otp-source.js';

export function otpPierVolumes(outline, sourceBuildings = {}) {
    const parts = OTP_PIER_PARTS.map((fallback, i) => {
        const source = sourceBuildings[fallback.sourceId]?.[0] || fallback;
        return { ...fallback, ring: source.ring, holes: source.holes || [], h: source.h, minH: source.minH, i };
    });
    const masks = parts.flatMap(p => [p.ring, ...p.holes]);
    const ranges = []; let next = 0;
    for (const p of parts) { ranges.push({ outer: next++, holes: p.holes.map(() => next++) }); }
    const residuals = footprintCells(outline, masks).filter(cell => !ranges.some(p => cell.covered.includes(p.outer) && !p.holes.some(h => cell.covered.includes(h)))).map((cell, i) => ({
        sourceId: 'w771096083:residual', ring: cell.ring, holes: [], minH: 0, h: 14.6, kind: 'pier', i: parts.length + i,
        heightSource: 'Prior authored 14.6 m envelope estimate, only outside mapped parts'
    }));
    return [...parts, ...residuals];
}

export function buildOTPPier(b, outline, sourceBuildings, roofZones, profiles) {
    const volumes = otpPierVolumes(outline, sourceBuildings);
    for (const volume of volumes) {
        const surface = bakeSourceSolidSurface(volume, volumes), bridge = volume.kind === 'bridge';
        const wallColour = bridge ? '#c9ced2' : '#6f91a8', mat = bridge ? 'm' : 'g';
        function walls(ring, bands, hole = false) {
            const sign = Math.sign(ringArea(ring)) * (hole ? -1 : 1);
            ring.forEach((a, i) => {
                const end = ring[(i + 1) % ring.length], dx = end[0] - a[0], dz = end[1] - a[1];
                const at = (t, y) => [a[0] + dx * t, y, a[1] + dz * t];
                for (const band of bands[i]) {
                    b.quad(at(band.t0, band.y0), at(band.t1, band.y0), at(band.t1, band.y1), at(band.t0, band.y1), wallColour, mat, [sign * dz, 0, -sign * dx]);
                }
            });
        }
        walls(volume.ring, surface.walls);
        volume.holes.forEach((ring, i) => walls(ring, surface.holeWalls[i], true));
        for (const ring of surface.roof) {
            if (bridge) b.cap(ring, volume.h, '#e3e6e8');
            else roofZones(ring, volume.h, volume.sourceId === 'w1321861231' ? profiles.spine : profiles.pier);
        }
        for (const ring of surface.underside) b.cap(ring, volume.minH, '#c9ced2', [], -1);
        b.colPolygon(volume.ring, { holes: volume.holes, y0: volume.minH, y1: volume.h });
    }
    b.sourceMassAudit = { ...(b.sourceMassAudit || {}), otpPier: { literalParts: OTP_PIER_PARTS.length, residuals: volumes.length - OTP_PIER_PARTS.length, sourceIds: OTP_PIER_PARTS.map(p => p.sourceId), policy: 'Exact source part footprints and height/minimum bands; estimated outline only fills residual plan area. Exposed union faces share ownership.' } };
}
