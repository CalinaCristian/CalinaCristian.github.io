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


def git(*args, input=None):
    return subprocess.check_output(
        ['git', *args], cwd=ROOT, text=True, input=input).strip()


def git_succeeds(*args):
    return subprocess.run(
        ['git', *args], cwd=ROOT, capture_output=True).returncode == 0


def inspect(value, path, records, key=''):
    if isinstance(value, dict):
        for name, child in value.items():
            if 'source' in key.lower() and re.fullmatch('[a-f0-9]{40}', name):
                records.setdefault(name, set()).add(path)
            inspect(child, path, records,
                    name if not re.fullmatch('[a-f0-9]{40}', name) else key)
    elif isinstance(value, list):
        for child in value:
            inspect(child, path, records, key)
    elif isinstance(value, str):
        if (re.fullmatch('[a-f0-9]{40}', value)
                and re.search('commit|revision|baseline', key, re.I)):
            records.setdefault(value, set()).add(path)
        # Keep accepted implementation and prior-record links, restricted to
        # this repository, as well as the original capture-source fields.
        match = re.match(
            r'https://github\.com/CalinaCristian/CalinaCristian\.github\.io/'
            r'(?:blob|tree|commit)/([a-f0-9]{40})(?:/|$|#)', value, re.I)
        if match:
            records.setdefault(match.group(1).lower(), set()).add(path)


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
    records = {}
    paths = git('ls-tree', '-r', '--name-only', source, '--',
                'game/overview/evidence', 'game/overview/comparison-data')
    for path in paths.splitlines():
        if path.endswith('.json'):
            inspect(json.loads(git('show', source + ':' + path)), path, records)

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
    for revision, entries in origins.items():
        result = subprocess.run(['git', 'cat-file', '-t', revision], cwd=ROOT,
                                text=True, capture_output=True)
        status = 'available'
        parent = None
        if result.returncode:
            status = 'missing'
            missing.append(revision)
        elif result.stdout.strip() != 'commit':
            status = 'not-commit'
            invalid[revision] = result.stdout.strip()
        else:
            # Every ref and worktree HEAD is a direct archive parent. A capture
            # already retained by a parent records that relationship explicitly.
            if all(entry['kind'] == 'source-record' for entry in entries):
                parent = next((head for head in parents if git_succeeds(
                    'merge-base', '--is-ancestor', revision, head)), None)
            if parent is None:
                parent = revision
                parents.append(revision)
        provenance[revision] = {
            'origins': entries, 'objectStatus': status, 'archiveParent': parent,
        }
    return {
        'schemaVersion': 2,
        'sourceCommit': source,
        'tree': git('rev-parse', source + '^{tree}'),
        'captureSources': {key: sorted(value) for key, value in sorted(records.items())},
        'archiveParents': parents,
        'commitProvenance': provenance,
        'excludedSymbolicRefs': excluded_refs,
        'worktrees': worktrees,
        'missingCommitObjects': sorted(missing),
        'invalidCommitObjects': invalid,
        'unretainedWorktrees': unretained_worktrees,
        'remoteTrackingRefs': 'Local snapshot only; fetch remote heads separately before final archival.',
        'purpose': 'Retain all local heads, fetched remote-tracking heads, worktree HEADs, '
                   'historical capture, implementation and prior-record objects outside curated '
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
               or plan['unretainedWorktrees'])
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
        'unretainedWorktrees': plan['unretainedWorktrees'], 'tag': plan.get('tag'),
    }))
    if blocked:
        raise SystemExit('Archive blocked: missing/non-commit objects or unretained worktree HEADs; '
                         'inspect the JSON summary or --out plan for provenance.')


if __name__ == '__main__':
    main()
