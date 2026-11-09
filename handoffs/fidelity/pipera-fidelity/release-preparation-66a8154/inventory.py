"""Read-only local/live-remote/worktree inventory. No ref or checkout changes."""
import concurrent.futures
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

repo, source_arg, output = sys.argv[1:]
output = Path(output)
if output.exists():
    raise SystemExit('Output must be new')
env = {**os.environ, 'GIT_OPTIONAL_LOCKS': '0'}


def git(*args, cwd=repo, check=True):
    p = subprocess.run(['git', *args], cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and p.returncode:
        raise RuntimeError(p.stderr.decode(errors='replace'))
    return p.stdout


source = git('rev-parse', source_arg + '^{commit}').decode().strip()
refs = []
for line in git('for-each-ref', '--format=%(refname)%09%(objectname)%09%(objecttype)%09%(upstream)%09%(worktreepath)').decode().splitlines():
    refs.append(dict(zip(['ref', 'object', 'type', 'upstream', 'worktreePath'], line.split('\t'))))
remote = []
for line in git('ls-remote', '--heads', '--tags', 'origin').decode().splitlines():
    sha, ref = line.split('\t')
    remote.append({'ref': ref, 'object': sha})
records, current = [], {}
for item in git('worktree', 'list', '--porcelain', '-z').split(b'\0'):
    if not item:
        if current:
            records.append(current)
            current = {}
        continue
    key, _, value = item.partition(b' ')
    current[key.decode()] = os.fsdecode(value) if value else True
if current:
    records.append(current)


def inspect(worktree):
    root = worktree['worktree']
    rows = git('status', '--porcelain=v1', '-z', '--untracked-files=all', cwd=root, check=False).split(b'\0')
    entries, index = [], 0
    while index < len(rows):
        row = rows[index]
        index += 1
        if not row:
            continue
        status, name = row[:2].decode(), os.fsdecode(row[3:])
        entry = {'status': status, 'path': name}
        if 'R' in status or 'C' in status:
            entry['originalPath'] = os.fsdecode(rows[index])
            index += 1
        file = Path(root) / name
        if file.is_file():
            try:
                data = file.read_bytes()
                entry.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
            except OSError as error:
                entry['readError'] = str(error)
        entries.append(entry)
    fields = git('show', '-s', '--format=%P%x09%T', worktree['HEAD'], cwd=root, check=False).decode().strip().split('\t')
    return {**worktree, 'parents': fields[0].split() if fields else [],
            'tree': fields[1] if len(fields) > 1 else None, 'dirtyOrUntracked': entries,
            'hold': 'No deletion authorized; dirty files need separate durable preservation and active owners must release their worktrees.'}


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    worktrees = list(pool.map(inspect, records))
unique = {r['object'] for r in refs + remote} | {w['HEAD'] for w in worktrees}
metadata = {}
for sha in sorted(unique):
    p = subprocess.run(['git', 'cat-file', '-t', sha], cwd=repo, env=env, capture_output=True, text=True)
    if p.returncode:
        metadata[sha] = {'present': False}
        continue
    kind = p.stdout.strip()
    commit = git('rev-parse', sha + '^{commit}', check=False).decode().strip()
    if commit:
        fields = git('show', '-s', '--format=%P%x09%T%x09%aI', commit).decode().strip().split('\t')
        metadata[sha] = {'present': True, 'type': kind, 'commit': commit,
                         'parents': fields[0].split(), 'tree': fields[1], 'authorDate': fields[2]}
    else:
        metadata[sha] = {'present': True, 'type': kind}
for ref in refs + remote:
    ref['commitMetadata'] = metadata[ref['object']]
report = {'schemaVersion': 1, 'capturedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'sourceCommit': source, 'sourceTree': git('rev-parse', source + '^{tree}').decode().strip(),
          'rootHeadAtEnd': git('rev-parse', 'HEAD').decode().strip(),
          'localRefs': refs, 'remoteLiveRefs': remote, 'worktrees': worktrees,
          'noRefsTagsBranchesOrWorktreesChanged': True}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'source': source, 'rootEnd': report['rootHeadAtEnd'], 'localRefs': len(refs),
                  'liveRemoteRefs': len(remote), 'worktrees': len(worktrees),
                  'dirtyWorktrees': sum(bool(w['dirtyOrUntracked']) for w in worktrees),
                  'dirtyEntries': sum(len(w['dirtyOrUntracked']) for w in worktrees),
                  'missingRemoteObjects': [r['ref'] for r in remote if not r['commitMetadata']['present']]}))
