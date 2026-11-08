#!/usr/bin/env python3
"""Run independent source checks, retaining failures and immutable input hashes."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--district', required=True)
p.add_argument('--root', required=True)
p.add_argument('--data-root')
p.add_argument('--osm', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
root, out, osm = Path(a.root).resolve(), Path(a.out).resolve(), Path(a.osm).resolve()
out.mkdir(parents=True, exist_ok=True)
base = out / a.district
data_root = Path(a.data_root).resolve() if a.data_root else root
data = data_root / ('game/data/bucharest-' + a.district + '.json')
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
before = sha(data)
commands = [
    ('buildings', ['python3', 'tools/osm/building-audit.py', '--data', str(data), '--osm', *map(str, sorted(osm.glob('*.xml'))), '--roofs', 'game/research/roofs-bucharest-' + a.district + '.json', '--out', str(base)]),
    ('geometry', ['node', 'tools/osm/building-geometry-check.mjs', '--data=' + str(data), '--osm=' + str(osm)]),
    ('roads', ['node', 'tools/osm/road-source-audit.mjs', '--data', str(data), '--osm', str(osm)]),
]
results = []
for name, command in commands:
    stdout = out / (a.district + '-' + name + ('.log' if name == 'buildings' else '.json'))
    stderr = out / (a.district + '-' + name + '.stderr')
    with stdout.open('w') as log, stderr.open('w') as errors:
        completed = subprocess.run(command, cwd=root, stdout=log, stderr=errors, timeout=1800)
    results.append({'check': name, 'exitCode': completed.returncode, 'stdout': stdout.name, 'stderr': stderr.name, 'stdoutSha256': sha(stdout), 'stderrSha256': sha(stderr)})
    print(a.district, name, 'exit', completed.returncode, flush=True)
after = sha(data)
report = {'district': a.district, 'dataSha256': before, 'inputUnchanged': before == after, 'sourceRoot': str(root), 'results': results}
(out / (a.district + '-checks.json')).write_text(json.dumps(report, indent=2) + '\n')
raise SystemExit(0 if before == after and all(r['exitCode'] == 0 for r in results) else 1)
