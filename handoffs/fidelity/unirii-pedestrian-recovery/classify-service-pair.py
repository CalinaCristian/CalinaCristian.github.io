#!/usr/bin/env python3
"""Retain exact native guard attribution; no synthetic movement or edited clocks."""
import argparse, gzip, hashlib, json, math, shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
raw=(a.directory/'report.json').read_bytes();j=json.loads(raw);assert j['complete'];a.output.mkdir(parents=True,exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def penetration(a,b,old=False):
    x,z,h=(a['_x0'],a['_z0'],a['_h0']) if old else (a['x'],a['z'],a['heading'])
    af=(-math.sin(h),-math.cos(h));bf=(-math.sin(b['heading']),-math.cos(b['heading']));dx=b['x']-x;dz=b['z']-z
    return min(abs(af[0]*u+af[1]*v)*a['length']/2+abs(-af[1]*u+af[0]*v)*a['width']/2+abs(bf[0]*u+bf[1]*v)*b['length']/2+abs(-bf[1]*u+bf[0]*v)*b['width']/2-abs(dx*u+dz*v)for u,v in[af,(-af[1],af[0]),bf,(-bf[1],bf[0])])
def vertical(g):
    a,b=g['afterGuard']['actors'];return min(a['y']+a['height'],b['y']+b['height'])-max(a['y'],b['y'])
def intervals(rows):
    out=[];cur=None
    for g in rows:
        active=all(not x.get('inactive')for x in g['afterGuard']['actors']) and vertical(g)>0 and g['afterGuard']['penetrationM']>.5
        if active:
            if cur is None:cur={'firstTrafficTime':g['trafficTime'],'firstFrame':g['frame'],'steps':0,'peakPenetrationM':0}
            cur['steps']+=1;cur['lastTrafficTime']=g['trafficTime'];cur['lastFrame']=g['frame'];cur['peakPenetrationM']=max(cur['peakPenetrationM'],g['afterGuard']['penetrationM'])
        elif cur:cur['physicalSeconds']=cur['steps']/30;out.append(cur);cur=None
    if cur:cur['physicalSeconds']=cur['steps']/30;out.append(cur)
    return out
summary={'sourceCommit':j['sourceCommit'],'startedAt':j['startedAt'],'endedAt':j['endedAt'],'rawSha256':sha(raw),'complete':True,'errors':j['errors'],'consoleErrors':j['consoleErrors'],'failedRequests':j['failedRequests'],'originalFailures':j['failures'],'drives':[]}
for s in j['sourceFiles']:
    b=(Path(j['root'])/s['path']).read_bytes();assert sha(b)==s['sha256']
summary['sourceFilesChecked']=len(j['sourceFiles'])
for c in j['districts'][0]['cases']:
    for d in c['drives']:
        gs=d['servicePair'];summary['drives'].append({'condition':c['condition'],'phase':d['phase'],'result':d['drive'],'originalIssues':d['issues'],'contacts':len(d['contacts']),'physicalSteps':len(gs),'firstTrafficTime':gs[0]['trafficTime'],'lastTrafficTime':gs[-1]['trafficTime'],'peakPenetrationM':max(g['afterGuard']['penetrationM']for g in gs),'trueDeepIntervals':intervals(gs)})
w=j['districts'][0]['cases'][-1]['drives'][0];gs=w['servicePair'];miss=[];apart=[]
for i,g in enumerate(gs):
    a0,b0=g['beforeGuard']['actors'];p=g['beforeGuard']['penetrationM'];p0=penetration(a0,b0,True);delta=math.hypot(a0['x']-b0['x'],a0['z']-b0['z'])-math.hypot(a0['_x0']-b0['x'],a0['_z0']-b0['z']);waived=p0>.05 and p<p0+.04 and delta>.005
    if waived and p>p0+.002:apart.append(i)
    if g['afterGuard']['penetrationM']>.05 and p>p0+.002 and not waived and a0['_f']==g['frame'] and not a0['_resp'] and g['afterGuard']['actors'][0]['x']==a0['x']:miss.append((i,p0,delta))
i,p0,delta=miss[0];g=gs[i];actors=g['beforeGuard']['actors'];old=w['pairSteps'][i]['before']['actors'];
summary['firstMissedWorseningQuery']={'index':i,'trafficTime':g['trafficTime'],'frame':g['frame'],'proposedPenetrationM':g['beforeGuard']['penetrationM'],'previousFirstBodyAgainstProposedOtherM':p0,'afterGuardPenetrationM':g['afterGuard']['penetrationM'],'firstBodyCentreDistanceChangeM':delta,'apart':False,'beforePhysicalActors':old,'proposedActors':actors,'afterGuardActors':g['afterGuard']['actors'],'oldCells':[[math.floor(v['x']/16),math.floor(v['z']/16)]for v in old],'proposedCells':[[math.floor(v['x']/16),math.floor(v['z']/16)]for v in actors]}
summary['conclusion']='True same-level rendered-body overlap. Car609 repeatedly crosses a16m hash-cell boundary after the index is built; filtering by its current cell makes it disappear from the other body query. The exact first missed worsening proposal has apart=false, stable generations2/3, and _resp=false for both. This is not new admission, a different road height, or evidence requiring a new ghost/timeout exemption. The separate caller no-progress finding remains in original issues.'
summary['earlyProposedApartWaiversBeforeFirstMiss']=sum(x<i for x in apart)
(a.output/'classification.json').write_text(json.dumps(summary,indent=2)+'\n')
(a.output/'report.json.gz').write_bytes(gzip.compress(raw,compresslevel=9,mtime=0))
for e in j['observerFiles']:
    src=Path(__file__).parent/e['file'];b=src.read_bytes();assert sha(b)==e['sha256'],e['file'];(a.output/e['file']).write_bytes(b)
shutil.copy(a.directory.parent/(a.directory.name+'.log'),a.output/'execution.log')
shutil.copy(a.directory/'unirii-winter-first150m-pre-reset-0.png',a.output/'unirii-winter-first150m-pre-reset-0.png')
manifest={'sourceCommit':j['sourceCommit'],'rawSha256':sha(raw),'kind':'Complete unchanged-source negative native diagnostic, retained without issue suppression','artifacts':[{'path':f.name,'bytes':f.stat().st_size,'sha256':sha(f.read_bytes())}for f in sorted(a.output.iterdir())if f.name!='manifest.json']}
(a.output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'source':j['sourceCommit'],'firstMiss':{'frame':g['frame'],'time':g['trafficTime'],'p':g['beforeGuard']['penetrationM'],'p0':p0},'deepIntervals':summary['drives'][-1]['trueDeepIntervals'],'gzipBytes':(a.output/'report.json.gz').stat().st_size,'errors':len(j['errors'])}))
