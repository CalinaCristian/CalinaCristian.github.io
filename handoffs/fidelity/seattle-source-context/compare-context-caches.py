#!/usr/bin/env python3
"""Compare complete compiled source payloads, allowing only kernel hashes/build timing."""
import gzip, hashlib, json, pathlib, struct, sys

def unpack(p):
    b = gzip.decompress(pathlib.Path(p).read_bytes())
    assert b[:8] == b'DMCCACHE'
    n = struct.unpack_from('<I', b, 12)[0]
    return json.loads(b[16:16+n]), b[16+((n+3)//4)*4:]

a, ab = unpack(sys.argv[1])
b, bb = unpack(sys.argv[2])
ah, bh = a.pop('sourceConsumerHashes'), b.pop('sourceConsumerHashes')
at, bt = a['sourceGeometry'].pop('buildMs'), b['sourceGeometry'].pop('buildMs')
assert a == b, 'A source geometry/ownership/profile/collider metadata field changed'
assert ab == bb, 'A numeric attribute or index byte changed'
for path, expected in bh.items():
    assert hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest() == expected, path
print(json.dumps({'metadataIdenticalExceptKernelHashesAndBuildTiming': True,
    'numericBodyIdentical': True, 'numericBytes': len(ab), 'numericSHA256': hashlib.sha256(ab).hexdigest(),
    'changedKernelHashes': {p: {'before': ah[p], 'after': bh[p]} for p in ah if ah[p] != bh[p]},
    'buildMs': {'before': at, 'after': bt}, 'sourceDataSHA256': a['sourceDataSHA256'],
    'sourceRecords': a['sourceGeometry']['sourceRecords'], 'colliderCount': len(a['colliders']),
    'beforeCompressedSHA256': hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),
    'afterCompressedSHA256': hashlib.sha256(pathlib.Path(sys.argv[2]).read_bytes()).hexdigest()}, indent=2))
