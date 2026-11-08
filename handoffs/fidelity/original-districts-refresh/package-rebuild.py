#!/usr/bin/env python3
"""Package complete source audit outputs without replacing earlier delivery evidence."""
import argparse
import gzip
import hashlib
import json
import re
import shutil
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--root', required=True)
p.add_argument('--audit', required=True)
p.add_argument('--compiler-commit', required=True)
p.add_argument('--summary', required=True)
p.add_argument('--estimates', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
if not re.fullmatch(r'[0-9a-f]{40}', a.compiler_commit):
    p.error('--compiler-commit requires an immutable 40-character source SHA')
root, audit, out = map(Path, (a.root, a.audit, a.out))
summaries = json.loads(Path(a.summary).read_text())['districts']
estimates = json.loads(Path(a.estimates).read_text())['districts']
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
for district in ('floreasca', 'grozavesti', 'romana'):
    dst = out / district
    dst.mkdir(parents=True, exist_ok=True)
    checks = json.loads((audit / (district + '-checks.json')).read_text())
    assert checks['inputUnchanged'] and all(x['exitCode'] == 0 for x in checks['results'])
    data_path = root / ('game/data/bucharest-' + district + '.json')
    assert sha(data_path) == checks['dataSha256']
    old = root / ('handoffs/fidelity/original-districts-refresh/delivery/' + district)
    initial = json.loads((old / 'source-summary.json').read_text())
    summary = summaries[district]
    summary.update({
        'compilerSourceCommit': a.compiler_commit,
        'initialDeliveryDataSha256': initial['dataSha256'],
        'rawSourceArchive': str((old / 'osm-source-snapshot.tar.gz').relative_to(root)),
        'rawSourceArchiveSha256': sha(old / 'osm-source-snapshot.tar.gz'),
        'researchInputs': [{**record, 'sha256': sha(root / record['path'])} for record in initial['researchInputs']],
        'treeCalibration': initial['treeCalibration'],
    })
    data = json.loads(data_path.read_text())
    data.pop('generated', None)
    summary['contentSha256ExcludingGenerated'] = hashlib.sha256(json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    for src in audit.glob(district + '-*'):
        if src.is_file():
            shutil.copyfile(src, dst / src.name)
    raw = (audit / (district + '.json')).read_bytes()
    (dst / (district + '-buildings.json.gz')).write_bytes(gzip.compress(raw, mtime=0))
    for filename, value in [('source-summary.json', summary), ('estimates.json', estimates[district])]:
        (dst / filename).write_text(json.dumps(value, indent=2) + '\n')
    note = f'''# {district} final source rebuild

Rebuilt with compiler source `{a.compiler_commit}` after finite source passage openings and reviewed roof-shape adoption. The exact dataset SHA256 is `{summary['dataSha256']}`. All original raw source inputs and earlier audit findings remain in the initial delivery archive and Git history; this directory adds the new complete raw audit rows, stdout/stderr, build log and unchanged-input check hashes.

Reproduction uses the unchanged raw OSM archive and commands in `handoffs/fidelity/original-districts-refresh/delivery/{district}/REPRODUCE.md`, with this compiler checkout. Current research hashes, deterministic content hash, complete source identities/topology, unthinned crown retention and unknown imagery acquisition date remain explicit in `source-summary.json`. `estimates.json` retains every profile issue and dimension/rise source.

All three independent checks exit zero: all-positive-area source buildings (identity, topology, literal dimensions, holes), native geometry, and every public/private core and required scenery road (exact source-node order and boundary-cut identity). These checks do not establish full visual fidelity or performance acceptance. Final running-world capture evidence is separate.
'''
    (dst / 'REPRODUCE.md').write_text(note)
    print(district, summary['dataSha256'], summary['sourceRecords'], 'buildings; all strict checks pass')
