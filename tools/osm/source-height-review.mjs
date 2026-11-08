import { parseMeasure } from '../../game/src/building-roofs.js';
import { footprintCoverage } from '../../game/src/building-parts.js';
import { sourceRing } from './source-footprints.mjs';

// Opt-in reviewed input, never automatic outline/part dominance. A nearly
// identical complete literal ground part can constrain an untagged podium.
export function sourcePartHeightReview({ parentTags, parentRing, parentHoles = [], partTags, partRing, partHoles = [], review }) {
    if (!review || !Number.isFinite(review.heightM) || review.heightM <= 0) return null;
    const dimensions = ['height', 'min_height', 'building:levels', 'building:min_level', 'min_level', 'roof:height', 'roof:levels'];
    if (dimensions.some(k => parentTags[k] != null)) return null;
    if (!partTags?.['building:part'] || partTags['building:part'] === 'no' || parseMeasure(partTags.height) !== review.heightM) return null;
    if (['min_height', 'building:min_level', 'min_level'].some(k => partTags[k] != null && parseMeasure(partTags[k]) !== 0)) return null;
    // This reviewed way-only input does not assert an association across holes.
    if (parentHoles.length || partHoles.length) return null;
    const parent = sourceRing(parentRing), part = sourceRing(partRing);
    if (!parent.ring || !part.ring) return null;
    const coverage = footprintCoverage(parent.ring, [part.ring]);
    if (coverage.uncovered > Math.max(1e-4, coverage.area * 1e-8) || coverage.outside > coverage.area * .001) return null;
    return { heightM: review.heightM, sourceId: review.sourceId, kind: 'source-part-derived estimate', coverage };
}
