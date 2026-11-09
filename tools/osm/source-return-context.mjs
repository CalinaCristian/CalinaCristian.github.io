// Explicit immutable context retained while a bounded district source graph is
// rebuilt. Current literal source records win. This does not certify physical
// clearance of a retained crown's inferred trunk against an estimated road.
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const require = (ok, reason) => { if (!ok) throw Error('reviewed source context: ' + reason); };

export function preserveReviewedSourceContext(doc, review, surveyBytes) {
    if (review == null) return null;
    require(review.schema === 1 && /^[a-f0-9]{40}$/.test(review.sourceDataCommit || '') &&
        /^[a-f0-9]{64}$/.test(review.sourceDataSha256 || ''), 'missing immutable prior source');
    require(same(doc.proj, review.projection), 'projection differs; no coordinate conversion is permitted');
    require(Array.isArray(review.waterAreas) && Array.isArray(review.measuredCrowns), 'missing explicit retained records');
    const result = { sourceDataCommit: review.sourceDataCommit, sourceDataSha256: review.sourceDataSha256,
        surveySha256: review.surveySha256, waterAreas: [], measuredCrowns: [], physicalClearance: 'unresolved; source records retained' };
    for (const area of review.waterAreas) {
        require(/^[wr][1-9]\d*$/.test(area.sourceId || '') && area.kind === 'water' &&
            Array.isArray(area.ringsDm) && area.ringsDm.length && area.ringsDm.every(r =>
                Array.isArray(r) && r.length >= 6 && !(r.length % 2) && r.every(Number.isSafeInteger)), 'invalid retained water source');
        if (doc.areaSourceIds.includes(area.sourceId)) {
            result.waterAreas.push({ sourceId: area.sourceId, status: 'current-source-present; prior record not substituted' });
            continue;
        }
        const water = doc.areaKinds.indexOf('water'); require(water >= 0, 'water class unavailable');
        let name = -1;
        if (area.name) { name = doc.strings.indexOf(area.name); if (name < 0) { name = doc.strings.length; doc.strings.push(area.name); } }
        const index = doc.areas.length;
        doc.areas.push([water, name, ...structuredClone(area.ringsDm)]); doc.areaSourceIds.push(area.sourceId);
        result.waterAreas.push({ sourceId: area.sourceId, index, status: 'unchanged-prior-source-context' });
    }
    if (review.measuredCrowns.length) {
        require(surveyBytes && sha(surveyBytes) === review.surveySha256, 'measured survey hash differs');
        const survey = JSON.parse(surveyBytes), projection = doc.proj;
        require(survey._retention === 'all-measured' && doc.treeRetention?.policy === 'all-measured', 'retained measured-crown policy unavailable');
        const packed = new Map(Array.from({ length: doc.trees.length / 3 }, (_, i) => [doc.trees.slice(i * 3, i * 3 + 3).join(','), i]));
        for (const crown of review.measuredCrowns) {
            require(Number.isSafeInteger(crown.surveyIndex) && same(survey.trees[crown.surveyIndex], crown.rawSurveyCrown), 'literal survey crown differs');
            const [lat, lon, radius] = crown.rawSurveyCrown;
            require([lat, lon, radius].every(Number.isFinite) && radius > 0, 'invalid literal survey crown');
            const expected = [Math.round((lon - projection.lon0) * projection.mPerLon * projection.scale * 10),
                Math.round((projection.lat0 - lat) * projection.mPerLat * projection.scale * 10),
                Math.round(Math.max(5, Math.min(22, 2.3 * radius + 2.5)) * 10) * 2];
            require(same(expected, crown.packed) && crown.crownRadiusDm === Math.round(radius * 10) &&
                same(crown.treeInfo, [-1, 0, 37]), 'prior packed crown differs from unchanged survey compilation');
            const key = expected.join(',');
            if (packed.has(key)) {
                const existing = packed.get(key);
                require(same(doc.treeInfo.slice(existing * 3, existing * 3 + 3), crown.treeInfo) &&
                    doc.treeCrownRadii[existing] === crown.crownRadiusDm, 'current source tree conflicts with prior crown; no override is permitted');
                result.measuredCrowns.push({ surveyIndex: crown.surveyIndex, status: 'already-present' }); continue;
            }
            const index = doc.trees.length / 3;
            doc.trees.push(...expected); doc.treeInfo.push(...crown.treeInfo); doc.treeCrownRadii.push(crown.crownRadiusDm);
            packed.set(key, index); doc.treeRetention.retained++; doc.treeRetention.rejectedGeometryOrDuplicate--;
            result.measuredCrowns.push({ surveyIndex: crown.surveyIndex, index, status: 'unchanged-prior-source-crown',
                unresolved: 'broad inferred-road filter is not an actual-source trunk-clearance certificate' });
        }
        require(doc.treeRetention.rejectedGeometryOrDuplicate >= 0, 'inconsistent original exclusion accounting');
    }
    doc.sourceContextPreservation = result;
    return result;
}
