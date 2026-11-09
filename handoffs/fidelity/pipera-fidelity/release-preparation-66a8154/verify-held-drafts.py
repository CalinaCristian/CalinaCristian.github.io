"""Verify the safety bundle; optionally restore into a NEW private directory."""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import sys

base = Path(__file__).resolve().parent
data = json.loads(gzip.decompress((base / 'held-text-drafts.json.gz').read_bytes()))
output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
if output:
    if output.exists() or str(output).startswith('/workspace/fidelity-workers/'):
        raise SystemExit('Use a new private directory, never an existing worker')
    output.mkdir(parents=True)
for record in data['files']:
    payload = base64.b64decode(record['contentBase64'])
    assert len(payload) == record['bytes']
    assert hashlib.sha256(payload).hexdigest() == record['sha256']
    path = Path(record['path'])
    assert not path.is_absolute() and '..' not in path.parts
    if output:
        worker = Path(record['worktree']).name + '-' + hashlib.sha256(record['worktree'].encode()).hexdigest()[:8]
        target = output / worker / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        target.chmod(record['mode'])
print(json.dumps({'verifiedTextDrafts': len(data['files']),
                  'otherEntriesStillHeldInPlace': len(data['notCopiedStillHeld']),
                  'restoredToNewDirectory': str(output) if output else None,
                  'originalWorktreesChanged': False}))
