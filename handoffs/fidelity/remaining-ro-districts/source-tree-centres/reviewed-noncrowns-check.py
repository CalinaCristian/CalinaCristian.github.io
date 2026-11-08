"""Independently reconstruct every raw aerial candidate; verify source-only tree delta."""
import collections,hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
OLD='4378317f3fcdccc886d6c7c1ed092ee15d95db8a'
TREE_FIELDS={'trees','treeInfo','treeCrownRadii','treeRetention'}
for district in ['unirii','otopeni']:
    inp=json.loads((ROOT/f'game/research/trees-bucharest-{district}.json').read_text())
    review=json.loads((ROOT/f'game/research/trees-bucharest-{district}-review.json').read_text())
    negatives={r['rawInputIndex']:r for r in review['exclusions']}
    assert len(negatives)==review['excludedCount']
    current=iter(inp['trees']);raw=[]
    for i in range(review['rawCandidateCount']):
        raw.append(negatives[i]['rawCandidate'] if i in negatives else next(current))
    assert next(current,None) is None
    digest=hashlib.sha256(json.dumps(raw,separators=(',',':')).encode()).hexdigest()
    assert digest==review['rawOrderedCandidatesSha256'],(district,'raw input preservation')
    assert len(inp['trees'])==review['remainingCandidateCount']
    active=collections.Counter(tuple(r)for r in inp['trees'])
    for c in review['positiveAndAmbiguousControls']:
        assert c['rawInputIndex'] not in negatives
        assert raw[c['rawInputIndex']]==c['rawCandidate']
        assert active[tuple(c['rawCandidate'])]>0,(district,'positive control lost')
    for r in negatives.values():
        assert r['classification']=='reviewed non-crown'
        assert r['reason'] and r['officialSourceTile'].startswith('https://server.arcgisonline.com/')
        assert r['cropGroundSideM']==40 and len(r['reviewCropMosaicPixels'])==4
    before=json.loads(subprocess.check_output(['git','show',f'{OLD}:game/data/bucharest-{district}.json'],cwd=ROOT))
    after=json.loads((ROOT/f'game/data/bucharest-{district}.json').read_text())
    changed={k for k in set(before)|set(after) if before.get(k)!=after.get(k)}
    assert changed<=TREE_FIELDS,(district,'non-tree field changed',changed-TREE_FIELDS)
    assert len(after['trees'])//3==len(before['trees'])//3-review['affectedCompiledBeforeCount'],(district,'unexpected compiled tree delta')
    osm=lambda d:collections.Counter((tuple(d['trees'][i*3:i*3+3]),tuple(d['treeInfo'][i*3:i*3+3]),d['treeCrownRadii'][i])for i in range(len(d['trees'])//3)if not(d['treeInfo'][i*3+2]&32))
    assert osm(before)==osm(after),(district,'mapped OSM tree changed')
    assert after['treeRetention']['thinned']==0
    print(json.dumps({'district':district,'rawCandidatesReconstructed':len(raw),'reviewedNonCrowns':len(negatives),'activeCandidates':len(inp['trees']),'retainedPositiveControls':len(review['positiveAndAmbiguousControls']),'OSMTreesUnchanged':sum(osm(after).values()),'compiledBefore':len(before['trees'])//3,'compiledAfter':len(after['trees'])//3,'onlyChangedFields':sorted(changed),'datasetSha256':hashlib.sha256((ROOT/f'game/data/bucharest-{district}.json').read_bytes()).hexdigest()}))
