"""Install reviewed GAME retakes while preserving the complete original atlas.

Usage: script REPO DISTRICT RETAKES REVIEW_JSON
The review must list exact view IDs and original/retake/reference hashes. Provider
images remain private; this tool only copies recorded GAME images and metadata.
"""
from pathlib import Path
from PIL import Image
import collections, hashlib, json, shutil, subprocess, sys

repo, district, retakes, review_path = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4])
dest = repo / 'game/overview/comparison-data' / district
load = lambda p: json.loads(p.read_text())
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
dump = lambda p, d: p.write_text(json.dumps(d, indent=2) + '\n')
old, new, review = load(dest/'manifest.json'), load(retakes/'manifest.json'), load(review_path)
old_sha, new_sha = old['gameSourceCommit'], new['gameSourceCommit']
assert old_sha != new_sha and review['sourceCommit'] == new_sha
assert review['reviewedIds'] == [r['id'] for r in new['items']]
assert review['visuallyInspected'] and not new['capture']['pageErrors'] and not new['capture']['consoleErrors']
assert all(r['gameSourceCommit'] == old_sha for r in old['items']), 'Archive requires a complete homogeneous original'
originals = {r['id']: r for r in old['items']}
assert len(originals) == len(old['items'])
assert len({r['id'] for r in new['items']}) == len(new['items'])
source = load(retakes/'source-provenance.json')
assert source['gameSourceCommit'] == new_sha
for f in source['files']:
    assert digest(Path(source['sourceRoot'])/f['path']) == f['sha256'], f['path']
for f in ['game/data/seattle-bellevue.json','game/src/world.js','game/src/water-lines.js']:
    p=Path(source['sourceRoot'])/f
    if p.exists():
        exact=subprocess.check_output(['git','show',new_sha+':'+f],cwd=repo)
        assert p.read_bytes() == exact, f
pose_keys=['x','z','h','size','fov','heading','pitch','square','boundsXZ','scope']
review_rows={r['id']:r for r in review['items']}
for r in new['items']:
    before=originals[r['id']]
    assert all(before[k]==r[k] for k in pose_keys), r['id']
    assert digest(dest/before['image']) == before['sha256'] == review_rows[r['id']]['originalGameSha256']
    assert digest(retakes/r['image']) == r['sha256'] == review_rows[r['id']]['retakeGameSha256']
    assert Image.open(retakes/r['image']).size == (r['width'],r['height']) == (640,640)
    assert r['perf']['triangles'] > 0 and r['perf']['drawCalls'] > 0
archive=dest/'historical'/old_sha[:7]
if not archive.exists():
    archive.mkdir(parents=True)
    for f in dest.iterdir():
        if f.is_file(): shutil.copyfile(f,archive/f.name)
    for r in old['items']:
        for key in ['image','thumbnail']:
            target=archive/r[key]; target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(dest/r[key],target)
else:
    # An interrupted install may resume only against the byte-identical original archive.
    for r in old['items']:
        assert digest(archive/r['image']) == r['sha256']
        assert digest(archive/r['thumbnail']) == r['thumbnailSha256']
assert digest(archive/'manifest.json') == digest(dest/'manifest.json')
subset_rel=Path('retakes')/new_sha[:8]
subset=dest/subset_rel; subset.mkdir(parents=True,exist_ok=True)
for name in ['manifest.json','capture-report.json','source-provenance.json','world-stats.json','grid-plan.json','poses.json']:
    shutil.copyfile(retakes/name,subset/name)
for r in new['items']:
    before=originals[r['id']]
    shutil.copyfile(retakes/r['image'],dest/before['image'])
    if (retakes/r['thumbnail']).exists():
        shutil.copyfile(retakes/r['thumbnail'],dest/before['thumbnail'])
    else:
        im=Image.open(retakes/r['image']).convert('RGB');im.thumbnail((200,200),Image.Resampling.LANCZOS);im.save(dest/before['thumbnail'],quality=82,optimize=True)
    # Presentation metadata survives; actual pose, dates, capture source and pixels come from the new ledger.
    before.update(r)
    before['thumbnailSha256']=digest(dest/before['thumbnail'])
    before['captureType']='source-snapshot'
    before['sourceNote']='Targeted canal retake '+new_sha[:8]+'. Original full '+old_sha[:7]+' atlas is archived separately.'
    before['sourceCaptureManifest']=str(subset_rel/'manifest.json')
new_items={r['id'] for r in new['items']}
for r in old['items']:
    if r['id'] not in new_items:
        r['sourceNote']='Original '+old_sha[:7]+' frame; not recaptured at the targeted canal revision.'
        r['sourceCaptureManifest']='historical/'+old_sha[:7]+'/capture-manifest.json'
