#!/usr/bin/env python3
"""Finalize honest mixed Pipera metadata after publish-atlas-retakes.py."""
import collections
import hashlib
import json
import shutil
import sys
from pathlib import Path

repo, retakes, review_dir = map(Path, sys.argv[1:])
dest = repo/'game/overview/comparison-data/pipera'
read = lambda f: json.loads(f.read_text())
sha = lambda f: hashlib.sha256(f.read_bytes()).hexdigest()
dump = lambda f,x: f.write_text(json.dumps(x,indent=2)+'\n')
current, fresh = read(dest/'manifest.json'), read(retakes/'manifest.json')
new_sha = fresh['gameSourceCommit']
subset_rel = Path('retakes')/new_sha[:8]
subset = dest/subset_rel
review = read(review_dir/'paired-review.json')
old_sha = review['originalSourceCommit']
archive = dest/'historical'/old_sha[:7]
old = read(archive/'manifest.json')
old_by_id = {r['id']:r for r in old['items']}
new_ids = {r['id'] for r in fresh['items']}
mask = read(retakes/'retake-impact-mask.json')
assert new_ids == set(next(d for d in mask['districts'] if d['id']=='pipera')['recaptureTiles'])
assert len(new_ids)==35 and len(current['items'])==len(old_by_id)==133
counts = dict(collections.Counter(r['gameSourceCommit'] for r in current['items']))
assert counts == {old_sha:98,new_sha:35}
source = read(subset/'source-provenance.json')
original_snapshot = Path(source['sourceRoot'])/'game/overview/comparison-data/pipera'
archive_hashes = {}
for f in sorted(original_snapshot.rglob('*')):
    if f.is_file():
        rel=f.relative_to(original_snapshot)
        assert sha(f)==sha(archive/rel), str(rel)
        archive_hashes[str(rel)] = sha(f)
verified_sources = []
for prefix,n in [(archive,old_sha),(subset,new_sha)]:
    provenance = read(prefix/'source-provenance.json')
    assert provenance['gameSourceCommit']==n
    for f in provenance['files']:
        assert sha(Path(provenance['sourceRoot'])/f['path'])==f['sha256'],f['path']
    verified_sources.append({'gameSourceCommit':n,'path':str((prefix/'source-provenance.json').relative_to(dest)),
                             'sha256':sha(prefix/'source-provenance.json'),'filesVerified':len(provenance['files'])})
for r in current['items']:
    before=old_by_id[r['id']]
    if r['id'] not in new_ids:
        for k in ['sha256','thumbnailSha256','gameSourceCommit','capturedAt']:
            assert r[k]==before[k],(r['id'],k)
    assert sha(dest/r['image'])==r['sha256']
    assert sha(dest/r['thumbnail'])==r['thumbnailSha256']
    r['reviewSourceManifest']=str(subset_rel/'paired-review.json') if r['id'] in new_ids else 'historical/'+old_sha[:7]+'/review.json'
for name in ['boundary-source.json','validation.json','retake-impact-mask.json','source-equivalence.json']:
    shutil.copyfile(retakes/name,subset/name)
shutil.copyfile(review_dir/'triplet-source-ledger.json',subset/'triplet-source-ledger.json')
shutil.copyfile(review_dir/'paired-review.json',subset/'paired-review.json')
mixed_review={
    'gameSourceCommit':new_sha,'gameSourceCommits':[old_sha,new_sha], 'atlasSourceCounts':counts,
    'framesReviewed':133,'freshFramesReviewed':35,'retainedEarlierReviewedFrames':98,'complete':True,
    'status':review['scope'],'reviewedAt':review['reviewedAt'],
    'method':'35 replacements manually reviewed as original/retake/reference triplets; 98 original frames retain their completed c78a5f4 full-atlas review. Exact per-frame source/date, all image hashes and both immutable served-source inventories verified.',
    'originalFullAtlasReview':{'path':'historical/'+old_sha[:7]+'/review.json','sha256':sha(archive/'review.json'),'framesInOriginalReview':133,'framesRetainedHere':98},
    'targetedRetakeReview':str(subset_rel/'paired-review.json'),
    'findings':read(archive/'review.json')['findings'], 'targetedRemainingGaps':review['remainingGaps'],
    'scopeCounts':current['atlasScopeCounts'], 'reference':read(archive/'review.json')['reference'],
}
current.update(generatedAt=fresh['generatedAt'],generatedDate=fresh['generatedDate'],review=mixed_review,reviewNote=review['scope'])
current['capture']['sourceInventoriesVerified']=verified_sources
current['sourceCaptureManifest']={'path':'capture-manifest.json','note':'Derived mixed-source delivery ledger. Original complete native capture and35 targeted native retakes remain immutable at sourceCaptureManifests paths.'}
dump(dest/'manifest.json',current)
dump(dest/'review.json',mixed_review)
dump(dest/'capture-report.json',current['capture'])
dump(dest/'source-provenance.json',{'type':'mixed-source-inventory-index','gameSourceCommit':new_sha,'atlasSourceCounts':counts,'inventories':verified_sources,'note':'Per-frame source SHA and capturedAt are authoritative. Original immutable source inventories and source-file hashes remain at the recorded paths.'})
capture={k:current[k] for k in ['schemaVersion','title','generatedDate','generatedAt','gameSourceCommit','publishedBaseline','captureType','atlasSourceCounts','sourceCaptureManifests','atlasScopeCounts','coverage','capture','items']}
dump(dest/'capture-manifest.json',capture)
poses=read(archive/'poses.json')
by_id={r['id']:r for r in current['items']}
for r in poses:r['gameSourceCommit']=by_id[r['id']]['gameSourceCommit']
dump(dest/'poses.json',poses)
plan=read(archive/'grid-plan.json')
plan.update(gameSourceCommit=new_sha,captureType='mixed-source-pose-plan',atlasSourceCounts=counts,note='Geometric coverage plan is unchanged. Per-pose source SHA records 35 current retakes and 98 original frames; this is not 133 fresh captures.')
dump(dest/'grid-plan.json',plan)
validation={'frames':133,'atlasSourceCounts':counts,'retakesReviewed':35,'retainedEarlierReviewed':98,
            'scopeCounts':current['atlasScopeCounts'],'archiveFilesByteIdentical':len(archive_hashes),
            'archiveImagesVerified':133,'currentImagesVerified':133,'currentThumbnailsVerified':133,
            'sourceInventoriesVerified':verified_sources,'failures':[]}
dump(dest/'validation.json',validation)
dump(subset/'publication-validation.json',validation)
dump(subset/'original-archive-hashes.json',{'sourceSnapshot':source['sourceRoot'],'filesSha256':archive_hashes,'byteIdentical':True})
print(json.dumps(validation))
