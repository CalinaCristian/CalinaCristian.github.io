#!/usr/bin/env node
// Metadata-only cached-source extractor. Never regenerates buildings/roads/tracks or changes generated dates.
// Usage: node add-tram-source-metadata.mjs --data FILE --osm CACHED_XML_DIR [--write] [--report FILE]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseFiles } from './parse-osm.mjs';
import { extractTramMetadata, appendTramMetadata, TRAM_SOURCE_FIELDS } from './tram-sources.mjs';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

export function addTramSourceMetadata({ dataFile, osmDir, write = false, reportFile }) {
    const original = fs.readFileSync(dataFile, 'utf8'), doc = JSON.parse(original);
    const files = fs.readdirSync(osmDir).filter(f => f.endsWith('.xml')).sort().map(f => path.join(osmDir, f));
    if (!files.length) throw Error('No cached OSM XML; network is never invoked by this extractor');
    const ledger = files.map(file => { const bytes = fs.readFileSync(file); return { file, bytes: bytes.length, sha256: sha(bytes) }; });
    const metadata = extractTramMetadata(doc, parseFiles(files)), updated = appendTramMetadata(original, metadata);
    for (const input of ledger) if (sha(fs.readFileSync(input.file)) !== input.sha256) throw Error('Cached source changed while extracting; refusing dataset write: ' + input.file);
    const report = { dataFile, osmDir, inputSha256: sha(original), outputSha256: sha(updated), written: write, cachedInputsReverified: true, sourceSelection: 'Existing parse-osm first occurrence from sorted cached XML; no network or source synthesis', generatedUnchanged: JSON.parse(updated).generated === doc.generated, existingFieldsUnchanged: true, originalPrefixBytesUnchanged: updated.startsWith(original.slice(0, original.match(/}\s*$/).index)), renderedTrams: doc.trams?.length || 0, renderedTramsSha256: sha(JSON.stringify(doc.trams)), addedFields: Object.keys(metadata), sourceWays: metadata.tramSourceWays?.length || 0, routes: metadata.tramRoutes?.length || 0, taggedNodes: Object.keys(metadata.tramSourceNodeTags || {}).length, missingNodeWays: (metadata.tramSourceWays || []).filter(w => w.missingNodeIds?.length).map(w => ({ sourceId: w.sourceId, missingNodeIds: w.missingNodeIds })), routeMissingWays: (metadata.tramRoutes || []).filter(r => r.missingWayIds?.length).map(r => ({ sourceId: r.sourceId, missingWayIds: r.missingWayIds })), renderSources: metadata.tramSources?.map(r => ({ sourceId: r.sourceId, nodeIds: r.nodeIds })) || [], ledger };
    if (write && updated !== original) fs.writeFileSync(dataFile, updated);
    if (reportFile) { fs.mkdirSync(path.dirname(reportFile), { recursive: true }); fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n'); }
    return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const args = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) args[k.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
    if (!args.data || !args.osm) throw Error('Usage: --data FILE --osm CACHED_XML_DIR [--write] [--report FILE]');
    const r = addTramSourceMetadata({ dataFile: path.resolve(args.data), osmDir: path.resolve(args.osm), write: !!args.write, reportFile: args.report && path.resolve(args.report) });
    console.log(JSON.stringify({ dataFile: r.dataFile, written: r.written, renderedTrams: r.renderedTrams, sourceWays: r.sourceWays, routes: r.routes, taggedNodes: r.taggedNodes, missingNodeWays: r.missingNodeWays.length, addedFields: TRAM_SOURCE_FIELDS.filter(k => r.addedFields.includes(k)) }));
}
