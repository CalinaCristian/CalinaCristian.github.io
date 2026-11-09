#!/usr/bin/env python3
"""Append literal area semantics from exact retained OSM IDs; leave existing data values unchanged."""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET


def sha(value):
    return hashlib.sha256(value).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--osm', type=Path, required=True)
    parser.add_argument('--proof', type=Path, required=True)
    args = parser.parse_args()
    original_bytes = args.data.read_bytes()
    data = json.loads(original_bytes)
    wanted = {s for s in data.get('areaSourceIds', []) if s}
    sources, conflicts, tiles = {}, [], []
    for file in sorted(args.osm.glob('*.xml')):
        raw = file.read_bytes()
        tiles.append({'file': file.name, 'sha256': sha(raw), 'bytes': len(raw)})
        for _, element in ET.iterparse(file, events=('end',)):
            if element.tag == 'node':
                element.clear()
            elif element.tag in ('way', 'relation'):
                source = ('w' if element.tag == 'way' else 'r') + element.get('id')
                if source in wanted:
                    all_tags = {t.get('k'): t.get('v') for t in element.iter('tag')}
                    tags = {k: all_tags[k] for k in ('water', 'natural', 'waterway') if k in all_tags}
                    if source in sources and sources[source]['tags'] != tags:
                        conflicts.append({'sourceId': source, 'before': sources[source]['tags'], 'after': tags, 'file': file.name})
                    sources[source] = {'sourceId': source, 'tags': tags, 'rawTagsSha256': sha(canonical(all_tags)), 'literalAreaTagsSha256': sha(canonical(tags)), 'version': element.get('version'), 'timestamp': element.get('timestamp'), 'file': file.name}
                element.clear()
    if conflicts:
        args.proof.write_text(json.dumps({'rawTagConflicts': conflicts, 'tiles': tiles}, indent=2) + '\n')
        raise SystemExit('Conflicting literal area tags; data was not changed')
    field = {source: sources[source]['tags'] for source in sorted(sources) if sources[source]['tags']}
    previous = {k: v for k, v in data.items() if k != 'areaSourceTags'}
    data['areaSourceTags'] = field
    assert {k: v for k, v in data.items() if k != 'areaSourceTags'} == previous
    output = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode() + b'\n'
    args.data.write_bytes(output)
    proof = {'schemaVersion': 1, 'data': str(args.data), 'source': 'Literal OpenStreetMap API0.6 elements, exact areaSourceIds only', 'attribution': '© OpenStreetMap contributors, ODbL', 'sourceAccessDate': '2026-11-08',
             'beforeDataSha256': sha(original_bytes), 'afterDataSha256': sha(output), 'existingFieldsUnchanged': True, 'existingFieldsSha256': sha(canonical(previous)), 'areaSourceTagsSha256': sha(canonical(field)), 'populatedAreaIdentities': len(field),
             'missingRawIdentities': sorted(wanted - sources.keys()), 'rawTagConflicts': conflicts, 'tiles': tiles, 'records': [sources[s] for s in sorted(sources)]}
    args.proof.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: proof[k] for k in ('populatedAreaIdentities', 'existingFieldsUnchanged', 'missingRawIdentities', 'rawTagConflicts', 'areaSourceTagsSha256')}))


if __name__ == '__main__':
    main()
