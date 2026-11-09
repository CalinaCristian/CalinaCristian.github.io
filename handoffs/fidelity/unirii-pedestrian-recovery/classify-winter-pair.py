#!/usr/bin/env python3
"""Classify a read-only native pair trace, retaining exact clocks and bodies."""
import argparse, gzip, hashlib, json, math, os
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('directory', type=Path)
a = p.parse_args()
raw = (a.directory / 'report.json').read_bytes()
j = json.loads(raw)
assert j['complete'] and not j['errors'] and not j['consoleErrors'] and not j['failedRequests']

def hit(row, threshold):
    q = row['after']
    return (q['overlap']['orientedXZPenetrationM'] > threshold
            and q['overlap']['verticalOverlapM'] > 0
            and not any(v['inactive'] for v in q['actors']))

def intervals(rows, threshold):
    result, start = [], None
    for i, row in enumerate(rows):
        yes = hit(row, threshold)
        if yes and start is None:
            start = i
        if start is not None and (not yes or i == len(rows) - 1):
            end = i if yes else i - 1
            result.append({'firstStep': start, 'lastStep': end, 'steps': end - start + 1,
                           'physicalSeconds': sum(r['dt'] for r in rows[start:end + 1]),
                           'scenarioStart': rows[start]['before']['scenarioTime'],
                           'scenarioEnd': rows[end]['after']['scenarioTime'],
                           'trafficStart': rows[start]['before']['trafficTime'],
                           'trafficEnd': rows[end]['after']['trafficTime'],
                           'maxXZPenetrationM': max(r['after']['overlap']['orientedXZPenetrationM'] for r in rows[start:end + 1])})
            start = None
    return result

summary = {'sourceCommit': j['sourceCommit'], 'rawSha256': hashlib.sha256(raw).hexdigest(),
           'startedAt': j['startedAt'], 'endedAt': j['endedAt'], 'complete': True,
           'method': 'Every before/after physical 30Hz step, actual rendered mesh heading and native model dimensions; independent XZ OBB penetration plus vertical interval overlap. Duration sums caller dt and is cross-checked against native traffic/harness clocks. No vehicle, road, population, random stream or render setting was changed.',
           'classification': 'True sustained same-level rendered-body overlap on adjacent short segments of the same literal OSM service alley. Not a grade-separated source crossing and not a sampled-clock artifact.',
           'cases': [], 'errors': [], 'originalBudgetFailures': j['failures']}
for district in j['districts']:
    for case in district['cases']:
        for drive in case['drives']:
            rows = drive['pairSteps']
            for row in rows:
                for clock in ['trafficTime', 'harnessSim']:
                    assert abs(row['after'][clock] - row['before'][clock] - row['dt']) < 1e-8
            summary['cases'].append({'district': district['id'], 'condition': case['condition'],
                                     'phase': drive['phase'], 'steps': len(rows),
                                     'physicalSeconds': sum(r['dt'] for r in rows),
                                     'intervalsAboveHalfMetre': intervals(rows, .5),
                                     'intervalsAbove15cm': intervals(rows, .15),
                                     'issues': drive['issues']})

winter = next(c for c in j['districts'][0]['cases'] if c['condition']['id'] == 'winter')
rows = winter['drives'][0]['pairSteps']
episode = max(intervals(rows, .5), key=lambda r: r['physicalSeconds'])
first, last = episode['firstStep'], episode['lastStep']
peak = max(range(first, last + 1), key=lambda i: rows[i]['after']['overlap']['orientedXZPenetrationM'])
summary['episode'] = episode
summary['bodyAndSourceAtFirstDeepContact'] = rows[first]['after']
summary['bodyAndSourceAtPeak'] = rows[peak]['after']
summary['physicalSeparationAtEnd'] = rows[last + 1]
summary['causalLimits'] = 'The trace directly shows speed-zero 0.25m corrections increasing penetration, followed by a timed ghost allowing more penetration, and final out-of-view hatch relocation. It does not expose each overlapGuard internal call; the specific forward-nudge branch is a code-supported hypothesis pending a focused control.'
summary['proposedScope'] = 'Separately validate overlapGuard corrections against rendered OBB penetration and new contacts before applying them; preserve source routes, actor identities/random streams and monotonically separating escape. No vehicle-motion patch is included in this proof.'
(a.directory / 'classification.json').write_text(json.dumps(summary, indent=2) + '\n')
# Preserve every byte of the original report, including original detector MEDIUMs.
with open(a.directory / 'report.json.gz', 'wb') as f:
    f.write(gzip.compress(raw, compresslevel=9, mtime=0))
del raw

os.environ.setdefault('MPLCONFIGDIR', '/tmp/unirii-pedestrian-matplotlib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
fig, axes = plt.subplots(1, 2, figsize=(12, 5), layout='constrained')
ax = axes[0]
times = [r['after']['scenarioTime'] for r in rows]
ax.plot(times, [r['after']['overlap']['orientedXZPenetrationM'] for r in rows], label='Rendered XZ penetration')
ax.axhline(.5, color='#a32b23', linestyle='--', label='0.5m threshold')
ax.set(xlabel='Physical scenario clock (seconds)', ylabel='Metres', xlim=(43, 50), ylim=(-1.5, 1.2), title='Actual winter pair: continuous contact')
ax.legend(fontsize=8)
ax = axes[1]
snap = rows[peak]['after']
for color, v in zip(['#2265b4', '#d85534'], snap['actors']):
    e = v['edge']
    ax.plot([e['a']['x'], e['b']['x']], [e['a']['z'], e['b']['z']], color=color, linestyle=':', label=f"Source edge {e['id']}")
    b = v['renderedBody']; fx, fz = b['fx'], b['fz']; rx, rz = -fz, fx
    corners = [[b['x'] + f * fx * b['length'] / 2 + l * rx * b['width'] / 2,
                b['z'] + f * fz * b['length'] / 2 + l * rz * b['width'] / 2]
               for f, l in [(-1, -1), (-1, 1), (1, 1), (1, -1)]]
    ax.add_patch(Polygon(corners, facecolor=color, edgecolor=color, alpha=.5, label=f"{v['kind']} {v['id']}, y={v['y']:.2f}m"))
    ax.text(v['x'], v['z'], str(v['id']), ha='center', fontsize=9)
ax.set(xlabel='Native source world X (m)', ylabel='Native source world Z (m)', title='Actual rendered body bounds at peak', xlim=(-233, -221), ylim=(-64, -50))
ax.invert_yaxis(); ax.set_aspect('equal'); ax.legend(fontsize=7)
fig.savefig(a.directory / 'winter-body-classification.png', dpi=140)
plt.close(fig)
print(json.dumps({'sourceCommit': j['sourceCommit'], 'episode': episode,
                  'classificationSha256': hashlib.sha256((a.directory / 'classification.json').read_bytes()).hexdigest(),
                  'gzipBytes': (a.directory / 'report.json.gz').stat().st_size}))
