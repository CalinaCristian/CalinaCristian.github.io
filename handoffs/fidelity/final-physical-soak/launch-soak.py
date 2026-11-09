#!/usr/bin/env python3
"""Launch the reviewed Node runner after FINAL preparation; preserve PID/exit.

Usage: python launch-soak.py OUT FULL_FINAL_SHA
The parent must already have supplied this actual final freeze. No retries.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import subprocess
import sys

if len(sys.argv) != 3 or not re.fullmatch(r'[a-f0-9]{40}', sys.argv[2]):
    raise SystemExit('Supply prepared OUT and the actual full FINAL freeze SHA.')
out, revision = Path(sys.argv[1]).resolve(), sys.argv[2]
prepared = json.loads((out / 'prepared.json').read_text())
source = json.loads((out / 'source-manifest.json').read_text())
if prepared['sourceCommit'] != revision or source['commit'] != revision:
    raise SystemExit('The prepared source is not the supplied FINAL freeze.')
if (out / 'launch.json').exists() or (out / 'profile.json').exists():
    raise SystemExit('Preserve existing run evidence; this OUT has already been launched.')
for name, expected in prepared['toolSha256'].items():
    if hashlib.sha256((out / name).read_bytes()).hexdigest() != expected:
        raise SystemExit(f'Frozen tool changed: {name}')
for proc in Path('/proc').glob('[0-9]*/cmdline'):
    try:
        args = proc.read_bytes().split(b'\0')
    except OSError:
        continue
    if not args or not args[0].endswith(b'node'):
        continue
    if any(b'integration-district-final-soak.cjs' in a for a in args[1:]) or any(str(out / 'runner.cjs').encode() == a for a in args[1:]):
        raise SystemExit(f'Existing physical-soak process must be inspected first: PID {proc.parent.name}')
env = dict(os.environ, **prepared['environment'])
env.pop('SOAK_DIAGNOSTIC', None)
launch = {**prepared, 'status': 'starting', 'startedUtc': datetime.now(timezone.utc).isoformat(),
          'stdout': 'runner.log', 'command': prepared['command']}
with (out / 'runner.log').open('xb') as log:
    child = subprocess.Popen(launch['command'], stdout=log, stderr=subprocess.STDOUT, env=env)
    launch.update(status='running', pid=child.pid)
    (out / 'launch.json').write_text(json.dumps(launch, indent=2) + '\n')
    print(json.dumps({'pid': child.pid, 'sourceCommit': revision, 'out': str(out), 'status': 'running'}), flush=True)
    code = child.wait()
launch.update(status='exited', exitCode=code, endedUtc=datetime.now(timezone.utc).isoformat())
(out / 'launch.json').write_text(json.dumps(launch, indent=2) + '\n')
raise SystemExit(code)
