from pathlib import Path
import json,hashlib
root=Path('/workspace/fidelity-workers/pipera-fidelity')
paths={
'bucharest-floreasca':'/workspace/reality-pass/original-districts-refresh/final-4378317/atlas-floreasca',
'bucharest-romana':'/workspace/reality-pass/original-districts-refresh/final-4378317/atlas-romana',
'bucharest-grozavesti':'/workspace/reality-pass/original-districts-refresh/final-4378317/atlas-grozavesti',
'bucharest-pipera':'/workspace/reality-pass/pipera/final-atlas-water-tags',
'bucharest-unirii':'/workspace/reality-pass/remaining-ro/unirii/atlas-4378317',
'bucharest-otopeni':'/workspace/reality-pass/remaining-ro/otopeni/atlas-4378317',
'seattle-bellevue':'/workspace/reality-pass/us-districts/bellevue/atlas-final',
'seattle-seatac':'/workspace/reality-pass/us-districts/seatac/atlas-final'}
def und(a):
 x=z=0;p=[]
 for i in range(0,len(a),2):x+=a[i];z+=a[i+1];p.append([x/10,z/10])
 return p
def area(r):return abs(sum(a[0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*a[1] for i,a in enumerate(r))/2) if len(r)>2 else 0

def clipped(r,b):
 for axis,bound,ge in [(0,b[0],True),(0,b[2],False),(1,b[1],True),(1,b[3],False)]:
  out=[]
  for i,a in enumerate(r):
   prev=r[i-1];ai=(a[axis]>=bound) if ge else (a[axis]<=bound);pi=(prev[axis]>=bound) if ge else (prev[axis]<=bound)
   if ai!=pi:
    t=(bound-prev[axis])/(a[axis]-prev[axis]);p=[prev[k]+(a[k]-prev[k])*t for k in (0,1)];out.append(p)
   if ai:out.append(a)
  r=out
  if not r:break
 return area(r)
rows=[]
for district,folder in paths.items():
 file=root/'game/data'/f'{district}.json';d=json.loads(file.read_text());poses=Path(folder)/'poses.json';ps=json.loads(poses.read_text());waters=[(d.get('areaSourceIds',['']*len(d['areas']))[i],[und(r) for r in a[2:]]) for i,a in enumerate(d['areas']) if d['areaKinds'][a[0]]=='water'];tiles=[]
 for p in ps:
  b=p['boundsXZ'];pad=5;eb=[b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad];ids=[]
  for id,rings in waters:
   intersect=clipped(rings[0],eb)-sum(clipped(h,eb) for h in rings[1:])
   if intersect>1e-4:ids.append(id)
  if ids:tiles.append({'id':p['id'],'sourceWaterIds':ids,'groundBoundsXZ':b})
 rows.append({'district':district,'dataSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'posesSha256':hashlib.sha256(poses.read_bytes()).hexdigest(),'totalFrames':len(ps),'waterReviewFrames':len(tiles),'unaffectedFrames':len(ps)-len(tiles),'tiles':tiles})
result={'schemaVersion':1,'purpose':'Conservative source-water-only north-up atlas recapture mask for shallow-tint reliability shader080b185. All source water included, not only flagged coarse faces, so this is a safe superset rather than exact changed-pixel claim.','method':'Clip exact prepared source outer and inner water rings against each actual planned250m ground square enlarged5m on each side.5m conservatively covers perspective projection of the existing estimated−4.4m channel/0.11m flat water planes. Holes subtract from intersection. No buildings/terrain/source geometry altered. Pipera will recapture all133; this mask permits other owners to reuse untouched dry views with explicit immutable provenance.','districts':rows}
out=root/'handoffs/fidelity/pipera-fidelity/water-render/shallow-tint/atlas-water-recapture-mask.json';out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps([{k:r[k] for k in ['district','totalFrames','waterReviewFrames','unaffectedFrames']} for r in rows]))
