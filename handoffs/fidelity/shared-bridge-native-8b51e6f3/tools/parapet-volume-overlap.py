import json,math,hashlib
B='/workspace/integration-qa-evidence/basarab-shared-8b51e6f3-native/'
D=json.load(open(B+'parapet-complete-canonical-source-feature-slice.json'))
def color(t):return tuple(round(x*255)for x in t['colors'][0])
caps=[t for t in D['triangles']if color(t)==(111,122,134)]
late=[t for t in D['triangles']if color(t)in[(124,119,108),(112,107,97),(134,129,117)]]
def clip(P,score):
 Q=[]
 for a,b in zip(P,P[1:]+P[:1]):
  sa,sb=score(a),score(b)
  if sa>=0:Q.append(a)
  if(sa>=0)!=(sb>=0):
   t=sa/(sa-sb);Q.append([a[k]+(b[k]-a[k])*t for k in range(3)])
 return Q
def area(P):
 s=0
 for i in range(1,len(P)-1):
  a=[P[i][k]-P[0][k]for k in range(3)];b=[P[i+1][k]-P[0][k]for k in range(3)];c=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];s+=math.sqrt(sum(x*x for x in c))/2
 return s
C=[]
for t in caps:
 p,q,r=t['vertices'];den=(q[0]-p[0])*(r[2]-p[2])-(r[0]-p[0])*(q[2]-p[2])
 if abs(den)<1e-12:continue
 A=((q[1]-p[1])*(r[2]-p[2])-(r[1]-p[1])*(q[2]-p[2]))/den
 Z=((q[0]-p[0])*(r[1]-p[1])-(r[0]-p[0])*(q[1]-p[1]))/den
 H=p[1]-A*p[0]-Z*p[2]
 C.append((t,den,A,Z,H))
rows=[]
for t in late:
 P=t['vertices'];parts=[]
 for c,den,A,Z,H in C:
  Q=P[:]
  for a,b in zip(c['vertices'],c['vertices'][1:]+c['vertices'][:1]):
   sign=1 if den>0 else -1
   Q=clip(Q,lambda p:sign*((b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0])))
   if len(Q)<3:break
  if len(Q)<3:continue
  Q=clip(Q,lambda p:A*p[0]+Z*p[2]+H-p[1]);Q=clip(Q,lambda p:p[1]-(A*p[0]+Z*p[2]+H-1.1))
  if len(Q)<3:continue
  ar=area(Q)
  if ar>1e-12:parts.append({'capObject':c['object'],'capTriangle':c['triangle'],'areaM2':ar,'polygon':Q})
 ar=area(P);covered=sum(p['areaM2']for p in parts);rows.append({'object':t['object'],'triangle':t['triangle'],'color':color(t),'areaM2':ar,'summedCapCoveredAreaM2':covered,'coveredFraction':covered/ar if ar else None,'parts':parts})
out={'source':D['source'],'scope':'Continuous 3D polygon clipping of complete actual later separation faces against actual earlier bridge-cap triangles extruded downward by authored1.1m. This is the existing MODEL implied parapet volume, not a surveyed physical solid. Sum coverage may exceed union at overlapping source caps; no removal authority or physical guard/collider change.', 'nativeSliceSha256':hashlib.sha256(open(B+'parapet-complete-canonical-source-feature-slice.json','rb').read()).hexdigest(),'capTriangles':len(C),'laterTriangles':len(rows),'rows':rows}
json.dump(out,open(B+'parapet-continuous-existing-volume-overlap.json','w'),indent=2)
print('caps/later',len(C),len(rows),'fraction range',min(r['coveredFraction']for r in rows),max(r['coveredFraction']for r in rows));print('full',sum(r['coveredFraction']>=1-1e-8 for r in rows),'partial',sum(1e-8<r['coveredFraction']<1-1e-8 for r in rows),'zero',sum(r['coveredFraction']<=1e-8 for r in rows))
for r in rows:
 if (r['object'],r['triangle'])in [('solid 1,-2',3633),('solid 1,-2',3628),('solid 0,-2',39098)]:print(r['object'],r['triangle'],r['coveredFraction'])
