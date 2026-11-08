from pathlib import Path
import json,math
from PIL import Image
def inside(r,x,z):
 c=False
 for i,a in enumerate(r):
  b=r[i-1]
  if (a[1]>z)!=(b[1]>z) and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:c=not c
 return c
class Point:
 def __init__(self,x,z):self.x=x;self.z=z
class Polygon:
 def __init__(self,r,holes=[]):self.r=r;self.holes=holes;self.bounds=(min(x for x,z in r),min(z for x,z in r),max(x for x,z in r),max(z for x,z in r))
 def contains(self,p):
  a,b,c,d=self.bounds
  return a<=p.x<=c and b<=p.z<=d and inside(self.r,p.x,p.z) and not any(inside(h,p.x,p.z) for h in self.holes)
 def distance(self,p):
  x,z=p.x,p.z;a,b,c,d=self.bounds
  if x<a-3 or x>c+3 or z<b-3 or z>d+3:return 100
  best=1e9
  for r in [self.r]+self.holes:
   for i,a in enumerate(r):
    b=r[i-1];dx=b[0]-a[0];dz=b[1]-a[1];t=max(0,min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz or 1)));best=min(best,math.hypot(x-a[0]-dx*t,z-a[1]-dz*t))
  return best
base=Path('/workspace/reality-pass/pipera/shallow-tint-native-r1');j=json.loads((base/'proof.json').read_text());d=json.loads(Path('/workspace/reality-pass/pipera/final-render-water-tags/game/data/bucharest-floreasca.json').read_text())
def und(a):
 x=z=0;p=[]
 for i in range(0,len(a),2):x+=a[i];z+=a[i+1];p.append((x/10,z/10))
 return p
water=[Polygon(und(a[2]),[und(h) for h in a[3:]]) for a in d['areas'] if d['areaKinds'][a[0]]=='water'];holes=[Polygon(und(h)) for a in d['areas'] if d['areaKinds'][a[0]]=='water' for h in a[3:]]
rows=[]
for row in j['rows']:
 a=Image.open(base/row['before']['image']).convert('RGB');b=Image.open(base/row['after']['image']).convert('RGB');counts={k:{'samples':0,'changed':0} for k in ['water','dry','island']}
 for py in range(8,632,8):
  for px in range(8,632,8):
   x=row['x']+(px/640-.5)*row['size'];z=row['z']+(py/640-.5)*row['size'];p=Point(x,z);iswater=any(w.contains(p) for w in water);margin=row['size']/640*4
   if not iswater and any(w.distance(p)<margin for w in water):continue
   changed=a.getpixel((px,py))!=b.getpixel((px,py));key='water' if iswater else 'dry';counts[key]['samples']+=1;counts[key]['changed']+=changed
   if not iswater and any(h.contains(p) for h in holes):counts['island']['samples']+=1;counts['island']['changed']+=changed
 rows.append({'id':row['id'],'counts':counts,'callsUnchanged':row['callsUnchanged'],'trianglesUnchanged':row['trianglesUnchanged'],'changedBytes':row['changedBytes']})
proof={'schemaVersion':1,'method':'Corrected sample classification from retained actual PNGs and exact native source area rings; north-up image y increases along +worldZ. Original r1 numeric counts had the worldZ sign reversed and are retained raw, not acceptance evidence. Scene before/after images, source geometry, draw/call observations unchanged.','rows':rows};(base/'corrected-source-mask.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
