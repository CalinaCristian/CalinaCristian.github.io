#!/usr/bin/env python3
"""Summarise complete native proof without replacing original failures."""
import argparse, collections, gzip, hashlib, json, math
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);a=p.parse_args()
raw=(a.directory/'report.json').read_bytes();j=json.loads(raw);assert j['complete']
summary={'sourceCommit':j['sourceCommit'],'rawSha256':hashlib.sha256(raw).hexdigest(),
         'startedAt':j['startedAt'],'endedAt':j['endedAt'],'complete':True,
         'errors':j['errors'],'consoleErrors':j['consoleErrors'],'failedRequests':j['failedRequests'],
         'originalFailures':j['failures'],'districts':[]}

def spacing(actors):
    pairs=[]
    for i,ped in enumerate(actors):
        for other in actors[i+1:]:
            d=math.hypot(ped['x']-other['x'],ped['z']-other['z'])
            pairs.append({'a':ped['id'],'b':other['id'],'distanceM':d,
                          'bodyPenetrationM':.6-d,'carriedClearanceM':d-ped['reach']-other['reach'],
                          'states':[ped['state'],other['state']]})
    return {'minimumDistanceM':min(p['distanceM'] for p in pairs),
            'minimumCarriedClearanceM':min(p['carriedClearanceM'] for p in pairs),
            'exactDuplicates':sum(p['distanceM']<1e-7 for p in pairs),
            'bodyOverlapPairs':[p for p in pairs if p['bodyPenetrationM']>1e-6],
            'carriedOverlapPairs':[p for p in pairs if p['carriedClearanceM']< -1e-6],
            'closestPairs':sorted(pairs,key=lambda p:p['distanceM'])[:12]}

def intervals(rows, predicate):
    result=[];active=None
    for row in rows:
        if predicate(row):
            if active is None:active={'scenarioStart':row['before']['scenarioTime'],'trafficStart':row['before']['trafficTime'],'steps':0,'physicalSeconds':0}
            active['steps']+=1;active['physicalSeconds']+=row['dt'];active['scenarioEnd']=row['after']['scenarioTime'];active['trafficEnd']=row['after']['trafficTime']
        elif active:result.append(active);active=None
    if active:result.append(active)
    return result

