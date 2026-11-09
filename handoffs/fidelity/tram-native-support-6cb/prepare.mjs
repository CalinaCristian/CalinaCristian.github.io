// Exact minimal runtime archive plus separately pinned cached raw bridge footprint.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFiles } from '../../../tools/osm/parse-osm.mjs';
import { tramProjection } from '../../../tools/osm/tram-sources.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '../../..');
const archive = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), commit = '6cbf82b61de8267f662bf50239c37ccc1764635c';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const git = args => execFileSync('git', args, { cwd: repo, maxBuffer: 100 * 1024 * 1024 });
if (fs.existsSync(archive) || fs.existsSync(out)) throw Error('Refuse to overwrite an earlier archive/output');
fs.mkdirSync(archive, { recursive: true }); fs.mkdirSync(out, { recursive: true });
const listing = git(['ls-tree', '-r', '-z', commit, '--', 'game/src', 'game/data', 'game/vendor', 'game/assets', 'public', 'package.json', 'game/index.html', 'game/style.css']).toString().split('\0').filter(Boolean), files = {};
for (const row of listing) {
    const [head, name] = row.split('\t'), [mode, type, gitBlobSha1] = head.split(' '); if (type !== 'blob' || mode === '120000') throw Error('Unsupported runtime entry ' + row);
    const bytes = git(['show', commit + ':' + name]), target = path.join(archive, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
    files[name] = { bytes: bytes.length, gitBlobSha1, sha256: sha(bytes) };
}
const manifest = { commit, gitTree: git(['rev-parse', commit + '^{tree}']).toString().trim(), preparedUtc: new Date().toISOString(),
    policy: 'Git blobs only; minimal runtime src/data/vendor/assets/index/style/public/package. Excludes unused overview/research/dev and handoff files; every served file must match this ledger. No source patches.', files };
fs.writeFileSync(path.join(archive, 'qa-source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.copyFileSync(path.join(archive, 'qa-source-manifest.json'), path.join(out, 'source-manifest.json'));
const cache = '/workspace/reality-pass/grozavesti/tiles', xml = fs.readdirSync(cache).filter(f => f.endsWith('.xml')).sort().map(f => path.join(cache, f));
const ledger = xml.map(file => { const b = fs.readFileSync(file); return { file, bytes: b.length, sha256: sha(b) }; });
const osm = parseFiles(xml), way = osm.ways.get(902056192); if (!way) throw Error('Cached bridge footprint absent');
const d = JSON.parse(fs.readFileSync(path.join(archive, 'game/data/bucharest-grozavesti.json'))), project = tramProjection(d.proj);
const node = id => ({ nodeId: id, latLon: osm.nodes.get(id) || null, tags: osm.ntags.get(id) || {}, projectedXZ: osm.nodes.has(id) ? project(...osm.nodes.get(id)) : null });
const parents = [...osm.rels].filter(([, r]) => r.members.some(m => m.type === 'way' && m.ref === 902056192)).map(([id, r]) => ({ sourceId: 'r' + id, tags: r.tags, members: r.members,
    memberWays: r.members.filter(m => m.type === 'way').map(m => ({ ...m, sourceId: 'w' + m.ref, ...(osm.ways.has(m.ref) ? { tags: osm.ways.get(m.ref).tags, nodes: osm.ways.get(m.ref).nodes.map(node) } : { unresolved: 'missing cached source way' }) })) }));
const footprint = { sourceId: 'w902056192', type: 'way', tags: way.tags, nodeIds: way.nodes, nodes: way.nodes.map(node),
    rings: [{ role: 'outer', nodeIds: way.nodes, projectedXZ: way.nodes.map(id => node(id).projectedXZ) }], holes: [], parentRelations: parents,
    provenance: 'Literal cached OSM way polygon, raw tags and node coordinates; separate raw input, not a native world collider or measured height. Parent relation members/roles retained without synthetic ring assembly.', ledger };
for (const input of ledger) if (sha(fs.readFileSync(input.file)) !== input.sha256) throw Error('Cached source changed during preparation');
fs.writeFileSync(path.join(out, 'raw-bridge-polygon.json'), JSON.stringify(footprint, null, 2) + '\n');
for (const file of ['runner.cjs', 'native-support-dump.cjs']) fs.copyFileSync(path.join(here, file), path.join(out, file));
fs.copyFileSync(path.join(repo, 'game/dev/harness/integration-browser-bounds.cjs'), path.join(out, 'integration-browser-bounds.cjs'));
const toolFiles = ['runner.cjs', 'native-support-dump.cjs', 'integration-browser-bounds.cjs', 'raw-bridge-polygon.json', 'source-manifest.json'];
fs.writeFileSync(path.join(out, 'preparation.json'), JSON.stringify({ sourceCommit: commit, sourceGitTree: manifest.gitTree, preparedUtc: new Date().toISOString(), archive, out,
    copiedFiles: listing.length, copiedBytes: Object.values(files).reduce((n, f) => n + f.bytes, 0), toolHashes: Object.fromEntries(toolFiles.map(f => [f, sha(fs.readFileSync(path.join(out, f)))])),
    preparationToolSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), parserSha256: sha(fs.readFileSync(path.join(repo, 'tools/osm/parse-osm.mjs'))),
    projectionToolSha256: sha(fs.readFileSync(path.join(repo, 'tools/osm/tram-sources.mjs'))), sourceBridgeNodeCount: way.nodes.length, sourceBridgeParentRelations: parents.map(r => r.sourceId), networkUsed: false }, null, 2) + '\n');
console.log(JSON.stringify({ archive, out, copiedFiles: listing.length, copiedMiB: Object.values(files).reduce((n, f) => n + f.bytes, 0) / 1048576, rawBridgeTags: way.tags, rawBridgeNodeCount: way.nodes.length, parentRelations: parents.map(r => r.sourceId) }));
