// Plan only with --dry-run. Actual freezing needs an explicit immutable source SHA.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '../../..'), args = {};
for (let i = 2; i < process.argv.length; i++) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
const commit = args.source; if (!/^[a-f0-9]{40}$/.test(commit || '')) throw Error('--source requires a full immutable Git commit SHA');
const git = a => execFileSync('git', a, { cwd: repo, maxBuffer: 128 * 1024 * 1024 });
if (git(['rev-parse', commit + '^{commit}']).toString().trim() !== commit) throw Error('Source is not the named commit');
const districts = (args.districts || 'grozavesti,romana').split(','); if (!districts.length || districts.some(s => !/^[a-z0-9-]+$/.test(s))) throw Error('Invalid district list');
const listing = git(['ls-tree', '-r', '-l', '-z', commit, '--', 'game/src', 'game/data', 'game/vendor', 'game/assets', 'public', 'package.json', 'game/index.html', 'game/style.css']).toString().split('\0').filter(Boolean).map(row => {
    const [head, name] = row.split('\t'), [mode, type, gitBlobSha1, bytes] = head.trim().split(/\s+/); return { name, mode, type, gitBlobSha1, bytes: Number(bytes) };
}).filter(r => !/^game\/data\/(bucharest|seattle)-.*\.json$/.test(r.name) || districts.some(d => r.name === `game/data/bucharest-${d}.json`));
for (const d of districts) if (!listing.some(r => r.name === `game/data/bucharest-${d}.json`)) throw Error('Missing selected source dataset ' + d);
const required = ['tram-grade.js', 'tram-body-support.js', 'tram-trench.js', 'tram-path.js', 'tram-source-signals.js'];
const missingInterfaces = required.filter(f => !listing.some(r => r.name === 'game/src/' + f));
const plan = { sourceCommit: commit, sourceGitTree: git(['rev-parse', commit + '^{tree}']).toString().trim(), districts, copiedFiles: listing.length, copiedBytes: listing.reduce((n, r) => n + r.bytes, 0),
    runtimeBlobs: listing, missingInterfaces, policy: 'Exact Git runtime blobs only. Other district datasets, overview/research/dev and handoffs excluded; no production patch. Archive/served responses checked with Gitblob SHA1 and SHA256.' };
if (args['dry-run']) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
if (missingInterfaces.length) throw Error('Combined source is not ready: missing ' + missingInterfaces.join(','));
if (!args.archive || !args.out) throw Error('Use --source FULLSHA --archive NEWPATH --out NEWPATH [--districts grozavesti,romana]');
const archive = path.resolve(args.archive), out = path.resolve(args.out); if (fs.existsSync(out) || (fs.existsSync(archive) && !args['reuse-archive'])) throw Error('Refuse to overwrite earlier source/output evidence');
if (!args['reuse-archive']) fs.mkdirSync(archive, { recursive: true }); fs.mkdirSync(out, { recursive: true }); const files = {};
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const existing = args['reuse-archive'] ? JSON.parse(fs.readFileSync(path.join(archive, 'qa-source-manifest.json'))) : null;
if (existing && (existing.commit !== commit || JSON.stringify(Object.keys(existing.files).sort()) !== JSON.stringify(listing.map(r => r.name).sort()))) throw Error('Existing archive source/file inventory differs from requested exact Git source');
for (const r of listing) {
    if (r.type !== 'blob' || r.mode === '120000') throw Error('Unsupported source entry ' + r.name);
    const target = path.join(archive, r.name), b = existing ? fs.readFileSync(target) : git(['show', commit + ':' + r.name]);
    if (existing) {
        const blob = crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex');
        if (blob !== r.gitBlobSha1 || sha(b) !== existing.files[r.name].sha256) throw Error('Existing archive changed: ' + r.name);
    } else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, b); }
    files[r.name] = { bytes: b.length, sha256: sha(b), gitBlobSha1: r.gitBlobSha1 };
}
const manifest = existing || { commit, gitTree: plan.sourceGitTree, districts, preparedUtc: new Date().toISOString(), policy: plan.policy, files };
if (!existing) fs.writeFileSync(path.join(archive, 'qa-source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n'); fs.copyFileSync(path.join(archive, 'qa-source-manifest.json'), path.join(out, 'source-manifest.json'));
const tools = ['runner.cjs', 'geometry-kernel.cjs', 'decode-geometry.cjs', 'install-observer.cjs']; for (const f of tools) fs.copyFileSync(path.join(here, f), path.join(out, f));
const bounds = git(['show', commit + ':game/dev/harness/integration-browser-bounds.cjs']); fs.writeFileSync(path.join(out, 'integration-browser-bounds.cjs'), bounds);
const toolHashes = Object.fromEntries([...tools, 'integration-browser-bounds.cjs'].map(f => [f, sha(fs.readFileSync(path.join(out, f)))]));
fs.writeFileSync(path.join(out, 'preparation.json'), JSON.stringify({ ...plan, runtimeBlobs: undefined, archive, out, copiedBytes: Object.values(files).reduce((n, f) => n + f.bytes, 0),
    preparedUtc: new Date().toISOString(), reusedVerifiedArchive: !!existing, toolHashes, preparationToolSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), browserLaunched: false, networkUsed: false }, null, 2) + '\n');
console.log(JSON.stringify({ sourceCommit: commit, archive, out, copiedFiles: listing.length, copiedMiB: Object.values(files).reduce((n, f) => n + f.bytes, 0) / 1048576, browserLaunched: false }));
