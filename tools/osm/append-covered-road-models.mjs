// Append reviewed source metadata without rebuilding or rewriting source rows.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseFiles } from './parse-osm.mjs';
import { buildCoveredRoadModels } from '../../game/src/covered-road-models.js';

export function compileCoveredRoadModels(data, review, raw, sourceXmlSha256) {
    const P = data.proj, project = ([lat, lon]) => [(lon - P.lon0) * P.mPerLon * (P.scale || 1), -(lat - P.lat0) * P.mPerLat * (P.scale || 1)];
    const snapshot = id => {
        const w = raw.ways.get(Number(id.slice(1))); if (!w) throw Error('Missing source way ' + id);
        const coordinates = w.nodes.map(n => raw.nodes.get(n)); if (coordinates.some(p => !p)) throw Error('Incomplete source way ' + id);
        const points = w.nodes[0] === w.nodes.at(-1) ? coordinates.slice(0, -1) : coordinates;
        return { sourceId: id, nodeIds: [...w.nodes], tags: { ...w.tags }, nodeTags: Object.fromEntries(w.nodes.filter(n => raw.ntags.has(n)).map(n => [n, raw.ntags.get(n)])), wgs84: coordinates, projected: points.map(project) };
    };
    const records = review.models.map(rule => {
        const ids = new Set([rule.sourceRoadId, ...rule.groundJoins.flatMap(j => [j.anchorRoadId, ...j.ways.map(w => w[0])])]);
        return { ...rule, schemaVersion: 1, classification: 'reviewed-source-building-covered-road', reviewedAt: review.reviewedAt, sourceXmlSha256,
            sourceWays: [...ids].map(snapshot), sourceBodies: [rule.sourceBuildingId, ...rule.sourcePartIds].map(snapshot) };
    });
    const validation = buildCoveredRoadModels({ ...data, reviewedCoveredRoads: records });
    if (validation.report.unresolved.length || validation.report.models.length !== records.length) throw Error(JSON.stringify(validation.report));
    return records;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [file, reviewFile, ...xmlFiles] = process.argv.slice(2); if (!xmlFiles.length) throw Error('dataset.json review.json source.xml [...] required');
    const original = fs.readFileSync(file, 'utf8'), data = JSON.parse(original), review = JSON.parse(fs.readFileSync(reviewFile, 'utf8')), raw = parseFiles(xmlFiles);
    const sourceXmlSha256 = xmlFiles.length === 1 ? crypto.createHash('sha256').update(fs.readFileSync(xmlFiles[0])).digest('hex') : crypto.createHash('sha256').update(xmlFiles.map(p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')).sort().join('\n')).digest('hex');
    const records = compileCoveredRoadModels(data, review, raw, sourceXmlSha256), field = ',"reviewedCoveredRoads":', trimmed = original.trimEnd();
    let prefix = trimmed.slice(0, -1);
    if (Object.hasOwn(data, 'reviewedCoveredRoads')) {
        const at = trimmed.lastIndexOf(field); if (at < 0 || !trimmed.endsWith(JSON.stringify(data.reviewedCoveredRoads) + '}')) throw Error('Metadata must be the final compact field; refusing to rewrite original source bytes');
        prefix = trimmed.slice(0, at);
    }
    const output = prefix + field + JSON.stringify(records) + '}\n', after = JSON.parse(output); delete after.reviewedCoveredRoads; delete data.reviewedCoveredRoads;
    if (JSON.stringify(after) !== JSON.stringify(data)) throw Error('Source rows changed');
    if (output !== original) fs.writeFileSync(file, output);
    console.log(JSON.stringify({ models: records.length, originalSourcePrefixSha256: crypto.createHash('sha256').update(prefix + '}\n').digest('hex'), sourceXmlSha256, datasetBytes: Buffer.byteLength(output) }));
}
