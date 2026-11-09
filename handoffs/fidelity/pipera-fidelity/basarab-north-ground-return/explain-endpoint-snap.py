"""Classify an observed Navigator CPU-fixture snap without changing routing."""
import argparse,hashlib,json
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--data',type=Path,required=True);ap.add_argument('--navigator-report',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);args=ap.parse_args()
d=json.loads(args.data.read_bytes());n=json.loads(args.navigator_report.read_bytes());assert n['candidateSha256']==hashlib.sha256(args.data.read_bytes()).hexdigest()
r=next(p for p in n['candidate']['paths']if p['from']==1397135743 and p['to']==32933928);c=r['goalEndpointClassification']
assert {e['sourceId']for e in c['incidents']}=={'w139756123','w1559926378','w1559926379'}
assert all(e['main']is False and e['publicDrive']and e['throughAccess']and e['clearance']['eligible']is True for e in c['incidents'])
assert c['nearestPublic']['distanceM']==0 and c['nearestMainClearanceEligible']['selectedEdge']['sourceId']=='w678037220'
assert abs(c['nearestMainClearanceEligible']['distanceM']-r['goalSnapDistanceM'])<1e-9
rows=[]
for i,road in enumerate(d['roads']):
 ids=[d['roadNodeIds'][j]for j in road[10:]]
 if 14189460270 in ids:
  rows.append({'sourceId':d['roadSourceGeometry'][str(i)]['sourceId'],'preparedNodeIds':ids,'source':d['roadSourceGeometry'][str(i)],'roadAccess':d['roadAccess'][str(i)]})
assert {x['sourceId']for x in rows}=={'w50584780','w1559926379'}
assert next(x['preparedNodeIds']for x in rows if x['sourceId']=='w50584780')==[14189460270,-2000000084]
report={'scope':'Read-only endpoint/SCC classification on the deliberately positive-source-only CPU graph. No Navigator/flags/access changes and no native World SCC/arrival claim.','dataSha256':n['candidateSha256'],'navigatorReportSha256':hashlib.sha256(args.navigator_report.read_bytes()).hexdigest(),'requestedGoalNode':32933928,'goalSnapDistanceM':r['goalSnapDistanceM'],'goalClassification':c,'outgoingTailContinuation':rows,'cause':'All exact-goal incidents are public/clearance-eligible but outside the largest SCC of this CPU fixture. The only outgoing positive-source tail reaches14189460270 then w50584780 has a synthetic negative cut. The fixture excludes that leg and has no mapEnd/virtual outside connectivity. Unchanged Navigator.compute prefers a main-SCC endpoint and selects the main service edge77.426706m away rather than the real public incident0m away. A native World includes its own graph/mapEnd/OUT classification; its result must be captured independently.'}
args.out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'cause':'CPU-fixture SCC endpoint filter','nearestPublicDistanceM':0,'selectedMainDistanceM':r['goalSnapDistanceM'],'boundaryTail':'w50584780 to negative cut -2000000084','nativeArrivalAccepted':False}))
