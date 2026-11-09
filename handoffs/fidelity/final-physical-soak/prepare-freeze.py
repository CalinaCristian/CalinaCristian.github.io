#!/usr/bin/env python3
"""Archive an explicitly supplied FINAL source. Does not launch a browser.

Usage: python prepare-freeze.py FULL_FINAL_SHA NEW_EVIDENCE_BASE
Run only after root supplies the final freeze; never reuse an old evidence base.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tarfile

REPO = Path(__file__).resolve().parents[3]
if len(sys.argv) != 3 or not re.fullmatch(r'[a-f0-9]{40}', sys.argv[1]):
    raise SystemExit('Supply the actual full FINAL freeze SHA and a new evidence base directory.')
revision = sys.argv[1]
base = Path(sys.argv[2]).resolve()
if base.exists():
    raise SystemExit(f'Preserve existing evidence; destination already exists: {base}')

def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO)

actual = git('rev-parse', revision + '^{commit}').decode().strip()
if actual != revision:
    raise SystemExit('The requested revision did not resolve to its exact commit.')
tool_commit = git('rev-parse', 'HEAD').decode().strip()
paths = ['game/src', 'game/dev', 'game/data', 'game/vendor', 'game/assets',
         'game/index.html', 'game/style.css', 'game/meta', 'game/package.json',
         'public', 'index.html']
paths = [p for p in paths if git('ls-tree', '--name-only', revision, p).strip()]
base.mkdir(parents=True)
runtime, out = base / 'source', base / 'raw'
runtime.mkdir()
out.mkdir()
archive = base / 'source.tar'
with archive.open('wb') as output:
    subprocess.run(['git', 'archive', '--format=tar', revision, *paths],
                   cwd=REPO, stdout=output, check=True)
with tarfile.open(archive) as source:
    source.extractall(runtime, filter='data')
archive.unlink()

files, git_blobs = {}, {}
for row in git('ls-tree', '-r', '-z', revision, '--', *paths).split(b'\0'):
    if not row:
        continue
    meta, relative = row.split(b'\t', 1)
    mode, kind, object_id = meta.decode().split()
    relative = relative.decode()
    if kind != 'blob':
        raise SystemExit(f'Unexpected non-file runtime entry: {relative}')
    data = (runtime / relative).read_bytes()
    native_blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if native_blob != object_id:
        raise SystemExit(f'Archive bytes differ from the exact source commit: {relative}')
    files[relative] = hashlib.sha256(data).hexdigest()
    git_blobs[relative] = object_id

manifest = {'commit': revision, 'tree': git('rev-parse', revision + '^{tree}').decode().strip(),
            'files': files, 'gitBlobs': git_blobs, 'runtimePaths': paths,
            'scope': 'Exact committed game runtime plus public assets; overview galleries omitted.'}
(out / 'source-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

tools = {'runner.cjs': 'game/dev/harness/integration-district-final-soak.cjs',
         'integration-browser-bounds.cjs': 'game/dev/harness/integration-browser-bounds.cjs',
         'verify-district-soak.cjs': 'handoffs/fidelity/integration-final-acceptance/verify-district-soak.cjs'}
tool_hashes = {}
for output, source in tools.items():
    data = (REPO / source).read_bytes()
    committed = git('show', tool_commit + ':' + source)
    if data != committed:
        raise SystemExit(f'Uncommitted tool bytes cannot be silently frozen: {source}')
    (out / output).write_bytes(data)
    tool_hashes[output] = hashlib.sha256(data).hexdigest()

release = runtime / 'game/meta/release.json'
release_status = {'present': release.exists()}
if release.exists():
    shutil.copyfile(release, out / 'original-release.json')
    release_status['sha256'] = hashlib.sha256(release.read_bytes()).hexdigest()

command = ['node', str(out / 'runner.cjs'), str(runtime), str(out), '15']
plan = {'status': 'prepared-not-launched', 'preparedUtc': datetime.now(timezone.utc).isoformat(),
        'sourceCommit': revision, 'toolCommit': tool_commit, 'sourceRoot': str(runtime),
        'out': str(out), 'command': command, 'runnerSha256': tool_hashes['runner.cjs'],
        'toolSha256': tool_hashes, 'originalRelease': release_status,
        'environment': {'NODE_PATH': '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules',
                        'NODE_OPTIONS': '--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs',
                        'SOAK_WALLCLOCK': '1'},
        'scope': 'New combined-source native560/631 physical900 high/full true-mirror and evolved night/rain; never reuse historical c78 as this run.'}
(out / 'prepared.json').write_text(json.dumps(plan, indent=2) + '\n')
print(json.dumps({'sourceCommit': revision, 'sourceRoot': str(runtime), 'out': str(out),
                  'verifiedRuntimeFiles': len(files), 'command': command,
                  'browserLaunched': False}, indent=2))
