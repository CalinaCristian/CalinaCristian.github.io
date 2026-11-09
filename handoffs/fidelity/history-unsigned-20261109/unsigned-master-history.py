#!/usr/bin/env python3
"""Prepare and validate an unsigned copy of master; never update a ref or push."""
import json
import subprocess
from pathlib import Path

ROOT = '/workspace/CalinaCristian.github.io'
def git(*args, data=None):
    return subprocess.check_output(['git', *args], cwd=ROOT, input=data)

tip = git('rev-parse', 'refs/remotes/origin/master').decode().strip()
commits = git('rev-list', '--reverse', '--topo-order', tip).decode().splitlines()
mapping = {}
signed = []
stripped_merge_tags = []
for old in commits:
    raw = git('cat-file', 'commit', old)
    headers, message = raw.split(b'\n\n', 1)
    groups = []
    for line in headers.split(b'\n'):
        if line.startswith(b' '):
            groups[-1].append(line)
        else:
            groups.append([line])
    new_groups = []
    for group in groups:
        name, _, value = group[0].partition(b' ')
        if name in (b'gpgsig', b'gpgsig-sha256'):
            if old not in signed:
                signed.append(old)
            continue
        if name == b'mergetag':
            stripped_merge_tags.append(old)
            continue
        if name == b'parent':
            group = [b'parent ' + mapping[value.decode()].encode()]
        new_groups.append(group)
    payload = b'\n'.join(line for group in new_groups for line in group) + b'\n\n' + message
    new = git('hash-object', '-t', 'commit', '-w', '--stdin', data=payload).decode().strip()
    copied = git('cat-file', 'commit', new)
    assert copied == payload
    assert git('rev-parse', old + '^{tree}') == git('rev-parse', new + '^{tree}')
    old_identity = [g for g in groups if g[0].split(b' ', 1)[0] in (b'author', b'committer', b'encoding')]
    new_identity = [g for g in new_groups if g[0].split(b' ', 1)[0] in (b'author', b'committer', b'encoding')]
    assert old_identity == new_identity
    assert copied.split(b'\n\n', 1)[1] == message
    assert not any(g[0].split(b' ', 1)[0] in (b'gpgsig', b'gpgsig-sha256') for g in new_groups)
    mapping[old] = new
new_tip = mapping[tip]
assert len(git('rev-list', new_tip).decode().splitlines()) == len(commits)
assert git('diff', '--exit-code', tip, new_tip) == b''
result = dict(originalTip=tip, unsignedTip=new_tip, totalCommits=len(commits),
              changedCommits=sum(a != b for a, b in mapping.items()),
              removedSignatures=signed, removedMergeTags=stripped_merge_tags,
              preserved=['all trees', 'author and committer identities and dates', 'messages', 'parent topology'],
              mapping=mapping, refsUpdated=False, pushed=False)
Path('/tmp/unsigned-master-history-plan.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'mapping'}, indent=2))