for d in j['districts']:
    init=d['initialAdmission'];initial=d['initialPopulation'];actors=init['actors']
    for source in j['sourceFiles']:
        f=Path(j['root'])/source['path']
        assert f.is_file() and hashlib.sha256(f.read_bytes()).hexdigest()==source['sha256']
    before_spacing=spacing(init['beforeActors']);after_spacing=spacing(actors)
    statics=[{'id':ped['id'],'state':ped['state'],'feetY':ped['feetY'],'nativeCollisionHeight':ped['nativeCollisionHeight'],
              'colliders':ped['colliders']} for ped in init['beforeActors'] if ped['colliders']]
    final_statics=[{'id':ped['id'],'state':ped['state'],'colliders':ped['colliders']} for ped in actors if ped['colliders']]
    stand_repairs=[r for r in init['repairs'] if r['method']=='admitInitialStand']
    stands=[]
    for r in stand_repairs:
        q=r['after'];stop=q['stop'];dist=math.hypot(q['x']-stop['x'],q['z']-stop['z']);assert dist<=8+1e-6
        assert r['before']['state']==q['state']=='stand' and not q['live']
        stands.append({'id':q['id'],'distanceFromSourceStopM':dist,'sourceStop':stop,'sourceSidewalk':q['stopSourceSidewalk']})
    D={'id':d['id'],'sourceFilesChecked':len(j['sourceFiles']),'initialPopulation':{'vehicles':initial['vehicles'],'people':initial['people']},
       'admission':{'stats':init['stats'],'allIdsRetained':sorted(p['id'] for p in actors)==list(range(initial['people'])),
                    'allPrevisible':all(not p['live'] for p in actors),'beforeSpacing':before_spacing,'afterSpacing':after_spacing,
                    'originalStaticContacts':statics,'remainingStaticContacts':final_statics,
                    'remainingWalkingOrVehicleFailures':[{'id':p['id'],'state':p['state'],'freeWalkingBody':p['freeWalkingBody'],'freeVehicleBody':p['freeVehicleBody']} for p in actors if not p['freeWalkingBody'] or not p['freeVehicleBody']],
                    'standingRepairSourceBindings':stands},'drives':[],'renderFrames':[]}
    for case in d['cases']:
        for pop in [case['populationBefore'],case['populationAfter']]:
            assert pop['allVehicleIds']==initial['allVehicleIds'] and pop['pedIds']==initial['pedIds']
        for capture in case['captures']:
            assert hashlib.sha256((a.directory/capture['file']).read_bytes()).hexdigest()==capture['sha256']
            D['renderFrames'].append({'label':capture['label'],'file':capture['file'],'sha256':capture['sha256'],
                                      'frames':[{'calls':f['calls'],'triangles':f['triangles'],'passes':f['passes'],'pose':f['pose'],'camera':f['camera']} for f in capture['frames']]})
        for drive in case['drives']:
            rows=drive['pairSteps']
            for row in rows:
                for clock in ['trafficTime','harnessSim']:
                    assert abs(row['after'][clock]-row['before'][clock]-row['dt'])<1e-8
            peds=[]
            for k,pedid in enumerate([401,252]):
                moves=[math.hypot(r['after']['peds'][k]['x']-r['before']['peds'][k]['x'],r['after']['peds'][k]['z']-r['before']['peds'][k]['z']) for r in rows]
                peds.append({'id':pedid,'maxPhysicalStepM':max(moves,default=0),'travelledM':sum(moves),
                             'onCarriagewayIntervals':intervals(rows,lambda r:r['after']['peds'][k]['detector']['onCarriageway']),
                             'insideAnyVehicleCentreIntervals':intervals(rows,lambda r:any(v['detectorInside'] for v in r['after']['peds'][k]['nearVehicles'])),
                             'bodyDiscContactIntervals':intervals(rows,lambda r:any(v['bodyDiscPenetrationM']>1e-6 and abs((v['y'] or .24)-(r['after']['peds'][k].get('y') or .24))<2 for v in r['after']['peds'][k]['nearVehicles'])),
                             'legitimateCrossingSteps':sum(r['after']['peds'][k]['detector']['atLegitimateCrossing'] for r in rows)})
            active=[r for r in rows if not any(v.get('inactive') for v in r['after']['actors'])]
            D['drives'].append({'condition':case['condition'],'phase':drive['phase'],'result':drive['drive'],'contacts':drive['contacts'],
                                'physicalSeconds':sum(r['dt'] for r in rows),'steps':len(rows),'pedestrians':peds,'issues':drive['issues'],
                                'pair148461':{'activeSteps':len(active),'maxActiveXZPenetrationM':max((r['after']['overlap']['orientedXZPenetrationM'] for r in active),default=None),
                                              'intervalsAboveHalfMetre':intervals(rows,lambda r:not any(v.get('inactive') for v in r['after']['actors']) and r['after']['overlap']['orientedXZPenetrationM']>.5 and r['after']['overlap']['verticalOverlapM']>0)}})
    summary['districts'].append(D)
(a.directory/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
(a.directory/'report.json.gz').write_bytes(gzip.compress(raw,compresslevel=9,mtime=0))
print(json.dumps({'sourceCommit':j['sourceCommit'],'errors':len(j['errors']),
                  'admissions':[{'id':d['id'],'stats':d['admission']['stats'],'remainingStatic':len(d['admission']['remainingStaticContacts']),
                                 'remainingBodyPairs':len(d['admission']['afterSpacing']['bodyOverlapPairs']),'minimumPeerDistanceM':d['admission']['afterSpacing']['minimumDistanceM']} for d in summary['districts']],
                  'drives':[{'condition':r['condition']['id'],'phase':r['phase'],'result':r['result'],'pair':r['pair148461']} for d in summary['districts'] for r in d['drives']],
                  'summarySha256':hashlib.sha256((a.directory/'summary.json').read_bytes()).hexdigest(),'gzipBytes':(a.directory/'report.json.gz').stat().st_size}))
