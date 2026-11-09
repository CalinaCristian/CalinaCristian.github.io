#!/usr/bin/python3
"""Independent typed-cache/seam/roundoff audit, using actual emitted kernel edges."""
import argparse,gzip,hashlib,importlib.util,json,math,pathlib,struct
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--cache',required=True);p.add_argument('--boundary',required=True);p.add_argument('--source',required=True);p.add_argument('--repo',required=True);p.add_argument('--output',required=True);opts=p.parse_args();root=pathlib.Path(opts.repo);encoded=gzip.decompress(pathlib.Path(opts.cache).read_bytes());spec=importlib.util.spec_from_file_location('codec',pathlib.Path(__file__).with_name('regional-cache-codec.py'));codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec);raw=codec.decode(encoded);assert raw[:8]==b'DMCCACHE';version,n=struct.unpack_from('<II',raw,8);assert version==1;body=16+(n+3)//4*4;c=json.loads(raw[16:16+n]);sha=lambda b:hashlib.sha256(b).hexdigest();assert c['sourceDataSHA256']==sha(gzip.decompress(pathlib.Path(opts.source).read_bytes()))
for path,h in c['sourceConsumerHashes'].items():assert sha((root/path).read_bytes())==h,path
def array(d):
 typ={'Float32Array':'<f4','Uint32Array':'<u4','Uint16Array':'<u2'}[d['type']];out=np.frombuffer(raw,dtype=typ,count=d['count'],offset=body+d['byteOffset']);assert out.nbytes==d['byteLength'];return out
batches={}
for batch in c['batches']:
 attrs={k:array(v).reshape(-1,v['itemSize'])for k,v in batch['attributes'].items()};position=attrs['position'];index=array(batch['index']).reshape(-1,3);assert np.isfinite(position).all()and index.max()<len(position)
 for v in attrs.values():assert len(v)==len(position)and np.isfinite(v).all()
 batches[batch['key']]={'attributes':attrs,'position':position,'index':index}
boundary=json.load(open(opts.boundary));land=batches['terrain'];points=land['position'];indices=land['index'];far={s:[]for s in['west','east','north','south']}
for axis,value,side in[(0,-4000,'west'),(0,4000,'east'),(2,-3600,'north'),(2,3600,'south')]:
 other=2 if axis==0 else 0;faces=indices[np.any(points[indices,axis]==value,axis=1)]
 for face in faces:
  edge=points[face];edge=edge[edge[:,axis]==value]
  if len(edge)==2 and edge[0,other]!=edge[1,other]:
   a,b=sorted(edge,key=lambda q:q[other]);far[side].append((float(a[other]),float(b[other]),float(a[1]),float(b[1])))
missing=[];height=0.;tested=0;maxGap=0.;covered=0.
for segment in boundary['drySegments']:
 side=segment['side'];axis=2 if side in('west','east')else 0;A,B=sorted(segment['points'],key=lambda q:q[axis]);lo,hi=A[axis],B[axis];intervals=[]
 if hi==lo:continue
 for a,b,ya,yb in far[side]:
  left=max(lo,a);right=min(hi,b)
  if left>=right:continue
  intervals.append((left,right));covered+=right-left
  for t in[left,(left+right)/2,right]:
   nearY=A[1]+(B[1]-A[1])*(t-lo)/(hi-lo);farY=ya+(yb-ya)*(t-a)/(b-a);height=max(height,abs(nearY-farY));tested+=1
 cursor=lo
 for a,b in sorted(intervals):
  if a>cursor:missing.append({'side':side,'lo':cursor,'hi':a,'lengthM':a-cursor});maxGap=max(maxGap,a-cursor)
  cursor=max(cursor,b)
 if cursor<hi:missing.append({'side':side,'lo':cursor,'hi':hi,'lengthM':hi-cursor});maxGap=max(maxGap,hi-cursor)
# Eight outward Float32 ulps cover the independently serialized seam's two
# endpoint/intersection chains; this is an audit error bound, never padding.
seamBound=8*float(np.spacing(np.float32(4000)));heightBound=seamBound
policy=c['waterBoundaryLOD']['policy'];gain=policy['physicalHeightPx']/2*max(1/math.tan(math.radians(f)/2)+(1+policy['aspectMax']**2)*math.tan(math.radians(f)/2)for f in[policy['fovMinDeg'],policy['fovMaxDeg']]);u=2**-24;gamma=32*u/(1-32*u);maxNumeric=0.
for key in['water','shore']:
 if key not in batches:continue
 pos=batches[key]['position'].astype(float);radius=np.hypot(pos[:,0],pos[:,2]);selected=radius>=policy['exactCollarM']*policy['enuHorizontalLowerScale'];pos=pos[selected];radius=radius[selected]
 if not len(pos):continue
 tail=np.maximum(radius-6000,0);k=np.where(radius<=6000,1,(6000+tail/(1+tail/6000))/radius);coordinate=np.max(np.abs(pos),axis=1);guard=gamma*(3*coordinate+policy['eyeHorizontalBoundM']/k+1);roundoff=np.linalg.norm(np.abs(pos)*2**-24,axis=1);distance=radius-policy['eyeHorizontalBoundM']-roundoff;error=gain*np.arcsin(np.minimum(1,(guard+roundoff)/distance));maxNumeric=max(maxNumeric,float(error.max()))
lod=c['waterBoundaryLOD'];combined=lod['maxCertifiedAdditionalPixelError']+maxNumeric
report={'scope':'Actual typed assets and CPU emitted near-frame seam; calculated Float32/projection envelope. Native shader-driver, images, walking, total-pass and cold-load gates remain open.','cacheSHA256':sha(pathlib.Path(opts.cache).read_bytes()),'uncompressedSHA256':sha(encoded),'restoredContainerSHA256':sha(raw),'sourceSHA256':c['sourceDataSHA256'],'currentConsumerHashesMatch':True,'triangles':{k:len(v['index'])for k,v in batches.items()},'seam':{'nearSegments':len(boundary['drySegments']),'heightComparisons':tested,'coveredLengthSumM':covered,'maximumHeightDifferenceM':height,'maximumUncoveredIntervalM':maxGap,'calculatedSerializationBoundM':seamBound,'uncovered':missing,'passed':height<=heightBound and maxGap<=seamBound},'shorelineLOD':{'policy':policy,'sourcePoints':lod['sourcePoints'],'renderPoints':lod['renderPoints'],'revertedFeatures':lod['revertedFeatures'],'maximumGeometricAdditionalPixelError':lod['maxCertifiedAdditionalPixelError'],'maximumCalculatedNumericPixelError':maxNumeric,'combinedAdditionalPixelBound':combined,'passed':combined<=policy['acceptancePx']},'passed':height<=heightBound and maxGap<=seamBound and combined<=policy['acceptancePx']};pathlib.Path(opts.output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items()if k!='seam'},indent=2));print('seam',height,maxGap,'passed',report['seam']['passed'])
