#!/usr/bin/env python3
"""Summarise observed physical durations and actual per-draw attribution."""
import argparse,collections,hashlib,json,math,os
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);a=p.parse_args();j=json.loads((a.directory/'report.json').read_text());assert j['complete']
def runs(rows,predicate):
 result=[];active=None
 for row in rows:
  if predicate(row):
   if active is None:active={'startTrafficTime':row['before']['trafficTime'],'endTrafficTime':row['after']['trafficTime'],'steps':0}
   active['endTrafficTime']=row['after']['trafficTime'];active['steps']+=1
  elif active:result.append(active);active=None
 if active:result.append(active)
 for r in result:r['physicalSeconds']=r['endTrafficTime']-r['startTrafficTime']
 return result
summary={'sourceCommit':j['sourceCommit'],'method':'Read-only observer replay. Durations sum actual30Hz physical steps and native traffic clocks, not wall time or detector count. Raw before/after actor states, legs, source roads, body margins and renderer state are retained.','errors':j['errors'],'pedestrians':[],'renderFrames':[]}
for row in j['steps']:
 assert abs(row['after']['trafficTime']-row['before']['trafficTime']-row['dt'])<1e-9
 assert abs(row['after']['harnessSim']-row['before']['harnessSim']-row['dt'])<1e-9
for index,pedid in enumerate([401,252]):
 rows=j['steps'];road=runs(rows,lambda r:r['after']['peds'][index]['detector']['onCarriageway']);inside=runs(rows,lambda r:any(v['id']==264 and v['detectorInside'] for v in r['after']['peds'][index]['nearVehicles']));moves=[math.hypot(r['after']['peds'][index]['x']-r['before']['peds'][index]['x'],r['after']['peds'][index]['z']-r['before']['peds'][index]['z']) for r in rows]
 summary['pedestrians'].append({'id':pedid,'initial':rows[0]['before']['peds'][index],'final':rows[-1]['after']['peds'][index],'travelledM':sum(moves),'maxPhysicalStepM':max(moves),'observedPhysicalSeconds':sum(r['dt'] for r in rows),'roadDetectorIntervals':road,'longestRoadDetectorSeconds':max((r['physicalSeconds'] for r in road),default=0),'insideSedan264Intervals':inside,'longestInsideSedan264Seconds':max((r['physicalSeconds'] for r in inside),default=0),'insideSedan264Seconds':sum(r['physicalSeconds'] for r in inside),'legitimateCrossingSteps':sum(bool(r['after']['peds'][index]['detector']['atLegitimateCrossing']) for r in rows),'states':dict(collections.Counter(r['after']['peds'][index]['state'] for r in rows))})
for frame in j['frames']:
 passes={}
 for name in sorted({d['pass'] for d in frame['draws']}):
  draws=[d for d in frame['draws'] if d['pass']==name];grouped={}
  for d in draws:
   key=(d['object']['id'],d['material']['id']);row=grouped.setdefault(key,{'object':d['object'],'material':d['material'],'calls':0,'triangles':0,'instanceCount':d['instances']['count'] if d['instances'] else None,'attributeWorldBounds':d['attributeWorldBounds'],'cellFrustum':d['object']['cellFrustum']});row['calls']+=d['calls'];row['triangles']+=d['triangles']
  passes[name]={'calls':sum(d['calls'] for d in draws),'triangles':sum(d['triangles'] for d in draws),'contributors':sorted(grouped.values(),key=lambda d:d['triangles'],reverse=True)}
 summary['renderFrames'].append({'calls':frame['calls'],'triangles':frame['triangles'],'passes':passes,'pose':frame['pose'],'camera':frame['camera'],'environment':frame['environment']})
summary['boundsMeaning']='Bounds are computed independently from the actual selected attribute/index draw ranges and active instance matrices. They do not alter geometry or certify vertex-shader sway extents.'
(a.directory/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
os.environ.setdefault('MPLCONFIGDIR','/tmp/remaining-ro-matplotlib')
import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
fig,axes=plt.subplots(2,2,figsize=(13,9),layout='constrained')
for col,pedid in enumerate([401,252]):
 states=[r['after']['peds'][col] for r in j['steps']];times=[r['after']['trafficTime'] for r in j['steps']];ax=axes[0,col];roadbool=[int(s['detector']['onCarriageway']) for s in states];cross=[int(s['detector']['atLegitimateCrossing']) for s in states];insidebool=[int(any(v['id']==264 and v['detectorInside'] for v in s['nearVehicles'])) for s in states];ax.plot(times,roadbool,label='Carriageway detector');ax.plot(times,cross,label='Crossing leg');ax.plot(times,insidebool,label='Inside sedan264 body');ax.set(title=f'Pedestrian {pedid}: actual30Hz states',xlabel='Native traffic clock (s)',ylabel='Boolean state',ylim=(-.1,1.3));ax.legend(fontsize=8)
 ax=axes[1,col];roads={s['detector']['nearestSourceRoad']['id']:s['detector']['nearestSourceRoad'] for s in states if s['detector']['nearestSourceRoad']}
 for e in roads.values():
  ax.plot([e['a']['x'],e['b']['x']],[e['a']['z'],e['b']['z']],color='#aaaaaa',linewidth=1);ax.text((e['a']['x']+e['b']['x'])/2,(e['a']['z']+e['b']['z'])/2,str(e['id']),fontsize=6,color='#666666')
 xs=[s['x'] for s in states];zs=[s['z'] for s in states];ax.plot(xs,zs,label='Actual physical path',color='#1664b1');ax.scatter([xs[0],xs[-1]],[zs[0],zs[-1]],c=['#148442','#ce3d2a'],s=36,zorder=4);ax.scatter([s['x'] for s in states if s['detector']['onCarriageway']],[s['z'] for s in states if s['detector']['onCarriageway']],s=4,color='#e19b23',label='Carriageway flag',zorder=3);ax.set(xlabel='Source world X (m)',ylabel='Source world Z (m)',title=f'Pedestrian {pedid}: observed path/source centrelines');ax.set_xlim(min(xs)-12,max(xs)+12);ax.set_ylim(min(zs)-12,max(zs)+12);ax.set_aspect('equal');ax.invert_yaxis();ax.legend(fontsize=8)
fig.savefig(a.directory/'pedestrian-physical-traces.png',dpi=140);plt.close(fig)
print(json.dumps({'sourceCommit':j['sourceCommit'],'physicalSeconds':sum(r['dt'] for r in j['steps']),'pedestrians':[{k:r[k] for k in ['id','travelledM','maxPhysicalStepM','longestRoadDetectorSeconds','longestInsideSedan264Seconds','legitimateCrossingSteps']} for r in summary['pedestrians']],'frames':[{k:f[k] for k in ['calls','triangles']} for f in summary['renderFrames']],'summarySha256':hashlib.sha256((a.directory/'summary.json').read_bytes()).hexdigest()}))
