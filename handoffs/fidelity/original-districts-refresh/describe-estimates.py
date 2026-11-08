#!/usr/bin/env python3
"""Report source estimates and native-profile issues without turning coverage into fidelity."""
import argparse
from collections import Counter
import hashlib
import json
import re
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--root', required=True)
p.add_argument('--commit', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
if not re.fullmatch(r'[0-9a-f]{40}', a.commit):
    p.error('--commit requires the complete immutable 40-character source SHA')
report = {'gameSourceCommit': a.commit, 'note': 'Counts describe recorded dimension/roof provenance and unresolved inputs; they are not a visual-fidelity score. Unknown imagery acquisition dates remain unknown.', 'districts': {}}
for district in ('floreasca', 'romana', 'grozavesti'):
    f = Path(a.root) / ('game/data/bucharest-' + district + '.json')
    data = json.loads(f.read_text())
    issues, guessed_invalid_bands = [], []
    for index, profile in data['buildingRoofProfiles'].items():
        i = int(index)
        minimum = data.get('buildingDimensions', {}).get(index, [0, data['buildings'][i][2] / 10])[1]
        row = {'sourceId': data['buildingIds'][i], 'heightSource': profile['heightSource'], 'totalM': profile['totalM'], 'eavesM': profile['eavesM'], 'minimumM': minimum, 'raw': profile.get('raw', {}), 'issues': profile.get('issues', [])}
        if row['issues']:
            issues.append(row)
        if profile['totalM'] <= minimum and not profile.get('raw', {}).get('height') and 'OSM height' not in profile['heightSource']:
            guessed_invalid_bands.append(row)
    report['districts'][district] = {
        'dataSha256': hashlib.sha256(f.read_bytes()).hexdigest(),
        'buildingRecords': len(data['buildings']),
        'dimensionProvenanceCodes': dict(Counter(data['buildingInfo'][4::5])),
        'dimensionProvenanceCodeLegend': {'0': 'OSM height or levels (levels-to-metres remains an estimate)', '1': 'research; inspect the record source', '2': 'style/default estimate', '3': 'sanity re-estimate'},
        'profileHeightSources': dict(Counter(v['heightSource'] for v in data['buildingRoofProfiles'].values())),
        'profileRiseSources': dict(Counter(v['riseSource'] for v in data['buildingRoofProfiles'].values())),
        'nativeProfileIssues': issues,
        'guessedInvalidVerticalBands': guessed_invalid_bands,
        'sourceRoadBuildingConflicts': data.get('buildingRoadConflicts', []),
        'treeRetention': data.get('treeRetention'),
        'exportedTreeRecords': len(data['trees']) // 3,
    }
Path(a.out).write_text(json.dumps(report, indent=2) + '\n')