old['historicalCollections']=[{'label':'Full atlas before canal fallback correction','manifest':'historical/'+old_sha[:7]+'/manifest.json','gameSourceCommit':old_sha,'frames':len(old['items']),'generatedAt':old['generatedAt'],'note':'All original images, thumbnails, raw capture ledger and source-file provenance are preserved unchanged.'}]
old['gameSourceCommit']=new_sha;old['publishedBaseline']=new_sha
old['atlasSourceCounts']=dict(collections.Counter(r['gameSourceCommit'] for r in old['items']))
old['comparisonSourceCommits']['atlas']=list(old['atlasSourceCounts'])
old['captureType']='mixed-source-survey'
old['capture']={'type':'mixed-source-atlas','frameCounts':len(old['items']),'originalFullCapture':{'gameSourceCommit':old_sha,'manifest':'historical/'+old_sha[:7]+'/capture-manifest.json','frames':len(old['items'])},'targetedRetakeCapture':{'gameSourceCommit':new_sha,'manifest':str(subset_rel/'manifest.json'),'frames':len(new['items']),'startedAt':new['capture']['startedAt'],'endedAt':new['capture']['endedAt']},'note':'Per-frame SHA and capturedAt are authoritative. Original and retake capture metadata remain immutable.'}
old['sourceCaptureManifest']={'path':'historical/'+old_sha[:7]+'/capture-manifest.json','sha256':digest(archive/'capture-manifest.json'),'note':'Original full atlas ledger; four replacements have their own ledger in sourceCaptureManifests.'}
old['sourceCaptureManifests']=[{'path':'historical/'+old_sha[:7]+'/capture-manifest.json','gameSourceCommit':old_sha,'frames':len(old['items'])-len(new['items'])},{'path':str(subset_rel/'manifest.json'),'gameSourceCommit':new_sha,'sha256':digest(subset/'manifest.json'),'frames':len(new['items'])}]
old['collectionNotes']['atlas']=f"Complete {len(old['items'])}-frame atlas: {len(old['items'])-len(new['items'])} original {old_sha[:7]} frames plus {len(new['items'])} canal retakes at {new_sha[:8]}. Per-frame source/date retained. Full original atlas remains in historical collections. Technical north-up captures exclude moving traffic/mirror and temporarily remove fog/extend depth; native normal-perspective checks are separate."
old['visualAcceptance']='Every frame reviewed; the four canal retakes resolve the broad fallback ribbon finding. Unknown source heights, detailed materials, occupancy, imagery date and the 0.46633m untagged waterway boundary continuation remain unresolved; no full-scene parity claim.'
old['resolvedMaterialFindings']=[{'id':'downtown-park-canal-blue-pads','originalSourceCommit':old_sha,'resolutionSourceCommit':new_sha,'review':str(subset_rel/'paired-review.json'),'retakeIds':review['reviewedIds'],'classification':'Broad duplicate fallback river ribbon removed; narrow source water polygon retained.'}]
old['openMaterialFindings']=[{'id':'waterway-boundary-unknown','unresolvedBoundaryM':0.46633,'sourceRoadId':'w1326469175','classification':'Raw OSM has only waterway=river; no measured width, tunnel, covered, culvert or layer. This short continuation remains explicit; no dimension or tunnel attribute is invented.'}]
old['review']['atlasSourceCommit']=list(old['atlasSourceCounts']);old['review']['targetedRetakeReview']=str(subset_rel/'paired-review.json');old['review']['atlasSourceNote']=old['collectionNotes']['atlas'];old['review']['visualAcceptance']=old['visualAcceptance'];old['review']['openMaterialFindings']=old['openMaterialFindings']
old['review']['acceptanceNote']='Complete capture/review coverage with the targeted canal correction. Source height, roof, terrain, facade, occupancy, date and sparse outer-detail limits remain. Native control evidence is separate.'
shutil.copyfile(review_path,subset/'paired-review.json')
dump(dest/'manifest.json',old)
validation={'frames':len(old['items']),'atlasSourceCounts':old['atlasSourceCounts'],'sourceFilesVerified':len(source['files']),'retakesReviewed':len(new['items']),'archiveImagesVerified':len(originals),'streetWalkSourceCommit':old['streetWalk']['gameSourceCommit'],'failures':[]}
for r in old['items']:
    assert digest(dest/r['image'])==r['sha256']
    assert digest(dest/r['thumbnail'])==r['thumbnailSha256']
for r in load(archive/'manifest.json')['items']:
    assert digest(archive/r['image'])==r['sha256']
    assert digest(archive/r['thumbnail'])==r['thumbnailSha256']
dump(subset/'publication-validation.json',validation)
print(json.dumps(validation))
