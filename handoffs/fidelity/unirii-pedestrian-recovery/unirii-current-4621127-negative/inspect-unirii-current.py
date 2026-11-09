#!/usr/bin/env python3
"""Index an unchanged bounded native report; never modify raw observations."""
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

raw = Path(sys.argv[1])
out = Path(sys.argv[2])
data = raw.read_bytes()
r = json.loads(data)
assert r['complete'] and r['browserClosed']
rows = r['globalPhysical']
o = r['observation']
vehicle_pairs, peer_pairs = {}, {}
previous_time = r['firstPublication']['publicResolved']['trafficTime']
physical_deltas = []
for row in rows:
    # The call-through wrapper passed undefined, so the production method used
    # its native default fixed step. Undefined JSON fields were omitted. Read
    # durations from the independently recorded physical clocks instead.
    physical_dt = row['trafficTime'] - previous_time
    previous_time = row['trafficTime']
    physical_deltas.append(physical_dt)
    for field, target, names, metric in [
        ('vehicleBodyContacts', vehicle_pairs, ('id', 'id'), 'orientedXZPenetrationM'),
        ('peerBodyEnvelopes', peer_pairs, ('id', 'id'), 'bodyEnvelopePenetrationM'),
    ]:
        for hit in row[field]:
            key = tuple(sorted((hit['a'][names[0]], hit['b'][names[1]])))
            item = target.setdefault(key, {'ids': list(key), 'samples': 0, 'physicalSeconds': 0, 'first': row['trafficTime'], 'last': row['trafficTime'], 'maximumPenetrationM': 0, 'above5cmSamples': 0, 'aboveHalfMetreSamples': 0, 'firstPositive': hit})
            item['samples'] += 1
            item['physicalSeconds'] += physical_dt
            item['last'] = row['trafficTime']
            item['maximumPenetrationM'] = max(item['maximumPenetrationM'], hit[metric])
            item['above5cmSamples'] += hit[metric] > .05
            item['aboveHalfMetreSamples'] += hit[metric] > .5
issues = r['drive']['issues']
hm = [x for x in issues if x['severity'] in ('high', 'medium')]
unknown = {key: sum(len(row[key]) for row in rows) for key in ['unknownVehicleHeights', 'unknownPedestrianModels', 'coverageGaps']}
first_pop = rows[0]['population']
population_changes = sum(row['population'] != first_pop for row in rows)
target_325 = [x for x in o['pedGapCalls'] if any(c['ped']['i'] == 325 for c in x['candidates'])]
caller_214 = [x for x in o['callerSteps'] if x['after']['caller']['ap'] and (x['after']['caller']['ap'].get('leaderInfo') or {}).get('id') == 214]
summary = {
    'sourceCommit': r['sourceCommit'],
    'rawSha256': hashlib.sha256(data).hexdigest(),
    'rawBytes': len(data),
    'complete': True, 'browserClosed': True,
    'sourceFilesVerifiedAfterRun': r['sourceFilesVerifiedAfterRun'],
    'allSourceFilesVerifiedAfterRun': r['allSourceFilesVerifiedAfterRun'],
    'sourceFileCount': len(r['sourceFiles']), 'servedFileCount': len(r['servedFiles']),
    'errors': r['errors'], 'consoleErrors': r['consoleErrors'], 'httpErrors': r['httpErrors'],
    'initial': {'vehicles': r['initial']['vehicles'], 'peds': r['initial']['peds'], 'quality': r['initial']['quality'], 'initialAdmissionPassed': r['initial']['initialAdmission']['passed']},
    'warm': {k: r['warm'][k] for k in ['requestedSeconds', 'simT', 'scT', 'steps', 'issues']},
    'drive': r['drive'],
    'global': {'physicalSamples': len(rows), 'physicalDeltaSource': 'Actual native trafficTime deltas; wrapper optional dt argument was undefined and omitted from raw JSON', 'physicalDeltaMin': min(physical_deltas), 'physicalDeltaMax': max(physical_deltas), 'physicalSeconds': sum(physical_deltas), 'population': first_pop, 'populationChanges': population_changes, 'unknownOrGapCounts': unknown, 'downPedestrianSamples': sum(len(x['downPedestrians']) for x in rows), 'vehiclePairs': list(vehicle_pairs.values()), 'peerPairs': list(peer_pairs.values())},
    'directCaller': {'steps': len(o['callerSteps']), 'actualPaths': len(o['paths']), 'pathRegistries': o['paths'], 'truck214LeaderSteps': len(caller_214), 'firstTruck214Leader': caller_214[0] if caller_214 else None, 'lastTruck214Leader': caller_214[-1] if caller_214 else None},
    'dependency325': {'actualRoadConeSamples': len(target_325), 'first': target_325[0] if target_325 else None, 'last': target_325[-1] if target_325 else None, 'scope': 'Only actual naturally encountered native samples; an absent325/87 encounter is not a challenged dynamic regression.'},
    'contacts': len(o['contacts']), 'impacts': len(o['impacts']), 'placements': o['placements'], 'resets': o['preResets'],
    'issuesBySeverity': dict(Counter(x['severity'] for x in issues)), 'highMediumIssues': hm,
    'frames': [{'label': x['label'], 'camera': x['camera'], 'conditions': x['conditions'], 'calls': x['calls'], 'triangles': x['triangles'], 'passes': x['passes']} for x in o['captures']],
    'acceptedBoundedApproach': r['drive']['result']['ok'] and not r['drive']['result']['resets'] and not o['contacts'] and not hm and not peer_pairs and not any(p['above5cmSamples'] for p in vehicle_pairs.values()) and not any(unknown.values()) and not population_changes and not(r['errors'] or r['consoleErrors'] or r['httpErrors']),
    'scope': 'Native public Unirii first150m plus exact warm-up only. No all-eight, season matrix, corrected rail graph, final display or900s acceptance.',
}
out.write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({'sourceCommit':summary['sourceCommit'], 'drive':r['drive']['result'], 'contacts':summary['contacts'], 'hm':len(hm), 'samples':len(rows), 'vehiclePairs':len(vehicle_pairs), 'peerPairs':len(peer_pairs), 'unknown':unknown, 'populationChanges':population_changes, 'caller214':len(caller_214), 'cone325':len(target_325), 'accepted':summary['acceptedBoundedApproach']}))
