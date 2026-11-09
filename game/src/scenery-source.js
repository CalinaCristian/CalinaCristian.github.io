import { parseMeasure } from './building-roofs.js';
import { validRoadWidthReview } from './road-widths.js';

/** Reuse lossless source scenery only when it describes this exact packed row. */
export function scenerySourceProfile(data, index, legacyPoints) {
    const row = data.scenery[index], packed = Number.isFinite(row[0]) && row[0] > 0 ? row[0] / 10 : 0;
    const half = Math.max(2.2, packed / 2), fallback = { points: legacyPoints, precise: false, widthM: half * 2, leftM: half, rightM: half, lineOffsetM: 0, widthSource: 'estimate:legacy scenery width' };
    if (data.roadGeometryPolicy !== 'source') return fallback;
    const source = data.scenerySourceGeometry?.[index], points = source?.prepared;
    let issue = null;
    if (!/^w\d+$/.test(source?.sourceId || '') || !Array.isArray(points) || points.length < 2 || points.length * 2 !== row.length - 4) issue = 'missing or misaligned precise scenery source';
    else {
        let x = 0, z = 0;
        for (let i = 0; i < points.length; i++) {
            x += row[4 + i * 2]; z += row[5 + i * 2];
            const p = points[i];
            if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.round(p[0] * 10) !== x || Math.round(p[1] * 10) !== z) { issue = 'precise scenery points do not match packed row'; break; }
        }
    }
    if (issue) return { ...fallback, issue, sourceId: source?.sourceId };
    const cached = Object.values(data.roadWidths || {}).find(p => p.sourceId === source.sourceId);
    const review = [source.widthReview, cached?.review].find(r => validRoadWidthReview(r) && r.sourceRoadId === source.sourceId);
    const literal = parseMeasure(source.tags?.width), widthM = literal > 0 ? literal : review?.widthM;
    if (!(widthM > 0)) return { ...fallback, points, precise: true, sourceId: source.sourceId };
    // Literal source width wins even if a class default, minimum width or review disagrees.
    const aligned = cached && Math.abs(cached.widthM - widthM) < 1e-8 && Number.isFinite(cached.leftM) && Number.isFinite(cached.rightM) && cached.leftM >= 0 && cached.rightM >= 0 && Math.abs(cached.leftM + cached.rightM - widthM) < .02;
    return {
        points, precise: true, sourceId: source.sourceId, widthM,
        leftM: aligned ? cached.leftM : widthM / 2, rightM: aligned ? cached.rightM : widthM / 2,
        lineOffsetM: aligned && Number.isFinite(cached.laneCenterShiftM) ? cached.laneCenterShiftM : 0,
        widthSource: literal > 0 ? 'OSM width' : review.source,
        ...(literal > 0 ? { rawWidth: source.tags.width } : { review }),
        ...((source.tags?.placement || source.tags?.['placement:forward'] || source.tags?.['placement:backward']) && !aligned ? { issue: 'source placement retained; no resolved lateral-width cache for this scenery way' } : {}),
    };
}
