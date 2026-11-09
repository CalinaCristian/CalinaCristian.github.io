#!/usr/bin/env python3
"""Losslessly retain native observations; never edits a source or raw run."""
import gzip, hashlib, json, pathlib, shutil, subprocess

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[3]
RAW = pathlib.Path('/workspace/reality-pass/source-domain-boundaries')
DEST = HERE / 'native-validation'
if DEST.exists():
    raise SystemExit('Preserve earlier package; destination already exists')
DEST.mkdir()
sha = lambda b: hashlib.sha256(b).hexdigest()
files = {}

def write(name, data):
    p = DEST / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    row = {'bytes': len(data), 'sha256': sha(data)}
    if name.endswith('.gz'):
        raw = gzip.decompress(data)
        row.update(rawBytes=len(raw), rawSha256=sha(raw))
    files[name] = row

runs = ['native-fd31352e', 'native-fd31352e-r2', 'native-fd31352e-otopeni',
        'closures-fd31352e', 'closures-a119e372']
reports = {}
for run in runs:
    src = RAW / run
    report = json.loads((src / 'report.json').read_text())
    if not report.get('browserClosed'):
        raise SystemExit('Run not closed: ' + run)
    reports[run] = report
    for p in sorted(src.iterdir()):
        if not p.is_file():
            raise SystemExit('Unexpected directory: ' + str(p))
        data = p.read_bytes()
        name = run + '/' + p.name
        if p.suffix == '.json':
            name += '.gz'
            data = gzip.compress(data, mtime=0)
        write(name, data)
    write(run + '/native.log', (RAW / (run + '.log')).read_bytes())
for prefix in ['fd31352e', 'a119e372']:
    write('source-manifest-' + prefix + '.json',
          (RAW / ('preparation-' + prefix) / 'source-manifest.json').read_bytes())
for commit, names in {
    'fd31352ef2b0bdcaa562af5e56339a2157a46a48': ['native.cjs', 'scan-main-bridge.cjs'],
    '2e9bd8ace7b49d330fafaa32e71bd937f3df4206': ['native.cjs', 'scan-main-bridge.cjs'],
    '58a06f82': ['native-closures.cjs'],
}.items():
    full = subprocess.check_output(['git', 'rev-parse', commit], cwd=REPO).decode().strip()
    for name in names:
        relative = str(HERE.relative_to(REPO) / name)
        data = subprocess.check_output(['git', 'show', full + ':' + relative], cwd=REPO)
        write('executed-tools/' + full + '/' + name, data)

old = reports['closures-fd31352e']
new = reports['closures-a119e372']
physical = []
images = []
for a, b in zip(old['stages'], new['stages']):
    assert a['district'] == b['district']
    ra = json.loads(gzip.decompress((RAW / 'closures-fd31352e' / a['facts']['file']).read_bytes()))
    rb = json.loads(gzip.decompress((RAW / 'closures-a119e372' / b['facts']['file']).read_bytes()))
    assert ra['physicalClosureWalls'] == rb['physicalClosureWalls']
    assert ra['sourceWalls'] == rb['sourceWalls']
    assert ra['closures'] == rb['closures']
    assert len(rb['closures']) == len(rb['physicalClosureWalls'])
    for c in rb['closures']:
        matches = [w for w in rb['physicalClosureWalls'] if w['edge']['id'] == c['edge']['id'] and
                   w['l0'] == c['l0'] and w['l1'] == c['l1']]
        assert len(matches) == 1
        w = matches[0]
        assert abs(((w['bx']-w['ax'])**2+(w['bz']-w['az'])**2)**.5-(c['l1']-c['l0'])) < 1e-8
    physical.append({'district': a['district'], 'closureSections': len(rb['closures']),
                     'physicalClosureWalls': len(rb['physicalClosureWalls']),
                     'physicalWallsOutlineClosureMetadataExactAcrossSignFix': True})
    # The original camera observer rendered the same SeaTac camera once per
    # split section and overwrote that filename. Preserve its report verbatim;
    # retain only the final, hash-matching record as one unique inspected view.
    by_file = {c['file']: c for c in b['captures']}
    for name, c in by_file.items():
        assert sha((RAW / 'closures-a119e372' / name).read_bytes()) == c['sha256']
        assert c['view']['actorPlayerTimeUnchanged']
        images.append({'district': a['district'], 'file': 'closures-a119e372/' + name,
                       'camera': c, 'scope': 'Static explicit camera; not a driving/budget frame'})

groz = reports['native-fd31352e-r2']
otp = reports['native-fd31352e-otopeni']
assert groz['nativeBodyScan']['rows'] == 1736
assert not groz['nativeBodyScan']['positiveRows'] and not groz['nativeBodyScan']['surfaceErrors']
assert len(groz['routes']['doina']) == 61 and all(r['route'] for r in groz['routes']['doina'])
assert len(groz['unframedDraws']) == 97
assert sum(r['calls'] for r in groz['unframedDraws']) == 97
assert sum(r['triangles'] for r in groz['unframedDraws']) == 12673
assert otp['complete'] and otp['drivePassed'] and not otp['drive']['contacts']
summary = {
    'nativePhysicalAndBudgetSource': groz['sourceCommit'],
    'finalStaticSignSource': new['sourceCommit'],
    'groz': {'readOnlyBodyRows': 1736, 'staticPositiveRows': 0, 'surfaceErrors': 0,
             'doinaToLiteralLukoil': '61/61', 'driveAccepted': False,
             'blockedBy': groz['publicEntry']['initialTramBinding']['unresolved'],
             'population': {k: groz['publicEntry']['population'][k] for k in ['active','pool','peds','constructorCount']},
             'measuredCompleteWarmFrames': [f['accounting'] for f in groz['frames']],
             'directObservedSetupDraws': {'calls': 97, 'triangles': 12673}},
    'otopeni': {'result': otp['drive']['result'], 'contacts': len(otp['drive']['contacts']),
                'resetAttempts': otp['drive']['resetAttempts'], 'issues': otp['drive']['issues'],
                'population': {k: otp['publicEntry']['population'][k] for k in ['active','pool','peds','constructorCount']},
                'measuredCompleteFrames': [f['accounting'] for f in otp['frames']]},
    'physicalSignFixParity': physical,
    'uniqueInspectedFinalStaticViews': images,
    'retainedLimitations': [
        'Groz native preflight rejects tram376; no Groz driving success is claimed.',
        'First Groz attempt stops before body scan; its pre-frame carry is recorded but individual setup draw rows were not persisted. Corrected replay retains all97.',
        'Each static camera run has11 render records and9 unique views: SeaTac split edge792 repeats one identical camera3times and overwrites its PNG. Original reports remain unchanged; only final matching records are indexed. Observer now deduplicates this camera.',
        'The sign-only follow-up is checked with fresh native static exports. Its physical walls, boundary outline and closure metadata equal fd313 in all4districts. The fd313 drive/budget capture is not relabelled as a119.',
        'No full district visual acceptance, published overview synchronization, latest-root paint/Ultra, global physical matrix or final23-frame budget pass is claimed.',
    ],
}
write('native-summary.json', (json.dumps(summary, indent=2)+'\n').encode())
manifest = {'policy': 'Every raw report/negative preserved losslessly; real source commits/dates retained. No reference imagery.',
            'rawRoot': str(RAW), 'files': files}
(DEST/'integrity.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({'files':len(files),'bytes':sum(r['bytes'] for r in files.values()),
                  'uniqueFinalStaticViews':len(images),'physicalParity':physical},indent=2))
