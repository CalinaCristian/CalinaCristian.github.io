#!/usr/bin/env python3
"""Reduce an immutable native probe; never edits source, screenshots or profiles."""
import argparse, collections, gzip, hashlib, json, pathlib

p = argparse.ArgumentParser()
p.add_argument('raw', type=pathlib.Path)
p.add_argument('output', type=pathlib.Path)
a = p.parse_args()
report = json.loads((a.raw / 'report.json').read_text())
out = {'sourceCommit': report['sourceCommit'], 'browserClosed': report['browserClosed'],
       'scope': 'Read-only renderBufferDirect deltas and CDP CPU sampling. Inclusive timings overlap; CPU sampling and draw wrappers add overhead. Unprofiled cold timings remain authoritative.',
       'probeErrors': report['errors'], 'inputHashes': {}, 'scopes': []}
for f in sorted(a.raw.iterdir()):
    if f.is_file():
        out['inputHashes'][f.name] = {'bytes': f.stat().st_size, 'sha256': hashlib.sha256(f.read_bytes()).hexdigest()}

def reduce_draws(rows, key):
    groups = collections.defaultdict(lambda: {'calls': 0, 'triangles': 0, 'wrappedCPUms': 0})
    for d in rows:
        g = groups[key(d)]
        for name in ('calls', 'triangles'):
            g[name] += d[name]
        g['wrappedCPUms'] += d['cpuMs']
    return sorted(({'group': k, **v} for k, v in groups.items()), key=lambda r: -r['triangles'])

def draw_category(d):
    n = d['name']
    if n.startswith('source-context:'): return 'source-building-context'
    if n.startswith('water-source:'): return 'source-water'
    if 'tree' in n.lower():
        return 'source-trees' if n.endswith(' near') or n.endswith(' far') else 'native-trees'
    if 'literal-source-' in ' '.join(d['ancestors']): return 'source-ground-context'
    if n.startswith('terrain-'): return 'native-terrain'
    return 'other-native-and-post'

for scope in report['scopes']:
    s = {'spot': scope['spot'], 'profiledLoad': scope['load'], 'errors': scope['errors'], 'frames': []}
    for f in scope['frames']:
        assert f['unattributed'] == {'calls': 0, 'triangles': 0}, 'Unattributed render work must remain explicit'
        summary = {k: f[k] for k in ('label', 'stats', 'drawCounterSums', 'unattributed', 'camera', 'controller', 'mountains')}
        summary['byPass'] = reduce_draws(f['draws'], lambda d: d['pass'])
        summary['byCategory'] = reduce_draws(f['draws'], draw_category)
        summary['byObjectAndPass'] = reduce_draws(f['draws'], lambda d: d['pass'] + ' | ' + (d['name'] or ' > '.join(d['ancestors'][:3])))
        summary['sourceTrees'] = f['sourceTrees']
        s['frames'].append(summary)
    raw = json.loads(gzip.decompress((a.raw / (scope['spot'] + '-cpu-profile.json.gz')).read_bytes()))
    nodes = {n['id']: n for n in raw['nodes']}
    parents = {c: n['id'] for n in raw['nodes'] for c in n.get('children', [])}
    selfs, inclusive = collections.Counter(), collections.Counter()
    for node, delta in zip(raw['samples'], raw['timeDeltas']):
        selfs[node] += delta
        while node in nodes:
            inclusive[node] += delta
            node = parents.get(node)
    def top(counter):
        return [{'sampledMs': us / 1000, 'function': nodes[i]['callFrame']['functionName'],
                 'url': nodes[i]['callFrame']['url'], 'line': nodes[i]['callFrame']['lineNumber'] + 1}
                for i, us in counter.most_common(60)]
    s['cpu'] = {'wallProfileMs': (raw['endTime'] - raw['startTime']) / 1000,
                'sampledMs': sum(raw['timeDeltas']) / 1000, 'sampleCount': len(raw['samples']),
                'selfTop': top(selfs), 'inclusiveTop': top(inclusive)}
    out['scopes'].append(s)
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(out, indent=2) + '\n')
print(a.output)
