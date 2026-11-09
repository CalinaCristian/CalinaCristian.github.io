#!/usr/bin/env python3
"""Plan local evidence retention; only --write-tag writes Git objects or refs.

Remote-tracking refs describe the last fetch. Fetch remote heads separately before
the final archive; this utility never contacts a remote or removes a ref/worktree.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RECORD_DIRECTORIES = ('game/overview/evidence', 'game/overview/comparison-data',
                      'handoffs/fidelity')
FULL_SHA1 = re.compile('[a-f0-9]{40}', re.I)


def git(*args, input=None):
    return subprocess.check_output(
        ['git', *args], cwd=ROOT, text=True, input=input).strip()


def git_succeeds(*args):
    return subprocess.run(
        ['git', *args], cwd=ROOT, capture_output=True).returncode == 0


def reference_key(key, source_map=False):
    # File/blob/tree/image digests are not commit references, even when a
    # surrounding field happens to contain "source" or "commit".
    if '/' in key or '.' in key:
        return False
    words = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', key).lower()
    tokens = set(re.findall('[a-z0-9]+', words))
    explicit_commit = bool(tokens & {'commit', 'commits', 'committed', 'revision',
                                     'revisions', 'baseline', 'baselines'})
    if tokens & {'blob', 'blobs', 'tree', 'trees', 'image', 'images', 'file',
                 'files', 'sha256'}:
        return False
    if not explicit_commit and tokens & {'hash', 'hashes', 'digest', 'digests'}:
        return False
    if source_map:
        return bool(tokens & {'source', 'sources'})
    return bool(explicit_commit or tokens & {'source', 'sources'}
                or ''.join(re.findall('[a-z0-9]+', words)) == 'parentmaster')


def inspect(value, path, records, key=''):
    if isinstance(value, dict):
        for name, child in value.items():
            revision_key = FULL_SHA1.fullmatch(name)
            if revision_key and reference_key(key, source_map=True):
                records.setdefault(name.lower(), set()).add(path)
            inspect(child, path, records, key if revision_key else name)
    elif isinstance(value, list):
        for child in value:
            inspect(child, path, records, key)
    elif isinstance(value, str):
        if FULL_SHA1.fullmatch(value) and reference_key(key):
            records.setdefault(value.lower(), set()).add(path)
        # Keep accepted implementation and prior-record links, restricted to
        # this repository, as well as the original capture-source fields.
        match = re.match(
            r'https://github\.com/CalinaCristian/CalinaCristian\.github\.io/'
            r'(?:blob|tree|commit)/([a-f0-9]{40})(?:/|$|#)', value, re.I)
        if match:
            records.setdefault(match.group(1).lower(), set()).add(path)


def source_records(source):
    # Read by blob ID: no path quoting ambiguities, one Git process, bounded
    # memory per JSON blob, and repeated blobs are parsed only once.
    listing = subprocess.check_output(
        ['git', 'ls-tree', '-r', '-z', source, '--', *RECORD_DIRECTORIES], cwd=ROOT)
    blobs = {}
    for entry in listing.split(b'\0'):
        if not entry:
            continue
        metadata, path = entry.split(b'\t', 1)
        if path.endswith(b'.json'):
            blobs.setdefault(metadata.split()[2], []).append(
                path.decode('utf-8', errors='surrogateescape'))
    records = {}
    scan = {'directories': list(RECORD_DIRECTORIES),
            'jsonFiles': sum(map(len, blobs.values())), 'uniqueJsonBlobs': len(blobs),
            'emptyJsonRecords': [], 'invalidJsonRecords': []}
    with subprocess.Popen(['git', 'cat-file', '--batch'], cwd=ROOT,
                          stdin=subprocess.PIPE, stdout=subprocess.PIPE) as batch:
        for blob, paths in blobs.items():
            batch.stdin.write(blob + b'\n')
            batch.stdin.flush()
            header = batch.stdout.readline().split()
            if len(header) != 3 or header[1] != b'blob':
                raise SystemExit('Cannot read recorded JSON blob: ' + repr(header))
            payload = batch.stdout.read(int(header[2]))
            if batch.stdout.read(1) != b'\n':
                raise SystemExit('Incomplete recorded JSON blob: ' + blob.decode())
            if not payload.strip():
                scan['emptyJsonRecords'].extend(paths)
                continue
            try:
                value = json.loads(payload)
            except (ValueError, UnicodeError) as error:
                scan['invalidJsonRecords'].extend(
                    {'path': path, 'error': str(error)} for path in paths)
                continue
            blob_records = {}
            inspect(value, paths[0], blob_records)
            for revision in blob_records:
                records.setdefault(revision, set()).update(paths)
        batch.stdin.close()
        if batch.wait():
            raise SystemExit('Git batch read failed')
    return records, scan


def commit_objects(revisions):
    # All inputs are object IDs from Git or strictly full-length JSON SHA-1s.
    rows = git('cat-file', '--batch-check=%(objectname) %(objecttype)',
               input='\n'.join(revisions) + '\n')
    return dict(row.split() for row in rows.splitlines())


def worktree_heads():
    # -z preserves spaces, newlines, non-ASCII paths and unquoted lock reasons.
    raw = subprocess.check_output(
        ['git', 'worktree', 'list', '--porcelain', '-z'], cwd=ROOT)
    worktrees = []
    for entry in raw.decode('utf-8', errors='surrogateescape').split('\0\0'):
        if not entry:
            continue
        fields = {}
        for line in entry.split('\0'):
            name, _, value = line.partition(' ')
            fields[name] = value
        worktrees.append({
            'path': fields['worktree'],
            'head': fields.get('HEAD'),
            'branch': fields.get('branch'),
            'detached': 'detached' in fields,
            'bare': 'bare' in fields,
            **{key: fields[key] for key in ('locked', 'prunable') if key in fields},
        })
    return worktrees


def make_plan(source):
    records, scan = source_records(source)

    origins = {}

    def retain(revision, origin):
        origins.setdefault(revision, []).append(origin)

    retain(source, {'kind': 'source'})
    excluded_refs = []
    refs = git('for-each-ref', '--format=%(refname)%00%(objectname)%00%(symref)',
               'refs/heads/', 'refs/remotes/')
    for line in refs.splitlines():
        ref, revision, symbolic_target = line.split('\0')
        if symbolic_target:
            excluded_refs.append({'ref': ref, 'target': symbolic_target,
                                  'reason': 'symbolic-ref'})
            continue
        retain(revision, {
            'kind': 'local-ref' if ref.startswith('refs/heads/') else 'remote-ref',
            'ref': ref,
        })
    worktrees = worktree_heads()
    unretained_worktrees = []
    for worktree in worktrees:
        if worktree['head'] and set(worktree['head']) != {'0'}:
            retain(worktree['head'], {'kind': 'worktree', **worktree})
        else:
            # Bare repositories and unborn branches have no commit to retain.
            # Unexpected missing HEADs fail closed instead of disappearing.
            worktree['headStatus'] = ('no-commit' if worktree['bare']
                                      or worktree['branch'] else 'missing')
            if worktree['headStatus'] == 'missing':
                unretained_worktrees.append(worktree['path'])
    for revision, paths in sorted(records.items()):
        for path in sorted(paths):
            retain(revision, {'kind': 'source-record', 'path': path})

    parents = []
    provenance = {}
    missing = []
    invalid = {}
    object_types = commit_objects(origins)
    available = [revision for revision in origins if object_types[revision] == 'commit']
    graph = {}
    for row in git('rev-list', '--parents', '--stdin',
                   input='\n'.join(available) + '\n').splitlines():
        revision, *ancestors = row.split()
        graph[revision] = ancestors
    covered_by = {}

    def cover(revision):
        pending = [revision]
        while pending:
            current = pending.pop()
            if current not in covered_by:
                covered_by[current] = revision
                pending.extend(graph[current])

    for revision, entries in origins.items():
        status = 'available'
        parent = None
        if object_types[revision] == 'missing':
            status = 'missing'
            missing.append(revision)
        elif object_types[revision] != 'commit':
            status = 'not-commit'
            invalid[revision] = object_types[revision]
        else:
            # Every ref and worktree HEAD is a direct archive parent. A capture
            # already retained by a parent records that relationship explicitly.
            if all(entry['kind'] == 'source-record' for entry in entries):
                parent = covered_by.get(revision)
            if parent is None:
                parent = revision
                parents.append(revision)
                cover(revision)
        provenance[revision] = {
            'origins': entries, 'objectStatus': status, 'archiveParent': parent,
        }
    return {
        'schemaVersion': 2,
        'sourceCommit': source,
        'tree': git('rev-parse', source + '^{tree}'),
        'captureSources': {key: sorted(value) for key, value in sorted(records.items())},
        'recordScan': scan,
        'archiveParents': parents,
        'commitProvenance': provenance,
        'excludedSymbolicRefs': excluded_refs,
        'worktrees': worktrees,
        'missingCommitObjects': sorted(missing),
        'invalidCommitObjects': invalid,
        'unretainedWorktrees': unretained_worktrees,
        'remoteTrackingRefs': 'Local snapshot only; fetch remote heads separately before final archival.',
        'purpose': 'Retain all local heads, fetched remote-tracking heads, worktree HEADs, '
                   'historical capture, implementation, prior-record and internal proof objects outside curated '
                   'master history before deleting task branches. No branch, source record or '
                   'capture date is rewritten.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default='HEAD')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--write-tag')
    args = parser.parse_args()
    source = git('rev-parse', '--verify', args.source + '^{commit}')
    plan = make_plan(source)
    blocked = (plan['missingCommitObjects'] or plan['invalidCommitObjects']
               or plan['unretainedWorktrees'] or plan['recordScan']['invalidJsonRecords'])
    if args.write_tag and not blocked:
        git('check-ref-format', 'refs/tags/' + args.write_tag)
        if git_succeeds('show-ref', '--verify', '--quiet', 'refs/tags/' + args.write_tag):
            raise SystemExit('Refusing to replace existing archive tag')
        archive = git(
            'commit-tree', plan['tree'],
            *[arg for head in plan['archiveParents'] for arg in ['-p', head]],
            input='Archive immutable fidelity evidence sources\n\n'
                  + json.dumps(plan, indent=2) + '\n')
        git('tag', '-a', args.write_tag, archive, '-m',
            'Historical fidelity development and capture sources; release history remains on master.')
        plan.update(archiveCommit=archive, tag=args.write_tag)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(plan, indent=2) + '\n')
    print(json.dumps({
        'sourceCommit': source, 'captureSources': len(plan['captureSources']),
        'archiveParents': len(plan['archiveParents']),
        'missing': plan['missingCommitObjects'], 'invalid': plan['invalidCommitObjects'],
        'sourceRecordFiles': plan['recordScan']['jsonFiles'],
        'invalidJsonRecords': plan['recordScan']['invalidJsonRecords'],
        'unretainedWorktrees': plan['unretainedWorktrees'], 'tag': plan.get('tag'),
    }))
    if blocked:
        raise SystemExit('Archive blocked: missing/non-commit objects, invalid JSON or unretained worktree HEADs; '
                         'inspect the JSON summary or --out plan for provenance.')


if __name__ == '__main__':
    main()
