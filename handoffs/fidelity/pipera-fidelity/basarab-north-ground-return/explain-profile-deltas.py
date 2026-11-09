"""Read-only certificate for previously zero-extent prepared road records."""
from pathlib import Path
import argparse,hashlib,json,math
ap=argparse.ArgumentParser();ap.add_argument('--accepted',type=Path,required=True);ap.add_argument('--candidate',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);args=ap.parse_args()
a=json.loads(args.accepted.read_bytes());b=json.loads(args.candidate.read_bytes())
def records(d):
 out={}
 for k,s in d['roadSourceGeometry'].items():
  row=d['roads'][int(k)];pts=[d['roadNodePositions'][j*2:j*2+2]for j in row[10:]]
  value={'name':d['strings'][row[0]]if row[0]>=0 else '', 'profileFields':row[1:10], 'width':d.get('roadWidths',{}).get(k),'access':d['roadAccess'][k]}
  out.setdefault(s['sourceId'],[]).append({'row':int(k),'profile':value,'lengthM':sum(math.dist(x,y)for x,y in zip(pts,pts[1:])),'nodeIds':[d['roadNodeIds'][j]for j in row[10:]],'points':pts})
 return out
old,new=records(a),records(b);deltas=[]
for sid,rows in old.items():
 for before in rows:
  if any(before['profile']==r['profile']for r in new[sid]):continue
  assert before['lengthM']==0,(sid,'changed previously physical profile')
  assert len(new[sid])==1,(sid,'ambiguous replacement')
  after=new[sid][0];x=before['profile'];y=after['profile'];assert x['name']==y['name']and x['width']==y['width']and x['access']==y['access']
  changed=[i for i,(v,w)in enumerate(zip(x['profileFields'],y['profileFields']),start=1)if v!=w]
  assert changed==[8] and x['profileFields'][7]==33 and y['profileFields'][7]==1
  assert after['lengthM']>0 and all(n>0 for n in after['nodeIds'])
  deltas.append({'sourceId':sid,'before':before,'after':after,'changedPackedColumn':8,'explanation':'Only inferred tram-nearby bit32 changed. Old clipped endpoints coincide exactly (zero physical extent); restored literal full span is sampled by the unchanged generic tram-nearby estimator. One-way bit1, lanes/width/sidewalk/median/speed/layer/access/raw source geometry are unchanged. This is not a permission to change any prior nonzero-length physical profile.'})
assert {r['sourceId']for r in deltas}=={'w23554631','w125909046'}
report={'scope':'CPU prepared-data profile audit; no native grade, physical body, lane-count repair or route acceptance. Complete original raw source records are checked separately by check-retention.py.','acceptedSha256':hashlib.sha256(args.accepted.read_bytes()).hexdigest(),'candidateSha256':hashlib.sha256(args.candidate.read_bytes()).hexdigest(),'deltas':deltas,'changedPriorNonzeroLengthProfiles':0}
args.out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'profileDeltas':len(deltas),'allPreviouslyZeroExtent':True,'changedPriorNonzeroLengthProfiles':0}))
