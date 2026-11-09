"""Small CPU supplement: source direction, road-relative offset, render-line identity."""
from pathlib import Path
import json,math,sys,hashlib
b,source=map(Path,sys.argv[1:3]);R=json.loads((b/'raw-audit.json').read_bytes());rails=json.loads((b/'all-tram-source-ways.json').read_bytes());D=json.loads((source/'game/data/bucharest-grozavesti.json').read_bytes());byWay={w['id']:w for w in rails}
def nearest(p,pl):
    best=None
    for i,(a,c)in enumerate(zip(pl,pl[1:])):
        dx=c[0]-a[0];dz=c[1]-a[1];L2=dx*dx+dz*dz
        if not L2:continue
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/L2));q=[a[0]+t*dx,a[1]+t*dz];d=math.dist(p,q)
        if best is None or d<best['distance']:best={'distance':d,'point':q,'segmentIndex':i,'segmentT':t}
    return best
def decode(a):
    x=z=0;out=[]
    for i in range(0,len(a),2):x+=a[i];z+=a[i+1];out.append([x/10,z/10])
    return out
lines=[decode(a)for a in D['trams']];renderMatches=[]
for i,pl in enumerate(lines):
    candidates=[]
    for w in rails:
        errors=[nearest(p,w['points'])['distance']for p in pl]
        candidates.append({'sourceWayId':w['id'],'maxPointToSourceM':max(errors),'meanPointToSourceM':sum(errors)/len(errors)})
    pick=min(candidates,key=lambda q:q['maxPointToSourceM'])
    renderMatches.append({'preparedTramIndex':i,'preparedPointCount':len(pl),**pick,'points':pl})
actors=[]
for a in R['actorAlignment']:
    v=next(v for v in R['nativeActors']if v['id']==a['id']);e=v['edge'];correct=[q for q in a['nearestRailsAtCenter']if q['headingDot']>0 and q['tags'].get('oneway')=='yes'];q=min(correct,key=lambda q:q['distance']);w=byWay[q['wayId']];lo,hi=w['nodeIds'][q['segmentIndex']:q['segmentIndex']+2];point=q['point'];lateral=(point[0]-e['a']['x'])*e['nx']+(point[1]-e['a']['z'])*e['nz'];roadS=(point[0]-e['a']['x'])*e['dirx']+(point[1]-e['a']['z'])*e['dirz'];
    # Distance to a polyline is 1-Lipschitz; this lower bound covers every
    # point between the 25 samples, not just their centres.
    continuousBound=a['minimumNearestRailDistanceM']-a['lengthM']/48
    actors.append({'id':a['id'],'nativeMotorEdge':e['id'],'nativeRoadSource':e['sourceId'],'nativeMotorDir':v['dir'],'nativeMotorOneway':e['oneway'],'nativeRoadMedianM':e['median'],'nativeRoadLaneWidthM':e['laneW'],'nativeRoadLaneCenterShiftM':e['laneCenterShiftM'],'nativeCenterRoadLateralM':(v['x']-e['a']['x'])*e['nx']+(v['z']-e['a']['z'])*e['nz'],'correctDirectionRail':{'sourceWayId':q['wayId'],'sourceNodePair':[lo,hi],'sourceSegmentT':q['segmentT'],'nearestSourcePoint':point,'centerDistanceM':q['distance'],'headingDot':q['headingDot'],'roadRelativeLateralM':lateral,'roadRelativeStationM':roadS,'gaugeMm':w['tags'].get('gauge'),'oneway':w['tags'].get('oneway'),'gradeTags':{k:w['tags'].get(k)for k in ['layer','bridge','tunnel','ele','incline']}},'allRailContinuousCenterlineDistanceLowerBoundM':continuousBound,'bodyHalfWidthM':a['widthM']/2,'trackCenterProvablyOutsideWholeBodyXY':continuousBound>a['widthM']/2,'scope':'Projected raw mapped track center, not a clearance survey or a runtime placement proposal. Current rigid body is compared as drawn; rail gauge does not define body envelope.'})
chains=[]
for r in R['relations']:
    for q in r['selectedRailMembers']:
        i=q['index'];wid=int(q['ref']);w=byWay[wid];adj=[]
        for j in[i-1,i+1]:
            m=r['members'][j];other=byWay.get(int(m['ref']))if m['type']=='way'else None
            adj.append({'memberIndex':j,**m,'neighborSourceNodes':other['nodeIds']if other else None,'sharedEndpointNodeIds':sorted(set(w['nodeIds'][::max(1,len(w['nodeIds'])-1)])&set(other['nodeIds'][::max(1,len(other['nodeIds'])-1)]))if other else []})
        chains.append({'relationId':r['id'],'ref':r['tags'].get('ref'),'name':r['tags'].get('name'),'note':r['tags'].get('note'),'wayId':wid,'memberIndex':i,'memberRole':q['role'],'wayOneway':w['tags'].get('oneway'),'wayStartNode':w['nodeIds'][0],'wayEndNode':w['nodeIds'][-1],'adjacentMembers':adj})
assert len(renderMatches)>=2
assert all(q['maxPointToSourceM']<.071 for q in renderMatches)
assert all(q['trackCenterProvablyOutsideWholeBodyXY']for q in actors)
out={'sourceCommit':R['sourceCommit'],'fixtureSha256':R['fixtureSha256'],'preparedRenderedTramLines':renderMatches,'actors':actors,'relationDirectionChains':chains,'provenance':'Derived from immutable native fixture, 16 cached OSM XML tiles and exact prepared source data. No browser/network or production edits.','uncertainties':['Road7m width/lane3.5m are runtime defaults, not explicit OSM measured width for these motor roads.','Gauge1435mm is between rails, not track-bed width or vehicle clearance.','Rail absolute height/slope/deck datum is unmeasured; absent bridge/layer tags on local ground ways does not survey elevation.','Route11 relations retain Temporary suspended due to rail repair note. Route1/10 mapping is source relation evidence, not a live-service timetable.']};(b/'alignment-findings.json').write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n');print(json.dumps({'actors':actors,'renderMatches':[{k:v for k,v in q.items()if k!='points'}for q in renderMatches]},indent=2))
