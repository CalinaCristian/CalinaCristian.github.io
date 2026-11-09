"""Validate visitor image provenance while preserving every prior record field."""
from pathlib import Path
import hashlib
import json
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[5]
BASE = 'e354a500e95a5f741564becf528af1f9445bd265'
SOURCE = 'aabd17adfc8853c1ea23d3846782c5d1cc9be50f'
records = []
for file in sorted((ROOT / 'game/overview/evidence/spots').glob('*.json')):
    relative = str(file.relative_to(ROOT))
    current = json.loads(file.read_text())
    original = json.loads(subprocess.check_output(['git', 'show', BASE + ':' + relative], cwd=ROOT))
    gallery = current.pop('visitorGallery')
    assert current == original, 'Prior evidence changed: ' + relative
    assert gallery['sourceCommit'] == SOURCE
    assert len(gallery['captures']) >= 2
    for capture in gallery['captures'] + gallery.get('retainedIllustrations', []):
        image = ROOT / 'game/overview' / capture['image']
        raw = image.read_bytes()
        assert hashlib.sha256(raw).hexdigest() == capture['sha256']
        assert len(raw) == capture['bytes']
        decoded = Image.open(image)
        assert decoded.size == (capture['viewport']['width'], capture['viewport']['height'])
        assert capture['sourceCommit'] == SOURCE
        assert capture['cameraParent'] == 'onfoot'
        if capture['fullPageHUD']:
            assert decoded.size == (390, 844)
            assert capture['ui']['touch'] and capture['ui']['spotHUD'] and capture['ui']['touchAction']
    records.append({'id': current['id'], 'visitorImages': len(gallery['captures']), 'priorRecordUnchanged': True})
assert len(records) == 24
print(json.dumps({'passed': True, 'sourceCommit': SOURCE, 'records': records}, indent=2))
