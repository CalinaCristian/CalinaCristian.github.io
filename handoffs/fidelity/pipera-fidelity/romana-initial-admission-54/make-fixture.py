"""Project native observer diagnostics to portable CPU admission inputs.

All graph/ribbon/collider values consumed by replay-native.mjs remain exact.
Only unconsumed world sections and per-collider directBandSamples are omitted.
The constructor facts gzip is copied byte-for-byte. Never evaluate closures.
"""
from pathlib import Path
import gzip
import hashlib
import json
import sys

world, facts, destination = map(Path, sys.argv[1:])
destination.mkdir(parents=True, exist_ok=False)
digest = lambda b: hashlib.sha256(b).hexdigest()
world_gz, facts_gz = world.read_bytes(), facts.read_bytes()
world_raw, facts_raw = gzip.decompress(world_gz), gzip.decompress(facts_gz)
native = json.loads(world_raw)
keys = ['allEdges', 'graphNodes', 'graphEdgeIds', 'ribbons', 'colliders']
projection = {k: native[k] for k in keys}
projection['colliders'] = [{k: v for k, v in c.items() if k != 'directBandSamples'} for c in native['colliders']]
projected_raw = (json.dumps(projection, separators=(',', ':')) + '\n').encode()
(destination / 'world.json.gz').write_bytes(gzip.compress(projected_raw, mtime=0))
(destination / 'constructor-facts.json.gz').write_bytes(facts_gz)
manifest = {
    'sourceCommit': '54c044421640cfe3569bfc3f72159d2169f87581',
    'originalWorld': {'path': str(world), 'compressedSha256': digest(world_gz), 'rawSha256': digest(world_raw), 'rawBytes': len(world_raw)},
    'originalFacts': {'path': str(facts), 'compressedSha256': digest(facts_gz), 'rawSha256': digest(facts_raw), 'rawBytes': len(facts_raw)},
    'projection': {'worldFields': keys, 'omittedColliderDiagnosticFields': ['directBandSamples'], 'edges': len(projection['allEdges']), 'nodes': len(projection['graphNodes']), 'ribbons': len(projection['ribbons']), 'colliders': len(projection['colliders']), 'rawBytes': len(projected_raw), 'rawSha256': digest(projected_raw)},
    'files': [{'path': p.name, 'bytes': p.stat().st_size, 'sha256': digest(p.read_bytes())} for p in sorted(destination.iterdir())],
    'scope': 'Exact JSON-value projection, not inferred geometry or source regeneration. Every consumed graph/ribbon/collider field remains unchanged; function text stays a non-executable unknown marker. All original full native exports remain preserved at their producer paths.'
}
(destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'files': manifest['files'], 'counts': manifest['projection']}))
