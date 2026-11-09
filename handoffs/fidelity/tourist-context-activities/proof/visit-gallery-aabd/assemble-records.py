"""Add a visitor gallery without replacing any original validation metadata."""
from pathlib import Path
import copy
import hashlib
import json

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
PREFIX = '../../handoffs/fidelity/tourist-context-activities/proof/visit-gallery-aabd/'
SOURCE = 'aabd17adfc8853c1ea23d3846782c5d1cc9be50f'
FILES = ['trial-results.json', 'results.json', 'portrait-input-results.json', 'context-results.json', 'activity-results.json', 'cathedral-footway-results.json']
raw = {}
for filename in FILES:
    report = json.loads((OUT / filename).read_text())
    assert report['complete'] and not report['errors']
    assert report['sourceFilesVerifiedBefore'] == report['sourceFilesVerifiedAfter'] == 230
    raw[filename] = report

by_id = {}
for filename, report in raw.items():
    for record in report['records']:
        assert record['passed']
        by_id.setdefault(record['id'], []).append((filename, record))
assert len(by_id) == 24

LABELS = {
 'arcul-de-triumf': 'The arch and its surrounding streets',
 'athenaeum-revolution': 'Athenaeum facade and gardens',
 'ballard-locks': 'The large lock beside the north-bank walkway',
 'bel-botanical-garden': 'The ravine suspension bridge',
 'bel-downtown-park': 'The reflecting pool and waterfall',
 'bel-lincoln-square': 'Lincoln Square tower and street frontage',
 'bel-meydenbauer': 'The crescent pier and Meydenbauer Bay',
 'chihuly': 'Glasshouse and suspended sculpture',
 'cismigiu': 'The lake through the garden trees',
 'fremont-troll': 'The Troll beneath the bridge',
 'gas-works': 'The preserved industrial towers',
 'herastrau-park': 'The park sculpture and tree-lined lawn',
 'kerry-park': 'The overlook and Seattle skyline',
 'mopop': 'MoPOP with the Space Needle beyond',
 'old-town-lipscani': 'Inside the Carusel atrium',
 'palace-parliament': 'Parliament across the public square',
 'peoples-salvation-cathedral': 'The cathedral from the southern footway',
 'pike-place': 'Market sign, clock and arcade',
 'pioneer-square': 'Pioneer Square and surrounding street fronts',
 'space-needle': 'Looking up the Needle above the trees',
 'spring-palace': 'The palace facade and garden',
 'stavropoleos-cec': 'Stavropoleos church from the street',
 'village-museum': 'The wooden church tower',
 'waterfront': 'Pier 57 and the Great Wheel',
}
all_records = []
for spot_id, entries in by_id.items():
    captures = []
    for filename, record in entries:
        for frame in record['captures']:
            capture = copy.deepcopy(frame)
            capture['captureRecord'] = PREFIX + filename
            capture['setup'] = record['setup']
            capture['label'] = LABELS[spot_id] if not capture['fullPageHUD'] else 'Phone view with the native touch interface'
            capture['purpose'] = 'Native on-foot scene camera; explicit viewpoint setup, not a walked route.' if not capture['fullPageHUD'] else 'Entire 390 × 844 game page; native portrait look gestures and HUD.'
            if capture['kind'] == 'phone-ui':
                capture['label'] = 'Initial portrait framing (retained)'
                capture['purpose'] = 'Full native phone UI after resizing; look was acquired at the earlier wide viewport. Retained without claiming portrait-input validation.'
            if capture['kind'] == 'activity-phone':
                capture['label'] = 'Drop a coin in Rachel · phone interaction'
                capture['purpose'] = 'Coin in flight after actual Use and Drop taps. Nearby setup; this does not show the arrival route.'
            captures.append(capture)
    scene = next(c for c in captures if c['kind'] == ('scene-east-footway' if spot_id == 'peoples-salvation-cathedral' else 'scene-context' if spot_id == 'ballard-locks' else 'scene'))
    phone = next(c for c in captures if c['kind'] == ('phone-east-footway' if spot_id == 'peoples-salvation-cathedral' else 'phone-context' if spot_id == 'ballard-locks' else 'activity-phone' if spot_id == 'pike-place' else 'phone-ui-touch'))
    primary = [scene, phone]
    retained = [c for c in captures if c not in primary]
    for capture in retained:
        if not capture['fullPageHUD']:
            capture['label'] = 'Earlier scene framing (retained)'
    limits = ['Illustrative native viewpoints, not a matched Street View comparison or a new scene-fidelity acceptance.', 'The current native phone toolbar crosses the centre of the viewport; it remains visible and unchanged.']
    if spot_id == 'ballard-locks':
        limits.append('The actual large-lock view has a broad grey far-wall surface and a partly obscured chamber. Geometry and the unverified entry route remain unchanged; this image does not resolve that source/model review.')
    if spot_id == 'peoples-salvation-cathedral':
        limits.append('The authored west-porch postcard is a close-up of columns. Southern footway views retain real foreground tree/crowd occlusion; the full silhouette and facade comparison remain open.')
    all_records.append({'id': spot_id, 'sourceCommit': SOURCE, 'captures': primary, 'retainedIllustrations': retained, 'limitations': limits, 'reports': [{'label': {'trial-results.json': 'Initial Pike scene and portrait capture', 'results.json': 'Initial 23-destination scene and portrait capture', 'portrait-input-results.json': 'Actual portrait touch-look capture', 'context-results.json': 'Ballard and cathedral context views', 'activity-results.json': 'Native Rachel coin interaction', 'cathedral-footway-results.json': 'Cathedral mapped-footway view'}[filename], 'report': PREFIX + filename, 'sha256': hashlib.sha256((OUT / filename).read_bytes()).hexdigest()} for filename, _ in entries]})

manifest = {'sourceCommit': SOURCE, 'overviewBase': 'e354a500e95a5f741564becf528af1f9445bd265', 'scope': 'GAME visitor illustrations only; original validation and historical records remain unchanged.', 'records': all_records}
manifest_file = OUT / 'visitor-captures.json'
manifest_file.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
manifest_sha = hashlib.sha256(manifest_file.read_bytes()).hexdigest()
for record in all_records:
    file = ROOT / 'game/overview/evidence/spots' / (record['id'] + '.json')
    original = json.loads(file.read_text())
    original['visitorGallery'] = {**record, 'updatedAt': max(c['capturedAt'] for c in record['captures']), 'notice': 'These views come from the staged game under test; the live game can differ.', 'setup': 'Explicit production on-foot viewpoints, with native touch look. The scene-authored postcard pose is used except the labelled Ballard chamber turn and Cathedral mapped southern footway. Phone captures use the complete native page; the Rachel image also uses actual activity buttons. No route, reference match or release acceptance is implied.', 'report': PREFIX + 'visitor-captures.json', 'reportSha256': manifest_sha}
    file.write_text(json.dumps(original, indent=2, ensure_ascii=False) + '\n')
print('24 visitor galleries assembled; all original record fields retained.')
