"""Read the immutable observer once; emit portable native-method inputs/timeline."""
import json, sys, hashlib, collections
from pathlib import Path
raw, out = map(Path, sys.argv[1:3]); out.mkdir(parents=True, exist_ok=True)
buf=raw.read_bytes(); r=json.loads(buf); o=r['observation']
def write(name, value): (out/name).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')
def small(p):
    return {k:v for k,v in p.items() if k not in ('e','legs')} | {'edgeId':(p.get('e')or{}).get('id'),'sourceId':(p.get('e')or{}).get('sourceId'),'legs':[{k:v for k,v in l.items()if k not in ('node','edge')}|{'nodeId':(l.get('node')or{}).get('id'),'edgeId':(l.get('edge')or{}).get('id')}for l in p.get('legs',[])]}
s=min(o['samples'],key=lambda s:abs(s['t']-56.1)); p=next(p for p in s['nearPedestrians']if p['i']==325)
timelines=collections.defaultdict(list)
for s0 in o['samples']:
    for p0 in s0['nearPedestrians']:
        if p0['i'] in (71,73,324,325): timelines[p0['i']].append({'t':s0['t'],'step':s0['step'],'origin':'post-step-half-second' if s0['label']=='half-second' else s0['label'],'ped':small(p0)})
for q in o['pedGapCalls']:
    for c in q['candidates']:
        p0=c['ped']
        if p0['i'] in (71,73,324,325): timelines[p0['i']].append({'t':q['t'],'step':q['step'],'origin':'before-87-pedestrianGap','ped':small(p0),'gap':c['gap']})
for q in o['vehicleSteps']:
    if q['after']['id']!=87: continue
    for c in q['pedCone']:
        p0=c['ped']
        if p0['i'] in (71,73,324,325): timelines[p0['i']].append({'t':q['t'],'step':q['step'],'origin':'after-87-vehicle-step-before-pedestrians','ped':small(p0),'gap':c['gap']})
for items in timelines.values(): items.sort(key=lambda q:(q['step'],q['origin']))
rows=timelines[325]; half=[q for q in rows if q['origin']=='post-step-half-second']; firstStarted=next(q for q in half if q['ped']['state']=='legs' and (q['ped']['legs']or[{}])[0].get('started')); firstBack=next(q for q in half if (q['ped']['legs']or[{}])[0].get('back'))
summary={'firstLocalRecord':rows[0], 'startedBracket':{'lastRecordedNotStarted':max((q for q in half if q['t']<firstStarted['t'] and not(q['ped']['legs']or[{}])[0].get('started')),key=lambda q:q['t']),'firstRecordedStarted':firstStarted},'backBracket':{'lastRecordedNotBack':max((q for q in half if q['t']<firstBack['t'] and not(q['ped']['legs']or[{}])[0].get('back')),key=lambda q:q['t']),'firstRecordedBack':firstBack},'recordsByPedestrian':{k:len(v)for k,v in timelines.items()},'pedestrian324ObservedRecords':len(timelines[324]),'scope':'Native snapshots; no direct per-pedestrian guard/static callbacks were captured. Half-second times and before-vehicle-step times have different phases. A missing local record is not absence from the full scene.'}
claims=[]
for s0 in o['samples']:
    cs=next((c for c in s0['claims']if c['controller'].get('id')==139),None)
    if cs: claims.append({'t':s0['t'],'step':s0['step'],'controller':cs['controller'],'claims':cs['claims'],'truck214':next((v for v in s0['nearVehicles']if v['id']==214),None),'vehicle87':s0['vehicle87'],'vehicle187':next((v for v in s0['nearVehicles']if v['id']==187),None)})
nearestPeers=sorted(({'i':q['i'],'distance':((q['x']-p['x'])**2+(q['z']-p['z'])**2)**.5,'ped':small(q)}for q in s['nearPedestrians']if q is not p),key=lambda q:q['distance'])
gap= min(o['pedGapCalls'],key=lambda q:abs(q['t']-56.1))
fixture={'sourceCommit':r['sourceCommit'],'sourceTrafficSha256':r['inputs']['game/src/traffic.js']['sha256'],'rawSha256':hashlib.sha256(buf).hexdigest(),'sampleTime':s['t'],'vehicle87':s['vehicle87'],'pedestrian325':p,'actualGapCallback':gap,'nearestRecordedPeers':nearestPeers[:4],'scope':'Exact native poses; fixture isolates vehicle87 as a sufficient return-step blocker. No claim that full static/peer guard results were observed.'}
write('pedestrian-vehicle-input.json',fixture);write('pedestrian-timelines.json',{'sourceCommit':r['sourceCommit'],'scope':summary['scope'],'summary':summary,'timelines':timelines});write('node139-claim-history.json',{'sourceCommit':r['sourceCommit'],'scope':'Actual serialized reservations. Truck214 boxCheck and owner187 physical steps were not wrapped; owner poses may be outside local capture. Retained claims alone do not identify which branch selected wait.','samples':claims})
write('native-header.json',{k:v for k,v in r.items()if k!='observation'}|{'rawBytes':len(buf),'rawSha256':hashlib.sha256(buf).hexdigest(),'observationCounts':{k:len(v)for k,v in o.items()if isinstance(v,list)}})
print(json.dumps({'ped325Records':len(rows),'halfSecondStarted':firstStarted['t'],'halfSecondBack':firstBack['t'],'claimSamples':len(claims),'owner187Poses':sum(q['vehicle187']is not None for q in claims),'ped324Records':len(timelines[324])}))
