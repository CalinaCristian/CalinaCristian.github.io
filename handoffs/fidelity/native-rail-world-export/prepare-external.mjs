// Verify and reuse another lane's immutable archive read-only. Never add/substitute a source file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '../../..'), args = {};
for (let i = 2; i < process.argv.length; i++) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
if (!/^[a-f0-9]{40}$/.test(args.source || '') || !args.archive || !args.provenance || !args.out || !args.districts) throw Error('Use --source FULLSHA --archive EXISTING --provenance OWNER_LEDGER --districts unirii --out NEWPATH');
const archive = path.resolve(args.archive), out = path.resolve(args.out), ownerBytes = fs.readFileSync(args.provenance), owner = JSON.parse(ownerBytes), districts = args.districts.split(',');
if (fs.existsSync(out)) throw Error('Refuse to overwrite native evidence');
const git = a => execFileSync('git', a, { cwd: repo, maxBuffer: 64 * 1024 * 1024 }), sha = b => crypto.createHash('sha256').update(b).digest('hex');
if (owner.sourceCommit !== args.source || path.resolve(owner.sourceRoot) !== archive || !Array.isArray(owner.files)) throw Error('Owner source ledger mismatch');
const blobs = new Map(git(['ls-tree', '-r', '-z', args.source]).toString().split('\0').filter(Boolean).map(row => { const [head, name] = row.split('\t'); return [name, head.split(' ')[2]]; })), files = {};
for (const r of owner.files) {
    const full = path.resolve(archive, r.path); if (!full.startsWith(archive + path.sep) || !fs.lstatSync(full).isFile()) throw Error('Unexpected source entry ' + r.path);
    const b = fs.readFileSync(full), blob = crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex');
    if (b.length !== r.bytes || sha(b) !== r.sha256 || blob !== r.gitBlobSha1 || blob !== blobs.get(r.path)) throw Error('Source/hash/Git mismatch ' + r.path);
    if (files[r.path]) throw Error('Duplicate owner ledger path ' + r.path); files[r.path] = { bytes: b.length, sha256: sha(b), gitBlobSha1: blob };
}
for (const district of districts) if (!files['game/data/bucharest-' + district + '.json']) throw Error('Selected district absent from exact archive ' + district);
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.relative(archive, path.join(dir, e.name))]);
if (JSON.stringify(walk(archive).sort()) !== JSON.stringify(Object.keys(files).sort())) throw Error('Physical archive contains unledgered or missing files');
fs.mkdirSync(out, { recursive: true });
const manifest = { commit: args.source, gitTree: git(['rev-parse', args.source + '^{tree}']).toString().trim(), districts, verifiedUtc: new Date().toISOString(),
    policy: 'Existing external archive reused read-only; every physical file and owner SHA/Gitblob reverified against exact Git source. No source additions/substitutions.', files };
fs.writeFileSync(path.join(out, 'source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n'); fs.writeFileSync(path.join(out, 'source-owner-provenance.json'), ownerBytes);
const toolNames = ['runner.cjs', 'geometry-kernel.cjs', 'decode-geometry.cjs', 'install-observer.cjs']; for (const f of toolNames) fs.copyFileSync(path.join(here, f), path.join(out, f));
fs.writeFileSync(path.join(out, 'integration-browser-bounds.cjs'), git(['show', args.source + ':game/dev/harness/integration-browser-bounds.cjs']));
const toolHashes = Object.fromEntries([...toolNames, 'integration-browser-bounds.cjs'].map(f => [f, sha(fs.readFileSync(path.join(out, f)))]));
fs.writeFileSync(path.join(out, 'preparation.json'), JSON.stringify({ sourceCommit: args.source, sourceGitTree: manifest.gitTree, archive, out, districts, copiedFiles: Object.keys(files).length,
    copiedBytes: Object.values(files).reduce((n, r) => n + r.bytes, 0), archiveReusedReadOnly: true, sourceFilesWritten: 0, verifiedUtc: manifest.verifiedUtc,
    ownerProvenancePath: path.resolve(args.provenance), ownerProvenanceSha256: sha(ownerBytes), toolHashes, preparationToolSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), browserLaunched: false }, null, 2) + '\n');
console.log(JSON.stringify({ sourceCommit: args.source, archive, out, districts, verifiedFiles: Object.keys(files).length, sourceFilesWritten: 0 }));
