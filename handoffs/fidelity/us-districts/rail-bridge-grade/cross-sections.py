#!/usr/bin/env python3
"""Explicit source-structure rail-normal cross-sections; never nearest-road.

Each side is a reviewed ordered source-way chain. Equal original OSM endpoint
IDs are required between ways. No height is assigned by this source-only tool.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path


def intersections(point, normal, segments):
    found = []
    for a, b, sid, station in segments:
        vx, vz = b[0]-a[0], b[1]-a[1]
        den = normal[0]*vz-normal[1]*vx
        if abs(den) < 1e-8:
            continue
        wx, wz = a[0]-point[0], a[1]-point[1]
        distance = (wx*vz-wz*vx)/den
        t = (wx*normal[1]-wz*normal[0])/den
        if -1e-7 <= t <= 1+1e-7:
            result = {'sourceId':sid, 't':t, 'normalDistanceM':distance,
                      'chainStationM':station+t*math.dist(a,b),
                      'point':[a[0]+vx*t,a[1]+vz*t]}
            if not any(math.dist(result['point'],old['point']) < 1e-6 for old in found):
                found.append(result)
    return found


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--audit', required=True)
    p.add_argument('--side-a', nargs='+', required=True)
    p.add_argument('--side-b', nargs='+', required=True)
    p.add_argument('--rails', nargs='+', required=True)
    p.add_argument('--step', type=float, default=.5)
    p.add_argument('--frame-mode', choices=['leg-normal','vertex-bisector'], default='leg-normal')
    p.add_argument('--out', required=True)
    args = p.parse_args()
    if not args.step > 0:
        raise ValueError('positive step required')
    raw = Path(args.audit).read_bytes()
    data = json.loads(raw)
    roads = {s['sourceId']:s for s in data['candidateStructureRoads']}
    chains, joins = [], []
    for ids in [args.side_a,args.side_b]:
        segments, distance = [], 0
        for i, sid in enumerate(ids):
            road = roads[sid]
            if i:
                previous = roads[ids[i-1]]
                join = {'from':ids[i-1],'to':sid,'a':previous['nodeIds'][-1],'b':road['nodeIds'][0]}
                if join['a'] != join['b']:
                    raise ValueError('source chain lacks identical endpoint: '+str(join))
                joins.append(join)
            for a,b in zip(road['projected'],road['projected'][1:]):
                segments.append((a,b,sid,distance))
                distance += math.dist(a,b)
        chains.append(segments)
    records = []
    for rail in data['selectedWays']:
        if rail['sourceId'] not in args.rails:
            continue
        directions = [[(b[0]-a[0])/math.dist(a,b),(b[1]-a[1])/math.dist(a,b)]
                      for a,b in zip(rail['points'],rail['points'][1:])]
        frames = [directions[0]] + [[a[0]+b[0],a[1]+b[1]] for a,b in zip(directions,directions[1:])] + [directions[-1]]
        frames = [[x/math.hypot(x,z),z/math.hypot(x,z)] for x,z in frames]
        total = 0
        good, bad, widths, positions, counts = [], [], [], [[],[]], [Counter(),Counter()]
        for i,(a,b) in enumerate(zip(rail['points'],rail['points'][1:])):
            length = math.dist(a,b)
            normal = [-(b[1]-a[1])/length,(b[0]-a[0])/length]
            steps = max(1,math.ceil(length/args.step))
            for k in range(steps+1):
                t = k/steps
                point = [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]
                if args.frame_mode == 'vertex-bisector':
                    dx,dz = [frames[i][j]*(1-t)+frames[i+1][j]*t for j in [0,1]]
                    normal = [-dz/math.hypot(dx,dz),dx/math.hypot(dx,dz)]
                hits = [intersections(point,normal,chain) for chain in chains]
                total += 1
                record = {'segment':i,'t':t,'point':point,'sides':hits}
                if len(hits[0]) == 1 and len(hits[1]) == 1 and hits[0][0]['normalDistanceM']*hits[1][0]['normalDistanceM'] < 0:
                    good.append(record)
                    widths.append(abs(hits[0][0]['normalDistanceM']-hits[1][0]['normalDistanceM']))
                    for j in [0,1]:
                        positions[j].append(hits[j][0]['chainStationM'])
                        counts[j][hits[j][0]['sourceId']] += 1
                else:
                    bad.append(record)
        records.append({'sourceId':rail['sourceId'],'totalSamples':total,'uniqueBracketSamples':len(good),
                        'unresolvedSamples':bad,'centrelineSpacingRangeM':[min(widths),max(widths)] if widths else [],
                        'sourceUsageBySide':[dict(c) for c in counts],
                        'chainageBySide':[{'minM':min(v),'maxM':max(v),
                                          'monotonicIncreasing':all(b>=a-1e-6 for a,b in zip(v,v[1:])),
                                          'monotonicDecreasing':all(b<=a+1e-6 for a,b in zip(v,v[1:]))} for v in positions],
                        'endpointSections':[good[0],good[-1]] if good else []})
    output = {'schema':1,'classification':'source-only-no-height-assignment',
              'sourceAuditSha256':hashlib.sha256(raw).hexdigest(),'maxStepM':args.step,
              'frameMode':args.frame_mode,
              'sideSourceIds':[args.side_a,args.side_b],'verifiedOriginalSourceNodeJoins':joins,'railSections':records,
              'limitations':['Reviewed source structure association is an input, not a geometric nearest-road inference.',
                             'Sampled normal brackets establish source correspondence, not native support or surveyed heights.',
                             'A vertex-bisector frame changes only the comparison cross-section direction; every source rail XY remains exact.',
                             'Different source layers, underground crossings and source-connected approaches need separate grade constraints.']}
    Path(args.out).write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps([{k:v for k,v in r.items() if k in ['sourceId','totalSamples','uniqueBracketSamples','centrelineSpacingRangeM','chainageBySide']} for r in records],indent=2))


if __name__ == '__main__':
    main()
